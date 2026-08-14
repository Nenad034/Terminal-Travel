import RegisterTab from '@/components/RegisterTab';
import NewProductForm from './NewProductForm';

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <RegisterTab label="Novi proizvod" />
      <h1 className="mb-4 font-mono text-lg">
        <span className="text-accent">$</span> novi_proizvod
      </h1>
      <NewProductForm />
    </div>
  );
}
