# Specifikacija modula M22 — Email/Inbox platforma

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M22) i poglavlje 8 (poprečan modul, ne vezan za jednu fazu — isti slučaj kao M17/M18/M19/M21)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna IT/pravna potvrda pre implementacije (poglavlje 10)
**Status:** Implementirano (backend + M17 ekran) — `apps/api/src/modules/m22-email-inbox/`, `apps/panel/src/app/(app)/email/`
**Verzija:** 1.5 — zatvoren nedostatak otkriven u M17 Faza 7 (16.8.2026): `GET /email/threads` i `GET /email/threads/:id` sada uključuju `mailbox: { address, displayName }` (čisto proširenje payload-a već autorizovanog upita — isti scoping preko `MailboxAccess`, bez potrebe za `M22/mailbox/VIEW`). Panel `/email` i `/email/[threadId]` ažurirani da koriste ovo polje umesto ranijeg best-effort poziva na `GET /mailboxes` (koji je za korisnike bez te uže dozvole vraćao 403). v1.4 — M17 ekran implementiran (avgust 2026, M17 Faza 7): `apps/panel/src/app/(app)/email/` — inbox (sanduče+niti), detalj niti (poruke, AI nacrt "pošalji", ručan odgovor, poveži rezervaciju/najavu dobavljača, pretvori u tiket), upravljanje sandučadima i pristupom. v1.3 — prvi prolaz implementacije backend-a (avgust 2026): generički `EmailProviderAdapter` sa mock implementacijom (poglavlje 10, prva otvorena stavka rešena za ovaj prolaz — mock, bez žive konekcije), `MailboxAccess` dvoslojna kontrola pristupa, `CorrespondentMatcherService`/`ReferenceMatcherService` (deterministički, bez poziva jezičkom modelu), `EmailAiAssistantService` (sažetak/nacrt sa strukturnom ogradom u kodu, ne samo prompt-om), konverzija u M14 `Ticket`. Pristup ličnim van-agencijskim mejl nalozima (poglavlje 10, druga stavka) ostaje otvoren, čeka IT/pravnu potvrdu. v1.2 — na zahtev vlasnika (avgust 2026), rešava problem #11: `EmailThread` dobija `related_supplier_manifest_id`/`related_supplier_change_notice_id`, novo poglavlje 3.1a (poklapanje po referentnom kodu `[REF: TT-NNNNNN]` za jedinstveno sanduče dobavljača, M5 poglavlje 8.8); v1.1 — dodat eksplicitan kanal prikaza (poglavlje 1, M17) — ranija verzija je opisivala modul kao "poprečan kao M17/M18/M19/M21" u zaglavlju, ali nikad nije rekla kroz koji UI tim stvarno vidi svoj inbox, za razliku od M19/M21 koji to eksplicitno navode; nalaz iz revizije Master dokumenta (avgust 2026). v1.0 — prvobitna specifikacija, zatvara problem #7 iz `Problemi koje zelimo da resimo ovom aplikacijom.md` (avgust 2026, na zahtev vlasnika)
**Zavisi od:** M1 (identitet, RBAC, audit log), M14 (konverzija u tiket), M6 (prepoznavanje gosta/nalogodavca), M7 (prepoznavanje subagenta), M3 (prepoznavanje dobavljača), M15 (AI agent okvir za sažimanje/nacrt odgovora), M17 (kanal — vidi poglavlje 1); od avgusta 2026 i M5 (poglavlje 3.1a, `SupplierManifest`/`SupplierChangeNotice` reference)

---

## 1. Svrha i obim modula

M22 je centralizovan email klijent unutar platforme — jedno mesto gde tim vidi i odgovara na svu poslovnu prepisku (agencijska deljena sandučad kao `rezervacije@`/`info@`, lična sandučad zaposlenih, prepiska sa gostima, subagentima i dobavljačima), sa eksplicitnom kontrolom ko sme da vidi/odgovara na koje sanduče, i AI agentom koji sažima i predlaže nacrt odgovora. Rešava problem koji je vlasnik direktno opisao: "tokom noći stigne 20 upita putem mejla" — tim treba da zatekne već sažete, delom već pripremljene odgovore ujutru, ne sirov, neorganizovan inbox.

