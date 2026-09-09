'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import { sacuvajPravilo, ukloniPravilo } from './actions';

// M3 spec §2.11i, M17 §6d.1 — marža i subagentska provizija po pojedinačnoj stavci.
//
// Popunjava se SAMO ono što odstupa od podrazumevanog za ugovor. Zato red bez unosa nema
// nijedan broj — prazno znači „kao ugovor", a ne nula. Kad bi se prikazivala nasleđena
// vrednost, izuzetak se ne bi razlikovao od običnog reda.
//
// Osnovica provizije je PRODAJNA (bruto) cena — vlasnikova odluka 9.9.2026.

export interface PravilioRed {
  target: 'RATE_LINE' | 'ANCILLARY';
  targetId: string;
  naziv: string;
  vrsta: string | null;
  osnovnaCena: number | null;
  markupPercentage: number | null;
  markupFixedAmount: number | null;
  noCommission: boolean;
  commissionPercentage: number | null;
  commissionFixedAmount: number | null;
  jeIzuzetak: boolean;
}

export default function PricingRulesPanel({
  contractId,
  pravila,
  currency,
  podrazumevanaMarza,
  canEdit,
}: {
  contractId: string;
  pravila: PravilioRed[];
  currency: string;
  podrazumevanaMarza: string | null;
  canEdit: boolean;
}) {
  const izuzetaka = pravila.filter((p) => p.jeIzuzetak).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-sunken p-3 text-[11px] text-ink-faint">
        Popunjava se <strong className="text-ink">samo ono što odstupa</strong> od podrazumevanog za
        ovaj ugovor. Prazan red znači „kao ugovor&rdquo; — ne mora se dirati.
        {podrazumevanaMarza && (
          <>
            {' '}
            Podrazumevano: <strong className="text-ink">{podrazumevanaMarza}</strong>.
          </>
        )}{' '}
        Provizija subagenta se računa od <strong className="text-ink">prodajne (bruto) cene</strong>
        , po vašoj odluci od 9.9.2026.
        {izuzetaka > 0 && (
          <>
            {' '}
            Trenutno {izuzetaka} {izuzetaka === 1 ? 'izuzetak' : 'izuzetaka'}.
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead>
            <tr>
              {['Stavka', 'Osnovna cena', 'Marža %', 'Marža iznos', 'Provizija', ''].map((h) => (
                <th
                  key={h}
                  className="border-b border-border bg-sunken px-3 py-2 text-left text-[11px] font-semibold text-ink"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pravila.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-faint">
                  Nema nijedne cenovne stavke ni doplate. Unesite ih na prethodne dve kartice.
                </td>
              </tr>
            )}
            {pravila.map((p) => (
              <Red
                key={`${p.target}:${p.targetId}`}
                contractId={contractId}
                p={p}
                currency={currency}
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Red({
  contractId,
  p,
  currency,
  canEdit,
}: {
  contractId: string;
  p: PravilioRed;
  currency: string;
  canEdit: boolean;
}) {
  const [uredjuje, setUredjuje] = useState(false);
  const [radi, start] = useTransition();
  const [greska, setGreska] = useState<string | null>(null);

  const [f, setF] = useState({
    markupPercentage: p.markupPercentage != null ? String(p.markupPercentage) : '',
    markupFixedAmount: p.markupFixedAmount != null ? izNajmanjeJedinice(p.markupFixedAmount) : '',
    noCommission: p.noCommission ? 'true' : 'false',
    commissionPercentage: p.commissionPercentage != null ? String(p.commissionPercentage) : '',
    commissionFixedAmount:
      p.commissionFixedAmount != null ? izNajmanjeJedinice(p.commissionFixedAmount) : '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <tr className={p.jeIzuzetak ? 'bg-accent-soft/30' : undefined}>
      <td className="border-b border-border px-3 py-1.5">
        <span className="text-ink">{p.naziv}</span>
        {p.vrsta && (
          <Badge variant="outline" className="ml-1.5">
            {p.vrsta}
          </Badge>
        )}
        {p.jeIzuzetak && (
          <Badge variant="warn" className="ml-1.5">
            izuzetak
          </Badge>
        )}
        {greska && <div className="text-[10px] text-danger">{greska}</div>}
      </td>

      <td className="border-b border-border px-3 py-1.5 font-mono text-ink-faint">
        {p.osnovnaCena != null ? `${izNajmanjeJedinice(p.osnovnaCena)} ${currency}` : '—'}
      </td>

      {uredjuje ? (
        <>
          <td className="border-b border-border px-2 py-1">
            <input
              value={f.markupPercentage}
              onChange={set('markupPercentage')}
              placeholder="18"
              className="input w-[64px] text-center font-mono text-xs"
            />
          </td>
          <td className="border-b border-border px-2 py-1">
            <input
              value={f.markupFixedAmount}
              onChange={set('markupFixedAmount')}
              placeholder="5,00"
              className="input w-[74px] text-center font-mono text-xs"
            />
          </td>
          <td className="border-b border-border px-2 py-1">
            <div className="flex flex-wrap items-center gap-1">
              <select
                value={f.noCommission}
                onChange={set('noCommission')}
                className="input text-[11px]"
              >
                <option value="false">provizija</option>
                <option value="true">bez provizije</option>
              </select>
              {f.noCommission === 'false' && (
                <>
                  <input
                    value={f.commissionPercentage}
                    onChange={set('commissionPercentage')}
                    placeholder="8"
                    className="input w-[54px] text-center font-mono text-xs"
                  />
                  <span className="text-[10px] text-ink-faint">%</span>
                  <input
                    value={f.commissionFixedAmount}
                    onChange={set('commissionFixedAmount')}
                    placeholder="0,00"
                    className="input w-[68px] text-center font-mono text-xs"
                  />
                </>
              )}
            </div>
          </td>
          <td className="border-b border-border px-2 py-1 text-right">
            <span className="flex justify-end gap-1">
              <Button
                size="sm"
                disabled={radi}
                onClick={() =>
                  start(async () => {
                    setGreska(null);
                    const r = await sacuvajPravilo(contractId, {
                      target: p.target,
                      targetId: p.targetId,
                      ...f,
                    });
                    if (r.error) setGreska(r.error);
                    else setUredjuje(false);
                  })
                }
              >
                {radi ? '…' : 'sačuvaj'}
              </Button>
              <button
                type="button"
                onClick={() => setUredjuje(false)}
                className="text-[11px] text-ink-faint"
              >
                ✕
              </button>
            </span>
          </td>
        </>
      ) : (
        <>
          <td className="border-b border-border px-3 py-1.5 font-mono">
            {p.markupPercentage != null ? `${p.markupPercentage} %` : <Nasledjeno />}
          </td>
          <td className="border-b border-border px-3 py-1.5 font-mono">
            {p.markupFixedAmount != null ? (
              `${izNajmanjeJedinice(p.markupFixedAmount)} ${currency}`
            ) : (
              <Nasledjeno />
            )}
          </td>
          <td className="border-b border-border px-3 py-1.5">
            {p.noCommission ? (
              <Badge variant="danger">bez provizije</Badge>
            ) : p.commissionPercentage != null || p.commissionFixedAmount != null ? (
              <span className="font-mono">
                {p.commissionPercentage != null ? `${p.commissionPercentage} %` : ''}
                {p.commissionFixedAmount != null
                  ? ` + ${izNajmanjeJedinice(p.commissionFixedAmount)} ${currency}`
                  : ''}
              </span>
            ) : (
              <Nasledjeno />
            )}
          </td>
          <td className="border-b border-border px-3 py-1.5 text-right">
            {canEdit && (
              <span className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUredjuje(true)}
                  className="text-[11px] text-accent-strong hover:underline"
                >
                  {p.jeIzuzetak ? 'izmeni' : 'napravi izuzetak'}
                </button>
                {p.jeIzuzetak && (
                  <button
                    type="button"
                    disabled={radi}
                    onClick={() =>
                      start(async () => {
                        const r = await ukloniPravilo(contractId, p.target, p.targetId);
                        if (r.error) setGreska(r.error);
                      })
                    }
                    className="text-[11px] text-ink-faint hover:text-danger"
                    title="Stavka se vraća na podrazumevano pravilo ugovora"
                  >
                    vrati na ugovor
                  </button>
                )}
              </span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

/** Prazno polje znači „kao ugovor", ne nula — razlika koja se lako previdi. */
function Nasledjeno() {
  return <span className="text-[11px] text-ink-faint">kao ugovor</span>;
}
