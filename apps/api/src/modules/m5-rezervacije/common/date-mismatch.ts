// M5 spec §3.0e.3a — deterministička provera (princip #4 Master dokumenta), deljena između
// klijenta (brza povratna informacija, RightPanel.tsx) i servera (jedini pravi oslonac, ovde).
const TRANSIT_TYPES = new Set(['FLIGHT', 'TRANSFER']);
const STAY_TYPES = new Set(['ACCOMMODATION', 'PACKAGE']);
const TOLERANCE_MS = 24 * 60 * 60 * 1000;

export interface DateMismatchItem {
  productId: string;
  type: string;
  stayFrom: Date | string;
  stayTo: Date | string;
}

export interface DateMismatchResult {
  mismatched: DateMismatchItem[];
}

/**
 * Vraća PREVOZ (`FLIGHT`/`TRANSFER`) stavke čiji se datum uopšte ne preklapa (uz toleranciju od
 * 1 dan) sa opsegom BORAVAK (`ACCOMMODATION`/`PACKAGE`) stavki. Prazan niz kad provera nije
 * primenjiva (nema obe grupe) ili nema neusklađenosti.
 */
export function findDateMismatches(items: DateMismatchItem[]): DateMismatchResult {
  const stayItems = items.filter((i) => STAY_TYPES.has(i.type));
  const transitItems = items.filter((i) => TRANSIT_TYPES.has(i.type));
  if (stayItems.length === 0 || transitItems.length === 0) return { mismatched: [] };

  const stayFromMs = Math.min(...stayItems.map((i) => new Date(i.stayFrom).getTime()));
  const stayToMs = Math.max(...stayItems.map((i) => new Date(i.stayTo).getTime()));
  const rangeStart = stayFromMs - TOLERANCE_MS;
  const rangeEnd = stayToMs + TOLERANCE_MS;

  const mismatched = transitItems.filter((i) => {
    const from = new Date(i.stayFrom).getTime();
    const to = new Date(i.stayTo).getTime();
    return to < rangeStart || from > rangeEnd;
  });

  return { mismatched };
}
