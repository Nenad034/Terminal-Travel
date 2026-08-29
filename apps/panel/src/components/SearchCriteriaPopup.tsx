'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from './Icon';
import DateField from './DateField';

// M5 spec §3.0c/§3.0d ("vođena pretraga za 9 vrsta proizvoda") + vlasnikov predlog 22.8.2026
// ("ikone... popup u kom definišemo vrednosti... klik na pretraži... dugme izmeni"). Šest opštih
// polja važi za sve tipove; četiri tip-specifična polja (dopunjeno 22.8.2026, M5 spec §11 v1.28
// konačno ožičen u `SearchQueryDto`/`SearchService`) prikazuju se SAMO za tip kom pripadaju —
// nikad sva odjednom, da forma ne postane duga lista polja koja većini upita ne znače ništa.
// Namerno IZOSTAJU `origin_city`/`trip_cost` — `origin_city` bi filtrirao ugnježđen
// `attributes.route` čiji tačan oblik M2 spec §2.3 nikad nije precizirao, `trip_cost` (M2 spec
// §2.3) eksplicitno NIJE svojstvo proizvoda nego parametar ponude — filtriranje proizvoda po
// njemu ne bi ništa značilo. Oba ostaju otvorena u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`.
export interface FlightLeg {
  originCity: string;
  destinationCity: string;
  date: string;
}

export interface SearchCriteriaValues {
  destinationCountry: string;
  destinationCity: string;
  stayFrom: string;
  stayTo: string;
  adults: string;
  children: string;
  cabinClass: string;
  minDriverAge: string;
  durationNights: string;
  cabinType: string;
  // M5 spec §3.0d.1 — tip putovanja određuje samo UI tok (ONE_WAY = jedan poziv, ROUND_TRIP =
  // dva poziva uparena na klijentu, MULTI_CITY = niz poziva po nozi), nikad novi API parametar.
  tripType: string;
  originCity: string;
  returnDate: string;
  flightLegs: string; // JSON-encoded FlightLeg[], samo za MULTI_CITY
}

export function valuesFromSearchParams(sp: { get(key: string): string | null }): SearchCriteriaValues {
  return {
    destinationCountry: sp.get('destinationCountry') ?? '',
    destinationCity: sp.get('destinationCity') ?? '',
    stayFrom: sp.get('stayFrom') ?? '',
    stayTo: sp.get('stayTo') ?? '',
    adults: sp.get('adults') ?? '2',
    children: sp.get('children') ?? '0',
    cabinClass: sp.get('cabinClass') ?? '',
    minDriverAge: sp.get('minDriverAge') ?? '',
    durationNights: sp.get('durationNights') ?? '',
    cabinType: sp.get('cabinType') ?? '',
    tripType: sp.get('tripType') ?? 'ROUND_TRIP',
    originCity: sp.get('originCity') ?? '',
    returnDate: sp.get('returnDate') ?? '',
    flightLegs: sp.get('flightLegs') ?? '',
  };
}

