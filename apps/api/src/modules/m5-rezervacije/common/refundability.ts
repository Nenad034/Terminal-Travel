// M5 spec §3.0b.2 — deterministički formula za `SearchResultOffer.is_refundable`, deljena
// između CONTRACTED (M3 CancellationRule) i API (M4 AvailabilityQuote.cancellationPolicy, isti
// pljosnat {days_before_stay, refund_percentage} oblik). Ista logika kao "podrazumevano 0%
// ako nema primenjivog pravila" u BookingsService.computeRefundPercentage (poglavlje 6) — bez
// ijednog primenjivog prozora, stavka se tretira kao nerefundabilna, nikad kao "nepoznato".

export interface RefundWindow {
  refundPercentage: number | null;
}

/** CONTRACTED — samo PRE_ARRIVAL prozori nose refund_percentage (EARLY_DEPARTURE ne, M3 spec §2.5). */
export function isRefundableFromCancellationRules(rules: { ruleType: string; refundPercentage: number | null }[]): boolean {
  const preArrival = rules.filter((r) => r.ruleType === 'PRE_ARRIVAL' && r.refundPercentage !== null);
  return preArrival.some((r) => (r.refundPercentage as number) > 0);
}

/** API — `AvailabilityQuote.cancellationPolicy` je već pljosnat niz, bez ruleType razlike. */
export function isRefundableFromQuoteCancellationPolicy(policy: RefundWindow[]): boolean {
  return policy.some((r) => (r.refundPercentage ?? 0) > 0);
}

/**
 * Grupni paket (§3.0d.6) — vlasnikova odluka (1.9.2026): najstroži sastojak odlučuje. Paket je
 * refundabilan samo ako su SVI sastojci refundabilni; čim jedan nije, ceo paket se prikazuje
 * kao nerefundabilan (nikad se ne obećava povraćaj koji agencija ne može da garantuje).
 */
export function isRefundableForPackage(componentFlags: boolean[]): boolean {
  return componentFlags.length > 0 && componentFlags.every(Boolean);
}
