import { FILTER_DEFINITIONS, applicableFilters, isFilterApplicable } from './filter-definitions';

describe('isFilterApplicable (M5 spec §3.0c.3d — kontekstualni filteri po tipu destinacije i sezoni)', () => {
  it('generički filter (bez ograničenja) je uvek primenjiv', () => {
    const price = FILTER_DEFINITIONS.find((d) => d.key === 'PRICE')!;
    expect(isFilterApplicable(price, [], 7)).toBe(true);
    expect(isFilterApplicable(price, ['MOUNTAIN'], 1)).toBe(true);
  });

  it('DISTANCE_TO_SEA se prikazuje samo kad je bar jedna destinacija COASTAL, bez sezonskog uslova', () => {
    const distanceToSea = FILTER_DEFINITIONS.find((d) => d.key === 'DISTANCE_TO_SEA')!;
    expect(isFilterApplicable(distanceToSea, ['COASTAL'], 1)).toBe(true);
    expect(isFilterApplicable(distanceToSea, ['COASTAL'], 7)).toBe(true);
    expect(isFilterApplicable(distanceToSea, ['MOUNTAIN'], 7)).toBe(false);
    expect(isFilterApplicable(distanceToSea, [null], 7)).toBe(false);
  });

  // Konkretan primer iz spec-a: Bad Klajnkirhajm (Austrija, MOUNTAIN) u julu 2027 — filter se NE
  // prikazuje iako je destinacija planinska, jer jul nije zimski mesec. Oba uslova moraju proći.
  it('DISTANCE_TO_SKI_LIFT se ne prikazuje za planinsku destinaciju van zimskih meseci (Bad Klajnkirhajm, jul)', () => {
    const skiLift = FILTER_DEFINITIONS.find((d) => d.key === 'DISTANCE_TO_SKI_LIFT')!;
    expect(isFilterApplicable(skiLift, ['MOUNTAIN'], 7)).toBe(false);
  });

  it('DISTANCE_TO_SKI_LIFT se prikazuje za planinsku destinaciju tokom zimskih meseci', () => {
    const skiLift = FILTER_DEFINITIONS.find((d) => d.key === 'DISTANCE_TO_SKI_LIFT')!;
    expect(isFilterApplicable(skiLift, ['MOUNTAIN'], 12)).toBe(true);
    expect(isFilterApplicable(skiLift, ['MOUNTAIN'], 2)).toBe(true);
  });

  it('destinacija bez profila (null) se ponaša kao "nepoznat tip" — filteri sa ograničenjem se ne prikazuju', () => {
    const skiLift = FILTER_DEFINITIONS.find((d) => d.key === 'DISTANCE_TO_SKI_LIFT')!;
    expect(isFilterApplicable(skiLift, [null, null], 1)).toBe(false);
  });
});

describe('applicableFilters', () => {
  it('vraća samo generičke filtere kad nijedna destinacija nema profil', () => {
    const result = applicableFilters([null], 6);
    expect(result.map((f) => f.key)).not.toContain('DISTANCE_TO_SEA');
    expect(result.map((f) => f.key)).not.toContain('DISTANCE_TO_SKI_LIFT');
    expect(result.map((f) => f.key)).toContain('PRICE');
  });

  it('uključuje DISTANCE_TO_SEA kad je bar jedna od više destinacija COASTAL', () => {
    const result = applicableFilters(['MOUNTAIN', 'COASTAL'], 8);
    expect(result.map((f) => f.key)).toContain('DISTANCE_TO_SEA');
  });
});
