'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { linkContract, publishProduct, type ProductFormState } from '../actions';

// M2 spec §5.2 / M17 §6b (dopuna 9.9.2026) — dva koraka koja su do sada postojala na backendu a
// nisu imala ekran, pa se proizvod unet kroz panel NIKAD nije mogao ni vezati za ugovor ni
// objaviti; ostajao je DRAFT, a pretraga uzima samo ACTIVE.
//
// Zašto lista provera, a ne golo dugme: uslovi da se proizvod pojavi u pretrazi su lanac od pet
// karika i otkazuje bilo koja. Poruka „nešto nedostaje" tu ne pomaže — stoji stavka po stavka.
//
// TRI stepena, ne dva (M2 §5.2, ispravljeno 9.9.2026): objava znači „proizvod je vidljiv", ne
// „proizvod je prodajan". Zato ugovor i cena NE zaustavljaju objavu — oni odlučuju da li će se
// proizvod pojaviti u PRETRAZI, što je zasebno pitanje i ovde se zasebno i prikazuje.

const pocetno: ProductFormState = { error: null, ok: null };

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  /** PUBLISH = zaustavlja objavu; SEARCH = objava prolazi ali proizvoda nema u pretrazi;
   *  QUALITY = pojaviće se, ali lošije nego što može (M2 §5.2). */
  impact: 'PUBLISH' | 'SEARCH' | 'QUALITY';
  detail: string | null;
}

export interface Readiness {
  productId: string;
  status: string;
  canPublish: boolean;
  willAppearInSearch: boolean;
  checks: ReadinessCheck[];
}

const KANALI = [
  { value: 'B2C_SITE', label: 'Sajt agencije (B2C)' },
  { value: 'B2B_PORTAL', label: 'B2B portal (subagenti)' },
  { value: 'MOBILE_APP', label: 'Mobilna aplikacija' },
];

export default function PublishPanel({
  productId,
  status,
  sourceType,
  sourceContractId,
  visibleChannels,
  contracts,
  readiness,
}: {
  productId: string;
  status: string;
  sourceType: string;
  sourceContractId: string | null;
  visibleChannels: string[];
  contracts: { id: string; label: string }[];
  readiness: Readiness | null;
}) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="rocket" /> Izvor cene i objava
        </h2>
        <StatusOznaka status={status} />
      </div>

      <VezaSaUgovorom
        productId={productId}
        sourceType={sourceType}
        sourceContractId={sourceContractId}
        contracts={contracts}
      />

      {readiness ? (
        <Provere readiness={readiness} />
      ) : (
        <p className="mt-3 text-[11px] text-danger">
          Provera spremnosti trenutno nije dostupna (M2 API).
        </p>
      )}

      <Objava
        productId={productId}
        status={status}
        visibleChannels={visibleChannels}
        canPublish={readiness?.canPublish ?? false}
      />
    </div>
  );
}

