import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import { Button } from '@/components/ui/button';
import AuditLogRows, { type AuditLogEntry } from './AuditLogRows';
import AuditLogSearchForm from './AuditLogSearchForm';


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

export default async function AuditLogPage(props: { searchParams: Promise<AuditLogSearchParams> }) {
  const searchParams = await props.searchParams;
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

      <h1 className="mb-4 text-lg font-semibold text-ink">Audit log</h1>

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

      {/* Dopuna (29.8.2026, na zahtev vlasnika: "dodajte i pretragu po pojmu i datumu" +
          "omogucite kada se ukucava pojama da se odmah filtrirajju stavke liste", M1 spec
          §6/§7) — klijentska komponenta, pojam se filtrira uživo (debounce), datum preko
          DateField.tsx (kalendar ili kucanje "12082026"). `module`/`action`/`back`/`backLabel`
          se prenose da pretraga ne obriše filter stigao klikom sa procesne mape. */}
      <AuditLogSearchForm
        module={searchParams?.module}
        action={searchParams?.action}
        q={searchParams?.q}
        from={searchParams?.from}
        to={searchParams?.to}
        back={searchParams?.back}
        backLabel={searchParams?.backLabel}
      />

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
