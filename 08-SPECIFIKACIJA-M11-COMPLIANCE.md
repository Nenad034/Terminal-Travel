# Specifikacija modula M11 — Regulatorni modul (Compliance)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M11), poglavlje 8 (Faza 2) i poglavlje 9 (rokovi)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda pravnika pre implementacije
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M5. Formalno i od M6 (poglavlje 4 Master dokumenta) — vidi napomenu o redosledu niže.

---

## 1. Svrha i obim modula

M11 pokriva tri zakonske obaveze koje su namerno odvojene od M10 jer imaju sopstvene rokove i API-je (poglavlje 4 Master dokumenta): **eTurista prijava gostiju**, **boravišna taksa**, i **garancija putovanja (YUTA)**. Dodatno drži **evidencije spremne za inspekciju**.

### 1.1 Napomena o redosledu zavisnosti

Isti problem kao u M10: M6 (CRM) formalno je zavisnost, ali još ne postoji kad M11 dolazi na red (Faza 2 pre Faze 3). M11 zato drži sopstveni minimalni zapis podataka o gostu potrebnih **isključivo za zakonsku prijavu** (ime, tip i broj dokumenta, državljanstvo, datum rođenja) direktno na `GuestRegistration`, nezavisno od punog M6 profila. Kad M6 bude specificiran, ovi podaci se povezuju/preuzimaju odatle bez izmene strukture ovog modula.

---

## 2. eTurista/CIS prijava gostiju

### 2.1 `GuestRegistration`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_item_id | UUID (FK → M5 BookingItem) | mora biti `ACCOMMODATION` tip proizvoda |
| guest_full_name | string | |
| document_type | enum: `PASSPORT`, `LICNA_KARTA` | |
| document_number | string | |
| nationality | string | |
| date_of_birth | date | |
| document_expiry_date | date, nullable | datum isteka putne isprave — nullable dok podatak nije dostupan (npr. lična karta za domaće putovanje bez tog polja), obavezan za sve slučajeve gde se prelazi granica |
| check_in_date / check_out_date | date | |
| status | enum: `NOT_SUBMITTED`, `SUBMITTED`, `CONFIRMED`, `FAILED` | |
| eturista_reference | string, nullable | potvrda sistema |
| submitted_at | timestamp, nullable | |
| failure_reason | text, nullable | |

### 2.2 Automatski tok (potvrđeno)
Kad `check_in_date` nastupi (ili odmah po potvrdi rezervacije, ako je poznato unapred), sistem **automatski** šalje prijavu ka eTurista/CIS API-ju — bez čekanja na ljudski klik. Ovo je deterministički backend proces (isti princip kao poziv ka M4 spoljnom provajderu), ne AI odluka — u skladu sa principom #4 (determinizam pre autonomije): podaci već postoje i ne postoji prostor za procenu, samo mehaničko izveštavanje pod rokom.

- Neuspeh (`FAILED`) odmah generiše upozorenje timu (interni panel + email Vlasniku/Direktoru) — ovo **ne** sme tiho da propadne s obzirom na zakonski rok.
- Odjava (checkout) prijava se šalje na sličan način kad `check_out_date` nastupi, ako to eTurista/CIS proces zahteva (potvrditi tačan tehnički zahtev pri implementaciji — vidi poglavlje 7).

### 2.3 Alarm za rok važenja putne isprave

Sistem upozorava tim kad je `document_expiry_date` gosta ili pratećeg putnika **manje od 6 meseci od datuma polaska** (`check_in_date` odgovarajuće `BookingItem` stavke iz M5) — standardan uslov ulaska u većinu destinacija. Provera se pokreće u dva trenutka: (1) pri kreiranju `GuestRegistration` (ako je podatak već poznat), i (2) ponovnom proverom u periodičnom poslu koji prati nadolazeće polaske (isti mehanizam kao provera roka boravišne takse i garancije, poglavlje 4.2). Ovo je nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — čisto informativno upozorenje, sistem ne blokira rezervaciju niti prijavu, samo obaveštava tim da kontaktira gosta na vreme.

---

## 3. Boravišna taksa

