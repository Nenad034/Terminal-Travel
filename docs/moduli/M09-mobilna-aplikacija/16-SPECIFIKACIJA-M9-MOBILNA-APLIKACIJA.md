# Specifikacija modula M9 — Mobilna aplikacija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M9) i poglavlje 8 (Faza 6)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026) — backend za deo vodiča na terenu gotov (poglavlje 3/4, izlazni kriterijum stavke 1-4); React Native (Expo) mobilni klijent za oba iskustva gotov (`apps/mobile`, izlazni kriterijum stavke 5-6), poglavlje 5 dopunjeno mehanizmom push notifikacija. Preostaje samo objavljivanje u App Store/Google Play (poglavlje 9).
**Verzija:** 1.5 — nov `GET /mobile/staff/check-ins?bookingId=` i nova dozvola `M9/field-checkin/VIEW` (1.9.2026, za karticu "Predstavnici" na ekranu rezervacije, M5 spec §4.5). Nalaz: `FieldCheckIn` (§3.2) je do sada mogao samo da se UPIŠE sa telefona vodiča (`POST /mobile/staff/sync`) i nikad da se pročita — kancelarija nije imala nijedan način da vidi da li je iko stvarno preuzeo goste na destinaciji. Dozvola je namerno ODVOJENA od `field-checkin/CREATE`: vodič na terenu upisuje, kancelarija čita, ni jedno ni drugo ne podrazumeva ono drugo (VODIC uloga zato NE dobija `VIEW`, a Vlasnik/Direktor/Sales Manager/Prodajni agent NE dobijaju `CREATE`).
**Verzija:** 1.4 (avgust 2026) — React Native (Expo, managed workflow) mobilni klijent, `apps/mobile`: oba iskustva (gost preko postojećih M8/M5/M6/M10/M20 API-ja, vodič preko offline-first sinhronizacije iz poglavlja 3). Push notifikacije rešene preko Expo Push servisa (poglavlje 5 dopunjena): novo polje `User.pushToken` (M1) i `POST /mobile/push-token` endpoint za registraciju uređajskog tokena; time se briše otvoreno pitanje "konkretan provajder" iz poglavlja 9. v1.3 implementacija backend dela za vodiče: nova uloga `VODIC` (M1), dopuna M5 `BookingItem.assigned_guide_id`, Prisma modeli `FieldCheckIn`/`FieldIncidentNote`, `GET /mobile/staff/my-itinerary`, `POST /mobile/staff/sync`, dozvole (poglavlje 6), API dokumentacija `docs/api/M9-mobilna-aplikacija.md`. v1.2 dodata napomena o namerno uskom obimu (poglavlje 1) i stavka izlaznog kriterijuma za prikaz na tabletu/preklopnom telefonu (Master dokument poglavlje 5.1); v1.1 dopunjena lista zavisnosti sa M10/M20, koje deo za goste već koristi (kartično plaćanje, prihvatanje ugovora) preko istog toka kao M8
**Zavisi od:** M1, M2, M5, M6, M10 (kartično plaćanje), M20 (prihvatanje ugovora pre plaćanja) — isti tok kao M8, vidi poglavlje 2

---

## 1. Svrha i obim modula

M9 ima **dva različita iskustva** u istoj React Native aplikaciji (deljen kod sa Next.js, poglavlje 6 Master dokumenta): aplikacija za **goste** (pregled/rezervacija/vaučeri) i aplikacija za **interni tim/vodiče na terenu** (offline-first, potvrđeno u poglavlju 4 Master dokumenta). Koja se verzija prikaže zavisi od uloge prijavljenog korisnika (M1).

**Namerno uzak obim (potvrđeno, Master dokument poglavlje 5.1):** M9 pokriva isključivo gosta i vodiča — jedine dve uloge kojima je zaseban mobilni sloj stvarno potreban (vodič radi bez signala na terenu). Prodajni agent, Sales Manager, HR, Računovođa, Direktor i Vlasnik **ne dobijaju aplikaciju iz M9** — oni koriste M17 (interni panel) na telefonu/tabletu, koji za to mora biti responsive i instalabilan kao PWA. Subagenti isto koriste M7 portal na telefonu, ne M9. Ovo sprečava dupliranje istog podatka kroz dve aplikacije.

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

**Implementaciona napomena (avgust 2026):** M5 `BookingItemGuest` je do ovog prolaza imao samo složeni ključ (`booking_item_id` + ime/prezime gosta), bez sopstvenog UUID-a — nepogodno kao FK cilj za `booking_item_guest_id` ispod. Dodat je sintetički `id String @id @default(uuid())` na `BookingItemGuest` (M5 spec nije menjan po sadržaju, samo tehnički identifikator); složeni ključ ostaje kao `@@unique`, fuzzy-match duplikat provera (M5 spec §6.4) radi nepromenjeno.

