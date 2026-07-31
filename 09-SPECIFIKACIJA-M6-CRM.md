# Specifikacija modula M6 — CRM (Gosti i Nalogodavci)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M6) i poglavlje 8 (Faza 3)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M5

---

## 1. Svrha i obim modula

M6 čuva profile Nalogodavaca (ko plaća) i Gostiju (ko putuje), njihovu istoriju, preference, program lojalnosti i komunikaciju. Ovaj modul takođe **zatvara zapaza koje su M5, M10 i M11 ostavili kao forward-reference** dok M6 nije postojao — vidi poglavlje 6.

Istorija putovanja se **ne duplira** kao sopstveni podatak — čita se uživo iz M5 (Booking/BookingItem) preko API-ja, u skladu sa principom "jedan izvor istine".

---

## 2. Model podataka — jezgro

### 2.1 `ClientAccount` — Nalogodavac
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| account_type | enum: `INDIVIDUAL`, `LEGAL_ENTITY` | određuje SEF/ESIR izbor u M10 |
| full_name / company_name | string | zavisno od `account_type` |
| tax_id | string, nullable | PIB — obavezno za `LEGAL_ENTITY` |
| email / phone / address / country | string | |
| preferred_language | enum (isti skup kao M2: sr/en/hr/sl/es/de/ru/fr) | jezik komunikacije |
| linked_user_id | UUID, nullable (FK → M1 User) | ako nalogodavac ima login nalog |
| marketing_consent | boolean | obavezno pre bilo kakve marketinške komunikacije (M12) |
| marketing_consent_date | timestamp, nullable | |
| created_at / updated_at | timestamp | |

### 2.2 `GuestProfile` — Gost
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| full_name | string | |
| document_type | enum: `PASSPORT`, `LICNA_KARTA` | |
| document_number | string | |
| nationality | string | |
| date_of_birth | date | |
| email / phone | string, nullable | gost (npr. dete na putovanju) ne mora imati sopstveni kontakt |
| preferences | JSONB | slobodna struktura: ishrana, pristupačnost, tip sobe... |
| linked_client_account_id | UUID, nullable (FK → ClientAccount) | ako je gost i sam nalogodavac (tipičan B2C slučaj) |
| linked_user_id | UUID, nullable (FK → M1 User, `account_type = GUEST`) | |
| created_at / updated_at | timestamp | |

---

## 3. Program lojalnosti — nivoi (potvrđeno)

### 3.1 `LoyaltyTier`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| name | string | npr. "Srebrni", "Zlatni", "Platinasti" |
| rank | integer | redosled (viši broj = viši nivo) |
| qualification_metric | enum: `TOTAL_SPEND_RSD`, `BOOKING_COUNT`, `NIGHT_COUNT` | šta se meri |
| qualification_period | enum: `LIFETIME`, `ROLLING_12_MONTHS`, `CALENDAR_YEAR` | za koji period se metrika računa |
| threshold | decimal | prag za ulazak u nivo |
| discount_percentage | decimal | popust primenjen kao poslednji korak nakon M5 cene (vidi 3.3) |
| benefit_description | text | slobodan opis dodatnih pogodnosti (nefinansijskih) |

### 3.2 `ClientLoyaltyStatus`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_account_id | UUID (FK, unique) | lojalnost se prati po Nalogodavcu, ne po pojedinačnom Gostu |
| current_tier_id | UUID (FK → LoyaltyTier), nullable | |
| calculated_metric_value | decimal | trenutna vrednost metrike |
| tier_since | date | |
| last_recalculated_at | timestamp | |
| manual_override_tier_id | UUID, nullable (FK → LoyaltyTier) | ručno dodeljen nivo mimo praga (npr. VIP gost) |
| manual_override_reason | text, nullable | obavezno ako je override postavljen |
| manual_override_by | UUID, nullable (FK → M1 User) | |

**Automatski preračun:** M6 se pretplaćuje na `booking.confirmed` i `booking.cancelled` događaje iz M5 (Event Bus, već predviđeno u M5 specifikaciji, poglavlje 9) i ponovo računa `calculated_metric_value` i `current_tier_id` za pogođeni `client_account_id`. Ako postoji `manual_override_tier_id`, on uvek pobeđuje nad automatski izračunatim nivoom (isti obrazac "eksplicitni izuzetak pobeđuje" kao `UserPermissionOverride` u M1).

### 3.3 Primena popusta — dodatak na tok cene iz M5
Popust nivoa lojalnosti se primenjuje **posle** marže iz M5 (poglavlje 2 M5 specifikacije), kao poslednji korak: `konačna_cena_za_gosta = cena_iz_M5 * (1 - discount_percentage / 100)`. M5 poziva `GET /loyalty-status/:clientAccountId` u trenutku kreiranja `Quote` i primenjuje popust pre prikaza konačne cene — ovo je mala dopuna toka opisanog u M5 specifikaciji, ne izmena njegove osnovne logike marže.

---

## 4. Komunikacija

### 4.1 `CommunicationLog`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_account_id / guest_profile_id | UUID, nullable | bar jedno mora biti popunjeno |
| channel | enum: `EMAIL`, `PHONE`, `SMS`, `IN_PERSON` | |
| direction | enum: `INBOUND`, `OUTBOUND` | |
| summary | text | |
| drafted_by_ai | boolean | |
| sent_by | UUID, nullable (FK → M1 User) | ko je stvarno poslao (ako je poruka pominjala cenu/obavezu, mora biti popunjeno — vidi napomenu) |
| created_at | timestamp | |

