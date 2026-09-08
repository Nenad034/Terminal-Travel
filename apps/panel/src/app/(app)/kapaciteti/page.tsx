import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import CapacityScreen from './CapacityScreen';
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

function poslednjiDanMeseca(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export default async function KapacitetiPage(props: {
  searchParams: Promise<{ from?: string; to?: string; supplierId?: string; allotmentMode?: string }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canView = hasPermission(me, 'M3', 'capacity', 'VIEW');
  const canCloseSale = hasPermission(me, 'M3', 'capacity', 'CLOSE_SALE');
  const canBlock = hasPermission(me, 'M3', 'capacity', 'BLOCK');
  const canEditCapacity = hasPermission(me, 'M3', 'contract-period', 'EDIT');

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
  if (searchParams?.supplierId) qs.set('supplierId', searchParams.supplierId);
  if (searchParams?.allotmentMode) qs.set('allotmentMode', searchParams.allotmentMode);

  let grid: GridResponse = { from, to, rows: [] };
  let error: string | null = null;
  try {
    grid = await apiFetch<GridResponse>(`/contracting/capacity/grid?${qs.toString()}`);
  } catch {
    error = 'Mreža kapaciteta trenutno nije dostupna (M3 API).';
  }

  const dani = grid.rows[0]?.days.map((d) => d.date) ?? [];

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
      </div>

      {error ? (
        <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-danger">
          {error}
        </p>
      ) : (
        <CapacityScreen
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
