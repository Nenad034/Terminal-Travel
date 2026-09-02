# API dokumentacija — M5 (Rezervacije i tok prodaje)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — B2B subagenti (M7), spoljni AI agenti (M16), budući korporativni klijenti — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/sales`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).
**Novčani iznosi:** uvek `integer` u najmanjoj jedinici valute (npr. `12000` = 120.00 EUR), nikad decimal.

---

## GET /search

Objedinjena pretraga (M2 katalog + M3 ugovorena dostupnost + M4 uživo), sa već primenjenom maržom.

**`channel` i autentikacija (dopuna, avgust 2026):** za `B2C_SITE`/`B2B_PORTAL`/`MOBILE` endpoint ostaje potpuno javan, bez tokena. Za `channel=INTERNAL_PANEL` (interni tim, koristi ga M17) obavezan je `Authorization: Bearer <JWT>` sa dozvolom `M5/booking/VIEW` — bez toga `401`/`403`. Ova vrednost preskače `Product.visible_channels` filter (tim vidi svaki `ACTIVE` proizvod, ne samo javno objavljene).

**Zahtev:**
```
GET /api/v1/sales/search?type=ACCOMMODATION&destinationCountry=Grčka&stayFrom=2027-06-10&stayTo=2027-06-17&occupancy={"adults":2,"children":1,"roomConfig":[{"adults":2,"children":1,"childrenAges":[6]}]}&channel=INTERNAL_PANEL
```

**Odgovor `200`:**
```json
[
  {
    "productId": "b7e2f1a0-...",
    "type": "ACCOMMODATION",
    "sourceType": "CONTRACTED",
    "name": "Hotel Aegean Blue",
    "destinationCountry": "Grčka",
    "destinationCity": "Halkidiki",
    "thumbnail": { "url": "https://cdn.../exterior1.jpg", "category": "EXTERIOR" },
    "shortDescription": "Hotel na prvoj liniji, 200m od plaže...",
    "offers": [
      {
        "roomTypeCode": "STD",
        "roomTypeName": "Standard soba",
        "boardType": "HALF_BOARD",
        "priceBasis": "PER_ROOM_PER_NIGHT",
        "finalPrice": 84000,
        "finalPriceCurrency": "EUR",
        "availabilityStatus": "AVAILABLE",
        "rateLineId": "c1a9...",
        "providerQuoteReference": null,
        "quoteExpiresAt": null,
        "cancellationPolicySummary": "30 dana: 100%, 15 dana: 50%, 0 dana: 0%"
      }
    ]
  }
]
```
`SOLD_OUT` ponude se ne vraćaju uopšte (filtrirane pre odgovora). `type` je niz — više vrednosti vraća uniju rezultata.

---

## Itineraries (sastavljanje putovanja pre Ponude)

### POST /itineraries
**Zahtev:**
```json
{ "channel": "INTERNAL_PANEL", "title": "Italija + Grčka, 14 dana", "clientAccountId": "acc-123" }
```
**Odgovor `201`:**
```json
{ "id": "itin-1", "status": "DRAFT", "channel": "INTERNAL_PANEL", "title": "Italija + Grčka, 14 dana", "createdBy": "user-9", "createdAt": "2027-01-05T10:00:00.000Z" }
```

### GET /itineraries/:id
**Odgovor `200`:**
```json
{
  "id": "itin-1",
  "status": "DRAFT",
  "channel": "INTERNAL_PANEL",
  "segments": [
    { "id": "seg-1", "sequenceOrder": 1, "productId": "prod-hotel-1", "stayFrom": "2027-06-10", "stayTo": "2027-06-14", "notes": null },
    { "id": "seg-2", "sequenceOrder": 2, "productId": null, "destinationCountry": "Grčka", "destinationCity": "Santorini", "stayFrom": "2027-06-14", "stayTo": "2027-06-17", "notes": "Destinacija okvirno izabrana, hotel još nije potvrđen" }
  ]
}
```

