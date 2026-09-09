'use client';

import { useState } from 'react';

// M17 §6d.1 — cene i doplate su na istoj strani, u karticama.
//
// Ne dve odvojene rute: cena i doplata se u praksi unose u istom potezu, iz istog dokumenta.
// Odvojene rute bi značile dva učitavanja i gubitak konteksta (koje sezone, koji tipovi soba)
// pri svakom prelasku.
export default function Kartice({
  cene,
  doplate,
  brojDoplata,
}: {
  cene: React.ReactNode;
  doplate: React.ReactNode;
  brojDoplata: number;
}) {
  const [aktivna, setAktivna] = useState<'cene' | 'doplate'>('cene');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-border">
        <Dugme aktivna={aktivna === 'cene'} onClick={() => setAktivna('cene')}>
          Cene
        </Dugme>
        <Dugme aktivna={aktivna === 'doplate'} onClick={() => setAktivna('doplate')}>
          Doplate i popusti
          {brojDoplata > 0 && (
            <span className="ml-1.5 rounded-full bg-sunken px-1.5 text-[10px] text-ink-faint">
              {brojDoplata}
            </span>
          )}
        </Dugme>
      </div>

      {/* Obe kartice ostaju u DOM-u da se stanje unosa ne izgubi pri prebacivanju — čovek koji
          je do pola popunio formu za doplatu pa pogledao cene ne sme da izgubi ono što je uneo. */}
      <div hidden={aktivna !== 'cene'}>{cene}</div>
      <div hidden={aktivna !== 'doplate'}>{doplate}</div>
    </div>
  );
}

function Dugme({
  aktivna,
  onClick,
  children,
}: {
  aktivna: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
        aktivna
          ? 'border-accent font-semibold text-ink'
          : 'border-transparent text-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
