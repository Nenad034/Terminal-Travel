import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_AGE_POLICY,
  assertRoomCapacity,
  assertRoomConfigMatchesTotals,
  classifyAge,
  computeRoomBaseCost,
  resolveBaseAdultsCovered,
  RoomTypeDefinition,
  AgePolicyEntry,
  RateLineForCalc,
} from './occupancy';

describe('assertRoomConfigMatchesTotals (M5 spec §3.2a)', () => {
  it('podrazumeva jednu sobu kad room_config nije poslat', () => {
    const result = assertRoomConfigMatchesTotals({ adults: 2, children: 1 });
    expect(result).toEqual([{ roomTypeCode: null, adults: 2, children: 1, childrenAges: null }]);
  });

  it('prihvata više soba čiji zbir odgovara ukupnom broju gostiju', () => {
    const result = assertRoomConfigMatchesTotals({
      adults: 4,
      children: 1,
      roomConfig: [
        { adults: 2, children: 1, childrenAges: [5] },
        { adults: 2, children: 0 },
      ],
    });
    expect(result).toHaveLength(2);
  });

  it('odbija neusklađen zbir gostiju po sobama', () => {
    expect(() =>
      assertRoomConfigMatchesTotals({
        adults: 3,
        children: 0,
        roomConfig: [{ adults: 2, children: 0 }],
      }),
    ).toThrow(BadRequestException);
  });
});

describe('classifyAge (M2 spec §2.3b)', () => {
  it('svrstava bebu u INFANT (ne broji se u kapacitet)', () => {
    const category = classifyAge(1, DEFAULT_AGE_POLICY);
    expect(category.category).toBe('INFANT');
    expect(category.countsTowardCapacity).toBe(false);
  });

  it('svrstava dete od 8 godina u CHILD', () => {
    expect(classifyAge(8, DEFAULT_AGE_POLICY).category).toBe('CHILD');
  });

  it('odbija uzrast koji ne pripada nijednoj kategoriji', () => {
    const partial = [{ category: 'ADULT' as const, ageFrom: 30, ageTo: null, countsTowardCapacity: true, maxCount: null, requiresCrib: false, cribIncluded: null }];
    expect(() => classifyAge(5, partial)).toThrow(BadRequestException);
  });
});

describe('assertRoomCapacity (M5 spec §3.2a)', () => {
  const roomType: RoomTypeDefinition = { code: 'STD', capacityAdults: 2, capacityChildren: 1 };

  it('prolazi za bebu koja ne broji se u kapacitet, uprkos punom kapacitetu dece', () => {
    expect(() =>
      assertRoomCapacity({ adults: 2, children: 1, childrenAges: [1] }, roomType),
    ).not.toThrow();
  });

  it('odbija drugo dete kad kapacitet dece dozvoljava samo jedno (INFANT ne broji se, ali CHILD da)', () => {
    expect(() =>
      assertRoomCapacity({ adults: 2, children: 2, childrenAges: [8, 9] }, roomType),
    ).toThrow(BadRequestException);
  });

  it('odbija kad broj odraslih premašuje capacity_adults', () => {
    expect(() => assertRoomCapacity({ adults: 3, children: 0, childrenAges: [] }, roomType)).toThrow(BadRequestException);
  });

  it('sprovodi max_count po kategoriji nezavisno od ukupnog kapaciteta', () => {
    const roomWithMax: RoomTypeDefinition = {
      code: 'FAM',
      capacityAdults: 2,
      capacityChildren: 3,
      agePolicy: [
        ...DEFAULT_AGE_POLICY.filter((p) => p.category !== 'INFANT'),
        { category: 'INFANT', ageFrom: 0, ageTo: 1.99, countsTowardCapacity: false, maxCount: 1, requiresCrib: true, cribIncluded: null },
      ],
    };
    expect(() =>
      assertRoomCapacity({ adults: 2, children: 2, childrenAges: [0.5, 1] }, roomWithMax),
    ).toThrow(BadRequestException);
  });
});

describe('resolveBaseAdultsCovered (M5 spec §3.2b, korak 2)', () => {
  it('prepoznaje "dvokrevetna" kao 2 odrasla', () => {
    expect(resolveBaseAdultsCovered('Odrasla osoba u dvokrevetnoj sobi', 2)).toBe(2);
  });

  it('podrazumeva sve prisutne odrasle kad tekst nije prepoznat', () => {
    expect(resolveBaseAdultsCovered('nepoznat opis', 3)).toBe(3);
  });
});

