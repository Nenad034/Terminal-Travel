import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { ClientContractsService } from '../src/modules/m20-ugovori-klijenti/client-contracts/client-contracts.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M20 izlaznog kriterijuma
 * (docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md poglavlje 7).
 *
 * Isti obrazac fiksture kao test/m10-exit-criteria.e2e-spec.ts — Booking se kreira direktno
 * preko Prisma-e (M5 tok je već pokriven sopstvenim testovima); ovde je predmet testiranja M20
 * ponašanje NAD već potvrđenom rezervacijom. generateForBooking/voidAndRegenerateForModification
 * se pozivaju direktno preko app.get (nisu izložene kao HTTP endpoint — automatske su, isti
 * obrazac kao TravelGuaranteeRegistrationsService.createForBooking u M11 e2e testu).
 */
describe('M20 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let clientContracts: ClientContractsService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdBookingIds: string[] = [];
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
    clientContracts = app.get(ClientContractsService);
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await prisma.clientContract.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
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
        email: `m20-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M20 Test Korisnik',
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

  // Supplier + Contract + Product (ACCOMMODATION, stars=4) + ContractPeriod + CancellationRule
  // + RateLine (HALF_BOARD) + CONFIRMED Booking sa jednom CONTRACTED BookingItem stavkom.
  async function createOrganizatorBookingFixture(overrides: { contractTermsAcceptedAt?: Date | null } = {}) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M20 E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-M20-${testRunId}`,
        registrationNumber: `REG-M20-${testRunId}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m20-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M20-${testRunId}`,
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
          create: [{ languageCode: 'sr', name: 'Hotel M20 Test', description: 'opis', slug: `hotel-m20-${testRunId}-${Math.random().toString(36).slice(2)}` }],
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
      data: { contractPeriodId: contractPeriod.id, boardType: 'HALF_BOARD', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: 6000 },
    });

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M2_PRODUCT', scopeId: 'e2e-fixture-m20' } });
    createdMarkupRuleIds.push(markupRule.id);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M20-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: `client-${testRunId}`,
        buyerName: 'Petar Petrović',
        buyerType: 'FIZICKO_LICE',
        channel: 'B2C_SITE',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 100000,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
        contractTermsAcceptedAt: overrides.contractTermsAcceptedAt ?? null,
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: 'period-m20-e2e',
              stayFrom: new Date('2027-06-10'),
              stayTo: new Date('2027-06-17'),
              baseCost: 60000,
              baseCostCurrency: 'EUR',
              rateLineId: rateLine.id,
              markupRuleId: markupRule.id,
              finalPrice: 100000,
              finalPriceCurrency: 'EUR',
              itemStatus: 'CONFIRMED',
              unitCount: 1,
            },
          ],
        },
      },
    });
    createdBookingIds.push(booking.id);

    return { supplier, contract, product, booking };
  }

  describe('§3.1/§2.2/§2.3 — automatsko generisanje ugovora', () => {
    it('generiše GENERATED ugovor sa contract_type=ORGANIZOVANO_PUTOVANJE i popunjenim sadržajem iz M2/M3', async () => {
      const { booking } = await createOrganizatorBookingFixture();

      const contract = await clientContracts.generateForBooking(booking.id);

      expect(contract!.contractType).toBe('ORGANIZOVANO_PUTOVANJE');
      expect(contract!.status).toBe('GENERATED');
      expect(typeof contract!.documentUrl).toBe('string');
      const snapshot = contract!.contentSnapshot as any;
      expect(snapshot.accommodation[0]).toMatchObject({ productName: 'Hotel M20 Test', stars: 4, boardType: 'HALF_BOARD' });
      expect(snapshot.cancellationTerms[0].rules).toEqual([expect.objectContaining({ daysBeforeStay: 30, refundPercentage: 100 })]);
    });

    it('automatski prevodi u ACCEPTED kad je clickwrap pristanak već dat pre potvrde (M8 tok)', async () => {
      const acceptedAt = new Date();
      const { booking } = await createOrganizatorBookingFixture({ contractTermsAcceptedAt: acceptedAt });

      const contract = await clientContracts.generateForBooking(booking.id);

      expect(contract!.status).toBe('ACCEPTED');
      expect(contract!.acceptedMethod).toBe('ELECTRONIC_CLICKWRAP');
    });

    it('idempotentno — drugi poziv vraća isti aktivan ugovor', async () => {
      const { booking } = await createOrganizatorBookingFixture();

      const first = await clientContracts.generateForBooking(booking.id);
      const second = await clientContracts.generateForBooking(booking.id);

      expect(second!.id).toBe(first!.id);
    });
  });

  describe('§3.2/§5 — ručno prihvatanje i poništavanje', () => {
    it('POST /client-contracts/:id/accept odbija bez M20/client-contract/ACCEPT dozvole', async () => {
      const { booking } = await createOrganizatorBookingFixture();
      const contract = await clientContracts.generateForBooking(booking.id);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.GOST);

      const res = await request(app.getHttpServer()).post(`/api/v1/client-contracts/${contract!.id}/accept`).set(authed(accessToken));

      expect(res.status).toBe(403);
    });

    it('POST /client-contracts/:id/accept postavlja ACCEPTED/WET_SIGNATURE_SCAN i upisuje HUMAN audit log', async () => {
      const { booking } = await createOrganizatorBookingFixture();
      const contract = await clientContracts.generateForBooking(booking.id);
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer()).post(`/api/v1/client-contracts/${contract!.id}/accept`).set(authed(accessToken));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.acceptedMethod).toBe('WET_SIGNATURE_SCAN');

      const auditEntries = await prisma.auditLogEntry.findMany({
        where: { module: 'M20', action: 'client_contract.accepted', resourceId: contract!.id },
      });
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].actorType).toBe('HUMAN');
      expect(auditEntries[0].actorId).toBe(user.id);
    });

    it('POST /client-contracts/:id/void zahteva M20/client-contract/VOID (Prodajni agent nema)', async () => {
      const { booking } = await createOrganizatorBookingFixture();
      const contract = await clientContracts.generateForBooking(booking.id);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);

      const res = await request(app.getHttpServer()).post(`/api/v1/client-contracts/${contract!.id}/void`).set(authed(accessToken));

      expect(res.status).toBe(403);
    });

    it('POST /client-contracts/:id/void (Vlasnik) postavlja VOIDED sa voided_by = actor', async () => {
      const { booking } = await createOrganizatorBookingFixture();
      const contract = await clientContracts.generateForBooking(booking.id);
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer()).post(`/api/v1/client-contracts/${contract!.id}/void`).set(authed(accessToken));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('VOIDED');
      expect(res.body.voidedBy).toBe(user.id);
    });
  });

  describe('§3.4 — revizija pri izmeni rezervacije', () => {
    it('voidAndRegenerateForModification poništava (sistemski) stari i generiše novu verziju koja UVEK zahteva ponovno prihvatanje', async () => {
      const acceptedAt = new Date();
      const { booking } = await createOrganizatorBookingFixture({ contractTermsAcceptedAt: acceptedAt });
      const original = await clientContracts.generateForBooking(booking.id);
      expect(original!.status).toBe('ACCEPTED'); // već prihvaćen (clickwrap)

      const revised = await clientContracts.voidAndRegenerateForModification(booking.id);

      expect(revised!.status).toBe('GENERATED'); // nikad automatski ACCEPTED posle revizije
      expect(revised!.supersedesContractId).toBe(original!.id);

      const oldContract = await prisma.clientContract.findUniqueOrThrow({ where: { id: original!.id } });
      expect(oldContract.status).toBe('VOIDED');
      expect(oldContract.voidedBy).toBeNull(); // sistemska radnja, ne ljudska
    });
  });
});
