'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

type Theme = 'dark' | 'light';

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
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tt-panel-theme', next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Prebaci na svetli mod' : 'Prebaci na tamni mod'}
      className="flex h-[43px] w-[43px] items-center justify-center rounded border border-border bg-panel text-ink-faint hover:border-accent hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'color-mode' : 'circle-filled'} />
    </button>
  );
}
