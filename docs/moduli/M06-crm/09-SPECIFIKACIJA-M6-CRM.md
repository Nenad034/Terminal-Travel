# Specifikacija modula M6 — CRM (Gosti i Nalogodavci)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M6) i poglavlje 8 (Faza 3)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026)
**Verzija:** 1.9 — `CommunicationLog.category` (1.9.2026, na zahtev vlasnika — rešava M5 spec §13 stavku o podsetniku gostu o roku za opciju kod dobavljača, M5 spec §6.1b). Novo polje `category` enum (`MARKETING`, `TRANSAKCIONO`), podrazumevano `MARKETING` — ne menja postojeće ponašanje (poglavlje 4.2/4.3, `marketing_consent` gejt ostaje nepromenjen za tu kategoriju). `TRANSAKCIONO` je nova kategorija za poruke koje obaveštavaju gosta o njegovoj VEĆ POSTOJEĆOJ, plaćenoj/ugovorenoj obavezi (npr. rok za opciju kod dobavljača) — nije reklama, isto obrazloženje kao vaučer/potvrda rezervacije, pa se **šalje bez obzira na `ClientAccount.marketing_consent`**. Detalji u poglavlju 4.1. v1.8 — `M6/client-account/VIEW_ALL` i `M6/post-trip-survey/VIEW_ALL` implementirani u kodu (31.8.2026, isti prolaz kao M10 v1.20/M14 v1.6/M20 v1.6). `ClientAccountsService`/`PostTripSurveysService` sužavaju STAFF-a bez te dozvole — `ClientAccount` (bez DB FK ka M5 Booking) preko dva koraka (klijent nalozi sa bar jednom rezervacijom u sopstvenom vlasništvu/zaduženju), `PostTripSurvey` preko postojeće `booking` relacije. **Provera:** 6 novih jediničnih testova, uživo potvrđeno kroz e2e (213/213). v1.7 — uskladjeno sa novom M1 §3.9a `VIEW_ALL` konvencijom (31.8.2026): "Prodajni agent (sopstveni klijenti)" u poglavlju 7 zamenjeno sa "svi podrazumevano vide sve, sužavanje pojedinačna opcija" — vidi M5 spec §6.6 za pun mehanizam, čisto dokumentaciona dopuna. v1.6 — dodata stavka u poglavlje 11 (Otvoreno za dalje) o EU Digital Identity Wallet (EUDI) kao mogućem budućem izvoru podataka gosta, povodom analize Phocuswright izveštaja 2026 (22.8.2026, nije spec, čeka stvarnu potražnju); v1.5 — Gost dobija stvarne M5/M6/M20 dozvole (poglavlje 7) i ownership sprovođenje u client-account/guest-profile kontrolerima, priprema za M8, avgust 2026; v1.4 — dodat `user.registered.guest` subscriber (poglavlje 6, priprema za M8 samostalnu registraciju gosta, avgust 2026); v1.3 — implementacija (avgust 2026): svi entiteti/endpoint-i iz ovog dokumenta izgrađeni. Dve implementacione dopune: (a) `ClientAccount`/`GuestProfile` reference iz M5 (`Booking.client_account_id`, `BookingItemGuest.guest_profile_id`) i iz M6 (`ClientLoyaltyStatus`/`CommunicationLog`/`PostTripSurvey`) su NAMERNO bez DB-nivo FK ka M6 tabelama — postojeći M10/M11/M20 podaci (i test fixture-i) predviđaju proizvoljne stringove za `client_account_id` kreirane pre M6, tvrd FK bi ih sve pokvario; sprovedeno na nivou aplikacije, ne baze (isti obrazac kao `MarkupRule.scope_id`, M5 §2.1); (b) M6 §4.3 (post-trip anketa) zahteva da `Booking.status` ume da pređe u `COMPLETED` — taj prelaz nikad nije bio definisan u M5 specifikaciji (enum vrednost je postojala od početka, mehanizam nije), dopunjeno M5 §6.1a (v1.20) kao periodičan posao koji CONFIRMED/MODIFIED rezervaciju sa svim stavkama u prošlosti prevodi u COMPLETED i emituje `booking.completed`; v1.2 dodato (avgust 2026, na zahtev vlasnika): automatska anketa posle povratka sa putovanja + ponuda za Google recenziju (poglavlje 4.3); uklonjena zastarela referenca ka M11 `GuestRegistration` (poglavlje 6) jer je taj entitet ukinut u M11 v2.0 (eTurista prijava je nadležnost hotela, ne agencije); v1.1 dodato: tagovi/segmentacija, automatizovane komunikacije po okidaču (rođendan/godišnjica/pred put) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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
| tags | string[] (JSONB niz), nullable | slobodne oznake za segmentaciju (npr. "VIP", "porodica", "senior", "čest putnik") — čisto informativna kategorizacija, ne utiče na M5 cenu ni M6 lojalnost; namenjeno ciljanom slanju u M12, koji sad ima Nivo 2 specifikaciju ali još ne filtrira `EMAIL` kanal po `tags` (samo po `marketing_consent`, M12 poglavlje 4) — ostaje otvoreno dok se ta veza ne doda. Dodato poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 5) |
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
| category | enum: `MARKETING`, `TRANSAKCIONO`, default `MARKETING` | dopuna 1.9.2026 — vidi napomenu ispod. Postojeći okidači (poglavlje 4.2/4.3) ostaju `MARKETING` (nepromenjeno ponašanje); `TRANSAKCIONO` je nova kategorija, prvi korisnik je M5 spec §6.1b (podsetnik gostu o roku za opciju kod dobavljača) |
| summary | text | |
| drafted_by_ai | boolean | |
| sent_by | UUID, nullable (FK → M1 User) | ko je stvarno poslao (ako je poruka pominjala cenu/obavezu, mora biti popunjeno — vidi napomenu) |
| created_at | timestamp | |

