# API dokumentacija — M9 (Mobilna aplikacija — deo za vodiče na terenu)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — pre svega React Native (Expo) mobilni klijent, `apps/mobile` (v1.4, avgust 2026). Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md` — ovaj dokument ga ne zamenjuje.

**Namerno uzak obim ovog dokumenta (avgust 2026):** pokriva isključivo deo za vodiče na terenu (poglavlje 3/4 specifikacije). Deo za goste (poglavlje 2) nema sopstvene M9 endpoint-e — koristi identične API-je kao M8 (sajt), vidi `docs/api/M5-rezervacije.md` i pripadajuće M6/M10/M20 dokumente.

**Prefiks:** `/api/v1/mobile`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Dozvole:** `M9/field-itinerary/VIEW`, `M9/field-checkin/CREATE`, `M9/field-incident/CREATE` — sve tri dodeljene isključivo ulozi `VODIC` (M1 katalog uloga, poglavlje 4 specifikacije). Ownership (vodič vidi isključivo sopstveni dodeljeni itinerar) sprovodi `FieldStaffService`, ne dozvola sama po sebi — analogno M5/M6 ownership obrascu za Gosta.

---

## Itinerar (`GET /mobile/staff/my-itinerary`)

Agregacioni poziv — kompozicija preko M5 (`BookingItem` filtriran po `assigned_guide_id` pozivaoca) i M6 (`GuestProfile` podaci gostiju na tim polascima), in-process (bez HTTP poziva ka M5/M6). Vodič nikad ne dobija sirov pristup bazama tih modula.

**Query parametri:** `from`, `to` (ISO 8601 datum/vreme) — period za koji se povlače podaci (mobilni klijent osvežava lokalnu SQLite bazu za tekući/naredni period, predlog 14 dana, podesivo — vidi §9 specifikacije).

**Zahtev:**
```
GET /api/v1/mobile/staff/my-itinerary?from=2027-06-01T00:00:00.000Z&to=2027-06-30T00:00:00.000Z
Authorization: Bearer <JWT vodiča>
```

**Odgovor `200`:**
```json
[
  {
    "bookingItemId": "bi-1",
    "bookingId": "bk-1",
    "bookingNumber": "TT-2027-000123",
    "productId": "prod-1",
    "destinationCountry": "RS",
    "destinationCity": "Zlatibor",
    "stayFrom": "2027-06-10T00:00:00.000Z",
    "stayTo": "2027-06-15T00:00:00.000Z",
    "itemStatus": "CONFIRMED",
    "voucherUrl": "https://vouchers.internal.terminal-travel/bk-1.pdf",
    "guests": [
      {
        "bookingItemGuestId": "big-1",
        "firstName": "Marko",
        "lastName": "Marković",
        "email": "marko@example.com",
        "phone": "+381601234567",
        "preferences": { "alergije": "orasi" }
      }
    ]
  }
]
```

Samo stavke sa `itemStatus` u `CONFIRMED`/`PENDING_SUPPLIER_CONFIRMATION` i `assignedGuideId` jednak pozivaocu — otkazane stavke i tuđi polasci se nikad ne vraćaju (nema query parametra koji ovo zaobilazi).

---

## Sinhronizacija (`POST /mobile/staff/sync`)

Prima ceo red čekanja odjednom — sve radnje koje je vodič uradio bez signala, sa klijentski generisanim `id` po zapisu (isti taj `id` je idempotency ključ — nema posebnog `idempotency_key` polja, uloga mu je identična). Ponovljen isti `id` **ne pravi duplikat** — server samo potvrđuje `syncedAt`. Ako se isti `id` pošalje sa **različitim sadržajem**, primenjuje se "poslednji upis pobeđuje" po vremenskoj oznaci zapisa (`checkedInAt`/`createdAt`) — noviji sadržaj prepisuje stariji, uz obavezan upis u M1 audit log koji beleži da je detektovan konflikt (`context.conflictDetected`).

**Zahtev:**
```json
{
  "checkIns": [
    { "id": "3fae2b1e-...-uuid", "bookingItemGuestId": "big-1", "checkedInAt": "2027-06-10T08:15:00.000Z" }
  ],
  "incidentNotes": [
    { "id": "9c11a0aa-...-uuid", "bookingId": "bk-1", "note": "Autobus u kvaru, kasnimo 2h", "severity": "URGENT", "createdAt": "2027-06-10T08:20:00.000Z" }
  ]
}
```
Oba niza su opciona — klijent šalje samo ono što ima u redu čekanja.

