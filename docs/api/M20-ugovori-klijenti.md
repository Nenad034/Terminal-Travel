# API dokumentacija — M20 (Ugovori sa klijentima)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela, budući integratori — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/client-contracts`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Napomena:** ugovor se generiše i revidira automatski (M5 `booking.confirmed`/`booking.modified` — poglavlje 3.1/3.4), nema `POST` endpoint za ručno kreiranje.

---

## GET /client-contracts

Lista, filtrirano po `bookingId` i/ili `status`.

**Zahtev:**
```
GET /api/v1/client-contracts?bookingId=booking-9
```
**Odgovor `200`:**
```json
[
  {
    "id": "cc-1",
    "bookingId": "booking-9",
    "contractType": "ORGANIZOVANO_PUTOVANJE",
    "status": "GENERATED",
    "documentUrl": "mock://client-contracts/ORGANIZOVANO_PUTOVANJE-....pdf",
    "generatedAt": "2027-06-01T10:00:00.000Z",
    "acceptedAt": null,
    "acceptedMethod": null,
    "voidedBy": null,
    "supersedesContractId": null,
    "createdAt": "2027-06-01T10:00:00.000Z"
  }
]
```
Dozvola: `M20/client-contract/VIEW`.

## GET /client-contracts/:id

Detalji, uključujući `contentSnapshot` (svi popunjeni obavezni elementi — poglavlje 2.3) i `document_url`.

**Odgovor `200`:**
```json
{
  "id": "cc-1",
  "bookingId": "booking-9",
  "contractType": "ORGANIZOVANO_PUTOVANJE",
  "status": "GENERATED",
  "documentUrl": "mock://client-contracts/ORGANIZOVANO_PUTOVANJE-....pdf",
  "contentSnapshot": {
    "agency": { "name": "Terminal Travel", "address": "...", "licenseNumber": "...", "emergencyContact": "..." },
    "price": { "totalPrice": 100000, "currency": "EUR" },
    "itinerary": null,
    "accommodation": [{ "productName": "Hotel Aegean Blue", "stars": 4, "boardType": "HALF_BOARD", "stayFrom": "2027-06-10T00:00:00.000Z", "stayTo": "2027-06-17T00:00:00.000Z" }],
    "transport": [],
    "cancellationTerms": [{ "bookingItemId": "item-1", "rules": [{ "daysBeforeStay": 30, "refundPercentage": 100 }] }],
    "travelGuarantee": { "provider": "YUTA", "policyNumber": "GP-2027-009" },
    "paymentSchedule": { "depositAmount": 30000, "depositDueDate": "2027-05-01T00:00:00.000Z", "balanceDueDate": "2027-05-20T00:00:00.000Z" },
    "priceChangeComplaintDeadlineDays": 8
  }
}
```
Dozvola: `M20/client-contract/VIEW`.

## POST /client-contracts/:id/accept

Ručno evidentiranje prihvatanja (interni panel/telefon — skeniran/potpisan primerak). Gost sam prihvata kroz M8 clickwrap tok pre potvrde rezervacije (poglavlje 3.2), ne kroz ovaj endpoint.

**Odgovor `201`:**
```json
{ "id": "cc-1", "status": "ACCEPTED", "acceptedAt": "2027-06-02T09:00:00.000Z", "acceptedMethod": "WET_SIGNATURE_SCAN" }
```
Odbija sa `400` ako ugovor nije u statusu `GENERATED`.

Dozvola: `M20/client-contract/ACCEPT`.

## POST /client-contracts/:id/void

Poništava ugovor (npr. duplikat, greška u rezervaciji) — uvek ljudska radnja.

**Odgovor `201`:**
```json
{ "id": "cc-1", "status": "VOIDED", "voidedBy": "user-3" }
```
Odbija sa `400` ako je ugovor već `VOIDED`.

Dozvola: `M20/client-contract/VOID` (Vlasnik, Direktor).
