import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { LanguageCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { BookingsService } from '../../m5-rezervacije/bookings/bookings.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { AnthropicClientService } from '../anthropic/anthropic-client.service';
import { AgentInvocationLogService } from '../../m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { HelpAssistantService } from '../../m21-centar-za-pomoc/help-assistant/help-assistant.service';
import { EntityResult, MatchedRoute, OmnisearchResponse } from './omnisearch-result.types';

export type OmnisearchChannel = 'INTERNAL_PANEL' | 'B2C_SITE';

export interface OmnisearchRequest {
  query: string;
  channel: OmnisearchChannel;
  /** null = anoniman posetilac — dozvoljeno SAMO za channel = B2C_SITE (M8 §3a, "radi anonimno"). */
  actorUserId: string | null;
  lang?: LanguageCode;
  /** M15 spec §6.5.1 dopuna (22.8.2026) — vidljiv tekst otvorenog taba, samo INTERNAL_PANEL. */
  pageContent?: string;
  /**
   * M15 spec §6.5.4.2 dopuna (25.8.2026, uživo — "da" posle pitanja o konkretnoj rezervaciji
   * je davalo nepovezan odgovor) — kratkotrajna istorija RAZGOVORA U OVOJ SESIJI PREGLEDAČA,
   * isti obrazac kao BiTerminalQueryDto.history (23.8.2026). Server je i dalje bez trajne
   * memorije poruka — panel šalje prethodne ture na svaki poziv, servis samo koristi
   * poslednjih 6 (vidi askAnthropic ispod).
   */
  history?: { question: string; answer: string }[];
  ipAddress?: string | null;
}

// Server-side gornja granica dužine priloženog sadržaja ekrana (odbrana u dubinu, ne oslanja
// se samo na klijentsko sečenje) — ~2000 tokena, drži trošak po poruci predvidivim (M18 §6.5).
const PAGE_CONTENT_MAX_CHARS = 8000;

const OMNISEARCH_AGENT_MODULE_CODE = 'M15_OMNISEARCH';
const BOOKING_REFERENCE_PATTERN = /TT-\d{4}-\d+/i;

// M17 spec §5.5, M15 spec §6.5.3 — statična navigacija po ulozi (levi meni/paleta) živi u
// panelu (apps/panel/src/lib/nav.ts), ne ovde. Ovaj registar je samo za rute koje omnisearch
// ume da PREDLOŽI kao rezultat pretrage konkretnog entiteta (§6.5.4 tačka 3 — link, ne akcija).
const bookingHref = (channel: OmnisearchChannel, id: string) =>
  channel === 'INTERNAL_PANEL' ? `/rezervacije/pretraga?bookingId=${id}` : '/nalog/moje-rezervacije';
const productHref = (channel: OmnisearchChannel, id: string, productType?: string, slug?: string | null) =>
  channel === 'INTERNAL_PANEL' ? `/katalog/${id}` : `/${categorySlug(productType)}/${slug ?? id}`;

// Mirror apps/web/src/lib/categories.ts (M2 spec §2.1/§11 Product.type enum) — B2C rute su
// `/{tip}/{slug}` (M8 spec poglavlje 2), sajt-strana ove mape živi u frontendu, ova kopija samo
// gradi ISPRAVAN relativan href u odgovoru (bez locale prefiksa — frontend ga dodaje).
const CATEGORY_SLUGS: Record<string, string> = {
  ACCOMMODATION: 'smestaj',
  PACKAGE: 'aranzmani',
  EXCURSION: 'izleti',
  TRANSFER: 'transferi',
  TRANSPORT: 'prevoz',
  FLIGHT: 'letovi',
  TICKET: 'karte',
  EVENT: 'dogadjaji',
  INSURANCE: 'osiguranje',
};
function categorySlug(type?: string): string {
  return (type && CATEGORY_SLUGS[type]) || (type ? type.toLowerCase() : 'smestaj');
}

// M15 spec §6.5.4, tačka 3 — omnisearch NIKAD ne izvršava radnju. Ovaj rečnik prepoznaje
// upit koji liči na zahtev za radnju ("otkaži...", "pošalji...") da bi se odgovor svesno
// ograničio na link/navigaciju umesto na (nepostojeći) pokušaj izvršenja.
const ACTION_INTENT_WORDS = ['otkaž', 'otkaz', 'pošalji', "posalji", 'izmeni', 'potvrdi', 'rezerviš', 'rezervis', 'kreiraj', 'obriš', 'obris'];

// M8 spec §3a tačka b — reči koje ukazuju na pitanje o platformi/uslovima (ne o proizvodu),
// za B2C_SITE kanal, koje se prosleđuju M21 umesto M5 (M15 spec §6.5.5).
const HELP_INTENT_WORDS = [
  'kako', 'zašto', 'zasto', 'otkazivanj', 'otkaziv', 'boravišn', 'boravisn', 'taksa', 'uslov',
  'nalog', 'račun', 'racun', 'plaćanj', 'placanj', 'refundacij', 'povraćaj', 'povracaj', 'garancij',
];

// Kratke fraze (npr. "dobro veče", "ćao") su prekratke da prođu looksLikeQuestion prag (§6.5.4.2)
// pa bez ovoga dobijaju prazan "nema rezultata" umesto ljubaznog odgovora — deterministički
// odgovor, BEZ poziva jezičkom modelu (isti duh kao §6.5.4.1 direktno poklapanje).
const GREETING_PATTERN = /^(zdravo|ćao|cao|hej|hi|hello|dobro\s?jutro|dobar\s?dan|dobro\s?ve[cč]e|pozdrav)[!.?\s]*$/i;
const GREETING_REPLY = 'Zdravo! Kako mogu da pomognem — pitajte me o rezervaciji, gostu ili proizvodu iz kataloga.';

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
    private readonly helpAssistant: HelpAssistantService,
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
    // resourceId ostaje "anonymous" za anoniman B2C_SITE poziv (nema actorUserId da se upiše).
    const agentUser = await this.prisma.aIAgent.findFirst({ where: { agentRole: 'OMNISEARCH_AGENT' } });
    await this.auditLog.write({
      actorType: 'AI_AGENT',
      actorId: agentUser?.userId ?? null,
      module: 'M15',
      action: 'omnisearch.query',
      resourceType: 'OmnisearchQuery',
      resourceId: req.actorUserId ?? 'anonymous',
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
      if (GREETING_PATTERN.test(req.query.trim())) {
        return { active: true, matchedRoutes: [], entityResults: [], aiAnswer: GREETING_REPLY };
      }
      return { active: true, matchedRoutes: [], entityResults: [] };
    }

    // M8 §3a tačka b — pitanje o platformi/uslovima (B2C_SITE) ide ka M21, ne ka jezičkom
    // modelu ovog servisa (M15 spec §6.5.5: "OmnisearchAgent na M8 poziva i M21..."). Proba se
    // PRE Anthropic poziva ovde jer je to zaseban alat/domen, ne dodatni tool u istom pozivu.
    if (req.channel === 'B2C_SITE' && this.looksLikeHelpQuestion(req.query)) {
      const helpAnswer = await this.tryHelpCenter(req);
      if (helpAnswer) return helpAnswer;
      // Bez rezultata iz M21 (npr. confidence NONE, ili nalog bez rešive publike) nastavlja se
      // na §6.5.4.2 ispod, isti tok kao svako drugo pitanje. Anoniman posetilac i INDIVIDUAL
      // gost VIŠE nisu automatski u ovoj grani (avgust 2026, PUBLIC_GUEST) — pravi M21 pokušaj.
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

  private looksLikeHelpQuestion(query: string): boolean {
    const q = query.toLowerCase();
    return HELP_INTENT_WORDS.some((w) => q.includes(w));
  }

  /**
   * M8 §3a tačka b — prosleđuje pitanje M21 HelpAssistantService (in-process DI poziv, isti
   * obrazac kao BookingsService/ProductsService ovde). Otkad je M21 dobio PUBLIC_GUEST publiku
   * (avgust 2026, vlasnikova odluka — M15 spec §11 "B2C_SITE omnisearch dopuna"), `actorUserId`
   * se prosleđuje KAKAV JESTE, uključujući `null` za potpuno anonimnog B2C posetioca —
   * `resolveHelpAudience` (M21) taj slučaj rešava direktno u PUBLIC_GUEST, bez ijednog upita
   * nad bazom. VRAĆA null (ne grešku) kad M21 ipak nema pristup za tog aktera (npr. nalog bez
   * rešive publike — STAFF/SUBAGENT/GUEST su jedini tipovi koje M21 poznaje) — agent to tretira
   * "isto kao da je API vratio 403" (M15 spec §6.5.2), pa se tok vraća na opšti (LLM) pokušaj
   * umesto da baci grešku korisniku.
   */
  private async tryHelpCenter(req: OmnisearchRequest): Promise<OmnisearchResponse | null> {
    if (req.query.trim().length < 3) return null;
    try {
      const result = await this.helpAssistant.ask({ question: req.query, lang: req.lang }, req.actorUserId);
      if (!result.answer) return null;
      return {
        active: true,
        matchedRoutes: [],
        entityResults: [],
        aiAnswer: result.answer,
      };
    } catch (err) {
      if (err instanceof ForbiddenException) return null; // nema pristup Centru za pomoć (§5.2) — ne otkriva zašto
      this.logger.warn(`M21 help-center poziv nije uspeo: ${(err as Error).message}`);
      return null;
    }
  }

  private async directMatch(req: OmnisearchRequest, out: EntityResult[]): Promise<void> {
    const q = req.query.trim();
    if (q.length === 0) return;

    if (req.channel === 'B2C_SITE') {
      // M8 §3a/§8 — M8 nema sopstveni katalog dozvola u M1 (isti princip kao SearchController/
      // PublicProductsController); proizvodi su javni (findAllPublic), rezervacije su vidljive
      // SAMO prijavljenom gostu i SAMO njegove sopstvene (BookingsService.findAll je već
      // user-scoped, M15 spec §6.5.2 "gost na M8 vidi samo sopstvene rezervacije").
      if (req.actorUserId) {
        const bookings = await this.searchBookings(req.channel, req.actorUserId, q);
        out.push(...bookings);
      }
      const products = await this.searchProductsPublic(req.channel, q, req.lang);
      out.push(...products);
      return;
    }

    const hasBookingPermission = await this.permissions.hasPermission(req.actorUserId!, 'M5', 'booking', 'VIEW');
    if (hasBookingPermission) {
      const bookings = await this.searchBookings(req.channel, req.actorUserId!, q);
      out.push(...bookings);
    }

    const hasCatalogPermission = await this.permissions.hasPermission(req.actorUserId!, 'M2', 'product', 'VIEW');
    if (hasCatalogPermission) {
      const products = await this.searchProducts(req.channel, q);
      out.push(...products);
    }
  }

  /**
   * Poziva isti BookingsService.findAll koji koristi M5 BookingsController — sa identitetom
   * korisnika koji pretražuje (actorUserId), nikad sa širim pristupom agenta (M15 spec §6.5.2).
   */
  private async searchBookings(channel: OmnisearchChannel, actorUserId: string, query: string): Promise<EntityResult[]> {
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
      href: bookingHref(channel, b.id),
    }));
  }

  /**
   * Isti BookingsService.calendarDay koji koristi M5 BookingsController (`GET /bookings/calendar/:date`,
   * M17 kalendar ekran) — poziva se in-process, ista provera dozvole kao taj endpoint
   * (`M5/booking/VIEW`, kontroler nivo, nema dodatnog per-actor filtriranja jer je kalendar
   * agencijski operativni pregled, ne "moje rezervacije").
   */
  private async listBookingsByDate(actorUserId: string, date: string): Promise<Record<string, unknown>> {
    const hasPermission = await this.permissions.hasPermission(actorUserId, 'M5', 'booking', 'VIEW');
    if (!hasPermission) return { error: 'Nemate dozvolu za uvid u kalendar rezervacija.' };

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return { error: 'Neispravan datum — očekivan format YYYY-MM-DD.' };

    return this.bookings.calendarDay(parsed) as unknown as Record<string, unknown>;
  }

  private async searchProducts(channel: OmnisearchChannel, query: string): Promise<EntityResult[]> {
    const all = await this.products.findAll({});
    const lowerQuery = query.toLowerCase();
    const matches = (all as any[]).filter((p) => p.translation?.name?.toLowerCase().includes(lowerQuery));

    return matches.slice(0, 10).map((p) => {
      const media = (p.media as { url: string; category: string; order: number }[] | null) ?? null;
      return {
        type: 'PRODUCT' as const,
        id: p.id,
        label: p.translation?.name ?? p.id,
        href: productHref(channel, p.id),
        // §6.5.4 tačka 2 — direktno M2 media[], bez jezičkog opisa fotografija.
        media: media ? media.map((m) => ({ url: m.url, category: m.category })) : null,
      };
    });
  }

  /**
   * B2C_SITE varijanta — M2 `findAllPublic` (isti javni, dobavljača-slep serijalizator kao M2
   * PublicProductsController, M2 spec §5.1) filtrirano po `visible_channels=B2C_SITE` i
   * `status=ACTIVE`. Nikad ne otkriva `source_*` polja (identitet dobavljača) — polja su
   * fizički uklonjena u servisu, ne samo sakrivena (M15 spec §6.5.2).
   */
  private async searchProductsPublic(channel: OmnisearchChannel, query: string, lang?: LanguageCode): Promise<EntityResult[]> {
    const all = await this.products.findAllPublic('B2C_SITE', lang);
    const lowerQuery = query.toLowerCase();
    const matches = (all as any[]).filter((p) => p.translation?.name?.toLowerCase().includes(lowerQuery));

    return matches.slice(0, 10).map((p) => {
      const media = (p.media as { url: string; category: string; order: number }[] | null) ?? null;
      return {
        type: 'PRODUCT' as const,
        id: p.id,
        label: p.translation?.name ?? p.id,
        href: productHref(channel, p.id, p.type, p.translation?.slug ?? null),
        media: media ? media.map((m) => ({ url: m.url, category: m.category })) : null,
      };
    });
  }

  // §6.5.4.2 — mali, eksplicitan alat-surface (2 read-only pretrage), poziva iste user-scoped
  // servise kao korak 1. Namerno usko za prvi prolaz — više alata dolazi u narednim prolazima
  // (isti obrazac postepenih faza kao M17 sam, dokumentovano u spec changelog-u).
  private async askAnthropic(req: OmnisearchRequest, looksLikeActionRequest: boolean): Promise<OmnisearchResponse> {
    const client = this.anthropic.getClient();
    const isB2C = req.channel === 'B2C_SITE';

    const tools = isB2C
      ? [
          {
            name: 'search_products',
            description: 'Pretraži javni katalog proizvoda (hoteli, aranžmani, izleti) po nazivu ili destinaciji.',
            input_schema: {
              type: 'object' as const,
              properties: { query: { type: 'string' as const, description: 'Naziv proizvoda ili destinacije' } },
              required: ['query'],
            },
          },
        ]
      : [
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
          {
            // M5 spec §6.1 kalendar (isti obrazac kao M17 /rezervacije/kalendar ekran,
            // BookingsService.calendarDay) — dodato 22.8.2026 na zahtev vlasnika, posle uživo
            // nalaza da omnisearch nije imao nijedan alat za filtriranje po DATUMU (samo po
            // broju/imenu). Deljen in-process poziv, isti servis kao M5 BookingsController.
            name: 'list_bookings_by_date',
            description:
              'Vrati sve rezervacije za tačan datum, razvrstane na dolaske, odlaske, u toku (stayover) i jednodnevne. Koristi kad korisnik pita šta se dešava/koje rezervacije su na konkretan datum (kalendar), ne kad traži po broju rezervacije ili imenu.',
            input_schema: {
              type: 'object' as const,
              properties: { date: { type: 'string' as const, description: 'Datum u formatu YYYY-MM-DD' } },
              required: ['date'],
            },
          },
        ];

    const systemPrompt = isB2C
      ? 'Ti si OmnisearchAgent za javni sajt agencije Terminal Travel (B2C, gosti bez ili sa nalogom). ' +
        'Odgovaraš isključivo na osnovu rezultata alata koje pozivaš — nikad ne izmišljaš podatke, nikad ne ' +
        'otkrivaš identitet dobavljača. Odgovor drži kratkim (2-4 rečenice), na srpskom. Ako pitanje liči na ' +
        'zahtev za radnju (otkazivanje, izmenu), nikad ne tvrdi da si tu radnju izvršio — uputi korisnika na ' +
        '"Moje rezervacije" gde radnju ručno potvrđuje.'
      : 'Ti si OmnisearchAgent za interni panel agencije Terminal Travel. Odgovaraš isključivo na osnovu ' +
        'rezultata alata koje pozivaš i priloženog sadržaja ekrana (ako postoji) — nikad ne izmišljaš podatke. ' +
        'Odgovor drži kratkim (2-4 rečenice), na srpskom. Ako pitanje liči na zahtev za radnju (otkazivanje, ' +
        'slanje, izmenu), nikad ne tvrdi da si tu radnju izvršio i nikad je sam ne pokušavaj — ti nemaš i nikad ' +
        'nećeš imati mogućnost da menjaš podatke, samo analiziraš i predlažeš; objasni da korisnik treba sam da ' +
        'potvrdi radnju na ekranu. ' +
        'VAŽNO: svaka poruka može (ne mora) nositi blok "Sadržaj trenutnog ekrana" — to je vidljiv tekst taba koji ' +
        'je korisnik trenutno otvorio u panelu, priložen automatski. Kad taj blok postoji, koristi ga direktno da ' +
        'odgovoriš na pitanja o tom ekranu ("šta vidiš", "koje je stanje", "šta bi trebalo uraditi") — nemaš potrebu ' +
        'da pitaš korisnika šta se prikazuje, već je tu. Kad blok NE postoji (npr. prazna Početna, ili je korisnik ' +
        'svesno uklonio kontekst), a pitanje zavisi od ekrana, jasno reci da ne vidiš sadržaj i uputi korisnika da ' +
        'upiše konkretan broj rezervacije/ime/naziv proizvoda.';

    const pageContent = req.pageContent?.slice(0, PAGE_CONTENT_MAX_CHARS).trim();
    const userContent = pageContent
      ? `Sadržaj trenutnog ekrana:\n"""\n${pageContent}\n"""\n\nPitanje: ${req.query}`
      : req.query;
    // Istorija (25.8.2026, vidi OmnisearchRequest.history iznad) — samo tekst pitanja/odgovora
    // iz prethodnih tura (bez tool_use blokova, koji nisu sačuvani na klijentu), ograničeno na
    // poslednjih 6 tura, identičan princip kao BiTerminalAgent (bi-terminal.service.ts, 23.8.2026).
    const historyMessages: any[] = (req.history ?? []).slice(-6).flatMap((h) => [
      { role: 'user', content: h.question },
      { role: 'assistant', content: h.answer },
    ]);
    let messages: any[] = [...historyMessages, { role: 'user', content: userContent }];
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
        if (use.name === 'list_bookings_by_date') {
          const date = String((use.input as any)?.date ?? '');
          const dayResult = await this.listBookingsByDate(req.actorUserId!, date);
          toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(dayResult) });
          if (!('error' in dayResult)) {
            for (const category of Object.values(dayResult)) {
              for (const item of category as any[]) {
                const href = bookingHref(req.channel, item.bookingId);
                if (!matchedRoutes.find((m) => m.href === href)) {
                  matchedRoutes.push({ label: `Rezervacija ${item.bookingNumber}`, href });
                }
              }
            }
          }
          continue;
        }

        const q = String((use.input as any)?.query ?? req.query);
        let results: EntityResult[] = [];
        if (use.name === 'search_bookings') results = await this.searchBookings(req.channel, req.actorUserId!, q);
        else if (use.name === 'search_catalog') results = await this.searchProducts(req.channel, q);
        else if (use.name === 'search_products') results = await this.searchProductsPublic(req.channel, q, req.lang);

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
