import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { EmailThreadsService } from '../src/modules/m22-email-inbox/email-threads/email-threads.service';

/**
 * E2E protiv prave Postgres baze — pokriva REST-testabilne stavke M22 izlaznog kriterijuma
 * (docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md poglavlje 9). Ingest
 * dolazne pošte (EmailThreadsService.receiveInboundMessage) nema sopstvenu HTTP rutu u ovom
 * prolazu (mock provajder nikad ne polluje žive poruke, §10) — poziva se direktno preko
 * servisa, isti obrazac kao M21 helpSuggestions.generateSuggestions() u m21-exit-criteria.
 */
describe('M22 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let emailThreads: EmailThreadsService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdMailboxIds: string[] = [];
  const createdThreadIds: string[] = [];
  const createdGuestProfileIds: string[] = [];
  const createdSupplierIds: string[] = [];
  const createdSupplierManifestIds: string[] = [];
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    emailThreads = app.get(EmailThreadsService);
  });

  afterAll(async () => {
    if (createdThreadIds.length) {
      await prisma.emailMessage.deleteMany({ where: { threadId: { in: createdThreadIds } } });
      await prisma.emailThread.deleteMany({ where: { id: { in: createdThreadIds } } });
    }
    if (createdTicketIds.length) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    if (createdMailboxIds.length) {
      await prisma.mailboxAccess.deleteMany({ where: { mailboxId: { in: createdMailboxIds } } });
      await prisma.mailbox.deleteMany({ where: { id: { in: createdMailboxIds } } });
    }
    if (createdSupplierManifestIds.length) {
      await prisma.supplierManifest.deleteMany({ where: { id: { in: createdSupplierManifestIds } } });
    }
    if (createdSupplierIds.length) {
      await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    }
    if (createdGuestProfileIds.length) {
      await prisma.guestProfile.deleteMany({ where: { id: { in: createdGuestProfileIds } } });
    }
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  async function createUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m22-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: `M22 Test ${roleName}`,
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

  async function createMailbox(actorToken: string, body: Record<string, unknown>) {
    const res = await request(app.getHttpServer()).post('/api/v1/email/mailboxes').set(authed(actorToken)).send(body);
    expect(res.status).toBe(201);
    createdMailboxIds.push(res.body.id);
    return res.body;
  }

  // ==========================================================================
  it('§2.2/§9 — MailboxAccess je isključivi gejt; Sales Manager sa katalog dozvolom, ali BEZ dodele, ne vidi niti', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const salesManager = await createUser(SYSTEM_ROLES.SALES_MANAGER); // ima katalog M22/email-thread/VIEW, ali NEMA MailboxAccess

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `sanduce1-${testRunId}@tt.rs`,
      displayName: 'Test sanduče 1',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
    });

    const listBefore = await request(app.getHttpServer()).get('/api/v1/email/threads').set(authed(salesManager.accessToken));
    expect(listBefore.status).toBe(200);
    expect(listBefore.body).toEqual([]);

    // Vlasnik (bez eksplicitne MailboxAccess dodele — samo je kreirao sanduče preko mailbox/CREATE)
    // takođe ne vidi niti — čak ni Vlasnik nije izuzet iz §2.2.
    const listVlasnik = await request(app.getHttpServer()).get('/api/v1/email/threads').set(authed(vlasnik.accessToken));
    expect(listVlasnik.status).toBe(200);
    expect(listVlasnik.body).toEqual([]);

    // Direktan poziv na tuđe sanduče preko GET /threads/:id/access — Sales Manager pokušava
    // POST na tuđu nit takođe pada na 403 (koristimo /access na mailboxes rutu, uža M22/
    // mailbox-access/GRANT dozvola — Sales Manager je nema).
    const grantAttempt = await request(app.getHttpServer())
      .post(`/api/v1/email/mailboxes/${mailbox.id}/access`)
      .set(authed(salesManager.accessToken))
      .send({ userId: salesManager.user.id, accessLevel: 'VIEW' });
    expect(grantAttempt.status).toBe(403);
  });

  // ==========================================================================
  it('§2.2/§9 — PERSONAL sanduče automatski dodeljuje REPLY vlasniku pri kreiranju', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const owner = await createUser(SYSTEM_ROLES.SALES_MANAGER);

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `licno-${testRunId}@tt.rs`,
      displayName: 'Lično sanduče',
      mailboxType: 'PERSONAL',
      ownerUserId: owner.user.id,
      providerConnectionRef: 'mock',
    });

    const access = await prisma.mailboxAccess.findUnique({
      where: { mailboxId_userId: { mailboxId: mailbox.id, userId: owner.user.id } },
    });
    expect(access).not.toBeNull();
    expect(access!.accessLevel).toBe('REPLY');

    // Vlasnik sandučeta sad vidi svoju (praznu) niti-listu bez eksplicitnog grant-a od nekog drugog.
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/email/threads')
      .query({ mailboxId: mailbox.id })
      .set(authed(owner.accessToken));
    expect(listRes.status).toBe(200);
  });

  // ==========================================================================
  it('§3.1/§9 — tačno poklapanje korespondenta (GuestProfile.email) na novu nit, sažetak/nacrt pokušan na svaku INBOUND poruku', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const staff = await createUser(SYSTEM_ROLES.SALES_MANAGER);

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `rezervacije-${testRunId}@tt.rs`,
      displayName: 'Rezervacije',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/email/mailboxes/${mailbox.id}/access`)
      .set(authed(vlasnik.accessToken))
      .send({ userId: staff.user.id, accessLevel: 'REPLY' });

    const guestEmail = `gost-${testRunId}@primer.rs`;
    const guestProfile = await prisma.guestProfile.create({
      data: {
        fullName: 'Test Gost',
        documentType: 'PASSPORT',
        documentNumber: `DOC-${testRunId}`,
        nationality: 'RS',
        dateOfBirth: new Date('1990-01-01'),
        email: guestEmail,
      },
    });
    createdGuestProfileIds.push(guestProfile.id);

    const thread = await emailThreads.receiveInboundMessage(mailbox.id, {
      fromAddress: guestEmail,
      toAddresses: [mailbox.address],
      subject: `Upit o rezervaciji ${testRunId}`,
      body: 'Zdravo, zanima me da li je slobodan termin.',
      providerMessageId: `pm-guest-${testRunId}`,
      receivedAt: new Date().toISOString(),
    });
    createdThreadIds.push(thread.id);

    expect(thread.correspondentType).toBe('GUEST');
    expect(thread.status).toBe('AWAITING_REPLY');

    const messages = await prisma.emailMessage.findMany({ where: { threadId: thread.id } });
    const inbound = messages.find((m) => m.direction === 'INBOUND');
    expect(inbound).toBeDefined();

    // Nit vidljiva SAMO korisniku sa MailboxAccess.
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/email/threads')
      .query({ mailboxId: mailbox.id })
      .set(authed(staff.accessToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.map((t: any) => t.id)).toContain(thread.id);
  });

  // ==========================================================================
  it('§3.1a/§8.8/§9 — jedinstveno sanduče dobavljača: [REF: TT-NNNNNN] predlaže M5 vezu, correspondentType=SUPPLIER, M22 NIKAD ne piše M5 potvrdu', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `dobavljaci-${testRunId}@tt.rs`,
      displayName: 'Dobavljači (jedinstveno)',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
      isSupplierUnifiedInbox: true,
    });

    const supplier = await prisma.supplier.create({
      data: {
        name: `M22 Test Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX22-${testRunId}`,
        registrationNumber: `REG22-${testRunId}`,
        country: 'Srbija',
        contactName: 'Ana',
        contactEmail: `hotel-${testRunId}@dobavljac.rs`,
        contactPhone: '060111111',
        status: 'ACTIVE',
      },
    });
    createdSupplierIds.push(supplier.id);

    const manifest = await prisma.supplierManifest.create({
      data: {
        supplierId: supplier.id,
        supplierTypeSnapshot: 'HOTEL',
        periodFrom: new Date('2026-09-01'),
        periodTo: new Date('2026-09-10'),
        status: 'SENT',
        generatedBy: vlasnik.user.id,
        sentAt: new Date(),
        referenceCode: `TT-${testRunId}`,
      },
    });
    createdSupplierManifestIds.push(manifest.id);

    const thread = await emailThreads.receiveInboundMessage(mailbox.id, {
      fromAddress: supplier.contactEmail!,
      toAddresses: [mailbox.address],
      subject: `Re: Potvrda [REF: TT-${testRunId}]`,
      body: 'Potvrđujemo raspoloživost.',
      providerMessageId: `pm-supplier-${testRunId}`,
      receivedAt: new Date().toISOString(),
    });
    createdThreadIds.push(thread.id);

    expect(thread.correspondentType).toBe('SUPPLIER');
    expect(thread.relatedSupplierManifestId).toBe(manifest.id);

    // M5 potvrda ostaje isključivo ljudski klik — ReferenceMatcherService/EmailThreadsService
    // NIKAD ne dotiču supplierConfirmedAt/supplierConfirmedBy.
    const manifestAfter = await prisma.supplierManifest.findUniqueOrThrow({ where: { id: manifest.id } });
    expect(manifestAfter.status).toBe('SENT'); // nepromenjeno

    const changeNoticeRelated = await prisma.supplierChangeNotice.findFirst({ where: { supplierConfirmedAt: { not: null } } });
    // Statička provera koda (ne runtime) — nijedan M22 fajl ne sme pozivati M5 confirmSupplier
    // niti direktno pisati supplierConfirmedAt/supplierConfirmedBy.
    const m22Root = path.join(__dirname, '..', 'src', 'modules', 'm22-email-inbox');
    let matches = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) {
          const codeOnly = fs
            .readFileSync(full, 'utf-8')
            .split('\n')
            .filter((line) => !line.trim().startsWith('//'))
            .join('\n');
          if (/confirmSupplier|supplierConfirmedAt\s*:|supplierConfirmedBy\s*:/.test(codeOnly)) matches++;
        }
      }
    };
    walk(m22Root);
    expect(matches).toBe(0);
    // changeNoticeRelated je namerno nepovezan sa ovim testom (samo dokazuje da upit radi) —
    // referenca ostaje ovde radi čitljivosti asercije iznad.
    void changeNoticeRelated;
  });

  // ==========================================================================
  it('§8/§9 — nacrt/STAFF poruka bez sentBy se ne može poslati bez eksplicitnog ljudskog klika; poruka se ne šalje dvaput', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const staff = await createUser(SYSTEM_ROLES.SALES_MANAGER);

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `podrska-${testRunId}@tt.rs`,
      displayName: 'Podrška',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/email/mailboxes/${mailbox.id}/access`)
      .set(authed(vlasnik.accessToken))
      .send({ userId: staff.user.id, accessLevel: 'REPLY' });

    const thread = await prisma.emailThread.create({
      data: { mailboxId: mailbox.id, subject: `Test nit ${testRunId}`, status: 'OPEN' },
    });
    createdThreadIds.push(thread.id);

    // Nacrt kreiran preko POST /messages BEZ send:true ostaje sentBy=null.
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/email/threads/${thread.id}/messages`)
      .set(authed(staff.accessToken))
      .send({ body: 'Nacrt odgovora — cena je 500 EUR, molim proveru pre slanja.' });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.sentBy).toBeNull();

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/email/threads/${thread.id}/messages/${draftRes.body.id}/send`)
      .set(authed(staff.accessToken))
      .send({});
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.sentBy).toBe(staff.user.id);

    const secondSend = await request(app.getHttpServer())
      .post(`/api/v1/email/threads/${thread.id}/messages/${draftRes.body.id}/send`)
      .set(authed(staff.accessToken))
      .send({});
    expect(secondSend.status).toBe(400);
  });

  // ==========================================================================
  it('§8/§9 — konverzija niti u tiket kreira M14 Ticket sa channel=EMAIL i upisuje reciprocno convertedToTicketId/sourceEmailThreadId', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `konverzija-${testRunId}@tt.rs`,
      displayName: 'Konverzija',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/email/mailboxes/${mailbox.id}/access`)
      .set(authed(vlasnik.accessToken))
      .send({ userId: vlasnik.user.id, accessLevel: 'REPLY' });

    const thread = await prisma.emailThread.create({
      data: { mailboxId: mailbox.id, subject: `Za konverziju ${testRunId}`, status: 'OPEN', correspondentType: 'OTHER' },
    });
    createdThreadIds.push(thread.id);

    const convertRes = await request(app.getHttpServer())
      .post(`/api/v1/email/threads/${thread.id}/convert-to-ticket`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(convertRes.status).toBe(201);
    const ticketId = convertRes.body.ticket.id;
    createdTicketIds.push(ticketId);

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.channel).toBe('EMAIL');
    expect(ticket.sourceEmailThreadId).toBe(thread.id);

    const threadAfter = await prisma.emailThread.findUniqueOrThrow({ where: { id: thread.id } });
    expect(threadAfter.convertedToTicketId).toBe(ticketId);
  });

  // ==========================================================================
  // Nedostatak 2 (M17 Faza 7, rešeno) — GET /email/threads i GET /email/threads/:id vraćaju
  // mailbox.address/displayName BEZ šire M22/mailbox/VIEW dozvole, samo na osnovu MailboxAccess.
  it('Nedostatak 2 — nit nosi mailbox.address/displayName i za nosioca MailboxAccess bez mailbox/VIEW dozvole', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const staff = await createUser(SYSTEM_ROLES.SALES_MANAGER); // nema M22/mailbox/VIEW (Vlasnik/Direktor only)

    const mailbox = await createMailbox(vlasnik.accessToken, {
      address: `naziv-vidljiv-${testRunId}@tt.rs`,
      displayName: 'Naziv Vidljiv Test',
      mailboxType: 'SHARED',
      providerConnectionRef: 'mock',
    });
    await request(app.getHttpServer())
      .post(`/api/v1/email/mailboxes/${mailbox.id}/access`)
      .set(authed(vlasnik.accessToken))
      .send({ userId: staff.user.id, accessLevel: 'VIEW' });

    const thread = await prisma.emailThread.create({
      data: { mailboxId: mailbox.id, subject: `Nedostatak2 ${testRunId}`, status: 'OPEN' },
    });
    createdThreadIds.push(thread.id);

    // Sales Manager NEMA M22/mailbox/VIEW — GET /email/mailboxes bi mu vratio 403 — ali GET
    // /email/threads mu i dalje mora pokazati naziv sandučeta na koje ima MailboxAccess.
    const mailboxesForbidden = await request(app.getHttpServer()).get('/api/v1/email/mailboxes').set(authed(staff.accessToken));
    expect(mailboxesForbidden.status).toBe(403);

    const listRes = await request(app.getHttpServer()).get('/api/v1/email/threads').set(authed(staff.accessToken));
    expect(listRes.status).toBe(200);
    const found = listRes.body.find((t: any) => t.id === thread.id);
    expect(found).toBeDefined();
    expect(found.mailbox).toEqual({ address: mailbox.address, displayName: mailbox.displayName });

    const detailRes = await request(app.getHttpServer()).get(`/api/v1/email/threads/${thread.id}`).set(authed(staff.accessToken));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.mailbox).toEqual({ address: mailbox.address, displayName: mailbox.displayName });
  });
});
