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

// M4 spec §6 — dozvole integracija; pretežno mašina-mašini sloj, dozvole su samo za
// administrativni uvid/podešavanje provajdera (interni operativni pozivi §7 nemaju
// posebnu dozvolu, samo JwtAuthGuard — vidi IntegrationsController).
const M4_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M4', resource: 'provider-config', action: 'VIEW', description: 'Uvid u konfiguraciju spoljnih provajdera' },
  { module: 'M4', resource: 'provider-config', action: 'CREATE', description: 'Dodavanje konfiguracije provajdera' },
  { module: 'M4', resource: 'provider-config', action: 'EDIT', description: 'Izmena konfiguracije/kredencijala provajdera' },
  { module: 'M4', resource: 'provider-call-log', action: 'VIEW', description: 'Uvid u operativni log poziva ka provajderima' },
];

// M5 spec §10 — dozvole rezervacija i toka prodaje.
const M5_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M5', resource: 'itinerary', action: 'CREATE', description: 'Sastavljanje novog putovanja (Itinerary)' },
  { module: 'M5', resource: 'itinerary', action: 'VIEW', description: 'Uvid u sastavljena putovanja' },
  { module: 'M5', resource: 'itinerary', action: 'EDIT', description: 'Izmena segmenata putovanja / konverzija u Ponudu' },
  { module: 'M5', resource: 'quote', action: 'CREATE', description: 'Kreiranje Ponude' },
  { module: 'M5', resource: 'quote', action: 'VIEW', description: 'Uvid u Ponude' },
  { module: 'M5', resource: 'booking', action: 'CREATE', description: 'Potvrda rezervacije (Ponuda → Rezervacija)' },
  { module: 'M5', resource: 'booking', action: 'VIEW', description: 'Uvid u rezervacije i kalendar rezervacija' },
  { module: 'M5', resource: 'booking', action: 'MODIFY', description: 'Izmena rezervacije/statusa plaćanja' },
  { module: 'M5', resource: 'booking', action: 'CANCEL', description: 'Otkazivanje rezervacije/stavke' },
  { module: 'M5', resource: 'markup-rule', action: 'VIEW', description: 'Uvid u pravila marže' },
  { module: 'M5', resource: 'markup-rule', action: 'EDIT', description: 'Izmena pravila marže' },
  { module: 'M5', resource: 'supplier-announcement-rule', action: 'VIEW', description: 'Uvid u pravila automatske pripreme najave dobavljaču' },
  { module: 'M5', resource: 'supplier-announcement-rule', action: 'EDIT', description: 'Izmena pravila automatske pripreme najave dobavljaču' },
  { module: 'M5', resource: 'voucher', action: 'OVERRIDE_ISSUE', description: 'Izdavanje vaučera bez pune uplate (izuzetak)' },
  { module: 'M5', resource: 'supplier-manifest', action: 'VIEW', description: 'Uvid u operativne liste za dobavljače' },
  { module: 'M5', resource: 'supplier-manifest', action: 'CREATE', description: 'Priprema nacrta operativne liste' },
  { module: 'M5', resource: 'supplier-manifest', action: 'SEND', description: 'Slanje operativne liste dobavljaču' },
  { module: 'M5', resource: 'supplier-change-notice', action: 'CREATE', description: 'Priprema nacrta najave izmene/storna dobavljaču' },
  { module: 'M5', resource: 'supplier-change-notice', action: 'SEND', description: 'Slanje najave izmene/storna dobavljaču' },
  { module: 'M5', resource: 'supplier-confirmation', action: 'CONFIRM', description: 'Ručna potvrda prijema od dobavljača (klik na predloženu vezu sa mejlom)' },
];

