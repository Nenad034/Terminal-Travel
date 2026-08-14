# API dokumentacija — M15 (AI agentska orkestracija)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/ai-orchestration`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).
**Obim ovog prolaza (avgust 2026):** samo omnisearch (§6.5) za `channel = INTERNAL_PANEL` (M17). `/agents`, `/action-types`, `/inbox`, `/external-review-sources` iz spec §9 nisu implementirani u ovom prolazu — vidi spec §11.

---

## GET /modules/:code/activation

Status aktivacije jednog `ModuleAgentActivation` gate-a (M15 spec §3). Zahteva `M15/module-activation/VIEW`.

**Zahtev:**
```
GET /api/v1/ai-orchestration/modules/M15_OMNISEARCH/activation
```

**Odgovor `200`:**
```json
{
  "moduleCode": "M15_OMNISEARCH",
  "testsPassing": false,
  "productionCycleCompleted": false,
  "status": "NOT_READY",
  "activatedBy": null,
  "activatedAt": null
}
```

`404` ako `module_code` nije poznat (nije seedovan).

---

## PATCH /modules/:code/activation

Ljudska potvrda prelaska gate-a u novi status — **uvek Vlasnik ili Direktor**, nikad AI agent (M15 spec §3, §5, §8). Zahteva `M15/module-activation/ACTIVATE`; dodatno, servis odbija poziv ako je pozivalac `account_type = AI_AGENT`, čak i kad bi neka buduća greška dodelila tu dozvolu AI nalogu (odbrana u dubinu).

**Zahtev:**
```json
PATCH /api/v1/ai-orchestration/modules/M15_OMNISEARCH/activation
{ "status": "ACTIVATED" }
```

**Odgovor `200`:**
```json
{
  "moduleCode": "M15_OMNISEARCH",
  "testsPassing": false,
  "productionCycleCompleted": false,
  "status": "ACTIVATED",
  "activatedBy": "3b8e...-vlasnik-user-id",
  "activatedAt": "2026-08-20T09:12:00.000Z"
}
```

**Greške:** `403` ako pozivalac nema dozvolu ILI je `account_type = AI_AGENT` ("Aktivacija modula je uvek ljudska odluka — AI agent ne sme da je izvrši."). `404` ako `module_code` nije poznat.

---

## POST /omnisearch

Univerzalna pretraga/AI razgovor za M17 kanal (M15 spec §6.5, §9). Poziva se sa identitetom korisnika koji pretražuje — rezultati nikad ne prekoračuju ono što bi taj korisnik video da je ručno kliktao kroz panel.

**Zahtev:**
```json
POST /api/v1/ai-orchestration/omnisearch
{ "query": "TT-2027-000482", "channel": "INTERNAL_PANEL" }
```

### Slučaj 1 — modul aktiviran, direktno poklapanje (bez jezičkog modela)

**Odgovor `200`:**
```json
{
  "active": true,
  "matchedRoutes": [
    { "label": "Rezervacija TT-2027-000482 — Ana Petrović", "href": "/rezervacije/pretraga?bookingId=b7e2f1a0-..." }
  ],
  "entityResults": [
    {
      "type": "BOOKING",
      "id": "b7e2f1a0-...",
      "label": "Rezervacija TT-2027-000482 — Ana Petrović",
      "href": "/rezervacije/pretraga?bookingId=b7e2f1a0-..."
    }
  ]
}
```

### Slučaj 2 — pitanje na prirodnom jeziku, jezički model konfigurisan (ANTHROPIC_API_KEY podešen)

**Zahtev:**
```json
{ "query": "koje rezervacije čekaju fiskalni dokument", "channel": "INTERNAL_PANEL" }
```

**Odgovor `200`:**
```json
{
  "active": true,
  "matchedRoutes": [
    { "label": "Rezervacija TT-2027-000501 — Marko Jovanović", "href": "/rezervacije/pretraga?bookingId=..." }
  ],
  "entityResults": [
    { "type": "BOOKING", "id": "...", "label": "Rezervacija TT-2027-000501 — Marko Jovanović", "href": "/rezervacije/pretraga?bookingId=..." }
  ],
  "aiAnswer": "Pronašao sam jednu rezervaciju koja odgovara upitu preko pretrage po imenu — proveri status fiskalnog dokumenta na njenoj stranici."
}
```

### Slučaj 3 — modul NIJE aktiviran (`ModuleAgentActivation.status != ACTIVATED`)

**Odgovor `200`:**
```json
{ "active": false, "matchedRoutes": [], "entityResults": [] }
```

Namerno `200` sa `active:false`, ne `409`/greška — panel prikazuje smirenu poruku ("AI pretraga još nije uključena"), ne error banner (M17 spec §5.5).

### Slučaj 4 — pitanje na prirodnom jeziku, ali `ANTHROPIC_API_KEY` nije podešen

**Odgovor `200`:**
```json
{
  "active": true,
  "matchedRoutes": [],
  "entityResults": [],
  "aiAnswer": "AI odgovor trenutno nije dostupan (ANTHROPIC_API_KEY nije podešen na serveru) — pokušaj konkretniju pretragu (broj rezervacije, ime gosta, naziv proizvoda)."
}
```

### Slučaj 5 — upit koji liči na zahtev za radnju ("otkaži...")

Odgovor uvek vraća link/navigaciju, nikad ne izvršava radnju (M15 spec §6.5.4 tačka 3, registar `omnisearch.query = AUTONOMOUS` ograničen na pronalaženje):
```json
{
  "active": true,
  "matchedRoutes": [{ "label": "Rezervacija TT-2027-000482 — Ana Petrović", "href": "/rezervacije/pretraga?bookingId=..." }],
  "entityResults": [{ "type": "BOOKING", "id": "...", "label": "Rezervacija TT-2027-000482 — Ana Petrović", "href": "/rezervacije/pretraga?bookingId=..." }],
  "aiAnswer": "Pronašao sam zapis na koji se pitanje odnosi. Radnju (otkazivanje/slanje/izmenu) potvrdi ručno na toj stranici — omnisearch samo pronalazi i navigira, nikad ne izvršava radnju."
}
```

**Greške:** `401` bez validnog tokena. Nema posebne M1 dozvole na ovom endpoint-u — vidljivost rezultata se sprovodi unutar servisa, po pojedinačnom pozivu M5/M2 servisa sa identitetom pozivaoca (isti obrazac kao `M5 GET /search` §6.2 dopuna).

**Audit:** svaki poziv upisuje jedan `AuditLogEntry` sa `actor_type = AI_AGENT` (M15 spec §10).
