'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import BrandIcon from './BrandIcon';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import CustomizeLayoutButton from './CustomizeLayoutButton';
import { useTabs } from './TabsContext';
import { NAV_ITEMS } from '@/lib/nav';

type Activation = 'NOT_READY' | 'READY_FOR_ACTIVATION' | 'ACTIVATED';

const AI_LABEL: Record<Activation, string> = {
  NOT_READY: 'AI: nije spreman',
  READY_FOR_ACTIVATION: 'AI: čeka uključenje',
  ACTIVATED: 'AI: uključen',
};

interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

// Dizajn dok. §5c / M15 spec poglavlje 6 — "stalno vidljiva ikonica sa brojem", ne stavka menija.
// Premešteno iz `TopBar.tsx` u `RightRail.tsx` (5.9.2026), pa iz `RightRail.tsx` OVDE (18.9.2026,
// vlasnikov zahtev: "ove ikone premestite jednu pored druge u [donju] traku u desni ugao ispred
// sata" + "uklonite desnu traku") — logika NEPROMENJENA, samo treće mesto u kodu.
function InboxButton() {
  const { openTab } = useTabs();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/ai-orchestration/inbox', { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setCount(null);
          return;
        }
        const sources: AgentInboxSource[] = await res.json();
        setCount(sources.reduce((sum, s) => sum + s.count, 0));
      } catch {
        if (!cancelled) setCount(null);
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (count === null) return null;

  return (
    <button
      onClick={() => openTab('/', 'Agent Inbox')}
      title="Agent Inbox — čeka odobrenje"
      className="relative flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
    >
      <Icon name="inbox" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[11px] font-semibold leading-none text-accent-ink">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// Dizajn dok. §5d — donja traka: nalog, status veze, AI status po modulu, klaster ikonica
// (tema/obaveštenja/Agent Inbox/Customize Layout/desni panel/odjava/AI asistent — vidi komentar
// uz `flex-1` razmak ispod), sat, okruženje, klaster pokretača (Mejl/Interni chat/WhatsApp/Viber/
// Telegram). "Status veze" namerno nema sopstveni /health poziv — koristi isti poziv kao AI
// status (jedini redovan client-side poziv ka API-ju sa ovog ekrana), isti princip kao "ne
// uvoditi novi endpoint samo za ovo".
export default function StatusBar({
  fullName,
  roleLabel,
  moduleCode,
  rightPanelOpen,
  onToggleRightPanel,
  layoutProps,
}: {
  fullName: string;
  roleLabel: string;
  moduleCode: string | null;
  /* Klaster ikonica ispod (18.9.2026) — vidi opširan komentar u JSX-u gde se koriste. */
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  layoutProps: Omit<
    ComponentProps<typeof CustomizeLayoutButton>,
    'rightPanelOpen' | 'onToggleRightPanel'
  >;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openTab } = useTabs();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }
  const [connection, setConnection] = useState<'checking' | 'ok' | 'down'>('checking');
  const [aiStatus, setAiStatus] = useState<Activation | null>(null);
  const [aiVisible, setAiVisible] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messagesOpen) return;
    function onClick(e: MouseEvent) {
      if (messagesRef.current && !messagesRef.current.contains(e.target as Node))
        setMessagesOpen(false);
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
  const tz =
    now?.toLocaleTimeString('sr-RS', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }) ?? '';
  const env = process.env.NODE_ENV === 'production' ? 'PRODUKCIJA' : 'TEST';

  return (
    <footer className="relative flex h-[43px] flex-shrink-0 items-center gap-3 bg-bar px-2 text-[11px] text-ink-faint">
      {/* Visina izjednačena sa gornjom trakom (5.9.2026, vlasnikov zahtev: "visina donje trake
          treba da bude ista kao i gornje trake") — bila je 29px (v1.65, poravnata sa poljem
          pretrage tada u TopBar-u), TopBar je oduvek 43px; sad su obe trake iste visine.
          "traži ili izvrši" (Ctrl K), na sredini trake (5.9.2026, "ovo prenesite iz gornje trake
          u donju traku tačno na sredinu") — dobija izgled TAGA (5.9.2026, vlasnikov zahtev:
          "Trazi ili izvrsi stavite u tag"), isti obrazac kartice/pilule kao ostali tagovi u
          panelu (`rounded-md border`), ne više go tekst. Centrirano preko `top-1/2
          -translate-y-1/2` (umesto ranijeg `top-0 h-[29px]`) da ostane vertikalno na sredini sad
          više trake. */}
      <button
        onClick={() =>
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }))
        }
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border bg-panel-2 px-2 py-1 font-mono text-ink-faint hover:border-accent hover:text-ink"
      >
        <Icon name="search" />
        traži ili izvrši
        <kbd className="rounded border border-border bg-panel px-1 text-[11px]">Ctrl T</kbd>
      </button>
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

      {aiVisible && moduleCode && aiStatus && (
        <span title={`Domenski agent za ${moduleCode}`}>{AI_LABEL[aiStatus]}</span>
      )}

      <span className="flex-1" />

      {/* Klaster ikonica (18.9.2026, vlasnikov zahtev: "ove ikone premestite jednu pored druge u
          [donju] traku u desni ugao ispred sata" + "uklonite desnu traku") — vraća ih u vodoravan
          niz u desnom uglu trake, tačno ispred sata, umesto vertikalne `RightRail.tsx` (obrisana,
          5.9.2026 → 18.9.2026 unazad). 31px (ne 36px kao u desnoj traci) — poravnato sa postojećim
          dugmetom "Poruke" u ovoj traci, bez `bg-panel` na mirnom stanju (traka je već `bg-bar`,
          isti razlog kao "Poruke" dugme). Padajući meniji zvona/Customize Layout OKRENUTI NAGORE
          (`bottom-full` umesto `top-full`) — ova traka je sad DNO ekrana, meni bi se otvorio ispod
          vidljive površine da je ostao okrenut nadole (isti obrazac kao "Poruke" meni tik ispod). */}
      <ThemeToggle />
      <NotificationBell />
      <InboxButton />
      <CustomizeLayoutButton
        {...layoutProps}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={onToggleRightPanel}
      />
      <button
        onClick={onToggleRightPanel}
        title="Desni panel — sažetak/Povezano (dizajn dok. §5b)"
        className={`flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded ${
          rightPanelOpen ? 'bg-panel text-accent' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`}
      >
        <Icon name={rightPanelOpen ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} />
      </button>
      <Link
        href="/ai-asistent"
        title="AI asistent"
        className={`flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded ${
          pathname === '/ai-asistent'
            ? 'bg-panel text-accent'
            : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`}
      >
        <Icon name="sparkle" />
      </Link>

      <span className="mx-1 h-3 w-px bg-border" />

      {tz && <span title="Vreme na ovom računaru">{tz}</span>}
      <span
        className="rounded border border-border px-1 font-mono text-[11px]"
        title="Okruženje na koje je ovaj panel povezan"
      >
        {env}
      </span>

      <span className="mx-1 h-3 w-px bg-border" />

      <div ref={messagesRef} className="relative">
        <button
          onClick={() => setMessagesOpen((v) => !v)}
          title="Poruke — Mejl, Interni chat, WhatsApp, Viber, Telegram"
          className={`flex h-[31px] w-[31px] items-center justify-center rounded ${
            messagesOpen ? 'bg-panel text-accent' : 'hover:bg-panel hover:text-ink'
          }`}
        >
          <Icon name="comment" />
        </button>
        {messagesOpen && (
          <div className="absolute bottom-full right-0 z-50 mb-1 w-52 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
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

      {/* Odjava — POSLEDNJA ikonica, sasvim desno (18.9.2026, vlasnikov zahtev: "stavite kao
          poslednju desno u donjoj traci"), odvojena razdelnikom kao vizuelno drugačija (jedina
          destruktivna akcija u ovoj traci). Boja linija STALNO tamno crvena (`text-danger`, ne
          samo na hover kao dosad) — isti zahtev. `--danger` (ne fiksna hex vrednost nezavisna od
          moda, kao npr. `--icon-line`/`--brand`) namerno — jedini semantički "opasno" token u
          paleti, već WCAG-proveren protiv `--bar` u sva tri moda (4,76 / 3,74 / 5,38, sve iznad
          3:1 praga za ikonice, izmereno 18.9.2026). */}
      <span className="mx-1 h-3 w-px bg-border" />
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded text-danger hover:bg-panel"
      >
        <Icon name="sign-out" />
      </button>
    </footer>
  );
}
