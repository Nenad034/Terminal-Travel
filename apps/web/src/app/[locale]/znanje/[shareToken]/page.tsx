import { getTranslations } from 'next-intl/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { PublicArticle } from '@/lib/types';


// M8 spec poglavlje 2/9, M23 spec §5 — jedan javno dostupan članak baze znanja, bez naloga,
// bez ikakve navigacije ka ostatku baze znanja ili sajta (dostupan isključivo direktnim
// linkom). Namerno IZVAN app/[locale]/(site)/ route grupe (koja nosi Header/Footer) — vidi
// app/[locale]/(site)/layout.tsx za obrazloženje. `GET /knowledge/public/:shareToken` je javan,
// neautentifikovan endpoint (M23 spec §5/§8, PublicKnowledgeController) — poziva se
// server-to-server odavde (M8 spec §1 BFF pravilo), `auth: false` jer ne treba nikakva sesija.
export default async function KnowledgeSharePage({
  params,
}: {
  params: Promise<{ locale: string; shareToken: string }>;
}) {
  const { locale, shareToken } = await params;
  const t = await getTranslations({ locale, namespace: 'knowledge' });

  const article = await apiFetch<PublicArticle>(
    `/knowledge/public/${encodeURIComponent(shareToken)}?lang=${locale}`,
    { auth: false },
  ).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });

  if (!article?.translation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center text-ink">
        <h1 className="text-xl font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-2 text-ink-faint">{t('notFoundBody')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-12 text-ink">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink">{article.translation.title}</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {[article.destinationCity, article.destinationCountry].filter(Boolean).join(', ')}
        </p>
        <div className="mt-6 whitespace-pre-line text-ink-dim">{article.translation.body}</div>
      </article>
    </div>
  );
}
