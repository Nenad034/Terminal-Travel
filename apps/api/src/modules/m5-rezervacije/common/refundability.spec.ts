import { isRefundableForPackage, isRefundableFromCancellationRules, isRefundableFromQuoteCancellationPolicy } from './refundability';

describe('isRefundableFromCancellationRules (CONTRACTED, M5 spec §3.0b.2)', () => {
  it('vraća true kad bar jedan PRE_ARRIVAL prozor ima refund_percentage > 0', () => {
    expect(
      isRefundableFromCancellationRules([
        { ruleType: 'PRE_ARRIVAL', refundPercentage: 0 },
        { ruleType: 'PRE_ARRIVAL', refundPercentage: 50 },
      ]),
    ).toBe(true);
  });

  it('vraća false kad su svi PRE_ARRIVAL prozori 0% (potpuno nerefundabilna tarifa)', () => {
    expect(
      isRefundableFromCancellationRules([
        { ruleType: 'PRE_ARRIVAL', refundPercentage: 0 },
        { ruleType: 'PRE_ARRIVAL', refundPercentage: 0 },
      ]),
    ).toBe(false);
  });

  it('vraća false kad nema nijednog pravila (isti default kao BookingsService.computeRefundPercentage)', () => {
    expect(isRefundableFromCancellationRules([])).toBe(false);
  });

  it('ignoriše EARLY_DEPARTURE prozore (M3 spec §2.5 — nemaju refund_percentage semantiku)', () => {
    expect(
      isRefundableFromCancellationRules([{ ruleType: 'EARLY_DEPARTURE', refundPercentage: null }]),
    ).toBe(false);
  });
});

describe('isRefundableFromQuoteCancellationPolicy (API, M4 AvailabilityQuote)', () => {
  it('vraća true kad bar jedan prozor ima refund_percentage > 0', () => {
    expect(isRefundableFromQuoteCancellationPolicy([{ refundPercentage: 0 }, { refundPercentage: 75 }])).toBe(true);
  });

  it('vraća false za praznu politiku otkazivanja', () => {
    expect(isRefundableFromQuoteCancellationPolicy([])).toBe(false);
  });
});

describe('isRefundableForPackage (grupni paket, vlasnikova odluka 1.9.2026 — najstroži sastojak odlučuje)', () => {
  it('vraća true samo ako su SVI sastojci refundabilni', () => {
    expect(isRefundableForPackage([true, true, true])).toBe(true);
  });

  it('vraća false čim je bar jedan sastojak nerefundabilan', () => {
    expect(isRefundableForPackage([true, false, true])).toBe(false);
  });

  it('vraća false za prazan niz sastojaka (nema šta da bude refundabilno)', () => {
    expect(isRefundableForPackage([])).toBe(false);
  });
});
