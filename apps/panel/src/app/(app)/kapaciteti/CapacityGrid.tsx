// M17 spec §4b.1/§4b.2 — mreža kapaciteta po danima.
//
// Vizuelni jezik (§4b.2, odluka 8.9.2026 posle poređenja sa uzorom koji je vlasnik priložio):
// boju nosi ISKLJUČIVO pilula sa brojem preostalih jedinica, i to u tri stanja — dovoljno /
// na izmaku / nema. Boja NE nosi popunjenost kao gradijent: obrazac kroz vreme već pokriva
// toplotna mapa u Izveštajima (M13 §4.4), a ovde je bitno "koliko još mogu da prodam".
//
// Tri pravila koja se ne pregovaraju (§4b.2):
//  1. broj je uvek ispisan — boja je pojačanje, nikad jedini nosilac (zeleno/crveno je par
//     koji deo ljudi ne razlikuje, a i crno-bela štampa mora da se čita);
//  2. nema treperenja — ekran prodaja drži otvoren ceo dan;
//  3. boje su tokeni teme (--ok/--warn/--danger), ne ukucane vrednosti, pa mreža prati sva
//     tri moda prikaza.
//
// Prekoračenje (kapacitet smanjen ispod prodatog) se prikazuje kao NEGATIVAN broj sa minusom
// (vlasnikov zahtev 8.9.2026) — nula bi se pročitala kao "puno, u redu je", minus se čita kao
// "toliko gostiju nema gde".

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mesecGodina } from '@/lib/datum-sr';

export interface CapacityDayState {
  date: string;
  capacity: number | null;
  sold: number;
  blocked: number;
  razlika: number | null;
  zaProdaju: number;
  saleStatus: 'OPEN' | 'STOP';
  stopReason: string | null;
}

export interface CapacityGridRow {
  contractId: string;
  contractPeriodId: string;
  supplierName: string;
  productName: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  /** M3 §6 v1.22 — `Product.type` vezanog objekta; `null` kad ugovor nema proizvod u M2. */
  productType: string | null;
  roomType: string;
  allotmentMode: string;
  days: CapacityDayState[];
}

const MODE_SHORT: Record<string, string> = {
  FIXED: 'ALO',
  ON_REQUEST: 'UPIT',
  CHARTER: 'ČART',
  FIXED_LEASE: 'ZAKUP',
};

const DAN_KRATKO = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];

