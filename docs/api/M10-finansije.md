# API dokumentacija — M10 (Finansije i računovodstvo)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski. Interni oslonac za implementaciju ostaje `docs/moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/finance`
**Autentikacija:** `Authorization: Bearer <JWT>` na svemu **osim** dva endpointa za kartično plaćanje (vidi taj odeljak).
**Novčani iznosi:** uvek `integer` u najmanjoj jedinici valute (`8000` = 80.00 RSD).

> **Ovo je modul sa zakonskim posledicama.** Fiskalni dokumenti (SEF e-faktura, ESIR račun) su dokumenti pred poreskom upravom. Poziv koji ih šalje nije tehnička radnja nego pravna. Pre nego što bilo šta automatizujete ovde, pročitajte ograde u tekstu — nekoliko njih postoji zato što je pogrešna automatizacija na ovom mestu prekršaj, ne bug.

**Verzija podataka u primerima:** primer fiskalnog dokumenta i kursne liste su **stvarno uhvaćeni** pozivima nad lokalnom bazom 3.9.2026. Ostali odgovori su izvedeni iz koda i modela — te tabele su prazne (`payments`, `supplier_obligations`, `banks`, `refund_instructions` imaju 0 redova), pa nema šta da se uhvati. Svaki takav odeljak je označen.

---

## Vrednosti nabrajanja

