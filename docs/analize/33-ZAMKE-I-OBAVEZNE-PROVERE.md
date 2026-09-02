# Zamke i obavezne provere — lista koja se čita pre i posle rada na kodu

**Status:** Živ dokument. Svaka nova zamka se dodaje **u istom prolazu** u kom je otkrivena.
**Nastalo:** 17.8.2026, na izričit zahtev vlasnika — "sve napomene koje ste napisali pribeležite i proveravajte prilikom dodatnog rada na aplikaciji".
**Odnosi se na:** svaki modul. Pokazivač na ovaj fajl stoji u `CLAUDE.md`, pa ga svaka sesija vidi.

---

## Šta je ovo i kako se koristi

Ovo **nije** lista bagova (bagovi se ispravljaju i zatvaraju) ni backlog (`27-BACKLOG-IDEJA-I-PREDLOZI.md` je indeks otvorenih pitanja). Ovo je lista **grešaka u koje se lako ponovo upada** — svaka je stvarno napravljena ili pronađena, ne pretpostavljena.

Svaki unos ima isti oblik: **simptom** (šta vidiš), **uzrok** (zašto), **provera** (šta uraditi da se ne ponovi).

**Kada se čita:**
- pre rada na oblasti koju neki odeljak pokriva (npr. pre dodavanja boje — odeljak 1),
- pre nego što se zadatak proglasi gotovim — proći kroz odeljak koji odgovara dotaknutim modulima.

Zamka se **ne briše** kad se jednom ispravi, jer se u nju može ponovo upasti na drugom mestu. Briše se samo ako je uzrok strukturno uklonjen (npr. polje više ne postoji).

---

## 1. Boje, kontrast i vizuelni identitet

**1.1 `text-accent` na `bg-accent-soft` pada WCAG AA**
- *Simptom:* oznaka/bedž se "gubi" na svojoj podlozi u svetlom modu.
- *Uzrok:* akcentna boja na svojoj mekoj varijanti daje 3.96:1 (panel) i 2.74:1 (sajt); prag je 4.5:1.
- *Provera:* za tekst na `accent-soft` **uvek** `accent-strong`, nikad `accent`. Važi i za `hover:bg-accent-soft` — tekst tada menja podlogu. Pravilo: `29-DIZAJN-SISTEM-UI.md` §2a.

**1.2 Kontrast se meri protiv stvarne podloge, ne jedne pretpostavljene**
- *Simptom:* boja prolazi "na oko" i na glavnoj pozadini, a pada na kartici ili u hover stanju.
- *Uzrok:* aplikacija ima više nijansi pozadine u istom modu (bg, panel, panel-2, accent-soft, warn-bg).
- *Provera:* svaka nova kombinacija se meri protiv **svake** podloge uz koju se pojavljuje, u **oba** moda. Formula i primer skripte: `29-DIZAJN-SISTEM-UI.md` §2a i §8.

**1.3 Postoje DVE palete, a dokument je dugo beležio samo jednu**
- *Simptom:* paleta sajta je imala sedam parova ispod AA praga, uključujući tekst na dugmetu "Rezerviši" (3.30:1), i to nikad nije uhvaćeno.
- *Uzrok:* panel ("Horizont") i sajt ("Zalazak") imaju odvojene palete; dizajn dokument je opisivao samo panelovu, pa provera za sajt nikad nije ni pokrenuta.
- *Provera:* svaka nova paleta ili kanal (M7 portal, M9 mobilna) **upisuje se u `29-DIZAJN-SISTEM-UI.md` §8 u istom prolazu** kad nastane, sa izmerenim vrednostima.

**1.4 Bedž na podlozi iste boje postaje nevidljiv**
- *Simptom:* AI bedž se stapao sa sopstvenom porukom u chatu (i bedž i balon koriste `accent-soft`).
- *Uzrok:* dovoljan kontrast teksta ne znači da se sam bedž razlikuje od okoline.
- *Provera:* bedž koji može stajati nad podlogom svoje boje mora imati ivicu.

**1.5 CSS override tuđe biblioteke tiho ne radi zbog specifičnosti selektora, ne redosleda u fajlu**
- *Simptom:* izmena veličine/stila ikonica (npr. `.codicon { font-size: ... }` u `globals.css`, posle `@import` codicon paketa) je "primenjena" u kodu i prošla `tsc`, ali se u browseru ništa nije promenilo osim razmaka oko ikonica — otkriveno tek kad je vlasnik uživo prijavio da se "uvećao prazan prostor, ne ikonice" (21.8.2026). Ispostavilo se da ni raniji, sličan pokušaj (19.8.2026) nikad nije stvarno radio — nije primećeno jer je promena bila manja.
- *Uzrok:* CSS pobednik pravila se određuje po **specifičnosti selektora**, ne po tome koje pravilo je poslednje u fajlu. `@vscode/codicons/dist/codicon.css` postavlja font-size na `.codicon[class*='codicon-']` (specifičnost 0,2,0) — specifičnije od prostog `.codicon` (0,1,0), pa vendor pravilo pobeđuje bez obzira na redosled/`@import` poziciju.
- *Provera:* override nad tuđom bibliotekom (ne sopstvenim komponentama) se ne smatra potvrđenim dok se stvarno **iskompajlirano** CSS pravilo ne pročita direktno iz isporučenog bundle-a (`/_next/static/css/...`) i potvrdi da pobeđuje — ne samo da je izvorni fajl izmenjen i da `tsc`/build prolazi. Ako selektor vendor biblioteke ima veću specifičnost, ili se koristi `!important`/istom-ili-većom specifičnošću, ili se selektor cilja tačnije.

**1.6 Nova boja/token u `tailwind.config.ts` zahteva restart dev servera, ne samo hot-reload**
- *Simptom:* nova utility klasa (npr. `bg-bar`, novo ime dodato u `theme.colors`) je prisutna u HTML className stringu (potvrđeno grep-om nad renderovanom stranicom), ali element vizuelno pada nazad na pozadinu roditelja kao da klasa ne postoji — u ovom slučaju izgledalo je kao da su trake dobile POGREŠNU (najsvetliju umesto najtamnije) boju, iako je sam CSS token bio numerički ispravno poređan (23.8.2026, uživo — "ja vidim da je boja traka sada najsvetlija").
- *Uzrok:* dev server (pokrenut ranije u sesiji) je i dalje radio sa STARIM, keširanim Tailwind build-om od pre izmene `tailwind.config.ts` — Next.js dev server ne detektuje pouzdano nove `theme.colors` unose bez restarta (za razliku od izmena u `globals.css`, koje se HMR pouzdano hvata). Element bez ijedne stvarno primenjene `bg-*` klase pada na pozadinu roditelja — ako je ta pozadina slučajno SVETLIJA nijansa, greška izgleda kao "obrnuta boja", ne kao "nema boje", što odvodi dijagnozu u pogrešnom pravcu.
- *Provera:* posle SVAKE izmene `tailwind.config.ts` (nova boja/token/font/spacing vrednost), grep-uj `.next/static/css/app/*.css` da klasa STVARNO postoji sa očekivanim pravilom (isti obrazac kao zamka 1.5 — "u HTML-u" nije dovoljno). Ako ne postoji, restartuj dev server (ugasi proces, pokreni ponovo) pre nego što se traži dalje objašnjenje u samom kodu/vrednostima.

