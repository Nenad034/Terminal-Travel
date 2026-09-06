'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon, { IconDuo } from './Icon';
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
  // Prelazak na drugu grupu poništava „prikaži celu listu" (korisnik je to tražio za PRETHODNU
  // grupu). Podešavanje ide U RENDERU, ne kroz `useEffect` (6.9.2026, ESLint
  // `react-hooks/set-state-in-effect`, dok. 41): sa efektom React prvo iscrta stari, pogrešan
  // sadržaj pa ga odmah zameni — vidljivo kao treptaj na sporijoj mašini. Ovo je obrazac koji
  // React dokumentacija zove „prilagođavanje stanja kad se promeni prop"; poređenje sa
  // prethodnom vrednošću sprečava beskonačan krug.
  const [forceShowList, setForceShowList] = useState(false);
  const [poslednjaGrupa, setPoslednjaGrupa] = useState(activeGroup?.id);
  if (poslednjaGrupa !== activeGroup?.id) {
    setPoslednjaGrupa(activeGroup?.id);
    setForceShowList(false);
  }

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
  // se prikazivao samo u markup-u nikad na ekranu). Ponovno širenje ide preko `ActivityBar.tsx`:
  // do 4.9.2026 isključivo kao sporedan efekat klika na ikonicu grupe, a od tada i preko
  // sopstvene `chevron-right` strelice pri vrhu te trake — par ove `chevron-left` ispod (vlasnikov
  // nalaz: "kada skupimo levi panel strelicom u levo, nemamo za širenje strelicu u desno").
  if (collapsed) return null;

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto bg-panel-2 py-3">
      {/* Jedan red, dve namene na suprotnim krajevima (5.9.2026, vlasnikov zahtev) — LEVO:
          jedna strelica, povratak na spisak sekcija TEKUĆE grupe (samo kad je nešto izabrano,
          `selected`); DESNO: dve strelice (`IconDuo`, isti "dupli glif" obrazac kao "Putovanja"
          ikonica), skupljanje CELE leve trake (ActivityBar+Sidebar kolona), uvek prisutno.
          Vizuelna razlika (jedna naspram dve strelice) razdvaja "nazad jedan nivo" od
          "skupi sve" — ranije su obe akcije delile isti `chevron-left` glif. */}
      <div className="mx-2 mb-1 flex h-[29px] flex-shrink-0 items-center justify-between">
        {selected ? (
          <button
            onClick={() => setForceShowList(true)}
            title={`Nazad na: ${activeGroup.label}`}
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name="chevron-left" />
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onCollapse}
          title="Skupi levu traku"
          className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <IconDuo name="chevron-left" />
        </button>
      </div>
      {selected ? (
        <>
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
          <div>
            <div className="mx-2 mb-2 flex items-center gap-2 px-2 text-[14.52px] font-bold uppercase text-ink-faint">
              <span className="truncate">{activeGroup.label}</span>
            </div>
            {/* Kartica po stavci (5.9.2026, vlasnikov zahtev: "unificirajte sve linkove u
                meniju, stavite u tagove") — isti jezik kao `SidebarSection`/`QuickLinkCard`
                (`rounded-lg border border-border bg-panel p-2`, ikonica u `rounded-md` bedžu).
                Zamenjuje raniju ravnu listu + VS Code "indent guide" liniju (18.8.2026) — ta
                linija je pretpostavljala tanak, neuokviren spisak; kartice sa sopstvenim
                ivicama su suprotan, dosledniji jezik sa ostatkom panela, linija bi ih sad samo
                sekla. */}
            <div className="mx-2 flex flex-col gap-1">
              {sectionItems.map((item) => {
                if (!item.implemented) {
                  return (
                    <div
                      key={item.id}
                      title={`${item.label} — dostupno od Faze ${item.phase} (nije još implementirano)`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 opacity-40"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-faint">
                        <Icon name="lock" />
                      </span>
                      <span className="flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap">
                        <span className="truncate text-xs font-medium text-ink-faint">{item.label}</span>
                        <span className="ml-2 rounded-full bg-panel2 px-1.5 py-0.5 text-[11px] font-mono text-ink-faint">F{item.phase}</span>
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
                    className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 text-left hover:border-accent"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
                      <Icon name={item.icon} />
                    </span>
                    <span className="truncate text-xs font-medium text-ink">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
