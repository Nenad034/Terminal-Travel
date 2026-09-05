import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ReconciliationButton from './ReconciliationButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';
import BarChart, { type ChartSeries } from './BarChart';
import ShareReportButton from './ShareReportButton';


interface Bucket {
  key: string;
  count: number;
  revenue: number;
  margin: number;
}

interface ProfitabilityReport {
  byDestination: Bucket[];
  bySupplier: Bucket[];
  byChannel: Bucket[];
  lastSyncedAt: string | null;
}

interface SalesReport {
  bookingCount: number;
  totalValue: number;
  averageValue: number;
  byChannel: Bucket[];
  byProductType: Bucket[];
  lastSyncedAt: string | null;
}

interface OccupancyReport {
  guestCount: number;
  nights: number;
  soldUnitsTotal: number;
  groupBy: string | null;
  breakdown: (Bucket & { nights: number })[] | null;
  unclassifiedCount: number;
  lastSyncedAt: string | null;
}

interface DynamicNode {
  key: string;
  count: number;
  pax: number;
  nights: number;
  revenue: number;
  paid: number;
  balance: number;
  children: DynamicNode[];
}

interface DynamicReport {
  dimensions: string[];
  tree: DynamicNode[];
  lastSyncedAt: string | null;
}

interface MarketingReport {
  byContent: Bucket[];
  withoutKnownOrigin: { count: number; revenue: number };
  attributedShare: number;
  lastSyncedAt: string | null;
}

const TAB_LABELS = {
  profitabilnost: 'Profitabilnost',
  prodaja: 'Prodaja',
  smestaj: 'Smeštaj',
  dinamicki: 'Dinamički',
  marketing: 'Marketing',
} as const;
type TabKey = keyof typeof TAB_LABELS;

// Pod-tabovi unutar "Profitabilnost"/"Prodaja" (5.9.2026, vlasnikov zahtev: "izvestaje po
// kategorijama stavite takodje u tabove kako se ne bi skrolovalo na dole... kada se klikne na
// Profitabilnost da se dole takodje pojave tabovi") — te dve kategorije imaju po više (3, odn. 2)
// naslaganih tabela/grafikona jedan ispod drugog; sad je vidljiv samo IZABRAN, ostatak je iza
// tabova umesto skrolovanja. "Smeštaj"/"Dinamički"/"Marketing" imaju samo JEDAN takav blok pod
// glavnim tabom — pod-tabovi im ne trebaju, ne dobijaju ih.
const PROFITABILNOST_SUB_LABELS = {
  destinacija: 'Po destinaciji',
  dobavljac: 'Po dobavljaču/provajderu',
  kanal: 'Po kanalu',
} as const;
type ProfitabilnostSub = keyof typeof PROFITABILNOST_SUB_LABELS;

const PRODAJA_SUB_LABELS = {
  kanal: 'Po kanalu',
  tip: 'Po tipu proizvoda',
} as const;
type ProdajaSub = keyof typeof PRODAJA_SUB_LABELS;

// Serije za grafike (BarChart.tsx) — `var(--accent)`/`var(--accent2)`, isti tokeni kao svaki
// drugi akcent u panelu (dizajn dok. §2.0f), ne nova paleta.
const REVENUE_SERIES: ChartSeries<Bucket>[] = [{ label: 'prihod', color: 'var(--accent)', value: (b) => b.revenue, money: true }];
const PROFIT_SERIES: ChartSeries<Bucket>[] = [
  { label: 'prihod', color: 'var(--accent)', value: (b) => b.revenue, money: true },
  { label: 'marža', color: 'var(--accent2)', value: (b) => b.margin, money: true },
];
const NIGHTS_SERIES: ChartSeries<Bucket & { nights: number }>[] = [{ label: 'noćenja', color: 'var(--accent)', value: (b) => b.nights }];

