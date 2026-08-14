import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

/**
 * E2E protiv prave Postgres baze — pokriva stavke 1-4 M9 izlaznog kriterijuma
 * (docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md poglavlje 8):
 * itinerar/liste gostiju/vaučeri vodiča, offline sinhronizacija bez duplikata, URGENT
 * upozorenje, vidljivost isključivo sopstvenog itinerara. Stavke 5-6 (gost API isti kao M8,
 * prikaz na telefonu/tabletu) čekaju M9 mobilni klijent (React Native) — nisu ovde testirane,
 * backend za njih ne uvodi sopstvenu logiku (poglavlje 2 spec-a).
 */
describe('M9 — izlazni kriterijum (e2e, deo za vodiče)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdFieldCheckInIds: string[] = [];
  const createdFieldIncidentNoteIds: string[] = [];
  const createdGuestProfileIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    if (createdFieldCheckInIds.length) await prisma.fieldCheckIn.deleteMany({ where: { id: { in: createdFieldCheckInIds } } });
    if (createdFieldIncidentNoteIds.length) await prisma.fieldIncidentNote.deleteMany({ where: { id: { in: createdFieldIncidentNoteIds } } });
    if (createdBookingIds.length) {
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: { in: createdBookingIds } } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdGuestProfileIds.length) await prisma.guestProfile.deleteMany({ where: { id: { in: createdGuestProfileIds } } });
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

  async function createGuideUser() {
    const user = await prisma.user.create({
      data: {
        email: `m9-vodic-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M9 Test Vodič',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.VODIC } });
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
        fullName: `M9 Test Nalogodavac ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `client-m9-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
      },
    });
    createdClientAccountIds.push(account.id);
    return account;
  }

  // Supplier + Contract + Product (ACCOMMODATION) + MarkupRule — minimalna fixture za BookingItem
  // (isti obrazac kao M6/M13 e2e testovi).
  async function createProductFixture() {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M9 E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-M9-${testRunId}`,
        registrationNumber: `REG-M9-${testRunId}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m9-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M9-${testRunId}`,
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
        type: 'EXCURSION',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: 'RS',
        destinationCity: 'Zlatibor',
        status: 'ACTIVE',
      },
    });
    createdProductIds.push(product.id);

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { product, markupRule };
  }

  // Booking + BookingItem sa assigned_guide_id + BookingItemGuest (+ GuestProfile) — jedan
  // dodeljen "polazak" vodiča, u periodu [stayFrom, stayTo].
  async function createAssignedItinerary(guideUserId: string, stayFrom: Date, stayTo: Date) {
    const account = await createClientAccount();
    const { product, markupRule } = await createProductFixture();

    const guestProfile = await prisma.guestProfile.create({
      data: {
        fullName: 'Marko Marković',
        documentType: 'PASSPORT',
        documentNumber: `DOC-M9-${testRunId}-${Math.random().toString(36).slice(2)}`,
        nationality: 'RS',
        dateOfBirth: new Date('1990-01-01'),
        email: 'marko@tt-test.rs',
        phone: '+381601234567',
        preferences: { alergije: 'orasi' },
        linkedClientAccountId: account.id,
      },
    });
    createdGuestProfileIds.push(guestProfile.id);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M9-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: account.id,
        buyerName: 'M9 Test Gost',
        buyerType: 'FIZICKO_LICE',
        channel: 'B2C_SITE',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        totalPrice: 15000,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
        voucherUrl: `https://vouchers.internal.terminal-travel/e2e-${testRunId}.pdf`,
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: 'e2e',
              stayFrom,
              stayTo,
              baseCost: 10000,
              baseCostCurrency: 'EUR',
              markupRuleId: markupRule.id,
              finalPrice: 12000,
              finalPriceCurrency: 'EUR',
              itemStatus: 'CONFIRMED',
              assignedGuideId: guideUserId,
              guests: { create: [{ guestFirstName: 'Marko', guestLastName: 'Marković', guestProfileId: guestProfile.id }] },
            },
          ],
        },
      },
      include: { items: { include: { guests: true } } },
    });
    createdBookingIds.push(booking.id);
    return { booking, bookingItem: booking.items[0], guestProfile };
  }

  describe('§8 stavka 1 — vodič vidi itinerar, listu gostiju i vaučer preuzet unapred', () => {
    it('GET /mobile/staff/my-itinerary vraća dodeljeni polazak sa gostima i vaučerom', async () => {
      const { accessToken, user } = await createGuideUser();
      const from = new Date('2027-06-01');
      const to = new Date('2027-06-30');
      const { booking, bookingItem } = await createAssignedItinerary(user.id, new Date('2027-06-10'), new Date('2027-06-15'));

      const res = await request(app.getHttpServer())
        .get('/api/v1/mobile/staff/my-itinerary')
        .query({ from: from.toISOString(), to: to.toISOString() })
        .set(authed(accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      const item = res.body[0];
      expect(item.bookingItemId).toBe(bookingItem.id);
      expect(item.bookingId).toBe(booking.id);
      expect(item.voucherUrl).toBe(booking.voucherUrl);
      expect(item.guests).toHaveLength(1);
      expect(item.guests[0]).toMatchObject({
        bookingItemGuestId: bookingItem.guests[0].id,
        firstName: 'Marko',
        lastName: 'Marković',
        email: 'marko@tt-test.rs',
        phone: '+381601234567',
      });
      expect(item.guests[0].preferences).toMatchObject({ alergije: 'orasi' });
    });
  });

  describe('§8 stavka 4 — vodič vidi isključivo sopstveni dodeljeni itinerar', () => {
    it('drugi vodič ne vidi tuđ polazak (dva vodiča, svaki dobija samo svoje)', async () => {
      const { accessToken: tokenA, user: guideA } = await createGuideUser();
      const { accessToken: tokenB, user: guideB } = await createGuideUser();
      const from = new Date('2027-07-01');
      const to = new Date('2027-07-31');

      const { bookingItem: itemA } = await createAssignedItinerary(guideA.id, new Date('2027-07-05'), new Date('2027-07-08'));
      const { bookingItem: itemB } = await createAssignedItinerary(guideB.id, new Date('2027-07-10'), new Date('2027-07-12'));

      const resA = await request(app.getHttpServer())
        .get('/api/v1/mobile/staff/my-itinerary')
        .query({ from: from.toISOString(), to: to.toISOString() })
        .set(authed(tokenA));
      expect(resA.body.map((i: any) => i.bookingItemId)).toEqual([itemA.id]);

      const resB = await request(app.getHttpServer())
        .get('/api/v1/mobile/staff/my-itinerary')
        .query({ from: from.toISOString(), to: to.toISOString() })
        .set(authed(tokenB));
      expect(resB.body.map((i: any) => i.bookingItemId)).toEqual([itemB.id]);
    });

    it('korisnik bez VODIC uloge ne sme da pristupi (403)', async () => {
      const user = await prisma.user.create({
        data: {
          email: `m9-nevodic-${testRunId}@tt-test.rs`,
          fullName: 'M9 Test Bez Uloge',
          accountType: 'STAFF',
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(user.id);
      const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/mobile/staff/my-itinerary')
        .query({ from: '2027-01-01', to: '2027-12-31' })
        .set(authed(accessToken));
      expect(res.status).toBe(403);
    });
  });

  describe('§8 stavka 2 — offline sinhronizacija bez duplikata', () => {
    it('POST /mobile/staff/sync — FieldCheckIn se upiše; ponovljen isti idempotency ključ ne pravi duplikat', async () => {
      const { accessToken, user } = await createGuideUser();
      const { bookingItem } = await createAssignedItinerary(user.id, new Date('2027-08-01'), new Date('2027-08-05'));
      const checkInId = randomUUID();
      createdFieldCheckInIds.push(checkInId);
      const checkedInAt = new Date('2027-08-01T10:00:00.000Z').toISOString();

      const first = await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({ checkIns: [{ id: checkInId, bookingItemGuestId: bookingItem.guests[0].id, checkedInAt }] });
      expect(first.status).toBe(201);
      expect(first.body.checkIns).toHaveLength(1);
      expect(first.body.checkIns[0].id).toBe(checkInId);
      expect(first.body.checkIns[0].syncedAt).not.toBeNull();

      const countAfterFirst = await prisma.fieldCheckIn.count({ where: { id: checkInId } });
      expect(countAfterFirst).toBe(1);

      // isti idempotency ključ, ponovljen zahtev (npr. mreža prekinuta pre potvrde na uređaju).
      const second = await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({ checkIns: [{ id: checkInId, bookingItemGuestId: bookingItem.guests[0].id, checkedInAt }] });
      expect(second.status).toBe(201);

      const countAfterSecond = await prisma.fieldCheckIn.count({ where: { id: checkInId } });
      expect(countAfterSecond).toBe(1); // i dalje tačno jedan zapis — nema duplikata

      const stored = await prisma.fieldCheckIn.findUniqueOrThrow({ where: { id: checkInId } });
      expect(stored.checkedInBy).toBe(user.id);
    });

    it('M1 audit log dobija zapis za svaku sinhronizovanu promenu (§3.2)', async () => {
      const { accessToken, user } = await createGuideUser();
      const { bookingItem } = await createAssignedItinerary(user.id, new Date('2027-08-10'), new Date('2027-08-12'));
      const checkInId = randomUUID();
      createdFieldCheckInIds.push(checkInId);

      await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({ checkIns: [{ id: checkInId, bookingItemGuestId: bookingItem.guests[0].id, checkedInAt: new Date().toISOString() }] });

      const auditEntries = await prisma.auditLogEntry.findMany({ where: { module: 'M9', resourceType: 'FieldCheckIn', resourceId: checkInId } });
      expect(auditEntries.length).toBeGreaterThanOrEqual(1);
      expect(auditEntries[0].actorId).toBe(user.id);
    });
  });

  describe('§8 stavka 3 — URGENT beleška odmah generiše vidljivo upozorenje timu po sinhronizaciji', () => {
    it('POST /mobile/staff/sync sa severity=URGENT upisuje FieldIncidentNote i piše audit log field_incident.urgent_alert', async () => {
      const { accessToken, user } = await createGuideUser();
      const { booking } = await createAssignedItinerary(user.id, new Date('2027-09-01'), new Date('2027-09-05'));
      const noteId = randomUUID();
      createdFieldIncidentNoteIds.push(noteId);

      const res = await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({
          incidentNotes: [
            { id: noteId, bookingId: booking.id, note: 'Autobus u kvaru, kasnimo 2h', severity: 'URGENT', createdAt: new Date().toISOString() },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.incidentNotes).toHaveLength(1);
      expect(res.body.incidentNotes[0].severity).toBe('URGENT');
      expect(res.body.incidentNotes[0].syncedAt).not.toBeNull();

      const alertEntries = await prisma.auditLogEntry.findMany({
        where: { module: 'M9', action: 'field_incident.urgent_alert', resourceId: noteId },
      });
      expect(alertEntries).toHaveLength(1);

      // ponovljena sinhronizacija (isti idempotency ključ, već synced) ne šalje upozorenje ponovo.
      await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({
          incidentNotes: [
            { id: noteId, bookingId: booking.id, note: 'Autobus u kvaru, kasnimo 2h', severity: 'URGENT', createdAt: new Date().toISOString() },
          ],
        });
      const alertEntriesAfterResync = await prisma.auditLogEntry.findMany({
        where: { module: 'M9', action: 'field_incident.urgent_alert', resourceId: noteId },
      });
      expect(alertEntriesAfterResync).toHaveLength(1);

      const stored = await prisma.fieldIncidentNote.findUniqueOrThrow({ where: { id: noteId } });
      expect(stored.severity).toBe('URGENT');
      expect(stored.guideId).toBe(user.id);
    });

    it('INFO beleška se sinhronizuje bez urgent_alert audit zapisa', async () => {
      const { accessToken, user } = await createGuideUser();
      const { booking } = await createAssignedItinerary(user.id, new Date('2027-09-10'), new Date('2027-09-12'));
      const noteId = randomUUID();
      createdFieldIncidentNoteIds.push(noteId);

      await request(app.getHttpServer())
        .post('/api/v1/mobile/staff/sync')
        .set(authed(accessToken))
        .send({ incidentNotes: [{ id: noteId, bookingId: booking.id, note: 'Sve u redu', severity: 'INFO', createdAt: new Date().toISOString() }] });

      const alertEntries = await prisma.auditLogEntry.findMany({ where: { module: 'M9', action: 'field_incident.urgent_alert', resourceId: noteId } });
      expect(alertEntries).toHaveLength(0);
    });
  });
});
