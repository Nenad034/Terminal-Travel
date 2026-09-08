import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import BranchDetailForm from './BranchDetailForm';

interface BranchDetail {
  id: string;
  name: string;
  active: boolean;
  address: string | null;
  phone: string | null;
  email: string | null;
  responsiblePersonName: string | null;
  taxId: string | null;
  licenseNumber: string | null;
}

interface BranchUser {
  id: string;
  fullName: string;
  email: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  roles: { role: { name: string } }[];
}

// M1 spec §3.9b dopuna (8.9.2026, vlasnikov zahtev: "treba dodati i formu za unos kompletnih
// poslovnih podataka za svaku poslovnicu" + "prikazati korisnike dodeljene poslovnici sa jasno
// napisanim nivoom pristupa") — isti obrazac kao `/korisnici/[id]`: puna forma iza `branch/EDIT`,
// spisak dodeljenih korisnika iza ODVOJENE dozvole `user/VIEW` (privatnosna granica, ne
// administrativna — vidi komentar u `branches.service.ts`).
export default async function PoslovnicaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canEdit = hasPermission(me, 'M1', 'branch', 'EDIT');
  const canViewUsers = hasPermission(me, 'M1', 'user', 'VIEW');

  if (!canEdit) {
    return (
      <div className="p-6">
        <RegisterTab label="Poslovnica" />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">
          Nemate dozvolu za uvid u ovaj ekran (M1/branch/EDIT).
        </p>
      </div>
    );
  }

  let branch: BranchDetail;
  try {
    branch = await apiFetch<BranchDetail>(`/iam/branches/${params.id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const users = canViewUsers
    ? await apiFetch<BranchUser[]>(`/iam/branches/${params.id}/users`).catch(() => [])
    : [];

  return (
    <div className="p-6">
      <RegisterTab label={branch.name} />
      <Link
        href="/podesavanja/poslovnice"
        className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
      >
        <Icon name="arrow-left" /> nazad na poslovnice
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{branch.name}</h1>
        <Badge variant={branch.active ? 'ok' : 'warn'}>
          {branch.active ? 'aktivna' : 'neaktivna'}
        </Badge>
      </div>

      <div className="mb-4 max-w-2xl rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Poslovni podaci</h2>
        <BranchDetailForm branch={branch} />
      </div>

      <div className="max-w-2xl rounded-lg border border-border bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Dodeljeni korisnici</h2>
        {!canViewUsers ? (
          <p className="text-xs text-ink-faint">
            Nemate dozvolu za uvid u korisnike (M1/user/VIEW).
          </p>
        ) : users.length === 0 ? (
          <p className="text-xs text-ink-faint">Nijedan korisnik nije dodeljen ovoj poslovnici.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between border-b border-border pb-2 text-xs last:border-0 last:pb-0"
              >
                <Link href={`/korisnici/${u.id}`} className="hover:text-accent-strong">
                  <span className="font-medium text-ink">{u.fullName}</span>
                  <span className="ml-2 text-ink-faint">{u.email}</span>
                </Link>
                <div className="flex items-center gap-1.5">
                  {u.roles.length === 0 ? (
                    <span className="text-ink-faint">bez uloge</span>
                  ) : (
                    u.roles.map((r) => (
                      <Badge key={r.role.name} variant="secondary">
                        {r.role.name}
                      </Badge>
                    ))
                  )}
                  {u.status !== 'ACTIVE' && <Badge variant="warn">{u.status}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
