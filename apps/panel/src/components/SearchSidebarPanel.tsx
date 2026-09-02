'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { airlineOptions, connectionAirportOptions } from '@/lib/mock-flights';

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
const BOARD_TYPES = ['BB', 'HB', 'FB', 'AI', 'UAI'];
export default function SearchSidebarPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(true);
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
          // Nativan GET submit bi ZAMENIO ceo query string samo poljima ove forme, brišući
          // type/destinaciju/datume iz popup-a — ovde spajamo sa postojećim parametrima umesto
          // toga (isti razlog zašto je ranije bio JEDAN deljeni <form> — sad su odvojeni, ali
          // moraju i dalje da se spajaju, ne zamenjuju).
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const next = new URLSearchParams(sp.toString());
          // Skalarni filteri — prazna vrednost briše parametar umesto da ga postavi na "".
          const scalarKeys = [
            'priceMin', 'priceMax', 'availability', 'boardType',
            // M5 spec §3.0d.1 — filteri letova.
            'stops', 'maxLayover', 'maxDuration', 'departFrom', 'departTo', 'arriveFrom', 'arriveTo', 'minCheckedBags',
          ];
          for (const key of scalarKeys) {
            const val = String(data.get(key) ?? '');
            if (val) next.set(key, val);
            else next.delete(key);
          }
          for (const key of ['amenityTags', 'airlines', 'connAirports']) {
            next.delete(key);
            for (const val of data.getAll(key)) next.append(key, String(val));
          }
          router.push(`/rezervacije/pretraga?${next.toString()}`);
        }}
      >
        <Section title="Filteri" open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)}>
          <label className="text-ink-faint">
            cena od / do
            <div className="mt-1 flex gap-1">
              <input type="number" name="priceMin" min={0} defaultValue={sp.get('priceMin') ?? ''} className="input w-1/2" placeholder="0" />
              <input type="number" name="priceMax" min={0} defaultValue={sp.get('priceMax') ?? ''} className="input w-1/2" placeholder="∞" />
            </div>
          </label>
          <label className="text-ink-faint">
            dostupnost
            <select name="availability" defaultValue={sp.get('availability') ?? ''} className="input mt-1 w-full">
              <option value="">— sve —</option>
              <option value="AVAILABLE">Odmah potvrda</option>
              <option value="ON_REQUEST">Upit</option>
            </select>
          </label>

          {showAccommodationFilters && (
            <>
              <label className="text-ink-faint">
                vrsta usluge
                <select name="boardType" defaultValue={sp.get('boardType') ?? ''} className="input mt-1 w-full">
                  <option value="">— sve —</option>
                  {BOARD_TYPES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-ink-faint">
                <div className="flex flex-col gap-2">
                  {AMENITY_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-1 text-xs font-bold uppercase text-ink-dim">{group.label}</div>
                      <div className="flex flex-wrap gap-1">
                        {group.tags.map((tag) => (
                          <label
                            key={tag.value}
                            className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
                          >
                            <input
                              type="checkbox"
                              name="amenityTags"
                              value={tag.value}
                              defaultChecked={sp.getAll('amenityTags').includes(tag.value)}
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
                current={sp.get('stops') ?? ''}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: 'DIRECT', label: 'direktno' },
                  { value: 'MAX1', label: 'do 1' },
                ]}
              />

              <PillCheckboxGroup
                name="airlines"
                label="avio-kompanija"
                current={sp.getAll('airlines')}
                options={airlineOptions.map((a) => ({ value: a, label: a }))}
              />

              {connectionAirportOptions.length > 0 && (
                <PillCheckboxGroup
                  name="connAirports"
                  label="aerodrom presedanja"
                  current={sp.getAll('connAirports')}
                  options={connectionAirportOptions.map((a) => ({ value: a, label: a }))}
                />
              )}

              <PillRadioGroup
                name="maxLayover"
                label="najduže čekanje na presedanju"
                current={sp.get('maxLayover') ?? ''}
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
                current={sp.get('maxDuration') ?? ''}
                options={[
                  { value: '', label: 'svejedno' },
                  { value: '120', label: 'do 2h' },
                  { value: '300', label: 'do 5h' },
                  { value: '480', label: 'do 8h' },
                ]}
              />

              <label className="text-ink-faint">
                poletanje između
                <div className="mt-1 flex gap-1">
                  <input type="time" name="departFrom" defaultValue={sp.get('departFrom') ?? ''} className="input w-1/2" />
                  <input type="time" name="departTo" defaultValue={sp.get('departTo') ?? ''} className="input w-1/2" />
                </div>
              </label>

              <label className="text-ink-faint">
                sletanje između
                <div className="mt-1 flex gap-1">
                  <input type="time" name="arriveFrom" defaultValue={sp.get('arriveFrom') ?? ''} className="input w-1/2" />
                  <input type="time" name="arriveTo" defaultValue={sp.get('arriveTo') ?? ''} className="input w-1/2" />
                </div>
              </label>

              <PillRadioGroup
                name="minCheckedBags"
                label="predati prtljag u ceni"
                current={sp.get('minCheckedBags') ?? ''}
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
      {open && <div className="flex flex-col gap-2 pl-1 pt-1">{children}</div>}
    </div>
  );
}


// Dizajn dok. §6f — izbor iz malog, poznatog skupa opcija ide kao grupa dugmadi, ne padajući
// meni. Ispod su `<input type="radio">`/`<input type="checkbox">` sakriveni iza `sr-only` i
// stilizovani kroz `has-[:checked]` — isti obrazac koji sekcija sadržaja (amenityTags) već
// koristi, i koji radi unutar postojeće nativne forme bez ijednog novog komada React stanja.
function PillRadioGroup({
  name,
  label,
  current,
  options,
}: {
  name: string;
  label: string;
  current: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="text-ink-faint">
      {label}
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => (
          <label
            key={o.value || 'any'}
            className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
          >
            <input type="radio" name={name} value={o.value} defaultChecked={current === o.value} className="sr-only" />
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
  options,
}: {
  name: string;
  label: string;
  current: string[];
  options: { value: string; label: string }[];
}) {
  return (
    <div className="text-ink-faint">
      {label}
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-dim has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
          >
            <input type="checkbox" name={name} value={o.value} defaultChecked={current.includes(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
