# Specifikacija modula M10 — Finansije i računovodstvo

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M10), poglavlje 8 (Faza 2) i Dodatak A (nalaz od 28.7.2026. o SEF-u)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda knjigovođe/pravnika pre implementacije (poglavlje 9 ovog dokumenta)
**Status:** Nacrt za usvajanje
**Verzija:** 1.23 — Zavisnost ka M5 za §5.2 ispravljena — Računovođa dobija `M5/booking/VIEW`+`VIEW_ALL` (3.9.2026, uživo CI nalaz). §5.2 ručan unos uplate interno ažurira `Booking.payment_status` preko M5 `BookingsService.updatePaymentStatus`, koja sprovodi sopstvenu proveru vlasništva (M5 spec poglavlje 6.6) nad identitetom pozivaoca — Računovođa je imala `M10/payment/RECORD` ali nijednu M5 dozvolu, pa je uplata za rezervaciju koju lično ne vodi vraćala 404. Rešeno na M5 strani (`seed.ts`, M5 spec v2.16) — ovaj upis je čisto cross-referenca, bez izmene M10 koda/ponašanja. Poglavlje 10 (tabela dozvola) dopunjeno napomenom o zavisnosti.
**Verzija:** 1.22 — Korekcija ručno unete uplate (2.9.2026, na zahtev vlasnika, poglavlje 5.2b, novo): `PATCH /finance/payments/:id` dozvoljava izmenu uplate (bilo koje ručne metode osim `CARD`) dok fiskalni dokument za tu rezervaciju nije `SUBMITTED`/`ISSUED`; `GET /finance/payments(/:id)` sad vraća `editable: boolean`; svaka izmena upisuje pun `beforeState`/`afterState` u audit log (`M10/payment.updated`). Panel: dugme "izmeni" u redu uplate (kartica Finansije rezervacije i `/finansije/fiskalni-dokumenti/:id`) otvara istu formu kao unos, predpopunjenu, gasi se sam po uspešnom čuvanju. **Provera:** 5 novih jediničnih testova (20/20 u modulu `payments`), tsc čist, uživo potvrđeno kroz pravu VLASNIK sesiju (BANK_TRANSFER i CHECK izmena, oba vidljiva u audit logu sa punim sadržajem).
**Verzija:** 1.21 — Novi ručni načini plaćanja (CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN) + banka + specifikacija čekova (2.9.2026, na zahtev vlasnika, poglavlje 5.2 dopunjeno). `PaymentMethod` enum dobija tri nove vrednosti pored postojećih (BANK_TRANSFER/CASH/CARD):
- **`CARD_MANUAL`** — kartica naplaćena VAN online gateway-a (npr. POS terminal u kancelariji), uneta ručno kroz isti "Zabeleži uplatu" put kao BANK_TRANSFER/CASH. Namerno ODVOJENO od postojećeg `CARD` (koji ostaje isključivo za automatski webhook tok §7.2, sa `gateway_provider`/`gateway_transaction_id`/`gateway_idempotency_key`, `recorded_by = null`) — mešanje bi pokvarilo tu invarijantu.
- **`CHECK`** — ček; svaka CHECK uplata nosi **specifikaciju čekova** (nov model `PaymentCheckDetail`: `bank_id`, `amount`, `check_number`, `clearance_date` — jedna uplata može biti pokrivena VIŠE fizičkih čekova, uobičajena praksa). Zbir `amount` svih redova specifikacije MORA biti jednak `Payment.amount` — proverava `PaymentsService.recordManualPayment` pre upisa, odbija sa `400` ako se ne poklapa.
- **`ADMINISTRATIVE_BAN`** — administrativna zabrana; bez dodatnih polja, isti tretman kao CASH (samo evidencija).

Nov model **`Bank`** (`id`, `name` unique, `active`) — referentna lista banaka za izbor pri BANK_TRANSFER ("odabrati banku iz baze banaka") i CARD_MANUAL ("za kartice takođe od koje banke") uplati, i po redu specifikacije čekova. Popunjena u `seed.ts` (18 poznatih licenciranih banaka u Srbiji, ručno sastavljeno iz javno poznatih podataka — NIJE povučeno iz zvaničnog NBS registra, ispravka ide izmenom seed liste). Nov `GET /finance/payments/../` — tačnije `GET /finance/banks` (`M10/payment/VIEW`, read-only, bez CRUD-a u ovom prolazu — nije traženo).

`Payment.bank_id` (nullable, za BANK_TRANSFER/CARD_MANUAL) i `Payment.check_details[]` (za CHECK) dodati modelu §5.2. `RecordPaymentDto` prošireno (`method` sad prima svih 5 ručnih vrednosti, `bankId` uslovno obavezan za BANK_TRANSFER/CARD_MANUAL preko `@ValidateIf`, `checkDetails[]` uslovno obavezan za CHECK).

**Provera:** tsc čist, migracija `20260902065105_m10_payment_bank_check_details` primenjena, 3 nova jedinična testa u `payments.service.spec.ts` (zbir čekova se poklapa/ne poklapa, bankId prosleđen) + 1 u `banks.service.spec.ts`, 86 unit ukupno u M10. Uživo kroz pravu VLASNIK sesiju: forma "Zabeleži uplatu" (i na `/finansije/fiskalni-dokumenti/:id` i na kartici Finansije rezervacije) prikazuje svih 5 načina, uslovno polje banke/specifikacije čekova, uspešno upisana CHECK uplata sa 2 čeka (vidljivo u listi uplata kao "CHECK · 2 čeka").
**Verzija:** 1.20 — `M10/client-payment-schedule/VIEW_ALL` implementiran u kodu (31.8.2026, isti prolaz kao M6 v1.8/M14 v1.6/M20 v1.6). `ClientPaymentSchedulesService.findAll` sužava STAFF-a bez te dozvole preko `booking` relacije (vlasništvo/zaduženje, M5 §6.6); Računovođa dobija `VIEW_ALL` podrazumevano (fakturiše za celu agenciju, ne poseduje rezervacije). **Provera:** 2 nova jedinična testa, uživo potvrđeno kroz e2e (213/213). v1.19 — cross-referenca (31.8.2026): M3 v1.12 dodaje `TouristTaxInfo` (M3 spec poglavlje 2.7), isključivo informativan podatak o boravišnoj taksi iz cenovnika dobavljača — pravni nalaz iz poglavlja 1 ovog dokumenta (boravišna taksa nije obaveza agencije) time nije promenjen, samo eksplicitno potvrđen; čisto dokumentaciona dopuna, bez izmene koda.
**Verzija:** 1.18 — uskladjeno sa novom M1 §3.9a `VIEW_ALL` konvencijom (31.8.2026): `M10/client-payment-schedule/VIEW` red (poglavlje 11) zamenjen sa "svi podrazumevano vide sve" — vidi M5 spec §6.6, čisto dokumentaciona dopuna. v1.17 — `POST /finance/payments/card/webhook` sad zahteva potpis (poglavlje 7.2, bezbednosni nalaz 28.8.2026, pre-lansiranje pregled cele aplikacije). Ovaj endpoint namerno nema M1 auth (provajder nema naš token, isti obrazac kao svaki pravi PSP webhook) — ali je BEZ potpisa bilo ko ko sazna/izračuna `gatewayTransactionId` mogao da pozove ga direktno i potvrdi TUĐU ili SVOJU rezervaciju kao plaćenu bez ijednog dinara (mock `getPaymentStatus` uvek vraća SUCCESS, a `gatewayTransactionId` je danas deterministički izveden iz `quoteId`, koji je vidljiv u URL-u stranice za plaćanje). Rešenje: deljena tajna (`PAYMENT_WEBHOOK_SECRET`, isti u `apps/api`/`apps/web`) potpisuje HMAC-SHA256 nad `gatewayTransactionId`; `apps/web` (server akcija `payByCardAction`, jedini legitiman pozivalac dok mock simulira providerov korak) računa potpis server-side, nikad u pregledaču. Kad se stvaran PSP izabere (§12), njegov adapter zamenjuje ovaj deljeni ključ sopstvenom šemom potpisa. **Provera:** 4 nova jedinična testa (`payment-webhook-signature.spec.ts`); uživo `curl` bez potpisa → 401, sa ispravnim potpisom → prolazi do poslovne logike (`Payment nije pronađen` za izmišljen ID, očekivano).
**Verzija:** 1.18 — Dopuna istog podsetnika (29.8.2026): potvrđeno da se ulazni fajl za §8.6 uvoz može dobiti automatskim prosleđivanjem mejla (`source_format = EMAIL`, već postojeća vrednost), ne samo ručnim uploadom — preduslovi i predlog dedikovanog sandučeta upisani u M22 spec §10/v1.6, unakrsna referenca ovde.
**Verzija:** 1.17 — Podsetnik u poglavlju 12 (29.8.2026, na zahtev vlasnika, čeka se rad na §8.6): AI ekstrakcija konačne fakture dobavljača treba da čita i status plaćanja sa samog dokumenta (ne samo iznos), i nedostaje `PARTIALLY_PAID` vrednost na `SupplierObligation.status` (§8.1) da poređenje "faktura naspram TT stanja" ima gde da prikaže delimičnu uplatu. Bez izmene koda — čist podsetnik za kad §8.6 implementacija dođe na red (već je flagovana kao čekanje AI provajdera, izlazni kriterijum poglavlje 11).
**Verzija:** 1.17 — popunjavanje rupa u kursnoj listi (6.9.2026, poglavlje 3.1a): dnevni uvoz je do tada povlačio ISKLJUČIVO današnji kurs, pa je svaki dan kad nije prošao (server ugašen, NBS nedostupan, sistem tek postavljen) ostajao TRAJNO bez kursa — posledica nije bila greška nego tišina, jer se M13 `FactPayment` sinhronizacija tiho odloži i izveštaj o naplati ostane prazan. Isti javni izvor sada ume i da vrati kurs za zadati dan (`IndexByDate`, `ExchangeRateListTypeID=3` = srednji kurs, potvrđeno poređenjem sa već uvezenim zapisom za 28.8.2026); dnevni cron sam popunjava rupe iz poslednjih 30 dana, a dublja istorija ide jednokratnom skriptom `npm run rates:backfill`. Za neradni dan NBS vraća poslednju važeću listu, pa se zapis upisuje pod datumom koji stranica javi — vikend ne dobija izmišljen kurs. Dokazano nad živom bazom: 84 dana uvezeno, 12 uplata u evrima projektovano u M13 (bilo 0), svaka po kursu SVOG dana; v1.16 — cross-referenca ažurirana (avgust 2026): M18 (Operativni nadzor) sad postoji u kodu — `reconciliation_mismatch` Event Bus signal (poglavlje 5.3) ima stvarnog pretplatnika (`M18EventSubscribersService`), umesto ranije napomene "M18 još ne postoji kao model" (poglavlje 11, izlazni kriterijum); v1.15 — dnevni automatski uvoz NBS kursa (avgust 2026, na zahtev vlasnika, zatvara stavku iz poglavlja 11): `ExchangeRateSnapshot.source = NBS_API` sad se stvarno popunjava, ne samo `MANUAL`. `NbsRateFetcherService` (`apps/api/src/modules/m10-finansije/exchange-rates/`) svakog jutra u 08:30 (`NbsRateImportCron`, `@Cron`) povlači srednji kurs EUR/USD sa javne NBS stranice (`webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/CurrentMiddleRate`, bez potrebne registracije) i upisuje `ExchangeRateSnapshot` idempotentno (novi `@@unique([currency, rateDate])`). **Privremeno rešenje, isti obrazac kao mock SEF/CIS**: zamenjuje se zvaničnim SOAP veb-servisom NBS ("Sistem veb-servisa Narodne banke Srbije") čim vlasnik/knjigovođa sredi registraciju — format javne stranice nije ugovoren, može se promeniti bez najave, greška pri parsiranju se hvata i samo emituje informativan signal (`M10 exchange_rate_import_failed`), ne ruši cron niti postojeće podatke. NBS-ova konvencija "petak važi i za vikend, dan pre praznika važi i za praznik" se ne replicira posebno — već pokrivena postojećom `findForCurrencyOnOrBefore` logikom (uzima poslednji dostupan kurs). Kolateralno, ova dopuna rešava i M11 spec §7 nalaz (rezervacija bez unetog kursa) — kurs sad praktično uvek postoji; M11 dodatno sad **blokira** potvrdu umesto da baci grešku u retkom slučaju da ipak nedostaje (vidi M11 spec, izmena verzije); v1.14 — kraj-do-kraja povezivanje `KNJIZNO_ODOBRENJE` sa M7 (avgust 2026, poglavlje 5.1a dopuna, zatvara napomenu "čeka M7 implementaciju" iz v1.6/izlazni kriterijum): `CreateCreditNoteDto`/`prepareCreditNoteDraft` prošireni poljem `buyerNameSnapshot`; `submit()` emituje Event Bus `M10 credit_note.submitted` kad je poslat `KNJIZNO_ODOBRENJE` dokument, da M7 (koji sad postoji) postavi `CommissionRebate.status = APPLIED` bez kružne DI zavisnosti modula; e2e dokazano u `apps/api/test/m7-exit-criteria.e2e-spec.ts`; v1.13 — `POST /finance/payments/card/initiate` dopunjen poljem `gatewayTransactionId` u odgovoru (avgust 2026, priprema za M8) — privremeno, dok stvaran PSP nije izabran (§12): M8 (bez hostovane forme provajdera koja bi sama pozvala webhook) sam simulira taj korak i odmah zove `/card/webhook` sa istim ID-jem, da bi ceo initiate→webhook→M5 potvrda lanac bio proverljiv end-to-end i pre izbora provajdera. **Ukloniti ovo polje iz odgovora čim stvaran hostovani checkout zameni simulaciju** — pravi provajder ne bi trebalo da otkriva svoj transakcioni ID direktno klijentu; v1.12 — implementacija (avgust 2026, Faza 2): `apps/api/src/modules/m10-finansije/` — svih 10 modela (FiscalDocument/Payment/PaymentTermsConfig/ClientPaymentSchedule/SupplierObligation/SupplierPaymentInstruction/RefundInstruction/SupplierInvoiceImport+Row/ExchangeRateSnapshot), PaymentGatewayAdapter+FiscalizationGatewayAdapter sa Mock implementacijama (isti obrazac kao M4), automatski okidači preko Event Bus LISTEN strane (booking.confirmed → FiscalDocument nacrt + ClientPaymentSchedule + SupplierObligation), dnevni @Cron alarmi (24h DRAFT, 5 dana pred rok dobavljaču, eskalacija akontacije/balansa, rekonsilijacija). 22 dozvole registrovane u seed.ts. 80+ unit + 6 e2e testova dokazuje 24 od 27 stavki izlaznog kriterijuma (poglavlje 11) — preostale 3 (buyer_acceptance EXPIRED prelazak, virtual_card_reference zaštita, stvarna AI ekstrakcija ulazne fakture) eksplicitno obeležene u checklisti i poglavlju 12. Otkriveno pri implementaciji i ispravljeno u istom prolazu: M5 spec v1.17 (Booking.buyer_name/type/tax_id) i M3 spec v1.9 (Contract.payment_terms_days) — oba polja pretpostavljena ovim dokumentom nikad nisu postojala u ciljnim modulima; v1.11 — ispravljena referenca u poglavlju 8.0/8.1 (avgust 2026, otkriveno pri implementaciji): `SupplierObligation.due_date` pretpostavljao je "uslove plaćanja u M3 Contract" koji nisu postojali kao polje — M3 spec v1.9 dodaje `Contract.payment_terms_days`, ovaj dokument sad upućuje na njega po tačnom imenu, sa podrazumevanih 30 dana kad nije uneto; v1.10 — ispravljena referenca u poglavlju 1.1/2 (avgust 2026, otkriveno pri implementaciji): `Booking.client_account_id` nikad nije nosio naziv/tip/PIB kupca, to su goli FK; M5 spec v1.17 dodaje stvarna polja `buyer_name`/`buyer_type`/`buyer_tax_id` direktno na `Booking`, ovaj dokument sad upućuje na njih po tačnom imenu; v1.9 — dodat AI uvoz ulaznih/konačnih faktura dobavljača (`SupplierInvoiceImport`, poglavlje 8.6), isti obrazac kao M3 `PricelistImport`, zatvara problem #6 iz `Problemi koje zelimo da resimo ovom aplikacijom.md` (avgust 2026); v1.8 dodat `ClientPaymentSchedule`/`PaymentTermsConfig`, rok akontacije i pune uplate prema gostu/nalogodavcu kao globalna agencijska politika, sa upozorenjem pa eskalacijom kad rok probijen (poglavlje 5.4), zatvara problem #4 iz `Problemi koje zelimo da resimo ovom aplikacijom.md` (avgust 2026, na zahtev vlasnika); v1.7 na direktan zahtev vlasnika (avgust 2026): kurs konverzije u RSD sad je na dan uplate umesto na dan izdavanja dokumenta (poglavlje 3), uklonjena sistemska tvrda blokada gotovinske uplate preko 3.000 EUR (poglavlje 5.2, uz zadržan pravni rizik kao otvorenu stavku), uklonjena veza ka M11 boravišnoj taksi jer je ta obaveza smeštajnog objekta a ne agencije (poglavlje 1, 6.0, 10) — M11 je istovremeno u sopstvenoj specifikaciji izgubio i eTurista i boravišnu taksu nadležnost, vidi `08-SPECIFIKACIJA-M11-COMPLIANCE.md`; v1.6 rešeni nalazi iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026, na zahtev vlasnika): automatski okidač za `FiscalDocument` nacrt po `booking.confirmed` (poglavlje 6.0), automatski okidač za `SupplierObligation` (poglavlje 8.0), novi `document_type = KNJIZNO_ODOBRENJE` za primenu M7 retroaktivnog rabata (poglavlje 5.1a), alarm za DRAFT fiskalni dokument koji predugo čeka slanje (poglavlje 6.2), ažurirana referenca za `tip_nastupanja` (poglavlje 4.1 → M5 poglavlje 4.0a); v1.5 dodate isplate dobavljačima u stranoj valuti i refundacije gostu van kartičnog toka (poglavlje 8.5), poređenjem sa Travelsoft Pay portfolio modelom (istraživanje 2.8.2026, vidi Dodatak A Master dokumenta); v1.4 dodata rekonsilijacija ka gostu (poglavlje 5.3); v1.3 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 3.2) — obe poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`); v1.2 dodala PDV po sistemu marže (Čl. 35), obaveze prema dobavljačima, SEF rok prihvatanja — poređenjem sa ranijim paralelnim dokumentom projekta (`Terminal_Travel_Agency_workflow.html`)
**Zavisi od:** M1, M3, M5, M6 (poglavlje 5.1a, `buyer_name_snapshot` za `KNJIZNO_ODOBRENJE`, avgust 2026), M7 (poglavlje 5.1a, `CommissionRebate` → `KNJIZNO_ODOBRENJE`, avgust 2026 — smer M7→M10, M10 sam ne uvozi M7, vidi poglavlje 5.1a). Vidi napomenu o redosledu niže.

