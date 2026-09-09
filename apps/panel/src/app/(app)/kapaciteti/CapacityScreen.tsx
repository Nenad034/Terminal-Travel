'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import CapacityGrid, { CapacityLegend, type CapacityGridRow } from './CapacityGrid';
import CapacityFilterBar from './CapacityFilterBar';
import { stopSale, reopenSale, createBlock, setCapacityOverride } from './actions';
import type { CapacityFormState } from './actions';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';
import { punDatum } from '@/lib/datum-sr';

// M17 spec §4b — klijentski deo ekrana: filteri (`CapacityFilterBar.tsx`, §4b.3) i panel dana
// koji se otvara klikom na ćeliju (§4b.1). Sve radnje idu kroz server akcije, koje zovu prave
// M3 endpoint-e — nema lokalnog stanja koje bi se razišlo sa bazom.

const pocetno: CapacityFormState = { error: null, ok: null };

const STOP_SOURCE_OPTIONS = [
  { value: 'SUPPLIER_EMAIL', label: 'mejl dobavljača' },
  { value: 'SUPPLIER_PHONE', label: 'telefonom' },
  { value: 'SUPPLIER_PORTAL', label: 'portal dobavljača' },
  { value: 'PROVIDER_API', label: 'API provajdera' },
  { value: 'INTERNAL', label: 'interna odluka' },
];

export default function CapacityScreen({
  rows,
  dani,
  from,
  to,
  canCloseSale,
  canBlock,
  canEditCapacity,
  podrazumevaniRokBlokade,
}: {
  rows: CapacityGridRow[];
  dani: string[];
  from: string;
  to: string;
  canCloseSale: boolean;
  canBlock: boolean;
  canEditCapacity: boolean;
  /** Računa server (page.tsx): `Date.now()` u renderu klijentske komponente je nečista
   * funkcija — ESLint to s pravom odbija, jer bi dva rendera dala dva različita datuma. */
  podrazumevaniRokBlokade: string;
}) {
  const [izabran, setIzabran] = useState<{ red: CapacityGridRow; datum: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <CapacityFilterBar from={from} to={to} brojRedova={rows.length} brojDana={dani.length} />

      <CapacityGrid
        rows={rows}
        dani={dani}
        onIzaberiDan={(red, datum) => setIzabran({ red, datum })}
      />

      <CapacityLegend />

      {izabran && (
        <DanPanel
          red={izabran.red}
          datum={izabran.datum}
          onZatvori={() => setIzabran(null)}
          canCloseSale={canCloseSale}
          canBlock={canBlock}
          canEditCapacity={canEditCapacity}
          podrazumevaniRokBlokade={podrazumevaniRokBlokade}
        />
      )}
    </div>
  );
}

/**
 * §4b.1 — panel dana. Ne duplira „Kalendar rezervacija" (M5): dolasci/odlasci se otvaraju
 * vezom ka tom ekranu, a ovde stoji ono što je specifično za kapacitet — brojevi tog dana i
 * tri radnje nad njim.
 */
function DanPanel({
  red,
  datum,
  onZatvori,
  canCloseSale,
  canBlock,
  canEditCapacity,
  podrazumevaniRokBlokade,
}: {
  red: CapacityGridRow;
  datum: string;
  onZatvori: () => void;
  canCloseSale: boolean;
  canBlock: boolean;
  canEditCapacity: boolean;
  podrazumevaniRokBlokade: string;
}) {
  const dan = red.days.find((d) => d.date === datum);
  if (!dan) return null;
  const prekoraceno = dan.razlika !== null && dan.razlika < 0;

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {red.productName ?? red.supplierName} · {red.roomType}
          </h2>
          <p className="text-xs text-ink-faint">{punDatum(datum)}</p>
        </div>
        <button
          type="button"
          onClick={onZatvori}
          className="rounded px-2 py-1 text-xs text-ink-dim hover:bg-sunken"
        >
          Zatvori
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Broj naslov="Kapacitet" vrednost={dan.capacity ?? '—'} />
        <Broj naslov="Prodato" vrednost={dan.sold} />
        <Broj naslov="Blokirano" vrednost={dan.blocked} />
        <Broj
          naslov={prekoraceno ? 'Prekoračeno' : 'Slobodno'}
          vrednost={dan.razlika ?? '—'}
          upozorenje={prekoraceno}
        />
      </div>

      {dan.saleStatus === 'STOP' && (
        <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">
          Prodaja je zatvorena za ovaj datum{dan.stopReason ? ` — ${dan.stopReason}` : ''}.
        </p>
      )}

      <p className="mb-4 text-xs">
        <Link
          href={`/rezervacije/kalendar?date=${datum}`}
          className="text-accent-strong hover:underline"
        >
          Vidi dolaske i odlaske tog dana (Kalendar rezervacija) →
        </Link>
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {canCloseSale && (
          <StopSaleForma red={red} datum={datum} zatvoreno={dan.saleStatus === 'STOP'} />
        )}
        {canBlock && (
          <BlokadaForma red={red} datum={datum} podrazumevaniRok={podrazumevaniRokBlokade} />
        )}
        {canEditCapacity && <KapacitetForma red={red} datum={datum} trenutni={dan.capacity} />}
      </div>
    </div>
  );
}

