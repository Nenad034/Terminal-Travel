'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import { upisiCeliju } from './actions';
import type { Sezona } from './SeasonsBar';

// M3 spec §2.11, M17 §6d — mreža cena: tipovi soba kao redovi, sezone kao kolone.
//
// Ovo je oblik koji sva tri pročitana stvarna cenovnika (Aycon, Plava Laguna, Solvex) imaju.
// Prethodni ekran je prikazivao jedan period — jedan tip sobe i jedan datumski opseg — pa je
// hotel sa 5 soba i 6 sezona tražio 30 poseta.

export interface Celija {
  price: number;
  rateLineIds: string[];
  periodIds: string[];
  bookingFrom: string | null;
  bookingTo: string | null;
  neslozno: boolean;
}

export interface Red {
  key: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  cells: Record<string, Celija>;
}

export interface Grupa {
  roomType: string;
  rows: Red[];
  bezSezone: { periodId: string; stayFrom: string; stayTo: string; cenovnihRedova: number }[];
}

export interface Mreza {
  contractId: string;
  contractNumber: string;
  currency: string;
  commissionModel: string | null;
  commissionPercentage: string | number | null;
  seasons: Sezona[];
  roomTypes: Grupa[];
}

export const OSNOVE: Record<string, string> = {
  PER_PERSON_PER_NIGHT: 'po osobi / noć',
  PER_ROOM_PER_NIGHT: 'po sobi / noć',
  PER_PERSON_PER_STAY: 'po osobi / boravak',
  PER_ROOM_PER_STAY: 'po sobi / boravak',
};

