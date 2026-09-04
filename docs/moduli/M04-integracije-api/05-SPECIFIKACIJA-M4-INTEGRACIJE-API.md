# Specifikacija modula M4 — Integracije spoljnih API konekcija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M4) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje (pisano od nule — raniji "Travelgate predlog" pomenut u Master dokumentu nije pronađen)
**Verzija:** 1.14 — poglavlje 9 dopunjeno preduslovom identiteta za MCP konektore (28.8.2026) — pokazivač na novi M15 spec §6.5.6d/`TrustedMcpConnector` gate, nastao iz vlasnikovog pitanja "šta ako link nije to što se misli da jeste" o MCP konektoru pronađenom preko medija. Nema izmene tehničkog sadržaja postojeće M4 analize, samo eksplicitan bezbednosni preduslov pre bilo kakvog wiring-a.
**Verzija:** 1.13 — `05-ANALIZA-MCP-KONEKTORI-SMESTAJ.md` dopunjena istog dana (28.8.2026) novim poglavljem o TravelgateX/HotelX (pravi B2B GraphQL API, ne isti MCP konektor kao Expedia/Novasol/Booking.com) — nalazi su iz dokumentacije (kapa.ai MCP samo pretražuje `docs.travelgate.com`, nema pristup live API-ju), izričito označeni kao "čeka live potvrdu" pre oslanjanja. Ključno za budući adapter ako se usvoji: obavezan Search→Quote→Book tok (cena iz Search NIJE garantovana), i kritičan nalaz da se nemapiran pansion tiho briše iz rezultata bez ikakve greške — ozbiljnije od tihog ignorisanja filtera kod Expedije (v1.12). I dalje čista referenca, ništa usvojeno.
**Verzija:** 1.12 — poglavlje 9 dopunjeno zapisom o tri empirijski testirana MCP konektora za pretragu smeštaja (Expedia/Novasol/Booking.com, 28.8.2026, vlasnik dostavio nalaze) — pun nalaz u novom `05-ANALIZA-MCP-KONEKTORI-SMESTAJ.md` (ovaj folder). Čista referenca, ne usvajanje — nijedan adapter nije ovim dodat, čeka odluku vlasnika i, po usvajanju, sopstvenu implementacionu napomenu (MCP poziv je strukturno drugačiji obrazac od SOAP/REST adaptera u poglavljima 5/5a/5b).
**Verzija:** 1.11 — poglavlje 9 dopunjeno MARS ERP (NeoLab) zapisom (21.8.2026) — vlasnik potvrdio da moguća buduća sinhronizacija sa TTA back-office ERP-om ide kroz M4 kao još jedna konekcija, ne kao poseban modul (razrešava napetost sa M3/M5/M10 opisanu u `docs/analize/34-PREDLOG-MARS-CONNECTOR.md`); ostaje otvoreno da li MARS odgovara postojećem `ProviderAdapter` ugovoru ili zahteva proširenje (§9 detalji); v1.10 — poglavlje 9 dopunjeno Travelfusion zapisom (19.8.2026) — predlog dopune primljen od vlasnika za mogući budući FLIGHT adapter (LCC/regionalni avio prevoznici); istraženo da nema self-serve sandboxa niti javne cene, pristup ide preko partner ugovora — namerno bez implementacione napomene dok se ne potvrdi stvaran poslovni dogovor, isti gejt kao za Duffel/Travelport (poglavlje 9); v1.9 — WebHotelier adapter implementiran (`apps/api/src/modules/m4-integracije-api/adapters/webhotelier.adapter.ts` + test), žičen u `ProviderRegistryService`; `externalId` kompozitan `${propertyCode}:${rateId}` (adapterska odluka, ne izmena ugovora iz poglavlja 2); `confirmBooking` pribavlja svežu cenu preko `checkAvailabilityAndPrice` neposredno pre `/book` poziva (WebHotelier striktno proverava cenu server-side); 18 novih unit testova, 100/100 M4 testova prolazi; radi u `use_mock` režimu, čeka stvarne Travel Agent kredencijale za live spike (§9), avgust 2026; v1.8 — dodat WebHotelier kao treći HOTEL adapter (poglavlje 5b), REST/HTTP + `BASIC` auth (postojeća strategija, nema nove implementacije), za direktno povezivanje sa konkretnim hotelima koji WebHotelier koriste kao sopstveni booking engine — potvrđena, specifična poslovna potreba (avgust 2026, na zahtev vlasnika); mapiranje potvrđeno iz javne dokumentacije, live spike test protiv stvarnog naloga još nedostaje (§9); v1.7 — implementacija (avgust 2026, Faza 1): `apps/api/src/modules/m4-integracije-api/` — pun `ProviderAdapter` ugovor (Travelgate GraphQL, Solvex SOAP/`fast-xml-parser`, oba mapiraju u zajednički normalizovan oblik), sve 5 `AuthStrategy` implementacija (uklj. `SESSION_TOKEN` sa reaktivnim osvežavanjem), circuit breaker (CLOSED/OPEN/HALF_OPEN), keš šifarnika po provajderu (TTL), idempotentnost `confirmBooking` preko `ProviderCallLog.response_body` (novo polje — neophodno da bi se ranije potvrđen ishod stvarno mogao vratiti, ne samo znati da je poziv poslat), redakcija ličnih/osetljivih podataka pre upisa u log, `ProviderConfig.use_mock` formalizovan (poglavlje 9). `ProviderRegistryService` kešira instancu adaptera po `provider_code` (bitno za ispravnost `SESSION_TOKEN`/OAuth2 keširanja tokena, ne samo performanse). Travelgate live neproveren (nema pravih kredencijala); Solvex SOAP format uživo potvrđen ispravnim (Connect/GetCountries protiv `evaluation.solvex.bg`), ali test kredencijali trenutno odbijeni (verovatno IP whitelist) — oba adaptera testirana preko mokovanog HTTP sloja. 86 unit + 10 e2e testova dokazuje 10 od 15 stavki izlaznog kriterijuma (poglavlje 8) — preostalih 5 čeka M5 (agregacija više provajdera, `quoteExpiresAt` provera, M2 lenjo keširanje end-to-end) ili konkretan brojčani prag za veličinu odgovora; v1.6 — definisan oblik `AvailabilityQuote.cancellationPolicy` (poglavlje 2.1) — sad isti niz `{days_before_stay, refund_percentage}` kao M3 `CancellationRule`, da M5 obračun otkazivanja/povraćaja ne grana logiku po poreklu proizvoda (M3 vs. M4); dodato u poglavlje 9 (otvoreno, ne rešeno sada, svesna odluka pri diskusiji sa vlasnikom): `SESSION_TOKEN` ponašanje pod konkurentnim pozivima, sprovođenje rate limit-a, mock/test režim, eksplicitno modelovanje test/produkcije; avgust 2026, na zahtev vlasnika; v1.5 — definisan `NormalizedSearchResult` (poglavlje 2.1, ranije samo pominjan kao tip); novo poglavlje 2.4 (keširanje šifarnika + gornja granica veličine rezultata pretrage, radi troška poziva i tokena AI agenata); ispravljen `ProviderConfig.auth_strategy` enum (nedostajao `SESSION_TOKEN`, poglavlje 3.1); avgust 2026, na zahtev vlasnika; v1.4 — poglavlje 5a dopunjeno stvarnim, potvrđenim WSDL/parametrima (strog redosled polja, `countryKey`/`regionKey`, diffgram odgovor, nepouzdano server-side filtriranje) posle izolovanog spike testa uživo protiv Solvex-a — prvobitni "flat" primer iz javne Solvex dokumentacije se pokazao netačnim; dodat otvoren zapis o nedostajućem `NormalizedSearchResult` polja-skupu (poglavlje 9); avgust 2026, na zahtev vlasnika; v1.3 — dodat Solvex (Master-Interlook) kao drugi HOTEL adapter uz Travelgate (poglavlje 5a), na osnovu ranijeg PrimeTravel rada na istoj integraciji; dodata `SESSION_TOKEN` auth strategija (poglavlje 2.2) koju Travelgate/OAuth2 model nije pokrivao; avgust 2026, na zahtev vlasnika; v1.2 — dodato `ProviderConfig.default_tip_nastupanja` (poglavlje 3.1), isto rešenje kao M3 poglavlje 2.2a, za API-sourced proizvode bez ugovora u M3 (avgust 2026, na zahtev vlasnika); v1.1 dodato: tipizirane greške, pluggable auth strategije, circuit breaker, deklarativni profil mogućnosti provajdera — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1 (Core / Identitet i pristup), M2 (Katalog proizvoda)

