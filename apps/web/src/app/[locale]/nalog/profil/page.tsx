import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import type { ClientAccount } from '@/lib/types';
import { updateProfileAction } from './actions';

// M6 spec §7 dopuna — GET /crm/client-accounts vraća samo [sopstveni nalog] za Gosta
// (ClientAccountsService.findMany ownership, avgust 2026).
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.profile' });

  const session = await getSession();
  if (!session) redirect(`/${locale}/nalog/prijava`);

  const accounts = await apiFetch<ClientAccount[]>('/crm/client-accounts', { requireAuth: true }).catch(() => []);
  const account = accounts[0];

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      {account && (
        <form action={updateProfileAction} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="accountId" value={account.id} />
          <label className="text-sm">
            {t('fullName')}
            <input name="fullName" defaultValue={account.fullName ?? ''} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            {t('email')}
            <input name="email" defaultValue={account.email ?? ''} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            {t('phone')}
            <input name="phone" defaultValue={account.phone ?? ''} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" defaultChecked={account.marketingConsent} />
            {t('marketingConsent')}
          </label>
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
            {t('save')}
          </button>
        </form>
      )}
    </div>
  );
}
