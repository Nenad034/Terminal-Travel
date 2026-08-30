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

### Nalazi — čeka odluku vlasnika pre nego što se dirne

1. **Nema `helmet` (sigurnosna HTTP zaglavlja)** — `main.ts` ne postavlja `X-Content-Type-Options`/`X-Frame-Options`/HSTS i slično. `helmet` je NOVA zavisnost (CLAUDE.md tehnički stek, poglavlje 6) — standardna, uskogrudno-svrhovita (samo zaglavlja, ne menja ponašanje aplikacije), preporuka je da se doda, ali čeka potvrdu vlasnika pre uvođenja, po pravilu.
2. **17–29 poznatih ranjivosti u zavisnostima** (`npm audit`, sve tri aplikacije) — najozbiljnije: `multer` (5 DoS prijava, koristi se za upload priloga), `picomatch`/`postcss` (visoka ozbiljnost, ReDoS/XSS/path traversal). **`npm audit fix` (bez `--force`) ne rešava ništa u ovom monorepo-u** — svaki stvaran fix zahteva `--force` i veliku (major) verziju paketa koji već koristimo (`@nestjs/platform-express`→12, `@nestjs/cli`→12, `exceljs`→3.4.0 unazad, `next`→16, `next-intl`→4) — sve su to izmene postojeće zavisnosti, ne nova tehnologija, ali nose realan rizik od pokvarenog ponašanja (posebno Next.js major skok) i zahtevaju pravo testiranje posle, ne slepo pokretanje. Čeka odluku vlasnika koji paket/kada.
3. **`ChatGatewayService` (M19) `cors: { origin: '*' }`** — nije danas iskoristivo (obrazloženo iznad), ali širi je nego što treba po principu najmanjeg ovlašćenja. Kada se izaberu stvarni domeni panela/sajta/mobilne aplikacije, ograničiti na tačnu listu — sitna izmena, ali čeka da ti domeni uopšte postoje (hosting provajder namerno neizabran).
4. **Swagger (`/api/docs`) nema svoj guard** — u razvoju je to očekivano i korisno; pre bilo kakvog javnog izlaganja API-ja, ili se gasi u produkciji ili se stavlja iza autentikacije — čeka odluku o hostingu/produkciji, ne pre.

### Namerno van dometa ovog prolaza (zahteva treću stranu/infrastrukturu, ne kod)

- Nezavisan penetraciono testiranje (spoljna firma/stručnjak).
- DR/backup vežba nad pravom produkcionom infrastrukturom — nema šta da se vežba dok hosting provajder nije izabran (namerna odluka, poglavlje 6 Master dokumenta).
- PCI-DSS sertifikacija — nema obrade kartica u kodu još (M10 spec, platni provajder nije izabran).
- Fizička EU lokacija podataka / DPA ugovori sa provajderima — vezano za isti neizabran hosting.

---

## Otvoreno za dalje

- Odluka: dodati `helmet` (preporučeno, mala/bezbedna zavisnost) — čeka potvrdu.
- Odluka: koje `npm audit fix --force` nadogradnje raditi sada vs. čekati (posebno Next.js major skok — najveći rizik od nečeg što se pokvari, ali i najozbiljniji nalaz — XSS/path traversal u postcss lancu).
- Kad se izabere hosting: ograničiti `ChatGatewayService` CORS na stvarne domene, zaključati/ugasiti Swagger u produkciji.
- Sledeći prolaz kroz Fazu 8 (kad bude vreme): OWASP-stil pregled preostalih modula pojedinačno (ovaj prolaz je pokrio zajedničke/infrastrukturne tačke, ne svaki od 23 modula linija po liniju) — IDOR provere (da li `GET /:id` endpoint-i proveravaju vlasništvo, ne samo prijavu), i CSRF razmatranje za panel/web (trenutno JWT u `Authorization` header-u preko servera, ne kolačić — niska izloženost, ali vredi eksplicitno potvrditi).
