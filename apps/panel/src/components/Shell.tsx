'use client';

import { useMemo, useState } from 'react';
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
  // 19.8.2026). `useState(() => ...)` čita localStorage samo pri prvom renderu (isti obrazac
  // kao ResizablePane).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
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
            <div className="flex flex-1 flex-col overflow-hidden">
              <TabBar />
              {/* Sadržaj i AI chat dele TAČNO istu širinu — jedan zajednički omotač (na zahtev
                  vlasnika, 19.8.2026: "prikaz na širinu chata"), ne dva odvojena w-[56%] div-a
                  koja bi mogla vremenom da se razjednače. Centrirano (mx-auto) da prazan prostor
                  ne padne samo na jednu stranu (ispravka istog dana). */}
              <div className="mx-auto flex w-[56%] flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto">{children}</main>
                {/* Dizajn dok. §6c — AI razgovor pratilac, uvek deo centralnog panela bez obzira
                    koji modul je aktivan. Pun okvir (border sa sve četiri strane + senka), ne
                    samo gornja linija — ispravka 19.8.2026, prethodni border-t se nije video. */}
                <div className="my-2 flex-shrink-0 rounded-lg border-2 border-border bg-panel shadow-sm">
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
