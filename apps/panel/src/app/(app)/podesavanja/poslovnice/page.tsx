import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import BranchRow from './BranchRow';
import NewBranchForm from './NewBranchForm';

interface BranchRowData {
  id: string;
  name: string;
  active: boolean;
}

// M1 spec dopuna (6.9.2026, vlasnikov zahtev: "TT moze da ima vise ili jednu poslovnicu i to
// treba omoguciti podesavanjima na globalnom nivou aplikacije") — prvi ekran globalnih
// podešavanja u panelu. `GET /iam/branches` je otvoren svakom STAFF nalogu (isti obrazac kao
// `GET /iam/users/directory`), ali CREATE/EDIT ostaju ograničeni na Vlasnik/Direktor — ekran
// sam gate-uje formu za izmenu preko `M1/branch/EDIT`, list se učitava nezavisno od toga.
export default async function PoslovnicePage() {
  const me = await getMe();
  const canManage = hasPermission(me, 'M1', 'branch', 'EDIT');
  const canCreate = hasPermission(me, 'M1', 'branch', 'CREATE');

  let branches: BranchRowData[] = [];
  let error: string | null = null;
  try {
    branches = await apiFetch<BranchRowData[]>('/iam/branches');
  } catch {
    error = 'Učitavanje poslovnica nije uspelo.';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Poslovnice" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Poslovnice</h1>
      <p className="mb-4 text-xs text-ink-faint">
        TT može imati jednu ili više poslovnica. Rezervacija nasleđuje poslovnicu zaposlenog koji je kreira, u trenutku kreiranja.
      </p>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="max-w-xl rounded-lg border border-border bg-panel p-4">
          {branches.length === 0 && <p className="text-xs text-ink-faint">Nijedna poslovnica još nije dodata.</p>}
          {canManage
            ? branches.map((b) => <BranchRow key={b.id} id={b.id} name={b.name} active={b.active} />)
            : branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
                  <span>{b.name}</span>
                  <span className={b.active ? 'text-ok' : 'text-ink-faint'}>{b.active ? 'aktivna' : 'neaktivna'}</span>
                </div>
              ))}

          {canCreate && (
            <div className="mt-4 border-t border-border pt-4">
              <NewBranchForm />
            </div>
          )}
          {!canManage && !canCreate && (
            <p className="mt-3 text-xs text-ink-faint">Nemate dozvolu za izmenu poslovnica (M1/branch/EDIT ili CREATE).</p>
          )}
        </div>
      )}
    </div>
  );
}