**Napomena o autonomiji (poglavlje 7 Master dokumenta):** AI agent sme samostalno da sažima upite i priprema nacrt odgovora (`drafted_by_ai = true`, nivo "Autonomno"). Ako nacrt pominje cenu ili obavezu prema gostu, poruka se **ne šalje** dok je čovek ne pregleda i pošalje (`sent_by` popunjeno) — nivo "Predloži pa čovek odobri".

**`category` — marketinško naspram transakcionog (dopuna 1.9.2026):** `marketing_consent` gejt (poglavlje 4.2/4.3) se primenjuje **isključivo** na `category = MARKETING` — poruke o rođendanu/godišnjici/pred putu/anketi ostaju nepromenjene. `category = TRANSAKCIONO` je za poruke koje obaveštavaju gosta o njegovoj već postojećoj, plaćenoj/ugovorenoj obavezi (npr. rok za opciju kod dobavljača, M5 spec §6.1b) — nije reklama, isto obrazloženje kao vaučer ili potvrda rezervacije, pa se šalje **bez obzira na `marketing_consent`**. Pozivalac (npr. M5 `RemindersService`) postavlja `category` eksplicitno pri kreiranju zapisa — podrazumevana vrednost `MARKETING` znači da izostavljanje polja NIKAD slučajno ne zaobiđe gejt.

**Sažimanje poziva/sastanaka (`channel = PHONE`/`IN_PERSON`):** isti "Autonomno" nivo se primenjuje i kad agent sažima telefonski poziv ili sastanak direktno u `summary` posle završenog razgovora (npr. iz transkripta ili beleški tima), ne samo pisanu prepisku — ne menja arhitekturu, samo eksplicitno pokriva ovaj slučaj. Potvrđeno poređenjem sa PrimeTravel `CRMNotetaker` obrascem (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 5).

### 4.2 Automatizovane komunikacije po okidaču — rođendan, godišnjica, pred put

