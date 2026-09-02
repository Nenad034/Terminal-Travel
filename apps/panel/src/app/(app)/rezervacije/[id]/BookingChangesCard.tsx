'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import { cancelBooking, modifyBookingItem } from './booking-changes-actions';
import { ChangeFormState, emptyChangeState } from './change-form-state';

export interface ChangeableItem {
  id: string;
  name: string;
  stayFrom?: string;
  stayTo?: string;
  itemStatus: string;
  guestCount: number;
}

// M5 spec §6/§6.4 — otkazivanje i izmena rezervacije. Do 1.9.2026 su ova dva poziva postojala
// na API-ju bez ijednog ekrana koji ih zove — stanje "logika postoji, UI ne" koje CLAUDE.md
// izričito označava kao nezavršeno.
export default function BookingChangesCard({
  bookingId,
  items,
  canCancel,
  canModify,
}: {
  bookingId: string;
  items: ChangeableItem[];
  canCancel: boolean;
  canModify: boolean;
}) {
  const active = items.filter((i) => i.itemStatus !== 'CANCELLED');

  return (
    <div className="space-y-6">
      {active.length === 0 && <p className="text-xs text-ink-faint">Sve stavke rezervacije su već otkazane — nema šta da se menja.</p>}

      {canCancel && active.length > 0 && <CancelForm bookingId={bookingId} items={active} />}
      {!canCancel && (
        <p className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-faint">
          Nemate dozvolu za otkazivanje (<code>M5/booking/CANCEL</code>).
        </p>
      )}

      {canModify && active.length > 0 && <ModifyForm bookingId={bookingId} items={active} />}
      {!canModify && (
        <p className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-faint">
          Nemate dozvolu za izmenu (<code>M5/booking/MODIFY</code>).
        </p>
      )}
    </div>
  );
}

function CancelForm({ bookingId, items }: { bookingId: string; items: ChangeableItem[] }) {
  const [state, formAction] = useActionState(cancelBooking.bind(null, bookingId), emptyChangeState);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  return (
    <form action={formAction} className="rounded-lg border border-danger/30 bg-panel p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-danger">
        <Icon name="trash" /> Otkazivanje
      </div>
      <p className="mb-3 text-[11px] text-ink-faint">
        Oslobađa kapacitet kod dobavljača i računa procenat povraćaja po uslovima ugovora. Bez izabranih stavki otkazuje se cela rezervacija.
      </p>

      <fieldset className="mb-3 space-y-1.5">
        <legend className="mb-1 text-xs font-medium text-ink">Stavke (ništa izabrano = sve)</legend>
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-xs text-ink-dim">
            <input
              type="checkbox"
              name="itemIds"
              value={item.id}
              checked={selected.includes(item.id)}
              onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))}
            />
            {item.name}
            {item.stayFrom && <span className="text-ink-faint">({new Date(item.stayFrom).toLocaleDateString('sr-RS')})</span>}
          </label>
        ))}
      </fieldset>

      <label htmlFor="cancel-reason" className="mb-1 block text-xs font-medium text-ink">
        Razlog (obavezno, ostaje u istoriji)
      </label>
      <input
        id="cancel-reason"
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="npr. gost odustao zbog bolesti"
        className="mb-3 w-full rounded border border-border bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />

      {/* §6.4 — upozorenje o duplikatu. Ništa NIJE otkazano dok čovek ne klikne potvrdu;
          override se nikad ne šalje unapred, niti ga sme poslati AI nalog (sprovedeno na API-ju). */}
      {state.duplicateWarning ? (
        <div className="rounded border border-warn/40 bg-warn-bg p-3">
          <p className="text-xs text-warn">
            <strong>Moguć duplikat.</strong> {state.duplicateWarning.message}
            {state.duplicateWarning.conflictBookingNumber && (
              <>
                {' '}
                Sporna rezervacija: <strong>{state.duplicateWarning.conflictBookingNumber}</strong>
                {state.duplicateWarning.conflictPaymentStatus ? ` (${state.duplicateWarning.conflictPaymentStatus})` : ''}.
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">Otkazivanje još nije izvršeno. Proverite sporni zapis pre nego što potvrdite.</p>
          <input type="hidden" name="confirmDuplicateOverride" value="true" />
          <input type="hidden" name="reason" value={reason} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="itemIds" value={id} />
          ))}
          <div className="mt-2">
            <SubmitButton label="Otkaži ipak" pendingLabel="otkazujem…" variant="destructive" />
          </div>
        </div>
      ) : (
        <SubmitButton label="Otkaži rezervaciju" pendingLabel="otkazujem…" variant="destructive" />
      )}

      {state.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-ok">{state.ok}</p>}
    </form>
  );
}

function ModifyForm({ bookingId, items }: { bookingId: string; items: ChangeableItem[] }) {
  const [state, formAction] = useActionState(modifyBookingItem.bind(null, bookingId), emptyChangeState);
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const current = items.find((i) => i.id === itemId);

  return (
    <form action={formAction} className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="edit" className="text-accent" /> Izmena datuma / broja osoba
      </div>
      <p className="mb-3 text-[11px] text-ink-faint">
        Sistem staru stavku otkazuje i pravi novu po novom zahtevu, uz novu proveru dostupnosti i cene — nova cena može biti različita od
        prvobitne.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="modify-item" className="mb-1 block text-xs font-medium text-ink">
            Stavka
          </label>
          <select
            id="modify-item"
            name="bookingItemId"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded border border-border bg-panel2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <Input label="Novi datum od" name="stayFrom" type="date" defaultValue={current?.stayFrom?.slice(0, 10) ?? ''} key={`from-${itemId}`} />
        <Input label="Novi datum do" name="stayTo" type="date" defaultValue={current?.stayTo?.slice(0, 10) ?? ''} key={`to-${itemId}`} />
        <Input label="Odraslih" name="adults" type="number" min={1} defaultValue={String(current?.guestCount || 1)} key={`ad-${itemId}`} />
        <Input label="Dece" name="children" type="number" min={0} defaultValue="0" key={`ch-${itemId}`} />
      </div>

      <p className="mt-2 text-[11px] text-ink-faint">
        Broj osoba je predložen iz spiska putnika na stavci; raspored po sobama se u ovom prolazu ne menja ovde (sve osobe se tretiraju kao
        jedna soba) — za drugačiji raspored napravite novu rezervaciju.
      </p>

      <div className="mt-3">
        <SubmitButton label="Primeni izmenu" pendingLabel="menjam…" />
      </div>

      {state.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-ok">{state.ok}</p>}
    </form>
  );
}

function Input({ label, name, type, defaultValue, min }: { label: string; name: string; type: string; defaultValue: string; min?: number }) {
  return (
    <div>
      <label htmlFor={`mod-${name}`} className="mb-1 block text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={`mod-${name}`}
        name={name}
        type={type}
        min={min}
        defaultValue={defaultValue}
        className="w-full rounded border border-border bg-panel2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function SubmitButton({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: 'destructive' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
