'use client';

import { createContext, useContext, useState } from 'react';

// Dizajn dok. §6c.1a, M15 spec §6.5.4.3 (25.8.2026, na zahtev vlasnika — "dodaj u AI kontekst"
// ikonica na SVAKOM redu/kartici u SVAKOM modulu, umesto desnog klika). Deljen preko cele
// aplikacije (Shell.tsx) tako da bilo koji red/kartica bilo kog ekrana može da doda stavku bez
// posebnog ožičenja po modulu — isti obrazac kao SelectionContext/RowSummaryContext.
// `RECORD` — pojedinačan zapis, agent ga sam razrešava svojim postojećim alatima (ne šalje se
// sirov podatak, samo čitljiva referenca). `FILTERED_LIST` — ceo trenutni/sačuvan filtriran
// prikaz liste, najviše jedan odjednom.
export type AiContextItem =
  | { id: string; type: 'RECORD'; refLabel: string }
  | { id: string; type: 'FILTERED_LIST'; view: string; filters: Record<string, unknown>; resultCount: number; label: string };

const MAX_ITEMS = 8;

interface AiContextContextValue {
  items: AiContextItem[];
  addRecord: (refLabel: string) => void;
  addFilteredList: (args: { view: string; filters: Record<string, unknown>; resultCount: number; label: string }) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  atCapacity: boolean;
  hasFilteredList: boolean;
}

const AiContextContext = createContext<AiContextContextValue | null>(null);

// `onFirstAdd` otvara/prikazuje AI chat prozor (Shell.tsx) — isti "pojavljuje se čim ima šta da
// pokaže" obrazac kao SelectionProvider/RowSummaryProvider.
export function AiContextProvider({ children, onFirstAdd }: { children: React.ReactNode; onFirstAdd?: () => void }) {
  const [items, setItems] = useState<AiContextItem[]>([]);

  function addRecord(refLabel: string) {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.some((i) => i.type === 'RECORD' && i.refLabel === refLabel)) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, { id: `record-${refLabel}-${Date.now()}`, type: 'RECORD', refLabel }];
    });
  }

  function addFilteredList(args: { view: string; filters: Record<string, unknown>; resultCount: number; label: string }) {
    setItems((prev) => {
      if (prev.some((i) => i.type === 'FILTERED_LIST')) return prev; // najviše jedan odjednom, M15 spec §6.5.4.3
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, { id: `filtered-${args.view}-${Date.now()}`, type: 'FILTERED_LIST', ...args }];
    });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clear() {
    setItems([]);
  }

  return (
    <AiContextContext.Provider
      value={{
        items,
        addRecord,
        addFilteredList,
        removeItem,
        clear,
        atCapacity: items.length >= MAX_ITEMS,
        hasFilteredList: items.some((i) => i.type === 'FILTERED_LIST'),
      }}
    >
      {children}
    </AiContextContext.Provider>
  );
}

export function useAiContext() {
  const ctx = useContext(AiContextContext);
  if (!ctx) throw new Error('useAiContext mora biti unutar AiContextProvider');
  return ctx;
}
