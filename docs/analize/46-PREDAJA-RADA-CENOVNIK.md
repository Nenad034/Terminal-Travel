# Predaja rada — cenovnik kao mreža (stanje 9.9.2026)

**Kome:** sledećem agentu/sesiji koja preuzme repozitorijum sa GitHub-a i nastavlja rad na cenovniku (M3 §2.11).
**Zašto postoji:** posao je urađen do trećeg od sedam koraka. Tri koraka su u kodu i proverena nad pravom bazom, četiri stoje samo u specifikaciji. Uz to postoje **tri mesta gde kod postoji ali nije povezan sa prodajom** — to se iz commit poruka ne vidi, a bez toga bi se prvo pomislilo da je gotovo.

**Ovo nije zamena za specifikaciju.** Sve odluke i obrazloženja su u M3 §2.11 i §4.8; ovde stoji samo **gde se stalo, šta je sledeće, šta je već pokušano i šta izgleda gotovo a nije**.

---

## 1. Pročitaj ovo pre nego što išta pipneš

Redosled je bitan, ne preskači:

1. `CLAUDE.md` u korenu — tvrdo pravilo „nema koda bez oslonca u specifikaciji", i kako se komunicira sa vlasnikom (nije programer: tehničke odluke se donose i obrazlažu, ne prebacuju njemu; poslovne se pitaju).
2. Skill `tt-m3-ugovaranje-alotmani` → `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md`, poglavlje **2.11 u celini** (2.11a–2.11o) i **4.8**. To je ceo model.
3. `docs/moduli/M03-ugovaranje-alotmani/04-MOCKUP-UNOS-CENOVNIKA-MREZA.html` — **otvori ga u pregledaču**, ne čitaj kao kod. Tu su četiri ekrana i tabela **odluka vlasnika** sa obrazloženjima. Nemoj ih ponovo otvarati kao pitanja.
4. `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`, poglavlje **6d** — ekrani.
5. `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md` — tabela na vrhu; obavezno redovi za **7.7** (e2e nad svežom bazom), **7.9** (transakcije), **7.10** (dekorator parametra), **7.11** (`curl -d` i naša slova). Poslednje tri su nastale baš u ovom poslu.
6. `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, sekcija „Ideje van formalne specifikacije" — tamo stoji **otvoreno pitanje o proviziji subagenta** sa izračunatim varijantama. Vlasnik je odlučio da za sada ostane kako jeste; ne diraj bez novog pitanja.

---

## 2. Zašto je ovaj posao uopšte počeo

Vlasnik je 9.9.2026. otvorio postojeći ekran za unos cena (`/ugovori/:id/periods/:periodId`) i rekao: _„Previše zbrkano, nedostaju polja… na osnovu toka treba osmisliti logičan i brz ručni unos."_

Uzrok **nije bio model nego jedinica ekrana**: `ContractPeriod` je jedan datumski opseg za jedan tip sobe, pa hotel sa 5 soba i 6 sezona traži 30 poseta tom ekranu.

Provera nad **58 stvarnih cenovnika** u folderu `Primeri cenovnika/` (u korenu repoa, **van git-a** — lako se previdi) pokazala je da nijedan dobavljač tako ne piše cenovnik. Pročitana su tri oblika i sva tri su ista stvar — **tipovi soba kao redovi, sezone kao kolone**:

| Dobavljač                    | Oblik             | Šta je iz njega naučeno                                      |
| :--------------------------- | :---------------- | :----------------------------------------------------------- |
| Aycon (Crna Gora)            | PDF mreža         | sezona ima **više** opsega; osnova cene se razlikuje po redu |
| Plava Laguna / Meeting Point | PDF spisak redova | `Rate Base = STAY`; kolone `S M T W T F S` za dane dolaska   |
| Solvex (Bugarska)            | Excel             | red je **kombinacija popunjenosti** („1 Adult + 1 Chd")      |

**Ako ti zatreba još primera — čitaj ih odatle, nemoj pretpostavljati.** PDF se čita preko `pdf-parse` iz `node_modules` (`new PDFParse({data}).getText()`), Excel preko `exceljs`; oba su već instalirana.

---

## 3. Šta je stvarno GOTOVO (kod postoji, proveren nad pravom bazom)

| Šta                                                                                      | Gde                                                              |
| :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `Season` + `SeasonRange`, `ContractPeriod.season_id`                                     | `schema.prisma`, migracija `..._v127` (`20260909132839`)         |
| `PriceBasis` proširen na četiri vrednosti                                                | ista migracija                                                   |
| `booking_from`/`booking_to` na `RateLine`/`AncillaryService`/`CancellationRule`          | ista migracija                                                   |
| Domet doplate + uzrast + `applies_from/to`                                               | migracija `20260909143215`                                       |
| `MarkupScopeType` += `M3_RATE_LINE`/`M3_ANCILLARY_SERVICE`, `SubagentCommissionOverride` | migracija `20260909150251`                                       |
| `PricelistService` — sezone, mreža, doplate, pravila marže/provizije                     | `apps/api/src/modules/m3-ugovaranje-alotmani/pricelist/`         |
| Čista logika: `season-ranges.ts`, `surcharge-scope.ts`, `subagent-commission.ts`         | isti folder, svaki sa sopstvenim `.spec.ts`                      |
| Cena po BORAVKU se ne množi noćenjima                                                    | `m5-rezervacije/common/occupancy.ts` (`jePoBoravku`, `jePoSobi`) |
| Ekran `/ugovori/:id/cenovnik` sa tri kartice                                             | `apps/panel/src/app/(app)/ugovori/[id]/cenovnik/`                |

Commitovi: `a5d315f` (korak 1), `88d8325` (korak 2), `8ae927b` (korak 3). CI zelen na svakom.

**Provereno uživo nad pravom bazom** (ugovor `TT-MOCK-CAP-02`, Hotel Splendid): sezona sa dva opsega → jedna ćelija upisuje cenu u **dva** perioda; ispravka gasi staru i pravi novu sa `replaces_id`; `PER_ROOM_PER_STAY` upisan i pročitan; šest doplata iz Aycon cenovnika, od kojih tri takse **ne ulaze u zbir**; dva izuzetka marže/provizije od 13 stavki.

---

## 4. ⚠️ Šta izgleda gotovo a NIJE povezano — pročitaj pre nego što javiš da radi

Ovo su tri prave rupe. Sve tri su **namerno ostavljene** jer pripadaju M5 toku prodaje, ne unosu cenovnika — ali nijedna nije prećutana i sve tri su u izlaznom kriterijumu.

### 4.1 Doplata šireg dometa se NE VIDI pri prodaji

`BookingsService.listAvailableAncillaries` (oko linije 1769 u `bookings.service.ts`) čita doplate ovako:

```text
include: { contractPeriod: { include: { ancillaryServices: true } } }
```

To vraća **samo doplate vezane za taj period**. Doplata uneta na novom ekranu sa dometom „ceo ugovor" ili „sezona" ima `contract_period_id = null` i **neće se pojaviti prodavcu**.

Posledica je konkretna: boravišna taksa uneta danas na ugovor Hotel Splendid **ne stiže do ponude**. Na ekranu cenovnika se vidi, u prodaji ne.

**Šta uraditi:** taj upit mora da čita po `contractId` i da filtrira kroz `vazi()` iz `pricelist/surcharge-scope.ts` (funkcija postoji i ima 18 testova, ali je **niko ne poziva**). Kontekst koji joj treba — tip sobe, dan boravka, dan rezervacije, uzrast gosta — M5 već ima na stavci rezervacije.

### 4.2 Marža po pojedinačnoj stavci se upisuje, ali se ne primenjuje

`MarkupRulesService.resolveForContracted` **prima** `rateLineId` i stavlja `M3_RATE_LINE` na vrh kaskade — ali **nijedan pozivalac ga ne prosleđuje**. Tri mesta koja ga zovu:

- `quotes/quote-item-builder.service.ts:333`
- `search/search.service.ts:578`
- `search/search.service.ts:729`

Sva tri imaju `rateLine` pri ruci. **Dodavanje je jedan red po pozivaocu**, ali svaki menja cenu koja se prikazuje gostu — pa ide uz testove i uz merenje pre/posle, ne „usput".

### 4.3 Subagentska provizija po stavci nigde se ne obračunava

`pricelist/subagent-commission.ts` je čista logika sa 18 testova i **nula pozivalaca**. Nema veze ni sa M7 ni sa M5.

Pre nego što se poveže, treba znati **gde se provizija subagenta uopšte obračunava danas** — u M7 ili u M5 pri pravljenju ponude. To nisam proveravao; ne pretpostavljaj, pogledaj.

### 4.4 Prozor „za rezervacije od…do" na ceni se upisuje, ali M5 ga ne čita

Polje postoji na `RateLine` i potvrđeno je u bazi (`booking_to = 2026-12-31`), ali pretraga i sastavljanje ponude ga ne gledaju. Cena koja je istekla i dalje bi se ponudila.

---

## 5. Šta je sledeće — koraci 4 do 7

Redosled je vlasnikov i svaki korak je upotrebljiv sam za sebe.

### Korak 4 — Dani u nedelji i turnusi (M3 §2.11d)

Model **još nije dodat**. Treba:

- `RateLine.valid_weekdays: Int[]` (1–7, prazno = svi dani)
- `ContractPeriod.arrival_weekdays`, `departure_weekdays`, `allowed_stay_nights: Int[]`
- Provera pri čuvanju: unutar iste kombinacije (period × soba × usluga × popunjenost) **svaki dan mora biti pokriven tačno jednom**. Nepokriven dan tiho nestaje iz pretrage; dvaput pokriven daje dve cene za isti datum.

**Vlasnikova odluka koju ne smeš da promeniš:** dani se biraju **kao tagovi**, ne kao fiksna podela „radni dani / vikend". Pojam „vikend" ne postoji u sistemu — kod njih je to petak i subota (nedelja se ne računa), ali se razlikuje po hotelu. Vikend cena je **drugi cenovni red sa drugim danima**, ne nova sezona.

### Korak 5 — Verzije cenovnika (M3 §2.11l)

Nov zapis `PricelistVersion` (`contract_id`, `version_no`, `effective_from`, `created_by`, `source_import_id?`, `instruction_text?`). Nova verzija **ne briše staru**. AI poredi novu sa prethodnom i prikazuje **samo razlike**; čovek potvrđuje razlike, ne ceo cenovnik.

Vlasnik je izričito rekao: hotel šalje **ceo nov cenovnik**, ne spisak izmena.

### Korak 6 — Kalendar cena i raspoloživosti (M3 §2.11o, M17 §6d.4)

Pregled, **ne unos**. Bira se hotel, tip sobe i sastav gostiju; kalendar po danu prikazuje cenu za taj sastav i **broj slobodnih jedinica** (vlasnikova odluka: samo slobodno, ne „4 od 6"). Ne uvodi nov zapis — čita `/capacity/grid` i cenovnik.

### Korak 7 — Izmena cenovnika rečima (M3 §4.8)

Poslednji, jer se oslanja na verzije. `PROPOSE_THEN_APPROVE`, akcija `pricelist.edit_from_instruction` (već upisana u M15 §4). Četiri ograde su u specifikaciji; najvažnija: **rečenica koja je izmenu tražila čuva se uz rezultat**, isto kao izvorni tekst kod uvoza.

---

## 6. Odluke vlasnika koje NE otvaraj ponovo

Sve su donete 9.9.2026, u razgovoru, i upisane u spec. Ako ti neka izgleda čudno — obrazloženje je uz nju, ne izmišljaj novo.

| Pitanje                       | Odluka                                                                          |
| :---------------------------- | :------------------------------------------------------------------------------ |
| Sezone — ime ili broj?        | **Vide se datumi** u zaglavlju kolone                                           |
| Vikend                        | **Dani kao tagovi**, ne fiksna podela                                           |
| Redosled obračuna             | popust → **provizija hotela** → marža → provizija subagenta                     |
| Provizija hotela              | **po periodu** (10% u jednom, 7% u drugom), ne jedna po ugovoru                 |
| Osnovica popusta po osobi     | **ulazna hotelska osnovna cena**                                                |
| Što se plaća u hotelu         | **ne ulazi u fakturisanje**, samo se prikazuje gostu                            |
| Kalendar                      | **samo slobodno**, bez „4 od 6"                                                 |
| Izmena cenovnika              | ceo nov cenovnik + AI koji poredi verzije                                       |
| Ugovor za subagenta           | dva ispisa, razlika **samo u izostavljenoj proviziji** → posao za **M7**, ne M3 |
| Kapacitet na ekranu cenovnika | **ne** — ide po sopstvenim datumima, nezavisno od sezona                        |
| Osnovica provizije subagenta  | **bruto (prodajna) cena**, „za sada… pa ćemo videti za kasnije"                 |

---

## 7. Nerešeno, sa razlogom

- **Provizija subagenta jede maržu.** Izmereno: marža 20% + provizija 10% → agenciji ostaje 8,00, subagentu 12,00. Tri varijante preračuna (podela na pola / oba po istom procentu / provizija dodata na maržu) su izračunate i stoje u backlogu. Vlasnik je odlučio da **za sada ostane kako jeste**. Vraća se čim se pojavi subagent sa visokom provizijom — nemoj ga sam „popravljati".
- **Provizija hotela po periodu (§2.11f)** je specifikovana ali **nije implementirana**. `Contract.commission_percentage` je i dalje jedna vrednost po ugovoru. Gradi se po `scopeType`+`scopeId` obrascu, kao `MarkupRule`.
- **Migracija postojećih `TouristTaxInfo` u `AncillaryService`** (§2.11j) — jednokratna, još nije urađena. Do tada oba oblika koegzistiraju.
- **Tip sobe je i dalje slobodan tekst.** Ekran nudi predloge kroz `datalist`, ali strogi FK ka M2 nije uveden (§2.11m).

---

## 8. Kako da proveriš da nisi ništa pokvario

Ovim redom, bez preskakanja — svaki korak je već jednom uhvatio pravu grešku:

```bash
cd apps/api && npx tsc --noEmit -p tsconfig.json     # uhvatio je da M5 ne zna nove osnove cene
cd apps/api && npx jest                               # 1311 testova
cd apps/panel && npx tsc --noEmit -p tsconfig.json
npx prettier --check .                                # CI pada baš ovde ako preskočiš
```

**E2E ide isključivo nad SVEŽE napravljenom bazom** (zamka 7.7) — tri koraka posle migracija nisu ukras:

```bash
docker exec terminaltravel-postgres-1 psql -U terminal -d postgres \
  -c "DROP DATABASE IF EXISTS terminal_e2e;" -c "CREATE DATABASE terminal_e2e OWNER terminal;"
