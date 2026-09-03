# API dokumentacija — M1 (Core / Identitet i pristup)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — B2B subagenti (M7), spoljni AI agenti (M16), budući korporativni klijenti — sa stvarnim primerima zahteva/odgovora za svaki endpoint. Interni oslonac za implementaciju ostaje `docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/iam`

**M1 je ulaz u ceo sistem.** Svaki drugi modul očekuje token izdat ovde. Ako gradite bilo kakvu integraciju, ovo je prvi dokument koji vam treba.

**Verzija podataka u primerima:** odgovori su stvarno uhvaćeni pozivima nad lokalnom bazom 3.9.2026. Uspešna prijava je jedini oblik prikazan iz koda a ne iz uhvaćenog poziva — za to bi bila potrebna stvarna lozinka nekog naloga.

---

## Kako izgleda prijava — ceo tok

```
POST /iam/auth/login
   │
   ├─ nalog nema 2FA  ──────────────►  {accessToken, refreshToken}   ✔ gotovo
   │
   └─ nalog ima 2FA   ──────────────►  {requiresMfa: true, mfaToken}
                                              │
                                    POST /iam/auth/mfa/verify
                                              │
                                              └─►  {accessToken, refreshToken}  ✔
```

**Dva tokena, dve različite svrhe:**

| | Trajanje | Čemu služi |
| :---- | :---- | :---- |
| `accessToken` | **15 minuta** | šalje se u `Authorization: Bearer` na svaki poziv |
| `refreshToken` | **7 dana** | služi samo da se dobije nov `accessToken` |

**`accessToken` ne nosi nijedan podatak o pravima** — samo ko ste i koja je sesija. Prava se računaju **uživo nad bazom** pri svakom pozivu. To znači da oduzimanje dozvole deluje odmah, a ne tek kad token istekne. Ako gradite integraciju, nemojte pokušavati da čitate prava iz tokena — nisu tamo.

---

## Autentikacija

### POST /iam/auth/register
**Bez tokena.** Samostalna registracija — namenjena **isključivo gostima**. Nalog dobija `accountType: "GUEST"`. Interni nalozi se ne prave ovde nego pozivom (`POST /iam/users`).

**Zahtev:**
```json
{ "email": "petar.petrovic@primer.rs", "password": "NekaDugackaSifra1", "fullName": "Petar Petrović", "phone": "+381 60 111 2233" }
```
`password` mora imati **najmanje 12 znakova**. Kraća vraća:
```json
{"message":["password must be longer than or equal to 12 characters"],"error":"Bad Request","statusCode":400}
```
Nalog nastaje odmah kao `ACTIVE` (ne čeka aktivaciju e-poštom) i automatski dobija sistemsku ulogu `GOST`. Zauzeta e-adresa vraća `409`:
```json
{"message":"Nalog sa ovim email-om već postoji","error":"Conflict","statusCode":409}
```

### POST /iam/auth/login
**Bez tokena.**

**Zahtev:**
```json
{ "email": "petar.petrovic@primer.rs", "password": "NekaDugackaSifra1" }
```

**Odgovor `201` — nalog bez 2FA:**
```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs...", "refreshToken": "9f2c1e8a4b..." }
```

**Odgovor `201` — nalog sa 2FA:**
```json
{ "requiresMfa": true, "mfaToken": "eyJhbGciOiJIUzI1NiIs..." }
```
`mfaToken` traje **5 minuta** i ne može se koristiti kao `accessToken` — služi samo za sledeći korak.

**Greške:**
```json
{"message":"Pogrešan email ili lozinka","error":"Unauthorized","statusCode":401}
{"message":"Nalog je privremeno zaključan — pokušajte kasnije","error":"Forbidden","statusCode":403}
{"message":"Nalog čeka aktivaciju — postavite lozinku preko linka poslatog na email","error":"Forbidden","statusCode":403}
{"message":"Nalog nije aktivan (status: SUSPENDED)","error":"Forbidden","statusCode":403}
{"message":"Podešavanje dvofaktorske autentikacije je obavezno pre prijave — dovršite podešavanje 2FA.","error":"Forbidden","statusCode":403}
```

> **Ista poruka za nepostojeći nalog i za pogrešnu lozinku** — „Pogrešan email ili lozinka" u oba slučaja. Namerno: različite poruke bi dozvolile da se pogađanjem adresa utvrdi ko ima nalog u sistemu. Ne pokušavajte da razlikujete ta dva slučaja, ne možete.

> **Zaključavanje: 5 neuspelih pokušaja → nalog zaključan 15 minuta.** Brojač se briše pri prvoj uspešnoj prijavi. Ako pišete automatsku integraciju, ne ponavljajte prijavu u petlji — zaključaćete nalog.

