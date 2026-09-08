import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import {
  MONTHS_SR,
  WEEKDAYS_SHORT_SR,
  addDays,
  addMonths,
  isoOf,
  parseIso,
  startOfMonth,
  endOfMonth,
  startOfWeekMonday,
  todayIso,
} from '@/lib/calendar-date';

interface CalendarEntry {
  id: string;
  type: 'GODISNJI_ODMOR' | 'BOLOVANJE' | 'NEPLACENO_ODSUSTVO' | 'OSTALO';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  startDate: string;
  endDate: string;
  daysCount: number;
  note: string | null;
  employee: { id: string; fullName: string };
}

// M24 spec §3b — traženo/odobreno-nerealizovano/realizovano. Poslednja dva su APPROVED
// razdvojen poređenjem sa danas (dopuna 8.9.2026), ne novo polje.
type DayCategory = 'pending' | 'approved-future' | 'approved-past';

const LEAVE_TYPE_LABEL: Record<CalendarEntry['type'], string> = {
  GODISNJI_ODMOR: 'Godišnji odmor',
  BOLOVANJE: 'Bolovanje',
  NEPLACENO_ODSUSTVO: 'Neplaćeno odsustvo',
  OSTALO: 'Ostalo',
};

const DOT_CLASS: Record<DayCategory, string> = {
  pending: 'bg-warn',
  'approved-future': 'bg-accent',
  'approved-past': 'bg-ok',
};

