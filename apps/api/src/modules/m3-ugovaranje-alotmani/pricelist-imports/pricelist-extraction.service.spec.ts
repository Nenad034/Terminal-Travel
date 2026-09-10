import { BadRequestException } from '@nestjs/common';
import { AgeCategory } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PricelistExtractionService } from './pricelist-extraction.service';

/**
 * M3 spec §4.2.6 — AI uvoz cenovnika.
 *
 * Težište nije na tome da poziv modelu „radi", nego na tri stvari koje tiho prave štetu:
 *  1. uvoz koji ne uspe NE SME da ostane u `PROCESSING` (ekran bi večno čekao);
 *  2. red sa besmislenom cenom ili datumom ne sme ni da stigne do čoveka — izgleda kao podatak;
 *  3. ovaj servis ne sme da upiše NIJEDAN `ContractPeriod`/`RateLine` (§4.2.4 — to je ljudska
 *     potvrda, ne AI korak).
 */
describe('PricelistExtractionService (M3 §4.2.6)', () => {
  function makeService(
    opts: {
      configured?: boolean;
      rows?: any[];
      kombinacije?: unknown[];
      stopReason?: string;
      baci?: Error;
      uvozOverride?: Record<string, unknown>;
      izvucenTekst?: string;
      parserBaca?: Error;
    } = {},
  ) {
    const uvoz = {
      id: 'imp1',
      supplierId: 's1',
      sourceText: 'Hotel Splendid, DBL, BB, 01.07.-10.07.2027, 89,50 EUR',
      sourceFileUrl: null as string | null,
      sourceFileName: null as string | null,
      sourceFormat: 'PASTED_TEXT',
      status: 'PROCESSING',
      ...(opts.uvozOverride ?? {}),
    };
    const prisma = {
      pricelistImport: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(uvoz),
        update: jest.fn().mockImplementation(({ data }: any) => ({ ...uvoz, ...data })),
      },
      pricelistImportRow: { create: jest.fn() },
      supplierExtractionProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      aIAgent: { findFirst: jest.fn().mockResolvedValue(null) },
      contractPeriod: { create: jest.fn() },
      rateLine: { create: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const create = jest.fn().mockImplementation(async () => {
      if (opts.baci) throw opts.baci;
      return {
        // §4.2.8 — model od v1.37 vraća KOMBINACIJE, ne redove. Testovi i dalje opisuju ulaz
        // kao ravan red (tako se čita), a ovde se pretvara u ono što model stvarno vraća — pa
        // svaki postojeći test usput dokazuje i da ih `raspakujKombinacije` vraća u isti oblik.
        content: [
          {
            type: 'tool_use',
            input: {
              kombinacije:
                opts.kombinacije ??
                (opts.rows ?? []).map((r: any) => ({
                  ...r,
                  periodi: [{ od: r.stay_from, do: r.stay_to, cena: r.price_minor_units }],
                })),
            },
          },
        ],
        stop_reason: opts.stopReason ?? 'tool_use',
        usage: { input_tokens: 10, output_tokens: 20 },
      };
    });
    const anthropic = {
      isConfigured: () => opts.configured !== false,
      getClient: () => ({ messages: { create } }),
    };
    const invocationLog = { record: jest.fn() };
    const config = { get: jest.fn().mockReturnValue(join(tmpdir(), 'tt-test-cenovnici')) };
    const extractText = jest.fn().mockImplementation(async () => {
      if (opts.parserBaca) throw opts.parserBaca;
      return { text: opts.izvucenTekst ?? '' };
    });
    const extractFile = { extractText };
    const service = new PricelistExtractionService(
      prisma as any,
      auditLog as any,
      anthropic as any,
      invocationLog as any,
      config as any,
      extractFile as any,
    );
    return { service, prisma, auditLog, create, uvoz, extractText, invocationLog };
  }

  const validanRed = {
    hotel: 'Hotel Splendid',
    room_type: 'DBL',
    board_type: 'BB',
    occupancy: 'odrasla osoba u dvokrevetnoj',
    stay_from: '2027-07-01',
    stay_to: '2027-07-10',
    price_minor_units: 8950,
    currency: 'EUR',
  };

  it('uspešna ekstrakcija upisuje redove i prelazi u READY_FOR_REVIEW', async () => {
    const { service, prisma, auditLog } = makeService({ rows: [validanRed] });

    const rez: any = await service.extract('imp1', 'u1');

    expect(prisma.pricelistImportRow.create).toHaveBeenCalledTimes(1);
    expect(rez.status).toBe('READY_FOR_REVIEW');
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pricelist_import.extracted', actorType: 'AI_AGENT' }),
    );
  });

  it('NIKAD ne upisuje ContractPeriod ni RateLine — to je ljudska potvrda (§4.2.4)', async () => {
    const { service, prisma } = makeService({ rows: [validanRed] });

    await service.extract('imp1', 'u1');

    expect(prisma.contractPeriod.create).not.toHaveBeenCalled();
    expect(prisma.rateLine.create).not.toHaveBeenCalled();
  });

  it('odbacuje red sa nepozitivnom ili decimalnom cenom pre nego što stigne do čoveka', async () => {
    const { service, prisma } = makeService({
      rows: [
        { ...validanRed, price_minor_units: 0 },
        { ...validanRed, price_minor_units: 89.5 },
        { ...validanRed, price_minor_units: -100 },
      ],
    });

    const rez: any = await service.extract('imp1', 'u1');

    expect(prisma.pricelistImportRow.create).not.toHaveBeenCalled();
    expect(rez.status).toBe('FAILED');
    expect(rez.failureReason).toContain('nijedan nije prošao proveru');
  });

  it('odbacuje red čiji je kraj perioda pre početka', async () => {
    const { service, prisma } = makeService({
      rows: [{ ...validanRed, stay_from: '2027-07-10', stay_to: '2027-07-01' }],
    });

    await service.extract('imp1', 'u1');

    expect(prisma.pricelistImportRow.create).not.toHaveBeenCalled();
  });

  it('zadržava ispravne redove i odbacuje samo neispravne', async () => {
    const { service, prisma } = makeService({
      rows: [validanRed, { ...validanRed, price_minor_units: 0 }],
    });

    const rez: any = await service.extract('imp1', 'u1');

    expect(prisma.pricelistImportRow.create).toHaveBeenCalledTimes(1);
    expect(rez.odbaceno).toBe(1);
  });

  it('kad model ne vrati nijedan red, uvoz ide u FAILED sa razumljivim razlogom', async () => {
    const { service, prisma } = makeService({ rows: [] });

    const rez: any = await service.extract('imp1', 'u1');

    expect(rez.status).toBe('FAILED');
    expect(rez.failureReason).toContain('nije prepoznao nijedan red');
    // Ključno: NE ostaje u PROCESSING — to je stanje u kom ekran čeka nešto što se neće desiti.
    expect(prisma.pricelistImport.update).toHaveBeenCalled();
  });

  it('greška u pozivu modela ne ruši zahtev nego završava u FAILED sa porukom', async () => {
    const { service } = makeService({ baci: new Error('mreža pukla') });

    const rez: any = await service.extract('imp1', 'u1');

    expect(rez.status).toBe('FAILED');
    expect(rez.failureReason).toContain('mreža pukla');
  });

  it('bez podešenog API ključa uvoz ide u FAILED, ne u tišinu', async () => {
    const { service } = makeService({ configured: false });

    const rez: any = await service.extract('imp1', 'u1');

    expect(rez.status).toBe('FAILED');
    expect(rez.failureReason).toContain('ANTHROPIC_API_KEY');
  });

  it('odbija ponovnu ekstrakciju nad uvozom koji više nije u PROCESSING', async () => {
    const { service, prisma } = makeService();
    prisma.pricelistImport.findUniqueOrThrow.mockResolvedValue({
      id: 'imp1',
      supplierId: 's1',
      sourceText: 'x',
      status: 'READY_FOR_REVIEW',
    });

    await expect(service.extract('imp1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('profil dobavljača ide modelu kao NAGOVEŠTAJ, ne kao naredba', async () => {
    const { service, prisma, create } = makeService({ rows: [validanRed] });
    prisma.supplierExtractionProfile.findUnique.mockResolvedValue({
      typicalPriceBasis: 'PER_PERSON_PER_NIGHT',
    });

    await service.extract('imp1', 'u1');

    // §4.2.7 — sadržaj je od v1.36 niz blokova, ne string: fajl može biti dokument ili slika.
    // Nagoveštaj je zaseban tekstualni blok NA KRAJU, posle sadržaja cenovnika.
    const blokovi = create.mock.calls[0][0].messages[0].content as { type: string; text: string }[];
    const poruka = blokovi.map((b) => b.text ?? '').join(' ');
    expect(poruka).toContain('PER_PERSON_PER_NIGHT');
    expect(poruka).toContain('SAMO ako dokument ne kaže drugačije');
  });

  it('uzrasne kategorije u šemi alata TAČNO odgovaraju Prisma enumu', async () => {
    const { service, create } = makeService({ rows: [validanRed] });

    await service.extract('imp1', 'u1');

    const alat = create.mock.calls[0][0].tools[0];
    const kategorije =
      alat.input_schema.properties.kombinacije.items.properties.age_pricing.items.properties
        .age_category.enum;
    // Prva verzija je ovde ukucala 'BABY', a enum ima 'INFANT' — poziv je prolazio kroz šemu i
    // padao tek pri upisu u bazu, sa porukom koju korisnik ne može da razume (9.9.2026).
    expect([...kategorije].sort()).toEqual([...Object.values(AgeCategory)].sort());
    expect(kategorije).not.toContain('BABY');
  });

  it('model odgovara kroz alat sa zadatom šemom, ne slobodnim tekstom', async () => {
    const { service, create } = makeService({ rows: [validanRed] });

    await service.extract('imp1', 'u1');

    const poziv = create.mock.calls[0][0];
    expect(poziv.tool_choice).toEqual({ type: 'tool', name: 'upisi_kombinacije_cenovnika' });
    expect(poziv.tools).toHaveLength(1);
  });
  /**
   * §4.2.7 (v1.36) — uvoz fajla. Težište je na tome KO čita sadržaj i da se ta odluka
   * zapiše: parser je besplatan i deterministički, model se plaća. Uvoz koji tiho ode na
   * model umesto na parser je razlika između centa i nekoliko centi po dokumentu, i bez
   * `extraction_path` se posle ne može utvrditi zašto je jedan uvoz bio skuplji od drugog.
   */
  describe('uvoz fajla (§4.2.7)', () => {
    const FOLDER = join(tmpdir(), 'tt-test-cenovnici');
    const DOVOLJNO_TEKSTA = 'Hotel Splendid DBL BB 01.07.-10.07.2027 89,50 EUR. '.repeat(6);

    beforeAll(() => {
      mkdirSync(FOLDER, { recursive: true });
      writeFileSync(join(FOLDER, 'cenovnik.pdf'), 'nebitan bajtni sadrzaj');
      writeFileSync(join(FOLDER, 'cenovnik.xlsx'), 'nebitan bajtni sadrzaj');
      writeFileSync(join(FOLDER, 'cenovnik.jpg'), 'nebitan bajtni sadrzaj');
    });

    function fajlUvoz(ime: string, format: string) {
      return {
        sourceText: null,
        sourceFileUrl: ime,
        sourceFileName: ime,
        sourceFormat: format,
      };
    }

    it('PDF iz kog parser izvuče tekst ide PARSER putem — model dobija tekst, ne dokument', async () => {
      const { service, prisma, create, extractText } = makeService({
        rows: [validanRed],
        uvozOverride: fajlUvoz('cenovnik.pdf', 'PDF'),
        izvucenTekst: DOVOLJNO_TEKSTA,
      });

      await service.extract('imp1', 'u1');

      expect(extractText).toHaveBeenCalledTimes(1);
      expect(prisma.pricelistImport.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { extractionPath: 'PARSER' } }),
      );
      const sadrzaj = create.mock.calls[0][0].messages[0].content;
      expect(sadrzaj.map((b: any) => b.type)).toEqual(['text']);
    });

    /**
     * Skeniran PDF ne baca grešku — `pdf-parse` iz njega vrati PRAZAN tekst, jer u njemu nema
     * teksta nego slike strana. Bez ovog testa bi se takav uvoz završio kao „AI nije prepoznao
     * nijedan red", što je tačan simptom i pogrešan uzrok.
     */
    it('skeniran PDF (parser vrati prazno) ide MODEL putem, kao document blok', async () => {
      const { service, prisma, create } = makeService({
        rows: [validanRed],
        uvozOverride: fajlUvoz('cenovnik.pdf', 'PDF'),
        izvucenTekst: '',
      });

      await service.extract('imp1', 'u1');

      expect(prisma.pricelistImport.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { extractionPath: 'MODEL' } }),
      );
      const sadrzaj = create.mock.calls[0][0].messages[0].content;
      expect(sadrzaj[0].type).toBe('document');
      expect(sadrzaj[0].source.media_type).toBe('application/pdf');
    });

    it('slika ide modelu odmah — parser se ni ne poziva', async () => {
      const { service, create, extractText } = makeService({
        rows: [validanRed],
        uvozOverride: fajlUvoz('cenovnik.jpg', 'IMAGE'),
      });

      await service.extract('imp1', 'u1');

      expect(extractText).not.toHaveBeenCalled();
      const sadrzaj = create.mock.calls[0][0].messages[0].content;
      expect(sadrzaj[0].type).toBe('image');
      expect(sadrzaj[0].source.media_type).toBe('image/jpeg');
    });

    /**
     * Excel iz kog ne izađe tekst NEMA rezervni put — model ne čita .xlsx. Uvoz mora da padne
     * u `FAILED` sa razlogom, ne da tiho ode modelu koji bi vratio prazno.
     */
    it('Excel bez upotrebljivog teksta pada u FAILED sa razlogom, ne ide modelu', async () => {
      const { service, create } = makeService({
        uvozOverride: fajlUvoz('cenovnik.xlsx', 'EXCEL'),
        izvucenTekst: 'prazno',
      });

      const rez: any = await service.extract('imp1', 'u1');

      expect(rez.status).toBe('FAILED');
      expect(rez.failureReason).toContain('upotrebljiv tekst');
      expect(create).not.toHaveBeenCalled();
    });

    it('uvoz cenovnika ide na HEAVY model i tako se knjiži (§4.2.7)', async () => {
      const { service, create } = makeService({ rows: [validanRed] });

      await service.extract('imp1', 'u1');

      expect(create.mock.calls[0][0].model).toBe('claude-opus-5');
    });

    it('nalepljen tekst ne dobija extraction_path — pitanje „ko je čitao" tu nema smisla', async () => {
      const { service, prisma } = makeService({ rows: [validanRed] });

      await service.extract('imp1', 'u1');

      const upisi = prisma.pricelistImport.update.mock.calls.map((c: any) => c[0].data);
      expect(upisi.some((d: any) => 'extractionPath' in d)).toBe(false);
    });
  });
  /**
   * §4.2.8 (v1.37) — model opisuje kombinaciju jednom, kod je umnožava po periodima.
   *
   * Ovo je jedini deo posla koji je prebačen sa modela na kod, i vredi zaključati testom
   * upravo zato što je nevidljiv spolja: `PricelistImportRow` izgleda isto kao pre.
   */
  describe('grupisana šema (§4.2.8)', () => {
    const kombinacija = {
      hotel: 'Hotel Splendid',
      room_type: 'DBL',
      board_type: 'BB',
      occupancy: 'odrasla osoba u dvokrevetnoj',
      currency: 'EUR',
      price_basis: 'PER_ROOM_PER_NIGHT',
      crib_fee_per_night: 500,
      age_pricing: [
        { age_category: 'CHILD', pricing_mode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 },
      ],
      periodi: [
        { od: '2027-06-01', do: '2027-06-30', cena: 8950 },
        { od: '2027-07-01', do: '2027-07-31', cena: 12500 },
        { od: '2027-08-01', do: '2027-08-31', cena: 14000 },
      ],
    };

    it('jedna kombinacija sa tri perioda daje TRI reda, sa ponovljenim opisom na svakom', async () => {
      const { service, prisma } = makeService({ kombinacije: [kombinacija] });

      await service.extract('imp1', 'u1');

      expect(prisma.pricelistImportRow.create).toHaveBeenCalledTimes(3);
      const upisani = prisma.pricelistImportRow.create.mock.calls.map((c: any) => c[0].data);
      expect(upisani.map((r: any) => r.extractedPrice)).toEqual([8950, 12500, 14000]);
      // Opis se ne gubi pri raspakivanju — model ga je napisao jednom, kod ga nosi na svaki red.
      expect(upisani.every((r: any) => r.extractedRoomType === 'DBL')).toBe(true);
      expect(upisani.every((r: any) => r.extractedCribFeePerNight === 500)).toBe(true);
      expect(upisani.every((r: any) => r.extractedPriceBasis === 'PER_ROOM_PER_NIGHT')).toBe(true);
      expect(upisani.every((r: any) => r.extractedAgePricing)).toBe(true);
    });

    it('kombinacija bez ijednog perioda ne daje nijedan red — bez datuma nema cenovne stavke', async () => {
      const { service, prisma } = makeService({
        kombinacije: [{ ...kombinacija, periodi: [] }],
      });

      const rez: any = await service.extract('imp1', 'u1');

      expect(prisma.pricelistImportRow.create).not.toHaveBeenCalled();
      expect(rez.status).toBe('FAILED');
    });

    /**
     * Izmereno 10.9.2026 nad `Primeri cenovnika/Bellevue Rates 2025_hr.pdf`: stara šema je
     * potrošila ceo `max_tokens` na prepisivanje istih naziva, bila prekinuta na pola
     * nedovršenog poziva alata, i uvoz je padao sa porukom „AI nije prepoznao nijedan red" —
     * tačan simptom, pogrešan uzrok. Naplaćeno 0,40 €, dobijeno ništa.
     */
    it('odgovor prekinut zbog dužine se prijavljuje kao prekid, ne kao „nijedan red"', async () => {
      const { service } = makeService({ kombinacije: [], stopReason: 'max_tokens' });

      const rez: any = await service.extract('imp1', 'u1');

      expect(rez.status).toBe('FAILED');
      expect(rez.failureReason).toContain('prekinut zbog dužine');
      expect(rez.failureReason).toContain('Podeli dokument');
      expect(rez.failureReason).not.toContain('nije prepoznao');
    });

    it('šema sama sprovodi pravilo — traži niz periodâ, ne zaseban zapis po periodu', async () => {
      const { service, create } = makeService({ kombinacije: [kombinacija] });

      await service.extract('imp1', 'u1');

      const alat = create.mock.calls[0][0].tools[0];
      const stavka = alat.input_schema.properties.kombinacije.items;
      expect(stavka.properties.periodi.type).toBe('array');
      expect(stavka.required).toContain('periodi');
      // Datum i cena postoje SAMO unutar perioda — model ih ne može staviti na kombinaciju.
      expect(stavka.properties.stay_from).toBeUndefined();
      expect(stavka.properties.price_minor_units).toBeUndefined();
    });
  });
});