Van obima: real-time chat sa dobavljačima (odvojen, budući problem #9 — vidi poglavlje 6 dole); formalno praćenje statusa zahteva za podršku ostaje M14 (`Ticket`) — M22 samo omogućava da se mejl **konvertuje** u tiket kad tim proceni da treba formalno praćenje (poglavlje 5).

**Kanal:** M22 nema sopstveni samostalan UI — prikazuje se kao nova sekcija unutar M17 (Interni radni panel), isti obrazac kao M19 (real-time chat, desktop kroz M17 PWA) i M21 (Centar za pomoć, kanal za tim). Nema posebne aplikacije za email; mobilni pristup (ako zatreba) ide istim putem kao M19 — novi tab u M9, ne nova aplikacija, dosledno principu #1 Master dokumenta (jedan izvor istine, prikazi se ne dupliraju).

### 1.1 Razlika u odnosu na M14 `Ticket`/`TicketMessage`

M14 postoji za zahteve koji zahtevaju praćenje statusa do rešenja (uključujući zakonski rok za reklamacije). M22 je širi i plići sloj ispod toga — sirov transport svake poslovne poruke, bez obzira da li ikad postane formalni tiket. Isti odnos kao M6 `CommunicationLog` naspram M14 `Ticket` (M14 poglavlje 1.1), samo jedan nivo niže: **`EmailMessage` (M22) → opciono `Ticket` (M14) → opciono sažetak u `CommunicationLog` (M6)** — tri različita nivoa detalja, ne tri kopije istog podatka.

### 1.2 Razlika u odnosu na M19 (interni tim-chat)

M19 je real-time chat isključivo zaposleni↔zaposleni. M22 pokriva email — drugačiji medijum (asinhron, spoljni korespondenti: gosti, subagenti, dobavljači), i eksplicitno uključuje spoljnu prepisku koju M19 namerno isključuje (M19 poglavlje 1: "komunikacija sa gostima/subagentima ostaje u M14/M6"). Ne zamenjuju jedan drugog.

---

## 2. Model podataka

### 2.1 `Mailbox`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| address | string, unique | mejl adresa (npr. `rezervacije@terminaltravel.rs`, ili lična adresa zaposlenog) |
| display_name | string | |
| mailbox_type | enum: `SHARED`, `PERSONAL` | `SHARED` — sandučad odeljenja/funkcije (`rezervacije@`, `dobavljaci@`); `PERSONAL` — sandučad pojedinačnog zaposlenog |
| owner_user_id | UUID, nullable (FK → M1 User) | samo za `PERSONAL` — podrazumevani vlasnik |
| provider_connection_ref | string | referenca ka kredencijalima konekcije (enkriptovano skladište, isti princip kao M4 `ProviderConfig`) |
| status | enum: `ACTIVE`, `INACTIVE` | |
| created_at | timestamp | |

### 2.2 `MailboxAccess` — pojedinačna dodela pristupa (potvrđeno na zahtev vlasnika, avgust 2026)

Pristup se **ne** izvodi iz opšte uloge (M1 RBAC) — svaki zaposleni mora biti eksplicitno dodat na svako sanduče do kog treba pristup, čak i ako nije vlasnik `PERSONAL` sandučeta.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| mailbox_id | UUID (FK) | |
| user_id | UUID (FK → M1 User) | |
| access_level | enum: `VIEW`, `REPLY` | `REPLY` implicitno uključuje `VIEW` |
| granted_by | UUID (FK → M1 User) | |
| granted_at | timestamp | |

Vlasnik `PERSONAL` sandučeta (`Mailbox.owner_user_id`) dobija `REPLY` automatski pri kreiranju sandučeta — ne mora se ručno dodeliti sam sebi.

### 2.3 `EmailThread`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| mailbox_id | UUID (FK) | |
| subject | string | |
| correspondent_type | enum: `GUEST`, `SUBAGENT`, `SUPPLIER`, `OTHER` | određuje se automatski po tačnom poklapanju mejl adrese (poglavlje 3.1) |
| correspondent_client_account_id | UUID, nullable (FK → M6 `ClientAccount`) | popunjeno kad `correspondent_type = GUEST`/`SUBAGENT` i mejl adresa tačno poklopi postojeći profil |
| correspondent_supplier_id | UUID, nullable (FK → M3 `Supplier`) | popunjeno kad `correspondent_type = SUPPLIER` |
| related_booking_id | UUID, nullable (FK → M5 `Booking`) | opciono, ručno ili AI-predloženo povezivanje (poglavlje 3.2) |
| related_supplier_manifest_id | UUID, nullable (FK → M5 `SupplierManifest`) | dopuna avgust 2026 (poglavlje 3.1a) — popunjeno kad je nit prepoznata kao odgovor na najavu rezervacije |
| related_supplier_change_notice_id | UUID, nullable (FK → M5 `SupplierChangeNotice`) | dopuna avgust 2026 (poglavlje 3.1a) — popunjeno kad je nit prepoznata kao odgovor na najavu izmene/storna |
| status | enum: `OPEN`, `AWAITING_REPLY`, `CLOSED` | |
| converted_to_ticket_id | UUID, nullable (FK → M14 `Ticket`) | popunjeno kad tim konvertuje nit u formalni tiket (poglavlje 5) |
| last_message_at | timestamp | |
| created_at | timestamp | |

### 2.4 `EmailMessage`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| thread_id | UUID (FK) | |
| direction | enum: `INBOUND`, `OUTBOUND` | |
| sender_type | enum: `CORRESPONDENT`, `STAFF`, `AI_DRAFT` | isti obrazac kao M14 `TicketMessage.sender_type` |
| from_address / to_addresses | string / string[] | |
| body | text | |
| ai_summary | text, nullable | popunjeno za `INBOUND` poruke kad AI sažme sadržaj (poglavlje 4) |
| sent_by | UUID, nullable (FK → M1 User) | popunjeno kad je `STAFF`/`AI_DRAFT` poruka stvarno poslata — isti mehanizam kao M14 `TicketMessage.sent_by` |
| provider_message_id | string, nullable | Message-ID header, za threading i idempotentnost pri ponovnom uvozu |
| received_at / created_at | timestamp | |

---

## 3. Prepoznavanje korespondenta i povezivanje sa rezervacijom

### 3.1 Tačno poklapanje adrese, ne fuzzy-match

Za razliku od M5 poglavlja 6.4 (fuzzy-match imena gosta pri otkazivanju) i M10 poglavlja 8.6.3 (fuzzy-match imena pri uvozu faktura), ovde je dostupan pouzdaniji identifikator — sama mejl adresa. `EmailThread.correspondent_type`/`correspondent_client_account_id`/`correspondent_supplier_id` se određuju **tačnim poklapanjem** `from_address` prve `INBOUND` poruke naspram M6 `GuestProfile.email`/`ClientAccount` kontakt mejla (subagent) i M3 `Supplier` kontakt mejla — nivo **"Autonomno"**, čista deterministička provera, bez poziva jezičkom modelu (isti princip kao M18 poglavlje 6.2, "Najvažniji nalaz"). Bez poklapanja, ostaje `correspondent_type = OTHER` dok se ručno ne poveže.

### 3.1a Poklapanje po referentnom kodu za prepisku sa dobavljačima (dopuna, avgust 2026 — rešava problem #11, vidi M5 poglavlje 8.8)

Za nit u sandučetu koje je označeno kao jedinstveno sanduče za dobavljače (M5 poglavlje 8.8), svaka nova `INBOUND` poruka se dodatno proverava na obrazac `[REF: TT-NNNNNN]` u naslovu i telu poruke, **pre** fuzzy-match pokušaja iz poglavlja 3.2. Ovo je pouzdaniji signal od bilo kog fuzzy-matching-a — isti princip kao broj tiketa u naslovu (M14) — jer referenca dolazi direktno od nas (upisana pri slanju, M5 poglavlje 8.8) i hotel je najčešće samo vraća neizmenjenu kroz "Reply".

**Tok:**
1. Ako se prepozna tačan `TT-NNNNNN` obrazac koji odgovara postojećem `SupplierManifest.reference_code` ili `SupplierChangeNotice.reference_code` (M5) — `related_supplier_manifest_id`/`related_supplier_change_notice_id` se popunjava kao **predlog**, nivo **"Autonomno"** za samo prepoznavanje/predlaganje (čisto informativno, ništa se još ne piše u M5 status).
2. Ako referenca nije pronađena, pokušava se fuzzy-match po imenu dobavljača/gosta/datumima (isti obrazac kao poglavlje 3.2 i M5 poglavlje 6.4) — slabiji predlog, jasno obeležen u UI drugačije od poklapanja po referenci (npr. "predlog po sličnosti" naspram "tačna referenca").
3. **Konačno postavljanje `BookingItem.supplier_confirmed_at`/`by` (M5)** zahteva eksplicitnu potvrdu zaposlenog kroz `M5/supplier-confirmation/CONFIRM` (M5 poglavlje 10) — M22 sam nikad ne piše u M5 status, samo predlaže vezu; potvrđeno sa vlasnikom da ovo važi bez obzira na pouzdanost poklapanja (poglavlje 3.1a se ovim namerno razlikuje od `related_booking_id` u poglavlju 3.2, gde je ceo predlog interan M22 podatak — ovde predlog prelazi granicu modula ka M5 stanju rezervacije, pa nosi isti oprez kao svaka druga izmena preko granice modula, princip #2 Master dokumenta).

### 3.2 Povezivanje sa rezervacijom — predlog, ne automatski upis

AI agent sme da **predloži** `related_booking_id` (npr. na osnovu broja rezervacije pomenutog u tekstu poruke ili prepoznatih datuma/destinacije u kombinaciji sa već poznatim `correspondent_client_account_id`) — nivo **"Predloži pa čovek odobri"**, jer pogrešno povezivanje pokazuje timu pogrešan kontekst rezervacije pri odgovaranju. Ručna potvrda popunjava polje.

---

## 4. Uloga AI agenta — sažimanje, nacrt, nikad tiho slanje van dozvoljenih kategorija

Isti dvostepeni obrazac kao M14 poglavlje 4, primenjen na email:

- AI agent sme samostalno (nivo **"Autonomno"**) da sažme svaku novopristiglu `INBOUND` poruku (`ai_summary`) i pripremi nacrt odgovora (`EmailMessage` sa `sender_type = AI_DRAFT`, `sent_by = null`) — ovo pokriva tačno scenario koji je vlasnik opisao (20 upita preko noći, tim ujutru zatiče sažetke i nacrte, ne sirov inbox).
- Nacrt koji pominje cenu, obavezu, promenu rezervacije, ili bilo koju odluku van čisto informativnog odgovora **ne sme biti poslat** dok ga čovek ne pregleda i pošalje (`sent_by` popunjeno) — nivo **"Predloži pa čovek odobri"**, identično M14 poglavlju 4.
- Čisto informativni odgovori (npr. "kako se preuzima vaučer", pitanja već pokrivena M21 bazom znanja) mogu biti poslati direktno **samo ako je to eksplicitno podešeno** za dato sanduče — podrazumevano, svaki AI nacrt čeka ljudski pregled dok se sistem ne pokaže pouzdan, isto opreznо ponašanje kao M14.
- AI agent nikad sam ne menja `MailboxAccess`, ne konvertuje nit u `Ticket` (poglavlje 5 — to ostaje ljudska radnja, ili eksplicitan predlog koji čovek potvrđuje), i nema pristup sandučetu za koje nema `MailboxAccess` zapis (isto ograničenje kao ljudski nalog — princip najmanjih ovlašćenja iz M15 poglavlja 7).

---

## 5. Konverzija u M14 `Ticket`

Kad zaposleni proceni da mejl zahteva formalno praćenje statusa (npr. reklamacija sa zakonskim rokom, M14 poglavlje 3.1), konvertuje `EmailThread` u `Ticket` — isti obrazac kao M21 eskalacija ka M14 (`Ticket.channel = HELP_CENTER`, M21 poglavlje 5.3). Ovde: `Ticket.channel = EMAIL`, `Ticket.source_email_thread_id` (novo, nullable polje — dopuna `14-SPECIFIKACIJA-M14-HELPDESK.md` poglavlje 2.1, u istom prolazu) referencira nit, `requester_client_account_id` se preuzima iz `EmailThread.correspondent_client_account_id` ako je popunjeno. `EmailThread.converted_to_ticket_id` se popunjava recipročno. Ovo je ljudska radnja (dugme "Pretvori u tiket") — AI agent sme da **predloži** konverziju (nivo "Predloži pa čovek odobri", npr. kad prepozna obrazac reklamacije), nikad je sam ne izvršava.

---

## 6. Dobavljači u obimu (potvrđeno na zahtev vlasnika, avgust 2026)

Prepiska sa dobavljačima (npr. slanje `SupplierManifest`-a i odgovori dobavljača, M5 poglavlje 8.4) ide kroz isti `Mailbox`/`EmailThread` model — `correspondent_type = SUPPLIER`. Ovo **ne zamenjuje** M5 `SupplierManifest` kao entitet (i dalje živi u M5, sa sopstvenim tokom slanja/potvrde) — M22 je samo transportni sloj u kom ta i svaka druga mejl prepiska sa dobavljačem fizički postoji, sa istom kontrolom pristupa i AI sažimanjem kao svako drugo sanduče. Od avgusta 2026 (poglavlje 3.1a), za tačno jedno sanduče (jedinstveno sanduče za dobavljače, M5 poglavlje 8.8) ovaj transportni sloj dodatno prepoznaje referentni kod i predlaže vezu nazad ka M5.

**Razgraničenje od problema #9 (chat sa dobavljačima):** #9 traži poseban **real-time chat** kanal (desktop + mobilni) sa dobavljačima — to ostaje odvojen, budući gap (M22 ne uvodi real-time komunikaciju, samo email). Uključivanjem dobavljača ovde u obim email-a, deo operativne potrebe iz #9 je već pokriven (asinhrona prepiska); #9 ostaje otvoren isključivo za real-time deo.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M22/mailbox/VIEW`, `CREATE`, `EDIT` | Vlasnik, Direktor — upravljanje konekcijama sandučadi |
| `M22/mailbox-access/GRANT` | Vlasnik, Direktor — dodela `MailboxAccess` (poglavlje 2.2) |
| `M22/email-thread/VIEW` | Svaki zaposleni sa `MailboxAccess.access_level ∈ {VIEW, REPLY}` za dato sanduče — **ovo se proverava po pojedinačnom sandučetu, ne po opštoj ulozi** |
| `M22/email-thread/REPLY` | Svaki zaposleni sa `MailboxAccess.access_level = REPLY` za dato sanduče |
| `M22/email-thread/CONVERT_TO_TICKET` | Isto kao `REPLY` na dotičnom sandučetu |

---

## 8. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/email`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/mailboxes` | GET / POST | pregled / kreiranje sandučeta, zahteva `M22/mailbox/CREATE` |
| `/mailboxes/:id/access` | GET / POST | pregled / dodela `MailboxAccess`, zahteva `M22/mailbox-access/GRANT` |
| `/threads` | GET | lista niti, filtrirano po `mailbox_id`/`status`/`correspondent_type` — samo sandučad na koja korisnik ima pristup; odgovor uključuje `mailbox: { address, displayName }` (M17 Faza 7, rešeno 16.8.2026) |
| `/threads/:id` | GET | detalji sa svim `EmailMessage` porukama i `mailbox: { address, displayName }` |
| `/threads/:id/messages` | POST | dodavanje poruke (nacrt ili direktno slanje), zahteva `REPLY` |
| `/threads/:id/messages/:messageId/send` | POST | ljudska potvrda slanja AI nacrta |
| `/threads/:id/convert-to-ticket` | POST | konverzija u M14 `Ticket` (poglavlje 5), zahteva `CONVERT_TO_TICKET` |
| `/threads/:id/link-booking` | POST | ručna potvrda `related_booking_id` (poglavlje 3.2) |
| `/threads/:id/link-supplier-announcement` | POST | ručna potvrda `related_supplier_manifest_id`/`related_supplier_change_notice_id` (poglavlje 3.1a) — samo veza u M22; stvarno postavljanje M5 `supplier_confirmed_at` ide preko posebnog M5 endpoint-a (M5 poglavlje 8.8), zahteva `M5/supplier-confirmation/CONFIRM` |

---

## 9. Izlazni kriterijum (M22)

- [x] Zaposleni bez `MailboxAccess` zapisa za dato sanduče ne može ni da vidi ni da odgovori na niti u tom sandučetu, čak i ako ima široku ulogu (Direktor/Vlasnik izuzetak samo ako je eksplicitno tako dodeljen). *(e2e `m22-exit-criteria.e2e-spec.ts`)*
- [x] Vlasnik `PERSONAL` sandučeta automatski ima `REPLY` pristup sopstvenom sandučetu bez ručne dodele. *(unit + e2e)*
- [x] `EmailThread.correspondent_type`/`correspondent_client_account_id`/`correspondent_supplier_id` se ispravno određuju tačnim poklapanjem mejl adrese, bez fuzzy-match rizika pogrešnog poklapanja. *(unit `correspondent-matcher.service.spec.ts` — sve četiri putanje: GuestProfile/ClientAccount+Subagent/Supplier/SupplierContact/OTHER)*
- [x] AI sažetak i nacrt odgovora se automatski generišu za svaku novu `INBOUND` poruku, bez ljudske intervencije (kad je `ANTHROPIC_API_KEY` podešen — graceful degradation bez ključa, isti obrazac kao M21). *(unit `email-ai-assistant.service.spec.ts` + poziv na svaku `receiveInboundMessage`)*
- [x] Nacrt koji pominje cenu/obavezu/promenu rezervacije se ne može poslati bez `sent_by` popunjenog ljudskim nalogom — sprovedeno nezavisno u kodu (keyword-heuristika), ne samo prompt-om. *(unit — nacrt ostaje `AI_DRAFT`/`sentBy=null` čak i kad model "misli" da je gotov za slanje)*
- [x] Konverzija u `Ticket` ispravno popunjava `Ticket.source_email_thread_id`/`EmailThread.converted_to_ticket_id` recipročno, i `requester_client_account_id` na tiketu kad je poznat. *(e2e)*
- [x] AI agent nikad ne konvertuje nit u tiket niti menja `MailboxAccess` samostalno — samo predlaže, gde je predviđeno. *(statička provera koda — `EmailAiAssistantService` nema zavisnost na `TicketConversionService`/`MailboxAccess` upis)*
- [x] Prepiska sa dobavljačem (`correspondent_type = SUPPLIER`) koristi isti model pristupa/AI sažimanja kao gost/subagent nit. *(e2e)*
- [x] `INBOUND` poruka sa `[REF: TT-NNNNNN]` u naslovu koji odgovara postojećem `SupplierManifest`/`SupplierChangeNotice` (M5) ispravno popunjava `related_supplier_manifest_id`/`related_supplier_change_notice_id` kao predlog (poglavlje 3.1a); poruka bez prepoznate reference pada na fuzzy-match predlog. *(unit `reference-matcher.service.spec.ts` + e2e)*
- [x] Test: M22 sam nikad ne piše u M5 `supplier_confirmed_at`/`by` — provereno da ta promena postoji samo kroz M5 endpoint sa `M5/supplier-confirmation/CONFIRM`, bez obzira na pouzdanost M22 predloga. *(e2e — grep-provera koda kroz `src/modules/m22-email-inbox`, nula pojava `confirmSupplier`/`supplierConfirmedAt`/`supplierConfirmedBy` van komentara)*
- [ ] M17 ekran (poglavlje 1) — namerno van obima ovog prolaza, sledeći poseban korak (isti obrazac kao M18/M19/M21 pre svog M17 prolaza).

---

## 10. Otvoreno za dalje

- **Izbor konkretnog email provajdera/API-ja** (Gmail API, Microsoft Graph/Outlook, generički IMAP/SMTP) — ovaj dokument definiše samo generički `EmailProviderAdapter` (isti obrazac kao `ProviderAdapter` M4 / `PaymentGatewayAdapter` M10), tako da izbor provajdera ne zahteva izmenu ostatka modula. Bira se pri implementaciji.
- **Pristup ličnim (van-agencijskim) mejl nalozima zaposlenih**, ako neko koristi ličan Gmail/Outlook nalog umesto agencijskog domena — zahteva IT/pravnu potvrdu pre implementacije (OAuth pristanak, GDPR/Zakon o zaštiti podataka o ličnosti obim), isto obrazloženje kao ostale stavke koje čekaju potvrdu pravnika/IT-ja u ostatku specifikacije (npr. M10 poglavlje 6.3).
- **Real-time chat sa dobavljačima** (problem #9) ostaje potpuno odvojen otvoren gap — ovaj modul pokriva samo email deo te potrebe (poglavlje 6).
- Tačan mehanizam podešavanja "auto-send" praga za čisto informativne kategorije (poglavlje 4) — globalno vs. po sandučetu vs. po kategoriji — definiše se kad se dođe do stvarne izrade.
- Pretraga/arhiva starih niti, i period čuvanja mejlova (retencija, u skladu sa Zakonom o zaštiti podataka o ličnosti) — van obima ove verzije.