---

## 1. Svrha i obim modula

M10 pretvara potvrđenu rezervaciju (M5) u zakonski važeći fiskalni dokument (SEF e-faktura za B2B, ESIR fiskalni račun za B2C), prati naplatu od gostiju **i obaveze prema dobavljačima**, i drži osnovne finansijske izveštaje. Van obima: dublja poslovna analitika (to je M13, read-only nad svim modulima).

**Boravišna taksa i eTurista/CIS prijava gostiju nisu u obimu M10 niti M11** (dopuna avgust 2026, na zahtev vlasnika) — obe su zakonska obaveza smeštajnog objekta (hotela/dobavljača) koji direktno prima gosta, ne agencije-touroperatora koja aranžman prodaje; ranije verzije ove specifikacije i M11 specifikacije su to greškom tretirale kao nadležnost agencije. Terminal ne prati, ne obračunava niti prijavljuje nijedno od ovo dvoje. **Ova odluka ostaje na snazi i posle dopune M3 v1.12** (31.8.2026): M3 `TouristTaxInfo` (M3 spec poglavlje 2.7) čuva iznos/uzrasnu granicu boravišne takse iz cenovnika dobavljača isključivo kao informativan podatak za tim/gosta — M10 ne sme ga koristiti kao osnovu za fakturu ili obavezu, isti pravni nalaz kao gore.

### 1.1 Napomena o redosledu zavisnosti

M6 (CRM) i M7 (B2B) još ne postoje kad M10 dolazi na red (Faza 2 pre Faze 3/4). M10 zato ne čeka pune profile — `Booking` (iz M5, dopuna v1.17 M5 spec, poglavlje 4.1) nosi minimalno: `buyer_name`, `buyer_type` (`FIZICKO_LICE`/`PRAVNO_LICE`) i `buyer_tax_id` (PIB, obavezno kad je pravno lice). Ova tri polja se unose ručno u `POST /quotes/:id/confirm` (M5 poglavlje 11), ne izvode se iz `client_account_id`. Kad M6/M7 budu specificirani, M10 se poveže na njihov pun profil bez izmene sopstvenog modela — **realizovano avgust 2026** za `KNJIZNO_ODOBRENJE` (poglavlje 5.1a): M7 (koji sad postoji) uvozi M10 `FiscalDocumentsModule` i popunjava `buyer_name_snapshot` iz M6 `ClientAccount.company_name`, bez izmene M10 modela podataka.

---

## 2. Razlika SEF vs. ESIR — koji dokument ide kome

- **Pravno lice (subagent/B2B nalogodavac)** → **SEF e-faktura**. Zakon zahteva razmenu e-faktura između PDV obveznika kroz SEF.
- **Fizičko lice (Gost, B2C)** → **ESIR fiskalni račun**. Maloprodaja prema krajnjem potrošaču ide kroz fiskalizovani uređaj/servis, ne kroz SEF.

`FiscalDocument.document_type` se određuje automatski iz `Booking.buyer_type` u trenutku kreiranja nacrta — agent ne bira ručno koji sistem koristi, sistem to izvodi iz podatka o kupcu.

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

Svaki `FiscalDocument` čuva i originalni iznos (iz `Booking.total_price`, u izvornoj valuti) i RSD iznos, izračunat po `nbs_middle_rate` **na dan uplate** (dan kad je odgovarajući `Payment` primljen, poglavlje 5.2 — dopuna avgust 2026, na zahtev vlasnika, zamenjuje raniju verziju koja je kurs vezivala za dan izdavanja dokumenta) — ne na dan rezervacije ako se ta dva datuma razlikuju.

Pošto se nacrt (`DRAFT`, poglavlje 6.0) priprema automatski čim rezervacija pređe u `CONFIRMED`, često pre nego što je uplata stigla, `amount_rsd` na nacrtu je **privremen** (izračunat po kursu na dan pripreme nacrta) i **ponovo se izračunava** po kursu na dan uplate čim `Payment` bude primljen, pre nego što dokument sme preći u `SUBMITTED`. Ako se uplata prima u više navrata (avans + balans), merodavan je kurs na dan uplate koja `Booking.total_price` dovodi do pune naplate (`payment_status → PAID`) — granični slučaj različitih kurseva po ratama zahteva potvrdu knjigovođe pre implementacije, isto obrazloženje kao poglavlje 6.3.

Isti mehanizam (kurs na dan X) koristi se i za obaveze prema dobavljačima (poglavlje 8), samo sa druge strane transakcije — tamo je već kurs vezan za dan fakture/plaćanja, nepromenjeno ovom dopunom.

#### 3.1a Popunjavanje rupa u kursnoj listi (dopuna 6.9.2026)

Dnevni uvoz (v1.15) povlači **isključivo današnji** kurs. To ostavlja rupu koja se ne zatvara sama: svaki dan kad uvoz ne prođe — server ugašen, NBS stranica nedostupna, greška pri parsiranju, sistem tek postavljen — ostaje trajno bez kursa, jer ga ništa nikad ne pokušava ponovo. Ista rupa nastaje i pri unosu uplate sa **ranijim datumom** (uplata evidentirana naknadno), i pri prvom pokretanju sistema, kad istorije nema uopšte.

Posledica nije greška nego **tišina**: `findForCurrencyOnOrBefore` uzme poslednji raniji kurs ako ga ima, a ako ga nema, M13 `FactPayment` sinhronizacija se odloži (`fact-sync.service.ts`) i izveštaj o naplati ostane prazan — bez ijedne poruke korisniku. Zatečeno 5.9.2026: 12 uplata u evrima, u bazi dva zapisa kursa, nijedan na dan ili pre tih uplata.

Zato uvoz dobija i **dovlačenje unazad**, na istom javnom izvoru i sa istim parserom:

