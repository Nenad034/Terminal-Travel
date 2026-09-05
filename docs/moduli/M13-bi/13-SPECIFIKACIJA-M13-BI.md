# Specifikacija modula M13 — Izveštavanje i BI

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M13) i poglavlje 8 (Faza 5)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026) — vidi poglavlje 8 (izlazni kriterijum) i `docs/api/M13-bi.md`
**Verzija:** 1.12 — Datumski filter po izabranom polju + segment B2B/B2C/Subagenti, svih pet izveštaja; infografik prati kolone tabele (5.9.2026, vlasnikov zahtev: "dinamicki izvestaj treba da ima datume za filtriranje po sledecim kriterijumima. Isto tako i ostali izvestaji. Treba dodati i fitere Subagenti, B2B, B2C kao i: Kreirano od...do, Dolasci od...do, Odlasci od...do. Mozete staviti jedan kalendar a ovo gore kao okidace sta treba da se filtrura, da ustedimo prostor." + "Infografik treba da ima prikaz po kolonama tabele"). Potvrđeno preko `AskUserQuestion` pre pisanja koda (tvrdo pravilo — nova funkcionalnost): (a) `from`/`to` MENjaju značenje umesto da se dodaju tri nezavisna para (štedi prostor, tačno vlasnikov predlog "jedan kalendar + okidači"); (b) segment tačno jedan aktivan, isti princip kao ikonice vrste proizvoda. (1) `PeriodFilter` dobija `dateField` (`created`→`bookingDate`, `stay_from`→`stayFrom`/dolazak, `stay_to`→`stayTo`/odlazak — isti nazivi kriterijuma kao "Lista rezervacija" `createdFrom/To`/`stayFrom/To`/`returnFrom/To`, samo JEDAN aktivan par umesto tri istovremena) i `segment` (`B2B`→`channel=B2B_PORTAL`, `B2C`→`channel=B2C_SITE`, `SUBAGENT`→`subagentName != null`, nezavisno od kanala). Bez `dateField` ostaje STARO ponašanje (preklapanje sa terminom boravka) — kompatibilnost sa pozivaocima koji ga ne šalju (npr. M15 omnisearch). Primenjeno u `periodWhere()`/`segmentWhere()`, jednom mestu — automatski važi za svih pet izveštaja (`profitability`/`sales`/`occupancy`/`dynamic`/`marketing`) bez ponavljanja po metodi. Kontroler dobija `dateField`/`segment` query parametre + validaciju (isto `BadRequestException` obrazac kao `group_by`) na svih pet ruta. (2) Panel (`izvestaji/page.tsx`) — filter forma dobija JEDAN zajednički red (svi tabovi): od/do + segmentovano dugme "odnosi se na" (Dolasci/Odlasci/Kreirano, `<Link>` menja `dateField`, podrazumevano "Dolasci") + segmentovano dugme "segment" (svi/B2B/B2C/Subagenti). Zamenjuje raniji jedini par od/do na vrhu forme (uklj. dupliranu verziju uz "Dinamički" iz v1.11 — sad je isti zajednički red, bez posebnog slučaja za taj tab). (3) Infografik po kolonama tabele — `PROFIT_SERIES`/`REVENUE_SERIES`/`NIGHTS_SERIES` (delimično) zamenjeni sa `MARGIN_SERIES` (neto/bruto/marža — tačne kolone `BucketTable` kad je `showMargin`, primenjeno na profitabilnost SVE tri podtabele + prodaja obe podtabele) i `OCCUPANCY_SERIES` (stavki/noćenja — kolone `OccupancyBreakdown`); marketing zadržava `REVENUE_SERIES` (tabela bez marže, jedina kolona je prihod). "Dinamički" (v1.10 je prikazivao samo prihod na najdubljem nivou) sad nosi SVIH šest kolona `DynamicTree` tabele (rezervacija/osoba/noćenja/prihod/naplaćeno/saldo) po istom najdubljem nivou. **Provera:** `tsc --noEmit` čist za `apps/api`+`apps/panel`; puna jest suita `apps/api` prolazi (bez novog jediničnog testa za `dateField`/`segment` grane — otvorena stavka, isti obrazac kao v1.9/v1.10).
**Verzija:** 1.11 — Raspored filter forme "Dinamički": Kanal/Dobavljač iznad tabele, dva reda umesto tri (5.9.2026, vlasnikov zahtev: "po kriterijumu kanal i dobavljac linkove stavite iznad desne gornje ivice tabele... da ne bi bilo 3 vec dva reda polja za pretragu datuma premestite u istu liniju sa poljem po pretrazi pojma"). `DYNAMIC_OTHER_PRESETS` (Kanal/Dobavljač, v1.10) izmešten IZ filter forme u sam sadržaj izveštaja — desno poravnat red neposredno iznad tabele/grafika (`izvestaj-sadrzaj`). Preostala dva reda filter forme za ovaj tab: (1) ikonice vrsta proizvoda, (2) od/do datum + ručno polje za dimenzije spojeni u JEDAN red (ranije: datumi na vrhu forme, odvojeno od ručnog polja — vizuelno tri reda umesto dva, otud utisak da polje za ručni unos dimenzija "ne radi", iako je funkcionalno bilo ispravno). **Provera:** `tsc --noEmit` čist za `apps/panel` (bez promene na `apps/api`).
**Verzija:** 1.10 — Ikonice vrsta proizvoda umesto tekstualnih preseta u "Dinamički", grafik prati tabelu (5.9.2026, vlasnikov zahtev: "nije dobro ovo kod dinamickih paketa. Stavi ikone iz pretrage i koju ikonu ukljucimo za to treba da se kreira dinamicki izvestaj i sve treba da ide u tri nivoa Drzava, Mesto, proizvod koji smo odabrali. Infografik takodje treba da bude dinamicki i da prati tabelu."). (1) `DYNAMIC_PRESETS` (v1.8/v1.9, tekstualni "Destinacija"/"Destinacija → Hotel") ukinut — zamenjen ikonicama vrste proizvoda, ISTI izvor kao ekran pretrage (`PRODUCT_ICONS`, `apps/panel/src/lib/search-product-types.ts`, jedan izvor istine). Klik na ikonicu UVEK postavlja fiksan trodelni niz dimenzija `destination_country,destination_city,product_name` (`DYNAMIC_DRILLDOWN_DIMS`), filtriran na `productType` te ikonice — "proizvod koji smo odabrali" = `product_name` filtriran na kliknutu vrstu, ne mešano kao ranije. "Kanal"/"Dobavljač" ostaju kao odvojeni tekstualni preseti (`DYNAMIC_OTHER_PRESETS`) jer nemaju smisla vezani za jednu vrstu proizvoda. (2) `dynamic()`/`GET /bi/reports/dynamic` `productType` sad prima i listu razdvojenu zarezom (`Prisma` `{in: [...]}`) — potrebno jer neke ikonice pokrivaju više `ProductType` vrednosti odjednom (npr. "Things to do" = EXCURSION,EVENT,TICKET); jedna vrednost i dalje radi kao ravnopravnost (nepromenjeno ponašanje iz v1.9). (3) Grafik prikaz "Dinamički" (v1.8: samo prvi nivo/vrh stabla) sad prikazuje NAJDUBLJI nivo (listove stabla, `flattenDynamicLeaves`, puna putanja država › mesto › proizvod kao naziv reda) — prati tačno ono što tabela ispod pokazuje kad je do kraja proširena, ne stariji, plići prikaz. **Poznat, neotklonjen nedostatak** (ne ćuti se): ikonice "Grupni paketi" i "Putovanja" (`lib/search-product-types.ts`) dele isti `types: ['PACKAGE']` — razlikuju se samo poljem `hasExpertGuide`, koje M13 `FactBooking` projekcija ne prati, pa obe ikonice danas daju IDENTIČAN dinamički izveštaj (nema pogrešnih podataka, samo nema razlikovanja); rešenje zahteva dopunu M13 projekcije novim poljem, van obima ovog prolaza. **Provera:** `tsc --noEmit` čist za `apps/api`+`apps/panel`; puna jest suita `apps/api` prolazi (nema novog jediničnog testa za `productType` IN-listu — ista otvorena stavka kao u v1.9).
**Verzija:** 1.9 — Ispravka: "Destinacija → Hotel" je mešala sve vrste proizvoda (5.9.2026, vlasnikov nalaz: "niste dodali hotele u destinacijama"). `product_name` (dimenzija) sam po sebi ne razlikuje vrstu proizvoda — preset iz v1.8 je pod istom destinacijom mešao hotele, transfere, izlete, karte... `dynamic()`/`GET /bi/reports/dynamic` dobijaju opcioni `productType` (isti obrazac kao `sales()`); `DYNAMIC_PRESETS` "Destinacija → Hotel" sad DODATNO šalje `productType=ACCOMMODATION` (ostali preseti bez filtera — kanal/dobavljač imaju smisla za sve vrste). **Provera:** `tsc --noEmit` čist za `apps/api`+`apps/panel`; 1012/1012 postojećih testova prolazi (nema novog jediničnog testa za ovu granu — otvorena stavka za sledeći prolaz kroz M13 testove).
**Verzija:** 1.8 — "Dinamički" izveštaj: grafik prikaz, preset dimenzija, boldirani totali, sklapanje grana (5.9.2026, vlasnikovi zahtevi u nizu). (1) Prekidač tabela/grafik (do sad izuzet za ovaj tab) sad radi i ovde — grafik prikazuje SAMO vrhove stabla (`DYNAMIC_SERIES`, prvi nivo, isti princip kao ostali izveštaji, ne prati ugnježdenu strukturu). (2) `DYNAMIC_PRESETS` — brzi izbor kombinacije dimenzija ("Destinacija", **"Destinacija → Hotel"** — vlasnikov zahtev: "dodajte i pregled na nivou hotela na destinacijama", "Kanal", "Dobavljač") umesto ručnog kucanja tačnih imena dimenzija u tekstualno polje (koje i dalje postoji, presek samo ubacuje vrednost u njega preko `groupBy` parametra adrese). (3) Svaki čvor SA DECOM (roditelj = zbir dece, §4.2.1) je total te grane — podebljan (vlasnikov zahtev: "boldiraj totale po drzavama"; princip radi za bilo koju izabranu dimenziju, ne samo državu). (4) `DynamicTree` (novo: `apps/panel/src/app/(app)/izvestaji/DynamicTree.tsx`, izdvojeno u SOPSTVEN klijentski fajl — sklapanje je čisto lokalno stanje ekrana, `izvestaji/page.tsx` ostaje server komponenta) — svaki red sa decom dobija "+"/"−" dugme (vlasnikov zahtev: "uvedite + i - za sirenje prikaza kod drzava i destinacija"), sklapanje/širenje po PUTANJI čvora (ne po golom nazivu — dva čvora na različitim granama mogu deliti isti naziv), podrazumevano SVE prošireno (identično ponašanju pre ove dopune).
**Verzija:** 1.7 — Neto/bruto/marža kolone, totali i linkovanje ka rezervacijama u tabelama Profitabilnost/Prodaja (5.9.2026, vlasnikov zahtev: "tabela za profitabilnost i prodaju treba da imaju neto kolonu, bruto kolonu, marzu u procentima, marzu u iznosu, ostavite i % u odnosu na total... nigde nemate totale, treba i to da uvedete... omogucite da sve sto se nalazi u tabelama linkujete prema rezervacijama"). `reports.service.ts` `Bucket` dobija `baseCost` (neto — `FactBooking.baseCost`, DOSAD se nigde nije agregirao po grupi, samo razlika `margin`); `revenue` ostaje bruto (nepromenjeno). Kolone tabele: naziv | rezervacija | neto | bruto | marža % (marža/bruto ZA TAJ RED, "razlika u ceni") | marža (iznos) | udeo (% u odnosu na ukupan bruto CELE tabele, nepromenjeno od v1.65). Svaka tabela dobija red "Ukupno" (zbir cele grupe, ne samo prikazanih redova). Naziv reda postaje link ka `/rezervacije/lista` sa filterom TE grupe + istim periodom (`from`/`to` → `stayFrom`/`stayTo`) — radi već danas bez ijedne nove linije backend koda za destinaciju/kanal/tip proizvoda (`GET /sales/bookings` već prima `destinationCountry`/`destinationCity`/`channel`/`productType`, panel `lista/page.tsx` prosleđuje SVAKI query parametar generički). **Poznat, svesno odložen nedostatak** (ne ćuti se): "Po dobavljaču/provajderu" (profitabilnost) i "po sadržaju" (marketing) NEMAJU link — "Lista rezervacija" danas nema filter ni po dobavljaču ni po marketing sadržaju, dodavanje bi zahtevalo novu M5 filter dimenziju (poseban zadatak). "poslednje ažurirano" i "Podeli izveštaj" premešteni u ZAJEDNIČKO gornje zaglavlje ekrana (pored prekidača tabela/grafik), umesto ponavljanja u svakom od pet blokova — vlasnikov zahtev: "ovo premestite pored dugmadi za biranje tabele ili infografika... za toliko podignite deo ispod ovog teksta".
**Verzija:** 1.6 — Deljenje izveštaja putem internog chata i mejla (5.9.2026, vlasnikov zahtev: "omogucite sada slanje izvestaja putem mejla, ili putem poruka... mislim i na infografik i tekstualno"). Ekran `/izvestaji` (M17) dobija dugme "Podeli izveštaj" sa dva kanala i dva formata, potvrđeno preko `AskUserQuestion` (vidi obrazloženje ispod tabele endpoint-a, poglavlje 7):
  - **Interni chat (tekst/tabela)** — ponovo koristi POSTOJEĆI M15 §6.9.3 mehanizam ("Pošalji u chat" u BI Terminalu, `TerminalPanel.tsx`/`bi-terminal.service.ts sendReportToChat`) koji generiše Excel/PDF/HTML fajl i prilaže ga kao pravu M19 poruku — ali NIJE isti endpoint (taj je zaključan na `M15/bi-terminal/VIEW`, isključivo Vlasnik uloga, pogrešno ograničenje za opšti M13 izveštaj). `report-generator.ts`/`report-store.ts` (generisanje Excel/PDF/HTML fajla + 30-minutni prolazan zapis u memoriji) sele se iz `apps/api/src/modules/m15-ai-orkestracija/bi-terminal/` u `apps/api/src/common/reports/` — čista, poslovno-neutralna prezentaciona funkcija, deljena između M15 (nepromenjeno ponašanje) i M13 (novo).
  - **Interni chat (infografik)** — klijent (već renderovan grafik, `BarChart.tsx`) se pretvara u PNG preko `html2canvas` (nova zavisnost, potvrđena preko `AskUserQuestion` — `docs/00-MASTER-ARHITEKTURA.md` poglavlje 6 se dopunjuje u istom prolazu) i šalje se kao slika-prilog, isti M19 tok kao fajl iznad.
  - **Mejl** — NAMERNO `mailto:` link (potvrđeno preko `AskUserQuestion`), ne pravo slanje sa servera. Pravo "sastavi i pošalji mejl proizvoljnom primaocu" je već zavedena, blokirana stavka (`docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, M22 "Compose") — ovaj prolaz je NE rešava, samo otvara korisnikov lokalni mejl program sa unapred popunjenim naslovom/telom (tekstualna tabela). Bez priloga (mailto nema prilog) — infografik preko mejla NIJE ponuđen, samo preko chata.
  - **"Kibana" tabela** — vizuelni stil postojećih tabela na ekranu `/izvestaji` (`BucketTable`/`SubTabBar` i srodne) se doteruje: moноspejs poravnati brojevi, suptilne pruge između redova, sitne "beidž" oznake za kategorije — isti stil se koristi i za tekstualni sadržaj poslat u chat/mejl, ne samo za ekran.
  Detalji endpoint-a: poglavlje 7 ispod.
**Verzija:** 1.5 — **Rekonsilijacija radi u serijama, ne nad celim skupom odjednom** (5.9.2026, dok. 39 nalaz 2.3). Do tada je §2 noćni posao učitavao SVE `BookingItem` zapise u memoriju i za svaki radio zaseban skup upita (~16 po stavci, ne 3 kako je prvi nalaz procenio) — sa 10.000 stavki to su desetine hiljada upita u jednoj operaciji. Sada: serije po 500 sa kretanjem po `id` (ne `skip`, koji na velikoj tabeli usporava što dalje odmiče), jedan upit po seriji za stanje pre i posle umesto dva po stavci, keš za jedan prolaz (`FactSyncCache`) nad podacima koji se ponavljaju (proizvod/ugovor/dobavljač/klijent/kurs), i čišćenje siročadi jednom SQL naredbom umesto poređenja svih identifikatora u memoriji. Keš namerno NE živi između prolaza — poslu je svrha da uhvati promene u izvornim modulima. Ispravljeno i to da se projektovane uplate čiji izvor više ne kvalifikuje sada stvarno BRIŠU (ranije su se samo brojale). **Provera:** izmereno na živom sistemu istom metodom na obe verzije (25 stavki + 13 uplata): 395–451 pretraga tabela pre, 292–315 posle; rezultat rekonsilijacije nepromenjen, ponovljen prolaz javlja 0 ispravki (idempotentno), 1.012 testova prolazi. Pošteno: na ovom obimu dobitak je ~25% i tako se i prijavljuje — suština je uklonjen obrazac koji bi na stvarnom obimu pukao, a ne izmerena brzina.
**Verzija:** 1.4 — dopuna (avgust 2026): M12 je implementiran, pa `FactSyncService.resolveContentAttribution` (poglavlje 4.3) više nije stub koji uvek vraća `null` — sad zaista poziva M12 `ContentService.findByTrackingCode` preko in-process DI (isti obrazac kao ostali cross-modul pozivi u `fact-sync.service.ts`: M2/M3/M6/M7/M10), jer M12 ne uvozi ništa iz M13 (bez kružne zavisnosti). Ponašanje ostaje identično specifikaciji: nepostojeći/pogrešan `tracking_code` i dalje daje `null`, nikad izmišljenu atribuciju; v1.3 — implementacija (avgust 2026): dopunjena tabela §3.1 sa `booking_id` i §3.2 sa `payment_id`, oba otkrivena pri implementaciji (potreban stabilan weak-ref ključ za idempotentan upsert i za spoj FactBooking↔FactPayment u §4.2.1 paid/balance); v1.2 dodat izveštaj "Marketing performanse" (poglavlje 4.3, `FactBooking.referral_content_id`/`referral_content_name`), atribucija rezervacije ka M12 sadržaju preko M5 `referral_tracking_code` — zatvara M12↔M13 integracionu prazninu iz backlog-a (avgust 2026, na zahtev vlasnika); v1.1 dodat dinamički izveštaj sa korisnički sastavljivim redosledom dimenzija (poglavlje 4.2) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** svi moduli, read-only (poglavlje 4 Master dokumenta); formalno i od M5 (`referral_tracking_code`) i M12 (`ContentPiece.tracking_code`) za poglavlje 4.3

---

## 1. Svrha i obim modula

M13 daje upravljačke izveštaje (profitabilnost, prodaja, kasnije marketing performanse) nad podacima svih modula. Faza 5 izlazni kriterijum (poglavlje 8 Master dokumenta) je konkretan: **menadžment vidi profitabilnost po destinaciji/dobavljaču/kanalu.**

### 1.1 Važno razjašnjenje — M13 ne krši princip "jedan izvor istine"

M13 **ne čita direktno iz baza drugih modula** (princip #2, poglavlje 3 Master dokumenta) i **ne postaje novi izvor istine** za bilo koji podatak. Umesto toga, gradi sopstvenu **izvedenu, obnovljivu projekciju** (agregiranu/denormalizovanu kopiju radi brzine izveštavanja) — potpuno analogno lenjom keširanju u M2 (poglavlje 3 te specifikacije), samo primenjeno na BI umesto na katalog. Ako se projekcija izbriše, može se u potpunosti ponovo izgraditi iz izvornih modula — nijedan podatak ne postoji *samo* u M13.

---

## 2. Arhitektura — Event Bus + periodična rekonsilijacija

- M13 se pretplaćuje na događaje iz Event Bus-a koje već emituju drugi moduli (`booking.confirmed`, `booking.modified`, `booking.cancelled` iz M5; slično iz M10/M11 kad budu emitovali) i ažurira sopstvenu projekciju u skoro-realnom-vremenu.
- Pošto se pojedinačni događaj može izgubiti (pad servisa, mrežni problem), **noćni posao rekonsilijacije** povlači stanje direktno preko API-ja izvornih modula (ne baze) i upoređuje sa projekcijom M13, ispravljajući odstupanja. Ovo je namerna samoisceljujuća mera — BI podaci koji tiho "iskliznu" iz sinhronizacije su gori od podataka koji kasne uz jasnu oznaku vremena poslednjeg osvežavanja.
- Svaki izveštaj prikazuje `poslednje_ažurirano` vreme, da korisnik zna koliko su podaci sveži.

---

## 3. Model podataka (projekcija)

### 3.1 `FactBooking` — denormalizovana činjenična tabela
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_item_id | UUID | referenca ka M5, ne FK sa ograničenjem (projekcija je nezavisna); unique — jedan red po stavci, omogućava idempotentan upsert |
| booking_id | UUID | dopuna otkrivena pri implementaciji (avgust 2026) — referenca ka M5 `Booking`, potrebna da se §4.2.1 `paid`/`balance` po čvoru spoji sa `FactPayment.booking_id` bez live upita ka M5 |
| booking_date | date | datum potvrde |
| stay_from / stay_to | date | |
| nights | integer | izvedeno: `stay_to − stay_from` u danima, čuva se radi brzine agregacije |
| guest_count | integer | broj osoba na ovoj stavci — `COUNT(BookingItemGuest)` iz M5, za sve tipove proizvoda |
| product_id / product_type | UUID / string | iz M2 |
| accommodation_type / stars | string, nullable / integer, nullable | iz M2 `Product.attributes`, samo za `product_type = ACCOMMODATION` |
| room_type | string, nullable | iz M3 `ContractPeriod.room_type` (preko `BookingItem.rate_line_id` → `RateLine.contract_period_id`), samo za `CONTRACTED` `ACCOMMODATION` stavke |
| board_type | string, nullable | iz M3 `RateLine.board_type` (preko `BookingItem.rate_line_id`), samo za `CONTRACTED` stavke |
| destination_country / destination_city | string | iz M2 |
| source_type | enum: `CONTRACTED`, `API` | |
| supplier_id | UUID, nullable | iz M3, ako `CONTRACTED` |
| provider_code | string, nullable | iz M4, ako `API` |
| channel | string | iz M5 |
| client_account_id | UUID | iz M6 |
| base_cost / final_price / currency | decimal / decimal / string | iz M5 |
| margin | decimal | izračunato: `final_price − base_cost` |
| product_name | string | snapshot naziva proizvoda (M2), radi brzog grupisanja bez join-a (poglavlje 4.2) |
| supplier_name | string, nullable | snapshot naziva dobavljača (M3), popunjeno za `CONTRACTED` (poglavlje 4.2) |
| subagent_name | string, nullable | snapshot naziva subagenta (M7), popunjeno kad `client_account_id` pripada B2B nalogodavcu; `null` = direktna prodaja (poglavlje 4.2) |
| referral_content_id | UUID, nullable | dopuna avgust 2026 (poglavlje 4.3) — razrešeno poklapanjem `Booking.referral_tracking_code` (M5 poglavlje 3.1) protiv M12 `ContentPiece.tracking_code` pri sinhronizaciji; `null` ako kod nedostaje ili ne poklapa nijedan sadržaj |
| referral_content_name | string, nullable | snapshot naslova `ContentPiece` (M12), radi brzog grupisanja bez join-a — isti princip kao `product_name`/`supplier_name` |
| status | enum (isto kao BookingItem) | |
| last_synced_at | timestamp | |

**Napomena o `nights`/`guest_count`:** proizvod `guest_count × nights` daje **gost-noćenja** — standardan izveštajni koncept (broj gostiju pomnožen brojem noći boravka), koji M13 ovde definiše za potrebe izveštavanja o zauzetosti/prodaji smeštaja.

### 3.2 `FactPayment` (za finansijske izveštaje, iz M10)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| payment_id | UUID | dopuna otkrivena pri implementaciji (avgust 2026) — referenca ka M10 `Payment`, unique; stabilan ključ za idempotentan upsert, isti princip kao `FactBooking.booking_item_id` |
| booking_id | UUID | |
| amount_rsd | decimal | |
| method | string | |
| received_at | timestamp | |

---

## 4. Izveštaji

- **Profitabilnost po destinaciji/dobavljaču/kanalu** (Faza 5 izlazni kriterijum) — agregacija `margin` iz `FactBooking`, grupisano po `destination_*`, `supplier_id`/`provider_code`, `channel`, sa filterom po periodu.
- **Prodaja** — broj rezervacija, ukupna vrednost, prosečna vrednost rezervacije, po periodu/kanalu/tipu proizvoda.
- **Operativna statistika smeštaja** (poglavlje 4.1) — broj osoba, noćenja, prodate sobe.
- **Marketing performanse** (poglavlje 4.3, dopuna avgust 2026) — atribucija rezervacije ka sadržaju koji ju je doveo (M12).

### 4.1 Operativna statistika smeštaja — detalji

Svi filtrirani na period (`stay_from`/`stay_to` unutar opsega) i na aktivne stavke (`status != CANCELLED`); svi osim "broja osoba" ograničeni su na `product_type = ACCOMMODATION` (noćenja, sobe, usluga, kategorija i tip smeštaja imaju smisla samo za smeštaj):

| Izveštaj | Izračun nad `FactBooking` | Napomena |
| :---- | :---- | :---- |
| Broj osoba | `SUM(guest_count)` | za sve tipove proizvoda (ne samo smeštaj), grupivo po periodu/destinaciji/kanalu |
| Noćenja | `SUM(guest_count * nights)` | gost-noćenja (vidi napomenu u poglavlju 3.1) |
| Prodate sobe — ukupno | `COUNT(*)` gde `product_type = ACCOMMODATION` | jedan `BookingItem` = jedna prodata jedinica |
| Prodate sobe — po tipu | isto, grupisano po `room_type` | samo `CONTRACTED` stavke imaju `room_type` popunjen (poglavlje 3.1) |
| Po korišćenoj usluzi | `COUNT(*)` grupisano po `board_type` | npr. polupansion vs. all-inclusive; samo `CONTRACTED` |
| Po kategoriji hotela | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `stars` | |
| Po tipu smeštaja | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `accommodation_type` | hotel, vila, apartman, kabina na brodu, ... (M2 poglavlje 2.3) |

**Ograda:** `API`-sourced stavke (M4) po pravilu nemaju `room_type`/`board_type` popunjeno (poglavlje 3.1) — izveštaji "po tipu sobe" i "po usluzi" ih automatski isključuju iz razbijanja (ali ih broje u ukupnom "Prodate sobe — ukupno" i u "Broj osoba"/"Noćenja"), uz jasnu napomenu u prikazu koliko stavki nije razvrstano, da broj ne deluje kao da je nešto tiho izostavljeno.

### 4.2 Dinamički izveštaj — korisnički sastavljiv redosled dimenzija grupisanja

Pored fiksnih izveštaja iznad (unapred određene dimenzije), M13 izlaže i **dinamički drill-down izveštaj**: korisnik bira proizvoljan podskup i redosled dimenzija grupisanja, sistem gradi stablo rezultata tim tačnim redosledom — svaki sledeći nivo grupiše unutar prethodnog. Dodato poređenjem sa PrimeTravel `Dynamic Analytics` obrascem (biranje dimenzija klikom, sa vidljivim brojem redosleda) — konkretno korisnije rešenje od fiksnog skupa izveštaja (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`).

