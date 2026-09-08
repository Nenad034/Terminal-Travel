# Predlog — mreža kapaciteta ("ko je gde slobodan, kog dana")

**Status:** Predlog **sproveden u specifikacije 8.9.2026** — M3 v1.15 (§2.8 kapacitet po danu, stop-sale, blokade), M7 v1.12 (§5a dodela kapaciteta subagentu), M17 v2.60 (§4b ekran "Kapaciteti"), M18 v1.13 (signal `CAPACITY_BLOCK_EXPIRING`), M5 §4 korak 2 (razlozi odbijanja). Ovaj dokument ostaje **obrazloženje i trag odluka**; merodavan opis modela je od sada u tim specifikacijama. Koda i dalje nema.
**Prvobitni status:** Predlog, bez koda. Nastao 8.9.2026. na zahtev vlasnika, odmah pošto je M13 §4.4 dobio toplotnu mapu za vremenske obrasce: _"dopada mi se ova mapa i mislim da možemo da je iskoristimo za pregled smeštajnih i kapaciteta drugih proizvoda, po više kriterijuma. Za sada samo zapišite i razradite, konsultujući relevantne izvore na internetu ali i PrimeTravel jer mislim da je to tamo jako dobro urađeno."_
**Ažurirano isti dan (8.9.2026):** vlasnik je odgovorio na sva četiri pitanja iz poglavlja 7, pa i na tri dodatna koja su iz njih ispala (dodela kapaciteta subagentu, preciznost prikaza, držanje za nepotvrđenu grupu) — **nijedno otvoreno poslovno pitanje više ne stoji**, model je zaokružen u poglavlju 9.5 — odgovori i šta menjaju su u **poglavlju 9**. Najvažnija posledica: preporuka iz poglavlja 0 i 4 je time **promenjena** — dnevni kapacitet i stop-sale nisu više "drugi korak za kasnije" nego uslov da prvi korak uopšte ima smisla.
**Dodiruje module:** M3 (kapacitet i ugovori — izvor istine), M5 (rezervacije — šta je prodato), M2 (šta je proizvod uopšte), M13 (izveštajni sloj), M17 (panel/ekran), M7 (verzija za subagente), M18 (alarmi).
**Šta je pregledano:** PrimeTravel `src/modules/production/OperationalReports.tsx` (3568 linija, `Inventory Orchestrator` tab) i prateći `OperationalReports.css`; naš `apps/api/prisma/schema.prisma` (M3 `ContractPeriod`, M5 `BookingItem`, M13 `FactBooking`); M3 spec §2.3/§2.3a/§4.3/§8, M2 spec §2.3, M13 spec §4.1/§4.4; javni izvori navedeni u poglavlju 4.

---

## 0. Kratko mišljenje — šta preporučujem

**Ideja je dobra i vredi je uraditi, ali ne kao proširenje one iste mape.** To su dva različita alata koja samo liče jedan na drugi:

|                          | Toplotna mapa (već napravljena, M13 §4.4) | Mreža kapaciteta (ovaj predlog)                                     |
| :----------------------- | :---------------------------------------- | :------------------------------------------------------------------ |
| Pitanje na koje odgovara | "Kada se najviše rezerviše?"              | "Šta je slobodno 14. jula u Budvi?"                                 |
| Vreme                    | prošlost, zbirno (sat/dan u nedelji)      | budućnost, konkretni datumi                                         |
| Šta je u ćeliji          | jačina boje = koliko puta se desilo       | brojevi: ukupno / prodato / slobodno                                |
| Šta se s tim radi        | zaključak, planiranje                     | radnja — otvara se rezervacija, šalje se hotelu, zatvara se prodaja |
| Ko je čita               | vlasnik, direktor, šef prodaje            | prodajni agenti, svakodnevno, ceo dan                               |

Ako se to spoji u jedan ekran, dobija se nešto što ni jedno ni drugo ne radi dobro — analitička mapa se ne može kliknuti da bi se nešto uradilo, a operativna mreža je prepuna brojeva da bi se iz nje video obrazac. **Preporuka: napraviti drugi ekran, sa istim vizuelnim jezikom** (ista paleta, isto ponašanje, isti osećaj) — da deluje kao deo iste porodice, a ne kao drugi program.

**Ali pre bilo kakvog koda postoji zid koji se mora rešiti: Terminal danas ne zna kapacitet po danu.** Detaljno u poglavlju 5 — to je najvažniji nalaz ovog dokumenta i jedino što stvarno stoji na putu.

---

## 1. Šta je vlasnik tražio, prevedeno u zahteve

