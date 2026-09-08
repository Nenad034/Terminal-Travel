import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NadzorSubnav from './NadzorSubnav';
import RunWeeklyReviewButton from './RunWeeklyReviewButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/Pagination';

interface HealthSignal {
  id: string;
  sourceModule: string;
  signalType: string;
  severity: string;
  securityCategory: string | null;
  details: Record<string, unknown>;
  detectedAt: string;
  notifiedAt: string | null;
}

interface WeeklyHealthReview {
  id: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  status: string;
  generatedAt: string;
  sentAt: string | null;
}

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];
const SIGNAL_TYPES = [
  'PROVIDER_ERROR_SPIKE',
  'PAYMENT_FAILURE_SPIKE',
  'GUEST_REGISTRATION_FAILED',
  'FIELD_INCIDENT_URGENT',
  'AUTH_ANOMALY',
  'TOKEN_USAGE_ANOMALY',
  'RECONCILIATION_MISMATCH',
  'PROVIDER_DEGRADED',
  'LOW_CAPACITY_CRITICAL',
  'HELP_AGENT_ABUSE_PATTERN',
  'PAYMENT_DEADLINE_MISSED',
];

// M17 spec §4/§7 (Faza 7) — "Operativni nadzor", M18 §2.1/§4/§9. GET /ops/health-signals
// (dozvola M18/health-signal/VIEW), GET /ops/weekly-reviews (M18/weekly-review/VIEW) za
// najskoriji nedeljni pregled na vrhu ekrana — M18 spec §4 ("push" obaveštenje ide preko
// NotificationChannel, ovaj panel je "pull" prikaz istog izvora, spec §2.1 napomena).
export default async function NadzorPage(props: {
  searchParams: Promise<{ module?: string; type?: string; severity?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canViewReview = hasPermission(me, 'M18', 'weekly-review', 'VIEW');

  let signals: HealthSignal[] = [];
  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — `GET /ops/health-signals` sad vraća
  // `{ data, total, ... }` umesto golog niza, isti obrazac kao Lista rezervacija/Gosti.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    const qs = new URLSearchParams();
    if (searchParams?.module) qs.set('module', searchParams.module);
    if (searchParams?.type) qs.set('type', searchParams.type);
    if (searchParams?.severity) qs.set('severity', searchParams.severity);
    if (searchParams?.page) qs.set('page', searchParams.page);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const result = await apiFetch<{
      data: HealthSignal[];
      total: number;
      page: number;
      pageCount: number;
      limit: number;
    }>(`/ops/health-signals${suffix}`);
    signals = result.data;
    total = result.total;
    page = result.page;
    pageCount = result.pageCount;
    limit = result.limit;
  } catch {
    error = 'Nemate dozvolu za uvid u signale nadzora (M18/health-signal/VIEW).';
  }

  let latestReview: WeeklyHealthReview | null = null;
  if (canViewReview) {
    try {
      // Najskoriji pregled je uvek prvi (`orderBy periodStart desc`, `page=1`) — nema potrebe
      // da se povuku svi da bi se izdvojio jedan.
      const reviews = await apiFetch<{ data: WeeklyHealthReview[] }>('/ops/weekly-reviews?limit=1');
      latestReview = reviews.data[0] ?? null;
    } catch {
      // nema dozvolu ili nema podataka — sekcija se jednostavno ne prikazuje
    }
  }

  const sorted = [...signals].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );

  return (
    <div className="p-6">
      <RegisterTab label="Operativni nadzor" />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Operativni nadzor</h1>
      </div>

      <NadzorSubnav active="/nadzor" />

      {canViewReview && (
        <div className="mb-6 rounded-lg border border-border bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Poslednji nedeljni pregled</h2>
            <RunWeeklyReviewButton />
          </div>
          {latestReview ? (
            <div className="text-xs text-ink-dim">
              <p className="mb-1 text-[11px] text-ink-faint">
                {new Date(latestReview.periodStart).toLocaleDateString('sr-RS')} –{' '}
                {new Date(latestReview.periodEnd).toLocaleDateString('sr-RS')} ·{' '}
                {latestReview.status}
              </p>
              <p className="whitespace-pre-line text-ink">{latestReview.summary}</p>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Nijedan nedeljni pregled još nije generisan.</p>
          )}
        </div>
      )}

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/nadzor">
          <input
            name="module"
            defaultValue={searchParams?.module ?? ''}
            placeholder="modul (npr. M4)"
            className="input"
          />
          <select name="type" defaultValue={searchParams?.type ?? ''} className="input">
            <option value="">svi tipovi</option>
            {SIGNAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="severity" defaultValue={searchParams?.severity ?? ''} className="input">
            <option value="">sve ozbiljnosti</option>
            {SEVERITIES.map((s) => (
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
            <Icon name="play" />
          </Button>
          {(searchParams?.module || searchParams?.type || searchParams?.severity) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/nadzor">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {sorted.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-faint">Nema signala.</p>
          )}
          {sorted.map((s) => {
            const critical = s.severity === 'CRITICAL';
            return (
              <div
                key={s.id}
                className={`border-b border-border px-4 py-3 text-sm last:border-b-0 ${critical ? 'bg-danger-bg' : 'bg-panel'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink">
                    {s.signalType}{' '}
                    <span className="text-xs text-ink-faint">({s.sourceModule})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.securityCategory && (
                      <Badge variant="secondary" className="text-ink-faint">
                        #{s.securityCategory}
                      </Badge>
                    )}
                    <SeverityBadge severity={s.severity} />
                  </div>
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  detektovano {new Date(s.detectedAt).toLocaleString('sr-RS')}
                  {s.notifiedAt
                    ? ` · obavešteno ${new Date(s.notifiedAt).toLocaleString('sr-RS')}`
                    : ' · obaveštenje nije poslato'}
                </div>
                {s.details && Object.keys(s.details).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded bg-panel2 p-2 text-[11px] text-ink-dim">
                    {JSON.stringify(s.details, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          shown={signals.length}
          limit={limit}
          basePath="/nadzor"
          searchParams={searchParams ?? {}}
          itemLabel="signala"
        />
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'CRITICAL')
    return (
      <Badge variant="danger" className="border-danger">
        {severity}
      </Badge>
    );
  if (severity === 'WARNING') return <Badge variant="warn">{severity}</Badge>;
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {severity}
    </Badge>
  );
}
