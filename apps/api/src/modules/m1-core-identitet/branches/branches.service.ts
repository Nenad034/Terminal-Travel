import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface UpdateBranchDto {
  name?: string;
  active?: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  responsiblePersonName?: string | null;
  taxId?: string | null;
  licenseNumber?: string | null;
}

// M1 spec dopuna (6.9.2026, vlasnikov zahtev: "TT moze da ima vise ili jednu poslovnicu i to
// treba omoguciti podesavanjima na globalnom nivou aplikacije") — CRUD nad poslovnicama, isti
// obrazac kao `RolesService` (jednostavan entitet, meko gašenje umesto brisanja jer se
// `User.branchId`/`Booking.branchId` oslanjaju na postojeće redove).
// Dopuna 8.9.2026 (§3.9b) — kompletni poslovni podaci + `findUsers` (dodeljeni korisnici sa
// ulogom, "nivo pristupa" u panelu).
@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Namerno samo id/name/active — svaki STAFF nalog ovo vidi bez posebne dozvole (bira sopstvenu
  // poslovnicu, filtrira rezervacije), pa se ostala polja (adresa/PIB/kontakt) ovde ne izlažu.
  findAll() {
    return this.prisma.branch.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: 'asc' },
    });
  }

  // Puna polja — iza M1/branch/EDIT na kontroleru, isti krug kao CREATE/EDIT.
  findOne(id: string) {
    return this.prisma.branch.findUniqueOrThrow({ where: { id } });
  }

  // M1 spec §3.9b dopuna — "korisnici dodeljeni poslovnici sa jasno napisanim nivoom pristupa".
  // Iza M1/user/VIEW na kontroleru (ne branch/EDIT) — ovo je roster kolega sa ulogama, ista
  // privatnosna granica kao pun /korisnici spisak, nezavisna od prava nad samom poslovnicom.
  findUsers(branchId: string) {
    return this.prisma.user.findMany({
      where: { branchId },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        roles: { select: { role: { select: { name: true } } } },
      },
      orderBy: { fullName: 'asc' },
    });
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

  async update(id: string, dto: UpdateBranchDto, actorId: string) {
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
