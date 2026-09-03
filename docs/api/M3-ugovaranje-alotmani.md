# API dokumentacija — M3 (Ugovaranje i alotmani)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — B2B subagenti (M7), spoljni AI agenti (M16), budući korporativni klijenti — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/contracting`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1). Bez izuzetka — M3 nema nijedan javan endpoint.
**Novčani iznosi:** uvek `integer` u najmanjoj jedinici valute (npr. `8600` = 86.00 EUR), nikad decimal. Ovo važi za `price`, `flatAmount`, `discountAmount`, `ukupnaFiksnaObaveza`, `amountPerNight`, `cribFeePerNight`.
**Datumi:** zahtev prima `YYYY-MM-DD`; odgovor uvek vraća pun ISO oblik (`2026-06-01T00:00:00.000Z`). Vremenski deo je uvek ponoć UTC — M3 barata kalendarskim danima, ne trenucima.

**Ko ovo sme da čita — bitna ograda pre nego što krenete:** M3 sadrži **nabavne (neto) cene i uslove ugovora sa dobavljačem**. To nije podatak koji se izlaže gostu ni subagentu. Sve dozvole ispod (`M3/...`) dodeljuju se u praksi samo ulogama Vlasnik/Direktor/Sales Manager (M3 spec poglavlje 5). Ako gradite integraciju za subagenta ili spoljnog AI agenta, gotovo sigurno vam ne treba M3 nego **M5** (`/api/v1/sales/search`), koji vraća prodajnu cenu sa već primenjenom maržom. M3 API je alat za unos ugovora, ne za prodaju.

