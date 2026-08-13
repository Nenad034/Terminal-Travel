# API dokumentacija — M14 (Podrška / Helpdesk)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela (M17), M8 sajt, M7 B2B portal — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M14-helpdesk/14-SPECIFIKACIJA-M14-HELPDESK.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/helpdesk`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Dozvole:** `M14/ticket/VIEW`, `CREATE`, `RESPOND`. Gost i `SUBAGENT_ADMIN` dobijaju samo `VIEW`/`CREATE`, uvek ograničeno na sopstvene tikete — obim nije poseban ključ dozvole, sprovodi se u servisu (ownership provera preko `requester_client_account_id`, izveden iz `User.linked_profile_id`). Interni tim (Vlasnik/Direktor/Sales Manager/Prodajni agent) dobija sve tri, bez ograničenja obima.

---

## Tiketi (`Ticket`)

### GET /helpdesk/tickets

Lista. Interni tim vidi sve; Gost/`SUBAGENT_ADMIN` vide isključivo sopstvene (filtrirano po pozivaocu, nema query parametara za obilazak ove provere).

**Odgovor `200`:**
```json
[
  {
    "id": "tk-1",
    "ticketNumber": "HD-2026-000001",
    "requesterClientAccountId": "ca-1",
    "requesterType": "GUEST",
    "relatedBookingId": null,
    "subject": "Pitanje o rezervaciji",
    "category": "REZERVACIJA",
    "priority": "NORMAL",
    "status": "OPEN",
    "channel": "SITE_FORM",
    "sourceEmailThreadId": null,
    "assignedTo": null,
    "zzpResponseDeadline": null,
    "zzpEscalatedAt": null,
    "refundDecision": false,
    "createdAt": "2026-08-13T10:00:00.000Z",
    "updatedAt": "2026-08-13T10:00:00.000Z",
    "resolvedAt": null
  }
]
```

### POST /helpdesk/tickets

**Zahtev (Gost/subagent — `requesterClientAccountId` iz tela se ignoriše, uvek se prepisuje na sopstveni nalog):**
```json
{
  "requesterType": "GUEST",
  "relatedBookingId": "bk-9",
  "subject": "Kada stiže vaučer?",
  "category": "REZERVACIJA",
  "channel": "SITE_FORM"
}
```

**Zahtev (interni tim, u ime gosta koji je zvao telefonom):**
```json
{
  "requesterClientAccountId": "ca-1",
  "requesterType": "STAFF_ON_BEHALF",
  "subject": "Reklamacija na smeštaj",
  "category": "REKLAMACIJA",
  "priority": "HIGH",
  "channel": "PHONE"
}
```

**Odgovor `201`:** isti oblik kao GET stavka. `zzpResponseDeadline` je automatski popunjeno na `created_at + 8 dana` kad je `category = REKLAMACIJA` (§3.1 Zakon o zaštiti potrošača), inače `null`. Dozvola: `M14/ticket/CREATE`.

### GET /helpdesk/tickets/:id

Detalji + `relatedBooking` (kontekst uživo iz M5, bez dupliranja u samom `Ticket` zapisu — `null` ako `relatedBookingId` nije popunjeno ili rezervacija ne postoji):

```json
{
  "id": "tk-1",
  "...": "...",
  "relatedBooking": { "id": "bk-9", "bookingNumber": "TT-2027-000482", "status": "CONFIRMED" }
}
```

404 (ne 403) ako pozivalac nije interni tim i tiket nije njegov — ne otkriva postojanje tuđeg tiketa.

### PATCH /helpdesk/tickets/:id

Isključivo interni tim (`M14/ticket/RESPOND` — Gost/subagent nemaju ovu dozvolu). Sva polja opciona.

**Zahtev — rešavanje reklamacije uz odluku o povraćaju (§3.2, zatvara otvoreno pitanje iz §8):**
```json
{ "status": "RESOLVED", "refundDecision": true }
```

