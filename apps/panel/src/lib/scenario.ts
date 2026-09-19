import type { TableColumn, TableRow } from './table-spec';

// M17 spec §6e.4 — scenario („šta ako"), samo Vlasnik/Direktor (`M13/scenario/USE`).
// Menjaju se PARAMETRI, ne ćelije; ništa se ne upisuje u module. Formule su ovde, u kodu,
// i deluju samo na kolone koje je registar izvora označio kao izvedene (`derived`).
//
//   nabavna'  = nabavna × (1 + Δnabavna)
//   prodajna' = nabavna' × (1 + marža)            kad je marža zadata
//             = prodajna × (1 + Δnabavna)          inače (nabavna se pomeri, marža % ostaje)
//   provizija' = prodajna' × provizija%           kad je zadata, inače iz podatka
//   neto'     = prodajna' − nabavna' − provizija'
//   u RSD     = iznos × kurs                       (posebna kolona, ne menja izvorne)
//   popunjenost deluje SAMO na zbirove: zbir' = zbir × (1 + Δpopunjenost)

export interface ScenarioParams {
  /** marža u %, npr. 18 — prazno = ne menja se */
  marzaPct?: number | null;
  /** provizija subagenta u %, npr. 10 */
  provizijaPct?: number | null;
  /** RSD za 1 EUR, npr. 117.2 */
  kurs?: number | null;
  /** promena nabavne u %, npr. +5 ili −3 */
  nabavnaDeltaPct?: number | null;
  /** promena popunjenosti u %, deluje na zbirove */
  popunjenostDeltaPct?: number | null;
}

export const SCENARIO_PARAM_LABELS: Record<keyof ScenarioParams, string> = {
  marzaPct: 'marža %',
  provizijaPct: 'provizija subagenta %',
  kurs: 'kurs RSD/EUR',
  nabavnaDeltaPct: 'nabavna ±%',
  popunjenostDeltaPct: 'popunjenost ±%',
};

export function isScenarioActive(p: ScenarioParams | null | undefined): boolean {
  if (!p) return false;
  return (Object.keys(p) as (keyof ScenarioParams)[]).some(
    (k) => p[k] !== null && p[k] !== undefined && !Number.isNaN(p[k] as number),
  );
}

export function scenarioLabel(p: ScenarioParams): string {
  return (Object.keys(SCENARIO_PARAM_LABELS) as (keyof ScenarioParams)[])
    .filter((k) => p[k] !== null && p[k] !== undefined)
    .map((k) => `${SCENARIO_PARAM_LABELS[k]} = ${p[k]}`)
    .join(', ');
}

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

/**
 * Preračun jednog reda. Vraća NOV red (izvorni ostaje netaknut — „stvarna vrednost u tooltip-u").
 * Kolone koje nisu `derived` se ne diraju. Kad izvor nema nabavnu (maskiran pozivalac), marža i
 * neto ostaju `null` — scenario ne izmišlja nabavnu.
 */
export function applyScenarioToRow(
  row: TableRow,
  columns: TableColumn[],
  p: ScenarioParams,
): TableRow {
  if (!isScenarioActive(p)) return row;
  const has = (f: TableColumn['derived']) => columns.some((c) => c.derived === f);
  const key = (f: TableColumn['derived']) => columns.find((c) => c.derived === f)?.key;

  const nabavna0 = has('nabavna') ? num(row[key('nabavna')!]) : null;
  const prodajna0 = has('prodajna') ? num(row[key('prodajna')!]) : null;
  const provizija0 = has('provizija') ? num(row[key('provizija')!]) : null;

  const dN = (p.nabavnaDeltaPct ?? 0) / 100;
  const nabavna = nabavna0 === null ? null : Math.round(nabavna0 * (1 + dN));
  let prodajna = prodajna0;
  if (p.marzaPct !== null && p.marzaPct !== undefined && nabavna !== null) {
    prodajna = Math.round(nabavna * (1 + p.marzaPct / 100));
  } else if (prodajna0 !== null && dN !== 0) {
    prodajna = Math.round(prodajna0 * (1 + dN));
  }
  let provizija = provizija0;
  if (p.provizijaPct !== null && p.provizijaPct !== undefined && prodajna !== null) {
    provizija = Math.round(prodajna * (p.provizijaPct / 100));
  }
  const marza = prodajna !== null && nabavna !== null ? prodajna - nabavna : null;
  const neto = marza !== null ? marza - (provizija ?? 0) : null;

  const out: TableRow = { ...row };
  if (has('nabavna')) out[key('nabavna')!] = nabavna;
  if (has('prodajna')) out[key('prodajna')!] = prodajna;
  if (has('provizija')) out[key('provizija')!] = provizija;
  if (has('marza')) out[key('marza')!] = marza;
  if (has('marza_pct'))
    out[key('marza_pct')!] =
      marza !== null && nabavna ? Math.round((marza / nabavna) * 1000) / 10 : null;
  if (has('neto')) out[key('neto')!] = neto;
  if (p.kurs && prodajna !== null) out.prodajna_rsd = Math.round(prodajna * p.kurs);
  return out;
}

/** Zbir po numeričkoj koloni (suma), sa popunjenošću koja deluje SAMO ovde. */
export function scenarioTotals(
  rows: TableRow[],
  columns: TableColumn[],
  p: ScenarioParams | null,
): Record<string, number | null> {
  const totals: Record<string, number | null> = {};
  const factor = 1 + (p?.popunjenostDeltaPct ?? 0) / 100;
  for (const c of columns) {
    if (c.type !== 'number' && c.type !== 'money') continue;
    const nums = rows.map((r) => r[c.key]).filter((v): v is number => typeof v === 'number');
    totals[c.key] = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) * factor) : null;
  }
  return totals;
}

/**
 * §6e.4 „AI predlaže parametre": kod traži maržu koja daje ciljni neto uz zadatu promenu
 * popunjenosti — jednostavno rešavanje po jednom parametru (bisekcija), model samo formuliše.
 */
export function solveMarginForTargetNeto(
  rows: TableRow[],
  columns: TableColumn[],
  targetNeto: number,
  base: ScenarioParams,
): number | null {
  const netoKey = columns.find((c) => c.derived === 'neto')?.key;
  if (!netoKey) return null;
  const netoAt = (m: number) =>
    scenarioTotals(
      rows.map((r) => applyScenarioToRow(r, columns, { ...base, marzaPct: m })),
      columns,
      base,
    )[netoKey];
  let lo = 0;
  let hi = 100;
  const nLo = netoAt(lo);
  const nHi = netoAt(hi);
  if (nLo === null || nHi === null || targetNeto < nLo || targetNeto > nHi) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const n = netoAt(mid);
    if (n === null) return null;
    if (n < targetNeto) lo = mid;
    else hi = mid;
  }
  return Math.round(hi * 10) / 10;
}
