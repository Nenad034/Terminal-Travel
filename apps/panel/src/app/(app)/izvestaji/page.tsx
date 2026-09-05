import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon, { IconDuo } from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import ReconciliationButton from './ReconciliationButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';
import BarChart, { type ChartSeries } from './BarChart';
import ShareReportButton from './ShareReportButton';
import DynamicTree, { type DynamicNode } from './DynamicTree';


interface Bucket {
  key: string;
  count: number;
  /** Bruto — cena koju plaća klijent. */
  revenue: number;
  /** Neto — cena koju agencija plaća dobavljaču (5.9.2026 dopuna, vlasnikov zahtev: "tabela za
   * profitabilnost i prodaju treba da imaju neto kolonu, bruto kolonu"). */
  baseCost: number;
  /** Marža (iznos) — `revenue − baseCost`. */
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
// Ikonice vrsta proizvoda (5.9.2026, vlasnikov zahtev: "nije dobro ovo kod dinamickih paketa.
// Stavi ikone iz pretrage i koju ikonu ukljucimo... treba da se kreira dinamicki izvestaj i sve
// treba da ide u tri nivoa Drzava, Mesto, proizvod koji smo odabrali") — poništava raniji
// tekstualni preset "Destinacija"/"Destinacija → Hotel" (v1.8/v1.9): ISTE ikonice kao ekran
// pretrage (`PRODUCT_ICONS`, `lib/search-product-types.ts`, jedan izvor istine — vidi komentar
// tamo), ne nova, druga lista. Klik UVEK postavlja isti trodelni niz dimenzija (država → mesto →
// proizvod), filtriran na TU vrstu — "proizvod koji smo odabrali" doslovno znači `product_name`
// filtrirano na kliknutu ikonicu, ne generičko "sve vrste zajedno" kao ranije. Samo ikonice sa
// nepraznim `types` ulaze ovde ("Individualni paketi" je `packageMode` bez sopstvenog
// `ProductType`, ne postoji u M13 projekciji). Neke ikonice (npr. "Things to do") pokrivaju VIŠE
// `ProductType` vrednosti — spojene zarezom, `dynamic()` na API strani ih čita kao `IN` listu.
const DYNAMIC_DRILLDOWN_DIMS = 'destination_country,destination_city,product_name';
const DYNAMIC_PRODUCT_ICONS = PRODUCT_ICONS.filter((p) => p.types.length > 0);
// Preostala dva preseta koja NISU vezana za vrstu proizvoda — kanal/dobavljač imaju smisla za
// sve vrste odjednom, ostaju kao pre.
const DYNAMIC_OTHER_PRESETS = [
  { label: 'Kanal', dims: 'channel', productType: undefined },
  { label: 'Dobavljač', dims: 'supplier_name', productType: undefined },
] as const;
// Serija za grafik-prikaz "Dinamički" (5.9.2026, vlasnikov zahtev: "omoguci infografik pregled
// kako sam ranije trazio"; dopunjeno isti dan, "Infografik takodje treba da bude dinamicki i da
// prati tabelu" — grafik NIJE više fiksiran na prvi nivo (države), nego prikazuje NAJDUBLJI nivo
// stabla (liste, `flattenDynamicLeaves` ispod), tačno onaj skup redova koji tabela stvarno
// prikazuje kad je do kraja proširena — puna putanja (država › mesto › proizvod) kao naziv reda.
const DYNAMIC_SERIES: ChartSeries<{ key: string; revenue: number }>[] = [
  { label: 'prihod', color: 'var(--accent)', value: (n) => n.revenue, money: true },
];

/** Listovi stabla (čvorovi bez dece), sa punom putanjom kao ključem — isti princip sklapanja
 * putanje kao `DynamicTree.tsx`, ovde bez skupljanja jer grafik uvek prikazuje krajnji nivo. */
function flattenDynamicLeaves(nodes: DynamicNode[], parentPath: string, out: { key: string; revenue: number }[]) {
  for (const n of nodes) {
    const path = parentPath ? `${parentPath} › ${n.key}` : n.key;
    if (n.children.length === 0) out.push({ key: path, revenue: n.revenue });
    else flattenDynamicLeaves(n.children, path, out);
  }
}

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
  // Preset kombinacije dimenzija za "Dinamički" (5.9.2026, vlasnikov zahtev: "dodajte i pregled
  // na nivou hotela na destinacijama") — isti obrazac kao `subHref`, menja SAMO `groupBy`. Bez
  // ovoga je jedini način da se dođe do nivoa hotela bilo ručno kucanje u tekstualno polje ispod
  // (`destination_country,destination_city,product_name`) — presek je brži i ne traži da
  // korisnik zna tačna imena dimenzija napamet.
  function dimensionsHref(dims: string, productType: string | undefined): string {
    const v = baseParams();
    if (view === 'grafik') v.set('view', 'grafik');
    v.set('groupBy', dims);
    // Presek EKSPLICITNO postavlja ILI briše `productType` (dopuna, vlasnikov nalaz: "niste
    // dodali hotele u destinacijama") — mora obrisati kad prelazi NA preset bez filtera,
    // inače bi ostao zaglavljen filter sa prethodno izabranog preseta (npr. sa "→ Hotel").
    if (productType) v.set('productType', productType);
    else v.delete('productType');
    return `/izvestaji?${v.toString()}`;
  }
  const currentDims = searchParams?.groupBy || 'destination_country,destination_city';
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
      // (dopuna, vlasnikov nalaz: "niste dodali hotele u destinacijama") — bez ovoga je preset
      // "Destinacija → Hotel" postavljao `productType` u adresu, ali ga niko nije čitao pri
      // dovlačenju izveštaja, pa je filter tiho bio odbačen.
      if (searchParams?.productType) dqs.set('productType', searchParams.productType);
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

