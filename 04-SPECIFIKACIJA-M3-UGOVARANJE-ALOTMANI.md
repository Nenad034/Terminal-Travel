# Specifikacija modula M3 — Ugovaranje i alotmani

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M3) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodato: konvencija celobrojnih novčanih iznosa (poglavlje 2), sprečavanje preklapanja perioda (poglavlje 2.3b) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1 (Core / Identitet i pristup), M2 (Katalog proizvoda)

---

## 1. Svrha i obim modula

M3 upravlja direktnim ugovorima agencije sa dobavljačima (hoteli, prevoznici, osiguravači): ko je dobavljač, koji su uslovi, koliko kapaciteta agencija kontroliše, po kojoj ceni, i do kog roka mora da odluči šta vraća dobavljaču. M2 (Katalog) referencira M3 preko `source_contract_id`, ali M3 je taj koji čuva stvarne cene, kapacitet i rokove — u skladu sa principom "jedan izvor istine".

Van obima: sama rezervacija i naplata (M5, M10), i proizvodi koji dolaze preko API konekcija (M4) — ti nemaju ugovor u ovom smislu.

---

## 2. Model podataka

**Konvencija za novčane vrednosti:** svaki novčani iznos u ovom dokumentu (`price`, `ukupna_fiksna_obaveza`, itd.) čuva se kao `integer` u najmanjoj jedinici valute (RSD → para, EUR → cent), **nikad kao `decimal`/float** — sprečava greške zaokruživanja pri sabiranju/množenju cena kroz lanac M3 → M5 → M10. Prikaz gostu/korisniku (npr. "1.234,56 RSD") je isključivo formatiranje na UI sloju, ne menja tip skladištenja. Izuzetak: procenti (`refund_percentage`) nisu novčani iznosi i ne podležu ovom pravilu. Ista konvencija važi kroz M5 i M10 — M10 poglavlje 3.2 je kanonski izvor ovog pravila (potvrđeno poređenjem sa PrimeTravel `supplier_integration_guide.md`, vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 1).

### 2.1 `Supplier` — dobavljač
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| name | string | |
| type | enum: `HOTEL`, `PREVOZNIK`, `OSIGURAVAC`, `DRUGO` | |
| tax_id | string | PIB |
| registration_number | string | matični broj |
| country | string | |
| contact_name / contact_email / contact_phone | string | |
| bank_account | string, nullable | za potrebe M10 kad dođe plaćanje dobavljaču |
| status | enum: `ACTIVE`, `INACTIVE` | |
| created_at / updated_at | timestamp | |

### 2.2 `Contract` — ugovor
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → Supplier) | |
| contract_number | string | interna oznaka |
| currency | enum: `EUR`, `RSD`, `USD`, ... | **po ugovoru**, ne globalno — potvrđeno da se meša po dobavljaču |
| valid_from / valid_to | date | period važenja samog ugovora (kad je potpisan i do kad važi kao dokument) |
| cancellation_terms_summary | text | kratak opis opštih uslova otkazivanja iz ugovora (detaljna pravila po sezoni idu u `ContractPeriod`, tačka 2.3) |
| document_url | string | referenca ka skeniranom/potpisanom PDF-u u EU cloud skladištu — ugovor se ne čuva kao binarni podatak u bazi |
| status | enum: `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` | |
| created_at / updated_at / created_by | timestamp / UUID | |

