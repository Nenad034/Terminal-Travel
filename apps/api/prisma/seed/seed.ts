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

// M2 spec §6 — dozvole kataloga proizvoda.
const M2_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M2', resource: 'product', action: 'VIEW', description: 'Uvid u katalog proizvoda' },
  { module: 'M2', resource: 'product', action: 'CREATE', description: 'Ručno kreiranje CONTRACTED proizvoda' },
  { module: 'M2', resource: 'product', action: 'EDIT', description: 'Izmena proizvoda' },
  { module: 'M2', resource: 'product', action: 'PUBLISH', description: 'Objava proizvoda / izmena vidljivosti po kanalu' },
  { module: 'M2', resource: 'product', action: 'DELETE', description: 'Arhiviranje proizvoda (meko gašenje)' },
  { module: 'M2', resource: 'product-translation', action: 'EDIT', description: 'Izmena prevoda proizvoda' },
  { module: 'M2', resource: 'product-content-import', action: 'CREATE', description: 'Pokretanje AI-potpomognutog uvoza sadržaja' },
  { module: 'M2', resource: 'product-content-import', action: 'VIEW', description: 'Uvid u uvoze sadržaja' },
  { module: 'M2', resource: 'product-content-import', action: 'REVIEW_FIELD', description: 'Odobri/odbij/izmeni izvučenu stavku uvoza' },
];

// M3 spec §5 — dozvole ugovaranja i alotmana.
const M3_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M3', resource: 'supplier', action: 'VIEW', description: 'Uvid u dobavljače' },
  { module: 'M3', resource: 'supplier', action: 'CREATE', description: 'Kreiranje dobavljača' },
  { module: 'M3', resource: 'supplier', action: 'EDIT', description: 'Izmena dobavljača' },
  { module: 'M3', resource: 'supplier-contact', action: 'VIEW', description: 'Uvid u kontakt-osobe dobavljača' },
  { module: 'M3', resource: 'supplier-contact', action: 'CREATE', description: 'Dodavanje kontakt-osobe dobavljača' },
  { module: 'M3', resource: 'supplier-contact', action: 'EDIT', description: 'Izmena kontakt-osobe dobavljača' },
  { module: 'M3', resource: 'contract', action: 'VIEW', description: 'Uvid u ugovore' },
  { module: 'M3', resource: 'contract', action: 'CREATE', description: 'Kreiranje ugovora' },
  { module: 'M3', resource: 'contract', action: 'EDIT', description: 'Izmena ugovora' },
  { module: 'M3', resource: 'contract', action: 'DELETE', description: 'Brisanje/raskid ugovora' },
  { module: 'M3', resource: 'contract-period', action: 'VIEW', description: 'Uvid u periode/alotman (uklj. preostali kapacitet)' },
  { module: 'M3', resource: 'contract-period', action: 'EDIT', description: 'Izmena cena/alotmana/rokova perioda' },
  { module: 'M3', resource: 'pricelist-import', action: 'CREATE', description: 'Pokretanje AI uvoza cenovnika' },
  { module: 'M3', resource: 'pricelist-import', action: 'VIEW', description: 'Uvid u uvoze cenovnika' },
  { module: 'M3', resource: 'pricelist-import', action: 'APPROVE_ROW', description: 'Odobri/odbij red iz uvoza cenovnika' },
];

// Podrazumevana dodela — Vlasnik/Direktor dobijaju sve M1+M2+M3 dozvole; HR upravlja korisnicima;
// Sales Manager/Prodajni agent dobijaju samo VIEW nivoe iz M2/M3 (M2 spec §6, M3 spec §5).
const DEFAULT_ROLE_PERMISSIONS: Record<string, { module: string; resource: string; action: string }[]> = {
  [SYSTEM_ROLES.VLASNIK]: [
    ...M1_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M2_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M3_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.DIREKTOR]: [
    ...M1_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M2_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M3_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.HR]: [
    { module: 'M1', resource: 'user', action: 'VIEW' },
    { module: 'M1', resource: 'user', action: 'CREATE' },
    { module: 'M1', resource: 'user', action: 'EDIT' },
    { module: 'M1', resource: 'user', action: 'DELETE' },
    { module: 'M1', resource: 'role', action: 'VIEW' },
  ],
  [SYSTEM_ROLES.SALES_MANAGER]: [
    { module: 'M2', resource: 'product', action: 'VIEW' },
    { module: 'M3', resource: 'supplier', action: 'VIEW' },
    { module: 'M3', resource: 'supplier-contact', action: 'VIEW' },
    { module: 'M3', resource: 'supplier-contact', action: 'CREATE' },
    { module: 'M3', resource: 'supplier-contact', action: 'EDIT' },
    { module: 'M3', resource: 'contract', action: 'VIEW' },
    { module: 'M3', resource: 'contract-period', action: 'VIEW' },
  ],
  [SYSTEM_ROLES.PRODAJNI_AGENT]: [
    { module: 'M2', resource: 'product', action: 'VIEW' },
    { module: 'M3', resource: 'supplier', action: 'VIEW' },
    { module: 'M3', resource: 'contract-period', action: 'VIEW' },
  ],
};

async function main() {
  for (const entry of [...M1_PERMISSIONS, ...M2_PERMISSIONS, ...M3_PERMISSIONS]) {
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
        where: { module_resource_action: { module: perm.module, resource: perm.resource, action: perm.action } },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log(
    `Seed OK — ${SYSTEM_ROLE_SEED.length} sistemskih uloga, ${M1_PERMISSIONS.length} M1 dozvola, ${M2_PERMISSIONS.length} M2 dozvola, ${M3_PERMISSIONS.length} M3 dozvola.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
