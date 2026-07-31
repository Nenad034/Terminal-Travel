# Specifikacija modula M10 — Finansije i računovodstvo

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M10), poglavlje 8 (Faza 2) i Dodatak A (nalaz od 28.7.2026. o SEF-u)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda knjigovođe/pravnika pre implementacije (poglavlje 9 ovog dokumenta)
**Status:** Nacrt za usvajanje
**Verzija:** 1.4 — dodata rekonsilijacija ka gostu (poglavlje 5.3); v1.3 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 3.2) — obe poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`); v1.2 dodala PDV po sistemu marže (Čl. 35), obaveze prema dobavljačima, ograničenje gotovine, SEF rok prihvatanja — poređenjem sa ranijim paralelnim dokumentom projekta (`Terminal_Travel_Agency_workflow.html`)
**Zavisi od:** M1, M3, M5. Formalno i od M6/M7 (poglavlje 4 Master dokumenta) — vidi napomenu o redosledu niže.

---

## 1. Svrha i obim modula

M10 pretvara potvrđenu rezervaciju (M5) u zakonski važeći fiskalni dokument (SEF e-faktura za B2B, ESIR fiskalni račun za B2C), prati naplatu od gostiju **i obaveze prema dobavljačima**, i drži osnovne finansijske izveštaje. Van obima: dublja poslovna analitika (to je M13, read-only nad svim modulima), i eTurista/boravišna taksa prijava nadležnima (to je M11 — iako se taksa *naplaćuje* kroz M10 kao stavka na dokumentu, njeno *prijavljivanje* državi je M11 posao, poglavlje 10 ovog dokumenta).

### 1.1 Napomena o redosledu zavisnosti

M6 (CRM) i M7 (B2B) još ne postoje kad M10 dolazi na red (Faza 2 pre Faze 3/4). M10 zato ne čeka pune profile — `Booking.client_account_id` (iz M5) nosi minimalno: naziv, da li je fizičko ili pravno lice, i PIB ako je pravno lice. Kad M6/M7 budu specificirani, M10 se poveže na njihov pun profil bez izmene sopstvenog modela.

---

## 2. Razlika SEF vs. ESIR — koji dokument ide kome

- **Pravno lice (subagent/B2B nalogodavac)** → **SEF e-faktura**. Zakon zahteva razmenu e-faktura između PDV obveznika kroz SEF.
- **Fizičko lice (Gost, B2C)** → **ESIR fiskalni račun**. Maloprodaja prema krajnjem potrošaču ide kroz fiskalizovani uređaj/servis, ne kroz SEF.

`FiscalDocument.document_type` se određuje automatski iz `client_account_id` tipa u trenutku kreiranja nacrta — agent ne bira ručno koji sistem koristi, sistem to izvodi iz podatka o kupcu.

---

## 3. Valuta — konverzija u RSD (rešava otvoreno pitanje iz M3 specifikacije)

Ugovori (M3) mogu biti u EUR ili drugoj valuti, ali **fiskalni dokument prema srpskom zakonu mora biti u RSD**. Rešenje:

### 3.1 `ExchangeRateSnapshot`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| currency | string | npr. `EUR` |
| rate_date | date | |
| nbs_middle_rate | decimal | srednji kurs Narodne banke Srbije na taj dan |
| source | enum: `NBS_API`, `MANUAL` | dok se ne poveže automatski izvor, unosi se ručno |
| created_at | timestamp | |

Svaki `FiscalDocument` čuva i originalni iznos (iz `Booking.total_price`, u izvornoj valuti) i RSD iznos, izračunat po `nbs_middle_rate` **na dan prometa** (dan izdavanja dokumenta, standardna računovodstvena praksa u Srbiji) — ne na dan rezervacije ako se ta dva datuma razlikuju. Isti mehanizam (kurs na dan X) koristi se i za obaveze prema dobavljačima (poglavlje 8), samo sa druge strane transakcije.

### 3.2 Konvencija skladištenja novčanih iznosa — integer, ne decimal

Svaki novčani iznos u M10 (i kroz ceo lanac M3 → M5 → M10) čuva se kao **`integer` u najmanjoj jedinici valute** (RSD → para, EUR → cent), **nikad kao `decimal`/float** — sprečava greške zaokruživanja koje se akumuliraju kroz sabiranje/množenje/konverziju cena (npr. `Booking.total_price` iz M5 → PDV izračun → `FiscalDocument.amount_rsd`). Ovo je kanonski izvor pravila za ceo sistem — M3 (poglavlje 2) i M5 (poglavlje 2) upućuju ovde. Potvrđeno poređenjem sa PrimeTravel `supplier_integration_guide.md`, koji ovo eksplicitno propisuje kao `{ amountCents: number, currency: "EUR" }` obrazac (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 1).

**Izuzeci — nisu novčani iznosi, ostaju `decimal`:**
- Kursevi (`nbs_middle_rate`) — odnos dve valute, ne iznos u valuti.
- Procenti (`percentage`, `vat_rate`, `refund_percentage`, `discount_percentage`) — količnik, ne iznos.

Prikaz korisniku (npr. "1.234,56 RSD") je isključivo formatiranje na UI sloju (deljenje sa 100 i lokalizovan zapis) — ne menja tip skladištenja niti bilo koji izračun u backend-u.

---

## 4. PDV tretman prometa — organizator vs. posrednik (Član 35 Zakona o PDV)

Turistička agencija se po Zakonu o PDV oporezuje različito zavisno od toga da li za konkretnu rezervaciju nastupa kao **organizator putovanja** (prodaje aranžman u svoje ime i za svoj račun, preuzima punu odgovornost za izvršenje) ili kao **posrednik** (prodaje tuđi aranžman u ime i za račun drugog organizatora, uz proviziju). Ovo je **poseban sistem oporezivanja turističkih agencija**, ne opšte PDV pravilo — primenjuje se samo na promet obuhvaćen ovim sistemom (organizovana putovanja), ne na svaku uslugu koju agencija prodaje (vidi ogradu u poglavlju 4.4 za granične slučajeve).

### 4.1 `Booking.tip_nastupanja` (dopuna M5 specifikacije, poglavlje 4.1)

Dodaje se polje na `Booking` (M5): `tip_nastupanja`, enum `ORGANIZATOR` | `POSREDNIK`, **obavezno pri kreiranju rezervacije i nepromenljivo posle toga** — sistem odbija svaki pokušaj izmene ovog polja nakon što `Booking` bude kreiran, jer direktno određuje poreski tretman, obavezu prijave u CIS/eTurista (M11) i vrstu klijentskog ugovora (M20). Ovo polje bira prodajni tim/agent pri potvrdi rezervacije (M5 poglavlje 4), ne M10 — M10 ga samo čita.

### 4.2 Obračun kod organizatora — PDV na maržu

Kad je `tip_nastupanja = ORGANIZATOR`:
- Poreska osnovica = prodajna cena (`Booking.total_price`) − nabavna cena turističke usluge (zbir `base_cost` svih `BookingItem`, iz M5).
- PDV se obračunava **samo na tu razliku (maržu)**, po opštoj poreskoj stopi (trenutno 20%): `pdv_u_marzi = marza_bruto × 20/120`; `marza_neto = marza_bruto − pdv_u_marzi`.
- PDV se **nikad ne iskazuje posebno** na fiskalnom dokumentu koji dobija gost/nalogodavac — vidljiva je samo ukupna cena.
- Agencija **nema pravo na odbitak ulaznog PDV-a** na kupljene turističke usluge (nabavku od hotela/prevoznika koji su deo ovog aranžmana).

### 4.3 Obračun kod posrednika

Kad je `tip_nastupanja = POSREDNIK`: PDV po opštoj stopi (20%) obračunava se **samo na proviziju** (razlika između cene koju agencija naplati gostu i cene koju prosledi/duguje stvarnom organizatoru), ne na punu vrednost aranžmana.

### 4.4 Dopuna `FiscalDocument` (poglavlje 5.1)

Novo polje: `vat_calculation_basis`, enum `MARZA` (poglavlje 4.2) | `PROVIZIJA` (poglavlje 4.3) | `PUNA_OSNOVICA` (za promet koji nije obuhvaćen posebnim sistemom oporezivanja turističkih agencija — npr. samostalna prodaja avio karte bez organizacije putovanja, ako takav proizvod ikad postoji van paketa) — određuje se automatski iz `Booking.tip_nastupanja` u trenutku pripreme nacrta (poglavlje 6.1), isti princip kao automatski izbor `document_type` u poglavlju 2. Agent nikad ručno ne bira ovu vrednost.

**Ograda — potrebna potvrda knjigovođe pre implementacije:** ovo poglavlje pokriva osnovni, najčešći slučaj. Granični slučajevi (mešoviti aranžmani koji kombinuju sopstvene ugovorene usluge i usluge preprodate od drugog organizatora u istoj rezervaciji, samostalna prodaja pojedinačne usluge van paketa) zahtevaju potvrdu knjigovođe pre implementacije — isto pravilo kao za tehnički ugovor sa SEF/ESIR (poglavlje 6.3).

---

## 5. Model podataka

### 5.1 `FiscalDocument`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK), interni | |
| booking_id | UUID (FK → M5 Booking) | |
| document_type | enum: `SEF_EFAKTURA`, `ESIR_RACUN` | vidi poglavlje 2 |
| status | enum: `DRAFT`, `SUBMITTED`, `ISSUED`, `REJECTED`, `STORNIRANO` | vidi poglavlje 6 — `SUBMITTED` je nepovratan korak |
| vat_calculation_basis | enum: `MARZA`, `PROVIZIJA`, `PUNA_OSNOVICA` | vidi poglavlje 4.4 |
| external_reference | string, nullable | broj fakture kod SEF-a ili fiskalni broj/QR kod ESIR-a — **ovo je pravno merodavan identifikator, ne interni `id`** |
| amount_original / currency_original | integer / string | iz Booking-a, u najmanjoj jedinici valute (poglavlje 3.2) |
| amount_rsd | integer | posle konverzije (poglavlje 3), u para |
| vat_rate / vat_amount | decimal / integer | `vat_rate` procenat (decimal, izuzetak iz poglavlja 3.2); `vat_amount` iznos u najmanjoj jedinici valute — obračunato po osnovici iz `vat_calculation_basis` (poglavlje 4) |
| exchange_rate_snapshot_id | UUID (FK), nullable | koji kurs je korišćen, radi sledljivosti |
| buyer_name_snapshot | string | ime/naziv nalogodavca (iz M6) u trenutku slanja — dodato u M6 specifikaciji, poglavlje 6/8, jer fiskalni dokument mora ostati istorijski tačan i ako se profil nalogodavca kasnije promeni |
| buyer_tax_id_snapshot | string, nullable | PIB u trenutku slanja, ako je pravno lice |
| buyer_acceptance_status | enum: `N/A`, `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, nullable | **samo za `SEF_EFAKTURA`** — `N/A` za `ESIR_RACUN` (ne postoji koncept prihvatanja kod fiskalnog računa) |
| buyer_acceptance_deadline | date, nullable | **samo za `SEF_EFAKTURA`** — 15 dana od `submitted_at`; ako kupac ne odgovori do tada, status prelazi u `EXPIRED` (zakonska posledica prihvatanja/odbijanja potvrđuje se sa knjigovođom, poglavlje 9) |
| pdf_url / xml_url | string, nullable | lokalna kopija konačnog dokumenta (EU cloud skladište) — SEF/ESIR ostaju pravni izvor istine, ovo je samo naša arhiva |
| submitted_by | UUID (FK → M1 User) | **obavezno ljudski nalog — nikad AI agent, vidi poglavlje 6** |
| submitted_at / issued_at | timestamp | |

