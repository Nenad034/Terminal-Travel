'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

export interface TimelineEntry {
  timestamp: string;
  action: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  actorName: string;
  context?: Record<string, unknown>;
}

// Dopuna (23.8.2026, na zahtev vlasnika: "u listi rezervacija pre naziva statusa stavite ikonu...
// klikom na tu ikonu treba da se otvori modul u kom ce se videti čitav workflow te rezervacije od
// pocetka do trenutka kada se gleda status sa datumima, vremenima i ko je radio promenu") —
// hronološki prikaz M1 `AuditLogEntry` zapisa (M5 spec §11 — "promene statusa se čuvaju kroz
// postojeći audit log, ne posebnu tabelu"), poziva GET /sales/bookings/:id/history preko BFF.
// `mockEntries` grana (ispod) postoji ISKLJUČIVO za `rezervacije/lista` mock ekran (23.8.2026,
// isti dan) — taj ekran nema stvarne ID-jeve iz baze, pa prava rezervacija za koju bi se pozvao
// stvaran endpoint ne postoji; jasno obeleženo "MOCK" u naslovu da ne zavara.
export default function BookingTimelineModal({
  bookingId,
  mockEntries,
  onClose,
}: {
  bookingId?: string;
  mockEntries?: TimelineEntry[];
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(mockEntries ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mockEntries) return;
    if (!bookingId) return;
    let cancelled = false;
    fetch(`/api/rezervacije/${bookingId}/istorija`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: TimelineEntry[]) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError('Istorija rezervacije nije dostupna.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, mockEntries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-panel2 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="three-bars" className="text-accent" />
            Tok rezervacije {mockEntries && <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[11px] font-normal text-warn">MOCK</span>}
          </div>
          <button onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-4 py-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          {!error && entries === null && <p className="text-sm text-ink-faint">Učitavam...</p>}
          {!error && entries && entries.length === 0 && <p className="text-sm text-ink-faint">Nema zabeleženih izmena za ovu rezervaciju.</p>}
          {!error && entries && entries.length > 0 && (
            <ol className="relative border-l border-border pl-4">
              {entries.map((e, i) => (
                <li key={i} className="mb-4 last:mb-0">
                  <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                  <div className="text-xs text-ink-faint">
                    {new Date(e.timestamp).toLocaleDateString('sr-RS')} {new Date(e.timestamp).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm font-medium text-ink">{e.action}</div>
                  <div className="text-xs text-ink-dim">
                    {e.actorType === 'AI_AGENT' ? <Icon name="sparkle" className="mr-1 text-accent" /> : null}
                    {e.actorName}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
