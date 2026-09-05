'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTabs } from './TabsContext';
import Icon from './Icon';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — traka tabova.
// ISPRAVKA (21.8.2026, na zahtev vlasnika: "tabovi treba da izgledaju kao tagovi u donjem redu
// chata") — poništava prethodni "pravi VS Code" pravougaoni oblik (border-r/border-t-2), sad
// isti tag/pilula oblik kao dugmad brzih prečica u AiChatBox.tsx (`rounded border border-ink-faint
// px-2 py-0.5 text-[11px]`) radi vizuelne doslednosti dva reda koja su blizu jedan drugom.
// ISKOŠENE IVICE — probano pa POVUČENO (22.8.2026, isti dan: dva kruga pokušaja skewX
// paralelograma, pa "ne sviđa mi se, vratite kako je bilo" — nazad na običan pravougaon
// tag/pilula oblik (`rounded border`), bez transform-a. Visina ostaje izjednačena sa poljem
// za pretragu u `TopBar.tsx` (obe `h-[29px]`, jedina trajna izmena iz ovog kruga — ranije
// tabovi nisu imali eksplicitnu visinu nego su je nasleđivali od `<header>` reda preko
// `items-center`/padding-a).
export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, openTab, closeTab, closeAllTabs, togglePin, reorderTabs } = useTabs();
  // Ručno premeštanje tabova (26.8.2026, na zahtev vlasnika: "omogućite ručno menjanje
  // pozicije tabova u centralnom panelu, horizontalno") — nativan HTML5 drag-and-drop (bez
  // nove biblioteke — `docs/00-MASTER-ARHITEKTURA.md` poglavlje 6 nema DnD paket, a nativan
  // API je dovoljan za prostu linearnu listu). `draggedId` prati koji tab se trenutno vuče,
  // `dragOverId` samo za vizuelni indikator gde bi sleteo (razdvojeno da drop na sopstveni
  // tab ili van trake ne ostavi "zaglavljen" indikator).
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    // ISPRAVKA (5.9.2026, vlasnikov zahtev: "ograniciti broj tabova na sirinu trake do ikone za
    // brisanje svih tabova") — ranije je CEO red (tabovi + "+" + "zatvori sve") bio JEDAN
    // `overflow-x-auto` kontejner, pa je "zatvori sve" (`ml-auto`) sa dovoljno otvorenih tabova
    // ležao IZVAN vidljive širine trake — `ml-auto` unutar SKROLUJUĆEG sadržaja samo gura dugme
    // na kraj CELOG sadržaja, ne na vidljivu desnu ivicu, pa je trebalo skrolovati da bi se
    // dugme uopšte videlo. Sad je skrolovanje IZOLOVANO na traku tabova samog (`flex-1 min-w-0
    // overflow-x-auto`, unutrašnji div ispod) — "zatvori sve" je SUSED te trake, van skrola,
    // pa ostaje prikovan uz desnu ivicu bez obzira koliko je tabova otvoreno.
    <div className="flex h-full min-w-0 flex-1 items-center gap-1.5">
      <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <Link
              key={tab.id}
              href={tab.path}
              onClick={(e) => {
                // Klik posle prevlačenja ne sme dodatno da navigira/pomeri fokus (browser
                // ume da ispali `click` neposredno posle `drop`-a na istom elementu).
                if (draggedId) {
                  e.preventDefault();
                  return;
                }
                setActiveTab(tab.id);
              }}
              title={tab.label}
              draggable
              onDragStart={(e) => {
                setDraggedId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!draggedId || draggedId === tab.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverId(tab.id);
              }}
              onDragLeave={() => {
                setDragOverId((cur) => (cur === tab.id ? null : cur));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && draggedId !== tab.id) reorderTabs(draggedId, tab.id);
                setDraggedId(null);
                setDragOverId(null);
              }}
              // Fiksna širina — 20 karaktera (23.8.2026, na zahtev vlasnika: "Sirina tabova
              // treba da bude ista za svaki tab bez obzira na duzinu teksta... 20 karaktera.
              // Ako je tekst duzi neka budu ... tri tacke") — `w-[20ch]` umesto ranijeg
              // `max-w-[200px]` (svaki tab je bio RAZLIČITE širine, do tog maksimuma, u
              // zavisnosti od dužine naziva). `ch` je CSS jedinica širine cifre "0" u trenutnom
              // fontu — najbliža moguća aproksimacija "N karaktera" i za proporcionalan font
              // (ne samo monospace). Pun naziv i dalje dostupan preko `title` (native tooltip
              // na hover, "misem preko taba da se pojavi ceo tekst" — nema potrebe za sopstvenim
              // JS tooltip-om, browser to već radi).
              // Linije tabova — narandžaste (5.9.2026, vlasnikov zahtev: "linije tabova treba da
              // budu u narandzastoj boji"), `--tab-line`/`--tab-line-strong` (globals.css) umesto
              // dotadašnjeg `border-accent`/`border-ink-faint`. Pozadina/tekst aktivnog taba
              // ostaju nepromenjeni (`bg-accent-soft`/`text-ink`) — zahtev se odnosi na LINIJE, ne
              // na popunu.
              className={`group flex h-[29px] w-[20ch] flex-shrink-0 cursor-grab items-center gap-1.5 rounded border px-2 text-[11px] transition-colors active:cursor-grabbing ${
                active ? 'border-tabline-strong bg-accent-soft text-ink' : 'border-tabline text-ink-faint hover:border-tabline-strong hover:text-ink'
              } ${draggedId === tab.id ? 'opacity-40' : ''} ${dragOverId === tab.id ? 'border-tabline-strong border-2' : ''}`}
            >
              {tab.dirty && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" title="Nesačuvane izmene" />}
              {/* `flex-1` (dopuna 25.8.2026, na zahtev vlasnika: "x za zatvaranje tabova stavite u
                  desni kraj a ne iza teksta odmah") — ranije je labela zauzimala samo sopstvenu
                  prirodnu širinu, pa je "x" kod kratkih naziva sedeo odmah uz tekst sa praznim
                  prostorom do desne ivice taba. Sad labela puni preostali prostor (i dalje se seče
                  na `truncate` kad ne stane), "x" je UVEK na desnoj ivici bez obzira na dužinu teksta. */}
              {/* Boldirana slova (5.9.2026, vlasnikov zahtev: "boldiraj slova u tabovima
                  centralnog panela") — `font-semibold` za sve tabove, ne samo aktivan (dizajn
                  dok. §5a i dalje razlikuje aktivan/neaktivan isključivo bojom pozadine/teksta i
                  linijom, ne debljinom slova). */}
              <span className="min-w-0 flex-1 truncate font-semibold">{tab.label}</span>
              {/* Pinovanje (5.9.2026, vlasnikov zahtev: "omoguci pinovanje tabova... i kada se
                  aplikacija ugasi pa ponovo pokrene") — zakačen tab dobija UVEK vidljivu (ne
                  samo na hover) punu ikonicu umesto ×; klik otkačuje. Nezakačen tab na hover
                  dobija DVE sitne ikonice — obris pribadače (kači) i × (zatvara, kao ranije). */}
              {tab.pinned ? (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePin(tab.id);
                  }}
                  title="Otkači tab"
                  className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded text-accent hover:bg-panel2"
                >
                  <Icon name="pinned" className="!text-[12px]" />
                </span>
              ) : (
                <>
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePin(tab.id);
                    }}
                    title="Zakači tab (ostaje otvoren i posle gašenja i ponovnog pokretanja aplikacije)"
                    className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-panel2"
                  >
                    <Icon name="pin" className="!text-[12px]" />
                  </span>
                  {tabs.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-danger-bg hover:text-danger"
                    >
                      <Icon name="close" className="!text-[12px]" />
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => openTab('/blank', 'Novi tab', { forceNew: true })}
          title="Nov, prazan tab (docs/analize/29-DIZAJN-SISTEM-UI.md §5a) — više klikova otvara više odvojenih praznih tabova"
          className="flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <Icon name="add" className="!text-[14px]" />
        </button>
      </div>
      {/* Na zahtev vlasnika, 19.8.2026 — vidljivo tek kad ima "previše" otvorenih tabova. Van
          skrolujuće trake (gore) — vidi komentar uz spoljni kontejner. */}
      {tabs.length > 3 && (
        <button
          onClick={closeAllTabs}
          title="Zatvori sve tabove"
          className="flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger"
        >
          <Icon name="close-all" className="!text-[14px]" />
        </button>
      )}
    </div>
  );
}
