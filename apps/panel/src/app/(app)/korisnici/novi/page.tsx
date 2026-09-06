import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NewUserForm from './NewUserForm';


interface RoleOption {
  id: string;
  name: string;
}

export default async function NoviKorisnikPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M1', 'user', 'CREATE');

  if (!canCreate) {
    return (
      <div className="p-6">
        <RegisterTab label="Pozovi korisnika" />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">Nemate dozvolu za pozivanje korisnika (M1/user/CREATE).</p>
      </div>
    );
  }

  const roles = await apiFetch<RoleOption[]>('/iam/roles');
  // M1 spec dopuna (6.9.2026) — poslovnica je opciona dok postoji samo jedna (ili nijedna).
  const branches = await apiFetch<{ id: string; name: string }[]>('/iam/branches');

  return (
    <div className="p-6">
      <RegisterTab label="Pozovi korisnika" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Pozovi korisnika</h1>
      <NewUserForm roles={roles} branches={branches} />
    </div>
  );
}
