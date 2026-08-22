import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { OmnisearchService } from './omnisearch.service';

// M15 spec §10 izlazni kriterijum — testovi koji dokazuju: (1) aktivacioni gate blokira dok
// nije ACTIVATED, (2) omnisearch nikad ne poziva mutirajući endpoint drugih modula, (3) poziva
// se sa identitetom korisnika koji pretražuje, nikad sa širim pristupom agenta, (4) bez
// ANTHROPIC_API_KEY vraća objašnjenje umesto greške.
describe('OmnisearchService (M15 spec §6.5, §10)', () => {
  function makeService(overrides?: { activationStatus?: string; anthropicConfigured?: boolean }) {
    const activationStatus = overrides?.activationStatus ?? 'ACTIVATED';
    const prisma = {
      moduleAgentActivation: {
        findUnique: jest.fn().mockResolvedValue(activationStatus ? { moduleCode: 'M15_OMNISEARCH', status: activationStatus } : null),
      },
      aIAgent: { findFirst: jest.fn().mockResolvedValue({ userId: 'agent-user-1' }) },
    };
    const auditLog = { write: jest.fn().mockResolvedValue(undefined) };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const bookings = { findAll: jest.fn().mockResolvedValue([]) };
    const products = { findAll: jest.fn().mockResolvedValue([]), findAllPublic: jest.fn().mockResolvedValue([]) };
    const anthropic = {
      isConfigured: jest.fn().mockReturnValue(overrides?.anthropicConfigured ?? false),
      getClient: jest.fn(),
    };
    const invocationLog = { record: jest.fn().mockResolvedValue({ tier: 'LIGHT', estimatedCostEur: 0 }) };
    const helpAssistant = { ask: jest.fn().mockRejectedValue(new ForbiddenException()) };

    const service = new OmnisearchService(
      prisma as any,
      auditLog as any,
      permissions as any,
      bookings as any,
      products as any,
      anthropic as any,
      invocationLog as any,
      helpAssistant as any,
    );
    return { service, prisma, auditLog, permissions, bookings, products, anthropic, invocationLog, helpAssistant };
  }

  it('vraća active:false dok M15_OMNISEARCH nije ACTIVATED (§3 aktivacioni gate)', async () => {
    const { service, bookings } = makeService({ activationStatus: 'NOT_READY' });
    const result = await service.search({ query: 'TT-2027-000482', channel: 'INTERNAL_PANEL', actorUserId: 'u1' });
    expect(result.active).toBe(false);
    expect(bookings.findAll).not.toHaveBeenCalled(); // gate blokira PRE bilo kog pretraživanja
  });

  it('poziva BookingsService.findAll sa identitetom korisnika koji pretražuje, nikad sopstvenim širim pristupom agenta', async () => {
    const { service, bookings } = makeService();
    await service.search({ query: 'TT-2027-000482', channel: 'INTERNAL_PANEL', actorUserId: 'prodajni-agent-42' });
    expect(bookings.findAll).toHaveBeenCalledWith({}, { userId: 'prodajni-agent-42' });
  });

  it('kratak pozdrav ("dobro veče") dobija ljubazan odgovor bez poziva jezičkom modelu, ne "nema rezultata"', async () => {
    const { service, anthropic } = makeService({ anthropicConfigured: true });
    const result = await service.search({ query: 'dobro veče', channel: 'INTERNAL_PANEL', actorUserId: 'u1' });
    expect(result.aiAnswer).toMatch(/zdravo/i);
    expect(anthropic.getClient).not.toHaveBeenCalled();
  });

  it('vidljivost — različiti akteri dobijaju tačno ono što njihov identitet vraća, omnisearch ne proširuje rezultat', async () => {
    const { service, bookings } = makeService();
    bookings.findAll.mockImplementation((_filters: unknown, actor: { userId: string }) =>
      actor.userId === 'agent-A' ? [{ id: 'b1', bookingNumber: 'TT-2027-000001', buyerName: 'Marko' }] : [],
    );

    const resultA = await service.search({ query: 'Marko', channel: 'INTERNAL_PANEL', actorUserId: 'agent-A' });
    expect(resultA.entityResults).toHaveLength(1);

    const resultB = await service.search({ query: 'Marko', channel: 'INTERNAL_PANEL', actorUserId: 'agent-B' });
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
    bookings.findAll.mockResolvedValue([{ id: 'b1', bookingNumber: 'TT-2027-000482', buyerName: 'Ana' }]);
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
      { id: 'p1', type: 'ACCOMMODATION', translation: { name: 'Hotel Jadran', slug: 'hotel-jadran' }, media: null },
    ]);
    const result = await service.search({ query: 'Jadran', channel: 'B2C_SITE', actorUserId: null });
    expect(bookings.findAll).not.toHaveBeenCalled();
    expect(products.findAllPublic).toHaveBeenCalledWith('B2C_SITE', undefined);
    expect(result.entityResults).toHaveLength(1);
    expect(result.entityResults[0].href).toBe('/smestaj/hotel-jadran');
  });

  it('B2C_SITE prijavljen gost: pretražuje sopstvene rezervacije preko user-scoped BookingsService.findAll', async () => {
    const { service, bookings } = makeService();
    bookings.findAll.mockResolvedValue([{ id: 'b1', bookingNumber: 'TT-2027-000777', buyerName: 'Ana' }]);
    const result = await service.search({ query: 'TT-2027-000777', channel: 'B2C_SITE', actorUserId: 'gost-1' });
    expect(bookings.findAll).toHaveBeenCalledWith({}, { userId: 'gost-1' });
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
    (helpAssistant.ask as jest.Mock).mockResolvedValue({ answer: 'Sajt prikazuje procenat povraćaja pre potvrde otkazivanja.' });

    const result = await service.search({ query: 'kako otkazujem rezervaciju', channel: 'B2C_SITE', actorUserId: null });

    expect(helpAssistant.ask).toHaveBeenCalledWith({ question: 'kako otkazujem rezervaciju', lang: undefined }, null);
    expect(result.aiAnswer).toBe('Sajt prikazuje procenat povraćaja pre potvrde otkazivanja.');
  });

  it('B2C_SITE anoniman posetilac bez M21 odgovora (npr. confidence NONE) pada na opšti LLM fallback, ne baca grešku', async () => {
    const { service, helpAssistant } = makeService({ anthropicConfigured: false });
    (helpAssistant.ask as jest.Mock).mockResolvedValue({ answer: null });

    const result = await service.search({ query: 'kako otkazujem rezervaciju', channel: 'B2C_SITE', actorUserId: null });

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

    await service.search({ query: 'analiziraj nešto opšte', channel: 'INTERNAL_PANEL', actorUserId: 'u1' });

    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages[0].content).toBe('analiziraj nešto opšte');
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
});
