'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

type Theme = 'light' | 'dim' | 'dark';

// Ciklus svetli → dim → tamni → svetli (29.8.2026, treći "dim" mod dodat na zahtev vlasnika —
// isti koncept kao Twitter/X "Dim", plavkasto-siva atmosfera između svetlog i punog tamnog,
// docs/analize/29-DIZAJN-SISTEM-UI.md §2 dopuna). "dim" nema `prefers-color-scheme` granu (OS
// ne ume da signalizira tri stanja) — dostupan isključivo preko ovog ručnog prekidača.
const CYCLE: Theme[] = ['light', 'dim', 'dark'];
const LABELS: Record<Theme, string> = { light: 'Prebaci na dim mod', dim: 'Prebaci na tamni mod', dark: 'Prebaci na svetli mod' };
const ICONS: Record<Theme, string> = { light: 'circle-filled', dim: 'circle-large-outline', dark: 'color-mode' };

const THEME_COOKIE = 'tt-panel-theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

// docs/analize/29-DIZAJN-SISTEM-UI.md §2 — ručni prekidač, "ne traži poseban ekran podešavanja,
// dovoljna je jedna ikonica u uglu gornje trake".
//
// Izbor se pamti u KOLAČIĆU, ne u `localStorage` (izmena 2.9.2026) — server ga tako čita i
// upisuje `data-theme` već u prvi HTML (`app/layout.tsx`), pa nema ni treptaja pogrešne teme ni
// React 19 upozorenja o `<script>` tagu koje je nosilo staro rešenje. Kolačić NIJE httpOnly
// (ovaj prekidač ga upisuje iz browsera) i ne nosi ništa osetljivo — samo izabranu temu.
function writeThemeCookie(theme: Theme) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; SameSite=Lax${secure}`;
}

function readThemeCookie(): Theme | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return CYCLE.includes(value as Theme) ? (value as Theme) : null;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Prelaz sa starog `localStorage` mesta (do 2.9.2026) — bez ovoga bi svako ko je već birao
    // temu izgubio izbor pri prvom otvaranju posle izmene. Prenosi se jednom, pa se stari ključ
    // uklanja da ne ostanu dva izvora istine.
    if (!readThemeCookie()) {
      try {
        const legacy = localStorage.getItem(THEME_COOKIE);
        if (CYCLE.includes(legacy as Theme)) {
          writeThemeCookie(legacy as Theme);
          document.documentElement.setAttribute('data-theme', legacy as string);
        }
      } catch {
        // Privatni režim / blokirani kolačići — nema šta da se prenese, tema ostaje po OS-u.
      }
    }
    try {
      localStorage.removeItem(THEME_COOKIE);
    } catch {
      // Bez posledica — uklanjanje starog ključa je čišćenje, ne uslov za rad.
    }

    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    setTheme(current ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }, []);

  function toggle() {
    const next = CYCLE[(CYCLE.indexOf(theme ?? 'light') + 1) % CYCLE.length];
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    writeThemeCookie(next);
  }

  return (
    <button
      onClick={toggle}
      title={LABELS[theme ?? 'light']}
      // Kvadratni "tag" (5.9.2026, vlasnikov zahtev: "ikone u desnoj traci takodje stavite u
      // tagove, kao sto su u levoj") — isti jezik kao `ActivityBar.tsx` bedž (h-9 w-9 → 36px,
      // `rounded-md`, `bg-panel`), otkad je ovo dugme preseljeno iz `TopBar.tsx` u `RightRail.tsx`.
      className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md bg-panel text-ink-faint hover:bg-panel2 hover:text-ink"
    >
      <Icon name={ICONS[theme ?? 'light']} />
    </button>
  );
}
