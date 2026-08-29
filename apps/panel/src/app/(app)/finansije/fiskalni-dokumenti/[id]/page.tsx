import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import { SubmitButton, StornoButton } from './FiscalDocumentActions';
import RecordPaymentForm from './RecordPaymentForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FiscalDocument {
  id: string;
  bookingId: string | null;
  documentType: string;
  status: string;
  vatCalculationBasis: string | null;
  externalReference: string | null;
  amountOriginal: number;
  currencyOriginal: string;
  amountRsd: number;
  vatAmount: number;
  buyerNameSnapshot: string;
  buyerTaxIdSnapshot: string | null;
  buyerAcceptanceStatus: string | null;
  buyerAcceptanceDeadline: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  submittedAt: string | null;
  issuedAt: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  receivedAt: string | null;
}

// M10 spec §5.1/§10 GET /fiscal-documents/:id — detalji jednog fiskalnog dokumenta, i mesto gde
// Računovođa izvršava izlazni kriterijum M17 Faze 2 ("pripremi i pošalji fiskalni dokument").
export default async function FiscalDocumentDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canSubmit = hasPermission(me, 'M10', 'fiscal-document', 'SUBMIT');
  const canViewPayments = hasPermission(me, 'M10', 'payment', 'VIEW');
  const canRecordPayment = hasPermission(me, 'M10', 'payment', 'RECORD');

  let doc: FiscalDocument | null = null;
  let error: string | null = null;
  try {
    doc = await apiFetch<FiscalDocument>(`/finance/fiscal-documents/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Fiskalni dokument nije pronađen.' : 'Fiskalni dokument trenutno nije dostupan.';
  }

  const payments =
    doc && doc.bookingId && canViewPayments
      ? await apiFetch<Payment[]>(`/finance/payments?bookingId=${doc.bookingId}`).catch(() => [])
      : [];

  return (
    <div className="p-6">
      <RegisterTab label={doc ? doc.documentType : params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {doc && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {doc.documentType}
            </h1>
            <StatusBadge status={doc.status} />
          </div>

          <div className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
            {doc.bookingId && (
              <p>
                Rezervacija:{' '}
                <Link href={`/rezervacije/${doc.bookingId}`} className="text-accent hover:underline">
                  {doc.bookingId.slice(0, 8)}…
                </Link>
              </p>
            )}
            <p className="mt-1">
              Kupac: <b className="text-ink">{doc.buyerNameSnapshot || '—'}</b> {doc.buyerTaxIdSnapshot ? `(PIB ${doc.buyerTaxIdSnapshot})` : ''}
            </p>
            <p className="mt-1">
              Iznos:{' '}
              <b className="text-ink">
                {(doc.amountOriginal / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {doc.currencyOriginal}
              </b>{' '}
              (RSD: {(doc.amountRsd / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}, PDV:{' '}
              {(doc.vatAmount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })})
            </p>
            {doc.vatCalculationBasis && <p className="mt-1">Osnovica PDV: {doc.vatCalculationBasis}</p>}
            {doc.externalReference && <p className="mt-1">Broj kod SEF/ESIR: {doc.externalReference}</p>}
            {doc.buyerAcceptanceStatus && doc.buyerAcceptanceStatus !== 'N_A' && (
              <p className="mt-1">
                Prihvatanje kupca: <StatusBadge status={doc.buyerAcceptanceStatus} />
                {doc.buyerAcceptanceDeadline && ` — rok ${new Date(doc.buyerAcceptanceDeadline).toLocaleDateString('sr-RS')}`}
              </p>
            )}
          </div>

          {doc.status === 'DRAFT' && canSubmit && (
            <div className="mb-6 rounded-lg border border-warn bg-warn-bg p-4">
              <p className="mb-2 text-xs text-warn">
                Nacrt je pripremljen ali još nije poslat — slanje je nepovratan korak i zahteva svesnu potvrdu (M10 spec §6).
              </p>
              <SubmitButton id={doc.id} />
            </div>
          )}

          {(doc.status === 'SUBMITTED' || doc.status === 'ISSUED') && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {doc.pdfUrl && (
                <Button asChild size="sm">
                  <a href={doc.pdfUrl} target="_blank" rel="noreferrer">
                    preuzmi PDF
                  </a>
                </Button>
              )}
              {canSubmit && <StornoButton id={doc.id} />}
            </div>
          )}

          {doc.bookingId && (canViewPayments || canRecordPayment) && (
            <div className="mb-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Uplate</h2>
              <div className="mb-3 overflow-hidden rounded-lg border border-border">
                {payments.length === 0 && <p className="p-3 text-center text-xs text-ink-faint">Nema evidentiranih uplata.</p>}
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-2 text-sm last:border-b-0">
                    <span className="text-ink">
                      {(p.amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {p.currency} · {p.method}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-faint">
                      {p.receivedAt && new Date(p.receivedAt).toLocaleDateString('sr-RS')}
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                ))}
              </div>
              {canRecordPayment && (
                <RecordPaymentForm bookingId={doc.bookingId} currency={doc.currencyOriginal} revalidatePath={`/finansije/fiskalni-dokumenti/${doc.id}`} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (['ISSUED', 'RECEIVED', 'PAID', 'ACCEPTED'].includes(status)) return <Badge variant="ok">{status}</Badge>;
  if (['REJECTED', 'STORNIRANO', 'FAILED', 'VOIDED', 'EXPIRED'].includes(status)) return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
