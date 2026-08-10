# Specifikacija modula M4 — Integracije spoljnih API konekcija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M4) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje (pisano od nule — raniji "Travelgate predlog" pomenut u Master dokumentu nije pronađen)
**Verzija:** 1.6 — definisan oblik `AvailabilityQuote.cancellationPolicy` (poglavlje 2.1) — sad isti niz `{days_before_stay, refund_percentage}` kao M3 `CancellationRule`, da M5 obračun otkazivanja/povraćaja ne grana logiku po poreklu proizvoda (M3 vs. M4); dodato u poglavlje 9 (otvoreno, ne rešeno sada, svesna odluka pri diskusiji sa vlasnikom): `SESSION_TOKEN` ponašanje pod konkurentnim pozivima, sprovođenje rate limit-a, mock/test režim, eksplicitno modelovanje test/produkcije; avgust 2026, na zahtev vlasnika; v1.5 — definisan `NormalizedSearchResult` (poglavlje 2.1, ranije samo pominjan kao tip); novo poglavlje 2.4 (keširanje šifarnika + gornja granica veličine rezultata pretrage, radi troška poziva i tokena AI agenata); ispravljen `ProviderConfig.auth_strategy` enum (nedostajao `SESSION_TOKEN`, poglavlje 3.1); avgust 2026, na zahtev vlasnika; v1.4 — poglavlje 5a dopunjeno stvarnim, potvrđenim WSDL/parametrima (strog redosled polja, `countryKey`/`regionKey`, diffgram odgovor, nepouzdano server-side filtriranje) posle izolovanog spike testa uživo protiv Solvex-a — prvobitni "flat" primer iz javne Solvex dokumentacije se pokazao netačnim; dodat otvoren zapis o nedostajućem `NormalizedSearchResult` polja-skupu (poglavlje 9); avgust 2026, na zahtev vlasnika; v1.3 — dodat Solvex (Master-Interlook) kao drugi HOTEL adapter uz Travelgate (poglavlje 5a), na osnovu ranijeg PrimeTravel rada na istoj integraciji; dodata `SESSION_TOKEN` auth strategija (poglavlje 2.2) koju Travelgate/OAuth2 model nije pokrivao; avgust 2026, na zahtev vlasnika; v1.2 — dodato `ProviderConfig.default_tip_nastupanja` (poglavlje 3.1), isto rešenje kao M3 poglavlje 2.2a, za API-sourced proizvode bez ugovora u M3 (avgust 2026, na zahtev vlasnika); v1.1 dodato: tipizirane greške, pluggable auth strategije, circuit breaker, deklarativni profil mogućnosti provajdera — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M4/provider-config/VIEW` | Vlasnik, Direktor |
| `M4/provider-config/CREATE`, `EDIT` | Vlasnik, Direktor |
| `M4/provider-call-log/VIEW` | Vlasnik, Direktor |

Napomena: M4 je pretežno mašina-mašini sloj (pozivaju ga M2/M5 interno) — ovlašćenja iznad su samo za administrativni uvid/podešavanje provajdera, ne za svakodnevnu upotrebu.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/integrations`

**Administrativni (za interni panel):**
| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/providers` | GET / POST | lista / dodavanje konfiguracije provajdera |
| `/providers/:code` | GET / PATCH | uključivanje/isključivanje, izmena kredencijala |
| `/provider-call-logs` | GET | filtrirano po provajderu/operaciji/datumu/statusu, za dijagnostiku |

**Interni (poziva ih isključivo M2/M5, nisu izloženi kanalima poput sajta ili B2B portala):**
| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/internal/providers/:code/search` | POST | vraća `NormalizedSearchResult[]` |
| `/internal/providers/:code/content/:externalId` | GET | vraća `NormalizedContent` |
| `/internal/providers/:code/availability` | POST | vraća `AvailabilityQuote` |
| `/internal/providers/:code/bookings` | POST | `confirmBooking`, zahteva `idempotency_key` |
| `/internal/providers/:code/bookings/:ref/cancel` | POST | `cancelBooking` |

---

## 8. Izlazni kriterijum (M4 deo Faze 1)

