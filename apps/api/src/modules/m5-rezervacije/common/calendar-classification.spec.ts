import { classifyByDay, toMidnightUtc } from './calendar-classification';

const d = (s: string) => toMidnightUtc(new Date(s));

describe('classifyByDay (M5 spec §7.1)', () => {
  it('klasifikuje dolazak', () => {
    expect(classifyByDay(d('2027-01-10'), d('2027-01-15'), d('2027-01-10'))).toBe('ARRIVAL');
  });

  it('klasifikuje odlazak', () => {
    expect(classifyByDay(d('2027-01-10'), d('2027-01-15'), d('2027-01-15'))).toBe('DEPARTURE');
  });

  it('klasifikuje boravak u toku', () => {
    expect(classifyByDay(d('2027-01-10'), d('2027-01-15'), d('2027-01-12'))).toBe('STAYOVER');
  });

  it('klasifikuje jednodnevnu stavku, ne dolazak niti odlazak', () => {
    expect(classifyByDay(d('2027-01-10'), d('2027-01-10'), d('2027-01-10'))).toBe('SINGLE_DAY');
  });

  it('baca grešku za dan van opsega', () => {
    expect(() => classifyByDay(d('2027-01-10'), d('2027-01-15'), d('2027-01-20'))).toThrow();
  });
});
