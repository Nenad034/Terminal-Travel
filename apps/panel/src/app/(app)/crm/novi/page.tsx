import RegisterTab from '@/components/RegisterTab';
import NewClientAccountForm from './NewClientAccountForm';


export default function NewClientAccountPage() {
  return (
    <div className="p-6">
      <RegisterTab label="Novi nalogodavac" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi nalogodavac</h1>
      <NewClientAccountForm />
    </div>
  );
}
