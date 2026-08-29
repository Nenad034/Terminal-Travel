import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import ActorLabel from '@/components/ActorLabel';
import { Button } from '@/components/ui/button';

interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  actorType: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  // M1 `AuditLogEntry.timestamp` (schema.prisma) — ekran je do sad čitao nepostojeći
  // `createdAt`, pa je svaki red prikazivao "Invalid Date" (nalaz iz live-provere, avgust 2026).
  timestamp: string;
  beforeState?: unknown;
  afterState?: unknown;
}

// M17 spec §7 (Faza 0 izlazni kriterijum) — Vlasnik/Direktor vidi audit log. Dozvola
// (M1/audit-log/VIEW) se već proverava na nivou apps/api (AuditLogController) — ako
// korisnik nema pravo, apiFetch baca 403 i stranica prikazuje grešku umesto podataka
// (isti princip kao §3 — panel ne izmišlja dozvole, samo poštuje ono što API vrati).
// ActorType (HUMAN/AI_AGENT/SYSTEM) preveden u reč koju čovek čita; bedž ("AI") dodaje ActorLabel.
// `back` dolazi iz query stringa (ProcessMapNodeSummaryCard.tsx) — iako ga danas generiše samo
// naš kod, tretira se kao nepouzdan ulaz (bilo ko može ručno da izmeni URL): prihvata se samo
// putanja unutar aplikacije (počinje jednim "/", nikad "//" — trik za protokol-relativni URL ka
// spoljnom sajtu), inače se link za povratak jednostavno ne prikazuje.
function safeInternalPath(path: string | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

function actorWord(actorType: string): string {
  if (actorType === 'HUMAN') return 'korisnik';
  if (actorType === 'AI_AGENT') return 'AI agent';
  if (actorType === 'SYSTEM') return 'sistem';
  return 'nepoznat akter';
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { module?: string; action?: string; back?: string; backLabel?: string };
}) {
  let entries: AuditLogEntry[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams();
    if (searchParams?.module) qs.set('module', searchParams.module);
    if (searchParams?.action) qs.set('action', searchParams.action);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    entries = await apiFetch<AuditLogEntry[]>(`/iam/audit-log${suffix}`);
  } catch {
    error = 'Nemate dozvolu za uvid u audit log (M1/audit-log/VIEW).';
  }

  const hasFilter = Boolean(searchParams?.module || searchParams?.action);
  const backHref = safeInternalPath(searchParams?.back);

  return (
    <div className="p-6">
      <RegisterTab label="Audit log" />

      {backHref && (
        // M18 spec §9a dopuna (29.8.2026, na zahtev vlasnika: "kada se udje u neku od listi u
        // procesnim mapama nemamo nacin da se vratimo korak ili dva nazad") — eksplicitan put
        // nazad na ekran sa kog je stigao klik (procesna mapa), ne samo browser back dugme.
        <Link href={backHref} className="mb-2 flex items-center gap-1 text-xs text-ink-faint hover:text-accent">
          <span aria-hidden="true">←</span> Nazad na {searchParams?.backLabel || 'prethodni ekran'}
        </Link>
      )}

      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> tail -f audit.log
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Append-only zapis svake izmene u sistemu.</p>

      {hasFilter && (
        // Klik iz "Procesne mape" (M18 spec §9a) ili iz drugih dashboard upozorenja vodi
        // ovde sa `module`/`action` u URL-u (M1 spec §6, dopunjeno 29.8.2026) — filter je
        // vidljiv, sa jasnim putem nazad na neisfiltriranu listu.
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-faint">
          <span>
            filtrirano: {searchParams?.module && <span className="font-mono text-accent2">{searchParams.module}</span>}
            {searchParams?.action && <span className="font-mono text-ink"> · {searchParams.action}</span>}
          </span>
          <Button asChild variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-[11px]">
            <Link href="/audit-log">obriši filter</Link>
          </Button>
        </div>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {entries.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema zapisa.</p>}
          {entries.map((e) => (
            // `id` (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka stavkama na koje
            // obavestava") — dashboard "M1 — bezbednosna upozorenja" sad linkuje TAČNO na red
            // koji ga je prouzrokovao (`/audit-log#audit-{id}`), ne samo na opštu listu.
            <div key={e.id} id={`audit-${e.id}`} className="border-b border-border bg-panel px-4 py-2 font-mono text-xs last:border-b-0 hover:bg-panel-2">
              <span className="text-ink-faint">{new Date(e.timestamp).toLocaleString('sr-RS')}</span>{' '}
              <span className="text-accent2">{e.module}</span> <span className="text-ink">{e.action}</span>{' '}
              <span className="text-ink-dim">
                {e.resourceType}#{e.resourceId?.slice(0, 8)}
              </span>{' '}
              {/* §3.1 / 29-DIZAJN-SISTEM-UI.md §6a — ranije je ovde stajala sirova enum vrednost
                  (`[AI_AGENT]`). Ime aktera audit log API ne vraća (samo actorId), pa se prikazuje
                  čitljiva reč za poreklo + skraćen ID kao identifikator — ID je ovde legitiman
                  jer je audit log tehnički prikaz (§3, monospace za ID-jeve), enum nije. */}
              <ActorLabel
                origin={e.actorType}
                name={actorWord(e.actorType)}
                className="text-ink-faint"
              />{' '}
              <span className="text-ink-faint">#{e.actorId?.slice(0, 8) ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
