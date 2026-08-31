import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import EmailMessagesPanel from './EmailMessagesPanel';
import ThreadActionsPanel from './ThreadActionsPanel';


interface EmailMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'CORRESPONDENT' | 'STAFF' | 'AI_DRAFT';
  fromAddress: string;
  body: string;
  aiSummary: string | null;
  sentBy: string | null;
  receivedAt: string;
}

interface EmailThreadDetail {
  id: string;
  mailboxId: string;
  subject: string;
  correspondentType: 'GUEST' | 'SUBAGENT' | 'SUPPLIER' | 'OTHER';
  relatedBookingId: string | null;
  relatedSupplierManifestId: string | null;
  relatedSupplierChangeNoticeId: string | null;
  status: 'OPEN' | 'AWAITING_REPLY' | 'CLOSED';
  convertedToTicketId: string | null;
  lastMessageAt: string;
  messages: EmailMessage[];
  mailbox: { address: string; displayName: string };
}

// M17 spec §4/§7 (Faza 7, rešeno M17 Faza 7 zatvaranje nedostataka), M22 spec §2.3/§2.4/§8 —
// detalj niti sa svim porukama. Vidljivost je GET /email/threads/:id, gejtovana MailboxAccess
// (bilo koji nivo) na sanduče niti u servisnom sloju (dvoslojna kontrola, spec §2.2/§7) — 404 ako
// nit ne postoji, 403 ako pozivalac nema MailboxAccess za sanduče (bez obzira na ulogu, isti
// obrazac kao M19 SupplierConversationAccess). Odgovor sada uključuje `mailbox.address`/
// `mailbox.displayName` (isti proširen payload kao lista niti).
export default async function EmailThreadDetailPage(props: { params: Promise<{ threadId: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canReply = hasPermission(me, 'M22', 'email-thread', 'REPLY');
  const canConvert = hasPermission(me, 'M22', 'email-thread', 'CONVERT_TO_TICKET');

  let thread: EmailThreadDetail;
  try {
    thread = await apiFetch<EmailThreadDetail>(`/email/threads/${params.threadId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="p-6">
        <RegisterTab label="Email nit" />
        <Link href="/email" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
          <Icon name="arrow-left" /> nazad na inbox
        </Link>
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">
          Nemate pristup ovoj niti (potreban MailboxAccess za sanduče niti, M22 spec §2.2).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <RegisterTab label={thread.subject} />
      <Link href="/email" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na inbox
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> email/niti/{thread.id.slice(0, 8)}
          </h1>
          <p className="mt-1 text-sm text-ink">{thread.subject}</p>
          <p className="text-xs text-ink-faint">
            {thread.mailbox.displayName || thread.mailbox.address} · {thread.correspondentType} · poslednja poruka{' '}
            {new Date(thread.lastMessageAt).toLocaleString('sr-RS')}
          </p>
        </div>
        <StatusBadge status={thread.status} />
      </div>

      {thread.convertedToTicketId && (
        <Link
          href={`/podrska/${thread.convertedToTicketId}`}
          className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-panel p-3 text-xs hover:border-accent"
        >
          <Icon name="link" /> konvertovano u tiket — otvori
        </Link>
      )}
      {thread.relatedBookingId && (
        <Link
          href={`/rezervacije/${thread.relatedBookingId}`}
          className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-panel p-3 text-xs hover:border-accent"
        >
          <Icon name="link" /> vezana rezervacija <span className="text-ink-faint">({thread.relatedBookingId})</span>
        </Link>
      )}
      {(thread.relatedSupplierManifestId || thread.relatedSupplierChangeNoticeId) && (
        <div className="mb-4 rounded-lg border border-border bg-panel p-3 text-xs text-ink-dim">
          <Icon name="package" /> najava dobavljača povezana ({thread.relatedSupplierManifestId ? 'najava rezervacije' : 'najava izmene/storna'}) — konačna
          potvrda ide isključivo kroz M5/supplier-confirmation/CONFIRM (spec §3.1a).
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <EmailMessagesPanel threadId={thread.id} messages={thread.messages} canReply={canReply} />
        {(canReply || canConvert) && (
          <ThreadActionsPanel threadId={thread.id} canReply={canReply} canConvert={canConvert} alreadyConverted={!!thread.convertedToTicketId} />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'CLOSED' ? 'text-ink-faint bg-panel2' : status === 'AWAITING_REPLY' ? 'text-warn bg-warn-bg' : 'text-accent-strong bg-accent-soft';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
