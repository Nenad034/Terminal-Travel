# Specifikacija modula M5 — Rezervacije i tok prodaje

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M5) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.6 — rešeni nalazi iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026, na zahtev vlasnika): dodato `Quote.contract_terms_accepted*` (poglavlje 3.1), automatsko izvođenje `tip_nastupanja` za samouslužne kanale (poglavlje 4.0a), redosled provere garancije/kreditnog limita (poglavlje 4, korak 1), eksplicitni parametri `GET /search` (poglavlje 11), sistemski izuzetak izdavanja vaučera za subagenta unutar odobrenog kredita (poglavlje 6.3); v1.5 dodato pravilo skrivanja identiteta dobavljača od B2C/B2B kanala (poglavlje 6.2), na zahtev vlasnika (avgust 2026), dopunjuje M2 poglavlje 5.1; v1.4 dodato opciono sastavljanje putovanja pre Ponude, za kompleksna višedestinacijska putovanja (poglavlje 3.0), poređenjem sa Travel Compositor portfolio modelom (istraživanje 2.8.2026, vidi Dodatak A Master dokumenta); v1.3 dodati podsetnici/alarmi posle potvrde rezervacije (poglavlje 6.1: neplaćena rezervacija sa izdatim vaučerom, otvorena potvrda dobavljača po stavci, vaučer koji nedostaje uprkos punoj uplati); v1.2 dodala izbor jezika operativne liste za dobavljača (poglavlje 8.3); v1.1 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 2) — v1.1/v1.2 poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1, M2, M3, M4

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
| created_at | timestamp | |

### 3.2 `QuoteItem`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| quote_id | UUID (FK) | |
| product_id | UUID (FK → M2 Product) | |
| source_type | enum: `CONTRACTED`, `API` | |
| stay_from / stay_to | date | |
| occupancy | JSONB | `{adults, children, room_config}` |
| base_cost / base_cost_currency | integer / string | iz M3 RateLine ili M4 AvailabilityQuote, u najmanjoj jedinici valute (poglavlje 2) |
| rate_line_id | UUID, nullable (FK → M3 RateLine) | za `CONTRACTED` stavke — koja konkretna cenovna kombinacija (usluga/`board_type`) je izabrana; nullable za `API` stavke. `room_type` se ne duplira ovde — dobija se preko `ContractPeriod.room_type` (roditelj izabranog `RateLine`, vidi M3 §2.3/2.4) |
| markup_rule_id | UUID (FK → MarkupRule) | koje je pravilo primenjeno — čuva se radi sledljivosti čak i ako se pravilo kasnije promeni |
| final_price / final_price_currency | integer / string | rezultat formule iz 2.1, u najmanjoj jedinici valute |
| provider_quote_reference | string, nullable | za API stavke, radi ponovne provere pred potvrdu |

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
4. Ako sve stavke uspeju, kreira se `Booking` sa statusom: `CONFIRMED` ako su sve stavke `CONFIRMED`; `PENDING_SUPPLIER_CONFIRMATION` ako je bar jedna stavka u tom stanju (rezervacija prelazi u `CONFIRMED` tek kad se i poslednja stavka potvrdi — ručno ili preko M4 povratnog poziva).
5. Emituje se događaj (poglavlje 9).