  // "poslednje ažurirano" pored dugmadi tabela/grafik (5.9.2026, vlasnikov zahtev: "ovo
  // premestite pored dugnadi za biranje tabele ili infografika") — JEDNA linija u gornjem
  // zaglavlju umesto ponavljanja u svakom od pet blokova ispod (koji su time izgubili sopstveni
  // red i "podigli se" za tačno tu visinu, isti zahtev: "za toliko podignite deo ispod").
  const currentLastSyncedAt =
    tab === 'profitabilnost'
      ? (profitability?.lastSyncedAt ?? null)
      : tab === 'prodaja'
        ? (sales?.lastSyncedAt ?? null)
        : tab === 'smestaj'
          ? (occupancy?.lastSyncedAt ?? null)
          : tab === 'dinamicki'
            ? (dynamicReport?.lastSyncedAt ?? null)
            : tab === 'marketing'
              ? (marketing?.lastSyncedAt ?? null)
              : null;

  // "Podeli izveštaj" seli se u isto zaglavlje (ista dopuna) — jedan proračun ovde umesto
  // ponovljenog bloka po tabu ispod.
  const shareProps: { reportKind: 'profitability' | 'sales' | 'occupancy' | 'marketing' | 'dynamic'; title: string; rows: Bucket[] } | null =
    tab === 'profitabilnost' && profitability
      ? {
          reportKind: 'profitability',
          title: `Profitabilnost — ${PROFITABILNOST_SUB_LABELS[profSub]}`,
          rows: profSub === 'destinacija' ? profitability.byDestination : profSub === 'dobavljac' ? profitability.bySupplier : profitability.byChannel,
        }
      : tab === 'prodaja' && sales
        ? {
            reportKind: 'sales',
            title: `Prodaja — ${PRODAJA_SUB_LABELS[prodajaSub]}`,
            rows: prodajaSub === 'kanal' ? sales.byChannel : sales.byProductType,
          }
        : tab === 'smestaj' && occupancy
          ? { reportKind: 'occupancy', title: 'Operativna statistika smeštaja', rows: occupancy.breakdown ?? [] }
          : tab === 'marketing' && marketing
            ? { reportKind: 'marketing', title: 'Marketing performanse', rows: marketing.byContent }
            : tab === 'dinamicki' && dynamicReport
              ? {
                  reportKind: 'dynamic',
                  title: 'Dinamički izveštaj',
                  // Stablo nema smisla kao ravna tabela za Excel/PDF/HTML — samo VRHOVI (bez
                  // dece, koja su već sadržana u roditelju) kao najbliža aproksimacija; ono što
                  // vlasnik ovde stvarno traži je INFOGRAFIK (snimak ekrana), kom ovaj oblik
                  // uopšte nije bitan.
                  rows: dynamicReport.tree.map((n) => ({ key: n.key, count: n.count, revenue: n.revenue, baseCost: 0, margin: 0 })),
                }
              : null;

