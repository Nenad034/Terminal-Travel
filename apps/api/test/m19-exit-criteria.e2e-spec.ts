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
import { HealthSignalsService } from '../src/modules/m18-operativni-nadzor/health-signals/health-signals.service';

/**
 * E2E protiv prave Postgres baze — pokriva REST-testabilne stavke M19 izlaznog kriterijuma
 * (docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md
 * poglavlje 10). WS realtime deo (message.new emitovanje uživo, typing indikator preko pravog
 * socket.io klijenta) je NAMERNO van obima ovog fajla — pokriven jediničnim testom na
 * ChatGatewayService sa mock socket-ima (chat-gateway.service.spec.ts), dokumentovano ograničenje
 * prvog prolaza (spec §11/implementacioni plan).
 */
describe('M19 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let healthSignals: HealthSignalsService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdSupplierIds: string[] = [];

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    healthSignals = app.get(HealthSignalsService);
  });

  afterAll(async () => {
    // Redosled brisanja poštuje FK zavisnosti (Message/ConversationParticipant/
    // SupplierConversationAccess -> Conversation; SupplierContact -> Supplier).
    const conversations = await prisma.conversation.findMany({ where: { createdBy: { in: createdUserIds } } });
    const conversationIds = conversations.map((c) => c.id);
    if (conversationIds.length) {
      await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await prisma.supplierConversationAccess.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    }
    // Sistemska "Obaveštenja" konverzacija (InAppNotificationsService) — obriši i tu, pošto
    // system user nije u createdUserIds ali test korisnici jesu učesnici.
    const systemNotifConvos = await prisma.conversationParticipant.findMany({
      where: { userId: { in: createdUserIds } },
      select: { conversationId: true },
    });
    const notifConvoIds = [...new Set(systemNotifConvos.map((c) => c.conversationId))];
    if (notifConvoIds.length) {
      await prisma.message.deleteMany({ where: { conversationId: { in: notifConvoIds } } });
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: notifConvoIds } } });
      await prisma.conversation.deleteMany({ where: { id: { in: notifConvoIds } } });
    }
    if (createdSupplierIds.length) {
      await prisma.supplierContact.deleteMany({ where: { supplierId: { in: createdSupplierIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    }
    if (createdUserIds.length) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m19-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: `M19 Test ${roleName}`,
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

  // ==========================================================================
  it('§10 — dva zaposlena razmenjuju poruke preko REST fallback-a (WS je primarni kanal, testiran jedinično)', async () => {
    const alice = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const bob = await createInternalUser(SYSTEM_ROLES.HR);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations')
      .set(authed(alice.accessToken))
      .send({ type: 'DIRECT', participantUserIds: [bob.user.id] });
    expect(createRes.status).toBe(201);
    const conversationId = createRes.body.id;

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set(authed(alice.accessToken))
      .send({ body: 'Zdravo Bobe!' });
    expect(sendRes.status).toBe(201);

    const bobMessages = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set(authed(bob.accessToken));
    expect(bobMessages.status).toBe(200);
    expect(bobMessages.body).toHaveLength(1);
    expect(bobMessages.body[0].body).toBe('Zdravo Bobe!');
  });

  // ==========================================================================
  it('§9.4/§10 — zaposleni bez SupplierConversationAccess ne vidi EXTERNAL_SUPPLIER razgovor uprkos opštoj VIEW dozvoli', async () => {
    const owner = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const salesAgentNoAccess = await createInternalUser(SYSTEM_ROLES.PRODAJNI_AGENT); // ima opštu supplier-conversation/VIEW

    const supplier = await prisma.supplier.create({
      data: {
        name: `M19 Test Dobavljač ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX-${testRunId}`,
        registrationNumber: `REG-${testRunId}`,
        country: 'Srbija',
        contactName: 'Marko',
        contactEmail: `dobavljac-${testRunId}@primer.rs`,
        contactPhone: '060000000',
        status: 'ACTIVE',
      },
    });
    createdSupplierIds.push(supplier.id);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations')
      .set(authed(owner.accessToken))
      .send({ type: 'EXTERNAL_SUPPLIER', supplierId: supplier.id });
    expect(createRes.status).toBe(201);
    const conversationId = createRes.body.id;

    const listAsProdajniAgent = await request(app.getHttpServer())
      .get('/api/v1/chat/conversations')
      .set(authed(salesAgentNoAccess.accessToken));
    expect(listAsProdajniAgent.status).toBe(200);
    expect(listAsProdajniAgent.body.find((c: any) => c.id === conversationId)).toBeUndefined();

    // Direktan pokušaj slanja poruke — nevidljivo, ne 403 (§9.2/§9.4 princip).
    const attempt = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set(authed(salesAgentNoAccess.accessToken))
      .send({ body: 'ne bi trebalo da uspe' });
    expect(attempt.status).toBe(404);

    // Posle GRANT_ACCESS, razgovor postaje vidljiv.
    const grantRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/supplier-conversations/${conversationId}/access`)
      .set(authed(owner.accessToken))
      .send({ userId: salesAgentNoAccess.user.id });
    expect(grantRes.status).toBe(201);

    const listAfterGrant = await request(app.getHttpServer())
      .get('/api/v1/chat/conversations')
      .set(authed(salesAgentNoAccess.accessToken));
    expect(listAfterGrant.body.find((c: any) => c.id === conversationId)).toBeDefined();
  });

  // ==========================================================================
  it('§9.2/§10 — dobavljač sa dodeljenim portal nalogom vidi isključivo sopstveni EXTERNAL_SUPPLIER razgovor', async () => {
    const owner = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const supplier = await prisma.supplier.create({
      data: {
        name: `M19 Test Dobavljač 2 ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX2-${testRunId}`,
        registrationNumber: `REG2-${testRunId}`,
        country: 'Srbija',
        contactName: 'Ana',
        contactEmail: `dobavljac2-${testRunId}@primer.rs`,
        contactPhone: '060111111',
        status: 'ACTIVE',
      },
    });
    createdSupplierIds.push(supplier.id);
    const contact = await prisma.supplierContact.create({
      data: { supplierId: supplier.id, fullName: 'Ana Kontakt', email: `ana-kontakt-${testRunId}@primer.rs`, phone: '060222222', status: 'ACTIVE' },
    });

    const convoRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations')
      .set(authed(owner.accessToken))
      .send({ type: 'EXTERNAL_SUPPLIER', supplierId: supplier.id });
    const conversationId = convoRes.body.id;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/supplier-conversations/${conversationId}/invite-contact`)
      .set(authed(owner.accessToken))
      .send({ supplierContactId: contact.id });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.inviteToken).toEqual(expect.any(String));
    const contactUserId = inviteRes.body.user.id;
    createdUserIds.push(contactUserId);

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: contactUserId } });
    expect(dbUser.accountType).toBe('SUPPLIER_CONTACT');
    expect(dbUser.status).toBe('INVITED');

    const dbContact = await prisma.supplierContact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(dbContact.linkedUserId).toBe(contactUserId);

    const resetToken = await prisma.passwordResetToken.findFirst({ where: { userId: contactUserId } });
    expect(resetToken).not.toBeNull();

    // Kontakt aktivira nalog (isti tok kao M1 activateAccount preko AuthController), pa se
    // prijavljuje i proverava sopstvenu, isključivu vidljivost.
    const activateRes = await request(app.getHttpServer())
      .post('/api/v1/iam/auth/activate')
      .send({ token: inviteRes.body.inviteToken, newPassword: 'DovoljnoJakaLozinka123!' });
    expect(activateRes.status).toBe(201);
    const contactAccessToken = jwt.sign({ sub: contactUserId, sessionId: 'e2e-supplier-contact-session' });

    const listAsContact = await request(app.getHttpServer())
      .get('/api/v1/chat/conversations')
      .set(authed(contactAccessToken));
    expect(listAsContact.status).toBe(200);
    expect(listAsContact.body).toHaveLength(1);
    expect(listAsContact.body[0].id).toBe(conversationId);

    // Isti nalog ne sme da vidi bilo koji interni DIRECT/GROUP razgovor niti katalog dobavljača
    // (nema M2/M3 dozvola — proverava se posredno kroz odsustvo pristupa /suppliers).
    const suppliersAttempt = await request(app.getHttpServer())
      .get('/api/v1/contracting/suppliers')
      .set(authed(contactAccessToken));
    expect(suppliersAttempt.status).toBe(403);
  });

  // ==========================================================================
  it('§5/§10 — M18 CRITICAL upozorenje stiže i kao IN_APP poruka (pored Telegram/email)', async () => {
    const owner = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const marker = `m19-e2e-critical-${testRunId}`;

    await healthSignals.create({
      sourceModule: 'M19_TEST',
      signalType: 'PROVIDER_ERROR_SPIKE',
      severity: 'CRITICAL',
      details: { marker },
    });
    await wait(1500); // Event Bus (Postgres LISTEN/NOTIFY) je asinhron preko procesa.

    const notifConversations = await prisma.conversationParticipant.findMany({
      where: { userId: owner.user.id },
      select: { conversationId: true },
    });
    let found = false;
    for (const { conversationId } of notifConversations) {
      const msg = await prisma.message.findFirst({
        where: { conversationId, body: { contains: marker } },
      });
      if (msg) {
        found = true;
        expect(msg.body).toContain('CRITICAL');
        break;
      }
    }
    expect(found).toBe(true);
  });

  // ==========================================================================
  it('§9.5/§10 — AI nacrt nikad ne šalje poruku sam (draft-reply ne upisuje Message)', async () => {
    const owner = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const supplier = await prisma.supplier.create({
      data: {
        name: `M19 Test Dobavljač 3 ${testRunId}`,
        type: 'HOTEL',
        taxId: `TAX3-${testRunId}`,
        registrationNumber: `REG3-${testRunId}`,
        country: 'Srbija',
        contactName: 'Petar',
        contactEmail: `dobavljac3-${testRunId}@primer.rs`,
        contactPhone: '060333333',
        status: 'ACTIVE',
      },
    });
    createdSupplierIds.push(supplier.id);

    const convoRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations')
      .set(authed(owner.accessToken))
      .send({ type: 'EXTERNAL_SUPPLIER', supplierId: supplier.id });
    const conversationId = convoRes.body.id;

    const before = await prisma.message.count({ where: { conversationId } });
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/supplier-conversations/${conversationId}/draft-reply`)
      .set(authed(owner.accessToken))
      .send({});
    expect(draftRes.status).toBe(201);
    // Nema prepiske u razgovoru → draft je null uz napomenu (test okruženje najčešće nema ni
    // ANTHROPIC_API_KEY — u oba slučaja se ne sme upisati nijedna Message.
    const after = await prisma.message.count({ where: { conversationId } });
    expect(after).toBe(before);
  });

  // ==========================================================================
  it('§9.5/§10 — nijedna radnja u M5/M10 se ne pokreće automatski na osnovu chat poruke (nema pretplatnika na M19 evente u tim modulima)', async () => {
    // Statička provera koda (ne runtime) — dokumentovana ovde radi vidljivosti u test izveštaju:
    // grep kroz apps/api/src/modules/m5-rezervacije i m10-finansije ne nalazi nijedan
    // `eventListener.on('M19', ...)` poziv. Runtime dokaz "ništa se nije desilo" nije smislen bez
    // konkretnog efekta da se proveri — odsustvo pretplate je jače tvrđenje.
    const roots = ['src/modules/m5-rezervacije', 'src/modules/m10-finansije'];
    let matches = 0;
    for (const root of roots) {
      const abs = path.join(__dirname, '..', root);
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile() && entry.name.endsWith('.ts')) {
            const content = fs.readFileSync(full, 'utf-8');
            if (content.includes("eventListener.on('M19'") || content.includes('eventListener.on("M19"')) matches++;
          }
        }
      };
      walk(abs);
    }
    expect(matches).toBe(0);
  });
});
