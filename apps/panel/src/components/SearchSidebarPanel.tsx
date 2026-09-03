'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { airlineOptions, connectionAirportOptions } from '@/lib/mock-flights';
import { useSearchFilters } from './SearchFiltersContext';
import { ALL_FILTER_KEYS } from '@/lib/search-filters';

// M5 spec §3.0g.1 / dizajn dok. §6d.1 (vlasnikova odluka, 2.9.2026) — levi panel sadrži
// ISKLJUČIVO filtere. Ikonice devet vrsta proizvoda i sama forma pretrage su se do tada nalazile
// ovde; sad žive u centralnom panelu (SearchPanel.tsx). Razlog je vlasnikov: forma je bila jedan
// zajednički iskačući prozor sa devetak polja za svih devet vrsta, a "ovo nam je među
// najvažnijim modulima, odavde sve kreće".
//
// Filteri se menjaju prema AKTIVNOJ vrsti proizvoda (§3.0g.1 tačka 3) — broj presedanja i
// udaljenost od plaže nemaju šta jedno kraj drugog. "Refundabilno/Nerefundabilno" brzi filter iz
// §6d i dalje nije uključen — `SearchResultOffer.is_refundable` je specificiran (M5 spec v1.32)
// ali nikad implementiran na `search.service.ts` — zahteva zaseban prolaz (izračunavanje iz
// `CancellationRule` prozora za CONTRACTED, M5 spec §3.0c.3a), zabeleženo u backlogu, ne
// prećutno izostavljeno.
//
// Dopuna (26.8.2026, na zahtev vlasnika: "u levom panelu za smeštaj dodajte još filtera") —
// dva filtera iz M5 spec §3.0c.2/§3.0c.3 koja su bila specificirana ali nikad ožičena:
// "vrsta usluge" (board_type, klijentski filter nad već dobijenim rezultatima, isti princip
// kao "dostupnost" — statičan skup vrednosti, NE ograničen na ono što se stvarno pojavljuje u
// trenutnim rezultatima, isto pojednostavljenje kao postojeći "dostupnost" select) i sadržaji-
// tagovi (`amenity_tags[]`, M2 spec §2.3c `AmenityTag` enum, pravi upitni parametar `GET
// /search`, I-logika na serveru — proizvod mora imati SVE izabrane tagove).
const AMENITY_GROUPS: { label: string; tags: { value: string; label: string }[] }[] = [
  {
    label: 'Udaljenost od plaže',
    tags: [
      { value: 'BEACH_UNDER_50M', label: 'do 50m' },
      { value: 'BEACH_UNDER_100M', label: 'do 100m' },
      { value: 'BEACH_UNDER_250M', label: 'do 250m' },
      { value: 'BEACH_UNDER_500M', label: 'do 500m' },
      { value: 'BEACH_OVER_500M', label: 'preko 500m' },
    ],
  },
  {
    label: 'Plaža',
    tags: [
      { value: 'BEACH_SAND', label: 'peščana' },
      { value: 'BEACH_PEBBLE', label: 'šljunkovita' },
      { value: 'BEACH_ROCK', label: 'stenovita' },
      { value: 'BEACH_PRIVATE', label: 'privatna' },
    ],
  },
  {
    label: 'Bazen',
    tags: [
      { value: 'POOL_OUTDOOR', label: 'spoljni' },
      { value: 'POOL_INDOOR', label: 'zatvoren' },
      { value: 'POOL_HEATED', label: 'grejan' },
      { value: 'POOL_KIDS', label: 'dečji' },
    ],
  },
  {
    label: 'Sadržaji objekta',
    tags: [
      { value: 'WIFI_FREE', label: 'besplatan WiFi' },
      { value: 'PARKING', label: 'parking' },
      { value: 'GYM', label: 'teretana' },
      { value: 'SPA_WELLNESS', label: 'spa/wellness' },
      { value: 'RESTAURANT', label: 'restoran' },
      { value: 'AIRPORT_SHUTTLE', label: 'prevoz do aerodroma' },
      { value: 'RECEPTION_24H', label: 'recepcija 24h' },
      { value: 'ROOM_SERVICE', label: 'usluga u sobi' },
    ],
  },
  {
    label: 'Soba',
    tags: [
      { value: 'AC', label: 'klima' },
      { value: 'TV', label: 'TV' },
      { value: 'KITCHENETTE', label: 'čajna kuhinja' },
      { value: 'MINIBAR', label: 'minibar' },
      { value: 'BALCONY', label: 'balkon' },
      { value: 'SEA_VIEW', label: 'pogled na more' },
      { value: 'MOUNTAIN_VIEW', label: 'pogled na planinu' },
    ],
  },
  {
    label: 'Pogodno za',
    tags: [
      { value: 'FAMILY_FRIENDLY', label: 'porodice' },
      { value: 'ADULTS_ONLY', label: 'samo odrasli' },
      { value: 'PETS_ALLOWED', label: 'kućni ljubimci' },
    ],
  },
  {
    label: 'Politika',
    tags: [
      { value: 'FREE_CANCELLATION', label: 'besplatno otkazivanje' },
      { value: 'PAY_AT_PROPERTY', label: 'plaćanje u objektu' },
      { value: 'NON_SMOKING', label: 'nepušački' },
    ],
  },
];
const BOARD_TYPE_OPTIONS = [
  { value: 'BB', label: 'Noćenje sa doručkom' },
  { value: 'HB', label: 'Polupansion' },
  { value: 'FB', label: 'Pun pansion' },
  { value: 'AI', label: 'All Inclusive' },
  { value: 'UAI', label: 'Ultra All Inclusive' },
];

