# Predaja rada — cenovnik završen, šta dalje (stanje 9.9.2026, veče)

**Kome:** sledećem agentu/sesiji koja preuzme repozitorijum sa GitHub-a **na drugoj mašini** i nastavlja rad.
**Zašto postoji:** sedmodnevni plan za cenovnik iz `46-PREDAJA-RADA-CENOVNIK.md` je danas **završen do kraja**. Bez ovog dokumenta bi se to moralo rekonstruisati iz dvanaest commit poruka, a to se u praksi ne radi. Ovde stoji **gde se stalo, šta je sledeće, šta je već pokušano i šta NE treba ponovo raditi**.

**Ovo nije zamena za specifikaciju.** Sve odluke i njihova obrazloženja su u Nivo 2 specifikacijama; ovde je samo putokaz.

---

## 1. Pročitaj ovo pre nego što išta pipneš

Redosled je bitan, ne preskači:

1. `CLAUDE.md` u korenu — tvrdo pravilo „nema koda bez oslonca u specifikaciji", i kako se komunicira sa vlasnikom (**Nenad je arhitekta, ne programer**: tehničke odluke se donose i obrazlažu, nikad prebacuju njemu; objašnjava se bez žargona).
2. Skill `tt-m3-ugovaranje-alotmani` → `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md`. Zaglavlje verzija **v1.28 do v1.35** opisuje sve što je urađeno u ovom talasu; poglavlje **2.11** je ceo model cenovnika.
3. `docs/analize/46-PREDAJA-RADA-CENOVNIK.md` — svih sedam koraka, svaki sa blokom **„URAĐENO 9.9.2026"** koji kaže šta je tačno napravljeno i **šta je namerno ostavljeno van obima**.
4. `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md` — tabela na vrhu, red koji odgovara onome što radiš. Posebno **11.3** i **12.13**; obe su me koštale vremena baš u ovoj sesiji.
5. `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md` — otvorene stavke; jedna je dodata danas (premeštanje deljenog obračuna cene).

---

## 2. Podizanje na drugoj mašini — tačan redosled

```bash
git clone https://github.com/Nenad034/Terminal-Travel.git
cd Terminal-Travel
npm install
docker compose up -d          # Postgres na portu 5435, Mailpit na 8025
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.local.example apps/panel/.env.local
# popuniti .env (vidi ispod), pa:
cd apps/api
npx prisma migrate deploy
npx prisma db execute --file prisma/sql/audit_log_append_only.sql --schema prisma/schema.prisma
npx prisma db seed
```

**Šta NIJE u repozitorijumu i mora se pitati vlasnika ili generisati:**

