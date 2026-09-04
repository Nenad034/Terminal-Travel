/**
 * MOCK LISTA REZERVACIJA — samo za lokalni razvoj, nikad za produkciju.
 *
 * Svrha: `mock-b2c.ts` pravi tačno JEDNU rezervaciju (M5 spec §4.1) — dovoljno za "Moje
 * rezervacije" na sajtu, ali ekran /rezervacije/lista u panelu izgleda prazno/nerealno sa
 * samo jednim redom. Ova skripta pravi ~16 dodatnih rezervacija sa raznovrsnim statusima,
 * kanalima, datumima i tipovima proizvoda — nad VEĆ POSTOJEĆIM katalogom iz
 * `mock-destinacije.ts` (mora se pokrenuti pre ove). Svaka rezervacija dobija bar jednog
 * gosta, belešku i uplatu, da i pojedinačan dosije (klik na red) ima šta da prikaže, ne samo
 * lista.
 *
 * SVE što ova skripta napravi nosi marker `MOCK_MARKER` u broju rezervacije, pa
 * `mock-lista-rezervacija-clean.ts` briše tačno to i ništa drugo. Ne dira `seed.ts` ni
 * `mock-b2c.ts`/`mock-destinacije.ts` — isti obrazac dodatka, ne zamene.
 *
 * Pokretanje (iz apps/api, POSLE mock-destinacije):
 *   npm run seed:mock-lista-rezervacija
 *   npm run seed:mock-lista-rezervacija:clean
 */
import { PrismaClient, BookingStatus, PaymentStatus, M5Channel, BuyerType, TipNastupanja } from '@prisma/client';

const prisma = new PrismaClient();

export const MOCK_MARKER = 'MOCK-LISTA';

