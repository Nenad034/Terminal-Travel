import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import RebateActions from '../RebateActions';
import { Badge } from '@/components/ui/badge';

interface Subagent {
  id: string;
  clientAccountId: string;
}

interface ClientAccountSummary {
  id: string;
  companyName: string | null;
  fullName: string | null;
}

interface CommissionRebate {
  id: string;
  subagentId: string;
  periodStart: string;
  periodEnd: string;
  calculatedAmount: number;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
}

const STATUSES = ['DRAFT', 'APPROVED', 'APPLIED', 'REJECTED'] as const;

// M17 spec §4/§7 (Faza 4) — pregled svih retroaktivnih rabata provizije (M7 §3.2) preko svih
// subagenata, filtriran po statusu. M7 API §11 izlaže rabate samo po subagentu
// (GET /subagents/:id/commission-rebates), bez globalne liste — ovaj ekran je tanak
// agregacioni sloj (M17 spec §2, "ako kompozicija postane složena... sopstveni BFF sloj koji i
// dalje samo poziva zvanične API-je"), ne novi M7 endpoint ni nova poslovna logika.
export default async function CommissionRebatesPage({ searchParams }: { searchParams: { status?: string } }) {
  const me = await getMe();
  const canView = hasPermission(me, 'M7', 'commission-rebate', 'VIEW');
  const canApprove = hasPermission(me, 'M7', 'commission-rebate', 'APPROVE');
  const status = searchParams?.status;

  let rebates: (CommissionRebate & { accountName: string })[] = [];
  let error: string | null = null;

  if (!canView) {
    error = 'Nemate dozvolu za uvid u rabate provizije (M7/commission-rebate/VIEW).';
  } else {
    try {
      const subagents = await apiFetch<Subagent[]>('/b2b/subagents');
      const perSubagent = await Promise.all(
        subagents.map(async (s) => {
          const list = await apiFetch<CommissionRebate[]>(`/b2b/subagents/${s.id}/commission-rebates`).catch(() => []);
          const account = await apiFetch<ClientAccountSummary>(`/crm/client-accounts/${s.clientAccountId}`).catch(() => null);
          const name = account ? account.companyName ?? account.fullName ?? s.clientAccountId.slice(0, 8) : s.clientAccountId.slice(0, 8);
          return list.map((r) => ({ ...r, accountName: name }));
        }),
      );
      rebates = perSubagent.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (status) rebates = rebates.filter((r) => r.status === status);
    } catch {
      error = 'Učitavanje rabata nije uspelo.';
    }
  }

  return (
    <div className="p-6">
      <RegisterTab label="Rabati provizije" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls b2b/rabati/
        </h1>
        <p className="text-xs text-ink-dim">
          Retroaktivni rabati provizije (M7 §3.2) preko svih subagenata — kreirani automatski kad se pređe obimski prag usred perioda,
          čekaju ljudsko odobrenje pre nego što M10 pošalje knjižno odobrenje.
        </p>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <>
          <div className="mb-3 flex gap-1 text-[11px]">
            {['', ...STATUSES].map((s) => (
              <Link
                key={s || 'sve'}
                href={s ? `/b2b/rabati?status=${s}` : '/b2b/rabati'}
                className={`rounded px-2 py-1 ${(status ?? '') === s ? 'bg-accent text-accent-ink' : 'bg-panel2 text-ink-faint hover:text-ink'}`}
              >
                {s || 'sve'}
              </Link>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {rebates.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema rabata za izabrani filter.</p>}
            {rebates.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div>
                  <TabLink href={`/b2b/${r.subagentId}`} label={r.accountName} className="font-medium text-ink hover:text-accent">
                    {r.accountName}
                  </TabLink>
                  <div className="text-xs text-ink-faint">
                    {r.calculatedAmount.toLocaleString('sr-RS')} {r.currency} · period {new Date(r.periodStart).toLocaleDateString('sr-RS')} –{' '}
                    {new Date(r.periodEnd).toLocaleDateString('sr-RS')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === 'DRAFT' && canApprove && <RebateActions subagentId={r.subagentId} rebateId={r.id} />}
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
  if (status === 'APPLIED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">{status}</Badge>;
  if (status === 'APPROVED') return (
    <Badge variant="secondary" className="text-accent">
      {status}
    </Badge>
  );
  return <Badge variant="warn">{status}</Badge>;
}
