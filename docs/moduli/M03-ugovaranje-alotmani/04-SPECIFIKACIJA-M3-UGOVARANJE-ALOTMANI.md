# Specifikacija modula M3 — Ugovaranje i alotmani

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M3) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.9 — dodato `Contract.payment_terms_days` (poglavlje 2.2, avgust 2026, otkriveno pri implementaciji M10): M10 spec §8.0/§8.1 pretpostavlja da `SupplierObligation.due_date` dolazi "iz uslova plaćanja u M3 Contract", ali takvo polje nikad nije postojalo — postojao je samo `payment_schedule` (specifičan za FIXED_LEASE); dodato opšte, nullable polje (rok u danima od prijema fakture), M10 koristi podrazumevanih 30 dana kad nije uneto; v1.8 — implementacija (avgust 2026, Faza 1): `apps/api/src/modules/m3-ugovaranje-alotmani/` — Supplier/SupplierContact/Contract/ContractPeriod (sva 4 `allotment_mode`)/RateLine+`RateLineAgePricing`/CancellationRule CRUD, sprečavanje preklapanja perioda (aplikativna provera, deljena između ručnog kreiranja i uvoza cenovnika), atomska `reserve()` (jedan `UPDATE ... WHERE units_sold + n <= total_capacity`, dokazano pravim paralelnim HTTP zahtevima), alarm za nizak kapacitet preko Event Bus-a (M18 još ne postoji kao model), `PricelistImport` ljudski tok odobrenja i `SupplierExtractionProfile` učenje. Dodato `extracted_occupancy` u `PricelistImportRow` (§4.2.2) — nedostajalo u v1.7 iako je `RateLine.occupancy` obavezno polje. Stvarna AI ekstrakcija cenovnika (§4.2, korak 2) namerno nije povezana — čeka odluku o AI provajderu, isti obrazac kao TODO za email u M1 i AI uvoz sadržaja u M2. 47 unit + 15 e2e testova dokazuje 13 od 18 stavki izlaznog kriterijuma (poglavlje 7) — preostalih 5 čeka M4/M5/M10/M18/AI-provajder odluku, eksplicitno obeleženo u checklisti; v1.7 — na zahtev vlasnika (avgust 2026): `PricelistImportRow` dobija polja za kandidate uzrasne cene (`extracted_price_basis`/`extracted_age_pricing`/`extracted_crib_fee_per_night`, poglavlje 4.2.2); nov `SupplierExtractionProfile` (poglavlje 4.2.5) — AI uvoz uči potvrđen obrazac po dobavljaču i ponovo ga koristi za sledeći uvoz istog dobavljača, sa ogradom da se ne primenjuje tiho ako se struktura dokumenta promeni; v1.6 na osnovu analize stvarnih cenovnika više dobavljača: `RateLine` dobija `price_basis` (po sobi vs. po osobi) i strukturiranu cenu po uzrasnoj kategoriji gosta `age_pricing[]` (poglavlje 2.4a), rešava otvoreno pitanje iz v1.5 o ceni po detetu/bebi; v1.5 ažurirana referenca `ContractPeriod.room_type` na strukturirano `attributes.room_types[].code` iz M2 poglavlja 2.3a (avgust 2026); v1.4 dodat `SupplierContact` (poglavlje 2.1a), portal login kontakt-osobe kod dobavljača za real-time chat, dopuna M19 specifikacije za problem #9 (avgust 2026); v1.3 dodato `Contract.default_tip_nastupanja` (poglavlje 2.2), rešava nalaz #1 iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOV-B2B.md` (avgust 2026, na zahtev vlasnika); v1.2 dodat alarm za nizak preostali kapacitet (poglavlje 4.3); v1.1 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 2), sprečavanje preklapanja perioda (poglavlje 2.3b) — sve poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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

### 2.1a `SupplierContact` — kontakt-osoba kod dobavljača (dopuna, avgust 2026 — rešava problem #9 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, dopunjuje `20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 9)

