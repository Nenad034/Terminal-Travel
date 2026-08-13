# API dokumentacija — M7 (B2B modul: Subagenti)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela, budući B2B portal frontend, integratori — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/b2b`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Obim ovog dokumenta (avgust 2026):** pokriva sve endpoint-e implementirane u prvom prolazu (poglavlje 2.1–10, 11 osim chat-a). `POST/GET /subagents/:id/chat-messages` i `/booking-requests*` (spec poglavlje 2.0.4) **ne postoje još** — zavise od M15 (AI agentska orkestracija), koji nije implementiran. Ne pretpostavljati njihov oblik pre nego što M15 dođe na red.

---

## Ko je ko

`Subagent` je B2B-specifična dopuna na već postojeći M6 `ClientAccount` (`account_type = LEGAL_ENTITY`) — M7 ne duplira profil, samo dodaje hijerarhiju/proviziju/kredit. `client_account_id` na `Subagent` je slaba referenca (bez DB FK), isti obrazac kao svugde drugde gde M7/M10/M11/M20 referenciraju M6 `ClientAccount.id`.

---

## Subagenti (`Subagent`)

### GET /b2b/subagents

Lista. Agencija (Vlasnik/Direktor/Sales Manager) vidi sve; `SUBAGENT_ADMIN` dobija isključivo sopstveni zapis (ownership sprovodi servis, ne dozvola — isti obrazac kao M6 `GOST`).

**Odgovor `200`:**
```json
[
  {
    "id": "sub-1",
    "clientAccountId": "ca-legal-1",
    "parentSubagentId": null,
    "status": "ACTIVE",
    "commissionPercentage": "10",
    "creditLimit": "50000",
    "creditLimitCurrency": "EUR",
    "approvedBy": "user-vlasnik-1",
    "approvedAt": "2026-08-01T09:00:00.000Z",
    "createdAt": "2026-07-28T12:00:00.000Z"
  }
]
```
Dozvola: `M7/subagent/VIEW`.

### GET /b2b/subagents/:id

Isti oblik kao stavka liste. Ownership: agencija bilo koji; `SUBAGENT_ADMIN` samo sopstveni ili direktnog roditelja/dete.

### POST /b2b/subagents

Registracija novog Tier 1 kandidata (`parent_subagent_id = null`), status uvek `PENDING_APPROVAL`.

**Zahtev:**
```json
{ "clientAccountId": "ca-legal-1" }
```
`clientAccountId` mora referencirati postojeći `ClientAccount` sa `account_type = LEGAL_ENTITY`, inače `400`. Dozvola: `M7/subagent/CREATE` (Vlasnik/Direktor).

**Odgovor `201`:** `Subagent` zapis, `status: "PENDING_APPROVAL"`, `commissionPercentage`/`creditLimit` `null`.

### POST /b2b/subagents/:id/approve

Prelazak `PENDING_APPROVAL` → `ACTIVE`. Postavlja kreditni limit **uvek**; proviziju **samo ako je Tier 1** (`parent_subagent_id = null`) — za sub-subagenta proviziju već postavlja roditelj (kreacija ili `PATCH .../commission`), pa se ovde ne prosleđuje.

**Zahtev (Tier 1):**
```json
{ "creditLimit": 50000, "creditLimitCurrency": "EUR", "commissionPercentage": 10 }
```
**Zahtev (sub-subagent, provizija već postavljena):**
```json
{ "creditLimit": 20000, "creditLimitCurrency": "EUR" }
```
Dozvola: `M7/subagent/APPROVE` (Vlasnik/Direktor). Greška `400` ako subagent nije `PENDING_APPROVAL`, ili ako je Tier 1 bez provizije (ni u telu, ni već postavljene).

### PATCH /b2b/subagents/:id

Izmena kreditnog limita/statusa (`ACTIVE`/`SUSPENDED`). Dozvola: `M7/subagent/EDIT`.

```json
{ "creditLimit": 75000, "status": "ACTIVE" }
```

### GET / POST /b2b/subagents/:id/children

Sopstveni direktni sub-subagenti (§6 — ne unuci). GET dostupan agenciji i roditeljskom `SUBAGENT_ADMIN`-u (`M7/subagent/VIEW`). POST kreira sub-subagenta, dozvola `M7/subagent/MANAGE_OWN_NETWORK` (dodeljena i Vlasnik/Direktor pored `SUBAGENT_ADMIN`).

**Zahtev POST (opciono commissionPercentage — mora biti ≤ roditeljeva trenutna provizija, inače `400`):**
```json
{ "clientAccountId": "ca-legal-2", "commissionPercentage": 8 }
```

### PATCH /b2b/subagents/:id/children/:childId/commission

Roditelj menja proviziju deteta. Ograda: ne sme preći roditeljevu **trenutnu efektivnu** proviziju (uključuje obimski bonus, §3.1).

```json
{ "commissionPercentage": 9 }
```
`400` ako prelazi plafon. Dozvola: `M7/subagent/MANAGE_OWN_NETWORK`.

### GET /b2b/subagents/:id/outstanding-balance

