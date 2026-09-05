import { AgentActionTier, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
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
  // M2 spec §2.1c (dopuna 5.9.2026) — CRUD nad DestinationProfile (tip destinacije + aktivnosti).
  { module: 'M2', resource: 'destination-profile', action: 'VIEW', description: 'Uvid u profile destinacija (tip/aktivnosti)' },
  { module: 'M2', resource: 'destination-profile', action: 'CREATE', description: 'Kreiranje profila destinacije' },
  { module: 'M2', resource: 'destination-profile', action: 'EDIT', description: 'Izmena tipa destinacije / aktivnosti' },
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
  // M5 spec §6.6 (31.8.2026) — VIEW_ALL konvencija (M1 §3.9a): podrazumevano svi sa VIEW imaju i
  // VIEW_ALL, sužavanje ide preko DENY override-a za pojedinca kome treba.
  { module: 'M5', resource: 'booking', action: 'VIEW_ALL', description: 'Vidljivost svih rezervacija (ne samo sopstvenih po vlasništvu/zaduženju)' },
  // M5 spec §6.5 (31.8.2026) — vlasništvo i zaduženje rezervacije.
  { module: 'M5', resource: 'booking', action: 'TRANSFER_OWNERSHIP', description: 'Prenos vlasništva rezervacije (trenutni vlasnik ili Vlasnik/Direktor, nikad Sales Manager)' },
  { module: 'M5', resource: 'booking', action: 'TRANSFER_ASSIGNMENT', description: 'Predlog/otkazivanje predaje zaduženja rezervacije' },
  { module: 'M5', resource: 'booking', action: 'ACCEPT_ASSIGNMENT', description: 'Prihvatanje/odbijanje predloga predaje zaduženja rezervacije' },
  // M5 spec §4.6 (1.9.2026) — interne beleške uz rezervaciju; nikad AI nalog.
  { module: 'M5', resource: 'booking-note', action: 'CREATE', description: 'Dodavanje interne beleške uz rezervaciju' },
  { module: 'M5', resource: 'booking-note', action: 'DELETE', description: 'Brisanje interne beleške (autor sopstvenu, Vlasnik/Direktor bilo koju)' },
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
  // Dopuna 31.8.2026 (M1 §3.9a konvencija) — isti obrazac kao M5 §6.6.
  { module: 'M6', resource: 'client-account', action: 'VIEW_ALL', description: 'Vidljivost svih nalogodavaca (ne samo onih čije rezervacije pozivalac poseduje/vodi)' },
  { module: 'M6', resource: 'post-trip-survey', action: 'VIEW_ALL', description: 'Vidljivost svih anketa (ne samo za sopstvene rezervacije)' },
];

// M10 spec §9 — dozvole finansija/fiskalizacije. Svaki SUBMIT/APPROVE/EXECUTE je eksplicitno
// "nikad AI agent" — sprovedeno i na nivou koda (servisi zahtevaju actor.userId), dozvola je
// druga linija odbrane.
const M10_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M10', resource: 'fiscal-document', action: 'VIEW', description: 'Uvid u fiskalne dokumente' },
  { module: 'M10', resource: 'fiscal-document', action: 'CREATE_DRAFT', description: 'Priprema nacrta fiskalnog dokumenta (sme i AI agent)' },
  { module: 'M10', resource: 'fiscal-document', action: 'SUBMIT', description: 'Slanje ka SEF/ESIR i storno — nikad AI agent' },
  { module: 'M10', resource: 'payment', action: 'VIEW', description: 'Uvid u uplate' },
  { module: 'M10', resource: 'payment', action: 'RECORD', description: 'Ručan unos prijema uplate (BANK_TRANSFER/CASH/CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN)' },
  { module: 'M10', resource: 'exchange-rate', action: 'VIEW', description: 'Uvid u kurseve' },
  { module: 'M10', resource: 'exchange-rate', action: 'EDIT', description: 'Ručan unos dnevnog kursa' },
  { module: 'M10', resource: 'payment-gateway-config', action: 'VIEW', description: 'Uvid u konfiguraciju platnog provajdera' },
  { module: 'M10', resource: 'payment-gateway-config', action: 'EDIT', description: 'Podešavanje kredencijala platnog provajdera' },
  { module: 'M10', resource: 'supplier-obligation', action: 'VIEW', description: 'Uvid u obaveze prema dobavljačima' },
  { module: 'M10', resource: 'supplier-obligation', action: 'APPROVE', description: 'Odobrenje/plaćanje obaveze prema dobavljaču — nikad AI agent' },
  { module: 'M10', resource: 'supplier-payment-instruction', action: 'VIEW', description: 'Uvid u instrukcije za isplatu dobavljaču' },
  { module: 'M10', resource: 'supplier-payment-instruction', action: 'CREATE', description: 'Sastavljanje naloga za isplatu dobavljaču (ne i izvršenje)' },
  { module: 'M10', resource: 'supplier-payment-instruction', action: 'EXECUTE', description: 'Izvršenje isplate dobavljaču — nikad AI agent' },
  { module: 'M10', resource: 'refund-instruction', action: 'VIEW', description: 'Uvid u zahteve za refundaciju gosta' },
  { module: 'M10', resource: 'refund-instruction', action: 'CREATE', description: 'Sastavljanje zahteva za refundaciju gosta (ne i odobrenje/izvršenje)' },
  { module: 'M10', resource: 'refund-instruction', action: 'APPROVE', description: 'Odobrenje refundacije — nikad AI agent' },
  { module: 'M10', resource: 'refund-instruction', action: 'EXECUTE', description: 'Izvršenje refundacije — nikad AI agent' },
  { module: 'M10', resource: 'payment-terms-config', action: 'VIEW', description: 'Uvid u politiku akontacije/balansa' },
  { module: 'M10', resource: 'payment-terms-config', action: 'EDIT', description: 'Izmena globalne politike akontacije/balansa' },
  { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW', description: 'Uvid u rokove naplate po rezervaciji' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'VIEW', description: 'Uvid u uvoze ulaznih faktura dobavljača' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'CREATE', description: 'Pokretanje uvoza/AI ekstrakcije ulazne fakture (sme i AI agent za ekstrakciju)' },
  { module: 'M10', resource: 'supplier-invoice-import', action: 'REVIEW', description: 'Potvrda/ručno mapiranje reda uvoza — nikad AI agent' },
  // Dopuna 31.8.2026 (M1 §3.9a konvencija) — isti obrazac kao M5 §6.6.
  { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW_ALL', description: 'Vidljivost svih rokova naplate (ne samo za sopstvene rezervacije)' },
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
  // Dopuna 31.8.2026 (M1 §3.9a konvencija) — isti obrazac kao M5 §6.6.
  { module: 'M20', resource: 'client-contract', action: 'VIEW_ALL', description: 'Vidljivost svih ugovora (ne samo za sopstvene rezervacije)' },
];

// M14 spec §5 — dozvole podrške/helpdeska. RESPOND je interno-samo (izmena statusa/prioriteta,
// STAFF/AI_DRAFT poruke, mark-sent); Gost/SUBAGENT_ADMIN dobijaju CREATE/VIEW ograničeno na
// sopstvene tikete na nivou API-ja (obim se sprovodi u TicketsService, ne kroz poseban ključ).
const M14_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M14', resource: 'ticket', action: 'VIEW', description: 'Uvid u tikete (svi za interni tim, sopstveni za Gosta/subagenta)' },
  { module: 'M14', resource: 'ticket', action: 'CREATE', description: 'Otvaranje tiketa i dodavanje sopstvene (REQUESTER) poruke' },
  { module: 'M14', resource: 'ticket', action: 'RESPOND', description: 'Izmena statusa/prioriteta/dodele, STAFF/AI_DRAFT poruke, mark-sent — nikad Gost/subagent' },
  // Dopuna 31.8.2026 (M1 §3.9a konvencija) — isti obrazac kao M5 §6.6; "sopstveno" ovde znači
  // Ticket.assigned_to = pozivalac (nema owner_id/assigned_to_id par kao Booking, samo dodela).
  { module: 'M14', resource: 'ticket', action: 'VIEW_ALL', description: 'Vidljivost svih tiketa internog tima (ne samo onih na kojima je pozivalac zadužen)' },
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
  // §3.2 dopuna (1.9.2026) — kancelarijski uvid u prijave sa terena po rezervaciji.
  { module: 'M9', resource: 'field-checkin', action: 'VIEW', description: 'Uvid u prijave sa terena za rezervaciju (GET /mobile/staff/check-ins)' },
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

// M15 spec §6.9.2/§8 — `bi-terminal/VIEW` je NAMERNO ODVOJEN od M15_PERMISSIONS iznad (ne u tom
// nizu) jer se M15_PERMISSIONS u celini prosleđuje i VLASNIK-u i DIREKTOR-u (DEFAULT_ROLE_PERMISSIONS
// ispod) — da je ovde, terminal bi automatski dobio i Direktor, suprotno vlasnikovoj eksplicitnoj
// odluci "isključivo Vlasnik". I dalje se dodaje u glavnu listu za Permission katalog (main()), samo
// se ručno dodeljuje isključivo VLASNIK-u u DEFAULT_ROLE_PERMISSIONS.
const M15_BI_TERMINAL_PERMISSION: { module: string; resource: string; action: string; description: string }[] = [
  {
    module: 'M15',
    resource: 'bi-terminal',
    action: 'VIEW',
    description: 'Terminal panel — kontrolisan, samo-za-čitanje AI agent za poslovna pitanja (poglavlje 6.9). Isključivo Vlasnik, ne Direktor.',
  },
];

// M18 spec §7 — dozvole operativnog nadzora. Sve idu isključivo Vlasniku/Direktoru
// (spec tabela — nema šire uloge, isti obrazac kao M15 dozvole).
const M18_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M18', resource: 'health-signal', action: 'VIEW', description: 'Uvid u detektovane operativne signale (kvarovi/nepravilnosti kroz sve module)' },
  { module: 'M18', resource: 'notification-channel', action: 'VIEW', description: 'Uvid u spoljne kanale obaveštavanja (Telegram/email/in-app)' },
  { module: 'M18', resource: 'notification-channel', action: 'EDIT', description: 'Izmena/kreiranje kanala obaveštavanja' },
  { module: 'M18', resource: 'weekly-review', action: 'VIEW', description: 'Uvid u nedeljne sveobuhvatne preglede, uklj. ručno pokretanje van rasporeda' },
  { module: 'M18', resource: 'trend-suggestion', action: 'VIEW', description: 'Uvid u predloge trendova' },
  { module: 'M18', resource: 'trend-suggestion', action: 'APPROVE', description: 'Odobrenje/odbijanje predloga trenda pre ulaska u Dodatak A Master dokumenta' },
  { module: 'M18', resource: 'agent-invocation-log', action: 'VIEW', description: 'Uvid u log poziva jezičkom modelu (potrošnja/trošak po agentu)' },
  { module: 'M18', resource: 'provider-health', action: 'VIEW', description: 'Uvid u trenutno stanje (latencija/dostupnost) po dobavljaču/provajderu' },
  { module: 'M18', resource: 'ai-provider-quota', action: 'VIEW', description: 'Uvid u potrošnju naspram kvota/budžeta po AI provajderu' },
  { module: 'M18', resource: 'ai-provider-quota', action: 'OVERRIDE', description: 'Ručan povratak iz DEGRADED u NORMAL pre isteka perioda' },
  { module: 'M18', resource: 'ai-agent-budget', action: 'VIEW', description: 'Uvid u budžet po pojedinačnom AI agentu' },
  { module: 'M18', resource: 'ai-agent-budget', action: 'EDIT', description: 'Izmena/kreiranje budžeta pojedinačnog AI agenta' },
  { module: 'M18', resource: 'process-map', action: 'VIEW', description: 'Uvid u živu procesnu mapu (dopunjeno 29.8.2026, M18 spec §9a)' },
];

