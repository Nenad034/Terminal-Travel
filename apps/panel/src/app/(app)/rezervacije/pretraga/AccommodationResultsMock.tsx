'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useSelection } from '@/components/SelectionContext';
import { compareName } from '@/lib/search-sort';
import SearchResultsMap from '@/components/SearchResultsMap';
import { useSearchFilters } from '@/components/SearchFiltersContext';
import { amenitiesMatch, commonFiltersFrom, offerMatches, starsMatch } from '@/lib/search-filters';

// MOCK — čeka potvrdu izgleda pre prave žice (26.8.2026, na zahtev vlasnika: "napravite mock
// podatke da vidim kako sve izgleda", dorađeno kroz dva naredna prolaza istog dana). Pravi
// `GET /search` (M5 spec §11) danas vraća JEDAN `SearchResultProduct` po proizvodu sa NIZOM
// `offers[]` (tip sobe × vrsta usluge) — ali NI cena NI zauzetost nisu razbijene po sobi kad
// pretraga traži VIŠE soba sa RAZLIČITIM sastavom gostiju (npr. soba 1: 2 odrasle, soba 2: 2
// odrasle + dete od 10 godina) — ovaj mock zato hardkoduje `rooms[]` (svaka stavka = JEDNA
// soba, sopstvena cena za TAČNO taj sastav gostiju) da se vidi ceo koncept, dok prava žica
// (M4/M3 provajder odgovor) ne stigne do istog nivoa detalja.
//
// Klik za odabir — koristi PRAVI `SelectionContext` (M5 spec §3.0e.3, isti mehanizam kao
// `QuoteButton.tsx`), sad prosleđuje SVE opciono dopunjena polja (`SelectionItem` dopuna,
// 26.8.2026: `stars`/`destinationCity`/`destinationCountry`/`boardTypeLabel`/`roomLines`) da
// desni panel prikaže identičan nivo detalja kao ovde (na zahtev vlasnika).
interface MockRoomLine {
  adults: number;
  children: number;
  childrenAges?: number[];
  price: number;
}
interface MockOffer {
  id: string;
  roomTypeName: string;
  boardType: keyof typeof BOARD_TYPE_LABELS;
  currency: string;
  /** M5 §3.0b.2 `is_refundable` — na pravom putu ga računa server (`common/refundability.ts`);
   * ovde je hardkodovan da brzi filter „refundabilno/nerefundabilno" (§3.0c.3a) ima nad čim da
   * radi. Bez ovoga bi prekidač postojao a lista se ne bi menjala — isti razlog zbog kog su
   * mock hoteli 3.9.2026 dobili i sadržaje (`amenities`). Namerno mešano, i namerno tako da su
   * jeftinije tarife češće nerefundabilne, kako to i stoji kod stvarnih dobavljača. */
  isRefundable: boolean;
  rooms: MockRoomLine[];
}
interface MockHotel {
  id: string;
  name: string;
  stars: number;
  city: string;
  country: string;
  /** Koordinate mesta (M5 §3.0h) — mock, ali STVARNE tačke tih gradova, ne izmišljene.
   * Isti nivo tačnosti kao pravi katalog danas: tačka mesta, ne tačka objekta (§3.0h.2). */
  lat: number;
  lng: number;
  image: string;
  /** `AmenityTag` vrednosti (M2 §2.3c) — iste koje levi panel nudi kao tagove.
   * Dodato 3.9.2026: do tada mock hoteli NISU imali nijedan sadržaj, pa cela sekcija tagova u
   * levom panelu (plaža, bazen, soba, politika…) nije mogla ništa da suzi — klik je menjao
   * adresu, a lista je ostajala ista. Filter koji ne može da radi gori je od filtera kog nema. */
  amenities: string[];
  offers: MockOffer[];
}

// Pun naziv usluge (dopuna 26.8.2026, na zahtev vlasnika: "za usluge koristite naziv na ovaj
// način HB - Polupansion... za sve usluge") — kod + čitljiv naziv, svuda gde se usluga prikazuje.
const BOARD_TYPE_LABELS = {
  BB: 'Noćenje sa doručkom',
  HB: 'Polupansion',
  FB: 'Pun pansion',
  AI: 'All Inclusive',
  UAI: 'Ultra All Inclusive',
} as const;
function boardTypeDisplay(code: keyof typeof BOARD_TYPE_LABELS): string {
  return `${code} - ${BOARD_TYPE_LABELS[code]}`;
}

