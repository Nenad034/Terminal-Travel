import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricelistCalendarService } from './pricelist-calendar.service';

/**
 * M3 spec §2.11o — kalendar cena i raspoloživosti.
 *
 * Vrednost kalendara je da se **greška vidi golim okom**, pa se testira upravo to: dan van
 * perioda, dan bez cene (vikend red koji nije unet), istekao prozor prodaje i dete kom cenovnik
 * ne nudi cenu — sve to mora izaći kao **imenovan razlog**, ne kao prazno polje ni kao pad.
 */
describe('PricelistCalendarService (M3 §2.11o)', () => {
  const UGOVOR = {
    id: 'c1',
    contractNumber: 'TT-2026-014',
    currency: 'EUR',
    supplier: { name: 'Hotel Splendid d.o.o.' },
  };

  const SEZONA = { code: '1' };

  function red(over: Record<string, any> = {}) {
    return {
      id: 'rl1',
      boardType: 'BB',
      occupancy: '2ADT',
      priceBasis: 'PER_ROOM_PER_NIGHT',
      price: 10000, // 100,00
      validWeekdays: [],
      bookingFrom: null,
      bookingTo: null,
      cribFeePerNight: null,
      status: 'ACTIVE',
      agePricing: [],
      ...over,
    };
  }

  function period(over: Record<string, any> = {}) {
    return {
      id: 'p1',
      contractId: 'c1',
      roomType: 'STD',
      status: 'ACTIVE',
      stayFrom: new Date('2027-06-01T00:00:00Z'),
      stayTo: new Date('2027-06-30T00:00:00Z'),
      arrivalWeekdays: [],
      agePolicyOverride: null,
      season: SEZONA,
      rateLines: [red()],
      ...over,
    };
  }

  function makeService(over: Record<string, any> = {}) {
    const prisma: any = {
      contract: { findUnique: jest.fn(async () => (over.contract === null ? null : UGOVOR)) },
      contractPeriod: { findMany: jest.fn(async () => over.periodi ?? [period()]) },
      product: { findFirst: jest.fn(async () => over.product ?? null) },
    };
    const capacity = {
      grid: jest.fn(async () => over.mreza ?? { from: '', to: '', rows: [] }),
    };
    const service = new PricelistCalendarService(prisma, capacity as any);
    return { service, prisma, capacity };
  }

  const UPIT = { roomType: 'STD', from: '2027-06-10', to: '2027-06-12', adults: 2 };

  describe('osnovni prikaz', () => {
    it('svaki dan raspona dobija svoj red, uključujući i poslednji', async () => {
      const { service } = makeService();
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije).toHaveLength(1);
      expect(r.kombinacije[0].dani.map((d) => d.date)).toEqual([
        '2027-06-10',
        '2027-06-11',
        '2027-06-12',
      ]);
    });

    it('cena je za JEDNU noć, ne za ceo raspon', async () => {
      const { service } = makeService();
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani.every((d) => d.cena === 10000)).toBe(true);
    });

    it('dan nosi oznaku sezone — pogrešno unet opseg se tako i vidi', async () => {
      const { service } = makeService();
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0].seasonCode).toBe('1');
    });

    it('kombinacije su one koje u cenovniku postoje, ne unapred nabrojane', async () => {
      const { service } = makeService({
        periodi: [
          period({
            rateLines: [red(), red({ id: 'rl2', boardType: 'HB', price: 13000 })],
          }),
        ],
      });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije.map((k) => k.kljuc).sort()).toEqual(['BB|2ADT', 'HB|2ADT']);
    });

    it('ugovor koji ne postoji vraća 404, ne prazan kalendar', async () => {
      const { service } = makeService({ contract: null });
      await expect(service.kalendar('c1', UPIT as any)).rejects.toThrow(NotFoundException);
    });

    it('raspon duži od kvartala se odbija — isto ograničenje kao mreža kapaciteta', async () => {
      const { service } = makeService();
      await expect(
        service.kalendar('c1', { ...UPIT, from: '2027-01-01', to: '2027-12-31' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('obrnut raspon se odbija porukom, ne praznim rezultatom', async () => {
      const { service } = makeService();
      await expect(
        service.kalendar('c1', { ...UPIT, from: '2027-06-20', to: '2027-06-10' } as any),
      ).rejects.toThrow(/pre datuma/);
    });
  });

  describe('rupe u cenovniku se imenuju, ne ćute', () => {
    it('dan van svih perioda nosi razlog VAN_PERIODA', async () => {
      const { service } = makeService({
        periodi: [
          period({
            stayFrom: new Date('2027-06-11T00:00:00Z'),
            stayTo: new Date('2027-06-30T00:00:00Z'),
          }),
        ],
      });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0]).toMatchObject({ date: '2027-06-10', razlog: 'VAN_PERIODA' });
    });

    it('dan koji nijedan cenovni red ne pokriva (vikend nije unet) nosi DAN_BEZ_CENE', async () => {
      // 2027-06-11 je petak, 12. subota. Red pokriva samo ned–čet.
      const { service } = makeService({
        periodi: [period({ rateLines: [red({ validWeekdays: [7, 1, 2, 3, 4] })] })],
      });
      const r = await service.kalendar('c1', UPIT as any);
      const dani = r.kombinacije[0].dani;
      expect(dani.find((d) => d.date === '2027-06-10')!.cena).toBe(10000); // četvrtak
      expect(dani.find((d) => d.date === '2027-06-11')!.razlog).toBe('DAN_BEZ_CENE');
      expect(dani.find((d) => d.date === '2027-06-12')!.razlog).toBe('DAN_BEZ_CENE');
    });

    it('istekao prozor prodaje se prikazuje kao zatvoren, ne kao da cene nema', async () => {
      const { service } = makeService({
        periodi: [period({ rateLines: [red({ bookingTo: new Date('2020-01-01T00:00:00Z') })] })],
      });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0].razlog).toBe('PROZOR_PRODAJE_ZATVOREN');
    });

    it('dete kom cenovnik ne nudi cenu daje NEMA_CENE_ZA_UZRAST, a ne pad celog kalendara', async () => {
      const { service } = makeService();
      const r = await service.kalendar('c1', { ...UPIT, childrenAges: [8] } as any);
      expect(r.kombinacije[0].dani[0].razlog).toBe('NEMA_CENE_ZA_UZRAST');
      expect(r.kombinacije[0].dani[0].cena).toBeNull();
    });

    it('upozorenje broji dane bez cene — zbir se vidi bez prebrojavanja po ekranu', async () => {
      const { service } = makeService({
        periodi: [period({ rateLines: [red({ validWeekdays: [7, 1, 2, 3, 4] })] })],
      });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.upozorenja[0]).toContain('2 od 3 dana');
    });

    it('cenovnik bez ijednog reda daje prazan spisak kombinacija, ne pad', async () => {
      const { service } = makeService({ periodi: [period({ rateLines: [] })] });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije).toEqual([]);
      expect(r.upozorenja).toEqual([]);
    });
  });

  describe('turnusi i osnova cene', () => {
    it('dan koji nije dan prijave nosi dolazakMoguc=false, a cenu i dalje prikazuje', async () => {
      // 2027-06-12 je subota; period dozvoljava prijavu samo subotom.
      const { service } = makeService({ periodi: [period({ arrivalWeekdays: [6] })] });
      const r = await service.kalendar('c1', UPIT as any);
      const dani = r.kombinacije[0].dani;
      expect(dani.find((d) => d.date === '2027-06-10')!.dolazakMoguc).toBe(false);
      expect(dani.find((d) => d.date === '2027-06-10')!.cena).toBe(10000);
      expect(dani.find((d) => d.date === '2027-06-12')!.dolazakMoguc).toBe(true);
    });

    it('cena za ceo boravak se označava, da se ne čita kao noćna', async () => {
      const { service } = makeService({
        periodi: [period({ rateLines: [red({ priceBasis: 'PER_ROOM_PER_STAY', price: 50000 })] })],
      });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0]).toMatchObject({
        cena: 50000,
        osnova: 'PER_ROOM_PER_STAY',
        razlog: 'CENA_ZA_BORAVAK',
      });
    });
  });

  describe('raspoloživost dolazi iz mreže kapaciteta, ne računa se ponovo', () => {
    const mreza = {
      from: '2027-06-10',
      to: '2027-06-12',
      rows: [
        {
          days: [
            {
              date: '2027-06-10',
              capacity: 10,
              zaProdaju: 8,
              saleStatus: 'OPEN',
              stopReason: null,
            },
            {
              date: '2027-06-11',
              capacity: 10,
              zaProdaju: 0,
              saleStatus: 'STOP',
              stopReason: 'Hotel je zatvorio prodaju',
            },
            {
              date: '2027-06-12',
              capacity: null,
              zaProdaju: 0,
              saleStatus: 'OPEN',
              stopReason: null,
            },
          ],
        },
      ],
    };

    it('slobodne jedinice i stop-sale se prenose na dan', async () => {
      const { service } = makeService({ mreza });
      const r = await service.kalendar('c1', UPIT as any);
      const dani = r.kombinacije[0].dani;
      expect(dani[0]).toMatchObject({ slobodno: 8, saleStatus: 'OPEN' });
      expect(dani[1]).toMatchObject({
        slobodno: 0,
        saleStatus: 'STOP',
        stopReason: 'Hotel je zatvorio prodaju',
      });
    });

    it('dan koji period ne pokriva (capacity null) ostaje bez broja, ne dobija nulu', async () => {
      const { service } = makeService({ mreza });
      expect(
        (await service.kalendar('c1', UPIT as any)).kombinacije[0].dani[2].slobodno,
      ).toBeNull();
    });

    it('dva perioda istog tipa sobe na isti dan se SABIRAJU', async () => {
      const dvaReda = {
        from: '2027-06-10',
        to: '2027-06-10',
        rows: [
          {
            days: [
              {
                date: '2027-06-10',
                capacity: 5,
                zaProdaju: 3,
                saleStatus: 'OPEN',
                stopReason: null,
              },
            ],
          },
          {
            days: [
              {
                date: '2027-06-10',
                capacity: 4,
                zaProdaju: 4,
                saleStatus: 'OPEN',
                stopReason: null,
              },
            ],
          },
        ],
      };
      const { service } = makeService({ mreza: dvaReda });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0].slobodno).toBe(7);
    });

    it('stop-sale u bilo kom periodu tog dana pobeđuje otvorenu prodaju u drugom', async () => {
      const dvaReda = {
        from: '2027-06-10',
        to: '2027-06-10',
        rows: [
          {
            days: [
              {
                date: '2027-06-10',
                capacity: 5,
                zaProdaju: 3,
                saleStatus: 'OPEN',
                stopReason: null,
              },
            ],
          },
          {
            days: [
              {
                date: '2027-06-10',
                capacity: 4,
                zaProdaju: 0,
                saleStatus: 'STOP',
                stopReason: 'Renoviranje',
              },
            ],
          },
        ],
      };
      const { service } = makeService({ mreza: dvaReda });
      const r = await service.kalendar('c1', UPIT as any);
      expect(r.kombinacije[0].dani[0].saleStatus).toBe('STOP');
    });
  });
});
