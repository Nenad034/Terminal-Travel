'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import TabBar from './TabBar';
import { useTabs } from './TabsContext';
import NotificationBell from './NotificationBell';

interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

// Dizajn dok. §5c / M15 spec poglavlje 6 — "stalno vidljiva ikonica sa brojem na kraju gornje
// trake", ne stavka menija. Agent Inbox nema sopstvenu rutu — isti agregovan prikaz kao
// kontrolna tabla (Početna, M17 spec §5, kartica "Agent Inbox — čeka odobrenje") — klik zato
// otvara Početnu kao nov tab, ne novu stranicu. Nema M15/agent-inbox/VIEW dozvolu → 403 →
// ikonica se ne prikazuje (isti princip ćutljivog izostavljanja kao StatusBar AI status).
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
      className="relative flex h-[43px] w-[43px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
    >
      <Icon name="inbox" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-semibold leading-none text-accent-ink">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — grupne ikonice preseljene u ActivityBar.tsx
// (vertikalna traka, 21.8.2026) — gornja traka sad nosi tabove, pretragu i desni klaster
// dugmadi. "TT Terminal Travel" naziv UKLONJEN (22.8.2026, na zahtev vlasnika, posle dodavanja
// punog loga na dno Sidebar-a, Sidebar.tsx v1.71 — postao je suvišan/dupliran). ISPRAVKA (isti
// dan, odmah zatim: "tabove ostavite gde su i bili ne treba da idu skroz u levo") — uklanjanje
// naziva je pomerilo tabove skroz do leve ivice trake, što nije bilo traženo; dodat prazan
// razmak fiksne širine (`w-[255px]`, ista vrednost koju je zauzimao naziv u podrazumevanom
// stanju Sidebar-a) da tabovi ostanu vizuelno na istoj poziciji kao pre — bez teksta/sadržaja,
// i bez dinamičkog praćenja širine Sidebar-a (ta računica je uklonjena zajedno sa nazivom,
// namerno pojednostavljeno na fiksnu vrednost).
export default function TopBar({
  rightPanelOpen,
  onToggleRightPanel,
}: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <header className="flex h-[43px] flex-shrink-0 items-center gap-1 bg-panel-2 px-2 text-xs">
      <div className="w-[255px] flex-shrink-0" />
      <div className="flex h-full min-w-0 flex-1">
        <TabBar />
      </div>
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        // Visina izjednačena sa tabovima (22.8.2026, na zahtev vlasnika: "tabovi neka budu
        // visine kao i polje pretrage" — obe strane usklađene na h-[29px], TabBar.tsx).
        className="flex h-[29px] items-center gap-2 rounded border border-border bg-panel px-2 font-mono text-ink-faint hover:border-accent"
      >
        <Icon name="search" />
        traži ili izvrši
        <kbd className="rounded border border-border bg-panel-2 px-1 text-[10px]">Ctrl K</kbd>
      </button>
      <ThemeToggle />
      <NotificationBell />
      <InboxButton />
      <button
        onClick={onToggleRightPanel}
        title="Desni panel — sažetak/Povezano (dizajn dok. §5b)"
        className={`flex h-[43px] w-[43px] items-center justify-center rounded ${
          rightPanelOpen ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`}
      >
        <Icon name={rightPanelOpen ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} />
      </button>
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-[43px] w-[43px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-danger"
      >
        <Icon name="sign-out" />
      </button>
    </header>
  );
}
