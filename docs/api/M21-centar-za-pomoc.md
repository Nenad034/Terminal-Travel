# API dokumentacija — M21 (Centar za pomoć)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M21-centar-za-pomoc/23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md` — ovaj dokument ga ne zamenjuje.

**REST prefiks:** `/api/v1/help`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (sve rute ovog dokumenta idu isključivo kroz `JwtAuthGuard`). Publika (`audience_context`) se izvodi iz naloga koji poziva (`User.account_type`, i za `GUEST` naloge — uz proveru M6 `ClientAccount.account_type = LEGAL_ENTITY`), nikad iz tela zahteva ili query parametra. Publika `PUBLIC_GUEST` (avgust 2026) pokriva i `GUEST` naloge bez `LEGAL_ENTITY` veze (`INDIVIDUAL` ili nepovezan) — svaki od ovih endpoint-a i dalje zahteva stvaran, prijavljen nalog.

**Napomena — potpuno anonimni pozivi:** M15 `OmnisearchService` (B2C_SITE kanal) poziva `HelpAssistantService.ask()` IN-PROCESS, van ovog HTTP kontrolera, sa `userId=null` za potpuno anonimnog posetioca sajta bez ijednog naloga — taj put nema HTTP rutu i nije pokriven `JwtAuthGuard`-om (servis je sam bezbednosna granica, vidi M21 spec poglavlje 5.2). Nema javnog/neautentifikovanog `POST /help/ask` — anoniman pristup Centru za pomoć ide isključivo preko `POST /api/v1/ai-orchestration/omnisearch` (M15, `docs/api/M15-ai-orkestracija.md`), ne direktno kroz ovaj prefiks.

---

## Članci — `/help/articles`

### GET /help/articles

Lista objavljenih (`status=PUBLISHED`) članaka vidljivih pozivaocu. Filtriranje po publici je automatsko, izvedeno iz naloga — nema `audience` query parametra. `is_critical_example` članci se vraćaju prvi (spec poglavlje 4).

**Query parametri (opciono):** `relatedModule` (npr. `M5`), `isCriticalExample` (`true`/`false`), `lang` (`sr`/`en`/`hr`/`sl`/`es`/`de`/`ru`/`fr` — fallback traženi→en→sr), `status` (`DRAFT`/`PENDING_APPROVAL`/`PUBLISHED`/`ARCHIVED`, dodato M17 Faza 7/16.8.2026).

`status` je namenjen uredniku (npr. panel `/pomoc`): kad pozivalac ima `M21/article:<segment>/EDIT` za bar jedan audience segment, vraća članke traženog statusa ograničene na segmente za koje ima `EDIT` (ne tuđe `DRAFT`-ove). Bez `EDIT` dozvole ni za jedan segment, parametar se tiho ignoriše — ponašanje ostaje identično kao bez njega (samo `PUBLISHED`, izvedena publika), bezbedno za AI asistenta koji ga nikad ne šalje.

**Zahtev (uređivač traži sopstvene nacrte):**
```
GET /api/v1/help/articles?status=DRAFT
```

**Odgovor `200`:**
```json
[
  {
    "id": "a1b2...",
    "slug": "kako-obraditi-otkazivanje",
    "audience": ["STAFF"],
    "relatedModule": "M5",
    "isCriticalExample": true,
    "status": "PUBLISHED",
    "generatedBy": "HUMAN",
    "approvedBy": "u-direktor-1",
    "publishedAt": "2026-08-15T10:00:00.000Z",
    "translation": { "languageCode": "sr", "title": "Kako obraditi otkazivanje sa delimičnim povraćajem", "body": "1. Otvori rezervaciju u M5...\n2. ..." }
  }
]
```

Pojedinačni (`INDIVIDUAL`) `GUEST` nalog uvek dobija `[]` (van obima v1, spec poglavlje 1).

### POST /help/articles