### 4.1 `Booking`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_number | string, unique | čitljiva oznaka za gosta (npr. `TT-2027-000482`) |
| client_account_id | UUID (FK → M6) | ko plaća |
| channel | enum (isto kao Quote) | |
| tip_nastupanja | enum: `ORGANIZATOR`, `POSREDNIK` | dodato u M10 specifikaciji, poglavlje 4.1 — određuje se po pravilu iz poglavlja 4.0a (automatski za samouslužne kanale, ručno biran uz podrazumevanu vrednost za `INTERNAL_PANEL`/`PHONE`), **nepromenljivo posle kreiranja rezervacije**; određuje PDV tretman (M10) i tip klijentskog ugovora (M20) |
| status | enum: `PENDING_SUPPLIER_CONFIRMATION`, `CONFIRMED`, `MODIFIED`, `CANCELLED`, `COMPLETED` | |
| payment_status | enum: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `INVOICE_PENDING` | **potvrđeno: potvrda rezervacije ne zavisi od statusa plaćanja** — B2B kredit i avansno plaćanje su podržani od starta |
| total_price / currency | integer / string | zbir `final_price` svih stavki, u najmanjoj jedinici valute |
| voucher_url | string, nullable | generiše se kad su ispunjeni uslovi iz poglavlja 6 (puna uplata, ili odobren izuzetak) |
| voucher_override_approved_by | UUID, nullable (FK → M1 User) | popunjeno samo ako je vaučer izdat bez pune uplate — vidi poglavlje 6 |
| voucher_override_reason | text, nullable | obrazloženje izuzetka, unosi ga odobravalac |
| voucher_override_at | timestamp, nullable | |
| created_at / confirmed_at / cancelled_at | timestamp | |
| created_by | UUID | user ili "GOST_SELF" |

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
| cancellation_refund_percentage | integer, nullable | popunjava se pri otkazivanju, iz M3 `CancellationRule` ili M4 `cancellationPolicy` |
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
Agent zadužen za M5 sme **automatski da pripremi nacrt** (`status = DRAFT`) — npr. periodičan posao koji za svaki `ContractPeriod` čiji `stay_from` pada u narednih N dana agregira potvrđene (`item_status = CONFIRMED`) stavke po dobavljaču — ovo je čisto informativna priprema, nivo **"Autonomno"** iz poglavlja 7 Master dokumenta. **Slanje dobavljaču** (prelazak u `status = SENT`) zahteva ljudsku potvrdu, nivo **"Predloži pa čovek odobri"** — isti princip kao slanje ponuda B2B partnerima, i isto obrazloženje kao u M3 poglavlju 4 (agent nikad sam ne šalje potvrdu dobavljaču).

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

---

