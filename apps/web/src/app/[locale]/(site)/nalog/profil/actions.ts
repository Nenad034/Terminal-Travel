'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

export async function updateProfileAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale'));
  const accountId = String(formData.get('accountId'));

  await apiFetch(`/crm/client-accounts/${accountId}`, {
    method: 'PATCH',
    body: {
      fullName: formData.get('fullName') || undefined,
      email: formData.get('email') || undefined,
      phone: formData.get('phone') || undefined,
      marketingConsent: formData.get('marketingConsent') === 'on',
    },
  });

  redirect(`/${locale}/nalog/profil`);
}
