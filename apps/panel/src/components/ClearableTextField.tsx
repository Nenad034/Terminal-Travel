'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';

// Poništavanje po polju (24.8.2026, na zahtev vlasnika: "Omogucite i ponistavanje filtera u
// pojedinačnim poljima") — inline "×" unutar polja, vidljivo SAMO kad polje ima vrednost.
// Uncontrolled ulaz (ref, ne React state za sam tekst) — polje ostaje obično `<input>` unutar
// istog nativnog GET `<form>`-a (M5 spec §11/v1.54), klik na "×" samo prazni DOM vrednost i lokalno
// stanje koje kontroliše da li se dugme uopšte prikazuje.
export default function ClearableTextField({
  name,
  type = 'text',
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  type?: string;
  defaultValue: string;
  placeholder?: string;
  className: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(Boolean(defaultValue));

  return (
    <div className="relative">
      <input
        ref={ref}
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(e) => setHasValue(Boolean(e.target.value))}
        className={hasValue ? `${className} pr-6` : className}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            if (ref.current) ref.current.value = '';
            setHasValue(false);
            // Automatska primena (24.8.2026, na zahtev vlasnika) — brisanje ne pokreće pravi
            // DOM 'change' događaj (samo React state + direktna DOM izmena), pa se ovde
            // eksplicitno traži submit umesto da se osloni na delegovani onChange u RealFilterBar.tsx.
            ref.current?.closest('form')?.requestSubmit();
          }}
          title="Obriši ovo polje"
          className="absolute right-1 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-ink-faint hover:text-danger"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
