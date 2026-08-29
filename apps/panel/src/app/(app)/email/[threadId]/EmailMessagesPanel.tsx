'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import { createEmailMessage, sendEmailDraft, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface EmailMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'CORRESPONDENT' | 'STAFF' | 'AI_DRAFT';
  fromAddress: string;
  body: string;
  aiSummary: string | null;
  sentBy: string | null;
  receivedAt: string;
}

// M22 spec §2.4/§4/§8 — nit poruka, isti obrazac kao M14 TicketMessagesPanel. AI_DRAFT/STAFF
// nacrt nikad nema `sentBy` pri kreiranju (§4) — jedini put je "pošalji" dugme ovde (POST
// .../messages/:messageId/send, ljudska potvrda). `aiSummary` se prikazuje samo za INBOUND
// poruke (§2.4 — popunjeno kad AI sažme sadržaj dolazne poruke).
export default function EmailMessagesPanel({ threadId, messages, canReply }: { threadId: string; messages: EmailMessage[]; canReply: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="mail" className="text-accent" /> Poruke
      </div>

      {messages.length === 0 ? (
        <p className="mb-3 text-xs text-ink-faint">Nema poruka.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded border border-border bg-panel2 p-2 text-xs">
              {/* 29-DIZAJN-SISTEM-UI.md §6a — zajednička komponenta umesto ranijeg lokalnog bedža,
                  isti prevod kao M14 nit tiketa (poslat nacrt = čovek + AI poreklo teksta). */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-faint">
                <ActorLabel {...actorPropsFor(m)} org={m.fromAddress} />
                <span>{new Date(m.receivedAt).toLocaleString('sr-RS')}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-ink-dim">{m.body}</p>
              {m.direction === 'INBOUND' && m.aiSummary && (
                <p className="mt-1 rounded bg-accent-soft px-1.5 py-1 text-[11px] text-accent-strong">
                  <Icon name="sparkle" /> AI sažetak: {m.aiSummary}
                </p>
              )}
              {m.direction === 'OUTBOUND' && !m.sentBy && canReply && (
                <div className="mt-1">
                  <SendDraftButton threadId={threadId} messageId={m.id} />
                </div>
              )}
              {m.sentBy && <p className="mt-1 text-[11px] text-ink-faint">poslao: {m.sentBy}</p>}
            </div>
          ))}
        </div>
      )}

      {canReply && <NewMessageForm threadId={threadId} />}
    </div>
  );
}

// 29-DIZAJN-SISTEM-UI.md §6a — prevod M22 senderType-a na jedinstveni prikaz porekla.
function actorPropsFor(m: EmailMessage) {
  if (m.senderType === 'CORRESPONDENT') return { name: 'korespondent', origin: 'GUEST' as const };
  if (m.senderType === 'STAFF') return { name: m.sentBy ?? 'tim', origin: 'STAFF' as const };
  if (m.sentBy) return { name: m.sentBy, origin: 'STAFF' as const, draftedByAi: true };
  return { name: 'AI agent', origin: 'AI_AGENT' as const };
}

function NewMessageForm({ threadId }: { threadId: string }) {
  const boundAction = createEmailMessage.bind(null, threadId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <textarea name="body" required rows={3} placeholder="odgovor korespondentu" className="input" />
      <label className="flex items-center gap-2 text-[11px] text-ink-dim">
        <input type="checkbox" name="send" className="h-3.5 w-3.5" />
        pošalji odmah (bez ovoga ostaje nacrt do potvrde)
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Šaljem…' : 'Dodaj poruku'}
    </Button>
  );
}

function SendDraftButton({ threadId, messageId }: { threadId: string; messageId: string }) {
  const boundAction = sendEmailDraft.bind(null, threadId, messageId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <SendSubmit />
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

function SendSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto border-accent px-2 py-0.5 text-accent-strong hover:bg-accent-soft">
      {pending ? 'Šaljem…' : 'pošalji'}
    </Button>
  );
}
