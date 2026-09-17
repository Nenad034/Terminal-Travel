'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateOfferDraft, type FormState } from '../actions';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';

// M12 spec §3d / M17 §7a (v2.75) — nacrt nastao iz M3 akcije pred istek. Rok rezervacije KAO
// DATUM (nikad „još N dana" — objava se odobrava možda dva dana kasnije), kanal `B2B_SUBAGENTS`
// i prekidač publike `b2bAudience` (M7 §5b.1): to je jedini klik koji čovek mora da napravi
// pre odobrenja, pa stoji na vrhu, ne u dnu forme.

const CHANNELS: { code: string; label: string }[] = [
  { code: 'FACEBOOK', label: 'Facebook' },
  { code: 'INSTAGRAM', label: 'Instagram' },
  { code: 'B2B_SUBAGENTS', label: 'Subagenti (portal + mejl)' },
  { code: 'EMAIL', label: 'Newsletter gostima' },
  { code: 'M8_SITE', label: 'Sajt' },
];

function datumSr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}.${m}.${y}.`;
}

export default function OfferExpiryPanel({
  id,
  offerBookingTo,
  targetChannels,
  b2bAudience,
  editable,
  danas,
  recipientCount,
}: {
  id: string;
  offerBookingTo: string;
  targetChannels: string[];
  b2bAudience: 'ASSIGNED_ONLY' | 'ALL_ACTIVE' | null;
  editable: boolean;
  /** ISO dan, računat na serveru (dva rendera ne smeju dati dva datuma). */
  danas: string;
  /** Broj primalaca za trenutni krug (M7 `GET /b2b/notice-recipients`); null = M7 nije odgovorio. */
  recipientCount: number | null;
}) {
  const bound = updateOfferDraft.bind(null, id);
  const [state, action] = useActionState<FormState, FormData>(bound, { error: null });
  const istekla = offerBookingTo.slice(0, 10) < danas;

  return (
    <section className="mb-4 rounded-lg border border-accent-strong/40 bg-panel p-4 text-xs">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Akcija pred istek</h2>
        <span className={istekla ? 'font-semibold text-danger' : 'font-semibold text-ink'}>
          rezervacije do {datumSr(offerBookingTo)}
          {istekla && ' — rok je prošao, objava neće izaći (EXPIRED)'}
        </span>
      </div>
      <p className="mb-3 text-ink-faint">
        Nacrt je napravio AI iz M3 događaja. Tekst ispod već nosi rok kao datum. Pre odobrenja
        izaberite kanale i krug subagenata — to je jedina odluka koju sistem ne može da donese sam.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <fieldset disabled={!editable} className="flex flex-wrap gap-3">
          <legend className="mb-1 text-[11px] text-ink-faint">kanali</legend>
          {CHANNELS.map((c) => (
            <label key={c.code} className="flex items-center gap-1 text-ink">
              <input
                type="checkbox"
                name="targetChannels"
                value={c.code}
                defaultChecked={targetChannels.includes(c.code)}
              />
              {c.label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={!editable} className="flex flex-wrap gap-4">
          <legend className="mb-1 text-[11px] text-ink-faint">
            krug subagenata (kanal &bdquo;Subagenti&ldquo;) — <Icon name="info" /> zavisi od akcije:
            last minute koji mora da se proda ide svima
            {recipientCount !== null && (
              <span className="ml-2 font-semibold text-ink">
                · ide na {recipientCount} partnera
              </span>
            )}
            {recipientCount === null && targetChannels.includes('B2B_SUBAGENTS') && (
              <span className="ml-2 text-warn">· broj primalaca trenutno nedostupan (M7)</span>
            )}
          </legend>
          <label className="flex items-center gap-1 text-ink">
            <input
              type="radio"
              name="b2bAudience"
              value="ASSIGNED_ONLY"
              defaultChecked={b2bAudience === 'ASSIGNED_ONLY'}
            />
            samo dodeljeni (oni koji proizvod već vide)
          </label>
          <label className="flex items-center gap-1 text-ink">
            <input
              type="radio"
              name="b2bAudience"
              value="ALL_ACTIVE"
              defaultChecked={b2bAudience === 'ALL_ACTIVE' || b2bAudience === null}
            />
            svi aktivni subagenti
          </label>
        </fieldset>
        {editable && (
          <div className="flex items-center gap-2">
            <Sacuvaj />
            {state.error && <span className="text-danger">{state.error}</span>}
          </div>
        )}
      </form>
    </section>
  );
}

function Sacuvaj() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? 'Čuvam…' : 'sačuvaj izbor'}
    </Button>
  );
}
