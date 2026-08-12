# API dokumentacija — M11 (Regulatorni modul / Compliance)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela, budući integratori — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M11-compliance/08-SPECIFIKACIJA-M11-COMPLIANCE.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/compliance`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).
**Novčani iznosi:** uvek `integer` u najmanjoj jedinici valute (para/cents), nikad decimal.

---

## Garancija putovanja (YUTA)

### GET /travel-guarantee

Vraća "trenutnu" garanciju — najnoviju po `validTo`, bez obzira na status (aktivna, istekla, na obnavljanju).

**Odgovor `200`:**
```json
{
  "id": "tg-1",
  "provider": "YUTA",
  "policyNumber": "GP-2026-014",
  "coverageAmount": 500000000,
  "currency": "RSD",
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validTo": "2026-12-31T00:00:00.000Z",
  "documentUrl": "https://.../garancija-2026.pdf",
  "status": "ACTIVE"
}
```
Dozvola: `M11/travel-guarantee/VIEW`.

### PATCH /travel-guarantee

Uvek ljudska radnja (Vlasnik/Direktor) — AI agent nikad ne poziva ovaj endpoint sa `SUBMIT`/izmenom namere. `createNew: true` kreira novu godišnju polisu (obnavljanje); bez toga menja postojeću.

**Zahtev (obnavljanje):**
```json
{
  "createNew": true,
  "provider": "YUTA",
  "policyNumber": "GP-2027-009",
  "coverageAmount": 600000000,
  "currency": "RSD",
  "validFrom": "2027-01-01",
  "validTo": "2027-12-31",
  "documentUrl": "https://.../garancija-2027.pdf"
}
```
**Odgovor `200`:** novi `TravelGuarantee` zapis, isti oblik kao GET. Upisuje se u M1 audit log kao `travel_guarantee.created` (ili `.updated` za izmenu bez `createNew`), sa identitetom Vlasnika/Direktora.

Dozvola: `M11/travel-guarantee/EDIT` (nikad AI agent).

### GET /travel-guarantee/utilization

Kumulativna prodata vrednost `ORGANIZATOR` prometa naspram `coverageAmount` tekuće garancije. Isti izračun koji M5 koristi in-process pri potvrdi rezervacije (§2.2).

**Odgovor `200`:**
```json
{
  "travelGuaranteeId": "tg-1",
  "guaranteeStatus": "ACTIVE",
  "coverageAmount": 500000000,
  "currency": "RSD",
  "utilizedAmount": 412000000,
  "utilizationPercent": 82.4,
  "warningThresholdReached": true,
  "inGracePeriod": false
}
```
Dozvola: `M11/travel-guarantee/VIEW`.

---

## CIS registracije garancije po rezervaciji

### GET /travel-guarantee-registrations

Lista `TravelGuaranteeRegistration` zapisa, opciono filtrirano po `status` i/ili `bookingId`.

**Zahtev:**
```
GET /api/v1/compliance/travel-guarantee-registrations?status=FAILED
```
**Odgovor `200`:**
```json
[
  {
    "id": "reg-1",
    "bookingId": "booking-9",
    "travelGuaranteeId": "tg-1",
    "cisRegistrationNumber": null,
    "status": "FAILED",
    "registeredAt": null,
    "releaseRequestedAt": null,
    "releasedAt": null,
    "failureReason": "CIS nedostupan (timeout)",
    "createdAt": "2026-08-10T09:00:00.000Z"
  }
]
```
Dozvola: `M11/travel-guarantee-registration/VIEW`.

### POST /travel-guarantee-registrations/:id/retry

Ručno ponavlja CIS registraciju (ako je zapis `PENDING`/`FAILED`) ili ponovni pokušaj skidanja opterećenja (ako je `RELEASE_PENDING`). Upisuje se u audit log kao `travel_guarantee_registration.retry` / `.retry_release`.

**Odgovor `201`:** ažuriran `TravelGuaranteeRegistration` zapis (isti oblik kao gore).

Dozvola: `M11/travel-guarantee-registration/RETRY` (Vlasnik/Direktor).

---

## Izvoz za inspekciju

### POST /inspection-export

Agregira već postojeće podatke iz M1 (audit log), M5 (rezervacije), M10 (fiskalni dokumenti) i M11 (CIS registracije) za zadati period.

**Zahtev:**
```json
{ "periodFrom": "2026-01-01", "periodTo": "2026-01-31" }
```
**Odgovor `201`:**
```json
{
  "periodFrom": "2026-01-01",
  "periodTo": "2026-01-31",
  "generatedAt": "2026-08-12T10:00:00.000Z",
  "auditLogEntries": [ "..." ],
  "bookings": [ "..." ],
  "fiscalDocuments": [ "..." ],
  "travelGuaranteeRegistrations": [ "..." ],
  "csv": "== Rezervacije ==\nbooking_number,status,tip_nastupanja,total_price,currency,created_at\n..."
}
```
`csv` polje se otvara direktno u Excel-u (privremeno rešenje dok se sa vlasnikom ne potvrdi PDF/nativna XLSX biblioteka — vidi M11 spec §7).

Dozvola: `M11/inspection-export/CREATE`.
