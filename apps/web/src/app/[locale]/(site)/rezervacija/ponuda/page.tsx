import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { apiFetch } from '@/lib/api-client';
import type { PublicProduct } from '@/lib/types';


// M8 spec poglavlje 3, korak 2 — pregled ponude PRE kreiranja M5 Quote zapisa (vidi
// napomenu u rezervacija/actions.ts o tome zašto se Quote kreira tek u koraku 4).
export default async function OfferPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'booking.offer' });

  const products = await apiFetch<PublicProduct[]>(
    `/catalog/public/products?channel=B2C_SITE&lang=${locale}`,
    { auth: false },
  ).catch(() => []);
  const product = products.find((p) => p.id === sp.productId);

  const forward = new URLSearchParams({
    productId: sp.productId ?? '',
    stayFrom: sp.stayFrom ?? '',
    stayTo: sp.stayTo ?? '',
    adults: sp.adults ?? '2',
    children: sp.children ?? '0',
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <div className="rounded-lg border border-border p-4">
        <h2 className="font-medium">{product?.translation?.name ?? sp.productId}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-ink-dim">
          <dt>{sp.stayFrom}</dt>
          <dd>→ {sp.stayTo}</dd>
          <dt>{sp.adults} + {sp.children}</dt>
        </dl>
      </div>
      <Link
        href={`/${locale}/rezervacija/podaci-gosta?${forward.toString()}`}
        className="mt-6 inline-block rounded-md bg-accent px-6 py-3 font-medium text-accent-ink hover:bg-accent-strong"
      >
        {t('confirm')}
      </Link>
    </div>
  );
}
