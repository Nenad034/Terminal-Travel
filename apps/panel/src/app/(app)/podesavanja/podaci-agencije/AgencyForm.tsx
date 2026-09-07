'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateAgencySettings, type FormState } from './actions';

const initialState: FormState = { error: null, ok: false };

export interface AgencyData {
  brandName: string;
  legalName: string | null;
  address: string | null;
  taxId: string | null;
  licenseNumber: string | null;
  emergencyContact: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

function Polje({
  ime,
  naslov,
  vrednost,
  opis,
  obavezno,
}: {
  ime: keyof AgencyData;
  naslov: string;
  vrednost: string | null;
  opis?: string;
  obavezno?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink">
        {naslov}
        {obavezno && <span className="text-danger"> *</span>}
      </span>
      <input
        name={ime}
        defaultValue={vrednost ?? ''}
        required={obavezno}
        className="input mt-1 w-full"
      />
      {opis && <span className="mt-1 block text-[11px] text-ink-faint">{opis}</span>}
    </label>
  );
}

export default function AgencyForm({ podaci }: { podaci: AgencyData }) {
  const [state, formAction] = useActionState(updateAgencySettings, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="rounded bg-danger-bg p-3 text-xs text-danger">{state.error}</p>}
      {state.ok && (
        <p className="rounded bg-ok-bg p-3 text-xs text-ok">
          Sačuvano. Novo ime se odmah vidi u panelu i na sajtu.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Polje
          ime="brandName"
          naslov="Naziv agencije"
          vrednost={podaci.brandName}
          obavezno
          opis="Ime koje gost vidi — naslov stranica, podnožje sajta, zaglavlje panela."
        />
        <Polje
          ime="legalName"
          naslov="Pun pravni naziv"
          vrednost={podaci.legalName}
          opis="Popunite samo ako se razlikuje od naziva iznad. Ovo ime ide na ugovor sa gostom."
        />
        <Polje
          ime="address"
          naslov="Adresa"
          vrednost={podaci.address}
          opis="Štampa se na ugovoru."
        />
        <Polje ime="taxId" naslov="PIB" vrednost={podaci.taxId} opis="Potreban za fiskalizaciju." />
        <Polje
          ime="licenseNumber"
          naslov="Broj licence"
          vrednost={podaci.licenseNumber}
          opis="Licenca organizatora putovanja — zakonski obavezna na ugovoru."
        />
        <Polje
          ime="emergencyContact"
          naslov="Kontakt za hitne slučajeve"
          vrednost={podaci.emergencyContact}
          opis="Broj koji gost zove sa puta. Štampa se na ugovoru."
        />
        <Polje ime="email" naslov="Email" vrednost={podaci.email} />
        <Polje ime="phone" naslov="Telefon" vrednost={podaci.phone} />
        <Polje ime="website" naslov="Sajt" vrednost={podaci.website} />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-brand px-4 py-2 text-xs font-medium text-brand-ink hover:brightness-90 disabled:opacity-50"
    >
      {pending ? 'Čuvam…' : 'Sačuvaj'}
    </button>
  );
}
