import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface Subagent {
  id: string;
  clientAccountId: string;
  parentSubagentId: string | null;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
  commissionPercentage: number | null;
  creditLimit: number | null;
  creditLimitCurrency: string | null;
  createdAt: string;
}

interface ClientAccountSummary {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
  taxId: string | null;
}

// M17 spec §4/§7 (Faza 4) — "B2B partneri", M7 §2.1/§9/§11 GET /b2b/subagents ("lista,
// agencija vidi sve"). Subagent zapis ne nosi naziv firme (samo clientAccountId) — kompozicija
// na nivou prikaza dovlači naziv iz M6 (§2 M17 spec), isti obrazac kao rezervacije/[id] M6
// kartica iz Faze 3.
export default async function B2bPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M7', 'subagent', 'CREATE');
  const canViewRebates = hasPermission(me, 'M7', 'commission-rebate', 'VIEW');
  const canViewAccounts = hasPermission(me, 'M6', 'client-account', 'VIEW');

  let subagents: Subagent[] = [];
  let error: string | null = null;
  try {
    subagents = await apiFetch<Subagent[]>('/b2b/subagents');
  } catch {
    error = 'Nemate dozvolu za uvid u B2B subagente (M7/subagent/VIEW).';
  }

  const accountsById = new Map<string, ClientAccountSummary>();
  if (!error && canViewAccounts && subagents.length > 0) {
    const results = await Promise.all(
      subagents.map((s) => apiFetch<ClientAccountSummary>(`/crm/client-accounts/${s.clientAccountId}`).catch(() => null)),
    );
    results.forEach((acc) => {
      if (acc) accountsById.set(acc.id, acc);
    });
  }

  return (
    <div className="p-6">
      <RegisterTab label="B2B partneri" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">B2B partneri</h1>
        </div>
        <div className="flex gap-2">
          {canViewRebates && (
            <Button asChild variant="outline" size="sm">
              <Link href="/b2b/rabati" className="flex items-center gap-1.5">
                <Icon name="diff" /> rabati provizije
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/b2b/novi" className="flex items-center gap-1.5">
                <Icon name="add" /> novi subagent
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {subagents.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema registrovanih subagenata.</p>}
          {subagents.map((s) => {
            const account = accountsById.get(s.clientAccountId);
            const name = account ? (account.accountType === 'LEGAL_ENTITY' ? account.companyName : account.fullName) : s.clientAccountId.slice(0, 8);
            return (
              <TabLink
                key={s.id}
                href={`/b2b/${s.id}`}
                label={name ?? 'Subagent'}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div>
                  <div className="font-medium text-ink">
                    {name}
                    {account?.taxId && <span className="ml-2 text-[11px] text-ink-faint">PIB {account.taxId}</span>}
                    {s.parentSubagentId && <span className="ml-2 text-[11px] text-ink-faint">sub-subagent</span>}
                  </div>
                  <div className="text-xs text-ink-faint">
                    provizija {s.commissionPercentage != null ? `${s.commissionPercentage}%` : '—'}
                    {' · '}
                    kredit {s.creditLimit != null ? `${s.creditLimit.toLocaleString('sr-RS')} ${s.creditLimitCurrency}` : '—'}
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </TabLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
