'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// M5 spec §6.5 — prenos vlasništva: trenutni vlasnik ili Vlasnik/Direktor (sprovedeno na API-ju).
export async function transferOwnership(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const newOwnerId = formData.get('newOwnerId');
  if (!newOwnerId) return { error: 'Izaberite novog vlasnika.' };
  try {
    await apiFetch(`/sales/bookings/${bookingId}/transfer-ownership`, { method: 'POST', body: { newOwnerId } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Prenos vlasništva nije uspeo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}

// M5 spec §6.5 — predlog predaje zaduženja; Vlasnik/Direktor izvršavaju odmah (API), ostali
// kreiraju PENDING predlog koji primalac mora prihvatiti/odbiti (dugmad ispod).
export async function proposeHandoff(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const toUserId = formData.get('toUserId');
  if (!toUserId) return { error: 'Izaberite kome predajete rezervaciju.' };
  try {
    await apiFetch(`/sales/bookings/${bookingId}/handoff-requests`, { method: 'POST', body: { toUserId } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Predlog predaje nije uspeo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}

export async function acceptHandoff(bookingId: string, handoffId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/sales/bookings/handoff-requests/${handoffId}/accept`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Prihvatanje predloga nije uspelo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}

export async function declineHandoff(bookingId: string, handoffId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/sales/bookings/handoff-requests/${handoffId}/decline`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odbijanje predloga nije uspelo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}

export async function cancelHandoff(bookingId: string, handoffId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/sales/bookings/handoff-requests/${handoffId}/cancel`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Otkazivanje predloga nije uspelo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}
