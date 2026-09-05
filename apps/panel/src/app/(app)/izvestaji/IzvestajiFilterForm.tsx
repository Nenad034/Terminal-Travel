'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Icon, { IconDuo } from '@/components/Icon';
import PeriodRangeField from './PeriodRangeField';
import FilterLocationFields from './FilterLocationFields';
import FieldInline from './FieldInline';
import {
  type TabKey,
  type SearchParams,
  OCCUPANCY_GROUP_BY,
  CHANNEL_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  DYNAMIC_DIMENSIONS,
  DYNAMIC_DRILLDOWN_DIMS,
  DYNAMIC_PRODUCT_ICONS,
  DYNAMIC_OTHER_PRESETS,
  DATE_FIELD_LABELS,
  DATE_FIELD_OPTIONS,
  SEGMENT_LABELS,
  SEGMENT_OPTIONS,
} from './constants';

// M13 spec §7 dopuna (5.9.2026, vlasnikov nalaz: "polja u kojima se kuca ne reaguju... polje...
// i dalje ne reaguje na pretragu po pojmu") — ceo filter red izdvojen iz `page.tsx` (server
// komponenta) u sopstvenu klijentsku komponentu da bi mogao da se primenjuje ODMAH pri promeni
// bilo kog polja, isti obrazac ("automatska primena filtera") kao `rezervacije/lista/
// RealFilterBar.tsx`: diskretni kontrolni elementi (select) primenjuju odmah, tekstualna polja
// (kucanje) čekaju kratku pauzu da se ne pokreće cela navigacija na svaki taster. Forma ostaje
// ISTA obična GET forma (`action="/izvestaji"`), "primeni filter" dugme ostaje kao ručni fallback
// (isti princip kao RealFilterBar — automatska primena ne uklanja dugme, samo ga čini opcionim).
const TEXT_DEBOUNCE_MS = 600;

// Sitna klasa da select-input padajući meni (native OS popup) ne padne na svetlu podlogu sa
// svetlim tekstom u tamnom režimu (5.9.2026, vlasnikov nalaz: "u druga dva polja kontrast
// izmedju pozadine i teksta nije dobar pa se slova ne vide u tamnom modu") — `<option>` ne
// nasleđuje pozadinu/tekst roditelja u OTVORENOM (popup) stanju u većini pregledača, mora
// eksplicitno da nosi iste tokene kao ostatak panela.
const optionClassName = 'bg-panel text-ink';
const selectClassName = 'w-full min-w-0 bg-transparent text-xs text-ink outline-none';
const inputClassName = 'w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint';

