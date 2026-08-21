'use client';

import { createContext, useContext, useState } from 'react';

// M5 spec §3.0e.3 — selekcija stavki iz pretrage pre kreiranja Ponude, prikazana u desnom
// panelu (dizajn dok. §5b/§6d). Čisto klijentsko stanje (ne preživljava osvežavanje stranice),
// isti princip kao AiChatBox istorija — pravi zapis nastaje tek kad se stvarno pozove
// POST /quotes (RightPanel.tsx, "Napravi ponudu").
export interface SelectionItem {
  key: string;
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
}

interface SelectionContextValue {
  items: SelectionItem[];
  addItem: (item: SelectionItem) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

// `onFirstAdd` otvara desni panel (Shell.tsx) — M5 spec §3.0e.1 "sistem ODMAH predlaže" isti
// duh, ovde: panel se pojavljuje čim ima šta da pokaže, ne pre. Prema potrebi, ne unapred.
export function SelectionProvider({ children, onFirstAdd }: { children: React.ReactNode; onFirstAdd?: () => void }) {
  const [items, setItems] = useState<SelectionItem[]>([]);

  function addItem(item: SelectionItem) {
    setItems((prev) => {
      if (prev.some((i) => i.key === item.key)) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, item];
    });
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }
  function clear() {
    setItems([]);
  }

  return <SelectionContext.Provider value={{ items, addItem, removeItem, clear }}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection mora biti unutar SelectionProvider');
  return ctx;
}
