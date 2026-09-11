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
 * M5 §3.2a + izlazni kriterijum §13 — **kapacitet sobe se stvarno proverava u prodaji.**
 *
 * Tri nalaza od 10.9.2026, sva tri istog oblika (provera postoji, ali se ne izvršava):
 *
 *  1. `assertRoomCapacity` je imala šest jediničnih testova i **nula proizvodnih pozivalaca**
 *     (zamka 7.12) — grupa koja premašuje kapacitet sobe prolazila je do cene.
 *  2. Kad se `M3 ContractPeriod.room_type` ne poklopi sa `M2 room_types[].code`, pretraga i
 *     ponuda su uzimale `capacityAdults: 99` — provera se tiše isključi (zamka 7.14).
 *  3. `M2 bed_combinations[]` (§2.3g) niko nije čitao — kombinaciju koju hotel izričito ne
 *     dozvoljava sistem je prodavao.
 *
 * Mereno kroz `POST /sales/quotes`, dakle kroz isti put kojim ide prava prodaja.
 */
describe('M5 §3.2a — kapacitet i raspored po krevetima u prodaji (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdProductIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdQuoteIds: string[] = [];

  let accessToken: string;
  let productId: string;
  let rateLineId: string;

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

    const user = await prisma.user.create({
      data: {
        email: `m5kap-${uid}@tt-test.rs`,
        fullName: 'M5 Kapacitet Test',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.VLASNIK } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
    accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-kap-session' });

    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Kapacitet Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5KAP-${uid}`,
        registrationNumber: `REG-M5KAP-${uid}`,
        country: 'RS',
        contactName: 'Kontakt',
        contactEmail: `kap-${uid}@tt-test.rs`,
        contactPhone: '+381600000009',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5KAP-${uid}`,
        currency: 'EUR',
        validFrom: new Date('2027-01-01'),
        validTo: new Date('2027-12-31'),
        cancellationTermsSummary: 'e2e',
        documentUrl: 'mock://doc.pdf',
        status: 'ACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
      },
    });

    const period = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-06-30'),
        roomType: `KAP_${uid}`,
        allotmentMode: 'ON_REQUEST',
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: {
        contractPeriodId: period.id,
        boardType: 'BB',
        occupancy: '2ADT',
        priceBasis: 'PER_ROOM_PER_NIGHT',
        price: 10000,
      },
    });
    rateLineId = rateLine.id;

    // §3.2b korak 4 — bez `age_pricing` reda za dete se ponuda odbija zato sto CENA za njega ne
    // postoji, a ne zbog kapaciteta. Bez ovoga bi test merio sasvim drugu ogradu.
    await prisma.rateLineAgePricing.create({
      data: {
        rateLineId: rateLine.id,
        ageCategory: 'CHILD',
        pricingMode: 'PERCENTAGE_OF_BASE_PRICE',
        percentage: 50,
      },
    });

    const marza = await prisma.markupRule.create({
      data: { scopeType: 'M3_CONTRACT', scopeId: contract.id, percentage: 20 },
    });
    createdMarkupRuleIds.push(marza.id);

    // Soba 2 osnovna + 1 pomoćni. Hotel ne dozvoljava „1 odrasla + 2 deteta" iako fizički staje.
    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: 'ME',
        destinationCity: 'Budva',
        status: 'ACTIVE',
        attributes: {
          room_types: [
            {
              code: `KAP_${uid}`,
              name: 'Dvokrevetna soba',
              capacity_adults: 3,
              capacity_children: 2,
              beds: { base_beds: 2, extra_beds_max: 1, extra_bed_max_age: 7 },
              bed_combinations: [
                { key: '1A_2C', allowed: false, note: 'hotel traži dve odrasle osobe' },
              ],
            },
          ],
        },
        translations: {
          create: [
            { languageCode: 'sr', name: 'Hotel Kapacitet', description: 'o', slug: `hk-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel Capacity', description: 'd', slug: `hk-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(product.id);
    productId = product.id;
  });

  afterAll(async () => {
    for (const id of createdQuoteIds) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.deleteMany({ where: { id } });
    }
    await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    for (const supplierId of createdSupplierIds) {
      const contracts = await prisma.contract.findMany({ where: { supplierId } });
      const ids = contracts.map((c) => c.id);
      const periods = await prisma.contractPeriod.findMany({ where: { contractId: { in: ids } } });
      const periodIds = periods.map((p) => p.id);
      await prisma.rateLine.deleteMany({ where: { contractPeriodId: { in: periodIds } } });
      await prisma.contractPeriod.deleteMany({ where: { id: { in: periodIds } } });
      await prisma.productTranslation.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
      await prisma.contract.deleteMany({ where: { id: { in: ids } } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function ponudi(occupancy: Record<string, unknown>, pid = productId) {
    return request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        channel: 'INTERNAL_PANEL',
        items: [
          { productId: pid, rateLineId, stayFrom: '2027-06-10', stayTo: '2027-06-12', occupancy },
        ],
      });
  }

  it('grupa koja staje u sobu prolazi — provera ne odbija ispravan slučaj', async () => {
    const res = await ponudi({
      adults: 2,
      children: 1,
      roomConfig: [{ adults: 2, children: 1, childrenAges: [6] }],
    });
    expect(res.status).toBe(201);
    createdQuoteIds.push(res.body.id);
  });

  // Izlazni kriterijum §13: „assertRoomCapacity se stvarno poziva u toku prodaje."
  it('grupa koja premašuje kapacitet sobe se ODBIJA, a ne ponudi', async () => {
    const res = await ponudi({ adults: 5, children: 0, roomConfig: [{ adults: 5, children: 0 }] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('premašuje kapacitet');
  });

  // Izlazni kriterijum §13: „kombinacija označena allowed = false se odbija ... uz jasnu poruku
  // koja kombinacija nije dozvoljena."
  it('kombinaciju koju je hotel zabranio odbija i IMENUJE je, uz razlog koji je unet', async () => {
    const res = await ponudi({
      adults: 1,
      children: 2,
      roomConfig: [{ adults: 1, children: 2, childrenAges: [5, 6] }],
    });
    expect(res.status).toBe(400);
    const poruka = JSON.stringify(res.body);
    expect(poruka).toContain('1A_2C');
    expect(poruka).toContain('hotel traži dve odrasle osobe');
  });

  it('dete iznad uzrasne granice pomoćnog kreveta se odbija iako ima slobodno mesto', async () => {
    const res = await ponudi({
      adults: 2,
      children: 1,
      roomConfig: [{ adults: 2, children: 1, childrenAges: [10] }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('pomoćni krevet sme dete do 7');
  });

  // Izlazni kriterijum §13: „Nepoznat tip sobe ne sme tiho značiti neograničen kapacitet."
  it('tip sobe koji ne postoji u katalogu se ODBIJA sa porukom, ne dobija kapacitet 99', async () => {
    const bezSobe = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        sourceContractId: (
          await prisma.contract.findFirstOrThrow({
            where: { contractNumber: `C-M5KAP-${uid}` },
          })
        ).id,
        destinationCountry: 'ME',
        destinationCity: 'Budva',
        status: 'ACTIVE',
        attributes: { room_types: [{ code: 'NECIJA_DRUGA', capacity_adults: 2 }] },
        translations: {
          create: [
            { languageCode: 'sr', name: 'Hotel Bez Sobe', description: 'o', slug: `hbs-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel No Room', description: 'd', slug: `hbs-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(bezSobe.id);

    const res = await ponudi(
      { adults: 2, children: 0, roomConfig: [{ adults: 2, children: 0 }] },
      bezSobe.id,
    );
    expect(res.status).toBe(400);
    const poruka = JSON.stringify(res.body);
    expect(poruka).toContain(`KAP_${uid}`);
    expect(poruka).toContain('ne postoji u katalogu');
  });
});