Kreira nacrt (`status=DRAFT`, `generatedBy=HUMAN`). Zahteva `M21/article:<segment>/EDIT` za SVAKI segment u `audience` (npr. `audience: ["STAFF","SUBAGENT"]` zahteva i `article:staff/EDIT` i `article:subagent/EDIT`).

**Zahtev:**
```json
{ "slug": "kako-obraditi-otkazivanje", "audience": ["STAFF"], "relatedModule": "M5", "isCriticalExample": true }
```

**Odgovor `201`:** isti oblik kao red u listi iznad (bez `translation` — dodaje se posebno).

### GET /help/articles/:id

Uređivač (ima `EDIT` za bar jedan audience segment članka) vidi članak u bilo kom statusu. Ostali vide samo ako je `PUBLISHED` i njihova publika se poklapa — inače `404` (ne `403`, isto načelo kao M19 razgovori: nevidljivo, ne samo zabranjeno).

Odgovor uz `translation` (rešen fallback — traženi jezik→en→sr) uključuje i `translations`: pun niz svih postojećih `ArticleTranslation` redova za članak (dodato M17 Faza 7/16.8.2026 — jedan poziv umesto ranijeg poziva po jeziku).

**Odgovor `200`:**
```json
{
  "id": "a1b2...",
  "slug": "kako-obraditi-otkazivanje",
  "audience": ["STAFF"],
  "status": "DRAFT",
  "translation": { "languageCode": "sr", "title": "Kako obraditi otkazivanje", "body": "..." },
  "translations": [
    { "languageCode": "sr", "title": "Kako obraditi otkazivanje", "body": "..." },
    { "languageCode": "en", "title": "How to handle a cancellation", "body": "..." }
  ]
}
```

### PATCH /help/articles/:id

Izmena polja i/ili prelazak statusa. Prelazak u `PUBLISHED` zahteva `M21/article:<segment>/PUBLISH` (isključivo Direktor/Vlasnik) i automatski popunjava `approved_by` sa pozivaocem — nikad se ne prima kroz telo, nikad AI.

**Zahtev (objava):**
```json
{ "status": "PUBLISHED" }
```

**Odgovor `200`:**
```json
{ "id": "a1b2...", "status": "PUBLISHED", "approvedBy": "u-direktor-1", "publishedAt": "2026-08-15T10:00:00.000Z", "...": "..." }
```

### PUT /help/articles/:id/translations

Upsert prevoda (isti obrazac kao M2/M12). Zahteva `EDIT` za sve audience segmente članka.

**Zahtev:**
```json
{ "languageCode": "en", "title": "How to handle a partial-refund cancellation", "body": "1. Open the booking in M5...\n2. ..." }
```

---

## AI asistent — `/help`

### POST /help/ask

Glavni upit AI asistentu. Publika se izvodi iz naloga; asistent pretražuje isključivo `PUBLISHED` članke vidljive toj publici — nikad sadržaj drugih publika, bez obzira na formulaciju pitanja (spec poglavlje 5.2).

**Zahtev:**
```json
{ "question": "Kako obrađujem otkazivanje sa delimičnim povraćajem?", "lang": "sr" }
```

**Odgovor `201` (pouzdan odgovor):**
```json
{
  "id": "q1...",
  "answer": "Otvori rezervaciju u M5, izaberi \"Otkaži sa delimičnim povraćajem\"...",
  "matchedArticleIds": ["a1b2..."],
  "confidence": "HIGH",
  "offerEscalation": false
}
```

**Odgovor `201` (bez pouzdanog odgovora):**
```json
{ "id": "q2...", "answer": null, "matchedArticleIds": [], "confidence": "NONE", "offerEscalation": true }
```

Nalog bez rešive publike uopšte (npr. `SUPPLIER_CONTACT`, `AI_AGENT`) dobija `403` sa uputstvom da koristi M14. `INDIVIDUAL` `GUEST` nalog (i nepovezan `GUEST`) VIŠE ne dobija `403` (avgust 2026) — resolveHelpAudience ga rešava u `PUBLIC_GUEST` i asistent odgovara iz uže FAQ liste za tu publiku.

