import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  function makeService() {
    const prisma = {
      user: {
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userRole: {
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      userPermissionOverride: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const auth = { createInviteToken: jest.fn().mockResolvedValue('raw-invite-token') };
    const service = new UsersService(prisma as any, auditLog as any, auth as any);
    return { service, prisma, auditLog, auth };
  }

  describe('createPermissionOverride (M1 spec §3.6 — bezbednosna ograda)', () => {
    it('odbija kad korisnik pokušava da sebi dodeli/oduzme dozvolu (granted_by === user_id)', async () => {
      const { service, prisma } = makeService();

      await expect(
        service.createPermissionOverride('user-1', { permissionId: 'p1', effect: 'ALLOW', reason: 'test' } as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.userPermissionOverride.create).not.toHaveBeenCalled();
    });

    it('kreira override za drugog korisnika i upisuje audit log sa razlogom', async () => {
      const { service, prisma, auditLog } = makeService();
      const created = { id: 'ov-1', userId: 'user-2', permissionId: 'p1', effect: 'ALLOW', reason: 'privremen pristup' };
      prisma.userPermissionOverride.create.mockResolvedValue(created);

      const result = await service.createPermissionOverride(
        'user-2',
        { permissionId: 'p1', effect: 'ALLOW', reason: 'privremen pristup' } as any,
        'actor-vlasnik',
      );

      expect(prisma.userPermissionOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            permissionId: 'p1',
            effect: 'ALLOW',
            reason: 'privremen pristup',
            grantedBy: 'actor-vlasnik',
          }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'M1', action: 'permission_override.grant', resourceId: 'ov-1' }),
      );
      expect(result).toBe(created);
    });

    it('prosleđuje expiresAt kao Date kad je prosleđen, inače null', async () => {
      const { service, prisma } = makeService();
      prisma.userPermissionOverride.create.mockResolvedValue({ id: 'ov-2' });

      await service.createPermissionOverride(
        'user-3',
        { permissionId: 'p1', effect: 'ALLOW', reason: 'test' } as any,
        'actor-1',
      );
      expect(prisma.userPermissionOverride.create.mock.calls[0][0].data.expiresAt).toBeNull();

      await service.createPermissionOverride(
        'user-3',
        { permissionId: 'p1', effect: 'ALLOW', reason: 'test', expiresAt: '2027-01-01T00:00:00.000Z' } as any,
        'actor-1',
      );
      expect(prisma.userPermissionOverride.create.mock.calls[1][0].data.expiresAt).toEqual(
        new Date('2027-01-01T00:00:00.000Z'),
      );
    });
  });

  describe('deletePermissionOverride', () => {
    it('briše override i upisuje audit log sa beforeState (za praćenje ko/kad je uklonio izuzetak)', async () => {
      const { service, prisma, auditLog } = makeService();
      const deleted = { id: 'ov-3', userId: 'user-4', effect: 'DENY' };
      prisma.userPermissionOverride.delete.mockResolvedValue(deleted);

      await service.deletePermissionOverride('ov-3', 'actor-1');

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission_override.revoke', beforeState: deleted }),
      );
    });
  });

  describe('suspend (M1 spec §6 — DELETE = meko gašenje)', () => {
    it('menja status na SUSPENDED, ne briše zapis, i opoziva aktivne refresh tokene', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-5', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({ id: 'user-5', status: 'SUSPENDED' });

      const result = await service.suspend('user-5', 'actor-1');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-5' }, data: { status: 'SUSPENDED' } });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-5', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.suspended',
          beforeState: { status: 'ACTIVE' },
          afterState: { status: 'SUSPENDED' },
        }),
      );
      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('assignRole / removeRole', () => {
    it('assignRole je idempotentno (upsert) i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();

      await service.assignRole('user-6', 'role-1', 'actor-1');

      expect(prisma.userRole.upsert).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 'user-6', roleId: 'role-1' } },
        update: {},
        create: { userId: 'user-6', roleId: 'role-1', assignedBy: 'actor-1' },
      });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.role_assigned' }));
    });

    it('removeRole briše dodelu i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();

      await service.removeRole('user-6', 'role-1', 'actor-1');

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 'user-6', roleId: 'role-1' } },
      });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.role_removed' }));
    });
  });

  describe('invite (M1 spec §7 — kreira nalog u statusu INVITED)', () => {
    it('kreira korisnika sa status=INVITED, accountType=STAFF, dodeljuje uloge i traži invite token', async () => {
      const { service, prisma, auditLog, auth } = makeService();
      const created = { id: 'user-7', email: 'novi@tt.rs', status: 'INVITED' };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.invite(
        { email: 'novi@tt.rs', fullName: 'Novi Korisnik', roleIds: ['role-a', 'role-b'] } as any,
        'actor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'novi@tt.rs',
            accountType: 'STAFF',
            status: 'INVITED',
          }),
        }),
      );
      expect(auth.createInviteToken).toHaveBeenCalledWith('user-7');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.invited' }));
      expect(result).toEqual({ user: created, inviteToken: 'raw-invite-token' });
    });

    it('franšizni nalog (linkedProfileId postavljen) sme da pozove naloge SAMO sopstvene franšize (M1 §5, M7 §2.0.7)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'franchise-direktor-1', linkedProfileId: 'subagent-fr-1' });
      prisma.user.create.mockResolvedValue({ id: 'user-8' });

      await service.invite(
        { email: 'novi@fransiza.rs', fullName: 'Novi', roleIds: [], linkedProfileId: 'subagent-fr-1' } as any,
        'franchise-direktor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ linkedProfileId: 'subagent-fr-1' }) }),
      );
    });

    it('franšizni nalog NE sme da pozove nalog van sopstvene franšize (tuđa franšiza ili matična agencija)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'franchise-direktor-1', linkedProfileId: 'subagent-fr-1' });

      await expect(
        service.invite({ email: 'x@y.rs', fullName: 'X', roleIds: [], linkedProfileId: 'subagent-fr-DRUGA' } as any, 'franchise-direktor-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('matična agencija (bez linkedProfileId) sme da pozove nalog za bilo koju franšizu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'hq-direktor-1', linkedProfileId: null });
      prisma.user.create.mockResolvedValue({ id: 'user-9' });

      await service.invite(
        { email: 'x@y.rs', fullName: 'X', roleIds: [], linkedProfileId: 'bilo-koja-fransiza' } as any,
        'hq-direktor-1',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ linkedProfileId: 'bilo-koja-fransiza' }) }),
      );
    });
  });
});
