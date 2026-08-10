# Specifikacija modula M1 — Core / Identitet i pristup

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M1) i poglavlje 8 (Faza 0)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.3 — počela implementacija (avgust 2026, Faza 0): `apps/api/src/modules/m1-core-identitet/` — auth (login/MFA/refresh/lockout/reset), RBAC evaluacija uživo (§3.6), audit log (append-only trigerom, §3.8), users/roles/permission-override CRUD, seed 7 sistemskih uloga. Testirano uživo (login, pogrešna lozinka, RBAC odbijanje, append-only trigger). Ostaje: infrastruktura iz IaC koda (poglavlje 8, trenutno docker-compose je samo za lokalni razvoj), UI ekrani (poglavlje 7); v1.2 dodat `account_type = SUPPLIER_CONTACT` i uloga DOBAVLJAC_KONTAKT (poglavlje 4), dopuna M19 specifikacije za problem #9 (real-time chat sa dobavljačima), avgust 2026; v1.1 dodata sekcija UI ekrani (poglavlje 7), potvrđena klikabilnim prototipom `00-MOCKUP-M1-IDENTITET.html`
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
| linked_profile_id | UUID, nullable | referenca ka M6 (Nalogodavac/Gost) ili M7 (Subagent) profilu — bez dupliranja podataka |
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

---

## 4. Podrazumevane uloge i njihov opseg (polazni šabloni)

| Uloga | Podrazumevani opseg (dopunjuje se u specifikaciji svakog modula kad dođe na red) |
| :---- | :---- |
| **Vlasnik** | Pristup svemu, uključujući upravljanje ulogama i pojedinačnim izuzecima. Jedina uloga koja ne može sebi biti oduzeta poslednjem preostalom nosiocu (sistem ne dozvoljava da agencija ostane bez ijednog Vlasnika). |
| **Direktor** | Pristup svemu osim promena vezanih za licencu agencije i vlasničku strukturu (te akcije ionako spadaju u "Nikad autonomno" — poglavlje 7 — i traže ljudsku odluku van sistema). |
| **HR** | M1 (upravljanje korisnicima i njihovim ulogama unutar tima), bez pristupa rezervacijama, finansijama ili katalogu. |
| **Sales Manager** | Uvid u rezervacije/CRM celog prodajnog tima (ne samo svoje), izveštaji o prodaji (M13, read-only), bez pristupa finansijama/fiskalizaciji. |
| **Prodajni agent** | Katalog (read), Rezervacije i CRM — ograničeno na sopstvene klijente/rezervacije (osim ako mu Sales Manager ili Vlasnik ne doda izuzetak preko `UserPermissionOverride`). |
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
- **Zaboravljena lozinka:** token sa rokom od 1h, poslat na email, jednokratan.
- **Pozivanje novog korisnika:** status `INVITED` → email sa linkom za postavljanje lozinke i (ako je interna uloga) obavezno podešavanje 2FA pre prvog pristupa bilo čemu osim te stranice.

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/iam`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/auth/login` | POST | email + lozinka → ako 2FA uključena, vraća privremeni token koji traži `/auth/mfa/verify` |
| `/auth/mfa/verify` | POST | TOTP kod → izdaje access + refresh token |
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
| `/audit-log` | GET | filtriranje po korisniku/modulu/datumu — samo za uloge sa `M1/audit-log/VIEW` (podrazumevano: Vlasnik, Direktor) |

Svi endpoint-i dokumentovani OpenAPI šemom pre implementacije — u skladu sa principom iz poglavlja 6 da ugovor mora biti mašinski proverljiv.

---

## 7. UI ekrani (interni panel — M17)

M17 (Interni panel, poglavlje 4 Master dokumenta) nosi M1 pod jednim redom navigacije ("Korisnici i uloge", Faza 0). Taj red se u praksi deli na tri ekrana, potvrđeno klikabilnim prototipom (`00-MOCKUP-M1-IDENTITET.html`):