**Dostupne dimenzije** (svaka je postojeće ili dopunjeno polje na `FactBooking`, poglavlje 3.1 — bez novog modela podataka):

| Dimenzija | Polje |
| :---- | :---- |
| Država | `destination_country` |
| Destinacija | `destination_city` |
| Proizvod | `product_name` |
| Dobavljač | `supplier_name` (ili `provider_code` za `API` stavke) |
| Kanal | `channel` |
| Subagent | `subagent_name` (nullable — "Direktna prodaja" kad rezervacija nije preko subagenta) |

#### 4.2.1 Rezultat po čvoru stabla
Svaki čvor grupisanja vraća: `count` (broj rezervacija), `pax` (`SUM(guest_count)`), `nights` (`SUM(guest_count * nights)`, gost-noćenja — isti koncept kao poglavlje 4.1), `revenue` (`SUM(final_price)`), `paid` (`SUM(FactPayment.amount_rsd)` za rezervacije u tom čvoru, poglavlje 3.2), `balance` (`revenue − paid`), i `children[]` — sledeći nivo grupisanja unutar ovog čvora, po redosledu koji je korisnik odabrao.

#### 4.2.2 Nivo autonomije
Sastavljanje i prikaz izveštaja je čist read-only upit nad projekcijom — nivo **"Autonomno"**, isto obrazloženje kao poglavlje 5. Agent sme da predloži koristan redosled grupisanja (npr. "profitabilnost po dobavljaču unutar tri najprodavanije destinacije") na osnovu upita korisnika, ali ne menja nijedan podatak.

