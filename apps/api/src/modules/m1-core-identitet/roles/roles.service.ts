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

  async assertNotSystemRoleDeletion(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystemRole) {
      throw new BadRequestException('Sistemske uloge se ne mogu obrisati (M1 spec §3.2)');
    }
  }
}
