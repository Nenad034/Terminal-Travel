'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
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
          <TopBar
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
              {/* Traka tabova preseljena u TopBar (21.8.2026, na zahtev vlasnika: "Tabove
                  stavite i gornju traku izmedju ikona i pretrage i neka budu sirine trake") —
                  ranije poseban red ovde, sad `TabBar` živi unutar `TopBar.tsx`, popunjava
                  prostor između grupnih ikonica i dugmeta za pretragu (mesto gde je ranije bio
                  prazan `flex-1` razmak). Vidi TopBar.tsx. */}
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
                <main className="mx-auto w-[90%] flex-1 overflow-y-auto bg-panel">{children}</main>
                {/* Dizajn dok. §6c — AI razgovor pratilac, uvek deo centralnog panela bez obzira
                    koji modul je aktivan. POVUČENO (21.8.2026, na zahtev vlasnika uz snimak:
                    "Linija ne treba da ide u unutrasnjost panela") — `border-x` ovde je
                    razvlačio liniju kroz CEO blok, uključujući istoriju razgovora iznad polja
                    za unos (unutrašnjost panela), što nije bilo traženo. Okvir sad crta sam
                    `AiChatBox.tsx`, samo oko reda za unos + reda brzih prečica (donja dva reda),
                    ne oko istorije razgovora iznad njih — vidi tamo. */}
                {/* Suženo za 30% (21.8.2026, na zahtev vlasnika: "sada suzite ceo chat za
                    30%") — bilo `w-[72%]`, 72%×0.7≈50%. */}
                <div className="mx-auto my-2 w-[50%] flex-shrink-0 bg-panel shadow-sm">
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
