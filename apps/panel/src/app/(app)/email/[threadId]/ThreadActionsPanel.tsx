'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { linkBooking, linkSupplierAnnouncement, convertToTicket, FormState } from '../actions';

const initialState: FormState = { error: null };

// M22 spec §3.1a/§3.2/§5/§8 — ručne veze i konverzija u tiket. Sve gejtovano server-side u
// page.tsx (hide, not disable) — link-* zahteva REPLY, konverzija CONVERT_TO_TICKET (§7). M22
// sam nikad ne piše u M5 supplier_confirmed_at/by — link-supplier-announcement upisuje isključivo
// weak-ref polje na niti (§3.1a).
export default function ThreadActionsPanel({
  threadId,
  canReply,
  canConvert,
  alreadyConverted,
}: {
  threadId: string;
  canReply: boolean;
  canConvert: boolean;
  alreadyConverted: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canReply && <LinkBookingForm threadId={threadId} />}
      {canReply && <LinkSupplierAnnouncementForm threadId={threadId} />}
      {canConvert && !alreadyConverted && <ConvertToTicketForm threadId={threadId} />}
    </div>
  );
}

function LinkBookingForm({ threadId }: { threadId: string }) {
  const boundAction = linkBooking.bind(null, threadId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Icon name="link" className="text-accent" /> Poveži rezervaciju
      </div>
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <input name="bookingId" required placeholder="Booking UUID (M5)" className="input" />
      <SubmitButton label="poveži rezervaciju" pendingLabel="Povezujem…" />
    </form>
  );
}

function LinkSupplierAnnouncementForm({ threadId }: { threadId: string }) {
  const boundAction = linkSupplierAnnouncement.bind(null, threadId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Icon name="package" className="text-accent" /> Poveži najavu dobavljača
      </div>
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <select name="announcementType" className="input">
        <option value="SUPPLIER_MANIFEST">najava rezervacije (SupplierManifest)</option>
        <option value="SUPPLIER_CHANGE_NOTICE">najava izmene/storna (SupplierChangeNotice)</option>
      </select>
      <input name="announcementId" required placeholder="UUID (M5)" className="input" />
      <p className="text-[10px] text-ink-faint">Upisuje samo vezu na niti — konačna potvrda ostaje isključivo M5/supplier-confirmation/CONFIRM (spec §3.1a).</p>
      <SubmitButton label="poveži najavu" pendingLabel="Povezujem…" />
    </form>
  );
}

function ConvertToTicketForm({ threadId }: { threadId: string }) {
  const boundAction = convertToTicket.bind(null, threadId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Icon name="comment-discussion" className="text-accent" /> Pretvori u tiket
      </div>
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <p className="text-[10px] text-ink-faint">Otvara M14 tiket (channel=EMAIL) i vezuje ga za ovu nit (spec §5).</p>
      <SubmitButton label="pretvori u tiket" pendingLabel="Konvertujem…" />
    </form>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
