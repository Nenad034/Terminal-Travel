// M5 spec §3.0e.3a — klijentska verzija ISTE determinističke provere kao API
// (`apps/api/src/modules/m5-rezervacije/common/date-mismatch.ts`). Ovo je samo brža povratna
// informacija PRE slanja zahteva — server ostaje jedini pravi oslonac, isti princip kao svaka
// druga bezbednosno/poslovno relevantna provera u ovom kodu (nikad se ne veruje samo klijentu).
const TRANSIT_TYPES = new Set(['FLIGHT', 'TRANSFER']);
const STAY_TYPES = new Set(['ACCOMMODATION', 'PACKAGE']);
const TOLERANCE_MS = 24 * 60 * 60 * 1000;

export interface DateMismatchCandidate {
  key: string;
  productName: string;
  productType: string;
  stayFrom?: string;
  stayTo?: string;
}

export interface DateMismatchWarning {
  productName: string;
  stayFrom: string;
  stayTo: string;
}

/** Vraća PREVOZ stavke čiji se datum uopšte ne preklapa (uz toleranciju 1 dan) sa opsegom
 * BORAVAK stavki — prazan niz kad provera nije primenjiva ili nema neusklađenosti. */
export function findSelectionDateMismatches(items: DateMismatchCandidate[]): DateMismatchWarning[] {
  const stayItems = items.filter((i) => STAY_TYPES.has(i.productType) && i.stayFrom && i.stayTo);
  const transitItems = items.filter((i) => TRANSIT_TYPES.has(i.productType) && i.stayFrom && i.stayTo);
  if (stayItems.length === 0 || transitItems.length === 0) return [];

  const stayFromMs = Math.min(...stayItems.map((i) => new Date(i.stayFrom!).getTime()));
  const stayToMs = Math.max(...stayItems.map((i) => new Date(i.stayTo!).getTime()));
  const rangeStart = stayFromMs - TOLERANCE_MS;
  const rangeEnd = stayToMs + TOLERANCE_MS;

  return transitItems
    .filter((i) => {
      const from = new Date(i.stayFrom!).getTime();
      const to = new Date(i.stayTo!).getTime();
      return to < rangeStart || from > rangeEnd;
    })
    .map((i) => ({ productName: i.productName, stayFrom: i.stayFrom!, stayTo: i.stayTo! }));
}
