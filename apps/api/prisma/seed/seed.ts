import { AgentActionTier, PrismaClient } from '@prisma/client';
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
  { name: SYSTEM_ROLES.SUBAGENT_ADMIN, description: 'M7 — portal nalog B2B subagenta (bilo kog nivoa), isključivo sopstvena mreža/rezervacije.' },
  { name: SYSTEM_ROLES.VODIC, description: 'M9 — vodič na terenu, isključivo sopstveni dodeljeni itinerar i gosti na tim polascima, offline-first mobilna sinhronizacija.' },
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

// M6 spec §7 — dozvole CRM (Nalogodavci, Gosti, lojalnost, komunikacija, post-trip anketa).
const M6_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M6', resource: 'client-account', action: 'VIEW', description: 'Uvid u nalogodavce' },
  { module: 'M6', resource: 'client-account', action: 'CREATE', description: 'Kreiranje nalogodavca' },
  { module: 'M6', resource: 'client-account', action: 'EDIT', description: 'Izmena nalogodavca' },
  { module: 'M6', resource: 'guest-profile', action: 'VIEW', description: 'Uvid u profile gostiju' },
  { module: 'M6', resource: 'guest-profile', action: 'CREATE', description: 'Kreiranje profila gosta' },
  { module: 'M6', resource: 'guest-profile', action: 'EDIT', description: 'Izmena profila gosta' },
  { module: 'M6', resource: 'loyalty-tier', action: 'VIEW', description: 'Uvid u nivoe lojalnosti' },
  { module: 'M6', resource: 'loyalty-tier', action: 'EDIT', description: 'Izmena definicija nivoa lojalnosti' },
  { module: 'M6', resource: 'loyalty-status', action: 'OVERRIDE', description: 'Ručna dodela nivoa lojalnosti mimo praga — obavezan razlog' },
  { module: 'M6', resource: 'communication-log', action: 'VIEW', description: 'Uvid u komunikaciju sa klijentima/gostima' },
  { module: 'M6', resource: 'communication-log', action: 'CREATE', description: 'Beleženje/slanje komunikacije' },
  { module: 'M6', resource: 'post-trip-survey', action: 'VIEW', description: 'Uvid u ankete posle putovanja' },
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

// M7 spec §10 — dozvole B2B modula (Subagenti). MANAGE_OWN_NETWORK je namerno dodeljena i
// Vlasnik/Direktor pored SUBAGENT_ADMIN (vidi komentar u SubagentsController) — spec §10 tabela
// navodi samo podrazumevanu dodelu po ulozi, ne isključivost.
const M7_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M7', resource: 'subagent', action: 'VIEW', description: 'Uvid u subagente (ceo lanac za agenciju, sopstveni+deca za SUBAGENT_ADMIN)' },
  { module: 'M7', resource: 'subagent', action: 'CREATE', description: 'Registracija novog Tier 1 subagenta' },
  { module: 'M7', resource: 'subagent', action: 'APPROVE', description: 'Odobravanje subagenta (PENDING_APPROVAL → ACTIVE) — postavlja kreditni limit' },
  { module: 'M7', resource: 'subagent', action: 'EDIT', description: 'Izmena kreditnog limita/statusa subagenta' },
  { module: 'M7', resource: 'subagent', action: 'MANAGE_OWN_NETWORK', description: 'Upravljanje sopstvenim direktnim sub-subagentima (kreiranje, provizija, pragovi obima)' },
  { module: 'M7', resource: 'commission-rebate', action: 'VIEW', description: 'Uvid u retroaktivne rabate provizije' },
  { module: 'M7', resource: 'commission-rebate', action: 'APPROVE', description: 'Odobrenje/odbijanje rabata — nikad AI agent' },
];

