'use client';

import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';

// MOCK — čeka potvrdu izgleda pre prave žice (29.8.2026, na zahtev vlasnika: "dodajte mock
// podatke za pretragu letova, transfera i izleta da bih video kako sve radi", isti obrazac kao
// `AccommodationResultsMock.tsx`). Prikaz reda liči na uobičajen prikaz pretrage letova (vreme
// poletanja/sletanja, trajanje, broj presedanja, klasa) — `GET /search` (M5 spec §11) danas ne
// razlikuje ova polja od ostalih tipova (isti `SearchResultOffer` oblik za sve), zato mock ovde
// hardkoduje sopstveni, bogatiji oblik dok prava žica (M4 provajder odgovor za FLIGHT) ne stigne
// do istog nivoa detalja.
interface MockFlight {
  id: string;
  airline: string;
  flightNumber: string;
  fromCity: string;
  fromCode: string;
  toCity: string;
  toCode: string;
  departTime: string;
  arriveTime: string;
  durationLabel: string;
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
}

const CABIN_CLASS_LABELS: Record<string, string> = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

const MOCK_FLIGHTS: MockFlight[] = [
  {
    id: 'mock-f1',
    airline: 'Air Serbia',
    flightNumber: 'JU 322',
    fromCity: 'Beograd',
    fromCode: 'BEG',
    toCity: 'Atina',
    toCode: 'ATH',
    departTime: '07:15',
    arriveTime: '09:05',
    durationLabel: '1h 50min',
    stops: 0,
    cabinClass: 'ECONOMY',
    price: 18900,
    currency: 'EUR',
  },
  {
    id: 'mock-f2',
    airline: 'Aegean Airlines',
    flightNumber: 'A3 812',
    fromCity: 'Beograd',
    fromCode: 'BEG',
    toCity: 'Atina',
    toCode: 'ATH',
    departTime: '13:40',
    arriveTime: '15:35',
    durationLabel: '1h 55min',
    stops: 0,
    cabinClass: 'ECONOMY',
    price: 16700,
    currency: 'EUR',
  },
  {
    id: 'mock-f3',
    airline: 'Wizz Air',
    flightNumber: 'W6 4301',
    fromCity: 'Beograd',
    fromCode: 'BEG',
    toCity: 'Atina',
    toCode: 'ATH',
    departTime: '19:20',
    arriveTime: '23:10',
    durationLabel: '3h 50min',
    stops: 1,
    cabinClass: 'ECONOMY',
    price: 9900,
    currency: 'EUR',
  },
  {
    id: 'mock-f4',
    airline: 'Air Serbia',
    flightNumber: 'JU 322',
    fromCity: 'Beograd',
    fromCode: 'BEG',
    toCity: 'Atina',
    toCode: 'ATH',
    departTime: '07:15',
    arriveTime: '09:05',
    durationLabel: '1h 50min',
    stops: 0,
    cabinClass: 'BUSINESS',
    price: 42300,
    currency: 'EUR',
  },
];

function money(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

export default function FlightResultsMock({
  cabinClass,
  priceMin,
  priceMax,
}: {
  cabinClass?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}) {
  const { items, addItem } = useSelection();

  const flights = MOCK_FLIGHTS.filter((f) => {
    if (cabinClass && f.cabinClass !== cabinClass) return false;
    if (priceMin != null && f.price < priceMin) return false;
    if (priceMax != null && f.price > priceMax) return false;
    return true;
  }).sort((a, b) => a.price - b.price);

  function select(f: MockFlight) {
    if (items.some((i) => i.key === f.id)) return;
    addItem({
      key: f.id,
      productId: f.id,
      productName: `${f.airline} ${f.flightNumber} — ${f.fromCity} → ${f.toCity}`,
      productType: 'FLIGHT',
      sourceType: 'API',
      adults: 1,
      children: 0,
      finalPrice: f.price,
      finalPriceCurrency: f.currency,
      destinationCity: f.toCity,
      boardTypeLabel: `${f.departTime}–${f.arriveTime} · ${f.durationLabel} · ${f.stops === 0 ? 'direktan' : `${f.stops} presedanje`} · ${CABIN_CLASS_LABELS[f.cabinClass]}`,
    });
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
        MOCK — hardkodovani letovi, čeka potvrdu izgleda pre prave žice na `GET /search`.
      </div>

      {flights.length === 0 ? (
        <p className="text-center text-xs text-ink-faint">Nema letova za zadate kriterijume.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {flights.map((f) => {
            const selected = items.some((i) => i.key === f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => select(f)}
                disabled={selected}
                className={`flex items-center gap-4 rounded-lg border bg-panel p-3 text-left ${
                  selected ? 'border-accent bg-accent-soft/40' : 'border-border hover:border-accent'
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-accent">
                  <Icon name="rocket" />
                </div>
                <div className="w-32 flex-shrink-0 text-xs text-ink-dim">
                  <div className="font-medium text-ink">{f.airline}</div>
                  <div className="text-ink-faint">{f.flightNumber}</div>
                </div>
                <div className="flex flex-1 items-center gap-3 text-sm">
                  <div className="text-right">
                    <div className="font-mono font-semibold text-ink">{f.departTime}</div>
                    <div className="text-[11px] text-ink-faint">{f.fromCode}</div>
                  </div>
                  <div className="flex flex-1 flex-col items-center text-[11px] text-ink-faint">
                    <span>{f.durationLabel}</span>
                    <div className="h-px w-full bg-border" />
                    <span>{f.stops === 0 ? 'direktan' : `${f.stops} presedanje`}</span>
                  </div>
                  <div>
                    <div className="font-mono font-semibold text-ink">{f.arriveTime}</div>
                    <div className="text-[11px] text-ink-faint">{f.toCode}</div>
                  </div>
                </div>
                <div className="w-24 flex-shrink-0 text-[11px] text-ink-faint">{CABIN_CLASS_LABELS[f.cabinClass]}</div>
                <div className="flex-shrink-0 font-mono text-sm font-semibold text-ink">
                  {selected ? '✓ ' : ''}
                  {money(f.price, f.currency)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
