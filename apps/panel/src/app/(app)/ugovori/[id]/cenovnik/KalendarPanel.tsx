'use client';

import { useEffect, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import {
  MONTHS_SR,
  WEEKDAYS_SHORT_SR,
  addMonths,
  endOfMonth,
  isoOf,
  parseIso,
  startOfMonth,
  startOfWeekMonday,
} from '@/lib/calendar-date';
import { ucitajKalendar } from './actions';

/**
 * M3 spec §2.11o, M17 §6d.4 — kalendar cena i raspoloživosti. **Pregled, ne unos.**
 *
 * Vlasnikova ideja: _„jedan kalendar sa mesecima za neki hotel za neki tip smeštaja za neki period
 * pa mi vidimo cenu u kalendaru"_. Vrednost nije u prikazu nego u tome što se **greška vidi golim
 * okom** — pogrešno unet datumski opseg pravi rupu ili skok u nizu, a to se u mreži cena ne
 * primeti. Ujedno je ovo jedino mesto gde se cena i kapacitet sreću.
 *
 * Zato dan koji nema cenu nije prazan kvadratić nego **imenovan razlog**: van perioda, dan bez
 * cene, zatvoren prozor prodaje, nema cene za taj uzrast. Prazno polje bi izgledalo isto bez
 * obzira da li je cenovnik nepotpun ili je ekran pokvaren.
 */

interface DanKalendara {
  date: string;
  cena: number | null;
  osnova: string | null;
  razlog: string | null;
  seasonCode: string | null;
  slobodno: number | null;
  saleStatus: string | null;
  stopReason: string | null;
  dolazakMoguc: boolean;
}

interface Kombinacija {
  kljuc: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  dani: DanKalendara[];
}

interface Odgovor {
  currency: string;
  roomType: string;
  from: string;
  to: string;
  kombinacije: Kombinacija[];
  upozorenja: string[];
}

const RAZLOG_TEKST: Record<string, string> = {
  VAN_PERIODA: 'van ugovorenog perioda',
  NEMA_CENE: 'nema cenovnog reda',
  DAN_BEZ_CENE: 'za ovaj dan u nedelji nema cene',
  PROZOR_PRODAJE_ZATVOREN: 'prozor prodaje je zatvoren',
  NEMA_CENE_ZA_UZRAST: 'nema cene za taj uzrast deteta',
  CENA_ZA_BORAVAK: 'cena je za ceo boravak, ne po noći',
};

const RAZLOG_KRATKO: Record<string, string> = {
  VAN_PERIODA: '—',
  NEMA_CENE: 'nema cene',
  DAN_BEZ_CENE: 'nema cene',
  PROZOR_PRODAJE_ZATVOREN: 'isteklo',
  NEMA_CENE_ZA_UZRAST: 'uzrast',
};

export default function KalendarPanel({
  contractId,
  tipoviSoba,
  currency,
}: {
  contractId: string;
  tipoviSoba: string[];
  currency: string;
}) {
  const [roomType, setRoomType] = useState(tipoviSoba[0] ?? '');
  const [mesec, setMesec] = useState(() => isoOf(startOfMonth(new Date())));
  const [odrasli, setOdrasli] = useState(2);
  const [uzrasti, setUzrasti] = useState<number[]>([]);
  const [izabranaKomb, setIzabranaKomb] = useState<string | null>(null);
  const [odgovor, setOdgovor] = useState<Odgovor | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [cekaj, pokreni] = useTransition();

  useEffect(() => {
    if (!roomType) return;
    const prvi = startOfMonth(parseIso(mesec));
    const poslednji = endOfMonth(parseIso(mesec));
    pokreni(async () => {
      const r = await ucitajKalendar(contractId, {
        roomType,
        from: isoOf(prvi),
        to: isoOf(poslednji),
        adults: odrasli,
        childrenAges: uzrasti,
      });
      setGreska(r.error);
      setOdgovor((r.podaci as Odgovor | null) ?? null);
    });
  }, [contractId, roomType, mesec, odrasli, uzrasti]);

  const kombinacije = odgovor?.kombinacije ?? [];
  const aktivna = kombinacije.find((k) => k.kljuc === izabranaKomb) ?? kombinacije[0] ?? null;

  if (tipoviSoba.length === 0) {
    // Prazan ekran ovde nije kvar nego redosled posla — bez cena nema šta da se prikaže.
    return (
      <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
        Cenovnik još nema nijedan tip sobe. Unesite cenu u kartici „Cene&ldquo;, pa se ovde
        pojavljuje kalendar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── izbor: soba, mesec, sastav gostiju */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-panel px-3 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">Tip sobe</span>
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
          >
            {tipoviSoba.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-1">
          <Button
            variant="ghost"
            onClick={() => setMesec(isoOf(addMonths(parseIso(mesec), -1)))}
            aria-label="Prethodni mesec"
          >
            ←
          </Button>
          <span className="px-1 py-1 text-xs font-semibold text-ink">
            {MONTHS_SR[parseIso(mesec).getMonth()]} {parseIso(mesec).getFullYear()}
          </span>
          <Button
            variant="ghost"
            onClick={() => setMesec(isoOf(addMonths(parseIso(mesec), 1)))}
            aria-label="Sledeći mesec"
          >
            →
          </Button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">Odraslih</span>
          <input
            type="number"
            min={1}
            max={20}
            value={odrasli}
            onChange={(e) => setOdrasli(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
          />
        </label>

        <div className="flex flex-col gap-1">
          {/* Godine svakog deteta pojedinačno — doplata se razlikuje po uzrastu (§2.4a), pa
              „dvoje dece" nije podatak od kog se može izračunati cena. */}
          <span className="text-[11px] text-ink-faint">Deca (godine)</span>
          <div className="flex items-center gap-1">
            {uzrasti.map((g, i) => (
              <input
                key={i}
                type="number"
                min={0}
                max={17}
                value={g}
                onChange={(e) => {
                  const kopija = [...uzrasti];
                  kopija[i] = Math.min(17, Math.max(0, Number(e.target.value) || 0));
                  setUzrasti(kopija);
                }}
                className="w-14 rounded border border-border bg-sunken px-2 py-1 text-xs text-ink"
              />
            ))}
            <Button variant="ghost" onClick={() => setUzrasti([...uzrasti, 8])}>
              + dete
            </Button>
            {uzrasti.length > 0 && (
              <Button variant="ghost" onClick={() => setUzrasti(uzrasti.slice(0, -1))}>
                −
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── izbor kombinacije (pansion × popunjenost) */}
      {kombinacije.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {kombinacije.map((k) => (
            <button
              key={k.kljuc}
              type="button"
              onClick={() => setIzabranaKomb(k.kljuc)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                aktivna?.kljuc === k.kljuc
                  ? 'border-accent bg-accent-soft font-semibold text-ink'
                  : 'border-border text-ink-faint hover:text-ink'
              }`}
            >
              {k.boardType} · {k.occupancy}
            </button>
          ))}
        </div>
      )}

      {greska && (
        <p className="rounded-lg border border-border bg-panel px-3 py-2 text-[11px] text-danger">
          {greska}
        </p>
      )}

      {odgovor && odgovor.upozorenja.length > 0 && (
        <ul className="rounded-lg border border-border bg-panel px-3 py-2 text-[11px] text-warn">
          {odgovor.upozorenja.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      )}

      {aktivna ? (
        <MesecnaMreza mesec={mesec} dani={aktivna.dani} currency={currency} cekaj={cekaj} />
      ) : (
        !cekaj && (
          <p className="rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-faint">
            Za ovaj tip sobe u ovom mesecu nema nijedne cene. To može značiti da period ne pokriva
            ovaj mesec — kalendar zato i postoji.
          </p>
        )
      )}

      <p className="text-[11px] text-ink-faint">
        Cena je za <strong className="text-ink-dim">jednu noć koja počinje tog dana</strong> i za
        izabrani sastav gostiju. Broj ispod cene je koliko je jedinica slobodno. Ovaj ekran samo
        prikazuje — cene se menjaju u kartici „Cene&ldquo;, kapacitet na ekranu kapaciteta.
      </p>
    </div>
  );
}

function MesecnaMreza({
  mesec,
  dani,
  currency,
  cekaj,
}: {
  mesec: string;
  dani: DanKalendara[];
  currency: string;
  cekaj: boolean;
}) {
  const poDatumu = new Map(dani.map((d) => [d.date, d]));
  const prvi = startOfMonth(parseIso(mesec));
  const pocetak = startOfWeekMonday(prvi);
  const polja: Date[] = [];
  for (let i = 0; i < 42; i++) {
    polja.push(new Date(pocetak.getTime() + i * 86_400_000));
  }
  const mesecBroj = prvi.getMonth();

  return (
    <div className={`rounded-lg border border-border bg-panel p-2 ${cekaj ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT_SR.map((d) => (
          <div key={d} className="px-1 py-1 text-center text-[10px] text-ink-faint">
            {d}
          </div>
        ))}
        {polja.map((d) => {
          const iso = isoOf(d);
          const uMesecu = d.getMonth() === mesecBroj;
          const dan = poDatumu.get(iso);
          return (
            <div
              key={iso}
              className={`min-h-[62px] rounded border p-1 ${
                uMesecu ? 'border-border bg-sunken' : 'border-transparent opacity-40'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] text-ink-faint">{d.getDate()}</span>
                {dan?.saleStatus === 'STOP' && (
                  <Badge className="bg-danger-bg px-1 text-[9px] text-danger">stop</Badge>
                )}
              </div>

              {uMesecu && dan && (
                <>
                  {dan.cena != null ? (
                    <div className="mt-0.5 text-[11px] font-semibold text-ink">
                      {izNajmanjeJedinice(dan.cena)}{' '}
                      <span className="font-normal text-ink-faint">{currency}</span>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-ink-faint">
                      {RAZLOG_KRATKO[dan.razlog ?? ''] ?? '—'}
                    </div>
                  )}

                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-faint">
                    {dan.slobodno != null && <span>{dan.slobodno} slob.</span>}
                    {!dan.dolazakMoguc && (
                      // §2.11d — cena postoji, ali boravak tu ne može da počne. Bez ove oznake
                      // kalendar obećava nešto što prodaja odbija.
                      <span className="text-warn" title="Prijava nije moguća tog dana (turnus)">
                        bez prijave
                      </span>
                    )}
                  </div>

                  {dan.razlog && RAZLOG_TEKST[dan.razlog] && (
                    <div className="sr-only">{RAZLOG_TEKST[dan.razlog]}</div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
