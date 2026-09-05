'use client';

import Icon from './Icon';

// Izdvojeno iz SearchSidebarPanel.tsx (5.9.2026, vlasnikov zahtev: "previše praznog prostora u
// vrhu levog panela... kao što su filteri kao accordion tako stavite i ove dve stavke ispod") —
// isti sklopivi obrazac ("Filteri") sad deljen i sa SavedViewsSidebarPanel.tsx/
// SavedGroupSearchesSidebarPanel.tsx/KatalogSidebarPanel.tsx, da sekcije bez sadržaja (prazno
// "Sačuvani prikazi 0/10") ne zauzimaju prostor dok se ne otvore.
//
// Izgled kartice (dopuna, isti dan, vlasnikov zahtev — snimak ekrana `HomeSidebarPanel.tsx`
// "Brzi linkovi"): ikonica u malom, blago zaobljenom bedžu (`rounded-md`, isti jezik kao
// `QuickLinkCard`/`SummaryCard` tamo), podebljan naslov, obrubljena kartica umesto ravnog reda
// sa gornjom linijom — dosledan vizuelni jezik sa ostatkom levog panela, ne nov obrazac.
export default function SidebarSection({
  title,
  icon,
  open,
  onToggle,
  contentClassName = '',
  children,
}: {
  title: string;
  /** Opciono — bez njega red ostaje bez bedža (npr. ugnježđene pod-grupe unutar "Filteri"). */
  icon?: string;
  open: boolean;
  onToggle: () => void;
  /** Dodatne klase na omotaču otvorenog sadržaja — npr. `SearchSidebarPanel.tsx` ovde nosi
   * sopstveni `flex flex-col gap-3` za razmak između grupa filtera. */
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel p-2 text-left hover:border-accent"
      >
        {icon && (
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
            <Icon name={icon} />
          </span>
        )}
        <span className="flex-1 truncate text-xs font-medium text-ink">{title}</span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="flex-shrink-0 text-ink-faint" />
      </button>
      {open && <div className={`mt-1.5 ${contentClassName}`}>{children}</div>}
    </div>
  );
}
