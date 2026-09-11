# Predaja rada — tipovi soba, kreveti i raspored osoba

_Napisano 10.9.2026. na zahtev vlasnika, za agenta koji nastavlja. Nastavak na
[[47-PREDAJA-RADA-CENOVNIK-ZAVRSEN]], koji pokriva sve pre ovoga._

---

## 1. Šta pročitati pre nego što išta uradiš

Ovim redom, ne preskačući:

1. **`CLAUDE.md`** — tvrdo pravilo (nema koda bez oslonca u specifikaciji), definicija „gotovo", i ko je vlasnik. Nenad je **arhitekta, ne programer**: tehničke odluke donosiš sam i obrazlažeš ih, poslovne pitaš. Objašnjenja idu **običnim jezikom, bez žargona**.
2. **`docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`** — tabelu „Kratka lista pre posla" na vrhu. Za ovaj posao gledaj redove **7.7** (e2e nad zasebnom bazom), **7.12** (funkcija bez pozivalaca), **7.14** (fallback koji isključi proveru), **11.3** (formatiranje pre push-a).
3. **`docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` §2.3b i §2.3g** — kreveti i matrica kombinacija. **§2.3g je glavni posao koji sledi.**
4. **`docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` §2.4a i §2.11m** — cena po uzrastu, šta znači „1. dete", i šifarnik tipova soba.
5. **`docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md` §3.2a i §3.2b** — gde se sve to sreće u prodaji.

---

## 2. Gde se stalo

Tri commit-a, **sva tri sa zelenim CI-jem** (provereno `gh run list`, 10.9.2026):

| Commit     | Šta nosi                                                                                |
| :--------- | :-------------------------------------------------------------------------------------- |
| `c21579b`  | Zamka 7.13 — e2e čeka na ishod, ne na sat; usput otkriven pogrešan uslov u M18          |
| `dc5c92a2` | M2 v1.16 / M3 v1.40 / M5 v2.50 — **specifikacija** rasporeda po krevetima i „1. deteta" |
| `48dc155d` | M3 v1.41 — **kod**: tip sobe se bira iz šifarnika                                       |

Stanje testova u trenutku predaje: **1494 jedinična** (158 paketa) i **270 e2e** (25 paketa), sve prolazi nad **sveže napravljenom** bazom.

---

## 3. Jedna ideja koja se ne sme izgubiti

Ovo je suština celog posla i vlasnikov je nalaz, ne moj. Ako zaboraviš sve ostalo iz ovog dokumenta, ovo zapamti:

> **Raspored osoba po krevetima je fizičko svojstvo SOBE. Kategorije osoba su svojstvo CENOVNIKA.**

Soba 2+1 prima „2 odrasle + 1 dete" bez obzira da li cenovnik deli decu na jednu kategoriju (`CHD` 2–12) ili na tri (`CHD1` 2–7, `CHD2` 7–12, `INF` 0–2). Zato matrica kombinacija u katalogu **nikad ne nosi kategorije iz cenovnika** — nosi samo **ulogu na krevetu**: odrasla osoba / dete / dete koje deli krevet.

Veza između to dvoje su **godine gosta**, ne naziv kategorije. Isti broj, dva nezavisna pitanja:

- _Gde sme da spava?_ → pita se soba (`extra_bed_max_age`, `shares_bed_max_age`)
- _Koliko košta?_ → pita se cenovnik (`age_pricing[]`)

**Tako je PrimeTravel pogrešio** (`/d/PrimeTravel-17.04.2026/src/components/PropertyWizard/steps/RoomsStep.tsx` + `src/utils/pricingRulesGenerator.ts`): njihova matrica je označena kategorijama (`2ADL_1CHD`), a generator ima `CHD1`/`CHD2`/`CHD3` zakucane u tip. Njihova matrica važi za jedan cenovnik i pravi se iznova za svaki sledeći. Vredi pogledati njihov ekran zbog **izgleda** (tabela sa prikazom ko na kom krevetu leži je stvarno dobra), ali ne zbog modela.

**Kod nas se matrica cena ne čuva — ona ispada.** Cena za „2 odrasle + CHD1 + CHD2" se računa po gostu iz `age_pricing[]` pravila. Nova kategorija zato ne traži ponovni unos nijednog reda. Ne uvodi zapis koji čuva gotove kombinacije sa cenama — time bi se ta prednost izgubila.

---

## 4. Šta je sledeće, po redu

