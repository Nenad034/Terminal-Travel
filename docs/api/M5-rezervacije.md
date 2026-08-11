# API dokumentacija — M5 (Rezervacije i tok prodaje)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — B2B subagenti (M7), spoljni AI agenti (M16), budući korporativni klijenti — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/sales`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).
**Novčani iznosi:** uvek `integer` u najmanjoj jedinici valute (npr. `12000` = 120.00 EUR), nikad decimal.

---

## GET /search

Objedinjena pretraga (M2 katalog + M3 ugovorena dostupnost + M4 uživo), sa već primenjenom maržom.

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

**Odgovor `200` (INTERNAL_PANEL):**
```json
{
  "id": "booking-1",
  "bookingNumber": "TT-2027-000482",
  "status": "CONFIRMED",
  "paymentStatus": "UNPAID",
  "voucherUrl": null,
  "items": [
    { "id": "bi-1", "productId": "prod-hotel-1", "supplierReference": "period-88", "baseCost": 70000, "rateLineId": "c1a9-...", "finalPrice": 84000, "itemStatus": "CONFIRMED" }
  ]
}
```

### POST /bookings/:id/modify
Tretira se interno kao otkazivanje pogođene stavke + nova stavka po novom zahtevu, prikazano kao jedna radnja.
**Zahtev:**
```json
{ "bookingItemId": "bi-1", "stayFrom": "2027-06-12", "stayTo": "2027-06-16", "occupancy": { "adults": 2, "children": 0 } }
```
**Odgovor `200`:** ažuriran `Booking`, status `MODIFIED`, sa novom aktivnom stavkom i starom u statusu `CANCELLED`.

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
**Odgovor `200`:** ažuriran `Booking` (status `CANCELLED` ako su sve stavke otkazane, inače `MODIFIED`).

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

### GET /bookings/calendar-summary?from=2027-06-01&to=2027-06-30
**Odgovor `200`:**
```json
[
  { "date": "2027-06-10", "arrivalsCount": 3, "departuresCount": 0, "stayoversCount": 0, "singleDayCount": 1 },
  { "date": "2027-06-14", "arrivalsCount": 1, "departuresCount": 3, "stayoversCount": 0, "singleDayCount": 0 }
]
```

### GET /bookings/calendar/2027-06-10
**Odgovor `200`:**
```json
{
  "ARRIVAL": [ { "bookingItemId": "bi-1", "bookingId": "booking-1", "bookingNumber": "TT-2027-000482", "productId": "prod-hotel-1", "status": "CONFIRMED", "guests": ["Petar Petrović"] } ],
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