**1.7 Svetli mod se u `globals.css` definiše na DVA mesta — izmena jednog radi samo pola vremena**
- *Simptom:* promena boje svetlog moda "radi" dok se testira, a nestane čim korisnik izabere svetlu temu ručnim prekidačem (ili obrnuto: radi na dugme, a ne prati OS). Ništa ne puca, build prolazi, boja je vidljivo tačna u polovini slučajeva — što je najgori oblik greške jer deluje kao da je posao gotov.
- *Uzrok:* `apps/panel/src/app/globals.css` ima **tri** bloka tokena, ne dva: `:root` (svetli mod, prati OS), `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` (tamni po OS-u) i `:root[data-theme='dark']` / `:root[data-theme='light']` (ručni prekidač, `ThemeToggle.tsx`). Svetle vrednosti su **duplirane** u `:root` i u `:root[data-theme='light']`; `data-theme` blok uvek pobeđuje `prefers-color-scheme`, pa prepisivanje samo prvog bloka daje tiho nedosledno ponašanje. Uhvaćeno 2.9.2026 pri ciljanom potamnjenju `--text-dim`/`--text-faint`.
- *Provera:* posle svake izmene vrednosti tokena, `grep -n "<stara vrednost>" apps/panel/src/app/globals.css` mora vratiti **nula** pogodaka u blokovima tokena (pogoci u komentarima koji beleže istoriju su u redu i poželjni). Isto važi za tamni mod i njegova dva bloka. Ne oslanjati se na vizuelnu proveru u jednom modu — prebaci prekidač.

**1.8 "Sve za X% tamnije/svetlije" po celoj paleti ruši hijerarhiju teksta**
- *Simptom:* ekran posle ravnomernog tamnjenja izgleda kao "zid crnog teksta" — sve je čitljivo, ali se ništa ne izdvaja; naslov, telo i sitna napomena deluju kao isti nivo.
- *Uzrok:* nivoi teksta (`--text` / `--text-dim` / `--text-faint`) nisu proizvoljne nijanse nego **razmaci** — hijerarhija je razlika među njima, ne njihova apsolutna tamnina. Najtamniji token je već blizu plafona (npr. `#18181b` = 16.97:1), pa mu množenje ne donosi vidljivu promenu, dok najsvetliji dobija mnogo — razmaci se skupljaju sa jednog kraja.
- *Provera:* zahtev oblika "sve za X% tamnije" prevodi se u izmerenu tabelu po tokenu (stara vrednost → nova → kontrast na svakoj podlozi uz koju se pojavljuje) **pre** primene, i vlasniku se pokazuje uporedni prikaz. Ako najtamniji token dobija manje od ~2:1, on se izuzima i promena ide samo na slabije nivoe. Ikonice se tretiraju kao zasebna, estetska odluka (mogu nositi sopstven brend ton, npr. `--icon-line` navy) — ne uvlače se u opštu izmenu teksta bez izričite potvrde.

**1.9 Zamena cele palete tiho poništava ranije ručne ispravke tokena**
- *Simptom:* problem koji je vlasnik lično prijavio i koji je ispravljen pre više nedelja **vrati se sam od sebe**, bez ijedne izmene koja ga pominje. Konkretno (otkriveno 2.9.2026, pri usklađivanju dizajn-dokumenta sa kodom): `--border` je 21.8.2026. potamnjen sa `#f0f1f2` (1.13:1) na `#858c92` (3.41:1) baš zato što je vlasnik prijavio "jedva se vide okvirne linije sadržaja"; prelaz na shadcn paletu 29.8.2026. vratio ga je na doslovnu Tailwind vrednost `#e4e4e7` — **1.27:1**, ispod praga, isti problem ponovo. Isto se desilo sa `--bar` (§2.0e — traka je opet iste boje kao bočni panel, iako je vlasnik tražio da bude tamnija).
- *Uzrok:* "usvoji ceo vizuelni jezik biblioteke" znači prepisivanje SVIH tokena doslovnim vrednostima te biblioteke. Ručne ispravke koje su ranije napravljene nad pojedinačnim tokenima nisu nigde označene u samom CSS-u kao "namerno odstupanje od izvora" — nova paleta ne zna da postoje, pa ih pregazi. Nijedan test ne pada: build prolazi, boje su "zvanične", ekran izgleda uredno na prvi pogled.
- *Provera:* posle svake zamene cele palete (ne pojedinačnog tokena) **obavezno**: (a) pokreni `node tools/check-contrast.js` — izlazi kôdom 1 ako bilo koji par padne prag; (b) pročitaj sva ranija poglavlja o ispravkama tokena (`29-DIZAJN-SISTEM-UI.md` §2.0a–§2.0e) i za svako proveri da li nova paleta poštuje razlog zbog kog je nastalo. Ispravka koja je nastala na vlasnikovu prijavu ne sme se izgubiti ćutke — ako nova paleta traži da se od nje odustane, to je pitanje za vlasnika, ne posledica koju agent sme sam da usvoji. Uz svako namerno odstupanje od doslovne vrednosti biblioteke ide komentar u `globals.css` koji kaže zašto — inače sledeća zamena palete ponavlja isti krug.
- *Ishod (2.9.2026):* granice vraćene iznad praga u sva tri moda, po vlasnikovom izboru između četiri ponuđene jačine. Tri tokena u paleti sada nose takav komentar (`--border`, `--text-faint` u svetlom i u dim modu) — sva tri su ručno pomerena sa doslovne Tailwind vrednosti jer je doslovna padala.

**1.10 Kontrast se meri protiv `--panel-2`, ne samo `--panel` i `--bg`**
- *Simptom:* par "prolazi" proveru, a u aplikaciji se i dalje slabo vidi — konkretno na bočnom panelu (levi/desni), ne u centralnom sadržaju. Prijavljena vrednost kontrasta bude viša od stvarne najgore.
- *Uzrok:* panel ima **tri** površine na kojima stoje i tekst i granice: `--panel` (centralni sadržaj), `--bg` (osnovna pozadina) i `--panel-2` (bočni paneli, zaglavlje tabele, trake). `--panel-2` je u svetlom modu tamniji od bele, pa je kontrast tamnog elementa na njemu **najniži** — a upravo se on najlakše zaboravi, jer čovek pri proveri gleda glavni deo ekrana. Uhvaćeno 2.9.2026: prijavljena regresija granice glasila je 1.27:1 (na `--panel`), a stvarna najgora vrednost bila je **1.15:1** (na `--panel-2`). Isti oblik greške kao zamka 1.2, samo za površinu koja se najčešće previdi.
- *Provera:* merodavan je **minimum od sve tri**, ne vrednost na belu/glavnu podlogu. `tools/check-contrast.js` to radi automatski za tekstualne tokene i granice; kad se boja proverava ručno (nova semantička boja, boja u pojedinačnoj komponenti), izlistaj podloge na kojima se stvarno pojavljuje pre merenja, ne posle.

---

## 2. Prava pristupa i identitet (M1, M5, M6)

**2.1 Vlasništvo naloga ide preko `User.linkedProfileId`**
- *Simptom:* gost se uspešno prijavi, ali "Moje rezervacije" i "Profil" ostaju prazni.
- *Uzrok:* `resolveCallerIdentity` čita `User.linkedProfileId` (→ `ClientAccount.id` za GOST, `Subagent.id` za SUBAGENT_CONTACT). `ClientAccount.linkedUserId` je **suprotan smer** i ne koristi se za autorizaciju.
- *Provera:* kad se nalog pravi mimo `AuthService.register` (seed, migracija, test), popuni **oba** polja.

**2.2 Uloga se ne dodeljuje sama**
- *Simptom:* 403 "Nema dozvolu M5/booking/VIEW" za nalog koji izgleda ispravno.
- *Uzrok:* `AuthService.register` je jedini put koji dodeljuje `GOST` ulogu; direktan upis u bazu je preskače.
- *Provera:* svaki ručno kreiran nalog dobija odgovarajuću `UserRole` u istom koraku.

