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
 * E2E protiv prave Postgres baze — M5 spec §4.5, kartice "Aranžman" i "Putnici".
 *
 * Nalaz koji je do ovog fajla doveo (1.9.2026): `GET /bookings/:id` je po stavci vraćao samo
 * sirov `product_id` i nijednog putnika, pa ekran rezervacije nije mogao da prikaže ŠTA je
 * kupljeno ni KO putuje. Ovi testovi zaključavaju ispravku, uključujući granicu §6.2
 * (naziv proizvoda i putnici SMEJU ka gostu, identitet dobavljača i nabavna cena NE).
 */
describe('M5 §4.5 — aranžman i putnici na rezervaciji (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdSupplierIds: string[] = [];
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
  });

  afterAll(async () => {
    if (createdBookingIds.length) await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    if (createdMarkupRuleIds.length) await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    if (createdProductIds.length) await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    if (createdContractIds.length) await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    if (createdSupplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdClientAccountIds.length) await prisma.clientAccount.deleteMany({ where: { id: { in: createdClientAccountIds } } });
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  function authed(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function createUser(roleName: string, accountType: 'STAFF' | 'GUEST' = 'STAFF', linkedProfileId: string | null = null) {
    const user = await prisma.user.create({
      data: {
        email: `m5dos-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M5 Dosije Test',
        accountType,
        status: 'ACTIVE',
        linkedProfileId,
      },
    });
    createdUserIds.push(user.id);
    // GOST dobija svoju sistemsku ulogu — bez nje nema ni `M5/booking/VIEW`, pa bi test
    // proveravao 403 umesto maskiranog prikaza koji ga zanima.
    const role = await prisma.role.findUniqueOrThrow({ where: { name: accountType === 'GUEST' ? SYSTEM_ROLES.GOST : roleName } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    return { user, accessToken: jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' }) };
  }

  async function createBookableProduct() {
    // Svaki poziv pravi SVOJ skup zapisa — jedinstveni sufiks, inače se sudaraju
    // @unique polja (slug prevoda, PIB dobavljača, broj ugovora) kad test pozove više puta.
    const uid = `${testRunId}-${Math.random().toString(36).slice(2, 8)}`;
    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Dosije Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5DOS-${uid}`,
        registrationNumber: `REG-M5DOS-${uid}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m5dos-${uid}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5DOS-${uid}`,
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
        destinationCountry: 'ME',
        destinationCity: 'Budva',
        status: 'ACTIVE',
        attributes: { stars: 4 },
        translations: {
          create: [
            { languageCode: 'sr', name: 'Hotel Dosije Test', description: 'opis', slug: `hotel-dos-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel Dossier Test', description: 'desc', slug: `hotel-dos-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(product.id);

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { product, markupRule };
  }

  async function createBookingWithItem(createdBy: string, clientAccountId?: string) {
    let accountId = clientAccountId;
    if (!accountId) {
      const account = await prisma.clientAccount.create({
        data: {
          accountType: 'LEGAL_ENTITY',
          companyName: `M5 Dosije Firma ${testRunId}-${Math.random().toString(36).slice(2)}`,
          email: `m5dos-firma-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
          taxId: `TAX-M5DOS-F-${testRunId}-${Math.random().toString(36).slice(2)}`,
        },
      });
      createdClientAccountIds.push(account.id);
      accountId = account.id;
    }

    const { product, markupRule } = await createBookableProduct();
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M5DOS-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: accountId,
        buyerName: 'M5 Dosije Kupac',
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 120000,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy,
        ownerId: createdBy,
        assignedToId: createdBy,
        items: {
          create: [
            {
              productId: product.id,
              sourceType: 'CONTRACTED',
              supplierReference: 'TAJNA-REF-DOBAVLJACA',
              stayFrom: new Date('2027-06-10'),
              stayTo: new Date('2027-06-17'),
              baseCost: 100000,
              baseCostCurrency: 'EUR',
              markupRuleId: markupRule.id,
              finalPrice: 120000,
              finalPriceCurrency: 'EUR',
              itemStatus: 'CONFIRMED',
              unitCount: 2,
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
    });
    createdBookingIds.push(booking.id);
    return { booking, accountId };
  }

  it('interni panel dobija naziv aranžmana, datume, broj jedinica i spisak putnika', async () => {
    const { user, accessToken } = await createUser(SYSTEM_ROLES.VLASNIK);
    const { booking } = await createBookingWithItem(user.id);

    const res = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}`).set(authed(accessToken));
    expect(res.status).toBe(200);

    const item = res.body.items[0];
    expect(item.product.name).toBe('Hotel Dosije Test'); // razrešeno po jeziku (M2 §2.2), ne sirov UUID
    expect(item.product.type).toBe('ACCOMMODATION');
    expect(item.product.destinationCity).toBe('Budva');
    expect(item.unitCount).toBe(2);
    expect(new Date(item.stayFrom).toISOString().slice(0, 10)).toBe('2027-06-10');
    expect(item.guests.map((g: { guestLastName: string }) => g.guestLastName).sort()).toEqual(['Anić', 'Marković']);
  });

  it('gost vidi naziv aranžmana i putnike, ali NE i identitet dobavljača ni nabavnu cenu (§6.2)', async () => {
    const { user: staff } = await createUser(SYSTEM_ROLES.VLASNIK);
    const { booking, accountId } = await createBookingWithItem(staff.id);
    const { accessToken: guestToken } = await createUser(SYSTEM_ROLES.VLASNIK, 'GUEST', accountId);

    const res = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}`).set(authed(guestToken));
    expect(res.status).toBe(200);

    const item = res.body.items[0];
    // Sme — prirodan sadržaj vaučera.
    expect(item.product.name).toBe('Hotel Dosije Test');
    expect(item.guests).toHaveLength(2);
    expect(item.unitCount).toBe(2);
    // Ne sme — §6.2.
    expect(item).not.toHaveProperty('supplierReference');
    expect(item).not.toHaveProperty('baseCost');
    expect(item).not.toHaveProperty('markupRuleId');
    expect(JSON.stringify(res.body)).not.toContain('TAJNA-REF-DOBAVLJACA');
  });
});
