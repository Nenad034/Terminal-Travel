import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api-client';
import type { PublicProduct } from '@/lib/types';
import { slugToType } from '@/lib/categories';

// M8 spec poglavlje 2 — /[tip]/[slug]. M2 public endpoint pretražuje samo po :id, nema
// slug lookup (dopuna po potrebi, zavedeno u backlogu) — ova stranica zato učita ceo
// javni katalog za jezik i pronađe proizvod po ProductTranslation.slug, tehnika manje
// efikasna od direktnog upita, ali tačna dok se ne doda pravi slug endpoint.
export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; tip: string; slug: string }>;
}) {
  const { locale, tip, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'product' });

  const products = await apiFetch<PublicProduct[]>(
    `/catalog/public/products?channel=B2C_SITE&lang=${locale}`,
    { auth: false },
  ).catch(() => []);
  const product = products.find((p) => p.translation?.slug === slug);
  if (!product || slugToType(tip) !== product.type) notFound();

  const jsonLd = buildJsonLd(product, locale);

  return (
    /* IZUZETAK od pune širine (vlasnikova odluka 17.8.2026) — stranica pojedinačnog hotela/
       putovanja ostaje ograničene širine i centrirana. Ovo je stranica koja se čita: opis
       objekta razvučen preko celog širokog ekrana daje redove od 200+ znakova, gde oko gubi
       početak sledećeg reda. Liste i pretraga (koje se pregledaju, ne čitaju) idu punom širinom.
       Ograničenje stoji OVDE, a ne u (site)/layout.tsx, da izuzetak bude vidljiv na stranici
       koja ga traži, ne skriven u zajedničkom rasporedu. */
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-3">
      {/* M8 spec §5.1 — schema.org JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="lg:col-span-2">
        <div className="mb-6 flex h-64 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
          <span>{product.type}</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink">{product.translation?.name}</h1>
        <p className="mt-1 text-ink-faint">
          {[product.destinationCity, product.destinationCountry].filter(Boolean).join(', ')}
        </p>
        <p className="mt-4 whitespace-pre-line text-ink-dim">{product.translation?.description}</p>
      </div>

      <div className="h-fit rounded-lg border border-border bg-panel p-4">
        <form action={`/${locale}/rezervacija/ponuda`} method="get" className="flex flex-col gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <label className="text-sm text-ink-dim">
            {t('selectDates')}
            <input type="date" name="stayFrom" required className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-ink" />
          </label>
          <input type="date" name="stayTo" required className="w-full rounded-md border border-border bg-bg px-3 py-2 text-ink" />
          <div className="flex gap-2">
            <input type="number" name="adults" defaultValue={2} min={1} className="w-1/2 rounded-md border border-border bg-bg px-3 py-2 text-ink" />
            <input type="number" name="children" defaultValue={0} min={0} className="w-1/2 rounded-md border border-border bg-bg px-3 py-2 text-ink" />
          </div>
          <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong">
            {t('book')}
          </button>
        </form>
      </div>
    </div>
  );
}

function buildJsonLd(product: PublicProduct, locale: string) {
  const base = {
    '@context': 'https://schema.org',
    name: product.translation?.name,
    description: product.translation?.description,
    inLanguage: locale,
  };
  if (product.type === 'ACCOMMODATION') {
    return { ...base, '@type': 'Hotel', address: { '@type': 'PostalAddress', addressLocality: product.destinationCity, addressCountry: product.destinationCountry } };
  }
  if (product.type === 'PACKAGE') {
    return { ...base, '@type': 'TouristTrip' };
  }
  return { ...base, '@type': 'Product' };
}
