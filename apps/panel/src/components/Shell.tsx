'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import CommandPalette from './CommandPalette';
import ResizablePane from './ResizablePane';
import StatusBar from './StatusBar';
import RightPanel from './RightPanel';
import NotificationStack from './NotificationStack';
import TerminalPanel from './TerminalPanel';
import { TabsProvider } from './TabsContext';
import { SelectionProvider } from './SelectionContext';
import { RowSummaryProvider } from './RowSummaryContext';
import { PanelCollectionProvider } from './PanelCollectionContext';
import { AiContextProvider } from './AiContextContext';
import { NAV_GROUPS, groupForHref, moduleCodeForHref, type NavItem } from '@/lib/nav';

const SIDEBAR_COLLAPSED_KEY = 'tt-panel-sidebar-collapsed';
// Dizajn dok. §5f — "Customize Layout" (23.8.2026) — jedan localStorage ključ za sve panele koji
// se mogu potpuno sakriti/prikazati, isti privremeni obrazac kao SIDEBAR_COLLAPSED_KEY dok pravi
// `UserPreference` backend (M1 §3.9) ne postoji u kodu.
const LAYOUT_VISIBILITY_KEY = 'tt-panel-layout-visibility';
interface LayoutVisibility {
  sidebar: boolean;
  statusBar: boolean;
  terminal: boolean;
}
const DEFAULT_LAYOUT_VISIBILITY: LayoutVisibility = { sidebar: true, statusBar: true, terminal: false };

