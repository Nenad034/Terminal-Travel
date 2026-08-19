'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import TabBar from './TabBar';
import CommandPalette from './CommandPalette';
import ResizablePane from './ResizablePane';
import StatusBar from './StatusBar';
import RightPanel from './RightPanel';
import { TabsProvider } from './TabsContext';
import { NAV_GROUPS, groupForHref, moduleCodeForHref, type NavItem } from '@/lib/nav';

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
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  return (
    <TabsProvider homeLabel="Početna">
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
          <ResizablePane storageKey="tt-panel-sidebar-width" defaultWidth={224} minWidth={180} maxWidth={420}>
            <Sidebar items={items} activeGroup={activeGroup} mePresent />
          </ResizablePane>
          <div className="flex flex-1 flex-col overflow-hidden">
            <TabBar />
            <main className="flex-1 overflow-y-auto">{children}</main>
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
    </TabsProvider>
  );
}
