import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';


interface Contract {
  id: string;
  supplierId: string;
  contractNumber: string;
  currency: string;
  status: string;
  validFrom: string;
  validTo: string;
}

interface Supplier {
  id: string;
  name: string;
}

// M17 spec §4/§7 (Faza 1) — "Dobavljači i ugovori", M3 §6 ugovori.
export default async function ContractsPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M3', 'contract', 'CREATE');

  let contracts: Contract[] = [];
  let suppliersById = new Map<string, string>();
  let error: string | null = null;
  try {
    const [contractsRes, suppliersRes] = await Promise.all([
      apiFetch<Contract[]>('/contracting/contracts'),
      apiFetch<Supplier[]>('/contracting/suppliers'),
    ]);
    contracts = contractsRes;
    suppliersById = new Map(suppliersRes.map((s) => [s.id, s.name]));
  } catch {
    error = 'Nemate dozvolu za uvid u ugovore (M3/contract/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Ugovori" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Ugovori</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dobavljaci" className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
            <Icon name="organization" /> dobavljači
          </Link>
          {canCreate && (
            <Link href="/ugovori/novi" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              <Icon name="add" /> nov ugovor
            </Link>
          )}
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {contracts.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema ugovora.</p>}
          {contracts.map((c) => (
            // `id` (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka stavkama na koje
            // obavestava") — dashboard upozorenje ("M3 — rokovi povrata alotmana") i dalje može
            // da skoči na ovaj anchor (`/ugovori#contract-{id}`); klik na red sada dodatno vodi
            // na pravi detalj-ekran ugovora (dopunjeno 29.8.2026, vidi [id]/page.tsx).
            <Link
              key={c.id}
              id={`contract-${c.id}`}
              href={`/ugovori/${c.id}`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {c.contractNumber} <span className="text-ink-faint">— {suppliersById.get(c.supplierId) ?? c.supplierId}</span>
                </div>
                <div className="text-xs text-ink-faint">
                  {c.currency} · {new Date(c.validFrom).toLocaleDateString('sr-RS')} – {new Date(c.validTo).toLocaleDateString('sr-RS')}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'ACTIVE' ? 'ok' : status === 'EXPIRED' || status === 'TERMINATED' ? 'danger' : 'secondary'}>{status}</Badge>;
}
