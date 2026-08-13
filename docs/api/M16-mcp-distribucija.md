# API dokumentacija — M16 (Agentski distribucioni interfejs, MCP)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — spoljni AI agent (ChatGPT/Google/Sabre-MindTrip) koji koristi MCP alate, ili interni tim koji upravlja registracijom klijenata preko `/mcp-admin`. Interni oslonac za implementaciju ostaje `docs/moduli/M16-mcp-distribucija/17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md` — ovaj dokument ga ne zamenjuje.

**Dva odvojena API sloja:**
1. `/api/v1/mcp-admin/*` — interni administrativni REST (registracija/aktivacija/odobrenje MCP klijenata), `Authorization: Bearer <JWT>` (M1, interni nalog).
2. `/api/v1/mcp` — sam MCP server (JSON-RPC 2.0, protokol 2026-07-28), `Authorization: Bearer <mcp-kredencijal>` (izdat pri registraciji, **ne** M1 JWT).

---

## 1. Administrativni deo (`/mcp-admin`)

### POST /mcp-admin/clients

Registruje novog spoljnog MCP klijenta, uvek `status: "PENDING"`. Dozvola: `M16/mcp-client/MANAGE` (Vlasnik/Direktor).

**Zahtev:**
```json
{ "clientName": "ChatGPT (OpenAI)", "accessLevel": "READ_ONLY", "rateLimitPerMinute": 60 }
```

**Odgovor `201`:**
```json
{
  "id": "reg-1",
  "clientName": "ChatGPT (OpenAI)",
  "accessLevel": "READ_ONLY",
  "status": "PENDING",
  "rateLimitPerMinute": 60,
  "linkedUserId": null,
  "linkedClientAccountId": null,
  "credential": "2deae519326f191dc503bbd6f14d3b2de9af8b6198942a663b4c8280b1067db8"
}
```
`credential` je plaintext Bearer kredencijal — **vraća se tačno jednom, ovde**. Server čuva samo njegov SHA-256 heš (`credentials_encrypted`); ako se izgubi, jedino rešenje je `suspend` + nova registracija.

### POST /mcp-admin/clients/:id/activate

`PENDING → ACTIVE`. Atomski kreira prateći M6 `ClientAccount` (`LEGAL_ENTITY`) i M1 `User` (`account_type: AI_AGENT`) preko kojih MCP alati pristupaju M5. Dozvola: `M16/mcp-client/MANAGE`.

**Odgovor `201`:** isti oblik kao gore, `status: "ACTIVE"`, `linkedUserId`/`linkedClientAccountId` popunjeni.

### POST /mcp-admin/clients/:id/approve-read-write

Jedini put do `READ_WRITE` (mogućnost stvarne rezervacije) — nikad automatski, upisuje se u audit log. Zahteva prethodno `ACTIVE`. Dozvola: `M16/mcp-client/APPROVE_READ_WRITE`.

### POST /mcp-admin/clients/:id/suspend

Bilo koji status → `SUSPENDED`; kredencijal odmah prestaje da radi na `/mcp`. Dozvola: `M16/mcp-client/MANAGE`.

### GET /mcp-admin/clients, GET /mcp-admin/clients/:id

Lista/pojedinačan zapis, nikad ne uključuje `credentialsEncrypted`. Dozvola: `M16/mcp-client/VIEW`.

---

## 2. MCP server (`POST /api/v1/mcp`)

Stateless — svaki zahtev je samostalan, nema `initialize` handshake-a. Obavezni header-i (protokol 2026-07-28):

| Header | Vrednost |
| :---- | :---- |
| `Authorization` | `Bearer <mcp-kredencijal>` (iz `POST /mcp-admin/clients` odgovora) |
| `MCP-Protocol-Version` | `2026-07-28` |
| `Mcp-Method` | mora poklapati `body.method` (npr. `tools/call`) |
| `Mcp-Name` | za `tools/call`, mora poklapati `body.params.name` |
| `Accept` | `application/json, text/event-stream` |

Telo mora imati `params._meta` sa `io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientInfo`, `io.modelcontextprotocol/clientCapabilities`.

**Primer — `tools/call` za `search_products`:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_products",
    "arguments": { "destinationCity": "Kopaonik", "adults": 2 },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { "name": "chatgpt-connector", "version": "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

**Odgovor `200`:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "[...]" }],
    "structuredContent": { "results": [ /* isti oblik kao M5 GET /sales/search */ ] }
  }
}
```

### Pet alata (M16 spec poglavlje 2)

| Alat | Zahteva | Napomena |
| :---- | :---- | :---- |
| `search_products` | `READ_ONLY` | `{type?, destinationCountry?, destinationCity?, stayFrom?, stayTo?, adults?, children?, lang?}` — isti rezultati kao M8 |
| `create_quote` | `READ_WRITE` | `{items: [{productId, stayFrom, stayTo, occupancy:{adults,children}}], contractTermsAccepted: true}` — `contractTermsAccepted` obavezno `true` (klijent je prethodno pokazao uslove korisniku) |
| `confirm_booking` | `READ_WRITE` | `{quoteId, buyerName, buyerType, buyerTaxId?, guests?}` — nepotpuni podaci gosta se odbijaju sa jasnom porukom pre poziva M5 |
| `get_booking_status` | `READ_ONLY` | `{bookingId}` — maskiran prikaz (bez `supplierReference`/`baseCost`/`markupRuleId`), isto kao B2C |
| `cancel_booking` | `READ_WRITE` | `{bookingId, reason?}` |

Poziv alata koji zahteva `READ_WRITE` sa `READ_ONLY` kredencijalom vraća `isError: true` sa porukom koja objašnjava šta treba odobriti — ne tihu grešku.

### Greške

| HTTP status | Kada |
| :---- | :---- |
| `401` | Bez Bearer tokena, nevažeći/nepoznat kredencijal, ili `status != ACTIVE` |
| `429` | Prekoračen `rate_limit_per_minute` (M16 spec §6) |
| `200` sa `result.isError: true` | Neispravni argumenti alata (zod), nedovoljan `access_level`, ili poslovna greška M5 servisa (npr. nema kapaciteta) — JSON-RPC "uspešan" transport nivo, greška je u sadržaju rezultata |
