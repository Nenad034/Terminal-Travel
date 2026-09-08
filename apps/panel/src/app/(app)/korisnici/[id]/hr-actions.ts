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
          typeof annualLeave === 'string' && annualLeave.trim() !== ''
            ? Number(annualLeave)
            : null,
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

// M24 spec §5 — POST /hr/employees/:userId/leave.
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
      error: err instanceof ApiError ? extractMessage(err) : 'Evidentiranje odsustva nije uspelo.',
    };
  }
  revalidatePath(`/korisnici/${userId}`);
  return { error: null };
}