Pored ručno pokrenutih poruka (4.1), M6 periodičnim poslom prepoznaje tri tipa okidača i priprema nacrt poruke u `CommunicationLog`:
- **Rođendan gosta** — `GuestProfile.date_of_birth`, godišnje na taj datum.
- **Godišnjica prve rezervacije** — datum prve `Booking.confirmed_at` (M5) za dati `client_account_id`, godišnje.
- **Pred put (pre-departure)** — T-7, T-3, T-1 dana pre `BookingItem.stay_from` (M5) za aktivne, potvrđene stavke.
- **Posle povratka (post-trip)** — T+2 dana posle povratka; pokreće anketu, vidi poglavlje 4.3 za pun mehanizam (poseban tok, ne samo `CommunicationLog` zapis kao ostala tri).

Svaka od prva tri generiše `CommunicationLog` zapis sa `drafted_by_ai = true`, nivo **"Autonomno"** — sadržaj je informativan/čestitka, ne pominje cenu ni obavezu, pa **sme da se pošalje bez ljudskog pregleda** ako je `ClientAccount.marketing_consent = true` (poglavlje 2.1), isti izuzetak koji već postoji za "čisto informativne odgovore" u 4.1. Bez saglasnosti, poruka se priprema kao nacrt i čeka ljudsko slanje.

**Napomena o vlasništvu sadržaja:** kad M12 (Marketing/Content Engine) bude specificiran, stvarni tekst/šablon ovih poruka postaje njegov `ContentPiece`, a M6 samo emituje okidač (događaj) — ovaj dokument definiše *kada* se šalje, ne finalni izgled poruke. Dodato poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 5).

### 4.3 Anketa posle putovanja i ponuda za Google recenziju (dopuna, avgust 2026, na zahtev vlasnika)

Kad `Booking.status` (M5) pređe u `COMPLETED` (poslednja stavka rezervacije završena — poslednji `stay_to` prošao), M6 posle **2 dana (T+2)** automatski kreira `PostTripSurvey` zapis i šalje gostu email sa linkom ka kratkoj anketi koju sistem sam renderuje kao javnu formu (link u email-u, ne prilog) — standardan minimalni set: ocena celokupnog iskustva (1-5), da li bi gost preporučio agenciju, slobodan komentar. Tačan izgled/dodatna pitanja i mehanizam javnog renderovanja forme (verovatno tokenizovana stranica bez logina, slično konceptu vaučera) su dizajnersko/tehničko pitanje van obima ove specifikacije, isto obrazloženje kao za vaučer (M5 poglavlje 6) — ovaj dokument definiše samo *kada* se anketa šalje i *šta* čuva.

Ako gost popuni anketu i ostavi visoku ocenu (prag konfigurabilan, podrazumevano ≥ 4/5), forma dodatno nudi link ka Google Business profilu agencije da gost po želji ostavi javnu recenziju — link je statička konfiguracija agencije (isti obrazac kao "Kontakt za hitne slučajeve" u M20 poglavlje 2.3), ne po proizvodu/destinaciji. Klik na taj link se beleži (`google_review_clicked_at`) radi praćenja konverzije — sadržaj same recenzije ostaje na Google-u, van sistema.

**Pravilo o pristanku:** isti mehanizam kao ostala tri okidača u poglavlju 4.2 — automatsko slanje email-a (bez ljudskog pregleda) dozvoljeno je samo ako `ClientAccount.marketing_consent = true`. Bez saglasnosti, `PostTripSurvey` se i dalje kreira (zapis postoji za tu rezervaciju), ali email čeka ljudsko slanje kroz `CommunicationLog` (poglavlje 4.1) umesto da izađe automatski.

#### `PostTripSurvey`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), unique | jedna anketa po rezervaciji |
| client_account_id | UUID (FK → ClientAccount) | kome je poslato |
| access_token | string, unique | deo javnog linka u email-u — gost nema login nalog, pristupa formi preko tokena |
| status | enum: `PENDING`, `SENT`, `COMPLETED` | `PENDING` — zapis kreiran, čeka slanje (bez `marketing_consent`); `SENT` — email poslat; `COMPLETED` — gost popunio |
| scheduled_send_at | timestamp | T+2 dana posle povratka, izračunato pri kreiranju |
| sent_at | timestamp, nullable | |
| responses | JSONB, nullable | fleksibilna struktura pitanje→odgovor, isti obrazac kao `GuestProfile.preferences` (poglavlje 2.2) |
| overall_rating | integer, nullable | glavna ocena (1-5), izdvojena iz `responses` radi lakog izveštavanja |
| wants_google_review | boolean, nullable | da li je gostu ponuđen i da li je pristao na Google recenziju (prag iz teksta iznad) |
| google_review_clicked_at | timestamp, nullable | |
| completed_at | timestamp, nullable | |
| created_at | timestamp | |

