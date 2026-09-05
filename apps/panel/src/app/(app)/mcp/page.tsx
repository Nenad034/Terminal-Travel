import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import CreateClientForm from './CreateClientForm';
import { ActivateButton, ApproveReadWriteButton, SuspendButton } from './ClientActionButtons';
import { Badge } from '@/components/ui/badge';


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
        <h1 className="text-lg font-semibold text-ink">MCP klijenti</h1>
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
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}

function AccessLevelBadge({ level }: { level: McpClient['accessLevel'] }) {
  if (level === 'READ_WRITE') return (
    <Badge variant="secondary" className="bg-accent-soft text-accent-strong">
      {level}
    </Badge>
  );
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {level}
    </Badge>
  );
}
