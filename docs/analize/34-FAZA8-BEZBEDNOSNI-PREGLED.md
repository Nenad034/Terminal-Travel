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

### Namerno van dometa ovog prolaza (zahteva treću stranu/infrastrukturu, ne kod)

- Nezavisan penetraciono testiranje (spoljna firma/stručnjak).
- DR/backup vežba nad pravom produkcionom infrastrukturom — nema šta da se vežba dok hosting provajder nije izabran (namerna odluka, poglavlje 6 Master dokumenta).
- PCI-DSS sertifikacija — nema obrade kartica u kodu još (M10 spec, platni provajder nije izabran).
- Fizička EU lokacija podataka / DPA ugovori sa provajderima — vezano za isti neizabran hosting.

---

## Otvoreno za dalje

- Odluka: koje preostale `npm audit fix --force` nadogradnje raditi i kada (posebno Next.js major skok — najveći rizik od nečeg što se pokvari, ali i najozbiljniji preostali nalaz — XSS/path traversal u postcss lancu).
- Kad se izabere hosting: ograničiti `ChatGatewayService` CORS na stvarne domene, zaključati/ugasiti Swagger u produkciji.
- Sledeći prolaz kroz Fazu 8 (kad bude vreme): OWASP-stil pregled preostalih modula pojedinačno (ovaj prolaz je pokrio zajedničke/infrastrukturne tačke, ne svaki od 23 modula linija po liniju) — IDOR provere (da li `GET /:id` endpoint-i proveravaju vlasništvo, ne samo prijavu), i CSRF razmatranje za panel/web (trenutno JWT u `Authorization` header-u preko servera, ne kolačić — niska izloženost, ali vredi eksplicitno potvrditi).
