'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import { useTabs } from './TabsContext';
import NotificationBell from './NotificationBell';
import { NAV_ITEMS, type NavGroup } from '@/lib/nav';

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

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — gornja traka nosi grupe modula kao ikonice
// (9 umesto 17 pojedinačnih sekcija). Administracija namerno na suprotnom kraju trake od
// radnih grupa (isti princip kao VS Code zupčanik za podešavanja) — vidljivo kroz
// `ml-auto` na toj jednoj ikonici, ne poseban niz.
export default function TopBar({
  fullName,
  roles,
  groups,
  activeGroupId,
  onSelectGroup,
  rightPanelOpen,
  onToggleRightPanel,
}: {
  fullName: string;
  roles: string[];
  groups: NavGroup[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
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
      <span className="mr-1 font-mono font-bold tracking-wide text-accent">TERMINAL</span>
      {groups.map((group, idx) => {
        const single = group.itemIds.length === 1 ? NAV_ITEMS.find((i) => i.id === group.itemIds[0]) : null;
        const active = group.id === activeGroupId;
        // Administracija je poslednja stavka u NAV_GROUPS namerno (M17 spec §4a) — ml-auto
        // je razmak, ne preslagivanje redosleda.
        const isLast = idx === groups.length - 1 && groups.length > 1;
        const className = `flex h-[43px] w-[43px] flex-shrink-0 items-center justify-center rounded ${isLast ? 'ml-auto' : ''} ${
          active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`;
        if (single) {
          return (
            <Link key={group.id} href={single.href} title={group.label} className={className}>
              <Icon name={group.icon} />
            </Link>
          );
        }
        return (
          <button key={group.id} title={group.label} onClick={() => onSelectGroup(group.id)} className={className}>
            <Icon name={group.icon} />
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        className="flex items-center gap-2 rounded border border-border bg-panel px-2 py-1 font-mono text-ink-faint hover:border-accent"
      >
        <Icon name="search" />
        traži ili izvrši
        <kbd className="rounded border border-border bg-panel-2 px-1 text-[10px]">Ctrl K</kbd>
      </button>
      <span className="text-ink-dim">
        {fullName} <span className="text-ink-faint">· {roles.join(', ')}</span>
      </span>
      <ThemeToggle />
      <NotificationBell />
      <InboxButton />
      <button
        onClick={onToggleRightPanel}
        title="Desni panel — sažetak/Povezano (dizajn dok. §5b)"
        className={`flex h-[43px] w-[43px] items-center justify-center rounded border ${
          rightPanelOpen ? 'border-accent text-accent' : 'border-border bg-panel text-ink-faint hover:border-accent hover:text-ink'
        }`}
      >
        <Icon name={rightPanelOpen ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} />
      </button>
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-[43px] w-[43px] items-center justify-center rounded border border-border bg-panel text-ink-faint hover:border-danger hover:text-danger"
      >
        <Icon name="sign-out" />
      </button>
    </header>
  );
}
