'use client';

import { useRowSummary } from '@/components/RowSummaryContext';
import ActorLabel from '@/components/ActorLabel';

export interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  actorType: string;
  actorId: string | null;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  timestamp: string;
  beforeState?: unknown;
  afterState?: unknown;
  context?: unknown;
}

function actorWord(actorType: string): string {
  if (actorType === 'HUMAN') return 'korisnik';
  if (actorType === 'AI_AGENT') return 'AI agent';
  if (actorType === 'SYSTEM') return 'sistem';
  return 'nepoznat akter';
}

// M1 spec §7 dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu stavku iz ovakvih
// lista da se otvori desni panel sa detaljnim informacijama") — klik na red puni RowSummary
// (RightPanel.tsx → AuditLogEntrySummaryCard), isti mehanizam kao ProcessMapView.tsx za čvorove
// mape. Izdvojeno iz page.tsx u poseban klijentski komponent jer server komponenta ne može da
// prati `onClick`/kontekst.
export default function AuditLogRows({ entries }: { entries: AuditLogEntry[] }) {
  const { showSummary } = useRowSummary();

  return (
    <>
      {entries.map((e) => (
        // `id` (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka stavkama na koje
        // obavestava") — dashboard "M1 — bezbednosna upozorenja" i dalje linkuje TAČNO na red
        // preko `/audit-log#audit-{id}`, nepromenjeno ovom dopunom.
        <button
          key={e.id}
          id={`audit-${e.id}`}
          type="button"
          onClick={() => showSummary({ kind: 'audit-log-entry', ...e })}
          className="block w-full border-b border-border bg-panel px-4 py-2 text-left font-mono text-xs last:border-b-0 hover:bg-panel-2"
        >
          <span className="text-ink-faint">{new Date(e.timestamp).toLocaleString('sr-RS')}</span>{' '}
          <span className="text-accent2">{e.module}</span> <span className="text-ink">{e.action}</span>{' '}
          <span className="text-ink-dim">
            {e.resourceType}#{e.resourceId?.slice(0, 8)}
          </span>{' '}
          <ActorLabel origin={e.actorType} name={actorWord(e.actorType)} className="text-ink-faint" />{' '}
          <span className="text-ink-faint">#{e.actorId?.slice(0, 8) ?? '—'}</span>
        </button>
      ))}
    </>
  );
}
