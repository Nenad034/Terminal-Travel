'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import { pripremiIzmenuRecima, primeniIzmeneRecima } from './actions';

/**
 * M3 spec §4.8, M17 §6d.3 — izmena cenovnika rečima.
 *
 * Vlasnik: _„omogućio bih da AI agent ima sposobnost da mu kažemo šta treba da izmeni kada su
 * manje izmene… da to izmeni, prikaže, sačeka naše odobrenje i primeni izmene."_
 *
 * Dva pravila iz specifikacije su **vidljiva na ekranu**, ne samo sprovedena u kodu:
 * **„ništa još nije primenjeno"** stoji iznad spiska, i **rečenica koja je izmenu tražila ostaje
 * uz rezultat**. Treće pravilo je u ponašanju: svaka izmena se odobrava **posebno** — „prihvati
 * sve" postoji zbog brzine, ali pojedinačno odbijanje mora biti moguće, inače jedna pogrešno
 * shvaćena rečenica prođe zajedno sa četrnaest ispravnih.
 */

interface Razlika {
  kljuc: string;
  vrsta: 'IZMENJENA' | 'NOVA' | 'UGASENA';
  opis: string;
  poruka: string;
  staraVrednost: number | null;
  novaVrednost: number | null;
}

interface Predlog {
  instructionText: string;
  pitanja: string[];
  namere: { vrsta: string; obrazlozenje: string }[];
  razlike: Razlika[];
  ukupno: number;
  sviKljucevi: string[];
  redovi: unknown[];
  neprimenjeno: { obrazlozenje: string; razlog: string }[];
  noveDoplate: { name: string; flatAmount?: number | null }[];
  ugaseneDoplate: string[];
}

const OZNAKA: Record<Razlika['vrsta'], { tekst: string; ton: string }> = {
  IZMENJENA: { tekst: 'izmenjeno', ton: 'bg-warn-bg text-warn' },
  NOVA: { tekst: 'novo', ton: 'bg-ok-bg text-ok' },
  UGASENA: { tekst: 'ukida se', ton: 'bg-danger-bg text-danger' },
};

