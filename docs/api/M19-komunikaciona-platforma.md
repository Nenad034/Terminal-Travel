# API dokumentacija — M19 (Komunikaciona platforma)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` — ovaj dokument ga ne zamenjuje.

**REST prefiks:** `/api/v1/chat`
**WebSocket namespace:** `/ws/chat`
**Autentikacija:** `Authorization: Bearer <JWT>` na REST pozivima; isti access token se šalje kao `auth.token` (ili `Authorization: Bearer <JWT>` header) pri WS handshake-u. Interni tim (`account_type=STAFF`) i dobavljački kontakt nalozi (`account_type=SUPPLIER_CONTACT`) koriste isti protokol — vidljivost se sprovodi po učesniku (`ConversationParticipant`), ne po tipu naloga.

---

## REST — razgovori i poruke

### GET /chat/conversations

Lista razgovora gde je pozivalac učesnik (`ConversationParticipant`) — isto za STAFF i SUPPLIER_CONTACT naloge, samo prirodno različit skup zbog članstva.

**Odgovor `200`:**
```json
[
  {
    "id": "c1a2...",
    "type": "DIRECT",
    "name": null,
    "supplierId": null,
    "createdAt": "2026-08-15T09:00:00.000Z",
    "lastReadAt": null,
    "lastMessage": { "id": "m1...", "senderId": "u1...", "body": "Zdravo!", "sentAt": "2026-08-15T09:05:00.000Z" }
  }
]
```

### POST /chat/conversations

Kreira `DIRECT`/`GROUP` (zahteva `M19/conversation/CREATE`) ili `EXTERNAL_SUPPLIER` (zahteva `M19/supplier-conversation/GRANT_ACCESS` — tvorac odmah dobija `SupplierConversationAccess`, spec §9.3/§9.4).

**Zahtev (DIRECT):**
```json
{ "type": "DIRECT", "participantUserIds": ["u2..."] }
```

**Zahtev (GROUP):**
```json
{ "type": "GROUP", "name": "Prodaja", "participantUserIds": ["u2...", "u3..."] }
```

**Zahtev (EXTERNAL_SUPPLIER):**
```json
{ "type": "EXTERNAL_SUPPLIER", "supplierId": "sup-1..." }
```

### GET /chat/conversations/:id

Detalji razgovora + učesnici. `404` (ne `403`) ako pozivalac nije učesnik — razgovor je nevidljiv, ne samo zabranjen (spec §9.2/§9.4).

### GET /chat/conversations/:id/messages

Istorija poruka (učitavanje pri otvaranju ekrana). Obrisane poruke (`deletedAt` postavljen) vraćaju `body: null`.

**Odgovor `200`:**
```json
[
  { "id": "m1...", "conversationId": "c1...", "senderId": "u1...", "body": "Zdravo!", "sentAt": "2026-08-15T09:05:00.000Z", "editedAt": null, "deletedAt": null }
]
```

### POST /chat/conversations/:id/messages

REST fallback za slanje (WS `message.send` je primarni kanal, isto telo). Zahteva `M19/conversation/SEND_MESSAGE` (DIRECT/GROUP) ili `M19/supplier-conversation/SEND_MESSAGE` (EXTERNAL_SUPPLIER, samo uz `SupplierConversationAccess`) za STAFF; SUPPLIER_CONTACT nema poseban ključ dozvole — samo mora biti učesnik (spec §9.6).

**Zahtev:**
```json
{ "body": "Da li imate slobodne sobe za avgust?" }
```

### PATCH /chat/conversations/messages/:messageId

Izmena sopstvene poruke (`editedAt` se popunjava). `403` ako pozivalac nije pošiljalac.

```json
{ "body": "Da li imate slobodne sobe za septembar?" }
```

### DELETE /chat/conversations/messages/:messageId

Meko brisanje sopstvene poruke (`deletedAt`), ne fizičko.

### POST /chat/conversations/:id/read

Označava razgovor kao pročitan (`ConversationParticipant.lastReadAt = now`).

---

## REST — prisustvo

### GET /chat/presence

Zahteva `M19/conversation/VIEW` — namerno isključuje SUPPLIER_CONTACT naloge (nemaju tu dozvolu u katalogu, spec §9.6), bez posebnog case-a u kodu.

**Odgovor `200`:**
```json
[
  { "userId": "u1...", "status": "ONLINE", "lastSeenAt": "2026-08-15T09:10:00.000Z", "updatedAt": "2026-08-15T09:10:00.000Z" }
]
```

---

## REST — dobavljački razgovori (spec poglavlje 9)

### GET /chat/supplier-conversations/:id/access

Zahteva `M19/supplier-conversation/GRANT_ACCESS`.