const eur = (amount: number) => Math.round(amount * 100);
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const KUPCI = [
  { fullName: 'Marko Jovanović', email: 'marko.jovanovic@mock-lista.tt-demo.rs', phone: '+381 63 111 1001', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Ana Nikolić', email: 'ana.nikolic@mock-lista.tt-demo.rs', phone: '+381 63 111 1002', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Stefan Petrović', email: 'stefan.petrovic@mock-lista.tt-demo.rs', phone: '+381 63 111 1003', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Milica Ilić', email: 'milica.ilic@mock-lista.tt-demo.rs', phone: '+381 63 111 1004', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Nemanja Stojanović', email: 'nemanja.stojanovic@mock-lista.tt-demo.rs', phone: '+381 63 111 1005', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Jelena Marković', email: 'jelena.markovic@mock-lista.tt-demo.rs', phone: '+381 63 111 1006', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Dušan Pavlović', email: 'dusan.pavlovic@mock-lista.tt-demo.rs', phone: '+381 63 111 1007', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Teodora Đorđević', email: 'teodora.djordjevic@mock-lista.tt-demo.rs', phone: '+381 63 111 1008', type: BuyerType.FIZICKO_LICE },
  { fullName: 'Firma Horizont d.o.o.', companyName: 'Horizont d.o.o.', email: 'nabavka@horizont-mock.example', phone: '+381 11 222 2001', type: BuyerType.PRAVNO_LICE, taxId: `${MOCK_MARKER}-PIB-001` },
  { fullName: 'Firma Vektor Trejd d.o.o.', companyName: 'Vektor Trejd d.o.o.', email: 'putovanja@vektor-mock.example', phone: '+381 11 222 2002', type: BuyerType.PRAVNO_LICE, taxId: `${MOCK_MARKER}-PIB-002` },
];

// status/payment/kanal/vremenski raspored — namerno pokriva sve vrednosti BookingStatus i PaymentStatus bar jednom
const PLAN: {
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  channel: M5Channel;
  stayOffsetDays: number;
  createdOffsetDays: number;
}[] = [
  { status: BookingStatus.PENDING_SUPPLIER_CONFIRMATION, paymentStatus: PaymentStatus.UNPAID, channel: M5Channel.INTERNAL_PANEL, stayOffsetDays: 45, createdOffsetDays: -1 },
  { status: BookingStatus.PENDING_SUPPLIER_CONFIRMATION, paymentStatus: PaymentStatus.UNPAID, channel: M5Channel.PHONE, stayOffsetDays: 60, createdOffsetDays: -2 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PARTIALLY_PAID, channel: M5Channel.B2C_SITE, stayOffsetDays: 30, createdOffsetDays: -5 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PARTIALLY_PAID, channel: M5Channel.B2B_PORTAL, stayOffsetDays: 40, createdOffsetDays: -6 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.INTERNAL_PANEL, stayOffsetDays: 20, createdOffsetDays: -10 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.MOBILE, stayOffsetDays: 15, createdOffsetDays: -12 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.INVOICE_PENDING, channel: M5Channel.B2B_PORTAL, stayOffsetDays: 25, createdOffsetDays: -8 },
  { status: BookingStatus.MODIFIED, paymentStatus: PaymentStatus.PARTIALLY_PAID, channel: M5Channel.INTERNAL_PANEL, stayOffsetDays: 35, createdOffsetDays: -14 },
  { status: BookingStatus.MODIFIED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.PHONE, stayOffsetDays: 50, createdOffsetDays: -20 },
  { status: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.UNPAID, channel: M5Channel.B2C_SITE, stayOffsetDays: 18, createdOffsetDays: -15 },
  { status: BookingStatus.CANCELLED, paymentStatus: PaymentStatus.PARTIALLY_PAID, channel: M5Channel.INTERNAL_PANEL, stayOffsetDays: 22, createdOffsetDays: -18 },
  { status: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.B2C_SITE, stayOffsetDays: -14, createdOffsetDays: -60 },
  { status: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.B2B_PORTAL, stayOffsetDays: -21, createdOffsetDays: -75 },
  { status: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.INTERNAL_PANEL, stayOffsetDays: -30, createdOffsetDays: -90 },
  { status: BookingStatus.COMPLETED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.MOBILE, stayOffsetDays: -45, createdOffsetDays: -100 },
  { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID, channel: M5Channel.MCP_AGENT, stayOffsetDays: 70, createdOffsetDays: -3 },
];

async function main() {
  console.log('--- MOCK lista rezervacija ---');

  const vlasnik = await prisma.user.findFirstOrThrow({ where: { email: { in: ['vlasnik@terminal.local', 'vlasnik@terminal-travel.local'] } } });

  const products = await prisma.product.findMany({
    where: { sourceType: 'CONTRACTED', status: 'ACTIVE', type: { in: ['ACCOMMODATION', 'FLIGHT', 'TRANSFER'] } },
    include: { sourceContract: { include: { periods: { include: { rateLines: true } } } } },
    take: 200,
  });
  const usable = products.filter((p) => p.sourceContract?.periods.some((per) => per.rateLines.length > 0));
  if (usable.length < PLAN.length) {
    throw new Error(`Nedovoljno proizvoda sa cenom u katalogu (${usable.length}) — pokreni prvo npm run seed:mock-destinacije`);
  }

  let brojac = 0;
  for (const plan of PLAN) {
    brojac++;
    const kupacDef = KUPCI[brojac % KUPCI.length];
    const product = usable[brojac % usable.length];
    const period = product.sourceContract!.periods.find((per) => per.rateLines.length > 0)!;
    const rateLine = period.rateLines[0];
    const markupRule = await prisma.markupRule.findFirstOrThrow({ where: { scopeId: product.sourceContract!.supplierId } });

    const clientAccount = await prisma.clientAccount.create({
      data: {
        accountType: kupacDef.type === BuyerType.PRAVNO_LICE ? 'LEGAL_ENTITY' : 'INDIVIDUAL',
        fullName: kupacDef.fullName,
        companyName: kupacDef.companyName ?? null,
        email: kupacDef.email,
        phone: kupacDef.phone,
        country: 'Srbija',
        preferredLanguage: 'sr',
      },
    });

    const baseCost = rateLine.price;
    const finalPrice = Math.round(baseCost * 1.18);
    const stayFrom = daysFromNow(plan.stayOffsetDays);
    const stayTo = daysFromNow(plan.stayOffsetDays + 7);
    const createdAt = daysFromNow(plan.createdOffsetDays);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `${MOCK_MARKER}-2026-${String(brojac).padStart(4, '0')}`,
        clientAccountId: clientAccount.id,
        buyerName: kupacDef.fullName,
        buyerType: kupacDef.type,
        buyerTaxId: kupacDef.taxId ?? null,
        channel: plan.channel,
        tipNastupanja: TipNastupanja.ORGANIZATOR,
        status: plan.status,
        paymentStatus: plan.paymentStatus,
        totalPrice: eur(finalPrice / 100),
        currency: 'EUR',
        createdAt,
        confirmedAt: plan.status === BookingStatus.PENDING_SUPPLIER_CONFIRMATION ? null : createdAt,
        cancelledAt: plan.status === BookingStatus.CANCELLED ? daysFromNow(plan.createdOffsetDays + 1) : null,
        createdBy: vlasnik.id,
        ownerId: vlasnik.id,
        assignedToId: vlasnik.id,
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: `${MOCK_MARKER}-SUP-${String(brojac).padStart(4, '0')}`,
              stayFrom,
              stayTo,
              baseCost,
              baseCostCurrency: 'EUR',
              rateLineId: rateLine.id,
              markupRuleId: markupRule.id,
              finalPrice,
              finalPriceCurrency: 'EUR',
              itemStatus: plan.status === BookingStatus.CANCELLED ? 'CANCELLED' : 'CONFIRMED',
              unitCount: 1,
              guests: {
                create: [{ guestFirstName: kupacDef.fullName.split(' ')[0], guestLastName: kupacDef.fullName.split(' ').slice(1).join(' ') || 'Gost' }],
              },
            },
          ],
        },
        notes: {
          create: [
            {
              body: `Automatski mock zapis (${MOCK_MARKER}) — rezervacija kreirana radi prikaza liste u panelu.`,
              createdBy: vlasnik.id,
              origin: 'OFFICE',
            },
          ],
        },
      },
    });

    if (plan.paymentStatus !== PaymentStatus.UNPAID) {
      const iznos = plan.paymentStatus === PaymentStatus.PARTIALLY_PAID ? Math.round(finalPrice * 0.4) : finalPrice;
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: eur(iznos / 100),
          currency: 'EUR',
          method: 'BANK_TRANSFER',
          status: plan.paymentStatus === PaymentStatus.INVOICE_PENDING ? 'PENDING' : 'RECEIVED',
          receivedAt: plan.paymentStatus === PaymentStatus.INVOICE_PENDING ? null : createdAt,
          recordedBy: vlasnik.id,
        },
      });
    }

    console.log(`  ${booking.bookingNumber} — ${plan.status}/${plan.paymentStatus} (${plan.channel})`);
  }

  console.log(`\nGotovo — ${PLAN.length} rezervacija. Otvori /rezervacije/lista u panelu.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
