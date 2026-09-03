import type { Config } from 'tailwindcss';

// M8 spec §1a — paleta "Zalazak" (docs/moduli/M01-core-identitet/00-MOCKUP-M1-TERMINAL-STYLE.html,
// paleta 1), preneta ovde kao CSS custom properties (globals.css) — samo boje, ne terminal/monospace
// izgled (taj mockup je za M17, ne za javan sajt).
const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        panel2: 'var(--panel-2)',
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
        // Šljiva — DRUGA boja identiteta (vlasnikova odluka 17.8.2026); zamenila zelenu
        // (accent2), koja je ukinuta. Uloga i merenja: vidi komentar u globals.css.
        plum: {
          DEFAULT: 'var(--plum)',
          soft: 'var(--plum-soft)',
          ink: 'var(--plum-ink)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        // Podloge upozorenja/uspeha: promenljive postoje u `globals.css` od početka, ali nikad
        // nisu bile izložene Tailwind-u — `bg-warn-bg` je do 3.9.2026 bila klasa koja ne radi
        // ništa (otkriveno pri izradi vaučera, M5 §6). Panel ih ima, sajt nije.
        'warn-bg': 'var(--warn-bg)',
        'ok-bg': 'var(--ok-bg)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'ui-sans-serif', 'system-ui', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
