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

function optionalText(formData: FormData, field: string): string | null | undefined {
  const value = formData.get(field);
  if (typeof value !== 'string') return undefined;
  return value.trim() === '' ? null : value.trim();
}

// M24 spec §5 — PATCH /hr/employees/:userId, upsert (isti obrazac kao AgencySettings).
export async function upsertEmployeeRecord(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const employmentType = formData.get('employmentType');
  const contractBasis = formData.get('contractBasis');
  const hireDate = formData.get('hireDate');
  if (typeof hireDate !== 'string' || hireDate.trim() === '')
    return { error: 'Datum zasnivanja radnog odnosa je obavezan.' };

  const annualLeave = formData.get('annualLeaveDaysEntitled');
  try {
    await apiFetch(`/hr/employees/${userId}`, {
      method: 'PATCH',
      body: {
        employmentType,
        contractBasis,
        hireDate,
        probationEndDate: optionalText(formData, 'probationEndDate'),
        contractEndDate: optionalText(formData, 'contractEndDate'),
        terminationDate: optionalText(formData, 'terminationDate'),
        reportsToUserId: optionalText(formData, 'reportsToUserId'),
        annualLeaveDaysEntitled:
          typeof annualLeave === 'string' && annualLeave.trim() !== '' ? Number(annualLeave) : null,
      },
    });
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje HR dosijea nije uspelo.',
    };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M24 spec §3a/§5 — POST /hr/employees/:userId/leave. Zaposleni podnosi SOPSTVENI zahtev
// (ownership, bez dozvole) ili HR/Vlasnik/Direktor u ime nekog drugog — servis proverava,
// ova akcija samo prosleđuje.
export async function createLeaveRecord(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = formData.get('type');
  const startDate = formData.get('startDate');
  const endDate = formData.get('endDate');
  const daysCount = formData.get('daysCount');
  if (
    typeof startDate !== 'string' ||
    typeof endDate !== 'string' ||
    typeof daysCount !== 'string' ||
    startDate === '' ||
    endDate === '' ||
    daysCount === ''
  ) {
    return { error: 'Period i broj dana su obavezni.' };
  }
  try {
    await apiFetch(`/hr/employees/${userId}/leave`, {
      method: 'POST',
      body: {
        type,
        startDate,
        endDate,
        daysCount: Number(daysCount),
        note: optionalText(formData, 'note'),
      },
    });
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Podnošenje zahteva nije uspelo.',
    };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

// M24 spec §3a/§5 — PATCH /hr/leave/:leaveId/approve|reject. Ownership (neposredni rukovodilac)
// ili M24/leave-record/CREATE (blanket) — servis proverava.
export async function approveLeaveRecord(
  userId: string,
  leaveId: string,
  _prev: FormState,
): Promise<FormState> {
  try {
    await apiFetch(`/hr/leave/${leaveId}/approve`, { method: 'PATCH' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobrenje nije uspelo.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}

export async function rejectLeaveRecord(
  userId: string,
  leaveId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const reason = formData.get('reason');
  if (typeof reason !== 'string' || reason.trim() === '') {
    return { error: 'Razlog odbijanja je obavezan.' };
  }
  try {
    await apiFetch(`/hr/leave/${leaveId}/reject`, { method: 'PATCH', body: { reason } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odbijanje nije uspelo.' };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}