- `GET .../ExchangeRate/IndexByDate?isSearchExecuted=true&Date=DD.MM.GGGG&ExchangeRateListTypeID=3` vraća kursnu listu za traženi dan. `ExchangeRateListTypeID=3` je **srednji kurs** — potvrđeno poređenjem: za 28.8.2026. ta stranica vraća EUR 117,3707, identično zapisu koji je dnevni uvoz tog dana upisao u bazu.
- Oblik reda i oznaka datuma (`ФОРМИРАНА НА ДАН d.m.gggg. ГОДИНЕ`) su **isti** kao na stranici dnevnog kursa, pa se koristi postojeći parser bez grananja.
- Za neradni dan NBS sam vraća poslednju važeću listu (traženo 30.8.2026, nedelja → dobijena lista od 28.8.2026). Zapis se zato upisuje pod **datumom koji stranica javi**, nikad pod traženim — inače bi vikend dobio izmišljen sopstveni kurs. Idempotentno je preko postojećeg `@@unique([currency, rate_date])`.

Dva okidača, oba bez sopstvenog ekrana jer nijedan nije korisnička radnja:

1. **Dnevni cron se sam leči.** Posle uvoza današnjeg kursa proverava poslednjih 30 dana i dovlači svaki dan koji nedostaje. Kratak prekid rada se tako zatvara sam, bez ijedne ljudske radnje. Granica od 30 dana je namerna: dublja istorija je jednokratan posao, ne nešto što cron treba da radi svako jutro.
2. **Jednokratno dovlačenje dublje istorije** ide skriptom (`npm run rates:backfill -- <od-datuma> [do-datuma]`), isti obrazac kao seed skripte — održavanje, ne svakodnevni rad. Poziva NBS jednom po danu sa razmakom, da se javni izvor ne opterećuje.

Ručni unos (`POST /finance/exchange-rates`, `source = MANUAL`) ostaje netaknut kao poslednja linija za slučaj da javni izvor zakaže.

**Ograničenje koje ostaje:** izvor je i dalje javna stranica čiji format nije ugovoren (v1.15) — dovlačenje unazad nasleđuje isti rizik, i istom zamenom (zvaničan SOAP veb-servis NBS, poglavlje 11) prestaje da bude privremeno. Kursna lista i dalje **nema ekran u panelu** — postoji API (`GET/POST /finance/exchange-rates`), ali nijedan ekran ga ne prikazuje; upisano u poglavlje 12 kao poznat nedostatak, nije nastalo ovom dopunom.

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

Dodaje se polje na `Booking` (M5): `tip_nastupanja`, enum `ORGANIZATOR` | `POSREDNIK`, **obavezno pri kreiranju rezervacije i nepromenljivo posle toga** — sistem odbija svaki pokušaj izmene ovog polja nakon što `Booking` bude kreiran, jer direktno određuje poreski tretman, obavezu prijave u CIS/eTurista (M11) i vrstu klijentskog ugovora (M20). Za `INTERNAL_PANEL`/`PHONE` kanale ovo polje bira prodajni tim/agent pri potvrdi rezervacije; za samouslužne kanale (`B2C_SITE`, `B2B_PORTAL`, `MOBILE`) izvodi se automatski iz `M3 Contract.default_tip_nastupanja`/`M4 ProviderConfig.default_tip_nastupanja` (M5 poglavlje 4.0a, dopuna avgust 2026 — zatvara raniju rupu gde ovo polje nije imalo nosioca odluke u samoposlužnom toku). M10 ga u oba slučaja samo čita.

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
| document_type | enum: `SEF_EFAKTURA`, `ESIR_RACUN`, `KNJIZNO_ODOBRENJE` | vidi poglavlje 2 za prva dva; `KNJIZNO_ODOBRENJE` dodato avgust 2026, vidi poglavlje 5.1a |
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
| related_subagent_id | UUID, nullable (FK → M7 Subagent) | **samo za `KNJIZNO_ODOBRENJE`** — vidi poglavlje 5.1a; `null` za `SEF_EFAKTURA`/`ESIR_RACUN` |
| credited_rebate_id | UUID, nullable (FK → M7 CommissionRebate) | **samo za `KNJIZNO_ODOBRENJE`** — koji rabat je ovaj dokument realizovao, radi sledljivosti |

### 5.1a `KNJIZNO_ODOBRENJE` — primena M7 retroaktivnog rabata (dopuna, avgust 2026 — rešava nalaz iz `VALIDACIJA-WORKFLOW-B2B.md`)

M7 poglavlje 3.2 opisuje da se odobren `CommissionRebate` "knjiži kao umanjenje sledeće fakture/dugovanja subagenta u M10", ali M10 do sada nije imao dokument koji bi to stvarno predstavljao u SEF sistemu — `SEF_EFAKTURA` je namenjena originalnoj prodaji, a storno (poglavlje 6.1) poništava **konkretnu** fakturu zbog otkazane rezervacije, ne opšti kredit nevezan za jednu rezervaciju.

**Rešenje:** `document_type = KNJIZNO_ODOBRENJE` predstavlja knjižno odobrenje (credit note) ka subagentu, nevezano za pojedinačnu `Booking`/`FiscalDocument` — `booking_id` ostaje `nullable` za ovaj tip (jedini slučaj gde `FiscalDocument.booking_id` sme biti prazno). Umesto toga popunjava se `related_subagent_id` i `credited_rebate_id`. Iznos (`amount_original`/`amount_rsd`) jednak je `CommissionRebate.calculated_amount` (M7 poglavlje 3.2). Isti dvostepeni tok kao svaki drugi fiskalni dokument (poglavlje 6): priprema nacrta sme AI agent, **slanje zahteva ljudsku potvrdu**.

**Povezivanje sa M7 (implementirano, avgust 2026 — M7 sad postoji u kodu, zatvara napomenu "čeka M7 implementaciju" iz ranije verzije ovog dokumenta):** M7 `CommissionRebatesService.approve()` (kad rabat pređe `DRAFT → APPROVED`) sinhrono poziva `POST /fiscal-documents/credit-note/draft` in-process (`FiscalDocumentStubService` u M7, `apps/api/src/modules/m7-b2b-subagenti/commission/`) — `relatedSubagentId`/`creditedRebateId`/`amount`/`currency` iz rabata, `buyerNameSnapshot` sad popunjen stvarnim nazivom firme subagenta (M6 `ClientAccount.company_name`, preko `Subagent.client_account_id` — weak reference, čita se preko M6 `ClientAccountsService`, ne direktno u M6 bazu). Smer zavisnosti je namerno **M7 → M10** (M7 `CommissionModule` uvozi M10 `FiscalDocumentsModule`), nikad obrnuto — M10 ne uvozi M7. Kad je taj dokument stvarno poslat (`submit()`, ljudski nalog), M10 mora obavestiti M7 da rabat pređe u `APPLIED` (M7 spec §3.2); pošto M10 ne sme uvesti M7 direktno (kružna zavisnost sa smerom iznad), ovaj povratni signal ide preko Event Bus-a (`M10` `credit_note.submitted`, isti LISTEN/NOTIFY obrazac kao M5 `booking.confirmed`) — M7 `M7EventSubscribersService` sluša i zove `CommissionRebatesService.markApplied`. E2e dokazano kraj-do-kraja u `apps/api/test/m7-exit-criteria.e2e-spec.ts`.

**Ograda — potrebna potvrda knjigovođe pre implementacije, isto obrazloženje kao poglavlje 6.3 (tehnički ugovor SEF/ESIR):** tačan tehnički format kojim SEF prihvata knjižno odobrenje (da li je to zaseban dokument tip u SEF API-ju, ili se realizuje kao redovna e-faktura sa negativnim iznosom, ili na neki treći način) nije ovde definisan — ovaj dokument samo predviđa mesto u modelu podataka (`document_type`, `related_subagent_id`, `credited_rebate_id`) i nivo autonomije, ne tačan SEF tehnički ugovor.

### 5.2 `Payment`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), nullable | **nullable** — kod kartičnog plaćanja uplata se pokreće pre nego što rezervacija uopšte postoji (vidi poglavlje 7.2); popunjava se čim/ako se rezervacija uspešno potvrdi |
| quote_id | UUID (FK → M5 Quote), nullable | popunjeno za kartično plaćanje dok `booking_id` još ne postoji |
| amount / currency | integer / string | u najmanjoj jedinici valute (poglavlje 3.2) |
| method | enum: `BANK_TRANSFER`, `CASH`, `CARD`, `CARD_MANUAL`, `CHECK`, `ADMINISTRATIVE_BAN` | poslednja tri dodata 2.9.2026 (§5.2a) — svi ručni, kao `BANK_TRANSFER`/`CASH`. `CARD` ostaje isključivo automatski webhook tok (poglavlje 7.2), `CARD_MANUAL` je odvojena vrednost za karticu naplaćenu VAN gateway-a (npr. POS terminal), namerno ne deli invarijante sa `CARD` |
| status | enum: `PENDING`, `RECEIVED`, `FAILED`, `REFUNDED`, `VOIDED` | `VOIDED` — kartica naplaćena, ali booking potvrda ipak nije uspela (vidi 7.2), iznos se automatski poništava/vraća |
| reference | string, nullable | poziv na broj / izvod banke — za `BANK_TRANSFER`/`CASH`/ostale ručne metode |
| bank_id | UUID (FK → `Bank`, §5.2a), nullable | dopuna 2.9.2026 — banka za `BANK_TRANSFER`/`CARD_MANUAL` ("odabrati banku iz baze banaka" / "za kartice takođe od koje banke"); prazno za CASH/CARD/ADMINISTRATIVE_BAN; za CHECK banka ide PO ČEKU (§5.2a), ne ovde |
| gateway_provider | string, nullable | naziv sertifikovanog PCI-DSS platnog provajdera — samo za `CARD` |
| gateway_transaction_id | string, nullable | referenca transakcije kod provajdera — samo za `CARD` |
| gateway_idempotency_key | string, nullable | sprečava duplu naplatu pri ponovljenom pozivu — samo za `CARD` |
| received_at | timestamp, nullable | |
| recorded_by | UUID (FK → M1 User), nullable | ko je ručno uneo prijem uplate — **null za `CARD`**, jer se ta uplata beleži automatski preko povratnog poziva (webhook) provajdera, ne ručno |

#### 5.2a `Bank` i `PaymentCheckDetail` (dopuna, 2.9.2026, na zahtev vlasnika)

**`Bank`** — prosta referentna lista (`id`, `name` unique, `active`) za izbor banke pri unosu uplate. Popunjena u `seed.ts`, 18 poznatih licenciranih banaka u Srbiji — ručno sastavljeno iz javno poznatih podataka, **nije** povučeno iz zvaničnog NBS registra (ispravka/dopuna ide izmenom seed liste, ne kroz ekran u ovom prolazu — CRUD nije tražen). `GET /finance/banks` (`M10/payment/VIEW`).

**`PaymentCheckDetail`** — "specifikacija čekova": jedna `CHECK` uplata može biti pokrivena više fizičkih čekova (uobičajena praksa, često sa različitim rokovima realizacije, ređe iz različitih banaka), otuda zaseban model umesto polja direktno na `Payment`.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| payment_id | UUID (FK → `Payment`) | |
| bank_id | UUID (FK → `Bank`) | |
| amount | integer | ista konvencija (najmanja jedinica valute) |
| check_number | string | broj čeka |
| clearance_date | date | datum realizacije |

Zbir `amount` svih redova specifikacije za jednu uplatu MORA biti jednak `Payment.amount` — proverava `PaymentsService.recordManualPayment` pre upisa (`400` ako se ne poklapa), nije baza-nivo ograničenje (zahteva agregaciju preko FK-a, van domašaja proste Postgres provere).

**Gotovina — bez sistemske blokade (dopuna avgust 2026, na zahtev vlasnika):** ranija verzija ove specifikacije je uvodila tvrdu blokadu `CASH` uplate preko 3.000 EUR po transakciji, po analogiji sa Zakonom o sprečavanju pranja novca. Na eksplicitan zahtev vlasnika, sistem **ne sprovodi** ovo ograničenje programski — `method = CASH` se prima bez gornjeg limita u aplikaciji.

**Napomena o pravnom riziku:** Zakon o sprečavanju pranja novca i finansiranja terorizma i dalje postoji nezavisno od toga da li ga aplikacija tehnički sprovodi; uklanjanje sistemske kontrole prebacuje odgovornost za usklađenost na ručnu proceduru tima. Potvrditi sa pravnikom/knjigovođom pre puštanja u produkciju da li je ručna procedura dovoljna, ili sistem ipak treba bar meko upozorenje (ne blokada) u interfejsu kod velikih gotovinskih iznosa — isto obrazloženje kao ostale stavke koje čekaju potvrdu pravnika (poglavlje 12).