### 2.3 `ContractPeriod` — sezona/period unutar ugovora
Jedan ugovor može pokrivati više sezona sa različitim cenama i alotmanom (npr. "leto 2027" i "zima 2027/28" u istom ugovoru sa istim hotelom). Ovo razdvaja **period važenja ugovora** (tačka 2.2, kad je dokument na snazi) od **perioda boravka na koji se cena/alotman odnose** — potvrđeno da su ovo dva različita opsega datuma.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| contract_id | UUID (FK → Contract) | |
| stay_from / stay_to | date | period boravka gosta na koji ova sezona/cena važi |
| room_type | string | odgovara `room_type` u `attributes` odgovarajućeg M2 Product-a (konvencija, ne strogi FK — vidi princip granica modula) |
| allotment_mode | enum: `FIXED`, `ON_REQUEST`, `CHARTER`, `FIXED_LEASE` | vidi poglavlje 2.3a za `CHARTER`/`FIXED_LEASE` |
| total_capacity | integer, nullable | za `FIXED`, `CHARTER`, `FIXED_LEASE` — ukupan broj jedinica (soba/mesta) u ovom periodu |
| units_sold | integer, default 0 | za `FIXED`, `CHARTER`, `FIXED_LEASE` — atomski se uvećava pri svakoj potvrđenoj rezervaciji (M5); vidi napomenu o konkurentnosti niže |
| release_days_before | integer, nullable | **samo za `FIXED`** — koliko dana pre `stay_from` agencija mora da najavi hotelu šta vraća od neprodatog alotmana; **ne primenjuje se na `CHARTER`/`FIXED_LEASE`** (poglavlje 2.3a) |
| ukupna_fiksna_obaveza / fixed_obligation_currency | integer / string, nullable | **samo za `CHARTER`/`FIXED_LEASE`** — u najmanjoj jedinici valute (poglavlje 2); vidi poglavlje 2.3a |
| payment_schedule | JSONB, nullable | **samo za `FIXED_LEASE`** — vidi poglavlje 2.3a |
| created_at / updated_at | timestamp | |

**`ON_REQUEST` period nema `total_capacity` ni `units_sold`** — sistem ne garantuje kapacitet; svaki pokušaj rezervacije u ovom periodu mora proći kroz ručnu ili API potvrdu dobavljača pre nego što se gostu potvrdi (M5 ovo tretira kao status "Na čekanju potvrde dobavljača", ne kao trenutnu potvrdu).

**Napomena o konkurentnosti (za implementaciju M5):** uvećanje `units_sold` mora biti atomska operacija sa proverom (`UPDATE ... SET units_sold = units_sold + 1 WHERE units_sold + n <= total_capacity`, unutar transakcije sa row-level lock-om) — sprečava da dva agenta istovremeno rezervišu poslednju sobu i pređu kapacitet. Isto važi za `CHARTER`/`FIXED_LEASE`.

### 2.3a `CHARTER` i `FIXED_LEASE` — kapacitet sa fiksnom obavezom nezavisno od prodaje

Za razliku od `FIXED` (gde agencija drži kontingent kod dobavljača, ali dobavljač i dalje snosi rizik neprodatog dela — zato postoji `release_days_before`), kod `CHARTER` i `FIXED_LEASE` agencija **unapred preuzima punu finansijsku obavezu** za ceo kapacitet, bez obzira na to koliko se stvarno proda:

- **`CHARTER`** — agencija otkupljuje ceo kapacitet leta/broda/autobusa za period, jednokratno.
- **`FIXED_LEASE`** (fiksni zakup) — agencija zakupljuje ceo objekat (hotel, brod) za sezonu, uz fiksnu mesečnu/periodičnu obavezu, nezavisno od popunjenosti.

| Polje (dopuna 2.3) | Napomena |
| :---- | :---- |
| `ukupna_fiksna_obaveza` | Ukupan iznos koji agencija duguje dobavljaču za ceo period, nezavisno od `units_sold` — jednokratan iznos za `CHARTER`, zbir svih rata za `FIXED_LEASE` |
| `payment_schedule` | Samo za `FIXED_LEASE` — niz `{due_date, amount}` rata. Svaka rata, kad dospe, generiše zapis u M10 `SupplierObligation` (M10 poglavlje 8) — isti mehanizam kao svaka druga obaveza prema dobavljaču, ne poseban tok |

**Break-even i P&L pregled** (koliko treba prodati da se pokrije `ukupna_fiksna_obaveza`, i koliki je trenutni jaz) računa se iz `ukupna_fiksna_obaveza` (M3) naspram stvarno naplaćene vrednosti prodatih stavki (M5/M10) — ovo je **read-only agregacija preko modula**, pripada M13 (BI), ne čuva se kao duplirano polje ovde (princip "jedan izvor istine") — vidi M13 poglavlje 9, otvoreno pitanje.

**`release_days_before` se ne primenjuje** — nema koncepta "vraćanja" dobavljaču, kapacitet je već otkupljen/zakupljen, neprodato je sunk cost agencije, ne dobavljača.

### 2.3b Sprečavanje preklapanja perioda (overlap prevention)

Dva `ContractPeriod` zapisa sa istim `contract_id` i `room_type` **ne smeju imati preklapajuće opsege `stay_from`/`stay_to`** — preklapanje bi značilo da dve različite cene/alotmana važe za isti datum boravka iste sobe, što je dvosmisleno (koja cena/kapacitet se primenjuje?). Dodato poređenjem sa PrimeTravel `PRICING_BLUEPRINT.md`, koji ovo eksplicitno navodi kao planiranu validaciju (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 3).

