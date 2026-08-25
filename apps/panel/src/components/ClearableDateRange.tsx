'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';

// Isti princip kao `ClearableTextField.tsx`, za par datuma (Od/Do) koji se prikazuju/brišu
// zajedno kao jedno logičko polje (24.8.2026, na zahtev vlasnika: "omogucite i ponistavanje
// filtera u pojedinačnim poljima").
export default function ClearableDateRange({
  nameFrom,
  nameTo,
  defaultFrom,
  defaultTo,
  className,
}: {
  nameFrom: string;
  nameTo: string;
  defaultFrom: string;
  defaultTo: string;
  className: string;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(Boolean(defaultFrom || defaultTo));

  function checkHasValue() {
    setHasValue(Boolean(fromRef.current?.value || toRef.current?.value));
  }

  return (
    <div className="flex items-center gap-1">
      <input ref={fromRef} type="date" name={nameFrom} defaultValue={defaultFrom} onChange={checkHasValue} className={className} />
      <input ref={toRef} type="date" name={nameTo} defaultValue={defaultTo} onChange={checkHasValue} className={className} />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            if (fromRef.current) fromRef.current.value = '';
            if (toRef.current) toRef.current.value = '';
            setHasValue(false);
            // Automatska primena (24.8.2026, na zahtev vlasnika) — vidi isti komentar u
            // ClearableTextField.tsx.
            fromRef.current?.closest('form')?.requestSubmit();
          }}
          title="Obriši ovo polje"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-faint hover:text-danger"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
