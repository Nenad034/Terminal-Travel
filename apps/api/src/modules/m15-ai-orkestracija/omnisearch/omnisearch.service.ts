import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { BookingsService } from '../../m5-rezervacije/bookings/bookings.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { AnthropicClientService } from '../anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { EntityResult, MatchedRoute, OmnisearchResponse } from './omnisearch-result.types';

export interface OmnisearchRequest {
  query: string;
  channel: 'INTERNAL_PANEL';
  actorUserId: string;
  ipAddress?: string | null;
}

const OMNISEARCH_AGENT_MODULE_CODE = 'M15_OMNISEARCH';
const BOOKING_REFERENCE_PATTERN = /TT-\d{4}-\d+/i;

// M17 spec §5.5, M15 spec §6.5.3 — statična navigacija po ulozi (levi meni/paleta) živi u
// panelu (apps/panel/src/lib/nav.ts), ne ovde. Ovaj registar je samo za rute koje omnisearch
// ume da PREDLOŽI kao rezultat pretrage konkretnog entiteta (§6.5.4 tačka 3 — link, ne akcija).
const bookingHref = (id: string) => `/rezervacije/pretraga?bookingId=${id}`;
const productHref = (id: string) => `/katalog/${id}`;

// M15 spec §6.5.4, tačka 3 — omnisearch NIKAD ne izvršava radnju. Ovaj rečnik prepoznaje
// upit koji liči na zahtev za radnju ("otkaži...", "pošalji...") da bi se odgovor svesno
// ograničio na link/navigaciju umesto na (nepostojeći) pokušaj izvršenja.
const ACTION_INTENT_WORDS = ['otkaž', 'otkaz', 'pošalji', "posalji", 'izmeni', 'potvrdi', 'rezerviš', 'rezervis', 'kreiraj', 'obriš', 'obris'];

@Injectable()
export class OmnisearchService {
  private readonly logger = new Logger(OmnisearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly permissions: PermissionsService,
    private readonly bookings: BookingsService,
    private readonly products: ProductsService,
    private readonly anthropic: AnthropicClientService,
    private readonly invocationLog: AgentInvocationLogService,
  ) {}