// M20 spec §5 — dozvole ugovora sa klijentima.
const M20_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M20', resource: 'client-contract', action: 'VIEW', description: 'Uvid u ugovore sa klijentima' },
  { module: 'M20', resource: 'client-contract', action: 'ACCEPT', description: 'Ručno evidentiranje prihvatanja (WET_SIGNATURE_SCAN) — gost prihvata sam kroz M8 tok, ne kroz ovu dozvolu' },
  { module: 'M20', resource: 'client-contract', action: 'VOID', description: 'Poništavanje ugovora — nikad AI agent' },
];

// M14 spec §5 — dozvole podrške/helpdeska. RESPOND je interno-samo (izmena statusa/prioriteta,
// STAFF/AI_DRAFT poruke, mark-sent); Gost/SUBAGENT_ADMIN dobijaju CREATE/VIEW ograničeno na
// sopstvene tikete na nivou API-ja (obim se sprovodi u TicketsService, ne kroz poseban ključ).
const M14_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M14', resource: 'ticket', action: 'VIEW', description: 'Uvid u tikete (svi za interni tim, sopstveni za Gosta/subagenta)' },
  { module: 'M14', resource: 'ticket', action: 'CREATE', description: 'Otvaranje tiketa i dodavanje sopstvene (REQUESTER) poruke' },
  { module: 'M14', resource: 'ticket', action: 'RESPOND', description: 'Izmena statusa/prioriteta/dodele, STAFF/AI_DRAFT poruke, mark-sent — nikad Gost/subagent' },
];

// M13 spec §6 — dozvole izveštavanja/BI. `resource` polje koristi format `report:podtip` (isti
// obrazac koji M1 spec §3.3 daje kao primer) — nema poseban ključ za POST /reconciliation/run
// (spec §7 kaže samo "Vlasnik/Direktor" tekstualno); gejtuje se u kodu sa report:profitability/VIEW,
// jedina dozvola sa istim tačnim krugom.
const M13_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M13', resource: 'report:profitability', action: 'VIEW', description: 'Profitabilnost po destinaciji/dobavljaču/kanalu; gejtuje i ručno pokretanje rekonsilijacije' },
  { module: 'M13', resource: 'report:sales', action: 'VIEW', description: 'Izveštaj prodaje' },
  { module: 'M13', resource: 'report:financial', action: 'VIEW', description: 'Finansijski izveštaji (FactPayment)' },
  { module: 'M13', resource: 'report:occupancy', action: 'VIEW', description: 'Operativna statistika smeštaja (broj osoba, noćenja, prodate sobe)' },
  { module: 'M13', resource: 'report:dynamic', action: 'VIEW', description: 'Dinamički drill-down izveštaj sa korisnički sastavljivim redosledom dimenzija' },
  { module: 'M13', resource: 'report:marketing', action: 'VIEW', description: 'Marketing performanse — atribucija rezervacije ka M12 sadržaju' },
];

// M12 spec §5 — dozvole marketing/sadržajnog engine-a. APPROVE_PUBLISH je namerno odvojena
// dozvola od CREATE_DRAFT — "nikad AI agent" (§5) je sprovedeno time što AI nacrti nastaju
// isključivo kroz product.published pretplatnika (in-process poziv, ne preko API-ja/dozvola),
// ne kroz ijedan endpoint koji zahteva ovu dozvolu.
const M12_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M12', resource: 'content', action: 'VIEW', description: 'Uvid u marketinški sadržaj/kalendar' },
  { module: 'M12', resource: 'content', action: 'CREATE_DRAFT', description: 'Ručno kreiranje/izmena nacrta i prevoda — AI nacrt ide mimo dozvola (event pretplatnik)' },
  { module: 'M12', resource: 'content', action: 'APPROVE_PUBLISH', description: 'Ljudsko odobrenje pre objave — nikad AI agent' },
  { module: 'M12', resource: 'channel-config', action: 'VIEW', description: 'Uvid u konfiguraciju distribucionih kanala' },
  { module: 'M12', resource: 'channel-config', action: 'EDIT', description: 'Izmena konfiguracije/kredencijala distribucionih kanala' },
];

