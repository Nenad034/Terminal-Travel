'use client';

import { useFilterMode, type FilterDisplayMode } from './FilterModeContext';

// Dopuna 6.9.2026 — "levi panel" ukinut (vlasnikov zahtev: "ukinite pretragu u levom panelu
// zadrzite u traci i u prozoru"), ostaju samo dve opcije.
const OPTIONS: { mode: FilterDisplayMode; label: string; title: string }[] = [
  { mode: 'traka', label: 'traka', title: 'Traka filtera — uvek vidljiva' },
  { mode: 'prozor', label: 'prozor', title: 'Iskačući prozor — bolji raspored na manjim ekranima (laptop/tablet)' },
];

// U liniji sa naslovom stranice, iznad trake ikonica (6.9.2026, vlasnikov zahtev) — vidi
// `FilterModeContext.tsx` za razlog konteksta umesto lokalnog stanja u `RealFilterBar.tsx`.
export default function FilterModeToggle() {
  const { mode, setMode } = useFilterMode();
  return (
    <div className="flex flex-shrink-0 overflow-hidden rounded border border-border text-[11px]">
      {OPTIONS.map((o, i) => (
        <button
          key={o.mode}
          type="button"
          onClick={() => setMode(o.mode)}
          title={o.title}
          className={`px-2 py-1 font-medium ${i > 0 ? 'border-l border-border' : ''} ${
            mode === o.mode ? 'bg-accent-soft text-accent-strong' : 'text-ink-dim hover:bg-panel2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
