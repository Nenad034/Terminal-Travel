# Specifikacija modula M11 — Regulatorni modul (Compliance)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M11), poglavlje 8 (Faza 2) i poglavlje 9 (rokovi)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda pravnika pre implementacije
**Status:** Nacrt za usvajanje
**Verzija:** 2.0 — na direktan zahtev vlasnika (avgust 2026): uklonjena eTurista/CIS prijava gostiju i boravišna taksa (ranija poglavlja 2 i 3) — obe su zakonska obaveza smeštajnog objekta (hotela/dobavljača) koji gosta direktno prima, ne agencije-touroperatora koja aranžman prodaje; modul sada pokriva isključivo garanciju putovanja (YUTA) i evidencije za inspekciju; preostala poglavlja prenumerisana (bivše 4→2, 5→3, 6→4, 7→5, 8→6, 9→7). Funkcionalnost CIS registracije garancije po rezervaciji (uvedena u v1.1) ostaje nepromenjena, sada kao poglavlje 2.3.
**Zavisi od:** M1, M5.

---

## 1. Svrha i obim modula

M11 pokriva zakonsku obavezu **garancije putovanja (YUTA)** — zakonski uslov da agencija uopšte sme da prodaje organizovana putovanja — i drži **evidencije spremne za inspekciju**.

