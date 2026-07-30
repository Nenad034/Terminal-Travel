# Specifikacija modula M5 — Rezervacije i tok prodaje

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M5) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M2, M3, M4

---

## 1. Svrha i obim modula

M5 vodi gosta/agenta kroz tok **Search → Ponuda → Potvrda → Upravljanje rezervacijom**, bez obzira da li proizvod dolazi iz M3 (ugovoren) ili M4 (API). M5 je jedino mesto gde se pravi konačna prodajna cena (nabavna cena + marža) i jedino mesto koje sme da zatraži rezervaciju kapaciteta kod M3 ili M4.

Van obima: naplata i fiskalizacija (M10, Faza 2), eTurista prijava (M11, Faza 2), CRM istorija gosta (M6, Faza 3) — M5 samo emituje događaje koje ti moduli kasnije koriste (poglavlje 8).

---

## 2. Model marže (mark-up)

Potvrđeno: potreban je fleksibilan sistem koji podržava procenat, fiksan iznos, i kombinaciju oba, sa podrazumevanom vrednošću po dobavljaču/provajderu koja se može override-ovati na finijem nivou.

### 2.1 `MarkupRule`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| scope_type | enum: `M3_SUPPLIER`, `M3_CONTRACT`, `M3_CONTRACT_PERIOD`, `M4_PROVIDER`, `M2_PRODUCT` | nivo na koji se pravilo odnosi |
| scope_id | UUID | referenca ka entitetu tog nivoa |
| percentage | decimal, nullable | npr. `15.00` = 15% |
| fixed_amount | decimal, nullable | dodaje se posle procenta |
| fixed_amount_currency | string, nullable | |
| active_from / active_to | date, nullable | omogućava vremenski ograničene kampanje marže |
| created_by / created_at / updated_at | UUID / timestamp | |

**Formula (fiksan redosled, da bude deterministički i proverljiv):**
`finalna_cena = round(nabavna_cena * (1 + percentage / 100)) + fixed_amount`
Ako `percentage` nije postavljen, tretira se kao 0. Ako `fixed_amount` nije postavljen, tretira se kao 0. Bar jedno od dva mora biti postavljeno da bi pravilo bilo validno.

### 2.2 Razrešavanje pravila (najspecifičnije pobeđuje)
Za proizvod iz M3 (ugovoren): `M2_PRODUCT` → `M3_CONTRACT_PERIOD` → `M3_CONTRACT` → `M3_SUPPLIER` (podrazumevano).
Za proizvod iz M4 (API): `M2_PRODUCT` → `M4_PROVIDER` (podrazumevano).

**Ograda:** sistem ne dozvoljava da `Contract` (M3) ili `ProviderConfig` (M4) pređe u status `ACTIVE` dok njegov dobavljač/provajder nema bar jedno podrazumevano `MarkupRule` — sprečava slučajnu prodaju bez marže.

**Dopuna (uneta u M6 specifikaciji, kad je taj modul specificiran):** posle primene `MarkupRule`, ako `Quote.client_account_id` postoji, M5 poziva M6 `GET /loyalty-status/:clientAccountId` i primenjuje popust nivoa lojalnosti kao poslednji korak: `konačna_cena_za_gosta = final_price * (1 - discount_percentage / 100)`. Ovo ne menja logiku marže iznad, samo dodaje korak posle nje.

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
| base_cost / base_cost_currency | decimal / string | iz M3 RateLine ili M4 AvailabilityQuote |
| markup_rule_id | UUID (FK → MarkupRule) | koje je pravilo primenjeno — čuva se radi sledljivosti čak i ako se pravilo kasnije promeni |
| final_price / final_price_currency | decimal / string | rezultat formule iz 2.1 |
| provider_quote_reference | string, nullable | za API stavke, radi ponovne provere pred potvrdu |

---

## 4. Potvrda rezervacije (Quote → Booking)

Korak po korak:

1. Proveri da `Quote.status = DRAFT` i da nije istekla. Ako je istekla, **ponovo izračunaj cenu/dostupnost** (nova pitanja ka M3/M4) pre nastavka — nikad se ne potvrđuje na osnovu zastarele cene.
2. Za svaku `QuoteItem`:
   - Ako `CONTRACTED`: pozovi M3 `/contracts/:id/periods/:periodId/reserve`. Uspeh → `item_status = CONFIRMED`. Ako je period `ON_REQUEST` → `item_status = PENDING_SUPPLIER_CONFIRMATION`. Neuspeh (nema kapaciteta) → stavka pada.
   - Ako `API`: pozovi M4 `/internal/providers/:code/bookings` sa jedinstvenim `idempotency_key`. Mapiraj `BookingConfirmation.status` u `item_status`.
3. **Sve ili ništa:** ako bilo koja stavka padne (nema kapaciteta, provajder odbije), sve već uspešno rezervisane stavke iz ovog pokušaja se **odmah oslobađaju** (M3 release / M4 `cancelBooking`) — sistem nikad ne ostavlja polovično rezervisanu rezervaciju. Gost/agent dobija jasnu poruku koja stavka nije uspela, uz ponudu da prilagodi izbor.
4. Ako sve stavke uspeju, kreira se `Booking` sa statusom: `CONFIRMED` ako su sve stavke `CONFIRMED`; `PENDING_SUPPLIER_CONFIRMATION` ako je bar jedna stavka u tom stanju (rezervacija prelazi u `CONFIRMED` tek kad se i poslednja stavka potvrdi — ručno ili preko M4 povratnog poziva).
5. Emituje se događaj (poglavlje 7).

