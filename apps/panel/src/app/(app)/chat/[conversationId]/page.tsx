import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ChatPanel from './ChatPanel';


interface ConversationDetail {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'EXTERNAL_SUPPLIER';
  name: string | null;
  supplierId: string | null;
  createdAt: string;
  participants: {
    userId: string;
    joinedAt: string;
    lastReadAt: string;
    user: { id: string; fullName: string; accountType: string } | null;
  }[];
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  sentAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments?: { id: string; fileName: string; mimeType: string; sizeBytes: number }[];
}

// M17 spec §4/§7 (Faza 7), M19 spec §2/§3/§8 — otvoren razgovor: istorija poruka učitana preko
// REST-a za početni prikaz (GET /chat/conversations/:id/messages), zatim uživo ažuriranje preko
// WS-a u ChatPanel.tsx (klijentska komponenta, §3 "WebSocket konekcija po klijentu"). Isti
// server+klijent split kao apps/panel/src/app/(app)/podrska/[id]/page.tsx + TicketMessagesPanel.tsx.
// Nevidljivost za ne-učesnike je namerno 404, ne 403 (ConversationsService.assertParticipant,
// M19 spec §9.2/§9.4) — notFound() ovde prati taj isti obrazac.
export default async function ConversationPage(props: { params: Promise<{ conversationId: string }> }) {
  const params = await props.params;
  const me = await getMe();
  if (!me) notFound();

  let conversation: ConversationDetail;
  let messages: MessageItem[] = [];
  try {
    conversation = await apiFetch<ConversationDetail>(`/chat/conversations/${params.conversationId}`);
    messages = await apiFetch<MessageItem[]>(`/chat/conversations/${params.conversationId}/messages`);
  } catch {
    notFound();
  }

  // M19 spec §7/§9.6 — DIRECT/GROUP koristi conversation/SEND_MESSAGE, EXTERNAL_SUPPLIER koristi
  // supplier-conversation/SEND_MESSAGE (uži krug, §9.6 tabela). Backend (ConversationsService.
  // assertCanSend) sprovodi ovo ponovo — ovde samo određujemo da li se forma za unos prikazuje.
  const canSend = hasPermission(
    me,
    'M19',
    conversation.type === 'EXTERNAL_SUPPLIER' ? 'supplier-conversation' : 'conversation',
    'SEND_MESSAGE',
  );

  const others = conversation.participants.filter((p) => p.userId !== me.userId);
  const title = conversation.type === 'GROUP' ? (conversation.name ?? 'Grupni razgovor') : (others[0]?.user?.fullName ?? 'Direktna poruka');
  const backHref = conversation.type === 'EXTERNAL_SUPPLIER' ? '/chat/dobavljaci' : '/chat';

  return (
    // Kolona na punu visinu modula (4.9.2026, na zahtev vlasnika: "neka prikaz zauzima celu
    // visinu modula") — header (link nazad + naslov) zadržava prirodnu visinu, ChatPanel
    // ispunjava sav preostali prostor (flex-1 ispod), umesto ranije fiksne visine liste poruka
    // koja je ostavljala prazan prostor na dnu ekrana.
    <div className="flex h-full flex-col p-6">
      <RegisterTab label={title} />
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na listu
      </Link>

      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> chat/{title}
        </h1>
        <p className="text-xs text-ink-faint">
          {conversation.type} · {conversation.participants.length} učesnik(a) · otvoren {new Date(conversation.createdAt).toLocaleDateString('sr-RS')}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ChatPanel
          conversationId={conversation.id}
          conversationType={conversation.type}
          currentUserId={me.userId}
          participants={conversation.participants}
          initialMessages={messages}
          canSend={canSend}
        />
      </div>
    </div>
  );
}
