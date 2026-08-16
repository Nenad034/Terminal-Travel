# API dokumentacija — M22 (Email/Inbox platforma)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md` — ovaj dokument ga ne zamenjuje.

**REST prefiks:** `/api/v1/email`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu. Svi endpoint-i su namenjeni internom timu (`User.accountType = STAFF`) — M22 nema spoljnu/gost publiku.

**Dvoslojna kontrola pristupa (spec §2.2):** svaki endpoint pod `/email/threads` proverava prvo katalog dozvolu (`M22/email-thread/VIEW` ili `/REPLY` ili `/CONVERT_TO_TICKET` — "ova vrsta naloga uopšte sme da pokuša"), pa onda `MailboxAccess` red za konkretno sanduče niti ("baš OVO sanduče"). Nedostatak MailboxAccess vraća `403`, čak i za Vlasnika/Direktora — pristup sandučetu se NIKAD ne izvodi iz uloge.

---

## Sandučad — `/email/mailboxes`

### GET /email/mailboxes

Lista svih sandučadi (ne filtrirano po pristupu — ovo je administrativni pregled, uža dozvola `M22/mailbox/VIEW`).

**Odgovor `200`:**
```json
[
  { "id": "mb-1", "address": "rezervacije@terminal-travel.rs", "displayName": "Rezervacije", "mailboxType": "SHARED", "ownerUserId": null, "isSupplierUnifiedInbox": false, "status": "ACTIVE" },
  { "id": "mb-2", "address": "dobavljaci@terminal-travel.rs", "displayName": "Dobavljači (jedinstveno)", "mailboxType": "SHARED", "ownerUserId": null, "isSupplierUnifiedInbox": true, "status": "ACTIVE" }
]
```

### POST /email/mailboxes

Kreira sanduče. Zahteva `M22/mailbox/CREATE`. Za `mailboxType: "PERSONAL"` je `ownerUserId` obavezan i vlasnik automatski dobija `MailboxAccess(accessLevel=REPLY)` — nema potrebe da se ručno dodeli sam sebi. Najviše jedno sanduče sme imati `isSupplierUnifiedInbox: true` (M5 spec §8.8).

**Zahtev (deljeno):**
```json
{ "address": "rezervacije@terminal-travel.rs", "displayName": "Rezervacije", "mailboxType": "SHARED", "providerConnectionRef": "mock" }
```

**Zahtev (lično):**
```json
{ "address": "ana.jovanovic@terminal-travel.rs", "displayName": "Ana Jovanović", "mailboxType": "PERSONAL", "ownerUserId": "u-ana-1", "providerConnectionRef": "mock" }
```

**Odgovor `201`:** isti oblik kao red u listi iznad.

### GET /email/mailboxes/:id/access

Lista dodela pristupa za sanduče. Zahteva `M22/mailbox-access/GRANT`.

**Odgovor `200`:**
```json
[ { "id": "acc-1", "mailboxId": "mb-1", "userId": "u-marko-1", "accessLevel": "REPLY", "grantedBy": "u-vlasnik-1", "grantedAt": "2026-08-15T09:00:00.000Z" } ]
```

### POST /email/mailboxes/:id/access

Dodeljuje ili menja nivo pristupa (`VIEW`/`REPLY`) za konkretnog korisnika na konkretnom sandučetu. Zahteva `M22/mailbox-access/GRANT` (Vlasnik/Direktor).

**Zahtev:**
```json
{ "userId": "u-marko-1", "accessLevel": "REPLY" }
```

**Odgovor `201`:** isti oblik kao red u listi iznad.

---

## Niti — `/email/threads`

### GET /email/threads

Lista niti, ograničena isključivo na sandučad za koja pozivalac ima bilo koji nivo `MailboxAccess`. Zahteva `M22/email-thread/VIEW` (katalog nivo).

**Query parametri (opciono):** `mailboxId`, `status` (`OPEN`/`AWAITING_REPLY`/`CLOSED`), `correspondentType` (`GUEST`/`SUBAGENT`/`SUPPLIER`/`OTHER`).

**Odgovor `200`:**
```json
[
  {
    "id": "t-1",
    "mailboxId": "mb-1",
    "subject": "Upit o rezervaciji TT-000123",
    "correspondentType": "GUEST",
    "correspondentClientAccountId": "ca-1",
    "status": "AWAITING_REPLY",
    "lastMessageAt": "2026-08-16T02:14:00.000Z"
  }
]
```

### GET /email/threads/:id

Detalj niti sa svim porukama, hronološki. Zahteva `M22/email-thread/VIEW` + `MailboxAccess` (bilo koji nivo) na sanduče niti.