export default function Shell({
  fullName,
  roles,
  items,
  showBiTerminal,
  children,
}: {
  fullName: string;
  roles: string[];
  items: NavItem[];
  /** M15 spec §6.9.2 — `M15/bi-terminal/VIEW`, isključivo VLASNIK. Kad je `false`, terminal
   * stavka u "Customize Layout" meniju i sam `TerminalPanel` se uopšte ne montiraju. */
  showBiTerminal: boolean;
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
  // Merenje STVARNE širine ActivityBar+Sidebar kolone (23.8.2026) — vidi opširan komentar uz
  // `leftColumnRef` div niže; `useLayoutEffect` bi bio idealniji (bez treptaja), ali `ResizeObserver`
  // ionako radi PO layout-u pa razlika nije vidljiva, a `useEffect` izbegava SSR upozorenje.
  // Podrazumevana vrednost pre prvog merenja (267 = 43px ActivityBar + 224px podrazumevana Sidebar
  // širina) ista je pretpostavka kao dosad — samo se sad odmah zameni stvarno izmerenom vrednošću.
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [leftColumnWidth, setLeftColumnWidth] = useState(267);
  useEffect(() => {
    const el = leftColumnRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setLeftColumnWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Desni panel se pojavljuje prema potrebi (dizajn dok. §5b — sažetak reda/"Povezano" traka),
  // ne podrazumevano otvoren. Jedini namerni auto-otvarač je M5 selekcija pretrage (§3.0e.3,
  // §6d "predlog... pojavljuje se odmah po dodavanju stavke") — SelectionProvider poziva
  // `onFirstAdd` kad prva stavka uđe u selekciju, isto ponašanje kao klik na dugme.
  //
  // Vidljivost PO MODULU (M17 spec v2.10, 25.8.2026, na zahtev vlasnika: "Desni panel treba da
  // bude uključen samo u modulu gde smo ga uključili. Kada pređemo na drugi modul desni panel
  // se zatvara") — `Set` umesto jednog globalnog `boolean`; "modul" = `NAV_GROUP` granica
  // (`nav.ts` §4a, ISTA koja već grupiše pretraga/kalendar/rezervacije-lista pod "Prodaja" u
  // gornjoj traci). Trenutni modul se računa iz STVARNE putanje otvorenog taba (`pathname`),
  // NE iz `activeGroupId` — to je odvojeno UI stanje (koja je ikonica gornje trake "razvijena"
  // za pregled bočne trake), menja se SAMO ručnim klikom i može se razlikovati od modula
  // stvarno otvorenog taba. Zatvaranje (X dugme) SAKRIVA panel za taj modul, ne prazni sadržaj
  // (SelectionContext/RowSummaryContext/PanelCollectionContext ostaju netaknuti) — vraća se pri
  // povratku u taj modul.
  const currentModuleId = useMemo(() => groupForHref(pathname)?.id ?? 'pocetna', [pathname]);
  const currentModuleLabel = useMemo(() => groups.find((g) => g.id === currentModuleId)?.label ?? 'Modul', [groups, currentModuleId]);
  const [rightPanelOpenModules, setRightPanelOpenModules] = useState<Set<string>>(new Set());
  const rightPanelOpen = rightPanelOpenModules.has(currentModuleId);
  function openRightPanelForCurrentModule() {
    setRightPanelOpenModules((prev) => (prev.has(currentModuleId) ? prev : new Set(prev).add(currentModuleId)));
  }
  function toggleRightPanelForCurrentModule() {
    setRightPanelOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(currentModuleId)) next.delete(currentModuleId);
      else next.add(currentModuleId);
      return next;
    });
  }
  function closeRightPanelForCurrentModule() {
    setRightPanelOpenModules((prev) => {
      if (!prev.has(currentModuleId)) return prev;
      const next = new Set(prev);
      next.delete(currentModuleId);
      return next;
    });
  }
  // "Customize Layout" (dizajn dok. §5f, 23.8.2026) — isti bezbedan hidratacioni obrazac kao
  // `sidebarCollapsed` iznad: podrazumevana vrednost na SERVERU i prvom klijentskom renderu,
  // localStorage se čita tek posle mount-a.
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>(DEFAULT_LAYOUT_VISIBILITY);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_VISIBILITY_KEY);
      if (raw) setLayoutVisibility({ ...DEFAULT_LAYOUT_VISIBILITY, ...JSON.parse(raw) });
    } catch {
      // localStorage nedostupan ili neispravan zapis — ostaje podrazumevano
    }
  }, []);
  function toggleLayout(key: keyof LayoutVisibility) {
    setLayoutVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LAYOUT_VISIBILITY_KEY, JSON.stringify(next));
      } catch {
        // i dalje radi za ovu sesiju bez trajnog čuvanja
      }
      return next;
    });
  }
  // AI chat NAPUŠTA plutajući prozor (dizajn dok. §6c.0, dopuna 25.8.2026, na zahtev vlasnika)
  // — postaje trajan deo `RightPanel` (naslagan ispod postojećeg sadržaja), pa "otvoren/zatvoren
  // AI chat" postaje isto pitanje kao "otvoren/zatvoren desni panel za trenutni modul"
  // (`rightPanelOpen` ispod, već postoji od v2.10). `chatOpen`/`onToggleChat` propovi (TopBar/
  // StatusBar/CustomizeLayoutButton) ostaju istog imena da se izbegne nepotreban dodatan diff u
  // tim fajlovima — sad su prosto alias za `rightPanelOpen`/`toggleRightPanelForCurrentModule`.
  //
  // Izbor "sužava sadržaj" naspram "prelazi preko sadržaja" (§6c.0) — po korisniku preko
  // `UserPreference` (M1 §3.9, ključ `right_panel_display_mode`), učitano jednom pri montiranju.
  const [rightPanelMode, setRightPanelMode] = useState<'push' | 'overlay'>('push');
  useEffect(() => {
    fetch('/api/preferences', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const value = data?.right_panel_display_mode;
        if (value === 'overlay' || value === 'push') setRightPanelMode(value);
      })
      .catch(() => {
        // Podrazumevano ostaje "push" — ne blokira prikaz panela zbog neuspelog čitanja podešavanja.
      });
  }, []);
  function toggleRightPanelMode() {
    const next = rightPanelMode === 'push' ? 'overlay' : 'push';
    setRightPanelMode(next);
    fetch('/api/preferences/right_panel_display_mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    }).catch(() => {
      // Ponašanje za OVU sesiju i dalje radi (lokalno stanje već promenjeno) — samo se ne pamti.
    });
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  return (
    <TabsProvider homeLabel="Početna">
      <SelectionProvider onFirstAdd={openRightPanelForCurrentModule}>
      <RowSummaryProvider onFirstShow={openRightPanelForCurrentModule}>
      <PanelCollectionProvider onFirstAdd={(moduleId) => setRightPanelOpenModules((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)))}>
      <AiContextProvider onFirstAdd={openRightPanelForCurrentModule}>
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
            leftColumnWidth={leftColumnWidth}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={toggleRightPanelForCurrentModule}
            layoutProps={{
              sidebarVisible: layoutVisibility.sidebar,
              onToggleSidebar: () => toggleLayout('sidebar'),
              statusBarVisible: layoutVisibility.statusBar,
              onToggleStatusBar: () => toggleLayout('statusBar'),
              showTerminal: showBiTerminal,
              terminalOpen: layoutVisibility.terminal,
              onToggleTerminal: () => toggleLayout('terminal'),
            }}
          />
          <div className="flex flex-1 overflow-hidden">
            {/* `leftColumnRef` (23.8.2026, uz snimak ekrana — "i dalje nije dobra pozicija prvog
                taba") — dva uzastopna pokušaja da se TopBar-ov razmak POGODI (statična vrednost
                v1.94, pa binarna proširena/uska vrednost v1.95) su i dalje bila netačna, jer
                nijedan od pretpostavljenih brojeva nije pratio STVARNU renderovanu širinu ove
                kolone (ActivityBar + Sidebar, koja zavisi od kolabovanog stanja, ručno prevučene
                širine unutar 180-420px i sakrivanja preko "Customize Layout" — previše promenljivih
                da bi se unapred izračunalo). Umesto nagađanja, širina se sad STVARNO MERI preko
                `ResizeObserver` (ispod) i prosleđuje `TopBar`-u kao broj u pikselima — tačna u
                svakom stanju, uključujući uživo prevlačenje, bez ijedne nove pretpostavke. */}
            <div ref={leftColumnRef} className="flex">
              <ActivityBar
                groups={groups}
                activeGroupId={activeGroup?.id ?? ''}
                onSelectGroup={setActiveGroupId}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setCollapsed(!sidebarCollapsed)}
              />
              {layoutVisibility.sidebar && (
                <ResizablePane
                  storageKey="tt-panel-sidebar-width"
                  defaultWidth={224}
                  minWidth={180}
                  maxWidth={420}
                  collapsed={sidebarCollapsed}
                  collapsedWidth={0}
                >
                  <Sidebar
                    items={items}
                    activeGroup={activeGroup}
                    mePresent
                    collapsed={sidebarCollapsed}
                    onCollapse={() => setCollapsed(true)}
                  />
                </ResizablePane>
              )}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Traka tabova VRAĆENA u TopBar (21.8.2026, treći krug istog dana, na zahtev
                  vlasnika: "vratite tabove u gornji red") — poništava prethodni pokušaj
                  (v1.62, prvi red centralne kolone). Vidi TopBar.tsx. */}
              {/* Sadržaj i AI chat su NAMERNO razdvojene širine (21.8.2026, na zahtev vlasnika —
                  sadržaj na 90% širine panela, chat 20% uži od toga, 90%×0.8=72%), za razliku
                  od ranijeg jedinstvenog w-[56%] omotača (19.8.2026, "prikaz na širinu chata").
                  Svaki deo se centrira nezavisno (mx-auto). ISPRAVKA (21.8.2026, na zahtev
                  vlasnika, drugi krug istog dana) — prethodni pokušaj (`bg-panel-2` na ovom
                  omotaču, da margina oko `w-[90%]` postane vidljiva kao traka drugog tona) je,
                  uz snimak ekrana, ispao kao vidljiva "kutija"/zakrpa dva tona oko sadržaja —
                  vlasnik je eksplicitno tražio suprotno: "u centralnom delu sve treba da bude
                  jedna boja". Vraćeno na jednu boju (bez eksplicitnog `bg-*` ovde — nasleđuje
                  `bg-bg` sa spoljnog wrapper-a, koji je namerno ista vrednost kao `bg-panel`,
                  §komentar globals.css) — 90% širina i dalje stvarno postoji u layout-u (grep
                  potvrđen u v1.45), samo se više NE ističe bojom, na eksplicitan zahtev. */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* `id` čita AiChatBox.tsx da automatski priloži vidljiv sadržaj ovog taba uz
                    svaku poruku (M15 spec §6.5.1 dopuna, 22.8.2026, na zahtev vlasnika) — bez
                    ovog `id`-ja nema drugog opšteg mesta da se "trenutan sadržaj ekrana" pročita
                    bez posebnog ožičenja svakog od 18 ekrana ponaosob. AiChatBox je od 25.8.2026
                    (§6c.0) dokovan deo `RightPanel` (ispod) — SUSED ovog `<main>`, ne njegov
                    potomak, pa čitanje ostaje bezbedno (nema rizika od rekurzivnog čitanja
                    sopstvene istorije). Izuzetak: `/ai-asistent` Fokus tab, gde AiChatBox JESTE
                    ovaj `<main>` sadržaj — `fokus` prop tamo isključuje čitanje (AiChatBox.tsx). */}
                <main id="tt-main-content" className="mx-auto w-[90%] flex-1 overflow-y-auto bg-panel">{children}</main>
                {/* Terminal panel (dizajn dok. §5f, M15 spec §6.9) — VS Code pozicija, ispod
                    sadržaja, iznad statusne trake, span samo centralne kolone (ne ide ispod
                    bočne trake/desnog panela, isto kao pravi VS Code Panel). Montira se SAMO uz
                    `showBiTerminal` (RBAC, isključivo VLASNIK) — nema onemogućenog stanja. */}
                {showBiTerminal && layoutVisibility.terminal && <TerminalPanel onClose={() => toggleLayout('terminal')} />}
              </div>
            </div>
            {/* Dizajn dok. §6c.0 (dopuna 25.8.2026, na zahtev vlasnika) — AI chat je sad TRAJAN
                deo `RightPanel` (naslagan ispod postojećeg sažetka/podsetnika), ne poseban
                plutajući prozor. `ResizablePane` je UVEK montiran (`collapsed={!rightPanelOpen}`,
                isti obrazac kao bočna traka) — `RightPanel`/`AiChatBox` se nikad ne uklanjaju iz
                DOM-a, istorija razgovora se ne gubi zatvaranjem panela.

                Push/overlay (§6c.0) — "push" (podrazumevano) ostaje u normalnom flex toku,
                sužava centralni sadržaj. "overlay" prelazi na `position: fixed` uz desnu ivicu —
                NE menja širinu centralnog sadržaja, samo ga delimično prekriva. Prelazak između
                režima remontira `RightPanel` (različit roditelj) — istorija razgovora se u tom
                retkom, eksplicitnom trenutku gubi; svako drugo otvaranje/zatvaranje je bezbedno. */}
            {rightPanelMode === 'push' ? (
              <ResizablePane storageKey="tt-panel-right-width" defaultWidth={320} minWidth={260} maxWidth={560} handleSide="left" collapsed={!rightPanelOpen} collapsedWidth={0}>
                <RightPanel
                  moduleId={currentModuleId}
                  moduleLabel={currentModuleLabel}
                  onClose={closeRightPanelForCurrentModule}
                  displayMode={rightPanelMode}
                  onToggleDisplayMode={toggleRightPanelMode}
                />
              </ResizablePane>
            ) : (
              <div
                className="fixed bottom-[38px] right-0 top-[43px] z-30 w-[420px] shadow-lg"
                style={{ display: rightPanelOpen ? undefined : 'none' }}
              >
                <RightPanel
                  moduleId={currentModuleId}
                  moduleLabel={currentModuleLabel}
                  onClose={closeRightPanelForCurrentModule}
                  displayMode={rightPanelMode}
                  onToggleDisplayMode={toggleRightPanelMode}
                />
              </div>
            )}
          </div>
          {layoutVisibility.statusBar && (
            <StatusBar
              fullName={fullName}
              roleLabel={roles.join(', ')}
              moduleCode={moduleCodeForHref(pathname)}
              chatOpen={rightPanelOpen}
              onToggleChat={toggleRightPanelForCurrentModule}
            />
          )}
        </div>
        <CommandPalette items={items} />
        <NotificationStack />
      </AiContextProvider>
      </PanelCollectionProvider>
      </RowSummaryProvider>
      </SelectionProvider>
    </TabsProvider>
  );
}
