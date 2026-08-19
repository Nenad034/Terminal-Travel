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
  thumbnail?: { url: string; category: string } | null;
  offers: SearchOffer[];
}

// Dizajn dok. §6d — tipovi sa bogatim vizuelnim sadržajem dobijaju kartice, ostatak
// kompaktne redove (kompanija/vozilo, vreme, cena, isti utisak kao Google Flights lista).
const CARD_TYPES = new Set(['ACCOMMODATION', 'PACKAGE', 'EXCURSION', 'EVENT', 'TICKET']);

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function normalizeTypes(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// M17 spec §4 (Faza 1) — "Pretraga i rezervacije", M5 §11 GET /search + §3.1 POST /quotes.
export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const types = normalizeTypes(searchParams.type);
  const hasQuery = Boolean(searchParams.destinationCountry || types.length > 0);

  let results: SearchResult[] = [];
  let error: string | null = null;

  if (hasQuery) {
    const params = new URLSearchParams();
    // M5 spec §11 — `type` je niz (multi-select, dopuna avgust 2026), koristi ga "Things to
    // do" ikonica u levom panelu (EXCURSION+EVENT+TICKET spojeno u jedan poziv, dizajn dok.
    // §5b tabela) — bez ovoga bi trebalo tri odvojena poziva ili post-filter na klijentu.
    for (const t of types) params.append('type', t);
    if (searchParams.destinationCountry) params.set('destinationCountry', String(searchParams.destinationCountry));
    const destinationCity = first(searchParams.destinationCity);
    const stayFrom = first(searchParams.stayFrom);
    const stayTo = first(searchParams.stayTo);
    if (destinationCity) params.set('destinationCity', destinationCity);
    if (stayFrom) params.set('stayFrom', stayFrom);
    if (stayTo) params.set('stayTo', stayTo);
    const adults = Number(first(searchParams.adults) ?? '2');
    const children = Number(first(searchParams.children) ?? '0');
    params.set('occupancy', JSON.stringify({ adults, children, roomConfig: [{ adults, children, childrenAges: [] }] }));
    params.set('channel', 'INTERNAL_PANEL');

    try {
      results = await apiFetch<SearchResult[]>(`/sales/search?${params.toString()}`);
    } catch (err) {
      error = err instanceof ApiError ? `Greška pretrage (${err.status}).` : 'Pretraga trenutno nije dostupna.';
    }
  }

  // Filteri (Sidebar, SearchSidebarPanel.tsx) — GET /search ne podržava cenu/dostupnost kao
  // upitne parametre (M5 spec §11), pa se primenjuju ovde, nad već dobijenim rezultatima.
  const priceMinRaw = first(searchParams.priceMin);
  const priceMaxRaw = first(searchParams.priceMax);
  const priceMin = priceMinRaw ? Number(priceMinRaw) * 100 : null;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) * 100 : null;
  const availability = first(searchParams.availability) || null;

  if (priceMin !== null || priceMax !== null || availability) {
    results = results
      .map((r) => ({
        ...r,
        offers: r.offers.filter((o) => {
          if (priceMin !== null && o.finalPrice < priceMin) return false;
          if (priceMax !== null && o.finalPrice > priceMax) return false;
          if (availability && o.availabilityStatus !== availability) return false;
          return true;
        }),
      }))
      .filter((r) => r.offers.length > 0);
  }

  const cardResults = results.filter((r) => CARD_TYPES.has(r.type));
  const rowResults = results.filter((r) => !CARD_TYPES.has(r.type));

  const quoteDefaults = {
    stayFrom: first(searchParams.stayFrom),
    stayTo: first(searchParams.stayTo),
    adults: Number(first(searchParams.adults) ?? '2'),
    children: Number(first(searchParams.children) ?? '0'),
  };

  return (
    <div className="p-6">
      <RegisterTab label="Pretraga" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> pretraga
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Objedinjena pretraga kataloga (M2), ugovorene dostupnosti (M3) i uživo ponuda (M4).</p>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {hasQuery && !error && results.length === 0 && <p className="text-center text-xs text-ink-faint">Nema rezultata za zadate kriterijume.</p>}
      {!hasQuery && <p className="text-center text-xs text-ink-faint">Podesite kriterijume u levom panelu.</p>}

      {cardResults.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cardResults.map((r) => (
            <ResultCard key={r.productId} result={r} quoteDefaults={quoteDefaults} />
          ))}
        </div>
      )}

      {rowResults.length > 0 && (
        <div className="flex flex-col gap-3">
          {rowResults.map((r) => (
            <ResultRowGroup key={r.productId} result={r} quoteDefaults={quoteDefaults} />
          ))}
        </div>
      )}
    </div>
  );
}

interface QuoteDefaults {
  stayFrom?: string;
  stayTo?: string;
  adults: number;
  children: number;
}

function ResultCard({ result: r, quoteDefaults }: { result: SearchResult; quoteDefaults: QuoteDefaults }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <div className="flex aspect-[16/10] items-center justify-center bg-panel-2 text-ink-faint">
        {r.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumbnail.url} alt={r.name} className="h-full w-full object-cover" />
        ) : (
          <Icon name="device-camera" className="text-2xl" />
        )}
      </div>
      <div className="p-3">
        <div className="font-medium text-ink">{r.name}</div>
        <div className="mb-2 text-xs text-ink-faint">
          {r.destinationCity}, {r.destinationCountry} · {r.type}
        </div>
        <div className="flex flex-col gap-2">
          {r.offers.slice(0, 3).map((o, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-panel2 px-2 py-1.5 text-xs">
              <span className="text-ink-dim">{o.roomTypeName ?? o.roomTypeCode ?? r.type}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-ink">
                  {(o.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {o.finalPriceCurrency}
                </span>
                <QuoteButton
                  productId={r.productId}
                  rateLineId={o.rateLineId}
                  providerQuoteReference={o.providerQuoteReference}
                  stayFrom={quoteDefaults.stayFrom}
                  stayTo={quoteDefaults.stayTo}
                  adults={quoteDefaults.adults}
                  children={quoteDefaults.children}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultRowGroup({ result: r, quoteDefaults }: { result: SearchResult; quoteDefaults: QuoteDefaults }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
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
                stayFrom={quoteDefaults.stayFrom}
                stayTo={quoteDefaults.stayTo}
                adults={quoteDefaults.adults}
                children={quoteDefaults.children}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
