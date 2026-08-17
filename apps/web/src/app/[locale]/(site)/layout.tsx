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
      {/* PUNA ŠIRINA (vlasnikova odluka 17.8.2026) — prikaz zauzima celu širinu ekrana, bez
          gornje granice. Ranije je ovde stajalo `max-w-6xl` (1152px), pa je na širokom monitoru
          skoro pola ekrana ostajalo prazno. Bočni prostor raste sa ekranom (px-4 → px-10) da
          tekst nikad ne dodiruje ivicu prozora — puna širina nije isto što i bez margine.

          IZUZETAK: stranice koje se ČITAJU, ne pregledaju, ograničavaju širinu SAME (ne ovde),
          jer red teksta preko celog širokog ekrana postaje nečitljiv — oko izgubi početak
          sledećeg reda. To su: pojedinačan hotel/putovanje ([tip]/[slug], izričito izuzeto na
          vlasnikov zahtev), blog i opšte stranice, tok rezervacije, prijava/registracija. */}
      <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 xl:px-10">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
