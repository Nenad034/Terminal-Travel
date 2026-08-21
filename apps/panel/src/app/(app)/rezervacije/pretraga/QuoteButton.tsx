'use client';

import { useSelection } from '@/components/SelectionContext';

// M5 spec §3.0e.3 — "Dodaj" stavlja stavku u selekciju (desni panel), ne kreira Ponudu
// odmah (ranije ponašanje, do 21.8.2026). Kreiranje Ponude je sad jedan zajednički korak
// za celu selekciju (RightPanel.tsx, "Napravi ponudu") — čisto klijentsko stanje, bez
// poziva serveru dok se selekcija ne pretvori u pravu Ponudu.
export default function QuoteButton(props: {
  productId: string;
  productName: string;
  productType: string;
  sourceType: string;
  rateLineId?: string;
  providerQuoteReference?: string;
  stayFrom?: string;
  stayTo?: string;
  adults: number;
  children: number;
  finalPrice: number;
  finalPriceCurrency: string;
  quoteExpiresAt?: string;
}) {
  const { items, addItem } = useSelection();
  const key = `${props.productId}:${props.rateLineId ?? props.providerQuoteReference ?? 'na'}`;
  const added = items.some((i) => i.key === key);

  return (
    <button
      type="button"
      disabled={added}
      onClick={() =>
        addItem({
          key,
          productId: props.productId,
          productName: props.productName,
          productType: props.productType,
          sourceType: props.sourceType,
          rateLineId: props.rateLineId,
          providerQuoteReference: props.providerQuoteReference,
          stayFrom: props.stayFrom,
          stayTo: props.stayTo,
          adults: props.adults,
          children: props.children,
          finalPrice: props.finalPrice,
          finalPriceCurrency: props.finalPriceCurrency,
          quoteExpiresAt: props.quoteExpiresAt,
        })
      }
      className="rounded bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {added ? 'dodato' : 'dodaj'}
    </button>
  );
}
