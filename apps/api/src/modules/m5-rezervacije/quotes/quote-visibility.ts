// M5 spec §6.2 / M2 spec §5.1 — "identitet dobavljača se nikad ne izlaže B2C/B2B/gost
// kanalima." Isti whitelist princip kao `booking-visibility.ts` (poglavlje 6.2) — dodato
// 28.8.2026, bezbednosni nalaz pre lansiranja: `GET /sales/quotes/:id` do sada NIJE maskirao
// odgovor uopšte, pa je svaki neinterni pozivalac (B2C gost, B2B subagent preko M7, MCP klijent
// preko M16) dobijao `baseCost`/`markupRuleId`/`providerQuoteReference` — tačno ono što §6.2
// zabranjuje.

import type { M5CallerContext } from '../common/resolve-api-context';

export interface RawQuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  sourceType: string;
  stayFrom: Date;
  stayTo: Date;
  occupancy: unknown;
  baseCost: number;
  baseCostCurrency: string;
  rateLineId: string | null;
  markupRuleId: string | null;
  finalPrice: number;
  finalPriceCurrency: string;
  providerQuoteReference: string | null;
  unitCount: number;
  cancellationPolicySnapshot: unknown;
  [key: string]: unknown;
}

// Polja koja sme da vidi gost/B2B subagent/MCP klijent — proizvod, datumi, cena za njega,
// uslovi otkazivanja koje treba da zna. Nikad baseCost/markupRuleId/rateLineId/
// providerQuoteReference (M3/M4 nabavni/interni podaci).
export function toPublicQuoteItem(item: RawQuoteItem) {
  return {
    id: item.id,
    productId: item.productId,
    sourceType: item.sourceType,
    stayFrom: item.stayFrom,
    stayTo: item.stayTo,
    occupancy: item.occupancy,
    finalPrice: item.finalPrice,
    finalPriceCurrency: item.finalPriceCurrency,
    unitCount: item.unitCount,
    cancellationPolicySnapshot: item.cancellationPolicySnapshot,
  };
}

export function toInternalQuoteItem(item: RawQuoteItem) {
  return item;
}

export function serializeQuoteItem(item: RawQuoteItem, context: M5CallerContext) {
  return context === 'INTERNAL_PANEL' ? toInternalQuoteItem(item) : toPublicQuoteItem(item);
}

export interface RawQuote {
  items: RawQuoteItem[];
  [key: string]: unknown;
}

export function serializeQuote(quote: RawQuote, context: M5CallerContext) {
  return {
    ...quote,
    items: quote.items.map((item) => serializeQuoteItem(item, context)),
  };
}
