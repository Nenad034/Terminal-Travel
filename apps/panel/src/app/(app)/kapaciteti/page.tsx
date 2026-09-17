import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import Link from 'next/link';
import CapacityScreen from './CapacityScreen';
import WorkQueue, { type WorkQueueItem } from './WorkQueue';
import HotelSearch from './HotelSearch';
import type { CapacityGridRow } from './CapacityGrid';

// M17 spec §4b — ekran „Kapaciteti": mreža po danima nad M3 §2.8.
//
// ZAŠTO ZASEBAN EKRAN, a ne tab u Izveštajima: Izveštaji odgovaraju na „šta se desilo" i čitaju
// se povremeno; ovo je radni alat sa kog se RADI (zatvara prodaja, drži kapacitet, otvara
// rezervacija). Isti razlog zašto ovo nije proširenje toplotne mape iz M13 §4.4 — ona gleda
// unazad i zbirno, mreža gleda unapred i po konkretnom datumu.
//
// Podaci se čitaju UŽIVO iz M3/M5, ne iz M13 projekcije: za pitanje „smem li ovo da prodam"
// kašnjenje do sledeće rekonsilijacije nije prihvatljivo.

export const dynamic = 'force-dynamic';

interface GridResponse {
  from: string;
  to: string;
  rows: CapacityGridRow[];
}

function prviDanMeseca(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** §2.8b — podrazumevani rok blokade. Računa se na serveru: `Date.now()` u renderu klijentske
 * komponente je nečista funkcija (ESLint `react-hooks/purity`), a i dva rendera bi dala dva
 * različita datuma. */
function zaNedeljuDana(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Next daje ponovljen query parametar kao `string[]`, jedan kao `string` — oba u niz. */
function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function poslednjiDanMeseca(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export default async function KapacitetiPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    /** Radni spisak (§4b.0) vodi na mrežu JEDNOG ugovora — prosleđuje se M3 §6 nepromenjen. */
    contractId?: string;
    supplierId?: string;
    allotmentMode?: string;
    // §4b.3 (dopuna 9.9.2026) — filteri nad proizvodom, prosleđuju se M3 §6 nepromenjeni.
    // `productType` je jedini koji sme da se ponovi u adresi (traka ikonica, više vrsta
    // odjednom), pa Next daje `string[]` kad ih je više i `string` kad je jedna.
    destinationCountry?: string;
    destinationCity?: string;
    productName?: string;
    productType?: string | string[];
  }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canView = hasPermission(me, 'M3', 'capacity', 'VIEW');
  const canCloseSale = hasPermission(me, 'M3', 'capacity', 'CLOSE_SALE');
  const canBlock = hasPermission(me, 'M3', 'capacity', 'BLOCK');
  const canEditCapacity = hasPermission(me, 'M3', 'contract-period', 'EDIT');
  // M3 §4.9 — „video" na akciji pred istek traži pravo nad ugovorom.
  const canAckExpiry = hasPermission(me, 'M3', 'contract', 'EDIT');

  if (!canView) {
    return (
      <div className="p-6">
        <RegisterTab label="Kapaciteti" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo pristupa mreži kapaciteta (M3/capacity/VIEW).
        </p>
      </div>
    );
  }

  const from = searchParams?.from ?? prviDanMeseca();
  const to = searchParams?.to ?? poslednjiDanMeseca();

  const qs = new URLSearchParams({ from, to });
  if (searchParams?.contractId) qs.set('contractId', searchParams.contractId);
  if (searchParams?.supplierId) qs.set('supplierId', searchParams.supplierId);
  if (searchParams?.allotmentMode) qs.set('allotmentMode', searchParams.allotmentMode);
  if (searchParams?.destinationCountry)
    qs.set('destinationCountry', searchParams.destinationCountry);
  if (searchParams?.destinationCity) qs.set('destinationCity', searchParams.destinationCity);
  if (searchParams?.productName) qs.set('productName', searchParams.productName);
  for (const t of toArray(searchParams?.productType)) qs.append('productType', t);

  // §4b.0 — „nikad svih 2000 odjednom": mreža se čita samo kad je izabran objekat/ugovor ili kad
  // filter sam po sebi sužava (dobavljač, destinacija, naziv). Vrsta ugovora/proizvoda ne sužava.
  const suzeno = Boolean(
    searchParams?.contractId ||
    searchParams?.supplierId ||
    searchParams?.destinationCountry ||
    searchParams?.destinationCity ||
    searchParams?.productName,
  );

  let grid: GridResponse = { from, to, rows: [] };
  let error: string | null = null;
  if (suzeno) {
    try {
      grid = await apiFetch<GridResponse>(`/contracting/capacity/grid?${qs.toString()}`);
    } catch {
      error = 'Mreža kapaciteta trenutno nije dostupna (M3 API).';
    }
  }

  const dani = grid.rows[0]?.days.map((d) => d.date) ?? [];

  // M17 §4b.0 stanje 1 — radni spisak. Greška ovde ne sme da obori mrežu: prikaže se poruka.
  let workQueue: WorkQueueItem[] | null = null;
  try {
    workQueue = (await apiFetch<{ items: WorkQueueItem[] }>('/contracting/capacity/work-queue'))
      .items;
  } catch {
    workQueue = null;
  }
  const danas = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label="Kapaciteti" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Kapaciteti</h1>
          <p className="text-xs text-ink-faint">
            <Icon name="calendar" /> stanje po danima — ugovoreno, prodato, blokirano, slobodno
          </p>
        </div>
        {/* 8.9.2026 — vlasnikovo pitanje "gde se definišu kapaciteti": mreža ih samo PRIKAZUJE,
            unose se na ugovoru (period → "Ukupan kapacitet"). Veza stoji ovde da se to ne traži. */}
        <div className="text-right text-xs">
          <Link href="/ugovori" className="text-accent-strong hover:underline">
            Kapacitet se unosi na ugovoru →
          </Link>
          <p className="text-[11px] text-ink-faint">
            Ugovori i kapaciteti → otvori ugovor → Periodi → polje &bdquo;Ukupan kapacitet&ldquo;
          </p>
        </div>
      </div>

      {workQueue === null ? (
        <p className="rounded-xl border border-border bg-panel p-4 text-xs text-danger">
          Radni spisak trenutno nije dostupan (M3 API).
        </p>
      ) : (
        <WorkQueue items={workQueue} danas={danas} canAcknowledge={canAckExpiry} />
      )}

      {/* §4b.0a — prediktivna pretraga hotela: naziv + kategorija + mesto + država. */}
      <HotelSearch from={from} to={to} />

      {error ? (
        <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-danger">
          {error}
        </p>
      ) : (
        <CapacityScreen
          suzeno={suzeno}
          rows={grid.rows}
          dani={dani}
          from={from}
          to={to}
          canCloseSale={canCloseSale}
          canBlock={canBlock}
          canEditCapacity={canEditCapacity}
          podrazumevaniRokBlokade={zaNedeljuDana()}
        />
      )}
    </div>
  );
}
