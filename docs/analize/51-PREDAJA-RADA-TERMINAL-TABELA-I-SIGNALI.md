# Predaja rada — Terminal tabela, signali potražnje, popunjenost u uvozu

_Napisano 19.9.2026. na zahtev vlasnika, za agenta koji nastavlja. Nastavak na
[[48-PREDAJA-RADA-TIPOVI-SOBA-I-KREVETI]] (10.9.) i [[50-USKA-REVIZIJA-KODA-OD-7-9-2026]] (18.9.), koji pokrivaju sve pre ovoga._

---

## 1. Šta pročitati pre nego što išta uradiš

Ovim redom, ne preskačući:

1. **`CLAUDE.md`** — tvrdo pravilo (nema koda bez oslonca u specifikaciji), definicija „gotovo", ko je vlasnik. Nenad je **arhitekta, ne programer**: tehničke odluke donosiš sam i obrazlažeš ih, poslovne pitaš. Objašnjenja običnim jezikom.
2. **`docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`** — tabelu „Kratka lista pre posla" na vrhu. Za ovaj posao gledaj **9.12** (registracija taba pre obnove), **8.18** (zastareo panel posle pull-a), **11.3** (formatiranje pre push-a), **12.13** (migracija bez `migrate dev`).
3. **`docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md` §6e** — Terminal tabela: tri pravila (6e.1), ulaz i adresa (6e.2), funkcije a–k (6e.3), scenario (6e.4), stanje (6e.5).
4. **`docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md` §6.5.4.10** — alat `open_table`, registar izvora, kontekstna stavka `TABLE`.
5. **`docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md` §3.0k** i **M13 §4.4a** — signali potražnje i lijevak.
6. **`docs/analize/49-PREDLOG-YIELD-UPRAVLJANJE-MARZOM.md`** — ceo, naročito §6a (vlasnikovi odgovori) i §7 (šta sledi kad se odluči).
7. **`docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`** redovi „Terminal tabela", „Data platforma", „Ominimo lekcije" (vrh fajla, sekcija „Ideje van formalne specifikacije").

---

## 2. Gde se stalo

Sve od 19.9.2026, **CI zelen na poslednjem commit-u** (`gh run list`, `ed758bce`):

| Commit     | Šta nosi                                                                                                                        |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `d5921a32` | M3 v1.49 / M17 v2.81 — **odluka** §2.11p: uvoz/rečenica glavni put, ručna mreža je pregled + ispravka ćelije                    |
| `047a4356` | M5 v2.55 / M13 v1.21 — **predlog** signala potražnje (lijevak upit → prikazano → ponuda → otvoreno → rezervacija)               |
| `de7d0a79` | Vlasnikovi odgovori: Terminal tabela da; §3.0k sve tri da; dok. 49 §6a — marža **7–30 %**, ista cena M7/M8, čovek odobrava, oba |
| `47bde141` | M3 v1.50 — **kod**: popunjenost u uvozu cenovnika je ograničena vrednost (`occupancy_kind` + `occupancy_detail`)                |
| `b6fba238` | M5 v2.56 / M13 v1.22 / M15 v1.61 — **kod**: SearchLog dopuna, `SearchLogResult`, `Quote.searchLogId`, lijevak u panelu (BI tab) |
| `8c31bc17` | M17 v2.82 / M15 v1.62 / M13 v1.23 — **spec** Terminal tabele                                                                    |
| `d4a63439` | M15 v1.63 (API deo) — registar izvora, `TablesService`, `open_table`, dozvola `M13/scenario/USE`                                |
| `b7fc21d7` | M17 v2.83 — **ekrani** `/tabele` i `/tabele/prikaz`, scenario, „Otvori kao tabelu" u chatu, zamka 9.12                          |
| `ed758bce` | CI — ispravka reference na zamku                                                                                                |