function Broj({
  naslov,
  vrednost,
  upozorenje,
}: {
  naslov: string;
  vrednost: number | string;
  upozorenje?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel2 p-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{naslov}</div>
      <div className={`font-mono text-lg font-semibold ${upozorenje ? 'text-danger' : 'text-ink'}`}>
        {vrednost}
      </div>
    </div>
  );
}

function StopSaleForma({
  red,
  datum,
  zatvoreno,
}: {
  red: CapacityGridRow;
  datum: string;
  zatvoreno: boolean;
}) {
  const [state, formAction] = useActionState(zatvoreno ? reopenSale : stopSale, pocetno);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-xs font-semibold text-ink">
        {zatvoreno ? 'Ponovo otvori prodaju' : 'Zatvori prodaju (stop-sale)'}
      </h3>
      <Poruke state={state} />
      <input type="hidden" name="contractPeriodId" value={red.contractPeriodId} />
      <input type="hidden" name="contractId" value={red.contractId} />

      {!zatvoreno && (
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Obim
          <select name="obim" className="input" defaultValue="period">
            <option value="period">samo {red.roomType}</option>
            <option value="objekat">sve sobe ovog objekta</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Od
          <DateField name="dateFrom" defaultValue={datum} required />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Do
          <DateField name="dateTo" defaultValue={datum} required />
        </label>
      </div>

      {!zatvoreno && (
        <>
          <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
            Po čijoj informaciji
            <select name="source" className="input" required defaultValue="SUPPLIER_EMAIL">
              {STOP_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
            Razlog (opciono)
            <input name="reason" className="input" placeholder="npr. hotel prima grupu" />
          </label>
        </>
      )}

      <Posalji label={zatvoreno ? 'Otvori prodaju' : 'Zatvori prodaju'} />
    </form>
  );
}

function BlokadaForma({
  red,
  datum,
  podrazumevaniRok,
}: {
  red: CapacityGridRow;
  datum: string;
  /** §2.8b — rok je obavezan i na backend-u; nudimo sedam dana unapred, ne prazno polje. */
  podrazumevaniRok: string;
}) {
  const [state, formAction] = useActionState(createBlock, pocetno);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-xs font-semibold text-ink">Blokiraj za grupu</h3>
      <Poruke state={state} />
      <input type="hidden" name="contractPeriodId" value={red.contractPeriodId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Od
          <DateField name="dateFrom" defaultValue={datum} required />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Do
          <DateField name="dateTo" defaultValue={datum} required />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Broj jedinica
        <input name="units" type="number" min={1} defaultValue={1} className="input" required />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Razlog (obavezno)
        <input name="reason" className="input" required placeholder="npr. grupa OŠ, čeka odluku" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Drži do (obavezno — posle ovog datuma se sam oslobađa)
        {/* 9.9.2026 — bio je goli `<input type="date">`, jedini preostali na ovom ekranu posle
            prelaska filtera na `DateField` (M17 §4b.3 dopuna, pravilo od 29.8.2026). */}
        <DateField name="holdUntil" defaultValue={podrazumevaniRok} required />
      </label>

      <Posalji label="Blokiraj" />
    </form>
  );
}

function KapacitetForma({
  red,
  datum,
  trenutni,
}: {
  red: CapacityGridRow;
  datum: string;
  trenutni: number | null;
}) {
  const [state, formAction] = useActionState(setCapacityOverride, pocetno);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-xs font-semibold text-ink">Izmeni kapacitet za dan/raspon</h3>
      <Poruke state={state} />
      <input type="hidden" name="contractPeriodId" value={red.contractPeriodId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Od
          <DateField name="dateFrom" defaultValue={datum} required />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Do
          <DateField name="dateTo" defaultValue={datum} required />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Kapacitet (prazno = vrati na ugovoreni)
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={trenutni ?? ''}
          className="input"
        />
      </label>

      <Posalji label="Sačuvaj kapacitet" />
    </form>
  );
}

function Poruke({ state }: { state: CapacityFormState }) {
  return (
    <>
      {state.error && (
        <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded bg-ok-bg p-2 text-[11px] text-ok">{state.ok}</p>}
    </>
  );
}

function Posalji({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Čuvam…' : label}
    </Button>
  );
}
