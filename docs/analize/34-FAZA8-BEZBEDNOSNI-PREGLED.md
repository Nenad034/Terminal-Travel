# Faza 8 — Bezbednosno očvršćavanje: dnevnik pregleda

*(Master dokument poglavlje 8: "Bezbednosni audit, penetraciono testiranje, DR/backup vežba, revizija usklađenosti sa svim zakonskim rokovima." Izlazni kriterijum: "Sistem prošao nezavisnu proveru pre nego što se smatra dugoročno stabilnim za skaliranje.")*

**Zašto ovaj fajl postoji, ne Nivo 2 specifikacija.** Faza 8 nije modul (M1–M23) — nema svoj Nivo 2 dokument niti "Izlazni kriterijum" čeklistu u tom obliku. Ono što master dokument stvarno traži (nezavisan pen-test, DR vežba nad pravom infrastrukturom, PCI-DSS sertifikacija) zahteva treću stranu i produkcionu infrastrukturu koja namerno još nije izabrana — AI agent to ne može zameniti niti simulirati kao da je urađeno. Ovaj fajl je **dnevnik pregleda koda naspram bezbednosnog baseline-a iz poglavlja 9**, isti princip kao `33-ZAMKE-I-OBAVEZNE-PROVERE.md` (nalaz → provera → status), ne zamena za pravu spoljnu reviziju.

---

## 29.8–30.8.2026 — prvi prolaz, pregled koda

### Čisto (provereno, bez nalaza)

