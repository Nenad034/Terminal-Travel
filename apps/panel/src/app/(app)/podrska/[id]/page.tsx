import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TicketMessagesPanel from './TicketMessagesPanel';
import TicketStatusForm from './TicketStatusForm';


interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel: string;
  refundDecision: boolean;
  zzpResponseDeadline: string | null;
  zzpEscalatedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  relatedBooking: { id: string; bookingNumber: string; status: string } | null;
}

interface TicketMessage {
  id: string;
  senderType: 'REQUESTER' | 'STAFF' | 'AI_DRAFT';
  body: string;
  isInternalNote: boolean;
  sentBy: string | null;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 5) — detalj tiketa: kontekst rezervacije uživo iz M5 (§7 izlazni
// kriterijum, bez dupliranja podataka), zakonski rok reklamacije (§3.1), nit poruka i izmena
// statusa/prioriteta/dodele/odluke o povraćaju (§6, M14/ticket/RESPOND).
export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canRespond = hasPermission(me, 'M14', 'ticket', 'RESPOND');

  let ticket: Ticket;
  let messages: TicketMessage[] = [];
  try {
    ticket = await apiFetch<Ticket>(`/helpdesk/tickets/${params.id}`);
    messages = await apiFetch<TicketMessage[]>(`/helpdesk/tickets/${params.id}/messages`);
  } catch {
    notFound();
  }

  const zzpOverdue =
    ticket.category === 'REKLAMACIJA' &&
    ticket.zzpResponseDeadline &&
    new Date(ticket.zzpResponseDeadline) < new Date() &&
    ticket.status !== 'RESOLVED' &&
    ticket.status !== 'CLOSED';

  return (
    <div className="p-6">
      <RegisterTab label={ticket.ticketNumber} />
      <Link href="/podrska" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na listu
      </Link>

      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">{ticket.ticketNumber}</h1>
        <p className="mt-1 text-sm text-ink">{ticket.subject}</p>
        <p className="text-xs text-ink-faint">
          {ticket.category} · {ticket.channel} · otvoren {new Date(ticket.createdAt).toLocaleString('sr-RS')}
          {ticket.resolvedAt && ` · rešen ${new Date(ticket.resolvedAt).toLocaleString('sr-RS')}`}
        </p>
      </div>

      {ticket.category === 'REKLAMACIJA' && (
        <div className={`mb-4 rounded-lg border p-3 text-xs ${ticket.zzpEscalatedAt || zzpOverdue ? 'border-danger bg-danger-bg text-danger' : 'border-border bg-panel text-ink-dim'}`}>
          <Icon name="law" /> Reklamacija — zakonski rok odgovora (Zakon o zaštiti potrošača, M14 spec §3.1):{' '}
          <b>{ticket.zzpResponseDeadline ? new Date(ticket.zzpResponseDeadline).toLocaleDateString('sr-RS') : '—'}</b>
          {ticket.zzpEscalatedAt && <span className="ml-2 font-semibold">— eskalirano menadžmentu {new Date(ticket.zzpEscalatedAt).toLocaleString('sr-RS')}</span>}
          {!ticket.zzpEscalatedAt && zzpOverdue && <span className="ml-2 font-semibold">— rok prekoračen</span>}
        </div>
      )}

      {ticket.relatedBooking && (
        <Link
          href={`/rezervacije/${ticket.relatedBooking.id}`}
          className="mb-4 flex items-center justify-between rounded-lg border border-border bg-panel p-3 text-xs hover:border-accent"
        >
          <span>
            <Icon name="link" /> vezana rezervacija: <b className="text-ink">{ticket.relatedBooking.bookingNumber}</b>
          </span>
          <span className="text-ink-faint">{ticket.relatedBooking.status}</span>
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <TicketMessagesPanel ticketId={ticket.id} messages={messages} canRespond={canRespond} />
        {canRespond && (
          <TicketStatusForm
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            category={ticket.category}
            refundDecision={ticket.refundDecision}
          />
        )}
      </div>
    </div>
  );
}