export default function IzmenaRecimaPanel({
  contractId,
  currency,
  canEdit,
}: {
  contractId: string;
  currency: string;
  canEdit: boolean;
}) {
  const [recenica, setRecenica] = useState('');
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [predlog, setPredlog] = useState<Predlog | null>(null);
  const [izabrani, setIzabrani] = useState<Set<string>>(new Set());
  const [greska, setGreska] = useState<string | null>(null);
  const [uspeh, setUspeh] = useState<string | null>(null);
  const [cekaj, pokreni] = useTransition();

  function pripremi() {
    setGreska(null);
    setUspeh(null);
    pokreni(async () => {
      const r = await pripremiIzmenuRecima(contractId, {
        instructionText: recenica.trim(),
        effectiveFrom: datum,
      });
      if (r.error) {
        setGreska(r.error);
        setPredlog(null);
        return;
      }
      const p = r.predlog as Predlog;
      setPredlog(p);
      // Podrazumevano ništa nije čekirano: odobravanje je svesna radnja, ne propuštanje.
      setIzabrani(new Set());
    });
  }

  function primeni() {
    if (!predlog) return;
    setGreska(null);
    pokreni(async () => {
      const r = await primeniIzmeneRecima(contractId, {
        effectiveFrom: datum,
        redovi: predlog.redovi,
        prihvaceniKljucevi: [...izabrani],
        instructionText: predlog.instructionText,
      });
      if (r.error) {
        setGreska(r.error);
        return;
      }
      setUspeh(
        `Primenjeno ${izabrani.size} ${izabrani.size === 1 ? 'izmena' : 'izmena'}. Nova verzija cenovnika je snimljena.`,
      );
      setPredlog(null);
      setRecenica('');
      setIzabrani(new Set());
    });
  }

  function prebaci(kljuc: string) {
    const kopija = new Set(izabrani);
    if (kopija.has(kljuc)) kopija.delete(kljuc);
    else kopija.add(kljuc);
    setIzabrani(kopija);
  }

  if (!canEdit) {
    return (
      <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
        Za izmenu cenovnika je potrebno pravo izmene ugovornih perioda (M3/contract-period/EDIT).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-panel p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">
            Napišite izmenu kako biste je rekli kolegi
          </span>
          <textarea
            value={recenica}
            onChange={(e) => setRecenica(e.target.value)}
            rows={3}
            placeholder="npr. cene za sezonu 4 i 5 idu gore 5%, uvode doplatu za parking 5 € po sobi po noći koja se plaća na licu mesta"
            className="rounded border border-border bg-sunken px-2 py-1.5 text-xs text-ink"
          />
        </label>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-faint">Nova cena važi od</span>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
            />
          </label>
          <Button onClick={pripremi} disabled={cekaj || recenica.trim().length < 3}>
            {cekaj ? 'Pripremam…' : 'Pripremi izmene'}
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-ink-faint">
          <Icon name="info" className="mr-1 inline h-3 w-3" />
          Iznose računa sistem, ne AI — AI samo razume šta ste tražili. Ništa se ne upisuje dok ne
          odobrite izmenu po izmenu.
        </p>
      </div>

      {greska && (
        <p className="rounded-lg border border-border bg-panel px-3 py-2 text-[11px] text-danger">
          {greska}
        </p>
      )}
      {uspeh && (
        <p className="rounded-lg border border-border bg-panel px-3 py-2 text-[11px] text-ok">
          {uspeh}
        </p>
      )}

      {predlog && (
        <>
          {/* §4.8.2 — „ništa još nije primenjeno" stoji IZNAD spiska, ne u sitnom tekstu ispod. */}
          <p className="rounded-lg border border-warn bg-warn-bg px-3 py-2 text-[11px] text-warn">
            Ništa još nije primenjeno. Označite izmene koje prihvatate, pa potvrdite.
          </p>

          {predlog.pitanja.length > 0 && (
            <div className="rounded-lg border border-border bg-panel px-3 py-2">
              <h3 className="text-[11px] font-semibold text-ink">
                Pitanja pre nego što se primeni
              </h3>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-ink-dim">
                {predlog.pitanja.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {predlog.namere.length > 0 && (
            <div className="rounded-lg border border-border bg-panel px-3 py-2">
              {/* Čovek proverava RAZUMEVANJE, ne samo ishod: ako je model pogrešno pročitao
                  rečenicu, to se vidi ovde pre nego što se pogleda ijedna cena. */}
              <h3 className="text-[11px] font-semibold text-ink">Kako je zahtev razumljen</h3>
              <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-ink-dim">
                {predlog.namere.map((n, i) => (
                  <li key={i}>„{n.obrazlozenje}&ldquo;</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h3 className="text-xs font-semibold text-ink">
                Predložene izmene cena ({predlog.ukupno})
              </h3>
              {predlog.ukupno > 0 && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => setIzabrani(new Set(predlog.sviKljucevi))}
                    disabled={cekaj}
                  >
                    Prihvati sve
                  </Button>
                  <Button variant="ghost" onClick={() => setIzabrani(new Set())} disabled={cekaj}>
                    Poništi izbor
                  </Button>
                </div>
              )}
            </div>

            {predlog.ukupno === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-ink-faint">
                Iz ove rečenice nije nastala nijedna izmena cena.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {predlog.razlike.map((r) => (
                  <li key={r.kljuc} className="flex items-start gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={izabrani.has(r.kljuc)}
                      onChange={() => prebaci(r.kljuc)}
                      className="mt-0.5"
                      aria-label={`Prihvati izmenu: ${r.opis}`}
                    />
                    <Badge className={`${OZNAKA[r.vrsta].ton} shrink-0`}>
                      {OZNAKA[r.vrsta].tekst}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink">{r.opis}</p>
                      <p className="text-[11px] text-ink-dim">
                        {r.staraVrednost != null && (
                          <span className="line-through">
                            {izNajmanjeJedinice(r.staraVrednost)}
                          </span>
                        )}
                        {r.staraVrednost != null && r.novaVrednost != null && ' → '}
                        {r.novaVrednost != null && (
                          <strong className="text-ink">{izNajmanjeJedinice(r.novaVrednost)}</strong>
                        )}{' '}
                        {currency}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {predlog.ukupno > 0 && (
              <div className="border-t border-border px-3 py-2">
                <Button onClick={primeni} disabled={cekaj || izabrani.size === 0}>
                  {cekaj ? 'Primenjujem…' : `Primeni ${izabrani.size} i snimi verziju`}
                </Button>
              </div>
            )}
          </div>

          {(predlog.neprimenjeno.length > 0 ||
            predlog.noveDoplate.length > 0 ||
            predlog.ugaseneDoplate.length > 0) && (
            <div className="rounded-lg border border-border bg-panel px-3 py-2">
              {/* Ono što ovaj tok ne ume da primeni se PRIJAVLJUJE. Prećutana izmena je gora od
                  neprimenjene: čovek bi mislio da je urađena. */}
              <h3 className="text-[11px] font-semibold text-ink">
                Ovo nije primenjeno — uradite ručno
              </h3>
              <ul className="mt-1 flex flex-col gap-1 text-[11px] text-ink-dim">
                {predlog.noveDoplate.map((d, i) => (
                  <li key={`d${i}`}>
                    <strong className="text-ink">{d.name}</strong> — nova doplata
                    {d.flatAmount != null && ` (${izNajmanjeJedinice(d.flatAmount)} ${currency})`}:
                    dodajte je u kartici „Doplate i popusti&ldquo;.
                  </li>
                ))}
                {predlog.ugaseneDoplate.map((n) => (
                  <li key={n}>
                    <strong className="text-ink">{n}</strong> — ukida se: ugasite je u kartici
                    „Doplate i popusti&ldquo;.
                  </li>
                ))}
                {predlog.neprimenjeno.map((n, i) => (
                  <li key={`n${i}`}>
                    „{n.obrazlozenje}&ldquo; — {n.razlog}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
