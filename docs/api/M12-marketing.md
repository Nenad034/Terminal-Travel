# API dokumentacija — M12 (Marketing i sadržajni engine)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela (M17), budući subagentski/AI pristup. Interni oslonac za implementaciju (model podataka, tok odobrenja, izlazni kriterijum) ostaje `docs/moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/marketing`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Dozvole:** `M12/content/VIEW`, `M12/content/CREATE_DRAFT`, `M12/content/APPROVE_PUBLISH` (nikad AI agent — AI nacrti nastaju isključivo kroz interni `product.published` pretplatnik, ne kroz API), `M12/channel-config/VIEW`, `M12/channel-config/EDIT`.

**Napomena o M8 (sajt agencije):** rute `/stranica/:slug` i `/blog/:slug` na javnom sajtu i hvatanje `?ref=` parametra su deo M8 specifikacije (namerno pauziran modul, avgust 2026) — ne postoje u ovoj verziji API-ja. `GET /content?type=STATIC_PAGE&slug=...` je već spreman da ih posluži čim M8 dobije kod.

---

## Sadržaj (`/content`)

### GET /marketing/content

Lista/kalendar — sortirano po `scheduledPublishAt` (rastuće). Query (svi opcioni): `type` (`BLOG_POST`|`SOCIAL_POST`|`EMAIL_NEWSLETTER`|`BANNER`|`STATIC_PAGE`), `status` (`DRAFT`|`PENDING_APPROVAL`|`APPROVED`|`PUBLISHED`), `channel` (`M8_SITE`|`FACEBOOK`|`INSTAGRAM`|`EMAIL`|`MOBILE_PUSH`), `slug`.

**Odgovor `200`:**
```json
[
  {
    "id": "c1a2b3c4-...",
    "productId": null,
    "type": "SOCIAL_POST",
    "slug": null,
    "trackingCode": "K7M2P9QZ",
    "targetChannels": ["FACEBOOK", "INSTAGRAM"],
    "targetTags": null,
    "containsAiGeneratedMedia": false,
    "scheduledPublishAt": "2026-08-20T09:00:00.000Z",
    "status": "PENDING_APPROVAL",
    "generatedBy": "AI",
    "approvedBy": null,
    "publishedAt": null,
    "translations": [
      { "languageCode": "sr", "title": "Novo u ponudi: Hotel Kopaonik", "body": "...", "translationSource": "AI_GENERATED", "isReviewed": false }
    ]
  }
]
```

### POST /marketing/content

Ručno kreiranje (uvek `generatedBy: HUMAN`, `status: DRAFT`). Zahteva `M12/content/CREATE_DRAFT`.

**Telo:**
```json
{
  "type": "STATIC_PAGE",
  "slug": "o-nama",
  "targetChannels": ["M8_SITE"],
  "productId": null,
  "targetTags": null,
  "containsAiGeneratedMedia": false,
  "scheduledPublishAt": null
}
```
`slug` je obavezan za `STATIC_PAGE`/`BLOG_POST` (400 ako nedostaje) i mora biti jedinstven (409 ako je zauzet). `trackingCode` se generiše automatski — klijent ga ne šalje.

**Odgovor `201`** — kreiran `ContentPiece` (isti oblik kao stavka liste iznad).

### GET /marketing/content/:id

Pun zapis, uključujući prevode. `404` ako ne postoji.

### PATCH /marketing/content/:id

Izmena nacrta — dozvoljena samo dok je status `DRAFT`/`PENDING_APPROVAL` (`400` za `APPROVED`/`PUBLISHED`, nepovratna granica). Zahteva `M12/content/CREATE_DRAFT`. Polja: `slug`, `targetChannels`, `targetTags`, `containsAiGeneratedMedia`, `scheduledPublishAt`. `status`/`approvedBy`/`publishedAt` se nikad ne menjaju ovde — isključivo kroz `POST /approve` i cron zakazane objave.

### POST /marketing/content/:id/approve

Ljudsko odobrenje — nepovratna granica ka javnoj objavi. Zahteva `M12/content/APPROVE_PUBLISH` (nikad dodeljeno AI agentu).

