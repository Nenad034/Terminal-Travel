# 40 — Pravila revizije koda (kako se piše nalaz koji sme da se veruje)

**Nastalo:** 5.9.2026, na izričit zahtev vlasnika, posle greške u dokumentu 39 (nalaz 1.1).
**Za koga:** svaka sesija (AI agent ili saradnik) koja piše bilo kakav pregled, reviziju, audit ili spisak nalaza o postojećem kodu.
**Odnos prema drugim dokumentima:** ovo je **kako se revizija radi**; `33-ZAMKE-I-OBAVEZNE-PROVERE.md` je registar konkretnih grešaka (uključujući zamku 8.4, iz koje je ovaj dokument nastao); `39-REVIZIJA-KODA-NALAZI-I-PREDLOZI.md` je jedna konkretna revizija koja se po ovim pravilima ispravlja.

---

## 0. Šta ovaj dokument NE može

Ovaj dokument **ne garantuje** da se greška neće ponoviti, i nijedna sesija ne sme da tvrdi da garantuje. Greška u nalazu 1.1 nije nastala iz nepažnje — nastala je iz *usmerene* pažnje koja je tražila potvrdu umesto provere. Pravilo oblika „budi temeljniji" na to ne deluje, jer se subjektivno oseća kao da je već ispunjeno.

Zato su sva pravila ispod napisana tako da traže **proizvod** (izlaz komande, broj, adresu ekrana), ne stanje svesti. Odsustvo dokaza je vidljivo u tekstu; odsustvo temeljnosti nije.

---

## 1. Svaki nalaz nosi oznaku klase dokaza

Nijedan nalaz ne ulazi u dokument bez jedne od ove četiri oznake, upisane u sam nalaz:

| Klasa | Značenje | Šta MORA da stoji u nalazu |
| :---- | :---- | :---- |
| **A — izmereno** | mašina je prebrojala | komanda/upit i njen izlaz (broj, lista) |
| **B — viđeno na ekranu** | stvarno učitana stranica | tačna adresa, tačan klik/put, i šta je ispisano |
| **C — pročitano u kodu** | tvrdnja o kodu | `fajl:linija` + dokaz da se taj kod stvarno izvršava (v. pravilo 3) |
| **D — procena** | mišljenje, ne nalaz | mora biti u odvojenom poglavlju i označeno kao procena |

**Klasa D se nikad ne piše u jeziku kvara.** „Ovo je loše rešeno" bez A/B/C dokaza je procena, ne nalaz. Ide u poglavlje „Procene i preporuke", ne među greške.

