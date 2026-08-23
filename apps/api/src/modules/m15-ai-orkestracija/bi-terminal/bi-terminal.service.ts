import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ReportsService } from '../../m13-bi/reports/reports.service';
import { SupplierObligationsService } from '../../m10-finansije/supplier-obligations/supplier-obligations.service';
import { SubagentsService } from '../../m7-b2b-subagenti/subagents/subagents.service';
import { AnthropicClientService } from '../anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';

const BI_TERMINAL_MODULE_CODE = 'M15_BI_TERMINAL';

export interface BiTerminalResponse {
  active: boolean;
  answer?: string;
  links?: { label: string; href: string }[];
}

// M15 spec §6.9 — terminal-stilizovan panel, isključivo Vlasnik. NIJE pravi shell: svaki unos
// je pitanje na prirodnom jeziku ka jeziku modelu koji bira ISKLJUČIVO iz zatvorene liste
// read-only alata (§6.9.3) — jezički model nikad ne sastavlja sopstveni upit ka bazi, isti
// "defense in depth" princip kao OmnisearchAgent (omnisearch.service.ts).
@Injectable()
export class BiTerminalService {
  private readonly logger = new Logger(BiTerminalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly reports: ReportsService,
    private readonly supplierObligations: SupplierObligationsService,
    private readonly subagents: SubagentsService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  async query(actorUserId: string, question: string): Promise<BiTerminalResponse> {
    const activation = await this.prisma.moduleAgentActivation.findUnique({
      where: { moduleCode: BI_TERMINAL_MODULE_CODE },
    });
    if (!activation || activation.status !== 'ACTIVATED') {
      return { active: false };
    }

    const client = this.anthropic.getClient();
    if (!client) {
      return { active: true, answer: 'AI odgovor trenutno nije dostupan (ANTHROPIC_API_KEY nije podešen na serveru).' };
    }

    const systemPrompt =
      'Ti si BiTerminalAgent, poslovni izveštajni asistent za Vlasnika agencije Terminal Travel. ' +
      'Odgovaraš ISKLJUČIVO na osnovu rezultata alata koje pozivaš — nikad ne izmišljaš brojeve/podatke. ' +
      'Nemaš i nikad nećeš imati mogućnost da bilo šta menjaš, briješ ili izvršavaš — samo čitaš i sažimaš. ' +
      'Ako pitanje traži nešto što nijedan alat ne pokriva, jasno reci šta ne možeš da uradiš umesto da nagađaš. ' +
      'Odgovor drži kratkim i konkretnim (brojevi, ne opisna proza), na srpskom.';

    const tools = [
      {
        name: 'sales_today',
        description: 'Vrati broj i ukupnu vrednost rezervacija potvrđenih danas.',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'subagent_bookings',
        description: 'Vrati rezervacije/promet po subagentu (B2B partneru). Ako se ne navede naziv, vraća zbir po svim subagentima.',
        input_schema: {
          type: 'object' as const,
          properties: {
            subagentName: { type: 'string' as const, description: 'Naziv subagenta (delimično poklapanje) — opciono' },
            from: { type: 'string' as const, description: 'Datum od (YYYY-MM-DD) — opciono' },
            to: { type: 'string' as const, description: 'Datum do (YYYY-MM-DD) — opciono' },
          },
        },
      },
      {
        name: 'unpaid_arrangements',
        description: 'Vrati listu aranžmana sa neizmirenom obavezom prema dobavljaču (PENDING/APPROVED, još neplaćeno).',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        // Dopuna (23.8.2026, na zahtev vlasnika — "da li ima neko iz Beograda") — `ClientAccount`
        // nema posebno polje za grad (samo `address` slobodan tekst i `country`), pa alat vraća
        // punu listu sa oba polja i PREPUŠTA jezičkom modelu da sam prepozna grad u tekstu
        // adrese — deterministički kod ovde ne pokušava geo-parsing, samo čita postojeće podatke.
        name: 'list_subagents',
        description: 'Vrati spisak svih subagenata (naziv, adresa, država, status). Koristi za pitanja o broju/lokaciji/statusu partnera, ne o njihovoj prodaji.',
        input_schema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'report_snapshot',
        description: 'Vrati agregatan pregled prodaje (broj rezervacija, vrednost, po kanalu/tipu proizvoda) za period.',
        input_schema: {
          type: 'object' as const,
          properties: {
            from: { type: 'string' as const, description: 'Datum od (YYYY-MM-DD) — opciono' },
            to: { type: 'string' as const, description: 'Datum do (YYYY-MM-DD) — opciono' },
          },
        },
      },
    ];

    let messages: any[] = [{ role: 'user', content: question }];
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolsCalled: string[] = [];
    // Dopuna (23.8.2026, na zahtev vlasnika — "dodajte linkovanje prema onome sto se moze
    // otvoriti putem linka") — isti obrazac kao OmnisearchAgent `matchedRoutes` (§6.5.4 tačka 3):
    // link vodi korisnika NA zapis, agent i dalje nikad sam ne izvršava ništa preko linka.
    const links: { label: string; href: string }[] = [];
    const addLink = (label: string, href: string) => {
      if (!links.find((l) => l.href === href)) links.push({ label, href });
    };

    const logInvocation = async () => {
      const agentUser = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'BI_TERMINAL_AGENT' } });
      if (!agentUser) return;
      await this.invocationLog.record({
        agentId: agentUser.id,
        actionCode: 'bi-terminal.query',
        requestedTier: agentUser.modelTier ?? 'LIGHT',
        securityCritical: false,
        modelIdentifier: AnthropicClientService.MODEL,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        latencyMs: Date.now() - startedAt,
      });
    };

    let finalAnswer: string | undefined;
    for (let iteration = 0; iteration < 3; iteration++) {
      const response = await client.messages.create({
        model: AnthropicClientService.MODEL,
        max_tokens: 512,
        system: systemPrompt,
        tools,
        messages,
      });
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolUses = response.content.filter((b: any) => b.type === 'tool_use');
      if (toolUses.length === 0) {
        const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
        finalAnswer = textBlock?.text;
        break;
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: any[] = [];
      for (const use of toolUses as any[]) {
        toolsCalled.push(use.name);
        let result: unknown;
        try {
          result = await this.callTool(use.name, use.input as Record<string, unknown>, addLink);
        } catch (err) {
          result = { error: (err as Error).message };
        }
        toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    await logInvocation();

    // §6.9.4 — trajna, neizbrisiva istorija kroz postojeći M1 append-only audit log, ne nov
    // mehanizam. "Obriši" u UI-ju je isključivo klijentsko sakrivanje, ovaj zapis ostaje zauvek.
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M15',
      action: 'bi-terminal.query',
      resourceType: 'BiTerminalQuery',
      resourceId: randomUUID(),
      context: { question, answer: finalAnswer ?? null, toolsCalled },
    });

    return { active: true, answer: finalAnswer ?? 'Nisam uspeo da sastavim odgovor — pokušaj drugačije formulisano pitanje.', links };
  }

  // Zatvorena lista (§6.9.3) — jezički model bira KOJI alat i sa kojim parametrima, ne sastavlja
  // sopstveni upit. Svaki alat je isključivo VIEW/read-only poziv postojećeg internog servisa.
  // `addLink` — isto poreklo kao OmnisearchAgent `matchedRoutes` (§6.5.4 tačka 3): alat SME da
  // predloži link ka zapisu koji je pronašao, nikad da izvrši radnju preko njega.
  private async callTool(name: string, input: Record<string, unknown>, addLink: (label: string, href: string) => void): Promise<unknown> {
    switch (name) {
      case 'sales_today': {
        const today = new Date().toISOString().slice(0, 10);
        return this.reports.sales({ from: today, to: today });
      }
      case 'subagent_bookings': {
        return this.subagentBookings(input.subagentName as string | undefined, input.from as string | undefined, input.to as string | undefined, addLink);
      }
      case 'list_subagents': {
        return this.listSubagents(addLink);
      }
      case 'unpaid_arrangements': {
        const pending = await this.supplierObligations.findAll({ status: 'PENDING' });
        const approved = await this.supplierObligations.findAll({ status: 'APPROVED' });
        if (pending.length + approved.length > 0) addLink('Finansije — obaveze prema dobavljačima', '/finansije');
        return [...pending, ...approved];
      }
      case 'report_snapshot': {
        addLink('Izveštaji — prodaja', '/izvestaji');
        return this.reports.sales({ from: input.from as string | undefined, to: input.to as string | undefined });
      }
      default:
        return { error: `Nepoznat alat: ${name}` };
    }
  }

  private async subagentClientAccounts() {
    const clientAccounts = await this.prisma.clientAccount.findMany({
      where: { accountType: 'LEGAL_ENTITY' },
      select: { id: true, companyName: true, fullName: true, address: true, country: true },
    });
    const subagentRows = await this.prisma.subagent.findMany({ select: { id: true, clientAccountId: true, status: true } });
    const subagentByClientAccountId = new Map(subagentRows.map((s) => [s.clientAccountId, s]));
    return clientAccounts
      .filter((c) => subagentByClientAccountId.has(c.id))
      .map((c) => ({ clientAccount: c, subagent: subagentByClientAccountId.get(c.id)! }));
  }

  private async subagentBookings(
    subagentName: string | undefined,
    from: string | undefined,
    to: string | undefined,
    addLink: (label: string, href: string) => void,
  ) {
    const all = await this.subagentClientAccounts();
    let candidates = all;
    if (subagentName) {
      const needle = subagentName.toLowerCase();
      candidates = candidates.filter((c) => (c.clientAccount.companyName ?? c.clientAccount.fullName ?? '').toLowerCase().includes(needle));
    }
    if (candidates.length === 0) return { error: `Nijedan subagent ne odgovara nazivu "${subagentName ?? ''}".` };

    const where: any = { clientAccountId: { in: candidates.map((c) => c.clientAccount.id) } };
    if (from || to) {
      where.bookingDate = {};
      if (from) where.bookingDate.gte = new Date(from);
      if (to) where.bookingDate.lte = new Date(to);
    }
    const rows = await this.prisma.factBooking.findMany({ where });

    const byClientAccount = new Map<string, { bookingCount: number; totalValue: number }>();
    for (const row of rows) {
      const acc = byClientAccount.get(row.clientAccountId) ?? { bookingCount: 0, totalValue: 0 };
      acc.bookingCount += 1;
      acc.totalValue += row.finalPrice;
      byClientAccount.set(row.clientAccountId, acc);
    }

    // Link po zapisu SAMO kad je rezultat dovoljno mali da linkovi budu korisni, ne spisak
    // (23.8.2026) — 43 subagenta bi za prostu "koliko ih ima" upit zatrpalo odgovor linkovima.
    const linkable = candidates.length <= 10;
    return candidates.map((c) => {
      const label = c.clientAccount.companyName ?? c.clientAccount.fullName ?? c.clientAccount.id;
      if (linkable) addLink(label, `/b2b/${c.subagent.id}`);
      return { subagentName: label, ...(byClientAccount.get(c.clientAccount.id) ?? { bookingCount: 0, totalValue: 0 }) };
    });
  }

  private async listSubagents(addLink: (label: string, href: string) => void) {
    const all = await this.subagentClientAccounts();
    const linkable = all.length <= 10;
    return all.map((c) => {
      const label = c.clientAccount.companyName ?? c.clientAccount.fullName ?? c.clientAccount.id;
      if (linkable) addLink(label, `/b2b/${c.subagent.id}`);
      return {
        subagentName: label,
        address: c.clientAccount.address,
        country: c.clientAccount.country,
        status: c.subagent.status,
      };
    });
  }
}
