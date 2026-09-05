'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { MONTH_NAMES, WEEKDAY_LETTERS, onlyDigits, digitsToDisplay, digitsToIso, isoToDigits } from './DateField';

// M5 spec §3.0c.2/§3.0g.6 — polje "od/do" (5.9.2026, vlasnikov zahtev: "umesto dva polja jedno,
// kalendar sa dva meseca jedan do drugog, +3/+5/+7 dana, broj noćenja, i ukucavanje početnog
// datuma + broja noći"). Zamenjuje dva odvojena `DateField` (jedan "od", jedan "do") jednim
// dugmetom — štedi red prostora u formi, isti podaci (`stayFrom`/`stayTo`, ISO "yyyy-mm-dd")
// idu dalje nepromenjeno.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

function nightsBetween(from: string, to: string): number | null {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}

function todayIso(): string {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth(), t.getDate());
}

// Uprošćena sr-RS pluralizacija ("1 noć" / "3 noći" / "7 noćenja") — pokriva realan opseg
// pretrage (do ~30 noćenja), ne pretenduje na potpunu gramatičku ispravnost za svaki broj.
function nightsLabel(n: number): string {
  if (n === 1) return '1 noć';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} noći`;
  return `${n} noćenja`;
}

export default function DateRangeField({
  fromValue,
  toValue,
  onChange,
  className,
  showNightsAndQuick = true,
  nameFrom,
  nameTo,
}: {
  fromValue: string;
  toValue: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  /** `false` za opsege koji NISU "boravak" (npr. datum dolaska od/do, datum odlaska od/do,
   * 5.9.2026, vlasnikov zahtev: "ne trebaju nam broj noćenja i +- broj dana") — sakriva broj
   * noćenja u oznaci/popover-u i red "+3/+5/+7 dana", ostaje isti dvomesečni kalendar sa
   * klikom na opseg i ručnim unosom početka/kraja preko dva odvojena datuma. */
  showNightsAndQuick?: boolean;
  /** Skrivena polja za PRAVU (native) GET formu — isti obrazac kao `DateField.tsx`/
   * `ClearableDateRange.tsx` (5.9.2026, kalendar rezervacija koristi native form, ne React
   * state + `router.push` kao `SearchCriteriaForm.tsx`). Bez ovoga komponenta radi samo u
   * kontrolisanom režimu (vrednost ide kroz `onChange`, ne kroz sam `<form>` submit). */
  nameFrom?: string;
  nameTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function selectDay(dayIso: string) {
    // Bez početka, ili već zaokružen par (oba kraja postavljena) — novi klik počinje NOVU
    // selekciju, isti obrazac kao svaki drugi opsežni kalendar (npr. Google kalendar rezervacija).
    if (!fromValue || (fromValue && toValue)) {
      onChange(dayIso, '');
      return;
    }
    // Drugi klik: ako je pre početka, zamenjuje početak (korisnik je "krenuo unazad").
    if (dayIso < fromValue) {
      onChange(dayIso, fromValue);
    } else {
      onChange(fromValue, dayIso);
      setOpen(false); // opseg zaokružen — isto ponašanje kao DateField (bira i zatvara)
    }
  }

  function applyQuickNights(n: number) {
    const start = fromValue || todayIso();
    onChange(start, addDays(start, n));
  }

  function setTypedStart(iso: string) {
    if (!iso) {
      onChange('', '');
      return;
    }
    const currentNights = nightsBetween(fromValue, toValue);
    if (currentNights && currentNights > 0) onChange(iso, addDays(iso, currentNights));
    else onChange(iso, toValue && toValue > iso ? toValue : '');
  }

  function setTypedNights(n: number) {
    const start = fromValue || todayIso();
    onChange(start, addDays(start, n));
  }

  function setTypedEnd(iso: string) {
    onChange(fromValue, iso);
  }

  const nights = nightsBetween(fromValue, toValue);
  const label =
    fromValue && toValue
      ? `${formatDisplay(fromValue)} – ${formatDisplay(toValue)}${showNightsAndQuick && nights ? ` · ${nightsLabel(nights)}` : ''}`
      : fromValue
        ? `${formatDisplay(fromValue)} – izaberite datum`
        : 'izaberite period';

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 ${className ?? 'input'}`}
      >
        <Icon name="calendar" className="!text-[13px] flex-shrink-0 text-ink-faint" />
        <span className={`truncate text-left ${fromValue ? '' : 'text-ink-faint'}`}>{label}</span>
      </button>
      {nameFrom && <input type="hidden" name={nameFrom} value={fromValue} />}
      {nameTo && <input type="hidden" name={nameTo} value={toValue} />}
      {open && (
        <DateRangePopover
          fromValue={fromValue}
          toValue={toValue}
          nights={nights}
          showNightsAndQuick={showNightsAndQuick}
          onSelectDay={selectDay}
          onQuickNights={applyQuickNights}
          onTypedStart={setTypedStart}
          onTypedNights={setTypedNights}
          onTypedEnd={setTypedEnd}
        />
      )}
    </div>
  );
}

