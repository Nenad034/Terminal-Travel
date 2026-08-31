# Specifikacija modula M1 — Core / Identitet i pristup

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M1) i poglavlje 8 (Faza 0)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.9 — (31.8.2026, na zahtev vlasnika, isti prolaz kao M5 §6.5/M7 §2.0.7 franšiza) Nova opšta konvencija **`VIEW_ALL`** dozvole uz svaku osnovnu `VIEW` dozvolu (§3.9a) — zamenjuje raniji, neusklađen podrazumevani model ("Prodajni agent vidi samo svoje") sa stvarnom odlukom vlasnika: **podrazumevano svi vide sve**, sužavanje na "samo svoje" je podesiva opcija po korisniku (`DENY` na `VIEW_ALL`), primenjuje se prvo u M5 (poglavlje 6.5), opšta je za ceo sistem. `User.linked_profile_id` (§3.1) prošireno da nosi referencu ka M7 `Subagent` i za `STAFF` naloge (§3.1a) — omogućava franšiznim zaposlenima pune M1 uloge (Prodajni agent, Sales Manager, Direktor) uz vezu ka sopstvenoj franšizi; `POST /users` dobija ownership proveru kad ga poziva franšizni "lokalni Direktor" (dopuna poglavlja 5). Čisto specifikaciona dopuna, bez koda u ovom prolazu — implementacija prati M5/M7 gradnju.
**Verzija:** 1.8 — `UserPreference` (§3.9) konačno IZGRAĐEN (24.8.2026, na zahtev vlasnika — povod: "Sačuvani prikazi" za M5 listu rezervacija, dizajn dok. §5b). Bio je speciran od v1.6 (18.8.2026), nula reda koda do sada. Novi Prisma model `UserPreference` (`user_id`+`key`+`value: Json`, unique po `(user_id, key)`, migracija `20260825072055_m1_user_preference`), `UserPreferencesService` (`findAll`/`set`), dva nova endpointa u `UsersController` (`GET /iam/users/me/preferences`, `PUT /iam/users/me/preferences/:key`) — BEZ `@RequirePermission` (spec §3.9: "ne prolazi kroz RBAC iznad 'ovo je moj sopstveni nalog'"), `userId` dolazi isključivo iz JWT-a (`@CurrentUser`), nikad iz parametra rute. Prvi stvaran korisnik ovog mehanizma: M17 `SavedViewsSidebarPanel.tsx` (vidi M5 spec changelog za pun opis te funkcije).
**Provera:** `tsc --noEmit` čist za `apps/api`; uživo kroz pravu VLASNIK sesiju (pravi login+MFA, ne dev-login) — `PUT /iam/users/me/preferences/saved_views.rezervacije_lista` sa telom `{"value":[...]}` vraća HTTP 200 sa upisanom vrednošću; naredni `GET /iam/users/me/preferences` vraća mapu koja sadrži tačno taj ključ/vrednost — potvrđuje pravi upis/čitanje iz baze (Postgres), ne samo prolazak kroz DTO validaciju.
**Verzija:** 1.7 — M17 panel BFF konačno koristi `POST /auth/refresh` (23.8.2026) — endpoint postoji i testiran je od v1.3, ali `apps/panel/src/lib/api-client.ts` ga nikad nije pozivao, pa je svaki panel zahtev posle 15-minutnog isteka access tokena (§3.7) tiho dobijao 401 umesto da se osveži refresh tokenom koji je sesija već čuvala 7 dana. Ispravljeno u M17 (vidi `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md` v1.86 za pun opis/proveru) — ovaj upis samo beleži da je specificiran, dugo neiskorišćen mehanizam sad stvarno ožičen na jedinom mestu koje ga je trebalo koristiti. v1.6 — novo poglavlje 3.9 `UserPreference` (18.8.2026, na zahtev vlasnika): generičko ključ-vrednost skladište ličnih UI podešavanja po korisniku (širina panela, tema, oblik forme Ponuda→Rezervacija) — formalizuje mesto čuvanja koje je dizajn dokument (`29-DIZAJN-SISTEM-UI.md`) do sad samo pretpostavljao bez definisanog modela; novi endpoint-i `GET/PUT /users/me/preferences` (poglavlje 6). v1.5 — dodat `POST /auth/register` za samostalnu registraciju gosta (poglavlje 5, poglavlje 6), zavisnost M8 (dopuna avgust 2026, priprema za implementaciju M8); v1.4 — automatizovani testovi (avgust 2026): 77 unit testova (`*.spec.ts`, mokovan Prisma — auth login/2FA/lockout/refresh-rotacija/reset lozinke, RBAC evaluacija §3.6 svih pet koraka, guard-ovi, enkripcija/heš) plus 9 e2e testova (`test/m1-exit-criteria.e2e-spec.ts`, prava Postgres baza preko docker-compose) koji direktno dokazuju stavke 1, 2, 3, 4 i 5 izlaznog kriterijuma (poglavlje 8 ovog dokumenta) — uključujući append-only trigger, live efekat `UserPermissionOverride` bez ponovne prijave, i pun login→MFA HTTP tok. Stavka 6 (IaC za produkciju) ostaje otvorena, čeka odluku o hosting provajderu. `npm test` / `npm run test:e2e` u `apps/api`; v1.3 — počela implementacija (avgust 2026, Faza 0): `apps/api/src/modules/m1-core-identitet/` — auth (login/MFA/refresh/lockout/reset), RBAC evaluacija uživo (§3.6), audit log (append-only trigerom, §3.8), users/roles/permission-override CRUD, seed 7 sistemskih uloga. Testirano uživo (login, pogrešna lozinka, RBAC odbijanje, append-only trigger). Ostaje: infrastruktura iz IaC koda (poglavlje 8, trenutno docker-compose je samo za lokalni razvoj), UI ekrani (poglavlje 7); v1.2 dodat `account_type = SUPPLIER_CONTACT` i uloga DOBAVLJAC_KONTAKT (poglavlje 4), dopuna M19 specifikacije za problem #9 (real-time chat sa dobavljačima), avgust 2026; v1.1 dodata sekcija UI ekrani (poglavlje 7), potvrđena klikabilnim prototipom `00-MOCKUP-M1-IDENTITET.html`
**Zavisi od:** — (temelj svih ostalih modula)