| Šta                                                      | Odakle                                                                                                                                                |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`, `ENCRYPTION_KEY`, `PAYMENT_WEBHOOK_SECRET` | generisati nasumično (`openssl rand -hex 32`), svaki različit                                                                                         |
| **Lozinka i MFA za `vlasnik@terminal-travel.local`**     | **pitati vlasnika.** Nije u repozitorijumu i ne sme biti. Seed ispisuje novu lozinku pri prvom pokretanju — zapisati je odmah, prikazuje se samo tada |
| `ANTHROPIC_API_KEY`                                      | **pitati vlasnika.** Bez njega uvoz cenovnika i izmena rečima vraćaju jasnu poruku umesto da rade — to je namerno, ne kvar                            |

**Hosting van lokalne mašine se ne dira.** EU provajder namerno nije izabran (`CLAUDE.md`) — pitati vlasnika pre nego što se bilo šta postavi van `localhost`.

---

## 3. Šta je stvarno GOTOVO (kod postoji, izmeren je i CI je zelen)

Dvanaest commit-a od `9e16f01` do `5be7849`. Sve što sledi je **provereno merenjem kroz iste endpoint-e koje panel zove, nad pravom bazom** — ne pretpostavkom.

### 3.1 Četiri rupe „napisano ali nije povezano" (zamka 7.12)

| Rupa                                                                  | Dokaz                                                                 |
| :-------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| Doplata sa dometom ugovora nije stizala do prodaje (v1.28)            | e2e: pet doplata, dve moraju da se vide, tri ne smeju                 |
| Marža po pojedinačnoj stavci se upisivala a nije primenjivala (v1.29) | 120,00 (ugovor 20 %) naspram **117,00** (izuzetak 12 % + 5,00)        |
| Istekla cena se i dalje prodavala (v1.30)                             | `POST /sales/quotes` vraća 400 sa `BOOKING_WINDOW_CLOSED`             |
| Provizija subagenta se računala nad celom ponudom (v1.31)             | u istoj ponudi **90,00** naspram **100,00** za stavku „bez provizije" |

### 3.2 Sedam koraka iz plana

| Korak | Šta                             | Verzija  | Ključni dokaz                                                                                                              |
| :---- | :------------------------------ | :------- | :------------------------------------------------------------------------------------------------------------------------- |
| 1–3   | mreža, doplate, marža po stavci | v1.27–29 | (ranije sesije + rupe iznad)                                                                                               |
| 4     | dani u nedelji i turnusi        | v1.32    | subota→subota po 100,00/140,00 daje **780,00**; sreda odbijena sa „Prijava je moguća samo: subota"                         |
| 5     | verzije cenovnika               | v1.33    | razlike vraćaju **tačno jednu** stavku `100,00 → 110,00`; potvrđena jedna od dve izmene ostavlja drugu sobu na staroj ceni |
| 6     | kalendar cena i raspoloživosti  | v1.34    | ponedeljak 100,00, petak i subota 140,00; dan sa stop-sale **zadržava cenu**                                               |
| 7     | izmena cenovnika rečima         | v1.35    | 22 testa nad čistim obračunom + 18 nad ogradama oko modela                                                                 |

**Gde je kod:** sve u `apps/api/src/modules/m3-ugovaranje-alotmani/pricelist/`. Čiste funkcije bez baze: `weekday-coverage.ts`, `pricelist-diff.ts`, `instruction-intents.ts`, `surcharge-scope.ts`, `subagent-commission.ts`, `season-ranges.ts`.
**Gde su ekrani:** `apps/panel/src/app/(app)/ugovori/[id]/cenovnik/` — šest kartica: Cene, Doplate i popusti, Marža i provizija, Kalendar, Izmena rečima, Verzije.

**Stanje testova na kraju sesije:** 1444 unit testa u 156 paketa, sve prolazi. E2E: `m3-pricelist-versions` (6), `m3-pricelist-calendar` (4), `m5-pricelist-scope` (4).

---

## 4. Šta je SLEDEĆE — po redu

### 4.1 Prva stvarna proba izmene rečima (najkraće, najveća vrednost)

Korak 7 je testiran **oko** modela, ne kroz njega: odgovor jezičkog modela nije determinisan, pa bi test koji na njemu počiva bio ili spor i skup ili lažno zelen. **Poziv modelu nikad nije pokrenut nad živom rečenicom.**

Kod uvoza cenovnika (§4.2.6) je prvi živi poziv otkrio **tri nedorečenosti u uputstvu modelu** koje se drugačije nisu mogle videti (model je vratio 10 redova od kojih su 4 tačna). Očekuj isto ovde.

**Kako:** otvori `/ugovori/<id>/cenovnik` → kartica „Izmena rečima", ukucaj vlasnikovu rečenicu iz §4.8.1, pogledaj šta je model razumeo. Ono što ne valja se popravlja u `system` uputstvu i `ALAT` šemi u `pricelist-instruction.service.ts` — **ne** u obračunu, on je deterministički i pokriven testovima.

### 4.2 Tri neispunjene stavke izlaznog kriterijuma iz iste dopune v1.27

Ovo su **jedine tri stavke poglavlja 2.11 koje nisu ispunjene**, i sve tri su isti obrazac kao rupe iz 3.1 — napisano u specifikaciji, nema koda:

- **2.11f — provizija hotela po periodu.** `Contract.commission_percentage` je jedan po ugovoru, a vlasnik potvrđuje 10 % u jednoj sezoni i 7 % u drugoj. Spec traži isti scope obrazac kao `MarkupRule`. **Provereno pretragom: nijedan `HOTEL_COMMISSION` scope ne postoji u kodu.**
- **2.11g — redosled obračuna u pet koraka** (popust → provizija hotela → marža → provizija subagenta). Spec daje merljiv primer: ulazna 55,00 sa popustom 15 %, hotelskom provizijom 10 % i maržom 18 % daje **49,65**. Drugi redosled daje drugi broj — test to mora hvatati.
- **2.11h — osnovica popusta.** Popust za treću osobu se računa **od ulazne hotelske osnovne cene**, ne od cene sobe u kojoj gost leži.

**Redosled je bitan:** 2.11f mora pre 2.11g, jer je provizija hotela drugi korak obračuna. 2.11h se prirodno radi u istom prolazu kao 2.11g.

### 4.3 Spajanje AI uvoza sa tokom verzija

Ekran AI uvoza (§4.2) i dalje upisuje **red po red** umesto da zove `predlog`/`primeni`. Tok verzija (korak 5) je napravljen i testiran baš zato da oba ulaza završe na istom mestu. Ovo je čisto povezivanje — nema novog modela ni novih odluka.

---

## 5. Otvoreno i zabeleženo — nije skriveno, ne broji se kao propust

| Šta                                                                                                                                                                                                                          | Gde je zapisano                     |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| Čist obračun cene (`computeRoomBaseCost`) stoji u M5 folderu iako opisuje M3 pravila; M3 ga sada uvozi. Smer zavisnosti je obrnut od arhitekture. **Predlog: premestiti u zajednički folder — tri uvoza, mehanička izmena.** | backlog, prva stavka                |
| Doplate se **prikazuju** u razlikama i u izmeni rečima, ali se ne upisuju tim putem — menjaju se na svom ekranu (§2.11k)                                                                                                     | M3 v1.33 i v1.35 zaglavlja          |
| Izmene van cenovnika (rokovi otkazivanja, akcije, kapacitet) izlaze kao prijavljene stavke sa uputstvom, ne primenjuju se                                                                                                    | M3 v1.35                            |
| Stavka ponude nosi **jedan** `rate_line_id` i kad je cena sastavljena iz više redova sa različitim danima                                                                                                                    | M3 v1.32                            |
| M7 portal ne pokazuje subagentu **zašto** stavka nema proviziju                                                                                                                                                              | M3 v1.31                            |
| Nepokriven dan u nedelji je **upozorenje, ne odbijanje** — svesno odstupanje od izvornog teksta §2.11d, jer bi strogo pravilo onemogućilo unos prvog reda                                                                    | M3 v1.32, i ispravljeno u M17 §6d.2 |

---

## 6. Zamke koje su me koštale vremena BAŠ u ovoj sesiji

Ne uči ih iznova.

**11.3 — provera pre push-a, ne posle.** Pao mi je CI jer sam ESLint pokrenuo **samo nad `apps/api`**, a Prettier **samo nad izvornim fajlovima** a ne i nad `.md` dokumentima iz istog prolaza. Delimična provera daje osećaj da je provereno, a pokriva tačno onaj deo koji ne pada.

Lokalno `prettier --check .` na Windows mašini prijavljuje **1136 fajlova** lažno (CRLF radna kopija). Zato se proverava **sadržaj iz git-a**, onako kako ga CI vidi:

```bash
git add <putanje>
for f in $(git diff --cached --name-only); do
  git show ":$f" > /tmp/a 2>/dev/null || continue
  npx prettier --stdin-filepath "$f" < /tmp/a > /tmp/b 2>/dev/null || continue
  cmp -s /tmp/a /tmp/b && echo "OK   $f" || echo "PADA $f"
