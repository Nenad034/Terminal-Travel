'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import RealBookingsTable, { type RealBooking } from './RealBookingsTable';

// Dopuna (24.8.2026, na zahtev vlasnika: "Filtere u listi rezervacija fixirajte da budu vidljivi
// prilikom scrolovanja") — jedan zajednički klijentski omotač koji drži i formu (`filterBar`,
// server-renderovan `RealFilterBar`, prosleđen kao `children`) i traku brzih ikonica (stanje
// premešteno ovde iz `RealBookingsTable.tsx`) unutar JEDNOG `position: sticky` bloka. Dva odvojena
// sticky elementa (forma + traka) bi se oba lepila za `top: 0` i preklapala — jedan omotač rešava
// to bez merenja visine/JS ResizeObserver-a, jer se ceo blok lepi kao jedna celina.
export default function BookingsListClient({ bookings, filterBar }: { bookings: RealBooking[]; filterBar: React.ReactNode }) {
  const [productTypeFilter, setProductTypeFilter] = useState<string | null>(null);
  const [demoOnly, setDemoOnly] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-panel pb-2">
        {filterBar}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel p-2">
          {PRODUCT_ICONS.filter((p) => p.types.length > 0).map((p) => {
            const active = productTypeFilter !== null && p.types.includes(productTypeFilter);
            return (
              <button
                key={p.label}
                onClick={() => setProductTypeFilter((cur) => (cur && p.types.includes(cur) ? null : p.types[0]))}
                title={`Filtriraj: ${p.label}`}
                className={`flex h-[26px] w-[26px] items-center justify-center rounded ${active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel2 hover:text-ink'}`}
              >
                <Icon name={p.icon} />
              </button>
            );
          })}
          <div className="mx-1 h-5 w-px bg-ink-faint/40" />
          <button
            onClick={() => setDemoOnly((v) => !v)}
            title={demoOnly ? 'Ukloni filter "samo demo zvona"' : 'Prikaži samo redove sa demo zvonom (nije stvaran signal)'}
            className={`flex h-[26px] items-center gap-1.5 rounded px-2 text-[11px] ${demoOnly ? 'bg-panel2 text-ink' : 'text-ink-faint hover:bg-panel2'}`}
          >
            <Icon name="bell" /> demo zvona
          </button>
        </div>
      </div>

      <div className="mt-2">
        <RealBookingsTable bookings={bookings} productTypeFilter={productTypeFilter} demoOnly={demoOnly} />
      </div>
    </>
  );
}
