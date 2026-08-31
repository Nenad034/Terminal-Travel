import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreatePermissionOverrideDto } from './dto/create-permission-override.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly auth: AuthService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } }, permissionOverrides: true },
    });
  }

  // M1 spec §7 — "+ Pozovi korisnika": kreira nalog u statusu INVITED, šalje link za aktivaciju.
  // §5 dopuna (31.8.2026, M7 spec §2.0.7) — franšizni lokalni "Direktor" (ili bilo koja uloga
  // vezana za franšizu preko sopstvenog linked_profile_id) sme da poziva isključivo STAFF naloge
  // sa ISTIM linked_profile_id — sprečava franšizu da doda zaposlenog matičnoj agenciji ili
  // tuđoj franšizi. Vlasnik/Direktor matične agencije (bez linked_profile_id) ostaju bez ograde.
  async invite(dto: CreateUserDto, invitedBy: string) {
    const inviter = await this.prisma.user.findUnique({ where: { id: invitedBy } });
    if (inviter?.linkedProfileId && inviter.linkedProfileId !== dto.linkedProfileId) {
      throw new ForbiddenException(
        'Franšizni nalog sme da poziva isključivo STAFF naloge sopstvene franšize (M1 spec §5, M7 spec §2.0.7).',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        accountType: 'STAFF',
        status: 'INVITED',
        linkedProfileId: dto.linkedProfileId ?? null,
        roles: {
          create: dto.roleIds.map((roleId) => ({ roleId, assignedBy: invitedBy })),
        },
      },
    });

    const inviteToken = await this.auth.createInviteToken(user.id);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: invitedBy,
      module: 'M1',
      action: 'user.invited',
      resourceType: 'User',
      resourceId: user.id,
      context: { roleIds: dto.roleIds },
    });

    // Slanje email-a je van obima ovog fajla — TODO poveznica sa email servisom kad
    // ta infrastruktura dođe na red (isti obrazac kao AuthService.requestPasswordReset).
    return { user, inviteToken };
  }

  async update(id: string, data: { fullName?: string; phone?: string }, actorId: string) {
    const after = await this.prisma.user.update({ where: { id }, data });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'user.updated',
      resourceType: 'User',
      resourceId: id,
      afterState: data,
      context: {},
    });
    return after;
  }

  // DELETE = meko gašenje (status SUSPENDED), ne fizičko brisanje (M1 spec §6).
  async suspend(id: string, actorId: string) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'user.suspended',
      resourceType: 'User',
      resourceId: id,
      beforeState: { status: before.status },
      afterState: { status: after.status },
      context: {},
    });
    return after;
  }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, assignedBy },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: assignedBy,
      module: 'M1',
      action: 'user.role_assigned',
      resourceType: 'User',
      resourceId: userId,
      context: { roleId },
    });
  }

  async removeRole(userId: string, roleId: string, actorId: string) {
    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'user.role_removed',
      resourceType: 'User',
      resourceId: userId,
      context: { roleId },
    });
  }

  // M1 spec §3.6 — "korisnik ne može menjati sopstvene dozvole (granted_by != user_id)".
  async createPermissionOverride(userId: string, dto: CreatePermissionOverrideDto, grantedBy: string) {
    if (grantedBy === userId) {
      throw new BadRequestException('Korisnik ne može menjati sopstvene dozvole');
    }
    const override = await this.prisma.userPermissionOverride.create({
      data: {
        userId,
        permissionId: dto.permissionId,
        effect: dto.effect,
        reason: dto.reason,
        grantedBy,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: grantedBy,
      module: 'M1',
      action: 'permission_override.grant',
      resourceType: 'UserPermissionOverride',
      resourceId: override.id,
      afterState: override,
      context: { targetUserId: userId },
    });
    return override;
  }

  async listPermissionOverrides(userId: string) {
    return this.prisma.userPermissionOverride.findMany({ where: { userId }, include: { permission: true } });
  }

  async deletePermissionOverride(overrideId: string, actorId: string) {
    const override = await this.prisma.userPermissionOverride.delete({ where: { id: overrideId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M1',
      action: 'permission_override.revoke',
      resourceType: 'UserPermissionOverride',
      resourceId: overrideId,
      beforeState: override,
      context: {},
    });
    return override;
  }
}