**2.3 STAFF nalog ne može da se prijavi pre podešene 2FA**
- *Simptom:* 403 "Podešavanje dvofaktorske autentikacije je obavezno pre prijave" na tek kreiranom STAFF nalogu.
- *Uzrok:* M1 zahteva 2FA za interne uloge pre prve prijave.
- *Provera:* u skriptama redosled je: registruj kao GUEST → MFA enroll → **tek onda** unapredi na STAFF + ulogu.

**2.4 Audit log se ne može obrisati**
- *Simptom:* `prisma.auditLogEntry.deleteMany` pada sa `P0001 — audit_log_entries je append-only`.
- *Uzrok:* DB trigger sprovodi M1 §3.8; to je ispravno ponašanje, ne greška.
- *Provera:* test podaci koji proizvode audit zapise ostaju u dnevniku — ne planiraj čišćenje, nego to napomeni u izveštaju.

**2.5 `apps/panel/src/lib/api-client.ts` `apiFetch` je pretpostavljao da svaki uspešan odgovor ima JSON telo OSIM tačno statusa 204**
- *Simptom:* stvaran API poziv uspe (npr. `POST /iam/users/:id/roles` vraća 201), ali panel forma prikazuje generičku "nije uspelo" grešku — otkriveno 29.8.2026 pri M1 "korisnici" ekranu (dodela uloge).
- *Uzrok:* `POST /iam/users/:id/roles` vraća 201 sa **praznim** telom (`Content-Length: 0`), ne 204. `apiFetch` je pozivao `res.json()` bezuslovno za svaki status ≠ 204 — na praznom telu to baca `SyntaxError`, ne `ApiError`; pozivalac hvata samo `err instanceof ApiError` pa upada u generičku fallback poruku, iako je API poziv stvarno uspeo.
- *Provera/rešenje:* `apiFetch` sad čita telo preko `res.text()` i proverava dužinu PRE parsiranja (`raw === '' ? undefined : JSON.parse(raw)`) — pokriva i 204 i "200/201 sa praznim telom" bez oslanjanja na status kod koji API ne garantuje dosledno kroz module. Ako se ponovo pojavi "poziv uspeva ali panel prijavljuje grešku", prva sumnja treba da bude ovaj obrazac (prazno telo na uspešnom statusu koji nije 204), ne sama poslovna logika forme.

---

## 3. Katalog, pretraga i javni sajt (M2, M5, M8, M12)

**3.1 Proizvod bez `visible_channels` je nevidljiv, iako je ACTIVE**
- *Simptom:* prazan sajt na svakoj stranici; javni endpoint vraća `[]` uprkos desetinama aktivnih proizvoda.
- *Uzrok:* `findAllPublic` filtrira `visibleChannels: { has: channel }`. Prazan niz = nigde vidljiv.
- *Provera:* kad se testira B2C/B2B/mobilni prikaz, proveri **prvo** ovo polje, pre traženja greške u kodu prikaza. (Isti obrazac je već ranije uhvaćen za `INTERNAL_PANEL` — M5 spec, promena verzije.)

**3.2 M12 stranica bez `M8_SITE` kanala vraća 404**
- *Simptom:* stranica je `PUBLISHED`, a `/stranica/[slug]` i `/blog/[slug]` daju 404.
- *Uzrok:* `ContentService.findPublishedBySlug` traži i `targetChannels.includes('M8_SITE')`, ne samo status.
- *Provera:* svaki `STATIC_PAGE`/`BLOG_POST` namenjen sajtu mora nositi `M8_SITE`.

**3.3 M5 pretraga vraća RAVAN oblik, M2 katalog ugnježden**
- *Simptom:* pretraga prikazuje sirov UUID umesto naziva hotela.
- *Uzrok:* `SearchService` vraća `name`/`shortDescription` već razrešene na jezik, **bez** `translation` objekta i **bez** `slug`. M2 javni katalog vraća `translation: { name, slug }`. Dva različita oblika za sličan podatak.
- *Provera:* pre čitanja polja iz odgovora, potvrdi oblik protiv servisa koji ga vraća (`curl` na endpoint), ne protiv tipa u frontend kodu — tip može biti pogrešan.

**3.4 Pretraga za CONTRACTED proizvod bez ugovornog lanca ne vraća ništa**
- *Simptom:* proizvod postoji, vidljiv je, a pretraga ga ne prikazuje.
- *Uzrok:* cena se čita iz M3 lanca `Contract → ContractPeriod → RateLine`; bez perioda koji pokriva tražene datume nema ponude, a bez ponude se proizvod namerno ne vraća (M5 §3.0b.2).
- *Provera:* za svaki test proizvod napravi i ugovorni lanac i `MarkupRule` u lancu (inače pada kreiranje ponude).

**3.5 Puna širina važi za liste, ne za stranice koje se čitaju**
- *Provera:* nova stranica sajta — ako se **čita** (opis, blog, pravni tekst, forma), ograniči širinu na samoj stranici; ako se **pregleda** (lista, pretraga), pusti punu širinu i dodaj kolone na širokim ekranima. Pravilo: `29-DIZAJN-SISTEM-UI.md` §6b.

---

## 4. Obeležavanje AI poteza (cross-modularno)

**4.1 Poreklo AI teksta se mora upisati u trenutku slanja**
- *Uzrok:* AI nacrt često nije samostalan zapis (M19 `SupplierDraftService` vraća samo tekst) — ako se poreklo ne upiše kad čovek pošalje, izgubljeno je zauvek.
- *Provera:* svaki nov tok "AI predloži → čovek pošalje" dobija polje porekla i popunjava ga pri slanju.

**4.2 Autor se prikazuje kroz jednu zajedničku komponentu**
- *Simptom:* pre 17.8.2026. osam ekrana panela imalo je tri različita načina obeležavanja AI poteza, a audit log je ispisivao sirov `AI_AGENT`.
- *Provera:* nov ekran koji prikazuje autora uvozi `apps/panel/src/components/ActorLabel.tsx` — ne piše sopstveni bedž. Pravilo: `29-DIZAJN-SISTEM-UI.md` §6a, obaveza: M17 §3.1.

**4.3 Sirova enum vrednost nikad ne ide u interfejs**
- *Provera:* `AI_AGENT`, `SUPPLIER_CONTACT`, `AI_DRAFT` i slično se prevode na srpski pre prikaza.

---

## 5. Podaci i skripte za lokalni razvoj

**5.1 Polje u kodu ne mora postojati u šemi**
- *Simptom:* `/audit-log` je prikazivao "Invalid Date" u svakom redu.
- *Uzrok:* ekran je čitao `createdAt`, a `AuditLogEntry` ima `timestamp`. TypeScript to ne uhvati kad je tip pisan ručno u frontendu.
- *Provera:* naziv polja potvrdi protiv `schema.prisma`, ne protiv interfejsa u frontend kodu.

**5.2 Uvoz seed modula ga i izvršava**
- *Simptom:* skripta za *brisanje* mock podataka ih je ponovo ubacivala.
- *Uzrok:* `mock-b2c-clean.ts` uvozi konstantu iz `mock-b2c.ts`, čiji je `main()` pozvan na najvišem nivou.
- *Provera:* svaka skripta koja se može uvoziti ograđuje pokretanje sa `if (require.main === module)`.

**5.3 Nedostatak `@unique` znači duplikate pri ponovnom pokretanju**
- *Simptom:* drugo pokretanje seed-a pada na `(language_code, slug)`.
- *Uzrok:* `Supplier.taxId` nije unique, pa je svako pokretanje pravilo novog mock dobavljača, a čišćenje je uklanjalo samo prvog (`findFirst`).
- *Provera:* skripte za čišćenje koriste `findMany`, i imaju sigurnosnu mrežu po drugom obeležju (npr. slug).

