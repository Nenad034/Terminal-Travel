# Specifikacija modula M13 — Izveštavanje i BI

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M13) i poglavlje 8 (Faza 5)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** svi moduli, read-only (poglavlje 4 Master dokumenta)

---

## 1. Svrha i obim modula

M13 daje upravljačke izveštaje (profitabilnost, prodaja, kasnije marketing performanse) nad podacima svih modula. Faza 5 izlazni kriterijum (poglavlje 8 Master dokumenta) je konkretan: **menadžment vidi profitabilnost po destinaciji/dobavljaču/kanalu.**

### 1.1 Važno razjašnjenje — M13 ne krši princip "jedan izvor istine"

M13 **ne čita direktno iz baza drugih modula** (princip #2, poglavlje 3 Master dokumenta) i **ne postaje novi izvor istine** za bilo koji podatak. Umesto toga, gradi sopstvenu **izvedenu, obnovljivu projekciju** (agregiranu/denormalizovanu kopiju radi brzine izveštavanja) — potpuno analogno lenjom keširanju u M2 (poglavlje 3 te specifikacije), samo primenjeno na BI umesto na katalog. Ako se projekcija izbriše, može se u potpunosti ponovo izgraditi iz izvornih modula — nijedan podatak ne postoji *samo* u M13.

---

## 2. Arhitektura — Event Bus + periodična rekonsilijacija

- M13 se pretplaćuje na događaje iz Event Bus-a koje već emituju drugi moduli (`booking.confirmed`, `booking.modified`, `booking.cancelled` iz M5; slično iz M10/M11 kad budu emitovali) i ažurira sopstvenu projekciju u skoro-realnom-vremenu.
- Pošto se pojedinačni događaj može izgubiti (pad servisa, mrežni problem), **noćni posao rekonsilijacije** povlači stanje direktno preko API-ja izvornih modula (ne baze) i upoređuje sa projekcijom M13, ispravljajući odstupanja. Ovo je namerna samoisceljujuća mera — BI podaci koji tiho "iskliznu" iz sinhronizacije su gori od podataka koji kasne uz jasnu oznaku vremena poslednjeg osvežavanja.
- Svaki izveštaj prikazuje `poslednje_ažurirano` vreme, da korisnik zna koliko su podaci sveži.

---

## 3. Model podataka (projekcija)

### 3.1 `FactBooking` — denormalizovana činjenična tabela
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_item_id | UUID | referenca ka M5, ne FK sa ograničenjem (projekcija je nezavisna) |
| booking_date | date | datum potvrde |
| stay_from / stay_to | date | |
| nights | integer | izvedeno: `stay_to − stay_from` u danima, čuva se radi brzine agregacije |
| guest_count | integer | broj osoba na ovoj stavci — `COUNT(BookingItemGuest)` iz M5, za sve tipove proizvoda |
| product_id / product_type | UUID / string | iz M2 |
| accommodation_type / stars | string, nullable / integer, nullable | iz M2 `Product.attributes`, samo za `product_type = ACCOMMODATION` |
| room_type | string, nullable | iz M3 `ContractPeriod.room_type` (preko `BookingItem.rate_line_id` → `RateLine.contract_period_id`), samo za `CONTRACTED` `ACCOMMODATION` stavke |
| board_type | string, nullable | iz M3 `RateLine.board_type` (preko `BookingItem.rate_line_id`), samo za `CONTRACTED` stavke |
| destination_country / destination_city | string | iz M2 |
| source_type | enum: `CONTRACTED`, `API` | |
| supplier_id | UUID, nullable | iz M3, ako `CONTRACTED` |
| provider_code | string, nullable | iz M4, ako `API` |
| channel | string | iz M5 |
| client_account_id | UUID | iz M6 |
| base_cost / final_price / currency | decimal / decimal / string | iz M5 |
| margin | decimal | izračunato: `final_price − base_cost` |
| status | enum (isto kao BookingItem) | |
| last_synced_at | timestamp | |

**Napomena o `nights`/`guest_count`:** proizvod `guest_count × nights` daje **gost-noćenja**, isti obračunski koncept koji M11 (poglavlje 3.2) već koristi za boravišnu taksu ("iznos se obračunava po gostu-noćenju") — ovde se namerno ne redefiniše, samo ponovo koristi na nivou izveštavanja, u skladu sa principom jednog izvora istine za poslovne pojmove.

### 3.2 `FactPayment` (za finansijske izveštaje, iz M10)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID | |
| amount_rsd | decimal | |
| method | string | |
| received_at | timestamp | |

---

## 4. Izveštaji

- **Profitabilnost po destinaciji/dobavljaču/kanalu** (Faza 5 izlazni kriterijum) — agregacija `margin` iz `FactBooking`, grupisano po `destination_*`, `supplier_id`/`provider_code`, `channel`, sa filterom po periodu.
- **Prodaja** — broj rezervacija, ukupna vrednost, prosečna vrednost rezervacije, po periodu/kanalu/tipu proizvoda.
- **Operativna statistika smeštaja** (poglavlje 4.1) — broj osoba, noćenja, prodate sobe.
- **Marketing performanse** — namerno van obima ove verzije, jer M12 (izvor tih podataka) dolazi tek u Fazi 6; dodaje se kad M12 postoji.

### 4.1 Operativna statistika smeštaja — detalji

Svi filtrirani na period (`stay_from`/`stay_to` unutar opsega) i na aktivne stavke (`status != CANCELLED`); svi osim "broja osoba" ograničeni su na `product_type = ACCOMMODATION` (noćenja, sobe, usluga, kategorija i tip smeštaja imaju smisla samo za smeštaj):

| Izveštaj | Izračun nad `FactBooking` | Napomena |
| :---- | :---- | :---- |
| Broj osoba | `SUM(guest_count)` | za sve tipove proizvoda (ne samo smeštaj), grupivo po periodu/destinaciji/kanalu |
| Noćenja | `SUM(guest_count * nights)` | gost-noćenja, isti koncept kao boravišna taksa u M11 (vidi napomenu u poglavlju 3.1) |
| Prodate sobe — ukupno | `COUNT(*)` gde `product_type = ACCOMMODATION` | jedan `BookingItem` = jedna prodata jedinica |
| Prodate sobe — po tipu | isto, grupisano po `room_type` | samo `CONTRACTED` stavke imaju `room_type` popunjen (poglavlje 3.1) |
| Po korišćenoj usluzi | `COUNT(*)` grupisano po `board_type` | npr. polupansion vs. all-inclusive; samo `CONTRACTED` |
| Po kategoriji hotela | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `stars` | |
| Po tipu smeštaja | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `accommodation_type` | hotel, vila, apartman, kabina na brodu, ... (M2 poglavlje 2.3) |

**Ograda:** `API`-sourced stavke (M4) po pravilu nemaju `room_type`/`board_type` popunjeno (poglavlje 3.1) — izveštaji "po tipu sobe" i "po usluzi" ih automatski isključuju iz razbijanja (ali ih broje u ukupnom "Prodate sobe — ukupno" i u "Broj osoba"/"Noćenja"), uz jasnu napomenu u prikazu koliko stavki nije razvrstano, da broj ne deluje kao da je nešto tiho izostavljeno.

---

## 5. Uloga AI agenta

Priprema internih izveštaja i uočavanje trendova (npr. "profitabilnost destinacije X pala 15% u odnosu na prošli kvartal") spada u nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — eksplicitno naveden primer ("interni izveštaji"). Agent sme samostalno da generiše i ističe ovakve nalaze; ne sme sam da menja cene/marže na osnovu njih (to ostaje ljudska odluka, M5/M7).

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M13/report:profitability/VIEW` | Vlasnik, Direktor |
| `M13/report:sales/VIEW` | Vlasnik, Direktor, Sales Manager |
| `M13/report:financial/VIEW` | Vlasnik, Direktor, Računovođa |
| `M13/report:occupancy/VIEW` | Vlasnik, Direktor, Sales Manager — operativna statistika smeštaja nije cenovno osetljiva (ne sadrži maržu), pa se deli šire od profitabilnosti |

Napomena: `resource` polje koristi format `report:podtip`, isti obrazac koji M1 specifikacija (poglavlje 3.3) daje kao primer (`report:sales`) — ne uvodi se četvrti segment u ključ dozvole.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/bi`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/reports/profitability` | GET | filtri: period, destinacija, dobavljač/provajder, kanal |
| `/reports/sales` | GET | filtri: period, kanal, tip proizvoda |
| `/reports/occupancy` | GET | filtri: period, destinacija, dobavljač; `?group_by=` jedno od `room_type`, `board_type`, `stars`, `accommodation_type` — vraća broj osoba, noćenja i broj prodatih soba (poglavlje 4.1) |
| `/reconciliation/run` | POST | ručno pokretanje rekonsilijacije (van noćnog rasporeda) — Vlasnik/Direktor |

---

## 8. Izlazni kriterijum (M13 deo Faze 5)

- [ ] Menadžment vidi profitabilnost po destinaciji, dobavljaču/provajderu i kanalu, sa tačnim `margin` izračunom.
- [ ] Gubitak pojedinačnog događaja (simuliran) se ispravlja narednom noćnom rekonsilijacijom, bez ručne intervencije.
- [ ] Svaki izveštaj prikazuje vreme poslednjeg osvežavanja podataka.
- [ ] Brisanje cele M13 projekcije i njena rekonstrukcija iz izvornih modula daje identičan rezultat kao pre brisanja.
- [ ] Izveštaj "Operativna statistika smeštaja" tačno prikazuje broj osoba, noćenja i broj prodatih soba (ukupno i po `room_type`) za zadati period.
- [ ] Isti izveštaj se ispravno razvrstava po `board_type`, `stars` i `accommodation_type`, uz jasnu naznaku broja stavki koje nisu razvrstane (npr. `API`-sourced stavke bez `room_type`/`board_type`).

---

## 9. Otvoreno za dalje

- Marketing performanse — dodaju se kad M12 bude specificiran (Faza 6).
- Tačan skup KPI-jeva koje AI agent (poglavlje 5) treba proaktivno da ističe — počinje se sa osnovnim (pad profitabilnosti, neuobičajen pad prodaje) i širi po potrebi.
