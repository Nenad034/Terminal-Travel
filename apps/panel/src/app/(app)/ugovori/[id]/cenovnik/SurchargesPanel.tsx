'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { izNajmanjeJedinice } from '@/lib/novac';
import { dodajDoplatu, ugasiDoplatu } from './actions';
import type { Sezona } from './SeasonsBar';

// M3 spec §2.11j/§2.11k, M17 §6d.1 — doplate i popusti.
//
// Redosled je vlasnikov: prvo cene, pa doplate. Četiri stvari koje je izričito tražio i koje
// ova tabela mora da pokaže u istom pogledu: obavezno/opciono, plaća se u agenciji ili u hotelu,
// važi za koje sobe (sve ili izbor), i „za rezervacije od…do".

export interface Doplata {
  id: string;
  name: string;
  kind: 'SURCHARGE' | 'DISCOUNT';
  pricingMode: 'FLAT_PER_UNIT' | 'PERCENTAGE_OF_NIGHTLY_RATE';
  flatAmount: number | null;
  percentageOfNightlyRate: string | number | null;
  priceBasis: string;
  payable: 'AGENCY' | 'ON_SITE';
  isMandatory: boolean;
  ulaziUZbir: boolean;
  domet: 'CONTRACT' | 'SEASON' | 'PERIOD';
  seasonId: string | null;
  appliesToRoomTypes: string[];
  appliesFrom: string | null;
  appliesTo: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  bookingFrom: string | null;
  bookingTo: string | null;
  notes: string | null;
}

const OSNOVE_DOPLATE: Record<string, string> = {
  PER_PERSON_PER_NIGHT: 'po osobi / noć',
  PER_ROOM_PER_NIGHT: 'po sobi / noć',
  PER_PERSON_PER_STAY: 'po osobi / boravak',
  PER_ROOM_PER_STAY: 'po sobi / boravak',
  PER_PET_PER_NIGHT: 'po ljubimcu / noć',
  PER_PET_PER_STAY: 'po ljubimcu / boravak',
};

