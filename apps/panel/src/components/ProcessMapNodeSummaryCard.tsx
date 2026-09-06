'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';
import ActorLabel from './ActorLabel';
import type { ProcessMapNodeSummary } from './RowSummaryContext';

interface AuditLogEntry {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
}

const RECENT_LIMIT = 5;

function actorWord(actorType: string): string {
  if (actorType === 'HUMAN') return 'korisnik';
  if (actorType === 'AI_AGENT') return 'AI agent';
  if (actorType === 'SYSTEM') return 'sistem';
  return 'nepoznat akter';
}

// M18 spec §9a dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu od stavki u
// procesnim mapama u desnom panelu treba da se prikaze vise detalja") — klik na čvor
// (ProcessMapView.tsx) puni RowSummaryContext umesto direktne navigacije; ovaj kartica prikazuje
// broj/vreme (već poznato sa same mape) PLUS nekoliko poslednjih zapisa (novo, "više detalja"),
// preuzeto uživo preko /api/iam/audit-log (M1 spec §6).
export default function ProcessMapNodeSummaryCard({ summary }: { summary: ProcessMapNodeSummary }) {
  const { openTab } = useTabs();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lista zavisnosti sme da sadrži samo vrednosti, ne izraze — `matchActions.join(',')` je zato
  // izračunat ovde (6.9.2026, ESLint `react-hooks/exhaustive-deps`). Sadržajno je isto, ali je
  // sada alat u stanju da proveri da li lista odgovara onome što efekat stvarno koristi.
  const akcijeKljuc = summary.matchActions.join(',');

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    // Straničenje audit loga (6.9.2026) — traži se tačno onoliko redova koliko se prikazuje,
    // umesto cele stranice od kojih se koristi prvih nekoliko.
    const qs = new URLSearchParams({ module: summary.module, action: akcijeKljuc, limit: String(RECENT_LIMIT) });
    fetch(`/api/iam/audit-log?${qs.toString()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Greška pri učitavanju');
        return res.json();
      })
      .then((odgovor: { data: AuditLogEntry[] }) => {
        if (!cancelled) setEntries(odgovor.data);
      })
      .catch(() => {
        if (!cancelled) setError('Poslednji zapisi nisu učitani.');
      });
    return () => {
      cancelled = true;
    };
  }, [summary.module, akcijeKljuc]);

  function openFullAuditLog() {
    const qs = new URLSearchParams({
      module: summary.module,
      action: summary.matchActions.join(','),
      back: `/nadzor/procesne-mape/${summary.mapKey}`,
      backLabel: summary.mapLabel,
    });
    openTab(`/audit-log?${qs.toString()}`, `Audit log — ${summary.nodeLabel}`);
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 text-xs">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">{summary.mapLabel}</div>
      <div className="mb-3 font-mono font-semibold text-ink">{summary.nodeLabel}</div>

      <div className="mb-3 flex flex-col gap-0.5 rounded-lg border border-border bg-panel p-2">
        <SummaryRow label="Broj (poslednjih 24h)" value={String(summary.count)} strong />
        <SummaryRow
          label="Poslednji u tom prozoru"
          value={summary.lastAt ? new Date(summary.lastAt).toLocaleString('sr-RS') : 'nema u poslednjih 24h'}
        />
        <SummaryRow label="Prati akcije" value={summary.matchActions.join(', ')} />
      </div>

      <button
        onClick={openFullAuditLog}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
      >
        <Icon name="link-external" /> Otvori pun audit log
      </button>

      {/* Namerno BEZ vremenskog ograničenja (za razliku od broja iznad, koji prati isti prozor
          kao mapa) — svrha ove liste je "šta se poslednje desilo", ne "šta se desilo u
          poslednja 24h"; kad prozor iznad pokaže 0 a lista ipak ima zapise, to je očekivano
          (poslednji zapis je stariji od 24h), ne greška. */}
      <div className="mb-1 text-ink-faint">Poslednjih {RECENT_LIMIT} zapisa (bez obzira na prozor iznad)</div>
      {error && <p className="text-danger">{error}</p>}
      {!error && entries === null && <p className="text-ink-faint">Učitavanje…</p>}
      {!error && entries?.length === 0 && <p className="text-ink-faint">Nema zapisa u ovom prozoru.</p>}
      {!error && entries && entries.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <li key={e.id} className="rounded border border-border bg-panel p-2 font-mono text-[11px]">
              <div className="text-ink-faint">{new Date(e.timestamp).toLocaleString('sr-RS')}</div>
              <div className="text-ink">
                {e.resourceType}#{e.resourceId?.slice(0, 8)}
              </div>
              <ActorLabel origin={e.actorType} name={actorWord(e.actorType)} className="text-ink-faint" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-ink-faint">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-ink' : 'text-ink-dim'}`}>{value}</span>
    </div>
  );
}
