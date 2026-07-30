# Specifikacija modula M10 — Finansije i računovodstvo

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M10), poglavlje 8 (Faza 2) i Dodatak A (nalaz od 28.7.2026. o SEF-u)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda knjigovođe/pravnika pre implementacije (poglavlje 8 ovog dokumenta)
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodato kartično plaćanje (poglavlje 6), zatraženo pri specifikaciji M8
**Zavisi od:** M1, M5. Formalno i od M6/M7 (poglavlje 4 Master dokumenta) — vidi napomenu o redosledu niže.

---

## 1. Svrha i obim modula

M10 pretvara potvrđenu rezervaciju (M5) u zakonski važeći fiskalni dokument (SEF e-faktura za B2B, ESIR fiskalni račun za B2C), prati naplatu, i drži osnovne finansijske izveštaje. Van obima: dublja poslovna analitika (to je M13, read-only nad svim modulima), i eTurista/boravišna taksa prijava nadležnima (to je M11 — iako se taksa *naplaćuje* kroz M10 kao stavka na dokumentu, njeno *prijavljivanje* državi je M11 posao, poglavlje 9 ovog dokumenta).

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

Svaki `FiscalDocument` čuva i originalni iznos (iz `Booking.total_price`, u izvornoj valuti) i RSD iznos, izračunat po `nbs_middle_rate` **na dan prometa** (dan izdavanja dokumenta, standardna računovodstvena praksa u Srbiji) — ne na dan rezervacije ako se ta dva datuma razlikuju.

---

## 4. Model podataka

### 4.1 `FiscalDocument`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK), interni | |
| booking_id | UUID (FK → M5 Booking) | |
| document_type | enum: `SEF_EFAKTURA`, `ESIR_RACUN` | vidi poglavlje 2 |
| status | enum: `DRAFT`, `SUBMITTED`, `ISSUED`, `REJECTED`, `STORNIRANO` | vidi poglavlje 5 — `SUBMITTED` je nepovratan korak |
| external_reference | string, nullable | broj fakture kod SEF-a ili fiskalni broj/QR kod ESIR-a — **ovo je pravno merodavan identifikator, ne interni `id`** |
| amount_original / currency_original | decimal / string | iz Booking-a |
| amount_rsd | decimal | posle konverzije (poglavlje 3) |
| vat_rate / vat_amount | decimal | |
| exchange_rate_snapshot_id | UUID (FK), nullable | koji kurs je korišćen, radi sledljivosti |
| buyer_name_snapshot | string | ime/naziv nalogodavca (iz M6) u trenutku slanja — dodato u M6 specifikaciji, poglavlje 6/8, jer fiskalni dokument mora ostati istorijski tačan i ako se profil nalogodavca kasnije promeni |
| buyer_tax_id_snapshot | string, nullable | PIB u trenutku slanja, ako je pravno lice |
| pdf_url / xml_url | string, nullable | lokalna kopija konačnog dokumenta (EU cloud skladište) — SEF/ESIR ostaju pravni izvor istine, ovo je samo naša arhiva |
| submitted_by | UUID (FK → M1 User) | **obavezno ljudski nalog — nikad AI agent, vidi poglavlje 5** |
| submitted_at / issued_at | timestamp | |

### 4.2 `Payment`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), nullable | **nullable** — kod kartičnog plaćanja uplata se pokreće pre nego što rezervacija uopšte postoji (vidi poglavlje 6.2); popunjava se čim/ako se rezervacija uspešno potvrdi |
| quote_id | UUID (FK → M5 Quote), nullable | popunjeno za kartično plaćanje dok `booking_id` još ne postoji |
| amount / currency | decimal / string | |
| method | enum: `BANK_TRANSFER`, `CASH`, `CARD` | |
| status | enum: `PENDING`, `RECEIVED`, `FAILED`, `REFUNDED`, `VOIDED` | `VOIDED` — kartica naplaćena, ali booking potvrda ipak nije uspela (vidi 6.2), iznos se automatski poništava/vraća |
| reference | string, nullable | poziv na broj / izvod banke — za `BANK_TRANSFER`/`CASH` |
| gateway_provider | string, nullable | naziv sertifikovanog PCI-DSS platnog provajdera — samo za `CARD` |
| gateway_transaction_id | string, nullable | referenca transakcije kod provajdera — samo za `CARD` |
| gateway_idempotency_key | string, nullable | sprečava duplu naplatu pri ponovljenom pozivu — samo za `CARD` |
| received_at | timestamp, nullable | |
| recorded_by | UUID (FK → M1 User), nullable | ko je ručno uneo prijem uplate — **null za `CARD`**, jer se ta uplata beleži automatski preko povratnog poziva (webhook) provajdera, ne ručno |

