import Link from 'next/link';
import { getMe, hasPermission } from '@/lib/me';
import { apiFetch } from '@/lib/api-client';
import Icon from '@/components/Icon';

interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  actorType: string;
  createdAt: string;
  resourceType: string;
  resourceId: string;
}

interface ExpiringRelease {
  id: string;
  contractId: string;
  releaseDeadline: string;
}

interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

// M17 spec §5 — dashboard agregira upozorenja iz M3 (rokovi alotmana), M11 (istek
// garancije putovanja) i M1 (neuspeli pokušaji prijave/zaključani nalozi), filtrirano po
// ulozi (svaka sekcija se povlači samo ako korisnik ima odgovarajuću dozvolu — čitanje iz
// postojećih endpoint-a, ne novi entitet, isti princip kao §5 teksta specifikacije).
export default async function DashboardPage() {
  const me = await getMe();
  if (!me) return null;

  const canAudit = hasPermission(me, 'M1', 'audit-log', 'VIEW');
  const canContractPeriods = hasPermission(me, 'M3', 'contract-period', 'VIEW');
  const canTravelGuarantee = hasPermission(me, 'M11', 'travel-guarantee', 'VIEW');
  const canAgentInbox = hasPermission(me, 'M15', 'agent-inbox', 'VIEW');

  const [auditEntries, expiringReleases, guaranteeUtilization, agentInbox] = await Promise.all([
    canAudit ? apiFetch<AuditLogEntry[]>('/iam/audit-log').catch(() => []) : Promise.resolve([]),
    canContractPeriods
      ? apiFetch<ExpiringRelease[]>('/contracting/contracts/expiring-releases').catch(() => [])
      : Promise.resolve([]),
    canTravelGuarantee
      ? apiFetch<{ utilizationPercent: number; guaranteeStatus: string | null }>(
          '/compliance/travel-guarantee/utilization',
        ).catch(() => null)
      : Promise.resolve(null),
    canAgentInbox ? apiFetch<AgentInboxSource[]>('/ai-orchestration/inbox').catch(() => []) : Promise.resolve([]),
  ]);

  const securityAlerts = (auditEntries as AuditLogEntry[])
    .filter((e) => e.module === 'M1' && (e.action === 'user.locked' || e.action === 'auth.login_failed'))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> dobrodošli, {me.fullName}
        </h1>
        <p className="mt-1 text-xs text-ink-faint">
          Uloga: <span className="rounded-full bg-accent2-soft px-2 py-0.5 text-accent2">{me.roles.join(', ') || '—'}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canContractPeriods && (
          <Card icon="file-text" title="M3 — rokovi povrata alotmana" href="/dobavljaci">
            {(expiringReleases as ExpiringRelease[]).length === 0 ? (
              <EmptyRow text="Nema alotmana kom se bliži rok povrata." />
            ) : (
              <ul className="flex flex-col gap-1">
                {(expiringReleases as ExpiringRelease[]).slice(0, 5).map((r) => (
                  <li key={r.id} className="rounded bg-warn-bg px-2 py-1 text-xs text-warn">
                    Ugovor #{r.contractId.slice(0, 8)} — rok povrata {new Date(r.releaseDeadline).toLocaleDateString('sr-RS')}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {canTravelGuarantee && (
          <Card icon="law" title="M11 — garancija putovanja" href="/compliance">
            {guaranteeUtilization && guaranteeUtilization.guaranteeStatus ? (
              <div className="text-xs text-ink-dim">
                <p>
                  Iskorišćenost: <b className="text-ink">{guaranteeUtilization.utilizationPercent.toFixed(1)}%</b>
                </p>
                <p className="mt-1">
                  Status garancije: <b className="text-ink">{guaranteeUtilization.guaranteeStatus}</b>
                </p>
              </div>
            ) : (
              <EmptyRow text="Nema podataka o garanciji putovanja." />
            )}
          </Card>
        )}

        {canAudit && (
          <Card icon="shield" title="M1 — bezbednosna upozorenja" href="/audit-log">
            {securityAlerts.length === 0 ? (
              <EmptyRow text="Nema neuspelih pokušaja prijave ni zaključanih naloga." />
            ) : (
              <ul className="flex flex-col gap-1">
                {securityAlerts.map((e) => (
                  <li key={e.id} className="rounded bg-danger-bg px-2 py-1 text-xs text-danger">
                    {e.action === 'user.locked' ? 'Nalog zaključan' : 'Neuspeo pokušaj prijave'} —{' '}
                    {new Date(e.createdAt).toLocaleString('sr-RS')}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {canAudit && (
          <Card icon="history" title="Audit log" href="/audit-log">
            <p className="text-xs text-ink-dim">Pun, append-only zapis svake izmene u sistemu — dostupan Vlasniku/Direktoru.</p>
            <Link href="/audit-log" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
              Otvori audit log →
            </Link>
          </Card>
        )}

        {canAgentInbox && (
          <Card icon="inbox" title="Agent Inbox — čeka odobrenje">
            {(agentInbox as AgentInboxSource[]).every((s) => s.count === 0) ? (
              <EmptyRow text="Nema stavki koje čekaju odobrenje." />
            ) : (
              <ul className="flex flex-col gap-1">
                {(agentInbox as AgentInboxSource[])
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <li key={`${s.moduleCode}.${s.actionCode}`} className="rounded bg-warn-bg px-2 py-1 text-xs text-warn">
                      {s.moduleCode} — {s.label}: <b>{s.count}</b>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {!canAudit && !canContractPeriods && !canTravelGuarantee && !canAgentInbox && (
        <p className="mt-6 text-xs text-ink-faint">Nema dodatnih upozorenja za vašu ulogu.</p>
      )}
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={icon} className="text-accent" />
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-ink-faint">{text}</p>;
}