### 5.2 `Payment`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), nullable | **nullable** — kod kartičnog plaćanja uplata se pokreće pre nego što rezervacija uopšte postoji (vidi poglavlje 7.2); popunjava se čim/ako se rezervacija uspešno potvrdi |
| quote_id | UUID (FK → M5 Quote), nullable | popunjeno za kartično plaćanje dok `booking_id` još ne postoji |
| amount / currency | integer / string | u najmanjoj jedinici valute (poglavlje 3.2) |
| method | enum: `BANK_TRANSFER`, `CASH`, `CARD` | |
| status | enum: `PENDING`, `RECEIVED`, `FAILED`, `REFUNDED`, `VOIDED` | `VOIDED` — kartica naplaćena, ali booking potvrda ipak nije uspela (vidi 7.2), iznos se automatski poništava/vraća |
| reference | string, nullable | poziv na broj / izvod banke — za `BANK_TRANSFER`/`CASH` |
| gateway_provider | string, nullable | naziv sertifikovanog PCI-DSS platnog provajdera — samo za `CARD` |
| gateway_transaction_id | string, nullable | referenca transakcije kod provajdera — samo za `CARD` |
| gateway_idempotency_key | string, nullable | sprečava duplu naplatu pri ponovljenom pozivu — samo za `CARD` |
| received_at | timestamp, nullable | |
| recorded_by | UUID (FK → M1 User), nullable | ko je ručno uneo prijem uplate — **null za `CARD`**, jer se ta uplata beleži automatski preko povratnog poziva (webhook) provajdera, ne ručno |

