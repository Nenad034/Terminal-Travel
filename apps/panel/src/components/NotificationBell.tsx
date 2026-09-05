'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';

interface ConversationSummary {
  id: string;
  name: string | null;
  lastReadAt: string | null;
  lastMessage: { id: string; sentAt: string } | null;
}

interface MessageItem {
  id: string;
  body: string | null;
  sentAt: string;
}

interface HistoryItem {
  id: string;
  title: string;
  detail: string;
  sentAt: string;
  severity: 'danger' | 'info';
}

function parseHistoryItem(m: MessageItem): HistoryItem {
  const lines = m.body?.split('\n') ?? [];
  const header = lines[0] ?? '';
  return {
    id: m.id,
    severity: header.startsWith('[CRITICAL]') ? 'danger' : 'info',
    title: header.replace(/^\[CRITICAL\]\s*/, ''),
    detail: lines.slice(1).join('\n'),
    sentAt: m.sentAt,
  };
}

// Dizajn dok. §5d — "Zvono za obaveštenja": informativna istorija, razlika od Inbox ikonice
// (Inbox = čeka moju odluku, zvono = samo obavešten sam). "Zvono čuva i ono što je zatvoreno
// iz iskačućih obaveštenja (§5e)" — isti izvor podataka kao NotificationStack.tsx ("Obaveštenja"
// M19 razgovor), ne novi backend mehanizam. Namerno uže od pune spec formulacije ("nova poruka
// u M19 chat-u" bilo kog razgovora, M18 upozorenje) — obuhvata samo sistemski "Obaveštenja"
// razgovor (isti obim kao §5e toast kartice); proširenje na svaki M19 razgovor ostaje otvoreno
// (M17 spec, vidi verzija ispod).
export default function NotificationBell() {
  const { openTab } = useTabs();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/chat/conversations', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const conversations: ConversationSummary[] = await res.json();
        const obavestenja = conversations.find((c) => c.name === 'Obaveštenja');
        if (!obavestenja) return;
        setConversationId(obavestenja.id);
        const lastMessageAt = obavestenja.lastMessage?.sentAt ?? null;
        const lastReadAt = obavestenja.lastReadAt ?? null;
        setUnread(Boolean(lastMessageAt && (!lastReadAt || new Date(lastMessageAt) > new Date(lastReadAt))));
      } catch {
        // bez podataka — zvono ostaje u mirnom stanju
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || !conversationId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, { cache: 'no-store' });
      if (res.ok) {
        const messages: MessageItem[] = await res.json();
        setItems(messages.map(parseHistoryItem).reverse());
      }
    } catch {
      setItems([]);
    }
    setUnread(false);
    fetch(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
  }

  if (conversationId === null) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Obaveštenja — istorija"
        // Kvadratni "tag" (5.9.2026, vlasnikov zahtev: "ikone u desnoj traci takodje stavite u
        // tagove, kao sto su u levoj") — isti jezik kao `ActivityBar.tsx` bedž (36px, `rounded-md`,
        // `bg-panel`/`bg-accent-soft`), otkad je ovo dugme preseljeno iz `TopBar.tsx` u `RightRail.tsx`.
        className={`relative flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md ${
          open ? 'bg-accent-soft text-accent-strong' : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'
        }`}
      >
        <Icon name="bell" />
        {unread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
          {items === null && <p className="px-3 py-2 text-ink-faint">Učitavanje…</p>}
          {items !== null && items.length === 0 && <p className="px-3 py-2 text-ink-faint">Nema obaveštenja.</p>}
          {items !== null && items.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="border-b border-border px-3 py-2 last:border-b-0">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${item.severity === 'danger' ? 'bg-danger' : 'bg-accent'}`} />
                    <span className="font-medium text-ink">{item.title}</span>
                  </div>
                  {item.detail && <p className="mb-1 line-clamp-3 font-mono text-[11px] text-ink-faint">{item.detail}</p>}
                  <span className="text-[11px] text-ink-faint">{new Date(item.sentAt).toLocaleString('sr-RS')}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              openTab('/chat/' + conversationId, 'Obaveštenja');
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-1 border-t border-border px-3 py-1.5 text-[11px] font-medium text-accent hover:text-accent-strong"
          >
            Otvori razgovor <Icon name="arrow-right" />
          </button>
        </div>
      )}
    </div>
  );
}