### POST /iam/auth/mfa/verify
**Bez tokena** (nosi `mfaToken` u telu).

```json
{ "mfaToken": "eyJhbGciOiJIUzI1NiIs...", "code": "482915" }
```
`code` je **tačno 6 cifara**. Odgovor je isti par tokena kao uspešna prijava.

```json
{"message":"Nevažeći ili istekao MFA token","error":"Unauthorized","statusCode":401}
```

### POST /iam/auth/refresh
**Bez tokena** (nosi `refreshToken` u telu).

```json
{ "refreshToken": "9f2c1e8a4b..." }
```
Odgovor: **nov par** `accessToken` + `refreshToken`.

> **Refresh token se rotira pri svakoj upotrebi.** Stari se odmah poništava. Ako sačuvate stari i pokušate ponovo, dobijate `401`. Uvek zamenite sačuvani token onim iz odgovora — ovo je najčešći uzrok „iznenada me izbacuje" kod integracija.

```json
{"message":"Nevažeći ili istekao refresh token","error":"Unauthorized","statusCode":401}
```

### POST /iam/auth/logout
```json
{ "refreshToken": "9f2c1e8a4b...", "allDevices": false }
```
`allDevices: true` poništava **sve** sesije korisnika, ne samo tekuću.

Odjava **ne poništava `accessToken`** koji je već izdat — on prirodno ističe za najviše 15 minuta. Poništava se mogućnost da se dobije nov.

### POST /iam/auth/activate
Pozvani korisnik postavlja prvu lozinku preko linka iz e-pošte.
```json
{ "token": "iz-linka-u-emailu", "newPassword": "NovaDugackaSifra1" }
```
**Odgovor `201`:** `{ "ok": true }`

### POST /iam/auth/password/forgot · POST /iam/auth/password/reset
```json
{ "email": "petar.petrovic@primer.rs" }
```
```json
{ "token": "iz-linka-u-emailu", "newPassword": "NovaDugackaSifra1" }
```
Oba vraćaju `{ "ok": true }`.

> **`password/forgot` vraća `{ok: true}` i kad adresa ne postoji** — iz istog razloga kao jedinstvena poruka pri prijavi. Odgovor nije potvrda da nalog postoji.

### POST /iam/auth/mfa/enroll · POST /iam/auth/mfa/enroll/confirm
**Zahtevaju token.** Prvi vraća podatke za podešavanje aplikacije za kodove, drugi potvrđuje sa prvim kodom:
```json
{ "code": "482915" }
```

### GET /iam/auth/me
**Zahteva token, ne zahteva nijednu dozvolu** — svako sme da vidi sopstveni nalog i sopstvena prava.

**Odgovor `200`:**
```json
{
  "userId": "7a510a40-bad7-46cb-b010-1faa16661699",
  "email": "vlasnik.dev@terminal-travel.local",
  "fullName": "Vlasnik (dev nalog)",
  "accountType": "STAFF",
  "status": "ACTIVE",
  "roles": ["VLASNIK"],
  "permissions": [
    { "id": "2edf7e4d-1a04-48d0-921f-61841e7eec08", "module": "M3", "resource": "supplier", "action": "VIEW", "description": "Uvid u dobavljače" },
    { "id": "1e69d4e3-0763-4331-a759-f3f43829ed07", "module": "M3", "resource": "supplier", "action": "CREATE", "description": "Kreiranje dobavljača" }
  ]
}
```

**Ovo je endpoint koji vam treba da biste znali šta sme trenutni korisnik.** `permissions[]` je već razrešena lista — uloge plus pojedinačni izuzeci, sve sabrano. Ne računajte prava sami iz `roles[]`.

Razlog što ovo postoji odvojeno od `GET /iam/users/:id`: taj drugi traži dozvolu `M1/user/VIEW`, koju npr. Prodajni agent nema — pa ne bi mogao ni da vidi sopstveni profil.

---

## Korisnici

### GET /iam/users
Dozvola: `M1/user/VIEW`.

### GET /iam/users/directory
**Bez ijedne dozvole** — dostupno svakom `STAFF` nalogu. Vraća **samo ime i identifikator**, ništa više:

```json
[
  { "id": "50e394b4-bfb7-4373-a2b5-e555a816c97f", "fullName": "Demo Pregled" },
  { "id": "83b4be72-48eb-4ec8-b00d-0f69e34a5ba6", "fullName": "Marko Marković" }
]
```
Vraća samo `STAFF` naloge u statusu `ACTIVE`, poređane po imenu. Namenjen biranju osobe iz spiska (dodela zadatka, prosleđivanje razgovora) bez otvaranja punog registra korisnika.

