'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
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
// Stanje filtera i dalje ide u adresu (`?tip=&status=&drzava=&grad=&konekcija=&q=`), isto kao
// ranije — samo se sad UNOSI iz levog panela umesto vodoravne trake iznad rezultata.

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

function connectionLabel(key: string): string {
  if (key === 'CONTRACTED') return 'Direktan ugovor';
  const provider = key.slice('API:'.length);
  return PROVIDER_LABELS[provider] ?? provider;
}

export interface KatalogFilters {
  tip: string;
  status: string;
  drzava: string;
  grad: string;
  konekcija: string;
  q: string;
}

export function readKatalogFilters(sp: URLSearchParams): KatalogFilters {
  return {
    tip: sp.get('tip') ?? '',
    status: sp.get('status') ?? '',
    drzava: sp.get('drzava') ?? '',
    grad: sp.get('grad') ?? '',
    konekcija: sp.get('konekcija') ?? '',
    q: sp.get('q') ?? '',
  };
}

function buildHref(f: KatalogFilters): string {
  const qs = new URLSearchParams();
  if (f.tip) qs.set('tip', f.tip);
  if (f.status) qs.set('status', f.status);
  if (f.drzava) qs.set('drzava', f.drzava);
  if (f.grad) qs.set('grad', f.grad);
  if (f.konekcija) qs.set('konekcija', f.konekcija);
  if (f.q) qs.set('q', f.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `/katalog${suffix}`;
}

const FILTER_TITLE_CLASS = 'block w-full text-[10px] font-bold uppercase tracking-wide text-ink-dim';
const FILTER_BLOCK_CLASS = 'rounded bg-sunken p-2';
const FILTER_PILL_CLASS =
  'cursor-pointer rounded border border-border bg-panel text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong';

const TEXT_DEBOUNCE_MS = 300;

export default function KatalogSidebarPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const { products } = useKatalog();
  const filters = readKatalogFilters(sp);
  const [qDraft, setQDraft] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(next: Partial<KatalogFilters>) {
    router.replace(buildHref({ ...filters, ...next }));
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
    const scoped = filters.drzava ? products.filter((p) => p.destinationCountry === filters.drzava) : products;
    return [...new Set(scoped.map((p) => p.destinationCity).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sr'));
  }, [products, filters.drzava]);
  const connections = useMemo(() => {
    const keys = new Set(products.map(connectionKey));
    return [...keys].sort((a, b) => connectionLabel(a).localeCompare(connectionLabel(b), 'sr'));
  }, [products]);

  const activeCount = [filters.tip, filters.status, filters.drzava, filters.grad, filters.konekcija, filters.q].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
      {activeCount > 0 && (
        <div className="flex items-center justify-between rounded border border-accent bg-accent-soft px-2 py-1 text-[11px] text-accent-strong">
          <span>
            {activeCount} {activeCount === 1 ? 'aktivan filter' : 'aktivnih filtera'}
          </span>
          <button
            type="button"
            onClick={() => {
              setQDraft('');
              router.replace('/katalog');
            }}
            className="flex items-center gap-1 hover:underline"
          >
            <Icon name="clear-all" /> poništi filtere
          </button>
        </div>
      )}

      <label className={`block text-ink-faint ${FILTER_BLOCK_CLASS}`}>
        <span className={FILTER_TITLE_CLASS}>naziv</span>
        <div className="mt-1 flex items-center gap-1.5">
          <Icon name="search" className="text-ink-faint" />
          <input value={qDraft} onChange={(e) => applyQ(e.target.value)} placeholder="pretraga po nazivu…" className="input bg-panel" />
        </div>
      </label>

      <ComboFilter
        label="država"
        value={filters.drzava}
        options={countries}
        onPick={(v) => apply({ drzava: v, grad: v && v !== filters.drzava ? '' : filters.grad })}
      />
      <ComboFilter label="destinacija" value={filters.grad} options={cities} onPick={(v) => apply({ grad: v })} />

      <PillGroup label="vrsta" value={filters.tip} onPick={(v) => apply({ tip: v })} options={TYPE_OPTIONS} />
      <PillGroup label="status" value={filters.status} onPick={(v) => apply({ status: v })} options={STATUS_OPTIONS} />
      {connections.length > 0 && (
        <PillGroup
          label="konekcija"
          value={filters.konekcija}
          onPick={(v) => apply({ konekcija: v })}
          options={connections.map((k) => ({ value: k, label: connectionLabel(k) }))}
        />
      )}
    </div>
  );
}

// Dizajn dok. §6f — jednostruk izbor iz malog skupa: red dugmadi, tačno jedno aktivno, uz "sve"
// koje ga vraća na prazno (isti obrazac kao `PillRadioGroup` u `SearchSidebarPanel.tsx`).
function PillGroup({
  label,
  value,
  onPick,
  options,
}: {
  label: string;
  value: string;
  onPick: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={`text-ink-faint ${FILTER_BLOCK_CLASS}`}>
      <span className={FILTER_TITLE_CLASS}>{label}</span>
      {/* Jedan ispod drugog, cela širina levog panela (4.9.2026, na zahtev vlasnika) — isti
          `stack` obrazac kao "vrsta usluge" u `SearchSidebarPanel.tsx`, ovde primenjen na sve
          grupe u ovom panelu (uzak panel, ne red pored reda kao u vodoravnoj traci). */}
      <div className="mt-1 flex flex-col items-stretch gap-1">
        <label key="sve" className={`w-full px-2 py-1 text-[11px] ${FILTER_PILL_CLASS}`}>
          <input type="radio" checked={value === ''} onChange={() => onPick('')} className="sr-only" />
          sve
        </label>
        {options.map((o) => (
          <label key={o.value} className={`w-full px-2 py-1 text-[11px] ${FILTER_PILL_CLASS}`}>
            <input type="radio" checked={value === o.value} onChange={() => onPick(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// Dizajn dok. §6f — veliki/otvoren skup (država, grad): `Command` u `Popover`-u umesto dugmadi
// ili `<select>`, isti obrazac kao birač sastojaka paketa (`PackageAttributesEditor.tsx`).
function ComboFilter({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

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
            <span className="truncate">{value || (options.length === 0 ? 'nema podataka' : 'sve')}</span>
            <Icon name="chevron-down" className="text-ink-faint" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder={`pretraga — ${label}…`} />
            <CommandList>
              <CommandEmpty>Nema rezultata.</CommandEmpty>
              <CommandItem
                value="sve"
                onSelect={() => {
                  onPick('');
                  setOpen(false);
                }}
              >
                sve
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onPick(o);
                    setOpen(false);
                  }}
                >
                  {o}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