### PATCH /itineraries/:id
Kad je `segments` poslato, ZAMENJUJE ceo postojeći skup (dodavanje/brisanje/preslagivanje u jednom pozivu).
**Zahtev:**
```json
{ "segments": [ { "sequenceOrder": 1, "productId": "prod-hotel-1", "stayFrom": "2027-06-10", "stayTo": "2027-06-14" } ] }
```

### POST /itineraries/:id/to-quote
**Odgovor `201`** (segment bez `product_id` je preskočen, uz eksplicitno upozorenje):
```json
{
  "quote": { "id": "quote-1", "status": "DRAFT", "itineraryId": "itin-1", "expiresAt": "2027-01-05T10:30:00.000Z", "items": [ { "id": "qi-1", "productId": "prod-hotel-1", "finalPrice": 84000 } ] },
  "skippedSegmentIds": ["seg-2"],
  "warning": "1 segment(a) preskočeno jer nema popunjen product_id (M5 spec §3.0.3)."
}
```

---

## Quotes

### POST /quotes
Polja stavke se prepisuju iz izabranog `SearchResultOffer` (poglavlje 3.0b.3) — korisnik ih ne unosi ručno.

**Zahtev:**
```json
{
  "channel": "INTERNAL_PANEL",
  "clientAccountId": "acc-123",
  "items": [
    {
      "productId": "prod-hotel-1",
      "rateLineId": "c1a9-...",
      "stayFrom": "2027-06-10",
      "stayTo": "2027-06-14",
      "occupancy": { "adults": 2, "children": 1, "roomConfig": [ { "roomTypeCode": "STD", "adults": 2, "children": 1, "childrenAges": [6] } ] }
    }
  ],
  "contractTermsAccepted": true
}
```

**Odgovor `201`:**
```json
{
  "id": "quote-2",
  "status": "DRAFT",
  "expiresAt": "2027-01-05T10:30:00.000Z",
  "items": [
    {
      "id": "qi-5",
      "productId": "prod-hotel-1",
      "sourceType": "CONTRACTED",
      "baseCost": 70000,
      "baseCostCurrency": "EUR",
      "rateLineId": "c1a9-...",
      "markupRuleId": "mr-1",
      "finalPrice": 84000,
      "finalPriceCurrency": "EUR"
    }
  ]
}
```

**Greška — API cena istekla (`400`):**
```json
{ "statusCode": 400, "message": "Cena izabrane ponude je istekla (quote_expires_at) — ponovite pretragu (M5 spec §3.0b.3)." }
```

### GET /quotes/:id
**Odgovor `200`:**
```json
{ "id": "quote-2", "status": "DRAFT", "expiresAt": "2027-01-05T10:30:00.000Z", "isExpired": false, "items": [ "..." ] }
```

### POST /quotes/:id/confirm
Pokreće tok Ponuda → Rezervacija (poglavlje 4). Sve-ili-ništa — ako bilo koja stavka padne, sve već rezervisane stavke iz istog pokušaja se odmah oslobađaju.

**Zahtev:**
```json
{ "guests": [ { "itemIndex": 0, "firstName": "Petar", "lastName": "Petrović" } ] }
```
(`tipNastupanja` je opcion ručni izbor, koristi se samo za `INTERNAL_PANEL`/`PHONE` — za samouslužne kanale se uvek automatski izvodi, poglavlje 4.0a.)

**Odgovor `201`:**
```json
{
  "id": "booking-1",
  "bookingNumber": "TT-2027-000482",
  "status": "CONFIRMED",
  "paymentStatus": "UNPAID",
  "tipNastupanja": "POSREDNIK",
  "totalPrice": 84000,
  "currency": "EUR",
  "items": [ { "id": "bi-1", "productId": "prod-hotel-1", "supplierReference": "period-88", "itemStatus": "CONFIRMED", "finalPrice": 84000 } ]
}
```

**Greška — stavke se ne slažu oko `tip_nastupanja` na samouslužnom kanalu (`400`):**
```json
{ "statusCode": 400, "message": "Stavke ponude nose različit/nedefinisan tip_nastupanja — samouslužni kanal ne može sam da potvrdi rezervaciju (M5 spec §4.0a)." }
```

---

## Bookings

