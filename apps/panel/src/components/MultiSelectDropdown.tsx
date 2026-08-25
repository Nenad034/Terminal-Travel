'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export interface MultiSelectOption {
  value: string;
  label: string;
}

// Dropdown panel sa čekboksovima (24.8.2026, na zahtev vlasnika: "ne svidja mi se ovako,
// napravide dropdown panel za polja i omogucite check box biranje" — poništava prethodni
// `<select multiple>` pokušaj istog dana, isti obrazac kao Ctrl/Cmd-klik liste, samo neugodan
// za korišćenje). Čekboksovi su PRAVI form-elementi sa istim `name`/`value` paru kao ranije —
// nativni GET `<form>` submit i dalje šalje ponovljen parametar (`?status=A&status=B`), isti
// oblik koji `GET /sales/bookings` (M5 spec §11/v1.59) već razume preko `{ in: [...] }` — NEMA
// izmene na API strani, samo drugi UI nad istim wire formatom.
// Dopuna (24.8.2026, na zahtev vlasnika: "omogucite i ponistavanje filtera u pojedinačnim
// poljima") — čekboksovi su CONTROLLED (`checked` prati `checked` Set state, ranije bili
// necontrolisani sa `defaultChecked`) da dugme "Obriši" unutar panela može stvarno da isprazni
// selekciju (`setChecked(new Set())`), ne samo vizuelno da prikaže "0 izabrano" dok DOM checkbox
// elementi ostaju markirani.
export default function MultiSelectDropdown({
  name,
  label,
  options,
  defaultValues,
}: {
  name: string;
  label: string;
  options: MultiSelectOption[];
  defaultValues: string[];
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(defaultValues));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(value: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[10px] text-ink-faint">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1.5 rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink outline-none focus:border-accent"
      >
        <span className="whitespace-nowrap">
          {checked.size === 0 ? 'svi' : `izabrano (${checked.size})`}
        </span>
        <Icon name="chevron-down" />
      </button>
      {/* Čekboksovi OSTAJU u DOM-u i kad je panel vizuelno zatvoren (`hidden`, ne uslovno
          renderovanje) — ovo je pravi `<form>` GET submit, ne klijentska navigacija; da su
          uklonjeni iz DOM-a dok su zatvoreni, njihove vrednosti se ne bi ni poslale pri
          submit-u (nestali element = nestao parametar), tiho gubeći već izabranu selekciju. */}
      <div className={`absolute top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-panel p-1.5 shadow-lg ${open ? '' : 'hidden'}`}>
        {checked.size > 0 && (
          <button
            type="button"
            onClick={() => {
              // Automatska primena (24.8.2026, na zahtev vlasnika) — `setChecked` je asinhrono
              // (React state), pa bi `requestSubmit()` odmah posle njega video JOŠ NEIZMENJEN
              // DOM (stare markirane čekboksove). Direktna DOM izmena (`.checked = false`) je
              // sinhrona — čita se ispravno pri submit-u koji sledi u istom kliku.
              ref.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((i) => {
                i.checked = false;
              });
              setChecked(new Set());
              ref.current?.closest('form')?.requestSubmit();
            }}
            className="mb-1 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-ink-faint hover:bg-panel2 hover:text-danger"
          >
            <Icon name="close" /> Obriši izbor
          </button>
        )}
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-dim hover:bg-panel2">
            <input type="checkbox" name={name} value={o.value} checked={checked.has(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
