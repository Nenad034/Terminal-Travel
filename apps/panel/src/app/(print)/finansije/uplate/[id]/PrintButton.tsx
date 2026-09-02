'use client';

// Dopuna (2.9.2026, na zahtev vlasnika — "omogućiti pregled i štampanje specifikacije čekova").
// Štampanje ide preko browser-a (Ctrl+P / Print to PDF), isti obrazac kao apps/web vaučer
// stranica — ova ruta je namerno u sopstvenoj `(print)` grupi (bez Shell bočne trake/topbar-a,
// vidi (app)/layout.tsx) da se na štampi ne pojavi ništa osim same specifikacije.
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="print:hidden rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
      Odštampaj
    </button>
  );
}
