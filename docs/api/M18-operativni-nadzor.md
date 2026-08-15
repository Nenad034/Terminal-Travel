# API dokumentacija — M18 (Operativni nadzor i AI optimizacija)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/ops`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1). Sve rute su interne (Vlasnik/Direktor, M18 spec §7) — nema javnog/gostinskog pristupa.

---

## GET /health-signals

Lista detektovanih signala, filtrirana po modulu/tipu/ozbiljnosti. Zahteva `M18/health-signal/VIEW`.

**Zahtev:**
```
GET /api/v1/ops/health-signals?module=M4&severity=CRITICAL
```

**Odgovor `200`:**
```json
[
  {
    "id": "b1a2...",
    "sourceModule": "M4",
    "signalType": "PROVIDER_DEGRADED",
    "severity": "CRITICAL",
    "securityCategory": null,
    "details": { "providerCode": "travelgate", "status": "OFFLINE", "uptimePercentage": 20 },
    "detectedAt": "2026-08-15T10:00:00.000Z",
    "notifiedAt": "2026-08-15T10:00:01.000Z"
  }
]
```

Nema `POST` — signali nastaju isključivo iz detekcije (§2.1), nikad ručnim unosom.

---

## GET /provider-health

Poslednji `ProviderHealthSnapshot` po provajderu (§2.3). Zahteva `M18/provider-health/VIEW`.

**Odgovor `200`:**
```json
[
  { "id": "...", "providerCode": "travelgate", "latencyMsAvg": 420, "uptimePercentage": 98.5, "errorCountLastHour": 1, "status": "ONLINE", "computedAt": "2026-08-15T10:15:00.000Z" }
]
```

---

## GET /notification-channels

Zahteva `M18/notification-channel/VIEW`. `configEncrypted` se nikad ne vraća.

**Odgovor `200`:**
```json
[
  { "id": "...", "channelType": "TELEGRAM", "recipientRole": "VLASNIK", "status": "ACTIVE", "createdAt": "2026-08-01T09:00:00.000Z" }
]
```

## POST /notification-channels

Zahteva `M18/notification-channel/EDIT`.

**Zahtev:**
```json
{ "channelType": "TELEGRAM", "config": { "chatId": "123456789" }, "recipientRole": "VLASNIK" }
```
Za `EMAIL`: `"config": { "email": "vlasnik@primer.rs" }`.

## PATCH /notification-channels/:id

Zahteva `M18/notification-channel/EDIT`.

**Zahtev:**
```json
{ "status": "INACTIVE" }
```

---

## GET /weekly-reviews

Zahteva `M18/weekly-review/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "...",
    "periodStart": "2026-08-10T00:00:00.000Z",
    "periodEnd": "2026-08-17T09:00:00.000Z",
    "summary": "Nedeljni pregled (10.8.2026. – 17.8.2026.): 3 signala ukupno (1 CRITICAL, 2 WARNING, 0 INFO).\n- PROVIDER_DEGRADED: 1\n- PAYMENT_FAILURE_SPIKE: 2",
    "status": "SENT",
    "generatedAt": "2026-08-17T09:00:00.000Z",
    "sentAt": "2026-08-17T09:00:01.000Z"
  }
]
```

## POST /weekly-reviews/run

Ručno pokretanje van rasporeda (isti sažetak kao ponedeljeljski cron). Zahteva `M18/weekly-review/VIEW`.

**Odgovor `201`:** isti oblik kao gornji red, uvek `status: "SENT"`.

---

## GET /trend-suggestions

Zahteva `M18/trend-suggestion/VIEW`.

## POST /trend-suggestions

**Zahtev:**
```json
{ "category": "TEHNOLOGIJA", "summary": "Sabre najavio novi agentski API u avgustu 2026.", "suggestedAction": "Proceniti integraciju za Fazu 6 dopunu M4." }
```

**Odgovor `201`:**
```json
{ "id": "...", "category": "TEHNOLOGIJA", "summary": "...", "suggestedAction": "...", "status": "DRAFT", "approvedBy": null, "createdAt": "..." }
```

## POST /trend-suggestions/:id/approve

Zahteva `M18/trend-suggestion/APPROVE`. Samo za `DRAFT` (`400` inače).

**Odgovor `201`:**
```json
{ "id": "...", "status": "APPROVED", "approvedBy": "3b8e...-vlasnik-user-id" }
```

## POST /trend-suggestions/:id/reject

Zahteva `M18/trend-suggestion/APPROVE`.

---

## GET /agent-invocations

Log poziva jezičkom modelu, filtriran po agentu. Zahteva `M18/agent-invocation-log/VIEW`.

**Zahtev:**
```
GET /api/v1/ops/agent-invocations?agentId=8d37...
```

**Odgovor `200`:**
```json
[
  {
    "id": "...",
    "agentId": "8d37...",
    "actionCode": "omnisearch.query",
    "modelTier": "LIGHT",
    "modelIdentifier": "claude-haiku-4-5-20251001",
    "inputTokens": 512,
    "outputTokens": 128,
    "estimatedCostEur": 0.001059,
    "latencyMs": 840,
    "timestamp": "2026-08-15T10:20:00.000Z"
  }
]
```

---

## GET /ai-provider-quota

Zahteva `M18/ai-provider-quota/VIEW`.

**Odgovor `200`:**
```json
[
  {
    "id": "...",
    "providerName": "ANTHROPIC",
    "period": "DAILY",
    "quotaLimit": null,
    "consumed": 640,
    "budgetLimitEur": 2,
    "consumedEur": 0.001059,
    "enforcementState": "NORMAL",
    "degradedAt": null,
    "periodStart": "2026-08-15T00:00:00.000Z",
    "periodEnd": "2026-08-16T00:00:00.000Z",
    "alertThresholdPercentage": 80
  }
]
```

## POST /ai-provider-quota

Kreira novi red za tekući period. `quotaLimit`/`budgetLimitEur` su opcioni — bez njih red samo prati potrošnju, bez alarma/degradacije (M18 spec §11).

**Zahtev:**
```json
{ "providerName": "ANTHROPIC", "period": "DAILY", "budgetLimitEur": 2 }
```

## PATCH /ai-provider-quota/:id

**Zahtev:**
```json
{ "budgetLimitEur": 5 }
```

## POST /ai-provider-quota/:id/override

Ručan povratak iz `DEGRADED` u `NORMAL` pre isteka perioda. Zahteva `M18/ai-provider-quota/OVERRIDE`; upisuje `AuditLogEntry` (M1).

**Odgovor `201`:**
```json
{ "id": "...", "enforcementState": "NORMAL", "degradedAt": null }
```

---

## GET /ai-agent-budgets

Zahteva `M18/ai-agent-budget/VIEW`.

```
GET /api/v1/ops/ai-agent-budgets?agentId=8d37...
```

## POST /ai-agent-budgets

Zahteva `M18/ai-agent-budget/EDIT`. Za razliku od `/ai-provider-quota`, `budgetLimitEur` je obavezan — red se pravi tek kad je budžet stvarno odlučen.

**Zahtev:**
```json
{ "agentId": "8d37...", "period": "DAILY", "budgetLimitEur": 0.5 }
```

## PATCH /ai-agent-budgets/:id

**Zahtev:**
```json
{ "budgetLimitEur": 1 }
```
