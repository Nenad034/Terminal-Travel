'use client';

import { createContext, useContext, useState } from 'react';

// M17 spec "Desni panel — brzi pregled proizvoda" (26.8.2026, na zahtev vlasnika, Faza B) —
// istorija poslednja 3 proizvoda otvorena kao "brzi pregled" iz liste rezultata pretrage
// (M5 §3.0). Čisto klijentsko stanje (isti princip kao SelectionContext/RowSummaryContext) —
// samo REFERENCE (id/naziv), stvaran sadržaj (slike/opis/kontakt) učitava `ProductPreviewCard`
// (RightPanel.tsx) po aktivnoj referenci preko BFF rute, ne čuva se ovde.
export interface ProductPreviewRef {
  productId: string;
  name: string;
}

const MAX_ITEMS = 3;

interface ProductPreviewContextValue {
  items: ProductPreviewRef[];
  activeId: string | null;
  showPreview: (ref: ProductPreviewRef) => void;
  setActiveId: (id: string) => void;
}

const ProductPreviewContext = createContext<ProductPreviewContextValue | null>(null);

// `onFirstShow` otvara desni panel (Shell.tsx) — isti "pojavljuje se čim ima šta da pokaže"
// obrazac kao RowSummaryProvider/SelectionProvider.
export function ProductPreviewProvider({ children, onFirstShow }: { children: React.ReactNode; onFirstShow?: () => void }) {
  const [items, setItems] = useState<ProductPreviewRef[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  function showPreview(ref: ProductPreviewRef) {
    setItems((prev) => {
      if (prev.length === 0) onFirstShow?.();
      const withoutDup = prev.filter((i) => i.productId !== ref.productId);
      // Najnoviji na vrh, najstariji ispada kad ima više od MAX_ITEMS (26.8.2026, potvrđeno
      // vlasnikovim izborom: "max 3 taba" = istorija brzih pregleda, ne opšti limit tabova).
      return [ref, ...withoutDup].slice(0, MAX_ITEMS);
    });
    setActiveId(ref.productId);
  }

  return (
    <ProductPreviewContext.Provider value={{ items, activeId, showPreview, setActiveId }}>{children}</ProductPreviewContext.Provider>
  );
}

export function useProductPreview() {
  const ctx = useContext(ProductPreviewContext);
  if (!ctx) throw new Error('useProductPreview mora biti unutar ProductPreviewProvider');
  return ctx;
}
