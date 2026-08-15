import { Injectable } from '@nestjs/common';
import { ModelTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { HealthSignalsService } from '../health-signals/health-signals.service';
import { ModelTierResolverService } from './model-tier-resolver.service';
import { estimateCostEur, providerFromModelIdentifier } from './pricing';

export interface RecordInvocationParams {
  agentId: string;
  actionCode: string;
  requestedTier: ModelTier;
  securityCritical: boolean;
  modelIdentifier: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface RecordInvocationResult {
  tier: ModelTier;
  estimatedCostEur: number;
}

// M18 spec §6.3/§6.4/§6.5 — jedino mesto koje sme da upiše AgentInvocationLog. Deterministički
// kod (provere praga/datuma) NIKAD ne zove ovo — izlazni kriterijum §10 stavka 4 ("nijedna čisto
// deterministička provera ne troši pozive jezičkom modelu, proverljivo kroz odsustvo zapisa").
@Injectable()
export class AgentInvocationLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tierResolver: ModelTierResolverService,
    private readonly healthSignals: HealthSignalsService,
  ) {}

  async record(params: RecordInvocationParams): Promise<RecordInvocationResult> {
    const providerName = providerFromModelIdentifier(params.modelIdentifier);
    const resolved = await this.tierResolver.resolve({
      requestedTier: params.requestedTier,
      securityCritical: params.securityCritical,
      agentId: params.agentId,
      providerName,
    });

    const costEur = estimateCostEur(params.modelIdentifier, params.inputTokens, params.outputTokens);

    await this.prisma.agentInvocationLog.create({
      data: {
        agentId: params.agentId,
        actionCode: params.actionCode,
        modelTier: resolved.tier,
        modelIdentifier: params.modelIdentifier,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        estimatedCostEur: costEur,
        latencyMs: params.latencyMs,
      },
    });

    const totalTokens = params.inputTokens + params.outputTokens;
    await this.applyProviderQuotaConsumption(providerName, totalTokens, costEur);
    await this.applyAgentBudgetConsumption(params.agentId, costEur);

    if (resolved.degradedButExempt) {
      await this.healthSignals.create({
        sourceModule: 'M18',
        signalType: 'TOKEN_USAGE_ANOMALY',
        severity: 'CRITICAL',
        details: {
          reason: 'security_critical_action_breached_degraded_budget',
          agentId: params.agentId,
          actionCode: params.actionCode,
          providerName,
        },
      });
    }

    return { tier: resolved.tier, estimatedCostEur: costEur };
  }

  private async applyProviderQuotaConsumption(providerName: string, tokens: number, costEur: number): Promise<void> {
    const now = new Date();
    const rows = await this.prisma.aIProviderQuota.findMany({ where: { providerName, periodStart: { lte: now }, periodEnd: { gt: now } } });

    for (const row of rows) {
      const newConsumed = row.consumed + tokens;
      const newConsumedEur = Number(row.consumedEur) + costEur;

      const data: { consumed: number; consumedEur: number; enforcementState?: 'DEGRADED'; degradedAt?: Date } = {
        consumed: newConsumed,
        consumedEur: newConsumedEur,
      };
      if (row.enforcementState === 'NORMAL' && row.budgetLimitEur != null && newConsumedEur >= Number(row.budgetLimitEur)) {
        data.enforcementState = 'DEGRADED';
        data.degradedAt = now;
      }
      await this.prisma.aIProviderQuota.update({ where: { id: row.id }, data });

      if (row.quotaLimit != null) {
        const prevPercent = (row.consumed / row.quotaLimit) * 100;
        const newPercent = (newConsumed / row.quotaLimit) * 100;
        if (prevPercent < row.alertThresholdPercentage && newPercent >= row.alertThresholdPercentage) {
          await this.healthSignals.create({
            sourceModule: 'M18',
            signalType: 'TOKEN_USAGE_ANOMALY',
            severity: 'WARNING',
            details: { reason: 'provider_quota_threshold', providerName, period: row.period, consumed: newConsumed, quotaLimit: row.quotaLimit },
          });
        }
      }
    }
  }

  private async applyAgentBudgetConsumption(agentId: string, costEur: number): Promise<void> {
    const now = new Date();
    const rows = await this.prisma.aIAgentBudget.findMany({ where: { agentId, periodStart: { lte: now }, periodEnd: { gt: now } } });

    for (const row of rows) {
      const newConsumedEur = Number(row.consumedEur) + costEur;
      const data: { consumedEur: number; enforcementState?: 'DEGRADED' } = { consumedEur: newConsumedEur };
      if (row.enforcementState === 'NORMAL' && newConsumedEur >= Number(row.budgetLimitEur)) {
        data.enforcementState = 'DEGRADED';
      }
      await this.prisma.aIAgentBudget.update({ where: { id: row.id }, data });
    }
  }

  async findAll(filter: { agentId?: string }) {
    return this.prisma.agentInvocationLog.findMany({ where: { agentId: filter.agentId }, orderBy: { timestamp: 'desc' } });
  }
}
