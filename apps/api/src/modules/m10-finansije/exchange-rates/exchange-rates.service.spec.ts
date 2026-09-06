import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExchangeRatesService } from './exchange-rates.service';

describe('ExchangeRatesService (M10 spec §3.1)', () => {
  function makeService() {
    const prisma: any = {
      exchangeRateSnapshot: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((o: Promise<unknown>[]) => Promise.all(o)),
    };
    const nbsFetcher: any = { fetchTodaysRates: jest.fn(), fetchRatesForDate: jest.fn() };
    const service = new ExchangeRatesService(prisma, nbsFetcher);
    return { service, prisma, nbsFetcher };
  }

  it('kreira snapshot sa source = MANUAL pri ručnom unosu', async () => {
    const { service, prisma } = makeService();
    prisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'ex-1' });

    await service.create({ currency: 'EUR', rateDate: '2026-08-12', nbsMiddleRate: 117.25 }, { userId: 'actor-1' });

    expect(prisma.exchangeRateSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ currency: 'EUR', nbsMiddleRate: 117.25, source: 'MANUAL' }),
    });
  });

  // Dodato 6.9.2026 uz ekran za kursnu listu: dupli unos je NAJVEROVATNIJA greška na tom
  // ekranu (čovek unosi kurs baš zato što misli da nedostaje), a do tada je vraćao golo
  // `500 Internal server error` — ista klasa kao zamka 13.1.
  it('dupli unos za isti dan i valutu vraća 409 sa objašnjenjem, ne 500', async () => {
    const { service, prisma } = makeService();
    prisma.exchangeRateSnapshot.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplikat', { code: 'P2002', clientVersion: '5.22.0' }),
    );

    await expect(
      service.create({ currency: 'EUR', rateDate: '2026-08-28', nbsMiddleRate: 117.37 }, { userId: 'actor-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('greška koja NIJE duplikat se propagira (ne pretvara se u 409)', async () => {
    const { service, prisma } = makeService();
    prisma.exchangeRateSnapshot.create.mockRejectedValue(new Error('baza nedostupna'));

    await expect(
      service.create({ currency: 'EUR', rateDate: '2026-08-28', nbsMiddleRate: 117.37 }, { userId: 'actor-1' }),
    ).rejects.toThrow('baza nedostupna');
  });

  it('vraća najbliži prethodni kurs kad tačan dan ne postoji', async () => {
    const { service, prisma } = makeService();
    prisma.exchangeRateSnapshot.findFirst.mockResolvedValue({ id: 'ex-2', rateDate: new Date('2026-08-10') });

    const result = await service.findForCurrencyOnOrBefore('EUR', new Date('2026-08-12'));

    expect(prisma.exchangeRateSnapshot.findFirst).toHaveBeenCalledWith({
      where: { currency: 'EUR', rateDate: { lte: new Date('2026-08-12') } },
      orderBy: { rateDate: 'desc' },
    });
    expect(result).toEqual({ id: 'ex-2', rateDate: new Date('2026-08-10') });
  });

  it('baca NotFoundException kad nema nijednog unetog kursa za valutu', async () => {
    const { service, prisma } = makeService();
    prisma.exchangeRateSnapshot.findFirst.mockResolvedValue(null);

    await expect(service.findForCurrencyOnOrBefore('EUR', new Date('2026-08-12'))).rejects.toThrow(NotFoundException);
  });

  describe('importFromNbs (§11 — dnevni automatski uvoz)', () => {
    it('upisuje svaku valutu sa NBS stranice sa source = NBS_API', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      nbsFetcher.fetchTodaysRates.mockResolvedValue({
        rateDate: new Date('2026-08-14'),
        rows: [
          { currency: 'EUR', rate: 117.3433 },
          { currency: 'USD', rate: 101.6575 },
        ],
      });
      prisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'ex-x' });

      const result = await service.importFromNbs();

      expect(prisma.exchangeRateSnapshot.create).toHaveBeenCalledWith({
        data: { currency: 'EUR', rateDate: new Date('2026-08-14'), nbsMiddleRate: 117.3433, source: 'NBS_API' },
      });
      expect(prisma.exchangeRateSnapshot.create).toHaveBeenCalledWith({
        data: { currency: 'USD', rateDate: new Date('2026-08-14'), nbsMiddleRate: 101.6575, source: 'NBS_API' },
      });
      expect(result).toEqual({ imported: ['EUR', 'USD'], skipped: [] });
    });

    it('tiho preskače valutu koja je već uvezena tog dana (idempotentno)', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      nbsFetcher.fetchTodaysRates.mockResolvedValue({
        rateDate: new Date('2026-08-14'),
        rows: [{ currency: 'EUR', rate: 117.3433 }],
      });
      const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });
      prisma.exchangeRateSnapshot.create.mockRejectedValue(duplicateError);

      const result = await service.importFromNbs();

      expect(result).toEqual({ imported: [], skipped: ['EUR'] });
    });

    it('propagira grešku koja nije duplikat (npr. baza nedostupna)', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      nbsFetcher.fetchTodaysRates.mockResolvedValue({
        rateDate: new Date('2026-08-14'),
        rows: [{ currency: 'EUR', rate: 117.3433 }],
      });
      prisma.exchangeRateSnapshot.create.mockRejectedValue(new Error('DB nedostupna'));

      await expect(service.importFromNbs()).rejects.toThrow('DB nedostupna');
    });
  });
  // --- Popunjavanje rupa u kursnoj listi (6.9.2026, M10 spec §3.1a) ---
  //
  // Greška koju ovi testovi zaključavaju nije pad nego TIŠINA: dan bez kursa nije prijavljen
  // nigde, samo se M13 sinhronizacija uplate odloži i izveštaj o naplati ostane prazan.
  describe('importFromNbsForDate / backfillMissingRates (§3.1a)', () => {
    const dan = (s: string) => new Date(`${s}T00:00:00.000Z`);

    it('upisuje kurs kad NBS vrati listu baš za traženi dan', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      nbsFetcher.fetchRatesForDate.mockResolvedValue({
        rateDate: dan('2026-08-27'),
        rows: [{ currency: 'EUR', rate: 117.3865 }],
      });
      prisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'ex-1' });

      const r = await service.importFromNbsForDate(dan('2026-08-27'));

      expect(r).toEqual({ imported: ['EUR'], skipped: [] });
      expect(prisma.exchangeRateSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ currency: 'EUR', rateDate: dan('2026-08-27'), source: 'NBS_API' }),
      });
    });

    // Ovo je jezgro: za neradni dan NBS vraća poslednju VAŽEĆU listu, ne prazan odgovor.
    // Upisati je pod traženim datumom značilo bi izmisliti kurs za dan koji ga nema.
    it('NE upisuje ništa kad NBS za traženi dan vrati listu ranijeg dana (vikend/praznik)', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      nbsFetcher.fetchRatesForDate.mockResolvedValue({
        rateDate: dan('2026-08-28'),
        rows: [{ currency: 'EUR', rate: 117.3707 }],
      });

      const r = await service.importFromNbsForDate(dan('2026-08-30'));

      expect(r).toBeNull();
      expect(prisma.exchangeRateSnapshot.create).not.toHaveBeenCalled();
    });

    it('preskače dane koji već imaju kurs — ne poziva NBS i ne prepisuje postojeće', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      prisma.exchangeRateSnapshot.findMany.mockResolvedValue([
        { rateDate: dan('2026-08-24'), currency: 'EUR' },
        { rateDate: dan('2026-08-24'), currency: 'USD' },
      ]);

      const r = await service.backfillMissingRates(dan('2026-08-24'), dan('2026-08-24'), { pauseMs: 0 });

      expect(nbsFetcher.fetchRatesForDate).not.toHaveBeenCalled();
      expect(r).toEqual({ popunjeno: 1 - 1, preskoceno: 1, neuspelo: 0 });
    });

    it('dan kome nedostaje makar JEDNA valuta se ponovo dovlači', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      // EUR postoji, USD ne — dan nije potpun, pa se mora ponoviti.
      prisma.exchangeRateSnapshot.findMany.mockResolvedValue([{ rateDate: dan('2026-08-24'), currency: 'EUR' }]);
      nbsFetcher.fetchRatesForDate.mockResolvedValue({
        rateDate: dan('2026-08-24'),
        rows: [{ currency: 'USD', rate: 100.4622 }],
      });
      prisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'ex-2' });

      const r = await service.backfillMissingRates(dan('2026-08-24'), dan('2026-08-24'), { pauseMs: 0 });

      expect(nbsFetcher.fetchRatesForDate).toHaveBeenCalledTimes(1);
      expect(r.popunjeno).toBe(1);
    });

    it('jedan neuspeo dan ne prekida ceo raspon — ostali se svejedno dovuku', async () => {
      const { service, prisma, nbsFetcher } = makeService();
      prisma.exchangeRateSnapshot.findMany.mockResolvedValue([]);
      nbsFetcher.fetchRatesForDate
        .mockRejectedValueOnce(new Error('NBS stranica vratila HTTP 500'))
        .mockResolvedValue({ rateDate: dan('2026-08-25'), rows: [{ currency: 'EUR', rate: 117.3772 }] });
      prisma.exchangeRateSnapshot.create.mockResolvedValue({ id: 'ex-3' });

      const r = await service.backfillMissingRates(dan('2026-08-24'), dan('2026-08-25'), { pauseMs: 0 });

      expect(r.neuspelo).toBe(1);
      expect(nbsFetcher.fetchRatesForDate).toHaveBeenCalledTimes(2);
    });
  });
});