| Polje | Vrednosti |
| :---- | :---- |
| `documentType` | `SEF_EFAKTURA`, `ESIR_RACUN`, `KNJIZNO_ODOBRENJE` |
| `FiscalDocument.status` | `DRAFT`, `SUBMITTED`, `ISSUED`, `REJECTED`, `STORNIRANO` |
| `vatCalculationBasis` | `MARZA`, `PROVIZIJA`, `PUNA_OSNOVICA` |
| `buyerAcceptanceStatus` | `N/A`, `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `buyerType` | `FIZICKO_LICE`, `PRAVNO_LICE` |
| `Payment.method` | `BANK_TRANSFER`, `CASH`, `CARD`, `CARD_MANUAL`, `CHECK`, `ADMINISTRATIVE_BAN` |
| `PaymentStatus` | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `INVOICE_PENDING` |
| `SupplierObligation.status` | `PENDING`, `APPROVED`, `PAID`, `DISPUTED` |
| `SupplierPaymentInstruction.method` | `BANK_TRANSFER`, `VIRTUAL_CARD` |
| `SupplierPaymentInstruction.status` | `PENDING`, `EXECUTED`, `FAILED` |
| `RefundInstruction.method` | `BANK_TRANSFER`, `CASH` |
| `RefundInstruction.status` | `PENDING`, `APPROVED`, `EXECUTED`, `FAILED` |
| `ExchangeRate.source` | `NBS_API`, `MANUAL` |
| `sourceFormat` (uvoz faktura) | `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF` |

> **`CARD` naspram `CARD_MANUAL` nisu isto.** `CARD` nastaje isključivo automatski, kroz webhook platnog provajdera, i **ne može se ručno uneti ni izmeniti**. `CARD_MANUAL` je kartica provučena na POS terminalu u agenciji, koju zaposleni unosi ručno. Mešanje ta dva je najlakši način da se knjiga uplata razidje sa stvarnim prilivom.

---

## Fiskalni dokumenti

### POST /finance/fiscal-documents/draft
Dozvola: `M10/fiscal-document/CREATE_DRAFT`.

```json
{ "bookingId": "65a92e2c-fc39-465f-90ad-8fd502faf601" }
```

**Vrsta dokumenta se ne bira — određuje je kupac.** Ako je `buyerType` na rezervaciji `PRAVNO_LICE`, nastaje `SEF_EFAKTURA`; inače `ESIR_RACUN`. Namerno: izbor vrste dokumenta je zakonska posledica toga ko je kupac, ne stvar odluke operatera.

```json
{"message":"Booking 65a92e2c-... nije pronađen.","error":"Not Found","statusCode":404}
```

### POST /finance/fiscal-documents/credit-note/draft
Dozvola: `M10/fiscal-document/CREATE_DRAFT`. Knjižno odobrenje za rabat subagentu.

```json
{
  "relatedSubagentId": "sub-123",
  "creditedRebateId": "reb-456",
  "amount": 45000,
  "currency": "RSD",
  "buyerNameSnapshot": "Agencija Partner d.o.o."
}
```

### GET /finance/fiscal-documents/:id
Dozvola: `M10/fiscal-document/VIEW`.

**Odgovor `200` (stvarno uhvaćeno):**
```json
{
  "id": "6796c394-e401-41a4-ba18-f342a058747e",
  "bookingId": "65a92e2c-fc39-465f-90ad-8fd502faf601",
  "documentType": "ESIR_RACUN",
  "status": "SUBMITTED",
  "vatCalculationBasis": "MARZA",
  "stornoOfDocumentId": null,
  "externalReference": null,
  "amountOriginal": 8000,
  "currencyOriginal": "RSD",
  "amountRsd": 8000,
  "vatRate": "20",
  "vatAmount": 1333,
  "exchangeRateSnapshotId": null,
  "buyerNameSnapshot": "M14 Test Booking direktan event",
  "buyerTaxIdSnapshot": null,
  "buyerAcceptanceStatus": "N_A",
  "buyerAcceptanceDeadline": null,
  "pdfUrl": null,
  "xmlUrl": null,
  "submittedBy": "32c35e48-f208-48c8-80f1-b0f2dc1b9f0b",
  "submittedAt": "2026-08-14T20:35:15.125Z",
  "issuedAt": "2026-08-14T20:35:15.125Z",
  "relatedSubagentId": null,
  "creditedRebateId": null,
  "createdAt": "2026-08-14T20:35:15.126Z"
}
```

**Nema endpointa za listu fiskalnih dokumenata** — samo dohvatanje po `id`. Ako gradite pregled, `id`-jeve morate dobiti iz rezervacije (M5).

**Podaci o kupcu su „snimljeni", ne povezani.** `buyerNameSnapshot` i `buyerTaxIdSnapshot` su prepis stanja u trenutku izdavanja. Kad se gost sutra preimenuje ili promeni firmu, izdati dokument ostaje kakav je bio — zakonski mora.

`amountOriginal` je iznos u valuti u kojoj je prodato, `amountRsd` preračunato, `exchangeRateSnapshotId` upućuje na tačan kurs korišćen tog dana. Kad je prodaja već u RSD, kurs je `null`.

### POST /finance/fiscal-documents/:id/submit
Dozvola: `M10/fiscal-document/SUBMIT` (odvojena od `CREATE_DRAFT` — pravljenje nacrta i slanje su namerno različita ovlašćenja).

Radi **samo iz statusa `DRAFT`**:
```json
{"message":"FiscalDocument <id> nije u statusu DRAFT (status: SUBMITTED).","error":"Bad Request","statusCode":400}
```

### POST /finance/fiscal-documents/:id/storno
Dozvola: `M10/fiscal-document/SUBMIT`. Radi samo nad `SUBMITTED` ili `ISSUED` dokumentom.

**Storno ne briše ništa** — pravi nov dokument koji poništava prethodni, sa vezom `stornoOfDocumentId`. Izdat fiskalni dokument se ne može ukloniti iz evidencije, samo poništiti novim.

> **Ograda koja je namerna, ne propust:** tačan tehnički oblik komunikacije sa SEF-om i ESIR-om (polja, potpisi, način slanja) **nije izmišljen** u ovom sistemu. Specifikacija na više mesta izričito kaže da to zahteva potvrdu knjigovođe i zvaničnu dokumentaciju pre implementacije. Ono što danas postoji je model podataka i tok stanja; sam prenos ka poreskoj upravi nije povezan. Ne pretpostavljajte da `SUBMITTED` znači „stiglo u SEF".

---

## Uplate gostiju

> Odeljak izveden iz koda — tabela `payments` je prazna, nema šta da se uhvati.

### GET /finance/payments · GET /finance/payments/:id
Dozvola: `M10/payment/VIEW`. Lista prima filter `?bookingId=`.

### POST /finance/payments
Dozvola: `M10/payment/RECORD`. Ručan unos uplate.

**Obična uplata:**
```json
{ "bookingId": "65a92e2c-...", "amount": 45000, "currency": "RSD", "method": "BANK_TRANSFER", "bankId": "bank-1", "reference": "izvod 128/2027" }
```

**Koja polja su obavezna zavisi od načina plaćanja:**

| `method` | Dodatno obavezno |
| :---- | :---- |
| `BANK_TRANSFER`, `CARD_MANUAL` | `bankId` |
| `CHECK` | `checkDetails[]`, najmanje jedan |
| `CASH`, `ADMINISTRATIVE_BAN` | — |
| `CARD` | **ne prima se ovde uopšte** |

**Plaćanje čekovima:**
```json
{
  "bookingId": "65a92e2c-...",
  "amount": 90000,
  "currency": "RSD",
  "method": "CHECK",
  "checkDetails": [
    { "bankId": "bank-1", "amount": 45000, "checkNumber": "0012345", "clearanceDate": "2027-04-15" },
    { "bankId": "bank-1", "amount": 45000, "checkNumber": "0012346", "clearanceDate": "2027-05-15" }
  ]
}
```
Svaki ček nosi svoj datum realizacije — zato je to niz, a ne jedan iznos.

### PATCH /finance/payments/:id
Dozvola: `M10/payment/RECORD`. Ispravka pogrešno unete uplate (npr. omaška u broju čeka).

**Dve zaštite:**
```json
{"message":"Kartično plaćanje naplaćeno preko online provajdera (automatski, webhook) se ne može ručno menjati.","error":"Bad Request","statusCode":400}
{"message":"Uplata nije povezana ni sa jednom rezervacijom.","error":"Bad Request","statusCode":400}
```
```json
{"message":"Uplata se ne može menjati — za ovu rezervaciju je fiskalni dokument već poslat/izdat (M10 spec §5.2).","error":"Bad Request","statusCode":400}
```
Iznos na kom počiva izdat račun ne sme se menjati unazad. Blokira **samo** dokument u statusu `SUBMITTED` ili `ISSUED` — nacrt (`DRAFT`) ne blokira, jer nacrt postoji za skoro svaku rezervaciju pa bi inače nijedna uplata nikad ne bila ispravljiva.

Kod plaćanja čekovima zbir mora da se poklopi:
```json
{"message":"Zbir specifikacije čekova (90000) mora biti jednak iznosu uplate (95000).","error":"Bad Request","statusCode":400}
```
**Specifikacija čekova se pri izmeni zamenjuje u celosti** — pošaljite ceo niz, ne samo ček koji menjate. Prethodno stanje ostaje zapisano u audit logu.

---

## Kartično plaćanje gosta (dva endpointa bez tokena)

### POST /finance/payments/card/initiate
**Bez autentikacije** — poziva ga gost sam, sa sajta, pre nego što uopšte ima nalog.

```json
{ "quoteId": "quote-789", "idempotencyKey": "b7e2f1a0-4c3d-4f5e-9a1b-2c3d4e5f6a7b" }
```

### POST /finance/payments/card/webhook
**Bez tokena, ali sa obaveznim potpisom.** Povratni poziv platnog provajdera — jedini način na koji kartična uplata dobija status „primljeno".

Zahtev mora nositi zaglavlje:
```
x-payment-webhook-signature: <potpis>
```
```json
{
  "gatewayTransactionId": "psp-tx-99887",
  "buyerName": "Petar Petrović",
  "buyerType": "FIZICKO_LICE",
  "buyerTaxId": null,
  "guests": []
}
```
Bez ispravnog potpisa:
```json
{"message":"Nevažeći ili nedostajući potpis webhook poziva.","error":"Unauthorized","statusCode":401}
```

> Potpis je dodat posle bezbednosnog pregleda u avgustu 2026. Bez njega bi svako ko sazna ili pogodi `gatewayTransactionId` mogao da označi rezervaciju kao plaćenu **bez ijednog dinara**. Ako povezujete sopstveni platni provajder, potpisivanje nije opcija.

Neuspelo plaćanje kod provajdera:
```json
{"message":"Kartično plaćanje nije uspelo kod provajdera — rezervacija nije napravljena, iznos nije naplaćen.","error":"Bad Request","statusCode":400}
```

---

## Politika akontacije i rokova

### GET /finance/payment-terms-config
Dozvola: `M10/payment-terms-config/VIEW`.

**Dok politika nije podešena, vraća `404`, ne prazan objekat** (uhvaćeno pozivom):
```json
{"message":"Politika akontacije/balansa (PaymentTermsConfig) još nije podešena (M10 spec §5.4.1).","error":"Not Found","statusCode":404}
```
Ovo je stanje na lokalnoj bazi danas — tretirajte `404` kao „nije podešeno", ne kao grešku.

### PUT /finance/payment-terms-config
Dozvola: `M10/payment-terms-config/EDIT`.

```json
{
  "depositPercentage": 30,
  "depositDueDaysAfterConfirmation": 3,
  "balanceDueDaysBeforeStay": 21,
  "escalationDaysAfterDue": 5
}
```
Jedna politika za celu agenciju: koliki je avans, za koliko dana dospeva posle potvrde, koliko dana pre putovanja dospeva ostatak, i posle koliko dana kašnjenja se slučaj eskalira.

### GET /finance/client-payment-schedules
Dozvola: `M10/client-payment-schedule/VIEW`. Planovi otplate po rezervacijama, izvedeni iz politike iznad.

---

## Obaveze prema dobavljačima

> Odeljak izveden iz koda — tabela je prazna.

### GET /finance/supplier-obligations · POST /finance/supplier-obligations
Dozvola: `M10/supplier-obligation/VIEW`.

```json
{ "supplierId": "515a72e5-...", "bookingItemId": "item-42", "amountOriginal": 86000, "currencyOriginal": "EUR", "dueDate": "2027-05-15" }
```

### POST /finance/supplier-obligations/:id/approve
Dozvola: `M10/supplier-obligation/APPROVE`.

```json
{"message":"SupplierObligation nema popunjen bookingItemId — ne može preći u APPROVED (M10 spec §8.3).","error":"Bad Request","statusCode":400}
```
> Obaveza se ne odobrava dok se ne zna **za koju stavku rezervacije** se plaća. Bez toga bi se dobavljaču platilo nešto što se ne može vezati ni za jedan prihod — trošak bez para.

### POST /finance/supplier-obligations/:id/pay
Dozvola: `M10/supplier-obligation/APPROVE`. Telo opciono:
```json
{ "paidAt": "2027-05-14" }
```
Bez `paidAt` uzima se trenutno vreme.

---

## Nalozi za isplatu dobavljaču

### GET /finance/supplier-payment-instructions · POST /finance/supplier-payment-instructions
Dozvole: `M10/supplier-payment-instruction/VIEW` za pregled, `…/CREATE` za kreiranje (razdvojeno 4.9.2026 — ranije je i kreiranje tražilo samo `VIEW`).

```json
{ "supplierObligationId": "obl-1", "method": "BANK_TRANSFER", "bankIban": "RS35...", "bankSwift": "..." }
```
ili
```json
{ "supplierObligationId": "obl-1", "method": "VIRTUAL_CARD", "virtualCardReference": "vc-778" }
```

```json
{"message":"Instrukcija za isplatu se pravi tek nad APPROVED obavezom (M10 spec §8.5.2/§8.3).","error":"Bad Request","statusCode":400}
```

### POST /finance/supplier-payment-instructions/:id/execute
Dozvola: `M10/supplier-payment-instruction/EXECUTE` — **odvojena i strožija** od one za kreiranje. Ko sastavlja nalog ne mora biti onaj ko ga izvršava.

> **Tri odvojena prava, namerno:** `VIEW` (gledati), `CREATE` (sastaviti nalog), `EXECUTE` (poslati novac). Do 4.9.2026 kreiranje je tražilo samo `VIEW` — ko je smeo da gleda obaveze, smeo je i da sastavi nalog za isplatu; ispravljeno uvođenjem `CREATE` dozvole. Novac ni tada nije mogao izaći bez `EXECUTE`, ali podela odgovornosti nije bila potpuna.

---

## Povraćaj novca gostu

### GET /finance/refund-instructions · POST /finance/refund-instructions
Dozvole: `M10/refund-instruction/VIEW` za pregled, `…/CREATE` za kreiranje (razdvojeno 4.9.2026).

```json
{ "paymentId": "pay-1", "amount": 45000, "currency": "RSD", "method": "BANK_TRANSFER" }
```

### POST /finance/refund-instructions/:id/approve · POST /finance/refund-instructions/:id/execute
Dozvole: `M10/refund-instruction/APPROVE` odnosno `EXECUTE`.

**Povraćaj ima tri koraka — sastavi, odobri, izvrši — i svaki traži svoje pravo.** Novac napolje je jedina radnja u sistemu sa tri odvojene brave.

---

## Uvoz faktura dobavljača

Isti obrazac kao uvoz cenovnika (M3) i sadržaja (M2): AI predloži poklapanje, čovek potvrđuje red po red.

### GET /finance/supplier-invoice-imports · POST /finance/supplier-invoice-imports
Dozvole: `M10/supplier-invoice-import/VIEW` odnosno `CREATE`.

```json
{ "supplierId": "515a72e5-...", "sourceFileUrl": "https://primer.rs/fakture/jh-04-2027.pdf", "sourceFormat": "PDF" }
```

### GET /finance/supplier-invoice-imports/:id
Dozvola: `M10/supplier-invoice-import/VIEW`.

### POST /finance/supplier-invoice-imports/:id/rows/:rowId/confirm
Dozvola: `M10/supplier-invoice-import/REVIEW`.

```json
{ "matchedSupplierObligationId": "obl-1", "correctedAmount": 86500 }
```
Oba polja su opciona. Ako pošaljete `matchedSupplierObligationId` različit od AI predloga, red se beleži kao ručno poklopljen. `correctedAmount` služi kad se iznos na fakturi razlikuje od očekivanog.

```json
{"message":"Red nema matched_supplier_obligation_id — potreban je predlog ili ručno zadat cilj (M10 spec §8.6.3/§8.6.4).","error":"Bad Request","statusCode":400}
```

### POST /finance/supplier-invoice-imports/:id/rows/:rowId/reject
Dozvola: `M10/supplier-invoice-import/REVIEW`.

---

## Kursna lista

### GET /finance/exchange-rates
Dozvola: `M10/exchange-rate/VIEW`.

**Straničenje** (dodato 6.9.2026, dok. 39 nalaz 2.2). Odgovor NIJE go niz nego `{ data, total, page, limit, pageCount, hasMore }`, gde je `total` **stvaran** broj redova koji odgovaraju filteru (ne broj vraćenih). Opcioni `?page=` (podrazumevano `1`) i `?limit=` (podrazumevano `50`, najviše `200`); neispravna vrednost vraća `400`, ne ispravlja se tiho. Do tog datuma endpoint je vraćao go niz sa tihom granicom od 200 redova, bez ijedne naznake da ostatak postoji.

Kursna lista raste jednim redom po valuti PO DANU — ranija granica od 200 pokrivala je manje od godinu dana za tri valute, pa bi upit za prošlu sezonu vratio prazno bez objašnjenja.

**Odgovor `200` (redovi u `data`, oblik uhvaćen stvarnim pozivom):**
```json
[
  { "id": "d646093d-1912-475f-9645-401d7a58cf94", "currency": "EUR", "rateDate": "2026-08-28T00:00:00.000Z", "nbsMiddleRate": "117.3707", "source": "NBS_API", "createdAt": "2026-08-28T06:30:02.451Z" },
  { "id": "aeaa15f1-259b-48ac-8e0b-e8035b0bb918", "currency": "USD", "rateDate": "2026-08-28T00:00:00.000Z", "nbsMiddleRate": "100.7906", "source": "NBS_API", "createdAt": "2026-08-28T06:30:02.589Z" },
  { "id": "807e1d7b-8cbe-4806-9dcf-b0c1609a2745", "currency": "EUR", "rateDate": "2026-08-14T20:28:51.181Z", "nbsMiddleRate": "117", "source": "MANUAL", "createdAt": "2026-08-14T20:28:51.184Z" }
]
```
`nbsMiddleRate` se vraća **kao tekst**, ne kao broj — precizan decimalni tip. Ne pretvarajte ga u običan broj pre množenja ako vam je bitna zaokruženost.

`source` razlikuje kurs povučen sa NBS-a od ručno unetog.

### POST /finance/exchange-rates
Dozvola: `M10/exchange-rate/EDIT`.
```json
{ "currency": "EUR", "rateDate": "2027-05-14", "nbsMiddleRate": 117.3707 }
```

---

## Banke i usaglašavanje

### GET /finance/banks
Dozvola: `M10/payment/VIEW`. Šifarnik banaka za `bankId` u uplatama. **Trenutno prazan** (uhvaćeno pozivom) — dok se ne popuni, uplate koje traže `bankId` ne mogu se uneti.

### GET /finance/reconciliation/mismatches
Dozvola: `M10/fiscal-document/VIEW`. Nesaglasnosti između zabeleženih uplata i izdatih fiskalnih dokumenata.

---

## Greške — zajednički oblik

```json
{ "message": "opis greške", "error": "Bad Request", "statusCode": 400 }
```

| Kod | Kada |
| :---- | :---- |
| `400` | validacija, pogrešan status za traženi prelaz, izmena kartične uplate, obaveza bez `bookingItemId` |
| `401` | nedostaje/istekao token; kod webhook-a — nevažeći potpis |
| `403` | nedostatak dozvole, npr. `{"message":"Nema dozvolu M10/fiscal-document/SUBMIT",...}` |
| `404` | nepostojeći zapis; **i „politika još nije podešena"** |

Nepoznato polje u telu zahteva vraća `400`, ne ignoriše se.
