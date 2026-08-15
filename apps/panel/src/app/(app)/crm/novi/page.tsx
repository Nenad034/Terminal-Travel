import RegisterTab from '@/components/RegisterTab';
import NewClientAccountForm from './NewClientAccountForm';

export default function NewClientAccountPage() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <RegisterTab label="Novi nalogodavac" />
      <h1 className="mb-4 font-mono text-lg">
        <span className="text-accent">$</span> novi_nalogodavac
      </h1>
      <NewClientAccountForm />
    </div>
  );
}
