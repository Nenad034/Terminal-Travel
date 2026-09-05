'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { RoomType } from './[id]/RoomTypesEditor';
import type { HotelAttributes } from './[id]/HotelAttributesEditor';
import type { PackageAttributes } from './[id]/PackageAttributesEditor';
import type { PackageDeparture } from './[id]/PackageDeparturesEditor';
import type { DestinationProfile, DestinationType, ActivityTag } from './destinacije/DestinationProfilesEditor';

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
        // Prazno polje ostaje neuneto (undefined), ne prazan string — isti princip kao svako
        // drugo opciono polje ovde (M2 spec §2.1b).
        destinationArea: formData.get('destinationArea') || undefined,
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

// M2 spec §2.1b (4.9.2026) — dok je EditProductForm imao samo naziv/opis/slug, mesto/regija/
// država nisu se mogle ispraviti ni na jednom postojećem proizvodu (npr. zatečeni pogrešan unos
// "Sitonija, Halkidiki" u polju mesto). Zato ista forma sad upisuje i prevod (PUT translations)
// i odredište (PATCH /catalog/products/:id) — dva poziva, jedan submit, isti obrazac kao
// createProduct u istom fajlu.
export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
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
    await apiFetch(`/catalog/products/${id}`, {
      method: 'PATCH',
      body: {
        destinationCountry: formData.get('destinationCountry'),
        destinationCity: formData.get('destinationCity'),
        destinationArea: formData.get('destinationArea') || undefined,
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

// M2 spec §2.1c (dopuna 5.9.2026) — CRUD nad DestinationProfile (tip destinacije + aktivnosti),
// backend endpoint već postoji (commit 351b2fd): `POST`/`PATCH /catalog/destination-profiles`.
// Isti obrazac kao ostatak fajla — server action tanak omotač oko `apiFetch`, greška
// izvučena preko `extractMessage`. Ovo je ljudski unos/potvrda (poglavlje 7 Master dokumenta,
// "predloži pa čovek odobri") — AI-predlog-tok je van obima ovog prolaza.
export interface DestinationProfileFormState {
  error: string | null;
}

export async function createDestinationProfile(
  input: { destinationCountry: string; destinationCity: string; destinationType: DestinationType; activities: ActivityTag[] },
): Promise<DestinationProfileFormState & { profile?: DestinationProfile }> {
  try {
    const profile = await apiFetch<DestinationProfile>('/catalog/destination-profiles', {
      method: 'POST',
      body: input,
    });
    revalidatePath('/katalog/destinacije');
    return { error: null, profile };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje profila destinacije nije uspelo.' };
  }
}

export async function updateDestinationProfile(
  id: string,
  input: { destinationType: DestinationType; activities: ActivityTag[] },
): Promise<DestinationProfileFormState & { profile?: DestinationProfile }> {
  try {
    const profile = await apiFetch<DestinationProfile>(`/catalog/destination-profiles/${id}`, {
      method: 'PATCH',
      body: input,
    });
    revalidatePath('/katalog/destinacije');
    return { error: null, profile };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena profila destinacije nije uspela.' };
  }
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
