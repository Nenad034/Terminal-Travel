'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import { NAV_ITEMS, type NavGroup } from '@/lib/nav';

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
}: {
  fullName: string;
  roles: string[];
  groups: NavGroup[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
}) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-1 border-b border-border bg-panel-2 px-2 text-xs">
      <span className="mr-1 font-mono font-bold tracking-wide text-accent">TERMINAL</span>
      {groups.map((group, idx) => {
        const single = group.itemIds.length === 1 ? NAV_ITEMS.find((i) => i.id === group.itemIds[0]) : null;
        const active = group.id === activeGroupId;
        // Administracija je poslednja stavka u NAV_GROUPS namerno (M17 spec §4a) — ml-auto
        // je razmak, ne preslagivanje redosleda.
        const isLast = idx === groups.length - 1 && groups.length > 1;
        const className = `flex h-9 w-9 flex-shrink-0 items-center justify-center rounded ${isLast ? 'ml-auto' : ''} ${
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
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-9 w-9 items-center justify-center rounded border border-border bg-panel text-ink-faint hover:border-danger hover:text-danger"
      >
        <Icon name="sign-out" />
      </button>
    </header>
  );
}
