import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


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
export default async function ZnanjePage(
  props: { searchParams: Promise<{ subjectType?: string; status?: string }> }
) {
  const searchParams = await props.searchParams;
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
    <div className="p-6">
      <RegisterTab label="Znanje" />
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Znanje</h1>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/znanje/nov" className="flex items-center gap-1.5">
              <Icon name="add" /> novi članak
            </Link>
          </Button>
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
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            title="Filtriraj"
            className="h-9 w-9 border-transparent bg-brand p-0 text-brand-ink hover:bg-brand hover:brightness-90"
          >
            <Icon name="arrow-right" />
          </Button>
          {(searchParams?.subjectType || searchParams?.status) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/znanje">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema članaka za izabrani filter.</p>}
          {filtered.map((a) => (
            <TabLink
              key={a.id}
              href={`/znanje/${a.id}`}
              label={a.translation?.title ?? `(bez prevoda) ${a.subjectType}`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {a.translation?.title ?? `(bez prevoda) ${a.subjectType}`}
                  {a.generatedBy === 'AI' && (
                    <Badge variant="warn" className="ml-2">
                      AI nacrt
                    </Badge>
                  )}
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
            </TabLink>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PUBLISHED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'ARCHIVED') return (
    <Badge variant="secondary" className="text-ink-faint">
      {status}
    </Badge>
  );
  return <Badge variant="warn">{status}</Badge>;
}

// §4c — vizuelni podsetnik da je rok osvežavanja dospeo (next_refresh_due_at ≤ sada); sam
// posao (KnowledgeRefreshService, dnevni cron) priprema PENDING_REVIEW placeholder reviziju,
// ova oznaka samo signalizira da vredi proveriti /revizije za taj članak.
function RefreshBadge({ dueAt }: { dueAt: string }) {
  const due = new Date(dueAt).getTime() <= Date.now();
  if (!due) return null;
  return <Badge variant="danger">osvežavanje dospelo</Badge>;
}