**5.4 `package.json` ima dva mesta sa ključem `seed`**
- *Simptom:* `npm error Missing script` iako je skripta vidljiva u fajlu.
- *Uzrok:* pored `scripts` postoji i blok `prisma: { seed: ... }` (za `prisma db seed`); tekstualna zamena je pogodila pogrešan.
- *Provera:* `package.json` se menja preko parsiranog JSON-a i po ključu, ne tekstualnom zamenom.

**5.5 Prisma `generate` pada dok drugi dev server radi**
- *Simptom:* `EPERM: operation not permitted, rename query_engine-windows.dll.node`.
- *Uzrok:* pokrenut API/watch proces drži native engine.
- *Provera:* **ne gasi tuđe procese.** Proveri da li su TypeScript tipovi ipak regenerisani (`grep` novog polja u `node_modules/.prisma/client/index.d.ts`) — ako jesu, rad može da se nastavi; engine je isti fajl.

**5.6 Privremena skripta unutar `apps/api` ruši nodemon usred provere**
- *Simptom:* `POST /api/session/login` vraća 500 sa `ECONNREFUSED`/`fetch failed` baš u trenutku dok se test skripta pokreće ili briše, iako je API server bio zdrav trenutak ranije.
- *Uzrok:* `nest start --watch` (nema eksplicitan `include`/`exclude` u `tsconfig.json`, pa prati sve `.ts` fajlove u `apps/api`, ne samo `src/`) vidi svaku novu/obrisanu privremenu skriptu u korenu `apps/api` kao izmenu i pokreće rebuild — API je nekoliko sekundi nedostupan baš dok skripta pokušava da mu se obrati.
- *Provera:* privremene skripte za proveru (login/MFA tok, provera podataka i sl.) piši **van** `apps/api` (npr. scratchpad direktorijum), sa apsolutnim `require()` putanjama i ručno pročitanim `.env` umesto uvoza iz `src/` — ako baš mora unutra, sačekaj par sekundi posle kreiranja/brisanja fajla pre poziva.
- *Povezano:* ne meša se sa 8.3 (izgubljen pozadinski zadatak) — ovde je API i dalje živ, samo je privremeno u rebuild-u.

**5.7 `npm run build` (produkcioni) preko iste `.next` fascikle dok `next dev` radi je kvari**
- *Simptom:* posle build-a, dev server i dalje vraća HTTP 200 na stranice, ali API rute (`route.ts`) unutar `app/api/**` pucaju sa `Cannot find module './XXXX.js'` — ID modula iz produkcionog build-a se sudaraju sa dev webpack keš-om.
- *Uzrok:* oba procesa pišu u `apps/panel/.next`; pokretanje `npm run build` dok `next dev` radi nije bezbedno, čak i kad se ne prekida dev proces.
- *Provera:* nikad ne pokretati `npm run build` kao "brzu proveru tipova" dok dev server radi na istom `apps/panel`. Ako se to desi, ugasiti dev proces, obrisati `.next`, ponovo pokrenuti `npm run dev` — postojeća sesija/kolačić i dalje važe posle restarta (ključ za enkripciju kolačića dolazi iz `.env`, ne menja se restartom).

**5.8 `useState(() => ...)` koji čita `localStorage`/`window` direktno u inicijalizatoru puca hidrataciju**
- *Simptom:* "Hydration failed because the initial UI does not match what was rendered on the server" u browser-u, `tsc --noEmit` i server-render (curl) ostaju čisti — ne hvata se ni tipovima ni HTTP proverom, samo stvarnim browser-om.
- *Uzrok:* obrazac `useState(() => { if (typeof window === 'undefined') return X; return localStorage.getItem(...); })` vraća `X` na SERVERU (nema `window`), ali na KLIJENTOVOM PRVOM renderu (koji React mora da poredi sa server HTML-om) `window` već postoji, pa se odmah čita sačuvana vrednost — ako se ona razlikuje od `X` (npr. korisnik je ranije sačuvao suprotno stanje), prvi klijentski render se ne slaže sa server HTML-om.
- *Provera:* stanje koje zavisi od `localStorage`/`window` UVEK počinje od iste, fiksne podrazumevane vrednosti u `useState` (bez grananja po `typeof window`), a stvarna sačuvana vrednost se čita tek u `useEffect` (izvršava se samo na klijentu, POSLE hidratacije) — isti obrazac kao `ResizablePane.tsx`. Pre nego što se novo lično/lokalno stanje doda (tema, širina panela, skupljena traka, filteri koji se pamte), proveriti da prati ovaj obrazac, ne prečicu sa `typeof window` u inicijalizatoru.

**5.9 Zastareo `node dist/src/main` proces se ponovo pojavljuje i drži port 3000**
- *Simptom:* API izmene (nova ruta, ispravka u servisu) ne rade uživo iako je `nest start --watch` prijavio uspešnu rekompilaciju — jer nešto DRUGO, produkcioni `node dist/src/main` proces (star, kompajliran pre izmene), zapravo drži port 3000 i opslužuje zahteve. Dešavalo se tri puta u istoj sesiji (21.8.2026), svaki put sa novim PID-om.
- *Uzrok:* nerazjašnjen — nije pronađen `.vscode` task, `nodemon.json` ni npm skripta koja bi ovo automatski pokretala. Mogući uzrok: paralelni proces/agent u istoj radnoj kopiji koji povremeno pokreće `npm run build && node dist/src/main` nezavisno od dev sesije (vidi poglavlje 6 ovog dokumenta).
- *Provera:* pre nego što se izmena u `apps/api` proglasi uživo potvrđenom, proveriti STVARNOG vlasnika porta: `Get-NetTCPConnection -LocalPort 3000 -State Listen | Select OwningProcess`, pa `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` — ako komandna linija sadrži `dist/src/main` ili `dist/main` umesto `nest.js start --watch`, to je zastareo build. Ugasiti ga (`Stop-Process -Id <pid> -Force`), proveriti da nema duplih `npm run start:dev`/`nest start --watch` procesa (`Get-CimInstance Win32_Process | Where CommandLine -match 'nest|start:dev'`), pa pokrenuti tačno jednu čistu `npm run start:dev` instancu. Ne pretpostavljati da je server "isti" samo zato što HTTP 200 vraća — stari proces to isto radi.

---

**5.6 Nov nalog zaposlenog ne može da se prijavi — 2FA je obavezna, a ekrana za podešavanje nema**
- *Simptom:* svaki pokušaj prijave novonapravljenog `STAFF` naloga vraća `403 — "Podešavanje dvofaktorske autentikacije je obavezno pre prijave"`. Nalog je `ACTIVE`, lozinka tačna, uloga dodeljena.
- *Uzrok:* `AuthService.login` odbija internu ulogu dok `mfaEnabled` nije `true` (M1 spec §5), a jedini put da se 2FA uključi (`POST /iam/auth/mfa/enroll`) stoji iza `JwtAuthGuard` — token koji taj guard traži izdaje se tek posle uspešne prijave. Komentar u samom kodu to i priznaje: *"ta stranica/endpoint je van obima ovog fajla"*. Nema ni ekrana u panelu ni neautentifikovanog puta za prvo podešavanje. **Ovo nije samo test-nezgodnost — nijedan nov zaposleni ne može da se prijavi ni na produkciji.**
- *Provera:* kad modul uvodi obavezan korak pre prijave, u istom prolazu mora postojati i put kojim se taj korak prvi put obavlja (standing pravilo "logika postoji, UI ne" iz CLAUDE.md). Za lokalni rad zaobilazak je upisati `mfaSecretEncrypted`/`mfaEnabled` direktno, istim `encryptSecret`/`otplib` pozivima koje koristi `enrollMfa` — prijava potom ide kroz **pravu** proveru koda, bez slabljenja bezbednosti.

