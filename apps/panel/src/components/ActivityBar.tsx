'use client';

import Link from 'next/link';
import Icon from './Icon';
import { NAV_ITEMS, type NavGroup, type NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — grupne ikonice premeštene iz gornje (horizontalne)
// trake u levu vertikalnu traku (21.8.2026, na zahtev vlasnika: "premestite ikone u vertikalnu
// levu traku") — pravi VS Code Activity Bar obrazac (uska vertikalna traka uz levu ivicu,
// odvojena od Sidebar sadržaja, ne deo gornje trake). Ista logika/podaci kao pre (TopBar.tsx je
// nosio ovo do v1.60), samo preseljena i vertikalno složena. Administracija ostaje poslednja
// (sad `mt-auto` — vertikalni ekvivalent ranijeg `ml-auto`).
// Plutajući podmeni uz ikonicu (2.9.2026, na zahtev vlasnika: "kada je levi panel zatvoren i u
// bočnoj levoj traci se pojave samo ikone, kada prelazimo mišem preko ikona, pojaviti i
// plutajuće podmenije", dizajn dok. §5c.1). Dok je leva traka skupljena, ikonica je jedino što
// od navigacije ostaje na ekranu — bez ovoga korisnik mora da proširi traku samo da bi video
// šta se u grupi nalazi, pa skupljena traka gubi smisao (dobija prostor, gubi upotrebljivost).
//
// Čist CSS (`group-hover`/`group-focus-within`), bez stanja u JS-u — meni koji se otvara na
// prelazak mišem ne treba da čeka React render, a ovako radi i na tastaturu (Tab do ikonice
// otvara isti meni) bez ijednog dodatnog reda. `left-full` bez razmaka do same ikonice: gap se
// pravi unutrašnjim `pl-1.5` da putanja miša od ikonice do menija ostane neprekidno u hover
// zoni — vidljiv razmak, a meni ne nestaje na pola puta.
function GroupFlyout({ group, groupItems }: { group: NavGroup; groupItems: NavItem[] }) {
  return (
    <div className="pointer-events-none absolute left-full top-0 z-50 hidden pl-1.5 group-hover:block group-focus-within:block">
      <div className="pointer-events-auto min-w-[190px] rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
        {/* Zaglavlje sa nazivom grupe ima smisla samo kad ispod njega stoji više stavki. Grupa
            sa jednom stavkom bi inače dobila naziv pa isti taj naziv ponovo kao jedini red —
            tada meni ostaje jedan red i služi kao stilizovana zamena za sistemski `title`
            tooltip (koji se zato dok je traka skupljena i ne postavlja, da se ne pojave dva). */}
        {groupItems.length > 1 && (
          <div className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-ink-faint">{group.label}</div>
        )}
        {groupItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2 px-3 py-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ActivityBar({
  groups,
  items,
  activeGroupId,
  onSelectGroup,
  collapsed,
  onToggleCollapse,
}: {
  groups: NavGroup[];
  /** Stavke koje OVAJ korisnik sme da vidi (M17 spec §3) — plutajući podmeni nikad ne sme da
   * izlista stavku koju bi `Sidebar` sakrio; zato se lista gradi odavde, ne iz `NAV_ITEMS`. */
  items: NavItem[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
  // Dopuna (23.8.2026, na zahtev vlasnika — kolabovana leva traka sad ide na 0px, poglavlje
  // Shell.tsx, pa gubi sopstvenu strelicu za ponovno širenje) — isti VS Code obrazac kao ovde:
  // klik na VEĆ AKTIVNU grupu prebacuje skupi/proširi umesto da ništa ne uradi.
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <nav className="flex w-[43px] flex-shrink-0 flex-col items-center gap-1 bg-panel-2 py-1">
      {/* Strelica za PONOVNO širenje (4.9.2026, vlasnikov nalaz: "kada skupimo levi panel
          strelicom u levo, nemamo za širenje strelicu u desno"). `Sidebar` nosi `chevron-left`
          za skupljanje pri svom vrhu, ali se pri skupljanju ceo odmontira (`if (collapsed)
          return null`) i odnese strelicu sa sobom — povratak je do sad postojao samo kao
          SPOREDAN efekat klika na ikonicu grupe, što nigde ne piše i ne liči na dugme. Ovo je
          sam par te strelice: ista visina reda, ista strana ekrana, suprotan smer. Prikazuje se
          isključivo dok je skupljeno — u proširenom stanju bi bio drugi taster za isti posao. */}
      {collapsed && (
        <button
          type="button"
          title="Proširi levu traku"
          aria-label="Proširi levu traku"
          onClick={onToggleCollapse}
          className="mb-1 flex h-[29px] w-[29px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <Icon name="chevron-right" />
        </button>
      )}
      {groups.map((group, idx) => {
        const single = group.itemIds.length === 1 ? NAV_ITEMS.find((i) => i.id === group.itemIds[0]) : null;
        const active = group.id === activeGroupId;
        const isLast = idx === groups.length - 1 && groups.length > 1;
        // Redosled iz `group.itemIds` je namerno merodavan (isti redosled koji `Sidebar`
        // prikazuje kad je traka proširena) — filtriranje `items` niza bi dalo redosled tog
        // niza, pa bi ista grupa izgledala drugačije skupljena nego proširena.
        const groupItems = group.itemIds
          .map((id) => items.find((i) => i.id === id))
          .filter((i): i is NavItem => i !== undefined);
        // Podmeni postoji SAMO dok je traka skupljena — kad je proširena, `Sidebar` već
        // prikazuje isti spisak, pa bi meni preko njega bio suvišan i smetao bi.
        const flyout = collapsed && groupItems.length > 0;
        // Podmeni je SUSED ikonice unutar zajedničkog omotača, ne njeno dete: podmeni sadrži
        // `<Link>` (dakle `<a>`), a `<a>` unutar `<button>` je nevalidan HTML — browser ume da
        // takav anchor "proguta" ili da klik na njega proglasi klikom na dugme, pa bi stavke
        // menija nepredvidivo prestale da navigiraju. `group`/`relative` i `mt-auto` zato stoje
        // na omotaču; sama ikonica zadržava samo svoj izgled.
        const className = `flex h-[43px] w-[43px] flex-shrink-0 items-center justify-center rounded ${
          active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`;
        const wrapperClassName = `group relative flex-shrink-0 ${isLast ? 'mt-auto' : ''}`;
        // Dok podmeni radi, izostavlja se `title` — inače bi se preko stilizovanog menija
        // pojavio i sistemski tooltip sa istim tekstom (dva različita prikaza iste stvari).
        const title = flyout
          ? undefined
          : active
            ? `${group.label} — klik za ${collapsed ? 'proširivanje' : 'skupljanje'} leve trake`
            : group.label;
        if (single) {
          // ISPRAVKA (26.8.2026, na zahtev vlasnika — "kad se klikne na dugme Home ništa se ne
          // dešava... nije mi ni logično klikanje") — Home je jedina single-item grupa čiji je
          // POSAO da uvek stvarno vodi na Početnu, ne da nudi skupi/proširi prečicu kao ostale
          // (Audit log, API konekcije, MCP) kad se ponovo klikne dok je već aktivna. Sa
          // stvarnim uzrokom "ništa se ne dešava" ispravljenim u Shell.tsx (activeGroupId sad
          // prati stvarnu putanju), ovaj izuzetak sprečava da PREOSTALI, ređi slučaj (korisnik
          // je STVARNO na Početnoj i opet klikne Home) i dalje samo skuplja traku umesto da
          // ponovo, pouzdano fokusira Početnu.
          const isHome = group.id === 'pocetna';
          return (
            <div key={group.id} className={wrapperClassName}>
              <Link
                href={single.href}
                title={flyout ? undefined : isHome ? group.label : title}
                className={className}
                onClick={(e) => {
                // ISPRAVKA (26.8.2026, na zahtev vlasnika — "kada zatvorimo levi panel i
                // kliknemo na ikonu Home, opet se otvori. sada to nije tako") — Home je i dalje
                // izuzet iz "klik na već-aktivnu grupu skuplja/širi" prečice iznad (namerno, isti
                // razlog), ALI dok je traka skupljena, Home mora i dalje da je ponovo otvori —
                // dosadašnji potpun izuzetak (`return` bez ičega) nikad nije dirao `collapsed`
                // stanje, pa je klik na Home dok je traka skupljena samo navigirao bez ikakvog
                // vidljivog efekta na traku. Ne zove se `e.preventDefault()` ovde — navigacija
                // ka Početnoj i dalje radi normalno, ovo samo DODATNO širi traku ako je skupljena.
                  if (isHome) {
                    if (collapsed) onToggleCollapse();
                    return;
                  }
                  if (!active) return;
                  e.preventDefault();
                  onToggleCollapse();
                }}
              >
                <Icon name={group.icon} />
              </Link>
              {flyout && <GroupFlyout group={group} groupItems={groupItems} />}
            </div>
          );
        }
        return (
          <div key={group.id} className={wrapperClassName}>
            <button
              title={title}
              onClick={() => (active ? onToggleCollapse() : onSelectGroup(group.id))}
              className={className}
            >
              <Icon name={group.icon} />
            </button>
            {flyout && <GroupFlyout group={group} groupItems={groupItems} />}
          </div>
        );
      })}
    </nav>
  );
}