describe('computeRoomBaseCost (M5 spec §3.2b)', () => {
  const roomType: RoomTypeDefinition = { code: 'STD', capacityAdults: 4, capacityChildren: 2 };

  it('PER_ROOM_PER_NIGHT: 2 odrasla + 1 dete iznad osnovne popunjenosti', () => {
    const cost = computeRoomBaseCost({
      room: { adults: 2, children: 1, childrenAges: [8] },
      roomType,
      rateLine: { price: 10000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null },
      agePricingCandidates: [
        { ageCategory: 'CHILD', occupantIndex: 1, minAdultsPresent: null, pricingMode: 'FLAT_PRICE_PER_NIGHT', percentage: null, flatPrice: 2000 },
      ],
      nights: 3,
    });
    // (10000 + 2000) * 3 = 36000
    expect(cost).toBe(36000);
  });

  it('PER_PERSON_PER_NIGHT: cena se množi brojem odraslih pokrivenih osnovnom popunjenošću', () => {
    const cost = computeRoomBaseCost({
      room: { adults: 2, children: 1, childrenAges: [8] },
      roomType,
      rateLine: { price: 5000, priceBasis: 'PER_PERSON_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null },
      agePricingCandidates: [
        { ageCategory: 'CHILD', occupantIndex: 1, minAdultsPresent: null, pricingMode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50, flatPrice: null },
      ],
      nights: 2,
    });
    // baza: 5000*2=10000 po noći; dete: round(5000*0.5)=2500 po noći; ukupno (10000+2500)*2=25000
    expect(cost).toBe(25000);
  });

  it('dodaje krevetac jednom po traženom krevetcu', () => {
    const cost = computeRoomBaseCost({
      room: { adults: 2, children: 1, childrenAges: [1] },
      roomType,
      rateLine: { price: 8000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: 500 },
      agePricingCandidates: [
        { ageCategory: 'INFANT', occupantIndex: null, minAdultsPresent: null, pricingMode: 'FLAT_PRICE_PER_NIGHT', percentage: null, flatPrice: 0 },
      ],
      nights: 1,
    });
    expect(cost).toBe(8000 + 0 + 500);
  });

  it('odbija kad ne postoji odgovarajući age_pricing red za gosta (ne pretpostavlja cenu)', () => {
    expect(() =>
      computeRoomBaseCost({
        room: { adults: 2, children: 1, childrenAges: [8] },
        roomType,
        rateLine: { price: 10000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null },
        agePricingCandidates: [],
        nights: 1,
      }),
    ).toThrow(BadRequestException);
  });

  // M3 spec §2.3c (28.8.2026, na zahtev vlasnika: "uzrasna politika koja važi generalno za
  // hotel ne mora da bude ista kada taj hotel kreira cene za neku akciju") — bez override-a
  // dete od 13 pada van podrazumevane CHILD granice (2-11,99) i klasifikuje se kao ADULT, pa
  // nema odgovarajući age_pricing red (baca grešku, dole); sa override-om koji pomera CHILD
  // granicu na 15,99, isto dete se klasifikuje kao CHILD i dobija CHILD popust.
  it('ContractPeriod.age_policy_override menja klasifikaciju gosta za obračun cene', () => {
    const room = { adults: 2, children: 1, childrenAges: [13] };
    const rateLine: RateLineForCalc = { price: 10000, priceBasis: 'PER_ROOM_PER_NIGHT', occupancy: 'dvokrevetna', cribFeePerNight: null };
    const agePricingCandidates = [
      { ageCategory: 'CHILD' as const, occupantIndex: 1, minAdultsPresent: null, pricingMode: 'FLAT_PRICE_PER_NIGHT' as const, percentage: null, flatPrice: 2000 },
    ];

    expect(() => computeRoomBaseCost({ room, roomType, rateLine, agePricingCandidates, nights: 1 })).toThrow(BadRequestException);

    const override: AgePolicyEntry[] = [
      { category: 'ADULT', ageFrom: 16, ageTo: null, countsTowardCapacity: true, maxCount: null, requiresCrib: false, cribIncluded: null },
      { category: 'CHILD', ageFrom: 2, ageTo: 15.99, countsTowardCapacity: true, maxCount: null, requiresCrib: false, cribIncluded: null },
    ];
    const cost = computeRoomBaseCost({ room, roomType, rateLine, agePricingCandidates, agePolicyOverride: override, nights: 1 });
    expect(cost).toBe(10000 + 2000);
  });
});
