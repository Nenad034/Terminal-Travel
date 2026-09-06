# API dokumentacija — M23 (Znanje)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski, sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md` — ovaj dokument ga ne zamenjuje.

**REST prefiks:** `/api/v1/knowledge`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu, osim `GET /knowledge/public/:shareToken` (javno, neautentifikovano — spec poglavlje 5). Za razliku od M21, M23 nema `audience` segmentaciju — isti sadržaj je vidljiv internom timu i subagentima (`SUBAGENT_ADMIN`), spec poglavlje 3.1.

---

## Članci — `/knowledge/articles`

### GET /knowledge/articles

Zahteva `M23/article/VIEW`. Ko ima i `M23/article/EDIT` vidi punu listu (svi statusi); ostali vide samo `status=PUBLISHED`.

**Query parametri (opciono):** `lang` (`sr`/`en`/`hr`/`sl`/`es`/`de`/`ru`/`fr` — fallback traženi→en→sr).

**Odgovor `200`:**
```json
[
  {
    "id": "a1b2...",
    "subjectType": "DESTINATION",
    "destinationCountry": "Grčka",
    "destinationCity": "Solun",
    "status": "PUBLISHED",
    "generatedBy": "AI",
    "approvedBy": "u-direktor-1",
    "shareToken": "9f2c...-token",
    "lastRefreshedAt": "2026-08-16T06:00:00.000Z",
    "nextRefreshDueAt": "2026-09-15T06:00:00.000Z",
    "publishedAt": "2026-08-16T06:05:00.000Z",
    "translation": { "languageCode": "sr", "title": "Solun — kratak vodič", "body": "Grad poznat po..." },
    "translations": [ { "languageCode": "en", "title": "Thessaloniki — short guide", "body": "..." } ]
  }
]
```

### POST /knowledge/articles

Zahteva `M23/article/EDIT`. Kreira `Article(status=DRAFT)`. Telo je grana na dva puta — oba opciona, mogu se kombinovati sa praznim kreiranjem:

- **Ručan unos** — `translations[]` upisuje prevode direktno (isti oblik kao `ArticleTranslation`).
- **AI istraživanje** (spec poglavlje 4) — `research{}` pokreće `KnowledgeResearchService.researchFromProvidedText`, koje kreira `ArticleSource(status=CANDIDATE)` i `ArticleRevision(trigger=INITIAL_CREATION, status=PENDING_REVIEW)`.

**Zahtev (AI istraživanje, PRODUCT):**
```json
{
  "subjectType": "PRODUCT",
  "productId": "prod-123",
  "research": {
    "sourceUrl": "https://hotel-primer.com",
    "sourceType": "HOTEL_OFFICIAL_WEBSITE",
    "rawText": "Naš hotel nudi besplatan Wi-Fi, bazen i parking. Doručak je uključen u cenu."
  }
}
```

**Odgovor `201`:** isti oblik kao red u listi iznad (`status=DRAFT`, bez prevoda dok se revizija ne odobri preko `POST /articles/:id/revisions/:revisionId/approve`). Za `subjectType=PRODUCT`, ovaj poziv dodatno kreira M2 `ProductContentImport(origin=M23_RESEARCH)` — vidi `docs/api/M2-katalog-proizvoda.md` (ako postoji) ili `docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` poglavlje 3.3a.

**Zahtev (ručan unos, DESTINATION):**
```json
{
  "subjectType": "DESTINATION",
  "destinationCountry": "Grčka",
  "destinationCity": "Solun",
  "translations": [{ "languageCode": "sr", "title": "Solun — kratak vodič", "body": "Grad poznat po..." }]
}
```

### GET /knowledge/articles/:id / PATCH /knowledge/articles/:id

Isti obrazac kao lista iznad za `GET`. `PATCH` (zahteva `M23/article/EDIT`) menja `status` (osim ka `PUBLISHED` — to ide isključivo preko `POST .../publish`), `destinationCountry`/`destinationCity`.

### POST /knowledge/articles/:id/research

Istraživanje nad POSTOJEĆIM člankom (dodato M17 Faza 7/16.8.2026 — ranije `researchFromProvidedText` bio dostupan samo pri kreiranju preko `POST /knowledge/articles`). Zahteva `M23/article/EDIT`.

