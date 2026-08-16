import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';

interface ArticleRow {
  id: string;
  subjectType: 'PRODUCT' | 'DESTINATION' | 'COUNTRY';
  productId: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED';
  generatedBy: 'AI' | 'HUMAN';
  nextRefreshDueAt: string | null;
  translation: { languageCode: string; title: string; body: string } | null;
}

const SUBJECT_TYPES = ['PRODUCT', 'DESTINATION', 'COUNTRY'];
const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED'];

// M23 spec §3.1/§8 — GET /knowledge/articles. Za razliku od M21, NEMA audience segmentaciju —
// interni tim i subagenti (SUBAGENT_ADMIN) vide istu listu. Ko ima i M23/article/EDIT vidi svaki
// status; ostali samo PUBLISHED (backend odlučuje preko iste dozvole, ne query parametra).
// API ne izlaže subjectType/status kao query filtere (§8 tabela — samo `lang`) — filtriranje ide
// preko celog skupa na ovoj strani, isti obrazac kao M13 klijentsko sortiranje kad backend nema
// poseban filter endpoint.
export default async function ZnanjePage({ searchParams }: { searchParams: { subjectType?: string; status?: string } }) {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M23', 'article', 'EDIT');

  let articles: ArticleRow[] = [];
  let error: string | null = null;
  try {
    articles = await apiFetch<ArticleRow[]>('/knowledge/articles');
  } catch {
    error = 'Nemate dozvolu za uvid u bazu znanja (M23/article/VIEW).';
  }

  const filtered = articles.filter((a) => {
    if (searchParams?.subjectType && a.subjectType !== searchParams.subjectType) return false;
    if (searchParams?.status && a.status !== searchParams.status) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Znanje" />
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls znanje/clanci/
          </h1>
          <p className="text-xs text-ink-dim">
            Baza znanja o destinacijama/hotelima/izletima (M23) — ista lista za interni tim i subagente (§3.1), za razliku od M21.
          </p>
        </div>
        {canCreate && (
          <Link href="/znanje/nov" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
            <Icon name="add" /> novi članak
          </Link>
        )}
      </div>

      {!error && (
        <form className="mb-3 flex flex-wrap items-center gap-2 text-xs" action="/znanje">
          <select name="subjectType" defaultValue={searchParams?.subjectType ?? ''} className="input">
            <option value="">svi predmeti</option>
            {SUBJECT_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={searchParams?.status ?? ''} className="input">
            <option value="">svi statusi</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
            filtriraj
          </button>
          {(searchParams?.subjectType || searchParams?.status) && (
            <Link href="/znanje" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema članaka za izabrani filter.</p>}
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/znanje/${a.id}`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {a.translation?.title ?? `(bez prevoda) ${a.subjectType}`}
                  {a.generatedBy === 'AI' && <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-[10px] text-warn">AI nacrt</span>}
                </div>
                <div className="text-xs text-ink-faint">
                  {a.subjectType}
                  {a.destinationCountry ? ` · ${a.destinationCountry}${a.destinationCity ? `, ${a.destinationCity}` : ''}` : ''}
                  {a.productId ? ` · proizvod ${a.productId.slice(0, 8)}` : ''}
                  {a.translation?.languageCode ? ` · ${a.translation.languageCode}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.nextRefreshDueAt && <RefreshBadge dueAt={a.nextRefreshDueAt} />}
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'PUBLISHED' ? 'text-ok bg-ok-bg' : status === 'ARCHIVED' ? 'text-ink-faint bg-panel2' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

// §4c — vizuelni podsetnik da je rok osvežavanja dospeo (next_refresh_due_at ≤ sada); sam
// posao (KnowledgeRefreshService, dnevni cron) priprema PENDING_REVIEW placeholder reviziju,
// ova oznaka samo signalizira da vredi proveriti /revizije za taj članak.
function RefreshBadge({ dueAt }: { dueAt: string }) {
  const due = new Date(dueAt).getTime() <= Date.now();
  if (!due) return null;
  return <span className="rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-danger">osvežavanje dospelo</span>;
}