// M24 spec §3b (8.9.2026, vlasnikov zahtev) — timski/deljen kalendar odsustava, ne samo lični
// prikaz. Otvoren svakom prijavljenom STAFF nalogu (isti obrazac kao API: `GET /hr/leave/calendar`
// nema @RequirePermission — vidljivost APPROVED/PENDING razdvaja servis, ne ova stranica).
// Mesečni grid preuzima logiku iz `@/lib/calendar-date.ts`, već deljenu sa "Kalendar rezervacija"
// (M5) — ne piše se nova datumska aritmetika. Godišnji prikaz (dopuna 8.9.2026, isti dan) je
// isti podatak, samo grupisan po sva 12 meseca odjednom.
export default async function KalendarOdsustavaPage(props: {
  searchParams: Promise<{ m?: string; y?: string; branchId?: string; view?: string }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const view = searchParams.view === 'year' ? 'year' : 'month';
  const branchId = searchParams.branchId?.trim() || undefined;

  const branches = await apiFetch<{ id: string; name: string }[]>('/iam/branches').catch(
    () => [],
  );

  return (
    <div className="p-6">
      <RegisterTab label="Kalendar odsustava" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Kalendar odsustava</h1>
      <p className="mb-4 max-w-2xl text-xs text-ink-faint">
        Odobrena odsustva vidljiva su celom timu. Zahtevi koji čekaju odluku (žuta tačka) vidljivi
        su samo podnosiocu, njegovom neposrednom rukovodiocu i HR/Direktoru/Vlasniku.
      </p>

      {view === 'year' ? (
        <YearView branchId={branchId} branches={branches} year={searchParams.y} />
      ) : (
        <MonthView branchId={branchId} branches={branches} m={searchParams.m} me={me?.userId} />
      )}
    </div>
  );
}

function BranchFilterForm({
  branches,
  hidden,
  branchId,
}: {
  branches: { id: string; name: string }[];
  hidden: Record<string, string>;
  branchId?: string;
}) {
  if (branches.length === 0) return null;
  return (
    <form method="get" className="flex items-center gap-1.5 text-xs">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="text-ink-faint">poslovnica</label>
      <select name="branchId" defaultValue={branchId ?? ''} className="input">
        <option value="">sve</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded bg-brand px-2 py-1 font-medium text-brand-ink">
        primeni
      </button>
    </form>
  );
}

async function MonthView({
  branchId,
  branches,
  m,
  me,
}: {
  branchId?: string;
  branches: { id: string; name: string }[];
  m?: string;
  me: string | undefined;
}) {
  const anchorIso = m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : todayIso();
  const anchor = parseIso(anchorIso);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(startOfWeekMonday(monthEnd), 6);

  const { approved, pending } = await apiFetch<{
    approved: CalendarEntry[];
    pending: CalendarEntry[];
  }>(
    `/hr/leave/calendar?from=${isoOf(monthStart)}&to=${isoOf(monthEnd)}${branchId ? `&branchId=${branchId}` : ''}`,
  ).catch(() => ({ approved: [], pending: [] }));

  const byDate = buildByDate([...approved, ...pending], monthStart, monthEnd);

  const cells: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(isoOf(d));

  const prevMonth = isoOf(addMonths(monthStart, -1)).slice(0, 7);
  const nextMonth = isoOf(addMonths(monthStart, 1)).slice(0, 7);
  const monthLabel = `${MONTHS_SR[monthStart.getMonth()]} ${monthStart.getFullYear()}.`;
  const currentYear = monthStart.getFullYear();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/kalendar-odsustava?m=${prevMonth}`}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-panel-2"
          >
            <Icon name="chevron-left" />
          </Link>
          <span className="text-sm font-medium text-ink">{monthLabel}</span>
          <Link
            href={`/kalendar-odsustava?m=${nextMonth}`}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-panel-2"
          >
            <Icon name="chevron-right" />
          </Link>
          <Link
            href={`/kalendar-odsustava?view=year&y=${currentYear}${branchId ? `&branchId=${branchId}` : ''}`}
            className="ml-2 text-xs text-accent-strong hover:underline"
          >
            Prikaži celu godinu
          </Link>
        </div>
        <BranchFilterForm
          branches={branches}
          branchId={branchId}
          hidden={{ m: isoOf(monthStart).slice(0, 7) }}
        />
      </div>

      <Legend />

      <div className="max-w-3xl rounded-lg border border-border bg-panel p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
          {WEEKDAYS_SHORT_SR.map((d) => (
            <div key={d} className="pb-1 text-ink-faint">
              {d}
            </div>
          ))}
          {cells.map((dateStr) => {
            const inMonth = dateStr >= isoOf(monthStart) && dateStr <= isoOf(monthEnd);
            const cats = byDate.get(dateStr);
            const isToday = dateStr === todayIso();
            return (
              <div
                key={dateStr}
                className={`flex min-h-[52px] flex-col items-center gap-1 rounded border p-1 ${
                  isToday ? 'border-accent bg-accent-soft' : 'border-border bg-panel'
                } ${inMonth ? '' : 'opacity-40'}`}
              >
                <span className="text-ink">{Number(dateStr.slice(8, 10))}</span>
                {cats && <DayDots categories={cats} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <EntryList title="Odobreno ovog meseca" entries={approved} />
        <EntryList title="Čeka odobrenje" entries={pending} />
      </div>
    </>
  );
}

async function YearView({
  branchId,
  branches,
  year,
}: {
  branchId?: string;
  branches: { id: string; name: string }[];
  year?: string;
}) {
  const y = year && /^\d{4}$/.test(year) ? Number(year) : new Date().getFullYear();
  const yearStart = new Date(y, 0, 1);
  const yearEnd = new Date(y, 11, 31);

  const { approved, pending } = await apiFetch<{
    approved: CalendarEntry[];
    pending: CalendarEntry[];
  }>(
    `/hr/leave/calendar?from=${isoOf(yearStart)}&to=${isoOf(yearEnd)}${branchId ? `&branchId=${branchId}` : ''}`,
  ).catch(() => ({ approved: [], pending: [] }));

  const byDate = buildByDate([...approved, ...pending], yearStart, yearEnd);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/kalendar-odsustava?view=year&y=${y - 1}${branchId ? `&branchId=${branchId}` : ''}`}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-panel-2"
          >
            <Icon name="chevron-left" />
          </Link>
          <span className="text-sm font-medium text-ink">{y}.</span>
          <Link
            href={`/kalendar-odsustava?view=year&y=${y + 1}${branchId ? `&branchId=${branchId}` : ''}`}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-panel-2"
          >
            <Icon name="chevron-right" />
          </Link>
          <Link
            href={`/kalendar-odsustava${branchId ? `?branchId=${branchId}` : ''}`}
            className="ml-2 text-xs text-accent-strong hover:underline"
          >
            Nazad na mesečni prikaz
          </Link>
        </div>
        <BranchFilterForm branches={branches} branchId={branchId} hidden={{ view: 'year', y: String(y) }} />
      </div>

      <Legend />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonth key={m} year={y} month={m} byDate={byDate} />
        ))}
      </div>
    </>
  );
}

