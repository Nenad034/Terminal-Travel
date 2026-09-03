'use client';

import Icon from '@/components/Icon';
import QuoteButton from './QuoteButton';
import ProductPreviewButton from './ProductPreviewButton';
import SearchResultsMap from '@/components/SearchResultsMap';
import { useSearchFilters } from '@/components/SearchFiltersContext';
import { amenitiesMatch, commonFiltersFrom, offerMatches } from '@/lib/search-filters';
import { offerKey } from '@/lib/search-offer-key';
import { compareName } from '@/lib/search-sort';
import type { SearchResult } from './types';

// PRAVI REZULTATI `GET /search` (M5 spec §11) — kartice, redovi i mapa.
//
// Zašto je ovo klijentska komponenta, a ne deo `page.tsx` kao do 3.9.2026: filtriranje je
// vlasnikovom odlukom postalo TRENUTNO (klik na tag deluje odmah, `SearchFiltersContext.tsx`),
// a stranica je server komponenta — ona bi za svaki filter morala u nov `GET /search`. Filtriranje
// i sortiranje su zato preseljeni ovamo, nad rezultatima koje je server već vratio.
//
// Sortiranje ide zajedno sa filtriranjem, ne odvojeno: redosled zavisi od NAJJEFTINIJE ponude
// proizvoda, a koja je to ponuda zavisi od toga šta je filter propustio. Da je sortiranje ostalo
// na serveru, prvi rezultat bi posle svakog filtriranja mogao da bude pogrešan.

interface QuoteDefaults {
  stayFrom?: string;
  stayTo?: string;
  adults: number;
  children: number;
}

/** Vrste koje se prikazuju kao kartica sa slikom (dizajn dok. §6d); ostale idu kao red. */
const CARD_TYPES = new Set(['ACCOMMODATION', 'PACKAGE', 'EXCURSION', 'EVENT', 'TICKET']);

export default function RealResults({
  results,
  quoteDefaults,
  sort,
  resultsView,
  emptyMessage,
}: {
  results: SearchResult[];
  quoteDefaults: QuoteDefaults;
  /** M5 spec §3.0g.8 — redosled iz `SortBar.tsx` (ostaje u adresi, nije filter). */
  sort: string;
  /** M5 spec §3.0h — 'lista' ili 'mapa'. */
  resultsView: 'lista' | 'mapa';
  /** M5 spec §3.0g.5 — izričita rečenica po vrsti proizvoda umesto prazne liste. */
  emptyMessage: string;
}) {
  const filters = useSearchFilters();
  const { priceMin, priceMax, availability, boardTypes, amenityTags } = commonFiltersFrom(filters);

  const filtered = results
    .filter((r) => amenitiesMatch(r.amenities, amenityTags))
    .map((r) => ({ ...r, offers: r.offers.filter((o) => offerMatches(o, { priceMin, priceMax, availability, boardTypes })) }))
    // §3.0b.2 — proizvod bez ijedne preostale ponude ne postoji u rezultatima.
    .filter((r) => r.offers.length > 0);

  const cheapest = (r: SearchResult) => Math.min(...r.offers.map((o) => o.finalPrice));
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'PRICE_DESC') return cheapest(b) - cheapest(a);
    if (sort === 'NAME_ASC') return compareName(a.name, b.name);
    return cheapest(a) - cheapest(b);
  });

  if (resultsView === 'mapa') {
    // Proizvod bez koordinata se preskače — ostaje u listi, samo ga nema na mapi (§3.0h).
    const points = sorted
      .filter((r) => r.geoLat != null && r.geoLng != null)
      .map((r) => ({
        id: r.productId,
        name: r.name,
        lat: r.geoLat as number,
        lng: r.geoLng as number,
        price: cheapest(r),
        currency: r.offers[0].finalPriceCurrency,
      }));
    return <SearchResultsMap points={points} />;
  }

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-dim">{emptyMessage}</p>;
  }

  const cardResults = sorted.filter((r) => CARD_TYPES.has(r.type));
  const rowResults = sorted.filter((r) => !CARD_TYPES.has(r.type));

  return (
    <>
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
    </>
  );
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
        <ProductPreviewButton productId={r.productId} name={r.name} className="text-left font-medium text-ink hover:text-accent" />
        <div className="mb-2 text-xs text-ink-faint">
          {r.destinationCity}, {r.destinationCountry} · {r.type}
        </div>
        <div className="flex flex-col gap-2">
          {r.offers.slice(0, 3).map((o, i) => (
            <div
              key={i}
              // §3.0g.3 — obeležavanje promenjenih redova posle osvežavanja radi
              // SearchRefreshNotice.tsx nad ovim atributom (isti ključ kao selekcija, §3.0e.3).
              data-offer-key={offerKey(r.productId, o.rateLineId, o.providerQuoteReference)}
              className="flex items-center justify-between rounded bg-panel2 px-2 py-1.5 text-xs"
            >
              <span className="text-ink-dim">{o.roomTypeName ?? o.roomTypeCode ?? r.type}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-ink">
                  {(o.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {o.finalPriceCurrency}
                </span>
                <QuoteButton
                  productId={r.productId}
                  productName={r.name}
                  productType={r.type}
                  sourceType={r.sourceType}
                  rateLineId={o.rateLineId}
                  providerQuoteReference={o.providerQuoteReference}
                  stayFrom={quoteDefaults.stayFrom}
                  stayTo={quoteDefaults.stayTo}
                  adults={quoteDefaults.adults}
                  children={quoteDefaults.children}
                  finalPrice={o.finalPrice}
                  finalPriceCurrency={o.finalPriceCurrency}
                  quoteExpiresAt={o.quoteExpiresAt}
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
        <ProductPreviewButton productId={r.productId} name={r.name} className="text-left font-medium text-ink hover:text-accent" />
        <div className="text-xs text-ink-faint">
          {r.destinationCity}, {r.destinationCountry} · {r.type} · {r.sourceType}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {r.offers.map((o, i) => (
          <div
            key={i}
            data-offer-key={offerKey(r.productId, o.rateLineId, o.providerQuoteReference)}
            className="flex items-center justify-between rounded bg-panel2 px-3 py-2 text-sm"
          >
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
                productName={r.name}
                productType={r.type}
                sourceType={r.sourceType}
                rateLineId={o.rateLineId}
                providerQuoteReference={o.providerQuoteReference}
                stayFrom={quoteDefaults.stayFrom}
                stayTo={quoteDefaults.stayTo}
                adults={quoteDefaults.adults}
                children={quoteDefaults.children}
                finalPrice={o.finalPrice}
                finalPriceCurrency={o.finalPriceCurrency}
                quoteExpiresAt={o.quoteExpiresAt}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
