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

## 6. Rad paralelno sa drugim agentom

**6.1 Nikad `git add -A` kad drugi agent radi**
- *Uzrok:* radno stablo sadrži i njegove nedovršene izmene; `add -A` ih uvlači u tvoj commit.
- *Provera:* staguj **eksplicitno navedene** putanje; pre commit-a `git diff --cached --name-only` i potvrdi da je svaka tvoja.

**6.2 Fajl koji ste obojica mogli dotaknuti proveri po diff-u, ne po pretpostavci**
- *Provera:* `git diff --unified=0 <fajl>` i pogledaj da su sve `+`/`-` linije tvoje.

**6.3 `git pull --rebase` pada kad drugi ima nesnimljene izmene**
- *Provera:* ne stashuj tuđe izmene. Ako se remote nije pomerio, dovoljan je `git push`; ako se pomerio, čekaj da on commit-uje.

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
