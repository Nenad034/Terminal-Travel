'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// maplibre-gl v6 nema default izvoz — samo imenovane (`Protocol` dolazi iz `pmtiles`).
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';

// M5 spec §3.0h — mapa rezultata pretrage.
//
// Podaci mape: OpenStreetMap preko Protomaps/PMTiles (Master dokument poglavlje 6). Cela mapa
// Balkana je JEDAN fajl (`/maps/balkan.pmtiles`, ~1.6 GB, zoom 0–13) iz kog browser čita samo
// bajtove koji mu trebaju, preko HTTP range zahteva — nema servera za mape koji se održava.
// Fajl NIJE u git-u (`.gitignore`); pravi se lokalno, uputstvo u §3.0h.4.
//
// Prikaz: MapLibre GL. Tačke idu kroz GeoJSON izvor sa uključenim grupisanjem — bez toga bi se
// proizvodi iz istog mesta crtali jedan preko drugog, što je danas pravilo a ne izuzetak:
// koordinate su uglavnom na nivou grada (§3.0h.2), pa deset hotela na Kopaoniku deli istu tačku.

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Najniža cena, u parama/centima. */
  price: number;
  currency: string;
  /** Sve ispod je opciono — pojavljuje se u baneru kad izvor to nosi (§3.0h.7). */
  stars?: number;
  city?: string;
  country?: string;
  image?: string;
  /** Čitljiv naziv usluge, npr. "HB - Polupansion". */
  boardLabel?: string;
}

/**
 * Panel ima TRI moda (svetli / dim / tamni, dizajn dok. §2.0f), pa i mapa dobija tri različita
 * izgleda — ne dva. Protomaps "flavor" se bira tako da razlika bude stvarno vidljiva:
 *   svetli → `light` (pozadina #cccccc)
 *   dim    → `dark`  (#34373d, plavkasto-siva — isti utisak kao dim mod panela)
 *   tamni  → `black` (#2b2b2b, najdublji)
 * U prvoj verziji su dim i tamni delili isti `dark` i izgledali identično.
 */
type FlavorName = 'light' | 'dark' | 'black';

function flavorNameForTheme(): FlavorName {
  if (typeof document === 'undefined') return 'light';
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'light') return 'light';
  if (theme === 'dim') return 'dark';
  if (theme === 'dark') return 'black';
  // Bez izričitog izbora odlučuje operativni sistem, isto kao CSS `prefers-color-scheme`.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'black' : 'light';
}

/** Boje natpisa nad mapom — indigo na svetloj podlozi, belo na tamnoj. */
function labelColors(flavor: FlavorName): { text: string; halo: string } {
  return flavor === 'light' ? { text: '#4f46e5', halo: '#ffffff' } : { text: '#ffffff', halo: '#1f2124' };
}

