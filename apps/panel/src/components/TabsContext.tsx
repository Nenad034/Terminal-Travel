'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface OpenTab {
  id: string;
  path: string;
  label: string;
  dirty?: boolean;
  /** Zakačen tab (5.9.2026, vlasnikov zahtev: "omoguci pinovanje tabova... i kada se aplikacija
   * ugasi pa ponovo pokrene") — preživljava i osvežavanje stranice (sessionStorage, kao i pre) I
   * gašenje/ponovno pokretanje aplikacije (dodatno upisan u `localStorage`, vidi PINNED_STORAGE_KEY
   * ispod). Ne može se zatvoriti pojedinačnim × ni preko "zatvori sve" dok je zakačen — prvo se
   * otkači. */
  pinned?: boolean;
}

interface TabsContextValue {
  tabs: OpenTab[];
  activePath: string;
  /** Koji ZAPIS (ne putanja) je trenutno istaknut u traci — bitno tek kad dve stavke dele istu
   * putanju (§5a dopuna 23.8.2026, `forceNew`), inače se poklapa sa tabom čija je `path === activePath`. */
  activeTabId: string;
  /** `forceNew: true` (23.8.2026, na zahtev vlasnika: "omogucite otvaranje vise tabova za isti
   * modul") — uvek pravi NOV zapis čak i ako isti `path` već postoji u traci (npr. druga
   * paralelna pretraga), umesto da pronađe/istakne postojeći. Podrazumevano ponašanje (bez
   * `forceNew`) ostaje nepromenjeno — pronađi po `path`-u, nikad ne dupliraj. */
  openTab: (path: string, label: string, opts?: { forceNew?: boolean }) => void;
  /**
   * docs/analize/29-DIZAJN-SISTEM-UI.md §5a — "izmena unutar već otvorenog tab-a ne otvara
   * nov tab, samo osvežava tekući". Menja putanju/naslov AKTIVNOG taba na mestu (bez novog
   * elementa u nizu) — koristi se za drill-down linkove (lista → zapis), ne za namerne nove
   * radnje (klik na sekciju u levoj traci, izbor iz komandne palete — te ostaju na `openTab`).
   * Dopuna 23.8.2026 — sad prati `activeTabId`, ne više pronalaženje po putanji (ranije bi
   * dve stavke sa istom putanjom obe "izgledale" aktivno; sad je nedvosmisleno koji zapis).
   */
  navigateInTab: (path: string, label: string) => void;
  /** Postavlja koji zapis je istaknut BEZ navigacije — potrebno kad klik na tab ne menja URL
   * (druga stavka već ima istu putanju kao trenutno aktivna, 23.8.2026 dopuna). */
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  /** Zatvara sve tabove osim Početne I osim zakačenih (na zahtev vlasnika, 19.8.2026 — "previše
   * otvorenih"; dopuna 5.9.2026 — zakačeni tabovi opstaju i posle "zatvori sve", isti razlog kao
   * pojedinačno zatvaranje: svrha kačenja je da tab OSTANE, ne samo da preživi refresh). */
  closeAllTabs: () => void;
  /** Kači/otkači tab (5.9.2026, vlasnikov zahtev) — vidi `OpenTab.pinned`. */
  togglePin: (id: string) => void;
  markDirty: (path: string, dirty: boolean) => void;
  /** Ručno premeštanje taba prevlačenjem (26.8.2026, na zahtev vlasnika: "omogućite ručno
   * menjanje pozicije tabova u centralnom panelu, horizontalno") — ubacuje `draggedId` na
   * mesto `targetId` u nizu (isti obrazac kao standardan browser/VS Code drag-and-drop
   * tabova). Samo redosled — ne menja aktivan tab niti putanju. */
  reorderTabs: (draggedId: string, targetId: string) => void;
}

