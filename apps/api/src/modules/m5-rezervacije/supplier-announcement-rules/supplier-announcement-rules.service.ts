import { BadRequestException, Injectable } from '@nestjs/common';
import { AnnouncementTriggerCondition, SupplierAnnouncementRule } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { UpsertAnnouncementRuleDto } from './dto/upsert-announcement-rule.dto';

// M5 spec §8.7 — ugrađeni fallback kad ni podrazumevano pravilo ne postoji.
const BUILTIN_FALLBACK: { triggerCondition: AnnouncementTriggerCondition; daysBeforeStay: number } = {
  triggerCondition: 'DAYS_BEFORE_STAY',
  daysBeforeStay: 7,
};

@Injectable()
export class SupplierAnnouncementRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.supplierAnnouncementRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: UpsertAnnouncementRuleDto, actorId: string) {
    if (dto.triggerCondition === 'DAYS_BEFORE_STAY' && dto.daysBeforeStay == null) {
      throw new BadRequestException('days_before_stay je obavezan kad je trigger_condition = DAYS_BEFORE_STAY (M5 spec §8.7).');
    }
    const rule = await this.prisma.supplierAnnouncementRule.create({
      data: {
        supplierId: dto.supplierId ?? null,
        triggerCondition: dto.triggerCondition,
        daysBeforeStay: dto.daysBeforeStay,
        createdBy: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_announcement_rule.created',
      resourceType: 'SupplierAnnouncementRule',
      resourceId: rule.id,
      afterState: rule,
      context: {},
    });
    return rule;
  }

  async update(id: string, dto: UpsertAnnouncementRuleDto, actorId: string) {
    const before = await this.prisma.supplierAnnouncementRule.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.supplierAnnouncementRule.update({
      where: { id },
      data: { triggerCondition: dto.triggerCondition, daysBeforeStay: dto.daysBeforeStay, updatedBy: actorId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'supplier_announcement_rule.updated',
      resourceType: 'SupplierAnnouncementRule',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // M5 spec §8.7 — "najspecifičnije pobeđuje": Supplier > podrazumevano (supplier_id NULL) >
  // ugrađeni fallback (DAYS_BEFORE_STAY, 7 dana) kad ni podrazumevano pravilo ne postoji.
  async resolveForSupplier(supplierId: string): Promise<Pick<SupplierAnnouncementRule, 'triggerCondition' | 'daysBeforeStay'>> {
    const specific = await this.prisma.supplierAnnouncementRule.findFirst({ where: { supplierId } });
    if (specific) return specific;
    const fallbackDefault = await this.prisma.supplierAnnouncementRule.findFirst({ where: { supplierId: null } });
    if (fallbackDefault) return fallbackDefault;
    return BUILTIN_FALLBACK;
  }
}
