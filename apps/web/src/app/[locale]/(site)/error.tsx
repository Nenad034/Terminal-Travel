'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

// Stranica greške javnog sajta (5.9.2026, dok. 39 nalaz 2.5). Do danas `apps/web` nije imao
// nijedan `error.tsx` — greška u prikazu je gostu davala golu Next.js stranicu na engleskom.
//
// Za gosta koji je na pola rezervacije to nije samo ružno nego i uznemirujuće: ne zna da li je
// nešto naplaćeno. Zato poruka izričito kaže da ništa nije upisano — jer u ovoj tački stvarno
// nije (greška u renderu se dešava pre bilo kakvog upisa).
//
// Prevodi idu kroz `next-intl`, isto kao ostatak sajta — `NextIntlClientProvider` je u
// `[locale]/layout.tsx`, iznad ove granice, pa je dostupan i ovde. Jezici bez sopstvenog
// prevoda dobijaju engleski, ne prazan tekst.
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('errors');
  // Adresa mora da nosi jezik (6.9.2026): golo `/` je gosta sa nemačkog sajta vraćalo na
  // podrazumevani jezik — usred greške, još i promena jezika. Uhvaćeno preko ESLint pravila
  // `no-html-link-for-pages`, koje je prijavilo `<a>` umesto `<Link>`; sam prelazak na
  // `<Link>` otkrio je i ovaj drugi, stvarni propust.
  const locale = useLocale();

  useEffect(() => {
    console.error('[web] greška na stranici:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-3 text-2xl font-semibold">{t('errorTitle')}</h1>
      <p className="mb-6 text-ink-faint">{t('errorBody')}</p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={retry}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t('retry')}
        </button>
        <Link href={`/${locale}`} className="rounded border border-border px-4 py-2 text-sm hover:bg-panel2">
          {t('home')}
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-ink-faint">
          {t('reference')}: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