Uživo izračunato stanje duga (§2.1) — zbir `Booking.total_price` u statusu `UNPAID`/`PARTIALLY_PAID`/`INVOICE_PENDING`, umanjeno za primljene (`RECEIVED`) uplate, samo u valuti `credit_limit_currency`.

**Odgovor `200`:**
```json
{ "amount": 12000, "currency": "EUR" }
```

---

## Provizija po obimu (`CommissionVolumeTier` / `SubagentVolumeStatus`)

### GET / POST / PATCH /b2b/subagents/:id/volume-tiers

Pragovi obima ("Ako-Onda"). Isti autoritet kao osnovna provizija (agencija za Tier 1, roditelj za sub-subagenta). Bar jedno od `resultingCommissionPercentage`/`resultingCommissionFixedAmount` mora biti postavljeno.

**Zahtev POST:**
```json
{
  "rank": 1,
  "thresholdMetric": "BOOKING_COUNT",
  "thresholdPeriod": "CALENDAR_YEAR",
  "thresholdValue": 20,
  "resultingCommissionPercentage": 15,
  "retroactive": true
}
```
Dozvola: `M7/subagent/MANAGE_OWN_NETWORK` (POST/PATCH), `M7/subagent/VIEW` (GET).

### GET /b2b/subagents/:id/volume-status

Tekući obim, dostignut prag, i `effectiveCommissionPercentage` — ovo polje koristi M5 pri kreiranju ponude (§5).

**Odgovor `200`:**
```json
{
  "subagentId": "sub-1",
  "calculatedMetricValue": "22",
  "currentTierId": "tier-1",
  "effectiveCommissionPercentage": "15",
  "periodStart": "2027-01-01T00:00:00.000Z",
  "periodEnd": "2027-12-31T23:59:59.999Z",
  "lastRecalculatedAt": "2027-03-15T08:00:00.000Z"
}
```
Automatski preračunato na svaki M5 `booking.confirmed`/`booking.cancelled` — nema potrebe da klijent poziva preračun ručno.

---

## Retroaktivni rabat (`CommissionRebate`)

### GET /b2b/subagents/:id/commission-rebates

Lista svih statusa. Dozvola: `M7/commission-rebate/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "rebate-1",
    "subagentId": "sub-1",
    "triggeringTierId": "tier-1",
    "periodStart": "2027-01-01T00:00:00.000Z",
    "periodEnd": "2027-12-31T23:59:59.999Z",
    "calculatedAmount": "2000",
    "currency": "EUR",
    "status": "DRAFT",
    "createdAt": "2027-03-15T08:00:00.000Z"
  }
]
```

### POST /b2b/subagents/:id/commission-rebates/:rebateId/approve

Ljudsko odobrenje — prevodi `DRAFT` → `APPLIED` (knjiži se kao umanjenje sledećeg dugovanja, ne menja već poslate fiskalne dokumente). Dozvola: `M7/commission-rebate/APPROVE` (Vlasnik/Direktor/Računovođa, **nikad AI agent**).

### POST /b2b/subagents/:id/commission-rebates/:rebateId/reject

```json
{ "reason": "Interni dogovor — ne primenjuje se ovog kvartala" }
```
Prevodi `DRAFT` → `REJECTED`, razlog se upisuje u audit log (append-only trag, ne u sam `CommissionRebate` zapis).

---

## Kako M7 utiče na M5 tok rezervacije

Ovo nisu M7 endpoint-i, ali su direktna posledica M7 pravila i vidljivi su kroz M5 API:

- **`POST /sales/quotes`** — ako `clientAccountId` ima `Subagent` zapis (proverava se postojanje zapisa, ne `ClientAccount.account_type`), cena koristi `effective_commission_percentage` umesto M6 popusta lojalnosti (§5).
- **`POST /sales/quotes/:id/confirm`** — ako je kupac subagent, kreditni limit se proverava odmah posle provere garancije putovanja (M11), pre bilo kog poziva ka M3/M4 (§4). Prekoračenje: `400` sa porukom koja pominje "kreditnog limita".
- **Vaučer** — subagent `ACTIVE` unutar kredita dobija vaučer automatski čim `Booking.status = CONFIRMED`, bez čekanja na `payment_status = PAID` (§2.0.2 korak 6 / M5 §6.3).

---

## Dozvole (pregled)

| Dozvola | Ko dobija podrazumevano |
| :---- | :---- |
| `M7/subagent/VIEW` | Vlasnik, Direktor, Sales Manager, `SUBAGENT_ADMIN` (samo sopstveno) |
| `M7/subagent/CREATE` | Vlasnik, Direktor |
| `M7/subagent/APPROVE` | Vlasnik, Direktor |
| `M7/subagent/EDIT` | Vlasnik, Direktor |
| `M7/subagent/MANAGE_OWN_NETWORK` | Vlasnik, Direktor, `SUBAGENT_ADMIN` (samo sopstvena deca) |
| `M7/commission-rebate/VIEW` | Vlasnik, Direktor, Računovođa, Sales Manager |
| `M7/commission-rebate/APPROVE` | Vlasnik, Direktor, Računovođa — nikad AI agent |
