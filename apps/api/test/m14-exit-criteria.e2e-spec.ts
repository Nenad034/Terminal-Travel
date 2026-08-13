import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { EventBusService } from '../src/common/events/event-bus.service';
import { M14AlarmsService } from '../src/modules/m14-helpdesk/events/m14-alarms.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M14 izlaznog kriterijuma
 * (docs/moduli/M14-helpdesk/14-SPECIFIKACIJA-M14-HELPDESK.md poglavlje 7).
 */
describe('M14 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let eventBus: EventBusService;
  let m14Alarms: M14AlarmsService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdClientAccountIds: string[] = [];
  const createdSubagentIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdTicketIds: string[] = [];
  const createdFiscalDocumentIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    eventBus = app.get(EventBusService);
    m14Alarms = app.get(M14AlarmsService);
  });

  afterAll(async () => {
    await prisma.fiscalDocument.deleteMany({ where: { id: { in: createdFiscalDocumentIds } } });
    if (createdTicketIds.length) {
      await prisma.ticketMessage.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    if (createdBookingIds.length) {
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

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m14-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M14 Test Korisnik',
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

  async function createGuestUser() {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'INDIVIDUAL',
        fullName: `M14 Test Gost ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `gost-m14-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
      },
    });
    createdClientAccountIds.push(account.id);
    const user = await prisma.user.create({
      data: {
        email: `m14-guest-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M14 Test Gost Nalog',
        accountType: 'GUEST',
        linkedProfileId: account.id,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.GOST } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, account, accessToken };
  }

  async function createSubagentAdminUser() {
    const account = await prisma.clientAccount.create({
      data: {
        accountType: 'LEGAL_ENTITY',
        companyName: `M14 Test Turagencija ${testRunId}-${Math.random().toString(36).slice(2)}`,
        email: `subagent-m14-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        taxId: `TAX-M14-${testRunId}-${Math.random().toString(36).slice(2)}`,
      },
    });
    createdClientAccountIds.push(account.id);
    const subagent = await prisma.subagent.create({
      data: { clientAccountId: account.id, status: 'ACTIVE', commissionPercentage: 10, creditLimit: 100000, creditLimitCurrency: 'EUR' },
    });
    createdSubagentIds.push(subagent.id);
    const user = await prisma.user.create({
      data: {
        email: `m14-subadmin-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M14 Test SUBAGENT_ADMIN',
        accountType: 'SUBAGENT_CONTACT',
        linkedProfileId: subagent.id,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.SUBAGENT_ADMIN } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, account, subagent, accessToken };
  }

  async function createBooking(clientAccountId: string, overrides: Partial<{ totalPrice: number; currency: string }> = {}) {
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: `TT-M14-E2E-${testRunId}-${Math.random().toString(36).slice(2)}`,
        clientAccountId,
        buyerName: 'M14 Test Booking',
        buyerType: 'FIZICKO_LICE',
        channel: 'B2C_SITE',
        tipNastupanja: 'ORGANIZATOR',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        totalPrice: overrides.totalPrice ?? 20000,
        currency: overrides.currency ?? 'RSD',
        confirmedAt: new Date(),
        createdBy: 'e2e-test',
      },
    });
    createdBookingIds.push(booking.id);
    return booking;
  }

  describe('§7 — Gost i subagent otvaraju tiket i vide status/odgovore', () => {
    it('Gost (M8) otvara sopstveni tiket i vidi ga; ne vidi tuđi', async () => {
      const { accessToken, account } = await createGuestUser();
      const { accessToken: otherAccessToken } = await createGuestUser();

      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(accessToken))
        .send({ requesterType: 'GUEST', subject: 'Pitanje o rezervaciji', category: 'REZERVACIJA', channel: 'SITE_FORM' });
      expect(created.status).toBe(201);
      createdTicketIds.push(created.body.id);
      expect(created.body.requesterClientAccountId).toBe(account.id); // prepisano na sopstveni nalog, ignoriše telo

      const own = await request(app.getHttpServer()).get(`/api/v1/helpdesk/tickets/${created.body.id}`).set(authed(accessToken));
      expect(own.status).toBe(200);
      expect(own.body.status).toBe('OPEN');

      const forbidden = await request(app.getHttpServer()).get(`/api/v1/helpdesk/tickets/${created.body.id}`).set(authed(otherAccessToken));
      expect(forbidden.status).toBe(404); // tuđ tiket — nikad 403 (ne otkriva postojanje)
    });

    it('Subagent (M7 portal) otvara sopstveni tiket preko B2B_PORTAL kanala', async () => {
      const { accessToken, account } = await createSubagentAdminUser();

      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(accessToken))
        .send({ requesterType: 'SUBAGENT', subject: 'Pitanje o proviziji', category: 'PLACANJE', channel: 'B2B_PORTAL' });
      expect(created.status).toBe(201);
      createdTicketIds.push(created.body.id);
      expect(created.body.requesterClientAccountId).toBe(account.id);

      const list = await request(app.getHttpServer()).get('/api/v1/helpdesk/tickets').set(authed(accessToken));
      expect(list.status).toBe(200);
      expect(list.body.map((t: any) => t.id)).toContain(created.body.id);
    });
  });

  describe('§7 — interne beleške nikad vidljive van internog panela', () => {
    it('is_internal_note poruka je vidljiva internom timu, ali filtrirana za Gosta', async () => {
      const { accessToken: guestToken } = await createGuestUser();
      const { accessToken: staffToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const ticket = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(guestToken))
        .send({ requesterType: 'GUEST', subject: 'Test interna beleška', category: 'DRUGO', channel: 'SITE_FORM' });
      createdTicketIds.push(ticket.body.id);

      await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages`)
        .set(authed(staffToken))
        .send({ senderType: 'STAFF', body: 'Interna beleška — ne za gosta', isInternalNote: true });

      const seenByStaff = await request(app.getHttpServer()).get(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages`).set(authed(staffToken));
      expect(seenByStaff.body.some((m: any) => m.isInternalNote)).toBe(true);

      const seenByGuest = await request(app.getHttpServer()).get(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages`).set(authed(guestToken));
      expect(seenByGuest.body.some((m: any) => m.isInternalNote)).toBe(false);
    });
  });

  describe('§4/§7 — AI nacrt koji pominje cenu/obavezu ne može biti poslat bez ljudskog naloga', () => {
    it('AI_DRAFT poruka ima sent_by=null pri kreiranju; POST .../send je jedini put', async () => {
      const { accessToken: staffToken, user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const { accessToken: guestToken } = await createGuestUser();

      const ticket = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(guestToken))
        .send({ requesterType: 'GUEST', subject: 'Pitanje o povraćaju novca', category: 'PLACANJE', channel: 'SITE_FORM' });
      createdTicketIds.push(ticket.body.id);

      const draft = await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages`)
        .set(authed(staffToken))
        .send({ senderType: 'AI_DRAFT', body: 'Nacrt: povraćaj od 100 EUR biće izvršen u roku od 14 dana.' });
      expect(draft.status).toBe(201);
      expect(draft.body.sentBy).toBeNull();

      // Gost nema RESPOND — ne može poslati AI nacrt.
      const guestAttempt = await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages/${draft.body.id}/send`)
        .set(authed(guestToken));
      expect(guestAttempt.status).toBe(403);

      const sent = await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages/${draft.body.id}/send`)
        .set(authed(staffToken));
      expect(sent.status).toBe(201);
      expect(sent.body.sentBy).toBe(staff.id);

      const resend = await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${ticket.body.id}/messages/${draft.body.id}/send`)
        .set(authed(staffToken));
      expect(resend.status).toBe(400); // već poslato
    });
  });

  describe('§7 — tiket vezan za rezervaciju prikazuje kontekst iz M5 bez dupliranja', () => {
    it('GET /tickets/:id vraća relatedBooking uživo iz M5 Booking', async () => {
      const { accessToken, account } = await createGuestUser();
      const booking = await createBooking(account.id);

      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(accessToken))
        .send({ requesterType: 'GUEST', relatedBookingId: booking.id, subject: 'Pitanje o mojoj rezervaciji', category: 'REZERVACIJA', channel: 'SITE_FORM' });
      createdTicketIds.push(created.body.id);

      const detail = await request(app.getHttpServer()).get(`/api/v1/helpdesk/tickets/${created.body.id}`).set(authed(accessToken));
      expect(detail.body.relatedBooking).toMatchObject({ id: booking.id, bookingNumber: booking.bookingNumber, status: 'CONFIRMED' });
    });
  });

  describe('§3.1 — rok od 8 dana i eskalacija posle 5 dana bez odgovora tima', () => {
    it('REKLAMACIJA tiket dobija zzp_response_deadline = created_at + 8 dana pri kreiranju', async () => {
      const { accessToken } = await createGuestUser();
      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(accessToken))
        .send({ requesterType: 'GUEST', subject: 'Reklamacija na uslugu', category: 'REKLAMACIJA', channel: 'SITE_FORM' });
      createdTicketIds.push(created.body.id);

      const createdAt = new Date(created.body.createdAt);
      const deadline = new Date(created.body.zzpResponseDeadline);
      const diffDays = Math.round((deadline.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(8);
      expect(created.body.zzpEscalatedAt).toBeNull();
    });

    it('bez ijednog STAFF odgovora 5 dana od prijema, M14AlarmsService popunjava zzp_escalated_at i emituje eskalaciju', async () => {
      const { accessToken, account } = await createGuestUser();
      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(accessToken))
        .send({ requesterType: 'GUEST', subject: 'Reklamacija — bez odgovora', category: 'REKLAMACIJA', channel: 'SITE_FORM' });
      createdTicketIds.push(created.body.id);
      void account;

      // Simulira protok 6 dana (createdAt unazad) — direktno preko Prisma, ista tehnika kao
      // M10 stale-drafts test (nema smisla čekati stvaran protok vremena u e2e testu.
      await prisma.ticket.update({ where: { id: created.body.id }, data: { createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } });

      const emitted: any[] = [];
      // ne postoji direktan način da presretnemo eventBus.emit u e2e (pravi Postgres LISTEN/NOTIFY),
      // pa proveravamo direktno rezultat (broj eskaliranih) + upisano zzp_escalated_at u bazi.
      void emitted;
      const escalatedCount = await m14Alarms.checkZzpEscalations();
      expect(escalatedCount).toBeGreaterThanOrEqual(1);

      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(after.zzpEscalatedAt).not.toBeNull();
    });

    it('STAFF odgovor sa sent_by popunjenim sprečava eskalaciju', async () => {
      const { accessToken: guestToken } = await createGuestUser();
      const { accessToken: staffToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const created = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(guestToken))
        .send({ requesterType: 'GUEST', subject: 'Reklamacija — sa odgovorom', category: 'REKLAMACIJA', channel: 'SITE_FORM' });
      createdTicketIds.push(created.body.id);

      await request(app.getHttpServer())
        .post(`/api/v1/helpdesk/tickets/${created.body.id}/messages`)
        .set(authed(staffToken))
        .send({ senderType: 'STAFF', body: 'Primili smo vašu reklamaciju, rešavamo.' });

      await prisma.ticket.update({ where: { id: created.body.id }, data: { createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } });
      await m14Alarms.checkZzpEscalations();

      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(after.zzpEscalatedAt).toBeNull();
    });
  });

  describe('§3.2 — rešavanje reklamacije uz povraćaj automatski priprema DRAFT storno u M10', () => {
    it('PATCH status=RESOLVED + refund_decision=true emituje ticket.resolved_with_refund; M10 priprema DRAFT storno; slanje i dalje zahteva SUBMIT', async () => {
      const { accessToken: guestToken, account } = await createGuestUser();
      const { accessToken: staffToken, user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const booking = await createBooking(account.id, { totalPrice: 15000, currency: 'RSD' });

      // Original poslat fiskalni dokument (M10 §6) — preduslov za storno nacrt.
      const original = await prisma.fiscalDocument.create({
        data: {
          bookingId: booking.id,
          documentType: 'ESIR_RACUN',
          status: 'SUBMITTED',
          vatCalculationBasis: 'MARZA',
          amountOriginal: 15000,
          currencyOriginal: 'RSD',
          amountRsd: 15000,
          vatRate: 20,
          vatAmount: 2500,
          buyerNameSnapshot: 'M14 Test Booking',
          submittedBy: staff.id,
          submittedAt: new Date(),
          issuedAt: new Date(),
          buyerAcceptanceStatus: 'N_A',
        },
      });
      createdFiscalDocumentIds.push(original.id);

      const ticket = await request(app.getHttpServer())
        .post('/api/v1/helpdesk/tickets')
        .set(authed(guestToken))
        .send({ requesterType: 'GUEST', relatedBookingId: booking.id, subject: 'Reklamacija sa povraćajem', category: 'REKLAMACIJA', channel: 'SITE_FORM' });
      createdTicketIds.push(ticket.body.id);

      const resolved = await request(app.getHttpServer())
        .patch(`/api/v1/helpdesk/tickets/${ticket.body.id}`)
        .set(authed(staffToken))
        .send({ status: 'RESOLVED', refundDecision: true });
      expect(resolved.status).toBe(200);
      expect(resolved.body.status).toBe('RESOLVED');
      expect(resolved.body.refundDecision).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500)); // async LISTEN/NOTIFY, isti obrazac kao M7/M10 e2e

      const stornoDraft = await prisma.fiscalDocument.findFirst({ where: { stornoOfDocumentId: original.id, status: 'DRAFT' } });
      expect(stornoDraft).not.toBeNull();
      createdFiscalDocumentIds.push(stornoDraft!.id);
      expect(stornoDraft!.bookingId).toBe(booking.id);

      // Slanje i dalje zahteva ljudsku SUBMIT potvrdu — nije se samo od sebe poslalo.
      const beforeSubmitCount = await prisma.fiscalDocument.count({ where: { status: 'STORNIRANO' } });
      expect(beforeSubmitCount).toBe(0);
    });

    it('event emitovan ručno preko Event Bus-a (isti obrazac kao M7/M10 e2e) daje isti rezultat', async () => {
      const { account } = await createGuestUser();
      const { user: staff } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const booking = await createBooking(account.id, { totalPrice: 8000, currency: 'RSD' });

      const original = await prisma.fiscalDocument.create({
        data: {
          bookingId: booking.id,
          documentType: 'ESIR_RACUN',
          status: 'SUBMITTED',
          vatCalculationBasis: 'MARZA',
          amountOriginal: 8000,
          currencyOriginal: 'RSD',
          amountRsd: 8000,
          vatRate: 20,
          vatAmount: 1333,
          buyerNameSnapshot: 'M14 Test Booking direktan event',
          submittedBy: staff.id,
          submittedAt: new Date(),
          issuedAt: new Date(),
          buyerAcceptanceStatus: 'N_A',
        },
      });
      createdFiscalDocumentIds.push(original.id);

      await eventBus.emit('M14', 'ticket.resolved_with_refund', { ticketId: 'e2e-direct-event', relatedBookingId: booking.id });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stornoDraft = await prisma.fiscalDocument.findFirst({ where: { stornoOfDocumentId: original.id, status: 'DRAFT' } });
      expect(stornoDraft).not.toBeNull();
      createdFiscalDocumentIds.push(stornoDraft!.id);
    });
  });
});
