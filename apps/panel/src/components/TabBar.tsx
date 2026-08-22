'use client';

import Link from 'next/link';
import { useTabs } from './TabsContext';
import Icon from './Icon';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — traka tabova.
// ISPRAVKA (21.8.2026, na zahtev vlasnika: "tabovi treba da izgledaju kao tagovi u donjem redu
// chata") — poništava prethodni "pravi VS Code" pravougaoni oblik (border-r/border-t-2), sad
// isti tag/pilula oblik kao dugmad brzih prečica u AiChatBox.tsx (`rounded border border-ink-faint
// px-2 py-0.5 text-[11px]`) radi vizuelne doslednosti dva reda koja su blizu jedan drugom.
// ISKOŠENE IVICE (22.8.2026, na zahtev vlasnika: "leva i desna strana tabova i tagova budu
// iskošene pod 20%", potvrđeno preko AskUserQuestion — "paralelogram" oblik) — spoljašnji
// element `skewX(-20deg)`, unutrašnji sadržaj kontra-transformiše `skewX(20deg)` da tekst/
// ikonice ostanu uspravni (standardna tehnika za koso-obeleženi tab/tag oblik, npr. Chrome
// tabovi). `rounded` klasa uklonjena — oštri dijagonalni uglovi, ne zaobljeni (pravi
// paralelogram). Ista tehnika primenjena i u AiChatBox.tsx (dugmad brzih prečica).
export default function TabBar() {
  const { tabs, activePath, closeTab, closeAllTabs } = useTabs();

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            style={{ transform: 'skewX(-20deg)' }}
            className={`group flex max-w-[200px] flex-shrink-0 border px-2 py-0.5 text-[11px] transition-colors ${
              active ? 'border-accent bg-accent-soft text-ink' : 'border-ink-faint text-ink-faint hover:border-accent hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-1.5" style={{ transform: 'skewX(20deg)' }}>
              {tab.dirty && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" title="Nesačuvane izmene" />}
              <span className="truncate">{tab.label}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                  className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-danger-bg hover:text-danger"
                >
                  <Icon name="close" className="!text-[12px]" />
                </span>
              )}
            </span>
          </Link>
        );
      })}
      <Link
        href="/"
        title="Nov tab — Početna (docs/analize/29-DIZAJN-SISTEM-UI.md §5a)"
        className="flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
      >
        <Icon name="add" className="!text-[14px]" />
      </Link>
      {/* Na zahtev vlasnika, 19.8.2026 — vidljivo tek kad ima "previše" otvorenih tabova. */}
      {tabs.length > 3 && (
        <button
          onClick={closeAllTabs}
          title="Zatvori sve tabove"
          className="ml-auto flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger"
        >
          <Icon name="close-all" className="!text-[14px]" />
        </button>
      )}
    </div>
  );
}
