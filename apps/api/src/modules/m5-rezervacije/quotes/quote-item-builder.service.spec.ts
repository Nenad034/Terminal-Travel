import { BadRequestException } from '@nestjs/common';
import { QuoteItemBuilderService } from './quote-item-builder.service';

describe('QuoteItemBuilderService (M5 spec §3.0b.3/§3.2)', () => {
  function makeService() {
    const prisma = {
      product: { findUnique: jest.fn(), findMany: jest.fn() },
      rateLine: { findUnique: jest.fn() },
      contractPeriod: { findFirst: jest.fn(), findMany: jest.fn() },
      packageDeparture: { findFirst: jest.fn() },
    };
    const markupRules = { resolveForContracted: jest.fn(), resolveForApi: jest.fn() };
    const integrations = { checkAvailabilityAndPrice: jest.fn() };
    const service = new QuoteItemBuilderService(prisma as any, markupRules as any, integrations as any);
    return { service, prisma, markupRules, integrations };
  }

  it('odbija API stavku sa već isteklim quote_expires_at bez pozivanja M4 ponovo', async () => {
    const { service, prisma, integrations } = makeService();
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      type: 'ACCOMMODATION',
      sourceType: 'API',
      sourceContractId: null,
      sourceContract: null,
      sourceProvider: 'travelgate',
      sourceExternalId: 'ext1',
      attributes: {},
    });

    await expect(
      service.build({
        productId: 'p1',
        stayFrom: '2027-01-10',
        stayTo: '2027-01-15',
        occupancy: { adults: 2, children: 0 },
        selectedOfferQuoteExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(integrations.checkAvailabilityAndPrice).not.toHaveBeenCalled();
  });

  it('prihvata API stavku sa još-važećim quote_expires_at i ponovo pribavlja cenu od M4', async () => {
    const { service, prisma, integrations, markupRules } = makeService();
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      type: 'ACCOMMODATION',
      sourceType: 'API',
      sourceContractId: null,
      sourceContract: null,
      sourceProvider: 'travelgate',
      sourceExternalId: 'ext1',
      attributes: {},
    });
    integrations.checkAvailabilityAndPrice.mockResolvedValue({
      externalId: 'ext1',
      priceAmount: 8000,
      currency: 'EUR',
      availableUnits: 2,
      cancellationPolicy: [],
      quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    markupRules.resolveForApi.mockResolvedValue({ id: 'mr1', percentage: 10, fixedAmount: null });

    const result = await service.build({
      productId: 'p1',
      stayFrom: '2027-01-10',
      stayTo: '2027-01-15',
      occupancy: { adults: 2, children: 0 },
      selectedOfferQuoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(integrations.checkAvailabilityAndPrice).toHaveBeenCalled();
    expect(result[0].finalPrice).toBe(8800);
    expect(result[0].sourceType).toBe('API');
  });

  it('koristi eksplicitno prosleđen rate_line_id za CONTRACTED stavku', async () => {
    const { service, prisma, markupRules } = makeService();
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      type: 'ACCOMMODATION',
      sourceType: 'CONTRACTED',
      sourceContractId: 'c1',
      sourceContract: { id: 'c1', supplierId: 's1', currency: 'EUR' },
      attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2 }] },
    });
    prisma.rateLine.findUnique.mockResolvedValue({
      id: 'rl1',
      price: 10000,
      priceBasis: 'PER_ROOM_PER_NIGHT',
      occupancy: 'dvokrevetna',
      cribFeePerNight: null,
      contractPeriodId: 'period1',
      agePricing: [],
      contractPeriod: { id: 'period1', roomType: 'STD' },
    });
    markupRules.resolveForContracted.mockResolvedValue({ id: 'mr1', percentage: 0, fixedAmount: 500 });

    const result = await service.build({
      productId: 'p1',
      stayFrom: '2027-01-10',
      stayTo: '2027-01-11',
      occupancy: { adults: 2, children: 0 },
      rateLineId: 'rl1',
    });

    expect(result[0].baseCost).toBe(10000);
    expect(result[0].finalPrice).toBe(10500);
    expect(result[0].rateLineId).toBe('rl1');
  });

  // M5 spec §3.0d.6a — PACKAGE gradi po jednu QuoteItem za svaki included_products[] sastojak.
  describe('PACKAGE (grupni paket, §3.0d.6/§3.0d.6a, v1.94 — termin mora postojati kao ACTIVE PackageDeparture)', () => {
    function mockDeparture(prisma: any, departureIso: string, returnIso: string) {
      prisma.packageDeparture.findFirst = jest.fn().mockResolvedValueOnce({
        id: 'd1', productId: 'pkg1', departureDate: new Date(departureIso), returnDate: new Date(returnIso), status: 'ACTIVE',
      });
    }

    it('gradi po jednu stavku za svaki included_products[] sastojak, za izabrani (već postojeći) termin', async () => {
      const { service, prisma, markupRules } = makeService();
      const terminDate = new Date('2027-09-03');
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['flight1', 'hotel1'], duration_days: 7 },
      });
      mockDeparture(prisma, '2027-09-03', '2027-09-10');
      prisma.product.findMany = jest.fn().mockResolvedValue([
        { id: 'flight1', type: 'FLIGHT', sourceType: 'CONTRACTED', sourceContractId: 'fc1', sourceContract: { id: 'fc1', supplierId: 's1', currency: 'EUR' }, attributes: {} },
        { id: 'hotel1', type: 'ACCOMMODATION', sourceType: 'CONTRACTED', sourceContractId: 'hc1', sourceContract: { id: 'hc1', supplierId: 's2', currency: 'EUR' }, attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2 }] } },
      ]);
      prisma.contractPeriod.findFirst = jest.fn()
        .mockResolvedValueOnce({ id: 'fperiod1', roomType: null, stayFrom: terminDate, stayTo: terminDate, rateLines: [{ id: 'frl1' }] })
        .mockResolvedValueOnce({ id: 'hperiod1', roomType: 'STD', stayFrom: terminDate, stayTo: new Date('2027-09-10'), rateLines: [{ id: 'hrl1' }] });
      prisma.rateLine.findUnique = jest.fn()
        .mockResolvedValueOnce({ id: 'frl1', price: 20000, priceBasis: 'PER_PERSON_PER_NIGHT', occupancy: null, cribFeePerNight: null, contractPeriodId: 'fperiod1', agePricing: [], contractPeriod: { id: 'fperiod1', roomType: null } })
        .mockResolvedValueOnce({ id: 'hrl1', price: 5000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, contractPeriodId: 'hperiod1', agePricing: [], contractPeriod: { id: 'hperiod1', roomType: 'STD' } });
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });

      const result = await service.build({
        productId: 'pkg1',
        stayFrom: terminDate.toISOString(),
        stayTo: terminDate.toISOString(),
        occupancy: { adults: 2, children: 0 },
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.productId).sort()).toEqual(['flight1', 'hotel1']);
      const flightItem = result.find((r) => r.productId === 'flight1')!;
      expect(flightItem.finalPrice).toBe(20000); // tačkasti sastojak — flat, bez množenja noćenjima
    });

    it('baca grešku ako termin ne postoji kao ACTIVE PackageDeparture na paketu (ne izvodi ga iz sastojaka)', async () => {
      const { service, prisma } = makeService();
      const terminDate = new Date('2027-09-03');
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['flight1'], duration_days: 7 },
      });
      prisma.packageDeparture.findFirst = jest.fn().mockResolvedValue(null); // ni tačan ni tolerantan match

      await expect(
        service.build({
          productId: 'pkg1',
          stayFrom: terminDate.toISOString(),
          stayTo: terminDate.toISOString(),
          occupancy: { adults: 2, children: 0 },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.findMany).not.toHaveBeenCalled(); // ne pokušava ni da učita sastojke
    });

    it('odbija sastojak čiji period ne POKRIVA ceo prozor termina', async () => {
      const { service, prisma } = makeService();
      const terminDate = new Date('2027-09-03');
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['flight1'], duration_days: 7 },
      });
      mockDeparture(prisma, '2027-09-03', '2027-09-10');
      prisma.product.findMany = jest.fn().mockResolvedValue([
        { id: 'flight1', type: 'FLIGHT', sourceType: 'CONTRACTED', sourceContractId: 'fc1', sourceContract: { id: 'fc1', supplierId: 's1', currency: 'EUR' }, attributes: {} },
      ]);
      prisma.contractPeriod.findFirst = jest.fn().mockResolvedValue(null); // nijedan period ne pokriva

      await expect(
        service.build({
          productId: 'pkg1',
          stayFrom: terminDate.toISOString(),
          stayTo: terminDate.toISOString(),
          occupancy: { adults: 2, children: 0 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PACKAGE sa isključivo dinamičkim (API) sastojcima je podržan (v1.94 — više nije obavezan fiksan sastojak)', async () => {
      const { service, prisma, markupRules, integrations } = makeService();
      const terminDate = new Date('2027-09-03');
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['transfer1'], duration_days: 7 },
      });
      mockDeparture(prisma, '2027-09-03', '2027-09-10');
      prisma.product.findMany = jest.fn().mockResolvedValue([
        { id: 'transfer1', type: 'TRANSFER', sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'p1', sourceExternalId: 'ext1', attributes: {} },
      ]);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1', priceAmount: 3000, currency: 'EUR', availableUnits: 1, cancellationPolicy: [], quoteExpiresAt: null,
      });

      const result = await service.build({
        productId: 'pkg1',
        stayFrom: terminDate.toISOString(),
        stayTo: terminDate.toISOString(),
        occupancy: { adults: 2, children: 0 },
      });

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('transfer1');
      expect(result[0].finalPrice).toBe(3000);
    });

    it('meša CONTRACTED (mora pokriti prozor) i API (cenjen uživo za taj prozor) sastojak u istom paketu', async () => {
      const { service, prisma, markupRules, integrations } = makeService();
      const terminDate = new Date('2027-09-03');
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['hotel1', 'transfer1'], duration_days: 7 },
      });
      mockDeparture(prisma, '2027-09-03', '2027-09-10');
      prisma.product.findMany = jest.fn().mockResolvedValue([
        { id: 'hotel1', type: 'ACCOMMODATION', sourceType: 'CONTRACTED', sourceContractId: 'hc1', sourceContract: { id: 'hc1', supplierId: 's2', currency: 'EUR' }, attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2 }] } },
        { id: 'transfer1', type: 'TRANSFER', sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'p1', sourceExternalId: 'ext1', attributes: {} },
      ]);
      prisma.contractPeriod.findFirst = jest.fn().mockResolvedValue(
        { id: 'hperiod1', roomType: 'STD', stayFrom: terminDate, stayTo: new Date('2027-09-10'), rateLines: [{ id: 'hrl1' }] },
      );
      prisma.rateLine.findUnique = jest.fn().mockResolvedValue({
        id: 'hrl1', price: 5000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, contractPeriodId: 'hperiod1', agePricing: [], contractPeriod: { id: 'hperiod1', roomType: 'STD' },
      });
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1', priceAmount: 3000, currency: 'EUR', availableUnits: 1, cancellationPolicy: [], quoteExpiresAt: null,
      });

      const result = await service.build({
        productId: 'pkg1',
        stayFrom: terminDate.toISOString(),
        stayTo: terminDate.toISOString(),
        occupancy: { adults: 2, children: 0 },
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.productId).sort()).toEqual(['hotel1', 'transfer1']);
      const transferItem = result.find((r) => r.productId === 'transfer1')!;
      expect(transferItem.sourceType).toBe('API');
      expect(transferItem.finalPrice).toBe(3000);
      // API sastojak dobija prozor SA PackageDeparture (termin -> povratak), ne od sastojaka.
      expect(integrations.checkAvailabilityAndPrice).toHaveBeenCalledWith(
        'p1',
        'ext1',
        expect.objectContaining({ stayFrom: '2027-09-03', stayTo: '2027-09-10' }),
      );
    });

    it('toleriše 1 dan razlike na granici perioda — let u 23:30 sleće posle ponoći (§3.0d.6)', async () => {
      const { service, prisma, markupRules } = makeService();
      const terminDate = new Date('2027-09-03'); // termin koji je pretraga vratila (datum leta)
      prisma.product.findUnique.mockResolvedValueOnce({
        id: 'pkg1',
        type: 'PACKAGE',
        attributes: { included_products: ['hotel1'], duration_days: 7 },
      });
      mockDeparture(prisma, '2027-09-03', '2027-09-10');
      prisma.product.findMany = jest.fn().mockResolvedValue([
        { id: 'hotel1', type: 'ACCOMMODATION', sourceType: 'CONTRACTED', sourceContractId: 'hc1', sourceContract: { id: 'hc1', supplierId: 's2', currency: 'EUR' }, attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2 }] } },
      ]);
      // Hotelski period počinje 4.9. (dan POSLE termina) jer se stiže posle ponoći — unutar ±1
      // dana tolerancije na granici pokrivanja.
      prisma.contractPeriod.findFirst = jest.fn().mockResolvedValue(
        { id: 'hperiod1', roomType: 'STD', stayFrom: new Date('2027-09-04'), stayTo: new Date('2027-09-11'), rateLines: [{ id: 'hrl1' }] },
      );
      prisma.rateLine.findUnique = jest.fn().mockResolvedValue({
        id: 'hrl1', price: 5000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, contractPeriodId: 'hperiod1', agePricing: [], contractPeriod: { id: 'hperiod1', roomType: 'STD' },
      });
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });

      const result = await service.build({
        productId: 'pkg1',
        stayFrom: terminDate.toISOString(),
        stayTo: terminDate.toISOString(),
        occupancy: { adults: 2, children: 0 },
      });

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('hotel1');
    });
  });
});
