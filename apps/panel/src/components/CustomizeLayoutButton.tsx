'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

interface CustomizeLayoutButtonProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  statusBarVisible: boolean;
  onToggleStatusBar: () => void;
  /** Stavka i njeno dugme uopšte ne postoje u DOM-u bez ove dozvole (M15 spec §6.9.2) — nije
   * onemogućeno dugme, potpuno odsutno, isti princip kao svaki drugi gate u ovom projektu. */
  showTerminal: boolean;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  /** Gornja granica širine centralnog sadržaja (dizajn dok. §6b.1, 2.9.2026). Vrednosti i razlog
   * zašto baš one — `Shell.tsx`, uz `MAIN_WIDTH_OPTIONS`. */
  mainWidth: MainWidth;
  onChangeMainWidth: (value: MainWidth) => void;
}

// Naziv koji vidi korisnik nosi i broj — bez njega "Srednje" ne znači ništa dok se ne proba, a
// korisnik koji jednom nađe svoju širinu treba da je prepozna u listi bez pogađanja.
//
// Ovo je JEDINI spisak dozvoljenih vrednosti — `Shell.tsx` ga uvozi i za proveru vrednosti
// pročitane iz `UserPreference`, da se lista u meniju i lista prihvaćenih vrednosti ne mogu
// razići. Smer uvoza je namerno ovakav (Shell → TopBar → CustomizeLayoutButton); obrnuto bi
// napravilo kružnu zavisnost.
export const WIDTH_CHOICES = [
  { value: 'full', label: 'Puna širina' },
  { value: '1680', label: 'Široko · 1680px' },
  { value: '1440', label: 'Srednje · 1440px' },
  { value: '1280', label: 'Usko · 1280px' },
] as const;

export type MainWidth = (typeof WIDTH_CHOICES)[number]['value'];

// Dizajn dok. §5f — "Customize Layout" dugme kao u VS Code (21.8.2026 → 23.8.2026, na zahtev
// vlasnika). Uključuje/isključuje sve postojeće panele koji se mogu sakriti, a od 2.9.2026 nosi i
// izbor širine centralnog sadržaja (§6b.1).
//
// Dva različita mesta čuvanja, namerno, ne nedoslednost:
//   • vidljivost panela (gornje stavke) — `localStorage` (Shell.tsx), privremen obrazac iz
//     23.8.2026 kad `UserPreference` backend nije postojao u kodu;
//   • širina sadržaja — pravi `UserPreference` (M1 §3.9, ključ `main_content_max_width`), isto
//     kao `right_panel_display_mode`, dakle pamti se po NALOGU a ne po browseru.
// Vidljivost panela treba prebaciti na isti backend — zavedeno kao otvorena stavka, ne rešava se
// usput uz ovu izmenu da se ne meša sa njom.
export default function CustomizeLayoutButton(props: CustomizeLayoutButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const items = [
    { label: 'Bočna traka', checked: props.sidebarVisible, onToggle: props.onToggleSidebar },
    // "Desni panel" sad pokriva i AI chat (dizajn dok. §6c.0, 25.8.2026) — raniji zaseban "AI
    // chat" red je uklonjen, isti prekidač otvara/zatvara oboje (AI chat je trajan deo panela).
    { label: 'Desni panel', checked: props.rightPanelOpen, onToggle: props.onToggleRightPanel },
    { label: 'Statusna traka', checked: props.statusBarVisible, onToggle: props.onToggleStatusBar },
    ...(props.showTerminal ? [{ label: 'Terminal', checked: props.terminalOpen, onToggle: props.onToggleTerminal }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Customize Layout"
        // Kvadratni "tag" (5.9.2026, vlasnikov zahtev: "ikone u desnoj traci takodje stavite u
        // tagove, kao sto su u levoj") — isti jezik kao `ActivityBar.tsx` bedž (36px, `rounded-md`,
        // `bg-panel`/`bg-accent-soft`), otkad je ovo dugme preseljeno iz `TopBar.tsx` u `RightRail.tsx`.
        className={`flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md ${open ? 'bg-accent-soft text-accent-strong' : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'}`}
      >
        <Icon name="editor-layout" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onToggle}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              <span className="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center">
                {item.checked && <Icon name="check" />}
              </span>
              {item.label}
            </button>
          ))}
          {/* Širina centralnog sadržaja (2.9.2026, na zahtev vlasnika) — izbor JEDNE od četiri
              vrednosti, ne prekidač, pa ide u zasebnu grupu ispod postojećih uključi/isključi
              stavki. Razdvojeno linijom i naslovom da se ne pomeša sa njima: gornje stavke pale i
              gase delove ekrana, ovde se bira jedna vrednost i uvek je tačno jedna označena. */}
          <div className="my-1 border-t border-border" />
          <div className="px-3 pb-0.5 pt-1 text-[10px] uppercase tracking-wider text-ink-faint">
            Širina sadržaja
          </div>
          {WIDTH_CHOICES.map((choice) => (
            <button
              key={choice.value}
              onClick={() => props.onChangeMainWidth(choice.value)}
              aria-pressed={props.mainWidth === choice.value}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              <span className="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center">
                {props.mainWidth === choice.value && <Icon name="check" />}
              </span>
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
