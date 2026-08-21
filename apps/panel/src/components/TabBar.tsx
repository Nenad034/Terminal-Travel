'use client';

import Link from 'next/link';
import { useTabs } from './TabsContext';
import Icon from './Icon';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — traka tabova (VS Code/browser stil).
export default function TabBar() {
  const { tabs, activePath, closeTab, closeAllTabs } = useTabs();

  return (
    <div className="flex h-[43px] flex-shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-bg px-1.5">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`group flex max-w-[200px] items-center gap-2 rounded-t px-3 py-2 text-xs ${
              active ? 'border border-b-0 border-border bg-panel text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {tab.dirty && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" title="Nesačuvane izmene" />}
            <span className="truncate">{tab.label}</span>
            {tabs.length > 1 && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
                className="flex h-[25px] w-[25px] flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-danger-bg hover:text-danger"
              >
                <Icon name="close" className="text-[16px]" />
              </span>
            )}
          </Link>
        );
      })}
      <Link
        href="/"
        title="Nov tab — Početna (docs/analize/29-DIZAJN-SISTEM-UI.md §5a)"
        className="flex h-[37px] w-[37px] flex-shrink-0 items-center justify-center self-center rounded text-ink-faint hover:bg-panel hover:text-ink"
      >
        <Icon name="add" className="text-[19px]" />
      </Link>
      {/* Na zahtev vlasnika, 19.8.2026 — vidljivo tek kad ima "previše" otvorenih tabova. */}
      {tabs.length > 3 && (
        <button
          onClick={closeAllTabs}
          title="Zatvori sve tabove"
          className="ml-auto flex h-[37px] w-[37px] flex-shrink-0 items-center justify-center self-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger"
        >
          <Icon name="close-all" className="text-[19px]" />
        </button>
      )}
    </div>
  );
}
