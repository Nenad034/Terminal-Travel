'use client';

import { createContext, useContext, useState } from 'react';

// M5 spec §3.0e.3 — selekcija stavki iz pretrage pre kreiranja Ponude, prikazana u desnom
// panelu (dizajn dok. §5b/§6d). Čisto klijentsko stanje (ne preživljava osvežavanje stranice),
// isti princip kao AiChatBox istorija — pravi zapis nastaje tek kad se stvarno pozove
// POST /quotes (RightPanel.tsx, "Napravi ponudu").
// Detaljna polja po sobi (dopuna 26.8.2026, na zahtev vlasnika: "u kartici u desnom panelu
// treba da pišu detaljne informacije kao i u centralnom panelu" — traži pojedinačnu cenu po
// sobi za navedeni broj osoba + ukupnu cenu). Sve OPCIONO — postojeći pravi `QuoteButton.tsx`
// (rezultati pretrage) nastavlja da radi nepromenjeno bez ovih polja; samo ih popunjava
// bogatiji izvor (za sad mock smeštaj, `AccommodationResultsMock.tsx`).
export interface SelectionRoomLine {
  adults: number;
  children: number;
  childrenAges?: number[];
  price: number;
}

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
  /** Opciono — kategorija (zvezdice), destinacija, čitljiv naziv usluge ("HB - Polupansion") i
   * razbijena cena po sobi, za bogatiji prikaz u desnom panelu (RightPanel.tsx SelectionRow). */
  stars?: number;
  destinationCity?: string;
  destinationCountry?: string;
  boardTypeLabel?: string;
  roomLines?: SelectionRoomLine[];
  /**
   * M5 spec §3.0g.3 — nalaz poslednjeg "Osveži podatke": cena ove izabrane stavke se promenila
   * ili je ponuda nestala iz odgovora. Prikazuje se NA STAVCI u desnom panelu, ne samo u listi
   * rezultata — inače agent vidi upozorenje na mestu koje je već napustio.
   */
  priceChange?: { previous: number; current: number } | 'GONE';
}

interface SelectionContextValue {
  items: SelectionItem[];
  addItem: (item: SelectionItem) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /** §3.0g.3 — upisuje nalaz osvežavanja na izabrane stavke; prazan objekat briše ranije nalaze. */
  markPriceChanges: (changes: Record<string, { previous: number; current: number } | 'GONE'>) => void;
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

  function markPriceChanges(changes: Record<string, { previous: number; current: number } | 'GONE'>) {
    setItems((prev) =>
      prev.map((i) => {
        const change = changes[i.key];
        // Cena stavke se AŽURIRA na novu (stara ostaje vidljiva kroz `priceChange.previous`) —
        // ne sme ostati prikazana cena koju provajder više ne garantuje. Ono što spec zabranjuje
        // je TIHA zamena, ne zamena uz jasnu prijavu; upravo to `priceChange` i jeste.
        if (change && change !== 'GONE') return { ...i, finalPrice: change.current, priceChange: change };
        if (change === 'GONE') return { ...i, priceChange: 'GONE' as const };
        return i.priceChange ? { ...i, priceChange: undefined } : i;
      })
    );
  }

  return (
    <SelectionContext.Provider value={{ items, addItem, removeItem, clear, markPriceChanges }}>{children}</SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection mora biti unutar SelectionProvider');
  return ctx;
}
