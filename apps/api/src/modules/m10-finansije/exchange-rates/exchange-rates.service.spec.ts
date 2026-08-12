import { NotFoundException } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';

describe('ExchangeRatesService (M10 spec §3.1)', () => {
  function makeService() {
    const prisma: any = { exchangeRateSnapshot: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() } };
    const service = new ExchangeRatesService(prisma);
    return { service, prisma };
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
});
