import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewConversationForm from './NewConversationForm';
import { PresenceDot } from './PresenceDot';

interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'EXTERNAL_SUPPLIER';
  name: string | null;
  supplierId: string | null;
  createdAt: string;
  lastReadAt: string;
  lastMessage: { id: string; senderId: string; body: string | null; sentAt: string } | null;
}

interface ConversationDetail {
  id: string;
  participants: { userId: string; user: { id: string; fullName: string; accountType: string } | null }[];
}

interface PresenceEntry {
  userId: string;
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
  lastSeenAt: string;
}

interface StaffUser {
  id: string;
  fullName: string;
  accountType: string;
  status: string;
}

// M17 spec §4/§7 (Faza 7) — "Razgovori", M19 spec §2/§8. Lista razgovora ovog korisnika
// (GET /chat/conversations vraća samo one gde je učesnik, §9.3), podeljena na interne
// (DIRECT/GROUP) ovde i EXTERNAL_SUPPLIER na posebnom podekranu (§9, /chat/dobavljaci) — isti
// razlog kao spec §9.1 (uža ograda, drugačiji krug dozvola).
export default async function ChatPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M19', 'conversation', 'CREATE');

  let conversations: ConversationSummary[] = [];
  let error: string | null = null;
  try {
    conversations = await apiFetch<ConversationSummary[]>('/chat/conversations');
  } catch {
    error = 'Nemate pristup razgovorima (M19/conversation/VIEW ili niste učesnik nijednog razgovora).';
  }

  let presence: PresenceEntry[] = [];
  try {
    presence = await apiFetch<PresenceEntry[]>('/chat/presence');
  } catch {
    // opciona sekcija — bez dozvole se online-status jednostavno ne prikazuje
  }
  const presenceByUser = new Map(presence.map((p) => [p.userId, p.status]));

  const internal = conversations.filter((c) => c.type !== 'EXTERNAL_SUPPLIER');
  const supplierCount = conversations.length - internal.length;

  // Za DIRECT razgovore lista ne nosi ime drugog učesnika (M19 §2.1 — `name` je samo za GROUP),
  // pa se detalj (GET /chat/conversations/:id, §8) dovlači po razgovoru — ovaj poziv radi za
  // svakog STAFF učesnika (assertParticipant proverava članstvo, ne opštu M1/user/VIEW dozvolu),
  // za razliku od /iam/users koji većina M19 uloga nema (Prodajni agent/Sales Manager/Računovođa).
  const details = await Promise.all(
    internal.map(async (c) => {
      try {
        return await apiFetch<ConversationDetail>(`/chat/conversations/${c.id}`);
      } catch {
        return null;
      }
    }),
  );
  const detailById = new Map(details.filter((d): d is ConversationDetail => d !== null).map((d) => [d.id, d]));

  let staffUsers: StaffUser[] = [];
  if (canCreate) {
    try {
      const users = await apiFetch<StaffUser[]>('/iam/users');
      staffUsers = users.filter((u) => u.accountType === 'STAFF' && u.id !== me?.userId && u.status === 'ACTIVE');
    } catch {
      // nema M1/user/VIEW — forma za novi razgovor se jednostavno ne prikazuje ispod
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Razgovori" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls chat/razgovori/
          </h1>
          <p className="text-xs text-ink-dim">Interni real-time tim-chat — M19.</p>
        </div>
        <Link
          href="/chat/dobavljaci"
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent hover:text-ink"
        >
          <Icon name="globe" /> razgovori sa dobavljačima{supplierCount > 0 ? ` (${supplierCount})` : ''}
        </Link>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && canCreate && staffUsers.length > 0 && (
        <div className="mb-4">
          <NewConversationForm staffUsers={staffUsers} />
        </div>
      )}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {internal.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema razgovora.</p>}
          {internal.map((c) => {
            const detail = detailById.get(c.id);
            const others = (detail?.participants ?? []).filter((p) => p.userId !== me?.userId);
            const title =
              c.type === 'GROUP'
                ? (c.name ?? 'Grupni razgovor')
                : (others[0]?.user?.fullName ?? 'Direktna poruka');
            const unread = c.lastMessage ? new Date(c.lastMessage.sentAt) > new Date(c.lastReadAt) : false;
            const otherStatus = c.type === 'DIRECT' ? presenceByUser.get(others[0]?.userId ?? '') : null;

            return (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-ink">
                    {c.type === 'DIRECT' && <PresenceDot status={otherStatus ?? null} />}
                    {c.type === 'GROUP' && <Icon name="organization" className="text-ink-faint" />}
                    <span className="truncate">{title}</span>
                    {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="nepročitano" />}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-faint">
                    {c.lastMessage ? (c.lastMessage.body ?? '(poruka obrisana)') : 'Nema poruka.'}
                  </div>
                </div>
                {c.lastMessage && (
                  <div className="ml-3 shrink-0 text-[11px] text-ink-faint">{new Date(c.lastMessage.sentAt).toLocaleString('sr-RS')}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
