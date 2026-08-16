'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Icon from '@/components/Icon';
import { PresenceDot } from '../PresenceDot';
import { markConversationRead, sendMessageRestFallback } from '../actions';

interface Participant {
  userId: string;
  user: { id: string; fullName: string; accountType: string } | null;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  sentAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

const WS_ORIGIN = process.env.NEXT_PUBLIC_API_WS_ORIGIN ?? 'http://localhost:3000';
// §2.4 — "kuca poruku..." se ne čuva, samo se ekspiruje lokalno ako `typing.stopped` ne stigne
// (npr. konekcija ispadne dok korisnik kuca) — čisto UI zaštita, ne poslovno pravilo.
const TYPING_TIMEOUT_MS = 4000;

// M19 spec §3/§8 — klijentska WS konekcija na /ws/chat (jedna po klijentu, spec §3). Token se
// traži preko apps/panel/src/app/api/chat/ws-token/route.ts (BFF sesija, vidi komentar tamo) i
// nikad se ne čuva van React state-a. Primaran put slanja je `message.send` (uživo `message.new`
// svim učesnicima sobe uključujući pošiljaoca — otud se lokalni state NE ažurira optimistički,
// čeka se echo preko WS-a); ako socket nije povezan, koristi se REST fallback server akcija
// (§8, isti obrazac kao ConversationsController komentar "REST fallback za slanje").
export default function ChatPanel({
  conversationId,
  conversationType,
  currentUserId,
  participants,
  initialMessages,
  canSend,
}: {
  conversationId: string;
  conversationType: 'DIRECT' | 'GROUP' | 'EXTERNAL_SUPPLIER';
  currentUserId: string;
  participants: Participant[];
  initialMessages: MessageItem[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [connected, setConnected] = useState(false);
  const [presenceByUser, setPresenceByUser] = useState<Map<string, 'ONLINE' | 'AWAY' | 'OFFLINE'>>(new Map());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingEmitRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const userById = new Map(participants.map((p) => [p.userId, p.user]));

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      let token: string | null = null;
      try {
        const res = await fetch('/api/chat/ws-token', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          token = data.token ?? null;
        }
      } catch {
        // bez tokena — ostajemo u REST-only režimu (canSend forma i dalje radi preko fallback-a)
      }
      if (cancelled || !token) return;

      const socket = io(`${WS_ORIGIN}/ws/chat`, { auth: { token }, transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on('message.new', (message: MessageItem) => {
        if (message.conversationId !== conversationId) return;
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        clearTyping(message.senderId);
        // §8 — POST /chat/conversations/:id/read: nova poruka stiže dok je razgovor otvoren, pa
        // ga odmah označavamo pročitanim (isti poziv kao pri otvaranju panela, ispod).
        markConversationRead(conversationId).catch(() => {});
      });

      socket.on('presence.updated', (payload: { userId: string; status: 'ONLINE' | 'AWAY' | 'OFFLINE' }) => {
        setPresenceByUser((prev) => new Map(prev).set(payload.userId, payload.status));
      });

      socket.on('typing.started', (payload: { conversationId: string; userId: string }) => {
        if (payload.conversationId !== conversationId || payload.userId === currentUserId) return;
        setTypingUserIds((prev) => new Set(prev).add(payload.userId));
        const timeouts = typingTimeouts.current;
        const existing = timeouts.get(payload.userId);
        if (existing) clearTimeout(existing);
        timeouts.set(
          payload.userId,
          setTimeout(() => clearTyping(payload.userId), TYPING_TIMEOUT_MS),
        );
      });

      socket.on('typing.stopped', (payload: { conversationId: string; userId: string }) => {
        if (payload.conversationId !== conversationId) return;
        clearTyping(payload.userId);
      });
    }

    function clearTyping(userId: string) {
      setTypingUserIds((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      const timeouts = typingTimeouts.current;
      const existing = timeouts.get(userId);
      if (existing) clearTimeout(existing);
      timeouts.delete(userId);
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // §8 — POST /chat/conversations/:id/read, pozvano jednom pri otvaranju panela (Server Action
  // pozvana direktno iz klijentske komponente, isti mehanizam kao svaki drugi 'use server' poziv).
  useEffect(() => {
    markConversationRead(conversationId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1500) {
      socket.emit('typing.start', { conversationId });
      lastTypingEmitRef.current = now;
    }
  }

  function handleBlurOrStop() {
    socketRef.current?.emit('typing.stop', { conversationId });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSendError(null);
    setSending(true);

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('message.send', { conversationId, body });
      socket.emit('typing.stop', { conversationId });
      setDraft('');
      setSending(false);
      return;
    }

    // WS nije povezan — REST fallback (§8). Bez WS eha, poruku ubacujemo ručno u lokalni prikaz.
    const result = await sendMessageRestFallback(conversationId, body);
    if (result.error) {
      setSendError(result.error);
    } else {
      setDraft('');
      if (result.message) {
        const m = result.message as MessageItem;
        setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
      }
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] text-ink-faint">
        <span>
          <Icon name={connected ? 'plug' : 'debug-disconnect'} className={connected ? 'text-ok' : 'text-ink-faint'} />{' '}
          {connected ? 'uživo povezano' : 'nije povezano (WS) — poruke se šalju preko REST fallback-a'}
        </span>
        {conversationType !== 'EXTERNAL_SUPPLIER' && (
          <span className="flex items-center gap-2">
            {participants
              .filter((p) => p.userId !== currentUserId)
              .map((p) => (
                <span key={p.userId} className="flex items-center gap-1">
                  <PresenceDot status={presenceByUser.get(p.userId) ?? null} /> {p.user?.fullName ?? '—'}
                </span>
              ))}
          </span>
        )}
      </div>

      <div className="flex max-h-[28rem] min-h-[16rem] flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-xs text-ink-faint">Nema poruka. Napišite prvu.</p>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const sender = userById.get(m.senderId);
          return (
            <div key={m.id} className={`max-w-[75%] rounded border p-2 text-xs ${mine ? 'self-end border-accent bg-accent-soft' : 'self-start border-border bg-panel2'}`}>
              {!mine && <div className="mb-0.5 text-[10px] font-semibold text-ink-faint">{sender?.fullName ?? 'nepoznat korisnik'}</div>}
              <p className="whitespace-pre-wrap text-ink-dim">{m.deletedAt ? '(poruka obrisana)' : m.body}</p>
              <div className="mt-0.5 text-[10px] text-ink-faint">
                {new Date(m.sentAt).toLocaleString('sr-RS')}
                {m.editedAt && !m.deletedAt && ' · izmenjeno'}
              </div>
            </div>
          );
        })}
        {typingUserIds.size > 0 && (
          <p className="text-[11px] italic text-ink-faint">
            {[...typingUserIds].map((id) => userById.get(id)?.fullName ?? 'neko').join(', ')} kuca…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
          {sendError && <p className="w-full rounded bg-danger-bg p-2 text-[11px] text-danger">{sendError}</p>}
          <textarea
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={handleBlurOrStop}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            rows={2}
            placeholder="Napišite poruku… (Enter za slanje, Shift+Enter za novi red)"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={sending || draft.trim() === ''}
            className="self-end rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {sending ? 'Šaljem…' : 'pošalji'}
          </button>
        </form>
      ) : (
        <p className="border-t border-border p-3 text-[11px] text-ink-faint">Nemate dozvolu za slanje poruka u ovom razgovoru.</p>
      )}
    </div>
  );
}
