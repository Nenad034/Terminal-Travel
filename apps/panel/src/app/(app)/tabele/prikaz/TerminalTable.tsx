'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { useTabs } from '@/components/TabsContext';
import { useAiContext } from '@/components/AiContextContext';
import { SAVED_VIEWS_CHANGED_EVENT } from '@/components/SavedViewsSidebarPanel';
import {
  encodeTableSpec,
  type SemaforRule,
  type TableColumn,
  type TableResult,
  type TableRow,
  type TableSettings,
  type TableSpec,
} from '@/lib/table-spec';
import {
  applyScenarioToRow,
  isScenarioActive,
  scenarioLabel,
  scenarioTotals,
  SCENARIO_PARAM_LABELS,
  type ScenarioParams,
} from '@/lib/scenario';

// M17 spec §6e — „Terminal tabela". Tabela je PRIKAZ, ne izvor podataka (§6e.1): podaci se
// svaki put vuku kroz `POST /api/tables/run`; sortiranje/filter/grupisanje/pivot/zbir radi KOD
// ovde; model dobija samo sažetak (§6e.3k). Scenario (§6e.4) menja parametre, nikad ćelije.

const TABLES_PREF_KEY = 'tt.tables';

type SortDir = 'asc' | 'desc';

interface SavedTable {
  id: string;
  name: string;
  /** `SavedViewsSidebarPanel` gradi href iz `filters` — ovde je to jedini ključ `spec`. */
  filters: { spec: string };
}

