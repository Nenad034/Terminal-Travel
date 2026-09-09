'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { approveRow, rejectRow } from '../actions';

// M3 spec §4.2.3/§4.2.4 — pregled i potvrda redova.
//
// Dva pravila oblikuju ceo ekran:
//  1. potvrda reda UPISUJE cenu u ugovor — zato dugme nikad ne stoji samo, uz njega je iznos i
//     period koji se upisuje, i zato red bez poklopljenog hotela ne može da se potvrdi;
//  2. ocena poklapanja se PRIKAZUJE, ne skriva — red sa 61% izgleda isto kao red sa 100% ako se
//     broj ne vidi, a razlika je između ispravne cene i cene na pogrešnom hotelu.

export interface UvozRed {
  id: string;
  extractedHotelName: string;
  matchedProductId: string | null;
  matchConfidence: string | number | null;
  extractedRoomType: string;
  extractedBoardType: string;
  extractedOccupancy: string;
  extractedStayFrom: string;
  extractedStayTo: string;
  extractedPrice: number;
  extractedCurrency: string;
  extractedPriceBasis: string | null;
  extractedCribFeePerNight: number | null;
  extractedAgePricing: unknown;
  reviewStatus: 'PENDING' | 'CONFIRMED' | 'MANUALLY_MATCHED' | 'REJECTED';
}

const PRAG = 85;

const STATUS: Record<string, { tekst: string; varijanta: 'ok' | 'secondary' | 'danger' }> = {
  PENDING: { tekst: 'čeka odluku', varijanta: 'secondary' },
  CONFIRMED: { tekst: 'potvrđen', varijanta: 'ok' },
  MANUALLY_MATCHED: { tekst: 'potvrđen (ručno poklopljen)', varijanta: 'ok' },
  REJECTED: { tekst: 'odbijen', varijanta: 'danger' },
};

function datum(v: string): string {
  return new Date(v).toLocaleDateString('sr-RS');
}

/** Cena je u najmanjoj jedinici valute (M3 §2) — na ekranu se prikazuje kao novac. */
function novac(iznos: number, valuta: string): string {
  return `${(iznos / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${valuta}`;
}

export default function RowsReview({
  importId,
  rows,
  kandidati,
  canApprove,
}: {
  importId: string;
  rows: UvozRed[];
  kandidati: { id: string; label: string }[];
  canApprove: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
        Ovaj uvoz nema nijedan red.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <Red key={r.id} importId={importId} r={r} kandidati={kandidati} canApprove={canApprove} />
      ))}
    </div>
  );
}

function Red({
  importId,
  r,
  kandidati,
  canApprove,
}: {
  importId: string;
  r: UvozRed;
  kandidati: { id: string; label: string }[];
  canApprove: boolean;
}) {
  const ocena = r.matchConfidence != null ? Number(r.matchConfidence) : null;
  const [izabran, setIzabran] = useState(r.matchedProductId ?? '');
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, startTransition] = useTransition();
  const odluceno = r.reviewStatus !== 'PENDING';
  const s = STATUS[r.reviewStatus];

  const agePricing = Array.isArray(r.extractedAgePricing)
    ? (r.extractedAgePricing as {
        age_category: string;
        percentage?: number;
        flat_price?: number;
      }[])
    : [];

  return (
    <div
      className={`rounded-lg border border-border p-3 text-xs ${
        odluceno ? 'bg-sunken opacity-70' : 'bg-panel'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">
          {r.extractedHotelName} · {r.extractedRoomType} · {r.extractedBoardType}
        </span>
        <span className="flex items-center gap-1.5">
          {ocena != null && (
            <Badge variant={ocena >= PRAG ? 'ok' : 'secondary'}>
              poklapanje {Math.round(ocena)}%
            </Badge>
          )}
          <Badge variant={s.varijanta}>{s.tekst}</Badge>
        </span>
      </div>

      <div className="text-ink-faint">
        {datum(r.extractedStayFrom)} – {datum(r.extractedStayTo)} ·{' '}
        <strong className="text-ink">{novac(r.extractedPrice, r.extractedCurrency)}</strong>
        {r.extractedPriceBasis ? (
          <> · {r.extractedPriceBasis === 'PER_ROOM_PER_NIGHT' ? 'po sobi/noć' : 'po osobi/noć'}</>
        ) : (
          // §4.2.6 — model namerno vraća `null` kad osnova nije jasna; potvrda se onda odbija na
          // backendu, pa se to kaže ovde umesto da čovek klikne pa dobije grešku.
          <>
            {' '}
            ·{' '}
            <span className="text-danger">
              osnova cene nije prepoznata — red se ne može potvrditi
            </span>
          </>
        )}
        {r.extractedCribFeePerNight != null && (
          <> · krevetac {novac(r.extractedCribFeePerNight, r.extractedCurrency)}/noć</>
        )}
      </div>
      <div className="text-ink-faint">{r.extractedOccupancy}</div>

      {agePricing.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {agePricing.map((a, i) => (
            <Badge key={i} variant="outline">
              {a.age_category}: {a.percentage != null ? `${a.percentage}%` : a.flat_price}
            </Badge>
          ))}
        </div>
      )}

      {!odluceno && canApprove && (
        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <label className="flex min-w-[260px] flex-1 flex-col gap-0.5">
            <span className="text-[10px] text-ink-faint">
              Proizvod u katalogu{' '}
              {ocena != null && ocena < PRAG && (
                <span className="text-warn">— predlog ispod praga, proverite pre potvrde</span>
              )}
            </span>
            <select
              value={izabran}
              onChange={(e) => setIzabran(e.target.value)}
              className="input text-xs"
            >
              <option value="">— nije izabran —</option>
              {kandidati.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            size="sm"
            disabled={radi || !izabran || !r.extractedPriceBasis}
            onClick={() =>
              startTransition(async () => {
                setGreska(null);
                const rez = await approveRow(
                  importId,
                  r.id,
                  izabran !== r.matchedProductId ? izabran : undefined,
                );
                if (rez.error) setGreska(rez.error);
              })
            }
          >
            {radi ? 'Upisujem…' : 'Potvrdi i upiši cenu'}
          </Button>

          <button
            type="button"
            disabled={radi}
            onClick={() => startTransition(() => rejectRow(importId, r.id))}
            className="flex items-center gap-1 rounded px-2 py-1.5 text-[11px] text-ink-faint hover:text-danger"
          >
            <Icon name="close" /> odbaci red
          </button>
        </div>
      )}

      {greska && <p className="mt-2 rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>}
    </div>
  );
}
