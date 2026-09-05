'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SidebarSection from './SidebarSection';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';
import { useKatalog } from './KatalogContext';
import type { Product } from '@/app/(app)/katalog/KatalogCatalog';

// Filteri kataloga (M2), preseljeni u levi panel (4.9.2026, na zahtev vlasnika: "ove filtere
// stavite u levi panel kao sto smo uradili kod pretrage") — isti obrazac kao
// `SearchSidebarPanel.tsx` (Sidebar.tsx bira panel po `selected.id`, dizajn dok. §5b/§6d).
// Podaci (lista proizvoda) dolaze iz `KatalogContext` (stranica `/katalog` ih upiše preko
// `setProducts`), jer je Sidebar van stabla stranice — isti razlog kao `SearchStateContext`.
//
// Višestruk izbor (4.9.2026, na zahtev vlasnika: "omogucite i multiasking") — svaka grupa
// (osim pretrage po nazivu) prihvata VIŠE izabranih vrednosti odjednom, ne samo jednu; isti
// obrazac kao `PillCheckboxGroup`/multiselekt filteri u `RealFilterBar.tsx` (24.8.2026, "u
// svakom polju filtera gde je to moguce multiselect opciju"). Vrednosti unutar iste grupe se
// ILI-uju (npr. "Smeštaj" ILI "Let"), grupe međusobno I-uju. Adresa nosi ponovljen parametar
// (`?tip=FLIGHT&tip=ACCOMMODATION`), isti oblik kao `Query('type') string[]` svuda drugde u
// panelu (Next.js `searchParams`/`URLSearchParams.getAll`).
export interface KatalogFilters {
  tip: string[];
  status: string[];
  drzava: string[];
  grad: string[];
  konekcija: string[];
  q: string;
}

// Dizajn dok. §6f — mali, poznat skup (10 vrednosti `ProductType`, M2 spec poglavlje 2.1) ide
// kao dugmad, ne padajući meni. Redosled prati enum u `schema.prisma`.
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ACCOMMODATION', label: 'Smeštaj' },
  { value: 'PACKAGE', label: 'Grupni paket' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'EXCURSION', label: 'Izlet' },
  { value: 'FLIGHT', label: 'Let' },
  { value: 'INSURANCE', label: 'Osiguranje' },
  { value: 'TRANSPORT', label: 'Rent-a-car' },
  { value: 'TICKET', label: 'Ulaznica' },
  { value: 'EVENT', label: 'Događaj' },
  { value: 'CRUISE', label: 'Krstarenje' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'DRAFT', label: 'Nacrt' },
  { value: 'ACTIVE', label: 'Aktivan' },
  { value: 'INACTIVE', label: 'Neaktivan' },
  { value: 'ARCHIVED', label: 'Arhiviran' },
];

// Poznati M4 provajderi (poglavlje 2.1: `source_provider`, popunjeno samo kad `source_type =
// API`) — samo za lepši naziv u pilulama; nepoznat/nov provajder i dalje radi, prikazuje se sa
// sirovim kodom (isto pravilo kao nepoznata šifra države, dizajn dok. §6h).
const PROVIDER_LABELS: Record<string, string> = {
  travelgate: 'Travelgate',
  solvex: 'Solvex',
  webhotelier: 'WebHotelier',
};

export function connectionKey(p: Pick<Product, 'sourceType' | 'sourceProvider'>): string {
  return p.sourceType === 'CONTRACTED' ? 'CONTRACTED' : `API:${p.sourceProvider ?? ''}`;
}

// Uz naziv ide i vrsta konekcije (4.9.2026, na zahtev vlasnika: "Kod konekcije stavite pored
// Direktan ugovor i Api") — "Direktan ugovor" već govori šta jeste, ali API provajderi su do
// sada stajali samo pod svojim imenom (npr. "Travelgate") bez oznake da je reč o API konekciji.
function connectionLabel(key: string): string {
  if (key === 'CONTRACTED') return 'Direktan ugovor';
  const provider = key.slice('API:'.length);
  return `${PROVIDER_LABELS[provider] ?? provider} (API)`;
}

export function readKatalogFilters(sp: URLSearchParams): KatalogFilters {
  return {
    tip: sp.getAll('tip'),
    status: sp.getAll('status'),
    drzava: sp.getAll('drzava'),
    grad: sp.getAll('grad'),
    konekcija: sp.getAll('konekcija'),
    q: sp.get('q') ?? '',
  };
}

