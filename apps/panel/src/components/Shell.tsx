'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import CommandPalette from './CommandPalette';
import ResizablePane from './ResizablePane';
import StatusBar from './StatusBar';
import AiChatBox from './AiChatBox';
import RightPanel from './RightPanel';
import NotificationStack from './NotificationStack';
import TerminalPanel from './TerminalPanel';
import { TabsProvider } from './TabsContext';
import { SelectionProvider } from './SelectionContext';
import { RowSummaryProvider } from './RowSummaryContext';
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
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
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
  // AI chat kao plutajući prozor umesto trajno usidrenog dela centralnog panela (22.8.2026, na
  // zahtev vlasnika — "chat treba da se pojavljuje na klik na ikonu... drugi klik se uklanja iz
  // vidokruga, ne briše se ono što je chatovano"). Poništava raniji princip "uvek deo centralnog
  // panela" (dizajn dok. §6c, 19.8.2026) — svesna izmena, ne previd. `chatOpen` samo kontroliše
  // VIDLJIVOST (CSS `hidden`, ne uslovan JSX render) — `AiChatBox` ostaje montiran i kad je
  // sakriven, njegovo `turns` stanje (istorija razgovora) se time nikad ne gubi.
  const [chatOpen, setChatOpen] = useState(true);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  // Prevlačenje bilo gde po centralnom panelu (23.8.2026, na zahtev vlasnika — "omogućite
  // pomeranje chata gde god želimo da bude", eksplicitno KAO ZAMENA za "klik van chata ga
  // zatvara" iz prethodnog prolaza istog dana: "ovim pomeranjem ćemo rešiti problem" — kad chat
  // zaklanja nešto, korisnik ga sam odvuče u stranu umesto da nestane na slučajan klik). `null`
  // = podrazumevana pozicija (CSS `bottom-[38px] right-4`, isto kao pre); posle prvog prevlačenja
  // prelazi na apsolutno pozicioniranje preko `top`/`left` u pikselima.
  const [chatPos, setChatPos] = useState<{ top: number; left: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  // Uvećanje na visinu ekrana, na zahtev (25.8.2026, na zahtev vlasnika: "omogucite da se ai
  // agent po zelji poveca visinu na visinu ekrana na kom se prikazuje") — samo VISINA se menja
  // (`top-4 bottom-[38px]` umesto `max-h-[70vh]`), širina ostaje 560px kao inače; horizontalna
  // pozicija (`chatPos.left` ako je prozor prevučen) se poštuje i dok je uvećan, samo se
  // vertikalna pozicija privremeno ignoriše — vraća se na prethodnu kad se ponovo umanji.
  const [chatMaximized, setChatMaximized] = useState(false);

  function handleChatDragStart(e: React.MouseEvent) {
    const rect = chatPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left };

    function onMove(ev: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const nextTop = drag.startTop + (ev.clientY - drag.startY);
      const nextLeft = drag.startLeft + (ev.clientX - drag.startX);
      // Ne dozvoljava da zaglavlje potpuno izađe van vidljivog ekrana — uvek ostaje bar 40px
      // dohvatljivo da se chat može ponovo dovući nazad.
      setChatPos({
        top: Math.max(0, Math.min(nextTop, window.innerHeight - 40)),
        left: Math.max(-520, Math.min(nextLeft, window.innerWidth - 40)),
      });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  return (
    <TabsProvider homeLabel="Početna">
      <SelectionProvider onFirstAdd={() => setRightPanelOpen(true)}>
      <RowSummaryProvider onFirstShow={() => setRightPanelOpen(true)}>
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
            onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
            layoutProps={{
              sidebarVisible: layoutVisibility.sidebar,
              onToggleSidebar: () => toggleLayout('sidebar'),
              statusBarVisible: layoutVisibility.statusBar,
              onToggleStatusBar: () => toggleLayout('statusBar'),
              chatOpen,
              onToggleChat: () => setChatOpen((v) => !v),
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
                    bez posebnog ožičenja svakog od 18 ekrana ponaosob. AiChatBox se preselio u
                    plutajući prozor (ispod) — `<main>` sad sam zauzima celu visinu centralne
                    kolone, uvek, bez obzira da li je chat otvoren (plutajući prozor se nadovezuje
                    PREKO sadržaja, ne gura ga). */}
                <main id="tt-main-content" className="mx-auto w-[90%] flex-1 overflow-y-auto bg-panel">{children}</main>
                {/* Terminal panel (dizajn dok. §5f, M15 spec §6.9) — VS Code pozicija, ispod
                    sadržaja, iznad statusne trake, span samo centralne kolone (ne ide ispod
                    bočne trake/desnog panela, isto kao pravi VS Code Panel). Montira se SAMO uz
                    `showBiTerminal` (RBAC, isključivo VLASNIK) — nema onemogućenog stanja. */}
                {showBiTerminal && layoutVisibility.terminal && <TerminalPanel onClose={() => toggleLayout('terminal')} />}
              </div>
            </div>
            {/* Plutajući AI chat (22.8.2026, na zahtev vlasnika) — bez zatamnjenja pozadine
                (vlasnikova eksplicitna odluka preko AskUserQuestion: "plutajući prozor u uglu",
                ne pun modal) — sadržaj ispod ostaje vidljiv/klikabilan dok je chat otvoren, jer AI
                automatski čita sadržaj otvorenog taba (M15 spec §6.5.1) i korisnik treba da može
                da gleda oboje istovremeno. `hidden` (ne uslovan JSX) čuva `AiChatBox` montiranim —
                istorija razgovora se ne gubi kad se prozor sakrije. Širina usklađena sa MAKSIMALNOM
                širinom desnog panela — `RightPanel` koristi `ResizablePane maxWidth={560}` (ispod,
                u ovom fajlu). Spoljni okvir (`border border-border`) UKLONJEN na zahtev vlasnika
                ("nepotreban je") — `shadow-lg` i tonska razlika (`bg-panel` naspram `bg-bg`/
                `bg-panel-2` iza njega) ostaju dovoljni za odvajanje bez linije.

                Pozicija: `chatPos === null` koristi CSS podrazumevanu (`bottom-[38px] right-4`,
                donji desni ugao); posle prvog prevlačenja zaglavlja (23.8.2026, na zahtev
                vlasnika) prelazi na `style={{ top, left }}` u pikselima — `bottom`/`right` klase
                se tad UKLANJAJU (ne mogu da koegzistiraju sa `top`/`left`, CSS bi ih obe
                primenio i razvukao element). Ovo ZAMENJUJE "klik van chata ga zatvara" iz
                prethodnog prolaza istog dana (uklonjeno) — vlasnikova odluka: kad chat nešto
                zaklanja, sam ga odvuče u stranu, ne nestaje na slučajan klik. */}
            <div
              ref={chatPanelRef}
              className={`fixed z-40 w-[560px] flex-col overflow-hidden rounded-lg bg-panel shadow-lg ${
                chatOpen ? 'flex' : 'hidden'
              } ${chatMaximized ? 'top-4 bottom-[38px]' : 'max-h-[70vh]'} ${
                chatPos ? '' : chatMaximized ? 'right-4' : 'bottom-[38px] right-4'
              }`}
              style={chatPos ? { top: chatMaximized ? undefined : chatPos.top, left: chatPos.left } : undefined}
            >
              <div
                onMouseDown={handleChatDragStart}
                className="flex h-[36px] flex-shrink-0 cursor-move items-center justify-between border-b border-border bg-panel-2 px-3 text-xs font-medium text-ink"
              >
                <span className="flex items-center gap-1.5">
                  <Icon name="sparkle" className="text-accent" /> AI asistent
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChatMaximized((v) => !v)}
                    title={chatMaximized ? 'Vrati na uobičajenu visinu' : 'Uvećaj na visinu ekrana'}
                    className="text-ink-faint hover:text-ink"
                  >
                    <Icon name={chatMaximized ? 'screen-normal' : 'screen-full'} />
                  </button>
                  <button onClick={() => setChatOpen(false)} title="Zatvori (istorija se čuva)" className="text-ink-faint hover:text-ink">
                    <Icon name="close" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <AiChatBox maximized={chatMaximized} />
              </div>
            </div>
            {rightPanelOpen && (
              <ResizablePane storageKey="tt-panel-right-width" defaultWidth={320} minWidth={260} maxWidth={560} handleSide="left">
                <RightPanel onClose={() => setRightPanelOpen(false)} />
              </ResizablePane>
            )}
          </div>
          {layoutVisibility.statusBar && (
            <StatusBar
              fullName={fullName}
              roleLabel={roles.join(', ')}
              moduleCode={moduleCodeForHref(pathname)}
              chatOpen={chatOpen}
              onToggleChat={() => setChatOpen((v) => !v)}
            />
          )}
        </div>
        <CommandPalette items={items} />
        <NotificationStack />
      </RowSummaryProvider>
      </SelectionProvider>
    </TabsProvider>
  );
}
