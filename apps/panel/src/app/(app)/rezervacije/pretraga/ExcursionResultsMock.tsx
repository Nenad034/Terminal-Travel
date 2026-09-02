'use client';

import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';
import { compareName } from '@/lib/search-sort';

// MOCK — čeka potvrdu izgleda pre prave žice (29.8.2026, na zahtev vlasnika: "dodajte mock
// podatke za pretragu letova, transfera i izleta da bih video kako sve radi", isti obrazac kao
// `AccommodationResultsMock.tsx`). Pokriva "Things to do" ikonicu (EXCURSION+EVENT+TICKET spojeno
// u jednu pretragu, `search-product-types.ts`) — kartice sa slikom, isti utisak kao ACCOMMODATION
// kartice, jer ova tri tipa spadaju u CARD_TYPES (page.tsx) po dizajn dok. §6d.
interface MockExcursion {
  id: string;
  name: string;
  type: 'EXCURSION' | 'EVENT' | 'TICKET';
  city: string;
  country: string;
  image: string;
  durationLabel: string;
  groupType: string;
  tag: string;
  price: number;
  currency: string;
}

const TYPE_LABELS: Record<MockExcursion['type'], string> = {
  EXCURSION: 'Izlet',
  EVENT: 'Događaj',
  TICKET: 'Ulaznica',
};

const MOCK_EXCURSIONS: MockExcursion[] = [
  {
    id: 'mock-e1',
    name: 'Obilazak Kotorskog zaliva brodom',
    type: 'EXCURSION',
    city: 'Kotor',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/kotor-bay/320/200',
    durationLabel: 'Poludnevni, 4h',
    groupType: 'Grupni',
    tag: 'Uključen vodič na srpskom',
    price: 3900,
    currency: 'EUR',
  },
  {
    id: 'mock-e2',
    name: 'Ostrvo Sveti Stefan i Budva — panoramski izlet',
    type: 'EXCURSION',
    city: 'Budva',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/sveti-stefan/320/200',
    durationLabel: 'Poludnevni, 3h',
    groupType: 'Grupni',
    tag: 'Polazak iz hotela',
    price: 2500,
    currency: 'EUR',
  },
  {
    id: 'mock-e3',
    name: 'Rafting na reci Tari',
    type: 'EXCURSION',
    city: 'Žabljak',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/tara-rafting/320/200',
    durationLabel: 'Celodnevni, 8h',
    groupType: 'Privatni',
    tag: 'Ručak uključen',
    price: 6900,
    currency: 'EUR',
  },
  {
    id: 'mock-e4',
    name: 'Koncert na Trgu pesme',
    type: 'EVENT',
    city: 'Budva',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/concert-square/320/200',
    durationLabel: '21:00, traje ~2h',
    groupType: 'Otvoreno za sve',
    tag: 'Ulaznica bez sedišta',
    price: 1500,
    currency: 'EUR',
  },
  {
    id: 'mock-e5',
    name: 'Ulaznica — Tvrđava Mogren',
    type: 'TICKET',
    city: 'Budva',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/mogren-fortress/320/200',
    durationLabel: 'Fleksibilan datum',
    groupType: 'Individualno',
    tag: 'Vredi 12 meseci od kupovine',
    price: 500,
    currency: 'EUR',
  },
];

function money(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

export default function ExcursionResultsMock({
  stayFrom,
  priceMin,
  priceMax,
  sort,
}: {
  /** Bag (29.8.2026) — mock nije nikad prosleđivao datum, pa je "Napravi ponudu" (RightPanel.tsx)
   * uvek odbijao selekciju sa ovim tipom ("izaberite period boravka"), bez obzira na ostale stavke. */
  stayFrom?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  /** M5 spec §3.0g.8 — izabran redosled prikaza (SortBar.tsx). */
  sort: string;
}) {
  const { items, addItem } = useSelection();

  const excursions = MOCK_EXCURSIONS.filter((e) => {
    if (priceMin != null && e.price < priceMin) return false;
    if (priceMax != null && e.price > priceMax) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'PRICE_DESC') return b.price - a.price;
    if (sort === 'NAME_ASC') return compareName(a.name, b.name);
    return a.price - b.price;
  });

  function select(e: MockExcursion) {
    if (items.some((i) => i.key === e.id)) return;
    addItem({
      key: e.id,
      productId: e.id,
      productName: e.name,
      productType: e.type,
      sourceType: 'CONTRACTED',
      stayFrom,
      stayTo: stayFrom,
      adults: 1,
      children: 0,
      finalPrice: e.price,
      finalPriceCurrency: e.currency,
      destinationCity: e.city,
      destinationCountry: e.country,
      boardTypeLabel: `${TYPE_LABELS[e.type]} · ${e.durationLabel} · ${e.groupType} · ${e.tag}`,
    });
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
        MOCK — hardkodovani izleti/događaji/ulaznice, čeka potvrdu izgleda pre prave žice na `GET /search`.
      </div>

      {excursions.length === 0 ? (
        <p className="text-center text-xs text-ink-faint">Nema rezultata za zadate kriterijume.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {excursions.map((e) => {
            const selected = items.some((i) => i.key === e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => select(e)}
                disabled={selected}
                className={`flex flex-col overflow-hidden rounded-lg border bg-panel text-left ${
                  selected ? 'border-accent' : 'border-border hover:border-accent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.image} alt={e.name} className="aspect-[16/10] w-full object-cover" />
                <div className="flex flex-1 flex-col p-2.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-ink">{e.name}</span>
                    <span className="flex-shrink-0 rounded bg-panel2 px-1 py-0.5 text-[11px] font-semibold text-accent-strong">
                      {TYPE_LABELS[e.type]}
                    </span>
                  </div>
                  <div className="mb-1.5 truncate text-xs text-ink-faint">
                    {e.country}, {e.city}
                  </div>
                  <div className="mb-1.5 flex items-center gap-1 text-xs text-ink-dim">
                    <Icon name="history" />
                    {e.durationLabel} · {e.groupType}
                  </div>
                  <div className="mb-2 truncate text-xs text-ink-faint">{e.tag}</div>
                  <div className="mt-auto flex items-center justify-end border-t border-border pt-1.5">
                    <span className="truncate font-mono text-[11px] font-semibold text-ink">
                      {selected ? '✓ ' : ''}
                      {money(e.price, e.currency)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
