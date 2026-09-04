'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import SearchSidebarPanel from './SearchSidebarPanel';
import SavedViewsSidebarPanel from './SavedViewsSidebarPanel';
import SavedGroupSearchesSidebarPanel from './SavedGroupSearchesSidebarPanel';
import HomeSidebarPanel from './HomeSidebarPanel';
import KatalogSidebarPanel from './KatalogSidebarPanel';
import { useTabs } from './TabsContext';
import type { NavGroup, NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — leva traka prikazuje spisak sekcija AKTIVNE
// grupe (obično 2-4 stavke); klik na jednu sekciju kolabira prikaz na samo tu sekciju,
// strelica nazad vraća spisak grupe bez gubljenja mesta grupe. Aktivna grupa se bira u
// gornjoj traci (Shell.tsx) — ovaj komponent samo prikazuje njen sadržaj.
export default function Sidebar({
  items,
  activeGroup,
  mePresent,
  onCollapse,
  collapsed,
}: {
  items: NavItem[];
  activeGroup: NavGroup | null;
  mePresent: boolean;
  onCollapse: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { openTab } = useTabs();
  const [forceShowList, setForceShowList] = useState(false);

  useEffect(() => {
    setForceShowList(false);
  }, [activeGroup?.id]);

  if (!mePresent || !activeGroup) return null;

  const sectionItems = activeGroup.itemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is NavItem => Boolean(i));

  const selected = !forceShowList
    ? sectionItems.find((i) => pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href)))
    : undefined;

  // Kolabovano — TRAKA NESTAJE POTPUNO (23.8.2026, na zahtev vlasnika: "kada uvlacimu levi
  // panel, treba da ostane samo leva traka [ActivityBar] ne i ova druga kolona"), poništava
  // v1.x "tanka traka sa ikonicama" obrazac (19.8.2026). `ResizablePane` (Shell.tsx) sad
  // kolabuje na 0px umesto 40px — ova grana više nema gde da se prikaže (overflow-hidden na
  // 0-širinom kontejneru), pa se ovde ni ne pokušava renderovati (mrtav kod bi ostao ako bi
  // se prikazivao samo u markup-u nikad na ekranu). Ponovno širenje ide preko `ActivityBar.tsx`
  // (klik na već aktivnu grupu), ne preko strelice koja je ranije živela ovde.
  if (collapsed) return null;

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto bg-panel-2 py-3">
      <button
        onClick={onCollapse}
        title="Skupi levu traku"
        className="mx-2 mb-1 flex h-[29px] w-[29px] flex-shrink-0 items-center justify-center self-end rounded text-ink-faint hover:bg-panel hover:text-ink"
      >
        <Icon name="chevron-left" />
      </button>
      {selected ? (
        <>
          <button
            onClick={() => setForceShowList(true)}
            className="mx-2 mb-2 flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name="chevron-left" />
            <span className="truncate">{activeGroup.label}</span>
          </button>
          <div className="mx-2 mb-1 flex items-center gap-2 px-2 text-xs font-medium text-ink">
            <Icon name={selected.icon} />
            <span className="truncate">{selected.label}</span>
          </div>
          {/* M5 pretraga — vođena pretraga + filteri u levom panelu (dizajn dok. §5b/§6d),
              van obima za ostatak sekcija (M17 spec §4a), ostaje sledeći korak po sekciji. */}
          {selected.id === 'pretraga' && <SearchSidebarPanel />}
          {/* Sačuvane pretrage (26.8.2026, na zahtev vlasnika: "omogućite čuvanje filtera
              pretrage kako bi se vratili po želji, max 10 pretraga") — isti mehanizam kao
              "Sačuvani prikazi" za listu rezervacija ispod, sad generalizovan (SavedViewsSidebarPanel
              props), sopstven ključ i gornja granica od 10. Klik uvek navigira na PRAVU pretragu
              (nov GET /sales/search poziv) — cena/dostupnost se time uvek proveravaju iznova. */}
          {selected.id === 'pretraga' && (
            <SavedViewsSidebarPanel
              preferenceKey="saved_views.rezervacije_pretraga"
              baseHref="/rezervacije/pretraga"
              maxItems={10}
              emptyHint="Sačuvaj trenutnu pretragu (dugme pored 'izmeni' na vrhu) da je vidiš ovde."
            />
          )}
          {/* Grupne pretrage (29.8.2026, na zahtev vlasnika: "omogućite čuvanje i grupnih
              pretraga") — više pojedinačnih pretraga (npr. let + hotel + transfer) sačuvanih
              zajedno, M5 spec v1.82. */}
          {selected.id === 'pretraga' && <SavedGroupSearchesSidebarPanel />}
          {/* Sačuvani prikazi (24.8.2026, na zahtev vlasnika: "Filtere za listu rezervacija
              stavimo u levi panel... Ima dosta praznog prostora") — dizajn dok. §5b, isti
              obrazac kao pretraga iznad, samo za "Lista rezervacija". */}
          {selected.id === 'rezervacije-lista' && <SavedViewsSidebarPanel />}
          {/* Sažetak + brzi linkovi za Početnu (26.8.2026, na zahtev vlasnika, uz snimak
              ekrana GitLens-ove "Get Started" table kao primer) — isti obrazac kao dva
              panela iznad, popunjava ranije prazan prostor ispod naslova "Početna". */}
          {selected.id === 'pocetna' && <HomeSidebarPanel items={items} />}
          {/* Filteri kataloga (4.9.2026, na zahtev vlasnika: "ove filtere stavite u levi panel
              kao sto smo uradili kod pretrage") — isti obrazac kao pretraga iznad. */}
          {selected.id === 'katalog' && <KatalogSidebarPanel />}
        </>
      ) : (
        <>
          {/* Ikona uklonjena (26.8.2026, na zahtev vlasnika, uz snimak ekrana — "u svakoj
              stavci menija imate po dve iste ikone") — dupliraj sa ActivityBar ikonicom cele
              grupe (isti `activeGroup.icon`, levo od ove trake). Naziv VELIKIM SLOVIMA i
              uvećan još 10% (26.8.2026, na zahtev vlasnika: "Nazivi modula neka budu napisani
              velikim slovima, uvecajte ih za jos 10%" — 13.2px × 1.1 = 14.52px, nastavak
              prethodnog +10% prolaza istog dana), `uppercase` čisto vizuelno (CSS
              `text-transform`, ne menja stvaran string) — isti obrazac kao VS Code naslovi
              sekcija u bočnoj traci ("EXPLORER", "OUTLINE"...).
              Vertikalna linija (isti dan, na zahtev vlasnika: "Povezite naziv modula sa
              stavkama modula onim linijama kao kada se u VS Code ispisuje tekst", tj. linije
              za vođenje/indent guide kao u VS Code stablu) — poravnata sa horizontalnim
              centrom ikonica stavki ispod (`left-5` = 20px = `mx-2`(8px) stavke + pola od
              `w-6`(24px) ikonice), proteže se od dna naslova do dna poslednje stavke. */}
          <div className="relative">
            <div className="mx-2 mb-2 flex items-center gap-2 px-2 text-[14.52px] font-bold uppercase text-ink-faint">
              <span className="truncate">{activeGroup.label}</span>
            </div>
            <div aria-hidden className="pointer-events-none absolute bottom-2 left-5 top-[26px] w-px bg-ink-faint/30" />
            {sectionItems.map((item) => {
              if (!item.implemented) {
                return (
                  <div
                    key={item.id}
                    title={`${item.label} — dostupno od Faze ${item.phase} (nije još implementirano)`}
                    className="mx-2 flex items-center gap-3 rounded px-2 py-2 text-ink-faint opacity-40"
                  >
                    <span className="flex w-[29px] items-center justify-center">
                      <Icon name="lock" />
                    </span>
                    <span className="flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap text-xs">
                      <span className="truncate">{item.label}</span>
                      <span className="ml-2 rounded-full bg-panel px-1.5 py-0.5 text-[11px] font-mono">F{item.phase}</span>
                    </span>
                  </div>
                );
              }
              return (
                // ISPRAVKA (27.8.2026, na zahtev vlasnika: "kada kliknem na Pretraga i
                // rezervacije ništa se ne događa... moram da kliknem na drugu ikonu pa da se
                // vratim") — obična `<Link href>` je ovde ponekad ostavljala adresu promenjenu
                // ali sadržaj neosvežen (nepouzdano App Router "meko" navigiranje na ovoj
                // stranici), isti simptom kao ranije popravljena "openTab je ranije SAMO
                // upisivao zapis" greška (`TabsContext.tsx` komentar). Rešenje je isto — umesto
                // pasivnog `<Link>`-a, klik EKSPLICITNO zove `openTab(href, label)`, koji
                // eksplicitno poziva `router.push` i sinhrono upisuje/aktivira tab, bez
                // oslanjanja na to da će `<Link>` sam pouzdano izvršiti tranziciju.
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openTab(item.href, item.label)}
                  title={item.label}
                  className="mx-2 flex items-center gap-3 rounded px-2 py-2 text-left text-sm text-ink-dim hover:bg-panel hover:text-ink"
                >
                  <span className="flex w-6 items-center justify-center">
                    <Icon name={item.icon} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </nav>
  );
}
