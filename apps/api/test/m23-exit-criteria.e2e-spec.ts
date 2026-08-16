import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { KnowledgeRefreshService } from '../src/modules/m23-znanje/refresh-scheduler/knowledge-refresh.service';

/**
 * E2E protiv prave Postgres baze — pokriva REST-testabilne stavke M23 izlaznog kriterijuma
 * (docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md poglavlje 9). Isti obrazac kao
 * m21/m22-exit-criteria.e2e-spec.ts.
 */
describe('M23 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let refreshService: KnowledgeRefreshService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdArticleIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdImportIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    refreshService = app.get(KnowledgeRefreshService);
  });

  afterAll(async () => {
    if (createdImportIds.length) {
      await prisma.productContentImportField.deleteMany({ where: { importId: { in: createdImportIds } } });
      await prisma.productContentImport.deleteMany({ where: { id: { in: createdImportIds } } });
    }
    if (createdProductIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdArticleIds.length) {
      await prisma.question.deleteMany({ where: { matchedArticleIds: { hasSome: createdArticleIds } } });
      await prisma.articleRevision.deleteMany({ where: { articleId: { in: createdArticleIds } } });
      await prisma.articleSource.deleteMany({ where: { articleId: { in: createdArticleIds } } });
      await prisma.articleTranslation.deleteMany({ where: { articleId: { in: createdArticleIds } } });
      await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
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
        email: `m23-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: `M23 Test ${roleName}`,
        accountType: roleName === SYSTEM_ROLES.SUBAGENT_ADMIN ? 'SUBAGENT_CONTACT' : 'STAFF',
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

  async function getAiAgentUserId(): Promise<string> {
    const agent = await prisma.aIAgent.findFirstOrThrow({ where: { agentRole: 'KNOWLEDGE_AGENT' } });
    return agent.userId;
  }

  // ==========================================================================
  it('§3.1/§9 — interni tim (Sales Manager) i SUBAGENT_ADMIN vide istu, punu listu PUBLISHED članaka', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const salesManager = await createUser(SYSTEM_ROLES.SALES_MANAGER);
    const subagentAdmin = await createUser(SYSTEM_ROLES.SUBAGENT_ADMIN);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({
        subjectType: 'DESTINATION',
        destinationCountry: `Testland-${testRunId}`,
        destinationCity: 'Test City',
        translations: [{ languageCode: 'sr', title: `Test destinacija ${testRunId}`, body: 'Opis destinacije za test.' }],
      });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    const publishRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/publish`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(publishRes.status).toBe(201);
    expect(publishRes.body.shareToken).toBeDefined();

    const listSales = await request(app.getHttpServer()).get('/api/v1/knowledge/articles').set(authed(salesManager.accessToken));
    const listSubagent = await request(app.getHttpServer()).get('/api/v1/knowledge/articles').set(authed(subagentAdmin.accessToken));
    expect(listSales.status).toBe(200);
    expect(listSubagent.status).toBe(200);

    const salesIds = listSales.body.map((a: any) => a.id).sort();
    const subagentIds = listSubagent.body.map((a: any) => a.id).sort();
    expect(salesIds).toEqual(subagentIds);
    expect(salesIds).toContain(articleId);
  });

  // ==========================================================================
  it('§5/§9 — javna stranica /public/:share_token vraća tačno jedan objavljen članak, bez autentikacije', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({
        subjectType: 'COUNTRY',
        destinationCountry: `PublicLand-${testRunId}`,
        translations: [{ languageCode: 'sr', title: 'Javni članak', body: 'Sadržaj javnog članka.' }],
      });
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    const publishRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/publish`)
      .set(authed(vlasnik.accessToken))
      .send({});
    const shareToken = publishRes.body.shareToken;

    // Bez Authorization header-a — javna, neautentifikovana ruta.
    const publicRes = await request(app.getHttpServer()).get(`/api/v1/knowledge/public/${shareToken}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.id).toBe(articleId);
    expect(publicRes.body.translation.title).toBe('Javni članak');

    const notFoundRes = await request(app.getHttpServer()).get('/api/v1/knowledge/public/nepostojeci-token');
    expect(notFoundRes.status).toBe(404);
  });

  // ==========================================================================
  it('§9 — ArticleSource.sourceType odbija vrednost van dozvoljena tri tipa', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({ subjectType: 'COUNTRY', destinationCountry: `EnumTest-${testRunId}` });
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    const badSourceRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/sources`)
      .set(authed(vlasnik.accessToken))
      .send({ url: 'https://tripadvisor.example.com/hotel', sourceType: 'REVIEW_SITE' });
    expect(badSourceRes.status).toBe(400);

    const goodSourceRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/sources`)
      .set(authed(vlasnik.accessToken))
      .send({ url: 'https://tourism-board.example.gov', sourceType: 'GOVERNMENT_OR_TOURISM_BOARD' });
    expect(goodSourceRes.status).toBe(201);
  });

  // ==========================================================================
  it('§4b/§9 — revizija se ne može odobriti dok referenciran izvor nije APPROVED; AI_AGENT ne sme odobriti ni izvor ni reviziju ni publish', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);
    const aiAgentUserId = await getAiAgentUserId();
    const aiAgentToken = jwt.sign({ sub: aiAgentUserId, sessionId: 'e2e-ai-agent-session' });

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({
        subjectType: 'DESTINATION',
        destinationCountry: `RevisionLand-${testRunId}`,
        destinationCity: 'City',
        research: {
          sourceUrl: 'https://tourism-board.example.gov/city',
          sourceType: 'GOVERNMENT_OR_TOURISM_BOARD',
          rawText: 'Grad je poznat po starom gradskom jezgru i muzejima. Idealan za jednodnevni izlet.',
        },
      });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    const sources = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/articles/${articleId}/sources`)
      .set(authed(vlasnik.accessToken));
    expect(sources.body.length).toBe(1);
    const sourceId = sources.body[0].id;

    const revisions = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/articles/${articleId}/revisions`)
      .set(authed(vlasnik.accessToken));
    expect(revisions.body.length).toBe(1);
    const revisionId = revisions.body[0].id;

    // Pokušaj odobrenja pre nego što je izvor odobren — mora pasti.
    const earlyApprove = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/revisions/${revisionId}/approve`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(earlyApprove.status).toBe(400);

    // AI_AGENT ne sme odobriti izvor.
    const aiApproveSource = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/sources/${sourceId}/approve`)
      .set(authed(aiAgentToken))
      .send({});
    expect([401, 403]).toContain(aiApproveSource.status);

    // Čovek odobrava izvor.
    const approveSource = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/sources/${sourceId}/approve`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(approveSource.status).toBe(201);
    expect(approveSource.body.status).toBe('APPROVED');

    // AI_AGENT ne sme odobriti reviziju.
    const aiApproveRevision = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/revisions/${revisionId}/approve`)
      .set(authed(aiAgentToken))
      .send({});
    expect([401, 403]).toContain(aiApproveRevision.status);

    // Čovek odobrava reviziju — translations se upisuju, next_refresh_due_at se postavlja.
    const approveRevision = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/revisions/${revisionId}/approve`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(approveRevision.status).toBe(201);

    const articleAfter = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    expect(articleAfter.lastRefreshedAt).not.toBeNull();
    expect(articleAfter.nextRefreshDueAt).not.toBeNull();
    const daysDiff = Math.round((articleAfter.nextRefreshDueAt!.getTime() - articleAfter.lastRefreshedAt!.getTime()) / (24 * 60 * 60 * 1000));
    expect(daysDiff).toBe(30);

    // AI_AGENT ne sme objaviti članak.
    const aiPublish = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/articles/${articleId}/publish`)
      .set(authed(aiAgentToken))
      .send({});
    expect([401, 403]).toContain(aiPublish.status);
  });

  // ==========================================================================
  it('§4d/§9 — istraživanje za subject_type=PRODUCT kreira M2 ProductContentImport(origin=M23_RESEARCH) sa sourceArticleRevisionId', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const product = await prisma.product.create({
      data: {
        type: 'ACCOMMODATION',
        sourceType: 'CONTRACTED',
        status: 'DRAFT',
        cacheStatus: 'N_A',
        destinationCountry: 'Test',
        destinationCity: 'Test',
        createdBy: vlasnik.user.id,
      },
    });
    createdProductIds.push(product.id);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({
        subjectType: 'PRODUCT',
        productId: product.id,
        research: {
          sourceUrl: 'https://hotel-example.com',
          sourceType: 'HOTEL_OFFICIAL_WEBSITE',
          rawText: 'Naš hotel nudi besplatan Wi-Fi, bazen i parking. Doručak je uključen u cenu.',
        },
      });
    expect(createRes.status).toBe(201);
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    const revisions = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/articles/${articleId}/revisions`)
      .set(authed(vlasnik.accessToken));
    const revisionId = revisions.body[0].id;

    const importRecord = await prisma.productContentImport.findFirstOrThrow({ where: { productId: product.id, origin: 'M23_RESEARCH' } });
    createdImportIds.push(importRecord.id);
    expect(importRecord.status).toBe('EXTRACTED');

    const fields = await prisma.productContentImportField.findMany({ where: { importId: importRecord.id } });
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.sourceArticleRevisionId).toBe(revisionId);
    }
    expect(fields.some((f) => f.fieldType === 'DESCRIPTION')).toBe(true);
  });

  // ==========================================================================
  it('§4c/§9 — dospeo rok osvežavanja generiše PENDING_REVIEW reviziju bez ijedne izmene na živom, objavljenom sadržaju', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/articles')
      .set(authed(vlasnik.accessToken))
      .send({
        subjectType: 'COUNTRY',
        destinationCountry: `RefreshLand-${testRunId}`,
        translations: [{ languageCode: 'sr', title: 'Pre osvežavanja', body: 'Star sadržaj.' }],
      });
    const articleId = createRes.body.id;
    createdArticleIds.push(articleId);

    await request(app.getHttpServer()).post(`/api/v1/knowledge/articles/${articleId}/publish`).set(authed(vlasnik.accessToken)).send({});

    // Ručno postavi dospeo rok (simulira 30+ dana od objave).
    await prisma.article.update({ where: { id: articleId }, data: { nextRefreshDueAt: new Date('2000-01-01') } });

    await refreshService.runDueRefreshes();

    const revisions = await prisma.articleRevision.findMany({ where: { articleId, trigger: 'SCHEDULED_REFRESH' } });
    expect(revisions.length).toBe(1);
    expect(revisions[0].status).toBe('PENDING_REVIEW');

    // Objavljen sadržaj ostaje netaknut dok revizija čeka.
    const translation = await prisma.articleTranslation.findFirst({ where: { articleId, languageCode: 'sr' } });
    expect(translation!.title).toBe('Pre osvežavanja');

    const articleAfter = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    expect(articleAfter.nextRefreshDueAt?.toISOString()).toBe(new Date('2000-01-01').toISOString());
  });

  // ==========================================================================
  it('§3.2/§9 — POST /ask odgovara isključivo iz PUBLISHED sadržaja; confidence=NONE nudi istraživanje; audit log upisan', async () => {
    const vlasnik = await createUser(SYSTEM_ROLES.VLASNIK);

    const askRes = await request(app.getHttpServer())
      .post('/api/v1/knowledge/ask')
      .set(authed(vlasnik.accessToken))
      .send({ question: `Nepostojeća tema koja sigurno nema članak ${testRunId} xyzzyqwerty` });
    expect(askRes.status).toBe(201);
    expect(askRes.body.confidence).toBe('NONE');
    expect(askRes.body.offerResearch).toBe(true);

    const auditEntry = await prisma.auditLogEntry.findFirst({
      where: { module: 'M23', action: 'knowledge_question.answer', resourceId: askRes.body.id },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry!.actorType).toBe('AI_AGENT');

    const requestResearchRes = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/questions/${askRes.body.id}/request-research`)
      .set(authed(vlasnik.accessToken))
      .send({});
    expect(requestResearchRes.status).toBe(201);
  });
});
