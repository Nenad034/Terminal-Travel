import Icon from '@/components/Icon';
import RebateActions from './RebateActions';
import { Badge } from '@/components/ui/badge';

interface CommissionRebate {
  id: string;
  periodStart: string;
  periodEnd: string;
  calculatedAmount: number;
  currency: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
}

// M7 spec §3.2 — CommissionRebate lista za jedan subagent, sa eksplicitnom "odobri"/"odbij"
// radnjom samo za DRAFT stavke. APPROVED/APPLIED/REJECTED su prikazani read-only (APPROVED
// već čeka M10 slanje KNJIZNO_ODOBRENJE nacrta — vidi FiscalDocumentStubService — pa se ovde
// ne nudi nikakva dodatna radnja dok M10 ne pošalje dokument i markApplied ne stigne preko
// Event Bus-a).
export default function RebatesPanel({ subagentId, rebates, canApprove }: { subagentId: string; rebates: CommissionRebate[]; canApprove: boolean }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="diff" className="text-accent" /> Retroaktivni rabati provizije (M7 §3.2)
      </div>
      {rebates.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema rabata za ovog subagenta.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rebates.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded bg-panel2 px-3 py-2 text-xs">
              <div className="text-ink-dim">
                <p>
                  <b className="text-ink">
                    {r.calculatedAmount.toLocaleString('sr-RS')} {r.currency}
                  </b>{' '}
                  za period {new Date(r.periodStart).toLocaleDateString('sr-RS')} – {new Date(r.periodEnd).toLocaleDateString('sr-RS')}
                </p>
                <p className="mt-0.5 text-ink-faint">
                  kreiran {new Date(r.createdAt).toLocaleDateString('sr-RS')}
                  {r.approvedAt ? ` · odobren ${new Date(r.approvedAt).toLocaleDateString('sr-RS')}` : ''}
                  {r.appliedAt ? ` · primenjen (M10 knjižno odobrenje poslato) ${new Date(r.appliedAt).toLocaleDateString('sr-RS')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === 'DRAFT' && canApprove && <RebateActions subagentId={subagentId} rebateId={r.id} />}
              </div>
            </div>
          ))}
        </div>
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
