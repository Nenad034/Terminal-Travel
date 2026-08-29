'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPermissionOverride, deletePermissionOverride, FormState } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';

const initialState: FormState = { error: null };

interface OverrideRow {
  id: string;
  effect: 'ALLOW' | 'DENY';
  reason: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  permission: { id: string; module: string; resource: string; action: string; description: string };
}

interface PermissionOption {
  id: string;
  module: string;
  resource: string;
  action: string;
  description: string;
}

// M1 spec §7/§8 — pojedinačan izuzetak (ALLOW/DENY) od podrazumevanih dozvola uloge, sa
// obaveznim razlogom (forma ne dozvoljava slanje bez njega — backend takođe validira min 3
// karaktera, ovo je samo UI ograda, ne jedini oslonac).
export default function PermissionOverrides({
  userId,
  overrides,
  permissions,
  canCreate,
}: {
  userId: string;
  overrides: OverrideRow[];
  permissions: PermissionOption[];
  canCreate: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {overrides.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema pojedinačnih izuzetaka — korisnik prati samo dozvole svojih uloga.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-3 rounded border border-border bg-panel2 p-2.5 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={o.effect === 'ALLOW' ? 'ok' : 'danger'}>{o.effect}</Badge>
                  <span className="font-mono text-ink-dim">
                    {o.permission.module}/{o.permission.resource}/{o.permission.action}
                  </span>
                </div>
                <p className="mt-1 text-ink-dim">{o.reason}</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  dodelio {o.grantedBy.slice(0, 8)}… · {new Date(o.grantedAt).toLocaleDateString('sr-RS')}
                  {o.expiresAt && ` · ističe ${new Date(o.expiresAt).toLocaleDateString('sr-RS')}`}
                </p>
              </div>
              {canCreate && <RemoveOverrideButton userId={userId} overrideId={o.id} />}
            </div>
          ))}
        </div>
      )}

      {canCreate &&
        (showForm ? (
          <CreateOverrideForm userId={userId} permissions={permissions} onDone={() => setShowForm(false)} />
        ) : (
          <Button type="button" onClick={() => setShowForm(true)} variant="outline" size="sm" className="self-start">
            + dodaj izuzetak
          </Button>
        ))}
    </div>
  );
}

function RemoveOverrideButton({ userId, overrideId }: { userId: string; overrideId: string }) {
  const boundAction = deletePermissionOverride.bind(null, userId, overrideId);
  const [, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" className="h-auto px-2 py-1 text-[11px] text-danger hover:text-danger">
        ukloni
      </Button>
    </form>
  );
}

function CreateOverrideForm({ userId, permissions, onDone }: { userId: string; permissions: PermissionOption[]; onDone: () => void }) {
  const boundAction = createPermissionOverride.bind(null, userId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded border border-border bg-panel2 p-3 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <label className="text-ink-faint">
        dozvola
        <select name="permissionId" required className="input mt-1">
          {permissions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.module}/{p.resource}/{p.action} — {p.description}
            </option>
          ))}
        </select>
      </label>
      <label className="text-ink-faint">
        efekat
        <select name="effect" required className="input mt-1">
          <option value="ALLOW">ALLOW — dozvoli iako uloga ne bi</option>
          <option value="DENY">DENY — zabrani iako bi uloga dozvolila</option>
        </select>
      </label>
      <label className="text-ink-faint">
        razlog (obavezno)
        <textarea name="reason" required minLength={3} rows={2} className="input mt-1" placeholder="Zašto je ovaj izuzetak potreban?" />
      </label>
      <label className="text-ink-faint">
        rok isteka (opciono)
        <div className="mt-1">
          <DateField name="expiresAt" />
        </div>
      </label>
      <div className="mt-1 flex gap-2">
        <SubmitButton />
        <Button type="button" onClick={onDone} variant="ghost" size="sm">
          otkaži
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Dodajem…' : 'dodaj izuzetak'}
    </Button>
  );
}
