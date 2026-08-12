import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api-client';
import type { PublicProduct } from '@/lib/types';

// M8 spec poglavlje 2 — "/" čita M2 /products?featured=true. M2 nema koncept
// "featured" (proverено pri implementaciji) — dok se ta dopuna ne doda specifikaciji,
// prikazuju se najnovije objavljene ponude (isti podaci, drugačiji redosled).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  const products = await apiFetch<PublicProduct[]>(
    `/catalog/public/products?channel=B2C_SITE&lang=${locale}`,
    { auth: false },
  ).catch(() => []);

  return (
    <div>
      <section className="rounded-lg bg-brand-light px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-brand-dark sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-gray-600">{t('subtitle')}</p>
        <Link
          href={`/${locale}/pretraga`}
          className="mt-6 inline-block rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
        >
          {t('cta')}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">{t('featured')}</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 9).map((product) => (
            <ProductCard key={product.id} locale={locale} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductCard({ locale, product }: { locale: string; product: PublicProduct }) {
  const slug = product.translation?.slug ?? product.id;
  const typeSegment = product.type.toLowerCase();
  return (
    <Link
      href={`/${locale}/${typeSegment}/${slug}`}
      className="block rounded-lg border border-gray-200 p-4 transition hover:shadow-md"
    >
      <h3 className="font-medium text-gray-900">{product.translation?.name ?? product.id}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {[product.destinationCity, product.destinationCountry].filter(Boolean).join(', ')}
      </p>
    </Link>
  );
}