**Filter `?role=` menja i sadržaj odgovora, ne samo koga vraća.** Sa filterom se dodaju `email` i `phone`:
```
GET /api/v1/iam/users/directory?role=PRODAJNI_AGENT
```
```json
[
  { "id": "50e394b4-...", "fullName": "Marko Marković", "phone": "+381601112233", "email": "marko.markovic@terminal-travel.rs" }
]
```
Bez filtera se vraćaju samo `id` i `fullName`. Ako vam trebaju kontakt-podaci, morate proslediti `role`.

**Poziv sa naloga koji nije `STAFF` vraća prazan niz, ne grešku.** Gost ili subagent koji ovo pozove dobija `[]` sa statusom `200` — ne `403`. Ne tumačite prazan odgovor kao „nema zaposlenih".

### POST /iam/users
Dozvola: `M1/user/CREATE`. Ovo je **poziv**, ne kreiranje sa lozinkom — nalog nastaje u statusu `INVITED` i čeka aktivaciju.

```json
{
  "fullName": "Marko Marković",
  "email": "marko.markovic@terminal-travel.rs",
  "phone": "+381601112233",
  "roleIds": ["4f8fc66d-c0fa-43d8-8d2a-226e1b3455fb"],
  "linkedProfileId": null
}
```
`roleIds[]` je obavezan (može biti prazan niz). `linkedProfileId` popunjava se samo kad nalog pripada franšizi (M7).

### GET /iam/users/:id · PATCH /iam/users/:id
Dozvole: `M1/user/VIEW` odnosno `EDIT`. `PATCH` prima samo `fullName` i `phone`.

### DELETE /iam/users/:id
Dozvola: `M1/user/DELETE`.

> **Ovo NIJE brisanje.** Nalog prelazi u `SUSPENDED` i ostaje u bazi. Namerno: nalog obrisan iz baze pokidao bi audit log, istoriju rezervacija i sve što na njega upućuje. Suspendovan korisnik se ne može prijaviti, ali istorija ostaje čitljiva.

### POST /iam/users/:id/roles · DELETE /iam/users/:id/roles/:roleId
Dozvola: `M1/user/EDIT`.
```json
{ "roleId": "4f8fc66d-c0fa-43d8-8d2a-226e1b3455fb" }
```

### GET /iam/users/me/preferences · PUT /iam/users/me/preferences/:key
**Bez dozvole** — uvek se odnosi na sopstveni nalog, `:id` se ne prosleđuje uopšte (uzima se iz tokena). Lična podešavanja panela.
```json
{ "value": "dark" }
```

---

## Pojedinačni izuzeci od prava

Uloga daje osnovni skup dozvola; izuzetak dodaje ili oduzima **jednu** dozvolu **jednom** korisniku.

### GET /iam/users/:id/permission-overrides
Dozvola: `M1/permission-override/VIEW`.

### POST /iam/users/:id/permission-overrides
Dozvola: `M1/permission-override/CREATE`.

```json
{
  "permissionId": "62162f4b-5c6a-4105-977b-ce8f33c1ef09",
  "effect": "ALLOW",
  "reason": "Privremena zamena za direktora tokom godišnjeg odmora",
  "expiresAt": "2027-07-31T23:59:59.000Z"
}
```
`effect` je `ALLOW` ili `DENY`. **`reason` je obavezan i mora imati bar 3 znaka** — nema tihe dodele prava bez zapisanog razloga. `expiresAt` je opcion; bez njega izuzetak važi dok se ne obriše.

### DELETE /iam/users/permission-overrides/:overrideId
Dozvola: `M1/permission-override/CREATE`. Obratite pažnju na oblik putanje — **nema `:id` korisnika**, ide direktno pod `/iam/users/permission-overrides/`.

---

## Uloge i katalog dozvola

### GET /iam/roles
Dozvola: `M1/role/VIEW`.

```json
[
  {
    "id": "ee65d784-150a-4ea7-b8a9-159e143eeadd",
    "name": "DIREKTOR",
    "description": "Pristup svemu osim promena vezanih za licencu agencije i vlasničku strukturu.",
    "isSystemRole": true,
    "_count": { "userRoles": 28 }
  },
  {
    "id": "4f8fc66d-c0fa-43d8-8d2a-226e1b3455fb",
    "name": "PRODAJNI_AGENT",
    "description": "Katalog (read), Rezervacije i CRM — ograničeno.",
    "isSystemRole": true,
    "_count": { "userRoles": 12 }
  }
]
```
`_count.userRoles` je broj korisnika sa tom ulogom. `isSystemRole: true` označava ugrađene uloge.

### POST /iam/roles · PATCH /iam/roles/:id
Dozvole: `M1/role/CREATE` odnosno `EDIT`.
```json
{ "name": "REZERVACIJE_SUPERVIZOR", "description": "Nadzor nad rezervacijama bez pristupa finansijama." }
```
`PATCH` menja **samo** `description`.

