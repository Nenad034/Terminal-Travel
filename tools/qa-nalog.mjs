// Pravi (ili popravlja) LOKALNI nalog za automatsku proveru ekrana — onaj koji koriste
// `tools/qa.mjs` i `tools/qa-screenshot.mjs`.
//
// ZAŠTO POSTOJI (5.9.2026): nalog `qa.pretraga@tt-test.local` je u nekoj ranijoj sesiji
// napravljen RUČNO i nije postojao nigde u repozitorijumu — ni u seed-u, ni u skripti. Kad je
// baza ponovo napunjena, nalog je nestao, pa je `qa-screenshot.mjs` prestao da radi na celoj
// mašini a da to niko nije primetio. Alat na koji se oslanja zamka 7.1 („browser je jedini
// dokaz za klijentsko ponašanje") ne sme da zavisi od koraka koji nigde nije zapisan.
//
// Nalog je NAMERNO sa fiksnom lozinkom i fiksnom 2FA tajnom: automatska prijava mora da prođe
// bez čoveka. Zato radi ISKLJUČIVO nad lokalnom bazom — vidi ogradu ispod. Iste vrednosti već
// stoje otvoreno u `qa-screenshot.mjs`, pa ovo ne izlaže ništa novo.
//
// Pokretanje iz korena repozitorijuma:
//   node tools/qa-nalog.mjs
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// `.env` se čita ručno da skripta ne zavisi od NestJS bootstrap-a (Prisma i argon2 su dovoljni).
for (const red of readFileSync('apps/api/.env', 'utf8').split('\n')) {
  const par = red.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (par && !process.env[par[1]]) process.env[par[1]] = par[2];
}

const EMAIL = process.env.QA_EMAIL ?? 'qa.pretraga@tt-test.local';
const PASSWORD = process.env.QA_PASSWORD ?? 'QaPretraga123!';
const SECRET = process.env.QA_TOTP_SECRET ?? 'GVOWG4JTJNSVGYYB';

// Ograda: nalog sa poznatom lozinkom I poznatom 2FA tajnom je potpun zaobilazak prijave, pa
// sme da postoji samo na lokalnoj mašini. Provera je na adresi baze, ne na `NODE_ENV` —
// promenljiva okruženja se lako zaboravi, adresa baze ne laže o tome gde se piše.
const db = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(db)) {
  console.error('ODBIJENO: DATABASE_URL ne pokazuje na lokalnu bazu.');
  console.error('Ovaj nalog ima poznatu lozinku i poznatu 2FA tajnu — van lokalne mašine se ne pravi.');
  process.exit(2);
}

// Isto kao `apps/api/src/common/crypto/secret-box.ts` (AES-256-GCM, ključ iz ENCRYPTION_KEY).
// Namerno prepisano, a ne uvezeno: taj fajl je TypeScript unutar NestJS aplikacije, a ovo je
// samostalna skripta. Ako se format tamo promeni, promeni se i ovde — obe strane pišu isti zapis.
function encryptSecret(plainText) {
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY nije podešen u apps/api/.env');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(process.env.ENCRYPTION_KEY).digest(), iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

const prisma = new PrismaClient();

const podaci = {
  passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
  fullName: 'QA provera ekrana',
  accountType: 'STAFF',
  status: 'ACTIVE',
  mfaEnabled: true,
  mfaSecretEncrypted: encryptSecret(SECRET),
  // Nalog se koristi u petlji; zaključavanje posle neuspelih pokušaja bi zaustavilo proveru.
  failedLoginAttempts: 0,
  lockedUntil: null,
};

// `update` a ne samo `create`: ako nalog postoji ali je zaključan ili mu je lozinka promenjena,
// popravlja se — inače bi skripta „prošla" a prijava i dalje padala.
const user = await prisma.user.upsert({
  where: { email: EMAIL },
  create: { email: EMAIL, ...podaci },
  update: podaci,
});

// Uloga VLASNIK: provera otvara ekrane iz više modula, pa nalog sa užim pravima ne bi mogao da
// ih vidi i prazan ekran bi izgledao kao kvar. Ovo NIJE tvrdnja da su prava ispravna — provera
// prava je posebna tema, ne posao ovog alata.
const uloga = await prisma.role.findUniqueOrThrow({ where: { name: 'VLASNIK' } });
const postoji = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: uloga.id } });
if (!postoji) {
  await prisma.userRole.create({ data: { userId: user.id, roleId: uloga.id, assignedBy: user.id } });
}

console.log(`QA nalog spreman: ${EMAIL} (uloga VLASNIK, 2FA fiksnom tajnom)`);
await prisma.$disconnect();