Kad zbir `RECEIVED` uplata za `booking_id` dostigne `Booking.total_price`, M10 poziva M5 `PATCH /bookings/:id/payment-status` sa `PAID`; delimičan iznos → `PARTIALLY_PAID`.

---

## 5. Fiskalizacija — obavezno ljudsko odobrenje (Nikad autonomno)

U skladu sa poglavljem 7 Master dokumenta ("Nikad autonomno — fiskalizacija"), tok je strogo dvostepen:

1. **Priprema nacrta** (`FiscalDocument.status = DRAFT`) — ovo AI agent sme da radi samostalno: popunjava iznose, PDV, konverziju valute, tip dokumenta. Nulti rizik jer ništa još nije poslato nikome spolja.
2. **Slanje** (`DRAFT → SUBMITTED`) — **isključivo čovek** (Računovođa, Direktor ili Vlasnik) potvrđuje i pokreće stvarno slanje ka SEF-u/ESIR-u. Ovaj korak je nepovratan (kreira pravni dokument) i mora biti eksplicitna radnja u interfejsu ("Potvrdi i pošalji fakturu"), ne automatski okidač. Upisuje se u M1 audit log sa `actor_type = HUMAN`.

**SEF specifičnost (Dodatak A, nalaz 28.7.2026):** od 1. aprila 2026. faktura se kreira **unutar same SEF platforme** — naš poziv ka SEF API-ju pri koraku "Slanje" je čin kreiranja pravnog dokumenta, ne naknadna prijava već postojeće fakture. `external_reference` i konačan `xml_url` dobijaju se tek kao odgovor SEF-a na taj poziv.

**Napomena — tačan tehnički ugovor sa SEF-om i ESIR-om nije deo ove specifikacije.** SEF verzija 4.0.0 (objavljena 2.7.2026) je u vreme pisanja ovog dokumenta još u demo okruženju; tačna polja, format XML-a i način autentikacije prema SEF-u i prema sertifikovanom ESIR/fiskalnom uređaju moraju se potvrditi sa knjigovođom i zvaničnom tehničkom dokumentacijom SEF-a **neposredno pre implementacije ovog dela**, ne pretpostaviti unapred — ovo je jedan od domena gde Master dokument (poglavlje 1.2) eksplicitno predviđa uključivanje ljudskog stručnjaka.

### 5.1 Storno/otkazivanje fiskalnog dokumenta
Ako se rezervacija otkaže (M5) posle izdavanja fiskalnog dokumenta, kreira se novi `FiscalDocument` sa `document_type` istim kao original i `status` tokom kroz `DRAFT → SUBMITTED → STORNIRANO`, referencirajući originalni dokument — storno ide kroz isti sistem (SEF/ESIR), nikad se originalni dokument ne briše niti menja lokalno.

---

## 6. Kartično plaćanje

Poglavlje 9 Master dokumenta je kartično plaćanje tretiralo kao buduću mogućnost, ali je pri specifikaciji M8 (sajt) potvrđeno da je potrebno od starta — bez njega gost ne može samostalno da završi rezervaciju na sajtu (M10 do sad je podržavao samo bankovni prenos i keš, što zahteva ljudski kontakt posle rezervacije).

### 6.1 Arhitektura — sertifikovan provajder, mi nikad ne vidimo broj kartice

