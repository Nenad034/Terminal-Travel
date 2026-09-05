# API dokumentacija — M13 (Izveštavanje i BI)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela (M17) — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (arhitektura projekcije, izlazni kriterijum) ostaje `docs/moduli/M13-bi/13-SPECIFIKACIJA-M13-BI.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/bi`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Dozvole:** `M13/report:profitability/VIEW` (Vlasnik, Direktor — gejtuje i ručnu rekonsilijaciju), `report:sales/VIEW` (+ Sales Manager), `report:financial/VIEW` (+ Računovođa), `report:occupancy/VIEW` (+ Sales Manager), `report:dynamic/VIEW` (Vlasnik, Direktor), `report:marketing/VIEW` (Vlasnik, Direktor).

**Napomena o svežini podataka:** svaki izveštaj vraća `lastSyncedAt` — vreme poslednje sinhronizacije projekcije (Event Bus u skoro-realnom-vremenu ili noćna rekonsilijacija). M13 nikad ne čita direktno iz drugih modula pri odgovoru na izveštaj — uvek čita sopstvenu izvedenu projekciju (`FactBooking`/`FactPayment`), pa je `lastSyncedAt` jedini način da korisnik zna koliko su podaci sveži.

---

## Izveštaji

**Zajednički parametri `from`/`to`/`dateField`/`segment`** (5.9.2026 dopuna, M13 spec v1.12) — dostupni na SVIH pet izveštaja ispod. `dateField` bira NA KOJE polje se `from`/`to` odnosi: `created` (`bookingDate`), `stay_from` (dolazak), `stay_to` (odlazak); kad je izostavljen, `from`/`to` filtriraju po preklapanju sa terminom boravka (staro ponašanje, radi kompatibilnosti). `segment` filtrira po prodajnom kanalu: `B2B` (`channel = B2B_PORTAL`), `B2C` (`channel = B2C_SITE`), `SUBAGENT` (`subagentName` postavljen, nezavisno od kanala) — tačno jedan odjednom.

### GET /bi/reports/profitability

Profitabilnost po destinaciji/dobavljaču/kanalu (Faza 5 izlazni kriterijum). Query: `from`, `to`, `dateField`, `segment` (zajednički, gore), `destinationCountry`, `destinationCity`, `supplierId`, `providerCode`, `channel` — svi opcioni.

**Odgovor `200`:**
```json
{
  "byDestination": [
    { "key": "RS / Zlatibor", "count": 14, "revenue": 1680000, "margin": 240000 }
  ],
  "bySupplier": [
    { "key": "Hotel Palisad", "count": 9, "revenue": 1080000, "margin": 150000 }
  ],
  "byChannel": [
    { "key": "B2C_SITE", "count": 20, "revenue": 2400000, "margin": 340000 }
  ],
  "lastSyncedAt": "2026-08-13T03:00:12.000Z"
}
```
`revenue`/`margin` su u najmanjoj jedinici valute stavke (M5 konvencija celobrojnih iznosa). Isključuje stavke sa `status = CANCELLED`.

### GET /bi/reports/sales

Broj rezervacija, ukupna/prosečna vrednost, po kanalu/tipu proizvoda. Query: `from`, `to`, `dateField`, `segment`, `channel`, `productType`.

**Odgovor `200`:**
```json
{
  "bookingCount": 42,
  "totalValue": 5040000,
  "averageValue": 120000,
  "byChannel": [{ "key": "B2C_SITE", "count": 20, "revenue": 2400000, "margin": 340000 }],
  "byProductType": [{ "key": "ACCOMMODATION", "count": 30, "revenue": 3600000, "margin": 500000 }],
  "lastSyncedAt": "2026-08-13T03:00:12.000Z"
}
```
`bookingCount` broji `FactBooking` redove (M5 `BookingItem` stavke), isti nivo agregacije kao ostali M13 izveštaji.

### GET /bi/reports/occupancy

Operativna statistika smeštaja (poglavlje 4.1). Query: `from`, `to`, `dateField`, `segment`, `destinationCountry`, `destinationCity`, `supplierId`, `group_by` (opciono, jedno od `room_type`, `board_type`, `stars`, `accommodation_type`).

