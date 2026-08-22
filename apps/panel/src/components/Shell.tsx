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
  // AI chat kao plutajući prozor umesto trajno usidrenog dela centralnog panela (22.8.2026, na
  // zahtev vlasnika — "chat treba da se pojavljuje na klik na ikonu... drugi klik se uklanja iz
  // vidokruga, ne briše se ono što je chatovano"). Poništava raniji princip "uvek deo centralnog
  // panela" (dizajn dok. §6c, 19.8.2026) — svesna izmena, ne previd. `chatOpen` samo kontroliše
  // VIDLJIVOST (CSS `hidden`, ne uslovan JSX render) — `AiChatBox` ostaje montiran i kad je
  // sakriven, njegovo `turns` stanje (istorija razgovora) se time nikad ne gubi.
  const [chatOpen, setChatOpen] = useState(true);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  // Klik van plutajućeg chata ga zatvara (22.8.2026, na zahtev vlasnika — "kada se klikne na
  // bilo šta što ga zaklanja chat da se zatvori u stanju u kom je zatečen"), isti obrazac kao
  // `messagesRef` u StatusBar.tsx. Dugme za otvaranje/zatvaranje (`data-chat-toggle`, u
  // StatusBar.tsx) je namerno izuzeto iz ove provere — bez izuzetka bi mousedown prvo zatvorio
  // chat, a potom bi klik (onToggleChat) odmah ponovo otvorio, umesto da običan klik na dugme
  // radi kao pravi prekidač. Rešava i zaklanjanje menija "Poruke" (donja traka) — klik na tu
  // ikonu se sad tretira kao "van chata" i zatvara ga PRE nego što se meni otvori.
  useEffect(() => {
    if (!chatOpen) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (chatPanelRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-chat-toggle]')) return;
      setChatOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [chatOpen]);

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
          <TopBar rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen((v) => !v)} />
          <div className="flex flex-1 overflow-hidden">
            <ActivityBar groups={groups} activeGroupId={activeGroup?.id ?? ''} onSelectGroup={setActiveGroupId} />
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
              </div>
            </div>
            {/* Plutajući AI chat (22.8.2026, na zahtev vlasnika) — bez zatamnjenja pozadine
                (vlasnikova eksplicitna odluka preko AskUserQuestion: "plutajući prozor u uglu",
                ne pun modal) — sadržaj ispod ostaje vidljiv/klikabilan dok je chat otvoren, jer AI
                automatski čita sadržaj otvorenog taba (M15 spec §6.5.1) i korisnik treba da može
                da gleda oboje istovremeno. `hidden` (ne uslovan JSX) čuva `AiChatBox` montiranim —
                istorija razgovora se ne gubi kad se prozor sakrije. Širina usklađena sa MAKSIMALNOM
                širinom desnog panela (22.8.2026, drugi krug istog dana, na zahtev vlasnika) —
                `RightPanel` koristi `ResizablePane maxWidth={560}` (ispod, u ovom fajlu), isto
                560px ovde umesto ranijeg proizvoljnog 400px. Spoljni okvir (`border border-border`)
                UKLONJEN na isti zahtev ("nepotreban je") — `shadow-lg` i tonska razlika
                (`bg-panel` naspram `bg-bg`/`bg-panel-2` iza njega) ostaju dovoljni za odvajanje
                bez linije. */}
            <div
              ref={chatPanelRef}
              className={`fixed bottom-[38px] right-4 z-40 w-[560px] max-h-[70vh] flex-col overflow-hidden rounded-lg bg-panel shadow-lg ${
                chatOpen ? 'flex' : 'hidden'
              }`}
            >
              <div className="flex h-[36px] flex-shrink-0 items-center justify-between border-b border-border bg-panel-2 px-3 text-xs font-medium text-ink">
                <span className="flex items-center gap-1.5">
                  <Icon name="sparkle" className="text-accent" /> AI asistent
                </span>
                <button onClick={() => setChatOpen(false)} title="Zatvori (istorija se čuva)" className="text-ink-faint hover:text-ink">
                  <Icon name="close" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AiChatBox />
              </div>
            </div>
            {rightPanelOpen && (
              <ResizablePane storageKey="tt-panel-right-width" defaultWidth={320} minWidth={260} maxWidth={560} handleSide="left">
                <RightPanel onClose={() => setRightPanelOpen(false)} />
              </ResizablePane>
            )}
          </div>
          <StatusBar
            fullName={fullName}
            roleLabel={roles.join(', ')}
            moduleCode={moduleCodeForHref(pathname)}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
          />
        </div>
        <CommandPalette items={items} />
        <NotificationStack />
      </SelectionProvider>
    </TabsProvider>
  );
}
