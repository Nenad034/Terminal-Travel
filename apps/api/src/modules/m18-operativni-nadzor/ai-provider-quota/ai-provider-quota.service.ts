import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { periodBounds } from '../agent-invocations/period-bucket';
import { CreateAiProviderQuotaDto } from './dto/create-ai-provider-quota.dto';
import { UpdateAiProviderQuotaDto } from './dto/update-ai-provider-quota.dto';

// M18 spec §6.4/§6.5/§9 — konfiguracija i ručni override kvota po AI provajderu.
@Injectable()
export class AiProviderQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.aIProviderQuota.findMany({ orderBy: [{ providerName: 'asc' }, { periodStart: 'desc' }] });
  }

  async create(dto: CreateAiProviderQuotaDto) {
    const { start, end } = periodBounds(dto.period);
    return this.prisma.aIProviderQuota.create({
      data: {
        providerName: dto.providerName,
        period: dto.period,
        quotaLimit: dto.quotaLimit,
        budgetLimitEur: dto.budgetLimitEur,
        alertThresholdPercentage: dto.alertThresholdPercentage ?? 80,
        periodStart: start,
        periodEnd: end,
      },
    });
  }

  async update(id: string, dto: UpdateAiProviderQuotaDto) {
    const existing = await this.prisma.aIProviderQuota.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`AIProviderQuota ${id} nije pronađen.`);
    return this.prisma.aIProviderQuota.update({ where: { id }, data: dto });
  }

  // §9 — "ručan povratak iz DEGRADED u NORMAL pre isteka perioda, zahteva OVERRIDE dozvolu",
  // §10 izlazni kriterijum — "ostavlja trag u AuditLogEntry".
  async override(id: string, actorId: string) {
    const existing = await this.prisma.aIProviderQuota.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`AIProviderQuota ${id} nije pronađen.`);

    const updated = await this.prisma.aIProviderQuota.update({
      where: { id },
      data: { enforcementState: 'NORMAL', degradedAt: null },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M18',
      action: 'ai_provider_quota.override',
      resourceType: 'AIProviderQuota',
      resourceId: id,
      beforeState: existing,
      afterState: updated,
      context: {},
    });

    return updated;
  }

  // §6.5 — "enforcement_state se automatski vraća na NORMAL na period_start narednog perioda".
  // Sprovedeno kao nov red za novi period (istorija prethodnog perioda ostaje netaknuta za
  // izveštavanje), preuzima limite od poslednjeg reda za taj provider+period da vlasnik ne mora
  // da ih iznova unosi svaki period.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async rolloverPeriods(): Promise<void> {
    const latestPerBucket = await this.prisma.aIProviderQuota.groupBy({
      by: ['providerName', 'period'],
    });

    for (const bucket of latestPerBucket) {
      const latest = await this.prisma.aIProviderQuota.findFirst({
        where: { providerName: bucket.providerName, period: bucket.period },
        orderBy: { periodStart: 'desc' },
      });
      if (!latest) continue;

      const now = new Date();
      if (now < latest.periodEnd) continue; // period još traje

      const { start, end } = periodBounds(latest.period, now);
      const alreadyRolled = await this.prisma.aIProviderQuota.findUnique({
        where: { providerName_period_periodStart: { providerName: latest.providerName, period: latest.period, periodStart: start } },
      });
      if (alreadyRolled) continue;

      await this.prisma.aIProviderQuota.create({
        data: {
          providerName: latest.providerName,
          period: latest.period,
          quotaLimit: latest.quotaLimit,
          budgetLimitEur: latest.budgetLimitEur,
          alertThresholdPercentage: latest.alertThresholdPercentage,
          periodStart: start,
          periodEnd: end,
        },
      });
    }
  }
}