**5.7 Seed ne pravi nijedan nalog zaposlenog**
- *Simptom:* posle `prisma db seed` niko ne može da se prijavi u panel; uloge i dozvole postoje, korisnika nema.
- *Uzrok:* `seed.ts` pravi uloge, dozvole i sistemske AI naloge (`*@sistem.terminal-travel.local`, bez lozinke), ali nijedan ljudski `STAFF` nalog.
- *Provera:* pre bilo kakve tvrdnje da je ekran u panelu "proveren uživo", potvrdi da postoji nalog kojim se uopšte može prijaviti — inače provera nije ni mogla da se desi. Vidi i 5.6.

## 6. Rad paralelno sa drugim agentom

**6.1 Nikad `git add -A` kad drugi agent radi**
- *Uzrok:* radno stablo sadrži i njegove nedovršene izmene; `add -A` ih uvlači u tvoj commit.
- *Provera:* staguj **eksplicitno navedene** putanje; pre commit-a `git diff --cached --name-only` i potvrdi da je svaka tvoja.

**6.2 Fajl koji ste obojica mogli dotaknuti proveri po diff-u, ne po pretpostavci**
- *Provera:* `git diff --unified=0 <fajl>` i pogledaj da su sve `+`/`-` linije tvoje.

**6.3 `git pull --rebase` pada kad drugi ima nesnimljene izmene**
- *Provera:* ne stashuj tuđe izmene. Ako se remote nije pomerio, dovoljan je `git push`; ako se pomerio, čekaj da on commit-uje.

**6.4 Remote se pomerio a lokalno ima nedovršen rad NA ISTIM fajlovima — automatsko spajanje napravi kod koji izgleda ispravno a nije**
- *Simptom:* (1.9.2026) `git push` odbijen (`non-fast-forward`) — druga sesija je push-ovala 5 commit-ova na `main` dok je lokalno radno stablo imalo nesačuvan rad na `search.service.ts`, `schema.prisma` i M5 spec-u. Pri `rebase`, git je uspešno auto-spojio delove van konflikta, ali je rezultat mešao DVE različite strukture iste funkcije: hunk sa jedne strane koristio je `fixedPicks`/`date` (remote verzija, termin izveden presekom perioda), a okolni auto-spojen kod `fixedTotal`/`windowFrom` (lokalna verzija, termin iz nove tabele `PackageDeparture`). Kod bi se referencirao na promenljive koje u toj verziji ne postoje — `tsc` bi pukao, ali **da su imena slučajno bila ista, prošlo bi tiho sa pogrešnom logikom**.
- *Uzrok:* obe sesije su rešavale ISTI zadatak (termini grupnog paketa) različitim dizajnom; git spaja po linijama, ne po nameri.
- *Provera:* (a) pre bilo čega, `git add -A && git commit` nedovršen rad i napravi `backup/…` granu — tek onda `rebase`; (b) konflikt u funkciji koju su obe strane strukturno prepravile **ne rešavati biranjem hunk-ova** (`--ours`/`--theirs` ili brisanjem markera) — pročitati celu funkciju u obe verzije (`git show <grana>:<fajl>`), odlučiti koja struktura ostaje, pa u nju ručno ugraditi funkcionalnost druge strane; (c) generisane fajlove (`00-PREGLED-DOKUMENTACIJE.html`) nikad ne spajati ručno — uzeti bilo koju stranu pa ponovo pokrenuti `python tools/sync-html-overview.py`; (d) posle spajanja obavezno pun `npx jest` + `npx tsc --noEmit` za SVAKU aplikaciju (`apps/api` i `apps/panel`), ne samo za fajl koji je bio u konfliktu.

**6.5 Provera pristupa pisana kao `=== 0` umesto `> 0` — propušta sve što nije broj (fail-open)**
- *Simptom:* (1.9.2026, uhvaćeno testovima, ne u produkciji) nov izuzetak vidljivosti u `assertBookingAccessible` bio je napisan kao `if (guidesThisBooking === 0) throw 404`. Kad upit ne vrati broj (u testu lažiran Prisma sloj, u životu greška upita/`undefined`), poređenje je netačno → **izuzetak se ne baci → pristup se odobrava**. Tri postojeća testa vidljivosti su odmah pala i otkrila to; da nisu postojali, prošlo bi kao tiho otvaranje tuđih rezervacija.
- *Uzrok:* provera pristupa napisana kao "odbij ako je tačno nula" umesto "dozvoli samo ako je dokazano više od nule". Prva formulacija greši u korist pristupa, druga u korist odbijanja.
- *Provera:* svaka provera pristupa mora biti **fail-closed** — uslov koji ODOBRAVA piše se pozitivno i strogo (`if (!(n > 0)) throw`), nikad kao negacija jedne konkretne vrednosti. Isto važi za `!== 'CANCELLED'`, `!= null` i slične oblike u putanjama koje odlučuju o pristupu. Kad se dodaje nov izuzetak u postojeću proveru pristupa, **obavezno pokrenuti ceo postojeći set testova vidljivosti** pre commit-a — oni su i uhvatili ovaj slučaj.

---

## 7. Kad je nešto "gotovo"

**7.1 Build i tipovi nisu dokaz da ekran radi**
- *Uzrok:* dva baga iz ove sesije (sirov UUID u pretrazi, "Invalid Date" u audit logu) prolazila su `tsc` i `next build` bez greške.
- *Provera:* izlazni kriterijum se čekira **posle provere uživo** protiv prave baze, ne posle build-a. Ako živa provera nije moguća, checkbox ostaje prazan sa obrazloženjem — nikad "uglavnom radi".

**7.2 Prazan ekran je često prazna baza, ne pokvaren kod**
- *Provera:* pre traženja greške u prikazu, proveri da podaci uopšte postoje i zadovoljavaju filtere (vidi 3.1 i 3.2).

---

## 8. Poverenje u tvrdnje o potpunosti (dokumenta, registri, sažeci)

**8.1 "Npr. X, Y, Z" se lako pročita kao "ovo je sve", a nije**
- *Simptom:* M18 §6.2 je do 18.8.2026. tvrdio "dobar deo autonomnih akcija ne treba model" i naveo tri primera (M3, M11, M7) — pri objašnjavanju optimizacije troškova, ta tri primera su prepričana kao da je time tema pokrivena. Tek kad je vlasnik eksplicitno tražio ponovnu proveru **cele** M15 §4 tabele protiv izvorne specifikacije svake stavke, ispostavilo se da još 8 od 25 `AUTONOMOUS` akcija spada u istu kategoriju (M18 spec, v1.10).
- *Uzrok:* kad se zadatak svede na "objasni/primeni pravilo iz dokumenta X", lako je **prepričati** dokument umesto **revidirati** ga protiv izvora na koje se sam poziva. Primeri u tekstu skoro nikad ne dolaze sa oznakom "ovo JESTE kompletno" — odsustvo te oznake se mora čitati kao "verovatno nepotpuno", ne kao "dovoljno".
- *Provera:* kad dokument navodi kratku listu primera za neko pravilo koje pokriva širi registar/skup (M15 §4 sa 40+ akcija, M2 kategorije, M6 tipovi komunikacije...), pre nego što se ta lista prenese dalje kao potpuna ili ugradi u kod/spec, proveriti **svaku** stavku šireg skupa protiv njene sopstvene izvorne specifikacije — ne samo protiv primera koje navodi dokument koji se trenutno čita. Ovo posebno važi pre zatvaranja "Izlaznog kriterijuma" i kad korisnik traži objašnjenje "kako/zašto" nečega što zvuči kao gotovo pravilo.

