'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import type { AgePricingEntry, AgePricingMode } from './RateLinesPanel';

// M3 spec §2.4a / §2.4c (dopuna 9.9.2026, posle vlasnikovog pitanja gde se cene unose ručno) —
// cena po uzrasnoj kategoriji. Do ove dopune je polje postojalo u bazi i u API-ju, ali forma ga
// nije imala, uz komentar „API-only dok se pokaže potreba": dečja cena se dakle nije mogla uneti
// iz panela, a bez nje cenovnik smeštaja nije cenovnik.
//
// Redovi izlaze kao PARALELNI NIZOVI skrivenih polja (`agePricingCategory[]`, `agePricingMode[]`…),
// jer HTML forma nema ugnježdene objekte; server akcija ih spaja po indeksu i preskače prazne.

// Vrednosti moraju tačno odgovarati Prisma enumu `AgeCategory` (ADULT/CHILD/TEEN/INFANT).
// ISPRAVKA 9.9.2026: prva verzija je koristila 'BABY', koje u enumu ne postoji — izbor „Beba"
// bi prošao kroz formu i pao tek pri upisu u bazu. Panel ne uvozi Prisma tipove, pa ovde nema
// provere prevodioca; jedina zaštita je da se vrednost ne izmišlja (zamka 7.8).
const KATEGORIJE = [
  { value: 'INFANT', label: 'Beba' },
  { value: 'CHILD', label: 'Dete' },
  { value: 'TEEN', label: 'Tinejdžer' },
  { value: 'ADULT', label: 'Odrasla osoba' },
];

const REZIMI: { value: AgePricingMode; label: string }[] = [
  { value: 'PERCENTAGE_OF_BASE_PRICE', label: 'procenat osnovne cene' },
  { value: 'FLAT_PRICE_PER_NIGHT', label: 'fiksna cena po noći' },
];

interface Red {
  kljuc: number;
  ageCategory: string;
  pricingMode: AgePricingMode;
  percentage: string;
  flatPrice: string;
  minAdultsPresent: string;
}

function prazanRed(kljuc: number): Red {
  return {
    kljuc,
    ageCategory: 'CHILD',
    pricingMode: 'PERCENTAGE_OF_BASE_PRICE',
    percentage: '',
    flatPrice: '',
    minAdultsPresent: '',
  };
}

export default function AgePricingFields({ initial }: { initial?: AgePricingEntry[] }) {
  const [redovi, setRedovi] = useState<Red[]>(
    (initial ?? []).map((a, i) => ({
      kljuc: i,
      ageCategory: a.ageCategory,
      pricingMode: a.pricingMode,
      percentage: a.percentage != null ? String(a.percentage) : '',
      flatPrice: a.flatPrice != null ? String(a.flatPrice) : '',
      minAdultsPresent: a.minAdultsPresent != null ? String(a.minAdultsPresent) : '',
    })),
  );
  const [brojac, setBrojac] = useState(1000);

  function izmeni(kljuc: number, izmena: Partial<Red>) {
    setRedovi((cur) => cur.map((r) => (r.kljuc === kljuc ? { ...r, ...izmena } : r)));
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-ink">Cena po uzrastu (opciono)</span>
        <button
          type="button"
          onClick={() => {
            setRedovi((cur) => [...cur, prazanRed(brojac)]);
            setBrojac((b) => b + 1);
          }}
          className="text-[11px] text-accent-strong hover:underline"
        >
          + dodaj uzrast
        </button>
      </div>

      {redovi.length === 0 && (
        <p className="text-[10px] text-ink-faint">
          Bez ovoga svaka osoba plaća punu cenu iz polja iznad — deca uključena.
        </p>
      )}

      {redovi.map((r) => (
        <div key={r.kljuc} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="agePricingCategory" value={r.ageCategory} />
          <input type="hidden" name="agePricingMode" value={r.pricingMode} />
          <input type="hidden" name="agePricingPercentage" value={r.percentage} />
          <input type="hidden" name="agePricingFlatPrice" value={r.flatPrice} />
          <input type="hidden" name="agePricingMinAdults" value={r.minAdultsPresent} />

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink-faint">Kategorija</span>
            <select
              value={r.ageCategory}
              onChange={(e) => izmeni(r.kljuc, { ageCategory: e.target.value })}
              className="input"
            >
              {KATEGORIJE.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink-faint">Način</span>
            <select
              value={r.pricingMode}
              onChange={(e) => izmeni(r.kljuc, { pricingMode: e.target.value as AgePricingMode })}
              className="input"
            >
              {REZIMI.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {r.pricingMode === 'PERCENTAGE_OF_BASE_PRICE' ? (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-ink-faint">Procenat</span>
              <input
                type="number"
                min={0}
                max={100}
                value={r.percentage}
                onChange={(e) => izmeni(r.kljuc, { percentage: e.target.value })}
                className="input w-24"
                placeholder="npr. 50"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-ink-faint">Cena/noć</span>
              <input
                type="number"
                min={0}
                value={r.flatPrice}
                onChange={(e) => izmeni(r.kljuc, { flatPrice: e.target.value })}
                className="input w-28"
              />
            </label>
          )}

          <label className="flex flex-col gap-0.5">
            {/* §2.4a — „dete gratis uz dve odrasle osobe" je najčešći uslov u cenovnicima. */}
            <span className="text-[10px] text-ink-faint">Uz najmanje odraslih</span>
            <input
              type="number"
              min={0}
              value={r.minAdultsPresent}
              onChange={(e) => izmeni(r.kljuc, { minAdultsPresent: e.target.value })}
              className="input w-20"
              placeholder="npr. 2"
            />
          </label>

          <button
            type="button"
            title="Ukloni ovaj uzrast"
            onClick={() => setRedovi((cur) => cur.filter((x) => x.kljuc !== r.kljuc))}
            className="mb-1 flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:text-danger"
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}