// M16 spec §7 — dozvole MCP distribucije. MANAGE (kreiranje/aktivacija/suspendovanje klijenta)
// je dopuna otkrivena pri implementaciji (spec tabela je imala samo VIEW/APPROVE_READ_WRITE —
// bez nje niko ne bi mogao ni da registruje prvog MCP klijenta), APPROVE_READ_WRITE ostaje
// odvojena dozvola, "nikad automatski" (§3.1).
const M16_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M16', resource: 'mcp-client', action: 'VIEW', description: 'Uvid u registrovane MCP klijente' },
  { module: 'M16', resource: 'mcp-client', action: 'MANAGE', description: 'Registracija/aktivacija/suspendovanje MCP klijenta (implementaciona dopuna avgust 2026)' },
  { module: 'M16', resource: 'mcp-client', action: 'APPROVE_READ_WRITE', description: 'Odobrenje prelaska READ_ONLY→READ_WRITE — nikad automatski' },
];

// M9 spec §6 — dozvole mobilne aplikacije za vodiče na terenu (deo za goste nema sopstvene
// M9 dozvole, isti API-ji kao M8, §6 tabela).
const M9_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M9', resource: 'field-itinerary', action: 'VIEW', description: 'Uvid u sopstveni dodeljeni itinerar (GET /mobile/staff/my-itinerary)' },
  { module: 'M9', resource: 'field-checkin', action: 'CREATE', description: 'Slanje FieldCheckIn zapisa pri sinhronizaciji (POST /mobile/staff/sync)' },
  { module: 'M9', resource: 'field-incident', action: 'CREATE', description: 'Slanje FieldIncidentNote zapisa pri sinhronizaciji (POST /mobile/staff/sync)' },
];