// Naslov filtera (3.9.2026, na zahtev vlasnika) — velika slova, markirano tamnijom nijansom u
// odnosu na `panel` (isti `bg-sunken` token kao traka naslova sekcije na strani rezervacije,
// BookingOverviewHero.tsx — token je NAMERNO uvek tamniji od `panel` u sva tri moda, vidi
// globals.css), da se naslov jasno izdvoji od samih tagova ispod.
const FILTER_TITLE_CLASS = 'block w-full bg-sunken px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-dim';

// Razmak i tanka linija između sekcija filtera (3.9.2026, na zahtev vlasnika: „napravite malo
// veći razmak između sekcija filtera u levom panelu i stavite tanku horizontalnu liniju").
//
// Zadaje se na KONTEJNERU, ne na svakoj sekciji: sekcije nastaju na dva mesta (opšti filteri i
// petlja kroz `AMENITY_GROUPS`), a klasa prepisana na oba bi se razišla pri prvoj izmeni. Prva
// sekcija namerno ostaje bez linije — linija razdvaja, a iznad prve nema šta da se razdvoji.
const FILTER_SECTIONS_CLASS =
  'flex flex-col gap-4 [&>*]:border-t [&>*]:border-border [&>*]:pt-4 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0';
export default function SearchSidebarPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Vlasnikova odluka 3.9.2026 — klik na filter deluje ODMAH, nad već dovučenim rezultatima,
  // bez poziva serveru. Obrazloženje i podela posla sa dugmetom su u `SearchFiltersContext.tsx`.
  const filters = useSearchFilters();
  const currentTypes = sp.getAll('type');
  const showAccommodationFilters = currentTypes.includes('ACCOMMODATION');
  const showFlightFilters = currentTypes.includes('FLIGHT');

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-2 pb-3 text-xs">
      {currentTypes.length === 0 && (
        <p className="text-ink-faint">Izaberite vrstu proizvoda u centralnom panelu — filteri se pojavljuju uz aktivnu pretragu.</p>
      )}

      {currentTypes.length > 0 && (
      <form
        className="contents"
        onSubmit={(e) => {
          // „Primeni filtere" (zadržano na izričit zahtev vlasnika, 3.9.2026) — filtriranje je
          // inače trenutno i klijentsko, pa ovo dugme ima uži, jasan posao: upisuje živo stanje
          // filtera u ADRESU i time pokreće novu pretragu na serveru. Potrebno je kad filter
          // treba da važi nad širim skupom nego što je već dovučeno, i jedini je način da
          // filteri uđu u adresu — dakle u sačuvanu pretragu (§3.0g.2) i u deljiv link.
          //
          // Vrednosti se čitaju iz živog stanja, ne iz `FormData`: stanje je izvor istine otkako
          // filtriranje ne ide kroz adresu, a dva izvora bi se razišla čim jedno polje ostane
          // van forme.
          e.preventDefault();
          const next = new URLSearchParams(sp.toString());
          // Postojeći filteri se prvo skidaju — inače bi skinut filter ostao u adresi zauvek.
          for (const key of ALL_FILTER_KEYS) next.delete(key);
          for (const [key, value] of new URLSearchParams(filters.toQueryString())) next.append(key, value);
          router.push(`/rezervacije/pretraga?${next.toString()}`);
        }}
      >
        <Section title="Filteri" open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
          {/* Bez dugmeta koje se mora pritisnuti, korisniku treba mesto na kom vidi ŠTA je sve
              uključeno i način da to skine jednim potezom — inače aktivan filter iz prethodne
              pretrage tiho sužava sledeću. */}
          {filters.activeCount > 0 && (
            <div className="flex items-center justify-between rounded border border-accent bg-accent-soft px-2 py-1 text-[11px] text-accent-strong">
              <span>
                {filters.activeCount} {filters.activeCount === 1 ? 'aktivan filter' : 'aktivnih filtera'}
              </span>
              <button type="button" onClick={filters.reset} className="flex items-center gap-1 hover:underline">
                <Icon name="clear-all" /> poništi filtere
              </button>
            </div>
          )}
          <PriceRangeFields />
          <PillRadioGroup
            name="availability"
            label="dostupnost"
            current={filters.get('availability') ?? ''}
            onPick={(v) => filters.setScalar('availability', v)}
            options={[
              { value: '', label: 'sve' },
              { value: 'AVAILABLE', label: 'odmah potvrda' },
              { value: 'ON_REQUEST', label: 'upit' },
            ]}
          />

          {showAccommodationFilters && (
            <>
              <PillCheckboxGroup
                name="boardTypes"
                label="vrsta usluge"
                current={filters.getAll('boardTypes')}
                onToggle={(v) => filters.toggleMulti('boardTypes', v)}
                stack
                options={BOARD_TYPE_OPTIONS}
              />

              <div className="text-ink-faint">
                <div className={FILTER_SECTIONS_CLASS}>
                  {AMENITY_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className={`mb-1 ${FILTER_TITLE_CLASS}`}>{group.label}</div>
                      <div className="flex flex-wrap gap-1">
                        {group.tags.map((tag) => (
                          <label
                            key={tag.value}
                            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
                          >
                            <input
                              type="checkbox"
                              name="amenityTags"
                              value={tag.value}
                              checked={filters.getAll('amenityTags').includes(tag.value)}
                              onChange={() => filters.toggleMulti('amenityTags', tag.value)}
                              className="sr-only"
                            />
                            {tag.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {showFlightFilters && (
            <>
              {/* M5 spec §3.0d.1 — devet filtera letova, istraženo naspram Google Flights.
                  Svi klijentski, nad već dobijenim rezultatima; ne menjaju poziv GET /search. */}
              <PillRadioGroup
                name="stops"
                label="presedanja"
                current={filters.get('stops') ?? ''}
                onPick={(v) => filters.setScalar('stops', v)}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: 'DIRECT', label: 'direktno' },
                  { value: 'MAX1', label: 'do 1' },
                ]}
              />

              <PillCheckboxGroup
                name="airlines"
                label="avio-kompanija"
                current={filters.getAll('airlines')}
                onToggle={(v) => filters.toggleMulti('airlines', v)}
                options={airlineOptions.map((a) => ({ value: a, label: a }))}
              />

              {connectionAirportOptions.length > 0 && (
                <PillCheckboxGroup
                  name="connAirports"
                  label="aerodrom presedanja"
                  current={filters.getAll('connAirports')}
                  onToggle={(v) => filters.toggleMulti('connAirports', v)}
                  options={connectionAirportOptions.map((a) => ({ value: a, label: a }))}
                />
              )}

              <PillRadioGroup
                name="maxLayover"
                label="najduže čekanje na presedanju"
                current={filters.get('maxLayover') ?? ''}
                onPick={(v) => filters.setScalar('maxLayover', v)}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: '90', label: 'do 1.5h' },
                  { value: '180', label: 'do 3h' },
                  { value: '300', label: 'do 5h' },
                ]}
              />

              <PillRadioGroup
                name="maxDuration"
                label="najduže ukupno trajanje"
                current={filters.get('maxDuration') ?? ''}
                onPick={(v) => filters.setScalar('maxDuration', v)}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: '120', label: 'do 2h' },
                  { value: '300', label: 'do 5h' },
                  { value: '480', label: 'do 8h' },
                ]}
              />

              <label className="text-ink-faint">
                <span className={FILTER_TITLE_CLASS}>poletanje između</span>
                <div className="mt-1 flex gap-1">
                  <input type="time" name="departFrom" value={filters.get('departFrom') ?? ''} onChange={(e) => filters.setScalar('departFrom', e.target.value)} className="input w-1/2" />
                  <input type="time" name="departTo" value={filters.get('departTo') ?? ''} onChange={(e) => filters.setScalar('departTo', e.target.value)} className="input w-1/2" />
                </div>
              </label>

              <label className="text-ink-faint">
                <span className={FILTER_TITLE_CLASS}>sletanje između</span>
                <div className="mt-1 flex gap-1">
                  <input type="time" name="arriveFrom" value={filters.get('arriveFrom') ?? ''} onChange={(e) => filters.setScalar('arriveFrom', e.target.value)} className="input w-1/2" />
                  <input type="time" name="arriveTo" value={filters.get('arriveTo') ?? ''} onChange={(e) => filters.setScalar('arriveTo', e.target.value)} className="input w-1/2" />
                </div>
              </label>

              <PillRadioGroup
                name="minCheckedBags"
                label="predati prtljag u ceni"
                current={filters.get('minCheckedBags') ?? ''}
                onPick={(v) => filters.setScalar('minCheckedBags', v)}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: '1', label: 'bar 1 kofer' },
                  { value: '2', label: 'bar 2 kofera' },
                ]}
              />
            </>
          )}

          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 font-semibold text-ink-dim hover:border-accent hover:text-ink"
          >
            <Icon name="filter" /> primeni filtere
          </button>
        </Section>
      </form>
      )}
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1.5 py-1 text-left font-medium text-ink">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="text-ink-faint" />
        {title}
      </button>
      {open && <div className={`${FILTER_SECTIONS_CLASS} pl-1 pt-1`}>{children}</div>}
    </div>
  );
}


