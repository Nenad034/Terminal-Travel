import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { OmnisearchService } from './omnisearch.service';
import { MAX_PAGE_SIZE } from '../../../common/pagination/pagination';

// Straničen oblik odgovora `BookingsService.findAll`/`ProductsService.findAll` (5.9.2026,
// dok. 39 nalaz 2.2) — test zadaje samo redove, omotač je uvek isti.
function stranica<T>(data: T[]) {
  return { data, total: data.length, page: 1, limit: 50, pageCount: 1, hasMore: false };
}

// M15 spec §10 izlazni kriterijum — testovi koji dokazuju: (1) aktivacioni gate blokira dok
// nije ACTIVATED, (2) omnisearch nikad ne poziva mutirajući endpoint drugih modula, (3) poziva
// se sa identitetom korisnika koji pretražuje, nikad sa širim pristupom agenta, (4) bez
// ANTHROPIC_API_KEY vraća objašnjenje umesto greške.
describe('OmnisearchService (M15 spec §6.5, §10)', () => {
  function makeService(overrides?: { activationStatus?: string; anthropicConfigured?: boolean }) {
    const activationStatus = overrides?.activationStatus ?? 'ACTIVATED';
    const prisma = {
      moduleAgentActivation: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            activationStatus ? { moduleCode: 'M15_OMNISEARCH', status: activationStatus } : null,
          ),
      },
      aIAgent: { findFirst: jest.fn().mockResolvedValue({ userId: 'agent-user-1' }) },
      // M15 spec §6.5.4.8 — `resolveComposeEmailMailbox` čita ovo direktno (nema sopstveni
      // servisni metod za "sva sanduča na koja korisnik ima REPLY", isti princip kao ostatak
      // ovog servisa koji čita M5/M2 preko sopstvenih servisa, ne preko Prisma direktno svuda).
      mailboxAccess: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const bookings = {
      findAll: jest.fn().mockResolvedValue(stranica([])),
      calendarDay: jest
        .fn()
        .mockResolvedValue({ ARRIVAL: [], DEPARTURE: [], STAYOVER: [], SINGLE_DAY: [] }),
    };
    const products = {
      findAll: jest.fn().mockResolvedValue(stranica([])),
      findAllPublic: jest.fn().mockResolvedValue([]),
    };
    const anthropic = {
      isConfigured: jest.fn().mockReturnValue(overrides?.anthropicConfigured ?? false),
      getClient: jest.fn(),
    };
    const invocationLog = {
      record: jest.fn().mockResolvedValue({ tier: 'LIGHT', estimatedCostEur: 0 }),
    };
    const helpAssistant = { ask: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const agencySettings = {
      getSanitizedBrandName: jest.fn().mockResolvedValue('Terminal Travel'),
    };
    // M15 spec §6.5.4.6 — prava M5 pretraga raspoloživosti (search_availability alat).
    const searchService = {
      search: jest.fn().mockResolvedValue([]),
      resolveDestination: jest.fn().mockResolvedValue({ country: 'Grčka', city: null }),
      suggestCountries: jest.fn().mockResolvedValue([{ country: 'Grčka', count: 3 }]),
    };
    // M15 spec §6.5.4.8 — `compose_email` zavisnosti (M22), mock po istom obrascu kao ostatak.
    const mailboxes = {
      findAccess: jest.fn().mockResolvedValue(null),
    };
    const emailThreads = {
      composeNewThread: jest
        .fn()
        .mockResolvedValue({ thread: { id: 'thread-1' }, message: { id: 'message-1' } }),
    };
    // M15 spec §6.5.4.10 — `open_table` (Terminal tabela); registar i izvlačenje su u TablesService.
    const tables = {
      run: jest.fn().mockResolvedValue({
        columns: [
          { key: 'broj', label: 'Broj', type: 'text' },
          { key: 'prodajna', label: 'Prodajna', type: 'money' },
        ],
        rows: [
          { _key: 'TT-1', broj: 'TT-1', prodajna: 1000 },
          { _key: 'TT-2', broj: 'TT-2', prodajna: 2500 },
        ],
        rowCount: 2,
        truncated: false,
      }),
    };

    const service = new OmnisearchService(
      prisma as any,
      auditLog as any,
      permissions as any,
      bookings as any,
      products as any,
      anthropic as any,
      invocationLog as any,
      helpAssistant as any,
      agencySettings as any,
      searchService as any,
      mailboxes as any,
      emailThreads as any,
      tables as any,
    );
    return {
      service,
      tables,
      prisma,
      auditLog,
      permissions,
      bookings,
      products,
      anthropic,
      invocationLog,
      helpAssistant,
      agencySettings,
      searchService,
      mailboxes,
      emailThreads,
    };
  }

  it('vraća active:false dok M15_OMNISEARCH nije ACTIVATED (§3 aktivacioni gate)', async () => {
    const { service, bookings } = makeService({ activationStatus: 'NOT_READY' });
    const result = await service.search({
      query: 'TT-2027-000482',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });
    expect(result.active).toBe(false);
    expect(bookings.findAll).not.toHaveBeenCalled(); // gate blokira PRE bilo kog pretraživanja
  });

  it('poziva BookingsService.findAll sa identitetom korisnika koji pretražuje, nikad sopstvenim širim pristupom agenta', async () => {
    const { service, bookings } = makeService();
    await service.search({
      query: 'TT-2027-000482',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'prodajni-agent-42',
    });
    expect(bookings.findAll).toHaveBeenCalledWith(
      {},
      { userId: 'prodajni-agent-42' },
      { limit: MAX_PAGE_SIZE },
    );
  });

  it('kratak pozdrav ("dobro veče") dobija ljubazan odgovor bez poziva jezičkom modelu, ne "nema rezultata"', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const result = await service.search({
      query: 'dobro veče',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });
    expect(result.aiAnswer).toMatch(/zdravo/i);
    expect(anthropic.getClient).not.toHaveBeenCalled();
  });

  it('vidljivost — različiti akteri dobijaju tačno ono što njihov identitet vraća, omnisearch ne proširuje rezultat', async () => {
    const { service, bookings } = makeService();
    bookings.findAll.mockImplementation((_filters: unknown, actor: { userId: string }) =>
      stranica(
        actor.userId === 'agent-A'
          ? [{ id: 'b1', bookingNumber: 'TT-2027-000001', buyerName: 'Marko' }]
          : [],
      ),
    );

    const resultA = await service.search({
      query: 'Marko',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'agent-A',
    });
    expect(resultA.entityResults).toHaveLength(1);

    const resultB = await service.search({
      query: 'Marko',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'agent-B',
    });
    expect(resultB.entityResults).toHaveLength(0); // agent-B ne vidi rezervaciju koju je M5 vratio samo za agent-A
  });

  it('bez ANTHROPIC_API_KEY (isConfigured=false) vraća objašnjenje, ne grešku, i ne baca izuzetak', async () => {
    const { service } = makeService({ anthropicConfigured: false });
    const result = await service.search({
      query: 'koje rezervacije čekaju fiskalni dokument ovog meseca',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });
    expect(result.active).toBe(true);
    expect(result.aiAnswer).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('upit koji liči na zahtev za radnju ("otkaži...") vraća link/navigaciju, ne izvršava radnju', async () => {
    const { service, bookings } = makeService();
    bookings.findAll.mockResolvedValue(
      stranica([{ id: 'b1', bookingNumber: 'TT-2027-000482', buyerName: 'Ana' }]),
    );
    const result = await service.search({
      query: 'otkaži rezervaciju TT-2027-000482',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });
    expect(result.matchedRoutes.length).toBeGreaterThan(0);
    expect(result.aiAnswer).toMatch(/potvrdi ručno/);
  });

  it('svaki poziv upisuje jedan AuditLogEntry sa actor_type = AI_AGENT (§10)', async () => {
    const { service, auditLog } = makeService();
    await service.search({ query: 'TT-2027-000482', channel: 'INTERNAL_PANEL', actorUserId: 'u1' });
    expect(auditLog.write).toHaveBeenCalledTimes(1);
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'AI_AGENT', module: 'M15', action: 'omnisearch.query' }),
    );
  });

  // M8 §3a — B2C_SITE radi anonimno (actorUserId=null), koristi javni findAllPublic (M2 spec
  // §5.1, dobavljača-slep serializer), i nikad ne poziva rezervacije bez prijavljenog gosta.
  it('B2C_SITE anoniman posetilac (actorUserId=null): pretražuje javni katalog, ne poziva bookings.findAll', async () => {
    const { service, bookings, products } = makeService();
    (products.findAllPublic as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        type: 'ACCOMMODATION',
        translation: { name: 'Hotel Jadran', slug: 'hotel-jadran' },
        media: null,
      },
    ]);
    const result = await service.search({
      query: 'Jadran',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(bookings.findAll).not.toHaveBeenCalled();
    expect(products.findAllPublic).toHaveBeenCalledWith('B2C_SITE', undefined);
    expect(result.entityResults).toHaveLength(1);
    expect(result.entityResults[0].href).toBe('/smestaj/hotel-jadran');
  });

  it('B2C_SITE prijavljen gost: pretražuje sopstvene rezervacije preko user-scoped BookingsService.findAll', async () => {
    const { service, bookings } = makeService();
    bookings.findAll.mockResolvedValue(
      stranica([{ id: 'b1', bookingNumber: 'TT-2027-000777', buyerName: 'Ana' }]),
    );
    const result = await service.search({
      query: 'TT-2027-000777',
      channel: 'B2C_SITE',
      actorUserId: 'gost-1',
    });
    expect(bookings.findAll).toHaveBeenCalledWith(
      {},
      { userId: 'gost-1' },
      { limit: MAX_PAGE_SIZE },
    );
    expect(result.entityResults[0].href).toBe('/nalog/moje-rezervacije');
  });

  it('B2C_SITE pitanje o platformi: kad M21 nema pristup (ForbiddenException), ne baca grešku korisniku', async () => {
    const { service, helpAssistant } = makeService({ anthropicConfigured: false });
    const result = await service.search({
      query: 'kako otkazujem rezervaciju',
      channel: 'B2C_SITE',
      actorUserId: 'gost-individual-1',
    });
    expect(helpAssistant.ask).toHaveBeenCalled();
    expect(result.active).toBe(true); // fallback na §6.5.4.2 objašnjenje, ne izuzetak
  });

  // avgust 2026 (PUBLIC_GUEST, M15 spec §11 "B2C_SITE omnisearch dopuna") — anoniman posetilac
  // VIŠE NE preskače M21: prosleđuje se actorUserId=null direktno, resolveHelpAudience (M21) ga
  // rešava u PUBLIC_GUEST bez ijednog upita nad bazom.
  it('B2C_SITE anoniman posetilac SADA poziva M21 sa actorUserId=null (PUBLIC_GUEST)', async () => {
    const { service, helpAssistant } = makeService({ anthropicConfigured: false });
    (helpAssistant.ask as jest.Mock).mockResolvedValue({
      answer: 'Sajt prikazuje procenat povraćaja pre potvrde otkazivanja.',
    });

    const result = await service.search({
      query: 'kako otkazujem rezervaciju',
      channel: 'B2C_SITE',
      actorUserId: null,
    });

    expect(helpAssistant.ask).toHaveBeenCalledWith(
      { question: 'kako otkazujem rezervaciju', lang: undefined },
      null,
    );
    expect(result.aiAnswer).toBe('Sajt prikazuje procenat povraćaja pre potvrde otkazivanja.');
  });

  it('B2C_SITE anoniman posetilac bez M21 odgovora (npr. confidence NONE) pada na opšti LLM fallback, ne baca grešku', async () => {
    const { service, helpAssistant } = makeService({ anthropicConfigured: false });
    (helpAssistant.ask as jest.Mock).mockResolvedValue({ answer: null });

    const result = await service.search({
      query: 'kako otkazujem rezervaciju',
      channel: 'B2C_SITE',
      actorUserId: null,
    });

    expect(helpAssistant.ask).toHaveBeenCalled();
    expect(result.active).toBe(true);
    expect(result.aiAnswer).toMatch(/ANTHROPIC_API_KEY/);
  });

  // M15 spec §6.5.1 dopuna (22.8.2026) — vlasnik potvrdio preko AskUserQuestion da AI treba da
  // vidi sadržaj otvorenog ekrana automatski (ne samo naziv), da bi mogao da analizira/predlaže
  // (bez izvršavanja radnji, isti postojeći OmnisearchAgent limit). Dva zahteva na server-side:
  // (1) sadržaj stvarno stiže do modela, (2) predugačak sadržaj se seče na PAGE_CONTENT_MAX_CHARS
  // bez obzira šta klijent pošalje (odbrana u dubinu).
  it('pageContent (sadržaj otvorenog ekrana) se prosleđuje modelu u user poruci', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Odgovor na osnovu ekrana.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'šta vidiš u ovom tabu',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      pageContent: 'Gost: Marko Marković, državljanstvo RS, pasoš AB1234567.',
    });

    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages[0].content).toContain('Sadržaj trenutnog ekrana');
    expect(sentMessages[0].content).toContain('Marko Marković');
    expect(sentMessages[0].content).toContain('šta vidiš u ovom tabu');
  });

  it('predugačak pageContent se seče na server-side granicu (odbrana u dubinu)', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj sadržaj ovog ekrana',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      pageContent: 'A'.repeat(50_000),
    });

    const sentMessages = create.mock.calls[0][0].messages;
    const contentBlockLength = (sentMessages[0].content as string).length;
    expect(contentBlockLength).toBeLessThan(9000); // 8000 + omotač teksta, daleko ispod 50000
  });

  it('bez pageContent-a, poruka modelu ne sadrži "Sadržaj trenutnog ekrana" blok', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj nešto opšte',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages[0].content).toBe('analiziraj nešto opšte');
  });

  // M15 spec §6.5.4.3 (25.8.2026) — više priloženih RECORD stavki (poređenje) ulazi u prompt kao
  // numerisana lista referenci, agent ih i dalje sam razrešava (nema sirovih podataka ovde).
  it('contextItems (RECORD, više stavki) se prosleđuju modelu kao numerisan blok "Priložen kontekst"', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'uporedi ove rezervacije',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        { type: 'RECORD', refLabel: 'Rezervacija TT-2026-100' },
        { type: 'RECORD', refLabel: 'Rezervacija TT-2026-101' },
      ],
    });

    const sentContent = create.mock.calls[0][0].messages[0].content as string;
    expect(sentContent).toContain('Priložen kontekst:');
    expect(sentContent).toContain('1. Rezervacija TT-2026-100');
    expect(sentContent).toContain('2. Rezervacija TT-2026-101');
    expect(sentContent).toContain('Pitanje: uporedi ove rezervacije');
  });

  // v1.42 (25.8.2026, na zahtev vlasnika — "kad se stavi modul u kontekst, agent treba ODMAH da
  // precesalja ceo modul") — priložen FILTERED_LIST za bookings sad SAM odmah povlači stvarne
  // redove (bez čekanja da model pozove filter_list) i ubacuje ih direktno u prompt.
  it('contextItems (FILTERED_LIST, bookings) odmah ubacuje STVARNE redove u prompt, bez čekanja na filter_list poziv', async () => {
    const { service, anthropic, bookings } = makeService({ anthropicConfigured: true });
    bookings.findAll.mockResolvedValue(
      stranica([
        {
          id: 'b1',
          bookingNumber: 'TT-2027-000001',
          buyerName: 'Marko Marković',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          totalPrice: 500,
          currency: 'EUR',
          createdAt: new Date('2027-01-15T00:00:00.000Z'),
          items: [
            {
              product: {
                destinationCity: 'Budva',
                destinationCountry: 'Crna Gora',
                type: 'ACCOMMODATION',
              },
            },
          ],
        },
      ]),
    );
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj ove rezultate',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        {
          type: 'FILTERED_LIST',
          view: 'bookings',
          filters: { status: 'CONFIRMED' },
          label: 'Lista rezervacija',
        },
      ],
    });

    const sentContent = create.mock.calls[0][0].messages[0].content as string;
    expect(sentContent).toContain(
      'Priložen prikaz "Lista rezervacija" — 1 rezultata ukupno, stvarni podaci ispod',
    );
    expect(sentContent).toContain('TT-2027-000001');
    expect(sentContent).toContain('Budva, Crna Gora');
    expect(sentContent).toContain('odgovori DIREKTNO iz njih na SVAKO pitanje');
    expect(create.mock.calls[0][0].tools.find((t: any) => t.name === 'filter_list')).toBeDefined();
  });

  // Pogled bez wired servisa (npr. crm) i dalje nema stvarne redove — poštena napomena umesto
  // izmišljenog spiska, agent se upućuje na filter_list SAMO ako pitanje traži drugačiju listu.
  it('contextItems (FILTERED_LIST, pogled bez podataka, npr. crm) priznaje da redovi nisu dostupni, ne izmišlja ih', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj ove rezultate',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        { type: 'FILTERED_LIST', view: 'crm', filters: {}, label: 'Gosti i nalogodavci' },
      ],
    });

    const sentContent = create.mock.calls[0][0].messages[0].content as string;
    expect(sentContent).toContain('stvarni redovi nisu dostupni za ovaj pogled');
    expect(sentContent).toContain('pogled "crm"');
    expect(sentContent).toContain('pozovi filter_list');
  });

  // v1.43 (25.8.2026, na zahtev vlasnika — prilog dokumenta preko "+") — FILE stavka nosi tekst
  // već izvučen preko POST .../extract-file, ubačen DIREKTNO u prompt (isti "odmah dostupno"
  // princip kao FILTERED_LIST redovi).
  it('contextItems (FILE) ubacuje izvučen tekst dokumenta direktno u prompt', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'o čemu govori ovaj dokument',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        {
          type: 'FILE',
          label: 'ugovor.pdf',
          content: 'Ugovor o saradnji između Terminal Travel i dobavljača X.',
        },
      ],
    });

    const sentContent = create.mock.calls[0][0].messages[0].content as string;
    expect(sentContent).toContain('Priložen dokument "ugovor.pdf"');
    expect(sentContent).toContain('Ugovor o saradnji između Terminal Travel i dobavljača X.');
  });

  // v1.43 — IMAGE stavka NE ulazi u tekstualni blok, postaje zaseban `image` content blok
  // (Claude Vision), `content` poruke prelazi sa stringa na niz blokova.
  it('contextItems (IMAGE) šalje sliku modelu kao zaseban image content blok (Claude Vision)', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'šta piše na ovoj slici',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        {
          type: 'IMAGE',
          label: 'screenshot.png',
          imageData: 'ZmFrZS1iYXNlNjQ=',
          imageMediaType: 'image/png',
        },
      ],
    });

    const sentContent = create.mock.calls[0][0].messages[0].content;
    expect(Array.isArray(sentContent)).toBe(true);
    expect(sentContent[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'ZmFrZS1iYXNlNjQ=' },
    });
    expect(sentContent[1].type).toBe('text');
    expect(sentContent[1].text).toBe('šta piše na ovoj slici');
  });

  // Bez slika, `content` OSTAJE običan string (nepromenjeno ponašanje) — dokazuje da multimodalni
  // oblik ne remeti postojeći tok kad korisnik ne priloži nijednu sliku.
  it('bez IMAGE stavki, content poruke ostaje običan string, ne niz blokova', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'zdravo, kako si',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(typeof create.mock.calls[0][0].messages[0].content).toBe('string');
  });

  // Nevažeći view/filteri se NE šalju modelu kao lažno-validna instrukcija — stavka se tiho
  // izostavi (fail soft, isti princip kao ostatak "agent ne izmišlja" — ovo je samo prompt tekst).
  it('contextItems (FILTERED_LIST, nepoznat view) se izostavlja iz prompta bez greške korisniku', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj ove rezultate',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      contextItems: [
        { type: 'FILTERED_LIST', view: 'ne-postoji', filters: {}, resultCount: 1, label: 'X' },
      ],
    });

    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages[0].content).toBe('analiziraj ove rezultate'); // isto kao bez ijednog konteksta
  });

  // Dopuna (25.8.2026, uživo — "da" posle pitanja o konkretnoj rezervaciji je davalo nepovezan
  // odgovor, jer je svaki `/omnisearch` poziv bio izolovan razgovor). Dokazuje da se `history`
  // stvarno prosleđuje modelu kao prethodne user/assistant ture, PRE tekućeg pitanja.
  it('history se prosleđuje modelu kao prethodne user/assistant poruke, poslednjih 6 tura', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Da, to je ta rezervacija.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const history = Array.from({ length: 8 }, (_, i) => ({
      question: `pitanje ${i}`,
      answer: `odgovor ${i}`,
    }));
    await service.search({
      query: 'da, to je upravo ta rezervacija',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
      history,
    });

    const sentMessages = create.mock.calls[0][0].messages;
    // 6 tura * 2 poruke (user+assistant) + tekuće pitanje na kraju.
    expect(sentMessages).toHaveLength(13);
    expect(sentMessages[0]).toEqual({ role: 'user', content: 'pitanje 2' }); // poslednjih 6, ne prve
    expect(sentMessages[sentMessages.length - 1]).toEqual({
      role: 'user',
      content: 'da, to je upravo ta rezervacija',
    });
  });

  it('bez history-je, poruka modelu sadrži samo tekuće pitanje', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'analiziraj nešto opšte',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages).toHaveLength(1);
  });

  // M5 spec §6.1 / M15 spec §6.5.1 dopuna (22.8.2026, na zahtev vlasnika — "nabavite alate koji
  // ovo omogucavaju", posle uživo nalaza da AI nije mogao da izlista rezervacije po datumu).
  // Novi alat `list_bookings_by_date` poziva ISTI `BookingsService.calendarDay` koji koristi
  // M17 kalendar ekran, in-process — dokazuje da (1) model stvarno dobija podatak nazad kroz
  // drugi krug poziva, (2) ista dozvola (`M5/booking/VIEW`) se proverava kao na pravom endpoint-u.
  it('list_bookings_by_date poziva BookingsService.calendarDay i vraća rezultat modelu', async () => {
    const { service, anthropic, bookings } = makeService({ anthropicConfigured: true });
    (bookings.calendarDay as jest.Mock).mockResolvedValue({
      ARRIVAL: [
        {
          bookingItemId: 'bi1',
          bookingId: 'b1',
          bookingNumber: 'TT-2027-000900',
          productId: 'p1',
          status: 'CONFIRMED',
          guests: ['Ana Anić'],
        },
      ],
      DEPARTURE: [],
      STAYOVER: [],
      SINGLE_DAY: [],
    });
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'list_bookings_by_date',
            input: { date: '2026-08-28' },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Na 28.8.2026. dolazi Ana Anić (TT-2027-000900).' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'koje rezervacije su na 28.08.2026',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(bookings.calendarDay).toHaveBeenCalledWith(new Date('2026-08-28'));
    expect(result.aiAnswer).toMatch(/Ana Anić/);
    expect(result.matchedRoutes.some((m) => m.label.includes('TT-2027-000900'))).toBe(true);
  });

  it('list_bookings_by_date odbija bez M5/booking/VIEW dozvole, isto kao pravi endpoint', async () => {
    const { service, anthropic, permissions } = makeService({ anthropicConfigured: true });
    (permissions.hasPermission as jest.Mock).mockResolvedValue(false);
    const create = jest.fn().mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'list_bookings_by_date',
          input: { date: '2026-08-28' },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'koje rezervacije su na 28.08.2026',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M5', 'booking', 'VIEW');
  });

  // Dopuna (25.8.2026, na zahtev vlasnika — "da li sada korisnik može kroz AI agenta da
  // zatraži pretragu po nekom filteru ili više njih... želim to za svaki modul"). Dokazuje da
  // `filter_list` (1) vraća ispravan link za validan pogled/polja, (2) validira dozvolu
  // identitetom pozivaoca, (3) odbija nepoznato polje/nedozvoljenu enum vrednost čitljivom
  // porukom modelu, umesto tihog prihvatanja ili pada.
  it('filter_list vraća link ka filtriranoj listi rezervacija kad su polja validna i dozvola postoji', async () => {
    const { service, anthropic, permissions } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'filter_list',
            input: {
              view: 'bookings',
              filters: { status: ['CONFIRMED', 'MODIFIED'], destinationCity: 'Budva' },
            },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Evo linka ka filtriranoj listi.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'pokaži potvrđene i izmenjene rezervacije za Budvu',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M5', 'booking', 'VIEW');
    expect(result.matchedRoutes).toHaveLength(1);
    expect(result.matchedRoutes[0].href).toBe(
      '/rezervacije/lista?status=CONFIRMED&status=MODIFIED&destinationCity=Budva',
    );
  });

  // Ispravka (25.8.2026, uživo nalaz — Fokus tab bez pageContent-a je na "koliko rezervacija
  // ima" dobijao "ne mogu da izbrojim iz linka", jer je filter_list do sada vraćao SAMO link).
  it('filter_list (bookings) vraća i stvaran broj rezultata, preko BookingsService.findAll sa identitetom pozivaoca', async () => {
    const { service, anthropic, bookings } = makeService({ anthropicConfigured: true });
    bookings.findAll.mockResolvedValue(
      stranica(Array.from({ length: 28 }, (_, i) => ({ id: `b${i}` }))),
    );
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'filter_list',
            input: { view: 'bookings', filters: {} },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Ima 28 rezervacija.' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'koliko rezervacija ima u sistemu',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(bookings.findAll).toHaveBeenCalledWith({}, { userId: 'u1' }, { limit: MAX_PAGE_SIZE });
    const toolResultMessage = create.mock.calls[1][0].messages.find(
      (m: any) => m.role === 'user' && Array.isArray(m.content),
    );
    const toolResultContent = JSON.parse(toolResultMessage.content[0].content);
    expect(toolResultContent.count).toBe(28);
  });

  it('filter_list (pogled bez brojanja, npr. crm) vraća countNote umesto pogrešnog broja', async () => {
    const { service, anthropic, permissions } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tu1', name: 'filter_list', input: { view: 'crm', filters: {} } },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'koliko nalogodavaca ima',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M6', 'client-account', 'VIEW');
    const toolResultMessage = create.mock.calls[1][0].messages.find(
      (m: any) => m.role === 'user' && Array.isArray(m.content),
    );
    const toolResultContent = JSON.parse(toolResultMessage.content[0].content);
    expect(toolResultContent.count).toBeUndefined();
    expect(toolResultContent.countNote).toMatch(/nije dostupan/);
  });

  it('filter_list odbija nepoznato polje čitljivom porukom, ne baca grešku', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'filter_list',
            input: { view: 'bookings', filters: { nepostojecePolje: 'x' } },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'filtriraj po nepostojećem polju',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(result.matchedRoutes).toHaveLength(0);
    const toolResultMessage = create.mock.calls[1][0].messages.find(
      (m: any) => m.role === 'user' && Array.isArray(m.content),
    );
    const toolResultContent = JSON.parse(toolResultMessage.content[0].content);
    expect(toolResultContent.error).toMatch(/Nepoznato polje/);
  });

  it('filter_list odbija bez dozvole za taj modul, ne otkriva href', async () => {
    const { service, anthropic, permissions } = makeService({ anthropicConfigured: true });
    (permissions.hasPermission as jest.Mock).mockResolvedValue(false);
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'filter_list',
            input: { view: 'crm', filters: { email: 'test@example.com' } },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'filtriraj nalogodavce po emailu',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(result.matchedRoutes).toHaveLength(0);
  });

  it('filter_list (reports) bira permission resurs dinamički prema izabranom tab-u', async () => {
    const { service, anthropic, permissions } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'filter_list',
            input: { view: 'reports', filters: { tab: 'smestaj', groupBy: 'room_type' } },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'pokaži izveštaj o smeštaju razvrstan po tipu sobe',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M13', 'report:occupancy', 'VIEW');
    expect(result.matchedRoutes[0].href).toBe('/izvestaji?tab=smestaj&groupBy=room_type');
  });

  // §6.5.4.3, §10 — "omnisearch nikad ne izvršava radnju sam": statička provera da servis
  // nema u SOPSTVENOM izvornom kodu nijedan poziv mutirajuće metode M5/M2 servisa (CREATE/
  // EDIT/SUBMIT/APPROVE/CANCEL). BookingsService/ProductsService imaju takve metode (cancel,
  // modify, confirmQuote, create...) — ovaj test dokazuje da ih OmnisearchService nikad ne zove.
  it('nema poziv nijedne mutirajuće (CREATE/EDIT/SUBMIT/APPROVE/CANCEL) metode M5/M2 servisa u izvornom kodu', () => {
    const source = fs.readFileSync(path.join(__dirname, 'omnisearch.service.ts'), 'utf8');
    const forbidden = [
      /this\.bookings\.(cancel|modify|create|confirmQuote|voucherOverride|assignGuide|updatePaymentStatus)\s*\(/,
      /this\.products\.(create|update|delete|publish)\s*\(/,
    ];
    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
    // Jedine dozvoljene M5/M2 pozive su read-only findAll.
    expect(source).toMatch(/this\.bookings\.findAll\(/);
    expect(source).toMatch(/this\.products\.findAll\(/);
  });

  // ---------------------------------------------------------------------------------------
  // M15 spec §6.5.4.6 (17.9.2026) — potpitanje kad upit za pretragu ponude nema dovoljno podataka
  // ---------------------------------------------------------------------------------------
  function availabilityToolCall(input: Record<string, unknown>) {
    return {
      content: [{ type: 'tool_use', id: 'tu-av', name: 'search_availability', input }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'tool_use',
    };
  }
  function textReply(text: string) {
    return {
      content: [{ type: 'text', text }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
    };
  }

  it('§6.5.4.6 B2C: „hotel u Grčkoj" bez perioda i sastava → alat NE pretražuje, vraća šta fali, odgovor je potpitanje (clarification: true)', async () => {
    const { service, anthropic, searchService } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce(availabilityToolCall({ destination: 'Grčka' }))
      .mockResolvedValueOnce(textReply('Za koji period i za koliko osoba?'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'tražim hotel u Grčkoj za porodicu',
      channel: 'B2C_SITE',
      actorUserId: null,
    });

    expect(searchService.search).not.toHaveBeenCalled();
    const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(toolResult.clarificationNeeded).toEqual(['period boravka', 'sastav putnika']);
    expect(result.clarification).toBe(true);
    expect(result.aiAnswer).toMatch(/period/);
    expect(result.entityResults).toHaveLength(0);
  });

  it('§6.5.4.6 B2C: pun upit (destinacija + datumi + sastav) pretražuje ODMAH preko M5 SearchService sa strukturisanim parametrima, bez potpitanja', async () => {
    const { service, anthropic, searchService } = makeService({ anthropicConfigured: true });
    (searchService.resolveDestination as jest.Mock).mockResolvedValue({
      country: 'Grčka',
      city: 'Halkidiki',
    });
    (searchService.search as jest.Mock).mockResolvedValue([
      {
        productId: 'p1',
        type: 'ACCOMMODATION',
        name: 'Hotel Poseidon',
        destinationCountry: 'Grčka',
        destinationCity: 'Halkidiki',
        stars: 4,
        thumbnail: { url: '/x.jpg', category: 'EXTERIOR' },
        offers: [
          { finalPrice: 98000, finalPriceCurrency: 'EUR', availabilityStatus: 'AVAILABLE' },
          { finalPrice: 85050, finalPriceCurrency: 'EUR', availabilityStatus: 'AVAILABLE' },
        ],
      },
    ]);
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        availabilityToolCall({
          destination: 'Halkidiki',
          stay_from: '2027-08-10',
          stay_to: '2027-08-17',
          adults: 2,
          children: 1,
        }),
      )
      .mockResolvedValueOnce(textReply('Hotel Poseidon, Halkidiki — od 850 EUR za 10–17.8.2027.'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'hotel na Halkidikiju 10-17.8.2027 za 2 odrasla i dete',
      channel: 'B2C_SITE',
      actorUserId: null,
    });

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'B2C_SITE',
        destinationCountry: 'Grčka',
        destinationCity: 'Halkidiki',
        stayFrom: '2027-08-10',
        stayTo: '2027-08-17',
        occupancy: { adults: 2, children: 1 },
      }),
    );
    const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(toolResult.results[0].fromPrice).toBe(850.5); // najjeftinija ponuda, ne prva; iz para u EUR
    expect(toolResult.entities).toBeUndefined(); // interno polje ne ide modelu
    expect(result.clarification).toBeUndefined();
    expect(result.entityResults[0]).toMatchObject({ id: 'p1', href: '/smestaj/p1' });
  });

  it('§6.5.4.6: posle DVA kruga potpitanja alat pretražuje sa onim što ima i navodi pretpostavke', async () => {
    const { service, anthropic, searchService } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce(availabilityToolCall({ destination: 'Grčka' }))
      .mockResolvedValueOnce(textReply('Evo šta ima u Grčkoj (bez datuma).'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'ne znam još, samo mi pokaži',
      channel: 'B2C_SITE',
      actorUserId: null,
      history: [
        { question: 'hotel u Grčkoj', answer: 'Za kada i za koliko osoba?', clarification: true },
        { question: 'nisam siguran', answer: 'Bar okvirno — koji mesec?', clarification: true },
      ],
    });

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ destinationCountry: 'Grčka' }),
    );
    const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(toolResult.assumed).toEqual(expect.arrayContaining([expect.stringMatching(/period/)]));
    expect(result.clarification).toBeUndefined();
  });

  it('§6.5.4.6: nepoznata destinacija vraća grešku + listu destinacija koje nudimo, ne pretražuje ceo katalog', async () => {
    const { service, anthropic, searchService } = makeService({ anthropicConfigured: true });
    (searchService.resolveDestination as jest.Mock).mockResolvedValue(null);
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        availabilityToolCall({
          destination: 'Atlantida',
          stay_from: '2027-07-01',
          stay_to: '2027-07-08',
          adults: 2,
        }),
      )
      .mockResolvedValueOnce(textReply('Atlantidu nemamo u ponudi; nudimo Grčku.'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'hotel u Atlantidi 1-8.7.2027 za dvoje',
      channel: 'B2C_SITE',
      actorUserId: null,
    });

    expect(searchService.search).not.toHaveBeenCalled();
    const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(toolResult.error).toMatch(/Atlantida/);
    expect(toolResult.availableDestinations).toEqual(['Grčka']);
  });

  it('§6.5.4.6 INTERNAL_PANEL: search_availability traži M5/booking/VIEW, isto kao SearchController', async () => {
    const { service, anthropic, searchService, permissions } = makeService({
      anthropicConfigured: true,
    });
    (permissions.hasPermission as jest.Mock).mockResolvedValue(false);
    const create = jest
      .fn()
      .mockResolvedValueOnce(
        availabilityToolCall({
          destination: 'Grčka',
          stay_from: '2027-07-01',
          stay_to: '2027-07-08',
          adults: 2,
        }),
      )
      .mockResolvedValueOnce(textReply('Nemate dozvolu.'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    await service.search({
      query: 'ima li nešto slobodno u Grčkoj 1-8.7.2027 za dvoje',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });

    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M5', 'booking', 'VIEW');
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('zamka 8.9: stop_reason = max_tokens vraća čitljivu poruku, ne prazan „nema rezultata"', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'tu1', name: 'search_availability', input: {} }],
      usage: { input_tokens: 10, output_tokens: 512 },
      stop_reason: 'max_tokens',
    });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'napiši mi detaljan pregled svih hotela u Grčkoj sa svim sadržajima',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(result.aiAnswer).toMatch(/presečen/);
  });

  it('zamka 7.8: product_type enum u šemi alata je IZVEDEN iz Prisma ProductType, ne prepisan', () => {
    const source = fs.readFileSync(path.join(__dirname, 'omnisearch.service.ts'), 'utf8');
    expect(source).toMatch(/enum: Object\.values\(ProductType\)/);
  });

  it('§6.5.4.6: model postavi potpitanje BEZ poziva alata (uživo nalaz 17.9.2026) → zastavica clarification ipak ide', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce(textReply('Trebam još: **za koji period i za koliko osoba?**'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'tražim hotel u Grčkoj za porodicu',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(result.clarification).toBe(true);
  });

  it('§6.5.4.6: posle „fali podatak" model vrati PRAZAN tekst → potpitanje se sastavi deterministički', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest
      .fn()
      .mockResolvedValueOnce(availabilityToolCall({ destination: 'Sitonija' }))
      .mockResolvedValueOnce({
        content: [],
        usage: { input_tokens: 1, output_tokens: 0 },
        stop_reason: 'end_turn',
      });
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'Sitonija 2027',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(result.clarification).toBe(true);
    expect(result.aiAnswer).toMatch(/period boravka i sastav putnika/);
  });

  it('§6.5.4.6 B2C: kratak upit („Crna Gora") ide modelu, ne vraća prazan odgovor; na INTERNAL_PANEL prag ostaje 12 znakova', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const create = jest.fn().mockResolvedValue(textReply('Za koji period i za koliko osoba?'));
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const b2c = await service.search({
      query: 'Crna Gora',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(b2c.clarification).toBe(true);

    const internal = await service.search({
      query: 'Crna Gora',
      channel: 'INTERNAL_PANEL',
      actorUserId: 'u1',
    });
    expect(create).toHaveBeenCalledTimes(1); // nije pozvan drugi put
    expect(internal.aiAnswer).toBeUndefined();
  });

  it('§6.5.4.6: posle pretrage sa punim podacima koja vrati 0, ponovljen poziv BEZ sastava putnika se odbija (uživo nalaz 17.9.2026)', async () => {
    const { service, anthropic, searchService } = makeService({ anthropicConfigured: true });
    (searchService.search as jest.Mock).mockResolvedValue([]);
    const full = {
      destination: 'Grčka',
      stay_from: '2027-06-20',
      stay_to: '2027-06-27',
      adults: 4,
    };
    const create = jest
      .fn()
      .mockResolvedValueOnce(availabilityToolCall(full))
      .mockResolvedValueOnce(availabilityToolCall({ destination: 'Grčka' }))
      .mockResolvedValueOnce(
        textReply('Za 4 osobe u tom periodu nema ponude — probajte dve sobe.'),
      );
    (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

    const result = await service.search({
      query: 'hotel u Grčkoj za 4 osobe 20-27.6.2027',
      channel: 'B2C_SITE',
      actorUserId: null,
    });
    expect(searchService.search).toHaveBeenCalledTimes(1);
    const second = JSON.parse(create.mock.calls[2][0].messages.at(-1).content[0].content);
    expect(second.error).toMatch(/ne uklanjaj/i);
    expect(result.entityResults).toHaveLength(0);
  });

  // M15 spec §6.5.4.10 / M17 §6e (19.9.2026) — open_table: model dobija SAŽETAK, kanal `table`.
  describe('open_table (§6.5.4.10)', () => {
    it('izvrši spec, modelu vrati sažetak sa zbirom (ne redove), a odgovoru doda `table` uz tekst', async () => {
      const { service, anthropic, tables } = makeService({ anthropicConfigured: true });
      const create = jest
        .fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tu1',
              name: 'open_table',
              input: { source: 'bookings', filters: { status: ['CONFIRMED'] }, title: 'Potvrđene' },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Otvorio sam tabelu sa 2 rezervacije.' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

      const result = await service.search({
        query: 'daj mi tabelu potvrđenih rezervacija',
        channel: 'INTERNAL_PANEL',
        actorUserId: 'u1',
      });

      expect(tables.run).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'bookings', filters: { status: ['CONFIRMED'] } }),
        'u1',
      );
      const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
      // novac u sažetku ide u osnovnoj jedinici (3500 centi → 35 EUR)
      expect(toolResult).toMatchObject({ opened: true, rowCount: 2, totals: { prodajna: 35 } });
      expect(toolResult.rows).toBeUndefined();
      expect(result.aiAnswer).toBe('Otvorio sam tabelu sa 2 rezervacije.');
      expect(result.table).toMatchObject({
        spec: { source: 'bookings', title: 'Potvrđene' },
        rowCount: 2,
        truncated: false,
      });
      expect(result.table!.preview).toHaveLength(2);
    });

    it('greška izvora (npr. bez dozvole) ide modelu kao čitljiv tool_result, ne ruši razgovor', async () => {
      const { service, anthropic, tables } = makeService({ anthropicConfigured: true });
      (tables.run as jest.Mock).mockRejectedValueOnce(
        new Error('Nemate dozvolu M13/report:profitability/VIEW'),
      );
      const create = jest
        .fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tu1',
              name: 'open_table',
              input: { source: 'funnel', filters: { dimension: 'by_markup_rule' } },
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Nemate dozvolu za tu tabelu.' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

      const result = await service.search({
        query: 'marža po pravilu',
        channel: 'INTERNAL_PANEL',
        actorUserId: 'u1',
      });

      const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
      expect(toolResult.error).toMatch(/dozvolu/);
      expect(result.table).toBeUndefined();
      expect(result.aiAnswer).toBe('Nemate dozvolu za tu tabelu.');
    });

    it('contextItems TABLE ulazi u prompt kao sažetak (kolone, zbir, izabrani redovi, scenario)', async () => {
      const { service, anthropic } = makeService({ anthropicConfigured: true });
      const create = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Marža u scenariju je za 300 veća.' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

      await service.search({
        query: 'objasni razliku',
        channel: 'INTERNAL_PANEL',
        actorUserId: 'u1',
        contextItems: [
          {
            type: 'TABLE',
            spec: { source: 'bookings', filters: { status: 'CONFIRMED' }, title: 'Potvrđene' },
            columns: [{ key: 'prodajna', label: 'Prodajna' }],
            resultCount: 2,
            totals: { prodajna: 3500 },
            selectedRows: [{ broj: 'TT-1', prodajna: 1000 }],
            scenario: {
              params: { marza_pct: 18 },
              totalsReal: { marza: 500 },
              totalsScenario: { marza: 800 },
            },
          },
        ],
      });

      const userMsg = create.mock.calls[0][0].messages[0].content;
      const text = typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg);
      expect(text).toContain('Terminal tabelu "Potvrđene"');
      expect(text).toContain('"prodajna":3500');
      expect(text).toContain('SCENARIO');
      expect(text).toContain('nikad ih ne menjaš sam');
    });
  });

  // M15 spec §6.5.4.8 (18.9.2026) — compose_email NIKAD ne piše ništa u bazu iz tool-use petlje.
  describe('compose_email (§6.5.4.8)', () => {
    it('sa tačno jednim REPLY sandučetom vraća pendingEmailDraft i ne poziva emailThreads.composeNewThread', async () => {
      const { service, anthropic, prisma, emailThreads } = makeService({
        anthropicConfigured: true,
      });
      (prisma.mailboxAccess.findMany as jest.Mock).mockResolvedValue([
        { mailbox: { id: 'mb-1', address: 'rezervacije@agencija.rs' } },
      ]);
      const create = jest.fn().mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'compose_email',
            input: { to: 'gost@primer.com', subject: 'Ponuda', body: 'Zdravo' },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

      const result = await service.search({
        query: 'posalji mejl gostu',
        channel: 'INTERNAL_PANEL',
        actorUserId: 'u1',
      });

      expect(create).toHaveBeenCalledTimes(1); // petlja PREKINUTA, nema drugog poziva modelu
      expect(emailThreads.composeNewThread).not.toHaveBeenCalled(); // ništa nije upisano
      expect(result.pendingEmailDraft).toEqual({
        to: 'gost@primer.com',
        subject: 'Ponuda',
        body: 'Zdravo',
        mailboxId: 'mb-1',
        mailboxAddress: 'rezervacije@agencija.rs',
      });
    });

    it('sa dva REPLY sandučeta vraća grešku modelu (ne pogađa) i model nastavlja tekstom', async () => {
      const { service, anthropic, prisma } = makeService({ anthropicConfigured: true });
      (prisma.mailboxAccess.findMany as jest.Mock).mockResolvedValue([
        { mailbox: { id: 'mb-1', address: 'rezervacije@agencija.rs' } },
        { mailbox: { id: 'mb-2', address: 'racuni@agencija.rs' } },
      ]);
      const create = jest
        .fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tu1',
              name: 'compose_email',
              input: { to: 'gost@primer.com', subject: 'Ponuda', body: 'Zdravo' },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 5 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Iz kog sandučeta da pošaljem?' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      (anthropic.getClient as jest.Mock).mockReturnValue({ messages: { create } });

      const result = await service.search({
        query: 'posalji mejl gostu',
        channel: 'INTERNAL_PANEL',
        actorUserId: 'u1',
      });

      expect(create).toHaveBeenCalledTimes(2);
      const toolResult = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
      expect(toolResult.error).toMatch(/više sandučeta/i);
      expect(result.pendingEmailDraft).toBeUndefined();
      expect(result.aiAnswer).toBe('Iz kog sandučeta da pošaljem?');
    });
  });

  describe('approveComposeEmail/denyComposeEmail (§6.5.4.8)', () => {
    const pending = {
      to: 'gost@primer.com',
      subject: 'Ponuda',
      body: 'Zdravo',
      mailboxId: 'mb-1',
      mailboxAddress: 'rezervacije@agencija.rs',
    };

    it('odobrenje dok M15_EMAIL_COMPOSE nije ACTIVATED baca ForbiddenException (isti obrazac kao M15_WEB_RESEARCH)', async () => {
      const { service, emailThreads } = makeService({ activationStatus: 'NOT_READY' });
      await expect(service.approveComposeEmail(pending, 'u1')).rejects.toThrow(/nije aktivirano/);
      expect(emailThreads.composeNewThread).not.toHaveBeenCalled();
    });

    it('odobrenje bez REPLY pristupa baca ForbiddenException, ne piše ništa', async () => {
      const { service, mailboxes, emailThreads } = makeService();
      (mailboxes.findAccess as jest.Mock).mockResolvedValue(null);
      await expect(service.approveComposeEmail(pending, 'u1')).rejects.toThrow(
        /Nemaš REPLY pristup/,
      );
      expect(emailThreads.composeNewThread).not.toHaveBeenCalled();
    });

    it('odobrenje sa REPLY pristupom poziva composeNewThread sa send:false i upisuje audit log', async () => {
      const { service, mailboxes, emailThreads, auditLog } = makeService();
      (mailboxes.findAccess as jest.Mock).mockResolvedValue({ accessLevel: 'REPLY' });

      const result = await service.approveComposeEmail(pending, 'u1');

      expect(emailThreads.composeNewThread).toHaveBeenCalledWith(
        {
          mailboxId: 'mb-1',
          toAddresses: ['gost@primer.com'],
          subject: 'Ponuda',
          body: 'Zdravo',
          correspondentType: 'OTHER',
          send: false,
        },
        'u1',
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'omnisearch.compose_email.approve' }),
      );
      expect(result).toEqual({ threadId: 'thread-1' });
    });

    it('odbijanje upisuje audit log bez poziva composeNewThread', async () => {
      const { service, emailThreads, auditLog } = makeService();
      await service.denyComposeEmail(pending, 'u1');
      expect(emailThreads.composeNewThread).not.toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'omnisearch.compose_email.deny' }),
      );
    });
  });
});
