'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §4.5 / M9 spec §4 — dodela predstavnika (vodiča) na stavku rezervacije.
// `PATCH /sales/bookings/items/:itemId/assign-guide` postoji od avgusta 2026, ali do
// 1.9.2026 nijedan ekran ga nije zvao — kancelarija nije imala kako da dodeli predstavnika.

export interface GuideFormState {
  error: string | null;
  ok: string | null;
}

export const emptyGuideState: GuideFormState = { error: null, ok: null };

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

export async function assignGuide(
  bookingId: string,
  bookingItemId: string,
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const raw = String(formData.get('assignedGuideId') ?? '');
  // Prazan izbor znači SKIDANJE predstavnika sa stavke — API prima null, ne prazan string.
  const assignedGuideId = raw === '' ? null : raw;

  try {
    await apiFetch(`/sales/bookings/items/${bookingItemId}/assign-guide`, { method: 'PATCH', body: { assignedGuideId } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodela predstavnika nije uspela.', ok: null };
  }

  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null, ok: assignedGuideId ? 'Predstavnik je dodeljen.' : 'Predstavnik je uklonjen sa stavke.' };
}
