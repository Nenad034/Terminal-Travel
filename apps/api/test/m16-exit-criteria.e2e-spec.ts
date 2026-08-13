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
 * E2E protiv prave Postgres baze — pokriva stavke M16 izlaznog kriterijuma
 * (docs/moduli/M16-mcp-distribucija/17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md poglavlje 9).
 * MCP 2026-07-28 zahteva per-request `_meta` envelope + `Mcp-Method`/`Mcp-Name` header-e koji
 * moraju poklapati telo zahteva (@modelcontextprotocol/server v2, potvrđeno ručnim curl testom
 * protiv stvarno pokrenutog servera pre pisanja ovog fajla).
 */
describe('M16 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdMarkupRuleIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdRegistrationIds: string[] = [];
  const createdMcpUserIds: string[] = [];
  const createdMcpClientAccountIds: string[] = [];

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
    if (createdBookingIds.length) {
      await prisma.clientContract.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.travelGuaranteeRegistration.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.bookingItem.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    await prisma.quote.deleteMany({ where: { clientAccountId: { in: createdMcpClientAccountIds } } });
    if (createdRegistrationIds.length) {
      await prisma.mCPClientRegistration.deleteMany({ where: { id: { in: createdRegistrationIds } } });
    }
    if (createdProductIds.length) {
      await prisma.productTranslation.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdContractIds.length) await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    if (createdSupplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    if (createdMarkupRuleIds.length) await prisma.markupRule.deleteMany({ where: { id: { in: createdMarkupRuleIds } } });
    const allClientAccountIds = [...createdClientAccountIds, ...createdMcpClientAccountIds];
    if (allClientAccountIds.length) await prisma.clientAccount.deleteMany({ where: { id: { in: allClientAccountIds } } });
    const allUserIds = [...createdUserIds, ...createdMcpUserIds];
    if (allUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: allUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m16-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M16 Test Korisnik',
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

  async function createBookableProductFixture(totalCapacity = 5) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `M16 E2E Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-M16SUP-${testRunId}-${Math.random().toString(36).slice(2)}`,
        registrationNumber: `REG-M16-${testRunId}-${Math.random().toString(36).slice(2)}`,
        country: 'RS',
        contactName: 'Test kontakt',
        contactEmail: `supplier-m16-${testRunId}@tt-test.rs`,
        contactPhone: '+381600000000',
      },
    });
    createdSupplierIds.push(supplier.id);

    const contract = await prisma.contract.create({
      data: {
        supplierId: supplier.id,
        contractNumber: `C-M16-${testRunId}-${Math.random().toString(36).slice(2)}`,
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
        visibleChannels: ['B2C_SITE'],
        attributes: { stars: 4 },
        translations: {
          create: [{ languageCode: 'sr', name: `Hotel M16 Test ${testRunId}`, description: 'opis', slug: `hotel-m16-${testRunId}-${Math.random().toString(36).slice(2)}` }],
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
        totalCapacity,
        cancellationRules: { create: [{ daysBeforeStay: 30, refundPercentage: 100 }] },
      },
    });

    const rateLine = await prisma.rateLine.create({
      data: { contractPeriodId: contractPeriod.id, boardType: 'HALF_BOARD', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: 10000 },
    });

    const markupRule = await prisma.markupRule.create({ data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 20 } });
    createdMarkupRuleIds.push(markupRule.id);

    return { product, rateLine };
  }

  /** Registruje i aktivira MCP klijenta preko pravih HTTP admin endpoint-a (§3.1). */
  async function registerAndActivateMcpClient(vlasnikToken: string, accessLevel: 'READ_ONLY' | 'READ_WRITE' = 'READ_ONLY') {
    const created = await request(app.getHttpServer())
      .post('/api/v1/mcp-admin/clients')
      .set(authed(vlasnikToken))
      .send({ clientName: `E2E MCP Client ${testRunId}-${Math.random().toString(36).slice(2)}` });
    expect(created.status).toBe(201);
    createdRegistrationIds.push(created.body.id);

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/mcp-admin/clients/${created.body.id}/activate`)
      .set(authed(vlasnikToken));
    expect(activated.status).toBe(201);
    createdMcpUserIds.push(activated.body.linkedUserId);
    createdMcpClientAccountIds.push(activated.body.linkedClientAccountId);

    if (accessLevel === 'READ_WRITE') {
      const approved = await request(app.getHttpServer())
        .post(`/api/v1/mcp-admin/clients/${created.body.id}/approve-read-write`)
        .set(authed(vlasnikToken));
      expect(approved.status).toBe(201);
      expect(approved.body.accessLevel).toBe('READ_WRITE');
    }

    return { registrationId: created.body.id, credential: created.body.credential as string };
  }

  const metaEnvelope = () => ({
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'e2e-test-client', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  });

  async function callMcpTool(credential: string, toolName: string, args: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/v1/mcp')
      .set('Authorization', `Bearer ${credential}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', '2026-07-28')
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', toolName)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args, _meta: metaEnvelope() } });
  }

  describe('§9, stavka 1 — READ_ONLY klijent uspešno izvršava search_products, isti rezultati kao M5 search', () => {
    it('search_products preko MCP vraća isti proizvod koji M5 GET /sales/search vraća za isti upit', async () => {
      const { user: vlasnik, accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      void vlasnik;
      const { product } = await createBookableProductFixture();
      const { credential } = await registerAndActivateMcpClient(vlasnikToken, 'READ_ONLY');

      const mcpRes = await callMcpTool(credential, 'search_products', { destinationCity: 'Kopaonik' });
      expect(mcpRes.status).toBe(200);
      const mcpProducts = mcpRes.body.result.structuredContent.results;
      expect(mcpProducts.some((p: any) => p.productId === product.id)).toBe(true);

      const httpRes = await request(app.getHttpServer())
        .get('/api/v1/sales/search')
        .query({ destinationCity: 'Kopaonik', channel: 'B2C_SITE' });
      expect(httpRes.status).toBe(200);
      expect(httpRes.body.some((p: any) => p.productId === product.id)).toBe(true);
    });

    it('READ_ONLY klijent NE može da izvrši create_quote — jasna poruka, ne tiha greška', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { product } = await createBookableProductFixture();
      const { credential } = await registerAndActivateMcpClient(vlasnikToken, 'READ_ONLY');

      const res = await callMcpTool(credential, 'create_quote', {
        items: [{ productId: product.id, stayFrom: '2027-06-10', stayTo: '2027-06-17', occupancy: { adults: 2, children: 0 } }],
        contractTermsAccepted: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.result.isError).toBe(true);
      expect(res.body.result.content[0].text).toContain('READ_WRITE');
    });
  });

  describe('§9, stavka 2 — confirm_booking sa nepotpunim podacima gosta se odbija sa jasnom porukom', () => {
    it('confirm_booking bez buyerName/buyerType vraća grešku, ne prazan/nejasan odgovor', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { credential } = await registerAndActivateMcpClient(vlasnikToken, 'READ_WRITE');

      const res = await callMcpTool(credential, 'confirm_booking', { quoteId: 'nepostojeci-quote-id' });
      expect(res.status).toBe(200);
      expect(res.body.result.isError).toBe(true);
      expect(res.body.result.content[0].text).toContain('buyerName');
    });
  });

  describe('§9, stavka 3 — prelazak READ_ONLY→READ_WRITE zahteva eksplicitno ljudsko odobrenje, upisano u audit log', () => {
    it('approve-read-write menja access_level i upisuje audit log sa actorId', async () => {
      const { user: vlasnik, accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { registrationId } = await registerAndActivateMcpClient(vlasnikToken, 'READ_ONLY');

      const before = await prisma.mCPClientRegistration.findUniqueOrThrow({ where: { id: registrationId } });
      expect(before.accessLevel).toBe('READ_ONLY');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/mcp-admin/clients/${registrationId}/approve-read-write`)
        .set(authed(vlasnikToken));
      expect(res.status).toBe(201);
      expect(res.body.accessLevel).toBe('READ_WRITE');

      const auditEntry = await prisma.auditLogEntry.findFirst({
        where: { module: 'M16', action: 'mcp_client.approved_read_write', resourceId: registrationId },
        orderBy: { timestamp: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry!.actorId).toBe(vlasnik.id);
    });

    it('korisnik bez M16/mcp-client/APPROVE_READ_WRITE dobija 403', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { registrationId } = await registerAndActivateMcpClient(vlasnikToken, 'READ_ONLY');
      const { accessToken: agentToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/mcp-admin/clients/${registrationId}/approve-read-write`)
        .set(authed(agentToken));
      expect(res.status).toBe(403);
    });
  });

  describe('§9, stavka 4 — kapacitet radi identično bez obzira na kanal (M16 ne zaobilazi M3 proveru)', () => {
    it('MCP confirm_booking preko kapaciteta se odbija istom logikom kao interni kanal; validna rezervacija dobija MCP_AGENT kanal i maskiran prikaz', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { product } = await createBookableProductFixture(1);
      const { credential } = await registerAndActivateMcpClient(vlasnikToken, 'READ_WRITE');

      const quoteRes = await callMcpTool(credential, 'create_quote', {
        items: [{ productId: product.id, stayFrom: '2027-06-10', stayTo: '2027-06-17', occupancy: { adults: 2, children: 0 } }],
        contractTermsAccepted: true,
      });
      const quote = JSON.parse(quoteRes.body.result.content[0].text);

      const confirmRes = await callMcpTool(credential, 'confirm_booking', {
        quoteId: quote.id,
        buyerName: 'MCP E2E Guest',
        buyerType: 'FIZICKO_LICE',
      });
      expect(confirmRes.body.result.isError).toBeFalsy();
      const booking = JSON.parse(confirmRes.body.result.content[0].text);
      createdBookingIds.push(booking.id);
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.channel).toBe('MCP_AGENT');
      // §6.2/§2 — isto maskiranje kao B2C: bez supplier polja u odgovoru.
      expect(booking.items[0].supplierReference).toBeUndefined();
      expect(booking.items[0].baseCost).toBeUndefined();

      // Kapacitet (totalCapacity=1) je potrošen — druga rezervacija preko ISTOG MCP kanala
      // mora biti odbijena istom M3 proverom kao bilo koji drugi kanal.
      const secondQuoteRes = await callMcpTool(credential, 'create_quote', {
        items: [{ productId: product.id, stayFrom: '2027-06-10', stayTo: '2027-06-17', occupancy: { adults: 2, children: 0 } }],
        contractTermsAccepted: true,
      });
      const secondQuote = JSON.parse(secondQuoteRes.body.result.content[0].text);
      const secondConfirmRes = await callMcpTool(credential, 'confirm_booking', {
        quoteId: secondQuote.id,
        buyerName: 'MCP E2E Guest 2',
        buyerType: 'FIZICKO_LICE',
      });
      expect(secondConfirmRes.body.result.isError).toBe(true);
    });

    it('get_booking_status vraća 404-stil grešku za tuđu (drugi MCP klijent) rezervaciju', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { product } = await createBookableProductFixture();
      const { credential: credentialA } = await registerAndActivateMcpClient(vlasnikToken, 'READ_WRITE');
      const { credential: credentialB } = await registerAndActivateMcpClient(vlasnikToken, 'READ_WRITE');

      const quoteRes = await callMcpTool(credentialA, 'create_quote', {
        items: [{ productId: product.id, stayFrom: '2027-07-10', stayTo: '2027-07-17', occupancy: { adults: 2, children: 0 } }],
        contractTermsAccepted: true,
      });
      const quote = JSON.parse(quoteRes.body.result.content[0].text);
      const confirmRes = await callMcpTool(credentialA, 'confirm_booking', {
        quoteId: quote.id,
        buyerName: 'MCP Owner A',
        buyerType: 'FIZICKO_LICE',
      });
      const booking = JSON.parse(confirmRes.body.result.content[0].text);
      createdBookingIds.push(booking.id);

      const statusRes = await callMcpTool(credentialB, 'get_booking_status', { bookingId: booking.id });
      expect(statusRes.body.result.isError).toBe(true);
    });
  });

  describe('Autentikacija MCP transporta (§3.1/§10)', () => {
    it('zahtev bez Bearer tokena vraća 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('MCP-Protocol-Version', '2026-07-28')
        .set('Mcp-Method', 'tools/list')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: metaEnvelope() } });
      expect(res.status).toBe(401);
    });

    it('nevažeći kredencijal vraća 401', async () => {
      const res = await callMcpTool('ovo-nije-validan-kredencijal', 'search_products', {});
      expect(res.status).toBe(401);
    });

    it('SUSPENDED klijent gubi pristup', async () => {
      const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { registrationId, credential } = await registerAndActivateMcpClient(vlasnikToken, 'READ_ONLY');
      await request(app.getHttpServer()).post(`/api/v1/mcp-admin/clients/${registrationId}/suspend`).set(authed(vlasnikToken));

      const res = await callMcpTool(credential, 'search_products', {});
      expect(res.status).toBe(401);
    });
  });
});
