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

// docs/analize/29-DIZAJN-SISTEM-UI.md §2 — ručni prekidač, pamti izbor lokalno
// (localStorage), "ne traži poseban ekran podešavanja, dovoljna je jedna ikonica u uglu
// gornje trake" — vidi i src/app/layout.tsx (THEME_INIT_SCRIPT, sprečava flash pri učitavanju).
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    setTheme(current ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }, []);

  function toggle() {
    const next = CYCLE[(CYCLE.indexOf(theme ?? 'light') + 1) % CYCLE.length];
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tt-panel-theme', next);
  }

  return (
    <button
      onClick={toggle}
      title={LABELS[theme ?? 'light']}
      className="flex h-[43px] w-[43px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
    >
      <Icon name={ICONS[theme ?? 'light']} />
    </button>
  );
}
