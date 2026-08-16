'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
  inviteToken?: string;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// M19 spec §9.3/§9.7 — POST /chat/conversations sa type=EXTERNAL_SUPPLIER (grant za tvorca je
// automatski na backendu, §9.3 komentar "self-grant").
export async function createSupplierConversation(_prev: FormState, formData: FormData): Promise<FormState> {
  const supplierId = formData.get('supplierId');
  if (typeof supplierId !== 'string' || !supplierId) return { error: 'Izaberite dobavljača.' };

  let conversation: { id: string };
  try {
    conversation = await apiFetch<{ id: string }>('/chat/conversations', {
      method: 'POST',
      body: { type: 'EXTERNAL_SUPPLIER', supplierId },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje razgovora nije uspelo.' };
  }
  revalidatePath('/chat/dobavljaci');
  redirect(`/chat/${conversation.id}`);
}

// §9.4/§9.7 — POST /chat/supplier-conversations/:id/access. Zahteva M19/supplier-conversation/
// GRANT_ACCESS (proveren na backendu, ova forma se i ovde ne prikazuje bez te dozvole).
export async function grantSupplierAccess(conversationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) return { error: 'Unesite ID korisnika.' };
  try {
    await apiFetch(`/chat/supplier-conversations/${conversationId}/access`, { method: 'POST', body: { userId } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodela pristupa nije uspela.' };
  }
  revalidatePath('/chat/dobavljaci');
  return { error: null };
}

export async function revokeSupplierAccess(conversationId: string, userId: string): Promise<void> {
  try {
    await apiFetch(`/chat/supplier-conversations/${conversationId}/access/${userId}`, { method: 'DELETE' });
  } catch {
    // best-effort — greška se ne prosleđuje UI-ju iz ove akcije bez forme (dugme "ukloni pristup")
  }
  revalidatePath('/chat/dobavljaci');
}

// §9.2 korak 2/§9.7 — POST /chat/supplier-conversations/:id/invite-contact. Vraća sirov
// inviteToken (isti obrazac kao UsersService.invite — slanje email-a je van obima ovog prolaza,
// tim ručno prosleđuje link dobavljaču dok stvarna email integracija ne dođe na red, §9.7 napomena).
export async function inviteSupplierContact(conversationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supplierContactId = formData.get('supplierContactId');
  if (typeof supplierContactId !== 'string' || !supplierContactId) return { error: 'Izaberite kontakt-osobu.' };
  let result: { inviteToken: string };
  try {
    result = await apiFetch<{ inviteToken: string }>(`/chat/supplier-conversations/${conversationId}/invite-contact`, {
      method: 'POST',
      body: { supplierContactId },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Pozivnica nije uspela.' };
  }
  revalidatePath('/chat/dobavljaci');
  return { error: null, inviteToken: result.inviteToken };
}
