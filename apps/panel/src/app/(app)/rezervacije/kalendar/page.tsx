import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';

interface DaySummary {
  date: string;
  arrivalsCount: number;
  departuresCount: number;
  stayoversCount: number;
  singleDayCount: number;
}

interface DayDetailEntry {
  bookingItemId: string;
  bookingId: string;
  bookingNumber: string;
  productId: string;
  status: string;
  guests: string[];
}

interface DayDetail {
  ARRIVAL: DayDetailEntry[];
  DEPARTURE: DayDetailEntry[];
  STAYOVER: DayDetailEntry[];
  SINGLE_DAY: DayDetailEntry[];
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

// M17 spec §4 (Faza 1) — "Kalendar rezervacija", M5 §7 calendar-summary/calendar/:date.
export default async function CalendarPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const now = new Date();
  const month = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { from, to } = monthRange(month);

  let days: DaySummary[] = [];
  let error: string | null = null;
  try {
    days = await apiFetch<DaySummary[]>(`/sales/bookings/calendar-summary?from=${from}&to=${to}`);
  } catch {
    error = 'Kalendar trenutno nije dostupan (M5/booking/VIEW).';
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  let dayDetail: DayDetail | null = null;
  if (searchParams.date) {
    try {
      dayDetail = await apiFetch<DayDetail>(`/sales/bookings/calendar/${searchParams.date}`);
    } catch {
      dayDetail = null;
    }
  }

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // ponedeljak = 0
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <RegisterTab label="Kalendar rezervacija" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> kalendar/{month}
        </h1>
        <div className="flex gap-2 text-xs">
          <Link href={`?month=${prevMonth}`} className="rounded border border-border px-2 py-1 hover:border-accent">
            ‹
          </Link>
          <Link href={`?month=${nextMonth}`} className="rounded border border-border px-2 py-1 hover:border-accent">
            ›
          </Link>
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
          {['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'].map((d) => (
            <div key={d} className="pb-1 text-ink-faint">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dateStr = `${month}-${String(i + 1).padStart(2, '0')}`;
            const d = byDate.get(dateStr);
            const active = searchParams.date === dateStr;
            return (
              <Link
                key={dateStr}
                href={`?month=${month}&date=${dateStr}`}
                className={`flex flex-col items-center gap-0.5 rounded border p-1.5 hover:border-accent ${active ? 'border-accent bg-accent-soft' : 'border-border bg-panel'}`}
              >
                <span className="text-ink">{i + 1}</span>
                {d && (d.arrivalsCount > 0 || d.departuresCount > 0 || d.stayoversCount > 0) && (
                  <span className="flex gap-0.5">
                    {d.arrivalsCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-ok" title={`${d.arrivalsCount} dolazak`} />}
                    {d.departuresCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warn" title={`${d.departuresCount} odlazak`} />}
                    {d.stayoversCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent2" title={`${d.stayoversCount} u toku`} />}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {searchParams.date && dayDetail && (
        <div className="mt-6 rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">{searchParams.date}</h2>
          <DaySection title="Dolasci" entries={dayDetail.ARRIVAL} />
          <DaySection title="Odlasci" entries={dayDetail.DEPARTURE} />
          <DaySection title="U toku" entries={dayDetail.STAYOVER} />
          <DaySection title="Jednodnevno" entries={dayDetail.SINGLE_DAY} />
        </div>
      )}
    </div>
  );
}

function DaySection({ title, entries }: { title: string; entries: DayDetailEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-xs font-medium text-ink-faint">{title}</h3>
      <div className="flex flex-col gap-1">
        {entries.map((e) => (
          <Link key={e.bookingItemId} href={`/rezervacije/${e.bookingId}`} className="rounded bg-panel2 px-2 py-1 text-xs text-ink hover:border hover:border-accent">
            {e.bookingNumber} — {e.guests.join(', ') || 'bez imena gosta'}
          </Link>
        ))}
      </div>
    </div>
  );
}
