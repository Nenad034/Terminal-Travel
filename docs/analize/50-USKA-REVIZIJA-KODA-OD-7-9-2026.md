# 50 — Uska revizija koda dodatog od 7.9. do 17.9.2026

**Datum:** 18.9.2026.
**Pravila po kojima je pisano:** `40-PRAVILA-REVIZIJE-KODA.md` (klasa dokaza uz svaki nalaz, prebrojan obim, pokušaj obaranja za Visoko).
**Status:** spisak za odluku. **Nijedna izmena u kodu nije napravljena** — vlasnik bira šta se radi i kojim redom (poglavlje 8 ima preporuku).

---

## 0. Okidač i obim (dok. 40 §10 i §11)

**Okidači koji su nastupili** (dva od šest iz tabele u dok. 40 §10):

1. **„Nova aplikacija ili modul uđe u `apps/`"** — M24 (Ljudski resursi) je dobio kod 8.9.2026, posle prethodne revizije (dok. 39, zatvorena 7.9.2026).
2. **„Posle perioda paralelnog rada više sesija"** — između 7.9. i 17.9. ušlo je 26 commit-ova iz više sesija: M3 kapaciteti/cenovnik/tipovi soba (v1.15 → v1.46), M4 TravelgateX adapter, M5 ponuda iz nalepljenog teksta, M17 nova strana prijave.

**Obim** (uzak, po dok. 40): samo kod izmenjen između `c0bf5520` (7.9.2026, poslednji commit dok. 39) i `6df0b2fb` (17.9.2026). Izmereno: `git diff --stat c0bf5520..HEAD -- apps packages` → **405 fajlova, +42.127 / −1.909 linija**; `apps/api/src/modules`: M3 78 fajlova, M5 41, M1 15, M18 14, M15 10, M12 10, ostali < 10; panel: 82 fajla pod `app/(app)`, 9 novih `page.tsx`.

**Šta NIJE pregledano** (da se ne pomeša „nema problema" sa „nije gledano"): M4 TravelgateX adapter (nema live pristupa, dok. 33 zamka 8.13 — čeka sertifikacioni nalog), M12/M18/M15 izmene (mali obim, van okidača), `apps/web` (6 fajlova, kozmetika), `apps/mobile` (bez izmena), sadržinska ispravnost cenovničkih formula u M3 (`pricelist-calendar.service.ts`, 19 testova prolazi — nisam ih čitao red po red).

**Polazna tačka (klasa A):** CI na `6df0b2fb` zelen — `gh run list` → `success` za poslednja 4 commit-a (build api, unit + e2e, ESLint, Prettier, provera indeksa, `tsc` + build panel/web). Sve ispod je ono što CI **ne** hvata.

---

## 1. Kritično — korisnik danas vidi pokvarenu funkciju

_Prazno._ Nijedan nalaz ove klase nije nađen. Ovo je rezultat, ne propust (dok. 40 §7).

---

## 2. Visoko — radi danas, pada pod stvarnim opterećenjem ili propušta pogrešan podatak

### 2.1 Stop-sale / kapacitet „za ceo objekat" upisuje dan po dan, bez transakcije i bez granice raspona — REŠENO 18.9.2026

**Klasa dokaza: A (izmereno) + C (pročitano).**

**Simptom (A):** na živom API-ju (`node dist/src/main`, lokalna baza, zagrejan server — zamka 12.9), `POST /api/v1/contracting/capacity/stop-sale` za **jedan** period od 90 dana:

```
{"periods":1,"days":90} HTTP 201 3.593s   (zagrevanje)
{"periods":1,"days":90} HTTP 201 3.211s
{"periods":1,"days":90} HTTP 200 3.494s   (DELETE — ponovno otvaranje)
```

→ **~36 ms po danu**, linearno. Raspon od 10 godina (2020–2030) nad istim periodom: 4,42 s — petlja prođe kroz 3.653 dana, upiše samo 90 koji su u periodu, ali za svaki dan van perioda i dalje računa `startOfDay` dvaput (tačka ispod).

