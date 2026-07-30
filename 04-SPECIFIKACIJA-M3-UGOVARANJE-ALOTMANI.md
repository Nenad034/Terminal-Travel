# Specifikacija modula M3 — Ugovaranje i alotmani

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M3) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1 (Core / Identitet i pristup), M2 (Katalog proizvoda)

---

## 1. Svrha i obim modula

M3 upravlja direktnim ugovorima agencije sa dobavljačima (hoteli, prevoznici, osiguravači): ko je dobavljač, koji su uslovi, koliko kapaciteta agencija kontroliše, po kojoj ceni, i do kog roka mora da odluči šta vraća dobavljaču. M2 (Katalog) referencira M3 preko `source_contract_id`, ali M3 je taj koji čuva stvarne cene, kapacitet i rokove — u skladu sa principom "jedan izvor istine".

Van obima: sama rezervacija i naplata (M5, M10), i proizvodi koji dolaze preko API konekcija (M4) — ti nemaju ugovor u ovom smislu.

---

## 2. Model podataka

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
| allotment_mode | enum: `FIXED`, `ON_REQUEST` | potvrđeno: oba tipa postoje |
| total_capacity | integer, nullable | **samo za `FIXED`** — ukupan broj jedinica (soba/mesta) u ovom periodu |
| units_sold | integer, default 0 | **samo za `FIXED`** — atomski se uvećava pri svakoj potvrđenoj rezervaciji (M5); vidi napomenu o konkurentnosti niže |
| release_days_before | integer, nullable | **samo za `FIXED`** — koliko dana pre `stay_from` agencija mora da najavi hotelu šta vraća od neprodatog alotmana |
| created_at / updated_at | timestamp | |

**`ON_REQUEST` period nema `total_capacity` ni `units_sold`** — sistem ne garantuje kapacitet; svaki pokušaj rezervacije u ovom periodu mora proći kroz ručnu ili API potvrdu dobavljača pre nego što se gostu potvrdi (M5 ovo tretira kao status "Na čekanju potvrde dobavljača", ne kao trenutnu potvrdu).

**Napomena o konkurentnosti (za implementaciju M5):** uvećanje `units_sold` mora biti atomska operacija sa proverom (`UPDATE ... SET units_sold = units_sold + 1 WHERE units_sold + n <= total_capacity`, unutar transakcije sa row-level lock-om) — sprečava da dva agenta istovremeno rezervišu poslednju sobu i pređu kapacitet.

### 2.4 `RateLine` — cena po kombinaciji unutar perioda
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| contract_period_id | UUID (FK → ContractPeriod) | |
| board_type | string | npr. "polupansion", "all-inclusive" |
| occupancy | string | npr. "odrasla osoba u dvokrevetnoj", "doplata za jednokrevetnu" |
| price | decimal | u valuti ugovora (`Contract.currency`) |
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

## 4. Uloga AI agenta — upozorenje pred rok za povrat (release)

Kad `release_days_before` period priđe (npr. ostalo je onoliko dana koliko piše u polju), a `units_sold < total_capacity`, agent zadužen za M3 **predlaže** akciju (npr. "vratiti dobavljaču 4 neprodate sobe za period X" ili "tražiti produžetak roka") — ovo spada u nivo **"Predloži pa čovek odobri"** iz poglavlja 7 Master dokumenta, jer povrat kapaciteta dobavljaču je poslovna odluka sa finansijskim uticajem, ne čisto informativna radnja. Agent nikad sam ne šalje potvrdu dobavljaču o vraćanju kapaciteta.

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

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/contracting`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/suppliers` | GET / POST | lista / kreiranje dobavljača |
| `/suppliers/:id` | GET / PATCH | |
| `/contracts` | GET / POST | lista / kreiranje ugovora |
| `/contracts/:id` | GET / PATCH | |
| `/contracts/:id/periods` | GET / POST | sezone unutar ugovora |
| `/contracts/:id/periods/:periodId/rates` | GET / PUT | cenovne stavke |
| `/contracts/:id/periods/:periodId/cancellation-rules` | GET / PUT | pravila otkazivanja |
| `/contracts/:id/periods/:periodId/availability` | GET | preostali kapacitet — koristi M5 pri pretrazi |
| `/contracts/:id/periods/:periodId/reserve` | POST | interni poziv (samo M5) — atomski umanjuje `units_sold`, vraća grešku ako nema kapaciteta |
| `/contracts/expiring-releases` | GET | lista perioda kojima se bliži `release_days_before` rok, za AI agenta i za interni panel |

---

## 7. Izlazni kriterijum (M3 deo Faze 1)

- [ ] Moguće je kreirati dobavljača, ugovor u proizvoljnoj valuti (EUR/RSD), i period sa `FIXED` alotmanom, cenama i pravilima otkazivanja.
- [ ] Moguće je kreirati period sa `ON_REQUEST` modom, bez kapaciteta.
- [ ] Konkurentni pokušaji rezervacije (test: dva simultana zahteva za poslednju preostalu jedinicu) — tačno jedan uspeva, kapacitet se nikad ne pređe.
- [ ] `/contracts/expiring-releases` tačno prijavljuje periode kojima se bliži rok povrata sa neprodatim kapacitetom.
- [ ] M2 proizvod ispravno referencira `Contract` preko `source_contract_id`, bez duplirane cene.

---

## 8. Otvoreno za dalje

- Tačan format `cancellation_terms_summary` (slobodan tekst vs. strukturirano) — dovoljno je slobodan tekst za sada; ako se pokaže potreba za automatskim tumačenjem uslova van `CancellationRule` tabele, revidira se.
- Obračun konverzije valute za potrebe fakturisanja u RSD (kad ugovor nije u RSD) definiše se detaljno u specifikaciji M10, ne ovde — M3 samo čuva izvornu valutu i cenu.
- Da li `PACKAGE` proizvodi (iz M2) mogu imati sopstveni ugovor u M3 nezavisno od komponenti koje ga čine, ili se uvek sastavljaju od već ugovorenih komponenti — otvoreno dok se ne dođe do stvarnog paket-aranžmana u praksi.