// M19 spec §7/§9.6 — dozvole komunikacione platforme. conversation/* je interni tim-chat (širi
// krug — svi interni tim članovi, spec §7 tabela); supplier-conversation/* je uže (spec §9.6 —
// VIEW/SEND_MESSAGE: Vlasnik/Direktor/Sales Manager/Prodajni agent SAMO uz SupplierConversationAccess
// §9.4; GRANT_ACCESS: Vlasnik/Direktor/Sales Manager, isti krug kao M22 MailboxAccess dodela).
const M19_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M19', resource: 'conversation', action: 'CREATE', description: 'Kreiranje internog DIRECT/GROUP razgovora' },
  { module: 'M19', resource: 'conversation', action: 'VIEW', description: 'Uvid u sopstvene interne razgovore/prisustvo tima' },
  { module: 'M19', resource: 'conversation', action: 'SEND_MESSAGE', description: 'Slanje poruke u interni razgovor' },
  { module: 'M19', resource: 'supplier-conversation', action: 'VIEW', description: 'Uvid u EXTERNAL_SUPPLIER razgovor — samo uz SupplierConversationAccess (§9.4)' },
  { module: 'M19', resource: 'supplier-conversation', action: 'SEND_MESSAGE', description: 'Slanje poruke dobavljaču — samo uz SupplierConversationAccess (§9.4)' },
  { module: 'M19', resource: 'supplier-conversation', action: 'GRANT_ACCESS', description: 'Dodela/oduzimanje pristupa zaposlenom EXTERNAL_SUPPLIER razgovoru, pokretanje portal pozivnice dobavljaču' },
];

// M21 spec §3 — vidljivost je po četiri publike (STAFF/SUBAGENT/BUSINESS_CLIENT/PUBLIC_GUEST,
// poslednja dodata avgust 2026), svaka sa sopstvenim VIEW/EDIT/PUBLISH parom. PUBLISH ide
// isključivo Direktoru/Vlasniku (HR ima EDIT ali ne i PUBLISH — potvrđena vlasnikova odluka,
// avgust 2026, ista dvoslojna podela kao M12 ContentPiece EDIT vs PUBLISH). question-log/VIEW
// je bezbednosni/kvalitetni uvid (HR/Direktor/Vlasnik), suggestion/APPROVE prevodi AI nacrt u
// stvaran (i dalje neobjavljen) HelpArticle. article:public/VIEW postoji isključivo radi STAFF
// uvida u panelu (pregled/odobravanje PUBLIC_GUEST članaka, §6 GET /help/articles?status=) —
// stvaran anonimni B2C poziv nikad ne prolazi kroz M1 Permission proveru uopšte (nema User
// zapis da se proveri), vidi HelpAssistantService.ask komentar uz avgust 2026 izmenu.
const M21_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M21', resource: 'article:staff', action: 'VIEW', description: 'Uvid u objavljene članke namenjene internom timu' },
  { module: 'M21', resource: 'article:subagent', action: 'VIEW', description: 'Uvid u objavljene članke namenjene B2B subagentima' },
  { module: 'M21', resource: 'article:business', action: 'VIEW', description: 'Uvid u objavljene članke namenjene korporativnim self-service klijentima' },
  { module: 'M21', resource: 'article:public', action: 'VIEW', description: 'Uvid u objavljene članke namenjene anonimnim/pojedinačnim (INDIVIDUAL) B2C gostima' },
  { module: 'M21', resource: 'article:staff', action: 'EDIT', description: 'Kreiranje/izmena nacrta članaka za interni tim' },
  { module: 'M21', resource: 'article:staff', action: 'PUBLISH', description: 'Objava članka za interni tim (isključivo Direktor/Vlasnik)' },
  { module: 'M21', resource: 'article:subagent', action: 'EDIT', description: 'Kreiranje/izmena nacrta članaka za B2B subagente' },
  { module: 'M21', resource: 'article:subagent', action: 'PUBLISH', description: 'Objava članka za B2B subagente (isključivo Direktor/Vlasnik)' },
  { module: 'M21', resource: 'article:business', action: 'EDIT', description: 'Kreiranje/izmena nacrta članaka za korporativne klijente' },
  { module: 'M21', resource: 'article:business', action: 'PUBLISH', description: 'Objava članka za korporativne klijente (isključivo Direktor/Vlasnik)' },
  { module: 'M21', resource: 'article:public', action: 'EDIT', description: 'Kreiranje/izmena nacrta članaka za anonimne/pojedinačne B2C goste' },
  { module: 'M21', resource: 'article:public', action: 'PUBLISH', description: 'Objava članka za anonimne/pojedinačne B2C goste (isključivo Direktor/Vlasnik)' },
  { module: 'M21', resource: 'suggestion', action: 'APPROVE', description: 'Odobrenje/odbijanje AI predloga novog članka baze znanja' },
  { module: 'M21', resource: 'question-log', action: 'VIEW', description: 'Uvid u istoriju pitanja AI asistentu radi kvaliteta sadržaja i bezbednosnog pregleda' },
];