// Dizajn dok. §6f — izbor iz malog, poznatog skupa opcija ide kao grupa dugmadi, ne padajući
// meni. Ispod su `<input type="radio">`/`<input type="checkbox">` sakriveni iza `sr-only` i
// stilizovani kroz `has-[:checked]` — isti obrazac koji sekcija sadržaja (amenityTags) već
// koristi, i koji radi unutar postojeće nativne forme bez ijednog novog komada React stanja.
/**
 * Cena je jedini filter koji se KUCA, a ne bira klikom — i zato jedini kome trenutna primena
 * smeta: dok se ukuca „500", lista bi se presložila tri puta (na 5, na 50, na 500) i ono što je
 * korisnik gledao bi mu odskočilo ispod pogleda. Zato polje ima sopstveno stanje dok se kuca, a
 * u filtere upisuje tek kad se prestane kucati (400ms) ili kad polje izgubi fokus.
 */
function PriceRangeFields() {
  const filters = useSearchFilters();
  const fromFilters = { min: filters.get('priceMin') ?? '', max: filters.get('priceMax') ?? '' };
  const [draft, setDraft] = useState(fromFilters);

  // Spolja promenjena vrednost (otvorena sačuvana pretraga, „poništi filtere") mora da stigne u
  // polje — inače bi polje pokazivalo staru cifru dok filter već radi po novoj.
  const external = `${fromFilters.min}|${fromFilters.max}`;
  const lastExternal = useRef(external);
  useEffect(() => {
    if (external === lastExternal.current) return;
    lastExternal.current = external;
    setDraft(fromFilters);
  }, [external]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      if (draft.min !== fromFilters.min) filters.setScalar('priceMin', draft.min);
      if (draft.max !== fromFilters.max) filters.setScalar('priceMax', draft.max);
      lastExternal.current = `${draft.min}|${draft.max}`;
    }, 400);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label className="text-ink-faint">
      <span className={FILTER_TITLE_CLASS}>cena od / do</span>
      <div className="mt-1 flex gap-1">
        <input
          type="number"
          name="priceMin"
          min={0}
          value={draft.min}
          onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
          className="input w-1/2"
          placeholder="0"
        />
        <input
          type="number"
          name="priceMax"
          min={0}
          value={draft.max}
          onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
          className="input w-1/2"
          placeholder="∞"
        />
      </div>
    </label>
  );
}

