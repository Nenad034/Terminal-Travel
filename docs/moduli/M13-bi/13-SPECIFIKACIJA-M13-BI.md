# Specifikacija modula M13 — Izveštavanje i BI

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M13) i poglavlje 8 (Faza 5)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodat dinamički izveštaj sa korisnički sastavljivim redosledom dimenzija (poglavlje 4.2) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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
| product_name | string | snapshot naziva proizvoda (M2), radi brzog grupisanja bez join-a (poglavlje 4.2) |
| supplier_name | string, nullable | snapshot naziva dobavljača (M3), popunjeno za `CONTRACTED` (poglavlje 4.2) |
| subagent_name | string, nullable | snapshot naziva subagenta (M7), popunjeno kad `client_account_id` pripada B2B nalogodavcu; `null` = direktna prodaja (poglavlje 4.2) |
| status | enum (isto kao BookingItem) | |
| last_synced_at | timestamp | |

**Napomena o `nights`/`guest_count`:** proizvod `guest_count × nights` daje **gost-noćenja** — standardan izveštajni koncept (broj gostiju pomnožen brojem noći boravka), koji M13 ovde definiše za potrebe izveštavanja o zauzetosti/prodaji smeštaja.

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
| Noćenja | `SUM(guest_count * nights)` | gost-noćenja (vidi napomenu u poglavlju 3.1) |
| Prodate sobe — ukupno | `COUNT(*)` gde `product_type = ACCOMMODATION` | jedan `BookingItem` = jedna prodata jedinica |
| Prodate sobe — po tipu | isto, grupisano po `room_type` | samo `CONTRACTED` stavke imaju `room_type` popunjen (poglavlje 3.1) |
| Po korišćenoj usluzi | `COUNT(*)` grupisano po `board_type` | npr. polupansion vs. all-inclusive; samo `CONTRACTED` |
| Po kategoriji hotela | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `stars` | |
| Po tipu smeštaja | `COUNT(*)` / `SUM(guest_count * nights)` grupisano po `accommodation_type` | hotel, vila, apartman, kabina na brodu, ... (M2 poglavlje 2.3) |

**Ograda:** `API`-sourced stavke (M4) po pravilu nemaju `room_type`/`board_type` popunjeno (poglavlje 3.1) — izveštaji "po tipu sobe" i "po usluzi" ih automatski isključuju iz razbijanja (ali ih broje u ukupnom "Prodate sobe — ukupno" i u "Broj osoba"/"Noćenja"), uz jasnu napomenu u prikazu koliko stavki nije razvrstano, da broj ne deluje kao da je nešto tiho izostavljeno.

### 4.2 Dinamički izveštaj — korisnički sastavljiv redosled dimenzija grupisanja

