'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { SAVED_VIEWS_CHANGED_EVENT, type SavedView } from '@/components/SavedViewsSidebarPanel';
import RealBookingsTable, { type RealBooking } from './RealBookingsTable';

const PREFERENCE_KEY = 'saved_views.rezervacije_lista';

function newViewId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v${Date.now()}${Math.random()}`;
}

// Dugme "Sačuvaj ovu pretragu" (24.8.2026, na zahtev vlasnika, dizajn dok. §5b) — čuva TRENUTNE
// stvarne filtere liste (`RealFilterBar`/`GET /sales/bookings` query parametri, iz URL-a preko
// `useSearchParams`) pod imenom koje agent unese. Klijentski-samo brzi filteri (tip proizvoda,
// "demo zvona") NAMERNO nisu uključeni — oni ne postoje u URL-u, ostaju van sačuvanog prikaza,
// isti obim kao ono što `RealFilterBar` info traka na vrhu ekrana već obećava kao "prave filtere".
function SaveViewButton() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const filters: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        filters[key] = value;
      });
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedView[] = Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : [];
      const next = [...existing, { id: newViewId(), name: name.trim(), filters }];
      await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      setOpen(false);
      setName('');
    } finally {
      setSaving(false);
    }
  }

  if (!hasFilters) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Sačuvaj trenutnu pretragu — pojaviće se u levom panelu"
        className="flex h-[29px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint hover:border-accent hover:text-accent"
      >
        <Icon name="bookmark" /> Sačuvaj pretragu
      </button>
      {open && (
        <div className="absolute right-0 top-[33px] z-30 w-64 rounded-lg border border-border bg-panel p-2 shadow-lg">
          <label className="mb-1 block text-[11px] text-ink-faint">Naziv</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="npr. Čeka potvrdu dobavljača"
            className="mb-2 w-full rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-[11px] text-ink-faint hover:text-ink">
              Otkaži
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="rounded bg-accent px-3 py-1 text-[11px] font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              {saving ? '…' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dopuna (24.8.2026, na zahtev vlasnika: "Filtere u listi rezervacija fixirajte da budu vidljivi
// prilikom scrolovanja") — jedan zajednički klijentski omotač koji drži i formu (`filterBar`,
// server-renderovan `RealFilterBar`, prosleđen kao `children`) i traku brzih ikonica (stanje
// premešteno ovde iz `RealBookingsTable.tsx`) unutar JEDNOG `position: sticky` bloka. Dva odvojena
// sticky elementa (forma + traka) bi se oba lepila za `top: 0` i preklapala — jedan omotač rešava
// to bez merenja visine/JS ResizeObserver-a, jer se ceo blok lepi kao jedna celina.
export default function BookingsListClient({ bookings, filterBar }: { bookings: RealBooking[]; filterBar: React.ReactNode }) {
  const [productTypeFilter, setProductTypeFilter] = useState<string | null>(null);
  const [demoOnly, setDemoOnly] = useState(false);
  // Uklanjanje/vraćanje filtera (24.8.2026, na zahtev vlasnika: "Omogucite i uklanjanje filtera
  // na - i ponovno pojavljivanje na + u listi rezervacija") — dugme na traci ostaje UVEK vidljivo
  // (deo istog sticky bloka) da postoji siguran način da se filteri vrate; ostatak (forma + traka
  // ikonica) se sklanja/vraća ispod njega. Aktivni filteri (URL parametri, productTypeFilter,
  // demoOnly) ostaju primenjeni dok su sklonjeni — ovo je samo vizuelni prostor, ne brisanje.
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-panel pb-2">
        {/* Traka ikonica — UVEK vidljiva (24.8.2026, na zahtev vlasnika, uz snimak ekrana:
            "ova traka neka uvek bude vidljiva u desnom kraju stavite - i + kako bi se ostali
            filteri pojavili ispod ove trake"). Dugme −/+ premešteno na desni kraj OVE trake —
            sklapa/otvara samo formu (`RealFilterBar` + "Sačuvaj pretragu") ispod, ne i ovu
            traku. */}
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
          <div className="ml-auto">
            <SaveViewButton />
          </div>
          <button
            onClick={() => setFiltersCollapsed((v) => !v)}
            title={filtersCollapsed ? 'Prikaži ostale filtere' : 'Sakrij ostale filtere'}
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-ink"
          >
            <Icon name={filtersCollapsed ? 'add' : 'remove'} />
          </button>
        </div>
        {!filtersCollapsed && <div className="mt-2">{filterBar}</div>}
      </div>

      <div className="mt-2">
        <RealBookingsTable bookings={bookings} productTypeFilter={productTypeFilter} demoOnly={demoOnly} />
      </div>
    </>
  );
}