  async search(req: OmnisearchRequest): Promise<OmnisearchResponse> {
    const activation = await this.prisma.moduleAgentActivation.findUnique({
      where: { moduleCode: OMNISEARCH_AGENT_MODULE_CODE },
    });
    if (!activation || activation.status !== 'ACTIVATED') {
      return { active: false, matchedRoutes: [], entityResults: [] };
    }

    const result = await this.runSearch(req);

    // M15 spec §10 — svaki poziv beleži jedan AuditLogEntry sa actor_type = AI_AGENT (actor id
    // je seedovani OmnisearchAgent nalog), bez obzira na to da li je stigao do koraka 2 (LLM).
    const agentUser = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'OMNISEARCH_AGENT' } });
    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agentUser?.userId ?? null,
      module: 'M15',
      action: 'omnisearch.query',
      resourceType: 'OmnisearchQuery',
      resourceId: req.actorUserId,
      context: { query: req.query, channel: req.channel, onBehalfOf: req.actorUserId },
      ipAddress: req.ipAddress ?? null,
    });

    return result;
  }

  private async runSearch(req: OmnisearchRequest): Promise<OmnisearchResponse> {
    const matchedRoutes: MatchedRoute[] = [];
    const entityResults: EntityResult[] = [];

    // §6.5.4.1 — brzo direktno poklapanje, bez jezičkog modela.
    await this.directMatch(req, entityResults);

    const looksLikeActionRequest = ACTION_INTENT_WORDS.some((w) => req.query.toLowerCase().includes(w));
    const looksLikeQuestion = req.query.trim().length > 12 || req.query.includes('?');

    if (entityResults.length > 0) {
      for (const r of entityResults) matchedRoutes.push({ label: r.label, href: r.href });
      if (looksLikeActionRequest) {
        return {
          active: true,
          matchedRoutes,
          entityResults,
          aiAnswer:
            'Pronašao sam zapis na koji se pitanje odnosi. Radnju (otkazivanje/slanje/izmenu) potvrdi ručno na toj stranici — omnisearch samo pronalazi i navigira, nikad ne izvršava radnju.',
        };
      }
      return { active: true, matchedRoutes, entityResults };
    }

    if (!looksLikeQuestion) {
      return { active: true, matchedRoutes: [], entityResults: [] };
    }

    // §6.5.4.2 — jezički model, samo ako korak 1 nije našao ništa i upit liči na pitanje.
    if (!this.anthropic.isConfigured()) {
      return {
        active: true,
        matchedRoutes: [],
        entityResults: [],
        aiAnswer: 'AI odgovor trenutno nije dostupan (ANTHROPIC_API_KEY nije podešen na serveru) — pokušaj konkretniju pretragu (broj rezervacije, ime gosta, naziv proizvoda).',
      };
    }

    try {
      return await this.askAnthropic(req, looksLikeActionRequest);
    } catch (err) {
      this.logger.warn(`Anthropic poziv nije uspeo: ${(err as Error).message}`);
      return {
        active: true,
        matchedRoutes: [],
        entityResults: [],
        aiAnswer: 'AI odgovor trenutno nije dostupan — pokušaj konkretniju pretragu (broj rezervacije, ime gosta, naziv proizvoda).',
      };
    }
  }

  private async directMatch(req: OmnisearchRequest, out: EntityResult[]): Promise<void> {
    const q = req.query.trim();
    if (q.length === 0) return;

    const hasBookingPermission = await this.permissions.hasPermission(req.actorUserId, 'M5', 'booking', 'VIEW');
    if (hasBookingPermission) {
      const bookings = await this.searchBookings(req.actorUserId, q);
      out.push(...bookings);
    }

    const hasCatalogPermission = await this.permissions.hasPermission(req.actorUserId, 'M2', 'product', 'VIEW');
    if (hasCatalogPermission) {
      const products = await this.searchProducts(q);
      out.push(...products);
    }
  }

  /**
   * Poziva isti BookingsService.findAll koji koristi M5 BookingsController — sa identitetom
   * korisnika koji pretražuje (actorUserId), nikad sa širim pristupom agenta (M15 spec §6.5.2).
   */
  private async searchBookings(actorUserId: string, query: string): Promise<EntityResult[]> {
    const all = await this.bookings.findAll({}, { userId: actorUserId });
    const refMatch = BOOKING_REFERENCE_PATTERN.exec(query);
    const lowerQuery = query.toLowerCase();

    const matches = (all as any[]).filter((b) => {
      if (refMatch && String(b.bookingNumber).toLowerCase().includes(refMatch[0].toLowerCase())) return true;
      if (b.buyerName && String(b.buyerName).toLowerCase().includes(lowerQuery)) return true;
      return false;
    });

    return matches.slice(0, 10).map((b) => ({
      type: 'BOOKING' as const,
      id: b.id,
      label: `Rezervacija ${b.bookingNumber} — ${b.buyerName}`,
      href: bookingHref(b.id),
    }));
  }

  private async searchProducts(query: string): Promise<EntityResult[]> {
    const all = await this.products.findAll({});
    const lowerQuery = query.toLowerCase();
    const matches = (all as any[]).filter((p) => p.translation?.name?.toLowerCase().includes(lowerQuery));

    return matches.slice(0, 10).map((p) => {
      const media = (p.media as { url: string; category: string; order: number }[] | null) ?? null;
      return {
        type: 'PRODUCT' as const,
        id: p.id,
        label: p.translation?.name ?? p.id,
        href: productHref(p.id),
        // §6.5.4 tačka 2 — direktno M2 media[], bez jezičkog opisa fotografija.
        media: media ? media.map((m) => ({ url: m.url, category: m.category })) : null,
      };
    });
  }

  // §6.5.4.2 — mali, eksplicitan alat-surface (2 read-only pretrage), poziva iste user-scoped
  // servise kao korak 1. Namerno usko za prvi prolaz — više alata dolazi u narednim prolazima
  // (isti obrazac postepenih faza kao M17 sam, dokumentovano u spec changelog-u).
  private async askAnthropic(req: OmnisearchRequest, looksLikeActionRequest: boolean): Promise<OmnisearchResponse> {
    const client = this.anthropic.getClient();

    const tools = [
      {
        name: 'search_bookings',
        description: 'Pretraži rezervacije po broju rezervacije ili imenu gosta/kupca. Vraća najviše 10 rezultata.',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' as const, description: 'Broj rezervacije ili ime' } },
          required: ['query'],
        },
      },
      {
        name: 'search_catalog',
        description: 'Pretraži katalog proizvoda (hoteli, paket aranžmani) po nazivu.',
        input_schema: {
          type: 'object' as const,
          properties: { query: { type: 'string' as const, description: 'Naziv proizvoda ili destinacije' } },
          required: ['query'],
        },
      },
    ];

    const systemPrompt =
      'Ti si OmnisearchAgent za interni panel agencije Terminal Travel. Odgovaraš isključivo na osnovu ' +
      'rezultata alata koje pozivaš — nikad ne izmišljaš podatke. Odgovor drži kratkim (2-4 rečenice), na srpskom. ' +
      'Ako pitanje liči na zahtev za radnju (otkazivanje, slanje, izmenu), nikad ne tvrdi da si tu radnju izvršio — ' +
      'objasni da korisnik treba da je potvrdi na ekranu rezervacije.';

    let messages: any[] = [{ role: 'user', content: req.query }];
    const entityResults: EntityResult[] = [];
    const matchedRoutes: MatchedRoute[] = [];
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // M18 spec §6.3 — jedan AgentInvocationLog zapis po pozivu omnisearch-a (svi tool-use
    // iteracije zbrojene), ne po pojedinačnom Anthropic pozivu — actionCode identifikuje ceo
    // omnisearch upit, ne unutrašnji korak.
    const logInvocation = async () => {
      const agentUser = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'OMNISEARCH_AGENT' } });
      if (!agentUser) return; // seed nije pokrenut — ne blokira odgovor korisniku
      await this.invocationLog.record({
        agentId: agentUser.id,
        actionCode: 'omnisearch.query',
        requestedTier: agentUser.modelTier ?? 'LIGHT',
        securityCritical: false,
        modelIdentifier: AnthropicClientService.MODEL,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        latencyMs: Date.now() - startedAt,
      });
    };

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
        await logInvocation();
        return {
          active: true,
          matchedRoutes,
          entityResults,
          aiAnswer: textBlock?.text ?? undefined,
        };
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: any[] = [];
      for (const use of toolUses as any[]) {
        const q = String((use.input as any)?.query ?? req.query);
        let results: EntityResult[] = [];
        if (use.name === 'search_bookings') results = await this.searchBookings(req.actorUserId, q);
        else if (use.name === 'search_catalog') results = await this.searchProducts(q);

        for (const r of results) {
          if (!entityResults.find((e) => e.id === r.id)) entityResults.push(r);
          if (!matchedRoutes.find((m) => m.href === r.href)) matchedRoutes.push({ label: r.label, href: r.href });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(results.map((r) => ({ id: r.id, label: r.label }))),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    await logInvocation();
    return {
      active: true,
      matchedRoutes,
      entityResults,
      aiAnswer: looksLikeActionRequest
        ? 'Pronašao sam moguće rezultate — potvrdi radnju ručno na odgovarajućoj stranici.'
        : undefined,
    };
  }
}
