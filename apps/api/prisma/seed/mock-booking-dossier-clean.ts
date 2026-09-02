/**
 * Uklanjanje mock podataka za dosije rezervacije (par uz `mock-booking-dossier.ts`).
 *
 * Briše ISKLJUČIVO ono što ta skripta doda (2 mock proizvoda, 2 mock gost profila, vodič,
 * markup pravilo) i sve dopunjene stavke/beleške/uplate/komunikaciju/ugovor/tiket ciljne
 * rezervacije. Sama rezervacija i nalogodavac postojali su i pre skripte — NE brišu se, samo
 * im se vraćaju dopunjena polja (ime nalogodavca ostaje kako je skripta ostavila).
 *
 * Napomena: `audit_log_entries` (dugme "Tok rezervacije") je append-only — DB trigger odbija
 * DELETE/UPDATE (M1 §3.8) — pa mock zapisi tamo ostaju i posle čišćenja. To je ispravno
 * ponašanje, isti obrazac kao napomena u `mock-b2c-clean.ts`.
 */
import { PrismaClient } from '@prisma/client';
import { MOCK_MARKER } from './mock-booking-dossier';

const prisma = new PrismaClient();
const TARGET_BOOKING_ID = '2e9f629d-0e46-41d9-9c56-63b6b0a5ba12';
const GUIDE_EMAIL = 'ana.vodic@mock-dossier.tt-demo.rs';

async function main() {
  console.log('--- uklanjanje MOCK dosijea rezervacije ---');

  const booking = await prisma.booking.findUnique({ where: { id: TARGET_BOOKING_ID } });
  if (!booking) {
    console.log('Ciljna rezervacija ne postoji, nema šta da se čisti.');
    return;
  }

  const hotelGuestIds = (
    await prisma.bookingItemGuest.findMany({ where: { bookingItem: { bookingId: TARGET_BOOKING_ID } }, select: { id: true } })
  ).map((g) => g.id);
  if (hotelGuestIds.length) {
    await prisma.fieldCheckIn.deleteMany({ where: { bookingItemGuestId: { in: hotelGuestIds } } });
  }

  await prisma.ticketMessage.deleteMany({ where: { ticket: { relatedBookingId: TARGET_BOOKING_ID } } });
  await prisma.ticket.deleteMany({ where: { relatedBookingId: TARGET_BOOKING_ID } });
  await prisma.travelGuaranteeRegistration.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.clientContract.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.communicationLog.deleteMany({ where: { clientAccountId: booking.clientAccountId } });
  await prisma.payment.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.bookingNote.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.bookingItem.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });

  await prisma.guestProfile.deleteMany({ where: { id: { in: [`${MOCK_MARKER}-guest-jovana`, `${MOCK_MARKER}-guest-petar`] } } });

  const mockProducts = await prisma.product.findMany({ where: { translations: { some: { slug: { startsWith: 'mock-dossier-' } } } } });
  if (mockProducts.length) {
    const ids = mockProducts.map((p) => p.id);
    await prisma.markupRule.deleteMany({ where: { scopeId: { in: ids } } });
    await prisma.productTranslation.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }

  const guide = await prisma.user.findFirst({ where: { email: GUIDE_EMAIL } });
  if (guide) {
    await prisma.userRole.deleteMany({ where: { userId: guide.id } });
    await prisma.user.delete({ where: { id: guide.id } });
  }

  console.log('Obrisano. Rezervacija i nalogodavac ostaju (postojali su pre skripte).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
