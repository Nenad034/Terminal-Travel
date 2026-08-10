import { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES } from '../../src/modules/m1-core-identitet/roles/system-roles.constants';

const prisma = new PrismaClient();

// M1 spec §4 — sedam podrazumevanih uloga (polazni šabloni). Opseg dozvola po
// modulu se dopunjuje kad svaki modul dođe na red (§9 "Otvoreno za dalje") —
// ovde se samo kreiraju same uloge, ne pune dozvole svih 23 modula.
const SYSTEM_ROLE_SEED: { name: string; description: string }[] = [
  { name: SYSTEM_ROLES.VLASNIK, description: 'Pristup svemu, uključujući upravljanje ulogama i pojedinačnim izuzecima.' },
  { name: SYSTEM_ROLES.DIREKTOR, description: 'Pristup svemu osim promena vezanih za licencu agencije i vlasničku strukturu.' },
  { name: SYSTEM_ROLES.HR, description: 'M1 — upravljanje korisnicima i njihovim ulogama unutar tima.' },
  { name: SYSTEM_ROLES.SALES_MANAGER, description: 'Uvid u rezervacije/CRM celog prodajnog tima, izveštaji o prodaji (M13, read-only).' },
  { name: SYSTEM_ROLES.PRODAJNI_AGENT, description: 'Katalog (read), Rezervacije i CRM — ograničeno na sopstvene klijente/rezervacije.' },
  { name: SYSTEM_ROLES.RACUNOVODJA, description: 'M10 (Finansije/fiskalizacija), M11 (Compliance), read-only uvid u rezervacije.' },
  { name: SYSTEM_ROLES.GOST, description: 'Isključivo sopstveni profil i sopstvene rezervacije (M6/M8).' },
];

// M1 spec §3.3 — M1 sopstvene dozvole (upravljanje korisnicima/ulogama/audit logom).
const M1_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M1', resource: 'user', action: 'VIEW', description: 'Uvid u listu korisnika' },
  { module: 'M1', resource: 'user', action: 'CREATE', description: 'Pozivanje novog korisnika' },
  { module: 'M1', resource: 'user', action: 'EDIT', description: 'Izmena korisnika/dodela uloga' },
  { module: 'M1', resource: 'user', action: 'DELETE', description: 'Suspendovanje korisnika (meko gašenje)' },
  { module: 'M1', resource: 'role', action: 'VIEW', description: 'Uvid u kataloge uloga' },
  { module: 'M1', resource: 'role', action: 'CREATE', description: 'Kreiranje nove uloge' },
  { module: 'M1', resource: 'role', action: 'EDIT', description: 'Izmena postojeće uloge' },
  { module: 'M1', resource: 'permission-override', action: 'VIEW', description: 'Uvid u pojedinačne izuzetke korisnika' },
  { module: 'M1', resource: 'permission-override', action: 'CREATE', description: 'Dodela/oduzimanje pojedinačnog izuzetka' },
  { module: 'M1', resource: 'audit-log', action: 'VIEW', description: 'Uvid u audit log' },
];

// Podrazumevana dodela — Vlasnik/Direktor dobijaju sve M1 dozvole; HR upravlja korisnicima.
const DEFAULT_ROLE_PERMISSIONS: Record<string, { resource: string; action: string }[]> = {
  [SYSTEM_ROLES.VLASNIK]: M1_PERMISSIONS.map((p) => ({ resource: p.resource, action: p.action })),
  [SYSTEM_ROLES.DIREKTOR]: M1_PERMISSIONS.map((p) => ({ resource: p.resource, action: p.action })),
  [SYSTEM_ROLES.HR]: [
    { resource: 'user', action: 'VIEW' },
    { resource: 'user', action: 'CREATE' },
    { resource: 'user', action: 'EDIT' },
    { resource: 'user', action: 'DELETE' },
    { resource: 'role', action: 'VIEW' },
  ],
};

async function main() {
  for (const entry of M1_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_resource_action: { module: entry.module, resource: entry.resource, action: entry.action } },
      update: { description: entry.description },
      create: entry,
    });
  }

  for (const roleSeed of SYSTEM_ROLE_SEED) {
    const role = await prisma.role.upsert({
      where: { name: roleSeed.name },
      update: { description: roleSeed.description },
      create: { name: roleSeed.name, description: roleSeed.description, isSystemRole: true },
    });

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[roleSeed.name] ?? [];
    for (const perm of defaultPerms) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_resource_action: { module: 'M1', resource: perm.resource, action: perm.action } },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log(`Seed OK — ${SYSTEM_ROLE_SEED.length} sistemskih uloga, ${M1_PERMISSIONS.length} M1 dozvola.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
