import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import EditUserForm from './EditUserForm';
import RoleAssignment from './RoleAssignment';
import PermissionOverrides from './PermissionOverrides';
import SuspendUserButton from './SuspendUserButton';

interface UserDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { roleId: string; role: { id: string; name: string } }[];
}

interface RoleOption {
  id: string;
  name: string;
}

interface PermissionOverrideRow {
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

// M1 spec §7 — "Korisnik — detalji": GET /iam/users/:id, GET/POST/DELETE .../permission-overrides.
// Uloge/dozvole se dovlače odvojeno (GET /iam/roles, GET /iam/permissions) da forme za dodelu
// imaju pun katalog izbora, ne samo ono što je korisnik već ima.
export default async function KorisnikDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canView = hasPermission(me, 'M1', 'user', 'VIEW');
  const canEdit = hasPermission(me, 'M1', 'user', 'EDIT');
  const canDelete = hasPermission(me, 'M1', 'user', 'DELETE');
  const canViewOverrides = hasPermission(me, 'M1', 'permission-override', 'VIEW');
  const canCreateOverride = hasPermission(me, 'M1', 'permission-override', 'CREATE');

  if (!canView) {
    return (
      <div className="p-6">
        <RegisterTab label="Korisnik" />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">Nemate dozvolu za uvid u korisnike (M1/user/VIEW).</p>
      </div>
    );
  }

  let user: UserDetail;
  try {
    user = await apiFetch<UserDetail>(`/iam/users/${params.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [allRoles, overrides, allPermissions] = await Promise.all([
    canEdit ? apiFetch<RoleOption[]>('/iam/roles').catch(() => []) : Promise.resolve<RoleOption[]>([]),
    canViewOverrides ? apiFetch<PermissionOverrideRow[]>(`/iam/users/${params.id}/permission-overrides`).catch(() => []) : Promise.resolve<PermissionOverrideRow[]>([]),
    canCreateOverride ? apiFetch<PermissionOption[]>('/iam/permissions').catch(() => []) : Promise.resolve<PermissionOption[]>([]),
  ]);

  const assignedRoleIds = new Set(user.roles.map((r) => r.roleId));
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  return (
    <div className="p-6">
      <RegisterTab label={user.fullName} />
      <Link href="/korisnici" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na korisnike
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> {user.fullName}
          </h1>
          <p className="text-xs text-ink-dim">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={user.status} />
          {user.mfaEnabled ? <Badge variant="ok">2FA uključeno</Badge> : <Badge variant="warn">2FA isključeno</Badge>}
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Profil</h2>
          <p className="mb-3 text-xs text-ink-faint">
            registrovan {new Date(user.createdAt).toLocaleDateString('sr-RS')}
            {' · '}
            poslednja prijava {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('sr-RS') : 'nikad'}
          </p>
          {canEdit ? (
            <EditUserForm id={user.id} fullName={user.fullName} phone={user.phone} />
          ) : (
            <p className="text-xs text-ink-faint">telefon: {user.phone ?? '—'}</p>
          )}
          {canDelete && user.status !== 'SUSPENDED' && (
            <div className="mt-3 border-t border-border pt-3">
              <SuspendUserButton id={user.id} />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Uloge</h2>
          <RoleAssignment userId={user.id} assignedRoles={user.roles.map((r) => r.role)} availableRoles={availableRoles} canEdit={canEdit} />
        </div>
      </div>

      {canViewOverrides && (
        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Pojedinačni izuzeci od dozvola</h2>
          <PermissionOverrides userId={user.id} overrides={overrides} permissions={allPermissions} canCreate={canCreateOverride} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UserDetail['status'] }) {
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
