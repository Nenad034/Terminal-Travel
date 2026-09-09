import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricelistVersionsService } from './pricelist-versions.service';

/**
 * M3 spec §2.11l — verzije cenovnika.
 *
 * Težište je na tri stvari koje se sa ekrana ne vide:
 *  1. snimak se pravi od ŽIVOG stanja, i jedna sezona sa dva datumska opsega daje JEDNU stavku
 *     u snimku (dva perioda iza jedne kolone su unutrašnja stvar, §2.11);
 *  2. primena dira **samo potvrđene** razlike — neprihvaćena izmena ne sme ni da se upiše ni da
 *     se izgubi;
 *  3. verzija bez ijedne razlike se odbija, da istorija ne postane spisak istovetnih snimaka.
 */
describe('PricelistVersionsService (M3 §2.11l)', () => {
  const UGOVOR = { id: 'c1', contractNumber: 'TT-2026-014', currency: 'EUR' };

  const SEZONA = { id: 's1', contractId: 'c1', code: '1', label: 'Predsezona', rank: 1 };

  /** Sezona 1 ima dva opsega → dva perioda za isti tip sobe, sa istom cenom. */
  function periodi(cena = 10000) {
    return [
      {
        id: 'p1',
        contractId: 'c1',
        seasonId: 's1',
        roomType: 'STD',
        status: 'ACTIVE',
        season: SEZONA,
        rateLines: [
          {
            id: 'rl1',
            boardType: 'BB',
            occupancy: '2ADT',
            priceBasis: 'PER_ROOM_PER_NIGHT',
            price: cena,
            validWeekdays: [],
            bookingFrom: null,
            bookingTo: null,
            cribFeePerNight: null,
            status: 'ACTIVE',
          },
        ],
      },
      {
        id: 'p2',
        contractId: 'c1',
        seasonId: 's1',
        roomType: 'STD',
        status: 'ACTIVE',
        season: SEZONA,
        rateLines: [
          {
            id: 'rl2',
            boardType: 'BB',
            occupancy: '2ADT',
            priceBasis: 'PER_ROOM_PER_NIGHT',
            price: cena,
            validWeekdays: [],
            bookingFrom: null,
            bookingTo: null,
            cribFeePerNight: null,
            status: 'ACTIVE',
          },
        ],
      },
    ];
  }

  function makeService(over: Record<string, any> = {}) {
    const upisaneVerzije: any[] = [];
    const upisaneCelije: any[] = [];
    const ugasene: string[] = [];
    const verzijeUBazi: any[] = over.verzije ?? [];

    const prisma: any = {
      contract: {
        findUnique: jest.fn(async () => (over.contract === null ? null : UGOVOR)),
      },
      season: {
        findFirst: jest.fn(async ({ where }: any) =>
          over.nemaSezone || where.code !== SEZONA.code ? null : SEZONA,
        ),
        findMany: jest.fn(async () => [SEZONA]),
      },
      contractPeriod: {
        findMany: jest.fn(async () => over.periodi ?? periodi()),
      },
      ancillaryService: { findMany: jest.fn(async () => over.doplate ?? []) },
      rateLine: {
        updateMany: jest.fn(async ({ where }: any) => {
          ugasene.push(...where.id.in);
          return { count: where.id.in.length };
        }),
      },
      pricelistVersion: {
        findMany: jest.fn(async () => verzijeUBazi),
        findFirst: jest.fn(async ({ where }: any) => {
          const kandidati = verzijeUBazi.filter(
            (v) => where.versionNo == null || v.versionNo === where.versionNo,
          );
          return kandidati.sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const v = { id: `v${upisaneVerzije.length + 1}`, ...data };
          upisaneVerzije.push(v);
          return v;
        }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const auditLog = { write: jest.fn(async (_z: any) => undefined) };
    const pricelist = {
      writeCell: jest.fn(async (_c: string, dto: any) => {
        upisaneCelije.push(dto);
        return { rateLineIds: ['nova'] };
      }),
    };

    const service = new PricelistVersionsService(prisma, auditLog as any, pricelist as any);
    return { service, prisma, auditLog, pricelist, upisaneVerzije, upisaneCelije, ugasene };
  }

  const PREDLOG_RED = {
    roomType: 'STD',
    seasonCode: '1',
    boardType: 'BB',
    occupancy: '2ADT',
    priceBasis: 'PER_ROOM_PER_NIGHT' as const,
    price: 11000,
  };

  describe('snimak živog stanja', () => {
    it('dva perioda iste sezone daju JEDNU stavku u snimku — kolona je jedna ćelija', async () => {
      const { service, upisaneVerzije } = makeService();
      await service.potvrdi('c1', { effectiveFrom: '2026-06-01' }, 'u1');
      expect(upisaneVerzije[0].snapshot).toHaveLength(1);
      expect(upisaneVerzije[0].snapshot[0].opis).toContain('STD');
      expect(upisaneVerzije[0].snapshot[0].vrednost).toBe(10000);
    });

    it('prva verzija nosi broj 1 i sve stavke prijavljuje kao razliku', async () => {
      const { service, upisaneVerzije } = makeService();
      const r = await service.potvrdi('c1', { effectiveFrom: '2026-06-01' }, 'u1');
      expect(r.versionNo).toBe(1);
      expect(r.changeCount).toBe(1);
      expect(upisaneVerzije[0].createdBy).toBe('u1');
    });

    it('ugovor koji ne postoji vraća 404, ne prazan snimak', async () => {
      const { service } = makeService({ contract: null });
      await expect(service.potvrdi('c1', { effectiveFrom: '2026-06-01' }, 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('potvrda ručne izmene', () => {
    it('verzija bez ijedne razlike se odbija — istorija ne sme biti spisak istih snimaka', async () => {
      const { service } = makeService({
        verzije: [
          {
            id: 'v1',
            versionNo: 1,
            effectiveFrom: new Date('2026-06-01'),
            createdAt: new Date(),
            changeCount: 1,
            note: null,
            instructionText: null,
            sourceImportId: null,
            createdBy: 'u1',
            snapshot: [
              {
                vrsta: 'CENA',
                kljuc: 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi',
                opis: 'STD · sezona 1 · BB · 2ADT',
                vrednost: 10000,
                detalji: {
                  'prodaja od': null,
                  'prodaja do': null,
                  'doplata za krevetac': null,
                },
              },
            ],
          },
        ],
      });
      await expect(service.potvrdi('c1', { effectiveFrom: '2026-07-01' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sledeća verzija dobija broj prethodne + 1', async () => {
      const { service } = makeService({
        verzije: [
          {
            id: 'v1',
            versionNo: 7,
            effectiveFrom: new Date('2026-06-01'),
            createdAt: new Date(),
            changeCount: 0,
            snapshot: [],
            note: null,
            instructionText: null,
            sourceImportId: null,
            createdBy: 'u1',
          },
        ],
      });
      const r = await service.potvrdi('c1', { effectiveFrom: '2026-07-01' }, 'u1');
      expect(r.versionNo).toBe(8);
    });

    it('rečenica kojom je izmena tražena se čuva uz verziju (§4.8)', async () => {
      const { service, upisaneVerzije } = makeService();
      await service.potvrdi(
        'c1',
        { effectiveFrom: '2026-06-01', instructionText: 'Podigni sve cene za 10%' },
        'u1',
      );
      expect(upisaneVerzije[0].instructionText).toBe('Podigni sve cene za 10%');
    });
  });

  describe('predlog spolja — ništa se ne upisuje pre potvrde', () => {
    it('predlog vraća razliku a ne dira bazu', async () => {
      const { service, upisaneCelije, upisaneVerzije, ugasene } = makeService();
      const r = await service.predlozi('c1', {
        effectiveFrom: '2026-06-01',
        redovi: [PREDLOG_RED],
      });
      expect(r.ukupno).toBe(1);
      expect(r.razlike[0].poruka).toContain('100,00 → 110,00');
      expect(upisaneCelije).toHaveLength(0);
      expect(upisaneVerzije).toHaveLength(0);
      expect(ugasene).toHaveLength(0);
    });

    it('stavka koje u predlogu nema prijavljuje se kao ugašena', async () => {
      const { service } = makeService();
      const r = await service.predlozi('c1', { effectiveFrom: '2026-06-01', redovi: [] });
      expect(r.razlike).toHaveLength(1);
      expect(r.razlike[0].vrsta).toBe('UGASENA');
    });

    it('doplata se ne prijavljuje kao ugašena samo zato što predlog nosi cene', async () => {
      const { service } = makeService({
        doplate: [
          {
            id: 'a1',
            name: 'Boravišna taksa',
            kind: 'SURCHARGE',
            season: null,
            appliesToRoomTypes: [],
            ageFrom: null,
            ageTo: null,
            flatAmount: 150,
            priceBasis: 'PER_PERSON_PER_NIGHT',
            isMandatory: true,
            payable: 'ON_SITE',
            percentageOfNightlyRate: null,
            appliesFrom: null,
            appliesTo: null,
          },
        ],
      });
      const r = await service.predlozi('c1', {
        effectiveFrom: '2026-06-01',
        redovi: [PREDLOG_RED],
      });
      expect(r.razlike.some((x) => x.stavka === 'DOPLATA')).toBe(false);
    });
  });

  describe('primena — samo potvrđene razlike', () => {
    it('potvrđena izmena se upisuje kroz mrežu, po §2.4c', async () => {
      const { service, upisaneCelije } = makeService();
      const kljuc = 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi';
      const r = await service.primeni(
        'c1',
        { effectiveFrom: '2026-06-01', redovi: [PREDLOG_RED], prihvaceniKljucevi: [kljuc] },
        'u1',
      );
      expect(upisaneCelije).toHaveLength(1);
      expect(upisaneCelije[0].price).toBe(11000);
      expect(upisaneCelije[0].seasonId).toBe('s1');
      expect(r.primenjeno).toBe(1);
    });

    it('primena bez ijedne potvrđene razlike se odbija — „primeni sve" nije podrazumevano', async () => {
      const { service } = makeService();
      await expect(
        service.primeni('c1', { effectiveFrom: '2026-06-01', redovi: [PREDLOG_RED] }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('neprihvaćena razlika se vraća u odgovoru — ne nestaje bez traga', async () => {
      const { service } = makeService();
      // Predlog nosi dve izmene, čovek potvrđuje samo jednu.
      const drugiRed = { ...PREDLOG_RED, roomType: 'APP', price: 20000 };
      const kljuc = 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi';
      const r = await service.primeni(
        'c1',
        {
          effectiveFrom: '2026-06-01',
          redovi: [PREDLOG_RED, drugiRed],
          prihvaceniKljucevi: [kljuc],
        },
        'u1',
      );
      expect(r.primenjeno).toBe(1);
      expect(r.odbijeno.some((p) => p.includes('APP'))).toBe(true);
    });

    it('potvrđeno gašenje gasi cenovne redove, ne briše ih (§2.4c)', async () => {
      const { service, ugasene } = makeService();
      const kljuc = 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi';
      await service.primeni(
        'c1',
        { effectiveFrom: '2026-06-01', redovi: [], prihvaceniKljucevi: [kljuc] },
        'u1',
      );
      expect(ugasene.sort()).toEqual(['rl1', 'rl2']);
    });

    it('ključ kog više nema u razlikama se odbija — cenovnik se u međuvremenu promenio', async () => {
      const { service } = makeService();
      await expect(
        service.primeni(
          'c1',
          {
            effectiveFrom: '2026-06-01',
            redovi: [PREDLOG_RED],
            prihvaceniKljucevi: ['CENA|NEPOSTOJI|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi'],
          },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sezona iz predloga koja ne postoji u ugovoru vraća jasnu poruku', async () => {
      const { service } = makeService({ nemaSezone: true });
      const kljuc = 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi';
      await expect(
        service.primeni(
          'c1',
          { effectiveFrom: '2026-06-01', redovi: [PREDLOG_RED], prihvaceniKljucevi: [kljuc] },
          'u1',
        ),
      ).rejects.toThrow(/Sezona/);
    });

    it('izmena rečima se u auditu vodi kao AI potez, ne kao ljudski (§4.8)', async () => {
      const { service, auditLog } = makeService();
      const kljuc = 'CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi';
      await service.primeni(
        'c1',
        {
          effectiveFrom: '2026-06-01',
          redovi: [PREDLOG_RED],
          prihvaceniKljucevi: [kljuc],
          instructionText: 'Podigni cenu studija na 110 evra',
        },
        'u1',
      );
      const zapis = (auditLog.write.mock.calls.at(-1) as any[])[0] as any;
      expect(zapis.actorType).toBe('AI_AGENT');
      expect(zapis.context.instructionText).toBe('Podigni cenu studija na 110 evra');
    });
  });

  describe('čitanje istorije', () => {
    it('verzija koja ne postoji vraća 404', async () => {
      const { service } = makeService();
      await expect(service.getVersion('c1', 3)).rejects.toThrow(NotFoundException);
    });
  });
});
