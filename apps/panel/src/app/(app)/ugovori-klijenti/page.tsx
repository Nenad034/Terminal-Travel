import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';


interface ClientContract {
  id: string;
  bookingId: string;
  contractType: string;
  status: string;
  generatedAt: string | null;
  acceptedAt: string | null;
}

const STATUSES = ['', 'DRAFT', 'GENERATED', 'ACCEPTED', 'VOIDED'];

// M17 spec §4/§7 (Faza 2) — "Ugovori sa klijentima", M20 §6 GET /client-contracts
// (filtrirano po statusu — jedini filter koji API podržava jeftino).
export default async function ClientContractsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canView = hasPermission(me, 'M20', 'client-contract', 'VIEW');

  let contracts: ClientContract[] = [];
  let error: string | null = null;
  try {
    const qs = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : '';
    contracts = await apiFetch<ClientContract[]>(`/client-contracts${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u ugovore sa klijentima (M20/client-contract/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Ugovori sa klijentima" />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Ugovori sa klijentima</h1>
      </div>

      {!error && (
        <div className="mb-2 flex gap-1 text-[11px]">
          {STATUSES.map((s) => (
            <Link
              key={s || 'sve'}
              href={s ? `/ugovori-klijenti?status=${s}` : '/ugovori-klijenti'}
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
          {contracts.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema ugovora.</p>}
          {contracts.map((c) => (
            <TabLink
              key={c.id}
              href={`/ugovori-klijenti/${c.id}`}
              label={`${c.contractType} — rezervacija ${c.bookingId.slice(0, 8)}…`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {c.contractType} <span className="text-ink-faint">— rezervacija {c.bookingId.slice(0, 8)}…</span>
                </div>
                <div className="text-xs text-ink-faint">
                  {c.generatedAt ? `generisan ${new Date(c.generatedAt).toLocaleDateString('sr-RS')}` : 'nije generisan'}
                  {c.acceptedAt ? ` · prihvaćen ${new Date(c.acceptedAt).toLocaleDateString('sr-RS')}` : ''}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </TabLink>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACCEPTED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'VOIDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