cd apps/api
export DATABASE_URL="postgresql://terminal:terminal_dev_only@localhost:5435/terminal_e2e?schema=public"
npx prisma migrate deploy
npx prisma db execute --file prisma/sql/audit_log_append_only.sql --schema prisma/schema.prisma
npx prisma db seed
npx jest --config ./test/jest-e2e.json --runInBand
```

Očekivano: **22 paketa / 253 testa**. Ako padne M1 „append-only", preskočio si drugi korak.

**Posle svakog push-a proveri CI** (`gh run list --limit 1`, gh je u `%LOCALAPPDATA%\gh-cli\bin\gh.exe`). U ovom poslu je CI pao **tri puta uzastopno** i sva tri puta zbog `prettier --check` nad ručno pisanim dokumentima — ne zbog koda.

---

## 9. Sitnice koje će te zaustaviti ako ih ne znaš

- **`prettier --check docs/` lokalno prijavljuje ~89 fajlova** zbog CRLF u radnom stablu; CI na Linuxu vidi LF i prijavljuje samo stvarno neformatirane. Oslanjaj se na `--write` nad fajlovima koje si menjao, ne na broj iz `--check`.
- **`curl -d` iz Git Bash-a na Windowsu uništi naša slova** pre slanja (zamka 7.11). Telo sa ne-ASCII sadržajem piši u fajl iz Node-a i šalji sa `--data-binary @fajl`. Inače ćeš prijaviti lažan kvar „aplikacija kvari slova".
- **`@CurrentUser('sub')` ne radi** — dekorator ignoriše argument i vraća ceo objekat, a `tsc` to ne hvata (zamka 7.10). Ispravno je `@CurrentUser() actor: { userId: string }`.
- **`prisma generate` javlja EPERM** dok dev server radi (zamka 12.2). Benigno ako se novi tipovi pojave u `node_modules/.prisma/client/index.d.ts` — proveri `grep`-om, ne pretpostavljaj.
- **Dev prijava:** `vlasnik@terminal-travel.local`. Lozinka i MFA tajna **nisu u repou** — traži ih od vlasnika. Ruta `/api/session/dev-login` u panelu pokazuje na nalog koji više ne postoji i vraća 500; prijavljuj se kroz pravi tok (`/api/session/login` → `/api/session/mfa`).
- **Paralelan agent radi u istom stablu.** Nikad `git add -A` — staguj samo imenovane putanje.

---

## 10. Šta je ostavljeno u bazi kao demonstracija

Na ugovoru `TT-MOCK-CAP-02` (Hotel Splendid) namerno stoje probni podaci da vlasnik vidi kako ekran izgleda:

- sezona „1 — Predsezona" sa dva opsega (01.04–31.05 i 01.10–31.10, 2027)
- dva cenovna reda: Budget double room 39,00 po osobi/noć; Deluxe suite 950,00 **po sobi/boravku**
- šest doplata iz Aycon cenovnika (tri takse `ON_SITE`, večera, popust za 3. osobu, rana rezervacija)
- dva izuzetka marže/provizije

**Ovo su mock podaci, ne stvarni cenovnik.** Ako smetaju, mogu se obrisati — ali pitaj vlasnika pre brisanja, jer je izričito tražio da vidi rezultat na ekranu.
