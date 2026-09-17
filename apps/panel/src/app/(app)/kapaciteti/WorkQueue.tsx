'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acknowledgeExpiryNotice, type CapacityFormState } from './actions';

// M17 §4b.0 (stanje 1) / M3 §6 `GET /capacity/work-queue` — radni spisak: samo ono što traži
// pažnju danas. Prazan spisak je DOBRA VEST i mora tako da izgleda (zamka 7.2) — rečenica, ne
// prazan okvir. Redovi vode na mesto gde se radi: mreža tog hotela (kapacitet/blokada/stop-sale)
// ili cenovnik (akcija pred istek, da se produžena unese kao nova stavka).

export type WorkQueueKind =
  | 'OVERBOOKED'
  | 'BLOCK_EXPIRING'
  | 'STOP_SALE_ENDING'
  | 'RELEASE_DUE'
  | 'LOW_UNITS'
  | 'OFFER_EXPIRING';

export interface WorkQueueItem {
  kind: WorkQueueKind;
  date: string;
  contractId: string;
  contractPeriodId: string | null;
  productName: string | null;
  supplierName: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  roomType: string | null;
  detail: string;
  value: number | null;
  noticeId: string | null;
}

const KIND: Record<WorkQueueKind, { label: string; tone: string }> = {
  OVERBOOKED: { label: 'prekoračenje', tone: 'bg-danger-bg text-danger' },
  BLOCK_EXPIRING: { label: 'blokada ističe', tone: 'bg-warn-bg text-warn' },
  STOP_SALE_ENDING: { label: 'stop-sale se otvara', tone: 'bg-accent-soft text-accent-strong' },
  RELEASE_DUE: { label: 'rok povrata', tone: 'bg-warn-bg text-warn' },
  LOW_UNITS: { label: '0–2 jedinice', tone: 'bg-warn-bg text-warn' },
  OFFER_EXPIRING: { label: 'akcija ističe', tone: 'bg-sunken text-ink-dim' },
};

function datum(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}.${m}.`;
}

/** Dana do datuma — `danas` stiže sa servera (dva rendera ne smeju dati dva broja). */
function zaDana(iso: string, danas: string): string {
  const n = Math.round((Date.parse(iso) - Date.parse(danas)) / 86_400_000);
  if (n < 0) return `pre ${-n} ${-n === 1 ? 'dan' : 'dana'}`;
  if (n === 0) return 'danas';
  if (n === 1) return 'sutra';
  return `za ${n} dana`;
}

function plus30(iso: string): string {
  return new Date(Date.parse(iso) + 30 * 86_400_000).toISOString().slice(0, 10);
}

export default function WorkQueue({
  items,
  danas,
  canAcknowledge,
}: {
  items: WorkQueueItem[];
  danas: string;
  canAcknowledge: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-panel p-4" aria-label="Radni spisak">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Šta traži pažnju danas</h2>
        <span className="text-[11px] text-ink-faint">
          {items.length === 0
            ? datum(danas)
            : `${items.length} ${items.length === 1 ? 'stavka' : items.length < 5 ? 'stavke' : 'stavki'} · prekoračenja, blokade, stop-sale, rokovi povrata, 0–2 jedinice, akcije pred istek`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-ink-dim">
          Ništa ne traži pažnju danas — kapaciteti nisu prekoračeni, nijedna blokada ni akcija ne
          ističe, nema sobe sa 0–2 jedinice u narednih 30 dana.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <Red
              key={`${it.kind}-${it.contractPeriodId ?? it.contractId}-${it.date}-${i}`}
              it={it}
              danas={danas}
              canAcknowledge={canAcknowledge}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Red({
  it,
  danas,
  canAcknowledge,
}: {
  it: WorkQueueItem;
  danas: string;
  canAcknowledge: boolean;
}) {
  const [state, action, pending] = useActionState<CapacityFormState, FormData>(
    acknowledgeExpiryNotice,
    { error: null, ok: null },
  );
  const k = KIND[it.kind];
  const mesto = [it.destinationCity, it.destinationCountry].filter(Boolean).join(', ');
  const hitno =
    it.kind === 'OVERBOOKED' || Date.parse(it.date) - Date.parse(danas) <= 2 * 86_400_000;
  const od = it.date < danas ? danas : it.date;
  const gridHref = `/kapaciteti?contractId=${it.contractId}&from=${od}&to=${plus30(od)}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
      <span className={`rounded px-1.5 py-0.5 ${k.tone}`}>{k.label}</span>
      <span className="min-w-[180px] font-medium text-ink">
        {it.productName ?? it.supplierName ?? 'Ugovor bez proizvoda u katalogu'}
        {mesto && <span className="ml-1 font-normal text-ink-faint">· {mesto}</span>}
        {it.roomType && <span className="ml-1 font-normal text-ink-dim">· {it.roomType}</span>}
      </span>
      <span className="text-ink">{it.detail}</span>
      <span className={hitno ? 'font-semibold text-danger' : 'font-semibold text-warn'}>
        {datum(it.date)} ({zaDana(it.date, danas)})
      </span>
      <span className="ml-auto flex items-center gap-2">
        {it.kind === 'OFFER_EXPIRING' ? (
          <Link
            href={`/ugovori/${it.contractId}/cenovnik`}
            className="text-accent-strong hover:underline"
          >
            otvori cenovnik →
          </Link>
        ) : (
          <Link href={gridHref} className="text-accent-strong hover:underline">
            otvori mrežu →
          </Link>
        )}
        {it.kind === 'OFFER_EXPIRING' && it.noticeId && canAcknowledge && (
          <form action={action}>
            <input type="hidden" name="id" value={it.noticeId} />
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
