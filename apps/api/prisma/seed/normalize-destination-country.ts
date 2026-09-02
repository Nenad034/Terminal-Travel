// Sređivanje zatečenih naziva država u bazi — M2 spec §2.1, vlasnikova odluka 3.9.2026
// („neka ostane anthropic i sredite države").
//
// Šta je bio problem: ista država je stajala u dva oblika — `RS` (24 aktivna proizvoda) i
// `Srbija` (2), a u analitičkim redovima i `ME` pored `Crna Gora`. Za pretragu su to bile DVE
// različite države: filter po „Srbija" nije nalazio nijedan od onih 24 proizvoda. Isti nered je
// nasledio i AI agent — na pitanje koliko hotela imamo u Crnoj Gori odgovorio je da ih nemamo.
//
// Ova skripta ispravlja ono što je već upisano. Da se nered ne vrati, isti oblik se od sada
// primenjuje i pri UPISU (`ProductsService.create/update`, `common/destination-country.ts`) —
// skripta bez te izmene bi bila čišćenje koje traje do sledećeg unosa.
//
// Pokretanje iz `apps/api`:
//   npm run normalize:countries -- --dry-run   (samo prikaže šta bi promenio)
//   npm run normalize:countries                (stvarno upiše)
import { PrismaClient } from '@prisma/client';
import { needsCountryNormalization, normalizeDestinationCountry } from '../../src/common/destination-country';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? 'PROBA — ništa se ne upisuje.\n' : 'UPIS — menja podatke u bazi.\n');

  let changed = 0;

  // 1. Katalog proizvoda (M2) — jedini izvor koji korisnik direktno pretražuje.
  const products = await prisma.product.findMany({
    select: { id: true, destinationCountry: true, destinationCity: true, status: true },
  });
  for (const p of products) {
    if (!needsCountryNormalization(p.destinationCountry)) continue;
    const next = normalizeDestinationCountry(p.destinationCountry);
    console.log(`Product ${p.id} (${p.status}, ${p.destinationCity ?? '—'}): "${p.destinationCountry}" → "${next}"`);
    changed++;
    if (!dryRun) await prisma.product.update({ where: { id: p.id }, data: { destinationCountry: next } });
  }

  // 2. Analitički redovi (M13 `FactBooking`) — prepisuju državu sa proizvoda u trenutku
  // sinhronizacije, pa nose isti nered i posle ispravke kataloga. Izveštaj koji istu državu
  // broji dvaput je pogrešan izveštaj, ne kozmetika.
  const facts = await prisma.factBooking.findMany({ select: { id: true, destinationCountry: true } });
  for (const f of facts) {
    if (!needsCountryNormalization(f.destinationCountry)) continue;
    const next = normalizeDestinationCountry(f.destinationCountry);
    console.log(`FactBooking ${f.id}: "${f.destinationCountry}" → "${next}"`);
    changed++;
    if (!dryRun) await prisma.factBooking.update({ where: { id: f.id }, data: { destinationCountry: next } });
  }

  // 3. Segmenti nacrta putovanja (M5 §3.0.2) — kopija naziva radi prikaza dok proizvod nije izabran.
  const segments = await prisma.itinerarySegment.findMany({ select: { id: true, destinationCountry: true } });
  for (const s of segments) {
    if (!needsCountryNormalization(s.destinationCountry)) continue;
    const next = normalizeDestinationCountry(s.destinationCountry);
    console.log(`ItinerarySegment ${s.id}: "${s.destinationCountry}" → "${next}"`);
    changed++;
    if (!dryRun) await prisma.itinerarySegment.update({ where: { id: s.id }, data: { destinationCountry: next } });
  }

  // `Article` (M22, sadržaj sajta) NAMERNO nije ovde — njegove vrednosti su izmišljeni nazivi iz
  // automatskih testova („Testland-…"), ne prave države; nema šta da se svede na jedan oblik.

  console.log(`\n${changed === 0 ? 'Nema šta da se menja.' : `${dryRun ? 'Za promenu' : 'Promenjeno'}: ${changed} zapisa.`}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
