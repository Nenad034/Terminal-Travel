import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NadzorSubnav from '../NadzorSubnav';
import NewChannelForm from './NewChannelForm';
import ChannelStatusForm from './ChannelStatusForm';
import { Badge } from '@/components/ui/badge';

interface NotificationChannel {
  id: string;
  channelType: string;
  recipientRole: string;
  status: string;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 7) — M18 §3/§9. GET/POST /ops/notification-channels — configEncrypted
// se nikad ne vraća sa API-ja (spec §3 tabela) i ova stranica ga nikad ne unosi nazad, isti
// princip kao M12 marketing/kanali.
export default async function NadzorKanaliPage() {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M18', 'notification-channel', 'EDIT');

  let channels: NotificationChannel[] = [];
  let error: string | null = null;
  try {
    channels = await apiFetch<NotificationChannel[]>('/ops/notification-channels');
  } catch {
    error = 'Nemate dozvolu za uvid u kanale obaveštenja (M18/notification-channel/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Nadzor — kanali" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> nadzor/kanali/
        </h1>
        <p className="text-xs text-ink-dim">Spoljni kanali dostave obaveštenja (Telegram/email) — M18 spec §3.</p>
      </div>

      <NadzorSubnav active="/nadzor/kanali" />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="mb-4 flex flex-col gap-2">
          {channels.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema konfigurisanih kanala.</p>}
          {channels.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-panel p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-ink">
                  {c.channelType} <span className="text-[11px] text-ink-faint">→ {c.recipientRole}</span>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {canEdit && <ChannelStatusForm id={c.id} status={c.status} />}
            </div>
          ))}
        </div>
      )}

      {!error && canEdit && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="add" className="text-accent" /> Novi kanal
          </div>
          <NewChannelForm />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <Badge variant="ok">{status}</Badge>;
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {status}
    </Badge>
  );
}