| Ekran (tab) | Sadržaj | Izvor podataka |
| :---- | :---- | :---- |
| **Korisnici** | Tabela svih `User` zapisa (ime, email, dodeljene uloge, status, 2FA, poslednja prijava) sa pretragom; dugme "+ Pozovi korisnika" otvara formu (ime, email, telefon, uloge) koja kreira nalog u statusu `INVITED` | `GET /users`, `POST /users` |
| **Korisnik — detalji** (bočni panel, otvara se klikom na red) | Profil, dodeljene uloge (dodavanje/uklanjanje), lista `UserPermissionOverride` zapisa sa formom za dodavanje novog izuzetka (dozvola, ALLOW/DENY, rok isteka, **obavezan razlog** — forma ne dozvoljava slanje bez njega), radnje (pošalji reset lozinke, suspenduj nalog) | `GET/PATCH /users/:id`, `GET/POST/DELETE /users/:id/permission-overrides` |
| **Uloge** | Kartice svih sistemskih uloga (naziv, opis/opseg iz poglavlja 4, broj nosilaca); uloge dodate kasnijim fazama (`SUBAGENT_ADMIN`, `VODIC`) prikazane kao zaključane sa napomenom u kojoj fazi se aktiviraju | `GET /roles` |
| **Audit log** | Tabela zapisa (vreme, izvršilac sa ikonom po `actor_type`, akcija, resurs, IP), filter po modulu/izvršiocu/datumu; klik na red širi pre/posle prikaz (`before_state`/`after_state`) | `GET /audit-log` |

Sidebar M17 ljuske prikazuje i sve ostale module (Katalog, Ugovori, Rezervacije...) kao zaključane stavke sa oznakom faze u kojoj se aktiviraju — to je vizuelni podsetnik da M17 raste postepeno (poglavlje 7 M17 specifikacije), ne nešto što M1 posebno implementira.

---

## 8. Izlazni kriterijum (kada je M1 gotov — Faza 0)

Preuzeto i razrađeno iz tabele u poglavlju 8:

- [ ] Korisnik se može prijaviti email-om i lozinkom; interne uloge ne mogu proći bez uspešno podešene 2FA.
- [ ] Sve sedam podrazumevanih uloga postoje u bazi kao sistemske (`is_system_role = true`) sa razumnim podrazumevanim dozvolama iz poglavlja 4.
- [ ] Moguće je dodeliti i ukloniti pojedinačni izuzetak (`UserPermissionOverride`) korisniku, sa obaveznim razlogom, i taj izuzetak odmah utiče na sledeći zahtev tog korisnika (bez potrebe za ponovnom prijavom).
- [ ] Svaka izmena korisnika, uloge ili dozvole ostavlja zapis u `AuditLogEntry`; tabela je fizički zaštićena od izmene/brisanja.
- [ ] Zaključavanje naloga posle neuspešnih pokušaja radi i beleži se.
- [ ] Infrastruktura (baza, backend) se diže iz IaC koda, ne ručnim koracima.

---

## 9. Otvoreno za dalje

- Konkretna dodela dozvola po modulu (koja dozvola pripada kojoj podrazumevanoj ulozi) definiše se **kad svaki modul dođe na red** — ovaj dokument daje samo strukturu i sedam osnovnih uloga navedenih u poglavlju 4. Svaka buduća specifikacija modula (M2, M3...) mora u svom dokumentu navesti listu `Permission` zapisa koje registruje i predlog podrazumevane dodele po ulozi.
- ~~Role za M7 (subagenti/B2B portal) dodaju se kad ta faza dođe na red (Faza 4).~~ **Rešeno**: `SUBAGENT_ADMIN` dodata pri specifikaciji M7 (poglavlje 4 ovog dokumenta). Slično, `VODIC` dodata pri specifikaciji M9 (Faza 6).
