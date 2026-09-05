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

### 1.1 Dva ulaza u rezervaciju vode na staru mock rutu — ISPRAVLJENO 5.9.2026

> **Ispravka opisa (5.9.2026).** Prva verzija ovog nalaza (4.9.2026) bila je **netačna u obimu**: tvrdila je da lista rezervacija u celini vodi na mock ekran i da je pravi dosije od 1.742 linije mrtav kod. Provera koda je pokazala da to nije tako — glavni put je već bio ispravan, a zaostala su bila **dva sporedna ulaza**. Uzrok greške u proceni: nalaz je izveden iz jedne posmatrane poruke na ekranu, bez provere kojim je tačno od tri puta ta poruka dobijena; a `BookingsTable.tsx`, u koji sam gledao, uopšte se ne renderuje (živa tabela je `RealBookingsTable.tsx`). Upisano kao zamka 8.4, a iz iste greške je nastao i `40-PRAVILA-REVIZIJE-KODA.md` — postupak po kom se od 5.9.2026. piše svaki nalaz (klasa dokaza, odvojen uzrok, prebrojan obim, obavezan pokušaj obaranja).

**Simptom (dokazano na ekranu):** klik na rezervaciju otvori sažetak u desnom panelu; dugme **„Otvori pun zapis"** u tom sažetku ispisuje:

> „Rezervacija MOCK-LISTA-2026-0001 **nije pronađena** (mock lista)."

Isto se dešavalo i pri kliku na termin u **kalendaru**. Klik na sam **broj rezervacije** u tabeli je sve vreme radio ispravno — otvarao pravi dosije.

**Uzrok:** dva načina adresiranja iste stvari. Stara mock pod-ruta `rezervacije/lista/[bookingNumber]` (44 linije, v1.42–v1.53) traži zapis po **broju** u hardkodovanom nizu `MOCK_BOOKINGS`. Pravi dosije `rezervacije/[id]` (1.742 linije, API `/sales/bookings/:id`) traži po **internom ID-u**. Kad je lista v1.54 prešla na prave podatke, tabela je preusmerena na `id`, ali dva potrošača su ostala na broju:

| Ulaz | Stanje pre | Zašto |
| :---- | :---- | :---- |
| `RealBookingsTable.tsx:177` — klik na broj | ispravan | već je nosio `b.id` |
| `RightPanel.tsx:278` — „Otvori pun zapis" | **na mock rutu** | sažetak (`BookingRowSummary`) uopšte nije nosio `id`, samo broj |
| `DayAgenda.tsx:40` — kalendar | **na mock rutu** | `DayDetailEntry` je imao `bookingId`, ali se koristio broj |

`BookingsTable.tsx` (446 linija, mock) više se ne renderuje nigde — `FiltersModal.tsx` iz njega uvozi samo tip `ColumnKey`. Nije uzrok, ali jeste mrtav kod.

**Šta je ispravljeno (5.9.2026):**
1. `BookingRowSummary` dobio opciono polje `bookingId`; `RealBookingsTable` ga popunjava.
2. `RightPanel` vodi na `/rezervacije/<id>`. Kad `bookingId` nedostaje, dugme se **ne prikazuje** — odsutno dugme je bolje od dugmeta koje otvori „nije pronađena".
3. `DayAgenda` vodi na `/rezervacije/<entry.bookingId>`.

**Provereno kroz stvarne ekrane** (prijava u panel, TOTP, pa učitavanje stranica), ne iz koda: `/rezervacije/<id>` vraća HTTP 200 sa brojem rezervacije, bez „nije pronađena" i bez „MOCK prikaz" upozorenja; lista sada nosi interni ID; kalendar više ne emituje nijedan `/rezervacije/lista/MOCK...` link. `tsc --noEmit` čist.

**Ostaje kao odluka vlasnika (ne diram bez potvrde):** stara mock ruta i `mock-data.ts` sada su bez ijednog ulaza — niko ih više ne otvara, ali stoje. Brisanje je čist dobitak *ako* vam više ne trebaju za pregled izgleda. Vlasnikova odluka od 5.9.2026 je da mock podaci **svesno ostaju** dok se ne pređe na stvaran rad, pa se ništa ne briše bez izričite potvrde. Napomena: ovo se odnosi na mock *ekran*; same rezervacije `MOCK-LISTA-*` su prave rezervacije u bazi i njih ovo ne dotiče.