function DateRangePopover({
  fromValue,
  toValue,
  nights,
  showNightsAndQuick,
  onSelectDay,
  onQuickNights,
  onTypedStart,
  onTypedNights,
  onTypedEnd,
}: {
  fromValue: string;
  toValue: string;
  nights: number | null;
  showNightsAndQuick: boolean;
  onSelectDay: (iso: string) => void;
  onQuickNights: (n: number) => void;
  onTypedStart: (iso: string) => void;
  onTypedNights: (n: number) => void;
  onTypedEnd: (iso: string) => void;
}) {
  const base = parseIso(fromValue) ?? new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [startDigits, setStartDigits] = useState(() => isoToDigits(fromValue));
  const [endDigits, setEndDigits] = useState(() => isoToDigits(toValue));
  const [nightsDraft, setNightsDraft] = useState(nights ? String(nights) : '');

  useEffect(() => setStartDigits(isoToDigits(fromValue)), [fromValue]);
  useEffect(() => setEndDigits(isoToDigits(toValue)), [toValue]);
  useEffect(() => setNightsDraft(nights ? String(nights) : ''), [nights]);

  // Levi mesec je "tekući pogled", desni je uvek sledeći — jedan par strelica pomera OBA
  // zajedno (5.9.2026, vlasnikov zahtev: "dva meseca jedan do drugog... biranje meseca
  // strelicama"), isti obrazac kao svaki poznat opsežni kalendar (Booking.com i sl.).
  function shiftMonth(delta: number) {
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

  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  return (
    <div className="animate-in fade-in slide-in-from-top-1 absolute z-50 mt-1.5 w-[min(560px,90vw)] rounded-xl border border-border bg-panel p-3 shadow-xl duration-150">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-panel2 hover:text-ink"
        >
          <Icon name="chevron-left" />
        </button>
        <div className="flex flex-1 justify-around text-[13px] font-semibold capitalize text-ink">
          <span>
            {MONTH_NAMES[viewMonth]} {viewYear}.
          </span>
          <span>
            {MONTH_NAMES[rightMonth]} {rightYear}.
          </span>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-panel2 hover:text-ink"
        >
          <Icon name="chevron-right" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MonthGrid year={viewYear} month={viewMonth} fromValue={fromValue} toValue={toValue} onSelectDay={onSelectDay} />
        <MonthGrid year={rightYear} month={rightMonth} fromValue={fromValue} toValue={toValue} onSelectDay={onSelectDay} />
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        {showNightsAndQuick ? (
          <>
            {/* Ukucavanje kao prečica (5.9.2026, vlasnikov zahtev: "ko želi može da ukuca početni
                datum, da ukuca broj noći kako bi se izdefinisao datum do") — isti DD-MM-GGGG
                maskiran unos kao DateField, plus broj noći; menjanje bilo kog od dva polja odmah
                preračunava drugi kraj opsega. */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
              <span>početak</span>
              <input
                type="text"
                inputMode="numeric"
                value={digitsToDisplay(startDigits)}
                placeholder="dd.mm.gggg."
                onChange={(e) => {
                  const digits = onlyDigits(e.target.value);
                  setStartDigits(digits);
                  const iso = digitsToIso(digits);
                  if (iso) onTypedStart(iso);
                  else if (digits.length === 0) onTypedStart('');
                }}
                className="input w-24 !py-1 text-center text-ink"
              />
              <span>broj noći</span>
              <input
                type="number"
                min={1}
                max={60}
                value={nightsDraft}
                onChange={(e) => setNightsDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(nightsDraft);
                  if (n > 0) onTypedNights(n);
                }}
                className="input w-16 !py-1 text-center text-ink"
              />
              {nights != null && nights > 0 && <span className="ml-auto font-medium text-ink">{nightsLabel(nights)}</span>}
            </div>
            <div className="flex gap-1.5">
              {[3, 5, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onQuickNights(n)}
                  className="flex-1 rounded-lg border border-border bg-panel2 py-1 text-[11px] font-medium text-ink-dim hover:border-accent hover:text-accent-strong"
                >
                  +{n} dana
                </button>
              ))}
            </div>
          </>
        ) : (
          // Bez "broj noći"/brzih dana (5.9.2026, vlasnikov zahtev: "ne trebaju nam broj
          // noćenja i +- broj dana") — ovo su nezavisne granice (npr. dolazak od/do), ne
          // "početak + trajanje", pa se oba kraja unose direktno kao datumi.
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
            <span>od</span>
            <input
              type="text"
              inputMode="numeric"
              value={digitsToDisplay(startDigits)}
              placeholder="dd.mm.gggg."
              onChange={(e) => {
                const digits = onlyDigits(e.target.value);
                setStartDigits(digits);
                const iso = digitsToIso(digits);
                if (iso) onTypedStart(iso);
                else if (digits.length === 0) onTypedStart('');
              }}
              className="input w-24 !py-1 text-center text-ink"
            />
            <span>do</span>
            <input
              type="text"
              inputMode="numeric"
              value={digitsToDisplay(endDigits)}
              placeholder="dd.mm.gggg."
              onChange={(e) => {
                const digits = onlyDigits(e.target.value);
                setEndDigits(digits);
                const iso = digitsToIso(digits);
                if (iso) onTypedEnd(iso);
                else if (digits.length === 0) onTypedEnd('');
              }}
              className="input w-24 !py-1 text-center text-ink"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  fromValue,
  toValue,
  onSelectDay,
}: {
  year: number;
  month: number;
  fromValue: string;
  toValue: string;
  onSelectDay: (iso: string) => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // ponedeljak prvi, sr-RS
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIsoStr = todayIso();

  return (
    <div>
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
          const dayIso = toIso(year, month, day);
          const isFrom = dayIso === fromValue;
          const isTo = dayIso === toValue;
          const inRange = Boolean(fromValue && toValue && dayIso > fromValue && dayIso < toValue);
          const isToday = dayIso === todayIsoStr;
          // Krajevi opsega dobijaju pun akcenat i pravu ivicu (rounded-full), unutrašnjost
          // opsega deli istu blagu akcentnu podlogu bez zaobljenja — isti "povezan" utisak kao
          // svaki poznat opsežni kalendar, umesto niza nepovezanih pojedinačnih izbora.
          return (
            <div key={day} className={`flex items-center justify-center ${inRange ? 'bg-accent-soft' : ''}`}>
              <button
                type="button"
                onClick={() => onSelectDay(dayIso)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors ${
                  isFrom || isTo
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
    </div>
  );
}
