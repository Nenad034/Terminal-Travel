import { Injectable } from '@nestjs/common';
import { ProviderCallOperation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProviderCallLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // M4 spec §7 — "filtrirano po provajderu/operaciji/datumu/statusu, za dijagnostiku"
  find(filter: { providerCode?: string; operation?: ProviderCallOperation; from?: Date; to?: Date }) {
    return this.prisma.providerCallLog.findMany({
      where: {
        providerCode: filter.providerCode,
        operation: filter.operation,
        timestamp: { gte: filter.from, lte: filter.to },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }
}
