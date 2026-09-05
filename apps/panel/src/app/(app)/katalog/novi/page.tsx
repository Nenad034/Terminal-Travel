import RegisterTab from '@/components/RegisterTab';
import NewProductForm from './NewProductForm';


export default function NewProductPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Novi proizvod" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi proizvod</h1>
      <NewProductForm />
    </div>
  );
}
