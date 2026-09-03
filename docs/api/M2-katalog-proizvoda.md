# API dokumentacija — M2 (Katalog proizvoda)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — B2B subagenti (M7), spoljni AI agenti (M16), budući korporativni klijenti — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju ostaje `docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/catalog`
**Autentikacija:** `Authorization: Bearer <JWT>` na svemu **osim** na `/catalog/public/products` — to je jedini javni deo M2 (vidi ispod).

**Šta je M2, a šta nije:** M2 je registar **šta se prodaje** — hotel, paket, izlet, transfer — sa opisom, slikama, lokacijom i prevodima. M2 **ne sadrži cene ni dostupnost.** Cena dolazi iz M3 (ugovorena) ili M4 (uživo sa spoljnog API-ja), a spaja ih M5 pri pretrazi. Ako vam treba cena, ne zovite M2 nego `GET /api/v1/sales/search` (M5).

**Verzija podataka u primerima:** svi odgovori su stvarno uhvaćeni pozivima nad lokalnom bazom 3.9.2026.

---

## Javni deo — jedini endpoint bez tokena

### GET /catalog/public/products
**Bez autentikacije.** Ovo koristi javni sajt (M8) i svaki spoljni integrator kome treba katalog.

**Zahtev:**
```
GET /api/v1/catalog/public/products?channel=B2C_SITE&lang=en
```

| Parametar | Obavezan | Vrednosti |
| :---- | :---- | :---- |
| `channel` | **da** | `B2C_SITE`, `B2B_PORTAL`, `MOBILE` |
| `lang` | ne (podrazumevano `sr`) | `sr`, `en`, `hr`, `sl`, `es`, `de`, `ru`, `fr` |

**Odgovor `200`:**
```json
[
  {
    "id": "1944adc0-48ad-4af5-bc73-71ccf7555231",
    "type": "ACCOMMODATION",
    "destinationCountry": "Crna Gora",
    "destinationCity": "Budva",
    "geoLat": "42.2786602",
    "geoLng": "18.835528",
    "media": [],
    "attributes": {
      "amenities": ["WIFI", "POOL", "PARKING", "AIR_CONDITIONING"],
      "roomTypes": [
        { "code": "DBL", "name": "Dvokrevetna soba", "maxAdults": 2, "maxChildren": 1 },
        { "code": "SGL", "name": "Jednokrevetna soba", "maxAdults": 1, "maxChildren": 0 }
      ]
    },
    "status": "ACTIVE",
    "visibleChannels": ["B2C_SITE"],
    "cacheStatus": "N_A",
    "lastSyncedAt": null,
    "createdAt": "2026-08-17T15:41:06.992Z",
    "updatedAt": "2026-09-02T19:13:24.279Z",
    "createdBy": null,
    "supplierId": null,
    "translation": {
      "id": "8682607f-cb5a-45be-9628-32db7c6a1727",
      "productId": "1944adc0-48ad-4af5-bc73-71ccf7555231",
      "languageCode": "en",
      "name": "Hotel Avala Resort",
      "description": "Beachfront hotel in the heart of Budva, 200 m from the Old Town. Two pools, spa and a terrace restaurant above the beach.",
      "slug": "hotel-avala-resort-en",
      "translationSource": "MANUAL",
      "isReviewed": true,
      "createdAt": "2026-08-17T15:41:06.992Z",
      "updatedAt": "2026-08-17T15:41:06.992Z"
    }
  }
]
```

**Vraća samo proizvode koji su `status = ACTIVE` I imaju traženi kanal u `visibleChannels`.** Proizvod objavljen samo za `B2B_PORTAL` neće se pojaviti na `channel=B2C_SITE`, bez obzira što je aktivan.

**Četiri polja se ovde NIKAD ne vraćaju**, iako postoje na internom odgovoru: `sourceType`, `sourceContractId`, `sourceProvider`, `sourceExternalId`. To su podaci o tome **od koga i po kom ugovoru** je proizvod nabavljen. Uklanjaju se u posebnom sloju kroz koji svaki javni odgovor mora da prođe, tako da se ne mogu slučajno propustiti dodavanjem novog polja.

**`geoLat`/`geoLng` se vraćaju kao tekst, ne kao broj** (`"42.2786602"`). Posledica preciznog decimalnog tipa u bazi. Pretvorite ih sami ako računate rastojanje.

