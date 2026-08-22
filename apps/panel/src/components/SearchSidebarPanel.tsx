'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SearchCriteriaPopup, { valuesFromSearchParams, type SearchCriteriaValues } from './SearchCriteriaPopup';
import { PRODUCT_ICONS, type ProductIconDef } from '@/lib/search-product-types';

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
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Popup po tipu (22.8.2026, na zahtev vlasnika) — zamenjuje raniji "Pretraga" formular koji
  // je uvek stajao otvoren u traci; polja se sad unose u modalu, aktivna pretraga se prikazuje
  // kao chip na vrhu centralnog panela (SearchCriteriaChip.tsx u page.tsx), sa dugmetom "izmeni"
  // koje ponovo otvara ISTI ovaj popup, samo iz drugog mesta (isti obrazac, deljena komponenta).
  const [popup, setPopup] = useState<ProductIconDef | null>(null);

  const currentTypes = sp.getAll('type');

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
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
            <button
              key={p.label}
              type="button"
              onClick={() => setPopup(p)}
              title={p.label}
              className={`flex h-9 flex-col items-center justify-center gap-0.5 rounded ${
                active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
              }`}
            >
              <Icon name={p.icon} />
              <span className="truncate text-[9px] leading-none">{p.label}</span>
            </button>
          );
        })}
      </div>

      {popup && (
        <SearchCriteriaPopup
          label={popup.label}
          types={popup.types}
          initialValues={active(popup, currentTypes) ? valuesFromSearchParams(sp) : emptyValues()}
          onClose={() => setPopup(null)}
        />
      )}

      <form
        className="contents"
        onSubmit={(e) => {
          // Nativan GET submit bi ZAMENIO ceo query string samo poljima ove forme, brišući
          // type/destinaciju/datume iz popup-a — ovde spajamo sa postojećim parametrima umesto
          // toga (isti razlog zašto je ranije bio JEDAN deljeni <form> — sad su odvojeni, ali
          // moraju i dalje da se spajaju, ne zamenjuju).
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = new URLSearchParams(sp.toString());
          for (const key of ['priceMin', 'priceMax', 'availability']) {
            const val = String(data.get(key) ?? '');
            if (val) next.set(key, val);
            else next.delete(key);
          }
          router.push(`/rezervacije/pretraga?${next.toString()}`);
        }}
      >
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
          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 font-semibold text-ink-dim hover:border-accent hover:text-ink"
          >
            <Icon name="filter" /> primeni filtere
          </button>
        </Section>
      </form>
    </div>
  );
}

function active(p: ProductIconDef, currentTypes: string[]): boolean {
  return p.types.length > 0 && p.types.length === currentTypes.length && p.types.every((t) => currentTypes.includes(t));
}

function emptyValues(): SearchCriteriaValues {
  return {
    destinationCountry: '',
    destinationCity: '',
    stayFrom: '',
    stayTo: '',
    adults: '2',
    children: '0',
    cabinClass: '',
    minDriverAge: '',
    durationNights: '',
    cabinType: '',
  };
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
