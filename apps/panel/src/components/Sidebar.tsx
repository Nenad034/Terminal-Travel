'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import SearchSidebarPanel from './SearchSidebarPanel';
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
  onExpand,
}: {
  items: NavItem[];
  activeGroup: NavGroup | null;
  mePresent: boolean;
  onCollapse: () => void;
  collapsed?: boolean;
  onExpand?: () => void;
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

  // Kolabovano — tanka traka, ali ikonice TRENUTNO AKTIVNE sekcije ostaju vidljive (na
  // zahtev vlasnika, 19.8.2026), ne prazna traka. Ostale sekcije grupe se ne prikazuju
  // ovde — proširi traku za pun spisak.
  if (collapsed) {
    return (
      <nav className="flex h-full flex-col items-center gap-1 overflow-y-auto bg-panel-2 py-3">
        <button onClick={onExpand} title="Proširi levu traku" className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink">
          <Icon name="chevron-right" />
        </button>
        {(selected ? [selected] : sectionItems).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            title={item.label}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded ${
              item.id === selected?.id ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
            }`}
          >
            <Icon name={item.icon} />
          </Link>
        ))}
        {/* Logo na dnu levog panela (22.8.2026, na zahtev vlasnika) — kolabovano stanje dobija
            samo ikonicu (avion/circuit glif), bez naziva (nema mesta na 40px). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/terminal-travel-icon.png" alt="Terminal Travel" className="mt-auto w-6 flex-shrink-0" />
      </nav>
    );
  }

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
      {/* Logo na dnu levog panela (22.8.2026, na zahtev vlasnika — "dajte mi predlog kako da
          ovaj logo stavimo u donji deo levog panela"). `mt-auto` ga gura na dno kad ima
          slobodnog prostora (isti trik kao "Administracija" ikonica na dnu ActivityBar.tsx);
          ako sadržaj sekcije preraste visinu panela, logo jednostavno ide posle liste u
          scroll-u, ne ostaje zalepljen za dno viewport-a — prihvatljiv kompromis, isto
          ponašanje kao footer u većini scroll kontejnera. `terminal-travel-logo.png` je
          providna verzija zvaničnog loga (pozadina/šahovnica programski uklonjena — izvorna
          slika je isporučena bez prave providnosti, ni JPG ni prvi PNG pokušaj). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/terminal-travel-logo.png" alt="Terminal Travel" className="mx-4 mt-auto w-auto max-w-[70%] flex-shrink-0 self-center pt-3" />
    </nav>
  );
}
