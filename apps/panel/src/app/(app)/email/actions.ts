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

// M22 spec §2.1 — POST /email/mailboxes, zahteva M22/mailbox/CREATE (Vlasnik/Direktor, §7).
// PERSONAL zahteva ownerUserId (backend auto-upisuje REPLY vlasniku, §2.2); SHARED ga ne sme
// imati — validacija je već u backend DTO/servisu, ovde samo prosleđujemo unos.
export async function createMailbox(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/email/mailboxes', {
      method: 'POST',
      body: {
        address: strOrUndef(formData, 'address'),
        displayName: strOrUndef(formData, 'displayName'),
        mailboxType: strOrUndef(formData, 'mailboxType'),
        ownerUserId: strOrUndef(formData, 'ownerUserId'),
        providerConnectionRef: strOrUndef(formData, 'providerConnectionRef') ?? 'mock',
        isSupplierUnifiedInbox: formData.get('isSupplierUnifiedInbox') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje sandučeta nije uspelo.' };
  }
  revalidatePath('/email/sanducad');
  return { error: null };
}

// M22 spec §2.2 — POST /email/mailboxes/:id/access, zahteva M22/mailbox-access/GRANT.
export async function grantMailboxAccess(mailboxId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/email/mailboxes/${mailboxId}/access`, {
      method: 'POST',
      body: {
        userId: strOrUndef(formData, 'userId'),
        accessLevel: strOrUndef(formData, 'accessLevel'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodela pristupa nije uspela.' };
  }
  revalidatePath('/email/sanducad');
  return { error: null };
}

// M22 spec §2.4/§8 — POST /email/threads/:id/messages, zahteva REPLY (+ MailboxAccess REPLY na
// sanduče niti, sprovedeno u servisu). Kreira isključivo STAFF poruku; send=true odmah šalje.
export async function createEmailMessage(threadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/email/threads/${threadId}/messages`, {
      method: 'POST',
      body: {
        body: strOrUndef(formData, 'body'),
        send: formData.get('send') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje poruke nije uspelo.' };
  }
  revalidatePath(`/email/${threadId}`);
  return { error: null };
}

// M22 spec §4/§8 — POST /email/threads/:id/messages/:messageId/send. Jedini put kroz koji
// AI_DRAFT/STAFF nacrt (sentBy=null) dobija sentBy — uvek ljudska potvrda (REPLY).
export async function sendEmailDraft(threadId: string, messageId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/email/threads/${threadId}/messages/${messageId}/send`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje nacrta nije uspelo.' };
  }
  revalidatePath(`/email/${threadId}`);
  return { error: null };
}

// M22 spec §3.2/§8 — POST /email/threads/:id/link-booking, zahteva REPLY. Predlog/potvrda veze
// ka M5 Booking, čisto informativno na niti — ne menja M5 stanje.
export async function linkBooking(threadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/email/threads/${threadId}/link-booking`, {
      method: 'POST',
      body: { bookingId: strOrUndef(formData, 'bookingId') },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Povezivanje rezervacije nije uspelo.' };
  }
  revalidatePath(`/email/${threadId}`);
  return { error: null };
}

// M22 spec §3.1a/§8 — POST /email/threads/:id/link-supplier-announcement, zahteva REPLY. Upisuje
// ISKLJUČIVO weak-ref polje na niti (related_supplier_manifest_id/related_supplier_change_notice_id)
// — konačna M5 supplier_confirmed_at/by potvrda ostaje isključivo M5/supplier-confirmation/CONFIRM,
// van ovog modula (backend email-threads.service.ts to sprovodi, ne poziva M5 servise).
export async function linkSupplierAnnouncement(threadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/email/threads/${threadId}/link-supplier-announcement`, {
      method: 'POST',
      body: {
        announcementType: strOrUndef(formData, 'announcementType'),
        announcementId: strOrUndef(formData, 'announcementId'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Povezivanje najave dobavljača nije uspelo.' };
  }
  revalidatePath(`/email/${threadId}`);
  return { error: null };
}

// M22 spec §5/§8 — POST /email/threads/:id/convert-to-ticket, zahteva CONVERT_TO_TICKET (isti
// krug kao REPLY, §7). Ljudska radnja — AI agent sme samo da predloži, nikad sam da izvrši (§5).
export async function convertToTicket(threadId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  let result: { thread: { id: string; convertedToTicketId: string }; ticket: { id: string } };
  try {
    result = await apiFetch(`/email/threads/${threadId}/convert-to-ticket`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Konverzija u tiket nije uspela.' };
  }
  revalidatePath(`/email/${threadId}`);
  redirect(`/podrska/${result.ticket.id}`);
}