**Odgovor `200`:**
```json
[
  { "id": "acc1...", "conversationId": "c1...", "userId": "u2...", "grantedBy": "u1...", "grantedAt": "2026-08-15T09:00:00.000Z" }
]
```

### POST /chat/supplier-conversations/:id/access

Dodeljuje pristup zaposlenom — upisuje i `SupplierConversationAccess` i `ConversationParticipant` (§9.4).

```json
{ "userId": "u2..." }
```

### DELETE /chat/supplier-conversations/:id/access/:userId

Oduzima pristup — briše oba reda.

### POST /chat/supplier-conversations/:id/invite-contact

Pokreće portal nalog za `SupplierContact` (spec §9.2 korak 2). Zahteva `M19/supplier-conversation/GRANT_ACCESS`. Kontakt mora pripadati istom dobavljaču kao razgovor (`Conversation.supplierId`), i razgovor sme imati najviše jednog `SUPPLIER_CONTACT` učesnika (§9.3).

**Zahtev:**
```json
{ "supplierContactId": "contact-1..." }
```

**Odgovor `201`:**
```json
{
  "user": { "id": "u5...", "email": "kontakt@hotel.rs", "accountType": "SUPPLIER_CONTACT", "status": "INVITED" },
  "inviteToken": "sirov-token-za-link-aktivacije"
}
```

`inviteToken` je sirov token (1h rok) za `POST /iam/auth/activate` (M1) — slanje email-a sa linkom je van obima ovog endpoint-a, panel ga prikazuje/prosleđuje ručno dok integracija email kanala ne dođe na red (isti obrazac kao `POST /users` u M1).

### POST /chat/supplier-conversations/:id/draft-reply

AI sažetak/nacrt odgovora dobavljaču (spec §9.5). **Nikad ne šalje poruku** — vraća isključivo tekst, zaposleni ga ručno šalje preko `POST /chat/conversations/:id/messages` ili WS `message.send`. Dostupan svakom učesniku razgovora (ista ograda kao slanje poruke).

**Zahtev:**
```json
{ "instruction": "Ponudi popust od 10% za rezervaciju preko 5 noćenja" }
```

**Odgovor `201` (uspeh):**
```json
{ "draft": "Poštovani, u vezi Vašeg upita — možemo ponuditi popust od 10% za boravak od 5 i više noćenja. Molimo potvrdu termina." }
```

**Odgovor `201` (nema prepiske ili AI nedostupan — graceful degradation, isti obrazac kao M15 omnisearch):**
```json
{ "draft": null, "note": "AI nacrt trenutno nije dostupan (ANTHROPIC_API_KEY nije podešen na serveru)." }
```

---

## WebSocket — `/ws/chat`

Handshake nosi isti JWT kao REST (`socket.handshake.auth.token` ili `Authorization` header). Nevažeći/nedostajući token → server odmah zatvara konekciju. Po uspešnom povezivanju, socket se automatski pridružuje sobama (`conversationId`) za svaki razgovor gde je korisnik učesnik, i `PresenceStatus` prelazi u `ONLINE` (emituje se `presence.updated` svima).

### Klijent → server

| Event | Telo | Opis |
| :---- | :---- | :---- |
| `message.send` | `{ conversationId, body }` | Upisuje poruku preko istog `ConversationsService.createMessage` puta kao REST fallback, pa emituje `message.new` sobi. |
| `typing.start` | `{ conversationId }` | Efemerno, ne piše u bazu — prosleđuje se ostalima u sobi. |
| `typing.stop` | `{ conversationId }` | Isto, suprotan signal. |
| `presence.away` | — | Postavlja `PresenceStatus.status = AWAY`. |
| `presence.active` | — | Vraća `PresenceStatus.status = ONLINE`. |

### Server → klijent

| Event | Telo | Kada |
| :---- | :---- | :---- |
| `message.new` | `Message` zapis | Nova poruka u sobi gde je socket član (uključujući sopstvenu, poslatu preko drugog uređaja). |
| `message.error` | `{ conversationId, error }` | `message.send` je odbijen (npr. niste učesnik, nemate dozvolu). |
| `typing.started` / `typing.stopped` | `{ conversationId, userId }` | Prosleđeno svima u sobi osim pošiljaocu signala. |
| `presence.updated` | `{ userId, status }` | Emituje se svima (ne samo sobi) pri connect/disconnect/eksplicitnom signalu. |

Ako primalac nije trenutno povezan (bez otvorenog socket-a), poruka ostaje sačuvana u `Message` i stiže mu pri sledećem povezivanju (soba se automatski pridružuje na `handleConnection`) — dodatno, mobilni klijent dobija Expo push preko M9 (Event Bus `M19/message.recipient_offline`, isporuka se ne prati kroz ovaj WS ugovor).
