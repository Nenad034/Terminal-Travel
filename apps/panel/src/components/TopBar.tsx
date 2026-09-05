'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import TabBar from './TabBar';
import CustomizeLayoutButton from './CustomizeLayoutButton';
import { useTabs } from './TabsContext';
import NotificationBell from './NotificationBell';

interface AgentInboxSource {
  moduleCode: string;
  actionCode: string;
  label: string;
  count: number;
}

// Dizajn dok. §5c / M15 spec poglavlje 6 — "stalno vidljiva ikonica sa brojem na kraju gornje
// trake", ne stavka menija. Agent Inbox nema sopstvenu rutu — isti agregovan prikaz kao
// kontrolna tabla (Početna, M17 spec §5, kartica "Agent Inbox — čeka odobrenje") — klik zato
// otvara Početnu kao nov tab, ne novu stranicu. Nema M15/agent-inbox/VIEW dozvolu → 403 →
// ikonica se ne prikazuje (isti princip ćutljivog izostavljanja kao StatusBar AI status).
function InboxButton() {
  const { openTab } = useTabs();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/ai-orchestration/inbox', { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setCount(null);
          return;
        }
        const sources: AgentInboxSource[] = await res.json();
        setCount(sources.reduce((sum, s) => sum + s.count, 0));
      } catch {
        if (!cancelled) setCount(null);
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (count === null) return null;

  return (
    <button
      onClick={() => openTab('/', 'Agent Inbox')}
      title="Agent Inbox — čeka odobrenje"
      className="relative flex h-[43px] w-[43px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
    >
      <Icon name="inbox" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[11px] font-semibold leading-none text-accent-ink">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — grupne ikonice preseljene u ActivityBar.tsx
// (vertikalna traka, 21.8.2026) — gornja traka sad nosi tabove, pretragu i desni klaster
// dugmadi. Logo VRAĆEN u gornju traku (23.8.2026, na zahtev vlasnika: "Uklonite logo iz levog
// panela onemogucava da se panel skroz zatvori... stavite na gornju traku iznad levog panela")
// — poništava v1.71/v1.72 obrazac (logo je bio na dnu Sidebar-a, sprečavao potpuno kolabovanje
// jer `<img>` bez eksplicitne širine ne skuplja flex kontejner ispod svoje prirodne veličine).
// Zauzima ISTI `w-[255px]` prostor koji je ranije bio prazan razmak (v1.72) — taj razmak je već
// bio poravnat sa ActivityBar+Sidebar kolonom ispod (43px+224px podrazumevana širina, minus
// 12px padding/gap header-a = 255px, v1.65 računica), pa popunjavanje logotipom automatski
// zadovoljava i "iznad levog panela" i "prvi tab počinje od leve ivice centralnog panela" (širina
// spacer-a nepromenjena, tabovi ostaju na istoj poziciji).
//
// ISPRAVKA (23.8.2026, prvi pokušaj — na zahtev vlasnika, uz snimak ekrana: "i dalje prvi tab
// stoji gde ne treba") — statična `w-[255px]` vrednost je pretpostavljala PROŠIRENU bočnu traku;
// kad je kolabovana/sakrivena, razmak je ostajao preširok. POKUŠAJ 1 (binarno prošireno/uska,
// v1.95) je i dalje bio netačan — druga uživo provera je pokazala da tab i dalje NE stoji tačno
// na ivici centralnog panela (leva kolona ima previše promenljivih stanja — kolabovano/prošireno/
// ručno prevučeno 180-420px/sakriveno — da bi se unapred pogodilo). KONAČNA ISPRAVKA (isti dan,
// drugi pokušaj) — `leftColumnWidth` se više ne pogađa, nego se STVARNO MERI u `Shell.tsx` preko
// `ResizeObserver` nad stvarno renderovanom ActivityBar+Sidebar kolonom i prosleđuje ovde kao
// tačan broj piksela — radi u svakom stanju, uključujući uživo prevlačenje granice.
const HEADER_PADDING_GAP = 12; // header `px-2` (8px) + `gap-1` (4px) pre spacer diva, v1.65 računica

export default function TopBar({
  leftColumnWidth,
  tabOffset,
  rightPanelOpen,
  onToggleRightPanel,
  layoutProps,
}: {
  leftColumnWidth: number;
  /** Razmak od leve ivice centralne kolone do leve ivice suženog sadržaja (Shell.tsx,
   * 2.9.2026) — 0 kad je izabrana puna širina, pa je ponašanje tada nepromenjeno. */
  tabOffset: number;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  layoutProps: Omit<ComponentProps<typeof CustomizeLayoutButton>, 'rightPanelOpen' | 'onToggleRightPanel'>;
}) {
  const spacerWidth = Math.max(0, leftColumnWidth - HEADER_PADDING_GAP);
  const showLabel = spacerWidth >= 100;
  const router = useRouter();
  // Logo zumiranje na klik (24.8.2026, na zahtev vlasnika: "Omogucite da se logo na jedan klik
  // uveca duplo, a na drugi klik da se vrati nazad") — prost toggle, isti troetapno-nazad obrazac
  // kao zvonce/urgentOnly (M5). `overflow-hidden` uklonjen sa roditelja (label i dalje sam sebi
  // ograničava tekst preko `truncate`, ne treba mu roditeljski overflow) da uvećan logo stvarno
  // vizuelno "izađe" preko trake tabova, ne da bude isečen na granici spacer-a.
  const [logoZoomed, setLogoZoomed] = useState(false);

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.push('/prijava');
    router.refresh();
  }

  return (
    <header className="flex h-[43px] flex-shrink-0 items-center gap-1 bg-bar px-2 text-xs">
      <div
        className={`relative flex flex-shrink-0 items-center gap-2 ${showLabel ? 'px-2' : 'justify-center px-0'}`}
        style={{ width: spacerWidth }}
      >
        <button
          onClick={() => setLogoZoomed((z) => !z)}
          title={logoZoomed ? 'Umanji logo' : 'Uvećaj logo'}
          aria-label="Terminal Travel"
          // ISPRAVKA (24.8.2026, na zahtev vlasnika, uz snimak ekrana: "malo se ovde preklapa
          // kada se uveca logo") — uvećan logo (transform ne menja tok/layout ostalih elemenata,
          // samo iscrtavanje) je providno prelazio PREKO taba "Početna" jer PNG ima providnu
          // pozadinu. Neprozirna `bg-bar` (ista boja kao traka, pa se u NEuvećanom stanju ništa
          // ne menja) SAMO kad je uvećan — sad izgleda kao namerna "iskačuća" značka, ne kao
          // providno preklapanje sa tekstom taba ispod.
          // ISPRAVKA #2 (24.8.2026, isti dan, drugi snimak ekrana: "ne deluje lepo sece se u vrhu,
          // uklonite kutiju koja uokviruje") — `origin-left` (Tailwind: "left center") je rastao
          // podjednako gore/dole od vertikalne sredine header-a; header sedi na samom vrhu
          // stranice (y=0), pa je gornja polovina rasta bila fizički isečena ivicom prozora, ne
          // nekim CSS overflow-om koji bi se mogao ukloniti. `origin-top-left` rasta ISKLJUČIVO
          // nadole, u prostor koji stvarno postoji. Okvir (`ring-1 ring-border`) uklonjen — samo
          // senka ostaje, bez uokvirujuće kutije.
          // ISPRAVKA #3 (26.8.2026, na zahtev vlasnika: "kada se klikne na uvecanje loga uklonite
          // pozadinu jer zahvata ikonu za Home i ne vidi se cela") — neprozirna `bg-bar` (uvedena
          // u ISPRAVCI iznad baš da spreči providno preklapanje sa tabom ispod) je sama postala
          // problem: uvećan 2x, taj neprozirni pravougaonik je fizički prekrivao dugme "Početna"
          // pored logotipa. Vlasnik je eksplicitno tražio da pozadina ide, providno preklapanje
          // (ako se ponovo pojavi) je manje ozbiljno od potpuno nevidljivog dugmeta.
          className={`flex flex-shrink-0 items-center gap-2 rounded-md origin-top-left transition-transform duration-150 ${
            logoZoomed ? 'relative z-20 scale-[2]' : 'scale-100'
          }`}
        >
          {/* Nova ikonica (26.8.2026, na zahtev vlasnika, uz sopstveni Gemini-generisan koncept:
              "ovo ce sada da bude nas logo... samo ga prilagodite za prikaz u aplikaciji") —
              4 polja (kvadrat-obris / linije / terminal ">_" / linije), `terminal-travel-icon-v2.svg`,
              nadahnuto konceptom sa slike ali NIJE identična kopija (nadahnuće, ne kopija —
              dogovoreno u razgovoru), maskirana istim mask-image tehnikom kao pre (SVG umesto
              PNG) preko `bg-accent` — zlatna boja aplikacije, isti token kao pre. Wordmark sad
              MALIM slovima ("terminal travel", ne "TTerminal TTravel") u `font-brand`
              (Chakra Petch, globals.css/tailwind.config.ts) — font sa slike koju je vlasnik
              poslao kao ISKLJUČIVO primer željenog fonta za natpis (potvrđeno u razgovoru), ne
              kao logo za kopiranje. */}
          {/* Logo uvećan +15% (26.8.2026, na zahtev vlasnika: "kada se skupi levi panel previše
              se smanjuje logo, uvecajte generalno logo za 15%") — 20px→23px (prošireno stanje),
              16px→18.4px (skupljeno stanje, `!showLabel`), 14px→16.1px (natpis). */}
          <span
            aria-hidden
            className={`block flex-shrink-0 bg-accent ${showLabel ? 'h-[23px] w-[23px]' : 'h-[18.4px] w-[18.4px]'}`}
            style={{
              WebkitMaskImage: 'url(/brand/terminal-travel-icon-v2.svg)',
              maskImage: 'url(/brand/terminal-travel-icon-v2.svg)',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
          {showLabel && (
            <span className="truncate font-brand text-[16.1px] font-bold tracking-wide text-accent">terminal travel</span>
          )}
        </button>
      </div>
      {/* Traka tabova prati levu ivicu sadržaja kad je on sužen (2.9.2026, na zahtev vlasnika:
          "pozicija tabova treba da prati veličinu prikaza, logika kao i u prikazu 100%").
          `paddingLeft` umesto pomeranja celog kontejnera — tabovi se pomeraju udesno, a prostor
          koji ostaje levo i dalje pripada istom flex-detetu, pa se ništa iza njega ne pomera. */}
      <div className="flex h-full min-w-0 flex-1" style={tabOffset > 0 ? { paddingLeft: tabOffset } : undefined}>
        <TabBar />
      </div>
      {/* "traži ili izvrši" (Ctrl K) preseljeno u donju traku, na sredinu (5.9.2026, vlasnikov
          zahtev) — StatusBar.tsx sad nosi to dugme, na mestu koje je oslobodila AI ikonica
          (preseljena u ActivityBar.tsx, poslednja stavka). */}
      <ThemeToggle />
      <NotificationBell />
      <InboxButton />
      <CustomizeLayoutButton {...layoutProps} rightPanelOpen={rightPanelOpen} onToggleRightPanel={onToggleRightPanel} />
      <button
        onClick={onToggleRightPanel}
        title="Desni panel — sažetak/Povezano (dizajn dok. §5b)"
        className={`flex h-[43px] w-[43px] items-center justify-center rounded ${
          rightPanelOpen ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`}
      >
        <Icon name={rightPanelOpen ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} />
      </button>
      <button
        onClick={logout}
        title="Odjava"
        className="flex h-[43px] w-[43px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-danger"
      >
        <Icon name="sign-out" />
      </button>
    </header>
  );
}
