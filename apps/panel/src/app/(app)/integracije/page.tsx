import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';

interface ProviderConfigRow {
  providerCode: string;
  displayName: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  useMock: boolean;
}

interface ProviderHealthRow {
  providerCode: string;
  latencyMsAvg: number;
  uptimePercentage: string | number;
  errorCountLastHour: number;
  status: 'ONLINE' | 'UNSTABLE' | 'OFFLINE';
  computedAt: string;
}

interface Connection {
  providerCode: string;
  displayName: string;
  category: string;
  configStatus: 'ACTIVE' | 'INACTIVE';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  useMock: boolean;
  health: ProviderHealthRow | null;
}

// Dopuna (23.8.2026, na zahtev vlasnika: "Kada se klikne na settings dugme u levom panelu
// treba da se pojave sve live api konekcije sa nazivom statusom i health check statusom") —
// prvi panel ekran koji spaja dva već postojeća, do sad odvojena endpoint-a: M4
// `GET /integrations/providers` (naziv/konfiguracioni status/kategorija, M4 spec §6/§7) i M18
// `GET /ops/provider-health` (health-check status/latencija/uptime/broj grešaka, poslednji sat,
// M18 spec §2.3/§9). Spajanje se radi ovde, u panelu (prezentacioni sloj) — nijedan od dva
// backend modula ne dobija novu zavisnost ka drugom (princip #2 Master dokumenta, moduli su
// granice preko API-ja, ne slojevi).
export default async function IntegracijePage() {
  const me = await getMe();
  const canViewConfig = hasPermission(me, 'M4', 'provider-config', 'VIEW');
  const canViewHealth = hasPermission(me, 'M18', 'provider-health', 'VIEW');

  let connections: Connection[] = [];
  let error: string | null = null;

  if (!canViewHealth) {
    error = 'Nemate dozvolu za uvid u health-check status provajdera (M18/provider-health/VIEW).';
  } else {
    try {
      const [configs, health] = await Promise.all([
        canViewConfig ? apiFetch<ProviderConfigRow[]>('/integrations/providers') : Promise.resolve<ProviderConfigRow[]>([]),
        apiFetch<ProviderHealthRow[]>('/ops/provider-health'),
      ]);
      const healthByCode = new Map(health.map((h) => [h.providerCode, h]));
      if (canViewConfig) {
        connections = configs
          .map((c) => ({
            providerCode: c.providerCode,
            displayName: c.displayName,
            category: c.category,
            configStatus: c.status,
            circuitState: c.circuitState,
            useMock: c.useMock,
            health: healthByCode.get(c.providerCode) ?? null,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      } else {
        // Nema M4 dozvolu — i dalje prikaži health-check podatke koje SME da vidi, samo bez
        // naziva/kategorije/konfiguracionog statusa (koristi kod provajdera kao naziv).
        connections = health.map((h) => ({
          providerCode: h.providerCode,
          displayName: h.providerCode,
          category: '—',
          configStatus: 'ACTIVE',
          circuitState: 'CLOSED',
          useMock: false,
          health: h,
        }));
      }
    } catch {
      error = 'Učitavanje API konekcija nije uspelo.';
    }
  }

  return (
    <div className="p-6">
      <RegisterTab label="API konekcije" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> ls integracije/
        </h1>
        <p className="text-xs text-ink-dim">
          Sve žive konekcije ka spoljnim dobavljačima (M4 spec §6/§7) — konfiguracioni status i poslednji health-check nalaz
          (M18 spec §2.3, računa se na 15 minuta).
        </p>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {connections.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-faint">Nema konfigurisanih provajdera.</p>
          )}
          {connections.map((c) => (
            <div key={c.providerCode} className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <Icon name="pulse" className="text-accent" />
                  {c.displayName}
                  {c.useMock && <span className="rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-mono text-ink-faint">MOCK</span>}
                </div>
                <div className="mt-1 text-xs text-ink-faint">
                  {c.providerCode} · {c.category}
                  {c.health && (
                    <>
                      {' '}
                      · latencija {c.health.latencyMsAvg}ms · uptime {Number(c.health.uptimePercentage).toFixed(1)}% · {c.health.errorCountLastHour} grešaka
                      (poslednji sat)
                    </>
                  )}
                  {!c.health && <> · nema health-check podatka u poslednjih 15 min (nema poziva u prozoru)</>}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <ConfigStatusBadge status={c.configStatus} />
                <CircuitBadge state={c.circuitState} />
                <HealthBadge status={c.health?.status ?? null} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigStatusBadge({ status }: { status: Connection['configStatus'] }) {
  const tone = status === 'ACTIVE' ? 'text-ok bg-ok-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`} title="Konfiguracioni status (M4)">{status}</span>;
}

function CircuitBadge({ state }: { state: Connection['circuitState'] }) {
  if (state === 'CLOSED') return null; // podrazumevano/zdravo stanje — ne zaslužuje sopstvenu oznaku
  const tone = state === 'OPEN' ? 'text-danger bg-danger-bg' : 'text-warn bg-warn-bg';
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`} title="Circuit breaker stanje (M4 §4.1)">
      circuit: {state}
    </span>
  );
}

function HealthBadge({ status }: { status: ProviderHealthRow['status'] | null }) {
  if (!status) return <span className="rounded bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink-faint">NEMA PODATKA</span>;
  const tone = status === 'ONLINE' ? 'text-ok bg-ok-bg' : status === 'OFFLINE' ? 'text-danger bg-danger-bg' : 'text-warn bg-warn-bg';
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`} title="Health-check status (M18 §2.3, ažurira se na 15 min)">
      {status}
    </span>
  );
}
