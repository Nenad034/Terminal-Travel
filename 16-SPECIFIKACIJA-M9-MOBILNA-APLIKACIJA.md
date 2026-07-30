# Specifikacija modula M9 — Mobilna aplikacija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M9) i poglavlje 8 (Faza 6)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M2, M5, M6

---

## 1. Svrha i obim modula

M9 ima **dva različita iskustva** u istoj React Native aplikaciji (deljen kod sa Next.js, poglavlje 6 Master dokumenta): aplikacija za **goste** (pregled/rezervacija/vaučeri) i aplikacija za **interni tim/vodiče na terenu** (offline-first, potvrđeno u poglavlju 4 Master dokumenta). Koja se verzija prikaže zavisi od uloge prijavljenog korisnika (M1).

---

## 2. Deo za goste

Isti tok i isti API-ji kao M8 (sajt) — pretraga (M5 `/search`), ponuda, rezervacija, kartično plaćanje (M10), "moje rezervacije" (M6/M5), vaučeri. Ne ponavlja se ovde detaljno — vidi M8 specifikaciju. Mobilne specifičnosti:
- Push notifikacije (potvrda rezervacije, podsetnik pred putovanje).
- Prikaz vaučera sa QR kodom pogodnim za skeniranje na licu mesta.

---

## 3. Deo za vodiče na terenu — offline-first

### 3.1 Lokalni podaci

Aplikacija drži lokalnu bazu (SQLite ugrađena u uređaj) sa podskupom podataka potrebnih za tekući i naredne dane rada vodiča:
- **Itinerar** — lista dodeljenih polazaka/tura (iz M5 `BookingItem`, filtrirano po vodiču — vidi poglavlje 4).
- **Lista gostiju** po polasku (M6 `GuestProfile`: ime, kontakt, preference/napomene — npr. alergije, pristupačnost).
- **Vaučeri** (referenca/sadržaj iz M5).
- **Kontakti za hitne slučajeve** (statični podaci, van obima ove specifikacije koliko se tiče izvora — unose se ručno u internom panelu).

### 3.2 Sinhronizacija

- **Povlačenje (pull):** kad god ima signala, aplikacija poziva `GET /mobile/staff/my-itinerary?from=&to=` i osvežava lokalnu bazu za tekući period (npr. narednih 14 dana). Ovo je agregacioni poziv (kompozicija preko M5+M6, isti princip kao M17) — vodič ne dobija sirov pristup bazama tih modula.
- **Slanje (push):** radnje koje vodič uradi **bez signala** (poglavlje 3.3) se lokalno redaju u red čekanja sa klijentski generisanim `idempotency_key` po zapisu (isti princip kao M4/M10 — sprečava duplikate ako se pošiljka ponovi posle prekida). Čim se signal vrati, `POST /mobile/staff/sync` šalje ceo red odjednom.
- **Rešavanje konflikta:** pošto vodič uglavnom *čita* podatke i pravi mali, jasno definisan skup upisa (poglavlje 3.3), ne komplikuje se sa naprednim spajanjem — primenjuje se **"poslednji upis pobeđuje" po vremenskoj oznaci**, uz obavezan zapis u M1 audit log za svaku sinhronizovanu promenu, tako da eventualni konflikt bar ostane vidljiv i proverljiv, ne tiho izgubljen.

### 3.3 Novi podaci koje vodič upisuje na terenu

#### `FieldCheckIn`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id (klijentski generisan) | UUID | |
| booking_item_guest_id | UUID (FK → M5) | |
| checked_in_at | timestamp | vreme na uređaju u trenutku radnje, ne vreme sinhronizacije |
| checked_in_by | UUID (FK → M1 User) | vodič |
| synced_at | timestamp, nullable | popunjava server pri prijemu |

#### `FieldIncidentNote`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id (klijentski generisan) | UUID | |
| booking_id | UUID (FK → M5) | |
| guide_id | UUID (FK → M1 User) | |
| note | text | |
| severity | enum: `INFO`, `WARNING`, `URGENT` | `URGENT` generiše odmah vidljivo upozorenje timu čim se sinhronizuje (isti princip kao M11 neuspela eTurista prijava) |
| created_at | timestamp | vreme na uređaju |
| synced_at | timestamp, nullable | |

---

## 4. Nova uloga `VODIC` i dopuna M5

Dodaje se uloga **`VODIC`** u M1 katalog uloga: pristup isključivo sopstvenom dodeljenom itineraru i gostima na tim polascima, bez pristupa internom panelu (M17) ili tuđim rezervacijama.

Da bi sistem znao koji vodič pokriva koji polazak, u `05-SPECIFIKACIJA-M5-REZERVACIJE.md` (`BookingItem`, poglavlje 4.2) dodaje se polje:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| assigned_guide_id | UUID, nullable (FK → M1 User) | dodeljuje interni panel (M17); koristi ga M9 za filtriranje itinerara po vodiču |

---

## 5. Push notifikacije

- **Gosti:** potvrda rezervacije, podsetnik pred putovanje, promena statusa.
- **Vodiči:** hitna izmena itinerara, `URGENT` `FieldIncidentNote` od kolege na istoj turi (ako je relevantno timski).

Implementacija (konkretan provajder push notifikacija) — van obima ove specifikacije, standardna infrastruktura.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M9/field-itinerary/VIEW` (sopstveni) | `VODIC` |
| `M9/field-checkin/CREATE`, `M9/field-incident/CREATE` | `VODIC` |
| Deo za goste | isto kao M8 (nema sopstvenih M9 dozvola za taj deo) |

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/mobile`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/staff/my-itinerary` | GET | agregovan paket za offline period, filtriran po `assigned_guide_id` |
| `/staff/sync` | POST | šalje red čekanja (`FieldCheckIn[]`, `FieldIncidentNote[]`), svaki zapis sa `idempotency_key` |
| Ostalo (deo za goste) | — | isti endpoint-i kao M8, samo mobilni klijent |

---

## 8. Izlazni kriterijum (M9 deo Faze 6)

- [ ] Vodič bez signala može da vidi itinerar, listu gostiju i vaučere preuzete pre gubitka signala.
- [ ] Radnje urađene bez signala (check-in, beleška) se ispravno sinhronizuju čim se veza vrati, bez duplikata (test: pokušaj sinhronizacije dvaput istim `idempotency_key`).
- [ ] `URGENT` beleška odmah generiše vidljivo upozorenje timu po sinhronizaciji.
- [ ] Vodič vidi isključivo sopstveni dodeljeni itinerar, ne tuđe ture.
- [ ] Gost deo aplikacije koristi identične API-je kao M8, bez posebne poslovne logike u mobilnoj aplikaciji.

---

## 9. Otvoreno za dalje

- Tačna dubina unapred preuzetih podataka (14 dana je predlog) — podesivo, prilagodiće se stvarnom obrascu rada kad agencija počne da koristi modul.
- Konkretan provajder push notifikacija — bira se pri implementaciji.
