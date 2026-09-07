import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import AgencyForm, { type AgencyData } from './AgencyForm';

// M1 spec §3.9c (7.9.2026, na zahtev vlasnika) — identitet agencije na jednom mestu.
// Povod: naziv "Terminal Travel" bio je zakucan na ~50 mesta u kodu, pa se nije mogao promeniti
// bez izmene koda. Čitanje je otvoreno svakom prijavljenom nalogu (isti obrazac kao poslovnice),
// izmena traži `M1/agency-settings/EDIT` — polja završavaju na ugovoru sa gostom (M20 §2.3).
export default async function PodaciAgencijePage() {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M1', 'agency-settings', 'EDIT');

  let podaci: AgencyData | null = null;
  let error: string | null = null;
  try {
    podaci = await apiFetch<AgencyData>('/iam/agency-settings');
  } catch {
    error = 'Učitavanje podataka agencije nije uspelo.';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Podaci agencije" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Podaci agencije</h1>
      <p className="mb-4 max-w-2xl text-xs text-ink-faint">
        Naziv, adresa i licenca upisani ovde koriste se svuda: u zaglavlju panela, na javnom sajtu i
        na ugovoru koji gost potpisuje. Promena imena ovde menja ga na svim tim mestima odjednom —
        ne treba dirati kod.
      </p>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && podaci && (
        <div className="max-w-3xl rounded-lg border border-border bg-panel p-4">
          {canEdit ? (
            <AgencyForm podaci={podaci} />
          ) : (
            <>
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                {(
                  [
                    ['Naziv agencije', podaci.brandName],
                    ['Pun pravni naziv', podaci.legalName],
                    ['Adresa', podaci.address],
                    ['PIB', podaci.taxId],
                    ['Broj licence', podaci.licenseNumber],
                    ['Kontakt za hitne slučajeve', podaci.emergencyContact],
                    ['Email', podaci.email],
                    ['Telefon', podaci.phone],
                    ['Sajt', podaci.website],
                  ] as const
                ).map(([naslov, vrednost]) => (
                  <div key={naslov}>
                    <dt className="font-medium text-ink">{naslov}</dt>
                    <dd className="text-ink-faint">{vrednost || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-border pt-3 text-xs text-ink-faint">
                Nemate dozvolu za izmenu (M1/agency-settings/EDIT) — menjaju je Vlasnik i Direktor,
                jer ovi podaci stoje na zakonski obavezujućem ugovoru sa gostom.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