Kad zbir `RECEIVED` uplata za `booking_id` dostigne `Booking.total_price`, M10 poziva M5 `PATCH /bookings/:id/payment-status` sa `PAID`; delimičan iznos → `PARTIALLY_PAID`. **Ovaj prelazak u `PAID` je i okidač za generisanje vaučera u M5 (poglavlje 6 M5 specifikacije)** — M10 ne generiše vaučer sam, samo obaveštava M5 kroz ovaj isti poziv.

#### 5.2b Korekcija ručno unete uplate (dopuna, 2.9.2026, na zahtev vlasnika: "prilikom kucanja specifikacije čekova može doći do greške jer se ručno kuca, pa treba omogućiti korigovanje... uplatu bilo koje vrste je moguće izmeniti samo pod uslovom da već nije kreiran račun i nije urađena fiskalizacija")

Svaka ručno uneta uplata (svih 5 metoda iz §5.2a osim `CARD`) može se **izmeniti nakon unosa** — najčešći slučaj je greška pri ručnom kucanju specifikacije čekova (broj čeka, iznos, banka), ali obuhvata sve editabilne kolone (`amount`, `currency`, `method`, `reference`, `bank_id`, `check_details[]`).

**Uslov za dozvoljenu izmenu (servisna provera, ne UI odluka):**
- `method !== 'CARD'` — `CARD` uplata je isključivo automatski webhook zapis (§7.2), nikad ručno menjana.
- `Payment.booking_id` mora postojati (kartično plaćanje pre potvrde rezervacije, §7.2, nema šta da se menja pre nego što `booking_id` postoji).
- Za `booking_id` te uplate **ne sme postojati** `FiscalDocument` sa statusom `SUBMITTED` ili `ISSUED` — vlasnikovo "već je kreiran račun i urađena fiskalizacija" tumači se kao ova dva statusa; automatski pripremljen `DRAFT` nacrt (poglavlje 6.0) **ne blokira** izmenu, jer nacrt sam po sebi ništa ne šalje spolja i uobičajeno se priprema odmah po potvrdi rezervacije, pre nego što je poslednja uplata uopšte stigla.
- Za `CHECK` metodu, zbir izmenjene specifikacije čekova i dalje mora biti jednak izmenjenom `amount` (ista provera kao pri unosu, §5.2a).

`GET /finance/payments` i `GET /finance/payments/:id` sad vraćaju izračunato polje `editable: boolean` po gornjim pravilima — panel prikazuje dugme "izmeni" isključivo kad je `true` (nikad kao gola UI pretpostavka).

**`PATCH /finance/payments/:id`** (`M10/payment/RECORD`, ista dozvola kao unos) — telo isto kao `RecordPaymentDto` bez `bookingId` (ne menja se). Servis odbija sa `400` ako uslov iznad nije ispunjen. Izmena je **potpuna zamena** editabilnih polja (ne parcijalni PATCH po polju) — jednostavnije za proveru i za audit trag (jasno "pre/posle" stanje cele uplate). Za `CHECK`, stari redovi specifikacije se brišu i redovi iz zahteva se upisuju iznova (nema poravnanja red-po-red).

**Audit trag (`AuditLogService`, append-only, isti mehanizam kao svaka druga izmena u sistemu):** svaka izmena upisuje `M10/payment.updated` sa punim `beforeState`/`afterState` snapshot-om uplate (uključujući `checkDetails[]` pre/posle) — ovo je direktan odgovor na vlasnikov zahtev "sve to beležiti u logovima", jer se korekcija ručnog unosa (posebno specifikacije čekova) mora moći rekonstruisati unazad.

**Poznato ograničenje (namerno neizmenjeno u ovom prolazu):** ako se izmenom `amount` uplata koja je već dovela `Booking.payment_status` do `PAID` smanji ispod `Booking.total_price`, servis **ne vraća** status na `PARTIALLY_PAID`/`UNPAID` automatski — samo poziva istu `onBookingPaymentReceived` proveru koja status samo *podiže*, nikad ne spušta. Redak slučaj (korekcija naniže posle dostignutog punog iznosa) prijavljen kao otvorena stavka (poglavlje 12) dok se ne odluči da li spuštanje statusa treba biti automatsko ili ručno (ima posledice niz tok — vaučer već generisan, poglavlje 6 M5 specifikacije).

**Provera:** 5 novih jediničnih testova u `payments.service.spec.ts` (uspešna izmena + audit log sadržaj, `CARD` odbijen, `SUBMITTED` fiskalni dokument blokira, `DRAFT` fiskalni dokument NE blokira, neusklađen zbir čekova odbijen), 20/20 u modulu `payments`, tsc čist. Uživo kroz pravu VLASNIK sesiju: izmena `BANK_TRANSFER` uplate bez banke (obavezno polje pri izmeni, isto kao pri unosu) i izmena `CHECK` uplate (referenca), oba potvrđena u listi uplata i u audit logu (`beforeState`/`afterState` sa punim sadržajem uplate).

### 5.3 Rekonsilijacija ka gostu — Booking → Payment → FiscalDocument

Simetrično rekonsilijaciji ka dobavljaču (`SupplierObligation`, poglavlje 8), M10 izlaže i **read-only proveru** da li se svaka `Booking` na kraju poklapa sa stvarno primljenom uplatom i izdatim fiskalnim dokumentom, bez ručne provere reda po red. Ovo nije nov entitet — čist izveden upit, isti princip "jedan izvor istine" kao M5 kalendar rezervacija (M5 poglavlje 7):

- Za svaku `Booking` sa `status = CONFIRMED`: zbir `RECEIVED` `Payment` zapisa treba da odgovara `Booking.total_price`, i treba da postoji tačno jedan `FiscalDocument` sa `status = ISSUED` (ili `SUBMITTED`, dok se čeka odgovor SEF-a) čiji `amount_original` odgovara istom iznosu.
- Neusklađenost (npr. rezervacija potvrđena i uplaćena, ali fiskalni dokument nikad poslat; ili uplata ostaje delimična dok je `Booking.status = CONFIRMED` duže od N dana) generiše `HealthSignal` tipa `RECONCILIATION_MISMATCH` (M18 poglavlje 2.1) — čisto informativno, nivo "Autonomno", ne menja nijedan zapis automatski.

Potvrđeno poređenjem sa PrimeTravel analizom, koja navodi automatsku rekonsilijaciju rezervacija→uplata→faktura kao eksplicitno nedostajuću funkcionalnost i kod njih (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 7) — vredna dopuna, ne kopiranje gotovog rešenja.

### 5.4 `ClientPaymentSchedule` — rok akontacije i pune uplate prema gostu/nalogodavcu (dopuna, avgust 2026 — zatvara problem #4 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, gap #4 iz `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md`)

Simetrično `SupplierObligation.due_date` (poglavlje 8.1) ka dobavljaču, M10 do sada nije pratio konkretan ugovoreni rok naplate od gosta/nalogodavca — postojao je samo opšti nadzor da li je vaučer izdat bez pune uplate (M5 poglavlje 6.1, dnevni podsetnik dok je `payment_status != PAID`), što je različito od praćenja da li je probijen *rok*. Ova dopuna zatvara tu razliku, bez zamene M5 poglavlja 6.1 (obe provere ostaju, hvataju različite situacije — isti obrazac kao razlika između M10 poglavlja 5.3 i 6.2).

**Izvor pravila — globalna politika agencije, potvrđeno na zahtev vlasnika (avgust 2026):** rok i procenat akontacije **nisu** po ugovoru sa dobavljačem niti ručno po rezervaciji — jedna, agencijska politika važi za sve rezervacije, dok se ne pokaže stvarna potreba za izuzecima po dobavljaču/proizvodu (isti princip opreza kao "ne graditi unapred" iz Master dokumenta).

#### 5.4.1 `PaymentTermsConfig`
Jedan aktivan zapis (singleton — sistem uvek čita najnoviji `updated_at`), uređuje Vlasnik/Direktor:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| deposit_percentage | decimal | % od `Booking.total_price` koji čini akontaciju — izuzetak iz poglavlja 3.2 (procenat, ne iznos) |
| deposit_due_days_after_confirmation | integer | rok za akontaciju, broj dana od `booking.confirmed` |
| balance_due_days_before_stay | integer | rok za balans (punu uplatu), broj dana pre najranijeg datuma početka putovanja u rezervaciji |
| escalation_days_after_due | integer | koliko dana posle probijenog roka signal eskalira sa `WARNING` na `CRITICAL` (poglavlje 5.4.3) |
| updated_by | UUID (FK → M1 User) | |
| updated_at | timestamp | |

#### 5.4.2 `ClientPaymentSchedule`
Kreira se automatski po `booking.confirmed` (isti trigger obrazac kao poglavlje 6.0/8.0), nivo **"Autonomno"** — čisto deterministično računanje iz već postojećih podataka, bez novog rizika. Vrednosti iz `PaymentTermsConfig` se **snimaju u trenutku kreiranja** (ne žive vezano na konfiguraciju) — kasnija izmena politike ne menja retroaktivno već kreirane rasporede, isti princip kao `buyer_name_snapshot` na `FiscalDocument` (poglavlje 5.1).

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), unique | |
| deposit_amount | integer | `round(Booking.total_price × deposit_percentage / 100)`, u najmanjoj jedinici valute (poglavlje 3.2) |
| deposit_due_date | date | `booking.confirmed_at + deposit_due_days_after_confirmation` (snapshot vrednost) |
| deposit_status | enum: `PENDING`, `MET`, `OVERDUE` | vidi poglavlje 5.4.3 |
| balance_due_date | date | `MIN(BookingItem.stay_from svih stavki rezervacije) − balance_due_days_before_stay` (snapshot vrednost) |
| balance_status | enum: `PENDING`, `MET`, `OVERDUE` | vidi poglavlje 5.4.3 |
| created_at | timestamp | |

#### 5.4.3 Praćenje statusa i eskalacija — upozorenje pa eskalacija, nikad automatska radnja nad rezervacijom

- `deposit_status` prelazi u `MET` čim zbir `RECEIVED` `Payment` zapisa za `booking_id` dostigne bar `deposit_amount` (uključujući slučaj da je gost odmah platio u celosti). `balance_status` prelazi u `MET` čim `Booking.payment_status = PAID` (isti okidač kao poglavlje 5.2). Ako je `balance_status = MET`, `deposit_status` se takođe smatra ispunjenim bez obzira na redosled uplata.
- Ako odgovarajući rok (`deposit_due_date`/`balance_due_date`) prođe a status još nije `MET`, status prelazi u `OVERDUE` i generiše se `HealthSignal` tipa `PAYMENT_DEADLINE_MISSED` (M18 poglavlje 2.1, nov tip — dodato u tu specifikaciju u istom prolazu), `severity = WARNING`, vidljivo u M17 Agent Inbox — nivo **"Autonomno"**, obična provera datuma, ne zahteva poziv jezičkom modelu (isti princip kao M18 poglavlje 6.2, "Najvažniji nalaz").
- Ako `OVERDUE` ostane nerešeno još `escalation_days_after_due` dana (iz snimljene konfiguracije), isti signal se ažurira na `severity = CRITICAL` — po M18 poglavlju 2.2 ovo odmah šalje Telegram/email obaveštenje, za razliku od početnog `WARNING` koji čeka nedeljni pregled. I ovaj korak ostaje nivo **"Autonomno"** — samo jače obaveštenje, ne menja ništa na rezervaciji.
- **Sistem nikad sam ne otkazuje niti menja rezervaciju zbog probijenog roka.** Eskalacija isključivo traži eksplicitnu ljudsku odluku (kontaktirati gosta, produžiti rok, ili pokrenuti otkazivanje kroz redovan M5 tok — uključujući proveru duplikata pre otkazivanja, M5 poglavlje 6.4) — isti nivo opreza kao svaka druga radnja koja menja novac/rezervaciju u ovom dokumentu.

---

## 6.0 Automatska priprema nacrta po potvrdi rezervacije (dopuna, avgust 2026 — rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md`)

