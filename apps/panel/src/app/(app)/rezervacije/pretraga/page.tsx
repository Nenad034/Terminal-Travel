import { apiFetch, ApiError } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import SearchPanel from '@/components/SearchPanel';
import SearchRefreshNotice from '@/components/SearchRefreshNotice';
import { findIconByTypes } from '@/lib/search-product-types';
import { offerKey } from '@/lib/search-offer-key';
import SortBar from '@/components/SortBar';
import SearchQuickFilters from '@/components/SearchQuickFilters';
import { resolveSort } from '@/lib/search-sort';
import { parseRooms, roomsFromTotals, toOccupancy } from '@/lib/search-rooms';
import AccommodationResultsMock from './AccommodationResultsMock';
import FlightResultsMock from './FlightResultsMock';
import TransferResultsMock from './TransferResultsMock';
import ExcursionResultsMock from './ExcursionResultsMock';
import RealResults from './RealResults';
import type { SearchResult } from './types';


function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function normalizeTypes(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// M17 spec §4 (Faza 1) — "Pretraga i rezervacije", M5 §11 GET /search + §3.1 POST /quotes.
export default async function SearchPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const types = normalizeTypes(searchParams.type);
  // M5 spec §3.0g.8 — redosled prikaza. Mora stajati OVDE, uz `types`, jer se koristi već pri
  // sortiranju pravih rezultata niže (JavaScript `const` se ne može čitati pre svoje linije —
  // ranija verzija ga je deklarisala ispod i rušila ekran čim rezultata ima više od jednog).
  // `resolveSort` odbacuje vrednost koja ne postoji za aktivnu vrstu proizvoda (npr. "najkraće"
  // kod smeštaja) i vraća podrazumevanu, umesto da prikaz ostane u stanju koje nijedno dugme ne
  // pokazuje kao aktivno.
  const sort = resolveSort(first(searchParams.sort), types);
  // Pretraga postoji tek kad je STVARNO poslata (ispravka 3.9.2026, na zahtev vlasnika: „kada
  // se klikne na pretragu smeštaja ne treba odmah da se pojavi rezultat pretrage jer pretrage
  // još nije bilo"). Ranije je i sam izbor vrste proizvoda (`type=ACCOMMODATION`, klik na
  // ikonicu) računat kao pretraga, pa su se rezultati pojavljivali pre nego što je korisnik
  // uneo i jedan kriterijum — i uz to se svaki klik na ikonicu plaćao jednim `GET /search` nad
  // celim katalogom.
  //
  // `destinationCountry` je merilo jer je to JEDINO obavezno polje forme (§3.0c.2, označeno
  // zvezdicom u `SearchCriteriaForm`) — nijedna poslata pretraga ne može biti bez njega, a
  // nijedan puki izbor vrste ga ne postavlja. Zapamćeni kriterijumi po vrsti (§3.0g.4) ga vrate
  // pri povratku na već pretraženu vrstu, pa se rezultati tada s pravom pojave odmah.
  const hasQuery = Boolean(searchParams.destinationCountry);

  let results: SearchResult[] = [];
  let error: string | null = null;

  if (hasQuery) {
    const params = new URLSearchParams();
    // M5 spec §11 — `type` je niz (multi-select, dopuna avgust 2026), koristi ga "Things to
    // do" ikonica u levom panelu (EXCURSION+EVENT+TICKET spojeno u jedan poziv, dizajn dok.
    // §5b tabela) — bez ovoga bi trebalo tri odvojena poziva ili post-filter na klijentu.
    for (const t of types) params.append('type', t);
    if (searchParams.destinationCountry) params.set('destinationCountry', String(searchParams.destinationCountry));
    // M5 spec §3.0h.8 — okvir mape kao filter, kad je "pretraži dok pomeram mapu" uključeno.
    const bbox = first(searchParams.bbox);
    if (bbox) params.set('bbox', bbox);
    const destinationCity = first(searchParams.destinationCity);
    const stayFrom = first(searchParams.stayFrom);
    const stayTo = first(searchParams.stayTo);
    if (destinationCity) params.set('destinationCity', destinationCity);
    if (stayFrom) params.set('stayFrom', stayFrom);
    if (stayTo) params.set('stayTo', stayTo);
    // M5 spec §3.2a — popuna ide po sobama, sa uzrastom svakog deteta. Do 3.9.2026 je ovde
    // stajala jedna izmišljena soba sa praznim `childrenAges`, pa je cena deteta uvek išla kao
    // da uzrast nije poznat; sada dolazi iz forme (`rooms`). Pretraga bez `rooms` u adresi
    // (stariji sačuvan link) i dalje radi — pretvara se u jednu sobu iz zbirnih brojeva.
    const roomsParam = first(searchParams.rooms);
    const rooms = roomsParam
      ? parseRooms(roomsParam)
      : roomsFromTotals(first(searchParams.adults) ?? '2', first(searchParams.children) ?? '0');
    params.set('occupancy', JSON.stringify(toOccupancy(rooms)));
    params.set('channel', 'INTERNAL_PANEL');
    // M5 spec §3.0c.3 (dopuna 26.8.2026) — jedini filter iz vođene pretrage smeštaja koji ide
    // kao pravi upitni parametar (I-logika na serveru); ostali (cena/dostupnost/vrsta usluge)
    // ostaju klijentski nad već dobijenim rezultatima, isti obrazac kao ispod.
    for (const tag of normalizeTypes(searchParams.amenityTags)) params.append('amenityTags', tag);

    try {
      results = await apiFetch<SearchResult[]>(`/sales/search?${params.toString()}`);
    } catch (err) {
      error = err instanceof ApiError ? `Greška pretrage (${err.status}).` : 'Pretraga trenutno nije dostupna.';
    }
  }

  // Filteri i sortiranje NISU više ovde (3.9.2026) — od vlasnikove odluke da filter deluje
  // odmah po kliku, oboje se radi na klijentu, nad već dovučenim rezultatima (`RealResults.tsx`).
  // Ovde bi svaka promena filtera značila nov `GET /search`, jer je ovo server komponenta.
  const cabinClass = first(searchParams.cabinClass) || null;

  const quoteDefaults = {
    stayFrom: first(searchParams.stayFrom),
    stayTo: first(searchParams.stayTo),
    adults: Number(first(searchParams.adults) ?? '2'),
    children: Number(first(searchParams.children) ?? '0'),
  };

  const isThingsToDo = types.length === 3 && ['EXCURSION', 'EVENT', 'TICKET'].every((t) => types.includes(t));
  const singleType = types.length === 1 ? types[0] : null;
  // Četiri kombinacije danas idu kroz hardkodovan mock prikaz (vidi napomenu niže), ostalo kroz
  // pravi `GET /search`. Za skupljanje forme (§3.0g.2) oba se broje kao "ima rezultata".
  const usesMock = ['ACCOMMODATION', 'FLIGHT', 'TRANSFER'].includes(singleType ?? '') || isThingsToDo;
  const showsResults = hasQuery && !error && (usesMock || results.length > 0);

  const activeIcon = findIconByTypes(types);

  // M5 spec §3.0h — prikaz lista/mapa. Mapa se nudi SAMO kad stvarno ima šta da prikaže:
  // smeštaj (mock ima koordinate gradova) i pravi rezultati koji nose `geoLat`/`geoLng`.
  // Letovi i transferi nemaju jednu tačku na mapi nego rutu, pa im prekidač ni ne treba.
  const resultsView: 'lista' | 'mapa' = first(searchParams.prikaz) === 'mapa' ? 'mapa' : 'lista';

  // Mapa se nudi samo gde ima šta da prikaže: smeštaj (mock ima koordinate gradova) i pravi
  // rezultati sa koordinatama. Sam spisak tačaka gradi `RealResults.tsx`, POSLE filtriranja —
  // mapa i lista moraju pokazivati isto (do 3.9.2026 su tačke građene ovde, pre filtera).
  const mapAvailable = singleType === 'ACCOMMODATION' || (!usesMock && results.some((r) => r.geoLat != null && r.geoLng != null));

  // M5 spec §3.0c.3a/§3.0c.3c — brzi filteri iznad rezultata (vlasnikova odluka 3.9.2026).
  // Isto pravilo kao kod sortiranja (§3.0g.8) i mape iznad: prekidač se nudi samo tamo gde
  // podatak stvarno postoji, nikad kao siva dugmad. Letovi, transferi i "things to do" danas
  // idu kroz mock koji ni refundabilnost ni kategoriju nema, pa im se traka ni ne prikazuje.
  const refundableAvailable = usesMock
    ? singleType === 'ACCOMMODATION'
    : results.some((r) => r.offers.some((o) => o.isRefundable !== undefined));
  const starsAvailable = singleType === 'ACCOMMODATION' || (!usesMock && results.some((r) => r.stars != null));

  // M5 spec §3.0g.3 — snimak ponuda koji "Osveži podatke" poredi sa prethodnim. Gradi se samo iz
  // PRAVIH `GET /search` rezultata; mock prikazi imaju hardkodovane cene koje se između dva
  // poziva ne mogu promeniti, pa nemaju šta da prijave.
  const offerSnapshots = results.flatMap((r) =>
    r.offers.map((o) => ({
      key: offerKey(r.productId, o.rateLineId, o.providerQuoteReference),
      label: `${r.name}${o.roomTypeName ? ` · ${o.roomTypeName}` : ''}${o.boardType ? ` · ${o.boardType}` : ''}`,
      price: o.finalPrice,
      currency: o.finalPriceCurrency,
    }))
  );

  return (
    // `min-h-full` + flex kolona (dopuna 3.9.2026, na zahtev vlasnika) — prikaz mape mora da
    // popuni sve do dna centralnog panela, a ne da stane na fiksnoj visini i ostavi belu traku
    // ispod sebe. `min-h-full` (ne `h-full`) jer u prikazu LISTE sadržaj ume da bude viši od
    // panela i tada mora normalno da skroluje u `<main>`-u, koji je `overflow-y-auto`.
    <div className="flex min-h-full flex-col p-6">
      <RegisterTab label="Pretraga" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> pretraga
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Objedinjena pretraga kataloga (M2), ugovorene dostupnosti (M3) i uživo ponuda (M4).</p>

      <SearchPanel hasResults={showsResults} />

      {!usesMock && <SearchRefreshNotice offers={offerSnapshots} />}

      {showsResults && <SearchQuickFilters showRefundable={refundableAvailable} showStars={starsAvailable} />}

      {showsResults && <SortBar resultCount={usesMock ? 0 : results.length} mapAvailable={mapAvailable} />}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {/* M5 spec §3.0g.5 — vrsta proizvoda bez izvora podataka dobija IZRIČITU rečenicu, ne
          praznu listu: prazna lista uči korisnika da je aplikacija pokvarena, rečenica ga uči da
          posao tek dolazi. Poruka se pojavljuje samo kad pretraga stvarno vrati nula rezultata,
          pa ne može tiho da zastari kad izvor jednom stigne. */}
      {hasQuery && !error && !usesMock && results.length === 0 && (
        <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-dim">
          {activeIcon?.emptyMessage ?? 'Nema rezultata za zadate kriterijume.'}
        </p>
      )}

      {/* MOCK prikazi po tipu pretrage (26.8.2026 ACCOMMODATION, prošireno 29.8.2026 na zahtev
          vlasnika: "dodajte mock podatke za pretragu letova, transfera i izleta da bih video
          kako sve radi" — FLIGHT/TRANSFER/"Things to do" isti princip, svaki sa sopstvenim
          hardkodovanim oblikom dok prava M4 provajder žica ne stigne do istog nivoa detalja).
          Zamenjuje `cardResults`/`rowResults` prikaz ISKLJUČIVO za ove četiri kombinacije tipa;
          ostalih 5 vrsta (RENT-A-CAR, PACKAGE, CRUISE, INSURANCE, individualni paketi) i dalje
          idu kroz pravi `GET /search` prikaz ispod, bez mock-a. */}
      {/* Omotač raste do dna panela SAMO u prikazu mape (dopuna 3.9.2026) — u prikazu liste bi
          `flex-1` samo razvukao prazan prostor ispod poslednje kartice bez ikakve koristi. */}
      <div className={resultsView === 'mapa' && showsResults ? 'flex min-h-0 flex-1 flex-col' : undefined}>
      {(() => {
        if (!hasQuery || error) return null;

        if (singleType === 'ACCOMMODATION') {
          return (
            <AccommodationResultsMock
              stayFrom={quoteDefaults.stayFrom}
              stayTo={quoteDefaults.stayTo}
              sort={sort}
              resultsView={resultsView}
              bbox={first(searchParams.bbox) ?? null}
            />
          );
        }
        if (singleType === 'FLIGHT') {
          const tripType = first(searchParams.tripType) || 'ROUND_TRIP';
          const originCity = first(searchParams.originCity) || null;
          const returnDate = first(searchParams.returnDate) || null;
          const destinationCity = first(searchParams.destinationCity) || null;
          const flightLegsRaw = first(searchParams.flightLegs);
          let flightLegs: { originCity: string; destinationCity: string; date: string }[] | undefined;
          if (flightLegsRaw) {
            try {
              const parsed = JSON.parse(flightLegsRaw);
              if (Array.isArray(parsed)) flightLegs = parsed;
            } catch {
              flightLegs = undefined;
            }
          }
          return (
            <FlightResultsMock
              stayFrom={quoteDefaults.stayFrom}
              returnDate={returnDate}
              tripType={tripType}
              originCity={originCity}
              destinationCity={destinationCity}
              flightLegs={flightLegs}
              cabinClass={cabinClass}
              sort={sort}
            />
          );
        }
        if (singleType === 'TRANSFER') {
          return <TransferResultsMock stayFrom={quoteDefaults.stayFrom} sort={sort} />;
        }
        if (isThingsToDo) {
          return <ExcursionResultsMock stayFrom={quoteDefaults.stayFrom} sort={sort} />;
        }
        // Pravi rezultati: filtriranje, sortiranje, kartice/redovi i mapa su u `RealResults.tsx`
        // (klijentska komponenta) — filter mora da deluje odmah, a ovo je server komponenta.
        return (
          <RealResults
            results={results}
            quoteDefaults={quoteDefaults}
            sort={sort}
            resultsView={resultsView}
            emptyMessage={activeIcon?.emptyMessage ?? 'Nema rezultata za zadate kriterijume.'}
          />
        );
      })()}
      </div>
    </div>
  );
}
