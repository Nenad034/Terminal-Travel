import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel: string;
  zzpResponseDeadline: string | null;
  zzpEscalatedAt: string | null;
  createdAt: string;
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const CATEGORIES = ['REZERVACIJA', 'PLACANJE', 'TEHNICKI_PROBLEM', 'REKLAMACIJA', 'DRUGO'];

// M17 spec §4/§7 (Faza 5) — "Podrška", M14 §6 GET /tickets ("lista, prava po ulozi" — interni
// tim vidi sve tikete kojima ima pristup, servis sam sužava obim za Prodajni agent po M14 spec
// §5 ownership pravilu, ova stranica ne dupliramo tu logiku).
export default async function PodrskaPage({ searchParams }: { searchParams: { status?: string; category?: string } }) {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M14', 'ticket', 'CREATE');

  let tickets: Ticket[] = [];
  let error: string | null = null;
  try {
    tickets = await apiFetch<Ticket[]>('/helpdesk/tickets');
  } catch {
    error = 'Nemate dozvolu za uvid u tikete (M14/ticket/VIEW).';
  }

  const filtered = tickets.filter(
    (t) => (!searchParams?.status || t.status === searchParams.status) && (!searchParams?.category || t.category === searchParams.category),
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Podrška" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls podrska/tiketi/
          </h1>
          <p className="text-xs text-ink-dim">Tiketing za goste i subagente — M14.</p>
        </div>
        {canCreate && (
          <Link href="/podrska/novi" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
            <Icon name="add" /> novi tiket
          </Link>
        )}
      </div>

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/podrska">
          <select name="status" defaultValue={searchParams?.status ?? ''} className="input">
            <option value="">svi statusi</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={searchParams?.category ?? ''} className="input">
            <option value="">sve kategorije</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
            filtriraj
          </button>
          {(searchParams?.status || searchParams?.category) && (
            <Link href="/podrska" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema tiketa.</p>}
          {filtered.map((t) => {
            const zzpOverdue = t.category === 'REKLAMACIJA' && t.zzpResponseDeadline && new Date(t.zzpResponseDeadline) < new Date() && t.status !== 'RESOLVED' && t.status !== 'CLOSED';
            return (
              <Link
                key={t.id}
                href={`/podrska/${t.id}`}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div>
                  <div className="font-medium text-ink">
                    {t.ticketNumber} — {t.subject}
                    {t.category === 'REKLAMACIJA' && <span className="ml-2 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger">REKLAMACIJA</span>}
                    {t.zzpEscalatedAt && <span className="ml-2 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger">ZZP eskalirano</span>}
                    {zzpOverdue && !t.zzpEscalatedAt && <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-[10px] text-warn">rok prekoračen</span>}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {t.category} · {t.channel} · {new Date(t.createdAt).toLocaleDateString('sr-RS')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'RESOLVED' || status === 'CLOSED' ? 'text-ok bg-ok-bg' : status === 'IN_PROGRESS' ? 'text-accent bg-accent-soft' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === 'URGENT' || priority === 'HIGH' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{priority}</span>;
}
