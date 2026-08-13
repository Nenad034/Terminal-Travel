import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { PublicContent } from '@/lib/types';

// M8 spec poglavlje 2/6 — opšte stranice sajta (npr. "O nama", "Kontakt"), čitaju objavljen
// sadržaj iz M12 preko javnog, negardovanog endpoint-a (M12 spec §7, PublicContentController).
const LOCAL_BUSINESS_SLUGS = new Set(['o-nama', 'kontakt']);

export default async function StaticContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const content = await apiFetch<PublicContent>(
    `/marketing/public/content?type=STATIC_PAGE&slug=${encodeURIComponent(slug)}&lang=${locale}`,
    { auth: false },
  ).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!content?.translation) notFound();

  // M8 spec §5.1 — LocalBusinessSchemaLD je eksplicitno vezan za /o-nama i /kontakt.
  const jsonLd = LOCAL_BUSINESS_SLUGS.has(slug)
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Terminal Travel',
        description: content.translation.title,
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <h1 className="mb-6 text-2xl font-semibold text-ink">{content.translation.title}</h1>
      <p className="whitespace-pre-line text-ink-dim">{content.translation.body}</p>
    </div>
  );
}
