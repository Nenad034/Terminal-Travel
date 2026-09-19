import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { getAgencyBrand } from '@/lib/agency';

// Master dokument razdvaja DVA imena: naziv platforme je **Terminal**, naziv agencije/brenda je
// zaseban podatak (M1 spec §3.9c). Zato naslov ostaje „Terminal“ i kad se agencija preimenuje —
// menja se samo ono što imenuje AGENCIJU, ovde opis.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Terminal — interni panel',
    description: `M17 — interni radni panel agencije ${await getAgencyBrand()}.`,
  };
}

/** Ključ kolačića sa ručno izabranom temom — deli ga `ThemeToggle.tsx`. */
export const THEME_COOKIE = 'tt-panel-theme';
const THEMES = ['light', 'dim', 'semi'] as const;
/** Crni `dark` mod uklonjen 19.9.2026 — star kolačić se čita kao njegova zamena, `semi`. */
const LEGACY_THEMES: Record<string, (typeof THEMES)[number]> = { dark: 'semi' };

// docs/analize/29-DIZAJN-SISTEM-UI.md §2 — izabrana tema se primenjuje BEZ "flash of wrong
// theme".
//
// Do 2.9.2026 je to radila blokirajuća `next/script` skripta u <head> koja je čitala
// `localStorage` pre hidratacije. React 19 na svaki `<script>` iscrtan iz komponente javlja
// "Encountered a script tag while rendering React component" (poznat, široko prijavljen slučaj
// kod next-themes/shadcn), a uz to je server HTML uvek bio bez `data-theme` pa je `<html>`
// morao da nosi `suppressHydrationWarning`.
//
// Sada se izbor čuva u KOLAČIĆU, koji server ume da pročita, pa `data-theme` stiže već u
// prvom HTML-u. Nema skripte, nema upozorenja, nema neslaganja server/klijent — i nema ni
// treptaja, jer se tema ne postavlja "brzo posle" nego odmah. Bez kolačića se ne postavlja
// ništa i važi svetli mod (`:root`) — `prefers-color-scheme` grana je uklonjena 19.9.2026 zajedno
// sa crnim tamnim modom (globals.css § komentar uz `:root[data-theme='semi']`).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = THEMES.find((t) => t === stored) ?? (stored ? LEGACY_THEMES[stored] : undefined);

  return (
    <html lang="sr" data-theme={theme}>
      <body className="font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
