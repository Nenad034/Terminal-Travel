'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from './Icon';

// M5 spec §3.0c/§3.0d ("vođena pretraga za 9 vrsta proizvoda") + vlasnikov predlog 22.8.2026
// ("ikone... popup u kom definišemo vrednosti... klik na pretraži... dugme izmeni"). Šest opštih
// polja važi za sve tipove; četiri tip-specifična polja (dopunjeno 22.8.2026, M5 spec §11 v1.28
// konačno ožičen u `SearchQueryDto`/`SearchService`) prikazuju se SAMO za tip kom pripadaju —
// nikad sva odjednom, da forma ne postane duga lista polja koja većini upita ne znače ništa.
// Namerno IZOSTAJU `origin_city`/`trip_cost` — `origin_city` bi filtrirao ugnježđen
// `attributes.route` čiji tačan oblik M2 spec §2.3 nikad nije precizirao, `trip_cost` (M2 spec
// §2.3) eksplicitno NIJE svojstvo proizvoda nego parametar ponude — filtriranje proizvoda po
// njemu ne bi ništa značilo. Oba ostaju otvorena u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`.
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

  function submit() {
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
            država odredišta
            <input
              value={values.destinationCountry}
              onChange={(e) => setValues((v) => ({ ...v, destinationCountry: e.target.value }))}
              className="input mt-1 w-full"
              placeholder="Grčka"
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
              <input
                type="date"
                value={values.stayFrom}
                onChange={(e) => setValues((v) => ({ ...v, stayFrom: e.target.value }))}
                className="input mt-1 w-full"
              />
            </label>
            <label className="flex-1 text-ink-faint">
              do
              <input
                type="date"
                value={values.stayTo}
                onChange={(e) => setValues((v) => ({ ...v, stayTo: e.target.value }))}
                className="input mt-1 w-full"
              />
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

        <button
          onClick={submit}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
        >
          <Icon name="search" /> pretraži
        </button>
      </div>
    </div>
  );
}
