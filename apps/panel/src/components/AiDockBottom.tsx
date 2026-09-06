'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';

// AI asistent u DNU CENTRALNOG PANELA — druga moguća pozicija istog polja (M5 spec §3.0c.4,
// dizajn dok. §6c.0), na vlasnikov zahtev (3.9.2026): „omogućite da se polje klikom na strelicu
// koja pokazuje prema centralnom panelu pojavi u dnu centralnog panela, kao ovde u VS Code".
//
// Isti obrazac kao Terminal panel (§5f): stoji ispod sadržaja, iznad statusne trake, i zauzima
// SAMO širinu centralne kolone — ne ide ispod bočne trake ni desnog panela, tačno kao pravi
// VS Code Panel.
//
// Ovo NIJE drugo AI polje. Postoji tačno jedan `AiChatBox` u celoj aplikaciji; ovde se samo
// prikazuje na drugom mestu (Shell.tsx ga prebacuje portalom), pa se istorija razgovora ne gubi
// pri premeštanju. Dva odvojena polja bi bila upravo greška zbog koje ovaj repozitorijum i ima
// pravila — isti posao na dva mesta koja se prvom izmenom raziđu.

const HEIGHT_KEY = 'tt-panel-ai-dock-height';
const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 120;
const COLLAPSED_HEIGHT = 36;

export default function AiDockBottom({
  slotRef,
  onMoveToRight,
}: {
  /** Mesto u koje Shell.tsx portalom ubacuje jedini `AiChatBox`. */
  slotRef: (el: HTMLDivElement | null) => void;
  onMoveToRight: () => void;
}) {
  const { openTab } = useTabs();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(DEFAULT_HEIGHT);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(HEIGHT_KEY));
    if (saved >= MIN_HEIGHT) setHeight(saved);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    // Vučenje NAGORE povećava visinu — panel raste ka sadržaju, isto kao Terminal.
    const next = Math.max(MIN_HEIGHT, startHeight.current + (startY.current - e.clientY));
    setHeight(next);
  }, []);

  // Osluškivači prevlačenja se skidaju preko `AbortController`, ne preko `removeEventListener`
  // (6.9.2026, ESLint nalaz `react-hooks/immutability`, dok. 41 B1). Raniji oblik je unutar
  // `onPointerUp` pozivao `removeEventListener('pointerup', onPointerUp)` — funkcija je
  // pokazivala na SAMU SEBE, pa je hvatala svoju staru verziju: čim bi joj se zavisnost
  // promenila, skidala bi pogrešnu referencu i osluškivač bi ostao zakačen za `window`. Tiho
  // curenje, ne pad — vidi se tek kad se panel otvara i zatvara mnogo puta. `abort()` skida
  // OBA osluškivača odjednom i ne traži nikakvu referencu na samu funkciju.
  const dragAbort = useRef<AbortController | null>(null);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragAbort.current?.abort();
    dragAbort.current = null;
    setHeight((h) => {
      window.localStorage.setItem(HEIGHT_KEY, String(h));
      return h;
    });
  }, []);

  // Ako se komponenta ukloni usred prevlačenja, osluškivači bi inače ostali na `window`.
  useEffect(() => () => dragAbort.current?.abort(), []);

  function onPointerDown(e: React.PointerEvent) {
    if (collapsed) return;
    setDragging(true);
    startY.current = e.clientY;
    startHeight.current = height;
    const ctrl = new AbortController();
    dragAbort.current = ctrl;
    window.addEventListener('pointermove', onPointerMove, { signal: ctrl.signal });
    window.addEventListener('pointerup', onPointerUp, { signal: ctrl.signal });
  }

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-hidden bg-panel"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
    >
      <div
        onPointerDown={onPointerDown}
        title={collapsed ? undefined : 'Prevuci za promenu visine'}
        className={`h-1.5 flex-shrink-0 border-t ${collapsed ? 'border-border' : `cursor-row-resize hover:border-accent ${dragging ? 'border-accent' : 'border-border'}`}`}
      />
      <div className="flex h-9 flex-shrink-0 items-center justify-between px-2 text-xs font-medium text-ink-faint">
        <span className="flex items-center gap-1.5">
          <Icon name="sparkle" className="text-accent" /> AI asistent
        </span>
        <div className="flex items-center gap-1">
          {/* Strelica NAZAD ka desnom panelu — ista logika kao strelica koja ga je dovela ovde. */}
          <button
            onClick={onMoveToRight}
            title="Vrati AI asistenta u desni panel"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name="arrow-right" />
          </button>
          <button
            onClick={() => openTab('/ai-asistent', 'AI asistent')}
            title="Otvori u punom tabu (Fokus režim)"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name="screen-full" />
          </button>
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Prikaži AI asistenta' : 'Sklopi AI asistenta'}
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} />
          </button>
        </div>
      </div>
      {/* Slot ostaje u DOM-u i kad je sklopljen (visina 0) — `AiChatBox` se ne sme ukloniti,
          inače nestaje istorija razgovora, isti razlog kao u desnom panelu. */}
      <div ref={slotRef} className={collapsed ? 'h-0 overflow-hidden' : 'min-h-0 flex-1 overflow-hidden'} />
    </div>
  );
}
