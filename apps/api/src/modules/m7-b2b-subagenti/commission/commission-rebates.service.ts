import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionRebate } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

// M7 spec §3.2 — CommissionRebate: poseban jednokratan rabat kad se dostigne retroactive prag
// usred perioda, NIKAD ponovno otvaranje/storniranje već poslatih fiskalnih dokumenata (M10).
@Injectable()
export class CommissionRebatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findMany(subagentId: string): Promise<CommissionRebate[]> {
    return this.prisma.commissionRebate.findMany({ where: { subagentId }, orderBy: { createdAt: 'desc' } });
  }

  async findOneOrThrow(id: string): Promise<CommissionRebate> {
    const rebate = await this.prisma.commissionRebate.findUnique({ where: { id } });
    if (!rebate) throw new NotFoundException(`CommissionRebate ${id} nije pronađen.`);
    return rebate;
  }

  // Poziva se iz SubagentVolumeStatusService.recalculate kad retroactive prag pređen usred
  // perioda (nivo "Autonomno" — samo obračun, ništa novčano se ne menja dok se ne odobri).
  async createDraft(params: {
    subagentId: string;
    triggeringTierId: string;
    periodStart: Date;
    periodEnd: Date;
    calculatedAmount: number;
    currency: string;
  }): Promise<CommissionRebate> {
    const rebate = await this.prisma.commissionRebate.create({
      data: {
        subagentId: params.subagentId,
        triggeringTierId: params.triggeringTierId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        calculatedAmount: params.calculatedAmount,
        currency: params.currency,
        status: 'DRAFT',
      },
    });

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M7',
      action: 'commission_rebate.draft_created',
      resourceType: 'CommissionRebate',
      resourceId: rebate.id,
      afterState: rebate,
    });

    return rebate;
  }

  // POST /subagents/:id/commission-rebates/:rebateId/approve — §3.2: "obavezno ljudski nalog",
  // zahteva M7/commission-rebate/APPROVE (nikad AI agent, sprovedeno na kontroleru preko actor).
  // APPROVED se knjiži kao APPLIED odmah (M10 spec za konkretno knjiženje kredita je van obima
  // ovog modula — ovaj servis samo prevodi status, isti obrazac kao M10 SUBMIT koraci drugde).
  async approve(id: string, actor: { userId: string }): Promise<CommissionRebate> {
    const rebate = await this.findOneOrThrow(id);
    if (rebate.status !== 'DRAFT') {
      throw new BadRequestException(`CommissionRebate ${id} nije u statusu DRAFT (status: ${rebate.status}).`);
    }

    const now = new Date();
    const updated = await this.prisma.commissionRebate.update({
      where: { id },
      data: { status: 'APPLIED', approvedBy: actor.userId, approvedAt: now, appliedAt: now },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'commission_rebate.approved_and_applied',
      resourceType: 'CommissionRebate',
      resourceId: id,
      beforeState: rebate,
      afterState: updated,
    });

    return updated;
  }

  async reject(id: string, reason: string, actor: { userId: string }): Promise<CommissionRebate> {
    const rebate = await this.findOneOrThrow(id);
    if (rebate.status !== 'DRAFT') {
      throw new BadRequestException(`CommissionRebate ${id} nije u statusu DRAFT (status: ${rebate.status}).`);
    }

    const updated = await this.prisma.commissionRebate.update({ where: { id }, data: { status: 'REJECTED' } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M7',
      action: 'commission_rebate.rejected',
      resourceType: 'CommissionRebate',
      resourceId: id,
      beforeState: rebate,
      afterState: updated,
      context: { reason },
    });

    return updated;
  }
}
