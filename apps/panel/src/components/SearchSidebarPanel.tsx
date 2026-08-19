'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from './Icon';

const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT'];

// Dizajn dok. §5b tabela — devet ikonica po vrsti turističkog proizvoda, "stablo-grana"
// unutar "Pretraga i rezervacije". `types` prazan niz = "Individualni paketi" (locked, čeka
// Itinerary tok — M5 spec §3.0d.5, nije još izgrađen) nema svoj Product.type. "Krstarenja"
// je locked jer `CRUISE` ne postoji u `ProductType` enumu (schema.prisma) iako ga dizajn dok.
// pominje kao "dodat 17.8.2026" — nesklad otkriven pri implementaciji, upisan u M5 spec, ne
// prećutan; dodavanje bi bila šema migracija, van obima ove ikonice-samo izmene.
const PRODUCT_ICONS: { label: string; icon: string; types: string[]; locked?: string }[] = [
  { label: 'Smeštaj', icon: 'home', types: ['ACCOMMODATION'] },
  { label: 'Letovi', icon: 'rocket', types: ['FLIGHT'] },
  { label: 'Transferi', icon: 'arrow-swap', types: ['TRANSFER'] },
  { label: 'Rent-a-car', icon: 'milestone', types: ['TRANSPORT'] },
  { label: 'Things to do', icon: 'compass', types: ['EXCURSION', 'EVENT', 'TICKET'] },
  { label: 'Individualni paketi', icon: 'map', types: [], locked: 'Itinerar builder još nije izgrađen (M5 spec §3.0d.5)' },
  { label: 'Grupni paketi', icon: 'gift', types: ['PACKAGE'] },
  { label: 'Krstarenja', icon: 'globe', types: [], locked: 'CRUISE tip proizvoda još ne postoji u šemi (nesklad sa dizajn dokumentom, upisano u M5 spec)' },
  { label: 'Putno osiguranje', icon: 'shield', types: ['INSURANCE'] },
];

// Dizajn dok. §5b/§6d — vođena pretraga i filteri žive u levom panelu, ne u centru (centar
// ostaje isključivo prikaz rezultata). Prvi, uzak rez (19.8.2026, na zahtev vlasnika):
// jedan zajednički <form> (bez toga bi drugi deo izgubio polja prvog na submit), dve
// sklopive sekcije. NAMERNO van obima ovog rezanja (upisano u M17/M5 spec, sledeći koraci):
// devet ikonica po tipu proizvoda (§5b), grupisani filteri po kategoriji sa potpragovima
// (§6d), sadržaji-tagovi, sačuvani prikazi. "Refundabilno/Nerefundabilno" brzi filter iz §6d
// nije uključen — `cancellationPolicySummary` je slobodan tekst na API-ju, nema strukturno
// polje da se pouzdano filtrira (M5 spec ne definiše takvo polje) — samo "Odmah potvrda/Upit"
// je stvarno filtrirano (SearchOffer.availabilityStatus), primenjeno u page.tsx nad već
// dobijenim rezultatima (klijentski/server-side filter, ne novi API parametar — GET /search
// ne podržava cenu/dostupnost kao upitne parametre, M5 spec §11).
export default function SearchSidebarPanel() {
  const sp = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const currentTypes = sp.getAll('type');
  function hrefForTypes(types: string[]) {
    const next = new URLSearchParams(sp.toString());
    next.delete('type');
    for (const t of types) next.append('type', t);
    return `/rezervacije/pretraga?${next.toString()}`;
  }

  return (
    <form className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
      <div className="grid grid-cols-3 gap-1 border-b border-border pb-2">
        {PRODUCT_ICONS.map((p) => {
          const active = p.types.length > 0 && p.types.length === currentTypes.length && p.types.every((t) => currentTypes.includes(t));
          if (p.locked) {
            return (
              <span
                key={p.label}
                title={`${p.label} — ${p.locked}`}
                className="flex h-9 flex-col items-center justify-center gap-0.5 rounded text-ink-faint opacity-40"
              >
                <Icon name={p.icon} />
                <span className="truncate text-[9px] leading-none">{p.label}</span>
              </span>
            );
          }
          return (
            <Link
              key={p.label}
              href={hrefForTypes(p.types)}
              title={p.label}
              className={`flex h-9 flex-col items-center justify-center gap-0.5 rounded ${
                active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
              }`}
            >
              <Icon name={p.icon} />
              <span className="truncate text-[9px] leading-none">{p.label}</span>
            </Link>
          );
        })}
      </div>

      <Section title="Pretraga" open={searchOpen} onToggle={() => setSearchOpen((v) => !v)}>
        <label className="text-ink-faint">
          tip
          <select name="type" defaultValue={sp.get('type') ?? ''} className="input mt-1 w-full">
            <option value="">— sve —</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-ink-faint">
          država odredišta
          <input name="destinationCountry" defaultValue={sp.get('destinationCountry') ?? ''} className="input mt-1 w-full" placeholder="Grčka" />
        </label>
        <label className="text-ink-faint">
          grad odredišta
          <input name="destinationCity" defaultValue={sp.get('destinationCity') ?? ''} className="input mt-1 w-full" />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 text-ink-faint">
            od
            <input type="date" name="stayFrom" defaultValue={sp.get('stayFrom') ?? ''} className="input mt-1 w-full" />
          </label>
          <label className="flex-1 text-ink-faint">
            do
            <input type="date" name="stayTo" defaultValue={sp.get('stayTo') ?? ''} className="input mt-1 w-full" />
          </label>
        </div>
        <label className="text-ink-faint">
          odrasli / deca
          <div className="mt-1 flex gap-1">
            <input type="number" name="adults" min={1} defaultValue={sp.get('adults') ?? '2'} className="input w-1/2" />
            <input type="number" name="children" min={0} defaultValue={sp.get('children') ?? '0'} className="input w-1/2" />
          </div>
        </label>
        <button type="submit" className="mt-1 flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 font-semibold text-accent-ink hover:bg-accent-strong">
          <Icon name="search" /> pretraži
        </button>
      </Section>

      <Section title="Filteri" open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
        <label className="text-ink-faint">
          cena od / do
          <div className="mt-1 flex gap-1">
            <input type="number" name="priceMin" min={0} defaultValue={sp.get('priceMin') ?? ''} className="input w-1/2" placeholder="0" />
            <input type="number" name="priceMax" min={0} defaultValue={sp.get('priceMax') ?? ''} className="input w-1/2" placeholder="∞" />
          </div>
        </label>
        <label className="text-ink-faint">
          dostupnost
          <select name="availability" defaultValue={sp.get('availability') ?? ''} className="input mt-1 w-full">
            <option value="">— sve —</option>
            <option value="AVAILABLE">Odmah potvrda</option>
            <option value="ON_REQUEST">Upit</option>
          </select>
        </label>
      </Section>
    </form>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1.5 py-1 text-left font-medium text-ink">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="text-ink-faint" />
        {title}
      </button>
      {open && <div className="flex flex-col gap-2 pl-1 pt-1">{children}</div>}
    </div>
  );
}
