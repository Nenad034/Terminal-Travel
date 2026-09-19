'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { BUCKET_LABEL, type HistogramBar, type HistogramBucket } from '@/lib/table-filters';
import type { TableColumn } from '@/lib/table-spec';

// M17 spec §6e.3 K1 (19.9.2026, uzor Kibana Discover) — broj redova po datumskoj korpi iznad
// tabele. Jedna serija → jedna boja (`--accent`), bez legende; tekst u `ink` tokenima, ne u boji
// serije (dataviz pravila). Prevlačenje preko korpi ili klik na jednu → `onRange(from, to)`, što
// roditelj pretvara u trakicu opsega (K2). Čist HTML/CSS, bez biblioteke za grafikone — 60-ak
// stubića ne opravdava zavisnost (tt-tech-stack: ništa novo bez potrebe).

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}

function barTitle(b: HistogramBar, bucket: HistogramBucket): string {
  const range = b.from === b.to ? fmtDay(b.from) : `${fmtDay(b.from)} – ${fmtDay(b.to)}`;
  const n = b.count === 1 ? '1 red' : `${b.count} redova`;
  return `${range}: ${n}${bucket === 'day' ? '' : ` (${BUCKET_LABEL[bucket]})`}`;
}

export default function TableHistogram({
  hist,
  columns,
  column,
  onColumn,
  onHide,
  onRange,
}: {
  hist: { bucket: HistogramBucket; bars: HistogramBar[] } | null;
  columns: TableColumn[];
  column: string;
  onColumn: (key: string) => void;
  onHide: () => void;
  onRange: (from: string, to: string) => void;
}) {
  // prevlačenje: indeks prve i tekuće korpe; završava se na mouseup (i van stubića)
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const bars = hist?.bars ?? [];
  const max = bars.reduce((m, b) => Math.max(m, b.count), 0);
  const sel = drag ? [Math.min(drag.start, drag.end), Math.max(drag.start, drag.end)] : null;

  function finish() {
    if (!drag || bars.length === 0) return;
    const [a, b] = [Math.min(drag.start, drag.end), Math.max(drag.start, drag.end)];
    onRange(bars[a].from, bars[b].to);
    setDrag(null);
  }

  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
        <span>Redova</span>
        <select
          className="input h-6 w-auto !py-0 text-[11px]"
          value={column}
          onChange={(e) => onColumn(e.target.value)}
          title="Datumska kolona histograma"
        >
          {columns.map((c) => (
            <option key={c.key} value={c.key}>
              po: {c.label}
            </option>
          ))}
        </select>
        {hist && <span>{BUCKET_LABEL[hist.bucket]}</span>}
        {sel && bars[sel[0]] && bars[sel[1]] && (
          <span className="text-ink">
            {fmtDay(bars[sel[0]].from)} – {fmtDay(bars[sel[1]].to)}
          </span>
        )}
        {!sel && bars.length > 0 && (
          <span className="hidden sm:inline">
            prevucite preko stubića ili kliknite na jedan da suzite tabelu
          </span>
        )}
        <button
          type="button"
          className="ml-auto flex items-center gap-1 hover:text-ink"
          onClick={onHide}
          title="Sakrij histogram"
        >
          <Icon name="chevron-up" /> sakrij
        </button>
      </div>
      {bars.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-ink-faint">
          Nema datuma u ovoj koloni za prikazane redove.
        </p>
      ) : (
        <div
          ref={wrapRef}
          className="flex h-16 select-none items-end gap-[2px]"
          onMouseLeave={() => drag && finish()}
          onMouseUp={finish}
          role="img"
          aria-label={`Histogram broja redova ${BUCKET_LABEL[hist!.bucket]}, ${bars.length} korpi`}
        >
          {bars.map((b, i) => {
            const h = max > 0 ? Math.max(b.count > 0 ? 3 : 1, (b.count / max) * 56) : 1;
            const inSel = sel ? i >= sel[0] && i <= sel[1] : false;
            return (
              <div
                key={b.from}
                className="group/bar flex h-full max-w-16 flex-1 cursor-pointer items-end"
                title={barTitle(b, hist!.bucket)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDrag({ start: i, end: i });
                }}
                onMouseEnter={() => drag && setDrag((d) => (d ? { ...d, end: i } : d))}
              >
                <div
                  className={`w-full rounded-t-[3px] transition-colors ${
                    b.count === 0
                      ? 'bg-border opacity-40'
                      : inSel
                        ? 'bg-accent-strong'
                        : 'bg-accent group-hover/bar:bg-accent-strong'
                  }`}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>
      )}
      {bars.length > 0 && (
        <div className="mt-0.5 flex justify-between text-[10px] text-ink-faint">
          <span>{fmtDay(bars[0].from)}</span>
          <span>{fmtDay(bars[bars.length - 1].to)}</span>
        </div>
      )}
    </div>
  );
}