**Odgovor `200`:**
```json
{
  "guestCount": 96,
  "nights": 384,
  "soldUnitsTotal": 30,
  "groupBy": "room_type",
  "breakdown": [
    { "key": "DELUXE", "count": 12, "revenue": 1440000, "margin": 200000, "nights": 144 }
  ],
  "unclassifiedCount": 3,
  "lastSyncedAt": "2026-08-13T03:00:12.000Z"
}
```
`guestCount`/`nights` obuhvataju SVE tipove proizvoda; `soldUnitsTotal`/`breakdown` samo `ACCOMMODATION`. `unclassifiedCount` broji `ACCOMMODATION` stavke bez popunjene tražene dimenzije (tipično `API`-sourced stavke bez `room_type`/`board_type`, M13 spec §3.1 ograda) — ne izostavljene tiho, nego eksplicitno prikazane.

### GET /bi/reports/dynamic

Dinamički drill-down izveštaj (poglavlje 4.2). Query: `from`, `to`, `dateField`, `segment`, `productType` (opciono, zarezom razdvojena lista `ProductType` vrednosti — `IN` filter), `group_by` — **obavezan**, zarezom razdvojena uređena lista dimenzija: `destination_country`, `destination_city`, `product_name`, `supplier_name`, `channel`, `subagent_name`.

**Zahtev:** `GET /bi/reports/dynamic?group_by=destination_country,channel`

**Odgovor `200`:**
```json
{
  "dimensions": ["destination_country", "channel"],
  "tree": [
    {
      "key": "RS",
      "count": 25,
      "pax": 60,
      "nights": 240,
      "revenue": 3000000,
      "paid": 2100000,
      "balance": 900000,
      "children": [
        { "key": "B2C_SITE", "count": 18, "pax": 44, "nights": 176, "revenue": 2200000, "paid": 1600000, "balance": 600000, "children": [] }
      ]
    }
  ],
  "lastSyncedAt": "2026-08-13T03:00:12.000Z"
}
```
Nepoznata dimenzija u `group_by` → `400`. `paid` se računa iz `FactPayment` po pripadajućim rezervacijama unutar čvora; `balance = revenue − paid`.

### GET /bi/reports/marketing

Marketing performanse — atribucija rezervacije ka M12 sadržaju (poglavlje 4.3). Query: `from`, `to`, `dateField`, `segment`.

**Odgovor `200`:**
```json
{
  "byContent": [
    { "key": "5 razloga da posetite Zlatibor ove zime", "count": 6, "revenue": 720000, "margin": 96000 }
  ],
  "withoutKnownOrigin": { "count": 34, "revenue": 4080000 },
  "attributedShare": 0.15,
  "lastSyncedAt": "2026-08-13T03:00:12.000Z"
}
```
**Napomena (avgust 2026):** M12 (Marketing i sadržajni engine) je trenutno samo specifikovan, još nema implementaciju u kodu — `referral_content_id`/`referral_content_name` na `FactBooking` ostaju trajno `null` dok M12 ne dobije kod, pa se sve rezervacije pojavljuju u `withoutKnownOrigin`. Ovo NIJE greška — spec §4.3 ovo eksplicitno predviđa kao normalan prelazni slučaj.

---

## Rekonsilijacija

### POST /bi/reconciliation/run

Ručno pokretanje pune provere/ispravke projekcije (van noćnog rasporeda u `03:00`). Dozvola: `M13/report:profitability/VIEW` (Vlasnik/Direktor).

**Odgovor `201`:**
```json
{
  "bookingsChecked": 128,
  "bookingsCorrected": 2,
  "bookingsRemoved": 0,
  "paymentsChecked": 54,
  "paymentsRemoved": 1,
  "ranAt": "2026-08-13T10:15:00.000Z"
}
```
`bookingsCorrected` broji `FactBooking` redove koji su bili nedostajali ili su se razlikovali od stvarnog stanja u M2/M3/M5/M6/M7 (npr. posle izgubljenog Event Bus događaja) i sad su ispravljeni. `bookingsRemoved`/`paymentsRemoved` su projektovani redovi čiji izvor u M5/M10 više ne kvalifikuje (npr. uplata koja je posle storno postala `VOIDED`).
