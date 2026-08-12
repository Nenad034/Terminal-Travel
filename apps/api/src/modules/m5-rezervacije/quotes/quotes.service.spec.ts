import { NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

// M5 spec §6.2 dopuna (avgust 2026, priprema za M8) — ownership za Gost pri kreiranju/čitanju Ponude.
describe('QuotesService', () => {
  function makeService() {
    const prisma: any = {
      quote: { create: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const builder = { build: jest.fn() };
    const loyalty = { getDiscountPercentage: jest.fn().mockResolvedValue(0) };
    const service = new QuotesService(prisma, builder as any, loyalty as any);
    return { service, prisma, builder, loyalty };
  }

  describe('create — client_account_id se ne uzima slepo iz tela zahteva za gosta', () => {
    it('gost NE može da pripiše Ponudu tuđem nalogu — server prisilno koristi sopstveni', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      builder.build.mockResolvedValue({
        productId: 'p1',
        sourceType: 'CONTRACTED',
        stayFrom: new Date(),
        stayTo: new Date(),
        occupancy: {},
        baseCost: 1000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl1',
        markupRuleId: 'mr1',
        finalPrice: 1200,
        finalPriceCurrency: 'EUR',
        providerQuoteReference: null,
        unitCount: 1,
        cancellationPolicySnapshot: null,
        quoteExpiresAt: null,
      });
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'B2C_SITE', clientAccountId: 'acc-tudj', items: [{}] } as any,
        { userId: 'guest-1' },
      );

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientAccountId: 'acc-own' }) }),
      );
    });

    it('interno osoblje zadržava puno poverenje u clientAccountId iz tela zahteva', async () => {
      const { service, prisma, builder } = makeService();
      builder.build.mockResolvedValue({
        productId: 'p1',
        sourceType: 'CONTRACTED',
        stayFrom: new Date(),
        stayTo: new Date(),
        occupancy: {},
        baseCost: 1000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl1',
        markupRuleId: 'mr1',
        finalPrice: 1200,
        finalPriceCurrency: 'EUR',
        providerQuoteReference: null,
        unitCount: 1,
        cancellationPolicySnapshot: null,
        quoteExpiresAt: null,
      });
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'INTERNAL_PANEL', clientAccountId: 'acc-bilo-koji', items: [{}] } as any,
        { userId: 'staff-1' },
      );

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientAccountId: 'acc-bilo-koji' }) }),
      );
    });
  });

  describe('findOne — ownership', () => {
    it('gost NE vidi tuđu Ponudu — 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.quote.findUnique.mockResolvedValue({ id: 'q1', clientAccountId: 'acc-tudj', status: 'DRAFT', expiresAt: new Date() });

      await expect(service.findOne('q1', 'guest-1')).rejects.toThrow(NotFoundException);
    });

    it('gost vidi sopstvenu Ponudu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.quote.findUnique.mockResolvedValue({ id: 'q1', clientAccountId: 'acc-own', status: 'DRAFT', expiresAt: new Date() });

      const result = await service.findOne('q1', 'guest-1');

      expect(result.id).toBe('q1');
    });
  });
});
