import RegisterTab from '@/components/RegisterTab';
import NewSupplierForm from './NewSupplierForm';


export default function NewSupplierPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Novi dobavljač" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi dobavljač</h1>
      <NewSupplierForm />
    </div>
  );
}
