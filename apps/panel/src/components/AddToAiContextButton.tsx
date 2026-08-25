'use client';

import Icon from './Icon';
import { useAiContext } from './AiContextContext';

// Dizajn dok. §6c.1a, M15 spec §6.5.4.3 — deljena ikonica "Dodaj u AI kontekst" za red/karticu
// bilo kog modula (zamena za razmatran desni klik — hover-otkrivena, isti obrazac kao
// CopyButton, radi i na dodir bez desnog klika). `refLabel` je čitljiva referenca (npr.
// "Rezervacija TT-2026-482") — agent je sam razrešava svojim postojećim alatima, ovde se ne
// šalju sirovi podaci zapisa.
export default function AddToAiContextButton({ refLabel }: { refLabel: string }) {
  const { addRecord, atCapacity } = useAiContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        addRecord(refLabel);
      }}
      disabled={atCapacity}
      title={atCapacity ? 'Najviše 8 zapisa u AI kontekstu odjednom' : `Dodaj "${refLabel}" u AI kontekst`}
      className="flex h-[22px] w-[22px] items-center justify-center rounded text-ink-faint opacity-0 hover:bg-panel2 hover:text-accent focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon name="symbol-number" />
    </button>
  );
}
