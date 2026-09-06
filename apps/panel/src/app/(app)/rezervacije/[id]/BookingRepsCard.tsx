'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { assignGuide } from './booking-guide-actions';
import { emptyGuideState } from './guide-form-state';

export interface RepItem {
  id: string;
  name: string;
  destination?: string | null;
  stayFrom?: string;
  stayTo?: string;
  assignedGuideId: string | null;
  guestCount: number;
}

export interface Guide {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

export interface RepCheckIn {
  id: string;
  bookingItemId: string | null;
  guestName: string;
  checkedInAt: string;
  checkedInBy: string;
}

// M5 spec §4.5 / M9 spec §4 — predstavnik (vodič) na destinaciji po stavci rezervacije, i
// prijave gostiju sa terena. Namerno NIJE nov pojam: koristi postojeći `BookingItem.
// assigned_guide_id` i `FieldCheckIn` iz M9, umesto da uvodi paralelnu evidenciju.
export default function BookingRepsCard({
  bookingId,
  items,
  guides,
  checkIns,
  namesById,
  canAssign,
  canViewCheckIns,
}: {
  bookingId: string;
  items: RepItem[];
  guides: Guide[];
  checkIns: RepCheckIn[];
  namesById: Record<string, string>;
  canAssign: boolean;
  canViewCheckIns: boolean;
}) {
  const guidesById = new Map(guides.map((g) => [g.id, g]));

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-ink-faint">Rezervacija nema stavki.</p>}

      {items.map((item) => {
        const itemCheckIns = checkIns.filter((c) => c.bookingItemId === item.id);
        const assignedGuide = item.assignedGuideId ? guidesById.get(item.assignedGuideId) : undefined;
        return (
          <div key={item.id} className="rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 text-sm font-semibold text-ink">
              {item.name}
              {item.stayFrom && (
                <span className="ml-2 text-xs font-normal text-ink-faint">
                  {new Date(item.stayFrom).toLocaleDateString('sr-RS')}
                  {item.stayTo ? ` – ${new Date(item.stayTo).toLocaleDateString('sr-RS')}` : ''}
                </span>
              )}
            </div>

            {canAssign ? (
              <AssignForm bookingId={bookingId} item={item} guides={guides} />
            ) : (
              <p className="text-xs text-ink-dim">
                Predstavnik:{' '}
                {item.assignedGuideId ? (
                  <span className="text-ink">{namesById[item.assignedGuideId] ?? 'nepoznat korisnik'}</span>
                ) : (
                  <span className="text-ink-faint">nije dodeljen</span>
                )}
              </p>
            )}

            {/* Dopuna (2.9.2026, na zahtev vlasnika) — puni podaci predstavnika: ime, kontakt
                telefon, email, destinacija koju pokriva i termin od-do na destinaciji. Destinacija/
                termin dolaze sa STAVKE (Product.destinationCity/Country + stayFrom/stayTo), ne sa
                korisničkog naloga — isti predstavnik može na drugoj stavci pokrivati drugu
                destinaciju/period. */}
            {item.assignedGuideId && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-border bg-panel2 p-2.5 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint">Ime i prezime</dt>
                  <dd className="text-ink">{assignedGuide?.fullName ?? namesById[item.assignedGuideId] ?? 'nepoznat korisnik'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint">Telefon</dt>
                  <dd className="text-ink">{assignedGuide?.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint">Email</dt>
                  <dd className="text-ink">{assignedGuide?.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint">Destinacija</dt>
                  <dd className="text-ink">{item.destination ?? '—'}</dd>
                </div>
              </dl>
            )}

            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
                Prijave sa terena ({itemCheckIns.length} / {item.guestCount} putnika)
              </div>
              {!canViewCheckIns ? (
                <p className="text-xs text-ink-faint">
                  Za prikaz prijava sa terena potrebna je dozvola <code>M9/field-checkin/VIEW</code>.
                </p>
              ) : itemCheckIns.length === 0 ? (
                <p className="text-xs text-ink-faint">Nijedan putnik još nije prijavljen na destinaciji.</p>
              ) : (
                <ul className="space-y-1">
                  {itemCheckIns.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-ink">{c.guestName}</span>
                      <span className="text-ink-faint">
                        {new Date(c.checkedInAt).toLocaleString('sr-RS')} · {namesById[c.checkedInBy] ?? 'nepoznat korisnik'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssignForm({ bookingId, item, guides }: { bookingId: string; item: RepItem; guides: { id: string; fullName: string }[] }) {
  const [state, formAction] = useActionState(assignGuide.bind(null, bookingId, item.id), emptyGuideState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px] flex-1">
        <label htmlFor={`guide-${item.id}`} className="mb-1 block text-xs font-medium text-ink">
          Predstavnik na destinaciji
        </label>
        <select
          id={`guide-${item.id}`}
          name="assignedGuideId"
          defaultValue={item.assignedGuideId ?? ''}
          className="w-full rounded border border-border bg-panel2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">— bez predstavnika —</option>
          {guides.map((g) => (
            <option key={g.id} value={g.id}>
              {g.fullName}
            </option>
          ))}
        </select>
      </div>
      <SaveButton />
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-ok">{state.ok}</p>}
      {guides.length === 0 && (
        <p className="w-full text-[11px] text-ink-faint">Nema nijednog korisnika sa ulogom VODIC — dodelite je nekome u sekciji Korisnici.</p>
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'čuvam…' : 'Sačuvaj'}
    </Button>
  );
}
