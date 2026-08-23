import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ReportsService } from '../../m13-bi/reports/reports.service';
import { SupplierObligationsService } from '../../m10-finansije/supplier-obligations/supplier-obligations.service';
import { SubagentsService } from '../../m7-b2b-subagenti/subagents/subagents.service';
import { AnthropicClientService } from '../anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { ConversationsService } from '../../m19-komunikaciona-platforma/conversations/conversations.service';
import { ensureConversationUploadDir, sanitizeAttachmentFileName } from '../../m19-komunikaciona-platforma/conversations/attachment-storage';
import { generateExcelBuffer, generateHtmlString, generatePdfBuffer, type ReportData } from './report-generator';
import { getReport, saveReport } from './report-store';

const BI_TERMINAL_MODULE_CODE = 'M15_BI_TERMINAL';

export interface BiTerminalResponse {
  active: boolean;
  answer?: string;
  links?: { label: string; href: string }[];
  report?: { id: string; format: 'EXCEL' | 'PDF' | 'HTML'; fileName: string };
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
    private readonly conversations: ConversationsService,
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
      {
        // Dopuna (23.8.2026, na zahtev vlasnika — "omogucite kreiranje excel tabela, pdf i html
        // izvestaja") — generiše fajl OD PODATAKA koje je neki drugi alat iznad već pročitao (isti
        // "source" vokabular), NIKAD sopstveni upit. Samo priprema/preuzimanje — SLANJE mejlom/chatom
        // je poseban, ljudski potvrđen korak (§6.9.3 dopuna, "predloži pa čovek odobri", ne ovaj alat).
        name: 'generate_report',
        description:
          'Pripremi izveštaj za preuzimanje u traženom formatu, od podataka koje daje jedan od ostalih alata (source). Ne šalje ništa — samo priprema fajl.',
        input_schema: {
          type: 'object' as const,
          properties: {
            format: { type: 'string' as const, enum: ['EXCEL', 'PDF', 'HTML'], description: 'Format fajla' },
            source: {
              type: 'string' as const,
              enum: ['sales_today', 'subagent_bookings', 'unpaid_arrangements', 'list_subagents', 'report_snapshot'],
              description: 'Koji od postojećih alata daje podatke za izveštaj',
            },
            subagentName: { type: 'string' as const, description: 'Prosleđuje se subagent_bookings izvoru — opciono' },
            from: { type: 'string' as const, description: 'Prosleđuje se izvoru koji prima period — opciono' },
            to: { type: 'string' as const, description: 'Prosleđuje se izvoru koji prima period — opciono' },
          },
          required: ['format', 'source'],
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
    let generatedReport: BiTerminalResponse['report'] | undefined;

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
          result = await this.callTool(use.name, use.input as Record<string, unknown>, addLink, actorUserId, (r) => {
            generatedReport = r;
          });
        } catch (err) {
          // BAG (23.8.2026, uživo test — `generate_report` je tiho padao na CJS/ESM uvoz
          // problemu, exceljs/pdfkit) — greška je stizala do jezičkog modela kao string, koji ju
          // je preveo u ljubaznu rečenicu, ali PRAVI uzrok nikad nije dospeo u server log. Sad se
          // loguje ovde, ne samo prosleđuje modelu.
          this.logger.error(`Alat "${use.name}" bacio grešku: ${(err as Error).message}`, (err as Error).stack);
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

    return { active: true, answer: finalAnswer ?? 'Nisam uspeo da sastavim odgovor — pokušaj drugačije formulisano pitanje.', links, report: generatedReport };
  }

  // Zatvorena lista (§6.9.3) — jezički model bira KOJI alat i sa kojim parametrima, ne sastavlja
  // sopstveni upit. Svaki alat je isključivo VIEW/read-only poziv postojećeg internog servisa.
  // `addLink` — isto poreklo kao OmnisearchAgent `matchedRoutes` (§6.5.4 tačka 3): alat SME da
  // predloži link ka zapisu koji je pronašao, nikad da izvrši radnju preko njega. `setReport` —
  // isto, ali za `generate_report` (priprema fajla, ne slanje, vidi §6.9.3 dopuna).
  private async callTool(
    name: string,
    input: Record<string, unknown>,
    addLink: (label: string, href: string) => void,
    actorUserId: string,
    setReport: (r: BiTerminalResponse['report']) => void,
  ): Promise<unknown> {
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
      case 'generate_report': {
        return this.generateReport(input, actorUserId, setReport);
      }
      default:
        return { error: `Nepoznat alat: ${name}` };
    }
  }