### GET /catalog/public/products/:id
Isti parametri i isti oblik odgovora, jedan proizvod.

Nepostojeći `id`, ili proizvod koji nije aktivan u tom kanalu → `404`:
```json
{"message":"Zapis nije pronađen","error":"Not Found","statusCode":404}
```

**Izostavljen ili nevažeći `channel` vraća `400` sa objašnjenjem** (uhvaćeno pozivom):
```json
{"message":"Parametar \"channel\" je obavezan i mora biti jedna od vrednosti: B2C_SITE, B2B_PORTAL, MOBILE.","error":"Bad Request","statusCode":400}
```
Nevažeći `lang` isto tako:
```json
{"message":"Parametar \"lang\" mora biti jedan od podržanih jezika: sr, en, hr, sl, es, de, ru, fr.","error":"Bad Request","statusCode":400}
```
`lang` se sme izostaviti (podrazumeva se `sr`); `channel` ne.

> **Ispravljeno 3.9.2026.** Do tog datuma oba slučaja su vraćala `500 Internal server error` bez ikakvog objašnjenja — parametri su bili samo otkucani, bez provere u vreme izvršavanja. Na jedinom endpointu bez prijave to je značilo da spoljni integrator koji pogreši ime kanala ne dobija nikakav trag šta je pogrešio.

---

## Proizvodi (interno)

### GET /catalog/products
Dozvola: `M2/product/VIEW`. Vraća **pun** oblik, sa poljima o izvoru koja javni deo krije.

**Filteri (svi opcioni, kombinuju se):**

| Parametar | Vrednosti |
| :---- | :---- |
| `type` | `ACCOMMODATION`, `PACKAGE`, `TRANSFER`, `EXCURSION`, `FLIGHT`, `INSURANCE`, `TRANSPORT`, `TICKET`, `EVENT`, `CRUISE` |
| `destinationCountry` | naziv države kao tekst |
| `status` | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `channel` | `B2C_SITE`, `B2B_PORTAL`, `MOBILE` |
| `lang` | `sr`, `en`, `hr`, `sl`, `es`, `de`, `ru`, `fr` |

> **`destinationCountry` prima jedan oblik naziva.** Država se pri **upisu** svodi na puno ime na srpskom (`RS` → `Srbija`), pa filter po skraćenici ne nalazi ništa. Ovo je ispravljeno 3.9.2026 — pre toga se katalog raslojio (24 proizvoda pod `RS`, 2 pod `Srbija`). Stariji podaci su prevedeni na jedan oblik.

**Odgovor `200` (jedan element, interni oblik):**
```json
{
  "id": "07c0e129-d63e-4361-ae96-5427cb01424f",
  "type": "ACCOMMODATION",
  "sourceType": "CONTRACTED",
  "sourceContractId": "87e22c86-525a-4497-8dad-b544d070c32c",
  "sourceProvider": null,
  "sourceExternalId": null,
  "destinationCountry": "Srbija",
  "destinationCity": "Kopaonik",
  "geoLat": "43.2689885",
  "geoLng": "20.826741",
  "media": [],
  "attributes": { "stars": 4 },
  "status": "ACTIVE",
  "visibleChannels": [],
  "cacheStatus": "N_A",
  "lastSyncedAt": null,
  "createdAt": "2026-08-14T20:29:20.068Z",
  "updatedAt": "2026-09-02T21:16:54.137Z",
  "createdBy": null,
  "supplierId": null,
  "translations": [ "...svi prevodi..." ],
  "translation": { "...prevod za trazeni lang, ili sr..." }
}
```
Interni odgovor nosi **oba**: `translations[]` (svi jezici) i `translation` (jedan, razrešen po `lang`). Javni nosi samo `translation`.

`sourceType` govori odakle proizvod dolazi: `CONTRACTED` (iz M3 ugovora), `API` (sa spoljnog provajdera preko M4), `MANUAL` (ručno unet, npr. jednokratna usluga na rezervaciji).

### POST /catalog/products
Dozvola: `M2/product/CREATE`. Kreira **isključivo `CONTRACTED`** proizvod — `sourceType` se ne prima i uvek se postavlja na `CONTRACTED`. Proizvodi sa spoljnog API-ja nastaju kroz M4, ne ovde.