function fmt(v: unknown, type: TableColumn['type']): string {
  if (v === null || v === undefined) return '';
  if (type === 'money' && typeof v === 'number') {
    return (v / 100).toLocaleString('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (type === 'percent' && typeof v === 'number') return `${v.toLocaleString('sr-RS')} %`;
  if (type === 'number' && typeof v === 'number') return v.toLocaleString('sr-RS');
  if (type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-');
    return `${d}.${m}.${y}.`;
  }
  return String(v);
}

function isNum(c: TableColumn): boolean {
  return c.type === 'number' || c.type === 'money' || c.type === 'percent';
}

function semaforClass(rules: SemaforRule[], key: string, v: unknown): string {
  if (typeof v !== 'number') return '';
  for (const r of rules) {
    if (r.column !== key) continue;
    const hit =
      (r.op === '<' && v < r.value) ||
      (r.op === '<=' && v <= r.value) ||
      (r.op === '=' && v === r.value) ||
      (r.op === '>=' && v >= r.value) ||
      (r.op === '>' && v > r.value);
    if (hit) {
      return r.color === 'ok'
        ? 'bg-ok-bg text-ok'
        : r.color === 'warn'
          ? 'bg-warn-bg text-warn'
          : 'bg-danger-bg text-danger';
    }
  }
  return '';
}

/** §6e.3f — spajanje dva perioda po `_key`: svaka numerička kolona dobija „prethodno" i Δ. */
function mergeCompare(rows: TableRow[], previous: TableRow[], columns: TableColumn[]): TableRow[] {
  const prev = new Map(previous.map((r) => [r._key, r]));
  return rows.map((r) => {
    const p = prev.get(r._key);
    const out: TableRow = { ...r };
    for (const c of columns) {
      if (!isNum(c)) continue;
      const a = r[c.key];
      const b = p?.[c.key];
      out[`${c.key}__prev`] = typeof b === 'number' ? b : null;
      out[`${c.key}__delta`] = typeof a === 'number' && typeof b === 'number' ? a - b : null;
    }
    return out;
  });
}

const th =
  'sticky top-0 z-10 select-none whitespace-nowrap border-b border-border bg-panel-2 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
const td = 'whitespace-nowrap border-b border-border px-2 py-1 tabular-nums';
const btn =
  'rounded border border-border px-2 py-1 text-[11px] text-ink-dim hover:border-accent hover:text-accent';
const input = 'input !py-1 text-xs';

export default function TerminalTable({
  spec,
  initialSettings,
  canScenario,
}: {
  spec: TableSpec;
  initialSettings?: TableSettings;
  canScenario: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openTab, hydrated } = useTabs();
  const { addTable } = useAiContext();

  const [data, setData] = useState<TableResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState<{ column: string; dir: SortDir } | null>(
    initialSettings?.sort ?? null,
  );
  const [hidden, setHidden] = useState<string[]>(initialSettings?.hidden ?? []);
  const [pinned, setPinned] = useState<string[]>(initialSettings?.pinned ?? []);
  const [groupBy, setGroupBy] = useState<string | null>(initialSettings?.groupBy ?? null);
  const [pivot, setPivot] = useState<TableSettings['pivot']>(initialSettings?.pivot ?? null);
  const [semafor, setSemafor] = useState<SemaforRule[]>(initialSettings?.semafor ?? []);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    initialSettings?.columnFilters ?? {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scenario, setScenario] = useState<ScenarioParams>({});
  const [showScenario, setShowScenario] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showSemafor, setShowSemafor] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const settings: TableSettings = useMemo(
    () => ({ sort: sort ?? undefined, hidden, pinned, groupBy, pivot, semafor, columnFilters }),
    [sort, hidden, pinned, groupBy, pivot, semafor, columnFilters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tables/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Greška'),
        );
        setData(null);
      } else {
        setData(body as TableResult);
      }
    } catch {
      setError('Tabela trenutno nije dostupna.');
    } finally {
      setLoading(false);
    }
  }, [spec]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tab se registruje sa PUNOM adresom (uključujući `spec`), ne samo putanjom — dve tabele su
  // dva taba (M17 §6e.2), a ista tabela otvorena iz chata i iz bočnog panela je jedan tab.
  // Standardni `RegisterTab` bi registrovao goli `/tabele/prikaz` i napravio duplikat.
  useEffect(() => {
    if (!hydrated) return;
    openTab(`${pathname}?${searchParams.toString()}`, spec.title ?? 'Tabela');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, pathname, searchParams, spec.title]);

  const columns = data?.columns ?? [];
  const scenarioOn = canScenario && isScenarioActive(scenario);

  // 1) scenario (po redu) → 2) poređenje perioda → 3) filter po koloni → 4) sortiranje
  const baseRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (scenarioOn) rows = rows.map((r) => applyScenarioToRow(r, columns, scenario));
    if (data.previous) {
      const prev = scenarioOn
        ? data.previous.map((r) => applyScenarioToRow(r, columns, scenario))
        : data.previous;
      rows = mergeCompare(rows, prev, columns);
    }
    return rows;
  }, [data, columns, scenario, scenarioOn]);

  const visibleRows = useMemo(() => {
    let rows = baseRows;
    for (const [key, text] of Object.entries(columnFilters)) {
      const t = text.trim().toLowerCase();
      if (!t) continue;
      const col = columns.find((c) => c.key === key);
      rows = rows.filter((r) => {
        const v = r[key];
        if (v === null || v === undefined) return false;
        if (col && isNum(col) && typeof v === 'number') {
          // „>=100", „<50", „100-200"
          const m = t.match(/^(>=|<=|>|<|=)?\s*(-?[\d.,]+)$/);
          const range = t.match(/^(-?[\d.,]+)\s*-\s*(-?[\d.,]+)$/);
          const n = (s: string) => Number(s.replace(',', '.')) * (col.type === 'money' ? 100 : 1);
          if (range) return v >= n(range[1]) && v <= n(range[2]);
          if (m) {
            const x = n(m[2]);
            const op = m[1] ?? '=';
            return op === '>='
              ? v >= x
              : op === '<='
                ? v <= x
                : op === '>'
                  ? v > x
                  : op === '<'
                    ? v < x
                    : v === x;
          }
          return fmt(v, col.type).toLowerCase().includes(t);
        }
        return String(v).toLowerCase().includes(t);
      });
    }
    if (sort) {
      const { column, dir } = sort;
      rows = [...rows].sort((a, b) => {
        const x = a[column] as string | number | null | undefined;
        const y = b[column] as string | number | null | undefined;
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const c =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), 'sr');
        return dir === 'asc' ? c : -c;
      });
    }
    return rows;
  }, [baseRows, columnFilters, sort, columns]);

  const shownColumns = useMemo(() => {
    const base = columns.filter((c) => !hidden.includes(c.key));
    const pinnedCols = base.filter((c) => pinned.includes(c.key));
    const rest = base.filter((c) => !pinned.includes(c.key));
    const out: TableColumn[] = [...pinnedCols, ...rest];
    if (scenarioOn && scenario.kurs) {
      out.push({ key: 'prodajna_rsd', label: 'Prodajna u RSD', type: 'money' });
    }
    return out;
  }, [columns, hidden, pinned, scenarioOn, scenario.kurs]);

  const totals = useMemo(
    () => scenarioTotals(visibleRows, columns, scenarioOn ? scenario : null),
    [visibleRows, columns, scenario, scenarioOn],
  );
  const totalsReal = useMemo(
    () => scenarioTotals(data?.rows ?? [], columns, null),
    [data, columns],
  );
  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(r._key)),
    [visibleRows, selected],
  );
  const selectedTotals = useMemo(
    () => scenarioTotals(selectedRows, columns, scenarioOn ? scenario : null),
    [selectedRows, columns, scenario, scenarioOn],
  );

  // §6e.3b grupisanje — redovi + red međuzbira po grupi
  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, TableRow[]>();
    for (const r of visibleRows) {
      const k = String(r[groupBy] ?? '(prazno)');
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].map(([k, list]) => ({
      key: k,
      rows: list,
      totals: scenarioTotals(list, columns, scenarioOn ? scenario : null),
    }));
  }, [groupBy, visibleRows, columns, scenario, scenarioOn]);

  // §6e.3c pivot na jedan nivo — red-dimenzija × kolona-dimenzija × mera
  const pivotData = useMemo(() => {
    if (!pivot) return null;
    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();
    const cell = new Map<string, number>();
    for (const r of visibleRows) {
      const rk = String(r[pivot.row] ?? '(prazno)');
      const ck = String(r[pivot.col] ?? '(prazno)');
      rowKeys.add(rk);
      colKeys.add(ck);
      const v =
        pivot.agg === 'count'
          ? 1
          : typeof r[pivot.measure] === 'number'
            ? (r[pivot.measure] as number)
            : 0;
      cell.set(`${rk} ${ck}`, (cell.get(`${rk} ${ck}`) ?? 0) + v);
    }
    const factor = scenarioOn ? 1 + (scenario.popunjenostDeltaPct ?? 0) / 100 : 1;
    return {
      rows: [...rowKeys].sort(),
      cols: [...colKeys].sort(),
      get: (rk: string, ck: string) => Math.round((cell.get(`${rk} ${ck}`) ?? 0) * factor),
      measureType: (columns.find((c) => c.key === pivot.measure)?.type ??
        'number') as TableColumn['type'],
    };
  }, [pivot, visibleRows, columns, scenario, scenarioOn]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.column === key
        ? s.dir === 'asc'
          ? { column: key, dir: 'desc' }
          : null
        : { column: key, dir: 'asc' },
    );
  }

  function rowClick(r: TableRow) {
    if (r._href) openTab(r._href, String(r[columns[0]?.key ?? '_key'] ?? r._key));
  }

  async function save() {
    const name = saveName.trim();
    if (!name) return;
    try {
      const prefs = await fetch('/api/preferences').then((r) => r.json());
      const existing: SavedTable[] = Array.isArray(prefs?.[TABLES_PREF_KEY])
        ? prefs[TABLES_PREF_KEY]
        : [];
      const entry: SavedTable = {
        id: `t-${Date.now()}`,
        name,
        filters: { spec: encodeTableSpec({ ...spec, title: spec.title ?? name }, settings) },
      };
      const next = [...existing.filter((t) => t.name !== name), entry].slice(-30);
      await fetch(`/api/preferences/${TABLES_PREF_KEY}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      setSaveName('');
      setNotice(`Sačuvano kao „${name}".`);
    } catch {
      setNotice('Čuvanje nije uspelo.');
    }
  }

  async function exportAs(format: 'EXCEL' | 'PDF' | 'HTML') {
    // §6e.3j — šalju se spec + transformacije; server ponovo izvlači i primeni, ne prima brojeve.
    const transform = {
      filters: Object.entries(columnFilters)
        .filter(([, v]) => v.trim())
        .map(([column, value]) => ({ column, op: 'contains' as const, value })),
      sort: sort ?? undefined,
      groupBy: groupBy ?? undefined,
      hidden,
    };
    const res = await fetch('/api/tables/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        spec,
        format,
        transform,
        scenarioLabel: scenarioOn ? scenarioLabel(scenario) : undefined,
      }),
    });
    const body = await res.json();
    if (res.ok && body?.id) {
      window.open(`/api/bi-terminal/reports/${body.id}/download`, '_blank');
    } else {
      setNotice(body?.message ?? 'Izvoz nije uspeo.');
    }
  }

  function askAi() {
    // §6e.3k — sažetak, ne redovi: kolone, red zbira, do 20 izabranih redova, scenario.
    addTable({
      label: spec.title ?? spec.source,
      spec: { source: spec.source, filters: spec.filters, title: spec.title },
      columns: shownColumns.map((c) => ({ key: c.key, label: c.label })),
      resultCount: visibleRows.length,
      totals,
      selectedRows: selectedRows.slice(0, 20).map((r) => {
        const o: Record<string, unknown> = {};
        for (const c of shownColumns) o[c.key] = r[c.key];
        return o;
      }),
      scenario: scenarioOn
        ? {
            params: Object.fromEntries(
              Object.entries(scenario).filter(([, v]) => v !== null && v !== undefined),
            ) as Record<string, number>,
            totalsReal,
            totalsScenario: totals,
          }
        : undefined,
    });
    setNotice('Tabela je priložena AI razgovoru — postavite pitanje u polju za razgovor.');
  }

  function replaceSpecInUrl() {
    router.replace(`/tabele/prikaz?spec=${encodeTableSpec(spec, settings)}`);
  }

  const numericCols = columns.filter(isNum);
  const textCols = columns.filter((c) => !isNum(c));
  const title = spec.title ?? `Tabela: ${spec.source}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Zaglavlje + traka alata */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        {data && (
          <span className="text-xs text-ink-faint">
            {visibleRows.length} od {data.rowCount} redova
            {data.truncated ? ' (prikazano prvih 2.000)' : ''}
            {data.previous ? ` · poređenje sa ${spec.compare?.from}–${spec.compare?.to}` : ''}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={btn}
            onClick={() => void load()}
            title="Ponovo izvuci podatke"
          >
            <Icon name="refresh" /> osveži
          </button>
          <button type="button" className={btn} onClick={() => setShowColumns((v) => !v)}>
            <Icon name="list-selection" /> kolone
          </button>
          <button type="button" className={btn} onClick={() => setShowPivot((v) => !v)}>
            <Icon name="table" /> pivot
          </button>
          <button type="button" className={btn} onClick={() => setShowSemafor((v) => !v)}>
            <Icon name="circle-filled" /> semafor
          </button>
          <select
            className={input}
            value={groupBy ?? ''}
            onChange={(e) => setGroupBy(e.target.value || null)}
            title="Grupiši po koloni"
          >
            <option value="">bez grupisanja</option>
            {textCols.map((c) => (
              <option key={c.key} value={c.key}>
                grupiši: {c.label}
              </option>
            ))}
          </select>
          {canScenario && (
            <button
              type="button"
              className={`${btn} ${scenarioOn ? 'border-warn text-warn' : ''}`}
              onClick={() => setShowScenario((v) => !v)}
            >
              <Icon name="beaker" /> scenario
            </button>
          )}
          <button type="button" className={btn} onClick={askAi}>
            <Icon name="sparkle" /> pitaj AI
          </button>
          <button type="button" className={btn} onClick={() => void exportAs('EXCEL')}>
            <Icon name="file" /> Excel
          </button>
          <button type="button" className={btn} onClick={() => void exportAs('PDF')}>
            PDF
          </button>
          <input
            id="tabela-sacuvaj-naziv"
            className={`${input} w-40`}
            placeholder="naziv za čuvanje"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button
            type="button"
            className={btn}
            onClick={() => void save()}
            disabled={!saveName.trim()}
          >
            <Icon name="save" /> sačuvaj
          </button>
          <button
            type="button"
            className={btn}
            onClick={replaceSpecInUrl}
            title="Upiši podešavanja u adresu (za deljenje)"
          >
            <Icon name="link" />
          </button>
        </div>
      </div>

      {notice && (
        <p className="rounded border border-border bg-sunken px-2 py-1 text-xs text-ink-dim">
          {notice}{' '}
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => setNotice(null)}
          >
            u redu
          </button>
        </p>
      )}

      {/* §6e.4 — traka scenarija, uvek vidljiva dok je aktivan */}
      {scenarioOn && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-warn bg-warn-bg px-3 py-1.5 text-xs text-warn">
          <Icon name="warning" />
          <strong>SCENARIO — nije stvarno stanje.</strong> <span>{scenarioLabel(scenario)}</span>
          <button
            type="button"
            className="ml-auto rounded border border-warn px-2 py-0.5 hover:bg-warn hover:text-brand-ink"
            onClick={() => setScenario({})}
          >
            vrati na stvarno
          </button>
        </div>
      )}

      {showScenario && canScenario && (
        <div className="flex flex-wrap items-end gap-3 rounded border border-border bg-panel p-2 text-xs">
          {(Object.keys(SCENARIO_PARAM_LABELS) as (keyof ScenarioParams)[]).map((k) => (
            <label key={k} className="flex flex-col gap-0.5">
              <span className="text-ink-faint">{SCENARIO_PARAM_LABELS[k]}</span>
              <input
                id={`scenario-${k}`}
                type="number"
                step="0.1"
                className={`${input} w-28`}
                value={scenario[k] ?? ''}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    [k]: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
          ))}
          <p className="max-w-md text-ink-faint">
            Parametri deluju samo na izvedene kolone (prodajna, nabavna, marža, provizija, neto);
            popunjenost samo na zbirove. Ništa se ne upisuje — cene i pravila u sistemu ostaju kakvi
            jesu.
          </p>
        </div>
      )}

      {showColumns && (
        <div className="flex flex-wrap gap-2 rounded border border-border bg-panel p-2 text-xs">
          {columns.map((c) => (
            <span
              key={c.key}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5"
            >
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!hidden.includes(c.key)}
                  onChange={(e) =>
                    setHidden((h) =>
                      e.target.checked ? h.filter((x) => x !== c.key) : [...h, c.key],
                    )
                  }
                />
                {c.label}
              </label>
              <button
                type="button"
                title="zakači levo"
                className={pinned.includes(c.key) ? 'text-accent' : 'text-ink-faint'}
                onClick={() =>
                  setPinned((p) =>
                    p.includes(c.key) ? p.filter((x) => x !== c.key) : [...p, c.key],
                  )
                }
              >
                <Icon name="pinned" className="!text-[13px]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {showPivot && (
        <div className="flex flex-wrap items-end gap-2 rounded border border-border bg-panel p-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-faint">redovi</span>
            <select
              className={input}
              value={pivot?.row ?? ''}
              onChange={(e) =>
                setPivot((p) => ({
                  row: e.target.value,
                  col: p?.col ?? textCols[1]?.key ?? '',
                  measure: p?.measure ?? numericCols[0]?.key ?? '',
                  agg: p?.agg ?? 'sum',
                }))
              }
            >
              <option value="">—</option>
              {textCols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-faint">kolone</span>
            <select
              className={input}
              value={pivot?.col ?? ''}
              onChange={(e) => setPivot((p) => (p ? { ...p, col: e.target.value } : p))}
            >
              <option value="">—</option>
              {textCols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-faint">mera</span>
            <select
              className={input}
              value={pivot?.measure ?? ''}
              onChange={(e) => setPivot((p) => (p ? { ...p, measure: e.target.value } : p))}
            >
              {numericCols.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-faint">računaj</span>
            <select
              className={input}
              value={pivot?.agg ?? 'sum'}
              onChange={(e) =>
                setPivot((p) => (p ? { ...p, agg: e.target.value as 'sum' | 'count' } : p))
              }
            >
              <option value="sum">zbir</option>
              <option value="count">broj</option>
            </select>
          </label>
          {pivot && (
            <button type="button" className={btn} onClick={() => setPivot(null)}>
              ukloni pivot
            </button>
          )}
        </div>
      )}

      {showSemafor && (
        <div className="flex flex-col gap-1 rounded border border-border bg-panel p-2 text-xs">
          {semafor.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <select
                className={input}
                value={r.column}
                onChange={(e) =>
                  setSemafor((s) =>
                    s.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)),
                  )
                }
              >
                {numericCols.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                className={input}
                value={r.op}
                onChange={(e) =>
                  setSemafor((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, op: e.target.value as SemaforRule['op'] } : x,
                    ),
                  )
                }
              >
                {['<', '<=', '=', '>=', '>'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className={`${input} w-24`}
                value={r.value}
                onChange={(e) =>
                  setSemafor((s) =>
                    s.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)),
                  )
                }
              />
              <select
                className={input}
                value={r.color}
                onChange={(e) =>
                  setSemafor((s) =>
                    s.map((x, j) =>
                      j === i ? { ...x, color: e.target.value as SemaforRule['color'] } : x,
                    ),
                  )
                }
              >
                <option value="ok">zeleno</option>
                <option value="warn">žuto</option>
                <option value="danger">crveno</option>
              </select>
              <button
                type="button"
                className={btn}
                onClick={() => setSemafor((s) => s.filter((_, j) => j !== i))}
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${btn} self-start`}
            onClick={() =>
              numericCols[0] &&
              setSemafor((s) => [
                ...s,
                { column: numericCols[0].key, op: '<', value: 0, color: 'danger' },
              ])
            }
          >
            + pravilo
          </button>
          <p className="text-ink-faint">
            Prag za novčane kolone unosi se u najmanjoj jedinici (npr. 10000 = 100,00).
          </p>
        </div>
      )}

      {error && (
        <p className="rounded border border-danger bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {loading && !data && <p className="text-xs text-ink-faint">Učitavanje…</p>}

      {/* Pivot ili obična tabela */}
      {data && pivotData && pivot && (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={th}>
                  {columns.find((c) => c.key === pivot.row)?.label} \{' '}
                  {columns.find((c) => c.key === pivot.col)?.label}
                </th>
                {pivotData.cols.map((ck) => (
                  <th key={ck} className={th}>
                    {ck}
                  </th>
                ))}
                <th className={th}>ukupno</th>
              </tr>
            </thead>
            <tbody>
              {pivotData.rows.map((rk) => {
                const sum = pivotData.cols.reduce((s, ck) => s + pivotData.get(rk, ck), 0);
                return (
                  <tr key={rk} className="hover:bg-sunken">
                    <td className={`${td} font-medium`}>{rk}</td>
                    {pivotData.cols.map((ck) => (
                      <td
                        key={ck}
                        className={`${td} text-right ${semaforClass(semafor, pivot.measure, pivotData.get(rk, ck))}`}
                      >
                        {fmt(
                          pivotData.get(rk, ck),
                          pivot.agg === 'count' ? 'number' : pivotData.measureType,
                        )}
                      </td>
                    ))}
                    <td className={`${td} text-right font-semibold`}>
                      {fmt(sum, pivot.agg === 'count' ? 'number' : pivotData.measureType)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && !pivot && (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={`${th} w-6`}>
                  <input
                    type="checkbox"
                    aria-label="izaberi sve"
                    checked={visibleRows.length > 0 && selected.size === visibleRows.length}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(visibleRows.map((r) => r._key)) : new Set(),
                      )
                    }
                  />
                </th>
                {shownColumns.map((c) => (
                  <th
                    key={c.key}
                    className={`${th} cursor-pointer ${isNum(c) ? 'text-right' : ''}`}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sort?.column === c.key && (
                      <Icon
                        name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'}
                        className="!text-[12px]"
                      />
                    )}
                    {c.derived && scenarioOn && (
                      <span title="izvedena kolona — u scenariju" className="ml-0.5 text-warn">
                        *
                      </span>
                    )}
                  </th>
                ))}
                {data.previous &&
                  shownColumns.filter(isNum).flatMap((c) => [
                    <th key={`${c.key}__prev`} className={`${th} text-right text-ink-faint`}>
                      {c.label} (pre)
                    </th>,
                    <th key={`${c.key}__delta`} className={`${th} text-right`}>
                      Δ {c.label}
                    </th>,
                  ])}
              </tr>
              <tr>
                <th className="border-b border-border bg-panel-2 px-1 py-0.5" />
                {shownColumns.map((c) => (
                  <th key={`f-${c.key}`} className="border-b border-border bg-panel-2 px-1 py-0.5">
                    <input
                      className="input !py-0.5 text-[11px]"
                      placeholder={isNum(c) ? '>=, <=, a-b' : 'sadrži…'}
                      value={columnFilters[c.key] ?? ''}
                      onChange={(e) => setColumnFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                    />
                  </th>
                ))}
                {data.previous &&
                  shownColumns
                    .filter(isNum)
                    .flatMap((c) => [
                      <th key={`fp-${c.key}`} className="border-b border-border bg-panel-2" />,
                      <th key={`fd-${c.key}`} className="border-b border-border bg-panel-2" />,
                    ])}
              </tr>
            </thead>
            <tbody>
              {(grouped
                ? grouped.flatMap((g) => [
                    ...g.rows.map((r) => ({ r, g: null as null | typeof g })),
                    { r: null, g },
                  ])
                : visibleRows.map((r) => ({ r, g: null }))
              ).map(({ r, g }, idx) =>
                r ? (
                  <tr
                    key={r._key}
                    className={`${r._href ? 'cursor-pointer' : ''} hover:bg-sunken ${selected.has(r._key) ? 'bg-accent-soft' : ''}`}
                    onClick={() => rowClick(r)}
                  >
                    <td className={td} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r._key)}
                        onChange={(e) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(r._key);
                            else n.delete(r._key);
                            return n;
                          })
                        }
                      />
                    </td>
                    {shownColumns.map((c) => (
                      <td
                        key={c.key}
                        className={`${td} ${isNum(c) ? 'text-right' : ''} ${semaforClass(semafor, c.key, r[c.key])}`}
                        title={
                          c.derived && scenarioOn && data.rows.find((x) => x._key === r._key)
                            ? `stvarno: ${fmt(data.rows.find((x) => x._key === r._key)![c.key], c.type)}`
                            : undefined
                        }
                      >
                        {fmt(r[c.key], c.type)}
                      </td>
                    ))}
                    {data.previous &&
                      shownColumns.filter(isNum).flatMap((c) => {
                        const d = r[`${c.key}__delta`] as number | null;
                        return [
                          <td key={`${c.key}__prev`} className={`${td} text-right text-ink-faint`}>
                            {fmt(r[`${c.key}__prev`], c.type)}
                          </td>,
                          <td
                            key={`${c.key}__delta`}
                            className={`${td} text-right ${d === null ? '' : d > 0 ? 'text-ok' : d < 0 ? 'text-danger' : ''}`}
                          >
                            {d === null ? '' : `${d > 0 ? '+' : ''}${fmt(d, c.type)}`}
                          </td>,
                        ];
                      })}
                  </tr>
                ) : (
                  <tr key={`g-${g!.key}-${idx}`} className="bg-sunken font-semibold">
                    <td className={td} />
                    {shownColumns.map((c, i) => (
                      <td key={c.key} className={`${td} ${isNum(c) ? 'text-right' : ''}`}>
                        {i === 0
                          ? `${g!.key} (${g!.rows.length})`
                          : isNum(c)
                            ? fmt(g!.totals[c.key], c.type)
                            : ''}
                      </td>
                    ))}
                    {data.previous &&
                      shownColumns
                        .filter(isNum)
                        .flatMap((c) => [
                          <td key={`gp-${c.key}`} className={td} />,
                          <td key={`gd-${c.key}`} className={td} />,
                        ])}
                  </tr>
                ),
              )}
              {visibleRows.length === 0 && (
                <tr>
                  <td
                    className={`${td} text-center text-ink-faint`}
                    colSpan={shownColumns.length + 1}
                  >
                    Nema redova za zadate filtere.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-panel-2 font-semibold">
                <td className={td} />
                {shownColumns.map((c, i) => (
                  <td key={c.key} className={`${td} ${isNum(c) ? 'text-right' : ''}`}>
                    {i === 0 ? 'ukupno' : isNum(c) ? fmt(totals[c.key], c.type) : ''}
                  </td>
                ))}
                {data.previous &&
                  shownColumns
                    .filter(isNum)
                    .flatMap((c) => [
                      <td key={`tp-${c.key}`} className={td} />,
                      <td key={`td-${c.key}`} className={td} />,
                    ])}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* §6e.3g — zbir nad izabranim redovima */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-accent bg-accent-soft px-3 py-1.5 text-xs">
          <strong>Izabrano: {selectedRows.length}</strong>
          {shownColumns.filter(isNum).map((c) => {
            const t = selectedTotals[c.key];
            return (
              <span key={c.key}>
                {c.label}: <strong>{fmt(t, c.type)}</strong>
                {t !== null && selectedRows.length > 0 && c.type !== 'percent' && (
                  <span className="text-ink-faint">
                    {' '}
                    (prosek {fmt(Math.round(t / selectedRows.length), c.type)})
                  </span>
                )}
              </span>
            );
          })}
          <button type="button" className={`${btn} ml-auto`} onClick={() => setSelected(new Set())}>
            poništi izbor
          </button>
        </div>
      )}
    </div>
  );
}