1. Pregled kapaciteta **smeštaja** — koliko soba je ugovoreno, koliko prodato, koliko ostalo, po danima.
2. Isto i za **druge proizvode** — izleti, transferi, čarter mesta, ulaznice.
3. **Po više kriterijuma** — po destinaciji, hotelu, tipu sobe, dobavljaču, vrsti ugovora, kanalu prodaje.
4. Vizuelno kao mapa koja mu se dopala — jednim pogledom, boja nosi stanje.

---

## 2. Šta PrimeTravel radi (pročitano u kodu, ne po sećanju)

Ekran se zove **"Operativni Izveštaji — Inventory Orchestrator"** (`src/modules/production/OperationalReports.tsx`). Vlasnikova ocena da je "jako dobro urađeno" stoji — konceptualno je to najkompletniji deo tog projekta koji sam video.

**Kako izgleda:** tabela u kojoj su **redovi hoteli**, a **kolone dani**. Klik na hotel razvija njegove **tipove soba** kao pod-redove. Prva kolona je "zalepljena" (ostaje vidljiva pri horizontalnom skrolu), vikend kolone su posebno obojene. U svakoj ćeliji stoje četiri podatka: ukupno, prodato, procenat popunjenosti i **oznaka slobodnog** koja menja boju kad padne na 2 (narandžasto) ili 1 (crveno). Pozadina ćelije nosi status ugovora: `Alotman` (plavo), `Fix` (zeleno), `On Request` (narandžasto), `Stop` (crveno).

**Šta vredi preuzeti — sedam stvari:**

1. **Dva nivoa u istom redu** — hotel kao zbir, razvijanje na tipove soba. Zbirni red uzima "najgori" status svojih soba (`mergeWorstMasterStatus`), pa se problem vidi i kad je red skupljen. Ovo je najbolja pojedinačna ideja tog ekrana.
2. **Dva različita datumska filtera istovremeno** — "Rezervacije (od–do)" i "Period boravka (od–do)". To nije isto pitanje: "šta je prodato u julu" i "šta se putuje u julu" daju različite brojeve. Naš ekran Izveštaji je isti problem rešio prekidačem koji bira NA ŠTA se odnosi jedan par datuma (`dateField`) — jeftinije po prostoru, ista korist.
3. **Filter po stanju kapaciteta** — "sve / samo zatvoreno (STOP) / samo slobodno". Zvuči trivijalno, a to je najčešće pitanje prodaje ("šta uopšte mogu da prodam").
4. **Druga, sažeta verzija istog prikaza za slanje** — umesto brojeva, jedna tačka po danu sa legendom AVAILABLE / ON REQUEST / STOP SALE, u dokumentu koji ide subagentima. Kod nas bi to bio M7 kanal.
5. **Klik na ćeliju otvara taj dan** — mreža nije samo prikaz, nego navigacija.
6. **Istorija izmena kapaciteta** (audit trail) — ko je i kada promenio kapacitet. Mi to već imamo kao princip u M1 (audit log), ovde bi samo dobio svoj prikaz.
7. **Slanje izveštaja hotelu jednim dugmetom** — kod nas prirodno preko M22 (E-pošta) i postojeće "Najave dobavljačima".

**Šta NE preuzimati — pet stvari, sa razlogom:**

1. **Trepćuće ćelije.** Kritična polja pulsiraju animacijom bez prestanka (`cap-pulse-danger`, 0.6s u petlji). Na ekranu koji agent drži otvoren ceo dan to je iscrpljujuće, a za deo ljudi (vestibularne smetnje) i fizički neprijatno; standard traži da se animacija isključi kad korisnik u sistemu traži manje kretanja. Kod nas: statična boja + oznaka, bez pulsiranja.
2. **Status isključivo bojom pozadine.** Legenda postoji samo u verziji za štampu/slanje, ne u glavnoj mreži; u glavnoj mreži stoji tročlana skraćenica ("Alo", "Sto") koja pomaže, ali nije objašnjena nigde na ekranu. Kod nas: legenda uvek vidljiva, i oblik/oznaka pored boje (naša zamka 1.1 i pravilo iz dizajn dokumenta).
3. **Boje ukucane u kod** (`#ef4444`, `rgba(59,130,246,...)`) umesto tokena teme — zato taj ekran ne postoji ni u jednom drugom modu prikaza. Kod nas isključivo tokeni.
4. **Demo podaci ubačeni u sam ekran** — u kodu stoji, doslovno: _"For demo purposes: make some dates have critical capacity (2 units)"_ (linija 256). Tako se dobija ekran koji izgleda živ dok se ne poveže sa pravim podacima, a niko ne zna gde prestaje stvarnost. Naša zamka 7.2 i dokument 42 postoje baš zbog toga.
5. **Ceo ekran u jednom fajlu od 3568 linija** — tačno ono zbog čega je CLAUDE.md napisan. Kod nas: mreža kao zasebna komponenta koja prima podatke, ekran odvojeno.