### GET /bookings?status=CONFIRMED&channel=INTERNAL_PANEL&clientAccountId=acc-123
**Odgovor `200`:** niz `Booking` objekata (isti oblik kao pojedinačan `GET /bookings/:id`).

### GET /bookings/:id
Poziv iz internog panela (M17) vraća pun sadržaj, uključujući `supplier_reference`. Isti poziv iz B2C/B2B/gost konteksta (M8/M9/M7) NIKAD ne sadrži `supplierReference`, `rateLineId`, `markupRuleId`, `baseCost` (poglavlje 6.2).

Dopuna 1.9.2026 (M5 spec §4.5): po stavci se sada vraćaju i `product` (naziv **već razrešen po jeziku**, M2 §2.2 fallback sr→en, pa pozivalac ne mora zvati M2), `guests` (imena putnika sa te stavke) i `unitCount`. Sva tri su prisutna i u maskiranom B2C/B2B prikazu — §6.2 štiti identitet dobavljača i nabavnu cenu, ne naziv proizvoda koji gost ionako ima na vaučeru.

**Odgovor `200` (INTERNAL_PANEL):**
```json
{
  "id": "booking-1",
  "bookingNumber": "TT-2027-000482",
  "status": "CONFIRMED",
  "paymentStatus": "UNPAID",
  "voucherUrl": null,
  "items": [
    {
      "id": "bi-1",
      "productId": "prod-hotel-1",
      "product": { "id": "prod-hotel-1", "type": "ACCOMMODATION", "name": "Hotel Slovenska Plaža", "destinationCity": "Budva", "destinationCountry": "ME" },
      "stayFrom": "2027-06-10T00:00:00.000Z",
      "stayTo": "2027-06-17T00:00:00.000Z",
      "unitCount": 2,
      "guests": [
        { "id": "big-1", "guestFirstName": "Marko", "guestLastName": "Marković", "guestProfileId": "gp-1" },
        { "id": "big-2", "guestFirstName": "Ana", "guestLastName": "Anić", "guestProfileId": null }
      ],
      "supplierReference": "period-88",
      "baseCost": 70000,
      "rateLineId": "c1a9-...",
      "finalPrice": 84000,
      "itemStatus": "CONFIRMED"
    }
  ]
}
```

**Odgovor `200` (B2C/B2B/gost — maskirano, §6.2):** ista stavka bez `supplierReference`/`baseCost`/`rateLineId`/`markupRuleId`; `product`, `guests`, `stayFrom`/`stayTo`, `unitCount`, `finalPrice`, `itemStatus` ostaju.

### POST /bookings/:id/modify
Tretira se interno kao otkazivanje pogođene stavke + nova stavka po novom zahtevu, prikazano kao jedna radnja. `productId` (dopuna 2.9.2026) je opciono — izostavljeno zadržava postojeću uslugu, popunjeno je menja (mora biti isti `ProductType` kao stavka koja se menja, inače `400`).
**Zahtev:**
```json
{ "bookingItemId": "bi-1", "stayFrom": "2027-06-12", "stayTo": "2027-06-16", "occupancy": { "adults": 2, "children": 0 } }
```
**Zahtev — izmena usluge (isti tip proizvoda):**
```json
{ "bookingItemId": "bi-1", "productId": "prod-drugi-hotel", "stayFrom": "2027-06-12", "stayTo": "2027-06-16", "occupancy": { "adults": 2, "children": 0 } }
```
**Odgovor `200`:** ažuriran `Booking`, status `MODIFIED`, sa novom aktivnom stavkom i starom u statusu `CANCELLED`.
**Odgovor `400` (nova usluga je drugog tipa proizvoda):**
```json
{ "message": "Nova usluga mora biti istog tipa kao postojeća stavka (ACCOMMODATION) — izmena tipa proizvoda nije \"izmena usluge\" (M5 spec §6), pravi se nova rezervacija.", "statusCode": 400 }
```