Pored fiksnih izveštaja iznad (unapred određene dimenzije), M13 izlaže i **dinamički drill-down izveštaj**: korisnik bira proizvoljan podskup i redosled dimenzija grupisanja, sistem gradi stablo rezultata tim tačnim redosledom — svaki sledeći nivo grupiše unutar prethodnog. Dodato poređenjem sa PrimeTravel `Dynamic Analytics` obrascem (biranje dimenzija klikom, sa vidljivim brojem redosleda) — konkretno korisnije rešenje od fiksnog skupa izveštaja (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`).

**Dostupne dimenzije** (svaka je postojeće ili dopunjeno polje na `FactBooking`, poglavlje 3.1 — bez novog modela podataka):

| Dimenzija | Polje |
| :---- | :---- |
| Država | `destination_country` |
| Destinacija | `destination_city` |
| Proizvod | `product_name` |
| Dobavljač | `supplier_name` (ili `provider_code` za `API` stavke) |
| Kanal | `channel` |
| Subagent | `subagent_name` (nullable — "Direktna prodaja" kad rezervacija nije preko subagenta) |

#### 4.2.1 Rezultat po čvoru stabla
Svaki čvor grupisanja vraća: `count` (broj rezervacija), `pax` (`SUM(guest_count)`), `nights` (`SUM(guest_count * nights)`, gost-noćenja — isti koncept kao poglavlje 4.1), `revenue` (`SUM(final_price)`), `paid` (`SUM(FactPayment.amount_rsd)` za rezervacije u tom čvoru, poglavlje 3.2), `balance` (`revenue − paid`), i `children[]` — sledeći nivo grupisanja unutar ovog čvora, po redosledu koji je korisnik odabrao.

#### 4.2.2 Nivo autonomije
Sastavljanje i prikaz izveštaja je čist read-only upit nad projekcijom — nivo **"Autonomno"**, isto obrazloženje kao poglavlje 5. Agent sme da predloži koristan redosled grupisanja (npr. "profitabilnost po dobavljaču unutar tri najprodavanije destinacije") na osnovu upita korisnika, ali ne menja nijedan podatak.

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
| `M13/report:dynamic/VIEW` | Vlasnik, Direktor — kao i profitabilnost, prikazuje `revenue`/`paid`/`balance` po čvoru (poglavlje 4.2) |

Napomena: `resource` polje koristi format `report:podtip`, isti obrazac koji M1 specifikacija (poglavlje 3.3) daje kao primer (`report:sales`) — ne uvodi se četvrti segment u ključ dozvole.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/bi`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/reports/profitability` | GET | filtri: period, destinacija, dobavljač/provajder, kanal |
| `/reports/sales` | GET | filtri: period, kanal, tip proizvoda |
| `/reports/occupancy` | GET | filtri: period, destinacija, dobavljač; `?group_by=` jedno od `room_type`, `board_type`, `stars`, `accommodation_type` — vraća broj osoba, noćenja i broj prodatih soba (poglavlje 4.1) |
| `/reports/dynamic` | GET | `?group_by=` uređena, zarezom razdvojena lista dimenzija iz poglavlja 4.2 (npr. `destination_country,destination_city,supplier`); vraća stablo čvorova (poglavlje 4.2.1) |
| `/reconciliation/run` | POST | ručno pokretanje rekonsilijacije (van noćnog rasporeda) — Vlasnik/Direktor |

---

## 8. Izlazni kriterijum (M13 deo Faze 5)

- [ ] Menadžment vidi profitabilnost po destinaciji, dobavljaču/provajderu i kanalu, sa tačnim `margin` izračunom.
- [ ] Gubitak pojedinačnog događaja (simuliran) se ispravlja narednom noćnom rekonsilijacijom, bez ručne intervencije.
- [ ] Svaki izveštaj prikazuje vreme poslednjeg osvežavanja podataka.
- [ ] Brisanje cele M13 projekcije i njena rekonstrukcija iz izvornih modula daje identičan rezultat kao pre brisanja.
- [ ] Izveštaj "Operativna statistika smeštaja" tačno prikazuje broj osoba, noćenja i broj prodatih soba (ukupno i po `room_type`) za zadati period.
- [ ] Isti izveštaj se ispravno razvrstava po `board_type`, `stars` i `accommodation_type`, uz jasnu naznaku broja stavki koje nisu razvrstane (npr. `API`-sourced stavke bez `room_type`/`board_type`).
- [ ] Dinamički izveštaj gradi stablo tačno onim redosledom dimenzija koji je korisnik odabrao, sa ispravnim `revenue`/`paid`/`balance` po čvoru na svakom nivou.

---

## 9. Otvoreno za dalje

- **Marketing performanse** — M12 sad ima Nivo 2 specifikaciju (`15-SPECIFIKACIJA-M12-MARKETING.md`), ali ne definiše šta M13 čita iz njega (npr. `ContentPiece` doseg/engagement po kanalu naspram M5 konverzije) — ovo ostaje otvoreno dok se ne uradi stvarna integracija, ažurirano avgust 2026 iz "kad M12 bude specificiran" pošto to više nije tačno.
- Tačan skup KPI-jeva koje AI agent (poglavlje 5) treba proaktivno da ističe — počinje se sa osnovnim (pad profitabilnosti, neuobičajen pad prodaje) i širi po potrebi.
- **Break-even/P&L izveštaj za `CHARTER`/`FIXED_LEASE` periode** (M3 poglavlje 2.3a) — poredi `ContractPeriod.ukupna_fiksna_obaveza` naspram stvarno naplaćene vrednosti prodatih stavki iz tog perioda; dodaje se kad se za ovim pokaže stvarna potreba (prvi charter/fiksni zakup ugovor).
- Sačuvani/preporučeni preseti redosleda dimenzija za dinamički izveštaj (poglavlje 4.2, npr. brzi prečac "sve po državi pa dobavljaču") — UX pogodnost za M17, ne menja API iz poglavlja 4.2; dodaje se ako se pokaže potreba.
