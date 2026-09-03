import { checkAncillaryOccupancy, computeAncillaryAmount, signedAncillaryAmount, type AncillaryServiceLike } from './ancillary-pricing';

// M5 spec §6.7a / M3 §2.6 v1.13 — obračun doplate i popusta.
function svc(over: Partial<AncillaryServiceLike> = {}): AncillaryServiceLike {
  return {
    kind: 'SURCHARGE',
    pricingMode: 'FLAT_PER_UNIT',
    flatAmount: 1000, // 10,00 EUR
    percentageOfNightlyRate: null,
    priceBasis: 'PER_PERSON_PER_NIGHT',
    coversPersons: null,
    maxAdults: null,
    maxChildren: null,
    childMaxAge: null,
    maxQuantity: null,
    ...over,
  };
}
const ctx = { nights: 7, adults: 2, children: 1, rooms: 1, nightlyRate: 5000 };

describe('computeAncillaryAmount — osnova je PAR (osoba/soba × dan/period)', () => {
  it('po osobi i danu množi i osobama i noćima', () => {
    expect(computeAncillaryAmount(svc({ priceBasis: 'PER_PERSON_PER_NIGHT' }), ctx)).toBe(1000 * 3 * 7);
  });

  it('po osobi i periodu množi samo osobama', () => {
    expect(computeAncillaryAmount(svc({ priceBasis: 'PER_PERSON_PER_STAY' }), ctx)).toBe(1000 * 3);
  });

  it('po sobi i danu množi sobama i noćima, ne osobama', () => {
    expect(computeAncillaryAmount(svc({ priceBasis: 'PER_ROOM_PER_NIGHT' }), { ...ctx, rooms: 2 })).toBe(1000 * 2 * 7);
  });

  it('po sobi i periodu je jednom po sobi', () => {
    expect(computeAncillaryAmount(svc({ priceBasis: 'PER_ROOM_PER_STAY' }), { ...ctx, rooms: 2 })).toBe(1000 * 2);
  });

  it('procenat noćne cene se računa od nabavne noćne cene matične stavke', () => {
    const s = svc({ pricingMode: 'PERCENTAGE_OF_NIGHTLY_RATE', flatAmount: null, percentageOfNightlyRate: 50, priceBasis: 'PER_ROOM_PER_STAY' });
    expect(computeAncillaryAmount(s, ctx)).toBe(2500); // 50% od 50,00 EUR, jednom
  });

  it('količina (ljubimci, dodatni ležajevi) množi iznos', () => {
    expect(computeAncillaryAmount(svc({ priceBasis: 'PER_PET_PER_NIGHT' }), { ...ctx, quantity: 2 })).toBe(1000 * 7 * 2);
  });
});

describe('signedAncillaryAmount — znak nosi kind, iznos ostaje pozitivan', () => {
  it('doplata ulazi sa plusom', () => {
    expect(signedAncillaryAmount(svc({ priceBasis: 'PER_ROOM_PER_STAY' }), ctx)).toBe(1000);
  });

  it('popust ulazi sa minusom, iako je iznos upisan kao pozitivan', () => {
    expect(signedAncillaryAmount(svc({ kind: 'DISCOUNT', priceBasis: 'PER_ROOM_PER_STAY' }), ctx)).toBe(-1000);
  });
});

describe('checkAncillaryOccupancy — samo za osnovu po sobi', () => {
  it('cena po osobi se ne proverava prema granicama sobe', () => {
    expect(checkAncillaryOccupancy(svc({ coversPersons: 1, priceBasis: 'PER_PERSON_PER_NIGHT' }), { adults: 4, children: 0 })).toBeNull();
  });

  it('odbija sastav koji prelazi ukupan broj osoba', () => {
    expect(checkAncillaryOccupancy(svc({ priceBasis: 'PER_ROOM_PER_STAY', coversPersons: 2 }), { adults: 2, children: 1 })).toContain('najviše 2 osoba');
  });

  it('odbija previše odraslih i previše dece odvojeno', () => {
    const s = svc({ priceBasis: 'PER_ROOM_PER_STAY', coversPersons: 4, maxAdults: 2, maxChildren: 1 });
    expect(checkAncillaryOccupancy(s, { adults: 3, children: 0 })).toContain('odraslih');
    expect(checkAncillaryOccupancy(s, { adults: 1, children: 2 })).toContain('dece');
  });

  it('odbija dete starije od granice za OVU stavku', () => {
    const s = svc({ priceBasis: 'PER_ROOM_PER_STAY', childMaxAge: 6.99 });
    expect(checkAncillaryOccupancy(s, { adults: 2, children: 1, childrenAges: [9] })).toContain('do 6.99 godina');
    expect(checkAncillaryOccupancy(s, { adults: 2, children: 1, childrenAges: [5] })).toBeNull();
  });

  it('bez poznatih uzrasta dece granica uzrasta ne obara proveru (nema šta da proveri)', () => {
    expect(checkAncillaryOccupancy(svc({ priceBasis: 'PER_ROOM_PER_STAY', childMaxAge: 6.99 }), { adults: 2, children: 1 })).toBeNull();
  });
});