## 11. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/sales`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/itineraries` | GET / POST | lista / kreiranje novog sastavljanja putovanja (poglavlje 3.0.1) |
| `/itineraries/:id` | GET / PATCH | pregled / izmena (dodavanje, brisanje, preslagivanje segmenata, poglavlje 3.0.2) |
| `/itineraries/:id/to-quote` | POST | konverzija u Ponudu (poglavlje 3.0.3), vraća kreiranu `Quote` |
| `/search` | GET | objedinjena pretraga (M2 katalog + M3 dostupnost + M4 uživo), vraća normalizovane rezultate sa već primenjenom maržom. Parametri (dopuna avgust 2026, rešava nalaz iz `VALIDACIJA-WORKFLOV-B2C.md`): `type` (enum, isti skup kao M2 `Product.type`, opciono — bez njega pretražuju se svi tipovi), `destination_country`/`destination_city` (opciono), `stay_from`/`stay_to` (obavezno za `ACCOMMODATION`/`TRANSFER`/`EXCURSION`/`PACKAGE`, neprimenjivo za samostalnu `INSURANCE`), `occupancy` (JSON, `{adults, children, room_config}`, isti oblik kao `QuoteItem.occupancy`, obavezno kad `type` podrazumeva smeštaj), `channel` (obavezno — filtrira po `Product.visible_channels`, isti enum kao poglavlje 3.1). Kad je `type = PACKAGE`, pretraga vraća gotove pakete iz M2 (`source_type = CONTRACTED` ili `API` sa `Product.type = PACKAGE`) — za custom višedestinacijsko sastavljanje van gotovog paketa koristi se `Itinerary` tok (poglavlje 3.0), ne ovaj endpoint direktno. |
| `/quotes` | POST | kreira ponudu od izabranih proizvoda/datuma/gostiju |
| `/quotes/:id` | GET | pregled ponude, uključujući da li je istekla |
| `/quotes/:id/confirm` | POST | pokreće tok iz poglavlja 4, vraća kreiranu `Booking` ili grešku po stavci |
| `/bookings` | GET | lista, filtrirano po statusu/kanalu/klijentu (prava pristupa iz poglavlja 10) |
| `/bookings/:id` | GET | detalji rezervacije |
| `/bookings/:id/modify` | POST | izmena datuma/gostiju |
| `/bookings/:id/cancel` | POST | otkazivanje (celo ili po stavci); ako provera duplikata (poglavlje 6.4) pronađe konflikt, vraća upozorenje sa detaljima konfliktne stavke umesto da izvrši storno — poziv se ponavlja sa `confirm_duplicate_override: true` da bi se otkazivanje ipak izvršilo |
| `/bookings/:id/payment-status` | PATCH | poziva isključivo M10; ako novi status prelazi u `PAID`, automatski proverava i pokreće generisanje vaučera (poglavlje 6) |
| `/bookings/:id/voucher/override` | POST | zahteva `M5/voucher/OVERRIDE_ISSUE`; generiše vaučer bez obzira na `payment_status`, popunjava `voucher_override_*` polja (poglavlje 4.1/6) |
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
- [ ] Izmena ili otkazivanje stavke koja je već na poslatoj listi automatski priprema revidiran nacrt (`SUPERSEDED` + novi `DRAFT`), nikad tiho ne menja već poslat dokument.
- [ ] Cena (nabavna, prodajna, marža) se nikad ne pojavljuje u dokumentu poslatom dobavljaču.
- [ ] Operativna lista se može generisati na srpskom ili engleskom, i izabrani jezik ostaje nepromenjen na već poslatoj listi i njenim revizijama.
- [ ] Rezervacija sa izdatim vaučerom bez pune uplate (izuzetak, poglavlje 6) generiše dnevni podsetnik timu dok se ne naplati do kraja ili ne otkaže (poglavlje 6.1).
- [ ] Stavka rezervacije u statusu `PENDING_SUPPLIER_CONFIRMATION` duže od praga generiše upozorenje nezavisno po dobavljaču — rezervacija sa stavkama od dva dobavljača ispravno prijavljuje samo onu stavku čiji dobavljač kasni (poglavlje 6.1).
- [ ] Rezervacija sa `payment_status = PAID` a bez generisanog vaučera odmah generiše vidljivo upozorenje (poglavlje 6.1).
- [ ] Test: vaučer i odgovor `/bookings/:id` preko M7/M8/M9-gost konteksta ne sadrže `BookingItem.supplier_reference` niti bilo šta iz M3 `Supplier`/`Contract` (poglavlje 6.2); isti poziv preko M17 (interni kontekst) ta polja ispravno vraća.
- [ ] `Booking.tip_nastupanja` se ispravno automatski izvodi iz `default_tip_nastupanja` (M3/M4) za `B2C_SITE`/`B2B_PORTAL`/`MOBILE` kanale; ponuda sa nesaglasnim kandidatima se odbija sa jasnom porukom umesto da tiho izabere jednu vrednost (poglavlje 4.0a).
- [ ] Provera garancije putovanja (M11) se uvek izvršava pre provere kreditnog limita (M7), nikad obrnuto (poglavlje 4, korak 1).
- [ ] `Quote.contract_terms_accepted` mora biti `true` pre nego što se dozvoli prelazak na plaćanje za samouslužne kanale; `Booking` kreiran bez ovog uslova (za te kanale) se ne dozvoljava.
- [ ] Subagent sa `status = ACTIVE` i rezervacijom unutar kreditnog limita dobija vaučer automatski čim `Booking.status = CONFIRMED`, bez obzira na `payment_status`, bez ručnog override-a (poglavlje 6.3); rezervacija koja prekorači limit i dalje zahteva ručni override.
- [ ] `GET /search` ispravno filtrira po `type`, `destination_country`/`destination_city`, `stay_from`/`stay_to`, `occupancy`, `channel`; `type = PACKAGE` vraća gotove pakete iz M2.
- [ ] Moguće je sastaviti `Itinerary` sa više segmenata u više destinacija, promeniti im redosled, i konvertovati ga u `Quote` — svaki segment sa popunjenim `product_id` postaje `QuoteItem` sa ispravno primenjenom cenom/maržom (poglavlje 3.0.3).
- [ ] Segment bez popunjenog `product_id` se ne konvertuje tiho — korisnik dobija jasno upozorenje pre konverzije koji segmenti su preskočeni.
- [ ] `Quote.itinerary_id` ispravno referencira izvorni `Itinerary` kad Ponuda nastane konverzijom, i ostaje `null` za direktne ponude.

---

## 13. Otvoreno za dalje