function danNedelje(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * §4b.1 (dopuna 9.9.2026, vlasnikov nalaz: „u prvom redu gde su navedeni dani u mesecu nemamo
 * pojma koji je mesec u pitanju") — dani grupisani po mesecu, za red zaglavlja iznad brojeva.
 * Vraća redom pojavljivanja, jer raspon uvek ide hronološki.
 */
function meseci(dani: string[]): { kljuc: string; naziv: string; brojDana: number }[] {
  const out: { kljuc: string; naziv: string; brojDana: number }[] = [];
  for (const d of dani) {
    const kljuc = d.slice(0, 7);
    const poslednji = out[out.length - 1];
    if (poslednji && poslednji.kljuc === kljuc) {
      poslednji.brojDana += 1;
      continue;
    }
    out.push({ kljuc, naziv: mesecGodina(d), brojDana: 1 });
  }
  return out;
}

/** Prvi dan meseca nosi vidljivu levu granicu — prelaz se vidi i kad je naslov odskrolovan levo. */
function prviUMesecu(iso: string): boolean {
  return iso.slice(8, 10) === '01';
}

/** §4b.2 — jedan jezik boje: koliko je ostalo. Stop i prekoračenje su krajnja stanja. */
function pilula(d: CapacityDayState): { tekst: string; klasa: string; naslov: string } {
  if (d.capacity === null) {
    return { tekst: '', klasa: '', naslov: 'Period ne pokriva ovaj datum' };
  }
  const osnov = `kapacitet ${d.capacity} · prodato ${d.sold}${d.blocked ? ` · blokirano ${d.blocked}` : ''}`;
  if (d.razlika !== null && d.razlika < 0) {
    return {
      tekst: `−${Math.abs(d.razlika)}`,
      klasa: 'bg-danger text-white font-bold',
      naslov: `PREKORAČENO za ${Math.abs(d.razlika)} — ${osnov}`,
    };
  }
  if (d.saleStatus === 'STOP') {
    return {
      tekst: 'STOP',
      klasa: 'bg-danger text-white',
      naslov: `Prodaja zatvorena${d.stopReason ? `: ${d.stopReason}` : ''} — ${osnov}`,
    };
  }
  if (d.zaProdaju === 0) {
    return { tekst: '0', klasa: 'bg-danger text-white', naslov: `Popunjeno — ${osnov}` };
  }
  if (d.zaProdaju <= 2) {
    return {
      tekst: String(d.zaProdaju),
      klasa: 'bg-warn text-white',
      naslov: `Na izmaku — ${osnov}`,
    };
  }
  return { tekst: String(d.zaProdaju), klasa: 'bg-ok text-white', naslov: osnov };
}

interface Grupa {
  kljuc: string;
  naslov: string;
  podnaslov: string;
  redovi: CapacityGridRow[];
}

/** Redovi se grupišu po hotelu (ugovoru): zbirni red + tipovi soba na klik (§4b.1). */
function grupisi(rows: CapacityGridRow[]): Grupa[] {
  const mapa = new Map<string, Grupa>();
  for (const r of rows) {
    const kljuc = r.contractId;
    if (!mapa.has(kljuc)) {
      mapa.set(kljuc, {
        kljuc,
        naslov: r.productName ?? r.supplierName,
        podnaslov: [r.destinationCity, r.destinationCountry].filter(Boolean).join(' · '),
        redovi: [],
      });
    }
    mapa.get(kljuc)!.redovi.push(r);
  }
  return [...mapa.values()];
}

/** Zbirni red hotela: sabira brojeve, a stanje uzima ono najnepovoljnije od svojih soba. */
function zbir(redovi: CapacityGridRow[], index: number): CapacityDayState {
  const dani = redovi.map((r) => r.days[index]).filter((d) => d.capacity !== null);
  if (dani.length === 0) {
    return {
      date: redovi[0].days[index].date,
      capacity: null,
      sold: 0,
      blocked: 0,
      razlika: null,
      zaProdaju: 0,
      saleStatus: 'OPEN',
      stopReason: null,
    };
  }
  const capacity = dani.reduce((s, d) => s + (d.capacity ?? 0), 0);
  const sold = dani.reduce((s, d) => s + d.sold, 0);
  const blocked = dani.reduce((s, d) => s + d.blocked, 0);
  const razlika = dani.reduce((s, d) => s + (d.razlika ?? 0), 0);
  return {
    date: dani[0].date,
    capacity,
    sold,
    blocked,
    razlika,
    // Zatvoreno je zatvoreno samo ako su SVE sobe zatvorene — inače se još nešto prodaje.
    saleStatus: dani.every((d) => d.saleStatus === 'STOP') ? 'STOP' : 'OPEN',
    zaProdaju: dani.reduce((s, d) => s + d.zaProdaju, 0),
    stopReason: null,
  };
}

export default function CapacityGrid({
  rows,
  dani,
  onIzaberiDan,
}: {
  rows: CapacityGridRow[];
  dani: string[];
  onIzaberiDan: (red: CapacityGridRow, datum: string) => void;
}) {
  const [otvoreni, setOtvoreni] = useState<Set<string>>(new Set());
  const grupe = grupisi(rows);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
        Nema ugovorenih kapaciteta za zadate filtere i period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          {/* §4b.1 — red sa mesecom iznad reda sa danima. Bez njega je „1, 2, 3…" dvosmisleno
              čim raspon pređe granicu meseca, a to je i podrazumevano stanje čim se pomeri. */}
          <tr className="bg-sunken">
            <th className="sticky left-0 z-10 bg-sunken px-3 pt-2 text-left" />
            {meseci(dani).map((m) => (
              <th
                key={m.kljuc}
                colSpan={m.brojDana}
                className="border-l border-border px-1 pt-1 text-left text-[11px] font-semibold capitalize text-ink"
              >
                {m.naziv}
              </th>
            ))}
          </tr>
          <tr className="bg-sunken">
            <th className="sticky left-0 z-10 bg-sunken px-3 pb-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Tip smeštaja
            </th>
            {dani.map((d) => {
              const dow = danNedelje(d);
              const vikend = dow === 0 || dow === 6;
              return (
                <th
                  key={d}
                  className={`px-1 py-1 text-center font-normal ${vikend ? 'bg-panel2' : ''} ${
                    prviUMesecu(d) ? 'border-l border-border' : ''
                  }`}
                >
                  <div className="text-[10px] uppercase text-ink-faint">{DAN_KRATKO[dow]}</div>
                  <div className="text-[11px] font-semibold text-ink">{Number(d.slice(8, 10))}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {grupe.map((g) => {
            const razvijen = otvoreni.has(g.kljuc);
            return (
              <FragmentGrupa
                key={g.kljuc}
                grupa={g}
                dani={dani}
                razvijen={razvijen}
                onToggle={() =>
                  setOtvoreni((prev) => {
                    const next = new Set(prev);
                    if (next.has(g.kljuc)) next.delete(g.kljuc);
                    else next.add(g.kljuc);
                    return next;
                  })
                }
                onIzaberiDan={onIzaberiDan}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGrupa({
  grupa,
  dani,
  razvijen,
  onToggle,
  onIzaberiDan,
}: {
  grupa: Grupa;
  dani: string[];
  razvijen: boolean;
  onToggle: () => void;
  onIzaberiDan: (red: CapacityGridRow, datum: string) => void;
}) {
  return (
    <>
      <tr className="border-t border-border bg-panel2/60">
        <td className="sticky left-0 z-10 bg-panel2 px-3 py-2">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left">
            <span className="text-ink-faint">{razvijen ? '−' : '+'}</span>
            <span>
              <span className="block font-medium text-ink">{grupa.naslov}</span>
              <span className="block text-[10px] uppercase text-ink-faint">{grupa.podnaslov}</span>
            </span>
          </button>
        </td>
        {dani.map((d, i) => (
          <Celija
            key={d}
            stanje={zbir(grupa.redovi, i)}
            onClick={() => onIzaberiDan(grupa.redovi[0], d)}
          />
        ))}
      </tr>
      {razvijen &&
        grupa.redovi.map((r) => (
          <tr key={r.contractPeriodId} className="border-t border-border">
            <td className="sticky left-0 z-10 bg-panel px-3 py-2 pl-8">
              <Link
                href={`/ugovori/${r.contractId}`}
                className="text-ink-dim hover:text-accent-strong"
              >
                {r.roomType}
              </Link>
              <span className="ml-2 rounded bg-sunken px-1 text-[9px] uppercase text-ink-faint">
                {MODE_SHORT[r.allotmentMode] ?? r.allotmentMode}
              </span>
            </td>
            {r.days.map((d) => (
              <Celija key={d.date} stanje={d} onClick={() => onIzaberiDan(r, d.date)} />
            ))}
          </tr>
        ))}
    </>
  );
}

function Celija({ stanje, onClick }: { stanje: CapacityDayState; onClick: () => void }) {
  const p = pilula(stanje);
  const dow = danNedelje(stanje.date);
  const vikend = dow === 0 || dow === 6;
  // Granica meseca se povlači i kroz telo tabele, da linija iz zaglavlja ne prestane na prvom redu.
  const granica = prviUMesecu(stanje.date) ? 'border-l border-border' : '';

  if (stanje.capacity === null) {
    return (
      <td className={`px-1 py-1 ${vikend ? 'bg-panel2/40' : ''} ${granica}`} title={p.naslov} />
    );
  }

  return (
    <td className={`px-1 py-1 text-center ${vikend ? 'bg-panel2/40' : ''} ${granica}`}>
      <button
        type="button"
        onClick={onClick}
        title={p.naslov}
        className="flex w-full flex-col items-center gap-0.5 rounded px-0.5 py-0.5 hover:bg-sunken"
      >
        <span className="font-mono text-[9px] leading-none text-ink-faint">
          {stanje.capacity}/{stanje.sold}
        </span>
        <span
          className={`inline-block min-w-[26px] rounded px-1 py-0.5 font-mono text-[10px] leading-none ${p.klasa}`}
        >
          {p.tekst}
        </span>
        {stanje.blocked > 0 && (
          <span className="font-mono text-[9px] leading-none text-warn">⊘{stanje.blocked}</span>
        )}
      </button>
    </td>
  );
}

/** §4b.2 — legenda je uvek na ekranu, ne samo u verziji za štampu. */
export function CapacityLegend() {
  const stavke = [
    { klasa: 'bg-ok', tekst: 'dovoljno (3+)' },
    { klasa: 'bg-warn', tekst: 'na izmaku (1–2)' },
    { klasa: 'bg-danger', tekst: 'popunjeno / zatvoreno / prekoračeno' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
      {stavke.map((s) => (
        <span key={s.tekst} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-6 rounded ${s.klasa}`} aria-hidden />
          {s.tekst}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-warn">⊘</span> blokirano
      </span>
      <span>gornji red u ćeliji: kapacitet / prodato</span>
    </div>
  );
}
