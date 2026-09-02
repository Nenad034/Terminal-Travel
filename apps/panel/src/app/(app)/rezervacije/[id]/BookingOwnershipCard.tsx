'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import ActorLabel from '@/components/ActorLabel';
import {
  FormState,
  transferOwnership,
  proposeHandoff,
  acceptHandoff,
  declineHandoff,
  cancelHandoff,
} from './booking-ownership-actions';

interface DirectoryUser {
  id: string;
  fullName: string;
}

interface HandoffRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
}

const initialState: FormState = { error: null };

// M5 spec §6.5 (31.8.2026) — vlasništvo (ko dobija zaslugu u statistici/proviziji, prenosivo
// samo od vlasnika ili Vlasnika/Direktora) i zaduženje (ko trenutno vodi rezervaciju, predaja
// zahteva prihvatanje primaoca osim za Vlasnik/Direktor) prikazani na jednom mestu, isti obrazac
// "kompozicije" kao ostale kartice na ovoj stranici (M10/M11/M20 — page.tsx).
export default function BookingOwnershipCard({
  bookingId,
  ownerId,
  assignedToId,
  ownerName,
  assignedName,
  currentUserId,
  isVlasnikOrDirektor,
  canTransferOwnership,
  canProposeHandoff,
  canAcceptAssignment,
  directory,
  pendingHandoff,
  flat,
}: {
  bookingId: string;
  ownerId: string | null;
  assignedToId: string | null;
  ownerName: string | null;
  assignedName: string | null;
  currentUserId: string;
  /** Vlasnik/Direktor prenose vlasništvo BILO koje rezervacije, ne samo sopstvene (M5 §6.5). */
  isVlasnikOrDirektor: boolean;
  canTransferOwnership: boolean;
  canProposeHandoff: boolean;
  canAcceptAssignment: boolean;
  directory: DirectoryUser[];
  pendingHandoff: HandoffRequest | null;
  /** Bez sopstvenog okvira — koristi se kad je komponenta unutar sekcije koja vec ima traku
   * naslova (nov izgled kartice Pregled, dizajn dok. §6h). */
  flat?: boolean;
}) {
  const isOwner = ownerId === currentUserId;
  // §6.5 — dozvola na nivou API-ja gate-uje ko sme uopšte da pokuša; prenos dodatno zahteva
  // da je pozivalac trenutni vlasnik ILI Vlasnik/Direktor (servis to i tako proverava — dugme
  // se ovde sakriva samo radi jasnijeg UI-ja, API ostaje prava odbrana).
  const showTransferForm = canTransferOwnership && (isOwner || isVlasnikOrDirektor);
  const showProposeForm = canProposeHandoff && !pendingHandoff;

  // `flat` (2.9.2026) — u novom izgledu kartice Pregled sekcija vec ima svoju traku naslova,
  // pa bi jos jedan okvir oko sadrzaja bio kutija u kutiji; jedini deo desne kolone koji je i
  // dalje izgledao kao zasebna kartica. Na SVIM ostalim mestima komponenta ostaje nepromenjena.
  return (
    <div className={flat ? 'text-xs' : 'rounded-lg border border-border bg-panel p-4 text-xs'}>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-ink-faint">Vlasnik (statistika/provizija)</div>
          {ownerId ? <ActorLabel name={ownerName ?? undefined} origin="STAFF" /> : <span className="text-ink-faint">—</span>}
        </div>
        <div>
          <div className="mb-1 text-ink-faint">Trenutno zadužen</div>
          {assignedToId ? <ActorLabel name={assignedName ?? undefined} origin="STAFF" /> : <span className="text-ink-faint">—</span>}
        </div>
      </div>

      {pendingHandoff && (
        <PendingHandoffRow bookingId={bookingId} handoff={pendingHandoff} currentUserId={currentUserId} canAcceptAssignment={canAcceptAssignment} />
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        {showTransferForm && <TransferOwnershipForm bookingId={bookingId} directory={directory} excludeUserId={ownerId} />}
        {showProposeForm && <ProposeHandoffForm bookingId={bookingId} directory={directory} excludeUserId={assignedToId} />}
      </div>
    </div>
  );
}

function PendingHandoffRow({
  bookingId,
  handoff,
  currentUserId,
  canAcceptAssignment,
}: {
  bookingId: string;
  handoff: HandoffRequest;
  currentUserId: string;
  canAcceptAssignment: boolean;
}) {
  const isRecipient = handoff.toUserId === currentUserId;
  const isProposer = handoff.fromUserId === currentUserId;
  const boundAccept = acceptHandoff.bind(null, bookingId, handoff.id);
  const boundDecline = declineHandoff.bind(null, bookingId, handoff.id);
  const boundCancel = cancelHandoff.bind(null, bookingId, handoff.id);
  const [acceptState, acceptAction] = useActionState(boundAccept, initialState);
  const [declineState, declineAction] = useActionState(boundDecline, initialState);
  const [cancelState, cancelAction] = useActionState(boundCancel, initialState);

  return (
    <div className="mb-3 rounded border border-border bg-panel2 p-2">
      <p className="text-ink-dim">Predlog predaje zaduženja čeka na prihvatanje.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isRecipient && canAcceptAssignment && (
          <>
            <form action={acceptAction}>
              <ConfirmSubmitButton label="Prihvati" pendingLabel="Prihvatam…" />
            </form>
            <form action={declineAction}>
              <ConfirmSubmitButton label="Odbij" pendingLabel="Odbijam…" variant="outline" />
            </form>
          </>
        )}
        {isProposer && (
          <form action={cancelAction}>
            <ConfirmSubmitButton label="Otkaži predlog" pendingLabel="Otkazujem…" variant="ghost" />
          </form>
        )}
      </div>
      {(acceptState.error || declineState.error || cancelState.error) && (
        <p className="mt-1 text-danger">{acceptState.error || declineState.error || cancelState.error}</p>
      )}
    </div>
  );
}

function TransferOwnershipForm({ bookingId, directory, excludeUserId }: { bookingId: string; directory: DirectoryUser[]; excludeUserId: string | null }) {
  const boundAction = transferOwnership.bind(null, bookingId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const options = directory.filter((u) => u.id !== excludeUserId);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label className="text-ink-faint" htmlFor={`transfer-${bookingId}`}>
        Prenesi vlasništvo na
      </label>
      <div className="flex items-center gap-2">
        <select id={`transfer-${bookingId}`} name="newOwnerId" required className="h-7 rounded border border-border bg-bg px-2 text-xs text-ink">
          <option value="">— izaberi kolegu —</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <ConfirmSubmitButton label="Prenesi" pendingLabel="Prenosim…" />
      </div>
      {state.error && <span className="text-danger">{state.error}</span>}
    </form>
  );
}

function ProposeHandoffForm({ bookingId, directory, excludeUserId }: { bookingId: string; directory: DirectoryUser[]; excludeUserId: string | null }) {
  const boundAction = proposeHandoff.bind(null, bookingId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const options = directory.filter((u) => u.id !== excludeUserId);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label className="text-ink-faint" htmlFor={`handoff-${bookingId}`}>
        Predaj zaduženje kolegi
      </label>
      <div className="flex items-center gap-2">
        <select id={`handoff-${bookingId}`} name="toUserId" required className="h-7 rounded border border-border bg-bg px-2 text-xs text-ink">
          <option value="">— izaberi kolegu —</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <ConfirmSubmitButton label="Predloži" pendingLabel="Šaljem…" variant="outline" />
      </div>
      {state.error && <span className="text-danger">{state.error}</span>}
    </form>
  );
}

function ConfirmSubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant?: 'default' | 'outline' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant ?? 'default'} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
