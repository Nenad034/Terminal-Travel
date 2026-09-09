'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';
import { obrisiSezonu, sacuvajSezonu } from './actions';

// M3 spec §2.11b — sezona je kolona cenovnika i ima VIŠE datumskih opsega.
//
// Jedan opseg po sezoni bio bi lakši za napraviti, ali pogrešan: u stvarnim cenovnicima jedna
// sezona pokriva dva odvojena dela godine (Aycon 2026, sezona 1 = april–maj I oktobar). Sa
// jednim opsegom to bi bile dve kolone sa istom cenom, pa bi svaka izmena išla na dva mesta.

export interface Sezona {
  id: string;
  code: string;
  label: string | null;
  rank: number;
  ranges: { dateFrom: string; dateTo: string }[];
}

export default function SeasonsBar({
  contractId,
  seasons,
  canEdit,
}: {
  contractId: string;
  seasons: Sezona[];
  canEdit: boolean;
}) {
  const [uredjuje, setUredjuje] = useState<string | 'nova' | null>(null);

  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Sezone{' '}
          <span className="text-[11px] font-normal text-ink-faint">
            — kolone cenovnika, definišu se jednom i važe za sve tipove soba
          </span>
        </h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {seasons.map((s) =>
          uredjuje === s.id ? (
            <Forma key={s.id} contractId={contractId} sezona={s} onKraj={() => setUredjuje(null)} />
          ) : (
            <Kartica
              key={s.id}
              contractId={contractId}
              sezona={s}
              canEdit={canEdit}
              onUredi={() => setUredjuje(s.id)}
            />
          ),
        )}

        {uredjuje === 'nova' ? (
          <Forma contractId={contractId} sezona={null} onKraj={() => setUredjuje(null)} />
        ) : (
          canEdit && (
            <button
              type="button"
              onClick={() => setUredjuje('nova')}
              className="flex min-w-[132px] items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-ink-faint hover:border-accent hover:text-accent-strong"
            >
              <Icon name="add" /> nova sezona
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Kartica({
  contractId,
  sezona,
  canEdit,
  onUredi,
}: {
  contractId: string;
  sezona: Sezona;
  canEdit: boolean;
  onUredi: () => void;
}) {
  const [radi, start] = useTransition();
  const [greska, setGreska] = useState<string | null>(null);

  return (
    <div className="min-w-[150px] rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-ink">
          {sezona.code}
          {sezona.label && <span className="ml-1 font-normal text-ink-faint">{sezona.label}</span>}
        </span>
        {canEdit && (
          <span className="flex gap-1">
            <button
              type="button"
              onClick={onUredi}
              className="text-[10px] text-ink-faint hover:text-accent-strong"
            >
              uredi
            </button>
            <button
              type="button"
              disabled={radi}
              onClick={() =>
                start(async () => {
                  const r = await obrisiSezonu(contractId, sezona.id);
                  if (r.error) setGreska(r.error);
                })
              }
              className="text-[10px] text-ink-faint hover:text-danger"
            >
              obriši
            </button>
          </span>
        )}
      </div>
      {sezona.ranges.map((r, i) => (
        <div key={i} className="font-mono text-[11px] text-ink-dim">
          {kratko(r.dateFrom)} – {kratko(r.dateTo)}
        </div>
      ))}
      {greska && <p className="mt-1 text-[10px] text-danger">{greska}</p>}
    </div>
  );
}

function Forma({
  contractId,
  sezona,
  onKraj,
}: {
  contractId: string;
  sezona: Sezona | null;
  onKraj: () => void;
}) {
  const [code, setCode] = useState(sezona?.code ?? '');
  const [label, setLabel] = useState(sezona?.label ?? '');
  const [opsezi, setOpsezi] = useState<{ dateFrom: string; dateTo: string }[]>(
    sezona?.ranges.length ? sezona.ranges : [{ dateFrom: '', dateTo: '' }],
  );
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, start] = useTransition();

  return (
    <div className="min-w-[280px] rounded-lg border border-accent bg-surface p-3">
      <div className="mb-2 flex gap-2">
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-ink-faint">
          Oznaka
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="1"
            className="input text-xs"
          />
        </label>
        <label className="flex flex-[2] flex-col gap-0.5 text-[10px] text-ink-faint">
          Ime (opciono)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Predsezona"
            className="input text-xs"
          />
        </label>
      </div>

      {opsezi.map((o, i) => (
        <div key={i} className="mb-1.5 flex items-end gap-1.5">
          <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-ink-faint">
            Od
            <DateField
              name={`from-${i}`}
              value={o.dateFrom}
              onChange={(v) => izmeni(setOpsezi, i, { dateFrom: v })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-ink-faint">
            Do
            <DateField
              name={`to-${i}`}
              value={o.dateTo}
              onChange={(v) => izmeni(setOpsezi, i, { dateTo: v })}
            />
          </label>
          {opsezi.length > 1 && (
            <button
              type="button"
              onClick={() => setOpsezi((p) => p.filter((_, j) => j !== i))}
              className="pb-2 text-[11px] text-ink-faint hover:text-danger"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOpsezi((p) => [...p, { dateFrom: '', dateTo: '' }])}
        className="mb-2 text-[10px] text-accent-strong hover:underline"
      >
        + još jedan opseg
      </button>

      {greska && (
        <p className="mb-2 rounded bg-danger-bg p-1.5 text-[10px] text-danger">{greska}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={radi}
          onClick={() =>
            start(async () => {
              setGreska(null);
              const ranges = opsezi.filter((o) => o.dateFrom && o.dateTo);
              if (ranges.length === 0) {
                setGreska('Sezona mora imati bar jedan potpun datumski opseg.');
                return;
              }
              const r = await sacuvajSezonu(contractId, sezona?.id ?? null, {
                code: code.trim(),
                label: label.trim() || undefined,
                ranges,
              });
              if (r.error) setGreska(r.error);
              else onKraj();
            })
          }
        >
          {radi ? 'Čuvam…' : 'Sačuvaj'}
        </Button>
        <button
          type="button"
          onClick={onKraj}
          className="text-[11px] text-ink-faint hover:underline"
        >
          odustani
        </button>
      </div>
    </div>
  );
}

function izmeni(
  set: React.Dispatch<React.SetStateAction<{ dateFrom: string; dateTo: string }[]>>,
  i: number,
  patch: Partial<{ dateFrom: string; dateTo: string }>,
) {
  set((p) => p.map((o, j) => (j === i ? { ...o, ...patch } : o)));
}

/** „01.04." — dovoljno da se kolona prepozna, bez godine koja se ponavlja u svakom redu. */
function kratko(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`;
}
