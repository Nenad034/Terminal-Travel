import type { ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Route grupa (site) — Header/Footer (standardna navigacija sajta) žive OVDE, ne u
// app/[locale]/layout.tsx, jer /znanje/[shareToken] (sestrinska ruta, van ove grupe, M23 spec
// §5) namerno NE SME da nasledi nikakvu navigaciju ka ostatku sajta ("ne izlaže nikakvu
// navigaciju ka ostatku baze znanja ili sajta" — M8 spec §9 poslednja stavka). Route grupe u
// Next.js App Router-u ne dodaju URL segment, pa /[locale]/pretraga i sl. ostaju nepromenjeni.
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <Header locale={locale} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
