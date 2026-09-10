import { BadRequestException } from '@nestjs/common';
import { PricelistImportsService } from './pricelist-imports.service';
import { normalizujPopunjenost } from './pricelist-storage';

/**
 * M3 spec §4.2 / §4.2.10 — AI uvoz cenovnika.
 *
 * **Ovaj fajl je prepisan 10.9.2026** kad je potvrda reda po red uklonjena (vlasnikova odluka):
 * uvoz od sada gradi PREDLOG i ide kroz isti tok verzija kao ručna izmena i izmena rečima.
 * Testovi zato više ne mere upis `ContractPeriod`/`RateLine` — to radi `PricelistVersionsService`
 * i pokriveno je tamo — nego ono što je novo i lako se tiho pokvari:
 *
 *  1. grupisanje po ugovoru (jedan dokument ume da nosi više hotela);
 *  2. izvođenje sezone iz datuma, sa TAČNIM poklapanjem;
 *  3. da dečja cena i krevetac prežive prelazak u predlog — jer bi njihov gubitak bio nevidljiv;
 *  4. da red bez poklopljenog proizvoda ne nestane tiho.
 */
describe('PricelistImportsService (M3 §4.2 / §4.2.10)', () => {
  const RED = {
    id: 'row-1',
    pricelistImportId: 'imp-1',
    matchedProductId: 'prod-1',
    matchConfidence: 92,
    extractedHotelName: 'Hotel Splendid',
    extractedRoomType: 'DBL',
    extractedBoardType: 'BB',
    extractedOccupancy: '2ADT',
    extractedStayFrom: new Date('2027-06-01T00:00:00Z'),
    extractedStayTo: new Date('2027-06-30T00:00:00Z'),
    extractedPrice: 8950,
    extractedCurrency: 'EUR',
    extractedPriceBasis: 'PER_ROOM_PER_NIGHT',
    extractedCribFeePerNight: 500,
    extractedAgePricing: [
      { age_category: 'CHILD', pricing_mode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 },
    ],
    reviewStatus: 'PENDING',
  };

  function makeService(opts: { redovi?: any[]; sezone?: any[]; proizvodi?: any[] } = {}) {
    const prisma = {
      pricelistImport: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'imp-1', status: 'READY_FOR_REVIEW' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      pricelistImportRow: {
        findMany: jest.fn().mockResolvedValue(opts.redovi ?? [RED]),
        findUnique: jest.fn().mockResolvedValue({ ...RED, import: { supplierId: 's1' } }),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue(opts.proizvodi ?? [{ id: 'prod-1', sourceContractId: 'ug-1' }]),
      },
      contract: {
        findUnique: jest.fn().mockResolvedValue({
          contractNumber: 'UG-2027-1',
          supplier: { name: 'Splendid d.o.o.' },
        }),
      },
      season: { findMany: jest.fn().mockResolvedValue(opts.sezone ?? []) },
      supplierExtractionProfile: { upsert: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const versions = {
      predlozi: jest.fn().mockResolvedValue({ razlike: [], ukupno: 0, sviKljucevi: [] }),
      primeni: jest.fn().mockResolvedValue({ versionNo: 2 }),
    };
    const pricelist = { createSeason: jest.fn() };
    const service = new PricelistImportsService(
      prisma as any,
      auditLog as any,
      versions as any,
      pricelist as any,
    );
    return { service, prisma, auditLog, versions, pricelist };
  }

  describe('razlike — uvoz kao predlog (§4.2.10)', () => {
    it('grupiše redove po ugovoru i ne upisuje ništa', async () => {
      const { service, versions, prisma } = makeService();

      const rez = await service.razlike('imp-1');

      expect(versions.predlozi).toHaveBeenCalledTimes(1);
      expect(versions.predlozi.mock.calls[0][0]).toBe('ug-1');
      expect(rez.ugovori[0].contractNumber).toBe('UG-2027-1');
      // Predlog ne sme ništa da upiše (§2.11l, pravilo 2).
      expect(prisma.pricelistImportRow.update).not.toHaveBeenCalled();
      expect(prisma.pricelistImportRow.updateMany).not.toHaveBeenCalled();
    });

    it('dva hotela iz različitih ugovora daju DVA predloga, ne jedan', async () => {
      const { service, versions } = makeService({
        redovi: [RED, { ...RED, id: 'row-2', matchedProductId: 'prod-2' }],
        proizvodi: [
          { id: 'prod-1', sourceContractId: 'ug-1' },
          { id: 'prod-2', sourceContractId: 'ug-2' },
        ],
      });

      const rez = await service.razlike('imp-1');

      expect(rez.ugovori).toHaveLength(2);
      expect(versions.predlozi).toHaveBeenCalledTimes(2);
    });

    /**
     * Poklapanje je namerno TAČNO: 01.06–15.06 nije ista sezona kao 01.06–30.06. Tiho svrstavanje
     * u postojeću kolonu promenilo bi cenu za petnaest dana koje niko nije potvrdio (§4.2.10).
     */
    it('opseg koji se TAČNO poklapa sa postojećom sezonom koristi njenu oznaku', async () => {
      const { service, versions } = makeService({
        sezone: [
          {
            code: 'A',
            ranges: [
              {
                dateFrom: new Date('2027-06-01T00:00:00Z'),
                dateTo: new Date('2027-06-30T00:00:00Z'),
              },
            ],
          },
        ],
      });

      await service.razlike('imp-1');

      expect(versions.predlozi.mock.calls[0][1].redovi[0].seasonCode).toBe('A');
    });

    it('opseg koji se samo PREKLAPA sa postojećom sezonom dobija novu, ne njenu', async () => {
      const { service, versions } = makeService({
        sezone: [
          {
            code: 'A',
            ranges: [
              {
                dateFrom: new Date('2027-06-01T00:00:00Z'),
                dateTo: new Date('2027-06-15T00:00:00Z'),
              },
            ],
          },
        ],
      });

      const rez = await service.razlike('imp-1');

      expect(versions.predlozi.mock.calls[0][1].redovi[0].seasonCode).not.toBe('A');
      expect(rez.ugovori[0].noveSezone).toHaveLength(1);
      expect(rez.ugovori[0].noveSezone[0].label).toBe('01.06.2027.–30.06.2027.');
    });

    it('dva reda sa istim opsegom dele jednu novu sezonu, ne dve', async () => {
      const { service, versions } = makeService({
        redovi: [RED, { ...RED, id: 'row-2', extractedBoardType: 'HB', extractedPrice: 10900 }],
      });

      const rez = await service.razlike('imp-1');

      expect(rez.ugovori[0].noveSezone).toHaveLength(1);
      const redovi = versions.predlozi.mock.calls[0][1].redovi;
      expect(redovi[0].seasonCode).toBe(redovi[1].seasonCode);
    });

    /**
     * Najtiši mogući gubitak: `writeCell` do v1.39 nije primao ova polja, pa bi prelazak uvoza na
     * tok verzija obrisao svaku uvezenu dečju cenu bez ijedne poruke (§4.2.10).
     */
    it('dečja cena i krevetac ulaze u predlog', async () => {
      const { service, versions } = makeService();

      await service.razlike('imp-1');

      const red = versions.predlozi.mock.calls[0][1].redovi[0];
      expect(red.cribFeePerNight).toBe(500);
      expect(red.agePricing).toEqual([
        { ageCategory: 'CHILD', pricingMode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 },
      ]);
    });

    it('red bez poklopljenog proizvoda se prikazuje zasebno, ne nestaje', async () => {
      const { service } = makeService({
        redovi: [{ ...RED, matchedProductId: null, matchConfidence: 61 }],
      });

      const rez = await service.razlike('imp-1');

      expect(rez.ugovori).toHaveLength(0);
      expect(rez.nepoklopljeni).toEqual([
        { rowId: 'row-1', hotel: 'Hotel Splendid', matchConfidence: 61 },
      ]);
    });
  });

  describe('primeni (§4.2.10)', () => {
    it('primenjuje potvrđene ključeve kroz tok verzija, sa source_import_id', async () => {
      const { service, versions } = makeService();
      const priprema = await service.razlike('imp-1');
      void priprema;
      const kljuc = 'CENA|DBL|1|BB|2adt|PER_ROOM_PER_NIGHT|svi';

      await service.primeniZaUgovor(
        'imp-1',
        'ug-1',
        { effectiveFrom: '2027-01-01', prihvaceniKljucevi: [kljuc] },
        'u1',
      );

      expect(versions.primeni).toHaveBeenCalledTimes(1);
      const [contractId, dto] = versions.primeni.mock.calls[0];
      expect(contractId).toBe('ug-1');
      expect(dto.sourceImportId).toBe('imp-1');
      expect(dto.prihvaceniKljucevi).toEqual([kljuc]);
    });

    it('nova sezona nastaje TEK pri primeni, i samo ako je njena razlika potvrđena', async () => {
      const { service, pricelist } = makeService();

      await service.primeniZaUgovor(
        'imp-1',
        'ug-1',
        {
          effectiveFrom: '2027-01-01',
          prihvaceniKljucevi: ['CENA|DBL|1|BB|2adt|PER_ROOM_PER_NIGHT|svi'],
        },
        'u1',
      );

      expect(pricelist.createSeason).toHaveBeenCalledTimes(1);
      expect(pricelist.createSeason.mock.calls[0][1]).toEqual(
        expect.objectContaining({ code: '1', label: '01.06.2027.–30.06.2027.' }),
      );
    });

    it('sezona čija razlika NIJE potvrđena se ne pravi — prazna kolona nije rezultat', async () => {
      const { service, pricelist } = makeService();

      await service.primeniZaUgovor(
        'imp-1',
        'ug-1',
        { effectiveFrom: '2027-01-01', prihvaceniKljucevi: ['CENA|NEPOSTOJI|9|BB|2adt|X|svi'] },
        'u1',
      );

      expect(pricelist.createSeason).not.toHaveBeenCalled();
    });

    it('primenjen red dobija CONFIRMED; nepotvrđeni ostaju PENDING', async () => {
      const { service, prisma } = makeService({
        redovi: [RED, { ...RED, id: 'row-2', extractedBoardType: 'HB', extractedPrice: 10900 }],
      });

      await service.primeniZaUgovor(
        'imp-1',
        'ug-1',
        {
          effectiveFrom: '2027-01-01',
          prihvaceniKljucevi: ['CENA|DBL|1|BB|2adt|PER_ROOM_PER_NIGHT|svi'],
        },
        'u1',
      );

      const poziv = prisma.pricelistImportRow.updateMany.mock.calls[0][0];
      expect(poziv.where.id.in).toEqual(['row-1']);
      expect(poziv.data.reviewStatus).toBe('CONFIRMED');
    });

    it('bez ijedne potvrđene razlike primena se odbija', async () => {
      const { service } = makeService();

      await expect(
        service.primeniZaUgovor(
          'imp-1',
          'ug-1',
          { effectiveFrom: '2027-01-01', prihvaceniKljucevi: [] },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ugovor koji nema nijedan red u ovom uvozu se odbija sa jasnom porukom', async () => {
      const { service } = makeService();

      await expect(
        service.primeniZaUgovor(
          'imp-1',
          'ug-drugi',
          { effectiveFrom: '2027-01-01', prihvaceniKljucevi: ['x'] },
          'u1',
        ),
      ).rejects.toThrow(/nema nijedan red/);
    });
  });

  describe('odbijRed (§4.2.10)', () => {
    it('odbijanje reda ostaje — to je izbacivanje iz predloga, ne drugi put do cenovnika', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        ...RED,
        import: { id: 'imp-1' },
      });
      prisma.pricelistImportRow.update.mockResolvedValue({ ...RED, reviewStatus: 'REJECTED' });

      const rez = await service.odbijRed('imp-1', 'row-1', 'u1');

      expect(rez.reviewStatus).toBe('REJECTED');
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'pricelist_import_row.rejected' }),
      );
    });

    it('red iz drugog uvoza se odbija', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        ...RED,
        import: { id: 'drugi' },
      });

      await expect(service.odbijRed('imp-1', 'row-1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create (§4.2.1)', () => {
    it('kreira uvoz u statusu PROCESSING — ekstrakcija je zaseban korak', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.pricelistImport.create.mockResolvedValue({ id: 'imp-1', status: 'PROCESSING' });

      const result = await service.create(
        { supplierId: 's1', sourceFileUrl: 'cenovnik.pdf', sourceFormat: 'PDF' as any },
        'actor-1',
      );

      expect(prisma.pricelistImport.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING' }) }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'pricelist_import.created' }),
      );
      expect(result.status).toBe('PROCESSING');
    });
  });
  /**
   * §4.2.10 — popunjenost mora biti PONOVLJIVA, jer ulazi u ključ stavke.
   *
   * Izmereno nad istim dokumentom u tri prolaza: model je vratio „po sobi", „soba (DBL standard)"
   * i „soba". Bez svođenja bi ponovni uvoz istog cenovnika prikazao svaki red kao „nov + ugašen".
   */
  describe('normalizujPopunjenost (§4.2.10)', () => {
    it('tri formulacije iste stvari daju JEDAN ključ', () => {
      const varijante = ['po sobi', 'soba (DBL standard)', 'soba', 'Po Sobi.', 'per room'];
      const svedene = new Set(varijante.map((v) => normalizujPopunjenost(v, 'PER_ROOM_PER_NIGHT')));
      expect([...svedene]).toEqual(['po sobi']);
    });

    it('po osobi se svodi na svoj oblik, ne meša se sa sobom', () => {
      expect(normalizujPopunjenost('odrasla osoba u dvokrevetnoj', 'PER_PERSON_PER_NIGHT')).toBe(
        'po osobi',
      );
      expect(normalizujPopunjenost('per person', 'PER_PERSON_PER_NIGHT')).toBe('po osobi');
    });

    it('stvarna razlika u popunjenosti se ZADRŽAVA — ne svodi se sve na jedno', () => {
      const a = normalizujPopunjenost('1 Adult + 1 Chd 07-11,99', 'PER_PERSON_PER_NIGHT');
      const b = normalizujPopunjenost('2 Adults', 'PER_PERSON_PER_NIGHT');
      expect(a).not.toBe(b);
      expect(a).toBe('1 adult + 1 chd 07-11 99');
    });

    it('prazno polje dobija oblik iz osnove cene, ne ostaje prazno', () => {
      expect(normalizujPopunjenost('   ', 'PER_PERSON_PER_NIGHT')).toBe('po osobi');
      expect(normalizujPopunjenost('', 'PER_ROOM_PER_NIGHT')).toBe('po sobi');
      expect(normalizujPopunjenost('', null)).toBe('po sobi');
    });
  });
});
