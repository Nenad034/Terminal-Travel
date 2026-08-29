'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { grantSupplierAccess, inviteSupplierContact, revokeSupplierAccess, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialGrantState: FormState = { error: null };
const initialInviteState: FormState = { error: null };

interface ConversationSummary {
  id: string;
  supplierId: string | null;
  createdAt: string;
  lastMessage: { id: string; senderId: string; body: string | null; sentAt: string } | null;
}

interface ConversationDetail {
  id: string;
  participants: { userId: string; user: { id: string; fullName: string; accountType: string } | null }[];
}

interface AccessEntry {
  id: string;
  userId: string;
  grantedAt: string;
}

interface SupplierContactRow {
  id: string;
  fullName: string;
  email: string;
  linkedUserId: string | null;
}

// M19 spec §9.2/§9.4/§9.7 — jedan red = jedan EXTERNAL_SUPPLIER razgovor: otvaranje (isti
// ChatPanel kao interni razgovori, §9.1 "ostatak infrastrukture se ponovo koristi neizmenjen"),
// "dodeli pristup" (SupplierConversationAccess) i "pozovi kontakt" (§9.2 korak 2), oba iza
// canGrant (M19/supplier-conversation/GRANT_ACCESS, potvrđeno i server-side u actions.ts).
export default function SupplierConversationRow({
  conversation,
  supplierName,
  detail,
  access,
  contacts,
  canGrant,
}: {
  conversation: ConversationSummary;
  supplierName: string;
  detail: ConversationDetail | null;
  access: AccessEntry[];
  contacts: SupplierContactRow[];
  canGrant: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);

  const supplierContactParticipant = (detail?.participants ?? []).find((p) => p.user?.accountType === 'SUPPLIER_CONTACT');
  const availableContacts = contacts.filter((c) => !c.linkedUserId);

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <TabLink href={`/chat/${conversation.id}`} label={supplierName} className="flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent">
            <Icon name="globe" /> {supplierName}
          </TabLink>
          <p className="mt-0.5 text-xs text-ink-faint">
            {conversation.lastMessage ? (conversation.lastMessage.body ?? '(poruka obrisana)') : 'Nema poruka.'}
            {conversation.lastMessage && ` · ${new Date(conversation.lastMessage.sentAt).toLocaleString('sr-RS')}`}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {supplierContactParticipant ? (
              <>
                <Icon name="check" className="text-ok" /> kontakt dobavljača povezan: {supplierContactParticipant.user?.fullName}
              </>
            ) : (
              'kontakt-osoba dobavljača još nema portal nalog'
            )}
          </p>
        </div>
        {canGrant && (
          <Button type="button" onClick={() => setManageOpen((v) => !v)} variant="outline" size="sm">
            {manageOpen ? 'zatvori upravljanje' : 'upravljaj pristupom'}
          </Button>
        )}
      </div>

      {canGrant && manageOpen && (
        <div className="mt-3 flex flex-col gap-4 border-t border-border pt-3">
          <div>
            <h3 className="mb-1 text-[11px] font-semibold text-ink-faint">Tim sa pristupom</h3>
            <ul className="mb-2 flex flex-col gap-1 text-xs">
              {access.length === 0 && <li className="text-ink-faint">Niko još nema eksplicitno dodeljen pristup.</li>}
              {access.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>
                    {a.userId} <span className="text-ink-faint">· dodeljeno {new Date(a.grantedAt).toLocaleDateString('sr-RS')}</span>
                  </span>
                  <RevokeButton conversationId={conversation.id} userId={a.userId} />
                </li>
              ))}
            </ul>
            <GrantAccessForm conversationId={conversation.id} />
          </div>

          <div>
            <h3 className="mb-1 text-[11px] font-semibold text-ink-faint">Pozovi kontakt-osobu dobavljača</h3>
            {supplierContactParticipant ? (
              <p className="text-xs text-ink-faint">Ovaj razgovor već ima dodeljenu kontakt-osobu (§9.3 — tačno jedna po razgovoru).</p>
            ) : availableContacts.length === 0 ? (
              <p className="text-xs text-ink-faint">Nema kontakt-osoba bez portal naloga za ovog dobavljača (M3/supplier-contact).</p>
            ) : (
              <InviteContactForm conversationId={conversation.id} contacts={availableContacts} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GrantAccessForm({ conversationId }: { conversationId: string }) {
  const boundAction = grantSupplierAccess.bind(null, conversationId);
  const [state, formAction] = useFormState(boundAction, initialGrantState);
  return (
    <form action={formAction} className="flex gap-2">
      {state.error && <p className="w-full rounded bg-danger-bg p-1.5 text-[11px] text-danger">{state.error}</p>}
      <input name="userId" required placeholder="ID korisnika (UUID, M1 User)" className="input flex-1 text-xs" />
      <GrantSubmit />
    </form>
  );
}

function GrantSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto border-accent px-2.5 py-1 text-[11px] text-accent-strong hover:bg-accent-soft">
      {pending ? 'Dodeljujem…' : 'dodeli pristup'}
    </Button>
  );
}

function RevokeButton({ conversationId, userId }: { conversationId: string; userId: string }) {
  return (
    <form action={revokeSupplierAccess.bind(null, conversationId, userId)}>
      <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs text-danger">
        ukloni
      </Button>
    </form>
  );
}

function InviteContactForm({ conversationId, contacts }: { conversationId: string; contacts: SupplierContactRow[] }) {
  const boundAction = inviteSupplierContact.bind(null, conversationId);
  const [state, formAction] = useFormState(boundAction, initialInviteState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error && <p className="rounded bg-danger-bg p-1.5 text-[11px] text-danger">{state.error}</p>}
      {state.inviteToken && (
        <p className="break-all rounded bg-ok-bg p-1.5 text-[11px] text-ok">
          Pozivnica kreirana — link tim ručno prosleđuje dobavljaču (§9.7): <code>{state.inviteToken}</code>
        </p>
      )}
      <div className="flex gap-2">
        <select name="supplierContactId" required className="input flex-1 text-xs">
          <option value="">— izaberite kontakt-osobu —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName} ({c.email})
            </option>
          ))}
        </select>
        <InviteSubmit />
      </div>
    </form>
  );
}

function InviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto border-accent px-2.5 py-1 text-[11px] text-accent-strong hover:bg-accent-soft">
      {pending ? 'Šaljem…' : 'pozovi kontakt'}
    </Button>
  );
}
