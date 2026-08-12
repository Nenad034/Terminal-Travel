import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateSupplierPaymentInstructionDto } from './dto/create-payment-instruction.dto';

// M10 spec §8.5.2 — instrukcija za isplatu dobavljaču; izvršenje isključivo ljudski nalog.
@Injectable()
export class SupplierPaymentInstructionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(filters: { supplierObligationId?: string }) {
    return this.prisma.supplierPaymentInstruction.findMany({
      where: { supplierObligationId: filters.supplierObligationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateSupplierPaymentInstructionDto, actor: { userId: string }) {
    const obligation = await this.prisma.supplierObligation.findUnique({ where: { id: dto.supplierObligationId } });
    if (!obligation) throw new NotFoundException(`SupplierObligation ${dto.supplierObligationId} nije pronađena.`);
    if (obligation.status !== 'APPROVED') {
      throw new BadRequestException('Instrukcija za isplatu se pravi tek nad APPROVED obavezom (M10 spec §8.5.2/§8.3).');
    }

    const instruction = await this.prisma.supplierPaymentInstruction.create({
      data: {
        supplierObligationId: dto.supplierObligationId,
        method: dto.method,
        bankIban: dto.bankIban,
        bankSwift: dto.bankSwift,
        virtualCardReference: dto.virtualCardReference,
        status: 'PENDING',
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_payment_instruction.created',
      resourceType: 'SupplierPaymentInstruction',
      resourceId: instruction.id,
      afterState: instruction,
    });
    return instruction;
  }

  // §8.5.2 — obavezno ljudski nalog, nikad AI agent.
  async execute(id: string, actor: { userId: string }) {
    const instruction = await this.prisma.supplierPaymentInstruction.findUnique({ where: { id } });
    if (!instruction) throw new NotFoundException(`SupplierPaymentInstruction ${id} nije pronađena.`);
    if (instruction.status !== 'PENDING') {
      throw new BadRequestException(`SupplierPaymentInstruction ${id} nije u statusu PENDING (status: ${instruction.status}).`);
    }

    const updated = await this.prisma.supplierPaymentInstruction.update({
      where: { id },
      data: { status: 'EXECUTED', executedBy: actor.userId, executedAt: new Date() },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'supplier_payment_instruction.executed',
      resourceType: 'SupplierPaymentInstruction',
      resourceId: id,
      beforeState: instruction,
      afterState: updated,
    });
    return updated;
  }
}