**Napomena o autonomiji (poglavlje 7 Master dokumenta):** AI agent sme samostalno da sažima upite i priprema nacrt odgovora (`drafted_by_ai = true`, nivo "Autonomno"). Ako nacrt pominje cenu ili obavezu prema gostu, poruka se **ne šalje** dok je čovek ne pregleda i pošalje (`sent_by` popunjeno) — nivo "Predloži pa čovek odobri".

---

## 5. Istorija putovanja — čitanje uživo, ne skladištenje

`GET /guest-profiles/:id/travel-history` i `GET /client-accounts/:id/travel-history` spajaju podatke direktno iz M5 (`Booking`, `BookingItem`, `BookingItemGuest`) u trenutku poziva. M6 ne drži sopstvenu kopiju rezervacija.

---

## 6. Zatvaranje ranijih forward-referenci (M5, M10, M11)

- **M5** `Booking.client_account_id` i `BookingItemGuest.guest_profile_id` sada formalno referenciraju `M6.ClientAccount` i `M6.GuestProfile`.
- **M10** `FiscalDocument` treba da **snimi (snapshot)** ime/PIB nalogodavca u trenutku slanja (`SUBMIT`), ne samo da referencira `booking_id` — jer fiskalni dokument mora ostati istorijski tačan i ako se profil nalogodavca kasnije promeni (npr. subagent promeni naziv firme). *Ovo je dopuna M10 specifikacije, primenjena direktno u tom dokumentu (poglavlje 8 ovog dokumenta).*
- **M11** `GuestRegistration` zadržava sopstvena polja gosta (dokument, državljanstvo...) kao snimak stanja u trenutku prijave (eTurista zahteva podatak kakav je bio na dan boravka), ali dobija i `guest_profile_id` (FK → M6, nullable za stare zapise) radi povezivanja sa punim profilom kad on postoji.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M6/client-account/VIEW`, `CREATE`, `EDIT` | Vlasnik, Direktor, Sales Manager, Prodajni agent (sopstveni klijenti); Računovođa (VIEW radi fakturisanja) |
| `M6/guest-profile/VIEW`, `CREATE`, `EDIT` | isto kao gore |
| `M6/loyalty-tier/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M6/loyalty-tier/EDIT` (definicije nivoa) | Vlasnik, Direktor |
| `M6/loyalty-status/OVERRIDE` | Vlasnik, Direktor — obavezan razlog, upisuje se u audit log |
| `M6/communication-log/VIEW`, `CREATE` | Vlasnik, Direktor, Sales Manager, Prodajni agent |

Uloga **Gost** ima pristup isključivo sopstvenom `ClientAccount`/`GuestProfile` (preko `linked_user_id`), bez pristupa internom panelu.

---

## 8. Dopuna M10 specifikacije (poglavlje 6 ovog dokumenta)

U `07-SPECIFIKACIJA-M10-FINANSIJE.md`, tabela `FiscalDocument` (poglavlje 4.1) dobija dva nova polja:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| buyer_name_snapshot | string | ime/naziv nalogodavca u trenutku slanja, snimljeno iz M6 |
| buyer_tax_id_snapshot | string, nullable | PIB u trenutku slanja, ako je pravno lice |

Ovo se dodaje u sam M10 dokument kad se on sledeći put uređuje — ovde je samo zabeleženo kao odluka.

---

## 9. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/crm`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/client-accounts` | GET / POST | |
| `/client-accounts/:id` | GET / PATCH | |
| `/client-accounts/:id/travel-history` | GET | uživo iz M5 |
| `/guest-profiles` | GET / POST | |
| `/guest-profiles/:id` | GET / PATCH | |
| `/guest-profiles/:id/travel-history` | GET | uživo iz M5 |
| `/loyalty-tiers` | GET / POST / PATCH | |
| `/loyalty-status/:clientAccountId` | GET | trenutni nivo i popust — koristi ga M5 pri kreiranju ponude |
| `/loyalty-status/:clientAccountId/override` | POST | ručna dodela nivoa, zahteva razlog |
| `/communication-log` | GET / POST | |

---

## 10. Izlazni kriterijum (M6 deo Faze 3)

- [ ] Gost može samostalno da se registruje na sajtu (kad M8 bude gotov) i time se kreira `ClientAccount` + `GuestProfile` povezani na njegov M1 `User`.
- [ ] Lojalnost se automatski preračunava po potvrdi/otkazivanju rezervacije (test: prelazak praga tačno menja nivo).
- [ ] Ručni override nivoa radi i ostaje trajno vidljiv u audit logu (razlog, ko je odobrio).
- [ ] M5 tok cene ispravno primenjuje popust lojalnosti kao poslednji korak, posle marže.
- [ ] Istorija putovanja se ispravno prikazuje bez ijednog duplog zapisa rezervacije u M6 bazi.
- [ ] AI-generisan nacrt poruke koji pominje cenu ne može biti poslat bez `sent_by` popunjenog ljudskim nalogom.

---

## 11. Otvoreno za dalje

- Tačan period čuvanja/anonimizacije ličnih podataka gosta (pravo na zaborav) — utvrditi sa pravnikom tačan zakonski rok čuvanja (računovodstveni zapisi imaju svoj zakonski rok koji se ne sme skratiti), pre nego što se implementira automatsko brisanje/anonimizacija.
- ~~Da li B2B nalogodavci (subagenti, M7) imaju sopstvenu varijantu programa lojalnosti ili ostaju van njega.~~ **Rešeno u M7 specifikaciji**: B2B nalogodavci ne učestvuju u ovom programu lojalnosti — imaju sopstveni mehanizam popusta (provizija po subagentu), primenjen na isti način (poslednji korak posle marže), umesto poziva ka `/loyalty-status`.
