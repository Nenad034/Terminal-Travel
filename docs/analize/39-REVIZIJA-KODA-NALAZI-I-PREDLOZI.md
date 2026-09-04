# 39 — Revizija koda: nalazi i predlozi

**Datum:** 4.9.2026
**Povod:** zahtev vlasnika — *„prođite kroz ceo folder i sve tipove fajlova u potrazi za nelogičnostima, greškama, lošim kodovima, stvarima koje nisu optimizovane… sve ono za šta smatrate da treba da bude bolje ili zamenjeno boljim."*
**Status:** spisak za odluku. **Nijedna izmena nije napravljena** — vlasnik prvo bira šta se radi.

---

## Kako je pregledano

Pregledano je stanje na dan 4.9.2026 (commit `1b9b7a9`): 95.620 linija koda u četiri aplikacije (`apps/api` 65k, `apps/panel` 42k, `apps/web` 4k, `apps/mobile` 2,3k), Prisma šema sa 111 modela, 143 test fajla, CI, konfiguracija i dokumentacija.

Nalazi nisu pretpostavljeni — svaki je proveren nad **stvarnim kodom, stvarnom bazom ili stvarnim ekranom**. Gde je nalaz dokazan pokretanjem, u tekstu stoji tačan dokaz.

**Šta je namerno izostavljeno:** stvari koje su već zabeležene u `27-BACKLOG-IDEJA-I-PREDLOZI.md` i `36-BEZBEDNOSNA-ANALIZA-PRETNJE-I-ZASTITA.md` nisu prijavljene kao nov nalaz — spisak takvih je u poglavlju 6, da se vidi da su proverene i da se ne duplira posao.

---

## 1. Kritično — korisnik danas vidi pokvarenu funkciju

### 1.1 Klik na rezervaciju u listi otvara „nije pronađena"

**Simptom (dokazano, ne pretpostavljeno):** lista rezervacija prikazuje stvarne rezervacije iz baze. Klik na bilo koju otvara ekran koji ispisuje doslovno:

> „Rezervacija MOCK-LISTA-2026-0001 **nije pronađena** (mock lista)."

**Uzrok:** u panelu postoje **dva odvojena ekrana za istu stvar**:

| Ekran | Veličina | Izvor podataka | Koristi se? |
| :---- | :---- | :---- | :---- |
| `rezervacije/[id]/page.tsx` | **1.742 linije** | pravi API (`/sales/bookings/:id`), pun dosije sa svim karticama | **ne otvara se iz liste** |
| `rezervacije/lista/[bookingNumber]/page.tsx` | 44 linije | hardkodovan niz `MOCK_BOOKINGS` | da — lista vodi ovde |

Lista je u međuvremenu prešla na prave podatke (`apiFetch('/sales/bookings')`), ali `openTab` u `BookingsTable.tsx:161` i dalje vodi na mock ekran, koji rezervaciju traži po broju u hardkodovanoj listi. Stvarne rezervacije tamo ne postoje, pa se svaka završi praznim stanjem.

**Zašto je ovo najozbiljniji nalaz:** ovo je tačno obrazac zbog kog `CLAUDE.md` i postoji — *„više paralelnih modula koji rade sličan posao"* iz PrimeTravel analize. Ovde je gore nego u PrimeTravel-u: verzija sa 1.742 linije stvarnog rada je **mrtva**, a živa je ona sa 44 linije koja ne radi ništa.