- Tačan prag/format za avans (deo unapred, ostatak kasnije) — pravilo se definiše detaljnije kad M10 (Finansije) bude specificiran, pošto je to suštinski pitanje naplate, ne toka rezervacije.
- ~~Da li B2B kreditni limit (M7) treba da blokira potvrdu rezervacije kad se pređe limit.~~ **Rešeno u M7 specifikaciji**: da — kad `Quote.client_account_id` pripada Subagentu, M5 proverava kreditni limit **pre** pokretanja toka potvrde (pre bilo kog poziva ka M3/M4); prekoračenje odbija potvrdu bez rezervisanja kapaciteta. Isto tako, cena za subagenta koristi proviziju (M7) umesto popusta lojalnosti (M6) kao poslednji korak u tok cene.
- Format vaučera (sadržaj, izgled) — definiše se kad se dođe do stvarne izrade, van obima ove specifikacije.
- Tačan izgled/template operativne liste po tipu dobavljača (poglavlje 8.3) — isto obrazloženje kao za vaučer, van obima ove specifikacije.
- Da li slanje operativne liste ide isključivo email prilogom (PDF) ili se razmatra i strukturisan API kanal ka većim hotelskim lancima/prevoznicima — otvoreno dok ne postoji konkretan zahtev dobavljača za tim.
- Da li `API` (M4) stavke ikad zahtevaju sličan operativni dokument (npr. provajder ne prosleđuje kompletne podatke dalje ka stvarnom dobavljaču) — trenutna pretpostavka (poglavlje 8) je da API konekcija sama nosi te podatke, revidira se ako se u praksi pokaže suprotno.
- Tačan izgled kalendara (mesečni grid vs. nedeljni vs. lista) i vizuelno razlikovanje kategorija (npr. boje/ikone slično standardnoj PMS praksi — zelena strelica za dolazak, crvena za odlazak) — dizajnersko pitanje van obima ove specifikacije.
- Vizuelni prikaz/UI za sastavljanje putovanja (poglavlje 3.0.4) — dizajnersko pitanje van obima.
- AI predlozi za popunu praznina u itineraru (poglavlje 3.0.4) — otvoreno dok M15 ne dođe na red za M5.
- Da li `Itinerary` treba i sopstveni rok isteka (`ABANDONED` po vremenu neaktivnosti, slično `Quote.expires_at`) ili ostaje bez roka dok ga korisnik ne konvertuje ili ručno ne napusti — otvoreno, nije kritično jer `Itinerary` ne drži kapacitet niti cenu.
- **Novo (avgust 2026, na zahtev vlasnika) — automatski podsetnik gostu o roku za potvrdu/uplatu opcije kod dobavljača.** Kad dobavljač drži stavku rezervacije "na opciju" (`item_status = PENDING_SUPPLIER_CONFIRMATION`, poglavlje 4) sa konkretnim rokom posle kog dobavljač sam automatski otkazuje ako agencija do tada ne izda vaučer/ne potvrdi, sistem treba automatski da pošalje **gostu** (ne samo internom timu kao u poglavlju 6.1) podsetnik pre tog roka — analogno automatskim email obaveštenjima koje sami dobavljači šalju agenciji (primer iz prakse: "Reservations pending confirmation" — hotel, check-in/check-out datum, referenca dobavljača, ime nosioca rezervacije, tačan rok otkazivanja, veb-referenca). Ovo je nov zahtev, van postojećeg obima 6.1, i pre implementacije zahteva dalju razradu i potvrdu vlasnika oko: (a) novog polja za rok opcije na `BookingItem` — ovaj rok je rok **koji je dao dobavljač**, različit je od praga 48h iz poglavlja 6.1 (koji je interni prag za upozorenje tima, ne stvarni rok posle kog dobavljač otkazuje); (b) kanala/mehanizma slanja transakcionih (ne-marketinških) email obaveštenja gostu — ni ova specifikacija ni M6 (poglavlje 4.1, koji pokriva samo marketinške/informativne poruke uz `marketing_consent`) trenutno ne definišu takav kanal, pa ovo verovatno zahteva dopunu i M5 i M6; (c) tačnog praga koliko pre roka se podsetnik šalje i da li se ponavlja. Vidi i `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md` Dodatak B.