---

## 5. Istorija putovanja — čitanje uživo, ne skladištenje

`GET /guest-profiles/:id/travel-history` i `GET /client-accounts/:id/travel-history` spajaju podatke direktno iz M5 (`Booking`, `BookingItem`, `BookingItemGuest`) u trenutku poziva. M6 ne drži sopstvenu kopiju rezervacija.

---

## 6. Zatvaranje ranijih forward-referenci (M5, M10, M11)

- **M5** `Booking.client_account_id` i `BookingItemGuest.guest_profile_id` sada formalno referenciraju `M6.ClientAccount` i `M6.GuestProfile`.
- **M10** `FiscalDocument` treba da **snimi (snapshot)** ime/PIB nalogodavca u trenutku slanja (`SUBMIT`), ne samo da referencira `booking_id` — jer fiskalni dokument mora ostati istorijski tačan i ako se profil nalogodavca kasnije promeni (npr. subagent promeni naziv firme). *Ovo je dopuna M10 specifikacije, primenjena direktno u tom dokumentu (poglavlje 8 ovog dokumenta).*
- ~~**M11** `GuestRegistration`...~~ Uklonjeno (avgust 2026) — M11 više ne prati eTurista prijavu gostiju, to je nadležnost smeštajnog objekta, ne agencije. Vidi `08-SPECIFIKACIJA-M11-COMPLIANCE.md` v2.0.
- **M1 `user.registered.guest` (dopuna avgust 2026, priprema za M8).** Kad se gost sam registruje preko M1 `POST /auth/register` (M1 specifikacija, poglavlje 5), M6 sluša taj event (isti Postgres LISTEN/NOTIFY mehanizam kao ostali event subscriber-i ovog modula, npr. `booking.completed` iz poglavlja 4.3) i automatski kreira `ClientAccount(account_type = INDIVIDUAL)`, povezanu na `User.id` preko `User.linked_profile_id`. **`GuestProfile` se namerno ne pravi u ovom koraku** — zahteva podatke o putnom dokumentu (§2.2: `document_type`, `document_number`, `nationality`, `date_of_birth`) koje registracija ne prikuplja; pravi se kasnije, u toku rezervacije ili kroz ekran profila, kad gost stvarno unese te podatke. M6 ovde nikad ne piše u M1 tabele niti obrnuto — samo reaguje na događaj, isti princip kao ostatak ovog poglavlja. Ovim se delimično ispunjava izlazni kriterijum iz poglavlja 10 ("Gost može samostalno da se registruje... kad M8 bude gotov") — `ClientAccount` deo; `GuestProfile` deo te stavke ostaje vezan za tok gde se putni podaci stvarno unose.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M6/client-account/VIEW`, `CREATE`, `EDIT` | Vlasnik, Direktor, Sales Manager, Prodajni agent (svi podrazumevano, isti `VIEW_ALL` obrazac kao M5 poglavlje 6.6/M1 §3.9a — sužavanje na sopstvene je pojedinačna, ne podrazumevana opcija); Računovođa (VIEW radi fakturisanja); Gost (`VIEW`/`EDIT`, isključivo sopstveni nalog — `CREATE` namerno izostavljen, gost sebi ne pravi dodatne naloge, sopstveni već nastaje preko M1 registracije, poglavlje 6) |
| `M6/guest-profile/VIEW`, `CREATE`, `EDIT` | isto kao gore, uključujući Gost (sopstveni profil — `CREATE` ovde JESTE dozvoljen, gost sam unosi podatke o putnom dokumentu koje registracija nije prikupila, poglavlje 6) |
| `M6/loyalty-tier/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M6/loyalty-tier/EDIT` (definicije nivoa) | Vlasnik, Direktor |
| `M6/loyalty-status/OVERRIDE` | Vlasnik, Direktor — obavezan razlog, upisuje se u audit log |
| `M6/communication-log/VIEW`, `CREATE` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M6/post-trip-survey/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent (svi podrazumevano, isti `VIEW_ALL` obrazac kao gore) — gost pristupa sopstvenoj anketi preko `access_token` iz email-a, ne preko ove dozvole |

Uloga **Gost** ima pristup isključivo sopstvenom `ClientAccount`/`GuestProfile` (preko `linked_user_id`), bez pristupa internom panelu.

**Vlasništvo, ne samo dozvola (dopuna avgust 2026, priprema za M8, isti obrazac kao M5 spec §6.2).** `M6/client-account/VIEW,EDIT` i `M6/guest-profile/VIEW,CREATE,EDIT` sami po sebi ne razlikuju "sopstveno" od "tuđe" — to sprovode `ClientAccountsController`/`GuestProfilesController` eksplicitno: kad pozivalac ima `account_type = GUEST` (učitano uživo po `userId`, isti mehanizam kao M5), `:id` operacije i liste se ograničavaju na `ownClientAccountId` (`User.linked_profile_id`) odnosno profile povezane preko `linked_client_account_id` — pokušaj pristupa tuđem zapisu vraća 404, ne otkriva postojanje.

**Nalaz i ispravka (30.8.2026, Faza 8 IDOR pregled — `docs/analize/34-FAZA8-BEZBEDNOSNI-PREGLED.md`).** `GuestProfilesService.create()` je od početka sprečavao gosta da poveže NOV profil sa tuđim nalogom (`linked_client_account_id !== ownAccountId` → `ForbiddenException`), ali `update()` je istu proveru propuštao — gost je mogao da izmeni SOPSTVENI (već-vlastiti) profil i u istoj poruci prebaci `linked_client_account_id` na tuđ nalog, jer `update()` je proveravao samo da profil TRENUTNO pripada pozivaocu, ne i da NOVA vrednost tog polja ostaje njegova. Ispravljeno — `update()` sad primenjuje istu proveru kao `create()`, dokazano jediničnim testovima (`guest-profiles.service.spec.ts`).

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
| `/post-trip-surveys` | GET | lista, filtrirano po `booking_id`/statusu (prava pristupa iz poglavlja 7) |
| `/post-trip-surveys/:token` | GET | javni pristup (bez autentikacije) — gost otvara formu preko linka iz email-a |
| `/post-trip-surveys/:token/submit` | POST | javni pristup — gost šalje `responses`/`overall_rating`, popunjava `completed_at` |
| `/post-trip-surveys/:token/google-review-click` | POST | javni pristup — beleži `google_review_clicked_at` pre redirekta na Google link |

---

## 10. Izlazni kriterijum (M6 deo Faze 3)

- [ ] Gost može samostalno da se registruje na sajtu i time se kreira `ClientAccount` povezan na njegov M1 `User` (poglavlje 6, `user.registered.guest`); `GuestProfile` se pravi naknadno, kad gost unese podatke o putnom dokumentu (tok rezervacije ili profil naloga) — sam registracijski korak ga namerno ne kreira.
- [x] Lojalnost se automatski preračunava po potvrdi/otkazivanju rezervacije (test: prelazak praga tačno menja nivo). *(`test/m6-exit-criteria.e2e-spec.ts` §3.2)*
- [x] Ručni override nivoa radi i ostaje trajno vidljiv u audit logu (razlog, ko je odobrio). *(§3.2, audit log potvrđen u testu)*
- [x] M5 tok cene ispravno primenjuje popust lojalnosti kao poslednji korak, posle marže. *(§3.3, poređenje sa/bez `clientAccountId`)*
- [x] Istorija putovanja se ispravno prikazuje bez ijednog duplog zapisa rezervacije u M6 bazi. *(§5, uživo iz M5, M6 ne drži kopiju)*
- [x] AI-generisan nacrt poruke koji pominje cenu ne može biti poslat bez `sent_by` popunjenog ljudskim nalogom. *(§4.1, sprovedeno u `CommunicationLogService.create` — `sent_by` uvek `null` za `draftedByAi=true`, jedini put je `POST .../mark-sent`)*
- [x] Rođendan/godišnjica/pred-put okidači ispravno generišu `CommunicationLog` zapis na tačan datum, i šalju se automatski samo uz `marketing_consent = true`. *(§4.2, `M6TriggersService`, `sentBy='SYSTEM_AUTO'` samo uz saglasnost)*
- [x] `ClientAccount.tags` se ispravno čuva i vraća preko API-ja, bez uticaja na izračun cene ili lojalnosti. *(§2.1)*
- [x] `PostTripSurvey` se automatski kreira tačno 2 dana posle prelaska `Booking` u `COMPLETED`; email se automatski šalje samo ako je `marketing_consent = true`, inače čeka ljudsko slanje. *(§4.3, `PostTripSurveysService.createForBooking`/`sendDueSurveys`)*
- [x] Popunjena anketa sa ocenom ≥ praga ispravno prikazuje ponudu za Google recenziju; klik na link se beleži u `google_review_clicked_at`, nezavisno od toga da li je recenzija stvarno ostavljena na Google-u. *(§4.3)*
- [x] `CommunicationLog.category = TRANSAKCIONO` se šalje bez obzira na `marketing_consent`; `category = MARKETING` (podrazumevano) zadržava postojeći gejt nepromenjen. *(§4.1, potvrđeno testom preko M5 `RemindersService` poziva)*

---

## 11. Otvoreno za dalje

- Tačan period čuvanja/anonimizacije ličnih podataka gosta (pravo na zaborav) — utvrditi sa pravnikom tačan zakonski rok čuvanja (računovodstveni zapisi imaju svoj zakonski rok koji se ne sme skratiti), pre nego što se implementira automatsko brisanje/anonimizacija.
- ~~Da li B2B nalogodavci (subagenti, M7) imaju sopstvenu varijantu programa lojalnosti ili ostaju van njega.~~ **Rešeno u M7 specifikaciji**: B2B nalogodavci ne učestvuju u ovom programu lojalnosti — imaju sopstveni mehanizam popusta (provizija po subagentu), primenjen na isti način (poslednji korak posle marže), umesto poziva ka `/loyalty-status`.
- **EU Digital Identity Wallet (EUDI) kao izvor podataka gosta** (22.8.2026, zapaženo iz spoljnog izvora — Phocuswright "Travel Innovation and Technology Trends 2026" — proverenog protiv zvaničnog regulatornog rasporeda) — eIDAS 2.0 (Uredba EU 2024/1183) obavezuje države članice da do kraja 2026. obezbede bar jedan sertifikovan EUDI novčanik građanima, a krupne platforme/regulisani sektori (bankarstvo, zdravstvo, telekom, VLOP) moraju da ga *prihvate* kao metod autentikacije do kraja 2027. Terminal Travel kao mala agencija **nije** u obavezanom krugu prihvatanja, ali gost koji poseduje novčanik bi mogao njime da popuni `GuestProfile` (ime, dokument, državljanstvo — poglavlje 3) jednim skeniranjem umesto ručnog unosa pri M8/M9 checkout-u — direktno smanjuje trenje na tačno mestu koje danas najviše troši vreme gosta. Nije spec, čeka: (a) da li ijedan realan srpski/regionalni gost do 2027. stvarno ima aktivan novčanik (obaveza je na državama članicama EU, Srbija nije EU), (b) tehnički SDK/protokol za verifikaciju potpisanih atributa (van poglavlja 6 tehničkog steka, zahteva potvrdu vlasnika pre uvođenja), (c) da li ide kao alternativni unos u M6 `GuestProfile` ili kao poseban M11 usklađenosni mehanizam. Razmotriti tek kad se pokaže stvarna potražnja gostiju iz EU tržišta, ne pre.