function buildStyle(flavor: FlavorName) {
  return {
    version: 8 as const,
    // NAPOMENA (§3.0h.5): slova i ikonice se za sada povlače sa Protomaps javnog skladišta.
    // To je jedini deo mape koji izlazi van naše infrastrukture — za produkciju se preseljava.
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavor}`,
    sources: {
      protomaps: {
        type: 'vector' as const,
        url: 'pmtiles:///maps/balkan.pmtiles',
        attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), { lang: 'sr' }),
  };
}

/** Naziv hotela dolazi iz podataka, ne iz koda — mora se štitovati pre ubacivanja u HTML. */
function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function money(cents: number, currency: string): string {
  const whole = Math.round(cents / 100);
  return `${whole.toLocaleString('sr-RS')} ${currency}`;
}

/**
 * Dodaje izvor i slojeve rezultata. Odvojeno od pravljenja mape jer `setStyle` (promena teme)
 * uklanja sve što nije deo stila — posle svake promene se mora pozvati ponovo.
 */
function addResultLayers(map: MapLibreMap, flavor: FlavorName) {
  if (map.getSource('rezultati')) return;
  const label = labelColors(flavor);

  map.addSource('rezultati', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 45,
    clusterMaxZoom: 13,
  });

  map.addLayer({
    id: 'grupe',
    type: 'circle',
    source: 'rezultati',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#4f46e5',
      'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 20, 28],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'grupe-broj',
    type: 'symbol',
    source: 'rezultati',
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12 },
    paint: { 'text-color': '#ffffff' },
  });

  map.addLayer({
    id: 'tacke',
    type: 'circle',
    source: 'rezultati',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#4f46e5',
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'tacke-cena',
    type: 'symbol',
    source: 'rezultati',
    filter: ['!', ['has', 'point_count']],
    layout: {
      // Naziv iznad cene (vlasnikov zahtev 2.9.2026) — na mapi punoj tačaka sama cena ne kaže
      // KOJI je to hotel, a agent bira po imenu koliko i po ceni.
      'text-field': [
        'format',
        ['get', 'naziv'],
        { 'font-scale': 0.85 },
        '\n',
        {},
        ['get', 'cena'],
        { 'font-scale': 1.05, 'text-font': ['literal', ['Noto Sans Medium']] },
      ],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, -1.9],
      'text-line-height': 1.15,
      'text-max-width': 12,
      // Natpisi se ne smeju preklapati — kad se preklope, MapLibre sakrije slabiji, pa ostane
      // tačka bez teksta; to je bolje od dva imena jedno preko drugog.
      'text-allow-overlap': false,
    },
    paint: { 'text-color': label.text, 'text-halo-color': label.halo, 'text-halo-width': 2 },
  });
}

/** Upisuje tačke u izvor i (opciono) namešta prikaz na njihov okvir. */
function applyPoints(map: MapLibreMap, points: MapPoint[], fit: boolean) {
  const source = map.getSource('rezultati') as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  source.setData({
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, naziv: p.name, cena: money(p.price, p.currency) },
    })),
  });

  // Posle promene teme se tačke ucrtavaju ponovo, ali se prikaz NE pomera — korisnik bi
  // izgubio zum i položaj koje je podesio, a nije tražio ništa osim druge boje.
  if (fit && points.length > 0) {
    const bounds = new maplibregl.LngLatBounds();
    for (const p of points) bounds.extend([p.lng, p.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
  }
}

/**
 * Baner koji se otvara klikom na tačku (vlasnikov zahtev 2.9.2026). Gradi se kao HTML jer ga
 * MapLibre `Popup` sam pozicionira i zatvara — React sloj bi za isto tražio ručno praćenje
 * pomeranja mape. Sav tekst iz podataka prolazi kroz `esc`.
 */
function bannerHtml(p: MapPoint, addLabel: string): string {
  const place = [p.city, p.country].filter(Boolean).join(', ');
  const stars = p.stars ? `<span class="tt-map-stars">${'★'.repeat(p.stars)}</span>` : '';
  const image = p.image ? `<div class="tt-map-img" style="background-image:url('${esc(p.image)}')"></div>` : '';
  return `
    <div class="tt-map-banner">
      ${image}
      <div class="tt-map-body">
        <div class="tt-map-title">${esc(p.name)} ${stars}</div>
        ${place ? `<div class="tt-map-sub">${esc(place)}</div>` : ''}
        ${p.boardLabel ? `<div class="tt-map-sub">${esc(p.boardLabel)}</div>` : ''}
        <div class="tt-map-price">${esc(money(p.price, p.currency))}</div>
        <button type="button" class="tt-map-add" data-id="${esc(p.id)}">${esc(addLabel)}</button>
      </div>
    </div>`;
}

export default function SearchResultsMap({ points, onSelect }: { points: MapPoint[]; onSelect?: (id: string) => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  // M5 spec §3.0h.8 — "pretraži dok pomeram mapu". Stanje prekidača i sam okvir žive u adresi,
  // pa se pretraga po okviru može podeliti linkom i preživi osvežavanje stranice.
  const followMap = sp.get('pratiMapu') === '1';
  const followRef = useRef(followMap);
  followRef.current = followMap;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Poslednje poznate tačke — mapa se učitava asinhrono, pa prvi skup mora da bude dostupan
  // i onda kad `load` stigne POSLE nego što je roditelj već poslao rezultate.
  const pointsRef = useRef<MapPoint[]>(points);
  pointsRef.current = points;
  // Isti razlog: slušalac klika se kači jednom, a `onSelect` se može promeniti.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // MapLibre inače sam računa adresu svog radnog procesa iz `import.meta.url` — pod
    // Turbopack-om to pokazuje na spakovan chunk, pa izračunata adresa workera ne postoji i
    // browser dobije HTML umesto JavaScript-a ("Failed to load module script: non-JavaScript
    // MIME type"). Mapa se tada uopšte ne iscrtava. Zato se adresa zadaje izričito; fajlove
    // na tu adresu stavlja `scripts/copy-maplibre-worker.mjs` (postinstall). M5 spec §3.0h.6.
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

    // `pmtiles:` protokol mora biti registrovan pre nego što se stil učita.
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildStyle(flavorNameForTheme()),
        // Centar Balkana; prikaz odmah posle učitavanja skače na okvir rezultata.
        center: [20.5, 43.0],
        zoom: 5,
        attributionControl: { compact: true },
      });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Mapa nije mogla da se pokrene.');
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Nedostaje fajl mape (nije napravljen lokalno) — poruka umesto praznog sivog pravougaonika,
    // isti princip kao §3.0g.5 ("prazan ekran uči korisnika da je aplikacija pokvarena").
    map.on('error', (e) => {
      const msg = (e as unknown as { error?: { message?: string } }).error?.message ?? '';
      if (msg.includes('pmtiles') || msg.includes('404')) {
        setFailed('Podaci mape nisu pronađeni na ovom računaru — treba jednom napraviti lokalni fajl (M5 §3.0h.4).');
      }
    });

    map.on('load', () => {
      addResultLayers(map, flavorNameForTheme());

      // Klik na grupu zumira u nju.
      map.on('click', 'grupe', async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['grupe'] })[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource('rezultati') as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });

      // Klik na tačku otvara baner tog hotela.
      map.on('click', 'tacke', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id !== 'string') return;
        const point = pointsRef.current.find((p) => p.id === id);
        if (!point) return;

        popupRef.current?.remove();
        const popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '280px', className: 'tt-map-popup' })
          .setLngLat([point.lng, point.lat])
          .setHTML(bannerHtml(point, onSelectRef.current ? 'dodaj u izbor' : 'otvori'))
          .addTo(map);
        popupRef.current = popup;

        // Dugme u baneru je običan DOM čvor (nije React), pa se slušalac kači ručno posle
        // otvaranja. `Popup` sam briše čvor pri zatvaranju, pa nema šta da se otkači.
        popup.getElement()?.querySelector('.tt-map-add')?.addEventListener('click', () => {
          onSelectRef.current?.(id);
          popup.remove();
        });
      });

      for (const layer of ['grupe', 'tacke']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }

      mapRef.current = map;
      applyPoints(map, pointsRef.current, true);

      // Okvir se šalje tek kad se pomeranje ZAVRŠI (`moveend`), ne tokom svakog pomeraja —
      // inače bi jedno prevlačenje mišem poslalo desetine pretraga. Isti razlog zbog kog
      // dobavljači mere odnos pretraga i rezervacija (M4 §9, "Look-to-Book").
      map.on('moveend', () => {
        if (!followRef.current) return;
        const b = map.getBounds();
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(',');
        const next = new URLSearchParams(window.location.search);
        if (next.get('bbox') === bbox) return;
        next.set('bbox', bbox);
        // `replace`, ne `push` — svako pomeranje mape ne sme da napravi nov unos u istoriji,
        // inače dugme "nazad" u browseru vraća korisnika kroz svaki pomeraj.
        router.replace(`/rezervacije/pretraga?${next.toString()}`, { scroll: false });
      });
    });

    // Promena teme panela (ThemeToggle upisuje `data-theme` na <html>) menja i mapu, bez
    // ponovnog učitavanja stranice. `setStyle` uklanja naše slojeve, pa se posle njega izvor
    // i slojevi dodaju ponovo — zato `addResultLayers` i postoji kao zasebna funkcija.
    const observer = new MutationObserver(() => {
      const flavor = flavorNameForTheme();
      map.setStyle(buildStyle(flavor));
      map.once('styledata', () => {
        addResultLayers(map, flavor);
        applyPoints(map, pointsRef.current, false);
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ISPRAVKA (5.9.2026, vlasnikov nalaz uživo, uz snimak ekrana — prazan beo prostor desno od
    // mape). MapLibre meri svoj kontejner SAMO pri pravljenju — ako se širina te kolone posle
    // toga promeni (otvaranje/zatvaranje desnog panela, prevlačenje granice bočne trake preko
    // `ResizablePane`, ili samo to što je flex layout tek posle prvog render-a stigao do konačne
    // širine), platno ostaje na STAROJ, užoj veličini dok `<div>` oko njega already zauzima punu
    // širinu — razlika između njih je tačno taj prazan beli prostor, bez ijedne greške u konzoli.
    // `ResizeObserver` nad sopstvenim kontejnerom + `map.resize()` je standardno rešenje (nema ga
    // ugrađenog u samu biblioteku — mora se ručno pratiti).
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol('pmtiles');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tačke se osvežavaju odvojeno od pravljenja mape — promena rezultata ne sme da ruši i
  // ponovo pravi ceo prikaz (izgubio bi se zum i pomeraj koje je korisnik podesio).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Kad je "pretraži dok pomeram mapu" uključeno, novi rezultati NE smeju da pomere prikaz:
    // korisnik je upravo sam podesio okvir, a `fitBounds` bi ga odmah vratio na okvir tačaka —
    // mapa bi se otimala pri svakom pomeranju.
    applyPoints(map, points, !followRef.current);
  }, [points]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-dim">
        {failed}
      </div>
    );
  }

  return (
    // §3.0h (dopuna 3.9.2026, na zahtev vlasnika: „popunite prazan prostor u centralnom panelu
    // sa mapom") — visina se više NE zadaje fiksno (bilo `h-[520px]`, pa je ispod mape ostajala
    // prazna bela traka do dna panela) nego se uzima od roditelja: ekran pretrage je flex kolona
    // do dna `<main>`-a.
    //
    // `flex-1`, NE `h-full`: `height: 100%` se ovde ne razreši (izmereno u browseru — roditelj je
    // flex stavka čija visina dolazi iz flex proračuna, pa procenat padne na `auto`, a `auto` je
    // 0 jer je jedino dete opet `flex-1`). Zato svaki roditelj do `<main>`-a mora biti flex
    // kolona, a mapa uzima ostatak preko `flex-1`. `min-h` je donja granica za slučaj da mapa
    // dospe u roditelja koji nije flex kolona — MapLibre kontejner bez visine se ne iscrtava
    // uopšte, tiho, bez ijedne greške u konzoli.
    <div className="relative flex min-h-[320px] flex-1 flex-col">
      <div ref={containerRef} className="w-full flex-1 overflow-hidden rounded-lg border border-border" />

      {/* §3.0h.8 — prekidač stoji NA mapi, ne u traci iznad: odluka se donosi dok se gleda
          mapa, a ne pre nego što se do nje dođe. */}
      <label
        className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel/95 px-2.5 py-1.5 text-xs text-ink shadow-sm"
        title="Kad je uključeno, pomeranje ili zumiranje mape ponovo pretražuje samo ono što je vidljivo"
      >
        <input
          type="checkbox"
          checked={followMap}
          onChange={(e) => {
            const next = new URLSearchParams(window.location.search);
            if (e.target.checked) next.set('pratiMapu', '1');
            else {
              next.delete('pratiMapu');
              // Isključivanje uklanja i okvir — inače bi rezultati ostali zaključani na
              // poslednjem vidljivom delu mape, bez ijednog vidljivog znaka zašto.
              next.delete('bbox');
            }
            router.replace(`/rezervacije/pretraga?${next.toString()}`, { scroll: false });
          }}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        pretraži dok pomeram mapu
      </label>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-ink-dim">
            Nijedan rezultat nema koordinate — mapa nema šta da prikaže.
          </p>
        </div>
      )}
    </div>
  );
}
