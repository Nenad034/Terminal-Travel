import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CATEGORY_TYPES } from '@/lib/categories';

export default async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  const tc = await getTranslations({ locale, namespace: 'categories' });

  return (
    <footer className="mt-16 border-t border-border bg-panel2">
      {/* Puna širina, isti bočni prostor kao zaglavlje i main — vidi (site)/layout.tsx */}
      <div className="grid w-full grid-cols-2 gap-6 px-4 py-10 text-sm sm:grid-cols-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="col-span-2 sm:col-span-1">
          <p className="text-lg font-bold text-accent">
            Terminal <span className="text-ink">Travel</span>
          </p>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">{t('categoriesTitle')}</p>
          <ul className="flex flex-col gap-1 text-ink-dim">
            {CATEGORY_TYPES.slice(0, 5).map((c) => (
              <li key={c.type}>
                <Link href={`/${locale}/${c.slug}`} className="hover:text-accent">
                  {tc(c.type)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">{t('infoTitle')}</p>
          <ul className="flex flex-col gap-1 text-ink-dim">
            <li>
              <Link href={`/${locale}/uslovi`} className="hover:text-accent">
                {t('terms')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} Terminal Travel — {t('rightsReserved')}
      </div>
    </footer>
  );
}
