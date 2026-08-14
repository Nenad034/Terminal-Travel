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

  /**
   * M17 integracija (avgust 2026) — "efektivna" lista dozvola trenutnog korisnika, uvek
   * uživo nad bazom (isti princip kao {@link hasPermission}, §3.6). Ne postoji poseban
   * entitet/keš — ovo je čisto čitanje da bi M17 (interni panel) mogao da filtrira
   * navigaciju po pravima, bez da svaki od desetak stavki menija zove hasPermission
   * pojedinačno. Koristi ga isključivo `GET /iam/auth/me` (samo za sopstveni nalog,
   * nema poseban ključ dozvole — svaki prijavljeni korisnik sme da vidi SVOJA prava).
   */
  async effectivePermissions(userId: string): Promise<{ module: string; resource: string; action: string }[]> {
    const now = new Date();

    const rolePerms = await this.prisma.permission.findMany({
      where: { rolePermissions: { some: { role: { userRoles: { some: { userId } } } } } },
    });

    const denies = await this.prisma.userPermissionOverride.findMany({
      where: { userId, effect: 'DENY', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { permission: true },
    });
    const allows = await this.prisma.userPermissionOverride.findMany({
      where: { userId, effect: 'ALLOW', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { permission: true },
    });

    const key = (p: { module: string; resource: string; action: string }) => `${p.module}/${p.resource}/${p.action}`;
    const denySet = new Set(denies.map((d) => key(d.permission)));

    const result = new Map<string, { module: string; resource: string; action: string }>();
    for (const p of rolePerms) if (!denySet.has(key(p))) result.set(key(p), p);
    for (const a of allows) if (!denySet.has(key(a.permission))) result.set(key(a.permission), a.permission);

    return [...result.values()];
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
