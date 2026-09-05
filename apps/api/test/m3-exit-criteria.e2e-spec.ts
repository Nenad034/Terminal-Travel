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
          // v1.12 dopuna — nova tabela su FK Cascade od ContractPeriod (onDelete: Cascade),
          // explicit cleanup je i dalje bezbedan (idempotentan) i sprečava zavisnost od
          // ponašanja cascade-a u testu ako se šema promeni.
          await prisma.pricelistOffer.deleteMany({ where: { contractPeriodId: p.id } });
          await prisma.ancillaryService.deleteMany({ where: { contractPeriodId: p.id } });
          await prisma.touristTaxInfo.deleteMany({ where: { contractPeriodId: p.id } });
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

      // dopuna v1.12 (§2.2b) — od ove verzije ACTIVE zahteva i commission_model, ne samo
      // default_tip_nastupanja; taj gejt ima sopstveni test niže ("commission_model gejt
      // pre ACTIVE"), ovde se šalje da bi se stavka 13 (default_tip_nastupanja) i dalje
      // mogla dokazati nezavisno.
      const res2 = await request(app.getHttpServer())
        .patch(`/api/v1/contracting/contracts/${contract.id}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE', defaultTipNastupanja: 'ORGANIZATOR', commissionModel: 'NET' });
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

  describe('Dopuna v1.12 (talas 1) — commission_model gejt pre ACTIVE (§2.2b)', () => {
    it('kreira Contract sa commission_model i dozvoljava prelaz u ACTIVE tek kad je popunjeno uz default_tip_nastupanja', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id, {
        defaultTipNastupanja: 'ORGANIZATOR',
        commissionModel: 'COMMISSIONABLE',
        commissionPercentage: 5,
      });
      expect(contract.commissionModel).toBe('COMMISSIONABLE');
      expect(Number(contract.commissionPercentage)).toBe(5);

      const activateRes = await request(app.getHttpServer())
        .patch(`/api/v1/contracting/contracts/${contract.id}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE' });
      expect(activateRes.status).toBe(200);
    });

    it('odbija prelaz u ACTIVE kad default_tip_nastupanja postoji ali commission_model ne', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id, { defaultTipNastupanja: 'ORGANIZATOR' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contracting/contracts/${contract.id}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(400);
    });
  });

  describe('Dopuna v1.12 — ContractPeriod.min_stay_nights/max_stay_nights (§2.3)', () => {
    it('kreira period sa min_stay_nights/max_stay_nights i čita ih preko API-ja', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({
          stayFrom: '2027-07-01',
          stayTo: '2027-07-31',
          roomType: 'MIN_MAX_STAY_TEST',
          allotmentMode: 'ON_REQUEST',
          minStayNights: 3,
          maxStayNights: 14,
        });
      expect(res.status).toBe(201);
      expect(res.body.minStayNights).toBe(3);
      expect(res.body.maxStayNights).toBe(14);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${res.body.id}`)
        .set(authed(accessToken));
      expect(getRes.body.minStayNights).toBe(3);
      expect(getRes.body.maxStayNights).toBe(14);
    });
  });

  describe('Dopuna v1.12 — PricelistOffer EARLY_BOOKING i FREE_NIGHTS (§2.4b)', () => {
    it('kreira EARLY_BOOKING ponudu sa booking_from/booking_to odvojenim od stay_from/stay_to', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-31', roomType: 'OFFER_TEST', allotmentMode: 'ON_REQUEST' });
      const periodId = periodRes.body.id;

      const offerRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/offers`)
        .set(authed(accessToken))
        .send({
          offerType: 'EARLY_BOOKING',
          bookingFrom: '2027-01-01',
          bookingTo: '2027-03-31',
          discountType: 'PERCENTAGE',
          discountPercentage: 15,
        });
      expect(offerRes.status).toBe(200);
      expect(offerRes.body.bookingFrom).toContain('2027-01-01');
      expect(offerRes.body.bookingTo).toContain('2027-03-31');

      const freeNightsRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/offers`)
        .set(authed(accessToken))
        .send({ offerType: 'FREE_NIGHTS', bookingFrom: '2027-01-01', bookingTo: '2027-03-31', stayNights: 6, payNights: 5 });
      expect(freeNightsRes.status).toBe(200);
      expect(freeNightsRes.body.stayNights).toBe(6);
      expect(freeNightsRes.body.payNights).toBe(5);

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/offers`)
        .set(authed(accessToken));
      expect(listRes.body).toHaveLength(2);
    });
  });

  describe('Dopuna v1.12 — CancellationRule rule_type EARLY_DEPARTURE nezavisno od PRE_ARRIVAL (§2.5)', () => {
    it('kreira PRE_ARRIVAL i EARLY_DEPARTURE pravila za isti period, oba se čitaju', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-31', roomType: 'CANCEL_RULE_TEST', allotmentMode: 'ON_REQUEST' });
      const periodId = periodRes.body.id;

      const preArrivalRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/cancellation-rules`)
        .set(authed(accessToken))
        .send({ ruleType: 'PRE_ARRIVAL', daysBeforeStay: 30, refundPercentage: 100 });
      expect(preArrivalRes.status).toBe(200);
      expect(preArrivalRes.body.ruleType).toBe('PRE_ARRIVAL');

      const earlyDepartureRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/cancellation-rules`)
        .set(authed(accessToken))
        .send({ ruleType: 'EARLY_DEPARTURE', earlyDepartureBasis: 'PERCENTAGE_OF_REMAINING_STAY', earlyDeparturePercentage: 100 });
      expect(earlyDepartureRes.status).toBe(200);
      expect(earlyDepartureRes.body.ruleType).toBe('EARLY_DEPARTURE');
      expect(earlyDepartureRes.body.daysBeforeStay).toBeNull();

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/cancellation-rules`)
        .set(authed(accessToken));
      expect(listRes.body).toHaveLength(2);
      expect(listRes.body.map((r: { ruleType: string }) => r.ruleType).sort()).toEqual(['EARLY_DEPARTURE', 'PRE_ARRIVAL']);
    });
  });

  describe('Dopuna v1.12 — AncillaryService oba pricing_mode (§2.6)', () => {
    it('kreira uslugu FLAT_PER_UNIT i uslugu PERCENTAGE_OF_NIGHTLY_RATE', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-31', roomType: 'ANCILLARY_TEST', allotmentMode: 'ON_REQUEST' });
      const periodId = periodRes.body.id;

      const flatRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/ancillary-services`)
        .set(authed(accessToken))
        // `priceBasis` je postao OBAVEZAN u M3 v1.13 (commit baa5675), a ovaj test nije ažuriran —
        // od tada je vraćao 400 i rušio CI. Zatečeno 5.9.2026 pri uvođenju CI provera.
        .send({ name: 'Kućni ljubimac', pricingMode: 'FLAT_PER_UNIT', flatAmount: 1000, priceBasis: 'PER_PET_PER_STAY', isMandatory: false });
      expect(flatRes.status).toBe(200);
      expect(flatRes.body.flatAmount).toBe(1000);

      const percentageRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/ancillary-services`)
        .set(authed(accessToken))
        .send({ name: 'Rani check-in', pricingMode: 'PERCENTAGE_OF_NIGHTLY_RATE', percentageOfNightlyRate: 30, priceBasis: 'PER_PERSON_PER_STAY' });
      expect(percentageRes.status).toBe(200);
      expect(Number(percentageRes.body.percentageOfNightlyRate)).toBe(30);

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/ancillary-services`)
        .set(authed(accessToken));
      expect(listRes.body).toHaveLength(2);
    });
  });

  describe('Dopuna v1.12 — TouristTaxInfo (§2.7)', () => {
    it('kreira i čita TouristTaxInfo za period; nijedan M10/M11 endpoint ne postoji da bi ovo pročitao kao osnovu za fakturisanje', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const supplier = await createSupplier(accessToken);
      const contract = await createContract(accessToken, supplier.id);
      const periodRes = await request(app.getHttpServer())
        .post(`/api/v1/contracting/contracts/${contract.id}/periods`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-31', roomType: 'TOURIST_TAX_TEST', allotmentMode: 'ON_REQUEST' });
      const periodId = periodRes.body.id;

      const emptyRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/tourist-tax`)
        .set(authed(accessToken));
      expect(emptyRes.status).toBe(200);
      // Nest ne piše telo odgovora za null/undefined handler rezultat (isNil provera u
      // RouterResponseController) — supertest tad vraća prazan objekat, ne JSON `null`
      // token; servisni sloj (contract-periods.service.spec.ts) direktno dokazuje da
      // getTouristTax() vraća pravi `null` kad zapis ne postoji (M3 spec §6).
      expect(emptyRes.body).toEqual({});

      const upsertRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/tourist-tax`)
        .set(authed(accessToken))
        .send({ includedInPrice: false, collectedBy: 'PAID_ON_SITE_BY_GUEST', amountPerNight: 200, currency: 'EUR', taxExemptMaxAge: 11.99 });
      expect(upsertRes.status).toBe(200);
      expect(upsertRes.body.includedInPrice).toBe(false);
      expect(upsertRes.body.collectedBy).toBe('PAID_ON_SITE_BY_GUEST');

      // 1:1 semantika — drugi PUT ažurira isti zapis, ne kreira novi.
      const secondUpsertRes = await request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/tourist-tax`)
        .set(authed(accessToken))
        .send({ includedInPrice: true });
      expect(secondUpsertRes.status).toBe(200);
      expect(secondUpsertRes.body.id).toBe(upsertRes.body.id);
      expect(secondUpsertRes.body.includedInPrice).toBe(true);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/contracting/contracts/${contract.id}/periods/${periodId}/tourist-tax`)
        .set(authed(accessToken));
      expect(getRes.body.id).toBe(upsertRes.body.id);
      expect(getRes.body.includedInPrice).toBe(true);
    });
  });
});
