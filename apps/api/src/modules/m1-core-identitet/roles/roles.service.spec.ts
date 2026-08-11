import { BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  function makeService(prismaOverrides: any = {}, auditWrite = jest.fn()) {
    const prisma = {
      role: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      ...prismaOverrides,
    };
    const auditLog = { write: auditWrite };
    return { service: new RolesService(prisma as any, auditLog as any), prisma, auditLog };
  }

  describe('assertNotSystemRoleDeletion (M1 spec §3.2 — sistemske uloge se ne mogu obrisati)', () => {
    it('baca BadRequestException kad je uloga sistemska', async () => {
      const { service, prisma } = makeService();
      prisma.role.findUniqueOrThrow.mockResolvedValue({ id: 'r1', isSystemRole: true });

      await expect(service.assertNotSystemRoleDeletion('r1')).rejects.toThrow(BadRequestException);
    });

    it('ne baca grešku kad uloga nije sistemska', async () => {
      const { service, prisma } = makeService();
      prisma.role.findUniqueOrThrow.mockResolvedValue({ id: 'r2', isSystemRole: false });

      await expect(service.assertNotSystemRoleDeletion('r2')).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('kreira novu ulogu kao NE-sistemsku i upisuje audit log', async () => {
      const auditWrite = jest.fn();
      const { service, prisma } = makeService({}, auditWrite);
      const created = { id: 'r3', name: 'MARKETING_MENADZER', description: 'opis', isSystemRole: false };
      prisma.role.create.mockResolvedValue(created);

      const result = await service.create('MARKETING_MENADZER', 'opis', 'actor-1');

      expect(prisma.role.create).toHaveBeenCalledWith({
        data: { name: 'MARKETING_MENADZER', description: 'opis', isSystemRole: false },
      });
      expect(auditWrite).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'M1', action: 'role.created', resourceId: 'r3', actorId: 'actor-1' }),
      );
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('upisuje audit log sa before/after stanjem uloge', async () => {
      const auditWrite = jest.fn();
      const { service, prisma } = makeService({}, auditWrite);
      const before = { id: 'r4', name: 'HR', description: 'staro' };
      const after = { id: 'r4', name: 'HR', description: 'novo' };
      prisma.role.findUniqueOrThrow.mockResolvedValue(before);
      prisma.role.update.mockResolvedValue(after);

      const result = await service.update('r4', 'novo', 'actor-2');

      expect(auditWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'M1',
          action: 'role.updated',
          resourceId: 'r4',
          beforeState: before,
          afterState: after,
        }),
      );
      expect(result).toBe(after);
    });
  });
});
