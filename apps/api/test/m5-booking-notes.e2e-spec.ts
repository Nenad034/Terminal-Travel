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
 * E2E protiv prave Postgres baze — M5 spec §4.6 (interne beleške uz rezervaciju).
 * Jedinični testovi lažiraju Prisma sloj, pa ne dokazuju da migracija, dozvole iz seed-a i
 * rute stvarno rade zajedno — ovo dokazuje.
 *
 * Bookinzi se kreiraju direktno preko Prisma (isti obrazac kao
 * m5-booking-ownership-franchise.e2e-spec.ts) — svrha je HTTP ponašanje novih ruta/dozvola,
 * ne ceo Quote→Booking tok.
 */
describe('M5 §4.6 — interne beleške uz rezervaciju (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdBookingIds: string[] = [];

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
    // BookingNote ima onDelete: Cascade — briše se sa rezervacijom.
    if (createdBookingIds.length) await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
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

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m5note-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M5 Test Beleške',
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

  async function createBooking(createdBy: string) {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M5note Test Firma ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `m5note-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        taxId: `TAX-M5NOTE-${testRunId}-${Math.random().toString(36).slice(2)}`,
      },
    });
    createdClientAccountIds.push(account.id);
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M5NOTE-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: account.id,
        buyerName: 'M5 Test Beleške',
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 10000,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy,
        ownerId: createdBy,
        assignedToId: createdBy,
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  it('cео tok: upis beleške → čitanje → brisanje, protiv prave baze', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
    const booking = await createBooking(user.id);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/sales/bookings/${booking.id}/notes`)
      .set(authed(accessToken))
      .send({ body: 'gost traži sobu na višem spratu' });
    expect(created.status).toBe(201);
    expect(created.body.createdBy).toBe(user.id);

    const list = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}/notes`).set(authed(accessToken));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].body).toBe('gost traži sobu na višem spratu');

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/sales/bookings/${booking.id}/notes/${created.body.id}`)
      .set(authed(accessToken));
    expect(del.status).toBe(200);

    const after = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}/notes`).set(authed(accessToken));
    expect(after.body).toHaveLength(0);
  });

  it('created_by dolazi iz tokena — vrednost poslata u telu zahteva se odbacuje', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
    const booking = await createBooking(user.id);

    // `forbidNonWhitelisted` na ValidationPipe: nepoznato polje obara zahtev, umesto da tiho prođe.
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/bookings/${booking.id}/notes`)
      .set(authed(accessToken))
      .send({ body: 'tekst', createdBy: 'NEKO-DRUGI' });
    expect(res.status).toBe(400);
  });

  it('prazna beleška i beleška duža od 4000 znakova se odbijaju', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
    const booking = await createBooking(user.id);

    const prazna = await request(app.getHttpServer()).post(`/api/v1/sales/bookings/${booking.id}/notes`).set(authed(accessToken)).send({ body: '' });
    expect(prazna.status).toBe(400);

    const preduga = await request(app.getHttpServer())
      .post(`/api/v1/sales/bookings/${booking.id}/notes`)
      .set(authed(accessToken))
      .send({ body: 'x'.repeat(4001) });
    expect(preduga.status).toBe(400);
  });

  it('tuđu belešku Prodajni agent ne sme da obriše, Vlasnik sme', async () => {
    const { user: autor, accessToken: autorToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
    const { accessToken: drugiToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
    const { accessToken: vlasnikToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const booking = await createBooking(autor.id);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/sales/bookings/${booking.id}/notes`)
      .set(authed(autorToken))
      .send({ body: 'beleška autora' });
    expect(created.status).toBe(201);

    const odbijeno = await request(app.getHttpServer())
      .delete(`/api/v1/sales/bookings/${booking.id}/notes/${created.body.id}`)
      .set(authed(drugiToken));
    expect(odbijeno.status).toBe(403);

    const dozvoljeno = await request(app.getHttpServer())
      .delete(`/api/v1/sales/bookings/${booking.id}/notes/${created.body.id}`)
      .set(authed(vlasnikToken));
    expect(dozvoljeno.status).toBe(200);
  });

  it('beleška se ne može dohvatiti preko ID-ja druge rezervacije', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const booking = await createBooking(user.id);
    const druga = await createBooking(user.id);

    const created = await request(app.getHttpServer()).post(`/api/v1/sales/bookings/${booking.id}/notes`).set(authed(accessToken)).send({ body: 'tekst' });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/sales/bookings/${druga.id}/notes/${created.body.id}`)
      .set(authed(accessToken));
    expect(res.status).toBe(404);
  });

  it('brisanje beleške ostaje u M1 audit logu, ali bez sadržaja beleške', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const booking = await createBooking(user.id);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/sales/bookings/${booking.id}/notes`)
      .set(authed(accessToken))
      .send({ body: 'poverljiv sadržaj beleške' });
    await request(app.getHttpServer()).delete(`/api/v1/sales/bookings/${booking.id}/notes/${created.body.id}`).set(authed(accessToken));

    const entries = await prisma.auditLogEntry.findMany({ where: { resourceType: 'BookingNote', resourceId: created.body.id } });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('booking_note.created');
    expect(actions).toContain('booking_note.deleted');
    expect(JSON.stringify(entries)).not.toContain('poverljiv sadržaj beleške');
  });
});
