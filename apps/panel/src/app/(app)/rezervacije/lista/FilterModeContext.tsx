'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "traka prozor levi panel staviti u liniji sa
// naslovom taba iznad brzih [ikonica] u desnom kraju") — prekidač izgleda filtera seli se iz
// `RealFilterBar.tsx` (koji stoji ISPOD trake ikonica u `BookingsListClient.tsx`) u red sa
// naslovom stranice (`page.tsx`, iznad cele trake ikonica). Stanje mora da postoji IZNAD oba
// mesta koja ga koriste (naslov i `RealFilterBar`) — otud kontekst umesto lokalnog `useState`
// unutar `RealFilterBar.tsx` kao ranije.
// Dopuna 6.9.2026 (vlasnikov zahtev: "ukinite pretragu u levom panelu zadrzite u traci i u
// prozoru") — "ladica"/levi panel UKINUT, ne samo sakriven; `FilterDrawer` obrisan iz
// `RealFilterBar.tsx` u istom prolazu. Ostaju samo "traka" i "prozor".
export type FilterDisplayMode = 'traka' | 'prozor';
const MODE_STORAGE_KEY = 'rezervacije-lista-filter-mode';

const FilterModeContext = createContext<{ mode: FilterDisplayMode; setMode: (m: FilterDisplayMode) => void } | null>(null);

export function FilterModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<FilterDisplayMode>('traka');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      // Stara vrednost "ladica" (pre ukidanja) se tiho ignoriše — pada na podrazumevanu "traka".
      if (saved === 'traka' || saved === 'prozor') setModeState(saved);
    } catch {
      // privatan prozor/blokirano skladište — ostaje podrazumevana "traka", bez greške na ekranu
    }
  }, []);

  function setMode(next: FilterDisplayMode) {
    setModeState(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // isti razlog kao iznad — čisto vizuelna preferenca, ne mora da uspe
    }
  }

  return <FilterModeContext.Provider value={{ mode, setMode }}>{children}</FilterModeContext.Provider>;
}

export function useFilterMode() {
  const ctx = useContext(FilterModeContext);
  if (!ctx) throw new Error('useFilterMode mora biti pozvan unutar <FilterModeProvider>.');
  return ctx;
}