**Sprovođenje:** provera se radi pri kreiranju/izmeni perioda (`M3/contract-period/EDIT`, poglavlje 5) i pri odobravanju reda iz AI uvoza cenovnika (poglavlje 4.2.4, `review_status → CONFIRMED`/`MANUALLY_MATCHED`) — pokušaj upisa perioda čiji se opseg seče sa postojećim (isti `contract_id` + `room_type`) se odbija sa jasnom porukom koji postojeći period je u sukobu. Na nivou baze, preporučuje se PostgreSQL `EXCLUDE USING gist` ograničenje nad `(contract_id, room_type, daterange(stay_from, stay_to))` — tehnička, ne samo aplikativna prepreka, isti nivo opreza kao ograda u M5 poglavlje 2.2 za `MarkupRule`.

Granični slučaj: susedni periodi (npr. jedan se završava 2027-08-31, drugi počinje 2027-09-01) **nisu** preklapanje — u sukobu je samo strogo presecanje opsega (`stay_from < other.stay_to AND stay_to > other.stay_from`). Ova provera se primenjuje jednako na sve vrednosti `allotment_mode` — dva perioda za isti datum/sobu su dvosmislena bez obzira da li je jedan `FIXED` a drugi `ON_REQUEST`.

### 2.4 `RateLine` — cena po kombinaciji unutar perioda
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| contract_period_id | UUID (FK → ContractPeriod) | |
| board_type | string | npr. "polupansion", "all-inclusive" |
| occupancy | string | npr. "odrasla osoba u dvokrevetnoj", "doplata za jednokrevetnu" |
| price | integer | u najmanjoj jedinici valute ugovora (`Contract.currency`) — vidi konvenciju u poglavlju 2 |
| created_at / updated_at | timestamp | |

### 2.5 `CancellationRule` — pravila otkazivanja po periodu
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| contract_period_id | UUID (FK → ContractPeriod) | |
| days_before_stay | integer | prag — npr. 30, 15, 7 |
| refund_percentage | integer (0–100) | koliko se vraća gostu ako otkaže u tom prozoru |

Primer: 30 dana → 100%, 15–29 dana → 50%, 0–14 dana → 0%. Ovo koristi M5 (obračun otkazivanja) i M10 (obračun povraćaja) — M3 samo čuva pravilo.

---

## 3. Veza sa M2 (Katalog)

Kad se ugovori nova sezona/tip sobe, kreira se (ili se ažurira) odgovarajući `Product` u M2 sa `source_type = CONTRACTED` i `source_contract_id` koji pokazuje na ovaj `Contract`. M2 ne duplira cenu ni kapacitet — to uvek čita iz M3 preko API-ja M3, u trenutku kad je to potrebno (pretraga, rezervacija).

---

## 4. Uloga AI agenta

### 4.1 Upozorenje pred rok za povrat (release)

Kad `release_days_before` period priđe (npr. ostalo je onoliko dana koliko piše u polju), a `units_sold < total_capacity`, agent zadužen za M3 **predlaže** akciju (npr. "vratiti dobavljaču 4 neprodate sobe za period X" ili "tražiti produžetak roka") — ovo spada u nivo **"Predloži pa čovek odobri"** iz poglavlja 7 Master dokumenta, jer povrat kapaciteta dobavljaču je poslovna odluka sa finansijskim uticajem, ne čisto informativna radnja. Agent nikad sam ne šalje potvrdu dobavljaču o vraćanju kapaciteta.

### 4.2 AI uvoz cenovnika (PDF/Excel/scan → strukturirani podaci)

Dobavljači šalju cenovnike u proizvoljnom formatu (PDF, Excel, Word, HTML, email, uključujući skenirane PDF-ove). Umesto ručnog prekucavanja u `ContractPeriod`/`RateLine`, sistem podržava AI-potpomognut uvoz.

#### 4.2.1 `PricelistImport`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → Supplier) | |
| source_file_url | string | originalni fajl, EU cloud skladište |
| source_format | enum: `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF` | `SCANNED_PDF` ide kroz OCR pre parsiranja |
| status | enum: `PROCESSING`, `READY_FOR_REVIEW`, `COMPLETED`, `REJECTED` | |
| created_by / created_at | UUID / timestamp | |

