'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import { potvrdiVerziju } from './actions';

/**
 * M3 spec §2.11l, M17 §6d — verzije cenovnika.
 *
 * Ekran postoji zbog jedne vlasnikove rečenice: _„Moramo sve iz početka, menjamo ono što su oni
 * promenili. AI agent može da vidi šta je promenjeno pa samo to da koriguje."_ Zato gornji deo
 * ekrana nije ceo cenovnik nego **spisak razlika** prema poslednjoj potvrđenoj verziji: deset
 * izmena u cenovniku od dvesta redova su deset redova na ekranu, ne dvesta.
 *
 * Donji deo je istorija. Stara verzija se ne briše — rezervacija napravljena po njoj mora i
 * dalje da se objasni, a bez sačuvanog snimka to prestaje da bude moguće čim se cena promeni.
 */

export interface Razlika {
  kljuc: string;
  vrsta: 'IZMENJENA' | 'NOVA' | 'UGASENA';
  stavka: 'CENA' | 'DOPLATA';
  opis: string;
  poruka: string;
  staraVrednost: number | null;
  novaVrednost: number | null;
  izmenjenaPolja: { polje: string; staro: string | null; novo: string | null }[];
}

export interface Verzija {
  id: string;
  versionNo: number;
  effectiveFrom: string;
  changeCount: number;
  stavki: number;
  note: string | null;
  instructionText: string | null;
  sourceImportId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RazlikeOdgovor {
  poslednjaVerzija: number | null;
  sledecaVerzija: number;
  razlike: Razlika[];
  ukupno: number;
  stavkiUCenovniku: number;
}

const OZNAKA: Record<Razlika['vrsta'], { tekst: string; ton: string }> = {
  IZMENJENA: { tekst: 'izmenjeno', ton: 'bg-warn-bg text-warn' },
  NOVA: { tekst: 'novo', ton: 'bg-ok-bg text-ok' },
  UGASENA: { tekst: 'ugašeno', ton: 'bg-danger-bg text-danger' },
};

export default function VerzijePanel({
  contractId,
  verzije,
  razlike,
  currency,
  canEdit,
}: {
  contractId: string;
  verzije: Verzija[];
  razlike: RazlikeOdgovor;
  currency: string;
  canEdit: boolean;
}) {
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [napomena, setNapomena] = useState('');
  const [greska, setGreska] = useState<string | null>(null);
  const [cekaj, pokreni] = useTransition();

  function potvrdi() {
    setGreska(null);
    pokreni(async () => {
      const r = await potvrdiVerziju(contractId, {
        effectiveFrom: datum,
        note: napomena.trim() || undefined,
      });
      if (r.error) setGreska(r.error);
      else setNapomena('');
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── šta se promenilo od poslednje verzije */}
      <div className="rounded-lg border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <h2 className="text-xs font-semibold text-ink">
              {razlike.poslednjaVerzija == null
                ? 'Cenovnik još nema nijednu verziju'
                : `Šta se promenilo od verzije ${razlike.poslednjaVerzija}`}
            </h2>
            <p className="text-[11px] text-ink-faint">
              {razlike.ukupno === 0
                ? `Cenovnik je istovetan poslednjoj verziji — ${razlike.stavkiUCenovniku} stavki.`
                : `${razlike.ukupno} ${razlike.ukupno === 1 ? 'razlika' : 'razlika'} od ukupno ${razlike.stavkiUCenovniku} stavki u cenovniku.`}
            </p>
          </div>
          <Badge className="bg-sunken text-ink-faint">
            sledeća verzija {razlike.sledecaVerzija}
          </Badge>
        </div>

        {razlike.ukupno === 0 ? (
          // Prazan spisak ovde nije prazna baza nego dobra vest: nema nepotvrđenih izmena.
          <p className="px-3 py-6 text-center text-[11px] text-ink-faint">
            Nema nepotvrđenih izmena. Kad promenite cenu u kartici „Cene&ldquo;, razlika se
            pojavljuje ovde i potvrđujete samo nju — ne ceo cenovnik.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {razlike.razlike.map((r) => (
              <li key={r.kljuc} className="flex items-start gap-2 px-3 py-2">
                <Badge className={`${OZNAKA[r.vrsta].ton} shrink-0`}>{OZNAKA[r.vrsta].tekst}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink">{r.opis}</p>
                  <p className="text-[11px] text-ink-dim">
                    {r.vrsta === 'IZMENJENA' && r.staraVrednost !== r.novaVrednost && (
                      <>
                        <span className="line-through">
                          {r.staraVrednost == null ? '—' : izNajmanjeJedinice(r.staraVrednost)}
                        </span>{' '}
                        →{' '}
                        <strong className="text-ink">
                          {r.novaVrednost == null ? '—' : izNajmanjeJedinice(r.novaVrednost)}
                        </strong>{' '}
                        {currency}
                      </>
                    )}
                    {r.vrsta === 'NOVA' && (
                      <>
                        {r.novaVrednost == null ? '—' : izNajmanjeJedinice(r.novaVrednost)}{' '}
                        {currency}
                      </>
                    )}
                    {r.vrsta === 'UGASENA' && (
                      <>
                        bilo {r.staraVrednost == null ? '—' : izNajmanjeJedinice(r.staraVrednost)}{' '}
                        {currency}
                      </>
                    )}
                    {r.izmenjenaPolja.length > 0 && (
                      <>
                        {' · '}
                        {r.izmenjenaPolja
                          .map((p) => `${p.polje}: ${p.staro ?? '—'} → ${p.novo ?? '—'}`)
                          .join(' · ')}
                      </>
                    )}
                  </p>
                </div>
                {r.stavka === 'DOPLATA' && (
                  <Badge className="shrink-0 bg-sunken text-ink-faint">doplata</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && razlike.ukupno > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border px-3 py-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-ink-faint">Nova cena važi od</span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
              />
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-[11px] text-ink-faint">Napomena (opciono)</span>
              <input
                value={napomena}
                onChange={(e) => setNapomena(e.target.value)}
                placeholder="npr. korekcija dobavljača od 5.6."
                className="rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
              />
            </label>
            <Button onClick={potvrdi} disabled={cekaj}>
              {cekaj ? 'Čuvam…' : `Potvrdi ${razlike.ukupno} i snimi verziju`}
            </Button>
          </div>
        )}

        {greska && (
          <p className="border-t border-border px-3 py-2 text-[11px] text-danger">{greska}</p>
        )}

        {canEdit && razlike.ukupno > 0 && (
          <p className="border-t border-border px-3 py-2 text-[11px] text-ink-faint">
            <Icon name="info" className="mr-1 inline h-3 w-3" />
            Izmene su već upisane u cenovnik. Ovim se snima <strong>verzija</strong> — zapis kako je
            cenovnik izgledao i šta se promenilo. Rezervacije napravljene ranije ostaju na staroj
            ceni.
          </p>
        )}
      </div>

      {/* ── istorija */}
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[11px] text-ink-faint">
              <th className="px-3 py-2 font-medium">Verzija</th>
              <th className="px-3 py-2 font-medium">Važi od</th>
              <th className="px-3 py-2 font-medium">Razlika</th>
              <th className="px-3 py-2 font-medium">Stavki</th>
              <th className="px-3 py-2 font-medium">Nastala</th>
              <th className="px-3 py-2 font-medium">Napomena</th>
            </tr>
          </thead>
          <tbody>
            {verzije.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-ink-faint">
                  Nijedna verzija još nije potvrđena.
                </td>
              </tr>
            ) : (
              verzije.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-semibold text-ink">{v.versionNo}</td>
                  <td className="px-3 py-2 text-ink-dim">{v.effectiveFrom}</td>
                  <td className="px-3 py-2 text-ink-dim">
                    {v.changeCount === 0 ? 'početna' : `${v.changeCount}`}
                  </td>
                  <td className="px-3 py-2 text-ink-dim">{v.stavki}</td>
                  <td className="px-3 py-2 text-ink-faint">
                    {v.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 text-ink-dim">
                    {v.instructionText ? (
                      // §4.8 — rečenica kojom je izmena tražena čuva se uz rezultat. Bez nje se
                      // ne može utvrditi da li je model pogrešno razumeo ili je tako i rečeno.
                      <span className="italic">„{v.instructionText}&ldquo;</span>
                    ) : (
                      (v.note ?? '—')
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
