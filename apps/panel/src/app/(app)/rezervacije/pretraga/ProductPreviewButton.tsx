'use client';

import { useProductPreview } from '@/components/ProductPreviewContext';

// M17 spec "Desni panel — brzi pregled proizvoda" (26.8.2026, Faza B) — klik na naziv
// proizvoda u rezultatima pretrage prikazuje slike/opis u desnom panelu (ProductPreviewCard),
// bez napuštanja liste rezultata. Isti obrazac kao QuoteButton.tsx (mali klijentski dugme u
// server-renderovanoj listi, potrošač deljenog konteksta).
export default function ProductPreviewButton({ productId, name, className }: { productId: string; name: string; className: string }) {
  const { showPreview } = useProductPreview();
  return (
    <button type="button" onClick={() => showPreview({ productId, name })} className={className}>
      {name}
    </button>
  );
}
