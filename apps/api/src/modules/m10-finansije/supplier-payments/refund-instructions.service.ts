import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateRefundInstructionDto } from './dto/create-refund-instruction.dto';

// M10 spec §8.5.3 — refundacija gosta van kartičnog toka (BANK_TRANSFER/CASH). Dva odvojena
// ljudska koraka: APPROVE pa EXECUTE — nikad AI agent, nikad preskakanje koraka.
@Injectable()
export class RefundInstructionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(filters: { paymentId?: string }) {
    return this.prisma.refundInstruction.findMany({ where: { paymentId: filters.paymentId }, orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateRefundInstructionDto, actor: { userId: string }) {
    const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } });
    if (!payment) throw new NotFoundException(`Payment ${dto.paymentId} nije pronađen.`);

    const instruction = await this.prisma.refundInstruction.create({
      data: { paymentId: dto.paymentId, amount: dto.amount, currency: dto.currency, method: dto.method, status: 'PENDING' },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'refund_instruction.created',
      resourceType: 'RefundInstruction',
      resourceId: instruction.id,
      afterState: instruction,
    });
    return instruction;
  }

  async approve(id: string, actor: { userId: string }) {
    const instruction = await this.findOne(id);
    if (instruction.status !== 'PENDING') {
      throw new BadRequestException(`RefundInstruction ${id} nije u statusu PENDING (status: ${instruction.status}).`);
    }
    const updated = await this.prisma.refundInstruction.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actor.userId },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'refund_instruction.approved',
      resourceType: 'RefundInstruction',
      resourceId: id,
      beforeState: instruction,
      afterState: updated,
    });
    return updated;
  }

  // §8.5.3 — mora imati status APPROVED pre EXECUTED; pokušaj preskakanja koraka se odbija.
  async execute(id: string, actor: { userId: string }) {
    const instruction = await this.findOne(id);
    if (instruction.status !== 'APPROVED') {
      throw new BadRequestException(`RefundInstruction ${id} nije u statusu APPROVED (status: ${instruction.status}).`);
    }
    const updated = await this.prisma.refundInstruction.update({
      where: { id },
      data: { status: 'EXECUTED', executedBy: actor.userId, executedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'refund_instruction.executed',
      resourceType: 'RefundInstruction',
      resourceId: id,
      beforeState: instruction,
      afterState: updated,
    });
    return updated;
  }

  private async findOne(id: string) {
    const instruction = await this.prisma.refundInstruction.findUnique({ where: { id } });
    if (!instruction) throw new NotFoundException(`RefundInstruction ${id} nije pronađena.`);
    return instruction;
  }
}
