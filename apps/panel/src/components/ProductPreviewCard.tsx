'use client';

import { useState } from 'react';
import Icon from './Icon';
import AddToAiContextButton from './AddToAiContextButton';

// MOCK — čeka potvrdu izgleda pre prave žice (26.8.2026, na zahtev vlasnika: "napravite mi
// jedan mock da vidim slike i opis jednog hotela u desnom panelu"). Faza A plana "Desni panel
// — brzi pregled proizvoda" (vidi plan fajl sesije) — čisto vizuelan prikaz, NIJE povezan na
// pravu pretragu/API. Faza B (posle potvrde izgleda) menja mock hotele stvarnim podacima iz
// `GET /catalog/products/:id` preko nove BFF rute, i menja `MOCK_HOTELS`/onOpenFull sa
// pravim `ProductPreviewContext` (istorija poslednja 3 pregleda) i pravim `openTab(...)`.
// Slike su privremeni placeholder servis (picsum.photos, seed po hotelu radi stabilnosti),
// NE stvarne fotografije objekata — zamenjuju se pravim `Product.media[]` u Fazi B.
interface MockHotel {
  id: string;
  name: string;
  stars: number;
  city: string;
  country: string;
  description: string;
  photos: { url: string; caption: string }[];
  contact: { phone: string; email: string; address: string };
}

const MOCK_HOTELS: MockHotel[] = [
  {
    id: 'mock-hotel-1',
    name: 'Hotel Riviera',
    stars: 5,
    city: 'Budva',
    country: 'Crna Gora',
    description:
      'Hotel na samoj obali, 50m od plaže, sa spoljnim bazenom i restoranom sa pogledom na more. Sobe klimatizovane, sa balkonom i pogledom na more ili baštu.',
    photos: [
      { url: 'https://picsum.photos/seed/riviera-1/480/320', caption: 'Spoljašnjost' },
      { url: 'https://picsum.photos/seed/riviera-2/480/320', caption: 'Bazen' },
      { url: 'https://picsum.photos/seed/riviera-3/480/320', caption: 'Soba — Deluxe' },
      { url: 'https://picsum.photos/seed/riviera-4/480/320', caption: 'Restoran' },
    ],
    contact: { phone: '+382 33 123 456', email: 'info@hotelriviera.me', address: 'Slovenska obala 12, Budva' },
  },
  {
    id: 'mock-hotel-2',
    name: 'Hotel Panorama',
    stars: 4,
    city: 'Kotor',
    country: 'Crna Gora',
    description: 'Butik hotel u starom gradu, sa terasom sa pogledom na zaliv. Doručak uključen, besplatan WiFi.',
    photos: [
      { url: 'https://picsum.photos/seed/panorama-1/480/320', caption: 'Terasa' },
      { url: 'https://picsum.photos/seed/panorama-2/480/320', caption: 'Recepcija' },
      { url: 'https://picsum.photos/seed/panorama-3/480/320', caption: 'Soba' },
    ],
    contact: { phone: '+382 32 987 654', email: 'rezervacije@panorama.me', address: 'Stari grad bb, Kotor' },
  },
  {
    id: 'mock-hotel-3',
    name: 'Hotel Adriatic',
    stars: 3,
    city: 'Petrovac',
    country: 'Crna Gora',
    description: 'Porodični hotel uz peščanu plažu, sa animacijom za decu i unutrašnjim bazenom.',
    photos: [
      { url: 'https://picsum.photos/seed/adriatic-1/480/320', caption: 'Plaža' },
      { url: 'https://picsum.photos/seed/adriatic-2/480/320', caption: 'Unutrašnji bazen' },
      { url: 'https://picsum.photos/seed/adriatic-3/480/320', caption: 'Soba za porodicu' },
    ],
    contact: { phone: '+382 33 555 111', email: 'info@adriatic-petrovac.me', address: 'Šetalište 5, Petrovac' },
  },
];

export default function ProductPreviewCard() {
  const [activeId, setActiveId] = useState(MOCK_HOTELS[0].id);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const active = MOCK_HOTELS.find((h) => h.id === activeId) ?? MOCK_HOTELS[0];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Traka do 3 "taba" — istorija poslednjih pregledanih proizvoda (mock: sva tri unapred
          popunjena da se vidi izgled trake; u Fazi B se popunjava stvarnim klikovima, LRU
          max 3, najstariji ispada). */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        {MOCK_HOTELS.map((h) => (
          <button
            key={h.id}
            onClick={() => setActiveId(h.id)}
            className={`truncate rounded px-2 py-1 text-[11px] font-medium ${
              h.id === activeId ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
            }`}
            style={{ maxWidth: '33%' }}
          >
            {h.name}
          </button>
        ))}
      </div>

      <div className="group relative flex-1 overflow-y-auto p-2">
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {active.photos.map((p) => (
            <button
              key={p.url}
              onClick={() => setLightbox(p.url)}
              className="overflow-hidden rounded-md border border-border"
              title={p.caption}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption} className="aspect-[3/2] w-full object-cover" />
            </button>
          ))}
        </div>

        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            {/* Kategorija hotela pored naziva + država/destinacija ispod (26.8.2026, na zahtev
                vlasnika: "dodahte samo da se ispod naziva hotela napise drzava i destinacija i
                da pored naziva hotela buide napisana kategorija hotela 5*"). */}
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{active.name}</span>
              <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-warn">{active.stars}*</span>
            </div>
            <div className="text-[11px] text-ink-faint">
              {active.country}, {active.city}
            </div>
          </div>
          <AddToAiContextButton refLabel={active.name} />
        </div>
        <p className="mb-3 text-xs leading-relaxed text-ink-dim">{active.description}</p>

        <button
          onClick={() => alert('Faza B: otvara pun tab u centralnom panelu sa punom galerijom/opisom.')}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
        >
          <Icon name="link-external" /> Prikaži pun opis
        </button>

        <div className="rounded-lg border border-border bg-panel p-2 text-[11px]">
          <div className="mb-1 font-medium text-ink-faint">Kontakt (Faza B — prikazuje se kad je otvoren pun tab)</div>
          <div className="text-ink-dim">{active.contact.phone}</div>
          <div className="text-ink-dim">{active.contact.email}</div>
          <div className="text-ink-dim">{active.contact.address}</div>
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
