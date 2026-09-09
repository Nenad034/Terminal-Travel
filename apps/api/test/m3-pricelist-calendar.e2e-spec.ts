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
 * M3 §2.11o — kalendar cena i raspoloživosti, mereno kroz endpoint koji panel zove.
 *
 * Unit testovi pokrivaju proračun nad mokovanom bazom. Ovde se meri ono što mok ne može da
 * dokaže: da kalendar spaja **dva stvarna izvora** — cenovnik i mrežu kapaciteta — i da rupa u
 * cenovniku izlazi kao imenovan razlog, a ne kao prazan mesec.
 */
describe('M3 §2.11o — kalendar cena (e2e)', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    for (const supplierId of createdSupplierIds) {
      const contracts = await prisma.contract.findMany({ where: { supplierId } });
      for (const c of contracts) {
        await prisma.pricelistVersion.deleteMany({ where: { contractId: c.id } });
        const periods = await prisma.contractPeriod.findMany({ where: { contractId: c.id } });
        for (const p of periods) {
          await prisma.rateLineAgePricing.deleteMany({
            where: { rateLine: { contractPeriodId: p.id } },
          });
          await prisma.rateLine.deleteMany({ where: { contractPeriodId: p.id } });
          await prisma.capacityDay.deleteMany({ where: { contractPeriodId: p.id } });
          await prisma.capacityBlock.deleteMany({ where: { contractPeriodId: p.id } });
        }
        await prisma.ancillaryService.deleteMany({ where: { contractId: c.id } });
        await prisma.contractPeriod.deleteMany({ where: { contractId: c.id } });
        await prisma.seasonRange.deleteMany({ where: { season: { contractId: c.id } } });
        await prisma.season.deleteMany({ where: { contractId: c.id } });
      }
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

  async function vlasnik() {
    const user = await prisma.user.create({
      data: {
        email: `m3k-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M3 Kalendar Test',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.VLASNIK } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
    return jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Cenovnik sa dva reda iste kombinacije: radni dani 100,00 i vikend (petak, subota) 140,00 —
   * vlasnikov primer iz §2.11d. Sezona pokriva ceo jun 2027.
   */
  async function pripremi(token: string) {
    const supplier = await request(app.getHttpServer())
      .post('/api/v1/contracting/suppliers')
      .set(auth(token))
      .send({
        name: `Hotel Kalendar ${testRunId}-${Math.random().toString(36).slice(2)}`,
        type: 'HOTEL',
        taxId: '111222333',
        registrationNumber: '444555666',
        country: 'Srbija',
        contactName: 'Marko Markovic',
        contactEmail: `k-${Math.random().toString(36).slice(2)}@test.rs`,
        contactPhone: '060123456',
      });
    createdSupplierIds.push(supplier.body.id);

    const contract = await request(app.getHttpServer())
      .post('/api/v1/contracting/contracts')
      .set(auth(token))
      .send({
        supplierId: supplier.body.id,
        contractNumber: `UG-K-${testRunId}-${Math.random().toString(36).slice(2)}`,
        currency: 'EUR',
        validFrom: '2027-01-01',
        validTo: '2027-12-31',
        cancellationTermsSummary: 'Standardni uslovi',
        documentUrl: 'https://example.com/ugovor.pdf',
        defaultTipNastupanja: 'ORGANIZATOR',
      });
    const contractId = contract.body.id;

    const season = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/seasons`)
      .set(auth(token))
      .send({
        code: '1',
        label: 'Jun',
        ranges: [{ dateFrom: '2027-06-01', dateTo: '2027-06-30' }],
      });

    const celija = (price: number, validWeekdays: number[]) =>
      request(app.getHttpServer())
        .put(`/api/v1/contracting/contracts/${contractId}/pricelist-grid/cell`)
        .set(auth(token))
        .send({
          seasonId: season.body.id,
          roomType: 'STD',
          boardType: 'BB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price,
          validWeekdays,
        })
        .expect(200);

    await celija(10000, [7, 1, 2, 3, 4]); // ned–čet: 100,00
    await celija(14000, [5, 6]); // pet, sub: 140,00

    return { contractId, seasonId: season.body.id };
  }

  function dan(telo: any, datum: string) {
    return telo.kombinacije[0].dani.find((d: any) => d.date === datum);
  }

  it('kalendar prikazuje cenu po danu, i vikend cena se vidi kao drugi iznos', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremi(token);

    const r = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-calendar`)
      .query({ roomType: 'STD', from: '2027-06-07', to: '2027-06-13', adults: 2 })
      .set(auth(token))
      .expect(200);

    expect(r.body.kombinacije).toHaveLength(1);
    // 2027-06-07 je ponedeljak; 11. petak; 12. subota; 13. nedelja.
    expect(dan(r.body, '2027-06-07').cena).toBe(10000);
    expect(dan(r.body, '2027-06-11').cena).toBe(14000);
    expect(dan(r.body, '2027-06-12').cena).toBe(14000);
    expect(dan(r.body, '2027-06-13').cena).toBe(10000);
    expect(dan(r.body, '2027-06-07').seasonCode).toBe('1');
    expect(r.body.upozorenja).toEqual([]);
  });

  it('dan van ugovorenog perioda se imenuje, ne ostaje prazan', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremi(token);

    const r = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-calendar`)
      .query({ roomType: 'STD', from: '2027-05-28', to: '2027-06-02', adults: 2 })
      .set(auth(token))
      .expect(200);

    expect(dan(r.body, '2027-05-30').razlog).toBe('VAN_PERIODA');
    expect(dan(r.body, '2027-05-30').cena).toBeNull();
    expect(dan(r.body, '2027-06-02').cena).toBe(10000);
    // Rupa se vidi i zbirno, bez prebrojavanja po ekranu.
    expect(r.body.upozorenja[0]).toContain('4 od 6 dana');
  });

  it('kapacitet i stop-sale stižu u isti pogled sa cenom', async () => {
    const token = await vlasnik();
    const { contractId, seasonId } = await pripremi(token);

    // Kapacitet se unosi na period — ide po sopstvenim datumima, nezavisno od sezona (§2.11n).
    const period = await prisma.contractPeriod.findFirstOrThrow({
      where: { contractId, roomType: 'STD', seasonId },
    });
    await prisma.contractPeriod.update({
      where: { id: period.id },
      data: { allotmentMode: 'FIXED', totalCapacity: 6 },
    });

    await request(app.getHttpServer())
      .post('/api/v1/contracting/capacity/stop-sale')
      .set(auth(token))
      .send({
        contractPeriodId: period.id,
        dateFrom: '2027-06-11',
        dateTo: '2027-06-11',
        reason: 'Hotel je zatvorio prodaju',
      })
      .expect(201);

    const r = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-calendar`)
      .query({ roomType: 'STD', from: '2027-06-10', to: '2027-06-12', adults: 2 })
      .set(auth(token))
      .expect(200);

    expect(dan(r.body, '2027-06-10')).toMatchObject({ cena: 10000, slobodno: 6 });
    // Dan sa stop-sale i dalje NOSI cenu — cena i odluka o prodaji su dve različite stvari.
    expect(dan(r.body, '2027-06-11')).toMatchObject({
      cena: 14000,
      saleStatus: 'STOP',
      slobodno: 0,
    });
    expect(dan(r.body, '2027-06-11').stopReason).toContain('zatvorio prodaju');
  });

  it('raspon duži od kvartala se odbija', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremi(token);

    await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-calendar`)
      .query({ roomType: 'STD', from: '2027-01-01', to: '2027-12-31', adults: 2 })
      .set(auth(token))
      .expect(400);
  });
});
