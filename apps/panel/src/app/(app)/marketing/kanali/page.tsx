import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewChannelForm from './NewChannelForm';
import ChannelStatusForm from './ChannelStatusForm';
import { Badge } from '@/components/ui/badge';


interface ChannelConfig {
  channelCode: string;
  displayName: string;
  status: string;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 6) — konfiguracija distribucionih kanala (M12 §4/§7). Kredencijali
// (authConfig) se namerno ne prikazuju/ne unose ovde u čitljivom obliku iz istog razloga kao
// M4 ProviderConfig.auth_config_encrypted — enkriptovano polje, forma ne pokazuje sadržaj.
export default async function KanaliPage() {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M12', 'channel-config', 'EDIT');

  let channels: ChannelConfig[] = [];
  let error: string | null = null;
  try {
    channels = await apiFetch<ChannelConfig[]>('/marketing/channels');
  } catch {
    error = 'Nemate dozvolu za uvid u distribucione kanale (M12/channel-config/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Marketing kanali" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Marketing kanali</h1>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="mb-4 flex flex-col gap-2">
          {channels.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema konfigurisanih kanala.</p>}
          {channels.map((c) => (
            <div key={c.channelCode} className="rounded-lg border border-border bg-panel p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-ink">
                    {c.displayName} <span className="text-[11px] text-ink-faint">({c.channelCode})</span>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {canEdit && <ChannelStatusForm channelCode={c.channelCode} displayName={c.displayName} status={c.status} />}
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
