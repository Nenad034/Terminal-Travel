import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';

// M5 spec §6.2 dopuna (avgust 2026, priprema za M8) — ownership za Gost pri kreiranju/čitanju Ponude.
describe('QuotesService', () => {
  function makeService() {
    const prisma: any = {
      quote: { create: jest.fn(), findUnique: jest.fn() },
      subagentCommissionOverride: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const builder = { build: jest.fn() };
    const loyalty = { getDiscountPercentage: jest.fn().mockResolvedValue(0) };
    const subagentBridge = {
      resolveClientAccountIdForSubagentContact: jest.fn().mockResolvedValue(null),
      getSubagentCommissionContext: jest.fn().mockResolvedValue(null),
    };
    const auditLog = { write: jest.fn() };
    const service = new QuotesService(
      prisma,
      builder as any,
      loyalty as any,
      subagentBridge as any,
      auditLog as any,
    );
    return { service, prisma, builder, loyalty, subagentBridge, auditLog };
  }

  describe('create — client_account_id se ne uzima slepo iz tela zahteva za gosta', () => {
    it('gost NE može da pripiše Ponudu tuđem nalogu — server prisilno koristi sopstveni', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        accountType: 'GUEST',
        linkedProfileId: 'acc-own',
      });
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
        expect.objectContaining({
          data: expect.objectContaining({ clientAccountId: 'acc-bilo-koji' }),
        }),
      );
    });
  });

  // M3 §2.11i (9.9.2026) — provizija subagenta po stavci. Do ove dopune je postojao jedan
  // procenat nad celom ponudom, a `SubagentCommissionOverride` je imao 18 testova i nula
  // pozivalaca (zamka 7.12).
  describe('create — provizija subagenta po stavci (M3 §2.11i)', () => {
    function stavka(over: Record<string, unknown> = {}) {
      return {
        productId: 'p1',
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        stayFrom: new Date('2027-06-10'),
        stayTo: new Date('2027-06-11'),
        occupancy: {},
        baseCost: 10000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl1',
        contractId: 'c1',
        seasonId: 's1',
        contractPeriodId: 'cp1',
        markupRuleId: 'mr1',
        finalPrice: 10000,
        finalPriceCurrency: 'EUR',
        providerQuoteReference: null,
        unitCount: 1,
        cancellationPolicySnapshot: null,
        quoteExpiresAt: null,
        ...over,
      };
    }

    it('bez izuzetka se primenjuje podrazumevana stopa subagenta', async () => {
      const { service, prisma, builder, subagentBridge } = makeService();
      subagentBridge.getSubagentCommissionContext.mockResolvedValue({
        subagentId: 'sub-1',
        percentage: 10,
      });
      builder.build.mockResolvedValue(stavka());
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'B2B_PORTAL', clientAccountId: 'acc-sub', items: [{}] } as any,
        { userId: 'staff-1' },
      );

      const stavke = prisma.quote.create.mock.calls[0][0].data.items.create;
      expect(stavke[0].finalPrice).toBe(9000); // 100,00 − 10 %
    });

    it('„bez provizije" na stavci znači PUNA cena za subagenta, ne 0 % tiho', async () => {
      const { service, prisma, builder, subagentBridge } = makeService();
      subagentBridge.getSubagentCommissionContext.mockResolvedValue({
        subagentId: 'sub-1',
        percentage: 10,
      });
      prisma.subagentCommissionOverride.findMany.mockResolvedValue([
        {
          subagentId: null,
          scopeType: 'M3_RATE_LINE',
          scopeId: 'rl1',
          noCommission: true,
          percentage: null,
          fixedAmount: null,
          activeFrom: null,
          activeTo: null,
        },
      ]);
      builder.build.mockResolvedValue(stavka());
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'B2B_PORTAL', clientAccountId: 'acc-sub', items: [{}] } as any,
        { userId: 'staff-1' },
      );

      const stavke = prisma.quote.create.mock.calls[0][0].data.items.create;
      expect(stavke[0].finalPrice).toBe(10000); // boravišna taksa — nema šta da se deli
    });

    it('izuzetak vezan za KONKRETNOG subagenta pobeđuje opšte pravilo istog dometa', async () => {
      const { service, prisma, builder, subagentBridge } = makeService();
      subagentBridge.getSubagentCommissionContext.mockResolvedValue({
        subagentId: 'sub-1',
        percentage: 10,
      });
      prisma.subagentCommissionOverride.findMany.mockResolvedValue([
        {
          subagentId: null,
          scopeType: 'M3_CONTRACT',
          scopeId: 'c1',
          noCommission: false,
          percentage: 5,
          fixedAmount: null,
          activeFrom: null,
          activeTo: null,
        },
        {
          subagentId: 'sub-1',
          scopeType: 'M3_CONTRACT',
          scopeId: 'c1',
          noCommission: false,
          percentage: 15,
          fixedAmount: null,
          activeFrom: null,
          activeTo: null,
        },
      ]);
      builder.build.mockResolvedValue(stavka());
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'B2B_PORTAL', clientAccountId: 'acc-sub', items: [{}] } as any,
        { userId: 'staff-1' },
      );

      const stavke = prisma.quote.create.mock.calls[0][0].data.items.create;
      expect(stavke[0].finalPrice).toBe(8500); // 15 %, ne 5 % i ne 10 %
    });

    it('kupac koji NIJE subagent i dalje dobija M6 loyalty popust, ne proviziju', async () => {
      const { service, prisma, builder, loyalty } = makeService();
      loyalty.getDiscountPercentage.mockResolvedValue(5);
      builder.build.mockResolvedValue(stavka());
      prisma.quote.create.mockResolvedValue({ id: 'q1' });

      await service.create(
        { channel: 'B2C_SITE', clientAccountId: 'acc-gost', items: [{}] } as any,
        { userId: 'staff-1' },
      );

      const stavke = prisma.quote.create.mock.calls[0][0].data.items.create;
      expect(stavke[0].finalPrice).toBe(9500);
      expect(prisma.subagentCommissionOverride.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create — neusklađeni datumi PREVOZ/BORAVAK (§3.0e.3a)', () => {
    function mockMismatchedBuilder(builder: any) {
      builder.build.mockImplementation((params: any) =>
        Promise.resolve(
          params.productId === 'flight-1'
            ? {
                productId: 'flight-1',
                type: 'FLIGHT',
                sourceType: 'API',
                stayFrom: new Date('2027-01-10'),
                stayTo: new Date('2027-01-10'),
                occupancy: {},
                baseCost: 100,
                baseCostCurrency: 'EUR',
                rateLineId: null,
                markupRuleId: 'mr1',
                finalPrice: 120,
                finalPriceCurrency: 'EUR',
                providerQuoteReference: 'ext-1',
                unitCount: 1,
                cancellationPolicySnapshot: null,
                quoteExpiresAt: null,
              }
            : {
                productId: 'hotel-1',
                type: 'ACCOMMODATION',
                sourceType: 'CONTRACTED',
                stayFrom: new Date('2027-02-05'),
                stayTo: new Date('2027-02-12'),
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
              },
        ),
      );
    }

    it('odbija kreiranje bez date_mismatch_acknowledged kad se let i hotel ne poklapaju', async () => {
      const { service, prisma, builder, auditLog } = makeService();
      mockMismatchedBuilder(builder);

      await expect(
        service.create(
          {
            channel: 'INTERNAL_PANEL',
            items: [{ productId: 'flight-1' }, { productId: 'hotel-1' }],
          } as any,
          { userId: 'staff-1' },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.quote.create).not.toHaveBeenCalled();
      expect(auditLog.write).not.toHaveBeenCalled();
    });

    it('kreira ponudu i upisuje audit log override kad je date_mismatch_acknowledged=true', async () => {
      const { service, prisma, builder, auditLog } = makeService();
      mockMismatchedBuilder(builder);
      prisma.quote.create.mockResolvedValue({ id: 'q-mismatch', items: [] });

      const result = await service.create(
        {
          channel: 'INTERNAL_PANEL',
          items: [{ productId: 'flight-1' }, { productId: 'hotel-1' }],
          dateMismatchAcknowledged: true,
        } as any,
        { userId: 'staff-1' },
      );

      expect((result as unknown as { id: string }).id).toBe('q-mismatch');
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'quote.date_mismatch_override',
          resourceType: 'Quote',
          resourceId: 'q-mismatch',
        }),
      );
    });

    it('ne blokira i ne upisuje audit log kad let pada unutar (+/- 1 dan) perioda boravka', async () => {
      const { service, prisma, builder, auditLog } = makeService();
      builder.build.mockImplementation((params: any) =>
        Promise.resolve(
          params.productId === 'flight-1'
            ? {
                productId: 'flight-1',
                type: 'FLIGHT',
                sourceType: 'API',
                stayFrom: new Date('2027-02-05'), // tačno dan useljenja hotela — nema neusklađenosti
                stayTo: new Date('2027-02-05'),
                occupancy: {},
                baseCost: 100,
                baseCostCurrency: 'EUR',
                rateLineId: null,
                markupRuleId: 'mr1',
                finalPrice: 120,
                finalPriceCurrency: 'EUR',
                providerQuoteReference: 'ext-1',
                unitCount: 1,
                cancellationPolicySnapshot: null,
                quoteExpiresAt: null,
              }
            : {
                productId: 'hotel-1',
                type: 'ACCOMMODATION',
                sourceType: 'CONTRACTED',
                stayFrom: new Date('2027-02-05'),
                stayTo: new Date('2027-02-12'),
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
              },
        ),
      );
      prisma.quote.create.mockResolvedValue({ id: 'q-ok', items: [] });

      const result = await service.create(
        {
          channel: 'INTERNAL_PANEL',
          items: [{ productId: 'flight-1' }, { productId: 'hotel-1' }],
        } as any,
        { userId: 'staff-1' },
      );

      expect((result as unknown as { id: string }).id).toBe('q-ok');
      expect(auditLog.write).not.toHaveBeenCalled();
    });
  });

  describe('findOne — ownership', () => {
    it('gost NE vidi tuđu Ponudu — 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        accountType: 'GUEST',
        linkedProfileId: 'acc-own',
      });
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q1',
        clientAccountId: 'acc-tudj',
        status: 'DRAFT',
        expiresAt: new Date(),
        items: [],
      });

      await expect(service.findOne('q1', 'guest-1')).rejects.toThrow(NotFoundException);
    });

    it('gost vidi sopstvenu Ponudu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        accountType: 'GUEST',
        linkedProfileId: 'acc-own',
      });
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q1',
        clientAccountId: 'acc-own',
        status: 'DRAFT',
        expiresAt: new Date(),
        items: [],
      });

      const result = await service.findOne('q1', 'guest-1');

      expect((result as unknown as { id: string }).id).toBe('q1');
    });

    it('subagent NE vidi tuđu Ponudu — 404 (IDOR, bezbednosni nalaz 28.8.2026)', async () => {
      const { service, prisma, subagentBridge } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        accountType: 'SUBAGENT_CONTACT',
        linkedProfileId: 'subagent-1',
      });
      subagentBridge.resolveClientAccountIdForSubagentContact.mockResolvedValue('acc-own-sub');
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q2',
        clientAccountId: 'acc-tudj',
        status: 'DRAFT',
        expiresAt: new Date(),
        items: [],
      });

      await expect(service.findOne('q2', 'subagent-user-1')).rejects.toThrow(NotFoundException);
    });

    it('B2B/MCP pozivalac ne vidi baseCost/markupRuleId/providerQuoteReference (M2 spec §5.1)', async () => {
      const { service, prisma, subagentBridge } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        accountType: 'SUBAGENT_CONTACT',
        linkedProfileId: 'subagent-1',
      });
      subagentBridge.resolveClientAccountIdForSubagentContact.mockResolvedValue('acc-own-sub');
      prisma.quote.findUnique.mockResolvedValue({
        id: 'q3',
        clientAccountId: 'acc-own-sub',
        status: 'DRAFT',
        expiresAt: new Date(),
        items: [
          {
            id: 'item-1',
            productId: 'p1',
            sourceType: 'CONTRACTED',
            stayFrom: new Date(),
            stayTo: new Date(),
            occupancy: { adults: 2, children: 0 },
            baseCost: 5000,
            baseCostCurrency: 'EUR',
            rateLineId: 'rl-1',
            markupRuleId: 'mr-1',
            finalPrice: 8000,
            finalPriceCurrency: 'EUR',
            providerQuoteReference: 'supplier-secret-ref',
            unitCount: 1,
            cancellationPolicySnapshot: null,
          },
        ],
      });

      const result = await service.findOne('q3', 'subagent-user-1');
      const item = (result as unknown as { items: Record<string, unknown>[] }).items[0];

      expect(item.finalPrice).toBe(8000);
      expect(item.baseCost).toBeUndefined();
      expect(item.markupRuleId).toBeUndefined();
      expect(item.providerQuoteReference).toBeUndefined();
    });
  });
});
