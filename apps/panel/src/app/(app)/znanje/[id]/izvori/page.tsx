import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ArticleTabs from '../ArticleTabs';
import SourceActions from './SourceActions';
import ProposeSourceForm from './ProposeSourceForm';
import { Badge } from '@/components/ui/badge';


interface ArticleSource {
  id: string;
  url: string;
  sourceType: 'HOTEL_OFFICIAL_WEBSITE' | 'HOTEL_SOCIAL_MEDIA' | 'GOVERNMENT_OR_TOURISM_BOARD';
  status: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface ArticleSummary {
  id: string;
  translation: { title: string } | null;
}

// M23 spec §2.3/§4a/§4b/§8 — GET/POST /knowledge/articles/:id/sources. §4b: kad istraživanje
// nađe više od jednog validnog kandidata, svaki ulazi kao CANDIDATE — nijedan se ne koristi dok
// čovek eksplicitno ne odobri (revizija se ne može odobriti sa referencom na neAPPROVED izvor,
// sprovedeno na backend-u, ova strana samo prikazuje status).
export default async function IzvoriPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canPropose = hasPermission(me, 'M23', 'article', 'EDIT');
  const canApprove = hasPermission(me, 'M23', 'article-source', 'APPROVE');

  let article: ArticleSummary;
  let sources: ArticleSource[] = [];
  try {
    article = await apiFetch<ArticleSummary>(`/knowledge/articles/${params.id}`);
    sources = await apiFetch<ArticleSource[]>(`/knowledge/articles/${params.id}/sources`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="p-6">
      <RegisterTab label={`Izvori — ${article.translation?.title ?? params.id.slice(0, 8)}`} />
      <Link href={`/znanje/${params.id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na članak
      </Link>

      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> znanje/clanci/{params.id.slice(0, 8)}/izvori
      </h1>
      <p className="mb-4 text-xs text-ink-dim">
        Kandidati izvora (§2.3/§4a) — samo zvaničan sajt/društvena mreža hotela ili državni/turistički portal. Nijedan se ne koristi za sadržaj dok se ne
        odobri (§4b).
      </p>

      <ArticleTabs id={params.id} active="izvori" />

      <div className="mb-4 flex flex-col gap-2">
        {sources.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema predloženih izvora.</p>}
        {sources.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-panel p-3 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-ink">{s.url}</span>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">
                {s.sourceType} · dodato {new Date(s.createdAt).toLocaleString('sr-RS')}
                {s.approvedBy && ` · odobrio ${s.approvedBy} (${s.approvedAt ? new Date(s.approvedAt).toLocaleString('sr-RS') : ''})`}
              </div>
            </div>
            {canApprove && s.status === 'CANDIDATE' && <SourceActions articleId={params.id} sourceId={s.id} />}
          </div>
        ))}
      </div>

      {canPropose && <ProposeSourceForm articleId={params.id} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