---

## 3. Šta rade drugi (industrijska praksa)

Ovo nije nova ideja — u hotelijerstvu se zove **tape chart** (ili _occupancy grid_ / _inventory grid_) i to je osnovni radni ekran svakog sistema za upravljanje objektom i svakog "channel manager"-a: kalendar u kom se vidi šta je na knjigama, koji tipovi soba su otvoreni i gde dostupnost tanji ([rezStream](https://www.rezstream.com/our-blog/14-things-your-hotel-tape-chart-should-do/), [RoomKeyPMS](https://support.roomkeypms.com/a/421965-how-to-use-the-tape-chart-in-your-pms), [RateGain](https://rategain.com/blog/property-management-system-features-2026-guide/)). Kod "channel manager" alata isti prikaz nosi i cene i restrikcije uz raspoloživost ([SiteMinder](https://www.siteminder.com/channel-manager/)).

Tri stvari iz te prakse vredi zapisati, jer se poklapaju sa onim što nam treba:

- **Mreža i toplotna mapa se u struci razlikuju isto kao u poglavlju 0** — mreža je operativna (dodela, prodaja, restrikcije), toplotna mapa je analitička (obrazac kroz vreme) ([Inforiver](https://inforiver.com/insights/heatmaps-in-data-visualization-a-comprehensive-introduction/), [Fuselab](https://fuselabcreative.com/heat-map-data-visualization-guide/)). Naš razdvojen predlog je, dakle, uobičajeno rešenje, ne izmišljanje.
- **Restrikcije su ravnopravne sa brojem** — minimalan boravak, zatvaranje prodaje, "na upit". Kod nas danas postoji `ON_REQUEST` kao mod perioda, ali **stop-sale ne postoji** (M3 §8 ga vodi kao otvorenu stavku). Mreža je prirodno mesto gde bi se video i menjao.
- **Za izlete/transfere/aktivnosti** isti obrazac se zove upravljanje resursom i kapacitetom polaska — koliko mesta po polasku, koliko je zauzeto, zajednički resursi (vozilo, vodič, oprema) ([Bókun](https://www.bokun.io/tour-operator-software-with-inventory-management), [FareHarbor](https://marketing.fareharbor.com/blog/best-booking-systems-for-boat-tours/)). To potvrđuje da jedan isti ekran može da pokrije i ne-smeštajne proizvode, ako se "jedinica kapaciteta" definiše po vrsti proizvoda (poglavlje 6.4).

---

## 4. Zid: Terminal danas ne zna kapacitet po danu

Ovo je najvažniji deo dokumenta i razlog zašto ovo nije "napravi ekran za dva dana".

**Kako je kapacitet danas modelovan (M3 §2.3, `schema.prisma` `ContractPeriod`):** jedan ugovorni period ima **jedan** `total_capacity` i **jedan** `units_sold` — za ceo period. Period je obično cela sezona. Dakle sistem zna "od 1.6. do 30.9. imamo 20 soba i prodato je 47", ali **ne zna koliko je soba zauzeto baš 14. jula**. `units_sold` je brojač prodaja, ne stanje na dan.

PrimeTravel to ima (`records[dateStr]` — zapis po datumu). Mi nemamo.

**Dobra vest: ne mora se odmah menjati baza.** Podatak po danu se može **izvesti** iz onoga što već postoji:

- `BookingItem` ima `stayFrom`, `stayTo` i `unitCount` (broj jedinica), i `rateLineId`;
- `RateLine` pripada `ContractPeriod`-u, koji nosi `total_capacity`.

Za svaku noć u traženom rasponu: **prodato** = zbir `unitCount` svih potvrđenih stavki koje tu noć pokrivaju, **ukupno** = `total_capacity` perioda koji tu noć važi, **slobodno** = razlika. To je jedan upit, bez ijedne nove tabele.

**Šta se time NE dobija** (i mora se reći odmah, da ne ispadne obećanje):

- **kapacitet koji se menja unutar perioda** (npr. hotel nam da 20 soba, ali od 10. do 15. jula samo 12) — danas nema gde da se upiše;
- **stop-sale na konkretan datum** — dobavljač zatvori prodaju za jedan vikend;
- **ručna korekcija** ("blokiraj 3 sobe, drži za grupu");
- **kapacitet proizvoda iz spoljnih API izvora (M4)** — tamo raspoloživost živi kod provajdera i dobija se upitom, ne stoji kod nas.

Sve četiri stavke traže **novi zapis: kapacitet po danu** (radno ime `CapacityDay`: period + datum + tip sobe + ukupno + blokirano + status). To je izmena M3 specifikacije i baze — nije velika, ali je stvarna i traži tvoju potvrdu pre nego što se dira.

**Preporuka (i moje mišljenje):** ići u dva koraka.

- **Korak 1 — izvedeno iz postojećih podataka, bez izmene baze.** Daje pun pregled "ugovoreno / prodato / slobodno" po danu za sve ugovorene proizvode. Pokriva verovatno 80% svakodnevne potrebe prodaje. Rizik: nikakav, ništa se ne menja u načinu upisa.
- **Korak 2 — `CapacityDay` u M3**, tek kad se pojavi prva stvarna potreba za stop-sale/blokadom/korekcijom po danu. Tada mreža postaje i ekran za **izmenu**, ne samo za gledanje.

Obrnut redosled (prvo baza) košta više, a ne daje ništa brže — jer ekran ionako mora prvo da postoji.

> **Ova preporuka je ispravljena istog dana, posle vlasnikovog odgovora (poglavlje 9.1).** Stop-sale nije redak slučaj nego svakodnevica, i stiže čak i kod fiksnog zakupa. Mreža koja ga ne zna prikazivala bi "slobodno 6" za datum koji je zatvoren — a pogrešan podatak na ekranu prodaje je gori od nepostojećeg ekrana. Zato `CapacityDay` + stop-sale ulaze u **prvi** prolaz, zajedno sa izvedenim izračunom, ne posle njega. Izvedeni izračun ostaje kao osnova (odgovara na "koliko je prodato"), a `CapacityDay` nosi ono što se izračunom ne može znati (koliko je otvoreno i da li je uopšte otvoreno).

---

## 5. Predlog ekrana

### 5.1 Gde stoji

Nov ekran u panelu (M17), radni naziv **"Kapaciteti"**, uz "Ugovore" i "Katalog" — ne unutar Izveštaja. Razlog: ovo nije izveštaj koji se čita jednom nedeljno, nego radni alat koji prodaja drži otvoren.

**Podatke čita iz M3/M5 uživo, ne iz M13 projekcije.** M13 je zbirni sloj koji kasni do sledećeg usaglašavanja — za pitanje "da li mogu da prodam ovu sobu" kašnjenje nije prihvatljivo. To je ujedno i granica: M13 ostaje analitika, ovo je operativa.

### 5.2 Oblik

Redovi = ono što se prodaje, kolone = dani, jedan mesec (ili proizvoljan raspon) odjednom:

```
                     pon 13  uto 14  sre 15  čet 16  pet 17  sub 18  ned 19
Hotel Slovenska Plaža  20/14   20/17   20/19   20/20   20/20   20/18   20/11
  Dvokrevetna            12/9    12/11   12/12   12/12   12/12   12/11    12/7
  Trokrevetna             8/5     8/6     8/7     8/8     8/8     8/7     8/4
Hotel Mediteran        15/3    15/5    15/6    15/9    15/12   15/12   15/8
```

- prva kolona zalepljena, hotel se klikom razvija na tipove soba (PrimeTravel obrazac, ideja #1);
- **jačina boje = popunjenost** (sekvencijalna skala, ista tehnika kao već napravljena mapa: jedna nijansa u pet stepena) — pun kapacitet je najtamniji;
- **status je nešto drugo i ne sme deliti jezik sa jačinom**: `ON_REQUEST` / `STOP` / prazan period dobijaju **šrafuru ili oznaku**, ne svoju boju pozadine, jer bi se inače "crveno = zatvoreno" i "tamno = puno" mešali na istoj ćeliji. Ovo je jedina tačka gde svesno odstupam od PrimeTravel-a, i mislim da je važna;
- broj se ne upisuje u svaku ćeliju kad je raspon dug — pri mesečnom pregledu ćelija nosi samo boju i oznaku, a brojevi se pokazuju na prelaz mišem i u režimu "nedelja" (gde ima mesta). Isto pravilo koje već primenjujemo u toplotnoj mapi (zamka 1.11: tekst samo na krajevima skale).

### 5.3 Kriterijumi (ono "po više kriterijuma")

**Šta se filtrira:** destinacija (država/grad), hotel/proizvod, dobavljač, tip sobe, usluga (BB/HB/AI), vrsta ugovora (`FIXED` / `ON_REQUEST` / `CHARTER` / `FIXED_LEASE`), vrsta proizvoda, i stanje ("sve / ima mesta / popunjeno / zatvoreno").

**Po čemu se grupišu redovi** (ovo je prava snaga, isti princip kao naš Dinamički izveštaj): destinacija → hotel → tip sobe je podrazumevano, ali se sme okrenuti u dobavljač → hotel → tip sobe (pogled nabavke) ili vrsta ugovora → hotel (pogled rizika: "šta je čarter, gde nam gori novac").

**Poseban, izdvojen pogled — samo `CHARTER` i `FIXED_LEASE`.** Tamo neprodato nije propuštena prilika nego direktan trošak agencije (M3 §2.3a). Mislim da to zaslužuje sopstveni ulaz u ekran, sa novcem u ćeliji, ne samo brojem soba.

### 5.4 Ostali proizvodi — šta je "kapacitet" za šta

| Vrsta                    | Jedinica kapaciteta                            | Kolona (vreme)                           | Ima li podatak danas                                |
| :----------------------- | :--------------------------------------------- | :--------------------------------------- | :-------------------------------------------------- |
| `ACCOMMODATION`          | soba po tipu                                   | noć                                      | da (izvedeno, poglavlje 4)                          |
| `EXCURSION`              | mesto na polasku (`max_participants`, M2 §2.3) | datum polaska                            | delimično — maksimum postoji, polasci kao datumi ne |
| `TRANSFER` / `TRANSPORT` | mesto u vozilu (`max_passengers`)              | datum/termin                             | delimično, isto                                     |
| `FLIGHT` (čarter)        | sedište                                        | datum leta (jedan proizvod = jedna noga) | da, ako je ugovoren kao `CHARTER` period            |
| `CRUISE`                 | kabina po tipu                                 | polazak                                  | ne, treba isti tretman kao smeštaj                  |
| `TICKET` / `EVENT`       | ulaznica                                       | datum događaja                           | ne                                                  |

**Iskren nalaz:** za sve osim smeštaja i čarter letova, "kapacitet po datumu" traži da negde postoji **polazak kao zapis** (datum + mesta + prodato). Danas ga nema — `max_participants` je svojstvo proizvoda, ne stanje na dan. To je isti `CapacityDay` posao iz koraka 2, samo za drugu vrstu proizvoda. Zato predlažem da **prva verzija pokrije smeštaj i čarter**, a ostalo dođe zajedno sa korakom 2 — inače bi ekran za izlete pokazivao prazno i delovao pokvareno.

### 5.5 Šta se s ekrana radi (ne samo gleda)

- klik na ćeliju → dan: koje rezervacije čine taj broj, sa vezom ka svakoj (M5);
- iz istog dana → nova rezervacija za taj termin;
- kad postoji korak 2: zatvori/otvori prodaju za datum, blokiraj N jedinica, korekcija kapaciteta — sa obaveznim razlogom i upisom u audit log (M1);
- pošalji stanje dobavljaču (M22/„Najave dobavljačima");
- sažeta verzija za subagente (M7) — bez brojeva i bez identiteta dobavljača (M2 §5.1 pravilo skrivanja), samo "ima / na upit / nema".

### 5.6 Dozvole

Nova dozvola `M3/capacity-grid/VIEW` (Vlasnik, Direktor, Sales Manager, Prodajni agent — prodaji ovo treba svakodnevno), a izmena kapaciteta ostaje na postojećoj M3 dozvoli za ugovore. Ako se doda pogled sa novcem za čarter (§5.3), taj deo ide uz `report:profitability` krug, jer prikazuje maržu.

### 5.7 Veza sa M18 (alarmi)

M3 §4.3 već šalje događaj za nizak preostali kapacitet, a M18 ga već sluša. Mreža je prirodno mesto gde se taj alarm i **vidi** — a ne samo stigne kao poruka. Preporuka: iz alarma vodi veza pravo na tu ćeliju.

---

## 6. Šta bi trebalo dopuniti u specifikacijama pre koda

Redosled je bitan — tvrdo pravilo iz CLAUDE.md (nema koda bez oslonca u specifikaciji):

1. **M3 spec** — novo poglavlje o pregledu kapaciteta po danu: izvedeni izračun (korak 1), i `CapacityDay` + stop-sale kao korak 2 (time se zatvara i postojeća otvorena stavka iz M3 §8).
2. **M2 spec** — polazak kao zapis za `EXCURSION`/`TRANSFER`/`CRUISE`, ako se ide dalje od smeštaja.
3. **M17 spec** — nov ekran i njegovo mesto u navigaciji.
4. **M7 spec** — sažeta verzija prikaza za subagente.
5. **Dizajn dokument §2.0f** — pravilo "jačina = popunjenost, status = oznaka/šrafura, nikad obe kao boja pozadine".

---

## 7. Otvorena pitanja — samo za vlasnika (poslovne odluke)

> **Sva četiri odgovorena istog dana — vidi poglavlje 9.** Pitanja ostaju ovde u izvornom obliku, radi traga; četvrto je bilo loše postavljeno, ponovo je napisano i odgovoreno u 9.4.

1. **Da li dobavljači stvarno menjaju kapacitet unutar sezone i šalju stop-sale?** Ako da — koliko često? Od toga zavisi da li je korak 2 hitan ili može da čeka.
2. **Ko sme da zatvori prodaju u sistemu** — samo nabavka, ili i šef prodaje?
3. **Da li subagenti (M7) uopšte treba da vide raspoloživost po danima**, ili samo rezultat pretrage? PrimeTravel im šalje ceo dokument sa statusima po danu; to je poslovna odluka o tome koliko se pokazuje partnerima, ne tehnička.
4. **Da li se blokada kapaciteta za grupu vodi kao rezervacija ili kao blokada?** Utiče na to da li nam `CapacityDay` uopšte treba za taj slučaj.

---

## 8. Procena obima (gruba, radi odlučivanja)

| Deo                                                                                 | Obim                      | Šta se dobija                                                         |
| :---------------------------------------------------------------------------------- | :------------------------ | :-------------------------------------------------------------------- |
| Korak 1 — mreža za smeštaj i čarter, izvedeno iz postojećih podataka, samo gledanje | jedan radni prolaz        | pun dnevni pregled ugovorenog/prodatog/slobodnog, filteri, drill-down |
| Sažeta verzija za slanje (M7/M22)                                                   | mali dodatak na korak 1   | ono što PrimeTravel šalje subagentima                                 |
| Korak 2 — `CapacityDay`, stop-sale, blokade, izmena sa ekrana                       | zaseban prolaz, dira bazu | ekran postaje alat za rad, ne samo prikaz                             |
| Ne-smeštajni proizvodi (polasci)                                                    | ide uz korak 2            | izleti, transferi, krstarenja                                         |

> **Ispravljeno posle vlasnikovog odgovora (poglavlje 9).** Tabela iznad je pisana pod pretpostavkom da je stop-sale redak. Nije. Novi redosled: **prvi prolaz = `CapacityDay` + stop-sale + mreža za smeštaj i čarter** (jedan zaokružen posao, dira bazu); **drugi prolaz** = definisana raspoloživost za subagente (poglavlje 9.3) i ne-smeštajni polasci. Sažeta verzija za slanje ostaje mali dodatak, bilo kom od ta dva.

---

## 9. Odgovori vlasnika (8.9.2026) i šta menjaju

### 9.1 Stop-sale je svakodnevica, ne izuzetak — i pogađa i fiksni zakup

Vlasnik: _"Menjaju i to često izuzev kada je fiksni zakup u pitanju, ali i kod tog zakupa mogu da pošalju stop sale informaciju za sve sobe, ili pojedinačne, za sve termine ili pojedinačne."_

Ovo je najvažniji odgovor i on menja redosled posla (poglavlje 4, ispravka; poglavlje 8, ispravka). Dva zaključka:

1. **Kapacitet se menja unutar sezone kod svih modova osim `FIXED_LEASE`** — dakle izvedeni izračun (jedan `total_capacity` za ceo period) nije dovoljan ni za osnovnu tačnost, ne samo za "napredne" slučajeve.
2. **Stop-sale je odvojena stvar od kapaciteta i stiže i kod `FIXED_LEASE`.** To je bitna finesa: kod fiksnog zakupa mi smo kapacitet već platili, pa se broj soba ne menja — ali hotel svejedno može reći "ovih dana ove sobe ne primam". Znači stop-sale **ne sme** biti modelovan kao "kapacitet spušten na nulu", nego kao **zaseban status** povrh kapaciteta. Inače bi se, kad se stop-sale skine, izgubio podatak koliko je soba bilo pre njega, i finansijska obaveza po zakupu (koja ostaje!) ne bi imala pokriće u podacima.

**Šta iz toga sledi za model (predlog za M3 spec, čeka potvrdu):** stop-sale ima **dve nezavisne dimenzije obima**, tačno kako je vlasnik opisao:

| Dimenzija | Vrednosti                                                      | Primer                                             |
| :-------- | :------------------------------------------------------------- | :------------------------------------------------- |
| **Šta**   | ceo objekat (sve sobe iz ugovora) **ili** pojedinačni tip sobe | "zatvoreno sve" / "zatvorene samo apartmani"       |
| **Kada**  | ceo period **ili** pojedinačni datumi/raspon                   | "zatvoreno do kraja sezone" / "zatvoreno 12–15.7." |

Sve četiri kombinacije se moraju moći uneti, i sve četiri se svode na isti zapis po danu — "zatvori sve za ceo period" je samo masovni unos, ne poseban tip zapisa. Uz svaki zapis ide **ko ga je uneo, kada, i po čijoj informaciji** (dobavljač — mejl, telefon, portal), jer je to podatak koji se kasnije traži kad nastane spor.

### 9.2 Ko sme da zatvori prodaju — dozvola, ne uloga

Vlasnik: _"Svako kome to dozvolimo."_

Znači ne fiksni spisak uloga, nego **dozvola koja se dodeljuje** — što je tačno ono što M1 već ume: dozvola ide uz ulogu, ali postoji i pojedinačno odstupanje po korisniku (`user_permission_overrides`), pa se sme dati baš jednoj osobi bez menjanja cele uloge.

Predlog: dve odvojene dozvole, jer to nisu iste odgovornosti:

- `M3/capacity/VIEW` — gledanje mreže (široko: prodaja, nabavka, uprava),
- `M3/capacity/CLOSE_SALE` — zatvaranje/otvaranje prodaje i blokada (usko, i uvek uz obavezan razlog + audit log).

Podrazumevano ide Vlasnik/Direktor/nabavka; svako drugo dodeljivanje je tvoja odluka po osobi.

### 9.3 Subagenti vide raspoloživost koju im mi definišemo — nov mehanizam, ne postoji danas

Vlasnik: _"Subagenti treba da vide raspoloživost koju smo za njih definisali koju mogu da vide."_ Dopunjeno odgovorom istog dana: _"treba omogućiti da se i na nivou svih ili pojedinačnih subagenata dodeli jedan deo kapaciteta koji smo uzeli, od ukupnog kapaciteta, za neki tip smeštaja ili za sve tipove smeštaja jednog hotela."_ Preciznost: **semafor podrazumevano, tačan broj samo kome se izričito odobri.**

**Iskren nalaz: toga danas nema.** M7 subagent vidi katalog filtriran po tome da li je proizvod uopšte otvoren za B2B kanal (M2 `visible_channels`) — pravilo **po proizvodu, isto za sve subagente**. Nema mesta gde bi se reklo "subagentu X je od naših 20 soba vidljivo 5".

**Oblik dodele je isti kao kod stop-sale (9.1) — dve nezavisne dimenzije**, što je dobra vest: jedan obrazac unosa pokriva oba, ne uči se dvaput:

| Dimenzija  | Vrednosti                                                 |
| :--------- | :-------------------------------------------------------- |
| **Kome**   | svim subagentima (opšte pravilo) **ili** jednom određenom |
| **Na šta** | jedan tip smeštaja **ili** svi tipovi jednog hotela       |

Uz to ide raspon datuma i broj jedinica. Kad postoji i opšte pravilo i pravilo za konkretnog subagenta, **jače je ono uže** (pravilo za tog subagenta pobeđuje opšte) — inače se ne bi moglo napraviti "svima 3, ali partneru koji nam donosi pola prometa 8".

**Jedna tehnička odluka koju donosim ovde, sa obrazloženjem** (jer nije poslovna, nego posledica): dodela je **gornja granica, ne rezervacija**. To znači: subagent ne može uzeti više od svojih 5 soba, ali tih 5 soba **niko ne drži praznim** za njega — ako ih on ne proda, prodaje ih neko drugi. Suprotno rešenje (soba fizički odvojena i čeka partnera) je bilo standard pre petnaestak godina i danas se izbegava upravo zato što ostavlja kapacitet neprodat dok postoji tražnja. Ako za nekog ključnog partnera stvarno treba **garantovan** deo, to se rešava blokadom iz 9.4 (koja je već tu i ima rok), ne posebnim mehanizmom.

Broj se zadaje **kao broj jedinica, ne kao procenat** — procenat od kapaciteta koji se menja iz dana u dan (9.1) znači da se partnerova kvota tiho menja svaki put kad hotel promeni kapacitet, što niko ne bi mogao da isprati.

Šta subagent na kraju vidi kao slobodno: **manje od dve stvari** — koliko je ostalo od njegove kvote i koliko je stvarno slobodno ukupno. (Ako je njegova kvota 5, a ukupno slobodne su 2 sobe — vidi 2, ne 5.)

### 9.4 Držanje kapaciteta za nepotvrđenu grupu — blokada, ne rezervacija

Vlasnik je izabrao **blokadu kapaciteta**: sobe se izuzimaju iz prodaje, ali nema rezervacije ni gosta — stoji samo razlog i rok ("držimo za školu iz Kragujevca do 20.5.").

Posledice, sve tri važne:

1. **Mreža dobija treću vrstu polja** pored "slobodno" i "prodato" — **"blokirano"**. Bez toga bi 10 blokiranih soba izgledalo kao slobodne, i neko bi ih prodao.
2. **Blokada nije prodaja** — ne ulazi u prihod, ne broji se u popunjenost kao prodato, i u izveštajima (M13) mora stajati odvojeno. Ovo je razlog zašto je izbor dobar: da se vodilo kao rezervacija, svaki izveštaj prodaje bio bi netačan dok grupa ne potvrdi.
3. **Rok je obavezan, i sam se gasi.** Blokada bez roka je najsigurniji način da se kapacitet trajno izgubi — neko blokira 10 soba u martu, grupa se nikad ne javi, i sobe stoje do septembra jer ih se niko ne seti. Predlog: rok je obavezno polje, sistem sam vraća sobe u prodaju kad istekne, i javlja (M18) dan-dva ranije da rok ističe.

### 9.6 Prekoračen kapacitet se prikazuje kao minus (8.9.2026, dopuna posle pitanja "gde se kapacitet definiše")

Pri proveri gde se kapacitet uopšte unosi otkriveno je da se ugovorni period može **napraviti, ali ne i izmeniti ni obrisati** — `PATCH`/`DELETE` nikad nisu postojali, iako dozvola `M3/contract-period/EDIT` stoji u specifikaciji od prve verzije. Uz to je postavljeno pitanje šta raditi kad se kapacitet smanji **ispod već prodatog**.

**Vlasnikova odluka: dozvoliti, i prikazati sa minusom ispred.**

Posledice, upisane u M3 v1.16 (§2.3d, §2.8c), M17 v2.61 (§4b.2) i M18 v1.14:

- smanjenje ispod prodatog **prolazi**, uz upozorenje pre potvrde, audit zapis sa starom i novom vrednošću i događaj `capacity_oversold`;
- raspoloživost se razdvaja na dve vrednosti: **`razlika`** (prikaz — sme biti negativna) i **`za_prodaju`** (odluka o prodaji — nikad negativna). Nula bi se pročitala kao "puno, u redu je"; **−3** se čita kao "tri gosta nemaju gde";
- prodaja za taj datum staje, ali se **nijedna postojeća rezervacija ne otkazuje automatski** — koga premestiti je ljudska odluka;
- M18 dobija `CAPACITY_OVERSOLD` kao `CRITICAL` signal, da se ne oslanja na to da neko gleda baš taj ekran.

### 9.5 Šta iz svih odgovora sledi za model — sažeto

Sve iz poglavlja 9 svodi se na **jedan zapis stanja po danu** i **tri zasebna zapisa razloga** iznad njega:

| Zapis                              | Šta nosi                                                 | Zašto zaseban                                                                     |
| :--------------------------------- | :------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **stanje po danu** (`CapacityDay`) | ukupan kapacitet za taj datum i tip sobe                 | jedini način da se zna stanje na dan (9.1)                                        |
| **zatvaranje prodaje** (stop-sale) | status OTVORENO/ZATVORENO + ko/kada/po čijoj informaciji | stiže i kad kapacitet ostaje (fiksni zakup), pa ne sme biti "kapacitet = 0" (9.1) |
| **blokada**                        | broj jedinica + razlog + **rok** + ko je postavio        | nije prodaja, ne sme ući u prihod/popunjenost (9.4)                               |
| **dodela subagentu**               | kome + na šta + koliko + raspon datuma                   | gornja granica po partneru, ne rezervacija (9.3)                                  |

Prodato se **ne upisuje** nigde od ovoga — i dalje se računa iz M5 rezervacija (poglavlje 4), jer rezervacija je izvor istine i svako duplo vođenje istog broja pre ili kasnije razilazi.

Slobodno za internu prodaju = `kapacitet − prodato − blokirano`, i 0 ako je prodaja zatvorena.
Slobodno za subagenta = manje od te dve vrednosti: gornja granica iz njegove dodele i gore izračunato slobodno.

---

_Ovaj dokument je predlog, ne odluka. Ništa iz njega se ne implementira dok vlasnik ne potvrdi obim i dok odgovarajuće Nivo 2 specifikacije (poglavlje 6) ne budu dopunjene._