**8.2 Istraživanje upisano samo u indeks, nikad u kanonski dokument koji indeks tvrdi da ogleda**
- *Simptom:* `27-BACKLOG-IDEJA-I-PREDLOZI.md` je imao šest stavki "Zakon o zaštiti potrošača (istraživanje, avgust 2026)" pod M2/M5(×3)/M10/M14 — ali `26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` (koji svoju svrhu opisuje kao "skuplja sve napomene tipa 'potvrditi sa pravnikom' na jedno mesto") nije imao nijednu od njih, jer te napomene nisu postojale ni u samim modulskim specifikacijama (M2 §9, M5 §13, M10 §12, M14 §8) odakle bi `26` trebalo da ih pokupi.
- *Uzrok:* rezultat pravnog istraživanja je upisan direktno u indeks (27) — brže, ali van reda — umesto prvo u kanonski dokument (modulska specifikacija) pa tek onda u indeks, kako CLAUDE.md ("Otvorena pitanja — jedan indeks za sve module") eksplicitno propisuje. Indeks koji tvrdi da je izveden iz izvora, a stvarno je ponekad *jedini* nosilac podatka, ne može ostati sinhronizovan sam sa sobom.
- *Provera:* svaka nova pravna/knjigovodstvena napomena ide **prvo** u "Otvoreno za dalje" odgovarajuće modulske specifikacije, **tek onda** kao red u `27` (backlog) i `26` (ako je za pravnika/knjigovođu) — nikad direktno samo u indeks. Pri sumnji da li je nešto već "svuda gde treba", proveriti grep-om da isti tekst/pojam postoji i u kanonskom dokumentu na koji indeks pokazuje, ne samo u samom indeksu.

**8.3 "Gotovo" izgovoreno pre nego što je pozadinski zadatak stvarno stigao, ili posle prekida veze**
- *Simptom:* 19.8.2026. sesija na kućnom računaru je pokrenula drugi (širi) prolaz audita kao pozadinski zadatak (Master dokument poglavlja 4/6/7 + provera preostalih modula), a veza/aplikacija se ugasila pre nego što je taj zadatak stigao do bilo kakvog izveštaja ili commit-a. Korisnik je morao ručno da pita "šta sada radite" više puta, bez odgovora, jer je proces već bio mrtav.
- *Uzrok:* pozadinski zadatak (agent, background shell) koji je pokrenut, a sesija se prekine (gašenje aplikacije, gubitak veze, restart) pre nego što stigne izveštaj — taj rad se **ne nastavlja sam od sebe** i ne sme se pretpostaviti da je delimično stigao ili da će se "javiti kasnije". Nema commit-a, nema traga u repozitorijumu, dakle rezultat ne postoji.
- *Provera:* posle svakog pokretanja pozadinskog zadatka, pre nego što se kaže "gotovo" ili "usklađeno", proveriti `git log` i `git status` da je stvarni rezultat commit-ovan — ne verovati sažetku agenta niti tvrdnji da je zadatak izvršen dok promena nije vidljiva u samom repozitorijumu. Ako je sesija bila prekinuta (bilo kojim uzrokom) dok je pozadinski zadatak bio u toku, taj zadatak se smatra izgubljenim i mora se ponovo pokrenuti od početka — ne nastavljati "odakle je stao" bez dokaza gde je stao.

---

## 9. React/Next.js klijentsko stanje (`apps/panel`, `apps/web`)

**9.1 React 18 Strict Mode (dev) dvaput poziva efekat pri mount-u — efekat bez čišćenja koji čita "stale" state duplira posao**
- *Simptom:* klik na stavku u levoj traci ("Katalog proizvoda") je otvorio DVA identična taba umesto jednog (24.8.2026, prijavio vlasnik uživo).
- *Uzrok:* `next.config.js` ima `reactStrictMode: true` — u `next dev` (NE u produkcionom build-u) React namerno **dvaput** poziva svaki `useEffect` pri mount-u (mount → cleanup → mount ponovo), pre ijednog ponovnog renderovanja, da bi otkrio efekte koji nisu idempotentni. `useRegisterTab` (`TabsContext.tsx`) je pozivao `openTab(pathname, label)` iz efekta bez čišćenja; provera "da li tab već postoji" je čitala ISTU zatvorenu (stale) `tabs` React state promenljivu u OBA poziva (React još nije stigao da primeni `setTabs` između njih) — oba poziva su nezavisno zaključila "ne postoji" i oba dodala po jedan nov tab.
- *Provera:* svaki `useEffect` koji na osnovu TRENUTNOG stanja odlučuje da li da doda/izmeni stavku u nizu (ne samo pročita ga) mora čitati stanje preko `useRef`-a ažuriranog SINHRONO (u istom pozivu kao i `set*`), ne preko zatvorene state promenljive iz `useCallback`/render zatvaranja — samo `useRef` garantuje da drugi poziv u istom sinhronom dvostrukom pozivu (Strict Mode) vidi ono što je prvi upravo upisao. Kad se prijavi "duplirano X pri prvom otvaranju/klika" u panel/web UI-ju, prva sumnja treba da bude TAČNO ovaj obrazac (efekat + provera-pa-dodaj nad React state-om), pre traženja greške u samom poslovnom kodu.

**9.2 Goli `<Link href>` u levoj traci ume da promeni adresu ali ostavi sadržaj neosvežen**
- *Simptom:* klik na stavku menija ("Pretraga i rezervacije") menja URL u browseru, ali centralni sadržaj ostaje neosvežen/prazan — radi tek posle klika na DRUGU ikonicu pa povratka (27.8.2026, prijavio vlasnik uživo, potvrđeno preko `AskUserQuestion`: "adresa se promeni, ekran ne osveži").
- *Uzrok:* nije pronađen na nivou logike (kôd u `Sidebar.tsx`/`Shell.tsx`/`ActivityBar.tsx` je pregledan i tačan) — nema pravog browsera u ovom okruženju da se root cause potvrdi direktno (poznato ograničenje, vidi odeljak 7/8). Simptom liči na nepouzdano "meko" App Router navigiranje preko golog Next.js `<Link>`, isti simptom klase koji je već jednom bio razlog da `TabsContext.tsx` napusti `<Link>` u korist eksplicitnog `openTab()` poziva (komentar u kodu: "openTab je ranije SAMO upisivao zapis... svuda gde se openTab poziva direktno iz onClick bez <Link> navigacija se nikad nije desila" — obrnuta strana istog problema).
- *Provera/rešenje:* kad se prijavi "URL se promeni, sadržaj ne" za stavku u levoj traci ili sličnu navigaciju, ZAMENI goli `<Link href>` eksplicitnim `onClick={() => openTab(href, label)}` (`useTabs()`, `TabsContext.tsx`) — isti mehanizam koji već pouzdano radi za AI chat prečice, meni "Poruke" i klik na obaveštenje. Ne nagađati dalje unutar `next.config.js`/router verzije bez novog konkretnog nalaza — ovaj zaobilazni obrazac je dovoljan i već ustaljen u ovom kodu.

