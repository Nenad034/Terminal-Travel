import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionVolumeTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommissionAuthorityService } from './commission-authority.service';
import { CreateVolumeTierDto } from './dto/create-volume-tier.dto';
import { UpdateVolumeTierDto } from './dto/update-volume-tier.dto';

// M7 spec §3.1 — CommissionVolumeTier: pragovi obima poslovanja po subagentu ("Ako-Onda").
@Injectable()
export class CommissionVolumeTiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: CommissionAuthorityService,
  ) {}

  async findMany(subagentId: string): Promise<CommissionVolumeTier[]> {
    return this.prisma.commissionVolumeTier.findMany({ where: { subagentId }, orderBy: { rank: 'desc' } });
  }

  async findOneOrThrow(id: string): Promise<CommissionVolumeTier> {
    const tier = await this.prisma.commissionVolumeTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException(`CommissionVolumeTier ${id} nije pronađen.`);
    return tier;
  }

  private assertHasResultingValue(dto: { resultingCommissionPercentage?: number; resultingCommissionFixedAmount?: number }): void {
    if (dto.resultingCommissionPercentage == null && dto.resultingCommissionFixedAmount == null) {
      throw new BadRequestException(
        'Bar jedno od resultingCommissionPercentage/resultingCommissionFixedAmount mora biti postavljeno (M7 spec §3.1, isti obrazac kao M5 MarkupRule).',
      );
    }
  }

  async create(subagentId: string, dto: CreateVolumeTierDto, actor: { userId: string }): Promise<CommissionVolumeTier> {
    await this.authority.assertCanManageCommissionFor(subagentId, actor);
    this.assertHasResultingValue(dto);

    return this.prisma.commissionVolumeTier.create({
      data: {
        subagentId,
        rank: dto.rank,
        thresholdMetric: dto.thresholdMetric,
        thresholdPeriod: dto.thresholdPeriod,
        thresholdValue: dto.thresholdValue,
        resultingCommissionPercentage: dto.resultingCommissionPercentage ?? null,
        resultingCommissionFixedAmount: dto.resultingCommissionFixedAmount ?? null,
        resultingCommissionCurrency: dto.resultingCommissionCurrency ?? null,
        retroactive: dto.retroactive ?? false,
        createdBy: actor.userId,
      },
    });
  }

  async update(id: string, dto: UpdateVolumeTierDto, actor: { userId: string }): Promise<CommissionVolumeTier> {
    const existing = await this.findOneOrThrow(id);
    await this.authority.assertCanManageCommissionFor(existing.subagentId, actor);

    const merged = {
      resultingCommissionPercentage: dto.resultingCommissionPercentage ?? (existing.resultingCommissionPercentage != null ? Number(existing.resultingCommissionPercentage) : undefined),
      resultingCommissionFixedAmount: dto.resultingCommissionFixedAmount ?? (existing.resultingCommissionFixedAmount != null ? Number(existing.resultingCommissionFixedAmount) : undefined),
    };
    this.assertHasResultingValue(merged);

    return this.prisma.commissionVolumeTier.update({
      where: { id },
      data: {
        rank: dto.rank ?? undefined,
        thresholdMetric: dto.thresholdMetric ?? undefined,
        thresholdPeriod: dto.thresholdPeriod ?? undefined,
        thresholdValue: dto.thresholdValue ?? undefined,
        resultingCommissionPercentage: dto.resultingCommissionPercentage ?? undefined,
        resultingCommissionFixedAmount: dto.resultingCommissionFixedAmount ?? undefined,
        resultingCommissionCurrency: dto.resultingCommissionCurrency ?? undefined,
        retroactive: dto.retroactive ?? undefined,
      },
    });
  }
}
