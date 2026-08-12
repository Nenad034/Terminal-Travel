# Specifikacija modula M5 — Rezervacije i tok prodaje

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M5) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.19 — M20 implementiran (avgust 2026): dodato `Booking.contract_terms_accepted_at` (poglavlje 4.1, kopija istog polja sa `Quote` u trenutku potvrde — `Booking` nema `quote_id` referencu nazad, pa se prenosi samo ono što je M20 stvarno potrebno, isti obrazac kao v1.17 buyer polja); `ClientContractStubService.hasGeneratedContract` (poglavlje 6, dodatni uslov za vaučer) više nije no-op stub, poziva stvaran `ClientContractsService` in-process — zatvara stavku izlaznog kriterijuma; v1.18 — M11 implementiran (avgust 2026): `ComplianceStubsService.checkTravelGuaranteeUtilization` (poglavlje 4, korak 1a) više nije no-op stub, poziva stvaran `TravelGuaranteeService` in-process (isti obrazac cross-modularnog poziva kao M10 PaymentsService → M5 BookingsService) — zatvara stavku izlaznog kriterijuma; v1.17 — dodato `Booking.buyer_name`/`buyer_type`/`buyer_tax_id` (poglavlje 4.1, avgust 2026) — otkriveno pri implementaciji M10: M10 spec §1.1 pretpostavlja da `client_account_id` nosi minimalno naziv/tip/PIB kupca, ali to polje je uvek bio goli FK bez tih podataka; dopuna dodaje tri nova polja koja se unose u `POST /quotes/:id/confirm` (ne čekaju M6 Nalogodavac) i koja M10 koristi za SEF/ESIR izbor tipa fiskalnog dokumenta; v1.16 — dodato `POST /supplier-manifests/prepare-batch` (poglavlje 8.4/11, na zahtev vlasnika, avgust 2026) — proširuje ad-hoc pripremu iz v1.15 sa jedne rezervacije na (a) ručno izabranu listu rezervacija (checkbox u M17, isključivo — ignoriše ostale filtere kad je prosleđeno) ili (b) kombinaciju filtera koji se logički I-uju: opseg kreiranja rezervacije, opseg boravka (preklapanje), opseg dolaska, opseg odlaska, status rezervacije — bar jedan mora biti prisutan; isti princip automatskog grupisanja po dobavljaču kao v1.15. Namerno NE uvodi prirodno-jezički AI interfejs niti bilo kakvo AI-inicirano slanje — priprema nacrta ostaje nivo "Autonomno" (kao i do sada), slanje ostaje isključivo ljudski klik, nepromenjeno iz poglavlja 8.4; v1.15 — dodato `POST /bookings/:id/prepare-supplier-manifests` (poglavlje 8.4/11, na zahtev vlasnika, avgust 2026) — ad-hoc priprema najave za JEDNU rezervaciju odmah, bez čekanja na periodični posao; ako rezervacija ima stavke od više različitih dobavljača, priprema se po jedan DRAFT `SupplierManifest` za svakog, automatski grupisano — potvrđeno da je ovo ponašanje već postojalo za periodično agregiranje (poglavlje 8.1, `SupplierManifest` je uvek vezan za tačno jednog dobavljača), dopuna dodaje samo ad-hoc okidač po rezervaciji; v1.14 — dopuna `QuoteItem`/`BookingItem` (poglavlje 3.2/4.2), na osnovu nalaza pri implementaciji (avgust 2026): `unit_count` (broj rezervisanih jedinica/soba, iz `occupancy.room_config.length`) — bez ovog polja, otkazivanje višesobne rezervacije je oslobađalo nazad u M3 samo jednu sobu umesto svih, jer `BookingItem` do sada nije pamtio koliko je jedinica stvarno rezervisano; i `cancellation_policy_snapshot` (snimak M4 `AvailabilityQuote.cancellationPolicy` u trenutku građenja stavke, isti strukturirani oblik kao M3 `CancellationRule`) — omogućava da se procenat povraćaja pri otkazivanju API stavke računa deterministički (poglavlje 6), na isti način kao za CONTRACTED stavke, umesto da ostane trajno prazan; v1.13 dodato `Quote`/`Booking.referral_tracking_code` (M12 poglavlje 3a, avgust 2026) — M5 samo prenosi sirov kod iz M8, bez validacije, zatvara deo M12↔M13 integracione praznine iz backlog-a; v1.12 na zahtev vlasnika (avgust 2026), definisan oblik odgovora `GET /search` (poglavlje 3.0b, `SearchResultProduct`/`SearchResultOffer`) i eksplicitan prelaz izabranog rezultata u `Quote`/`ItinerarySegment`, uključujući proveru isteka `quote_expires_at` pre kreiranja stavke ponude — do sada su bili definisani samo ulazni parametri pretrage; v1.11 na zahtev vlasnika, rešava problem #11: `SupplierManifest` i novi `SupplierChangeNotice` (izmena/storno) dobijaju `reference_code` i idu isključivo kroz jedinstveno M22 sanduče za dobavljače; automatsko poklapanje pristigle potvrde po referentnom kodu (poglavlje 8.8) — potvrda i dalje uvek zahteva ljudski klik, ni pri visokoj pouzdanosti; v1.10 na osnovu analize stvarnih cenovnika više dobavljača: dodata formula za `base_cost` sobe sa mešovitim uzrastom gostiju, koristeći M3 `RateLine.price_basis`/`age_pricing[]` (poglavlje 3.2b); v1.9 — `occupancy.room_config` (poglavlje 3.2a) postao strukturiran niz po sobi (`room_type_code`, `adults`, `children`, `children_ages`) umesto nedefinisanog bloba, uz pravilo slaganja sa zbirnim `adults`/`children`; v1.8 — `GET /search` `type` parametar postao niz (multi-select), podržava tri nova M2 tipa (`TRANSPORT`/`TICKET`/`EVENT`, poglavlje 11) — dopunjuje M2 poglavlje 2.3; v1.7 (retroaktivno zabeleženo, nije imalo sopstveni changelog unos u trenutku kad je dodato) — poglavlja 8.6 (najava dobavljaču kao formalni koncept) i 8.7 (`SupplierAnnouncementRule`), zatvaraju probleme #2/#3 sa liste; v1.6 — rešeni nalazi iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026, na zahtev vlasnika): dodato `Quote.contract_terms_accepted*` (poglavlje 3.1), automatsko izvođenje `tip_nastupanja` za samouslužne kanale (poglavlje 4.0a), redosled provere garancije/kreditnog limita (poglavlje 4, korak 1), eksplicitni parametri `GET /search` (poglavlje 11), sistemski izuzetak izdavanja vaučera za subagenta unutar odobrenog kredita (poglavlje 6.3); v1.5 dodato pravilo skrivanja identiteta dobavljača od B2C/B2B kanala (poglavlje 6.2), na zahtev vlasnika (avgust 2026), dopunjuje M2 poglavlje 5.1; v1.4 dodato opciono sastavljanje putovanja pre Ponude, za kompleksna višedestinacijska putovanja (poglavlje 3.0), poređenjem sa Travel Compositor portfolio modelom (istraživanje 2.8.2026, vidi Dodatak A Master dokumenta); v1.3 dodati podsetnici/alarmi posle potvrde rezervacije (poglavlje 6.1: neplaćena rezervacija sa izdatim vaučerom, otvorena potvrda dobavljača po stavci, vaučer koji nedostaje uprkos punoj uplati); v1.2 dodala izbor jezika operativne liste za dobavljača (poglavlje 8.3); v1.1 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 2) — v1.1/v1.2 poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1, M2, M3, M4; od avgusta 2026 i M22 (poglavlje 8.8, jedinstveno sanduče za potvrde dobavljača)

---

## 1. Svrha i obim modula

M5 vodi gosta/agenta kroz tok **Search → Ponuda → Potvrda → Upravljanje rezervacijom**, bez obzira da li proizvod dolazi iz M3 (ugovoren) ili M4 (API). M5 je jedino mesto gde se pravi konačna prodajna cena (nabavna cena + marža) i jedino mesto koje sme da zatraži rezervaciju kapaciteta kod M3 ili M4.

M5 takođe izlaže **kalendarski pregled rezervacija po datumu** — dolasci, odlasci i stavke u toku za izabrani dan (poglavlje 7) — i generiše/šalje **operativne liste ka dobavljačima** (rooming liste, spiskovi putnika i sl., za `CONTRACTED` stavke), suprotan smer komunikacije od vaučera koji ide gostu (poglavlje 6), detaljno u poglavlju 8.

Van obima: naplata i fiskalizacija (M10, Faza 2), garancija putovanja (M11, Faza 2), CRM istorija gosta (M6, Faza 3) — M5 samo emituje događaje koje ti moduli kasnije koriste (poglavlje 9).

---

## 2. Model marže (mark-up)

Potvrđeno: potreban je fleksibilan sistem koji podržava procenat, fiksan iznos, i kombinaciju oba, sa podrazumevanom vrednošću po dobavljaču/provajderu koja se može override-ovati na finijem nivou.

**Konvencija za novčane vrednosti:** svi novčani iznosi (`base_cost`, `final_price`, `fixed_amount`, `total_price`, itd.) čuvaju se kao `integer` u najmanjoj jedinici valute (para/cent), nikad kao `decimal`/float — ista konvencija kao M3 (poglavlje 2) i M10 (poglavlje 3.2, kanonski izvor pravila). `percentage` ostaje `decimal` jer nije novčani iznos.

### 2.1 `MarkupRule`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| scope_type | enum: `M3_SUPPLIER`, `M3_CONTRACT`, `M3_CONTRACT_PERIOD`, `M4_PROVIDER`, `M2_PRODUCT` | nivo na koji se pravilo odnosi |
| scope_id | UUID | referenca ka entitetu tog nivoa |
| percentage | decimal, nullable | npr. `15.00` = 15% |
| fixed_amount | integer, nullable | dodaje se posle procenta, u najmanjoj jedinici valute (poglavlje 2) |
| fixed_amount_currency | string, nullable | |
| active_from / active_to | date, nullable | omogućava vremenski ograničene kampanje marže |
| created_by / created_at / updated_at | UUID / timestamp | |

**Formula (fiksan redosled, da bude deterministički i proverljiv):**
`finalna_cena = round(nabavna_cena * (1 + percentage / 100)) + fixed_amount`
Ako `percentage` nije postavljen, tretira se kao 0. Ako `fixed_amount` nije postavljen, tretira se kao 0. Bar jedno od dva mora biti postavljeno da bi pravilo bilo validno. Pošto su `nabavna_cena`/`fixed_amount`/`finalna_cena` celi brojevi (poglavlje 2, konvencija), `round()` ovde zaokružuje na najbližu celu jedinicu najmanje valute (cent/para) — izbegava se float aritmetika kroz ceo lanac izračuna.

### 2.2 Razrešavanje pravila (najspecifičnije pobeđuje)
Za proizvod iz M3 (ugovoren): `M2_PRODUCT` → `M3_CONTRACT_PERIOD` → `M3_CONTRACT` → `M3_SUPPLIER` (podrazumevano).
Za proizvod iz M4 (API): `M2_PRODUCT` → `M4_PROVIDER` (podrazumevano).

**Ograda:** sistem ne dozvoljava da `Contract` (M3) ili `ProviderConfig` (M4) pređe u status `ACTIVE` dok njegov dobavljač/provajder nema bar jedno podrazumevano `MarkupRule` — sprečava slučajnu prodaju bez marže.

**Dopuna (uneta u M6 specifikaciji, kad je taj modul specificiran):** posle primene `MarkupRule`, ako `Quote.client_account_id` postoji, M5 poziva M6 `GET /loyalty-status/:clientAccountId` i primenjuje popust nivoa lojalnosti kao poslednji korak: `konačna_cena_za_gosta = final_price * (1 - discount_percentage / 100)`. Ovo ne menja logiku marže iznad, samo dodaje korak posle nje.

---

## 3.0 Sastavljanje putovanja — Itinerary (opcioni korak pre Ponude, dopuna avgust 2026 — poređenjem sa Travel Compositor portfolio modelom)

Za jednostavne rezervacije (jedan hotel, jedan transfer) tok direktno kreće od Ponude (poglavlje 3). Za **kompleksna višedestinacijska putovanja** — differentiator eksplicitno naveden u Master dokumentu poglavlje 1.1 kao razlog da gost ostane kod agencije umesto generičkog AI — M5 uvodi opcioni korak sastavljanja pre Ponude, tako da redosled i kombinacija destinacija ne moraju biti unapred poznati da bi se pravila konkretna ponuda.

### 3.0.1 `Itinerary`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_account_id | UUID, nullable | isto kao `Quote` (poglavlje 3.1) — nullable dok se gost ne identifikuje |
| channel | enum (isto kao `Quote`) | |
| status | enum: `DRAFT`, `CONVERTED`, `ABANDONED` | `CONVERTED` kad postane `Quote` (poglavlje 3.0.3) |
| title | string, nullable | radni naziv, npr. "Italija + Grčka, 14 dana" — samo interni, ne prevodi se (M2 poglavlje 2.2 se ovde ne primenjuje) |
| created_by | UUID, nullable | user_id ako agent sastavlja; null ako gost sam sastavlja na sajtu |
| created_at / updated_at | timestamp | |

### 3.0.2 `ItinerarySegment`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| itinerary_id | UUID (FK) | |
| sequence_order | integer | redosled segmenta u putovanju — korisnik menja raspored; tačan UI (drag & drop ili sl.) van obima ove specifikacije |
| product_id | UUID (FK → M2 Product), nullable | popunjeno kad je segment vezan za konkretan proizvod (hotel, transfer, izlet); nullable dok se destinacija samo okvirno bira, pre konkretne pretrage |
| destination_country / destination_city | string, nullable | kopija radi prikaza dok `product_id` nije popunjen |
| stay_from / stay_to | date, nullable | |
| notes | text, nullable | slobodna napomena agenta/gosta o segmentu |