**Verzija podataka u primerima:** svi odgovori ispod su **stvarno uhvaćeni** pozivima nad lokalnom bazom 3.9.2026 (ugovor `MOCK-B2C/2026-001`, dobavljač „MOCK-B2C Jadran Hoteli d.o.o."), osim dva mesta koja su izričito označena kao rekonstruisana iz modela jer u bazi još nema takvih redova (`offers`, `ancillary-services` — vidi napomene tamo).

---

## Vrednosti nabrajanja (enum) — sve na jednom mestu

Nijedno od ovih polja ne prima slobodan tekst; nepoznata vrednost vraća `400`.

| Polje | Dozvoljene vrednosti |
| :---- | :---- |
| `Supplier.type` | `HOTEL`, `PREVOZNIK`, `OSIGURAVAC`, `DRUGO` |
| `Supplier.status` | `ACTIVE`, `INACTIVE` |
| `Contract.currency` | `EUR`, `RSD`, `USD` |
| `Contract.status` | `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` |
| `Contract.defaultTipNastupanja` | `ORGANIZATOR`, `POSREDNIK` |
| `Contract.commissionModel` | `NET`, `COMMISSIONABLE` |
| `ContractPeriod.allotmentMode` | `FIXED`, `ON_REQUEST`, `CHARTER`, `FIXED_LEASE` |
| `RateLine.priceBasis` | `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` |
| `agePricing[].ageCategory` | `ADULT`, `CHILD`, `TEEN`, `INFANT` |
| `agePricing[].pricingMode` | `PERCENTAGE_OF_BASE_PRICE`, `FLAT_PRICE_PER_NIGHT` |
| `CancellationRule.ruleType` | `PRE_ARRIVAL`, `EARLY_DEPARTURE` |
| `CancellationRule.earlyDepartureBasis` | `PERCENTAGE_OF_REMAINING_STAY`, `FLAT_AMOUNT` |
| `PricelistOffer.offerType` | `EARLY_BOOKING`, `FREE_NIGHTS` |
| `PricelistOffer.discountType` | `PERCENTAGE`, `FIXED_AMOUNT` |
| `AncillaryService.kind` | `SURCHARGE`, `DISCOUNT` |
| `AncillaryService.pricingMode` | `FLAT_PER_UNIT`, `PERCENTAGE_OF_NIGHTLY_RATE` |
| `AncillaryService.priceBasis` | `PER_PERSON_PER_NIGHT`, `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_STAY`, `PER_ROOM_PER_STAY`, `PER_PET_PER_NIGHT`, `PER_PET_PER_STAY` |
| `AncillaryService.payable` | `AGENCY`, `ON_SITE` |
| `TouristTaxInfo.collectedBy` | `PAID_ON_SITE_BY_GUEST`, `INVOICED_TO_AGENCY` |
| `PricelistImport.sourceFormat` | `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF` |

---

## Dobavljači

### GET /suppliers
Dozvola: `M3/supplier/VIEW`. Vraća sve dobavljače, bez stranica (paginacija nije implementirana — lista je operativno mala).

**Odgovor `200`:**
```json
[
  {
    "id": "515a72e5-1945-40ae-a906-63ca52805a86",
    "name": "MOCK-B2C Jadran Hoteli d.o.o.",
    "type": "HOTEL",
    "taxId": "MOCK-B2C-100000001",
    "registrationNumber": "MOCK-B2C-20000001",
    "country": "Crna Gora",
    "contactName": "Milica Vuković",
    "contactEmail": "rezervacije@jadran-hoteli.example",
    "contactPhone": "+382 30 123 456",
    "bankAccount": null,
    "status": "ACTIVE",
    "createdAt": "2026-08-17T15:41:06.656Z",
    "updatedAt": "2026-08-17T15:41:06.656Z"
  }
]
```

### POST /suppliers
Dozvola: `M3/supplier/CREATE`. **Sva polja u primeru su obavezna** — nema opcionih. `bankAccount` i `status` se ne primaju pri kreiranju (`status` uvek kreće kao `ACTIVE`).

**Zahtev:**
```json
{
  "name": "Jadran Hoteli d.o.o.",
  "type": "HOTEL",
  "taxId": "100000001",
  "registrationNumber": "20000001",
  "country": "Crna Gora",
  "contactName": "Milica Vuković",
  "contactEmail": "rezervacije@jadran-hoteli.example",
  "contactPhone": "+382 30 123 456"
}
```
**Odgovor `201`:** isti oblik kao jedan element `GET /suppliers`.

`contactEmail` prolazi kroz proveru oblika e-adrese — neispravna adresa vraća `400` sa `"contactEmail must be an email"`.

### GET /suppliers/:id
Dozvola: `M3/supplier/VIEW`. Nepostojeći `id` → `404` `{"message":"Zapis nije pronađen","error":"Not Found","statusCode":404}`.

### PATCH /suppliers/:id
Dozvola: `M3/supplier/EDIT`. Prima **samo** `name`, `contactName`, `contactEmail`, `contactPhone`, `bankAccount`, `status` — sva opciona.

**`type`, `taxId`, `registrationNumber` i `country` se ne mogu izmeniti** ovim pozivom; slanje bilo kog od njih vraća `400`. To su identifikaciona polja pravnog lica — ako se stvarno promene, u pitanju je drugi dobavljač, ne izmena postojećeg.

### GET /suppliers/:id/contacts
Dozvola: `M3/supplier-contact/VIEW`. Kontakt-osobe su odvojene od `contactName`/`contactEmail` na samom dobavljaču — ta polja su „zvanični kontakt firme", a ovo su pojedinačne osobe sa kojima se radi.

**Odgovor `200`:** `[]` kad ih nema (ne `404`).

### POST /suppliers/:id/contacts
Dozvola: `M3/supplier-contact/CREATE`.

**Zahtev:**
```json
{ "fullName": "Ana Perović", "email": "ana.perovic@jadran-hoteli.example", "phone": "+382 69 111 222" }
```

### GET /suppliers/:id/contacts/:contactId · PATCH /suppliers/:id/contacts/:contactId
Dozvole: `M3/supplier-contact/VIEW` odnosno `EDIT`. `PATCH` prima i `status`.

**`linked_user_id` se ovde NE popunjava.** To polje daje kontakt-osobi dobavljača pristup portalu za chat i popunjava se isključivo kroz M19 tok (dozvola `M19/supplier-conversation/GRANT_ACCESS`). Slanje tog polja ovde nema efekta — ograda je namerna, jer davanje pristupa spoljnom licu ne sme da bude sporedni efekat izmene kontakt-podataka.

---

## Ugovori

### GET /contracts
Dozvola: `M3/contract/VIEW`.

### POST /contracts
Dozvola: `M3/contract/CREATE`.

**Zahtev:**
```json
{
  "supplierId": "515a72e5-1945-40ae-a906-63ca52805a86",
  "contractNumber": "JH/2027-001",
  "currency": "EUR",
  "validFrom": "2027-01-01",
  "validTo": "2027-12-31",
  "cancellationTermsSummary": "Bez naplate do 21 dan pre dolaska, potom 30% cene aranžmana.",
  "documentUrl": "https://primer.rs/ugovori/jh-2027-001.pdf",
  "defaultTipNastupanja": "ORGANIZATOR",
  "commissionModel": "NET"
}
```

`defaultTipNastupanja` i `commissionModel` su tehnički opcioni pri kreiranju, ali **ugovor bez njih ne može preći u `ACTIVE`** (vidi `PATCH` ispod). `commissionPercentage` je obavezan samo kad je `commissionModel = "COMMISSIONABLE"`.

### GET /contracts/:id
Dozvola: `M3/contract/VIEW`. **Vraća i ugnežden niz `periods[]`** — nije potrebno zvati `/periods` posebno ako vam treba samo pregled.

**Odgovor `200`:**
```json
{
  "id": "0c6c0ac8-a503-483c-a1b3-d182e2393ae9",
  "supplierId": "515a72e5-1945-40ae-a906-63ca52805a86",
  "contractNumber": "MOCK-B2C/2026-001",
  "currency": "EUR",
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validTo": "2027-12-31T00:00:00.000Z",
  "cancellationTermsSummary": "Bez naplate do 21 dan pre dolaska, potom 30% cene aranžmana.",
  "documentUrl": "https://primer.rs/mock/ugovor-2026-001.pdf",
  "paymentTermsDays": 30,
  "status": "ACTIVE",
  "defaultTipNastupanja": "ORGANIZATOR",
  "commissionModel": null,
  "commissionPercentage": null,
  "createdAt": "2026-08-17T15:41:06.726Z",
  "updatedAt": "2026-08-17T15:41:06.726Z",
  "createdBy": null,
  "periods": [
    {
      "id": "b20ea288-2bca-4723-8f55-4351ef58f4ef",
      "contractId": "0c6c0ac8-a503-483c-a1b3-d182e2393ae9",
      "stayFrom": "2026-06-01T00:00:00.000Z",
      "stayTo": "2026-09-30T00:00:00.000Z",
      "roomType": "DBL",
      "allotmentMode": "FIXED",
      "totalCapacity": 40,
      "unitsSold": 0,
      "releaseDaysBefore": 14,
      "ukupnaFiksnaObaveza": null,
      "fixedObligationCurrency": null,
      "paymentSchedule": null,
      "agePolicyOverride": null,
      "minStayNights": null,
      "maxStayNights": null,
      "createdAt": "2026-08-17T15:41:06.767Z",
      "updatedAt": "2026-08-17T15:41:06.767Z"
    }
  ]
}
```

### PATCH /contracts/:id
Dozvola: `M3/contract/EDIT`. Ovde se menja `status`, i ovde su dve zaštite koje najčešće iznenade:

```json
{"message":"Ugovor ne može preći u ACTIVE bez popunjenog default_tip_nastupanja (M3 spec §2.2)","error":"Bad Request","statusCode":400}
```
```json
{"message":"Ugovor ne može preći u ACTIVE bez popunjenog commission_model (M3 spec §2.2b)","error":"Bad Request","statusCode":400}
```

Obe su namerne: bez `tip_nastupanja` se ne zna da li agencija nastupa kao organizator ili posrednik (menja zakonsku odgovornost i način fakturisanja), a bez `commission_model` se ne zna da li je ugovorena cena neto ili bruto sa provizijom — što bi tiho pokvarilo maržu na svakoj rezervaciji iz tog ugovora.

### GET /contracts/expiring-releases
Dozvola: `M3/contract-period/VIEW` (ne `contract`). Vraća periode kojima se bliži rok povrata neprodatog kapaciteta (`releaseDaysBefore`), a koji još imaju neprodatih jedinica. Namenjen internom panelu i AI agentu koji upozorava na rokove.

**Odgovor `200`:** niz perioda u istom obliku kao `periods[]` iznad.

> **Pažnja pri redosledu ruta:** ovaj put je registrovan pre `GET /contracts/:id`. Ako sami gradite sličan sloj, pazite da `expiring-releases` ne bude protumačeno kao vrednost `:id`.

---

## Periodi (sezone unutar ugovora)

Prefiks svih: `/contracts/:contractId/periods`.

### GET /contracts/:contractId/periods
Dozvola: `M3/contract-period/VIEW`.

### POST /contracts/:contractId/periods
Dozvola: `M3/contract-period/EDIT`. Koja su polja obavezna **zavisi od `allotmentMode`**:

| `allotmentMode` | Obavezno dodatno | Nije dozvoljeno / nema smisla |
| :---- | :---- | :---- |
| `FIXED` | `totalCapacity` | `ukupnaFiksnaObaveza` |
| `ON_REQUEST` | — (nema kapaciteta) | `totalCapacity`, `releaseDaysBefore` |
| `CHARTER` | `totalCapacity`, `ukupnaFiksnaObaveza`, `fixedObligationCurrency` | `releaseDaysBefore` |
| `FIXED_LEASE` | `totalCapacity`, `ukupnaFiksnaObaveza`, `fixedObligationCurrency`; opciono `paymentSchedule[]` | `releaseDaysBefore` |

**Zahtev (`FIXED`):**
```json
{
  "stayFrom": "2027-06-01",
  "stayTo": "2027-09-30",
  "roomType": "DBL",
  "allotmentMode": "FIXED",
  "totalCapacity": 40,
  "releaseDaysBefore": 14,
  "minStayNights": 3
}
```

**Zahtev (`FIXED_LEASE` sa planom plaćanja):**
```json
{
  "stayFrom": "2027-06-01",
  "stayTo": "2027-09-30",
  "roomType": "APP2",
  "allotmentMode": "FIXED_LEASE",
  "totalCapacity": 12,
  "ukupnaFiksnaObaveza": 4800000,
  "fixedObligationCurrency": "EUR",
  "paymentSchedule": [
    { "dueDate": "2027-02-01", "amount": 1600000 },
    { "dueDate": "2027-04-01", "amount": 1600000 },
    { "dueDate": "2027-06-01", "amount": 1600000 }
  ]
}
```

**Preklapanje datuma se odbija** — dva perioda za isti ugovor i **isti `roomType`** ne smeju da se seku:
```json
{"message":"Period se datumski preklapa sa postojećim periodom b20ea288-2bca-4723-8f55-4351ef58f4ef (2026-06-01–2026-09-30) za istu sobu (M3 spec §2.3b)","error":"Bad Request","statusCode":400}
```
Susedni periodi (jedan se završava, drugi počinje sutradan) prolaze. Različit `roomType` u istom datumskom opsegu takođe prolazi — to su dva odvojena cenovnika.

`agePolicyOverride[]` je izuzetak od uzrasne politike sobe (iz M2) **samo za ovaj period**. Oblik jednog reda:
```json
{ "category": "CHILD", "ageFrom": 2, "ageTo": 11.99, "countsTowardCapacity": true, "maxCount": 2, "requiresCrib": false, "cribIncluded": null }
```
Gornja granica se piše kao `11.99`, ne `12` — ceo broj kao granica je dvosmislen („da li dete od 12 godina ulazi?"). Isti zapis se koristi u M2.

### GET /contracts/:contractId/periods/:periodId
Dozvola: `M3/contract-period/VIEW`.

---

## Cene (RateLine)

### GET /contracts/:contractId/periods/:periodId/rates
Dozvola: `M3/contract-period/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "6cc26e8a-8fc1-400e-b6f6-3c09e063bfaf",
    "contractPeriodId": "b20ea288-2bca-4723-8f55-4351ef58f4ef",
    "boardType": "HB",
    "occupancy": "2+0",
    "priceBasis": "PER_ROOM_PER_NIGHT",
    "price": 8600,
    "cribFeePerNight": null,
    "createdAt": "2026-08-17T15:41:06.842Z",
    "updatedAt": "2026-08-17T15:41:06.842Z",
    "agePricing": []
  },
  {
    "id": "74b8d54c-25b5-4590-a0b8-4680fc9de631",
    "contractPeriodId": "b20ea288-2bca-4723-8f55-4351ef58f4ef",
    "boardType": "BB",
    "occupancy": "2+0",
    "priceBasis": "PER_ROOM_PER_NIGHT",
    "price": 7100,
    "cribFeePerNight": null,
    "createdAt": "2026-08-17T15:41:06.842Z",
    "updatedAt": "2026-08-17T15:41:06.842Z",
    "agePricing": []
  }
]
```
`price: 8600` znači **86.00 EUR po sobi po noći** (valuta se nasleđuje iz ugovora, ne stoji na cenovnoj stavci).

### PUT /contracts/:contractId/periods/:periodId/rates
Dozvola: `M3/contract-period/EDIT`.

> **`PUT` ovde UVEK KREIRA nov red** — ne zamenjuje ceo skup i ne ažurira postojeći po ključu. Ime metoda je nasleđeno iz specifikacije; ponašanje je „dodaj cenovnu stavku". Isto važi za `offers` i `ancillary-services`. Ako pošaljete istu kombinaciju `boardType`/`occupancy` dvaput, dobićete **dva reda**, a ne izmenu prvog. Ovo je najlakša greška da se napravi na ovom API-ju.

**Zahtev (cena po sobi):**
```json
{ "boardType": "HB", "occupancy": "2+0", "priceBasis": "PER_ROOM_PER_NIGHT", "price": 8600 }
```

**Zahtev (cena po osobi, sa cenom po uzrastu):**
```json
{
  "boardType": "HB",
  "occupancy": "2+1",
  "priceBasis": "PER_PERSON_PER_NIGHT",
  "price": 4300,
  "cribFeePerNight": 500,
  "agePricing": [
    { "ageCategory": "CHILD", "occupantIndex": 1, "pricingMode": "PERCENTAGE_OF_BASE_PRICE", "percentage": 50 },
    { "ageCategory": "CHILD", "pricingMode": "PERCENTAGE_OF_BASE_PRICE", "percentage": 70 },
    { "ageCategory": "INFANT", "pricingMode": "FLAT_PRICE_PER_NIGHT", "flatPrice": 0 }
  ]
}
```

**Kako se bira red iz `agePricing[]`** (isto pravilo koje M5 primenjuje pri obračunu): red sa `occupantIndex` važi **samo** za dete koje je po redu tačno na tom mestu u sobi; red bez `occupantIndex` je podrazumevani za tu kategoriju. U primeru iznad: prvo dete plaća 50%, svako naredno 70%. `minAdultsPresent` dodatno uslovljava red brojem odraslih u sobi.

Ako gost ne pogađa nijedan red — ni uslovljen ni podrazumevani — **cena se ne pretpostavlja**; M5 odbija da napravi ponudu. Namerno: pogrešno pogođena dečja cena je greška koja se otkriva tek na recepciji.

---

## Pravila otkazivanja

### GET /contracts/:contractId/periods/:periodId/cancellation-rules
Dozvola: `M3/contract-period/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "e24e6456-70f1-401a-bb26-30e8da709a2b",
    "contractPeriodId": "b20ea288-2bca-4723-8f55-4351ef58f4ef",
    "ruleType": "PRE_ARRIVAL",
    "daysBeforeStay": 21,
    "refundPercentage": 70,
    "earlyDepartureBasis": null,
    "earlyDeparturePercentage": null,
    "earlyDepartureFlatAmount": null
  }
]
```
`refundPercentage: 70` je **procenat koji se vraća gostu**, ne procenat kazne. Otkaz 21 dan pre dolaska → gost dobija nazad 70%.

### PUT /contracts/:contractId/periods/:periodId/cancellation-rules
Dozvola: `M3/contract-period/EDIT`. Dva međusobno isključiva oblika, bira ih `ruleType` (podrazumevano `PRE_ARRIVAL` ako se izostavi):

**Otkaz pre dolaska:**
```json
{ "ruleType": "PRE_ARRIVAL", "daysBeforeStay": 21, "refundPercentage": 70 }
```

**Raniji odlazak (skraćenje već započetog boravka):**
```json
{ "ruleType": "EARLY_DEPARTURE", "earlyDepartureBasis": "PERCENTAGE_OF_REMAINING_STAY", "earlyDeparturePercentage": 100 }
```
ili
```json
{ "ruleType": "EARLY_DEPARTURE", "earlyDepartureBasis": "FLAT_AMOUNT", "earlyDepartureFlatAmount": 5000 }
```
Polja iz jednog oblika se u drugom ne validiraju i ostaju `null`.

---

## Akcije na cenovniku (PricelistOffer)

### GET /contracts/:contractId/periods/:periodId/offers
Dozvola: `M3/contract-period/VIEW`. Za period bez akcija vraća `[]` (provereno pozivom).

### PUT /contracts/:contractId/periods/:periodId/offers
Dozvola: `M3/contract-period/EDIT`. **Kreira nov red pri svakom pozivu** (ista napomena kao kod `rates`).

> Primeri zahteva u ovom odeljku su **sastavljeni iz modela podataka i pravila validacije, nisu uhvaćeni pozivom** — u bazi trenutno nema nijedne akcije. Oblik odgovora prati polja iz zahteva plus `id`, `contractPeriodId`, `createdAt`, `updatedAt`.

**Rana rezervacija, popust u procentima:**
```json
{
  "offerType": "EARLY_BOOKING",
  "bookingFrom": "2026-11-01",
  "bookingTo": "2027-01-31",
  "discountType": "PERCENTAGE",
  "discountPercentage": 15,
  "depositPercentage": 30,
  "depositDeadline": "2027-02-15"
}
```

**„Plati 6, ostani 7":**
```json
{
  "offerType": "FREE_NIGHTS",
  "bookingFrom": "2026-11-01",
  "bookingTo": "2027-05-31",
  "stayNights": 7,
  "payNights": 6
}
```

**`bookingFrom`/`bookingTo` je kada se rezerviše, ne kada se boravi.** Boravak je već određen periodom (`stayFrom`/`stayTo`). Ova dva para se lako pomešaju, a posledica je akcija koja važi u pogrešnom prozoru.

Opciona ograničenja na oba tipa: `minAge`/`maxAge`, `validArrivalWeekdays` (niz brojeva, npr. `[5, 6]` za petak i subotu), `excludedRoomTypes` (niz oznaka soba), `combinableWithOtherOffers`.

> **M3 samo čuva ova ograničenja — ne proverava ih.** Odbijanje ponude koja krši `minStayNights`, dozvoljene dane dolaska ili uzrasno ograničenje je posao M5 pri sastavljanju ponude. Ako zovete M3 direktno, nemojte pretpostaviti da vam je akcija „odobrena" time što je upisana.

---

## Doplate i popusti (AncillaryService)

### GET /contracts/:contractId/periods/:periodId/ancillary-services
Dozvola: `M3/contract-period/VIEW`. Za period bez doplata vraća `[]` (provereno pozivom).

### PUT /contracts/:contractId/periods/:periodId/ancillary-services
Dozvola: `M3/contract-period/EDIT`. **Kreira nov red pri svakom pozivu.**

> Kao i kod akcija: primeri ispod su **sastavljeni iz modela i pravila validacije, nisu uhvaćeni pozivom** — tabela `ancillary_services` je prazna (migracija iz septembra 2026 zahtevala je praznu tabelu jer `price_basis` nema podrazumevanu vrednost).

Ova struktura nosi **i doplatu i popust** — razlikuje ih `kind`, dok je iznos **uvek pozitivan**. Negativan iznos uz `DISCOUNT` bio bi dvostruka negacija i daje pogrešan znak.

**Doplata za pun pansion, po osobi po noći:**
```json
{
  "name": "Doplata za pun pansion",
  "kind": "SURCHARGE",
  "pricingMode": "FLAT_PER_UNIT",
  "flatAmount": 1200,
  "priceBasis": "PER_PERSON_PER_NIGHT",
  "isMandatory": false,
  "isRefundable": true,
  "payable": "AGENCY"
}
```

**Obavezna doplata po sobi — `coversPersons` je ovde OBAVEZAN:**
```json
{
  "name": "Doplata za pogled na more",
  "kind": "SURCHARGE",
  "pricingMode": "FLAT_PER_UNIT",
  "flatAmount": 2000,
  "priceBasis": "PER_ROOM_PER_NIGHT",
  "coversPersons": 2,
  "isMandatory": true,
  "payable": "AGENCY"
}
```
Bez `coversPersons` na `PER_ROOM_*` osnovi poziv vraća `400`. Razlog je praktičan: „doplata za sobu 20 EUR" ne znači ništa dok se ne zna koliko osoba ta soba pokriva, pa se stavka ne bi mogla ni primeniti na stvaran sastav gostiju. Bolje odbiti pri unosu nego tiho pogrešno naplatiti pri prodaji.

**Popust za dete, ograničen uzrastom:**
```json
{
  "name": "Popust za dete do 12 godina",
  "kind": "DISCOUNT",
  "pricingMode": "PERCENTAGE_OF_NIGHTLY_RATE",
  "percentageOfNightlyRate": 30,
  "priceBasis": "PER_PERSON_PER_NIGHT",
  "childMaxAge": 11.99,
  "maxChildren": 2
}
```

**Doplata koja se plaća na licu mesta:**
```json
{
  "name": "Boravišna taksa i osiguranje",
  "kind": "SURCHARGE",
  "pricingMode": "FLAT_PER_UNIT",
  "flatAmount": 150,
  "priceBasis": "PER_PERSON_PER_NIGHT",
  "isMandatory": true,
  "payable": "ON_SITE"
}
```

> **`payable: "ON_SITE"` menja obračun nizvodno.** Takva stavka **ne ulazi u ukupno zaduženje gosta prema agenciji** (M5), ali se **ispisuje na ugovoru i na vaučeru** da gost zna šta ga čeka na recepciji. Ko ovo previdi, sabraće isti iznos dvaput.

Ostala opciona polja: `maxAdults`, `maxChildren`, `maxQuantity`, `notes`.

---

## Boravišna taksa (informativno)

### GET /contracts/:contractId/periods/:periodId/tourist-tax
Dozvola: `M3/contract-period/VIEW`.

**Kad taksa nije uneta, odgovor je `200` sa praznim telom** — ne `404`, ne `{}`. Proverite prazan odgovor pre parsiranja.

### PUT /contracts/:contractId/periods/:periodId/tourist-tax
Dozvola: `M3/contract-period/EDIT`. **Ovaj `PUT` je jedini u M3 koji se stvarno ponaša kao `PUT`** — odnos je 1:1 po periodu, pa ponovljen poziv menja postojeći zapis umesto da doda nov.

```json
{
  "includedInPrice": false,
  "collectedBy": "PAID_ON_SITE_BY_GUEST",
  "amountPerNight": 150,
  "currency": "EUR",
  "taxExemptMaxAge": 11.99,
  "notes": "Naplaćuje hotel na recepciji pri prijavi."
}
```
`collectedBy` je obavezan samo kad je `includedInPrice: false`.

> **Ovo polje je isključivo informativno.** Nijedan endpoint M10 (Finansije) ni M11 (Compliance) ga ne čita kao osnovu za fakturisanje ili poresku prijavu, i ne sme se tako koristiti — provereno pretragom kroz kod. Služi da se operateru i gostu kaže šta se plaća na licu mesta.

---

## Kapacitet

### GET /contracts/:contractId/periods/:periodId/availability
Dozvola: `M3/contract-period/VIEW`. Koristi ga M5 pri pretrazi.

**Odgovor `200`:**
```json
{ "allotmentMode": "FIXED", "totalCapacity": 40, "unitsSold": 0, "remaining": 40 }
```

### POST /contracts/:contractId/periods/:periodId/reserve
Dozvola: `M3/contract-period/EDIT`.

**Zahtev:**
```json
{ "units": 1 }
```
`units` se može izostaviti — podrazumeva se `1`.

**Odgovor `201` (period sa kapacitetom):**
```json
{ "reserved": true, "unitsSold": 1, "remaining": 39 }
```

**Odgovor `201` (`ON_REQUEST` — nema kapaciteta za brojanje):**
```json
{ "reserved": true, "allotmentMode": "ON_REQUEST", "requiresSupplierConfirmation": true }
```
Ovde `reserved: true` **ne znači da je mesto obezbeđeno** — znači samo da je zahtev prihvaćen; potvrda ide kroz ručni tok sa dobavljačem. Ko ovo protumači kao potvrđenu rezervaciju, prodaće nešto što nema.

**Nema kapaciteta → `400`:**
```json
{"message":"Nema dovoljno preostalog kapaciteta za ovaj period (M3 spec §2.3)","error":"Bad Request","statusCode":400}
```

**Konkurentnost:** umanjenje je jedan atomski `UPDATE` sa uslovom, pa dva istovremena poziva za poslednju jedinicu ne mogu oba proći — tačno jedan dobija `201`, drugi `400`. Dokazano testom sa 10 stvarno paralelnih HTTP zahteva. Ne treba vam sopstveno zaključavanje pre poziva.

> **Dve ograde koje se ne vide iz specifikacije:**
> 1. Specifikacija ovaj endpoint opisuje kao „interni poziv (samo M5)", ali u kodu **nema provere da poziv dolazi iz M5** — sme ga pozvati svako sa `M3/contract-period/EDIT`. Ograničenje je organizaciono (ko ima dozvolu), ne tehničko. Ako zovete direktno, umanjujete stvaran alotman bez ijedne rezervacije iza njega.
> 2. **Suprotna radnja — oslobađanje kapaciteta — nema svoj endpoint.** Postoji u kodu (`release()`) i poziva je M5 pri otkazivanju, ali spolja nije dostupna. Kapacitet umanjen direktnim `reserve` pozivom ne možete vratiti kroz API.

---

## Uvoz cenovnika

Tok: dobavljač pošalje cenovnik (PDF/Excel) → uvoz se registruje → AI izvuče redove → **čovek odobri svaki red** → tek tada nastaje stvarna cena.

### GET /pricelist-imports · GET /pricelist-imports/:id
Dozvola: `M3/pricelist-import/VIEW`. `GET /:id` vraća i ugnežden `rows[]`.

**Odgovor `200`:**
```json
[
  {
    "id": "f3651c7e-dd88-4a8a-9395-bc2965ff4630",
    "supplierId": "f3788715-dfd5-40c7-8a57-6d903d122a65",
    "sourceFileUrl": "https://example.com/x.pdf",
    "sourceFormat": "PDF",
    "status": "COMPLETED",
    "createdBy": "1456e942-7042-4156-bd6d-f1b49b5a4004",
    "createdAt": "2026-08-14T20:39:25.649Z"
  }
]
```

### POST /pricelist-imports
Dozvola: `M3/pricelist-import/CREATE` — jedina M3 dozvola koju sme imati i AI agent, i to samo za predlog, nikad za potvrdu.

```json
{ "supplierId": "515a72e5-...", "sourceFileUrl": "https://primer.rs/cenovnici/jh-2027.pdf", "sourceFormat": "PDF" }
```

> **Stanje u septembru 2026:** endpoint prima oba formata i registruje uvoz, ali **sama AI ekstrakcija još nije povezana** — uvoz ostaje u `PROCESSING` dok se ne izabere AI provajder. Redove je moguće uneti i pregledati, ali ih ništa ne popunjava automatski.

### GET /pricelist-imports/:id/rows
Dozvola: `M3/pricelist-import/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "2bfda51e-e59b-4227-880b-f2188872df33",
    "pricelistImportId": "f3651c7e-dd88-4a8a-9395-bc2965ff4630",
    "extractedHotelName": "Nepoznat hotel",
    "matchedProductId": null,
    "matchConfidence": null,
    "extractedRoomType": "X",
    "extractedBoardType": "X",
    "extractedOccupancy": "X",
    "extractedStayFrom": "2027-10-01T00:00:00.000Z",
    "extractedStayTo": "2027-10-10T00:00:00.000Z",
    "extractedPrice": 1000,
    "extractedCurrency": "EUR",
    "extractedPriceBasis": null,
    "extractedAgePricing": null,
    "extractedCribFeePerNight": null,
    "reviewStatus": "REJECTED",
    "reviewedBy": "1456e942-7042-4156-bd6d-f1b49b5a4004"
  }
]
```

### POST /pricelist-imports/:id/rows/:rowId/approve
Dozvola: `M3/pricelist-import/APPROVE_ROW` — **nikad se ne dodeljuje AI agentu.** Poziv se dodatno beleži kao agentski potez.

```json
{ "decision": "CONFIRMED" }
```
ili, kad AI nije pogodio proizvod pa ga čovek bira:
```json
{ "decision": "MANUALLY_MATCHED", "matchedProductId": "b7e2f1a0-..." }
```

Odobrenje kreira stvarni `ContractPeriod`/`RateLine`. Odbijanja koja ćete videti:
```json
{"message":"Red mora imati matched_product_id pre odobrenja (M3 spec §4.2.3/§4.2.4)","error":"Bad Request","statusCode":400}
{"message":"Poklopljeni proizvod nema source_contract_id — nije CONTRACTED proizvod","error":"Bad Request","statusCode":400}
{"message":"extracted_price_basis nije prepoznat — ne može se pretpostaviti PER_ROOM/PER_PERSON (M3 spec §2.4)","error":"Bad Request","statusCode":400}
{"message":"Stavka ne pripada navedenom uvozu","error":"Bad Request","statusCode":400}
```

Treća poruka je namerna stroga ograda: ako se iz dokumenta ne vidi da li je cena po sobi ili po osobi, sistem **ne pogađa**. Razlika je dvostruka ili polovična cena.

### POST /pricelist-imports/:id/rows/:rowId/reject
Dozvola: `M3/pricelist-import/APPROVE_ROW`. Bez tela zahteva. Odbacuje red bez ikakvog upisa u cenovnik.

> **Nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `matchConfidence`.** Ovo je svesno strože od uobičajene prakse (gde visoka pouzdanost prolazi bez pregleda). Razlog: pogrešna nabavna cena tiho menja maržu na svakoj budućoj rezervaciji iz tog ugovora, i otkriva se tek pri obračunu. Ne očekujte prag iznad kog se odobrenje preskače — neće ga biti.

---

## Greške — zajednički oblik

Sve greške imaju isti oblik (NestJS standard):
```json
{ "message": "opis greške", "error": "Bad Request", "statusCode": 400 }
```
Kod greške validacije `message` je **niz** poruka, po jedna za svako polje:
```json
{ "message": ["price must be an integer number", "boardType must be a string"], "error": "Bad Request", "statusCode": 400 }
```

| Kod | Kada |
| :---- | :---- |
| `400` | validacija tela zahteva, preklapanje perioda, nedovoljan kapacitet, prelazak u `ACTIVE` bez obaveznih polja |
| `401` | `{"message":"Nedostaje Bearer token",...}` ili `{"message":"Nevažeći ili istekao token",...}` |
| `403` | token je ispravan, ali uloga nema traženu dozvolu — poruka imenuje tačno koju: `{"message":"Nema dozvolu M3/contract/CREATE","error":"Forbidden","statusCode":403}` |
| `404` | `{"message":"Zapis nije pronađen",...}` — nepostojeći `id`; za period `{"message":"Period nije pronađen",...}` |

Nepoznato polje u telu zahteva se **ne ignoriše** — vraća `400`. Ovo je namerno: tiho preskočeno polje znači da integrator misli da je nešto poslao, a nije.
