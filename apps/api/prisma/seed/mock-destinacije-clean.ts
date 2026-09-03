/**
 * Uklanjanje mock kataloga destinacija (par uz `mock-destinacije.ts`).
 *
 * Briše ISKLJUČIVO ono što nosi `MOCK_MARKER` u dobavljaču, odnosno `MOCK_SLUG` u slug-u
 * prevoda. Redosled poštuje FK zavisnosti (stavke pre proizvoda, cene pre perioda, ugovor
 * pre dobavljača) — isti obrazac kao `mock-b2c-clean.ts`.
 *
 * `findMany`, ne `findFirst`: `Supplier.taxId` nije unique (zamka 5.3), pa dvaput pokrenut
 * seed ostavlja više mock dobavljača; brisanje samo prvog ostavilo bi proizvode koji ruše
 * sledeće pokretanje sudarom na `(language_code, slug)`.
 *
 * Napomena: `audit_log_entries` je append-only (M1 §3.8), pa audit zapisi nastali radom sa
 * mock podacima ostaju — to je ispravno ponašanje, ne propust.
 */
import { PrismaClient } from '@prisma/client';
import { MOCK_MARKER, MOCK_SLUG } from './mock-destinacije';

const prisma = new PrismaClient();

async function obrisiProizvode(ids: string[]) {
  if (!ids.length) return;
  await prisma.quoteItem.deleteMany({ where: { productId: { in: ids } } });
  await prisma.bookingItem.deleteMany({ where: { productId: { in: ids } } });
  await prisma.productTranslation.deleteMany({ where: { productId: { in: ids } } });
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log('--- uklanjanje MOCK kataloga destinacija ---');

  const suppliers = await prisma.supplier.findMany({
    where: { name: { startsWith: MOCK_MARKER } },
    select: { id: true },
  });
  const supplierIds = suppliers.map((s) => s.id);

  let obrisanoProizvoda = 0;

  if (supplierIds.length) {
    const contracts = await prisma.contract.findMany({ where: { supplierId: { in: supplierIds } }, select: { id: true } });
    const cids = contracts.map((c) => c.id);
    const periods = await prisma.contractPeriod.findMany({ where: { contractId: { in: cids } }, select: { id: true } });
    const pids = periods.map((p) => p.id);

    const mockProducts = await prisma.product.findMany({ where: { sourceContractId: { in: cids } }, select: { id: true } });
    await obrisiProizvode(mockProducts.map((p) => p.id));
    obrisanoProizvoda += mockProducts.length;

    if (pids.length) {
      await prisma.rateLineAgePricing.deleteMany({ where: { rateLine: { contractPeriodId: { in: pids } } } }).catch(() => undefined);
      await prisma.rateLine.deleteMany({ where: { contractPeriodId: { in: pids } } });
      await prisma.cancellationRule.deleteMany({ where: { contractPeriodId: { in: pids } } });
      await prisma.contractPeriod.deleteMany({ where: { id: { in: pids } } });
    }
    await prisma.contract.deleteMany({ where: { id: { in: cids } } });
    await prisma.markupRule.deleteMany({ where: { scopeId: { in: supplierIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    console.log(`  ${supplierIds.length} dobavljača, ${cids.length} ugovora, ${pids.length} perioda`);
  }

  // Sigurnosna mreža po slug-u — proizvod ostaje prepoznatljiv i ako mu je ugovor već obrisan.
  const stray = await prisma.productTranslation.findMany({
    where: { slug: { contains: MOCK_SLUG } },
    select: { productId: true },
  });
  const strayIds = [...new Set(stray.map((t) => t.productId))];
  if (strayIds.length) {
    await obrisiProizvode(strayIds);
    obrisanoProizvoda += strayIds.length;
    console.log(`  ${strayIds.length} zaostalih proizvoda prepoznatih po slug-u`);
  }

  console.log(`Obrisano ${obrisanoProizvoda} proizvoda. Postojeći podaci nisu dirani.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
