'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import CustomizeLayoutButton from './CustomizeLayoutButton';
import { useTabs } from './TabsContext';

interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

// Dizajn dok. §5c / M15 spec poglavlje 6 — "stalno vidljiva ikonica sa brojem", ne stavka menija.
// Premešteno iz `TopBar.tsx` (5.9.2026, vlasnikov zahtev: "formirajte desnu traku i tu smestite
// sve ikone iz gornje trake iz desnog ugla") — logika NEPROMENJENA, samo mesto u kodu.
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
        <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[11px] font-semibold leading-none text-accent-ink">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// Desna vertikalna traka (5.9.2026, vlasnikov zahtev) — ogledalo `ActivityBar.tsx` na suprotnoj
// ivici ekrana. Sve ikonice koje su do sad stajale u desnom uglu `TopBar.tsx` (tema, zvono,
// Agent Inbox, Customize Layout, desni panel, odjava) sele se ovde — gornja traka posle ovoga
// nosi ISKLJUČIVO tabove + ikonicu "zatvori sve tabove" (`TabBar.tsx`, već postojala).
// AI Agent ikonica (do sad poslednja stavka `ActivityBar.tsx`, v1.76) prelazi na DNO ove trake
// (`mt-auto`, isti obrazac kao Administracija/AI u ActivityBar-u ranije) — vlasnikov zahtev:
// "ikonu za AI Agenta premesti u dno desne trake".
export default function RightRail({
  rightPanelOpen,
  onToggleRightPanel,
  layoutProps,
}: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  layoutProps: Omit<ComponentProps<typeof CustomizeLayoutButton>, 'rightPanelOpen' | 'onToggleRightPanel'>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <nav className="flex w-[43px] flex-shrink-0 flex-col items-center gap-1 bg-panel-2 py-1">
      <ThemeToggle />
      <NotificationBell />
      <InboxButton />
      <CustomizeLayoutButton {...layoutProps} rightPanelOpen={rightPanelOpen} onToggleRightPanel={onToggleRightPanel} />
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
      <div className="relative mt-auto flex-shrink-0">
        <Link
          href="/ai-asistent"
          title="AI asistent"
          className={`flex h-[36px] w-[36px] items-center justify-center rounded-md ${
            pathname === '/ai-asistent' ? 'bg-accent-soft text-accent-strong' : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'
          }`}
        >
          <Icon name="sparkle" />
        </Link>
      </div>
    </nav>
  );
}
