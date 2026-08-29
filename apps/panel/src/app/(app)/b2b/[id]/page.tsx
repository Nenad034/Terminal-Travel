import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ApproveSubagentForm from './ApproveSubagentForm';
import EditSubagentForm from './EditSubagentForm';
import VolumeTiersPanel from './VolumeTiersPanel';
import RebatesPanel from '../RebatesPanel';
import { Badge } from '@/components/ui/badge';

interface Subagent {
  id: string;
  clientAccountId: string;
  parentSubagentId: string | null;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
  commissionPercentage: number | null;
  creditLimit: number | null;
  creditLimitCurrency: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface ClientAccountSummary {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  companyName: string | null;
  fullName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
}

interface OutstandingBalance {
  amount: number;
  currency: string | null;
}

interface VolumeStatus {
  calculatedMetricValue: number;
  effectiveCommissionPercentage: number;
  currentTier: { id: string; thresholdValue: number; thresholdMetric: string } | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface VolumeTier {
  id: string;
  rank: number;
  thresholdMetric: string;
  thresholdPeriod: string;
  thresholdValue: number;
  resultingCommissionPercentage: number | null;
  resultingCommissionFixedAmount: number | null;
  resultingCommissionCurrency: string | null;
  retroactive: boolean;
}

interface CommissionRebate {
  id: string;
  triggeringTierId: string;
  periodStart: string;
  periodEnd: string;
  calculatedAmount: number;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 4) — detalj B2B subagenta: kreditni limit (§4), provizija/obimski status
// (§3/§3.1), mreža sub-subagenata (§6, samo uvid — upravljanje njome je posao roditeljskog
// subagenta kroz sopstveni, još negrađeni portal, M7 spec §2.0.1 /b2b/moja-mreza — van obima
// M17), rabati provizije (§3.2). Kompozicija sa M6 (naziv/kontakt naloga) — M17 spec §2.
export default async function SubagentDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M7', 'subagent', 'EDIT');
  const canApprove = hasPermission(me, 'M7', 'subagent', 'APPROVE');
  const canManageTiers = hasPermission(me, 'M7', 'subagent', 'MANAGE_OWN_NETWORK');
  const canViewRebates = hasPermission(me, 'M7', 'commission-rebate', 'VIEW');
  const canApproveRebate = hasPermission(me, 'M7', 'commission-rebate', 'APPROVE');
  const canViewAccount = hasPermission(me, 'M6', 'client-account', 'VIEW');

