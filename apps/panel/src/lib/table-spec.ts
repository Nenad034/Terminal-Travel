import type { FilterPill } from './table-filters';

// M17 spec §6e — Terminal tabela: spec u adresi (`/tabele/prikaz?spec=<base64url JSON>`),
// da tab bude ponovljiv i deljiv; podaci se svaki put ponovo izvlače (§6e.1 pravilo 1).

export type TableSourceId = 'bookings' | 'catalog' | 'funnel' | 'work_queue';

export interface TableSpec {
  source: TableSourceId;
  filters?: Record<string, string | string[]>;
  title?: string;
  columns?: string[];
  compare?: { from: string; to: string };
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'money' | 'date' | 'percent';
  internalOnly?: boolean;
  derived?: 'nabavna' | 'prodajna' | 'marza' | 'marza_pct' | 'provizija' | 'neto';
}

export type TableRow = Record<string, unknown> & { _key: string; _href?: string | null };

export interface TableResult {
  columns: TableColumn[];
  rows: TableRow[];
  rowCount: number;
  truncated: boolean;
  previous?: TableRow[];
}

/** Semafor po koloni (§6e.3d) — pravilo koje kod primeni, boja iz postojećih tokena. */
export interface SemaforRule {
  column: string;
  op: '<' | '<=' | '=' | '>=' | '>';
  value: number;
  color: 'ok' | 'warn' | 'danger';
}

/** Podešavanja prikaza koja se čuvaju uz tabelu (§6e.2) — nikad brojevi. */
export interface TableSettings {
  sort?: { column: string; dir: 'asc' | 'desc' };
  hidden?: string[];
  pinned?: string[];
  groupBy?: string | null;
  pivot?: { row: string; col: string; measure: string; agg: 'sum' | 'count' } | null;
  semafor?: SemaforRule[];
  columnFilters?: Record<string, string>;
  /** §6e.3 K2 — filter-trakice (`lib/table-filters.ts`). */
  pills?: FilterPill[];
  /** §6e.3 K1 — histogram: datumska kolona; `null` = sakriven; nedefinisano = prva datumska kolona. */
  histogram?: { column: string } | null;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeTableSpec(spec: TableSpec, settings?: TableSettings): string {
  return toBase64Url(JSON.stringify(settings ? { spec, settings } : { spec }));
}

export function decodeTableSpec(
  encoded: string | null | undefined,
): { spec: TableSpec; settings?: TableSettings } | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as {
      spec?: TableSpec;
      settings?: TableSettings;
    };
    if (!parsed.spec || typeof parsed.spec.source !== 'string') return null;
    return { spec: parsed.spec, settings: parsed.settings };
  } catch {
    return null;
  }
}