---

### 1.2 Sistem beleži „poslato" za poštu koja ne izlazi iz kuće — REŠENO 5.9.2026

> **Dopuna i ispravka predloga (5.9.2026), po `40-PRAVILA-REVIZIJE-KODA.md`.** Sam nalaz opstaje i potvrđen je. Ali **predloženo rešenje iz prve verzije bilo je neizvodljivo**, i obim je bio uži nego što jeste — oboje je otkrio obavezan pokušaj obaranja (pravilo 5). Detalji u „Pokušaj obaranja" ispod.

**Klasa dokaza: C (pročitano u kodu), sa prebrojanim obimom.**

**Simptom.** Na tri mesta sistem trajno upisuje da je poruka poslata, a nijedna ne izlazi iz kuće:

| # | Gde | Šta se upiše kao istina | Vidi li to čovek danas |
| :-- | :---- | :---- | :---- |
| 1 | `SupplierManifestsService.send()` | `status = SENT`, `sentAt`, `sentToEmail`, `BookingItem.announcedAt`, revizijski trag `supplier_manifest.sent` | ne — nema ekrana u panelu |
| 2 | `SupplierChangeNoticesService.send()` | `status = SENT`, `sentAt`, trag `supplier_change_notice.sent` | ne — nema ekrana u panelu |
| 3 | `EmailThreadsService.sendDraft()` (M22) | `sentBy`, `providerMessageId = mock-<uuid>`, trag `email_message.draft_sent` | **da** — dugme „pošalji" u `EmailMessagesPanel.tsx` |

Treće mesto je jedino koje čovek danas stvarno klikne, i ono ponaša se kao uspeh.

