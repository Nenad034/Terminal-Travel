import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ReconciliationButton from './ReconciliationButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';

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
}

// M17 spec §4/§7 (Faza 5) — "Izveštaji", M13 §7 API ugovor. Svaki izveštaj je čist read-only
// upit nad M13 projekciji (M13 spec §1.1) — ova stranica ne uvodi novu logiku, samo poziva
// pet postojećih GET endpoint-a i po jedan POST za ručnu rekonsilijaciju, filtrirano prema
// M13/report:*/VIEW dozvolama trenutnog korisnika (isti princip kao ostatak M17 — sekcija se
// ne prikazuje bez dozvole, ne samo onemogući).
export default async function IzvestajiPage({ searchParams }: { searchParams: SearchParams }) {
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
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls izvestaji/
          </h1>
          <p className="text-xs text-ink-dim">Upravljački izveštaji nad M13 projekcijom (profitabilnost, prodaja, smeštaj, marketing) — read-only.</p>
        </div>
        {canReconcile && <ReconciliationButton />}
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
          <Button type="submit" variant="secondary" size="sm">
            primeni filter
          </Button>
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && tab === 'profitabilnost' && profitability && (
        <div className="flex flex-col gap-4">
          <LastSynced value={profitability.lastSyncedAt} />
          <BucketTable title="Po destinaciji" buckets={profitability.byDestination} showMargin />
          <BucketTable title="Po dobavljaču/provajderu" buckets={profitability.bySupplier} showMargin />
          <BucketTable title="Po kanalu" buckets={profitability.byChannel} showMargin />
        </div>
      )}

      {!error && tab === 'prodaja' && sales && (
        <div className="flex flex-col gap-4">
          <LastSynced value={sales.lastSyncedAt} />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="broj rezervacija" value={sales.bookingCount.toLocaleString('sr-RS')} />
            <Stat label="ukupna vrednost" value={formatMoney(sales.totalValue)} />
            <Stat label="prosečna vrednost" value={formatMoney(sales.averageValue)} />
          </div>
          <BucketTable title="Po kanalu" buckets={sales.byChannel} />
          <BucketTable title="Po tipu proizvoda" buckets={sales.byProductType} />
        </div>
      )}

      {!error && tab === 'smestaj' && occupancy && (
        <div className="flex flex-col gap-4">
          <LastSynced value={occupancy.lastSyncedAt} />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="broj osoba" value={occupancy.guestCount.toLocaleString('sr-RS')} />
            <Stat label="noćenja (gost-noćenja)" value={occupancy.nights.toLocaleString('sr-RS')} />
            <Stat label="prodate sobe — ukupno" value={occupancy.soldUnitsTotal.toLocaleString('sr-RS')} />
          </div>
          {occupancy.breakdown && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="graph-line" className="text-accent" /> Razvrstano po {occupancy.groupBy}
                {occupancy.unclassifiedCount > 0 && (
                  <Badge variant="warn" className="font-normal">
                    {occupancy.unclassifiedCount} stavki nije razvrstano (obično API-sourced)
                  </Badge>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {occupancy.breakdown.map((b) => (
                  <div key={b.key} className="flex items-center justify-between border-b border-border bg-panel px-4 py-2 text-xs last:border-b-0">
                    <span className="font-medium text-ink">{b.key}</span>
                    <span className="text-ink-faint">
                      {b.count} stavki · {b.nights.toLocaleString('sr-RS')} noćenja
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
        <div className="flex flex-col gap-4">
          <LastSynced value={marketing.lastSyncedAt} />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="udeo atribuisanih rezervacija" value={`${(marketing.attributedShare * 100).toFixed(1)}%`} />
            <Stat
              label="bez poznatog porekla"
              value={`${marketing.withoutKnownOrigin.count.toLocaleString('sr-RS')} (${formatMoney(marketing.withoutKnownOrigin.revenue)})`}
            />
          </div>
          <BucketTable title="Rezervacije/prihod po sadržaju (M12)" buckets={marketing.byContent} />
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

function BucketTable({ title, buckets, showMargin = false }: { title: string; buckets: Bucket[]; showMargin?: boolean }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink">{title}</div>
      {buckets.length === 0 ? (
        <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema podataka za zadate filtere.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {buckets.map((b) => (
            <div key={b.key} className="flex items-center justify-between border-b border-border bg-panel px-4 py-2 text-xs last:border-b-0">
              <span className="font-medium text-ink">{b.key}</span>
              <span className="text-ink-faint">
                {b.count} rez. · prihod {formatMoney(b.revenue)}
                {showMargin ? ` · marža ${formatMoney(b.margin)}` : ''}
              </span>
            </div>
          ))}
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