**Ograničenje gotovine:** `method = CASH` je ograničen na **3.000 EUR (ili odgovarajuću RSD protivvrednost po kursu iz poglavlja 3) po transakciji, za rezidente** — u skladu sa Zakonom o sprečavanju pranja novca. Sistem odbija unos `CASH` uplate preko ovog limita; iznos preko limita mora ići kroz `BANK_TRANSFER` ili `CARD`, ili se deli na više nalogodavaca/transakcija samo ako je to stvarno opravdano (ne radi zaobilaženja limita — ova vrsta deljenja je upravo ono što zakon sprečava).

Kad zbir `RECEIVED` uplata za `booking_id` dostigne `Booking.total_price`, M10 poziva M5 `PATCH /bookings/:id/payment-status` sa `PAID`; delimičan iznos → `PARTIALLY_PAID`. **Ovaj prelazak u `PAID` je i okidač za generisanje vaučera u M5 (poglavlje 6 M5 specifikacije)** — M10 ne generiše vaučer sam, samo obaveštava M5 kroz ovaj isti poziv.

### 5.3 Rekonsilijacija ka gostu — Booking → Payment → FiscalDocument

Simetrično rekonsilijaciji ka dobavljaču (`SupplierObligation`, poglavlje 8), M10 izlaže i **read-only proveru** da li se svaka `Booking` na kraju poklapa sa stvarno primljenom uplatom i izdatim fiskalnim dokumentom, bez ručne provere reda po red. Ovo nije nov entitet — čist izveden upit, isti princip "jedan izvor istine" kao M5 kalendar rezervacija (M5 poglavlje 7):