### 3.0.3 Konverzija u Ponudu
`POST /itineraries/:id/to-quote` prevodi svaki `ItinerarySegment` sa popunjenim `product_id` u `QuoteItem` (poglavlje 3.2), po istim pravilima cene/marže kao svaka druga stavka (poglavlje 2). **Cena se prvi put računa tek u ovom koraku** — `Itinerary` sam po sebi ne rezerviše niti proverava dostupnost, isti princip kao što `Quote` sam po sebi ne zaključava kapacitet (poglavlje 3). Segmenti bez popunjenog `product_id` (samo okvirno izabrana destinacija, još bez konkretnog proizvoda) se preskaču uz jasno upozorenje korisniku pre konverzije, ne tiho. Pri uspešnoj konverziji, `Itinerary.status` prelazi u `CONVERTED`; nastala `Quote` čuva referencu nazad radi sledljivosti (novo polje `Quote.itinerary_id`, nullable, dopuna poglavlja 3.1).

### 3.0.4 Van obima ove dopune
Vizuelni prikaz sastavljanja (mapa, drag & drop redosled) je dizajnersko pitanje van obima ove specifikacije, isto obrazloženje kao izgled kalendara (poglavlje 13). Automatski predlozi AI agenta za popunu "praznina" u itineraru (npr. transfer između dva segmenta, ili predlog trećeg segmenta na osnovu prva dva) je prirodan kandidat za M15 kad taj sloj bude uveden za M5 — ne uvodi se ovde, u skladu sa principom #4 Master dokumenta (determinizam pre autonomije: `Itinerary` sam ostaje čist podatak dok ne postoji stabilan M15 okvir koji bi ga dopunjavao).

---

## 3.0b Rezultati pretrage — struktura `SearchResult` i prelaz u `Quote`/`Itinerary` (dopuna, avgust 2026, na zahtev vlasnika)

`GET /search` (poglavlje 11) objedinjuje M2 katalog + M3 ugovorenu dostupnost + M4 uživo, ali oblik onoga što taj poziv vraća do sada nije bio definisan — samo ulazni parametri. Ovo dopunjuje tu definiciju i objašnjava kako se izabrani rezultat prenosi dalje u `Quote` (poglavlje 3) ili `ItinerarySegment` (poglavlje 3.0.2).

### 3.0b.1 `SearchResultProduct` — jedan proizvod u rezultatima
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| product_id | UUID (FK → M2 Product) | |
| type | enum | isto kao `M2 Product.type` |
| source_type | enum: `CONTRACTED`, `API` | |
| name | string | iz `M2 ProductTranslation` za traženi jezik, sa istim fallback-om kao M2 poglavlje 2.2 |
| destination_country / destination_city | string | |
| thumbnail | object, nullable | `{url, category}` — prva slika iz `M2 Product.media[]` po `order`, prioritet kategoriji `EXTERIOR` pa `ROOM` (M2 poglavlje 2.3a); `null` ako proizvod nema slika |
| short_description | string, nullable | kratak izvod iz `ProductTranslation` |
| offers[] | niz `SearchResultOffer` | jedna ili više ponuda unutar istog proizvoda (npr. različit tip sobe/`board_type`) — vidi 3.0b.2 |

### 3.0b.2 `SearchResultOffer` — jedna konkretna kombinacija cene/dostupnosti
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| room_type_code / room_type_name | string, nullable | popunjeno samo za `ACCOMMODATION`/`PACKAGE` sa smeštajem (M2 poglavlje 2.3a); `null` za tipove bez sobe (`TRANSPORT`/`TICKET`/`EVENT`/samostalno `INSURANCE`) |
| board_type | string, nullable | iz `M3 RateLine.board_type` (`CONTRACTED`) ili normalizovano iz M4 odgovora (`API`) |
| price_basis | enum, nullable | `M3 RateLine.price_basis` (`CONTRACTED`, poglavlje 2.4 M3); za `API` se ponuda uvek tretira kao ukupna cena (ekvivalent `PER_ROOM_PER_NIGHT`) — M4 adapteri ne razlikuju osnovicu |
| final_price / final_price_currency | integer / string | `CONTRACTED` — rezultat formule iz poglavlja 2.1/3.2b; `API` — marža primenjena na `M4 AvailabilityQuote.priceAmount`; u najmanjoj jedinici valute (poglavlje 2) |
| availability_status | enum: `AVAILABLE`, `ON_REQUEST`, `SOLD_OUT` | `CONTRACTED` `FIXED`/`CHARTER`/`FIXED_LEASE`: `SOLD_OUT` kad je `total_capacity - units_sold` manje od broja traženih soba (dužina `room_config[]`, ili 1 ako nije poslat), inače `AVAILABLE` (M3 poglavlje 2.3); `CONTRACTED` `ON_REQUEST`: uvek `ON_REQUEST` (M3 poglavlje 2.3) — sistem ne garantuje kapacitet, potvrda ide ručno/kroz API dobavljača pre nego što se gostu potvrdi; `API`: `AVAILABLE` kad `M4 AvailabilityQuote.availableUnits > 0`, inače `SOLD_OUT`. **`SOLD_OUT` ponude se ne vraćaju u rezultatima** — filtriraju se pre odgovora (standardno ponašanje pretrage); pun uvid u zauzet alotman i dalje je dostupan direktno kroz M3 za tim kome je ta informacija potrebna |
| rate_line_id | UUID, nullable | `CONTRACTED` — FK → M3 `RateLine`, nosi se dalje u `POST /quotes` (poglavlje 3.2) |
| provider_quote_reference | string, nullable | `API` — iz `M4 AvailabilityQuote.externalId`, nosi se dalje u `POST /quotes` |
| quote_expires_at | timestamp, nullable | `API` — iz `M4 AvailabilityQuote.quoteExpiresAt`; `null` za `CONTRACTED` (cena ne ističe u tom smislu, samo se ponovo proverava pri potvrdi, poglavlje 4) |
| cancellation_policy_summary | string, nullable | `CONTRACTED` — agregirano iz niza `M3 CancellationRule` te `ContractPeriod` (npr. "30 dana: 100%, 15 dana: 50%, 0 dana: 0%"); `API` — direktno iz `M4 AvailabilityQuote.cancellationPolicy`, prikazano kako stigne od dobavljača |

### 3.0b.3 Od rezultata pretrage do `Quote`/`ItinerarySegment`
1. Korisnik (agent u M17 ili gost u M8/M9) bira jedan `SearchResultOffer` unutar jednog `SearchResultProduct`.
2. **Direktno u ponudu** (bez sastavljanja putovanja): `POST /quotes` prima `product_id`, `rate_line_id` ili `provider_quote_reference` (zavisno od `source_type`), `stay_from`/`stay_to`, `occupancy` (isti oblik kao poglavlje 3.2a) — ova polja se prepisuju iz izabranog `SearchResultOffer`/upita pretrage, korisnik ih ne unosi ponovo ručno.
3. **Kroz sastavljanje putovanja** (poglavlje 3.0): isti podaci popunjavaju `ItinerarySegment.product_id` (poglavlje 3.0.2); konverzija u `Quote` (poglavlje 3.0.3) ih dalje prenosi na isti način.
4. **Provera isteka pre kreiranja stavke ponude:** ako je `source_type = API` i `quote_expires_at` izabranog `SearchResultOffer` je već prošao u trenutku poziva `POST /quotes` (korisnik je "sedeo" na rezultatima pretrage), kreiranje te `QuoteItem` se odbija sa jasnom porukom koja traži ponovnu pretragu — sistem nikad tiho ne kreira stavku sa cenom koja više nije garantovana od M4. Ovo je odvojena provera od one pri potvrdi rezervacije (poglavlje 4) — ta druga se izvršava kasnije, nezavisno, čak i ako je ova ovde prošla.
5. `base_cost`/`final_price` se pri kreiranju `QuoteItem` ne preuzima slepo iz `SearchResultOffer.final_price` — računa se ponovo po formuli iz poglavlja 2.1/3.2b (`CONTRACTED`) ili ponovnim čitanjem `AvailabilityQuote` preko M4 (`API`, svaki put pri `POST /quotes`, iz bezbednosnih razloga dok se operativno ne pokaže da je to preskupo u broju poziva ka dobavljaču — tad se uvodi prag, kao posebna dopuna). Cena prikazana u rezultatima pretrage je uvek najbolja procena u tom trenutku, ne konačna garancija — konačna garancija je tek `Quote`/`Booking` potvrda (princip #4, determinizam pre autonomije, poglavlje 3 Master dokumenta).

---

## 3. Model podataka — Ponuda (Quote)

Ponuda je **neobavezujuća** kalkulacija — ne drži (ne "zaključava") kapacitet kod M3/M4. Kapacitet se proverava i rezerviše tek u koraku Potvrde (poglavlje 4). Ovo je namerna odluka: zaključavanje kapaciteta tokom razgledanja ponude uvodi složenost (isticanje rezervacije, oslobađanje) koja nije neophodna — standardna praksa u turizmu je da se dostupnost garantuje tek pri potvrdi, uz jasnu poruku gostu ako je nešto u međuvremenu prodato.

### 3.1 `Quote`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_account_id | UUID, nullable | referenca ka M6 Nalogodavac — nullable dok se gost ne identifikuje (anonimno razgledanje) |
| channel | enum: `B2C_SITE`, `B2B_PORTAL`, `MOBILE`, `INTERNAL_PANEL`, `PHONE` | |
| status | enum: `DRAFT`, `EXPIRED`, `CONVERTED` | |
| expires_at | timestamp | najkraći `quoteExpiresAt` među stavkama (M4) ili podrazumevanih 30 min za čisto ugovorene stavke |
| itinerary_id | UUID (FK → Itinerary), nullable | popunjeno samo ako je Ponuda nastala konverzijom iz sastavljenog putovanja (poglavlje 3.0.3) — nullable za direktne ponude jedne/nekoliko stavki |
| contract_terms_accepted | boolean, default false | dopuna avgust 2026, rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md` — privremeno čuva clickwrap pristanak (M20 poglavlje 3.2) **pre** nego što `Booking`/`ClientContract` postoje; obavezno `true` pre prelaska na plaćanje za `B2C_SITE`/`B2B_PORTAL`/`MOBILE` kanale (M8 poglavlje 3, korak 4) |
| contract_terms_accepted_at | timestamp, nullable | kad je pristanak zabeležen; prenosi se na `ClientContract.accepted_at`/`accepted_method = ELECTRONIC_CLICKWRAP` čim taj zapis nastane (M20 poglavlje 3.1) — vidi poglavlje 4.1 niže |
| created_by | UUID, nullable | user_id ako je kreirao agent; null ako gost sam kreira na sajtu |
| referral_tracking_code | string, nullable | dopuna avgust 2026 (M12 poglavlje 3a) — sirov kod prosleđen iz M8 (`?ref=` parametar), **bez validacije protiv M12** u ovom trenutku; M5 samo prenosi string dalje na `Booking` pri potvrdi. Razrešavanje ka stvarnom sadržaju radi M13, ne M5 |
| created_at | timestamp | |

### 3.2 `QuoteItem`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| quote_id | UUID (FK) | |
| product_id | UUID (FK → M2 Product) | |
| source_type | enum: `CONTRACTED`, `API` | |
| stay_from / stay_to | date | |
| occupancy | JSONB | `{adults, children, room_config}` — `room_config` strukturiran, vidi poglavlje 3.2a |
| base_cost / base_cost_currency | integer / string | iz M3 RateLine ili M4 AvailabilityQuote, u najmanjoj jedinici valute (poglavlje 2) |
| rate_line_id | UUID, nullable (FK → M3 RateLine) | za `CONTRACTED` stavke — koja konkretna cenovna kombinacija (usluga/`board_type`) je izabrana; nullable za `API` stavke. `room_type` se ne duplira ovde — dobija se preko `ContractPeriod.room_type` (roditelj izabranog `RateLine`, vidi M3 §2.3/2.4) |
| markup_rule_id | UUID (FK → MarkupRule) | koje je pravilo primenjeno — čuva se radi sledljivosti čak i ako se pravilo kasnije promeni |
| final_price / final_price_currency | integer / string | rezultat formule iz 2.1, u najmanjoj jedinici valute |
| provider_quote_reference | string, nullable | za API stavke, radi ponovne provere pred potvrdu |
| unit_count | integer, default 1 | dopuna v1.14 — broj rezervisanih jedinica (soba), izveden iz `occupancy.room_config.length` u trenutku građenja stavke (`QuoteItemBuilderService`); prenosi se nepromenjen na `BookingItem` pri potvrdi (poglavlje 4) i pri izmeni (poglavlje 6) — koristi se da se pri potvrdi rezerviše, a pri otkazivanju/izmeni oslobodi TAČAN broj jedinica u M3, ne uvek pretpostavljena 1 |
| cancellation_policy_snapshot | JSON, nullable | dopuna v1.14 — samo za API (M4) stavke: snimak `M4 AvailabilityQuote.cancellationPolicy` (niz `{days_before_stay, refund_percentage}`, isti oblik kao M3 `CancellationRule`) u trenutku građenja stavke; `null` za CONTRACTED stavke, koje pri otkazivanju i dalje čitaju M3 `CancellationRule` uživo preko `rate_line_id`. Bez ovog snimka, procenat povraćaja za API stavke ne bi mogao da se izračuna deterministički pri otkazivanju (M4 se ne poziva ponovo u tom trenutku, a polisa u međuvremenu može da se promeni) |

### 3.2a `occupancy.room_config` — struktura (dopuna, avgust 2026, na zahtev vlasnika)

Do sada nedefinisan JSON blob — sad je **niz objekata**, jedan po traženoj sobi (npr. porodica koja treba 2 sobe je niz sa dva elementa):

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| room_type_code | string, nullable | referencira M2 `Product.attributes.room_types[].code` (M2 poglavlje 2.3a) ako je gost/agent već izabrao konkretan tip sobe; `null` dok se samo traži dostupnost bez izbora |
| adults | integer | |
| children | integer | |
| children_ages | niz integer, nullable | uzrast svakog deteta (uključujući bebe) — svrstava se u kategoriju prema M2 `room_types[].age_policy[]` (M2 poglavlje 2.3b), vidi validaciju kapaciteta niže |

**Pravilo slaganja:** zbir `adults`/`children` preko svih stavki `room_config[]` mora odgovarati `occupancy.adults`/`occupancy.children` na nivou cele stavke — `occupancy.adults`/`children` ostaju jednostavan zbirni broj (koriste ga i tipovi bez sobe, npr. `TRANSPORT`/`TICKET`/`EVENT`, M5 poglavlje 11), `room_config[]` je detaljan raspored samo za tipove sa smeštajem (`ACCOMMODATION`, `PACKAGE` koji uključuje smeštaj). Neusklađen zbir se odbija pri kreiranju `Quote` (`POST /quotes`) sa jasnom porukom, ne tiho ispravlja.

Ako `room_config` nije poslat za tip koji zahteva smeštaj, tretira se kao jedna soba sa svim gostima zajedno (`[{room_type_code: null, adults, children, children_ages: null}]`) — nazadnokompatibilno ponašanje, ne obavezuje pozivaoca da uvek eksplicitno razlaže po sobama.

**Validacija kapaciteta po uzrastu (dopuna, avgust 2026, na zahtev vlasnika):** kad je `room_type_code` poznat, M5 za svaki uzrast iz `children_ages[]` pronalazi odgovarajuću kategoriju u M2 `room_types[].age_policy[]` (po `age_from`/`age_to` te sobe — M2 poglavlje 2.3b) i broji protiv `capacity_adults`/`capacity_children` **samo kategorije sa `counts_toward_capacity = true`**. Gost čija kategorija ima `counts_toward_capacity = false` (tipično beba u krevetcu) se i dalje evidentira na stavci (radi krevetca i eventualne kasnije cene iz M3), ali se ne računa protiv formalnog kapaciteta sobe niti odbija `Quote` zbog toga. Broj gostiju u pojedinačnoj kategoriji koji prelazi `age_policy[].max_count` te kategorije (npr. druga beba u sobi koja dozvoljava samo jednu) se odbija sa jasnom porukom, nezavisno od ukupnog kapaciteta.

### 3.2b Računanje `base_cost` za sobu sa `age_pricing[]` (dopuna, avgust 2026, na zahtev vlasnika)

Kad `rate_line_id` upućuje na `RateLine` koji ima `price_basis`/`age_pricing[]` (M3 poglavlje 2.4/2.4a), `base_cost` jedne sobe za jedno noćenje se računa ovako, deterministički, bez AI procene (princip #4 Master dokumenta):

1. **Svrstaj svakog gosta u kategoriju.** Odrasli su `ADULT`; svaki uzrast iz `children_ages[]` se svrstava po `M2 room_types[].age_policy[]` (isti mehanizam kao validacija kapaciteta iznad). Gosti unutar iste kategorije dobijaju redni broj (`occupant_index`) po redosledu u nizu — prvi, drugi, itd.
2. **Osnovna popunjenost.** `RateLine.occupancy` (M3 poglavlje 2.4) opisuje na koju popunjenost se `RateLine.price` odnosi (npr. "dvokrevetna" = 2 `ADULT` gosta). Ti gosti se ne obračunavaju posebno kroz `age_pricing[]` — već su pokriveni cenom iz koraka 3.
3. **Osnovna cena.**
   - Ako `price_basis = PER_ROOM_PER_NIGHT` — `RateLine.price` se uzima **jednom**, za celu sobu.
   - Ako `price_basis = PER_PERSON_PER_NIGHT` — `RateLine.price` se množi brojem `ADULT` gostiju pokrivenih osnovnom popunjenošću.
4. **Svaki gost iznad osnovne popunjenosti** (bilo koje kategorije — dodatni `ADULT`, `CHILD`, `TEEN`, `INFANT`) se dodaje pojedinačno preko `M3 RateLine.age_pricing[]`: pronađi red po pravilu razrešavanja iz M3 poglavlja 2.4a (kategorija + `occupant_index` + `min_adults_present`), primeni `pricing_mode` (`PERCENTAGE_OF_BASE_PRICE` → `round(RateLine.price * percentage / 100)`, ili `FLAT_PRICE_PER_NIGHT` → `flat_price`), i saberi.
5. **Krevetac.** Ako soba ima gosta kategorije sa `requires_crib = true` (M2 poglavlje 2.3b) i `RateLine.crib_fee_per_night` je postavljen, dodaj taj iznos jednom po traženom krevetcu.
6. **Zbir po noći × broj noćenja** (`stay_to - stay_from`) = `base_cost` te sobe. Za više soba u `room_config[]`, `base_cost` cele `QuoteItem` je zbir po sobama.

Ako korak 4 ne pronađe odgovarajući `age_pricing[]` red ni za jednog gosta (M3 poglavlje 2.4a, ograda), kreiranje `Quote` se odbija — ne postoji podrazumevana pretpostavka o ceni. Rezultat ovog izračuna je `base_cost` na koji se dalje primenjuje `MarkupRule` (poglavlje 2.1) — ništa se ovde ne menja u toj formuli, samo se preciznije određuje ulaz u nju za sobe sa mešovitim uzrastom gostiju.

---

## 4.0a Određivanje `Booking.tip_nastupanja` (dopuna, avgust 2026 — rešava nalaz #1 iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md`)