M5 poglavlje 9 navodi M10 ("fakturisanje") među modulima koji se pretplaćuju na `booking.confirmed` — ali ovaj dokument do sada nije eksplicitno definisao da se to zaista dešava automatski, samo je izlagao `POST /fiscal-documents/draft` kao endpoint koji nešto/neko poziva. Ovim se to zatvara: **M10 se pretplaćuje na `booking.confirmed`** (Event Bus) i automatski poziva isti tok kao `POST /fiscal-documents/draft` za pogođeni `booking_id`, isti nivo autonomije kao poglavlje 6 dole (priprema nacrta je "Autonomno", slanje ostaje "Nikad autonomno") — isti obrazac kao M6 §3.2 (lojalnost), M11 §4.3 (CIS garancija) i M20 §3.1 (ugovor sa klijentom), koji se svi već pretplaćuju na isti događaj.

**Izuzetak — `KNJIZNO_ODOBRENJE` (poglavlje 5.1a) nije pokriven ovim automatskim okidačem** — taj tip dokumenta nastaje iz `CommissionRebate` odobrenja (M7 poglavlje 3.2), ne iz `booking.confirmed`, i priprema se posebnim pozivom kad Vlasnik/Direktor/Računovođa odobri rabat.

---

## 6. Fiskalizacija — obavezno ljudsko odobrenje (Nikad autonomno)

U skladu sa poglavljem 7 Master dokumenta ("Nikad autonomno — fiskalizacija"), tok je strogo dvostepen:

1. **Priprema nacrta** (`FiscalDocument.status = DRAFT`) — ovo AI agent sme da radi samostalno: popunjava iznose, PDV (uključujući automatski izbor `vat_calculation_basis` iz poglavlja 4.4), konverziju valute, tip dokumenta. Nulti rizik jer ništa još nije poslato nikome spolja.
2. **Slanje** (`DRAFT → SUBMITTED`) — **isključivo čovek** (Računovođa, Direktor ili Vlasnik) potvrđuje i pokreće stvarno slanje ka SEF-u/ESIR-u. Ovaj korak je nepovratan (kreira pravni dokument) i mora biti eksplicitna radnja u interfejsu ("Potvrdi i pošalji fakturu"), ne automatski okidač. Upisuje se u M1 audit log sa `actor_type = HUMAN`.

**SEF specifičnost (Dodatak A, nalaz 28.7.2026):** od 1. aprila 2026. faktura se kreira **unutar same SEF platforme** — naš poziv ka SEF API-ju pri koraku "Slanje" je čin kreiranja pravnog dokumenta, ne naknadna prijava već postojeće fakture. `external_reference` i konačan `xml_url` dobijaju se tek kao odgovor SEF-a na taj poziv. Po slanju, `buyer_acceptance_status` prelazi u `PENDING` sa `buyer_acceptance_deadline = submitted_at + 15 dana` (poglavlje 5.1) — sistem prati ovaj rok i upozorava Računovođu ako istekne bez odgovora kupca.

**Napomena — tačan tehnički ugovor sa SEF-om i ESIR-om nije deo ove specifikacije.** SEF verzija 4.0.0 (objavljena 2.7.2026) je u vreme pisanja ovog dokumenta još u demo okruženju; tačna polja, format XML-a i način autentikacije prema SEF-u i prema sertifikovanom ESIR/fiskalnom uređaju moraju se potvrditi sa knjigovođom i zvaničnom tehničkom dokumentacijom SEF-a **neposredno pre implementacije ovog dela**, ne pretpostaviti unapred — ovo je jedan od domena gde Master dokument (poglavlje 1.2) eksplicitno predviđa uključivanje ljudskog stručnjaka.

### 6.1 Storno/otkazivanje fiskalnog dokumenta
Ako se rezervacija otkaže (M5) posle izdavanja fiskalnog dokumenta, kreira se novi `FiscalDocument` sa `document_type` istim kao original i `status` tokom kroz `DRAFT → SUBMITTED → STORNIRANO`, referencirajući originalni dokument — storno ide kroz isti sistem (SEF/ESIR), nikad se originalni dokument ne briše niti menja lokalno.

**Ručno/odmah slanje** (`POST /fiscal-documents/:id/storno`, `FiscalDocumentsService.storno`) kreira storno dokument i odmah ga šalje ka fiskalnom gateway-u — završava direktno u `STORNIRANO`. **Dvostepena priprema** (dodato pri implementaciji M14, avgust 2026 — M14 poglavlje 3.2): kad M14 tiket kategorije `REKLAMACIJA` bude rešen uz odluku o povraćaju (`Ticket.refund_decision = true`), M14 emituje `ticket.resolved_with_refund` (Event Bus) koji `M10EventSubscribersService` sluša; `FiscalDocumentsService.prepareStornoDraftForBooking(bookingId)` kreira storno-nacrt u statusu `DRAFT` (referencira original preko `storno_of_document_id`, ali NE šalje ka gateway-u odmah). Kad neko iz tima to naknadno potvrdi kroz `POST /fiscal-documents/:id/submit` (isti endpoint kao svaki drugi nacrt), `submit()` prepoznaje `storno_of_document_id` i završava dokument direktno u `STORNIRANO` (ne u `SUBMITTED`) — isti krajnji ishod kao odmah-pošalji put iznad, samo sa ljudskom potvrdom umetnutom između pripreme i slanja. M10 ne uvozi M14 direktno (izbegava kružnu zavisnost, isti obrazac kao M7↔M10 `credit_note.submitted`).

### 6.2 Alarm za nacrt koji predugo čeka slanje (dopuna, avgust 2026 — rešava operativni nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`)

Poglavlje 5.3 (rekonsilijacija) već hvata slučaj gde rezervacija ostane **potpuno bez** poslatog dokumenta — ali to je reaktivna provera. Za potpuno samouslužne kanale (M8, M7 — poglavlje 6.0), nacrt se pravi automatski čim rezervacija/uplata to omogući, pa je moguće da se nacrti gomilaju u redu čekanja na ljudsko slanje bez da iko primeti dok se ne pokrene `/reconciliation/mismatches`.

Sistem prati svaki `FiscalDocument` u statusu `DRAFT` čiji je `booking.confirmed`/`payment_status = PAID` trenutak stariji od **24 časa** bez prelaska u `SUBMITTED`, i generiše `HealthSignal` (M18 poglavlje 2.1, nivo **"Autonomno"** — čisto informativno, ne blokira ništa), vidljivo u M17 Agent Inbox (isti obrazac kao M5 poglavlje 6.1). Ovo je proaktivna dopuna, ne zamena za §5.3 rekonsilijaciju — obe provere ostaju, hvataju različite trenutke (24h kašnjenje naspram trajno nedostajućeg dokumenta).

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

**Potpis webhook poziva (dopuna 28.8.2026, bezbednosni nalaz — pre lansiranja pregled cele aplikacije).** Korak 2 (`POST /finance/payments/card/webhook`) namerno nema M1 autentikaciju — provajder nema naš token, isti obrazac kao svaki pravi PSP webhook. Bez dodatne zaštite, to je ipak bio potpuno otvoren endpoint: bilo ko ko sazna ili izračuna `gatewayTransactionId` mogao je da ga direktno pozove i lažno potvrdi rezervaciju kao plaćenu — mock `getPaymentStatus` uvek vraća `SUCCESS`, a `gatewayTransactionId` je danas deterministički izveden iz `quoteId` (`mock-txn-${quoteId}-card`), koji je vidljiv u URL-u stranice za plaćanje. Rešeno deljenom tajnom: `PAYMENT_WEBHOOK_SECRET` (ista vrednost u `apps/api`/`apps/web`) potpisuje HMAC-SHA256 nad `gatewayTransactionId`; header `x-payment-webhook-signature` se proverava pre bilo koje poslovne logike (`payment-webhook-signature.ts`, `timingSafeEqual`). `apps/web` (server akcija `payByCardAction`, jedini legitiman pozivalac dok mock simulira providerov korak) računa potpis isključivo server-side — pregledač ga nikad ne vidi. **Kad se stvaran PSP izabere (§12), njegov adapter donosi sopstvenu šemu potpisa (npr. Stripe/CorvusPay), koja zamenjuje ovaj deljeni ključ, ne dodaje se pored njega.**

### 7.3 Zašto ovo nije "Nikad autonomno" transfer novca

Poglavlje 7 Master dokumenta zabranjuje AI agentu da autonomno prenosi novac. Ovo se ne odnosi na tok iz 7.2 — tu gost svojom voljom unosi karticu i plaća sopstvenu rezervaciju kroz sertifikovan provajder; sistem samo mehanički prosleđuje taj zahtev i beleži ishod (isti princip kao automatski poziv ka M4 ili automatska CIS registracija garancije putovanja u M11) — nijedan AI agent ne odlučuje da li i kome se novac prenosi.

---

## 8.0 Šta pokreće kreiranje obaveze prema dobavljaču (dopuna, avgust 2026 — rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md`)

Poglavlje 8 do sada je definisalo model `SupplierObligation` i tok odobravanja, ali ne i **šta konkretno pokreće njeno kreiranje** — dokument je ostavljao otvorenim da li obaveza nastaje automatski pri potvrdi rezervacije, ili tek kad stigne stvarna ulazna faktura dobavljača. Ovim se to zatvara:

**Pravilo:** M10 se pretplaćuje na `booking.confirmed` (isti mehanizam kao poglavlje 6.0) i za svaku `BookingItem` sa `source_type = CONTRACTED` čiji `item_status = CONFIRMED` **automatski kreira `SupplierObligation`** sa `status = PENDING`, `booking_item_id` odmah popunjenim (direktno iz stavke koja je pokrenula kreiranje — ovo je jača veza od minimuma koji poglavlje 8.3 zahteva), `amount_original` iz `BookingItem.base_cost` (M5 poglavlje 4.2, cena iz `RateLine` u trenutku potvrde), `due_date` iz `Contract`/`ContractPeriod` uslova plaćanja (M3). Nivo **"Autonomno"** — čisto mehaničko beleženje već poznatog duga, ista logika kao automatska eTurista prijava (M11 poglavlje 2.2).

**Kad stigne stvarna ulazna faktura dobavljača** (`invoice_reference` se popunjava naknadno, ručno), Računovođa proverava da li se `amount_original` iz automatski kreirane obaveze slaže sa fakturisanim iznosom — ako se razlikuje, ručno koriguje iznos **pre** odobravanja (prelazak u `APPROVED`, poglavlje 8.3 već zahteva ljudsku potvrdu, sada dodatno i za potencijalnu korekciju iznosa). Ovo znači da `SupplierObligation` može postojati i biti vidljiva u izveštajima **pre** nego što je ulazna faktura fizički stigla — namerna odluka, jer daje agenciji rani uvid u dug prema dobavljaču (korisno za M13 profitabilnost) umesto da čeka administrativni korak fakture.

**API-sourced (M4) stavke ne dobijaju `SupplierObligation` na ovaj način** — plaćanje ka M4 provajderima (npr. Travelgate) po pravilu ide kroz ugovoreni obračunski ciklus samog provajdera (npr. BSP nedeljno poravnanje za avio, poglavlje 8.4), ne pojedinačno po rezervaciji; ostaje otvoreno kad M4 dobije konkretne provajdere van hotela (poglavlje 12).

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
| due_date | date | rok plaćanja — datum fakture/kreiranja obaveze + `Contract.payment_terms_days` (M3 spec §2.2, dopuna v1.9); podrazumevanih 30 dana kad `payment_terms_days` nije uneto |
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

### 8.5 Isplate dobavljačima u stranoj valuti i refundacije gostu (dopuna, avgust 2026 — poređenjem sa Travelsoft Pay portfolio modelom)

Poglavlje 8 do sada je pratilo **koliko** se duguje dobavljaču i po kom kursu (§8.1), ali ne i **kako** se novac stvarno prenosi, niti kako izgleda refundacija gostu van kartičnog toka (§7.2, korak 5 — koji pokriva samo `VOID` pre nego što je rezervacija uopšte potvrđena). Ova rupa postaje stvarna sa M4/Travelgate integracijom, jer ona dovodi inostrane dobavljače koji se ne mogu platiti kroz isti tok kao domaći.

**Ograda — namerno mala odluka za sad:** ovo poglavlje ostaje deo M10, ne postaje zaseban modul, dok ne postoji stvaran drugi/treći platni provajder ili obim koji bi opravdao samostalan presek — isti princip kao odluka da se M10 ne cepa dok stvarna potreba to ne pokaže.

#### 8.5.1 Dopuna `SupplierObligation` (poglavlje 8.1)
Novo polje: `payment_method`, enum `BANK_TRANSFER` | `VIRTUAL_CARD` — bira se pri prelasku u `APPROVED` (poglavlje 8.3), podrazumevano `BANK_TRANSFER` dok virtuelne kartice ne budu ugovorene sa platnim provajderom.

