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
// element `skewX(-20deg)`. `rounded` klasa uklonjena — oštri dijagonalni uglovi, ne zaobljeni.
// ISPRAVKA (22.8.2026, isti dan, uz snimak ekrana: "nije bas najbolje stao tekst u tabovima...
// Tekst u tabovima i tagovima da prati kosi ugao. i ostre ivice zameniti vrlo blagim
// zaokruzenjem") — prvi pokušaj je kontra-transformisao SAMO sadržaj (`skewX(20deg)` na
// unutrašnjem span-u) da tekst ostane uspravan; to je pravilo da uspravan tekst vizuelno
// "izlazi" iz kosih ivica kutije u uglovima (tačno ono što je vlasnik video na snimku) —
// UKLONJEN kontra-transform, tekst/ikonice sad nasleđuju isti `skewX(-20deg)` kao kutija
// (bez dodatnog `style` na unutrašnjem span-u), prati ugao ivica. Uglovi dobijaju vrlo blago
// zaobljenje (`rounded-sm`, 2px) umesto potpuno oštrih. Visina izjednačena sa poljem za
// pretragu u `TopBar.tsx` (obe `h-[29px]`, ranije tabovi nisu imali eksplicitnu visinu nego
// su je nasleđivali od `<header>` reda preko `items-center`/padding-a).
export default function TabBar() {
  const { tabs, activePath, closeTab, closeAllTabs } = useTabs();

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-3 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            style={{ transform: 'skewX(-20deg)' }}
            className={`group flex h-[29px] max-w-[200px] flex-shrink-0 items-center gap-1.5 rounded-sm border px-3 text-[11px] transition-colors ${
              active ? 'border-accent bg-accent-soft text-ink' : 'border-ink-faint text-ink-faint hover:border-accent hover:text-ink'
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
                className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-danger-bg hover:text-danger"
              >
                <Icon name="close" className="!text-[12px]" />
              </span>
            )}
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