function PillRadioGroup({
  name,
  label,
  current,
  onPick,
  options,
  stack,
}: {
  name: string;
  label: string;
  current: string;
  /** Filtriranje je trenutno (3.9.2026) — polja su kontrolisana, bez `defaultChecked`. */
  onPick: (value: string) => void;
  options: { value: string; label: string }[];
  /** Sve opcije jedna ispod druge, ne u redu (3.9.2026, na zahtev vlasnika — "vrsta usluge",
   * gde puni nazivi usluga ne stanu jedan pored drugog u uskom levom panelu). */
  stack?: boolean;
}) {
  return (
    <div className="text-ink-faint">
      <span className={FILTER_TITLE_CLASS}>{label}</span>
      <div className={`mt-1 flex gap-1 ${stack ? 'flex-col items-start' : 'flex-wrap'}`}>
        {options.map((o) => (
          <label
            key={o.value || 'any'}
            className={`cursor-pointer rounded border border-border px-2 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong ${stack ? 'w-full' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={current === o.value}
              onChange={() => onPick(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function PillCheckboxGroup({
  name,
  label,
  current,
  onToggle,
  options,
  stack,
}: {
  name: string;
  label: string;
  current: string[];
  onToggle: (value: string) => void;
  options: { value: string; label: string }[];
  /** Sve opcije jedna ispod druge, ne u redu (isto obrazloženje kao `PillRadioGroup` — puni
   * nazivi usluga ne stanu jedan pored drugog u uskom levom panelu). */
  stack?: boolean;
}) {
  return (
    <div className="text-ink-faint">
      <span className={FILTER_TITLE_CLASS}>{label}</span>
      <div className={`mt-1 flex gap-1 ${stack ? 'flex-col items-start' : 'flex-wrap'}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded border border-border px-2 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong ${stack ? 'w-full' : ''}`}
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={current.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
