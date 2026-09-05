import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import RetryRegistrationButton from './RetryRegistrationButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface TravelGuarantee {
  id: string;
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  currency: string;
  validFrom: string;
  validTo: string;
  status: string;
}

interface UtilizationSnapshot {
  travelGuaranteeId: string | null;
  guaranteeStatus: string | null;
  coverageAmount: number;
  currency: string;
  utilizedAmount: number;
  utilizationPercent: number;
  warningThresholdReached: boolean;
  inGracePeriod: boolean;
}

interface Registration {
  id: string;
  bookingId: string;
  status: string;
  cisRegistrationNumber: string | null;
  failureReason: string | null;
  registeredAt: string | null;
  releaseRequestedAt: string | null;
}

// M17 spec §4/§7 (Faza 2) — "Compliance (garancija putovanja)", M11 §2/§2.2/§2.3. Izlazni
// kriterijum M17 Faza 2: "tim vidi status garancije putovanja" — čitanje, radnje ograničene
// na ono što M11 spec eksplicitno dozvoljava (§2.1 izmena je uvek ljudska, §2.3 retry).
export default async function CompliancePage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canView = hasPermission(me, 'M11', 'travel-guarantee', 'VIEW');
  const canEdit = hasPermission(me, 'M11', 'travel-guarantee', 'EDIT');
  const canViewRegistrations = hasPermission(me, 'M11', 'travel-guarantee-registration', 'VIEW');
  const canRetry = hasPermission(me, 'M11', 'travel-guarantee-registration', 'RETRY');

  let guarantee: TravelGuarantee | null = null;
  let utilization: UtilizationSnapshot | null = null;
  let registrations: Registration[] = [];
  let error: string | null = null;

  try {
    const calls: Promise<unknown>[] = [];
    if (canView) {
      calls.push(apiFetch<TravelGuarantee | null>('/compliance/travel-guarantee'));
      calls.push(apiFetch<UtilizationSnapshot>('/compliance/travel-guarantee/utilization'));
    } else {
      calls.push(Promise.resolve(null), Promise.resolve(null));
    }
    const [g, u] = await Promise.all(calls);
    guarantee = g as TravelGuarantee | null;
    utilization = u as UtilizationSnapshot | null;

    if (canViewRegistrations) {
      const qs = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : '';
      registrations = await apiFetch<Registration[]>(`/compliance/travel-guarantee-registrations${qs}`);
    }
  } catch {
    error = 'Nemate dozvolu za uvid u compliance podatke (M11/travel-guarantee/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Compliance" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Compliance</h1>
        </div>
        {canEdit && (
          <Button asChild size="sm">
            <Link href="/compliance/izmena" className="flex items-center gap-1.5">
              <Icon name="edit" /> {guarantee ? 'izmeni garanciju' : 'unesi garanciju'}
            </Link>
          </Button>
        )}
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && canView && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="law" className="text-accent" /> Trenutna garancija
            </div>
            {guarantee ? (
              <div className="text-xs text-ink-dim">
                <p>
                  {guarantee.provider} — polisa <b className="text-ink">{guarantee.policyNumber}</b>
                </p>
                <p className="mt-1">
                  Pokriće: <b className="text-ink">{(guarantee.coverageAmount / 100).toLocaleString('sr-RS')}</b> {guarantee.currency}
                </p>
                <p className="mt-1">
                  Važi: {new Date(guarantee.validFrom).toLocaleDateString('sr-RS')} – {new Date(guarantee.validTo).toLocaleDateString('sr-RS')}
                </p>
                <div className="mt-2">
                  <StatusBadge status={guarantee.status} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-danger">Nijedna garancija putovanja nije uneta u sistem.</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="pulse" className="text-accent" /> Iskorišćenost
            </div>
            {utilization && utilization.travelGuaranteeId ? (
              <div className="text-xs text-ink-dim">
                <p>
                  <b className="text-ink">{utilization.utilizationPercent.toFixed(1)}%</b> od pokrića iskorišćeno (
                  {(utilization.utilizedAmount / 100).toLocaleString('sr-RS')} / {(utilization.coverageAmount / 100).toLocaleString('sr-RS')}{' '}
                  {utilization.currency})
                </p>
                {utilization.warningThresholdReached && (
                  <p className="mt-2 rounded bg-warn-bg px-2 py-1 text-warn">Iskorišćenost je dostigla prag upozorenja (80%) — M11 spec §2.2.</p>
                )}
                {utilization.inGracePeriod && (
                  <p className="mt-2 rounded bg-danger-bg px-2 py-1 text-danger">
                    Garancija trenutno nije važeća — sistem je u periodu počeka (15 dana). Obnoviti garanciju hitno.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">Nema podataka o iskorišćenosti.</p>
            )}
          </div>
        </div>
      )}

      {!error && canViewRegistrations && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">CIS registracije po rezervaciji</h2>
            <div className="flex gap-1 text-[11px]">
              {['', 'PENDING', 'REGISTERED', 'RELEASE_PENDING', 'RELEASED', 'FAILED'].map((s) => (
                <Link
                  key={s || 'sve'}
                  href={s ? `/compliance?status=${s}` : '/compliance'}
                  className={`rounded px-2 py-1 ${(searchParams?.status ?? '') === s ? 'bg-accent text-accent-ink' : 'bg-panel2 text-ink-faint hover:text-ink'}`}
                >
                  {s || 'sve'}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {registrations.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema registracija.</p>}
            {registrations.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div>
                  <TabLink href={`/rezervacije/${r.bookingId}`} label={`rezervacija ${r.bookingId.slice(0, 8)}…`} className="font-medium text-ink hover:text-accent">
                    rezervacija {r.bookingId.slice(0, 8)}…
                  </TabLink>
                  {r.cisRegistrationNumber && <div className="text-xs text-ink-faint">CIS broj: {r.cisRegistrationNumber}</div>}
                  {r.failureReason && <div className="text-xs text-danger">{r.failureReason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {canRetry && (r.status === 'FAILED' || r.status === 'RELEASE_PENDING') && <RetryRegistrationButton id={r.id} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (['ACTIVE', 'REGISTERED', 'RELEASED'].includes(status)) return <Badge variant="ok">{status}</Badge>;
  if (['EXPIRED', 'FAILED'].includes(status)) return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