  private async buildReportData(source: string, input: Record<string, unknown>): Promise<ReportData> {
    const noopLink = () => {};
    switch (source) {
      case 'sales_today': {
        const today = new Date().toISOString().slice(0, 10);
        const data = await this.reports.sales({ from: today, to: today });
        return { title: 'Prodaja danas', rows: [data] };
      }
      case 'subagent_bookings': {
        const data = await this.subagentBookings(
          input.subagentName as string | undefined,
          input.from as string | undefined,
          input.to as string | undefined,
          noopLink,
        );
        return { title: 'Promet po subagentima', rows: Array.isArray(data) ? data : [] };
      }
      case 'list_subagents': {
        const data = await this.listSubagents(noopLink);
        return { title: 'Spisak subagenata', rows: data };
      }
      case 'unpaid_arrangements': {
        const pending = await this.supplierObligations.findAll({ status: 'PENDING' });
        const approved = await this.supplierObligations.findAll({ status: 'APPROVED' });
        return { title: 'Nenaplaćeni aranžmani', rows: [...pending, ...approved] };
      }
      case 'report_snapshot': {
        const data = await this.reports.sales({ from: input.from as string | undefined, to: input.to as string | undefined });
        return { title: 'Pregled prodaje', rows: [data] };
      }
      default:
        return { title: 'Izveštaj', rows: [] };
    }
  }

  private async generateReport(
    input: Record<string, unknown>,
    actorUserId: string,
    setReport: (r: BiTerminalResponse['report']) => void,
  ): Promise<unknown> {
    const format = input.format as 'EXCEL' | 'PDF' | 'HTML';
    const source = input.source as string;
    const data = await this.buildReportData(source, input);

    let buffer: Buffer;
    let mimeType: string;
    let extension: string;
    if (format === 'EXCEL') {
      buffer = await generateExcelBuffer(data);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (format === 'PDF') {
      buffer = await generatePdfBuffer(data);
      mimeType = 'application/pdf';
      extension = 'pdf';
    } else {
      buffer = Buffer.from(generateHtmlString(data), 'utf8');
      mimeType = 'text/html';
      extension = 'html';
    }

    // BAG (23.8.2026, uživo test) — `\w` ne pokriva slova sa kvakicama (č/ž/š...), pa je
    // "Nenaplaćeni aranžmani" postajalo "Nenapla_eni_aran_mani" — `\p{L}` (unicode slovo) čuva ih,
    // briše samo stvarno nedozvoljene znakove za ime fajla.
    const fileName = `${data.title.replace(/[^\p{L}\p{N}-]+/gu, '_')}.${extension}`;
    const id = saveReport({ buffer, mimeType, fileName, createdBy: actorUserId });
    setReport({ id, format, fileName });
    return { ready: true, fileName, rowCount: data.rows.length };
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

  // §6.9.3 dopuna — ljudski pokrenut klik (kontroler), ne alat u tool-use petlji. Ponovo koristi
  // POSTOJEĆI M19 tok za prilog uz poruku (§2.5) — piše fajl na isto mesto gde bi ga upisao
  // `FileInterceptor`/multer da je korisnik ručno otpremio prilog kroz chat, pa zove
  // `ConversationsService.createMessage` identično kao ta ruta. Nema novog kanala za slanje.
  async sendReportToChat(reportId: string, conversationId: string, actorUserId: string) {
    const report = getReport(reportId);
    if (!report) throw new NotFoundException('Izveštaj je istekao ili ne postoji — ponovo zatraži u terminalu.');

    const dir = ensureConversationUploadDir(conversationId);
    const diskName = `${randomUUID()}-${sanitizeAttachmentFileName(report.fileName)}`;
    const fullPath = join(dir, diskName);
    writeFileSync(fullPath, report.buffer);

    const syntheticFile = {
      originalname: report.fileName,
      mimetype: report.mimeType,
      size: report.buffer.length,
      path: fullPath,
    } as Express.Multer.File;

    return this.conversations.createMessage(conversationId, { body: `Izveštaj: ${report.fileName}` }, actorUserId, syntheticFile);
  }
}