- Za svaku `Booking` sa `status = CONFIRMED`: zbir `RECEIVED` `Payment` zapisa treba da odgovara `Booking.total_price`, i treba da postoji tačno jedan `FiscalDocument` sa `status = ISSUED` (ili `SUBMITTED`, dok se čeka odgovor SEF-a) čiji `amount_original` odgovara istom iznosu.
- Neusklađenost (npr. rezervacija potvrđena i uplaćena, ali fiskalni dokument nikad poslat; ili uplata ostaje delimična dok je `Booking.status = CONFIRMED` duže od N dana) generiše `HealthSignal` tipa `RECONCILIATION_MISMATCH` (M18 poglavlje 2.1) — čisto informativno, nivo "Autonomno", ne menja nijedan zapis automatski.

Potvrđeno poređenjem sa PrimeTravel analizom, koja navodi automatsku rekonsilijaciju rezervacija→uplata→faktura kao eksplicitno nedostajuću funkcionalnost i kod njih (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 7) — vredna dopuna, ne kopiranje gotovog rešenja.

---

## 6. Fiskalizacija — obavezno ljudsko odobrenje (Nikad autonomno)

U skladu sa poglavljem 7 Master dokumenta ("Nikad autonomno — fiskalizacija"), tok je strogo dvostepen:

1. **Priprema nacrta** (`FiscalDocument.status = DRAFT`) — ovo AI agent sme da radi samostalno: popunjava iznose, PDV (uključujući automatski izbor `vat_calculation_basis` iz poglavlja 4.4), konverziju valute, tip dokumenta. Nulti rizik jer ništa još nije poslato nikome spolja.
2. **Slanje** (`DRAFT → SUBMITTED`) — **isključivo čovek** (Računovođa, Direktor ili Vlasnik) potvrđuje i pokreće stvarno slanje ka SEF-u/ESIR-u. Ovaj korak je nepovratan (kreira pravni dokument) i mora biti eksplicitna radnja u interfejsu ("Potvrdi i pošalji fakturu"), ne automatski okidač. Upisuje se u M1 audit log sa `actor_type = HUMAN`.