---

## 1. Svrha i obim modula

M4 je sloj adaptera koji prevodi formate spoljnih dobavljača proizvoda (Travelgate za hotele; kasnije GDS/avio, transferi, aktivnosti) u jedan interni, provajder-nezavisan oblik koji koriste M2 (katalog) i M5 (rezervacije). Ni M2 ni M5 nikad ne znaju da li podatak dolazi sa Travelgate-a ili nekog budućeg provajdera — vide samo interni oblik koji M4 garantuje. Ovo je direktna primena principa #3 iz poglavlja 3 Master dokumenta.

Van obima: SEF, ESIR, YUTA — iako su i to "spoljne integracije" u širem arhitektonskom smislu (poglavlje 5), te konkretne integracije se specificiraju unutar M10 i M11 kad ti moduli dođu na red, ne ovde. M4 (kao modul iz poglavlja 4, ne kao opšti sloj iz dijagrama u poglavlju 5) obuhvata isključivo dobavljače **turističkog proizvoda/inventara**.

---

## 2. Adapterski interfejs — ugovor koji svaki provajder mora ispuniti

Svaki spoljni provajder se povezuje kroz jedan adapter koji implementira isti interfejs, tako da dodavanje novog provajdera (npr. GDS za avio karte) nikad ne zahteva izmenu M2 ili M5:

```
interface ProviderAdapter {
  providerCode: string;                 // npr. "travelgate"
  category: "HOTEL" | "FLIGHT" | "TRANSFER" | "ACTIVITY" | "INSURANCE";

  search(params: SearchParams): Promise<NormalizedSearchResult[]>;
  getStaticContent(externalId: string): Promise<NormalizedContent>;
  checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote>;
  confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation>;
  cancelBooking(providerBookingReference: string): Promise<CancellationResult>;
}
```

### 2.1 Normalizovani oblici (interni, provajder-nezavisni)

- **`NormalizedSearchResult`** *(polja definisana v1.5, na osnovu nalaza iz Solvex spike testa — ranije samo pominjano kao tip bez skupa polja)* — `{ externalId, providerCode, category, name, locationSummary, priceFrom, currency, thumbnailUrl, starRating, quotaStatus: "AVAILABLE" | "ON_REQUEST" | "STOP_SALES" }`. Namerno **tanak** oblik — lista rezultata pretrage nikad ne nosi pun opis/sve slike/sve atribute (to je `NormalizedContent`, poglavlje ispod). `starRating` je `null` kad provajder ne vraća pouzdan podatak (npr. Solvex, gde se broj zvezda izvlači heuristikom iz teksta — poglavlje 5a) — adapter nikad ne pretpostavlja `0` kao da znači "bez zvezda", to bi bio netačan podatak predstavljen kao tačan. Razlog za tanak oblik je direktno vezan za poglavlje 2.4 — manje polja po stavci znači manje tokena kad god se rezultat pretrage na kraju pojavi u kontekstu AI agenta.
- **`NormalizedContent`** — isti oblik kao `Product` + `ProductTranslation` iz M2 (naziv, opis, slike, lokacija, atributi po tipu). M4 vraća ovaj oblik direktno M2-u za lenjo keširanje (vidi M2 spec, poglavlje 3.2) — nema prevođenja "na pola puta". Za razliku od `NormalizedSearchResult`, ovo se povlači samo za jedan konkretan proizvod kad je stvarno potreban pun prikaz, nikad za celu listu rezultata pretrage.
- **`AvailabilityQuote`** — `{ externalId, priceAmount, currency, availableUnits, cancellationPolicy, quoteExpiresAt }`. Nikad se ne čuva trajno kao cena proizvoda (u skladu sa M2 spec, poglavlje 4) — koristi se odmah ili se odbacuje. **`cancellationPolicy`** *(oblik definisan v1.6)* — niz `{ days_before_stay: integer, refund_percentage: integer (0–100) }`, **isti oblik kao M3 `CancellationRule`** (M3 spec, poglavlje 2.5), ne novi, adapter-specifičan format. Razlog: M5 obračunava otkazivanje/povraćaj (i M10 stvaran povraćaj novca) nad jednim, provajder-nezavisnim oblikom bez obzira da li rezervacija dolazi iz M3 (ugovor) ili M4 (API) — isto načelo koje `BookingConfirmation.status` već primenjuje za `PENDING_SUPPLIER_CONFIRMATION`/`ON_REQUEST` (gore). Adapter je taj koji prevodi provajderov sopstveni format otkazivanja (npr. Solvex `CancellationPolicyWithPenaltyValue` — `DateFrom`/`DateTo`/`PenaltyValue`/`IsPercent`, poglavlje 5a) u ovaj niz praga-postotak parova; ako provajder vraća penal kao fiksan iznos umesto procenta (`IsPercent = false`), adapter ga izračunava kao procenat od `priceAmount` pre vraćanja — `refund_percentage` je uvek broj 0–100, nikad mešoviti tip.
- **`BookingConfirmation`** — `{ providerBookingReference, status: "CONFIRMED" | "PENDING_SUPPLIER_CONFIRMATION" | "FAILED", confirmedPrice, confirmedAt }`. Status `PENDING_SUPPLIER_CONFIRMATION` postoji jer neki spoljni hoteli (baš kao `ON_REQUEST` alotman u M3) ne potvrđuju rezervaciju odmah — M5 tretira ovo isto kao "na čekanju" status, bez obzira da li dolazi iz M3 ili M4.

### 2.2 Autentikacija — pluggable strategije po dobavljaču

Različiti provajderi koriste različite metode autentikacije (API ključ, Basic auth, OAuth2 client credentials, potpisivanje zahteva). Umesto if/else grane po provajderu unutar svakog adaptera, autentikacija je zasebna, uključiva strategija:

```
interface AuthStrategy {
  strategyType: "API_KEY" | "BASIC" | "OAUTH2_CLIENT_CREDENTIALS" | "REQUEST_SIGNING" | "SESSION_TOKEN";
  applyAuth(request): request; // ubacuje header/potpis/token pre slanja
  refreshIfNeeded(): Promise<void>; // no-op za API_KEY/BASIC, stvaran refresh za OAUTH2/SESSION_TOKEN
}
```

Svaki adapter deklariše koju strategiju koristi (`ProviderConfig.auth_strategy`, poglavlje 3.1); dodavanje provajdera sa novim tipom autentikacije znači dodavanje nove implementacije `AuthStrategy`, ne izmenu postojećih adaptera. Potvrđeno poređenjem sa PrimeTravel `auth.strategies.ts` obrascem (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 2).

**`SESSION_TOKEN`** *(dodato v1.3, radi Solvex adaptera — poglavlje 5a)* — provajder izlaže poseban login poziv (npr. `Connect(login, password)`) koji vraća kratkoživeći token (GUID); taj token se prosleđuje kao parametar u svakom narednom pozivu, ne kao HTTP header. Za razliku od `OAUTH2_CLIENT_CREDENTIALS`, format tokena i mesto gde se ubacuje (telo zahteva, ne header) su specifični po provajderu — `applyAuth` za ovu strategiju ubacuje token na mesto koje adapter deklariše, ne generički header. `refreshIfNeeded()` ponovo poziva login endpoint kad provajder vrati grešku tipa "nevažeći token" (npr. Solvex `"Invalid GUID"`) — token se ne osvežava na fiksni raspored, nego reaktivno na grešku, jer tačno trajanje sesije nije uvek dokumentovano od strane provajdera.

### 2.3 Deklarativni profil mogućnosti provajdera

Svaki `ProviderConfig` nosi `capabilities_profile` (JSONB) — deklarativan, statički opis šta taj provajder podržava/ograničava (npr. `{ maxResultsPerSearch: 50, supportsCancelBooking: true, rateLimit: "100/min" }`). M4 čita ovo pre poziva da izbegne slanje operacije koju provajder ne podržava ili prekoračenje njegovog rate limit-a, umesto da to otkriva tek iz greške odgovora. Potvrđeno poređenjem sa PrimeTravel `.profile.json` obrascem po adapteru (isti izvor kao 2.2).

