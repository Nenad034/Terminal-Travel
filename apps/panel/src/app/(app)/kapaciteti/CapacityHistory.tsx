'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import type { CapacityHistoryEntry } from '@/app/api/capacity/history/route';

// M17 spec §4b.9 / M3 §2.8g — „ko je, kada i šta promenio", na samom ekranu Kapaciteti.
//
// Nova tabela ne postoji: sve radnje nad kapacitetom već upisuju `AuditLogEntry` sa akterom i
// vremenom, ovde se samo čitaju. Ide kroz `M3/capacity/VIEW`, ne kroz audit log endpoint koji
// traži `M1/audit-log/VIEW` — inače bi istorija bila skrivena baš od ljudi koji taj posao rade
// (vlasnikova odluka 9.9.2026).

const AKCIJE: Record<string, { naslov: string; ikona: string; klasa: string }> = {
  'capacity.sale_stopped': {
    naslov: 'Zatvorio prodaju',
    ikona: 'circle-slash',
    klasa: 'text-danger',
  },
  'capacity.sale_reopened': { naslov: 'Ponovo otvorio prodaju', ikona: 'check', klasa: 'text-ok' },
  'capacity.day_override_set': { naslov: 'Promenio kapacitet', ikona: 'edit', klasa: 'text-ink' },
  'capacity_block.created': { naslov: 'Blokirao za grupu', ikona: 'lock', klasa: 'text-warn' },
  'capacity_block.released': { naslov: 'Oslobodio blokadu', ikona: 'unlock', klasa: 'text-ok' },
  'capacity_block.converted': {
    naslov: 'Blokadu pretvorio u rezervaciju',
    ikona: 'arrow-right',
    klasa: 'text-ok',
  },
  'capacity_block.auto_released': {
    naslov: 'Blokada sama istekla',
    ikona: 'history',
    klasa: 'text-ink-faint',
  },
};

/** §2.8g pravilo 2 — rečenica, ne naziv akcije. Podaci već stoje u `afterState`/`context`. */
function detalj(e: CapacityHistoryEntry): string | null {
  const a = (e.afterState ?? {}) as Record<string, unknown>;
  const c = (e.context ?? {}) as Record<string, unknown>;
  const delovi: string[] = [];

  if (e.action === 'capacity.day_override_set' && 'capacity' in a) {
    delovi.push(a.capacity === null ? 'vraćen na ugovoreni' : `na ${String(a.capacity)}`);
  }
  if (typeof a.from === 'string' && typeof a.to === 'string') {
    delovi.push(a.from === a.to ? `za ${a.from}` : `za ${a.from} — ${a.to}`);
  } else if (typeof a.dateFrom === 'string' && typeof a.dateTo === 'string') {
    delovi.push(a.dateFrom === a.dateTo ? `za ${a.dateFrom}` : `za ${a.dateFrom} — ${a.dateTo}`);
  }
  if (typeof a.units === 'number') delovi.push(`${a.units} jedinica`);
  if (typeof a.touched === 'number') delovi.push(`${a.touched} dnevnih zapisa`);
  if (typeof c.reason === 'string' && c.reason) delovi.push(`razlog: ${c.reason}`);
  else if (typeof a.reason === 'string' && a.reason) delovi.push(`razlog: ${a.reason}`);

  // Multiselect (§2.8a v1.23) — kad je jedan potez pogodio više tipova soba, to se MORA videti,
  // inače red izgleda kao izmena nad jednom sobom.
  const roomTypes = Array.isArray(c.roomTypes) ? (c.roomTypes as string[]) : null;
  if (roomTypes && roomTypes.length > 1) delovi.push(`tipovi soba: ${roomTypes.join(', ')}`);

  return delovi.length > 0 ? delovi.join(' · ') : null;
}

function vreme(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CapacityHistory({
  contractId,
  contractPeriodId,
}: {
  contractId: string;
  /** Kad je zadat, istorija je sužena na taj tip sobe; inače pokriva ceo objekat. */
  contractPeriodId?: string;
}) {
  const [entries, setEntries] = useState<CapacityHistoryEntry[] | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [samoOvajTip, setSamoOvajTip] = useState(false);

  useEffect(() => {
    let otkazano = false;
    setEntries(null);
    setGreska(null);
    const qs = new URLSearchParams({ limit: '50' });
    if (samoOvajTip && contractPeriodId) qs.set('contractPeriodId', contractPeriodId);
    else qs.set('contractId', contractId);

    fetch(`/api/capacity/history?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as CapacityHistoryEntry[];
      })
      .then((d) => {
        if (!otkazano) setEntries(d);
      })
      .catch(() => {
        if (!otkazano) setGreska('Istorija trenutno nije dostupna.');
      });
    return () => {
      otkazano = true;
    };
  }, [contractId, contractPeriodId, samoOvajTip]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Icon name="history" /> Istorija izmena
        </h3>
        {contractPeriodId && (
          <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <input
              type="checkbox"
              checked={samoOvajTip}
              onChange={(e) => setSamoOvajTip(e.target.checked)}
            />
            samo ovaj tip sobe
          </label>
        )}
      </div>

      {greska && <p className="text-[11px] text-danger">{greska}</p>}
      {!greska && entries === null && <p className="text-[11px] text-ink-faint">Učitavam…</p>}
      {/* §4b.9 — prazna istorija se ispisuje rečenicom, ne praznim prostorom (zamka 7.2). */}
      {!greska && entries !== null && entries.length === 0 && (
        <p className="text-[11px] text-ink-faint">Za ovaj izbor nema zabeleženih izmena.</p>
      )}

      {entries && entries.length > 0 && (
        <ol className="flex flex-col gap-2">
          {entries.map((e) => {
            const def = AKCIJE[e.action] ?? {
              naslov: e.action,
              ikona: 'circle-outline',
              klasa: 'text-ink-dim',
            };
            const d = detalj(e);
            return (
              <li key={e.id} className="flex gap-2 border-b border-border pb-2 last:border-b-0">
                <span className={`mt-0.5 flex-shrink-0 ${def.klasa}`}>
                  <Icon name={def.ikona} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] text-ink">
                    <span className="font-medium">{e.actorName}</span> — {def.naslov}
                  </div>
                  {d && <div className="text-[11px] text-ink-faint">{d}</div>}
                  <div className="font-mono text-[10px] text-ink-faint">{vreme(e.timestamp)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
