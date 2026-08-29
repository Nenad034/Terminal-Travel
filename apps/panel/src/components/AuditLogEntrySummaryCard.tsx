'use client';

import ActorLabel from './ActorLabel';
import type { AuditLogEntrySummary } from './RowSummaryContext';

function actorWord(actorType: string): string {
  if (actorType === 'HUMAN') return 'korisnik';
  if (actorType === 'AI_AGENT') return 'AI agent';
  if (actorType === 'SYSTEM') return 'sistem';
  return 'nepoznat akter';
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  const text = JSON.stringify(value, null, 2);
  if (text === '{}' || text === 'null') return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-ink-faint">{label}</div>
      <pre className="overflow-x-auto rounded border border-border bg-panel2 p-2 text-[11px] text-ink-dim">{text}</pre>
    </div>
  );
}

// M1 spec §7 dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu stavku iz ovakvih
// lista da se otvori desni panel sa detaljnim informacijama") — pun zapis jednog audit log reda,
// isti "klik pokazuje detalj ovde" mehanizam kao ProcessMapNodeSummaryCard/BookingSummary.
// `before_state`/`after_state`/`context` prikazani kao sirov JSON — tehnički zapis, isti princip
// kao monospace za ID-jeve na samom audit log ekranu (§3 dizajn dok.).
export default function AuditLogEntrySummaryCard({ summary: e }: { summary: AuditLogEntrySummary }) {
  return (
    <div className="flex-1 overflow-y-auto p-3 text-xs">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">{new Date(e.timestamp).toLocaleString('sr-RS')}</div>
      <div className="mb-3 font-mono font-semibold text-ink">{e.action}</div>

      <div className="mb-3 flex flex-col gap-0.5 rounded-lg border border-border bg-panel p-2">
        <SummaryRow label="Modul" value={e.module} />
        <SummaryRow label="Resurs" value={`${e.resourceType}#${e.resourceId}`} />
        <SummaryRow label="IP adresa" value={e.ipAddress ?? '—'} />
      </div>

      <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border bg-panel p-2">
        <ActorLabel origin={e.actorType} name={actorWord(e.actorType)} className="text-ink-faint" />
        <span className="font-mono text-ink-faint">#{e.actorId ?? '—'}</span>
      </div>

      <JsonBlock label="Pre izmene" value={e.beforeState} />
      <JsonBlock label="Posle izmene" value={e.afterState} />
      <JsonBlock label="Kontekst" value={e.context} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right font-mono text-ink-dim">{value}</span>
    </div>
  );
}
