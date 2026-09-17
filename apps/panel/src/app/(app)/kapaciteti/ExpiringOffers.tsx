'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acknowledgeExpiryNotice, type CapacityFormState } from './actions';

// M3 spec §4.9.2 (prag INTERNAL) / M17 §4b.0 stanje 1 — prvi red radnog spiska kapaciteta:
// „akcija ističe za N dana". Ugovarač zove hotel i pita da li produžava, PRE nego što marketing
// (prag od 7 dana) krene. Ceo radni spisak (`/capacity/work-queue`: prekoračenja, blokade,
// stop-sale, 0–2 jedinice) još nije napravljen — ovo je njegov prvi, samostalan blok.

export interface ExpiryNoticeRow {
  id: string;
  contractId: string;
  productName: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  offerKind: 'EARLY_BOOKING' | 'FREE_NIGHTS' | 'DISCOUNT' | 'FIRST_TRANCHE';
  discountSummary: string;
  bookingTo: string;
  stayFrom: string | null;
  stayTo: string | null;
}

const KIND_LABEL: Record<ExpiryNoticeRow['offerKind'], string> = {
  EARLY_BOOKING: 'rani buking',
  FREE_NIGHTS: 'gratis noći',
  DISCOUNT: 'popust',
  FIRST_TRANCHE: 'cena prve tranše',
};

function datum(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** Dana do roka, računato na SERVERU (`danas` stiže kao prop) — dva rendera ne smeju dati dva broja. */
function daysLeft(bookingTo: string, danas: string): number {
  return Math.round((Date.parse(bookingTo) - Date.parse(danas)) / 86_400_000);
}

export default function ExpiringOffers({
  rows,
  danas,
  canAcknowledge,
}: {
  rows: ExpiryNoticeRow[];
  danas: string;
  canAcknowledge: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section
      className="rounded-xl border border-border bg-panel p-4"
      aria-label="Akcije pred istek"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Akcije kojima ističe rok</h2>
        <span className="text-[11px] text-ink-faint">
          {rows.length} {rows.length === 1 ? 'stavka' : 'stavki'} · pozovite hotel pre nego što
          marketing krene (7 dana)
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <Red key={r.id} r={r} danas={danas} canAcknowledge={canAcknowledge} />
        ))}
      </ul>
    </section>
  );
}

function Red({
  r,
  danas,
  canAcknowledge,
}: {
  r: ExpiryNoticeRow;
  danas: string;
  canAcknowledge: boolean;
}) {
  const [state, action, pending] = useActionState<CapacityFormState, FormData>(
    acknowledgeExpiryNotice,
    { error: null, ok: null },
  );
  const n = daysLeft(r.bookingTo, danas);
  const rok =
    n <= 0
      ? 'ističe danas'
      : n === 1
        ? 'ističe sutra'
        : `ističe ${datum(r.bookingTo)} (za ${n} dana)`;
  const mesto = [r.destinationCity, r.destinationCountry].filter(Boolean).join(', ');
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
      <span className="min-w-[180px] font-medium text-ink">
        {r.productName ?? 'Ugovor bez proizvoda u katalogu'}
        {mesto && <span className="ml-1 font-normal text-ink-faint">· {mesto}</span>}
      </span>
      <span className="rounded bg-sunken px-1.5 py-0.5 text-ink-dim">
        {KIND_LABEL[r.offerKind]}
      </span>
      <span className="text-ink">{r.discountSummary}</span>
      {r.stayFrom && r.stayTo && (
        <span className="text-ink-faint">
          boravak {datum(r.stayFrom)}–{datum(r.stayTo)}
        </span>
      )}
      <span className={n <= 7 ? 'font-semibold text-danger' : 'font-semibold text-warn'}>
        {rok}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Link
          href={`/ugovori/${r.contractId}/cenovnik`}
          className="text-accent-strong hover:underline"
        >
          otvori cenovnik →
        </Link>
        {canAcknowledge && (
          <form action={action}>
            <input type="hidden" name="id" value={r.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-border px-2 py-0.5 text-ink-dim hover:bg-sunken disabled:opacity-50"
            >
              {pending ? '…' : 'video'}
            </button>
          </form>
        )}
        {state.error && <span className="text-danger">{state.error}</span>}
      </span>
    </li>
  );
}