function newTabId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t${Date.now()}${Math.random()}`;
}

const TabsCtx = createContext<TabsContextValue | null>(null);

const STORAGE_KEY = 'tt-panel-tabs';
// Zakačeni tabovi (5.9.2026) — POSEBAN ključ, u `localStorage` (ne sessionStorage), namerno:
// svrha kačenja je baš da tab preživi i zatvaranje/ponovno pokretanje aplikacije, ne samo
// refresh u toku iste smene (za to služi već postojeći `STORAGE_KEY` iznad, nepromenjen).
const PINNED_STORAGE_KEY = 'tt-panel-pinned-tabs';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — traka tabova, VS Code/browser obrazac unutar
// same aplikacije. "Otvoreni tabovi se pamte preko osvežavanja stranice (lokalno, po
// sesiji)" -> sessionStorage, ne localStorage (namerno — ne treba da preživi zatvaranje
// browsera, samo refresh/pad konekcije u toku smene). Izuzetak: ZAKAČENI tabovi (v. dole).
export function TabsProvider({ children, homeLabel }: { children: React.ReactNode; homeLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenTab[]>([{ id: 'home', path: '/', label: homeLabel }]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [hydrated, setHydrated] = useState(false);
  // ISPRAVKA (24.8.2026, na zahtev vlasnika — "Kliknuo sam sada na Katalog proizvoda i pojavila
  // su se dva ista taba") — uzrok: React 18 Strict Mode (`reactStrictMode: true`, samo u dev
  // režimu) namerno DVAPUT poziva svaki `useEffect` pri mount-u (mount → cleanup → mount ponovo,
  // pre ijednog ponovnog renderovanja) da bi otkrio efekte koji nisu idempotentni. `useRegisterTab`
  // (ispod) poziva `openTab(pathname, label)` iz efekta bez čišćenja — oba poziva su koristila
  // ISTU zatvorenu (stale) `tabs` promenljivu iz render-a PRE mount-a (React još nije stigao da
  // primeni ni jedan `setTabs` između ta dva poziva), pa je provera "da li tab već postoji"
  // (`tabs.find(...)`) i DRUGI put vratila "ne postoji" — oba poziva su dodala PO JEDAN nov tab.
  // `tabsRef` čita/piše SINHRONO (mimo React state batch-a), pa drugi poziv u istom sinhronom
  // dvostrukom pozivu odmah vidi tab koji je prvi upravo dodao.
  const tabsRef = useRef(tabs);
  function commitTabs(next: OpenTab[]) {
    tabsRef.current = next;
    setTabs(next);
  }

  useEffect(() => {
    let restored: OpenTab[] | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Migracija (23.8.2026) — stariji sačuvan zapis nema `id` (dodato uz forceNew/duplikate
        // dopunu), dodeli ga ovde umesto da se osloni na to da je uvek prisutan.
        restored = JSON.parse(raw).map((t: Partial<OpenTab>) => ({ id: t.id ?? newTabId(), path: t.path!, label: t.label!, dirty: t.dirty, pinned: t.pinned }));
      }
    } catch {
      // ignoriši oštećen zapis
    }
    let base = restored && restored.length > 0 ? restored : [{ id: 'home', path: '/', label: homeLabel }];
    // Zakačeni tabovi (5.9.2026) — `sessionStorage` se briše kad se aplikacija (browser)
    // ugasi i ponovo pokrene, pa `restored` iznad tada NE postoji; zakačeni tabovi se zato
    // dodatno čitaju iz `localStorage` i UVEK se vrate, spojeni sa onim što je sesija zatekla
    // (poklapanje po `path`-u, ne po `id`-ju — posle punog restarta stari `id` više nije bitan).
    try {
      const rawPinned = localStorage.getItem(PINNED_STORAGE_KEY);
      if (rawPinned) {
        const pinned: OpenTab[] = JSON.parse(rawPinned).map((t: Partial<OpenTab>) => ({ id: t.id ?? newTabId(), path: t.path!, label: t.label!, pinned: true }));
        for (const p of pinned) {
          const existing = base.find((t) => t.path === p.path);
          base = existing ? base.map((t) => (t.path === p.path ? { ...t, pinned: true } : t)) : [...base, p];
        }
      }
    } catch {
      // ignoriši oštećen zapis — zakačeni tabovi se tad prosto ne vraćaju
    }
    commitTabs(base);
    const match = base.find((t) => t.path === pathname) ?? base[0];
    if (match) setActiveTabId(match.id);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    try {
      const pinned = tabs.filter((t) => t.pinned).map(({ id, path, label }) => ({ id, path, label }));
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinned));
    } catch {
      // localStorage nedostupan — kačenje i dalje radi za ovu sesiju, samo se ne pamti trajno
    }
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
    (path: string, label: string, opts?: { forceNew?: boolean }) => {
      if (!opts?.forceNew) {
        const existing = tabsRef.current.find((t) => t.path === path);
        if (existing) {
          if (existing.label !== label) {
            commitTabs(tabsRef.current.map((t) => (t.id === existing.id ? { ...t, label } : t)));
          }
          setActiveTabId(existing.id);
          if (path !== pathname) router.push(path);
          return;
        }
      }
      // Novi zapis — ili nijedan postojeći nema tu putanju, ili je `forceNew` eksplicitno
      // zatražen (23.8.2026, "omogucite otvaranje vise tabova za isti modul").
      const id = newTabId();
      commitTabs([...tabsRef.current, { id, path, label }]);
      setActiveTabId(id);
      if (path !== pathname) router.push(path);
    },
    [pathname, router],
  );

  const navigateInTab = useCallback(
    (path: string, label: string) => {
      const prev = tabsRef.current;
      const idx = prev.findIndex((t) => t.id === activeTabId);
      if (idx === -1) {
        // Bezbednosna mreža — aktivan zapis se ne poklapa ni sa jednim tabom, ponašaj se
        // kao openTab umesto da tiho ne uradiš ništa.
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          setActiveTabId(existing.id);
        } else {
          const id = newTabId();
          setActiveTabId(id);
          commitTabs([...prev, { id, path, label }]);
        }
      } else {
        const next = [...prev];
        next[idx] = { ...next[idx], path, label };
        commitTabs(next);
      }
      router.push(path);
    },
    [activeTabId, router],
  );

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const closeTab = useCallback(
    (id: string) => {
      const prev = tabsRef.current;
      const idx = prev.findIndex((t) => t.id === id);
      // Zakačen tab se ne zatvara direktno (5.9.2026) — mora se prvo otkačiti (`togglePin`);
      // odbrambena provera i ovde, iako `TabBar.tsx` uopšte ne prikazuje × dok je tab zakačen.
      if (idx === -1 || prev.length === 1 || prev[idx].pinned) return;
      const next = prev.filter((t) => t.id !== id);
      commitTabs(next);
      if (id === activeTabId) {
        const fallback = next[Math.max(0, idx - 1)];
        setActiveTabId(fallback.id);
        router.push(fallback.path);
      }
    },
    [activeTabId, router],
  );

  const markDirty = useCallback((path: string, dirty: boolean) => {
    commitTabs(tabsRef.current.map((t) => (t.path === path ? { ...t, dirty } : t)));
  }, []);

  const reorderTabs = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const prev = tabsRef.current;
    const fromIdx = prev.findIndex((t) => t.id === draggedId);
    const toIdx = prev.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...prev];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    commitTabs(next);
  }, []);

  const closeAllTabs = useCallback(() => {
    // Zakačeni tabovi opstaju (5.9.2026, dopuna) — "zatvori sve" je do sad brisalo BAŠ SVE osim
    // Početne; kačenje bi bilo besmisleno da ga ovo dugme svejedno pobriše. Ako je Početna sama
    // već zakačena, ne pravi se DRUGA (duplirana) Početna pored nje.
    const prev = tabsRef.current;
    const pinned = prev.filter((t) => t.pinned);
    const homeTab = pinned.find((t) => t.path === '/') ?? { id: newTabId(), path: '/', label: homeLabel };
    const next = pinned.some((t) => t.path === '/') ? pinned : [homeTab, ...pinned];
    commitTabs(next);
    setActiveTabId(homeTab.id);
    if (pathname !== '/') router.push('/');
  }, [homeLabel, pathname, router]);

  const togglePin = useCallback((id: string) => {
    commitTabs(tabsRef.current.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, []);

  return (
    <TabsCtx.Provider
      value={{ tabs, activePath: pathname, activeTabId, openTab, navigateInTab, setActiveTab, closeTab, closeAllTabs, togglePin, markDirty, reorderTabs }}
    >
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
