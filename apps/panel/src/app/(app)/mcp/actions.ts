'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
  credential?: string;
  clientName?: string;
}

// M16 spec §3.1/§8 — POST /mcp-admin/clients, dozvola M16/mcp-client/MANAGE. Plaintext
// kredencijal se vraća TAČNO OVDE (isti obrazac kao izdavanje API ključa) — mora se prikazati
// odmah, ne postoji naredni poziv koji ga ponovo otkriva.
export async function createMcpClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const clientName = String(formData.get('clientName') ?? '').trim();
  if (!clientName) return { error: 'Naziv klijenta je obavezan.' };

  const rateLimitRaw = formData.get('rateLimitPerMinute');
  const rateLimitPerMinute = rateLimitRaw ? Number(rateLimitRaw) : undefined;

  try {
    const created = await apiFetch<{ credential: string; clientName: string }>('/mcp-admin/clients', {
      method: 'POST',
      body: { clientName, rateLimitPerMinute },
    });
    revalidatePath('/mcp');
    return { error: null, credential: created.credential, clientName: created.clientName };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Registracija MCP klijenta nije uspela.' };
  }
}

// M16 spec §3.1 — PENDING→ACTIVE, dozvola M16/mcp-client/MANAGE.
export async function activateMcpClient(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/mcp-admin/clients/${id}/activate`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Aktivacija MCP klijenta nije uspela.' };
  }
  revalidatePath('/mcp');
  return { error: null };
}

// M16 spec §3.1/§7 — jedini put do READ_WRITE, odvojena dozvola M16/mcp-client/APPROVE_READ_WRITE,
// nikad automatski (isti princip opreza kao odobravanje subagenta u M7).
export async function approveReadWriteMcpClient(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/mcp-admin/clients/${id}/approve-read-write`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobrenje READ_WRITE pristupa nije uspelo.' };
  }
  revalidatePath('/mcp');
  return { error: null };
}

// M16 spec §3.1 — dozvola M16/mcp-client/MANAGE.
export async function suspendMcpClient(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/mcp-admin/clients/${id}/suspend`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Suspendovanje MCP klijenta nije uspelo.' };
  }
  revalidatePath('/mcp');
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
