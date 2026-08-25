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
// za korišćenje). Čekboksovi ostaju PRAVI (necontrolisani) form-elementi sa istim `name`/`value`
// paru kao ranije — nativni GET `<form>` submit i dalje šalje ponovljen parametar
// (`?status=A&status=B`), isti oblik koji `GET /sales/bookings` (M5 spec §11/v1.59) već
// razume preko `{ in: [...] }` — NEMA izmene na API strani, samo drugi UI nad istim wire
// formatom. Lokalni `Set` prati broj izabranih SAMO radi oznake na dugmetu ("Status (2)").
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
    <div ref={ref} className="relative flex flex-col gap-0.5">
      <span className="text-[10px] text-ink-faint">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink outline-none focus:border-accent"
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
      <div className={`absolute top-full z-30 mt-1 max-h-52 w-56 overflow-y-auto rounded-lg border border-border bg-panel p-1.5 shadow-lg ${open ? '' : 'hidden'}`}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-dim hover:bg-panel2">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValues.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
