import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

function makeContext(request: unknown) {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('PermissionsGuard (M1 spec §3.6 — provera prava uvek uživo nad bazom)', () => {
  it('propušta zahtev bez @RequirePermission metadata bez pozivanja PermissionsService', async () => {
    const reflector = { get: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const permissions = { hasPermission: jest.fn() };
    const guard = new PermissionsGuard(reflector, permissions as any);

    const result = await guard.canActivate(makeContext({ user: { userId: 'u1' } }));

    expect(result).toBe(true);
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });

  it('baca ForbiddenException kad request.user nije postavljen (nema userId)', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ module: 'M1', resource: 'user', action: 'VIEW' }),
    } as unknown as Reflector;
    const permissions = { hasPermission: jest.fn() };
    const guard = new PermissionsGuard(reflector, permissions as any);

    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(ForbiddenException);
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });

  it('baca ForbiddenException kad PermissionsService.hasPermission vrati false', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ module: 'M1', resource: 'user', action: 'DELETE' }),
    } as unknown as Reflector;
    const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
    const guard = new PermissionsGuard(reflector, permissions as any);

    await expect(guard.canActivate(makeContext({ user: { userId: 'u1' } }))).rejects.toThrow(ForbiddenException);
    expect(permissions.hasPermission).toHaveBeenCalledWith('u1', 'M1', 'user', 'DELETE');
  });

  it('propušta zahtev kad PermissionsService.hasPermission vrati true', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ module: 'M1', resource: 'user', action: 'VIEW' }),
    } as unknown as Reflector;
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const guard = new PermissionsGuard(reflector, permissions as any);

    const result = await guard.canActivate(makeContext({ user: { userId: 'u1' } }));

    expect(result).toBe(true);
  });

  it('proverava dozvolu na svaki poziv iznova (bez keširanja) — override menja ishod odmah', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue({ module: 'M5', resource: 'booking', action: 'VIEW' }),
    } as unknown as Reflector;
    const permissions = {
      hasPermission: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    };
    const guard = new PermissionsGuard(reflector, permissions as any);
    const request = makeContext({ user: { userId: 'u1' } });

    await expect(guard.canActivate(request)).rejects.toThrow(ForbiddenException);
    // simulira da je između dva zahteva dodat UserPermissionOverride ALLOW — sledeći zahtev odmah prolazi
    await expect(guard.canActivate(request)).resolves.toBe(true);
    expect(permissions.hasPermission).toHaveBeenCalledTimes(2);
  });
});
