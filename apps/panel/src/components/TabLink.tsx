'use client';

import { useTabs } from './TabsContext';
import { PANEL_ITEM_DRAG_MIME, type PanelCollectionItem } from './PanelCollectionContext';

/**
 * docs/analize/29-DIZAJN-SISTEM-UI.md §5a — drill-down u zapis (npr. red liste → detalj)
 * ostaje u ISTOM tabu, ne otvara nov. Zamena za `next/link` na tačno tim mestima — sekcija
 * u levoj traci i rezultat komandne palete i dalje idu preko `openTab` (namerna radnja).
 *
 * Namerno običan <a> + onClick (ne next/link `onNavigate`) da `navigateInTab` ima punu
 * kontrolu nad tabovima pre nego što ruter krene — next/link prefetch i dalje radi jer je
 * href postavljen kao pravi atribut.
 *
 * `dragPayload` (M17 spec v2.10, opciono) — kad je prisutan, kartica/red postaje prevlačiv u
 * desni panel (generička "polica podsetnika" van M5, `PanelCollectionContext.tsx`/`RightPanel.tsx`).
 * Nativan HTML5 drag (ne React state) — `onDragStart` samo upisuje JSON u `dataTransfer`, ne
 * menja ništa lokalno; odsustvo propa ostavlja karticu potpuno nepromenjenom (nema `draggable`
 * atributa), nula rizika za postojeća mesta koja `TabLink` već koriste.
 */
export default function TabLink({
  href,
  label,
  className,
  children,
  dragPayload,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
  dragPayload?: PanelCollectionItem;
}) {
  const { navigateInTab } = useTabs();

  return (
    <a
      href={href}
      className={className}
      draggable={dragPayload ? true : undefined}
      onDragStart={
        dragPayload
          ? (e) => {
              e.dataTransfer.setData(PANEL_ITEM_DRAG_MIME, JSON.stringify(dragPayload));
              e.dataTransfer.effectAllowed = 'copy';
            }
          : undefined
      }
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigateInTab(href, label);
      }}
    >
      {children}
    </a>
  );
}
