'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

function strOrUndef(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

// M14 spec §6 — POST /tickets. Interni tim unosi tiket u ime gosta/subagenta koji je zvao
// telefonom (requesterType=STAFF_ON_BEHALF, §2.1) — jedini slučaj kreiranja tiketa sa ovog
// ekrana (M17 je interni panel; sam gost/subagent otvara tiket preko M8/M9/M7, van obima ovde).
export async function createTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  let ticket: { id: string };
  try {
    ticket = await apiFetch<{ id: string }>('/helpdesk/tickets', {
      method: 'POST',
      body: {
        requesterType: 'STAFF_ON_BEHALF',
        requesterClientAccountId: strOrUndef(formData, 'requesterClientAccountId'),
        relatedBookingId: strOrUndef(formData, 'relatedBookingId'),
        subject: strOrUndef(formData, 'subject'),
        category: strOrUndef(formData, 'category'),
        priority: strOrUndef(formData, 'priority'),
        channel: 'PHONE',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje tiketa nije uspelo.' };
  }
  revalidatePath('/podrska');
  redirect(`/podrska/${ticket.id}`);
}

// M14 spec §6 — PATCH /tickets/:id. refundDecision uz status=RESOLVED zatvara reklamaciju uz
// odluku o povraćaju (§3.2) — okida M10 nacrt storno dokumenta, ne izvršava ga (i dalje ljudska
// potvrda slanja u M10).
export async function updateTicket(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/helpdesk/tickets/${id}`, {
      method: 'PATCH',
      body: {
        status: strOrUndef(formData, 'status'),
        priority: strOrUndef(formData, 'priority'),
        assignedTo: strOrUndef(formData, 'assignedTo'),
        refundDecision: formData.get('refundDecision') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena tiketa nije uspela.' };
  }
  revalidatePath(`/podrska/${id}`);
  revalidatePath('/podrska');
  return { error: null };
}

// M14 spec §4/§6 — POST /tickets/:id/messages. Interni tim odgovara direktno kao STAFF
// (sent_by se popunjava automatski na backendu) ili ostavlja is_internal_note=true belešku
// vidljivu samo timu (§5) — nikad AI_DRAFT odavde (AI nacrti nastaju kroz M14 AI mehanizam,
// ne ovaj ručni unos).
export async function createTicketMessage(ticketId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/helpdesk/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: {
        senderType: 'STAFF',
        body: strOrUndef(formData, 'body'),
        isInternalNote: formData.get('isInternalNote') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje poruke nije uspelo.' };
  }
  revalidatePath(`/podrska/${ticketId}`);
  return { error: null };
}

// M14 spec §4 — POST /tickets/:id/messages/:messageId/send. Jedini put kroz koji AI_DRAFT
// poruka koja pominje cenu/obavezu dobija sent_by — uvek ljudska potvrda (M14/ticket/RESPOND).
export async function sendTicketMessage(ticketId: string, messageId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/helpdesk/tickets/${ticketId}/messages/${messageId}/send`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje nacrta nije uspelo.' };
  }
  revalidatePath(`/podrska/${ticketId}`);
  return { error: null };
}
