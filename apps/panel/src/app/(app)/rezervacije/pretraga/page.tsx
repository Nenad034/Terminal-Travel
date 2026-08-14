import { apiFetch, ApiError } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import QuoteButton from './QuoteButton';

interface SearchOffer {
  roomTypeCode?: string;
  roomTypeName?: string;
  boardType?: string;
  finalPrice: number;
  finalPriceCurrency: string;
  availabilityStatus: string;
  rateLineId?: string;
  providerQuoteReference?: string;
  quoteExpiresAt?: string;
  cancellationPolicySummary?: string;
}

interface SearchResult {
  productId: string;
  type: string;
  sourceType: string;
  name: string;
  destinationCountry: string;
  destinationCity: string;
  shortDescription?: string;
  offers: SearchOffer[];
}

const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT'];

// M17 spec §4 (Faza 1) — "Pretraga i rezervacije", M5 §11 GET /search + §3.1 POST /quotes.
export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const hasQuery = Boolean(searchParams.destinationCountry || searchParams.type);

  let results: SearchResult[] = [];
  let error: string | null = null;

  if (hasQuery) {
    const params = new URLSearchParams();
    if (searchParams.type) params.set('type', searchParams.type);
    if (searchParams.destinationCountry) params.set('destinationCountry', searchParams.destinationCountry);
    if (searchParams.destinationCity) params.set('destinationCity', searchParams.destinationCity);
    if (searchParams.stayFrom) params.set('stayFrom', searchParams.stayFrom);
    if (searchParams.stayTo) params.set('stayTo', searchParams.stayTo);
    const adults = Number(searchParams.adults ?? '2');
    const children = Number(searchParams.children ?? '0');
    params.set('occupancy', JSON.stringify({ adults, children, roomConfig: [{ adults, children, childrenAges: [] }] }));
    params.set('channel', 'INTERNAL_PANEL');

    try {
      results = await apiFetch<SearchResult[]>(`/sales/search?${params.toString()}`);
    } catch (err) {
      error = err instanceof ApiError ? `Greška pretrage (${err.status}).` : 'Pretraga trenutno nije dostupna.';
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <RegisterTab label="Pretraga" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> pretraga
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Objedinjena pretraga kataloga (M2), ugovorene dostupnosti (M3) i uživo ponuda (M4).</p>

      <form className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel p-4 sm:grid-cols-3">
        <label className="text-xs text-ink-faint">
          tip
          <select name="type" defaultValue={searchParams.type ?? ''} className="input mt-1">
            <option value="">— sve —</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-faint">
          država odredišta
          <input name="destinationCountry" defaultValue={searchParams.destinationCountry} className="input mt-1" placeholder="Grčka" />
        </label>
        <label className="text-xs text-ink-faint">
          grad odredišta
          <input name="destinationCity" defaultValue={searchParams.destinationCity} className="input mt-1" />
        </label>
        <label className="text-xs text-ink-faint">
          od
          <input type="date" name="stayFrom" defaultValue={searchParams.stayFrom} className="input mt-1" />
        </label>
        <label className="text-xs text-ink-faint">
          do
          <input type="date" name="stayTo" defaultValue={searchParams.stayTo} className="input mt-1" />
        </label>
        <label className="text-xs text-ink-faint">
          odrasli / deca
          <div className="mt-1 flex gap-1">
            <input type="number" name="adults" min={1} defaultValue={searchParams.adults ?? '2'} className="input w-1/2" />
            <input type="number" name="children" min={0} defaultValue={searchParams.children ?? '0'} className="input w-1/2" />
          </div>
        </label>
        <button type="submit" className="col-span-2 mt-1 flex items-center justify-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong sm:col-span-3">
          <Icon name="search" /> pretraži
        </button>
      </form>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {hasQuery && !error && results.length === 0 && <p className="text-center text-xs text-ink-faint">Nema rezultata za zadate kriterijume.</p>}

      <div className="flex flex-col gap-3">
        {results.map((r) => (
          <div key={r.productId} className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-2">
              <div className="font-medium text-ink">{r.name}</div>
              <div className="text-xs text-ink-faint">
                {r.destinationCity}, {r.destinationCountry} · {r.type} · {r.sourceType}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {r.offers.map((o, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-panel2 px-3 py-2 text-sm">
                  <div>
                    <div className="text-ink">
                      {o.roomTypeName ?? o.roomTypeCode} {o.boardType ? `· ${o.boardType}` : ''}
                    </div>
                    <div className="text-xs text-ink-faint">{o.cancellationPolicySummary}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {(o.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {o.finalPriceCurrency}
                    </span>
                    <QuoteButton
                      productId={r.productId}
                      rateLineId={o.rateLineId}
                      providerQuoteReference={o.providerQuoteReference}
                      stayFrom={searchParams.stayFrom}
                      stayTo={searchParams.stayTo}
                      adults={Number(searchParams.adults ?? '2')}
                      children={Number(searchParams.children ?? '0')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
