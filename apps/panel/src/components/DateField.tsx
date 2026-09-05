'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Dopuna (29.8.2026, na zahtev vlasnika: "omogucite u svim poljima gde se bira datum da se
// bira u kalendaru ili da se ukucava na nacin 12082026 (12 avgust 2026)") — zamena za goli
// `<input type="date">` svuda u panelu (19 mesta, 10 fajlova). Native `type="date"` daje
// kalendar, ALI redosled segmenata dan/mesec pri direktnom kucanju zavisi od OS/browser
// lokala (u en-US redosledu bi "12082026" ispalo mesec=12/dan=08, ne dan=12/mesec=08 kako
// korisnik očekuje) — ovaj komponent fiksira DD-MM-GGGG redosled bez obzira na lokal, i sam
// crta kalendar (bez nove biblioteke, poglavlje 6 Master dokumenta) da kalendar-klik uvek radi
// identično u svakom browseru, ne oslanjajući se na `showPicker()` (nepodržano u Firefox/Safari).
//
// Podržava i formu (nativni GET/POST, `name`+`defaultValue`, isti obrazac kao dosadašnji
// `<input type="date">`) i kontrolisan režim (`value`+`onChange`, za React state kao u
// SearchCriteriaPopup.tsx) — ISO "yyyy-mm-dd" ostaje spoljni ugovor u oba slučaja, ništa dole
// niz tok (server actions, filter parsiranje) se ne menja.

export const MONTH_NAMES = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
export const WEEKDAY_LETTERS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N']; // ponedeljak prvi, sr-RS konvencija

// Izvezeno (5.9.2026) — `DateRangeField.tsx` (dva meseca, unos "od + broj noći") ponovo
// koristi isti DD-MM-GGGG maskirani unos, umesto da ga duplira.
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '').slice(0, 8);
}

// "12082026" -> "12.08.2026." (tačke se dodaju kako se kuca, ne čekaju kraj unosa).
export function digitsToDisplay(digits: string): string {
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  let out = day;
  if (digits.length > 2) out += `.${month}`;
  if (digits.length > 4) out += `.${year}`;
  if (digits.length === 8) out += '.';
  return out;
}

export function digitsToIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

export function isoToDigits(iso: string | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

export default function DateField({
  name,
  defaultValue,
  value,
  onChange,
  required,
  className,
  placeholder = 'dd.mm.gggg.',
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (isoValue: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const isControlled = value !== undefined;
  const [digits, setDigits] = useState(() => isoToDigits(isControlled ? value : defaultValue));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isControlled) setDigits(isoToDigits(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onOutside(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function commit(nextDigits: string) {
    setDigits(nextDigits);
    const iso = digitsToIso(nextDigits) ?? '';
    onChange?.(iso);
  }

  const iso = digitsToIso(digits) ?? '';
  const isInvalid = digits.length === 8 && !iso;

  return (
    // `w-full` na SPOLJNOM omotaču (ne samo unutrašnjem redu) — bez ovoga, kad je DateField
    // direktan flex item (npr. dva polja "od/do" u istom redu, ClearableDateRange.tsx), spoljni
    // div bez eksplicitne širine se skupi na sadržaj umesto da deli prostor sa susedom, jer
    // `width: 100%` na unutrašnjem redu ne "probija" naviše kroz roditelja bez definisane širine
    // (isti razlog zbog kog je goli `<input className="input">` ranije radio ispravno — imao je
    // `width: 100%` DIREKTNO na flex item-u, ne na unuci).
    <div ref={containerRef} className="relative w-full">
      <div className={`flex items-center ${className ?? 'input'} ${isInvalid ? 'border-danger' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          value={digitsToDisplay(digits)}
          placeholder={placeholder}
          onChange={(e) => commit(onlyDigits(e.target.value))}
          required={required}
          title={isInvalid ? 'Datum ne postoji (npr. 31. februar) — proverite dan/mesec' : undefined}
          className="w-full min-w-0 bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Otvori kalendar"
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-ink-faint hover:text-accent"
        >
          {/* Vendor `.codicon` pravilo forsira 21px (globals.css) — svuda gde ikona treba da
              stane u red teksta polja (isti obrazac kao CalendarHeader.tsx), preglašava se
              sa "!" da ne razvuče visinu reda iznad ostalih polja u istoj formi (nalaz uživo,
              29.8.2026, na zahtev vlasnika: "polja za filtriranje treba da budu iste visine"). */}
          <Icon name="calendar" className="!text-[13px]" />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={iso} />}
      {open && (
        <CalendarPopover
          iso={iso}
          onSelect={(selectedIso) => {
            commit(isoToDigits(selectedIso));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CalendarPopover({ iso, onSelect }: { iso: string; onSelect: (iso: string) => void }) {
  const today = new Date();
  const initial = iso ? new Date(`${iso}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-indeksirano

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // JS getDay(): 0=nedelja..6=subota → pomeraj na ponedeljak-prvi (sr-RS).
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <div className="animate-in fade-in slide-in-from-top-1 absolute z-50 mt-1.5 w-72 rounded-xl border border-border bg-panel p-3 shadow-xl duration-150">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-panel2 hover:text-ink"
        >
          <Icon name="chevron-left" />
        </button>
        <span className="text-[13px] font-semibold capitalize text-ink">
          {MONTH_NAMES[viewMonth]} {viewYear}.
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-panel2 hover:text-ink"
        >
          <Icon name="chevron-right" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={i} className="flex h-6 items-center justify-center">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayIso = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isSelected = dayIso === iso;
          const isToday = dayIso === todayIso;
          return (
            <div key={day} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelect(dayIso)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors ${
                  isSelected
                    ? 'bg-accent font-semibold text-accent-ink shadow-sm'
                    : isToday
                      ? 'font-semibold text-accent ring-1 ring-inset ring-accent hover:bg-accent-soft'
                      : 'text-ink-dim hover:bg-panel2 hover:text-ink'
                }`}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center border-t border-border pt-2">
        <button type="button" onClick={() => onSelect(todayIso)} className="text-[11px] font-medium text-accent hover:underline">
          Danas — {MONTH_NAMES[today.getMonth()]} {today.getDate()}.
        </button>
      </div>
    </div>
  );
}
