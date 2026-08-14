import RegisterTab from '@/components/RegisterTab';
import NewSupplierForm from './NewSupplierForm';

export default function NewSupplierPage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <RegisterTab label="Novi dobavljač" />
      <h1 className="mb-4 font-mono text-lg">
        <span className="text-accent">$</span> novi_dobavljac
      </h1>
      <NewSupplierForm />
    </div>
  );
}
