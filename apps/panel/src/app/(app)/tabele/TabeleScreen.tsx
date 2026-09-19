'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useTabs } from '@/components/TabsContext';
import { SAVED_VIEWS_CHANGED_EVENT } from '@/components/SavedViewsSidebarPanel';
import {
  decodeTableSpec,
  encodeTableSpec,
  type TableSourceId,
  type TableSpec,
} from '@/lib/table-spec';

// M17 spec §6e.2 — spisak sačuvanih tabela + „Nova tabela" (bez AI-ja, iz istog registra).

export interface SavedTableEntry {
  id: string;
  name: string;
  filters: { spec: string };
}

export interface TableSourceInfo {
  id: TableSourceId;
  label: string;
  filters: Record<
    string,
    { description: string; enumValues?: string[]; multi?: boolean; required?: boolean }
  >;
  columns: { key: string; label: string; type: string }[];
  hasPeriod: boolean;
}

const btn =
  'rounded border border-border px-2 py-1 text-[11px] text-ink-dim hover:border-accent hover:text-accent';

export default function TabeleScreen({
  saved,
  sources,
  userName,
}: {
  saved: SavedTableEntry[];
  sources: TableSourceInfo[];
  userName: string;
}) {
  const { openTab } = useTabs();
  const [list, setList] = useState(saved);
  const [source, setSource] = useState<TableSourceId>(sources[0]?.id ?? 'bookings');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);

  const def = sources.find((s) => s.id === source);

  function open(entry: SavedTableEntry) {
    const d = decodeTableSpec(entry.filters.spec);
    openTab(`/tabele/prikaz?spec=${entry.filters.spec}`, d?.spec.title ?? entry.name);
  }

  async function remove(entry: SavedTableEntry) {
    const next = list.filter((t) => t.id !== entry.id);
    await fetch('/api/preferences/tt.tables', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: next }),
    });
    setList(next);
    window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
  }

  function openNew() {
    const f: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (!v.trim()) continue;
      f[k] = def?.filters[k]?.multi
        ? v
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : v.trim();
    }
    const spec: TableSpec = {
      source,
      filters: Object.keys(f).length ? f : undefined,
      title: title.trim() || def?.label,
      compare: compare && compare.from && compare.to ? compare : undefined,
    };
    openTab(`/tabele/prikaz?spec=${encodeTableSpec(spec)}`, spec.title ?? 'Tabela');
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-base font-semibold text-ink">Tabele</h1>
        <p className="text-xs text-ink-faint">
          Radne tabele koje AI puni, a vi analizirate — podaci se svaki put ponovo izvlače iz
          modula; tabela nikad nije izvor podataka. Najbrži put: u AI razgovoru zatražite
          &bdquo;tabelu…&ldquo; i kliknite &bdquo;Otvori kao tabelu&ldquo;.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border bg-sunken px-3 py-1.5 text-xs font-semibold text-ink">
          Sačuvane tabele{userName ? ` — ${userName}` : ''}
        </div>
        {list.length === 0 ? (
          <p className="px-3 py-3 text-xs text-ink-faint">
            Još nema sačuvanih tabela. Otvorite tabelu i kliknite &bdquo;sačuvaj&ldquo;.
          </p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {list.map((t) => {
              const d = decodeTableSpec(t.filters.spec);
              return (
                <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
                  <Icon name="table" className="text-accent" />
                  <button
                    type="button"
                    className="text-ink hover:text-accent"
                    onClick={() => open(t)}
                  >
                    {t.name}
                  </button>
                  <span className="text-ink-faint">
                    {d?.spec.source}
                    {d?.spec.filters ? ` · ${Object.keys(d.spec.filters).length} filtera` : ''}
                    {d?.settings?.pivot ? ' · pivot' : ''}
                    {d?.settings?.semafor?.length ? ' · semafor' : ''}
                  </span>
                  <button type="button" className={`${btn} ml-auto`} onClick={() => void remove(t)}>
                    obriši
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border bg-sunken px-3 py-1.5 text-xs font-semibold text-ink">
          Nova tabela (bez AI-ja)
        </div>
        <div className="flex flex-col gap-2 p-3 text-xs">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-ink-faint">izvor</span>
              <select
                id="nova-tabela-izvor"
                className="input !py-1 text-xs"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as TableSourceId);
                  setFilters({});
                  setCompare(null);
                }}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-ink-faint">naslov</span>
              <input
                id="nova-tabela-naslov"
                className="input !py-1 text-xs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={def?.label}
              />
            </label>
          </div>
          {def && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(def.filters).map(([key, f]) => (
                <label key={key} className="flex flex-col gap-0.5">
                  <span className="text-ink-faint">
                    {key}
                    {f.required ? ' *' : ''}
                    {f.multi ? ' (više, zarezom)' : ''}
                  </span>
                  {f.enumValues && !f.multi ? (
                    <select
                      className="input !py-1 text-xs"
                      value={filters[key] ?? ''}
                      onChange={(e) => setFilters((x) => ({ ...x, [key]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {f.enumValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input !py-1 w-44 text-xs"
                      value={filters[key] ?? ''}
                      onChange={(e) => setFilters((x) => ({ ...x, [key]: e.target.value }))}
                      placeholder={
                        f.enumValues ? f.enumValues.slice(0, 3).join(', ') + '…' : f.description
                      }
                      title={f.description}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          {def?.hasPeriod && (
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-ink-faint">poredi sa periodom:</span>
              <input
                type="date"
                className="input !py-1 text-xs"
                value={compare?.from ?? ''}
                onChange={(e) => setCompare((c) => ({ from: e.target.value, to: c?.to ?? '' }))}
              />
              <input
                type="date"
                className="input !py-1 text-xs"
                value={compare?.to ?? ''}
                onChange={(e) => setCompare((c) => ({ from: c?.from ?? '', to: e.target.value }))}
              />
              {compare && (
                <button type="button" className={btn} onClick={() => setCompare(null)}>
                  bez poređenja
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            className="self-start rounded bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink hover:brightness-90"
            onClick={openNew}
          >
            <Icon name="play" /> otvori tabelu
          </button>
        </div>
      </section>
    </div>
  );
}
