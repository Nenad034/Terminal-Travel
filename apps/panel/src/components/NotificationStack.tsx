'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Icon from './Icon';
import { useTabs } from './TabsContext';

const WS_ORIGIN = process.env.NEXT_PUBLIC_API_WS_ORIGIN ?? 'http://localhost:3000';
const COLLAPSE_THRESHOLD = 5;

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  sentAt: string;
}

interface PopupItem {
  id: string;
  severity: 'danger' | 'warn' | 'info';
  title: string;
  detail: string;
  conversationId: string;
  createdAt: string;
}

const SEVERITY_STRIPE: Record<PopupItem['severity'], string> = {
  danger: 'border-l-danger',
  warn: 'border-l-warn',
  info: 'border-l-accent',
};

function parseSystemMessage(message: MessageItem): PopupItem {
  const lines = message.body?.split('\n') ?? [];
  const header = lines[0] ?? '';
  const severity: PopupItem['severity'] = header.startsWith('[CRITICAL]') ? 'danger' : 'info';
  return {
    id: message.id,
    severity,
    title: header.replace(/^\[CRITICAL\]\s*/, ''),
    detail: lines.slice(1).join('\n'),
    conversationId: message.conversationId,
    createdAt: message.sentAt,
  };
}

// Dizajn dok. §5e — iskačuća obaveštenja, donji desni ugao, nezavisno od trenutno otvorenog
// taba. Izvor podataka: POSTOJEĆI mehanizam (nema novog backend-a) — M18 CRITICAL HealthSignal
// već ide preko Event Bus-a u M19 "Obaveštenja" DIREKTAN razgovor svakog Vlasnika/Direktora
// (InAppNotificationsService, m19-komunikaciona-platforma/in-app-notifications) i stiže uživo
// preko POSTOJEĆE /ws/chat WebSocket konekcije (isti kanal kao ChatPanel.tsx) — ovaj komponent
// samo gleda taj tok sa mesta gde tab nije nužno otvoren na "Obaveštenja" razgovoru.
// Ne nestaju same (samo ručni × ili "Zatvori sve"); ne dupliraju se preko `notifiedIds` seta
// (Set ne raste unedogled u ovoj sesiji — prihvatljivo za prvi rez, isti princip kao TabsContext
// istorija koja takođe ne preživljava osvežavanje).
export default function NotificationStack() {
  const { openTab } = useTabs();
  const [items, setItems] = useState<PopupItem[]>([]);
  const notificationsConversationId = useRef<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function connect() {
      let conversationId: string | null = null;
      try {
        const res = await fetch('/api/chat/conversations', { cache: 'no-store' });
        if (res.ok) {
          const conversations: { id: string; name: string | null }[] = await res.json();
          conversationId = conversations.find((c) => c.name === 'Obaveštenja')?.id ?? null;
        }
      } catch {
        // bez liste razgovora — nema šta da se filtrira, ne otvaramo konekciju uzalud
      }
      if (cancelled || !conversationId) return;
      notificationsConversationId.current = conversationId;

      let token: string | null = null;
      try {
        const res = await fetch('/api/chat/ws-token', { cache: 'no-store' });
        if (res.ok) token = (await res.json()).token ?? null;
      } catch {
        // bez tokena — nema iskačućih obaveštenja ovim putem u ovoj sesiji
      }
      if (cancelled || !token) return;

      socket = io(`${WS_ORIGIN}/ws/chat`, { auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('message.new', (message: MessageItem) => {
        if (message.conversationId !== notificationsConversationId.current) return;
        if (seenIds.current.has(message.id)) return;
        seenIds.current.add(message.id);
        setItems((prev) => [...prev, parseSystemMessage(message)]);
      });
    }

    connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

  if (items.length === 0) return null;

  const visible = items.slice(-COLLAPSE_THRESHOLD);
  const collapsedCount = items.length - visible.length;

  function dismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function dismissAll() {
    setItems([]);
  }
  function openConversation(conversationId: string) {
    openTab('/chat/' + conversationId, 'Obaveštenja');
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col-reverse gap-2">
      {items.length > 2 && (
        <button
          onClick={dismissAll}
          className="pointer-events-auto mb-1 self-end rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-ink-faint hover:border-accent hover:text-ink"
        >
          Zatvori sve
        </button>
      )}
      {collapsedCount > 0 && (
        <div className="pointer-events-auto rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-center text-[11px] text-ink-faint">
          +{collapsedCount} još obaveštenja
        </div>
      )}
      {visible.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto animate-fade-in rounded-lg border border-border border-l-4 bg-panel p-3 text-xs shadow-sm ${SEVERITY_STRIPE[item.severity]}`}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="font-medium text-ink">{item.title}</span>
            <button onClick={() => dismiss(item.id)} title="Zatvori" className="flex-shrink-0 text-ink-faint hover:text-danger">
              <Icon name="close" />
            </button>
          </div>
          {item.detail && <p className="mb-2 line-clamp-3 font-mono text-[11px] text-ink-faint">{item.detail}</p>}
          <button onClick={() => openConversation(item.conversationId)} className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-strong">
            Otvori razgovor <Icon name="arrow-right" />
          </button>
        </div>
      ))}
    </div>
  );
}
