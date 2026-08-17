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
        accent2: {
          DEFAULT: 'var(--accent2)',
          soft: 'var(--accent2-soft)',
        },
        // Šljiva — dodata 17.8.2026, uloga još nije odlučena (vidi globals.css komentar).
        plum: {
          DEFAULT: 'var(--plum)',
          soft: 'var(--plum-soft)',
          ink: 'var(--plum-ink)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
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