function StatusOznaka({ status }: { status: string }) {
  const aktivan = status === 'ACTIVE';
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
        aktivan ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
      }`}
    >
      {aktivan ? 'ACTIVE — vidljiv u pretrazi' : `${status} — ne pojavljuje se u pretrazi`}
    </span>
  );
}

function VezaSaUgovorom({
  productId,
  sourceType,
  sourceContractId,
  contracts,
}: {
  productId: string;
  sourceType: string;
  sourceContractId: string | null;
  contracts: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(linkContract, pocetno);

  // §5.2 — proizvod iz M4 keširanja pripada provajderu, ne našem ugovoru. Umesto forme koja bi
  // svakako bila odbijena, stoji rečenica koja kaže zašto.
  if (sourceType !== 'CONTRACTED') {
    return (
      <p className="rounded bg-sunken p-2 text-[11px] text-ink-faint">
        Cene ovog proizvoda dolaze od spoljnog provajdera ({sourceType}) — ne vezuje se za naš
        ugovor.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Poruke state={state} />
      <input type="hidden" name="productId" value={productId} />
      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Ugovor iz kog se uzimaju cene
        <select name="sourceContractId" defaultValue={sourceContractId ?? ''} className="input">
          <option value="">— nije vezan —</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <Posalji label="Sačuvaj vezu sa ugovorom" size="sm" varijanta="outline" />
    </form>
  );
}

function Provere({ readiness }: { readiness: Readiness }) {
  const prepreke = readiness.checks.filter((c) => c.blocking && !c.ok);
  const kvalitet = readiness.checks.filter((c) => !c.ok && c.impact === 'QUALITY');

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Stanje proizvoda
      </div>
      <ul className="flex flex-col gap-1">
        {readiness.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-[11px]">
            <span
              className={`mt-0.5 flex-shrink-0 ${
                c.ok ? 'text-ok' : c.blocking ? 'text-danger' : 'text-warn'
              }`}
            >
              <Icon name={c.ok ? 'pass' : c.blocking ? 'error' : 'warning'} />
            </span>
            <span className="min-w-0">
              <span className={c.ok ? 'text-ink-dim' : 'text-ink'}>{c.label}</span>
              {!c.ok && <span className="text-ink-faint"> — {OZNAKA[c.impact]}</span>}
              {c.detail && <span className="block text-ink-faint">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* Dve rečenice koje se ne smeju spojiti: „ne može da se objavi" i „objavljen je ali ga
          pretraga ne prikazuje" su različita stanja sa različitim nastavkom rada. */}
      {prepreke.length > 0 && (
        <p className="mt-2 rounded bg-danger-bg p-2 text-[11px] text-danger">
          Objava nije moguća dok se ne reši {prepreke.length === 1 ? 'stavka' : 'stavke'} označena
          crvenom.
        </p>
      )}
      {prepreke.length === 0 && !readiness.willAppearInSearch && (
        <p className="mt-2 rounded bg-warn-bg p-2 text-[11px] text-warn">
          Proizvod može da se objavi, ali se <strong>neće pojaviti u pretrazi</strong> dok ne dobije
          ugovor, cenu i maržu.
        </p>
      )}
      {prepreke.length === 0 && readiness.willAppearInSearch && kvalitet.length > 0 && (
        <p className="mt-2 rounded bg-warn-bg p-2 text-[11px] text-warn">
          Pojaviće se u pretrazi, ali {kvalitet.length === 1 ? 'jedna stvar' : 'neke stvari'} neće
          raditi najbolje — vidi žute stavke.
        </p>
      )}
      {prepreke.length === 0 && readiness.willAppearInSearch && kvalitet.length === 0 && (
        <p className="mt-2 rounded bg-ok-bg p-2 text-[11px] text-ok">
          Sve je na mestu — proizvod se prikazuje u pretrazi sa cenom.
        </p>
      )}
    </div>
  );
}

const OZNAKA: Record<ReadinessCheck['impact'], string> = {
  PUBLISH: 'zaustavlja objavu',
  SEARCH: 'proizvod se neće pojaviti u pretrazi',
  QUALITY: 'ne blokira ništa, ali radi lošije',
};

function Objava({
  productId,
  status,
  visibleChannels,
  canPublish,
}: {
  productId: string;
  status: string;
  visibleChannels: string[];
  canPublish: boolean;
}) {
  const [state, formAction] = useActionState(publishProduct, pocetno);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <Poruke state={state} />
      <input type="hidden" name="productId" value={productId} />
      <div className="text-[11px] text-ink-faint">Kanali na kojima je proizvod vidljiv</div>
      <div className="flex flex-wrap gap-3">
        {KANALI.map((k) => (
          <label key={k.value} className="flex items-center gap-1.5 text-[11px] text-ink">
            <input
              type="checkbox"
              name="visibleChannels"
              value={k.value}
              defaultChecked={visibleChannels.includes(k.value)}
            />
            {k.label}
          </label>
        ))}
      </div>
      {/* Interni tim vidi svaki ACTIVE proizvod bez obzira na ova polja (M2 §5.1) — bez ove
          rečenice se prazan izbor čita kao „niko ga neće videti", što nije tačno. */}
      <p className="text-[10px] text-ink-faint">
        Interni tim vidi svaki objavljen proizvod u pretrazi panela bez obzira na ovaj izbor; ova
        polja kontrolišu samo sajt, B2B portal i mobilnu aplikaciju.
      </p>
      <Posalji
        label={status === 'ACTIVE' ? 'Sačuvaj kanale' : 'Objavi proizvod'}
        disabled={status !== 'ACTIVE' && !canPublish}
      />
    </form>
  );
}

function Poruke({ state }: { state: ProductFormState }) {
  return (
    <>
      {state.error && (
        <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded bg-ok-bg p-2 text-[11px] text-ok">{state.ok}</p>}
    </>
  );
}

function Posalji({
  label,
  disabled,
  size = 'sm',
  varijanta,
}: {
  label: string;
  disabled?: boolean;
  size?: 'sm';
  varijanta?: 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size={size}
      variant={varijanta}
      disabled={pending || disabled}
      className="self-start"
    >
      {pending ? 'Čuvam…' : label}
    </Button>
  );
}
