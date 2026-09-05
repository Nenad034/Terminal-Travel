import { redirect } from 'next/navigation';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NewArticleForm from './NewArticleForm';


// M23 spec §2.1/§8 — POST /knowledge/articles zahteva M23/article/EDIT.
export default async function NoviClanakPage() {
  const me = await getMe();
  if (!hasPermission(me, 'M23', 'article', 'EDIT')) redirect('/znanje');

  return (
    <div className="p-6">
      <RegisterTab label="Nov članak" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Nov članak</h1>
      <NewArticleForm />
    </div>
  );
}
