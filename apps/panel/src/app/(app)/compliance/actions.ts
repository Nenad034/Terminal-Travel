'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

// M11 spec §5 — POST /travel-guarantee-registrations/:id/retry, dozvola
// M11/travel-guarantee-registration/RETRY (Vlasnik, Direktor).
export async function retryRegistration(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/compliance/travel-guarantee-registrations/${id}/retry`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Ponavljanje registracije nije uspelo.' };
  }
  revalidatePath('/compliance');
  return { error: null };
}

// M11 spec §2.1 — PATCH /travel-guarantee je uvek ljudska radnja ("Nikad autonomno" iz
// poglavlja 7 Master dokumenta) — obnavljanje ili izmena postojeće garancije.
export async function updateGuarantee(_prev: FormState, formData: FormData): Promise<FormState> {
  const createNew = formData.get('createNew') === 'on';
  try {
    await apiFetch('/compliance/travel-guarantee', {
      method: 'PATCH',
      body: {
        createNew,
        provider: formData.get('provider') || undefined,
        policyNumber: formData.get('policyNumber') || undefined,
        coverageAmount: formData.get('coverageAmount') ? Number(formData.get('coverageAmount')) * 100 : undefined,
        currency: formData.get('currency') || undefined,
        validFrom: formData.get('validFrom') || undefined,
        validTo: formData.get('validTo') || undefined,
        documentUrl: formData.get('documentUrl') || undefined,
        status: formData.get('status') || undefined,
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena garancije putovanja nije uspela.' };
  }
  revalidatePath('/compliance');
  redirect('/compliance');
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
