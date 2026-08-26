'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';

// MOCK — čeka potvrdu izgleda pre prave žice (26.8.2026, na zahtev vlasnika: "napravite mock
// podatke da vidim kako sve izgleda", posle razrade grid/list prikaza kroz razgovor). Pravi
// `GET /search` (M5 spec §11) danas vraća JEDAN `SearchResultProduct` po proizvodu sa NIZOM
// `offers[]` (tip sobe × vrsta usluge) — model podataka za ovo VEĆ postoji, ali ne nosi razbijen
// broj SOBA po ponudi (`occupancy.room_config[]` je fiksiran na nivou CELE pretrage, ne po
// ponudi) niti `attributes.stars` u odgovoru pretrage (samo u punom `Product` zapisu) — ovaj
// mock zato hardkoduje kompletnu strukturu da se vidi ceo koncept, umesto da prikaže osiromašenu
// realnu verziju. Prava žica (posle potvrde izgleda) menja mock hotele stvarnim `/sales/search`
// odgovorom + dopunjuje ga poljima koja mu nedostaju (stars, room breakdown po ponudi).
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
  offers: MockOffer[];
}

const MOCK_HOTELS: MockHotel[] = [
  {
    id: 'mock-h1',
    name: 'Hotel Riviera',
    stars: 5,
    city: 'Budva',
    country: 'Crna Gora',
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
    offers: [
      { id: 'h3-o1', roomTypeName: 'Standard soba', boardType: 'BB', price: 29900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h3-o2', roomTypeName: 'Standard soba', boardType: 'HB', price: 34500, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 0 }] },
      { id: 'h3-o3', roomTypeName: 'Porodična soba', boardType: 'Ultra All Inclusive', price: 99900, currency: 'EUR', roomLines: [{ rooms: 1, adults: 2, children: 2 }] },
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

function roomLinesLabel(roomLines: MockRoomLine[]): string {
  const totalRooms = roomLines.reduce((sum, r) => sum + r.rooms, 0);
  const parts = roomLines.map((r) => {
    const who = [r.adults > 0 ? `${r.adults} odrasle osobe` : null, r.children > 0 ? `${r.children} dece` : null].filter(Boolean).join(' + ');
    return r.rooms > 1 ? `${r.rooms}× (${who})` : who;
  });
  return `${totalRooms} ${totalRooms === 1 ? 'soba' : 'sobe'}: ${parts.join(', ')}`;
}

export default function AccommodationResultsMock({
  stayFrom,
  stayTo,
  adults,
  children,
}: {
  stayFrom?: string;
  stayTo?: string;
  adults: number;
  children: number;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedHotels.map((hotel) => {
            const isOpen = expanded.has(hotel.id);
            const shown = isOpen ? hotel.offers : hotel.offers.slice(0, 1);
            return (
              <div key={hotel.id} className={isOpen ? 'col-span-full' : undefined}>
                <div
                  className={`grid gap-3 ${isOpen ? 'rounded-lg border-2 border-accent p-3 sm:grid-cols-2 lg:grid-cols-3' : ''}`}
                >
                  {shown.map((offer, idx) => (
                    <GridBanner
                      key={offer.id}
                      hotel={hotel}
                      offer={offer}
                      stayFrom={stayFrom}
                      stayTo={stayTo}
                      adults={adults}
                      children={children}
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
                  stayFrom={stayFrom}
                  stayTo={stayTo}
                  adults={adults}
                  children={children}
                  showToggle={hotel.offers.length > 1}
                  expanded={isOpen}
                  onToggle={() => toggle(hotel.id)}
                  primary
                />
                {isOpen &&
                  rest.map((offer) => (
                    <ListRow
                      key={offer.id}
                      hotel={hotel}
                      offer={offer}
                      stayFrom={stayFrom}
                      stayTo={stayTo}
                      adults={adults}
                      children={children}
                    />
                  ))}
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
  adults: number;
  children: number;
  showToggle?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  primary?: boolean;
}

function GridBanner({ hotel, offer, stayFrom, stayTo, adults, children, showToggle, expanded, onToggle }: BannerProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-panel">
      <div className="flex aspect-[16/10] items-center justify-center bg-panel-2 text-ink-faint">
        <Icon name="device-camera" className="text-2xl" />
      </div>
      <div className="p-3">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="font-medium text-ink">{hotel.name}</span>
          <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-warn">{hotel.stars}*</span>
        </div>
        <div className="mb-2 text-xs text-ink-faint">
          {hotel.country}, {hotel.city}
        </div>
        <div className="mb-2 flex flex-col gap-0.5 text-[11px] text-ink-dim">
          <span>{formatDateRange(stayFrom, stayTo)}</span>
          <span>
            {adults} odrasle osobe{children > 0 ? ` + ${children} dece` : ''}
          </span>
          <span>{roomLinesLabel(offer.roomLines)}</span>
        </div>
        <div className="mb-1 text-xs text-ink-dim">
          {offer.roomTypeName} · {offer.boardType}
        </div>
        <div className="font-mono text-sm font-semibold text-ink">cena od {money(offer.price, offer.currency)}</div>
      </div>
      {showToggle && (
        <button
          onClick={onToggle}
          title={expanded ? 'Sakrij ostale opcije' : 'Prikaži ostale opcije'}
          className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-panel-2 text-ink-dim shadow hover:bg-accent-soft hover:text-accent-strong"
        >
          <Icon name={expanded ? 'chevron-up' : 'list-unordered'} />
        </button>
      )}
    </div>
  );
}

function ListRow({ hotel, offer, stayFrom, stayTo, adults, children, showToggle, expanded, onToggle, primary }: BannerProps) {
  return (
    <div className={`flex items-center gap-3 border-border bg-panel p-3 ${primary ? 'rounded-t-lg' : 'border-t bg-panel-2'} ${!expanded && primary ? 'rounded-b-lg border' : ''}`}>
      {showToggle && (
        <button onClick={onToggle} title={expanded ? 'Sakrij ostale opcije' : 'Prikaži ostale opcije'} className="flex-shrink-0 text-ink-faint hover:text-accent">
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
        </button>
      )}
      {!showToggle && <span className="w-4 flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-ink">{hotel.name}</span>
          {primary && <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-warn">{hotel.stars}*</span>}
        </div>
        <div className="text-[11px] text-ink-faint">
          {hotel.country}, {hotel.city} · {offer.roomTypeName} · {offer.boardType}
        </div>
      </div>
      <div className="hidden flex-col items-end gap-0.5 text-[11px] text-ink-dim sm:flex">
        <span>{formatDateRange(stayFrom, stayTo)}</span>
        <span>
          {adults} odrasle{children > 0 ? ` + ${children} dece` : ''}
        </span>
        <span>{roomLinesLabel(offer.roomLines)}</span>
      </div>
      <div className="flex-shrink-0 font-mono text-sm font-semibold text-ink">{primary ? 'cena od ' : ''}{money(offer.price, offer.currency)}</div>
    </div>
  );
}