// M15 spec §8 — dozvole AI agentske orkestracije. module-activation/ACTIVATE je namerno uska:
// Vlasnik/Direktor, nikad AI agent (sprovedeno i na nivou koda u ModuleActivationController,
// defense-in-depth §5 — actor_type = AI_AGENT se odbija čak i kad bi dozvola teorijski dozvolila).
const M15_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M15', resource: 'module-activation', action: 'VIEW', description: 'Uvid u status aktivacije M15 gate-ova (npr. M15_OMNISEARCH)' },
  { module: 'M15', resource: 'module-activation', action: 'ACTIVATE', description: 'Ljudska potvrda prelaska gate-a u ACTIVATED — nikad AI agent' },
  { module: 'M15', resource: 'agent-action-type', action: 'VIEW', description: 'Uvid u registar akcija AI agenata (poglavlje 4) i njihov nivo autonomije' },
  { module: 'M15', resource: 'agent-action-type', action: 'EDIT', description: 'Izmena nivoa autonomije registrovane akcije — nikad AI agent' },
  { module: 'M15', resource: 'agent-inbox', action: 'VIEW', description: 'Agregovan prikaz PROPOSE_THEN_APPROVE stavki koje čekaju ljudsko odobrenje kroz sve module' },
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
    ...M6_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M10_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M11_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M7_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M20_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M14_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M13_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M12_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M16_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M15_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.DIREKTOR]: [
    ...M1_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M2_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M3_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M4_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M5_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M6_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M10_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M11_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M7_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M20_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M14_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M13_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M12_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M16_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M15_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
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
    // M20 spec §5 — Sales Manager vidi i ručno evidentira prihvatanje ugovora (telefon/interni panel).
    { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    { module: 'M20', resource: 'client-contract', action: 'ACCEPT' },
    // M7 spec §10 — Sales Manager vidi ceo lanac subagenata i rabate provizije, ne odobrava ih.
    { module: 'M7', resource: 'subagent', action: 'VIEW' },
    { module: 'M7', resource: 'commission-rebate', action: 'VIEW' },
    // M6 spec §7 — Sales Manager vidi/uređuje CRM celog tima, definicije nivoa lojalnosti (VIEW).
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'CREATE' },
    { module: 'M6', resource: 'client-account', action: 'EDIT' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    { module: 'M6', resource: 'loyalty-tier', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'CREATE' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW' },
    // M14 spec §5 — Sales Manager vidi/odgovara na sve tikete (isti krug kao Vlasnik/Direktor).
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
    { module: 'M14', resource: 'ticket', action: 'RESPOND' },
    // M13 spec §6 — Sales Manager dobija sales/occupancy (nije cenovno osetljivo kao profitabilnost/dinamički).
    { module: 'M13', resource: 'report:sales', action: 'VIEW' },
    { module: 'M13', resource: 'report:occupancy', action: 'VIEW' },
    // M15 spec §8 — Agent Inbox: vidi stavke iz izvora za koje već ima VIEW (M5/M7/M14 iznad).
    { module: 'M15', resource: 'agent-inbox', action: 'VIEW' },
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
    // M20 spec §5 — Prodajni agent vidi i ručno evidentira prihvatanje ugovora sopstvenih klijenata.
    { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    { module: 'M20', resource: 'client-contract', action: 'ACCEPT' },
    // M6 spec §7 — Prodajni agent, ograničeno na sopstvene klijente (sprovodi se u servisu).
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'CREATE' },
    { module: 'M6', resource: 'client-account', action: 'EDIT' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    { module: 'M6', resource: 'loyalty-tier', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'CREATE' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW' },
    // M14 spec §5 — Prodajni agent dobija podrazumevano isti krug kao Sales Manager (spec §5:
    // "svi tiketi; Prodajni agent podrazumevano samo sopstveni klijenti, širi se izuzetkom") —
    // finije filtriranje po sopstvenim klijentima nije sprovedeno na nivou dozvole ovde, isti
    // obrazac kao M5/M6 (ownership bi se sprovodio u servisu, ako/kad se pokaže potreba).
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
    { module: 'M14', resource: 'ticket', action: 'RESPOND' },
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
    // M7 spec §10 tabela — commission-rebate/VIEW i APPROVE dodeljeni "Vlasnik, Direktor,
    // Računovođa" (direktan uticaj na novac, isti obrazac kao M10 fiskalni dokument). Nalaz
    // pri implementaciji M17 Faze 4 (avgust 2026): ova dodela nedostajala je iz seed.ts otkad
    // je M7 prvi put implementiran — Računovođa je imao dozvolu u spec tabeli, ne i u kodu.
    { module: 'M7', resource: 'commission-rebate', action: 'VIEW' },
    { module: 'M7', resource: 'commission-rebate', action: 'APPROVE' },
    // M6 spec §7 — Računovođa dobija VIEW radi fakturisanja, ništa drugo iz M6.
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    // M13 spec §6 — Računovođa dobija finansijski izveštaj (FactPayment).
    { module: 'M13', resource: 'report:financial', action: 'VIEW' },
  ],
  // M5 spec §10 tabela ("Gost — samo sopstvene") i M6 spec §7 ("Uloga Gost ima pristup
  // isključivo sopstvenom ClientAccount/GuestProfile") — dozvole same po sebi ne razlikuju
  // "sopstveno" od "tuđe" (M1 §3.6 to ne modeluje), pa ownership sprovode servisi/kontroleri
  // (M5 bookings.service.resolveApiContext, M6 client-accounts/guest-profiles kontroleri),
  // ne dozvola. Ova dodela je namerno dodata pri implementaciji M8 (avgust 2026) — do tada
  // GOST rola nije imala dozvole za M5/M6, pa registrovan gost ne bi mogao ni da pretraži
  // ni da rezerviše.
  [SYSTEM_ROLES.GOST]: [
    { module: 'M5', resource: 'itinerary', action: 'CREATE' },
    { module: 'M5', resource: 'itinerary', action: 'VIEW' },
    { module: 'M5', resource: 'itinerary', action: 'EDIT' },
    { module: 'M5', resource: 'quote', action: 'CREATE' },
    { module: 'M5', resource: 'quote', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'CREATE' },
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'MODIFY' },
    { module: 'M5', resource: 'booking', action: 'CANCEL' },
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'EDIT' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    // M20 spec §5 — Gost vidi isključivo sopstvene ugovore (M8 tok, prihvata sam kroz clickwrap,
    // ne kroz M20/client-contract/ACCEPT — ta dozvola je samo za ručno evidentiranje internog tima).
    { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    // M14 spec §5 — Gost otvara/vidi isključivo sopstvene tikete (ownership u TicketsService, ne
    // poseban ključ dozvole); nema RESPOND (ne može menjati status/prioritet ni slati STAFF poruke).
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
  ],
  // M7 spec §8/§10 — SUBAGENT_ADMIN: sopstveni Subagent/ClientAccount profil, sopstvene
  // rezervacije preko M5 (§5 provizija se primenjuje automatski), upravljanje sopstvenom mrežom.
  // Ownership (§6 vidljivost kroz hijerarhiju) se sprovodi u SubagentsService, ne ovde.
  [SYSTEM_ROLES.SUBAGENT_ADMIN]: [
    { module: 'M5', resource: 'itinerary', action: 'CREATE' },
    { module: 'M5', resource: 'itinerary', action: 'VIEW' },
    { module: 'M5', resource: 'itinerary', action: 'EDIT' },
    { module: 'M5', resource: 'quote', action: 'CREATE' },
    { module: 'M5', resource: 'quote', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'CREATE' },
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'MODIFY' },
    { module: 'M5', resource: 'booking', action: 'CANCEL' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    { module: 'M7', resource: 'subagent', action: 'VIEW' },
    { module: 'M7', resource: 'subagent', action: 'MANAGE_OWN_NETWORK' },
    // M14 spec §5 — SUBAGENT_ADMIN otvara/vidi isključivo sopstvene tikete (ownership preko
    // Subagent.client_account_id u TicketsService); nema RESPOND, isti krug kao Gost.
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
  ],
  // M9 spec §6 — VODIC dobija isključivo svoje tri M9 dozvole; ownership (sopstveni
  // assigned_guide_id) se sprovodi u FieldStaffService, ne ovde.
  [SYSTEM_ROLES.VODIC]: [
    { module: 'M9', resource: 'field-itinerary', action: 'VIEW' },
    { module: 'M9', resource: 'field-checkin', action: 'CREATE' },
    { module: 'M9', resource: 'field-incident', action: 'CREATE' },
  ],
};

async function main() {
  for (const entry of [
    ...M1_PERMISSIONS,
    ...M2_PERMISSIONS,
    ...M3_PERMISSIONS,
    ...M4_PERMISSIONS,
    ...M5_PERMISSIONS,
    ...M6_PERMISSIONS,
    ...M10_PERMISSIONS,
    ...M11_PERMISSIONS,
    ...M7_PERMISSIONS,
    ...M20_PERMISSIONS,
    ...M14_PERMISSIONS,
    ...M13_PERMISSIONS,
    ...M12_PERMISSIONS,
    ...M16_PERMISSIONS,
    ...M9_PERMISSIONS,
    ...M15_PERMISSIONS,
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

  await seedM15Omnisearch();
  await seedM15ActionRegistry();

  console.log(
    `Seed OK — ${SYSTEM_ROLE_SEED.length} sistemskih uloga, ${M1_PERMISSIONS.length} M1 dozvola, ${M2_PERMISSIONS.length} M2 dozvola, ${M3_PERMISSIONS.length} M3 dozvola, ${M4_PERMISSIONS.length} M4 dozvola, ${M5_PERMISSIONS.length} M5 dozvola, ${M6_PERMISSIONS.length} M6 dozvola, ${M10_PERMISSIONS.length} M10 dozvola, ${M11_PERMISSIONS.length} M11 dozvola, ${M7_PERMISSIONS.length} M7 dozvola, ${M20_PERMISSIONS.length} M20 dozvola, ${M14_PERMISSIONS.length} M14 dozvola, ${M13_PERMISSIONS.length} M13 dozvola, ${M12_PERMISSIONS.length} M12 dozvola, ${M16_PERMISSIONS.length} M16 dozvola, ${M9_PERMISSIONS.length} M9 dozvola, ${M15_PERMISSIONS.length} M15 dozvola.`,
  );
}

// M15 spec §4 (registar), §3 (ModuleAgentActivation), §6.5.1 (OmnisearchAgent) — prvi prolaz
// (avgust 2026) seeduje samo ono što omnisearch koristi: dva registar reda relevantna za
// omnisearch (drugi, external_review_lookup, je van obima — §6.5.6 čeka whitelist odluku
// vlasnika), jedan ModuleAgentActivation red koji STARTUJE kao NOT_READY (Vlasnik/Direktor ga
// ručno prevode preko PATCH /ai-orchestration/modules/:code/activation, nikad ovde), i jedan
// formalni M1 nalog (account_type = AI_AGENT) + AIAgent zapis koji nosi actor_type = AI_AGENT
// u audit logu svakog omnisearch upita.
async function seedM15Omnisearch() {
  // Compound unique (moduleCode, actionCode) ne prihvata `null` u Prisma `where` tipu za
  // globalne (module_code = null) redove (§4 "(globalno)") — ručni find+create/update umesto
  // upsert-a preko tog ključa.
  const existingActionType = await prisma.agentActionType.findFirst({
    where: { moduleCode: null, actionCode: 'omnisearch.query' },
  });
  if (existingActionType) {
    await prisma.agentActionType.update({ where: { id: existingActionType.id }, data: { tier: 'AUTONOMOUS' } });
  } else {
    await prisma.agentActionType.create({
      data: {
        moduleCode: null,
        actionCode: 'omnisearch.query',
        tier: 'AUTONOMOUS',
        sourceNote:
          'poglavlje 6.5 — isključivo pronalaženje/navigacija, nikad izvršenje radnje (potvrđena odluka vlasnika, avgust 2026)',
      },
    });
  }

  await prisma.moduleAgentActivation.upsert({
    where: { moduleCode: 'M15_OMNISEARCH' },
    update: {},
    create: { moduleCode: 'M15_OMNISEARCH', status: 'NOT_READY' },
  });

  const agentUser = await prisma.user.upsert({
    where: { email: 'omnisearch-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'omnisearch-agent@sistem.terminal-travel.local',
      fullName: 'OmnisearchAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      agentRole: 'OMNISEARCH_AGENT',
      moduleCode: null,
      status: 'DISABLED', // §3 ograda na nivou koda — ne može ACTIVE dok M15_OMNISEARCH != ACTIVATED
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });
}

// Compound unique (module_code, action_code) ne prihvata `null` u Prisma `where` tipu za
// globalne ("(globalno)" u spec tabeli §4) redove — isti find-first-pa-create/update obrazac
// kao seedM15Omnisearch iznad, izdvojen ovde jer ga koristi ceo registar ispod.
async function upsertAgentActionType(moduleCode: string | null, actionCode: string, tier: AgentActionTier, sourceNote: string) {
  const existing = await prisma.agentActionType.findFirst({ where: { moduleCode, actionCode } });
  if (existing) {
    await prisma.agentActionType.update({ where: { id: existing.id }, data: { tier, sourceNote } });
  } else {
    await prisma.agentActionType.create({ data: { moduleCode, actionCode, tier, sourceNote } });
  }
}

// M15 spec §4 v1.10 — pun registar (Faza 7 prvi prolaz: registar + sprovedba na nivou koda +
// Agent Inbox, avgust 2026). Namerno IZOSTAVLJA `M11 tourist_tax_remittance.draft`/`.submit` —
// stale red, M11 spec v2.0 je eTurista/boravišnu taksu eksplicitno uklonio iz obima modula
// ("zakonska obaveza smeštajnog objekta, ne agencije-touroperatora"), tabela ovde je usklađena
// u istom prolazu. `omnisearch.query` je već seedovan iznad (seedM15Omnisearch), ne ponavlja se.
async function seedM15ActionRegistry() {
  const rows: { moduleCode: string | null; actionCode: string; tier: AgentActionTier; sourceNote: string }[] = [
    { moduleCode: 'M3', actionCode: 'contract_period.release_warning', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M3 poglavlje 4.1' },
    { moduleCode: 'M3', actionCode: 'pricelist_import.extract', tier: 'AUTONOMOUS', sourceNote: 'M3 poglavlje 4.2.4' },
    { moduleCode: 'M3', actionCode: 'pricelist_import.approve_row', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M3 poglavlje 4.2.4' },
    { moduleCode: 'M3', actionCode: 'contract_period.low_capacity_alert', tier: 'AUTONOMOUS', sourceNote: 'M3 poglavlje 4.3 — čisto informativan signal na 1–2 preostale jedinice, ne blokira prodaju' },
    { moduleCode: 'M5', actionCode: 'supplier_manifest.draft', tier: 'AUTONOMOUS', sourceNote: 'M5 poglavlje 8.4, 8.7 — priprema nacrta i njeno prioritetno isticanje ostaju čisto informativni' },
    { moduleCode: 'M5', actionCode: 'supplier_manifest.send', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M5 poglavlje 8.4' },
    { moduleCode: 'M5', actionCode: 'booking_item.cancel_duplicate_check', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M5 poglavlje 6.4 — deterministički fuzzy-match, upozorenje pre storna zahteva svesnu potvrdu operatera' },
    { moduleCode: 'M6', actionCode: 'communication.draft', tier: 'AUTONOMOUS', sourceNote: 'M6 poglavlje 4' },
    { moduleCode: 'M6', actionCode: 'communication.send_with_price_or_obligation', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M6 poglavlje 4' },
    { moduleCode: 'M7', actionCode: 'commission_rebate.calculate_draft', tier: 'AUTONOMOUS', sourceNote: 'M7 poglavlje 3.2' },
    { moduleCode: 'M7', actionCode: 'commission_rebate.apply', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M7 poglavlje 3.2' },
    { moduleCode: 'M7', actionCode: 'subagent_chat.search', tier: 'AUTONOMOUS', sourceNote: 'M7 poglavlje 2.0.4c — čitanje kataloga, isti obim kao portal' },
    { moduleCode: 'M7', actionCode: 'subagent_chat.quote_draft', tier: 'AUTONOMOUS', sourceNote: 'M7 poglavlje 2.0.4c — deterministička cena, ništa obavezujuće' },
    { moduleCode: 'M7', actionCode: 'subagent_chat.booking_confirm', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M7 poglavlje 2.0.4c — odobrava isključivo subagent sopstvenim nalogom (Gejt A)' },
    { moduleCode: 'M10', actionCode: 'fiscal_document.draft', tier: 'AUTONOMOUS', sourceNote: 'M10 poglavlje 6' },
    { moduleCode: 'M10', actionCode: 'fiscal_document.submit', tier: 'NEVER_AUTONOMOUS', sourceNote: 'M10 poglavlje 6' },
    { moduleCode: 'M11', actionCode: 'travel_guarantee.expiry_reminder', tier: 'AUTONOMOUS', sourceNote: 'M11 poglavlje 4' },
    { moduleCode: 'M11', actionCode: 'travel_guarantee.edit', tier: 'NEVER_AUTONOMOUS', sourceNote: 'M11 poglavlje 4' },
    { moduleCode: 'M11', actionCode: 'travel_guarantee.utilization_warning', tier: 'AUTONOMOUS', sourceNote: 'M11 poglavlje 4.2 — upozorenje na 80% praga, ne tvrda blokada' },
    { moduleCode: 'M12', actionCode: 'content.draft', tier: 'AUTONOMOUS', sourceNote: 'M12 poglavlje 3' },
    { moduleCode: 'M12', actionCode: 'content.approve_publish', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M12 poglavlje 3' },
    { moduleCode: 'M13', actionCode: 'insight.surface_trend', tier: 'AUTONOMOUS', sourceNote: 'M13 poglavlje 5' },
    { moduleCode: 'M14', actionCode: 'ticket_response.draft', tier: 'AUTONOMOUS', sourceNote: 'M14 poglavlje 4' },
    { moduleCode: 'M14', actionCode: 'ticket_response.send_with_price_or_obligation', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M14 poglavlje 4' },
    { moduleCode: 'M14', actionCode: 'complaint.escalate_notify', tier: 'AUTONOMOUS', sourceNote: 'M14 poglavlje 3.1 — čisto informativna eskalacija (ZZP rok), ne izvršenje' },
    { moduleCode: 'M20', actionCode: 'client_contract.generate_draft', tier: 'AUTONOMOUS', sourceNote: 'M20 poglavlje 4' },
    { moduleCode: null, actionCode: 'contract.sign', tier: 'NEVER_AUTONOMOUS', sourceNote: 'poglavlje 7 Master dokumenta' },
    { moduleCode: null, actionCode: 'money.transfer', tier: 'NEVER_AUTONOMOUS', sourceNote: 'poglavlje 7 Master dokumenta' },
    { moduleCode: null, actionCode: 'license_data.edit', tier: 'NEVER_AUTONOMOUS', sourceNote: 'poglavlje 7 Master dokumenta' },
    { moduleCode: 'M18', actionCode: 'trend_research.draft', tier: 'AUTONOMOUS', sourceNote: 'M18 poglavlje 5' },
    { moduleCode: 'M18', actionCode: 'trend_research.apply_to_docs', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M18 poglavlje 5' },
    { moduleCode: 'M18', actionCode: 'health_signal.detect_and_notify', tier: 'AUTONOMOUS', sourceNote: 'M18 poglavlje 2 — čisto informativno, isporuka upozorenja nije poslovna odluka' },
    { moduleCode: 'M21', actionCode: 'help_question.answer', tier: 'AUTONOMOUS', sourceNote: 'M21 poglavlje 5.2 — isključivo pretraga objavljenog sadržaja, bez pristupa živim podacima' },
    { moduleCode: 'M21', actionCode: 'help_escalation.create_ticket', tier: 'AUTONOMOUS', sourceNote: 'M21 poglavlje 5.3 — korisnik koji pita sam potvrđuje eskalaciju sopstvenog pitanja' },
    { moduleCode: 'M21', actionCode: 'help_article_suggestion.draft', tier: 'AUTONOMOUS', sourceNote: 'M21 poglavlje 5.4 — čisto pripremni nacrt iz obrasca ponovljenih pitanja' },
    { moduleCode: 'M21', actionCode: 'help_article_suggestion.approve', tier: 'PROPOSE_THEN_APPROVE', sourceNote: 'M21 poglavlje 5.4' },
    { moduleCode: 'M23', actionCode: 'knowledge_question.answer', tier: 'AUTONOMOUS', sourceNote: 'M23 poglavlje 3.2 — isključivo pretraga objavljenog sadržaja' },
    { moduleCode: 'M23', actionCode: 'knowledge_article.research_draft', tier: 'AUTONOMOUS', sourceNote: 'M23 poglavlje 4c — priprema ArticleRevision nacrt iz odobrenih izvora' },
    { moduleCode: 'M23', actionCode: 'knowledge_article.publish', tier: 'NEVER_AUTONOMOUS', sourceNote: 'M23 poglavlje 6 — isto tako article-source.approve/article-revision.approve, nikad AI' },
    { moduleCode: null, actionCode: 'omnisearch.external_review_lookup', tier: 'AUTONOMOUS', sourceNote: 'poglavlje 6.5.6 — čisto informativno, ograničeno na whitelist ExternalReviewSource' },
  ];

  for (const row of rows) {
    await upsertAgentActionType(row.moduleCode, row.actionCode, row.tier, row.sourceNote);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
