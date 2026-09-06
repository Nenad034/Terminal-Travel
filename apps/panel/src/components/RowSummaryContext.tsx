'use client';

import { createContext, useContext, useState } from 'react';
import { useTabs } from './TabsContext';

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
  // Interni ID reda iz baze (5.9.2026) — bez njega je sazetak mogao da otvori pun zapis SAMO po
  // broju rezervacije, sto je vodilo na staru mock pod-rutu `/rezervacije/lista/<broj>`; pravi
  // zapis (`/rezervacije/<id>`, poglavlje 6 M5 spec) trazi ID. Opciono jer stari mock izvor
  // (`BookingsTable.tsx`) ID nema — kad nedostaje, dugme "Otvori pun zapis" se ne prikazuje,
  // umesto da vodi na ekran koji ce reci "nije pronadjena".
  bookingId?: string;
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
  lastAt: string | null;
}

// M1 spec §7 dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu stavku iz ovakvih
// lista da se otvori desni panel sa detaljnim informacijama" — potvrđeno da važi i za sam audit
// log, ne samo za čvorove procesne mape). Isti obrazac, četvrti `kind` — `before_state`/
// `after_state` su ovde nesređen JSON (šta god je zapisano pri upisu), prikazuju se kao takvi.
export interface AuditLogEntrySummary {
  kind: 'audit-log-entry';
  id: string;
  timestamp: string;
  module: string;
  action: string;
  actorType: string;
  actorId: string | null;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  context?: unknown;
}

export type RowSummary = BookingRowSummary | CalendarDaySummary | ProcessMapNodeSummary | AuditLogEntrySummary;

interface RowSummaryContextValue {
  summary: RowSummary | null;
  showSummary: (s: RowSummary) => void;
  clearSummary: () => void;
}

const RowSummaryContext = createContext<RowSummaryContextValue | null>(null);

// `onFirstShow` otvara desni panel (Shell.tsx) — isti "pojavljuje se čim ima šta da pokaže"
// obrazac kao `SelectionProvider.onFirstAdd`.
//
// Po TABU, ne globalno (M17 spec v2.58, 5.9.2026, vlasnikov nalaz: "u desnom panelu treba da se
// vidi brz prikaz podataka iz taba u kom se korisnik trenutno nalazi... ne treba da se vide
// podaci iz pretrage rezervacija ako se korisnik nalazi u tabu kalendar rezervacija"). Ranije je
// `summary` bio JEDAN globalan objekat — klik na dan u Kalendaru i klik na red u Pretrazi su OBOJE
// u istom modulu "Prodaja" (v2.10), pa je poslednji upisan sažetak ostajao vidljiv u SVA tri taba
// tog modula (kalendar/pretraga/lista), bez obzira gde je korisnik stvarno bio. `summariesByTab`
// je ključan `activeTabId`-jem iz `TabsContext.tsx` (`RowSummaryProvider` je već ugnježden unutar
// `TabsProvider`-a u Shell.tsx, pa `useTabs()` ovde ne uvodi novu zavisnost) — `summary` koji se
// izlaže spolja ostaje ISTA jednostavna vrednost (`Record` slice za trenutan tab), pa `RightPanel.tsx`
// nije morao da se menja.
export function RowSummaryProvider({ children, onFirstShow }: { children: React.ReactNode; onFirstShow?: () => void }) {
  const { activeTabId } = useTabs();
  const [summariesByTab, setSummariesByTab] = useState<Record<string, RowSummary>>({});
  const summary = summariesByTab[activeTabId] ?? null;

  function showSummary(s: RowSummary) {
    if (summary === null) onFirstShow?.();
    setSummariesByTab((prev) => ({ ...prev, [activeTabId]: s }));
  }
  function clearSummary() {
    setSummariesByTab((prev) => {
      if (!(activeTabId in prev)) return prev;
      const next = { ...prev };
      delete next[activeTabId];
      return next;
    });
  }

  return <RowSummaryContext.Provider value={{ summary, showSummary, clearSummary }}>{children}</RowSummaryContext.Provider>;
}

export function useRowSummary() {
  const ctx = useContext(RowSummaryContext);
  if (!ctx) throw new Error('useRowSummary mora biti unutar RowSummaryProvider');
  return ctx;
}
