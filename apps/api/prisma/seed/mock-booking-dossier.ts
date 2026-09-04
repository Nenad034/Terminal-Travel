/**
 * MOCK PODACI ZA DOSIJE JEDNE REZERVACIJE (M5) — samo za lokalni razvoj, nikad za produkciju.
 *
 * Svrha: napuniti SVE tabove ekrana /rezervacije/[id] za jednu konkretnu rezervaciju (dat kroz
 * `TARGET_BOOKING_ID`), da se izgled dosijea (Pregled/Aranžman/Putnici/Finansije/Komunikacija/
 * Dokumenti/Beleške/Reklamacije/Predstavnici) i dugme "Tok rezervacije" (M1 AuditLogEntry
 * istorija) mogu videti uživo — zahtev vlasnika, 2.9.2026. Ciljna rezervacija je ostavljen
 * e2e fixture (`TT-M6-E2E-...`) bez ijedne stavke; skripta je dopunjava, ne pravi novu
 * rezervaciju (isti obrazac kao `mock-b2c.ts`, samo na dosijeu umesto na javnom sajtu).
 *
 * SVE novo što ova skripta pravi (2 proizvoda, 2 gost profila, markup pravilo, vodič) nosi
 * marker `MOCK_MARKER` u prepoznatljivom polju — `mock-booking-dossier-clean.ts` briše tačno to.
 * Sama rezervacija/nalogodavac se NE brišu (postojali su pre skripte), samo se vraćaju njena
 * dopunjena polja i sve novododate stavke/beleške/uplate/itd.
 *
 * Pokretanje (iz apps/api):
 *   npm run seed:mock-booking-dossier
 *   npm run seed:mock-booking-dossier:clean
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const MOCK_MARKER = 'MOCK-DOSSIER';
const TARGET_BOOKING_ID = '2e9f629d-0e46-41d9-9c56-63b6b0a5ba12';
const GUIDE_EMAIL = 'ana.vodic@mock-dossier.tt-demo.rs';

async function main() {
  console.log('--- MOCK dosije rezervacije ---');

  const booking = await prisma.booking.findUnique({ where: { id: TARGET_BOOKING_ID } });
  if (!booking) throw new Error(`Ciljna rezervacija ne postoji: ${TARGET_BOOKING_ID}`);

  // --- M6 Nalogodavac — lepše ime umesto e2e test stub-a (postojeći zapis, samo dopuna polja) ---
  const clientAccount = await prisma.clientAccount.update({
    where: { id: booking.clientAccountId },
    data: {
      fullName: 'Jovana Marković',
      email: 'jovana.markovic@example.rs',
      phone: '+381 63 123 4567',
      address: 'Bulevar Kralja Aleksandra 45',
      country: 'RS',
      preferredLanguage: 'sr',
      marketingConsent: true,
      marketingConsentDate: new Date('2026-06-01'),
      tags: ['stalni gost', 'leto 2026'],
    },
  });

  // --- Nosioci naloga (owner/assigned) — postojeći stvarni korisnici, ne mock ---
  const marko = await prisma.user.findFirst({ where: { email: 'agent-demo@tt-test.rs' } });

  // --- Vodič na terenu (M9), za karticu Predstavnici ---
  let guide = await prisma.user.findFirst({ where: { email: GUIDE_EMAIL } });
  if (!guide) {
    guide = await prisma.user.create({
      data: { email: GUIDE_EMAIL, fullName: 'Ana Vodić', accountType: 'STAFF', status: 'ACTIVE' },
    });
    const vodicRole = await prisma.role.findFirstOrThrow({ where: { name: 'VODIC' } });
    await prisma.userRole.create({ data: { userId: guide.id, roleId: vodicRole.id, assignedBy: marko?.id ?? guide.id } });
  }

  // --- Proizvodi (M2) — hotel + transfer, da Aranžman ima dve stavke ---
  // M2 spec §2.1b (4.9.2026) — `city` je bio "Sitonija, Halkidiki" (regija, ne naselje); ovo je
  // upravo primer koji je naveo na nalaz. Ispravljeno: `city` = stvarno naselje, `area` = nova
  // regija/poluostrvo. `country` istovremeno usklađen sa §2.1a (naziv na srpskom, ne ISO kod).
  const productDefs = [
    {
      slug: 'mock-dossier-hotel-alexander-sitonija',
      type: 'ACCOMMODATION' as const,
      country: 'Grčka',
      city: 'Nikiti',
      area: 'Sitonija, Halkidiki',
      name: 'Hotel Alexander The Great 4*',
      desc: 'Hotel na prvoj liniji, privatna plaža, dva bazena, polupansion.',
      attributes: { stars: 4, board: 'polupansion', room_type: 'Superior soba sa pogledom na more' },
    },
    {
      slug: 'mock-dossier-transfer-solun-sitonija',
      type: 'TRANSFER' as const,
      country: 'Grčka',
      city: 'Nikiti',
      area: 'Sitonija, Halkidiki',
      name: 'Transfer aerodrom Solun — Nikiti',
      desc: 'Privatni transfer u oba pravca, klimatizovano vozilo.',
      attributes: { vehicle_type: 'kombi', route: 'aerodrom Solun (SKG) — Nikiti' },
    },
  ];
  const products: Record<string, Awaited<ReturnType<typeof prisma.product.create>>> = {};
  for (const def of productDefs) {
    let product = await prisma.product.findFirst({ where: { translations: { some: { slug: def.slug } } } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          type: def.type,
          sourceType: 'CONTRACTED',
          destinationCountry: def.country,
          destinationCity: def.city,
          destinationArea: def.area,
          status: 'ACTIVE',
          visibleChannels: ['B2C_SITE'],
          attributes: def.attributes,
          translations: { create: { languageCode: 'sr', name: def.name, description: def.desc, slug: def.slug } },
        },
      });
    } else {
      // M2 spec §2.1b (4.9.2026) — dosije se ranije pokretao (npr. sa starim "Sitonija,
      // Halkidiki" u polju mesto) na svakoj razvojnoj mašini pojedinačno, pa je proizvod već
      // postojao po slug-u i `create` iznad se nikad nije izvršio — destinacija je zato ostajala
      // ZAGLAVLJENA na staru vrednost pri svakom sledećem pokretanju skripte, uprkos ispravci
      // ovde u `productDefs`. Osvežava se pri svakom pokretanju, ne samo pri prvom.
      product = await prisma.product.update({
        where: { id: product.id },
        data: { destinationCountry: def.country, destinationCity: def.city, destinationArea: def.area },
      });
    }
    products[def.slug] = product;
  }
  const hotelProduct = products['mock-dossier-hotel-alexander-sitonija'];
  const transferProduct = products['mock-dossier-transfer-solun-sitonija'];

  // --- Markup pravilo (obavezan FK na BookingItem) ---
  let markupRule = await prisma.markupRule.findFirst({ where: { scopeId: hotelProduct.id, scopeType: 'M2_PRODUCT' } });
  if (!markupRule) {
    markupRule = await prisma.markupRule.create({ data: { scopeId: hotelProduct.id, scopeType: 'M2_PRODUCT', percentage: 20 } });
  }

  const stayFrom = new Date('2026-08-10T14:00:00Z');
  const stayTo = new Date('2026-08-17T10:00:00Z');

  // Ponovno pokretanje = čisto stanje stavki/beleški/uplata/komunikacije/tiketa te rezervacije.
  await prisma.bookingItem.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.bookingNote.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.payment.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.communicationLog.deleteMany({ where: { clientAccountId: clientAccount.id } });
  await prisma.clientContract.deleteMany({ where: { bookingId: TARGET_BOOKING_ID } });
  await prisma.ticketMessage.deleteMany({ where: { ticket: { relatedBookingId: TARGET_BOOKING_ID } } });
  await prisma.ticket.deleteMany({ where: { relatedBookingId: TARGET_BOOKING_ID } });

  const hotelItem = await prisma.bookingItem.create({
    data: {
      bookingId: TARGET_BOOKING_ID,
      productId: hotelProduct.id,
      sourceType: 'CONTRACTED',
      supplierReference: `${MOCK_MARKER}-ALX-1042`,
      stayFrom,
      stayTo,
      baseCost: 98000,
      baseCostCurrency: 'EUR',
      markupRuleId: markupRule.id,
      finalPrice: 117600,
      finalPriceCurrency: 'EUR',
      itemStatus: 'CONFIRMED',
      unitCount: 1,
      assignedGuideId: guide.id,
      announcedAt: new Date('2026-06-05T09:00:00Z'),
      supplierConfirmedAt: new Date('2026-06-05T15:00:00Z'),
      supplierConfirmedBy: marko?.id,
      guests: {
        create: [
          { guestFirstName: 'Jovana', guestLastName: 'Marković' },
          { guestFirstName: 'Petar', guestLastName: 'Marković' },
        ],
      },
    },
    include: { guests: true },
  });

  const transferItem = await prisma.bookingItem.create({
    data: {
      bookingId: TARGET_BOOKING_ID,
      productId: transferProduct.id,
      sourceType: 'CONTRACTED',
      supplierReference: `${MOCK_MARKER}-TRF-771`,
      stayFrom,
      stayTo: stayFrom,
      baseCost: 4000,
      baseCostCurrency: 'EUR',
      markupRuleId: markupRule.id,
      finalPrice: 4800,
      finalPriceCurrency: 'EUR',
      itemStatus: 'CONFIRMED',
      unitCount: 1,
      guests: {
        create: [
          { guestFirstName: 'Jovana', guestLastName: 'Marković' },
          { guestFirstName: 'Petar', guestLastName: 'Marković' },
        ],
      },
    },
  });

  const totalPrice = hotelItem.finalPrice + transferItem.finalPrice;

  // --- M6 Gost profili, povezani preko guestProfileId (karticа Putnici) ---
  const guest1 = await prisma.guestProfile.upsert({
    where: { id: `${MOCK_MARKER}-guest-jovana` },
    update: {},
    create: {
      id: `${MOCK_MARKER}-guest-jovana`,
      fullName: 'Jovana Marković',
      documentType: 'LICNA_KARTA',
      documentNumber: '012345678',
      nationality: 'RS',
      dateOfBirth: new Date('1988-03-14'),
      email: 'jovana.markovic@example.rs',
      phone: '+381 63 123 4567',
      linkedClientAccountId: clientAccount.id,
    },
  });
  const guest2 = await prisma.guestProfile.upsert({
    where: { id: `${MOCK_MARKER}-guest-petar` },
    update: {},
    create: {
      id: `${MOCK_MARKER}-guest-petar`,
      fullName: 'Petar Marković',
      documentType: 'PASSPORT',
      documentNumber: 'P1122334',
      nationality: 'RS',
      dateOfBirth: new Date('1985-11-02'),
      linkedClientAccountId: clientAccount.id,
    },
  });
  for (const item of [hotelItem, transferItem]) {
    await prisma.bookingItemGuest.updateMany({ where: { bookingItemId: item.id, guestFirstName: 'Jovana' }, data: { guestProfileId: guest1.id } });
    await prisma.bookingItemGuest.updateMany({ where: { bookingItemId: item.id, guestFirstName: 'Petar' }, data: { guestProfileId: guest2.id } });
  }

  // --- Rezervacija sama — glavna polja + vlasništvo ---
  await prisma.booking.update({
    where: { id: TARGET_BOOKING_ID },
    data: {
      buyerName: 'Jovana Marković',
      buyerType: 'FIZICKO_LICE',
      channel: 'B2C_SITE',
      tipNastupanja: 'ORGANIZATOR',
      status: 'CONFIRMED',
      paymentStatus: 'PARTIALLY_PAID',
      totalPrice,
      currency: 'EUR',
      voucherUrl: 'https://cdn.terminal-travel.local/vaucer/mock-dossier-demo.pdf',
      confirmedAt: new Date('2026-06-05T15:05:00Z'),
      ownerId: marko?.id ?? null,
      assignedToId: marko?.id ?? null,
    },
  });

  // --- Beleške (M5 §4.6) ---
  await prisma.bookingNote.createMany({
    data: [
      {
        bookingId: TARGET_BOOKING_ID,
        body: 'Gošća je tražila sobu što dalje od lifta — javljeno hotelu u najavi, čeka se potvrda.',
        createdBy: marko?.id ?? guide.id,
        origin: 'OFFICE',
        createdAt: new Date('2026-06-05T15:10:00Z'),
      },
      {
        bookingId: TARGET_BOOKING_ID,
        body: 'Depozit uplaćen, poslat vaučer na mejl gošće.',
        createdBy: marko?.id ?? guide.id,
        origin: 'OFFICE',
        createdAt: new Date('2026-06-06T10:00:00Z'),
      },
      {
        bookingId: TARGET_BOOKING_ID,
        body: 'Gosti stigli, smeštaj bez problema, soba dodeljena po želji (visok sprat, bez lifta u blizini).',
        createdBy: guide.id,
        origin: 'FIELD_REP',
        createdAt: new Date('2026-08-10T15:30:00Z'),
      },
    ],
  });

  // --- Uplate (M10) ---
  await prisma.payment.createMany({
    data: [
      {
        bookingId: TARGET_BOOKING_ID,
        amount: 40000,
        currency: 'EUR',
        method: 'BANK_TRANSFER',
        status: 'RECEIVED',
        reference: `${MOCK_MARKER}-UP-4471`,
        receivedAt: new Date('2026-06-06T09:30:00Z'),
        recordedBy: marko?.id,
      },
      {
        bookingId: TARGET_BOOKING_ID,
        amount: 30000,
        currency: 'EUR',
        method: 'CARD',
        status: 'PENDING',
        reference: `${MOCK_MARKER}-UP-5120`,
        recordedBy: marko?.id,
      },
    ],
  });

  // --- Komunikacija (M6, vezana za nalogodavca — M5 §4.5 poznato ograničenje) ---
  await prisma.communicationLog.createMany({
    data: [
      {
        clientAccountId: clientAccount.id,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        category: 'TRANSAKCIONO',
        summary: 'Poslata potvrda rezervacije i vaučer za Sitoniju (10–17.8.2026).',
        sentBy: marko?.id ?? null,
        createdAt: new Date('2026-06-05T15:07:00Z'),
      },
      {
        clientAccountId: clientAccount.id,
        channel: 'PHONE',
        direction: 'INBOUND',
        category: 'TRANSAKCIONO',
        summary: 'Gošća pitala za mogućnost sobe dalje od lifta — prosleđeno hotelu.',
        sentBy: marko?.id ?? null,
        createdAt: new Date('2026-06-05T15:12:00Z'),
      },
      {
        clientAccountId: clientAccount.id,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        category: 'MARKETING',
        summary: 'Poslata ponuda za rani rezervacioni popust za leto 2027.',
        sentBy: 'SYSTEM_AUTO',
        draftedByAi: true,
        createdAt: new Date('2026-07-01T08:00:00Z'),
      },
    ],
  });

  // --- Ugovor sa klijentom (M20) ---
  await prisma.clientContract.create({
    data: {
      bookingId: TARGET_BOOKING_ID,
      contractType: 'ORGANIZOVANO_PUTOVANJE',
      status: 'ACCEPTED',
      documentUrl: 'https://cdn.terminal-travel.local/ugovori/mock-dossier-demo.pdf',
      generatedAt: new Date('2026-06-05T15:06:00Z'),
      acceptedAt: new Date('2026-06-05T15:08:00Z'),
      acceptedMethod: 'ELECTRONIC_CLICKWRAP',
      contentSnapshot: {
        buyerName: 'Jovana Marković',
        totalPrice,
        currency: 'EUR',
        destination: 'Nikiti, Sitonija, Halkidiki, Grčka',
        stayFrom: stayFrom.toISOString(),
        stayTo: stayTo.toISOString(),
      },
    },
  });

  // --- Garancija putovanja (M11) ---
  await prisma.travelGuaranteeRegistration.upsert({
    where: { bookingId: TARGET_BOOKING_ID },
    update: { status: 'REGISTERED', cisRegistrationNumber: 'CIS-2026-0088341', registeredAt: new Date('2026-06-05T15:09:00Z') },
    create: {
      bookingId: TARGET_BOOKING_ID,
      status: 'REGISTERED',
      cisRegistrationNumber: 'CIS-2026-0088341',
      registeredAt: new Date('2026-06-05T15:09:00Z'),
    },
  });

  // --- Reklamacija / tiket (M14) ---
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `${MOCK_MARKER}-2026-000512`,
      requesterClientAccountId: clientAccount.id,
      requesterType: 'GUEST',
      relatedBookingId: TARGET_BOOKING_ID,
      subject: 'Klima uređaj u sobi ne radi',
      category: 'REKLAMACIJA',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      channel: 'EMAIL',
      assignedTo: marko?.id,
      zzpResponseDeadline: new Date('2026-08-19T00:00:00Z'),
      createdAt: new Date('2026-08-11T09:00:00Z'),
    },
  });
  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: ticket.id,
        senderType: 'REQUESTER',
        body: 'Poštovani, klima u sobi 214 ne hladi od jutros. Molimo da se hitno reši, veoma je toplo.',
        createdAt: new Date('2026-08-11T09:00:00Z'),
      },
      {
        ticketId: ticket.id,
        senderType: 'STAFF',
        senderId: marko?.id,
        body: 'Kontaktirali smo hotel, tehničar dolazi danas do 14h. Javićemo čim se reši.',
        sentBy: marko?.id,
        createdAt: new Date('2026-08-11T09:40:00Z'),
      },
    ],
  });

  // --- Predstavnik na terenu (M9) — prijave za oba gosta na hotelskoj stavci ---
  await prisma.fieldCheckIn.deleteMany({ where: { bookingItemGuestId: { in: hotelItem.guests.map((g) => g.id) } } });
  for (const g of hotelItem.guests) {
    await prisma.fieldCheckIn.create({
      data: {
        id: `${MOCK_MARKER}-checkin-${g.id}`,
        bookingItemGuestId: g.id,
        checkedInAt: new Date('2026-08-10T15:15:00Z'),
        checkedInBy: guide.id,
        syncedAt: new Date('2026-08-10T15:20:00Z'),
      },
    });
  }

  // --- Tok rezervacije (dugme "Istorija" na dosijeu, M1 AuditLogEntry preko GET
  // /sales/bookings/:id/history) — `audit_log_entries` je append-only (DB trigger odbija
  // DELETE/UPDATE, vidi mock-booking-dossier-clean.ts), pa se ovde NE briše na ponovno
  // pokretanje, samo proverava da li zapis već postoji (isti obrazac kao ostale idempotentne
  // create-grane iznad — `upsert`/`findFirst`). Iste `action` vrednosti kao stvarni servisni
  // pozivi (BookingsService.confirm/updatePaymentStatus) da modal ne pokazuje ništa što stvaran
  // tok nikad ne bi proizveo.
  const timelineDefs: { action: string; timestamp: Date; beforeState?: object; afterState?: object; context: object }[] = [
    {
      action: 'booking.confirmed',
      timestamp: new Date('2026-06-05T15:05:00Z'),
      afterState: { status: 'CONFIRMED', totalPrice, currency: 'EUR' },
      context: { quoteId: `${MOCK_MARKER}-quote-mock` },
    },
    {
      action: 'booking.payment_status_changed',
      timestamp: new Date('2026-06-06T09:31:00Z'),
      beforeState: { paymentStatus: 'UNPAID' },
      afterState: { paymentStatus: 'PARTIALLY_PAID' },
      context: {},
    },
  ];
  for (const def of timelineDefs) {
    const exists = await prisma.auditLogEntry.findFirst({
      where: { resourceType: 'Booking', resourceId: TARGET_BOOKING_ID, action: def.action },
    });
    if (exists) continue;
    await prisma.auditLogEntry.create({
      data: {
        timestamp: def.timestamp,
        actorType: 'HUMAN',
        actorId: marko?.id ?? null,
        module: 'M5',
        action: def.action,
        resourceType: 'Booking',
        resourceId: TARGET_BOOKING_ID,
        beforeState: def.beforeState,
        afterState: def.afterState,
        context: def.context,
      },
    });
  }

  console.log(`Gotovo. Rezervacija ${TARGET_BOOKING_ID} popunjena mock podacima za sve tabove.`);
  console.log(`http://localhost:3100/rezervacije/${TARGET_BOOKING_ID}?tab=pregled`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
