import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { SubagentsService } from '../src/modules/m7-b2b-subagenti/subagents/subagents.service';
import { SubagentVolumeStatusService } from '../src/modules/m7-b2b-subagenti/commission/subagent-volume-status.service';
import { CommissionVolumeTiersService } from '../src/modules/m7-b2b-subagenti/commission/commission-volume-tiers.service';
import { CommissionRebatesService } from '../src/modules/m7-b2b-subagenti/commission/commission-rebates.service';
import { QuotesService } from '../src/modules/m5-rezervacije/quotes/quotes.service';
import { BookingsService } from '../src/modules/m5-rezervacije/bookings/bookings.service';
import { EventBusService } from '../src/common/events/event-bus.service';
import { FiscalDocumentsService } from '../src/modules/m10-finansije/fiscal-documents/fiscal-documents.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M7 izlaznog kriterijuma
 * (docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md poglavlje 12) koje NE
 * zavise od M15 (omnisearch §2.0.3, AI chat §2.0.4/SubagentBookingRequest/SubagentChatMessage) —
 * te stavke su namerno van obima ovog prolaza, vidi tt-m7-b2b-subagenti skill i zadatak.
 */
describe('M7 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let subagents: SubagentsService;
  let volumeStatus: SubagentVolumeStatusService;
  let volumeTiers: CommissionVolumeTiersService;
  let rebates: CommissionRebatesService;
  let quotes: QuotesService;
  let bookings: BookingsService;
  let eventBus: EventBusService;
  let fiscalDocuments: FiscalDocumentsService;
  let exchangeRateSnapshot: { id: string };

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdSubagentIds: string[] = [];
  const createdBookingIds: string[] = [];
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
    subagents = app.get(SubagentsService);
    volumeStatus = app.get(SubagentVolumeStatusService);
    volumeTiers = app.get(CommissionVolumeTiersService);
    rebates = app.get(CommissionRebatesService);
    quotes = app.get(QuotesService);
    bookings = app.get(BookingsService);
    eventBus = app.get(EventBusService);
    fiscalDocuments = app.get(FiscalDocumentsService);

    // §3.2 dopuna — approve() sad sinhrono priprema M10 KNJIZNO_ODOBRENJE nacrt, koji zahteva
    // ExchangeRateSnapshot za EUR na dan pripreme (M10 spec §3) — fixture, isti obrazac kao
    // M10 sopstveni e2e testovi koji ili koriste RSD ili unose kurs unapred.
    exchangeRateSnapshot = await prisma.exchangeRateSnapshot.create({
      data: { currency: 'EUR', rateDate: new Date(), nbsMiddleRate: 117, source: 'MANUAL' },
    });
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.travelGuaranteeRegistration.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.clientContract.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: { in: createdBookingIds } } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    await prisma.fiscalDocument.deleteMany({ where: { relatedSubagentId: { in: createdSubagentIds } } });
    await prisma.commissionRebate.deleteMany({ where: { subagentId: { in: createdSubagentIds } } });
    await prisma.subagentVolumeStatus.deleteMany({ where: { subagentId: { in: createdSubagentIds } } });
    await prisma.commissionVolumeTier.deleteMany({ where: { subagentId: { in: createdSubagentIds } } });
    if (createdSubagentIds.length) {
      // deca pre roditelja (parent_subagent_id nema DB FK ka istoj tabeli sa ON DELETE, ali
      // redosled i dalje najbezbedniji — obrni redosled kreiranja).
      await prisma.subagent.deleteMany({ where: { id: { in: createdSubagentIds } } });
    }
    if (createdProductIds.length) {
      await prisma.quote.deleteMany({ where: { items: { some: { productId: { in: createdProductIds } } } } });
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
    if (exchangeRateSnapshot) await prisma.exchangeRateSnapshot.deleteMany({ where: { id: exchangeRateSnapshot.id } });
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m7-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M7 Test Korisnik',
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

  async function createLegalEntityAccount() {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M7 Test Turagencija ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `subagent-m7-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        taxId: `TAX-M7-${testRunId}-${Math.random().toString(36).slice(2)}`,
      },
    });
    createdClientAccountIds.push(account.id);
    return account;
  }

  // Tier 1 ACTIVE subagent — najčešća fixture (SubagentsService.create + approve).
  async function createActiveSubagent(overrides: { commissionPercentage?: number; creditLimit?: number; creditLimitCurrency?: string } = {}) {
    const account = await createLegalEntityAccount();
    const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const created = await subagents.create({ clientAccountId: account.id }, { userId: staff.id });
    createdSubagentIds.push(created.id);
    const approved = await subagents.approve(
      created.id,
      { creditLimit: overrides.creditLimit ?? 1_000_000, creditLimitCurrency: overrides.creditLimitCurrency ?? 'EUR', commissionPercentage: overrides.commissionPercentage ?? 10 },
      { userId: staff.id },
    );
    return { subagent: approved, clientAccount: account };
  }

  async function createSubagentAdminUser(subagentId: string) {
    const user = await prisma.user.create({
      data: {
        email: `m7-subadmin-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M7 Test SUBAGENT_ADMIN',
        accountType: 'SUBAGENT_CONTACT',
        linkedProfileId: subagentId,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.SUBAGENT_ADMIN } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, accessToken };
  }

  async function createBooking(
    clientAccountId: string,
    overrides: Partial<{ totalPrice: number; currency: string; status: string; paymentStatus: string; confirmedAt: Date | null }> = {},
  ) {
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M7-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId,
        buyerName: 'M7 Test Subagent Booking',
        buyerType: 'FIZICKO_LICE',
        channel: 'B2B_PORTAL',
        tipNastupanja: 'ORGANIZATOR',
        status: (overrides.status as any) ?? 'CONFIRMED',
        paymentStatus: (overrides.paymentStatus as any) ?? 'UNPAID',
        totalPrice: overrides.totalPrice ?? 10000,
        currency: overrides.currency ?? 'EUR',
        confirmedAt: overrides.confirmedAt === undefined ? new Date() : overrides.confirmedAt,
        createdBy: 'e2e-test',
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  // Supplier + Contract (FIXED, kapacitetni) + Product + ContractPeriod + RateLine — za §4 test
  // "kreditni limit se proverava PRE bilo kakve rezervacije kapaciteta kod M3/M4".
  async function createBookableProductFixture() {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M7 E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-M7SUP-${testRunId}`,
        registrationNumber: `REG-M7-${testRunId}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m7-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M7-${testRunId}`,
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
        destinationCity: 'Kopaonik',
        status: 'ACTIVE',
        attributes: { stars: 4 },
        translations: {
          create: [{ languageCode: 'sr', name: 'Hotel M7 Test', description: 'opis', slug: `hotel-m7-${testRunId}-${Math.random().toString(36).slice(2)}` }],
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
        allotmentMode: 'FIXED',
        totalCapacity: 5,
        cancellationRules: { create: [{ daysBeforeStay: 30, refundPercentage: 100 }] },
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: { contractPeriodId: contractPeriod.id, boardType: 'HALF_BOARD', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: 10000 },
    });

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { product, rateLine, markupRule, contractPeriod };
  }

  describe('§9 — odobravanje novog subagenta', () => {
    it('registracija ostaje PENDING_APPROVAL i ne može da naruči dok se ne odobri', async () => {
      const account = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const created = await subagents.create({ clientAccountId: account.id }, { userId: staff.id });
      createdSubagentIds.push(created.id);
      expect(created.status).toBe('PENDING_APPROVAL');

      const bookingsBefore = await prisma.booking.count({ where: { clientAccountId: account.id } });
      const quote = await quotes.create({ channel: 'B2B_PORTAL', clientAccountId: account.id, items: [] } as any, { userId: undefined });
      await expect(bookings.confirmQuote(quote.id, { buyerName: 'Test', buyerType: 'FIZICKO_LICE' } as any, { userId: staff.id })).rejects.toThrow();
      expect(await prisma.booking.count({ where: { clientAccountId: account.id } })).toBe(bookingsBefore);

      const approved = await subagents.approve(created.id, { creditLimit: 5000, creditLimitCurrency: 'EUR', commissionPercentage: 10 }, { userId: staff.id });
      expect(approved.status).toBe('ACTIVE');
      expect(Number(approved.creditLimit)).toBe(5000);
    });
  });

  describe('§3 — kaskadna provizija: ko postavlja i ograda', () => {
    it('Tier 1 proviziju postavlja isključivo agencija (approve popunjava commission_percentage)', async () => {
      const { subagent } = await createActiveSubagent({ commissionPercentage: 12 });
      expect(Number(subagent.commissionPercentage)).toBe(12);
    });

    it('sub-subagent ne sme dobiti veću proviziju od roditeljeve — odbijeno pri kreiranju', async () => {
      const { subagent: parent } = await createActiveSubagent({ commissionPercentage: 10 });
      const childAccount = await createLegalEntityAccount();

      await expect(
        subagents.createChild(parent.id, { clientAccountId: childAccount.id, commissionPercentage: 15 }, { userId: (await createInternalUser(SYSTEM_ROLES.VLASNIK)).user.id }),
      ).rejects.toThrow();
    });

    it('sub-subagent sa dozvoljenom provizijom se kreira, i PATCH .../commission poštuje istu ogradu', async () => {
      const { subagent: parent } = await createActiveSubagent({ commissionPercentage: 10 });
      const childAccount = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const child = await subagents.createChild(parent.id, { clientAccountId: childAccount.id, commissionPercentage: 8 }, { userId: staff.id });
      createdSubagentIds.push(child.id);
      expect(Number(child.commissionPercentage)).toBe(8);

      // Roditeljski autoritet: pokušaj da postavi proviziju deteta iznad roditeljeve (10%) — odbijeno.
      const parentEffective = await volumeStatus.getEffectiveCommissionPercentage(parent.id);
      await expect(
        subagents.updateChildCommission(parent.id, child.id, { commissionPercentage: 20 }, { userId: staff.id }, parentEffective),
      ).rejects.toThrow();

      const updated = await subagents.updateChildCommission(parent.id, child.id, { commissionPercentage: 9 }, { userId: staff.id }, parentEffective);
      expect(Number(updated.commissionPercentage)).toBe(9);
    });
  });

  describe('§4 — kreditni limit sprovodi se PRE bilo kakve rezervacije kod M3/M4', () => {
    it('rezervacija koja bi prekoračila kreditni limit se odbija, i nijedna rezervacija kapaciteta se ne dešava', async () => {
      const { clientAccount } = await createActiveSubagent({ commissionPercentage: 5, creditLimit: 1, creditLimitCurrency: 'EUR' });
      const { product, rateLine, contractPeriod } = await createBookableProductFixture();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const quote = await quotes.create(
        {
          channel: 'B2B_PORTAL',
          clientAccountId: clientAccount.id,
          contractTermsAccepted: true,
          items: [
            {
              productId: product.id,
              rateLineId: rateLine.id,
              stayFrom: '2027-06-10',
              stayTo: '2027-06-17',
              occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
            },
          ],
        } as any,
        { userId: undefined },
      );

      const before = await prisma.contractPeriod.findUniqueOrThrow({ where: { id: contractPeriod.id } });
      expect(before.unitsSold).toBe(0);

      await expect(
        bookings.confirmQuote(quote.id, { buyerName: 'M7 E2E', buyerType: 'FIZICKO_LICE' } as any, { userId: staff.id }),
      ).rejects.toThrow(/kreditnog limita/);

      const after = await prisma.contractPeriod.findUniqueOrThrow({ where: { id: contractPeriod.id } });
      expect(after.unitsSold).toBe(0); // M3 rezervacija kapaciteta se NIJE desila (M5 spec §4 korak 1b pre koraka 2/3)
      expect(await prisma.booking.count({ where: { clientAccountId: clientAccount.id } })).toBe(0);
    });

    it('rezervacija unutar kredita prolazi normalno kroz confirmQuote', async () => {
      const { clientAccount } = await createActiveSubagent({ commissionPercentage: 5, creditLimit: 1_000_000, creditLimitCurrency: 'EUR' });
      const { product, rateLine } = await createBookableProductFixture();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const quote = await quotes.create(
        {
          channel: 'B2B_PORTAL',
          clientAccountId: clientAccount.id,
          contractTermsAccepted: true,
          items: [
            {
              productId: product.id,
              rateLineId: rateLine.id,
              stayFrom: '2027-06-10',
              stayTo: '2027-06-17',
              occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
            },
          ],
        } as any,
        { userId: undefined },
      );

      const booking: any = await bookings.confirmQuote(quote.id, { buyerName: 'M7 E2E OK', buyerType: 'FIZICKO_LICE' } as any, { userId: staff.id });
      createdBookingIds.push(booking.id);
      expect(booking.status).toBe('CONFIRMED');
    });
  });

  describe('§5 — cena za subagenta (effective_commission_percentage umesto M6 lojalnosti)', () => {
    it('POST /sales/quotes primenjuje proviziju subagenta umesto marže bez popusta', async () => {
      const { clientAccount } = await createActiveSubagent({ commissionPercentage: 15 });
      const { product, rateLine } = await createBookableProductFixture();

      const itemInput = {
        productId: product.id,
        rateLineId: rateLine.id,
        stayFrom: '2027-06-10',
        stayTo: '2027-06-17',
        occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
      };

      const subagentQuote = await quotes.create({ channel: 'B2B_PORTAL', clientAccountId: clientAccount.id, items: [itemInput] } as any, { userId: undefined });
      const baselineQuote = await quotes.create({ channel: 'B2B_PORTAL', items: [itemInput] } as any, { userId: undefined });

      const discounted = subagentQuote.items[0].finalPrice;
      const baseline = baselineQuote.items[0].finalPrice;
      expect(discounted).toBe(Math.round(baseline * 0.85));
    });

    it('LEGAL_ENTITY ClientAccount BEZ Subagent zapisa dobija standardnu M5/M6 cenu, ne proviziju', async () => {
      const account = await createLegalEntityAccount(); // LEGAL_ENTITY, ali NEMA Subagent zapis
      const { product, rateLine } = await createBookableProductFixture();

      const itemInput = {
        productId: product.id,
        rateLineId: rateLine.id,
        stayFrom: '2027-06-10',
        stayTo: '2027-06-17',
        occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
      };

      const quote = await quotes.create({ channel: 'B2C_SITE', clientAccountId: account.id, items: [itemInput] } as any, { userId: undefined });
      const baseline = await quotes.create({ channel: 'B2C_SITE', items: [itemInput] } as any, { userId: undefined });

      expect(quote.items[0].finalPrice).toBe(baseline.items[0].finalPrice); // nema provizije, nema lojalnosti
    });
  });

  describe('§6 — vidljivost kroz hijerarhiju', () => {
    it('subagent vidi direktnu decu (naziv/status/provizija/kredit), ali agencija vidi ceo lanac', async () => {
      const { subagent: parent } = await createActiveSubagent({ commissionPercentage: 10 });
      const childAccount = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const child = await subagents.createChild(parent.id, { clientAccountId: childAccount.id, commissionPercentage: 8 }, { userId: staff.id });
      createdSubagentIds.push(child.id);

      const { user: parentUser } = await createSubagentAdminUser(parent.id);
      const childrenSeenByParent = await subagents.children(parent.id, { userId: parentUser.id });
      expect(childrenSeenByParent.map((c) => c.id)).toEqual([child.id]);

      const childrenSeenByAgency = await subagents.children(parent.id, { userId: staff.id });
      expect(childrenSeenByAgency.map((c) => c.id)).toEqual([child.id]);
    });

    it('subagent NE može da vidi rezervacije svog sub-subagenta (samo sopstvene)', async () => {
      const { subagent: parent, clientAccount: parentAccount } = await createActiveSubagent({ commissionPercentage: 10 });
      const childAccount = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const child = await subagents.createChild(parent.id, { clientAccountId: childAccount.id, commissionPercentage: 8 }, { userId: staff.id });
      const approvedChild = await subagents.approve(child.id, { creditLimit: 100_000, creditLimitCurrency: 'EUR' }, { userId: staff.id });
      createdSubagentIds.push(child.id);
      void approvedChild;

      await createBooking(parentAccount.id);
      await createBooking(childAccount.id);

      const { user: parentPortalUser } = await createSubagentAdminUser(parent.id);
      // Straničen odgovor od 5.9.2026 (dok. 39 nalaz 2.2) — redovi su u `.data`.
      const visible = await bookings.findAll({}, { userId: parentPortalUser.id });
      expect(visible.data.every((b: any) => b.clientAccountId === parentAccount.id)).toBe(true);
      expect(visible.data.some((b: any) => b.clientAccountId === childAccount.id)).toBe(false);
    });
  });

  describe('§3.1 — automatski preračun obimskog bonusa (booking.confirmed) i primena u sledećoj ponudi', () => {
    it('prelazak praga (BOOKING_COUNT) automatski podiže effective_commission_percentage, sledeća ponuda odražava novu cenu', async () => {
      const { subagent, clientAccount } = await createActiveSubagent({ commissionPercentage: 5 });
      const tier = await volumeTiers.create(
        subagent.id,
        { rank: 1, thresholdMetric: 'BOOKING_COUNT', thresholdPeriod: 'CALENDAR_YEAR', thresholdValue: 1, resultingCommissionPercentage: 25 },
        { userId: (await createInternalUser(SYSTEM_ROLES.VLASNIK)).user.id },
      );
      expect(tier.rank).toBe(1);

      await createBooking(clientAccount.id);
      await volumeStatus.recalculate(subagent.id); // isti efekat kao M7EventSubscribersService na booking.confirmed

      const status = await volumeStatus.get(subagent.id);
      expect(Number(status.effectiveCommissionPercentage)).toBe(25);

      const { product, rateLine } = await createBookableProductFixture();
      const itemInput = {
        productId: product.id,
        rateLineId: rateLine.id,
        stayFrom: '2027-06-10',
        stayTo: '2027-06-17',
        occupancy: { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
      };
      const newQuote = await quotes.create({ channel: 'B2B_PORTAL', clientAccountId: clientAccount.id, items: [itemInput] } as any, { userId: undefined });
      const baseline = await quotes.create({ channel: 'B2B_PORTAL', items: [itemInput] } as any, { userId: undefined });
      expect(newQuote.items[0].finalPrice).toBe(Math.round(baseline.items[0].finalPrice * 0.75));
    });

    it('M7EventSubscribersService preračunava i preko pravog M5 Event Bus-a (booking.confirmed)', async () => {
      const { subagent, clientAccount } = await createActiveSubagent({ commissionPercentage: 5 });
      await volumeTiers.create(
        subagent.id,
        { rank: 1, thresholdMetric: 'BOOKING_COUNT', thresholdPeriod: 'CALENDAR_YEAR', thresholdValue: 1, resultingCommissionPercentage: 30 },
        { userId: (await createInternalUser(SYSTEM_ROLES.VLASNIK)).user.id },
      );
      const booking = await createBooking(clientAccount.id);

      await eventBus.emit('M5', 'booking.confirmed', { bookingId: booking.id });
      await new Promise((resolve) => setTimeout(resolve, 500)); // async LISTEN/NOTIFY — vidi M6 e2e isti obrazac

      const status = await volumeStatus.get(subagent.id);
      expect(Number(status.effectiveCommissionPercentage)).toBe(30);
    });
  });

  describe('§3.1 — upozorenje kad roditeljeva efektivna provizija padne ispod već postavljene provizije deteta', () => {
    it('preračun roditelja generiše audit log upozorenje, NE menja tiho proviziju deteta', async () => {
      const { subagent: parent } = await createActiveSubagent({ commissionPercentage: 20 });
      const childAccount = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      // Dete dobija 18% dok je roditelj na 20% — u granici.
      const child = await subagents.createChild(parent.id, { clientAccountId: childAccount.id, commissionPercentage: 18 }, { userId: staff.id });
      createdSubagentIds.push(child.id);

      // Roditeljev preračun sad ispadne NIŽI od 20% (nema tier-a koji bi ga održao, a base ostaje 20%
      // osim ako simuliramo pad — ovde direktno testiramo upozorenje pozivom sa veštački niskom
      // "novom" efektivnom vrednošću preko privremenog CommissionVolumeTier koji ne dostiže prag,
      // pa se koristi baza; da bismo simulirali PAD, privremeno menjamo Subagent.commissionPercentage
      // na 10% (npr. agencija ručno umanjila) i preračunavamo.
      await prisma.subagent.update({ where: { id: parent.id }, data: { commissionPercentage: 10 } });
      await volumeStatus.recalculate(parent.id);

      const status = await volumeStatus.get(parent.id);
      expect(Number(status.effectiveCommissionPercentage)).toBe(10);

      const childAfter = await prisma.subagent.findUniqueOrThrow({ where: { id: child.id } });
      expect(Number(childAfter.commissionPercentage)).toBe(18); // NIJE tiho promenjeno

      const warnings = await prisma.auditLogEntry.findMany({
        where: { module: 'M7', action: 'subagent.commission_ceiling_warning', resourceId: child.id },
      });
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('§3.2 — retroaktivni rabat na prelazak retroactive praga usred perioda', () => {
    it('kreira CommissionRebate DRAFT sa ispravno izračunatim iznosom; APPLIED tek posle ljudskog odobrenja', async () => {
      const { subagent, clientAccount } = await createActiveSubagent({ commissionPercentage: 5 });
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      // Prvi preračun — bez tier-a, uspostavlja bazno stanje (5%).
      await volumeStatus.recalculate(subagent.id);

      // Dve rezervacije potvrđene u tekućoj kalendarskoj godini, ukupno 20000 EUR.
      const booking1 = await createBooking(clientAccount.id, { totalPrice: 10000, currency: 'EUR' });
      const booking2 = await createBooking(clientAccount.id, { totalPrice: 10000, currency: 'EUR' });
      void booking1;
      void booking2;

      const tier = await volumeTiers.create(
        subagent.id,
        {
          rank: 1,
          thresholdMetric: 'BOOKING_COUNT',
          thresholdPeriod: 'CALENDAR_YEAR',
          thresholdValue: 2,
          resultingCommissionPercentage: 15,
          retroactive: true,
        },
        { userId: staff.id },
      );

      await volumeStatus.recalculate(subagent.id); // prelazak praga usred perioda (2 rezervacije već potvrđene)

      const status = await volumeStatus.get(subagent.id);
      expect(Number(status.effectiveCommissionPercentage)).toBe(15);
      expect(status.currentTierId).toBe(tier.id);

      const rebateList = await rebates.findMany(subagent.id);
      expect(rebateList.length).toBe(1);
      const rebate = rebateList[0];
      expect(rebate.status).toBe('DRAFT');
      // (10000 + 10000) * (15-5)/100 = 2000
      expect(Number(rebate.calculatedAmount)).toBe(2000);

      // approve() je ljudska odluka: DRAFT → APPROVED, appliedAt ostaje prazno dok M10 stvarno
      // ne pošalje knjižno odobrenje (M7 spec §3.2, dopuna avgust 2026 — vidi §3.2a test ispod).
      const approved = await rebates.approve(rebate.id, { userId: staff.id });
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedAt).not.toBeNull();
      expect(approved.appliedAt).toBeNull();
    });

    it('DRAFT rabat se odbacuje sa razlogom kad se odluči da se ne primeni', async () => {
      const { subagent, clientAccount } = await createActiveSubagent({ commissionPercentage: 5 });
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      await volumeStatus.recalculate(subagent.id);
      await createBooking(clientAccount.id, { totalPrice: 5000, currency: 'EUR' });

      await volumeTiers.create(
        subagent.id,
        { rank: 1, thresholdMetric: 'BOOKING_COUNT', thresholdPeriod: 'CALENDAR_YEAR', thresholdValue: 1, resultingCommissionPercentage: 20, retroactive: true },
        { userId: staff.id },
      );
      await volumeStatus.recalculate(subagent.id);

      const [rebate] = await rebates.findMany(subagent.id);
      const rejected = await rebates.reject(rebate.id, 'Interni dogovor — ne primenjuje se ovog kvartala', { userId: staff.id });
      expect(rejected.status).toBe('REJECTED');
    });
  });

  describe('§3.2 dopuna (avgust 2026) — kraj-do-kraja povezivanje sa M10 (KNJIZNO_ODOBRENJE)', () => {
    it('approve() automatski priprema M10 KNJIZNO_ODOBRENJE nacrt sa ispravnim buyer_name_snapshot/amount/creditedRebateId; submit() vraća M7 rabat u APPLIED', async () => {
      const { subagent, clientAccount } = await createActiveSubagent({ commissionPercentage: 5 });
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      await volumeStatus.recalculate(subagent.id);
      await createBooking(clientAccount.id, { totalPrice: 10000, currency: 'EUR' });
      await createBooking(clientAccount.id, { totalPrice: 10000, currency: 'EUR' });

      await volumeTiers.create(
        subagent.id,
        { rank: 1, thresholdMetric: 'BOOKING_COUNT', thresholdPeriod: 'CALENDAR_YEAR', thresholdValue: 2, resultingCommissionPercentage: 15, retroactive: true },
        { userId: staff.id },
      );
      await volumeStatus.recalculate(subagent.id);

      const [rebate] = await rebates.findMany(subagent.id);
      expect(rebate.status).toBe('DRAFT');

      // approve() (M7 spec §3.2) → DRAFT → APPROVED + sinhrono priprema M10 nacrt preko
      // FiscalDocumentStubService (M10 spec §5.1a dopuna).
      const approved = await rebates.approve(rebate.id, { userId: staff.id });
      expect(approved.status).toBe('APPROVED');

      const creditNote = await prisma.fiscalDocument.findFirst({ where: { creditedRebateId: rebate.id } });
      expect(creditNote).not.toBeNull();
      expect(creditNote!.documentType).toBe('KNJIZNO_ODOBRENJE');
      expect(creditNote!.bookingId).toBeNull();
      expect(creditNote!.relatedSubagentId).toBe(subagent.id);
      expect(Number(creditNote!.amountOriginal)).toBe(Number(rebate.calculatedAmount));
      expect(creditNote!.currencyOriginal).toBe(rebate.currency);
      expect(creditNote!.buyerNameSnapshot).toBe(clientAccount.companyName); // stvarno ime firme iz M6, ne prazan string

      // submit() (M10 spec §6, ljudski nalog) — kad je KNJIZNO_ODOBRENJE stvarno poslat, M10
      // emituje Event Bus 'credit_note.submitted' koji M7EventSubscribersService sluša i zove
      // CommissionRebatesService.markApplied — APPROVED → APPLIED tek sad, ne pri odobrenju.
      await fiscalDocuments.submit(creditNote!.id, { userId: staff.id });
      await new Promise((resolve) => setTimeout(resolve, 500)); // async LISTEN/NOTIFY, isti obrazac kao §3.1 test iznad

      const rebateAfterSubmit = await rebates.findOneOrThrow(rebate.id);
      expect(rebateAfterSubmit.status).toBe('APPLIED');
      expect(rebateAfterSubmit.appliedAt).not.toBeNull();
    });
  });

  describe('§8/§10 — SUBAGENT_ADMIN uloga i dozvole', () => {
    it('SUBAGENT_ADMIN nalog postoji u katalogu uloga i ima M7/subagent/VIEW dozvolu preko role dodele', async () => {
      const { subagent } = await createActiveSubagent({ commissionPercentage: 10 });
      const { accessToken } = await createSubagentAdminUser(subagent.id);

      const res = await request(app.getHttpServer()).get(`/api/v1/b2b/subagents/${subagent.id}`).set(authed(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(subagent.id);
    });

    it('SUBAGENT_ADMIN ne može da odobri subagenta (M7/subagent/APPROVE nedostaje)', async () => {
      const account = await createLegalEntityAccount();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const pending = await subagents.create({ clientAccountId: account.id }, { userId: staff.id });
      createdSubagentIds.push(pending.id);
      const { subagent: someActive } = await createActiveSubagent({});
      const { accessToken } = await createSubagentAdminUser(someActive.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/b2b/subagents/${pending.id}/approve`)
        .set(authed(accessToken))
        .send({ creditLimit: 1000, creditLimitCurrency: 'EUR', commissionPercentage: 10 });

      expect(res.status).toBe(403);
    });
  });
});