Odvojeno od `Supplier.contact_name/contact_email/contact_phone` (poglavlje 2.1, koji ostaje opšti operativni kontakt bez logina — koristi se za `SupplierManifest`, poglavlje 8 M5 specifikacije), `SupplierContact` predstavlja **konkretnu osobu** kojoj se po želji može dodeliti lagan portal nalog za real-time chat sa timom agencije.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → Supplier) | |
| full_name | string | |
| email / phone | string | |
| linked_user_id | UUID, nullable (FK → M1 User, `account_type = SUPPLIER_CONTACT`) | popunjeno tek kad agencija svesno dodeli portal pristup (M19 poglavlje 9.2) — nullable dok kontakt postoji samo kao podatak, bez logina |
| status | enum: `ACTIVE`, `INACTIVE` | `INACTIVE` odmah oduzima pristup razgovoru (M19 poglavlje 11), bez brisanja istorije |
| created_at / updated_at | timestamp | |

Jedan `Supplier` može imati više `SupplierContact` zapisa (npr. recepcija i menadžer prodaje istog hotela), ali svaki dobija sopstveni, odvojen portal nalog i razgovor — isti princip kao višenivovska vidljivost u M7 (svaki nalog vidi samo svoje).

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
| payment_terms_days | integer, nullable | dopuna v1.9 (avgust 2026) — rok plaćanja dobavljaču u danima od prijema fakture; M10 `SupplierObligation.due_date` se izvodi odavde (M10 spec §8.1), podrazumevanih 30 dana kad nije uneto |
| status | enum: `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` | |
| default_tip_nastupanja | enum: `ORGANIZATOR`, `POSREDNIK` | **obavezno pre nego što `Contract` može preći u `ACTIVE`** (dopuna ograde uz `MarkupRule`, M5 poglavlje 2.2) — vidi poglavlje 2.2a niže. Rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026): ko/šta određuje `Booking.tip_nastupanja` kad rezervaciju sam potvrđuje gost (M8) ili subagent (M7), bez prodajnog tima u toku |
| created_at / updated_at / created_by | timestamp / UUID | |

### 2.2a `default_tip_nastupanja` — izvor istine za samouslužne kanale (dopuna, avgust 2026)

Ugovoreni proizvod iz ovog `Contract`-a se u praksi gotovo uvek prodaje pod istim poreskim/pravnim odnosom (agencija kao organizator, ili agencija kao posrednik za tuđi aranžman) — ta odluka se donosi **kad se ugovor zaključuje**, ne pri svakoj pojedinačnoj prodaji. `default_tip_nastupanja` čuva tu odluku na jednom mestu, tako da samouslužni kanali (M8 sajt, M7 B2B portal), koji nemaju prodajni tim u toku, imaju odakle da je automatski preuzmu — vidi M5 poglavlje 4.0a, koji definiše tačan mehanizam preuzimanja pri potvrdi rezervacije.

Interni panel (M17), gde prodajni tim ručno bira `tip_nastupanja` po specifičnom dogovoru sa klijentom, i dalje sme da ga eksplicitno postavi drugačije od podrazumevane vrednosti ugovora — `default_tip_nastupanja` je *podrazumevana* vrednost, ne prisila; ljudski nalog na internom panelu je uvek u mogućnosti da svesno odstupi (npr. poseban jednokratni dogovor da agencija ovog puta posreduje umesto organizuje). Samo za samouslužne kanale (bez ljudskog naloga u toku) ova vrednost postaje obavezujuća, jer nema ko drugi da je izabere.

