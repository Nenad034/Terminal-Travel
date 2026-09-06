import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActorType, Prisma } from '@prisma/client';
import {
  type Paginated,
  type PaginationQueryDto,
  paginated,
  paginationArgs,
} from '../../../common/pagination/pagination';

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

  // `actions` (dodato 29.8.2026, M18 spec §9a — "Live procesna mapa") — filtriranje na
  // više `action` vrednosti odjednom (npr. čvor mape koji objedinjuje dve srodne akcije).
  // `q` (dodato 29.8.2026, na zahtev vlasnika — "pretraga po pojmu") — slobodan tekst,
  // case-insensitive, preko action/resourceType/resourceId/module odjednom (OR), pošto
  // korisnik za tehnički zapis ne zna unapred u kom od ta četiri polja se pojam nalazi.
  // STRANIČENJE (6.9.2026, dok. 39 nalaz 2.2 — nastavak posla započetog na M5 listi
  // rezervacija). Do danas je ovde stajalo golo `take: 200`: audit log je append-only i raste
  // svakim potezom u sistemu, pa je 200 dostignuto za nekoliko dana rada — a ekran je i dalje
  // tvrdio da to jeste ceo rezultat pretrage. `count` ide u ISTOJ transakciji sa upitom, da
  // broj i redovi ne dođu iz dva različita trenutka (inače „prikazano 50 od 1.240" ume da laže
  // dok neko drugi upisuje — a ovde se upisuje neprestano).
  async find(
    filter: { module?: string; actorId?: string; actions?: string[]; q?: string; from?: Date; to?: Date },
    pagination?: PaginationQueryDto,
  ): Promise<Paginated<Prisma.AuditLogEntryGetPayload<Record<string, never>>>> {
    const where: Prisma.AuditLogEntryWhereInput = {
      module: filter.module,
      actorId: filter.actorId,
      action: filter.actions && filter.actions.length > 0 ? { in: filter.actions } : undefined,
      timestamp: {
        gte: filter.from,
        lte: filter.to,
      },
      OR: filter.q
        ? [
            { action: { contains: filter.q, mode: 'insensitive' } },
            { resourceType: { contains: filter.q, mode: 'insensitive' } },
            { resourceId: { contains: filter.q, mode: 'insensitive' } },
            { module: { contains: filter.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const { skip, take, page, limit } = paginationArgs(pagination);
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.auditLogEntry.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take }),
      this.prisma.auditLogEntry.count({ where }),
    ]);
    return paginated(entries, total, page, limit);
  }

  // Dopuna (23.8.2026, na zahtev vlasnika — "workflow te rezervacije od pocetka... sa datumima,
  // vremenima i ko je radio promenu") — timeline JEDNOG zapisa, hronološkim redom (rastuće, za
  // razliku od `find()` iznad koje je "poslednje prvo"). Reuses postojeći append-only
  // `AuditLogEntry` (M5 spec §11 — "promene statusa rezervacije se ne čuvaju u posebnoj tabeli,
  // koristi se AuditLogEntry"), isti mehanizam radi za bilo koji `resourceType`, ne samo Booking.
  async findByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLogEntry.findMany({
      where: { resourceType, resourceId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
