import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


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
export default async function PodrskaPage(props: { searchParams: Promise<{ status?: string; category?: string }> }) {
  const searchParams = await props.searchParams;
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
    <div className="p-6">
      <RegisterTab label="Podrška" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Podrška</h1>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/podrska/novi" className="flex items-center gap-1.5">
              <Icon name="add" /> novi tiket
            </Link>
          </Button>
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
          <Button type="submit" variant="secondary" size="sm">
            filtriraj
          </Button>
          {(searchParams?.status || searchParams?.category) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/podrska">obriši filter</Link>
            </Button>
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
              <TabLink
                key={t.id}
                href={`/podrska/${t.id}`}
                label={`${t.ticketNumber} — ${t.subject}`}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div>
                  <div className="font-medium text-ink">
                    {t.ticketNumber} — {t.subject}
                    {t.category === 'REKLAMACIJA' && (
                      <Badge variant="danger" className="ml-2">
                        REKLAMACIJA
                      </Badge>
                    )}
                    {t.zzpEscalatedAt && (
                      <Badge variant="danger" className="ml-2">
                        ZZP eskalirano
                      </Badge>
                    )}
                    {zzpOverdue && !t.zzpEscalatedAt && (
                      <Badge variant="warn" className="ml-2">
                        rok prekoračen
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {t.category} · {t.channel} · {new Date(t.createdAt).toLocaleDateString('sr-RS')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </TabLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'RESOLVED' || status === 'CLOSED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'IN_PROGRESS') return (
    <Badge variant="secondary" className="bg-accent-soft text-accent-strong">
      {status}
    </Badge>
  );
  return <Badge variant="warn">{status}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'URGENT' || priority === 'HIGH') return <Badge variant="danger">{priority}</Badge>;
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {priority}
    </Badge>
  );
}
