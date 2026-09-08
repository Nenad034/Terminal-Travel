# Predlog — mreža kapaciteta ("ko je gde slobodan, kog dana")

**Status:** Predlog, bez koda. Nastao 8.9.2026. na zahtev vlasnika, odmah pošto je M13 §4.4 dobio toplotnu mapu za vremenske obrasce: _"dopada mi se ova mapa i mislim da možemo da je iskoristimo za pregled smeštajnih i kapaciteta drugih proizvoda, po više kriterijuma. Za sada samo zapišite i razradite, konsultujući relevantne izvore na internetu ali i PrimeTravel jer mislim da je to tamo jako dobro urađeno."_
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

---

_Ovaj dokument je predlog, ne odluka. Ništa iz njega se ne implementira dok vlasnik ne potvrdi obim i dok odgovarajuće Nivo 2 specifikacije (poglavlje 6) ne budu dopunjene._
