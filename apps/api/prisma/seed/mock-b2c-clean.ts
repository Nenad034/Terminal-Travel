/**
 * Uklanjanje mock podataka za sajt (par uz `mock-b2c.ts`).
 *
 * Briše ISKLJUČIVO ono što nosi `MOCK_MARKER` — postojeći podaci se ne diraju. Redosled
 * brisanja poštuje FK zavisnosti (stavke pre rezervacije, cene pre perioda, i tako dalje).
 *
 * Napomena: `audit_log_entries` je append-only (M1 §3.8, DB trigger odbija DELETE), pa audit
 * zapisi nastali radom sa mock podacima ostaju — to je ispravno ponašanje, ne propust.
 */
import { PrismaClient } from '@prisma/client';
import { MOCK_MARKER } from './mock-b2c';

const prisma = new PrismaClient();
const GUEST_EMAIL = 'gost.mock@terminal-travel.local';

async function main() {
  console.log('--- uklanjanje MOCK B2C podataka ---');

  // findMany, ne findFirst: `Supplier.taxId` nije unique u šemi, pa ponovljena pokretanja seed-a
  // mogu ostaviti više mock dobavljača — brisanje samo prvog ostavlja proizvode koji zatim ruše
  // sledeći seed sudarom na (language_code, slug).
  const suppliers = await prisma.supplier.findMany({ where: { taxId: `${MOCK_MARKER}-100000001` } });
  const bookings = await prisma.booking.findMany({ where: { bookingNumber: { startsWith: MOCK_MARKER } } });
  const account = await prisma.clientAccount.findFirst({ where: { email: GUEST_EMAIL } });

  // Rezervacije gosta (stavke → uplate → rezervacija)
  if (bookings.length) {
    const ids = bookings.map((b) => b.id);
    await prisma.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: ids } } }).catch(() => undefined);
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  }

  // Ponude nastale klikom kroz sajt tokom pregleda (nastaju na pravom toku, nisu iz seed-a)
  if (account) {
    const quotes = await prisma.quote.findMany({ where: { clientAccountId: account.id } });
    if (quotes.length) {
      const qids = quotes.map((q) => q.id);
      await prisma.quoteItem.deleteMany({ where: { quoteId: { in: qids } } });
      await prisma.quote.deleteMany({ where: { id: { in: qids } } });
    }
    await prisma.guestProfile.deleteMany({ where: { linkedClientAccountId: account.id } });
    await prisma.clientAccount.delete({ where: { id: account.id } });
  }
  const guestUsers = await prisma.user.findMany({ where: { email: GUEST_EMAIL }, select: { id: true } });
  if (guestUsers.length) {
    await prisma.userRole.deleteMany({ where: { userId: { in: guestUsers.map((u) => u.id) } } });
  }
  await prisma.user.deleteMany({ where: { email: GUEST_EMAIL } });

  // Katalog i ugovorni lanac
  if (suppliers.length) {
    const supplierIds = suppliers.map((s) => s.id);
    const contracts = await prisma.contract.findMany({ where: { supplierId: { in: supplierIds } } });
    const cids = contracts.map((c) => c.id);
    const periods = await prisma.contractPeriod.findMany({ where: { contractId: { in: cids } } });
    const pids = periods.map((p) => p.id);

    // Proizvodi mogu imati QuoteItem/BookingItem iz pregleda — obriši ih pre proizvoda.
    const mockProducts = await prisma.product.findMany({ where: { sourceContractId: { in: cids } } });
    const prodIds = mockProducts.map((p) => p.id);
    if (prodIds.length) {
      await prisma.quoteItem.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.bookingItem.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.productTranslation.deleteMany({ where: { productId: { in: prodIds } } });
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    }

    if (pids.length) {
      await prisma.rateLineAgePricing.deleteMany({ where: { rateLine: { contractPeriodId: { in: pids } } } }).catch(() => undefined);
      await prisma.rateLine.deleteMany({ where: { contractPeriodId: { in: pids } } });
      await prisma.cancellationRule.deleteMany({ where: { contractPeriodId: { in: pids } } });
      await prisma.contractPeriod.deleteMany({ where: { id: { in: pids } } });
    }
    await prisma.contract.deleteMany({ where: { id: { in: cids } } });
    await prisma.markupRule.deleteMany({ where: { scopeId: { in: supplierIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
  }

  // Sigurnosna mreža — proizvod prepoznat po mock slug-u, i ako mu je ugovor već obrisan.
  const MOCK_SLUGS = [
    'hotel-avala-resort', 'blue-bay-hotel', 'apartmani-vidikovac', 'rim-tri-dana',
    'antalija-sedam-noci', 'boka-kotorska-brodom', 'transfer-solun-halkidiki',
    'fruska-gora-sremski-karlovci',
  ];
  const strayTranslations = await prisma.productTranslation.findMany({
    where: { OR: [{ slug: { in: MOCK_SLUGS } }, { slug: { in: MOCK_SLUGS.map((s) => `${s}-en`) } }] },
    select: { productId: true },
  });
  const strayIds = [...new Set(strayTranslations.map((t) => t.productId))];
  if (strayIds.length) {
    await prisma.quoteItem.deleteMany({ where: { productId: { in: strayIds } } });
    await prisma.bookingItem.deleteMany({ where: { productId: { in: strayIds } } });
    await prisma.productTranslation.deleteMany({ where: { productId: { in: strayIds } } });
    await prisma.product.deleteMany({ where: { id: { in: strayIds } } });
    console.log(`  uklonjeno i ${strayIds.length} zaostalih proizvoda prepoznatih po slug-u`);
  }

  // M12 sadržaj i M23 članak
  const slugs = ['o-nama', 'kontakt', 'pet-plaza-crne-gore-bez-gomile', 'kako-spakovati-kofer-za-autobuski-aranzman'];
  const pieces = await prisma.contentPiece.findMany({ where: { slug: { in: slugs } } });
  if (pieces.length) {
    const ids = pieces.map((p) => p.id);
    await prisma.contentTranslation.deleteMany({ where: { contentPieceId: { in: ids } } });
    await prisma.contentPiece.deleteMany({ where: { id: { in: ids } } });
  }

  const articles = await prisma.article.findMany({ where: { shareToken: { startsWith: MOCK_MARKER.toLowerCase() } } });
  if (articles.length) {
    const ids = articles.map((a) => a.id);
    await prisma.articleTranslation.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.articleRevision.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.articleSource.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.article.deleteMany({ where: { id: { in: ids } } });
  }

  console.log('Obrisano. Postojeći podaci nisu dirani.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
