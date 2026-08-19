'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * docs/analize/29-DIZAJN-SISTEM-UI.md §5b — granica između zona je ručno prevlačiva (VS
 * Code obrazac), razuman minimum po zoni, dvoklik vraća podrazumevanu širinu, širina se
 * pamti po korisniku preko sesija. Pravi `UserPreference` (M1 spec §3.9) ne postoji još u
 * kodu — ovaj prolaz koristi isti ad-hoc localStorage obrazac kao tema (ThemeToggle.tsx),
 * ne novi backend poziv (vidi plan, "Van obima"). `storageKey` odvaja pamćenje širine po
 * zoni (leva bočna traka vs desni panel — nezavisne širine); `handleSide` bira na kojoj
 * ivici je prevlačiva granica ("right" za levu traku, "left" za desni panel).
 */
export default function ResizablePane({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  handleSide = 'right',
  collapsed = false,
  collapsedWidth = 24,
  children,
}: {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  handleSide?: 'left' | 'right';
  /** VS Code obrazac — kolabovano na tanku traku umesto potpunog nestajanja (na zahtev
   * vlasnika, 19.8.2026). Prevlačenje se isključuje u ovom stanju, prethodna širina se pamti. */
  collapsed?: boolean;
  collapsedWidth?: number;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) setWidth(clamp(parsed, minWidth, maxWidth));
      }
    } catch {
      // ignoriši oštećen zapis
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const sign = handleSide === 'left' ? -1 : 1;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const next = clamp(startWidth.current + sign * (e.clientX - startX.current), minWidth, maxWidth);
      setWidth(next);
    },
    [minWidth, maxWidth, sign],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setWidth((w) => {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        // localStorage nedostupan (npr. privatan mod) — širina i dalje radi za ovu sesiju
      }
      return w;
    });
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove, storageKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = width;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const resetWidth = () => {
    setWidth(defaultWidth);
    try {
      localStorage.setItem(storageKey, String(defaultWidth));
    } catch {
      // localStorage nedostupan — nema šta da se sačuva, ali reset i dalje radi za ovu sesiju
    }
  };

  const handle = (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={resetWidth}
      title="Prevuci za promenu širine, dvoklik za podrazumevanu"
      className={`w-1 flex-shrink-0 cursor-col-resize hover:border-accent ${
        handleSide === 'left' ? 'border-l' : 'border-r'
      } border-border ${dragging ? 'border-accent' : ''}`}
    />
  );

  return (
    <div className="flex flex-shrink-0" style={{ width: collapsed ? collapsedWidth : width }}>
      {!collapsed && handleSide === 'left' && handle}
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      {!collapsed && handleSide === 'right' && handle}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
