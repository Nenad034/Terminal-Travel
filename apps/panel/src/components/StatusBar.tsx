'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import BrandIcon from './BrandIcon';
import { useTabs } from './TabsContext';
import { NAV_ITEMS } from '@/lib/nav';

type Activation = 'NOT_READY' | 'READY_FOR_ACTIVATION' | 'ACTIVATED';

const AI_LABEL: Record<Activation, string> = {
  NOT_READY: 'AI: nije spreman',
  READY_FOR_ACTIVATION: 'AI: čeka uključenje',
  ACTIVATED: 'AI: uključen',
};

// Dizajn dok. §5d — donja traka: nalog, status veze, AI status po modulu, sat, okruženje,
// klaster pokretača (Mejl/Interni chat/WhatsApp/Viber/Telegram). "Status veze" namerno nema
// sopstveni /health poziv — koristi isti poziv kao AI status (jedini redovan client-side
// poziv ka API-ju sa ovog ekrana), isti princip kao "ne uvoditi novi endpoint samo za ovo".
export default function StatusBar({
  fullName,
  roleLabel,
  moduleCode,
}: {
  fullName: string;
  roleLabel: string;
  moduleCode: string | null;
}) {
  const { openTab } = useTabs();
  const [connection, setConnection] = useState<'checking' | 'ok' | 'down'>('checking');
  const [aiStatus, setAiStatus] = useState<Activation | null>(null);
  const [aiVisible, setAiVisible] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messagesOpen) return;
    function onClick(e: MouseEvent) {
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node)) setMessagesOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [messagesOpen]);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!moduleCode) {
      setAiStatus(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/module-activation/${moduleCode}`);
        if (cancelled) return;
        if (res.status === 403 || res.status === 404) {
          // Nema M15/module-activation/VIEW dozvolu (većina uloga) ili modul nema aktivaciju
          // definisanu — isti princip kao poglavlje 3: sekcija se izostavlja, ne prikazuje grešku.
          setAiVisible(false);
          setConnection('ok');
          return;
        }
        if (!res.ok) {
          setConnection('down');
          return;
        }
        const body = await res.json();
        setAiStatus(body.status ?? null);
        setConnection('ok');
      } catch {
        if (!cancelled) setConnection('down');
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [moduleCode]);

  const email = NAV_ITEMS.find((i) => i.id === 'email');
  const chat = NAV_ITEMS.find((i) => i.id === 'chat');
  const tz = now?.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) ?? '';
  const env = process.env.NODE_ENV === 'production' ? 'PRODUKCIJA' : 'TEST';

  return (
    <footer className="flex h-6 flex-shrink-0 items-center gap-3 border-t border-border bg-panel-2 px-2 text-[11px] text-ink-faint">
      <span title={roleLabel}>
        {fullName} <span className="text-ink-faint">· {roleLabel}</span>
      </span>

      <span className="flex items-center gap-1" title="Status veze prema API-ju">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connection === 'ok' ? 'bg-ok' : connection === 'down' ? 'bg-danger' : 'bg-ink-faint'
          }`}
        />
        {connection === 'ok' ? 'Povezano' : connection === 'down' ? 'Nema veze' : 'Provera...'}
      </span>

      {aiVisible && moduleCode && aiStatus && <span title={`Domenski agent za ${moduleCode}`}>{AI_LABEL[aiStatus]}</span>}

      <span className="flex-1" />

      {tz && <span title="Vreme na ovom računaru">{tz}</span>}
      <span
        className="rounded border border-border px-1 font-mono text-[10px]"
        title="Okruženje na koje je ovaj panel povezan"
      >
        {env}
      </span>

      <span className="mx-1 h-3 w-px bg-border" />

      <div ref={messagesRef} className="relative">
        <button
          onClick={() => setMessagesOpen((v) => !v)}
          title="Poruke — Mejl, Interni chat, WhatsApp, Viber, Telegram"
          className={`flex h-[26px] w-[26px] items-center justify-center rounded ${
            messagesOpen ? 'bg-panel text-accent' : 'hover:bg-panel hover:text-ink'
          }`}
        >
          <Icon name="comment" />
        </button>
        {messagesOpen && (
          <div className="absolute bottom-full right-0 mb-1 w-52 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
            {email && (
              <button
                onClick={() => {
                  openTab(email.href, email.label);
                  setMessagesOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink"
              >
                <Icon name="mail" /> Mejl
              </button>
            )}
            {chat && (
              <button
                onClick={() => {
                  openTab(chat.href, chat.label);
                  setMessagesOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink"
              >
                <Icon name="comment-discussion" /> Interni chat
              </button>
            )}
            <div className="my-1 h-px bg-border" />
            <a
              href="https://web.whatsapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMessagesOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              <BrandIcon name="whatsapp" /> WhatsApp
            </a>
            <a
              href="viber://"
              onClick={() => setMessagesOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              <BrandIcon name="viber" /> Viber
            </a>
            <a
              href="https://web.telegram.org/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMessagesOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              <BrandIcon name="telegram" /> Telegram
            </a>
          </div>
        )}
      </div>
    </footer>
  );
}
