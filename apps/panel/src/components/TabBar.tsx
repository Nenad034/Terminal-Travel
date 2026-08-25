'use client';

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
  const { tabs, activeTabId, setActiveTab, openTab, closeTab, closeAllTabs } = useTabs();

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <Link
            key={tab.id}
            href={tab.path}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            // Fiksna širina — 20 karaktera (23.8.2026, na zahtev vlasnika: "Sirina tabova
            // treba da bude ista za svaki tab bez obzira na duzinu teksta... 20 karaktera.
            // Ako je tekst duzi neka budu ... tri tacke") — `w-[20ch]` umesto ranijeg
            // `max-w-[200px]` (svaki tab je bio RAZLIČITE širine, do tog maksimuma, u
            // zavisnosti od dužine naziva). `ch` je CSS jedinica širine cifre "0" u trenutnom
            // fontu — najbliža moguća aproksimacija "N karaktera" i za proporcionalan font
            // (ne samo monospace). Pun naziv i dalje dostupan preko `title` (native tooltip
            // na hover, "misem preko taba da se pojavi ceo tekst" — nema potrebe za sopstvenim
            // JS tooltip-om, browser to već radi).
            className={`group flex h-[29px] w-[20ch] flex-shrink-0 items-center gap-1.5 rounded border px-2 text-[11px] transition-colors ${
              active ? 'border-accent bg-accent-soft text-ink' : 'border-ink-faint text-ink-faint hover:border-accent hover:text-ink'
            }`}
          >
            {tab.dirty && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" title="Nesačuvane izmene" />}
            {/* `flex-1` (dopuna 25.8.2026, na zahtev vlasnika: "x za zatvaranje tabova stavite u
                desni kraj a ne iza teksta odmah") — ranije je labela zauzimala samo sopstvenu
                prirodnu širinu, pa je "x" kod kratkih naziva sedeo odmah uz tekst sa praznim
                prostorom do desne ivice taba. Sad labela puni preostali prostor (i dalje se seče
                na `truncate` kad ne stane), "x" je UVEK na desnoj ivici bez obzira na dužinu teksta. */}
            <span className="min-w-0 flex-1 truncate">{tab.label}</span>
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
      {/* Na zahtev vlasnika, 19.8.2026 — vidljivo tek kad ima "previše" otvorenih tabova. */}
      {tabs.length > 3 && (
        <button
          onClick={closeAllTabs}
          title="Zatvori sve tabove"
          className="ml-auto flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger"
        >
          <Icon name="close-all" className="!text-[14px]" />
        </button>
      )}
    </div>
  );
}