**SEF specifičnost (Dodatak A, nalaz 28.7.2026):** od 1. aprila 2026. faktura se kreira **unutar same SEF platforme** — naš poziv ka SEF API-ju pri koraku "Slanje" je čin kreiranja pravnog dokumenta, ne naknadna prijava već postojeće fakture. `external_reference` i konačan `xml_url` dobijaju se tek kao odgovor SEF-a na taj poziv. Po slanju, `buyer_acceptance_status` prelazi u `PENDING` sa `buyer_acceptance_deadline = submitted_at + 15 dana` (poglavlje 5.1) — sistem prati ovaj rok i upozorava Računovođu ako istekne bez odgovora kupca.

**Napomena — tačan tehnički ugovor sa SEF-om i ESIR-om nije deo ove specifikacije.** SEF verzija 4.0.0 (objavljena 2.7.2026) je u vreme pisanja ovog dokumenta još u demo okruženju; tačna polja, format XML-a i način autentikacije prema SEF-u i prema sertifikovanom ESIR/fiskalnom uređaju moraju se potvrditi sa knjigovođom i zvaničnom tehničkom dokumentacijom SEF-a **neposredno pre implementacije ovog dela**, ne pretpostaviti unapred — ovo je jedan od domena gde Master dokument (poglavlje 1.2) eksplicitno predviđa uključivanje ljudskog stručnjaka.

### 6.1 Storno/otkazivanje fiskalnog dokumenta
Ako se rezervacija otkaže (M5) posle izdavanja fiskalnog dokumenta, kreira se novi `FiscalDocument` sa `document_type` istim kao original i `status` tokom kroz `DRAFT → SUBMITTED → STORNIRANO`, referencirajući originalni dokument — storno ide kroz isti sistem (SEF/ESIR), nikad se originalni dokument ne briše niti menja lokalno.

---

## 7. Kartično plaćanje

Poglavlje 9 Master dokumenta je kartično plaćanje tretiralo kao buduću mogućnost, ali je pri specifikaciji M8 (sajt) potvrđeno da je potrebno od starta — bez njega gost ne može samostalno da završi rezervaciju na sajtu (M10 do sad je podržavao samo bankovni prenos i keš, što zahteva ljudski kontakt posle rezervacije).

### 7.1 Arhitektura — sertifikovan provajder, mi nikad ne vidimo broj kartice

Koristi se **hostovana forma za plaćanje (hosted checkout)** sertifikovanog PCI-DSS platnog provajdera — gost unosi broj kartice direktno na stranici/frejmu provajdera, nikad na našem serveru ili u našoj bazi. Ovim platforma ostaje u najlakšoj kategoriji PCI-DSS usklađenosti (SAQ A), jer podaci kartice nikad fizički ne prolaze kroz naš sistem — mi dobijamo samo token/referencu transakcije.

Konkretan provajder (npr. bankarski gateway ili međunarodni servis koji podržava RSD i srpsko tržište) bira se pri implementaciji — ovaj dokument definiše generički `PaymentGatewayAdapter` interfejs, isti obrazac kao `ProviderAdapter` u M4, tako da promena provajdera kasnije ne zahteva izmenu ostatka sistema:

```
interface PaymentGatewayAdapter {
  initiatePayment(amount, currency, idempotencyKey): Promise<{ redirectUrl | clientToken, gatewayTransactionId }>;
  getPaymentStatus(gatewayTransactionId): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING", capturedAmount }>;
  refundOrVoid(gatewayTransactionId, amount): Promise<{ status }>;
}
```

### 7.2 Redosled — plaćanje pre potvrde rezervacije (samo za CARD/B2C)

Za razliku od `BANK_TRANSFER`/`CASH` (gde `Payment` uvek prati već postojeći `Booking`), kartično plaćanje na sajtu ide **pre** nego što rezervacija postoji, jer gost očekuje da mu kartica bude naplaćena u istom koraku u kom potvrđuje rezervaciju:

1. Gost na `Quote` klikne "Plati i rezerviši". M10 poziva `PaymentGatewayAdapter.initiatePayment` sa jedinstvenim `gateway_idempotency_key` (sprečava duplu naplatu ako gost dvaput klikne ili mreža "pukne" — isti princip kao idempotentnost u M4).
2. Provajder vrati uspeh → M10 kreira `Payment` sa `quote_id`, `status = RECEIVED`.
3. **Tek sad** M5 pokreće tok potvrde rezervacije iz svoje specifikacije (poglavlje 4, "sve ili ništa").
4. Ako M5 potvrda **uspe** — `Payment.booking_id` se popunjava, `Booking.payment_status = PAID`.
5. Ako M5 potvrda **ne uspe** (npr. kapacitet u međuvremenu prodat) — M10 odmah poziva `PaymentGatewayAdapter.refundOrVoid` i `Payment.status = VOIDED`. Gost dobija jasnu poruku i vraćen novac, bez rezervacije koja "visi" napola plaćena.

Ovo je namerno obrnut redosled u odnosu na `BANK_TRANSFER` (gde rezervacija ne čeka uplatu — poglavlje 4 M5 specifikacije, potvrđena odluka za B2B kredit) — za karticu na sajtu, plaćanje i potvrda su spregnuti u jednu neprekidnu radnju iz ugla gosta, ali sistem ih interno tretira kao dva koraka sa automatskim poništavanjem ako drugi ne uspe.

### 7.3 Zašto ovo nije "Nikad autonomno" transfer novca

Poglavlje 7 Master dokumenta zabranjuje AI agentu da autonomno prenosi novac. Ovo se ne odnosi na tok iz 7.2 — tu gost svojom voljom unosi karticu i plaća sopstvenu rezervaciju kroz sertifikovan provajder; sistem samo mehanički prosleđuje taj zahtev i beleži ishod (isti princip kao automatski poziv ka M4 ili automatska eTurista prijava u M11) — nijedan AI agent ne odlučuje da li i kome se novac prenosi.

---

## 8. Obaveze prema dobavljačima (Payables)

Simetrično potraživanjima od gostiju (poglavlje 5.2 `Payment`), M10 mora da prati i šta agencija duguje dobavljačima za nabavljene turističke usluge — ovo do sada nije postojalo nigde u M10 (modul je pokrivao samo naplatu od gostiju).

### 8.1 `SupplierObligation`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → M3 Supplier) | |
| booking_item_id | UUID (FK → M5 BookingItem), nullable | veza ka konkretnoj prodatoj stavci — **obavezna pre nego što obaveza pređe u `APPROVED`** (poglavlje 8.3) |
| invoice_reference | string, nullable | broj ulazne fakture dobavljača |
| amount_original / currency_original | integer / string | iz M3 `RateLine` cene ili stvarne ulazne fakture ako se razlikuje, u najmanjoj jedinici valute (poglavlje 3.2) |
| exchange_rate_snapshot_id_at_invoice | UUID (FK → `ExchangeRateSnapshot`), nullable | kurs na dan prijema fakture dobavljača |
| amount_rsd_at_invoice | integer, nullable | u para |
| due_date | date | rok plaćanja, iz uslova u M3 `Contract` |
| status | enum: `PENDING`, `APPROVED`, `PAID`, `DISPUTED` | `DISPUTED` — obaveza osporena (npr. dobavljač fakturisao pogrešan iznos), ne plaća se dok se ne razreši |
| paid_at | timestamp, nullable | |
| exchange_rate_snapshot_id_at_payment | UUID (FK → `ExchangeRateSnapshot`), nullable | kurs na dan stvarnog plaćanja |
| exchange_rate_difference | integer, nullable | `(kurs_na_dan_placanja − kurs_na_dan_fakture) × amount_original`, zaokruženo na najbližu paru — popunjava se automatski pri prelasku u `PAID`, pozitivna ili negativna |
| created_at / updated_at | timestamp | |

### 8.2 Alarm pred rok
Sistem upozorava Računovođu **5 dana pre `due_date`** ako status još nije `PAID` — nivo **"Autonomno"** iz poglavlja 7 Master dokumenta (čisto informativno, isti obrazac kao upozorenje pred rok povrata alotmana u M3 poglavlje 4).

### 8.3 Ograda — uparivanje pre odobrenja plaćanja
Obaveza mora imati popunjen `booking_item_id` (identifikovan, proverljiv trošak) pre nego što pređe iz `PENDING` u `APPROVED` — sprečava plaćanje neidentifikovanih/nepotvrđenih troškova. Prelazak u `APPROVED` je ljudska radnja (Računovođa), nikad AI agent — isti nivo opreza kao slanje fiskalnog dokumenta (poglavlje 6).