Sve tri celine su **proverene uživo** na localhost-u (pretraga → 7 rezultata upisana sa lead-time 274 dana → ponuda vezana za pretragu → lijevak vidljiv u BI tabu; tabela 12 potvrđenih rezervacija sa grupisanjem i scenariom marža 18 %; AI „daj mi tabelu svih potvrđenih rezervacija" → `open_table` → sažetak 10.479,88 EUR tačan).

Testovi: M3 cenovnik 86/86, M13 lijevak 13, M15 tabele 14, panel `scenario.spec.ts` 8. Pun jedinični prolaz nije pokretan u celini ovog dana — **pokreni ga pre prvog svog commit-a** da znaš od čega polaziš.

Dev baza (Postgres na **5435**) ima seed: 39 rezervacija (12 CONFIRMED, 20 COMPLETED, 3 PENDING_SUPPLIER_CONFIRMATION, 2 MODIFIED, 2 CANCELLED), 236 proizvoda. `M15_OMNISEARCH` modul je **aktiviran ručno kroz API** da bi se testirao; BI terminal, web research i email compose moduli su i dalje `NOT_READY` — ako ti treba neki, aktiviraj ga kroz `PATCH /ai-orchestration/modules/<ID>/activation` (prvo `READY_FOR_ACTIVATION`, pa `ACTIVATED`) ili kroz panel.

---

## 3. Tri ideje koje se ne smeju izgubiti

**3.1 Tabela je PRIKAZ, ne izvor podataka (M17 §6e.1).** Ćelije se ne kucaju; podaci dolaze iz registra izvora (`table-sources.ts`) i svaki put se ponovo izvlače. Izvoz ide na server koji **ponovo** izvuče i primeni iste transformacije — server nikad ne prima gotove brojeve iz pregledača. Sabiranje, grupisanje, pivot, scenario radi kod; **model dobija samo sažetak** (kolone, zbirovi u osnovnoj jedinici novca, 5 redova), nikad celu tabelu. Ako neko traži „formulu po ćeliji", odgovor je: izvedena kolona u registru (`derived`), ne korisnička formula.

**3.2 Scenario menja parametre, ne ćelije, i ništa ne upisuje (M17 §6e.4).** Formule su u `apps/panel/src/lib/scenario.ts`, testirane. Samo Vlasnik/Direktor (`M13/scenario/USE`, dodeljuje seed). Popunjenost deluje **samo na zbirove**. Kad izvor nema nabavnu (maskiran pozivalac), marža i neto ostaju `null` — scenario ne izmišlja nabavnu.

**3.3 Cena je funkcija podataka, ali podataka još nema (dok. 49, Ominimo).** Signali se od 19.9. **beleže** (`SearchLog` + `SearchLogResult` + `Quote.searchLogId`). Yield (automatska marža u ogradama 7–30 %) je **spec-ovan ali čeka sezonu podataka** — vlasnik je to prihvatio. Ne kreći na kod yield-a dok nema bar jedne sezone stvarnih pretraga; bez toga agent nema od čega da uči i pravi se da radi.

---

## 4. Šta je sledeće, po redu

Vlasnik nije zadao sledeći zadatak pri predaji. Redosled dogovoren tokom dana:

### Korak 1 — čekati vlasnika (ne izmišljati posao)

Pri prvom javljanju **podseti ga na spisak iz poglavlja 8** — sam je tražio da bude podsećan.

### Korak 2 — Terminal tabela, poznati nedostaci (kad vlasnik kaže)

Svesno nije ušlo u prvi prolaz, zapisano u backlogu:

- **HTML izvoz dugmetom sa ekrana** — API (`POST /ai-orchestration/tables/export`, `format: 'html'`) ga ima, u `TerminalTable.tsx` su samo xlsx/pdf. Jedno dugme.
- **Više scenarija po tabeli (A/B)** — danas se scenario čuva kao jedan skup parametara uz tabelu; A/B traži niz scenarija u `TableSettings` i prikaz dve kolone Δ. Spec §6e.4 to pominje kao kasnije.
- Kasnije funkcije (§6e.3 6–9 iz spiska u backlogu): akcija nad izabranim redovima kroz AI, zakazana tabela, beleška na redu, „šta se promenilo od prošlog otvaranja". **Svaka traži spec dopunu i potvrdu pre koda.**

### Korak 3 — yield (dok. 49 §7) — TEK POSLE SEZONE PODATAKA

Kad vlasnik kaže „sada": §7 tačno nabraja šta se dopunjuje (M5 §2.1 polja i ograde, M15 §6.9 `YieldAgent`, M17 dva ekrana, M13 izveštaj, M18 signal `YIELD_PROPOSAL_EXPIRED_UNSEEN`). Sve u jednom prolazu spec-a, pa kod. Vlasnikove ograde su već u §6a — ne pitaj ponovo ono što je odgovorio.

### Korak 4 — data platforma (backlog red 20) — čeka vlasnikov spisak spoljnih ulaza

Ne kreći dok vlasnik ne imenuje ulaze (kurs, letovi, praznici ciljnih tržišta, prognoza, konkurencija…). Konkurencija/scraping i dalje čeka pravnika (M5 §13, M15 §6.5.6a).

---

## 5. Zatečeno stanje — zapisano, ne sakriveno

**5.1 `SearchLog.clientAccountId` je uvek `null`.** Pretraga iz panela nema klijenta u trenutku upita (klijent se bira tek na ponudi). Lijevak po klijentu zato ne radi. Popuni se kad se ponuda veže (`Quote.searchLogId` postoji, ali obrnuto ažuriranje nije napravljeno).

**5.2 „Otvoreno" u lijevku broji samo API pregled od strane kupca** (`quotes.findOne` uvećava `sharedViewCount` kad pozivalac nije `INTERNAL_PANEL`). Deljeni link ponude (M5 §3.1a) **nema kod**, pa se javni pregled ne meri. Kad se 3.1a napravi, tamo pozvati isti brojač.

**5.3 Popunjenost u uvozu cenovnika nije proverena na stvarnom dokumentu posle izmene.** Testovi prolaze (86/86), ali uslov iz izlaznog kriterijuma M3 — uvesti isti stvarni cenovnik dvaput i dobiti „bez izmena" — nije ponovljen posle v1.50. Primeri su u folderu iz memorije „Primeri cenovnika" (van gita). **Uradi to pre nego što bilo šta dalje diraš u `pricelist-extraction.service.ts`.**

**5.4 Panel testovi:** `scenario.spec.ts` je jedini jedinični test u `apps/panel/src/lib` za tabelu; `TerminalTable.tsx` (sort/filter/pivot/semafor) nema testove — proveren samo uživo. Ako budeš menjao pivot ili filter po koloni (`>=`, `<=`, `a-b`), prvo napiši test za trenutno ponašanje.

---

## 6. Zamke koje su koštale vremena baš u ovom poslu

**Registracija taba pre obnove (9.12, nova).** `useRegisterTab` je pucao pri punom učitavanju stranice jer se izvršio pre nego što je `TabsContext` obnovio tabove iz skladišta — obnova ga je pregazila. `TabsContext` sada izlaže `hydrated`; svaki novi ekran koji registruje tab mora da čeka na njega. Tab se registruje sa **punom adresom** (`pathname?searchParams`), inače dve tabele sa različitim spec-om dele jedan tab.

**Model čita novac u para/centima kao milione.** Sve što ide modelu kao sažetak mora biti u **osnovnoj jedinici** (EUR, ne cent). Prvi nacrt je dao „1.048M EUR" za 10.479 EUR. Test u `tables.service.spec.ts` to sada čuva.

**Model postavlja potpitanje umesto da pozove alat.** Za `open_table` prompt eksplicitno kaže „pozovi ODMAH, ne postavljaj potpitanja" — inače na „daj mi tabelu" model pita „koje kolone želite?". Isti obrazac važi za svaki novi alat koji treba da se pozove na prvi zahtev.

**`report`/`table` nisu stizali uz tekstualni odgovor.** `omnisearch.service.ts` je vraćao te kanale samo u grani sa alatom; grana sa tekstom ih je gubila — link za `generate_report` nikad nije stizao. Ispravljeno; ako dodaješ nov kanal odgovora, proveri **obe** grane.

**Zastareo panel posle `git pull` (8.18).** Ako panel na 3100 prikazuje staru verziju: ubij proces na portu, obriši `apps/panel/.next/cache` i `.next/dev`, pokreni ponovo.

**Prettier samo nad izmenjenim fajlovima (11.3).** Mašina je CRLF; `prettier --check .` lokalno laže. Za svaki stagovan fajl uporedi `git show ":$f"` sa `npx prettier --stdin-filepath "$f"`. CI pored toga vrti `check-contrast.js`, `provera-zamki.mjs` (svaka referenca „zamka N.N" mora postojati u dok. 33 — na ovo je pao `b7fc21d7`), `provera-api-dok.mjs` (svaka ruta traži primer u `docs/api`), lint (`react/no-unescaped-entities` → `&bdquo;…&ldquo;`).

**Skripte za izmenu dokumenata pisati u fajl, ne kroz heredoc.** Bash heredoc lomi `"`, `„…"`, `§` i `\n`. Python skriptu upiši Write alatom u scratchpad pa pokreni `python -X utf8`.

**Migracija:** `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` iz `apps/api`, SQL rukom u folder migracije, `migrate deploy`, pa ponovo `diff` mora dati „empty migration". **Nikad `DATABASE_URL` kao `--shadow-database-url`** — to je 8.9. obrisalo celu dev bazu.

---

## 7. Šta NE raditi

- **Ne dodaj ručni unos u ćeliju tabele.** To je prva stvar koju bi neko „usavršio", i prva koju spec zabranjuje.
- **Ne šalji modelu redove tabele.** Sažetak, i to je sve. Ako model „ne zna dovoljno", proširi sažetak (npr. grupni zbirovi), ne šalji podatke.
- **Ne kreći na yield kod** pre sezone podataka, ni ako deluje da je „sve već spec-ovano".
- **Ne uvodi novi dashboard/ekran za analitiku** — Terminal tabela + BI tab su mesto; dok. 22 pouka o četiri monitoring ekrana.
- **Ne postupaj po sopstvenom predlogu bez vlasnikovog „saglasan".** Vlasnik je 19.9. izričito zaustavio sesiju koja je nastavila da radi po svom predlogu bez pitanja: _„sačekajte… niste me pitali da li sam saglasan"_. Predlog → pitanje → tek onda spec/kod.
- **Nikad `git add -A`** — u istom stablu radi i drugi agent (18.9. je tuđi commit `12ff2f1` oborio CI). Staguj imenovane putanje; posle push-a proveri `gh run list`.

---

## 8. Šta vlasnik duguje — podseti ga pri prvom javljanju

Sam je tražio: _„posle ovoga me opet podsetite šta treba da vam kažem"_.

| Šta                                                                      | Zašto čeka                                                                                 |
| :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **20 stvarnih mejlova dobavljača** (ponude, potvrde, cenovnici u tekstu) | Merenje tačnosti tekstualnog uvoza — bez uzoraka stoji „nemereno" (memorija: traži uzorke) |
| **SMTP pristupni podaci** (`SMTP_HOST/PORT/USER/PASSWORD`, `MAIL_FROM`)  | Slanje pošte je gotovo i provereno; poruke se loguju, ne šalju (backlog red 159)           |
| **Spisak spoljnih tržišnih ulaza** za data platformu                     | Bez imenovanih ulaza korak 4 iz poglavlja 4 nema od čega da krene                          |
| **Jedan stvarni cenovnik za dvostruki uvoz** posle v1.50                 | Zatvara nalaz 5.3                                                                          |
| `ANTHROPIC_API_KEY`, lozinka/MFA Vlasnika, EU hosting                    | Isto kao u dok. 48 §8 — pitaj, ne pretpostavljaj                                           |

---

## 9. Poslednja napomena

Vlasnik prati rad kroz kratke izveštaje i **postavlja poslovna pitanja usput** (video, ideja o data platformi, Terminal tabela — sve u jednom danu). Kad da ideju: prvo mišljenje u tri rečenice, pa **pitaj da li da se upiše**, pa upis u backlog, pa spec, pa kod — svaki korak posle njegove reči. Kad izveštavaš: jedan nalaz po pasusu, merenje umesto tvrdnje, jedan predložen sledeći korak.
