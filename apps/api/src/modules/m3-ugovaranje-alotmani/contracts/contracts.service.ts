import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.contract.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.contract.findUniqueOrThrow({ where: { id }, include: { periods: true } });
  }

  async create(dto: CreateContractDto, actorId: string) {
    const contract = await this.prisma.contract.create({
      data: {
        supplierId: dto.supplierId,
        contractNumber: dto.contractNumber,
        currency: dto.currency,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        cancellationTermsSummary: dto.cancellationTermsSummary,
        documentUrl: dto.documentUrl,
        defaultTipNastupanja: dto.defaultTipNastupanja,
        status: 'DRAFT',
        createdBy: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract.created',
      resourceType: 'Contract',
      resourceId: contract.id,
      afterState: contract,
      context: {},
    });
    return contract;
  }

  // M3 spec §2.2 — "default_tip_nastupanja obavezno pre nego što Contract može preći u ACTIVE".
  async update(id: string, dto: UpdateContractDto, actorId: string) {
    const before = await this.prisma.contract.findUniqueOrThrow({ where: { id } });

    if (dto.status === 'ACTIVE' && before.status !== 'ACTIVE') {
      const effectiveTip = dto.defaultTipNastupanja ?? before.defaultTipNastupanja;
      if (!effectiveTip) {
        throw new BadRequestException(
          'Ugovor ne može preći u ACTIVE bez popunjenog default_tip_nastupanja (M3 spec §2.2)',
        );
      }
    }

    const after = await this.prisma.contract.update({ where: { id }, data: dto });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract.updated',
      resourceType: 'Contract',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }
}
