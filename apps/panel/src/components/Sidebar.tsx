'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import SearchSidebarPanel from './SearchSidebarPanel';
import SavedViewsSidebarPanel from './SavedViewsSidebarPanel';
import type { NavGroup, NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — leva traka prikazuje spisak sekcija AKTIVNE
// grupe (obično 2-4 stavke); klik na jednu sekciju kolabira prikaz na samo tu sekciju,
// strelica nazad vraća spisak grupe bez gubljenja mesta grupe. Aktivna grupa se bira u
// gornjoj traci (Shell.tsx) — ovaj komponent samo prikazuje njen sadržaj.
export default function Sidebar({
  items,
  activeGroup,
  mePresent,
  onCollapse,
  collapsed,
}: {
  items: NavItem[];
  activeGroup: NavGroup | null;
  mePresent: boolean;
  onCollapse: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [forceShowList, setForceShowList] = useState(false);

  useEffect(() => {
    setForceShowList(false);
  }, [activeGroup?.id]);

  if (!mePresent || !activeGroup) return null;

  const sectionItems = activeGroup.itemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is NavItem => Boolean(i));

  const selected = !forceShowList
    ? sectionItems.find((i) => pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href)))
    : undefined;

  // Kolabovano — TRAKA NESTAJE POTPUNO (23.8.2026, na zahtev vlasnika: "kada uvlacimu levi
  // panel, treba da ostane samo leva traka [ActivityBar] ne i ova druga kolona"), poništava
  // v1.x "tanka traka sa ikonicama" obrazac (19.8.2026). `ResizablePane` (Shell.tsx) sad
  // kolabuje na 0px umesto 40px — ova grana više nema gde da se prikaže (overflow-hidden na
  // 0-širinom kontejneru), pa se ovde ni ne pokušava renderovati (mrtav kod bi ostao ako bi
  // se prikazivao samo u markup-u nikad na ekranu). Ponovno širenje ide preko `ActivityBar.tsx`
  // (klik na već aktivnu grupu), ne preko strelice koja je ranije živela ovde.
  if (collapsed) return null;

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto bg-panel-2 py-3">
      <button
        onClick={onCollapse}
        title="Skupi levu traku"
        className="mx-2 mb-1 flex h-[29px] w-[29px] flex-shrink-0 items-center justify-center self-end rounded text-ink-faint hover:bg-panel hover:text-ink"
      >
        <Icon name="chevron-left" />
      </button>
      {selected ? (
        <>
          <button
            onClick={() => setForceShowList(true)}
            className="mx-2 mb-2 flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name="chevron-left" />
            <span className="truncate">{activeGroup.label}</span>
          </button>
          <div className="mx-2 mb-1 flex items-center gap-2 px-2 text-xs font-medium text-ink">
            <Icon name={selected.icon} />
            <span className="truncate">{selected.label}</span>
          </div>
          {/* M5 pretraga — vođena pretraga + filteri u levom panelu (dizajn dok. §5b/§6d),
              van obima za ostatak sekcija (M17 spec §4a), ostaje sledeći korak po sekciji. */}
          {selected.id === 'pretraga' && <SearchSidebarPanel />}
          {/* Sačuvani prikazi (24.8.2026, na zahtev vlasnika: "Filtere za listu rezervacija
              stavimo u levi panel... Ima dosta praznog prostora") — dizajn dok. §5b, isti
              obrazac kao pretraga iznad, samo za "Lista rezervacija". */}
          {selected.id === 'rezervacije-lista' && <SavedViewsSidebarPanel />}
        </>
      ) : (
        <>
          <div className="mx-2 mb-2 flex items-center gap-2 px-2 text-xs font-medium text-ink-faint">
            <Icon name={activeGroup.icon} />
            <span className="truncate">{activeGroup.label}</span>
          </div>
          {sectionItems.map((item) => {
            if (!item.implemented) {
              return (
                <div
                  key={item.id}
                  title={`${item.label} — dostupno od Faze ${item.phase} (nije još implementirano)`}
                  className="mx-2 flex items-center gap-3 rounded px-2 py-2 text-ink-faint opacity-40"
                >
                  <span className="flex w-[29px] items-center justify-center">
                    <Icon name="lock" />
                  </span>
                  <span className="flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap text-xs">
                    <span className="truncate">{item.label}</span>
                    <span className="ml-2 rounded-full bg-panel px-1.5 py-0.5 text-[10px] font-mono">F{item.phase}</span>
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                className="mx-2 flex items-center gap-3 rounded px-2 py-2 text-sm text-ink-dim hover:bg-panel hover:text-ink"
              >
                <span className="flex w-6 items-center justify-center">
                  <Icon name={item.icon} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}
