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
}

// Dizajn dok. §5f — "Customize Layout" dugme kao u VS Code (21.8.2026 → 23.8.2026, na zahtev
// vlasnika). Uključuje/isključuje sve postojeće panele koji se mogu sakriti; stanje po korisniku
// pamti se u localStorage (Shell.tsx) — pravi `UserPreference` backend (M1 §3.9) još ne postoji
// u kodu, isti privremeni obrazac kao širina bočne trake/kolaps stanje.
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
        className={`flex h-[43px] w-[43px] items-center justify-center rounded ${open ? 'bg-panel text-accent' : 'text-ink-faint hover:bg-panel hover:text-ink'}`}
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
        </div>
      )}
    </div>
  );
}
