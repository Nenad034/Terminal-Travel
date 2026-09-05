import RegisterTab from '@/components/RegisterTab';
import NewGuestProfileForm from './NewGuestProfileForm';


export default async function NewGuestProfilePage(props: { searchParams: Promise<{ linkedClientAccountId?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="p-6">
      <RegisterTab label="Novi gost" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi gost</h1>
      <NewGuestProfileForm linkedClientAccountId={searchParams?.linkedClientAccountId} />
    </div>
  );
}
