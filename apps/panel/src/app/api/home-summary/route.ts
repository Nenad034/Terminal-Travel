import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';

interface StranicenBroj {
  total: number;
}
interface ExpiringRelease {
  id: string;
}
interface AgentInboxSource {
  count: number;
}

// Sažetak za `HomeSidebarPanel.tsx` (26.8.2026, na zahtev vlasnika — "osmisliti šta možemo
// ovde da prikazujemo a što je važno za prikaz poslovanja", posle GitLens snimka ekrana kao
// primer). ISTI izvori podataka kao glavni dashboard (`app/(app)/page.tsx`, M17 spec §5) —
// ovo NIJE nov entitet/agregacija, samo isti brojevi sažeti za levu traku (klijentska
// komponenta, ne može direktno da pozove `getMe()`/`apiFetch` server-only helpere kao stranica).
export async function GET() {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });

  const canAudit = hasPermission(me, 'M1', 'audit-log', 'VIEW');
  const canContractPeriods = hasPermission(me, 'M3', 'contract-period', 'VIEW');
  const canTravelGuarantee = hasPermission(me, 'M11', 'travel-guarantee', 'VIEW');
  const canAgentInbox = hasPermission(me, 'M15', 'agent-inbox', 'VIEW');

  const [auditEntries, expiringReleases, guaranteeUtilization, agentInbox] = await Promise.all([
    // Straničenje audit loga (6.9.2026, dok. 39 nalaz 2.2) — odgovor je `{ data, total, ... }`, ne go
    // niz. Umesto da se povlači stranica pa filtrira u memoriji, filter ide SERVERU (`action` prima
    // više vrednosti razdvojenih zarezom) i broj se čita iz `total` — tako je tačan bez obzira na
    // veličinu stranice, a povlači se najmanje što treba.
    canAudit
      ? apiFetch<StranicenBroj>('/iam/audit-log?module=M1&action=user.locked,auth.login_failed&limit=1').catch(() => null)
      : Promise.resolve(null),
    canContractPeriods ? apiFetch<ExpiringRelease[]>('/contracting/contracts/expiring-releases').catch(() => []) : Promise.resolve([]),
    canTravelGuarantee
      ? apiFetch<{ utilizationPercent: number; guaranteeStatus: string | null }>('/compliance/travel-guarantee/utilization').catch(() => null)
      : Promise.resolve(null),
    canAgentInbox ? apiFetch<AgentInboxSource[]>('/ai-orchestration/inbox').catch(() => []) : Promise.resolve([]),
  ]);

  const securityAlertsCount = (auditEntries as StranicenBroj | null)?.total ?? 0;
  const agentInboxTotal = (agentInbox as AgentInboxSource[]).reduce((sum, s) => sum + s.count, 0);

  return NextResponse.json({
    expiringReleasesCount: canContractPeriods ? (expiringReleases as ExpiringRelease[]).length : null,
    securityAlertsCount: canAudit ? securityAlertsCount : null,
    guaranteeStatus: canTravelGuarantee ? (guaranteeUtilization?.guaranteeStatus ?? null) : null,
    agentInboxTotal: canAgentInbox ? agentInboxTotal : null,
  });
}
