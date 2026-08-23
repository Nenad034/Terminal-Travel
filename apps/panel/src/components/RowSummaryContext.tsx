'use client';

import { createContext, useContext, useState } from 'react';

// Dizajn dok. §5b — desni panel, "sažetak reda kad je centar lista i korisnik klikne red bez
// ulaska u pun zapis" (18.8.2026 dopuna — polje-lista tamo: "npr. broj rezervacije/profakture,
// gost, datum, status, iznos"). Do 23.8.2026 nijedan ekran nije slao sadržaj ovamo (RightPanel.tsx
// komentar) — ovo je PRVI izvor, na zahtev vlasnika ("kada kliknemo na neki red iz liste
// rezervacija u desnom panelu treba da se prikazu sve najvaznije informacije"). Namerno ODVOJENO
// od `SelectionContext` (M5 §3.0e.3 — stavke IZ PRETRAGE pre kreiranja Ponude) — različita svrha,
// različit oblik podataka; `RightPanel.tsx` prikazuje selekciju AKO ima stavki, inače sažetak reda.
export interface RowSummary {
  kind: 'booking';
  bookingNumber: string;
  buyerName: string;
  status: string;
  paymentStatus: string;
  stayFrom: string;
  stayTo: string;
  totalPrice: number;
  currency: string;
  country?: string;
  destinationCity?: string;
  hotelName?: string;
  accommodationType?: string;
  travelers?: string[];
  paidAmount?: number;
  owedAmount?: number;
}

interface RowSummaryContextValue {
  summary: RowSummary | null;
  showSummary: (s: RowSummary) => void;
  clearSummary: () => void;
}

const RowSummaryContext = createContext<RowSummaryContextValue | null>(null);

// `onFirstShow` otvara desni panel (Shell.tsx) — isti "pojavljuje se čim ima šta da pokaže"
// obrazac kao `SelectionProvider.onFirstAdd`.
export function RowSummaryProvider({ children, onFirstShow }: { children: React.ReactNode; onFirstShow?: () => void }) {
  const [summary, setSummary] = useState<RowSummary | null>(null);

  function showSummary(s: RowSummary) {
    if (summary === null) onFirstShow?.();
    setSummary(s);
  }
  function clearSummary() {
    setSummary(null);
  }

  return <RowSummaryContext.Provider value={{ summary, showSummary, clearSummary }}>{children}</RowSummaryContext.Provider>;
}

export function useRowSummary() {
  const ctx = useContext(RowSummaryContext);
  if (!ctx) throw new Error('useRowSummary mora biti unutar RowSummaryProvider');
  return ctx;
}
