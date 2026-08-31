# Analiza — TCT-IMC API (Travel Connection Technology / Travelsoft)

**Status:** Istraživanje, ne specifikacija. Vlasnik je dobio pristupne kredencijale od TCT-a (`imc-dev.tct.travel`) radi upoznavanja sa API-jem, pre potpisivanja ugovora. Ovaj dokument beleži nalaze iz javno/pristupno pročitane API dokumentacije i primera zahteva/odgovora, upoređene sa već specificiranim M2/M3/M4/M5/M10 modelom. **Nije prošlo kroz `tt-architecture-core` proveru niti je dobilo obim od vlasnika — čista beleška, ne predlog za implementaciju.**

TCT-IMC je proizvod **Travelsoft** grupacije — ista grupacija koja stoji iza Travelsoft Pay, već pomenutog kao kandidat za M10 (vidi `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, stavka "TravelgateX + Travelsoft Pay"). Odgovori sadrže jak signal (`prv_code` prefiks `HB-`) da je **Hotelbeds** osnovni dobavljač (bedbank/wholesaler) iza TCT-IMC agregacije, ne direktni hotelski ugovori.

**Obim (dopunjeno nakon uvida u pun Postman collection, isti dan):** API pokriva četiri celine — Static Data/NBC (referentni podaci), **Hotel API** (poglavlje 1-3 ispod), **Flight Package API** (let+hotel paket, poglavlje 5) i **Back Office API** (fakturisanje/plaćanja, poglavlje 6). Prva dva su detaljno pokrivena kroz ručno dostavljene primere; poslednja dva su pročitana direktno iz preuzetog `TCT-IMC Postman Collection.json` (vlasnik ga preuzeo sa `imc-dev.tct.travel/docs`).

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

## 4. Otvoreno pre bilo kakve dalje akcije (deo I — Hotel API)

- Ovo je istraživanje jednog dev/test naloga, ne potpisan ugovor — nijedan nalaz ovde ne menja M3/M4/M5 spec dok vlasnik ne odluči da TCT-IMC uopšte postane M4 dobavljač.
- Write strana (`book`) je viđena samo kroz primer zahteva/odgovora — nema uvida u error-code katalog, rate-limit pravila, ni ponašanje pri neuspehu (npr. da li `book` posle isteka `cxl_deadline`/`provider_cxl_deadline` prosto odbija zahtev ili nešto drugo).
- Ako TCT-IMC ikad uđe u M4 kao stvarna konekcija, dve stavke odavde bi realno zahtevale dopunu M3/M5/M10 modela — `cxl_deadline`/`provider_cxl_deadline` bafer obrazac (§3.1) i `price`/`converted_price`/`client_currency` razlika (§3.7a) — sve ostalo je ili već pokriveno ili potvrda postojeće TT odluke.

---

## 5. Flight Package API (let + hotel paket) — pun uvid iz Postman collection-a

Odvojena grupa endpoint-a za **pakete** (let + smeštaj + transfer zajedno): `getPackageDepartures` (kalendar cena po datumu polaska), `search` (bogat filter — destinacija/aerodrom/hotel/zvezdice/datumi), `offer/:id` (pun detalj jedne ponude), `verify` (revalidacija), `discountsQuote`, `hotelDetails`, `extraServices`, `book`, `quotation` (create/update), `resumePackageBooking`, `cancel`, `bookingDetails`, `getCharterDeparture`.

### 5.1 Struktura ponude — `accom` + `transport` kao odvojeni pod-objekti

Jedna `offer` nosi `accom` (hotel/soba/cena, ista polja kao Hotel API) i `transport.routes[]` (let(ovi), svaki sa `depApt`/`arrApt`/`depDate`/`depTime`/`carrier`/`flNo`). **Direktno relevantno za već otvoreno pitanje u M3 §8**: "Da li `PACKAGE` proizvodi (iz M2) mogu imati sopstveni ugovor u M3 nezavisno od komponenti koje ga čine" — TCT-IMC pokazuje da je jedan realan odgovor "paket je kompozitna ponuda sastavljena u trenutku pretrage od zasebnih komponenti (let inventar + hotel inventar), ne unapred ugovoren paket-proizvod". Ne rešava pitanje umesto TT-a, samo dodaje konkretan primer kako to rade drugi.

### 5.2 `hotelMatchType` — automatska zamena kad tačna ponuda nestane pri revalidaciji (nov obrazac, vredan pažnje)

`verify` odgovor uključuje `hotelMatchType`: `exact` (ponuda potvrđena kakva jeste), `alternative_same_meal` (zamenjena najjeftinijom dostupnom sa istim pansionom), `alternative_differentmeal` (zamenjena najjeftinijom dostupnom, drugi pansion). Alternativne vrednosti se vraćaju samo agencijama koje imaju uključenu opciju "fleksibilno poklapanje rešenja" — inače nedostupna ponuda vraća standardnu poruku da nije pronađena.

**TT M5 danas nema ovaj koncept** — `recomputeExpiredQuote` ponovo izračunava cenu ZA ISTU stavku, ne nudi automatsku zamenu za najbližu dostupnu alternativu ako stavka više nije dostupna. Vredna ideja za otvoreno pitanje (ne odluka): da li M5 treba opcioni "ponudi najbližu alternativu" korak kad tačna stavka nestane između ponude i potvrde, umesto direktnog odbijanja.

### 5.3 `comission` vraćena direktno u `verify` odgovoru

TCT vraća agencijinu proviziju (`comission: 32` uz `grossPrice: 3267`) kao deo live odgovora na reviziju cene — agencija odmah zna svoju maržu bez posebnog izračunavanja. Zanimljivo poređenje sa TT-ovim `Contract.commission_model`/`commission_percentage` (M3 §2.2b) — isti podatak, samo TCT ga vraća uživo po ponudi umesto da se čuva po ugovoru. Nije akcija, samo zapažanje o alternativnom mestu gde se provizija može izložiti.

### 5.4 Avio-specifična kompleksnost (Wizzair/Ryanair) — konkretan primer koliko M4 avio adapter može biti složen

`book` metoda za pakete sa avio komponentom ima **dva potpuno različita dodatna toka**, oba specifična za konkretnog prevoznika:

- **Wizzair — provera cene pre potvrde.** Prvi poziv (bez `confirmPriceToken`) proverava trenutnu cenu leta kod avio-kompanije. Ako se cena promenila (razlika > 0.1), vraća `priceChanged: true` + `confirmPriceToken` (validan 120 sekundi) + staru/novu cenu; klijent mora ponovo pozvati `book` sa istim telom + tokenom da prihvati novu cenu.
- **Ryanair — 3DS provera kartice.** Zahteva `cardVerificationReturnUrl` u zahtevu (inače se rezervacija odbija); odgovor vraća `cardVerificationRequired: true` + `verificationUrl` (preusmeri gosta na Ryanair-ovu 3DS stranicu) + `packageBookingId`; posle verifikacije, poziva se **poseban endpoint `resumePackageBooking`** sa `packageBookingId` da se rezervacija (hotel + transfer) tek tada finalizuje. Prozor verifikacije: 10 minuta.

**Zašto je ovo vredno zabeleženo:** TT-ov M4 danas nema nijedan avio/GDS adapter (samo najavljen kao "budući" u M4 spec-u). Ovaj primer pokazuje da avio-specifična kompleksnost nije uniformna između prevoznika (redirect+resume kod jednog, token-confirm kod drugog) — kad TT stvarno počne M4 avio dopunu, ne treba pretpostaviti jedan generički obrazac za sve avio-kompanije, adapter sloj mora predvideti barem ova dva različita toka.

### 5.5 Sistem popusta/lojalnosti u `book` pozivu

`discount_code` (promo kod, validira se server-side, ne tiho prihvata pogrešan kod), `apc_member_code`/`apc_points` (lojalnost — bodovi se otkupljuju uz član-kod), `discountQuoteID` (potpisan token iz `discountsQuote` metode, važi 30 minuta, revalidira se pri `book`-u — ako se konačna cena ne poklapa sa kotiranom, rezervacija se odbija sa jasnom porukom, ista filozofija kao Wizzair price-check). TT M6 ima "nivoe lojalnosti" (pomenuto u ranijim analizama), ali tok "otkupi bodove u trenutku rezervacije" nije potvrđen kao postojeći u M5/M6 spec-u — vredna beleška za kasnije, ne akcija sad.

### 5.6 `fixedClientPrice` — zaključana cena za gosta nezavisno od promene troška

Opciono polje koje "zamrzava" finalnu cenu prikazanu gostu (npr. posle što je gost već platio), bez obzira na kasnije fluktuacije troška. TT-ov `Quote.price`/`expiresAt` obrazac već suštinski radi ovo (cena se zamrzava u trenutku ponude) — ne otvara novu stavku, samo potvrđuje da je TT-ov pristup ekvivalentan.

---

## 6. Back Office API (fakturisanje/plaćanja) — pun uvid iz Postman collection-a

Endpoint-i: `rebook`, `bookings` (lista po opsegu datuma/ID-jeva), `invoices` (pretraga faktura po bogatim kriterijumima), `providers`, `bookingFinancials` (pun finansijski pregled jedne rezervacije), `invoiceDownloadLink`/`voucherDownloadLink`, `addPayment`.

### 6.1 Struktura fakture — EU e-fakturisanje vokabular (direktno koristan primer za M10 SEF rad)

`invoices` odgovor nosi punu strukturiranu fakturu u obrascu koji odgovara **EU e-invoicing standardu (EN 16931/UBL stila)**: `invoiceTypeCode: "380"` (standardni UBL kod za fakturu), `sellerInformation`/`buyerInformation` sa punim poreskim identifikatorima (`sellerVATidentifier`, `sellerUniqueIdentificationCode`), stavke sa `productVATCategory`/`productVATCode`/`productExceptVATReason` (npr. `"VATEX-EU-309"` — standardan kod izuzeća od PDV-a za turističke agencije po EU šemi marže). **Ovo je direktno koristan konkretan primer kad M10 dođe na red za SEF e-Fakturu dopunu** — TT još nije doneo odluku o SEF-u (zabeleženo u memoriji kao otvorena stavka), ali ovaj oblik pokazuje kako jedan realan, veći igrač u istoj industriji već strukturira fakturu za EU usklađenost. Nije predlog da TT kopira ovaj oblik — SEF ima sopstvenu srpsku šemu — samo referentna tačka.

### 6.2 Storno (kreditna nota) preko uparenih faktura sa suprotnim predznakom

Primer prikazuje dve fakture — originalnu (pozitivna vrednost) i storno (**negativna** vrednost, `has_pair` pokazuje na originalni `invoice_id`). Vredi proveriti (van obima ovog dokumenta) da li TT M10 modeluje storno/kreditnu notu na isti način (upareni zapis sa suprotnim predznakom) ili drugačije — ako drugačije, nije nužno greška, samo razlika vredna svesne odluke kad M10 dobije tu funkcionalnost.

### 6.3 Raspored rata (`installments`) odvojen od stvarno primljenih uplata (`payments[]`)

Svaka faktura nosi **plan** otplate (`installments`: niz `{index, date, value}`) i odvojeno **stvaran** niz izvršenih uplata (`payments[]`: datum, iznos, valuta, `type_of_payment` — `bank_transfer`/`credit_card`/`invoice_compensation`). Ovo se poklapa sa TT-ovim postojećim `ClientPaymentSchedules` konceptom (M10, pomenuto u commit istoriji) — **potvrda da je TT već na pravom obliku**, ne novi nalaz koji zahteva akciju.

### 6.4 Otkazivanje sa tri nivoa neto cene (`net0`/`net1`/`net2`) plus cena za klijenta

`bookingFinancials` prikazuje kaznu otkazivanja u **četiri paralelne cene**: `bookingcxlrule_price_net0`, `_net1`, `_net2` i `_price_client`. Verovatno predstavljaju slojeve troška (npr. neto cena dobavljača → neto cena posle marže agregatora → neto cena posle TCT provizije → cena koju plaća gost) — finiji sloj nego TT-ov trenutni `CancellationRule` (jedna cena/procenat po periodu, M3 §2.5). Vredno otvorenog pitanja za M3/M10 ako TT ikad treba da prati kaznu kroz više slojeva marže istovremeno (npr. franšizni obrazac iz M7 §2.0.7, gde više strana može imati sopstvenu maržu na istoj rezervaciji) — nije trenutno prioritet, samo zabeleženo.

### 6.5 `furnizorId > 0` = "offline" rezervacija u istom sistemu faktura

Dokumentacija eksplicitno kaže da vrednost `furnizorId` veća od 0 znači da je rezervacija ručno uneta (offline), ne kroz API. **Potvrđuje isti princip koji TT već sprovodi** — M3 (ručni/AI unos od dobavljača) i M4 (API dobavljači) hrane isti M5 `Booking` model bez razlike u daljem toku (fakturisanje, izveštavanje) — TCT-IMC to isto radi na svom kraju (offline i online rezervacije dele isti fakturni sistem). Potvrda, ne akcija.

### 6.6 Bogatiji `booking_status`/`reservationStatus` enum

Viđene vrednosti: `pending`, `pending_quote`, `confirmed`, `oktobuy`, `waiting_cancellation`, `waiting_cancellation_after_cxl`, `cancelled`, `rejected`, `errordetails`, `temporary`, `cancelled_after_cxl`. Bogatiji od onoga što je TT `Booking.status`/`BookingItem.itemStatus` enum verovatno pokriva — vredi uporediti tek ako se pokaže konkretna potreba (npr. razlika između "otkazano" i "otkazano posle isteka roka" koju TT danas ne razdvaja), ne akcija sad.

## 7. Otvoreno pre bilo kakve dalje akcije (deo II — Flight Package + Back Office)

- Nijedan nalaz iz poglavlja 5/6 nije prošao kroz `tt-architecture-core` proveru niti dobio obim od vlasnika — čista beleška, isto pravilo kao poglavlje 4.
- Najvredniji kandidati za dalju pažnju ako TCT-IMC (ili bilo koji sličan agregator) ikad postane stvaran M4/M10 dobavljač: `hotelMatchType` automatska zamena (§5.2), avio-specifična kompleksnost po prevozniku (§5.4, relevantno tek kad M4 avio adapter stvarno krene), i tri-nivoa neto cena u kazni otkazivanja (§6.4).
- Nije viđen error-code katalog za Flight Package/Back Office write pozive van primera u kolekciji — isto ograničenje kao Hotel API deo (poglavlje 4).