### POST /bookings/:id/modify/preview
Dopuna 2.9.2026 (kartica Aranžman — "provera cene" pre potvrde). Isti ulaz kao `POST /bookings/:id/modify` (uklj. opcioni `productId`), ista dozvola (`M5/booking/MODIFY`) — ali NIŠTA ne rezerviše niti upisuje, samo računa novu cenu za prikaz.
**Zahtev:** isti oblik kao `/modify`.
**Odgovor `200`:**
```json
{ "currentPrice": 84000, "currentCurrency": "EUR", "newPrice": 91200, "newCurrency": "EUR", "priceDifference": 7200 }
```

### POST /bookings/:id/cancel
**Zahtev:**
```json
{ "itemIds": ["bi-1"] }
```
**Odgovor `200` — upozorenje o mogućem duplikatu (storno NIJE izvršen, poglavlje 6.4):**
```json
{
  "duplicateWarning": true,
  "bookingItemId": "bi-1",
  "conflictItemId": "bi-77",
  "conflictBookingNumber": "TT-2027-000410",
  "conflictPaymentStatus": "PAID",
  "message": "Moguć duplikat rezervacije (M5 spec §6.4) — ponovite poziv sa confirm_duplicate_override: true da nastavite."
}
```
**Ponovljen poziv sa override — otkazivanje se izvršava:**
```json
{ "itemIds": ["bi-1"], "confirmDuplicateOverride": true }
```
**Odgovor `200`:** ažuriran `Booking` (status `CANCELLED` ako su sve stavke otkazane, inače `MODIFIED`). Svaka otkazana stavka dobija `cancellationRefundPercentage` — za CONTRACTED iz M3 `CancellationRule`, za API deterministički iz `cancellationPolicySnapshot` (poglavlje 3.2/4.2 spec dokumenta, dopuna v1.14) — i oslobađa se tačan broj rezervisanih jedinica (`unitCount`) nazad u M3, ne uvek jedna.

### PATCH /bookings/:id/payment-status
**Zahtev:**
```json
{ "paymentStatus": "PAID" }
```
**Odgovor `200`:** ažuriran `Booking` — ako prelazak u `PAID` ispunjava uslove iz poglavlja 6, `voucherUrl` je automatski popunjen u istom odgovoru.

### POST /bookings/:id/voucher/override
Zahteva `M5/voucher/OVERRIDE_ISSUE` (isključivo Vlasnik/Direktor).
**Zahtev:**
```json
{ "reason": "Stalni B2B partner, uplata stiže po fakturi za 15 dana — odobrio Vlasnik telefonom." }
```
**Odgovor `200`:**
```json
{ "id": "booking-1", "voucherUrl": "https://vouchers.internal.terminal-travel/booking-1.pdf", "voucherOverrideApprovedBy": "user-1", "voucherOverrideReason": "...", "voucherOverrideAt": "2027-01-06T09:00:00.000Z" }
```

### GET /bookings/:id/notes
Interne beleške uz rezervaciju (M5 spec §4.6, dopuna 1.9.2026). Zahteva `M5/booking/VIEW` — beleška se vidi sa rezervacijom, nema zasebne VIEW dozvole. Najnovija prva.
**Odgovor `200`:**
```json
[
  { "id": "note-2", "bookingId": "booking-1", "body": "Gosti preuzeti na aerodromu u 23:40.", "createdBy": "vodic-1", "origin": "FIELD_REP", "createdAt": "2027-01-07T11:22:00.000Z" },
  { "id": "note-1", "bookingId": "booking-1", "body": "Gost traži sobu na višem spratu.", "createdBy": "user-1", "origin": "OFFICE", "createdAt": "2027-01-06T09:15:00.000Z" }
]
```

### POST /bookings/:id/notes
Zahteva `M5/booking-note/CREATE` (nikad AI nalog — M5 spec §4.6). `createdBy` se uvek uzima iz tokena; ako se pošalje u telu, zahtev se odbija sa `400` (`forbidNonWhitelisted`). `origin` se takođe **ne prima iz tela** — izvodi se iz uloge autora (`VODIC` → `FIELD_REP`, inače `OFFICE`), M5 spec §4.6.
**Zahtev:**
```json
{ "body": "Gost traži sobu na višem spratu." }
```
**Odgovor `201`:**
```json
{ "id": "note-1", "bookingId": "booking-1", "body": "Gost traži sobu na višem spratu.", "createdBy": "user-1", "createdAt": "2027-01-06T09:15:00.000Z" }
```
Prazna beleška ili duža od 4000 znakova vraća `400`.

