'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import TabBar from './TabBar';
import CommandPalette from './CommandPalette';
import ResizablePane from './ResizablePane';
import StatusBar from './StatusBar';
import AiChatBox from './AiChatBox';
import RightPanel from './RightPanel';
import NotificationStack from './NotificationStack';
import { TabsProvider } from './TabsContext';
import { SelectionProvider } from './SelectionContext';
import { NAV_GROUPS, groupForHref, moduleCodeForHref, type NavItem } from '@/lib/nav';

const SIDEBAR_COLLAPSED_KEY = 'tt-panel-sidebar-collapsed';

export default function Shell({
  fullName,
  roles,
  items,
  children,
}: {
  fullName: string;
  roles: string[];
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Grupa bez ijedne stavke koju ovaj korisnik sme da vidi se u potpunosti uklanja (M17
  // spec §3 — "ne samo onemogućeno", isti princip kao visibleNavItems).
  const groups = useMemo(() => NAV_GROUPS.filter((g) => g.itemIds.some((id) => items.some((i) => i.id === id))), [items]);

  const [activeGroupId, setActiveGroupId] = useState(() => groupForHref(pathname)?.id ?? groups[0]?.id ?? 'pocetna');
  // VS Code obrazac — leva traka se skuplja na tanku traku, ne nestaje (na zahtev vlasnika,
  // 19.8.2026). Podrazumevano `false` na SERVERU I na prvom klijentskom renderu (moraju biti
  // identični zbog hidratacije) — localStorage se čita tek u useEffect POSLE hidratacije, isti
  // bezbedan obrazac kao ResizablePane.tsx. Ranija verzija je čitala localStorage direktno u
  // useState inicijalizatoru, što je pravilo neusklađenost server/klijent prvog rendera kad god
  // je sačuvana vrednost bila "1" — uzrok prijavljene "Hydration failed" greške (21.8.2026).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') setSidebarCollapsed(true);
    } catch {
      // localStorage nedostupan — ostaje podrazumevano prošireno
    }
  }, []);
  const setCollapsed = (v: boolean) => {
    setSidebarCollapsed(v);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '1' : '0');
    } catch {
      // localStorage nedostupan — i dalje radi za ovu sesiju
    }
  };
  // Desni panel se pojavljuje prema potrebi (dizajn dok. §5b — sažetak reda/"Povezano" traka),
  // ne podrazumevano otvoren. Jedini namerni auto-otvarač je M5 selekcija pretrage (§3.0e.3,
  // §6d "predlog... pojavljuje se odmah po dodavanju stavke") — SelectionProvider poziva
  // `onFirstAdd` kad prva stavka uđe u selekciju, isto ponašanje kao klik na dugme.
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  return (
    <TabsProvider homeLabel="Početna">
      <SelectionProvider onFirstAdd={() => setRightPanelOpen(true)}>
        {/* VS Code obrazac, ISPRAVKA (21.8.2026, na zahtev vlasnika, uz stvaran VS Code
            snimak ekrana kao referencu: "ne sviđa mi se [prethodni pokušaj sa linijama/
            razmakom]... uklonite linije oko traka i panela, neka razdvajanje bude različitim
            tonovima boje"). Prethodni prolaz (v1.42) je uveo `border-frame` liniju + `gap-1.5`
            razmak + `rounded-lg` oko svake trake — vizuelno je ispalo kao "plutajuće kartice",
            ne kao pravi VS Code (koji nema linije NI razmak između susednih zona, samo tonsku
            razliku pozadine, potpuno pripijene ivice, bez zaobljenosti). Ispravljeno: nema
            više `border-frame`/`gap`/`rounded-lg` ovde — razdvajanje ide isključivo preko
            DVA tona koja se ponavljaju kroz trake: `bg-panel-2` (hrom — TopBar/Sidebar/
            TabBar/StatusBar/RightPanel) naspram `bg-panel` (sadržaj — glavni panel, aktivan
            tab, AiChatBox). Kad su dve susedne zone istog tona (npr. TopBar iznad TabBar-a),
            namerno se vizuelno stapaju u jednu masu, isto kao naslovna traka i traka tabova
            u pravom VS Code-u. */}
        <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
          <TopBar
            fullName={fullName}
            roles={roles}
            groups={groups}
            activeGroupId={activeGroup?.id ?? ''}
            onSelectGroup={setActiveGroupId}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
          />
          <div className="flex flex-1 overflow-hidden">
            <ResizablePane
              storageKey="tt-panel-sidebar-width"
              defaultWidth={224}
              minWidth={180}
              maxWidth={420}
              collapsed={sidebarCollapsed}
              collapsedWidth={40}
            >
              <Sidebar
                items={items}
                activeGroup={activeGroup}
                mePresent
                collapsed={sidebarCollapsed}
                onCollapse={() => setCollapsed(true)}
                onExpand={() => setCollapsed(false)}
              />
            </ResizablePane>
            <div className="flex flex-1 flex-col overflow-hidden bg-panel-2">
              <TabBar />
              {/* Sadržaj i AI chat su NAMERNO razdvojene širine (21.8.2026, na zahtev vlasnika —
                  sadržaj na 90% širine panela, chat 20% uži od toga, 90%×0.8=72%), za razliku
                  od ranijeg jedinstvenog w-[56%] omotača (19.8.2026, "prikaz na širinu chata").
                  Svaki deo se centrira nezavisno (mx-auto). BAG (21.8.2026, prijavio vlasnik uživo
                  uz snimak ekrana: "Prikaz u centralnom panelu nije na 90%") — `--bg` i `--panel`
                  su NAMERNO ista boja u oba moda (§ komentar globals.css), pa je margina oko
                  `w-[90%]` sadržaja bila nevidljiva kad je ovaj omotač nasleđivao `bg-bg` sa
                  spoljašnjeg wrapper-a — 90% je stvarno bilo primenjeno, samo se nije videlo.
                  Ispravljeno dodavanjem `bg-panel-2` baš na ovaj omotač: margine oko `main`
                  sad se vide kao traka drugog tona (ista `panel-2` porodica kao TabBar iznad),
                  isti princip kao razdvajanje trake/sadržaja svuda drugde u školjci. */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <main className="mx-auto w-[90%] flex-1 overflow-y-auto bg-panel">{children}</main>
                {/* Dizajn dok. §6c — AI razgovor pratilac, uvek deo centralnog panela bez obzira
                    koji modul je aktivan. Bez linije/okvira (21.8.2026) — razdvaja se od
                    sadržaja iznad samo blagom senkom (shadow-sm), ista `bg-panel` tonska
                    porodica kao glavni sadržaj. */}
                <div className="mx-auto my-2 w-[72%] flex-shrink-0 bg-panel shadow-sm">
                  <AiChatBox />
                </div>
              </div>
            </div>
            {rightPanelOpen && (
              <ResizablePane storageKey="tt-panel-right-width" defaultWidth={320} minWidth={260} maxWidth={560} handleSide="left">
                <RightPanel onClose={() => setRightPanelOpen(false)} />
              </ResizablePane>
            )}
          </div>
          <StatusBar fullName={fullName} roleLabel={roles.join(', ')} moduleCode={moduleCodeForHref(pathname)} />
        </div>
        <CommandPalette items={items} />
        <NotificationStack />
      </SelectionProvider>
    </TabsProvider>
  );
}
