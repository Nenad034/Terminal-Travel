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
    suppliers = await apiFetch<Supplier[]>('/contracting/suppliers');
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
