'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import RightRail from './RightRail';
import CommandPalette from './CommandPalette';
import ResizablePane from './ResizablePane';
import StatusBar from './StatusBar';
import RightPanel from './RightPanel';
import NotificationStack from './NotificationStack';
import TerminalPanel from './TerminalPanel';
import AiDockBottom from './AiDockBottom';
import AiChatBox from './AiChatBox';
import { TabsProvider } from './TabsContext';
import { SelectionProvider } from './SelectionContext';
import { RowSummaryProvider } from './RowSummaryContext';
import { PanelCollectionProvider } from './PanelCollectionContext';
import { AiContextProvider } from './AiContextContext';
import { ProductPreviewProvider } from './ProductPreviewContext';
import { GroupSearchBuilderProvider } from './GroupSearchBuilderContext';
import { SearchStateProvider } from './SearchStateContext';
import { SearchFiltersProvider } from './SearchFiltersContext';
import { KatalogProvider } from './KatalogContext';
import { NAV_GROUPS, groupForHref, moduleCodeForHref, type NavItem } from '@/lib/nav';
import { WIDTH_CHOICES, type MainWidth } from './CustomizeLayoutButton';

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

// Gornja granica širine centralnog sadržaja (2.9.2026, na zahtev vlasnika: "omogućiti ko to želi
// da se u centralnom panelu širina prikaza podesi na manju širinu", dizajn dok. §6b.1 / M17 spec
// §5f). Namerno GRANICA (`max-width`), ne procenat — procenat oduzima prostor i na malom ekranu,
// što je bio razlog zašto je raniji `w-[90%]` ukinut 29.8.2026 na vlasnikovu prijavu. Granica
// deluje SAMO kad raspoloživog prostora ima više od nje; na užem ekranu se ponaša identično kao
// `full`, bez ijednog izgubljenog piksela.
//
// Zašto baš ove tri vrednosti (vlasnik potvrdio posle predloga):
//   1680 — deluje tek na velikim/ultraširokim monitorima; na 1920px sa otvorenim bočnim
//          panelima je praktično neprimetno.
//   1440 — osetno mirniji ekran, a najšira tabela u panelu (lista rezervacija, 11 kolona,
//          `RealBookingsTable.tsx`) i dalje staje bez stiskanja kolona.
//   1280 — donja granica koja se preporučuje. Ispod ~1250px ta ista tabela počinje da stiska
//          kolone ili traži horizontalno skrolovanje — gora šteta po preglednost nego predugačak
//          red teksta. Ako zatreba uže, rešenje je manje kolona u tabeli, ne uža granica.
const MAIN_WIDTH_PREFERENCE_KEY = 'main_content_max_width';
/** Pozicija AI asistenta: `right` (desni panel) ili `bottom` (dno centralne kolone). */
const AI_DOCK_PREFERENCE_KEY = 'ai_dock_position';
const DEFAULT_MAIN_WIDTH: MainWidth = 'full';
// Vrednost iz `UserPreference` dolazi sa servera i može biti bilo šta (ručno upisana, zaostala
// posle promene spiska) — proverava se protiv ISTOG spiska koji meni prikazuje, ne protiv
// zasebne kopije koja bi vremenom mogla da se raziđe sa njim.
function isMainWidth(value: unknown): value is MainWidth {
  return typeof value === 'string' && WIDTH_CHOICES.some((c) => c.value === value);
}

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
  // ISPRAVKA (26.8.2026, na zahtev vlasnika, uz uživo nalaz — "kad se klikne na dugme Home
  // ništa se ne dešava", "link za Pretraga i rezervacije ne reaguje odmah, moram da kliknem na
  // neku drugu ikonu pa da se vratim"). Uzrok: `activeGroupId` se DOSAD menjao ISKLJUČIVO ručnim
  // klikom na ActivityBar/TopBar ikonicu grupe (`onSelectGroup`) — svaka DRUGA navigacija koja
  // menja stvarnu putanju (TabBar klik na već otvoren tab, CommandPalette, klik na obaveštenje,
  // link iz AI chat-a, jednostavni `<Link>` klik na single-item ActivityBar stavku poput Home-a
  // samog) NIKAD nije ažurirala `activeGroupId` — ostajao je "zaleđen" na grupi iz koje je
  // korisnik POSLEDNJI PUT ručno kliknuo ikonicu, bez obzira gde ga je navigacija stvarno odvela.
  // Dva vidljiva simptoma istog uzroka: (1) Home ActivityBar stavka je "single" grupa — klik na
  // NJU dok je `activeGroupId` i dalje slučajno "pocetna" (npr. posle navigacije na drugo mesto
  // preko CommandPalette-a) se tumači kao "klik na već aktivnu ikonicu" i SAMO skuplja/širi levu
  // traku umesto da stvarno vodi na Početnu — izgleda kao da dugme ništa ne radi. (2) `Sidebar.tsx`
  // bira KOJU grupu da prikaže (i time da li se `selected` uopšte poklopi sa trenutnom putanjom)
  // isključivo preko `activeGroupId` — dok je on zaleđen na pogrešnoj grupi, "Pretraga i
  // rezervacije" se otvara ali Sidebar i dalje prikazuje PRETHODNU (pogrešnu) grupu, pa
  // `SearchSidebarPanel` ne može da se poklopi/prikaže dok se `activeGroupId` ne "odblokira"
  // sledećim ručnim klikom na neku ActivityBar ikonicu. Rešenje: `activeGroupId` se sad AUTOMATSKI
  // sinhronizuje sa STVARNOM putanjom na svaku promenu (dodatno uz ručne klikove, ne umesto njih —
  // ručno "pregledanje" druge grupe preko ActivityBar/TopBar ikonice i dalje radi jer ne menja
  // putanju dok se ne klikne stavka unutar nje).
  useEffect(() => {
    const g = groupForHref(pathname);
    if (g) setActiveGroupId(g.id);
  }, [pathname]);
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
  // Pomeraj trake tabova kad je centralni sadržaj sužen (2.9.2026, na zahtev vlasnika: "pozicija
  // tabova treba da prati veličinu prikaza, logika kao i u prikazu 100%"). Na punoj širini prvi
  // tab stoji tačno na levoj ivici sadržaja — to poravnanje je bilo cilj cele `leftColumnWidth`
  // računice (v1.65→v1.95, tri pokušaja). Čim `<main>` dobije `max-width` i `mx-auto`, njegova
  // leva ivica se pomeri udesno, a traka tabova ostane gde je bila — pa se poravnanje gubi tačno
  // kod korisnika koji je izabrao užu širinu.
  //
  // MERI SE, NE RAČUNA. Isti zaključak kao kod `leftColumnWidth` iznad: leva ivica `<main>`-a
  // zavisi od previše promenljivih stanja (širina bočne trake, otvoren/zatvoren desni panel,
  // `push` naspram `overlay` režima, izabrana granica širine) da bi se pouzdano izračunala.
  // `ResizeObserver` nad samim `<main>`-om hvata svaku od tih promena, jer svaka menja njegovu
  // širinu; pozicija se onda čita iz stvarnog `getBoundingClientRect()`.
  //
  // Poravnava se SAMO leva ivica — namerno. I na punoj širini traka tabova ide do polja za
  // pretragu, dakle preko prostora desnog panela; to je "logika kao u prikazu 100%" i ne menja se.
  const mainRef = useRef<HTMLElement>(null);
  const [tabOffset, setTabOffset] = useState(0);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    function measure() {
      const main = mainRef.current;
      const column = leftColumnRef.current;
      if (!main) return;
      // Traka tabova u `TopBar`-u počinje tačno na `leftColumnWidth` (spacer + padding + gap se
      // međusobno ponište, vidi HEADER_PADDING_GAP tamo). Razlika do stvarne leve ivice sadržaja
      // je pomeraj koji traci treba dodati.
      const columnRight = column ? column.getBoundingClientRect().right : 0;
      setTabOffset(Math.max(0, Math.round(main.getBoundingClientRect().left - columnRight)));
    }
    measure();
    const observer = new ResizeObserver(measure);
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

  // Pozicija AI asistenta (dizajn dok. §6c.0 dopuna, 3.9.2026, na vlasnikov zahtev: „omogućite
  // da se polje klikom na strelicu koja pokazuje prema centralnom panelu pojavi u dnu centralnog
  // panela, kao ovde u VS Code"). Isti obrazac pamćenja kao `rightPanelMode`.
  //
  // Ključno: POLJE JE JEDNO. `AiChatBox` se montira tačno jednom, ovde, i portalom se prikazuje
  // u slotu desnog panela ili u slotu donjeg doka. Da se umesto toga renderovao na dva mesta,
  // svako premeštanje bi ga remontiralo i izgubilo istoriju razgovora — a dva odvojena polja bi
  // bila ista greška koju CLAUDE.md zabranjuje (isti posao na dva mesta).
  const [aiDock, setAiDock] = useState<'right' | 'bottom'>('right');
  const [aiSlot, setAiSlot] = useState<HTMLDivElement | null>(null);
  const aiHostRef = useRef<HTMLDivElement | null>(null);
  // `useLayoutEffect` (pre iscrtavanja) — sa običnim `useEffect` bi se domaćin na trenutak video
  // na svom polaznom mestu u dnu stranice.
  useLayoutEffect(() => {
    const host = aiHostRef.current;
    if (host && aiSlot && host.parentElement !== aiSlot) aiSlot.appendChild(host);
  }, [aiSlot]);
  function moveAiDock(next: 'right' | 'bottom') {
    setAiDock(next);
    setAiSlot(null); // stari slot nestaje iz DOM-a; novi se javi svojim callback ref-om
    fetch(`/api/preferences/${AI_DOCK_PREFERENCE_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    }).catch(() => {
      // Kao i kod ostalih podešavanja — važi za ovu sesiju, samo se ne pamti trajno.
    });
  }

  // Širina centralnog sadržaja — isti obrazac kao `rightPanelMode` iznad: podrazumevana vrednost
  // na serveru i prvom klijentskom renderu (nema neusklađenosti pri hidrataciji), stvarna se čita
  // posle montiranja i pamti u `UserPreference` (M1 §3.9), dakle po NALOGU a ne po browseru —
  // korisnik zatiče svoju širinu i na drugom računaru.
  const [mainWidth, setMainWidth] = useState<MainWidth>(DEFAULT_MAIN_WIDTH);

  // Jedan poziv učitava SVA TRI podešavanja odjednom (`GET /iam/users/me/preferences` vraća mapu),
  // pa stoji ovde — ispod poslednjeg stanja koje puni, ne uz prvo. Ranije je stajao iznad
  // `aiDock` i `mainWidth` i koristio njihove settere pre nego što su deklarisani; setteri iz
  // `useState` imaju stabilan identitet pa posledice nije bilo, ali je nalaz zaklanjao tri
  // stvarna slučaja iste vrste (dok. 41 B1, ESLint `react-hooks/immutability`).
  useEffect(() => {
    fetch('/api/preferences', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const value = data?.right_panel_display_mode;
        if (value === 'overlay' || value === 'push') setRightPanelMode(value);
        // Isti odgovor nosi SVE preference korisnika (`GET /iam/users/me/preferences` vraća mapu),
        // pa se širina centralnog sadržaja čita iz njega — bez drugog mrežnog poziva.
        if (isMainWidth(data?.[MAIN_WIDTH_PREFERENCE_KEY])) setMainWidth(data[MAIN_WIDTH_PREFERENCE_KEY]);
        const dock = data?.[AI_DOCK_PREFERENCE_KEY];
        if (dock === 'right' || dock === 'bottom') setAiDock(dock);
      })
      .catch(() => {
        // Podrazumevano ostaje "push" — ne blokira prikaz panela zbog neuspelog čitanja podešavanja.
      });
  }, []);
  function changeMainWidth(next: MainWidth) {
    setMainWidth(next);
    fetch(`/api/preferences/${MAIN_WIDTH_PREFERENCE_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    }).catch(() => {
      // Kao i kod `rightPanelMode` — izmena važi za ovu sesiju, samo se ne pamti trajno.
    });
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  return (
    <TabsProvider homeLabel="Početna">
      <SelectionProvider onFirstAdd={openRightPanelForCurrentModule}>
      <RowSummaryProvider onFirstShow={openRightPanelForCurrentModule}>
      <ProductPreviewProvider onFirstShow={openRightPanelForCurrentModule}>
      <PanelCollectionProvider onFirstAdd={(moduleId) => setRightPanelOpenModules((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)))}>
      <GroupSearchBuilderProvider>
      <SearchStateProvider>
      <SearchFiltersProvider>
      <KatalogProvider>
      {/* `onFirstAdd` NE otvara desni panel dok je korisnik u Fokus tabu (dopuna 25.8.2026, na
          zahtev vlasnika: "kada se klikne na # otvara se odmah desni panel iako je vec ai agent
          u celom tabu. To ukinite") — AI chat je tamo već preko celog centralnog prostora
          (`/ai-asistent`, §6c.0), otvaranje desnog panela pored njega nema smisla/nepotrebno je. */}
      <AiContextProvider onFirstAdd={() => { if (pathname !== '/ai-asistent') openRightPanelForCurrentModule(); }}>
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
          <TopBar leftColumnWidth={leftColumnWidth} tabOffset={tabOffset} />
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
                items={items}
                activeGroupId={activeGroup?.id ?? ''}
                // ISPRAVKA (26.8.2026, na zahtev vlasnika: "kad se skupi levi panel ima neki bag
                // i treba više puta da se klikne kako bi se ponovo otvorio") — dok je traka
                // skupljena, klik na NEAKTIVNU grupu je do sad samo pozivao `setActiveGroupId`
                // (Sidebar ostaje montiran kao `null` dok je `collapsed`, pa se ništa vidljivo
                // nije desilo); tek SLEDEĆI klik je pogađao "već aktivnu" granu u ActivityBar-u
                // koja stvarno zove `onToggleCollapse`. Sad izbor grupe dok je skupljeno odmah i
                // širi traku — jedan klik, ne dva.
                onSelectGroup={(id) => {
                  setActiveGroupId(id);
                  if (sidebarCollapsed) setCollapsed(false);
                }}
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
              {/* Centralni sadržaj na PUNIH 100% dostupne širine (29.8.2026, na zahtev vlasnika,
                  tt-shadcn-redesign — "centralni panel uvek treba da bude na 100% širine bez
                  obzira koliko su bočni paneli široki") — POVLAČI raniju `w-[90%] mx-auto`
                  odluku (21.8.2026, §komentar u istoriji ovog fajla): tih 10% margine je
                  postajalo sve primetnije kad bi bočni paneli oduzeli deo dostupnog prostora,
                  jer je 90% ionako sve manjeg preostalog prostora izgledalo kao da se centar
                  dodatno skuplja. Bez `mx-auto`/fiksne širine, `flex-1` sam ispuni tačno onoliko
                  prostora koliko ostane između bočne trake i desnog panela, u svakom stanju. */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* `id` čita AiChatBox.tsx da automatski priloži vidljiv sadržaj ovog taba uz
                    svaku poruku (M15 spec §6.5.1 dopuna, 22.8.2026, na zahtev vlasnika) — bez
                    ovog `id`-ja nema drugog opšteg mesta da se "trenutan sadržaj ekrana" pročita
                    bez posebnog ožičenja svakog od 18 ekrana ponaosob. AiChatBox je od 25.8.2026
                    (§6c.0) dokovan deo `RightPanel` (ispod) — SUSED ovog `<main>`, ne njegov
                    potomak, pa čitanje ostaje bezbedno (nema rizika od rekurzivnog čitanja
                    sopstvene istorije). Izuzetak: `/ai-asistent` Fokus tab, gde AiChatBox JESTE
                    ovaj `<main>` sadržaj — `fokus` prop tamo isključuje čitanje (AiChatBox.tsx). */}
                {/* Gornja granica širine (2.9.2026, §6b.1) — postavljena kao `maxWidth` na sam
                    `<main>`, uz `mx-auto` da se sadržaj centrira kad granica stvarno deluje.
                    `w-full` ostaje: bez njega bi `max-width` na flex-detetu davao širinu po
                    sadržaju, ne po raspoloživom prostoru. Kad je izabrano `full`, `maxWidth` je
                    `undefined` i ponašanje je BAJT ZA BAJT isto kao pre ove izmene — podrazumevano
                    stanje nikome ne menja ekran dok sam ne izabere užu širinu. Granica se namerno
                    postavlja na `<main>`, ne na neki omotač iznad: `bg-panel` tada prati sadržaj,
                    pa se pri užoj širini vidi `--bg` sa strane i granica čita kao namerna, ne kao
                    prazan hod. */}
                <main
                  ref={mainRef}
                  id="tt-main-content"
                  style={mainWidth === 'full' ? undefined : { maxWidth: `${mainWidth}px` }}
                  className="mx-auto w-full flex-1 overflow-y-auto bg-panel"
                >
                  {children}
                </main>
                {/* Terminal panel (dizajn dok. §5f, M15 spec §6.9) — VS Code pozicija, ispod
                    sadržaja, iznad statusne trake, span samo centralne kolone (ne ide ispod
                    bočne trake/desnog panela, isto kao pravi VS Code Panel). Montira se SAMO uz
                    `showBiTerminal` (RBAC, isključivo VLASNIK) — nema onemogućenog stanja. */}
                {showBiTerminal && layoutVisibility.terminal && <TerminalPanel onClose={() => toggleLayout('terminal')} />}
                {/* AI asistent u dnu centralne kolone — ista VS Code pozicija kao Terminal iznad
                    (§6c.0 dopuna, 3.9.2026). Sused `<main>`-a, ne njegov potomak: `AiChatBox`
                    čita `#tt-main-content` da priloži sadržaj ekrana, pa bi kao potomak čitao
                    sopstvenu istoriju. */}
                {aiDock === 'bottom' && (
                  <AiDockBottom
                    slotRef={setAiSlot}
                    onMoveToRight={() => moveAiDock('right')}
                  />
                )}
              </div>
            </div>
            {/* Dizajn dok. §6c.0 (dopuna 25.8.2026, na zahtev vlasnika) — AI chat je sad TRAJAN
                deo `RightPanel` (naslagan ispod postojećeg sažetka/podsetnika), ne poseban
                plutajući prozor. `ResizablePane` je UVEK montiran (`collapsed={!rightPanelOpen}`,
                isti obrazac kao bočna traka) — `RightPanel`/`AiChatBox` se nikad ne uklanjaju iz
                DOM-a, istorija razgovora se ne gubi zatvaranjem panela.

                Push/overlay (§6c.0) — "push" (podrazumevano) ostaje u normalnom flex toku,
                sužava centralni sadržaj. "overlay" prelazi na `position: fixed` uz desnu ivicu —
                NE menja širinu centralnog sadržaja, samo ga delimično prekriva. ISTA širina u
                oba režima (dopuna 25.8.2026, na zahtev vlasnika: "sirina desnog panela neka bude
                iste sirine (sira varijanta) i kada prelaze i kada ne prelaze preko sadrzaja") —
                ISTI `ResizablePane` (isti `storageKey`, pamti JEDNU širinu bez obzira na režim,
                podrazumevano 420px, šira od ranije 320px push vrednosti) u OBA slučaja; za
                overlay je samo dodatno UMOTAN u `position: fixed` omotač bez sopstvene širine
                (`fixed`/`right-0` sa `width: auto` se skuplja na širinu deteta — `ResizablePane`
                i dalje diktira stvaran broj piksela preko sopstvenog `style={{width}}`).
                Prelazak između režima remontira `RightPanel` (različit roditelj) — istorija
                razgovora se u tom retkom, eksplicitnom trenutku gubi; svako drugo otvaranje/
                zatvaranje je bezbedno. */}
            {rightPanelMode === 'push' ? (
              <ResizablePane storageKey="tt-panel-right-width" defaultWidth={420} minWidth={260} maxWidth={560} handleSide="left" collapsed={!rightPanelOpen} collapsedWidth={0}>
                <RightPanel
                  moduleId={currentModuleId}
                  moduleLabel={currentModuleLabel}
                  onClose={closeRightPanelForCurrentModule}
                  displayMode={rightPanelMode}
                  onToggleDisplayMode={toggleRightPanelMode}
                  aiDock={aiDock}
                  aiSlotRef={setAiSlot}
                  onMoveAiToBottom={() => moveAiDock('bottom')}
                />
              </ResizablePane>
            ) : (
              // `right-[43px]`/`bottom-[43px]` (5.9.2026, dopuna) — desna traka (`RightRail.tsx`)
              // sad zauzima 43px uz desnu ivicu ekrana, i StatusBar je porastao sa 29px na 43px
              // (isti zahtev, "visina donje trake ista kao gornje") — overlay panel mora da
              // ostavi prostor za oboje, ne da ih prekrije.
              <div className="fixed bottom-[43px] right-[43px] top-[43px] z-30 shadow-lg" style={{ display: rightPanelOpen ? undefined : 'none' }}>
                <ResizablePane storageKey="tt-panel-right-width" defaultWidth={420} minWidth={260} maxWidth={560} handleSide="left">
                  <RightPanel
                    moduleId={currentModuleId}
                    moduleLabel={currentModuleLabel}
                    onClose={closeRightPanelForCurrentModule}
                    displayMode={rightPanelMode}
                    onToggleDisplayMode={toggleRightPanelMode}
                    aiDock={aiDock}
                    aiSlotRef={setAiSlot}
                    onMoveAiToBottom={() => moveAiDock('bottom')}
                  />
                </ResizablePane>
              </div>
            )}
            {/* Desna vertikalna traka (5.9.2026, vlasnikov zahtev: "formirajte desnu traku i tu
                smestite sve ikone iz gornje trake iz desnog ugla") — ogledalo `ActivityBar.tsx`
                na suprotnoj ivici ekrana, POSLEDNJI element ovog reda tako da ostaje uz desnu
                ivicu ekrana bez obzira na push/overlay stanje desnog panela iznad. */}
            <RightRail
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
                mainWidth,
                onChangeMainWidth: changeMainWidth,
              }}
            />
          </div>
          {layoutVisibility.statusBar && (
            <StatusBar
              fullName={fullName}
              roleLabel={roles.join(', ')}
              moduleCode={moduleCodeForHref(pathname)}
            />
          )}
        </div>
        {/* JEDINI `AiChatBox` u aplikaciji, u stabilnom domaćinu koji se FIZIČKI premešta u
            aktivan slot (desni panel ili dno centralne kolone), umesto da se prerenderuje tamo.
            Zašto ovako, a ne portalom: promena odredišta portala je za React nov portal — dete
            se odmontira i ponovo montira, pa se gubi i istorija razgovora i nedovršen tekst u
            polju (izmereno: tekst je posle premeštanja bio prazan). Ovde React uopšte ne dira
            roditelja — samo mi premestimo jedan čvor, a njegovo stanje ostaje netaknuto. */}
        {/* Parkiralište domaćina dok nijedan slot nije aktivan (ispravka 4.9.2026, vlasnikov
            nalaz: "i dalje se pojavljuje ovaj prazan prostor kada se skroluje na dole").
            Domaćin je SUSED glavnog `h-screen` bloka, pa je — dok stoji ovde nepremešten —
            bio običan element u toku dokumenta i dodavao svoju visinu ISPOD ekrana: telo
            stranice je time postajalo više od prozora, skrol se pojavljivao, a ispod statusne
            trake zjapio je prazan pravougaonik veličine chata. Omotač je `fixed` i nulte
            veličine, pa parkiran domaćin ne doprinosi visini dokumenta; kad ga `useEffect`
            iznad premesti u slot, ovde ostaje prazna ljuska bez ikakvog uticaja. Ne `hidden`
            i ne `display:none` — čvor mora ostati živ i merljiv, jer se FIZIČKI premešta sa
            svojim stanjem (vidi napomenu iznad). */}
        <div className="pointer-events-none fixed bottom-0 left-0 h-0 w-0 overflow-hidden">
          <div ref={aiHostRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <AiChatBox />
          </div>
        </div>
        <CommandPalette items={items} />
        <NotificationStack />
      </AiContextProvider>
      </KatalogProvider>
      </SearchFiltersProvider>
      </SearchStateProvider>
      </GroupSearchBuilderProvider>
      </PanelCollectionProvider>
      </ProductPreviewProvider>
      </RowSummaryProvider>
      </SelectionProvider>
    </TabsProvider>
  );
}
