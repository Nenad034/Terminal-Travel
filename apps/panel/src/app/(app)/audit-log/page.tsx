import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import { Button } from '@/components/ui/button';
import AuditLogRows, { type AuditLogEntry } from './AuditLogRows';

// M17 spec §7 (Faza 0 izlazni kriterijum) — Vlasnik/Direktor vidi audit log. Dozvola
// (M1/audit-log/VIEW) se već proverava na nivou apps/api (AuditLogController) — ako
// korisnik nema pravo, apiFetch baca 403 i stranica prikazuje grešku umesto podataka
// (isti princip kao §3 — panel ne izmišlja dozvole, samo poštuje ono što API vrati).
// `back` dolazi iz query stringa (ProcessMapNodeSummaryCard.tsx) — iako ga danas generiše samo
// naš kod, tretira se kao nepouzdan ulaz (bilo ko može ručno da izmeni URL): prihvata se samo
// putanja unutar aplikacije (počinje jednim "/", nikad "//" — trik za protokol-relativni URL ka
// spoljnom sajtu), inače se link za povratak jednostavno ne prikazuje.
function safeInternalPath(path: string | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

interface AuditLogSearchParams {
  module?: string;
  action?: string;
  q?: string;
  from?: string;
  to?: string;
  back?: string;
  backLabel?: string;
}

export default async function AuditLogPage({ searchParams }: { searchParams: AuditLogSearchParams }) {
  let entries: AuditLogEntry[] = [];
  let error: string | null = null;
  try {
    const qs = new URLSearchParams();
    if (searchParams?.module) qs.set('module', searchParams.module);
    if (searchParams?.action) qs.set('action', searchParams.action);
    if (searchParams?.q) qs.set('q', searchParams.q);
    if (searchParams?.from) qs.set('from', searchParams.from);
    if (searchParams?.to) qs.set('to', searchParams.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    entries = await apiFetch<AuditLogEntry[]>(`/iam/audit-log${suffix}`);
  } catch {
    error = 'Nemate dozvolu za uvid u audit log (M1/audit-log/VIEW).';
  }

  const hasFilter = Boolean(searchParams?.module || searchParams?.action);
  const hasSearch = Boolean(searchParams?.q || searchParams?.from || searchParams?.to);
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

      {/* Dopuna (29.8.2026, na zahtev vlasnika: "dodajte i pretragu po pojmu i datumu", M1
          spec §6/§7) — `module`/`action`/`back`/`backLabel` se prenose kao skriveni ulazi da
          pretraga po pojmu/datumu ne obriše filter stigao klikom sa procesne mape. */}
      <form className="mb-3 flex flex-wrap items-end gap-2 text-xs" action="/audit-log">
        {searchParams?.module && <input type="hidden" name="module" value={searchParams.module} />}
        {searchParams?.action && <input type="hidden" name="action" value={searchParams.action} />}
        {searchParams?.back && <input type="hidden" name="back" value={searchParams.back} />}
        {searchParams?.backLabel && <input type="hidden" name="backLabel" value={searchParams.backLabel} />}
        <label className="flex flex-col gap-0.5">
          <span className="text-ink-faint">pojam</span>
          <input name="q" defaultValue={searchParams?.q ?? ''} placeholder="akcija, resurs, modul…" className="input" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-ink-faint">od datuma</span>
          <input name="from" type="date" defaultValue={searchParams?.from ?? ''} className="input" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-ink-faint">do datuma</span>
          <input name="to" type="date" defaultValue={searchParams?.to ?? ''} className="input" />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          pretraži
        </Button>
        {hasSearch && (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={(() => {
                const qs = new URLSearchParams();
                if (searchParams?.module) qs.set('module', searchParams.module);
                if (searchParams?.action) qs.set('action', searchParams.action);
                if (searchParams?.back) qs.set('back', searchParams.back);
                if (searchParams?.backLabel) qs.set('backLabel', searchParams.backLabel);
                const suffix = qs.toString() ? `?${qs.toString()}` : '';
                return `/audit-log${suffix}`;
              })()}
            >
              obriši pretragu
            </Link>
          </Button>
        )}
      </form>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {entries.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema zapisa.</p>}
          <AuditLogRows entries={entries} />
        </div>
      )}
    </div>
  );
}