function MiniMonth({
  year,
  month,
  byDate,
}: {
  year: number;
  month: number;
  byDate: Map<string, Set<DayCategory>>;
}) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = startOfWeekMonday(monthStart);
  const cells: string[] = [];
  for (let d = gridStart, i = 0; i < 42; d = addDays(d, 1), i++) cells.push(isoOf(d));

  return (
    <div className="rounded-lg border border-border bg-panel p-2">
      <p className="mb-1 text-center text-xs font-semibold capitalize text-ink">
        {MONTHS_SR[month]}
      </p>
      <div className="grid grid-cols-7 gap-px text-center text-[9px]">
        {cells.map((dateStr) => {
          const inMonth = dateStr >= isoOf(monthStart) && dateStr <= isoOf(monthEnd);
          const cats = byDate.get(dateStr);
          if (!inMonth) return <div key={dateStr} />;
          return (
            <div key={dateStr} className="flex flex-col items-center py-0.5">
              <span className="text-ink-faint">{Number(dateStr.slice(8, 10))}</span>
              {cats && cats.size > 0 && (
                <span className={`mt-px h-1 w-1 rounded-full ${DOT_CLASS[pickPrimary(cats)]}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Prioritet prikaza kad se više stanja poklopi istog dana: traženo je najhitnije (čeka odluku),
// pa odobreno-nerealizovano, pa realizovano (već prošlo, najmanje aktuelno).
function pickPrimary(cats: Set<DayCategory>): DayCategory {
  if (cats.has('pending')) return 'pending';
  if (cats.has('approved-future')) return 'approved-future';
  return 'approved-past';
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" /> traženo
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> odobreno
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" /> realizovano
      </span>
    </div>
  );
}

function DayDots({ categories }: { categories: Set<DayCategory> }) {
  return (
    <span className="flex gap-0.5">
      {(['pending', 'approved-future', 'approved-past'] as const).map(
        (cat) =>
          categories.has(cat) && (
            <span key={cat} className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[cat]}`} />
          ),
      )}
    </span>
  );
}

function EntryList({ title, entries }: { title: string; entries: CalendarEntry[] }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema zapisa u ovom mesecu.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-xs">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>
                <Link href={`/korisnici/${e.employee.id}`} className="hover:text-accent-strong">
                  {e.employee.fullName}
                </Link>{' '}
                — <Badge variant="secondary">{LEAVE_TYPE_LABEL[e.type]}</Badge>{' '}
                {e.startDate.slice(0, 10)} – {e.endDate.slice(0, 10)}
              </span>
              <span className="text-ink-faint">{e.daysCount} dana</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// M24 spec §3b — "odobreno-nerealizovano" naspram "realizovano" se određuje PO DANU (poređenje
// tog konkretnog dana sa danas), ne po celom periodu — odsustvo koje je u toku tako ispravno
// pokazuje prošle dane kao realizovane i preostale kao nerealizovane u istom prikazu.
function buildByDate(
  entries: CalendarEntry[],
  rangeStart: Date,
  rangeEnd: Date,
): Map<string, Set<DayCategory>> {
  const byDate = new Map<string, Set<DayCategory>>();
  const today = todayIso();
  for (const e of entries) {
    for (const d of enumerateOverlap(e, rangeStart, rangeEnd)) {
      const category: DayCategory =
        e.status === 'PENDING' ? 'pending' : d < today ? 'approved-past' : 'approved-future';
      const set = byDate.get(d) ?? new Set<DayCategory>();
      set.add(category);
      byDate.set(d, set);
    }
  }
  return byDate;
}

function enumerateOverlap(entry: CalendarEntry, rangeStart: Date, rangeEnd: Date): string[] {
  const start = parseIso(entry.startDate.slice(0, 10));
  const end = parseIso(entry.endDate.slice(0, 10));
  const from = start < rangeStart ? rangeStart : start;
  const to = end > rangeEnd ? rangeEnd : end;
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(isoOf(d));
  return out;
}