**Odgovor `200`:**
```json
{
  "id": "t-1",
  "mailboxId": "mb-1",
  "subject": "Upit o rezervaciji TT-000123",
  "correspondentType": "GUEST",
  "status": "AWAITING_REPLY",
  "messages": [
    {
      "id": "m-1",
      "direction": "INBOUND",
      "senderType": "CORRESPONDENT",
      "fromAddress": "gost@primer.rs",
      "body": "Zdravo, da li je slobodan termin za avgust?",
      "aiSummary": "Gost pita da li je termin u avgustu slobodan.",
      "sentBy": null,
      "receivedAt": "2026-08-16T02:14:00.000Z"
    },
    {
      "id": "m-2",
      "direction": "OUTBOUND",
      "senderType": "AI_DRAFT",
      "fromAddress": "rezervacije@terminal-travel.rs",
      "body": "Poštovani, proveravamo raspoloživost i javljamo se uskoro.",
      "sentBy": null,
      "receivedAt": "2026-08-16T02:14:05.000Z"
    }
  ]
}
```

### POST /email/threads/:id/messages

Kreira STAFF poruku (ljudski, autentikovan poziv) — nikad AI_DRAFT. Zahteva `M22/email-thread/REPLY` + `MailboxAccess(REPLY)`. Sa `send: true`, poruka se odmah šalje (`sentBy` popunjeno, provajder adapter pozvan); bez toga ostaje nacrt.

**Zahtev (nacrt):**
```json
{ "body": "Poštovani, termin u avgustu je slobodan." }
```

**Zahtev (odmah pošalji):**
```json
{ "body": "Poštovani, termin u avgustu je slobodan.", "send": true }
```

**Odgovor `201`:**
```json
{ "id": "m-3", "threadId": "t-1", "direction": "OUTBOUND", "senderType": "STAFF", "body": "Poštovani, termin u avgustu je slobodan.", "sentBy": "u-marko-1" }
```

### POST /email/threads/:id/messages/:messageId/send

Čovek potvrđuje postojeći nacrt (AI_DRAFT ili STAFF poruka bez `sentBy`) — ovo je jedini put kako nacrt postaje stvarno poslata poruka. Zahteva `M22/email-thread/REPLY` + `MailboxAccess(REPLY)`. Poruka koja je već poslata (`sentBy` popunjeno) vraća `400`.

**Zahtev:** prazno telo `{}`.

**Odgovor `201`:**
```json
{ "id": "m-2", "sentBy": "u-marko-1", "providerMessageId": "mock-3f2a..." }
```

### POST /email/threads/:id/link-booking

Vezuje nit za M5 rezervaciju (`EmailThread.relatedBookingId`). Zahteva `REPLY`.

**Zahtev:**
```json
{ "bookingId": "b-1" }
```

### POST /email/threads/:id/link-supplier-announcement

Vezuje nit za M5 `SupplierManifest` ili `SupplierChangeNotice` — ISKLJUČIVO upisuje weak-ref polje na niti, nikad ne dotiče M5 status potvrde dobavljača (ta odluka ostaje isključivo `M5/supplier-confirmation/CONFIRM`, ljudski klik u M5). Zahteva `REPLY`.

**Zahtev:**
```json
{ "announcementType": "SUPPLIER_MANIFEST", "announcementId": "sm-1" }
```

### POST /email/threads/:id/convert-to-ticket

Konvertuje nit u M14 tiket (`channel: "EMAIL"`, `sourceEmailThreadId` popunjeno, reciprocno `EmailThread.convertedToTicketId`). Zahteva `M22/email-thread/CONVERT_TO_TICKET` + `MailboxAccess(REPLY)`.

**Zahtev:** prazno telo `{}`.

**Odgovor `201`:**
```json
{
  "thread": { "id": "t-1", "convertedToTicketId": "tk-1" },
  "ticket": { "id": "tk-1", "ticketNumber": "HD-2026-000042", "channel": "EMAIL", "sourceEmailThreadId": "t-1" }
}
```

---

## AI agent (bez sopstvene HTTP rute)

`EmailInboxAgent` (spec §4) se pokreće interno na svaku dolaznu (INBOUND) poruku — sažima sadržaj u `EmailMessage.aiSummary` originalne poruke i priprema posebnu `AI_DRAFT` poruku. Nema poseban REST endpoint u ovom prolazu (ingest dolazne pošte čeka izbor pravog email provajdera, spec §10) — mock provajder nikad ne vraća žive poruke. Nacrt koji pominje cenu/uplatu/otkazivanje/promenu rezervacije NIKAD ne dobija `sentBy` pri kreiranju, bez obzira šta model vrati — sprovedeno i u sistemskoj instrukciji modelu i nezavisno u kodu (§4).
