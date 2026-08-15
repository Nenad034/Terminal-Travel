import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { periodBounds } from '../agent-invocations/period-bucket';
import { CreateAiAgentBudgetDto } from './dto/create-ai-agent-budget.dto';
import { UpdateAiAgentBudgetDto } from './dto/update-ai-agent-budget.dto';

// M18 spec §6.5/§9 — budžet po pojedinačnom agentu, isti mehanizam kao AIProviderQuota ali
// nezavisan (jedan agent u petlji prelazi u sopstveni DEGRADED bez čekanja globalni budžet).
@Injectable()
export class AiAgentBudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: { agentId?: string }) {
    return this.prisma.aIAgentBudget.findMany({ where: { agentId: filter.agentId }, orderBy: { periodStart: 'desc' } });
  }

  async create(dto: CreateAiAgentBudgetDto) {
    const { start, end } = periodBounds(dto.period);
    return this.prisma.aIAgentBudget.create({
      data: { agentId: dto.agentId, period: dto.period, budgetLimitEur: dto.budgetLimitEur, periodStart: start, periodEnd: end },
    });
  }

  async update(id: string, dto: UpdateAiAgentBudgetDto) {
    const existing = await this.prisma.aIAgentBudget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`AIAgentBudget ${id} nije pronađen.`);
    return this.prisma.aIAgentBudget.update({ where: { id }, data: dto });
  }

  // §6.5 — isti "nov red za nov period" princip kao AiProviderQuotaService.rolloverPeriods.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rolloverPeriods(): Promise<void> {
    const buckets = await this.prisma.aIAgentBudget.groupBy({ by: ['agentId', 'period'] });

    for (const bucket of buckets) {
      const latest = await this.prisma.aIAgentBudget.findFirst({
        where: { agentId: bucket.agentId, period: bucket.period },
        orderBy: { periodStart: 'desc' },
      });
      if (!latest) continue;

      const now = new Date();
      if (now < latest.periodEnd) continue;

      const { start, end } = periodBounds(latest.period, now);
      const alreadyRolled = await this.prisma.aIAgentBudget.findUnique({
        where: { agentId_period_periodStart: { agentId: latest.agentId, period: latest.period, periodStart: start } },
      });
      if (alreadyRolled) continue;

      await this.prisma.aIAgentBudget.create({
        data: { agentId: latest.agentId, period: latest.period, budgetLimitEur: latest.budgetLimitEur, periodStart: start, periodEnd: end },
      });
    }
  }
}
