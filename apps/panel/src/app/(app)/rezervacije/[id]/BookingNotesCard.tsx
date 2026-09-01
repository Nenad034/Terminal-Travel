'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import ActorLabel from '@/components/ActorLabel';
import { NoteFormState, createBookingNote, deleteBookingNote } from './booking-notes-actions';

export interface BookingNote {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
  /** §4.6 (1.9.2026) — poreklo: kancelarija ili predstavnik na destinaciji. Izvedeno iz uloge
   *  autora na API strani, ne bira se u formi. */
  origin?: 'OFFICE' | 'FIELD_REP';
  /** Razrešeno ime autora (iz M1 /iam/users/directory) — sirov ID se nikad ne ispisuje (§6a.3). */
  authorName: string | null;
}

const initialState: NoteFormState = { error: null };

// M5 spec §4.6 (1.9.2026) — interne beleške uz rezervaciju. Append-only: nema izmene postojeće
// beleške; pogrešna se briše i dopisuje nova (isto obrazloženje kao za M1 audit zapis).
export default function BookingNotesCard({
  bookingId,
  notes,
  currentUserId,
  canCreate,
  canDelete,
  isVlasnikOrDirektor,
}: {
  bookingId: string;
  notes: BookingNote[];
  currentUserId: string | null;
  canCreate: boolean;
  canDelete: boolean;
  isVlasnikOrDirektor: boolean;
}) {
  const [state, formAction] = useActionState(createBookingNote.bind(null, bookingId), initialState);
  // §4.6 — vlasnikova odluka (1.9.2026): predstavnik piše u ISTE beleške, ali se njegove moraju
  // videti izdvojeno. Otuda jedna lista sa jasnom oznakom + prekidač da se izdvoje samo terenske.
  const [samoTeren, setSamoTeren] = useState(false);
  const fieldCount = notes.filter((n) => n.origin === 'FIELD_REP').length;
  const shown = samoTeren ? notes.filter((n) => n.origin === 'FIELD_REP') : notes;

  return (
    <div className="space-y-4">
      {canCreate ? (
        <form action={formAction} className="rounded-lg border border-border bg-panel p-4">
          <label htmlFor="booking-note-body" className="mb-2 block text-xs font-semibold text-ink">
            Nova beleška
          </label>
          <textarea
            id="booking-note-body"
            name="body"
            rows={3}
            maxLength={4000}
            placeholder="npr. gost traži sobu na višem spratu; zvao suprug, menjaju datum povratka"
            className="w-full rounded border border-border bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-ink-faint">Beleška se ne može naknadno izmeniti — pogrešnu obrišite i upišite novu.</p>
            <SubmitButton />
          </div>
          {state.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
        </form>
      ) : (
        <p className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-faint">
          Nemate dozvolu za dodavanje beleški (<code>M5/booking-note/CREATE</code>).
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema beleški uz ovu rezervaciju.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
            <span>
              Ukupno {notes.length} · sa terena {fieldCount}
            </span>
            {fieldCount > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={samoTeren} onChange={(e) => setSamoTeren(e.target.checked)} />
                prikaži samo napomene sa terena
              </label>
            )}
          </div>
          <ul className="space-y-2">
          {shown.map((note) => (
            <li
              key={note.id}
              className={`rounded-lg border bg-panel p-3 ${
                note.origin === 'FIELD_REP' ? 'border-l-4 border-l-warn border-y-border border-r-border' : 'border-border'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] text-ink-faint">
                <span className="flex flex-wrap items-center gap-1.5">
                  <ActorLabel name={note.authorName} origin="STAFF" />
                  {note.origin === 'FIELD_REP' && (
                    <span className="rounded bg-warn-bg px-1.5 py-0.5 font-medium text-warn">sa terena — predstavnik</span>
                  )}
                  <span>· {new Date(note.createdAt).toLocaleString('sr-RS')}</span>
                </span>
                {canDelete && (note.createdBy === currentUserId || isVlasnikOrDirektor) && (
                  <DeleteNoteForm bookingId={bookingId} noteId={note.id} />
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
            </li>
          ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'čuvam…' : 'Sačuvaj belešku'}
    </Button>
  );
}

function DeleteNoteForm({ bookingId, noteId }: { bookingId: string; noteId: string }) {
  const [state, formAction] = useActionState(deleteBookingNote.bind(null, bookingId, noteId), initialState);
  return (
    <form action={formAction}>
      <button type="submit" className="text-[11px] text-danger hover:underline">
        obriši
      </button>
      {state.error && <span className="ml-2 text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}