function offerTotal(offer: MockOffer): number {
  return offer.rooms.reduce((sum, r) => sum + r.price, 0);
}

const MOCK_HOTELS: MockHotel[] = [
  {
    id: 'mock-h1',
    amenities: ['BEACH_UNDER_100M', 'BEACH_PEBBLE', 'POOL_OUTDOOR', 'POOL_KIDS', 'WIFI_FREE', 'PARKING', 'SPA_WELLNESS', 'GYM', 'RESTAURANT', 'ROOM_SERVICE', 'AC', 'TV', 'MINIBAR', 'BALCONY', 'SEA_VIEW', 'FAMILY_FRIENDLY', 'FREE_CANCELLATION', 'NON_SMOKING', 'RECEPTION_24H'],
    name: 'Hotel Riviera',
    stars: 5,
    city: 'Budva',
    country: 'Crna Gora',
    lat: 42.2864,
    lng: 18.84,
    image: 'https://picsum.photos/seed/riviera/320/200',
    offers: [
      { id: 'h1-o1', roomTypeName: 'Standard soba', boardType: 'BB', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 45600 }] },
      { id: 'h1-o2', roomTypeName: 'Standard soba', boardType: 'HB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 0, price: 52300 }] },
      { id: 'h1-o3', roomTypeName: 'Deluxe soba, pogled na more', boardType: 'HB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 0, price: 68900 }] },
      { id: 'h1-o4', roomTypeName: 'Deluxe soba, pogled na more', boardType: 'AI', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 81200 }] },
    ],
  },
  {
    id: 'mock-h2',
    amenities: ['BEACH_OVER_500M', 'WIFI_FREE', 'PARKING', 'RESTAURANT', 'AC', 'TV', 'BALCONY', 'SEA_VIEW', 'PETS_ALLOWED', 'PAY_AT_PROPERTY', 'NON_SMOKING'],
    name: 'Hotel Panorama',
    stars: 4,
    city: 'Kotor',
    country: 'Crna Gora',
    lat: 42.4247,
    lng: 18.7712,
    image: 'https://picsum.photos/seed/panorama/320/200',
    offers: [
      { id: 'h2-o1', roomTypeName: 'Dvokrevetna soba', boardType: 'BB', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 38900 }] },
      // Primer sa dve RAZLIČITE sobe u istoj ponudi (tačan slučaj koji je vlasnik opisao: "1
      // sobu za 2 odrasle i 2. sobu za 2 odrasle osobe i dete od 10 godina").
      {
        id: 'h2-o2',
        roomTypeName: 'Porodični apartman (2 sobe)',
        boardType: 'BB',
        currency: 'EUR',
        isRefundable: true,
        rooms: [
          { adults: 2, children: 0, price: 35700 },
          { adults: 2, children: 1, childrenAges: [10], price: 39900 },
        ],
      },
    ],
  },
  {
    id: 'mock-h3',
    amenities: ['BEACH_UNDER_50M', 'BEACH_SAND', 'WIFI_FREE', 'RESTAURANT', 'AC', 'TV', 'KITCHENETTE', 'BALCONY', 'SEA_VIEW', 'FAMILY_FRIENDLY', 'PAY_AT_PROPERTY'],
    name: 'Hotel Adriatic',
    stars: 3,
    city: 'Petrovac',
    country: 'Crna Gora',
    lat: 42.2058,
    lng: 18.9439,
    image: 'https://picsum.photos/seed/adriatic/320/200',
    offers: [
      { id: 'h3-o1', roomTypeName: 'Standard soba', boardType: 'BB', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 29900 }] },
      { id: 'h3-o2', roomTypeName: 'Standard soba', boardType: 'HB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 0, price: 34500 }] },
      { id: 'h3-o3', roomTypeName: 'Porodična soba', boardType: 'UAI', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 2, childrenAges: [7, 9], price: 99900 }] },
    ],
  },
  {
    id: 'mock-h4',
    amenities: ['BEACH_UNDER_250M', 'BEACH_PEBBLE', 'POOL_OUTDOOR', 'WIFI_FREE', 'PARKING', 'RESTAURANT', 'AIRPORT_SHUTTLE', 'AC', 'TV', 'BALCONY', 'MOUNTAIN_VIEW', 'FREE_CANCELLATION', 'NON_SMOKING'],
    name: 'Hotel Maslina',
    stars: 4,
    city: 'Tivat',
    country: 'Crna Gora',
    lat: 42.43,
    lng: 18.6963,
    image: 'https://picsum.photos/seed/maslina/320/200',
    offers: [{ id: 'h4-o1', roomTypeName: 'Standard soba', boardType: 'BB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 0, price: 41200 }] }],
  },
  {
    id: 'mock-h5',
    amenities: ['BEACH_UNDER_500M', 'BEACH_ROCK', 'BEACH_PRIVATE', 'POOL_INDOOR', 'POOL_HEATED', 'WIFI_FREE', 'PARKING', 'SPA_WELLNESS', 'GYM', 'RESTAURANT', 'ROOM_SERVICE', 'RECEPTION_24H', 'AC', 'TV', 'MINIBAR', 'SEA_VIEW', 'ADULTS_ONLY', 'FREE_CANCELLATION'],
    name: 'Hotel Sunset',
    stars: 5,
    city: 'Herceg Novi',
    country: 'Crna Gora',
    lat: 42.4531,
    lng: 18.5375,
    image: 'https://picsum.photos/seed/sunset/320/200',
    offers: [
      { id: 'h5-o1', roomTypeName: 'Superior soba', boardType: 'HB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 0, price: 59900 }] },
      { id: 'h5-o2', roomTypeName: 'Suite', boardType: 'AI', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 112000 }] },
    ],
  },
  {
    // Dodat 3.9.2026 uz filter po kategoriji (§3.0c.3c): do tada su svi mock hoteli bili 3–5
    // zvezdica, pa vlasnikov sopstveni primer („klik na drugu i treću zvezdicu") nije imao šta
    // da pokaže. Filter koji ne može da radi gori je od filtera kog nema — isti razlog zbog kog
    // su mock hoteli istog dana dobili i `amenities`.
    id: 'mock-h6',
    amenities: ['BEACH_UNDER_500M', 'BEACH_SAND', 'WIFI_FREE', 'PARKING', 'AC', 'TV', 'BALCONY', 'PETS_ALLOWED', 'FAMILY_FRIENDLY', 'PAY_AT_PROPERTY'],
    name: 'Vila Jadran',
    stars: 2,
    city: 'Sutomore',
    country: 'Crna Gora',
    lat: 42.1428,
    lng: 19.045,
    image: 'https://picsum.photos/seed/jadran/320/200',
    offers: [
      { id: 'h6-o1', roomTypeName: 'Dvokrevetna soba', boardType: 'BB', currency: 'EUR', isRefundable: false, rooms: [{ adults: 2, children: 0, price: 18400 }] },
      { id: 'h6-o2', roomTypeName: 'Studio apartman', boardType: 'BB', currency: 'EUR', isRefundable: true, rooms: [{ adults: 2, children: 1, childrenAges: [6], price: 24900 }] },
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

function roomLineLabel(r: MockRoomLine): string {
  const parts = [`${r.adults} odrasl${r.adults === 1 ? 'a' : 'e'}`];
  if (r.children > 0) parts.push(`${r.children} det${r.children === 1 ? 'e' : 'ece'}${r.childrenAges?.length ? ` (${r.childrenAges.join(', ')}g)` : ''}`);
  return parts.join(' + ');
}

export default function AccommodationResultsMock({
  stayFrom,
  stayTo,
  sort,
  resultsView,
  bbox,
}: {
  stayFrom?: string;
  stayTo?: string;
  /** M5 spec §3.0g.8 — izabran redosled prikaza (SortBar.tsx). */
  sort: string;
  /** M5 spec §3.0h — 'lista' ili 'mapa' (SortBar.tsx prekidač). Namerno NIJE `view`: taj naziv
   * je u ovoj komponenti već zauzet lokalnim stanjem grid/list prikaza kartica. */
  resultsView: 'lista' | 'mapa';
  /** M5 spec §3.0h.8 — `minLon,minLat,maxLon,maxLat`; `null` kad se mapa ne prati. */
  bbox?: string | null;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { items, addItem } = useSelection();
  // Filteri se čitaju iz ŽIVOG stanja, ne iz adrese (vlasnikova odluka 3.9.2026 — klik na filter
  // deluje odmah, bez poziva serveru; obrazloženje u `SearchFiltersContext.tsx`).
  const filters = useSearchFilters();
  const { priceMin, priceMax, availability, refundable, boardTypes, amenityTags, stars } = commonFiltersFrom(filters);

  // M5 spec §3.0h.8 — okvir mape filtrira i mock, isto kao što na pravom putu filtrira
  // `GET /search`. Bez ovoga bi "pretraži dok pomeram mapu" radilo samo na jednom od dva puta,
  // a razlika se ne bi videla na ekranu koji vlasnik zapravo gleda.
  const inBox = (h: MockHotel) => {
    if (!bbox) return true;
    const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
    return h.lat >= minLat && h.lat <= maxLat && h.lng >= minLon && h.lng <= maxLon;
  };

  const sortedHotels = MOCK_HOTELS.filter(inBox)
    // Sadržaji objekta filtriraju CEO hotel, ne pojedinačnu ponudu — bazen i plaža pripadaju
    // objektu, ne sobi (I-logika, ista kao na serveru: mora imati SVE izabrane, M5 §3.0c.3).
    // Kategorija filtrira CEO hotel, kao i sadržaji — ali po ILI-logici, ne I: hotel ima tačno
    // jednu kategoriju, pa bi „2 zvezdice + 3 zvezdice" po I-logici uvek dalo nula (§3.0c.3c).
    .filter((h) => amenitiesMatch(h.amenities, amenityTags) && starsMatch(h.stars, stars))
    .map((h) => ({
    ...h,
    offers: h.offers
      .filter((o) =>
        // Mock ponuda nema `availabilityStatus` — sve su „odmah potvrda", pa filter dostupnosti
        // sme da je odbaci samo kad se traži nešto drugo.
        offerMatches(
          { finalPrice: offerTotal(o), availabilityStatus: 'AVAILABLE', boardType: o.boardType, isRefundable: o.isRefundable },
          { priceMin, priceMax, availability, refundable, boardTypes },
        ),
      )
      .sort((a, b) => offerTotal(a) - offerTotal(b)),
  }))
    .filter((h) => h.offers.length > 0)
    // M5 spec §3.0g.8 — redosled bira korisnik (SortBar.tsx). Ponude UNUTAR hotela ostaju
    // poređane po ceni rastuće bez obzira na izbor: tu se bira soba, ne hotel.
    .sort((a, b) => {
      if (sort === 'PRICE_DESC') return offerTotal(b.offers[0]) - offerTotal(a.offers[0]);
      if (sort === 'NAME_ASC') return compareName(a.name, b.name);
      if (sort === 'STARS_DESC') return b.stars - a.stars || offerTotal(a.offers[0]) - offerTotal(b.offers[0]);
      return offerTotal(a.offers[0]) - offerTotal(b.offers[0]);
    });

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
      adults: offer.rooms.reduce((sum, r) => sum + r.adults, 0),
      children: offer.rooms.reduce((sum, r) => sum + r.children, 0),
      finalPrice: offerTotal(offer),
      finalPriceCurrency: offer.currency,
      stars: hotel.stars,
      destinationCity: hotel.city,
      destinationCountry: hotel.country,
      boardTypeLabel: `${offer.roomTypeName} · ${boardTypeDisplay(offer.boardType)}`,
      roomLines: offer.rooms,
    });
  }

  const shared = { stayFrom, stayTo, selectedKeys: new Set(items.map((i) => i.key)), selectionKey, onSelect: select };

  // M5 spec §3.0h — mapa umesto liste. Tačke se grade iz VEĆ FILTRIRANIH hotela, ne iz sirovog
  // mock niza: mapa mora da pokazuje isto što i lista, inače filter i mapa pričaju različitu
  // priču o istoj pretrazi.
  if (resultsView === 'mapa') {
    return (
      // Flex kolona sa `min-h-0` (dopuna 3.9.2026) — baner ostaje svoje visine, mapa uzima sav
      // preostali prostor do dna panela. Bez `min-h-0` dete sa `flex-1` ne bi smelo da se skupi
      // ispod svoje prirodne visine i kolona bi probila dno.
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 shrink-0 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-warn">
          MOCK — hardkodovani hoteli. Tačke su stvarne koordinate tih gradova, na nivou mesta
          (isti nivo tačnosti kao pravi katalog danas, M5 §3.0h.2).
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
        <SearchResultsMap
          points={sortedHotels.map((h) => ({
            id: h.id,
            name: h.name,
            lat: h.lat,
            lng: h.lng,
            price: offerTotal(h.offers[0]),
            currency: h.offers[0].currency,
            // Baner na klik (§3.0h.7) prikazuje isto što i kartica u listi — inače mapa i lista
            // pričaju različitu priču o istom hotelu.
            stars: h.stars,
            city: h.city,
            country: h.country,
            image: h.image,
            boardLabel: boardTypeDisplay(h.offers[0].boardType),
          }))}
          // "dodaj u izbor" iz banera radi isto što i dugme u listi — ide u desni panel.
          onSelect={(id) => {
            const hotel = sortedHotels.find((h) => h.id === id);
            if (hotel) select(hotel, hotel.offers[0]);
          }}
        />
        </div>
      </div>
    );
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

// Deljeno između banera (grid) i reda (list) — svaka soba u svom redu sa sopstvenom cenom,
// pa "Ukupno" (dopuna 26.8.2026, na zahtev vlasnika: "pojedinačna cena po sobi za navedeni broj
// osoba i ukupna cena za obe sobe").
function RoomBreakdown({ offer }: { offer: MockOffer }) {
  return (
    <div className="flex flex-col gap-0.5">
      {offer.rooms.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span>
            {offer.rooms.length > 1 ? `Soba ${i + 1}: ` : ''}
            {roomLineLabel(r)}
          </span>
          <span className="font-mono">{money(r.price, offer.currency)}</span>
        </div>
      ))}
    </div>
  );
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
          <span className="flex-shrink-0 rounded bg-panel2 px-1 py-0.5 text-[11px] font-semibold text-warn">{hotel.stars}*</span>
        </div>
        <div className="mb-1.5 truncate text-xs text-ink-faint">
          {hotel.country}, {hotel.city}
        </div>
        <div className="mb-1.5 text-xs text-ink-dim">{formatDateRange(stayFrom, stayTo)}</div>
        <div className="mb-1.5 truncate text-xs text-ink-dim">
          {offer.roomTypeName} · {boardTypeDisplay(offer.boardType)}
        </div>
        <div className="mb-2 text-xs text-ink-dim">
          <RoomBreakdown offer={offer} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-1 border-t border-border pt-1.5">
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
            {selected ? '✓ ' : ''}Ukupno {money(offerTotal(offer), offer.currency)}
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
      className={`flex w-full items-start gap-3 border-border bg-panel p-3 text-left ${primary ? 'rounded-t-lg' : 'border-t bg-panel-2'} ${
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
          className="mt-0.5 flex-shrink-0 text-ink-faint hover:text-accent"
        >
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
        </span>
      ) : (
        <span className="mt-0.5 w-4 flex-shrink-0" />
      )}
      {/* Manja slika SAMO u prvom (najpovoljnijem) redu — ostali otvoreni redovi bez slike. */}
      {primary && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hotel.image} alt={hotel.name} className="h-10 w-14 flex-shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-ink">{hotel.name}</span>
          {primary && <span className="flex-shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-warn">{hotel.stars}*</span>}
        </div>
        <div className="truncate text-[11px] text-ink-faint">
          {hotel.country}, {hotel.city} · {offer.roomTypeName} · {boardTypeDisplay(offer.boardType)}
        </div>
      </div>
      <div className="hidden flex-shrink-0 flex-col items-end gap-0.5 text-[11px] text-ink-dim sm:flex">
        <span>{formatDateRange(stayFrom, stayTo)}</span>
        <RoomBreakdown offer={offer} />
      </div>
      <div className="flex-shrink-0 font-mono text-sm font-semibold text-ink">
        {selected ? '✓ ' : ''}Ukupno {money(offerTotal(offer), offer.currency)}
      </div>
    </button>
  );
}