### POST /help/questions/:id/feedback

👍/👎 na odgovor. Samo autor pitanja.

```json
{ "wasHelpful": false }
```

### POST /help/questions/:id/escalate

Korisnikova potvrda eskalacije sopstvenog pitanja → kreira M14 `Ticket` (`channel=HELP_CENTER`) sa pitanjem već upisanim u prvu (`REQUESTER`) poruku. Samo autor pitanja; `400` ako je već eskalirano.

**Odgovor `201`:**
```json
{
  "ticket": { "id": "t1...", "ticketNumber": "HD-2026-000042", "channel": "HELP_CENTER", "status": "OPEN", "...": "..." },
  "question": { "id": "q2...", "escalatedTicketId": "t1...", "...": "..." }
}
```

### GET /help/questions

Istorija pitanja (`M21/question-log/VIEW` — HR/Direktor/Vlasnik), radi kvaliteta sadržaja i bezbednosnog pregleda.

**Query parametri (opciono):** `audienceContext` (`STAFF`/`SUBAGENT`/`BUSINESS_CLIENT`/`PUBLIC_GUEST`), `confidence` (`HIGH`/`LOW`/`NONE`).

---

## Predlozi novih članaka — `/help/suggestions`

Nastaju automatski (dnevni cron, 6h) kad se nagomilaju ponovljena `NONE`/`LOW`/negativno-ocenjena pitanja na istu temu (spec poglavlje 5.4, prag 3+ u 30 dana — podešava se empirijski).

### GET /help/suggestions

Predlozi na čekanju (`status=PENDING_APPROVAL`). Zahteva `M21/suggestion/APPROVE`.

**Odgovor `200`:**
```json
[
  {
    "id": "s1...",
    "basedOnQuestionIds": ["q3...", "q4...", "q5..."],
    "draftTitle": "Kako se prati povraćaj depozita",
    "draftBody": "Nekoliko zaposlenih je pitalo o postupku povraćaja depozita...",
    "status": "PENDING_APPROVAL",
    "createdAt": "2026-08-16T06:00:00.000Z"
  }
]
```

### PATCH /help/suggestions/:id

Odobri ili odbij. Zahteva `M21/suggestion/APPROVE`.

**Zahtev (odobri):**
```json
{ "decision": "APPROVE" }
```

**Odgovor `200`:** `APPROVE` kreira stvaran `HelpArticle` u statusu `PENDING_APPROVAL` — **NE `PUBLISHED`**, i dalje čeka sopstveni korak objavljivanja (`PATCH /help/articles/:id`, gore).
```json
{
  "suggestion": { "id": "s1...", "status": "APPROVED", "reviewedBy": "u-hr-1", "reviewedAt": "2026-08-16T08:00:00.000Z" },
  "createdArticle": { "id": "a9...", "status": "PENDING_APPROVAL", "generatedBy": "AI", "...": "..." }
}
```

**Zahtev (odbij):**
```json
{ "decision": "REJECT" }
```
```json
{ "suggestion": { "id": "s1...", "status": "REJECTED" }, "createdArticle": null }
```

---

## Bezbednosno praćenje (bez sopstvenog endpoint-a)

Svako pitanje/odgovor upisuje `AuditLogEntry` (`actor_type=AI_AGENT`, `module=M21`). Neuobičajena učestalost pitanja od jednog naloga u kratkom prozoru, ili sadržaj koji liči na pokušaj zaobilaženja ograde (npr. "zanemari prethodna uputstva"), generiše M18 `HealthSignal` (`signal_type=HELP_AGENT_ABUSE_PATTERN`, `security_category=API_ABUSE`) — vidljivo preko `GET /ops/health-signals` (M18), ne kroz ovaj modul.
