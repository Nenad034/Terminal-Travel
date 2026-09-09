'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon, { IconDuo } from './Icon';
import ClearableTextField from './ClearableTextField';
import { PRODUCT_ICONS } from '@/lib/search-product-types';

// M17 spec §7a (dopuna 9.9.2026, vlasnikov zahtev: „Takođe treba staviti brze filtere za tip
// proizvoda i polja za pretragu po državi, mestu, hotelu, dobavljaču" — za /katalog, /dobavljaci
// i /ugovori). Jedna komponenta za sva tri ekrana, ne tri slične: skup ikonica i raspored polja
// moraju ostati isti, inače tri ekrana za isti posao izgledaju kao tri različita alata.
//
// Ime svakog parametra u adresi je PROSLEĐENO, ne ukucano — tri ekrana gađaju tri različita
// endpointa (`/catalog/products`, `/contracting/suppliers`, `/contracting/contracts`), a katalog
// uz to filtrira klijentski nad već dovučenom listom. Zajednički je IZGLED i ponašanje, ne API.
//
// Parametri koje traka NE kontroliše (straničenje, filteri levog panela na katalogu, status na
// ugovorima) prenose se kao skrivena polja — GET forma inače pri slanju obriše sve što nije u
// njoj, pa bi klik na filter tiho poništio izbor napravljen negde drugde.

const TEXT_DEBOUNCE_MS = 600;
const inputClass = 'input text-xs w-full';

/** Ista dva izuzetka kao na mreži kapaciteta: `types: []` nema šta da filtrira, a „Putovanja" */
/** deli `PACKAGE` sa „Grupnim paketima" — dve ikonice sa istim dejstvom su kvar, ne doslednost. */
const IKONICE = PRODUCT_ICONS.filter((p) => p.types.length > 0 && !p.hasExpertGuide);

export interface ScopeFieldNames {
  /** Parametar za vrstu proizvoda (traka ikonica). Sme da se ponovi u adresi. */
  productType: string;
  destinationCountry?: string;
  destinationCity?: string;
  productName?: string;
  /** Dobavljač — na katalogu je to naziv, na /dobavljaci sam naziv reda. */
  supplier?: string;
}

export default function ProductScopeFilterBar({
  action,
  polja,
  natpisi,
  dodatak,
  desno,
}: {
  /** Putanja ekrana — ide u `form action`, pa filtriranje radi i bez JavaScript-a. */
  action: string;
  polja: ScopeFieldNames;
  natpisi?: Partial<Record<keyof ScopeFieldNames, string>>;
  /** Dodatna polja specifična za ekran (npr. status ugovora). */
  dodatak?: React.ReactNode;
  /** Sadržaj na desnom kraju trake ikonica (npr. broj rezultata). */
  desno?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const izabraniTipovi = params?.getAll(polja.productType) ?? [];

  // Sve što traka ne kontroliše mora da preživi slanje forme.
  const sopstvena = new Set(
    [
      polja.productType,
      polja.destinationCountry,
      polja.destinationCity,
      polja.productName,
      polja.supplier,
    ].filter(Boolean) as string[],
  );
  const prenesi: { kljuc: string; vrednost: string }[] = [];
  for (const [kljuc, vrednost] of params?.entries() ?? []) {
    // `page` se namerno NE prenosi: promena filtera vraća na prvu stranu, inače se lako završi
    // na praznoj strani 3 (isti razlog kao u `ContractsFilterBar.tsx`).
    if (sopstvena.has(kljuc) || kljuc === 'page') continue;
    prenesi.push({ kljuc, vrednost });
  }

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
    v.delete(polja.productType);
    v.delete('page');
    for (const t of sledeci) v.append(polja.productType, t);
    router.push(`${action}?${v.toString()}`);
  }

  return (
    <form
      ref={formRef}
      onChange={handleFormChange}
      action={action}
      className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-panel p-3"
    >
      {prenesi.map((x, i) => (
        <input key={`${x.kljuc}-${i}`} type="hidden" name={x.kljuc} value={x.vrednost} />
      ))}
      {izabraniTipovi.map((t) => (
        <input key={t} type="hidden" name={polja.productType} value={t} />
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
              v.delete(polja.productType);
              v.delete('page');
              router.push(`${action}?${v.toString()}`);
            }}
            className="ml-1 text-[11px] text-accent-strong hover:underline"
          >
            poništi vrstu proizvoda
          </button>
        )}
        {desno && <span className="ml-auto">{desno}</span>}
      </div>

      <div className="flex w-full flex-wrap items-start gap-3">
        {polja.destinationCountry && (
          <Polje label={natpisi?.destinationCountry ?? 'Država'}>
            <ClearableTextField
              name={polja.destinationCountry}
              defaultValue={params?.get(polja.destinationCountry) ?? ''}
              placeholder="npr. Grčka"
              className={inputClass}
            />
          </Polje>
        )}
        {polja.destinationCity && (
          <Polje label={natpisi?.destinationCity ?? 'Mesto'}>
            <ClearableTextField
              name={polja.destinationCity}
              defaultValue={params?.get(polja.destinationCity) ?? ''}
              placeholder="npr. Budva"
              className={inputClass}
            />
          </Polje>
        )}
        {polja.productName && (
          <Polje label={natpisi?.productName ?? 'Hotel'}>
            <ClearableTextField
              name={polja.productName}
              defaultValue={params?.get(polja.productName) ?? ''}
              placeholder="naziv hotela"
              className={inputClass}
            />
          </Polje>
        )}
        {polja.supplier && (
          <Polje label={natpisi?.supplier ?? 'Dobavljač'}>
            <ClearableTextField
              name={polja.supplier}
              defaultValue={params?.get(polja.supplier) ?? ''}
              placeholder="naziv dobavljača"
              className={inputClass}
            />
          </Polje>
        )}
        {dodatak}
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

export function Polje({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
