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
 * M3 §2.11k + M5 §6.7a — doplata sa dometom „ceo ugovor" / „sezona" MORA da stigne do prodaje.
 *
 * Do 9.9.2026. je prodaja čitala isključivo `contractPeriod.ancillaryServices`, pa je boravišna
 * taksa uneta na ugovor postojala na ekranu cenovnika a prodavcu se nije prikazivala. Ovaj test
 * je dokaz da se to više ne može desiti neprimećeno: pravi bazu, pravu rezervaciju i traži
 * spisak preko istog HTTP endpointa koji koristi panel.
 */
describe('M5 §6.7a — domet doplate u prodaji (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdBookingIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];

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
    for (const id of createdBookingIds) {
      await prisma.bookingItemGuest.deleteMany({ where: { bookingItem: { bookingId: id } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: id } });
      await prisma.booking.deleteMany({ where: { id } });
    }
    for (const supplierId of createdSupplierIds) {
      const contracts = await prisma.contract.findMany({ where: { supplierId } });
      const ids = contracts.map((c) => c.id);
      await prisma.ancillaryService.deleteMany({ where: { contractId: { in: ids } } });
      await prisma.rateLine.deleteMany({ where: { contractPeriod: { contractId: { in: ids } } } });
      await prisma.contractPeriod.deleteMany({ where: { contractId: { in: ids } } });
      await prisma.seasonRange.deleteMany({ where: { season: { contractId: { in: ids } } } });
      await prisma.season.deleteMany({ where: { contractId: { in: ids } } });
      await prisma.product.updateMany({
        where: { sourceContractId: { in: ids } },
        data: { sourceContractId: null },
      });
      await prisma.contract.deleteMany({ where: { supplierId } });
    }
    await prisma.productTranslation.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: createdClientAccountIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function createUser() {
    const user = await prisma.user.create({
      data: {
        email: `m5anc-${uid}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M5 Doplate Test',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.VLASNIK } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, assignedBy: user.id },
    });
    return { user, accessToken: jwt.sign({ sub: user.id, sessionId: 'e2e-anc-session' }) };
  }

  it('doplata sa dometom ugovora/sezone stiže do prodaje; tuđa soba, tuđ period i ugašena stavka ne stižu', async () => {
    const { user, accessToken } = await createUser();

    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Doplate Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5ANC-${uid}`,
        registrationNumber: `REG-M5ANC-${uid}`,
        country: 'RS',
        contactName: 'Kontakt',
        contactEmail: `anc-${uid}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5ANC-${uid}`,
        currency: 'EUR',
        validFrom: new Date('2027-01-01'),
        validTo: new Date('2027-12-31'),
        cancellationTermsSummary: 'e2e',
        documentUrl: 'mock://doc.pdf',
        status: 'ACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
      },
    });

    const season = await prisma.season.create({
      data: { contractId: contract.id, code: '1', label: 'Predsezona', rank: 1 },
    });

    const period = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        seasonId: season.id,
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-06-30'),
        roomType: 'Budget double room',
        allotmentMode: 'FIXED',
        totalCapacity: 10,
      },
    });
    // Drugi period, van sezone — služi da se dokaže da doplata vezana za njega ne curi u ovaj.
    const drugiPeriod = await prisma.contractPeriod.create({
      data: {
        contractId: contract.id,
        stayFrom: new Date('2027-09-01'),
        stayTo: new Date('2027-09-30'),
        roomType: 'Deluxe suite',
        allotmentMode: 'FIXED',
        totalCapacity: 5,
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: {
        contractPeriodId: period.id,
        boardType: 'BB',
        occupancy: '2ADT',
        priceBasis: 'PER_PERSON_PER_NIGHT',
        price: 3900,
      },
    });

    // Pet doplata, svaka pokriva tačno jedan slučaj koji je do sada bio nedokazan.
    const [taksaOdrasli, veceraUgovor, popustApartmani, doplataDrugiPeriod, ugasena] =
      await Promise.all([
        // 1. Boravišna taksa na CELOM ugovoru, obavezna, ON_SITE, sa uzrasnim opsegom.
        prisma.ancillaryService.create({
          data: {
            contractId: contract.id,
            name: 'Boravišna taksa — odrasli',
            kind: 'SURCHARGE',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 150,
            priceBasis: 'PER_PERSON_PER_NIGHT',
            payable: 'ON_SITE',
            isMandatory: true,
            ageFrom: 18,
            appliesToRoomTypes: [],
          },
        }),
        // 2. Doplata na celom ugovoru, bez uzrasta — mora se videti u spisku.
        prisma.ancillaryService.create({
          data: {
            contractId: contract.id,
            name: 'Večera',
            kind: 'SURCHARGE',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 1200,
            priceBasis: 'PER_PERSON_PER_NIGHT',
            payable: 'AGENCY',
            isMandatory: false,
            appliesToRoomTypes: [],
          },
        }),
        // 3. Popust vezan za DRUGE sobe — ne sme se pojaviti.
        prisma.ancillaryService.create({
          data: {
            contractId: contract.id,
            seasonId: season.id,
            name: 'Popust za treću osobu (apartmani)',
            kind: 'DISCOUNT',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 500,
            priceBasis: 'PER_PERSON_PER_NIGHT',
            payable: 'AGENCY',
            appliesToRoomTypes: ['Apartman A2', 'Apartman A4'],
          },
        }),
        // 4. Doplata vezana za DRUGI period — ne sme se pojaviti.
        prisma.ancillaryService.create({
          data: {
            contractId: contract.id,
            contractPeriodId: drugiPeriod.id,
            name: 'Parking (septembar)',
            kind: 'SURCHARGE',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 300,
            priceBasis: 'PER_ROOM_PER_NIGHT',
            payable: 'AGENCY',
            appliesToRoomTypes: [],
          },
        }),
        // 5. Ispravljena (ugašena) stavka — §2.4c: prodaja gleda isključivo ACTIVE.
        prisma.ancillaryService.create({
          data: {
            contractId: contract.id,
            name: 'Večera (stara cena)',
            kind: 'SURCHARGE',
            pricingMode: 'FLAT_PER_UNIT',
            flatAmount: 900,
            priceBasis: 'PER_PERSON_PER_NIGHT',
            payable: 'AGENCY',
            appliesToRoomTypes: [],
            status: 'INACTIVE',
            deactivatedAt: new Date(),
            deactivatedBy: user.id,
          },
        }),
      ]);

    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: 'ME',
        destinationCity: 'Budva',
        status: 'ACTIVE',
        attributes: {},
        translations: {
          create: [
            { languageCode: 'sr', name: 'Hotel Doplate', description: 'o', slug: `hd-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel Ancillary', description: 'd', slug: `hd-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(product.id);

    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M5 Doplate Firma ${uid}`,
        email: `anc-firma-${uid}@tt-test.rs`,
        taxId: `TAX-ANC-F-${uid}`,
      },
    });
    createdClientAccountIds.push(account.id);

    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M5ANC-${uid}`,
        clientAccountId: account.id,
        buyerName: 'Kupac',
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 54600,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy: user.id,
        ownerId: user.id,
        assignedToId: user.id,
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: 'REF-ANC-E2E',
              rateLineId: rateLine.id,
              stayFrom: new Date('2027-06-10'),
              stayTo: new Date('2027-06-17'),
              baseCost: 54600,
              baseCostCurrency: 'EUR',
              finalPrice: 54600,
              finalPriceCurrency: 'EUR',
              itemStatus: 'CONFIRMED',
              unitCount: 1,
              guests: {
                create: [
                  { guestFirstName: 'Marko', guestLastName: 'Marković' },
                  { guestFirstName: 'Ana', guestLastName: 'Anić' },
                ],
              },
            },
          ],
        },
      },
      include: { items: true },
    });
    createdBookingIds.push(booking.id);
    const itemId = booking.items[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales/bookings/${booking.id}/items/${itemId}/ancillaries`)
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(200);

    const ids = res.body.map((o: { id: string }) => o.id);
    // Ono što MORA da stigne do prodaje — pre ove izmene nijedno od ovoga se nije videlo.
    expect(ids).toContain(taksaOdrasli.id);
    expect(ids).toContain(veceraUgovor.id);
    // Ono što ne sme.
    expect(ids).not.toContain(popustApartmani.id); // druge sobe
    expect(ids).not.toContain(doplataDrugiPeriod.id); // drugi period
    expect(ids).not.toContain(ugasena.id); // §2.4c — ugašena stavka nije u prodaji

    const taksa = res.body.find((o: { id: string }) => o.id === taksaOdrasli.id);
    expect(taksa.scope).toBe('CONTRACT');
    expect(taksa.ageFrom).toBe(18);
    expect(taksa.payable).toBe('ON_SITE');
    // ON_SITE se prikazuje sa iznosom, ali ne ulazi u zbir (§2.11j) — 2 osobe × 7 noći × 1,50.
    expect(taksa.amount).toBe(2100);
  });
});
