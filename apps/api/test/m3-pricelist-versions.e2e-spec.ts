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
 * M3 §2.11l — verzije cenovnika, mereno kroz iste endpoint-e koje panel zove.
 *
 * Unit testovi pokrivaju proračun razlike nad mokovanom bazom. Ovde se meri ono što mok ne može
 * da dokaže: da snimak nastaje od stvarnih zapisa, da nova verzija ne dira staru, i da primena
 * potvrđene razlike zaista menja cenu u bazi — a nepotvrđena ne.
 */
describe('M3 §2.11l — verzije cenovnika (e2e)', () => {
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
        email: `m3v-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M3 Verzije Test',
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

  /** Ugovor sa jednom sezonom i jednom cenom — najmanji cenovnik koji ima verziju. */
  async function pripremiCenovnik(token: string) {
    const supplier = await request(app.getHttpServer())
      .post('/api/v1/contracting/suppliers')
      .set(auth(token))
      .send({
        name: `Hotel Verzije ${testRunId}-${Math.random().toString(36).slice(2)}`,
        type: 'HOTEL',
        taxId: '111222333',
        registrationNumber: '444555666',
        country: 'Srbija',
        contactName: 'Marko Markovic',
        contactEmail: `v-${Math.random().toString(36).slice(2)}@test.rs`,
        contactPhone: '060123456',
      });
    createdSupplierIds.push(supplier.body.id);

    const contract = await request(app.getHttpServer())
      .post('/api/v1/contracting/contracts')
      .set(auth(token))
      .send({
        supplierId: supplier.body.id,
        contractNumber: `UG-V-${testRunId}-${Math.random().toString(36).slice(2)}`,
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
        label: 'Predsezona',
        ranges: [{ dateFrom: '2027-06-01', dateTo: '2027-06-30' }],
      });

    await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contractId}/pricelist-grid/cell`)
      .set(auth(token))
      .send({
        seasonId: season.body.id,
        roomType: 'STD',
        boardType: 'BB',
        occupancy: '2ADT',
        priceBasis: 'PER_ROOM_PER_NIGHT',
        price: 10000, // 100,00
      })
      .expect(200);

    return { contractId, seasonId: season.body.id };
  }

  it('prva verzija snima ceo cenovnik, druga prijavljuje SAMO razliku', async () => {
    const token = await vlasnik();
    const { contractId, seasonId } = await pripremiCenovnik(token);

    // Verzija 1 — početno stanje.
    const v1 = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .send({ effectiveFrom: '2027-01-01', note: 'Prvi cenovnik dobavljača' })
      .expect(201);
    expect(v1.body.versionNo).toBe(1);
    expect(v1.body.changeCount).toBe(1);

    // Ista potvrda odmah ponovo se odbija — istorija ne sme biti spisak istovetnih snimaka.
    await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .send({ effectiveFrom: '2027-02-01' })
      .expect(400);

    // Dobavljač šalje izmenu: 100,00 → 110,00. Cena se menja u mreži, kao i ručno.
    await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contractId}/pricelist-grid/cell`)
      .set(auth(token))
      .send({
        seasonId,
        roomType: 'STD',
        boardType: 'BB',
        occupancy: '2ADT',
        priceBasis: 'PER_ROOM_PER_NIGHT',
        price: 11000,
      })
      .expect(200);

    const razlike = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/razlike`)
      .set(auth(token))
      .expect(200);

    expect(razlike.body.poslednjaVerzija).toBe(1);
    expect(razlike.body.ukupno).toBe(1);
    expect(razlike.body.razlike[0].vrsta).toBe('IZMENJENA');
    expect(razlike.body.razlike[0].poruka).toContain('100,00 → 110,00');

    const v2 = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .send({ effectiveFrom: '2027-03-01' })
      .expect(201);
    expect(v2.body.versionNo).toBe(2);

    // Nova verzija NE briše staru — stara cena ostaje čitljiva.
    const stara = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/1`)
      .set(auth(token))
      .expect(200);
    expect(stara.body.snapshot[0].vrednost).toBe(10000);
    expect(stara.body.note).toBe('Prvi cenovnik dobavljača');

    const spisak = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .expect(200);
    expect(spisak.body.versions.map((v: any) => v.versionNo)).toEqual([2, 1]);
  });

  it('predlog ništa ne upisuje, a primena menja SAMO potvrđenu razliku', async () => {
    const token = await vlasnik();
    const { contractId, seasonId } = await pripremiCenovnik(token);

    // Druga soba, da predlog nosi dve izmene a čovek potvrdi jednu.
    await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contractId}/pricelist-grid/cell`)
      .set(auth(token))
      .send({
        seasonId,
        roomType: 'APP',
        boardType: 'BB',
        occupancy: '4ADT',
        priceBasis: 'PER_ROOM_PER_NIGHT',
        price: 20000,
      })
      .expect(200);

    const predlogTelo = {
      effectiveFrom: '2027-04-01',
      redovi: [
        {
          roomType: 'STD',
          seasonCode: '1',
          boardType: 'BB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 12000, // 100,00 → 120,00
        },
        {
          roomType: 'APP',
          seasonCode: '1',
          boardType: 'BB',
          occupancy: '4ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 25000, // 200,00 → 250,00
        },
      ],
    };

    const predlog = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/predlog`)
      .set(auth(token))
      .send(predlogTelo)
      .expect(201);
    expect(predlog.body.ukupno).toBe(2);

    // Predlog ne sme ništa da upiše — cene su i dalje stare.
    const mrezaPosleGledanja = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-grid`)
      .set(auth(token))
      .expect(200);
    const cene = mrezaPosleGledanja.body.roomTypes.flatMap((g: any) =>
      g.rows.flatMap((r: any) => Object.values(r.cells).map((c: any) => c.price)),
    );
    expect(cene.sort()).toEqual([10000, 20000]);

    // Čovek potvrđuje samo izmenu za STD.
    const kljucStd = predlog.body.razlike.find((r: any) => r.opis.includes('STD')).kljuc;
    const primena = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/primeni`)
      .set(auth(token))
      .send({ ...predlogTelo, prihvaceniKljucevi: [kljucStd] })
      .expect(201);

    expect(primena.body.primenjeno).toBe(1);
    expect(primena.body.odbijeno.some((p: string) => p.includes('APP'))).toBe(true);

    const posle = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-grid`)
      .set(auth(token))
      .expect(200);
    const cenePosle = posle.body.roomTypes.flatMap((g: any) =>
      g.rows.flatMap((r: any) => Object.values(r.cells).map((c: any) => c.price)),
    );
    // STD je promenjen, APP je ostao na staroj ceni — odbijena razlika nije primenjena.
    expect(cenePosle.sort()).toEqual([12000, 20000]);
  });

  it('potvrđeno gašenje uklanja cenu iz prodaje, ali stara verzija je i dalje čita', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremiCenovnik(token);

    await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .send({ effectiveFrom: '2027-01-01' })
      .expect(201);

    // Predlog bez ijednog reda = dobavljač je stavku ukinuo.
    const predlog = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/predlog`)
      .set(auth(token))
      .send({ effectiveFrom: '2027-05-01', redovi: [] })
      .expect(201);
    expect(predlog.body.razlike[0].vrsta).toBe('UGASENA');

    await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/primeni`)
      .set(auth(token))
      .send({
        effectiveFrom: '2027-05-01',
        redovi: [],
        prihvaceniKljucevi: [predlog.body.razlike[0].kljuc],
      })
      .expect(201);

    // Mreža više ne nudi tu cenu…
    const mreza = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-grid`)
      .set(auth(token))
      .expect(200);
    const ostaleCene = mreza.body.roomTypes.flatMap((g: any) =>
      g.rows.flatMap((r: any) => Object.keys(r.cells)),
    );
    expect(ostaleCene).toHaveLength(0);

    // …ali verzija 1 i dalje objašnjava po kojoj je ceni nešto prodato.
    const v1 = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/1`)
      .set(auth(token))
      .expect(200);
    expect(v1.body.snapshot[0].vrednost).toBe(10000);
  });

  /**
   * §4.8 — izmena rečima. Sam poziv modelu se u testu NE pokreće: odgovor jezičkog modela nije
   * determinističan, a test koji zavisi od njega bi bio ili spor i skup ili lažno zelen. Ovde se
   * meri ograda koja stoji ISPRED modela i koja je jednaka na svakoj instalaciji.
   */
  it('izmena rečima nad praznim cenovnikom se odbija pre nego što se model uopšte pozove', async () => {
    const token = await vlasnik();
    const supplier = await request(app.getHttpServer())
      .post('/api/v1/contracting/suppliers')
      .set(auth(token))
      .send({
        name: `Hotel Prazan ${testRunId}-${Math.random().toString(36).slice(2)}`,
        type: 'HOTEL',
        taxId: '111222333',
        registrationNumber: '444555666',
        country: 'Srbija',
        contactName: 'Marko Markovic',
        contactEmail: `p-${Math.random().toString(36).slice(2)}@test.rs`,
        contactPhone: '060123456',
      });
    createdSupplierIds.push(supplier.body.id);

    const contract = await request(app.getHttpServer())
      .post('/api/v1/contracting/contracts')
      .set(auth(token))
      .send({
        supplierId: supplier.body.id,
        contractNumber: `UG-P-${testRunId}-${Math.random().toString(36).slice(2)}`,
        currency: 'EUR',
        validFrom: '2027-01-01',
        validTo: '2027-12-31',
        cancellationTermsSummary: 'Standardni uslovi',
        documentUrl: 'https://example.com/ugovor.pdf',
        defaultTipNastupanja: 'ORGANIZATOR',
      });

    const r = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contract.body.id}/pricelist-versions/recima`)
      .set(auth(token))
      .send({ instructionText: 'cene idu gore 5%', effectiveFrom: '2027-06-01' })
      .expect(400);

    expect(r.body.message).toContain('Cenovnik je prazan');
  });

  it('izmena rečima traži rečenicu — prazan zahtev pada na validaciji, ne na modelu', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremiCenovnik(token);

    await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/recima`)
      .set(auth(token))
      .send({ instructionText: '', effectiveFrom: '2027-06-01' })
      .expect(400);
  });

  it('rečenica kojom je izmena tražena se čuva uz verziju (§4.8)', async () => {
    const token = await vlasnik();
    const { contractId } = await pripremiCenovnik(token);

    const predlogTelo = {
      effectiveFrom: '2027-06-01',
      redovi: [
        {
          roomType: 'STD',
          seasonCode: '1',
          boardType: 'BB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 11000,
        },
      ],
      instructionText: 'Podigni cenu studija u predsezoni na 110 evra',
    };

    const predlog = await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/predlog`)
      .set(auth(token))
      .send(predlogTelo)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/contracting/contracts/${contractId}/pricelist-versions/primeni`)
      .set(auth(token))
      .send({ ...predlogTelo, prihvaceniKljucevi: predlog.body.sviKljucevi })
      .expect(201);

    const spisak = await request(app.getHttpServer())
      .get(`/api/v1/contracting/contracts/${contractId}/pricelist-versions`)
      .set(auth(token))
      .expect(200);
    expect(spisak.body.versions[0].instructionText).toBe(
      'Podigni cenu studija u predsezoni na 110 evra',
    );
  });
});
