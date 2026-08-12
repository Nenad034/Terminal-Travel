import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-gray-500">
        <span>
          © {new Date().getFullYear()} Terminal Travel — {t('rightsReserved')}
        </span>
        <Link href={`/${locale}/uslovi`}>{t('terms')}</Link>
      </div>
    </footer>
  );
}