export default function SearchCriteriaPopup({
  label,
  types,
  initialValues,
  onClose,
}: {
  label: string;
  types: string[];
  initialValues: SearchCriteriaValues;
  onClose: () => void;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [values, setValues] = useState(initialValues);

  // Destinacija postaje OBAVEZNA (dopuna 26.8.2026, na zahtev vlasnika: "treba da piše i koja
  // je destinacija" — sažetak pretrage/naziv sačuvane pretrage nije imao šta da prikaže kad je
  // ovo polje ostalo prazno). Samo DRŽAVA je obavezna (M5 spec §3.0c.2 — korak 1 vođene pretrage
  // je uvek zemlja, grad/hotel je finiji, opcioni drugi korak — pretraga cele države ostaje moguća).
  const destinationValid = values.destinationCountry.trim().length > 0;

  function submit() {
    if (!destinationValid) return;
    const next = new URLSearchParams(sp.toString());
    next.delete('type');
    for (const t of types) next.append('type', t);
    for (const [key, val] of Object.entries(values)) {
      if (val) next.set(key, val);
      else next.delete(key);
    }
    router.push(`/rezervacije/pretraga?${next.toString()}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Pretraga — {label}</h2>
          <button onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <label className="text-ink-faint">
            država odredišta <span className="text-danger">*</span>
            <input
              value={values.destinationCountry}
              onChange={(e) => setValues((v) => ({ ...v, destinationCountry: e.target.value }))}
              className="input mt-1 w-full"
              placeholder="Grčka"
              required
            />
          </label>
          <label className="text-ink-faint">
            grad odredišta
            <input
              value={values.destinationCity}
              onChange={(e) => setValues((v) => ({ ...v, destinationCity: e.target.value }))}
              className="input mt-1 w-full"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 text-ink-faint">
              od
              <div className="mt-1">
                <DateField value={values.stayFrom} onChange={(iso) => setValues((v) => ({ ...v, stayFrom: iso }))} className="input w-full" />
              </div>
            </label>
            <label className="flex-1 text-ink-faint">
              do
              <div className="mt-1">
                <DateField value={values.stayTo} onChange={(iso) => setValues((v) => ({ ...v, stayTo: iso }))} className="input w-full" />
              </div>
            </label>
          </div>
          <label className="text-ink-faint">
            odrasli / deca
            <div className="mt-1 flex gap-1">
              <input
                type="number"
                min={1}
                value={values.adults}
                onChange={(e) => setValues((v) => ({ ...v, adults: e.target.value }))}
                className="input w-1/2"
              />
              <input
                type="number"
                min={0}
                value={values.children}
                onChange={(e) => setValues((v) => ({ ...v, children: e.target.value }))}
                className="input w-1/2"
              />
            </div>
          </label>

          {types.length === 1 && types[0] === 'FLIGHT' && (
            <>
              <label className="text-ink-faint">
                polazni grad
                <input
                  value={values.originCity}
                  onChange={(e) => setValues((v) => ({ ...v, originCity: e.target.value }))}
                  className="input mt-1 w-full"
                  placeholder="Beograd"
                />
              </label>

              <div>
                <span className="text-ink-faint">tip putovanja</span>
                <div className="mt-1 flex rounded border border-border text-[11px]">
                  {[
                    { value: 'ONE_WAY', label: 'Jednosmerno' },
                    { value: 'ROUND_TRIP', label: 'Povratno' },
                    { value: 'MULTI_CITY', label: 'Multidestinacija' },
                  ].map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setValues((v) => ({
                          ...v,
                          tripType: opt.value,
                          returnDate: opt.value === 'ROUND_TRIP' ? v.returnDate : '',
                          flightLegs: opt.value === 'MULTI_CITY' ? v.flightLegs : '',
                        }))
                      }
                      className={`flex-1 px-2 py-1.5 ${i > 0 ? 'border-l border-border' : ''} ${
                        values.tripType === opt.value ? 'bg-accent font-semibold text-accent-ink' : 'text-ink-dim hover:bg-panel2'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {values.tripType === 'ROUND_TRIP' && (
                <label className="text-ink-faint">
                  datum povratka
                  <div className="mt-1">
                    <DateField value={values.returnDate} onChange={(iso) => setValues((v) => ({ ...v, returnDate: iso }))} className="input w-full" />
                  </div>
                </label>
              )}

              {values.tripType === 'MULTI_CITY' && (
                <FlightLegsEditor
                  value={values.flightLegs}
                  onChange={(next) => setValues((v) => ({ ...v, flightLegs: next }))}
                />
              )}

              <label className="text-ink-faint">
                klasa (cabin class)
                <select
                  value={values.cabinClass}
                  onChange={(e) => setValues((v) => ({ ...v, cabinClass: e.target.value }))}
                  className="input mt-1 w-full"
                >
                  <option value="">— svejedno —</option>
                  <option value="ECONOMY">Economy</option>
                  <option value="PREMIUM_ECONOMY">Premium Economy</option>
                  <option value="BUSINESS">Business</option>
                  <option value="FIRST">First</option>
                </select>
              </label>
            </>
          )}

          {types.length === 1 && types[0] === 'TRANSPORT' && (
            <label className="text-ink-faint">
              starost vozača
              <input
                type="number"
                min={1}
                value={values.minDriverAge}
                onChange={(e) => setValues((v) => ({ ...v, minDriverAge: e.target.value }))}
                className="input mt-1 w-full"
                placeholder="npr. 25"
              />
            </label>
          )}

          {types.length === 1 && types[0] === 'CRUISE' && (
            <>
              <label className="text-ink-faint">
                broj noćenja
                <input
                  type="number"
                  min={1}
                  value={values.durationNights}
                  onChange={(e) => setValues((v) => ({ ...v, durationNights: e.target.value }))}
                  className="input mt-1 w-full"
                  placeholder="npr. 7"
                />
              </label>
              <label className="text-ink-faint">
                tip kabine
                <select
                  value={values.cabinType}
                  onChange={(e) => setValues((v) => ({ ...v, cabinType: e.target.value }))}
                  className="input mt-1 w-full"
                >
                  <option value="">— svejedno —</option>
                  <option value="INTERIOR">Interior</option>
                  <option value="OCEANVIEW">Oceanview</option>
                  <option value="BALCONY">Balcony</option>
                  <option value="SUITE">Suite</option>
                </select>
              </label>
            </>
          )}
        </div>

        {!destinationValid && <p className="mt-3 text-[11px] text-danger">Unesite bar državu odredišta.</p>}
        <button
          onClick={submit}
          disabled={!destinationValid}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="search" /> pretraži
        </button>
      </div>
    </div>
  );
}

// Uređivač nogu puta za multidestinacijski let (M5 spec §3.0d.1 — "multi-city... niz poziva, po
// jedan po nozi puta"). Vrednost putuje kao JSON string kroz `SearchCriteriaValues.flightLegs`
// (isti obrazac kao `occupancy` u page.tsx) da ostane deo iste ravne URL parametar strukture.
function FlightLegsEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  let legs: FlightLeg[] = [];
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed)) legs = parsed;
  } catch {
    legs = [];
  }
  if (legs.length === 0) legs = [{ originCity: '', destinationCity: '', date: '' }];

  function update(next: FlightLeg[]) {
    onChange(JSON.stringify(next));
  }

  function updateLeg(i: number, patch: Partial<FlightLeg>) {
    update(legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <div>
      <span className="text-ink-faint">noge puta</span>
      <div className="mt-1 flex flex-col gap-2">
        {legs.map((leg, i) => (
          <div key={i} className="rounded border border-border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-dim">let {i + 1}</span>
              {legs.length > 1 && (
                <button type="button" onClick={() => update(legs.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-danger">
                  <Icon name="close" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              <input
                value={leg.originCity}
                onChange={(e) => updateLeg(i, { originCity: e.target.value })}
                placeholder="odakle"
                className="input w-1/3"
              />
              <input
                value={leg.destinationCity}
                onChange={(e) => updateLeg(i, { destinationCity: e.target.value })}
                placeholder="dokle"
                className="input w-1/3"
              />
              <div className="w-1/3">
                <DateField value={leg.date} onChange={(iso) => updateLeg(i, { date: iso })} className="input" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => update([...legs, { originCity: '', destinationCity: '', date: '' }])}
        className="mt-1 flex items-center gap-1 text-[11px] text-accent-strong hover:underline"
      >
        <Icon name="add" /> dodaj nogu puta
      </button>
    </div>
  );
}
