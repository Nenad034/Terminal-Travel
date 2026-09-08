import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import NewContractForm from './NewContractForm';

interface Supplier {
  id: string;
  name: string;
}

export default async function NewContractPage() {
  let suppliers: Supplier[] = [];
  try {
    // Razvrstavanje 8.9.2026 (dok. 27) — padajuća lista, ne browse ekran; `limit=200` tvrd
    // plafon (nedostupan dobavljač u formi je gori kvar nego browse ekran bez kraja liste).
    suppliers = (await apiFetch<{ data: Supplier[] }>('/contracting/suppliers?limit=200')).data;
  } catch {
    // formular i dalje radi (biće greška pri čuvanju ako korisnik nema pravo pristupa) —
    // ne blokiramo prikaz stranice zbog neuspešnog povlačenja liste dobavljača.
  }

  return (
    <div className="p-6">
      <RegisterTab label="Novi ugovor" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi ugovor</h1>
      <NewContractForm suppliers={suppliers} />
    </div>
  );
}
