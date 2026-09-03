'use client';

import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';
import { compareName } from '@/lib/search-sort';
import { useSearchFilters } from '@/components/SearchFiltersContext';
import { commonFiltersFrom } from '@/lib/search-filters';

// MOCK — čeka potvrdu izgleda pre prave žice (29.8.2026, na zahtev vlasnika: "dodajte mock
// podatke za pretragu letova, transfera i izleta da bih video kako sve radi", isti obrazac kao
// `AccommodationResultsMock.tsx`). Ruta (od-do) + tip vozila + kapacitet su svojstvena transferu,
// `GET /search` (M5 spec §11) danas nema poseban oblik za njih — mock hardkoduje sopstveni oblik
// dok prava žica (M4 provajder odgovor za TRANSFER) ne stigne do istog nivoa detalja.
interface MockTransfer {
  id: string;
  vehicleType: string;
  vehicleIcon: string;
  fromLabel: string;
  toLabel: string;
  durationLabel: string;
  maxPax: number;
  oneWay: boolean;
  price: number;
  currency: string;
}

const MOCK_TRANSFERS: MockTransfer[] = [
  {
    id: 'mock-t1',
    vehicleType: 'Sedan (privatan)',
    vehicleIcon: 'account',
    fromLabel: 'Aerodrom Tivat',
    toLabel: 'Hotel Riviera, Budva',
    durationLabel: '~35 min',
    maxPax: 3,
    oneWay: true,
    price: 3500,
    currency: 'EUR',
  },
  {
    id: 'mock-t2',
    vehicleType: 'Van (privatan)',
    vehicleIcon: 'organization',
    fromLabel: 'Aerodrom Tivat',
    toLabel: 'Hotel Riviera, Budva',
    durationLabel: '~35 min',
    maxPax: 7,
    oneWay: true,
    price: 5200,
    currency: 'EUR',
  },
  {
    id: 'mock-t3',
    vehicleType: 'Sedan (privatan) — povratni',
    vehicleIcon: 'account',
    fromLabel: 'Aerodrom Tivat',
    toLabel: 'Hotel Riviera, Budva',
    durationLabel: '~35 min (u oba pravca)',
    maxPax: 3,
    oneWay: false,
    price: 6500,
    currency: 'EUR',
  },
  {
    id: 'mock-t4',
    vehicleType: 'Minibus (deljen)',
    vehicleIcon: 'organization',
    fromLabel: 'Aerodrom Podgorica',
    toLabel: 'Hotel Riviera, Budva',
    durationLabel: '~55 min',
    maxPax: 16,
    oneWay: true,
    price: 1800,
    currency: 'EUR',
  },
];

function money(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

export default function TransferResultsMock({
  stayFrom,
  sort,
}: {
  /** Datum transfera iz opštih "od/do" polja popup-a; isti dan za stayFrom/stayTo, isti razlog
   * kao FlightResultsMock (M5 spec §3.0e.3a — selekcija treba stvaran datum da proveri usklađenost). */
  stayFrom?: string;
  /** M5 spec §3.0g.8 — izabran redosled prikaza (SortBar.tsx). */
  sort: string;
}) {
  const { items, addItem } = useSelection();
  // Filteri iz živog stanja — klik deluje odmah, bez poziva serveru (`SearchFiltersContext.tsx`).
  const { priceMin, priceMax } = commonFiltersFrom(useSearchFilters());

  const transfers = MOCK_TRANSFERS.filter((t) => {
    if (priceMin != null && t.price < priceMin) return false;
    if (priceMax != null && t.price > priceMax) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'PRICE_DESC') return b.price - a.price;
    if (sort === 'NAME_ASC') return compareName(a.vehicleType, b.vehicleType);
    return a.price - b.price;
  });

  function select(t: MockTransfer) {
    if (items.some((i) => i.key === t.id)) return;
    addItem({
      key: t.id,
      productId: t.id,
      productName: `${t.vehicleType} — ${t.fromLabel} → ${t.toLabel}`,
      productType: 'TRANSFER',
      sourceType: 'API',
      stayFrom,
      stayTo: stayFrom,
      adults: 1,
      children: 0,
      finalPrice: t.price,
      finalPriceCurrency: t.currency,
      boardTypeLabel: `${t.durationLabel} · do ${t.maxPax} putnika · ${t.oneWay ? 'u jednom pravcu' : 'povratni'}`,
    });
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
        MOCK — hardkodovani transferi, čeka potvrdu izgleda pre prave žice na `GET /search`.
      </div>

      {transfers.length === 0 ? (
        <p className="text-center text-xs text-ink-faint">Nema transfera za zadate kriterijume.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {transfers.map((t) => {
            const selected = items.some((i) => i.key === t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => select(t)}
                disabled={selected}
                className={`flex items-center gap-4 rounded-lg border bg-panel p-3 text-left ${
                  selected ? 'border-accent bg-accent-soft/40' : 'border-border hover:border-accent'
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-accent">
                  <Icon name={t.vehicleIcon} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{t.vehicleType}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {t.fromLabel} → {t.toLabel}
                  </div>
                </div>
                <div className="hidden flex-shrink-0 flex-col items-end gap-0.5 text-[11px] text-ink-dim sm:flex">
                  <span>{t.durationLabel}</span>
                  <span>
                    do {t.maxPax} putnika · {t.oneWay ? 'u jednom pravcu' : 'povratni'}
                  </span>
                </div>
                <div className="flex-shrink-0 font-mono text-sm font-semibold text-ink">
                  {selected ? '✓ ' : ''}
                  {money(t.price, t.currency)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
