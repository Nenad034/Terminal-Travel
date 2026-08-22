import { SearchService } from './search.service';

describe('SearchService (M5 spec §3.0b/§11)', () => {
  function makeService() {
    const prisma = {
      product: { findMany: jest.fn() },
      contractPeriod: { findMany: jest.fn() },
    };
    const markupRules = { resolveForContracted: jest.fn(), resolveForApi: jest.fn() };
    const integrations = { checkAvailabilityAndPrice: jest.fn() };
    const service = new SearchService(prisma as any, markupRules as any, integrations as any);
    return { service, prisma, markupRules, integrations };
  }

  const baseProduct = {
    id: 'p1',
    type: 'ACCOMMODATION',
    sourceType: 'CONTRACTED',
    sourceContractId: 'c1',
    sourceContract: { id: 'c1', supplierId: 's1', currency: 'EUR' },
    destinationCountry: 'Grčka',
    destinationCity: 'Rodos',
    media: [],
    attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2, name: 'Standard' }] },
    translations: [{ languageCode: 'sr', name: 'Hotel Sunce', description: 'Opis hotela' }],
  };

  it('ne vraća CONTRACTED period sa nedovoljnim preostalim kapacitetom (SOLD_OUT)', async () => {
    const { service, prisma, markupRules } = makeService();
    prisma.product.findMany.mockResolvedValue([baseProduct]);
    prisma.contractPeriod.findMany.mockResolvedValue([
      {
        id: 'period1',
        roomType: 'STD',
        allotmentMode: 'FIXED',
        totalCapacity: 2,
        unitsSold: 2, // remaining = 0 < roomsRequested(1)
        rateLines: [],
        cancellationRules: [],
      },
    ]);
    markupRules.resolveForContracted.mockResolvedValue({ percentage: 10, fixedAmount: null });

    const results = await service.search({ channel: 'B2C_SITE' });
    expect(results).toHaveLength(0);
  });

  it('vraća ON_REQUEST period kao ON_REQUEST, ne kao potvrđeno dostupan', async () => {
    const { service, prisma, markupRules } = makeService();
    prisma.product.findMany.mockResolvedValue([baseProduct]);
    prisma.contractPeriod.findMany.mockResolvedValue([
      {
        id: 'period1',
        roomType: 'STD',
        allotmentMode: 'ON_REQUEST',
        totalCapacity: null,
        unitsSold: 0,
        rateLines: [{ id: 'rl1', price: 10000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, boardType: 'BB', agePricing: [] }],
        cancellationRules: [],
      },
    ]);
    markupRules.resolveForContracted.mockResolvedValue({ percentage: 10, fixedAmount: null });

    const results = await service.search({ channel: 'B2C_SITE' });
    expect(results).toHaveLength(1);
    expect(results[0].offers[0].availabilityStatus).toBe('ON_REQUEST');
  });

  it('primenjuje maržu na osnovnu cenu CONTRACTED ponude', async () => {
    const { service, prisma, markupRules } = makeService();
    prisma.product.findMany.mockResolvedValue([baseProduct]);
    prisma.contractPeriod.findMany.mockResolvedValue([
      {
        id: 'period1',
        roomType: 'STD',
        allotmentMode: 'FIXED',
        totalCapacity: 10,
        unitsSold: 0,
        rateLines: [{ id: 'rl1', price: 10000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, boardType: 'BB', agePricing: [] }],
        cancellationRules: [],
      },
    ]);
    markupRules.resolveForContracted.mockResolvedValue({ percentage: 10, fixedAmount: null });

    const results = await service.search({ channel: 'B2C_SITE' });
    // bez occupancy — baseCost = rateLine.price (10000); markup 10% => 11000
    expect(results[0].offers[0].finalPrice).toBe(11000);
  });

  it('ne vraća API ponudu sa availableUnits=0', async () => {
    const { service, prisma, integrations } = makeService();
    const apiProduct = { ...baseProduct, sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'travelgate', sourceExternalId: 'ext1' };
    prisma.product.findMany.mockResolvedValue([apiProduct]);
    integrations.checkAvailabilityAndPrice.mockResolvedValue({
      externalId: 'ext1',
      priceAmount: 5000,
      currency: 'EUR',
      availableUnits: 0,
      cancellationPolicy: [],
      quoteExpiresAt: new Date().toISOString(),
    });

    const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15' });
    expect(results).toHaveLength(0);
  });

  it('vraća API ponudu sa quote_expires_at kad je dostupna', async () => {
    const { service, prisma, integrations, markupRules } = makeService();
    const apiProduct = { ...baseProduct, sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'travelgate', sourceExternalId: 'ext1' };
    prisma.product.findMany.mockResolvedValue([apiProduct]);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    integrations.checkAvailabilityAndPrice.mockResolvedValue({
      externalId: 'ext1',
      priceAmount: 5000,
      currency: 'EUR',
      availableUnits: 3,
      cancellationPolicy: [],
      quoteExpiresAt: expiresAt,
    });
    markupRules.resolveForApi.mockResolvedValue({ percentage: 20, fixedAmount: null });

    const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15' });
    expect(results[0].offers[0].quoteExpiresAt).toBe(expiresAt);
    expect(results[0].offers[0].finalPrice).toBe(6000);
  });

  // M5 spec §11 v1.28 ožičen 22.8.2026 — filteri specifični po tipu (M2 spec §2.3 konvencije).
  // Dva API-sourced proizvoda koji se razlikuju SAMO po `attributes`, da se izoluje da filter
  // stvarno bira po tom polju, ne po nečem drugom.
  describe('filteri specifični po tipu (§11 v1.28)', () => {
    function apiProduct(id: string, attributes: Record<string, unknown>) {
      return {
        ...baseProduct,
        id,
        sourceType: 'API',
        sourceContractId: null,
        sourceContract: null,
        sourceProvider: 'travelgate',
        sourceExternalId: `ext-${id}`,
        attributes,
      };
    }

    function mockAvailable(integrations: any) {
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1',
        priceAmount: 5000,
        currency: 'EUR',
        availableUnits: 3,
        cancellationPolicy: [],
        quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    }

    it('cabinClass (FLIGHT) — vraća samo proizvod čiji attributes.cabin_class poklapa', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        apiProduct('econ', { cabin_class: 'ECONOMY' }),
        apiProduct('biz', { cabin_class: 'BUSINESS' }),
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', cabinClass: 'BUSINESS' });
      expect(results.map((r) => r.productId)).toEqual(['biz']);
    });

    it('minDriverAge (TRANSPORT/RENT_A_CAR) — isključuje proizvod čiji min_driver_age premašuje traženu starost', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        apiProduct('needs25', { min_driver_age: 25 }),
        apiProduct('noMin', {}),
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', minDriverAge: 21 });
      expect(results.map((r) => r.productId)).toEqual(['noMin']); // 21 < 25, needs25 isključen; proizvod bez atributa uvek prolazi
    });

    it('durationNights (CRUISE) — tačno poklapanje', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        apiProduct('7n', { duration_nights: 7 }),
        apiProduct('10n', { duration_nights: 10 }),
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', durationNights: 7 });
      expect(results.map((r) => r.productId)).toEqual(['7n']);
    });

    it('cabinType (CRUISE) — poklapa ako BILO KOJA stavka cabin_types[] ima traženu kategoriju', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        apiProduct('withBalcony', { cabin_types: [{ category: 'INTERIOR' }, { category: 'BALCONY' }] }),
        apiProduct('onlyInterior', { cabin_types: [{ category: 'INTERIOR' }] }),
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', cabinType: 'BALCONY' });
      expect(results.map((r) => r.productId)).toEqual(['withBalcony']);
    });
  });
});
