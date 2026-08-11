import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MarkupRule, MarkupScopeType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateMarkupRuleDto } from './dto/create-markup-rule.dto';
import { UpdateMarkupRuleDto } from './dto/update-markup-rule.dto';
import { isValidMarkupRule } from '../common/markup-formula';

export interface ContractedResolutionContext {
  productId: string;
  contractPeriodId: string;
  contractId: string;
  supplierId: string;
}

export interface ApiResolutionContext {
  productId: string;
  providerCode: string;
}

@Injectable()
export class MarkupRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(scopeType?: MarkupScopeType, scopeId?: string) {
    return this.prisma.markupRule.findMany({ where: { scopeType, scopeId }, orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.markupRule.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateMarkupRuleDto, actorId: string) {
    if (!isValidMarkupRule({ percentage: dto.percentage ?? null, fixedAmount: dto.fixedAmount ?? null })) {
      throw new BadRequestException('Bar jedno od percentage/fixedAmount mora biti postavljeno (M5 spec §2.1).');
    }
    const rule = await this.prisma.markupRule.create({
      data: {
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount,
        fixedAmountCurrency: dto.fixedAmountCurrency,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : undefined,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : undefined,
        createdBy: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'markup_rule.created',
      resourceType: 'MarkupRule',
      resourceId: rule.id,
      afterState: rule,
      context: {},
    });
    return rule;
  }

  async update(id: string, dto: UpdateMarkupRuleDto, actorId: string) {
    const before = await this.prisma.markupRule.findUniqueOrThrow({ where: { id } });
    const merged = {
      percentage: dto.percentage ?? Number(before.percentage ?? NaN),
      fixedAmount: dto.fixedAmount ?? before.fixedAmount,
    };
    if (!isValidMarkupRule({ percentage: dto.percentage !== undefined ? dto.percentage : before.percentage, fixedAmount: merged.fixedAmount })) {
      throw new BadRequestException('Bar jedno od percentage/fixedAmount mora ostati postavljeno (M5 spec §2.1).');
    }
    const after = await this.prisma.markupRule.update({
      where: { id },
      data: {
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount,
        fixedAmountCurrency: dto.fixedAmountCurrency,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : undefined,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : undefined,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M5',
      action: 'markup_rule.updated',
      resourceType: 'MarkupRule',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  private isActiveNow(rule: MarkupRule, at: Date): boolean {
    if (rule.activeFrom && at < rule.activeFrom) return false;
    if (rule.activeTo && at > rule.activeTo) return false;
    return true;
  }

  private async firstActiveRule(scopeType: MarkupScopeType, scopeId: string, at: Date): Promise<MarkupRule | null> {
    const rules = await this.prisma.markupRule.findMany({ where: { scopeType, scopeId } });
    return rules.find((r) => this.isActiveNow(r, at)) ?? null;
  }

  // M5 spec §2.2 — "Za proizvod iz M3 (ugovoren): M2_PRODUCT → M3_CONTRACT_PERIOD →
  // M3_CONTRACT → M3_SUPPLIER (podrazumevano)." Najspecifičnije pobeđuje.
  async resolveForContracted(ctx: ContractedResolutionContext, at: Date = new Date()): Promise<MarkupRule> {
    const order: [MarkupScopeType, string][] = [
      ['M2_PRODUCT', ctx.productId],
      ['M3_CONTRACT_PERIOD', ctx.contractPeriodId],
      ['M3_CONTRACT', ctx.contractId],
      ['M3_SUPPLIER', ctx.supplierId],
    ];
    for (const [scopeType, scopeId] of order) {
      const rule = await this.firstActiveRule(scopeType, scopeId, at);
      if (rule) return rule;
    }
    throw new NotFoundException(
      'Nijedno MarkupRule ne pokriva ovaj CONTRACTED proizvod (M5 spec §2.2) — dobavljač mora imati bar jedno podrazumevano pravilo.',
    );
  }

  // M5 spec §2.2 — "Za proizvod iz M4 (API): M2_PRODUCT → M4_PROVIDER (podrazumevano)."
  async resolveForApi(ctx: ApiResolutionContext, at: Date = new Date()): Promise<MarkupRule> {
    const order: [MarkupScopeType, string][] = [
      ['M2_PRODUCT', ctx.productId],
      ['M4_PROVIDER', ctx.providerCode],
    ];
    for (const [scopeType, scopeId] of order) {
      const rule = await this.firstActiveRule(scopeType, scopeId, at);
      if (rule) return rule;
    }
    throw new NotFoundException(
      'Nijedno MarkupRule ne pokriva ovaj API proizvod (M5 spec §2.2) — provajder mora imati bar jedno podrazumevano pravilo.',
    );
  }

  // M5 spec §2.2, "Ograda" — koristi ga M3 Contract / M4 ProviderConfig pre prelaska u ACTIVE.
  async hasDefaultRule(scopeType: MarkupScopeType, scopeId: string): Promise<boolean> {
    const count = await this.prisma.markupRule.count({ where: { scopeType, scopeId } });
    return count > 0;
  }
}