const OCCUPANCY_GROUP_BY = ['room_type', 'board_type', 'stars', 'accommodation_type'] as const;
const DYNAMIC_DIMENSIONS = ['destination_country', 'destination_city', 'product_name', 'supplier_name', 'channel', 'subagent_name'] as const;

interface SearchParams {
  tab?: string;
  from?: string;
  to?: string;
  destinationCountry?: string;
  destinationCity?: string;
  supplierId?: string;
  providerCode?: string;
  channel?: string;
  productType?: string;
  groupBy?: string;
  view?: string;
  sub?: string;
}

// M17 spec §4/§7 (Faza 5) — "Izveštaji", M13 §7 API ugovor. Svaki izveštaj je čist read-only
// upit nad M13 projekciji (M13 spec §1.1) — ova stranica ne uvodi novu logiku, samo poziva
// pet postojećih GET endpoint-a i po jedan POST za ručnu rekonsilijaciju, filtrirano prema
// M13/report:*/VIEW dozvolama trenutnog korisnika (isti princip kao ostatak M17 — sekcija se
// ne prikazuje bez dozvole, ne samo onemogući).
export default async function IzvestajiPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const perms: Record<TabKey, boolean> = {
    profitabilnost: hasPermission(me, 'M13', 'report:profitability', 'VIEW'),
    prodaja: hasPermission(me, 'M13', 'report:sales', 'VIEW'),
    smestaj: hasPermission(me, 'M13', 'report:occupancy', 'VIEW'),
    dinamicki: hasPermission(me, 'M13', 'report:dynamic', 'VIEW'),
    marketing: hasPermission(me, 'M13', 'report:marketing', 'VIEW'),
  };
  const canReconcile = perms.profitabilnost;
  const availableTabs = (Object.keys(TAB_LABELS) as TabKey[]).filter((k) => perms[k]);
  const tab = (searchParams?.tab && availableTabs.includes(searchParams.tab as TabKey) ? (searchParams.tab as TabKey) : availableTabs[0]) as
    | TabKey
    | undefined;

  // Prekidač tabela/grafik (4.9.2026, na zahtev vlasnika: "omogucite i vizuelni prikaz... ali
  // jednostavan i sveden") — dopuna postojećih tabela, ne zamena; podrazumevano ostaje tabela
  // (tačno "i", ne "umesto"). Stanje ide u adresu kao i ostatak ekrana (nema klijentskog stanja
  // na ovoj stranici — server komponenta, isti obrazac kao tabovi/filter forma iznad).
  const view = searchParams?.view === 'grafik' ? 'grafik' : 'tabela';
  // Zajednička osnova za sve linkove OVOG tab-a (view/sub) — čuva filtere iz forme ispod, isti
  // spisak parametara na oba mesta da se nijedan slučajno ne izgubi pri promeni jednog od njih.
  function baseParams(): URLSearchParams {
    const v = new URLSearchParams();
    if (tab) v.set('tab', tab);
    if (searchParams?.from) v.set('from', searchParams.from);
    if (searchParams?.to) v.set('to', searchParams.to);
    if (searchParams?.destinationCountry) v.set('destinationCountry', searchParams.destinationCountry);
    if (searchParams?.destinationCity) v.set('destinationCity', searchParams.destinationCity);
    if (searchParams?.supplierId) v.set('supplierId', searchParams.supplierId);
    if (searchParams?.providerCode) v.set('providerCode', searchParams.providerCode);
    if (searchParams?.channel) v.set('channel', searchParams.channel);
    if (searchParams?.productType) v.set('productType', searchParams.productType);
    if (searchParams?.groupBy) v.set('groupBy', searchParams.groupBy);
    return v;
  }
  function viewHref(next: 'tabela' | 'grafik'): string {
    const v = baseParams();
    if (searchParams?.sub) v.set('sub', searchParams.sub);
    if (next === 'grafik') v.set('view', 'grafik');
    return `/izvestaji?${v.toString()}`;
  }
  // Pod-tabovi (5.9.2026, vlasnikov zahtev) — isti obrazac kao `viewHref`, menja SAMO `sub`.
  function subHref(next: string): string {
    const v = baseParams();
    if (view === 'grafik') v.set('view', 'grafik');
    v.set('sub', next);
    return `/izvestaji?${v.toString()}`;
  }
  const profSub: ProfitabilnostSub =
    searchParams?.sub && searchParams.sub in PROFITABILNOST_SUB_LABELS ? (searchParams.sub as ProfitabilnostSub) : 'destinacija';
  const prodajaSub: ProdajaSub = searchParams?.sub && searchParams.sub in PRODAJA_SUB_LABELS ? (searchParams.sub as ProdajaSub) : 'kanal';

  if (availableTabs.length === 0) {
    return (
      <div className="p-6">
        <RegisterTab label="Izveštaji" />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">Nemate dozvolu za uvid ni u jedan izveštaj (M13/report:*/VIEW).</p>
      </div>
    );
  }

  const qs = new URLSearchParams();
  if (searchParams?.from) qs.set('from', searchParams.from);
  if (searchParams?.to) qs.set('to', searchParams.to);
  if (searchParams?.destinationCountry) qs.set('destinationCountry', searchParams.destinationCountry);
  if (searchParams?.destinationCity) qs.set('destinationCity', searchParams.destinationCity);
  if (searchParams?.supplierId) qs.set('supplierId', searchParams.supplierId);
  if (searchParams?.providerCode) qs.set('providerCode', searchParams.providerCode);
  if (searchParams?.channel) qs.set('channel', searchParams.channel);
  if (searchParams?.productType) qs.set('productType', searchParams.productType);

  let profitability: ProfitabilityReport | null = null;
  let sales: SalesReport | null = null;
  let occupancy: OccupancyReport | null = null;
  let dynamicReport: DynamicReport | null = null;
  let marketing: MarketingReport | null = null;
  let error: string | null = null;

  try {
    if (tab === 'profitabilnost') {
      profitability = await apiFetch<ProfitabilityReport>(`/bi/reports/profitability?${qs.toString()}`);
    } else if (tab === 'prodaja') {
      sales = await apiFetch<SalesReport>(`/bi/reports/sales?${qs.toString()}`);
    } else if (tab === 'smestaj') {
      const oqs = new URLSearchParams(qs);
      if (searchParams?.groupBy) oqs.set('group_by', searchParams.groupBy);
      occupancy = await apiFetch<OccupancyReport>(`/bi/reports/occupancy?${oqs.toString()}`);
    } else if (tab === 'dinamicki') {
      const dqs = new URLSearchParams();
      if (searchParams?.from) dqs.set('from', searchParams.from);
      if (searchParams?.to) dqs.set('to', searchParams.to);
      dqs.set('group_by', searchParams?.groupBy || 'destination_country,destination_city');
      dynamicReport = await apiFetch<DynamicReport>(`/bi/reports/dynamic?${dqs.toString()}`);
    } else if (tab === 'marketing') {
      const mqs = new URLSearchParams();
      if (searchParams?.from) mqs.set('from', searchParams.from);
      if (searchParams?.to) mqs.set('to', searchParams.to);
      marketing = await apiFetch<MarketingReport>(`/bi/reports/marketing?${mqs.toString()}`);
    }
  } catch {
    error = 'Izveštaj trenutno nije dostupan (nemate dozvolu ili je M13 projekcija prazna).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Izveštaji" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Izveštaji</h1>
        </div>
        <div className="flex items-center gap-2">
          {tab && tab !== 'dinamicki' && (
            <div className="flex overflow-hidden rounded-full border border-border text-xs">
              {(['tabela', 'grafik'] as const).map((v) => (
                <Link
                  key={v}
                  href={viewHref(v)}
                  aria-pressed={view === v}
                  className={`flex items-center gap-1 px-2.5 py-1 ${
                    view === v ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  <Icon name={v === 'tabela' ? 'list-flat' : 'graph'} /> {v}
                </Link>
              ))}
            </div>
          )}
          {canReconcile && <ReconciliationButton />}
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {availableTabs.map((t) => (
          <Link
            key={t}
            href={`/izvestaji?tab=${t}`}
            className={`rounded-t px-3 py-2 text-xs font-medium ${
              t === tab ? 'border-b-2 border-accent text-accent' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </div>

      {!error && tab && (
        <form className="mb-4 flex flex-wrap items-end gap-2 text-xs" action="/izvestaji">
          <input type="hidden" name="tab" value={tab} />
          <Field label="od (datum)">
            <DateField name="from" defaultValue={searchParams?.from ?? ''} />
          </Field>
          <Field label="do (datum)">
            <DateField name="to" defaultValue={searchParams?.to ?? ''} />
          </Field>
          {(tab === 'profitabilnost' || tab === 'smestaj') && (
            <>
              <Field label="država">
                <input name="destinationCountry" defaultValue={searchParams?.destinationCountry ?? ''} className="input w-32" />
              </Field>
              <Field label="destinacija">
                <input name="destinationCity" defaultValue={searchParams?.destinationCity ?? ''} className="input w-32" />
              </Field>
              <Field label="dobavljač (ID)">
                <input name="supplierId" defaultValue={searchParams?.supplierId ?? ''} className="input w-32" />
              </Field>
            </>
          )}
          {tab === 'profitabilnost' && (
            <>
              <Field label="provajder (M4)">
                <input name="providerCode" defaultValue={searchParams?.providerCode ?? ''} className="input w-28" />
              </Field>
              <Field label="kanal">
                <input name="channel" defaultValue={searchParams?.channel ?? ''} className="input w-28" />
              </Field>
            </>
          )}
          {tab === 'prodaja' && (
            <>
              <Field label="kanal">
                <input name="channel" defaultValue={searchParams?.channel ?? ''} className="input w-28" />
              </Field>
              <Field label="tip proizvoda">
                <input name="productType" defaultValue={searchParams?.productType ?? ''} className="input w-28" />
              </Field>
            </>
          )}
          {tab === 'smestaj' && (
            <Field label="razvrstaj po">
              <select name="groupBy" defaultValue={searchParams?.groupBy ?? ''} className="input">
                <option value="">(bez razvrstavanja)</option>
                {OCCUPANCY_GROUP_BY.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {tab === 'dinamicki' && (
            <Field label="dimenzije (redosled, zarezom)">
              <input
                name="groupBy"
                defaultValue={searchParams?.groupBy ?? 'destination_country,destination_city'}
                placeholder={DYNAMIC_DIMENSIONS.join(',')}
                className="input w-72"
              />
            </Field>
          )}
          <Button type="submit" variant="secondary" size="sm" className="border-transparent bg-brand text-brand-ink hover:bg-brand hover:brightness-90">
            primeni filter
          </Button>
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && tab === 'profitabilnost' && profitability && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <LastSynced value={profitability.lastSyncedAt} />
            {/* "Podeli izveštaj" (5.9.2026, vlasnikov zahtev) — nosi TAČNO ono što je trenutno
                izabrano pod-tabom (destinacija/dobavljač/kanal), ne ceo skup od tri tabele
                odjednom; `captureElementId` cilja OVAJ omotač (isti sadržaj koji korisnik vidi,
                tabela ili grafik u zavisnosti od `view`). */}
            <ShareReportButton
              reportKind="profitability"
              title={`Profitabilnost — ${PROFITABILNOST_SUB_LABELS[profSub]}`}
              rows={profSub === 'destinacija' ? profitability.byDestination : profSub === 'dobavljac' ? profitability.bySupplier : profitability.byChannel}
              captureElementId="izvestaj-sadrzaj"
            />
          </div>
          {/* Pod-tabovi (5.9.2026, vlasnikov zahtev: "izvestaje po kategorijama stavite takodje
              u tabove kako se ne bi skrolovalo na dole") — tri razlaganja ove kategorije su do
              sad stajala naslagana jedno ispod drugog; sad je vidljivo samo IZABRANO. */}
          <SubTabBar labels={PROFITABILNOST_SUB_LABELS} active={profSub} hrefFor={subHref} />
          {profSub === 'destinacija' &&
            (view === 'grafik' ? (
              <ChartSection title="Po destinaciji">
                <BarChart rows={profitability.byDestination} series={PROFIT_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po destinaciji" buckets={profitability.byDestination} showMargin />
            ))}
          {profSub === 'dobavljac' &&
            (view === 'grafik' ? (
              <ChartSection title="Po dobavljaču/provajderu">
                <BarChart rows={profitability.bySupplier} series={PROFIT_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po dobavljaču/provajderu" buckets={profitability.bySupplier} showMargin />
            ))}
          {profSub === 'kanal' &&
            (view === 'grafik' ? (
              <ChartSection title="Po kanalu">
                <BarChart rows={profitability.byChannel} series={PROFIT_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po kanalu" buckets={profitability.byChannel} showMargin />
            ))}
        </div>
      )}

      {!error && tab === 'prodaja' && sales && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <LastSynced value={sales.lastSyncedAt} />
            <ShareReportButton
              reportKind="sales"
              title={`Prodaja — ${PRODAJA_SUB_LABELS[prodajaSub]}`}
              rows={prodajaSub === 'kanal' ? sales.byChannel : sales.byProductType}
              captureElementId="izvestaj-sadrzaj"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="broj rezervacija" value={sales.bookingCount.toLocaleString('sr-RS')} />
            <Stat label="ukupna vrednost" value={formatMoney(sales.totalValue)} />
            <Stat label="prosečna vrednost" value={formatMoney(sales.averageValue)} />
          </div>
          <SubTabBar labels={PRODAJA_SUB_LABELS} active={prodajaSub} hrefFor={subHref} />
          {prodajaSub === 'kanal' &&
            (view === 'grafik' ? (
              <ChartSection title="Po kanalu">
                <BarChart rows={sales.byChannel} series={REVENUE_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po kanalu" buckets={sales.byChannel} />
            ))}
          {prodajaSub === 'tip' &&
            (view === 'grafik' ? (
              <ChartSection title="Po tipu proizvoda">
                <BarChart rows={sales.byProductType} series={REVENUE_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po tipu proizvoda" buckets={sales.byProductType} />
            ))}
        </div>
      )}

      {!error && tab === 'smestaj' && occupancy && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <LastSynced value={occupancy.lastSyncedAt} />
            <ShareReportButton
              reportKind="occupancy"
              title="Operativna statistika smeštaja"
              rows={occupancy.breakdown ?? []}
              captureElementId="izvestaj-sadrzaj"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="broj osoba" value={occupancy.guestCount.toLocaleString('sr-RS')} />
            <Stat label="noćenja (gost-noćenja)" value={occupancy.nights.toLocaleString('sr-RS')} />
            <Stat label="prodate sobe — ukupno" value={occupancy.soldUnitsTotal.toLocaleString('sr-RS')} />
          </div>
          {occupancy.breakdown && (
            <OccupancyBreakdown breakdown={occupancy.breakdown} groupBy={occupancy.groupBy} unclassifiedCount={occupancy.unclassifiedCount} view={view} />
          )}
        </div>
      )}

      {!error && tab === 'dinamicki' && dynamicReport && (
        <div className="flex flex-col gap-4">
          <LastSynced value={dynamicReport.lastSyncedAt} />
          <div className="overflow-x-auto rounded-lg border border-border bg-panel p-3">
            {dynamicReport.tree.length === 0 ? (
              <p className="p-2 text-center text-xs text-ink-faint">Nema rezultata za zadate filtere.</p>
            ) : (
              <DynamicTree nodes={dynamicReport.tree} depth={0} />
            )}
          </div>
        </div>
      )}

      {!error && tab === 'marketing' && marketing && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <LastSynced value={marketing.lastSyncedAt} />
            <ShareReportButton
              reportKind="marketing"
              title="Marketing performanse"
              rows={marketing.byContent}
              captureElementId="izvestaj-sadrzaj"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="udeo atribuisanih rezervacija" value={`${(marketing.attributedShare * 100).toFixed(1)}%`} />
            <Stat
              label="bez poznatog porekla"
              value={`${marketing.withoutKnownOrigin.count.toLocaleString('sr-RS')} (${formatMoney(marketing.withoutKnownOrigin.revenue)})`}
            />
          </div>
          {view === 'grafik' ? (
            <ChartSection title="Rezervacije/prihod po sadržaju (M12)">
              <BarChart rows={marketing.byContent} series={REVENUE_SERIES} />
            </ChartSection>
          ) : (
            <BucketTable title="Rezervacije/prihod po sadržaju (M12)" buckets={marketing.byContent} />
          )}
        </div>
      )}
    </div>
  );
}

function DynamicTree({ nodes, depth }: { nodes: DynamicNode[]; depth: number }) {
  return (
    <div className="flex flex-col gap-1">
      {nodes.map((n) => (
        <div key={`${depth}-${n.key}`}>
          <div className="flex items-center justify-between border-b border-border py-1.5 text-xs" style={{ paddingLeft: depth * 16 }}>
            <span className="font-medium text-ink">{n.key}</span>
            <span className="text-ink-faint">
              {n.count} rez. · {n.pax} os. · {n.nights} noć. · prihod {formatMoney(n.revenue)} · naplaćeno {formatMoney(n.paid)} · saldo{' '}
              {formatMoney(n.balance)}
            </span>
          </div>
          {n.children.length > 0 && <DynamicTree nodes={n.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

function OccupancyBreakdown({
  breakdown,
  groupBy,
  unclassifiedCount,
  view,
}: {
  breakdown: (Bucket & { nights: number })[];
  groupBy: string | null;
  unclassifiedCount: number;
  view: 'tabela' | 'grafik';
}) {
  const total = breakdown.reduce((sum, b) => sum + b.nights, 0);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="graph-line" className="text-accent" /> Razvrstano po {groupBy}
        {unclassifiedCount > 0 && (
          <Badge variant="warn" className="font-normal">
            {unclassifiedCount} stavki nije razvrstano (obično API-sourced)
          </Badge>
        )}
      </div>
      {view === 'grafik' ? (
        <BarChart rows={breakdown} series={NIGHTS_SERIES} />
      ) : (
        <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 text-left font-medium">naziv</th>
                <th className="px-4 py-2 text-right font-medium">stavki</th>
                <th className="px-4 py-2 text-right font-medium">noćenja</th>
                <th className="px-4 py-2 text-right font-medium">udeo</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b, i) => (
                <tr key={b.key} className={i % 2 === 1 ? 'bg-panel2/40' : undefined}>
                  <td className="border-t border-border px-4 py-2 font-medium text-ink">{b.key}</td>
                  <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{b.count.toLocaleString('sr-RS')}</td>
                  <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{b.nights.toLocaleString('sr-RS')}</td>
                  <td className="border-t border-border px-4 py-2 text-right">
                    <PctBadge value={formatPct(b.nights, total)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Pod-tabovi unutar kategorije (5.9.2026) — isti vizuelni jezik kao glavni tabovi iznad
// (donja linija umesto pilule, da se vizuelno razlikuju kao DRUGI nivo), samo manji tekst.
function SubTabBar<K extends string>({
  labels,
  active,
  hrefFor,
}: {
  labels: Record<K, string>;
  active: K;
  hrefFor: (key: K) => string;
}) {
  const keys = Object.keys(labels) as K[];
  return (
    <div className="-mt-2 flex gap-1 border-b border-border">
      {keys.map((k) => (
        <Link
          key={k}
          href={hrefFor(k)}
          className={`rounded-t px-2.5 py-1.5 text-[11px] font-medium ${
            k === active ? 'border-b-2 border-accent text-accent' : 'text-ink-faint hover:text-ink'
          }`}
        >
          {labels[k]}
        </Link>
      ))}
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {children}
    </div>
  );
}

// "Kibana" stil — prava tabela sa kolonama umesto jednog reda teksta po stavci (5.9.2026,
// vlasnikov zahtev: "tekstualno mozemo malo da unapredimo da izgleda kao tabela elastic
// kibana"). Obeležja tog stila primenjena ovde: fiksno zaglavlje sa suptilno drugačijom
// pozadinom, naizmenične pruge između redova (zebra), brojevi monospejs i desno poravnati (lakše
// je porediti kolonu cifara kad im decimalna tačka pada na isto mesto), sitna "beidž" oznaka za
// procenat udela. Isti markap (pravi `<table>`) koristi se i kad se ovaj sadržaj snimi kao
// infografik (`ShareReportButton.tsx`, html2canvas) — izgled sa ekrana IDE u sliku, ne posebna
// "verzija za slanje".
function BucketTable({ title, buckets, showMargin = false }: { title: string; buckets: Bucket[]; showMargin?: boolean }) {
  // Udeo u procentima (4.9.2026, na zahtev vlasnika: "prikazite i u % u obe vrste izvestaja")
  // — udeo reda u zbiru CELE grupe (svih redova, ne samo prikazanih), ne u ukupnom prometu
  // agencije — "koliki deo OVOG rasporeda nosi ova destinacija/kanal/dobavljač".
  const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
  const totalMargin = buckets.reduce((sum, b) => sum + b.margin, 0);
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {buckets.length === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema podataka za zadate filtere.</p>
      ) : (
        <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-sunken text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 text-left font-medium">naziv</th>
                <th className="px-4 py-2 text-right font-medium">rezervacija</th>
                <th className="px-4 py-2 text-right font-medium">prihod</th>
                <th className="px-4 py-2 text-right font-medium">udeo</th>
                {showMargin && <th className="px-4 py-2 text-right font-medium">marža</th>}
                {showMargin && <th className="px-4 py-2 text-right font-medium">udeo</th>}
              </tr>
            </thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={b.key} className={i % 2 === 1 ? 'bg-panel2/40' : undefined}>
                  <td className="border-t border-border px-4 py-2 font-medium text-ink">{b.key}</td>
                  <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{b.count.toLocaleString('sr-RS')}</td>
                  <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.revenue)}</td>
                  <td className="border-t border-border px-4 py-2 text-right">
                    <PctBadge value={formatPct(b.revenue, totalRevenue)} />
                  </td>
                  {showMargin && (
                    <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.margin)}</td>
                  )}
                  {showMargin && (
                    <td className="border-t border-border px-4 py-2 text-right">
                      <PctBadge value={formatPct(b.margin, totalMargin)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

// Sitna "beidž" oznaka za procenat udela — deo "Kibana" tabelarnog stila (5.9.2026), ista ideja
// kao Kibana-ove sitne pilule za kategorijalne/izvedene vrednosti u ćeliji tabele.
function PctBadge({ value }: { value: string }) {
  return <span className="inline-block rounded bg-panel2 px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">{value}</span>;
}

function LastSynced({ value }: { value: string | null }) {
  return (
    <p className="text-[11px] text-ink-faint">
      <Icon name="history" /> poslednje ažurirano: {value ? new Date(value).toLocaleString('sr-RS') : 'nikad (projekcija prazna)'}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-[11px] text-ink-faint">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function formatMoney(value: number): string {
  return `${(value / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}`;
}

/** Udeo vrednosti u zbiru, kao procenat — "—" kad je zbir nula (nema od čega deliti). */
function formatPct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
