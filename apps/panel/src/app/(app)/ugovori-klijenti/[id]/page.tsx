import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import { AcceptButton, VoidButton } from './ContractActions';
import { Badge } from '@/components/ui/badge';

interface ClientContract {
  id: string;
  bookingId: string;
  contractType: string;
  status: string;
  documentUrl: string | null;
  generatedAt: string | null;
  acceptedAt: string | null;
  acceptedMethod: string | null;
  supersedesContractId: string | null;
  contentSnapshot: Record<string, unknown>;
}

// M20 spec §6 GET /client-contracts/:id — detalji, uključujući document_url i content_snapshot
// (§2.1 — snimak svih popunjenih obaveznih elemenata, drži mock document_url proverljivim).
export default async function ClientContractDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canAccept = hasPermission(me, 'M20', 'client-contract', 'ACCEPT');
  const canVoid = hasPermission(me, 'M20', 'client-contract', 'VOID');

  let contract: ClientContract | null = null;
  let error: string | null = null;
  try {
    contract = await apiFetch<ClientContract>(`/client-contracts/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Ugovor nije pronađen.' : 'Ugovor trenutno nije dostupan.';
  }

  return (
    <div className="p-6">
      <RegisterTab label={contract ? contract.contractType : params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {contract && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {contract.contractType}
            </h1>
            <StatusBadge status={contract.status} />
          </div>

          <div className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
            <p>
              Rezervacija:{' '}
              <Link href={`/rezervacije/${contract.bookingId}`} className="text-accent hover:underline">
                {contract.bookingId.slice(0, 8)}…
              </Link>
            </p>
            {contract.generatedAt && <p className="mt-1">Generisan: {new Date(contract.generatedAt).toLocaleString('sr-RS')}</p>}
            {contract.acceptedAt && (
              <p className="mt-1">
                Prihvaćen: {new Date(contract.acceptedAt).toLocaleString('sr-RS')} ({contract.acceptedMethod})
              </p>
            )}
            {contract.supersedesContractId && (
              <p className="mt-1">
                Zamenjuje raniju verziju:{' '}
                <Link href={`/ugovori-klijenti/${contract.supersedesContractId}`} className="text-accent hover:underline">
                  {contract.supersedesContractId.slice(0, 8)}…
                </Link>
              </p>
            )}
          </div>

          {contract.documentUrl ? (
            <a
              href={contract.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-block rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
            >
              prikaži dokument ugovora
            </a>
          ) : (
            <p className="mb-4 text-xs text-ink-faint">Dokument još nije generisan.</p>
          )}

          {contract.status === 'GENERATED' && (canAccept || canVoid) && (
            <div className="mb-4 flex gap-2">
              {canAccept && <AcceptButton id={contract.id} />}
              {canVoid && <VoidButton id={contract.id} />}
            </div>
          )}
          {contract.status !== 'GENERATED' && contract.status !== 'VOIDED' && canVoid && (
            <div className="mb-4">
              <VoidButton id={contract.id} />
            </div>
          )}

          <details className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
            <summary className="cursor-pointer font-medium text-ink">Sadržaj ugovora (snimak elemenata, M20 §2.3)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-faint">
              {JSON.stringify(contract.contentSnapshot, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACCEPTED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'VOIDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
