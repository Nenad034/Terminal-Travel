import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';

interface AuditLogEntry {
  action: string;
  module: string;
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
    canAudit ? apiFetch<AuditLogEntry[]>('/iam/audit-log').catch(() => []) : Promise.resolve([]),
    canContractPeriods ? apiFetch<ExpiringRelease[]>('/contracting/contracts/expiring-releases').catch(() => []) : Promise.resolve([]),
    canTravelGuarantee
      ? apiFetch<{ utilizationPercent: number; guaranteeStatus: string | null }>('/compliance/travel-guarantee/utilization').catch(() => null)
      : Promise.resolve(null),
    canAgentInbox ? apiFetch<AgentInboxSource[]>('/ai-orchestration/inbox').catch(() => []) : Promise.resolve([]),
  ]);

  const securityAlertsCount = (auditEntries as AuditLogEntry[]).filter(
    (e) => e.module === 'M1' && (e.action === 'user.locked' || e.action === 'auth.login_failed'),
  ).length;
  const agentInboxTotal = (agentInbox as AgentInboxSource[]).reduce((sum, s) => sum + s.count, 0);

  return NextResponse.json({
    expiringReleasesCount: canContractPeriods ? (expiringReleases as ExpiringRelease[]).length : null,
    securityAlertsCount: canAudit ? securityAlertsCount : null,
    guaranteeStatus: canTravelGuarantee ? (guaranteeUtilization?.guaranteeStatus ?? null) : null,
    agentInboxTotal: canAgentInbox ? agentInboxTotal : null,
  });
}
