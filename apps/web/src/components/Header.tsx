import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { locales } from '@/i18n/config';

// M8 spec poglavlje 3a — omnisearch traka je namerno IZOSTAVLJENA u ovom prolazu
// (zavisi od M15, koji još nema kod — vidi poglavlje 9a). Zamenjena je običnim
// linkom ka /pretraga dok M15 ne dobije implementaciju.
export default async function Header({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const session = await getSession();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${locale}`} className="text-xl font-bold tracking-tight text-accent">
          Terminal <span className="text-ink">Travel</span>
        </Link>

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
