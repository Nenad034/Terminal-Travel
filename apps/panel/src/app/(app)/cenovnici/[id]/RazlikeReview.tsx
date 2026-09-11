'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/Icon';
import { poklopiTipoveSoba, primeniUvoz, rejectRow } from '../actions';

/**
 * M3 spec §4.2.10 (v1.39) — uvoz se potvrđuje kao RAZLIKE, ne red po red.
 *
 * Zamenjuje `RowsReview`. Razlog nije izgled nego to što je red-po-red potvrda bila drugi put do
 * cenovnika: nije pravila verziju, nije nosila sezonu, i njene cene se u mreži nisu videle kao
 * ćelije. Ovde uvoz ide kroz isti tok kao ručna izmena i izmena rečima — jedan put, jedna
 * istorija.
 *
 * Podrazumevano **nijedna kvačica nije označena**: potvrđivanje je svesna radnja, ne
 * propuštanje (§2.11l, isto pravilo kao u kartici „Verzije").
 */

interface Razlika {
  kljuc: string;
  vrsta: 'IZMENJENA' | 'NOVA' | 'UGASENA';
  stavka: 'CENA' | 'DOPLATA';
  opis: string;
  poruka: string;
  staraVrednost: number | null;
  novaVrednost: number | null;
  izmenjenaPolja: { polje: string; staro: string | null; novo: string | null }[];
}

/** §2.11m — jedan tekst tipa sobe iz dokumenta i šta je od njega postalo. */
interface TipSobe {
  tekst: string;
  code: string | null;
  nacin: 'SIFRA' | 'NAZIV' | 'DEO_NAZIVA' | 'RUCNO' | null;
  brojRedova: number;
}

export interface UgovorRazlike {
  contractId: string;
  contractNumber: string;
  supplierName: string;
  noveSezone: { code: string; label: string }[];
  razlike: Razlika[];
  ukupno: number;
  katalogSobe: { code: string; name?: string | null }[];
  tipoviSoba: TipSobe[];
}

const OZNAKA = {
  IZMENJENA: { tekst: 'izmena', ton: 'bg-warn-bg text-warn' },
  NOVA: { tekst: 'novo', ton: 'bg-ok-bg text-ok' },
  UGASENA: { tekst: 'gasi se', ton: 'bg-danger-bg text-danger' },
} as const;

