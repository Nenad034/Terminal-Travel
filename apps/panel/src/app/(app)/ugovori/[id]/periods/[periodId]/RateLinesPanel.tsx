'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addRateLine, replaceRateLine, deactivateRateLine, FormState } from '../../../actions';
import { ButtonGroup } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/Icon';
import AgePricingFields from './AgePricingFields';

const initialState: FormState = { error: null };

export type PriceBasis = 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT';
export type AgePricingMode = 'PERCENTAGE_OF_BASE_PRICE' | 'FLAT_PRICE_PER_NIGHT';

export interface AgePricingEntry {
  ageCategory: string;
  occupantIndex: number | null;
  minAdultsPresent: number | null;
  pricingMode: AgePricingMode;
  percentage: number | null;
  flatPrice: number | null;
}

export interface RateLine {
  id: string;
  boardType: string;
  occupancy: string;
  priceBasis: PriceBasis;
  price: number;
  cribFeePerNight: number | null;
  agePricing: AgePricingEntry[];
  /** M3 §2.4c (v1.25) — ugašena stavka se ne prodaje, ali ostaje vidljiva. */
  status?: 'ACTIVE' | 'INACTIVE';
  deactivatedAt?: string | null;
  replacesId?: string | null;
}

const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  PER_ROOM_PER_NIGHT: 'po sobi/noć',
  PER_PERSON_PER_NIGHT: 'po osobi/noć',
};

