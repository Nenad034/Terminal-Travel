'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// M5 spec §3.0c.2 — polje sa predlaganjem dok se kuca, za državu i destinaciju u formi
// pretrage. Oba koraka su specificirana od 17.8.2026, ali endpointi (`GET /sales/search/
// countries` i `/destinations`) nikad nisu bili napravljeni; dodati 2.9.2026 zajedno sa ovim
// poljem, na vlasnikov zahtev ("kada se kuca Grčka da se u polju za mesto odmah pojave nazivi
// svih destinacija").
//
// Dva pravila koja komponentu razlikuju od običnog padajućeg menija:
//  1. **Slobodan unos ostaje moguć.** Ono što je otkucano je vrednost, i kad se ne poklapa ni
//     sa jednim predlogom — vlasnikov zahtev: "ukoliko nema neke destinacije, kucanjem tačnog
//     naziva da se dođe do nje". Padajući meni bi tu vrednost odbacio.
//  2. **Lista se otvara i bez kucanja**, na fokus, kad izvor ume da vrati pun spisak (kod
//     destinacija: čim je država izabrana). Korisnik ne mora da pogađa prvo slovo.

export interface Suggestion {
  /** Vrednost koja ide u polje kad se stavka izabere. */
  value: string;
  /** Glavni tekst u listi. */
  label: string;
  /** Sitniji tekst desno (npr. broj proizvoda ili grad hotela). */
  hint?: string;
  /** Prečica na konkretan proizvod (M5 §3.0c.2) — javlja se roditelju preko `onPickProduct`. */
  productId?: string;
}

export default function SuggestField({
  value,
  onChange,
  fetchSuggestions,
  onPickProduct,
  placeholder,
  required,
  disabled,
  disabledHint,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Vraća predloge za trenutni tekst; prazan tekst znači "ponudi sve što imaš". */
  fetchSuggestions: (q: string) => Promise<Suggestion[]>;
  onPickProduct?: (productId: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Objašnjenje zašto je polje zaključano — bolje od nemog sivog polja. */
  disabledHint?: string;
  /** Override za izgled input polja (5.9.2026, dopuna) — podrazumevano `input w-full` (sopstvena
   * ivica/pozadina), ali kad se polje ugnežđuje u tuđ omotač koji već crta ivicu (npr.
   * `izvestaji` filter red — jedan zajednički okvir sa nazivom polja unutra), treba providan
   * unos bez druge ivice preko prve. */
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Raste sa svakim upitom — sprečava da spor stariji odgovor prepiše noviji. */
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    // Kratko odlaganje da kucanje ne pošalje poziv na svako slovo.
    const timer = setTimeout(async () => {
      try {
        const result = await fetchSuggestions(value);
        if (seq === requestSeq.current) setItems(result);
      } catch {
        if (seq === requestSeq.current) setItems([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [value, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Klik van polja zatvara listu; bez ovoga ostaje otvorena preko ostatka forme.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function pick(item: Suggestion) {
    onChange(item.value);
    if (item.productId) onPickProduct?.(item.productId);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && active >= 0 && items[active]) {
      // Enter bira označen predlog; bez označenog reda Enter NE otima unos — ostaje ono
      // što je korisnik otkucao (pravilo 1 iz zaglavlja).
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? disabledHint : placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className={`disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName ?? 'input w-full'}`}
      />
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg">
          {loading && <p className="px-2 py-1.5 text-[11px] text-ink-faint">tražim…</p>}
          {!loading && items.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-ink-faint">
              Nema predloga — ono što otkucate svejedno važi kao unos.
            </p>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.productId ?? item.value}-${i}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(item)}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs ${
                i === active ? 'bg-accent-soft text-accent-strong' : 'text-ink hover:bg-panel2'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {item.productId && <Icon name="home" className="flex-shrink-0 text-ink-faint" />}
                <span className="truncate">{item.label}</span>
              </span>
              {item.hint && <span className="flex-shrink-0 text-[11px] text-ink-faint">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
