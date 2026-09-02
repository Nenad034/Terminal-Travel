/**
 * Popunjavanje `Product.geo_lat`/`geo_lng` iz već poznate lokacije proizvoda.
 *
 * Zašto postoji: oba polja stoje u M2 spec §2.1 od početka, opisana kao "za prikaz na mapi",
 * ali su bila prazna u SVAKOM redu (33/33 aktivnih proizvoda, provereno 2.9.2026). Mapa u
 * pretrazi (M5 §3.0h) bez ovoga nema šta da prikaže.
 *
 * Izvor koordinata: Nominatim (OpenStreetMap). Vlasnikova odluka 2.9.2026 — koordinate se
 * izvode automatski iz adrese, ne unose ručno. Nominatim se poštuje po njihovim pravilima
 * korišćenja: najviše jedan poziv u sekundi i jasan `User-Agent` sa kontaktom. Ovo je
 * JEDNOKRATAN prolaz nad malim brojem zapisa, ne masovno geokodiranje.
 *
 * Pokretanje:
 *   npm run geocode:products --workspace=apps/api -- --dry-run   (samo ispiše, ništa ne upisuje)
 *   npm run geocode:products --workspace=apps/api                (upisuje)
 *   ... -- --force    (ponovo geokodira i one koji već imaju koordinate)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Pravila Nominatim-a traže prepoznatljiv User-Agent sa kontaktom. */
const USER_AGENT = 'TerminalTravel/1.0 (interni katalog putovanja; kontakt: nenad.tomic1403@gmail.com)';
/** Pravila traže najviše 1 poziv u sekundi — 1100ms ostavlja rezervu. */
const DELAY_MS = 1100;

/**
 * `destination_country` u bazi meša ISO kodove i srpske nazive ("RS", "Srbija", "Grčka",
 * "Crna Gora") — nasleđeno iz različitih seed skripti. Nominatim razume oba, ali engleski
 * naziv daje najpouzdaniji pogodak, pa se ono što prepoznajemo prevodi.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  RS: 'Serbia',
  SRBIJA: 'Serbia',
  'CRNA GORA': 'Montenegro',
  GRČKA: 'Greece',
  GRCKA: 'Greece',
  TURSKA: 'Turkey',
  ITALIJA: 'Italy',
  ŠPANIJA: 'Spain',
  SPANIJA: 'Spain',
  HRVATSKA: 'Croatia',
  AUSTRIJA: 'Austria',
  FRANCUSKA: 'France',
  NEMAČKA: 'Germany',
  NEMACKA: 'Germany',
  EGIPAT: 'Egypt',
  TUNIS: 'Tunisia',
  MAĐARSKA: 'Hungary',
  MADJARSKA: 'Hungary',
};

function normalizeCountry(raw: string): string {
  return COUNTRY_ALIASES[raw.trim().toUpperCase()] ?? raw.trim();
}

interface GeocodeHit {
  lat: number;
  lng: number;
  displayName: string;
}

async function geocode(query: string): Promise<GeocodeHit | null> {
  const url = `${NOMINATIM}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} za "${query}"`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (hits.length === 0) return null;
  return { lat: Number(hits[0].lat), lng: Number(hits[0].lon), displayName: hits[0].display_name };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geocodeProducts(opts: { dryRun: boolean; force: boolean }) {
  const products = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      ...(opts.force ? {} : { OR: [{ geoLat: null }, { geoLng: null }] }),
    },
    select: {
      id: true,
      type: true,
      destinationCountry: true,
      destinationCity: true,
      geoLat: true,
      geoLng: true,
      translations: { select: { name: true }, take: 1 },
    },
  });

  console.log(`Proizvoda za obradu: ${products.length}${opts.dryRun ? ' (PROBNI REŽIM — ništa se ne upisuje)' : ''}\n`);

  let done = 0;
  let missed = 0;
  let exactCount = 0;

  for (const p of products) {
    const name = p.translations[0]?.name?.trim() ?? '';
    const city = p.destinationCity?.trim() ?? '';
    const country = normalizeCountry(p.destinationCountry ?? '');

    // Dva pokušaja: prvo pun upit sa nazivom objekta (tačna tačka), pa samo grad+država
    // (tačka grada) ako naziv nije prepoznat. Tačka grada je lošija od tačne, ali daleko
    // bolja od prazne — proizvod se bar pojavi na mapi u pravom mestu.
    const attempts: { query: string; exact: boolean }[] = [];
    if (name && city) attempts.push({ query: `${name}, ${city}, ${country}`, exact: true });
    if (city) attempts.push({ query: `${city}, ${country}`, exact: false });

    let hit: GeocodeHit | null = null;
    let exact = false;
    for (const attempt of attempts) {
      hit = await geocode(attempt.query);
      await sleep(DELAY_MS);
      if (hit) {
        // `exact` mora da se pamti UZ pogodak, ne da se izvodi poređenjem sa `attempts[0]`
        // posle petlje: proizvod bez naziva uopšte nema upit sa nazivom, pa je njegov jedini
        // pokušaj (grad) bio `attempts[0]` — i takav zapis se lažno prijavljivao kao "TAČNO".
        exact = attempt.exact;
        break;
      }
    }

    const label = `${name || '(bez naziva)'} — ${city}, ${p.destinationCountry}`;
    if (!hit) {
      missed++;
      console.log(`  PROMAŠAJ  ${label}`);
      continue;
    }
    console.log(`  ${exact ? 'TAČNO   ' : 'GRAD    '}  ${label}  ->  ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}`);

    if (!opts.dryRun) {
      await prisma.product.update({ where: { id: p.id }, data: { geoLat: hit.lat, geoLng: hit.lng } });
    }
    done++;
    if (exact) exactCount++;
  }

  console.log(
    `\nGotovo: ${done} popunjeno — ${exactCount} tačna tačka objekta, ${done - exactCount} tačka mesta; ${missed} bez pogotka.`
  );
  if (missed > 0) {
    console.log('Proizvodi bez pogotka ostaju bez koordinata — ispravljaju se ručno u katalogu, ne pogađaju se.');
  }
}

// Zamka 5.2 (33-ZAMKE-I-OBAVEZNE-PROVERE.md) — uvoz modula ne sme ništa da pokrene.
if (require.main === module) {
  const args = process.argv.slice(2);
  geocodeProducts({ dryRun: args.includes('--dry-run'), force: args.includes('--force') })
    .catch((e) => {
      console.error('GREŠKA:', e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
