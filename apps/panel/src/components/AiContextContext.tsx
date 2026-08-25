'use client';

import { createContext, useContext, useState } from 'react';

// Dizajn dok. §6c.1a, M15 spec §6.5.4.3 (25.8.2026, na zahtev vlasnika — "dodaj u AI kontekst"
// ikonica na SVAKOM redu/kartici u SVAKOM modulu, umesto desnog klika). Deljen preko cele
// aplikacije (Shell.tsx) tako da bilo koji red/kartica bilo kog ekrana može da doda stavku bez
// posebnog ožičenja po modulu — isti obrazac kao SelectionContext/RowSummaryContext.
// `RECORD` — pojedinačan zapis, agent ga sam razrešava svojim postojećim alatima (ne šalje se
// sirov podatak, samo čitljiva referenca). `FILTERED_LIST` — ceo trenutni/sačuvan filtriran
// prikaz liste, najviše jedan odjednom.
// `resultCount` opciono (dopuna 25.8.2026, uživo nalaz — vidi AiChatBox.tsx `filterableViewForPath`)
// — kad se FILTERED_LIST konstruiše iz nav-item konteksta (ne iz stvarno prikazane liste, npr.
// auto-kontekst taba ili "#" na stavci menija), klijent NE zna stvaran broj rezultata unapred
// (nema poziva serveru samo da bi se izbrojalo) — server (`omnisearch.service.ts`) već ispravno
// prikazuje "nepoznat broj rezultata" kad `resultCount` nedostaje.
// `FILE`/`IMAGE` dopuna (25.8.2026, na zahtev vlasnika — prilog fajla/slike preko "+" i
// lepljenje slike, M15 spec §6.5.4.3 v1.43). Oba TRANZIENTNA — sadržaj (izvučen tekst dokumenta
// / base64 slika) živi samo u ovom stanju pregledača, nikad se ne čuva na serveru trajno.
export type AiContextItem =
  | { id: string; type: 'RECORD'; refLabel: string }
  | { id: string; type: 'FILTERED_LIST'; view: string; filters: Record<string, unknown>; resultCount?: number; label: string }
  | { id: string; type: 'FILE'; label: string; content: string }
  | { id: string; type: 'IMAGE'; label: string; imageData: string; imageMediaType: string };

const MAX_ITEMS = 8;

interface AiContextContextValue {
  items: AiContextItem[];
  addRecord: (refLabel: string) => void;
  addFilteredList: (args: { view: string; filters: Record<string, unknown>; resultCount?: number; label: string }) => void;
  addFile: (args: { label: string; content: string }) => void;
  addImage: (args: { label: string; imageData: string; imageMediaType: string }) => void;
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

  function addFilteredList(args: { view: string; filters: Record<string, unknown>; resultCount?: number; label: string }) {
    setItems((prev) => {
      if (prev.some((i) => i.type === 'FILTERED_LIST')) return prev; // najviše jedan odjednom, M15 spec §6.5.4.3
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, { id: `filtered-${args.view}-${Date.now()}`, type: 'FILTERED_LIST', ...args }];
    });
  }

  function addFile(args: { label: string; content: string }) {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, { id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: 'FILE', ...args }];
    });
  }

  function addImage(args: { label: string; imageData: string; imageMediaType: string }) {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      if (prev.length === 0) onFirstAdd?.();
      return [...prev, { id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: 'IMAGE', ...args }];
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
        addFile,
        addImage,
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
