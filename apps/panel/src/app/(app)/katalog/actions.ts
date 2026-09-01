'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { RoomType } from './[id]/RoomTypesEditor';
import type { HotelAttributes } from './[id]/HotelAttributesEditor';
import type { PackageAttributes } from './[id]/PackageAttributesEditor';
import type { PackageDeparture } from './[id]/PackageDeparturesEditor';

export interface FormState {
  error: string | null;
}

// M2 spec §7 — POST /catalog/products: uvek kreira CONTRACTED proizvod (ručni unos, M17
// spec §7 Faza 1 izlazni kriterijum: "tim može ručno da unese proizvod").
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const product = await apiFetch<{ id: string }>('/catalog/products', {
      method: 'POST',
      body: {
        type: formData.get('type'),
        destinationCountry: formData.get('destinationCountry'),
        destinationCity: formData.get('destinationCity'),
      },
    });
    // Odmah upisujemo srpski naziv/opis (obavezan prevod da proizvod ima ijedan naziv).
    await apiFetch(`/catalog/products/${product.id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: 'sr',
        name: formData.get('name'),
        description: formData.get('description') || '(bez opisa)',
        slug: String(formData.get('name') ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9čćžšđ ]/gi, '')
          .trim()
          .replace(/\s+/g, '-'),
      },
    });
    revalidatePath('/katalog');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje proizvoda nije uspelo.' };
  }
  redirect('/katalog');
}

export async function updateProductTranslation(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id'));
  try {
    await apiFetch(`/catalog/products/${id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: 'sr',
        name: formData.get('name'),
        description: formData.get('description'),
        slug: formData.get('slug'),
      },
    });
    revalidatePath(`/katalog/${id}`);
    revalidatePath('/katalog');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena nije uspela.' };
  }
  return { error: null };
}

// M2 spec §2.3a/§2.3b/v1.14 (28.8.2026) — `PATCH /catalog/products/:id` puni CEO `attributes`
// JSONB (poglavlje 2, "fleksibilan JSONB", nema deep-merge na backend strani) — zato ovde prvo
// ponovo učitavamo TRENUTNE attributes neposredno pre upisa, da izmena `room_types[]` tiho ne
// obriše `stars`/`amenities`/`contact` koje je neko drugi u međuvremenu izmenio, pa upisujemo
// samo `room_types[]` unutar njih.
export async function saveRoomTypes(productId: string, roomTypes: RoomType[]): Promise<void> {
  const product = await apiFetch<{ attributes?: Record<string, unknown> | null }>(`/catalog/products/${productId}`);
  const attributes = { ...(product.attributes ?? {}), room_types: roomTypes };
  await apiFetch(`/catalog/products/${productId}`, { method: 'PATCH', body: { attributes } });
  revalidatePath(`/katalog/${productId}`);
  revalidatePath(`/katalog/${productId}/pregled`);
}

// M2 spec §2.3/§2.3c/§2.3d (28.8.2026, na zahtev vlasnika) — isti obrazac kao saveRoomTypes
// iznad: `attributes` je jedan JSONB bez deep-merge na backendu, pa se trenutne vrednosti
// ponovo učitavaju neposredno pre upisa da izmena hotelskih polja tiho ne obriše `room_types[]`
// koji je neko drugi u međuvremenu izmenio.
export async function saveHotelAttributes(productId: string, patch: HotelAttributes): Promise<void> {
  const product = await apiFetch<{ attributes?: Record<string, unknown> | null }>(`/catalog/products/${productId}`);
  const attributes = { ...(product.attributes ?? {}), ...patch };
  await apiFetch(`/catalog/products/${productId}`, { method: 'PATCH', body: { attributes } });
  revalidatePath(`/katalog/${productId}`);
  revalidatePath(`/katalog/${productId}/pregled`);
}

// M2 spec §2.3e / M5 spec §3.0d.6a, standing pravilo 31.8.2026 (logika+forma u istom prolazu)
// — isti obrazac čuvanja kao saveHotelAttributes iznad.
export async function savePackageAttributes(productId: string, patch: PackageAttributes): Promise<void> {
  const product = await apiFetch<{ attributes?: Record<string, unknown> | null }>(`/catalog/products/${productId}`);
  const attributes = { ...(product.attributes ?? {}), ...patch };
  await apiFetch(`/catalog/products/${productId}`, { method: 'PATCH', body: { attributes } });
  revalidatePath(`/katalog/${productId}`);
  revalidatePath(`/katalog/${productId}/pregled`);
}

// M5 spec §3.0d.6 (v1.94) — termini polaska paketa, M2 CRUD (isti dozvolski krug kao attributes/EDIT).
export async function addPackageDeparture(productId: string, departureDate: string): Promise<PackageDeparture> {
  const departure = await apiFetch<PackageDeparture>(`/catalog/products/${productId}/package-departures`, {
    method: 'POST',
    body: { departureDate },
  });
  revalidatePath(`/katalog/${productId}`);
  return departure;
}

export async function cancelPackageDeparture(productId: string, departureId: string): Promise<void> {
  await apiFetch(`/catalog/products/${productId}/package-departures/${departureId}`, { method: 'DELETE' });
  revalidatePath(`/katalog/${productId}`);
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