### DELETE /bookings/:id/notes/:noteId
Zahteva `M5/booking-note/DELETE`. Autor sme sopstvenu belešku, Vlasnik/Direktor bilo koju (inače `403`). Beleška koja pripada drugoj rezervaciji vraća `404`, i kad `noteId` postoji. Sadržaj se stvarno briše; u M1 audit logu ostaje samo trag da je beleška postojala (`resource_type = BookingNote`), bez teksta.
**Odgovor `200`:**
```json
{ "deleted": true }
```

### GET /bookings/calendar-summary?from=2027-06-01&to=2027-06-30
Isti v1 filter-skup kao `GET /bookings` (status/paymentStatus/tipNastupanja/buyerName/bookingNumber/currency/createdFrom/createdTo/productType/productId/destinationCity/destinationCountry/hasTravelGuarantee), BEZ datumskih opsega — `from`/`to` već zadaju taj opseg (M5 spec §7.4, dopuna 27.8.2026).
**Odgovor `200`:**
```json
[
  { "date": "2027-06-10", "arrivalsCount": 3, "departuresCount": 0, "stayoversCount": 0, "singleDayCount": 1 },
  { "date": "2027-06-14", "arrivalsCount": 1, "departuresCount": 3, "stayoversCount": 0, "singleDayCount": 0 }
]
```

### GET /bookings/calendar/2027-06-10
Isti filter-skup kao iznad. Odgovor prošireno (dopuna 27.8.2026, M17 "sumarni izveštaj u desnom panelu") sa `bookingStatus`/`paymentStatus`/`productType`/`destinationCity`/`destinationCountry`/`unitCount`/`finalPrice`/`finalPriceCurrency` po stavci — panel ovo agregira klijentski (broj rezervacija, po statusu, po destinaciji, ukupno osoba/soba, upozorenja).
**Odgovor `200`:**
```json
{
  "ARRIVAL": [
    {
      "bookingItemId": "bi-1", "bookingId": "booking-1", "bookingNumber": "TT-2027-000482", "productId": "prod-hotel-1",
      "status": "CONFIRMED", "guests": ["Petar Petrović"],
      "bookingStatus": "CONFIRMED", "paymentStatus": "UNPAID", "productType": "ACCOMMODATION",
      "destinationCity": "Budva", "destinationCountry": "Crna Gora", "unitCount": 1,
      "finalPrice": 45000, "finalPriceCurrency": "EUR"
    }
  ],
  "DEPARTURE": [],
  "STAYOVER": [],
  "SINGLE_DAY": []
}
```

---

## Markup rules

### GET /markup-rules?scopeType=M3_SUPPLIER&scopeId=sup-1
### POST /markup-rules
**Zahtev:**
```json
{ "scopeType": "M3_SUPPLIER", "scopeId": "sup-1", "percentage": 15, "fixedAmount": 500, "fixedAmountCurrency": "EUR" }
```
**Odgovor `201`:** kreiran `MarkupRule`.

### PATCH /markup-rules/:id
**Zahtev:** `{ "percentage": 18 }`

---

## Supplier manifests (poglavlje 8 — operativne liste ka dobavljaču)

### POST /supplier-manifests
**Zahtev:**
```json
{ "supplierId": "sup-1", "periodFrom": "2027-06-10", "periodTo": "2027-06-17", "language": "EN" }
```
**Odgovor `201`:**
```json
{ "id": "manifest-1", "status": "DRAFT", "referenceCode": "TT-000423", "supplierTypeSnapshot": "HOTEL", "language": "EN", "items": [ { "bookingItemId": "bi-1" } ] }
```
Cena se nikad ne uključuje u ovaj payload (poglavlje 8.3, ograda).