#### 8.5.2 `SupplierPaymentInstruction`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_obligation_id | UUID (FK → SupplierObligation) | |
| method | enum (isto kao 8.5.1) | |
| bank_iban / bank_swift | string, nullable | samo za `BANK_TRANSFER`, iz M3 `Supplier` profila |
| virtual_card_reference | string, nullable | token/referenca kod platnog provajdera, samo za `VIRTUAL_CARD` — **nikad pun broj kartice u bazi**, isti princip kao poglavlje 7.1 za naplatu od gosta |
| status | enum: `PENDING`, `EXECUTED`, `FAILED` | |
| executed_by | UUID (FK → M1 User) | **obavezno ljudski nalog — nikad AI agent**, isti nivo opreza kao poglavlje 8.3 (odobrenje obaveze) |
| executed_at | timestamp, nullable | |
| created_at | timestamp | |

#### 8.5.3 `RefundInstruction` — refundacija gosta van kartičnog toka
Za uplate primljene preko `BANK_TRANSFER`/`CASH` (poglavlje 5.2) koje treba delimično ili u celosti vratiti (otkazivanje ili izmena rezervacije sa manjom cenom, M5 poglavlje 6), M10 izlaže eksplicitan zapis umesto slobodnog teksta u napomeni:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| payment_id | UUID (FK → Payment, poglavlje 5.2) | originalna uplata koja se refundira |
| amount / currency | integer / string | u najmanjoj jedinici valute (poglavlje 3.2); može biti manje od originalne uplate (delimičan povraćaj) |
| method | enum: `BANK_TRANSFER`, `CASH` | kartični povraćaj i dalje ide isključivo kroz `PaymentGatewayAdapter.refundOrVoid` (poglavlje 7.1) — ovaj entitet ga ne zamenjuje |
| status | enum: `PENDING`, `APPROVED`, `EXECUTED`, `FAILED` | |
| approved_by | UUID (FK → M1 User) | **nikad AI agent** — nivo "Nikad autonomno" iz poglavlja 7 Master dokumenta, isto obrazloženje kao slanje fiskalnog dokumenta (poglavlje 6) |
| executed_by | UUID (FK → M1 User), nullable | ko je stvarno pokrenuo transfer, popunjava se pri prelasku u `EXECUTED` |
| created_at / executed_at | timestamp | |

**Redosled:** `RefundInstruction` mora imati `status = APPROVED` pre nego što pređe u `EXECUTED` — dva odvojena ljudska koraka (odobrenje pa izvršenje), isti obrazac kao dvostepeni tok fiskalizacije (poglavlje 6).

### 8.6 AI uvoz konačnih (ulaznih) faktura dobavljača (dopuna, avgust 2026 — zatvara problem #6 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, gap #6 iz `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md`)

Poglavlje 8.0 opisuje da `invoice_reference` na `SupplierObligation` "se popunjava naknadno, ručno" kad stigne stvarna ulazna faktura — to ostaje tačan krajnji ishod, ali sam unos više ne mora biti ručno prekucavanje. Isti obrazac kao M3 poglavlje 4.2 (`PricelistImport` — AI OCR/parsiranje cenovnika), primenjen ovde na ulazne/konačne fakture dobavljača umesto na cenovnike; jedina suštinska razlika je meta mapiranja (`SupplierObligation` preko `BookingItem`, umesto `M2 Product`).

#### 8.6.1 `SupplierInvoiceImport`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_id | UUID (FK → M3 Supplier) | |
| source_file_url | string | originalni fajl, EU cloud skladište |
| source_format | enum: `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF` | isti skup kao M3 poglavlje 4.2.1; `SCANNED_PDF` ide kroz OCR pre parsiranja |
| status | enum: `PROCESSING`, `READY_FOR_REVIEW`, `COMPLETED`, `REJECTED` | |
| created_by / created_at | UUID / timestamp | |

#### 8.6.2 `SupplierInvoiceImportRow` — jedan red = jedna fakturisana stavka (gost/termin/iznos)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| supplier_invoice_import_id | UUID (FK) | |
| extracted_guest_name | string | tekst tačno kako piše u izvornom dokumentu, pre mapiranja |
| extracted_stay_from / extracted_stay_to | date | |
| extracted_amount / extracted_currency | integer / string | u najmanjoj jedinici valute (poglavlje 3.2) — konvertuje se pri ekstrakciji, isto kao M3 `PricelistImportRow` |
| extracted_invoice_reference | string | broj fakture/stavke kako piše u dokumentu |
| matched_supplier_obligation_id | UUID, nullable (FK → `SupplierObligation`, poglavlje 8.1) | kandidat pronađen matching-om (poglavlje 8.6.3) |
| match_confidence | decimal (0–100), nullable | |
| review_status | enum: `PENDING`, `CONFIRMED`, `MANUALLY_MATCHED`, `REJECTED` | |
| reviewed_by | UUID (FK → M1 User), nullable | |

#### 8.6.3 Matching — determinizam, ne slobodan AI izbor