### 8.4 BSP poravnanje (avio karte)
Za avio dobavljače koji posluju preko IATA BSP sistema, plaćanje ide **nedeljno, kroz direktno zaduženje IATA BSP naloga agencije**, ne pojedinačno po karti. Kad M4 dobije avio/GDS adapter (Master dokument poglavlje 4, otvoreno), `SupplierObligation` zapisi za avio stavke agregiraju se u nedeljni obračun umesto pojedinačnog `due_date` po stavci — tačan mehanizam ostaje otvoren dok avio adapter ne dođe na red (poglavlje 11).

---

## 9. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M10/fiscal-document/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/fiscal-document/CREATE_DRAFT` | Vlasnik, Direktor, Računovođa (i AI agent, nivo "Autonomno" — samo nacrt) |
| `M10/fiscal-document/SUBMIT` | Vlasnik, Direktor, Računovođa — **nikad AI agent**, sprovedeno na nivou koda, ne samo dozvole |
| `M10/payment/VIEW`, `RECORD` | Vlasnik, Direktor, Računovođa — `RECORD` se odnosi samo na ručni unos (`BANK_TRANSFER`/`CASH`); `CARD` uplate beleži sistem automatski preko webhook-a, bez ove dozvole |
| `M10/exchange-rate/VIEW`, `EDIT` | Vlasnik, Direktor, Računovođa |
| `M10/payment-gateway-config/VIEW`, `EDIT` | Vlasnik, Direktor — podešavanje kredencijala platnog provajdera |
| `M10/supplier-obligation/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/supplier-obligation/APPROVE` | Vlasnik, Direktor, Računovođa — **nikad AI agent** (poglavlje 8.3) |

---

## 10. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/finance`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/fiscal-documents/draft` | POST | priprema nacrt iz `booking_id` (sme AI agent), automatski određuje `vat_calculation_basis` iz `Booking.tip_nastupanja` (poglavlje 4.4) |
| `/fiscal-documents/:id/submit` | POST | šalje ka SEF/ESIR — zahteva `M10/fiscal-document/SUBMIT`, samo ljudski nalog |
| `/fiscal-documents/:id` | GET | |
| `/fiscal-documents/:id/storno` | POST | pokreće storno tok |
| `/payments` | GET / POST | pregled / ručan unos prijema uplate (`BANK_TRANSFER`/`CASH`, uz proveru limita gotovine iz poglavlja 5.2) |
| `/payments/card/initiate` | POST | pokreće `PaymentGatewayAdapter.initiatePayment` za dati `quote_id` |
| `/payments/card/webhook` | POST | povratni poziv provajdera — jedini način na koji se `CARD` uplata beleži kao `RECEIVED` |
| `/exchange-rates` | GET / POST | pregled / unos dnevnog kursa |
| `/supplier-obligations` | GET / POST | pregled / kreiranje obaveze prema dobavljaču |
| `/supplier-obligations/:id/approve` | POST | zahteva `M10/supplier-obligation/APPROVE`; odbija ako `booking_item_id` nije popunjen |
| `/supplier-obligations/:id/pay` | POST | beleži plaćanje, izračunava `exchange_rate_difference` |
| `/reconciliation/mismatches` | GET | lista `Booking` zapisa koji ne prolaze proveru iz poglavlja 5.3 (nedostaje uplata i/ili fiskalni dokument) |

---

## 11. Izlazni kriterijum (M10 deo Faze 2)

