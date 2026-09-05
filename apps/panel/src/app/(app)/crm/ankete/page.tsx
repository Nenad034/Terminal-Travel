import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';


interface PostTripSurvey {
  id: string;
  bookingId: string;
  clientAccountId: string;
  status: 'PENDING' | 'SENT' | 'COMPLETED';
  overallRating: number | null;
  wantsGoogleReview: boolean | null;
  googleReviewClickedAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
}

const STATUSES = ['', 'PENDING', 'SENT', 'COMPLETED'];

// M6 spec §4.3, §9 — GET /post-trip-surveys, filtrirano po statusu (bookingId filter nije
// koristan na ovom pregledu, koristi se samo za /crm/[id] kompoziciju ako zatreba kasnije).
export default async function PostTripSurveysPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  let surveys: PostTripSurvey[] = [];
  let error: string | null = null;
  try {
    const qs = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : '';
    surveys = await apiFetch<PostTripSurvey[]>(`/crm/post-trip-surveys${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u ankete posle putovanja (M6/post-trip-survey/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Ankete posle putovanja" />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Ankete posle putovanja</h1>
      </div>

      {!error && (
        <div className="mb-2 flex gap-1 text-[11px]">
          {STATUSES.map((s) => (
            <Link
              key={s || 'sve'}
              href={s ? `/crm/ankete?status=${s}` : '/crm/ankete'}
              className={`rounded px-2 py-1 ${(searchParams?.status ?? '') === s ? 'bg-accent text-accent-ink' : 'bg-panel2 text-ink-faint hover:text-ink'}`}
            >
              {s || 'sve'}
            </Link>
          ))}
        </div>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {surveys.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema anketa.</p>}
          {surveys.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
              <div>
                <div className="font-medium text-ink">
                  <TabLink href={`/rezervacije/${s.bookingId}`} label={`rezervacija ${s.bookingId.slice(0, 8)}…`} className="hover:underline">
                    rezervacija {s.bookingId.slice(0, 8)}…
                  </TabLink>{' '}
                  <TabLink href={`/crm/${s.clientAccountId}`} label={`nalogodavac ${s.clientAccountId.slice(0, 8)}…`} className="text-accent hover:underline">
                    nalogodavac {s.clientAccountId.slice(0, 8)}…
                  </TabLink>
                </div>
                <div className="text-xs text-ink-faint">
                  {s.overallRating != null ? `ocena ${s.overallRating}/5` : 'nije popunjena'}
                  {s.wantsGoogleReview && ' · ponuđena Google recenzija'}
                  {s.googleReviewClickedAt && ' · kliknuo na Google link'}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'PENDING') return (
    <Badge variant="secondary" className="text-ink-faint">
      {status}
    </Badge>
  );
  return <Badge variant="warn">{status}</Badge>;
}