// M3 spec §2.4/§2.4a/§2.4c.
//
// Do 9.9.2026 je ovaj ekran umeo SAMO da doda cenovnu stavku: backend nije imao ni izmenu ni
// brisanje, pa se pogrešno ukucana cena nije mogla povući — a pretraga od svake cenovne linije
// pravi zasebnu ponudu, dakle pogrešna cena je ostajala prodajna uporedo sa ispravnom.
//
// Sada (§2.4c, vlasnikova odluka): ispravka je GAŠENJE stare i UPIS nove, nikad prepisivanje
// vrednosti — cena je finansijski podatak i posle izmene mora ostati odgovor po kojoj je ceni
// nešto prodato. Ugašena stavka se NE sklanja sa ekrana (nestanak reda čita se kao „nikad nije
// ni postojao"), nego stoji prigušena, sa oznakom.
//
// `age_pricing[]` (cena po uzrastu) je dobio polja u istom prolazu — vidi `AgePricingFields.tsx`.
export default function RateLinesPanel({
  contractId,
  periodId,
  rateLines,
  canEdit,
}: {
  contractId: string;
  periodId: string;
  rateLines: RateLine[];
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [ispravlja, setIspravlja] = useState<RateLine | null>(null);

  const aktivne = rateLines.filter((r) => r.status !== 'INACTIVE');
  const ugasene = rateLines.filter((r) => r.status === 'INACTIVE');

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Cenovne stavke</h2>
        {canEdit && (
          <Button
            onClick={() => {
              setIspravlja(null);
              setShowForm((v) => !v);
            }}
            size="sm"
          >
            {showForm ? 'Zatvori' : '+ Dodaj'}
          </Button>
        )}
      </div>

      {rateLines.length === 0 && (
        <p className="text-xs text-ink-faint">Nijedna cenovna stavka još nije uneta.</p>
      )}

      <div className="flex flex-col gap-1.5 text-xs">
        {aktivne.map((r) => (
          <Stavka
            key={r.id}
            r={r}
            canEdit={canEdit}
            contractId={contractId}
            periodId={periodId}
            onIspravi={() => {
              setIspravlja(r);
              setShowForm(false);
            }}
          />
        ))}
      </div>

      {ugasene.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">
            Ugašene stavke ({ugasene.length}) — ne prodaju se, čuvaju se radi istorije cene
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            {ugasene.map((r) => (
              <Stavka
                key={r.id}
                r={r}
                canEdit={false}
                contractId={contractId}
                periodId={periodId}
                onIspravi={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {ispravlja && canEdit && (
        <IspravkaForma
          contractId={contractId}
          periodId={periodId}
          stavka={ispravlja}
          onOtkazi={() => setIspravlja(null)}
        />
      )}

      {showForm && canEdit && <DodajFormu contractId={contractId} periodId={periodId} />}
    </div>
  );
}

function Stavka({
  r,
  canEdit,
  contractId,
  periodId,
  onIspravi,
}: {
  r: RateLine;
  canEdit: boolean;
  contractId: string;
  periodId: string;
  onIspravi: () => void;
}) {
  const ugasena = r.status === 'INACTIVE';
  return (
    <div
      className={`rounded border border-border px-3 py-2 ${
        ugasena ? 'bg-sunken opacity-60' : 'bg-panel2'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{r.boardType}</span>
        <span className="flex items-center gap-1.5">
          {ugasena && <Badge variant="secondary">ugašena</Badge>}
          <Badge variant="secondary">{PRICE_BASIS_LABELS[r.priceBasis]}</Badge>
          {canEdit && (
            <>
              <button
                type="button"
                title="Ispravi — gasi ovu stavku i upisuje novu, uz trag o izmeni"
                onClick={onIspravi}
                className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:text-accent-strong"
              >
                <Icon name="edit" />
              </button>
              <UgasiDugme contractId={contractId} periodId={periodId} rateLineId={r.id} />
            </>
          )}
        </span>
      </div>
      <div className="mt-0.5 text-ink-faint">
        {r.occupancy} · {r.price}
        {r.cribFeePerNight != null && ` · krevetac +${r.cribFeePerNight}/noć`}
        {ugasena &&
          r.deactivatedAt &&
          ` · ugašena ${new Date(r.deactivatedAt).toLocaleDateString('sr-RS')}`}
        {r.replacesId && ' · ispravka ranije stavke'}
      </div>
      {r.agePricing.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {r.agePricing.map((ap, i) => (
            <Badge key={i} variant="outline">
              {ap.ageCategory}:{' '}
              {ap.pricingMode === 'PERCENTAGE_OF_BASE_PRICE'
                ? `${ap.percentage}%`
                : `${ap.flatPrice}`}
              {ap.minAdultsPresent != null && ` (uz ${ap.minAdultsPresent}+ odraslih)`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** §2.4c — gašenje, ne brisanje. Potvrda stoji jer je posledica trenutna: cena prestaje da se prodaje. */
function UgasiDugme({
  contractId,
  periodId,
  rateLineId,
}: {
  contractId: string;
  periodId: string;
  rateLineId: string;
}) {
  const [potvrda, setPotvrda] = useState(false);
  const [radi, setRadi] = useState(false);

  if (potvrda) {
    return (
      <span className="flex items-center gap-1 text-[10px]">
        <button
          type="button"
          disabled={radi}
          onClick={async () => {
            setRadi(true);
            await deactivateRateLine(contractId, periodId, rateLineId);
          }}
          className="rounded bg-danger px-1.5 py-0.5 font-medium text-white"
        >
          {radi ? 'Gasim…' : 'Ugasi'}
        </button>
        <button type="button" onClick={() => setPotvrda(false)} className="text-ink-faint">
          odustani
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      title="Ugasi — stavka prestaje da se prodaje, ali ostaje zabeležena"
      onClick={() => setPotvrda(true)}
      className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:text-danger"
    >
      <Icon name="circle-slash" />
    </button>
  );
}

function DodajFormu({ contractId, periodId }: { contractId: string; periodId: string }) {
  const boundAction = addRateLine.bind(null, contractId, periodId);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    <Forma
      naslov="Nova cenovna stavka"
      state={state}
      formAction={formAction}
      dugme="Sačuvaj cenovnu stavku"
    />
  );
}

function IspravkaForma({
  contractId,
  periodId,
  stavka,
  onOtkazi,
}: {
  contractId: string;
  periodId: string;
  stavka: RateLine;
  onOtkazi: () => void;
}) {
  const boundAction = replaceRateLine.bind(null, contractId, periodId, stavka.id);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    <Forma
      naslov={`Ispravka stavke „${stavka.boardType}"`}
      state={state}
      formAction={formAction}
      dugme="Sačuvaj ispravku"
      pocetna={stavka}
      onOtkazi={onOtkazi}
    />
  );
}

function Forma({
  naslov,
  state,
  formAction,
  dugme,
  pocetna,
  onOtkazi,
}: {
  naslov: string;
  state: FormState;
  formAction: (formData: FormData) => void;
  dugme: string;
  pocetna?: RateLine;
  onOtkazi?: () => void;
}) {
  const [priceBasis, setPriceBasis] = useState<PriceBasis>(
    pocetna?.priceBasis ?? 'PER_ROOM_PER_NIGHT',
  );

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink">{naslov}</span>
        {onOtkazi && (
          <button
            type="button"
            onClick={onOtkazi}
            className="text-[11px] text-ink-faint hover:underline"
          >
            odustani
          </button>
        )}
      </div>
      {pocetna && (
        <p className="rounded bg-warn-bg p-2 text-[10px] text-warn">
          Stara stavka se gasi i ostaje zabeležena; upisuje se nova sa ovim vrednostima. Već
          potvrđene rezervacije se ne menjaju.
        </p>
      )}
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

      <Field label="Tip usluge (board type)">
        <input
          name="boardType"
          required
          defaultValue={pocetna?.boardType}
          className="input"
          placeholder="npr. polupansion, all-inclusive"
        />
      </Field>
      <Field label="Popunjenost na koju se cena odnosi">
        <input
          name="occupancy"
          required
          defaultValue={pocetna?.occupancy}
          className="input"
          placeholder="npr. odrasla osoba u dvokrevetnoj"
        />
      </Field>
      <Field label="Osnova cene">
        <input type="hidden" name="priceBasis" value={priceBasis} />
        <ButtonGroup
          value={priceBasis}
          onChange={setPriceBasis}
          options={(Object.keys(PRICE_BASIS_LABELS) as PriceBasis[]).map((v) => ({
            value: v,
            label: PRICE_BASIS_LABELS[v],
          }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cena (u najmanjoj jedinici valute ugovora)">
          <input
            name="price"
            type="number"
            min={0}
            required
            defaultValue={pocetna?.price}
            className="input"
          />
        </Field>
        <Field label="Doplata za krevetac po noći (opciono)">
          <input
            name="cribFeePerNight"
            type="number"
            min={0}
            defaultValue={pocetna?.cribFeePerNight ?? undefined}
            className="input"
          />
        </Field>
      </div>

      <AgePricingFields initial={pocetna?.agePricing} />

      <SubmitButton label={dugme} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Čuvanje…' : label}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
