import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { SubagentsService } from '../src/modules/m7-b2b-subagenti/subagents/subagents.service';

/**
 * E2E protiv prave Postgres baze — pokriva M5 spec §6.5 (vlasništvo/zaduženje rezervacije),
 * §6.6 (VIEW_ALL vidljivost) i M7 spec §2.0.7 (franšizni subagent — samostalno upravljanje
 * sopstvenim STAFF zaposlenima preko M1 §5 ownership provere). Dopuna 31.8.2026, na zahtev
 * vlasnika — vidi docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md §6.5/§6.6
 * i docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md §2.0.7.
 *
 * Bookinzi se kreiraju direktno preko Prisma (isti obrazac kao m7-exit-criteria.e2e-spec.ts
 * `createBooking` fixture) — svrha ovog fajla je HTTP ponašanje novih ruta/dozvola, ne ceo
 * Quote→Booking tok (to pokriva confirmQuote unit test suite).
 */
describe('M5 vlasništvo/zaduženje + M7 franšiza — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let subagents: SubagentsService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdSubagentIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdHandoffIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    subagents = app.get(SubagentsService);
  });

  afterAll(async () => {
    if (createdHandoffIds.length) await prisma.bookingHandoffRequest.deleteMany({ where: { id: { in: createdHandoffIds } } });
    if (createdBookingIds.length) {
      // M6 pretplatnik na dogadjaje sam pravi anketu posle putovanja za potvrdjenu rezervaciju,
      // pa je brisanje rezervacije padalo na stranom kljucu `post_trip_surveys_booking_id_fkey`
      // i rusilo CEO paket u `afterAll` (iako su svi testovi prosli). Zateceno 5.9.2026.
      await prisma.postTripSurvey.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    if (createdSubagentIds.length) await prisma.subagent.deleteMany({ where: { id: { in: createdSubagentIds } } });
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

  async function createInternalUser(roleName: string, linkedProfileId: string | null = null) {
    const user = await prisma.user.create({
      data: {
        email: `m5own-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M5 Test Korisnik',
        accountType: 'STAFF',
        status: 'ACTIVE',
        linkedProfileId,
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, accessToken };
  }

  async function createLegalEntityAccount() {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M5own Test Firma ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `m5own-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        taxId: `TAX-M5OWN-${testRunId}-${Math.random().toString(36).slice(2)}`,
      },
    });
    createdClientAccountIds.push(account.id);
    return account;
  }

  async function createBooking(overrides: Partial<{ ownerId: string; assignedToId: string; franchiseSubagentId: string | null; createdBy: string }> = {}) {
    const account = await createLegalEntityAccount();
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M5OWN-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId: account.id,
        buyerName: 'M5 Test Vlasništvo',
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        totalPrice: 10000,
        currency: 'EUR',
        confirmedAt: new Date(),
        createdBy: overrides.createdBy ?? 'e2e-test',
        ownerId: overrides.ownerId ?? null,
        assignedToId: overrides.assignedToId ?? overrides.ownerId ?? null,
        franchiseSubagentId: overrides.franchiseSubagentId ?? null,
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  describe('§6.6 — VIEW_ALL vidljivost', () => {
    it('podrazumevano Prodajni agent (ima VIEW_ALL) vidi TUĐU rezervaciju preko GET /sales/bookings/:id', async () => {
      const { user: vlasnik } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: vlasnik.id, createdBy: vlasnik.id });

      const res = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}`).set(authed(accessToken));
      expect(res.status).toBe(200);
    });

    it('kad se pojedincu ukloni VIEW_ALL (DENY override), tuđa rezervacija postaje nevidljiva (404)', async () => {
      const { user: vlasnik } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { user: agent, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: vlasnik.id, createdBy: vlasnik.id });

      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_resource_action: { module: 'M5', resource: 'booking', action: 'VIEW_ALL' } },
      });
      await prisma.userPermissionOverride.create({
        data: { userId: agent.id, permissionId: permission.id, effect: 'DENY', reason: 'e2e test suženje', grantedBy: vlasnik.id },
      });

      const res = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}`).set(authed(accessToken));
      expect(res.status).toBe(404);

      await prisma.userPermissionOverride.deleteMany({ where: { userId: agent.id, permissionId: permission.id } });
    });

    it('sužen agent I DALJE vidi rezervaciju gde je on sam vlasnik ILI zadužen', async () => {
      const { user: vlasnik } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { user: agent, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: agent.id, assignedToId: agent.id, createdBy: agent.id });

      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_resource_action: { module: 'M5', resource: 'booking', action: 'VIEW_ALL' } },
      });
      await prisma.userPermissionOverride.create({
        data: { userId: agent.id, permissionId: permission.id, effect: 'DENY', reason: 'e2e test suženje', grantedBy: vlasnik.id },
      });

      const res = await request(app.getHttpServer()).get(`/api/v1/sales/bookings/${booking.id}`).set(authed(accessToken));
      expect(res.status).toBe(200);

      await prisma.userPermissionOverride.deleteMany({ where: { userId: agent.id, permissionId: permission.id } });
    });
  });

  describe('§6.5 — prenos vlasništva', () => {
    it('trenutni vlasnik sme da prenese sopstvenu rezervaciju drugom korisniku', async () => {
      const { user: owner, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { user: newOwner } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: owner.id, createdBy: owner.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/transfer-ownership`)
        .set(authed(accessToken))
        .send({ newOwnerId: newOwner.id });

      expect(res.status).toBe(201);
      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.ownerId).toBe(newOwner.id);
    });

    it('korisnik koji NIJE vlasnik dobija 403 pri pokušaju prenosa', async () => {
      const { user: owner } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { user: outsider, accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: owner.id, createdBy: owner.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/transfer-ownership`)
        .set(authed(accessToken))
        .send({ newOwnerId: outsider.id });

      expect(res.status).toBe(403);
    });

    it('Sales Manager NEMA dozvolu TRANSFER_OWNERSHIP uopšte (403 na nivou dozvole, ne servisa)', async () => {
      const { user: owner } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.SALES_MANAGER);
      const booking = await createBooking({ ownerId: owner.id, createdBy: owner.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/transfer-ownership`)
        .set(authed(accessToken))
        .send({ newOwnerId: owner.id });

      expect(res.status).toBe(403);
    });

    it('Direktor prenosi vlasništvo bez obzira ko je trenutni vlasnik', async () => {
      const { user: owner } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.DIREKTOR);
      const { user: newOwner } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: owner.id, createdBy: owner.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/transfer-ownership`)
        .set(authed(accessToken))
        .send({ newOwnerId: newOwner.id });

      expect(res.status).toBe(201);
    });
  });

  describe('§6.5 — predaja zaduženja (handoff), uz pristanak', () => {
    it('predlog obicnog korisnika ostaje PENDING dok primalac ne prihvati; prihvatanje menja assigned_to_id', async () => {
      const { user: agent, accessToken: agentToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { user: colleague, accessToken: colleagueToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: agent.id, assignedToId: agent.id, createdBy: agent.id });

      const proposeRes = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/handoff-requests`)
        .set(authed(agentToken))
        .send({ toUserId: colleague.id });
      expect(proposeRes.status).toBe(201);
      expect(proposeRes.body.status).toBe('PENDING');
      createdHandoffIds.push(proposeRes.body.id);

      const stillOld = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(stillOld.assignedToId).toBe(agent.id);

      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/handoff-requests/${proposeRes.body.id}/accept`)
        .set(authed(colleagueToken));
      expect(acceptRes.status).toBe(201);

      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.assignedToId).toBe(colleague.id);
    });

    it('primalac sme da odbije predlog — assigned_to_id ostaje nepromenjen', async () => {
      const { user: agent, accessToken: agentToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { user: colleague, accessToken: colleagueToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: agent.id, assignedToId: agent.id, createdBy: agent.id });

      const proposeRes = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/handoff-requests`)
        .set(authed(agentToken))
        .send({ toUserId: colleague.id });
      createdHandoffIds.push(proposeRes.body.id);

      const declineRes = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/handoff-requests/${proposeRes.body.id}/decline`)
        .set(authed(colleagueToken));
      expect(declineRes.status).toBe(201);

      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.assignedToId).toBe(agent.id);
    });

    it('Vlasnik/Direktor izvršavaju zaduženje ODMAH, bez čekanja na prihvatanje', async () => {
      const { accessToken: direktorToken } = await createInternalUser(SYSTEM_ROLES.DIREKTOR);
      const { user: agent } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const { user: target } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT);
      const booking = await createBooking({ ownerId: agent.id, assignedToId: agent.id, createdBy: agent.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sales/bookings/${booking.id}/handoff-requests`)
        .set(authed(direktorToken))
        .send({ toUserId: target.id });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACCEPTED');
      createdHandoffIds.push(res.body.id);

      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updated.assignedToId).toBe(target.id);
    });
  });

  describe('M7 §2.0.7 — franšizni subagent, samostalno upravljanje sopstvenim STAFF nalozima', () => {
    async function createFranchiseSubagent() {
      const account = await createLegalEntityAccount();
      const { user: hqDirektor } = await createInternalUser(SYSTEM_ROLES.DIREKTOR);
      const created = await subagents.create({ clientAccountId: account.id }, { userId: hqDirektor.id });
      createdSubagentIds.push(created.id);
      const approved = await subagents.approve(
        created.id,
        { creditLimit: 100000, creditLimitCurrency: 'EUR', commissionPercentage: 10, privilegeLevel: 'FRANCHISE' as any },
        { userId: hqDirektor.id },
      );
      return approved;
    }

    it('franšizni Direktor sme da pozove novog STAFF zaposlenog SVOJE franšize (M1 §5)', async () => {
      const franchise = await createFranchiseSubagent();
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.DIREKTOR, franchise.id);
      const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.PRODAJNI_AGENT } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/iam/users')
        .set(authed(accessToken))
        .send({
          email: `m5own-fransiza-zaposleni-${testRunId}@tt-test.rs`,
          fullName: 'Franšizni Prodajni Agent',
          roleIds: [role.id],
          linkedProfileId: franchise.id,
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.user.id);
      const created = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
      expect(created.linkedProfileId).toBe(franchise.id);
    });

    it('franšizni Direktor NE sme da pozove zaposlenog BEZ franchiseId (matična agencija) ili za tuđu franšizu — 403', async () => {
      const franchise = await createFranchiseSubagent();
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.DIREKTOR, franchise.id);
      const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.PRODAJNI_AGENT } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/iam/users')
        .set(authed(accessToken))
        .send({
          email: `m5own-fransiza-tudja-${testRunId}@tt-test.rs`,
          fullName: 'Pokušaj van franšize',
          roleIds: [role.id],
          // linkedProfileId namerno izostavljen — pokušaj da doda nekog "matičnoj agenciji"
        });

      expect(res.status).toBe(403);
    });

    it('HQ Direktor (bez linked_profile_id) sme da pozove zaposlenog za bilo koju franšizu, bez ograde', async () => {
      const franchise = await createFranchiseSubagent();
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.DIREKTOR);
      const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.PRODAJNI_AGENT } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/iam/users')
        .set(authed(accessToken))
        .send({
          email: `m5own-hq-za-fransizu-${testRunId}@tt-test.rs`,
          fullName: 'HQ dodaje franšizi',
          roleIds: [role.id],
          linkedProfileId: franchise.id,
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.user.id);
    });

    it('franšizni STAFF nalog (INTERNAL_PANEL kontekst) vidi podrazumevano SAMO rezervacije SOPSTVENE franšize preko GET /sales/bookings', async () => {
      const franchiseA = await createFranchiseSubagent();
      const franchiseB = await createFranchiseSubagent();
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT, franchiseA.id);
      const bookingA = await createBooking({ franchiseSubagentId: franchiseA.id, createdBy: 'e2e-test' });
      const bookingB = await createBooking({ franchiseSubagentId: franchiseB.id, createdBy: 'e2e-test' });

      const res = await request(app.getHttpServer()).get('/api/v1/sales/bookings').set(authed(accessToken));
      expect(res.status).toBe(200);
      // Straničen odgovor od 5.9.2026 (dok. 39 nalaz 2.2) — redovi su u `.data`.
      const ids = res.body.data.map((b: any) => b.id);
      expect(ids).toContain(bookingA.id);
      expect(ids).not.toContain(bookingB.id);
    });
  });
});
