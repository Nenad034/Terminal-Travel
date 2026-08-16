import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ArticleTabs from '../ArticleTabs';
import RevisionActions from './RevisionActions';

interface ProposedTranslation {
  languageCode: string;
  title: string;
  body: string;
  translationSource: 'MANUAL' | 'AI_GENERATED';
}

interface ArticleRevision {
  id: string;
  trigger: 'INITIAL_CREATION' | 'SCHEDULED_REFRESH' | 'QUESTION_GAP';
  proposedTranslations: ProposedTranslation[];
  sourceIds: string[];
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ArticleSource {
  id: string;
  url: string;
  status: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
}

interface ArticleSummary {
  id: string;
  translation: { title: string } | null;
}

// M23 spec §2.4/§4c/§9 — GET/POST(approve|reject) /knowledge/articles/:id/revisions. §9 izlazni
// kriterijum: revizija se NE MOŽE odobriti dok bar jedan referenciran ArticleSource nije APPROVED
// — backend to sprovodi (400), ova strana unapred izračunava i prikazuje status izvora da tim
// razume UNAPRED zašto bi odobrenje moglo biti odbijeno, ne tek posle neuspelog pokušaja.
export default async function RevizijePage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canApprove = hasPermission(me, 'M23', 'article-revision', 'APPROVE');

  let article: ArticleSummary;
  let revisions: ArticleRevision[] = [];
  let sources: ArticleSource[] = [];
  try {
    article = await apiFetch<ArticleSummary>(`/knowledge/articles/${params.id}`);
    revisions = await apiFetch<ArticleRevision[]>(`/knowledge/articles/${params.id}/revisions`);
    sources = await apiFetch<ArticleSource[]>(`/knowledge/articles/${params.id}/sources`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label={`Revizije — ${article.translation?.title ?? params.id.slice(0, 8)}`} />
      <Link href={`/znanje/${params.id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na članak
      </Link>

      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> znanje/clanci/{params.id.slice(0, 8)}/revizije
      </h1>
      <p className="mb-4 text-xs text-ink-dim">
        Nacrti (početna izrada, 30-dnevno osvežavanje ili istraživanje pokrenuto iz neodgovorenog pitanja, §2.4). Odobrenje upisuje predloženi sadržaj kao
        stvaran prevod i pomera rok sledećeg osvežavanja; odbijanje ne menja objavljen sadržaj.
      </p>

      <ArticleTabs id={params.id} active="revizije" />

      <div className="mb-4 rounded-lg border border-border bg-panel2 p-3 text-[11px] text-ink-faint">
        <strong className="text-ink-dim">Napomena o istraživanju za postojeći članak:</strong> u v1 backend izlaže AI istraživanje (nalepljen tekst →
        strukturiran nacrt) isključivo pri kreiranju novog članka (<code>POST /knowledge/articles</code> sa <code>research{'{}'}</code>). Za ovaj postojeći
        članak nema API endpoint-a da se novo nalepljeno istraživanje pretvori u reviziju sa ovog ekrana — placeholder revizije za dospelo osvežavanje
        (<code>SCHEDULED_REFRESH</code>) priprema isključivo dnevni posao (<code>KnowledgeRefreshService</code>) sa praznim nacrtom koji čeka ručnu dopunu
        van ovog panela. Dokumentovano kao poznato ograničenje trenutnog API ugovora (M23 spec §10) — predlog: dodati{' '}
        <code>POST /knowledge/articles/:id/research</code> u sledećem potvrđenom prolazu.
      </div>

      <div className="flex flex-col gap-3">
        {revisions.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema revizija.</p>}
        {revisions.map((r) => {
          const refSources = r.sourceIds.map((id) => sourceById.get(id)).filter((s): s is ArticleSource => !!s);
          const allApproved = refSources.length === r.sourceIds.length && refSources.every((s) => s.status === 'APPROVED');
          return (
            <div key={r.id} className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TriggerBadge trigger={r.trigger} />
                  <RevisionStatusBadge status={r.status} />
                </div>
                <span className="text-[11px] text-ink-faint">{new Date(r.createdAt).toLocaleString('sr-RS')}</span>
              </div>

              {r.proposedTranslations.length === 0 ? (
                <p className="mb-2 text-xs italic text-ink-faint">
                  Prazan placeholder — čeka da neko dostavi ažuriran tekst istraživanja (§4c, nema žive pretrage u v1).
                </p>
              ) : (
                <div className="mb-2 flex flex-col gap-2">
                  {r.proposedTranslations.map((t) => (
                    <div key={t.languageCode} className="rounded border border-border bg-panel2 p-2 text-xs">
                      <div className="font-semibold text-ink">
                        {t.languageCode} · {t.title}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-ink-dim">{t.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-2 text-[11px] text-ink-faint">
                referencirani izvori ({r.sourceIds.length}):{' '}
                {refSources.length === 0 && r.sourceIds.length === 0 && <span>nema</span>}
                {refSources.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ', '}
                    <Link href={`/znanje/${params.id}/izvori`} className="text-accent hover:underline">
                      {s.url}
                    </Link>{' '}
                    <SourceMiniBadge status={s.status} />
                  </span>
                ))}
              </div>

              {r.status === 'PENDING_REVIEW' && !allApproved && r.sourceIds.length > 0 && (
                <p className="mb-2 rounded bg-warn-bg p-2 text-[11px] text-warn">
                  Nije svaki referenciran izvor APPROVED — odobrenje ove revizije će biti odbijeno dok se svi izvori ne odobre (§4b/§9, kartica &quot;izvori&quot;).
                </p>
              )}

              {r.status !== 'PENDING_REVIEW' && (
                <p className="text-[11px] text-ink-faint">
                  {r.status === 'APPROVED' ? 'odobrio' : 'odbio'} {r.reviewedBy ?? '—'} {r.reviewedAt ? `· ${new Date(r.reviewedAt).toLocaleString('sr-RS')}` : ''}
                </p>
              )}

              {canApprove && r.status === 'PENDING_REVIEW' && (
                <div className="mt-2 flex justify-end">
                  <RevisionActions articleId={params.id} revisionId={r.id} disabled={!allApproved && r.sourceIds.length > 0} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const label = trigger === 'INITIAL_CREATION' ? 'početna izrada' : trigger === 'SCHEDULED_REFRESH' ? '30-dnevno osvežavanje' : 'iz pitanja bez odgovora';
  return <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-medium text-ink-dim">{label}</span>;
}

function RevisionStatusBadge({ status }: { status: string }) {
  const tone = status === 'APPROVED' ? 'text-ok bg-ok-bg' : status === 'REJECTED' ? 'text-danger bg-danger-bg' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{status}</span>;
}

function SourceMiniBadge({ status }: { status: string }) {
  const tone = status === 'APPROVED' ? 'text-ok' : status === 'REJECTED' ? 'text-danger' : 'text-warn';
  return <span className={`text-[10px] font-medium ${tone}`}>({status})</span>;
}
