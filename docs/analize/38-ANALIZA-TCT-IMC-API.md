# Analiza — TCT-IMC API (Travel Connection Technology / Travelsoft)

**Status:** Istraživanje, ne specifikacija. Vlasnik je dobio pristupne kredencijale od TCT-a (`imc-dev.tct.travel`) radi upoznavanja sa API-jem, pre potpisivanja ugovora. Ovaj dokument beleži nalaze iz javno/pristupno pročitane API dokumentacije i primera zahteva/odgovora, upoređene sa već specificiranim M2/M3/M4/M5/M10 modelom. **Nije prošlo kroz `tt-architecture-core` proveru niti je dobilo obim od vlasnika — čista beleška, ne predlog za implementaciju.**

TCT-IMC je proizvod **Travelsoft** grupacije — ista grupacija koja stoji iza Travelsoft Pay, već pomenutog kao kandidat za M10 (vidi `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, stavka "TravelgateX + Travelsoft Pay"). Odgovori sadrže jak signal (`prv_code` prefiks `HB-`) da je **Hotelbeds** osnovni dobavljač (bedbank/wholesaler) iza TCT-IMC agregacije, ne direktni hotelski ugovori.

---

## 1. Tok API-ja (pretraga → kotacija → revalidacija → potvrda)

| Korak | Endpoint | Svrha |
|---|---|---|
| 1a | `POST /v1/hotel/searchSync` | Sinhrona pretraga (blokira do `max_timeout`, do 15 rešenja po `solutions_nr`) |
| 1b | `POST /v1/hotel/search` + `POST /v1/hotel/results` | Asinhrona varijanta — `search` pokreće posao (vraća `search_id`/`search_code` odmah), `results` preuzima (sa `last_check` za inkrementalno pollovanje) |
| 2 | `POST /v1/hotel/valuation` | Revalidacija konkretne ponude (`id`+`code` iz koraka 1) pre potvrde — ponovo proverava cenu/dostupnost, vraća pun `price_breakdown` po noći i uslove otkazivanja |
| 3 | `POST /v1/hotel/hotelDetails` | Pun opis hotela (sirov, po dobavljaču — `provider_id`, ne GIATA-spojen) vezan za `availsearch_id` |
| 4 | `POST /v1/hotel/book` | Potvrda rezervacije |
| 5 | `POST /v1/hotel/bookingDetails` | Preuzimanje već potvrđene rezervacije preko `code`+`external_reference` |
| 6 | `POST /v1/hotel/cancel` | Otkazivanje rezervacije preko `code` — jednostavan poziv, nema strukturiran povraćaj/kaznu u odgovoru (ta informacija je već poznata unapred iz `cxl_policies`) |

Ovaj tok je **direktno uporediv sa TT M5** (`Quote` → `confirmQuote` → `Booking`) — ista tri koraka (traži, zaključaj cenu, potvrdi), samo eksplicitnije razdvojena na TCT strani (odvojen `valuation` poziv umesto da je revalidacija ugrađena u `confirmQuote`).

---

## 2. Referentni podaci (lookup resursi)

Nacionalnosti, lokacije (hijerarhijske, `location_parent`), IATA aerodromski kodovi, kategorije (0-6 zvezdica), pansion (`RO`/`BB`/`HB`/`FB`/`AI`/`UN` — `UN` = "Unmapped", fallback vrednost za slučaj kad dobavljač pošalje nešto što se ne uklapa). Svi imaju `responseToken` na nivou odgovora (svrha nepoznata iz primera — moguće idempotency/rate-limit trag, ne paginacioni kursor pošto liste nisu bile ograničene na tu vrednost).

Hotelski katalog (`/hotel/...` content endpoint, 2817 zapisa u primeru) vraća sadržaj **agregiran od GIATA** — foto URL-ovi vode na `giatamedia.com`/`travelapi.com` (Expedia CDN), ne originalne fotografije od hotela.

---

## 3. Nalazi vredni poređenja sa M3/M4/M5

### 3.1 `cxl_deadline` vs `provider_cxl_deadline` — bafer rok otkazivanja (najvredniji nalaz)

TCT namerno prikazuje **raniji** rok otkazivanja klijentu nego stvarni rok kod dobavljača (u primeru: 3 dana razlike). Svrha: platforma ima vremena da reaguje (npr. automatski otkaže ka gostu) pre nego što dobavljačev pravi, neopozivi rok istekne.

**TT M3/M5 danas nemaju ovaj koncept** — `ContractPeriod`/`CancellationRule.release_days_before` je jedan rok, bez razlike između "šta agencija obećava gostu" i "šta dobavljač stvarno dozvoljava". Vredno otvorenog pitanja za M3/M5 (ne odluka, samo zabeleženo): da li TT treba sopstveni bafer sloj iznad dobavljačevog roka otkazivanja, posebno za API dobavljače (M4) gde je rok često strog i automatski sprovođen.

### 3.2 Neuređen `notes[]` tekst — potvrđuje TT-ovu strukturiranu odluku

`valuation` odgovor nosi ogroman slobodan HTML-ish tekst (resort fee, city tax, pet fee, rollaway bed fee, no-show politika) umesto strukturiranih polja. City tax napomena ("Hotel prices do not include room taxes... charged directly by the hotel upon client's arrival") je **tačno ono što M3 `TouristTaxInfo` strukturira** kao posebno polje.

**Zaključak: TT-ova odluka da strukturira `AncillaryService`/`TouristTaxInfo` umesto slobodnog teksta je potvrđena kao bolja praksa** — ne treba menjati M3 zbog ovoga, ovo je potvrda unazad, ne novi nalaz koji zahteva akciju.

### 3.3 `invoiceDetails` unutar `book` poziva — potvrđuje TT-ovu podelu modula

Poziv za rezervaciju nosi puna rumunska poreska/pravna polja (`cui`, `jNo`, `legalAgentCNP`) direktno unutar booking payload-a — fakturisanje zabetonirano u rezervaciju, ne odvojeno.

**TT-ova arhitektonska odluka da M5 (rezervacije) i M10 (fakturisanje/fiskalizacija) budu odvojeni moduli je ovde potvrđena kao čistije rešenje** — nema akcije, samo potvrda unazad.

### 3.4 `hid` / `hid_undeduplicated` — GIATA dedup, delimičan

Dva ID-a po hotelu: GIATA-spojen (`hid`) i sirov, po dobavljaču (`hid_undeduplicated`). U primeru `hotelDetails` odgovora `hotel_giata_code` je prazan za jedan hotel — dedup ne pokriva 100% slučajeva, ostaje "sirov" fallback. TT M2 danas nema ovaj problem (jedan `Product` = jedan `source_provider`) — relevantno samo ako TT ikad agregira više izvora za isti fizički hotel (nije trenutno slučaj ni sa jednim M4 dobavljačem).

### 3.5 `quote`/`blockquote` dva odvojena flag-a u `book` pozivu

`quote` (verovatno dry-run/simulacija bez stvarne rezervacije) i `blockquote` (zaključaj cenu tokom procesa) su odvojeni flag-ovi. TT M5 stapa ovo u jedan `Quote → Booking` tok. Nije greška TT strane, samo finija granulacija koju TCT nudi — vredno zapamtiti kao mogući obrazac ako se ikad pokaže potreba za eksplicitnim "dry-run" testom pre stvarne potvrde.

### 3.6 `persons[][]` — dete ima i pun datum rođenja i odvojen `children: [godine]`

Deluje redundantno (ista informacija na dva načina). Vredi proveriti (van obima ovog dokumenta) da li TT M5/M6 čuva tačan datum rođenja gosta ili samo uzrast u trenutku rezervacije — datum rođenja je precizniji za višegodišnje ugovore gde se uzrast gosta menja.

### 3.7a `bookingDetails` — dupliran, delimično neusklađen sadržaj (dodatna potvrda §3.2)

Primer `bookingDetails` odgovora nosi i **strukturirano** `cxl_policies[]` (napomena: ovde množina, dok je `valuation` odgovor koristio jedninu `cxl_policy` — neusklađen naziv polja između endpoint-a iste platforme) **i** istu informaciju ponovo kao slobodan tekst unutar `aditional_info` ("Cancellation Policy: Cancellation 7-1 day prior to arrival - 50% of total cost will be charged..."). Ista redundancija kao u §3.2 (structured + free-text duplikat iste činjenice), sada sa konkretnim potvrđenim primerima vrednim beleženja kao stvaran presedan za M3/M3 §8 talas 2 stavke:

- **"Air conditioning - 5.00 euro per day, per room"** i **"Safe box - 2.00 euro per day"** — konkretan primer tačno onoga što M3 `AncillaryService` (generički red, poglavlje 2.6) modeluje umesto fiksnih polja; ovde su oba prikazana samo kao tekst, ne strukturirano polje na TCT strani.
- **"Accommodation tax to be paid directly by guests on the spot"** — treći nezavisan primer istog obrasca kao M3 `TouristTaxInfo` (§2.7, "plaća se na licu mesta mimo agencije").
- **"Property Rules: From 01-Apr-2024 until 31-Oct-2024 - Minimum Stay 3 Nights"** — datumski opseg + minimalan broj noćenja, iznet kao tekst — tačno ono što M3 `ContractPeriod.min_stay_nights` (§2.3) drži kao strukturirano polje. Dodatna potvrda da je M3-ova strukturirana odluka ispravna, ovo nije nova stavka za akciju.

Takođe primećeno: `price`/`converted_price`/`client_currency` kao tri odvojena polja — TCT razlikuje valutu rezervacije od valute u kojoj klijent stvarno vidi/plaća iznos. TT M5/M10 danas nemaju ovu razliku eksplicitno modelovanu (jedna `currency` po rezervaciji) — vredno otvorenog pitanja ako TT ikad proda u valuti različitoj od one u kojoj je ugovorena cena kod dobavljača, ne akcija sada.

### 3.7 Nedosledan oblik pogodnosti unutar iste platforme

Katalog endpoint vraća `hotelFacilities` kao ad-hoc `facility_wlan`/`facility_pool` boolean stringove; `hotelDetails` endpoint vraća `hotelfacilities{}` kao strukturiran rečnik sa numeričkim `facility_id`+`facilityprovider_code`/`name`. Dva različita oblika istog koncepta unutar iste platforme — realan podsetnik za M4 adapter dizajn: čak i jedan dobavljač nije nužno dosledan između sopstvenih endpoint-a, adapter sloj mora normalizovati, ne pretpostaviti jedan oblik.

---

## 4. Otvoreno pre bilo kakve dalje akcije

- Ovo je istraživanje jednog dev/test naloga, ne potpisan ugovor — nijedan nalaz ovde ne menja M3/M4/M5 spec dok vlasnik ne odluči da TCT-IMC uopšte postane M4 dobavljač.
- Write strana (`book`) je viđena samo kroz primer zahteva/odgovora — nema uvida u error-code katalog, rate-limit pravila, ni ponašanje pri neuspehu (npr. da li `book` posle isteka `cxl_deadline`/`provider_cxl_deadline` prosto odbija zahtev ili nešto drugo).
- Ako TCT-IMC ikad uđe u M4 kao stvarna konekcija, dve stavke odavde bi realno zahtevale dopunu M3/M5/M10 modela — `cxl_deadline`/`provider_cxl_deadline` bafer obrazac (§3.1) i `price`/`converted_price`/`client_currency` razlika (§3.7a) — sve ostalo je ili već pokriveno ili potvrda postojeće TT odluke.