### 3.1 `TouristTaxRate` — stopa po opštini/kategoriji
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| municipality | string | opština u kojoj se smeštaj nalazi |
| accommodation_category | string, nullable | ako se stopa razlikuje po kategoriji smeštaja |
| amount_per_night | decimal | u RSD |
| valid_from / valid_to | date, nullable | opštine povremeno menjaju iznos |

### 3.2 Naplata (veza sa M10)
Iznos boravišne takse se obračunava po gostu-noćenju i unosi kao stavka na `FiscalDocument` u M10 (već predviđeno u M10 specifikaciji, poglavlje 10, kao otvorena stavka — ovim dokumentom se to zatvara). M11 ne naplaćuje ništa direktno — samo čita naplaćene iznose iz M10 radi izveštavanja.

### 3.3 `TouristTaxRemittance` — mesečno izveštavanje
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| municipality | string | |
| period_month / period_year | integer | mesec za koji se izveštava |
| total_amount | decimal | zbir iz M10 fiskalnih dokumenata za taj period/opštinu |
| status | enum: `DRAFT`, `SUBMITTED`, `CONFIRMED` | |
| deadline | date | **do 5. u mesecu za prethodni mesec** (poglavlje 9 Master dokumenta) |
| submitted_by | UUID (FK → M1 User), nullable | |

**Napomena o autonomiji:** priprema `DRAFT` izveštaja (agregacija iz M10) sme biti automatska; **slanje nadležnom organu (`SUBMITTED`) zahteva ljudsku potvrdu** — ovo je (za razliku od eTurista prijave pojedinačnog gosta) zbirni finansijski izveštaj nadležnom organu sa direktnim novčanim značenjem, pa se tretira kao "Predloži pa čovek odobri" iz poglavlja 7, ne kao čisto mehaničko izveštavanje. AI agent (nivo "Autonomno") može unapred da upozori tim kad se rok od 5. u mesecu približava, a `DRAFT` nije spreman.

---

## 4. Garancija putovanja (YUTA)

### 4.1 `TravelGuarantee`
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

### 4.2 Iskorišćenost garancije — tvrda blokada prodaje preko limita

Ukupna vrednost aktivno prodatih aranžmana gde je agencija organizator (`Booking.tip_nastupanja = ORGANIZATOR`, dopuna M10 specifikacije poglavlje 4.1; `Booking.status` nije `CANCELLED`) **nikad ne sme preći** `TravelGuarantee.coverage_amount` tekuće aktivne garancije — ovo je zakonski uslov za pravo agencije da uopšte prodaje organizovana putovanja, ne interna politika upravljanja rizikom.

- **Prag upozorenja (80%):** kad kumulativna prodata vrednost dostigne 80% od `coverage_amount`, sistem upozorava Vlasnika/Direktora — nivo "Autonomno" (informativno).
- **Tvrda blokada (100%):** M5, u koraku potvrde rezervacije (M5 poglavlje 4, pre bilo kog poziva ka M3/M4 — isti obrazac kao provera B2B kreditnog limita u M7 poglavlje 4), poziva `GET /travel-guarantee/utilization` iz M11 za svaku stavku sa `tip_nastupanja = ORGANIZATOR`. Ako bi potvrda te rezervacije prevazišla `coverage_amount`, potvrda se odbija **pre** rezervisanja bilo kog kapaciteta — gost/agent dobija jasnu poruku, ne generičku grešku.
- Otkazivanje rezervacije (M5 poglavlje 6) smanjuje kumulativnu iskorišćenost nazad — provera je uvek nad trenutnim, ne istorijskim stanjem.
- Ova provera se odnosi isključivo na `ORGANIZATOR` promet — `POSREDNIK` rezervacije (M10 poglavlje 4.3) ne troše kapacitet sopstvene garancije agencije, jer odgovornost za izvršenje snosi stvarni organizator čiji aranžman se preprodaje.

---

## 5. Evidencije za inspekciju