**Odgovor `201`:**
```json
{
  "checkIns": [
    { "id": "3fae2b1e-...-uuid", "bookingItemGuestId": "big-1", "checkedInAt": "2027-06-10T08:15:00.000Z", "checkedInBy": "u-vodic-1", "syncedAt": "2027-06-10T09:00:00.000Z" }
  ],
  "incidentNotes": [
    { "id": "9c11a0aa-...-uuid", "bookingId": "bk-1", "guideId": "u-vodic-1", "note": "Autobus u kvaru, kasnimo 2h", "severity": "URGENT", "createdAt": "2027-06-10T08:20:00.000Z", "syncedAt": "2027-06-10T09:00:00.000Z" }
  ]
}
```

### `URGENT` beleška — odmah vidljivo upozorenje timu

Čim se `FieldIncidentNote` sa `severity: "URGENT"` **prvi put** sinhronizuje (ne pri ponovnom idempotentnom slanju istog već sinhronizovanog zapisa), sistem:
1. Upisuje poseban M1 audit log zapis (`module: "M9"`, `action: "field_incident.urgent_alert"`) — isti princip kao M10 neuspešno slanje fiskalnog dokumenta ka SEF/ESIR (vidljivo i proverljivo, ne tiho izgubljeno).
2. Emituje `M9 field_incident.urgent` preko Event Bus-a (`{ fieldIncidentNoteId, bookingId, guideId, note }`) — budući M17 (interni panel)/M18 (operativni nadzor)/M19 (tim-chat) mogu da se pretplate i proslede upozorenje timu u realnom vremenu; nijedan od njih još ne postoji kao implementacija, isti obrazac kao ostali "spreman signal, čeka pretplatnika" slučajevi u kodnoj bazi (npr. M10 `supplier_obligation_due_soon`).

**Svaki** sinhronizovan zapis (ne samo `URGENT`) dobija sopstveni audit log zapis (`field_checkin.synced`/`field_incident.synced`, ili `*.resynced_idempotent`/`*.resynced_overwritten` pri ponovnom slanju) — §3.2 specifikacije zahteva ovo za svaku sinhronizovanu promenu, ne samo za upozorenja.

---

## Registracija push tokena (`POST /mobile/push-token`)

v1.4 dopuna — bilo koja autentikovana mobilna uloga (gost ili vodič) registruje sopstveni Expo push token. Nema posebne dozvole (isti obrazac kao `GET /iam/permissions` — svako sme za sopstveni nalog).

**Zahtev:**
```json
{ "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```
**Odgovor `201`:** `{ "ok": true }`

Server čuva token u `User.push_token` i koristi ga (preko postojećih Event Bus signala — M5 `booking.confirmed`, M9 `field_incident.urgent`) da pošalje Expo push poruku odgovarajućem korisniku. Odsustvo registrovanog tokena se tiho preskače, nije greška.

---

## Dodela vodiča (interni panel, van `/mobile` prefiksa)

M9 spec §4 dopunjuje M5 `BookingItem` poljem `assigned_guide_id` (nullable, FK ka M1 `User`, weak reference). Dodeljuje ga interni panel (M17, još ne postoji kao implementacija) preko M5 endpoint-a:

```
PATCH /api/v1/sales/bookings/items/:itemId/assign-guide
Authorization: Bearer <JWT internog tima>
Content-Type: application/json

{ "assignedGuideId": "u-vodic-1" }
```
Dozvola: `M5/booking/MODIFY` (ista dozvola kao ostale izmene rezervacije — M9 spec ne uvodi poseban ključ za dodelu vodiča). `assignedGuideId: null` uklanja dodelu. Detalji: `docs/api/M5-rezervacije.md`. M17 (interni panel) postoji kao implementacija, ali još nema poseban ekran za ovu dodelu — poziva se direktno dok taj ekran ne bude dodat, isto ograničenje kao za `URGENT` upozorenje ispod.

---

## Deo za goste (poglavlje 2 specifikacije) — nema sopstvene M9 rute

Pretraga, ponuda, rezervacija, kartično plaćanje, "moje rezervacije", vaučeri — isti API-ji kao M8 (`docs/api/M5-rezervacije.md`, `M6-crm.md`, i M10/M20 tokovi plaćanja/prihvatanja ugovora), `channel: "MOBILE"` (M5 `M5Channel` enum) umesto `B2C_SITE`. QR prikaz vaučera je mobilna specifičnost bez sopstvenog API-ja (kodira postojeći `voucherUrl`).

---

## Mobilni klijent (`apps/mobile`, React Native/Expo, v1.4)

Postoji kao implementacija (avgust 2026) — oba iskustva (gost i vodič), offline-first sinhronizacija (lokalna SQLite baza + red čekanja opisan iznad), Expo push notifikacije. Endpoint-i iznad su stabilan ugovor koji klijent koristi direktno (bez BFF sloja, za razliku od `apps/web`/`apps/panel`). `M17`/`M19` konzumacija `field_incident.urgent` signala u realnom vremenu (iskačuće upozorenje na ekranu tima) ostaje otvorena stavka — signal je već spreman preko Event Bus-a, čeka pretplatnika na strani tih modula.
