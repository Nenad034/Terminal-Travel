# API dokumentacija — M15 (AI agentska orkestracija)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/ai-orchestration`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).
**Obim (avgust 2026, v1.10):** omnisearch (§6.5, `channel = INTERNAL_PANEL`), pun `AgentActionType` registar + sprovedba na nivou koda (§5) + `/action-types` + `/inbox`. `/agents`, `/external-review-sources` iz spec §9 nisu implementirani — vidi spec §11.

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
    {
      "label": "Rezervacija TT-2027-000482 — Ana Petrović",
      "href": "/rezervacije/pretraga?bookingId=b7e2f1a0-..."
    }
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
    {
      "label": "Rezervacija TT-2027-000501 — Marko Jovanović",
      "href": "/rezervacije/pretraga?bookingId=..."
    }
  ],
  "entityResults": [
    {
      "type": "BOOKING",
      "id": "...",
      "label": "Rezervacija TT-2027-000501 — Marko Jovanović",
      "href": "/rezervacije/pretraga?bookingId=..."
    }
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
  "matchedRoutes": [
    {
      "label": "Rezervacija TT-2027-000482 — Ana Petrović",
      "href": "/rezervacije/pretraga?bookingId=..."
    }
  ],
  "entityResults": [
    {
      "type": "BOOKING",
      "id": "...",
      "label": "Rezervacija TT-2027-000482 — Ana Petrović",
      "href": "/rezervacije/pretraga?bookingId=..."
    }
  ],
  "aiAnswer": "Pronašao sam zapis na koji se pitanje odnosi. Radnju (otkazivanje/slanje/izmenu) potvrdi ručno na toj stranici — omnisearch samo pronalazi i navigira, nikad ne izvršava radnju."
}
```

### Slučaj 6 — pretraga ponude bez dovoljno podataka: potpitanje, pa odgovor sa istorijom (M15 spec §6.5.4.6, 17.9.2026)

Kanal `B2C_SITE` radi anonimno (bez `Authorization`). Kad upitu za pretragu raspoloživosti fali period i/ili sastav putnika, agent **ne pretražuje** nego vrati jedno potpitanje i zastavicu `clarification: true`. Klijent vraća tu turu u `history[]` sa istom zastavicom — server po njoj broji krugove (najviše dva; posle toga pretražuje sa onim što ima i kaže šta je pretpostavio).

**Zahtev 1 (stvarno izmereno 17.9.2026):**

```json
{ "query": "tražim hotel u Grčkoj za porodicu", "channel": "B2C_SITE" }
```

**Odgovor `200`:**

```json
{
  "active": true,
  "matchedRoutes": [],
  "entityResults": [],
  "aiAnswer": "Za koji period i za koliko osoba (odraslih i dece)?",
  "clarification": true
}
```

**Zahtev 2 — odgovor gosta, sa prethodnom turom u `history`:**

```json
{
  "query": "od 10. do 17. avgusta 2027, dvoje odraslih i jedno dete",
  "channel": "B2C_SITE",
  "history": [
    {
      "question": "tražim hotel u Grčkoj za porodicu",
      "answer": "Za koji period i za koliko osoba (odraslih i dece)?",
      "clarification": true
    }
  ]
}
```

**Odgovor `200`** (skraćeno — 10 stavki; alat `search_availability` je pozvao M5 `SearchService.search` sa `destinationCountry: "Grčka"`, `stayFrom/stayTo`, `occupancy: { adults: 2, children: 1 }`):

```json
{
  "active": true,
  "matchedRoutes": [{ "label": "Aegean Breeze Resort 4*", "href": "/smestaj/02467d72-..." }],
  "entityResults": [
    {
      "type": "PRODUCT",
      "id": "02467d72-...",
      "label": "Aegean Breeze Resort 4*",
      "href": "/smestaj/02467d72-...",
      "media": null
    }
  ],
  "aiAnswer": "Za period 10–17. avgusta 2027 za dvoje odraslih i jedno dete dostupno je 10 smeštaja u Grčkoj, npr. Aegean Breeze Resort 4* (Kasandra) od 3.302 EUR ukupno za boravak…"
}
```

Šta agent **ne radi** (sprovedeno u kodu, ne samo promptom): ne pita za uslugu/budžet/kategoriju pre prvog rezultata; ne ponavlja pretragu sa manje uslova nego što je gost dao (odbija se, gost dobija „za te uslove nema ponude, probajte…"); nepoznata destinacija vraća „nije u ponudi" + spisak država koje nudimo, ne pretragu celog kataloga. `aiAnswer` uvek navodi datume kao datume. Cene u `aiAnswer` su ukupne za period i sve putnike, u valuti ugovora.

**Greške:** `401` bez validnog tokena. Nema posebne M1 dozvole na ovom endpoint-u — vidljivost rezultata se sprovodi unutar servisa, po pojedinačnom pozivu M5/M2 servisa sa identitetom pozivaoca (isti obrazac kao `M5 GET /search` §6.2 dopuna).

**Audit:** svaki poziv upisuje jedan `AuditLogEntry` sa `actor_type = AI_AGENT` (M15 spec §10).

---

## GET /action-types

Ceo registar iz spec poglavlja 4. Zahteva `M15/agent-action-type/VIEW`.

**Odgovor `200`:**

```json
[
  {
    "id": "...",
    "moduleCode": "M10",
    "actionCode": "fiscal_document.submit",
    "tier": "NEVER_AUTONOMOUS",
    "sourceNote": "M10 poglavlje 6"
  },
  {
    "id": "...",
    "moduleCode": null,
    "actionCode": "money.transfer",
    "tier": "NEVER_AUTONOMOUS",
    "sourceNote": "poglavlje 7 Master dokumenta"
  }
]
```

## POST /action-types

Registruje novu akciju (za budući modul koji uvede novu akciju koju AI agent dodiruje — spec §4 "ne postoji podrazumevani nivo"). Zahteva `M15/agent-action-type/EDIT`.

**Zahtev:**

```json
{
  "moduleCode": "M3",
  "actionCode": "novi_primer.akcija",
  "tier": "PROPOSE_THEN_APPROVE",
  "sourceNote": "M3 poglavlje X"
}
```

`moduleCode` se izostavlja (ili šalje kao `null`) za "(globalno)" red.

## PATCH /action-types/:id

Izmena `tier`/`sourceNote` postojećeg reda. Zahteva `M15/agent-action-type/EDIT`. `404` ako `id` ne postoji.

---

## GET /inbox

Agent Inbox (spec §6) — agregovane `PROPOSE_THEN_APPROVE` stavke koje čekaju odobrenje, samo iz izvora za koje pozivalac ima odgovarajuću VIEW dozvolu tog modula. Zahteva `M15/agent-inbox/VIEW`.

**Zahtev:**

```
GET /api/v1/ai-orchestration/inbox
```

**Odgovor `200`:**

```json
[
  {
    "moduleCode": "M5",
    "actionCode": "supplier_manifest.send",
    "label": "Operativne liste spremne za slanje dobavljaču",
    "count": 3
  },
  {
    "moduleCode": "M7",
    "actionCode": "commission_rebate.apply",
    "label": "Rabati provizije na čekanju odobrenja",
    "count": 1
  }
]
```

Izvor se u potpunosti izostavlja iz odgovora (ne pojavljuje se ni sa `count: 0`) ako pozivalac nema VIEW dozvolu tog modula; ako dozvolu ima ali trenutno nema stavki na čekanju, izvor se vraća sa `count: 0`.
