import { Injectable } from '@nestjs/common';
import { ProviderCallOperation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { type PaginationQueryDto, paginated, paginationArgs } from '../../../common/pagination/pagination';

@Injectable()
export class ProviderCallLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // M4 spec §7 — "filtrirano po provajderu/operaciji/datumu/statusu, za dijagnostiku"
  // STRANIČENJE (6.9.2026, dok. 39 nalaz 2.2). Ranije golo `take: 200`: dnevnik poziva ka
  // dobavljačima puni se svakom pretragom, pa 200 redova pokriva minute rada — a ovo je
  // dijagnostički alat, gde nepotpuna lista vodi na pogrešan zaključak ("nema poziva u tom
  // periodu" umesto "ima ih, ali su iza granice").
  find(
    filter: { providerCode?: string; operation?: ProviderCallOperation; from?: Date; to?: Date },
    pagination?: PaginationQueryDto,
  ) {
    const where = {
      providerCode: filter.providerCode,
      operation: filter.operation,
      timestamp: { gte: filter.from, lte: filter.to },
    };
    const { skip, take, page, limit } = paginationArgs(pagination);
    return this.prisma
      .$transaction([
        this.prisma.providerCallLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take }),
        this.prisma.providerCallLog.count({ where }),
      ])
      .then(([redovi, total]) => paginated(redovi, total, page, limit));
  }
}
