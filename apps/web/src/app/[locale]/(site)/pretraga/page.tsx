import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import type { SearchResultProduct } from '@/lib/types';
import { typeToSlug } from '@/lib/categories';


// M8 spec poglavlje 3, korak 1 — anonimna pretraga, poziva M5 GET /search (javno od
// avgust 2026 dopune — vidi M5 spec §11 changelog v1.22).
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'search' });

  const hasQuery = Boolean(sp.destination || sp.stayFrom);
  let results: SearchResultProduct[] = [];

  if (hasQuery) {
    const occupancy = JSON.stringify({
      adults: Number(sp.adults ?? 2),
      children: Number(sp.children ?? 0),
    });
    const query = new URLSearchParams({
      channel: 'B2C_SITE',
      lang: locale,
      occupancy,
      ...(sp.destination ? { destinationCity: sp.destination } : {}),
      ...(sp.stayFrom ? { stayFrom: sp.stayFrom } : {}),
      ...(sp.stayTo ? { stayTo: sp.stayTo } : {}),
    });
    results = await apiFetch<SearchResultProduct[]>(`/sales/search?${query.toString()}`, { auth: false }).catch(
      () => [],
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-ink">{t('title')}</h1>

      <form method="get" className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-border bg-panel p-4 sm:grid-cols-5">
        <Field label={t('destination')} name="destination" defaultValue={sp.destination} />
        <Field label={t('stayFrom')} name="stayFrom" type="date" defaultValue={sp.stayFrom} />
        <Field label={t('stayTo')} name="stayTo" type="date" defaultValue={sp.stayTo} />
        <Field label={t('adults')} name="adults" type="number" defaultValue={sp.adults ?? '2'} />
        <Field label={t('children')} name="children" type="number" defaultValue={sp.children ?? '0'} />
        <button type="submit" className="col-span-full rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong sm:col-span-1">
          {t('submit')}
        </button>
      </form>

      {hasQuery && results.length === 0 && <p className="text-ink-faint">{t('noResults')}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {results.map((r) => (
          <div key={r.productId} className="rounded-lg border border-border bg-panel p-4">
            <h3 className="font-medium text-ink">{r.name || r.productId}</h3>
            <p className="text-sm text-ink-faint">
              {[r.destinationCity, r.destinationCountry].filter(Boolean).join(', ')}
            </p>
            {r.offers[0] && (
              <p className="mt-2 font-semibold text-accent">
                {formatPrice(r.offers[0].finalPrice, r.offers[0].finalPriceCurrency)}
              </p>
            )}
            <Link
              href={`/${locale}/${typeToSlug(r.type)}/${r.productId}`}
              className="mt-2 inline-block text-sm font-medium text-accent underline"
            >
              {t('viewOffer')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col text-sm text-ink-dim">
      <span className="mb-1">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-border bg-bg px-3 py-2 text-ink"
      />
    </label>
  );
}

// M5 spec §2 — novac su celi brojevi (para/cents); prikaz deli sa 100.
function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('sr-RS', { style: 'currency', currency }).format(amount / 100);
}
