'use client';

import Icon from './Icon';

// Izdvojeno iz SearchSidebarPanel.tsx (5.9.2026, vlasnikov zahtev: "previše praznog prostora u
// vrhu levog panela... kao što su filteri kao accordion tako stavite i ove dve stavke ispod") —
// isti sklopivi obrazac ("Filteri") sad deljen i sa SavedViewsSidebarPanel.tsx/
// SavedGroupSearchesSidebarPanel.tsx, da sekcije bez sadržaja (prazno "Sačuvani prikazi 0/10")
// ne zauzimaju prostor dok se ne otvore.
export default function SidebarSection({
  title,
  open,
  onToggle,
  contentClassName = '',
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Dodatne klase na omotaču otvorenog sadržaja — npr. `SearchSidebarPanel.tsx` ovde nosi
   * sopstveni `flex flex-col gap-3` za razmak između grupa filtera. */
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1.5 py-1 text-left font-medium text-ink">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="text-ink-faint" />
        {title}
      </button>
      {open && <div className={`pl-1 pt-1 ${contentClassName}`}>{children}</div>}
    </div>
  );
}