export default function SurchargesPanel({
  contractId,
  doplate,
  seasons,
  tipoviSoba,
  currency,
  canEdit,
}: {
  contractId: string;
  doplate: Doplata[];
  seasons: Sezona[];
  tipoviSoba: string[];
  currency: string;
  canEdit: boolean;
}) {
  const [otvorena, setOtvorena] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              {[
                'Stavka',
                'Iznos',
                'Obračun',
                'Obavezno',
                'Plaća se',
                'Važi za sobe',
                'Rezervacije',
                '',
              ].map((h) => (
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
            {doplate.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-faint">
                  Nema nijedne doplate ni popusta. Boravišna taksa, večera, doplata za jednu osobu u
                  sobi i rana rezervacija se unose ovde.
                </td>
              </tr>
            )}
            {doplate.map((d) => (
              <Red
                key={d.id}
                contractId={contractId}
                d={d}
                seasons={seasons}
                currency={currency}
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit &&
        (otvorena ? (
          <NovaForma
            contractId={contractId}
            seasons={seasons}
            tipoviSoba={tipoviSoba}
            currency={currency}
            onKraj={() => setOtvorena(false)}
          />
        ) : (
          <Button size="sm" className="self-start" onClick={() => setOtvorena(true)}>
            <Icon name="add" /> Nova doplata ili popust
          </Button>
        ))}

      <p className="text-[11px] text-ink-faint">
        Stavka koja se <strong className="text-ink">plaća u hotelu</strong> se unosi i prikazuje
        gostu, ali <strong className="text-ink">ne ulazi u zbir</strong> ni na fakturu — vaša odluka
        od 9.9.2026.
      </p>
    </div>
  );
}

function Red({
  contractId,
  d,
  seasons,
  currency,
  canEdit,
}: {
  contractId: string;
  d: Doplata;
  seasons: Sezona[];
  currency: string;
  canEdit: boolean;
}) {
  const [radi, start] = useTransition();
  const [greska, setGreska] = useState<string | null>(null);
  const sezona = seasons.find((s) => s.id === d.seasonId);

  return (
    <tr>
      <td className="border-b border-border px-3 py-1.5">
        <span className="text-ink">{d.name}</span>
        {d.kind === 'DISCOUNT' && (
          <Badge variant="ok" className="ml-1.5">
            popust
          </Badge>
        )}
        {(d.ageFrom != null || d.ageTo != null) && (
          <span className="ml-1.5 text-[10px] text-ink-faint">
            uzrast {uzrast(d.ageFrom ?? 0)}–{d.ageTo != null ? uzrast(d.ageTo) : '∞'}
          </span>
        )}
        {d.appliesFrom && (
          <span className="ml-1.5 text-[10px] text-warn">
            samo {d.appliesFrom}
            {d.appliesTo && d.appliesTo !== d.appliesFrom ? ` – ${d.appliesTo}` : ''}
          </span>
        )}
        {sezona && <span className="ml-1.5 text-[10px] text-ink-faint">sezona {sezona.code}</span>}
        {greska && <div className="text-[10px] text-danger">{greska}</div>}
      </td>

      <td className="border-b border-border px-3 py-1.5 font-mono">
        {d.pricingMode === 'FLAT_PER_UNIT'
          ? `${d.flatAmount != null ? izNajmanjeJedinice(d.flatAmount) : '—'} ${currency}`
          : `${d.kind === 'DISCOUNT' ? '−' : ''}${Number(d.percentageOfNightlyRate ?? 0)} %`}
      </td>

      <td className="border-b border-border px-3 py-1.5 text-ink-faint">
        {OSNOVE_DOPLATE[d.priceBasis] ?? d.priceBasis}
      </td>

      <td className="border-b border-border px-3 py-1.5">
        <Badge variant={d.isMandatory ? 'warn' : 'secondary'}>
          {d.isMandatory ? 'obavezno' : 'opciono'}
        </Badge>
      </td>

      <td className="border-b border-border px-3 py-1.5">
        {/* Ovo nije napomena nego prekidač: odlučuje ulazi li stavka u zbir. */}
        <Badge variant={d.ulaziUZbir ? 'secondary' : 'warn'}>
          {d.ulaziUZbir ? 'agencija' : 'u hotelu'}
        </Badge>
        {!d.ulaziUZbir && <div className="text-[10px] text-ink-faint">ne ulazi u zbir</div>}
      </td>

      <td className="border-b border-border px-3 py-1.5 text-ink-faint">
        {d.appliesToRoomTypes.length === 0 ? (
          <Badge variant="ok">sve</Badge>
        ) : (
          d.appliesToRoomTypes.join(', ')
        )}
      </td>

      <td className="border-b border-border px-3 py-1.5 text-[11px] text-ink-faint">
        {d.bookingFrom || d.bookingTo ? `${d.bookingFrom ?? '…'} – ${d.bookingTo ?? '…'}` : '—'}
      </td>

      <td className="border-b border-border px-3 py-1.5 text-right">
        {canEdit && (
          <button
            type="button"
            disabled={radi}
            onClick={() =>
              start(async () => {
                const r = await ugasiDoplatu(contractId, d.id);
                if (r.error) setGreska(r.error);
              })
            }
            className="text-[11px] text-ink-faint hover:text-danger"
            title="Gašenje, ne brisanje — stavka ostaje objašnjiva za već napravljene rezervacije"
          >
            ugasi
          </button>
        )}
      </td>
    </tr>
  );
}

function NovaForma({
  contractId,
  seasons,
  tipoviSoba,
  currency,
  onKraj,
}: {
  contractId: string;
  seasons: Sezona[];
  tipoviSoba: string[];
  currency: string;
  onKraj: () => void;
}) {
  const [p, setP] = useState({
    name: '',
    kind: 'SURCHARGE',
    pricingMode: 'FLAT_PER_UNIT',
    iznos: '',
    priceBasis: 'PER_PERSON_PER_NIGHT',
    payable: 'AGENCY',
    isMandatory: 'false',
    seasonId: '',
    ageFrom: '',
    ageTo: '',
    appliesFrom: '',
    appliesTo: '',
    bookingTo: '',
  });
  const [sobe, setSobe] = useState<string[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, start] = useTransition();
  const set = (k: keyof typeof p) => (e: { target: { value: string } }) =>
    setP((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <h3 className="text-sm font-semibold text-ink">Nova doplata ili popust</h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Naziv
          <input
            value={p.name}
            onChange={set('name')}
            placeholder="Boravišna taksa — odrasli"
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Vrsta
          <select value={p.kind} onChange={set('kind')} className="input text-xs">
            <option value="SURCHARGE">Doplata</option>
            <option value="DISCOUNT">Popust</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Obračun
          <select value={p.pricingMode} onChange={set('pricingMode')} className="input text-xs">
            <option value="FLAT_PER_UNIT">Fiksan iznos</option>
            <option value="PERCENTAGE_OF_NIGHTLY_RATE">Procenat od cene</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          {p.pricingMode === 'FLAT_PER_UNIT' ? `Iznos (${currency})` : 'Procenat'}
          <input
            value={p.iznos}
            onChange={set('iznos')}
            placeholder={p.pricingMode === 'FLAT_PER_UNIT' ? '1,50' : '50'}
            className="input font-mono text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Osnova
          <select value={p.priceBasis} onChange={set('priceBasis')} className="input text-xs">
            {Object.entries(OSNOVE_DOPLATE).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Obavezno?
          <select value={p.isMandatory} onChange={set('isMandatory')} className="input text-xs">
            <option value="false">Opciono — gost bira</option>
            <option value="true">Obavezno — uvek u ceni</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Plaća se
          <select value={p.payable} onChange={set('payable')} className="input text-xs">
            <option value="AGENCY">U agenciji — ulazi u zbir</option>
            <option value="ON_SITE">U hotelu — ne ulazi u zbir</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Važi za sezonu
          <select value={p.seasonId} onChange={set('seasonId')} className="input text-xs">
            <option value="">sve sezone</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
                {s.label ? ` — ${s.label}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Uzrast od
          <input
            value={p.ageFrom}
            onChange={set('ageFrom')}
            placeholder="0"
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Uzrast do
          <input
            value={p.ageTo}
            onChange={set('ageTo')}
            placeholder="11,99"
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Važi za datume od (opciono)
          <input
            type="date"
            value={p.appliesFrom}
            onChange={set('appliesFrom')}
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          … do
          <input
            type="date"
            value={p.appliesTo}
            onChange={set('appliesTo')}
            className="input text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
          Za rezervacije do (opciono)
          <input
            type="date"
            value={p.bookingTo}
            onChange={set('bookingTo')}
            className="input text-xs"
          />
        </label>
      </div>

      <div>
        <span className="text-[11px] text-ink-faint">
          Važi za tipove soba —{' '}
          {sobe.length === 0 ? (
            <strong className="text-ink">sve</strong>
          ) : (
            <strong className="text-ink">{sobe.length} izabrano</strong>
          )}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {tipoviSoba.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSobe((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                sobe.includes(t)
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-border text-ink-faint'
              }`}
            >
              {t}
            </button>
          ))}
          {tipoviSoba.length === 0 && (
            <span className="text-[10px] text-ink-faint">
              (nema unetih tipova soba — stavka će važiti za sve)
            </span>
          )}
        </div>
      </div>

      {greska && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={radi}
          onClick={() =>
            start(async () => {
              setGreska(null);
              if (!p.name.trim()) {
                setGreska('Naziv je obavezan.');
                return;
              }
              const r = await dodajDoplatu(contractId, {
                ...p,
                appliesToRoomTypes: sobe,
              });
              if (r.error) setGreska(r.error);
              else onKraj();
            })
          }
        >
          {radi ? 'Upisujem…' : 'Dodaj'}
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

/**
 * Uzrast se ispisuje sa zarezom kao i cene — „11,99", ne „11.99".
 *
 * Sitnica, ali na istom redu stoji i iznos: dva različita decimalna znaka u istom redu
 * izgledaju kao greška u podacima, a nisu.
 */
function uzrast(v: number): string {
  return v.toLocaleString('sr-RS', { maximumFractionDigits: 2 });
}