**Zahtev:**
```json
{
  "type": "ACCOMMODATION",
  "sourceContractId": "87e22c86-525a-4497-8dad-b544d070c32c",
  "destinationCountry": "Crna Gora",
  "destinationCity": "Budva"
}
```
Samo `type`, `destinationCountry` i `destinationCity` su obavezni. Novi proizvod kreće kao `DRAFT`, bez kanala, bez prevoda.

### GET /catalog/products/:id · PATCH /catalog/products/:id
Dozvole: `M2/product/VIEW` odnosno `EDIT`.

`PATCH` prima **samo** `destinationCountry`, `destinationCity`, `geoLat`, `geoLng`, `media`, `attributes` — sva opciona. `type` i `sourceType` se ne mogu menjati; slanje bilo kog drugog polja vraća `400`.

`attributes` je slobodan objekat čiji sadržaj zavisi od `type`. Za smeštaj su to `amenities[]` i `roomTypes[]`, za paket `duration_days` i `included_products[]`. Šalje se **ceo** objekat — `PATCH` ga zamenjuje, ne spaja.

### DELETE /catalog/products/:id
Dozvola: `M2/product/DELETE`.

### GET /catalog/products/:id/translations
Dozvola: `M2/product/VIEW`.

### PUT /catalog/products/:id/translations
Dozvola: `M2/product-translation/EDIT` (odvojena dozvola od `product/EDIT` — prevodilac sme da menja tekst, ali ne i sam proizvod).

**Zahtev:**
```json
{
  "languageCode": "en",
  "name": "Hotel Avala Resort",
  "description": "Beachfront hotel in the heart of Budva, 200 m from the Old Town.",
  "slug": "hotel-avala-resort-en",
  "translationSource": "MANUAL",
  "isReviewed": true
}
```
Ovaj `PUT` je stvaran `PUT` — jedan red po jeziku, ponovljen poziv za isti `languageCode` menja postojeći prevod.

`translationSource` razlikuje `MANUAL` od `AI_GENERATED`. `isReviewed` označava da je čovek pregledao AI prevod. Oba su opciona (podrazumevano `MANUAL`, `false`).

### POST /catalog/products/:id/publish
Dozvola: `M2/product/PUBLISH` (odvojena od `EDIT` — uređivanje i objavljivanje su namerno različita ovlašćenja).

**Zahtev:**
```json
{ "visibleChannels": ["B2C_SITE", "B2B_PORTAL"] }
```

**Objava se odbija bez srpskog i engleskog prevoda:**
```json
{"message":"Proizvod mora imati srpski i engleski prevod pre objave (M2 spec §2.2)","error":"Bad Request","statusCode":400}
```
Provera se radi **samo pri prvom prelasku u `ACTIVE`**. Proizvod koji je već aktivan može menjati kanale bez ponovne provere.

### POST /catalog/products/cache/sync
Dozvola: `M2/product/EDIT`. Telo: `{ "productId": "..." }`.

Namenjen osvežavanju keširanog sadržaja proizvoda koji dolaze sa spoljnog API-ja.

**Trenutno ne radi ni u jednom slučaju:**
- za `CONTRACTED` proizvod vraća `400` `"CONTRACTED proizvod nema keširan sadržaj — sinhronizacija se ne primenjuje (M2 spec §3.1)"` — to je ispravno i trajno, ugovoreni proizvodi se ne keširaju;
- za `API` proizvod vraća `501 Not Implemented`.

> Poruka uz `501` glasi da „M4 još nije implementiran". **Ta poruka je zastarela** — M4 postoji u kodu od avgusta 2026. Sam mehanizam sinhronizacije ipak još nije povezan, pa je ponašanje (`501`) tačno, a obrazloženje u poruci nije. Ne oslanjajte se na tekst te greške.

---

## Termini polaska (samo za pakete)

Grupni paket ima unapred određene datume polaska; smeštaj nema. Zato ovi endpointi rade **isključivo** nad `type = PACKAGE`.

### GET /catalog/products/:id/package-departures
Dozvola: `M2/product/VIEW`. Vraća `[]` kad termina nema.

### POST /catalog/products/:id/package-departures
Dozvola: `M2/product/EDIT`.

**Zahtev:**
```json
{ "departureDate": "2027-06-10" }
```
**Datum povratka se ne šalje — računa se.** Uzima se `attributes.duration_days` sa proizvoda i dodaje na datum polaska. Zato su moguća dva odbijanja:

```json
{"message":"Termini polaska postoje samo za PACKAGE proizvode (M5 spec §3.0d.6)","error":"Bad Request","statusCode":400}
{"message":"Proizvod mora imati attributes.duration_days pre dodavanja termina (M5 spec §3.0d.6)","error":"Bad Request","statusCode":400}
```
Drugu grešku ćete videti češće nego što očekujete: `duration_days` se postavlja kroz `PATCH` na `attributes`, i lako se izgubi jer `PATCH` **zamenjuje ceo** objekat `attributes`.

### DELETE /catalog/products/:id/package-departures/:departureId
Dozvola: `M2/product/EDIT`. Otkazuje termin.

---

## Uvoz sadržaja o proizvodu (AI)

Isti obrazac kao uvoz cenovnika u M3: AI predloži, **čovek odobri svaku pojedinačnu stavku**, ništa se ne upisuje samo.

### GET /catalog/product-content-imports · GET /catalog/product-content-imports/:id
Dozvola: `M2/product-content-import/VIEW`. `GET /:id` vraća i `fields[]`.

### POST /catalog/product-content-imports
Dozvola: `M2/product-content-import/CREATE`. Dva različita oblika, bira ih `origin`:

**Zaposleni daje adresu stranice (podrazumevano):**
```json
{ "productId": "1944adc0-...", "origin": "MANUAL_URL", "sourceUrl": "https://hotel-avala.example/o-nama" }
```

**Sadržaj već istražen u M23 (Znanje), stiže gotov:**
```json
{
  "productId": "1944adc0-...",
  "origin": "M23_RESEARCH",
  "fields": [
    {
      "fieldType": "DESCRIPTION",
      "extractedValue": { "text": "Hotel na prvoj liniji, 200 m od Starog grada." },
      "matchConfidence": 0.92,
      "sourceArticleRevisionId": "a1b2c3d4-..."
    }
  ]
}
```
`sourceUrl` je obavezan samo za `MANUAL_URL`; `fields[]` samo za `M23_RESEARCH`.

`fieldType` može biti: `NAME`, `DESCRIPTION`, `AMENITY`, `ROOM_TYPE`, `PHOTO`, `LOCATION`, `SERVICE`.
`status` uvoza: `PENDING`, `EXTRACTED`, `REVIEW_IN_PROGRESS`, `COMPLETED`, `FAILED`.

### POST /catalog/product-content-imports/:id/fields/:fieldId/review
Dozvola: `M2/product-content-import/REVIEW_FIELD` — **nikad se ne dodeljuje AI agentu.**

```json
{ "decision": "APPROVED" }
```
```json
{ "decision": "EDITED_AND_APPROVED", "editedValue": { "text": "Ispravljen opis koji ide u katalog." } }
```
```json
{ "decision": "REJECTED" }
```
`editedValue` je obavezan samo uz `EDITED_AND_APPROVED`. Stanja stavke: `PENDING`, `APPROVED`, `EDITED_AND_APPROVED`, `REJECTED`.

**Odobrava se stavka po stavka, ne ceo uvoz odjednom.** AI može tačno pogoditi opis a promašiti spisak sadržaja u hotelu; odobravanje „sve ili ništa" bi značilo da se greška propušta zajedno sa tačnim delom.

---

## Greške — zajednički oblik

```json
{ "message": "opis greške", "error": "Bad Request", "statusCode": 400 }
```
Greška validacije vraća **niz** poruka:
```json
{ "message": ["type must be one of the following values: ACCOMMODATION, PACKAGE, ..."], "error": "Bad Request", "statusCode": 400 }
```

| Kod | Kada |
| :---- | :---- |
| `400` | validacija tela, objava bez sr/en prevoda, termin polaska na proizvodu koji nije `PACKAGE` ili nema `duration_days` |
| `401` | nedostaje ili je istekao token (ne odnosi se na `/catalog/public/*`) |
| `403` | `{"message":"Nema dozvolu M2/product/PUBLISH","error":"Forbidden","statusCode":403}` |
| `404` | `{"message":"Zapis nije pronađen",...}` |
| `501` | `cache/sync` nad `API` proizvodom — sinhronizacija još nije povezana |

Nepoznato polje u telu zahteva vraća `400`, ne ignoriše se.
