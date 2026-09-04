/**
 * Uklanjanje mock rezervacija (par uz `mock-lista-rezervacija.ts`).
 *
 * Briše ISKLJUČIVO rezervacije čiji broj počinje `MOCK_MARKER`-om i njihove Nalogodavce —
 * ne dira katalog/dobavljače koje pravi `mock-destinacije.ts` (ova skripta ih samo koristi,
 * ne pravi ih), isti obrazac kao `mock-b2c-clean.ts`.
 */
import { PrismaClient } from '@prisma/client';
import { MOCK_MARKER } from './mock-lista-rezervacija';

const prisma = new PrismaClient();

async function main() {
  console.log('--- uklanjanje MOCK liste rezervacija ---');

  const bookings = await prisma.booking.findMany({ where: { bookingNumber: { startsWith: MOCK_MARKER } } });
  if (!bookings.length) {
    console.log('Ništa za brisanje.');
    return;
  }
  const ids = bookings.map((b) => b.id);
  const clientAccountIds = [...new Set(bookings.map((b) => b.clientAccountId))];

  const items = await prisma.bookingItem.findMany({ where: { bookingId: { in: ids } }, select: { id: true } });
  const itemIds = items.map((i) => i.id);

  await prisma.bookingItemGuest.deleteMany({ where: { bookingItemId: { in: itemIds } } });
  await prisma.payment.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.bookingNote.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.guestProfile.deleteMany({ where: { linkedClientAccountId: { in: clientAccountIds } } });
  await prisma.clientAccount.deleteMany({ where: { id: { in: clientAccountIds } } });

  console.log(`Obrisano: ${bookings.length} rezervacija. Katalog/dobavljači nisu dirani.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
