'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import TabBar from './TabBar';
import CustomizeLayoutButton from './CustomizeLayoutButton';
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
// dugmadi. Logo VRAĆEN u gornju traku (23.8.2026, na zahtev vlasnika: "Uklonite logo iz levog
// panela onemogucava da se panel skroz zatvori... stavite na gornju traku iznad levog panela")
// — poništava v1.71/v1.72 obrazac (logo je bio na dnu Sidebar-a, sprečavao potpuno kolabovanje
// jer `<img>` bez eksplicitne širine ne skuplja flex kontejner ispod svoje prirodne veličine).
// Zauzima ISTI `w-[255px]` prostor koji je ranije bio prazan razmak (v1.72) — taj razmak je već
// bio poravnat sa ActivityBar+Sidebar kolonom ispod (43px+224px podrazumevana širina, minus
// 12px padding/gap header-a = 255px, v1.65 računica), pa popunjavanje logotipom automatski
// zadovoljava i "iznad levog panela" i "prvi tab počinje od leve ivice centralnog panela" (širina
// spacer-a nepromenjena, tabovi ostaju na istoj poziciji).
//
// ISPRAVKA (23.8.2026, prvi pokušaj — na zahtev vlasnika, uz snimak ekrana: "i dalje prvi tab
// stoji gde ne treba") — statična `w-[255px]` vrednost je pretpostavljala PROŠIRENU bočnu traku;
// kad je kolabovana/sakrivena, razmak je ostajao preširok. POKUŠAJ 1 (binarno prošireno/uska,
// v1.95) je i dalje bio netačan — druga uživo provera je pokazala da tab i dalje NE stoji tačno
// na ivici centralnog panela (leva kolona ima previše promenljivih stanja — kolabovano/prošireno/
// ručno prevučeno 180-420px/sakriveno — da bi se unapred pogodilo). KONAČNA ISPRAVKA (isti dan,
// drugi pokušaj) — `leftColumnWidth` se više ne pogađa, nego se STVARNO MERI u `Shell.tsx` preko
// `ResizeObserver` nad stvarno renderovanom ActivityBar+Sidebar kolonom i prosleđuje ovde kao
// tačan broj piksela — radi u svakom stanju, uključujući uživo prevlačenje granice.
const HEADER_PADDING_GAP = 12; // header `px-2` (8px) + `gap-1` (4px) pre spacer diva, v1.65 računica

export default function TopBar({
  leftColumnWidth,
  rightPanelOpen,
  onToggleRightPanel,
  layoutProps,
}: {
  leftColumnWidth: number;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  layoutProps: Omit<ComponentProps<typeof CustomizeLayoutButton>, 'rightPanelOpen' | 'onToggleRightPanel'>;
}) {
  const spacerWidth = Math.max(0, leftColumnWidth - HEADER_PADDING_GAP);
  const showLabel = spacerWidth >= 100;
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <header className="flex h-[43px] flex-shrink-0 items-center gap-1 bg-panel-2 px-2 text-xs">
      <div
        className={`flex flex-shrink-0 items-center gap-2 overflow-hidden ${showLabel ? 'px-2' : 'justify-center px-0'}`}
        style={{ width: spacerWidth }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/terminal-travel-icon.png" alt="Terminal Travel" className={`flex-shrink-0 ${showLabel ? 'h-5 w-5' : 'h-4 w-4'}`} />
        {showLabel && <span className="truncate text-sm font-semibold tracking-wide text-ink">Terminal Travel</span>}
      </div>
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
    </header>
  );
}
