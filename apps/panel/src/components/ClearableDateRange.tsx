'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import DateField from './DateField';

// Isti princip kao `ClearableTextField.tsx`, za par datuma (Od/Do) koji se prikazuju/brišu
// zajedno kao jedno logičko polje (24.8.2026, na zahtev vlasnika: "omogucite i ponistavanje
// filtera u pojedinačnim poljima"). Dopunjeno 29.8.2026 (na zahtev vlasnika: kalendar/kucanje
// "12082026") — `DateField.tsx` u kontrolisanom režimu umesto golog `<input type="date">`;
// kontejner (ne sam input) nosi ref da "×" i dalje ume da nađe roditeljsku formu za auto-submit,
// pošto DateField unutra nema jedan native input na koji bi se to oslonilo.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const hasValue = Boolean(from || to);

  return (
    <div ref={containerRef} className="flex items-center gap-1">
      <DateField name={nameFrom} value={from} onChange={setFrom} className={className} />
      <DateField name={nameTo} value={to} onChange={setTo} className={className} />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            setFrom('');
            setTo('');
            // Automatska primena (24.8.2026, na zahtev vlasnika) — vidi isti komentar u
            // ClearableTextField.tsx.
            containerRef.current?.closest('form')?.requestSubmit();
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
