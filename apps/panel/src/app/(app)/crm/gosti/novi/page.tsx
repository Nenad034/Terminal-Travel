import RegisterTab from '@/components/RegisterTab';
import NewGuestProfileForm from './NewGuestProfileForm';

export default function NewGuestProfilePage({ searchParams }: { searchParams: { linkedClientAccountId?: string } }) {
  return (
    <div className="p-6">
      <RegisterTab label="Novi gost" />
      <h1 className="mb-4 font-mono text-lg">
        <span className="text-accent">$</span> novi_gost
      </h1>
      <NewGuestProfileForm linkedClientAccountId={searchParams?.linkedClientAccountId} />
    </div>
  );
}