---

## 1. Svrha i obim modula

M1 je temelj cele platforme Terminal. Odgovara na tri pitanja za svaki zahtev koji stigne bilo kom modulu: **ko si** (autentikacija), **šta smeš** (autorizacija/RBAC), i **ko je šta uradio** (audit log). Nijedan drugi modul ne implementira sopstvenu proveru identiteta ili prava — svi pozivaju M1.

Van obima ove specifikacije: poslovni profil gosta/nalogodavca (to je M6), poslovni profil subagenta (to je M7). M1 čuva samo **identitet za prijavu** (login nalog) i vezu (referencu) ka tim profilima — u skladu sa principom "jedan izvor istine" iz poglavlja 3.

---

## 2. Arhitektonska odluka: sopstveni IAM sloj, ne Keycloak

Poglavlje 6 Master dokumenta ostavlja otvorenim izbor između Keycloak-a i Auth.js sa sopstvenim RBAC slojem. Za M1 se bira **drugo**: autentikacija i autorizacija se grade kao deo NestJS backend-a, sa podacima u istoj PostgreSQL bazi, kroz Prisma.

**Razlog:** Zahtev da se odobrenje podešava "do nivoa stavke unutar modula, po korisniku" (pojedinačni izuzeci iznad uloge) ne uklapa se prirodno u Keycloak-ov gotov model uloga — prisiljavanje Keycloak-a da to radi zahtevalo bi njegov poseban "Authorization Services" sloj, sa sopstvenom logikom, dokumentacijom i Java okruženjem odvojenim od ostatka steka. Pošto je ceo stek namerno jednojezičan (TypeScript svuda — poglavlje 6), a fini model dozvola je lakše i transparentnije graditi direktno nad sopstvenom šemom, M1 implementira sopstveni, jednostavan IAM sloj. Ovo ne menja bezbednosne zahteve iz poglavlja 9 (enkripcija, audit log) — samo ko implementira tu logiku.

---

## 3. Model podataka (entiteti)

