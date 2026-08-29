import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import NadzorSubnav from '../NadzorSubnav';
import Icon from '@/components/Icon';

interface ProcessMapDefinition {
  key: string;
  label: string;
  module: string;
  nodes: { id: string; label: string }[];
}

// M18 spec §9a — katalog registrovanih "živih procesnih mapa". Vlasnikov zahtev (29.8.2026):
// "šta god da radimo u nekom od modula TT-a, da se klikom na jednu ikonu otvori modul u kom
// ćemo videti grafički i pratiti kako se šta izvršava" — ovo je taj ulaz, jedna kartica po mapi.
export default async function ProcessMapsPage() {
  let maps: ProcessMapDefinition[] = [];
  let error: string | null = null;
  try {
    maps = await apiFetch<ProcessMapDefinition[]>('/ops/process-maps');
  } catch {
    error = 'Nemate dozvolu za uvid u procesne mape (M18/process-map/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Procesne mape" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls nadzor/procesne-mape/
        </h1>
        <p className="text-xs text-ink-dim">Živa slika kako se šta izvršava u modulu, građena nad postojećim audit logom (M18 spec §9a).</p>
      </div>

      <NadzorSubnav active="/nadzor/procesne-mape" />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.length === 0 && <p className="text-xs text-ink-faint">Nijedna procesna mapa još nije registrovana.</p>}
          {maps.map((m) => (
            <Link
              key={m.key}
              href={`/nadzor/procesne-mape/${m.key}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-4 hover:border-accent"
            >
              <div className="flex items-center gap-2">
                <Icon name="pulse" className="text-accent" />
                <span className="text-sm font-semibold text-ink">{m.label}</span>
              </div>
              <p className="text-xs text-ink-faint">{m.nodes.length} čvorova · modul {m.module}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
