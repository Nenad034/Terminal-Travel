'use client';

import { createContext, useContext, useState } from 'react';

// Dizajn dok. §5b — desni panel, "sažetak reda kad je centar lista i korisnik klikne red bez
// ulaska u pun zapis" (18.8.2026 dopuna — polje-lista tamo: "npr. broj rezervacije/profakture,
// gost, datum, status, iznos"). Do 23.8.2026 nijedan ekran nije slao sadržaj ovamo (RightPanel.tsx
// komentar) — ovo je PRVI izvor, na zahtev vlasnika ("kada kliknemo na neki red iz liste
// rezervacija u desnom panelu treba da se prikazu sve najvaznije informacije"). Namerno ODVOJENO
// od `SelectionContext` (M5 §3.0e.3 — stavke IZ PRETRAGE pre kreiranja Ponude) — različita svrha,
// različit oblik podataka; `RightPanel.tsx` prikazuje selekciju AKO ima stavki, inače sažetak reda.
// Dopuna (23.8.2026, na zahtev vlasnika: "Svuda Prikazati da li je osoba odrasla osoba, dete
// ili beba (navesti i godine rodjenja za decu i bebe, a za odrasle samo ukoliko je taj podatak
// unet)") — isti oblik kao `MockBookingRow.Traveler` (rezervacije/lista/mock-data.ts), namerno
// redefinisan ovde (ne uvoze se mock tipovi u deljenu komponentu) da ovaj kontekst radi i sa
// pravim API odgovorom kad lista dobije stvarne podatke.
export interface Traveler {
  name: string;
  ageCategory: 'ADULT' | 'CHILD' | 'BABY';
  birthYear?: number;
}

export interface BookingRowSummary {
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
  travelers?: Traveler[];
  paidAmount?: number;
  owedAmount?: number;
  branch?: string;
  assignedUser?: string;
}

// M17 spec dopuna (27.8.2026, na zahtev vlasnika: "kada kliknemo na stavku kalendara u desnom
// panelu treba da se pojavi sumarni izveštaj koliko rezervacija, statusi, koje destinacije,
// koliko osoba, koliko soba, da li ima i koliko rezervacija sa alertima") — agregat preko SVIH
// stavki jednog dana u kalendaru (M5 spec §7.4), namerno DRUGI `kind` u istom kontekstu
// (RightPanel.tsx grana prikaz po `summary.kind`) — ista "klik pokazuje sažetak ovde" ideja kao
// `BookingRowSummary`, samo agregat umesto jednog reda. Dodate dve autorske dopune (na zahtev
// vlasnika: "možete i vi dodati nešto") — raščlanjena vrednost po valuti i po tipu proizvoda,
// oboje odsutno iz eksplicitnog zahteva ali direktno korisno uz "koliko rezervacija/destinacija".
export interface CalendarDaySummary {
  kind: 'calendar-day';
  date: string;
  bookingCount: number;
  itemCount: number;
  statusCounts: Record<string, number>;
  destinationCounts: Record<string, number>;
  productTypeCounts: Record<string, number>;
  totalGuests: number;
  totalRooms: number;
  valueByCurrency: Record<string, number>;
  supplierPendingCount: number;
  unpaidCount: number;
}

// M18 spec §9a dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu od stavki u
// procesnim mapama u desnom panelu treba da se prikaze vise detalja") — isti "klik pokazuje
// sažetak ovde" obrazac kao BookingRowSummary/CalendarDaySummary, treći `kind` u istom
// kontekstu. `ProcessMapView.tsx` puni ovo pri kliku na čvor umesto da odmah navigira na pun
// audit log — pun log ostaje dostupan preko dugmeta u kartici (RightPanel.tsx).
export interface ProcessMapNodeSummary {
  kind: 'process-map-node';
  mapKey: string;
  mapLabel: string;
  module: string;
  nodeId: string;
  nodeLabel: string;
  matchActions: string[];
  count: number;
  capped: boolean;
  lastAt: string | null;
}

export type RowSummary = BookingRowSummary | CalendarDaySummary | ProcessMapNodeSummary;

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
