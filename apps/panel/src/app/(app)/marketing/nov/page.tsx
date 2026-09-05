import RegisterTab from '@/components/RegisterTab';
import NewContentForm from './NewContentForm';


// M17 spec §4/§7 (Faza 6) — ručno kreiranje sadržaja (generated_by uvek HUMAN kroz ovaj ekran,
// M12 spec §7 napomena u DTO-u). AI nacrti nastaju automatski kroz M2 product.published (§3).
export default function NoviSadrzajPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Nov sadržaj" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Nov sadržaj</h1>
      <NewContentForm />
    </div>
  );
}
