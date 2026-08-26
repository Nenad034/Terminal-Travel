'use client';

import Link from 'next/link';
import Icon from './Icon';
import { NAV_ITEMS, type NavGroup } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §5c — grupne ikonice premeštene iz gornje (horizontalne)
// trake u levu vertikalnu traku (21.8.2026, na zahtev vlasnika: "premestite ikone u vertikalnu
// levu traku") — pravi VS Code Activity Bar obrazac (uska vertikalna traka uz levu ivicu,
// odvojena od Sidebar sadržaja, ne deo gornje trake). Ista logika/podaci kao pre (TopBar.tsx je
// nosio ovo do v1.60), samo preseljena i vertikalno složena. Administracija ostaje poslednja
// (sad `mt-auto` — vertikalni ekvivalent ranijeg `ml-auto`).
export default function ActivityBar({
  groups,
  activeGroupId,
  onSelectGroup,
  collapsed,
  onToggleCollapse,
}: {
  groups: NavGroup[];
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
      {groups.map((group, idx) => {
        const single = group.itemIds.length === 1 ? NAV_ITEMS.find((i) => i.id === group.itemIds[0]) : null;
        const active = group.id === activeGroupId;
        const isLast = idx === groups.length - 1 && groups.length > 1;
        const className = `flex h-[43px] w-[43px] flex-shrink-0 items-center justify-center rounded ${isLast ? 'mt-auto' : ''} ${
          active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
        }`;
        const title = active ? `${group.label} — klik za ${collapsed ? 'proširivanje' : 'skupljanje'} leve trake` : group.label;
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
            <Link
              key={group.id}
              href={single.href}
              title={isHome ? group.label : title}
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
          );
        }
        return (
          <button
            key={group.id}
            title={title}
            onClick={() => (active ? onToggleCollapse() : onSelectGroup(group.id))}
            className={className}
          >
            <Icon name={group.icon} />
          </button>
        );
      })}
    </nav>
  );
}
