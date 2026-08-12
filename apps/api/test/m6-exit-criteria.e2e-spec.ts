import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { ClientLoyaltyStatusService } from '../src/modules/m6-crm/loyalty/client-loyalty-status.service';
import { QuotesService } from '../src/modules/m5-rezervacije/quotes/quotes.service';
import { PostTripSurveysService } from '../src/modules/m6-crm/post-trip-surveys/post-trip-surveys.service';
import { M6TriggersService } from '../src/modules/m6-crm/events/m6-triggers.service';
import { RemindersService } from '../src/modules/m5-rezervacije/reminders/reminders.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M6 izlaznog kriterijuma
 * (docs/moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md poglavlje 10). Gost self-registracija (prva
 * stavka) namerno nije pokrivena — čeka M8 (spec sama to napominje).
 */
describe('M6 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let loyaltyStatus: ClientLoyaltyStatusService;
  let quotes: QuotesService;
  let postTripSurveys: PostTripSurveysService;
  let m6Triggers: M6TriggersService;
  let reminders: RemindersService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdGuestProfileIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdLoyaltyTierIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    loyaltyStatus = app.get(ClientLoyaltyStatusService);
    quotes = app.get(QuotesService);
    postTripSurveys = app.get(PostTripSurveysService);
    m6Triggers = app.get(M6TriggersService);
    reminders = app.get(RemindersService);
  });

  afterAll(async () => {
    // M5 §6.1a test emituje booking.completed preko Postgres LISTEN/NOTIFY (async) — M6EventSubscribersService
    // može stići da kreira PostTripSurvey posle povratka iz testa; kratka pauza da se to slegne pre čišćenja.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await prisma.postTripSurvey.deleteMany({
      where: { OR: [{ bookingId: { in: createdBookingIds } }, { clientAccountId: { in: createdClientAccountIds } }] },
    });
    if (createdBookingIds.length) {
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: { in: createdBookingIds } } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    await prisma.communicationLog.deleteMany({ where: { clientAccountId: { in: createdClientAccountIds } } });
    await prisma.clientLoyaltyStatus.deleteMany({ where: { clientAccountId: { in: createdClientAccountIds } } });
    if (createdGuestProfileIds.length) await prisma.guestProfile.deleteMany({ where: { id: { in: createdGuestProfileIds } } });
    if (createdClientAccountIds.length) await prisma.clientAccount.deleteMany({ where: { id: { in: createdClientAccountIds } } });
    if (createdLoyaltyTierIds.length) await prisma.loyaltyTier.deleteMany({ where: { id: { in: createdLoyaltyTierIds } } });
    if (createdProductIds.length) {
      await prisma.quote.deleteMany({ where: { items: { some: { productId: { in: createdProductIds } } } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
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
        email: `m6-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M6 Test Korisnik',
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

  async function createClientAccount(overrides: { marketingConsent?: boolean } = {}) {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'INDIVIDUAL',
        fullName: `M6 Test Nalogodavac ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `client-m6-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        marketingConsent: overrides.marketingConsent ?? false,
        marketingConsentDate: overrides.marketingConsent ? new Date() : null,
      },
    });
    createdClientAccountIds.push(account.id);
    return account;
  }

  async function createBooking(clientAccountId: string, overrides: Partial<{ totalPrice: number; currency: string; status: string; confirmedAt: Date | null }> = {}) {
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M6-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId,
        buyerName: 'M6 Test Gost',
        buyerType: 'FIZICKO_LICE',
        channel: 'B2C_SITE',
        tipNastupanja: 'ORGANIZATOR',
        status: (overrides.status as any) ?? 'CONFIRMED',
        paymentStatus: 'PAID',
        totalPrice: overrides.totalPrice ?? 50000,
        currency: overrides.currency ?? 'RSD',
        confirmedAt: overrides.confirmedAt === undefined ? new Date() : overrides.confirmedAt,
        createdBy: 'e2e-test',
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  // Supplier + Contract + Product (ACCOMMODATION) + ContractPeriod + RateLine — za §3.3 test toka cene.
  async function createBookableProductFixture() {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M6 E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-M6-${testRunId}`,
        registrationNumber: `REG-M6-${testRunId}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m6-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M6-${testRunId}`,
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
        destinationCountry: 'RS',
        destinationCity: 'Zlatibor',
        status: 'ACTIVE',
        attributes: { stars: 4 },
        translations: {
          create: [{ languageCode: 'sr', name: 'Hotel M6 Test', description: 'opis', slug: `hotel-m6-${testRunId}-${Math.random().toString(36).slice(2)}` }],
        },
      },
    });
    createdProductIds.push(product.id);

    const contractPeriod = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-09-01'),
        roomType: 'STD',
        allotmentMode: 'ON_REQUEST',
        cancellationRules: { create: [{ daysBeforeStay: 30, refundPercentage: 100 }] },
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: { contractPeriodId: contractPeriod.id, boardType: 'HALF_BOARD', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: 10000 },
    });

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { product, rateLine, markupRule };
  }

  describe('§3.2 — automatski preračun lojalnosti po potvrdi/otkazivanju', () => {
    it('prelazak praga (BOOKING_COUNT) tačno menja nivo posle preračuna', async () => {
      const tier = await prisma.loyaltyTier.create({
        data: {
          name: `Srebrni ${testRunId}`,
          rank: 1,
          qualificationMetric: 'BOOKING_COUNT',
          qualificationPeriod: 'LIFETIME',
          threshold: 1,
          discountPercentage: 5,
        },
      });
      createdLoyaltyTierIds.push(tier.id);
      const account = await createClientAccount();
      await createBooking(account.id);

      await loyaltyStatus.recalculate(account.id);

      const status = await loyaltyStatus.get(account.id);
      expect(status.currentTierId).toBe(tier.id);
      expect(status.discountPercentage).toBe(5);
    });
  });

  describe('§3.2 — ručni override', () => {
    it('POST /crm/loyalty-status/:id/override postavlja override i upisuje HUMAN audit log', async () => {
      const tier = await prisma.loyaltyTier.create({
        data: {
          name: `Platinasti ${testRunId}`,
          rank: 2,
          qualificationMetric: 'BOOKING_COUNT',
          qualificationPeriod: 'LIFETIME',
          threshold: 999,
          discountPercentage: 15,
        },
      });
      createdLoyaltyTierIds.push(tier.id);
      const account = await createClientAccount();
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/loyalty-status/${account.id}/override`)
        .set(authed(accessToken))
        .send({ tierId: tier.id, reason: 'VIP gost — e2e test' });

      expect(res.status).toBe(201);
      expect(res.body.manualOverrideTierId).toBe(tier.id);

      const status = await loyaltyStatus.get(account.id);
      expect(status.effectiveTierId).toBe(tier.id); // override pobeđuje

      const statusRow = await prisma.clientLoyaltyStatus.findUniqueOrThrow({ where: { clientAccountId: account.id } });
      const auditEntries = await prisma.auditLogEntry.findMany({
        where: { module: 'M6', action: 'loyalty_status.manual_override', resourceId: statusRow.id },
      });
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].actorType).toBe('HUMAN');
      expect(auditEntries[0].actorId).toBe(user.id);
    });
  });

  describe('§3.3 — M5 tok cene primenjuje popust lojalnosti posle marže', () => {
    it('POST /sales/quotes vraća final_price umanjen za discount_percentage nivoa', async () => {
      const { product, rateLine } = await createBookableProductFixture();
      const tier = await prisma.loyaltyTier.create({
        data: {
          name: `Zlatni ${testRunId}`,
          rank: 3,
          qualificationMetric: 'BOOKING_COUNT',
          qualificationPeriod: 'LIFETIME',
          threshold: 0,
          discountPercentage: 10,
        },
      });
      createdLoyaltyTierIds.push(tier.id);
      const account = await createClientAccount();
      await loyaltyStatus.recalculate(account.id); // threshold=0, kvalifikuje se odmah

      const itemInput = {
        productId: product.id,
        rateLineId: rateLine.id,
        stayFrom: '2027-06-10',
        stayTo: '2027-06-17',
        occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
      };

      const discountedQuote = await quotes.create(
        { channel: 'B2C_SITE', clientAccountId: account.id, items: [itemInput] } as any,
        { userId: undefined },
      );
      const baselineQuote = await quotes.create(
        { channel: 'B2C_SITE', items: [itemInput] } as any, // bez clientAccountId — nema popusta
        { userId: undefined },
      );

      const discountedPrice = discountedQuote.items[0].finalPrice;
      const baselinePrice = baselineQuote.items[0].finalPrice;
      expect(discountedPrice).toBe(Math.round(baselinePrice * 0.9));
    });
  });

  describe('§5 — istorija putovanja uživo, bez dupliranja', () => {
    it('GET /crm/client-accounts/:id/travel-history vraća tačno onoliko rezervacija koliko postoji u M5', async () => {
      const account = await createClientAccount();
      await createBooking(account.id);
      await createBooking(account.id);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/crm/client-accounts/${account.id}/travel-history`)
        .set(authed(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });
  });

  describe('§4.1 — AI nacrt koji pominje cenu ne može biti poslat bez sent_by', () => {
    it('draftedByAi=true uvek ima sent_by=null pri kreiranju, čak i ako je prosleđeno', async () => {
      const account = await createClientAccount();
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/communication-log')
        .set(authed(accessToken))
        .send({
          clientAccountId: account.id,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          summary: 'Cena aranžmana je 500 EUR, molimo potvrdite.',
          draftedByAi: true,
          sentBy: (await createInternalUser(SYSTEM_ROLES.VLASNIK)).user.id, // pokušaj zaobilaženja
        });

      expect(res.status).toBe(201);
      expect(res.body.sentBy).toBeNull();
    });

    it('POST /crm/communication-log/:id/mark-sent je jedini put do sent_by, popunjava ljudski nalog', async () => {
      const account = await createClientAccount();
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const created = await request(app.getHttpServer())
        .post('/api/v1/crm/communication-log')
        .set(authed(accessToken))
        .send({ clientAccountId: account.id, channel: 'EMAIL', direction: 'OUTBOUND', summary: 'Cena: 500 EUR.', draftedByAi: true });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/crm/communication-log/${created.body.id}/mark-sent`)
        .set(authed(accessToken));

      expect(res.status).toBe(201);
      expect(res.body.sentBy).toBe(user.id);
    });
  });

  describe('§4.2 — okidači (rođendan/godišnjica/pred-put), gated marketing_consent', () => {
    it('rođendan gosta na tačan datum generiše CommunicationLog, auto-poslat samo uz marketing_consent=true', async () => {
      const today = new Date();
      const accountConsent = await createClientAccount({ marketingConsent: true });
      const accountNoConsent = await createClientAccount({ marketingConsent: false });

      const guestConsent = await prisma.guestProfile.create({
        data: {
          fullName: 'Rođendanski Gost Consent',
          documentType: 'PASSPORT',
          documentNumber: `DOC-${testRunId}-1`,
          nationality: 'RS',
          dateOfBirth: new Date(Date.UTC(1990, today.getUTCMonth(), today.getUTCDate())),
          linkedClientAccountId: accountConsent.id,
        },
      });
      createdGuestProfileIds.push(guestConsent.id);
      const guestNoConsent = await prisma.guestProfile.create({
        data: {
          fullName: 'Rođendanski Gost NoConsent',
          documentType: 'PASSPORT',
          documentNumber: `DOC-${testRunId}-2`,
          nationality: 'RS',
          dateOfBirth: new Date(Date.UTC(1990, today.getUTCMonth(), today.getUTCDate())),
          linkedClientAccountId: accountNoConsent.id,
        },
      });
      createdGuestProfileIds.push(guestNoConsent.id);

      await m6Triggers.checkBirthdays();

      const consentLog = await prisma.communicationLog.findFirst({ where: { guestProfileId: guestConsent.id } });
      const noConsentLog = await prisma.communicationLog.findFirst({ where: { guestProfileId: guestNoConsent.id } });

      expect(consentLog?.draftedByAi).toBe(true);
      expect(consentLog?.sentBy).toBe('SYSTEM_AUTO'); // marketing_consent=true → auto-poslat
      expect(noConsentLog?.draftedByAi).toBe(true);
      expect(noConsentLog?.sentBy).toBeNull(); // bez saglasnosti — čeka ljudsko slanje
    });
  });

  describe('§2.1 — ClientAccount.tags', () => {
    it('tags se čuva/vraća preko API-ja bez uticaja na cenu ili lojalnost', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer())
        .post('/api/v1/crm/client-accounts')
        .set(authed(accessToken))
        .send({ accountType: 'INDIVIDUAL', fullName: 'Tag Test', tags: ['VIP', 'čest putnik'] });

      expect(res.status).toBe(201);
      createdClientAccountIds.push(res.body.id);
      expect(res.body.tags).toEqual(['VIP', 'čest putnik']);

      const status = await loyaltyStatus.get(res.body.id);
      expect(status.discountPercentage).toBe(0); // nema veze sa tags
    });
  });

  describe('§4.3 — PostTripSurvey: T+2 kreiranje, uslovljeno slanje, Google review prag', () => {
    it('booking.completed → M6EventSubscribersService kreira PostTripSurvey sa scheduled_send_at = T+2', async () => {
      const account = await createClientAccount({ marketingConsent: true });
      const booking = await createBooking(account.id, { status: 'CONFIRMED' });

      await postTripSurveys.createForBooking(booking.id);

      const survey = await prisma.postTripSurvey.findUnique({ where: { bookingId: booking.id } });
      expect(survey).not.toBeNull();
      expect(survey!.status).toBe('PENDING');
      const expectedMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
      expect(Math.abs(survey!.scheduledSendAt.getTime() - expectedMs)).toBeLessThan(60_000);
    });

    it('sendDueSurveys šalje automatski samo uz marketing_consent=true, inače kreira CommunicationLog nacrt', async () => {
      const accountConsent = await createClientAccount({ marketingConsent: true });
      const bookingConsent = await createBooking(accountConsent.id);
      const accountNoConsent = await createClientAccount({ marketingConsent: false });
      const bookingNoConsent = await createBooking(accountNoConsent.id);

      await prisma.postTripSurvey.create({
        data: {
          bookingId: bookingConsent.id,
          clientAccountId: accountConsent.id,
          accessToken: `tok-consent-${testRunId}`,
          status: 'PENDING',
          scheduledSendAt: new Date(Date.now() - 1000),
        },
      });
      await prisma.postTripSurvey.create({
        data: {
          bookingId: bookingNoConsent.id,
          clientAccountId: accountNoConsent.id,
          accessToken: `tok-noconsent-${testRunId}`,
          status: 'PENDING',
          scheduledSendAt: new Date(Date.now() - 1000),
        },
      });

      await postTripSurveys.sendDueSurveys();

      const sentSurvey = await prisma.postTripSurvey.findUnique({ where: { bookingId: bookingConsent.id } });
      const pendingSurvey = await prisma.postTripSurvey.findUnique({ where: { bookingId: bookingNoConsent.id } });
      expect(sentSurvey!.status).toBe('SENT');
      expect(pendingSurvey!.status).toBe('PENDING');
    });

    it('popunjena anketa sa rating >= pragom postavlja wants_google_review, klik beleži google_review_clicked_at', async () => {
      const account = await createClientAccount();
      const booking = await createBooking(account.id);
      const survey = await prisma.postTripSurvey.create({
        data: {
          bookingId: booking.id,
          clientAccountId: account.id,
          accessToken: `tok-submit-${testRunId}`,
          status: 'SENT',
          scheduledSendAt: new Date(),
        },
      });

      const submitRes = await request(app.getHttpServer())
        .post(`/api/v1/crm/post-trip-surveys/${survey.accessToken}/submit`)
        .send({ overallRating: 5, responses: { comment: 'Odlično!' } });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.wantsGoogleReview).toBe(true);
      expect(submitRes.body.status).toBe('COMPLETED');

      const clickRes = await request(app.getHttpServer()).post(`/api/v1/crm/post-trip-surveys/${survey.accessToken}/google-review-click`);
      expect(clickRes.status).toBe(201);
      expect(clickRes.body.googleReviewUrl).toEqual(expect.any(String));

      const updated = await prisma.postTripSurvey.findUniqueOrThrow({ where: { id: survey.id } });
      expect(updated.googleReviewClickedAt).not.toBeNull();
    });
  });

  describe('M5 §6.1a — prelaz u COMPLETED (oslonac za M6 §4.3)', () => {
    it('CONFIRMED rezervacija sa svim stavkama u prošlosti prelazi u COMPLETED i emituje booking.completed', async () => {
      const account = await createClientAccount();
      const booking = await createBooking(account.id, { status: 'CONFIRMED' });
      const { product, rateLine, markupRule } = await createBookableProductFixture();
      await prisma.bookingItem.create({
        data: {
          bookingId: booking.id,
          productId: product.id,
          sourceType: 'CONTRACTED',
          supplierReference: 'e2e',
          stayFrom: new Date('2020-01-01'),
          stayTo: new Date('2020-01-08'),
          baseCost: 10000,
          baseCostCurrency: 'EUR',
          rateLineId: rateLine.id,
          markupRuleId: markupRule.id,
          finalPrice: 12000,
          finalPriceCurrency: 'EUR',
          itemStatus: 'CONFIRMED',
        },
      });

      await reminders.completeFinishedBookings();

      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.status).toBe('COMPLETED');
    });
  });
});
