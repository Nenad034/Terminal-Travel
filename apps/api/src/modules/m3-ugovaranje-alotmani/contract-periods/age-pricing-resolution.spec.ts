import { resolveAgePricing, AgePricingCandidate } from './age-pricing-resolution';

describe('resolveAgePricing (M3 spec §2.4a — najspecifičniji pobeđuje)', () => {
  const exactRow: AgePricingCandidate = {
    ageCategory: 'CHILD',
    occupantIndex: 1,
    minAdultsPresent: null,
    pricingMode: 'PERCENTAGE_OF_BASE_PRICE',
    percentage: 0,
    flatPrice: null,
  };
  const defaultRow: AgePricingCandidate = {
    ageCategory: 'CHILD',
    occupantIndex: null,
    minAdultsPresent: null,
    pricingMode: 'PERCENTAGE_OF_BASE_PRICE',
    percentage: 50,
    flatPrice: null,
  };
  const conditionalRow: AgePricingCandidate = {
    ageCategory: 'CHILD',
    occupantIndex: null,
    minAdultsPresent: 2,
    pricingMode: 'FLAT_PRICE_PER_NIGHT',
    flatPrice: 0,
    percentage: null,
  };

  it('gost sa tačnim occupant_index dobija taj red, ne podrazumevani (izlazni kriterijum §7)', () => {
    const result = resolveAgePricing([exactRow, defaultRow], 'CHILD', 1, 2);
    expect(result).toBe(exactRow);
  });

  it('bez tačnog occupant_index, ali sa zadovoljenim min_adults_present, koristi uslovljeni red', () => {
    const result = resolveAgePricing([defaultRow, conditionalRow], 'CHILD', 2, 2);
    expect(result).toBe(conditionalRow);
  });

  it('kad min_adults_present nije zadovoljen, pada na podrazumevani red', () => {
    const result = resolveAgePricing([defaultRow, conditionalRow], 'CHILD', 2, 1); // samo 1 odrasla osoba, treba 2
    expect(result).toBe(defaultRow);
  });

  it('bira najviši zadovoljen min_adults_present kad ih ima više', () => {
    const higherThreshold: AgePricingCandidate = { ...conditionalRow, minAdultsPresent: 3, flatPrice: 999 };
    const result = resolveAgePricing([conditionalRow, higherThreshold], 'CHILD', 2, 3);
    expect(result).toBe(higherThreshold);
  });

  it('vraća null kad nijedan red ne odgovara kategoriji (nikad ne pretpostavlja cenu, §2.4a ograda)', () => {
    const result = resolveAgePricing([exactRow], 'INFANT', 1, 2);
    expect(result).toBeNull();
  });

  it('ignoriše redove druge uzrasne kategorije', () => {
    const adultRow: AgePricingCandidate = { ...defaultRow, ageCategory: 'ADULT', percentage: 100 };
    const result = resolveAgePricing([adultRow], 'CHILD', 1, 2);
    expect(result).toBeNull();
  });
});
