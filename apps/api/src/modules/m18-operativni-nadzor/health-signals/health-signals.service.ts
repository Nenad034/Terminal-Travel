import { Injectable } from '@nestjs/common';
import { HealthSignalSecurityCategory, HealthSignalSeverity, HealthSignalType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationDispatchService } from '../notification-channels/notification-dispatch.service';

export interface CreateHealthSignalParams {
  sourceModule: string;
  signalType: HealthSignalType;
  severity: HealthSignalSeverity;
  securityCategory?: HealthSignalSecurityCategory;
  details: Record<string, unknown>;
}

// M18 spec §2.1/§2.2 — HealthSignal nastaje isključivo iz detekcije (detectors/,
// event-subscribers/), nikad kroz POST endpoint (spec §9 nema takav endpoint). Svaki
// WARNING/CRITICAL signal odmah pokreće dispatch (§2.2) — sprovedeno ovde, na jednom mestu,
// da nijedan pozivalac detekcije to ne zaboravi.
@Injectable()
export class HealthSignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async create(params: CreateHealthSignalParams) {
    const signal = await this.prisma.healthSignal.create({
      data: {
        sourceModule: params.sourceModule,
        signalType: params.signalType,
        severity: params.severity,
        securityCategory: params.securityCategory,
        details: params.details as Prisma.InputJsonValue,
      },
    });

    if (params.severity === 'WARNING' || params.severity === 'CRITICAL') {
      return this.dispatch.dispatch(signal);
    }

    return signal;
  }

  async findAll(filter: { module?: string; type?: HealthSignalType; severity?: HealthSignalSeverity }) {
    return this.prisma.healthSignal.findMany({
      where: { sourceModule: filter.module, signalType: filter.type, severity: filter.severity },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async findSince(from: Date) {
    return this.prisma.healthSignal.findMany({ where: { detectedAt: { gte: from } }, orderBy: { detectedAt: 'asc' } });
  }
}
