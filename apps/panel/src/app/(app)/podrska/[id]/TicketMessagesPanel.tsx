'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import { createTicketMessage, sendTicketMessage, FormState } from '../actions';

const initialState: FormState = { error: null };

interface TicketMessage {
  id: string;
  senderType: 'REQUESTER' | 'STAFF' | 'AI_DRAFT';
  body: string;
  isInternalNote: boolean;
  sentBy: string | null;
  createdAt: string;
}

// M14 spec §2.2/§4/§6 — nit poruka. AI_DRAFT nikad nema sentBy pri kreiranju (§4) — jedini put
// je "pošalji" dugme ovde (POST .../messages/:messageId/send, isti obrazac kao M6
// CommunicationLogPanel "označi kao poslato"). Interne beleške (isInternalNote) su ovde uvek
// vidljive jer je ovo interni panel (M17) — backend ih već filtrira za Gost/subagent kanale.
export default function TicketMessagesPanel({ ticketId, messages, canRespond }: { ticketId: string; messages: TicketMessage[]; canRespond: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="comment-discussion" className="text-accent" /> Poruke
      </div>

      {messages.length === 0 ? (
        <p className="mb-3 text-xs text-ink-faint">Nema poruka.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className={`rounded border p-2 text-xs ${m.isInternalNote ? 'border-warn bg-warn-bg' : 'border-border bg-panel2'}`}>
              {/* 29-DIZAJN-SISTEM-UI.md §6a — zajednička komponenta umesto ranijeg lokalnog bedža.
                  Poslat AI nacrt prikazuje OBA podatka (ko je poslao + da je nacrt AI), §6a.2 pravilo 2. */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-faint">
                <ActorLabel {...actorPropsFor(m)} />
                <span>
                  {new Date(m.createdAt).toLocaleString('sr-RS')}
                  {m.isInternalNote && ' · interna beleška'}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-ink-dim">{m.body}</p>
              {m.senderType === 'AI_DRAFT' && !m.sentBy && canRespond && (
                <div className="mt-1">
                  <SendDraftButton ticketId={ticketId} messageId={m.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canRespond && <NewMessageForm ticketId={ticketId} />}
    </div>
  );
}

// 29-DIZAJN-SISTEM-UI.md §6a — prevod M14 senderType-a na jedinstveni prikaz porekla.
// Nacrt koji je čovek već poslao (AI_DRAFT + sentBy) prestaje da bude "AI poruka" i postaje
// ljudska poruka sa zabeleženim AI poreklom teksta — tačno kako §6a.2 pravilo 2 traži.
function actorPropsFor(m: TicketMessage) {
  if (m.senderType === 'REQUESTER') return { name: 'podnosilac', origin: 'GUEST' as const };
  if (m.senderType === 'STAFF') return { name: m.sentBy ?? 'tim', origin: 'STAFF' as const };
  if (m.sentBy) return { name: m.sentBy, origin: 'STAFF' as const, draftedByAi: true };
  return { name: 'AI agent', origin: 'AI_AGENT' as const };
}

function NewMessageForm({ ticketId }: { ticketId: string }) {
  const boundAction = createTicketMessage.bind(null, ticketId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <textarea name="body" required rows={3} placeholder="odgovor gostu/subagentu ili interna beleška" className="input" />
      <label className="flex items-center gap-2 text-[11px] text-ink-dim">
        <input type="checkbox" name="isInternalNote" className="h-3.5 w-3.5" />
        interna beleška (nikad vidljiva gostu/subagentu)
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Šaljem…' : 'Dodaj poruku'}
    </button>
  );
}

function SendDraftButton({ ticketId, messageId }: { ticketId: string; messageId: string }) {
  const boundAction = sendTicketMessage.bind(null, ticketId, messageId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <SendSubmit />
      {state.error && <span className="text-[10px] text-danger">{state.error}</span>}
    </form>
  );
}

function SendSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-accent px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? 'Šaljem…' : 'pošalji nacrt'}
    </button>
  );
}
