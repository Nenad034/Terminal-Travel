import { bookingWindowOpen, nightsBetween } from './day-capacity';

describe('nightsBetween (M3 spec §2.8c — noć odjave se ne broji)', () => {
  it('boravak 15.–18. daje tri noći, ne četiri', () => {
    expect(nightsBetween(new Date('2027-07-15'), new Date('2027-07-18'))).toEqual([
      '2027-07-15',
      '2027-07-16',
      '2027-07-17',
    ]);
  });

  it('jedno noćenje daje tačno jedan dan', () => {
    expect(nightsBetween(new Date('2027-07-15'), new Date('2027-07-16'))).toEqual(['2027-07-15']);
  });

  it('isti dan dolaska i odlaska ne daje nijednu noć', () => {
    expect(nightsBetween(new Date('2027-07-15'), new Date('2027-07-15'))).toEqual([]);
  });

  it('prelazak preko kraja meseca ne preskače dan', () => {
    expect(nightsBetween(new Date('2027-07-30'), new Date('2027-08-02'))).toEqual([
      '2027-07-30',
      '2027-07-31',
      '2027-08-01',
    ]);
  });
});

describe('bookingWindowOpen (M3 spec §2.3e.4 — prozor prijave)', () => {
  const bezProzora = { bookingFrom: null, bookingTo: null };

  it('period bez prozora prima prijavu bilo kada', () => {
    expect(bookingWindowOpen(bezProzora, new Date('2027-05-20'))).toBe(true);
  });

  it('prijava na poslednji dan prozora je unutra (prozor je inkluzivan)', () => {
    const p = { bookingFrom: new Date('2027-01-01'), bookingTo: new Date('2027-03-31') };
    expect(bookingWindowOpen(p, new Date('2027-03-31'))).toBe(true);
  });

  it('prijava dan posle zatvaranja prozora je van njega', () => {
    const p = { bookingFrom: new Date('2027-01-01'), bookingTo: new Date('2027-03-31') };
    expect(bookingWindowOpen(p, new Date('2027-04-01'))).toBe(false);
  });

  it('prijava pre otvaranja prozora je van njega', () => {
    const p = { bookingFrom: new Date('2027-04-01'), bookingTo: null };
    expect(bookingWindowOpen(p, new Date('2027-03-31'))).toBe(false);
  });

  it('vreme u danu prijave ne pomera granicu (poredi se datum, ne trenutak)', () => {
    const p = { bookingFrom: null, bookingTo: new Date('2027-03-31') };
    expect(bookingWindowOpen(p, new Date('2027-03-31T23:59:00Z'))).toBe(true);
  });
});