### 2.3 `ContractPeriod` — sezona/period unutar ugovora
Jedan ugovor može pokrivati više sezona sa različitim cenama i alotmanom (npr. "leto 2027" i "zima 2027/28" u istom ugovoru sa istim hotelom). Ovo razdvaja **period važenja ugovora** (tačka 2.2, kad je dokument na snazi) od **perioda boravka na koji se cena/alotman odnose** — potvrđeno da su ovo dva različita opsega datuma.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| contract_id | UUID (FK → Contract) | |
| stay_from / stay_to | date | period boravka gosta na koji ova sezona/cena važi |
| room_type | string | odgovara `code` polju unutar `attributes.room_types[]` odgovarajućeg M2 Product-a (M2 poglavlje 2.3a, dopuna avgust 2026 — konvencija, ne strogi FK, vidi princip granica modula) |
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
| occupancy | string | npr. "odrasla osoba u dvokrevetnoj", "doplata za jednokrevetnu" — i dalje opisuje **osnovnu** popunjenost na koju se `price` odnosi (vidi `price_basis` niže) |
| price_basis | enum: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | dopuna avgust 2026 — određuje kako se `price` tumači i sabira kad u sobi ima više gostiju (poglavlje 2.4a); potvrđeno analizom stvarnih cenovnika da dobavljači stvarno koriste oba modela, nema jedinstvenog standarda |
| price | integer | u najmanjoj jedinici valute ugovora (`Contract.currency`) — vidi konvenciju u poglavlju 2; za `PER_ROOM_PER_NIGHT` je to cena cele sobe pri osnovnoj popunjenosti iz `occupancy`, za `PER_PERSON_PER_NIGHT` je to cena po jednom ADULT gostu |
| crib_fee_per_night | integer, nullable | doplata za krevetac po noći (dopuna avgust 2026) — popunjeno samo kad `M2 room_types[].age_policy[].requires_crib = true` i `crib_included = false` za tu sobu (M2 poglavlje 2.3b); `null` znači krevetac je besplatan ili se ne primenjuje |
| created_at / updated_at | timestamp | |

### 2.4a `age_pricing[]` — cena po uzrasnoj kategoriji gosta (dopuna, avgust 2026, na zahtev vlasnika)

Rešava otvoreno pitanje iz M2 poglavlja 2.3b: `age_policy[]` (M2) definiše *ko se u koju uzrasnu kategoriju svrstava i da li ulazi u kapacitet sobe* — ovde se definiše *po kojoj ceni*. Zasnovano na analizi stvarnih cenovnika više dobavljača (avgust 2026) — dobavljači u praksi koriste **dva različita načina** da izraze cenu po detetu/bebi/tinejdžeru, ne jedan, pa `age_pricing[]` mora podržati oba:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| age_category | string | mora odgovarati vrednosti iz `M2 room_types[].age_policy[].category` (ADULT/CHILD/TEEN/INFANT, proširivo — M2 poglavlje 2.3b) za sobu na koju se ovaj `RateLine` odnosi, preko `contract_period_id → ContractPeriod.room_type` |
| occupant_index | integer, nullable | koje po redu gost te kategorije u sobi (1 = prvi, 2 = drugi...) — pokriva pravila tipa "prvo dete -50%, drugo dete besplatno"; `null` = važi podjednako za svakog gosta te kategorije |
| min_adults_present | integer, nullable | pravilo važi samo ako je u sobi bar ovoliko `ADULT` gostiju — pokriva pravila tipa "dete sa dva roditelja besplatno, dete sa jednim roditeljem uz doplatu"; `null` = bez uslova |
| pricing_mode | enum: `PERCENTAGE_OF_BASE_PRICE`, `FLAT_PRICE_PER_NIGHT` | |
| percentage | decimal, nullable | samo za `PERCENTAGE_OF_BASE_PRICE` — procenat od `RateLine.price` (npr. `50.00` = pola cene); `0` = besplatno |
| flat_price | integer, nullable | samo za `FLAT_PRICE_PER_NIGHT` — pun iznos po noći za tog gosta, u najmanjoj jedinici valute; `0` = besplatno |

**Napomena o "besplatno":** uvek se upisuje eksplicitan red sa `percentage = 0` ili `flat_price = 0`, nikad se besplatan gost ne predstavlja izostankom reda — izostanak reda za neku kategoriju gosta je greška u unosu (vidi ogradu niže), ne prećutna pretpostavka o ceni.

