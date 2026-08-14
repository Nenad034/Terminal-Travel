import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';

interface Supplier {
  id: string;
  name: string;
  type: string;
  country: string;
  contactName: string;
  contactEmail: string;
}

// M17 spec §4/§7 (Faza 1) — "Dobavljači i ugovori", jedna nav stavka koja pokriva oba M3
// resursa (§6 M3 spec). Ova stranica je lista dobavljača; ugovori žive na /ugovori.
export default async function SuppliersPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M3', 'supplier', 'CREATE');
  const canViewContracts = hasPermission(me, 'M3', 'contract', 'VIEW');

  let suppliers: Supplier[] = [];
  let error: string | null = null;
  try {
    suppliers = await apiFetch<Supplier[]>('/contracting/suppliers');
  } catch {
    error = 'Nemate dozvolu za uvid u dobavljače (M3/supplier/VIEW).';
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Dobavljači i ugovori" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls dobavljaci/
          </h1>
          <p className="text-xs text-ink-dim">Direktni ugovori sa dobavljačima, kapaciteti, cenovnici, rokovi.</p>
        </div>
        <div className="flex gap-2">
          {canViewContracts && (
            <Link href="/ugovori" className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
              <Icon name="file-text" /> ugovori
            </Link>
          )}
          {canCreate && (
            <Link href="/dobavljaci/novi" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              <Icon name="add" /> novi dobavljač
            </Link>
          )}
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {suppliers.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema dobavljača.</p>}
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
              <div>
                <div className="font-medium text-ink">{s.name}</div>
                <div className="text-xs text-ink-faint">
                  {s.type} · {s.country} · {s.contactName} ({s.contactEmail})
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