Pravila:
- Sadržaj mora imati bar jedan prevod (`400` ako nema).
- Ako je `containsAiGeneratedMedia: true`, bar jedan prevod mora sadržati prepoznatljiv marker transparentnosti (npr. "generisano uz pomoć veštačke inteligencije") u `body` — `400` ako nedostaje (YUTA preporuka, poglavlje 3c specifikacije).
- `BANNER` vezan za konkretan `productId` sa `containsAiGeneratedMedia: true` se uvek odbija (`400`) — sintetički AI vizual se ne koristi kao zamena za stvarni prikaz konkretne usluge.
- Kad je odobrenje uspešno: `approvedBy` se popunjava trenutnim korisnikom. Ako `scheduledPublishAt` nije postavljen ili je već prošao, sadržaj se **odmah** objavljuje (status ide pravo u `PUBLISHED`) — to je mehaničko izvršenje već donete odluke, ne nova AI/ljudska odluka. Ako je zakazan za budućnost, ostaje `APPROVED` do zakazanog trenutka (cron posao svakog minuta).

**Odgovor `201`** — ažuriran `ContentPiece` (status `APPROVED` ili `PUBLISHED`).

### GET /marketing/content/:id/translations

Lista prevoda (`ContentTranslation`, jedan red po jeziku).

### PUT /marketing/content/:id/translations

Upsert jednog prevoda (isti obrazac kao M2 proizvodi). Zahteva `M12/content/CREATE_DRAFT`.

**Telo:**
```json
{ "languageCode": "sr", "title": "Naslov", "body": "Telo objave.", "translationSource": "MANUAL", "isReviewed": true }
```

---

## Distribucioni kanali (`/channels`)

### GET /marketing/channels

Lista `ChannelConfig` — kredencijali (`authConfigEncrypted`) se **nikad** ne vraćaju u odgovoru.

### POST /marketing/channels

Kreira konfiguraciju kanala. Zahteva `M12/channel-config/EDIT`.

**Telo:**
```json
{ "channelCode": "FACEBOOK", "displayName": "Terminal Travel Facebook", "authConfig": { "pageId": "...", "accessToken": "..." } }
```
`authConfig` se enkriptuje pre upisa (isti obrazac kao M4 `ProviderConfig.authConfigEncrypted`). `M8_SITE`/`MOBILE_PUSH` ne zahtevaju `authConfig` (nemaju sopstveni adapter).

### GET /marketing/channels/:code / PATCH /marketing/channels/:code

Uvid/izmena po `channelCode`. `PATCH` prima `displayName`, `authConfig`, `status` (`ACTIVE`|`INACTIVE`).

---

## Distribucioni tok (interno, ne API)

Kad se sadržaj objavi (`publish`), svaki kanal iz `targetChannels` se obrađuje:
- **M8_SITE** — nema poseban korak; sadržaj je dostupan čim je `PUBLISHED` preko `GET /content`.
- **FACEBOOK / INSTAGRAM** — mock adapter (loguje objavu; tačan izbor mreža/pravi API čeka potvrdu, spec poglavlje 9).
- **EMAIL** — šalje se preko M6 `ClientAccountsService.findMarketingRecipients` isključivo `ClientAccount` zapisima sa `marketingConsent: true`; ako je `targetTags` popunjeno, skup se dodatno suzi (nikad ne proširi).
- **MOBILE_PUSH** — stub, čeka M9 (mobilna aplikacija), samo loguje.

## Automatika

- M2 `product.published` → AI nacrt (`PENDING_APPROVAL`, `generatedBy: AI`, tip `SOCIAL_POST`, kanali `M8_SITE`+`FACEBOOK`+`INSTAGRAM`), bez ljudske intervencije do odobrenja.
- Zakazana objava — cron posao svakog minuta objavljuje sav `APPROVED` sadržaj čiji je `scheduledPublishAt` dospeo.
- M13 marketing izveštaj (`GET /bi/reports/marketing`) razrešava `Booking.referralTrackingCode` protiv `ContentPiece.trackingCode` pri sinhronizaciji — vidi `docs/api/M13-bi.md`.