Vlasnik je odobrio tri koraka. **Prvi je gotov.**

### ~~Korak 1 — most šifara~~ (gotovo, v1.41)

### Korak 2 — matrica kombinacija u katalogu (SLEDEĆE)

**Specifikacija postoji i potvrđena je: M2 §2.3g.** Ne piši kod dok je ne pročitaš celu — tamo su i granice koje su svesno postavljene.

Šta treba:

- **Model:** `bed_combinations[]` unutar svake `room_types[]` stavke (JSONB `attributes`, bez migracije). Polja: `key` (`{odraslih}A_{dece}C`), `allowed`, `shared_bed_children`, `note`.
- **Čista funkcija** koja iz `beds` izvodi matricu — svaki ukupan broj osoba od `min_occupancy` (ili 1) do `base_beds + extra_beds_max`, i za svaki sve podele na odrasle i decu. Raspoređivanje je determinističko: **odrasli redom pune osnovne krevete, pa pomoćne; deca zauzimaju ono što preostane.**
- **Ekran** u `RoomTypesEditor.tsx` (`apps/panel/src/app/(app)/katalog/[id]/`) — tabela sa prikazom ko na kom krevetu leži, kvačica „dozvoljeno", kvačica „dete deli krevet".

**Tri stvari koje se lako promaše:**

1. **Prazan niz znači „sve dozvoljeno", ne „ništa"** — čuvaju se samo odstupanja. Pun spisak bi zastareo čim se promeni broj kreveta.
2. **Zapis čiji se `key` više ne izvodi iz matrice se PRIJAVLJUJE i ignoriše, ne briše tiho.**
3. **Uzrasne granice se ovde ne čuvaju.** Matrica govori _koliko_ dece sme, `extra_bed_max_age` govori _koje_. To se razrešava pri rezervaciji, ne pri unosu sobe.

### Korak 3 — uključiti proveru u prodaju

Tek posle koraka 2. Detalji u odeljku 5 — to su zatečeni nalazi, ne nov posao koji izmišljaš.

---

## 5. Zatečeno stanje — zapisano, ne sakriveno

Dva nalaza iz 10.9.2026, oba izmerena pretragom po kodu, oba upisana u izlazni kriterijum M5 (§13) i u backlog:

**5.1 `assertRoomCapacity` ima šest jediničnih testova i NULA proizvodnih pozivalaca.**
Provera „staje li ta grupa u tu sobu" postoji u `apps/api/src/modules/m5-rezervacije/common/occupancy.ts:147`, potpuno je napisana (poštuje `counts_toward_capacity`, `max_count`), i **niko je ne zove**. Pretraga i sastavljanje ponude idu pravo na obračun cene. Četvoro u dvokrevetnoj sobi danas prođe bez reči. Ovo je peti primer zamke 7.12 u ovom repozitorijumu.

**5.2 Kad se tip sobe ne pronađe, kapacitet postaje 99.**
`search.service.ts:578` i `quote-item-builder.service.ts:369` uzimaju `{ capacityAdults: 99, capacityChildren: 99 }` kao fallback. To nije podrazumevana vrednost sa poslovnim značenjem nego vrednost izabrana da ništa ne padne — isto kao brisanje provere, samo nevidljivo. **Mora postati jasno odbijanje**, isti princip koji već važi za cenu (M3 §2.4a: cena se nikad ne pretpostavlja).

Do v1.41 je ta grana bila **jedina koja se izvršavala**, jer se šifra sobe nije poklapala nikad. Sada se poklapa — zato korak 3 tek sada ima smisla.

**5.3 Redni broj deteta dolazi iz redosleda kojim su godine ukucane.**
`classifyRoomGuests` prolazi kroz `children_ages[]` **redom kako je stiglo**, pa ista porodica dobija različitu cenu za „9, 5" i „5, 9". Rešenje je specificirano (M3 §2.4a: `child_counting_basis` i `child_order`, podrazumevano „sva deca zajedno" + „starije prvo", **obe vrednosti potvrdio vlasnik**), nije implementirano.

---

## 6. Zamke koje su koštale vremena baš u ovom poslu

**Formatiranje pre push-a (11.3).** Lokalni `prettier --check .` na Windowsu prijavljuje preko hiljadu lažnih padova (CRLF u radnoj kopiji). Proveri sadržaj **onako kako ga CI vidi** — za svaki stagovan fajl uporedi `git show ":$f"` sa izlazom `npx prettier --stdin-filepath "$f"`; razlika znači stvaran pad.

