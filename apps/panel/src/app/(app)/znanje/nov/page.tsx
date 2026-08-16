import { redirect } from 'next/navigation';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NewArticleForm from './NewArticleForm';

// M23 spec §2.1/§8 — POST /knowledge/articles zahteva M23/article/EDIT.
export default async function NoviClanakPage() {
  const me = await getMe();
  if (!hasPermission(me, 'M23', 'article', 'EDIT')) redirect('/znanje');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <RegisterTab label="Nov članak" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> znanje/clanci/nov
      </h1>
      <p className="mb-4 text-xs text-ink-dim">
        Kreira se kao DRAFT (M23 spec §2.1). Prazan članak je takođe validan — može se popuniti kasnije kroz reviziju.
      </p>
      <NewArticleForm />
    </div>
  );
}