function izNajmanjeJedinice(v: number): string {
  return (v / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RazlikeReview({
  importId,
  ugovori,
  nepoklopljeni,
  canApprove,
}: {
  importId: string;
  ugovori: UgovorRazlike[];
  nepoklopljeni: { rowId: string; hotel: string; matchConfidence: number | null }[];
  canApprove: boolean;
}) {
  if (ugovori.length === 0 && nepoklopljeni.length === 0) {
    // Prazno ovde nije prazna baza: znači da je svaki red već obrađen ili odbačen.
    return (
      <p className="rounded-lg border border-border bg-panel px-3 py-6 text-center text-[11px] text-ink-faint">
        Nema više redova koji čekaju odluku u ovom uvozu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ugovori.map((u) => (
        <UgovorBlok key={u.contractId} importId={importId} ugovor={u} canApprove={canApprove} />
      ))}

      {nepoklopljeni.length > 0 && <Nepoklopljeni importId={importId} redovi={nepoklopljeni} />}
    </div>
  );
}

/**
 * §2.11m — tipovi soba koje katalog ne prepoznaje.
 *
 * Zašto stoji IZNAD spiska razlika, a ne uz svaki red: tip sobe je odluka o SOBI, ne o ceni.
 * Jedan tekst pogodi desetine redova cenovnika, pa bi birač uz svaki red tražio istu odluku
 * desetinama puta. I zato što nepoklopljen tip menja ono što razlike ispod uopšte znače — poklapanje
 * menja ključ razlike, pa se spisak posle njega ponovo učitava.
 *
 * Posledica koja se ovde izričito kaže: red sa nepoklopljenim tipom ući će u cenovnik kao sirov
 * tekst, i prodaja nad njim neće moći da proveri kapacitet sobe.
 */
function TipoviSobaPanel({
  importId,
  tipovi,
  katalog,
  canApprove,
}: {
  importId: string;
  tipovi: TipSobe[];
  katalog: { code: string; name?: string | null }[];
  canApprove: boolean;
}) {
  const nepoklopljeni = tipovi.filter((t) => t.code === null);
  const [izbor, setIzbor] = useState<Record<string, string>>({});
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, startTransition] = useTransition();

  if (nepoklopljeni.length === 0) return null;

  const spremni = Object.entries(izbor).filter(([, code]) => code.length > 0);

  return (
    <div className="border-b border-border bg-warn-bg/40 px-3 py-3">
      <p className="mb-2 text-[11px] text-ink">
        <Icon name="warning" />{' '}
        <strong>
          {nepoklopljeni.length} {nepoklopljeni.length === 1 ? 'tip sobe nije' : 'tipa soba nisu'}{' '}
          poklopljen sa katalogom.
        </strong>{' '}
        Dok se ne poklope, u cenovnik ide tekst iz dokumenta — prodaja takvu sobu ne prepoznaje, pa
        nad njom ne može da proveri kapacitet.
      </p>

      {katalog.length === 0 ? (
        <p className="text-[11px] text-ink-dim">
          Ovaj objekat u katalogu nema nijedan tip sobe. Unesite ih na ekranu proizvoda, pa se
          vratite ovde — poklapanje bez šifarnika nije moguće.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {nepoklopljeni.map((t) => (
            <li key={t.tekst} className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-mono text-ink">{t.tekst}</span>
              <span className="text-ink-faint">
                ({t.brojRedova} {t.brojRedova === 1 ? 'red' : 'redova'})
              </span>
              <span className="text-ink-faint">→</span>
              <select
                className="input h-7 py-0 text-[11px]"
                value={izbor[t.tekst] ?? ''}
                disabled={!canApprove || radi}
                onChange={(e) => setIzbor((p) => ({ ...p, [t.tekst]: e.target.value }))}
                aria-label={`tip sobe iz kataloga za: ${t.tekst}`}
              >
                <option value="">— izaberite sobu iz kataloga —</option>
                {katalog.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.name ? `${k.name} (${k.code})` : k.code}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      {greska && <p className="mt-2 text-[11px] text-danger">{greska}</p>}

      {canApprove && spremni.length > 0 && (
        <Button
          size="sm"
          className="mt-2"
          disabled={radi}
          onClick={() =>
            startTransition(async () => {
              setGreska(null);
              const rez = await poklopiTipoveSoba(
                importId,
                spremni.map(([tekst, code]) => ({ tekst, code })),
              );
              if (rez.error) setGreska(rez.error);
              else setIzbor({});
            })
          }
        >
          {radi ? 'Poklapam…' : `Poklopi ${spremni.length} i osveži razlike`}
        </Button>
      )}
    </div>
  );
}

function UgovorBlok({
  importId,
  ugovor,
  canApprove,
}: {
  importId: string;
  ugovor: UgovorRazlike;
  canApprove: boolean;
}) {
  const [izabrani, setIzabrani] = useState<Set<string>>(new Set());
  const [vaziOd, setVaziOd] = useState(() => new Date().toISOString().slice(0, 10));
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, startTransition] = useTransition();

  function prebaci(kljuc: string) {
    setIzabrani((prev) => {
      const n = new Set(prev);
      if (n.has(kljuc)) n.delete(kljuc);
      else n.add(kljuc);
      return n;
    });
  }

  return (
    <section className="rounded-lg border border-border bg-panel">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {ugovor.supplierName || ugovor.contractNumber}
          </h2>
          <p className="text-[11px] text-ink-faint">
            Ugovor {ugovor.contractNumber} ·{' '}
            {ugovor.ukupno === 0
              ? 'cenovnik je istovetan onome što dokument nosi'
              : `${ugovor.ukupno} ${ugovor.ukupno === 1 ? 'razlika' : 'razlika'} prema zatečenom cenovniku`}
          </p>
        </div>
        {izabrani.size > 0 && (
          <span className="text-[11px] text-ink-dim">označeno {izabrani.size}</span>
        )}
      </header>

      {/*
        Nova sezona je kolona koja tek treba da nastane. Mora se videti PRE potvrde — uvoz ne
        dodaje samo cene nego i menja izgled mreže (§4.2.10).
      */}
      {ugovor.noveSezone.length > 0 && (
        <p className="border-b border-border bg-sunken px-3 py-2 text-[11px] text-ink-dim">
          <Icon name="info" /> Potvrdom nastaju i nove sezone (kolone u mreži):{' '}
          {ugovor.noveSezone.map((s) => `${s.code} (${s.label})`).join(', ')}
        </p>
      )}

      <TipoviSobaPanel
        importId={importId}
        tipovi={ugovor.tipoviSoba}
        katalog={ugovor.katalogSobe}
        canApprove={canApprove}
      />

      {ugovor.ukupno === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-ink-faint">
          Dokument ne donosi nijednu izmenu za ovaj ugovor.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {ugovor.razlike.map((r) => (
            <li key={r.kljuc} className="flex items-start gap-2 px-3 py-2">
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={izabrani.has(r.kljuc)}
                disabled={!canApprove || r.stavka === 'DOPLATA'}
                onChange={() => prebaci(r.kljuc)}
                aria-label={`potvrdi: ${r.opis}`}
              />
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
                      </strong>
                    </>
                  )}
                  {r.vrsta === 'NOVA' &&
                    (r.novaVrednost == null ? '—' : izNajmanjeJedinice(r.novaVrednost))}
                  {r.vrsta === 'UGASENA' && (
                    <>bilo {r.staraVrednost == null ? '—' : izNajmanjeJedinice(r.staraVrednost)}</>
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
              {/* Doplate se menjaju na svom ekranu (§2.11k) — ovde se vide, ali se ne potvrđuju. */}
              {r.stavka === 'DOPLATA' && (
                <Badge className="shrink-0 bg-sunken text-ink-faint">
                  doplata — na svom ekranu
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {greska && (
        <p className="mx-3 my-2 rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>
      )}

      {canApprove && ugovor.ukupno > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-border px-3 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-ink-faint">Nova cena važi od</span>
            <input
              type="date"
              value={vaziOd}
              onChange={(e) => setVaziOd(e.target.value)}
              className="input text-xs"
            />
          </label>
          <Button
            size="sm"
            disabled={radi || izabrani.size === 0}
            onClick={() =>
              startTransition(async () => {
                setGreska(null);
                // §2.11m — ako je među potvrđenim razlikama tip sobe koji katalog ne poznaje,
                // upis se traži IZRIČITO. Server isto to proverava i odbija bez ove potvrde —
                // ovde se samo pita pre nego što zahtev ode, da čovek ne dobije golu grešku.
                const sporni = ugovor.tipoviSoba
                  .filter((t) => t.code === null)
                  .filter((t) => [...izabrani].some((k) => k.includes(`|${t.tekst}|`)))
                  .map((t) => t.tekst);
                let dozvoli = false;
                if (sporni.length > 0) {
                  dozvoli = confirm(
                    `Tipovi soba koji nisu poklopljeni sa katalogom: ${sporni.join(', ')}. ` +
                      'Cena će biti upisana, ali prodaja tu sobu neće prepoznati i neće moći ' +
                      'da proveri kapacitet. Nastaviti?',
                  );
                  if (!dozvoli) return;
                }

                const rez = await primeniUvoz(importId, ugovor.contractId, {
                  effectiveFrom: vaziOd,
                  prihvaceniKljucevi: [...izabrani],
                  dozvoliNepoklopljeneTipoveSoba: dozvoli || undefined,
                });
                if (rez.error) setGreska(rez.error);
                else setIzabrani(new Set());
              })
            }
          >
            {radi ? 'Primenjujem…' : `Potvrdi ${izabrani.size} i snimi verziju`}
          </Button>
          <p className="text-[10px] text-ink-faint">
            Nepotvrđene razlike ostaju na staroj vrednosti — ništa se ne primenjuje prećutno.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * §4.2.3 — red koji AI nije uspeo da poveže sa proizvodom iz kataloga ne može ući ni u jedan
 * predlog. Mora se videti zasebno, inače tiho nestane iz uvoza.
 */
function Nepoklopljeni({
  importId,
  redovi,
}: {
  importId: string;
  redovi: { rowId: string; hotel: string; matchConfidence: number | null }[];
}) {
  const [radi, startTransition] = useTransition();
  return (
    <section className="rounded-lg border border-warn/40 bg-panel">
      <header className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">
          Nije povezano sa katalogom ({redovi.length})
        </h2>
        <p className="text-[11px] text-ink-faint">
          Ovi redovi ne mogu ući u cenovnik dok se hotel ne poveže sa proizvodom. Povežite ih na
          ekranu kataloga, pa ponovo otvorite razlike — ili ih odbacite ako ih AI pogrešno pročitao.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {redovi.map((r) => (
          <li key={r.rowId} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs text-ink">
              {r.hotel}
              {r.matchConfidence != null && (
                <span className="text-[11px] text-ink-faint">
                  {' '}
                  · najbolje poklapanje {Math.round(r.matchConfidence)}%
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={radi}
              onClick={() => startTransition(() => rejectRow(importId, r.rowId))}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-ink-faint hover:text-danger"
            >
              <Icon name="close" /> odbaci
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