// M22 spec §2.1/§2.2/§7 — mailbox/* i mailbox-access/GRANT su uže (Vlasnik/Direktor —
// upravljanje konekcijama sandučadi i ko sme da dodeljuje pristup). email-thread/VIEW/REPLY/
// CONVERT_TO_TICKET su katalog nivo (gruba kapija — "ova vrsta naloga uopšte sme da pokuša"),
// dodeljene istom krugu kao M19 supplier-conversation VIEW/SEND_MESSAGE (Sales Manager/Prodajni
// agent) jer je prepiska sa gostima/subagentima/dobavljačima deo iste svakodnevne uloge — STVARNA
// vidljivost pojedinačne niti je i dalje isključivo preko MailboxAccess po sandučetu (§2.2), ova
// dozvola nikad sama po sebi ne otvara nijedno sanduče.
const M22_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M22', resource: 'mailbox', action: 'VIEW', description: 'Uvid u listu sandučadi (bez pristupa sadržaju niti bez MailboxAccess)' },
  { module: 'M22', resource: 'mailbox', action: 'CREATE', description: 'Kreiranje novog sandučeta (SHARED/PERSONAL) i konekcije provajdera' },
  { module: 'M22', resource: 'mailbox', action: 'EDIT', description: 'Izmena podešavanja sandučeta' },
  { module: 'M22', resource: 'mailbox-access', action: 'GRANT', description: 'Pojedinačna dodela/oduzimanje pristupa (VIEW/REPLY) sandučetu' },
  { module: 'M22', resource: 'email-thread', action: 'VIEW', description: 'Uvid u niti — samo za sandučad za koja postoji MailboxAccess (§2.2)' },
  { module: 'M22', resource: 'email-thread', action: 'REPLY', description: 'Odgovaranje/slanje/povezivanje niti — samo uz REPLY MailboxAccess (§2.2)' },
  { module: 'M22', resource: 'email-thread', action: 'CONVERT_TO_TICKET', description: 'Konverzija niti u M14 tiket — isti krug kao REPLY' },
];

// M23 spec §6 — 6 dozvola. article/VIEW dobija interne uloge + SUBAGENT_ADMIN (§3.1 — ista puna
// lista za obe publike, za razliku od M21 koje ima audience segmentaciju po dozvoli).
// EDIT/PUBLISH/article-source APPROVE/article-revision APPROVE idu Vlasniku/Direktoru/Sales
// Manageru (spec §6 kaže "Vlasnik, Direktor, Sales Manager" za sve četiri — nikad AI agent,
// sprovedeno i na nivou koda preko assertHumanActor). question-log/VIEW ostaje uže
// (Vlasnik/Direktor), isti krug kao M21 question-log.
const M23_PERMISSIONS: { module: string; resource: string; action: string; description: string }[] = [
  { module: 'M23', resource: 'article', action: 'VIEW', description: 'Uvid u punu listu objavljenih članaka baze znanja (interni tim i SUBAGENT_ADMIN, bez razdvajanja publike)' },
  { module: 'M23', resource: 'article', action: 'EDIT', description: 'Kreiranje/izmena nacrta članaka, pokretanje AI istraživanja' },
  { module: 'M23', resource: 'article', action: 'PUBLISH', description: 'Objava članka — nikad AI agent (M23 spec §6/§9)' },
  { module: 'M23', resource: 'article-source', action: 'APPROVE', description: 'Odobrenje/odbijanje kandidata izvora — nikad AI agent (§4b)' },
  { module: 'M23', resource: 'article-revision', action: 'APPROVE', description: 'Odobrenje/odbijanje predložene revizije sadržaja — nikad AI agent (§2.4/§4c)' },
  { module: 'M23', resource: 'question-log', action: 'VIEW', description: 'Uvid u istoriju pitanja AI asistentu radi kvaliteta sadržaja' },
];