Koristi se **hostovana forma za plaćanje (hosted checkout)** sertifikovanog PCI-DSS platnog provajdera — gost unosi broj kartice direktno na stranici/frejmu provajdera, nikad na našem serveru ili u našoj bazi. Ovim platforma ostaje u najlakšoj kategoriji PCI-DSS usklađenosti (SAQ A), jer podaci kartice nikad fizički ne prolaze kroz naš sistem — mi dobijamo samo token/referencu transakcije.

Konkretan provajder (npr. bankarski gateway ili međunarodni servis koji podržava RSD i srpsko tržište) bira se pri implementaciji — ovaj dokument definiše generički `PaymentGatewayAdapter` interfejs, isti obrazac kao `ProviderAdapter` u M4, tako da promena provajdera kasnije ne zahteva izmenu ostatka sistema:

```
interface PaymentGatewayAdapter {
  initiatePayment(amount, currency, idempotencyKey): Promise<{ redirectUrl | clientToken, gatewayTransactionId }>;
  getPaymentStatus(gatewayTransactionId): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING", capturedAmount }>;
  refundOrVoid(gatewayTransactionId, amount): Promise<{ status }>;
}
```

### 6.2 Redosled — plaćanje pre potvrde rezervacije (samo za CARD/B2C)

Za razliku od `BANK_TRANSFER`/`CASH` (gde `Payment` uvek prati već postojeći `Booking`), kartično plaćanje na sajtu ide **pre** nego što rezervacija postoji, jer gost očekuje da mu kartica bude naplaćena u istom koraku u kom potvrđuje rezervaciju:

1. Gost na `Quote` klikne "Plati i rezerviši". M10 poziva `PaymentGatewayAdapter.initiatePayment` sa jedinstvenim `gateway_idempotency_key` (sprečava duplu naplatu ako gost dvaput klikne ili mreža "pukne" — isti princip kao idempotentnost u M4).
2. Provajder vrati uspeh → M10 kreira `Payment` sa `quote_id`, `status = RECEIVED`.
3. **Tek sad** M5 pokreće tok potvrde rezervacije iz svoje specifikacije (poglavlje 4, "sve ili ništa").
4. Ako M5 potvrda **uspe** — `Payment.booking_id` se popunjava, `Booking.payment_status = PAID`.
5. Ako M5 potvrda **ne uspe** (npr. kapacitet u međuvremenu prodat) — M10 odmah poziva `PaymentGatewayAdapter.refundOrVoid` i `Payment.status = VOIDED`. Gost dobija jasnu poruku i vraćen novac, bez rezervacije koja "visi" napola plaćena.

Ovo je namerno obrnut redosled u odnosu na `BANK_TRANSFER` (gde rezervacija ne čeka uplatu — poglavlje 4 M5 specifikacije, potvrđena odluka za B2B kredit) — za karticu na sajtu, plaćanje i potvrda su spregnuti u jednu neprekidnu radnju iz ugla gosta, ali sistem ih interno tretira kao dva koraka sa automatskim poništavanjem ako drugi ne uspe.

### 6.3 Zašto ovo nije "Nikad autonomno" transfer novca