**9.4 Route handler koji samo hvata `ApiError` i sve ostalo prosleđuje dalje (`throw err`) — mrežna greška stiže klijentu kao prazno telo, ne kao poruka**
- *Simptom:* prijava na panel (`/prijava`) pukla sa `SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input` u `LoginForm.tsx:28` (1.9.2026, prijavio vlasnik uživo — "pokreni localhost" pa odmah pokušaj prijave, minut po podizanju servera).
- *Uzrok:* `apps/panel/src/app/api/session/login/route.ts` (i `apps/web` ekvivalent, isti obrazac — "isti obrazac kao apps/web" komentar u kodu) hvataju samo `ApiError` iz `apiFetch`, sve ostalo prosleđuju (`throw err`). `fetch()` ka `apps/api` baca običan `TypeError` (npr. `ECONNREFUSED`, servis se u tom trenutku restartovao/nije još gore) — NIJE `ApiError`, pa prolazi kroz `throw err` neuhvaćen iz route handler-a. Next.js dev vraća 500 sa PRAZNIM telom za takvu neuhvaćenu grešku (ne HTML overlay, ne JSON) — klijent koji bez provere zove `res.json()` puca sa "Unexpected end of JSON input", poruka koja ne otkriva stvarni uzrok (izgleda kao da je API vratio nešto pokvareno, a zapravo API u tom trenutku uopšte nije bio dostupan).
- *Provera/rešenje:* `apiFetch`/`apiFetchMultipart` u `apps/panel/src/lib/api-client.ts` i `apps/web/src/lib/api-client.ts` sada hvataju grešku SAMOG `fetch()` poziva (ne samo `!res.ok` posle uspešnog poziva) i pretvaraju je u `ApiError(503, {message: 'Servis trenutno nedostupan...'})` — svaki pozivalac (login, MFA, bilo koji drugi route handler koji već ima `catch (err) { if (err instanceof ApiError) ... throw err }` obrazac) automatski dobija čist JSON umesto da propusti sirovi `TypeError` dalje. Kad se doda NOVI route handler koji poziva `apiFetch` direktno (ne kroz Server Component), ne treba ponovo hvatati `TypeError` ručno — dovoljno je pratiti isti `catch (err) { if (err instanceof ApiError) return NextResponse.json(...); throw err }` obrazac, jer `apiFetch` sada garantuje da je svaka mrežna greška već `ApiError`. Ako se ista poruka ("Unexpected end of JSON input") pojavi na nekom DRUGOM ekranu (ne login), prva sumnja treba da bude TAČNO ovaj obrazac — proveriti da li taj konkretan `catch` blok hvata samo `ApiError`.

**9.3 `next build` pokrenut dok `next dev` već radi nad istim `apps/*` — pokvari keš, sve rute pucaju**
- *Simptom:* posle sasvim ispravne izmene (paleta boja, `feature/ui-shadcn-redesign`, 29.8.2026), vlasnik uživo prijavio grešku na svakoj ruti panela: `Error: Cannot find module './1193.js'` iz `webpack-runtime.js`.
- *Uzrok:* `npx next build` (produkcioni build, korišćen ovde samo kao sanity-check da li kod i dalje kompajlira) pokrenut dok je `next dev -p 3101` već aktivno radio nad ISTIM `apps/panel/.next` folderom — oba procesa pišu/čitaju keš istovremeno, webpack runtime ostane sa referencama na module koje je build obrisao/preimenovao, dev server od tog trenutka ne može da posluži nijednu rutu.
- *Provera/rešenje:* nikad ne pokretati `next build` dok dev server (`next dev`) za tu istu aplikaciju već radi. Ako treba proveriti da produkcioni build prolazi, ili prvo zaustaviti dev server, ili prihvatiti da se dev server posle mora restartovati. Ispravka kad se već desi: naći PID na tom portu (`netstat -ano`), ugasiti ga, obrisati `.next` folder u celini, pokrenuti `next dev` iznova — `tsc --noEmit` NIJE deo ovog problema (bezbedan da se pokreće uporedo, ne piše u `.next`).

