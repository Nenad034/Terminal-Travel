'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { SAVED_VIEWS_CHANGED_EVENT, type SavedView } from '@/components/SavedViewsSidebarPanel';
import { useAiContext } from '@/components/AiContextContext';
import RealBookingsTable, { type RealBooking } from './RealBookingsTable';
import PeriodQuickFilter from './PeriodQuickFilter';

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
      // Multiselect (24.8.2026) — ponovljen ključ (`status=A&status=B`) mora sačuvati SVE
      // vrednosti kao niz, ne samo poslednju (prost `filters[key] = value` bi tiho izgubio sve
      // osim poslednje pri ponovljenom ključu).
      const filters: Record<string, string | string[]> = {};
      searchParams.forEach((value, key) => {
        const existingValue = filters[key];
        if (existingValue === undefined) filters[key] = value;
        else if (Array.isArray(existingValue)) existingValue.push(value);
        else filters[key] = [existingValue, value];
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

// Dugme "Dodaj filtrirani prikaz u AI kontekst" (25.8.2026, dizajn dok. §6c.1a, M15 spec
// §6.5.4.3 — "omoguci sacuvan rezultata pretrage da unesemo kao kontekst pa da analiziramo
// filtrirane stavke"). `view`/`filters` su TAČNO isti oblik koji već čita `filter_list` alat
// (filterable-views.ts, `id: 'bookings'`) — agent i dalje MORA pozvati taj alat da vidi stvarne
// redove, ovo samo prenosi TAČNO koji filter je korisnik gledao (deterministički, ne nagađanje).
function AddFilteredListButton({ resultCount }: { resultCount: number }) {
  const searchParams = useSearchParams();
  const { addFilteredList, hasFilteredList } = useAiContext();
  const hasFilters = Array.from(searchParams.keys()).length > 0;
  if (!hasFilters) return null;

  function add() {
    const filters: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      const existingValue = filters[key];
      if (existingValue === undefined) filters[key] = value;
      else if (Array.isArray(existingValue)) existingValue.push(value);
      else filters[key] = [existingValue, value];
    });
    addFilteredList({ view: 'bookings', filters, resultCount, label: 'Lista rezervacija' });
  }

  return (
    <button
      onClick={add}
      disabled={hasFilteredList}
      title={hasFilteredList ? 'Već je priložen jedan filtriran prikaz — ukloni ga u AI chat-u da dodaš drugi' : 'Dodaj trenutno filtriranu listu u AI kontekst radi analize'}
      className="flex h-[29px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon name="sparkle" /> Dodaj u AI kontekst
    </button>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "Tag" okidači +10/−10 (26.8.2026, na zahtev vlasnika: "Rezervacije u dolasku od danas u
// narednih 10 dana... ikona da izgleda ovako +10 (kao tag)... isto to za odlaske... -10...
// staviti ih u traku koja je stalno vidljiva u filterima, na sredinu"). Postavlja/uklanja ISTA
// dva polja koja `RealFilterBar` već razume (`stayFrom`/`stayTo` za dolazak, `returnFrom`/
// `returnTo` za odlazak, M5 spec §11) preko prave navigacije — nema nove filter logike, samo
// prečica za već postojeći opseg datuma. "Aktivno" stanje se prepoznaje po TAČNOM poklapanju
// trenutnih query parametara sa izračunatim opsegom (danas → danas+10), klik dok je aktivno
// uklanja ta dva parametra (isti "toggle" princip kao demo zvona/tip proizvoda dugmad).
function DateRangeTag({ label, icon, title, fromKey, toKey }: { label: string; icon: string; title: string; fromKey: string; toKey: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const from = formatDate(today);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 10);
  const to = formatDate(toDate);

  const active = searchParams.get(fromKey) === from && searchParams.get(toKey) === to;

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.delete(fromKey);
      params.delete(toKey);
    } else {
      params.set(fromKey, from);
      params.set(toKey, to);
    }
    router.push(`/rezervacije/lista${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <button
      onClick={toggle}
      title={title}
      className={`flex h-[26px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
        active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-ink-faint text-ink-faint hover:border-accent hover:text-ink'
      }`}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}

// Dopuna (24.8.2026, na zahtev vlasnika: "Filtere u listi rezervacija fixirajte da budu vidljivi
// prilikom scrolovanja") — jedan zajednički klijentski omotač koji drži i formu (`filterBar`,
// server-renderovan `RealFilterBar`, prosleđen kao `children`) i traku brzih ikonica (stanje
// premešteno ovde iz `RealBookingsTable.tsx`) unutar JEDNOG `position: sticky` bloka. Dva odvojena
// sticky elementa (forma + traka) bi se oba lepila za `top: 0` i preklapala — jedan omotač rešava
// to bez merenja visine/JS ResizeObserver-a, jer se ceo blok lepi kao jedna celina.
export default function BookingsListClient({ bookings, filterBar }: { bookings: RealBooking[]; filterBar: React.ReactNode }) {
  // Višestruki izbor (dopuna 25.8.2026, na zahtev vlasnika: "omoguciti biranje vise stavki") —
  // ranije je klik na drugu ikonicu ZAMENIO prethodni izbor (`string | null`, jedna vrednost).
  // Sad je to skup izabranih `Product.type` vrednosti — klik DODAJE/UKLANJA tu ikonicu iz skupa,
  // prazan skup = bez filtera (svi tipovi). Uzgred ispravlja postojeći bag: "Things to do" nosi
  // TRI tipa (EXCURSION/EVENT/TICKET, `search-product-types.ts`) — ranija logika je filtrirala
  // samo `types[0]` (EXCURSION), tiho ignorišući EVENT/TICKET; nova logika (ne)označava CEO
  // `p.types` skup te ikonice atomično, ne samo prvi element.
  const [productTypeFilters, setProductTypeFilters] = useState<string[]>([]);
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
          <div className="flex flex-wrap items-center gap-1.5">
            {PRODUCT_ICONS.filter((p) => p.types.length > 0).map((p) => {
              const active = p.types.some((t) => productTypeFilters.includes(t));
              return (
                <button
                  key={p.label}
                  onClick={() =>
                    setProductTypeFilters((cur) =>
                      active ? cur.filter((t) => !p.types.includes(t)) : [...cur, ...p.types.filter((t) => !cur.includes(t))],
                    )
                  }
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
          {/* Centrirani okidači +10/−10 (26.8.2026, na zahtev vlasnika: "staviti ih u traku
              koja je stalno vidljiva u filterima, na sredinu") — `flex-1 justify-center` na
              srednjem bloku prirodno gura levi/desni blok na svoje ivice bez sukoba sa
              `ml-auto` (uklonjen sa desnog bloka ispod, više nije potreban). Brz period
              Dan/Nedelja/Mesec (dopuna 27.8.2026, na zahtev vlasnika: "pregled na dnevnom
              mesecnom i nedeljnom nivou staviti i u listu rezervacija" — ISPRAVKA #2, uz snimak
              ekrana: "nisam mislio tu vec u prvi red brzih filtera koji je uvek vidljiv") — ide
              baš OVDE, u istu uvek-vidljivu traku kao +10/−10, odvojen razdelnikom kao posebna
              celina (ne u `RealFilterBar.tsx` formu, koja se dugmetom −/+ ispod može sakriti). */}
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <DateRangeTag label="+10" icon="sign-in" title="Dolasci od danas u narednih 10 dana" fromKey="stayFrom" toKey="stayTo" />
            <DateRangeTag label="-10" icon="sign-out" title="Odlasci od danas u narednih 10 dana" fromKey="returnFrom" toKey="returnTo" />
            <div className="mx-1 h-5 w-px bg-ink-faint/40" />
            <PeriodQuickFilter />
          </div>
          <div className="flex items-center gap-1.5">
            <AddFilteredListButton resultCount={bookings.length} />
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
        <RealBookingsTable bookings={bookings} productTypeFilters={productTypeFilters} demoOnly={demoOnly} />
      </div>
    </>
  );
}
