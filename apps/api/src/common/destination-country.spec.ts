import { needsCountryNormalization, normalizeDestinationCountry } from './destination-country';

// M2 spec §2.1 — jedan oblik naziva države kroz ceo sistem (vlasnikova odluka 3.9.2026).
describe('normalizeDestinationCountry', () => {
  it('svodi ISO kod na naziv koji TT koristi', () => {
    expect(normalizeDestinationCountry('RS')).toBe('Srbija');
    expect(normalizeDestinationCountry('ME')).toBe('Crna Gora');
    expect(normalizeDestinationCountry('gr')).toBe('Grčka');
  });

  it('ujednačava različite zapise istog naziva', () => {
    expect(normalizeDestinationCountry('crna gora')).toBe('Crna Gora');
    expect(normalizeDestinationCountry('  Srbija  ')).toBe('Srbija');
    expect(normalizeDestinationCountry('Crna   Gora')).toBe('Crna Gora');
  });

  it('NE pogađa nepoznatu vrednost — vraća je netaknutu', () => {
    // Tiho "popravljanje" bi proizvod premestilo u pogrešnu državu; nesređen podatak se vidi,
    // pogrešan ne.
    expect(normalizeDestinationCountry('Zanzibar')).toBe('Zanzibar');
    expect(normalizeDestinationCountry('XX')).toBe('XX');
  });

  it('prazno i nedostajuće prolazi bez izmene', () => {
    expect(normalizeDestinationCountry(null)).toBeNull();
    expect(normalizeDestinationCountry(undefined)).toBeUndefined();
    expect(normalizeDestinationCountry('')).toBe('');
  });

  it('needsCountryNormalization prijavljuje samo stvarnu razliku', () => {
    expect(needsCountryNormalization('RS')).toBe(true);
    expect(needsCountryNormalization('Srbija')).toBe(false);
    expect(needsCountryNormalization(null)).toBe(false);
  });
});
