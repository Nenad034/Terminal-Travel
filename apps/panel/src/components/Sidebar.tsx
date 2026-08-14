'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import type { NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5 — tanka bočna traka, samo ikonice; širi se na
// hover/klik u stablo-strukturu (VS Code Explorer stil). Faza 0/1 nav je ravna lista (nema
// pod-sekcija još), ali struktura komponente već podržava ugnježđavanje kad se pojavi.
export default function Sidebar({ items, mePresent }: { items: NavItem[]; mePresent: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pathname = usePathname();
  const open = expanded || pinned;

  if (!mePresent) return null;

  return (
    <nav
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`flex flex-shrink-0 flex-col gap-0.5 border-r border-border bg-panel-2 py-3 transition-[width] duration-150 ${open ? 'w-56' : 'w-12'}`}
    >
      <button
        onClick={() => setPinned((p) => !p)}
        title={pinned ? 'Otkači bočnu traku' : 'Zakači bočnu traku otvorenu'}
        className="mx-2 mb-2 flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-accent-soft hover:text-accent-strong"
      >
        <Icon name={pinned ? 'chevron-left' : 'menu'} />
      </button>

      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        if (!item.implemented) {
          return (
            <div
              key={item.id}
              title={`${item.label} — dostupno od Faze ${item.phase} (nije još implementirano)`}
              className="mx-2 flex items-center gap-3 rounded px-2 py-2 text-ink-faint opacity-40"
            >
              <span className="flex w-5 items-center justify-center">
                <Icon name="lock" />
              </span>
              {open && (
                <span className="flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap text-xs">
                  <span className="truncate">{item.label}</span>
                  <span className="ml-2 rounded-full bg-panel px-1.5 py-0.5 text-[10px] font-mono">F{item.phase}</span>
                </span>
              )}
            </div>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            title={item.label}
            className={`mx-2 flex items-center gap-3 rounded px-2 py-2 text-sm ${
              active ? 'bg-accent-soft text-accent-strong' : 'text-ink-dim hover:bg-panel hover:text-ink'
            }`}
          >
            <span className="flex w-5 items-center justify-center">
              <Icon name={item.icon} />
            </span>
            {open && <span className="truncate whitespace-nowrap">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