Ne uvodi se nova baza podataka — ovo je **izveštaj/izvoz na zahtev** koji agregira već postojeće podatke iz M1 (audit log), M5 (rezervacije), M10 (fiskalni dokumenti), M11 (eTurista prijave, boravišna taksa, garancija) za zadati period, u formatu čitljivom za turističkog inspektora (PDF/Excel export). Definiše se kao endpoint (poglavlje 7), ne kao novi entitet.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M11/guest-registration/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M11/tourist-tax/VIEW` | Vlasnik, Direktor, Računovođa |
| `M11/tourist-tax-remittance/SUBMIT` | Vlasnik, Direktor, Računovođa — ljudska potvrda, isto obrazloženje kao M10 |
| `M11/travel-guarantee/VIEW` | Vlasnik, Direktor |
| `M11/travel-guarantee/EDIT` | Vlasnik, Direktor — nikad AI agent |
| `M11/inspection-export/CREATE` | Vlasnik, Direktor, Računovođa |

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/compliance`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/guest-registrations` | GET | pregled statusa prijava, filtrirano po datumu/statusu |
| `/guest-registrations/:id/retry` | POST | ručno ponovi neuspelu prijavu (`FAILED` → pokušaj ponovo) |
| `/tourist-tax/rates` | GET / POST / PATCH | stope po opštini |
| `/tourist-tax/remittances` | GET | lista mesečnih izveštaja |
| `/tourist-tax/remittances/:id/submit` | POST | ljudska potvrda slanja nadležnom organu |
| `/travel-guarantee` | GET / PATCH | trenutna garancija, ručna izmena (uvek ljudska akcija) |
| `/travel-guarantee/utilization` | GET | kumulativna prodata vrednost `ORGANIZATOR` prometa naspram `coverage_amount` — poziva ga M5 pri potvrdi rezervacije (poglavlje 4.2) i interni panel za prikaz |
| `/inspection-export` | POST | generiše izvoz za zadati period |

---

## 8. Izlazni kriterijum (M11 deo Faze 2 — poglavlje 8 Master dokumenta)

- [ ] eTurista prijava se automatski šalje na datum prijave gosta, bez ljudske intervencije; neuspeh odmah generiše vidljivo upozorenje.
- [ ] Boravišna taksa se ispravno obračunava po opštini/kategoriji i pojavljuje kao stavka na fiskalnom dokumentu iz M10.
- [ ] Mesečni izveštaj boravišne takse (`TouristTaxRemittance`) se pravilno generiše kao nacrt, sa rokom do 5. u mesecu, i zahteva ljudsku potvrdu pre slanja.
- [ ] Garancija putovanja prati datum isteka i šalje podsetnik unapred; izmena zapisa je uvek ljudska radnja, nikad AI.
- [ ] Alarm za rok putne isprave (<6 meseci do polaska) se ispravno generiše, bez blokiranja rezervacije.
- [ ] Provera iskorišćenosti garancije upozorava na 80% i ispravno blokira potvrdu nove `ORGANIZATOR` rezervacije koja bi prevazišla `coverage_amount`; `POSREDNIK` rezervacije nisu pogođene ovom proverom.
- [ ] Izvoz za inspekciju generiše čitljiv dokument koji objedinjuje podatke iz M1/M5/M10/M11 za zadati period.
- [ ] Svaka radnja koja zahteva ljudsku potvrdu (slanje boravišne takse, izmena garancije) upisana je u M1 audit log sa identitetom osobe.

---

## 9. Otvoreno za dalje

- Tačan tehnički ugovor sa eTurista/CIS API-jem (format prijave, autentikacija, da li odjava zahteva poseban poziv) — potvrditi sa zvaničnom dokumentacijom i, po potrebi, pravnikom pre implementacije, isto kao kod SEF/ESIR u M10.
- Tačne stope boravišne takse po opštinama u kojima agencija posluje — unose se kao stvarni podaci kad se zna konkretna lista destinacija (vezano za otvoreno pitanje #4 iz poglavlja 11 Master dokumenta — pilot destinacije).
- Da li M11 treba da prati i druge licence/dozvole agencije (van YUTA garancije) — trenutno van obima, dodaje se ako se pokaže potreba.