### 4.3 Marketing performanse — atribucija ka sadržaju (dopuna, avgust 2026 — zatvara M12↔M13 integracionu prazninu iz `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`)

Za razliku od ostalih izveštaja, ovo **nije** metrika angažovanosti sa platformi (impressions/klikovi sa Facebook/Instagram, otvaranje mejla) — namerno van obima (M12 poglavlje 9, otvoreno pitanje). Ovo je **atribucija rezervacije ka sadržaju**: da li konkretna `Booking` potiče od klika na link iz M12 `ContentPiece` (M12 poglavlje 3a, `tracking_code`).

| Izveštaj | Izračun nad `FactBooking` | Napomena |
| :---- | :---- | :---- |
| Rezervacije po sadržaju | `COUNT(*)` grupisano po `referral_content_id`/`referral_content_name` | isključuje rezervacije bez poklapanja (`referral_content_id IS NULL`) — prikazano odvojeno kao "bez poznatog porekla", ne izostavljeno tiho |
| Prihod po sadržaju | `SUM(final_price)` grupisano po `referral_content_id`/`referral_content_name` | isti princip kao profitabilnost (poglavlje 4) — prikazuje `revenue`, ne `margin`, jer M12 ne nosi trošak sadržaja |
| Udeo atribuisanih rezervacija | `COUNT(referral_content_id IS NOT NULL) / COUNT(*)` za period | koliko se prodaje uopšte može pratiti do marketinškog sadržaja — informativna mera obima praćenja, ne performansa pojedinačnog sadržaja |

