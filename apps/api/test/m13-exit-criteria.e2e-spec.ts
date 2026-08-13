import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { EventBusService } from '../src/common/events/event-bus.service';
import { FactSyncService } from '../src/modules/m13-bi/sync/fact-sync.service';
import { ReconciliationService } from '../src/modules/m13-bi/reconciliation/reconciliation.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M13 izlaznog kriterijuma
 * (docs/moduli/M13-bi/13-SPECIFIKACIJA-M13-BI.md poglavlje 8).
 */
describe('M13 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let eventBus: EventBusService;
  let factSync: FactSyncService;
  let reconciliation: ReconciliationService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdSubagentIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdPaymentIds: string[] = [];

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    eventBus = app.get(EventBusService);
    factSync = app.get(FactSyncService);
    reconciliation = app.get(ReconciliationService);
  });

  afterAll(async () => {
    await wait(300);
    if (createdBookingIds.length) {
      await prisma.factBooking.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.factPayment.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      // booking.confirmed (emitovan ili preko M5 automatike) triggeruje M11/M20 pretplatnike —
      // isti FK cleanup redosled kao M7/M14 e2e testovi.
      await prisma.travelGuaranteeRegistration.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.clientContract.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: { in: createdBookingIds } } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdSubagentIds.length) await prisma.subagent.deleteMany({ where: { id: { in: createdSubagentIds } } });
    if (createdClientAccountIds.length) await prisma.clientAccount.deleteMany({ where: { id: { in: createdClientAccountIds } } });
    if (createdProductIds.length) await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    if (createdContractIds.length) await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    if (createdSupplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdMarkupRuleIds.length) await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m13-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M13 Test Korisnik',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, accessToken };
  }

  function authed(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function createClientAccount() {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'INDIVIDUAL',
        fullName: `M13 Test Nalogodavac ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `client-m13-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
      },
    });
    createdClientAccountIds.push(account.id);
    return account;
  }

  async function createBooking(clientAccountId: string, overrides: Partial<{ channel: string; totalPrice: number; currency: string }> = {}) {
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M13-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId,
        buyerName: 'M13 Test Gost',
        buyerType: 'FIZICKO_LICE',
        channel: (overrides.channel as any) ?? 'B2C_SITE',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: overrides.totalPrice ?? 24000,
        currency: overrides.currency ?? 'RSD',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  // Supplier + Contract + ACCOMMODATION Product (CONTRACTED) + ContractPeriod + RateLine.
  async function createContractedProductFixture(overrides: { destinationCountry?: string; destinationCity?: string; roomType?: string; boardType?: string; stars?: number } = {}) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M13 E2E Dobavljač ${testRunId}-${Math.random().toString(36).slice(2)}`,
        type: 'HOTEL',
        taxId: `TAX-M13-${testRunId}-${Math.random().toString(36).slice(2)}`,
        registrationNumber: `REG-M13-${testRunId}-${Math.random().toString(36).slice(2)}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m13-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M13-${testRunId}-${Math.random().toString(36).slice(2)}`,
        currency: 'EUR',
        validFrom: new Date('2027-01-01'),
        validTo: new Date('2027-12-31'),
        cancellationTermsSummary: 'e2e test',
        documentUrl: 'mock://doc.pdf',
        status: 'ACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
      },
    });
    createdContractIds.push(contract.id);

    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: overrides.destinationCountry ?? 'RS',
        destinationCity: overrides.destinationCity ?? 'Zlatibor',
        status: 'ACTIVE',
        attributes: { accommodation_type: 'HOTEL', stars: overrides.stars ?? 4 },
        translations: {
          create: [{ languageCode: 'sr', name: `Hotel M13 Test ${testRunId}`, description: 'opis', slug: `hotel-m13-${testRunId}-${Math.random().toString(36).slice(2)}` }],
        },
      },
    });
    createdProductIds.push(product.id);

    const contractPeriod = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-09-01'),
        roomType: overrides.roomType ?? 'STD',
        allotmentMode: 'ON_REQUEST',
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: { contractPeriodId: contractPeriod.id, boardType: overrides.boardType ?? 'HALF_BOARD', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: 10000 },
    });

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { supplier, contract, product, rateLine, markupRule };
  }

  // API-sourced ACCOMMODATION Product (M4) — nema rate_line/room_type/board_type (§3.1 ograda).
  async function createApiProductFixture(overrides: { destinationCountry?: string; destinationCity?: string } = {}) {
    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'API',
        sourceProvider: 'travelgate',
        destinationCountry: overrides.destinationCountry ?? 'ES',
        destinationCity: overrides.destinationCity ?? 'Barcelona',
        status: 'ACTIVE',
        attributes: { accommodation_type: 'HOTEL', stars: 3 },
        translations: {
          create: [{ languageCode: 'sr', name: `API Hotel M13 Test ${testRunId}`, description: 'opis', slug: `api-hotel-m13-${testRunId}-${Math.random().toString(36).slice(2)}` }],
        },
      },
    });
    createdProductIds.push(product.id);
    return { product };
  }

  async function createBookingItem(
    bookingId: string,
    fixture: { product: { id: string }; rateLine?: { id: string }; markupRule?: { id: string } },
    overrides: Partial<{ baseCost: number; finalPrice: number; guestCount: number; sourceType: 'CONTRACTED' | 'API' }> = {},
  ) {
    const item = await prisma.bookingItem.create({
      data: {
        bookingId,
        productId: fixture.product.id,
        sourceType: overrides.sourceType ?? (fixture.rateLine ? 'CONTRACTED' : 'API'),
        supplierReference: 'e2e',
        stayFrom: new Date('2027-06-10'),
        stayTo: new Date('2027-06-14'), // 4 noći
        baseCost: overrides.baseCost ?? 10000,
        baseCostCurrency: 'EUR',
        rateLineId: fixture.rateLine?.id,
        markupRuleId: fixture.markupRule?.id ?? (await ensureFallbackMarkupRule(fixture.product.id)),
        finalPrice: overrides.finalPrice ?? 12000,
        finalPriceCurrency: 'EUR',
        itemStatus: 'CONFIRMED',
      },
    });
    const guestCount = overrides.guestCount ?? 2;
    for (let i = 0; i < guestCount; i++) {
      await prisma.bookingItemGuest.create({
        data: { bookingItemId: item.id, guestFirstName: `Gost${i}`, guestLastName: `M13-${testRunId}` },
      });
    }
    return item;
  }

  async function ensureFallbackMarkupRule(productId: string) {
    const rule = await prisma.markupRule.create({ data: { scopeType: 'M2_PRODUCT', scopeId: productId, percentage: 15 } });
    createdMarkupRuleIds.push(rule.id);
    return rule.id;
  }

  describe('§8 — profitabilnost po destinaciji/dobavljaču/kanalu, sa tačnim margin izračunom', () => {
    it('booking.confirmed sinhronizuje FactBooking preko Event Bus-a; profitabilnost grupiše ispravno i vraća last_synced_at', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const account = await createClientAccount();
      const booking = await createBooking(account.id, { channel: 'B2C_SITE' });
      const fixture = await createContractedProductFixture({ destinationCountry: 'RS', destinationCity: 'Zlatibor-Profit' });
      await createBookingItem(booking.id, fixture, { baseCost: 10000, finalPrice: 12000 });

      await eventBus.emit('M5', 'booking.confirmed', { bookingId: booking.id, bookingNumber: booking.bookingNumber });
      await wait(500);

      const fact = await prisma.factBooking.findFirst({ where: { bookingId: booking.id } });
      expect(fact).not.toBeNull();
      expect(fact!.margin).toBe(2000); // 12000 - 10000
      expect(fact!.supplierName).toBe(fixture.supplier.name);
      expect(fact!.lastSyncedAt).not.toBeNull();

      const res = await request(app.getHttpServer())
        .get('/api/v1/bi/reports/profitability')
        .query({ destinationCountry: 'RS', destinationCity: 'Zlatibor-Profit' })
        .set(authed(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.lastSyncedAt).not.toBeNull();
      const destBucket = res.body.byDestination.find((b: any) => b.key.includes('Zlatibor-Profit'));
      expect(destBucket).toBeDefined();
      expect(destBucket.margin).toBeGreaterThanOrEqual(2000);
      const supplierBucket = res.body.bySupplier.find((b: any) => b.key === fixture.supplier.name);
      expect(supplierBucket).toBeDefined();
      const channelBucket = res.body.byChannel.find((b: any) => b.key === 'B2C_SITE');
      expect(channelBucket).toBeDefined();
    });

    it('korisnik bez report:profitability/VIEW dobija 403', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const res = await request(app.getHttpServer()).get('/api/v1/bi/reports/profitability').set(authed(accessToken));
      expect(res.status).toBe(403);
    });
  });

  describe('§8 — gubitak pojedinačnog događaja se ispravlja narednom noćnom rekonsilijacijom', () => {
    it('BookingItem kreirana bez emitovanog Event Bus događaja (simulacija izgubljenog eventa) nema FactBooking dok se ne pokrene rekonsilijacija', async () => {
      const account = await createClientAccount();
      const booking = await createBooking(account.id, { channel: 'B2B_PORTAL' });
      const fixture = await createContractedProductFixture({ destinationCountry: 'RS', destinationCity: 'Zlatibor-Recon' });
      const item = await createBookingItem(booking.id, fixture, { baseCost: 8000, finalPrice: 9500 });

      // Namerno NE emitujemo booking.confirmed — simulira izgubljen Event Bus događaj.
      const missing = await prisma.factBooking.findUnique({ where: { bookingItemId: item.id } });
      expect(missing).toBeNull();

      const result = await reconciliation.reconcile();
      expect(result.bookingsChecked).toBeGreaterThan(0);

      const recovered = await prisma.factBooking.findUnique({ where: { bookingItemId: item.id } });
      expect(recovered).not.toBeNull();
      expect(recovered!.margin).toBe(1500);
    });

    it('POST /bi/reconciliation/run (Vlasnik/Direktor) pokreće istu proveru ručno preko API-ja', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const res = await request(app.getHttpServer()).post('/api/v1/bi/reconciliation/run').set(authed(accessToken));
      expect(res.status).toBe(201);
      expect(res.body.ranAt).toBeDefined();
    });
  });

  describe('§8 — brisanje cele M13 projekcije i rekonstrukcija daje identičan rezultat', () => {
    it('rebuildAll() posle brisanja daje isti FactBooking red za postojeću stavku', async () => {
      const account = await createClientAccount();
      const booking = await createBooking(account.id);
      const fixture = await createContractedProductFixture({ destinationCountry: 'RS', destinationCity: 'Zlatibor-Rebuild' });
      const item = await createBookingItem(booking.id, fixture, { baseCost: 7000, finalPrice: 8400 });
      await factSync.syncBookingItem(item.id);

      const before = await prisma.factBooking.findUniqueOrThrow({ where: { bookingItemId: item.id } });

      await factSync.rebuildAll();

      const after = await prisma.factBooking.findUniqueOrThrow({ where: { bookingItemId: item.id } });
      expect(after.margin).toBe(before.margin);
      expect(after.destinationCity).toBe(before.destinationCity);
      expect(after.supplierName).toBe(before.supplierName);
      expect(after.status).toBe(before.status);
      expect(after.bookingId).toBe(before.bookingId);
    });
  });

  describe('§8 — Operativna statistika smeštaja: broj osoba, noćenja, prodate sobe (ukupno i po dimenzijama)', () => {
    it('agregira ispravno preko CONTRACTED i API stavki, sa jasnom naznakom nerazvrstanih', async () => {
      const account = await createClientAccount();
      const booking = await createBooking(account.id);
      const contractedFixture = await createContractedProductFixture({ destinationCountry: 'IT', destinationCity: 'Rim', roomType: 'DELUXE', boardType: 'ALL_INCLUSIVE', stars: 5 });
      const contractedItem = await createBookingItem(booking.id, contractedFixture, { guestCount: 3 });

      const apiFixture = await createApiProductFixture({ destinationCountry: 'IT', destinationCity: 'Rim' });
      const apiItem = await createBookingItem(booking.id, apiFixture, { guestCount: 2, sourceType: 'API' });

      await factSync.syncBookingItem(contractedItem.id);
      await factSync.syncBookingItem(apiItem.id);

      const res = await (async () => {
        const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
        return request(app.getHttpServer())
          .get('/api/v1/bi/reports/occupancy')
          .query({ destinationCountry: 'IT', destinationCity: 'Rim', group_by: 'room_type' })
          .set(authed(accessToken));
      })();

      expect(res.status).toBe(200);
      expect(res.body.guestCount).toBe(5); // 3 + 2
      expect(res.body.nights).toBe(5 * 4); // (3+2) gostiju * 4 noći
      expect(res.body.soldUnitsTotal).toBe(2); // obe ACCOMMODATION stavke
      expect(res.body.unclassifiedCount).toBe(1); // API stavka nema room_type
      const deluxeBucket = res.body.breakdown.find((b: any) => b.key === 'DELUXE');
      expect(deluxeBucket).toBeDefined();
      expect(deluxeBucket.count).toBe(1);
    });

    it('board_type/stars/accommodation_type grupisanje radi ispravno', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const boardRes = await request(app.getHttpServer())
        .get('/api/v1/bi/reports/occupancy')
        .query({ destinationCountry: 'IT', destinationCity: 'Rim', group_by: 'board_type' })
        .set(authed(accessToken));
      expect(boardRes.status).toBe(200);
      expect(boardRes.body.breakdown.some((b: any) => b.key === 'ALL_INCLUSIVE')).toBe(true);

      const starsRes = await request(app.getHttpServer())
        .get('/api/v1/bi/reports/occupancy')
        .query({ destinationCountry: 'IT', destinationCity: 'Rim', group_by: 'stars' })
        .set(authed(accessToken));
      expect(starsRes.status).toBe(200);
      expect(starsRes.body.breakdown.some((b: any) => b.key === '5')).toBe(true);

      const accTypeRes = await request(app.getHttpServer())
        .get('/api/v1/bi/reports/occupancy')
        .query({ destinationCountry: 'IT', destinationCity: 'Rim', group_by: 'accommodation_type' })
        .set(authed(accessToken));
      expect(accTypeRes.status).toBe(200);
      expect(accTypeRes.body.breakdown.some((b: any) => b.key === 'HOTEL')).toBe(true);
    });
  });

  describe('§8 — dinamički izveštaj gradi stablo tačnim redosledom dimenzija sa revenue/paid/balance', () => {
    it('destination_country → channel, sa uplatom evidentiranom u FactPayment', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const account = await createClientAccount();
      const booking = await createBooking(account.id, { channel: 'B2C_SITE' });
      const fixture = await createContractedProductFixture({ destinationCountry: 'FR', destinationCity: 'Pariz' });
      const item = await createBookingItem(booking.id, fixture, { baseCost: 10000, finalPrice: 15000 });
      await factSync.syncBookingItem(item.id);

      const payment = await prisma.payment.create({
        data: { bookingId: booking.id, amount: 6000, currency: 'RSD', method: 'BANK_TRANSFER', status: 'RECEIVED', receivedAt: new Date(), recordedBy: 'e2e-test' },
      });
      createdPaymentIds.push(payment.id);
      await factSync.syncPayment(payment.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/bi/reports/dynamic')
        .query({ group_by: 'destination_country,channel' })
        .set(authed(accessToken));
      expect(res.status).toBe(200);

      const frNode = res.body.tree.find((n: any) => n.key === 'FR');
      expect(frNode).toBeDefined();
      const b2cChild = frNode.children.find((c: any) => c.key === 'B2C_SITE');
      expect(b2cChild).toBeDefined();
      expect(b2cChild.revenue).toBeGreaterThanOrEqual(15000);
      expect(b2cChild.paid).toBeGreaterThanOrEqual(6000);
      expect(b2cChild.balance).toBe(b2cChild.revenue - b2cChild.paid);
    });

    it('nepoznata dimenzija u group_by vraća 400', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const res = await request(app.getHttpServer()).get('/api/v1/bi/reports/dynamic').query({ group_by: 'ne_postoji' }).set(authed(accessToken));
      expect(res.status).toBe(400);
    });
  });

  describe('§8 — marketing izveštaj razdvaja atribuisane rezervacije od "bez poznatog porekla"', () => {
    it('rezervacija bez referral_tracking_code se prikazuje odvojeno, ne meša se u agregat po sadržaju', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const account = await createClientAccount();
      const booking = await createBooking(account.id); // bez referralTrackingCode
      const fixture = await createContractedProductFixture({ destinationCountry: 'GR', destinationCity: 'Solun' });
      const item = await createBookingItem(booking.id, fixture, { baseCost: 5000, finalPrice: 6000 });
      await factSync.syncBookingItem(item.id);

      const fact = await prisma.factBooking.findUniqueOrThrow({ where: { bookingItemId: item.id } });
      expect(fact.referralContentId).toBeNull(); // M12 ne postoji — trajno null (spec §4.3)

      const res = await request(app.getHttpServer()).get('/api/v1/bi/reports/marketing').set(authed(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.withoutKnownOrigin.count).toBeGreaterThanOrEqual(1);
      expect(res.body.byContent.every((b: any) => b.key !== null)).toBe(true);
      expect(res.body.attributedShare).toBeLessThanOrEqual(1);
    });
  });
});
