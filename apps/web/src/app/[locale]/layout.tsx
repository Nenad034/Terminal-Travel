import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/config';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Terminal Travel',
  description: 'Terminal Travel — pretraga i rezervacija smeštaja, aranžmana i izleta.',
};

// Namerno BEZ Header/Footer ovde (dopuna avgust 2026) — premešteno u
// app/[locale]/(site)/layout.tsx da /znanje/[shareToken] (sestrinska ruta van (site) grupe)
// ostane bez ikakve navigacije ka ostatku sajta, M23 spec §5 + M8 spec §9. Ovaj layout ostaje
// zajednički za obe grane (html/body/i18n provider), jer i deljeni članak i ostatak sajta i
// dalje treba da rade sa ispravnim jezikom/porukama (next-intl).
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-bg text-ink">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