export default function PricelistGrid({
  contractId,
  mreza,
  canEdit,
}: {
  contractId: string;
  mreza: Mreza;
  canEdit: boolean;
}) {
  const [novRed, setNovRed] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[820px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px] border-b border-r border-border bg-sunken px-3 py-2 text-left text-[11px] font-semibold text-ink">
                Tip sobe / cenovni red
              </th>
              {mreza.seasons.map((s) => (
                <th
                  key={s.id}
                  className="border-b border-border bg-sunken px-3 py-2 text-center text-[11px] font-semibold text-ink"
                >
                  {s.code}
                  {/* Datumi u zaglavlju su vlasnikova odluka (9.9.2026): oznaka sama ne kaže
                      na koji deo godine se kolona odnosi. */}
                  <div className="font-mono text-[10px] font-normal text-ink-faint">
                    {s.ranges.map((r, i) => (
                      <div key={i}>
                        {kratko(r.dateFrom)}–{kratko(r.dateTo)}
                      </div>
                    ))}
                  </div>
                </th>
              ))}
              <th className="border-b border-border bg-sunken px-3 py-2 text-center text-[11px] font-semibold text-ink">
                Osnova
              </th>
            </tr>
          </thead>
          <tbody>
            {mreza.roomTypes.length === 0 && (
              <tr>
                <td
                  colSpan={mreza.seasons.length + 2}
                  className="px-3 py-6 text-center text-ink-faint"
                >
                  Cenovnik je prazan. Dodajte prvi cenovni red ispod.
                </td>
              </tr>
            )}

            {mreza.roomTypes.map((g) => (
              <GrupaSobe
                key={g.roomType}
                contractId={contractId}
                grupa={g}
                seasons={mreza.seasons}
                currency={mreza.currency}
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit &&
        (novRed ? (
          <NovRedForma
            contractId={contractId}
            seasons={mreza.seasons}
            postojeciTipovi={mreza.roomTypes.map((g) => g.roomType)}
            onKraj={() => setNovRed(false)}
          />
        ) : (
          <Button size="sm" className="self-start" onClick={() => setNovRed(true)}>
            <Icon name="add" /> Nov cenovni red
          </Button>
        ))}

      <p className="text-[11px] text-ink-faint">
        Cena se kuca kao <strong className="text-ink">89,50</strong>, ne kao 8950. Prazna ćelija
        znači „ne prodaje se u toj sezoni&rdquo; i tako ide u pretragu — nije isto što i nula.
      </p>
    </div>
  );
}

function GrupaSobe({
  contractId,
  grupa,
  seasons,
  currency,
  canEdit,
}: {
  contractId: string;
  grupa: Grupa;
  seasons: Sezona[];
  currency: string;
  canEdit: boolean;
}) {
  return (
    <>
      <tr>
        <td className="sticky left-0 z-10 border-b border-r border-border bg-sunken px-3 py-1.5 font-semibold text-ink">
          {grupa.roomType}
        </td>
        <td
          colSpan={seasons.length + 1}
          className="border-b border-border bg-sunken px-3 py-1.5 text-[11px] text-ink-faint"
        >
          {grupa.bezSezone.length > 0 && (
            <span className="text-warn">
              {grupa.bezSezone.length} {grupa.bezSezone.length === 1 ? 'period' : 'perioda'} van
              sezona (izuzetak)
            </span>
          )}
        </td>
      </tr>

      {grupa.rows.map((r) => (
        <tr key={r.key}>
          <td className="sticky left-0 z-10 border-b border-r border-border bg-panel px-3 py-1.5 text-ink-dim">
            <span className="pl-4">
              {r.boardType} · {r.occupancy}
            </span>
          </td>
          {seasons.map((s) => (
            <td key={s.id} className="border-b border-border px-2 py-1 text-center">
              <CelijaCene
                contractId={contractId}
                celija={r.cells[s.id]}
                seasonId={s.id}
                roomType={grupa.roomType}
                red={r}
                currency={currency}
                canEdit={canEdit}
              />
            </td>
          ))}
          <td className="border-b border-border px-2 py-1 text-center">
            <Badge variant="outline">{OSNOVE[r.priceBasis] ?? r.priceBasis}</Badge>
          </td>
        </tr>
      ))}

      {grupa.bezSezone.map((p) => (
        <tr key={p.periodId}>
          <td
            colSpan={seasons.length + 2}
            className="border-b border-border bg-sunken/50 px-3 py-1 text-[11px] text-ink-faint"
          >
            <span className="pl-4">
              Izuzetak — period {p.stayFrom} – {p.stayTo} nije ni u jednoj sezoni (
              {p.cenovnihRedova} {p.cenovnihRedova === 1 ? 'cena' : 'cena'}).{' '}
              <Link
                href={`/ugovori/${contractId}/periods/${p.periodId}`}
                className="text-accent-strong hover:underline"
              >
                otvori period
              </Link>
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

function CelijaCene({
  contractId,
  celija,
  seasonId,
  roomType,
  red,
  currency,
  canEdit,
}: {
  contractId: string;
  celija: Celija | undefined;
  seasonId: string;
  roomType: string;
  red: Red;
  currency: string;
  canEdit: boolean;
}) {
  const [uredjuje, setUredjuje] = useState(false);
  const [unos, setUnos] = useState(celija ? izNajmanjeJedinice(celija.price) : '');
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, start] = useTransition();

  if (!uredjuje) {
    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => canEdit && setUredjuje(true)}
        title={celija?.neslozno ? 'Opsezi ove sezone nemaju istu cenu' : undefined}
        className={`min-w-[74px] rounded border px-2 py-1 font-mono text-xs ${
          celija
            ? celija.neslozno
              ? 'border-warn bg-warn-bg text-warn'
              : 'border-border bg-surface text-ink'
            : 'border-dashed border-border text-ink-faint'
        } ${canEdit ? 'hover:border-accent' : ''}`}
      >
        {celija ? izNajmanjeJedinice(celija.price) : '—'}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <input
        autoFocus
        value={unos}
        onChange={(e) => setUnos(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setUredjuje(false);
          if (e.key === 'Enter') sacuvaj();
        }}
        placeholder="89,50"
        className="input w-[86px] text-center font-mono text-xs"
      />
      <span className="flex gap-1">
        <button
          type="button"
          disabled={radi}
          onClick={sacuvaj}
          className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white"
        >
          {radi ? '…' : 'ok'}
        </button>
        <button
          type="button"
          onClick={() => setUredjuje(false)}
          className="text-[10px] text-ink-faint"
        >
          ✕
        </button>
      </span>
      <span className="text-[9px] text-ink-faint">{currency}</span>
      {greska && <span className="max-w-[160px] text-[10px] text-danger">{greska}</span>}
    </span>
  );

  function sacuvaj() {
    start(async () => {
      setGreska(null);
      const r = await upisiCeliju(contractId, {
        seasonId,
        roomType,
        boardType: red.boardType,
        occupancy: red.occupancy,
        priceBasis: red.priceBasis,
        cena: unos,
      });
      if (r.error) setGreska(r.error);
      else setUredjuje(false);
    });
  }
}

/**
 * Nov cenovni red = nova kombinacija (tip sobe × usluga × sastav gostiju × osnova).
 *
 * Kombinacije se ne nabrajaju unapred jer se ne mogu znati: Solvex cenovnik ima redove poput
 * „1 Adult + 1 Chd (07-11,99)", Aycon „2+0". Zato je i tip sobe polje sa predlozima, a ne
 * zatvorena lista — dobavljač sme imati tip koji katalog još nema (§2.11m).
 */
function NovRedForma({
  contractId,
  seasons,
  postojeciTipovi,
  onKraj,
}: {
  contractId: string;
  seasons: Sezona[];
  postojeciTipovi: string[];
  onKraj: () => void;
}) {
  const [roomType, setRoomType] = useState('');
  const [boardType, setBoardType] = useState('Noćenje sa doručkom');
  const [occupancy, setOccupancy] = useState('');
  const [priceBasis, setPriceBasis] = useState('PER_PERSON_PER_NIGHT');
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? '');
  const [cena, setCena] = useState('');
  const [bookingTo, setBookingTo] = useState('');
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, start] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <h3 className="text-sm font-semibold text-ink">Nov cenovni red</h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Tip sobe
          <input
            list="tipovi-soba"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            placeholder="Budget double room"
            className="input text-xs"
          />
          <datalist id="tipovi-soba">
            {postojeciTipovi.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Usluga
          <input
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Sastav gostiju
          <input
            value={occupancy}
            onChange={(e) => setOccupancy(e.target.value)}
            placeholder="2 odrasle osobe"
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Osnova cene
          <select
            value={priceBasis}
            onChange={(e) => setPriceBasis(e.target.value)}
            className="input text-xs"
          >
            {Object.entries(OSNOVE).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Prva sezona
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className="input text-xs"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
                {s.label ? ` — ${s.label}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Cena
          <input
            value={cena}
            onChange={(e) => setCena(e.target.value)}
            placeholder="89,50"
            className="input font-mono text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Za rezervacije do (opciono)
          <input
            type="date"
            value={bookingTo}
            onChange={(e) => setBookingTo(e.target.value)}
            className="input text-xs"
          />
        </label>
      </div>

      <p className="text-[10px] text-ink-faint">
        Red nastaje sa cenom za izabranu sezonu. Ostale kolone se popunjavaju klikom u mreži — tako
        se ne mora unositi pet cena pre nego što se vidi ijedan red.
      </p>

      {greska && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={radi}
          onClick={() =>
            start(async () => {
              setGreska(null);
              if (!roomType.trim() || !occupancy.trim()) {
                setGreska('Tip sobe i sastav gostiju su obavezni.');
                return;
              }
              const r = await upisiCeliju(contractId, {
                seasonId,
                roomType: roomType.trim(),
                boardType: boardType.trim(),
                occupancy: occupancy.trim(),
                priceBasis,
                cena,
                bookingTo: bookingTo || undefined,
              });
              if (r.error) setGreska(r.error);
              else onKraj();
            })
          }
        >
          {radi ? 'Upisujem…' : 'Dodaj red'}
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

function kratko(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`;
}
