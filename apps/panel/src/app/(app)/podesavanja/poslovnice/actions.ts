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

// M1 spec dopuna (6.9.2026) — POST /iam/branches, isti obrazac kao ostale globalne šifarnike
// (npr. uloge) u ovom modulu.
export async function createBranch(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = formData.get('name');
  if (typeof name !== 'string' || name.trim() === '') return { error: 'Naziv poslovnice je obavezan.' };
  try {
    await apiFetch('/iam/branches', { method: 'POST', body: { name: name.trim() } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje poslovnice nije uspelo.' };
  }
  revalidatePath('/podesavanja/poslovnice');
  return { error: null };
}

// PATCH /iam/branches/:id — izmena naziva i/ili aktivna/neaktivna (meko gašenje, ne brisanje —
// `Booking.branchId`/`User.branchId` se oslanjaju na postojeće redove).
export async function updateBranch(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const name = formData.get('name');
  try {
    await apiFetch(`/iam/branches/${id}`, {
      method: 'PATCH',
      body: {
        name: typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined,
        active: formData.get('active') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena poslovnice nije uspela.' };
  }
  revalidatePath('/podesavanja/poslovnice');
  return { error: null };
}