**Razrešavanje kad više redova odgovara istom gostu (najspecifičniji pobeđuje):** 1) red sa tačnim `occupant_index` (ne `null`), 2) red bez `occupant_index` ali sa najvišim `min_adults_present` koji je zadovoljen, 3) red bez ikakvog uslova (`occupant_index = null`, `min_adults_present = null`) kao podrazumevani. Isti obrazac razrešavanja kao `MarkupRule` (poglavlje 2.2 M5 specifikacije).

**Ograda:** ako gost (iz M5 `room_config`, klasifikovan po M2 `age_policy[]`) pripada kategoriji za koju **nijedan** `age_pricing[]` red ne postoji (ni uslovljen ni podrazumevani) na primenjivom `RateLine`, kreiranje `Quote` (M5) se odbija sa jasnom porukom — sistem nikad ne pretpostavlja punu cenu niti besplatan boravak za nedostajuću kategoriju, u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta.

**Kako se ovo sabira u ukupnu cenu sobe** — definiše M5 (poglavlje 3.2b te specifikacije, ne ovde), pošto je to deo formule za `base_cost`; ovde se čuvaju samo ulazni podaci.

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
| extracted_occupancy | string, dopuna avgust 2026 | kandidat za `RateLine.occupancy` (poglavlje 2.4) — nedostajalo u prethodnoj verziji ovog dokumenta iako je `RateLine.occupancy` obavezno polje; ista logika kao `extracted_room_type`/`extracted_board_type`, prolazi kroz isti ljudski pregled pre upisa |
| extracted_stay_from / extracted_stay_to | date | |
| extracted_price / extracted_currency | integer / string | u najmanjoj jedinici valute (poglavlje 2) — konvertuje se pri ekstrakciji, čak i ako je izvorni dokument prikazivao cenu sa decimalama |
| extracted_price_basis | enum, nullable: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | kandidat za `RateLine.price_basis` (poglavlje 2.4) — `null` dok AI ne prepozna dovoljno pouzdano, ide na ručnu potvrdu kao i svako drugo nepopunjeno polje |
| extracted_age_pricing | JSONB, nullable | niz kandidata za `RateLine.age_pricing[]` (poglavlje 2.4a) — isti oblik polja (`age_category`, `occupant_index`, `min_adults_present`, `pricing_mode`, `percentage`/`flat_price`), samo označeno kao izvučeno, ne potvrđeno; `null` ako dokument ne sadrži uzrasnu cenu za tu stavku |
| extracted_crib_fee_per_night | integer, nullable | kandidat za `RateLine.crib_fee_per_night` (poglavlje 2.4) |
| review_status | enum: `PENDING`, `CONFIRMED`, `MANUALLY_MATCHED`, `REJECTED` | |
| reviewed_by | UUID (FK → M1 User), nullable | |

#### 4.2.3 Fuzzy-matching i prag pouzdanosti

Ime hotela iz dokumenta se upoređuje sa postojećim M2 katalogom preko Levenštajnove distance, filtrirano po destinaciji i kategoriji (`stars`) radi smanjenja lažnih poklapanja. Redovi sa `match_confidence ≥ 85%` se predlažu kao automatsko mapiranje; ispod praga, red ide na ručno mapiranje (`review_status = PENDING`, bez predloženog `matched_product_id`).

#### 4.2.4 Nivo autonomije — ekstrakcija sme sama, upis cene nikad sam

Ekstrakcija podataka iz dokumenta i predlog mapiranja (`PROCESSING → READY_FOR_REVIEW`) je nivo **"Autonomno"** — čisto informativna priprema, ništa se još ne piše u stvarni `ContractPeriod`/`RateLine`, pa ni pogrešno mapiranje ne utiče na prodajnu cenu. **Kreiranje ili izmena stvarnog `ContractPeriod`/`RateLine` zapisa iz potvrđenog reda** (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) je nivo **"Predloži pa čovek odobri"** — zahteva ljudsku potvrdu (isti nosilac dozvole kao `M3/contract-period/EDIT`, poglavlje 5) pre nego što red postane aktivna cena, u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta — greška ovde je direktno pogrešna prodajna cena, ne kozmetika. Ovo pravilo važi identično za osnovna polja (`extracted_room_type`/`extracted_price`) i za nova uzrasna polja (`extracted_price_basis`/`extracted_age_pricing`/`extracted_crib_fee_per_night`, poglavlje 4.2.2) — nijedno se ne upisuje u `RateLine` bez `reviewed_by`.