  // Linkovanje redova tabele ka rezervacijama koje ih čine (5.9.2026, vlasnikov zahtev:
  // "omogucite da sve sto se nalazi u tabelama linkujete prema rezervacijama kije ulaze u taj
  // deo izvestaja") — vodi na `/rezervacije/lista` sa filterom koji odgovara TOJ konkretnoj
  // grupi, plus isti period (`from`/`to`) kao trenutni izveštaj. `Lista rezervacija` (i njen BFF
  // `page.tsx`) prosleđuje SVAKI query parametar bez belе liste (postojeći obrazac), a
  // `GET /sales/bookings` (M5) već prihvata `destinationCountry`/`destinationCity`/`channel`/
  // `productType` — zato ove četiri dimenzije rade već danas, bez ijedne nove linije backend
  // koda. `bySupplier` (profitabilnost) i `byContent` (marketing) NAMERNO nemaju link — M5 lista
  // rezervacija danas nema filter ni po dobavljaču ni po marketing sadržaju; ovo je poznat,
  // svesno odložen nedostatak (M13 spec, ne ćuti se).
  function bookingsHref(params: Record<string, string>): string {
    const v = new URLSearchParams(params);
    if (searchParams?.from) v.set('stayFrom', searchParams.from);
    if (searchParams?.to) v.set('stayTo', searchParams.to);
    return `/rezervacije/lista?${v.toString()}`;
  }
  // Ključ "Zemlja / Grad" (bucketize u reports.service.ts) — razdvaja se na dva filtera. Format
  // je pod NAŠOM kontrolom na obe strane (backend gradi tačno ovaj separator), pa cepanje ovde
  // nije krhko nagađanje.
  function destinationLinkFor(b: Bucket): string {
    const [country, city] = b.key.split(' / ');
    return bookingsHref({ destinationCountry: country ?? '', destinationCity: city ?? '' });
  }
  function channelLinkFor(b: Bucket): string {
    return bookingsHref({ channel: b.key });
  }
  function productTypeLinkFor(b: Bucket): string {
    return bookingsHref({ productType: b.key });
  }

