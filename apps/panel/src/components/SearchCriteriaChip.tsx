'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SearchCriteriaPopup, { valuesFromSearchParams } from './SearchCriteriaPopup';
import { findIconByTypes } from '@/lib/search-product-types';
import { SAVED_VIEWS_CHANGED_EVENT, type SavedView } from './SavedViewsSidebarPanel';
import { useGroupSearchBuilder } from './GroupSearchBuilderContext';

const PREFERENCE_KEY = 'saved_views.rezervacije_pretraga';
const MAX_SAVED_SEARCHES = 10;
const GROUP_PREFERENCE_KEY = 'saved_views.rezervacije_grupna_pretraga';
const MAX_SAVED_GROUPS = 10;
const MAX_SEARCHES_PER_GROUP = 6;

export interface SavedGroupSearch {
  id: string;
  name: string;
  searches: { label: string; filters: Record<string, string | string[]> }[];
}

function newViewId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v${Date.now()}${Math.random()}`;
}

// Sažetak aktivne pretrage na vrhu centralnog panela (22.8.2026, na zahtev vlasnika: "kreira
// se link u kom se vidi šta se pretražuje i na kraju linka je dugme izmeni... klikom na izmeni
// ponovo se otvara popup"). Deli ISTI `SearchCriteriaPopup` sa ikonicama u levom panelu
// (SearchSidebarPanel.tsx) — samo drugi okidač (ovde: "izmeni" dugme, tamo: klik na ikonicu).
//
// Dugme "Sačuvaj" (26.8.2026, na zahtev vlasnika: "omogućite čuvanje filtera pretrage kako bi
// se vratili po želji, max 10 pretraga") — isti mehanizam/`UserPreference` ključ kao "Sačuvaj
// pretragu" na listi rezervacija (BookingsListClient.tsx), ovde uz gornju granicu. Ponovno
// otvaranje sačuvane pretrage (SavedViewsSidebarPanel u levom panelu) je PRAVA navigacija — nov
// `GET /sales/search` poziv, cena/dostupnost se time UVEK proveravaju iznova, nikad se ne
// prikazuje stara sačuvana cena.
//
// Naziv se generiše SAM (dopuna, na zahtev vlasnika: "naziv sačuvanog filtera treba sam da se
// generiše iz odabranih filtera") — isti sažetak koji već piše na samom chip-u (tip · destinacija
// · datumi · broj osoba), bez posebnog polja za kucanje/popover-a — jedan klik čuva.
export default function SearchCriteriaChip() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const { staged, stage, unstage, clear: clearStaged } = useGroupSearchBuilder();

  const types = sp.getAll('type');
  if (types.length === 0) return null; // nema aktivne pretrage — nema šta da se sažme

  const icon = findIconByTypes(types);
  const label = icon?.label ?? types.join(', ');
  const destination = [sp.get('destinationCity'), sp.get('destinationCountry')].filter(Boolean).join(', ');
  const dates = sp.get('stayFrom') && sp.get('stayTo') ? `${sp.get('stayFrom')} – ${sp.get('stayTo')}` : null;
  const occupancy = `${sp.get('adults') ?? '2'} odr.${Number(sp.get('children') ?? '0') > 0 ? ` + ${sp.get('children')} dece` : ''}`;
  const autoName = [label, destination || null, dates, occupancy].filter(Boolean).join(' · ');

  function currentFilters(): Record<string, string | string[]> {
    const filters: Record<string, string | string[]> = {};
    sp.forEach((value, key) => {
      const existingValue = filters[key];
      if (existingValue === undefined) filters[key] = value;
      else if (Array.isArray(existingValue)) existingValue.push(value);
      else filters[key] = [existingValue, value];
    });
    return filters;
  }

  async function saveSearch() {
    setSaving(true);
    setSaveError(null);
    try {
      const filters = currentFilters();
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedView[] = Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : [];
      if (existing.length >= MAX_SAVED_SEARCHES) {
        setSaveError(`Najviše ${MAX_SAVED_SEARCHES} sačuvanih pretraga — obriši neku u levom panelu pre čuvanja nove.`);
        return;
      }
      const next = [...existing, { id: newViewId(), name: autoName, filters }];
      await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // M5 spec v1.82 (29.8.2026) — "dodaj u grupu" stavlja TRENUTNU pretragu u sesijsko stanje
  // (GroupSearchBuilderContext, mora živeti iznad ove stranice jer je ona server komponenta i
  // gubi lokalni state pri svakoj promeni query stringa). Naziv se generiše isto kao pojedinačna
  // pretraga (autoName) — isti razlog kao gore, jedan klik, bez kucanja.
  function stageCurrent() {
    setGroupError(null);
    if (staged.length >= MAX_SEARCHES_PER_GROUP) {
      setGroupError(`Najviše ${MAX_SEARCHES_PER_GROUP} pretraga po grupi.`);
      return;
    }
    stage({ id: newViewId(), label: autoName, filters: currentFilters() });
  }

  async function saveGroup() {
    setSavingGroup(true);
    setGroupError(null);
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedGroupSearch[] = Array.isArray(data[GROUP_PREFERENCE_KEY]) ? data[GROUP_PREFERENCE_KEY] : [];
      if (existing.length >= MAX_SAVED_GROUPS) {
        setGroupError(`Najviše ${MAX_SAVED_GROUPS} sačuvanih grupa — obriši neku u levom panelu pre čuvanja nove.`);
        return;
      }
      const groupName = staged.map((s) => s.label.split(' · ')[0]).join(' + ');
      const next = [...existing, { id: newViewId(), name: groupName, searches: staged.map((s) => ({ label: s.label, filters: s.filters })) }];
      await fetch(`/api/preferences/${GROUP_PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      clearStaged();
    } finally {
      setSavingGroup(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs text-ink">
        <Icon name={icon?.icon ?? 'search'} className="text-accent-strong" />
        <span className="font-semibold">{label}</span>
        {destination && <span className="text-ink-dim">· {destination}</span>}
        {dates && <span className="text-ink-dim">· {dates}</span>}
        <span className="text-ink-dim">· {occupancy}</span>
        <button onClick={() => setOpen(true)} className="ml-1 flex items-center gap-1 text-accent-strong hover:underline">
          <Icon name="edit" /> izmeni
        </button>
        <div className="relative">
          <button
            onClick={saveSearch}
            disabled={saving}
            title={`Sačuva se kao "${autoName}"`}
            className="flex items-center gap-1 text-accent-strong hover:underline disabled:opacity-50"
          >
            <Icon name={justSaved ? 'check' : 'bookmark'} /> {justSaved ? 'sačuvano' : saving ? '…' : 'sačuvaj'}
          </button>
          {saveError && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-danger bg-panel p-2 text-[11px] text-danger shadow-lg">
              {saveError}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={stageCurrent}
            title="Dodaj ovu pretragu u grupnu pretragu (npr. let + hotel + transfer za isto putovanje)"
            className="flex items-center gap-1 text-accent-strong hover:underline"
          >
            <Icon name="layers" /> dodaj u grupu
          </button>
          {groupError && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-danger bg-panel p-2 text-[11px] text-danger shadow-lg">
              {groupError}
            </div>
          )}
        </div>
      </div>

      {staged.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-2 text-xs text-ink-dim">
          <span className="font-medium text-ink-faint">Grupna pretraga u izgradnji:</span>
          {staged.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full bg-panel2 px-2 py-1 text-[11px]">
              {s.label.split(' · ')[0]}
              <button onClick={() => unstage(s.id)} title="Ukloni iz grupe" className="text-ink-faint hover:text-danger">
                <Icon name="close" />
              </button>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={clearStaged} className="text-ink-faint hover:text-danger">
              otkaži
            </button>
            <button
              onClick={saveGroup}
              disabled={savingGroup || staged.length < 2}
              title={staged.length < 2 ? 'Dodaj bar dve pretrage pre čuvanja grupe' : 'Sačuvaj grupu'}
              className="flex items-center gap-1 rounded bg-accent px-2 py-1 font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              <Icon name="bookmark" /> {savingGroup ? '…' : `sačuvaj grupu (${staged.length})`}
            </button>
          </div>
        </div>
      )}

      {open && (
        <SearchCriteriaPopup label={label} types={types} initialValues={valuesFromSearchParams(sp)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