done
```

Uz to `eslint` u **svakoj** aplikaciji koju commit dotakne, ne samo u onoj gde je težište posla.

**12.13 — `prisma migrate dev` se ne pušta kroz cev ni u pozadini.** Prekinut ostavlja advisory lock i zaostalu shadow bazu, pa svaka naredna migraciona komanda laže da je Postgres nedostupan (`P1002 … timed out`). Kad treba samo SQL: `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script`, ručno u migracioni folder, pa `migrate deploy`.

**7.7 — e2e ide nad SVEŽE napravljenom bazom.** Ne nad razvojnom, i ne nad već korišćenom `terminal_e2e`:

```bash
docker exec terminaltravel-postgres-1 psql -U terminal -d postgres \
  -c "DROP DATABASE IF EXISTS terminal_e2e;" -c "CREATE DATABASE terminal_e2e OWNER terminal;"
cd apps/api
export DATABASE_URL="postgresql://terminal:terminal_dev_only@localhost:5435/terminal_e2e?schema=public"
npx prisma migrate deploy && npx prisma db execute --file prisma/sql/audit_log_append_only.sql --schema prisma/schema.prisma && npx prisma db seed
npx jest --config ./test/jest-e2e.json --runInBand
```

**7.12 — funkcija koju zove samo `.spec.ts` je napisana, ne primenjena.** Četiri rupe iz 3.1 su tačno to. U ovoj sesiji sam iz istog razloga **obrisao** `primeniPrihvacene` iz `pricelist-diff.ts` — bila je tačna, ali je primena preko baze radila isti posao, pa je funkcija bila mrtva.

**12.2 — `prisma generate` puca sa `EPERM` dok dev server radi.** Benigno **ako** je `node_modules/.prisma/client/index.d.ts` stvarno ažuran — proveri `grep -c <novoPolje>` pre nego što se uznemiriš.

**Nikad `git add -A`** — u istom stablu ume da radi i drugi agent. Staging isključivo po imenovanim putanjama.

---

## 7. Šta NE raditi

- **Ne vraćaj „nepokriven dan se odbija".** Odstupanje je svesno i obrazloženo na dva mesta.
- **Ne piši drugu formulu za cenu.** Postoji jedna (`computeRoomBaseCost`) i koriste je i prodaja i kalendar. Dve formule za cenu se pre ili kasnije raziđu, a razlika se vidi tek na računu.
- **Ne daj modelu da računa.** Šema alata u `pricelist-instruction.service.ts` namerno **nema polje za izračunatu cenu**. Ograda koja postoji samo kao rečenica u uputstvu se pre ili kasnije prekrši; ova ne može.
- **Ne pravi novu dozvolu za cenovnik.** Sve ide kroz `M3/contract-period` VIEW/EDIT — nova bi tražila dodelu po korisniku za posao koji je isti.
- **Ne prijavljuj „gotovo" bez commit-a i bez pročitanog sadržaja** (`CLAUDE.md`). Ako je posao pokrenut u pozadini a sesija se prekine pre izveštaja — taj rad se smatra **izgubljenim** i pokreće se iznova, ne nastavlja „odakle je verovatno stao" (zamka 8.3).

---

_Nastalo 9.9.2026, na kraju sesije u kojoj su završena svih sedam koraka plana za cenovnik._

_Poslednji commit: `5be7849`, **CI zelen**. Svih dvanaest commit-a ovog talasa je prošlo CI — jedan je pao iz prve (`dadbd62`, formatiranje i ESLint) i ispravljen je u `5d8d13b`; ta greška i način da se izbegne su upisani u zamku 11.3._
