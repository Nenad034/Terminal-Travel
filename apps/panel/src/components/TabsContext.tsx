'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface OpenTab {
  path: string;
  label: string;
  dirty?: boolean;
}

interface TabsContextValue {
  tabs: OpenTab[];
  activePath: string;
  openTab: (path: string, label: string) => void;
  closeTab: (path: string) => void;
  markDirty: (path: string, dirty: boolean) => void;
}

const TabsCtx = createContext<TabsContextValue | null>(null);

const STORAGE_KEY = 'tt-panel-tabs';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — traka tabova, VS Code/browser obrazac unutar
// same aplikacije. "Otvoreni tabovi se pamte preko osvežavanja stranice (lokalno, po
// sesiji)" -> sessionStorage, ne localStorage (namerno — ne treba da preživi zatvaranje
// browsera, samo refresh/pad konekcije u toku smene).
export function TabsProvider({ children, homeLabel }: { children: React.ReactNode; homeLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenTab[]>([{ path: '/', label: homeLabel }]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setTabs(JSON.parse(raw));
    } catch {
      // ignoriši oštećen zapis
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs, hydrated]);

  const openTab = useCallback((path: string, label: string) => {
    setTabs((prev) => (prev.some((t) => t.path === path) ? prev : [...prev, { path, label }]));
  }, []);

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        if (idx === -1 || prev.length === 1) return prev;
        const next = prev.filter((t) => t.path !== path);
        if (pathname === path) {
          const fallback = next[Math.max(0, idx - 1)];
          router.push(fallback.path);
        }
        return next;
      });
    },
    [pathname, router],
  );

  const markDirty = useCallback((path: string, dirty: boolean) => {
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, dirty } : t)));
  }, []);

  return (
    <TabsCtx.Provider value={{ tabs, activePath: pathname, openTab, closeTab, markDirty }}>
      {children}
    </TabsCtx.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('useTabs mora biti unutar TabsProvider');
  return ctx;
}

/** Svaka stranica poziva ovo da registruje sopstveni tab (naslov + trenutna putanja). */
export function useRegisterTab(label: string) {
  const { openTab } = useTabs();
  const pathname = usePathname();
  useEffect(() => {
    openTab(pathname, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, label]);
}
