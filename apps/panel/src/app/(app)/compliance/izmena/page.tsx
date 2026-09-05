import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import UpdateGuaranteeForm from './UpdateGuaranteeForm';


interface TravelGuarantee {
  id: string;
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  currency: string;
  validFrom: string;
  validTo: string;
  documentUrl: string | null;
  status: string;
}

// M11 spec §2.1 — PATCH /travel-guarantee je uvek ljudska radnja ("Nikad autonomno").
export default async function UpdateGuaranteePage() {
  let guarantee: TravelGuarantee | null = null;
  try {
    guarantee = await apiFetch<TravelGuarantee | null>('/compliance/travel-guarantee');
  } catch {
    // formular i dalje radi (pokušaj čuvanja će vratiti grešku ako korisnik nema pravo pristupa)
  }

  return (
    <div className="p-6">
      <RegisterTab label="Izmena garancije" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Izmena garancije</h1>
      <UpdateGuaranteeForm guarantee={guarantee} />
    </div>
  );
}