// Podrazumevana dodela — Vlasnik/Direktor dobijaju sve M1+M2+M3+M4 dozvole; HR upravlja korisnicima;
// Sales Manager/Prodajni agent dobijaju samo VIEW nivoe iz M2/M3 (M2 spec §6, M3 spec §5).
const DEFAULT_ROLE_PERMISSIONS: Record<string, { module: string; resource: string; action: string }[]> = {
  [SYSTEM_ROLES.VLASNIK]: [
    // M9 §3.2 dopuna (1.9.2026) — kancelarijski uvid u prijave sa terena (kartica "Predstavnici").
    { module: 'M9', resource: 'field-checkin', action: 'VIEW' },
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
    ...M18_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M19_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M21_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M22_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M23_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    // §6.9.2 — isključivo VLASNIK, namerno NE u DIREKTOR bloku ispod.
    ...M15_BI_TERMINAL_PERMISSION.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.DIREKTOR]: [
    // M9 §3.2 dopuna (1.9.2026) — kancelarijski uvid u prijave sa terena (kartica "Predstavnici").
    { module: 'M9', resource: 'field-checkin', action: 'VIEW' },
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
    ...M18_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M19_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M21_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M22_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
    ...M23_PERMISSIONS.map((p) => ({ module: p.module, resource: p.resource, action: p.action })),
  ],
  [SYSTEM_ROLES.HR]: [
    { module: 'M1', resource: 'user', action: 'VIEW' },
    { module: 'M1', resource: 'user', action: 'CREATE' },
    { module: 'M1', resource: 'user', action: 'EDIT' },
    { module: 'M1', resource: 'user', action: 'DELETE' },
    { module: 'M1', resource: 'role', action: 'VIEW' },
    // M19 spec §7 — HR je deo internog tim-chata (conversation/*), ali NIJE u §9.6 krugu za
    // supplier-conversation (taj krug je Vlasnik/Direktor/Sales Manager/Prodajni agent).
    { module: 'M19', resource: 'conversation', action: 'CREATE' },
    { module: 'M19', resource: 'conversation', action: 'VIEW' },
    { module: 'M19', resource: 'conversation', action: 'SEND_MESSAGE' },
    // M21 spec §3/poglavlje 8 (potvrđena vlasnikova odluka, avgust 2026) — HR piše/menja nacrte
    // za sve tri publike (EDIT) i odobrava AI predloge, ali NEMA PUBLISH (samo Direktor/Vlasnik
    // objavljuju) — isti dvoslojni obrazac kao M12 ContentPiece CREATE_DRAFT vs APPROVE_PUBLISH.
    { module: 'M21', resource: 'article:staff', action: 'VIEW' },
    { module: 'M21', resource: 'article:staff', action: 'EDIT' },
    { module: 'M21', resource: 'article:subagent', action: 'EDIT' },
    { module: 'M21', resource: 'article:business', action: 'EDIT' },
    // avgust 2026 — HR dobija EDIT i za PUBLIC_GUEST publiku, isti krug kao ostale tri.
    { module: 'M21', resource: 'article:public', action: 'EDIT' },
    { module: 'M21', resource: 'suggestion', action: 'APPROVE' },
    { module: 'M21', resource: 'question-log', action: 'VIEW' },
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
    // M5 spec §6.5/§6.6 (31.8.2026) — Sales Manager dobija VIEW_ALL i predaju zaduženja, ali
    // NIKAD TRANSFER_OWNERSHIP (nadgleda, ne preraspoređuje vlasništvo — §6.5).
    { module: 'M5', resource: 'booking', action: 'VIEW_ALL' },
    { module: 'M5', resource: 'booking', action: 'TRANSFER_ASSIGNMENT' },
    { module: 'M5', resource: 'booking', action: 'ACCEPT_ASSIGNMENT' },
    // M5 spec §4.6/§10 (1.9.2026) — interne beleške uz rezervaciju.
    { module: 'M5', resource: 'booking-note', action: 'CREATE' },
    { module: 'M5', resource: 'booking-note', action: 'DELETE' },
    // M9 §3.2 dopuna (1.9.2026) — kancelarijski uvid u prijave sa terena (kartica "Predstavnici").
    { module: 'M9', resource: 'field-checkin', action: 'VIEW' },
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
    { module: 'M20', resource: 'client-contract', action: 'VIEW_ALL' },
    // M7 spec §10 — Sales Manager vidi ceo lanac subagenata i rabate provizije, ne odobrava ih.
    { module: 'M7', resource: 'subagent', action: 'VIEW' },
    { module: 'M7', resource: 'commission-rebate', action: 'VIEW' },
    // M6 spec §7 — Sales Manager vidi/uređuje CRM celog tima, definicije nivoa lojalnosti (VIEW).
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'CREATE' },
    { module: 'M6', resource: 'client-account', action: 'EDIT' },
    { module: 'M6', resource: 'client-account', action: 'VIEW_ALL' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    { module: 'M6', resource: 'loyalty-tier', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'CREATE' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW_ALL' },
    // M14 spec §5 — Sales Manager vidi/odgovara na sve tikete (isti krug kao Vlasnik/Direktor).
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
    { module: 'M14', resource: 'ticket', action: 'RESPOND' },
    { module: 'M14', resource: 'ticket', action: 'VIEW_ALL' },
    // M13 spec §6 — Sales Manager dobija sales/occupancy (nije cenovno osetljivo kao profitabilnost/dinamički).
    { module: 'M13', resource: 'report:sales', action: 'VIEW' },
    { module: 'M13', resource: 'report:occupancy', action: 'VIEW' },
    // M15 spec §8 — Agent Inbox: vidi stavke iz izvora za koje već ima VIEW (M5/M7/M14 iznad).
    { module: 'M15', resource: 'agent-inbox', action: 'VIEW' },
    // M19 spec §7/§9.6 — Sales Manager je u oba kruga: interni tim-chat i EXTERNAL_SUPPLIER
    // (VIEW/SEND_MESSAGE uz SupplierConversationAccess §9.4, i GRANT_ACCESS — isti krug kao
    // M22 MailboxAccess dodela).
    { module: 'M19', resource: 'conversation', action: 'CREATE' },
    { module: 'M19', resource: 'conversation', action: 'VIEW' },
    { module: 'M19', resource: 'conversation', action: 'SEND_MESSAGE' },
    { module: 'M19', resource: 'supplier-conversation', action: 'VIEW' },
    { module: 'M19', resource: 'supplier-conversation', action: 'SEND_MESSAGE' },
    { module: 'M19', resource: 'supplier-conversation', action: 'GRANT_ACCESS' },
    // M21 spec §3 — Sales Manager je interni tim, čita objavljene STAFF članke kao svaki drugi
    // zaposleni (nema EDIT/PUBLISH — to je uže na HR/Direktor/Vlasnik krug).
    { module: 'M21', resource: 'article:staff', action: 'VIEW' },
    // M22 spec §2.2/§7 — Sales Manager dobija katalog (grubu) dozvolu za prepisku, isti krug kao
    // supplier-conversation iznad; stvarna vidljivost pojedinačne niti i dalje zavisi isključivo
    // od MailboxAccess dodeljenog tom korisniku po sandučetu.
    { module: 'M22', resource: 'email-thread', action: 'VIEW' },
    { module: 'M22', resource: 'email-thread', action: 'REPLY' },
    { module: 'M22', resource: 'email-thread', action: 'CONVERT_TO_TICKET' },
    // M23 spec §6 — Sales Manager je u punom krugu (EDIT/PUBLISH/APPROVE), isto kao
    // Vlasnik/Direktor, ali bez question-log/VIEW (uže na Vlasnik/Direktor).
    { module: 'M23', resource: 'article', action: 'VIEW' },
    { module: 'M23', resource: 'article', action: 'EDIT' },
    { module: 'M23', resource: 'article', action: 'PUBLISH' },
    { module: 'M23', resource: 'article-source', action: 'APPROVE' },
    { module: 'M23', resource: 'article-revision', action: 'APPROVE' },
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
    // M5 spec §6.5/§6.6 (31.8.2026) — Prodajni agent dobija VIEW_ALL (podrazumevano vidi sve,
    // §6.6 — sužava se pojedinačno preko DENY), predaju zaduženja, i prenos vlasništva (samo
    // za rezervacije čiji je trenutno vlasnik — ownership provera u servisu, §6.5).
    { module: 'M5', resource: 'booking', action: 'VIEW_ALL' },
    { module: 'M5', resource: 'booking', action: 'TRANSFER_OWNERSHIP' },
    { module: 'M5', resource: 'booking', action: 'TRANSFER_ASSIGNMENT' },
    { module: 'M5', resource: 'booking', action: 'ACCEPT_ASSIGNMENT' },
    // M5 spec §4.6/§10 (1.9.2026) — interne beleške uz rezervaciju.
    { module: 'M5', resource: 'booking-note', action: 'CREATE' },
    { module: 'M5', resource: 'booking-note', action: 'DELETE' },
    // M9 §3.2 dopuna (1.9.2026) — kancelarijski uvid u prijave sa terena (kartica "Predstavnici").
    { module: 'M9', resource: 'field-checkin', action: 'VIEW' },
    { module: 'M5', resource: 'supplier-manifest', action: 'VIEW' },
    { module: 'M5', resource: 'supplier-manifest', action: 'CREATE' },
    { module: 'M5', resource: 'supplier-confirmation', action: 'CONFIRM' },
    // M10 spec §9 — client-payment-schedule/VIEW je jedina M10 dozvola koju dobija
    // Prodajni agent, ništa drugo iz M10. VIEW_ALL (31.8.2026, M1 §3.9a) — podrazumevano vidi
    // sve, sužava se pojedinačno preko DENY, isti obrazac kao M5 §6.6.
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW' },
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW_ALL' },
    // M11 spec §4 — Prodajni agent vidi CIS registracije garancije po sopstvenim rezervacijama.
    { module: 'M11', resource: 'travel-guarantee-registration', action: 'VIEW' },
    // M20 spec §5 — Prodajni agent vidi i ručno evidentira prihvatanje ugovora klijenata.
    { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    { module: 'M20', resource: 'client-contract', action: 'ACCEPT' },
    { module: 'M20', resource: 'client-contract', action: 'VIEW_ALL' },
    // M6 spec §7 (31.8.2026, M1 §3.9a) — podrazumevano vidi sve klijente, sužava se pojedinačno.
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'CREATE' },
    { module: 'M6', resource: 'client-account', action: 'EDIT' },
    { module: 'M6', resource: 'client-account', action: 'VIEW_ALL' },
    { module: 'M6', resource: 'guest-profile', action: 'VIEW' },
    { module: 'M6', resource: 'guest-profile', action: 'CREATE' },
    { module: 'M6', resource: 'guest-profile', action: 'EDIT' },
    { module: 'M6', resource: 'loyalty-tier', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'VIEW' },
    { module: 'M6', resource: 'communication-log', action: 'CREATE' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW' },
    { module: 'M6', resource: 'post-trip-survey', action: 'VIEW_ALL' },
    // M14 spec §5 (31.8.2026, M1 §3.9a) — podrazumevano vidi sve tikete, sužava se pojedinačno
    // preko DENY na VIEW_ALL (zamenjuje raniju formulaciju "podrazumevano samo sopstveni").
    { module: 'M14', resource: 'ticket', action: 'VIEW' },
    { module: 'M14', resource: 'ticket', action: 'CREATE' },
    { module: 'M14', resource: 'ticket', action: 'RESPOND' },
    { module: 'M14', resource: 'ticket', action: 'VIEW_ALL' },
    // M19 spec §7/§9.6 — Prodajni agent je u oba kruga: interni tim-chat i EXTERNAL_SUPPLIER
    // (VIEW/SEND_MESSAGE uz SupplierConversationAccess §9.4), ali NE GRANT_ACCESS (§9.6 tabela —
    // taj krug je uže Vlasnik/Direktor/Sales Manager).
    { module: 'M19', resource: 'conversation', action: 'CREATE' },
    { module: 'M19', resource: 'conversation', action: 'VIEW' },
    { module: 'M19', resource: 'conversation', action: 'SEND_MESSAGE' },
    { module: 'M19', resource: 'supplier-conversation', action: 'VIEW' },
    { module: 'M19', resource: 'supplier-conversation', action: 'SEND_MESSAGE' },
    // M21 spec §3 — Prodajni agent je interni tim, čita objavljene STAFF članke.
    { module: 'M21', resource: 'article:staff', action: 'VIEW' },
    // M22 spec §2.2/§7 — isti krug kao supplier-conversation iznad; MailboxAccess po sandučetu
    // ostaje jedina stvarna kapija ka sadržaju niti.
    { module: 'M22', resource: 'email-thread', action: 'VIEW' },
    { module: 'M22', resource: 'email-thread', action: 'REPLY' },
    { module: 'M22', resource: 'email-thread', action: 'CONVERT_TO_TICKET' },
    // M23 spec §6 — Prodajni agent je interni tim, čita punu listu objavljenih članaka (§3.1 —
    // nema audience razdvajanja), ali nema EDIT/PUBLISH/APPROVE (uže na Vlasnik/Direktor/Sales Manager).
    { module: 'M23', resource: 'article', action: 'VIEW' },
  ],
  // M10 spec §9 — Računovođa dobija sve VIEW/CREATE_DRAFT/RECORD/APPROVE/REVIEW dozvole, ali
  // NIKAD SUBMIT/EXECUTE za payment-gateway-config, supplier-payment-instruction, ni
  // refund-instruction (tj. Vlasnik/Direktor su jedini koji izvršavaju stvaran prenos novca).
  [SYSTEM_ROLES.RACUNOVODJA]: [
    // Dopuna 3.9.2026 (M1 §3.9a, isti obrazac kao M10/client-payment-schedule i M6/client-account
    // ispod) — nalaz: M10 §5.2 ručan unos uplate interno poziva M5 BookingsService.updatePaymentStatus,
    // koja sprovodi SOPSTVENU proveru vlasništva (owner_id/assigned_to_id/VIEW_ALL). Računovođa je
    // imala M10/payment/RECORD ali NIJEDNU M5 dozvolu — uplata za rezervaciju koju lično ne vodi je
    // vraćala 404 (booking "nije pronađen"), iako ima dozvolu baš za taj posao. VIEW (read-only, bez
    // MODIFY/CANCEL/CREATE) + VIEW_ALL usklađuju kod sa opisom uloge u ovom fajlu ("read-only uvid u
    // rezervacije") i rešavaju grešku, isti princip kao već postojeći M10/M6 VIEW_ALL ispod.
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking', action: 'VIEW_ALL' },
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
    // Dopuna 4.9.2026 (M10 spec §11) — sastavljanje naloga traži sopstveno pravo, odvojeno
    // od pukog uvida; izvršenje (EXECUTE) ostaje isključivo Vlasnik/Direktor.
    { module: 'M10', resource: 'supplier-payment-instruction', action: 'CREATE' },
    { module: 'M10', resource: 'refund-instruction', action: 'VIEW' },
    { module: 'M10', resource: 'refund-instruction', action: 'CREATE' },
    { module: 'M10', resource: 'payment-terms-config', action: 'VIEW' },
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW' },
    // Dopuna 31.8.2026 (M1 §3.9a) — Računovođa radi fakturisanje za celu agenciju, ne samo
    // rezervacije koje sama poseduje/vodi (ne poseduje nijednu) — VIEW_ALL joj je podrazumevano
    // potrebna, ne izuzetak.
    { module: 'M10', resource: 'client-payment-schedule', action: 'VIEW_ALL' },
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
    // M6 spec §7 — Računovođa dobija VIEW radi fakturisanja, ništa drugo iz M6. VIEW_ALL isti
    // razlog kao M10 iznad (31.8.2026, M1 §3.9a).
    { module: 'M6', resource: 'client-account', action: 'VIEW' },
    { module: 'M6', resource: 'client-account', action: 'VIEW_ALL' },
    // M13 spec §6 — Računovođa dobija finansijski izveštaj (FactPayment).
    { module: 'M13', resource: 'report:financial', action: 'VIEW' },
    // M19 spec §7 — Računovođa je u internom tim-chatu, ali van §9.6 kruga za
    // supplier-conversation (taj krug je Vlasnik/Direktor/Sales Manager/Prodajni agent).
    { module: 'M19', resource: 'conversation', action: 'CREATE' },
    { module: 'M19', resource: 'conversation', action: 'VIEW' },
    { module: 'M19', resource: 'conversation', action: 'SEND_MESSAGE' },
    // M21 spec §3 — Računovođa je interni tim, čita objavljene STAFF članke.
    { module: 'M21', resource: 'article:staff', action: 'VIEW' },
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
    // M21 spec §1/§3 — dodeljeno celoj GOST roli (i INDIVIDUAL i LEGAL_ENTITY nalozima).
    // resolveHelpAudience bira TAČNO JEDAN segment po pozivaocu (LEGAL_ENTITY → business,
    // INDIVIDUAL/nepovezan → public, avgust 2026), pa je bezbedno da nalog ima obe VIEW dozvole
    // — samo jedna ikad postane relevantna po stvarnom pozivu (izlazni kriterijum §7, prva stavka).
    { module: 'M21', resource: 'article:business', action: 'VIEW' },
    { module: 'M21', resource: 'article:public', action: 'VIEW' },
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
    // M21 spec §1/§3 — SUBAGENT_ADMIN čita objavljene SUBAGENT članke (portal, M7).
    { module: 'M21', resource: 'article:subagent', action: 'VIEW' },
    // M23 spec §3.1/§6 — SUBAGENT_ADMIN čita PUNU listu objavljenih M23 članaka, isti sadržaj
    // kao interni tim (za razliku od M21, nema audience segmentaciju).
    { module: 'M23', resource: 'article', action: 'VIEW' },
  ],
  // M9 spec §6 — VODIC dobija isključivo svoje tri M9 dozvole; ownership (sopstveni
  // assigned_guide_id) se sprovodi u FieldStaffService, ne ovde.
  [SYSTEM_ROLES.VODIC]: [
    { module: 'M9', resource: 'field-itinerary', action: 'VIEW' },
    { module: 'M9', resource: 'field-checkin', action: 'CREATE' },
    { module: 'M9', resource: 'field-incident', action: 'CREATE' },
    // M5 spec §4.6 dopuna (1.9.2026) — predstavnik na destinaciji upisuje napomenu u iste
    // beleške rezervacije, samo obeleženu kao "sa terena". NAMERNO bez `booking/VIEW_ALL`:
    // vidi isključivo rezervacije na kojima mu je stavka stvarno dodeljena (§6.6 izuzetak).
    { module: 'M5', resource: 'booking', action: 'VIEW' },
    { module: 'M5', resource: 'booking-note', action: 'CREATE' },
    { module: 'M5', resource: 'booking-note', action: 'DELETE' },
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
    ...M15_BI_TERMINAL_PERMISSION,
    ...M18_PERMISSIONS,
    ...M19_PERMISSIONS,
    ...M21_PERMISSIONS,
    ...M22_PERMISSIONS,
    ...M23_PERMISSIONS,
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
  await seedM19SupplierDraftAgent();
  await seedM19SystemNotificationUser();
  await seedM21HelpCenterAgent();
  await seedM21PublicGuestArticles();
  await seedM22EmailInboxAgent();
  await seedM22SupplierUnifiedInbox();
  await seedM23KnowledgeAgent();
  await seedM5CalendarMockBookings();
  await seedM10Banks();
  await seedBootstrapVlasnik();

  console.log(
    `Seed OK — ${SYSTEM_ROLE_SEED.length} sistemskih uloga, ${M1_PERMISSIONS.length} M1 dozvola, ${M2_PERMISSIONS.length} M2 dozvola, ${M3_PERMISSIONS.length} M3 dozvola, ${M4_PERMISSIONS.length} M4 dozvola, ${M5_PERMISSIONS.length} M5 dozvola, ${M6_PERMISSIONS.length} M6 dozvola, ${M10_PERMISSIONS.length} M10 dozvola, ${M11_PERMISSIONS.length} M11 dozvola, ${M7_PERMISSIONS.length} M7 dozvola, ${M20_PERMISSIONS.length} M20 dozvola, ${M14_PERMISSIONS.length} M14 dozvola, ${M13_PERMISSIONS.length} M13 dozvola, ${M12_PERMISSIONS.length} M12 dozvola, ${M16_PERMISSIONS.length} M16 dozvola, ${M9_PERMISSIONS.length} M9 dozvola, ${M15_PERMISSIONS.length} M15 dozvola, ${M18_PERMISSIONS.length} M18 dozvola, ${M19_PERMISSIONS.length} M19 dozvola, ${M21_PERMISSIONS.length} M21 dozvola, ${M22_PERMISSIONS.length} M22 dozvola, ${M23_PERMISSIONS.length} M23 dozvola.`,
  );
}

// M1 spec §8 / zamka 5.7 (dopuna 4.9.2026, na zahtev vlasnika) — PRVI ljudski nalog.
//
// Do sada je seed pravio uloge, dozvole i sistemske AI naloge, ali nijedan STAFF nalog:
// posle svežeg seed-a niko se nije mogao prijaviti u panel, a pozvati nekoga (POST /users)
// može samo već prijavljen korisnik — zatvoren krug. Ovaj nalog ga otvara i ništa više;
// sve ostale zaposlene taj nalog dalje poziva kroz panel.
//
// Bezbednosna pravila, namerno stroga:
//   1. Lozinka NIKAD nije konstanta u kodu. Uzima se iz `SEED_VLASNIK_PASSWORD`, a ako te
//      promenljive nema — van produkcije se generiše nasumična i ISPIŠE jednom u izlazu
//      seed-a (jedino mesto gde se vidi), dok se na produkciji nalog uopšte ne pravi.
//   2. 2FA ostaje obavezna i za njega — `mfaEnabled` je `false`, pa prva prijava ide kroz
//      podešavanje 2FA (M1 spec §5, dopuna 4.9.2026). Nalog dakle nije prečica oko 2FA.
//   3. Idempotentno: ako nalog već postoji, lozinka se NE menja (ponovno pokretanje seed-a
//      ne sme resetovati lozinku naloga koji neko već koristi).
async function seedBootstrapVlasnik() {
  const email = process.env.SEED_VLASNIK_EMAIL ?? 'vlasnik@terminal-travel.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`seedBootstrapVlasnik: nalog ${email} već postoji — lozinka nije dirana`);
    return;
  }

  const provided = process.env.SEED_VLASNIK_PASSWORD;
  if (!provided && process.env.NODE_ENV === 'production') {
    console.log(
      'seedBootstrapVlasnik: PRESKOČENO — na produkciji se prvi nalog pravi isključivo uz ' +
        'izričito zadatu SEED_VLASNIK_PASSWORD (nikad nasumična lozinka ispisana u log).',
    );
    return;
  }

  // 24 znaka base64url ≈ 144 bita entropije — daleko iznad minimuma od 12 znakova (§5).
  const password = provided ?? randomBytes(18).toString('base64url');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: process.env.SEED_VLASNIK_NAME ?? 'Vlasnik agencije',
      accountType: 'STAFF',
      status: 'ACTIVE',
      mfaEnabled: false,
    },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.VLASNIK } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });

  console.log('seedBootstrapVlasnik: napravljen prvi nalog za prijavu u panel');
  console.log(`  email:   ${email}`);
  if (provided) {
    console.log('  lozinka: (iz SEED_VLASNIK_PASSWORD)');
  } else {
    console.log(`  lozinka: ${password}`);
    console.log('  ^ prikazuje se SAMO sada — zapišite je. Promena ide kroz „zaboravljena lozinka“.');
  }
  console.log('  Prva prijava vodi na podešavanje 2FA (obavezna za interne uloge).');
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

  // M15 spec §6.9.5 — sopstveni, nezavisan gate od M15_OMNISEARCH (isti obrazac, drugi module_code).
  await prisma.moduleAgentActivation.upsert({
    where: { moduleCode: 'M15_BI_TERMINAL' },
    update: {},
    create: { moduleCode: 'M15_BI_TERMINAL', status: 'NOT_READY' },
  });

  const biTerminalAgentUser = await prisma.user.upsert({
    where: { email: 'bi-terminal-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'bi-terminal-agent@sistem.terminal-travel.local',
      fullName: 'BiTerminalAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: biTerminalAgentUser.id },
    update: {},
    create: {
      userId: biTerminalAgentUser.id,
      agentRole: 'BI_TERMINAL_AGENT',
      moduleCode: null,
      status: 'DISABLED', // §3 ograda na nivou koda — ne može ACTIVE dok M15_BI_TERMINAL != ACTIVATED
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });

  // M15 spec §6.5.6b/§6.9.7 — jedan zajednički gate za "opšta pretraga interneta uz odobrenje
  // čoveka" bez obzira ko poziva (OmnisearchAgent kasnije, BiTerminalAgent od 23.8.2026) — širi
  // opseg (bilo koji sajt) zaslužuje sopstvenu, svesnu odluku Vlasnika, odvojenu od M15_BI_TERMINAL.
  await prisma.moduleAgentActivation.upsert({
    where: { moduleCode: 'M15_WEB_RESEARCH' },
    update: {},
    create: { moduleCode: 'M15_WEB_RESEARCH', status: 'NOT_READY' },
  });

  const webSafetyAgentUser = await prisma.user.upsert({
    where: { email: 'web-content-safety-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'web-content-safety-agent@sistem.terminal-travel.local',
      fullName: 'WebContentSafetyAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: webSafetyAgentUser.id },
    update: {},
    create: {
      userId: webSafetyAgentUser.id,
      agentRole: 'WEB_CONTENT_SAFETY_AGENT',
      moduleCode: null,
      status: 'DISABLED', // §3 ograda na nivou koda — ne može ACTIVE dok M15_WEB_RESEARCH != ACTIVATED
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
    { moduleCode: 'M19', actionCode: 'supplier_draft.generate', tier: 'AUTONOMOUS', sourceNote: 'M19 poglavlje 9.5 — isključivo sažimanje/nacrt, nikad slanje (message.send ostaje ljudska radnja)' },
    { moduleCode: 'M22', actionCode: 'email.summarize-draft', tier: 'AUTONOMOUS', sourceNote: 'M22 poglavlje 4 — sažetak/nacrt na svaku INBOUND poruku, nikad slanje (jedini put ka sent_by je ljudski klik na /messages/:messageId/send)' },
  ];

  for (const row of rows) {
    await upsertAgentActionType(row.moduleCode, row.actionCode, row.tier, row.sourceNote);
  }
}

// M19 spec §9.5 — SupplierDraftAgent, isti obrazac kao seedM15Omnisearch (formalni M1 nalog +
// AIAgent zapis da audit log/AgentInvocationLog imaju actor_type=AI_AGENT). Za razliku od
// OmnisearchAgent, ne zavisi od ModuleAgentActivation gate-a (M19 spec §9.5 nema takav gate —
// "predloži-pa-čovek-odobri" je već sama ograda, sprovedena u SupplierDraftService, ne aktivacijom).
async function seedM19SupplierDraftAgent() {
  const agentUser = await prisma.user.upsert({
    where: { email: 'supplier-draft-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'supplier-draft-agent@sistem.terminal-travel.local',
      fullName: 'SupplierDraftAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      agentRole: 'SUPPLIER_DRAFT_AGENT',
      moduleCode: 'M19',
      status: 'ACTIVE',
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });
}

// M21 spec §5.1 — HelpCenterAgent, isti obrazac kao seedM19SupplierDraftAgent (formalni M1 nalog
// + AIAgent zapis da AuditLogEntry/AgentInvocationLog imaju actor_type=AI_AGENT). modelTier LIGHT
// je eksplicitna spec vrednost (§5.1 — "čisto pretraživanje/sažimanje objavljenog teksta, niska
// složenost/osetljivost"). Bez ModuleAgentActivation gate-a — ograda je strukturna (§5.2, ne
// zavisi od aktivacionog prekidača kao OmnisearchAgent).
async function seedM21HelpCenterAgent() {
  const agentUser = await prisma.user.upsert({
    where: { email: 'help-center-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'help-center-agent@sistem.terminal-travel.local',
      fullName: 'HelpCenterAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      agentRole: 'HELP_CENTER_AGENT',
      moduleCode: 'M21',
      status: 'ACTIVE',
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });
}

// M21 spec §1/§2 (avgust 2026, vlasnikova odluka — M15 spec §11 "B2C_SITE omnisearch dopuna") —
// 4 starter članka za novu PUBLIC_GUEST publiku (anonimni B2C posetioci i logovani INDIVIDUAL
// gosti). Idempotentno preko upsert po slug-u, isti obrazac kao ostatak seed.ts. DRAFT +
// generatedBy=AI, approvedBy=null — nikad se ne objavljuju ovde (M21 pravilo, §2.1: approved_by
// obavezno pre PUBLISHED, nikad AI). Direktor/Vlasnik pregledaju i objavljuju kroz postojeći
// M17 ekran (apps/panel/src/app/(app)/pomoc/), isti tok kao svaki drugi nacrt.
// Sadržaj je namerno kratak, jednostavan jezik, bez pravnih tvrdnji van onoga što je stvarno
// implementirano/potvrđeno u spec-u (CLAUDE.md — "ne izmišljati tehničke detalje eksternih
// sistema... gde specifikacija eksplicitno kaže da to zahteva potvrdu").
const PUBLIC_GUEST_ARTICLES: {
  slug: string;
  relatedModule: string;
  sr: { title: string; body: string };
  en: { title: string; body: string };
}[] = [
  {
    slug: 'kako-otkazati-rezervaciju-i-povracaj-sredstava',
    relatedModule: 'M5',
    sr: {
      title: 'Kako se otkazuje rezervacija i kako radi povraćaj sredstava',
      body:
        'Rezervaciju otkazujete sa stranice "Moje rezervacije" na sajtu, dugmetom za otkazivanje.\n\n' +
        '**Pre nego što potvrdite otkazivanje, sajt vam unapred prikazuje procenat povraćaja** koji važi za vašu rezervaciju — ' +
        'taj procenat zavisi od toga koliko dana pre početka putovanja otkazujete i od pravila otkazivanja tog konkretnog ' +
        'aranžmana/smeštaja (svaki proizvod može imati svoja pravila, definisana u ugovoru sa dobavljačem). Što je otkazivanje ' +
        'bliže datumu polaska, procenat povraćaja je po pravilu niži.\n\n' +
        'Povraćaj se obračunava automatski na osnovu tih pravila — nema potrebe da sami računate, sajt vam pokaže tačan iznos ' +
        'pre nego što potvrdite. Ako niste sigurni šta konkretno pravilo znači za vašu rezervaciju, obratite se timu podrške pre ' +
        'nego što otkažete.',
    },
    en: {
      title: 'How to cancel a booking and how refunds work',
      body:
        'You cancel a booking from the "My bookings" page on the website, using the cancel button.\n\n' +
        '**Before you confirm the cancellation, the site shows you the exact refund percentage** that applies to your booking — ' +
        'this depends on how many days before departure you cancel and on the cancellation rules of that specific product ' +
        '(each product/accommodation can have its own rules, set in the supplier contract). The closer to the departure date, ' +
        'the lower the refund percentage typically is.\n\n' +
        'The refund is calculated automatically from those rules — you don\'t need to compute anything yourself, the site shows ' +
        'the exact amount before you confirm. If you are unsure what a specific rule means for your booking, contact our support ' +
        'team before cancelling.',
    },
  },
  {
    slug: 'sta-je-boravisna-taksa-i-ko-je-placa',
    relatedModule: 'M11',
    sr: {
      title: 'Šta je boravišna taksa i ko je plaća',
      body:
        'Boravišna taksa je lokalna naknada koju propisuje opština/grad u kojem se nalazi vaš smeštaj — nije deo cene aranžmana ' +
        'koju plaćate agenciji Terminal Travel.\n\n' +
        '**Boravišnu taksu naplaćuje i prijavljuje sam smeštajni objekat (hotel, apartman...) direktno gostu**, ne agencija. Terminal ' +
        'Travel ne obračunava, ne naplaćuje niti prosleđuje ovu taksu — to je zakonska obaveza smeštajnog objekta koji vas ' +
        'neposredno prima, ne turoperatora koji vam je prodao aranžman.\n\n' +
        'Tačan iznos i način plaćanja (gotovina na recepciji, uračunato u cenu smeštaja i sl.) zavisi od konkretnog smeštaja i ' +
        'destinacije — ako niste sigurni, najbolje je proveriti direktno sa smeštajem ili nas kontaktirati pa ćemo proslediti pitanje.',
    },
    en: {
      title: 'What is the local tourist tax and who pays it',
      body:
        'The tourist tax (boravišna taksa) is a local fee set by the municipality/city where your accommodation is located — it is ' +
        'not part of the package price you pay to Terminal Travel.\n\n' +
        '**The tourist tax is collected and reported by the accommodation itself (hotel, apartment...) directly from the guest**, ' +
        'not by the agency. Terminal Travel does not calculate, collect, or forward this tax — it is a legal obligation of the ' +
        'accommodation that hosts you directly, not of the tour operator that sold you the package.\n\n' +
        'The exact amount and payment method (cash at reception, included in the accommodation price, etc.) depends on the specific ' +
        'accommodation and destination — if you are unsure, it is best to check directly with the accommodation or contact us and ' +
        'we will forward the question.',
    },
  },
  {
    slug: 'kako-se-placa-rezervacija-kartica-ili-prenos',
    relatedModule: 'M10',
    sr: {
      title: 'Kako se plaća rezervacija (kartica ili bankovni prenos)',
      body:
        'Na sajtu možete platiti rezervaciju na dva načina:\n\n' +
        '**Platnom karticom** — plaćanje ide preko sertifikovanog platnog provajdera (Terminal Travel nikad ne vidi niti čuva broj ' +
        'vaše kartice). Naplata se dešava PRE nego što se rezervacija konačno potvrdi; ako se u međuvremenu ispostavi da termin/' +
        'kapacitet više nije dostupan, uplata se automatski poništava/vraća i dobijate jasno obaveštenje.\n\n' +
        '**Bankovnim prenosom** — rezervacija se potvrđuje odmah (bez čekanja na uplatu), a instrukcije za uplatu (račun, poziv na ' +
        'broj) dobijate na sajtu i u imejlu zajedno sa vaučerom. Uplatu vršite naknadno prema tim instrukcijama.\n\n' +
        'U zavisnosti od aranžmana, moguće je da se traži samo deo cene unapred (kapara), a ostatak do određenog roka pre putovanja — ' +
        'ta pravila su ista za oba načina plaćanja i biće vam jasno prikazana pre potvrde.',
    },
    en: {
      title: 'How to pay for a booking (card or bank transfer)',
      body:
        'You can pay for a booking on the website in two ways:\n\n' +
        '**By card** — payment goes through a certified payment provider (Terminal Travel never sees or stores your card number). ' +
        'The charge happens BEFORE the booking is finally confirmed; if the slot/capacity turns out to be unavailable in the ' +
        'meantime, the payment is automatically voided/refunded and you receive a clear notice.\n\n' +
        '**By bank transfer** — the booking is confirmed immediately (without waiting for payment), and payment instructions ' +
        '(account, reference number) are shown on the site and emailed together with your voucher. You then make the transfer ' +
        'according to those instructions.\n\n' +
        'Depending on the package, only part of the price may be required upfront (deposit), with the remainder due by a set ' +
        'deadline before travel — these rules are the same for both payment methods and will be clearly shown before you confirm.',
    },
  },
  {
    slug: 'sta-je-garancija-putovanja-yuta',
    relatedModule: 'M11',
    sr: {
      title: 'Šta je garancija putovanja (YUTA) i šta pokriva',
      body:
        'Terminal Travel, kao organizator putovanja, po zakonu mora da poseduje važeću godišnju garanciju putovanja (YUTA garancija) — ' +
        'to je uslov bez kog agencija ne sme da prodaje organizovana putovanja.\n\n' +
        'Svaka potvrđena rezervacija kod koje je Terminal Travel organizator prijavljuje se u zvaničan sistem koji prati raspoloživi ' +
        'limit garancije. Garancija služi kao zaštita gostiju u zakonom predviđenim slučajevima (npr. insolventnost organizatora).\n\n' +
        'Tehnički detalji same prijave i tačan obim pokrića zavise od važećih propisa i ugovora sa YUTA — ako vam je za konkretnu ' +
        'rezervaciju ili situaciju potrebna preciznija informacija, najbolje je da nas direktno kontaktirate, kako ne bismo dali ' +
        'nepotpun odgovor na osetljivo pravno pitanje.',
    },
    en: {
      title: 'What is the YUTA travel guarantee and what does it cover',
      body:
        'As a tour organizer, Terminal Travel is legally required to hold a valid annual travel guarantee (YUTA guarantee) — this is ' +
        'a precondition for the agency to be allowed to sell organized trips at all.\n\n' +
        'Every confirmed booking where Terminal Travel is the organizer is reported into the official system that tracks the ' +
        'available guarantee limit. The guarantee serves as protection for guests in the cases provided by law (e.g. organizer ' +
        'insolvency).\n\n' +
        'The technical details of the reporting itself and the exact scope of coverage depend on applicable regulations and the ' +
        'contract with YUTA — if you need a more precise answer for a specific booking or situation, it is best to contact us ' +
        'directly, so we don\'t give you an incomplete answer on a sensitive legal matter.',
    },
  },
];

async function seedM21PublicGuestArticles() {
  for (const item of PUBLIC_GUEST_ARTICLES) {
    const article = await prisma.helpArticle.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        audience: ['PUBLIC_GUEST'],
        relatedModule: item.relatedModule,
        isCriticalExample: false,
        status: 'DRAFT',
        generatedBy: 'AI',
      },
    });

    for (const [languageCode, translation] of [
      ['sr', item.sr],
      ['en', item.en],
    ] as const) {
      await prisma.helpArticleTranslation.upsert({
        where: { helpArticleId_languageCode: { helpArticleId: article.id, languageCode } },
        update: { title: translation.title, body: translation.body },
        create: { helpArticleId: article.id, languageCode, title: translation.title, body: translation.body },
      });
    }
  }
}

// M19 spec §5 — sistemski pošiljalac za "Obaveštenja" DIRECT razgovore (InAppNotificationsService,
// M18 CRITICAL isporuka). account_type=STAFF (ne AI_AGENT) da prođe ConversationParticipant
// ogradu za DIRECT (§2.2 — isključivo STAFF); nikad ne dobija password_hash, pa ne može da se
// prijavi (isto obrazbeno kao INVITED nalog koji čeka aktivaciju, samo trajno).
async function seedM19SystemNotificationUser() {
  await prisma.user.upsert({
    where: { email: 'obavestenja-sistem@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'obavestenja-sistem@sistem.terminal-travel.local',
      fullName: 'Terminal Travel — sistemska obaveštenja',
      accountType: 'STAFF',
      status: 'ACTIVE',
    },
  });
}

// M22 spec §4 — EmailInboxAgent, isti obrazac kao seedM19SupplierDraftAgent/seedM21HelpCenterAgent
// (formalni M1 nalog + AIAgent zapis da AuditLogEntry/AgentInvocationLog imaju actor_type=
// AI_AGENT). modelTier LIGHT je eksplicitna spec vrednost (§4 — sažimanje/nacrt jedne dolazne
// poruke, niska složenost, strukturna ograda je već sprovedena u EmailAiAssistantService, ne u
// tieringu). Bez ModuleAgentActivation gate-a — isti razlog kao HelpCenterAgent (§10, prvi prolaz).
async function seedM22EmailInboxAgent() {
  const agentUser = await prisma.user.upsert({
    where: { email: 'email-inbox-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'email-inbox-agent@sistem.terminal-travel.local',
      fullName: 'EmailInboxAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      agentRole: 'EMAIL_INBOX_AGENT',
      moduleCode: 'M22',
      status: 'ACTIVE',
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });
}

// M23 spec §3.2/§4/§7 — KnowledgeAgent, isti obrazac kao seedM21HelpCenterAgent/
// seedM22EmailInboxAgent. modelTier na AIAgent redu je LIGHT (agent ima DVA action-a sa
// različitim tier-ovima — knowledge_question.answer=LIGHT čisto pretraživanje, i
// knowledge_article.research_draft=STANDARD sinteza; AgentInvocationLogService rešava
// per-poziv tier preko requestedTier parametra u svakom pojedinačnom record() pozivu, ne mora
// agent-level polje da bude tačno za oba — isti obrazac kao ostali dvo-akcioni agenti).
async function seedM23KnowledgeAgent() {
  const agentUser = await prisma.user.upsert({
    where: { email: 'knowledge-agent@sistem.terminal-travel.local' },
    update: {},
    create: {
      email: 'knowledge-agent@sistem.terminal-travel.local',
      fullName: 'KnowledgeAgent (sistemski AI nalog)',
      accountType: 'AI_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.aIAgent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      agentRole: 'KNOWLEDGE_AGENT',
      moduleCode: 'M23',
      status: 'ACTIVE',
      modelTier: 'LIGHT',
      modelIdentifier: 'claude-haiku-4-5-20251001',
    },
  });
}

// M5/M17 spec §7.4 (27.8.2026, na zahtev vlasnika: "unesite mock podatke da vidim kako
// izgleda" novi "Kalendar rezervacija") — vizuelni mock, ISKLJUČIVO za lokalni pregled novog
// prikaza (mesec/nedelja/dan), ne test podataka za e2e. Idempotentno preko `bookingNumber`
// prefiksa `TT-MOCK-CAL-` (upsert `update: {}` — drugo pokretanje ne dodaje duplikate, zamka
// 5.3). Datumi su OFFSET od STVARNOG "danas" u trenutku pokretanja (ne fiksni kalendarski
// datum) — mock ostaje vidljiv u tekućem mesecu bez obzira kad se seed pokrene, uključujući
// jedan zapis koji namerno prelazi u naredni mesec (test granice mesečnog grida/nedelje).
// Referencira POSTOJEĆE prave `Product`/`MarkupRule`/`ClientAccount` zapise (ne izmišljene
// FK vrednosti) — ako lokalna baza nema nijedan ACCOMMODATION proizvod ili MarkupRule,
// funkcija se tiho preskače (npr. sveža baza pre prvog M2/M3 unosa).
async function seedM5CalendarMockBookings() {
  const accommodationProducts = await prisma.product.findMany({
    where: { type: 'ACCOMMODATION', status: 'ACTIVE' },
    select: { id: true, destinationCity: true, destinationCountry: true },
    distinct: ['destinationCity'],
    take: 20,
  });
  const markupRule = await prisma.markupRule.findFirst({ select: { id: true } });
  const clientAccount = await prisma.clientAccount.findFirst({ select: { id: true } });
  if (accommodationProducts.length === 0 || !markupRule || !clientAccount) {
    console.log('seedM5CalendarMockBookings: preskočeno (nema još ACCOMMODATION proizvoda/MarkupRule/ClientAccount u bazi)');
    return;
  }
  const byCity = new Map(accommodationProducts.map((p) => [p.destinationCity, p]));
  const pick = (city: string) => byCity.get(city) ?? accommodationProducts[0];

  function addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  interface MockEntry {
    n: number;
    city: string;
    fromOffset: number;
    toOffset: number;
    guests: string[];
    unitCount: number;
    itemStatus: 'CONFIRMED' | 'PENDING_SUPPLIER_CONFIRMATION';
    bookingStatus: 'CONFIRMED' | 'PENDING_SUPPLIER_CONFIRMATION' | 'MODIFIED';
    price: number; // u najmanjoj jedinici valute (centi)
  }
  const ENTRIES: MockEntry[] = [
    { n: 1, city: 'Budva', fromOffset: -12, toOffset: -8, guests: ['Marko Marković', 'Ana Marković'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 45000 },
    { n: 2, city: 'Halkidiki', fromOffset: -5, toOffset: 0, guests: ['Jovan Jovanović', 'Milica Jovanović', 'Uroš Jovanović'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 68000 },
    { n: 3, city: 'Rim', fromOffset: -2, toOffset: 3, guests: ['Petar Petrović'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'MODIFIED', price: 52000 },
    { n: 4, city: 'Zlatibor', fromOffset: 0, toOffset: 0, guests: ['Nikola Nikolić', 'Jelena Nikolić'], unitCount: 1, itemStatus: 'PENDING_SUPPLIER_CONFIRMATION', bookingStatus: 'PENDING_SUPPLIER_CONFIRMATION', price: 15000 },
    { n: 5, city: 'Solun', fromOffset: 3, toOffset: 7, guests: ['Stefan Stefanović', 'Ivana Stefanović', 'Luka Stefanović', 'Mila Stefanović'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 89000 },
    { n: 6, city: 'Pariz', fromOffset: -1, toOffset: 3, guests: ['Vladimir Vasić', 'Tamara Vasić'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 71000 },
    { n: 7, city: 'Kopaonik', fromOffset: 7, toOffset: 12, guests: ['Dragan Dragić', 'Snežana Dragić', 'Miloš Dragić', 'Sara Dragić'], unitCount: 2, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 132000 },
    { n: 8, city: 'Halkidiki', fromOffset: 1, toOffset: 1, guests: ['Filip Filipović', 'Sofija Filipović'], unitCount: 1, itemStatus: 'CONFIRMED', bookingStatus: 'CONFIRMED', price: 9000 },
  ];

  for (const entry of ENTRIES) {
    const bookingNumber = `TT-MOCK-CAL-${String(entry.n).padStart(4, '0')}`;
    const existing = await prisma.booking.findUnique({ where: { bookingNumber } });
    if (existing) continue; // idempotentno — ne dodaje duplikate na ponovno pokretanje

    const product = pick(entry.city);
    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        clientAccountId: clientAccount.id,
        buyerName: entry.guests[0],
        buyerType: 'FIZICKO_LICE',
        channel: 'INTERNAL_PANEL',
        tipNastupanja: 'ORGANIZATOR',
        status: entry.bookingStatus,
        paymentStatus: 'UNPAID',
        totalPrice: entry.price,
        currency: 'EUR',
        createdBy: 'seed-mock-calendar',
      },
    });
    const item = await prisma.bookingItem.create({
      data: {
        bookingId: booking.id,
        productId: product.id,
        sourceType: 'CONTRACTED',
        supplierReference: `MOCK-CAL-${entry.n}`,
        stayFrom: addDays(today, entry.fromOffset),
        stayTo: addDays(today, entry.toOffset),
        baseCost: Math.round(entry.price * 0.8),
        baseCostCurrency: 'EUR',
        markupRuleId: markupRule.id,
        finalPrice: entry.price,
        finalPriceCurrency: 'EUR',
        itemStatus: entry.itemStatus,
        unitCount: entry.unitCount,
      },
    });
    for (const fullName of entry.guests) {
      const [guestFirstName, ...rest] = fullName.split(' ');
      await prisma.bookingItemGuest.create({
        data: { bookingItemId: item.id, guestFirstName, guestLastName: rest.join(' ') || '—' },
      });
    }
  }
  console.log(`seedM5CalendarMockBookings: ${ENTRIES.length} mock rezervacija (TT-MOCK-CAL-*) proverenih/ubačenih`);
}

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika: "za plaćanje preko banke odabrati banku
// iz baze banaka") — spisak banaka licenciranih u Srbiji, ručno sastavljen iz javno poznatih
// podataka (NAMERNO nije povučen iz zvaničnog NBS registra — vidi CLAUDE.md "ne izmišljati
// tehničke detalje eksternih sistema" — ovo NIJE izmišljeno, ali NIJE ni potvrđeno protiv
// zvaničnog izvora; spisak bankarskog tržišta se povremeno menja usled spajanja/licenciranja).
// Upsert po `name` — dopuna/ispravka ide izmenom ove liste, ne ručnim SQL-om. Ako se pokaže
// netačnost, ispraviti ovde u istom prolazu kad se primeti.
/**
 * M5 spec §8.8 / M22 §2.1 — JEDNO zajedničko sanduče kroz koje ide sva prepiska sa dobavljačima
 * (najava, izmena, storno). Bez ovog reda `SupplierMailboxService` nema kuda da pošalje, pa
 * svaka najava ostaje u statusu PENDING_SEND („čeka slanje") — što je tačno, ali beskorisno.
 *
 * `provider_connection_ref = "smtp:env"` bira `SmtpEmailProviderAdapter` (M22 §10, 5.9.2026):
 * lokalno to znači mailpit iz `docker-compose.yml` — poruke se stvarno šalju i vide na
 * http://localhost:8025, a NIJEDNA ne odlazi stvarnom dobavljaču. Za pravo okruženje menja se
 * samo `SMTP_HOST` (i po potrebi ovaj `ref` na budući Gmail/Graph adapter) — kod ostaje isti.
 */
async function seedM22SupplierUnifiedInbox() {
  const address = 'dobavljaci@terminal-travel.local';
  const mailbox = await prisma.mailbox.upsert({
    where: { address },
    update: { isSupplierUnifiedInbox: true, providerConnectionRef: 'smtp:env', status: 'ACTIVE' },
    create: {
      address,
      displayName: 'Terminal Travel — dobavljači',
      mailboxType: 'SHARED',
      providerConnectionRef: 'smtp:env',
      isSupplierUnifiedInbox: true,
    },
  });
  console.log(`seedM22SupplierUnifiedInbox: jedinstveno sanduče za dobavljače ${mailbox.address} (${mailbox.id})`);
}

async function seedM10Banks() {
  const BANKS = [
    'Banca Intesa',
    'UniCredit Bank Srbija',
    'Raiffeisen banka',
    'OTP banka Srbija',
    'Erste Bank',
    'AIK banka',
    'Poštanska štedionica',
    'ProCredit Bank',
    'NLB Komercijalna banka',
    'Addiko Bank',
    'Eurobank Direktna',
    'Halkbank',
    'MIRABANK',
    'Mobi Banka',
    'Bank of China Srbija',
    'Expobank',
    'API Bank',
    'Srpska banka',
  ];
  for (const name of BANKS) {
    await prisma.bank.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`seedM10Banks: ${BANKS.length} banaka proverenih/ubačenih`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
