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

  // Osluškivači prevlačenja se skidaju preko `AbortController`, ne preko `removeEventListener`
  // (6.9.2026, ESLint nalaz `react-hooks/immutability`, dok. 41 B1). Raniji oblik je unutar
  // `onPointerUp` pozivao `removeEventListener('pointerup', onPointerUp)` — funkcija je
  // pokazivala na SAMU SEBE i hvatala svoju staru verziju: čim bi joj se zavisnost promenila,
  // skidala bi pogrešnu referencu i osluškivač bi ostao zakačen za `window`.
  const dragAbort = useRef<AbortController | null>(null);

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
    dragAbort.current?.abort();
    dragAbort.current = null;
  }, [storageKey]);

  // Ako se komponenta ukloni usred prevlačenja, osluškivači bi inače ostali na `window`.
  useEffect(() => () => dragAbort.current?.abort(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = width;
    // Prekini prethodno prevlačenje ako je ostalo otvoreno. OVO JE OBAVEZNO, ne opreznost
    // (regresija 6.9.2026, prijavio vlasnik: „nekontrolisano širenje i skupljanje levog panela").
    // `addEventListener` sa ISTOM funkcijom i istim tipom drugi put je duplikat i po specifikaciji
    // se ZANEMARUJE — zajedno sa svojim `signal`-om. Osluškivač zato ostaje vezan za PRVI
    // `AbortController`; ako je taj u međuvremenu prepisan u `dragAbort.current`, `abort()` na
    // novom ne skida ništa i osluškivač ostaje zauvek na `window`. Dovoljan je jedan dvoklik ili
    // drhtaj ruke (dva `pointerdown` bez `pointerup` između) da panel počne da se menja na svaki
    // pokret miša. Raniji oblik sa `removeEventListener` na to nije bio osetljiv, jer uklanjanje
    // po referenci skida jedinu registraciju bez obzira koliko je puta dodata.
    dragAbort.current?.abort();

    const ctrl = new AbortController();
    dragAbort.current = ctrl;
    window.addEventListener('pointermove', onPointerMove, { signal: ctrl.signal });
    window.addEventListener('pointerup', onPointerUp, { signal: ctrl.signal });
    // `pointercancel` — pregledač sam prekida pokazivač (prelazak na dodir, gubitak prozora,
    // sistemski meni). Bez ovoga `pointerup` nikad ne stigne i prevlačenje ostaje „upaljeno".
    window.addEventListener('pointercancel', onPointerUp, { signal: ctrl.signal });
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
      className={`w-1.5 flex-shrink-0 cursor-col-resize border-transparent bg-panel-2 hover:border-accent ${
        handleSide === 'left' ? 'border-l' : 'border-r'
      } ${dragging ? 'border-accent' : ''}`}
    />
  );

  return (
    <div className="flex h-full flex-shrink-0" style={{ width: collapsed ? collapsedWidth : width }}>
      {!collapsed && handleSide === 'left' && handle}
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      {!collapsed && handleSide === 'right' && handle}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