`schema.prisma` će uvek pokazati razliku — Prettier za `.prisma` nema parser, a `prettier --check .` ga preskoči. Nije pad.

**Fajl menjan skriptom nije formatiran.** Četiri fajla su prošla kroz Python izmenu i pala na toj proveri. Posle svake skriptovane izmene pokreni `prettier --write` nad tim fajlom.

**E2E se pokreće nad bazom napravljenom IZNOVA (7.7),** ne nad razvojnom i ne nad već korišćenom. Redosled: `DROP DATABASE` + `CREATE DATABASE terminal_e2e` → `DATABASE_URL` na tu bazu → `prisma migrate deploy` → `prisma db execute --file prisma/sql/audit_log_append_only.sql` → `prisma db seed` → `jest --config ./test/jest-e2e.json --runInBand`. Tačne komande su u zamci 7.7. `--runInBand` je obavezan lokalno; pun prolaz traje oko četiri minuta.

**E2E test ne sme da čeka fiksan broj milisekundi (7.13, novo).** Posle emitovanja događaja koristi `sacekajDa(...)` iz `apps/api/test/sacekaj-da.ts`. Uslov mora da gađa **zapis ovog pokretanja** (marker/`testRunId`), ne „poslednji te vrste" — inače test prolazi sam, a pada u paketu.

**`POST /catalog/products` ne prima `attributes`.** Tipovi soba se u e2e testu upisuju kroz `PATCH /catalog/products/:id`, isti put koji koristi panel. Izgubio sam jedan pun e2e prolaz na ovo.

**Migracija bez `migrate dev`.** SQL se generiše sa `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (pokreni iz `apps/api`, ne iz korena), upiše rukom, pa `migrate deploy`. `migrate dev` nikad kroz cev ni u pozadini — ostavlja bravu i lažno prijavljuje da baza nije dostupna (12.13).

---

## 7. Šta NE raditi

- **Ne stavljaj kategorije iz cenovnika u matricu kreveta.** To je jedina stvar koju je vlasnik izričito tražio dvaput.
- **Ne čuvaj gotove kombinacije sa cenama** kao zapise u bazi. Cena se računa iz pravila po gostu; čuvanje bi značilo ponovni unos pri svakoj novoj kategoriji.
- **Ne „popravljaj" prazan niz da znači „ništa dozvoljeno".** Konvencija u celom repozitorijumu je: prazan niz = bez ograničenja.
- **Ne uklanjaj mogućnost ručnog unosa tipa sobe.** Dobavljač sme imati tip koji katalog nema (§2.11m) — poenta je da to bude svestan izbor sa upozorenjem, ne podrazumevani put.
- **Ne pokreći `next build` dok `next dev` radi nad istom aplikacijom** — kvari `.next` keš.
- **Nikad `git add -A`** — u istom stablu ume da radi i drugi agent. Staguj samo imenovane putanje.

---

## 8. Šta nije u repozitorijumu — traži od vlasnika

| Šta                                              | Kako do njega                                                                                                           |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| Lozinka i MFA za `vlasnik@terminal-travel.local` | **Pitaj vlasnika.** Seed pri prvom pokretanju ispiše novu lozinku i prikaže je **samo tada**.                           |
| `ANTHROPIC_API_KEY`                              | **Pitaj vlasnika.** Bez njega uvoz cenovnika i izmena rečima jasno kažu da AI nije podešen, umesto da se prave da rade. |
| Ostale tajne (JWT, šifrovanje, webhook)          | Generišu se nasumično pri podešavanju, ne traže se od vlasnika.                                                         |
| EU hosting provajder                             | **Namerno nije izabran.** Pitaj pre nego što bilo šta hostuješ van lokalne mašine.                                      |

Baza je Postgres na portu **5435** (`docker compose up -d`), ne 5432.

---

## 9. Poslednja napomena

Vlasnik je 10.9.2026. rekao: _„mnogo toga ima i više ne mogu sve da pohvatam."_ To je uputstvo o načinu rada, ne usputna rečenica.

Kad izveštavaš: **jedan nalaz po pasusu, merenje umesto tvrdnje, i predlog jednog sledećeg koraka — ne spisak od šest.** Ako nešto ne radi, reci to prvo i bez ublažavanja. Ako nešto radi, reci čime si to izmerio.
