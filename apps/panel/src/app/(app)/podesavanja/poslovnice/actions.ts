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
  if (typeof name !== 'string' || name.trim() === '')
    return { error: 'Naziv poslovnice je obavezan.' };
  try {
    await apiFetch('/iam/branches', { method: 'POST', body: { name: name.trim() } });
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje poslovnice nije uspelo.',
    };
  }
  revalidatePath('/podesavanja/poslovnice');
  return { error: null };
}

function optionalText(formData: FormData, field: string): string | null | undefined {
  const value = formData.get(field);
  if (typeof value !== 'string') return undefined;
  return value.trim() === '' ? null : value.trim();
}

// PATCH /iam/branches/:id sa kompletnim poslovnim podacima (meko gašenje preko `active`, ne
// brisanje — `Booking.branchId`/`User.branchId` se oslanjaju na postojeće redove). M1 spec §3.9b
// dopuna (8.9.2026), korišćeno sa detaljnog ekrana `/podesavanja/poslovnice/[id]`.
export async function updateBranch(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get('name');
  if (typeof name !== 'string' || name.trim() === '')
    return { error: 'Naziv poslovnice je obavezan.' };
  try {
    await apiFetch(`/iam/branches/${id}`, {
      method: 'PATCH',
      body: {
        name: name.trim(),
        active: formData.get('active') === 'on',
        address: optionalText(formData, 'address'),
        phone: optionalText(formData, 'phone'),
        email: optionalText(formData, 'email'),
        responsiblePersonName: optionalText(formData, 'responsiblePersonName'),
        taxId: optionalText(formData, 'taxId'),
        licenseNumber: optionalText(formData, 'licenseNumber'),
      },
    });
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Izmena poslovnice nije uspela.',
    };
  }
  revalidatePath('/podesavanja/poslovnice');
  revalidatePath(`/podesavanja/poslovnice/${id}`);
  return { error: null };
}
