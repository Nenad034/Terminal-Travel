import type { ReactNode } from 'react';
import './globals.css';


// Next.js zahteva root layout; stvaran sadržaj (i18n provider, header/footer)
// je u app/[locale]/layout.tsx — ovaj je namerno prazan omotač.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
