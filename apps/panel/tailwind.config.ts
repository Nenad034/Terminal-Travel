import type { Config } from 'tailwindcss';

// M17 zadatak (avgust 2026) — paleta "Horizont" (docs/moduli/M01-core-identitet/
// 00-MOCKUP-M1-TERMINAL-STYLE.html, paleta 3), HEX vrednosti fino podešene i PROVERENE
// lokalno (node kontrast-skripta, WCAG 2.1 AA) protiv svake stvarne pozadine u oba moda —
// docs/analize/29-DIZAJN-SISTEM-UI.md poglavlje 2a. Vrednosti su upisane i u poglavlje 8
// tog dokumenta (rešeno otvoreno pitanje).
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        panel2: 'var(--panel-2)',
        'panel-2': 'var(--panel-2)', // alias — koristi se naizmenično sa `panel2` kroz komponente
        // Treća nijansa (23.8.2026, na zahtev vlasnika — "sve trake neka budu za nijansu
        // tamnije od svega") — TopBar.tsx/StatusBar.tsx (i ono što je unutar njih, npr.
        // TabBar.tsx), NIJE isto što i `panel-2` (Sidebar.tsx/RightPanel.tsx), vidi globals.css.
        bar: 'var(--bar)',
        border: 'var(--border)',
        ink: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-dim)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        accent2: {
          DEFAULT: 'var(--accent2)',
          soft: 'var(--accent2-soft)',
        },
        ok: { DEFAULT: 'var(--ok)', bg: 'var(--ok-bg)' },
        warn: { DEFAULT: 'var(--warn)', bg: 'var(--warn-bg)' },
        danger: { DEFAULT: 'var(--danger)', bg: 'var(--danger-bg)' },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Code"', '"Cascadia Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
        // Wordmark loga (26.8.2026) — vidi napomenu uz @import u globals.css.
        brand: ['"Chakra Petch"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'scale-in': 'scale-in 120ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