**Uzrok (C):** `apps/api/src/modules/m3-ugovaranje-alotmani/capacity/capacity.service.ts:393-414` (`setStopSale`) i `:459-…` (`setCapacityOverride`): ugnježdena petlja `for (period) for (day) await prisma.capacityDay.upsert(...)` — jedan upit po danu po periodu, sekvencijalno. `grep -n '\$transaction' capacity.service.ts` → **0 pogodaka**. DTO (`set-stop-sale.dto.ts`) validira `dateFrom`/`dateTo` samo kao `IsDateString`, bez granice raspona — dok `grid()` (`:115`) isti raspon ograničava na 92 dana.

**Obim (prebrojan):** 3 od 3 ulaza idu istim putem — `POST stop-sale`, `DELETE stop-sale` (ponovno otvaranje) i `PUT capacity-override` (`capacity.controller.ts:88,94,100`). Panel šalje obim `objekat` → `contractId` → **svi periodi ugovora** (`apps/panel/src/app/(app)/kapaciteti/actions.ts:44-58`, `obim === 'objekat'`).

**Šta to znači u brojevima:** hotel sa 6 tipova soba i sezonom od 150 dana, „zatvori ceo objekat do kraja sezone" = 900 upisa ≈ **33 s** u jednom HTTP zahtevu. Ako pukne veza na 400. upisu, 400 dana je zatvoreno, 500 nije, a revizijski trag (`auditLog.write`, `:416`) se **ne upiše** jer dolazi tek posle petlje — istorija kapaciteta (`capacityHistory`) tada ne zna da se išta desilo.

**Pokušaj obaranja:** (a) „možda panel nikad ne šalje više perioda odjednom" → ne: `obim === 'objekat'` šalje `contractId`, a `resolvePeriods` (`:687`) vraća sve ACTIVE periode ugovora. (b) „možda je Prisma pool paralelan pa je stvarno vreme kraće" → ne: `await` u telu `for` petlje je sekvencijalan po definiciji; merenje to potvrđuje (90 upisa = 3,2 s, ne 0,3 s). (c) „možda spec traži dan-po-dan zapis" → M3 §2.8a traži _zapis_ po danu (`CapacityDay`), ne _upit_ po danu — `createMany` + `updateMany` ili jedan `$transaction` daju isti zapis. → **Nalaz opstaje.**

