# API dokumentacija — M4 (Integracije spoljnih API konekcija)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski. Interni oslonac za implementaciju ostaje `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/integrations`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu.

**Šta je M4:** sloj adaptera ka spoljnim dobavljačima (Travelgate, Solvex/Master-Interlook, WebHotelier). Svaki provajder govori svojim jezikom — GraphQL, SOAP, REST — a M4 to prevodi u **jedan** oblik koji ostatak sistema razume. M2 i M5 nikad ne razgovaraju sa provajderom direktno.

M4 ima dve odvojene grupe endpointa, sa vrlo različitim posledicama:

| Grupa | Namena | Ko sme |
| :---- | :---- | :---- |
| **Administrativni** (`/providers`, `/provider-call-logs`) | podešavanje provajdera i dijagnostika | dozvole `M4/provider-config/*`, `M4/provider-call-log/VIEW` |
| **Operativni** (`/internal/providers/...`) | stvarna pretraga, provera cene, **rezervacija i otkazivanje kod provajdera** | dozvola `M4/provider-config/EDIT` — Vlasnik, Direktor |

> **U redovnom radu ovi endpointi se ne koriste.** M5 ne prolazi kroz HTTP nego poziva `IntegrationsService` direktno unutar servera. Operativni endpointi postoje kao administrativni/dijagnostički ulaz („da li Travelgate uopšte odgovara"), i zato nose istu dozvolu kao podešavanje provajdera.
>
> **Ispravljeno 3.9.2026.** Do tog datuma ove rute nosile su samo proveru da token važi, bez provere ko je vlasnik tokena — što je značilo da svako ko se sam registruje kao gost može da vidi neto cene bez marže, napravi stvarnu rezervaciju kod spoljnog dobavljača i otkaže postojeću. Sada svih pet ruta traži `M4/provider-config/EDIT`; pokriveno e2e testovima za svaku rutu posebno.

**Verzija podataka u primerima:** oblici odgovora su izvedeni iz koda adaptera i modela podataka. Za razliku od M1/M2/M3, ovde **nijedan odgovor nije uhvaćen stvarnim pozivom** — u bazi nema nijedne konfiguracije provajdera (`GET /providers` vraća `[]`), a pozivanje pravih provajdera zahteva kredencijale kojih nema. To je izričito označeno umesto da se izmisli primer.

---

## Administrativni deo

### GET /integrations/providers
Dozvola: `M4/provider-config/VIEW`. Trenutno vraća `[]` (uhvaćeno pozivom — nijedan provajder nije podešen).

**`authConfig` se NIKAD ne vraća u odgovoru.** Kredencijali se šifruju pre upisa i ne postoji endpoint koji ih čita nazad. Ako ih izgubite, unose se ponovo.

### POST /integrations/providers
Dozvola: `M4/provider-config/CREATE`.

**Zahtev:**
```json
{
  "providerCode": "travelgate",
  "displayName": "TravelgateX",
  "category": "HOTEL",
  "authStrategy": "API_KEY",
  "authConfig": { "endpoint": "https://api.travelgate.example/graphql", "apiKey": "..." },
  "capabilitiesProfile": { "supportsChildAges": true },
  "timeoutSearchMs": 8000,
  "timeoutBookingMs": 20000,
  "circuitFailureThreshold": 5,
  "circuitCooldownSeconds": 60,
  "defaultTipNastupanja": "POSREDNIK"
}
```

| Polje | Vrednosti |
| :---- | :---- |
| `category` | `HOTEL`, `FLIGHT`, `TRANSFER`, `ACTIVITY`, `INSURANCE` |
| `authStrategy` | `API_KEY`, `BASIC`, `OAUTH2_CLIENT_CREDENTIALS`, `REQUEST_SIGNING`, `SESSION_TOKEN` |
| `status` | `ACTIVE`, `INACTIVE` |

`authConfig` je slobodan objekat čiji oblik zavisi od `authStrategy` — za `API_KEY` je `{endpoint, apiKey}`, za `BASIC` `{endpoint, login, password}`.

**Dva vremenska ograničenja su odvojena namerno.** Pretraga sme da odustane brzo (gost čeka pred ekranom, a rezultat je samo jedan od više izvora). Potvrda rezervacije mora da čeka duže — prekinuti je na pola znači ne znati da li je rezervacija napravljena ili nije.

**`circuitFailureThreshold` / `circuitCooldownSeconds`** su „osigurač": posle toliko uzastopnih grešaka M4 prestaje da zove tog provajdera na toliko sekundi, umesto da svaki poziv čeka do isteka vremena. Bez toga jedan pokvaren provajder uspori celu pretragu.

### GET /integrations/providers/:code · PATCH /integrations/providers/:code
Dozvole: `M4/provider-config/VIEW` odnosno `EDIT`. `:code` je `providerCode`, ne UUID.

`PATCH` prima `authConfig`, `capabilitiesProfile`, `status`, `defaultTipNastupanja`, `timeoutSearchMs`, `timeoutBookingMs`, `useMock` — sva opciona.

**`useMock: true`** prebacuje provajdera na ugrađeni lažni adapter, koji vraća izmišljene rezultate bez ijednog spoljnog poziva. Služi za razvoj i demonstraciju. Provera da li je uključen radi se ovim poljem — pazite da ne ostane uključen na produkciji, jer odgovori izgledaju potpuno normalno.

### GET /integrations/provider-call-logs
Dozvola: `M4/provider-call-log/VIEW`. Trenutno vraća `[]` (uhvaćeno pozivom).

Zapis svakog poziva ka provajderu — za dijagnostiku „zašto pretraga nije vratila taj hotel".

| Filter | Vrednosti |
| :---- | :---- |
| `providerCode` | oznaka provajdera |
| `operation` | `SEARCH`, `CONTENT`, `AVAILABILITY`, `BOOK`, `CANCEL` |
| `from` / `to` | datumi |

---

## Operativni deo

Svih pet ruta traži dozvolu `M4/provider-config/EDIT` (od 3.9.2026). Nalog bez nje dobija `403`, i to i za pretragu i za radnje koje menjaju stanje kod provajdera.

Svi putevi počinju sa `/integrations/internal/providers/:code`, gde je `:code` oznaka provajdera (`travelgate`, `solvex`, `webhotelier`, `mock`).

### POST /:code/search
Pretraga kod jednog provajdera.

**Zahtev:**
```json
{
  "destinationCountry": "Grčka",
  "destinationCity": "Halkidiki",
  "stayFrom": "2027-06-10",
  "stayTo": "2027-06-17",
  "adults": 2,
  "children": 1
}
```
`destinationCountry` i `destinationCity` su opcioni; `stayFrom`, `stayTo` i `adults` su obavezni.

**Vraća `NormalizedSearchResult[]` — cene su NETO, bez marže.** Ovo nije ono što se pokazuje gostu. Prodajnu cenu pravi M5 (`GET /api/v1/sales/search`), koji na ovo dodaje maržu. Ako gradite prikaz za gosta, zovite M5, ne ovo.

**M4 pita jednog provajdera po pozivu.** Nema objedinjavanja više izvora u jednom odgovoru — to radi M5, tako što pozove M4 za svakog provajdera i pojedinačno uhvati onog koji ne odgovori. Pad jednog provajdera zato ne obara pretragu, ali samo ako pozivate kroz M5.

### GET /:code/content/:externalId
Statički sadržaj o proizvodu kod provajdera (opis, slike, sadržaji hotela) — `NormalizedContent`. `:externalId` je identifikator kod tog provajdera, ne naš.

### POST /:code/availability
Provera stvarne dostupnosti i cene za konkretan termin.

```json
{ "externalId": "TG-88213", "stayFrom": "2027-06-10", "stayTo": "2027-06-17", "adults": 2, "children": 1 }
```

Vraća `AvailabilityQuote` sa poljem **`quoteExpiresAt`** — trenutak posle kog ova cena više ne važi i mora se tražiti nova provera.

> `quoteExpiresAt` M4 popunjava, ali **ne sprovodi**. Odbijanje potvrde sa isteklom ponudom je posao M5. Ako zovete M4 direktno, ništa vas neće sprečiti da potvrdite rezervaciju po ceni koja je istekla — a provajder će je odbiti ili naplatiti drugačije.

### POST /:code/bookings
**Pravi stvarnu rezervaciju kod spoljnog dobavljača.** Ovo nije proba i ima finansijske posledice.

```json
{
  "externalId": "TG-88213",
  "stayFrom": "2027-06-10",
  "stayTo": "2027-06-17",
  "adults": 2,
  "children": 1,
  "guestName": "Petar Petrović",
  "idempotencyKey": "b7e2f1a0-4c3d-4f5e-9a1b-2c3d4e5f6a7b"
}
```

**`idempotencyKey` je obavezan i štiti od duple rezervacije.** Ako veza pukne pre nego što stigne odgovor, ne znate da li je rezervacija napravljena. Ponovni poziv sa **istim** ključem vraća sačuvan ishod prvog poziva i **ne zove provajdera ponovo** — dokazano testom sa simuliranim prekidom veze. Ključ generiše pozivalac (M5 pravi jedan po pokušaju rezervacije), po jedan za svaki stvaran pokušaj; ponovna upotreba istog ključa za drugu rezervaciju vratiće vam tuđi rezultat.

### POST /:code/bookings/:ref/cancel
Otkazuje rezervaciju kod provajdera. `:ref` je broj rezervacije koji je provajder vratio.

---

## Provajderi koji postoje u kodu

| Oznaka | Protokol | Stanje |
| :---- | :---- | :---- |
| `travelgate` | GraphQL | adapter kompletan, **nikad pozvan uživo** — nema kredencijala |
| `solvex` | SOAP (Master-Interlook) | adapter kompletan, isto |
| `webhotelier` | REST | adapter kompletan, isto |
| `mock` | — | lažni odgovori za razvoj |

> Sva tri adaptera su dokazana testovima sa lažiranim mrežnim odgovorima. **Nijedan nije proveren protiv pravog servisa provajdera**, jer pristupni podaci nisu pribavljeni. Prvi stvaran poziv može otkriti razlike koje test sa lažiranim odgovorom ne vidi (drukčija polja, drukčije greške, ograničenja učestalosti).

---

## Greške — zajednički oblik

```json
{ "message": "opis greške", "error": "Bad Request", "statusCode": 400 }
```

| Kod | Kada |
| :---- | :---- |
| `400` | validacija tela zahteva |
| `401` | nedostaje ili je istekao token |
| `403` | nedostatak dozvole — i na administrativnim i na operativnim endpointima: `{"message":"Nema dozvolu M4/provider-config/EDIT","error":"Forbidden","statusCode":403}` |
| `404` | nepoznat `providerCode` ili nepostojeći zapis |
| `500` | **svaka greška provajdera** — vidi ispod |

Nepoznato polje u telu zahteva vraća `400`, ne ignoriše se.

### Greške provajdera stižu kao `500` bez razloga

M4 interno razlikuje sedam vrsta problema sa provajderom:

`TIMEOUT`, `RATE_LIMITED`, `AUTH_FAILED`, `INVALID_REQUEST`, `NO_AVAILABILITY`, `PROVIDER_UNAVAILABLE`, `UNKNOWN`

**Nijedna od njih ne stiže do pozivaoca.** `ProviderError` je obična greška, ne HTTP greška, i ne postoji sloj koji je prevodi — zato svaka izlazi kao:
```json
{"statusCode":500,"message":"Internal server error"}
```
Provereno u kodu 3.9.2026. Posledica u praksi: pozivalac ne može da razlikuje „hotel je pun" (`NO_AVAILABILITY`, uredan ishod na koji treba ponuditi drugi termin) od „naši pristupni podaci su pogrešni" (`AUTH_FAILED`, kvar koji traži hitnu intervenciju) — oba izgledaju isto.

Razlog zbog kog se u svakodnevnom radu ovo ne primećuje: nijedan provajder još nije podešen, pa se ove greške ne dešavaju. Postaće vidljivo prvog dana kad se uključi pravi provajder.

Do ispravke, jedini način da se vidi stvaran razlog je `GET /integrations/provider-call-logs`, gde se svaki poziv beleži sa svojim ishodom. Zabeleženo kao neispunjena stavka izlaznog kriterijuma M4 i kao zamka 13.4.
