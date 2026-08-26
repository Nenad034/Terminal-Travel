'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';
import SearchCriteriaPopup, { valuesFromSearchParams } from './SearchCriteriaPopup';
import { findIconByTypes } from '@/lib/search-product-types';
import { SAVED_VIEWS_CHANGED_EVENT, type SavedView } from './SavedViewsSidebarPanel';

const PREFERENCE_KEY = 'saved_views.rezervacije_pretraga';
const MAX_SAVED_SEARCHES = 10;

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
export default function SearchCriteriaChip() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const types = sp.getAll('type');
  if (types.length === 0) return null; // nema aktivne pretrage — nema šta da se sažme

  const icon = findIconByTypes(types);
  const label = icon?.label ?? types.join(', ');
  const destination = [sp.get('destinationCity'), sp.get('destinationCountry')].filter(Boolean).join(', ');
  const dates = sp.get('stayFrom') && sp.get('stayTo') ? `${sp.get('stayFrom')} – ${sp.get('stayTo')}` : null;
  const occupancy = `${sp.get('adults') ?? '2'} odr.${Number(sp.get('children') ?? '0') > 0 ? ` + ${sp.get('children')} dece` : ''}`;

  async function saveSearch() {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const filters: Record<string, string | string[]> = {};
      sp.forEach((value, key) => {
        const existingValue = filters[key];
        if (existingValue === undefined) filters[key] = value;
        else if (Array.isArray(existingValue)) existingValue.push(value);
        else filters[key] = [existingValue, value];
      });
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedView[] = Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : [];
      if (existing.length >= MAX_SAVED_SEARCHES) {
        setSaveError(`Najviše ${MAX_SAVED_SEARCHES} sačuvanih pretraga — obriši neku u levom panelu pre čuvanja nove.`);
        return;
      }
      const next = [...existing, { id: newViewId(), name: name.trim(), filters }];
      await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      setSaveOpen(false);
      setName('');
    } finally {
      setSaving(false);
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
            onClick={() => {
              setSaveError(null);
              setSaveOpen((v) => !v);
            }}
            className="flex items-center gap-1 text-accent-strong hover:underline"
          >
            <Icon name="bookmark" /> sačuvaj
          </button>
          {saveOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-panel p-2 text-ink shadow-lg">
              <label className="mb-1 block text-[11px] font-medium text-ink-faint">Naziv sačuvane pretrage</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="npr. Budva, avgust, porodica"
                className="input mb-2 w-full"
                autoFocus
              />
              {saveError && <p className="mb-2 text-[11px] text-danger">{saveError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setSaveOpen(false)} className="rounded px-2 py-1 text-[11px] text-ink-faint hover:text-ink">
                  Otkaži
                </button>
                <button
                  onClick={saveSearch}
                  disabled={saving || !name.trim()}
                  className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
                >
                  {saving ? '…' : 'Sačuvaj'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {open && (
        <SearchCriteriaPopup label={label} types={types} initialValues={valuesFromSearchParams(sp)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
