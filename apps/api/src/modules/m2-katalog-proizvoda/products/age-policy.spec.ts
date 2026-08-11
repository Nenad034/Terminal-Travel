import { AgePolicyEntry, applyDefaultAgePolicy, applyDefaultAgePolicyToRoomTypes, DEFAULT_AGE_POLICY } from './age-policy';

interface TestRoomType {
  code: string;
  name?: string;
  age_policy?: AgePolicyEntry[];
  [key: string]: unknown;
}

describe('applyDefaultAgePolicy (M2 spec §2.3b)', () => {
  it('primenjuje podrazumevani niz kad stavka nema age_policy', () => {
    const roomType: TestRoomType = { code: 'STD', name: 'Standard' };
    const result = applyDefaultAgePolicy(roomType);
    expect(result.age_policy).toEqual(DEFAULT_AGE_POLICY);
  });

  it('primenjuje podrazumevani niz kad je age_policy prazan niz', () => {
    const roomType: TestRoomType = { code: 'STD', age_policy: [] };
    expect(applyDefaultAgePolicy(roomType).age_policy).toEqual(DEFAULT_AGE_POLICY);
  });

  it('čuva eksplicitno postavljen age_policy nepromenjen (ne prepisuje ga podrazumevanim)', () => {
    const custom = [{ category: 'ADULT' as const, age_from: 14, age_to: null, counts_toward_capacity: true }];
    const roomType = { code: 'STD', age_policy: custom };
    expect(applyDefaultAgePolicy(roomType).age_policy).toEqual(custom);
  });

  it('podrazumevani INFANT ne ulazi u kapacitet (counts_toward_capacity=false)', () => {
    const infant = DEFAULT_AGE_POLICY.find((p) => p.category === 'INFANT');
    expect(infant?.counts_toward_capacity).toBe(false);
    expect(infant?.requires_crib).toBe(true);
  });

  it('podrazumevani ADULT i CHILD ulaze u kapacitet', () => {
    expect(DEFAULT_AGE_POLICY.find((p) => p.category === 'ADULT')?.counts_toward_capacity).toBe(true);
    expect(DEFAULT_AGE_POLICY.find((p) => p.category === 'CHILD')?.counts_toward_capacity).toBe(true);
  });
});

describe('applyDefaultAgePolicyToRoomTypes', () => {
  it('mapira preko niza soba, prazan niz za undefined ulaz', () => {
    expect(applyDefaultAgePolicyToRoomTypes(undefined)).toEqual([]);
    const result = applyDefaultAgePolicyToRoomTypes([{ code: 'A' }, { code: 'B', age_policy: [] }]);
    expect(result).toHaveLength(2);
    expect(result[0].age_policy).toEqual(DEFAULT_AGE_POLICY);
    expect(result[1].age_policy).toEqual(DEFAULT_AGE_POLICY);
  });
});
