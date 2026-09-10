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

| Polje                                  | Dozvoljene vrednosti                                                                                                              |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `Supplier.type`                        | `HOTEL`, `PREVOZNIK`, `OSIGURAVAC`, `DRUGO`                                                                                       |
| `Supplier.status`                      | `ACTIVE`, `INACTIVE`                                                                                                              |
| `Contract.currency`                    | `EUR`, `RSD`, `USD`                                                                                                               |
| `Contract.status`                      | `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`                                                                                        |
| `Contract.defaultTipNastupanja`        | `ORGANIZATOR`, `POSREDNIK`                                                                                                        |
| `Contract.commissionModel`             | `NET`, `COMMISSIONABLE`                                                                                                           |
| `ContractPeriod.allotmentMode`         | `FIXED`, `ON_REQUEST`, `CHARTER`, `FIXED_LEASE`                                                                                   |
| `RateLine.priceBasis`                  | `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT`, `PER_ROOM_PER_STAY`, `PER_PERSON_PER_STAY` (poslednje dve od v1.27)                 |
| `agePricing[].ageCategory`             | `ADULT`, `CHILD`, `TEEN`, `INFANT`                                                                                                |
| `agePricing[].pricingMode`             | `PERCENTAGE_OF_BASE_PRICE`, `FLAT_PRICE_PER_NIGHT`                                                                                |
| `CancellationRule.ruleType`            | `PRE_ARRIVAL`, `EARLY_DEPARTURE`                                                                                                  |
| `CancellationRule.earlyDepartureBasis` | `PERCENTAGE_OF_REMAINING_STAY`, `FLAT_AMOUNT`                                                                                     |
| `PricelistOffer.offerType`             | `EARLY_BOOKING`, `FREE_NIGHTS`                                                                                                    |
| `PricelistOffer.discountType`          | `PERCENTAGE`, `FIXED_AMOUNT`                                                                                                      |
| `AncillaryService.kind`                | `SURCHARGE`, `DISCOUNT`                                                                                                           |
| `AncillaryService.pricingMode`         | `FLAT_PER_UNIT`, `PERCENTAGE_OF_NIGHTLY_RATE`                                                                                     |
| `AncillaryService.priceBasis`          | `PER_PERSON_PER_NIGHT`, `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_STAY`, `PER_ROOM_PER_STAY`, `PER_PET_PER_NIGHT`, `PER_PET_PER_STAY` |
| `AncillaryService.payable`             | `AGENCY`, `ON_SITE`                                                                                                               |
| `TouristTaxInfo.collectedBy`           | `PAID_ON_SITE_BY_GUEST`, `INVOICED_TO_AGENCY`                                                                                     |
| `PricelistImport.sourceFormat`         | `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF`                                                                            |

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
{
  "fullName": "Ana Perović",
  "email": "ana.perovic@jadran-hoteli.example",
  "phone": "+382 69 111 222"
}
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
{
  "message": "Ugovor ne može preći u ACTIVE bez popunjenog default_tip_nastupanja (M3 spec §2.2)",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Ugovor ne može preći u ACTIVE bez popunjenog commission_model (M3 spec §2.2b)",
  "error": "Bad Request",
  "statusCode": 400
}
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

| `allotmentMode` | Obavezno dodatno                                                                               | Nije dozvoljeno / nema smisla        |
| :-------------- | :--------------------------------------------------------------------------------------------- | :----------------------------------- |
| `FIXED`         | `totalCapacity`                                                                                | `ukupnaFiksnaObaveza`                |
| `ON_REQUEST`    | — (nema kapaciteta)                                                                            | `totalCapacity`, `releaseDaysBefore` |
| `CHARTER`       | `totalCapacity`, `ukupnaFiksnaObaveza`, `fixedObligationCurrency`                              | `releaseDaysBefore`                  |
| `FIXED_LEASE`   | `totalCapacity`, `ukupnaFiksnaObaveza`, `fixedObligationCurrency`; opciono `paymentSchedule[]` | `releaseDaysBefore`                  |

**Zahtev (`FIXED`):**

```json
{
  "stayFrom": "2027-06-01",
  "stayTo": "2027-09-30",
  "roomType": "DBL",
  "allotmentMode": "FIXED",
  "totalCapacity": 40,
  "releaseDaysBefore": 14,
  "minStayNights": 3,
  "arrivalWeekdays": [6],
  "departureWeekdays": [6],
  "allowedStayNights": [7, 14]
}
```

