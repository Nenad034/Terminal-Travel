import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import CreateClientForm from './CreateClientForm';
import { ActivateButton, ApproveReadWriteButton, SuspendButton } from './ClientActionButtons';

interface McpClient {
  id: string;
  clientName: string;
  accessLevel: 'READ_ONLY' | 'READ_WRITE';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  rateLimitPerMinute: number;
  linkedUserId: string | null;
  createdAt: string;
}

// M17 spec §4 (Faza 6, dopuna 22.8.2026 — jedini M16 endpoint bez ijednog panel ekrana do sad)
// — M16 spec §7/§8: registracija/aktivacija/READ_WRITE odobrenje/suspendovanje spoljnih MCP
// klijenata (ChatGPT, Google, Sabre/MindTrip...), Vlasnik/Direktor.
export default async function McpClientsPage() {
  const me = await getMe();
  const canView = hasPermission(me, 'M16', 'mcp-client', 'VIEW');
  const canManage = hasPermission(me, 'M16', 'mcp-client', 'MANAGE');
  const canApprove = hasPermission(me, 'M16', 'mcp-client', 'APPROVE_READ_WRITE');

  let clients: McpClient[] = [];
  let error: string | null = null;

  if (canView) {
    try {
      clients = await apiFetch<McpClient[]>('/mcp-admin/clients');
    } catch {
      error = 'Učitavanje MCP klijenata nije uspelo.';
    }
  } else {
    error = 'Nemate dozvolu za uvid u MCP klijente (M16/mcp-client/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="MCP klijenti" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls mcp-clients/
        </h1>
        <p className="text-xs text-ink-dim">
          Spoljni AI agenti koji pristupaju katalogu i rezervacijama preko Model Context Protocol (M16 spec §2/§3) —
          isti kanal kao M8/M9, iste provere kreditnog limita i kapaciteta.
        </p>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <>
          {canManage && <CreateClientForm />}

          <div className="overflow-hidden rounded-lg border border-border">
            {clients.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema registrovanih MCP klijenata.</p>}
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <Icon name="radio-tower" className="text-accent" />
                    {c.clientName}
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">
                    rate limit: {c.rateLimitPerMinute}/min
                    {c.linkedUserId && <span> · povezan AI_AGENT nalog</span>}
                    <span> · registrovan {new Date(c.createdAt).toLocaleDateString('sr-RS')}</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <AccessLevelBadge level={c.accessLevel} />
                  <StatusBadge status={c.status} />
                  {c.status === 'PENDING' && <ActivateButton id={c.id} canManage={canManage} />}
                  {c.status === 'ACTIVE' && c.accessLevel === 'READ_ONLY' && <ApproveReadWriteButton id={c.id} canApprove={canApprove} />}
                  {c.status !== 'SUSPENDED' && <SuspendButton id={c.id} canManage={canManage} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: McpClient['status'] }) {
  const tone = status === 'ACTIVE' ? 'text-ok bg-ok-bg' : status === 'SUSPENDED' ? 'text-danger bg-danger-bg' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

function AccessLevelBadge({ level }: { level: McpClient['accessLevel'] }) {
  const tone = level === 'READ_WRITE' ? 'text-accent-strong bg-accent-soft' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{level}</span>;
}
