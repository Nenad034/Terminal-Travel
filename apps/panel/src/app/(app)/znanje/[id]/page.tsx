import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import ArticleTabs from './ArticleTabs';
import PublishButton from './PublishButton';
import StatusForm from './StatusForm';
import ShareLinkBox from './ShareLinkBox';
import TranslationsList from './TranslationsList';

interface Translation {
  languageCode: string;
  title: string;
  body: string;
  translationSource?: 'MANUAL' | 'AI_GENERATED';
}

interface ArticleDetail {
  id: string;
  subjectType: 'PRODUCT' | 'DESTINATION' | 'COUNTRY';
  productId: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED';
  generatedBy: 'AI' | 'HUMAN';
  approvedBy: string | null;
  shareToken: string | null;
  lastRefreshedAt: string | null;
  nextRefreshDueAt: string | null;
  publishedAt: string | null;
  translation: Translation | null;
  translations: Translation[];
}

// M23 spec §2.1/§3.1/§6/§8 — GET /knowledge/articles/:id. Za razliku od M21, findOne već vraća
// PUNU listu translations (ne samo jedan rešen prevod) — ArticlesService.withResolvedTranslation
// vraća i `translation` (rešen fallback za prikaz) i `translations` (svi postojeći redovi), pa
// ovde nije potreban M21-stil "pitaj po svakom jeziku" zaobilazak.
export default async function ZnanjeDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();

  let article: ArticleDetail;
  try {
    article = await apiFetch<ArticleDetail>(`/knowledge/articles/${params.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const canEdit = hasPermission(me, 'M23', 'article', 'EDIT');
  const canPublish = hasPermission(me, 'M23', 'article', 'PUBLISH');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label={article.translation?.title ?? article.subjectType} />
      <Link href="/znanje" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na listu
      </Link>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> znanje/clanci/{article.id.slice(0, 8)}
          </h1>
          <p className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
            {article.subjectType}
            {article.destinationCountry ? ` · ${article.destinationCountry}${article.destinationCity ? `, ${article.destinationCity}` : ''}` : ''}
            {article.productId ? ` · proizvod ${article.productId.slice(0, 8)}` : ''}
            {' · '}
            {/* 29-DIZAJN-SISTEM-UI.md §6a — autor nacrta; ljudsko odobrenje (approvedBy) je zasebno. */}
            {article.generatedBy === 'AI' ? (
              <ActorLabel name="AI agent" origin="AI_AGENT" />
            ) : (
              <ActorLabel name="ručni unos" origin="STAFF" />
            )}
          </p>
        </div>
        <StatusBadge status={article.status} />
      </div>

      <ArticleTabs id={article.id} active="pregled" />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel p-4 text-xs sm:grid-cols-4">
        <Info label="objavljeno" value={article.publishedAt ? new Date(article.publishedAt).toLocaleString('sr-RS') : '—'} />
        <Info label="odobrio (approved_by)" value={article.approvedBy ?? '—'} />
        <Info label="poslednje osveženo" value={article.lastRefreshedAt ? new Date(article.lastRefreshedAt).toLocaleDateString('sr-RS') : '—'} />
        <Info
          label="sledeće osvežavanje"
          value={article.nextRefreshDueAt ? new Date(article.nextRefreshDueAt).toLocaleDateString('sr-RS') : '—'}
          danger={!!article.nextRefreshDueAt && new Date(article.nextRefreshDueAt).getTime() <= Date.now()}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canPublish && article.status !== 'PUBLISHED' && <PublishButton id={article.id} />}
        {canEdit && article.status !== 'PUBLISHED' && <StatusForm id={article.id} status={article.status} />}
      </div>

      {article.status === 'PUBLISHED' && article.shareToken && (
        <div className="mb-4">
          <p className="mb-1 text-[11px] text-ink-faint">
            Javni deljeni link (M23 spec §5) — otvara samo ovaj članak, bez pretrage. Kopirajte i ručno pošaljite gostu (email/Viber/WhatsApp/Telegram/SMS).
          </p>
          <ShareLinkBox shareToken={article.shareToken} />
        </div>
      )}

      <TranslationsList translations={article.translations} />
    </div>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className={`mt-0.5 ${danger ? 'font-medium text-danger' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'PUBLISHED' ? 'text-ok bg-ok-bg' : status === 'ARCHIVED' ? 'text-ink-faint bg-panel2' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