**Predlog:** (1) ceo upis u jedan `$transaction` (zamka 7.9 — već je pravilo za „više povezanih zapisa u jednom toku"); (2) unutar transakcije `createMany({ skipDuplicates })` + jedan `updateMany` po periodu umesto N `upsert`; (3) ista granica od 92 dana kao u `grid()`, ili eksplicitno veća (npr. 400 dana) ali **postojeća** — sad je nema. Procena: pola dana, uključujući merenje posle.

**REŠENO 18.9.2026** (M3 spec v1.47): `writeDays` — jedna transakcija, po periodu `createMany` + `updateMany`, granica 366 dana. Izmereno na istom periodu, isti server: **3,21 s → 0,22 s** (90 dana); mreža posle potvrđuje 90 STOP, posle vraćanja 0; raspon 2020–2030 sad daje 400 sa porukom. 35 testova kapaciteta (2 nova: granica, „prekid ne ostavlja audit zapis").

---

## 3. Srednje — nije hitno, ali se plaća kasnije

### 3.1 Četiri tela zahteva zaobilaze validaciju — M24 (HR) prima bilo kakav sadržaj

**Klasa dokaza: A (izmereno, dva puta).**

**Simptom (A, živi API):** prijavljen kao običan korisnik (`qa.pretraga@…`, bez ijedne M24 dozvole), `POST /api/v1/hr/employees/<moj-id>/leave` sa telom `{"type":"GODISNJI_ODMOR","startDate":"2026-10-01","endDate":"2026-10-03","daysCount":"tri","note":null,"nepoznatoPolje":123}`:

```
HTTP 400 {"message":"HR dosije za ovog zaposlenog još nije popunjen — …"}
```

Poruka dolazi **iz servisa** (`hr.service.ts:128`) — znači da je zahtev sa `daysCount: "tri"` i nepoznatim poljem **prošao** `ValidationPipe` i stigao do poslovne logike. Isti test na ruti sa pravim DTO-om (`POST /contracting/capacity/stop-sale` + `"nepoznato":1`):

```
HTTP 400 {"message":["property nepoznato should not exist"]}
```

— tu `ValidationPipe` (`main.ts:43`, `whitelist + forbidNonWhitelisted`) radi kako treba.

**Uzrok (C):** `hr.controller.ts:3-7` uvozi `type CreateLeaveRecordDto`, `type UpsertEmployeeRecordDto`, `type UpsertLeaveEntitlementDto` — to su **TypeScript `interface`-i iz `hr.service.ts:6-31`**, ne klase sa `class-validator` dekoratorima. NestJS `ValidationPipe` proverava samo klase; za `interface` (koji u vreme izvršavanja postane `Object`) tiho **preskače** i whitelist i tipove. Isto u `branches.controller.ts:3,48` (`type UpdateBranchDto`).

**Obim (A, prebrojan skriptom nad svim kontrolerima):** `@Body(dto: X)` ukupno **173**, od toga **4** gde je `X` TS tip: `hr.controller.ts` ×3, `branches.controller.ts` ×1. Preostalih 169 su klase.

**Zašto Srednje, a ne Visoko — vidljiva ispravka u toku pisanja (dok. 40 §9):** prvi nacrt ovog nalaza bio je označen Visoko, sa obrazloženjem da `POST …/leave` nema `@RequirePermission` (sopstveni zahtev, ownership u servisu — ispravna odluka po M24 §3a), pa da **svaki prijavljeni zaposleni** može da pošalje `daysCount: -50` i tako poveća sopstveno stanje godišnjeg odmora (`getLeaveBalance`, `hr.service.ts:320`, sabira `daysCount`). Pokušaj obaranja (d) ispod je to **delimično oborio**: zahtev uvek nastaje kao `PENDING` (`hr.service.ts:136`), a u stanje ulaze samo `APPROVED` zapisi (`:315`) — između pogrešnog broja i stanja stoji odobravalac koji vidi „−50 dana". Ljudska kapija postoji, pa nije Visoko. Ostaje Srednje jer: (1) ni odobrenje ne proverava `daysCount` (`approveLeaveRecord` menja samo status), pa „−50" prolazi ako odobravalac klikne bez čitanja; (2) `PATCH employees/:userId` i `PUT leave-entitlements/:year` (HR sa EDIT dozvolom) primaju `"nije datum"` i `daysEntitled: "abc"` bez ikakve provere tipa ni raspona — `new Date("nije datum")` daje `Invalid Date` koja ide u Prisma i vraća se kao neobjašnjiva greška umesto `400` sa imenom polja. Servis proverava postojanje dosijea, status i razlog odbijanja (`:120-255`), ali **nijednu proveru tipa ni raspona**.

**Pokušaj obaranja:** (a) „možda `ValidationPipe` ipak validira `interface`" → ne, izmereno gore (isti pipe, dve rute, dva ishoda). (b) „možda Prisma odbije pogrešan tip pa je efekat samo ružna greška" → za `daysCount: "tri"` da (Prisma baca, filter prevede u grešku), ali za `daysCount: -50` **ne** — `Int` prima negativan broj. (c) „možda je `forbidNonWhitelisted` dovoljan" → nije primenjen jer metatip nije klasa. (d) „možda negativan broj ne stiže do stanja bez ljudskog odobrenja" → **tačno**, uvek `PENDING` pa `APPROVED` rukom — ovo je spustilo nalaz sa Visoko na Srednje. → **Nalaz opstaje kao Srednje.**

**Predlog:** pretvoriti 4 interface-a u klase sa `class-validator` dekoratorima (`IsEnum`, `IsDateString`, `IsInt`, `Min(1)`, `MaxLength`), u `dto/` folderu po istom obrascu kao svaki drugi modul. Uz to jedan test koji **dokazuje odbijanje** (`daysCount: -1` → 400), po zamci 13.6. Uz to `approveLeaveRecord` da odbije `daysCount <= 0` (ista provera i na kapiji, ne samo na ulazu). Nova zamka **13.8** u dok. 33 upisana u istom prolazu. Procena: 2–3 sata.

### 3.2 Ponuda iz teksta: iznos sa engleskim zarezom hiljada čita se hiljadu puta manji

**Klasa dokaza: A (izmereno nad funkcijom).**

`parseAmountMinor` (`apps/api/src/modules/m5-rezervacije/quotes/text-intake.service.ts:92-109`), pokrenuta nad ulazima koje test (`text-intake.service.spec.ts:9-22`) **ne** pokriva:

```
"1,240"      → 124      (= 1,24 — trebalo 1.240)
"2,500 EUR"  → 250      (= 2,50 — trebalo 2.500)
"12,500"     → 1250     (= 12,50 — trebalo 12.500)
"1,240,500"  → null
"850,00 €"   → 85000    (ispravno)
"1.240"      → 124000   (ispravno — pravilo „3 cifre posle tačke = hiljade" postoji za TAČKU, ne za zarez)
```

Test pokriva `1.240,00`, `1,240.00`, `1240`, `1.240`, `980 EUR`, `1 500`, `12,5` — svi prolaze; nijedan slučaj nije „zarez pa tačno 3 cifre bez tačke", a to je standardan zapis u mejlovima grčkih/turskih/hrvatskih hotela koji pišu na engleskom.

**Zašto Srednje, ne Visoko:** iznos se prikazuje prodavcu u formi pre kreiranja nacrta (§3.0j — čovek potvrđuje), pa greška ne ide direktno u ponudu. Ali forma je **prepopunjena** pogrešnom vrednošću, a 2,50 umesto 2.500 je tačno greška koju oko preskoči kad je „polje već popunjeno". Zamka 10.5 postoji baš zbog ovoga.

**Predlog:** isto pravilo za zarez kao za tačku — zarez praćen tačno 3 cifre bez druge interpunkcije = hiljade (`"1,240"` → 1240; `"12,5"` ostaje 12,50); `"1,240,500"` → ukloniti sve zareze. Dodati ovih 5 slučajeva u `it.each`. Procena: pola sata.

### 3.3 API dokumentacija zaostaje: 64 rute bez primera, M24 nema ni fajl

**Klasa dokaza: A (skripta nad kontrolerima × `docs/api/`).**

Skripta koja iz svakog `*.controller.ts` izvuče `@Controller` + `@Get/@Post/…` i traži putanju (sa ili bez prefiksa modula, `:id` ili `{id}`) u `docs/api/M<broj>-*.md`:

| Modul                                  |       Ruta |                                                                                                                                                                                                     Nema u dokumentaciji |
| :------------------------------------- | ---------: | -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| M24                                    |         10 |                                                                                                                                                                             **10 — fajl `docs/api/M24-*.md` ne postoji** |
| M5                                     |         62 |                                                                                                                                                            18 (handoff ×5, supplier-change-notices ×4, `search/countries | destinations`, `:id/history`, `transfer-ownership`, `itineraries/:id/abandon`, javni vaučer …) |
| M3                                     |         82 | 15 (`pricing-rules` ×3, `pricelist-surcharges` ×3, `DELETE` rute za rates/offers/cancellation-rules/ancillary, `blocks/:blockId`, `pricelist-imports/:id/retry`, `pricelist-versions/:versionNo/diff`, `:id/room-types`) |
| M15                                    |         13 |                                                                                                                                                                              6 (bi-terminal ×5, omnisearch/extract-file) |
| M2                                     |         24 |                                                                                                                                                                           5 (destination-profiles ×4, publish-readiness) |
| M4                                     |         10 |                                                                                                                                                         5 (`integrations/internal/providers/*` — interni, možda namerno) |
| M12                                    |         15 |                                                                                                                                                                                             4 (media ×3, public/content) |
| M1, M13, M23                           | 42, 10, 18 |                                                                                                                                                                                                                  3, 3, 3 |
| M6, M7, M9, M19                        |            |                                                                                                                                                                                                                     po 1 |
| M10, M11, M14, M16, M18, M20, M21, M22 |            |                                                                                                                                                                                                                    **0** |

**Ukupno 64 rute.** Spot-provera ručno (da skripta ne laže): `grep -c pricing-rules docs/api/M3-*.md` → 0; `grep -c handoff docs/api/M5-*.md` → 0. Nije sve nastalo od 7.9. (handoff je stariji), ali je provera nova.

Uz to: `docs/moduli/M24-ljudski-resursi/` sadrži samo spec (43) — **nema `00-OBJASNJENJE-M24-ZA-VLASNIKA.md`**, koje CLAUDE.md traži „čim modul dobije kod". Postojeći red u `27-BACKLOG` (linija 289, od 3.9.2026) je zastareo: kaže da M1–M4 nemaju API dok — imaju; M24 nema, a nije naveden. Ispravljeno u istom prolazu.

**Predlog:** (1) `docs/api/M24-ljudski-resursi.md` + objašnjenje za vlasnika — obavezna stavka izlaznog kriterijuma; (2) dopuna M3 i M5 dokumentacije za rute iznad; (3) skripta iz ove revizije kao `tools/provera-api-dok.mjs` u CI, da broj ne raste tiho — isti obrazac kao `provera-indeksa.mjs`. Procena: 1 dan za (1)+(2), sat za (3).

### 3.4 Registar „mock ili pravo" (dok. 42) nije dopunjen nijednim novim ekranom

**Klasa dokaza: A.**

`git log -1 -- docs/analize/42-STANJE-EKRANA-MOCK-ILI-PRAVO.md` → poslednja izmena **8.9.2026** (formatiranje). Od tada 8 novih ruta panela: `/kapaciteti`, `/cenovnici`, `/cenovnici/[id]`, `/kalendar-odsustava`, `/podesavanja/podaci-agencije`, `/podesavanja/poslovnice/[id]`, `/rezervacije/ponude/nova-iz-teksta`, `/ugovori/[id]/cenovnik` — `grep -c` za svaku u dok. 42 → **0**.

**Provereno da su svi pravi** (da ovo ne bude nalaz 1.1 u drugom ruhu): za svih 8, `grep -rl "mock|Mock|demo"` u folderu rute → 0 fajlova; svaki poziva `apiFetch`; svaki je u `nav.ts` (7 od 8; `/ugovori/[id]/cenovnik` nije u meniju ali ima 8 linkova iz drugih ekrana). Dakle registar zaostaje, ekrani ne.

**Zašto je ovo nalaz, a ne sitnica:** dok. 42 je nastao kao **mehanizam** (dok. 39 nalaz 5.1) da se prelazak mock → pravo ne desi na pola. Mehanizam koji se ne održava posle prvog dana ne štiti ni od čega — a sledeći ekran koji se doda na pola neće imati gde da se vidi. Predlog: dodati u tabelu „Kratka lista pre posla" (dok. 33) red „Pravim ili menjam ekran" pokazivač na dok. 42 — upisano u istom prolazu. Procena dopune 8 redova: 20 minuta.

### 3.5 Dve nove liste bez straničenja, jedna sa tihim odsecanjem

**Klasa dokaza: C.**

- `pricelist-imports.service.ts:113-115` `findAll()` → `findMany` bez `take` — spisak svih uvoza cenovnika ikad. Raste sporo (jedan po fajlu), ali bez granice.
- `offer-expiry.service.ts:442-452` `list()` → `take: 200` bez `page` i bez poruke — isto „tiho odsecanje" koje je nalaz 2.2 u dok. 39 uklonio sa liste rezervacija.
- `hr.service.ts:104,238` `listLeaveRecords`/`listLeaveEntitlements` — po zaposlenom, prirodno ograničeno (desetine redova godišnje); **nije problem**, navodim da se vidi da je gledano.

Predlog: `PaginationQueryDto` obrazac iz nalaza 2.2 (pojedinačni `@Query('page')`, ne DTO nad celim query stringom — zamka iz dok. 39 §2.2). Procena: 2 sata za obe.

---

## 4. Nisko — sitno, vredno kad se ionako dira taj fajl

| #   | Nalaz                                                                                                                                  | Dokaz                                                                                           | Predlog                                                                                                                                                                                                                                                 |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | Zastareo komentar: `pricelist-imports.service.ts:128-131` kaže da AI ekstrakcija „zahteva odluku o AI provajderu koja još nije doneta" | A: `pricelist-extraction.service.ts:13,223,485` uvozi i zove `AnthropicClientService`; 24 testa | Obrisati komentar; isti rod kao a3269a95 (zastareo komentar u seed.ts)                                                                                                                                                                                  |
| 4.2 | `any` u `apps/api` produkcijskom kodu: **138 → 149** (+19 novih, −8 uklonjenih)                                                        | A: `git grep` na `c0bf5520` i `HEAD`, bez `*.spec.ts`                                           | Dok. 39 §3.3 pravilo („ne dodaje se u nov kod") nije ispoštovano u 7 fajlova (najviše `pricelist-calendar.service.ts` ×8). ESLint ga ima kao `warn` — vidi se, ne blokira. Ili prihvatiti da je pravilo mrtvo, ili ga podići na `error` za nove fajlove |
| 4.3 | `.env` lokalno zaostaje 13 ključeva (`M3_OFFER_EXPIRY_DAYS_*`, `PRICELIST_STORAGE_DIR`, `SMTP_*`, `PANEL_BASE_URL`, `WEB_BASE_URL`…)   | A: `npm run doctor` 18.9.2026                                                                   | Nije greška koda (mehanizam iz nalaza 4.4 radi tačno kako treba — prijavio je). Navodim da vlasnik zna da posao pred istek (M3 v1.44) lokalno radi sa podrazumevanim pragovima                                                                          |

---

## 5. Procene i preporuke (klasa D — mišljenje, ne nalaz)

- **`upsert` u petlji je obrazac koji će se ponoviti.** Nalaz 2.1 nije jedini kandidat — isti oblik (`for … await prisma.x.upsert`) je prirodan prvi pokušaj za svaki „masovni unos po danu". Vredi jedan pomoćni servis („upiši raspon dana u jednoj transakciji") koji i stop-sale i override i budući `capacity_day` upisi koriste.
- **Nalazi 2.1 i 3.1 su oba iz koda koji je prošao sve CI provere.** Nijedan CI ne može da uhvati bez namerne provere (merenje trajanja; test koji šalje pogrešan tip). To je isti zaključak kao u dok. 39 — CI dokazuje da kod radi kako je napisan, ne da je napisan kako treba.

---

## 6. Provereno, ispravno je

Da se razlikuje „nema problema" od „nije gledano":

- **Ograde prava:** 71 nova ruta od 7.9. Svaka ruta u M3 (82/82), M5 (62/62, +1 `@Public` javni vaučer), M2, M7, M10, M12, M18, M23 nosi `@RequirePermission`. Rute bez njega postoje samo tamo gde je to **komentarisana** odluka: M24 (ownership u servisu, `hr.controller.ts:14-16`), M19 (chat, učesništvo u servisu), M1 branches/users (delimično). Globalni `JwtAuthGuard` (nalaz 3.1 dok. 39) pokriva sve — proverено čitanjem `jwt-auth.guard.ts:48-52` i `permissions.guard.ts:24-29`. Jedan novi `@Public()` (javni podaci agencije, `public-agency.controller.ts:15`) — namerno, čita samo `getPublic()`.
- **Migracije (21 nove):** dve destruktivne naredbe — `DROP COLUMN annual_leave_days_entitled` (M24) ima **backfill** u `leave_entitlements` pre brisanja; `SET NOT NULL contract_id` (M3 ancillary) ima popunjavanje iz perioda + `RAISE EXCEPTION` ako ijedan red ostane prazan. Oba tačno kako treba. Indekse na stranim ključevima proverava CI (`provera-indeksa.mjs`).
- **Testovi:** svih 9 novih/menjanih M3 servisa ima `.spec.ts` (capacity 26, work-queue 7, pricelist 15, versions 17, offer-expiry 14, calendar 19, imports 29, extraction 24, periods 40 = 191 `it`). M5: bed-fit, occupancy, room-types, text-intake, quote-item-builder — svi imaju.
- **Mreža kapaciteta (`grid`)** je urađena kako treba: jedan upit za periode, jedan za prodato, jedan za proizvode, raspodela u memoriji (`capacity.service.ts:128-190`) — bez N+1. Raspon ograničen na 92 dana.
- **`bed-fit.ts`** (kapacitet sobe u prodaji, M5 v2.51): pročitan ceo; koristi istu matricu kao ekran kataloga (ne duplira), redosled dece ne utiče, „dete koje deli krevet" je svojstvo sobe. Logika je tačna po M2 §2.3g.
- **Ponuda iz teksta:** prompt (`text-intake.service.ts:310`) modelu izričito zabranjuje računanje („Samo prepisuj šta piše — ne računaj cene, ne izvodi datume"); iznos i datumi se izvode u kodu — kako spec §3.0j traži. Nalaz 3.2 je greška u tom kodu, ne u podeli posla.
- **Novi ekrani panela (8):** svi pravi, svi dostupni (poglavlje 3.4).
- **Dnevni poslovi:** `offer-expiry.runDaily` radi `findUnique` po kandidatu i pragu u petlji — ali nad skupom „ističe u narednih N dana" (desetine, ne hiljade), jednom dnevno. Prihvatljivo; navodim da je gledano.
- **Nema tajni u novom kodu** (`grep` po `sk-`, `password=`, `secret` u diff-u → samo imena env promenljivih).

---

## 7. Već zabeleženo — ne ponavlja se

| Tema                                             | Gde stoji                          | Stanje                                                                                                                                                                      |
| :----------------------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nedostatak API dok. i objašnjenja za vlasnika    | `27-BACKLOG` linija 289 (3.9.2026) | Zastarelo — govorilo o M1–M4, koji su u međuvremenu dobili dokumentaciju; M24 nije bio naveden. Red **ispravljen** u ovom prolazu; nalaz 3.3 ovde je širi (rute, ne moduli) |
| Rok najave stop-sale-a iz ugovora nije modelovan | `27-BACKLOG`, M3 sekcija           | Otvoreno, nezavisno od nalaza 2.1                                                                                                                                           |
| Četiri mock ekrana pretrage (dok. 39 §3.6)       | dok. 39                            | Vlasnik: čeka izmenu izgleda; nije dirano                                                                                                                                   |

---

## 8. Koliko je nalaza prošlo pun postupak (dok. 40 §8)

- **Pun postupak** (klasa dokaza + odvojen uzrok + dokaz izvršavanja + prebrojan obim + pokušaj obaranja): **1 od 1 u poglavlju 2** (2.1) — nalaz 3.1 je prošao isti pun postupak i baš zbog njega spušten na Srednje.
- **Klasa A bez pokušaja obaranja** (Srednje po pravilu, ne traži se): 3.2, 3.3, 3.4, 4.1, 4.2, 4.3.
- **Klasa C** (pročitano, nije izmereno): 3.5.
- **Klasa D**: poglavlje 5.

**Gde da veruješ manje:** 3.5 (nisam merio koliko uvoza/obaveštenja stvarno ima, samo da granice nema). Sve ostalo je izmereno ili viđeno.

---

## 9. Predlog redosleda

Ne tražim odluku između opcija — ovo je preporuka, po odnosu „koliko boli" naspram „koliko traje":

1. **2.1 stop-sale u transakciji + granica** (pola dana) — pre nego što neko klikne „ceo objekat" nad pravim hotelom.
2. **3.1 validacija M24/branches** (2–3 h) — jeftino, zatvara jedini put kojim pogrešan tip ulazi u bazu.
3. **3.2 zarez hiljada** (pola sata) — pre nego što prva prava ponuda iz mejla dobije 2,50 EUR.
4. **3.3 M24 dokumentacija + provera u CI** (1 dan) — izlazni kriterijum M24 bez toga nije ispunjen.
5. **3.4 + 3.5 + 4.1** — u prolazu kad se ti fajlovi ionako diraju.

_Nijedna izmena koda iz ovog dokumenta nije napravljena. Izmenjeni su samo dok. 33 (zamka 13.8, red u tabeli), dok. 27 (zastareo red) i ovaj fajl._