**Nivo autonomije:** isti kao poglavlje 4.2.2 — čist read-only upit, nivo **"Autonomno"**.

**Ograda:** rezervacija bez `referral_tracking_code` (gost nije stigao preko označenog linka — npr. direktan dolazak na sajt, ili preko subagenta) ostaje `NULL`, ne "nepoznato = 0" — izveštaj eksplicitno prikazuje i taj broj, da se ne stvori utisak da je marketing "doneo" manje nego što zaista jeste zbog rezervacija koje nikad nisu ni trebale biti atribuisane.

---

## 5. Uloga AI agenta

Priprema internih izveštaja i uočavanje trendova (npr. "profitabilnost destinacije X pala 15% u odnosu na prošli kvartal") spada u nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — eksplicitno naveden primer ("interni izveštaji"). Agent sme samostalno da generiše i ističe ovakve nalaze; ne sme sam da menja cene/marže na osnovu njih (to ostaje ljudska odluka, M5/M7).

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M13/report:profitability/VIEW` | Vlasnik, Direktor |
| `M13/report:sales/VIEW` | Vlasnik, Direktor, Sales Manager |
| `M13/report:financial/VIEW` | Vlasnik, Direktor, Računovođa |
| `M13/report:occupancy/VIEW` | Vlasnik, Direktor, Sales Manager — operativna statistika smeštaja nije cenovno osetljiva (ne sadrži maržu), pa se deli šire od profitabilnosti |
| `M13/report:dynamic/VIEW` | Vlasnik, Direktor — kao i profitabilnost, prikazuje `revenue`/`paid`/`balance` po čvoru (poglavlje 4.2) |
| `M13/report:marketing/VIEW` | Vlasnik, Direktor — marketing performanse (poglavlje 4.3), prihod po sadržaju je cenovno osetljiv kao profitabilnost |

Napomena: `resource` polje koristi format `report:podtip`, isti obrazac koji M1 specifikacija (poglavlje 3.3) daje kao primer (`report:sales`) — ne uvodi se četvrti segment u ključ dozvole.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/bi`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/reports/profitability` | GET | filtri: period, destinacija, dobavljač/provajder, kanal |
| `/reports/sales` | GET | filtri: period, kanal, tip proizvoda |
| `/reports/occupancy` | GET | filtri: period, destinacija, dobavljač; `?group_by=` jedno od `room_type`, `board_type`, `stars`, `accommodation_type` — vraća broj osoba, noćenja i broj prodatih soba (poglavlje 4.1) |
| `/reports/dynamic` | GET | `?group_by=` uređena, zarezom razdvojena lista dimenzija iz poglavlja 4.2 (npr. `destination_country,destination_city,supplier`); vraća stablo čvorova (poglavlje 4.2.1) |
| `/reports/marketing` | GET | filtri: period; grupisano po `referral_content_id`/`referral_content_name` (poglavlje 4.3) |
| `/reports/export` | POST | v1.6 dopuna — telo `{reportKind, title, rows[], format}` (`reportKind` jedno od pet iz poglavlja 6, `format` EXCEL/PDF/HTML/PNG); dozvola se proverava PROGRAMSKI po `reportKind` (`PermissionsService.hasPermission`, isti servis kao `PermissionsGuard`, samo pozvan direktno jer je dozvola zavisna od sadržaja tela zahteva, ne statična po ruti) — vraća `{id, fileName}`, zapis 30 min u memoriji (`common/reports/report-store.ts`), isti princip kao M15 §6.9.3. `rows`/`title` dolaze OD KLIJENTA (već filtrirani/prikazani podaci trenutnog ekrana) — ovaj endpoint ne ponavlja upit, samo pakuje već legitimno dobijen prikaz u fajl; PNG format (infografik) prosleđuje `rows` bez tabelarne obrade, samo čuva bazu64 sliku kao binarni fajl. |
| `/reports/export/:id/download` | GET | v1.6 dopuna — preuzimanje generisanog fajla; dozvola po `reportKind` upisanom uz zapis pri `export`-u, ne statična |
| `/reports/export/:id/send-chat` | POST | v1.6 dopuna — telo `{conversationId}`; prilaže fajl kao M19 poruku (isti mehanizam kao M15 §6.9.3 `sendReportToChat`, sad deljen preko `common/reports/`) |
| `/reconciliation/run` | POST | ručno pokretanje rekonsilijacije (van noćnog rasporeda) — Vlasnik/Direktor |

---

## 8. Izlazni kriterijum (M13 deo Faze 5)

Sve stavke dokazane e2e testom (`apps/api/test/m13-exit-criteria.e2e-spec.ts`), protiv prave Postgres baze — implementacija avgust 2026.

- [x] Menadžment vidi profitabilnost po destinaciji, dobavljaču/provajderu i kanalu, sa tačnim `margin` izračunom.
- [x] Gubitak pojedinačnog događaja (simuliran) se ispravlja narednom noćnom rekonsilijacijom, bez ručne intervencije.
- [x] Svaki izveštaj prikazuje vreme poslednjeg osvežavanja podataka.
- [x] Brisanje cele M13 projekcije i njena rekonstrukcija iz izvornih modula daje identičan rezultat kao pre brisanja.
- [x] Izveštaj "Operativna statistika smeštaja" tačno prikazuje broj osoba, noćenja i broj prodatih soba (ukupno i po `room_type`) za zadati period.
- [x] Isti izveštaj se ispravno razvrstava po `board_type`, `stars` i `accommodation_type`, uz jasnu naznaku broja stavki koje nisu razvrstane (npr. `API`-sourced stavke bez `room_type`/`board_type`).
- [x] Dinamički izveštaj gradi stablo tačno onim redosledom dimenzija koji je korisnik odabrao, sa ispravnim `revenue`/`paid`/`balance` po čvoru na svakom nivou.
- [x] Marketing izveštaj (poglavlje 4.3) ispravno grupiše rezervacije po sadržaju koji ih je doveo, i posebno prikazuje broj/vrednost rezervacija bez poznatog porekla (`referral_content_id IS NULL`), bez mešanja u agregat po sadržaju.

---

## 9. Otvoreno za dalje

- Tačan skup KPI-jeva koje AI agent (poglavlje 5) treba proaktivno da ističe — počinje se sa osnovnim (pad profitabilnosti, neuobičajen pad prodaje) i širi po potrebi.
- **Break-even/P&L izveštaj za `CHARTER`/`FIXED_LEASE` periode** (M3 poglavlje 2.3a) — poredi `ContractPeriod.ukupna_fiksna_obaveza` naspram stvarno naplaćene vrednosti prodatih stavki iz tog perioda; dodaje se kad se za ovim pokaže stvarna potreba (prvi charter/fiksni zakup ugovor).
- Sačuvani/preporučeni preseti redosleda dimenzija za dinamički izveštaj (poglavlje 4.2, npr. brzi prečac "sve po državi pa dobavljaču") — UX pogodnost za M17, ne menja API iz poglavlja 4.2; dodaje se ako se pokaže potreba.