**Uzrok (odvojen dokaz, pravilo 2).** Nije jedan stub, nego **jedan izbor koji nije donet**. `MockEmailProviderAdapter` je *jedina* implementacija `EmailProviderAdapter` (`EmailProviderFactory` nema drugu granu); ona samo loguje upozorenje i vraća izmišljen `providerMessageId`. To nije previd — M22 spec §10 izričito čeka **vlasnikov izbor provajdera** (Gmail API / Microsoft Graph / IMAP-SMTP). Poštena je i sama poruka u logu („NIJE stvarno poslat"). Neiskren je samo **zapis u bazi**, koji ne pravi razliku između poslatog i pripremljenog.

Uz to, komentar u `M22MailboxStubService` tvrdi da „M22 još nije implementiran" — netačno od kad M22 postoji (`M22EmailInboxModule` je registrovan u `app.module.ts:56`). To je zamka 13.2 (tvrdnja preživela stanje koje opisuje); komentar ispravljen 5.9.2026.

**Pokušaj obaranja (pravilo 5): „nalaz bi bio netačan ako postoji spreman put za stvarno slanje."** Provereno — **ne postoji**, i time je prvobitni predlog oboren:

- *„povezati stub sa M22"* — **ne bi poslalo ništa.** M22 jeste implementiran, ali njegov jedini provajder je mock. Povezivanje bi lažno „poslato" pomerilo jedan sloj dublje, ne uklonilo ga.
- *„ili sa `MailerService`-om"* — **suprotno pisanom pravilu.** Sopstvena dokumentacija tog servisa isključuje ovu upotrebu: „NIJE za … sandučad iz M22 (tamo se šalje U IME sandučeta, preko konekcije tog sandučeta, što je zaseban provajderski izbor — M22 §10)." `MailerService` šalje sistemsku poštu sa adrese kuće; najava dobavljaču ide iz zajedničkog sandučeta i mora ostati u toj niti da bi odgovor hotela imao gde da se veže.

Nalaz dakle opstaje, ali **nije popravljiv kodom bez vlasnikove odluke o provajderu**. Ono što jeste popravljivo odmah je da zapis prestane da tvrdi neistinu.

**Sporedni nalaz koji je isplivao (klasa A) — REŠEN 5.9.2026:** za `SupplierManifest` i `SupplierChangeNotice` **ne postoji nijedan ekran u panelu** — pretraga po `apps/panel/src` vraća samo M22 ekran e-pošte. Operativne liste i izmene ka dobavljaču danas se mogu pokrenuti isključivo pozivom API-ja. Ovo je „logika postoji, UI ne" iz `CLAUDE.md`, i vodi se odvojeno od 1.2.

**Predlog (odluka je vlasnikova, v. razgovor 5.9.2026):** dok provajder nije izabran, klik na „pošalji" ne sme da ostavi trag koji se ne razlikuje od stvarnog slanja. Tri moguća oblika — od najmanje do najviše zahvatne izmene — dati su vlasniku na izbor; svaka menja ponašanje, pa traži dopunu M5 §8.4/§8.8 (i M22 §4) pre koda, po tvrdom pravilu iz `CLAUDE.md`.
**Procena:** 2–4 sata za izabran oblik iskrenog zapisa; pravo slanje zavisi od izbora provajdera, ne od koda.

---

**REŠENO 5.9.2026** (vlasnikova odluka: „nov status *pripremljeno, čeka slanje*"; M5 spec v1.99 §8.4/§8.8, M22 spec v1.7 §2.4/§10). Ispalo je bolje nego što je odluka tražila — uz iskren zapis, slanje je i **stvarno prorađeno**:

1. **`SupplierManifestStatus`/`SupplierChangeNoticeStatus` dobili `PENDING_SEND`.** Kad isporuke nema: `sent_at` ostaje prazan i `announced_at` se NE upisuje, pa stavke ostaju nenajavljene u svakoj postojećoj proveri — bez ijedne dodatne logike. `sent_by` se ipak upisuje (ko je pokušao). Revizijski trag razdvaja `supplier_manifest.sent` od `supplier_manifest.send_pending`.
2. **`EmailMessage.delivered_at`** (M22 §2.4) — `sent_by` znači „ko je kliknuo", `delivered_at` znači „provajder je primio". Mock adapter više ne vraća izmišljen `providerMessageId`, nego `delivered: false`.
3. **`SmtpEmailProviderAdapter`** — prva implementacija koja stvarno šalje, **u ime sandučeta** (`from` = adresa sandučeta, ne adresa kuće — zato `MailerService` i nije mogao da posluži). Bira se po sandučetu preko `provider_connection_ref = "smtp:env"`.
4. **`M22MailboxStubService` obrisan**, zamenjen `SupplierMailboxService`-om koji radi ono što je §8.8 sve vreme opisivao: nalazi jedinstveno sanduče, otvara M22 nit sa `[REF: TT-NNNNNN]` u naslovu, vezuje je na izvor i predaje poruku provajderu.
5. **Panel** (`EmailMessagesPanel.tsx`): poruka bez isporuke prikazuje se kao **„čeka slanje — X je pokušao, poruka još nije otišla"**, sa dugmetom „pošalji ponovo". Ranije je dugme nestajalo čim se klikne, pa je neisporučena poruka izgledala kao poslata.

**Provereno kroz stvaran API** (prijava, 2FA, `POST /sales/supplier-manifests/:id/send`), ne iz koda:

| Provera | Ishod |
| :---- | :---- |
| provajder radi → slanje | `SENT`, `sent_at` upisan, **mejl stvarno stigao** u mailpit: `dobavljaci@terminal-travel.local → rezervacije@nile-incoming-services.example`, naslov `[REF: TT-000001] Operativna lista — ...` |
| provajder nedostupan → slanje | `PENDING_SEND`, `sent_at` = `null`, **0 stavaka** označeno kao najavljeno, trag `supplier_manifest.send_pending` |
| provajder proradi → ponovno slanje iste liste | `SENT` |

976 testova prolazi (5 novih, `supplier-manifest-send-honesty.spec.ts` — zaključavaju baš ovo ponašanje, jer greška nije bila pad nego pogrešan upis).

**Ostaje otvoreno i zavedeno (ne prećutano):**
- **Dovlačenje pristigle pošte** (`fetchNewMessages`) — SMTP to po prirodi ne radi; traži IMAP ili API provajdera. Odgovor dobavljača se zato još ne uvozi sam. Nalaz 1.2 je time rešen u smeru „mi → hotel"; smer „hotel → mi" ostaje.
- **Izbor pravog provajdera** za produkciju (Gmail API / Microsoft Graph / IMAP) — vlasnikova odluka, M22 §10.
- ~~**Nema ekrana u panelu** za `SupplierManifest`/`SupplierChangeNotice`~~ — **rešeno istog dana** na zahtev vlasnika: `/rezervacije/najave` (M17 v2.37). Ceo tok se sada vodi sa ekrana.

---

## 2. Visoko — radi danas, pada pod stvarnim opterećenjem

### 2.1 Baza nema indekse na stranim ključevima — 81 komad — REŠENO 5.9.2026

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

**REŠENO 5.9.2026.** Migracija `20260905091500_indeksi_na_stranim_kljucevima`, 81 `CREATE INDEX`, uz `@@index` u `schema.prisma` (54 modela) da Prisma ostane izvor istine.

**Pokušaj obaranja (pravilo 5, dok. 40): „nalaz bi bio netačan ako su te kolone već pokrivene kao vodeći stubac nekog složenog indeksa."** Provereno — upit poredi kolone stranog ključa sa PREFIKSOM svakog indeksa nad istom tabelom, ne sa tačnim poklapanjem. I uz tu proveru: **81 od 102**. Nalaz opstaje.

**Izmereno posle (klasa A):**

| | pre | posle |
| :---- | :---- | :---- |
| strani ključevi bez indeksa | 81 od 102 | **0 od 102** |
| indeksa u bazi | 160 | 241 |

**Stvaran efekat, izmeren `EXPLAIN ANALYZE`-om nad `rate_lines` (1.542 reda), isti upit oba puta:**

| | pročitano blokova |
| :---- | :---- |
| sa indeksom (od danas) | **4** (Bitmap Index Scan) |
| bez indeksa (kako je bilo) | **30** (Seq Scan) |

Broj pročitanih blokova bez indeksa raste sa veličinom tabele; sa indeksom ostaje skoro ravan. Na 1.542 reda to je 30 naspram 4 — nevidljivo. Na sto hiljada redova ista razlika je između trenutnog i minutnog odgovora, i to na svakom ekranu istovremeno.

**Cena koja se ne prećutkuje:** 81 nov indeks znači nešto sporije upisivanje (svaki `INSERT`/`UPDATE` održava i indekse) i nešto više prostora. Za sistem u kom se mnogo više čita nego piše — a rezervacije se čitaju sa svakog ekrana, a pišu jednom — to je dobra razmena. Ako se neki indeks u praksi pokaže kao nekorišćen, `pg_stat_user_indexes` to pokazuje i pojedinačan indeks se može ukloniti.

**Namerno NIJE urađeno:** automatski generisan `migrate diff` je uz indekse ponudio i `DROP TABLE destination_profiles` sa dva `DROP TYPE` — tabela postoji u razvojnoj bazi a ne u šemi (prazna je), ostatak rada sa druge grane koja deli istu bazu. Izbačeno iz migracije; brisanje tuđeg posla nije deo ovog nalaza. **Zavedeno odvojeno** (v. backlog).

**Provera da ništa nije pokvareno:** `tsc` čist, 976 testova prolazi, `/rezervacije/lista`, `/katalog`, `/rezervacije/kalendar`, `/email` i `/rezervacije/najave` svi HTTP 200 kroz pravu prijavu.

---

### 2.2 Paginacije nema nigde, a lista rezervacija tiho odseca na 200 — OBRAZAC NAPRAVLJEN, PRIMENJEN NA DVE LISTE 5.9.2026

**Dokaz:** u celom `apps/api` ima **0** pojava `skip:` i **0** pojava `cursor:`. Od 209 poziva `findMany`, samo 5 ima ikakav limit. Nijedan query DTO ne prima `page` ni `limit`.

Konkretno u `bookings.service.ts:591` stoji `take: 200` bez ijednog objašnjenja. To nije paginacija nego **tiho odsecanje**: agencija sa 201 rezervacijom neće videti najstariju, i ništa na ekranu neće reći da nešto nedostaje.

Katalog proizvoda nema ni to — vraća sve. Danas 217 zapisa, ali kad se uključi API dobavljač (M4) to postaju desetine hiljada u jednom odgovoru.

**Predlog:** zajednički obrazac paginacije (`page`/`limit` u DTO sa `@Max()`, odgovor u obliku `{ data, total, page }`), pa primena redom po ekranima — prvo rezervacije, katalog i CRM. Do tada, `take: 200` bar zameniti jasnom porukom „prikazano prvih 200 od N".
**Procena:** 1 dan za obrazac + 2–3 dana za primenu na glavne liste.

---

**URAĐENO 5.9.2026 — obrazac i dve liste; ostatak zaveden, ne prećutan.**

Zajednički obrazac je u `apps/api/src/common/pagination/`: `parsePagination` (čita `page`/`limit`), `paginationArgs` (prevod u Prisma `skip`/`take`), `paginated` (omotač odgovora `{ data, total, page, limit, pageCount, hasMore }`). `total` uvek dolazi iz `count` u ISTOJ transakciji sa upitom — inače „prikazano 50 od 1.240" ume da laže dok neko drugi upisuje.

| Lista | Pre | Posle |
| :---- | :---- | :---- |
| `GET /sales/bookings` | golo `take: 200`, bez poruke | straničeno; panel ispisuje „prikazano 21–25 od 25" i strelice |
| `GET /catalog/products` | bez ikakve granice | `{ data, total }`; straničenje **opciono** (v. niže) |

**Katalog namerno NIJE straničen podrazumevano** — i to je nalaz koji prvobitni predlog nije uzeo u obzir. U `katalog/page.tsx` stoji vlasnikova odluka od 4.9.2026 da filteri rade trenutno, nad celom dovučenom listom. Podrazumevano straničenje bi ih tiho svelo na jednu stranu: korisnik bi filtrirao 50 od 217 proizvoda misleći da vidi sve — ista klasa greške koju nalaz i prijavljuje, samo obrnuta. Isto ograničenje stoji za `GET /search` (M5 v2.20 izričito uslovljava klijentsko filtriranje time da pretraga vraća sve). Kad se uključi M4, obe odluke prestaju da važe i filtriranje mora na server — zavedeno.

**Greška koju sam usput napravio i uhvatio tek na živom API-ju:** prvo sam straničenje primio kao `@Query() dto: PaginationQueryDto`. Globalni `ValidationPipe` radi sa `forbidNonWhitelisted`, pa je ceo query string tada validiran protiv tog DTO-a i **svaki drugi filter je počeo da vraća `400 property status should not exist`** — svi filteri liste rezervacija bi prestali da rade. `tsc` čist, 997 testova prolazi, ništa nije upozorilo. Uhvaćeno tek pozivom pravog endpointa (zamka 5.13). Rešenje: pojedinačni `@Query('page')`/`@Query('limit')` uz ručnu proveru.

**Provereno na živom sistemu:** `?status=CONFIRMED&limit=5&page=2` → HTTP 200, „prikazano 6–10 od 12"; `?limit=999` → HTTP 400 sa jasnom porukom (limit se **odbija**, ne seče tiho — tiho svođenje na granicu je ista greška kao tiho odsecanje); `?page=0` → HTTP 400. Pet ekrana kroz pravu prijavu bez greške. 1.007 testova prolazi (10 novih zaključavaju baš računicu straničenja).

**Preostaje (u backlogu):** sedam preostalih mesta sa golim `take: 200` i sve ostale liste bez granice — obrazac postoji, primena je mehanička.

---

### 2.3 Usklađivanje BI podataka radi tri upita po svakoj stavci, nad neograničenim skupom — REŠENO 5.9.2026

`m13-bi/reconciliation/reconciliation.service.ts:40` uzme **sve** stavke rezervacija bez limita, pa u petlji za svaku uradi `findUnique` + `syncBookingItem` + još jedan `findUnique`.

Sa 10.000 stavki to je preko 30.000 upita u jednoj operaciji. Danas radi jer je baza mala.

**Predlog:** obrada u serijama (npr. po 500), sa jednim upitom po seriji umesto po zapisu. Isti obrazac postoji na još ~15 mesta u drugim servisima; ovaj je najizraženiji, pa neka bude prvi.
**Procena:** pola dana za ovaj, 1–2 dana za pregled ostalih.

---

**REŠENO 5.9.2026.**

**Ispravka brojke iz prvobitnog nalaza:** nije bilo „tri upita po stavci" nego **oko šesnaest**. Tri su bila vidljiva u samoj rekonsilijaciji; ostalo je bilo skriveno u `buildFactBookingData`, koje za svaku stavku posebno povlači proizvod, ugovor, dobavljača, klijentski nalog, subagenta, goste i kurs. Prvobitni nalaz je izbrojao samo ono što se vidi u jednoj funkciji — greška u istom rodu kao 8.4 (obim procenjen, ne prebrojan).

**Šta je urađeno:**
1. **Serije od 500 umesto svega odjednom.** Kretanje ide „kursorom" po `id`, ne `skip`-om — `skip` na velikoj tabeli tera bazu da prebroji i preskoči sve prethodne redove pri svakoj seriji, pa posao usporava što dalje odmiče.
2. **Jedan upit po seriji umesto dva po stavci** za stanje pre i posle (`findMany … in [ids]` umesto `findUnique` u petlji).
3. **Keš za jedan prolaz** (`FactSyncCache`) — proizvod/ugovor/dobavljač/klijent/kurs se ponavljaju kroz hiljade stavki; hiljadu rezervacija istog hotela značilo je hiljadu identičnih upita za tog dobavljača. Keš namerno **ne živi između prolaza**: rekonsilijaciji je ceo posao da uhvati promene u izvornim modulima, pa bi trajan keš značio ispravljanje projekcije na zastarelu vrednost.
4. **Čišćenje siročadi jednim SQL naredbom** umesto dovlačenja svih identifikatora sa obe strane u memoriju radi poređenja.
5. **Uplate se sada stvarno čiste** — `paymentsRemoved` je ranije samo BROJAO redove čiji izvor više ne kvalifikuje, a brisanje je zavisilo od toga da `syncPayment` naiđe na tu uplatu; uplata koja je u međuvremenu obrisana nije bila pokrivena nikako.

**Izmereno na živom sistemu, ista metoda na oba koda** (25 stavki + 13 uplata, `pg_stat_user_tables`, tri prolaza po verziji, uz pauzu da statistika Postgresa stigne — merenje bez te pauze daje lažno niske brojeve):

| | pretraga tabela po prolazu |
| :---- | :---- |
| pre | 395–451 |
| posle | 292–315 |

**Pošteno o veličini dobitka:** na 25 stavki to je oko **25% manje** — nije dramatično, i ne treba ga tako prikazivati. Većina preostalih upita je po prirodi jedinstvena za svaku stavku (sama stavka, njena rezervacija, njeni gosti, upis projekcije) i nju ni keš ni serije ne uklanjaju. Ono što se stvarno menja je **kako raste**: dosadašnji kod je učitavao ceo skup u memoriju i broj upita mu je rastao pravolinijski sa brojem stavki, a udeo keširanih pogodaka raste sa količinom podataka (agencija ima hiljade rezervacija, ali desetine dobavljača). Prava provera efekta je moguća tek nad stvarnim obimom podataka — do tada se ovo ne sme prijaviti kao „rešen problem performansi", nego kao uklonjen obrazac koji bi tamo pukao.

**Provereno:** rezultat rekonsilijacije nepromenjen (25 provereno, 25 projektovano, 0 siročadi), ponovljen prolaz javlja 0 ispravki (idempotentno), 1.012 testova prolazi.

**Nalaz koji je usput isplivao (zaveden, ne rešen):** `fact_payments` je prazan iako postoji 12 primljenih uplata — u bazi su samo 2 zapisa kursne liste i nijedan na dan uplate ili pre njega, pa projekcija ne može da se izgradi. Servis to pošteno loguje i odlaže za sledeći prolaz, ali izveštaji o naplati su zato prazni. Nije uzrokovano ovom izmenom.

---

### 2.4 Panel nema nijedan test, a CI ga uopšte ne dodiruje — (a) URAĐENO 5.9.2026, (b) čeka odluku vlasnika

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

**(a) URAĐENO 5.9.2026** — CI dobio drugi posao, `panel-web`: `tsc --noEmit` i `next build` za panel i sajt. Oba su pre uvođenja **pokrenuta lokalno** da se ne doda korak koji nije viđen kako prolazi (zamka 7.0) — panel i sajt se grade čisto.

**Uz to su tri dotad SAMO ZAPISANE zamke pretvorene u provere koje padaju same** — deo šireg dogovora sa vlasnikom (5.9.2026) da pravilo koje zavisi od sećanja nije prevencija. Dokaz da ne radi: zamka 7.1 postoji od 2.9.2026, a prekršena je 5.9.2026, tri dana kasnije.

| Provera | Zamka koju zamenjuje | Dokazano da hvata |
| :---- | :---- | :---- |
| `tools/provera-indeksa.mjs` | nalaz 2.1 se tiho vraća sa svakom novom relacijom | indeks uklonjen ručno → provera pala sa tačnim imenom tabele i kolone, pa vraćen |
| `tools/provera-use-server.mjs` | 7.1a — ruši ekran, `tsc`/`build` ćute | ubačena TAČNO ona konstanta koja je rušila ekran → provera je našla, pa uklonjena |
| `tools/check-contrast.js` | dizajn §2a — skripta je postojala od 2.9.2026, ali se pokretala samo kad bi se neko setio | prolazi nad trenutnim tokenima |

Obe nove provere su **prvo dokazane obaranjem** — nije dovoljno da ćute nad ispravnim kodom, moraju da progovore nad pokvarenim.

**Zatečeno usput:** `npm run lint` u panelu je pokvaren — `eslint-plugin-react` nije spojiv sa ESLint 10, `npx eslint .` puca. Skripta izgleda kao da radi dok se ne pokrene. Lint zato **nije** dodat u CI; popravka traži izmenu zavisnosti, pa čeka potvrdu. Zavedeno.

**(b) Testovi panela — ne mogu bez odluke vlasnika.** `@testing-library/react` je nova zavisnost, a `CLAUDE.md` traži izričitu potvrdu pre uvođenja bilo čega van postojećeg steka.

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

**5.1 Provera „mock ili pravo" na jednom mestu.** Nalaz 1.1 je nastao jer se prelazak sa mock-a na prave podatke desio na pola — tabela je prešla, dva sporedna ulaza u isti zapis nisu, i ništa to nije primetilo. Predlog: jedan popis (npr. `docs/analize/STANJE-EKRANA.md` ili tabela u M17 spec) sa jednim redom po ekranu: koristi mock / koristi API / delimično. Popunjava se u istom prolazu kad se ekran menja. Bez toga „delimično prešli" ostaje nevidljivo.

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

**Prvo (par dana):** ~~1.1 klik na rezervaciju~~ · ~~1.2 lažno „poslato" dobavljaču~~ · ~~2.1 indeksi~~ · ~~2.2 straničenje~~ · ~~2.3 N+1~~ · ~~2.4a `tsc`+`build` u CI~~ (sve urađeno 5.9.2026) · 2.4a `tsc`+`build` u CI · 2.5 stranice greške

**Zatim (nedelja):** 2.2 paginacija · 3.1 globalni guard · 3.2 ESLint za API · 2.3 N+1 · 3.4 preimenovanje „Stub"

**Pred lansiranje (uz hosting):** sve iz poglavlja 6 (nadogradnje, CORS, login limit, RLS) · 5.3 merenje na velikoj bazi

**Odluke koje su tvoje, ne tehničke:** 3.5 jedan ili dva AI asistenta · 3.6 da li je izgled pretrage potvrđen · 2.4b uvođenje `@testing-library/react`

---

*Nijedna izmena iz ovog dokumenta nije napravljena. Sledeći korak je tvoj izbor šta se radi i kojim redom.*
