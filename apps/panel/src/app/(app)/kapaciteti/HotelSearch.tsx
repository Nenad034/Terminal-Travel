'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import type { HotelSearchHit } from '@/app/api/capacity/search-hotels/route';

// M17 §4b.0a — prediktivna pretraga hotela na vrhu ekrana Kapaciteti. Uz naziv OBAVEZNO
// kategorija, mesto i država: hoteli istog imena postoje u više zemalja (M3 §2.9f), naziv sam po
// sebi nije identitet. Izbor vodi na mrežu TOG ugovora (nikad „svih 2000 odjednom", §4b.0);
// hotel bez ugovora nije slepa ulica — nudi „napravi ugovor" (§4b.0b).

const TYPE_LABEL: Record<string, string> = {
  ACCOMMODATION: 'smeštaj',
  PACKAGE: 'paket',
  EXCURSION: 'izlet',
  TRANSFER: 'transfer',
  FLIGHT: 'let',
  TRANSPORT: 'prevoz',
  EVENT: 'događaj',
  TICKET: 'ulaznica',
  INSURANCE: 'osiguranje',
};

export default function HotelSearch({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<HotelSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const r = await fetch(`/api/capacity/search-hotels?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        setHits((await r.json()) as HotelSearchHit[]);
        setError(null);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Pretraga trenutno nije dostupna.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function izaberi(h: HotelSearchHit) {
    if (!h.contractId) return;
    setOpen(false);
    router.push(`/kapaciteti?contractId=${h.contractId}&from=${from}&to=${to}`);
  }

  return (
    <div className="relative">
      <label className="flex flex-col gap-0.5">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">
          Hotel / objekat — pretraga kataloga
        </span>
        <span className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" />
          </span>
          <input
            id="capacity-hotel-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="počnite da kucate naziv (npr. Splendid) — prikazuje se mesto i država"
            autoComplete="off"
            className="h-9 w-full rounded border border-border bg-bg pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint"
          />
        </span>
      </label>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      {open && q.trim().length >= 2 && (
        <ul
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-border bg-panel shadow-lg"
          role="listbox"
        >
          {loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-faint">Tražim…</li>
          )}
          {!loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-faint">
              Nema objekta sa tim nazivom u katalogu.
            </li>
          )}
          {hits.map((h) => {
            const mesto = [h.destinationCity, h.destinationCountry].filter(Boolean).join(', ');
            const izvori = [
              h.contractId
                ? `ugovor ${h.contractNumber ?? ''}${h.contractStatus && h.contractStatus !== 'ACTIVE' ? ` (${h.contractStatus})` : ''}`.trim()
                : null,
              h.apiProvider ? `API ${h.apiProvider}` : null,
            ].filter(Boolean);
            return (
              <li
                key={h.productId}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => izaberi(h)}
                className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-xs ${
                  h.contractId ? 'cursor-pointer hover:bg-sunken' : ''
                }`}
              >
                <span className="min-w-[220px] font-medium text-ink">
                  {h.name}
                  {h.stars ? (
                    <span className="ml-1 text-warn" aria-label={`${h.stars} zvezdica`}>
                      {'★'.repeat(h.stars)}
                    </span>
                  ) : (
                    <span className="ml-1 text-ink-faint">{TYPE_LABEL[h.type] ?? h.type}</span>
                  )}
                </span>
                <span className="text-ink-dim">{mesto || 'bez destinacije'}</span>
                <span className="ml-auto text-ink-faint">
                  {izvori.length > 0 ? (
                    izvori.join(' + ')
                  ) : (
                    <>
                      nema izvora ·{' '}
                      <Link
                        href="/ugovori/novi"
                        className="text-accent-strong hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        napravi ugovor za ovaj hotel →
                      </Link>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
