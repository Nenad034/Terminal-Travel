'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { useSearchState, diffIsEmpty, type OfferSnapshot, type SearchDiff } from './SearchStateContext';
import { useSelection } from './SelectionContext';

// M5 spec §3.0g.3 — "Osvežavanje mora da prijavi razliku, nikad da tiho zameni cenu".
// Najozbiljnije pravilo na ovom ekranu, i jedini razlog zašto je ovo posebna komponenta:
// ponude iz živih izvora imaju rok (`quote_expires_at`) i cena se između dva poziva stvarno
// menja. Ako agent gostu izgovori cenu, pa klikne "Osveži podatke", pa se broj tiho promeni —
// agencija je upravo dala pogrešnu cenu preko telefona i niko to nije primetio.
//
// Poređenje je KLIJENTSKO, bez novog endpointa (`GET /search` se poziva nepromenjen), po ključu
// `product_id` + `rate_line_id`/`provider_quote_reference` — istom ključu koji već koristi
// selekcija u §3.0e.3 (`@/lib/search-offer-key`).

function money(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

export default function SearchRefreshNotice({ offers }: { offers: OfferSnapshot[] }) {
  const sp = useSearchParams();
  const { recordOffers, diff, clearDiff } = useSearchState();
  const { markPriceChanges } = useSelection();
  const [seen, setSeen] = useState<SearchDiff | null>(null);

  const typeKey = [...sp.getAll('type')].sort().join('+');
  const offersFingerprint = offers.map((o) => `${o.key}=${o.price}`).join('|');

  useEffect(() => {
    const result = recordOffers(typeKey, offers);
    if (!result) return;
    setSeen(result);

    // Ista promena mora da se vidi i NA STAVCI u desnom panelu (§3.0g.3, poslednji pasus).
    const changes: Record<string, { previous: number; current: number } | 'GONE'> = {};
    for (const c of result.changed) changes[c.key] = { previous: c.previous, current: c.current };
    for (const g of result.gone) changes[g.key] = 'GONE';
    markPriceChanges(changes);
  }, [typeKey, offersFingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Promenjeni redovi ostaju vidljivo obeleženi dok korisnik ne pređe dalje (§3.0g.3). Rezultati
  // se crtaju na serveru, pa se obeležavanje radi nad već iscrtanim redovima preko `data-offer-key`
  // — jeftinije nego pretvarati ceo prikaz rezultata u klijentsku komponentu samo zbog ovoga.
  useEffect(() => {
    const marked: Element[] = [];
    if (diff) {
      for (const c of [...diff.changed, ...diff.added]) {
        document.querySelectorAll(`[data-offer-key="${CSS.escape(c.key)}"]`).forEach((el) => {
          el.classList.add('ring-1', 'ring-warn');
          marked.push(el);
        });
      }
    }
    return () => marked.forEach((el) => el.classList.remove('ring-1', 'ring-warn'));
  }, [diff]);

  const shown = diff ?? seen;
  if (!shown) return null;

  if (diffIsEmpty(shown)) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-xs text-ink-dim">
        <Icon name="check" className="text-ok" />
        Osveženo — nijedna cena se nije promenila.
        <button onClick={() => { clearDiff(); setSeen(null); }} className="ml-auto text-ink-faint hover:text-ink" title="Zatvori">
          <Icon name="close" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-warn bg-warn-bg px-3 py-2 text-xs text-ink">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <Icon name="warning" className="text-warn" />
        Podaci su osveženi — cene su se promenile. Proverite pre nego što ih izgovorite gostu.
        <button onClick={() => { clearDiff(); setSeen(null); }} className="ml-auto font-normal text-ink-faint hover:text-ink" title="Zatvori">
          <Icon name="close" />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {shown.changed.map((c) => (
          <li key={c.key}>
            <span className="text-ink-dim">{c.label}:</span>{' '}
            <span className="line-through text-ink-faint">{money(c.previous, c.currency)}</span>{' → '}
            <span className={`font-mono font-semibold ${c.current > c.previous ? 'text-danger' : 'text-ok'}`}>
              {money(c.current, c.currency)}
            </span>{' '}
            <span className="text-ink-faint">({c.current > c.previous ? 'poskupelo' : 'pojeftinilo'})</span>
          </li>
        ))}
        {shown.gone.map((g) => (
          <li key={g.key}>
            <span className="text-ink-dim">{g.label}:</span>{' '}
            <span className="font-semibold text-danger">više nije dostupno</span>{' '}
            <span className="text-ink-faint">(bilo {money(g.previous, g.currency)})</span>
          </li>
        ))}
        {shown.added.map((a) => (
          <li key={a.key}>
            <span className="text-ink-dim">{a.label}:</span> <span className="font-semibold text-ok">nova ponuda</span>{' '}
            <span className="font-mono">{money(a.current, a.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
