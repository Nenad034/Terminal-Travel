'use client';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import TabBar from './TabBar';
import CommandPalette from './CommandPalette';
import { TabsProvider } from './TabsContext';
import type { NavItem } from '@/lib/nav';

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
  return (
    <TabsProvider homeLabel="Početna">
      <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
        <TopBar fullName={fullName} roles={roles} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar items={items} mePresent />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TabBar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </div>
      <CommandPalette items={items} />
    </TabsProvider>
  );
}
