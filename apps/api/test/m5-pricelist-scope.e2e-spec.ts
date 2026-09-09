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
 * M3 §2.11i/§2.11k — **domet iz cenovnika mora da važi i u prodaji**, ne samo pri unosu.
 *
 * Dva slučaja, isti uzrok (zamka 7.12): domet je dodat na strani unosa, a strana koja prodaje
 * ostala je na starom užem upitu, pa je sve bilo zeleno a ništa primenjeno.
 *
 *  1. Doplata sa dometom „ceo ugovor"/„sezona" — prodaja je čitala isključivo
 *     `contractPeriod.ancillaryServices`, pa se boravišna taksa uneta na ugovor prodavcu nije
 *     prikazivala iako stoji u cenovniku.
 *  2. Marža upisana na JEDNU cenovnu stavku — `M3_RATE_LINE` je stajao na vrhu kaskade, ali ga
 *     nijedan pozivalac nije prosleđivao.
 *  3. Prozor rezervisanja NA CENI (`booking_from`/`booking_to`) — polje se upisivalo, a ponuda
 *     ga nije čitala, pa bi se istekla cena i dalje prodala.
 *
 * Oba se mere kroz iste HTTP endpointe kojima ide prava prodaja, nad pravom bazom.
 */
describe('M3 §2.11d/§2.11e/§2.11i/§2.11k — domet cenovnika u prodaji (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const createdBookingIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdSubagentIds: string[] = [];
  const createdOverrideIds: string[] = [];
  const createdQuoteIds: string[] = [];

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
    for (const id of createdQuoteIds) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.deleteMany({ where: { id } });
    }
    await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    // Briše se SAMO ono što je ovaj test napravio — `subagentId: null` znači „važi za sve
    // subagente", pa bi brisanje po tom uslovu odnelo i tuđa pravila.
    await prisma.subagentCommissionOverride.deleteMany({
      where: { id: { in: createdOverrideIds } },
    });
    await prisma.subagent.deleteMany({ where: { id: { in: createdSubagentIds } } });
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

  /**
   * M3 §2.11i — marža upisana na JEDNU cenovnu stavku mora da promeni cenu koju gost vidi.
   *
   * Do 9.9.2026. je `MarkupScopeType` imao `M3_RATE_LINE` i kaskada ga je stavljala na vrh, ali
   * ga **nijedan pozivalac nije prosleđivao** — izuzetak se upisivao kroz ekran cenovnika i
   * nikad nije primenjen. Ovaj test meri cenu kroz `POST /sales/quotes`, dakle kroz isti put
   * kojim ide prava prodaja, sa i bez izuzetka.
   */
  it('marža po stavci menja cenu u ponudi; cena sa isteklim prozorom rezervisanja se odbija', async () => {
    const { user, accessToken } = await createUser();

    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Marza Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5MRZ-${uid}`,
        registrationNumber: `REG-M5MRZ-${uid}`,
        country: 'RS',
        contactName: 'Kontakt',
        contactEmail: `marza-${uid}@tt-test.rs`,
        contactPhone: '+381600000001',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5MRZ-${uid}`,
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
        roomType: `MRZ_${uid}`,
        allotmentMode: 'ON_REQUEST',
      },
    });

    // Dve stavke istog perioda: „obična" i suite koji dobija sopstvenu maržu.
    const [obicna, suite] = await Promise.all([
      prisma.rateLine.create({
        data: {
          contractPeriodId: period.id,
          boardType: 'BB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 10000,
        },
      }),
      prisma.rateLine.create({
        data: {
          contractPeriodId: period.id,
          boardType: 'HB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 10000,
        },
      }),
    ]);

    const ugovornaMarza = await prisma.markupRule.create({
      data: { scopeType: 'M3_CONTRACT', scopeId: contract.id, percentage: 20 },
    });
    const izuzetak = await prisma.markupRule.create({
      data: { scopeType: 'M3_RATE_LINE', scopeId: suite.id, percentage: 12, fixedAmount: 500 },
    });
    createdMarkupRuleIds.push(ugovornaMarza.id, izuzetak.id);

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
            { languageCode: 'sr', name: 'Hotel Marza', description: 'o', slug: `hm-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel Markup', description: 'd', slug: `hm-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(product.id);

    async function ponudaZa(rateLineId: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sales/quotes')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({
          channel: 'INTERNAL_PANEL',
          items: [
            {
              productId: product.id,
              rateLineId,
              stayFrom: '2027-06-10',
              stayTo: '2027-06-11',
              occupancy: { adults: 2, children: 0 },
            },
          ],
        });
      expect(res.status).toBe(201);
      createdQuoteIds.push(res.body.id);
      return res.body.items[0];
    }

    // §2.11e — treća stavka istog perioda, ista cena, ali prozor rezervisanja prošao.
    const istekla = await prisma.rateLine.create({
      data: {
        contractPeriodId: period.id,
        boardType: 'FB',
        occupancy: '2ADT',
        priceBasis: 'PER_ROOM_PER_NIGHT',
        price: 10000,
        bookingTo: new Date('2025-12-31'),
      },
    });

    // Ista nabavna cena (100,00 za jednu noć) — razliku pravi ISKLJUČIVO domet marže.
    const stavkaBezIzuzetka = await ponudaZa(obicna.id);
    expect(stavkaBezIzuzetka.baseCost).toBe(10000);
    expect(stavkaBezIzuzetka.finalPrice).toBe(12000); // 100,00 + 20 % ugovorne marže
    expect(stavkaBezIzuzetka.markupRuleId).toBe(ugovornaMarza.id);

    const stavkaSaIzuzetkom = await ponudaZa(suite.id);
    expect(stavkaSaIzuzetkom.baseCost).toBe(10000);
    // 12 % I 5,00 se SABIRAJU (§2.11i): 100,00 → 112,00 + 5,00 = 117,00.
    expect(stavkaSaIzuzetkom.finalPrice).toBe(11700);
    expect(stavkaSaIzuzetkom.markupRuleId).toBe(izuzetak.id);

    // §2.11e — cena čiji je prozor rezervisanja prošao se NE prodaje. Do 9.9.2026. je polje
    // postojalo i upisivalo se, a ponuda ga nije čitala — istekla cena bi prošla do kraja.
    const odbijena = await request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        channel: 'INTERNAL_PANEL',
        items: [
          {
            productId: product.id,
            rateLineId: istekla.id,
            stayFrom: '2027-06-10',
            stayTo: '2027-06-11',
            occupancy: { adults: 2, children: 0 },
          },
        ],
      });
    expect(odbijena.status).toBe(400);
    expect(odbijena.body.reason).toBe('BOOKING_WINDOW_CLOSED');
    expect(user.id).toBeDefined();
  });

  /**
   * M3 §2.11i — subagentska provizija PO STAVCI, uključujući „bez provizije".
   *
   * Do 9.9.2026. je M5 primenjivao **jedan** procenat nad celom ponudom, a
   * `SubagentCommissionOverride` je imao 18 jediničnih testova i **nijednog pozivaoca**. Ovaj
   * test meri obe stavke iste ponude kroz `POST /sales/quotes`: sobu, na kojoj provizija ide, i
   * stavku označenu „bez provizije", na kojoj ne ide.
   */
  it('subagent dobija proviziju po stavci; stavka „bez provizije" mu se naplaćuje u punom iznosu', async () => {
    const { accessToken } = await createUser();

    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Provizija Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5PRV-${uid}`,
        registrationNumber: `REG-M5PRV-${uid}`,
        country: 'RS',
        contactName: 'Kontakt',
        contactEmail: `prov-${uid}@tt-test.rs`,
        contactPhone: '+381600000002',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5PRV-${uid}`,
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
        roomType: `PRV_${uid}`,
        allotmentMode: 'ON_REQUEST',
      },
    });

    const [soba, taksa] = await Promise.all([
      prisma.rateLine.create({
        data: {
          contractPeriodId: period.id,
          boardType: 'BB',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 10000,
        },
      }),
      prisma.rateLine.create({
        data: {
          contractPeriodId: period.id,
          boardType: 'RO',
          occupancy: '2ADT',
          priceBasis: 'PER_ROOM_PER_NIGHT',
          price: 10000,
        },
      }),
    ]);

    const marza = await prisma.markupRule.create({
      data: { scopeType: 'M3_CONTRACT', scopeId: contract.id, percentage: 0 },
    });
    createdMarkupRuleIds.push(marza.id);

    // „Bez provizije" je namerno različito od 0 % — izričita odluka, ne prazno polje.
    const bezProvizije = await prisma.subagentCommissionOverride.create({
      data: { scopeType: 'M3_RATE_LINE', scopeId: taksa.id, noCommission: true },
    });
    createdOverrideIds.push(bezProvizije.id);

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
            { languageCode: 'sr', name: 'Hotel Provizija', description: 'o', slug: `hp-sr-${uid}` },
            {
              languageCode: 'en',
              name: 'Hotel Commission',
              description: 'd',
              slug: `hp-en-${uid}`,
            },
          ],
        },
      },
    });
    createdProductIds.push(product.id);

    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M5 Subagent ${uid}`,
        email: `subagent-${uid}@tt-test.rs`,
        taxId: `TAX-SUB-${uid}`,
      },
    });
    createdClientAccountIds.push(account.id);

    const subagent = await prisma.subagent.create({
      data: {
        clientAccountId: account.id,
        status: 'ACTIVE',
        commissionPercentage: 10,
        creditLimit: 1000000,
        creditLimitCurrency: 'EUR',
      },
    });
    createdSubagentIds.push(subagent.id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({
        channel: 'B2B_PORTAL',
        clientAccountId: account.id,
        items: [
          {
            productId: product.id,
            rateLineId: soba.id,
            stayFrom: '2027-06-10',
            stayTo: '2027-06-11',
            occupancy: { adults: 2, children: 0 },
          },
          {
            productId: product.id,
            rateLineId: taksa.id,
            stayFrom: '2027-06-10',
            stayTo: '2027-06-11',
            occupancy: { adults: 2, children: 0 },
          },
        ],
      });
    expect(res.status).toBe(201);
    createdQuoteIds.push(res.body.id);

    const poStavci = new Map<string, number>(
      res.body.items.map((i: { rateLineId: string; finalPrice: number }) => [
        i.rateLineId,
        i.finalPrice,
      ]),
    );
    // Ista nabavna cena i ista (nulta) marža — razliku pravi ISKLJUČIVO domet provizije.
    expect(poStavci.get(soba.id)).toBe(9000); // 100,00 − 10 % provizije subagenta
    expect(poStavci.get(taksa.id)).toBe(10000); // „bez provizije" — pun iznos
  });

  /**
   * M3 §2.11d — dani u nedelji i turnusi.
   *
   * Dva dokaza kroz prave endpointe: (1) upis cene koja preklapa dane već pokrivene drugom
   * cenom se odbija sa imenovanim danima; (2) boravak koji ne poštuje turnus (subota–subota,
   * 7 noći) ne prolazi kroz `POST /sales/quotes`, a onaj koji ga poštuje prolazi.
   */
  it('dani u nedelji: preklapanje se odbija pri upisu, a turnus se poštuje pri prodaji', async () => {
    const { accessToken } = await createUser();

    const supplier = await prisma.supplier.create({
      data: {
        name: `M5 Turnus Dobavljač ${uid}`,
        type: 'HOTEL',
        taxId: `TAX-M5TRN-${uid}`,
        registrationNumber: `REG-M5TRN-${uid}`,
        country: 'RS',
        contactName: 'Kontakt',
        contactEmail: `turnus-${uid}@tt-test.rs`,
        contactPhone: '+381600000003',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M5TRN-${uid}`,
        currency: 'EUR',
        validFrom: new Date('2027-01-01'),
        validTo: new Date('2027-12-31'),
        cancellationTermsSummary: 'e2e',
        documentUrl: 'mock://doc.pdf',
        status: 'ACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
      },
    });

    // Sezona sa jednim opsegom — kroz nju ide upis ćelije, isto kao sa ekrana cenovnika.
    const season = await prisma.season.create({
      data: {
        contractId: contract.id,
        code: `T${uid.slice(-4)}`,
        rank: 1,
        ranges: { create: [{ dateFrom: new Date('2027-06-01'), dateTo: new Date('2027-06-30') }] },
      },
    });

    const roomType = `TRN_${uid}`;
    const celija = {
      seasonId: season.id,
      roomType,
      boardType: 'BB',
      occupancy: '2ADT',
      priceBasis: 'PER_ROOM_PER_NIGHT',
      price: 10000,
    };

    // 1. Radni dani (ned–čet) prolaze.
    const radni = await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contract.id}/pricelist-grid/cell`)
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ ...celija, validWeekdays: [7, 1, 2, 3, 4] });
    expect(radni.status).toBe(200);
    // Petak i subota još nemaju cenu — to je UPOZORENJE, ne odbijanje: cenovnik se unosi red po
    // red, pa bi strogo pravilo onemogućilo unos drugog reda.
    expect(radni.body.daniBezCene).toEqual([5, 6]);

    // 2. Vikend (pet, sub) kao DRUGI red iste kombinacije — prolazi, jer se dani ne preklapaju.
    const vikend = await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contract.id}/pricelist-grid/cell`)
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ ...celija, price: 14000, validWeekdays: [5, 6] });
    expect(vikend.status).toBe(200);
    expect(vikend.body.daniBezCene).toEqual([]);

    // 3. Treći red koji ponovo pokriva petak se ODBIJA, i poruka imenuje dan.
    const sudar = await request(app.getHttpServer())
      .put(`/api/v1/contracting/contracts/${contract.id}/pricelist-grid/cell`)
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ ...celija, price: 12000, validWeekdays: [5] });
    expect(sudar.status).toBe(400);
    expect(sudar.body.message).toContain('petak');

    // Turnus: subota–subota, 7 noći.
    const period = await prisma.contractPeriod.findFirstOrThrow({
      where: { contractId: contract.id, roomType },
    });
    await prisma.contractPeriod.update({
      where: { id: period.id },
      data: { arrivalWeekdays: [6], departureWeekdays: [6], allowedStayNights: [7] },
    });

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
            { languageCode: 'sr', name: 'Hotel Turnus', description: 'o', slug: `ht-sr-${uid}` },
            { languageCode: 'en', name: 'Hotel Turnus', description: 'd', slug: `ht-en-${uid}` },
          ],
        },
      },
    });
    createdProductIds.push(product.id);

    const marza = await prisma.markupRule.create({
      data: { scopeType: 'M3_CONTRACT', scopeId: contract.id, percentage: 0 },
    });
    createdMarkupRuleIds.push(marza.id);

    async function ponuda(stayFrom: string, stayTo: string) {
      return request(app.getHttpServer())
        .post('/api/v1/sales/quotes')
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({
          channel: 'INTERNAL_PANEL',
          items: [
            { productId: product.id, stayFrom, stayTo, occupancy: { adults: 2, children: 0 } },
          ],
        });
    }

    // Sreda → sreda: 7 noći, ali dolazak nije subota.
    const sreda = await ponuda('2027-06-09', '2027-06-16');
    expect(sreda.status).toBe(400);
    expect(sreda.body.message).toContain('Prijava je moguća samo: subota');

    // Subota → subota, 7 noći: prolazi, i cena se SASTAVLJA od oba reda — pet noći po radnoj
    // (100,00) i dve po vikend ceni (140,00) = 780,00. Ovo je jedini deo §2.11d koji se ne vidi
    // ni u jednom pojedinačnom redu cenovnika, pa se ovde i meri.
    const subota = await ponuda('2027-06-12', '2027-06-19');
    expect(subota.status).toBe(201);
    createdQuoteIds.push(subota.body.id);
    expect(subota.body.items[0].baseCost).toBe(78000);
  });
});
