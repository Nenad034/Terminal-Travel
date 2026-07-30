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
| product_id / product_type | UUID / string | iz M2 |
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
- **Marketing performanse** — namerno van obima ove verzije, jer M12 (izvor tih podataka) dolazi tek u Fazi 6; dodaje se kad M12 postoji.

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

Napomena: `resource` polje koristi format `report:podtip`, isti obrazac koji M1 specifikacija (poglavlje 3.3) daje kao primer (`report:sales`) — ne uvodi se četvrti segment u ključ dozvole.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/bi`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/reports/profitability` | GET | filtri: period, destinacija, dobavljač/provajder, kanal |
| `/reports/sales` | GET | filtri: period, kanal, tip proizvoda |
| `/reconciliation/run` | POST | ručno pokretanje rekonsilijacije (van noćnog rasporeda) — Vlasnik/Direktor |

---

## 8. Izlazni kriterijum (M13 deo Faze 5)

- [ ] Menadžment vidi profitabilnost po destinaciji, dobavljaču/provajderu i kanalu, sa tačnim `margin` izračunom.
- [ ] Gubitak pojedinačnog događaja (simuliran) se ispravlja narednom noćnom rekonsilijacijom, bez ručne intervencije.
- [ ] Svaki izveštaj prikazuje vreme poslednjeg osvežavanja podataka.
- [ ] Brisanje cele M13 projekcije i njena rekonstrukcija iz izvornih modula daje identičan rezultat kao pre brisanja.

---

## 9. Otvoreno za dalje

- Marketing performanse — dodaju se kad M12 bude specificiran (Faza 6).
- Tačan skup KPI-jeva koje AI agent (poglavlje 5) treba proaktivno da ističe — počinje se sa osnovnim (pad profitabilnosti, neuobičajen pad prodaje) i širi po potrebi.
