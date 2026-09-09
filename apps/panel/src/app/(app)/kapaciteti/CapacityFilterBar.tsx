'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon, { IconDuo } from '@/components/Icon';
import ClearableTextField from '@/components/ClearableTextField';
import ClearableDateRange from '@/components/ClearableDateRange';
import { PRODUCT_ICONS } from '@/lib/search-product-types';

// M17 spec §4b.3 (dopuna 9.9.2026, vlasnikov zahtev nad živim ekranom: "Po nazivu hotela, po
// mestu, po drzavi (uzmite primere filtera iz liste rezervacija)" + "Po tipu proizvoda (smestaj,
// letovi...) kao ikone koje koristimo u brzim filterima u listi rezervacija").
//
// Zamenjuje raniju traku sa golim `<input type="date">` i `onChange` → `router.push` po polju.
// Tri razloge zašto obična GET forma, a ne dosadašnji `postavi()` po polju:
//  1. ista polja kao Lista rezervacija (`RealFilterBar.tsx`) — `ClearableTextField` i
//     `ClearableDateRange` traže formu oko sebe, jer "×" poništava polje pozivom
//     `closest('form').requestSubmit()`;
//  2. `ClearableDateRange` unutra koristi `DateField` — kalendar koji panel koristi svuda od
//     29.8.2026 (DD-MM-GGGG kucanje, isti izgled u svakom browseru). Ovaj ekran je nastao
//     kasnije i propustio tu zamenu;
//  3. kucanje u tekstualno polje ne sme da pokreće navigaciju na svaki taster — otud pauza,
//     dok se izbor/datum primenjuju odmah (isti obrazac kao `IzvestajiFilterForm.tsx`).
//
// Traka ikonica NIJE lokalno stanje kao u Listi rezervacija: mreža se filtrira na SERVERU
// (M3 §6), pa izbor mora da živi u adresi da preživi osvežavanje i deljenje veze. Zato klik ide
// direktno kroz `router.push`, a ista vrednost stoji i kao skriveno polje u formi — inače bi je
// prvo sledeće slanje forme (kucanje u "Hotel") tiho obrisalo iz adrese.

const TEXT_DEBOUNCE_MS = 600;

const MODE_OPTIONS = [
  { value: '', label: 'sve vrste' },
  { value: 'FIXED', label: 'Alotman' },
  { value: 'ON_REQUEST', label: 'Na upit' },
  { value: 'CHARTER', label: 'Čarter' },
  { value: 'FIXED_LEASE', label: 'Fiksni zakup' },
];

// Isti katalog kao vođena pretraga i brzi filteri Liste rezervacija — jedan izvor istine.
// Izostavljena su dva slučaja, oba namerno:
//  - `types: []` ("Individualni paketi") — nije `Product.type`, nema šta da filtrira;
//  - `hasExpertGuide` ("Putovanja") — deli `PACKAGE` sa "Grupnim paketima", a mreža kapaciteta
//    nema parametar kojim bi ih razdvojila; dve ikonice sa istim dejstvom bi bile kvar, ne
//    doslednost sa Listom rezervacija.
const IKONICE = PRODUCT_ICONS.filter((p) => p.types.length > 0 && !p.hasExpertGuide);

const inputClass = 'input text-xs w-full';

export default function CapacityFilterBar({
  from,
  to,
  brojRedova,
  brojDana,
}: {
  from: string;
  to: string;
  brojRedova: number;
  brojDana: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const izabraniTipovi = params?.getAll('productType') ?? [];

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const target = e.target as unknown as HTMLInputElement;
    const isTypedText =
      target.tagName === 'INPUT' && (target.type === 'text' || target.type === '');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isTypedText) {
      debounceRef.current = setTimeout(() => formRef.current?.requestSubmit(), TEXT_DEBOUNCE_MS);
    } else {
      formRef.current?.requestSubmit();
    }
  }

  function prebaciTip(types: string[]) {
    const aktivan = types.some((t) => izabraniTipovi.includes(t));
    const sledeci = aktivan
      ? izabraniTipovi.filter((t) => !types.includes(t))
      : [...izabraniTipovi, ...types.filter((t) => !izabraniTipovi.includes(t))];

    const v = new URLSearchParams(params?.toString() ?? '');
    v.delete('productType');
    for (const t of sledeci) v.append('productType', t);
    router.push(`/kapaciteti?${v.toString()}`);
  }

  return (
    <form
      ref={formRef}
      onChange={handleFormChange}
      action="/kapaciteti"
      className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-3"
    >
      {/* Izbor vrste proizvoda stoji i kao skriveno polje: forma šalje SVA svoja polja, pa bi
          bez ovoga prvo sledeće slanje obrisalo izbor iz adrese. */}
      {izabraniTipovi.map((t) => (
        <input key={t} type="hidden" name="productType" value={t} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        {IKONICE.map((p) => {
          const aktivan = p.types.some((t) => izabraniTipovi.includes(t));
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => prebaciTip(p.types)}
              title={`Filtriraj: ${p.label}`}
              aria-pressed={aktivan}
              className={`flex h-[26px] w-[26px] items-center justify-center rounded ${
                aktivan
                  ? 'bg-accent-soft text-accent-strong'
                  : 'text-ink-faint hover:bg-panel2 hover:text-ink'
              }`}
            >
              {p.iconDuo ? <IconDuo name={p.icon} /> : <Icon name={p.icon} />}
            </button>
          );
        })}
        {izabraniTipovi.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const v = new URLSearchParams(params?.toString() ?? '');
              v.delete('productType');
              router.push(`/kapaciteti?${v.toString()}`);
            }}
            className="ml-1 text-[11px] text-accent-strong hover:underline"
          >
            poništi vrstu proizvoda
          </button>
        )}
        <span className="ml-auto text-[11px] text-ink-faint">
          {brojRedova} {brojRedova === 1 ? 'tip smeštaja' : 'tipova smeštaja'} · {brojDana} dana
        </span>
      </div>

      <div className="flex w-full flex-wrap items-start gap-3">
        <Polje label="Period boravka od…do" sirina="min-w-[260px]">
          <ClearableDateRange
            nameFrom="from"
            nameTo="to"
            defaultFrom={from}
            defaultTo={to}
            className={inputClass}
          />
        </Polje>
        <Polje label="Država">
          <ClearableTextField
            name="destinationCountry"
            defaultValue={params?.get('destinationCountry') ?? ''}
            placeholder="npr. Grčka"
            className={inputClass}
          />
        </Polje>
        <Polje label="Mesto">
          <ClearableTextField
            name="destinationCity"
            defaultValue={params?.get('destinationCity') ?? ''}
            placeholder="npr. Budva"
            className={inputClass}
          />
        </Polje>
        <Polje label="Hotel">
          <ClearableTextField
            name="productName"
            defaultValue={params?.get('productName') ?? ''}
            placeholder="naziv hotela"
            className={inputClass}
          />
        </Polje>
        <Polje label="Vrsta ugovora">
          <select
            name="allotmentMode"
            defaultValue={params?.get('allotmentMode') ?? ''}
            className={inputClass}
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Polje>
        <button
          type="submit"
          title="Primeni filter"
          className="mt-[18px] flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
        >
          <Icon name="play" />
        </button>
      </div>
    </form>
  );
}

function Polje({
  label,
  sirina = 'min-w-[140px]',
  children,
}: {
  label: string;
  sirina?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-1 flex-col gap-0.5 ${sirina}`}>
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
