'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import { PresenceDot } from '../PresenceDot';
import { draftSupplierReply, markConversationRead, sendMessageRestFallback } from '../actions';
import { Button } from '@/components/ui/button';

interface Participant {
  userId: string;
  user: { id: string; fullName: string; accountType: string } | null;
}

interface AttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  sentAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  // M19 spec §2.3 — evidencija AI porekla; senderId i dalje pokazuje na čoveka koji je poslao.
  draftedByAi?: boolean;
  draftedByAgentId?: string | null;
  // §2.5 (v1.6) — prilog(zi) uz poruku, opciono.
  attachments?: AttachmentItem[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  // §2.3/§9.5 — pamti da tekst u polju potiče iz AI nacrta. Ostaje `true` i kad ga zaposleni
  // izmeni pre slanja (spec: beleži se poreklo, ne doslovna istovetnost); gasi se tek kad polje
  // ostane prazno (novi tekst od nule) ili posle slanja.
  const [draftFromAi, setDraftFromAi] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  // §2.5 (v1.6) — fajl izabran za slanje uz sledeću poruku; čisti se posle slanja/otkazivanja.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (value.trim() === '') setDraftFromAi(false);
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

  // §9.5 — traži nacrt od AI agenta. Tekst pada u isto polje za pisanje: zaposleni ga pregleda i
  // po potrebi izmeni pre slanja, jer nema puta kojim bi ga AI poslao sam.
  async function handleRequestDraft() {
    setDrafting(true);
    setDraftNote(null);
    const result = await draftSupplierReply(conversationId, draft);
    if (result.error) {
      setDraftNote(result.error);
    } else if (result.draft) {
      setDraft(result.draft);
      setDraftFromAi(true);
    } else {
      setDraftNote(result.note ?? 'AI nacrt trenutno nije dostupan.');
    }
    setDrafting(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !pendingFile) return;
    setSendError(null);
    setSending(true);

    // Prilog UVEK ide preko REST fallback-a, čak i kad je WS povezan — socket.io payload je
    // JSON, ne nosi binarni fajl (obrazloženje u actions.ts, sendMessageRestFallback).
    const socket = socketRef.current;
    if (!pendingFile && socket?.connected) {
      socket.emit('message.send', { conversationId, body, draftedByAi: draftFromAi });
      socket.emit('typing.stop', { conversationId });
      setDraft('');
      setDraftFromAi(false);
      setSending(false);
      return;
    }

    const result = await sendMessageRestFallback(conversationId, body, draftFromAi, pendingFile ?? undefined);
    if (result.error) {
      setSendError(result.error);
    } else {
      setDraft('');
      setDraftFromAi(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (result.message) {
        const m = result.message as MessageItem;
        setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
      }
    }
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-panel">
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

      <div className="flex min-h-[16rem] flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-xs text-ink-faint">Nema poruka. Napišite prvu.</p>}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const sender = userById.get(m.senderId);
          return (
            <div key={m.id} className={`max-w-[75%] rounded border p-2 text-xs ${mine ? 'self-end border-accent bg-accent-soft' : 'self-start border-border bg-panel2'}`}>
              {/* 29-DIZAJN-SISTEM-UI.md §6a — poreklo je vidljivo na SVAKOJ poruci, i na sopstvenoj:
                  oznaka AI nacrta (§6a.2 pravilo 2) mora da se vidi i kad je poruku poslao onaj ko
                  gleda ekran, jer je upravo on odgovoran za tekst koji je AI predložio. */}
              <div className="mb-0.5 text-[11px] text-ink-faint">
                <ActorLabel
                  name={mine ? 'Vi' : sender?.fullName}
                  origin={sender?.accountType ?? 'STAFF'}
                  draftedByAi={m.draftedByAi ?? false}
                />
              </div>
              {!m.deletedAt && m.body && <p className="whitespace-pre-wrap text-ink-dim">{m.body}</p>}
              {m.deletedAt && <p className="whitespace-pre-wrap text-ink-dim">(poruka obrisana)</p>}
              {!m.deletedAt && m.attachments && m.attachments.length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  {m.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/chat/attachments/${a.id}`}
                      className="flex items-center gap-1.5 rounded border border-border bg-panel px-2 py-1 text-[11px] text-ink-dim hover:border-accent hover:text-ink"
                    >
                      <Icon name="file" /> {a.fileName} <span className="text-ink-faint">({formatFileSize(a.sizeBytes)})</span>
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-0.5 text-[11px] text-ink-faint">
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
        <form onSubmit={handleSend} className="flex flex-wrap gap-2 border-t border-border p-3">
          {sendError && <p className="w-full rounded bg-danger-bg p-2 text-[11px] text-danger">{sendError}</p>}
          {draftNote && <p className="w-full rounded bg-panel2 p-2 text-[11px] text-ink-faint">{draftNote}</p>}
          {/* 29-DIZAJN-SISTEM-UI.md §6a.2 pravilo 1 — oznaka je vidljiva pre slanja, ne posle:
              zaposleni mora znati da šalje AI tekst dok još može da ga izmeni ili odbaci. */}
          {draftFromAi && (
            <p className="flex w-full items-center gap-1 rounded bg-accent-soft p-2 text-[11px] text-accent-strong">
              <Icon name="sparkle" /> Tekst potiče iz AI nacrta — biće tako i zabeležen. Odgovornost za
              poslatu poruku ostaje na vama.
            </p>
          )}
          {/* §2.5 (v1.6) — prilog fajla; skriveni <input type=file>, vidljivo dugme sa spajalicom
              pokreće ga preko ref-a (isti obrazac kao svaki drugi prilagođen file-picker). */}
          {pendingFile && (
            <p className="flex w-full items-center gap-1.5 rounded bg-panel2 px-2 py-1 text-[11px] text-ink-dim">
              <Icon name="file" /> {pendingFile.name} <span className="text-ink-faint">({formatFileSize(pendingFile.size)})</span>
              <button type="button" onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-auto text-ink-faint hover:text-danger">
                <Icon name="close" />
              </button>
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Priloži fajl"
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0 self-end text-ink-faint hover:text-ink"
          >
            {/* Codicon set nema "paperclip"/"attach" — "file-add" je najbliži postojeći. */}
            <Icon name="file-add" />
          </Button>
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
          <div className="flex flex-col items-end gap-1 self-end">
            <Button type="submit" disabled={sending || (draft.trim() === '' && !pendingFile)} size="sm">
              {sending ? 'Šaljem…' : 'pošalji'}
            </Button>
            {/* §9.5 — AI nacrt postoji samo za razgovore sa dobavljačima; interni tim-chat ga
                nema (namerno uža granica nego M7 chat). */}
            {conversationType === 'EXTERNAL_SUPPLIER' && (
              <Button type="button" onClick={handleRequestDraft} disabled={drafting} variant="outline" size="sm" className="h-auto px-2 py-1 text-[11px]">
                {drafting ? 'Pišem nacrt…' : 'predloži nacrt (AI)'}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="border-t border-border p-3 text-[11px] text-ink-faint">Nemate dozvolu za slanje poruka u ovom razgovoru.</p>
      )}
    </div>
  );
}
