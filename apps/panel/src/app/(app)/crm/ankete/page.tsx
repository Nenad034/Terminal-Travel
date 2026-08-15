import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';

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
export default async function PostTripSurveysPage({ searchParams }: { searchParams: { status?: string } }) {
  let surveys: PostTripSurvey[] = [];
  let error: string | null = null;
  try {
    const qs = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : '';
    surveys = await apiFetch<PostTripSurvey[]>(`/crm/post-trip-surveys${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u ankete posle putovanja (M6/post-trip-survey/VIEW).';
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <RegisterTab label="Ankete posle putovanja" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls crm/ankete/
        </h1>
        <p className="text-xs text-ink-dim">Anketa se automatski šalje T+2 dana posle povratka; ocena ≥ praga nudi gostu link ka Google recenziji (M6 §4.3).</p>
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
                  <Link href={`/rezervacije/${s.bookingId}`} className="hover:underline">
                    rezervacija {s.bookingId.slice(0, 8)}…
                  </Link>{' '}
                  <Link href={`/crm/${s.clientAccountId}`} className="text-accent hover:underline">
                    nalogodavac {s.clientAccountId.slice(0, 8)}…
                  </Link>
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
  const tone = status === 'COMPLETED' ? 'text-ok bg-ok-bg' : status === 'PENDING' ? 'text-ink-faint bg-panel2' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