**Predlog:** preusmeriti klik iz liste na `/rezervacije/[id]` (koristeći `id` koji API već vraća, umesto broja rezervacije), pa mock ekran i `mock-data.ts` obrisati. Ako u mock ekranu ima prikaza kojih nema u pravom (npr. „tok rezervacije" raspored), preneti ih pre brisanja.
**Procena:** pola dana, uz pregled šta tačno ne sme da se izgubi.

---

### 1.2 Najava dobavljaču se obeleži kao poslata, a mejl ne ode

**Simptom:** `M22MailboxStubService.sendViaSharedMailbox()` vraća `{ sent: true }` i samo upiše red u dnevnik. Pozivaju ga `SupplierManifestsService` i `SupplierChangeNoticesService` — dakle **operativne liste i izmene rezervacija ka dobavljačima**. Status pređe `DRAFT → SENT`, ekran pokaže „poslato", hotel nikad ne dobije poruku.

**Uzrok:** stub je pisan dok M22 nije postojao, i to piše u njemu:

> „M22 (Email/Inbox platforma) **još nije implementiran** … ovaj servis je TODO stub/no-op"

Ali M22 **jeste** implementiran (`apps/api/src/modules/m22-email-inbox/` sa `email-threads`, `mailboxes`, `email-provider`), a od 4.9.2026 postoji i `MailerService` sa pravim SMTP-om. Tvrdnja u komentaru je preživela modul koji opisuje — **to je zamka 13.2 iz `33-ZAMKE`, ponovljena**.

**Predlog:** povezati stub sa stvarnim M22 sandučetom (ili `MailerService`-om), a do tada — što je važnije — **prestati vraćati `sent: true` za nešto što nije poslato**. Lažan uspeh je gori od jasne greške, jer niko ne zna da hotel nije obavešten.
**Procena:** 1–2 sata za iskren povratni podatak, oko dan za pravo povezivanje na M22.

---

## 2. Visoko — radi danas, pada pod stvarnim opterećenjem

### 2.1 Baza nema indekse na stranim ključevima — 81 komad

**Dokaz (upit nad stvarnom bazom, ne procena):**

```
strani ključevi bez indeksa: 81
obični indeksi u celoj bazi:  2
```

**Šta to znači jednostavno:** PostgreSQL, za razliku od nekih drugih baza, **ne pravi indeks automatski** kad se definiše veza između dve tabele. Bez indeksa, svako pitanje tipa „daj mi sve stavke ove rezervacije" tera bazu da pročita **celu tabelu** i proverava red po red. Sa nekoliko stotina redova to niko ne primeti. Sa sto hiljada — svaka takva pretraga traje sekundama, i to na svakom ekranu istovremeno.

Pogođeno je praktično sve: `refresh_tokens.user_id`, `products.source_contract_id`, `user_roles.role_id`, `supplier_contacts.supplier_id` i još 77.

**Predlog:** jedna migracija koja doda `@@index` na sve FK kolone (Prisma ih zatim održava). Nema rizika po podatke — indeks ne menja sadržaj, samo brzinu.
**Procena:** pola dana uključujući proveru da je migracija čista.

---

### 2.2 Paginacije nema nigde, a lista rezervacija tiho odseca na 200

**Dokaz:** u celom `apps/api` ima **0** pojava `skip:` i **0** pojava `cursor:`. Od 209 poziva `findMany`, samo 5 ima ikakav limit. Nijedan query DTO ne prima `page` ni `limit`.

Konkretno u `bookings.service.ts:591` stoji `take: 200` bez ijednog objašnjenja. To nije paginacija nego **tiho odsecanje**: agencija sa 201 rezervacijom neće videti najstariju, i ništa na ekranu neće reći da nešto nedostaje.

Katalog proizvoda nema ni to — vraća sve. Danas 217 zapisa, ali kad se uključi API dobavljač (M4) to postaju desetine hiljada u jednom odgovoru.

**Predlog:** zajednički obrazac paginacije (`page`/`limit` u DTO sa `@Max()`, odgovor u obliku `{ data, total, page }`), pa primena redom po ekranima — prvo rezervacije, katalog i CRM. Do tada, `take: 200` bar zameniti jasnom porukom „prikazano prvih 200 od N".
**Procena:** 1 dan za obrazac + 2–3 dana za primenu na glavne liste.

---

### 2.3 Usklađivanje BI podataka radi tri upita po svakoj stavci, nad neograničenim skupom

`m13-bi/reconciliation/reconciliation.service.ts:40` uzme **sve** stavke rezervacija bez limita, pa u petlji za svaku uradi `findUnique` + `syncBookingItem` + još jedan `findUnique`.

Sa 10.000 stavki to je preko 30.000 upita u jednoj operaciji. Danas radi jer je baza mala.

**Predlog:** obrada u serijama (npr. po 500), sa jednim upitom po seriji umesto po zapisu. Isti obrazac postoji na još ~15 mesta u drugim servisima; ovaj je najizraženiji, pa neka bude prvi.
**Procena:** pola dana za ovaj, 1–2 dana za pregled ostalih.

---

### 2.4 Panel nema nijedan test, a CI ga uopšte ne dodiruje

| Celina | Testova | Gradi se u CI? |
| :---- | :---- | :---- |
| `apps/api` | 121 unit + 22 e2e | da |
| `apps/panel` (42.000 linija) | **0** | **ne** |
| `apps/web` | **0** | **ne** |
| `apps/mobile` | 2 | **ne** |

CI (`.github/workflows/ci.yml`) gradi i testira isključivo `apps/api`. Ni `tsc` ni `eslint` ne rade nad panelom.

**Posledica se već desila:** greška `Cannot read properties of undefined (reading 'base_beds')` prošla je kroz CI netaknuta i pukla vlasniku na ekranu. Ništa je nije moglo uhvatiti.

**Predlog:** (a) u CI dodati `tsc --noEmit` i `next build` za panel i web — to samo po sebi hvata celu klasu grešaka i košta par minuta po push-u; (b) uvesti minimalan skup testova panela za putanje koje se ne smeju pokvariti (prijava, lista rezervacija, dosije, pretraga). Za (b) je potreban `@testing-library/react`, koji je nova zavisnost — **traži tvoju potvrdu** po pravilu iz `CLAUDE.md`.
**Procena:** (a) 2 sata, (b) 2–3 dana za smislen skup.

---

### 2.5 Nijedan ekran nema svoju stranicu greške

U `apps/panel` i `apps/web` ne postoji **nijedan** `error.tsx`, `global-error.tsx` ni `not-found.tsx`.

Posledica: svaka greška u renderu — kao ona sa `base_beds` — daje golu Next.js stranicu bez konteksta, bez „pokušaj ponovo" i bez traga šta je korisnik radio. Za internu poslovnu aplikaciju u kojoj agent sedi na telefonu sa gostom, to je razlika između „osveži i nastavi" i „zovi Nenada".

**Predlog:** `error.tsx` po glavnim celinama (rezervacije, katalog, finansije) + jedan `global-error.tsx`, sa porukom na srpskom, dugmetom za ponovni pokušaj i tihim upisom u M18 nadzor.
**Procena:** pola dana.

---

## 3. Srednje — nije hitno, ali se plaća kasnije

### 3.1 Zaštita endpointa se dodaje ručno, umesto da bude podrazumevana

Od 86 kontrolera, 81 ima `@UseGuards(JwtAuthGuard)` **ručno napisan**. Pet koji ga nemaju jesu namerno javni. Danas je stanje ispravno — proveravao sam svih pet.

Problem je smer greške: ako sledeći kontroler zaboravi guard, endpoint je **tiho otvoren svetu**. Sistem je „otvoren dok se ne zatvori", a treba da bude obrnuto.

**Predlog:** globalni `JwtAuthGuard` u `app.module.ts` + `@Public()` dekorator na onih pet javnih. To je standardan NestJS obrazac i posle njega zaboravljen guard znači „zaključano", ne „otvoreno".
**Procena:** 2–3 sata + prolaz kroz e2e testove.

### 3.2 `apps/api` nema ESLint

Panel i web imaju `eslint.config.mjs`; backend od 65.000 linija **nema ga uopšte**, niti `lint` skriptu. Nema ni Prettier nigde, pa formatiranje zavisi od toga koja je sesija pisala fajl.

**Predlog:** ESLint sa `@typescript-eslint` za `apps/api` (isto podešavanje kao panel) i Prettier u korenu, pa jednokratno formatiranje celog repozitorijuma u zasebnom commit-u da se ne meša sa stvarnim izmenama.
**Procena:** pola dana.

### 3.3 189 mesta sa tipom `any`

U produkcijskom kodu (bez testova) ima 189 upotreba `any`. Svaka je mesto gde TypeScript prestaje da proverava — a upravo je taj propust pustio grešku sa `base_beds` do ekrana.

**Predlog:** ne masovna zamena, nego pravilo: `any` se ne dodaje u nov kod, a postojeći se čisti u fajlu koji se ionako dira. Uz ESLint pravilo `no-explicit-any` kao upozorenje (ne greška), da se broj vidi i pada.
**Procena:** kontinuirano, bez zasebnog zadatka.

### 3.4 Pet servisa se zovu „Stub", a odavno nisu stubovi

`ComplianceStubsService`, `LoyaltyStubService`, `ClientContractStubService`, `SubagentStubService`, `FiscalDocumentStubService` — svih pet **stvarno rade posao** i pozivaju implementirane module. Ime je zaostalo iz vremena kad ti moduli nisu postojali.

Posledica je stvarna, ne kozmetička: sledeća sesija (ili nov saradnik) pročita „Stub" i pretpostavi da funkcija ne radi — isto kao što se meni desilo pri ovom pregledu, dok nisam otvorio svaki fajl. Jedini koji je i dalje pravi stub je `M22MailboxStubService` (nalaz 1.2), pa ime nosi i tačne i netačne slučajeve.

**Predlog:** preimenovati u `…BridgeService` (most ka drugom modulu), a „Stub" ostaviti isključivo onome što stvarno ne radi.
**Procena:** 1 sat.

### 3.5 M21 i M23 imaju po svog AI asistenta nad člancima

Oba modula imaju članke sa prevodima, objavljivanje i AI asistenta koji odgovara na pitanja nad njima — `help-assistant.service.ts` (470 linija) i `knowledge-assistant.service.ts` (355 linija).

**Nije duplikat infrastrukture** — embedding je uredno deljen kroz `GeminiEmbeddingService` u M15, što je urađeno kako treba. Ali dva asistenta sa 825 linija ukupno rade konceptualno isti posao nad različitim skupom članaka.

**Predlog:** ovo je pitanje za tebe, ne tehnička odluka: da li su „uputstvo za korišćenje platforme" (M21) i „znanje o destinacijama" (M23) dovoljno različiti da opravdaju dva odvojena asistenta. Ako jesu — ostaje kako jeste, samo se zapiše zašto. Ako nisu — spajanje u jedan asistent sa filterom po vrsti sadržaja štedi buduće održavanje na dva mesta.
**Procena:** odluka; ako se spaja, 2–3 dana.

### 3.6 Četiri ekrana pretrage prikazuju hardkodovane rezultate

`AccommodationResultsMock`, `FlightResultsMock`, `TransferResultsMock`, `ExcursionResultsMock` prikazuju izmišljene hotele/letove umesto poziva na `GET /search`, koji **radi** (proveren: vraća 11 ponuda za Grčku iz stvarne baze).

Ovo **nije propust** — u kodu izričito piše „čeka potvrdu izgleda pre prave žice", dakle svesna odluka. Navodi se ovde samo zato što je od tada prošlo, katalog je popunjen (217 proizvoda sa koordinatama), pa je pitanje da li je potvrda izgleda i dalje otvorena.

**Predlog:** ako je izgled potvrđen — povezati na `GET /search` i obrisati mock fajlove. Ako nije — ostaviti, ali je vredno da bude svesna odluka, ne inercija.
**Procena:** 1–2 dana po vrsti proizvoda.

---

## 4. Nisko — sitno, vredno kad se ionako dira taj fajl

| # | Nalaz | Predlog |
| :-- | :---- | :---- |
| 4.1 | 18 mesta koristi `key={index}` u React listama | Zameniti stabilnim ključem (id/šifra) — sa indeksom se pri sortiranju/brisanju stanje reda „zalepi" za pogrešan podatak |
| 4.2 | Nema nijednog `loading.tsx` | Skeleton za sporije ekrane (rezervacije, izveštaji) — Next.js ga prikazuje dok server radi |
| 4.3 | `apps/panel`, `apps/web`, `apps/mobile` nemaju README | Kratak README po aplikaciji (pokretanje, env, gde šta stoji) — `apps/api` ima dobar primer |
| 4.4 | `.env` i `.env.example` se razilaze bez ikakve provere | Već me ujelo 4.9.2026: `.env` je zaostao za 8 promenljivih, pa pozivnice i reset lozinke **tiho** nisu radili. Predlog: provera pri startu API-ja — ako `.env.example` ima ključ kog nema u `.env`, ispisati upozorenje (ne rušiti) |

---

## 5. Predlog novog — mehanizmi, ne zakrpe

Ovo su stvari kojih **nema**, a koje bi sprečile da se nalazi iz ovog spiska ponove:

**5.1 Provera „mock ili pravo" na jednom mestu.** Nalaz 1.1 je nastao jer se prelazak sa mock-a na prave podatke desio na pola — lista je prešla, ekran nije, i ništa to nije primetilo. Predlog: jedan popis (npr. `docs/analize/STANJE-EKRANA.md` ili tabela u M17 spec) sa jednim redom po ekranu: koristi mock / koristi API / delimično. Popunjava se u istom prolazu kad se ekran menja. Bez toga „delimično prešli" ostaje nevidljivo.

**5.2 Provera zdravlja lokalnog okruženja jednom komandom.** Danas se za podizanje traži: Docker, migracije, trigger, seed, tri mock skripte tačnim redosledom, geokodiranje na kraju, `.env` sa 8 novih ključeva. Svaki od tih koraka me je danas ili juče negde iznenadio. Predlog: `npm run doctor` koji proveri i **jasno kaže** šta nedostaje (baza podignuta? migracije primenjene? seed pušten? `.env` potpun? koliko proizvoda/rezervacija ima?). Nova sesija na novoj mašini time prestaje da bude arheologija.

**5.3 Merenje umesto pretpostavke o brzini.** Nalazi 2.1–2.3 danas nikoga ne bole jer baza ima 217 proizvoda i 17 rezervacija. Predlog: seed skripta za „veliku bazu" (npr. 50.000 rezervacija) koja se pušta samo namerno, da se pred lansiranje vidi šta stvarno puca. Bez toga se prvi put meri na pravim gostima.

---

## 6. Provereno, a već zabeleženo — ne ponavlja se

Ovo su stvari koje sam našao, ali **već stoje zapisane**. Navodim ih da se vidi da su proverene i da ne bi delovalo kao nov nalaz:

| Tema | Gde već stoji | Stanje |
| :---- | :---- | :---- |
| 31 ranjivost u zavisnostima, NestJS 10→12, Prisma 5→7, Next 14→16 | `27-BACKLOG` (linija 424) | Svesno odloženo do izbora hostinga, sa obrazloženjem. Napomena: brojke su od 13.8.2026 — danas je 31 ranjivost (9 high), a NestJS je u međuvremenu otišao na 12, Prisma na 7 |
| Nema strožeg limita na `/iam/auth/login` | `36-BEZBEDNOSNA-ANALIZA` §3, stavka 1 | Otvoreno za prolaz pred lansiranje |
| CORS nije eksplicitan; M19 WebSocket ima `origin: '*'` | `36-BEZBEDNOSNA-ANALIZA` §3, stavka 2 | Isto |
| Bulk čitanje gostiju bez limita (M6) | `36-BEZBEDNOSNA-ANALIZA` §3, stavka 3 | Isto — nalaz 2.2 ovde je širi (paginacije nema **nigde**, ne samo u M6) |
| Nema Row-Level Security u Postgresu | `36-BEZBEDNOSNA-ANALIZA` §3, stavka 5 | Isto |

**Što je provereno i ispravno** (navodim jer je vredno znati da nije problem): nema tajni u kodu; `.env` nije u git-u; `helmet` je uključen; `ValidationPipe` odbija nepoznata polja; nema `console.log` u produkcijskom kodu; nema progutanih grešaka (`catch {}`); nema `@RequirePermission` na klasi kontrolera (zamka 13.5 izbegnuta); nema mrtvih komponenti u panelu; embedding je uredno deljen umesto dupliran.

---

## 7. Predlog redosleda

Ako se ide redom po odnosu „koliko boli" naspram „koliko traje":

**Prvo (par dana):** 1.1 klik na rezervaciju · 1.2 lažno „poslato" dobavljaču · 2.1 indeksi · 2.4a `tsc`+`build` u CI · 2.5 stranice greške

**Zatim (nedelja):** 2.2 paginacija · 3.1 globalni guard · 3.2 ESLint za API · 2.3 N+1 · 3.4 preimenovanje „Stub"

**Pred lansiranje (uz hosting):** sve iz poglavlja 6 (nadogradnje, CORS, login limit, RLS) · 5.3 merenje na velikoj bazi

**Odluke koje su tvoje, ne tehničke:** 3.5 jedan ili dva AI asistenta · 3.6 da li je izgled pretrage potvrđen · 2.4b uvođenje `@testing-library/react`

---

*Nijedna izmena iz ovog dokumenta nije napravljena. Sledeći korak je tvoj izbor šta se radi i kojim redom.*