M10 poglavlje 4.1 kaže da `tip_nastupanja` "bira prodajni tim/agent pri potvrdi rezervacije" — ovo tačno važi za `INTERNAL_PANEL` i `PHONE` kanale (M17, poziv), gde postoji ljudski nalog koji svesno bira. Za samouslužne kanale (`B2C_SITE`, `MOBILE`, `B2B_PORTAL`) **nema ljudskog naloga u toku** — vrednost se mora izvesti automatski, deterministički, bez AI procene (princip #4 Master dokumenta):

1. **Sve stavke iz iste ponude moraju se slagati.** Za svaku `QuoteItem`, izvedi kandidat vrednost: `CONTRACTED` stavka → `M3 Contract.default_tip_nastupanja` (M3 poglavlje 2.2a) preko `Product.source_contract_id`; `API` stavka → `M4 ProviderConfig.default_tip_nastupanja` (M4 poglavlje 3.1) preko `Product.source_provider`.
2. Ako se svi kandidati slažu, ta vrednost postaje `Booking.tip_nastupanja`.
3. Ako se kandidati **ne slažu** (npr. ponuda kombinuje proizvod gde je agencija organizator sa proizvodom gde je posrednik), samouslužni kanal **ne sme sam da potvrdi rezervaciju** — sistem vraća jasnu grešku i traži da se ponuda razdvoji na zasebne rezervacije, ili da tim preuzme potvrdu ručno kroz M17 (gde ljudski nalog svesno bira jednu vrednost za celu rezervaciju, svestan da to ne odgovara doslovno sastavu stavki — retka, granična situacija).
4. Za `INTERNAL_PANEL`/`PHONE` kanale, ponašanje iz koraka 1–3 služi samo kao **podrazumevana, unapred popunjena vrednost** — ljudski nalog je uvek slobodan da je eksplicitno promeni pre potvrde (M3 poglavlje 2.2a), isti princip kao svaki drugi podrazumevani unos u sistemu.

`Booking.tip_nastupanja` ostaje **nepromenljivo posle kreiranja rezervacije**, bez obzira na to da li je vrednost automatski izvedena ili ručno izabrana (nepromenjeno pravilo iz M10 poglavlja 4.1).

---

## 4. Potvrda rezervacije (Quote → Booking)

Korak po korak:

1. Proveri da `Quote.status = DRAFT` i da nije istekla. Ako je istekla, **ponovo izračunaj cenu/dostupnost** (nova pitanja ka M3/M4) pre nastavka — nikad se ne potvrđuje na osnovu zastarele cene. Odredi `Booking.tip_nastupanja` po pravilu iz poglavlja 4.0a. Redosled provera pre bilo kog poziva ka M3/M4, **uvek u ovom fiksnom redosledu** (dopuna avgust 2026 — rešava nalaz o nedefinisanom redosledu iz `VALIDACIJA-WORKFLOW-B2B.md`): **(a)** ako je `tip_nastupanja = ORGANIZATOR`, pozovi M11 `GET /travel-guarantee/utilization` (M11 poglavlje 4.2) — prekoračenje limita garancije odbija potvrdu; **(b)** ako `Quote.client_account_id` pripada Subagentu (M7 poglavlje 2.1 — provera postojanja `Subagent` zapisa za taj `client_account_id`, ne provera `ClientAccount.account_type`, jer obično pravno lice koje nije registrovan subagent ne prolazi kroz ovu proveru), proveri kreditni limit (M7 poglavlje 4) — prekoračenje odbija potvrdu. Razlog za ovaj redosled: zakonska ograda (garancija) je stroža i nezavisna od toga ko kupuje, pa se proverava prva; poslovna ograda (kredit) proverava se druga, samo ako je prva prošla.
2. Za svaku `QuoteItem`:
   - Ako `CONTRACTED`: pozovi M3 `/contracts/:id/periods/:periodId/reserve`. Uspeh → `item_status = CONFIRMED`. Ako je period `ON_REQUEST` → `item_status = PENDING_SUPPLIER_CONFIRMATION`. Neuspeh (nema kapaciteta) → stavka pada.
   - Ako `API`: pozovi M4 `/internal/providers/:code/bookings` sa jedinstvenim `idempotency_key`. Mapiraj `BookingConfirmation.status` u `item_status`.
3. **Sve ili ništa:** ako bilo koja stavka padne (nema kapaciteta, provajder odbije), sve već uspešno rezervisane stavke iz ovog pokušaja se **odmah oslobađaju** (M3 release / M4 `cancelBooking`) — sistem nikad ne ostavlja polovično rezervisanu rezervaciju. Gost/agent dobija jasnu poruku koja stavka nije uspela, uz ponudu da prilagodi izbor.
4. Ako sve stavke uspeju, kreira se `Booking` sa statusom: `CONFIRMED` ako su sve stavke `CONFIRMED`; `PENDING_SUPPLIER_CONFIRMATION` ako je bar jedna stavka u tom stanju (rezervacija prelazi u `CONFIRMED` tek kad se i poslednja stavka potvrdi — ručno ili preko M4 povratnog poziva). `buyer_name`/`buyer_type`/`buyer_tax_id` (dopuna v1.17) se unose u ovom pozivu (`POST /quotes/:id/confirm`) i snimaju direktno na `Booking` — obavezni podaci, provereni pre kreiranja.
5. Emituje se događaj (poglavlje 9).

### 4.1 `Booking`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_number | string, unique | čitljiva oznaka za gosta (npr. `TT-2027-000482`) |
| client_account_id | UUID (FK → M6) | ko plaća |
| buyer_name | string | dopuna v1.17 (avgust 2026) — unosi se u `POST /quotes/:id/confirm` (poglavlje 11), ne čeka M6; potrebno M10 fiskalizaciji (SEF/ESIR, M10 spec §1.1/§2) |
| buyer_type | enum: `FIZICKO_LICE`, `PRAVNO_LICE` | dopuna v1.17 — određuje da li M10 izdaje SEF e-fakturu (pravno lice) ili ESIR račun (fizičko lice) |
| buyer_tax_id | string, nullable | dopuna v1.17 — obavezno kad je `buyer_type = PRAVNO_LICE` (PIB), validirano i u DTO-u i u servisu |
| channel | enum (isto kao Quote) | |
| tip_nastupanja | enum: `ORGANIZATOR`, `POSREDNIK` | dodato u M10 specifikaciji, poglavlje 4.1 — određuje se po pravilu iz poglavlja 4.0a (automatski za samouslužne kanale, ručno biran uz podrazumevanu vrednost za `INTERNAL_PANEL`/`PHONE`), **nepromenljivo posle kreiranja rezervacije**; određuje PDV tretman (M10) i tip klijentskog ugovora (M20) |
| status | enum: `PENDING_SUPPLIER_CONFIRMATION`, `CONFIRMED`, `MODIFIED`, `CANCELLED`, `COMPLETED` | |
| payment_status | enum: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `INVOICE_PENDING` | **potvrđeno: potvrda rezervacije ne zavisi od statusa plaćanja** — B2B kredit i avansno plaćanje su podržani od starta |
| total_price / currency | integer / string | zbir `final_price` svih stavki, u najmanjoj jedinici valute |
| voucher_url | string, nullable | generiše se kad su ispunjeni uslovi iz poglavlja 6 (puna uplata, ili odobren izuzetak) |
| voucher_override_approved_by | UUID, nullable (FK → M1 User) | popunjeno samo ako je vaučer izdat bez pune uplate — vidi poglavlje 6 |
| voucher_override_reason | text, nullable | obrazloženje izuzetka, unosi ga odobravalac |
| voucher_override_at | timestamp, nullable | |
| contract_terms_accepted_at | timestamp, nullable | dopuna v1.19 (avgust 2026) — kopija `Quote.contract_terms_accepted_at` u trenutku potvrde (samo kad je `Quote.contract_terms_accepted = true`); `Booking` nema `quote_id` referencu nazad, pa se ovo polje kopira direktno jer je M20 stvarno potrebno (poglavlje 3.1/3.2, ne-null znači ugovor se automatski prevodi u `ACCEPTED`) |
| created_at / confirmed_at / cancelled_at | timestamp | |
| created_by | UUID | user ili "GOST_SELF" |
| referral_tracking_code | string, nullable | dopuna avgust 2026 (M12 poglavlje 3a) — kopirano iz `Quote.referral_tracking_code` pri potvrdi, isti obrazac kao `channel`/`client_account_id`; M13 ga razrešava ka `ContentPiece` pri izgradnji projekcije |

### 4.2 `BookingItem`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK) | |
| product_id | UUID (FK → M2) | |
| source_type | enum: `CONTRACTED`, `API` | |
| supplier_reference | string | za CONTRACTED: `ContractPeriod.id`; za API: `providerBookingReference` iz M4 |
| stay_from / stay_to | date | |
| base_cost / rate_line_id / markup_rule_id / final_price | (isto kao QuoteItem) | prenosi se iz ponude u trenutku potvrde |
| item_status | enum: `CONFIRMED`, `PENDING_SUPPLIER_CONFIRMATION`, `CANCELLED` | |
| cancellation_refund_percentage | integer, nullable | popunjava se pri otkazivanju, iz M3 `CancellationRule` (preko `rate_line_id`) za CONTRACTED, ili iz `cancellation_policy_snapshot` (dopuna v1.14, ista deterministička formula — najspecifičniji `days_before_stay` koji je `<= dana do stay_from` pobeđuje) za API |
| unit_count | integer, default 1 | dopuna v1.14 — kopira se iz `QuoteItem.unit_count` pri potvrdi (poglavlje 4) ili pri izmeni (poglavlje 6); koristi se pri otkazivanju/izmeni da se oslobodi tačan broj jedinica nazad u M3, ne uvek pretpostavljena 1 (ranija greška — ispravljeno v1.14) |
| cancellation_policy_snapshot | JSON, nullable | dopuna v1.14 — kopira se iz `QuoteItem.cancellation_policy_snapshot` pri potvrdi/izmeni; vidi poglavlje 3.2 za tačan oblik |
| assigned_guide_id | UUID, nullable (FK → M1 User, uloga `VODIC`) | dodato pri specifikaciji M9 — dodeljuje interni panel (M17), koristi ga M9 za filtriranje itinerara vodiča na terenu |
| duplicate_conflict_item_id | UUID, nullable (FK → `BookingItem`) | dodato u poglavlju 6.4 — popunjava se proverom duplikata pri otkazivanju, referenca na konfliktnu stavku koja je pronađena |
| duplicate_check_overridden_by / duplicate_check_overridden_at | UUID (FK → M1 User) / timestamp, oba nullable | dodato u poglavlju 6.4 — popunjava se samo ako je operater eksplicitno potvrdio otkazivanje uprkos pronađenom duplikatu |
| announced_at | timestamp, nullable | dodato u poglavlju 8.6 — trenutak kad je stavka formalno najavljena dobavljaču; za `CONTRACTED` kopira se iz `SupplierManifest.sent_at` liste koja je sadrži, za `API` popunjava se automatski u trenutku potvrde (poglavlje 8.6) |
| supplier_confirmed_at / supplier_confirmed_by | timestamp / UUID (FK → M1 User), oba nullable | dodato u poglavlju 8.6 — potvrda da je dobavljač primio/prihvatio najavu; za `CONTRACTED` ručni unos (dobavljači nemaju API), za `API` popunjava se automatski |

### 4.3 `BookingItemGuest` (spojna tabela)
`booking_item_id`, `guest_profile_id` (FK → buduće M6 Gost) — više gostiju po stavci (npr. porodica u jednoj sobi).

**Napomena o istoriji statusa:** promene statusa rezervacije se ne čuvaju u posebnoj tabeli — koristi se `AuditLogEntry` iz M1 (modul `M5`, `resource_type = Booking`), u skladu sa principom #5 iz poglavlja 3 (jedan mehanizam za trag izmena, ne dupliranje).

---

## 5. Plaćanje — namerno van obima detalja

`Booking.payment_status` postoji kao polje, ali **sama naplata, fiskalizacija i knjiženje su van obima M5** — to je M10 (Faza 2). M5 izlaže `PATCH /bookings/:id/payment-status`, koji poziva isključivo M10 kad se plaćanje obradi; M5 sam nikad ne inicira transfer novca (u skladu sa "Nikad autonomno" iz poglavlja 7).

---

## 6. Upravljanje rezervacijom nakon potvrde

- **Izmena** (datum, broj gostiju): tretira se interno kao otkazivanje pogođene stavke + nova provera dostupnosti/cene za novi zahtev, prikazano gostu kao jedna radnja "izmeni rezervaciju". Razlika u ceni (doplata ili povraćaj) se beleži, stvarna naplata/povraćaj opet ide kroz M10.
- **Otkazivanje:** za svaku stavku koja se otkazuje, `cancellation_refund_percentage` se izračunava iz M3 `CancellationRule` (po broju dana do `stay_from`) ili M4 `cancellationPolicy`; kapacitet se oslobađa nazad (M3 `units_sold` se umanjuje, ili M4 `cancelBooking`). Booking prelazi u `CANCELLED` samo ako se otkazuju sve stavke; ako se otkazuje samo deo, booking ostaje `MODIFIED` sa preostalim aktivnim stavkama.
- **Vaučer:** generiše se PDF sa detaljima rezervacije, čuva se u EU cloud skladištu, referenca u `voucher_url`. **Podrazumevano se generiše tek kad je `Booking.status = CONFIRMED` I `payment_status = PAID`** (puna uplata) — sistem ne generiše vaučer za `UNPAID`, `PARTIALLY_PAID` ili `INVOICE_PENDING` bez izričitog odobrenja. Pošto uplata (posebno B2B kredit/avans) često stiže posle same potvrde rezervacije, sistem proverava ovaj uslov ne samo pri potvrdi nego i pri svakoj promeni `payment_status` (`PATCH /bookings/:id/payment-status`, poglavlje 5) — čim stavka pređe u `PAID`, vaučer se generiše automatski ako do tada nije već izdat.

  **Izuzetak — izdavanje bez pune uplate:** Vlasnik ili Direktor mogu ručno odobriti izdavanje vaučera bez uplate ili sa delimičnom uplatom. Ovo je uvek eksplicitna ljudska radnja — nivo **"Nikad autonomno"** iz poglavlja 7 Master dokumenta (AI agent zadužen za M5 nikad sam ne pokreće ovo odobrenje, isto obrazloženje kao izuzeci od finansijskih ograda u M3/M11) — beleži se u `voucher_override_approved_by`/`voucher_override_reason`/`voucher_override_at` (poglavlje 4.1) i vidljivo je u M1 audit logu.

  **Dodatni uslov za `tip_nastupanja = ORGANIZATOR`** (dopuna M20 specifikacije, poglavlje 3.3): vaučer se ne generiše — ni automatski ni preko izuzetka iznad — dok `ClientContract` (M20) ne postoji bar u statusu `GENERATED`. Ugovor sa klijentom mora postojati pre nego što gost dobije vaučer.

### 6.1 Praćenje posle potvrde — podsetnici i alarmi

Van same potvrde i vaučera, M5 periodičnim poslom prati tri situacije i upozorava tim (interni panel + email, isti obrazac kao M11 poglavlje 2.2) — sve na nivou **"Autonomno"** iz poglavlja 7 Master dokumenta: čisto informativno, ne menja niti blokira stanje rezervacije.

- **Neplaćena rezervacija sa izdatim vaučerom (izuzetak iznad):** dok god `voucher_override_approved_by` nije prazno i `payment_status != PAID` i `Booking.status != CANCELLED`, sistem svakodnevno podseća tim da uplata nije završena. Podsetnik prestaje čim `payment_status` pređe u `PAID` (redovan generiše se vaučer bez izuzetka od tog trenutka) ili se rezervacija otkaže.
- **Otvorena potvrda dobavljača, po stavci:** `BookingItem.item_status = PENDING_SUPPLIER_CONFIRMATION` (poglavlje 4) prati se **po stavci, ne po celoj rezervaciji** — kod rezervacije sa više proizvoda od različitih dobavljača (npr. hotel + transfer), svaka stavka se nezavisno prati prema sopstvenom dobavljaču, razrešenom preko `BookingItem.product_id` → M3 `Supplier` (isto razrešavanje kao poglavlje 8.1). Stavka koja ostane u ovom statusu duže od praga (podrazumevano 48h, konfigurabilno po tipu proizvoda) generiše upozorenje za tu stavku — potvrda ostalih stavki iste rezervacije kod drugih dobavljača ne utiče na ovaj alarm i obrnuto.
- **Vaučer nedostaje uprkos punoj uplati:** ako `payment_status = PAID` a `voucher_url` je i dalje prazno (van override toka iznad, koji bi ga već popunio), to je znak da automatsko generisanje iz poglavlja 6 nije uspelo — sistem odmah generiše upozorenje; ovo je greška u sistemu i ne sme tiho da prođe.
- **Nenajavljena stavka pred boravak (dopuna, avgust 2026 — problem #2):** `CONTRACTED` stavka sa `item_status = CONFIRMED` čiji `stay_from` pada u narednih 7 dana (podrazumevano, konfigurabilno), a `announced_at` je i dalje prazno — znači da dobavljač još ne zna ko dolazi. Ovo je hitniji alarm od ostalih u ovoj listi jer direktno preti check-inu.
- **Najava bez potvrde dobavljača (dopuna, avgust 2026 — problem #2):** `announced_at` popunjeno duže od 5 dana (podrazumevano, konfigurabilno), a `supplier_confirmed_at` i dalje prazno — informativni podsetnik timu da proveri kod dobavljača, niži prioritet od prethodnog.

Ovi alarmi se prikazuju u internom panelu (M17 Agent Inbox) i ne uvode novu dozvolu — vidljivi su svima sa `M5/booking/VIEW` nad tom rezervacijom, uz kopiju na email Vlasniku/Direktoru za treću i četvrtu stavku (sistemska greška, odnosno rizik od propuštenog check-ina).

### 6.2 Identitet dobavljača se nikad ne izlaže B2C/B2B kanalima (dopuna, avgust 2026, na zahtev vlasnika)

Isto pravilo kao M2 poglavlje 5.1, primenjeno na M5: vaučer (poglavlje 6), pregled rezervacije koji vidi gost (M8/M9) ili B2B subagent (M7), i svaki M5 API odgovor ka tim kanalima **nikad** ne sadrže `BookingItem.supplier_reference` niti bilo koje polje iz M3 `Supplier`/`Contract` do kog bi se moglo doći preko `BookingItem.product_id` → M2 `Product.source_contract_id`. Vidljivi ostaju proizvod, datumi, cena za gosta/subagenta i status — ono što je već prirodan sadržaj vaučera/pregleda.

**Izuzetak — interni kanal:** M17 (interni radni panel), pregled kalendara (poglavlje 7) i operativne liste ka dobavljaču (poglavlje 8) i dalje pun pristup imaju — poglavlje 8 uostalom *postoji* zato što dobavljač mora da dobije spisak, to ostaje nepromenjeno. Ograničenje važi isključivo za ono što vidi gost (M8/M9) ili B2B subagent (M7).

**Sprovođenje:** isti princip kao M2 poglavlje 5.1 — polje se ne sme naći u payload-u ka gost/B2B kontekstu, ne oslanjati se na to da front-end jednostavno ne prikaže.

### 6.3 Sistemski izuzetak izdavanja vaučera — subagent unutar odobrenog kredita (dopuna, avgust 2026 — rešava nalaz iz `VALIDACIJA-WORKFLOW-B2B.md`)

Poglavlje 6 zahteva `payment_status = PAID` pre automatskog izdavanja vaučera, sa ručnim izuzetkom ograničenim na Vlasnika/Direktora (`voucher_override_*`). Ovo pravilo je pisano sa B2C rizikom na umu (spreči izdavanje dokumenta bez ikakve naplate) — ali B2B prodaja na kredit (M7 poglavlje 4) je **redovan, ugovoren način poslovanja** sa subagentom, ne izuzetak, pa bi zahtevanje ručnog odobrenja za svaku takvu rezervaciju opterećivalo Vlasnika/Direktora bez stvarne dodatne bezbednosti — kreditni rizik je već proveren i ograničen pri potvrdi rezervacije (poglavlje 4, korak 1b).

**Pravilo:** Za `Booking` gde `client_account_id` pripada `Subagent`-u sa `status = ACTIVE` (M7 poglavlje 2.1), vaučer se generiše automatski čim `Booking.status = CONFIRMED`, **nezavisno od `payment_status`** — pod uslovom da je rezervacija uopšte uspela da prođe proveru kreditnog limita iz poglavlja 4 (što znači da je `current_outstanding_balance` posle ove rezervacije i dalje unutar `credit_limit`). Ovo je nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — mehanička posledica već izvršene ljudske/sistemske kontrole rizika (odobrenje subagenta u `ACTIVE`, poglavlje 9 M7 specifikacije; kreditni limit koji je postavio Vlasnik/Direktor), ne nova autonomna finansijska odluka.

`voucher_override_*` polja (poglavlje 6) ostaju rezervisana za **izuzetke van ovog pravila** — npr. rezervacija koja bi prekoračila kreditni limit, ili poseban jednokratni dogovor van standardnog B2B odnosa; u tim slučajevima i dalje je obavezno ručno odobrenje Vlasnika/Direktora, nepromenjeno.

**Napomena:** ovo ne menja tok naplate niti fiskalizaciju — `payment_status` i dalje tačno odražava stvarno stanje uplate (M10), samo se izdavanje vaučera više ne uslovljava punom uplatom za ovu specifičnu, već rizično-proverenu kategoriju rezervacija.

### 6.4 Provera duplikata pre otkazivanja (dopuna, avgust 2026 — rešava problem #10 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, vidi `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md` poglavlje 10)

**Poznat slučaj iz prakse:** isti gost je imao dve odvojene rezervacije za isti hotel/termin/uslugu — jednu direktnu, jednu preko B2B subagenta (M7) — svaku kao poseban `Booking`. Operater nije primetio da imena gostiju upućuju na istu osobu i otkazao je onu koja kod nas nije bila uplaćena, misleći da je duplikat. Pošto dobavljač (hotel) rezervacije prati po imenu i prezimenu gosta, a ne po internom ID-ju našeg sistema, dobavljač je posledično otkazao i onu drugu, ispravnu i uplaćenu rezervaciju.

**Pravilo:** pre nego što se otkazivanje stavke iz poglavlja 6 ("Otkazivanje") izvrši, sistem proverava da li postoji **druga aktivna** `BookingItem` (`item_status = CONFIRMED` ili `PENDING_SUPPLIER_CONFIRMATION`, u bilo kom `Booking`-u, **nezavisno od kanala ili `client_account_id`**) koja upućuje na mogući duplikat:

- isti `product_id` (isti objekat kod istog dobavljača),
- preklapajući `stay_from`/`stay_to`,
- podudarno ime gosta preko `BookingItemGuest` → M6 `GuestProfile.first_name`/`last_name` — **deterministički fuzzy-match** (normalizacija dijakritika/velikih-malih slova + prag sličnosti niske cene računanja, npr. Levenshtein), ne AI/LLM poziv po stavci, u skladu sa principom #4 Master dokumenta ("determinizam pre autonomije").

Ako provera pronađe podudaranje, otkazivanje se **ne izvršava tiho** — operater dobija eksplicitno upozorenje pre potvrde storna, sa prikazom konfliktne stavke (broj rezervacije, kanal, ime gosta, `payment_status`). Otkazivanje se nastavlja tek posle eksplicitne dodatne potvrde operatera; ta potvrda popunjava `duplicate_conflict_item_id`, `duplicate_check_overridden_by` i `duplicate_check_overridden_at` (poglavlje 4.2) i ostaje vidljiva u `AuditLogEntry` (isti mehanizam kao poglavlje 4.3).

Nivo autonomije: **"Predloži pa čovek odobri"** (Master dokument poglavlje 7) — sistem ne blokira otkazivanje automatski (mogu postojati legitimni razlozi za dve odvojene rezervacije iste osobe — npr. dve različite grupe putnika koje slučajno dele ime i prezime), samo traži svesnu potvrdu umesto da propusti storno bez upozorenja. Provera se ne ograničava na posebnu dozvolu — važi za svakog ko ima pravo da otkaže stavku (`M5/booking/CANCEL`, poglavlje 10).

**Primena na subagentski kanal (M7):** pošto B2B subagenti otkazuju rezervacije kroz isti `POST /bookings/:id/cancel` tok (bilo direktno kroz portal, bilo preko internog panela u njihovo ime), provera duplikata iz ovog poglavlja se automatski primenjuje i tamo — nije potreban poseban mehanizam u M7 specifikaciji, samo referenca (vidi `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md`).

**Otvoreno za dalje:** ova provera rešava trenutak storna, ali ne i uzrok — da isti fizički gost stoji iza dva različita `ClientAccount`-a (direktan gost i klijent subagenta) bez povezanog profila u M6. Dugoročno rešenje (predlog spajanja/povezivanja gostiju u M6 kad se otkrije podudaranje identiteta) ostaje otvoreno pitanje za M6 specifikaciju.

---

## 7. Kalendar rezervacija (pregled po datumu)

Operativni prikaz za tim: klikom na datum u kalendaru vidi se koje stavke rezervacije (`BookingItem`) tog dana **dolaze**, **odlaze**, ili su **u toku** — standardan obrazac iz hotelskih/PMS sistema (Arrivals / Departures / Stayovers), primenjen ovde na sve tipove proizvoda iz M2, ne samo hotel. Ovo nije nov entitet ni nova baza — čist izveden upit nad postojećim `BookingItem.stay_from`/`stay_to`, u skladu sa principom "jedan izvor istine" (isto obrazloženje kao M3 poglavlje 3).

### 7.1 Klasifikacija po danu D (deterministička)
| Kategorija | Uslov | Napomena |
| :---- | :---- | :---- |
| **Dolazi** (arrival) | `stay_from = D` i `stay_to > D` | check-in / početak boravka/ture tog dana |
| **Odlazi** (departure) | `stay_to = D` i `stay_from < D` | check-out / kraj boravka/ture tog dana |
| **U toku** (stayover) | `stay_from < D < stay_to` | gost/putnik je prisutan taj dan, ni ne dolazi ni ne odlazi |
| **Jednodnevno** | `stay_from = D` i `stay_to = D` | npr. izlet ili transfer u istom danu — posebna, četvrta grupa, **ne** broji se ni kao dolazak ni kao odlazak da se brojevi ne dupliraju |

Obuhvataju se samo aktivne stavke: `item_status` = `CONFIRMED` ili `PENDING_SUPPLIER_CONFIRMATION`; `CANCELLED` stavke se isključuju — isti filter koji već važi za ostale preglede rezervacija.

### 7.2 Dva nivoa prikaza
- **Mesečni/nedeljni pregled** — samo brojevi po danu (koliko dolazi/odlazi/u toku/jednodnevno), da se kalendar iscrta brzo bez učitavanja svake pojedinačne stavke.
- **Dnevni detalj** (klik na datum) — puna lista stavki razvrstana u četiri grupe iz poglavlja 7.1, sa osnovnim podacima (gost/putnik, proizvod, dobavljač ili kanal, status).

### 7.3 Dozvole i vidljivost
Kalendar je samo drugačiji prikaz `BookingItem` podataka koje korisnik već sme da vidi — **ne uvodi novu dozvolu**, koristi `M5/booking/VIEW` (poglavlje 10). Posledica: Prodajni agent čiji je `M5/booking/VIEW` podrazumevano ograničen na sopstvene klijente vidi kalendar filtriran na isti način; Vlasnik/Direktor/Sales Manager vide sve.

---

## 8. Operativne liste za dobavljače

Odvojeno od vaučera koji dobija gost (poglavlje 6), agencija mora dobavljaču — hotelu, prevozniku, osiguravaču — da pošalje **operativni spisak gostiju/putnika** za konkretan period boravka ili polazak (rooming lista hotelu, spisak putnika prevozniku, spisak osiguranika osiguravaču). Ovo je dokument koji ide **od agencije ka dobavljaču**, obrnuto od vaučera, i primenjuje se isključivo na `CONTRACTED` stavke (poglavlje 4.2) — kod `API` stavki (M4) podaci o gostu već putuju do dobavljača kroz samu API rezervaciju u trenutku potvrde, pa poseban operativni dokument nije potreban.

### 8.1 `SupplierManifest` — operativna lista
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → M3 Supplier) | rešava se preko `BookingItem.product_id` → M2 `Product.source_contract_id` → M3 `Contract.supplier_id`, u trenutku generisanja |
| contract_period_id | UUID, nullable (FK → M3 ContractPeriod) | period na koji se lista odnosi, kad su sve stavke iz istog perioda (uobičajen slučaj); nullable ako lista objedinjuje više perioda istog dobavljača za isti opseg datuma |
| supplier_type_snapshot | enum (isto kao M3 `Supplier.type`) | kopira se u trenutku generisanja — određuje format liste (poglavlje 8.3); ne menja se retroaktivno ako se `Supplier.type` kasnije izmeni |
| language | enum: `SR`, `EN`, podrazumevano `SR` | bira korisnik pri generisanju nacrta (poglavlje 8.3) — ne menja se retroaktivno na već poslatoj listi, isti princip kao `supplier_type_snapshot` |
| period_from / period_to | date | opseg boravka/polaska koji lista pokriva |
| status | enum: `DRAFT`, `SENT`, `SUPERSEDED` | `DRAFT` — generisana, nije poslata; `SENT` — poslata dobavljaču; `SUPERSEDED` — zamenjena novijom verzijom (poglavlje 8.5) |
| document_url | string, nullable | PDF, generiše se pri prelasku u `DRAFT`, isto EU cloud skladište kao vaučer |
| generated_at / generated_by | timestamp / UUID | `generated_by` može biti `AI_AGENT_M5` (poglavlje 8.4) |
| sent_at / sent_by | timestamp / UUID, nullable | `sent_by` mora biti stvaran korisnik — slanje nikad nije autonomno (poglavlje 8.4) |
| sent_to_email | string, nullable | kopija `Supplier.contact_email` u trenutku slanja, radi traga čak i ako se kontakt kasnije promeni |
| reference_code | string, unique, nullable | dopuna avgust 2026 (poglavlje 8.8) — jedinstvena referenca (npr. `TT-000423`) upisana u naslov mejla pri slanju, radi automatskog poklapanja sa potvrdom dobavljača; generiše se pri prelasku u `DRAFT` |
| confirmation_email_thread_id | UUID, nullable (FK → M22 `EmailThread`) | dopuna avgust 2026 (poglavlje 8.8) — popunjeno kad je nit prepiske o ovoj listi prepoznata (po `reference_code` ili ručno) |
| supersedes_manifest_id | UUID, nullable (FK → SupplierManifest) | ako je ovo revizija ranije poslate liste |

### 8.2 `SupplierManifestItem` — spojna tabela
`supplier_manifest_id` (FK), `booking_item_id` (FK → `BookingItem`), `included_at` (timestamp). Jedan `BookingItem` može tokom vremena biti na više listi (npr. original pa revizija), ali sme biti na najviše jednoj listi koja nije `SUPERSEDED` u datom trenutku — ograda na nivou aplikacije.

### 8.3 Format po tipu dobavljača
| `Supplier.type` | Sadržaj liste |
| :---- | :---- |
| `HOTEL` | Raspored po jedinicama (svaki `BookingItem` = jedna prodata soba/jedinica): imena gostiju iz `BookingItemGuest` → M6 Gost, `stay_from`/`stay_to`, broj gostiju po jedinici, tip sobe (`ContractPeriod.room_type`, iz M3) i usluga (`RateLine.board_type` preko `BookingItem.rate_line_id`) |
| `PREVOZNIK` | Spisak putnika: ime, broj putovnice/lične karte (kad postoji u M6 profilu gosta), datum/vreme polaska |
| `OSIGURAVAC` | Spisak osiguranika sa datumima pokrića (`stay_from`/`stay_to`) |
| `DRUGO` | Generički spisak — ime i period, bez dodatnih pretpostavki |

**Ograda:** cena (`base_cost`, `final_price`, marža) se **nikad** ne uključuje u listu ka dobavljaču — to je interni podatak agencije; dobavljač već zna svoju ugovorenu cenu iz sopstvenog `RateLine` (M3).

**Jezik dokumenta:** operativna lista se generiše na srpskom ili engleskom (`SupplierManifest.language`, poglavlje 8.1) — dovoljno za sada; ne mora pratiti punih 8 jezika M2 kataloga, pošto je ovo interni operativni dokument ka dobavljaču, ne B2C sadržaj. Korisnik bira jezik pri generisanju nacrta; izabrani jezik ostaje nepromenjen i na revizijama (poglavlje 8.5). Dodato poređenjem sa PrimeTravel rooming-listom (SR/EN prekidač), vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`.

### 8.4 Generisanje i slanje — uloga AI agenta
Agent zadužen za M5 sme **automatski da pripremi nacrt** (`status = DRAFT`) — npr. periodičan posao koji za svaki `ContractPeriod` čiji `stay_from` pada u narednih N dana agregira potvrđene (`item_status = CONFIRMED`) stavke po dobavljaču — ovo je čisto informativna priprema, nivo **"Autonomno"** iz poglavlja 7 Master dokumenta. **Slanje dobavljaču** (prelazak u `status = SENT`) zahteva ljudsku potvrdu, nivo **"Predloži pa čovek odobri"** — isti princip kao slanje ponuda B2B partnerima, i isto obrazloženje kao u M3 poglavlju 4 (agent nikad sam ne šalje potvrdu dobavljaču). Od avgusta 2026 (poglavlje 8.8), slanje ide isključivo kroz jedinstveno M22 sanduče za dobavljače — ne sa ličnog naloga zaposlenog koji klikne "pošalji".

**Ad-hoc priprema po rezervaciji (dopuna, avgust 2026, na zahtev vlasnika, v1.15):** pored periodičnog posla iznad, operater može da zatraži pripremu odmah za JEDNU konkretnu rezervaciju (`POST /bookings/:id/prepare-supplier-manifests`, poglavlje 11) — npr. čim je rezervacija potvrđena, bez čekanja na sledeći prolaz periodičnog posla. Ovo koristi ISTI princip grupisanja kao periodično agregiranje: `SupplierManifest` je uvek vezan za tačno jednog dobavljača (poglavlje 8.1), pa ako rezervacija sadrži `CONTRACTED`/`CONFIRMED` stavke od više različitih dobavljača (npr. hotel + transfer od dva različita dobavljača), akcija automatski pripremi po jedan odvojen DRAFT nacrt za svakog — operater ne mora ručno da zna koji su dobavljači uključeni niti da poziva akciju više puta. Isti nivo autonomije kao iznad (**"Autonomno"** za pripremu nacrta), slanje ostaje nepromenjeno (ljudski klik, `POST /supplier-manifests/:id/send`). Stavke koje su već na nekoj ne-`SUPERSEDED` listi se preskaču (isti filter kao periodično agregiranje) — sprečava duplo najavljivanje iste stavke.

**Ad-hoc priprema za VIŠE rezervacija — kombinovani filteri (dopuna, avgust 2026, na zahtev vlasnika, v1.16):** proširenje prethodnog za slučaj kad operater bira više rezervacija odjednom (`POST /supplier-manifests/prepare-batch`, poglavlje 11). Dva režima:

- **Ručni izbor** (`booking_ids[]`) — operater u M17 čekira nekoliko konkretnih rezervacija (checkbox lista) i traži pripremu za tačno te. Isključiv: kad je prosleđen, svi filteri ispod se ignorišu (nema mešanja "izaberi ove ID-jeve I još filtriraj po datumu" — zbunjujuća kombinacija, ručni izbor je već konačan).
- **Filteri** (kad `booking_ids[]` nije prosleđen) — bar JEDAN od sledećih mora biti prisutan (prazan poziv bez ijednog kriterijuma bi zahvatio SVE nenajavljene stavke ikad postojale, namerno onemogućeno kao previše širok/rizičan podrazumevani obim); prisutni filteri se **kombinuju logičkim I** kad ih je prosleđeno više odjednom:
  - `created_from`/`created_to` — rezervacija **napravljena** u opsegu (`Booking.created_at`), npr. "sve rezervacije napravljene ove nedelje".
  - `stay_from`/`stay_to` — stavka čiji **boravak preklapa** opseg (isti obrazac preklapanja kao `period_from`/`period_to` u periodičnom agregiranju iznad).
  - `arrival_from`/`arrival_to` — stavke čiji je **dolazak** (`stay_from`, ne preklapanje) u opsegu, npr. "ko stiže sledeće nedelje".
  - `departure_from`/`departure_to` — stavke čiji je **odlazak** (`stay_to`) u opsegu.
  - `booking_status[]` — samo rezervacije sa datim statusom/statusima (`Booking.status`, npr. samo `CONFIRMED`).

  Napomena: `created_from`/`created_to` je opseg **kreiranja** rezervacije ("uhvati sve što je nedavno prodato i još nenajavljeno") — namerno odvojeno od preostala tri vremenska filtera koji gledaju **boravak** ("šta se dešava u datom terminu", operativni ugao gledanja hotela/prevoznika).

Oba načina koriste identičnu logiku grupisanja po dobavljaču kao ad-hoc priprema po jednoj rezervaciji — ako izabrane rezervacije (ili opseg) sadrže stavke od N različitih dobavljača, nastaje N odvojenih DRAFT nacrta. Ako isti dobavljač ima stavke iz više različitih `ContractPeriod` (npr. dva različita termina), `contract_period_id` na nastalom nacrtu ostaje `null` (isto pravilo kao poglavlje 8.1 — "nullable ako lista objedinjuje više perioda").

**Namerno van obima ove dopune — prirodno-jezički AI interfejs.** Vlasnik je u diskusiji pomenuo mogućnost da se ovo zatraži prirodnim jezikom ("AI agente, grupiši rezervacije od...do i pošalji nenajavljene"). Osnovna sposobnost (grupisanje po dobavljaču, obim po listi/opsegu) je upravo ono što ova dopuna uvodi — dostupna je i AI agentu kao i svakom drugom pozivaocu za PRIPREMU nacrta (nivo **"Autonomno"**, nepromenjeno). Ono što se **ne uvodi**, ni ovde ni bilo gde u M5: mogućnost da AI agent (ili bilo šta osim eksplicitnog ljudskog klika) izvrši `POST /supplier-manifests/:id/send` — to ostaje **"Predloži pa čovek odobri"**, nepromenjeno iz izvornog teksta poglavlja 8.4, bez obzira ko/šta je pripremu pokrenuo. Sâm prirodno-jezički interfejs ka agentu (parsiranje slobodnog teksta u ovaj poziv) je van obima M5 dok se ne specifikuje M15 sloj za ovaj modul (isto obrazloženje kao poglavlje 3.0.4).

### 8.5 Izmene posle slanja
Ako se stavka koja je već na poslatoj listi (`status = SENT`) izmeni ili otkaže (poglavlje 6):
1. Postojeća lista se označava kao `SUPERSEDED`.
2. Priprema se nova `DRAFT` sa `supersedes_manifest_id` ka prethodnoj, sa trenutno važećim stavkama.
3. Nova lista se ne šalje automatski — isti princip kao 8.4: čovek pregleda i šalje reviziju.

### 8.6 "Najava" kao formalni koncept (dopuna, avgust 2026 — rešava problem #2 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, vidi `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md` poglavlje 2)

Do sada je "da li je dobavljač najavljen/potvrdio" postojalo samo posredno — preko `item_status = PENDING_SUPPLIER_CONFIRMATION` (koje prati potvrdu dostupnosti pri rezervaciji, poglavlje 4) i posredno preko `SupplierManifest.status = SENT` (koje prati da li je operativna lista poslata, poglavlje 8.1). Ovo su dva različita koraka istog toka koja se dosad nisu eksplicitno pratila na nivou pojedinačne stavke: **(a)** dostupnost potvrđena od dobavljača pri samoj rezervaciji, **(b)** dobavljač formalno obavešten *ko* dolazi (najava/rooming lista).

**Pravilo:** `BookingItem.announced_at` (poglavlje 4.2) formalizuje korak (b):
- Za `CONTRACTED` stavke: popunjava se automatski čim stavka uđe u `SupplierManifest` koji pređe u `status = SENT` (kopira se `SupplierManifest.sent_at`). Ako lista kasnije postane `SUPERSEDED` i stavka se pojavi na novoj poslatoj listi (poglavlje 8.5), `announced_at` se ažurira na vreme slanja te nove liste.
- Za `API` stavke: popunjava se automatski u trenutku kad `item_status` pređe u `CONFIRMED` (poglavlje 4, korak 2) — najava je već sadržana u samom API pozivu ka dobavljaču (isto obrazloženje kao uvod poglavlja 8, "poseban operativni dokument nije potreban").

`BookingItem.supplier_confirmed_at`/`supplier_confirmed_by` prati korak potvrde od strane dobavljača da je najava primljena:
- Za `CONTRACTED` stavke: ručni unos — dobavljači tipično nemaju API, potvrda stiže mejlom/telefonom, zaposleni je unosi u M17 panelu (dugme "Označi kao potvrđeno od dobavljača" na stavci ili na celoj poslatoj listi odjednom, popunjava sve stavke te liste).
- Za `API` stavke: popunjava se automatski, isti trenutak kao `announced_at` (M4 `BookingConfirmation` već predstavlja i najavu i potvrdu dobavljača u jednom koraku).

Alarmi za oba koraka (nenajavljena stavka pred boravak, najava bez potvrde) definisani su u poglavlju 6.1.

### 8.7 Konfigurabilno automatsko pripremanje najave po dobavljaču (dopuna, avgust 2026 — rešava problem #3, vidi GAP-analiza poglavlje 3)

Poglavlje 8.4 danas priprema `DRAFT` nacrt po fiksnom pravilu (N dana pre `stay_from`, isto za sve dobavljače) i uvek zahteva ljudski klik za slanje. Vlasnik traži da trenutak *pripreme* nacrta bude podesiv po dobavljaču (npr. tek posle naplaćene akontacije za jednog dobavljača, odmah po potvrdi za drugog) — **slanje i dalje ostaje isključivo ljudska radnja, ovo se ne menja** (potvrđeno sa vlasnikom — vidi diskusiju pri specifikaciji ovog poglavlja); menja se samo kada je nacrt spreman i istaknut za odobrenje, ne ko ga šalje.

#### `SupplierAnnouncementRule`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID, nullable (FK → M3 Supplier) | `NULL` = podrazumevano pravilo, važi za dobavljače bez sopstvenog pravila |
| trigger_condition | enum: `DAYS_BEFORE_STAY`, `ON_CONFIRMATION`, `AFTER_DEPOSIT_PAID`, `AFTER_FULL_PAYMENT` | `DAYS_BEFORE_STAY` — postojeće ponašanje iz 8.4 (koristi `days_before_stay`); `ON_CONFIRMATION` — čim `item_status = CONFIRMED`, nezavisno od uplate; `AFTER_DEPOSIT_PAID` — čim `Booking.payment_status` pređe u `PARTIALLY_PAID` ili `PAID`; `AFTER_FULL_PAYMENT` — tek kad `payment_status = PAID` |
| days_before_stay | integer, nullable | koristi se samo kad `trigger_condition = DAYS_BEFORE_STAY` |
| created_by / created_at / updated_by / updated_at | UUID / timestamp | isti obrazac kao `MarkupRule` (poglavlje 2.1) |

**Razrešavanje pravila:** najspecifičnije pobeđuje — isti princip kao `MarkupRule` (poglavlje 2.2). Ako za `Supplier` postoji sopstveni `SupplierAnnouncementRule`, koristi se on; inače se koristi podrazumevano pravilo (`supplier_id IS NULL`). Ako podrazumevano pravilo ne postoji, važi `trigger_condition = DAYS_BEFORE_STAY` sa vrednošću iz poglavlja 6.1 (7 dana) kao ugrađeni fallback — nema regresije za dobavljače koji danas nemaju posebno pravilo.

**Tok:** periodičan posao (poglavlje 8.4) za svaku `CONTRACTED` stavku sa `item_status = CONFIRMED` i praznim `announced_at` proverava da li je uslov iz važećeg `SupplierAnnouncementRule` ispunjen. Kad jeste, nacrt (`SupplierManifest.status = DRAFT`) se priprema odmah (ako već ne postoji za taj period/dobavljača) i **ističe se kao prioritetan** u M17 Agent Inbox — vidljivo odvojeno od običnih nacrta pripremljenih rutinski. Ovo ostaje nivo **"Autonomno"** za pripremu (čisto informativno, isto obrazloženje kao postojeći 8.4), a slanje ostaje **"Predloži pa čovek odobri"** — nepromenjeno.

**Dozvole:** `M5/supplier-announcement-rule/VIEW`, `EDIT` — Vlasnik, Direktor (isti krug kao `markup-rule`, poglavlje 10 — pravila koja utiču na odnos sa dobavljačem su osetljiva).

### 8.8 Jedinstveno sanduče za dobavljače i automatsko poklapanje potvrde (dopuna, avgust 2026 — rešava problem #11 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, vidi `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md` poglavlje 11)

Do sada je potvrda dobavljača (`supplier_confirmed_at`/`by`, poglavlje 8.6) bila isključivo ručan unos zaposlenog, bez veze sa stvarnom mejl porukom koja je stigla — i slanje najave je išlo sa ličnog naloga zaposlenog koji klikne "pošalji". Vlasnik je opisao stvaran problem iz prakse: kad svaki zaposleni šalje sa svog ličnog mejla, potvrda dobavljača stiže na taj isti lični mejl, i nema jednog mesta gde tim vidi ceo tok "najavljeno → potvrđeno" niti lako uočava šta nije potvrđeno. Potvrđeno sa vlasnikom (avgust 2026): jedna zajednička adresa za sve dobavljače (ne po timu/regionu), koja pokriva **i slanje i prijem**; potvrda dobavljača i dalje **uvek** zahteva klik zaposlenog, čak i kad AI prepozna poklapanje sa visokom pouzdanošću — ovo pravilo se ne menja ovom dopunom, samo se ubrzava i pojednostavljuje.

**Jedinstveno sanduče:** postoji tačno jedan M22 `Mailbox` (poglavlje 2.1 te specifikacije, `mailbox_type = SHARED`) kroz koji ide **svaka** komunikacija ka dobavljačima vezana za konkretnu rezervaciju — nova najava (`SupplierManifest`, poglavlje 8.1), izmena, i storno (`SupplierChangeNotice`, niže). Ovo sanduče je sistemska konfiguracija (jedan red, ne po dobavljaču/timu) — koji tačno korisnici imaju `REPLY` pristup određuje se kroz postojeći M22 `MailboxAccess` mehanizam (poglavlje 2.2 M22), ne ovde.

**Referentni kod:** svaki `SupplierManifest` i svaki `SupplierChangeNotice` (niže) dobija `reference_code` pri kreiranju nacrta — format `TT-NNNNNN` (šestocifren, sekvencijalan, jedinstven kroz oba tipa). Pri slanju, kod se upisuje na početak naslova mejla u fiksnom obliku `[REF: TT-NNNNNN] ...` — kratak, bez specijalnih znakova, da preživi i kad dobavljač odgovori kroz "Reply" (thread se čuva) i kad pokrene nov mejl ručno prekucavajući naslov.

#### `SupplierChangeNotice` — najava izmene ili storna (novo, avgust 2026)

Za razliku od nove rezervacije (pokriva je `SupplierManifest`), izmena i storno pojedinačne stavke ne čekaju sledeću rutinsku listu — dobavljač mora **eksplicitno** biti obavešten, ne da sam zaključi iz toga što je gost nestao sa naredne revidirane liste (poglavlje 8.5). Ovo je i direktna pouka iz problema #10 (poglavlje 6.4) — nejasna/prećutna komunikacija ka dobavljaču pri stornu je tačno ono što je izazvalo pravi incident iz prakse.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_item_id | UUID (FK → BookingItem) | |
| notice_type | enum: `MODIFICATION`, `CANCELLATION` | |
| reference_code | string, unique | isti format/svrha kao `SupplierManifest.reference_code` iznad |
| status | enum: `DRAFT`, `SENT` | isti princip kao `SupplierManifest.status`, bez `SUPERSEDED` — jedna izmena/storno je jedna poruka |
| sent_at / sent_by | timestamp / UUID, nullable | `sent_by` mora biti stvaran korisnik — isto pravilo kao poglavlje 8.4, slanje nikad autonomno |
| supplier_confirmed_at / supplier_confirmed_by | timestamp / UUID, nullable | popunjava se **isključivo** ljudskim klikom (vidi niže), nikad automatski, bez obzira na pouzdanost prepoznavanja |
| confirmation_email_thread_id | UUID, nullable (FK → M22 `EmailThread`) | |
| created_at | timestamp | |

Priprema `DRAFT` je nivo **"Autonomno"** (čisto informativna priprema teksta, ista logika kao poglavlje 8.4) — okidač je promena `item_status` na `MODIFIED`/`CANCELLED` (poglavlje 6). Slanje ostaje **"Predloži pa čovek odobri"**.

**Automatsko poklapanje potvrde (AI agent, M22):** kad u jedinstveno sanduče stigne `INBOUND` poruka, M22 (poglavlje 3.1a te specifikacije) traži `[REF: TT-NNNNNN]` obrazac u naslovu/telu i, ako pronađe poklapanje sa postojećim `SupplierManifest.reference_code`/`SupplierChangeNotice.reference_code`, **predlaže** vezu (popunjava `confirmation_email_thread_id` kao predlog, ne konačno). Ako referenca nije pronađena (dobavljač pokrenuo nov mejl bez nje), pada na fuzzy-match po imenu dobavljača/gosta/datumima (isti obrazac kao poglavlje 6.4 i M10 poglavlje 8.6.3) kao slabiji predlog. **U oba slučaja**, konačno postavljanje `supplier_confirmed_at`/`by` zahteva eksplicitan klik zaposlenog na predloženu vezu (dugme "Potvrdi kao potvrdu dobavljača" u M17, uz vidljiv izvor: dokument je pronašao referencu tačno, ili je predlog samo po sličnosti) — nivo **"Predloži pa čovek odobri"**, potvrđeno sa vlasnikom da se ovo ne menja ni pri visokoj pouzdanosti.

---

## 9. Događaji (Event Bus) koje M5 emituje

`booking.confirmed`, `booking.pending_supplier_confirmation`, `booking.modified`, `booking.cancelled` — buduci moduli (M6 istorija gosta i post-trip anketa, M10 fakturisanje, M11 CIS registracija garancije putovanja poglavlje 2.3, M12 marketing, M20 generisanje/revizija ugovora sa klijentom) se pretplaćuju na ove događaje kad dođu na red; M5 ih ne poziva direktno (princip #2, poglavlje 3).

---

## 10. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M5/itinerary/CREATE`, `VIEW`, `EDIT` | Vlasnik, Direktor, Sales Manager, Prodajni agent; Gost (samo sopstveni, preko sajta) |
| `M5/quote/CREATE`, `VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent; Gost (samo sopstvene, preko sajta) |
| `M5/booking/CREATE` (potvrda) | Vlasnik, Direktor, Sales Manager, Prodajni agent; Gost (samostalna rezervacija na sajtu) |
| `M5/booking/VIEW` | Vlasnik, Direktor, Sales Manager (sve); Prodajni agent (podrazumevano samo sopstveni klijenti — širi se pojedinačnim izuzetkom iz M1 ako treba); Gost (samo sopstvene) — **koristi i kalendar rezervacija, poglavlje 7.3** |
| `M5/booking/MODIFY`, `CANCEL` | Vlasnik, Direktor, Sales Manager, Prodajni agent (sopstveni klijenti); Gost (sopstvena rezervacija, u skladu sa pravilima otkazivanja) |
| `M5/markup-rule/VIEW`, `EDIT` | Vlasnik, Direktor — cenovna politika je osetljiva, ne deli se šire podrazumevano |
| `M5/supplier-announcement-rule/VIEW`, `EDIT` | Vlasnik, Direktor — vidi poglavlje 8.7 |
| `M5/voucher/OVERRIDE_ISSUE` (izdavanje bez pune uplate) | Vlasnik, Direktor — **nikad AI agent, nikad Sales Manager/Prodajni agent**, u skladu sa poglavljem 6 (finansijski rizik) |
| `M5/supplier-manifest/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M5/supplier-manifest/CREATE` (nacrt) | Vlasnik, Direktor, Sales Manager, Prodajni agent; i AI agent zadužen za M5 (poglavlje 8.4) |
| `M5/supplier-manifest/SEND` | Vlasnik, Direktor, Sales Manager — **nikad AI agent**, u skladu sa poglavljem 8.4 |
| `M5/supplier-change-notice/CREATE`, `SEND` | Isti krug kao `supplier-manifest/CREATE`/`SEND` (poglavlje 8.8) — **slanje nikad AI agent** |
| `M5/supplier-confirmation/CONFIRM` (ljudski klik na predloženu vezu sa mejlom, poglavlje 8.8) | Vlasnik, Direktor, Sales Manager, Prodajni agent — **nikad AI agent**, isti krug kao `supplier-manifest/VIEW` |

---

## 11. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/sales`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/itineraries` | GET / POST | lista / kreiranje novog sastavljanja putovanja (poglavlje 3.0.1) |
| `/itineraries/:id` | GET / PATCH | pregled / izmena (dodavanje, brisanje, preslagivanje segmenata, poglavlje 3.0.2) |
| `/itineraries/:id/to-quote` | POST | konverzija u Ponudu (poglavlje 3.0.3), vraća kreiranu `Quote` |
| `/search` | GET | objedinjena pretraga (M2 katalog + M3 dostupnost + M4 uživo), vraća niz `SearchResultProduct` sa ugnježdenim `offers[]` (`SearchResultOffer`), sa već primenjenom maržom — struktura odgovora definisana u poglavlju 3.0b. Parametri (dopuna avgust 2026, rešava nalaz iz `VALIDACIJA-WORKFLOV-B2C.md`, dopunjeno avgust 2026 za multi-select i nova tri M2 tipa): `type` (**niz** enum vrednosti, isti skup kao M2 `Product.type` — dopunjeno `TRANSPORT`/`TICKET`/`EVENT`, M2 poglavlje 2.1 — opciono, bez njega pretražuju se svi tipovi; sa više vrednosti rezultat je unija svih traženih tipova, isti princip kao filter po više vrednosti bilo gde drugde u sistemu), `destination_country`/`destination_city` (opciono), `stay_from`/`stay_to` (obavezno za `ACCOMMODATION`/`TRANSFER`/`EXCURSION`/`PACKAGE`/`TRANSPORT`; za `TICKET`/`EVENT` opciono i menja značenje — filtrira da li proizvod pada u traženi period, ne proverava dostupnost kao kod smeštaja; neprimenjivo za samostalnu `INSURANCE`), `occupancy` (JSON, `{adults, children, room_config}`, isti oblik i pravilo slaganja kao `QuoteItem.occupancy` — poglavlje 3.2a — `room_config` primenjivo samo na `ACCOMMODATION`/`PACKAGE` sa smeštajem, `adults`/`children` čita se kao broj putnika/mesta i za `TRANSPORT`/`TICKET`/`EVENT` gde je primenjivo, obavezno kad `type` podrazumeva smeštaj), `channel` (obavezno — filtrira po `Product.visible_channels`, isti enum kao poglavlje 3.1). Kad `type` sadrži `PACKAGE`, pretraga za tu stavku vraća gotove pakete iz M2 (`source_type = CONTRACTED` ili `API` sa `Product.type = PACKAGE`) — za custom višedestinacijsko sastavljanje van gotovog paketa koristi se `Itinerary` tok (poglavlje 3.0), ne ovaj endpoint direktno. |
| `/quotes` | POST | kreira ponudu od izabranih proizvoda/datuma/gostiju |
| `/quotes/:id` | GET | pregled ponude, uključujući da li je istekla |
| `/quotes/:id/confirm` | POST | pokreće tok iz poglavlja 4, vraća kreiranu `Booking` ili grešku po stavci |
| `/bookings` | GET | lista, filtrirano po statusu/kanalu/klijentu (prava pristupa iz poglavlja 10) |
| `/bookings/:id` | GET | detalji rezervacije |
| `/bookings/:id/modify` | POST | izmena datuma/gostiju |
| `/bookings/:id/cancel` | POST | otkazivanje (celo ili po stavci); ako provera duplikata (poglavlje 6.4) pronađe konflikt, vraća upozorenje sa detaljima konfliktne stavke umesto da izvrši storno — poziv se ponavlja sa `confirm_duplicate_override: true` da bi se otkazivanje ipak izvršilo |
| `/bookings/:id/payment-status` | PATCH | poziva isključivo M10; ako novi status prelazi u `PAID`, automatski proverava i pokreće generisanje vaučera (poglavlje 6) |
| `/bookings/:id/voucher/override` | POST | zahteva `M5/voucher/OVERRIDE_ISSUE`; generiše vaučer bez obzira na `payment_status`, popunjava `voucher_override_*` polja (poglavlje 4.1/6) |
| `/bookings/:id/prepare-supplier-manifests` | POST | dopuna v1.15, zahteva `M5/supplier-manifest/CREATE`; ad-hoc priprema DRAFT `SupplierManifest` za SVE dobavljače ove rezervacije odjednom (poglavlje 8.4), po jedan nacrt po dobavljaču ako ih ima više — vraća niz kreiranih nacrta |
| `/supplier-manifests/prepare-batch` | POST | dopuna v1.16, zahteva `M5/supplier-manifest/CREATE`; isto kao gore, ali obim je `booking_ids[]` (checkbox izbor, isključivo) ILI kombinacija filtera — `created_from`/`created_to`, `stay_from`/`stay_to`, `arrival_from`/`arrival_to`, `departure_from`/`departure_to`, `booking_status[]` — bar jedan filter mora biti prisutan kad `booking_ids[]` nije poslat (poglavlje 8.4) |
| `/markup-rules` | GET / POST / PATCH | upravljanje pravilima marže |
| `/bookings/calendar-summary` | GET | `?from=&to=` (npr. opseg meseca) — vraća niz `{date, arrivals_count, departures_count, stayovers_count, single_day_count}` po danu, za brzo iscrtavanje meseca bez učitavanja pojedinačnih stavki (poglavlje 7.2) |
| `/bookings/calendar/:date` | GET | pun spisak `BookingItem` razvrstan u dolazi/odlazi/u toku/jednodnevno za taj dan (poglavlje 7.1), sa istim pravima pristupa kao `/bookings` |
| `/supplier-manifests` | GET / POST | lista postojećih / generisanje nacrta (agregacija potvrđenih stavki po dobavljaču + periodu, poglavlje 8.4; `POST` prima i `language`, poglavlje 8.3) |
| `/supplier-manifests/:id` | GET | detalji, uključujući stavke i lanac revizija (`supersedes_manifest_id`) |
| `/supplier-manifests/:id/send` | POST | zahteva `M5/supplier-manifest/SEND`; menja status u `SENT`, šalje dokument na `sent_to_email`, popunjava `sent_at`/`sent_by`, i (poglavlje 8.6) popunjava `announced_at` na svakoj obuhvaćenoj `BookingItem` |
| `/supplier-manifests/:id/confirm-supplier` | POST | zahteva `M5/supplier-manifest/SEND`; ručni unos potvrde dobavljača (poglavlje 8.6) — popunjava `supplier_confirmed_at`/`supplier_confirmed_by` na svim `BookingItem` sa te liste |
| `/supplier-announcement-rules` | GET / POST / PATCH | upravljanje pravilima iz poglavlja 8.7, zahteva `M5/supplier-announcement-rule/VIEW` ili `EDIT` |

---

## 12. Izlazni kriterijum (Faza 1 — izlazni kriterijum cele faze, poglavlje 8)

- [ ] Tim može kroz interni panel da pretraži, dobije ponudu i potvrdi rezervaciju hotela — i iz M3 (ugovoreno) i preko M4 (Travelgate).
- [ ] Marža se ispravno primenjuje po hijerarhiji iz poglavlja 2, sa dokazivim izračunom (ista ulazna cena uvek daje istu izlaznu cenu).
- [ ] Rezervacija sa više stavki gde jedna stavka ne uspe ne ostavlja "napola" rezervaciju — sve već rezervisane stavke se oslobađaju.
- [ ] Rezervacija može biti `CONFIRMED` sa `payment_status = UNPAID` ili `INVOICE_PENDING`, bez greške.
- [ ] Vaučer se ne generiše automatski dok `payment_status != PAID`; prelazak u `PAID` (i pre i posle potvrde) automatski generiše vaučer bez ručne akcije.
- [ ] `POST /bookings/:id/voucher/override` ispravno generiše vaučer bez pune uplate samo za Vlasnika/Direktora, upisuje `voucher_override_*` polja i vidljiv je u audit logu; ista radnja je odbijena za sve ostale uloge i za AI agenta.
- [ ] Otkazivanje ispravno računa procenat povraćaja iz `CancellationRule` i oslobađa kapacitet nazad u M3.
- [ ] Svaka promena statusa rezervacije vidljiva je u M1 audit logu.
- [ ] Klikom na datum u kalendaru tim vidi stavke tog dana ispravno razvrstane u dolazi/odlazi/u toku/jednodnevno (poglavlje 7.1), bez duplog brojanja i bez otkazanih stavki.
- [ ] Mesečni pregled kalendara prikazuje tačne brojeve po danu bez učitavanja pune liste stavki (poglavlje 7.2).
- [ ] Nijedno novčano polje (`base_cost`, `final_price`, `total_price`, `fixed_amount`) nije tipa `decimal`/float — provereno da su sva `integer` u najmanjoj jedinici valute (poglavlje 2).
- [ ] Moguće je generisati nacrt operativne liste za dobavljača agregacijom potvrđenih `CONTRACTED` stavki po `ContractPeriod`, i ručno je poslati — poslata lista dobija status `SENT` sa zapisom ko je poslao i kada.
- [ ] Test (dopuna v1.15): `POST /bookings/:id/prepare-supplier-manifests` za rezervaciju sa `CONTRACTED` stavkama od DVA različita dobavljača pravi TAČNO dva DRAFT nacrta, svaki sadrži isključivo stavke svog dobavljača — nijedan zajednički nacrt koji meša dobavljače.
- [ ] Test (dopuna v1.16): `POST /supplier-manifests/prepare-batch` odbija poziv bez `booking_ids[]` i bez ijednog filtera; sa `booking_ids[]` prosleđenim ignoriše ostale filtere (uzima stavke SAMO iz tih rezervacija); svaki od `created_from`/`created_to`, `stay_from`/`stay_to`, `arrival_from`/`arrival_to`, `departure_from`/`departure_to`, `booking_status[]` filtrira po ispravnom polju (`Booking.created_at`, preklapanje `stay_from`/`stay_to`, `stay_from` unutar opsega, `stay_to` unutar opsega, `Booking.status`); dva ili više filtera prosleđena istovremeno se kombinuju logičkim I, ne OR. U svim slučajevima rezultat je grupisan po dobavljaču, isto kao pojedinačna priprema (v1.15).
- [ ] Izmena ili otkazivanje stavke koja je već na poslatoj listi automatski priprema revidiran nacrt (`SUPERSEDED` + novi `DRAFT`), nikad tiho ne menja već poslat dokument.
- [ ] Cena (nabavna, prodajna, marža) se nikad ne pojavljuje u dokumentu poslatom dobavljaču.
- [ ] Operativna lista se može generisati na srpskom ili engleskom, i izabrani jezik ostaje nepromenjen na već poslatoj listi i njenim revizijama.
- [ ] Rezervacija sa izdatim vaučerom bez pune uplate (izuzetak, poglavlje 6) generiše dnevni podsetnik timu dok se ne naplati do kraja ili ne otkaže (poglavlje 6.1).
- [ ] Stavka rezervacije u statusu `PENDING_SUPPLIER_CONFIRMATION` duže od praga generiše upozorenje nezavisno po dobavljaču — rezervacija sa stavkama od dva dobavljača ispravno prijavljuje samo onu stavku čiji dobavljač kasni (poglavlje 6.1).
- [ ] Rezervacija sa `payment_status = PAID` a bez generisanog vaučera odmah generiše vidljivo upozorenje (poglavlje 6.1).
- [ ] Test: vaučer i odgovor `/bookings/:id` preko M7/M8/M9-gost konteksta ne sadrže `BookingItem.supplier_reference` niti bilo šta iz M3 `Supplier`/`Contract` (poglavlje 6.2); isti poziv preko M17 (interni kontekst) ta polja ispravno vraća.
- [ ] `Booking.tip_nastupanja` se ispravno automatski izvodi iz `default_tip_nastupanja` (M3/M4) za `B2C_SITE`/`B2B_PORTAL`/`MOBILE` kanale; ponuda sa nesaglasnim kandidatima se odbija sa jasnom porukom umesto da tiho izabere jednu vrednost (poglavlje 4.0a).
- [x] Provera garancije putovanja (M11) se uvek izvršava pre provere kreditnog limita (M7), nikad obrnuto (poglavlje 4, korak 1) — M11 implementiran avgust 2026 (in-process poziv `ComplianceStubsService` → `TravelGuaranteeService`), testirano jedinično da se `checkTravelGuaranteeUtilization` poziva samo za `ORGANIZATOR` i pre `checkCreditLimitIfSubagent`; M7 kreditni limit deo ostaje stub dok M7 ne dođe na red (Faza 4).
- [ ] `Quote.contract_terms_accepted` mora biti `true` pre nego što se dozvoli prelazak na plaćanje za samouslužne kanale; `Booking` kreiran bez ovog uslova (za te kanale) se ne dozvoljava.
- [ ] Subagent sa `status = ACTIVE` i rezervacijom unutar kreditnog limita dobija vaučer automatski čim `Booking.status = CONFIRMED`, bez obzira na `payment_status`, bez ručnog override-a (poglavlje 6.3); rezervacija koja prekorači limit i dalje zahteva ručni override.
- [ ] `GET /search` ispravno filtrira po `type` (nizu vrednosti — test: dva tipa istovremeno vraćaju uniju rezultata, ne presek), `destination_country`/`destination_city`, `stay_from`/`stay_to`, `occupancy`, `channel`; `type` koji sadrži `PACKAGE` vraća gotove pakete iz M2 za tu stavku.
- [ ] `GET /search` ispravno vraća `TRANSPORT`/`TICKET`/`EVENT` proizvode kad su traženi, sa atributima iz M2 poglavlja 2.3.
- [ ] `occupancy.room_config` sa više soba (npr. 2 sobe, različit broj gostiju po sobi) se ispravno čuva i čita kao niz; zbir po sobama koji se ne slaže sa `occupancy.adults`/`children` se odbija pri kreiranju `Quote`.
- [ ] Test: beba čiji uzrast (iz `children_ages[]`) pada u M2 `age_policy[]` kategoriju sa `counts_toward_capacity = false` ne izaziva odbijanje `Quote` zbog kapaciteta, dok drugo dete/gost koji prelazi kategoriju sa `counts_toward_capacity = true` iznad `capacity_children` biva odbijen (M2 poglavlje 2.3b).
- [ ] Test: `base_cost` sobe sa 2 odrasla + 1 dete se ispravno računa za `RateLine` sa `price_basis = PER_ROOM_PER_NIGHT` i posebno za `price_basis = PER_PERSON_PER_NIGHT`, oba sa istim ulaznim gostima ali različitim očekivanim zbirom (poglavlje 3.2b).
- [ ] Test: gost čija kategorija nema odgovarajući `M3 age_pricing[]` red odbija kreiranje `Quote` sa jasnom porukom, ne pretpostavlja cenu (poglavlje 3.2b).
- [ ] Moguće je sastaviti `Itinerary` sa više segmenata u više destinacija, promeniti im redosled, i konvertovati ga u `Quote` — svaki segment sa popunjenim `product_id` postaje `QuoteItem` sa ispravno primenjenom cenom/maržom (poglavlje 3.0.3).
- [ ] Segment bez popunjenog `product_id` se ne konvertuje tiho — korisnik dobija jasno upozorenje pre konverzije koji segmenti su preskočeni.
- [ ] `Quote.itinerary_id` ispravno referencira izvorni `Itinerary` kad Ponuda nastane konverzijom, i ostaje `null` za direktne ponude.
- [ ] `SupplierManifest` i `SupplierChangeNotice` dobijaju jedinstven `reference_code` pri kreiranju nacrta; slanje ide isključivo kroz jedinstveno M22 sanduče (poglavlje 8.8), sa `[REF: TT-NNNNNN]` u naslovu.
- [ ] Test: `item_status` prelazi u `MODIFIED`/`CANCELLED` ispravno pokreće pripremu `SupplierChangeNotice` nacrta (poglavlje 8.8), odvojeno od revizije `SupplierManifest` (poglavlje 8.5).
- [ ] Test: dolazna poruka u jedinstveno sanduče sa tačnim `[REF: TT-NNNNNN]` u naslovu se predlaže kao poklapanje sa odgovarajućim `SupplierManifest`/`SupplierChangeNotice`, ali `supplier_confirmed_at`/`by` ostaje prazno dok zaposleni eksplicitno ne klikne potvrdu — provereno da AI agent nema pristup akciji koja to polje popunjava.
- [ ] Test: dolazna poruka bez prepoznate reference pada na fuzzy-match predlog (ime dobavljača/gosta/datumi), i dalje samo kao predlog, nikad automatski upis.
- [ ] `GET /search` vraća `SearchResultProduct[]` sa ugnježdenim `offers[]` (poglavlje 3.0b); `CONTRACTED` ponuda sa `total_capacity - units_sold` manje od traženog broja soba se ne pojavljuje u rezultatima; `ON_REQUEST` period se pojavljuje sa `availability_status = ON_REQUEST`, ne kao potvrđeno dostupan.
- [ ] Test: `API`-sourced ponuda sa `availableUnits = 0` (M4) se ne pojavljuje u rezultatima; ponuda sa `availableUnits > 0` nosi ispravan `quote_expires_at` iz `M4 AvailabilityQuote`.
- [ ] Test: `POST /quotes` za `API`-sourced stavku sa već isteklim `quote_expires_at` (iz izabranog `SearchResultOffer`) se odbija sa jasnom porukom, bez kreiranja `QuoteItem`; ista stavka sa `quote_expires_at` koji još nije prošao se prihvata i cena se ponovo pribavlja od M4 pre upisa (poglavlje 3.0b.3, korak 5).
- [ ] Test: izbor `SearchResultOffer` (i za `CONTRACTED` i za `API`) ispravno popunjava `product_id`/`rate_line_id` ili `provider_quote_reference`/`stay_from`/`stay_to`/`occupancy` u `POST /quotes` bez ručnog ponovnog unosa; isto važi za popunu `ItinerarySegment.product_id` kroz tok sastavljanja putovanja (poglavlje 3.0).
- [ ] `Quote.referral_tracking_code` (kad popunjeno) se ispravno kopira na `Booking.referral_tracking_code` pri potvrdi; M5 ga ni u jednom trenutku ne validira niti odbija rezervaciju zbog nepostojećeg/pogrešnog koda (M12 poglavlje 3a).

---

## 13. Otvoreno za dalje

- ~~Tačan prag/format za avans (deo unapred, ostatak kasnije).~~ **Rešeno u M10 specifikaciji** (poglavlje 5.4, avgust 2026): globalna agencijska politika (`PaymentTermsConfig`) određuje procenat akontacije i rokove; M10 `ClientPaymentSchedule` prati ispunjenje po rezervaciji.
- ~~Da li B2B kreditni limit (M7) treba da blokira potvrdu rezervacije kad se pređe limit.~~ **Rešeno u M7 specifikaciji**: da — kad `Quote.client_account_id` pripada Subagentu, M5 proverava kreditni limit **pre** pokretanja toka potvrde (pre bilo kog poziva ka M3/M4); prekoračenje odbija potvrdu bez rezervisanja kapaciteta. Isto tako, cena za subagenta koristi proviziju (M7) umesto popusta lojalnosti (M6) kao poslednji korak u tok cene.
- Format vaučera (sadržaj, izgled) — definiše se kad se dođe do stvarne izrade, van obima ove specifikacije.
- Tačan izgled/template operativne liste po tipu dobavljača (poglavlje 8.3) — isto obrazloženje kao za vaučer, van obima ove specifikacije.
- Da li slanje operativne liste ide isključivo email prilogom (PDF) ili se razmatra i strukturisan API kanal ka većim hotelskim lancima/prevoznicima — otvoreno dok ne postoji konkretan zahtev dobavljača za tim.
- Da li `API` (M4) stavke ikad zahtevaju sličan operativni dokument (npr. provajder ne prosleđuje kompletne podatke dalje ka stvarnom dobavljaču) — trenutna pretpostavka (poglavlje 8) je da API konekcija sama nosi te podatke, revidira se ako se u praksi pokaže suprotno.
- Tačan izgled kalendara (mesečni grid vs. nedeljni vs. lista) i vizuelno razlikovanje kategorija (npr. boje/ikone slično standardnoj PMS praksi — zelena strelica za dolazak, crvena za odlazak) — dizajnersko pitanje van obima ove specifikacije.
- Vizuelni prikaz/UI za sastavljanje putovanja (poglavlje 3.0.4) — dizajnersko pitanje van obima.
- AI predlozi za popunu praznina u itineraru (poglavlje 3.0.4) — otvoreno dok M15 ne dođe na red za M5.
- Da li `Itinerary` treba i sopstveni rok isteka (`ABANDONED` po vremenu neaktivnosti, slično `Quote.expires_at`) ili ostaje bez roka dok ga korisnik ne konvertuje ili ručno ne napusti — otvoreno, nije kritično jer `Itinerary` ne drži kapacitet niti cenu.
- **Tačna semantika `stay_from`/`stay_to`/`occupancy` za `TRANSPORT`/`TICKET`/`EVENT`** (poglavlje 11, dopuna avgust 2026) — ovaj dokument definiše opšte pravilo (period/broj putnika, ne provera dostupnosti kao kod smeštaja za `TICKET`/`EVENT`), ali tačno ponašanje po pod-tipu (npr. da li `TRANSPORT` sa `transport_mode = RENT_A_CAR` treba dodatni parametar za lokaciju preuzimanja vozila) razrađuje se kad M4/M5 stvarno počnu da rade sa tim tipovima, ne unapred.
- **Novo (avgust 2026) — prag za ponovnu proveru `API` cene pri `POST /quotes`** (poglavlje 3.0b.3, korak 5). Trenutno pravilo je najstrože moguće (uvek ponovo pitati M4, bez obzira koliko je vremena prošlo od pretrage) — ostavljeno namerno konzervativno dok se ne vidi u praksi da li broj/cena poziva ka M4 (Travelgate) to opravdava. Ako se pokaže preskupo, uvodi se prag (npr. "ne proveravaj ponovo ako je manje od N sekundi prošlo od pretrage") — zahteva potvrdu vlasnika pre uvođenja, jer svaki takav prag nosi rizik prikazivanja cene koja više nije tačna.
- **Novo (avgust 2026, na zahtev vlasnika) — automatski podsetnik gostu o roku za potvrdu/uplatu opcije kod dobavljača.** Kad dobavljač drži stavku rezervacije "na opciju" (`item_status = PENDING_SUPPLIER_CONFIRMATION`, poglavlje 4) sa konkretnim rokom posle kog dobavljač sam automatski otkazuje ako agencija do tada ne izda vaučer/ne potvrdi, sistem treba automatski da pošalje **gostu** (ne samo internom timu kao u poglavlju 6.1) podsetnik pre tog roka — analogno automatskim email obaveštenjima koje sami dobavljači šalju agenciji (primer iz prakse: "Reservations pending confirmation" — hotel, check-in/check-out datum, referenca dobavljača, ime nosioca rezervacije, tačan rok otkazivanja, veb-referenca). Ovo je nov zahtev, van postojećeg obima 6.1, i pre implementacije zahteva dalju razradu i potvrdu vlasnika oko: (a) novog polja za rok opcije na `BookingItem` — ovaj rok je rok **koji je dao dobavljač**, različit je od praga 48h iz poglavlja 6.1 (koji je interni prag za upozorenje tima, ne stvarni rok posle kog dobavljač otkazuje); (b) kanala/mehanizma slanja transakcionih (ne-marketinških) email obaveštenja gostu — ni ova specifikacija ni M6 (poglavlje 4.1, koji pokriva samo marketinške/informativne poruke uz `marketing_consent`) trenutno ne definišu takav kanal, pa ovo verovatno zahteva dopunu i M5 i M6; (c) tačnog praga koliko pre roka se podsetnik šalje i da li se ponavlja. Vidi i `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md` Dodatak B.