export default function IzvestajiFilterForm({ tab, searchParams, view }: { tab: TabKey; searchParams: SearchParams; view: 'tabela' | 'grafik' }) {
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const target = e.target as unknown as HTMLInputElement;
    const isTypedText = target.tagName === 'INPUT' && (target.type === 'text' || target.type === '');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isTypedText) {
      debounceRef.current = setTimeout(() => formRef.current?.requestSubmit(), TEXT_DEBOUNCE_MS);
    } else {
      formRef.current?.requestSubmit();
    }
  }

  function baseParams(): URLSearchParams {
    const v = new URLSearchParams();
    if (tab) v.set('tab', tab);
    if (searchParams?.from) v.set('from', searchParams.from);
    if (searchParams?.to) v.set('to', searchParams.to);
    if (searchParams?.dateField) v.set('dateField', searchParams.dateField);
    if (searchParams?.segment) v.set('segment', searchParams.segment);
    if (searchParams?.destinationCountry) v.set('destinationCountry', searchParams.destinationCountry);
    if (searchParams?.destinationCity) v.set('destinationCity', searchParams.destinationCity);
    if (searchParams?.supplierId) v.set('supplierId', searchParams.supplierId);
    if (searchParams?.providerCode) v.set('providerCode', searchParams.providerCode);
    if (searchParams?.channel) v.set('channel', searchParams.channel);
    if (searchParams?.productType) v.set('productType', searchParams.productType);
    if (searchParams?.groupBy) v.set('groupBy', searchParams.groupBy);
    return v;
  }
  // Preset kombinacije dimenzija za "Dinamički" — isti obrazac kao `subHref`/`viewHref` u
  // `page.tsx`, menja SAMO `groupBy` (+ `productType`).
  function dimensionsHref(dims: string, productType: string | undefined): string {
    const v = baseParams();
    if (view === 'grafik') v.set('view', 'grafik');
    v.set('groupBy', dims);
    if (productType) v.set('productType', productType);
    else v.delete('productType');
    return `/izvestaji?${v.toString()}`;
  }

  const currentDateField = searchParams?.dateField && searchParams.dateField in DATE_FIELD_LABELS ? searchParams.dateField : 'stay_from';
  const currentDims = searchParams?.groupBy || 'destination_country,destination_city';

  // Dugme akcije — zatvorena, ravnokraka strelica (▶) umesto teksta (5.9.2026, vlasnikov
  // zahtev: "sva dugmad koja pozivaju na akciju (narandzasta) umesto slova treba da imaju
  // zatvorenu strelicu... umesto ove strelice zelim ovakvu ► ali ravnokraku" — `play` je
  // codicons glif koji tačno to prikazuje, ne `arrow-right` (koji ima "stubić", nije čist
  // trougao). `title` nosi tekstualno objašnjenje za hover/čitač ekrana. Automatska primena
  // (iznad) ga čini fallback-om, ne jedinim putem do primene filtera — isti princip kao
  // `RealFilterBar.tsx`.
  const submitButton = (
    <button
      type="submit"
      title="Primeni filter"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
    >
      <Icon name="play" />
    </button>
  );

  return (
    <form ref={formRef} onChange={handleFormChange} className="mb-4 flex flex-wrap items-center gap-2 text-xs" action="/izvestaji">
      <input type="hidden" name="tab" value={tab} />
      {/* Period + "odnosi se na" + "segment" u JEDNOM redu, iste širine (5.9.2026, vlasnikov
          zahtev: "polje za datum i dva ispod tog polja treba da budu u istom redu, istih
          sirina") — eksplicitan red (ne opšti flex-wrap sa ostatkom forme, koji zavisi od širine
          ekrana i broja ostalih polja) garantuje ova tri UVEK zajedno, ravnomerno. */}
      <div className="flex w-full gap-2">
        <div className="min-w-0 flex-1">
          <PeriodRangeField initialFrom={searchParams?.from ?? ''} initialTo={searchParams?.to ?? ''} />
        </div>
        <div className="min-w-0 flex-1">
          <FieldInline label="odnosi se na">
            <select name="dateField" defaultValue={currentDateField} className={selectClassName}>
              {DATE_FIELD_OPTIONS.map((f) => (
                <option key={f} value={f} className={optionClassName}>
                  {DATE_FIELD_LABELS[f]}
                </option>
              ))}
            </select>
          </FieldInline>
        </div>
        <div className="min-w-0 flex-1">
          <FieldInline label="segment">
            <select name="segment" defaultValue={searchParams?.segment ?? ''} className={selectClassName}>
              <option value="" className={optionClassName}>
                svi
              </option>
              {SEGMENT_OPTIONS.map((s) => (
                <option key={s} value={s} className={optionClassName}>
                  {SEGMENT_LABELS[s]}
                </option>
              ))}
            </select>
          </FieldInline>
        </div>
      </div>
      {(tab === 'profitabilnost' || tab === 'smestaj') && (
        <>
          <FilterLocationFields
            initialCountry={searchParams?.destinationCountry ?? ''}
            initialCity={searchParams?.destinationCity ?? ''}
          />
          <FieldInline label="dobavljač (ID)">
            <input name="supplierId" defaultValue={searchParams?.supplierId ?? ''} className={inputClassName} />
          </FieldInline>
        </>
      )}
      {tab === 'profitabilnost' && (
        <>
          <FieldInline label="provajder (M4)">
            <input name="providerCode" defaultValue={searchParams?.providerCode ?? ''} className={inputClassName} />
          </FieldInline>
          <FieldInline label="kanal">
            <select name="channel" defaultValue={searchParams?.channel ?? ''} className={selectClassName}>
              <option value="" className={optionClassName}>
                svi
              </option>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c} className={optionClassName}>
                  {c}
                </option>
              ))}
            </select>
          </FieldInline>
        </>
      )}
      {tab === 'prodaja' && (
        <>
          <FieldInline label="kanal">
            <select name="channel" defaultValue={searchParams?.channel ?? ''} className={selectClassName}>
              <option value="" className={optionClassName}>
                svi
              </option>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c} className={optionClassName}>
                  {c}
                </option>
              ))}
            </select>
          </FieldInline>
          <FieldInline label="tip proizvoda">
            <select name="productType" defaultValue={searchParams?.productType ?? ''} className={selectClassName}>
              <option value="" className={optionClassName}>
                svi
              </option>
              {PRODUCT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t} className={optionClassName}>
                  {t}
                </option>
              ))}
            </select>
          </FieldInline>
        </>
      )}
      {tab === 'smestaj' && (
        <FieldInline label="razvrstaj po">
          <select name="groupBy" defaultValue={searchParams?.groupBy ?? ''} className={selectClassName}>
            <option value="" className={optionClassName}>
              bez razvrstavanja
            </option>
            {OCCUPANCY_GROUP_BY.map((g) => (
              <option key={g} value={g} className={optionClassName}>
                {g}
              </option>
            ))}
          </select>
        </FieldInline>
      )}
      {tab === 'dinamicki' && (
        <>
          {/* Ikonice vrsta proizvoda — BEZ vidljivog naziva (5.9.2026, vlasnikov zahtev: "pored
              ikona za vrstu uskuge uklonite nazive samo neka ostane pojavljivanje kada se predje
              misem preko ikone") — `title` (već postojao) ostaje jedini nosilac naziva, native
              hover tooltip. Dugme akcije u ISTOM redu (isti zahtev: "u istom redu stavite i
              strekicu u narandzaston tagu") — za ovaj tab dugme NIJE na kraju forme (dole), nego
              odmah posle poslednje ikonice. */}
          <div className="flex w-full flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] text-ink-faint">po vrsti proizvoda (država → mesto → proizvod)</span>
            {DYNAMIC_PRODUCT_ICONS.map((p) => {
              const typeParam = p.types.join(',');
              const active = currentDims === DYNAMIC_DRILLDOWN_DIMS && (searchParams?.productType ?? '') === typeParam;
              return (
                <Link
                  key={p.label}
                  href={dimensionsHref(DYNAMIC_DRILLDOWN_DIMS, typeParam)}
                  title={p.label}
                  className={`flex items-center justify-center rounded-full border p-1.5 ${
                    active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:text-ink'
                  }`}
                >
                  {p.iconDuo ? <IconDuo name={p.icon} /> : <Icon name={p.icon} />}
                </Link>
              );
            })}
            {submitButton}
          </div>
          {/* Kanal/Dobavljač premešteni IZNAD tabele/grafika, uz desnu ivicu (5.9.2026,
              vlasnikov zahtev: "po kriterijumu kanal i dobavljac linkove stavite iznad desne
              gornje ivice tabele") — vidi render tela izveštaja u `page.tsx`, van ove forme. */}
          {/* Bez ovog hidden polja bi automatska primena (na promenu ručnog polja za dimenzije)
              tiho obrisala izabranu vrstu proizvoda — `productType` se postavlja SAMO preko
              ikonica (`<Link>`), ne kroz ijedno pravo polje ove forme. */}
          <input type="hidden" name="productType" value={searchParams?.productType ?? ''} />
          <FieldInline label="dimenzije">
            <input
              name="groupBy"
              defaultValue={currentDims}
              placeholder={DYNAMIC_DIMENSIONS.join(',')}
              className={inputClassName}
            />
          </FieldInline>
        </>
      )}
      {tab !== 'dinamicki' && submitButton}
    </form>
  );
}
