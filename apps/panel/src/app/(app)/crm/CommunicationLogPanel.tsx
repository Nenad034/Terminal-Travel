'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createCommunicationLog, markCommunicationSent, FormState } from './actions';

const initialState: FormState = { error: null };
const CHANNELS = ['EMAIL', 'PHONE', 'SMS', 'IN_PERSON'];

interface CommunicationLog {
  id: string;
  channel: string;
  direction: string;
  summary: string;
  draftedByAi: boolean;
  sentBy: string | null;
  createdAt: string;
}

interface Target {
  clientAccountId?: string;
  guestProfileId?: string;
}

// M6 spec §4.1 — istorija komunikacije + ručno beleženje nove poruke. AI-generisan nacrt
// (drafted_by_ai=true) koji pominje cenu/obavezu ne sme biti poslat bez sent_by popunjenog
// ljudskim nalogom — ovaj panel prikazuje takve nacrte sa dugmetom "označi kao poslato"
// (jedini put kroz koji sent_by dobija vrednost, uvek trenutno prijavljeni korisnik).
export default function CommunicationLogPanel({
  target,
  entries,
  canCreate,
}: {
  target: Target;
  entries: CommunicationLog[];
  canCreate: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="comment-discussion" className="text-accent" /> Komunikacija
      </div>

      {entries.length === 0 ? (
        <p className="mb-3 text-xs text-ink-faint">Nema zabeležene komunikacije.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded border border-border bg-panel2 p-2 text-xs">
              <div className="flex items-center justify-between text-[11px] text-ink-faint">
                <span>
                  {e.channel} · {e.direction === 'OUTBOUND' ? 'poslato' : 'primljeno'} · {new Date(e.createdAt).toLocaleString('sr-RS')}
                </span>
                {e.draftedByAi && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">AI nacrt</span>}
              </div>
              <p className="mt-1 text-ink-dim">{e.summary}</p>
              {e.draftedByAi && !e.sentBy && (
                <div className="mt-1">
                  <MarkSentButton id={e.id} target={target} />
                </div>
              )}
              {e.sentBy && <p className="mt-1 text-[10px] text-ink-faint">poslao: {e.sentBy}</p>}
            </div>
          ))}
        </div>
      )}

      {canCreate && <NewCommunicationLogForm target={target} />}
    </div>
  );
}

function NewCommunicationLogForm({ target }: { target: Target }) {
  const boundAction = createCommunicationLog.bind(null, target);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <select name="channel" required className="input" defaultValue="PHONE">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="direction" required className="input" defaultValue="OUTBOUND">
          <option value="OUTBOUND">poslato</option>
          <option value="INBOUND">primljeno</option>
        </select>
      </div>
      <textarea name="summary" required rows={2} placeholder="sažetak razgovora/poruke" className="input" />
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
      {pending ? 'Beležim…' : 'Zabeleži komunikaciju'}
    </button>
  );
}

function MarkSentButton({ id, target }: { id: string; target: Target }) {
  const boundAction = markCommunicationSent.bind(null, id, target);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <MarkSentSubmit />
      {state.error && <span className="text-[10px] text-danger">{state.error}</span>}
    </form>
  );
}

function MarkSentSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-accent px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? 'Označavam…' : 'označi kao poslato'}
    </button>
  );
}
