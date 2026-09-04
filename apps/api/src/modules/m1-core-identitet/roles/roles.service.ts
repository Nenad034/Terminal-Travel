import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      include: { _count: { select: { userRoles: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(name: string, description: string, actorId: string) {
    const role = await this.prisma.role.create({ data: { name, description, isSystemRole: false } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'role.created',
      resourceType: 'Role',
      resourceId: role.id,
      afterState: role,
      context: {},
    });
    return role;
  }

  // M1 spec §3.2 — sistemske uloge "ne mogu se obrisati, samo dopuniti".
  async update(id: string, description: string, actorId: string) {
    const before = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.role.update({ where: { id }, data: { description } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'role.updated',
      resourceType: 'Role',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // ==========================================================================
  // M1 spec §6 (dopuna 4.9.2026) — dozvole po ulozi
  //
  // Do ove dopune veza uloga↔dozvola postojala je ISKLJUČIVO u `prisma/seed/seed.ts`:
  // `POST /iam/roles` je pravio ulogu koja ostaje trajno prazna (svaki zahtev njenog
  // nosioca pada na PermissionsGuard), a jedini način da se doda dozvola bio je ručno
  // pokretanje seed skripte — što je i uzrok zamke 12.4 (izmena u seed-u ne stiže do
  // već zasejane baze).
  // ==========================================================================

  async listPermissions(roleId: string) {
    await this.prisma.role.findUniqueOrThrow({ where: { id: roleId } });
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rows.map((r) => r.permission);
  }

  /**
   * Dodaje dozvole ulozi. Namerno DODAJE (ne zamenjuje ceo skup) — ekran šalje samo
   * razliku, pa dva čoveka koja istovremeno uređuju istu ulogu ne brišu jedan drugom
   * izmene. Sistemska uloga se SME menjati (vlasnik mora moći da doda dozvolu novog
   * modula postojećoj ulozi); ono što se ne sme je brisanje same uloge (§3.2).
   */
  async addPermissions(roleId: string, permissionIds: string[], actorId: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id: roleId } });
    const before = await this.listPermissions(roleId);

    const known = await this.prisma.permission.findMany({ where: { id: { in: permissionIds } } });
    if (known.length !== new Set(permissionIds).size) {
      // Fail-closed: ni jedna dozvola se ne dodaje ako makar jedan id ne postoji —
      // delimično primenjena izmena prava je gora od odbijene.
      throw new BadRequestException('Jedna ili više navedenih dozvola ne postoji u katalogu.');
    }

    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });

    const after = await this.listPermissions(roleId);
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'role.permissions_changed',
      resourceType: 'Role',
      resourceId: roleId,
      beforeState: { roleName: role.name, permissions: before.map((p) => `${p.module}/${p.resource}/${p.action}`) },
      afterState: { roleName: role.name, permissions: after.map((p) => `${p.module}/${p.resource}/${p.action}`) },
      context: { added: permissionIds },
    });
    return after;
  }

  async removePermission(roleId: string, permissionId: string, actorId: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id: roleId } });
    const before = await this.listPermissions(roleId);

    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });

    const after = await this.listPermissions(roleId);
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'role.permissions_changed',
      resourceType: 'Role',
      resourceId: roleId,
      beforeState: { roleName: role.name, permissions: before.map((p) => `${p.module}/${p.resource}/${p.action}`) },
      afterState: { roleName: role.name, permissions: after.map((p) => `${p.module}/${p.resource}/${p.action}`) },
      context: { removed: permissionId },
    });
    return after;
  }

  async assertNotSystemRoleDeletion(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystemRole) {
      throw new BadRequestException('Sistemske uloge se ne mogu obrisati (M1 spec §3.2)');
    }
  }
}
