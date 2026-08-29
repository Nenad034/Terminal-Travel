import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

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

        // shadcn/ui semantički alias-i (29.8.2026, tt-shadcn-redesign) — NE nova paleta,
        // svaki mapiran na postojeći "Horizont" token iznad, da shadcn komponente (kopiran
        // izvorni kod, ne paket) rade sa bojama koje su već WCAG-proverene za ovaj panel.
        // "accent" NIJE dodat ovde namerno — shadcn ga koristi za hover-highlight pozadinu
        // (npr. stavka menija na hover), ali je taj naziv već zauzet iznad za brend boju;
        // kopirane komponente koriste `muted`/`muted-foreground` na mestu shadcn-ovog
        // "accent"/"accent-foreground" da izbegnu sudar značenja.
        background: 'var(--bg)',
        foreground: 'var(--text)',
        card: { DEFAULT: 'var(--panel)', foreground: 'var(--text)' },
        popover: { DEFAULT: 'var(--panel)', foreground: 'var(--text)' },
        primary: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-ink)' },
        secondary: { DEFAULT: 'var(--panel-2)', foreground: 'var(--text)' },
        muted: { DEFAULT: 'var(--panel-2)', foreground: 'var(--text-faint)' },
        // Nema `destructive-foreground` vrednosti — kontrast pune crvene pozadine nije
        // proveren za oba moda (docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md, WCAG odeljak),
        // zato prve migrirane komponente koriste isključivo outline/ghost destructive
        // varijantu (tekst/border `--danger` na providnoj pozadini, već proveren par).
        destructive: 'var(--danger)',
        input: 'var(--border)',
        ring: 'var(--accent-strong)',
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
  plugins: [tailwindcssAnimate],
};

export default config;
