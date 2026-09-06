import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

// M1 spec dopuna (6.9.2026, vlasnikov zahtev: "TT moze da ima vise ili jednu poslovnicu i to
// treba omoguciti podesavanjima na globalnom nivou aplikacije") — CRUD nad poslovnicama, isti
// obrazac kao `RolesService` (jednostavan entitet, meko gašenje umesto brisanja jer se
// `User.branchId`/`Booking.branchId` oslanjaju na postojeće redove).
@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string, actorId: string) {
    const branch = await this.prisma.branch.create({ data: { name } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'branch.created',
      resourceType: 'Branch',
      resourceId: branch.id,
      afterState: branch,
      context: {},
    });
    return branch;
  }

  async update(id: string, dto: { name?: string; active?: boolean }, actorId: string) {
    const before = await this.prisma.branch.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.branch.update({ where: { id }, data: dto });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'branch.updated',
      resourceType: 'Branch',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }
}
