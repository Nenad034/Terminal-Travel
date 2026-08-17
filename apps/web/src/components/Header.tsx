import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { locales } from '@/i18n/config';
import OmnisearchBar from './OmnisearchBar';

// M8 spec poglavlje 3a, dopuna avgust 2026 (M15 dobio kod) — omnisearch traka je sad
// povezana na POST /api/omnisearch → M15 POST /ai-orchestration/omnisearch (channel=B2C_SITE).
// /pretraga ostaje kao zaseban link (napredna pretraga sa filterima datuma/gostiju) — omnisearch
// je brz ulaz za sve ostalo (proizvodi na prirodnom jeziku, pitanja o platformi), ne zamena.
export default async function Header({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const session = await getSession();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-panel/95 backdrop-blur">
      {/* Puna širina, isti bočni prostor kao main u (site)/layout.tsx — da logotip i navigacija
          stoje u istoj vertikali kao sadržaj ispod. Da je zaglavlje ostalo ograničeno na 1152px
          dok sadržaj ide preko celog ekrana, sadržaj bi "izlazio" ispod zaglavlja. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
        <Link href={`/${locale}`} className="text-xl font-bold tracking-tight text-accent">
          Terminal <span className="text-ink">Travel</span>
        </Link>

        <OmnisearchBar
          locale={locale}
          isLoggedIn={Boolean(session)}
          labels={{
            placeholder: t('searchPlaceholder'),
            destinations: t('search'),
            myBookings: t('myBookings'),
            help: t('helpHint'),
            helpHint: t('helpHintQuery'),
            loading: t('searchLoading'),
            noResults: t('searchNoResults'),
            aiDisclosure: t('aiDisclosure'),
          }}
        />

        <nav className="flex flex-wrap items-center gap-5 text-sm text-ink-dim">
          <Link href={`/${locale}/pretraga`} className="hover:text-accent">
            {t('search')}
          </Link>
          {session ? (
            <>
              <Link href={`/${locale}/nalog/moje-rezervacije`} className="hover:text-accent">
                {t('myBookings')}
              </Link>
              <Link href={`/${locale}/nalog/profil`} className="hover:text-accent">
                {t('profile')}
              </Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/nalog/prijava`} className="hover:text-accent">
                {t('login')}
              </Link>
              <Link
                href={`/${locale}/nalog/registracija`}
                className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink hover:bg-accent-strong"
              >
                {t('register')}
              </Link>
            </>
          )}
          <LocaleSwitcher locale={locale} />
        </nav>
      </div>
    </header>
  );
}

function LocaleSwitcher({ locale }: { locale: string }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {locales.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          className={l === locale ? 'font-semibold text-accent' : 'text-ink-faint hover:text-accent'}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
