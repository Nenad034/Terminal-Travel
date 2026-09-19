import type { TableColumn, TableRow } from './table-spec';

// M17 spec §6e.3 K1/K2 (19.9.2026, uzor Kibana Discover) — čiste funkcije za filter-trakice
// („pills") i histogram po datumskoj koloni. Sve radi KOD nad već izvučenim redovima (§6e.1):
// ništa se ne kuca u ćelije, ništa ne ide modelu osim sažetka. Testirano u `table-filters.spec.ts`.

/** Strukturni filter — trakica iznad tabele. `range` je uključiv sa obe strane. */
export interface FilterPill {
  column: string;
  op: 'is' | 'is_not' | 'range';
  /** Sirova vrednost iz reda kao string (novac u parama, datum `YYYY-MM-DD`). */
  value: string;
  /** Samo za `range` — gornja granica (uključivo). */
  to?: string;
  /** Isključena trakica ostaje vidljiva (precrtana) ali ne deluje. */
  enabled: boolean;
}

export type HistogramBucket = 'day' | 'week' | 'month';

export interface HistogramBar {
  /** Početak korpe, `YYYY-MM-DD`. */
  from: string;
  /** Kraj korpe, `YYYY-MM-DD`, uključivo. */
  to: string;
  count: number;
}

function isNum(c: TableColumn | undefined): boolean {
  return !!c && (c.type === 'number' || c.type === 'money' || c.type === 'percent');
}

function dayOf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

/** Da li red prolazi JEDNU trakicu (isključena uvek prolazi). */
export function pillMatches(
  row: TableRow,
  pill: FilterPill,
  column: TableColumn | undefined,
): boolean {
  if (!pill.enabled) return true;
  const v = row[pill.column];
  if (pill.op === 'range') {
    if (v === null || v === undefined) return false;
    if (column?.type === 'date') {
      const d = dayOf(v);
      return d !== null && d >= pill.value && (pill.to === undefined || d <= pill.to);
    }
    if (isNum(column)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isNaN(n)) return false;
      const lo = Number(pill.value);
      const hi = pill.to === undefined ? Infinity : Number(pill.to);
      return n >= lo && n <= hi;
    }
    const s = String(v);
    return s >= pill.value && (pill.to === undefined || s <= pill.to);
  }
  const eq =
    v === null || v === undefined
      ? pill.value === ''
      : column?.type === 'date'
        ? dayOf(v) === pill.value
        : String(v) === pill.value;
  return pill.op === 'is' ? eq : !eq;
}

/** Primena svih trakica (redosled §6e.3 K2: posle scenarija/poređenja, pre filtera „sadrži"). */
export function applyPills(
  rows: TableRow[],
  pills: FilterPill[],
  columns: TableColumn[],
): TableRow[] {
  const active = pills.filter((p) => p.enabled);
  if (active.length === 0) return rows;
  const byKey = new Map(columns.map((c) => [c.key, c]));
  return rows.filter((r) => active.every((p) => pillMatches(r, p, byKey.get(p.column))));
}

/** Trakica iz ćelije (hover + / −): datum → opseg tog dana, ostalo → jednako sirovoj vrednosti. */
export function pillForCell(column: TableColumn, value: unknown, negate: boolean): FilterPill {
  if (column.type === 'date') {
    const d = dayOf(value) ?? '';
    // „Nije taj dan" se izražava kao dva opsega — previše za trakicu; zato datum uvek `range`,
    // a negacija se za datum ne nudi (poziv sa `negate` ipak vraća opseg, ne baca).
    return { column: column.key, op: 'range', value: d, to: d, enabled: true };
  }
  const raw = value === null || value === undefined ? '' : String(value);
  return { column: column.key, op: negate ? 'is_not' : 'is', value: raw, enabled: true };
}

/** Dodaj trakicu; ista kolona+op+vrednost se ne duplira, a `range` po koloni ZAMENJUJE stari opseg. */
export function upsertPill(pills: FilterPill[], pill: FilterPill): FilterPill[] {
  if (pill.op === 'range') {
    return [...pills.filter((p) => !(p.column === pill.column && p.op === 'range')), pill];
  }
  const same = pills.find(
    (p) => p.column === pill.column && p.op === pill.op && p.value === pill.value,
  );
  if (same) return pills.map((p) => (p === same ? { ...p, enabled: true } : p));
  return [...pills, pill];
}

export function invertPill(pill: FilterPill): FilterPill {
  if (pill.op === 'range') return pill;
  return { ...pill, op: pill.op === 'is' ? 'is_not' : 'is' };
}