#### 4.2.2 `PricelistImportRow` — jedan red = jedna kombinacija hotel/soba/usluga/period/cena
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| pricelist_import_id | UUID (FK) | |
| extracted_hotel_name | string | tekst tačno kako piše u izvornom dokumentu, pre mapiranja |
| matched_product_id | UUID, nullable (FK → M2 Product) | kandidat pronađen fuzzy-matching-om (poglavlje 4.2.3) |
| match_confidence | decimal (0–100), nullable | |
| extracted_room_type / extracted_board_type | string | |
| extracted_stay_from / extracted_stay_to | date | |
| extracted_price / extracted_currency | integer / string | u najmanjoj jedinici valute (poglavlje 2) — konvertuje se pri ekstrakciji, čak i ako je izvorni dokument prikazivao cenu sa decimalama |
| review_status | enum: `PENDING`, `CONFIRMED`, `MANUALLY_MATCHED`, `REJECTED` | |
| reviewed_by | UUID (FK → M1 User), nullable | |

#### 4.2.3 Fuzzy-matching i prag pouzdanosti

Ime hotela iz dokumenta se upoređuje sa postojećim M2 katalogom preko Levenštajnove distance, filtrirano po destinaciji i kategoriji (`stars`) radi smanjenja lažnih poklapanja. Redovi sa `match_confidence ≥ 85%` se predlažu kao automatsko mapiranje; ispod praga, red ide na ručno mapiranje (`review_status = PENDING`, bez predloženog `matched_product_id`).

#### 4.2.4 Nivo autonomije — ekstrakcija sme sama, upis cene nikad sam

Ekstrakcija podataka iz dokumenta i predlog mapiranja (`PROCESSING → READY_FOR_REVIEW`) je nivo **"Autonomno"** — čisto informativna priprema, ništa se još ne piše u stvarni `ContractPeriod`/`RateLine`, pa ni pogrešno mapiranje ne utiče na prodajnu cenu. **Kreiranje ili izmena stvarnog `ContractPeriod`/`RateLine` zapisa iz potvrđenog reda** (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) je nivo **"Predloži pa čovek odobri"** — zahteva ljudsku potvrdu (isti nosilac dozvole kao `M3/contract-period/EDIT`, poglavlje 5) pre nego što red postane aktivna cena, u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta — greška ovde je direktno pogrešna prodajna cena, ne kozmetika.

---

## 5. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M3/supplier/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M3/supplier/CREATE`, `EDIT` | Vlasnik, Direktor |
| `M3/contract/VIEW` | Vlasnik, Direktor, Sales Manager |
| `M3/contract/CREATE`, `EDIT`, `DELETE` | Vlasnik, Direktor |
| `M3/contract-period/VIEW` (uključuje preostali alotman) | Vlasnik, Direktor, Sales Manager, Prodajni agent — prodajni agent mora da vidi preostali kapacitet da bi prodavao |
| `M3/contract-period/EDIT` (cene, alotman, rokovi) | Vlasnik, Direktor |
| `M3/pricelist-import/CREATE`, `VIEW` | Vlasnik, Direktor; i AI agent zadužen za M3 (poglavlje 4.2.4 — samo ekstrakcija/predlog) |
| `M3/pricelist-import/APPROVE_ROW` | Vlasnik, Direktor — **nikad AI agent**, isti nosilac kao `M3/contract-period/EDIT` (poglavlje 4.2.4) |

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/contracting`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/suppliers` | GET / POST | lista / kreiranje dobavljača |
| `/suppliers/:id` | GET / PATCH | |
| `/contracts` | GET / POST | lista / kreiranje ugovora |
| `/contracts/:id` | GET / PATCH | |
| `/contracts/:id/periods` | GET / POST | sezone unutar ugovora — `POST`/`PATCH` odbija period koji se datumski preklapa sa postojećim za isti `room_type` (poglavlje 2.3b) |
| `/contracts/:id/periods/:periodId/rates` | GET / PUT | cenovne stavke |
| `/contracts/:id/periods/:periodId/cancellation-rules` | GET / PUT | pravila otkazivanja |
| `/contracts/:id/periods/:periodId/availability` | GET | preostali kapacitet — koristi M5 pri pretrazi |
| `/contracts/:id/periods/:periodId/reserve` | POST | interni poziv (samo M5) — atomski umanjuje `units_sold`, vraća grešku ako nema kapaciteta |
| `/contracts/expiring-releases` | GET | lista perioda kojima se bliži `release_days_before` rok, za AI agenta i za interni panel |
| `/pricelist-imports` | GET / POST | lista / upload novog cenovnika (pokreće AI ekstrakciju, poglavlje 4.2) |
| `/pricelist-imports/:id/rows` | GET | pregled ekstraktovanih redova sa `match_confidence` |
| `/pricelist-imports/:id/rows/:rowId/approve` | POST | zahteva `M3/pricelist-import/APPROVE_ROW`; kreira/ažurira stvarni `ContractPeriod`/`RateLine` |
| `/pricelist-imports/:id/rows/:rowId/reject` | POST | odbacuje red bez upisa |