### 4.1 `Booking`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_number | string, unique | čitljiva oznaka za gosta (npr. `TT-2027-000482`) |
| client_account_id | UUID (FK → M6) | ko plaća |
| channel | enum (isto kao Quote) | |
| status | enum: `PENDING_SUPPLIER_CONFIRMATION`, `CONFIRMED`, `MODIFIED`, `CANCELLED`, `COMPLETED` | |
| payment_status | enum: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `INVOICE_PENDING` | **potvrđeno: potvrda rezervacije ne zavisi od statusa plaćanja** — B2B kredit i avansno plaćanje su podržani od starta |
| total_price / currency | decimal / string | zbir `final_price` svih stavki |
| voucher_url | string, nullable | generiše se posle prelaska u `CONFIRMED` |
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
| base_cost / markup_rule_id / final_price | (isto kao QuoteItem) | prenosi se iz ponude u trenutku potvrde |
| item_status | enum: `CONFIRMED`, `PENDING_SUPPLIER_CONFIRMATION`, `CANCELLED` | |
| cancellation_refund_percentage | integer, nullable | popunjava se pri otkazivanju, iz M3 `CancellationRule` ili M4 `cancellationPolicy` |
| assigned_guide_id | UUID, nullable (FK → M1 User, uloga `VODIC`) | dodato pri specifikaciji M9 — dodeljuje interni panel (M17), koristi ga M9 za filtriranje itinerara vodiča na terenu |

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
- **Vaučer:** generiše se PDF sa detaljima rezervacije čim `Booking.status = CONFIRMED`, čuva se u EU cloud skladištu, referenca u `voucher_url`.

---

## 7. Događaji (Event Bus) koje M5 emituje

`booking.confirmed`, `booking.pending_supplier_confirmation`, `booking.modified`, `booking.cancelled` — buduci moduli (M6 istorija gosta, M10 fakturisanje, M11 eTurista prijava, M12 marketing) se pretplaćuju na ove događaje kad dođu na red; M5 ih ne poziva direktno (princip #2, poglavlje 3).

---

## 8. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M5/quote/CREATE`, `VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent; Gost (samo sopstvene, preko sajta) |
| `M5/booking/CREATE` (potvrda) | Vlasnik, Direktor, Sales Manager, Prodajni agent; Gost (samostalna rezervacija na sajtu) |
| `M5/booking/VIEW` | Vlasnik, Direktor, Sales Manager (sve); Prodajni agent (podrazumevano samo sopstveni klijenti — širi se pojedinačnim izuzetkom iz M1 ako treba); Gost (samo sopstvene) |
| `M5/booking/MODIFY`, `CANCEL` | Vlasnik, Direktor, Sales Manager, Prodajni agent (sopstveni klijenti); Gost (sopstvena rezervacija, u skladu sa pravilima otkazivanja) |
| `M5/markup-rule/VIEW`, `EDIT` | Vlasnik, Direktor — cenovna politika je osetljiva, ne deli se šire podrazumevano |

---

## 9. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/sales`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/search` | GET | objedinjena pretraga (M2 katalog + M3 dostupnost + M4 uživo), vraća normalizovane rezultate sa već primenjenom maržom |
| `/quotes` | POST | kreira ponudu od izabranih proizvoda/datuma/gostiju |
| `/quotes/:id` | GET | pregled ponude, uključujući da li je istekla |
| `/quotes/:id/confirm` | POST | pokreće tok iz poglavlja 4, vraća kreiranu `Booking` ili grešku po stavci |
| `/bookings` | GET | lista, filtrirano po statusu/kanalu/klijentu (prava pristupa iz poglavlja 8) |
| `/bookings/:id` | GET | detalji rezervacije |
| `/bookings/:id/modify` | POST | izmena datuma/gostiju |
| `/bookings/:id/cancel` | POST | otkazivanje (celo ili po stavci) |
| `/bookings/:id/payment-status` | PATCH | poziva isključivo M10 |
| `/markup-rules` | GET / POST / PATCH | upravljanje pravilima marže |

---

## 10. Izlazni kriterijum (Faza 1 — izlazni kriterijum cele faze, poglavlje 8)

- [ ] Tim može kroz interni panel da pretraži, dobije ponudu i potvrdi rezervaciju hotela — i iz M3 (ugovoreno) i preko M4 (Travelgate).
- [ ] Marža se ispravno primenjuje po hijerarhiji iz poglavlja 2, sa dokazivim izračunom (ista ulazna cena uvek daje istu izlaznu cenu).
- [ ] Rezervacija sa više stavki gde jedna stavka ne uspe ne ostavlja "napola" rezervaciju — sve već rezervisane stavke se oslobađaju.
- [ ] Rezervacija može biti `CONFIRMED` sa `payment_status = UNPAID` ili `INVOICE_PENDING`, bez greške.
- [ ] Otkazivanje ispravno računa procenat povraćaja iz `CancellationRule` i oslobađa kapacitet nazad u M3.
- [ ] Svaka promena statusa rezervacije vidljiva je u M1 audit logu.

---

## 11. Otvoreno za dalje

- Tačan prag/format za avans (deo unapred, ostatak kasnije) — pravilo se definiše detaljnije kad M10 (Finansije) bude specificiran, pošto je to suštinski pitanje naplate, ne toka rezervacije.
- ~~Da li B2B kreditni limit (M7) treba da blokira potvrdu rezervacije kad se pređe limit.~~ **Rešeno u M7 specifikaciji**: da — kad `Quote.client_account_id` pripada Subagentu, M5 proverava kreditni limit **pre** pokretanja toka potvrde (pre bilo kog poziva ka M3/M4); prekoračenje odbija potvrdu bez rezervisanja kapaciteta. Isto tako, cena za subagenta koristi proviziju (M7) umesto popusta lojalnosti (M6) kao poslednji korak u tok cene.
- Format vaučera (sadržaj, izgled) — definiše se kad se dođe do stvarne izrade, van obima ove specifikacije.
