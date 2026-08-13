import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M10 izlaznog kriterijuma
 * (docs/moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md poglavlje 11).
 *
 * Booking/BookingItem fixture se kreira direktno preko Prisma-e (ne kroz pun M5
 * search→quote→confirm HTTP lanac) — M5 tok je već pokriven sopstvenim unit testovima
 * (bookings.service.spec.ts); ovde je predmet testiranja M10 ponašanje NAD već
 * potvrđenom rezervacijom, isti princip kao PricelistImportRow fixture u M3 e2e testu
 * (test/m3-exit-criteria.e2e-spec.ts) gde gornji AI-ekstrakcija korak nije pod testom.
 */
describe('M10 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdBookingIds: string[] = [];

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
    if (createdBookingIds.length) {
      await prisma.fiscalDocument.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.clientPaymentSchedule.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdSupplierIds.length) {
      await prisma.supplierPaymentInstruction.deleteMany({ where: { supplierObligation: { supplierId: { in: createdSupplierIds } } } });
      await prisma.supplierObligation.deleteMany({ where: { supplierId: { in: createdSupplierIds } } });
    }
    if (createdProductIds.length) await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    if (createdContractIds.length) await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    if (createdSupplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m10-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M10 Test Korisnik',
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

  // Kreira Supplier + Contract (payment_terms_days=10) + Product (CONTRACTED) + potvrđen
  // Booking sa jednom CONTRACTED BookingItem stavkom, u valuti RSD (bez potrebe za kursom).
  async function createConfirmedBookingFixture(overrides: { buyerType?: 'FIZICKO_LICE' | 'PRAVNO_LICE'; tipNastupanja?: 'ORGANIZATOR' | 'POSREDNIK' } = {}) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-${testRunId}`,
        registrationNumber: `REG-${testRunId}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-${testRunId}`,
        currency: 'RSD',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-12-31'),
        cancellationTermsSummary: 'e2e test',
        documentUrl: 'mock://doc.pdf',
        status: 'ACTIVE',
        defaultTipNastupanja: overrides.tipNastupanja ?? 'ORGANIZATOR',
        paymentTermsDays: 10,
      },
    });
    createdContractIds.push(contract.id);

    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: 'RS',
        destinationCity: 'Beograd',
        status: 'ACTIVE',
      },
    });
    createdProductIds.push(product.id);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: `client-${testRunId}`,
        buyerName: overrides.buyerType === 'PRAVNO_LICE' ? 'Firma DOO' : 'Petar Petrović',
        buyerType: overrides.buyerType ?? 'FIZICKO_LICE',
        buyerTaxId: overrides.buyerType === 'PRAVNO_LICE' ? '123456789' : null,
        channel: 'INTERNAL_PANEL',
        tipNastupanja: overrides.tipNastupanja ?? 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 100000, // 1000.00 RSD u para
        currency: 'RSD',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: 'period-e2e',
              stayFrom: new Date('2026-09-01'),
              stayTo: new Date('2026-09-05'),
              baseCost: 60000,
              baseCostCurrency: 'RSD',
              markupRuleId: (await ensureMarkupRule()).id,
              finalPrice: 100000,
              finalPriceCurrency: 'RSD',
              itemStatus: 'CONFIRMED',
              unitCount: 1,
            },
          ],
        },
      },
      include: { items: true },
    });
    createdBookingIds.push(booking.id);

    return { supplier, contract, product, booking };
  }

  async function ensureMarkupRule() {
    return prisma.markupRule.create({ data: { scopeType: 'M2_PRODUCT', scopeId: 'e2e-fixture' } });
  }

  describe('§2/§4.4 — automatski izbor tipa dokumenta i PDV osnovice', () => {
    it('bira SEF_EFAKTURA/MARZA za pravno lice/organizatora i preračunava iznos ispravno (integer, ne decimal)', async () => {
      const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { booking } = await createConfirmedBookingFixture({ buyerType: 'PRAVNO_LICE', tipNastupanja: 'ORGANIZATOR' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/fiscal-documents/draft')
        .set(authed(accessToken))
        .send({ bookingId: booking.id });

      expect(res.status).toBe(201);
      expect(res.body.documentType).toBe('SEF_EFAKTURA');
      expect(res.body.vatCalculationBasis).toBe('MARZA');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.amountRsd).toBe(100000); // RSD -> RSD, bez konverzije
      expect(Number.isInteger(res.body.amountOriginal)).toBe(true);
      expect(Number.isInteger(res.body.vatAmount)).toBe(true);
    });

    it('bira ESIR_RACUN/PROVIZIJA za fizičko lice/posrednika', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { booking } = await createConfirmedBookingFixture({ buyerType: 'FIZICKO_LICE', tipNastupanja: 'POSREDNIK' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/fiscal-documents/draft')
        .set(authed(accessToken))
        .send({ bookingId: booking.id });

      expect(res.status).toBe(201);
      expect(res.body.documentType).toBe('ESIR_RACUN');
      expect(res.body.vatCalculationBasis).toBe('PROVIZIJA');
    });
  });

  describe('§6 — SUBMIT isključivo ljudski nalog sa dozvolom', () => {
    it('odbija SUBMIT bez M10/fiscal-document/SUBMIT dozvole', async () => {
      const vlasnik = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const gost = await createInternalUser(SYSTEM_ROLES.GOST); // nema M10 dozvole
      const { booking } = await createConfirmedBookingFixture({ buyerType: 'FIZICKO_LICE' });

      const draftRes = await request(app.getHttpServer())
        .post('/api/v1/finance/fiscal-documents/draft')
        .set(authed(vlasnik.accessToken))
        .send({ bookingId: booking.id });

      const submitRes = await request(app.getHttpServer())
        .post(`/api/v1/finance/fiscal-documents/${draftRes.body.id}/submit`)
        .set(authed(gost.accessToken));

      expect(submitRes.status).toBe(403);
    });

    it('šalje nacrt, postavlja SUBMITTED, external_reference i buyer_acceptance_deadline (15 dana) za SEF_EFAKTURA', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.RACUNOVODJA);
      const { booking } = await createConfirmedBookingFixture({ buyerType: 'PRAVNO_LICE', tipNastupanja: 'ORGANIZATOR' });

      const draftRes = await request(app.getHttpServer())
        .post('/api/v1/finance/fiscal-documents/draft')
        .set(authed(accessToken))
        .send({ bookingId: booking.id });

      const submitRes = await request(app.getHttpServer())
        .post(`/api/v1/finance/fiscal-documents/${draftRes.body.id}/submit`)
        .set(authed(accessToken));

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.status).toBe('SUBMITTED');
      expect(typeof submitRes.body.externalReference).toBe('string');
      expect(submitRes.body.buyerAcceptanceStatus).toBe('PENDING');

      const submittedAt = new Date(submitRes.body.submittedAt).getTime();
      const deadline = new Date(submitRes.body.buyerAcceptanceDeadline).getTime();
      expect((deadline - submittedAt) / (24 * 60 * 60 * 1000)).toBeCloseTo(15, 1);

      const auditEntries = await prisma.auditLogEntry.findMany({
        where: { module: 'M10', action: 'fiscal_document.submitted', resourceId: draftRes.body.id },
      });
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].actorType).toBe('HUMAN');
    });
  });

  describe('§5.2 — uplata dovodi Booking do PAID', () => {
    it('ručna uplata koja pokriva ceo iznos postavlja Booking.payment_status = PAID', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.RACUNOVODJA);
      const { booking } = await createConfirmedBookingFixture({ buyerType: 'FIZICKO_LICE' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/payments')
        .set(authed(accessToken))
        .send({ bookingId: booking.id, amount: 100000, currency: 'RSD', method: 'BANK_TRANSFER' });

      expect(res.status).toBe(201);

      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.paymentStatus).toBe('PAID');
    });
  });

  describe('§8.1/§8.3 — obaveza prema dobavljaču', () => {
    it('ne dozvoljava APPROVED bez booking_item_id, i ispravno računa exchange_rate_difference pri plaćanju', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.RACUNOVODJA);
      const { supplier, booking } = await createConfirmedBookingFixture({ buyerType: 'FIZICKO_LICE' });

      // bez bookingItemId — mora biti odbijeno
      const noItemRes = await request(app.getHttpServer())
        .post('/api/v1/finance/supplier-obligations')
        .set(authed(accessToken))
        .send({ supplierId: supplier.id, amountOriginal: 50000, currencyOriginal: 'RSD', dueDate: '2026-10-01' });
      expect(noItemRes.status).toBe(201);

      const approveNoItemRes = await request(app.getHttpServer())
        .post(`/api/v1/finance/supplier-obligations/${noItemRes.body.id}/approve`)
        .set(authed(accessToken));
      expect(approveNoItemRes.status).toBe(400);

      // sa bookingItemId (RSD — bez kursne razlike, currencyOriginal RSD ne zahteva exchange rate)
      const item = await prisma.bookingItem.findFirstOrThrow({ where: { bookingId: booking.id } });
      const withItemRes = await request(app.getHttpServer())
        .post('/api/v1/finance/supplier-obligations')
        .set(authed(accessToken))
        .send({ supplierId: supplier.id, bookingItemId: item.id, amountOriginal: 60000, currencyOriginal: 'RSD', dueDate: '2026-10-01' });

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/finance/supplier-obligations/${withItemRes.body.id}/approve`)
        .set(authed(accessToken));
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe('APPROVED');

      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/finance/supplier-obligations/${withItemRes.body.id}/pay`)
        .set(authed(accessToken))
        .send({});
      expect(payRes.status).toBe(201);
      expect(payRes.body.status).toBe('PAID');
      expect(payRes.body.exchangeRateDifference).toBeNull(); // RSD — nema konverzije
    });
  });
});
