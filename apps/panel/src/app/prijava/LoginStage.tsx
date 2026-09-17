'use client';

import { useEffect, useRef, useState } from 'react';
import { BrandLogoFull } from '@/components/BrandMark';
import { paintFallbackScene } from './login-scene';

// Dizajn dok. 29 §6i / M17 §3.0 (17.9.2026, vlasnikova odluka) — „naslovna strana radnog dana".
// Tri celine: gornja traka (logo · datum · sat), sredina (naslov + kartica + „Iz kataloga",
// vertikalno centrirana, isti razmak), podnožje. Pozadina: do tri fotografije iz kataloga koje
// se smenjuju na 8 s; bez ijedne slike — generativni pejzaž (canvas) i BEZ bloka „Iz kataloga"
// (bolje bez bloka nego blok sa izmišljenim mestom).

export interface LoginSlide {
  imageUrl: string;
  place: string; // grad/destinacija
  country: string | null;
  productName: string;
  geo: string | null; // „40.0192° N · 23.4109° E"
  note: string | null; // kratak opis proizvoda (shortDescription) — citat iz M23 čeka javan API
}

const SLIDE_MS = 8000;
const DANI = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
const MESECI = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

function Clock() {
  // Klijentski sat — lokalno vreme pregledača; grad fiksno BEG (sedište), §3.0.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const date = now ? `${DANI[now.getDay()]} · ${now.getDate()}. ${MESECI[now.getMonth()]}` : '';
  const time = now ? now.toLocaleTimeString('sr-RS', { hour12: false }) : '--:--:--';
  return (
    <>
      <div className="date" suppressHydrationWarning>
        {date}
      </div>
      <div className="clock">
        <small>Lokalno vreme</small>
        <b>
          <span suppressHydrationWarning>{time}</span>
          <i>BEG</i>
        </b>
      </div>
    </>
  );
}

export default function LoginStage({
  slides,
  version,
  children,
}: {
  slides: LoginSlide[];
  version: string;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasSlides = slides.length > 0;

  // Smena slika — samo kad ih ima više od jedne.
  useEffect(() => {
    if (slides.length < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setInterval(() => {
      if (reduce) {
        setCurrent((c) => (c + 1) % slides.length);
        return;
      }
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setFading(false);
      }, 600);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Rezervna pozadina kad katalog nema nijednu sliku.
  useEffect(() => {
    if (hasSlides) return;
    const c = canvasRef.current;
    if (!c) return;
    const paint = () => paintFallbackScene(c);
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [hasSlides]);

  const slide = hasSlides ? slides[current] : null;

  return (
    <div className="lp">
      {hasSlides ? (
        slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.imageUrl}
            src={s.imageUrl}
            alt=""
            aria-hidden
            className={`photo${i === current ? ' on' : ''}`}
          />
        ))
      ) : (
        <canvas ref={canvasRef} className="scene on" aria-hidden />
      )}
      <div className="grid" aria-hidden />
      <div className="veil" aria-hidden />

      <div className="layout">
        <div className="top">
          <BrandLogoFull heightPx={26} />
          <Clock />
        </div>

        <div className="middle">
          {children}

          {slide && (
            <div className={`right${fading ? ' fading' : ''}`}>
              <div className="eyebrow">Iz kataloga · {slide.country ?? slide.place}</div>
              <h2 className="place">{slide.place}</h2>
              <div className="meta">
                <b>{slide.productName}</b>
                {slide.country && <span>{slide.country}</span>}
                {slide.geo && <code>{slide.geo}</code>}
              </div>
              {slide.note && <blockquote>{slide.note}</blockquote>}
              {slides.length > 1 && (
                <div className="dots">
                  {slides.map((s, i) => (
                    <i key={s.imageUrl} className={i === current ? 'on' : ''} />
                  ))}
                  <span>
                    {String(current + 1).padStart(2, '0')} /{' '}
                    {String(slides.length).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="foot">
          <span>Terminal · interni panel · v{version}</span>
          <em>Radna sveska agencije</em>
          <span>Beograd, Srbija</span>
        </div>
      </div>
    </div>
  );
}
