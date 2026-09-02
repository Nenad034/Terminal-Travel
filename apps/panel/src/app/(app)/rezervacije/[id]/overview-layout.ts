// Izgled kartice "Pregled" — ključ preference i tip, u NEUTRALNOM modulu (bez `'use client'`).
//
// ZAŠTO POSEBAN FAJL, a ne konstanta u `OverviewLayoutSwitch.tsx`: taj fajl je `'use client'`, a
// modul označen kao klijentski se u server komponenti ne uvozi kao običan JavaScript — svi
// njegovi izvozi postaju "client reference" objekti koje bundler zamenjuje pri isporuci. Za
// komponentu to je upravo ono što treba; za običnu konstantu nije: umesto stringa
// `'booking_overview_layout'` server dobije objekat, pa `prefs[KLJUČ]` postane `prefs['[object
// Object]']` → `undefined`. Ništa ne pukne, ništa se ne prijavi — samo se preferenca tiho nikad
// ne poklopi i ekran uvek prikazuje podrazumevanu vrednost.
//
// Uhvaćeno 2.9.2026 uživo (preferenca je u bazi bila `klasicni`, ekran je i dalje prikazivao
// `novi`), pa je greška zabeležena kao zamka 9.4 u `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`.
// Pravilo koje iz toga sledi: sve što server komponenta treba da PROČITA (konstante, tipovi,
// pomoćne čiste funkcije) živi u neutralnom modulu; `'use client'` fajl izvozi samo komponentu.

export type OverviewLayout = 'novi' | 'klasicni';

export const OVERVIEW_LAYOUT_PREFERENCE_KEY = 'booking_overview_layout';

export const DEFAULT_OVERVIEW_LAYOUT: OverviewLayout = 'novi';