function buildHref(f: KatalogFilters): string {
  const qs = new URLSearchParams();
  for (const v of f.tip) qs.append('tip', v);
  for (const v of f.status) qs.append('status', v);
  for (const v of f.drzava) qs.append('drzava', v);
  for (const v of f.grad) qs.append('grad', v);
  for (const v of f.konekcija) qs.append('konekcija', v);
  if (f.q) qs.set('q', f.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/katalog${suffix}`;
}

type MultiKey = 'tip' | 'status' | 'drzava' | 'grad' | 'konekcija';

const FILTER_TITLE_CLASS = 'block w-full text-[10px] font-bold uppercase tracking-wide text-ink-dim';
const FILTER_BLOCK_CLASS = 'rounded bg-sunken p-2';
const FILTER_PILL_CLASS =
  'cursor-pointer rounded border border-border bg-panel font-semibold text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong';

const TEXT_DEBOUNCE_MS = 300;

export default function KatalogSidebarPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const { products } = useKatalog();
  const filters = readKatalogFilters(sp);
  const [qDraft, setQDraft] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sklopivo (5.9.2026, vlasnikov zahtev — isti princip primenjen i kod ostalih pretraga),
  // isti obrazac kao "Filteri" u SearchSidebarPanel.tsx.
  const [filtersOpen, setFiltersOpen] = useState(true);

  function apply(next: Partial<KatalogFilters>) {
    router.replace(buildHref({ ...filters, ...next }));
  }

  function toggle(key: MultiKey, value: string) {
    const current = filters[key];
    apply({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  }

  function applyQ(value: string) {
    setQDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => apply({ q: value }), TEXT_DEBOUNCE_MS);
  }

  // Država/grad/konekcija nisu statičan skup (M2 spec §2.1a — "Grčka" naspram "GR" je već
  // rešeno, ali koje sve države/gradove/provajdere katalog stvarno ima ne zna se unapred) —
  // izvedeno iz stvarnih podataka, ne iz ručno pisane liste (isti razlog kao `findIconByTypes`
  // u `search-product-types.ts`: statična lista tiho zastari čim se doda novi ugovor/provajder).
  const countries = useMemo(
    () => [...new Set(products.map((p) => p.destinationCountry).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sr')),
    [products],
  );
  const cities = useMemo(() => {
    const scoped = filters.drzava.length > 0 ? products.filter((p) => filters.drzava.includes(p.destinationCountry)) : products;
    return [...new Set(scoped.map((p) => p.destinationCity).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sr'));
  }, [products, filters.drzava]);
  const connections = useMemo(() => {
    const keys = new Set(products.map(connectionKey));
    return [...keys].sort((a, b) => connectionLabel(a).localeCompare(connectionLabel(b), 'sr'));
  }, [products]);

  // Aktivni filteri kao pojedinačno uklonjive pilule (4.9.2026, na zahtev vlasnika: "omogucite
  // brisanje pojedinacih filtera ne samo sve zajedno") — svaka izabrana vrednost (ne samo svaka
  // grupa) dobija sopstveni × koji gasi SAMO nju, ostatak grupe ostaje netaknut.
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.q ? [{ key: 'q', label: `naziv: ${filters.q}`, onRemove: () => { setQDraft(''); apply({ q: '' }); } }] : []),
    ...filters.drzava.map((v) => ({ key: `drzava:${v}`, label: `država: ${v}`, onRemove: () => toggle('drzava', v) })),
    ...filters.grad.map((v) => ({ key: `grad:${v}`, label: `destinacija: ${v}`, onRemove: () => toggle('grad', v) })),
    ...filters.tip.map((v) => ({
      key: `tip:${v}`,
      label: `vrsta: ${TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v}`,
      onRemove: () => toggle('tip', v),
    })),
    ...filters.status.map((v) => ({
      key: `status:${v}`,
      label: `status: ${STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}`,
      onRemove: () => toggle('status', v),
    })),
    ...filters.konekcija.map((v) => ({ key: `konekcija:${v}`, label: `konekcija: ${connectionLabel(v)}`, onRemove: () => toggle('konekcija', v) })),
  ];

  return (
    <div className="flex flex-col overflow-y-auto px-2 pb-3 text-xs">
    <SidebarSection title="Filteri" icon="filter" open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} contentClassName="flex flex-col gap-3">
      {activeChips.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded border border-accent bg-accent-soft p-1.5 text-[11px] text-accent-strong">
          <div className="flex flex-wrap gap-1">
            {activeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.onRemove}
                title={`ukloni filter — ${c.label}`}
                className="flex items-center gap-1 rounded-full border border-accent bg-panel px-2 py-0.5 hover:bg-danger-bg hover:text-danger"
              >
                <span className="truncate">{c.label}</span>
                <Icon name="close" />
              </button>
            ))}
          </div>
          {activeChips.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setQDraft('');
                router.replace('/katalog');
              }}
              className="flex items-center gap-1 self-start hover:underline"
            >
              <Icon name="clear-all" /> poništi sve ({activeChips.length})
            </button>
          )}
        </div>
      )}

      <label className={`block text-ink-faint ${FILTER_BLOCK_CLASS}`}>
        <span className={FILTER_TITLE_CLASS}>naziv</span>
        <input value={qDraft} onChange={(e) => applyQ(e.target.value)} placeholder="pretraga po nazivu…" className="input mt-1 bg-panel" />
      </label>

      <ComboFilter label="država" values={filters.drzava} options={countries} onToggle={(v) => toggle('drzava', v)} />
      <ComboFilter label="destinacija" values={filters.grad} options={cities} onToggle={(v) => toggle('grad', v)} />

      <PillGroup label="vrsta" values={filters.tip} onToggle={(v) => toggle('tip', v)} options={TYPE_OPTIONS} />
      <PillGroup label="status" values={filters.status} onToggle={(v) => toggle('status', v)} options={STATUS_OPTIONS} />
      {connections.length > 0 && (
        <PillGroup
          label="konekcija"
          values={filters.konekcija}
          onToggle={(v) => toggle('konekcija', v)}
          options={connections.map((k) => ({ value: k, label: connectionLabel(k) }))}
        />
      )}
    </SidebarSection>
    </div>
  );
}

// Dizajn dok. §6f — višestruk izbor iz malog skupa: red dugmadi, svako nezavisan prekidač
// (klik uključuje, ponovni klik isključuje — "dva klika za ono što ne želim", isti obrazac kao
// `PillCheckboxGroup` u `SearchSidebarPanel.tsx`). Bez "sve" opcije — nijedna izabrana VEĆ
// znači "sve", isti princip kao amenity-tag grupe.
function PillGroup({
  label,
  values,
  onToggle,
  options,
}: {
  label: string;
  values: string[];
  onToggle: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={`text-ink-faint ${FILTER_BLOCK_CLASS}`}>
      <span className={FILTER_TITLE_CLASS}>{label}</span>
      {/* Jedan ispod drugog, cela širina levog panela (4.9.2026, na zahtev vlasnika) — isti
          `stack` obrazac kao "vrsta usluge" u `SearchSidebarPanel.tsx`. */}
      <div className="mt-1 flex flex-col items-stretch gap-1">
        {options.map((o) => (
          <label key={o.value} className={`w-full px-2 py-1 text-[11px] ${FILTER_PILL_CLASS}`}>
            <input type="checkbox" checked={values.includes(o.value)} onChange={() => onToggle(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// Dizajn dok. §6f — veliki/otvoren skup (država, grad): `Command` u `Popover`-u umesto dugmadi
// ili `<select>`, isti obrazac kao birač sastojaka paketa (`PackageAttributesEditor.tsx`).
// Popover ostaje otvoren posle svakog izbora — više vrednosti se biraju u nizu, isti razlog kao
// tamo (zatvaranje posle svakog klika bi tražilo ponovno otvaranje za svaku sledeću vrednost).
function ComboFilter({
  label,
  values,
  options,
  onToggle,
}: {
  label: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = values.length === 0 ? (options.length === 0 ? 'nema podataka' : 'sve') : values.length <= 2 ? values.join(', ') : `${values.length} izabrano`;

  return (
    <div className={`text-ink-faint ${FILTER_BLOCK_CLASS}`}>
      <span className={FILTER_TITLE_CLASS}>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={options.length === 0}
            className="mt-1 h-7 w-full justify-between bg-panel text-xs font-normal"
          >
            <span className="truncate">{summary}</span>
            <Icon name="chevron-down" className="text-ink-faint" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder={`pretraga — ${label}…`} />
            <CommandList>
              <CommandEmpty>Nema rezultata.</CommandEmpty>
              {options.map((o) => {
                const checked = values.includes(o);
                return (
                  <CommandItem key={o} value={o} onSelect={() => onToggle(o)}>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{o}</span>
                      {checked && <Icon name="check" className="text-accent-strong" />}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