  return (
    <div className="p-6">
      <RegisterTab label="Izveštaji" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Izveštaji</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* "poslednje ažurirano" pored dugmadi tabela/grafik (5.9.2026, vlasnikov zahtev) —
              vidi komentar uz `currentLastSyncedAt` iznad za razlog premeštanja. */}
          {tab && <LastSynced value={currentLastSyncedAt} />}
          {/* "omoguci infografik pregled kako sam ranije trazio" (5.9.2026) — prekidač tabela/
              grafik radi i za "Dinamički" (ranije jedini izuzetak), na VRHOVIMA stabla
              (`DYNAMIC_CHART_SERIES` ispod, isti princip kao ostali izveštaji — grafik ne prati
              ugnježdenu strukturu, samo prvi nivo). */}
          {tab && (
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
          {/* "Podeli izveštaj" seli se u isto zaglavlje (ista dopuna) — vidi `shareProps` iznad. */}
          {shareProps && <ShareReportButton {...shareProps} captureElementId="izvestaj-sadrzaj" />}
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
          {/* "Dinamički" datume iznosi u SVOJ red, spojene sa ručnim poljem za dimenzije ispod
              (5.9.2026, vlasnikov zahtev: "da ne bi bilo 3 vec dva reda polja za pretragu datuma
              premestite u istu liniju sa poljem po pretrazi pojma") — za ostale tabove ostaju
              ovde, na vrhu, nepromenjeno. */}
          {tab !== 'dinamicki' && (
            <>
              <Field label="od (datum)">
                <DateField name="from" defaultValue={searchParams?.from ?? ''} />
              </Field>
              <Field label="do (datum)">
                <DateField name="to" defaultValue={searchParams?.to ?? ''} />
              </Field>
            </>
          )}
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
            <>
              {/* Ikonice vrsta proizvoda (5.9.2026, vlasnikov zahtev: "stavi ikone iz pretrage i
                  koju ikonu ukljucimo za to treba da se kreira dinamicki izvestaj i sve treba da
                  ide u tri nivoa Drzava, Mesto, proizvod koji smo odabrali") — iste ikonice kao
                  ekran pretrage (`PRODUCT_ICONS`), klik UVEK postavlja isti trodelni niz
                  (država → mesto → proizvod) filtriran na tu vrstu. */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ink-faint">po vrsti proizvoda (država → mesto → proizvod)</span>
                <div className="flex flex-wrap gap-1">
                  {DYNAMIC_PRODUCT_ICONS.map((p) => {
                    const typeParam = p.types.join(',');
                    const active = currentDims === DYNAMIC_DRILLDOWN_DIMS && (searchParams?.productType ?? '') === typeParam;
                    return (
                      <Link
                        key={p.label}
                        href={dimensionsHref(DYNAMIC_DRILLDOWN_DIMS, typeParam)}
                        title={p.label}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium ${
                          active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:text-ink'
                        }`}
                      >
                        {p.iconDuo ? <IconDuo name={p.icon} /> : <Icon name={p.icon} />}
                        {p.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              {/* Kanal/Dobavljač premešteni IZNAD tabele/grafika, uz desnu ivicu (5.9.2026,
                  vlasnikov zahtev: "po kriterijumu kanal i dobavljac linkove stavite iznad desne
                  gornje ivice tabele") — vidi render tela izveštaja ispod, van ove forme.
                  Datumi + ručno polje za dimenzije u ISTOM redu (isti zahtev, "spojite u istu
                  liniju sa poljem za pretragu pojma") — svega dva reda za "Dinamički" umesto tri. */}
              <div className="flex flex-wrap items-end gap-2">
                <Field label="od (datum)">
                  <DateField name="from" defaultValue={searchParams?.from ?? ''} />
                </Field>
                <Field label="do (datum)">
                  <DateField name="to" defaultValue={searchParams?.to ?? ''} />
                </Field>
                <Field label="dimenzije (ručno, redosled zarezom)">
                  <input
                    name="groupBy"
                    defaultValue={currentDims}
                    placeholder={DYNAMIC_DIMENSIONS.join(',')}
                    className="input w-72"
                  />
                </Field>
              </div>
            </>
          )}
          <Button type="submit" variant="secondary" size="sm" className="border-transparent bg-brand text-brand-ink hover:bg-brand hover:brightness-90">
            primeni filter
          </Button>
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && tab === 'profitabilnost' && profitability && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
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
              <BucketTable title="Po destinaciji" buckets={profitability.byDestination} showMargin linkFor={destinationLinkFor} />
            ))}
          {profSub === 'dobavljac' &&
            (view === 'grafik' ? (
              <ChartSection title="Po dobavljaču/provajderu">
                <BarChart rows={profitability.bySupplier} series={PROFIT_SERIES} />
              </ChartSection>
            ) : (
              // Bez linka namerno — "Lista rezervacija" danas nema filter po dobavljaču
              // (poznat, svesno odložen nedostatak, vidi komentar uz `bookingsHref` iznad).
              <BucketTable title="Po dobavljaču/provajderu" buckets={profitability.bySupplier} showMargin />
            ))}
          {profSub === 'kanal' &&
            (view === 'grafik' ? (
              <ChartSection title="Po kanalu">
                <BarChart rows={profitability.byChannel} series={PROFIT_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po kanalu" buckets={profitability.byChannel} showMargin linkFor={channelLinkFor} />
            ))}
        </div>
      )}

      {!error && tab === 'prodaja' && sales && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
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
              <BucketTable title="Po kanalu" buckets={sales.byChannel} showMargin linkFor={channelLinkFor} />
            ))}
          {prodajaSub === 'tip' &&
            (view === 'grafik' ? (
              <ChartSection title="Po tipu proizvoda">
                <BarChart rows={sales.byProductType} series={REVENUE_SERIES} />
              </ChartSection>
            ) : (
              <BucketTable title="Po tipu proizvoda" buckets={sales.byProductType} showMargin linkFor={productTypeLinkFor} />
            ))}
        </div>
      )}

      {!error && tab === 'smestaj' && occupancy && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
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
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-2">
          {/* Kanal/Dobavljač — iznad desne gornje ivice tabele/grafika (5.9.2026, vlasnikov
              zahtev: "po kriterijumu kanal i dobavljac linkove stavite iznad desne gornje ivice
              tabele"), izmešteno iz filter forme iznad (bilo je treći red polja). */}
          <div className="flex justify-end gap-1">
            {DYNAMIC_OTHER_PRESETS.map((p) => {
              const active = currentDims === p.dims && !searchParams?.productType;
              return (
                <Link
                  key={p.label}
                  href={dimensionsHref(p.dims, p.productType)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:text-ink'
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
          {dynamicReport.tree.length === 0 ? (
            <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema rezultata za zadate filtere.</p>
          ) : view === 'grafik' ? (
            <ChartSection title="Prihod po najdubljem nivou (prati tabelu ispod)">
              <BarChart rows={(() => {
                const leaves: { key: string; revenue: number }[] = [];
                flattenDynamicLeaves(dynamicReport.tree, '', leaves);
                return leaves;
              })()} series={DYNAMIC_SERIES} />
            </ChartSection>
          ) : (
            <DynamicTree nodes={dynamicReport.tree} />
          )}
        </div>
      )}

      {!error && tab === 'marketing' && marketing && (
        <div id="izvestaj-sadrzaj" className="flex flex-col gap-4">
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
  const totalCount = breakdown.reduce((sum, b) => sum + b.count, 0);
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
            <tfoot>
              <tr className="border-t-2 border-border bg-sunken font-semibold text-ink">
                <td className="px-4 py-2">Ukupno</td>
                <td className="px-4 py-2 text-right font-mono">{totalCount.toLocaleString('sr-RS')}</td>
                <td className="px-4 py-2 text-right font-mono">{total.toLocaleString('sr-RS')}</td>
                <td className="px-4 py-2 text-right font-mono">100,0%</td>
              </tr>
            </tfoot>
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
function BucketTable({
  title,
  buckets,
  showMargin = false,
  linkFor,
}: {
  title: string;
  buckets: Bucket[];
  /** Profitabilnost/Prodaja (5.9.2026, vlasnikov zahtev: "tabela za profitabilnost i prodaju
   * treba da imaju neto kolonu, bruto kolonu, marzu u procentima, marzu u iznosu") — kad je
   * `true`, "prihod" kolona se deli na Neto (`baseCost`)/Bruto (`revenue`) + Marža % (marža kao
   * udeo BRUTO cene ovog reda, "razlika u ceni") + Marža (iznos), pored postojećeg Udela
   * (procenat u odnosu na ukupan bruto promet ove tabele — "ostavite i % u odnosu na total"). */
  showMargin?: boolean;
  /** Link ka rezervacijama koje čine ovaj red (5.9.2026, vlasnikov zahtev: "omogucite da sve sto
   * se nalazi u tabelama linkujete prema rezervacijama"). Izostavljen prop = red ostaje običan
   * tekst — koristi se za grupe koje "Lista rezervacija" danas ne ume da filtrira (dobavljač,
   * marketing sadržaj), poznat i svesno odložen nedostatak, ne ćutanje. */
  linkFor?: (bucket: Bucket) => string;
}) {
  // Udeo u procentima (4.9.2026, na zahtev vlasnika: "prikazite i u % u obe vrste izvestaja")
  // — udeo reda u zbiru CELE grupe (svih redova, ne samo prikazanih), ne u ukupnom prometu
  // agencije — "koliki deo OVOG rasporeda nosi ova destinacija/kanal/dobavljač".
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
  const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
  const totalBaseCost = buckets.reduce((sum, b) => sum + b.baseCost, 0);
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
                {showMargin ? (
                  <>
                    <th className="px-4 py-2 text-right font-medium">neto</th>
                    <th className="px-4 py-2 text-right font-medium">bruto</th>
                    <th className="px-4 py-2 text-right font-medium">marža %</th>
                    <th className="px-4 py-2 text-right font-medium">marža</th>
                  </>
                ) : (
                  <th className="px-4 py-2 text-right font-medium">prihod</th>
                )}
                <th className="px-4 py-2 text-right font-medium">udeo</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b, i) => {
                const href = linkFor?.(b);
                const nameCell = href ? (
                  <Link href={href} className="text-brand hover:underline" title="Prikaži rezervacije koje čine ovaj red">
                    {b.key}
                  </Link>
                ) : (
                  b.key
                );
                return (
                  <tr key={b.key} className={i % 2 === 1 ? 'bg-panel2/40' : undefined}>
                    <td className="border-t border-border px-4 py-2 font-medium text-ink">{nameCell}</td>
                    <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{b.count.toLocaleString('sr-RS')}</td>
                    {showMargin ? (
                      <>
                        <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.baseCost)}</td>
                        <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.revenue)}</td>
                        <td className="border-t border-border px-4 py-2 text-right">
                          <PctBadge value={formatPct(b.margin, b.revenue)} />
                        </td>
                        <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.margin)}</td>
                      </>
                    ) : (
                      <td className="border-t border-border px-4 py-2 text-right font-mono text-ink-dim">{formatMoney(b.revenue)}</td>
                    )}
                    <td className="border-t border-border px-4 py-2 text-right">
                      <PctBadge value={formatPct(b.revenue, totalRevenue)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totali (5.9.2026, vlasnikov zahtev: "nigde nemate totale, treba i to da uvedete") —
                zbir cele tabele, ne samo prikazanih redova (ovde su svi redovi uvek prikazani,
                bez straničenja). */}
            <tfoot>
              <tr className="border-t-2 border-border bg-sunken font-semibold text-ink">
                <td className="px-4 py-2">Ukupno</td>
                <td className="px-4 py-2 text-right font-mono">{totalCount.toLocaleString('sr-RS')}</td>
                {showMargin ? (
                  <>
                    <td className="px-4 py-2 text-right font-mono">{formatMoney(totalBaseCost)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatMoney(totalRevenue)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatPct(totalMargin, totalRevenue)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatMoney(totalMargin)}</td>
                  </>
                ) : (
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(totalRevenue)}</td>
                )}
                <td className="px-4 py-2 text-right font-mono">100,0%</td>
              </tr>
            </tfoot>
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
