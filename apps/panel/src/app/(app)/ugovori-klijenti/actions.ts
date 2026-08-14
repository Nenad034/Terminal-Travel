'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

// M20 spec §3.2 druga alineja — ručno evidentiranje prihvatanja (interni panel/telefon),
// isključivo ljudska radnja, dozvola M20/client-contract/ACCEPT.
export async function acceptContract(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/client-contracts/${id}/accept`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Evidentiranje prihvatanja nije uspelo.' };
  }
  revalidatePath(`/ugovori-klijenti/${id}`);
  revalidatePath('/ugovori-klijenti');
  return { error: null };
}

// M20 spec §5 — isključivo Vlasnik/Direktor, uvek ljudska radnja.
export async function voidContract(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/client-contracts/${id}/void`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Poništavanje ugovora nije uspelo.' };
  }
  revalidatePath(`/ugovori-klijenti/${id}`);
  revalidatePath('/ugovori-klijenti');
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
