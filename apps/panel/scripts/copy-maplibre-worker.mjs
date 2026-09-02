// Kopira MapLibre radni proces (worker) u `public/maplibre/`, da bi ga browser mogao učitati
// sa stabilne adrese.
//
// Zašto je ovo potrebno (M5 spec §3.0h.6): MapLibre sam računa adresu svog workera iz
// `import.meta.url` — uzme adresu sopstvenog fajla i zameni ime u `maplibre-gl-worker.mjs`.
// Pod Turbopack-om ta adresa pokazuje na spakovan chunk (`/_next/static/chunks/...`), pa
// izračunata adresa workera ne postoji: server vrati 404 stranicu, browser dobije HTML
// umesto JavaScript-a i javi "Failed to load module script: non-JavaScript MIME type".
// Mapa se u tom slučaju uopšte ne iscrtava.
//
// Rešenje: worker se servira sa fiksne adrese, a komponenta je zada preko `setWorkerUrl`.
// Kopiraju se DVA fajla — worker uvozi `./maplibre-gl-shared.mjs` relativno, pa oba moraju
// stajati jedan pored drugog.
//
// Pokreće se automatski posle `npm install` (`postinstall`), pa kopije ne mogu da zastare u
// odnosu na instaliranu verziju MapLibre-a. Same kopije NISU u git-u (`.gitignore`).
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'public', 'maplibre');

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

try {
  await mkdir(target, { recursive: true });
  for (const file of FILES) {
    const from = fileURLToPath(await import.meta.resolve(`maplibre-gl/dist/${file}`));
    await copyFile(from, join(target, file));
  }
  console.log(`MapLibre worker kopiran u public/maplibre/ (${FILES.length} fajla).`);
} catch (e) {
  // Ne obara `npm install` — bez ovoga radi sve osim mape, i poruka jasno kaže šta nedostaje.
  console.warn('MapLibre worker NIJE kopiran — mapa neće raditi dok se ovo ne reši:', e?.message ?? e);
}
