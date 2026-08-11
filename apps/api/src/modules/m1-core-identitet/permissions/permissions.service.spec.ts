import { PermissionsService } from './permissions.service';

// M1 spec §3.6 — pravilo evaluacije: default DENY, ALLOW iz uloge, DENY override uvek pobeđuje,
// ALLOW override dodaje pristup i preko uloge, istekli override-i se ignorišu.
describe('PermissionsService.hasPermission (M1 spec §3.6)', () => {
  const PERMISSION = { id: 'perm-1', module: 'M5', resource: 'booking', action: 'VIEW' };

  function makePrismaMock(overrides: {
    permission?: typeof PERMISSION | null;
    denyOverride?: unknown;
    allowOverride?: unknown;
    roleGrant?: unknown;
  }) {
    return {
      permission: {
        findUnique: jest.fn().mockResolvedValue('permission' in overrides ? overrides.permission : PERMISSION),
      },
      userPermissionOverride: {
        findFirst: jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(overrides.denyOverride ?? null))
          .mockImplementationOnce(() => Promise.resolve(overrides.allowOverride ?? null)),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue(overrides.roleGrant ?? null),
      },
    };
  }

  it('vraća false kad tražena dozvola uopšte ne postoji u katalogu', async () => {
    const prisma = makePrismaMock({ permission: null });
    const service = new PermissionsService(prisma as any);

    const result = await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(result).toBe(false);
    expect(prisma.userPermissionOverride.findFirst).not.toHaveBeenCalled();
  });

  it('podrazumevano DENY kad korisnik nema ni ulogu ni override', async () => {
    const prisma = makePrismaMock({});
    const service = new PermissionsService(prisma as any);

    const result = await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(result).toBe(false);
  });

  it('ALLOW dolazi iz dodeljene uloge kad nema override-a', async () => {
    const prisma = makePrismaMock({ roleGrant: { userId: 'user-1', role: {} } });
    const service = new PermissionsService(prisma as any);

    const result = await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(result).toBe(true);
  });

  it('eksplicitan DENY override pobeđuje ALLOW iz uloge (§3.6 korak 3)', async () => {
    const prisma = makePrismaMock({
      denyOverride: { id: 'ov-1', effect: 'DENY' },
      roleGrant: { userId: 'user-1', role: {} }, // uloga bi inače dozvolila
    });
    const service = new PermissionsService(prisma as any);

    const result = await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(result).toBe(false);
    // DENY se utvrđuje pre provere uloge — provera uloge se ne mora ni desiti
    expect(prisma.userRole.findFirst).not.toHaveBeenCalled();
  });

  it('eksplicitan ALLOW override dodaje pristup i bez ijedne dodeljene uloge (§3.6 korak 4)', async () => {
    const prisma = makePrismaMock({
      allowOverride: { id: 'ov-2', effect: 'ALLOW' },
      roleGrant: null,
    });
    const service = new PermissionsService(prisma as any);

    const result = await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(result).toBe(true);
    // ALLOW override je dovoljan — provera uloge se ne mora ni desiti
    expect(prisma.userRole.findFirst).not.toHaveBeenCalled();
  });

  it('istekli override-i se filtriraju u samom upitu (expiresAt > now ili null) — service se oslanja na DB filter', async () => {
    const prisma = makePrismaMock({ roleGrant: { userId: 'user-1', role: {} } });
    const service = new PermissionsService(prisma as any);

    await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    const denyCallArgs = prisma.userPermissionOverride.findFirst.mock.calls[0][0];
    expect(denyCallArgs.where.effect).toBe('DENY');
    expect(denyCallArgs.where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);

    const allowCallArgs = prisma.userPermissionOverride.findFirst.mock.calls[1][0];
    expect(allowCallArgs.where.effect).toBe('ALLOW');
    expect(allowCallArgs.where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('provera se radi uvek uživo nad bazom — svaki poziv gađa Prisma iznova (§3.6 "nikad iz JWT tokena")', async () => {
    const prisma = makePrismaMock({ roleGrant: { userId: 'user-1', role: {} } });
    const service = new PermissionsService(prisma as any);

    await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');
    await service.hasPermission('user-1', 'M5', 'booking', 'VIEW');

    expect(prisma.permission.findUnique).toHaveBeenCalledTimes(2);
  });

  describe('registerModulePermissions', () => {
    it('upsertuje svaku prosleđenu dozvolu (idempotentno registrovanje po modulu)', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const service = new PermissionsService({ permission: { upsert } } as any);

      await service.registerModulePermissions([
        { module: 'M2', resource: 'product', action: 'PUBLISH', description: 'Objava proizvoda' },
      ]);

      expect(upsert).toHaveBeenCalledWith({
        where: { module_resource_action: { module: 'M2', resource: 'product', action: 'PUBLISH' } },
        update: { description: 'Objava proizvoda' },
        create: { module: 'M2', resource: 'product', action: 'PUBLISH', description: 'Objava proizvoda' },
      });
    });
  });
});
