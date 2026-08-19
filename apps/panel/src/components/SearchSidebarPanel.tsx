'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';

const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT'];

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

  return (
    <form className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
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
