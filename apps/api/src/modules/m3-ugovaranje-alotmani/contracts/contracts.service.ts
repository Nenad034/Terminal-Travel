import { BadRequestException, Injectable } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import {
  type PaginationQueryDto,
  paginated,
  paginationArgs,
} from '../../../common/pagination/pagination';
import { contractProductScope, type ProductScopeFilters } from '../product-scope';

export interface ContractFilters extends ProductScopeFilters {
  q?: string;
  status?: ContractStatus;
  supplierId?: string;
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — raste sa svakim novim ugovorom;
  // jedini pozivalac ove liste (`/ugovori` u panelu) traži pun spisak dobavljača da bi imenom
  // razrešio `supplierId` svakog reda (`SuppliersService.findAll` ispod), ne obrnuto.
  /**
   * Filteri (8.9.2026, vlasnikov nalaz: "ovde ne mogu da isfiltriram ugovore kao na primer u
   * katalogu"). Filtriranje ide na SERVER, ne nad dovučenom stranom — lista je straničena, pa
   * bi klijentsko filtriranje pretraživalo samo trenutnih N redova i tiho krilo ostalo.
   *
   * `q` gađa broj ugovora I naziv dobavljača, jer se u praksi traži i jedno i drugo, a čovek
   * ne zna unapred koje polje pamti.
   */
  async findAll(pagination?: PaginationQueryDto, filters?: ContractFilters) {
    const { skip, take, page, limit } = paginationArgs(pagination);
    const q = filters?.q?.trim();
    const where: Prisma.ContractWhereInput = {
      status: filters?.status,
      supplierId: filters?.supplierId,
      // v1.24 — destinacija/objekat/vrsta se traže KROZ proizvode tog ugovora; ugovor sam po
      // sebi ne zna ni destinaciju ni naziv hotela (`product-scope.ts` nosi obrazloženje).
      ...contractProductScope(filters),
      ...(q
        ? {
            OR: [
              { contractNumber: { contains: q, mode: 'insensitive' as const } },
              { supplier: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.contract.count({ where }),
    ]);
    return paginated(data, total, page, limit);
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
        commissionModel: dto.commissionModel,
        commissionPercentage: dto.commissionPercentage,
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
  // §2.2b dopuna v1.12 — isto sprovođenje za commission_model.
  async update(id: string, dto: UpdateContractDto, actorId: string) {
    const before = await this.prisma.contract.findUniqueOrThrow({ where: { id } });

    if (dto.status === 'ACTIVE' && before.status !== 'ACTIVE') {
      const effectiveTip = dto.defaultTipNastupanja ?? before.defaultTipNastupanja;
      if (!effectiveTip) {
        throw new BadRequestException(
          'Ugovor ne može preći u ACTIVE bez popunjenog default_tip_nastupanja (M3 spec §2.2)',
        );
      }

      const effectiveCommissionModel = dto.commissionModel ?? before.commissionModel;
      if (!effectiveCommissionModel) {
        throw new BadRequestException(
          'Ugovor ne može preći u ACTIVE bez popunjenog commission_model (M3 spec §2.2b)',
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
