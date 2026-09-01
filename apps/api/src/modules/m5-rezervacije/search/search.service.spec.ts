import { SearchService } from './search.service';

describe('SearchService (M5 spec §3.0b/§11)', () => {
  function makeService() {
    const prisma = {
      product: { findMany: jest.fn() },
      contractPeriod: { findMany: jest.fn() },
      packageDeparture: { findMany: jest.fn() },
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

  // M5 spec §3.0b.2/§3.0c.3a dopuna 1.9.2026 — is_refundable, sada izračunato i za API (ne
  // ostaje null) jer checkAvailabilityAndPrice već vraća cancellationPolicy za svaki poziv.
  describe('is_refundable (§3.0b.2, dopuna 1.9.2026)', () => {
    it('CONTRACTED — true kad bar jedan PRE_ARRIVAL prozor ima refund_percentage > 0', async () => {
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
          cancellationRules: [{ ruleType: 'PRE_ARRIVAL', daysBeforeStay: 10, refundPercentage: 50 }],
        },
      ]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 10, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE' });
      expect(results[0].offers[0].isRefundable).toBe(true);
    });

    it('CONTRACTED — false kad su svi PRE_ARRIVAL prozori 0% ili nema nijednog pravila', async () => {
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
      expect(results[0].offers[0].isRefundable).toBe(false);
    });

    it('API — true kad checkAvailabilityAndPrice vrati bar jedan prozor sa refund_percentage > 0', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      const apiProduct = { ...baseProduct, sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'travelgate', sourceExternalId: 'ext1' };
      prisma.product.findMany.mockResolvedValue([apiProduct]);
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1',
        priceAmount: 5000,
        currency: 'EUR',
        availableUnits: 3,
        cancellationPolicy: [{ days_before_stay: 5, refund_percentage: 100 }],
        quoteExpiresAt: new Date().toISOString(),
      });
      markupRules.resolveForApi.mockResolvedValue({ percentage: 20, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15' });
      expect(results[0].offers[0].isRefundable).toBe(true);
    });

    it('API — false kad je cancellationPolicy prazna (bez pravila)', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      const apiProduct = { ...baseProduct, sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'travelgate', sourceExternalId: 'ext1' };
      prisma.product.findMany.mockResolvedValue([apiProduct]);
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1',
        priceAmount: 5000,
        currency: 'EUR',
        availableUnits: 3,
        cancellationPolicy: [],
        quoteExpiresAt: new Date().toISOString(),
      });
      markupRules.resolveForApi.mockResolvedValue({ percentage: 20, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15' });
      expect(results[0].offers[0].isRefundable).toBe(false);
    });
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

    // M5 spec §3.0d.1/3.0d.2/3.0d.3 dopuna 1.9.2026 — origin_city, poslednji od 6 parametara iz v1.28.
    it('originCity (FLIGHT/TRANSFER/opšti TRANSPORT) — poklapa attributes.route.origin_city', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        { ...apiProduct('bg', { route: { origin_city: 'Beograd' } }), type: 'FLIGHT' },
        { ...apiProduct('ny', { route: { origin_city: 'Novi Sad' } }), type: 'FLIGHT' },
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', originCity: 'Beograd' });
      expect(results.map((r) => r.productId)).toEqual(['bg']);
    });

    it('originCity (TRANSPORT/RENT_A_CAR) — poklapa attributes.pickup_location, ne route', async () => {
      const { service, prisma, integrations, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValue([
        { ...apiProduct('bg', { transport_mode: 'RENT_A_CAR', pickup_location: 'Beograd' }), type: 'TRANSPORT' },
        { ...apiProduct('ny', { transport_mode: 'RENT_A_CAR', pickup_location: 'Novi Sad' }), type: 'TRANSPORT' },
      ]);
      mockAvailable(integrations);
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', stayFrom: '2027-01-10', stayTo: '2027-01-15', originCity: 'Beograd' });
      expect(results.map((r) => r.productId)).toEqual(['bg']);
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

  // M5 spec §3.0d.6/§3.0d.6a — grupni paket: termini = presek FIXED/CHARTER datuma preko
  // included_products[], cena = zbir sastojaka (svaki sa sopstvenom maržom).
  describe('PACKAGE (grupni paket, §3.0d.6/§3.0d.6a, v1.94 — termin dolazi sa PackageDeparture)', () => {
    const packageProduct = {
      id: 'pkg1',
      type: 'PACKAGE',
      sourceType: 'CONTRACTED',
      sourceContractId: null,
      sourceContract: null,
      destinationCountry: 'Grčka',
      destinationCity: 'Zakintos',
      media: [],
      attributes: { included_products: ['flight1', 'hotel1'], duration_days: 7 },
      translations: [{ languageCode: 'sr', name: 'Grčka čarter 7 dana', description: '' }],
    };

    function departure(departureIso: string, returnIso: string) {
      return { id: 'd1', productId: 'pkg1', departureDate: new Date(departureIso), returnDate: new Date(returnIso), status: 'ACTIVE' };
    }
    // Tačkasti sastojak (let) — jedan dan, flat cena, isti obrazac kao svaka druga ne-paket
    // CONTRACTED FLIGHT stavka (bez množenja noćenjima).
    function flightPeriod(stayFromIso: string) {
      return {
        id: 'fperiod1',
        roomType: null,
        allotmentMode: 'CHARTER',
        totalCapacity: 50,
        unitsSold: 0,
        stayFrom: new Date(stayFromIso),
        stayTo: new Date(stayFromIso),
        rateLines: [{ id: 'frl1', price: 20000, priceBasis: 'PER_PERSON_PER_NIGHT', occupancy: null, cribFeePerNight: null, boardType: null, agePricing: [] }],
        cancellationRules: [],
      };
    }
    // Noćenje-zasnovan sastojak (hotel) — period mora POKRIVATI ceo prozor paketa; cena se
    // uvek računa preko duration_days paketa, ne preko dužine ovog perioda.
    function hotelPeriod(stayFromIso: string, stayToIso: string) {
      return {
        id: 'hperiod1',
        roomType: 'STD',
        allotmentMode: 'FIXED',
        totalCapacity: 10,
        unitsSold: 0,
        stayFrom: new Date(stayFromIso),
        stayTo: new Date(stayToIso),
        rateLines: [{ id: 'hrl1', price: 5000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null, boardType: 'AI', agePricing: [] }],
        cancellationRules: [],
      };
    }
    const flightComponent = { id: 'flight1', type: 'FLIGHT', sourceType: 'CONTRACTED', sourceContractId: 'fc1', sourceContract: { id: 'fc1', supplierId: 's1', currency: 'EUR' }, attributes: {} };
    const hotelComponent = { id: 'hotel1', type: 'ACCOMMODATION', sourceType: 'CONTRACTED', sourceContractId: 'hc1', sourceContract: { id: 'hc1', supplierId: 's2', currency: 'EUR' }, attributes: { roomTypes: [{ code: 'STD', capacityAdults: 4, capacityChildren: 2 }] } };

    it('vraća ponudu za termin definisan NA paketu (PackageDeparture), ne presekom perioda sastojaka', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      prisma.contractPeriod.findMany
        .mockResolvedValueOnce([flightPeriod('2027-09-03')])
        .mockResolvedValueOnce([hotelPeriod('2027-09-03', '2027-09-10')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results).toHaveLength(1);
      expect(results[0].offers).toHaveLength(1);
      expect(results[0].offers[0].packageDepartureDate).toBe('2027-09-03');
    });

    it('cena ponude je zbir cena sastojaka: let flat (bez noćenja), hotel po duration_days paketa (ne po dužini sopstvenog perioda)', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      // Hotelski period namerno pokriva CEO SEZONU (ne jedan tačan 7-dnevni termin) — dokazuje
      // da cena i dalje koristi duration_days paketa (7 noćenja), ne dužinu ovog perioda (~92 dana).
      prisma.contractPeriod.findMany
        .mockResolvedValueOnce([flightPeriod('2027-09-03')])
        .mockResolvedValueOnce([hotelPeriod('2027-06-01', '2027-09-30')]);
      // let: +10% marža na 20000 (flat) = 22000; hotel: +500 fiksno na 5000*7=35000 = 35500
      markupRules.resolveForContracted
        .mockResolvedValueOnce({ percentage: 10, fixedAmount: null })
        .mockResolvedValueOnce({ percentage: 0, fixedAmount: 500 });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results[0].offers[0].finalPrice).toBe(22000 + 35500);
    });

    it('is_refundable za paket — najstroži sastojak odlučuje (vlasnikova odluka 1.9.2026)', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      prisma.contractPeriod.findMany
        .mockResolvedValueOnce([{ ...flightPeriod('2027-09-03'), cancellationRules: [] }]) // let: bez pravila => nerefundabilan
        .mockResolvedValueOnce([{ ...hotelPeriod('2027-09-03', '2027-09-10'), cancellationRules: [{ ruleType: 'PRE_ARRIVAL', daysBeforeStay: 10, refundPercentage: 100 }] }]); // hotel: refundabilan
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      // Hotel je refundabilan, ali let nije — paket kao celina mora biti nerefundabilan.
      expect(results[0].offers[0].isRefundable).toBe(false);
    });

    it('paket bez ijednog ACTIVE PackageDeparture termina se ne prikazuje (ne izvodi termin iz sastojaka)', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([]); // nijedan termin definisan na paketu

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });
      expect(results).toHaveLength(0);
      expect(prisma.contractPeriod.findMany).not.toHaveBeenCalled(); // ne pokušava ni da traži periode
    });

    it('sastojak koji ne pokriva prozor termina čini ceo termin nedostupnim (SOLD_OUT princip)', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      // hotel nema NIJEDAN period koji pokriva ovaj termin.
      prisma.contractPeriod.findMany.mockResolvedValueOnce([flightPeriod('2027-09-03')]).mockResolvedValueOnce([]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });
      expect(results).toHaveLength(0);
    });

    it('poštuje tačan traženi datum (stayFrom) — filtrira PackageDeparture, ne period sastojaka', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-10', '2027-09-17')]);
      prisma.contractPeriod.findMany
        .mockResolvedValueOnce([flightPeriod('2027-09-10')])
        .mockResolvedValueOnce([hotelPeriod('2027-09-10', '2027-09-17')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'], stayFrom: '2027-09-10' });

      expect(results[0].offers).toHaveLength(1);
      expect(results[0].offers[0].packageDepartureDate).toBe('2027-09-10');
    });

    it('meša CONTRACTED (mora pokriti prozor) i API (cenjen uživo za isti prozor) sastojak', async () => {
      const { service, prisma, markupRules, integrations } = makeService();
      const transferComponent = { id: 'transfer1', type: 'TRANSFER', sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'p1', sourceExternalId: 'ext1', attributes: {} };
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([hotelComponent, transferComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      prisma.contractPeriod.findMany.mockResolvedValueOnce([hotelPeriod('2027-09-03', '2027-09-10')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1', priceAmount: 3000, currency: 'EUR', availableUnits: 2, cancellationPolicy: [], quoteExpiresAt: null,
      });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results[0].offers).toHaveLength(1);
      // hotel: 5000*7=35000 (bez marže); transfer: 3000 (bez marže) -> 38000
      expect(results[0].offers[0].finalPrice).toBe(38000);
      expect(integrations.checkAvailabilityAndPrice).toHaveBeenCalledWith(
        'p1',
        'ext1',
        expect.objectContaining({ stayFrom: '2027-09-03', stayTo: '2027-09-10' }),
      );
    });

    it('nema značaja KOJI sastojak je fiksan — let fiksan + hotel dinamičan radi isto kao obrnuto', async () => {
      const { service, prisma, markupRules, integrations } = makeService();
      const dynamicHotel = { id: 'hotel1', type: 'ACCOMMODATION', sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'p2', sourceExternalId: 'ext2', attributes: {} };
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, dynamicHotel]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      prisma.contractPeriod.findMany.mockResolvedValueOnce([flightPeriod('2027-09-03')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      markupRules.resolveForApi.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext2', priceAmount: 4000, currency: 'EUR', availableUnits: 2, cancellationPolicy: [], quoteExpiresAt: null,
      });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results[0].offers).toHaveLength(1);
      expect(results[0].offers[0].packageDepartureDate).toBe('2027-09-03');
      // let: 20000 (bez marže); hotel (API): 4000 (bez marže) -> 24000
      expect(results[0].offers[0].finalPrice).toBe(24000);
    });

    it('termin postaje nedostupan ako API sastojak nema dostupnih jedinica za taj datum', async () => {
      const { service, prisma, markupRules, integrations } = makeService();
      const transferComponent = { id: 'transfer1', type: 'TRANSFER', sourceType: 'API', sourceContractId: null, sourceContract: null, sourceProvider: 'p1', sourceExternalId: 'ext1', attributes: {} };
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([hotelComponent, transferComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      prisma.contractPeriod.findMany.mockResolvedValueOnce([hotelPeriod('2027-09-03', '2027-09-10')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: 0 });
      integrations.checkAvailabilityAndPrice.mockResolvedValue({
        externalId: 'ext1', priceAmount: 3000, currency: 'EUR', availableUnits: 0, cancellationPolicy: [], quoteExpiresAt: null,
      });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results).toHaveLength(0);
    });

    it('toleriše 1 dan razlike na granici perioda — let u 23:30 sleće posle ponoći (§3.0d.6)', async () => {
      const { service, prisma, markupRules } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([packageProduct]).mockResolvedValueOnce([flightComponent, hotelComponent]);
      prisma.packageDeparture.findMany.mockResolvedValueOnce([departure('2027-09-03', '2027-09-10')]);
      // Let poleće 3.9. uveče; hotelski period počinje "4.9." u sistemu jer se stiže posle
      // ponoći — NIJE isti kalendarski dan kao termin paketa, ali je unutar ±1 dana tolerancije.
      prisma.contractPeriod.findMany
        .mockResolvedValueOnce([flightPeriod('2027-09-03')])
        .mockResolvedValueOnce([hotelPeriod('2027-09-04', '2027-09-11')]);
      markupRules.resolveForContracted.mockResolvedValue({ percentage: 0, fixedAmount: null });

      const results = await service.search({ channel: 'B2C_SITE', type: ['PACKAGE'] });

      expect(results[0].offers).toHaveLength(1);
    });
  });
});
