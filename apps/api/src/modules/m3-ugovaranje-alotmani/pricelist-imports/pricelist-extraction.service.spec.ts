import { BadRequestException } from '@nestjs/common';
import { AgeCategory } from '@prisma/client';
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
  function makeService(opts: { configured?: boolean; rows?: unknown[]; baci?: Error } = {}) {
    const uvoz = {
      id: 'imp1',
      supplierId: 's1',
      sourceText: 'Hotel Splendid, DBL, BB, 01.07.-10.07.2027, 89,50 EUR',
      status: 'PROCESSING',
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
        content: [{ type: 'tool_use', input: { rows: opts.rows ?? [] } }],
        usage: { input_tokens: 10, output_tokens: 20 },
      };
    });
    const anthropic = {
      isConfigured: () => opts.configured !== false,
      getClient: () => ({ messages: { create } }),
    };
    const invocationLog = { record: jest.fn() };
    const service = new PricelistExtractionService(
      prisma as any,
      auditLog as any,
      anthropic as any,
      invocationLog as any,
    );
    return { service, prisma, auditLog, create, uvoz };
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

    const poruka = create.mock.calls[0][0].messages[0].content as string;
    expect(poruka).toContain('PER_PERSON_PER_NIGHT');
    expect(poruka).toContain('SAMO ako dokument ne kaže drugačije');
  });

  it('uzrasne kategorije u šemi alata TAČNO odgovaraju Prisma enumu', async () => {
    const { service, create } = makeService({ rows: [validanRed] });

    await service.extract('imp1', 'u1');

    const alat = create.mock.calls[0][0].tools[0];
    const kategorije =
      alat.input_schema.properties.rows.items.properties.age_pricing.items.properties.age_category
        .enum;
    // Prva verzija je ovde ukucala 'BABY', a enum ima 'INFANT' — poziv je prolazio kroz šemu i
    // padao tek pri upisu u bazu, sa porukom koju korisnik ne može da razume (9.9.2026).
    expect([...kategorije].sort()).toEqual([...Object.values(AgeCategory)].sort());
    expect(kategorije).not.toContain('BABY');
  });

  it('model odgovara kroz alat sa zadatom šemom, ne slobodnim tekstom', async () => {
    const { service, create } = makeService({ rows: [validanRed] });

    await service.extract('imp1', 'u1');

    const poziv = create.mock.calls[0][0];
    expect(poziv.tool_choice).toEqual({ type: 'tool', name: 'upisi_redove_cenovnika' });
    expect(poziv.tools).toHaveLength(1);
  });
});
