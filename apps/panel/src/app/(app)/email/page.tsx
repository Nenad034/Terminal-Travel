import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface EmailThread {
  id: string;
  mailboxId: string;
  subject: string;
  correspondentType: 'GUEST' | 'SUBAGENT' | 'SUPPLIER' | 'OTHER';
  status: 'OPEN' | 'AWAITING_REPLY' | 'CLOSED';
  convertedToTicketId: string | null;
  lastMessageAt: string;
  mailbox: { address: string; displayName: string };
}

const STATUSES = ['OPEN', 'AWAITING_REPLY', 'CLOSED'];
const CORRESPONDENT_TYPES = ['GUEST', 'SUBAGENT', 'SUPPLIER', 'OTHER'];

// M17 spec §4/§7 (Faza 7, rešeno M17 Faza 7 zatvaranje nedostataka), M22 spec §8 — GET
// /email/threads vraća SAMO niti iz sandučadi na koje pozivalac ima MailboxAccess (bilo koji
// nivo, §2.2) — ova stranica ne dodaje sopstveni filter pristupa, samo prikazuje šta API vrati
// (isti princip kao M19 chat/dobavljaci/page.tsx). Odgovor sada uključuje `mailbox.address` i
// `mailbox.displayName` (čisto proširenje payload-a već autorizovanog upita — pozivalac već ima
// MailboxAccess na svako sanduče koje ovde vidi), pa se GET /email/mailboxes (M22/mailbox/VIEW,
// Vlasnik/Direktor) više ne mora pozivati samo da bi se ime sandučeta prikazalo.
export default async function EmailInboxPage(
  props: {
    searchParams: Promise<{ mailboxId?: string; status?: string; correspondentType?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canManageMailboxes = hasPermission(me, 'M22', 'mailbox', 'VIEW');

  let threads: EmailThread[] = [];
  let error: string | null = null;
  try {
    threads = await apiFetch<EmailThread[]>('/email/threads');
  } catch {
    error = 'Nemate pristup nijednoj niti (M22/email-thread/VIEW, ili nemate MailboxAccess ni za jedno sanduče — spec §2.2).';
  }

  const mailboxMap = new Map(threads.map((t) => [t.mailboxId, t.mailbox]));
  function mailboxLabel(id: string): string {
    const mb = mailboxMap.get(id);
    return mb ? mb.displayName || mb.address : `sanduče ${id.slice(0, 8)}…`;
  }

  const mailboxIdsInThreads = Array.from(new Set(threads.map((t) => t.mailboxId)));

  const filtered = threads.filter(
    (t) =>
      (!searchParams?.mailboxId || t.mailboxId === searchParams.mailboxId) &&
      (!searchParams?.status || t.status === searchParams.status) &&
      (!searchParams?.correspondentType || t.correspondentType === searchParams.correspondentType),
  );

  return (
    <div className="p-6">
      <RegisterTab label="Email/Inbox" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Email/Inbox</h1>
        </div>
        {canManageMailboxes && (
          <Button asChild variant="secondary" size="sm">
            <Link href="/email/sanducad" className="flex items-center gap-1.5">
              <Icon name="settings-gear" /> sandučad
            </Link>
          </Button>
        )}
      </div>

      {!error && (
        <form className="mb-3 flex flex-wrap gap-2 text-xs" action="/email">
          <select name="mailboxId" defaultValue={searchParams?.mailboxId ?? ''} className="input">
            <option value="">sva sandučad</option>
            {mailboxIdsInThreads.map((id) => (
              <option key={id} value={id}>
                {mailboxLabel(id)}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={searchParams?.status ?? ''} className="input">
            <option value="">svi statusi</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="correspondentType" defaultValue={searchParams?.correspondentType ?? ''} className="input">
            <option value="">svi tipovi korespondenta</option>
            {CORRESPONDENT_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm" className="border-transparent bg-brand text-brand-ink hover:bg-brand hover:brightness-90">
            filtriraj
          </Button>
          {(searchParams?.mailboxId || searchParams?.status || searchParams?.correspondentType) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/email">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema niti.</p>}
          {filtered.map((t) => (
            <TabLink
              key={t.id}
              href={`/email/${t.id}`}
              label={t.subject}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {t.subject}
                  {t.convertedToTicketId && (
                    <Badge variant="secondary" className="ml-2 bg-accent-soft text-accent-strong">
                      tiket
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-ink-faint">
                  {mailboxLabel(t.mailboxId)} · {t.correspondentType} · {new Date(t.lastMessageAt).toLocaleString('sr-RS')}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </TabLink>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CLOSED') return (
    <Badge variant="secondary" className="text-ink-faint">
      {status}
    </Badge>
  );
  if (status === 'AWAITING_REPLY') return <Badge variant="warn">{status}</Badge>;
  return (
    <Badge variant="secondary" className="bg-accent-soft text-accent-strong">
      {status}
    </Badge>
  );
}