### 3.1 `User` — nalog za prijavu
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| email | string, unique | koristi se za prijavu |
| password_hash | string | Argon2id heš, nikad plain-text |
| full_name | string | |
| phone | string, nullable | |
| account_type | enum: `STAFF`, `GUEST`, `SUBAGENT_CONTACT`, `AI_AGENT` *(dodato pri specifikaciji M15, Faza 7)*, `SUPPLIER_CONTACT` *(dodato pri dopuni M19, problem #9, avgust 2026)* | određuje koji modul "poseduje" poslovni profil vezan za ovaj login; `AI_AGENT` nema poslovni profil — vidi M15 specifikaciju, poglavlje 2 |
| linked_profile_id | UUID, nullable | referenca ka M6 (Nalogodavac/Gost) ili M7 (Subagent) profilu — bez dupliranja podataka; od 31.8.2026 i `STAFF` nalog sme nositi referencu ka M7 `Subagent` kad pripada franšizi (poglavlje 3.1a) |
| status | enum: `INVITED`, `ACTIVE`, `SUSPENDED` | `INVITED` dok korisnik ne aktivira nalog preko linka poslatog na email |
| mfa_enabled | boolean | |
| mfa_secret_encrypted | string, nullable | TOTP secret, enkriptovan u mirovanju |
| failed_login_attempts | integer, default 0 | za privremeno zaključavanje naloga |
| locked_until | timestamp, nullable | |
| last_login_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

### 3.2 `Role` — uloga
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| name | string, unique | npr. `VLASNIK`, `DIREKTOR`, `HR`, `SALES_MANAGER`, `PRODAJNI_AGENT`, `RACUNOVODJA`, `GOST` |
| description | text | |
| is_system_role | boolean | `true` za sve podrazumevane uloge nabrojane u poglavlju 4 (danas devet: sedam osnovnih + `SUBAGENT_ADMIN` + `VODIC`, dodavane kako su moduli dolazili na red) — ne mogu se obrisati, samo dopuniti |

Katalog uloga je **proširiv** — kad M7 (subagenti) dođe na red u Fazi 4, dodaju se uloge tipa `SUBAGENT_ADMIN`/`SUBAGENT_USER` bez izmene modela iz M1.

### 3.3 `Permission` — katalog mogućih dozvola
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| module | string | kod modula, npr. `M5`, `M10` |
| resource | string | npr. `booking`, `invoice`, `user`, `report:sales` |
| action | string (slobodan tekst, ne strogi enum) | najčešće `VIEW`, `CREATE`, `EDIT`, `DELETE`, `APPROVE`, `EXPORT`, ali svaki modul sme uvesti sopstvenu akciju kad zatreba (npr. `PUBLISH` u M2, `SUBMIT` u M10/M11, `ACTIVATE` u M15) — enum bi bio prestrog s obzirom na to koliko je specifičnih poslovnih radnji već uvedeno kroz module |
| description | text | |

Svaki modul, kad se specificira (Nivo 2 za taj modul), registruje svoj set dozvola u ovaj katalog — M1 samo drži tabelu, ne zna poslovno značenje.

### 3.4 `RolePermission` — podrazumevana prava po ulozi
Spojna tabela: `role_id`, `permission_id`. Definiše šta uloga *podrazumevano* sme (uvek `ALLOW` — uloge ne nose zabrane, samo dodele).

### 3.5 `UserRole` — dodela uloge korisniku
Spojna tabela: `user_id`, `role_id`, `assigned_by` (user_id), `assigned_at`. Korisnik može imati više uloga istovremeno (npr. Sales Manager koji je i Prodajni agent).

### 3.6 `UserPermissionOverride` — pojedinačni izuzetak (srž traženog "do nivoa stavke")
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| user_id | UUID | kome se dodeljuje/oduzima |
| permission_id | UUID | koja dozvola |
| effect | enum: `ALLOW`, `DENY` | |
| reason | text, obavezno | zašto — ne sme biti prazno |
| granted_by | UUID (user_id) | ko je odobrio |
| granted_at | timestamp | |
| expires_at | timestamp, nullable | opciono vremensko ograničenje (npr. privremeni pristup) |

**Pravilo evaluacije prava** (redosled, jače pobeđuje):
1. Podrazumevano: **DENY** (ništa nije dozvoljeno dok se eksplicitno ne odobri).
2. Sve `ALLOW` dozvole iz uloga dodeljenih korisniku → podižu na `ALLOW`.
3. `UserPermissionOverride` sa `effect = DENY` → uvek pobeđuje, bez obzira na ulogu (eksplicitna zabrana je najjača).
4. `UserPermissionOverride` sa `effect = ALLOW` → dodaje pristup i preko onoga što uloga nosi.
5. Isteklі override-i (`expires_at` u prošlosti) se ignorišu kao da ne postoje.

Provera prava se radi **uvek uživo nad bazom** u trenutku zahteva (ne iz JWT tokena), jer se override može promeniti bilo kad, a token ne sme nositi zastarelu sliku prava.

**Bezbednosna ograda:** dodela/oduzimanje `UserPermissionOverride` je sama po sebi dozvola (`M1 / permission-override / CREATE`) koju ima samo Vlasnik i Direktor podrazumevano; korisnik ne može menjati sopstvene dozvole (provera: `granted_by != user_id` na nivou API-ja).

### 3.7 `RefreshToken` (sesija)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| user_id | UUID | |
| token_hash | string | čuva se heš, ne sirov token |
| issued_at / expires_at | timestamp | |
| revoked_at | timestamp, nullable | omogućava ručno odjavljivanje svih uređaja |
| ip_address / user_agent | string | za audit i otkrivanje sumnjive aktivnosti |

Access token je kratkotrajan JWT (15 min), nosi samo `user_id` i `session_id` — ništa o pravima. Refresh token (7 dana, rotira se pri svakom korišćenju) služi za obnovu.

### 3.8 `AuditLogEntry`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| timestamp | timestamp | |
| actor_type | enum: `HUMAN`, `AI_AGENT`, `SYSTEM` | u skladu sa poglavljem 7 Master dokumenta |
| actor_id | UUID, nullable | user_id ili id AI agenta |
| module | string | |
| action | string | npr. `booking.cancel`, `permission_override.grant` |
| resource_type / resource_id | string / UUID | |
| before_state / after_state | JSONB, nullable | snimak pre/posle izmene |
| context | JSONB | slobodan prostor (razlog, request id, itd.) |
| ip_address | string, nullable | prazno za AI/SYSTEM akcije bez HTTP konteksta |

Tabela je **append-only** — na nivou baze se onemogućava UPDATE/DELETE nad njom (DB rola bez tih prava, ili trigger koji odbija). Ovo je direktna primena principa #5 iz poglavlja 3.

### 3.9a Konvencija: dozvola širokog obima (`VIEW_ALL`) uz osnovnu `VIEW` dozvolu (dopuna, 31.8.2026, na zahtev vlasnika)

**Problem koji ovo rešava:** dosadašnji model dozvola je gruб (modul/resurs/akcija — poglavlje 3.3/3.4) i nema pojam "vidim SVE zapise" naspram "vidim SAMO svoje zapise" unutar iste dozvole. M5 poglavlje 6.5 je prvi modul koji ovo stvarno zahteva (ko vidi čije rezervacije), ali je namerno napisan kao **opšta konvencija ovde u M1**, ne kao jednokratno rešenje unutar M5 — svaki budući modul sa istim problemom (npr. "vidim samo svoje tikete" u M14) je primenjuje bez nove arhitekture.

**Mehanizam (bez izmene `UserPermissionOverride` šeme — poglavlje 3.5, i dalje ALLOW/DENY po (korisnik, dozvola)):**
- Modul koji ima ovaj problem registruje **dve dozvole** za taj resurs: osnovnu (`M5/booking/VIEW`) i pratећu širu (`M5/booking/VIEW_ALL`).
- **Podrazumevano ponašanje (vlasnikova odluka, 31.8.2026): korisnik sa osnovnom `VIEW` dozvolom vidi SVE zapise** (ne samo svoje) — ovo je promena u odnosu na raniju, neusklađenu formulaciju u poglavlju 4 ("Prodajni agent — ograničeno na sopstvene"), koja je ovim dokumentom ispravljena da odgovara stvarnoj odluci.
- Sužavanje na "samo svoje" ide **isključivo preko eksplicitnog `DENY` na `VIEW_ALL`** za tog korisnika (`UserPermissionOverride`, `reason` obavezan kao i inače) — nikad automatski po ulozi. Ko se smatra "svoje" definiše modul koji dozvolu koristi (npr. M5 poglavlje 6.5: vlasnik ILI trenutno zadužen za taj zapis).
- Servisni sloj koji primenjuje ovu konvenciju (npr. `BookingsService.findAll`) proverava `VIEW_ALL` **uvek uživo preko RBAC evaluacije** (§3.6), nikad iz JWT-a — isti obrazac kao svaka druga dozvola u sistemu.
- **Franšizni obim (M7 poglavlje 2.0.7):** za `User` koji je preko `linked_profile_id` vezan za franšizni `Subagent` (poglavlje 3.1 dopuna ispod), `VIEW_ALL` se po difoltu tumači kao "sve u OKVIRU sopstvene franšize", ne globalno — franšiza nikad ne vidi zapise matične agencije ili druge franšize kroz ovu dozvolu, bez obzira na `DENY`/`ALLOW` podešavanje. Ovo ograničenje je na nivou servisnog sloja (isti filter kao `clientAccountId` scoping u `resolveApiContext`, M5 poglavlje 6.2), ne dodatna RBAC dozvola.

### 3.1a `User.linked_profile_id` za `STAFF` naloge franšize (dopuna, 31.8.2026, na zahtev vlasnika — M7 poglavlje 2.0.7)

Polje `linked_profile_id` (poglavlje 3.1) je do sada nosilo referencu ka M6/M7 profilu isključivo za `GUEST`/`SUBAGENT_CONTACT` naloge. Proširuje se: **`STAFF` nalog sme, opciono, da nosi `linked_profile_id → M7 Subagent.id`** kad taj zaposleni pripada franšizi (M7 poglavlje 2.0.7) — ne menja se semantika polja ("referenca ka poslovnom profilu bez dupliranja podataka"), samo se prvi put koristi i za `STAFF` tip. Kad je polje prazno, `STAFF` nalog pripada matičnoj agenciji, nepromenjeno.

### 3.9 `UserPreference` (dopuna, 18.8.2026, na zahtev vlasnika — formalizuje mesto čuvanja za ponašanja koja dizajn dokument već pretpostavlja)

Generičko, ključ-vrednost skladište ličnih podešavanja panela po korisniku — namerno **ne** poseban model po svakom podešavanju (širina panela, tema, otvoreni tabovi, oblik forme za kreiranje rezervacije, itd.), pošto se broj ovakvih sitnih UI preferenci vremenom prirodno širi i ne zaslužuje svaka sopstvenu tabelu/migraciju.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| user_id | UUID (FK → `User`) | |
| key | string | npr. `panel_width.left`, `theme`, `open_tabs`, `booking_form_layout` |
| value | JSONB | oblik slobodan po ključu — modul/ekran koji ga koristi definiše sopstveni oblik, M1 ga ne tumači |
| updated_at | timestamp | |

Jedinstveno po (`user_id`, `key`). Nema `GET`/`PUT` po pojedinačnom ključu — jedan `GET /users/me/preferences` vraća sve, jedan `PUT /users/me/preferences/:key` upisuje jednu vrednost (poglavlje 6). Ne prolazi kroz RBAC iznad "ovo je moj sopstveni nalog" — svaki korisnik menja isključivo svoje.

Ovo je oslonac za: dizajn dokument (`29-DIZAJN-SISTEM-UI.md`) §5b (širina panela po korisniku), §5a (otvoreni tabovi preko sesija — pamćeno lokalno po sesiji, `UserPreference` je opciono proširenje ako zatreba sinhronizacija preko uređaja, nije obavezno za v1), §2.0a (izbor tamnog/svetlog moda), i M5 poglavlje 4a (oblik forme Ponuda→Rezervacija — stepper naspram jedne strane, na zahtev vlasnika 18.8.2026).

---

## 4. Podrazumevane uloge i njihov opseg (polazni šabloni)

| Uloga | Podrazumevani opseg (dopunjuje se u specifikaciji svakog modula kad dođe na red) |
| :---- | :---- |
| **Vlasnik** | Pristup svemu, uključujući upravljanje ulogama i pojedinačnim izuzecima. Jedina uloga koja ne može sebi biti oduzeta poslednjem preostalom nosiocu (sistem ne dozvoljava da agencija ostane bez ijednog Vlasnika). |
| **Direktor** | Pristup svemu osim promena vezanih za licencu agencije i vlasničku strukturu (te akcije ionako spadaju u "Nikad autonomno" — poglavlje 7 — i traže ljudsku odluku van sistema). |
| **HR** | M1 (upravljanje korisnicima i njihovim ulogama unutar tima), bez pristupa rezervacijama, finansijama ili katalogu. |
| **Sales Manager** | Uvid u rezervacije/CRM celog prodajnog tima (ne samo svoje), izveštaji o prodaji (M13, read-only), bez pristupa finansijama/fiskalizaciji. |
| **Prodajni agent** | Katalog (read), Rezervacije i CRM — **podrazumevano vidi sve rezervacije/klijente tima** (izmenjeno 31.8.2026, vidi poglavlje 3.9a i M5 poglavlje 6.5 — ranija formulacija "ograničeno na sopstvene" je bila neusklađena sa stvarnom odlukom); sužavanje na sopstvene ide isključivo preko eksplicitnog `DENY` na `VIEW_ALL` koje postavlja Sales Manager ili Vlasnik. |
| **Računovođa** | M10 (Finansije/fiskalizacija), M11 (Compliance), read-only uvid u rezervacije radi fakturisanja. |
| **Gost** | Isključivo sopstveni profil i sopstvene rezervacije (M6/M8), bez pristupa internom panelu. |
| **SUBAGENT_ADMIN** *(dodato pri specifikaciji M7, Faza 4)* | Portal nalog subagenta (bilo kog nivoa u B2B hijerarhiji), nosi `User.account_type = SUBAGENT_CONTACT`. Pristup: sopstveni profil, sopstvene rezervacije, upravljanje sopstvenim direktnim sub-subagentima. Bez pristupa internom panelu (M17) ili podacima drugih subagenata. Detalji u M7 specifikaciji, poglavlje 8. |
| **VODIC** *(dodato pri specifikaciji M9, Faza 6)* | Interni tim na terenu, nosi `User.account_type = STAFF`. Pristup isključivo sopstvenom dodeljenom itineraru (M5 `BookingItem.assigned_guide_id`) i gostima na tim polascima, preko offline-first mobilne aplikacije. Bez pristupa internom panelu (M17) ili tuđim rezervacijama. Detalji u M9 specifikaciji, poglavlje 4 i 6. |
| **DOBAVLJAC_KONTAKT** *(dodato pri dopuni M19, problem #9, avgust 2026)* | Lagan portal nalog kontakt-osobe kod dobavljača, nosi `User.account_type = SUPPLIER_CONTACT`. Pristup: isključivo sopstveni real-time razgovor(i) sa timom agencije (M19 poglavlje 11) — bez uvida u katalog, cene, druge dobavljače ili bilo šta van te konverzacije. Bez pristupa internom panelu (M17) ili bilo kom drugom modulu. Detalji u M19 specifikaciji, poglavlje 9, i M3 specifikaciji (`SupplierContact`, poglavlje 2.1a). |

Napomena: uloge za B2B portal (M7) i vodiče na terenu (M9) dodate su tek kad su ti moduli specificirani — model iz ovog dokumenta (uloga + override) ih je primio bez izmene strukture, kako je i predviđeno.

---

## 5. Autentikacija

- **Prijava:** email + lozinka (Argon2id heš, min. 12 karaktera, provera protiv liste poznatih probijenih lozinki pri registraciji).
- **2FA (TOTP, RFC 6238):** **obavezna** za sve interne uloge (Vlasnik, Direktor, HR, Sales Manager, Prodajni agent, Računovođa) — ne može se ugasiti od strane samog korisnika. Za **Gosta** opciona (korisnik je sam uključuje ako želi).
- Pri uključivanju 2FA generiše se 10 jednokratnih rezervnih kodova (hešованih u bazi) za slučaj gubitka uređaja.
- **Zaključavanje naloga:** posle 5 uzastopnih neuspešnih pokušaja, nalog se privremeno zaključava na 15 minuta (`locked_until`), uz upis u audit log.
- **Zaključavanje na neuspešan MFA kod** (dopunjeno 29.8.2026, nalaz pri gradnji M18 "Live procesna mapa" — vidi M18 spec §11): pravilo iz stavke iznad se primenjivalo samo na pogrešnu lozinku (prvi korak) — pogrešan TOTP kod u drugom koraku (`POST /auth/mfa/verify`) se do sad **nije beležio ni brojao uopšte**, što je značilo da je neko sa ukradenom lozinkom mogao neograničeno da pogađa MFA kod bez traga i bez zaustavljanja. Ovo nije bila svesna odluka — ispravlja se kao dovršetak već postojeće politike, ne kao nova: svaki neuspešan `POST /auth/mfa/verify` upisuje `auth.mfa_failed` u audit log i uvećava **isti** `failed_login_attempts` brojač kao pogrešna lozinka; posle 5 (`FAILED_ATTEMPTS_BEFORE_LOCK`) nalog se zaključava na istih 15 minuta (`LOCK_DURATION_MINUTES`), isti mehanizam, ista konstanta — namerno ne uvodi se poseban brojač/rok samo za MFA.
- **Zaboravljena lozinka:** token sa rokom od 1h, poslat na email, jednokratan.
- **Pozivanje novog korisnika:** status `INVITED` → email sa linkom za postavljanje lozinke i (ako je interna uloga) obavezno podešavanje 2FA pre prvog pristupa bilo čemu osim te stranice.
- **Pozivanje `STAFF` naloga franšize (dopuna, 31.8.2026 — M7 poglavlje 2.0.7).** `POST /users` i dalje zahteva `M1/user/CREATE`, ali franšizni "lokalni Direktor" (M1 uloga `Direktor`, `linked_profile_id` postavljen na M7 `Subagent`, poglavlje 3.1a) sme da je koristi **isključivo** za nove `STAFF` naloge sa istim `linked_profile_id` kao on sam — pokušaj kreiranja naloga bez tog polja, ili sa tuđim `Subagent.id`, se odbija (`ForbiddenException`), isti obrazac kao ownership provera već primenjena u M6 `GuestProfilesService.update()` (Faza 8 IDOR nalaz, 30.8.2026) i M7 `updateChildCommission()` (poglavlje 6). Vlasnik/Direktor matične agencije zadržavaju neograničeno `M1/user/CREATE` preko cele mreže (svih franšiza), nepromenjeno.
- **Samostalna registracija gosta (dopuna avgust 2026, M8 poglavlje 4).** Za razliku od internih uloga (koje uvek nastaju kroz `POST /users`, status `INVITED`, poziva ih neko sa `M1/user/CREATE`), gost sa javnog sajta (M8) i mobilne aplikacije (M9) sam sebi otvara nalog preko `POST /auth/register` — bez guard-a, bez `M1/user/CREATE` dozvole, jer poziv dolazi od anonimnog posetioca. Kreirani `User` dobija `account_type = GUEST`, `status = ACTIVE` odmah (ne `INVITED` — gost ne prolazi kroz tok pozivanja jer sam sebe registruje), lozinku po istim pravilima kao gore (Argon2id, min 12, provera probijenih lozinki), i 2FA ostaje opciona kao za svakog Gosta. Posle upisa u bazu, endpoint odmah izdaje access + refresh token par (isti par kao uspešna prijava bez 2FA) i emituje event `user.registered.guest` (Postgres LISTEN/NOTIFY, isti mehanizam kao ostali moduli) — M6 taj event hvata da napravi `ClientAccount(account_type=INDIVIDUAL)` i poveže je na `User.linked_profile_id` (M6 specifikacija, dopuna u istom prolazu). **`GuestProfile` se ne pravi pri registraciji** — taj zapis traži podatke o putnom dokumentu (broj, nacionalnost, datum rođenja) koje registracija ne prikuplja; pravi se kasnije, kad gost stvarno unese te podatke. M1 sam ne kreira M6 zapise — modul ne piše direktno u tuđu bazu, samo emituje događaj (princip #2, poglavlje 3 Master dokumenta).

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/iam`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/auth/register` | POST | **javan, bez guard-a** — samostalna registracija gosta (email, lozinka, ime, telefon opciono), `account_type = GUEST`, `status = ACTIVE`; izdaje access + refresh token i emituje `user.registered.guest` (poglavlje 5) |
| `/auth/login` | POST | email + lozinka → ako 2FA uključena, vraća privremeni token koji traži `/auth/mfa/verify` |
| `/auth/mfa/verify` | POST | TOTP kod → izdaje access + refresh token; pogrešan kod upisuje `auth.mfa_failed` i uvećava isti brojač/zaključavanje kao pogrešna lozinka (poglavlje 5, dopunjeno 29.8.2026) |
| `/auth/refresh` | POST | refresh token → novi access + rotiran refresh token |
| `/auth/logout` | POST | opoziva refresh token (jedan uređaj ili svi — parametar) |
| `/auth/password/forgot` | POST | šalje reset link |
| `/auth/password/reset` | POST | token + nova lozinka |
| `/users` | GET / POST | lista / poziv novog korisnika (samo uloge sa `M1/user/CREATE`) |
| `/users/:id` | GET / PATCH / DELETE | DELETE = meko gašenje (status `SUSPENDED`), ne fizičko brisanje |
| `/users/:id/roles` | POST / DELETE | dodela/uklanjanje uloge |
| `/users/:id/permission-overrides` | GET / POST / DELETE | pregled/dodela/uklanjanje pojedinačnog izuzetka — obavezan `reason` |
| `/roles` | GET / POST / PATCH | katalog uloga |
| `/permissions` | GET | katalog svih registrovanih dozvola (svi moduli) |
| `/audit-log` | GET | filtriranje po korisniku/modulu/datumu (`from`/`to` — `to` bez vremena, npr. iz `<input type="date">`, tretira se kao KRAJ tog dana 23:59:59.999 UTC, ne njegova ponoć — nalaz 29.8.2026, `new Date("YYYY-MM-DD")` je inače isključivao skoro sve zapise tog dana)/**akciji** (`action`, opciono, više vrednosti odvojenih zarezom — dodato 29.8.2026 za M18 "Live procesna mapa", poglavlje 9a te specifikacije)/**pojmu** (`q`, opciono, slobodan tekst case-insensitive preko action/resourceType/resourceId/module odjednom — dodato 29.8.2026, na zahtev vlasnika) — samo za uloge sa `M1/audit-log/VIEW` (podrazumevano: Vlasnik, Direktor) |
| `/users/me/preferences` | GET | vraća sve `UserPreference` (poglavlje 3.9) trenutno prijavljenog korisnika, kao mapu `key → value` |
| `/users/me/preferences/:key` | PUT | upisuje/menja jednu vrednost; nema poseban guard osim prijave — korisnik menja isključivo svoje |

Svi endpoint-i dokumentovani OpenAPI šemom pre implementacije — u skladu sa principom iz poglavlja 6 da ugovor mora biti mašinski proverljiv.

---

## 7. UI ekrani (interni panel — M17)

M17 (Interni panel, poglavlje 4 Master dokumenta) nosi M1 pod jednim redom navigacije ("Korisnici i uloge", Faza 0). Taj red se u praksi deli na tri ekrana, potvrđeno klikabilnim prototipom (`00-MOCKUP-M1-IDENTITET.html`):

| Ekran (tab) | Sadržaj | Izvor podataka |
| :---- | :---- | :---- |
| **Korisnici** | Tabela svih `User` zapisa (ime, email, dodeljene uloge, status, 2FA, poslednja prijava) sa pretragom; dugme "+ Pozovi korisnika" otvara formu (ime, email, telefon, uloge) koja kreira nalog u statusu `INVITED` | `GET /users`, `POST /users` |
| **Korisnik — detalji** (bočni panel, otvara se klikom na red) | Profil, dodeljene uloge (dodavanje/uklanjanje), lista `UserPermissionOverride` zapisa sa formom za dodavanje novog izuzetka (dozvola, ALLOW/DENY, rok isteka, **obavezan razlog** — forma ne dozvoljava slanje bez njega), radnje (pošalji reset lozinke, suspenduj nalog) | `GET/PATCH /users/:id`, `GET/POST/DELETE /users/:id/permission-overrides` |
| **Uloge** | Kartice svih sistemskih uloga (naziv, opis/opseg iz poglavlja 4, broj nosilaca); uloge dodate kasnijim fazama (`SUBAGENT_ADMIN`, `VODIC`) prikazane kao zaključane sa napomenom u kojoj fazi se aktiviraju | `GET /roles` |
| **Audit log** | Tabela zapisa (vreme, izvršilac sa ikonom po `actor_type`, akcija, resurs, IP), filter po modulu/izvršiocu/datumu, forma za pretragu po pojmu i opsegu datuma (`q`/`from`/`to`, dopunjeno 29.8.2026, na zahtev vlasnika) — pojam se filtrira uživo dok se kuca (debounce, bez dugmeta "pretraži"), datum preko `DateField.tsx` (dizajn dok. §6g, kalendar ili kucanje "12082026"). Klik na red puni desni panel (M17 `RowSummaryContext`, isti mehanizam kao sažetak reda rezervacije) sa punim zapisom uključujući `before_state`/`after_state`/`context` — ranije "širenje reda" u samoj tabeli, sad detalj u panelu, dosledno ostalim listama. Kad se stigne sa `?back=<putanja>&backLabel=<naziv>` (npr. iz M18 žive procesne mape, poglavlje 9a te specifikacije), prikazuje "← Nazad na [naziv]" link nazad na tačan ekran sa kog je klik krenuo | `GET /audit-log` |

Sidebar M17 ljuske prikazuje i sve ostale module (Katalog, Ugovori, Rezervacije...) kao zaključane stavke sa oznakom faze u kojoj se aktiviraju — to je vizuelni podsetnik da M17 raste postepeno (poglavlje 7 M17 specifikacije), ne nešto što M1 posebno implementira.

---

## 8. Izlazni kriterijum (kada je M1 gotov — Faza 0)

Preuzeto i razrađeno iz tabele u poglavlju 8:

- [x] Korisnik se može prijaviti email-om i lozinkom; interne uloge ne mogu proći bez uspešno podešene 2FA. *(dokazano e2e testom, avgust 2026)*
- [x] Sve sedam podrazumevanih uloga postoje u bazi kao sistemske (`is_system_role = true`) sa razumnim podrazumevanim dozvolama iz poglavlja 4. *(dokazano e2e testom, avgust 2026)*
- [x] Moguće je dodeliti i ukloniti pojedinačni izuzetak (`UserPermissionOverride`) korisniku, sa obaveznim razlogom, i taj izuzetak odmah utiče na sledeći zahtev tog korisnika (bez potrebe za ponovnom prijavom). *(dokazano e2e testom, avgust 2026)*
- [x] Svaka izmena korisnika, uloge ili dozvole ostavlja zapis u `AuditLogEntry`; tabela je fizički zaštićena od izmene/brisanja. *(dokazano unit + e2e testom, avgust 2026)*
- [x] Zaključavanje naloga posle neuspešnih pokušaja radi i beleži se. *(dokazano e2e testom, avgust 2026)*
- [ ] Infrastruktura (baza, backend) se diže iz IaC koda, ne ručnim koracima. *(ostaje — čeka odluku o hosting provajderu, vidi apps/api/README.md)*

---

## 9. Otvoreno za dalje

- Konkretna dodela dozvola po modulu (koja dozvola pripada kojoj podrazumevanoj ulozi) definiše se **kad svaki modul dođe na red** — ovaj dokument daje samo strukturu i sedam osnovnih uloga navedenih u poglavlju 4. Svaka buduća specifikacija modula (M2, M3...) mora u svom dokumentu navesti listu `Permission` zapisa koje registruje i predlog podrazumevane dodele po ulozi.
- ~~Role za M7 (subagenti/B2B portal) dodaju se kad ta faza dođe na red (Faza 4).~~ **Rešeno**: `SUBAGENT_ADMIN` dodata pri specifikaciji M7 (poglavlje 4 ovog dokumenta). Slično, `VODIC` dodata pri specifikaciji M9 (Faza 6).