- [ ] Travelgate adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti.
- [ ] Rezultati pretrage se ispravno normalizuju i M2 lenjo keširanje radi kraj-do-kraja (vidi M2 spec).
- [ ] `AvailabilityQuote` poštuje `quoteExpiresAt` — M5 odbija potvrdu rezervacije sa isteklom ponudom i traži novu proveru.
- [ ] Test simuliranog timeout-a pri `confirmBooking` sa ponovljenim pokušajem ne pravi duplu rezervaciju (provera preko `idempotency_key`).
- [ ] Simulirani pad Travelgate-a ne ruši pretragu — ostali izvori i dalje vraćaju rezultate, greška je zabeležena.
- [ ] Kredencijali provajdera enkriptovani u bazi, nikad u čistom tekstu u logovima (`ProviderCallLog.request_summary` redaktovan).
- [ ] Provajder sa `circuit_failure_threshold` uzastopnih grešaka prelazi u `OPEN` i M4 prestaje da ga zove do isteka `circuit_cooldown_seconds`, potom šalje tačno jedan probni poziv (`HALF_OPEN`).
- [ ] Svaki zapis u `ProviderCallLog` ima popunjen normalizovan `error_code` kad poziv ne uspe, nezavisno od stvarnog HTTP/GraphQL statusa provajdera.
- [ ] `ProviderConfig` ne može preći u `ACTIVE` bez popunjenog `default_tip_nastupanja` (poglavlje 3.1), isto sprovođenje kao M3 `Contract`.
- [ ] Solvex adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti (poglavlje 5a); `SESSION_TOKEN` strategija ispravno osvežava token po grešci tipa "nevažeći token", ne na fiksni raspored.
- [ ] Solvex `QuotaType = 0` ("na zahtev") mapira se u `BookingConfirmation.status = PENDING_SUPPLIER_CONFIRMATION`, isto ponašanje kao `ON_REQUEST` alotman u M3 — provereno da M5 ne pravi razliku po poreklu.
- [ ] Šifarnici (države/gradovi/tipovi soba/pansioni) se keširaju po provajderu i ne pozivaju se iznova pri svakoj pretrazi (poglavlje 2.4) — test: dva uzastopna `search()` poziva u istom TTL prozoru ne generišu dva poziva ka spoljnom šifarniku.
- [ ] `search()` nikad ne vraća više od `capabilities_profile.maxResultsPerSearch` stavki (podrazumevano 50), sečenje se dešava u M4 pre vraćanja pozivaocu.
- [ ] `NormalizedSearchResult` sadrži tačno definisan, tanak skup polja (poglavlje 2.1) — test: veličina serijalizovanog odgovora `search()` za 50 rezultata ostaje u razumnoj, dokumentovanoj granici (definiše se konkretan broj pri implementaciji), ne raste linearno sa punim sadržajem svakog hotela.
- [ ] `AvailabilityQuote.cancellationPolicy` je uvek niz `{ days_before_stay, refund_percentage }`, isti oblik kao M3 `CancellationRule` (poglavlje 2.1) — test: M5 obračun otkazivanja/povraćaja radi identičnim kodom nad rezervacijom iz M3 i rezervacijom iz M4, bez grananja po poreklu.

---

## 9. Otvoreno za dalje

- Konkretni adapteri za buduće kategorije (GDS/avio, transferi, aktivnosti) implementiraju se kad ti proizvodi dođu na red — isti `ProviderAdapter` interfejs, bez redizajna M4.
- Tačni limiti brzine poziva (rate limiting) po provajderu definišu se kad se zna stvarni Travelgate ugovor i njegova ograničenja — za sada M4 samo predviđa mesto (`ProviderConfig`) gde se ti limiti mogu podesiti.
- Ako se pronađe raniji "Travelgate predlog" pomenut u Master dokumentu, ovaj dokument treba uporediti sa njim i uskladiti razlike, ne pisati dva paralelna izvora istine za M4.
- **Solvex produkcijski pristup** — test kredencijali (avgust 2026) su potvrđeno aktivni, ali produkcioni URL/kredencijali nisu dobijeni; `ProviderConfig.status` ostaje `INACTIVE` do tada.
- **Dedup istog fizičkog hotela preko više provajdera** (Travelgate i Solvex mogu vratiti isti hotel sa različitim `externalId`) — M2 trenutno nema definisan mehanizam mapiranja/spajanja (npr. GIATA-stil mapiranje, korišćeno u PrimeTravel-u); dok se ne reši, tretiraju se kao dva odvojena `Product` zapisa dok se svesno ne doda dedup sloj.
- Tačan TTL keša šifarnika po provajderu (poglavlje 2.4) — 24h je polazna pretpostavka, dorađuje se pri implementaciji ako se pokaže da se šifarnici nekog provajdera menjaju češće.
- Ostali PrimeTravel provajderi (ORS, MTS Globe, Amadeus, Travelport, Duffel...) se namerno ne dodaju u M4 dok ne postoji potvrđena poslovna potreba (stvaran ugovor/odnos) — Travelgate + Solvex su dovoljna dva strukturno različita primera da su validirali `ProviderAdapter` ugovor; dodavanje bez potrebe bi bilo isto širenje obima bez svrhe koje je PrimeTravel iskustvo pokazalo kao problem.
- **`SESSION_TOKEN` ponašanje pod konkurentnim pozivima** (poglavlje 2.2) — namerno neodlučeno: da li se jedan token deli/kešira po `ProviderConfig` (jeftinije, rizik da jedan neuspeh obori paralelne pozive) ili se traži po pozivu (skuplje, kosi se sa poglavljem 2.4). Odluka se svesno odlaže do implementacije, kad stvaran obrazac saobraćaja da tačan odgovor — ne pretpostavlja se unapred bez podataka.
- **Rate limit se trenutno samo čita, ne sprovodi.** `capabilities_profile.rateLimit` (poglavlje 2.3) govori M4-u koja je granica provajdera, ali ne postoji definisan mehanizam (red čekanja, token-bucket throttling) koji tu granicu stvarno drži pod paralelnim saobraćajem — danas se prekoračenje otkriva tek iz greške u `ProviderCallLog`.
- **Nema definisanog mock/test režima.** Izlazni kriterijum (poglavlje 8) traži test simuliranog timeout-a i simuliranog pada provajdera, ali spec ne kaže kako se to simulira bez gađanja pravog spoljnog servera — vredi formalizovati `ProviderConfig.use_mock` po uzoru na PrimeTravel `*_USE_MOCK` obrazac.
- **Test/produkcija nije eksplicitno modelovano.** Solvex ima potpuno različit URL/kredencijal za test i produkciju (potvrđeno spike testom) — nije rečeno da li je to ista `ProviderConfig` sa promenjenim poljima ili dva odvojena reda (`solvex-test`/`solvex-prod`); ovo utiče na bezbednost prelaska (rizik da neko slučajno gađa test iz produkcije).