---

## 7. Izlazni kriterijum (M3 deo Faze 1)

- [ ] Moguće je kreirati dobavljača, ugovor u proizvoljnoj valuti (EUR/RSD), i period sa `FIXED` alotmanom, cenama i pravilima otkazivanja.
- [ ] Moguće je kreirati period sa `ON_REQUEST` modom, bez kapaciteta.
- [ ] Moguće je kreirati period sa `CHARTER` ili `FIXED_LEASE` modom, sa `ukupna_fiksna_obaveza` (i `payment_schedule` za `FIXED_LEASE`), bez `release_days_before`.
- [ ] Dospela rata iz `FIXED_LEASE.payment_schedule` ispravno generiše zapis u M10 `SupplierObligation`.
- [ ] Konkurentni pokušaji rezervacije (test: dva simultana zahteva za poslednju preostalu jedinicu) — tačno jedan uspeva, kapacitet se nikad ne pređe, za sve tipove `allotment_mode` sa kapacitetom (`FIXED`, `CHARTER`, `FIXED_LEASE`).
- [ ] `/contracts/expiring-releases` tačno prijavljuje periode kojima se bliži rok povrata sa neprodatim kapacitetom.
- [ ] M2 proizvod ispravno referencira `Contract` preko `source_contract_id`, bez duplirane cene.
- [ ] Upload testnog cenovnika (PDF i Excel) rezultuje ekstraktovanim redovima sa `match_confidence` za svaki red.
- [ ] Odobravanje reda cenovnika kreira ispravan `ContractPeriod`/`RateLine` zapis tek posle ljudske potvrde — nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `match_confidence`.
- [ ] Nijedno novčano polje (`price`, `ukupna_fiksna_obaveza`) nije tipa `decimal`/float — provereno da su sva `integer` u najmanjoj jedinici valute (poglavlje 2).
- [ ] Pokušaj kreiranja ili odobravanja (iz uvoza cenovnika) `ContractPeriod` koji se datumski preklapa sa postojećim periodom za isti `contract_id`/`room_type` se odbija sa jasnom porukom (poglavlje 2.3b); susedni (ne-presecajući) periodi se prihvataju.

---

## 8. Otvoreno za dalje

- Tačan format `cancellation_terms_summary` (slobodan tekst vs. strukturirano) — dovoljno je slobodan tekst za sada; ako se pokaže potreba za automatskim tumačenjem uslova van `CancellationRule` tabele, revidira se.
- Obračun konverzije valute za potrebe fakturisanja u RSD (kad ugovor nije u RSD) definiše se detaljno u specifikaciji M10, ne ovde — M3 samo čuva izvornu valutu i cenu.
- Da li `PACKAGE` proizvodi (iz M2) mogu imati sopstveni ugovor u M3 nezavisno od komponenti koje ga čine, ili se uvek sastavljaju od već ugovorenih komponenti — otvoreno dok se ne dođe do stvarnog paket-aranžmana u praksi.
- Break-even/P&L pregled za `CHARTER`/`FIXED_LEASE` periode (poglavlje 2.3a) — definiše se kao izveštaj u M13 (BI) kad ta specifikacija dobije ovu dopunu, ne ovde.
- Tačan OCR provajder/servis za `SCANNED_PDF` (poglavlje 4.2.1) — bira se pri implementaciji, ovaj dokument samo predviđa mesto za tu integraciju.
- Da li prag od 85% (poglavlje 4.2.3) treba biti podesiv po dobavljaču/formatu dokumenta, ili ostaje globalna konstanta — otvoreno dok se ne pokaže potreba iz prakse.
