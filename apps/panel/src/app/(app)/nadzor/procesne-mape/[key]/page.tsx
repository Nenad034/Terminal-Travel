import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import NadzorSubnav from '../../NadzorSubnav';
import ProcessMapView from './ProcessMapView';

interface ProcessMapNodeDefinition {
  id: string;
  label: string;
  matchActions: string[];
}

interface ProcessMapDefinition {
  key: string;
  label: string;
  module: string;
  nodes: ProcessMapNodeDefinition[];
}

// M18 spec §9a. Definicija (čvorovi + matchActions) se učitava jednom, server-side — samo
// BROJEVI se osvežavaju uživo na klijentu (ProcessMapView.tsx, poll na 5s preko
// /api/ops/process-maps/[key]/live).
export default async function ProcessMapDetailPage({ params }: { params: { key: string } }) {
  let map: ProcessMapDefinition | null = null;
  let error: string | null = null;
  try {
    const maps = await apiFetch<ProcessMapDefinition[]>('/ops/process-maps');
    map = maps.find((m) => m.key === params.key) ?? null;
  } catch {
    error = 'Nemate dozvolu za uvid u procesne mape (M18/process-map/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label={map?.label ?? 'Procesna mapa'} />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> {map?.label ?? params.key}
        </h1>
        <p className="text-xs text-ink-dim">Osvežava se na svakih 5 sekundi. Klik na čvor otvara tačan trag u audit logu.</p>
      </div>

      <NadzorSubnav active="/nadzor/procesne-mape" />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {!error && !map && <p className="rounded bg-danger-bg p-3 text-sm text-danger">Procesna mapa "{params.key}" nije registrovana.</p>}
      {!error && map && <ProcessMapView mapKey={map.key} module={map.module} nodes={map.nodes} />}
    </div>
  );
}
