'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import SidebarSection from './SidebarSection';
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
  // Sklopivo (5.9.2026, vlasnikov zahtev — isti razlog/obrazac kao SavedViewsSidebarPanel.tsx).
  const [open, setOpen] = useState(false);
  const { openTab } = useTabs();

  async function load() {
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      if (!res.ok) {
        setGroups([]);
        return;
      }
      const data = await res.json();
      const next: SavedGroupSearch[] = Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : [];
      setGroups(next);
      if (next.length > 0) setOpen(true);
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
    <div className="mx-2 mt-1.5 text-xs">
      <SidebarSection title={`Grupne pretrage (${groups.length}/10)`} icon="layers" open={open} onToggle={() => setOpen((v) => !v)}>
      {groups.length === 0 ? (
        <p className="px-1 text-[11px] text-ink-faint">
          Dodaj bar dve pretrage u grupu (dugme „dodaj u grupu“ pored „sačuvaj“ na vrhu) da je vidiš ovde.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {groups.map((g) => (
            <li key={g.id} className="group flex items-center gap-2 rounded-lg border border-border bg-panel p-2 hover:border-accent">
              <button
                onClick={() => openGroup(g)}
                title={g.searches.map((s) => s.label).join('\n')}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
                  <Icon name="layers" />
                </span>
                <span className="truncate text-xs font-medium text-ink">
                  {g.name} <span className="font-normal text-ink-faint">({g.searches.length})</span>
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
      </SidebarSection>
    </div>
  );
}
