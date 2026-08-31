import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import { Badge } from '@/components/ui/badge';
import PeriodsPanel, { type ContractPeriod } from './PeriodsPanel';


interface Contract {
  id: string;
  supplierId: string;
  contractNumber: string;
  currency: string;
  status: string;
  validFrom: string;
  validTo: string;
  cancellationTermsSummary: string;
  documentUrl: string;
  defaultTipNastupanja: string | null;
  periods: ContractPeriod[];
}

interface Supplier {
  id: string;
  name: string;
}

// M3 spec §2.2/§2.3 — nalaz iz backloga (27-BACKLOG-IDEJA-I-PREDLOZI.md, M3 sekcija,
// 28.8.2026): lista ugovora (../page.tsx) postoji, ali nema detalj-ekrana za pojedinačan
// ugovor/period. Ovaj ekran je taj detalj — periodi/cenovnici ostaju posebna podstranica
// (periods/[periodId]/page.tsx) jer je taj model (RateLine/CancellationRule/uzrasna politika)
// sam po sebi dovoljno velik da ne stane u jedan pregled bez gubitka preglednosti.
export default async function ContractDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canEdit = hasPermission(me, 'M3', 'contract-period', 'EDIT');

  const contract = await apiFetch<Contract>(`/contracting/contracts/${params.id}`);
  let supplierName = contract.supplierId;
  try {
    const supplier = await apiFetch<Supplier>(`/contracting/suppliers/${contract.supplierId}`);
    supplierName = supplier.name;
  } catch {
    // prikaz i dalje radi bez naziva dobavljača
  }

  return (
    <div className="p-6">
      <RegisterTab label={contract.contractNumber} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> {contract.contractNumber}
          </h1>
          <p className="text-xs text-ink-faint">
            {supplierName} · {contract.currency} · {new Date(contract.validFrom).toLocaleDateString('sr-RS')} – {new Date(contract.validTo).toLocaleDateString('sr-RS')}
          </p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-panel p-5 text-xs">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-ink-faint">Uslovi otkazivanja (sažetak)</dt>
            <dd className="mt-0.5 text-ink">{contract.cancellationTermsSummary}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Podrazumevani tip nastupanja</dt>
            <dd className="mt-0.5 text-ink">{contract.defaultTipNastupanja ?? '— nije postavljen (obavezno pre ACTIVE, M3 spec §2.2) —'}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Dokument ugovora</dt>
            <dd className="mt-0.5">
              <a href={contract.documentUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                otvori
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <PeriodsPanel contractId={contract.id} periods={contract.periods} canEdit={canEdit} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'ACTIVE' ? 'ok' : status === 'EXPIRED' || status === 'TERMINATED' ? 'danger' : 'secondary'}>{status}</Badge>;
}
