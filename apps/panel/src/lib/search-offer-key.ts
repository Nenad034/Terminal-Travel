// Jedan ključ ponude za sva tri mesta koja ga koriste: selekcija u desnom panelu
// (QuoteButton.tsx → SelectionContext), poređenje pri osvežavanju (M5 spec §3.0g.3) i
// obeležavanje promenjenih redova u listi rezultata. Spec izričito traži ISTI ključ:
// "po ključu `product_id` + `rate_line_id`/`provider_quote_reference`, isti ključ koji već
// koristi selekcija u §3.0e.3" — pa živi na jednom mestu umesto da se prepisuje.
export function offerKey(productId: string, rateLineId?: string, providerQuoteReference?: string): string {
  return `${productId}:${rateLineId ?? providerQuoteReference ?? 'na'}`;
}