/** Oznaka trakice za ekran — vrednost formatirana kao u tabeli (`fmt` dolazi iz pozivaoca). */
export function pillLabel(
  pill: FilterPill,
  column: TableColumn | undefined,
  fmt: (v: unknown, type: TableColumn['type']) => string,
): string {
  const name = column?.label ?? pill.column;
  const type = column?.type ?? 'text';
  const show = (s: string) => {
    if (s === '') return '(prazno)';
    if (type === 'money' || type === 'number' || type === 'percent') return fmt(Number(s), type);
    return fmt(s, type);
  };
  if (pill.op === 'range') {
    const a = show(pill.value);
    const b = pill.to === undefined ? '' : show(pill.to);
    return pill.to !== undefined && pill.to === pill.value
      ? `${name}: ${a}`
      : `${name}: ${a} – ${b}`;
  }
  return pill.op === 'is' ? `${name}: ${show(pill.value)}` : `${name} ≠ ${show(pill.value)}`;
}

/** Prevod trakica u `TableTransform.filters` za server (§6e.3j — server ponovo primeni isto). */
export function pillsToTransform(
  pills: FilterPill[],
): { column: string; op: 'eq' | 'neq' | 'gte' | 'lte'; value: string }[] {
  const out: { column: string; op: 'eq' | 'neq' | 'gte' | 'lte'; value: string }[] = [];
  for (const p of pills) {
    if (!p.enabled) continue;
    if (p.op === 'is') out.push({ column: p.column, op: 'eq', value: p.value });
    else if (p.op === 'is_not') out.push({ column: p.column, op: 'neq', value: p.value });
    else {
      out.push({ column: p.column, op: 'gte', value: p.value });
      if (p.to !== undefined) out.push({ column: p.column, op: 'lte', value: p.to });
    }
  }
  return out;
}

// ---------- histogram (K1) ----------

const DAN_MS = 86_400_000;

function parseUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Korpa po rasponu: ≤ 31 dan → dan, ≤ 26 nedelja → nedelja, inače mesec (§6e.3 K1). */
export function chooseBucket(minIso: string, maxIso: string): HistogramBucket {
  const days = Math.round((parseUtc(maxIso) - parseUtc(minIso)) / DAN_MS);
  if (days <= 31) return 'day';
  if (days <= 26 * 7) return 'week';
  return 'month';
}

/** Početak korpe u kojoj je datum (nedelja počinje ponedeljkom). */
export function bucketStart(iso: string, bucket: HistogramBucket): string {
  const ms = parseUtc(iso);
  if (bucket === 'day') return iso;
  if (bucket === 'week') {
    const dow = (new Date(ms).getUTCDay() + 6) % 7; // pon = 0
    return toIso(ms - dow * DAN_MS);
  }
  return `${iso.slice(0, 7)}-01`;
}

/** Početak SLEDEĆE korpe. */
export function nextBucket(startIso: string, bucket: HistogramBucket): string {
  const ms = parseUtc(startIso);
  if (bucket === 'day') return toIso(ms + DAN_MS);
  if (bucket === 'week') return toIso(ms + 7 * DAN_MS);
  const [y, m] = startIso.split('-').map(Number);
  return toIso(Date.UTC(y, m, 1));
}

/**
 * Broj redova po korpi nad datumskom kolonom; prazne korpe između prve i poslednje su
 * prisutne sa `count: 0`. Redovi bez datuma se ne broje. Vraća `null` kad nema nijednog datuma.
 */
export function histogram(
  rows: TableRow[],
  column: string,
  forced?: HistogramBucket,
): { bucket: HistogramBucket; bars: HistogramBar[] } | null {
  const days: string[] = [];
  for (const r of rows) {
    const d = dayOf(r[column]);
    if (d) days.push(d);
  }
  if (days.length === 0) return null;
  let min = days[0];
  let max = days[0];
  for (const d of days) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const bucket = forced ?? chooseBucket(min, max);
  const counts = new Map<string, number>();
  for (const d of days) {
    const k = bucketStart(d, bucket);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const bars: HistogramBar[] = [];
  let cur = bucketStart(min, bucket);
  const last = bucketStart(max, bucket);
  // gornja granica petlje — zaštita od beskonačne petlje pri oštećenom datumu
  for (let i = 0; i < 2000 && cur <= last; i++) {
    const next = nextBucket(cur, bucket);
    bars.push({ from: cur, to: toIso(parseUtc(next) - DAN_MS), count: counts.get(cur) ?? 0 });
    cur = next;
  }
  return { bucket, bars };
}

export const BUCKET_LABEL: Record<HistogramBucket, string> = {
  day: 'po danu',
  week: 'po nedelji',
  month: 'po mesecu',
};