#### 4.2.5 `SupplierExtractionProfile` — nauči jednom po dobavljaču, koristi ponovo (dopuna, avgust 2026, na zahtev vlasnika)

Isti dobavljač obično šalje cenovnik u istom formatu iz godine u godinu (isti raspored kolona, isti `price_basis`, isti tipičan prag za dete/tinejdžera) — nema razloga da svaki novi `PricelistImport` od istog dobavljača kreće od nule. `SupplierExtractionProfile` čuva **poslednji uspešno potvrđen obrazac** po dobavljaču i AI ga koristi kao polaznu tačku za sledeći uvoz istog dobavljača, isto kao što bi i čovek koji je prošle godine već obradio taj cenovnik znao gde da gleda.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → Supplier), jedinstveno | jedan profil po dobavljaču |
| typical_price_basis | enum, nullable: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | iz poslednjeg potvrđenog uvoza |
| typical_age_thresholds | JSONB, nullable | poslednje potvrđene uzrasne granice po kategoriji (ne obavezujuće — svaki novi red i dalje prolazi kroz isti `review_status` gejt, ovo je samo predlog koji podiže `match_confidence` kad se poklapa) |
| structure_signature | JSONB, nullable | otisak strukture izvornog dokumenta (npr. raspored kolona/zaglavlja) korišćen da se proveri da li novi dokument "izgleda isto" pre nego što se profil primeni — tačan mehanizam (hash, lista zaglavlja, embedding) bira se pri implementaciji |
| last_confirmed_import_id | UUID, nullable (FK → PricelistImport) | |
| updated_at | timestamp | |

**Kako se uči:** profil se **ne** ažurira posebnim koračkom "treniranja" — svaki put kad zaposleni odobri (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) red iz `PricelistImport` za tog dobavljača, sistem tiho ažurira `SupplierExtractionProfile` tog dobavljača potvrđenim vrednostima. Ista akcija koja već postoji (poglavlje 4.2.4), bez novog procesa za zaposlenog.

**Kako se koristi — i ograda protiv tihog pogrešnog mapiranja:** pri novom `PricelistImport` za dobavljača koji već ima profil, AI prvo poredi `structure_signature` novog dokumenta sa sačuvanim. Ako se poklapa — profil se koristi kao polazna vrednost, `match_confidence` izvučenih redova je viši. **Ako se ne poklapa** (dobavljač promenio format), profil se **ne primenjuje** — ekstrakcija ide bez pomoći profila, sa uobičajenom (nižom) pouzdanošću, i `PricelistImport` nosi vidljivu napomenu da sačuvan profil nije iskorišćen jer se struktura promenila. Ovo je namerno konzervativno: stari profil tiho primenjen na promenjen dokument bi pogrešno mapirao kolone, što je gore nego da profila nema.

**Nivo autonomije:** čitanje/upoređivanje profila i predlaganje viših `match_confidence` vrednosti je **"Autonomno"** (ista priprema kao poglavlje 4.2.4) — profil nikad ne menja gejt za upis u `RateLine`, samo poboljšava predlog koji čovek i dalje mora da odobri.

### 4.3 Alarm za nizak preostali kapacitet

Nezavisno od `release_days_before` roka (poglavlje 4.1, koji je vezan za vraćanje dobavljaču), sistem prati **preostali kapacitet** (`total_capacity − units_sold`) svakog `ContractPeriod` sa kapacitetom (`FIXED`, `CHARTER`, `FIXED_LEASE`) i generiše upozorenje pri svakoj potvrđenoj rezervaciji koja taj broj svede na kritičan nivo:

- **Preostalo = 1 jedinica** → `HealthSignal` tipa `LOW_CAPACITY_CRITICAL`, `severity = CRITICAL` (M18 poglavlje 2.1).
- **Preostalo = 2 jedinice** → `HealthSignal` tipa `LOW_CAPACITY_CRITICAL`, `severity = WARNING`.
- Preostalo > 2 jedinice → bez signala (izbegava se šum na svaku prodaju).

Nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — čisto informativno obaveštenje tima da je period skoro rasprodat, ne menja nijedan podatak niti blokira prodaju (za razliku od M11 tvrde blokade garancije, poglavlje 4.2 te specifikacije, ovo je samo signal, ne ograda). Potvrđeno poređenjem sa PrimeTravel `OperationalReports` obrascem (upozorenje na preostala 1–2 jedinice), vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`.

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
| `M3/supplier-contact/VIEW`, `CREATE`, `EDIT` | Vlasnik, Direktor, Sales Manager — dodela `linked_user_id` (portal pristup za chat) dodatno zahteva `M19/supplier-conversation/GRANT_ACCESS` (poglavlje 9.2 te specifikacije) |

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/contracting`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/suppliers` | GET / POST | lista / kreiranje dobavljača |
| `/suppliers/:id` | GET / PATCH | |
| `/suppliers/:id/contacts` | GET / POST | `SupplierContact` (poglavlje 2.1a) — lista / dodavanje kontakt-osobe |
| `/suppliers/:id/contacts/:contactId` | GET / PATCH | uključuje `status`; `linked_user_id` se popunjava isključivo preko M19 toka (poglavlje 9.2 te specifikacije), ne direktno ovde |
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

- [x] Moguće je kreirati dobavljača, ugovor u proizvoljnoj valuti (EUR/RSD), i period sa `FIXED` alotmanom, cenama i pravilima otkazivanja. *(dokazano e2e testom, avgust 2026)*
- [x] Moguće je kreirati period sa `ON_REQUEST` modom, bez kapaciteta. *(dokazano e2e testom, avgust 2026)*
- [x] Moguće je kreirati period sa `CHARTER` ili `FIXED_LEASE` modom, sa `ukupna_fiksna_obaveza` (i `payment_schedule` za `FIXED_LEASE`), bez `release_days_before`. *(dokazano e2e testom, avgust 2026)*
- [ ] Dospela rata iz `FIXED_LEASE.payment_schedule` ispravno generiše zapis u M10 `SupplierObligation`. *(čeka M10 — nije implementiran)*
- [x] Konkurentni pokušaji rezervacije (test: dva simultana zahteva za poslednju preostalu jedinicu) — tačno jedan uspeva, kapacitet se nikad ne pređe, za sve tipove `allotment_mode` sa kapacitetom (`FIXED`, `CHARTER`, `FIXED_LEASE`). *(dokazano e2e testom sa pravim paralelnim HTTP zahtevima nad pravom bazom, avgust 2026 — 10 simultanih za kapacitet 1, 8 za kapacitet 5; ista atomska `$queryRaw` putanja za sve tipove sa kapacitetom)*
- [x] `/contracts/expiring-releases` tačno prijavljuje periode kojima se bliži rok povrata sa neprodatim kapacitetom. *(dokazano e2e testom, avgust 2026)*
- [x] M2 proizvod ispravno referencira `Contract` preko `source_contract_id`, bez duplirane cene. *(dokazano e2e testom, avgust 2026 — prava Prisma FK relacija, ne samo plain UUID)*
- [ ] Upload testnog cenovnika (PDF i Excel) rezultuje ekstraktovanim redovima sa `match_confidence` za svaki red. *(čeka odluku o AI provajderu — poglavlje 4.2, korak 2; `POST /pricelist-imports` radi i prima oba formata, ali ostaje u `PROCESSING` dok se ekstrakcija ne poveže, isti obrazac kao TODO za email u M1 i AI uvoz sadržaja u M2)*
- [x] Odobravanje reda cenovnika kreira ispravan `ContractPeriod`/`RateLine` zapis tek posle ljudske potvrde — nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `match_confidence`. *(dokazano e2e testom, avgust 2026 — testirano sa redom unetim direktno u bazu kao stand-in za ekstrakciju)*
- [x] Nijedno novčano polje (`price`, `ukupna_fiksna_obaveza`) nije tipa `decimal`/float — provereno da su sva `integer` u najmanjoj jedinici valute (poglavlje 2). *(dokazano e2e testom, avgust 2026)*
- [x] Pokušaj kreiranja ili odobravanja (iz uvoza cenovnika) `ContractPeriod` koji se datumski preklapa sa postojećim periodom za isti `contract_id`/`room_type` se odbija sa jasnom porukom (poglavlje 2.3b); susedni (ne-presecajući) periodi se prihvataju. *(dokazano unit + e2e testom, avgust 2026 — deljena provera između ručnog kreiranja i odobravanja uvoza)*
- [x] Rezervacija koja preostali kapacitet perioda svede na 1 ili 2 jedinice generiše `HealthSignal` tačne ozbiljnosti (`CRITICAL` za 1, `WARNING` za 2, poglavlje 4.3); preostalo > 2 ne generiše signal. *(implementirano preko Event Bus-a — `M3`/`low_capacity_critical` — umesto direktnog upisa `HealthSignal` zapisa, jer M18 kao Prisma model još ne postoji; dokazano unit testom, M18 se pretplaćuje kad taj modul dođe na red)*
- [x] `Contract` ne može preći u `ACTIVE` bez popunjenog `default_tip_nastupanja` (poglavlje 2.2a), isto sprovođenje kao postojeća ograda za `MarkupRule`. *(dokazano unit + e2e testom, avgust 2026)*
- [x] Moguće je kreirati `RateLine` sa `price_basis = PER_ROOM_PER_NIGHT` i sa `price_basis = PER_PERSON_PER_NIGHT`, svaki sa `age_pricing[]` nizom (poglavlje 2.4a). *(dokazano e2e testom, avgust 2026)*
- [x] Test: `age_pricing[]` red sa `occupant_index = 1` i red bez `occupant_index` za istu kategoriju — gost čiji je redni broj u sobi tačno 1 dobija cenu iz prvog reda, ne iz podrazumevanog (poglavlje 2.4a, razrešavanje). *(dokazano unit testom, `resolveAgePricing` — poglavlje 2.4a implementirano kao samostalna funkcija, spremna za M5 da je pozove)*
- [ ] Test: gost čija kategorija nema odgovarajući `age_pricing[]` red (ni uslovljen ni podrazumevani) odbija kreiranje `Quote` sa jasnom porukom — ne pretpostavlja cenu. *(deo dokazan unit testom — `resolveAgePricing` vraća `null` kad nijedan red ne odgovara, tačka na kojoj bi M5 odbio `Quote`; sâmo odbijanje čeka M5, koji još ne postoji)*
- [ ] Upload testnog cenovnika sa uzrasnim tabelama rezultuje `PricelistImportRow` sa popunjenim `extracted_price_basis`/`extracted_age_pricing` kandidatima, ne samo osnovnim poljima (poglavlje 4.2.2). *(čeka AI provajdera, isto obrazloženje kao stavka o PDF/Excel uploadu iznad; model podataka i primena u `RateLineAgePricing` pri odobrenju su dokazani e2e testom)*
- [ ] Prvi `PricelistImport` za novog dobavljača kreira `SupplierExtractionProfile` tek posle prvog `CONFIRMED` reda; drugi uvoz od istog dobavljača, sa istom strukturom dokumenta, ima viši prosečan `match_confidence` od prvog (poglavlje 4.2.5). *(prva polovina dokazana e2e testom — profil se kreira/ažurira pri odobrenju; druga polovina, da profil podiže `match_confidence` sledećeg uvoza, deo je same ekstrakcije i čeka AI provajdera)*
- [ ] Test: uvoz od dobavljača sa postojećim profilom, ali sa dokumentom čija se `structure_signature` ne poklapa — profil se ne primenjuje, uvoz ide sa uobičajenom pouzdanošću i vidljivom napomenom da profil nije iskorišćen.

---

## 8. Otvoreno za dalje

- Tačan format `cancellation_terms_summary` (slobodan tekst vs. strukturirano) — dovoljno je slobodan tekst za sada; ako se pokaže potreba za automatskim tumačenjem uslova van `CancellationRule` tabele, revidira se.
- Obračun konverzije valute za potrebe fakturisanja u RSD (kad ugovor nije u RSD) definiše se detaljno u specifikaciji M10, ne ovde — M3 samo čuva izvornu valutu i cenu.
- Da li `PACKAGE` proizvodi (iz M2) mogu imati sopstveni ugovor u M3 nezavisno od komponenti koje ga čine, ili se uvek sastavljaju od već ugovorenih komponenti — otvoreno dok se ne dođe do stvarnog paket-aranžmana u praksi.
- Break-even/P&L pregled za `CHARTER`/`FIXED_LEASE` periode (poglavlje 2.3a) — definiše se kao izveštaj u M13 (BI) kad ta specifikacija dobije ovu dopunu, ne ovde.
- Tačan OCR provajder/servis za `SCANNED_PDF` (poglavlje 4.2.1) — bira se pri implementaciji, ovaj dokument samo predviđa mesto za tu integraciju.
- Da li prag od 85% (poglavlje 4.2.3) treba biti podesiv po dobavljaču/formatu dokumenta, ili ostaje globalna konstanta — otvoreno dok se ne pokaže potreba iz prakse.
- **Nalazi iz analize stvarnih cenovnika više dobavljača** (avgust 2026, vlasnik dostavio 18 primera iz prakse — CG/HR/CY hoteli i tour-operator ugovori) — cena po uzrasnoj kategoriji (poglavlje 2.4a) je rešena ovom verzijom; ostalo iz iste analize namerno ostaje otvoreno dok se ne odluči prioritet:
  - **Ograničenje tržišta porekla gosta** — više ugovora rate ograničava na spisak zemalja (npr. "važi samo za Kosovo, Češku, Poljsku...") ili dozvoljava dobavljaču da isključi tržište uz najavu — nema mesta u `Contract`/`ContractPeriod` danas.
  - **Ograničenje po segmentu gosta** (FIT vs. grupa 8+ soba vs. MICE) — neki cenovnici važe samo za pojedinačne goste, ne za grupe.
  - **Obavezan minimalni markup koji nameće dobavljač** (npr. "min. 20% iznad ove cene") — danas je `MarkupRule` (M5 poglavlje 2.1) isključivo interna odluka agencije; trebalo bi proveravati protiv donje granice koju ugovor nameće.
  - **Kazna za otkazivanje sa različitom osnovicom po sezoni** (1. noćenje vs. cela rezervacija vs. 100% no-show) — proveriti da `CancellationRule` (poglavlje 2.5) pokriva ovu granularnost, ne samo jedan procenat praga.
  - **Ponavljajući pomoćni troškovi bez mesta u modelu**: kućni ljubimac (po danu, sa ograničenjem), parking, rani check-in/kasni check-out doplata, room service flat fee, **povratni sigurnosni depozit** (nije trošak, drži se pa vraća — dotiče M10, ne samo M3).
  - **Boravišna taksa/gradska taksa sa sopstvenim uzrasnim pragovima**, nezavisnim od `age_policy[]` praga za cenu sobe (u istom dokumentu viđeni različiti brojevi za dete — do 12 za taksu, do 11,99 ili do 18 za cenu sobe) — trenutno van obima (M10/M11 su boravišnu taksu isključili iz obima avgusta 2026), ali podaci pokazuju da je ovo realan trošak koji dobavljač prevaljuje na agenciju/gosta, vredi ponovo razmotriti obim.
