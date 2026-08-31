import type { Metadata } from 'next';
import './globals.css';


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
  if (stored === 'dark' || stored === 'light' || stored === 'dim') {
    document.documentElement.setAttribute('data-theme', stored);
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
