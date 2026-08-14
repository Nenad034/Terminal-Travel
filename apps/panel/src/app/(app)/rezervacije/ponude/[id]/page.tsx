import { apiFetch, ApiError } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import ConfirmQuoteForm from './ConfirmQuoteForm';

interface QuoteItem {
  id: string;
  productId: string;
  finalPrice: number;
  finalPriceCurrency: string;
}

interface Quote {
  id: string;
  status: string;
  expiresAt: string;
  isExpired?: boolean;
  items: QuoteItem[];
}

// M17 spec §4 (Faza 1), M5 §3.1 GET /quotes/:id + §4 POST /quotes/:id/confirm.
export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  let quote: Quote | null = null;
  let error: string | null = null;
  try {
    quote = await apiFetch<Quote>(`/sales/quotes/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Ponuda nije pronađena.' : 'Ponuda trenutno nije dostupna.';
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <RegisterTab label={`Ponuda ${params.id.slice(0, 8)}`} />
      <h1 className="mb-4 font-mono text-lg">
        <span className="text-accent">$</span> ponuda/{params.id.slice(0, 8)}
      </h1>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {quote && (
        <>
          <div className="mb-4 overflow-hidden rounded-lg border border-border">
            {quote.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <span className="text-ink-faint">proizvod {item.productId.slice(0, 8)}…</span>
                <span className="font-mono font-semibold text-ink">
                  {(item.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {item.finalPriceCurrency}
                </span>
              </div>
            ))}
          </div>

          {quote.status === 'DRAFT' && !quote.isExpired && (
            <div className="rounded-lg border border-border bg-panel p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Podaci putnika i potvrda</h2>
              <ConfirmQuoteForm quoteId={quote.id} itemCount={quote.items.length} />
            </div>
          )}
          {quote.isExpired && <p className="rounded bg-warn-bg p-3 text-sm text-warn">Ponuda je istekla — ponovite pretragu za novu cenu.</p>}
          {quote.status !== 'DRAFT' && <p className="text-xs text-ink-faint">Status ponude: {quote.status}</p>}
        </>
      )}
    </div>
  );
}
