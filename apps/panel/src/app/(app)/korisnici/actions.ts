'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

// Pozivanje korisnika vraća i podatke o napravljenom nalogu — forma iz njih sklapa link za
// aktivaciju koji se prosleđuje ručno dok slanje email-a nije povezano.
export interface InviteState extends FormState {
  userId?: string;
  inviteToken?: string;
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

// M1 spec §7 — POST /iam/users ("+ Pozovi korisnika"), nalog kreiran u statusu INVITED.
//
// Dopuna 4.9.2026 (na zahtev vlasnika): endpoint vraća `inviteToken`, ali slanje email-a
// još nije povezano (`UsersService.invite` to i kaže u komentaru). Do sada je panel taj
// token TIHO ODBACIVAO — nalog je nastajao, a pozvani čovek nikad nije dobio ništa i nije
// mogao da postavi lozinku. Sada se link prikazuje pozivaocu da ga prosledi ručno, isti
// obrazac koji M19 već koristi za pozivnicu dobavljaču (§9.7). Kad email infrastruktura
// dođe na red, ovo ostaje kao rezervni put, ne uklanja se.
export async function inviteUser(_prev: InviteState, formData: FormData): Promise<InviteState> {
  let user: { user: { id: string }; inviteToken: string };
  try {
    user = await apiFetch<{ user: { id: string }; inviteToken: string }>('/iam/users', {
      method: 'POST',
      body: {
        fullName: str(formData, 'fullName'),
        email: str(formData, 'email'),
        phone: str(formData, 'phone'),
        roleIds: formData.getAll('roleIds').filter((v): v is string => typeof v === 'string' && v !== ''),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Pozivanje korisnika nije uspelo.' };
  }
  revalidatePath('/korisnici');
  return { error: null, userId: user.user.id, inviteToken: user.inviteToken };
}

// M1 spec §7 — PATCH /iam/users/:id, samo ime/telefon (email/status se ne menjaju odavde).
export async function updateUser(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/${id}`, {
      method: 'PATCH',
      body: {
        fullName: str(formData, 'fullName'),
        phone: str(formData, 'phone'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena korisnika nije uspela.' };
  }
  revalidatePath(`/korisnici/${id}`);
  revalidatePath('/korisnici');
  return { error: null };
}

// M1 spec §7 — DELETE /iam/users/:id je meko suspendovanje (status=SUSPENDED, ne pravo brisanje).
export async function suspendUser(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/${id}`, { method: 'DELETE' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Suspendovanje naloga nije uspelo.' };
  }
  revalidatePath(`/korisnici/${id}`);
  revalidatePath('/korisnici');
  return { error: null };
}

// M1 spec §7 — POST /iam/users/:id/roles (dodela uloge).
export async function assignRole(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/${userId}/roles`, {
      method: 'POST',
      body: { roleId: str(formData, 'roleId') },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodela uloge nije uspela.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M1 spec §7 — DELETE /iam/users/:id/roles/:roleId (uklanjanje uloge).
export async function removeRole(userId: string, roleId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Uklanjanje uloge nije uspelo.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M1 spec §7 — POST /iam/users/:id/permission-overrides. Razlog obavezan (backend takođe
// validira min 3 karaktera) — svesan pojedinačni izuzetak od podrazumevanih dozvola uloge.
export async function createPermissionOverride(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/${userId}/permission-overrides`, {
      method: 'POST',
      body: {
        permissionId: str(formData, 'permissionId'),
        effect: str(formData, 'effect'),
        reason: str(formData, 'reason'),
        expiresAt: str(formData, 'expiresAt'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje izuzetka nije uspelo.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M1 spec §7 — DELETE /iam/users/permission-overrides/:overrideId (stvaran put kontrolera,
// NIJE ugnježden pod /users/:id — potvrđeno u apps/api/src/modules/m1-core-identitet/users/).
export async function deletePermissionOverride(userId: string, overrideId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/iam/users/permission-overrides/${overrideId}`, { method: 'DELETE' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Uklanjanje izuzetka nije uspelo.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M1 spec §6/§7 (dopuna 4.9.2026) — dozvole po ulozi. Ekran šalje SAMO razliku (dodate
// posebno, uklonjene posebno), pa dva čoveka koja istovremeno uređuju istu ulogu ne brišu
// jedan drugom izmene — što bi se desilo da se šalje ceo izabrani skup kao zamena.
export async function saveRolePermissions(
  roleId: string,
  added: string[],
  removed: string[],
): Promise<FormState> {
  try {
    if (added.length) {
      await apiFetch(`/iam/roles/${roleId}/permissions`, { method: 'POST', body: { permissionIds: added } });
    }
    for (const permissionId of removed) {
      await apiFetch(`/iam/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' });
    }
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje dozvola uloge nije uspelo.' };
  }
  revalidatePath(`/korisnici/uloge/${roleId}`);
  revalidatePath('/korisnici/uloge');
  return { error: null };
}
