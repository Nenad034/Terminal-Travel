'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { addBookingGuest, updateBookingGuest, deleteBookingGuest } from './booking-guest-actions';
import { emptyGuestCrudState } from './guest-crud-form-state';

export interface EditableGuest {
  id: string;
  guestFirstName: string;
  guestLastName: string;
  guestProfileId: string | null;
}

export interface GuestProfileInfo {
  id: string;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
}

// M5 spec §4.3 dopuna (2.9.2026, na zahtev vlasnika: "u tabu Putnici treba omogućiti dodavanje
// i brisanje putnika i vršiti izmene u vezi podataka putnika — ovo nema veze sa profilom
// putnika") — menja ISKLJUČIVO ime/prezime na M5 `BookingItemGuest`, nikad M6 `GuestProfile`
// (dokument/državljanstvo/datum rođenja se i dalje prikazuju samo za čitanje, uređuju se u M6).
export default function BookingItemGuestsEditor({
  bookingId,
  bookingItemId,
  guests,
  profilesById,
  canViewGuestProfiles,
  canModify,
}: {
  bookingId: string;
  bookingItemId: string;
  guests: EditableGuest[];
  profilesById: Map<string, GuestProfileInfo>;
  canViewGuestProfiles: boolean;
  canModify: boolean;
}) {
  return (
    <div>
      {guests.length === 0 ? (
        <p className="py-2 text-xs text-ink-faint">Na ovoj stavci nema unetih putnika.</p>
      ) : (
        <ul className="divide-y divide-border">
          {guests.map((g) => (
            <GuestRow
              key={g.id}
              bookingId={bookingId}
              bookingItemId={bookingItemId}
              guest={g}
              profile={g.guestProfileId ? profilesById.get(g.guestProfileId) : undefined}
              canViewGuestProfiles={canViewGuestProfiles}
              canModify={canModify}
            />
          ))}
        </ul>
      )}

      {canModify && <AddGuestForm bookingId={bookingId} bookingItemId={bookingItemId} />}
    </div>
  );
}

function GuestRow({
  bookingId,
  bookingItemId,
  guest,
  profile,
  canViewGuestProfiles,
  canModify,
}: {
  bookingId: string;
  bookingItemId: string;
  guest: EditableGuest;
  profile: GuestProfileInfo | undefined;
  canViewGuestProfiles: boolean;
  canModify: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction] = useActionState(updateBookingGuest.bind(null, bookingId, bookingItemId, guest.id), emptyGuestCrudState);
  const [deleteState, deleteAction] = useActionState(deleteBookingGuest.bind(null, bookingId, bookingItemId, guest.id), emptyGuestCrudState);

  // Zatvori formu za izmenu tek kad akcija stvarno uspe — ostaje otvorena (sa vidljivom
  // greškom) ako API odbije zahtev, umesto da se tiho vrati na prikaz kao da je uspelo.
  useEffect(() => {
    if (updateState.ok) setEditing(false);
  }, [updateState.ok]);

  if (editing) {
    return (
      <li className="py-2">
        <form action={updateAction} className="flex flex-wrap items-center gap-2">
          <input
            name="guestFirstName"
            defaultValue={guest.guestFirstName}
            placeholder="ime"
            className="w-28 rounded border border-border bg-panel2 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <input
            name="guestLastName"
            defaultValue={guest.guestLastName}
            placeholder="prezime"
            className="w-28 rounded border border-border bg-panel2 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <SmallSubmitButton label="sačuvaj" pendingLabel="čuvam…" />
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-faint hover:text-ink">
            otkaži
          </button>
        </form>
        {updateState.error && <p className="mt-1 text-xs text-danger">{updateState.error}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <span className="text-ink">
        {guest.guestFirstName} {guest.guestLastName}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {profile ? (
          <span className="text-xs text-ink-faint">
            {profile.documentType} {profile.documentNumber} · {profile.nationality} · {new Date(profile.dateOfBirth).toLocaleDateString('sr-RS')}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">
            {guest.guestProfileId ? (canViewGuestProfiles ? 'profil gosta nije dostupan' : 'podaci dokumenta zahtevaju M6/guest-profile/VIEW') : 'nema povezan profil gosta'}
          </span>
        )}
        {profile && (
          <Link href={`/crm/gosti/${profile.id}`} className="text-xs text-accent hover:underline">
            profil →
          </Link>
        )}
        {canModify && (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
              izmeni
            </button>
            <form action={deleteAction}>
              <DeleteButton />
            </form>
          </>
        )}
      </span>
      {deleteState.error && <span className="text-xs text-danger">{deleteState.error}</span>}
    </li>
  );
}

function AddGuestForm({ bookingId, bookingItemId }: { bookingId: string; bookingItemId: string }) {
  const [state, formAction] = useActionState(addBookingGuest.bind(null, bookingId, bookingItemId), emptyGuestCrudState);
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
      <div>
        <label className="mb-1 block text-[11px] text-ink-faint">Ime</label>
        <input name="guestFirstName" className="w-28 rounded border border-border bg-panel2 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none" />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-ink-faint">Prezime</label>
        <input name="guestLastName" className="w-28 rounded border border-border bg-panel2 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none" />
      </div>
      <SmallSubmitButton label="Dodaj putnika" pendingLabel="dodajem…" icon="add" />
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function SmallSubmitButton({ label, pendingLabel, icon }: { label: string; pendingLabel: string; icon?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {icon && !pending && <Icon name={icon} />} {pending ? pendingLabel : label}
    </Button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs text-danger hover:underline disabled:opacity-50">
      {pending ? 'uklanjam…' : 'ukloni'}
    </button>
  );
}
