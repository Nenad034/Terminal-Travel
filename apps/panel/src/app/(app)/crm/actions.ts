'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

// M6 spec §2.1 — POST /client-accounts.
export async function createClientAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  let account: { id: string };
  try {
    account = await apiFetch<{ id: string }>('/crm/client-accounts', {
      method: 'POST',
      body: {
        accountType: str(formData, 'accountType'),
        fullName: str(formData, 'fullName'),
        companyName: str(formData, 'companyName'),
        taxId: str(formData, 'taxId'),
        email: str(formData, 'email'),
        phone: str(formData, 'phone'),
        address: str(formData, 'address'),
        country: str(formData, 'country'),
        preferredLanguage: str(formData, 'preferredLanguage'),
        marketingConsent: formData.get('marketingConsent') === 'on',
        tags: str(formData, 'tags')
          ? str(formData, 'tags')!
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje nalogodavca nije uspelo.' };
  }
  revalidatePath('/crm');
  redirect(`/crm/${account.id}`);
}

// M6 spec §2.1 — PATCH /client-accounts/:id. Sva polja opciona.
export async function updateClientAccount(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/crm/client-accounts/${id}`, {
      method: 'PATCH',
      body: {
        accountType: str(formData, 'accountType'),
        fullName: str(formData, 'fullName'),
        companyName: str(formData, 'companyName'),
        taxId: str(formData, 'taxId'),
        email: str(formData, 'email'),
        phone: str(formData, 'phone'),
        address: str(formData, 'address'),
        country: str(formData, 'country'),
        preferredLanguage: str(formData, 'preferredLanguage'),
        marketingConsent: formData.get('marketingConsent') === 'on',
        tags: str(formData, 'tags')
          ? str(formData, 'tags')!
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena nalogodavca nije uspela.' };
  }
  revalidatePath(`/crm/${id}`);
  revalidatePath('/crm');
  return { error: null };
}

// M6 spec §2.2 — POST /guest-profiles.
export async function createGuestProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  let profile: { id: string };
  try {
    profile = await apiFetch<{ id: string }>('/crm/guest-profiles', {
      method: 'POST',
      body: {
        fullName: str(formData, 'fullName'),
        documentType: str(formData, 'documentType'),
        documentNumber: str(formData, 'documentNumber'),
        nationality: str(formData, 'nationality'),
        dateOfBirth: str(formData, 'dateOfBirth'),
        email: str(formData, 'email'),
        phone: str(formData, 'phone'),
        linkedClientAccountId: str(formData, 'linkedClientAccountId'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje profila gosta nije uspelo.' };
  }
  revalidatePath('/crm/gosti');
  redirect(`/crm/gosti/${profile.id}`);
}

// M6 spec §2.2 — PATCH /guest-profiles/:id. Sva polja opciona.
export async function updateGuestProfile(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/crm/guest-profiles/${id}`, {
      method: 'PATCH',
      body: {
        fullName: str(formData, 'fullName'),
        documentType: str(formData, 'documentType'),
        documentNumber: str(formData, 'documentNumber'),
        nationality: str(formData, 'nationality'),
        dateOfBirth: str(formData, 'dateOfBirth'),
        email: str(formData, 'email'),
        phone: str(formData, 'phone'),
        linkedClientAccountId: str(formData, 'linkedClientAccountId'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena profila gosta nije uspela.' };
  }
  revalidatePath(`/crm/gosti/${id}`);
  revalidatePath('/crm/gosti');
  return { error: null };
}

// M6 spec §3.2 — POST /loyalty-status/:clientAccountId/override. Razlog obavezan.
export async function overrideLoyaltyStatus(clientAccountId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/crm/loyalty-status/${clientAccountId}/override`, {
      method: 'POST',
      body: {
        tierId: str(formData, 'tierId'),
        reason: str(formData, 'reason'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Ručna dodela nivoa nije uspela.' };
  }
  revalidatePath(`/crm/${clientAccountId}`);
  return { error: null };
}

// M6 spec §4.1 — POST /communication-log. Bar jedno od clientAccountId/guestProfileId mora
// biti popunjeno; ovde uvek jedno od dva prosleđeno sa stranice profila.
export async function createCommunicationLog(
  target: { clientAccountId?: string; guestProfileId?: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch('/crm/communication-log', {
      method: 'POST',
      body: {
        clientAccountId: target.clientAccountId,
        guestProfileId: target.guestProfileId,
        channel: str(formData, 'channel'),
        direction: str(formData, 'direction'),
        summary: str(formData, 'summary'),
        draftedByAi: false,
        sentBy: undefined,
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Beleženje komunikacije nije uspelo.' };
  }
  if (target.clientAccountId) revalidatePath(`/crm/${target.clientAccountId}`);
  if (target.guestProfileId) revalidatePath(`/crm/gosti/${target.guestProfileId}`);
  return { error: null };
}

// M6 spec §4.1 — POST /communication-log/:id/mark-sent, jedini put kojim AI-generisan nacrt
// (drafted_by_ai=true) dobija sent_by, uvek ljudski nalog trenutno prijavljenog korisnika.
export async function markCommunicationSent(
  id: string,
  target: { clientAccountId?: string; guestProfileId?: string },
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/crm/communication-log/${id}/mark-sent`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Označavanje kao poslato nije uspelo.' };
  }
  if (target.clientAccountId) revalidatePath(`/crm/${target.clientAccountId}`);
  if (target.guestProfileId) revalidatePath(`/crm/gosti/${target.guestProfileId}`);
  return { error: null };
}