// M10 spec §9 — dozvole finansija/fiskalizacije. Svaki SUBMIT/APPROVE/EXECUTE je eksplicitno
// "nikad AI agent" — sprovedeno i na nivou koda (servisi zahtevaju actor.userId), dozvola je
// druga linija odbrane.
const M10_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M10', resource: 'fiscal-document', action: 'VIEW', description: 'Uvid u fiskalne dokumente' },
  { module: 'M10', resource: 'fiscal-document', action: 'CREATE_DRAFT', description: 'Priprema nacrta fiskalnog dokumenta (sme i AI agent)' },
  { module: 'M10', resource: 'fiscal-document', action: 'SUBMIT', description: 'Slanje ka SEF/ESIR i storno — nikad AI agent' },
  { module: 'M10', resource: 'payment', action: 'VIEW', description: 'Uvid u uplate' },
  { module: 'M10', resource: 'payment', action: 'RECORD', description: 'Ručan unos prijema uplate (BANK_TRANSFER/CASH)' },
  { module: 'M10', resource: 'exchange-rate', action: 'VIEW', description: 'Uvid u kurseve' },
  { module: 'M10', resource: 'exchange-rate', action: 'EDIT', description: 'Ručan unos dnevnog kursa' },
  { module: 'M10', resource: 'payment-gateway-config', action: 'VIEW', description: 'Uvid u konfiguraciju platnog provajdera' },
  { module: 'M10', resource: 'payment-gateway-config', action: 'EDIT', description: 'Podešavanje kredencijala platnog provajdera' },
  { module: 'M10', resource: 'supplier-obligation', action: 'VIEW', description: 'Uvid u obaveze prema dobavljačima' },
  { module: 'M10', resource: 'supplier-obligation', action: 'APPROVE', description: 'Odobrenje/plaćanje obaveze prema dobavljaču — nikad AI agent' },
  { module: 'M10', resource: 'supplier-payment-instruction', action: 'VIEW', description: 'Uvid u instrukcije za isplatu dobavljaču' },
  { module: 'M10', resource: 'supplier-payment-instruction', action: 'EXECUTE', description: 'Izvršenje isplate dobavljaču — nikad AI agent' },
  { module: 'M10', resource: 'refund-instruction', action: 'VIEW', description: 'Uvid u zahteve za refundaciju gosta' },
  { module: 'M10', resource: 'refund-instruction', action: 'APPROVE', description: 'Odobrenje refundacije — nikad AI agent' },
  { module: 'M10', resource: 'refund-instruction', action: 'EXECUTE', description: 'Izvršenje refundacije — nikad AI agent' },
  { module: 'M10', resource: 'payment-terms-config', action: 'VIEW', description: 'Uvid u politiku akontacije/balansa' },
  { module: 'M10', resource: 'payment-terms-config', action: 'EDIT', description: 'Izmena globalne politike akontacije/balansa' },
  { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW', description: 'Uvid u rokove naplate po rezervaciji' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'VIEW', description: 'Uvid u uvoze ulaznih faktura dobavljača' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'CREATE', description: 'Pokretanje uvoza/AI ekstrakcije ulazne fakture (sme i AI agent za ekstrakciju)' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'REVIEW', description: 'Potvrda/ručno mapiranje reda uvoza — nikad AI agent' },
];

// M11 spec §4 — dozvole regulatornog modula (garancija putovanja, evidencije za inspekciju).
// travel-guarantee-registration/RETRY je mehanička dopuna (avgust 2026, nije bilo eksplicitno u
// spec §4 tabeli) — VIEW ne sme da otključa mutirajuću akciju (ručno ponavljanje CIS poziva),
// dodeljeno samo Vlasnik/Direktor isti krug kao travel-guarantee/EDIT.
const M11_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M11', resource: 'travel-guarantee', action: 'VIEW', description: 'Uvid u trenutnu garanciju putovanja i iskorišćenost' },
  { module: 'M11', resource: 'travel-guarantee', action: 'EDIT', description: 'Ručna izmena/obnavljanje garancije putovanja — nikad AI agent' },
  { module: 'M11', resource: 'travel-guarantee-registration', action: 'VIEW', description: 'Uvid u CIS registracije garancije po rezervaciji' },
  { module: 'M11', resource: 'travel-guarantee-registration', action: 'RETRY', description: 'Ručno ponavljanje CIS registracije/skidanja opterećenja' },
  { module: 'M11', resource: 'inspection-export', action: 'CREATE', description: 'Generisanje izvoza evidencije za inspekciju' },
];