Bez `revisionId` pravi novu `ArticleRevision(status=PENDING_REVIEW)` (isto ponašanje kao istraživanje pri kreiranju). Sa `revisionId` popunjava POSTOJEĆI `PENDING_REVIEW` red umesto da pravi nov — tipičan slučaj je prazan `SCHEDULED_REFRESH` placeholder koji `KnowledgeRefreshService` (dnevni posao) kreira kad dospe rok osvežavanja (spec poglavlje 4c); status revizije nikad izlazi iz `PENDING_REVIEW` na ovom putu. `404` ako `revisionId` ne pripada članku, `400` ako revizija više nije `PENDING_REVIEW` (npr. već `APPROVED`).

**Zahtev (nova revizija):**
```json
{
  "sourceUrl": "https://hotel-x.example.com",
  "sourceType": "HOTEL_OFFICIAL_WEBSITE",
  "rawText": "Hotel X ima besplatan Wi-Fi, bazen i parking. Doručak je uključen."
}
```

**Zahtev (popuni postojeći SCHEDULED_REFRESH placeholder):**
```json
{
  "sourceUrl": "https://hotel-x.example.com/news",
  "sourceType": "HOTEL_OFFICIAL_WEBSITE",
  "rawText": "Ažuriran opis — hotel je dodao novi spa centar u 2026.",
  "revisionId": "rev-placeholder-1"
}
```

**Odgovor `201`:**
```json
{
  "source": { "id": "src-2", "articleId": "a1b2...", "status": "CANDIDATE" },
  "revision": { "id": "rev-placeholder-1", "articleId": "a1b2...", "status": "PENDING_REVIEW", "trigger": "SCHEDULED_REFRESH" }
}
```

### POST /knowledge/articles/:id/publish

Zahteva `M23/article/PUBLISH`. **Nikad `actor_type=AI_AGENT`** — provereno na nivou koda (`assertHumanActor`), ne samo dozvolom. Generiše `shareToken` pri PRVOM prelasku u `PUBLISHED` (ista vrednost posle toga, spec poglavlje 5). Vraća `400` ako članak nema nijedan `ArticleTranslation`.

**Odgovor `201`:**
```json
{ "id": "a1b2...", "status": "PUBLISHED", "approvedBy": "u-direktor-1", "shareToken": "9f2c...-token", "publishedAt": "2026-08-16T06:05:00.000Z" }
```

---

## Izvori — `/knowledge/articles/:articleId/sources`

### GET / POST /knowledge/articles/:articleId/sources

`GET` zahteva `M23/article/VIEW`. `POST` (ručno predlaganje, zahteva `M23/article/EDIT`) kreira `ArticleSource(status=CANDIDATE)`.

**Zahtev (POST):**
```json
{ "url": "https://tourism-board.example.gov", "sourceType": "GOVERNMENT_OR_TOURISM_BOARD" }
```

`sourceType` prihvata ISKLJUČIVO `HOTEL_OFFICIAL_WEBSITE`, `HOTEL_SOCIAL_MEDIA`, `GOVERNMENT_OR_TOURISM_BOARD` (spec poglavlje 4a) — bilo koja druga vrednost vraća `400`.

### POST /knowledge/articles/:articleId/sources/:sourceId/approve / .../reject

Zahteva `M23/article-source/APPROVE`. **Nikad `actor_type=AI_AGENT`.** `approve` postavlja `status=APPROVED`, `approvedBy`, `approvedAt`.

**Odgovor `201` (approve):**
```json
{ "id": "s1...", "status": "APPROVED", "approvedBy": "u-direktor-1", "approvedAt": "2026-08-16T09:00:00.000Z" }
```

---

## Revizije — `/knowledge/articles/:articleId/revisions`

### GET /knowledge/articles/:articleId/revisions

Zahteva `M23/article/VIEW`.

### POST .../revisions/:revisionId/approve

Zahteva `M23/article-revision/APPROVE`. **Nikad `actor_type=AI_AGENT`.** Odbija sa `400` ako bilo koji `ArticleSource` referenciran u `sourceIds` nije `APPROVED` (spec poglavlje 4b/9). Uspešno odobrenje upisuje `proposedTranslations` kao stvarne `ArticleTranslation` redove (zamenjuje postojeće po jeziku), postavlja `Article.lastRefreshedAt=now()` i `nextRefreshDueAt = lastRefreshedAt + 30 dana`.

**Odgovor `201`:**
```json
{ "id": "r1...", "status": "APPROVED", "reviewedBy": "u-direktor-1", "reviewedAt": "2026-08-16T09:05:00.000Z" }
```

### POST .../revisions/:revisionId/reject

