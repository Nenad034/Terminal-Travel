import Link from 'next/link';
import { getMe, hasPermission } from '@/lib/me';
import { apiFetch } from '@/lib/api-client';
import Icon from '@/components/Icon';
import ContentCard from '@/components/ContentCard';


interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  actorType: string;
  // Stvarno polje na `AuditLogEntry` (M1 schema.prisma) je `timestamp`, ne `createdAt` — ranije
  // je ova stranica čitala nepostojeće polje pa je svaki red prikazivao "Invalid Date" (nalaz iz
  // uživo provere, 23.8.2026). `/audit-log/page.tsx` je istu grešku već ispravio ranije (vidi
  // komentar tamo) — ovaj ekran ju je jedini još imao.
  timestamp: string;
  resourceType: string;
  resourceId: string;
}

interface ExpiringRelease {
  id: string;
  contractId: string;
  // API (`ContractPeriodsService.expiringReleases`, M3) vraća sirov `ContractPeriod` — ne postoji
  // polje `releaseDeadline` (ranije pretpostavljeno, uzrok "Invalid Date" u ovoj kartici, nalaz iz
  // uživo provere 23.8.2026). Stvaran rok se računa: `stayFrom` minus `releaseDaysBefore` dana.
  stayFrom: string;
  releaseDaysBefore: number | null;
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

  // Rok povrata = dan dolaska minus release_days_before (M3 spec §6) — nema odvojenog polja u
  // bazi, računa se ovde isto kao što bi ga računao svaki drugi potrošač ovog endpoint-a.
  function releaseDeadline(r: ExpiringRelease): Date {
    const days = r.releaseDaysBefore ?? 0;
    return new Date(new Date(r.stayFrom).getTime() - days * 24 * 60 * 60 * 1000);
  }

  // Ciljevi linkova za Agent Inbox (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka
  // stavkama na koje obavestava") — samo za module koji STVARNO imaju ekran gde se ta stavka
  // može videti/odobriti. M3 (uvoz cenovnika) i M5 (operativne liste dobavljaču) nemaju još
  // sopstveni panel ekran (samo AI-draft prikaz unutar M22 mejl niti) — namerno bez linka umesto
  // izmišljanja putanje koja ne postoji.
  const AGENT_INBOX_LINKS: Record<string, string> = {
    M7: '/b2b/rabati?status=DRAFT',
    M12: '/marketing?status=PENDING_APPROVAL',
    M14: '/podrska',
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-ink">Dobrodošli, {me.fullName}</h1>
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
                  <li key={r.id}>
                    <Link href={`/ugovori#contract-${r.contractId}`} className="block rounded bg-warn-bg px-2 py-1 text-xs text-warn hover:bg-warn-bg/70">
                      Ugovor #{r.contractId.slice(0, 8)} — rok povrata {releaseDeadline(r).toLocaleDateString('sr-RS')}
                    </Link>
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
                  <li key={e.id}>
                    <Link href={`/audit-log#audit-${e.id}`} className="block rounded bg-danger-bg px-2 py-1 text-xs text-danger hover:bg-danger-bg/70">
                      {e.action === 'user.locked' ? 'Nalog zaključan' : 'Neuspeo pokušaj prijave'} —{' '}
                      {new Date(e.timestamp).toLocaleString('sr-RS')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {canAudit && (
          // Dizajn dok. §6e, podforma "naslovni red akcija" — deljena komponenta.
          <ContentCard
            title="Audit log"
            description="Pun, append-only zapis svake izmene u sistemu — dostupan Vlasniku/Direktoru."
            actions={[{ label: 'Otvori audit log', href: '/audit-log' }]}
          />
        )}

        {canAgentInbox && (
          <Card icon="inbox" title="Agent Inbox — čeka odobrenje">
            {(agentInbox as AgentInboxSource[]).every((s) => s.count === 0) ? (
              <EmptyRow text="Nema stavki koje čekaju odobrenje." />
            ) : (
              <ul className="flex flex-col gap-1">
                {(agentInbox as AgentInboxSource[])
                  .filter((s) => s.count > 0)
                  .map((s) => {
                    const href = AGENT_INBOX_LINKS[s.moduleCode];
                    const content = (
                      <>
                        {s.moduleCode} — {s.label}: <b>{s.count}</b>
                      </>
                    );
                    return (
                      <li key={`${s.moduleCode}.${s.actionCode}`}>
                        {href ? (
                          <Link href={href} className="block rounded bg-warn-bg px-2 py-1 text-xs text-warn hover:bg-warn-bg/70">
                            {content}
                          </Link>
                        ) : (
                          <span title="Još nema poseban ekran za ovu stavku" className="block rounded bg-warn-bg px-2 py-1 text-xs text-warn">
                            {content}
                          </span>
                        )}
                      </li>
                    );
                  })}
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

function Card({ icon, title, href, children }: { icon: string; title: string; href?: string; children: React.ReactNode }) {
  // `href` je ranije bio primljen a nikad iskorišćen — naslov karte se nikad nije mogao kliknuti
  // ka opštoj listi (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka stavkama").
  const titleRow = (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon name={icon} className="text-accent" />
      {title}
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      {href ? (
        <Link href={href} className="hover:text-accent">
          {titleRow}
        </Link>
      ) : (
        titleRow
      )}
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-ink-faint">{text}</p>;
}
