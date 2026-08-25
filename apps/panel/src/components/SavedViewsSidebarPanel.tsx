'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';

export interface SavedView {
  id: string;
  name: string;
  /** Query parametri liste (isti oblik kao `BookingFilters`/`RealFilterBar`) — ovaj panel ih
   * samo prosleđuje kroz URL, ne tumači ih (M1 spec §3.9 — vrednost je slobodna po ključu).
   * Niz vrednosti (24.8.2026, multiselect dopuna) — polje sa više izabranih opcija (npr.
   * status: ['CONFIRMED','CANCELLED']) čuva SVE, ne samo poslednju. */
  filters: Record<string, string | string[]>;
}

const PREFERENCE_KEY = 'saved_views.rezervacije_lista';
/** Emituje se posle uspešnog čuvanja/brisanja da se panel osveži bez zajedničkog state-a
 * (dugme za čuvanje živi u centralnom panelu, ovaj panel u levoj traci — različiti delovi stabla). */
export const SAVED_VIEWS_CHANGED_EVENT = 'tt:saved-views-changed';

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

// Dizajn dok. §5b "Sačuvani prikazi" (dopunjeno 18.8.2026, izgrađeno 24.8.2026 na zahtev
// vlasnika — "Filtere za listu rezervacija stavimo u levi panel... Ima dosta praznog prostora")
// — puni prazan prostor ispod izabrane stavke u levom panelu, isti mehanizam kao
// `SearchSidebarPanel.tsx` (Sidebar.tsx bira komponentu po `selected.id`). Lično po korisniku
// (M1 `UserPreference`, ne deljeno), klik odmah primenjuje sačuvane filtere (nova navigacija na
// `/rezervacije/lista?...`), bez ponovnog kucanja.
export default function SavedViewsSidebarPanel() {
  const [views, setViews] = useState<SavedView[] | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      if (!res.ok) {
        setViews([]);
        return;
      }
      const data = await res.json();
      setViews(Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : []);
    } catch {
      setViews([]);
    }
  }

  useEffect(() => {
    load();
    window.addEventListener(SAVED_VIEWS_CHANGED_EVENT, load);
    return () => window.removeEventListener(SAVED_VIEWS_CHANGED_EVENT, load);
  }, []);

  async function remove(id: string) {
    const next = (views ?? []).filter((v) => v.id !== id);
    setViews(next);
    await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    });
  }

  if (views === null) return null;

  return (
    <div className="mx-2 mt-3 border-t border-border pt-3">
      <div className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">Sačuvani prikazi</div>
      {views.length === 0 ? (
        <p className="px-2 text-[11px] text-ink-faint">Sačuvaj trenutnu pretragu (dugme iznad liste) da je vidiš ovde.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {views.map((v) => (
            <li key={v.id} className="group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-panel">
              <Link href={`/rezervacije/lista${toQueryString(v.filters)}`} className="flex flex-1 items-center gap-2 truncate text-xs text-ink-dim hover:text-ink">
                <Icon name="bookmark" />
                <span className="truncate">{v.name}</span>
              </Link>
              <button
                onClick={() => remove(v.id)}
                title="Obriši sačuvan prikaz"
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
