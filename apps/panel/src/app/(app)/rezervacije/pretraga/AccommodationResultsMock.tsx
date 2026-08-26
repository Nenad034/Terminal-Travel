'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';

// MOCK — čeka potvrdu izgleda pre prave žice (26.8.2026, na zahtev vlasnika: "napravite mock
// podatke da vidim kako sve izgleda", posle razrade grid/list prikaza kroz razgovor; dorađeno
// isti dan posle uživo pregleda screenshot-a — "ima mnogo praznog prostora i preklapa se
// listanje sa tekstom... dovoljno je 2 odrasle (1 soba)... 5 banera u jednom redu... mock
// slike... manja slika u list view-u u prvom redu, ispod bez slike... klikom odabir ponude i
// slanje u desni panel"). Pravi `GET /search` (M5 spec §11) danas vraća JEDAN
// `SearchResultProduct` po proizvodu sa NIZOM `offers[]` (tip sobe × vrsta usluge) — model
// podataka za ovo VEĆ postoji, ali ne nosi razbijen broj SOBA po ponudi (`occupancy.room_config[]`
// je fiksiran na nivou CELE pretrage, ne po ponudi) niti `attributes.stars`/slike u odgovoru
// pretrage (samo u punom `Product` zapisu) — ovaj mock zato hardkoduje kompletnu strukturu da se
// vidi ceo koncept. Prava žica (posle potvrde izgleda) menja mock hotele stvarnim `/sales/search`
// odgovorom + dopunjuje ga poljima koja mu nedostaju.
//
// Klik za odabir (dopuna, isti dan) — koristi POSTOJEĆI, PRAVI `SelectionContext` (M5 spec
// §3.0e.3, isti mehanizam kao `QuoteButton.tsx` u pravim rezultatima) — dodavanje u desni panel
// STVARNO radi već sada. Napomena: `productId`/`rateLineId` su mock vrednosti — dugme "Napravi
// ponudu" u desnom panelu bi za OVE stavke vratilo grešku sa pravog servera (proizvod ne
// postoji) — prihvatljivo dok je ovo mock faza, ne skriva se (isti duh kao ostatak mock
// obeležavanja), zatvara se kad mock hoteli postanu pravi rezultati pretrage.
interface MockRoomLine {
  rooms: number;
  adults: number;
  children: number;
}
interface MockOffer {
  id: string;
  roomTypeName: string;
  boardType: string;
  price: number;
  currency: string;
  roomLines: MockRoomLine[];
}
interface MockHotel {
  id: string;
  name: string;
  stars: number;
  city: string;
  country: string;
  image: string;
  offers: MockOffer[];
}

