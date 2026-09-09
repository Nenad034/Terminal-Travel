import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarkupRulesService } from './markup-rules.service';

describe('MarkupRulesService (M5 spec §2.1/§2.2)', () => {
  function makeService() {
    const prisma = {
      markupRule: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const service = new MarkupRulesService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create', () => {
    it('odbija pravilo bez percentage i fixedAmount', async () => {
      const { service } = makeService();
      await expect(
        service.create({ scopeType: 'M3_SUPPLIER', scopeId: 's1' } as any, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('kreira validno pravilo', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.create.mockResolvedValue({ id: 'r1' });
      const result = await service.create(
        { scopeType: 'M3_SUPPLIER', scopeId: 's1', percentage: 15 } as any,
        'actor-1',
      );
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('resolveForContracted — hijerarhija §2.2', () => {
    it('bira M2_PRODUCT pravilo kad postoji, čak i ako postoje šira pravila', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M2_PRODUCT')
          return Promise.resolve([
            { id: 'product-rule', percentage: 5, activeFrom: null, activeTo: null },
          ]);
        if (where.scopeType === 'M3_SUPPLIER')
          return Promise.resolve([
            { id: 'supplier-rule', percentage: 20, activeFrom: null, activeTo: null },
          ]);
        return Promise.resolve([]);
      });

      const rule = await service.resolveForContracted({
        productId: 'p1',
        contractPeriodId: 'cp1',
        contractId: 'c1',
        supplierId: 's1',
      });
      expect(rule.id).toBe('product-rule');
    });

    // M3 §2.11i (9.9.2026) — izuzetak po pojedinačnoj cenovnoj stavci. Do ove provere je
    // `M3_RATE_LINE` stajao u kaskadi, ali ga nijedan pozivalac nije prosleđivao (zamka 7.12).
    it('izuzetak na cenovnoj stavci pobeđuje pravilo proizvoda', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M3_RATE_LINE')
          return Promise.resolve([
            {
              id: 'rate-line-rule',
              percentage: 12,
              fixedAmount: 500,
              activeFrom: null,
              activeTo: null,
            },
          ]);
        if (where.scopeType === 'M2_PRODUCT')
          return Promise.resolve([
            { id: 'product-rule', percentage: 18, activeFrom: null, activeTo: null },
          ]);
        return Promise.resolve([]);
      });

      const rule = await service.resolveForContracted({
        productId: 'p1',
        contractPeriodId: 'cp1',
        contractId: 'c1',
        supplierId: 's1',
        rateLineId: 'rl-suite',
      });
      expect(rule.id).toBe('rate-line-rule');
    });

    it('bez rateLineId kaskada ostaje ista kao pre — postojeći pozivaoci se ne menjaju', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M3_RATE_LINE')
          return Promise.resolve([
            { id: 'rate-line-rule', percentage: 12, activeFrom: null, activeTo: null },
          ]);
        if (where.scopeType === 'M2_PRODUCT')
          return Promise.resolve([
            { id: 'product-rule', percentage: 18, activeFrom: null, activeTo: null },
          ]);
        return Promise.resolve([]);
      });

      const rule = await service.resolveForContracted({
        productId: 'p1',
        contractPeriodId: 'cp1',
        contractId: 'c1',
        supplierId: 's1',
      });
      expect(rule.id).toBe('product-rule');
    });

    it('resolveForAncillary vraća null kad izuzetka nema — doplata tada NASLEĐUJE maržu stavke', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockResolvedValue([]);
      await expect(service.resolveForAncillary('anc-1')).resolves.toBeNull();
    });

    it('resolveForAncillary NE pada nazad na širi nivo — pita SAMO za tu doplatu', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.scopeType === 'M3_ANCILLARY_SERVICE' && where.scopeId === 'anc-1'
            ? [{ id: 'anc-rule', percentage: 30, activeFrom: null, activeTo: null }]
            : [],
        ),
      );
      await expect(service.resolveForAncillary('anc-1')).resolves.toMatchObject({ id: 'anc-rule' });
      // Jedan jedini upit, i to baš za taj domet: da kaskada postoji, ovde bi bilo pet upita i
      // doplata bi tiho dobila pravilo ugovora umesto nasleđene marže matične stavke.
      expect(prisma.markupRule.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.markupRule.findMany).toHaveBeenCalledWith({
        where: { scopeType: 'M3_ANCILLARY_SERVICE', scopeId: 'anc-1' },
      });
    });

    it('pada nazad na M3_SUPPLIER podrazumevano pravilo kad nema specifičnijih', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M3_SUPPLIER')
          return Promise.resolve([
            { id: 'supplier-rule', percentage: 20, activeFrom: null, activeTo: null },
          ]);
        return Promise.resolve([]);
      });

      const rule = await service.resolveForContracted({
        productId: 'p1',
        contractPeriodId: 'cp1',
        contractId: 'c1',
        supplierId: 's1',
      });
      expect(rule.id).toBe('supplier-rule');
    });

    it('baca grešku kad nijedan nivo hijerarhije nema pravilo', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockResolvedValue([]);
      await expect(
        service.resolveForContracted({
          productId: 'p1',
          contractPeriodId: 'cp1',
          contractId: 'c1',
          supplierId: 's1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ignoriše pravilo van vremenskog opsega (activeFrom/activeTo)', async () => {
      const { service, prisma } = makeService();
      const now = new Date('2027-06-01');
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M3_SUPPLIER') {
          return Promise.resolve([
            {
              id: 'expired-campaign',
              percentage: 50,
              activeFrom: new Date('2027-01-01'),
              activeTo: new Date('2027-02-01'),
            },
            { id: 'evergreen', percentage: 10, activeFrom: null, activeTo: null },
          ]);
        }
        return Promise.resolve([]);
      });

      const rule = await service.resolveForContracted(
        { productId: 'p1', contractPeriodId: 'cp1', contractId: 'c1', supplierId: 's1' },
        now,
      );
      expect(rule.id).toBe('evergreen');
    });
  });

  describe('resolveForApi — hijerarhija §2.2', () => {
    it('pada nazad na M4_PROVIDER kad nema M2_PRODUCT pravila', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findMany.mockImplementation(({ where }: any) => {
        if (where.scopeType === 'M4_PROVIDER')
          return Promise.resolve([
            { id: 'provider-rule', percentage: 8, activeFrom: null, activeTo: null },
          ]);
        return Promise.resolve([]);
      });
      const rule = await service.resolveForApi({ productId: 'p1', providerCode: 'travelgate' });
      expect(rule.id).toBe('provider-rule');
    });
  });

  describe('hasDefaultRule (§2.2 ograda)', () => {
    it('vraća true kad postoji bar jedno pravilo za taj opseg', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.count.mockResolvedValue(1);
      await expect(service.hasDefaultRule('M3_SUPPLIER', 's1')).resolves.toBe(true);
    });

    it('vraća false kad ne postoji nijedno', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.count.mockResolvedValue(0);
      await expect(service.hasDefaultRule('M3_SUPPLIER', 's1')).resolves.toBe(false);
    });
  });
});
