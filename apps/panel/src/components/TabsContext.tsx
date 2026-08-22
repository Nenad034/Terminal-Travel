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
  /**
   * docs/analize/29-DIZAJN-SISTEM-UI.md §5a — "izmena unutar već otvorenog tab-a ne otvara
   * nov tab, samo osvežava tekući". Menja putanju/naslov AKTIVNOG taba na mestu (bez novog
   * elementa u nizu) — koristi se za drill-down linkove (lista → zapis), ne za namerne nove
   * radnje (klik na sekciju u levoj traci, izbor iz komandne palete — te ostaju na `openTab`).
   */
  navigateInTab: (path: string, label: string) => void;
  closeTab: (path: string) => void;
  /** Zatvara sve tabove osim Početne (na zahtev vlasnika, 19.8.2026 — "previše otvorenih"). */
  closeAllTabs: () => void;
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

  // ISPRAVKA (22.8.2026, na zahtev vlasnika — "kada se klikne na ikonu čime se otvara novi tab,
  // ne otvara se taj tab već se ostaje u prethodnom") — `openTab` je ranije SAMO upisivao zapis
  // u niz tabova, nikad stvarno ne menjajući rutu. Radilo je slučajno tamo gde poziv dolazi sa
  // pravog `<Link href>` elementa (bočna traka) — sam `<Link>` je navigirao, a `openTab` je
  // samo registrovao tab preko `useRegisterTab` na odredišnoj stranici. Svuda gde se `openTab`
  // poziva direktno iz `onClick` bez `<Link>` (AI chat prečice, meni "Poruke", "Agent Inbox"
  // dugme, klik na obaveštenje) navigacija se nikad nije desila. `path !== pathname` provera
  // sprečava nepotreban `router.push` kad `useRegisterTab` sam sebe poziva sa VEĆ aktivnom
  // rutom (linija ispod, `openTab(pathname, label)`) — tamo bi push na istu putanju samo
  // dodao suvišan zapis u istoriju pregledača.
  const openTab = useCallback(
    (path: string, label: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        if (idx === -1) return [...prev, { path, label }];
        // Tab već postoji (npr. otvoren kroz navigateInTab pre nego što je ciljna stranica
        // stigla do svog sopstvenog useRegisterTab poziva) — osveži naslov ako se razlikuje,
        // nikad ne dupliraj.
        if (prev[idx].label === label) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], label };
        return next;
      });
      if (path !== pathname) router.push(path);
    },
    [pathname, router],
  );

  const navigateInTab = useCallback(
    (path: string, label: string) => {
      setTabs((prev) => {
        const activeIdx = prev.findIndex((t) => t.path === pathname);
        if (activeIdx === -1) {
          // Bezbednosna mreža — aktivan tab se ne poklapa ni sa jednim zapisom, ponašaj se
          // kao openTab umesto da tiho ne uradiš ništa.
          return prev.some((t) => t.path === path) ? prev : [...prev, { path, label }];
        }
        const next = [...prev];
        next[activeIdx] = { path, label };
        return next;
      });
      router.push(path);
    },
    [pathname, router],
  );

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

  const closeAllTabs = useCallback(() => {
    setTabs([{ path: '/', label: homeLabel }]);
    if (pathname !== '/') router.push('/');
  }, [homeLabel, pathname, router]);

  return (
    <TabsCtx.Provider value={{ tabs, activePath: pathname, openTab, navigateInTab, closeTab, closeAllTabs, markDirty }}>
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
