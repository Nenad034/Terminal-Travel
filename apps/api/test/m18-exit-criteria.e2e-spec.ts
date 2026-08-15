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
import { HealthSignalsService } from '../src/modules/m18-operativni-nadzor/health-signals/health-signals.service';
import { HealthDetectorsService } from '../src/modules/m18-operativni-nadzor/detectors/health-detectors.service';
import { ProviderHealthService } from '../src/modules/m18-operativni-nadzor/provider-health/provider-health.service';
import { WeeklyReviewsService } from '../src/modules/m18-operativni-nadzor/weekly-reviews/weekly-reviews.service';
import { AgentInvocationLogService } from '../src/modules/m18-operativni-nadzor/agent-invocations/agent-invocation-log.service';
import { AiProviderQuotaService } from '../src/modules/m18-operativni-nadzor/ai-provider-quota/ai-provider-quota.service';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M18 izlaznog kriterijuma
 * (docs/moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md poglavlje 10).
 */
describe('M18 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let eventBus: EventBusService;
  let healthSignals: HealthSignalsService;
  let healthDetectors: HealthDetectorsService;
  let providerHealth: ProviderHealthService;
  let weeklyReviews: WeeklyReviewsService;
  let agentInvocationLog: AgentInvocationLogService;
  let aiProviderQuota: AiProviderQuotaService;

  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdAiAgentIds: string[] = [];
  const createdProviderCodes: string[] = [];

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
    eventBus = app.get(EventBusService);
    healthSignals = app.get(HealthSignalsService);
    healthDetectors = app.get(HealthDetectorsService);
    providerHealth = app.get(ProviderHealthService);
    weeklyReviews = app.get(WeeklyReviewsService);
    agentInvocationLog = app.get(AgentInvocationLogService);
    aiProviderQuota = app.get(AiProviderQuotaService);
  });

  afterAll(async () => {
    await prisma.agentInvocationLog.deleteMany({ where: { agentId: { in: createdAiAgentIds } } });
    await prisma.aIAgentBudget.deleteMany({ where: { agentId: { in: createdAiAgentIds } } });
    if (createdAiAgentIds.length) await prisma.aIAgent.deleteMany({ where: { id: { in: createdAiAgentIds } } });
    if (createdProviderCodes.length) {
      await prisma.providerHealthSnapshot.deleteMany({ where: { providerCode: { in: createdProviderCodes } } });
      await prisma.providerCallLog.deleteMany({ where: { providerCode: { in: createdProviderCodes } } });
      await prisma.providerConfig.deleteMany({ where: { providerCode: { in: createdProviderCodes } } });
    }
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m18-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M18 Test Korisnik',
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

  async function createAiAgent() {
    const user = await prisma.user.create({
      data: {
        email: `m18-agent-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M18 Test Agent',
        accountType: 'AI_AGENT',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const agent = await prisma.aIAgent.create({
      data: { userId: user.id, agentRole: 'DOMENSKI_AGENT', moduleCode: 'M18_TEST', status: 'ACTIVE', modelTier: 'LIGHT', modelIdentifier: 'claude-haiku-4-5-20251001' },
    });
    createdAiAgentIds.push(agent.id);
    return agent;
  }

  function authed(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  // ==========================================================================
  it('§2.2/§10 — WARNING/CRITICAL HealthSignal odmah prolazi kroz dispatch (notified_at popunjeno)', async () => {
    const signal = await healthSignals.create({
      sourceModule: 'M18',
      signalType: 'TOKEN_USAGE_ANOMALY',
      severity: 'WARNING',
      details: { test: true },
    });
    expect(signal.notifiedAt).not.toBeNull();
  });

  it('§10 — INFO signal ne pokreće dispatch (notified_at ostaje null)', async () => {
    const signal = await healthSignals.create({
      sourceModule: 'M18',
      signalType: 'TOKEN_USAGE_ANOMALY',
      severity: 'INFO',
      details: { test: true },
    });
    expect(signal.notifiedAt).toBeNull();
  });

  // ==========================================================================
  it('§10 — WeeklyHealthReview se generiše i šalje čak i bez signala u periodu', async () => {
    const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const res = await request(app.getHttpServer()).post('/api/v1/ops/weekly-reviews/run').set(authed(accessToken)).send();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SENT');
    expect(res.body.summary).toEqual(expect.any(String));
  });

  // ==========================================================================
  it('§10 — TrendSuggestion.approve() postavlja approved_by; ne dozvoljava dupli approve', async () => {
    const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/ops/trend-suggestions')
      .set(authed(accessToken))
      .send({ category: 'TEHNOLOGIJA', summary: 'test nalaz', suggestedAction: 'test akcija' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('DRAFT');
    expect(createRes.body.approvedBy).toBeNull();

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/ops/trend-suggestions/${createRes.body.id}/approve`)
      .set(authed(accessToken))
      .send();
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe('APPROVED');
    expect(approveRes.body.approvedBy).not.toBeNull();

    const secondApprove = await request(app.getHttpServer())
      .post(`/api/v1/ops/trend-suggestions/${createRes.body.id}/approve`)
      .set(authed(accessToken))
      .send();
    expect(secondApprove.status).toBe(400);
  });

  // ==========================================================================
  it('§2.4/§10 — AUTH_ANOMALY signal ima security_category=AUTH', async () => {
    const { user } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    for (let i = 0; i < 6; i++) {
      await prisma.auditLogEntry.create({
        data: { actorType: 'HUMAN', actorId: user.id, module: 'M1', action: 'auth.login_failed', resourceType: 'User', resourceId: user.id, context: {} },
      });
    }

    await healthDetectors.checkAuthAnomalies();

    const signal = await prisma.healthSignal.findFirst({
      where: { signalType: 'AUTH_ANOMALY', sourceModule: 'M1' },
      orderBy: { detectedAt: 'desc' },
    });
    expect(signal).not.toBeNull();
    expect(signal!.securityCategory).toBe('AUTH');
  });

  // ==========================================================================
  it('§2.3/§10 — provajder čiji uptime pređe prag prelazi u UNSTABLE i generiše PROVIDER_DEGRADED', async () => {
    const providerCode = `M18_TEST_PROVIDER_${testRunId}`;
    createdProviderCodes.push(providerCode);
    await prisma.providerConfig.create({
      data: {
        providerCode,
        displayName: 'M18 Test Provajder',
        category: 'HOTEL',
        authConfigEncrypted: 'irrelevant',
        authStrategy: 'API_KEY',
        status: 'ACTIVE',
        timeoutSearchMs: 5000,
        timeoutBookingMs: 5000,
      },
    });

    // 8 grešaka od 10 poziva → uptime 20%, ispod OFFLINE_UPTIME_BELOW (50%).
    for (let i = 0; i < 10; i++) {
      await prisma.providerCallLog.create({
        data: {
          providerCode,
          operation: 'SEARCH',
          requestSummary: {},
          responseStatus: i < 8 ? 'ERROR' : 'OK',
          errorCode: i < 8 ? 'TIMEOUT' : null,
          latencyMs: 500,
        },
      });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const snapshot = await providerHealth.computeForProvider(providerCode, since);
    expect(snapshot!.status).toBe('OFFLINE');

    const signal = await prisma.healthSignal.findFirst({
      where: { signalType: 'PROVIDER_DEGRADED', sourceModule: 'M4' },
      orderBy: { detectedAt: 'desc' },
    });
    expect(signal).not.toBeNull();
    expect((signal!.details as any).providerCode).toBe(providerCode);
  });

  // ==========================================================================
  it('§6.5/§10 — budžet degradacija forsira LIGHT za ne-bezbednosnu akciju; sledeći bezbednosno-kritičan poziv zadržava HEAVY i generiše povišen signal', async () => {
    const agent = await createAiAgent();
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

    await prisma.aIAgentBudget.create({
      data: { agentId: agent.id, period: 'DAILY', budgetLimitEur: 0.000001, consumedEur: 0, enforcementState: 'NORMAL', periodStart, periodEnd },
    });

    // Prvi poziv potroši sitan iznos i odmah probije budžet (limit je namerno mikroskopski).
    const first = await agentInvocationLog.record({
      agentId: agent.id,
      actionCode: 'm18_test.action',
      requestedTier: 'LIGHT',
      securityCritical: false,
      modelIdentifier: 'claude-haiku-4-5-20251001',
      inputTokens: 1000,
      outputTokens: 500,
      latencyMs: 100,
    });
    expect(first.tier).toBe('LIGHT');

    const budgetAfterFirst = await prisma.aIAgentBudget.findFirst({ where: { agentId: agent.id } });
    expect(budgetAfterFirst!.enforcementState).toBe('DEGRADED');

    // Drugi poziv (ne-bezbednosni, tražio STANDARD) — mora biti prisilno LIGHT.
    const second = await agentInvocationLog.record({
      agentId: agent.id,
      actionCode: 'm18_test.action',
      requestedTier: 'STANDARD',
      securityCritical: false,
      modelIdentifier: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 50,
    });
    expect(second.tier).toBe('LIGHT');

    // Treći poziv (bezbednosno-kritičan) — zadržava HEAVY uprkos DEGRADED, generiše povišen signal.
    const third = await agentInvocationLog.record({
      agentId: agent.id,
      actionCode: 'm18_test.security_action',
      requestedTier: 'LIGHT',
      securityCritical: true,
      modelIdentifier: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 50,
    });
    expect(third.tier).toBe('HEAVY');

    const exemptSignal = await prisma.healthSignal.findFirst({
      where: { signalType: 'TOKEN_USAGE_ANOMALY', sourceModule: 'M18', severity: 'CRITICAL' },
      orderBy: { detectedAt: 'desc' },
    });
    expect(exemptSignal).not.toBeNull();
    expect((exemptSignal!.details as any).agentId).toBe(agent.id);
  });

  // ==========================================================================
  it('§9/§10 — ručan override piše AuditLogEntry i vraća enforcement_state na NORMAL', async () => {
    const { user, accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
    const quota = await aiProviderQuota.create({ providerName: `M18_TEST_${testRunId}`, period: 'DAILY', budgetLimitEur: 1 });
    await prisma.aIProviderQuota.update({ where: { id: quota.id }, data: { enforcementState: 'DEGRADED', degradedAt: new Date() } });

    const res = await request(app.getHttpServer()).post(`/api/v1/ops/ai-provider-quota/${quota.id}/override`).set(authed(accessToken)).send();
    expect(res.status).toBe(201);
    expect(res.body.enforcementState).toBe('NORMAL');

    const auditEntry = await prisma.auditLogEntry.findFirst({
      where: { module: 'M18', action: 'ai_provider_quota.override', resourceId: quota.id },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry!.actorId).toBe(user.id);
  });

  // ==========================================================================
  it('§10 — period rollover vraća fresh red u NORMAL stanju za naredni period', async () => {
    const providerName = `M18_ROLLOVER_TEST_${testRunId}`;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);
    await prisma.aIProviderQuota.create({
      data: {
        providerName,
        period: 'DAILY',
        budgetLimitEur: 5,
        consumedEur: 5,
        enforcementState: 'DEGRADED',
        degradedAt: yesterday,
        periodStart: dayBefore,
        periodEnd: yesterday,
      },
    });

    await aiProviderQuota.rolloverPeriods();

    const rows = await prisma.aIProviderQuota.findMany({ where: { providerName }, orderBy: { periodStart: 'desc' } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const newest = rows[0];
    expect(newest.enforcementState).toBe('NORMAL');
    expect(Number(newest.consumedEur)).toBe(0);
  });

  // ==========================================================================
  it('§10 — deterministički detektori ne upisuju AgentInvocationLog (nema poziva jezičkom modelu)', async () => {
    const before = await prisma.agentInvocationLog.count();
    await healthDetectors.runDailyChecks();
    const after = await prisma.agentInvocationLog.count();
    expect(after).toBe(before);
  });

  // ==========================================================================
  it('§2.1/§10 — M3 low_capacity_critical, M10 payment_deadline_missed i M10 reconciliation_mismatch event odmah generišu HealthSignal preko pretplate', async () => {
    const marker = `e2e-${testRunId}`;
    await eventBus.emit('M3', 'low_capacity_critical', { periodId: marker, remaining: 1, severity: 'CRITICAL' });
    await eventBus.emit('M10', 'payment_deadline_missed', { bookingId: marker, kind: 'DEPOSIT', severity: 'WARNING' });
    await eventBus.emit('M10', 'reconciliation_mismatch', { bookingId: marker, reason: 'MISSING_FISCAL_DOCUMENT' });
    await wait(500);

    const lowCapacity = await prisma.healthSignal.findFirst({ where: { signalType: 'LOW_CAPACITY_CRITICAL' }, orderBy: { detectedAt: 'desc' } });
    expect(lowCapacity).not.toBeNull();
    expect((lowCapacity!.details as any).periodId).toBe(marker);

    const paymentDeadline = await prisma.healthSignal.findFirst({ where: { signalType: 'PAYMENT_DEADLINE_MISSED' }, orderBy: { detectedAt: 'desc' } });
    expect(paymentDeadline).not.toBeNull();
    expect((paymentDeadline!.details as any).bookingId).toBe(marker);

    const reconciliation = await prisma.healthSignal.findFirst({ where: { signalType: 'RECONCILIATION_MISMATCH' }, orderBy: { detectedAt: 'desc' } });
    expect(reconciliation).not.toBeNull();
    expect((reconciliation!.details as any).bookingId).toBe(marker);
  });
});
