'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface NoteFormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// M5 spec §4.6 — autor se uvek uzima iz tokena na API strani, ovde se ne šalje.
export async function createBookingNote(bookingId: string, _prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Beleška ne može biti prazna.' };
  if (body.length > 4000) return { error: 'Beleška može imati najviše 4000 znakova.' };
  try {
    await apiFetch(`/sales/bookings/${bookingId}/notes`, { method: 'POST', body: { body } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Beleška nije sačuvana.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}

export async function deleteBookingNote(bookingId: string, noteId: string, _prev: NoteFormState, _formData: FormData): Promise<NoteFormState> {
  try {
    await apiFetch(`/sales/bookings/${bookingId}/notes/${noteId}`, { method: 'DELETE' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Brisanje beleške nije uspelo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null };
}
