'use client';

import { useState } from 'react';
import TabBar from './TabBar';
import { BrandLogoFull, BrandLogoShort } from './BrandMark';

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
}: {
  leftColumnWidth: number;
  /** Razmak od leve ivice centralne kolone do leve ivice suženog sadržaja (Shell.tsx,
   * 2.9.2026) — 0 kad je izabrana puna širina, pa je ponašanje tada nepromenjeno. */
  tabOffset: number;
}) {
  const spacerWidth = Math.max(0, leftColumnWidth - HEADER_PADDING_GAP);
  const showLabel = spacerWidth >= 100;
  // Logo zumiranje na klik (24.8.2026, na zahtev vlasnika: "Omogucite da se logo na jedan klik
  // uveca duplo, a na drugi klik da se vrati nazad") — prost toggle, isti troetapno-nazad obrazac
  // kao zvonce/urgentOnly (M5). `overflow-hidden` uklonjen sa roditelja (label i dalje sam sebi
  // ograničava tekst preko `truncate`, ne treba mu roditeljski overflow) da uvećan logo stvarno
  // vizuelno "izađe" preko trake tabova, ne da bude isečen na granici spacer-a.
  const [logoZoomed, setLogoZoomed] = useState(false);

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
          {/* Nov logotip (5.9.2026, vlasnikova ideja) — zamenjuje raniji `terminal-travel-icon-v2.svg`
              (mask-image ikonica) + odvojen "terminal travel" natpis. Vidi `BrandMark.tsx` za pun
              razlog dizajna (dva "T" oblika sa stvarnim praznim razmakom u sredini, umesto
              velikog slova T na početku "Terminal"/"Travel"). Skraćena verzija (samo dva T
              simbola, bez reči) se prikazuje kad je bočna traka skupljena/uska — isti razlog kao
              ranije, samo skraćen natpis: "previše se smanjuje logo" u uskom prostoru. */}
          {showLabel ? <BrandLogoFull heightPx={23} /> : <BrandLogoShort heightPx={18.4} />}
        </button>
      </div>
      {/* Traka tabova prati levu ivicu sadržaja kad je on sužen (2.9.2026, na zahtev vlasnika:
          "pozicija tabova treba da prati veličinu prikaza, logika kao i u prikazu 100%").
          `paddingLeft` umesto pomeranja celog kontejnera — tabovi se pomeraju udesno, a prostor
          koji ostaje levo i dalje pripada istom flex-detetu, pa se ništa iza njega ne pomera. */}
      <div className="flex h-full min-w-0 flex-1" style={tabOffset > 0 ? { paddingLeft: tabOffset } : undefined}>
        <TabBar />
      </div>
      {/* Gornja traka posle ovoga NE nosi više nijednu ikonicu (5.9.2026, vlasnikov zahtev: "na
          gornjoj traci treba da se prikazuju samo tabovi i ikona za brisanje svih tagova") —
          "traži ili izvrši" je već u donjoj traci (StatusBar.tsx), "zatvori sve tabove" je već
          deo `TabBar`-a (`ml-auto` unutar trake tabova). Tema/zvono/Agent Inbox/Customize
          Layout/desni panel/odjava sele se u `RightRail.tsx`, novu vertikalnu traku uz desnu
          ivicu ekrana — ogledalo `ActivityBar.tsx` na suprotnoj strani (vidi Shell.tsx). */}
    </header>
  );
}
