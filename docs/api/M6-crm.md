# API dokumentacija — M6 (CRM: Gosti i Nalogodavci)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela, budući integratori — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/crm`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1), osim javnih `post-trip-surveys/:token*` endpoint-a (bez autentikacije, gost pristupa preko tokena iz email-a).

---

## Nalogodavci (`ClientAccount`)

### GET /crm/client-accounts

Lista, filtrirano po `email`/`taxId`.

**Odgovor `200`:**
```json
[
  {
    "id": "ca-1",
    "accountType": "INDIVIDUAL",
    "fullName": "Petar Petrović",
    "email": "petar@example.com",
    "marketingConsent": true,
    "tags": ["VIP", "čest putnik"],
    "createdAt": "2027-06-01T10:00:00.000Z"
  }
]
```
Dozvola: `M6/client-account/VIEW`.

### GET /crm/client-accounts/:id/travel-history

Spaja M5 `Booking`/`BookingItem` uživo (§5) — bez sopstvene kopije u M6.

**Odgovor `200`:**
```json
[
  { "id": "booking-9", "bookingNumber": "TT-2027-0009", "status": "COMPLETED", "totalPrice": 100000, "currency": "EUR", "items": [ { "id": "item-1", "product": { "id": "prod-1" } } ] }
]
```

### POST /crm/client-accounts

**Zahtev:**
```json
{ "accountType": "INDIVIDUAL", "fullName": "Petar Petrović", "email": "petar@example.com", "marketingConsent": true, "tags": ["VIP"] }
```
**Odgovor `201`:** isti oblik kao GET stavka. Dozvola: `M6/client-account/CREATE`.

### PATCH /crm/client-accounts/:id

Sva polja opciona. Dozvola: `M6/client-account/EDIT`.

---

## Gosti (`GuestProfile`)

### GET /crm/guest-profiles / POST /crm/guest-profiles / PATCH /crm/guest-profiles/:id

Isti obrazac kao nalogodavci. Dozvola: `M6/guest-profile/VIEW`/`CREATE`/`EDIT`.

**Zahtev POST:**
```json
{
  "fullName": "Ana Anić",
  "documentType": "PASSPORT",
  "documentNumber": "P1234567",
  "nationality": "RS",
  "dateOfBirth": "1990-05-20",
  "linkedClientAccountId": "ca-1"
}
```

### GET /crm/guest-profiles/:id/travel-history

Spaja preko `BookingItemGuest.guest_profile_id` (§5).

---

## Program lojalnosti

### GET /crm/loyalty-tiers / POST /crm/loyalty-tiers / PATCH /crm/loyalty-tiers/:id

**Odgovor GET `200`:**
```json
[
  { "id": "tier-gold", "name": "Zlatni", "rank": 3, "qualificationMetric": "TOTAL_SPEND_RSD", "qualificationPeriod": "ROLLING_12_MONTHS", "threshold": "200000", "discountPercentage": "10" }
]
```
Dozvola: `VIEW` svima iz §7; `POST`/`PATCH` samo Vlasnik/Direktor (`M6/loyalty-tier/EDIT`).

### GET /crm/loyalty-status/:clientAccountId

Trenutni nivo i popust — ovo poziva M5 pri kreiranju Ponude (§3.3).

**Odgovor `200`:**
```json
{
  "clientAccountId": "ca-1",
  "currentTierId": "tier-gold",
  "manualOverrideTierId": null,
  "effectiveTierId": "tier-gold",
  "discountPercentage": 10,
  "calculatedMetricValue": 250000
}
```

### POST /crm/loyalty-status/:clientAccountId/override

**Zahtev:**
```json
{ "tierId": "tier-platinum", "reason": "VIP gost, dogovor sa vlasnikom" }
```
**Odgovor `201`:** `ClientLoyaltyStatus` sa popunjenim `manualOverrideTierId`/`manualOverrideReason`/`manualOverrideBy`. Dozvola: `M6/loyalty-status/OVERRIDE` (Vlasnik, Direktor).

---

## Komunikacija (`CommunicationLog`)

### GET /crm/communication-log

Filtrirano po `clientAccountId`/`guestProfileId`.

### POST /crm/communication-log

**Zahtev (ljudski unos, npr. sažetak telefonskog poziva):**
```json
{ "clientAccountId": "ca-1", "channel": "PHONE", "direction": "OUTBOUND", "summary": "Gost pitao za termin poletanja.", "draftedByAi": false, "sentBy": "user-3" }
```
**Zahtev (AI nacrt — `sentBy` se ignoriše, uvek ostaje `null` pri kreiranju):**
```json
{ "clientAccountId": "ca-1", "channel": "EMAIL", "direction": "OUTBOUND", "summary": "Cena aranžmana je 500 EUR — nacrt za pregled.", "draftedByAi": true }
```
**Odgovor `201`:** `{ "id": "log-1", ..., "sentBy": null }`

### POST /crm/communication-log/:id/mark-sent

Jedini put kroz koji AI nacrt dobija `sent_by` (§4.1) — isključivo ljudski nalog preko JWT-a.

**Odgovor `201`:** `{ "id": "log-1", "sentBy": "user-3" }`. Odbija `400` ako je zapis već poslat.

---

## Anketa posle putovanja (`PostTripSurvey`)

### GET /crm/post-trip-surveys

Interni uvid, filtrirano po `bookingId`/`status`. Dozvola: `M6/post-trip-survey/VIEW`.

### GET /crm/post-trip-surveys/:token *(javno, bez autentikacije)*

**Odgovor `200`:**
```json
{ "id": "survey-1", "bookingId": "booking-9", "status": "SENT", "accessToken": "…", "scheduledSendAt": "2027-06-19T10:00:00.000Z" }
```

### POST /crm/post-trip-surveys/:token/submit *(javno)*

**Zahtev:**
```json
{ "overallRating": 5, "responses": { "comment": "Odlično iskustvo!" } }
```
**Odgovor `201`:**
```json
{ "id": "survey-1", "status": "COMPLETED", "overallRating": 5, "wantsGoogleReview": true, "completedAt": "2027-06-19T11:00:00.000Z" }
```

### POST /crm/post-trip-surveys/:token/google-review-click *(javno)*

Beleži `google_review_clicked_at` pre redirekta na Google link.

**Odgovor `201`:**
```json
{ "googleReviewUrl": "https://g.page/r/terminal-travel/review" }
```

---

## Napomene za integratore

- `ClientAccount`/`GuestProfile` reference u `Booking`/`BookingItemGuest` (M5) su **slabe** (bez DB-nivo FK) — čitaju se preko API-ja, ne garantuju referencijalni integritet na nivou baze. Vidi `docs/moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md` poglavlje 6 za obrazloženje.
- Popust lojalnosti se primenjuje **automatski** u M5 `POST /sales/quotes` (§3.3) — spoljni integratori ne pozivaju `GET /loyalty-status` sami radi primene popusta, samo radi prikaza.