**9.5 `'use server'` fajl koji izvozi običan objekat (ne funkciju) radi dok se ne doda NOVA server-akcija na ISTU stranicu — onda ceo "actions loader" build padne**
- *Simptom:* klik na dugme koje pokreće server akciju (`Aranžman` kartica, "Proveri cenu") vratio Next.js Runtime Error overlay: `A "use server" file can only export async functions, found object`, iako je `tsc --noEmit` prošao čisto i strana se renderovala (SSR) potpuno ispravno (2.9.2026, otkriveno pri dodavanju `AranzmanItemCard.tsx`).
- *Uzrok:* `booking-changes-actions.ts` i `booking-guide-actions.ts` (oba `'use server'`) su GODINAMA (od kad su nastali) izvozili i po jedan običan objekat — `emptyChangeState`/`emptyGuideState` (početno stanje forme, pored pravih `export async function` akcija). Next.js pravilo je da `'use server'` fajl sme da izvozi ISKLJUČIVO async funkcije (https://nextjs.org/docs/messages/invalid-use-server-value) — ali Turbopack to očigledno ne proverava dok se za tu KONKRETNU stranicu ne generiše "server actions loader" modul koji uvozi TAJ fajl; taj loader se (re)generiše kad stranica dobije NOVU server-akciju referencu (ovde: `previewModifyPrice` u novom klijentskom komponentu na istoj strani), posle čega loader-ov statički prolaz kroz SVE `'use server'` fajlove uvezene na toj strani prvi put otkriva i STARI, dotad nedirnut prekršaj. Restart dev servera i brisanje `.next` keša NE rešavaju ovo (probano) — greška je stvarna, ne stale keš.
- *Provera:* svaki `'use server'` fajl sme da izvozi ISKLJUČIVO `export async function` (i tipove/interfejse — oni se brišu pri kompajliranju, bezbedni su). Bilo koji `export const X = {...}`/`export const X: Tip = vrednost` (početno stanje forme, konstante, mape) mora živeti u ODVOJENOM fajlu BEZ `'use server'` direktive (npr. `change-form-state.ts`, `guide-form-state.ts` u `apps/panel/src/app/(app)/rezervacije/[id]/`), koji onda i akcije i klijentske komponente uvoze. Pre nego što se doda NOVA server-akcija na postojeću stranicu, proveriti (`grep -n "^export const" <fajl>.ts` za svaki `'use server'` fajl uvezen na toj strani) da nijedan već ne krši ovo pravilo — ako krši, prijaviće se tek kad je dodatak već unutra, ne pre.

---

**9.4 Konstanta uvezena iz `'use client'` modula u server komponentu nije ta konstanta**
- *Simptom:* preferenca je u bazi tačno postavljena (provereno `GET`-om), server komponenta je čita bez ijedne greške u logu, i **svejedno uvek prikazuje podrazumevanu vrednost**. Ništa ne pukne, `tsc` je čist, `catch` grana se nikad ne okine — izgleda kao da vrednost prosto "ne stiže". Uhvaćeno 2.9.2026 na prekidaču izgleda kartice Pregled: `booking_overview_layout` je bio `klasicni`, ekran je uporno crtao `novi`.
- *Uzrok:* modul označen sa `'use client'` se u server komponenti ne uvozi kao običan JavaScript — bundler sve njegove izvoze pretvara u "client reference" objekte. Za komponentu je to tačno ono što treba. Za običnu konstantu nije: umesto stringa `'booking_overview_layout'` server dobije objekat, pa `prefs[KLJUČ]` postane `prefs['[object Object]']` → `undefined`. Poređenje tiho ispadne netačno, bez ijedne greške.
- *Provera:* `'use client'` fajl izvozi **samo komponentu**. Sve što server komponenta treba da pročita — ključevi preferenci, konstante, tipovi, čiste pomoćne funkcije — živi u neutralnom modulu (bez direktive) koji uvoze obe strane. Kad podešavanje "ne radi" a greške nema, prvo proveriti odakle je uvezen ključ, pre nego što se sumnja na keš, bazu ili mrežu.
**9.6 React 19 upozorava na svaki `<script>` iscrtan iz komponente**
- *Simptom:* u konzoli `Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client.`, sa tragom do korenskog `layout.tsx`.
- *Uzrok:* inline skripta (npr. `next/script` sa `strategy="beforeInteractive"` ili goli `<script>`) iscrtana iz React stabla. Na prvom učitavanju skripta stvarno radi (SSR HTML), pa upozorenje deluje kao lažna uzbuna — i najčešći savet sa interneta je da se poruka **uguši** filtriranjem `console.error`. To je savet za one koji ne mogu da menjaju biblioteku (`next-themes`); u sopstvenom kodu je zaobilaženje simptoma.
- *Provera:* ako podatak koji skripta traži server ume da pročita (kolačić, zaglavlje, sesija), reši ga **na serveru** i iscrtaj rezultat u HTML — skripta tada nije potrebna uopšte. Tako je 2.9.2026 rešen izbor teme u panelu: `localStorage` + blokirajuća skripta → kolačić koji `layout.tsx` čita. Nusprodukt: `suppressHydrationWarning` na `<html>` je uklonjen, pa provera neslaganja server/klijent na korenskom elementu ponovo radi.

## 10. Prisma `Decimal` polja preko JSON-a (backend ↔ panel/web ugovor)

**10.1 `Decimal` stiže na frontend kao STRING, ne broj — `.toFixed()`/aritmetika puca u produkciji, `tsc` to ne hvata**
- *Simptom:* ekran "AI troškovi" (M18 `/nadzor/ai-troskovi`) pukao u produkciji sa `Error: q.consumedEur.toFixed is not a function`, iako je `tsc --noEmit` prošao čisto i pre i posle (29.8.2026, prijavio vlasnik uživo).
- *Uzrok:* `AIProviderQuota.consumedEur`/`budgetLimitEur` (i svako drugo `Decimal` polje u `schema.prisma`, npr. `nbsMiddleRate`, `vatRate`, `depositPercentage`, `matchConfidence`) su na bazi `Decimal` (`decimal.js` objekat u NestJS-u). Kad kontroler vrati taj objekat kroz `res.json()`, `Decimal.prototype.toJSON()` ga pretvara u STRING (npr. `"0.001059"`), ne u broj. TypeScript interfejs na panelu je pogrešno tvrdio `number` (tip se piše ručno za svaki DTO, ništa ga automatski ne proverava protiv stvarnog Prisma tipa) — `tsc` je zato "prošao" iako je pretpostavka o tipu bila pogrešna; greška se pojavljuje tek kad se stvarno pozove `.toFixed()`/aritmetika nad string vrednošću, u browseru, ne u build koraku.
- *Provera:* pre nego što se novi ekran/DTO doda za bilo koje polje čiji je tip u `schema.prisma` `Decimal`, TS interfejs na panelu MORA biti `string` (ne `number`), i svaka aritmetika/`.toFixed()` ide preko `Number(polje)` na mestu upotrebe (isti obrazac kao `Number(c.health.uptimePercentage).toFixed(1)` u `integracije/page.tsx`, koji je ovo od početka radio ispravno). Kad se prijavi "`X.toFixed is not a function`" ili slična greška nad poljem koje dolazi sa API-ja, prva sumnja treba da bude TAČNO ovo — proveriti da li je izvorno polje `Decimal` u `schema.prisma` pre traženja greške drugde. M10/M13 ekrani su provereni (29.8.2026) i trenutno ne prikazuju nijedno `Decimal` polje direktno (novčani iznosi su svuda `Int` u parama/centima, po konvenciji iz M3 spec poglavlja 2) — ali ako se doda ekran za kursnu listu (`nbsMiddleRate`) ili pregled AI-uparivanja faktura (`matchConfidence`), ovo pravilo se primenjuje od prvog dana tog ekrana, ne naknadno.

**10.2 Datum-bez-vremena kao "do datuma" granica isključuje skoro sve zapise TOG dana**
- *Simptom:* pretraga audit loga po opsegu datuma (M1 spec §6, dopunjeno 29.8.2026 na zahtev vlasnika) — filter "od 29.8.2026 do 29.8.2026" vratio "Nema zapisa", iako je bez tog filtera lista pokazivala desetine zapisa tačno tog dana.
- *Uzrok:* `<input type="date">` šalje vrednost kao `"YYYY-MM-DD"`, bez vremena. `new Date("2026-08-29")` je, po ECMA-262, UTC PONOĆ tog dana (`00:00:00.000Z`) — `WHERE timestamp <= to` je time isključivao svaki zapis napravljen posle ponoći, što je u praksi bilo skoro sve. Isti obrazac greške kao 9.1 (React Strict Mode) po vrsti — nešto što izgleda ispravno u izolovanom testu (`new Date(neki-datum-sa-vremenom)`) tiho radi drugačije kad je ulaz baš datum-bez-vremena.
- *Provera/rešenje:* svaki filter tipa "do datuma" koji prima vrednost iz `<input type="date">` (ili bilo koji `"YYYY-MM-DD"` string) mora eksplicitno proširiti granicu na KRAJ tog dana pre poređenja — `apps/api/src/modules/m1-core-identitet/audit-log/audit-log.controller.ts`, `endOfDayIfDateOnly()` (regex provera `^\d{4}-\d{2}-\d{2}$`, pa `+24h - 1ms` na UTC ponoć, ne string sa dodatim vremenom bez "Z" ofseta — to bi unelo dvosmislenost lokalne/UTC zone). Kad se prijavi "filter po datumu vraća prazno/premalo", prva sumnja treba da bude TAČNO ovo, pre traženja greške u samom upitu.

---

## 11. CI ne odgovara lokalnom okruženju — "prošlo je kod mene" nije dokaz

**11.1 CI Postgres slika bez `pgvector` — migracija koja zahteva ekstenziju tiho puca na svakom pushu, niko ne primeti jer se run ne proverava svaki put**
- *Simptom:* `.github/workflows/ci.yml` je koristio običan `postgres:16-alpine` (ne `pgvector/pgvector:pg16` kao lokalni `docker-compose.yml`) — od migracije `20260821083727_add_pgvector_embeddings` (M21/M23 semantička pretraga, 21.8.2026) svaki naredni CI run je pucao na koraku "Primeni migracije nad CI bazom" (`P3018`, `extension "vector" is not available`), tiho, bar 5 pushed commit-a unazad (31.8.2026, otkriveno tek kad je neko stvarno proverio Actions stranicu posle jedne velike izmene, ne posle svakog pojedinačnog push-a).
- *Uzrok:* Docker slika za CI Postgres servis je definisana ODVOJENO od `docker-compose.yml` (dva mesta, jedan stvaran zahtev — ekstenzija) — kad je pgvector uveden u šemu, `docker-compose.yml` je ažuriran (lokalni razvoj je nastavio da radi), ali `ci.yml` nije, i ništa nije upozorilo da su ta dva mesta razišla se dok CI run stvarno ne padne.
- *Provera:* posle SVAKOG push-a koji dodaje/menja Prisma migraciju, proveriti da GitHub Actions run stvarno prošao (ne pretpostaviti na osnovu toga da je lokalni `prisma migrate deploy`/`migrate reset` prošao — CI koristi SVOJU, odvojeno definisanu bazu/sliku, ne istu koju razvojna mašina koristi). Kad CI runner-a definiše sopstvenu infrastrukturu (Docker image, verzija) umesto da je preuzme iz `docker-compose.yml`, svaka izmena šeme koja zavisi od nestandardne ekstenzije/verzije mora eksplicitno proveriti i ažurirati OBA mesta u istom prolazu — isti princip kao "izmena u jednom dokumentu utiče na drugi" iz CLAUDE.md, primenjen na infrastrukturu, ne samo na tekst. Reprodukcija van GitHub-a: pokrenuti tačno istu sliku lokalno (`docker run postgres:16-alpine ...`) i primeniti `prisma migrate deploy` protiv nje pre nego što se veruje da će CI proći.