#### `FieldCheckIn`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id (klijentski generisan) | UUID | |
| booking_item_guest_id | UUID (FK → M5 `BookingItemGuest.id`) | |
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
| severity | enum: `INFO`, `WARNING`, `URGENT` | `URGENT` generiše odmah vidljivo upozorenje timu čim se sinhronizuje (isti princip kao M10 neuspešno slanje fiskalnog dokumenta ka SEF/ESIR) |
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

**Provajder (avgust 2026, v1.4):** Expo Push servis — deo istog Expo SDK-a koji nosi mobilni klijent (poglavlje 6 master dokumenta), bez dodatnog vendora. Mehanizam:
- M1 `User` dobija novo polje `push_token` (string, nullable) — uređajski Expo push token.
- `POST /mobile/push-token` (autentikovan, bilo koja mobilna uloga — gost ili vodič) upisuje/ažurira `push_token` za pozivaoca. Isti idempotentni obrazac kao ostali M9 upisi (ponovljen isti token ne pravi duplikat, samo osvežava zapis).
- Slanje: postojeći Event Bus signali (`M9 field_incident.urgent`, M5 signali za potvrdu/promenu statusa rezervacije, M8 podsetnik pred putovanje) dobijaju pretplatnika koji čita `push_token` ciljanog korisnika i šalje preko Expo Push API-ja. Ovaj pretplatnik je deo mobilnog prvog prolaza implementacije, ne novi modul.

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
| `/push-token` | POST | registruje/osvežava Expo push token pozivaoca (poglavlje 5, v1.4), bilo koja mobilna uloga |
| Ostalo (deo za goste) | — | isti endpoint-i kao M8, samo mobilni klijent |

---

## 8. Izlazni kriterijum (M9 deo Faze 6)

- [x] Vodič bez signala može da vidi itinerar, listu gostiju i vaučere preuzete pre gubitka signala. *(backend: `GET /mobile/staff/my-itinerary` agregira M5+M6, spreman za lokalno keširanje na uređaju — samo backend deo, uređaj/SQLite čeka mobilni klijent, vidi stavku ispod. Testirano `apps/api/test/m9-exit-criteria.e2e-spec.ts`, §8 stavka 1.)*
- [x] Radnje urađene bez signala (check-in, beleška) se ispravno sinhronizuju čim se veza vrati, bez duplikata (test: pokušaj sinhronizacije dvaput istim `idempotency_key`). *(`POST /mobile/staff/sync`, testirano istim e2e fajlom, §8 stavka 2 — ponovljen isti `id` ne pravi duplikat, upisuje M1 audit log za svaku sinhronizovanu promenu.)*
- [x] `URGENT` beleška odmah generiše vidljivo upozorenje timu po sinhronizaciji. *(M1 audit log zapis `field_incident.urgent_alert` + Event Bus `M9 field_incident.urgent`, testirano §8 stavka 3 — ne ponavlja se pri idempotentnom re-sync-u bez promene sadržaja.)*
- [x] Vodič vidi isključivo sopstveni dodeljeni itinerar, ne tuđe ture. *(`assigned_guide_id` filter + test sa dva vodiča, §8 stavka 4; korisnik bez uloge `VODIC` dobija 403.)*
- [x] Gost deo aplikacije koristi identične API-je kao M8, bez posebne poslovne logike u mobilnoj aplikaciji. *(v1.4 — `apps/mobile/src/guest/*` poziva isključivo postojeće M5/M6/M10/M20 endpoint-e (`channel: MOBILE`), bez nove logike; isti tok kao `apps/web` rezervacija/actions.ts. TypeScript provera i `npm test --workspace=@terminal/mobile` prolaze; ceo tok (pretraga → ponuda → uslovi → plaćanje → potvrda → vaučer) ručno proveren kroz Expo klijent.)*
- [x] Oba iskustva (gost i vodič) ispravno prikazuju raspored na telefonu, preklopnom telefonu (sklopljen i rasklopljen) i tabletu, fluidnim rasporedom (Master dokument poglavlje 5.1). *(v1.4 — RN Flexbox + širina-ekrana breakpoint (`src/shared/responsive.ts`), ručno testirano promenljivom veličinom prozora u Expo Go/simulatoru; pravi fizički preklopni uređaj nije bio dostupan za testiranje, zabeleženo kao poznato ograničenje u §9.)*

---

## 9. Otvoreno za dalje

- Tačna dubina unapred preuzetih podataka (14 dana je predlog) — podesivo, prilagodiće se stvarnom obrascu rada kad agencija počne da koristi modul.
- Objavljivanje u App Store/Google Play (EAS submit, developer nalozi) — čeka vlasnikovu odluku o nalozima/budžetu.
- Testiranje na fizičkom preklopnom uređaju (v1.4 — lokalno je provereno samo simulacijom promenljive širine ekrana).
- M17/M19 pretplata na `M9 field_incident.urgent` za prikaz upozorenja na ekranu tima u realnom vremenu (v1.4 — signal i mobilno push obaveštenje kolegi već rade, ekranski prikaz čeka ta dva modula).
