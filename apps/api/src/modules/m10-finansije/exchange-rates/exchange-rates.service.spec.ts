import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExchangeRatesService } from './exchange-rates.service';

describe('ExchangeRatesService (M10 spec §3.1)', () => {
  function makeService() {
    const prisma: any = { exchangeRateSnapshot: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() } };
    const nbsFetcher: any = { fetchTodaysRates: jest.fn() };
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
});