Isti guard kao `approve`. Postavlja `status=REJECTED` — **ne menja `Article`** (spec poglavlje 2.4/9).

---

## AI asistent — `/knowledge`

### POST /knowledge/ask

Zahteva `M23/article/VIEW`. Pretražuje isključivo `ArticleTranslation` gde `Article.status=PUBLISHED`. Jezički fallback traženi→en→sr.

**Zahtev:**
```json
{ "question": "Da li hotel X ima bazen za decu?", "lang": "sr" }
```

**Odgovor `201`:**
```json
{ "id": "q1...", "answer": "Hotel X — kratak vodič\n\nHotel ima spoljni bazen sa dečijim delom...", "matchedArticleIds": ["a1b2..."], "confidence": "HIGH", "offerResearch": false }
```

Kad `confidence=NONE`, `answer` je `null` i `offerResearch=true` — klijent nudi `POST /questions/:id/request-research`.

### POST /knowledge/questions/:id/feedback

```json
{ "wasHelpful": true }
```

### POST /knowledge/questions/:id/request-research

Samo za sopstveno pitanje (`askedBy=actor`), zahteva `confidence=NONE`. **Implementaciona napomena (v1):** pošto `ArticleRevision.articleId` je obavezan FK i tema bez pogotka nema ciljni `Article`, ovaj poziv NE kreira `ArticleRevision` automatski — upisuje audit trag zahteva, uređivač ručno kreira novi `Article` (`POST /knowledge/articles` sa `research{}`) na osnovu njega (spec poglavlje 3.3).

**Odgovor `201`:**
```json
{ "question": { "id": "q1...", "confidence": "NONE" }, "message": "Zahtev je zabeležen. Za temu koja još nema članak, uređivač treba ručno da kreira novi Article..." }
```

### GET /knowledge/questions

Zahteva `M23/question-log/VIEW`. Query: `confidence` (`HIGH`/`LOW`/`NONE`), `page`, `limit`.

**Straničenje** (dodato 6.9.2026, dok. 39 nalaz 2.2). Odgovor NIJE go niz nego `{ data, total, page, limit, pageCount, hasMore }`, gde je `total` **stvaran** broj redova koji odgovaraju filteru (ne broj vraćenih). Opcioni `?page=` (podrazumevano `1`) i `?limit=` (podrazumevano `50`, najviše `200`); neispravna vrednost vraća `400`, ne ispravlja se tiho. Do tog datuma endpoint je vraćao go niz sa tihom granicom od 200 redova, bez ijedne naznake da ostatak postoji.

Isti razlog kao M21 dnevnik pitanja: ovo je uvid radi kvaliteta sadržaja, gde nepotpuna lista vodi na pogrešan zaključak da pitanja sa niskim poverenjem ima manje nego što ih stvarno ima.

---

## Javni pristup — `/knowledge/public`

### GET /knowledge/public/:shareToken

**Bez autentikacije.** Vraća SAMO jedan `Article` gde `status=PUBLISHED`, bez liste/navigacije (spec poglavlje 5/9). `404` ako token ne postoji ili članak nije objavljen.

**Odgovor `200`:**
```json
{ "id": "a1b2...", "subjectType": "DESTINATION", "shareToken": "9f2c...-token", "translation": { "languageCode": "sr", "title": "Solun — kratak vodič", "body": "..." } }
```

---

## Napomene o AI ovlašćenju (spec poglavlje 6/9)

- `knowledge_question.answer` — `AUTONOMOUS` (čista pretraga objavljenog sadržaja preko `POST /ask`).
- `knowledge_article.research_draft` — `AUTONOMOUS` (`model_tier=STANDARD`, priprema `ArticleRevision` nacrt iz odobrenih izvora, ne piše u objavljen sadržaj).
- `knowledge_article.publish`, `article-source.approve`, `article-revision.approve` — `NEVER_AUTONOMOUS`. Pokušaj bilo koje od ove tri radnje sa nalogom čiji je `account_type=AI_AGENT` vraća `403` (`assertHumanActor`, `apps/api/src/modules/m23-znanje/ai-agent-guard.ts`) — provereno na nivou koda, ne samo dozvolom.

## Glasovni modalitet — OTVORENA STAVKA

Za razliku od ranije verzije ove specifikacije, glasovni (govorni) unos za `POST /ask` **ne postoji** u ovom prolazu — čeka izbor STT/TTS tehnologije (potvrđeno sa vlasnikom, avgust 2026). Vidi `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md` poglavlje 6.6.
