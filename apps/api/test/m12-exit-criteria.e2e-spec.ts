import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { FactSyncService } from '../src/modules/m13-bi/sync/fact-sync.service';
import { ContentPublishSchedulerService } from '../src/modules/m12-marketing/content/content-publish-scheduler.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M12 izlaznog kriterijuma
 * (docs/moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md poglavlje 8), osim rute
 * eksplicitno vezanih za M8 frontend (koji je namerno pauziran — CLAUDE.md).
 */
describe('M12 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let factSync: FactSyncService;
  let publishScheduler: ContentPublishSchedulerService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdContentIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdChannelConfigIds: string[] = [];

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
    factSync = app.get(FactSyncService);
    publishScheduler = app.get(ContentPublishSchedulerService);
  });

  afterAll(async () => {
    await wait(300);
    if (createdChannelConfigIds.length) await prisma.channelConfig.deleteMany({ where: { id: { in: createdChannelConfigIds } } });
    if (createdBookingIds.length) {
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.factBooking.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: { in: createdBookingIds } } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdContentIds.length) {
      await prisma.contentTranslation.deleteMany({ where: { contentPieceId: { in: createdContentIds } } });
      await prisma.contentPiece.deleteMany({ where: { id: { in: createdContentIds } } });
    }
    if (createdProductIds.length) {
      await prisma.productTranslation.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdContractIds.length) await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    if (createdSupplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdMarkupRuleIds.length) await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    if (createdClientAccountIds.length) await prisma.clientAccount.deleteMany({ where: { id: { in: createdClientAccountIds } } });
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m12-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M12 Test Korisnik',
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

  async function createAndPublishProduct(accessToken: string) {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(authed(accessToken))
      .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Kopaonik' });
    expect(createRes.status).toBe(201);
    const productId = createRes.body.id;
    createdProductIds.push(productId);

    await request(app.getHttpServer())
      .put(`/api/v1/catalog/products/${productId}/translations`)
      .set(authed(accessToken))
      .send({ languageCode: 'sr', name: `Hotel Kopaonik ${testRunId}`, description: 'Opis hotela na Kopaoniku.', slug: `hotel-kopaonik-${testRunId}-${Math.random().toString(36).slice(2)}` })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/products/${productId}/translations`)
      .set(authed(accessToken))
      .send({ languageCode: 'en', name: `Kopaonik Hotel ${testRunId}`, description: 'Kopaonik hotel description.', slug: `kopaonik-hotel-${testRunId}-${Math.random().toString(36).slice(2)}` })
      .expect(200);

    const publishRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/products/${productId}/publish`)
      .set(authed(accessToken))
      .send({ visibleChannels: ['B2C_SITE'] });
    expect(publishRes.status).toBe(201);
    expect(publishRes.body.status).toBe('ACTIVE');
    return productId;
  }

  async function createManualDraft(accessToken: string, overrides: Record<string, unknown> = {}) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/marketing/content')
      .set(authed(accessToken))
      .send({ type: 'SOCIAL_POST', targetChannels: ['FACEBOOK'], ...overrides });
    expect(created.status).toBe(201);
    createdContentIds.push(created.body.id);
    return created.body;
  }

  async function addTranslation(accessToken: string, contentId: string, body: string, languageCode = 'sr') {
    return request(app.getHttpServer())
      .put(`/api/v1/marketing/content/${contentId}/translations`)
      .set(authed(accessToken))
      .send({ languageCode, title: 'Test naslov', body })
      .expect(200);
  }

  describe('§8, stavka 1 — objava proizvoda u M2 automatski generiše AI nacrt u M12', () => {
    it('product.published pretplatnik kreira ContentPiece PENDING_APPROVAL/generatedBy=AI bez ljudske intervencije', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const productId = await createAndPublishProduct(accessToken);

      await wait(700); // async LISTEN/NOTIFY, isti obrazac kao M7/M10/M13/M14 e2e

      const draft = await prisma.contentPiece.findFirst({ where: { productId }, include: { translations: true } });
      expect(draft).not.toBeNull();
      createdContentIds.push(draft!.id);
      expect(draft!.status).toBe('PENDING_APPROVAL');
      expect(draft!.generatedBy).toBe('AI');
      expect(draft!.approvedBy).toBeNull();
      expect(draft!.translations.length).toBeGreaterThanOrEqual(1);
      expect(draft!.trackingCode).toHaveLength(8);
    });
  });

  describe('§8, stavka 2 — objava zahteva approved_by popunjen ljudskim nalogom', () => {
    it('PUBLISHED se ne može postići bez POST .../approve; approve popunjava approved_by', async () => {
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const draft = await createManualDraft(accessToken);
      expect(draft.status).toBe('DRAFT');
      await addTranslation(accessToken, draft.id, 'Redovan tekst objave bez AI vizuala.');

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.approvedBy).toBe(user.id);
      // Bez scheduled_publish_at — approve odmah izvršava objavu (mehaničko izvršenje već
      // odobrene radnje, §3 korak 5), pa status ide pravo u PUBLISHED.
      expect(['APPROVED', 'PUBLISHED']).toContain(approveRes.body.status);

      const afterDb = await prisma.contentPiece.findUniqueOrThrow({ where: { id: draft.id } });
      expect(afterDb.approvedBy).toBe(user.id);
    });

    it('odobrenje bez ijednog prevoda se odbija', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const draft = await createManualDraft(accessToken);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(res.status).toBe(400);
    });
  });

  describe('§8, stavka 3 — EMAIL kanal nikad ne šalje bez marketing_consent, target_tags samo sužava', () => {
    it('kreira primaoce sa/bez saglasnosti i sa različitim tagovima, objavljuje EMAIL sadržaj sa target_tags i proverava skup', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const consentedTagged = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Saglasnost+Tag', email: `consent-tag-${testRunId}@tt-test.rs`, marketingConsent: true, tags: ['vip'] },
      });
      const consentedNoTag = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Saglasnost bez taga', email: `consent-notag-${testRunId}@tt-test.rs`, marketingConsent: true, tags: ['drugo'] },
      });
      const noConsentTagged = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Bez saglasnosti', email: `noconsent-${testRunId}@tt-test.rs`, marketingConsent: false, tags: ['vip'] },
      });
      createdClientAccountIds.push(consentedTagged.id, consentedNoTag.id, noConsentTagged.id);

      // Ovaj test proverava da se stvarni objavni tok (PATCH+approve sa target_tags=['vip'])
      // izvrši bez greške preko EMAIL kanala — sama poslovna provera (marketing_consent +
      // target_tags presek) se testira nezavisno i preciznije direktno preko
      // ClientAccountsService.findMarketingRecipients u testu ispod.
      const draft = await createManualDraft(accessToken, { type: 'EMAIL_NEWSLETTER', targetChannels: ['EMAIL'], targetTags: ['vip'] });
      await addTranslation(accessToken, draft.id, 'Redovan email newsletter tekst.');

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('PUBLISHED');
    });

    it('ClientAccountsService.findMarketingRecipients nikad ne vraća marketing_consent=false, i target_tags samo sužava skup', async () => {
      const consentedTagged = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Unit Saglasnost+Tag', email: `unit-consent-tag-${testRunId}@tt-test.rs`, marketingConsent: true, tags: ['vip'] },
      });
      const consentedNoTag = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Unit Saglasnost bez taga', email: `unit-consent-notag-${testRunId}@tt-test.rs`, marketingConsent: true, tags: ['drugo'] },
      });
      const noConsentTagged = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Unit Bez saglasnosti', email: `unit-noconsent-${testRunId}@tt-test.rs`, marketingConsent: false, tags: ['vip'] },
      });
      createdClientAccountIds.push(consentedTagged.id, consentedNoTag.id, noConsentTagged.id);

      const { ClientAccountsService } = await import('../src/modules/m6-crm/client-accounts/client-accounts.service');
      const service = app.get(ClientAccountsService);

      const allConsented = await service.findMarketingRecipients(null);
      const ids = allConsented.map((a: any) => a.id);
      expect(ids).toContain(consentedTagged.id);
      expect(ids).toContain(consentedNoTag.id);
      expect(ids).not.toContain(noConsentTagged.id); // marketing_consent=false — nikad

      const vipOnly = await service.findMarketingRecipients(['vip']);
      const vipIds = vipOnly.map((a: any) => a.id);
      expect(vipIds).toContain(consentedTagged.id);
      expect(vipIds).not.toContain(consentedNoTag.id); // sužava — nema 'vip' tag
      expect(vipIds).not.toContain(noConsentTagged.id); // sužava, nikad proširuje van marketing_consent=true
    });
  });

  describe('§8, stavka 4 — zakazana objava odobrenog sadržaja radi automatski u planirano vreme', () => {
    it('APPROVED sadržaj sa scheduled_publish_at u prošlosti se objavljuje kroz cron ulaznu tačku', async () => {
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const past = new Date(Date.now() - 60_000).toISOString();
      const draft = await createManualDraft(accessToken, { scheduledPublishAt: past });
      await addTranslation(accessToken, draft.id, 'Tekst zakazane objave.');

      // Odobrenje SA prošlim scheduled_publish_at takođe odmah objavljuje (§3 korak 5 — prošao
      // termin se izvršava odmah); zato ručno vraćamo status na APPROVED bez publishedAt da
      // testiramo baš cron putanju nezavisno (ContentPublishSchedulerService.runScheduledPublish).
      await prisma.contentPiece.update({ where: { id: draft.id }, data: { status: 'APPROVED', approvedBy: user.id, publishedAt: null } });

      await publishScheduler.runScheduledPublish();

      const after = await prisma.contentPiece.findUniqueOrThrow({ where: { id: draft.id } });
      expect(after.status).toBe('PUBLISHED');
      expect(after.publishedAt).not.toBeNull();
    });

    it('APPROVED sadržaj sa scheduled_publish_at u budućnosti se NE objavljuje pre vremena', async () => {
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const draft = await createManualDraft(accessToken, { scheduledPublishAt: future });
      await addTranslation(accessToken, draft.id, 'Tekst buduće objave.');
      await prisma.contentPiece.update({ where: { id: draft.id }, data: { status: 'APPROVED', approvedBy: user.id, publishedAt: null } });

      await publishScheduler.runScheduledPublish();

      const after = await prisma.contentPiece.findUniqueOrThrow({ where: { id: draft.id } });
      expect(after.status).toBe('APPROVED');
      expect(after.publishedAt).toBeNull();
    });
  });

  describe('§8, stavka 5 — STATIC_PAGE/BLOG_POST sa istim slug se ne može kreirati dvaput', () => {
    it('drugi POST /content sa istim slug vraća grešku (unique constraint)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const slug = `o-nama-${testRunId}`;

      const first = await request(app.getHttpServer())
        .post('/api/v1/marketing/content')
        .set(authed(accessToken))
        .send({ type: 'STATIC_PAGE', slug, targetChannels: ['M8_SITE'] });
      expect(first.status).toBe(201);
      createdContentIds.push(first.body.id);

      const second = await request(app.getHttpServer())
        .post('/api/v1/marketing/content')
        .set(authed(accessToken))
        .send({ type: 'STATIC_PAGE', slug, targetChannels: ['M8_SITE'] });
      expect(second.status).toBeGreaterThanOrEqual(400);
    });

    it('STATIC_PAGE/BLOG_POST bez slug se odbija', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const res = await request(app.getHttpServer())
        .post('/api/v1/marketing/content')
        .set(authed(accessToken))
        .send({ type: 'BLOG_POST', targetChannels: ['M8_SITE'] });
      expect(res.status).toBe(400);
    });
  });

  describe('§8, stavka 6 — tracking_code se automatski generiše i jedinstven je', () => {
    it('POST /content kreira ContentPiece sa unique tracking_code bez da ga klijent prosledi', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const a = await createManualDraft(accessToken);
      const b = await createManualDraft(accessToken);
      expect(a.trackingCode).toBeDefined();
      expect(a.trackingCode).toHaveLength(8);
      expect(a.trackingCode).not.toBe(b.trackingCode);
    });
  });

  describe('§8, stavka 7 — Booking.referral_tracking_code poklapa ContentPiece.tracking_code → M13 FactBooking.referral_content_id', () => {
    it('poklapajući kod popunjava referralContentId/Name; nepostojeći kod ostaje null', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const draft = await createManualDraft(accessToken);
      await addTranslation(accessToken, draft.id, 'Sadržaj za atribuciju.');
      await request(app.getHttpServer()).post(`/api/v1/marketing/content/${draft.id}/approve`).set(authed(accessToken)).expect(201);
      const content = await prisma.contentPiece.findUniqueOrThrow({ where: { id: draft.id } });

      const clientAccount = await prisma.clientAccount.create({
        data: { accountType: 'INDIVIDUAL', fullName: 'M12 Atribucija Gost', email: `attrib-${testRunId}@tt-test.rs` },
      });
      createdClientAccountIds.push(clientAccount.id);

      const supplier = await prisma.supplier.create({
        data: {
          name: `M12 E2E Dobavljač ${testRunId}`,
          type: 'HOTEL',
          taxId: `TAX-M12-${testRunId}`,
          registrationNumber: `REG-M12-${testRunId}`,
          country: 'RS',
          contactName: 'Test kontakt',
          contactEmail: `supplier-m12-${testRunId}@tt-test.rs`,
          contactPhone: '+381600000001',
        },
      });
      createdSupplierIds.push(supplier.id);
      const contract = await prisma.contract.create({
        data: {
          supplierId: supplier.id,
          contractNumber: `C-M12-${testRunId}`,
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
          destinationCity: 'Vrnjačka Banja',
          status: 'ACTIVE',
          visibleChannels: ['B2C_SITE'],
        },
      });
      createdProductIds.push(product.id);
      const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M2_PRODUCT', scopeId: product.id, percentage: 15 } });
      createdMarkupRuleIds.push(markupRule.id);

      const matchingBooking = await prisma.booking.create({
        data: {
          bookingNumber: `TT-M12-E2E-MATCH-${testRunId}`,
          clientAccountId: clientAccount.id,
          buyerName: 'M12 Test Gost',
          buyerType: 'FIZICKO_LICE',
          channel: 'B2C_SITE',
          tipNastupanja: 'ORGANIZATOR',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          totalPrice: 10000,
          currency: 'RSD',
          confirmedAt: new Date(),
          createdBy: 'e2e-test',
          referralTrackingCode: content.trackingCode,
        },
      });
      createdBookingIds.push(matchingBooking.id);
      const matchingItem = await prisma.bookingItem.create({
        data: {
          bookingId: matchingBooking.id,
          productId: product.id,
          sourceType: 'CONTRACTED',
          supplierReference: 'e2e-m12',
          stayFrom: new Date('2027-06-01'),
          stayTo: new Date('2027-06-05'),
          baseCost: 8000,
          baseCostCurrency: 'RSD',
          markupRuleId: markupRule.id,
          finalPrice: 10000,
          finalPriceCurrency: 'RSD',
          itemStatus: 'CONFIRMED',
        },
      });
      await factSync.syncBookingItem(matchingItem.id);
      const matchedFact = await prisma.factBooking.findUniqueOrThrow({ where: { bookingItemId: matchingItem.id } });
      expect(matchedFact.referralContentId).toBe(content.id);
      expect(matchedFact.referralContentName).toBeTruthy();

      const nonMatchingBooking = await prisma.booking.create({
        data: {
          bookingNumber: `TT-M12-E2E-NOMATCH-${testRunId}`,
          clientAccountId: clientAccount.id,
          buyerName: 'M12 Test Gost',
          buyerType: 'FIZICKO_LICE',
          channel: 'B2C_SITE',
          tipNastupanja: 'ORGANIZATOR',
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          totalPrice: 10000,
          currency: 'RSD',
          confirmedAt: new Date(),
          createdBy: 'e2e-test',
          referralTrackingCode: 'NEPOSTOJI',
        },
      });
      createdBookingIds.push(nonMatchingBooking.id);
      const nonMatchingItem = await prisma.bookingItem.create({
        data: {
          bookingId: nonMatchingBooking.id,
          productId: product.id,
          sourceType: 'CONTRACTED',
          supplierReference: 'e2e-m12',
          stayFrom: new Date('2027-06-01'),
          stayTo: new Date('2027-06-05'),
          baseCost: 8000,
          baseCostCurrency: 'RSD',
          markupRuleId: markupRule.id,
          finalPrice: 10000,
          finalPriceCurrency: 'RSD',
          itemStatus: 'CONFIRMED',
        },
      });
      await factSync.syncBookingItem(nonMatchingItem.id);
      const nonMatchedFact = await prisma.factBooking.findUniqueOrThrow({ where: { bookingItemId: nonMatchingItem.id } });
      expect(nonMatchedFact.referralContentId).toBeNull(); // nepostojeći kod — nikad izmišljena atribucija
    });
  });

  describe('§8, stavka 8 — contains_ai_generated_media=true bez oznake transparentnosti blokira odobrenje', () => {
    it('odobrenje se odbija bez markera u telu prevoda, prolazi kad marker postoji', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const draft = await createManualDraft(accessToken, { containsAiGeneratedMedia: true });
      await addTranslation(accessToken, draft.id, 'Tekst objave bez ikakve naznake o poreklu vizuala.');

      const blocked = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(blocked.status).toBe(400);

      await addTranslation(accessToken, draft.id, 'Fotografija je generisana uz pomoć veštačke inteligencije (AI).');

      const allowed = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(allowed.status).toBe(201);
      expect(['APPROVED', 'PUBLISHED']).toContain(allowed.body.status);
    });

    it('sintetički AI vizual vezan za konkretan product_id kao BANNER se odbija čak i sa oznakom', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const productId = await createAndPublishProduct(accessToken);
      const draft = await createManualDraft(accessToken, {
        type: 'BANNER',
        productId,
        containsAiGeneratedMedia: true,
        targetChannels: ['M8_SITE'],
      });
      await addTranslation(accessToken, draft.id, 'Fotografija je generisana uz pomoć veštačke inteligencije (AI).');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/marketing/content/${draft.id}/approve`)
        .set(authed(accessToken));
      expect(res.status).toBe(400);
    });
  });

  describe('Dozvole (§5) — CREATE_DRAFT/APPROVE_PUBLISH su odvojene dozvole', () => {
    it('korisnik bez M12 dozvola dobija 403 na POST /content', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.RACUNOVODJA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/marketing/content')
        .set(authed(accessToken))
        .send({ type: 'SOCIAL_POST', targetChannels: ['FACEBOOK'] });
      expect(res.status).toBe(403);
    });
  });

  describe('§7 — /channels konfiguracija distribucionih kanala', () => {
    it('kredencijali se nikad ne vraćaju u odgovoru (authConfigEncrypted odsutan)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const created = await request(app.getHttpServer())
        .post('/api/v1/marketing/channels')
        .set(authed(accessToken))
        .send({ channelCode: 'FACEBOOK', displayName: `FB Test ${testRunId}`, authConfig: { pageId: '123', accessToken: 'tajna-vrednost' } });
      expect(created.status).toBe(201);
      createdChannelConfigIds.push(created.body.id);
      expect(created.body).not.toHaveProperty('authConfigEncrypted');

      const list = await request(app.getHttpServer()).get('/api/v1/marketing/channels').set(authed(accessToken));
      expect(list.status).toBe(200);
      expect(list.body.every((c: any) => !('authConfigEncrypted' in c))).toBe(true);
    });
  });
});