### POST /supplier-manifests/:id/send
Zahteva `M5/supplier-manifest/SEND`. **Odgovor `200`:**
```json
{ "id": "manifest-1", "status": "SENT", "sentAt": "2027-06-01T08:00:00.000Z", "sentBy": "user-4", "sentToEmail": "reservations@hotel-aegean.gr" }
```

### POST /supplier-manifests/:id/confirm-supplier
Ručni unos potvrde dobavljača — popunjava `supplierConfirmedAt`/`By` na svim stavkama te liste.

### POST /bookings/:id/prepare-supplier-manifests
Dopuna v1.15 — ad-hoc priprema DRAFT liste(a) za JEDNU rezervaciju odmah, bez čekanja na periodični posao (§8.4). Ako rezervacija sadrži `CONTRACTED`/`CONFIRMED` stavke od više različitih dobavljača, kreira se po jedan DRAFT nacrt za svakog — operater ne mora ručno da pogodi koji su dobavljači uključeni.
**Zahtev:**
```json
{ "language": "SR" }
```
**Odgovor `201` — niz kreiranih nacrta (jedan po dobavljaču):**
```json
[
  { "id": "manifest-1", "supplierId": "sup-hotel-1", "status": "DRAFT", "referenceCode": "TT-000501", "items": [ { "bookingItemId": "bi-1" } ] },
  { "id": "manifest-2", "supplierId": "sup-transfer-1", "status": "DRAFT", "referenceCode": "TT-000502", "items": [ { "bookingItemId": "bi-2" } ] }
]
```
Slanje ostaje nepromenjeno — ručni klik po listi preko `POST /supplier-manifests/:id/send`.

### POST /supplier-manifests/prepare-batch
Dopuna v1.16 — isto kao gore, ali obim je više rezervacija odjednom. `bookingIds` je isključivi ručni izbor (ignoriše ostale filtere kad je prisutan); u suprotnom mora biti prisutan bar jedan od `createdFrom`/`createdTo`, `stayFrom`/`stayTo`, `arrivalFrom`/`arrivalTo`, `departureFrom`/`departureTo`, `bookingStatus` — poziv bez `bookingIds` i bez ijednog filtera vraća `400`. Više filtera prosleđenih istovremeno se kombinuju logičkim I.

**Zahtev (checkbox izbor):**
```json
{ "bookingIds": ["booking-1", "booking-2", "booking-3"] }
```
**Zahtev (opseg datuma kreiranja rezervacije):**
```json
{ "createdFrom": "2027-06-01", "createdTo": "2027-06-07", "language": "SR" }
```
**Zahtev (opseg BORAVKA — preklapanje, isti obrazac kao periodično agregiranje):**
```json
{ "stayFrom": "2027-08-01", "stayTo": "2027-08-31" }
```
**Zahtev (dolasci u opsegu, kombinovano sa statusom rezervacije):**
```json
{ "arrivalFrom": "2027-08-10", "arrivalTo": "2027-08-17", "bookingStatus": ["CONFIRMED"] }
```
**Zahtev (odlasci u opsegu):**
```json
{ "departureFrom": "2027-08-10", "departureTo": "2027-08-17" }
```
**Odgovor `201`:** isti oblik kao `POST /bookings/:id/prepare-supplier-manifests` — niz DRAFT nacrta, po jedan za svakog dobavljača uključenog u obuhvaćene rezervacije.

---

## Supplier announcement rules

### POST /supplier-announcement-rules
**Zahtev:**
```json
{ "supplierId": null, "triggerCondition": "DAYS_BEFORE_STAY", "daysBeforeStay": 7 }
```
`supplierId: null` = podrazumevano pravilo za dobavljače bez sopstvenog. Zahteva `M5/supplier-announcement-rule/EDIT` (Vlasnik/Direktor).

---

## Greške — zajednički oblik

Sve greške vraćaju standardan NestJS oblik:
```json
{ "statusCode": 400, "message": "Opis greške na srpskom, sa referencom na poglavlje specifikacije.", "error": "Bad Request" }
```
`403` kad korisnik nema traženu dozvolu (`M5/<resurs>/<akcija>`, poglavlje 10); `404` kad resurs ne postoji.
