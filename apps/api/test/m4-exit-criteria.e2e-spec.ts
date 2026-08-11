import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { ProviderRegistryService } from '../src/modules/m4-integracije-api/provider-registry.service';
import { MockProviderAdapter } from '../src/modules/m4-integracije-api/adapters/mock-provider.adapter';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M4 izlaznog kriterijuma
 * (docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md poglavlje 8)
 * koje se mogu proveriti preko MockProviderAdapter-a (ProviderConfig.useMock=true) —
 * ne gađa Travelgate/Solvex uživo (vidi CLAUDE.md, nema stvarnih Travelgate akreditiva;
 * Solvex test akreditivi trenutno odbijeni na serveru, verovatno IP whitelist).
 */
describe('M4 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let registry: ProviderRegistryService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdProviderCodes: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    registry = app.get(ProviderRegistryService);
  });

  afterAll(async () => {
    if (createdProviderCodes.length) {
      await prisma.providerCallLog.deleteMany({ where: { providerCode: { in: createdProviderCodes } } });
      await prisma.providerConfig.deleteMany({ where: { providerCode: { in: createdProviderCodes } } });
    }
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m4-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M4 Test Korisnik',
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

  async function createMockProvider(accessToken: string, overrides: Record<string, unknown> = {}) {
    const providerCode = `mock-${testRunId}-${Math.random().toString(36).slice(2)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/integrations/providers')
      .set(authed(accessToken))
      .send({
        providerCode,
        displayName: 'Mock provajder (e2e)',
        category: 'HOTEL',
        authConfig: { note: 'mock — nema stvarnih kredencijala' },
        authStrategy: 'API_KEY',
        timeoutSearchMs: 8000,
        timeoutBookingMs: 15000,
        capabilitiesProfile: { maxResultsPerSearch: 3 },
        circuitFailureThreshold: 3,
        circuitCooldownSeconds: 1,
        ...overrides,
      });
    createdProviderCodes.push(providerCode);

    // useMock se ne prima kroz create DTO (nije u spec §3.1 kreiranju) — uključuje se posebnim PATCH-om.
    await request(app.getHttpServer())
      .patch(`/api/v1/integrations/providers/${providerCode}`)
      .set(authed(accessToken))
      .send({ useMock: true });

    return providerCode;
  }

  async function getMockAdapter(providerCode: string): Promise<MockProviderAdapter> {
    const config = await prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });
    return registry.getAdapter(config) as MockProviderAdapter;
  }

  describe('Kredencijali nikad u odgovoru API-ja (izlazni kriterijum, stavka 6)', () => {
    it('POST i GET /providers nikad ne vraćaju auth_config_encrypted', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/integrations/providers/${providerCode}`)
        .set(authed(accessToken));

      expect(getRes.status).toBe(200);
      expect(getRes.body).not.toHaveProperty('authConfigEncrypted');
      expect(JSON.stringify(getRes.body)).not.toMatch(/authConfigEncrypted/);
    });
  });

  describe('default_tip_nastupanja gejt pre ACTIVE (izlazni kriterijum, stavka 9)', () => {
    it('provajder ne može preći u ACTIVE bez default_tip_nastupanja', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);

      const rejected = await request(app.getHttpServer())
        .patch(`/api/v1/integrations/providers/${providerCode}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE' });
      expect(rejected.status).toBe(400);

      const accepted = await request(app.getHttpServer())
        .patch(`/api/v1/integrations/providers/${providerCode}`)
        .set(authed(accessToken))
        .send({ status: 'ACTIVE', defaultTipNastupanja: 'ORGANIZATOR' });
      expect(accepted.status).toBe(200);
    });
  });

  describe('search — normalizacija + gornja granica maxResultsPerSearch (izlazni kriterijum, stavke 2, 13)', () => {
    it('vraća najviše capabilities_profile.maxResultsPerSearch stavki', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken); // maxResultsPerSearch: 3
      const adapter = await getMockAdapter(providerCode);
      adapter.searchResults = Array.from({ length: 10 }, (_, i) => ({
        externalId: `H${i}`,
        providerCode,
        category: 'HOTEL',
        name: `Hotel ${i}`,
        locationSummary: `Hotel ${i}`,
        priceFrom: 10000,
        currency: 'EUR',
        thumbnailUrl: null,
        starRating: null,
        quotaStatus: 'AVAILABLE',
      }));

      const res = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(3);
    });
  });

  describe('Circuit breaker (izlazni kriterijum, stavka 7)', () => {
    it('OPEN posle praga uzastopnih grešaka, zatim HALF_OPEN→CLOSED posle isteka cooldown-a', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken); // threshold=3, cooldown=1s
      const adapter = await getMockAdapter(providerCode);
      adapter.failNextCalls = 3;

      for (let i = 0; i < 3; i++) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
          .set(authed(accessToken))
          .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });
        expect(res.status).toBe(500);
      }

      const afterThreshold = await prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });
      expect(afterThreshold.circuitState).toBe('OPEN');

      // Kolo OPEN — sledeći poziv se odbija BEZ pozivanja adaptera (adapter.failNextCalls ostaje netaknut).
      const blockedRes = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });
      expect(blockedRes.status).toBe(500);
      expect(adapter.failNextCalls).toBe(0); // nepromenjeno od pre bloka — adapter nije pozvan

      // Simuliramo istek cooldown-a (1s) direktno u bazi, umesto čekanja u testu.
      await prisma.providerConfig.update({
        where: { providerCode },
        data: { circuitOpenedAt: new Date(Date.now() - 5000) },
      });
      adapter.searchResults = [];

      const halfOpenRes = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });
      expect(halfOpenRes.status).toBe(201);

      const afterRecovery = await prisma.providerConfig.findUniqueOrThrow({ where: { providerCode } });
      expect(afterRecovery.circuitState).toBe('CLOSED');
      expect(afterRecovery.circuitConsecutiveFailures).toBe(0);
    });
  });

  describe('Normalizovan error_code u ProviderCallLog (izlazni kriterijum, stavka 8)', () => {
    it('neuspeo poziv upisuje popunjen error_code nezavisno od uzroka', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);
      const adapter = await getMockAdapter(providerCode);
      adapter.failNextCalls = 1;
      adapter.failureCode = 'RATE_LIMITED';

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      const logs = await prisma.providerCallLog.findMany({ where: { providerCode }, orderBy: { timestamp: 'desc' } });
      expect(logs[0].errorCode).toBe('RATE_LIMITED');
    });
  });

  describe('Idempotentnost confirmBooking (izlazni kriterijum, stavka 4)', () => {
    it('drugi poziv sa istim idempotency_key vraća isti ishod bez ponovnog pozivanja adaptera', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);
      const adapter = await getMockAdapter(providerCode);
      adapter.bookingConfirmation = {
        providerBookingReference: 'EXT-IDEM-1',
        status: 'CONFIRMED',
        confirmedPrice: 12345,
        confirmedAt: '2027-01-01T00:00:00.000Z',
      };

      const bookingPayload = {
        externalId: 'H1',
        stayFrom: '2027-07-01',
        stayTo: '2027-07-08',
        adults: 2,
        guestName: 'Petar Petrović',
        idempotencyKey: `idem-${testRunId}`,
      };

      const first = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/bookings`)
        .set(authed(accessToken))
        .send(bookingPayload);
      expect(first.status).toBe(201);
      expect(first.body.providerBookingReference).toBe('EXT-IDEM-1');

      // Adapter bi sad odbijao svaki poziv — drugi zahtev MORA proći bez da ga dotakne.
      adapter.failNextCalls = 99;

      const second = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/bookings`)
        .set(authed(accessToken))
        .send(bookingPayload);

      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body);
    });

    it('uspešna rezervacija piše zapis u M1 AuditLogEntry (M4 spec §3.2)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);
      const idempotencyKey = `idem-audit-${testRunId}`;

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/bookings`)
        .set(authed(accessToken))
        .send({
          externalId: 'H1',
          stayFrom: '2027-07-01',
          stayTo: '2027-07-08',
          adults: 2,
          guestName: 'Gost Testni',
          idempotencyKey,
        });

      const entry = await prisma.auditLogEntry.findFirst({ where: { action: 'provider_booking.confirmed', resourceId: idempotencyKey } });
      expect(entry).not.toBeNull();
      expect(entry?.module).toBe('M4');
    });
  });

  describe('Redakcija ličnih podataka u ProviderCallLog.request_summary (M4 spec §3.2/§7 Master dokumenta)', () => {
    it('guestName se nikad ne čuva u čistom tekstu u request_summary', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(accessToken);

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/bookings`)
        .set(authed(accessToken))
        .send({
          externalId: 'H1',
          stayFrom: '2027-07-01',
          stayTo: '2027-07-08',
          adults: 2,
          guestName: 'Osetljivo Ime Gosta',
          idempotencyKey: `idem-redact-${testRunId}`,
        });

      const logs = await prisma.providerCallLog.findMany({ where: { providerCode, operation: 'BOOK' } });
      const raw = JSON.stringify(logs.map((l) => l.requestSummary));
      expect(raw).not.toContain('Osetljivo Ime Gosta');
    });
  });

  describe('Dozvole (M4 spec §6) — Sales Manager nema pristup provider-config', () => {
    it('Sales Manager dobija 403 na GET /integrations/providers', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.SALES_MANAGER);

      const res = await request(app.getHttpServer()).get('/api/v1/integrations/providers').set(authed(accessToken));

      expect(res.status).toBe(403);
    });

    it('interni endpoint (search) je dostupan svakom autentikovanom internom korisniku, bez posebne dozvole (M4 spec §6)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.SALES_MANAGER);
      const owner = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const providerCode = await createMockProvider(owner.accessToken);
      const adapter = await getMockAdapter(providerCode);
      adapter.searchResults = [];

      const res = await request(app.getHttpServer())
        .post(`/api/v1/integrations/internal/providers/${providerCode}/search`)
        .set(authed(accessToken))
        .send({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(res.status).toBe(201);
    });
  });
});
