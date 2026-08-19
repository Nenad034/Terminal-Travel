'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'tt-panel-sidebar-width';

/**
 * docs/analize/29-DIZAJN-SISTEM-UI.md §5b — granica između zona je ručno prevlačiva (VS
 * Code obrazac), razuman minimum po zoni, dvoklik vraća podrazumevanu širinu, širina se
 * pamti po korisniku preko sesija. Pravi `UserPreference` (M1 spec §3.9) ne postoji još u
 * kodu — ovaj prolaz koristi isti ad-hoc localStorage obrazac kao tema (ThemeToggle.tsx),
 * ne novi backend poziv (vidi plan, "Van obima").
 */
export default function ResizablePane({
  defaultWidth,
  minWidth,
  maxWidth,
  children,
}: {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) setWidth(clamp(parsed, minWidth, maxWidth));
      }
    } catch {
      // ignoriši oštećen zapis
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const next = clamp(startWidth.current + (e.clientX - startX.current), minWidth, maxWidth);
      setWidth(next);
    },
    [minWidth, maxWidth],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setWidth((w) => {
      try {
        localStorage.setItem(STORAGE_KEY, String(w));
      } catch {
        // localStorage nedostupan (npr. privatan mod) — širina i dalje radi za ovu sesiju
      }
      return w;
    });
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

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
      localStorage.setItem(STORAGE_KEY, String(defaultWidth));
    } catch {
      // localStorage nedostupan — nema šta da se sačuva, ali reset i dalje radi za ovu sesiju
    }
  };

  return (
    <div className="flex flex-shrink-0" style={{ width }}>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={resetWidth}
        title="Prevuci za promenu širine, dvoklik za podrazumevanu"
        className={`w-1 flex-shrink-0 cursor-col-resize border-r border-border hover:border-accent ${dragging ? 'border-accent' : ''}`}
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