**Turnusi (§2.11d, dodato 9.9.2026).** `arrivalWeekdays`/`departureWeekdays` su dani u nedelji (1 = ponedeljak … 7 = nedelja) kada gost sme da se prijavi/odjavi, `allowedStayNights` dozvoljene dužine u noćima. **Prazan niz = bez ograničenja** — i to je jedina vrednost koja ne menja zatečene periode. M3 samo čuva pravilo; boravak koji ga ne poštuje odbija M5 pri sastavljanju ponude, sa razlogom `STAY_PATTERN` i porukom koja kaže **kada se sme doći** („Prijava je moguća samo: subota").

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
{
  "message": "Period se datumski preklapa sa postojećim periodom b20ea288-2bca-4723-8f55-4351ef58f4ef (2026-06-01–2026-09-30) za istu sobu (M3 spec §2.3b)",
  "error": "Bad Request",
  "statusCode": 400
}
```

Susedni periodi (jedan se završava, drugi počinje sutradan) prolaze. Različit `roomType` u istom datumskom opsegu takođe prolazi — to su dva odvojena cenovnika.

`agePolicyOverride[]` je izuzetak od uzrasne politike sobe (iz M2) **samo za ovaj period**. Oblik jednog reda:

```json
{
  "category": "CHILD",
  "ageFrom": 2,
  "ageTo": 11.99,
  "countsTowardCapacity": true,
  "maxCount": 2,
  "requiresCrib": false,
  "cribIncluded": null
}
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
    {
      "ageCategory": "CHILD",
      "occupantIndex": 1,
      "pricingMode": "PERCENTAGE_OF_BASE_PRICE",
      "percentage": 50
    },
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
{
  "ruleType": "EARLY_DEPARTURE",
  "earlyDepartureBasis": "PERCENTAGE_OF_REMAINING_STAY",
  "earlyDeparturePercentage": 100
}
```

ili

```json
{
  "ruleType": "EARLY_DEPARTURE",
  "earlyDepartureBasis": "FLAT_AMOUNT",
  "earlyDepartureFlatAmount": 5000
}
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

### GET /contracting/capacity/grid

Dozvola: `M3/capacity/VIEW`. Mreža kapaciteta po danima (spec §2.8) — ono što crta ekran „Kapaciteti" u panelu (M17 §4b).

**Parametri upita**

| Parametar               | Obavezan | Napomena                                                                                                                      |
| :---------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `from`, `to`            | da       | raspon datuma **boravka**, ISO `yyyy-mm-dd`, uključivo na oba kraja; razlika najviše **92 dana** (jedan kvartal), inače `400` |
| `contractId`            | ne       | UUID jednog ugovora                                                                                                           |
| `supplierId`            | ne       | UUID dobavljača                                                                                                               |
| `roomType`              | ne       | tačan naziv tipa sobe (poređenje je tačno, ne „sadrži")                                                                       |
| `allotmentMode`         | ne       | `FIXED` / `ON_REQUEST` / `CHARTER` / `FIXED_LEASE`                                                                            |
| `destinationCountry`    | ne       | sadrži, bez obzira na velika slova (v1.22)                                                                                    |
| `destinationCity`       | ne       | sadrži, bez obzira na velika slova (v1.22)                                                                                    |
| `productName`           | ne       | naziv objekta iz M2, srpski prevod; sadrži, bez obzira na velika slova (v1.22)                                                |
| `productType`           | ne       | `ProductType`; **sme da se ponovi** za više vrsta odjednom: `?productType=ACCOMMODATION&productType=FLIGHT` (v1.22)           |
| `includeDraftContracts` | ne       | `true` uključuje i ugovore u nacrtu; podrazumevano samo `ACTIVE`                                                              |

Poslednja četiri filtera gađaju vezani `Product` (M2, preko `Product.sourceContractId`). Zato period čiji ugovor **nema** proizvod u M2 ispada iz rezultata čim se bilo koji od njih postavi — o takvom periodu ne znamo ni destinaciju ni naziv, pa ne može da zadovolji uslov. Bez tih filtera ostaje na mreži, sa `productName`/`productType`/destinacijom `null`.

**Odgovor `200`:**

```json
{
  "from": "2027-07-10",
  "to": "2027-07-11",
  "rows": [
    {
      "contractId": "9f1c…",
      "contractPeriodId": "3ab7…",
      "supplierName": "Hotel Splendid d.o.o.",
      "productName": "Hotel Splendid",
      "destinationCountry": "Crna Gora",
      "destinationCity": "Bečići",
      "productType": "ACCOMMODATION",
      "roomType": "DBL",
      "allotmentMode": "FIXED",
      "days": [
        {
          "date": "2027-07-10",
          "capacity": 10,
          "sold": 2,
          "blocked": 0,
          "razlika": 8,
          "zaProdaju": 8,
          "saleStatus": "OPEN",
          "stopReason": null
        },
        {
          "date": "2027-07-11",
          "capacity": 10,
          "sold": 12,
          "blocked": 0,
          "razlika": -2,
          "zaProdaju": 0,
          "saleStatus": "OPEN",
          "stopReason": null
        }
      ]
    }
  ]
}
```

Dva polja koja se lako pomešaju (spec §2.8c): `razlika` je **prikaz** i SME biti negativna (kapacitet smanjen ispod već prodatog), dok je `zaProdaju` **odluka** i nikad nije manja od nule — i jednaka je nuli kad je `saleStatus` `STOP`. `capacity: null` znači da period ne pokriva taj datum, što nije isto što i `0` (popunjeno).

### Radnje nad kapacitetom — obim je skup tipova soba (v1.23)

Sve tri radnje (`POST`/`DELETE /contracting/capacity/stop-sale`, `PUT /contracting/capacity/days`, `POST /contracting/capacity/blocks`) primaju obim na tri načina (spec §2.8a):

| Polje               | Značenje                                                                          |
| :------------------ | :-------------------------------------------------------------------------------- |
| `contractPeriodId`  | jedan tip sobe (stariji put, i dalje radi)                                        |
| `contractPeriodIds` | **izabrani tipovi soba** — niz UUID-ova (v1.23)                                   |
| `contractId`        | ceo objekat; samo kod `stop-sale` — izmena kapaciteta i blokada ga namerno NEMAJU |

Zašto izmena kapaciteta nema „ceo objekat": upisala bi **isti broj** u svaki tip sobe, a 10 dvokrevetnih nije isto što i 10 apartmana. Blokada iz istog razloga traži izričit izbor.

Ako je bilo koji od zadatih `contractPeriodIds` nepoznat, ceo zahtev pada na `404` — nikad se ne izvršava nad manjim skupom nego što je zatraženo.

Kod blokade se `units` **ne deli** među tipovima: `units: 2` nad tri tipa soba pravi tri blokade po 2 jedinice, ne jednu podeljenu.

Jedan poziv ostavlja **jedan** audit zapis, sa `context.contractPeriodIds` i `context.roomTypes` — da bi istorija (ispod) pokazala jedan potez čoveka umesto tri nezavisna.

### GET /contracting/capacity/history

Dozvola: **`M3/capacity/VIEW`** (spec §2.8g). Namerno NE `M1/audit-log/VIEW` — kapacitete menjaju Sales Manager i prodajni agent, koji audit log ne vide.

Ne postoji nova tabela: čitaju se postojeći `AuditLogEntry` zapisi, suženi na sedam akcija nad kapacitetom (`capacity.sale_stopped`, `capacity.sale_reopened`, `capacity.day_override_set`, `capacity_block.created`, `capacity_block.released`, `capacity_block.converted`, `capacity_block.auto_released`).

**Parametri upita**

| Parametar          | Obavezan | Napomena                                                      |
| :----------------- | :------- | :------------------------------------------------------------ |
| `contractId`       | ne       | ceo objekat — obuhvata i periode i blokade tog ugovora        |
| `contractPeriodId` | ne       | jedan tip sobe                                                |
| `from`, `to`       | ne       | ISO `yyyy-mm-dd`; `to` znači **zaključno sa krajem tog dana** |
| `limit`            | ne       | podrazumevano 50, najviše 200                                 |

**Odgovor `200`** (najnovije prvo):

```json
[
  {
    "id": "535bba67-…",
    "timestamp": "2026-09-09T05:48:42.441Z",
    "action": "capacity.day_override_set",
    "actorType": "HUMAN",
    "actorName": "Vlasnik agencije",
    "resourceType": "ContractPeriod",
    "resourceId": "962ec835-…",
    "afterState": { "from": "2026-09-22", "to": "2026-09-22", "capacity": 7, "touched": 2 },
    "context": { "periods": 2, "roomTypes": ["SUP", "PREM"] }
  }
]
```

`actorName` je razrešeno puno ime iz M1; sistemski potezi (istekla blokada) vraćaju `"sistem"`, a nerazrešen identifikator se vraća kakav jeste umesto da se sakrije.

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
{
  "message": "Nema dovoljno preostalog kapaciteta za ovaj period (M3 spec §2.3)",
  "error": "Bad Request",
  "statusCode": 400
}
```

**Konkurentnost:** umanjenje je jedan atomski `UPDATE` sa uslovom, pa dva istovremena poziva za poslednju jedinicu ne mogu oba proći — tačno jedan dobija `201`, drugi `400`. Dokazano testom sa 10 stvarno paralelnih HTTP zahteva. Ne treba vam sopstveno zaključavanje pre poziva.

> **Dve ograde koje se ne vide iz specifikacije:**
>
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

Tačno jedno od `sourceText` i `sourceFileUrl` mora biti popunjeno.

**Nalepljen tekst** (§4.2.6 — najčešći ulaz, sadržaj mejla dobavljača):

```json
{
  "supplierId": "515a72e5-...",
  "sourceFormat": "PASTED_TEXT",
  "sourceText": "CENOVNIK 2027 — Hotel Splendid, Bečići\nPeriod: 01.06.2027 — 30.06.2027\nDBL, BB: 89,50 EUR po sobi/noć"
}
```

Uvoz nastaje u statusu `PROCESSING`. **Ekstrakcija je zaseban poziv** (`POST /pricelist-imports/:id/extract`) — namerno, da neuspeh modela ostavi zapis sa razlogom umesto da uvoz uopšte ne nastane.

### POST /pricelist-imports/upload

Dozvola: `M3/pricelist-import/CREATE`. Sadržaj: `multipart/form-data`, polja `supplierId` i `file`.

§4.2.7 (v1.36, 10.9.2026) — učitavanje fajla. Fajl se snima na **lokalni disk** (`PRICELIST_STORAGE_DIR`, podrazumevano `storage/pricelists/`), a `source_file_url` u odgovoru nosi **putanju relativnu na taj folder**, ne URL.

Podržano: `.pdf` (i skeniran), `.xlsx`, `.docx`, `.html`/`.htm`, `.csv`/`.txt`/`.md`, `.jpg`/`.jpeg`/`.png`/`.webp`. Granica **25 MB**. Neispravan tip ili prevelik fajl se odbija **pri učitavanju**, pre nego što se išta upiše.

```bash
curl -X POST https://api.primer.rs/api/v1/contracting/pricelist-imports/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "supplierId=515a72e5-..." \
  -F "file=@jh-cenovnik-2027.pdf"
```

**Odgovor `201`:**

```json
{
  "id": "9f3c1a20-...",
  "supplierId": "515a72e5-...",
  "sourceFileUrl": "b41f9c02-8e17-4a55-9d3e-1c7a2f0b6e44.pdf",
  "sourceFileName": "jh-cenovnik-2027.pdf",
  "sourceFormat": "PDF",
  "status": "PROCESSING",
  "extractionPath": null
}
```

Posle `POST /pricelist-imports/:id/extract`, polje `extractionPath` kaže **ko je pročitao sadržaj**: `PARSER` (tekst izvučen iz fajla deterministički) ili `MODEL` (skeniran dokument ili slika, koju je model čitao direktno). Objašnjava i cenu poziva i očekivanu pouzdanost redova.

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

### GET /pricelist-imports/:id/razlike

Dozvola: `M3/pricelist-import/VIEW`. §4.2.10 (v1.39) — **zamenjuje potvrdu reda po red.**

Redovi uvoza se grupišu po ugovoru (preko `matched_product_id → Product.source_contract_id`) i porede sa zatečenim cenovnikom. **Ništa se ne upisuje.** Sezona se izvodi iz datuma iz dokumenta: opseg koji se tačno poklapa sa postojećom sezonom koristi njenu oznaku, inače se najavljuje nova.

**Odgovor `200`:**

```json
{
  "importId": "431d3733-...",
  "status": "READY_FOR_REVIEW",
  "ugovori": [
    {
      "contractId": "0605f31b-...",
      "contractNumber": "MOCK-DEST/grcka-002",
      "supplierName": "MOCK-DEST Elliniko Travel DMC",
      "noveSezone": [{ "code": "1", "label": "01.06.2027.–30.06.2027." }],
      "ukupno": 3,
      "razlike": [
        {
          "kljuc": "CENA|DBL standard|1|Nocenje sa dorucom|po sobi|PER_ROOM_PER_NIGHT|svi",
          "vrsta": "NOVA",
          "stavka": "CENA",
          "opis": "DBL standard · sezona 1 · Nocenje sa dorucom · po sobi",
          "staraVrednost": null,
          "novaVrednost": 8950,
          "izmenjenaPolja": []
        }
      ],
      "sviKljucevi": ["CENA|DBL standard|1|Nocenje sa dorucom|po sobi|PER_ROOM_PER_NIGHT|svi"]
    }
  ],
  "nepoklopljeni": [{ "rowId": "2c90583d-...", "hotel": "Hotel Liberty", "matchConfidence": 14 }]
}
```

`nepoklopljeni` su redovi koje AI nije povezao sa proizvodom iz kataloga — ne mogu ući ni u jedan predlog i prikazuju se zasebno da ne nestanu tiho.

### POST /pricelist-imports/:id/ugovori/:contractId/primeni

Dozvola: `M3/pricelist-import/APPROVE_ROW`. Primenjuje **samo potvrđene ključeve**, kroz isti `primeni` put koji koristi i izmena rečima; nastala verzija nosi `source_import_id`.

Namerno **ne prima cene** — predlog se gradi na serveru iz `PricelistImportRow` zapisa. Da klijent šalje i cene, potvrđeno i primenjeno bi mogli da se raziđu (§2.11l, pravilo 3).

```json
{
  "effectiveFrom": "2027-01-01",
  "prihvaceniKljucevi": ["CENA|DBL standard|1|Nocenje sa dorucom|po sobi|PER_ROOM_PER_NIGHT|svi"]
}
```

**Odgovor `201`:**

```json
{
  "id": "83aa608f-...",
  "versionNo": 1,
  "effectiveFrom": "2027-01-01",
  "primenjeno": 3,
  "odbijeno": []
}
```

Nova sezona se pravi **tek ovde**, i samo ona iz koje je bar jedna razlika potvrđena. Redovi koji su učestvovali u primenjenoj razlici dobijaju `review_status = CONFIRMED`; ostali ostaju `PENDING`.

### POST /pricelist-imports/:id/rows/:rowId/reject

Dozvola: `M3/pricelist-import/APPROVE_ROW`. Bez tela zahteva. Odbacuje red bez ikakvog upisa u cenovnik.

> **Nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `matchConfidence`.** Ovo je svesno strože od uobičajene prakse (gde visoka pouzdanost prolazi bez pregleda). Razlog: pogrešna nabavna cena tiho menja maržu na svakoj budućoj rezervaciji iz tog ugovora, i otkriva se tek pri obračunu. Ne očekujte prag iznad kog se odobrenje preskače — neće ga biti.

---

## Cenovnik kao mreža (v1.27, M3 §2.11)

Sezone su **kolone** cenovnika i imaju **više** datumskih opsega. Sve rute traže `M3/contract-period/VIEW` za čitanje i `M3/contract-period/EDIT` za upis — namerno bez nove dozvole: ko sme da menja cene, sme i sezone.

### GET /contracts/:contractId/seasons

```json
[
  {
    "id": "bd2d50be-436a-4f81-a1cc-076e22c7e473",
    "contractId": "3204e3f0-c489-4379-8696-1c00ce8322ff",
    "code": "1",
    "label": "Predsezona",
    "rank": 1,
    "ranges": [
      {
        "id": "1f22740b-…",
        "dateFrom": "2027-04-01T00:00:00.000Z",
        "dateTo": "2027-05-31T00:00:00.000Z"
      },
      {
        "id": "9c31a0e2-…",
        "dateFrom": "2027-10-01T00:00:00.000Z",
        "dateTo": "2027-10-31T00:00:00.000Z"
      }
    ]
  }
]
```

### POST /contracts/:contractId/seasons

```json
{
  "code": "1",
  "label": "Predsezona",
  "ranges": [
    { "dateFrom": "2027-04-01", "dateTo": "2027-05-31" },
    { "dateFrom": "2027-10-01", "dateTo": "2027-10-31" }
  ]
}
```

Odgovara `201` sa sezonom (oblik kao gore). **Preklapanje se odbija sa `400`** — jedan datum sme pripadati samo jednoj koloni:

```json
{
  "statusCode": 400,
  "message": "Opseg 2027-05-15 – 2027-06-30 se preklapa sa sezonom „1\" (2027-04-01 – 2027-05-31). Jedan datum sme pripadati samo jednoj sezoni."
}
```

`PATCH /contracts/:contractId/seasons/:seasonId` prima isto telo i **zamenjuje opsege u celini**.

`DELETE /contracts/:contractId/seasons/:seasonId` vraća `{ "deleted": true, "periodaOstalo": 4 }` — periodi se **ne brišu** sa sezonom (nose kapacitet i prodato), samo ispadaju iz kolone.

### GET /contracts/:contractId/pricelist-grid

```json
{
  "contractId": "3204e3f0-…",
  "contractNumber": "TT-MOCK-CAP-02",
  "currency": "EUR",
  "commissionModel": "NET",
  "commissionPercentage": null,
  "seasons": [
    {
      "id": "bd2d50be-…",
      "code": "1",
      "label": "Predsezona",
      "rank": 1,
      "ranges": [
        { "dateFrom": "2027-04-01", "dateTo": "2027-05-31" },
        { "dateFrom": "2027-10-01", "dateTo": "2027-10-31" }
      ]
    }
  ],
  "roomTypes": [
    {
      "roomType": "Budget double room",
      "rows": [
        {
          "key": "Noćenje sa doručkom|2 odrasle osobe|PER_PERSON_PER_NIGHT",
          "boardType": "Noćenje sa doručkom",
          "occupancy": "2 odrasle osobe",
          "priceBasis": "PER_PERSON_PER_NIGHT",
          "cells": {
            "bd2d50be-…": {
              "price": 3900,
              "rateLineIds": ["…", "…"],
              "periodIds": ["…", "…"],
              "bookingFrom": null,
              "bookingTo": "2026-12-31",
              "neslozno": false
            }
          }
        }
      ],
      "bezSezone": []
    },
    {
      "roomType": "DBL",
      "rows": [],
      "bezSezone": [
        {
          "periodId": "2ee47f2b-…",
          "stayFrom": "2027-06-01",
          "stayTo": "2027-06-30",
          "cenovnihRedova": 1
        }
      ]
    }
  ]
}
```

Dva polja traže objašnjenje:

- **`periodIds` ima više od jednog elementa** kad sezona ima više opsega. Jedna ćelija na ekranu = više `ContractPeriod` zapisa u bazi, po jedan za svaki opseg.
- **`neslozno: true`** znači da opsezi iste sezone **nemaju istu cenu**. Prikazuje se umesto da se tiho uzme prva — razlika je skoro uvek greška u unosu.

`bezSezone` su periodi koji ne pripadaju nijednoj sezoni (tip sobe sa sopstvenim rasporedom datuma, ili zapisi stariji od v1.27). Ne gube se — prikazuju se kao izuzeci.

### PUT /contracts/:contractId/pricelist-grid/cell

Upisuje **jednu ćeliju**: istu cenu u svaki period te sezone i tog tipa sobe.

```json
{
  "seasonId": "bd2d50be-…",
  "roomType": "Budget double room",
  "boardType": "Noćenje sa doručkom",
  "occupancy": "2 odrasle osobe",
  "priceBasis": "PER_PERSON_PER_NIGHT",
  "price": 3900,
  "validWeekdays": [7, 1, 2, 3, 4],
  "bookingTo": "2026-12-31"
}
```

```json
{
  "seasonId": "bd2d50be-…",
  "roomType": "Budget double room",
  "periodIds": ["…", "…"],
  "rateLineIds": ["…", "…"],
  "deactivated": 2,
  "validWeekdays": [7, 1, 2, 3, 4],
  "daniBezCene": [5, 6],
  "upozorenje": "Za petak i subota ova kombinacija nema cenu — ti datumi se neće pojaviti u pretrazi."
}
```

Tri pravila koja ova ruta sprovodi:

1. **Period koji ne postoji se pravi**, sa `allotmentMode = ON_REQUEST` i **bez kapaciteta** — kapacitet ide po sopstvenim datumima, kroz `/capacity/*` (§2.11n).
2. **Ispravka je gašenje pa nova stavka** (§2.4c): `deactivated` kaže koliko je starih cena ugašeno, a nova nosi `replaces_id`. Cena se nikad ne prepisuje.
3. **Nepromenjena vrednost ne piše ništa** — `deactivated: 0` i isti `rateLineIds`, bez lažnog traga u auditu.
4. **Dani u nedelji (§2.11d, dodato 9.9.2026):** `validWeekdays` (1 = ponedeljak … 7 = nedelja) određuje za koje noći cena važi; izostavljeno ili prazno = **svi dani**. Ista kombinacija (pansion × popunjenost) sme da ima više redova sa različitim danima — vikend cena je drugi red, ne nova sezona. **Preklapanje se odbija** sa `400` i porukom koja imenuje dan („Za ovu kombinaciju već postoji cena za petak…"). **Nepokriven dan se ne odbija** nego vraća u `daniBezCene` uz rečenicu u `upozorenje` — cenovnik se unosi red po red, pa bi strogo pravilo onemogućilo unos drugog reda.

`price` je u **najmanjoj jedinici valute** ugovora (3900 = 39,00 EUR). Panel prima „39,00" i pretvara ga — spoljni integrator šalje ceo broj.

`priceBasis` ima četiri vrednosti (v1.27): `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT`, `PER_ROOM_PER_STAY`, `PER_PERSON_PER_STAY`. Osnove sa `_PER_STAY` znače cenu za **ceo boravak** — M5 ih ne množi brojem noćenja.

## Izmena cenovnika rečima (v1.35, M3 §4.8)

Drugi ulaz u **isti** tok: rečenica postaje predlog razlika, isti oblik koji daje uvoz dokumenta (§2.11l). Primena ide postojećim `POST .../pricelist-versions/primeni`, sa `instructionText` u telu — nema drugog puta do upisa.

### POST /contracts/:contractId/pricelist-versions/recima

Dozvola: `M3/contract-period/**VIEW**` — ovaj poziv je predlog, ne izmena. Upis traži `EDIT`, pa ograda iz §4.4 (agent radi pravima korisnika) važi sama od sebe. **Ništa se ne upisuje.**

```json
{
  "instructionText": "cene za sezonu 4 i 5 idu gore 5%, uvode doplatu za parking 5 € po sobi po noći koja se plaća na licu mesta",
  "effectiveFrom": "2027-06-01"
}
```

**Odgovor `201`:**

```json
{
  "contractId": "b2c1…",
  "instructionText": "cene za sezonu 4 i 5 idu gore 5%, uvode doplatu za parking…",
  "pitanja": [],
  "namere": [
    { "vrsta": "CENA_PROCENAT", "obrazlozenje": "cene za sezonu 4 i 5 idu gore 5%" },
    { "vrsta": "DOPLATA_NOVA", "obrazlozenje": "uvode doplatu za parking 5 € po sobi po noći" }
  ],
  "ukupno": 2,
  "razlike": [
    {
      "kljuc": "CENA|STD|4|BB|2ADT|PER_ROOM_PER_NIGHT|svi",
      "vrsta": "IZMENJENA",
      "opis": "STD · sezona 4 · BB · 2ADT",
      "poruka": "STD · sezona 4 · BB · 2ADT: 62,00 → 65,10",
      "staraVrednost": 6200,
      "novaVrednost": 6510
    }
  ],
  "sviKljucevi": ["CENA|STD|4|BB|2ADT|PER_ROOM_PER_NIGHT|svi"],
  "redovi": [ … ],
  "neprimenjeno": [
    {
      "obrazlozenje": "rani buking 2. krug se ukida",
      "razlog": "Akcije se gase na ekranu ponuda perioda."
    }
  ],
  "noveDoplate": [
    {
      "name": "Parking",
      "kind": "SURCHARGE",
      "pricingMode": "FLAT_PER_UNIT",
      "flatAmount": 500,
      "priceBasis": "PER_ROOM_PER_NIGHT",
      "payable": "ON_SITE",
      "isMandatory": false
    }
  ],
  "ugaseneDoplate": []
}
```

| Polje          | Čemu služi                                                                                 |
| :------------- | :----------------------------------------------------------------------------------------- |
| `namere`       | **Šta je model razumeo**, deo po deo rečenice — čovek proverava razumevanje, ne samo ishod |
| `razlike`      | Izmene cena, isti oblik kao kod uvoza dokumenta; svaka se odobrava posebno                 |
| `redovi`       | Predloženi cenovnik — vraća se nepromenjen u `/primeni`                                    |
| `neprimenjeno` | Izmene van cenovnika (rokovi, akcije, kapacitet) sa uputstvom na kom se ekranu rade        |
| `noveDoplate`  | Doplate iz rečenice — **prikazuju se, ne upisuju**; dodaju se na ekranu doplata (§2.11k)   |
| `pitanja`      | Kad rečenica nije jednoznačna. Ako nema nijedne namere, predlog se **ne pravi** (§4.4)     |

**Model ne računa cene.** Šema alata nema polje za izračunatu cenu, pa je model ne može ni poslati; nove iznose računa kod. Namera bez broja (procenat `null`, procenat `0`, decimalan iznos) se odbacuje **posle** modela — ne sme da postane cena nula.

**Greške:** `400` kad je cenovnik prazan (proverava se **pre** modela), kad je rečenica prazna, ili kad AI servis nije podešen na instalaciji — tada poruka upućuje na ručni unos u mreži cena umesto da se tok pretvara da radi.

### Primena

Ide postojećim `POST .../pricelist-versions/primeni`: `redovi` i `effectiveFrom` iz predloga, `prihvaceniKljucevi` samo za ono što je čovek označio, i `instructionText` — koji čini da se potez u auditu vodi kao **AI potez** (`actorType: AI_AGENT`) i čuva se uz nastalu verziju.

## Kalendar cena i raspoloživosti (v1.34, M3 §2.11o)

**Pregled, ne unos.** Spaja dva izvora koja inače stoje na odvojenim ekranima — cenovnik i mrežu kapaciteta — da bi se greška u datumskom opsegu videla kao rupa ili skok u nizu. Ne uvodi nov zapis u bazi.

### GET /contracts/:contractId/pricelist-calendar

Dozvola: `M3/contract-period/VIEW`.

**Parametri upita**

| Parametar      | Obavezan | Napomena                                                                                  |
| :------------- | :------- | :---------------------------------------------------------------------------------------- |
| `roomType`     | da       | tačan naziv tipa sobe                                                                     |
| `from`, `to`   | da       | raspon **boravka**, ISO `yyyy-mm-dd`, uključivo; razlika najviše **92 dana**, inače `400` |
| `adults`       | da       | broj odraslih u sobi, najmanje 1                                                          |
| `childrenAges` | ne       | godine **svakog** deteta pojedinačno, sme da se ponovi: `?childrenAges=8&childrenAges=3`  |

Godine se šalju pojedinačno, a ne kao broj dece, jer se doplata razlikuje po uzrastu (§2.4a) — dete od 3 i dete od 14 godina nisu ista stavka.

**Odgovor `200`:**

```json
{
  "contractId": "b2c1…",
  "contractNumber": "TT-2026-014",
  "supplierName": "Hotel Splendid d.o.o.",
  "currency": "EUR",
  "roomType": "STD",
  "from": "2027-06-10",
  "to": "2027-06-12",
  "sastav": { "adults": 2, "children": 1, "childrenAges": [8] },
  "kombinacije": [
    {
      "kljuc": "BB|2ADT",
      "boardType": "BB",
      "occupancy": "2ADT",
      "priceBasis": "PER_ROOM_PER_NIGHT",
      "dani": [
        {
          "date": "2027-06-10",
          "cena": 10000,
          "osnova": "PER_ROOM_PER_NIGHT",
          "razlog": null,
          "seasonCode": "1",
          "slobodno": 6,
          "saleStatus": "OPEN",
          "stopReason": null,
          "dolazakMoguc": true
        },
        {
          "date": "2027-06-11",
          "cena": 14000,
          "osnova": "PER_ROOM_PER_NIGHT",
          "razlog": null,
          "seasonCode": "1",
          "slobodno": 0,
          "saleStatus": "STOP",
          "stopReason": "Hotel je zatvorio prodaju",
          "dolazakMoguc": true
        }
      ]
    }
  ],
  "upozorenja": []
}
```

Jedan niz **po kombinaciji** (pansion × popunjenost): isti tip sobe u istom mesecu ume da ima više cenovnih kombinacija, a odgovor ne bira jednu umesto čoveka.

`cena` je za **jednu noć koja počinje tog dana** — dan odjave nije noć. Kad je `osnova` `PER_ROOM_PER_STAY`/`PER_PERSON_PER_STAY`, noćna cena ne postoji: iznos je za ceo boravak i dan tada nosi `razlog: "CENA_ZA_BORAVAK"`.

**Vrednosti `razlog` kad cene nema** (`cena: null`):

| Vrednost                  | Značenje                                                                               |
| :------------------------ | :------------------------------------------------------------------------------------- |
| `VAN_PERIODA`             | nijedan ugovorni period tog tipa sobe ne pokriva taj dan                               |
| `NEMA_CENE`               | period postoji, ali za tu kombinaciju nema nijednog cenovnog reda                      |
| `DAN_BEZ_CENE`            | kombinacija ima redove, ali nijedan ne pokriva taj **dan u nedelji** (§2.11d)          |
| `PROZOR_PRODAJE_ZATVOREN` | cena postoji, ali joj je prozor rezervisanja prošao (§2.11e)                           |
| `NEMA_CENE_ZA_UZRAST`     | cenovnik nema `age_pricing` red za dete tog uzrasta (§2.4a) — cena se ne pretpostavlja |

`upozorenja` sabira te dane po kombinaciji („BB · 2ADT: 4 od 6 dana nema cenu za ovaj sastav gostiju.“), da se rupa vidi bez prebrojavanja po ekranu.

`dolazakMoguc: false` znači da cena postoji ali boravak tog dana **ne može da počne** (dani prijave na periodu, §2.11d). Dan sa `saleStatus: "STOP"` takođe zadržava cenu — cena i odluka o prodaji su dve različite stvari (§2.8c). `slobodno: null` znači da period taj dan ne pokriva, što nije isto što i `0` (popunjeno). Više perioda istog tipa sobe na isti dan se **sabira**, a stop-sale u bilo kom od njih pobeđuje otvorenu prodaju u drugom.

## Verzije cenovnika (v1.33, M3 §2.11l)

Nova verzija **ne briše staru**: rezervacije napravljene po staroj ceni moraju i dalje da se objasne. Verzija nosi **snimak celog cenovnika** u trenutku potvrde — bez njega se razlika prema prošloj verziji ne može izračunati kasnije, jer se žive stavke gase i zamenjuju (§2.4c).

Dva ulaza, i razlika je namerna:

- **Ručna izmena** — cene se menjaju kroz `PUT .../pricelist-grid/cell` (primenjuje se odmah), pa se verzija snima: `GET .../razlike` → `POST .../pricelist-versions`.
- **Predlog spolja** (uvoz dokumenta §4.2, izmena rečima §4.8) — predlagač je mašina, pa se **ništa ne upisuje pre potvrde**: `POST .../predlog` → `POST .../primeni` sa spiskom potvrđenih ključeva.

### GET /contracts/:contractId/pricelist-versions

```json
{
  "contractId": "b2c1…",
  "versions": [
    {
      "id": "9f3a…",
      "versionNo": 2,
      "effectiveFrom": "2027-03-01",
      "changeCount": 1,
      "stavki": 12,
      "note": null,
      "instructionText": null,
      "sourceImportId": null,
      "createdBy": "u-14…",
      "createdAt": "2026-09-09T20:41:02.113Z"
    },
    {
      "id": "5c11…",
      "versionNo": 1,
      "effectiveFrom": "2027-01-01",
      "changeCount": 12,
      "stavki": 12,
      "note": "Prvi cenovnik dobavljača",
      "instructionText": null,
      "sourceImportId": null,
      "createdBy": "u-14…",
      "createdAt": "2026-09-09T20:39:55.004Z"
    }
  ]
}
```

### GET /contracts/:contractId/pricelist-versions/razlike

Razlike **živog** cenovnika prema poslednjoj potvrđenoj verziji — ono što čovek potvrđuje.

```json
{
  "contractId": "b2c1…",
  "poslednjaVerzija": 1,
  "sledecaVerzija": 2,
  "ukupno": 1,
  "stavkiUCenovniku": 12,
  "razlike": [
    {
      "kljuc": "CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi",
      "vrsta": "IZMENJENA",
      "stavka": "CENA",
      "opis": "STD · sezona 1 · BB · 2ADT",
      "poruka": "STD · sezona 1 · BB · 2ADT: 100,00 → 110,00",
      "staraVrednost": 10000,
      "novaVrednost": 11000,
      "izmenjenaPolja": []
    }
  ]
}
```

`vrsta` je `IZMENJENA`, `NOVA` ili `UGASENA`. `kljuc` je tip sobe + sezona + pansion + popunjenost + osnova cene + dani u nedelji — **bez cene**, da promena cene izlazi kao jedan red, a ne kao „jedna nestala + jedna nova". `izmenjenaPolja` nosi promene van cene (npr. `prodaja do`).

### POST /contracts/:contractId/pricelist-versions

Snima trenutno stanje kao novu verziju. Ne menja nijednu cenu.

```json
{ "effectiveFrom": "2027-03-01", "note": "Korekcija dobavljača od 5.6." }
```

Odgovor `201` nosi `versionNo`, `changeCount` i spisak `razlike`. **`400`** kad cenovnik nema nijednu razliku u odnosu na poslednju verziju — istorija ne sme biti spisak istovetnih snimaka.

### POST /contracts/:contractId/pricelist-versions/predlog

**Ništa ne upisuje.** Vraća razlike između živog cenovnika i predloženog.

```json
{
  "effectiveFrom": "2027-04-01",
  "redovi": [
    {
      "roomType": "STD",
      "seasonCode": "1",
      "boardType": "BB",
      "occupancy": "2ADT",
      "priceBasis": "PER_ROOM_PER_NIGHT",
      "price": 12000,
      "validWeekdays": [],
      "bookingTo": "2026-12-31"
    }
  ],
  "instructionText": "Podigni cenu studija u predsezoni na 120 evra"
}
```

Sezona se navodi **oznakom** (`seasonCode`), ne `id`-em — predlog dolazi iz pročitanog dokumenta, gde piše „sezona 1". Stavka koje u `redovi` nema prijavljuje se kao `UGASENA`. Doplate se ovim putem ne menjaju, pa se **ne** prijavljuju kao ugašene.

Odgovor nosi `razlike` i `sviKljucevi` — panel vraća taj spisak umanjen za razlike koje je čovek odbio.

### POST /contracts/:contractId/pricelist-versions/primeni

Isto telo kao `predlog`, uz obavezno `prihvaceniKljucevi`.

```json
{
  "effectiveFrom": "2027-04-01",
  "redovi": [ … ],
  "prihvaceniKljucevi": ["CENA|STD|1|BB|2ADT|PER_ROOM_PER_NIGHT|svi"],
  "instructionText": "Podigni cenu studija u predsezoni na 120 evra"
}
```

```json
{
  "id": "9f3a…",
  "versionNo": 3,
  "effectiveFrom": "2027-04-01",
  "primenjeno": 1,
  "odbijeno": ["APP · sezona 1 · BB · 4ADT: 200,00 → 250,00"]
}
```

Pravila:

1. **Prazno `prihvaceniKljucevi` → `400`.** „Primeni sve" nikad nije podrazumevano.
2. **Ključ kog više nema među razlikama → `400`** — cenovnik se u međuvremenu promenio, razlike treba otvoriti ponovo.
3. **Potvrđena doplata → `400`** — doplate i popusti se menjaju na svom ekranu (§2.11k); predlog nosi samo cene.
4. Izmena se upisuje kroz isti put kao ručna (§2.4c: gašenje stare stavke, upis nove). Potvrđeno **gašenje** postavlja `status = INACTIVE`, ne briše.
5. `instructionText` u telu čini da se potez u auditu vodi kao **AI potez** (`actorType: AI_AGENT`), a rečenica se čuva uz nastalu verziju (§4.8).

### GET /contracts/:contractId/pricelist-versions/:versionNo · …/diff

`:versionNo` vraća verziju sa celim `snapshot`-om; `/diff` vraća razlike te verzije prema onoj pre nje (`uporedjenoSa: null` za prvu).

Dozvole: `M3/contract-period/VIEW` za čitanje i predlog, `M3/contract-period/EDIT` za potvrdu i primenu.

## Greške — zajednički oblik

Sve greške imaju isti oblik (NestJS standard):

```json
{ "message": "opis greške", "error": "Bad Request", "statusCode": 400 }
```

Kod greške validacije `message` je **niz** poruka, po jedna za svako polje:

```json
{
  "message": ["price must be an integer number", "boardType must be a string"],
  "error": "Bad Request",
  "statusCode": 400
}
```

| Kod   | Kada                                                                                                                                                                |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400` | validacija tela zahteva, preklapanje perioda, nedovoljan kapacitet, prelazak u `ACTIVE` bez obaveznih polja                                                         |
| `401` | `{"message":"Nedostaje Bearer token",...}` ili `{"message":"Nevažeći ili istekao token",...}`                                                                       |
| `403` | token je ispravan, ali uloga nema traženu dozvolu — poruka imenuje tačno koju: `{"message":"Nema dozvolu M3/contract/CREATE","error":"Forbidden","statusCode":403}` |
| `404` | `{"message":"Zapis nije pronađen",...}` — nepostojeći `id`; za period `{"message":"Period nije pronađen",...}`                                                      |

Nepoznato polje u telu zahteva se **ne ignoriše** — vraća `400`. Ovo je namerno: tiho preskočeno polje znači da integrator misli da je nešto poslao, a nije.