### 2.4 Efikasnost — keširanje i ograničenje veličine, radi troška poziva i tokena AI agenata

*(dodato v1.5, avgust 2026, na eksplicitan zahtev vlasnika — adapter mora biti optimizovan, ne samo funkcionalan)*

M4 je jedina tačka u sistemu koja zna koliko "skup" (latencija, rate limit, veličina odgovora) svaki spoljni poziv stvarno jeste — zato ovde, ne u M2/M5/M15, žive sledeća pravila:

- **Keširanje šifarnika po provajderu.** Podaci koji se retko menjaju (države, gradovi, tipovi soba, pansioni i sl.) keširaju se na nivou adaptera sa TTL-om (npr. 24h), ne pozivaju se iznova pri svakoj pretrazi. Ovo je odvojeno od M2 lenjog keširanja `NormalizedContent` (poglavlje 2.1, poglavlje 3.2 M2 spec) — ovde je reč o sirovim rečnicima provajdera, pre normalizacije.
- **Gornja granica veličine rezultata pretrage.** `search()` nikad ne vraća više stavki od `capabilities_profile.maxResultsPerSearch` (poglavlje 2.3) — M4 seče na tu granicu **pre** vraćanja pozivaocu, ne posle. Podrazumevana vrednost ako provajder ne deklariše svoju: 50.
- **`NormalizedSearchResult` je namerno tanak oblik** (poglavlje 2.1) — lista rezultata pretrage nikad ne nosi pun opis, sve slike ili sve atribute. Pun sadržaj (`NormalizedContent`) povlači se tek za jedan konkretan proizvod, kad je stvarno potreban, nikad unapred za celu listu "za svaki slučaj".
- **AI agenti nikad ne vide sirov odgovor provajdera.** M4 interni endpoint-i pozivaju isključivo M2/M5 (poglavlje 6) — čak i kad M15 agent (npr. omnisearch, M15 poglavlje 6.5/6.6) na kraju sumira ponudu gostu, on radi nad već normalizovanim, tankim oblikom koji je prošao kroz ovo poglavlje, nikad nad sirovim GraphQL/SOAP payload-om. Ovo je postojeća granica arhitekture (princip #2, Master dokument), ovde samo eksplicitno povezana sa ciljem "manje tokena po pozivu".
- **`ProviderCallLog.request_summary` ostaje sažet, ne pun payload** (već propisano poglavljem 3.2) — ova stavka postoji radi potpunosti, isti razlog (trošak/veličina) važi i za operativni log, ne samo za odgovor koji ide dalje kroz sistem.

---

## 3. Model podataka

### 3.1 `ProviderConfig`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_code | string, unique | npr. `travelgate` |
| display_name | string | |
| category | enum (vidi 2.) | |
| auth_config_encrypted | string | API ključevi/endpoint, enkriptovano u mirovanju; stvarni sekret nikad u kodu ili plain konfiguraciji (poglavlje 9) |
| auth_strategy | enum: `API_KEY`, `BASIC`, `OAUTH2_CLIENT_CREDENTIALS`, `REQUEST_SIGNING`, `SESSION_TOKEN` | koju `AuthStrategy` implementaciju adapter koristi (poglavlje 2.2) |
| capabilities_profile | JSONB | deklarativni opis mogućnosti/ograničenja provajdera, uključujući `maxResultsPerSearch` (podrazumevano 50 ako nije eksplicitno postavljeno — poglavlje 2.4) (poglavlje 2.3) |
| status | enum: `ACTIVE`, `INACTIVE` | isključivanje provajdera bez brisanja konfiguracije |
| timeout_search_ms / timeout_booking_ms | integer | po provajderu — pretraga sme kraće da čeka od potvrde rezervacije |
| circuit_state | enum: `CLOSED`, `OPEN`, `HALF_OPEN` | vidi poglavlje 4.1 — `CLOSED` podrazumevano |
| circuit_failure_threshold | integer | uzastopnih grešaka pre otvaranja kola (poglavlje 4.1), podrazumevano npr. 5 |
| circuit_cooldown_seconds | integer | koliko dugo `OPEN` traje pre probnog poziva (poglavlje 4.1) |
| default_tip_nastupanja | enum: `ORGANIZATOR`, `POSREDNIK` | **obavezno pre nego što `ProviderConfig` može preći u `ACTIVE`**, isti princip kao M3 `Contract.default_tip_nastupanja` (M3 poglavlje 2.2a) — izvor istine za samouslužne kanale (M8, M7) kad rezervišu API-sourced proizvod bez ljudskog naloga u toku. Za većinu provajdera (npr. Travelgate hotelska ponuda) očekivana vrednost je `ORGANIZATOR`, ali se ne pretpostavlja — postavlja se eksplicitno pri konfiguraciji provajdera |
| created_at / updated_at | timestamp | |

### 3.2 `ProviderCallLog` — operativni log (odvojeno od M1 audit loga)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_code | string | |
| operation | enum: `SEARCH`, `CONTENT`, `AVAILABILITY`, `BOOK`, `CANCEL` | |
| request_summary | JSONB | bez ličnih podataka gosta gde god je moguće (poglavlje 7, tačka 5 Master dokumenta) |
| response_status | string | HTTP/GraphQL status ili "TIMEOUT" |
| error_code | enum: `TIMEOUT`, `RATE_LIMITED`, `AUTH_FAILED`, `INVALID_REQUEST`, `NO_AVAILABILITY`, `PROVIDER_UNAVAILABLE`, `UNKNOWN`, nullable | normalizovan tip greške nezavisan od HTTP/GraphQL specifičnosti provajdera — omogućava agregaciju i alarme u M18 (`PROVIDER_ERROR_SPIKE`) bez parsiranja slobodnog teksta iz `error_message`. Potvrđeno poređenjem sa PrimeTravel `error.types.ts` obrascem (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 2) |
| latency_ms | integer | |
| error_message | text, nullable | |
| timestamp | timestamp | |

Svrha: dijagnostika integracije (da li Travelgate usporava, da li određeni pozivi stalno padaju) — tehnički log, kratkog veka (npr. 90 dana rotacija), za razliku od `AuditLogEntry` u M1 koji je trajan i pravno relevantan. **Svaki uspešan/neuspešan `BOOK`/`CANCEL` poziv dodatno upisuje zapis i u M1 `AuditLogEntry`** (`actor_type = SYSTEM`) jer to ima stvarnu finansijsku težinu — `ProviderCallLog` sam po sebi nije dovoljan za tu vrstu radnje.

---

## 4. Otpornost na greške (M4 mora da pretpostavi da spoljni provajderi ponekad ne rade)

- **Timeout po operaciji** — pretraga: kratak (npr. 8s), potvrda rezervacije: duži (npr. 15s), konfigurabilno po provajderu (`ProviderConfig`).
- **Degradacija bez pada:** ako jedan provajder ne odgovori na `search`, M5 dobija rezultate od ostalih dostupnih izvora (M3 ugovoreni proizvodi + drugi API provajderi), uz grešku samo za taj jedan zabeleženu u `ProviderCallLog` — pretraga gosta se nikad ne prekida zbog jednog neispravnog provajdera.
- **Idempotentnost za `confirmBooking`:** ovo je jedina operacija gde slepo ponavljanje posle timeout-a može izazvati duplu rezervaciju (mrežni timeout ne znači da poziv nije uspeo na strani provajdera). Svaki poziv nosi jedinstveni `idempotency_key` (generisan u M5 po pokušaju rezervacije); pre bilo kog ponovnog pokušaja, M4 prvo proverava `ProviderCallLog` da li je taj `idempotency_key` već poslat i sa kojim ishodom, umesto da automatski ponovi poziv. Ovo je direktna primena principa #4 (determinizam pre autonomije) — greška ovde je novac, ne kozmetika.
- **Retry dozvoljen** samo za operacije koje se sigurno mogu ponoviti bez posledice (`search`, `getStaticContent`, `checkAvailabilityAndPrice`) — do 2 pokušaja sa kratkim razmakom.

### 4.1 Circuit breaker — privremeno isključivanje provajdera koji stalno pada

Pored timeout-a po pozivu, M4 formalno prati stanje **kola (circuit)** po provajderu (`ProviderConfig.circuit_state`, poglavlje 3.1):

- **`CLOSED`** (normalno) — pozivi idu ka provajderu kao i inače; svaka greška se broji.
- Kad broj uzastopnih grešaka dostigne `circuit_failure_threshold`, kolo prelazi u **`OPEN`** — M4 **prestaje da zove** taj provajder (isti efekat kao degradacija iz gornje tačke, ali proaktivno, ne čeka svaki pojedinačni timeout) do isteka `circuit_cooldown_seconds`.
- Posle `circuit_cooldown_seconds`, kolo prelazi u **`HALF_OPEN`** — pušta se tačno jedan probni poziv; uspeh vraća kolo u `CLOSED`, neuspeh ga vraća u `OPEN` sa novim odbrojavanjem.

Svaka promena `circuit_state` se beleži u `ProviderCallLog` i, za prelazak u `OPEN`, generiše `HealthSignal` (M18 poglavlje 2.1, tip `PROVIDER_ERROR_SPIKE`) — tim se obaveštava da je provajder isključen, ne mora sam da otkrije obrazac u logovima. Potvrđeno poređenjem sa PrimeTravel `circuit.breaker.ts` obrascem (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 2).

---

## 5. Travelgate adapter — implementaciona napomena

Travelgate izlaže GraphQL API (poglavlje 6 Master dokumenta). Travelgate adapter je jedino mesto u celom sistemu koje govori GraphQL — unutar `search`/`getStaticContent`/itd. implementacije, adapter šalje GraphQL upite i mapira odgovor u `NormalizedSearchResult`/`NormalizedContent`/`AvailabilityQuote`/`BookingConfirmation`. Ni M2 ni M5 ni bilo koji drugi modul ne vidi GraphQL — to je granica adaptera.

---

## 5a. Solvex (Master-Interlook) adapter — implementaciona napomena

*(dodato v1.3, avgust 2026, na zahtev vlasnika — drugi HOTEL adapter uz Travelgate, ne zamena)*

Solvex izlaže **SOAP/XML API** (`https://iservice.solvex.bg/IntegrationService.asmx` u test okruženju — produkcioni URL/kredencijali se dobijaju odvojeno od Solvex-a pre prelaska u `ProviderConfig.status = ACTIVE`). Solvex adapter je jedino mesto u sistemu koje govori SOAP — mapira XML zahteve/odgovore u isti `NormalizedSearchResult`/`NormalizedContent`/`AvailabilityQuote`/`BookingConfirmation` oblik kao Travelgate adapter (poglavlje 2.1). Ni M2 ni M5 ne vide razliku između izvora.

**Osnovni tok (potvrđen radeći test poziv, avgust 2026):**
1. `Connect(login, password)` → GUID token, koristi se kao `SESSION_TOKEN` (poglavlje 2.2) u svakom narednom pozivu.
2. Pretraga: `SearchHotelServicesMinHotel` (minimalna cena po hotelu — mapira se u `search()`) ili `SearchHotelServices` (sve opcije, koristi se samo ako je potrebna puna lista tarifa).
3. Sadržaj: `GetHotels`/rečnici (`GetCountries`, `GetCities`, `GetRegions`, `GetRoomType`, `GetPansions`) — koriste se za `getStaticContent()` i inicijalno punjenje šifarnika, ne pozivaju se po svakoj pretrazi (kandidat za keširanje na nivou adaptera, odvojeno od M2 lenjog keširanja).
4. Rezervacija: `CreateReservation` → `providerBookingReference = ExternalID` iz odgovora; `GetReservation`/`CancelReservation` koriste taj isti `ExternalID`.
5. `QuotaType` (`1`=dostupno, `0`=na zahtev, `2`=stop sales) mapira se u `AvailabilityQuote` — vrednost `0` ("na zahtev") odgovara istom `PENDING_SUPPLIER_CONFIRMATION` statusu koji `BookingConfirmation` već predviđa (poglavlje 2.1), ne novom stanju.

**Napomena o poreklu:** ovaj tok je potvrđen radom na ranijem, srodnom projektu (PrimeTravel) — test `Connect` i `GetCountries` pozivi rade i danas (avgust 2026) sa istim test kredencijalima, što je bilo direktno provereno (izolovan spike, van ovog repozitorijuma) pre pisanja ove dopune. Sam kod adaptera se ne prenosi automatski — piše se iznova po ugovoru iz poglavlja 2, PrimeTravel implementacija služi samo kao referenca za tok poziva i poznata ograničenja.

**Upozorenje — zvanična/skraćena dokumentacija Solvex-a ne odgovara stvarnom ugovoru.** Isti spike je pokazao da je jednostavan, "flat" primer poziva (kakav se nalazi u uobičajenoj Solvex README skici) netačan za stvarni WSDL. Adapter mora da poštuje sledeće, potvrđeno radom na PrimeTravel implementaciji:

- `GetCities` prima `countryKey` + `regionKey` (oba obavezna cela broja), ne `CityID`/`CountryID`.
- `SearchHotelServicesMinHotel`/`SearchHotelServices` ne primaju ravne parametre nego ugnježđen `request` objekat (`SearchHotelServiceRequest` tip) sa **strogim redosledom polja nametnutim WSDL `sequence`-om** — pogrešan redosled vraća SOAP grešku, ne validacionu poruku. Poznata radna kombinacija: `PageSize`, `RowIndexFrom`, `DateFrom`, `DateTo`, `CityKeys`/`HotelKeys` (kao `{int: [...]}`, ne prost niz), `Pax` (zbir odraslih+dece), `Tariffs: {int: [0, 1993]}` (Ordinary + Non-Refundable), `ResultView: 1`, `Mode: 0`, `QuotaTypes: {int: [0, 1]}`.
- Filtriranje po pansionu (`PansionKeys`) i kategoriji/zvezdama (`CategoryKeys`) na strani Solvex servera je nepouzdano u praksi (vraćalo je HTTP 500 "Pansion with key - X is not found") — adapter filtrira po pansionu/zvezdama **posle** prijema odgovora, na strani M4, ne šalje taj filter Solvex-u.
- Solvex ne vraća pouzdano polje za broj zvezda hotela — potrebna je heuristička ekstrakcija iz teksta opisa/naziva (regex na obrasce tipa `"4*"`, `"4 stars"`) pri mapiranju u `NormalizedContent`, uz jasno obeležavanje kad ekstrakcija nije uspela (ne pretpostaviti 0 zvezda kao pouzdan podatak).
- Odgovor pretrage je **ADO.NET diffgram/DataSet XML** (ugnježđena `Data → DataRequestResult → ResultTable → diffgram → DocumentElement → HotelService[]` putanja), sa najmanje 3 poznata alternativna oblika zavisno od verzije odgovora — parser mora fleksibilno da proba sve poznate putanje, ne pretpostaviti jedan fiksni oblik.
- Polja u pojedinačnom `HotelService` redu ne zovu se kao u pojednostavljenoj dokumentaciji: `HotelKey` (ne `HotelID`), `RtKey`/`RcKey`/`AcKey`/`PnKey` (tip/kategorija/smeštaj/pansion sobe), `QuoteType` (ne `QuotaType` — proveriti tačan naziv polja pri implementaciji, viđene su obe varijante u različitim odgovorima).

Ova lista je namerno detaljna: cilj je da implementacija adaptera krene od potvrđenih, radnih vrednosti umesto da ponovo otkriva iste probleme (500 greške na filterima, pogrešan redosled polja) koje je PrimeTravel već rešio.

---

## 5b. WebHotelier adapter — implementaciona napomena

*(dodato v1.8, avgust 2026, na zahtev vlasnika — treći HOTEL adapter uz Travelgate i Solvex; konkretna, potvrđena poslovna potreba — direktno povezivanje sa pojedinačnim hotelima koji WebHotelier koriste kao sopstveni booking engine/PMS, za razliku od Travelgate (agregator preko GraphQL) i Solvex (wholesale preko SOAP). Vidi §9 za otvorenu napomenu o ovoj razlici u profilu provajdera.)*

WebHotelier izlaže **REST/HTTP API** (`https://rest.reserve-online.net`, javna dokumentacija: `docs.webhotelier.net`). Za razliku od Travelgate (GraphQL) i Solvex (SOAP/XML), WebHotelier je najbliži uobičajenom REST obrascu u sistemu — XML/JSON/HTML formati birani preko `Accept` header-a (JSON preporučeno od strane provajdera), auth strategija `BASIC` (poglavlje 2.2 — **postojeća** strategija, ne treba nova implementacija, za razliku od Solvex-a koji je zahtevao `SESSION_TOKEN`).

**Preduslov — nalog mora biti "Travel Agent API Account".** WebHotelier razlikuje tri tipa naloga:
- **Hotelier** — vezan za jedan hotel, pun pristup samo za taj hotel, retail cena.
- **Source-bound** — ograničen na set hotela, automatski beleži izvor rezervacije.
- **Travel Agent** — ograničen na set hotela, **vraća neto B2B cenu** (polja `retail`/`margin` se dodatno pojavljuju uz `price`) i jedini tip koji dozvoljava multi-property pretragu (`/availability` bez property koda).

Za naš scenario (agencija, neto cena, konkretan set hotela) treba **Travel Agent nalog** — ovo mora biti eksplicitno zatraženo pri dobijanju kredencijala od svakog hotela/WebHotelier-a, ne pretpostavljeno.

**Mapiranje toka (potvrđeno iz javne WebHotelier dokumentacije; za razliku od Solvex-a još nema izolovanog live spike testa protiv pravog naloga — vidi §9):**

1. **Auth**: Basic HTTP header (`Authorization: Basic base64(user:pass)`) na svaki poziv — nema posebnog login/token poziva, za razliku od Solvex `SESSION_TOKEN`.
2. **`search()`** → `GET /availability` (multi-property, samo Travel Agent/Source nalog; parametar `properties` prihvata do 300 property koda odjednom — koristi se kad je unapred poznat tačan set hotela, naš uobičajen slučaj "specifična konekcija sa konkretnim hotelima") ili `GET /availability/{propertycode}` (single-property, radi i za Hotelier nalog) → mapira `data.hotels[].rates[]` u `NormalizedSearchResult[]`. `quotaStatus` mapiranje: WebHotelier ne izlaže eksplicitan enum kao Solvex `QuotaType` — hotel se jednostavno ne pojavljuje u odgovoru (ili `error_code = NO_AVAILABILITY`/`NO_HOTELS_FOUND`) kad nema dostupnosti; svaka vraćena stavka je `AVAILABLE`. Nema poznatog WebHotelier ekvivalenta za `ON_REQUEST` (vidi tačku 5).
3. **`getStaticContent()`** → `GET /property/{propertycode}` (URL vraćen kao `infourl` u availability odgovoru) → mapira u `NormalizedContent`. `rating` polje je pouzdano brojčano (za razliku od Solvex heurističke ekstrakcije iz teksta, poglavlje 5a) — kad nije definisano, WebHotelier ga vraća kao `0`, što ovde **stvarno znači** "nema ocene" po dokumentaciji provajdera (ne dvosmisleno kao kod Solvex-a), pa se `0` sme mapirati u `null` bez heuristike.
4. **`checkAvailabilityAndPrice()`** → WebHotelier nema poseban "quote" metod odvojen od pretrage — cena/dostupnost se čita iz istog `GET /availability/{propertycode}` poziva, filtrirano na traženi `rate id`. `quoteExpiresAt` **nije polje koje WebHotelier vraća** (razlika u odnosu na ugovor iz poglavlja 2.1) — adapter mora sam postaviti konzervativan TTL (tačna vrednost otvorena, §9); WebHotelier-ova strana zaštite od zastarele cene je greška `INVALID_PRICE` na `/book` (tačka 5 ispod), ne isteka ponude na našoj strani.
5. **`confirmBooking()`** → `POST /book/{propertycode}` → mapira u `BookingConfirmation`; `res_id` iz odgovora postaje `providerBookingReference`. Sve uspešne rezervacije vraćaju `result: "CONFIRMED"` odmah — dokumentacija ne pominje "na zahtev" tip potvrde kao Solvex `QuotaType = 0`, pa `PENDING_SUPPLIER_CONFIRMATION` se **ne koristi** za ovaj adapter dok se suprotno ne potvrdi uživo. Greška `ALLOT_DEPLETED` → `status: "FAILED"`. Greška `INVALID_PRICE` → `status: "FAILED"` sa porukom da se cena promenila između provere i potvrde (`price` parametar u `/book` mora tačno odgovarati trenutnoj ceni, WebHotelier je striktno proverava server-side). `/book` nema `idempotency_key` parametar na strani provajdera — ovo nije problem za ugovor iz poglavlja 4, jer se idempotentnost sprovodi na M4 strani (provera `ProviderCallLog`) pre poziva, ne oslanjanjem na provajdera.
6. **`cancelBooking()`** → `POST /reservation/cancel/{res_id}` → mapira u `CancellationResult`. Napomena — dokumentacija eksplicitno stavlja odgovornost primene penala na API korisnika ("Failure to do so may result in a ban"): adapter mora pročitati `cancellation_penalty_amount`/`cancellation_penalty_currency` iz odgovora i proslediti ih dalje M5/M10 za obračun povraćaja — nikad pretpostaviti pun povraćaj.

**`cancellationPolicy` mapiranje** — WebHotelier vraća `cancellation_fees` kao niz `{ after: ISO 8601 date, fee: MONEY }` (fiksan iznos, ne procenat, i dostupan samo kad se pošalje `payments=1` u availability pozivu) — različit oblik od ugovora u poglavlju 2.1. Adapter mora: (a) izračunati `days_before_stay` iz razlike `checkin` datuma i `after` datuma; (b) izračunati `refund_percentage = 100 - round(fee / price * 100)` — isto rešenje kao Solvex `IsPercent = false` slučaj (poglavlje 2.1), ne novi, adapter-specifičan pristup.

**Napomena o poreklu:** za razliku od Solvex adaptera (poglavlje 5a), ovaj tok je mapiran isključivo iz javne WebHotelier dokumentacije (`docs.webhotelier.net`) pregledane avgusta 2026 — nema ranijeg PrimeTravel rada na ovom provajderu niti potvrđenog live poziva. Implementacija treba da krene u `use_mock` režimu (poglavlje 9, `MockProviderAdapter`) dok se ne dobiju stvarni Travel Agent kredencijali za konkretan hotel/hotele, isto kao što je Travelgate rađen bez live kredencijala.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M4/provider-config/VIEW` | Vlasnik, Direktor |
| `M4/provider-config/CREATE`, `EDIT` | Vlasnik, Direktor |
| `M4/provider-call-log/VIEW` | Vlasnik, Direktor |
| **Operativni endpoint-i (`/internal/providers/...`, poglavlje 7)** | **zahtevaju `M4/provider-config/EDIT`** — dakle Vlasnik, Direktor |

Napomena: M4 je pretežno mašina-mašini sloj (pozivaju ga M2/M5 interno) — ovlašćenja iznad su samo za administrativni uvid/podešavanje provajdera, ne za svakodnevnu upotrebu.

**Dopuna 3.9.2026 (vlasnikova odluka) — zašto operativni endpoint-i traže dozvolu, i zašto baš tu.** Do ove verzije kontroler operativnih poziva nosio je samo `JwtAuthGuard`, bez ijedne `@RequirePermission`. Pošto je `POST /iam/auth/register` (M1) javan i pravi nalog odmah u statusu `ACTIVE`, to je značilo da svako ko se sam registruje kao gost može pozvati `search` (neto cene provajdera, bez marže), `bookings` (stvarna rezervacija kod spoljnog dobavljača) i `bookings/:ref/cancel`. Rečenica „poziva ih isključivo M2/M5" iz poglavlja 7 opisivala je nameru, ne ogradu — a namera bez sprovođenja nije zaštita (vidi zamku 13.3 u `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`).

Odabrana je **postojeća** dozvola `M4/provider-config/EDIT` umesto nove (`M4/provider-operation/EXECUTE`) iz dva razloga: (1) ništa u sistemu ne poziva ove endpoint-e preko HTTP-a — M5 koristi `IntegrationsService` direktno kroz ubrizgavanje zavisnosti (`SearchService`, `QuoteItemBuilderService`, `BookingsService`), pa zatvaranje ne može pokvariti tok prodaje; (2) uz nula stvarnih HTTP pozivalaca, nova dozvola u M1 katalogu i seed skripti bila bi više pokretnih delova nego što problem traži. Ako ovi endpoint-i ikad dobiju stvarnog spoljnog pozivaoca (npr. servisni nalog nekog budućeg alata), tada se uvodi zasebna `provider-operation` dozvola — dotle su to alat za dijagnostiku u rukama Vlasnika/Direktora („da li Travelgate uopšte odgovara").

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/integrations`

**Administrativni (za interni panel):**
| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/providers` | GET / POST | lista / dodavanje konfiguracije provajdera |
| `/providers/:code` | GET / PATCH | uključivanje/isključivanje, izmena kredencijala |
| `/provider-call-logs` | GET | filtrirano po provajderu/operaciji/datumu/statusu, za dijagnostiku |

**Interni (poziva ih isključivo M2/M5, nisu izloženi kanalima poput sajta ili B2B portala) — svi zahtevaju `M4/provider-config/EDIT` (poglavlje 6, dopuna 3.9.2026):**

> U redovnom radu M2/M5 **ne prolaze kroz ove HTTP endpoint-e** nego pozivaju `IntegrationsService` direktno unutar procesa. Endpoint-i ispod postoje kao administrativni/dijagnostički ulaz, i dozvola iznad je stvarna ograda, ne opis namere.

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/internal/providers/:code/search` | POST | vraća `NormalizedSearchResult[]` |
| `/internal/providers/:code/content/:externalId` | GET | vraća `NormalizedContent` |
| `/internal/providers/:code/availability` | POST | vraća `AvailabilityQuote` |
| `/internal/providers/:code/bookings` | POST | `confirmBooking`, zahteva `idempotency_key` |
| `/internal/providers/:code/bookings/:ref/cancel` | POST | `cancelBooking` |

---

## 8. Izlazni kriterijum (M4 deo Faze 1)

- [x] Travelgate adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti. *(dokazano unit testom sa mokovanim `fetch`, avgust 2026; nema stvarnih Travelgate kredencijala — live poziv nije proveren, vidi §9)*
- [ ] Rezultati pretrage se ispravno normalizuju i M2 lenjo keširanje radi kraj-do-kraja (vidi M2 spec). *(normalizacija dokazana; M4→M2 poziv koji stvarno kreira `CACHED` zapis u trenutku prve pretrage nije povezan — čeka M5, koji pokreće pretragu)*
- [ ] `AvailabilityQuote` poštuje `quoteExpiresAt` — M5 odbija potvrdu rezervacije sa isteklom ponudom i traži novu proveru. *(M4 strana popunjava `quoteExpiresAt`; provera na potvrdi je M5 odgovornost, M5 još ne postoji)*
- [x] Test simuliranog timeout-a pri `confirmBooking` sa ponovljenim pokušajem ne pravi duplu rezervaciju (provera preko `idempotency_key`). *(dokazano e2e testom, avgust 2026 — drugi poziv sa istim `idempotency_key` vraća sačuvan ishod bez ponovnog pozivanja adaptera, čak i kad bi adapter odbio poziv)*
- [ ] Simulirani pad Travelgate-a ne ruši pretragu — ostali izvori i dalje vraćaju rezultate, greška je zabeležena. *(M4 sam po sebi ne agregira više provajdera u jednom pozivu — to je M5 posao (pozvati M4 po provajderu i uhvatiti pojedinačni neuspeh); M4 strana — da pad jednog provajdera ne obori M4 proces — dokazana kroz circuit breaker/error-handling testove)*
- [x] Kredencijali provajdera enkriptovani u bazi, nikad u čistom tekstu u logovima (`ProviderCallLog.request_summary` redaktovan). *(dokazano e2e testom, avgust 2026 — `authConfigEncrypted` nikad u API odgovoru; `request_summary` redaktuje password/login/GUID/apiKey/guestName pre upisa)*
- [x] Provajder sa `circuit_failure_threshold` uzastopnih grešaka prelazi u `OPEN` i M4 prestaje da ga zove do isteka `circuit_cooldown_seconds`, potom šalje tačno jedan probni poziv (`HALF_OPEN`). *(dokazano e2e testom, avgust 2026 — uklj. da blokiran poziv u OPEN stanju stvarno ne dotiče adapter)*
- [x] Svaki zapis u `ProviderCallLog` ima popunjen normalizovan `error_code` kad poziv ne uspe, nezavisno od stvarnog HTTP/GraphQL statusa provajdera. *(dokazano e2e testom, avgust 2026)*
- [x] `ProviderConfig` ne može preći u `ACTIVE` bez popunjenog `default_tip_nastupanja` (poglavlje 3.1), isto sprovođenje kao M3 `Contract`. *(dokazano unit + e2e testom, avgust 2026)*
- [x] Solvex adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti (poglavlje 5a); `SESSION_TOKEN` strategija ispravno osvežava token po grešci tipa "nevažeći token", ne na fiksni raspored. *(dokazano unit testom, avgust 2026; SOAP envelope/parsing format dodatno potvrđen uživo protiv pravog Solvex evaluation servera — Connect/GetCountries su vratili ispravno formiran XML — ali sami test kredencijali su trenutno odbijeni na serveru, verovatno IP whitelist; vidi §9)*
- [x] Solvex `QuotaType = 0` ("na zahtev") mapira se u `BookingConfirmation.status = PENDING_SUPPLIER_CONFIRMATION`, isto ponašanje kao `ON_REQUEST` alotman u M3 — provereno da M5 ne pravi razliku po poreklu. *(M4 strana mapiranja dokazana unit testom za Solvex i analogno za Travelgate `ON_REQUEST`; da M5 stvarno ne grana kod po poreklu čeka M5)*
- [x] Šifarnici (države/gradovi/tipovi soba/pansioni) se keširaju po provajderu i ne pozivaju se iznova pri svakoj pretrazi (poglavlje 2.4) — test: dva uzastopna `search()` poziva u istom TTL prozoru ne generišu dva poziva ka spoljnom šifarniku. *(dokazano unit testom, avgust 2026 — `DictionaryCacheService`, korišćen u Solvex adapteru za `GetCities`)*
- [x] `search()` nikad ne vraća više od `capabilities_profile.maxResultsPerSearch` stavki (podrazumevano 50), sečenje se dešava u M4 pre vraćanja pozivaocu. *(dokazano unit + e2e testom, avgust 2026)*
- [ ] `NormalizedSearchResult` sadrži tačno definisan, tanak skup polja (poglavlje 2.1) — test: veličina serijalizovanog odgovora `search()` za 50 rezultata ostaje u razumnoj, dokumentovanoj granici (definiše se konkretan broj pri implementaciji), ne raste linearno sa punim sadržajem svakog hotela. *(oblik je tanak i implementiran; konkretan brojčani prag za veličinu odgovora nije definisan niti testiran)*
- [x] `AvailabilityQuote.cancellationPolicy` je uvek niz `{ days_before_stay, refund_percentage }`, isti oblik kao M3 `CancellationRule` (poglavlje 2.1) — test: M5 obračun otkazivanja/povraćaja radi identičnim kodom nad rezervacijom iz M3 i rezervacijom iz M4, bez grananja po poreklu. *(M4 strana — oba adaptera vraćaju tačno taj oblik — dokazana unit testom, avgust 2026; da M5 stvarno koristi identičan kod čeka M5)*
- [x] WebHotelier adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti (poglavlje 5b); `BASIC` auth strategija radi bez izmene postojeće implementacije. *(dokazano unit testom sa mokovanim `fetch`, avgust 2026 — `apps/api/src/modules/m4-integracije-api/adapters/webhotelier.adapter.ts`; nema stvarnih Travel Agent kredencijala — live poziv nije proveren, vidi §9, isto stanje kao Travelgate)*
- [x] WebHotelier `cancellation_fees` (fiksan iznos + datum) ispravno mapiran u `{ days_before_stay, refund_percentage }` (poglavlje 5b) — test: poznat primer sa `fee`/`after`/`price` daje očekivan `refund_percentage`. *(dokazano unit testom, avgust 2026)*
- [x] API dokumentacija (`docs/api/M4-integracije-api.md`) postoji sa primerima zahteva/odgovora za svaki endpoint iz poglavlja 7 — obavezna stavka po CLAUDE.md. *(napisana 3.9.2026; za razliku od M1/M2/M3, oblici odgovora su izvedeni iz koda adaptera jer u bazi nema nijedne `ProviderConfig` — `GET /providers` i `/provider-call-logs` vraćaju `[]`, uhvaćeno pozivom — a pravi pozivi zahtevaju kredencijale kojih nema; to je u dokumentu izričito označeno)*
- [x] Objašnjenje za vlasnika (`00-OBJASNJENJE-M4-ZA-VLASNIKA.md`) postoji — obavezna stavka po CLAUDE.md. *(napisano 3.9.2026)*
- [x] **Operativni endpointi `/internal/providers/...` odbijaju poziv sa naloga bez `M4/provider-config/EDIT`.** *(zatečeno i ispravljeno 3.9.2026. Zatečeno stanje: kontroler je nosio samo `JwtAuthGuard`, nijednu `@RequirePermission`, a globalno je registrovan samo `ThrottlerGuard` — pošto je `POST /iam/auth/register` javan i pravi odmah `ACTIVE` `GUEST` nalog, svako sa sajta je mogao pozvati `search` (neto cene bez marže), `bookings` (stvarna rezervacija kod provajdera) i `bookings/:ref/cancel`. Ispravka po vlasnikovoj odluci (poglavlje 6, dopuna): `@RequirePermission('M4','provider-config','EDIT')` na svih pet ruta, `PermissionsModule` dodat u `IntegrationsModule`. Dokazano e2e testovima — odbijanje za nalog bez dozvole, prolaz za nalog sa njom, i posebna provera da ograda stoji na svih pet ruta. Zamka 13.3 ostaje zapisana (obrazac „namera u spec-u bez sprovođenja u kodu" nije strukturno uklonjen).*

  **Dva nalaza iz same ispravke, oba zapisana kao zamke:** (1) postojeći e2e test je tvrdio suprotno — „interni endpoint je dostupan svakom autentikovanom internom korisniku, bez posebne dozvole" — i prolazio je, pa je rupa bila upisana kao očekivano ponašanje, ne previd (zamka 13.6); (2) prva verzija ispravke stavila je `@RequirePermission` na klasu kontrolera, što `PermissionsGuard` **tiho ignoriše** jer čita metapodatak samo sa `context.getHandler()` — ograda bi izgledala postavljeno a propuštala bi sve (zamka 13.5).
- [x] Greška provajdera stiže do pozivaoca sa prepoznatljivim razlogom, ne kao opšti `500`. *(zatečeno i ispravljeno 3.9.2026. Zatečeno: `ProviderError` nasleđuje obični `Error`, ne `HttpException`, i nije postojao `ExceptionFilter` koji ga mapira — svih sedam vrsta izlazilo je kao `{"statusCode":500,"message":"Internal server error"}`, pa pozivalac nije mogao razlikovati „hotel je pun" od „pogrešni pristupni podaci". Ispravka: `ProviderExceptionFilter` (`apps/api/src/common/filters/provider-exception.filter.ts`), registrovan globalno uz `PrismaExceptionFilter`. Mapiranje: `NO_AVAILABILITY`→`409`, `INVALID_REQUEST`→`400`, `RATE_LIMITED`→`429`, `TIMEOUT`→`504`, `PROVIDER_UNAVAILABLE`→`503`, `AUTH_FAILED`/`UNKNOWN`→`502`; tačna vrsta uvek i u telu kao `providerErrorCode`, jer statusni kod ne razlikuje `AUTH_FAILED` od `UNKNOWN`. Filter, a ne pretvaranje u `HttpException` na mestu bacanja, jer se `ProviderError` baca i u putanjama koje ne idu preko HTTP-a (M5 zove `IntegrationsService` direktno i sam grana po `code`) — servisni sloj ne sme da zna za HTTP statuse. Dokazano e2e testom za svih sedam vrsta. Zamka 13.4 ostaje zapisana)*

---

## 9. Otvoreno za dalje

- ~~M17 panel prikaz `GET /integrations/providers`~~ — **rešeno 23.8.2026**, na zahtev vlasnika: `apps/panel/src/app/(app)/integracije/page.tsx`, spaja ovaj endpoint sa M18 `/ops/provider-health` u jedan prikaz ("API konekcije", grupa "Administracija"). M17 spec v2.00.
- Konkretni adapteri za buduće kategorije (GDS/avio, transferi, aktivnosti) implementiraju se kad ti proizvodi dođu na red — isti `ProviderAdapter` interfejs, bez redizajna M4.
- **Preduslov za bilo koji od dva MCP nalaza ispod: provera identiteta pre pristupa agenta** (M15 spec poglavlje 6.5.6d, dopuna 28.8.2026, povod: vlasnik razmatrao dodavanje MCP konektora pronađenog preko medijskog članka, ne zvaničnog sajta dobavljača) — nijedan MCP konektor ne postaje dostupan agentu bez `ACTIVE` zapisa u M15 `TrustedMcpConnector` sa potvrđenim identitetom (`OFFICIAL_SITE_LISTED`/`DIRECT_VENDOR_CONTACT`), nezavisno od toga koliko dobro funkcionalno radi (ova M4 analiza proverava SAMO ponašanje/filtere, ne identitet servera).
- **Tri MCP konektora za pretragu smeštaja (Expedia, Novasol, Booking.com) — empirijski testirani, NIJEDAN još usvojen kao M4 adapter** (28.8.2026, vlasnik dostavio nalaze testiranja) — konkretno ponašanje/greške/format po provajderu zapisani u `05-ANALIZA-MCP-KONEKTORI-SMESTAJ.md` u ovom folderu (npr. Expedia tiho ignoriše većinu filtera bez greške, Novasol nema koncept zvezdica/pansiona jer je smeštaj bez usluge, samo Booking.com ima pravi `meal_plan` parametar). Odluka da li se, koji i kako (MCP tool-poziv naspram tradicionalnog REST `ProviderAdapter`, poglavlje 2) integriše čeka vlasnika — MCP obrazac poziva je strukturno drugačiji od Travelgate/Solvex/WebHotelier SOAP/REST adaptera opisanih u poglavlju 5/5a/5b, verovatno zahteva sopstvenu implementacionu napomenu (buduće poglavlje 5c/5d), ne prosto još jedan `ProviderAdapter` po istom ugovoru.
- **TravelgateX/HotelX (pravi B2B GraphQL API, isti `05-ANALIZA-MCP-KONEKTORI-SMESTAJ.md`, poglavlje 5)** — dopuna 28.8.2026, iz dokumentacije, ne live poziva (postojeći MCP konektor za TravelgateX samo pretražuje njihovu dokumentaciju, nema pravi API pristup). Napomena da postojeći `existing Travelgate` adapter (poglavlje 5 ovog spec-a) je DRUGA stvar — taj je pisan protiv Travelgate-a kao content/booking API-ja generalno; HotelX specifikacija u analizi je precizniji, noviji uvid u isti ekosistem (Seller/Buyer/FastX terminologija, obavezan Search→Quote→Book tok, DeltaPrice tolerancija, Look-to-Book ograničenje) koji vredi uporediti sa postojećim adapterom pre bilo koje izmene — nije potvrđeno da li se implementacija poglavlja 5 uklapa u ovaj tok ili zahteva reviziju.
- Tačni limiti brzine poziva (rate limiting) po provajderu definišu se kad se zna stvarni Travelgate ugovor i njegova ograničenja — za sada M4 samo predviđa mesto (`ProviderConfig`) gde se ti limiti mogu podesiti.
- Ako se pronađe raniji "Travelgate predlog" pomenut u Master dokumentu, ovaj dokument treba uporediti sa njim i uskladiti razlike, ne pisati dva paralelna izvora istine za M4.
- **Solvex produkcijski i test pristup** — ranije zabeleženi test kredencijali (`sol611s`, potvrđeni aktivni jul 2026 na drugom računaru) su pri ponovnoj proveri (avgust 2026, ova implementacija) server odbio sa "Invalid login or password" — najverovatniji uzrok IP whitelist (SOAP protokol/format je uživo potvrđen ispravnim, `GetCountries` je vratio prave podatke), ne pogrešni kredencijali. Ni produkcioni URL/kredencijali nisu dobijeni. `ProviderConfig.status` ostaje `INACTIVE` do rešenja bilo kog od ova dva.
- **Dedup istog fizičkog hotela preko više provajdera** (Travelgate, Solvex i sada WebHotelier mogu vratiti isti hotel sa različitim `externalId`) — M2 trenutno nema definisan mehanizam mapiranja/spajanja (npr. GIATA-stil mapiranje, korišćeno u PrimeTravel-u); dok se ne reši, tretiraju se kao odvojeni `Product` zapisi dok se svesno ne doda dedup sloj.
- Tačan TTL keša šifarnika po provajderu (poglavlje 2.4) — 24h je polazna pretpostavka, dorađuje se pri implementaciji ako se pokaže da se šifarnici nekog provajdera menjaju češće.
- Ostali PrimeTravel provajderi (ORS, MTS Globe, Amadeus, Travelport, Duffel...) se namerno ne dodaju u M4 dok ne postoji potvrđena poslovna potreba (stvaran ugovor/odnos) — Travelgate + Solvex su dovoljna dva strukturno različita primera da su validirali `ProviderAdapter` ugovor; dodavanje bez potrebe bi bilo isto širenje obima bez svrhe koje je PrimeTravel iskustvo pokazalo kao problem.
- **MARS ERP (NeoLab) — mogući budući adapter ka internom back-office sistemu TTA, ne ka dobavljaču proizvoda** (predlog vlasnika, dostavljen kao gotov draft "M-26 MARS Connector", 21.8.2026; odluka vlasnika istog dana: ide kroz M4, ne kao poseban modul — vidi `docs/analize/34-PREDLOG-MARS-CONNECTOR.md`). TTA trenutno koristi MARS (NeoLab) kao back-office za rezervacije, cenovnike/dostupnost i finansije/fakture, HTTP Basic Auth (`marsapi.stoplight.io`). Za razliku od Travelgate/Solvex/WebHotelier, MARS nije dobavljač turističkog proizvoda gostu — to je TTA-in sopstveni operativni sistem, pa je odluka vlasnika da se tretira kao još jedna konekcija kroz M4 arhitekturu (isti `AuthStrategy`/`ProviderCallLog`/circuit breaker obrazac), a ne kao paralelan "sistem zapisa" mimo M3/M5/M10 — time otpada napetost oko toga ko je izvor istine za rezervacije/cene/fakture (M3/M5/M10 ostaju izvor istine; MARS sinhronizacija hrani/prima podatke kroz njih preko M4, isto kao što Travelgate/Solvex hrane M2/M5). Otvoreno pre bilo kakve implementacije: (a) `ProviderAdapter.category` enum (poglavlje 2, danas `HOTEL | FLIGHT | TRANSFER | ACTIVITY | INSURANCE`) ne pokriva ovaj slučaj — MARS ne prodaje inventar gostu, sinhronizuje TTA sopstvene rezervacije/cene/fakture, pa `search()`/`confirmBooking()` oblik ugovora iz poglavlja 2 verovatno ne odgovara direktno; treba ili nova kategorija/podskup operacija, ili se MARS sinhronizacija modeluje van `ProviderAdapter` ugovora, unutar M4 kao poseban servis koji deli samo `AuthStrategy`/`ProviderCallLog`/circuit breaker infrastrukturu — odluka se donosi kad se piše implementaciona napomena (buduće poglavlje 5c), ne sada; (b) originalni predlog (§6, §7) eksplicitno ostavlja TTA interni API contract i pravi MARS API contract kao placeholder — čeka se pun uvid u Stoplight dokumentaciju pre pisanja; (c) MARS write-flow (concurrency check, human-in-the-loop odobrenje za rezervacije/finansije, `pending_approval`) je koncept koji M4 danas nema ni za jedan adapter (Travelgate/Solvex/WebHotelier su isključivo M5-inicirane rezervacije, ne generički write-back) — ako se MARS write-back gradi, to je proširenje M4 poglavlja 4/5, ne samo novi adapter po postojećem ugovoru; treba razjasniti sa vlasnikom da li write-back uopšte ulazi u prvu fazu ili počinje read-only (originalni predlog §10 Faza 1 je već read-only-first, u skladu sa ovim).
- **Travelfusion kao mogući budući FLIGHT adapter (LCC/regionalni avio prevoznici)** — predlog dopune primljen 19.8.2026 (dokument sa stranom numeracijom modula koja ne postoji u ovom repozitorijumu — M-24/M-20/Meta Muse Glimmer nisu deo Terminal arhitekture, ideja svedena na M4 FLIGHT kategoriju). Istraženo (19.8.2026): Travelfusion nema self-serve sandbox — pristup ide isključivo preko partner onboarding procesa, kredencijali tek posle ugovora; cena (Fast API/JSON vs. XML Direct Connect) nije javna, zahteva direktan kontakt (`sales@travelfusion.com`). Isti gejt kao ostatak ove liste — namerno se ne piše implementaciona napomena (poglavlje 5c) dok ne postoji potvrđen ugovor/pristup, po istom principu kao Duffel/Travelport iznad. Vidi i Atlas Flight Booking Skill zapis ispod za drugi kandidat istog segmenta (NDC-stil, ne LCC agregacija).
- **`SESSION_TOKEN` ponašanje pod konkurentnim pozivima** (poglavlje 2.2) — namerno neodlučeno: da li se jedan token deli/kešira po `ProviderConfig` (jeftinije, rizik da jedan neuspeh obori paralelne pozive) ili se traži po pozivu (skuplje, kosi se sa poglavljem 2.4). Odluka se svesno odlaže do implementacije, kad stvaran obrazac saobraćaja da tačan odgovor — ne pretpostavlja se unapred bez podataka.
- **Rate limit se trenutno samo čita, ne sprovodi.** `capabilities_profile.rateLimit` (poglavlje 2.3) govori M4-u koja je granica provajdera, ali ne postoji definisan mehanizam (red čekanja, token-bucket throttling) koji tu granicu stvarno drži pod paralelnim saobraćajem — danas se prekoračenje otkriva tek iz greške u `ProviderCallLog`.
- ~~Nema definisanog mock/test režima.~~ **Rešeno (avgust 2026):** `ProviderConfig.use_mock` (poglavlje 3.1) — kad je `true`, `ProviderRegistryService` vraća `MockProviderAdapter` (podesivi `failNextCalls`/`failureCode`/`simulateHang`/kanonski rezultati) umesto pravog adaptera, bez obzira na `provider_code`. Koristi se i za e2e testove (circuit breaker, idempotentnost, normalizovan `error_code`) i kao trajna opcija dok Solvex/Travelgate kredencijali nisu dostupni.
- **WebHotelier — nedostaju stvarni kredencijali/property kodovi.** Poglavlje 5b je mapirano isključivo iz javne dokumentacije; treba: (a) Travel Agent nalog kredencijali od WebHotelier-a ili direktno od konkretnog hotela, (b) tačan property code za svaki hotel sa kojim se povezujemo, (c) izolovan spike poziv (npr. `GET /availability/{code}`) da se potvrdi da odgovor stvarno odgovara javnoj dokumentaciji, isti korak koji je za Solvex otkrio netačnosti u zvaničnoj skici (poglavlje 5a). `ProviderConfig.status` ostaje `INACTIVE` dok se ovo ne reši.
- **WebHotelier `quoteExpiresAt` TTL nije definisan od strane provajdera** (poglavlje 5b, tačka 4) — provajder ne vraća isteka ponude, adapter mora sam postaviti konzervativnu vrednost; tačan broj minuta se određuje pri implementaciji.
- **`BookingRequest` (poglavlje 2) ne nosi email gosta** — WebHotelier `/book` traži `email` kao obavezno polje; adapter trenutno šalje placeholder (`noreply@terminaltravel.example`) da zadovolji provajderov ugovor, isti postojeći gap kao izostanak email/adrese u Travelgate/Solvex adapterima. Rešava se kad M5 definiše pun oblik `BookingRequest` (gost mora dobiti pravu potvrdu na svoj email) — do tada nijedan HOTEL adapter ne sme ići u `ACTIVE` stanje za stvarne rezervacije.
- **Test/produkcija nije eksplicitno modelovano.** Solvex ima potpuno različit URL/kredencijal za test i produkciju (potvrđeno spike testom) — nije rečeno da li je to ista `ProviderConfig` sa promenjenim poljima ili dva odvojena reda (`solvex-test`/`solvex-prod`); ovo utiče na bezbednost prelaska (rizik da neko slučajno gađa test iz produkcije).