**Pouzdanost opada od A ka D, i to se kaže vlasniku.** Nalaz klase A („81 strani ključ bez indeksa" — izlaz upita) bitno je čvršći od nalaza klase C. Kad se vlasniku predaje spisak, taj raspon se navodi eksplicitno, da zna gde da veruje manje.

---

## 2. Simptom i uzrok su dva odvojena dokaza — nikad jedan

Provera kroz stvaran ekran (zamka 5.13) dokazuje **da** se nešto dešava. Ne dokazuje **zašto**.

U svakom nalazu klase B, simptom i uzrok se pišu kao dve odvojene stavke, svaka sa svojim dokazom. Ako uzrok nema sopstveni dokaz, nalaz se objavljuje **samo kao simptom**, sa rečenicom „uzrok nije utvrđen".

*Odakle pravilo:* u nalazu 1.1 viđena poruka na ekranu (tačna) uzeta je i kao dokaz uzroka (netačan).

---

## 3. Tvrdnja o kodu traži dokaz da se taj kod izvršava

Pre nego što se ijedan fajl optuži, obavezno se pokrene pretraga ko ga uvozi (`grep -rn` po `from '.../<ImeFajla>'` kroz `src`, uz `--include=*.ts` i `--include=*.tsx`) i pogleda se **šta** se uvozi — komponenta ili samo tip. Fajl iz kog se uvozi samo tip se ne prikazuje korisniku.

- Tvrdnja **„X je mrtav kod"** bez izlaza ove pretrage u nalazu — zabranjena.
- Tvrdnja **„X se koristi umesto Y"** bez iste pretrage za oba — zabranjena.
- **Broj linija fajla nikad nije dokaz.** Veličina meri koliko je napisano, ne da li se izvršava. Ako se broj linija navodi, mora stajati uz dokaz izvršavanja, nikad umesto njega.

*Odakle pravilo:* `BookingsTable.tsx` je optužen jer mu se ime poklopilo sa očekivanjem; iz njega se uvozi samo tip `ColumnKey`, a živa tabela je `RealBookingsTable.tsx`.

---

## 4. Obim nalaza se broji, ne procenjuje

Kad se nalaz tiče ponašanja ekrana, rute, endpointa ili funkcije, **nabroje se svi ulazi** pre pisanja — pretragom po samoj **ruti/putanji**, nikad po imenu komponente.

Nalaz se onda formuliše brojem: **„2 od 3 ulaza vode pogrešno"**, nikad „lista vodi pogrešno".

Reči **„sve", „nijedan", „ceo", „svuda"** u nalazu zahtevaju prebrojan izlaz komande u istom nalazu. Bez njega se ne koriste.

*Odakle pravilo:* u 1.1 su tri ulaza vodila na pun zapis; dva su bila pokvarena, a nalaz je rekao „lista".

---

## 5. Obavezan pokušaj obaranja (falsifikacija) za nalaze Kritično/Visoko

Pre upisa svakog nalaza označenog Kritično ili Visoko, sesija **eksplicitno pokušava da ga obori**: formuliše rečenicu „ovaj nalaz bi bio netačan ako …" i tu pretpostavku proveri.

U nalaz se upisuje jedan red: **„Pokušaj obaranja: &lt;šta je provereno&gt; → nalaz opstaje."**

Ako pokušaj obaranja nije izvršen, nalaz ne sme nositi oznaku Kritično ni Visoko — ide u Srednje, sa napomenom da nije falsifikovan.

*Zašto:* obaranje je jeftino. Nalaz 1.1 je oboren sa četiri komande. Nije propušten zbog cene, nego zato što je traženje prestalo čim je prvi rezultat odgovarao očekivanju.

---

## 6. Provera pristrasnosti prema priči projekta

`CLAUDE.md` postoji zbog PrimeTravel iskustva: paralelni moduli, monoliti, „delimično gotovo". Nalaz koji **potvrđuje tu priču** deluje istinitije nego što jeste i prolazi manju kontrolu.

Pre upisa svakog nalaza postavlja se pitanje: *„da li ovaj nalaz laska osnovnoj premisi projekta (duplirani moduli / mrtav kod / lažno gotovo)?"* Ako da — obavezan je **još jedan** nezavisan pokušaj obaranja, iz drugog ugla nego onaj iz pravila 5.

Isto važi za nalaz koji zvuči efektno u jednoj rečenici. Efektnost je signal za dodatnu proveru, ne za viši prioritet.

---

## 7. Nema kvote za nalaze

**Revizija bez ijednog kritičnog nalaza je validan i pun rezultat**, i tako se prijavljuje — bez izvinjavanja i bez uvećavanja srednjih nalaza da bi spisak izgledao ozbiljno.

Sesija nikad ne piše nalaz zato što je „poglavlje 1 prazno". Prazno poglavlje 1 je informacija za vlasnika, ne propust revizije.

Obavezno je poglavlje **„Provereno, ispravno je"** — šta je gledano i nađeno kao uredno. Bez njega se ne vidi razlika između „nema problema" i „nije gledano".

---

## 8. Širina smanjuje dubinu — i to se prijavljuje

Pri popravci jedne stvari stvarnost ispravlja odmah (kod se pokrene, greška se vidi). Pri pisanju pregleda od 40 stavki ništa ne pruža otpor — tekst prolazi kakav god bio.

Zato svaka revizija na kraju navodi **koliko je nalaza prošlo pun postupak** (pravila 1–6), a koliko je zabeleženo površnije. Nalazi koji nisu prošli pun postupak nose vidljivu oznaku niže pouzdanosti. Sakriti tu razliku znači predati vlasniku spisak u kome ne može da razlikuje izmereno od pretpostavljenog.

---

## 9. Ispravka nalaza se piše kao ispravka, ne tiho

Kad se utvrdi da je raniji nalaz netačan, tekst se **ne prepravlja u tišini**. U nalaz ide vidljiv blok: šta je tvrđeno, šta je stvarno, i **zbog čega je promašeno**. Uzrok promašaja ide u `33-ZAMKE-I-OBAVEZNE-PROVERE.md` u istom prolazu.

*Zašto:* vlasnik odluke donosi na osnovu ovih dokumenata. Dokument koji tiho ispravlja sam sebe ne može da posluži kao osnov za odluku, jer se ne zna šta je od ranije pročitanog još važeće.

---

## 10. Kada ponovo raditi reviziju (i zašto baš tada)

Revizija se **ne vezuje za kalendar** — vezuje se za događaje posle kojih tačno određena vrsta kvara nastaje. Sesija koja primeti neki od ovih okidača **treba sama da predloži reviziju vlasniku**, sa obrazloženjem koji je okidač nastupio.

| Okidač | Zašto baš tada | Obim |
| :---- | :---- | :---- |
| **Ekran pređe sa mock na prave podatke** | ovo je tačna klasa greške iz nalaza 1.1 — prelazak se desi „na pola", glavni put pređe a sporedni ulazi ostanu. Nastaje odmah, a vidi se tek kad neko klikne baš tim putem | uzak: nabrojati sve ulaze u taj ekran (pravilo 4) |
| **Zatvaranje faze iz master plana (Faza N → N+1)** | granica faze je mesto gde se najviše modula dodiruje odjednom i gde se „delimično gotovo" najlakše proglasi gotovim | pun, ali samo nad modulima te faze |
| **Pre prvih stvarnih podataka / prvih stvarnih korisnika** | nalazi klase „radi danas, pada pod opterećenjem" (indeksi, paginacija, N+1) nevidljivi su na 16 mock rezervacija, a skupi posle. Ovo je jedina revizija koja se NE sme odložiti | usko, ali obavezno: indeksi, paginacija, N+1, limiti |
| **Nova aplikacija ili modul uđe u `apps/`** | nov deo ne nasleđuje navike postojećeg — testovi, CI, obrada grešaka najčešće se propuste na startu | uzak: samo taj deo, uz poređenje sa `apps/api` kao merilom |
| **Posle perioda paralelnog rada više sesija/računara** | paralelan rad je izvor duplikata i razilaženja spec↔kod; PrimeTravel je nastao upravo tako | uzak: samo dodirnuti moduli |
| **Kad vlasnik primeti kvar koji je „trebalo da bude uhvaćen"** | znači da postoji rupa u proveri, ne samo jedan kvar. Popraviti kvar bez revizije te rupe znači da će ista klasa greške doći opet | uzak: klasa greške, ne ceo repozitorijum |

**Šta ne raditi:** ne ponavljati punu reviziju celog repozitorijuma bez okidača. Druga puna revizija bez izmene u međuvremenu nalazi malo novog, troši mnogo, i — opasnije — stvara pritisak da se nešto *nađe*, što je tačno pritisak iz pravila 6 i 7.

**Prvi sledeći put po ovom spisku:** pre prelaska na stvaran rad sa pravim rezervacijama (treći red tabele). Do tada mock podaci ostaju po odluci vlasnika od 5.9.2026.

---

## 11. Šta sesija radi PRE nego što počne reviziju

1. Pročita ovaj dokument u celini i zamku 8.4 u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`.
2. Pročita `27-BACKLOG-IDEJA-I-PREDLOZI.md` — da već poznata stavka ne bude prijavljena kao otkriće. Nalazi koji su već negde zapisani idu u odvojeno poglavlje „već zabeleženo".
3. Zapiše okidač iz pravila 10 zbog kog se revizija radi, i obim koji iz njega sledi.

## 12. Šta sesija radi PRE nego što preda spisak

1. Prođe kroz svaki nalaz iz poglavlja Kritično/Visoko i proveri da nosi: klasu dokaza (1), odvojen uzrok (2), dokaz izvršavanja (3), prebrojan obim (4), pokušaj obaranja (5).
2. Prebroji koliko je nalaza prošlo pun postupak i upiše taj broj (8).
3. Proveri da postoji poglavlje „Provereno, ispravno je" (7) i poglavlje „već zabeleženo" (11.2).
4. Vlasniku, uz spisak, kaže **gde da veruje manje** — koji su nalazi klase A (izmereno), a koji klase C/D (tumačenje).
