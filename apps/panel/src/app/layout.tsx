import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Naziv "TERMINAL" (TopBar.tsx) na zahtev vlasnika (21.8.2026) dobija "font koji aludira na
// IT tehnologiju" — JetBrains Mono (programerski monospace font, OFL licenca). `next/font/google`
// preuzima font o vreme build-a i servira ga sa sopstvenog domena (self-hosted) — nema runtime
// poziv ka Google-u, isti bezbednosni/GDPR status kao ostatak steka (poglavlje 6 master dok.),
// nije nova spoljna zavisnost u smislu koji bi zahtevao `tt-tech-stack` potvrdu.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-tech', display: 'swap' });

export const metadata: Metadata = {
  title: 'Terminal — interni panel',
  description: 'M17 — interni radni panel agencije Terminal Travel.',
};

// Skripta se izvršava PRE hidratacije (blocking, u <head>) da izabere temu bez "flash of
// wrong theme": localStorage izbor > prefers-color-scheme > (ništa, CSS medijski upit
// preuzima, tamni je podrazumevan po OS podešavanju) — docs/analize/29-DIZAJN-SISTEM-UI.md §2.
const THEME_INIT_SCRIPT = `
try {
  var stored = localStorage.getItem('tt-panel-theme');
  if (stored === 'dark' || stored === 'light') {
    document.documentElement.setAttribute('data-theme', stored);
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" className={jetbrainsMono.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
