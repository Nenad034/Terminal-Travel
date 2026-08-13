import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { TravelGuaranteeRegistrationsService } from '../src/modules/m11-compliance/travel-guarantee-registrations/travel-guarantee-registrations.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M11 izlaznog kriterijuma
 * (docs/moduli/M11-compliance/08-SPECIFIKACIJA-M11-COMPLIANCE.md poglavlje 6).
 *
 * Booking fixture se kreira direktno preko Prisma-e (isti obrazac kao test/m10-exit-criteria.e2e-spec.ts)
 * — TravelGuaranteeRegistrationsService se poziva direktno preko app.get (ne kroz čekanje na
 * Postgres LISTEN/NOTIFY asinhroni ciklus), jer je sama NOTIFY-strana (EventListenerService) i
 * M11EventSubscribersService već pokrivena sopstvenim jedinstvenim testovima.
 */
describe('M11 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let registrations: TravelGuaranteeRegistrationsService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdGuaranteeIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    registrations = app.get(TravelGuaranteeRegistrationsService);
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.travelGuaranteeRegistration.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdGuaranteeIds.length) {
      await prisma.travelGuaranteeRegistration.deleteMany({ where: { travelGuaranteeId: { in: createdGuaranteeIds } } });
      await prisma.travelGuarantee.deleteMany({ where: { id: { in: createdGuaranteeIds } } });
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
        email: `m11-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M11 Test Korisnik',
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

  async function createOrganizatorBooking(overrides: { status?: 'CONFIRMED' | 'CANCELLED'; totalPrice?: number } = {}) {
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M11-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: `client-${testRunId}`,
        buyerName: 'Petar Petrović',
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: overrides.status ?? 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: overrides.totalPrice ?? 100000,
        currency: 'RSD',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  describe('§2.1 — garancija putovanja, uvek ljudska izmena, upisana u audit log', () => {
    it('PATCH /compliance/travel-guarantee kreira novu garanciju i upisuje HUMAN audit log', async () => {
      const { accessToken, user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/compliance/travel-guarantee')
        .set(authed(accessToken))
        .send({
          createNew: true,
          provider: 'YUTA',
          policyNumber: `P-E2E-${testRunId}`,
          coverageAmount: 1_000_000_00,
          currency: 'RSD',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      createdGuaranteeIds.push(res.body.id);

      const getRes = await request(app.getHttpServer()).get('/api/v1/compliance/travel-guarantee').set(authed(accessToken));
      expect(getRes.body.id).toBe(res.body.id);

      const auditEntries = await prisma.auditLogEntry.findMany({
        where: { module: 'M11', action: 'travel_guarantee.created', resourceId: res.body.id },
      });
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].actorType).toBe('HUMAN');
      expect(auditEntries[0].actorId).toBe(user.id);
    });

    it('odbija PATCH bez M11/travel-guarantee/EDIT dozvole', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.GOST);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/compliance/travel-guarantee')
        .set(authed(accessToken))
        .send({ coverageAmount: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe('§2.2 — provera iskorišćenosti garancije', () => {
    it('GET /compliance/travel-guarantee/utilization vraća kumulativnu vrednost ORGANIZATOR prometa', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      await request(app.getHttpServer())
        .patch('/api/v1/compliance/travel-guarantee')
        .set(authed(accessToken))
        .send({
          createNew: true,
          provider: 'YUTA',
          policyNumber: `P-UTIL-${testRunId}`,
          coverageAmount: 1_000_000_00,
          currency: 'RSD',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        })
        .then((res) => createdGuaranteeIds.push(res.body.id));

      await createOrganizatorBooking({ totalPrice: 50000 });

      const res = await request(app.getHttpServer()).get('/api/v1/compliance/travel-guarantee/utilization').set(authed(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.utilizedAmount).toBeGreaterThanOrEqual(50000);
      expect(res.body.currency).toBe('RSD');
    });
  });

  describe('§2.3 — CIS registracija po rezervaciji', () => {
    it('createForBooking kreira REGISTERED zapis (idempotentno) za ORGANIZATOR rezervaciju sa aktivnom garancijom', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const guaranteeRes = await request(app.getHttpServer())
        .patch('/api/v1/compliance/travel-guarantee')
        .set(authed(accessToken))
        .send({
          createNew: true,
          provider: 'YUTA',
          policyNumber: `P-REG-${testRunId}`,
          coverageAmount: 1_000_000_00,
          currency: 'RSD',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        });
      createdGuaranteeIds.push(guaranteeRes.body.id);

      const booking = await createOrganizatorBooking();

      const first = await registrations.createForBooking(booking.id);
      expect(first.status).toBe('REGISTERED');
      expect(typeof first.cisRegistrationNumber).toBe('string');

      const second = await registrations.createForBooking(booking.id);
      expect(second.id).toBe(first.id); // idempotentno

      const viewRes = await request(app.getHttpServer())
        .get(`/api/v1/compliance/travel-guarantee-registrations?bookingId=${booking.id}`)
        .set(authed(accessToken));
      expect(viewRes.status).toBe(200);
      expect(viewRes.body).toHaveLength(1);
      expect(viewRes.body[0].status).toBe('REGISTERED');
    });

    it('releaseForBooking prevodi REGISTERED zapis u RELEASED preko RELEASE_PENDING (storno)', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const guaranteeRes = await request(app.getHttpServer())
        .patch('/api/v1/compliance/travel-guarantee')
        .set(authed(accessToken))
        .send({
          createNew: true,
          provider: 'YUTA',
          policyNumber: `P-REL-${testRunId}`,
          coverageAmount: 1_000_000_00,
          currency: 'RSD',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        });
      createdGuaranteeIds.push(guaranteeRes.body.id);

      const booking = await createOrganizatorBooking();
      await registrations.createForBooking(booking.id);

      const released = await registrations.releaseForBooking(booking.id);

      expect(released!.status).toBe('RELEASED');
      expect(released!.releasedAt).not.toBeNull();
    });
  });

  describe('§3 — izvoz za inspekciju', () => {
    it('POST /compliance/inspection-export vraća agregirane podatke za zadati period', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.RACUNOVODJA);
      await createOrganizatorBooking();

      const res = await request(app.getHttpServer())
        .post('/api/v1/compliance/inspection-export')
        .set(authed(accessToken))
        .send({ periodFrom: '2020-01-01', periodTo: '2030-01-01' });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body.bookings)).toBe(true);
      expect(typeof res.body.csv).toBe('string');
    });
  });
});
