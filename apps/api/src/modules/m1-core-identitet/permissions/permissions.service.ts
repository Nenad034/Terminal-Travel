import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * M1 spec §3.6 — "Pravilo evaluacije prava" (redosled, jače pobeđuje):
 * 1. Podrazumevano DENY.
 * 2. ALLOW iz uloga dodeljenih korisniku → podiže na ALLOW.
 * 3. UserPermissionOverride effect=DENY → uvek pobeđuje.
 * 4. UserPermissionOverride effect=ALLOW → dodaje pristup i preko uloge.
 * 5. Istekli override-i (expiresAt u prošlosti) se ignorišu.
 *
 * "Provera prava se radi uvek uživo nad bazom u trenutku zahteva (ne iz JWT tokena)" —
 * zato ova metoda nikad ne čita iz tokena/keša, samo iz baze, na svaki poziv.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasPermission(userId: string, moduleCode: string, resource: string, action: string): Promise<boolean> {
    const permission = await this.prisma.permission.findUnique({
      where: { module_resource_action: { module: moduleCode, resource, action } },
    });
    if (!permission) return false;

    const now = new Date();

    // Korak 3: eksplicitna DENY uvek pobeđuje, bez obzira na sve ostalo.
    const activeDeny = await this.prisma.userPermissionOverride.findFirst({
      where: {
        userId,
        permissionId: permission.id,
        effect: 'DENY',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeDeny) return false;

    // Korak 4: eksplicitna ALLOW dodaje pristup nezavisno od uloge.
    const activeAllow = await this.prisma.userPermissionOverride.findFirst({
      where: {
        userId,
        permissionId: permission.id,
        effect: 'ALLOW',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeAllow) return true;

    // Korak 2: ALLOW iz bilo koje dodeljene uloge.
    const viaRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          rolePermissions: { some: { permissionId: permission.id } },
        },
      },
    });
    return Boolean(viaRole);
  }

  async catalog() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }] });
  }

  /** Registrovanje dozvola jednog modula — svaki modul kad se implementira zove ovo (idempotentno). */
  async registerModulePermissions(
    entries: { module: string; resource: string; action: string; description: string }[],
  ) {
    for (const entry of entries) {
      await this.prisma.permission.upsert({
        where: { module_resource_action: { module: entry.module, resource: entry.resource, action: entry.action } },
        update: { description: entry.description },
        create: entry,
      });
    }
  }
}
