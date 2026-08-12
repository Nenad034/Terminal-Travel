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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${locale}`} className="text-xl font-bold text-brand">
          Terminal Travel
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href={`/${locale}/pretraga`}>{t('search')}</Link>
          {session ? (
            <>
              <Link href={`/${locale}/nalog/moje-rezervacije`}>{t('myBookings')}</Link>
              <Link href={`/${locale}/nalog/profil`}>{t('profile')}</Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/nalog/prijava`}>{t('login')}</Link>
              <Link href={`/${locale}/nalog/registracija`}>{t('register')}</Link>
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
    <div className="flex items-center gap-1">
      {locales.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          className={l === locale ? 'font-semibold text-brand' : 'text-gray-500 hover:text-brand'}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
