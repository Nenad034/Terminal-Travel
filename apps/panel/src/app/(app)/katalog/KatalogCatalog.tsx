'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  sourceProvider?: string | null;
  translations?: { languageCode: string; name: string }[];
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

function connectionKey(p: Pick<Product, 'sourceType' | 'sourceProvider'>): string {
  return p.sourceType === 'CONTRACTED' ? 'CONTRACTED' : `API:${p.sourceProvider ?? ''}`;
}

function connectionLabel(key: string): string {
  if (key === 'CONTRACTED') return 'Direktan ugovor';
  const provider = key.slice('API:'.length);
  return PROVIDER_LABELS[provider] ?? provider;
}

interface Filters {
  tip: string;
  status: string;
  drzava: string;
  grad: string;
  konekcija: string;
  q: string;
}

function readFilters(sp: URLSearchParams): Filters {
  return {
    tip: sp.get('tip') ?? '',
    status: sp.get('status') ?? '',
    drzava: sp.get('drzava') ?? '',
    grad: sp.get('grad') ?? '',
    konekcija: sp.get('konekcija') ?? '',
    q: sp.get('q') ?? '',
  };
}

function buildHref(f: Filters): string {
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

const PILL_CLASS = (on: boolean) =>
  `rounded-full border px-2 py-0.5 ${
    on ? 'border-accent bg-accent-soft font-semibold text-accent-strong' : 'border-border text-ink-dim hover:border-accent hover:text-ink'
  }`;

const TEXT_DEBOUNCE_MS = 300;

export default function KatalogCatalog({ products }: { products: Product[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = readFilters(sp);
  const [qDraft, setQDraft] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(next: Partial<Filters>) {
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

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return products.filter((p) => {
      if (filters.tip && p.type !== filters.tip) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.drzava && p.destinationCountry !== filters.drzava) return false;
      if (filters.grad && p.destinationCity !== filters.grad) return false;
      if (filters.konekcija && connectionKey(p) !== filters.konekcija) return false;
      if (q) {
        const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '';
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, filters]);

  const activeCount = [filters.tip, filters.status, filters.drzava, filters.grad, filters.konekcija, filters.q].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-sunken p-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex items-center gap-1.5">
            <Icon name="search" className="text-ink-faint" />
            <input
              value={qDraft}
              onChange={(e) => applyQ(e.target.value)}
              placeholder="pretraga po nazivu…"
              className="input h-6 w-40 bg-panel py-0.5 text-xs"
            />
          </label>

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

          <ComboFilter
            label="država"
            value={filters.drzava}
            options={countries}
            onPick={(v) => apply({ drzava: v, grad: v && v !== filters.drzava ? '' : filters.grad })}
          />
          <ComboFilter label="destinacija" value={filters.grad} options={cities} onPick={(v) => apply({ grad: v })} />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setQDraft('');
                router.replace('/katalog');
              }}
              className="ml-auto flex items-center gap-1 text-ink-faint hover:text-ink"
            >
              <Icon name="clear-all" /> poništi filtere ({activeCount})
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-ink-faint">
        {filtered.length} {filtered.length === 1 ? 'proizvod' : 'proizvoda'} {activeCount > 0 && <>od ukupno {products.length}</>}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="text-xs text-ink-faint">{products.length === 0 ? 'Nema proizvoda u katalogu.' : 'Nijedan proizvod ne odgovara izabranim filterima.'}</p>
        )}
        {filtered.map((p) => {
          const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '(bez naziva)';
          return (
            <TabLink
              key={p.id}
              href={`/katalog/${p.id}`}
              label={name}
              className="rounded-lg border border-border bg-panel p-4 hover:border-accent"
              dragPayload={{
                key: `katalog:${p.id}`,
                moduleId: 'katalog-nabavka',
                label: name,
                subtitle: `${p.type} — ${p.destinationCity}, ${p.destinationCountry}`,
                href: `/katalog/${p.id}`,
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="outline" className="border-transparent bg-accent2-soft text-accent2">
                  {p.type}
                </Badge>
                <Badge variant={p.status === 'ACTIVE' ? 'ok' : 'secondary'} className={p.status === 'ACTIVE' ? '' : 'text-ink-faint'}>
                  {p.status}
                </Badge>
              </div>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-faint">
                {p.destinationCity}, {p.destinationCountry}
              </div>
            </TabLink>
          );
        })}
      </div>
    </div>
  );
}

// Dizajn dok. §6f — jednostruk izbor iz malog skupa: red dugmadi, tačno jedno aktivno, klik na
// već aktivno ga NE deselektuje osim preko "sve" (isti obrazac kao `PillRadioGroup` u
// `SearchSidebarPanel.tsx`/`SortBar.tsx`, ovde kao vodoravna grupa umesto bloka u koloni).
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
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-ink-faint">{label}:</span>
      <button type="button" onClick={() => onPick('')} aria-pressed={value === ''} className={PILL_CLASS(value === '')}>
        sve
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onPick(o.value)} aria-pressed={value === o.value} className={PILL_CLASS(value === o.value)}>
          {o.label}
        </button>
      ))}
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
  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-faint">{label}:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-6 gap-1 rounded-full px-2 py-0 text-xs font-normal">
            {value || 'sve'} <Icon name="chevron-down" className="text-ink-faint" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder={`pretraga — ${label}…`} />
            <CommandList>
              <CommandEmpty>Nema rezultata.</CommandEmpty>
              <CommandItem value="sve" onSelect={() => { onPick(''); setOpen(false); }}>
                sve
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onPick(o); setOpen(false); }}>
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