- [ ] Za rezervaciju sa pravnim licem kao nalogodavcem, sistem automatski bira `SEF_EFAKTURA`; za fizičko lice, `ESIR_RACUN`.
- [ ] Nacrt fiskalnog dokumenta ispravno konvertuje iznos u RSD po NBS srednjem kursu na dan izdavanja.
- [ ] `vat_calculation_basis` se ispravno određuje iz `Booking.tip_nastupanja` (`MARZA` za organizatora, `PROVIZIJA` za posrednika), i PDV se obračunava po formuli iz poglavlja 4, bez posebnog iskazivanja PDV-a gostu kod organizatorskog aranžmana.
- [ ] Pokušaj izmene `Booking.tip_nastupanja` posle kreiranja rezervacije se odbija.
- [ ] Slanje (`SUBMIT`) je fizički nemoguće bez ljudskog naloga — pokušaj preko API-ja bez odgovarajuće dozvole/uloge se odbija.
- [ ] Svaki `SUBMIT` i `STORNO` upisan je u M1 audit log sa identitetom osobe koja je potvrdila.
- [ ] `buyer_acceptance_deadline` se ispravno postavlja na 15 dana od slanja SEF fakture i status prelazi u `EXPIRED` ako kupac ne odgovori.
- [ ] Prijem uplate (delimičan i pun iznos) ispravno ažurira `payment_status` na Booking-u u M5, i prelazak u `PAID` ispravno pokreće generisanje vaučera u M5.
- [ ] Unos `CASH` uplate preko 3.000 EUR (ili RSD protivvrednosti) se odbija.
- [ ] Nijedan broj kartice se nigde ne čuva — sistem drži samo `gateway_transaction_id`/token, provereno testom da se sirovi podaci kartice nikad ne pojavljuju u našim logovima ni bazi.
- [ ] Test: kartično plaćanje uspe, ali M5 potvrda rezervacije zatim ne uspe (simuliran nestanak kapaciteta) → `Payment` prelazi u `VOIDED`, novac se automatski vraća, gost dobija jasnu poruku, nijedna rezervacija nije kreirana.
- [ ] Ponovljen klik/mrežni prekid pri kartičnom plaćanju (isti `gateway_idempotency_key`) ne rezultuje duplom naplatom.
- [ ] `SupplierObligation` ne može preći u `APPROVED` bez popunjenog `booking_item_id`.
- [ ] Alarm 5 dana pre `due_date` neplaćene obaveze prema dobavljaču se ispravno generiše.
- [ ] `exchange_rate_difference` se ispravno izračunava pri plaćanju obaveze kad se kurs na dan fakture razlikuje od kursa na dan plaćanja.
- [ ] Nijedno novčano polje (`amount_original`, `amount_rsd`, `vat_amount`, `amount`, `amount_rsd_at_invoice`, `exchange_rate_difference`) nije tipa `decimal`/float — provereno da su sva `integer` u najmanjoj jedinici valute (poglavlje 3.2); kursevi i procenti ostaju `decimal`.
- [ ] Test-slučaj: potvrđena rezervacija bez izdatog fiskalnog dokumenta se ispravno prepoznaje kroz `/reconciliation/mismatches` i generiše `HealthSignal` (poglavlje 5.3).

---

## 12. Otvoreno za dalje

- Tačan tehnički ugovor sa SEF v4.0.0 i sa izabranim sertifikovanim ESIR/fiskalnim rešenjem — potvrditi sa knjigovođom pre implementacije ovog dela (poglavlje 6).
- Automatski dnevni uvoz NBS kursa (`ExchangeRateSnapshot.source = NBS_API`) — za sada je predviđeno i ručno unošenje kao alternativa dok se ne poveže automatski izvor.
- Boravišna taksa kao stavka na fiskalnom dokumentu — iznos se naplaćuje kroz M10, ali obaveza prijavljivanja nadležnima ide kroz M11; tačan način razmene podataka između ta dva modula definiše se kad M11 bude specificiran.
- Izbor konkretnog PCI-DSS platnog provajdera (poglavlje 7) — treba potvrditi koji provajder podržava RSD i lokalne kartice/banke pre implementacije `PaymentGatewayAdapter`.
- **Granični slučajevi PDV po sistemu marže** (poglavlje 4.4) — mešoviti aranžmani, samostalna prodaja usluge van paketa — zahtevaju potvrdu knjigovođe pre implementacije.
- **Pravna posledica `buyer_acceptance_status = EXPIRED`/`REJECTED`** kod SEF fakture (da li se automatski pokreće neka dalja radnja, ili samo upozorava tim) — potvrditi sa knjigovođom/pravnikom, ista ograda kao za SEF tehnički ugovor.
- **BSP poravnanje** (poglavlje 8.4) — tačan mehanizam agregacije i knjiženja definiše se kad M4 dobije avio/GDS adapter, ne pre toga.
- Da li i kako se obaveze prema dobavljačima koji nisu iz M3 (npr. operativni troškovi agencije van turističke nabavke) uklapaju u `SupplierObligation`, ili ostaju van obima M10 — trenutno `SupplierObligation` pretpostavlja da je svaki dobavljač iz M3 registra; van-M3 troškovi (računovodstveni, kancelarijski) nisu u obimu ove specifikacije.
