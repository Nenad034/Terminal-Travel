import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import DestinationProfilesEditor, { type DestinationProfile } from './DestinationProfilesEditor';

// M2 spec §2.1c (dopuna 5.9.2026) — `GET /catalog/destination-profiles` (backend commit 351b2fd).
// Lista je realno na desetine zapisa (jedan po destinaciji, ne po proizvodu), isti obrazac kao
// `apps/panel/.../katalog/page.tsx` — čita se jednom, ceo CRUD ide kroz klijentsku komponentu.
export default async function DestinationProfilesPage() {
  let profiles: DestinationProfile[] = [];
  let error: string | null = null;
  try {
    profiles = await apiFetch<DestinationProfile[]>('/catalog/destination-profiles');
  } catch {
    error = 'Nemate dozvolu za uvid u profile destinacija (M2/destination-profile/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Profili destinacija" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> ls katalog/destinacije/
      </h1>
      <p className="mb-4 text-xs text-ink-dim">
        Tip destinacije (primorska/planinska/…) i podržane aktivnosti, tagovano po mestu — ulaz za M5 kontekstualne filtere i pretragu po
        aktivnosti (M2 spec §2.1c).
      </p>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {!error && <DestinationProfilesEditor initial={profiles} />}
    </div>
  );
}
