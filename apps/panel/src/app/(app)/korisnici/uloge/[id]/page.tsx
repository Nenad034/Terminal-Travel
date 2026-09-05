import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import RolePermissions, { PermissionOption } from './RolePermissions';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  _count: { userRoles: number };
}

// M1 spec §7 (dopuna 4.9.2026) — ekran "Uloge" → uređivanje dozvola jedne uloge.
// GET /iam/roles/:id ne postoji kao poseban endpoint (M1 spec §6 daje samo listu), pa se
// uloga bira iz liste — namerno, da se ne uvodi endpoint koji specifikacija ne predviđa.
export default async function UlogaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const canView = hasPermission(me, 'M1', 'role', 'VIEW');
  const canEdit = hasPermission(me, 'M1', 'role', 'EDIT');

  if (!canView) {
    return (
      <div className="p-6">
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">
          Nemate dozvolu za uvid u uloge (M1/role/VIEW).
        </p>
      </div>
    );
  }

  let role: RoleRow | undefined;
  let assigned: PermissionOption[] = [];
  let catalog: PermissionOption[] = [];
  let error: string | null = null;

  try {
    const [roles, rolePerms, allPerms] = await Promise.all([
      apiFetch<RoleRow[]>('/iam/roles'),
      apiFetch<PermissionOption[]>(`/iam/roles/${id}/permissions`),
      apiFetch<PermissionOption[]>('/iam/permissions'),
    ]);
    role = roles.find((r) => r.id === id);
    assigned = rolePerms;
    catalog = allPerms;
  } catch {
    error = 'Učitavanje uloge nije uspelo.';
  }

  if (error || !role) {
    return (
      <div className="p-6">
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error ?? 'Uloga nije pronađena.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{role.name}</h1>
          <p className="text-xs text-ink-dim">{role.description}</p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {role._count.userRoles} {role._count.userRoles === 1 ? 'nosilac' : 'nosilaca'} · izmena važi odmah, bez
            ponovne prijave
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role.isSystemRole && (
            <Badge variant="secondary" className="text-ink-faint">
              sistemska
            </Badge>
          )}
          <Link href="/korisnici/uloge" className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink">
            <Icon name="arrow-left" /> nazad na uloge
          </Link>
        </div>
      </div>

      {!canEdit && (
        <p className="mb-3 rounded border border-border bg-panel2 p-3 text-xs text-ink-dim">
          Vidite dozvole ove uloge, ali ih ne možete menjati — za izmenu je potrebna dozvola M1/role/EDIT.
        </p>
      )}

      <RolePermissions
        roleId={role.id}
        allPermissions={catalog}
        assignedIds={assigned.map((p) => p.id)}
        canEdit={canEdit}
      />
    </div>
  );
}
