// M5 spec §7.1 — klasifikacija stavke rezervacije po danu D, deterministička.
export type CalendarCategory = 'ARRIVAL' | 'DEPARTURE' | 'STAYOVER' | 'SINGLE_DAY';

// stayFrom/stayTo/day su poređeni na nivou kalendarskog dana (bez vremena) — pozivalac
// je odgovoran da normalizuje na ponoć pre poziva (isto pravilo za sva tri datuma).
export function classifyByDay(stayFrom: Date, stayTo: Date, day: Date): CalendarCategory {
  const from = stayFrom.getTime();
  const to = stayTo.getTime();
  const d = day.getTime();

  if (from === d && to === d) return 'SINGLE_DAY';
  if (from === d && to > d) return 'ARRIVAL';
  if (to === d && from < d) return 'DEPARTURE';
  if (from < d && d < to) return 'STAYOVER';

  throw new Error(`Dan ${day.toISOString()} ne pripada opsegu [${stayFrom.toISOString()}, ${stayTo.toISOString()}]`);
}

export function toMidnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