const MOCK_HOTELS: MockHotel[] = [
  {
    id: 'mock-h1',
    name: 'Hotel Riviera',
    stars: 5,
    city: 'Budva',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/riviera/320/200',
    offers: [
      { id: 'h1-o1', roomTypeName: 'Standard soba', boardType: 'BB', price: 45600, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h1-o2', roomTypeName: 'Standard soba', boardType: 'HB', price: 52300, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h1-o3', roomTypeName: 'Deluxe soba, pogled na more', boardType: 'HB', price: 68900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h1-o4', roomTypeName: 'Deluxe soba, pogled na more', boardType: 'All Inclusive', price: 81200, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
    ],
  },
  {
    id: 'mock-h2',
    name: 'Hotel Panorama',
    stars: 4,
    city: 'Kotor',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/panorama/320/200',
    offers: [
      { id: 'h2-o1', roomTypeName: 'Dvokrevetna soba', boardType: 'BB', price: 38900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h2-o2', roomTypeName: 'Porodični apartman', boardType: 'BB', price: 71400, currency: 'EUR', roomLines: [{ rooms: 2, adults: 2, children: 1 }] },
    ],
  },
  {
    id: 'mock-h3',
    name: 'Hotel Adriatic',
    stars: 3,
    city: 'Petrovac',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/adriatic/320/200',
    offers: [
      { id: 'h3-o1', roomTypeName: 'Standard soba', boardType: 'BB', price: 29900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h3-o2', roomTypeName: 'Standard soba', boardType: 'HB', price: 34500, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h3-o3', roomTypeName: 'Porodična soba', boardType: 'Ultra All Inclusive', price: 99900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 2 }] },
    ],
  },
  {
    id: 'mock-h4',
    name: 'Hotel Maslina',
    stars: 4,
    city: 'Tivat',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/maslina/320/200',
    offers: [
      { id: 'h4-o1', roomTypeName: 'Standard soba', boardType: 'BB', price: 41200, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
    ],
  },
  {
    id: 'mock-h5',
    name: 'Hotel Sunset',
    stars: 5,
    city: 'Herceg Novi',
    country: 'Crna Gora',
    image: 'https://picsum.photos/seed/sunset/320/200',
    offers: [
      { id: 'h5-o1', roomTypeName: 'Superior soba', boardType: 'HB', price: 59900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h5-o2', roomTypeName: 'Suite', boardType: 'All Inclusive', price: 112000, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
    ],
  },
];

function money(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

function formatDateRange(stayFrom?: string, stayTo?: string): string {
  if (!stayFrom || !stayTo) return '—';
  const fmt = (d: string) => new Date(d).toLocaleDateString('sr-RS');
  return `${fmt(stayFrom)} – ${fmt(stayTo)}`;
}

// Kombinovano u JEDNU liniju (dopuna — "dovoljno je da napišete 2 odrasle (1 soba)"), umesto
// ranijih dveju odvojenih linija (broj osoba iz pretrage + razbijen prikaz po sobi).
function occupancySummary(roomLines: MockRoomLine[]): string {
  const totalRooms = roomLines.reduce((sum, r) => sum + r.rooms, 0);
  const totalAdults = roomLines.reduce((sum, r) => sum + r.rooms * r.adults, 0);
  const totalChildren = roomLines.reduce((sum, r) => sum + r.rooms * r.children, 0);
  const who = [
    totalAdults > 0 ? `${totalAdults} odrasl${totalAdults === 1 ? 'a' : 'e'}` : null,
    totalChildren > 0 ? `${totalChildren} dece` : null,
  ]
    .filter(Boolean)
    .join(' + ');
  return `${who} (${totalRooms} ${totalRooms === 1 ? 'soba' : 'sobe'})`;
}

export default function AccommodationResultsMock({ stayFrom, stayTo }: { stayFrom?: string; stayTo?: string }) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { items, addItem } = useSelection();

  const sortedHotels = [...MOCK_HOTELS]
    .map((h) => ({ ...h, offers: [...h.offers].sort((a, b) => a.price - b.price) }))
    .sort((a, b) => a.offers[0].price - b.offers[0].price);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectionKey(hotel: MockHotel, offer: MockOffer): string {
    return `${hotel.id}:${offer.id}`;
  }

  function select(hotel: MockHotel, offer: MockOffer) {
    const key = selectionKey(hotel, offer);
    if (items.some((i) => i.key === key)) return;
    addItem({
      key,
      productId: hotel.id,
      productName: hotel.name,
      productType: 'ACCOMMODATION',
      sourceType: 'CONTRACTED',
      rateLineId: offer.id,
      stayFrom,
      stayTo,
      adults: offer.roomLines.reduce((sum, r) => sum + r.rooms * r.adults, 0),
      children: offer.roomLines.reduce((sum, r) => sum + r.rooms * r.children, 0),
      finalPrice: offer.price,
      finalPriceCurrency: offer.currency,
    });
  }

  const shared = { stayFrom, stayTo, selectedKeys: new Set(items.map((i) => i.key)), selectionKey, onSelect: select };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
        <span>MOCK — hardkodovani hoteli, čeka potvrdu izgleda pre prave žice na `GET /search`.</span>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => setView('grid')}
            title="Grid prikaz"
            className={`flex h-[26px] w-[26px] items-center justify-center rounded ${view === 'grid' ? 'bg-accent-soft text-accent-strong' : 'text-warn hover:bg-panel'}`}
          >
            <Icon name="layout" />
          </button>
          <button
            onClick={() => setView('list')}
            title="List prikaz"
            className={`flex h-[26px] w-[26px] items-center justify-center rounded ${view === 'list' ? 'bg-accent-soft text-accent-strong' : 'text-warn hover:bg-panel'}`}
          >
            <Icon name="list-unordered" />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-5 gap-3">
          {sortedHotels.map((hotel) => {
            const isOpen = expanded.has(hotel.id);
            const shown = isOpen ? hotel.offers : hotel.offers.slice(0, 1);
            return (
              <div key={hotel.id} className={isOpen ? 'col-span-full' : undefined}>
                <div className={`grid gap-3 ${isOpen ? 'grid-cols-5 rounded-lg border-2 border-accent p-3' : ''}`}>
                  {shown.map((offer, idx) => (
                    <GridBanner
                      key={offer.id}
                      hotel={hotel}
                      offer={offer}
                      {...shared}
                      showToggle={idx === 0 && hotel.offers.length > 1}
                      expanded={isOpen}
                      onToggle={() => toggle(hotel.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedHotels.map((hotel) => {
            const isOpen = expanded.has(hotel.id);
            const rest = hotel.offers.slice(1);
            return (
              <div key={hotel.id} className={isOpen ? 'overflow-hidden rounded-lg border-2 border-accent' : ''}>
                <ListRow
                  hotel={hotel}
                  offer={hotel.offers[0]}
                  {...shared}
                  showToggle={hotel.offers.length > 1}
                  expanded={isOpen}
                  onToggle={() => toggle(hotel.id)}
                  primary
                />
                {isOpen && rest.map((offer) => <ListRow key={offer.id} hotel={hotel} offer={offer} {...shared} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BannerProps {
  hotel: MockHotel;
  offer: MockOffer;
  stayFrom?: string;
  stayTo?: string;
  selectedKeys: Set<string>;
  selectionKey: (hotel: MockHotel, offer: MockOffer) => string;
  onSelect: (hotel: MockHotel, offer: MockOffer) => void;
  showToggle?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  primary?: boolean;
}

function GridBanner({ hotel, offer, stayFrom, stayTo, selectedKeys, selectionKey, onSelect, showToggle, expanded, onToggle }: BannerProps) {
  const selected = selectedKeys.has(selectionKey(hotel, offer));
  return (
    <button
      type="button"
      onClick={() => onSelect(hotel, offer)}
      disabled={selected}
      className={`flex flex-col overflow-hidden rounded-lg border bg-panel text-left ${
        selected ? 'border-accent' : 'border-border hover:border-accent'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hotel.image} alt={hotel.name} className="aspect-[16/10] w-full object-cover" />
      <div className="flex flex-1 flex-col p-2.5">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-ink">{hotel.name}</span>
          <span className="flex-shrink-0 rounded bg-panel2 px-1 py-0.5 text-[9px] font-semibold text-warn">{hotel.stars}*</span>
        </div>
        <div className="mb-1.5 truncate text-[10px] text-ink-faint">
          {hotel.country}, {hotel.city}
        </div>
        <div className="mb-1.5 flex flex-col gap-0.5 text-[10px] text-ink-dim">
          <span>{formatDateRange(stayFrom, stayTo)}</span>
          <span>{occupancySummary(offer.roomLines)}</span>
        </div>
        <div className="mb-2 truncate text-[10px] text-ink-dim">
          {offer.roomTypeName} · {offer.boardType}
        </div>
        <div className="mt-auto flex items-center justify-between gap-1">
          {showToggle ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onToggle?.();
                }
              }}
              title={expanded ? 'Sakrij ostale opcije' : 'Prikaži ostale opcije'}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-panel2 text-ink-dim hover:bg-accent-soft hover:text-accent-strong"
            >
              <Icon name={expanded ? 'chevron-up' : 'list-unordered'} />
            </span>
          ) : (
            <span />
          )}
          <span className="truncate font-mono text-[11px] font-semibold text-ink">
            {selected ? '✓ ' : ''}od {money(offer.price, offer.currency)}
          </span>
        </div>
      </div>
    </button>
  );
}

function ListRow({ hotel, offer, stayFrom, stayTo, selectedKeys, selectionKey, onSelect, showToggle, expanded, onToggle, primary }: BannerProps) {
  const selected = selectedKeys.has(selectionKey(hotel, offer));
  return (
    <button
      type="button"
      onClick={() => onSelect(hotel, offer)}
      disabled={selected}
      className={`flex w-full items-center gap-3 border-border bg-panel p-3 text-left ${primary ? 'rounded-t-lg' : 'border-t bg-panel-2'} ${
        !expanded && primary ? 'rounded-b-lg border' : ''
      } ${selected ? 'bg-accent-soft/40' : 'hover:bg-panel2'}`}
    >
      {showToggle ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onToggle?.();
            }
          }}
          title={expanded ? 'Sakrij ostale opcije' : 'Prikaži ostale opcije'}
          className="flex-shrink-0 text-ink-faint hover:text-accent"
        >
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
        </span>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}
      {/* Manja slika SAMO u prvom (najpovoljnijem) redu — ostali otvoreni redovi bez slike
          (dopuna, na zahtev vlasnika: "manju mock sliku kada je list view u pitanju u prvom
          redu, ispod bez slike"). */}
      {primary && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hotel.image} alt={hotel.name} className="h-10 w-14 flex-shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-ink">{hotel.name}</span>
          {primary && <span className="flex-shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-warn">{hotel.stars}*</span>}
        </div>
        <div className="truncate text-[11px] text-ink-faint">
          {hotel.country}, {hotel.city} · {offer.roomTypeName} · {offer.boardType}
        </div>
      </div>
      <div className="hidden flex-shrink-0 flex-col items-end gap-0.5 text-[11px] text-ink-dim sm:flex">
        <span>{formatDateRange(stayFrom, stayTo)}</span>
        <span>{occupancySummary(offer.roomLines)}</span>
      </div>
      <div className="flex-shrink-0 font-mono text-sm font-semibold text-ink">
        {selected ? '✓ ' : ''}
        {primary ? 'od ' : ''}
        {money(offer.price, offer.currency)}
      </div>
    </button>
  );
}
