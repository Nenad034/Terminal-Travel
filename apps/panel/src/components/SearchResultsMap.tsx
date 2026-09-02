'use client';

import { useEffect, useRef, useState } from 'react';
// maplibre-gl v6 nema default izvoz — samo imenovane (`Map`, `Protocol` dolazi iz `pmtiles`).
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
// Fajl se NE nalazi u git-u (`.gitignore`); pravi se lokalno, uputstvo u §3.0h.
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
}

/** Vezuje `data-theme` panela na Protomaps "flavor" — mapa prati temu ostatka ekrana. */
function flavorForTheme(): ReturnType<typeof namedFlavor> {
  if (typeof document === 'undefined') return namedFlavor('light');
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark' || theme === 'dim') return namedFlavor('dark');
  if (theme === 'light') return namedFlavor('light');
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? namedFlavor('dark') : namedFlavor('light');
}

function money(cents: number, currency: string): string {
  const whole = Math.round(cents / 100);
  return `${whole.toLocaleString('sr-RS')} ${currency}`;
}

/** Upisuje tačke u izvor i namešta prikaz na njihov okvir. Deljeno između prvog učitavanja
 * mape i svake naredne promene rezultata. */
function applyPoints(map: MapLibreMap, points: MapPoint[]) {
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

  if (points.length > 0) {
    const bounds = new maplibregl.LngLatBounds();
    for (const p of points) bounds.extend([p.lng, p.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
  }
}

export default function SearchResultsMap({ points, onSelect }: { points: MapPoint[]; onSelect?: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Poslednje poznate tačke — mapa se učitava asinhrono, pa prvi skup mora da bude dostupan
  // i onda kad `load` stigne POSLE nego što je roditelj već poslao rezultate.
  const pointsRef = useRef<MapPoint[]>(points);
  pointsRef.current = points;
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
        style: {
          version: 8,
          // NAPOMENA (§3.0h.3): slova i ikonice se za sada povlače sa Protomaps javnog
          // skladišta. To je jedini deo mape koji još izlazi van naše infrastrukture —
          // za produkciju se preseljava kod nas, zabeleženo kao otvorena stavka.
          glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
          sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
          sources: {
            protomaps: {
              type: 'vector',
              url: 'pmtiles:///maps/balkan.pmtiles',
              attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
            },
          },
          layers: layers('protomaps', flavorForTheme(), { lang: 'sr' }),
        },
        // Centar Balkana; stvaran prikaz odmah posle toga skače na okvir rezultata.
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
        setFailed('Podaci mape nisu pronađeni na ovom računaru — treba jednom napraviti lokalni fajl (M5 §3.0h).');
      }
    });

    map.on('load', () => {
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
          'text-field': ['get', 'cena'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 11,
          'text-offset': [0, -1.4],
          'text-allow-overlap': false,
        },
        paint: { 'text-color': '#4f46e5', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });

      // Klik na grupu zumira u nju; klik na tačku javlja roditelju koji je proizvod izabran.
      map.on('click', 'grupe', async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['grupe'] })[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource('rezultati') as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on('click', 'tacke', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') onSelect?.(id);
      });
      for (const layer of ['grupe', 'tacke']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }

      mapRef.current = map;
      // Prve tačke se ucrtavaju odmah po učitavanju; naredne promene hvata efekat ispod.
      applyPoints(map, pointsRef.current);
    });

    return () => {
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
    applyPoints(map, points);
  }, [points]);

  if (failed) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-lg border border-border bg-panel p-6 text-center text-xs text-ink-dim">
        {failed}
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[520px] w-full overflow-hidden rounded-lg border border-border" />
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