**Napomena (avgust 2026, na zahtev vlasnika):** eTurista/CIS prijava gostiju i boravišna taksa su ranije bile deo ovog modula. Uklonjene su jer su zakonska obaveza smeštajnog objekta (hotela/dobavljača) koji gosta direktno prima, ne agencije-touroperatora koja aranžman prodaje. Terminal ne prati, ne obračunava niti prijavljuje nijedno od ovo dvoje — ni ovde ni u M10 (vidi `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 1).

---

## 2. Garancija putovanja (YUTA)

### 2.1 `TravelGuarantee`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider | string | npr. `YUTA` ili osiguravač preko kog se garancija realizuje |
| policy_number | string | |
| coverage_amount | decimal / currency | |
| valid_from / valid_to | date | godišnje obnavljanje |
| document_url | string | skenirani sertifikat, EU cloud skladište |
| status | enum: `ACTIVE`, `EXPIRED`, `PENDING_RENEWAL` | |

**Nikad autonomno:** izmena ili obnavljanje garancije je eksplicitno na listi "Nikad autonomno" iz poglavlja 7 Master dokumenta — AI agent **nikad** sam ne menja ovaj zapis niti komunicira sa YUTA u ime agencije. Agent sme (nivo "Autonomno") samo da **prati datum isteka i šalje podsetnik** timu unapred (npr. 60/30/7 dana pre `valid_to`) — čisto informativna radnja, ne izvršenje.

### 2.2 Iskorišćenost garancije — tvrda blokada prodaje preko limita

Ukupna vrednost aktivno prodatih aranžmana gde je agencija organizator (`Booking.tip_nastupanja = ORGANIZATOR`, dopuna M10 specifikacije poglavlje 4.1; `Booking.status` nije `CANCELLED`) **nikad ne sme preći** `TravelGuarantee.coverage_amount` tekuće aktivne garancije — ovo je zakonski uslov za pravo agencije da uopšte prodaje organizovana putovanja, ne interna politika upravljanja rizikom.

- **Prag upozorenja (80%):** kad kumulativna prodata vrednost dostigne 80% od `coverage_amount`, sistem upozorava Vlasnika/Direktora — nivo "Autonomno" (informativno).
- **Tvrda blokada (100%):** M5, u koraku potvrde rezervacije (M5 poglavlje 4, pre bilo kog poziva ka M3/M4 — isti obrazac kao provera B2B kreditnog limita u M7 poglavlje 4), poziva `GET /travel-guarantee/utilization` iz M11 za svaku stavku sa `tip_nastupanja = ORGANIZATOR`. Ako bi potvrda te rezervacije prevazišla `coverage_amount`, potvrda se odbija **pre** rezervisanja bilo kog kapaciteta — gost/agent dobija jasnu poruku, ne generičku grešku.
- Otkazivanje rezervacije (M5 poglavlje 6) smanjuje kumulativnu iskorišćenost nazad — provera je uvek nad trenutnim, ne istorijskim stanjem.
- Ova provera se odnosi isključivo na `ORGANIZATOR` promet — `POSREDNIK` rezervacije (M10 poglavlje 4.3) ne troše kapacitet sopstvene garancije agencije, jer odgovornost za izvršenje snosi stvarni organizator čiji aranžman se preprodaje.

### 2.3 CIS registracija garancije po rezervaciji

Za razliku od poglavlja 2.2 (koje prati **zbirnu** iskorišćenost garancije naspram limita), svaka pojedinačna `ORGANIZATOR` rezervacija mora biti evidentirana u CIS/YUTA registru pod sopstvenim brojem garancije, i ta evidencija mora biti **skinuta** (oslobođena) kad se rezervacija storno. Ovo su dve odvojene, po-rezervaciji obaveze prema registru, ne interno računovodstvo — otvorena rezervacija bez broja garancije, ili storno bez skinutog opterećenja, su konkretni propusti koje agencija mora da vidi i reši, ne samo interni brojevi u poglavlju 2.2.

#### `TravelGuaranteeRegistration`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking) | samo za `tip_nastupanja = ORGANIZATOR` |
| travel_guarantee_id | UUID (FK → `TravelGuarantee`, poglavlje 2.1) | koja godišnja garancija pokriva ovu rezervaciju |
| cis_registration_number | string, nullable | broj garancije dobijen iz CIS/YUTA sistema pri registraciji — prazno dok registracija ne uspe |
| status | enum: `PENDING`, `REGISTERED`, `RELEASE_PENDING`, `RELEASED`, `FAILED` | `RELEASE_PENDING` — rezervacija je storno, opterećenje u CIS-u još nije skinuto |
| registered_at | timestamp, nullable | |
| release_requested_at / released_at | timestamp, nullable | popunjava se pri, odnosno posle, stornirania |
| failure_reason | text, nullable | |

**Tok:** kad `Booking.status` (M5 poglavlje 4) pređe u `CONFIRMED` za `ORGANIZATOR` rezervaciju, kreira se zapis sa `status = PENDING` i sistem pokušava registraciju u CIS-u — deterministički obrazac, isti princip kao ostali automatski, ne-AI procesi u sistemu (npr. M10 automatsko kreiranje `SupplierObligation`, poglavlje 8.0 tog dokumenta) — princip #4 Master dokumenta (determinizam pre autonomije), pošto podaci već postoje i nema prostora za AI procenu. Kad `Booking.status` pređe u `CANCELLED` (M5 poglavlje 6), zapis prelazi u `RELEASE_PENDING` dok se opterećenje ne skine u CIS-u.

**Alarmi (nivo "Autonomno" iz poglavlja 7 Master dokumenta — informativno, ne blokira):**
- `CONFIRMED` rezervacija bez `status = REGISTERED` duže od 48h od potvrde (nema broj garancije).
- `CANCELLED` rezervacija čiji zapis ostaje `RELEASE_PENDING` duže od 48h od otkazivanja (opterećenje nije skinuto).

Oba alarma idu Vlasniku/Direktoru (interni panel + email).

**Tačan tehnički ugovor sa CIS/YUTA sistemom za registraciju i skidanje opterećenja (format poziva, autentikacija) nije ovde definisan — potvrditi sa zvaničnom dokumentacijom i, po potrebi, pravnikom/YUTA pre implementacije, isto obrazloženje kao SEF u M10 (poglavlje 6).**

---

## 3. Evidencije za inspekciju

Ne uvodi se nova baza podataka — ovo je **izveštaj/izvoz na zahtev** koji agregira već postojeće podatke iz M1 (audit log), M5 (rezervacije), M10 (fiskalni dokumenti), M11 (garancija putovanja) za zadati period, u formatu čitljivom za turističkog inspektora (PDF/Excel export). Definiše se kao endpoint (poglavlje 5), ne kao novi entitet.

---

## 4. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M11/travel-guarantee/VIEW` | Vlasnik, Direktor |
| `M11/travel-guarantee/EDIT` | Vlasnik, Direktor — nikad AI agent |
| `M11/travel-guarantee-registration/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent (poglavlje 2.3) |
| `M11/inspection-export/CREATE` | Vlasnik, Direktor, Računovođa |

---

## 5. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/compliance`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/travel-guarantee` | GET / PATCH | trenutna garancija, ručna izmena (uvek ljudska akcija) |
| `/travel-guarantee/utilization` | GET | kumulativna prodata vrednost `ORGANIZATOR` prometa naspram `coverage_amount` — poziva ga M5 pri potvrdi rezervacije (poglavlje 2.2) i interni panel za prikaz |
| `/travel-guarantee-registrations` | GET | lista `TravelGuaranteeRegistration` zapisa, filtrirano po statusu/rezervaciji (poglavlje 2.3) |
| `/travel-guarantee-registrations/:id/retry` | POST | ručno ponovi registraciju ili skidanje opterećenja koje je `FAILED` |
| `/inspection-export` | POST | generiše izvoz za zadati period |

---

## 6. Izlazni kriterijum (M11 deo Faze 2 — poglavlje 8 Master dokumenta)

- [ ] Garancija putovanja prati datum isteka i šalje podsetnik unapred; izmena zapisa je uvek ljudska radnja, nikad AI.
- [ ] Provera iskorišćenosti garancije upozorava na 80% i ispravno blokira potvrdu nove `ORGANIZATOR` rezervacije koja bi prevazišla `coverage_amount`; `POSREDNIK` rezervacije nisu pogođene ovom proverom.
- [ ] Svaka `CONFIRMED` `ORGANIZATOR` rezervacija dobija `TravelGuaranteeRegistration` zapis; nedostatak broja garancije (`status != REGISTERED`) duže od 48h generiše vidljivo upozorenje Vlasniku/Direktoru (poglavlje 2.3).
- [ ] Storno `ORGANIZATOR` rezervacije prevodi zapis u `RELEASE_PENDING`; ako opterećenje nije skinuto u CIS-u duže od 48h, generiše se upozorenje (poglavlje 2.3).
- [ ] Izvoz za inspekciju generiše čitljiv dokument koji objedinjuje podatke iz M1/M5/M10/M11 za zadati period.
- [ ] Svaka radnja koja zahteva ljudsku potvrdu (izmena garancije) upisana je u M1 audit log sa identitetom osobe.

---

## 7. Otvoreno za dalje

- Tačan tehnički ugovor za CIS registraciju garancije po rezervaciji i skidanje opterećenja pri stornu (poglavlje 2.3) — potvrditi sa zvaničnom dokumentacijom i, po potrebi, pravnikom/YUTA pre implementacije, isto obrazloženje kao SEF u M10 (poglavlje 6).
- Da li M11 treba da prati i druge licence/dozvole agencije (van YUTA garancije) — trenutno van obima, dodaje se ako se pokaže potreba.
- **Alarm za rok važenja putne isprave gosta** (<6 meseci do polaska) je ranije živeo na `GuestRegistration` entitetu (uklonjenom ovom verzijom, avgust 2026) — funkcionalno koristan podsetnik, nezavisan od eTurista. Da li ga treba ponovo dodati negde drugde (verovatno M6 `GuestProfile`, koji bi tada trebalo da dobije `document_expiry_date` polje) ostaje otvoreno, čeka odluku vlasnika.
