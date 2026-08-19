'use client';

import { useTabs } from './TabsContext';

/**
 * docs/analize/29-DIZAJN-SISTEM-UI.md §5a — drill-down u zapis (npr. red liste → detalj)
 * ostaje u ISTOM tabu, ne otvara nov. Zamena za `next/link` na tačno tim mestima — sekcija
 * u levoj traci i rezultat komandne palete i dalje idu preko `openTab` (namerna radnja).
 *
 * Namerno običan <a> + onClick (ne next/link `onNavigate`) da `navigateInTab` ima punu
 * kontrolu nad tabovima pre nego što ruter krene — next/link prefetch i dalje radi jer je
 * href postavljen kao pravi atribut.
 */
export default function TabLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { navigateInTab } = useTabs();

  return (
    <a
      href={href}
      className={className}
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
