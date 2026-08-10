import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActorType, Prisma } from '@prisma/client';

export interface WriteAuditLogParams {
  actorType: ActorType;
  actorId?: string | null;
  module: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: unknown;
  afterState?: unknown;
  context?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * M1 spec §3.8 — svaka izmena u sistemu upisuje trag ovde. Append-only je
 * sprovedeno na nivou baze (prisma/sql/audit_log_append_only.sql), ne ovde —
 * ovaj servis ne izlaže update/delete metode uopšte, namerno.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: WriteAuditLogParams) {
    return this.prisma.auditLogEntry.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        module: params.module,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        beforeState: (params.beforeState ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        afterState: (params.afterState ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        context: (params.context ?? {}) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? null,
      },
    });
  }

  async find(filter: { module?: string; actorId?: string; from?: Date; to?: Date }) {
    return this.prisma.auditLogEntry.findMany({
      where: {
        module: filter.module,
        actorId: filter.actorId,
        timestamp: {
          gte: filter.from,
          lte: filter.to,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }
}
