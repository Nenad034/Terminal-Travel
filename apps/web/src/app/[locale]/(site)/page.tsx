import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api-client';
import type { PublicProduct } from '@/lib/types';
import { CATEGORY_TYPES, typeToSlug } from '@/lib/categories';


// M8 spec poglavlje 1a — paleta "Zalazak", uobičajen izgled turističkog sajta.
// "/" čita M2 /products?featured=true — M2 nema koncept "featured" (proverено pri
// implementaciji), dok se ta dopuna ne doda specifikaciji prikazuju se najnovije
// objavljene ponude (isti podaci, drugačiji redosled).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'categories' });
  const ts = await getTranslations({ locale, namespace: 'search' });

  const products = await apiFetch<PublicProduct[]>(
    `/catalog/public/products?channel=B2C_SITE&lang=${locale}`,
    { auth: false },
  ).catch(() => []);

  return (
    <div>
      <section className="relative overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft via-panel to-plum-soft px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-ink sm:text-5xl">{t('title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-dim">{t('subtitle')}</p>

        <form
          action={`/${locale}/pretraga`}
          method="get"
          className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-lg border border-border bg-panel p-3 shadow-sm sm:flex-row"
        >
          <input
            name="destination"
            placeholder={ts('destination')}
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-ink"
          />
          <input type="date" name="stayFrom" className="rounded-md border border-border bg-bg px-3 py-2 text-ink" />
          <input type="date" name="stayTo" className="rounded-md border border-border bg-bg px-3 py-2 text-ink" />
          <button type="submit" className="rounded-md bg-accent px-6 py-2 font-medium text-accent-ink hover:bg-accent-strong">
            {t('cta')}
          </button>
        </form>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold text-ink">{t('categories')}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {CATEGORY_TYPES.map((c) => (
            <Link
              key={c.type}
              href={`/${locale}/${c.slug}`}
              className="rounded-lg border border-border bg-panel px-4 py-6 text-center font-medium text-ink transition hover:border-accent hover:text-accent"
            >
              {tc(c.type)}
            </Link>
          ))}
        </div>
      </section>

      {products.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold text-ink">{t('featured')}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.slice(0, 9).map((product) => (
              <ProductCard key={product.id} locale={locale} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductCard({ locale, product }: { locale: string; product: PublicProduct }) {
  const slug = product.translation?.slug ?? product.id;
  return (
    <Link
      href={`/${locale}/${typeToSlug(product.type)}/${slug}`}
      className="block overflow-hidden rounded-lg border border-border bg-panel transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-36 items-center justify-center bg-accent-soft text-accent-strong">
        <span className="text-sm">{product.type}</span>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-ink">{product.translation?.name ?? product.id}</h3>
        <p className="mt-1 text-sm text-ink-faint">
          {[product.destinationCity, product.destinationCountry].filter(Boolean).join(', ')}
        </p>
      </div>
    </Link>
  );
}