Kandidati za `matched_supplier_obligation_id` su `SupplierObligation` zapisi istog `supplier_id` čiji `invoice_reference` je i dalje prazan, filtrirano po preklapanju `BookingItem.stay_from`/`stay_to` (preko `booking_item_id`) sa ekstrahovanim periodom. Unutar tog skupa, `extracted_guest_name` se poredi sa imenima iz `BookingItemGuest` → M6 `GuestProfile` **istim determinističkim fuzzy-match mehanizmom kao M5 poglavlje 6.4** (normalizacija dijakritika/velikih-malih slova + Levenštajnova distanca, ne poziv jezičkom modelu po redu — princip #4 Master dokumenta, "determinizam pre autonomije"); `extracted_amount` se dodatno poredi kao potvrda (veliko odstupanje snižava `match_confidence`, ne odbacuje kandidata automatski, jer se stvarna faktura ponekad razlikuje od ugovorene cene — isto obrazloženje kao poglavlje 8.0).

Redovi sa `match_confidence ≥ 85%` (isti prag kao M3 poglavlje 4.2.3, radi doslednosti kroz sistem) se predlažu kao automatsko mapiranje; ispod praga, red ide na ručno mapiranje (`review_status = PENDING`, bez predloženog `matched_supplier_obligation_id`).

#### 8.6.4 Nivo autonomije — ekstrakcija sama, upis u obavezu tek posle potvrde

Isti dvostepeni obrazac kao M3 poglavlje 4.2.4:
- **Ekstrakcija podataka i predlog mapiranja** (`PROCESSING → READY_FOR_REVIEW`) je nivo **"Autonomno"** — čisto informativna priprema, ništa se još ne piše u stvarni `SupplierObligation`.
- **Upis potvrđenog reda** (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) u `SupplierObligation.invoice_reference`, uz eventualnu korekciju `amount_original` ako se razlikuje od automatski kreirane vrednosti (poglavlje 8.0) i ponovni izračun `exchange_rate_snapshot_id_at_invoice`/`amount_rsd_at_invoice` po kursu na dan prijema fakture (poglavlje 3), je nivo **"Predloži pa čovek odobri"** — zahteva Računovođu (isti nosilac dozvole kao ručna korekcija iz poglavlja 8.0), pre nego što obaveza uopšte može preći u `APPROVED` (poglavlje 8.3 ostaje sledeći, nepromenjen korak).
- Red bez pouzdanog kandidata koji se ne razreši ni ručnim mapiranjem (npr. faktura za trošak van sistema `SupplierObligation`) prelazi u `REJECTED` bez efekta na bilo koji finansijski zapis.

---

## 9. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M10/fiscal-document/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/fiscal-document/CREATE_DRAFT` | Vlasnik, Direktor, Računovođa (i AI agent, nivo "Autonomno" — samo nacrt) |
| `M10/fiscal-document/SUBMIT` | Vlasnik, Direktor, Računovođa — **nikad AI agent**, sprovedeno na nivou koda, ne samo dozvole |
| `M10/payment/VIEW`, `RECORD` | Vlasnik, Direktor, Računovođa — `RECORD` se odnosi samo na ručni unos (`BANK_TRANSFER`/`CASH`); `CARD` uplate beleži sistem automatski preko webhook-a, bez ove dozvole. **Zavisnost (dopuna 3.9.2026):** `RECORD` interno ažurira `Booking.payment_status` preko M5, što zahteva i `M5/booking/VIEW_ALL` (M5 spec poglavlje 6.6) — bez nje uplata za tuđu rezervaciju vraća 404. Računovođa je dobila tu M5 dozvolu istim datumom. |
| `M10/exchange-rate/VIEW`, `EDIT` | Vlasnik, Direktor, Računovođa |
| `M10/payment-gateway-config/VIEW`, `EDIT` | Vlasnik, Direktor — podešavanje kredencijala platnog provajdera |
| `M10/supplier-obligation/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/supplier-obligation/APPROVE` | Vlasnik, Direktor, Računovođa — **nikad AI agent** (poglavlje 8.3) |
| `M10/supplier-payment-instruction/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/supplier-payment-instruction/CREATE` | Vlasnik, Direktor, Računovođa — *sastavljanje* naloga (dopuna 4.9.2026; ranije je bilo dovoljno `VIEW`) |
| `M10/supplier-payment-instruction/EXECUTE` | Vlasnik, Direktor — **nikad AI agent** (poglavlje 8.5.2) |
| `M10/refund-instruction/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/refund-instruction/CREATE` | Vlasnik, Direktor, Računovođa — *sastavljanje* zahteva (dopuna 4.9.2026) |
| `M10/refund-instruction/APPROVE`, `EXECUTE` | Vlasnik, Direktor — **nikad AI agent** (poglavlje 8.5.3) |
| `M10/payment-terms-config/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/payment-terms-config/EDIT` | Vlasnik, Direktor — menja globalnu politiku akontacije/balansa (poglavlje 5.4.1) |
| `M10/client-payment-schedule/VIEW` | Vlasnik, Direktor, Računovođa, Prodajni agent (svi podrazumevano, isti `VIEW_ALL` obrazac kao M5 poglavlje 6.6/M1 §3.9a) |
| `M10/supplier-invoice-import/VIEW`, `CREATE` | Vlasnik, Direktor, Računovođa — `CREATE` pokreće upload/ekstrakciju (i AI agent, nivo "Autonomno" — samo ekstrakcija, poglavlje 8.6.4) |
| `M10/supplier-invoice-import/REVIEW` | Vlasnik, Direktor, Računovođa — potvrda/ručno mapiranje reda i upis u `SupplierObligation` — **nikad AI agent** (poglavlje 8.6.4) |

---

## 10. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/finance`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/fiscal-documents/draft` | POST | priprema nacrt iz `booking_id` (sme AI agent, i sistem sam po `booking.confirmed`, poglavlje 6.0), automatski određuje `vat_calculation_basis` iz `Booking.tip_nastupanja` (poglavlje 4.4) |
| `/fiscal-documents/credit-note/draft` | POST | priprema `KNJIZNO_ODOBRENJE` nacrt iz `credited_rebate_id` (M7 `CommissionRebate`, poglavlje 5.1a) — zaseban endpoint jer nema `booking_id` |
| `/fiscal-documents/:id/submit` | POST | šalje ka SEF/ESIR — zahteva `M10/fiscal-document/SUBMIT`, samo ljudski nalog |
| `/fiscal-documents/:id` | GET | |
| `/fiscal-documents/:id/storno` | POST | pokreće storno tok |
| `/payments` | GET / POST | pregled / ručan unos prijema uplate (`BANK_TRANSFER`/`CASH`, bez sistemskog limita gotovine — poglavlje 5.2) |
| `/payments/card/initiate` | POST | pokreće `PaymentGatewayAdapter.initiatePayment` za dati `quote_id` |
| `/payments/card/webhook` | POST | povratni poziv provajdera — jedini način na koji se `CARD` uplata beleži kao `RECEIVED`; zahteva `x-payment-webhook-signature` (poglavlje 7.2, dopuna 28.8.2026) |
| `/exchange-rates` | GET / POST | pregled / unos dnevnog kursa |
| `/supplier-obligations` | GET / POST | pregled / kreiranje obaveze prema dobavljaču |
| `/supplier-obligations/:id/approve` | POST | zahteva `M10/supplier-obligation/APPROVE`; odbija ako `booking_item_id` nije popunjen |
| `/supplier-obligations/:id/pay` | POST | beleži plaćanje, izračunava `exchange_rate_difference` |
| `/reconciliation/mismatches` | GET | lista `Booking` zapisa koji ne prolaze proveru iz poglavlja 5.3 (nedostaje uplata i/ili fiskalni dokument) |
| `/supplier-payment-instructions` | GET / POST | pregled (`VIEW`) / kreiranje instrukcije za isplatu (`CREATE`, poglavlje 8.5.2) |
| `/supplier-payment-instructions/:id/execute` | POST | zahteva `M10/supplier-payment-instruction/EXECUTE`, samo ljudski nalog |
| `/refund-instructions` | GET / POST | pregled (`VIEW`) / kreiranje zahteva za refundaciju van kartičnog toka (`CREATE`, poglavlje 8.5.3) |
| `/refund-instructions/:id/approve` | POST | zahteva `M10/refund-instruction/APPROVE` |
| `/refund-instructions/:id/execute` | POST | zahteva `M10/refund-instruction/EXECUTE`, dozvoljeno samo posle `APPROVED` |
| `/payment-terms-config` | GET / PUT | pregled / izmena globalne politike akontacije i balansa (poglavlje 5.4.1), zahteva `M10/payment-terms-config/EDIT` za `PUT` |
| `/client-payment-schedules` | GET | lista, filtrirano po `booking_id`/`deposit_status`/`balance_status` (poglavlje 5.4.2) |
| `/supplier-invoice-imports` | GET / POST | pregled / upload fajla, pokreće AI ekstrakciju (poglavlje 8.6.1), zahteva `M10/supplier-invoice-import/CREATE` |
| `/supplier-invoice-imports/:id` | GET | detalji uvoza sa svim `SupplierInvoiceImportRow` redovima |
| `/supplier-invoice-imports/:id/rows/:rowId/confirm` | POST | potvrđuje predloženo (ili ručno zadato) mapiranje, upisuje u `SupplierObligation` — zahteva `M10/supplier-invoice-import/REVIEW` |
| `/supplier-invoice-imports/:id/rows/:rowId/reject` | POST | odbacuje red bez efekta na finansijske zapise |

---

## 11. Izlazni kriterijum (M10 deo Faze 2)

- [x] Za rezervaciju sa pravnim licem kao nalogodavcem, sistem automatski bira `SEF_EFAKTURA`; za fizičko lice, `ESIR_RACUN`. *(dokazano e2e testom, avgust 2026)*
- [x] Nacrt fiskalnog dokumenta ispravno konvertuje iznos u RSD po NBS srednjem kursu na dan uplate; ako uplata stigne posle pripreme nacrta, `amount_rsd` se ispravno preračunava pre `SUBMIT`-a (poglavlje 3). *(dokazano unit testom — prepareDraft EUR konverzija i submit() preračun kad je booking u međuvremenu PAID po drugačijem kursu; RSD prolaz bez konverzije dodatno dokazan e2e testom)*
- [x] `vat_calculation_basis` se ispravno određuje iz `Booking.tip_nastupanja` (`MARZA` za organizatora, `PROVIZIJA` za posrednika), i PDV se obračunava po formuli iz poglavlja 4. *(dokazano unit + e2e testom; "bez posebnog iskazivanja PDV-a gostu" je strukturno tačno — nijedan API odgovor ne izlaže PDV odvojeno gostu, samo internom Računovođa/Direktor/Vlasnik uvidu)*
- [x] Pokušaj izmene `Booking.tip_nastupanja` posle kreiranja rezervacije se odbija. *(strukturno zagarantovano — `ModifyBookingDto` (M5) ne izlaže ovo polje, `tipNastupanja` se piše isključivo jednom, u `BookingsService.confirmQuote`, nijedan drugi poziv ga ne dodiruje)*
- [x] Slanje (`SUBMIT`) je fizički nemoguće bez ljudskog naloga — pokušaj preko API-ja bez odgovarajuće dozvole/uloge se odbija. *(dokazano e2e testom — 403 bez M10/fiscal-document/SUBMIT dozvole)*
- [x] Svaki `SUBMIT` i `STORNO` upisan je u M1 audit log sa identitetom osobe koja je potvrdila. *(SUBMIT dokazano e2e čitanjem stvarnog AuditLogEntry; STORNO dokazano unit testom, isti kod obrazac)*
- [ ] `buyer_acceptance_deadline` se ispravno postavlja na 15 dana od slanja SEF fakture — **dokazano** (e2e i unit test). Prelazak statusa u `EXPIRED` kad kupac ne odgovori u roku — **nije implementirano**: nema periodičnog posla koji proverava istekle rokove i menja `buyer_acceptance_status`; ostaje za sledeći prolaz.
- [ ] Prijem uplate (delimičan i pun iznos) ispravno ažurira `payment_status` na Booking-u u M5 — **dokazano** e2e testom (pun iznos → PAID) i unit testom (delimičan → PARTIALLY_PAID). Da prelazak u `PAID` stvarno pokreće generisanje vaučera — **nije posebno provereno u ovoj sesiji**: `PaymentsService` poziva istu `BookingsService.updatePaymentStatus` funkciju koju M5 već koristi i koja interno zove `maybeIssueVoucher` (M5 spec §6), ali lanac do stvarno izdatog vaučera nije ovde e2e testiran.
- [x] Nijedan broj kartice se nigde ne čuva — sistem drži samo `gateway_transaction_id`/token. *(strukturno zagarantovano — `Payment` model nema nijedno polje predviđeno za broj kartice, samo `gatewayTransactionId`/`gatewayIdempotencyKey`; nije pisan poseban test koji greba bazu/logove za obrazac broja kartice)*
- [x] Test: kartično plaćanje uspe, ali M5 potvrda rezervacije zatim ne uspe (simuliran nestanak kapaciteta) → `Payment` prelazi u `VOIDED`, novac se automatski vraća. *(dokazano unit testom, `PaymentsService.handleCardWebhook`)*
- [x] Ponovljen klik/mrežni prekid pri kartičnom plaćanju (isti `gateway_idempotency_key`) ne rezultuje duplom naplatom. *(dokazano unit testom nad `MockPaymentGatewayAdapter` — isti ključ vraća istu transakciju; i nad `PaymentsService.handleCardWebhook` — ponovljen webhook je idempotentan)*
- [x] `SupplierObligation` ne može preći u `APPROVED` bez popunjenog `booking_item_id`. *(dokazano unit + e2e testom)*
- [x] Alarm 5 dana pre `due_date` neplaćene obaveze prema dobavljaču se ispravno generiše. *(dokazano unit testom, `M10AlarmsService`/`SupplierObligationsService.findDueSoon`)*
- [x] `exchange_rate_difference` se ispravno izračunava pri plaćanju obaveze kad se kurs na dan fakture razlikuje od kursa na dan plaćanja. *(dokazano unit + e2e testom)*
- [x] Nijedno novčano polje (`amount_original`, `amount_rsd`, `vat_amount`, `amount`, `amount_rsd_at_invoice`, `exchange_rate_difference`) nije tipa `decimal`/float. *(garantovano Prisma šemom — sva navedena polja su `Int`; kursevi (`nbsMiddleRate`) i procenti (`vatRate`, `depositPercentage`) ostaju `Decimal`, u skladu sa izuzetkom iz poglavlja 3.2)*
- [x] Test-slučaj: potvrđena rezervacija bez izdatog fiskalnog dokumenta se ispravno prepoznaje kroz `/reconciliation/mismatches`. *(dokazano unit testom, `ReconciliationService`; `reconciliation_mismatch` Event Bus signal sad ima stvarnog pretplatnika — M18 `M18EventSubscribersService` kreira `HealthSignal(RECONCILIATION_MISMATCH)`, avgust 2026)*
- [x] `SupplierPaymentInstruction.status` ne može preći u `EXECUTED` bez ljudskog naloga (`executed_by` popunjen). *(dokazano unit testom; AI agent nema dozvolu `M10/supplier-payment-instruction/EXECUTE` — nije dodeljena nijednoj ulozi koju AI agent nalog koristi)*
- [x] `RefundInstruction` ne može preći u `EXECUTED` bez prethodnog `APPROVED`. *(dokazano unit testom)*
- [ ] Broj kartice se nigde ne pojavljuje u `virtual_card_reference` — **nije programski sprovedeno**: polje je slobodan string, ništa ne sprečava da neko unese pun broj kartice; oslanja se na proces (isti otvoren rizik kao ograničenje gotovine u poglavlju 5.2), ne na kod. Ostaje otvorena stavka.
- [x] `FiscalDocument` nacrt se automatski priprema (bez ručnog poziva) čim `Booking` pređe u `CONFIRMED`. *(dokazano unit testom, `M10EventSubscribersService` — pretplata na M5 `booking.confirmed`; sam LISTEN/NOTIFY transportni sloj dokazan zasebno u `EventListenerService` testovima, nije ponovo testiran ovde da bi se izbegla flaky async e2e provera)*
- [x] `SupplierObligation` se automatski kreira sa popunjenim `booking_item_id` čim `BookingItem` (CONTRACTED) pređe u `item_status = CONFIRMED`; API-sourced stavke ne generišu ovaj zapis pojedinačno. *(dokazano unit testom)*
- [x] `FiscalDocument` u statusu `DRAFT` duže od 24h generiše `HealthSignal`. *(dokazano unit testom, `M10AlarmsService`/`FiscalDocumentsService.findStaleDrafts`)*
- [x] `KNJIZNO_ODOBRENJE` dokument se ispravno priprema sa `booking_id = null` i popunjenim `related_subagent_id`/`credited_rebate_id`. *(dokazano unit testom, `prepareCreditNoteDraft`)*
- [x] Odobren M7 `CommissionRebate` (`DRAFT → APPROVED`) automatski pokreće M10 `KNJIZNO_ODOBRENJE` nacrt sa stvarnim `buyer_name_snapshot` (M6 `ClientAccount.company_name`); slanje tog dokumenta (M10 `submit()`) vraća M7 rabat u `APPLIED` preko Event Bus-a. *(dopuna avgust 2026 — stvarno povezivanje sa M7, ranije čekalo M7 implementaciju, vidi poglavlje 1.1/5.1a; dokazano unit testovima na obe strane i e2e kraj-do-kraja u `apps/api/test/m7-exit-criteria.e2e-spec.ts`)*
- [x] `ClientPaymentSchedule` se automatski kreira po `booking.confirmed`, sa snimljenim vrednostima iz `PaymentTermsConfig` u tom trenutku; kasnija izmena politike ne menja retroaktivno već kreirane rasporede. *(dokazano unit testom — snapshot je strukturno zagarantovan, vrednosti se kopiraju u red, ne referenciraju FK ka konfiguraciji)*
- [x] Probijen `deposit_due_date`/`balance_due_date` generiše `HealthSignal` tipa `PAYMENT_DEADLINE_MISSED` sa `severity = WARNING`, eskalira na `CRITICAL`, bez automatske izmene rezervacije. *(dokazano unit testom, `ClientPaymentSchedulesService.checkOverdueAndEscalate`)*
- [x] Deterministički matching algoritam (§8.6.3) predlaže mapiranje ka `SupplierObligation` sa `match_confidence ≥ 85%`, odbija kandidate bez preklapanja perioda ili sa nedovoljnim poklapanjem imena. *(dokazano unit testom, `findBestSupplierObligationMatch`)* **Ograda, isti obrazac kao M3 `PricelistImport` §4.2.1:** stvarna AI ekstrakcija (OCR/parsiranje ulazne fakture koja bi kreirala `SupplierInvoiceImportRow` zapise) namerno nije povezana — čeka odluku o AI provajderu, isti gap kao M3.
- [x] Potvrda reda (`CONFIRMED`/`MANUALLY_MATCHED`) ispravno upisuje `invoice_reference` i po potrebi koriguje `amount_original`/`amount_rsd_at_invoice`, samo uz ljudsku potvrdu — nijedan `SupplierObligation` se ne menja automatski. *(dokazano unit testom, `confirmRow`)*
- [x] **E2E test `§5.2 — uplata dovodi Booking do PAID` prolazi.** *(pao 3–4.9.2026, rešeno 4.9.2026 — paket prolazi 6/6.*

  ***Stvaran uzrok (drugačiji od prvobitne pretpostavke):** lokalna razvojna baza bila je zastarela u odnosu na `apps/api/prisma/seed/seed.ts`. Ispravka od 3.9.2026 — dodavanje `M5/booking/VIEW` i `M5/booking/VIEW_ALL` ulozi `RACUNOVODJA`, jer M10 `recordManualPayment` → `onBookingPaymentReceived` interno poziva M5 `BookingsService.updatePaymentStatus`, koja sprovodi sopstvenu proveru vlasništva (`assertBookingAccessible`) — upisana je u seed skriptu, ali seed nije ponovo pokrenut nad već zasejanom bazom. Računovođa je u bazi i dalje imao nula M5 dozvola, pa je `updatePaymentStatus` vraćao `404 Rezervacija nije pronađena.` Rešeno pokretanjem `npx prisma db seed` (skripta je u celosti `upsert`, bez brisanja — bezbedna nad postojećim podacima). Nijedna izmena koda nije bila potrebna.*

  ***Zašto je prvobitna dijagnoza promašila:** zaključak "problem je u `createConfirmedBookingFixture()`" izveden je iz pretpostavke da je jedini `404` na toj putanji onaj iz `payments.service.ts` ("Booking ... nije pronađen"). Stvarna poruka u odgovoru bila je "Rezervacija nije pronađena." — iz sasvim drugog modula (`m5-rezervacije/bookings/bookings.service.ts`). Ispisivanje `res.body` (a ne samo statusa) vodilo je do uzroka u jednom prolazu. Zamka 12.4 u `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md`.)*
- [x] API dokumentacija (`docs/api/M10-finansije.md`) postoji sa primerima zahteva/odgovora za svaki endpoint iz poglavlja 10 — obavezna stavka po CLAUDE.md. *(napisana 3.9.2026; fiskalni dokument i kursna lista uhvaćeni stvarnim pozivima nad lokalnom bazom, ostali odeljci izvedeni iz koda jer su tabele `payments`/`supplier_obligations`/`banks`/`refund_instructions` prazne — svaki takav odeljak je u dokumentu označen)*
- [x] **Kreiranje naloga za isplatu dobavljaču i naloga za povraćaj gostu traži dozvolu jaču od `VIEW`.** *(rešeno 4.9.2026: uvedene `M10/supplier-payment-instruction/CREATE` i `M10/refund-instruction/CREATE`, dodeljene Vlasniku/Direktoru/Računovođi; `POST /finance/supplier-payment-instructions` i `POST /finance/refund-instructions` sada traže njih umesto `VIEW`. Izvršenje (`EXECUTE`) i odobrenje (`APPROVE`) ostaju nepromenjeni — Vlasnik/Direktor, nikad AI agent. Dokazano e2e testom: nalog sa samo `VIEW` dobija 403 na kreiranje, a i dalje vidi listu)*

---

## 12. Otvoreno za dalje

- **Izmena uplate ne spušta `Booking.payment_status` naniže** (2.9.2026, poglavlje 5.2b, otkriveno pri implementaciji) — `PATCH /finance/payments/:id` koji smanji `amount` posle prethodno dostignutog `PAID` statusa ne vraća rezervaciju na `PARTIALLY_PAID`/`UNPAID`; posledice niz tok (vaučer već generisan po M5 poglavlju 6) nisu razmotrene. Odlučiti da li spuštanje treba biti automatsko ili zahteva svesnu ljudsku radnju pre implementacije.
- **AI ekstrakcija konačne fakture treba da čita i status plaćanja sa samog dokumenta, ne samo iznos** (podsetnik vlasnika, 29.8.2026: "kada dobijemo konačni račun od dobavljača i kada ga uvučemo u TT (skeniranjem ili uploadovanjem) TT treba da bude sposoban da vidi konačno zaduženje i status (plaćeno, neplaćeno, delimično) i da uporedi sa stanjem u TT"). Ovo je dopuna već postojećeg §8.6 (`SupplierInvoiceImport`/`SupplierInvoiceImportRow`) — sam mehanizam (upload/skeniranje → AI ekstrakcija → determinističko mapiranje ka `SupplierObligation` → čovek potvrđuje upis, §8.6.3/8.6.4) je već specificiran i namerno čeka izbor AI provajdera (vidi izlazni kriterijum, poglavlje 11, "stvarna AI ekstrakcija ulazne fakture"). Dve konkretne stvari koje TREBA dodati kad se taj deo bude radio, a danas nisu pokrivene:
  1. `SupplierInvoiceImportRow` (§8.6.2) danas ekstrahuje samo iznos/valutu/referencu fakture, ne i status plaćanja koji dokument sam navodi (npr. dobavljačev izvod stanja koji kaže "delimično plaćeno") — treba novo polje `extracted_payment_status` (isti enum stil kao ostatak dokumenta).
  2. `SupplierObligation.status` (§8.1) danas ima samo `PENDING/APPROVED/PAID/DISPUTED` — **nema `PARTIALLY_PAID`**, pa poređenje "stanje na fakturi dobavljača" naspram "stanje u TT" nema gde da prikaže neslaganje kad je dobavljač delimično plaćen. Dodati vrednost enuma i pravilo kad se u nju prelazi (verovatno: delimična uplata evidentirana kroz M10 poglavlje 8.5 isplate).
  - Poređenje samo po sebi (dokument kaže X, TT ima Y → neslaganje) prirodno se uklapa u već postojeći `reconciliation_mismatch` Event Bus signal (poglavlje 5.3) — isti mehanizam, primenjen i na ovaj slučaj, ne nov signal.
  - Vlasnikova napomena "možemo uzorcima da naučimo AI agenta da prepozna a kod da nastavi dalje" opisuje TAČNO već odabran obrazac iz §8.6.4 (ekstrakcija = "Autonomno", upis u obavezu = "Predloži pa čovek odobri") — nema promene nivoa autonomije, samo potvrda da je pristup usklađen sa onim što vlasnik zamišlja.
  - **Dopuna (29.8.2026)** — vlasnik pitao da li se ulazni fajl (§8.6.1 `source_file_url`) može dobiti prosleđivanjem mejla umesto štampanja/skeniranja/ručnog uploada. Odgovor: da, prirodno se uklapa (`source_format = EMAIL` već postoji u enumu, §8.6.1) — predlog i preduslovi (M22 danas nema pojam priloga na mejl poruci; predloženo novo, posebno sanduče npr. `racuni@`, ne prošireno sanduče za najave rezervacija) upisani u M22 spec §10/v1.6, ovde samo unakrsna referenca. `SupplierInvoiceImport` sam ne razlikuje da li je `source_file_url` stigao uploadom ili automatskim prosleđivanjem iz M22 — isti zapis, isti tok ekstrakcije/potvrde, bez izmene ovog poglavlja.

- **`buyer_acceptance_status → EXPIRED` prelazak nije implementiran** (avgust 2026, otkriveno pri implementaciji, poglavlje 6/11) — `buyer_acceptance_deadline` se ispravno računa (15 dana od slanja), ali ne postoji periodični posao koji proverava istekle rokove i menja status; treba dodati u isti `M10AlarmsService` @Cron kao ostali alarmi (poglavlje 6.2/8.2) kad se ovaj deo bude implementirao.
- **`virtual_card_reference` nema programsku zaštitu od unosa punog broja kartice** (avgust 2026, otkriveno pri implementaciji, poglavlje 8.5.2/11) — polje je slobodan string; oslanja se na proceduru tima, isti karakter otvorenog pitanja kao ograničenje gotovine (poglavlje 5.2) — razmotriti masku/validaciju formata (npr. odbaci ako izgleda kao 13-19-cifreni broj) kad se konkretan platni provajder izabere.
- Tačan tehnički ugovor sa SEF v4.0.0 i sa izabranim sertifikovanim ESIR/fiskalnim rešenjem — potvrditi sa knjigovođom pre implementacije ovog dela (poglavlje 6).
- ~~Automatski dnevni uvoz NBS kursa (`ExchangeRateSnapshot.source = NBS_API`)~~ **Rešeno (avgust 2026)** — implementirano preko javne NBS stranice (privremeno, vidi izmenu verzije). Ostaje otvoreno: prelazak na zvaničan SOAP veb-servis NBS čim registracija bude sređena (administrativni korak, ne tehnički) — trenutna javna stranica nema ugovoreni format i može se promeniti bez najave.
- **Kursna lista nema ekran u panelu** (zatečeno 6.9.2026 pri dopuni §3.1a, nije nastalo tom dopunom) — postoje `GET`/`POST /finance/exchange-rates`, ali nijedan ekran u M17 ih ne prikazuje: kurs se danas ne može ni videti ni ručno uneti kroz interfejs, samo pozivom API-ja. Dok automatski uvoz radi, to se ne primećuje; primetiće se tačno onda kad zakaže, a to je i jedini trenutak kad ručni unos treba. Mali ekran (lista + forma za unos) rešava oboje.
- **Ograničenje gotovine (AML)** — sistemska tvrda blokada uklonjena na zahtev vlasnika (poglavlje 5.2); potvrditi sa pravnikom da li je ručna procedura tima dovoljna za usklađenost sa Zakonom o sprečavanju pranja novca, ili treba vratiti bar meko upozorenje u interfejsu.
- **Kurs pri više uplata u različitim danima** (avans + balans, poglavlje 3) — tačno pravilo za koji kurs se koristi kad se ista faktura naplati u više navrata sa različitim kursom zahteva potvrdu knjigovođe pre implementacije.
- Izbor konkretnog PCI-DSS platnog provajdera (poglavlje 7) — treba potvrditi koji provajder podržava RSD i lokalne kartice/banke pre implementacije `PaymentGatewayAdapter`.
- **Granični slučajevi PDV po sistemu marže** (poglavlje 4.4) — mešoviti aranžmani, samostalna prodaja usluge van paketa — zahtevaju potvrdu knjigovođe pre implementacije.
- **Pravna posledica `buyer_acceptance_status = EXPIRED`/`REJECTED`** kod SEF fakture (da li se automatski pokreće neka dalja radnja, ili samo upozorava tim) — potvrditi sa knjigovođom/pravnikom, ista ograda kao za SEF tehnički ugovor.
- **BSP poravnanje** (poglavlje 8.4) — tačan mehanizam agregacije i knjiženja definiše se kad M4 dobije avio/GDS adapter, ne pre toga.
- Da li i kako se obaveze prema dobavljačima koji nisu iz M3 (npr. operativni troškovi agencije van turističke nabavke) uklapaju u `SupplierObligation`, ili ostaju van obima M10 — trenutno `SupplierObligation` pretpostavlja da je svaki dobavljač iz M3 registra; van-M3 troškovi (računovodstveni, kancelarijski) nisu u obimu ove specifikacije.
- **Izbor platnog provajdera za `VIRTUAL_CARD` isplate dobavljačima** (poglavlje 8.5.2) — treba potvrditi da li isti PCI-DSS provajder iz poglavlja 7 pokriva i izdavanje virtuelnih kartica ka dobavljačima, ili je potreban drugi ugovor; do tada `payment_method = BANK_TRANSFER` ostaje podrazumevan i jedini praktično dostupan put.
- **Tačan tehnički format kojim SEF prihvata `KNJIZNO_ODOBRENJE`** (poglavlje 5.1a) — zaseban dokument tip, redovna e-faktura sa negativnim iznosom, ili treći mehanizam — potvrditi sa knjigovođem pre implementacije, isto obrazloženje kao SEF/ESIR tehnički ugovor (poglavlje 6.3).
- **FX rizik kod `BANK_TRANSFER` isplata u stranoj valuti** — da li agencija otvara devizni račun ili svaka isplata ide kroz konverziju banke u trenutku transfera; ovo utiče na to da li `exchange_rate_difference` (poglavlje 8.1) ostaje dovoljan mehanizam ili treba dopuna — potvrditi sa knjigovođom pre implementacije poglavlja 8.5, isto obrazloženje kao ograda u poglavlju 6.3.
- **Zakon o zaštiti potrošača — rok povraćaja novca** (istraživanje, avgust 2026; upisano ovde 19.8.2026 posle nalaza da je stavka do sada postojala samo u backlog indeksu, ne i u izvornoj specifikaciji) — `RefundInstruction` (poglavlje 8.5.3) prati status (`PENDING → APPROVED → EXECUTED`) ali nema rok/deadline polje niti alarm; zakon (prema istraženim izvorima, potrebna potvrda pravnika) navodno traži povraćaj u roku od 14 dana od otkazivanja. Isti obrazac kao `buyer_acceptance_deadline` (poglavlje 6) samo primenjen na refundaciju — mehanička dopuna kad se rok potvrdi. Detalji: `docs/analize/26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` stavka B12.
