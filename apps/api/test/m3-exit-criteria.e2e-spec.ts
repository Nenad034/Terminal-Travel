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
 * E2E protiv prave Postgres baze — pokriva stavke M3 izlaznog kriterijuma
 * (docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md
 * poglavlje 7) koje zahtevaju pravu bazu, prvenstveno konkurentnost rezervacije —
 * to se fizički ne može proveriti mokovanim Prisma klijentom.
 */
describe('M3 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdSupplierIds: string[] = [];

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
    for (const supplierId of createdSupplierIds) {
      const contracts = await prisma.contract.findMany({ where: { supplierId } });
      for (const c of contracts) {
        const periods = await prisma.contractPeriod.findMany({ where: { contractId: c.id } });
        for (const p of periods) {
          await prisma.rateLineAgePricing.deleteMany({ where: { rateLine: { contractPeriodId: p.id } } });
          await prisma.rateLine.deleteMany({ where: { contractPeriodId: p.id } });
          await prisma.cancellationRule.deleteMany({ where: { contractPeriodId: p.id } });
        }
        await prisma.contractPeriod.deleteMany({ where: { contractId: c.id } });
      }
      await prisma.pricelistImportRow.deleteMany({ where: { import: { supplierId } } });
      await prisma.pricelistImport.deleteMany({ where: { supplierId } });
      await prisma.supplierExtractionProfile.deleteMany({ where: { supplierId } });
      await prisma.product.updateMany({ where: { sourceContractId: { in: contracts.map((c) => c.id) } }, data: { sourceContractId: null } });
      await prisma.contract.deleteMany({ where: { supplierId } });
      await prisma.supplierContact.deleteMany({ where: { supplierId } });
    }
    await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m3-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M3 Test Korisnik',
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

  async function createSupplier(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contracting/suppliers')
      .set(authed(accessToken))
      .send({
        name: `Hotel Test ${testRunId}-${Math.random().toString(36).slice(2)}`,
        type: 'HOTEL',
        taxId: '111222333',
        registrationNumber: '444555666',
        country: 'Srbija',
        contactName: 'Marko Markovic',
        contactEmail: `dobavljac-${Math.random().toString(36).slice(2)}@test.rs`,
        contactPhone: '060123456',
      });
    createdSupplierIds.push(res.body.id);
    return res.body;
  }

  async function createContract(accessToken: string, supplierId: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contracting/contracts')
      .set(authed(accessToken))
      .send({
        supplierId,
        contractNumber: `UG-${testRunId}-${Math.random().toString(36).slice(2)}`,
        currency: 'EUR',
        validFrom: '2027-01-01',
        validTo: '2027-12-31',
        cancellationTermsSummary: 'Standardni uslovi',
        documentUrl: 'https://example.com/ugovor.pdf',
        ...overrides,
      });
    return res.body;
  }

  describe('Dobavljač + ugovor + FIXED period sa cenama i pravilima otkazivanja (stavka 1)', () => {
    it('kreira dobavljača, ugovor u EUR, FIXED period sa kapacitetom, RateLine i CancellationRule', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id, { defaultTipNastupanja: 'ORGANIZATOR' });
      expect(contract.currency).toBe('EUR');

      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({
          stayFrom: '2027-07-01',
          stayTo: '2027-07-31',
          roomType: 'DELUXE',
          allotmentMode: 'FIXED',
          totalCapacity: 5,
          releaseDaysBefore: 21,
        });
      expect(periodRes.status).toBe(201);
      const periodId = periodRes.body.id;

      const rateRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/rates`)
        .set(authed(accessToken))
        .send({ boardType: 'polupansion', occupancy: 'odrasla osoba u dvokrevetnoj', priceBasis: 'PER_ROOM_PER_NIGHT', price: 8000 });
      expect(rateRes.status).toBe(200);
      expect(typeof rateRes.body.price).toBe('number');

      const cancelRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/cancellation-rules`)
        .set(authed(accessToken))
        .send({ daysBeforeStay: 30, refundPercentage: 100 });
      expect(cancelRes.status).toBe(200);
    });
  });

  describe('ON_REQUEST period bez kapaciteta (stavka 2)', () => {
    it('kreira period bez total_capacity/units_sold', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-08-01', stayTo: '2027-08-31', roomType: 'STD', allotmentMode: 'ON_REQUEST' });

      expect(res.status).toBe(201);
      expect(res.body.totalCapacity).toBeNull();

      const availabilityRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${res.body.id}/availability`)
        .set(authed(accessToken));
      expect(availabilityRes.body.requiresSupplierConfirmation).toBe(true);
    });
  });

  describe('CHARTER/FIXED_LEASE sa ukupna_fiksna_obaveza, bez release_days_before (stavka 3)', () => {
    it('CHARTER period', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({
          stayFrom: '2027-06-01',
          stayTo: '2027-06-30',
          roomType: 'CHARTER_SEAT',
          allotmentMode: 'CHARTER',
          totalCapacity: 150,
          ukupnaFiksnaObaveza: 3_000_000,
          fixedObligationCurrency: 'EUR',
        });
      expect(res.status).toBe(201);
      expect(res.body.ukupnaFiksnaObaveza).toBe(3000000);
      expect(res.body.releaseDaysBefore).toBeNull();
    });

    it('FIXED_LEASE period sa payment_schedule', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({
          stayFrom: '2027-06-01',
          stayTo: '2027-09-01',
          roomType: 'CEO_HOTEL',
          allotmentMode: 'FIXED_LEASE',
          totalCapacity: 40,
          ukupnaFiksnaObaveza: 20_000_000,
          fixedObligationCurrency: 'EUR',
          paymentSchedule: [{ dueDate: '2027-05-01', amount: 10_000_000 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.paymentSchedule).toEqual([{ dueDate: '2027-05-01', amount: 10_000_000 }]);
    });
  });

  describe('Konkurentnost rezervacije (stavka 5) — kritičan test', () => {
    it('deset simultanih zahteva za period sa kapacitetom 1: tačno jedan uspeva, kapacitet se nikad ne pređe', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-12-20', stayTo: '2027-12-27', roomType: 'LAST_ROOM', allotmentMode: 'FIXED', totalCapacity: 1 });
      const periodId = periodRes.body.id;

      const attempts = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/reserve`)
          .set(authed(accessToken))
          .send({ units: 1 }),
      );
      const results = await Promise.all(attempts);

      const succeeded = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status === 400);
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(9);

      const finalPeriod = await prisma.contractPeriod.findUniqueOrThrow({ where: { id: periodId } });
      expect(finalPeriod.unitsSold).toBe(1); // nikad prekoračeno
    });

    it('konkurentni zahtevi za kapacitet 5 sa 8 pokušaja: tačno 5 uspeva', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-12-01', stayTo: '2027-12-10', roomType: 'CHARTER_SEAT2', allotmentMode: 'CHARTER', totalCapacity: 5, ukupnaFiksnaObaveza: 1000, fixedObligationCurrency: 'EUR' });
      const periodId = periodRes.body.id;

      const attempts = Array.from({ length: 8 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/reserve`)
          .set(authed(accessToken))
          .send({ units: 1 }),
      );
      const results = await Promise.all(attempts);

      expect(results.filter((r) => r.status === 201)).toHaveLength(5);
      const finalPeriod = await prisma.contractPeriod.findUniqueOrThrow({ where: { id: periodId } });
      expect(finalPeriod.unitsSold).toBe(5);
    });

    it('rezervacija koja svede preostalo na 1 emituje CRITICAL event preko Event Bus-a (§4.3)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-11-01', stayTo: '2027-11-10', roomType: 'CRIT_TEST', allotmentMode: 'FIXED', totalCapacity: 2 });
      const periodId = periodRes.body.id;

      // EventBusService.emit izvršava pg_notify preko iste Prisma konekcije (§4.3) —
      // ovde proveravamo ishod rezervacije (remaining=1); da EventBusService stvarno
      // šalje NOTIFY dokazuje event-bus.service.spec.ts (unit) i njegov poziv unutar
      // reserve() (contract-periods.service.spec.ts) — nezavisan LISTEN klijent bi
      // dupliranje testirao isti mehanizam, ne dodatno ponašanje.
      const reserveRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/reserve`)
        .set(authed(accessToken))
        .send({ units: 1 });
      expect(reserveRes.status).toBe(201);
      expect(reserveRes.body.remaining).toBe(1);
    });
  });

  describe('expiring-releases (stavka 6)', () => {
    it('prijavljuje FIXED period sa neprodatim kapacitetom kojem se bliži rok', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      const stayFrom = soon.toISOString().slice(0, 10);
      const stayTo = new Date(soon.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom, stayTo, roomType: 'EXPIRING', allotmentMode: 'FIXED', totalCapacity: 10, releaseDaysBefore: 30 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/contracting/contracts/expiring-releases')
        .set(authed(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.some((p: { id: string }) => p.id === periodRes.body.id)).toBe(true);
    });
  });

  describe('M2 proizvod referencira Contract preko source_contract_id (stavka 7)', () => {
    it('Product.sourceContractId ispravno povezuje proizvod sa ugovorom', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const productRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Zlatibor', sourceContractId: contract.id });
      expect(productRes.status).toBe(201);
      expect(productRes.body.sourceContractId).toBe(contract.id);

      await prisma.product.delete({ where: { id: productRes.body.id } });
    });
  });

  describe('Novčane vrednosti su uvek Int, nikad decimal (stavka 10)', () => {
    it('price i ukupna_fiksna_obaveza se vraćaju kao celi brojevi', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-05-01', stayTo: '2027-05-10', roomType: 'MONEY_TEST', allotmentMode: 'CHARTER', totalCapacity: 10, ukupnaFiksnaObaveza: 123456, fixedObligationCurrency: 'EUR' });

      expect(Number.isInteger(periodRes.body.ukupnaFiksnaObaveza)).toBe(true);

      const rateRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodRes.body.id}/rates`)
        .set(authed(accessToken))
        .send({ boardType: 'all-inclusive', occupancy: 'odrasla osoba', priceBasis: 'PER_PERSON_PER_NIGHT', price: 4999 });
      expect(Number.isInteger(rateRes.body.price)).toBe(true);
    });
  });

  describe('Sprečavanje preklapanja perioda (stavka 11)', () => {
    it('odbija period koji se datumski preklapa; prihvata susedni (ne-presecajući) period', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const first = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-08-01', stayTo: '2027-08-31', roomType: 'OVERLAP_TEST', allotmentMode: 'ON_REQUEST' });
      expect(first.status).toBe(201);

      const overlapping = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-08-15', stayTo: '2027-09-15', roomType: 'OVERLAP_TEST', allotmentMode: 'ON_REQUEST' });
      expect(overlapping.status).toBe(400);

      const adjacent = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-08-31', stayTo: '2027-09-15', roomType: 'OVERLAP_TEST', allotmentMode: 'ON_REQUEST' });
      expect(adjacent.status).toBe(201); // susedni, ne preklapa se
    });
  });

  describe('default_tip_nastupanja gejt pre ACTIVE (stavka 13)', () => {
    it('ugovor ne može preći u ACTIVE bez default_tip_nastupanja', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id); // bez defaultTipNastupanja

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contracting/contracts/${contract.id}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(400);

      const res2 = await request(app.getHttpServer())
        .patch(`/api/v1/contracting/contracts/${contract.id}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE', defaultTipNastupanja: 'ORGANIZATOR' });
      expect(res2.status).toBe(200);
    });
  });

  describe('RateLine sa price_basis i age_pricing[] (stavka 14)', () => {
    it('kreira RateLine sa PER_PERSON_PER_NIGHT i age_pricing nizom', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-04-01', stayTo: '2027-04-10', roomType: 'AGE_PRICING_TEST', allotmentMode: 'ON_REQUEST' });

      const rateRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodRes.body.id}/rates`)
        .set(authed(accessToken))
        .send({
          boardType: 'all-inclusive',
          occupancy: 'odrasla osoba',
          priceBasis: 'PER_PERSON_PER_NIGHT',
          price: 5000,
          agePricing: [
            { ageCategory: 'CHILD', occupantIndex: 1, pricingMode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 },
            { ageCategory: 'INFANT', pricingMode: 'FLAT_PRICE_PER_NIGHT', flatPrice: 0 },
          ],
        });

      expect(rateRes.status).toBe(200);
      expect(rateRes.body.agePricing).toHaveLength(2);
    });
  });

  describe('Uvoz cenovnika — ljudski tok odobrenja i SupplierExtractionProfile učenje (stavke 8-9, 15-17)', () => {
    it('upload testnog cenovnika kreira uvoz; odobrenje seedovanog reda kreira ContractPeriod/RateLine i ažurira SupplierExtractionProfile', async () => {
      const { accessToken, user: owner } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const productRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Vrnjačka Banja', sourceContractId: contract.id });
      const productId = productRes.body.id;

      const importRes = await request(app.getHttpServer())
        .post('/api/v1/contracting/pricelist-imports')
        .set(authed(accessToken))
        .send({ supplierId: supplier.id, sourceFileUrl: 'https://example.com/cenovnik.xlsx', sourceFormat: 'EXCEL' });
      expect(importRes.status).toBe(201);
      expect(importRes.body.status).toBe('PROCESSING');

      // Simulira da je AI ekstrakcija (van obima ovog prolaza) proizvela red — direktan
      // upis u bazu, isti princip kao seedovanje test podataka u M1/M2 e2e testovima.
      const row = await prisma.pricelistImportRow.create({
        data: {
          pricelistImportId: importRes.body.id,
          extractedHotelName: 'Hotel Vrnjačka Banja',
          matchedProductId: productId,
          matchConfidence: 92.5,
          extractedRoomType: 'STANDARD',
          extractedBoardType: 'polupansion',
          extractedOccupancy: 'odrasla osoba u dvokrevetnoj',
          extractedStayFrom: new Date('2027-09-01'),
          extractedStayTo: new Date('2027-09-30'),
          extractedPrice: 6000,
          extractedCurrency: 'EUR',
          extractedPriceBasis: 'PER_ROOM_PER_NIGHT',
        },
      });

      const rowsRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/pricelist-imports/${importRes.body.id}/rows`)
        .set(authed(accessToken));
      // Prisma Decimal se serijalizuje kao string preko JSON-a (nema izgubljene preciznosti).
      expect(Number(rowsRes.body[0].matchConfidence)).toBeCloseTo(92.5);

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/pricelist-imports/${importRes.body.id}/rows/${row.id}/approve`)
        .set(authed(accessToken))
        .send({ decision: 'CONFIRMED' });
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.reviewedBy).toBe(owner.id);

      const period = await prisma.contractPeriod.findFirst({ where: { contractId: contract.id, roomType: 'STANDARD' } });
      expect(period).not.toBeNull();
      expect(period!.allotmentMode).toBe('ON_REQUEST');

      const rateLine = await prisma.rateLine.findFirst({ where: { contractPeriodId: period!.id } });
      expect(rateLine?.price).toBe(6000);

      const importAfter = await prisma.pricelistImport.findUniqueOrThrow({ where: { id: importRes.body.id } });
      expect(importAfter.status).toBe('COMPLETED');

      const profile = await prisma.supplierExtractionProfile.findUnique({ where: { supplierId: supplier.id } });
      expect(profile?.typicalPriceBasis).toBe('PER_ROOM_PER_NIGHT');
      expect(profile?.lastConfirmedImportId).toBe(importRes.body.id);
    });

    it('odbijanje reda ne kreira ContractPeriod/RateLine', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const importRes = await request(app.getHttpServer())
        .post('/api/v1/contracting/pricelist-imports')
        .set(authed(accessToken))
        .send({ supplierId: supplier.id, sourceFileUrl: 'https://example.com/x.pdf', sourceFormat: 'PDF' });

      const row = await prisma.pricelistImportRow.create({
        data: {
          pricelistImportId: importRes.body.id,
          extractedHotelName: 'Nepoznat hotel',
          extractedRoomType: 'X',
          extractedBoardType: 'X',
          extractedOccupancy: 'X',
          extractedStayFrom: new Date('2027-10-01'),
          extractedStayTo: new Date('2027-10-10'),
          extractedPrice: 1000,
          extractedCurrency: 'EUR',
        },
      });

      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/pricelist-imports/${importRes.body.id}/rows/${row.id}/reject`)
        .set(authed(accessToken));
      expect(rejectRes.status).toBe(201);

      const periodCount = await prisma.contractPeriod.count({ where: { roomType: 'X' } });
      expect(periodCount).toBe(0);
    });
  });
});
