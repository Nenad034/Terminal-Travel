#!/usr/bin/env node
/**
 * `npm run doctor` — provera zdravlja lokalnog razvojnog okruženja, jednom komandom.
 *
 * ZAŠTO POSTOJI (dok. 39, nalaz 5.2): podizanje ovog repoa lokalno traži Docker, migracije,
 * append-only trigger, seed, tri mock skripte tačnim redosledom, geokodiranje na kraju i
 * `.env` sa svim ključevima iz `.env.example` — svaki od tih koraka je autora ovog nalaza
 * negde iznenadio. Ova skripta ne ispravlja ništa sama (namerno — svaki korak ima svoje
 * posledice, npr. seed nije bezbedan da se pusti dvaput bez razmišljanja); samo kaže jasno
 * šta nedostaje i koju komandu pokrenuti.
 *
 * POKRETANJE:  npm run doctor   (iz korena repozitorijuma)
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const API_DIR = join(ROOT, 'apps', 'api');

function parseEnvFile(path) {
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  const values = new Map();
  for (const line of content.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values.set(match[1], match[2].replace(/^["']|["']$/g, ''));
  }
  return values;
}

const rezultati = [];
function javi(ime, ok, poruka) {
  rezultati.push({ ime, ok, poruka });
  console.log(`${ok ? '✓' : '✗'} ${ime}${poruka ? ` — ${poruka}` : ''}`);
}

console.log('Terminal — provera zdravlja lokalnog okruženja\n');

// 1. .env potpun (isti princip kao common/env-drift-check.ts, nalaz 4.4)
const primer = parseEnvFile(join(API_DIR, '.env.example'));
const stvarni = parseEnvFile(join(API_DIR, '.env'));
if (!stvarni) {
  javi('apps/api/.env postoji', false, 'kopirati .env.example u .env i popuniti vrednosti');
} else if (primer) {
  const nedostaje = [...primer.keys()].filter((k) => !stvarni.has(k)).sort();
  if (nedostaje.length === 0) {
    javi('apps/api/.env sadrži sve ključeve iz .env.example', true);
  } else {
    javi(
      'apps/api/.env sadrži sve ključeve iz .env.example',
      false,
      `nedostaje: ${nedostaje.join(', ')}`,
    );
  }
}

const databaseUrl = stvarni?.get('DATABASE_URL');
if (!databaseUrl) {
  javi('DATABASE_URL podešen', false, 'nema ga u .env — ostatak provere se preskače');
  ispisiRezimeIIzadji();
}

// Postavi DATABASE_URL u process.env pre učitavanja Prisma klijenta — schema.prisma ga čita
// preko env("DATABASE_URL"), a ovaj proces se pokreće bez Nest-ovog ConfigModule-a.
process.env.DATABASE_URL = databaseUrl;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// 2. Baza dostupna
try {
  await prisma.$queryRawUnsafe('SELECT 1');
  javi('Postgres dostupan na DATABASE_URL', true);
} catch (err) {
  javi(
    'Postgres dostupan na DATABASE_URL',
    false,
    `${err.message.split('\n')[0]} — proveriti "docker compose up -d"`,
  );
  await prisma.$disconnect();
  ispisiRezimeIIzadji();
}

// 3. Migracije primenjene — svaka .sql migracija na disku mora imati završen red u
// `_prisma_migrations`. Prisma sama drži tu tabelu; ne postoji ako baza nikad nije migrirana.
try {
  const naDisku = readdirSync(join(API_DIR, 'prisma', 'migrations')).filter(
    (ime) => ime !== 'migration_lock.toml',
  );
  const primenjene = await prisma.$queryRawUnsafe(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
  );
  const primenjeneImena = new Set(primenjene.map((r) => r.migration_name));
  const nedostaje = naDisku.filter((ime) => !primenjeneImena.has(ime));
  if (nedostaje.length === 0) {
    javi(`Migracije primenjene (${naDisku.length}/${naDisku.length})`, true);
  } else {
    javi(
      `Migracije primenjene (${naDisku.length - nedostaje.length}/${naDisku.length})`,
      false,
      `nedostaje ${nedostaje.length} — pokrenuti "npm run prisma:migrate" u apps/api`,
    );
  }
} catch (err) {
  javi(
    'Migracije primenjene',
    false,
    `_prisma_migrations ne postoji — baza nikad nije migrirana (${err.message.split('\n')[0]})`,
  );
}

// 4. Append-only trigger na audit_log_entries (M1 spec §3.8, van Prisma šeme — v. prisma/sql/)
try {
  const [{ postoji }] = await prisma.$queryRawUnsafe(
    "SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_log_entries_no_update') AS postoji",
  );
  javi(
    'Append-only trigger na audit_log_entries',
    postoji,
    postoji
      ? undefined
      : 'pokrenuti "npx prisma db execute --file prisma/sql/audit_log_append_only.sql --schema prisma/schema.prisma" u apps/api',
  );
} catch (err) {
  javi('Append-only trigger na audit_log_entries', false, err.message.split('\n')[0]);
}

// 5. Seed pušten — 7 sistemskih uloga je najstabilniji signal (M1 spec §4, uvek isti skup)
try {
  const brojUloga = await prisma.role.count();
  javi(
    `Seed pušten (${brojUloga} sistemskih uloga)`,
    brojUloga > 0,
    brojUloga > 0 ? undefined : 'pokrenuti "npx prisma db seed" u apps/api',
  );
} catch (err) {
  javi('Seed pušten', false, err.message.split('\n')[0]);
}

// 6. Obim podataka — informativno, ne uspeh/neuspeh
try {
  const [brojKorisnika, brojProizvoda, brojRezervacija] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.booking.count(),
  ]);
  console.log(
    `\nPodaci: ${brojKorisnika} korisnika, ${brojProizvoda} proizvoda, ${brojRezervacija} rezervacija.`,
  );
} catch {
  // Tabele možda ne postoje ako migracije nisu primenjene — već prijavljeno gore u koraku 3.
}

await prisma.$disconnect();
ispisiRezimeIIzadji();

function ispisiRezimeIIzadji() {
  const neuspesni = rezultati.filter((r) => !r.ok);
  console.log(
    `\n${neuspesni.length === 0 ? 'Sve provereno, okruženje je zdravo.' : `${neuspesni.length} od ${rezultati.length} provera traži pažnju — v. ✗ iznad.`}`,
  );
  process.exit(neuspesni.length === 0 ? 0 : 1);
}
