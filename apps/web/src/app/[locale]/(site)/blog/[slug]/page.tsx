import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { PublicContent } from '@/lib/types';


// M8 spec poglavlje 2/6 — blog članak, čita objavljen sadržaj iz M12 preko javnog,
// negardovanog endpoint-a (M12 spec §7, PublicContentController).
async function fetchContent(locale: string, slug: string): Promise<PublicContent | null> {
  return apiFetch<PublicContent>(
    `/marketing/public/content?type=BLOG_POST&slug=${encodeURIComponent(slug)}&lang=${locale}`,
    { auth: false },
  ).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

// M8 spec §5.1 — SEOMeta, dopuna avgust 2026.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = await fetchContent(locale, slug);
  if (!content?.translation) return {};
  return {
    title: `${content.translation.title} — Terminal Travel Blog`,
    description: content.translation.body?.slice(0, 160),
    openGraph: { title: content.translation.title, type: 'article' },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const content = await fetchContent(locale, slug);
  if (!content?.translation) notFound();

  // M8 spec §5.1 — BreadcrumbLD ("sve stranice osim /").
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `/${locale}/blog` },
      { '@type': 'ListItem', position: 2, name: content.translation.title },
    ],
  };

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mb-6 text-2xl font-semibold text-ink">{content.translation.title}</h1>
      <p className="whitespace-pre-line text-ink-dim">{content.translation.body}</p>
    </article>
  );
}
