'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

export async function createSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/contracting/suppliers', {
      method: 'POST',
      body: {
        name: formData.get('name'),
        type: formData.get('type'),
        taxId: formData.get('taxId'),
        registrationNumber: formData.get('registrationNumber'),
        country: formData.get('country'),
        contactName: formData.get('contactName'),
        contactEmail: formData.get('contactEmail'),
        contactPhone: formData.get('contactPhone'),
      },
    });
    revalidatePath('/dobavljaci');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje dobavljača nije uspelo.' };
  }
  redirect('/dobavljaci');
}

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/contracting/contracts', {
      method: 'POST',
      body: {
        supplierId: formData.get('supplierId'),
        contractNumber: formData.get('contractNumber'),
        currency: formData.get('currency'),
        validFrom: formData.get('validFrom'),
        validTo: formData.get('validTo'),
        cancellationTermsSummary: formData.get('cancellationTermsSummary'),
        documentUrl: formData.get('documentUrl'),
      },
    });
    revalidatePath('/ugovori');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje ugovora nije uspelo.' };
  }
  redirect('/ugovori');
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