Poglavlje 7 Master dokumenta zabranjuje AI agentu da autonomno prenosi novac. Ovo se ne odnosi na tok iz 6.2 — tu gost svojom voljom unosi karticu i plaća sopstvenu rezervaciju kroz sertifikovan provajder; sistem samo mehanički prosleđuje taj zahtev i beleži ishod (isti princip kao automatski poziv ka M4 ili automatska eTurista prijava u M11) — nijedan AI agent ne odlučuje da li i kome se novac prenosi.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M10/fiscal-document/VIEW` | Vlasnik, Direktor, Računovođa |
| `M10/fiscal-document/CREATE_DRAFT` | Vlasnik, Direktor, Računovođa (i AI agent, nivo "Autonomno" — samo nacrt) |
| `M10/fiscal-document/SUBMIT` | Vlasnik, Direktor, Računovođa — **nikad AI agent**, sprovedeno na nivou koda, ne samo dozvole |
| `M10/payment/VIEW`, `RECORD` | Vlasnik, Direktor, Računovođa — `RECORD` se odnosi samo na ručni unos (`BANK_TRANSFER`/`CASH`); `CARD` uplate beleži sistem automatski preko webhook-a, bez ove dozvole |
| `M10/exchange-rate/VIEW`, `EDIT` | Vlasnik, Direktor, Računovođa |
| `M10/payment-gateway-config/VIEW`, `EDIT` | Vlasnik, Direktor — podešavanje kredencijala platnog provajdera |

---

## 8. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/finance`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/fiscal-documents/draft` | POST | priprema nacrt iz `booking_id` (sme AI agent) |
| `/fiscal-documents/:id/submit` | POST | šalje ka SEF/ESIR — zahteva `M10/fiscal-document/SUBMIT`, samo ljudski nalog |
| `/fiscal-documents/:id` | GET | |
| `/fiscal-documents/:id/storno` | POST | pokreće storno tok |
| `/payments` | GET / POST | pregled / ručan unos prijema uplate (`BANK_TRANSFER`/`CASH`) |
| `/payments/card/initiate` | POST | pokreće `PaymentGatewayAdapter.initiatePayment` za dati `quote_id` |
| `/payments/card/webhook` | POST | povratni poziv provajdera — jedini način na koji se `CARD` uplata beleži kao `RECEIVED` |
| `/exchange-rates` | GET / POST | pregled / unos dnevnog kursa |

---

## 9. Izlazni kriterijum (M10 deo Faze 2)

- [ ] Za rezervaciju sa pravnim licem kao nalogodavcem, sistem automatski bira `SEF_EFAKTURA`; za fizičko lice, `ESIR_RACUN`.
- [ ] Nacrt fiskalnog dokumenta ispravno konvertuje iznos u RSD po NBS srednjem kursu na dan izdavanja.
- [ ] Slanje (`SUBMIT`) je fizički nemoguće bez ljudskog naloga — pokušaj preko API-ja bez odgovarajuće dozvole/uloge se odbija.
- [ ] Svaki `SUBMIT` i `STORNO` upisan je u M1 audit log sa identitetom osobe koja je potvrdila.
- [ ] Prijem uplate (delimičan i pun iznos) ispravno ažurira `payment_status` na Booking-u u M5.
- [ ] Nijedan broj kartice se nigde ne čuva — sistem drži samo `gateway_transaction_id`/token, provereno testom da se sirovi podaci kartice nikad ne pojavljuju u našim logovima ni bazi.
- [ ] Test: kartično plaćanje uspe, ali M5 potvrda rezervacije zatim ne uspe (simuliran nestanak kapaciteta) → `Payment` prelazi u `VOIDED`, novac se automatski vraća, gost dobija jasnu poruku, nijedna rezervacija nije kreirana.
- [ ] Ponovljen klik/mrežni prekid pri kartičnom plaćanju (isti `gateway_idempotency_key`) ne rezultuje duplom naplatom.

---

## 10. Otvoreno za dalje

- Tačan tehnički ugovor sa SEF v4.0.0 i sa izabranim sertifikovanim ESIR/fiskalnim rešenjem — potvrditi sa knjigovođom pre implementacije ovog dela (poglavlje 5.1 ovog dokumenta).
- Automatski dnevni uvoz NBS kursa (`ExchangeRateSnapshot.source = NBS_API`) — za sada je predviđeno i ručno unošenje kao alternativa dok se ne poveže automatski izvor.
- Boravišna taksa kao stavka na fiskalnom dokumentu — iznos se naplaćuje kroz M10, ali obaveza prijavljivanja nadležnima ide kroz M11; tačan način razmene podataka između ta dva modula definiše se kad M11 bude specificiran.
- Izbor konkretnog PCI-DSS platnog provajdera (poglavlje 6) — treba potvrditi koji provajder podržava RSD i lokalne kartice/banke pre implementacije `PaymentGatewayAdapter`.
