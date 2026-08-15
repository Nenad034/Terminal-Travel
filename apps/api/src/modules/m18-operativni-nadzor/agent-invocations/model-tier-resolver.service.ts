import { Injectable } from '@nestjs/common';
import { ModelTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ResolveTierParams {
  requestedTier: ModelTier;
  securityCritical: boolean;
  agentId: string;
  providerName: string;
}

export interface ResolvedTier {
  tier: ModelTier;
  /** true kad je akcija bezbednosno-kritična i ZADRŽALA svoj nivo uprkos DEGRADED stanju (§6.5 izuzetak). */
  degradedButExempt: boolean;
}

// M18 spec §6.2a/§6.5 — bira stvaran model_tier za jedan poziv. Dva nezavisna kriterijuma,
// "kad se rezultati razlikuju, primenjuje se jači (skuplji) od ta dva":
// 1) §6.2a — bezbednosno-kritična akcija nikad ispod STANDARD, po difoltu HEAVY.
// 2) §6.5 — ako je provajder ILI agent u DEGRADED stanju (budžet dostignut), poziv se prisilno
//    izvršava na LIGHT — OSIM ako je akcija bezbednosno-kritična (izuzetak, §6.5).
@Injectable()
export class ModelTierResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(params: ResolveTierParams): Promise<ResolvedTier> {
    const securityFloorTier = this.applySecurityFloor(params.requestedTier, params.securityCritical);
    const degraded = await this.isDegraded(params.agentId, params.providerName);

    if (!degraded) {
      return { tier: securityFloorTier, degradedButExempt: false };
    }
    if (params.securityCritical) {
      return { tier: securityFloorTier, degradedButExempt: true };
    }
    return { tier: 'LIGHT', degradedButExempt: false };
  }

  /** §6.2a — floor na STANDARD, difolt HEAVY kad pozivalac nije tražio ništa jače od LIGHT. */
  private applySecurityFloor(requestedTier: ModelTier, securityCritical: boolean): ModelTier {
    if (!securityCritical) return requestedTier;
    return requestedTier === 'LIGHT' ? 'HEAVY' : requestedTier;
  }

  private async isDegraded(agentId: string, providerName: string): Promise<boolean> {
    const now = new Date();

    const [agentBudgets, providerQuotas] = await Promise.all([
      this.prisma.aIAgentBudget.findMany({ where: { agentId, periodStart: { lte: now }, periodEnd: { gt: now } } }),
      this.prisma.aIProviderQuota.findMany({ where: { providerName, periodStart: { lte: now }, periodEnd: { gt: now } } }),
    ]);

    return agentBudgets.some((b) => b.enforcementState === 'DEGRADED') || providerQuotas.some((q) => q.enforcementState === 'DEGRADED');
  }
}