> **Rupa koju treba znati pre nego što napravite ulogu: ne postoji endpoint koji dodeljuje dozvole ulozi.** Uloga napravljena preko API-ja nastaje **prazna** i takva ostaje — veza uloga↔dozvola postoji samo u skripti za početno punjenje baze. Dok se to ne doda, nove uloge se u praksi ne mogu koristiti; pojedinačan pristup se dodeljuje preko izuzetaka (odeljak iznad).

### GET /iam/permissions
Ceo katalog dozvola u sistemu — spisak svega što se može dodeliti.

```json
[
  { "id": "69cb66e8-6365-469a-8894-35b494a8668f", "module": "M1", "resource": "audit-log", "action": "VIEW", "description": "Uvid u audit log" },
  { "id": "54cc5f61-1133-47ba-9418-610b28d89739", "module": "M1", "resource": "permission-override", "action": "CREATE", "description": "Dodela/oduzimanje pojedinačne dozvole" }
]
```
Odavde uzimate `permissionId` za izuzetke. Dozvola se uvek imenuje kao **modul / resurs / radnja** (`M3/supplier/VIEW`).

---

## Audit log

### GET /iam/audit-log
Dozvola: `M1/audit-log/VIEW`.

**Filteri (svi opcioni):**

| Parametar | Napomena |
| :---- | :---- |
| `module` | `M1`, `M2`, `M3`, … |
| `actorId` | ko je izvršio radnju |
| `action` | **prima više vrednosti razdvojenih zarezom** (`auth.login_success,auth.login_failed`) |
| `q` | slobodna pretraga |
| `from` / `to` | datumi; `to` naveden samo kao datum obuhvata **ceo taj dan** |

**Odgovor `200`:**
```json
[
  {
    "id": "b381b05d-f56b-44a1-8f9d-bbb7eea05f4a",
    "timestamp": "2026-09-03T16:51:13.345Z",
    "actorType": "HUMAN",
    "actorId": "7a510a40-bad7-46cb-b010-1faa16661699",
    "module": "M1",
    "action": "auth.login_success",
    "resourceType": "User",
    "resourceId": "7a510a40-bad7-46cb-b010-1faa16661699",
    "beforeState": null,
    "afterState": null,
    "context": {},
    "ipAddress": "::1"
  },
  {
    "id": "aa11937a-15e5-4803-b1d2-24633e1eac05",
    "timestamp": "2026-09-03T16:36:48.560Z",
    "actorType": "AI_AGENT",
    "actorId": "c74e9251-8bab-4b70-b5ac-1e5b94d5a81c",
    "module": "M15",
    "action": "omnisearch.query",
    "resourceType": "OmnisearchQuery",
    "resourceId": "7a510a40-bad7-46cb-b010-1faa16661699",
    "context": {}
  }
]
```

**`actorType` razlikuje `HUMAN`, `AI_AGENT` i `SYSTEM`.** Svaki potez AI agenta je zapisan pod `AI_AGENT` sa sopstvenim nalogom — u svakom trenutku se može odgovoriti na pitanje „da li je ovo uradio čovek ili agent". Ovo je jedno od nosećih pravila celog sistema, ne detalj M1.

Audit log je **samo za čitanje** — nema endpointa koji upisuje ili menja zapise. Upisuju ih moduli sami pri svakoj radnji.

---

## Vrednosti nabrajanja

| Polje | Vrednosti |
| :---- | :---- |
| `accountType` | `STAFF`, `GUEST`, `SUBAGENT_CONTACT`, `AI_AGENT`, `SUPPLIER_CONTACT` |
| `status` (korisnik) | `INVITED`, `ACTIVE`, `SUSPENDED` |
| `actorType` (audit) | `HUMAN`, `AI_AGENT`, `SYSTEM` |
| `effect` (izuzetak) | `ALLOW`, `DENY` |

---

## Greške — zajednički oblik

```json
{ "message": "opis greške", "error": "Unauthorized", "statusCode": 401 }
```

| Kod | Kada |
| :---- | :---- |
| `400` | validacija (lozinka kraća od 12 znakova, neispravna e-adresa, MFA kod koji nije 6 cifara) |
| `401` | `"Nedostaje Bearer token"`, `"Nevažeći ili istekao token"`, `"Pogrešan email ili lozinka"`, `"Nevažeći ili istekao refresh token"` |
| `403` | zaključan nalog, nalog čeka aktivaciju, nalog nije aktivan, obavezno 2FA, ili nedostatak dozvole: `{"message":"Nema dozvolu M1/user/CREATE",...}` |
| `404` | `{"message":"Zapis nije pronađen",...}` |
| `409` | `{"message":"Nalog sa ovim email-om već postoji",...}` pri registraciji |

Nepoznato polje u telu zahteva vraća `400`, ne ignoriše se.
