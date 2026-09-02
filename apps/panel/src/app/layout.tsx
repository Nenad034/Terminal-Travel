import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';


export const metadata: Metadata = {
  title: 'Terminal — interni panel',
  description: 'M17 — interni radni panel agencije Terminal Travel.',
};

/** Ključ kolačića sa ručno izabranom temom — deli ga `ThemeToggle.tsx`. */
export const THEME_COOKIE = 'tt-panel-theme';
const THEMES = ['light', 'dim', 'dark'] as const;

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
// ništa i CSS `prefers-color-scheme` odlučuje, isto kao ranije (globals.css §2).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = THEMES.find((t) => t === stored);

  return (
    <html lang="sr" data-theme={theme}>
      <body className="font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
