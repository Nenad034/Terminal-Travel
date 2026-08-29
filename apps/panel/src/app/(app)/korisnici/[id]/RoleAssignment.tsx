'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { assignRole, removeRole, FormState } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface RoleRef {
  id: string;
  name: string;
}

// M1 spec §7 — dodela/uklanjanje uloge korisniku (bočni panel "Korisnik — detalji").
export default function RoleAssignment({
  userId,
  assignedRoles,
  availableRoles,
  canEdit,
}: {
  userId: string;
  assignedRoles: RoleRef[];
  availableRoles: RoleRef[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {assignedRoles.length === 0 && <span className="text-xs text-ink-faint">Nema dodeljenih uloga.</span>}
        {assignedRoles.map((r) => (
          <div key={r.id} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-ink-dim">
              {r.name}
            </Badge>
            {canEdit && <RemoveRoleButton userId={userId} roleId={r.id} />}
          </div>
        ))}
      </div>
      {canEdit && availableRoles.length > 0 && <AssignRoleForm userId={userId} roles={availableRoles} />}
    </div>
  );
}

function RemoveRoleButton({ userId, roleId }: { userId: string; roleId: string }) {
  const boundAction = removeRole.bind(null, userId, roleId);
  const [, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" className="h-auto p-0.5 text-danger hover:text-danger" title="Ukloni ulogu">
        <span className="text-[11px]">×</span>
      </Button>
    </form>
  );
}

function AssignRoleForm({ userId, roles }: { userId: string; roles: RoleRef[] }) {
  const boundAction = assignRole.bind(null, userId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex items-end gap-2 border-t border-border pt-2 text-xs">
      <label className="text-ink-faint">
        dodaj ulogu
        <select name="roleId" required className="input mt-1">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm">
      {pending ? 'Dodajem…' : 'dodaj'}
    </Button>
  );
}