Kad `status` pređe u `RESOLVED` **i** `refundDecision` je (ili postaje) `true`, M14 emituje `ticket.resolved_with_refund` preko Event Bus-a (referencira `relatedBookingId`). M10 se pretplaćuje i automatski priprema **DRAFT** storno fiskalni dokument (`FiscalDocumentsService.prepareStornoDraftForBooking`) — vidi §3.2 specifikacije. Slanje storno dokumenta i dalje zahteva ljudsku potvrdu (`POST /finance/fiscal-documents/:id/submit`, `M10/fiscal-document/SUBMIT`) — M14/M10 automatika se zaustavlja na nacrtu.

Emituje se samo na **tranziciji** u `RESOLVED` (ne pri svakom PATCH-u nad već rešenim tiketom) — ne pravi duplikat nacrta.

**Odgovor `200`:** isti oblik kao GET.

---

## Poruke (`TicketMessage`)

### GET /helpdesk/tickets/:id/messages

Interni tim vidi sve poruke, uključujući `isInternalNote: true`. Gost/`SUBAGENT_ADMIN` **nikad** ne vide interne beleške, čak i sa `M14/ticket/VIEW` nad samim tiketom — filtrirano u servisu, ne u DTO serijalizaciji.

```json
[
  { "id": "msg-1", "ticketId": "tk-1", "senderType": "REQUESTER", "senderId": "ca-1", "body": "Kada stiže vaučer?", "isInternalNote": false, "sentBy": null, "createdAt": "..." },
  { "id": "msg-2", "ticketId": "tk-1", "senderType": "STAFF", "senderId": "u-7", "body": "Vaučer stiže danas do 18h.", "isInternalNote": false, "sentBy": "u-7", "createdAt": "..." }
]
```

### POST /helpdesk/tickets/:id/messages

Dozvola: `M14/ticket/CREATE` (pokriva i Gost/`SUBAGENT_ADMIN` sopstveni odgovor). Gost/subagent smeju isključivo `senderType: "REQUESTER"`, bez `isInternalNote: true` — pokušaj `STAFF`/`AI_DRAFT`/interne beleške vraća `403`.

**Zahtev — STAFF poruka (smatra se odmah poslatom, `sentBy` = pozivalac):**
```json
{ "senderType": "STAFF", "body": "Primili smo vaš zahtev, rešavamo." }
```

**Zahtev — AI nacrt (§4 — `sentBy` NIKAD popunjeno pri kreiranju, bez obzira šta je prosleđeno):**
```json
{ "senderType": "AI_DRAFT", "body": "Nacrt: povraćaj od 100 EUR biće izvršen u roku od 14 dana." }
```
**Odgovor `201`:** `{ "id": "msg-3", "...": "...", "sentBy": null }`.

### POST /helpdesk/tickets/:id/messages/:messageId/send

Jedini put kroz koji `AI_DRAFT` poruka dobija `sentBy` — isključivo ljudski nalog (`M14/ticket/RESPOND`, Gost/subagent dobijaju `403`). Vraća `400` ako je poruka već poslata.

**Odgovor `201`:** `{ "id": "msg-3", "...": "...", "sentBy": "u-7" }`.

---

## Automatska eskalacija reklamacija (§3.1, bez API poziva)

Svaki dan (`M14AlarmsService`, `@Cron`) sistem proverava sve `REKLAMACIJA` tikete u statusu `OPEN`/`IN_PROGRESS` bez `zzp_escalated_at`. Ako 5 dana od `created_at` prođe bez ijedne `TicketMessage` sa `sender_type = STAFF` i popunjenim `sent_by`, sistem:
1. Popunjava `zzp_escalated_at`.
2. Emituje `M14 ticket_zzp_escalated` preko Event Bus-a (informativna eskalacija ka Vlasniku/Direktoru — nivo "Autonomno", M18 još ne postoji kao poseban modul koji ovo prikazuje/šalje email, isti obrazac kao M10 `payment_deadline_missed`).

Ovo ne menja `status` niti sprovodi pravnu posledicu (sniženje cene/raskid) — samo obezbeđuje da rok nikad tiho ne prođe neprimećen (§3.1 specifikacije).
