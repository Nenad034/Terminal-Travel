/**
 * Jednokratno popunjavanje istorije kursne liste sa javne NBS stranice (M10 spec §3.1a).
 *
 * Zašto postoji: dnevni uvoz (`NbsRateImportCron`) povlači ISKLJUČIVO današnji kurs. Od
 * 6.9.2026. taj posao sam popunjava rupe u poslednjih 30 dana, ali dublja istorija — sve pre
 * nego što je sistem uopšte postavljen — ostaje prazna, i nikad se sama ne popuni. Posledica
 * nije greška nego tišina: uplata u evrima na dan za koji nema kursa se ne projektuje u M13
 * (`FactPayment`), pa izveštaj o naplati ostane prazan bez ijedne poruke korisniku. Zatečeno
 * 5.9.2026: 12 uplata u evrima, dva zapisa kursa u bazi, nijedan na dan ili pre tih uplata.
 *
 * Ovo NIJE svakodnevni alat nego održavanje, isti obrazac kao seed skripte — zato skripta a ne
 * ekran. Ručni unos pojedinačnog kursa i dalje ide kroz `POST /finance/exchange-rates`.
 *
 * Poziva NBS jednom po danu, sa razmakom — javni izvor nije ugovoren API i ne opterećuje se.
 * Dani koji već imaju kurs se preskaču (ne prepisuju se, ni oni uneti ručno). Za neradne dane
 * NBS vraća poslednju važeću listu, i zapis se upisuje pod datumom KOJI STRANICA JAVI, pa
 * vikend ne dobija izmišljen sopstveni kurs.
 *
 * Pokretanje (datumi u obliku GGGG-MM-DD; „do" je opciono, podrazumevano danas):
 *   npm run rates:backfill --workspace=apps/api -- 2026-06-01
 *   npm run rates:backfill --workspace=apps/api -- 2026-06-01 2026-08-31
 */
import { PrismaClient } from '@prisma/client';
import { ExchangeRatesService } from '../../src/modules/m10-finansije/exchange-rates/exchange-rates.service';
import { NbsRateFetcherService } from '../../src/modules/m10-finansije/exchange-rates/nbs-rate-fetcher.service';

const prisma = new PrismaClient();

function parsirajDatum(vrednost: string, ime: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vrednost)) {
    throw new Error(`${ime} mora biti u obliku GGGG-MM-DD (dobijeno: "${vrednost}").`);
  }
  const d = new Date(`${vrednost}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${ime} nije ispravan datum: "${vrednost}".`);
  return d;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length === 0) {
    console.error('Upotreba: npm run rates:backfill --workspace=apps/api -- <od GGGG-MM-DD> [do GGGG-MM-DD]');
    process.exit(2);
  }

  const od = parsirajDatum(args[0], 'Početni datum');
  const danas = new Date();
  const do_ = args[1]
    ? parsirajDatum(args[1], 'Krajnji datum')
    : new Date(Date.UTC(danas.getUTCFullYear(), danas.getUTCMonth(), danas.getUTCDate()));

  if (od > do_) throw new Error('Početni datum je posle krajnjeg.');

  const brojDana = Math.round((do_.getTime() - od.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  console.log(`--- Popunjavanje kursne liste: ${args[0]} → ${do_.toISOString().slice(0, 10)} (${brojDana} dana) ---`);

  // Servisi se prave ručno (bez Nest kontejnera) — skripta je jednokratna i ne diže aplikaciju.
  const service = new ExchangeRatesService(prisma as never, new NbsRateFetcherService());

  const rezultat = await service.backfillMissingRates(od, do_, {
    onProgress: (dan, ishod) => console.log(`  ${dan}  ${ishod}`),
  });

  console.log(
    `\nGotovo: uvezeno ${rezultat.popunjeno} dana, preskočeno ${rezultat.preskoceno}, neuspelo ${rezultat.neuspelo}.`,
  );
  if (rezultat.neuspelo > 0) {
    console.log('Neuspeli dani se mogu pokušati ponovo — skripta preskače ono što je već uvezeno.');
  }

  const ukupno = await prisma.exchangeRateSnapshot.count();
  console.log(`Ukupno zapisa u kursnoj listi: ${ukupno}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
