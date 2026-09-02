'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';

export interface CommunicationEntry {
  id: string;
  channel: string;
  direction: string;
  category: string;
  summary: string;
  draftedByAi: boolean;
  sentBy?: string | null;
  createdAt: string;
}

// M5 spec §4.5 dopuna (2.9.2026, na zahtev vlasnika: "napraviti filter Komunikacija samo za
// ovu rezervaciju, ali neku ikonu stavite i overlay tekst kao objašnjenje") — `CommunicationLog`
// (M6 §4.1) i dalje nema `booking_id` (poznato ograničenje, isto kao pre ove dopune), pa se
// "samo ova rezervacija" ne može sprovesti kao pravi upit — filter je TEKSTUALNO poklapanje broja
// rezervacije u `summary` (isti obrazac "podatak kao tekst" koji već koristi M5 §6.1b podsetnik o
// roku opcije). Info ikonica objašnjava tačno ovo, da prekidač ne izgleda precizniji nego što jeste.
export default function CommunicationFilterList({
  communications,
  bookingNumber,
  directoryNames,
}: {
  communications: CommunicationEntry[];
  bookingNumber: string;
  directoryNames: Record<string, string>;
}) {
  const [onlyThisBooking, setOnlyThisBooking] = useState(false);
  const matching = communications.filter((c) => c.summary.includes(bookingNumber));
  const shown = onlyThisBooking ? matching : communications;

  return (
    <div className="space-y-3">
      <label className="flex w-fit items-center gap-1.5 text-xs text-ink-dim">
        <input type="checkbox" checked={onlyThisBooking} onChange={(e) => setOnlyThisBooking(e.target.checked)} />
        Prikaži samo poruke o ovoj rezervaciji ({matching.length})
        <span
          title={`Prepiska nije povezana sa rezervacijom kao poseban podatak (M6 CommunicationLog nema booking_id) — ovaj filter samo traži broj rezervacije "${bookingNumber}" u tekstu poruke, ne garantovano tačno kao prava veza.`}
          className="cursor-help text-ink-faint"
        >
          <Icon name="info" />
        </span>
      </label>

      {shown.length === 0 ? (
        <p className="text-xs text-ink-faint">{onlyThisBooking ? 'Nijedna poruka ne pominje broj ove rezervacije u tekstu.' : 'Nema zabeležene komunikacije sa ovim nalogodavcem.'}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-panel p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                <Badge label={c.channel} />
                <Badge label={c.direction} />
                <Badge label={c.category} />
                <ActorLabel
                  name={c.sentBy ? (directoryNames[c.sentBy] ?? (c.sentBy === 'SYSTEM_AUTO' ? 'automatski' : null)) : null}
                  origin={c.sentBy === 'SYSTEM_AUTO' ? 'SYSTEM' : 'STAFF'}
                  draftedByAi={c.draftedByAi}
                />
                <span>· {new Date(c.createdAt).toLocaleString('sr-RS')}</span>
              </div>
              <p className="text-sm text-ink">{c.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink-faint">{label}</span>;
}
