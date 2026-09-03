'use client';

import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';
import { MOCK_FLIGHTS, applyFlightFilters, flightFiltersFromParams, minutesOfDay, type MockFlight } from '@/lib/mock-flights';
import { flightBestScore } from '@/lib/search-sort';
import { useSearchFilters } from '@/components/SearchFiltersContext';
import { commonFiltersFrom } from '@/lib/search-filters';

// MOCK — čeka potvrdu izgleda pre prave žice (29.8.2026, na zahtev vlasnika: "dodajte mock
// podatke za pretragu letova, transfera i izleta da bih video kako sve radi", isti obrazac kao
// `AccommodationResultsMock.tsx`). Prikaz reda liči na uobičajen prikaz pretrage letova (vreme
// poletanja/sletanja, trajanje, broj presedanja, klasa) — `GET /search` (M5 spec §11) danas ne
// razlikuje ova polja od ostalih tipova (isti `SearchResultOffer` oblik za sve), zato mock ovde
// hardkoduje sopstveni, bogatiji oblik dok prava žica (M4 provajder odgovor za FLIGHT) ne stigne
// do istog nivoa detalja.
const CABIN_CLASS_LABELS: Record<string, string> = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

function money(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

function codeFor(city: string, fallback: string): string {
  return city.trim() ? city.trim().slice(0, 3).toUpperCase() : fallback;
}

interface FlightLeg {
  originCity: string;
  destinationCity: string;
  date: string;
}

export default function FlightResultsMock({
  stayFrom,
  returnDate,
  tripType,
  originCity,
  destinationCity,
  flightLegs,
  cabinClass,
  sort,
}: {
  /** Datum poletanja prve/jedine noge (M5 spec §3.0d.1 — `stay_from` = datum leta). */
  stayFrom?: string;
  /** Samo za ROUND_TRIP. */
  returnDate?: string | null;
  /** ONE_WAY (podrazumevano ako nije prosleđeno) / ROUND_TRIP / MULTI_CITY — M5 spec §3.0d.1:
   * "Tip putovanja određuje samo UI tok, ne novi API parametar". */
  tripType?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  /** Samo za MULTI_CITY — jedna noga po pozivu `GET /search` (isto poglavlje). */
  flightLegs?: FlightLeg[];
  cabinClass?: string | null;
  /** M5 spec §3.0g.8 — izabran redosled prikaza (SortBar.tsx). */
  sort: string;
}) {
  const { items, addItem } = useSelection();
  // M5 §3.0d.1 — filteri letova iz levog panela; od 3.9.2026 se čitaju iz ŽIVOG stanja umesto iz
  // adrese, pa klik na filter deluje odmah, bez ponovne pretrage na serveru
  // (obrazloženje u `SearchFiltersContext.tsx`).
  const liveFilters = useSearchFilters();
  const filters = flightFiltersFromParams(liveFilters.get, liveFilters.getAll);
  const { priceMin, priceMax } = commonFiltersFrom(liveFilters);

  function legFlights(from: string, to: string, idSuffix: string): MockFlight[] {
    const base = MOCK_FLIGHTS.filter((f) => {
      if (cabinClass && f.cabinClass !== cabinClass) return false;
      if (priceMin != null && f.price < priceMin) return false;
      if (priceMax != null && f.price > priceMax) return false;
      return true;
    });
    return applyFlightFilters(base, filters)
      // M5 spec §3.0g.8 / §3.0d.1 — "Najjeftiniji" ili "Najbolji" (kombinacija cene, trajanja i
      // presedanja), isti princip kao Google Flights. Formula je u `flightBestScore`.
      .sort((a, b) => {
        if (sort === 'BEST') {
          return (
            flightBestScore(a.price, a.durationMinutes, a.stops) - flightBestScore(b.price, b.durationMinutes, b.stops)
          );
        }
        if (sort === 'DURATION_ASC') return a.durationMinutes - b.durationMinutes;
        if (sort === 'DEPART_ASC') return minutesOfDay(a.departTime) - minutesOfDay(b.departTime);
        if (sort === 'PRICE_DESC') return b.price - a.price;
        return a.price - b.price;
      })
      .map((f) => ({
        ...f,
        id: `${f.id}-${idSuffix}`,
        fromCity: from.trim() || f.fromCity,
        fromCode: from.trim() ? codeFor(from, f.fromCode) : f.fromCode,
        toCity: to.trim() || f.toCity,
        toCode: to.trim() ? codeFor(to, f.toCode) : f.toCode,
      }));
  }

  function select(f: MockFlight, date?: string) {
    if (items.some((i) => i.key === f.id)) return;
    addItem({
      key: f.id,
      productId: f.id,
      productName: `${f.airline} ${f.flightNumber} — ${f.fromCity} → ${f.toCity}`,
      productType: 'FLIGHT',
      sourceType: 'API',
      stayFrom: date ?? stayFrom,
      stayTo: date ?? stayFrom,
      adults: 1,
      children: 0,
      finalPrice: f.price,
      finalPriceCurrency: f.currency,
      destinationCity: f.toCity,
      boardTypeLabel: `${f.departTime}–${f.arriveTime} · ${f.durationLabel} · ${f.stops === 0 ? 'direktan' : `${f.stops} presedanje`} · ${CABIN_CLASS_LABELS[f.cabinClass]}`,
    });
  }

  const legs: { label: string; from: string; to: string; date?: string; idSuffix: string }[] =
    tripType === 'MULTI_CITY' && flightLegs && flightLegs.length > 0
      ? flightLegs.map((l, i) => ({
          label: `Let ${i + 1}: ${l.originCity || '?'} → ${l.destinationCity || '?'}`,
          from: l.originCity,
          to: l.destinationCity,
          date: l.date || undefined,
          idSuffix: `leg${i}`,
        }))
      : tripType === 'ROUND_TRIP'
        ? [
            { label: 'Polazak', from: originCity ?? '', to: destinationCity ?? '', date: stayFrom, idSuffix: 'out' },
            { label: 'Povratak', from: destinationCity ?? '', to: originCity ?? '', date: returnDate ?? undefined, idSuffix: 'ret' },
          ]
        : [{ label: 'Let', from: originCity ?? '', to: destinationCity ?? '', date: stayFrom, idSuffix: 'ow' }];

  return (
    <div>
      <div className="mb-3 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
        MOCK — hardkodovani letovi, čeka potvrdu izgleda pre prave žice na `GET /search`.
      </div>

      {legs.map((leg) => {
        const flights = legFlights(leg.from, leg.to, leg.idSuffix);
        return (
          <div key={leg.idSuffix} className="mb-4 last:mb-0">
            {legs.length > 1 && (
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {leg.label}
                {leg.date ? ` · ${leg.date}` : ''}
              </h3>
            )}
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
                      onClick={() => select(f, leg.date)}
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
      })}
    </div>
  );
}
