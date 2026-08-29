'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';
import { SAVED_VIEWS_CHANGED_EVENT } from './SavedViewsSidebarPanel';
import type { SavedGroupSearch } from './SearchCriteriaChip';

const PREFERENCE_KEY = 'saved_views.rezervacije_grupna_pretraga';

function toQueryString(filters: Record<string, string | string[]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      for (const v of value) if (v) params.append(key, v);
    } else if (value) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// M5 spec v1.82 (29.8.2026, na zahtev vlasnika: "omogućite čuvanje i grupnih pretraga") — isti
// M1 `UserPreference` mehanizam kao `SavedViewsSidebarPanel.tsx`, samo svaki zapis nosi NIZ
// pojedinačnih pretraga umesto jedne. Klik otvara SVAKU pojedinačnu pretragu iz grupe u
// SOPSTVENOM tabu (TabsContext, isti mehanizam koji panel već koristi za svaku drugu
// navigaciju) — nema novog ekrana, samo više tabova odjednom.
export default function SavedGroupSearchesSidebarPanel() {
  const [groups, setGroups] = useState<SavedGroupSearch[] | null>(null);
  const { openTab } = useTabs();

  async function load() {
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      if (!res.ok) {
        setGroups([]);
        return;
      }
      const data = await res.json();
      setGroups(Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : []);
    } catch {
      setGroups([]);
    }
  }

  useEffect(() => {
    load();
    window.addEventListener(SAVED_VIEWS_CHANGED_EVENT, load);
    return () => window.removeEventListener(SAVED_VIEWS_CHANGED_EVENT, load);
  }, []);

  async function remove(id: string) {
    const next = (groups ?? []).filter((g) => g.id !== id);
    setGroups(next);
    await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    });
  }

  function openGroup(group: SavedGroupSearch) {
    for (const s of group.searches) {
      openTab(`/rezervacije/pretraga${toQueryString(s.filters)}`, s.label.split(' · ')[0]);
    }
  }

  if (groups === null) return null;

  return (
    <div className="mx-2 mt-3 border-t border-border pt-3">
      <div className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">Grupne pretrage ({groups.length}/10)</div>
      {groups.length === 0 ? (
        <p className="px-2 text-[11px] text-ink-faint">
          Dodaj bar dve pretrage u grupu (dugme "dodaj u grupu" pored "sačuvaj" na vrhu) da je vidiš ovde.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {groups.map((g) => (
            <li key={g.id} className="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-panel">
              <button
                onClick={() => openGroup(g)}
                title={g.searches.map((s) => s.label).join('\n')}
                className="flex flex-1 items-center gap-2 truncate text-left text-xs text-ink-dim hover:text-ink"
              >
                <Icon name="layers" />
                <span className="truncate">
                  {g.name} <span className="text-ink-faint">({g.searches.length})</span>
                </span>
              </button>
              <button
                onClick={() => remove(g.id)}
                title="Obriši grupnu pretragu"
                className="hidden h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger group-hover:flex"
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
