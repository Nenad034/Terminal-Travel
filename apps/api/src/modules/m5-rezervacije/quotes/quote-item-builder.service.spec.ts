import { BadRequestException } from '@nestjs/common';
import { QuoteItemBuilderService } from './quote-item-builder.service';

describe('QuoteItemBuilderService (M5 spec §3.0b.3/§3.2)', () => {
  function makeService() {
    const prisma = {
      product: { findUnique: jest.fn() },
      rateLine: { findUnique: jest.fn() },
      contractPeriod: { findFirst: jest.fn() },
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
    expect(result.finalPrice).toBe(8800);
    expect(result.sourceType).toBe('API');
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

    expect(result.baseCost).toBe(10000);
    expect(result.finalPrice).toBe(10500);
    expect(result.rateLineId).toBe('rl1');
  });
});