  let subagent: Subagent | null = null;
  let error: string | null = null;
  try {
    subagent = await apiFetch<Subagent>(`/b2b/subagents/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Subagent nije pronađen.' : 'Subagent trenutno nije dostupan.';
  }

  const [account, balance, volumeStatus, tiers, children, rebates] = await Promise.all([
    subagent && canViewAccount ? apiFetch<ClientAccountSummary>(`/crm/client-accounts/${subagent.clientAccountId}`).catch(() => null) : Promise.resolve(null),
    subagent ? apiFetch<OutstandingBalance>(`/b2b/subagents/${subagent.id}/outstanding-balance`).catch(() => null) : Promise.resolve(null),
    subagent ? apiFetch<VolumeStatus>(`/b2b/subagents/${subagent.id}/volume-status`).catch(() => null) : Promise.resolve(null),
    subagent ? apiFetch<VolumeTier[]>(`/b2b/subagents/${subagent.id}/volume-tiers`).catch(() => []) : Promise.resolve([]),
    subagent ? apiFetch<Subagent[]>(`/b2b/subagents/${subagent.id}/children`).catch(() => []) : Promise.resolve([]),
    subagent && canViewRebates ? apiFetch<CommissionRebate[]>(`/b2b/subagents/${subagent.id}/commission-rebates`).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="p-6">
      <RegisterTab label={account ? (account.companyName ?? account.fullName ?? '') : params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {subagent && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {account?.companyName ?? account?.fullName ?? subagent.clientAccountId.slice(0, 8)}
            </h1>
            <StatusBadge status={subagent.status} />
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="organization" className="text-accent" /> Nalog (M6)
              </div>
              {account ? (
                <>
                  <p>PIB: {account.taxId ?? '—'}</p>
                  <p className="mt-1">Email: {account.email ?? '—'}</p>
                  <p className="mt-1">Telefon: {account.phone ?? '—'}</p>
                  <Link href={`/crm/${account.id}`} className="mt-2 inline-block text-accent hover:underline">
                    otvori nalogodavca u CRM →
                  </Link>
                </>
              ) : (
                <p className="text-ink-faint">Nalog nije dostupan.</p>
              )}
              <p className="mt-2">Tip: {subagent.parentSubagentId ? 'Sub-subagent' : 'Tier 1 (direktan partner agencije)'}</p>
              <p className="mt-1">Registrovan: {new Date(subagent.createdAt).toLocaleDateString('sr-RS')}</p>
            </div>

            <div className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
                <Icon name="credit-card" className="text-accent" /> Kreditni limit i dug
              </div>
              <p>
                Limit: <b className="text-ink">{subagent.creditLimit != null ? subagent.creditLimit.toLocaleString('sr-RS') : '—'}</b> {subagent.creditLimitCurrency ?? ''}
              </p>
              {balance && balance.currency && (
                <p className="mt-1">
                  Trenutni dug: <b className="text-ink">{balance.amount.toLocaleString('sr-RS')}</b> {balance.currency}
                </p>
              )}
              {subagent.approvedAt && <p className="mt-1">Odobren: {new Date(subagent.approvedAt).toLocaleDateString('sr-RS')}</p>}
            </div>
          </div>

          {subagent.status === 'PENDING_APPROVAL' && canApprove && (
            <div className="mb-4 rounded-lg border border-warn bg-warn-bg p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Icon name="verified" /> Čeka odobrenje (M7 spec §9)
              </div>
              <p className="mb-2 text-xs text-ink-dim">Subagent ne može da naruči dok se ne odobri i postavi kreditni limit.</p>
              <ApproveSubagentForm id={subagent.id} isTier1={subagent.parentSubagentId === null} />
            </div>
          )}

          <div className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
              <Icon name="graph-line" className="text-accent" /> Provizija i obimski status (M7 §3/§3.1)
            </div>
            <p>
              Osnovna provizija: <b className="text-ink">{subagent.commissionPercentage != null ? `${subagent.commissionPercentage}%` : 'nije postavljena'}</b>
            </p>
            {volumeStatus && (
              <>
                <p className="mt-1">
                  Efektivna provizija (uz eventualni obimski bonus): <b className="text-ink">{volumeStatus.effectiveCommissionPercentage}%</b>
                </p>
                <p className="mt-1">
                  Tekući obim u periodu: {volumeStatus.calculatedMetricValue}
                  {volumeStatus.currentTier ? ` (dostignut prag ${volumeStatus.currentTier.thresholdValue})` : ' (nijedan prag nije dostignut)'}
                </p>
                {volumeStatus.periodStart && volumeStatus.periodEnd && (
                  <p className="mt-1 text-ink-faint">
                    Period: {new Date(volumeStatus.periodStart).toLocaleDateString('sr-RS')} – {new Date(volumeStatus.periodEnd).toLocaleDateString('sr-RS')}
                  </p>
                )}
              </>
            )}
          </div>

          {canManageTiers && subagent.parentSubagentId === null && (
            <VolumeTiersPanel subagentId={subagent.id} tiers={tiers} />
          )}

          {canEdit && (
            <details className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs">
              <summary className="cursor-pointer font-medium text-ink">Izmeni kreditni limit / status</summary>
              <div className="mt-3">
                <EditSubagentForm subagent={subagent} />
              </div>
            </details>
          )}

          <div className="mb-4 rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="type-hierarchy" className="text-accent" /> Mreža — direktni sub-subagenti (M7 §6, samo uvid)
            </div>
            <p className="mb-2 text-[11px] text-ink-faint">
              Upravljanje ovom mrežom (kreiranje, provizija) radi isključivo roditeljski subagent kroz sopstveni portal nalog — agencija ima uvid, ne intervenciju (M7 spec §3/§6).
            </p>
            {children.length === 0 ? (
              <p className="text-xs text-ink-faint">Nema sub-subagenata.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {children.map((c) => (
                  <Link key={c.id} href={`/b2b/${c.id}`} className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-ink hover:bg-panel2">
                    <span>{c.clientAccountId.slice(0, 8)}…</span>
                    <span className="text-ink-faint">
                      provizija {c.commissionPercentage != null ? `${c.commissionPercentage}%` : '—'} · kredit{' '}
                      {c.creditLimit != null ? `${c.creditLimit.toLocaleString('sr-RS')} ${c.creditLimitCurrency}` : '—'}
                    </span>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {canViewRebates && (
            <RebatesPanel subagentId={subagent.id} rebates={rebates} canApprove={canApproveRebate} />
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
