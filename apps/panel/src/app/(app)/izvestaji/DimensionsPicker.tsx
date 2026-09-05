'use client';

import { useState } from 'react';
import { DYNAMIC_DIMENSIONS } from './constants';

// M13 spec §7 dopuna (6.9.2026, vlasnikov nalaz: "polje destination_country,destination_city i
// dalje ne reaguje na pretragu po pojmu... iza ikona staviti polje... ali ga osposobiti jer i
// dalje ne radi") — slobodan tekst za "dimenzije" (redosled zarezom) je i dalje bio problematičan:
// ne postoji predlaganje/validacija dok se kuca (kucnuta greška u imenu dimenzije tiho vodi u
// generičku grešku izveštaja, deluje kao da polje "ne radi"), a šest mogućih vrednosti je
// POZNAT, fiksan skup — isti razlog kao pretvaranje "kanal"/"tip proizvoda" u `<select>` (v1.14).
// Ovde ne može biti prost `<select>` jer REDOSLED bira nivoe drill-down-a (država → mesto →
// proizvod nije isto što i proizvod → država → mesto) — rešenje je niz dugmadi koje se KLIKOM
// dodaju/uklanjaju iz niza, brojka pored aktivne dugmadi pokazuje njen redosled. Klik odmah
// primenjuje formu (`e.currentTarget.form?.requestSubmit()` — dugme unutar `<form>` uvek zna
// svoj `.form`, bez potrebe da ovaj fajl zna bilo šta o `IzvestajiFilterForm.tsx` oko sebe).
const DIMENSION_LABELS: Record<string, string> = {
  destination_country: 'Država',
  destination_city: 'Mesto',
  product_name: 'Proizvod',
  supplier_name: 'Dobavljač',
  channel: 'Kanal',
  subagent_name: 'Subagent',
};

export default function DimensionsPicker({ initial }: { initial: string }) {
  const [dims, setDims] = useState<string[]>(() => initial.split(',').map((s) => s.trim()).filter(Boolean));

  function toggle(dim: string, form: HTMLFormElement | null) {
    setDims((prev) => {
      const next = prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim];
      // Submit tek pošto React primeni novo stanje (i time novu vrednost skrivenog polja) —
      // `setTimeout(0)` je dovoljno da se izbegne slanje STARE vrednosti.
      setTimeout(() => form?.requestSubmit(), 0);
      return next;
    });
  }

  return (
    <>
      <input type="hidden" name="groupBy" value={dims.join(',')} />
      {DYNAMIC_DIMENSIONS.map((d) => {
        const position = dims.indexOf(d);
        const active = position !== -1;
        return (
          <button
            key={d}
            type="button"
            onClick={(e) => toggle(d, e.currentTarget.form)}
            title={active ? `${position + 1}. nivo` : 'Dodaj kao sledeći nivo'}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium ${
              active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:text-ink'
            }`}
          >
            {active && <span className="font-mono">{position + 1}.</span>}
            {DIMENSION_LABELS[d]}
          </button>
        );
      })}
    </>
  );
}