- **SQL injekcija** — svi `$queryRaw`/`$executeRaw` pozivi (M3 `contract-periods.service.ts`, M21/M23 semantička pretraga preko `Prisma.sql`, Event Bus `pg_notify`) koriste Prisma-in tagged-template mehanizam (parametrizovano), nigde `Prisma.raw()` (koji bi to zaobišao). `toVectorLiteral()` (M21/M23) prima samo brojeve iz AI embedding-a, ne korisnički tekst.
- **Guard pokrivenost kontrolera** — 7 kontrolera bez `@UseGuards` (`public-content`, `public-products`, `public-knowledge`, `search`, `guest-checkout`, `public-post-trip-surveys`, `mcp`) — svih 7 su **namerno** javni (anonimna pretraga/M8 sajt/MCP), sa dokumentovanim obrazloženjem i, gde je bitno, servisni sloj fizički ne učitava ništa van dozvoljenog (ne oslanja se samo na "guard bi trebalo da..."). `search.controller.ts` (kanal `INTERNAL_PANEL`) i `mcp.controller.ts` rade sopstvenu, stvarnu kriptografsku proveru tokena ručno (`jwt.verify`), ne samo dekodiranje bez provere potpisa.
- **WebSocket auth** (M19 `chat-gateway.service.ts`) — token dolazi iz `socket.handshake.auth.token` (klijent ga eksplicitno šalje), ne iz kolačića koji bi browser slao automatski cross-origin — `cors: { origin: '*' }` na gateway-u zato nije aktivno iskoristivo (CSWSH) danas, iako je šire nego što treba (vidi "Otvoreno" ispod).
- **Tajne u repozitorijumu** — `.env`/`.env.local` su u `.gitignore` (root), jedino `.env.example` fajlovi su praćeni i sadrže isključivo placeholder vrednosti ("promeniti ovo u..."), nijedan pravi ključ/lozinka.
- **Lozinke i MFA** — Argon2id heš (M1 spec §5), MFA sekret enkriptovan u mirovanju (`secret-box.ts`, `ENCRYPTION_KEY` iz env-a, ne hardkodovano).
- **Rate limiting (osnovni)** — globalni throttler postoji (`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])`, `app.module.ts`, primenjen preko `APP_GUARD`), plus stroži limiti gde treba (`guest-checkout` 5/sat po IP preko `@Throttle`, MFA/lozinka lockout M1 spec §5, dopunjeno 29.8.2026 — vidi M1 spec).
- **Validacija ulaza** — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` globalno (`main.ts`) — sprečava mass-assignment neočekivanih polja u telu zahteva.

### Rešeno (30.8.2026, potvrđeno vlasnikom)

1. **`helmet` dodat** (`apps/api/src/main.ts`) — `app.use(helmet({ contentSecurityPolicy: false }))`. CSP namerno isključen (lomi Swagger UI, `apps/api` inače servira isključivo JSON koji CSP ne štiti). Upisano u Master dokument poglavlje 6. Uživo provereno: `curl -I` pokazuje `Strict-Transport-Security`/`X-Content-Type-Options`/`X-Frame-Options` i ostala helmet zaglavlja; Swagger UI (`/api/docs`) i dalje radi bez konzolnih grešaka; svih 785 testova prolazi.
2. **`next-intl` 3.19.1 → 4.14.1** (`apps/web`) — rešava dve prijave (open redirect, prototype pollution preko `experimental.messages.precompile`). Ova aplikacija ne koristi `next-intl/navigation` pomoćnike (`createSharedPathnamesNavigation` i sl., najveći izvor v3→v4 lomljivih izmena) — samo `getRequestConfig`/`createMiddleware`, oba nepromenjena u v4. `tsc --noEmit` čist, `next build` prošao za svih 8 jezika, uživo provereno (sr i en početna strana, bez konzolnih grešaka).
3. **`exceljs` NIJE dirat** — `npm audit`-ov predlog "fix" je zapravo vraćanje 3 glavne verzije unazad (4.4.0 → 3.4.0), ne napredak: čak i najnovija objavljena verzija exceljs-a (4.4.0, ono što već koristimo) zavisi od istog ranjivog `uuid@^8.3.0` — verzija 3.4.0 "prolazi" audit samo zato što tada exceljs uopšte nije zavisio od `uuid`, ne zato što je bezbednija. Stvarna izloženost je zanemarljiva (ranjivost je u `uuid` funkciji kojoj se prosleđuje `buf` parametar — naš kod, preko exceljs-a, taj parametar nigde ne prosleđuje), a rizik od kvara stvarno korišćene funkcionalnosti (izvoz u Excel, M15 `report-generator.ts`/`extract-file.service.ts`) pri skoku 3 glavne verzije unazad je neproporcionalno veći od koristi. Odluka: sačekati da exceljs sam ažurira svoju `uuid` zavisnost uzvodno, ne menjati ništa ovde.

### Nalazi — i dalje čekaju odluku vlasnika

1. **Preostale ranjivosti u zavisnostima** (multer, picomatch, postcss/Next.js major skok, `@nestjs/platform-express`/`@nestjs/cli`) — sve zahtevaju `--force` i veću (major) promenu verzije od next-intl-a iznad; najveći pojedinačni rizik/korist je Next.js major skok (rešava XSS/path traversal u postcss lancu, ali dira jezgro oba Next.js kanala) — namerno odložen za poseban, pažljivije testiran prolaz, ne uz ovaj.
2. **`ChatGatewayService` (M19) `cors: { origin: '*' }`** — nije danas iskoristivo (obrazloženo iznad), ali širi je nego što treba po principu najmanjeg ovlašćenja. Kada se izaberu stvarni domeni panela/sajta/mobilne aplikacije, ograničiti na tačnu listu — sitna izmena, ali čeka da ti domeni uopšte postoje (hosting provajder namerno neizabran).
3. **Swagger (`/api/docs`) nema svoj guard** — u razvoju je to očekivano i korisno; pre bilo kakvog javnog izlaganja API-ja, ili se gasi u produkciji ili se stavlja iza autentikacije — čeka odluku o hostingu/produkciji, ne pre.

---

## 30.8.2026 — drugi prolaz, IDOR pregled (samoposlužni endpoint-i)

Cilj: da li `:id` operacije koje pozivaju GOST/SUBAGENT_CONTACT (ne interni tim) stvarno proveravaju vlasništvo nad TIM zapisom, ne samo da li je pozivalac prijavljen. Pregledano preko svih mesta koja koriste `resolveCallerIdentity` (M5 bookings/quotes, M6 client-accounts/guest-profiles, M7 subagents/commission, M14 tickets, M20 client-contracts).

### Nalaz i ispravka

**`GuestProfilesService.update()` (M6) — gost je mogao da prebaci SOPSTVENI profil na TUĐ nalog.** `create()` je od početka sprečavao gosta da odmah pri kreiranju poveže profil sa tuđim `ClientAccount`-om; `findOne()`/`update()` su proveravali da profil TRENUTNO pripada pozivaocu — ali `update()` nije proveravao da NOVA vrednost `linkedClientAccountId` (izmenjivo polje, `UpdateGuestProfileDto`) i dalje ostaje pozivaočev nalog. Gost je mogao da pozove `PATCH /guest-profiles/<sopstveni-id>` sa telom `{ linkedClientAccountId: "<tuđ-nalog>" }` i time reši svoj profil sa svog naloga na tuđi, bez pristanka tog drugog naloga.

**Ispravljeno** (`apps/api/src/modules/m6-crm/guest-profiles/guest-profiles.service.ts`) — `update()` sad primenjuje istu proveru kao `create()` pre upisa. Dodata 2 jedinična testa (`guest-profiles.service.spec.ts`) — jedan dokazuje da se pokušaj odbija (`ForbiddenException`, upis se ne dešava), drugi da normalna izmena (bez diranja tog polja) i dalje prolazi. M6 spec §7 dopunjen istim nalazom. Svih 787 testova prolazi.

### Provereno i čisto (bez nalaza)

- **M5 `bookings.service.ts` `findOne`/`history`** — proverava `booking.clientAccountId !== ownClientAccountId`, vraća 404 (ne otkriva postojanje tuđe rezervacije, ista filozofija kao M1 reset lozinke). `history()` prolazi kroz `findOne()` pre otkrivanja bilo čega.
- **M5 `quotes.service.ts`** — nema `update()`/reassignment površine uopšte; `clientAccountId` se pri kreiranju prisilno postavlja na pozivaočev nalog za GUEST/SUBAGENT_CONTACT/AI_AGENT, telo zahteva se ignoriše za te tipove poziваoca.
- **M6 `client-accounts.service.ts`** — `update()` nema nijedno polje koje pokazuje na DRUGI zapis (nema analognog `linkedClientAccountId` problema).
- **M7 `subagents.service.ts` `update()`** — namerno BEZ ownership provere, ali ispravno: gated je na `M7/subagent/EDIT`, dozvolu koju `SUBAGENT_ADMIN` uloga nema u seed-u (samo `VIEW`/`MANAGE_OWN_NETWORK`) — znači da je ovo staff-only operacija po dizajnu, ownership provera bi bila suvišna. `updateChildCommission()` (self-service put, `MANAGE_OWN_NETWORK`) ownership proverava (`child.parentSubagentId !== parentId`).
- **M14 `tickets.service.ts`** — `create()` prisilno postavlja `requesterClientAccountId` na pozivaočev nalog kad je ograničen (isti obrazac kao M5 quotes); `update()` je eksplicitno staff-only (komentar u kodu) i ne prima nijedno polje koje bi omogućilo reassignment.
- **M20 `client-contracts.service.ts`** — samo `findOne`, nema `update`/`create` sa ownership površinom; ownership provera preko posebnog upita za `Booking` (ne `include`, da interna polja ne procure gostu).

### Namerno van dometa ovog prolaza (zahteva treću stranu/infrastrukturu, ne kod)

- Nezavisan penetraciono testiranje (spoljna firma/stručnjak).
- DR/backup vežba nad pravom produkcionom infrastrukturom — nema šta da se vežba dok hosting provajder nije izabran (namerna odluka, poglavlje 6 Master dokumenta).
- PCI-DSS sertifikacija — nema obrade kartica u kodu još (M10 spec, platni provajder nije izabran).
- Fizička EU lokacija podataka / DPA ugovori sa provajderima — vezano za isti neizabran hosting.

---

## 30.8.2026 — treći prolaz, CSRF pregled `/api/session/*` ruta (panel + sajt)

Cilj: da li kolačić-zasnovane rute panela (`apps/panel/src/app/api/session/*`) i sajta (`apps/web/src/app/api/session/*`) mogu da se zloupotrebe cross-site — falširan zahtev sa druge stranice koji iskoristi kolačić koji browser sam šalje.

### Provereno i čisto (bez nalaza)

- **Sve rute su POST, nijedna GET** — `login`, `logout`, `mfa` (panel), `login`, `logout`, `register`, `guest-checkout` (sajt). Nema state-changing GET-a koji bi mogao da se okine iz `<img src=...>` ili sličnog na tuđoj stranici.
- **Kolačić je `httpOnly`, `secure` u produkciji, `sameSite: 'lax'`** (`apps/panel/src/lib/session.ts` i `apps/web/src/lib/session.ts`, identično). `SameSite=Lax` sprečava browser da pošalje POSTOJEĆI kolačić na cross-site POST zahtev (šalje se samo na top-level GET navigaciju) — to pokriva najozbiljniju klasu CSRF-a ovde: `logout` sa tuđe stranice ne bi ni stigao do `getSession()` sa validnim kolačićem (server ga vidi kao da kolačić ne postoji), pa nema efekta.
- **Prava autentikacija ka NestJS API-ju ide preko `Authorization: Bearer <token>` header-a** (`apps/panel/src/lib/api-client.ts`, `apps/web` isto), ne preko kolačića koji bi browser sam prilagao. Token se čita iz enkriptovanog httpOnly kolačića isključivo na serveru (Next.js API route/Server Component) i nikad ne stiže u JS koji bi napadačeva stranica mogla pročitati ili iskoristiti — backend API sam po sebi nije osetljiv na CSRF jer se uopšte ne oslanja na kolačić za autorizaciju.
- **`login`/`register`/`guest-checkout` ne zahtevaju postojeću sesiju** — teorijski moguć "login CSRF" (napadač cross-site POST-uje SVOJE kredencijale u žrtvin browser, žrtva se nađe ulogovana kao napadač i može nesvesno uneti osetljive podatke misleći da je na svom nalogu). Ovo je poznat, ali nisko-ozbiljan obrazac (napadač ne dobija ništa što već nije imao — sopstvene kredencijale) i standardna industrijska praksa ga ne tretira posebnim CSRF tokenom na login/register rutama upravo iz tog razloga. Nije nađen dodatni rizik specifičan za ovu implementaciju.

### Zaključak

Nema nalaza koji zahteva izmenu koda. `SameSite=Lax` + `httpOnly` kolačić + `Authorization` header ka pravom API-ju (ne kolačić) je već ispravna kombinacija za ovaj tip aplikacije. Eksplicitni CSRF token bi bio čist dodatni sloj bez stvarne trenutne izloženosti — nije dodat, u skladu sa principom "ne dodavati zaštitu za scenario koji ne postoji" (CLAUDE.md).

---

## Otvoreno za dalje

- Odluka: koje preostale `npm audit fix --force` nadogradnje raditi i kada (posebno Next.js major skok — najveći rizik od nečeg što se pokvari, ali i najozbiljniji preostali nalaz — XSS/path traversal u postcss lancu).
- Kad se izabere hosting: ograničiti `ChatGatewayService` CORS na stvarne domene, zaključati/ugasiti Swagger u produkciji.
- ~~IDOR pregled (30.8.2026) je pokrio samo module koji koriste `resolveCallerIdentity`~~ — delimično rešeno 31.8.2026: opšta `VIEW_ALL` konvencija (M1 spec §3.9a) sad postoji i primenjena je u M5 (`booking/VIEW_ALL`, poglavlje 6.6) — "podrazumevano svi vide sve, sužavanje pojedinačna opcija", umesto ranije neusklađene/nikad sprovedene "prodajni agent vidi samo svoje". **I dalje otvoreno:** M6/M10/M14/M20 permission tabele referenciraju istu konvenciju (dokumentaciono usklađeno), ali `VIEW_ALL` dozvola i servisno filtriranje nisu tamo stvarno implementirani — samo M5 booking ima pravi kod. Vredi proveriti ove module kad dođu na red, isti obrazac kao M5.
- ~~CSRF razmatranje za panel/web~~ — pregledano 30.8.2026, čisto (vidi sekciju iznad).