// Podrazumevana dodela — Vlasnik/Direktor dobijaju sve M1+M2+M3+M4 dozvole; HR upravlja korisnicima;
// Sales Manager/Prodajni agent dobijaju samo VIEW nivoe iz M2/M3 (M2 spec §6, M3 spec §5).
const DEFAULT_ROLE_PERMISSIONS: Record<string, { module: string; resource: string; action: string }[]> = {
  [SYSTEM_ROLES.VLASNIK]: [
    ...M1_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M2_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M3_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M4_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M5_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M10_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M11_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.DIREKTOR]: [
    ...M1_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M2_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M3_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M4_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M5_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M10_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M11_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
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
    // M5 spec §10 — Sales Manager vidi sve rezervacije (ne samo sopstvene), i deo je
    // kruga koji sme da šalje operativne liste/najave dobavljaču.
    { module: 'M5', resource: 'itinerary', action: 'CREATE' },
    { module: 'M5', resource: 'itinerary', action: 'VIEW' },
    { module: 'M5', resource: 'itinerary', action: 'EDIT' },
    { module: 'M5', resource: 'quote', action: 'CREATE' },
    { module: 'M5', resource: 'quote', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'CREATE' },
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'MODIFY' },
    { module: 'M5', resource: 'booking', action: 'CANCEL' },
    { module: 'M5', resource: 'supplier-manifest', action: 'VIEW' },
    { module: 'M5', resource: 'supplier-manifest', action: 'CREATE' },
    { module: 'M5', resource: 'supplier-manifest', action: 'SEND' },
    { module: 'M5', resource: 'supplier-change-notice', action: 'CREATE' },
    { module: 'M5', resource: 'supplier-change-notice', action: 'SEND' },
    { module: 'M5', resource: 'supplier-confirmation', action: 'CONFIRM' },
    // M11 spec §4 — Sales Manager vidi CIS registracije garancije po rezervaciji (read-only).
    { module: 'M11', resource: 'travel-guarantee-registration', action: 'VIEW' },
  ],
  [SYSTEM_ROLES.PRODAJNI_AGENT]: [
    { module: 'M2', resource: 'product', action: 'VIEW' },
    { module: 'M3', resource: 'supplier', action: 'VIEW' },
    { module: 'M3', resource: 'contract-period', action: 'VIEW' },
    // M5 spec §10 — Prodajni agent, podrazumevano ograničen na sopstvene klijente/rezervacije
    // (sprovodi se u BookingsService, ne ovde — ovo je samo katalog dozvola). Bez SEND
    // za operativne liste/najave (§10 — taj krug je Vlasnik/Direktor/Sales Manager).
    { module: 'M5', resource: 'itinerary', action: 'CREATE' },
    { module: 'M5', resource: 'itinerary', action: 'VIEW' },
    { module: 'M5', resource: 'itinerary', action: 'EDIT' },
    { module: 'M5', resource: 'quote', action: 'CREATE' },
    { module: 'M5', resource: 'quote', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'CREATE' },
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'MODIFY' },
    { module: 'M5', resource: 'booking', action: 'CANCEL' },
    { module: 'M5', resource: 'supplier-manifest', action: 'VIEW' },
    { module: 'M5', resource: 'supplier-manifest', action: 'CREATE' },
    { module: 'M5', resource: 'supplier-confirmation', action: 'CONFIRM' },
    // M10 spec §9 — client-payment-schedule/VIEW je jedina M10 dozvola koju dobija
    // Prodajni agent (uvid u rok naplate sopstvenih rezervacija), ništa drugo iz M10.
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW' },
    // M11 spec §4 — Prodajni agent vidi CIS registracije garancije po sopstvenim rezervacijama.
    { module: 'M11', resource: 'travel-guarantee-registration', action: 'VIEW' },
  ],
  // M10 spec §9 — Računovođa dobija sve VIEW/CREATE_DRAFT/RECORD/APPROVE/REVIEW dozvole, ali
  // NIKAD SUBMIT/EXECUTE za payment-gateway-config, supplier-payment-instruction, ni
  // refund-instruction (tj. Vlasnik/Direktor su jedini koji izvršavaju stvaran prenos novca).
  [SYSTEM_ROLES.RACUNOVODJA]: [
    { module: 'M10', resource: 'fiscal-document', action: 'VIEW' },
    { module: 'M10', resource: 'fiscal-document', action: 'CREATE_DRAFT' },
    { module: 'M10', resource: 'fiscal-document', action: 'SUBMIT' },
    { module: 'M10', resource: 'payment', action: 'VIEW' },
    { module: 'M10', resource: 'payment', action: 'RECORD' },
    { module: 'M10', resource: 'exchange-rate', action: 'VIEW' },
    { module: 'M10', resource: 'exchange-rate', action: 'EDIT' },
    { module: 'M10', resource: 'supplier-obligation', action: 'VIEW' },
    { module: 'M10', resource: 'supplier-obligation', action: 'APPROVE' },
    { module: 'M10', resource: 'supplier-payment-instruction', action: 'VIEW' },
    { module: 'M10', resource: 'refund-instruction', action: 'VIEW' },
    { module: 'M10', resource: 'payment-terms-config', action: 'VIEW' },
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW' },
    { module: 'M10', resource: 'supplier-invoice-import', action: 'VIEW' },
    { module: 'M10', resource: 'supplier-invoice-import', action: 'CREATE' },
    { module: 'M10', resource: 'supplier-invoice-import', action: 'REVIEW' },
    // M11 spec §4 — Računovođa generiše izvoze za inspekciju.
    { module: 'M11', resource: 'inspection-export', action: 'CREATE' },
  ],
};

async function main() {
  for (const entry of [
    ...M1_PERMISSIONS,
    ...M2_PERMISSIONS,
    ...M3_PERMISSIONS,
    ...M4_PERMISSIONS,
    ...M5_PERMISSIONS,
    ...M10_PERMISSIONS,
    ...M11_PERMISSIONS,
  ]) {
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
    `Seed OK — ${SYSTEM_ROLE_SEED.length} sistemskih uloga, ${M1_PERMISSIONS.length} M1 dozvola, ${M2_PERMISSIONS.length} M2 dozvola, ${M3_PERMISSIONS.length} M3 dozvola, ${M4_PERMISSIONS.length} M4 dozvola, ${M5_PERMISSIONS.length} M5 dozvola, ${M10_PERMISSIONS.length} M10 dozvola, ${M11_PERMISSIONS.length} M11 dozvola.`,
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
