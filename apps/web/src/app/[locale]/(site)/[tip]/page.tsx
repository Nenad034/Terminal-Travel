import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import type { PublicProduct } from '@/lib/types';
import { slugToType, typeToSlug } from '@/lib/categories';

// M8 spec poglavlje 2, dopuna avgust 2026 — "/[tip]" (kategorija): lista svih
// proizvoda tog tipa. M2 nema poseban endpoint za ovo — filtrira se na strani sajta
// nad istim javnim odgovorom koji koristi naslovna/pretraga.
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; tip: string }>;
}) {
  const { locale, tip } = await params;
  const type = slugToType(tip);
  if (!type) notFound();

  const t = await getTranslations({ locale, namespace: 'categories' });
  const products = await apiFetch<PublicProduct[]>(
    `/catalog/public/products?channel=B2C_SITE&lang=${locale}`,
    { auth: false },
  ).catch(() => []);
  const filtered = products.filter((p) => p.type === type);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-ink">{t(type)}</h1>

      {filtered.length === 0 ? (
        <p className="text-ink-faint">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((product) => (
            <Link
              key={product.id}
              href={`/${locale}/${typeToSlug(product.type)}/${product.translation?.slug ?? product.id}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
