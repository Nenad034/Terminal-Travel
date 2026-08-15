# Specifikacija modula M7 — B2B modul (Subagenti)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M7) i poglavlje 8 (Faza 4)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026) — poglavlja 2.1/3/3.1/3.2/4/5/6/7/8/9/10 i deo 11 (backend API); poglavlja 2.0.1–2.0.4 (portal frontend, omnisearch, AI chat) čekaju M8-obrazac portala i M15, vidi poglavlje 12
**Verzija:** 1.6 — kraj-do-kraja povezivanje `CommissionRebate` sa M10 `KNJIZNO_ODOBRENJE` (avgust 2026, poglavlje 3.2 dopuna): `approve()` sad ide `DRAFT → APPROVED` (ne direktno `APPLIED`), sinhrono pokreće M10 nacrt preko `FiscalDocumentStubService`; `APPLIED` se postavlja tek kad M10 stvarno pošalje taj dokument (Event Bus `M10 credit_note.submitted`, `M7EventSubscribersService`/`CommissionRebatesService.markApplied`) — zatvara stavku koja je čekala M7 implementaciju u M10 spec §5.1a/§11; e2e dokazano (`apps/api/test/m7-exit-criteria.e2e-spec.ts`, 18/18); v1.5 — implementacija (avgust 2026): Prisma modeli `Subagent`/`CommissionVolumeTier`/`SubagentVolumeStatus`/`CommissionRebate`, `SUBAGENT_ADMIN` uloga (M1 katalog), M5 izmene (`SubagentStubService`, kreditni limit pre M3/M4, provizija umesto M6 lojalnosti), e2e testovi (`apps/api/test/m7-exit-criteria.e2e-spec.ts`, 17/17); poglavlje 12 ažurirano — vidi tačan spisak stavki koje čekaju M15/portal frontend; v1.4 dodato poglavlje 2.0.4 (AI agent chat za subagente sa izvršnim ovlašćenjem — pretraga/rezervacija/plaćanje/vaučer unutar kreditnog limita, dva gejta: potvrda subagenta uvek, pregled osoblja iznad praga), zatvara problem #8 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, na zahtev vlasnika (avgust 2026); v1.3 dodato poglavlje 2.0.3 (univerzalna pretraga i AI razgovor — omnisearch), dopunjuje M15 poglavlje 6.5 (avgust 2026, na zahtev vlasnika); v1.2 dodato poglavlje 2.0 (struktura portala i tok rezervacije korak po korak, ekvivalent M8 poglavlja 2/3), pojašnjeno prepoznavanje Subagenta u M5 toku (poglavlje 5), rešava strukturni nalaz iz `VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026, na zahtev vlasnika); v1.1 dodata stavka izlaznog kriterijuma za responsive prikaz (Master dokument poglavlje 5.1)
**Zavisi od:** M1, M2, M5, M6, M10 (poglavlje 3.2, `CommissionRebate` → `KNJIZNO_ODOBRENJE`, dodato avgust 2026), M15 (poglavlje 2.0.3, omnisearch; poglavlje 2.0.4, AI agent chat sa izvršnim ovlašćenjem)

---

## 1. Svrha i obim modula

M7 omogućava mrežu poslovnih partnera (subagenata) sa više nivoa (subagent može imati svoje sub-subagente) da kupuju proizvode iz M2 preko istog M5 toka rezervacije, uz sopstvenu proviziju, kreditni limit i strogo odvojenu vidljivost po nivou — potvrđeno u poglavlju 11 Master dokumenta.

Subagent je poslovno **`ClientAccount`** iz M6 (`account_type = LEGAL_ENTITY`) — M7 samo dodaje B2B-specifične podatke (hijerarhija, provizija, kredit) na taj postojeći profil, ne duplira ga.

---

## 2.0 Struktura portala i tok rezervacije korak po korak (dopuna, avgust 2026 — ekvivalent M8 poglavlja 2/3)

M7 je do sada opisivao model podataka, proviziju i kreditni limit, ali ne i stvaran tok kroz portal — za razliku od M8, koji ima eksplicitnu mapu ruta (M8 poglavlje 2) i korak-po-korak tok (M8 poglavlje 3). Ovo poglavlje zatvara tu rupu (nalaz iz `VALIDACIJA-WORKFLOW-B2B.md`, "M7 nema ekvivalent M8 §2/§3").

### 2.0.1 Rute (isti princip kao M8 — portal nema sopstvenu bazu, samo poziva interne API-je)

| Ruta | Sadržaj | Izvor podataka |
| :---- | :---- | :---- |
| `/b2b/prijava` | Prijava `SUBAGENT_ADMIN` naloga | M1 `/auth/*` |
| `/b2b/pocetna` | Pregled: tekuće stanje duga naspram kreditnog limita, tekuća provizija/obimski status, aktivne rezervacije | M7 `/subagents/:id/outstanding-balance`, `/subagents/:id/volume-status` |
| `/b2b/pretraga` | Rezultati pretrage (isti katalog kao M8, filtriran na `visible_channels` koji uključuje `B2B_PORTAL`, M2 poglavlje 5) | M5 `/search?channel=B2B_PORTAL` |
| `/b2b/[tip]/[slug]` | Stranica proizvoda — **bez** identiteta dobavljača (M2 poglavlje 5.1) | M2 `/products/:id` |
| `/b2b/rezervacija/ponuda` | Pregled ponude sa već primenjenom proviziom (M7 poglavlje 5) pre potvrde | M5 `/quotes/:id` |
| `/b2b/rezervacija/putnici` | Unos podataka krajnjeg putnika kog subagent prijavljuje (poglavlje 7) | M6 `/guest-profiles` |
| `/b2b/rezervacija/uslovi` | Prihvatanje uslova ugovora (clickwrap), subagent prihvata u ime sopstvenog naloga | M20 poglavlje 3.2, M5 `Quote.contract_terms_accepted` |
| `/b2b/rezervacija/potvrda` | Potvrda, broj rezervacije, vaučer (odmah dostupan za subagenta unutar kredita, M5 poglavlje 6.3) | M5 `/bookings/:id` |
| `/b2b/moje-rezervacije` | Lista rezervacija ovog subagenta, statusi, vaučeri | M5 `/bookings?client_account_id=...` |
| `/b2b/moja-mreza` | Sopstveni direktni sub-subagenti — pregled, upravljanje provizijom (poglavlje 3) | M7 `/subagents/:id/children` |
| `/b2b/profil` | Podaci naloga, kreditni limit/provizija (samo pregled — izmenu radi agencija ili roditeljski subagent) | M6 `/client-accounts/:id`, M7 `/subagents/:id` |
| `/b2b/chat` | AI agent chat sa izvršnim ovlašćenjem (poglavlje 2.0.4) — vidljivo samo ako je `Subagent.ai_chat_enabled = true` | M7 `/subagents/:id/chat-messages`, `/subagents/:id/booking-requests` |

### 2.0.2 Tok pretrage i rezervacije (korak po korak, isti obrazac kao M8 poglavlje 3)

1. **Pretraga** — `SUBAGENT_ADMIN` prijavljen (nema anonimnog razgledanja na B2B portalu, za razliku od M8). Poziva `GET /search?channel=B2B_PORTAL` (M5 poglavlje 11) — rezultati već isključuju proizvode koji nisu `visible_channels` uključujući `B2B_PORTAL`, i ne sadrže identitet dobavljača (M2 poglavlje 5.1).
2. **Izbor i ponuda** — kreira se `Quote` (M5 poglavlje 3.1), `client_account_id` = subagentov `ClientAccount`, `channel = B2B_PORTAL`. Cena: marža (M5 poglavlje 2) → provizija subagenta (M7 poglavlje 5, ne M6 lojalnost).
3. **Podaci putnika** — subagent unosi podatke krajnjeg putnika (`GuestProfile`, poglavlje 7); putnik nema sopstveni login kod Terminal Travel.
4. **Prihvatanje uslova ugovora** — isti clickwrap mehanizam kao M8 (`Quote.contract_terms_accepted`, M5 poglavlje 3.1) — subagent prihvata u ime svog naloga (M20 poglavlje 3.2), ne u ime krajnjeg putnika.
5. **Potvrda** — M5 poglavlje 4: proverava se garancija putovanja (ako `tip_nastupanja = ORGANIZATOR`) pa kreditni limit (poglavlje 4 ovog dokumenta), tim redosledom (M5 poglavlje 4, korak 1). Plaćanje po pravilu ide na kredit/avans (`BANK_TRANSFER`, M10) — kartično plaćanje sa portala nije isključeno, ali nije podrazumevan način za B2B.
6. **Vaučer** — generiše se automatski čim je `Booking.status = CONFIRMED`, bez čekanja na punu uplatu, pod uslovom da je subagent `ACTIVE` i rezervacija unutar kredita (M5 poglavlje 6.3) — subagent može odmah da servisira svog klijenta.
7. **Otkazivanje** — ide kroz isti `POST /bookings/:id/cancel` kao svaki drugi kanal (M5 poglavlje 6), bez posebnog B2B toka. Ovo znači da provera duplikata pri otkazivanju (M5 poglavlje 6.4, dodato avgust 2026 — sprečava da se pogrešno otkaže rezervacija koja se poklapa sa drugom aktivnom rezervacijom istog gosta preko drugog kanala, npr. direktna B2C rezervacija istog hotela/termina) automatski važi i za storno koji izvrši subagent ili operater u njegovo ime — bez ikakve dodatne implementacije u ovom modulu.

### 2.0.3 Univerzalna pretraga i AI razgovor — omnisearch (dopuna, avgust 2026, na zahtev vlasnika)

Isto polje kao M17/M8 (M15 poglavlje 6.5), dostupno sa svake `/b2b/*` rute. Prazan upit + Enter prikazuje rute iz poglavlja 2.0.1 filtrirane na `SUBAGENT_ADMIN` ulogu. Upit sa tekstom poziva `POST /ai-orchestration/omnisearch` sa `channel = B2B_PORTAL` — obim: katalog (bez identiteta dobavljača, M2 poglavlje 5.1), sopstvene rezervacije, sopstvena mreža sub-subagenata (poglavlje 6 — subagent ne dobija u rezultatima ništa od svog sub-subagenta van onoga što mu inače sme da vidi), sopstvena provizija/kreditni limit. Primer: "koliko mi je ostalo do sledećeg praga provizije" (poziva M7 poglavlje 3.1 `volume-status`).

**Razlika u odnosu na poglavlje 2.0.4 dole:** `OmnisearchAgent` (M15 poglavlje 6.5.1) je striktno read-only — nikad ne izvršava radnju, samo vraća link ka stranici gde subagent ručno potvrđuje kroz portal formu. Poglavlje 2.0.4 opisuje **drugi, dodatni agent** koji sme da **izvrši** pretragu→ponudu→rezervaciju u ime subagenta, unutar eksplicitno definisanih granica — različit nivo ovlašćenja, različita dozvola, svesno odvojen od omnisearch-a.

### 2.0.4 AI agent chat za subagente — izvršno ovlašćenje unutar kreditnog limita (dopuna, avgust 2026 — zatvara problem #8 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, gap #8 iz `24-GAP-ANALIZA-PROBLEMI-VS-ARHITEKTURA.md`)

Cilj (vlasnikova formulacija): subagent može, kroz razgovor, da pretraži ponude, rezerviše, plati i dobije vaučer **bez pozivanja agencije** — brže od popunjavanja forme korak-po-korak (poglavlje 2.0.2), uz nadzor i jasne granice. Ovo je M7 domenski agent (M15 poglavlje 2, `agent_role = DOMENSKI_AGENT`, `module_code = M7`) — ne novi tip agenta, isti model kao svaki drugi domenski agent, sa dozvolama ograničenim na M7/M5/M2 API-je istog obima koji portal već ima (poglavlje 2.0.1), aktivan tek kad `ModuleAgentActivation` za M7 pređe u `ACTIVATED` (M15 poglavlje 3) — ista pretpostavka kao svaki drugi domenski agent.

#### 2.0.4a Dopuna `Subagent` (poglavlje 2.1) — eksplicitno uključivanje po partneru (potvrđeno na zahtev vlasnika)

Mogućnost **nije** uključena po difoltu za svaki `ACTIVE` subagent — agencija svesno uključuje za konkretnog partnera, isti oprez kao `MailboxAccess` dodela u M22:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| ai_chat_enabled | boolean, default `false` | uključuje Vlasnik/Direktor, ista dozvola kao `M7/subagent/EDIT` (poglavlje 10) |
| ai_chat_review_threshold_amount / currency | decimal / string, nullable | **obavezno popunjeno ako je `ai_chat_enabled = true`** — prag iznad kog rezervacija iz chat-a, i posle potvrde subagenta, ipak čeka pregled osoblja agencije pre izvršenja (poglavlje 2.0.4c). Postavlja se u istom koraku kao uključivanje, isti autoritet (Vlasnik/Direktor) |

#### 2.0.4b Model podataka

##### `SubagentBookingRequest`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subagent_id | UUID (FK → Subagent) | |
| quote_id | UUID (FK → M5 Quote) | agent priprema kroz isti M5 tok kao portal forma (poglavlje 2.0.2, koraci 1–4), sa istom cenom (poglavlje 5) |
| requires_staff_review | boolean | izračunato pri kreiranju: `Quote.total_price > Subagent.ai_chat_review_threshold_amount` (poglavlje 2.0.4a) |
| status | enum: `AWAITING_SUBAGENT_CONFIRMATION`, `AWAITING_STAFF_REVIEW`, `EXECUTING`, `CONFIRMED`, `REJECTED`, `FAILED` | vidi tok u poglavlju 2.0.4c |
| subagent_confirmed_at / subagent_confirmed_by | timestamp / UUID (FK → M1 User) | **isključivo nalog `SUBAGENT_ADMIN` istog `subagent_id`** — sistem odbija potvrdu sa bilo kog drugog naloga, uključujući drugog subagenta u istom lancu |
| staff_reviewed_at / staff_reviewed_by | timestamp / UUID (FK → M1 User), nullable | popunjeno samo kad `requires_staff_review = true` (poglavlje 2.0.4c) — **nikad AI agent** |
| staff_review_decision | enum: `APPROVED`, `REJECTED`, nullable | |
| rejection_reason | string, nullable | popunjeno i za odbijanje subagenta i za odbijanje osoblja |
| booking_id | UUID, nullable (FK → M5 Booking) | popunjeno posle uspešne M5 potvrde (poglavlje 2.0.4c, korak 5) |
| created_at / updated_at | timestamp | |

##### `SubagentChatMessage` — transkript razgovora (radi revizije spora oko rezervacije nastale ovim putem)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subagent_id | UUID (FK → Subagent) | |
| booking_request_id | UUID, nullable (FK → `SubagentBookingRequest`) | popunjeno čim razgovor dovede do konkretnog zahteva |
| sender_type | enum: `SUBAGENT`, `AI_AGENT` | |
| body | text | |
| created_at | timestamp | |

#### 2.0.4c Tok — dva nezavisna gejta pre izvršenja

1. **Pretraga i priprema ponude** — agent pretražuje (isti `GET /search?channel=B2B_PORTAL` kao poglavlje 2.0.2, korak 1) i priprema `Quote` sa već primenjenom provizijom (poglavlje 5) — nivo **"Autonomno"**, ništa još nije obavezujuće.
2. **Podaci putnika i uslovi ugovora** — agent prikuplja kroz razgovor podatke krajnjeg putnika (poglavlje 7) i traži eksplicitno prihvatanje uslova ugovora (`Quote.contract_terms_accepted`, isti mehanizam kao poglavlje 2.0.2 korak 4 — ovo se **ne** preskače u chat toku).
3. **Potvrda subagenta (Gejt A — uvek, bez izuzetka)** — agent prikazuje kompletan sažetak (proizvod, cena, putnik, uslovi) i traži eksplicitnu potvrdu. `SubagentBookingRequest.status = AWAITING_SUBAGENT_CONFIRMATION` dok se ne dobije — nivo **"Predloži pa čovek odobri"** (`subagent_chat.booking_confirm`, M15 poglavlje 4), gde je "čovek" sam subagent koji potvrđuje sopstvenu porudžbinu, ne osoblje agencije. Bez ove potvrde, agent ne sme pozvati M5 potvrdu rezervacije ni pod kojim uslovom.
4. **Pregled osoblja (Gejt B — samo iznad praga)** — ako `requires_staff_review = true` (poglavlje 2.0.4a), status prelazi u `AWAITING_STAFF_REVIEW` i zahtev se pojavljuje u M15 Agent Inbox (poglavlje 6 te specifikacije) — Vlasnik, Direktor ili Sales Manager odobrava ili odbija, **nikad AI agent**, nezavisno od toga što je subagent već potvrdio u koraku 3. Ako `requires_staff_review = false`, ovaj korak se preskače.
5. **Izvršenje** — tek posle oba primenjiva gejta, sistem poziva **isti** M5 tok potvrde kao portal forma (poglavlje 2.0.2, korak 5 — garancija pa kreditni limit, M5 poglavlje 4 korak 1, M7 poglavlje 4) — deterministički poziv, ne nova AI odluka. Uspeh: `status = CONFIRMED`, `booking_id` popunjeno, vaučer se automatski izdaje pod istim uslovom kao svaki drugi B2B kanal (M5 poglavlje 6.3, nepromenjeno). Neuspeh (npr. kapacitet u međuvremenu prodat, kreditni limit ipak prekoračen jer je stanje duga promenjeno između koraka 3 i 5): `status = FAILED`, agent objašnjava razlog subagentu u chat-u.

#### 2.0.4d Plaćanje — nikad kroz chat direktno

Chat ne prikuplja niti obrađuje podatke kartice ni u kom trenutku — isti princip kao M10 poglavlje 7.1 (hostovana forma sertifikovanog provajdera). Podrazumevan način ostaje kredit/avans (M10, isto kao poglavlje 2.0.2 korak 5); ako subagent želi kartično plaćanje, agent vraća link ka istom sertifikovanom checkout-u koji koristi portal (M10 poglavlje 7.2), nikad ne pokušava da to izvede unutar razgovora.

#### 2.0.4e Granice ovlašćenja agenta

Agent nema pristup ničemu van sopstvenog `subagent_id` konteksta (isto ograničenje kao portal nalog tog subagenta, poglavlje 6) — ne vidi niti rezerviše u ime drugog subagenta, uključujući sopstvenu decu u hijerarhiji. Agent nikad sam ne menja `Subagent.ai_chat_enabled`/`ai_chat_review_threshold_amount`, ne odobrava sopstveni `SubagentBookingRequest` u ime osoblja (korak 4), i ne otkazuje rezervaciju kroz chat bez istog toka provere duplikata kao svaki drugi kanal (M5 poglavlje 6.4, poglavlje 2.0.2 korak 7 ovog dokumenta) — otkazivanje kroz chat i dalje ide kroz `POST /bookings/:id/cancel`, sa istim upozorenjem i istom potrebnom svesnom potvrdom kao bilo koji drugi operater.

---

## 2. Model podataka

### 2.1 `Subagent`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_account_id | UUID (FK → M6 ClientAccount, unique) | mora biti `account_type = LEGAL_ENTITY` |
| parent_subagent_id | UUID, nullable (FK → self) | `null` = direktan partner agencije (Tier 1) |
| status | enum: `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED` | |
| commission_percentage | decimal | vidi poglavlje 3 — ko ga postavlja zavisi od `parent_subagent_id` |
| credit_limit / credit_limit_currency | decimal / string | |
| approved_by | UUID, nullable (FK → M1 User) | ko je odobrio prelazak u `ACTIVE` |
| approved_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

**`current_outstanding_balance`** se **ne čuva** kao polje — računa se uživo kao zbir `Booking.total_price` za sve rezervacije ovog `client_account_id` gde je `payment_status` u (`UNPAID`, `PARTIALLY_PAID`, `INVOICE_PENDING`), umanjen za primljene delimične uplate (M10). Isti princip kao istorija putovanja u M6 — jedan izvor istine, ne duplirano stanje.

---

## 3. Kaskadna provizija (potvrđeno)

- Za **Tier 1** subagenta (`parent_subagent_id IS NULL`): `commission_percentage` postavlja **isključivo Vlasnik/Direktor** agencije.
- Za **sub-subagenta** (`parent_subagent_id IS NOT NULL`): `commission_percentage` postavlja **njegov roditeljski subagent**, kroz sopstveni portal nalog — agencija se u to ne meša.
- **Ograda:** sistem ne dozvoljava da `commission_percentage` deteta bude veći od `commission_percentage` roditelja u trenutku postavljanja — sprečava da roditelj (slučajno ili namerno) da detetu veću proviziju nego što sam prima, što bi značilo da roditelj gubi novac na svakoj prodaji tog deteta. Ovo je provera podataka, ne kontrola stvarnih poslovnih dogovora van sistema.

### 3.1 Uvećanje provizije po obimu poslovanja (If-Then)

Pored fiksne `commission_percentage`, subagent može imati stepenaste pragove: **ako** u posmatranom periodu dostigne određeni obim prodaje, **onda** mu se provizija automatski podiže na viši procenat — dok se prag ne dostigne, ostaje na osnovnoj (ili prethodnoj) proviziji. Autoritet ko postavlja ove pragove je **isti kao za osnovnu proviziju** (poglavlje 3): agencija za Tier 1, roditeljski subagent za svoju decu.

#### `CommissionVolumeTier`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subagent_id | UUID (FK → Subagent) | pragovi su specifični za svaki subagentski odnos, ne globalni (za razliku od M6 `LoyaltyTier`, jer su B2B ugovori pojedinačno pregovarani) |
| rank | integer | redosled (viši broj = viši prag) |
| threshold_metric | enum: `TOTAL_SALES_RSD`, `BOOKING_COUNT`, `NIGHT_COUNT` | isti izbor metrika kao M6 `LoyaltyTier`, radi doslednosti |
| threshold_period | enum: `CALENDAR_QUARTER`, `CALENDAR_YEAR`, `ROLLING_12_MONTHS` | obimski bonusi se obično mere po kraćem periodu nego lojalnost |
| threshold_value | decimal | prag ("Ako"), npr. 50.000 EUR |
| resulting_commission_percentage | decimal, nullable | procenat koji važi kad je prag dostignut ("Onda") |
| resulting_commission_fixed_amount | decimal, nullable | fiksan iznos po rezervaciji, dodatno uz procenat — isti obrazac kao `MarkupRule` u M5 (bar jedno od dva mora biti postavljeno) |
| resulting_commission_currency | string, nullable | valuta fiksnog iznosa |
| retroactive | boolean, default false | **potvrđeno:** ako je `true`, prelazak praga usred perioda ne menja samo buduće rezervacije (poglavlje 3.1) nego pokreće i jednokratni obračun rabata za ceo dotadašnji promet u periodu (poglavlje 3.2) |
| created_by | UUID (FK → M1 User ili roditeljski subagent) | |
| created_at | timestamp | |

I ovde važi ista formula i isti redosled kao `MarkupRule` (M5, poglavlje 2): `rezultujuća_provizija_cena = osnovna_cena * (1 - percentage / 100) - fixed_amount`.

#### `SubagentVolumeStatus`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subagent_id | UUID (FK, unique) | |
| calculated_metric_value | decimal | tekuća vrednost u posmatranom periodu |
| current_tier_id | UUID, nullable (FK → CommissionVolumeTier) | najviši prag koji je trenutno dostignut |
| effective_commission_percentage | decimal | `CommissionVolumeTier.resulting_commission_percentage` ako je prag dostignut, inače `Subagent.commission_percentage` — **ovo polje se koristi u formuli cene iz poglavlja 5**, ne osnovna provizija direktno |
| period_start / period_end | date | tekući prozor merenja (zavisi od `threshold_period`) |
| last_recalculated_at | timestamp | |

**Automatski preračun:** isti obrazac kao M6 lojalnost — pretplata na `booking.confirmed`/`booking.cancelled` iz M5 Event Bus-a, ponovni izračun `calculated_metric_value` i `current_tier_id` za pogođenog subagenta.

**Ograda iz poglavlja 3 koristi `effective_commission_percentage`:** kad roditeljski subagent postavlja proviziju svom detetu, plafon je njegova **trenutna** efektivna provizija (uključujući eventualni obimski bonus), ne samo osnovna. Ako roditeljev obimski bonus kasnije istekne (padne ispod praga u novom periodu) i time njegova efektivna provizija postane niža od već postavljene provizije deteta, sistem to **ne menja automatski unazad** — umesto toga generiše upozorenje agenciji/roditelju da postojeći odnos treba preispitati, jer tiho menjanje već dogovorene provizije deteta bez ljudske odluke nije prihvatljivo (princip #4 — determinizam pre autonomije).

### 3.2 Retroaktivni rabat (potvrđeno — kao poseban rabat, ne ponovno otvaranje faktura)

Kad se dostigne prag sa `retroactive = true` **usred perioda**, promena za buduće rezervacije (poglavlje 3.1) nije dovoljna — potrebno je nadoknaditi razliku i za promet koji je već ostvaren u tom periodu. Ovo se **ne** radi storniranjem i ponovnim izdavanjem već poslatih fiskalnih dokumenata (M10) — umesto toga, sistem obračunava jednokratan rabat:

`rabat = Σ [booking.total_price * (nova_provizija% − dotadašnja_efektivna_provizija%) / 100] + (broj_rezervacija_u_periodu * (novi_fixed_amount − dotadašnji_fixed_amount))`

preko svih rezervacija tog subagenta potvrđenih u tekućem periodu **pre** prelaska praga.

#### `CommissionRebate`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subagent_id | UUID (FK → Subagent) | |
| triggering_tier_id | UUID (FK → CommissionVolumeTier) | koji prag je pokrenuo obračun |
| period_start / period_end | date | |
| calculated_amount / currency | decimal / string | rezultat formule iznad |
| status | enum: `DRAFT`, `APPROVED`, `APPLIED`, `REJECTED` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno ljudski nalog** — direktan uticaj na novac, isti obrazac kao M10 slanje fiskalnog dokumenta ("Predloži pa čovek odobri" iz poglavlja 7 Master dokumenta) |
| approved_at | timestamp, nullable | |
| applied_at | timestamp, nullable | |
| created_at | timestamp | |

**Tok:** sistem automatski kreira `CommissionRebate` u statusu `DRAFT` čim se pređe `retroactive` prag (nivo "Autonomno" — samo obračun, ništa se ne menja). Vlasnik, Direktor ili Računovođa pregleda i prevodi u `APPROVED` (`POST /subagents/:id/commission-rebates/:rebateId/approve`) — ovo je ljudska odluka, ne knjiženje. Ako se odbije (`REJECTED`), ostaje trajno vidljiv u audit logu sa razlogom.

**Povezivanje sa M10 (implementirano, avgust 2026 — M7 i M10 sad oba postoje u kodu):** čim rabat pređe u `APPROVED`, M7 sinhrono (in-process DI poziv, `FiscalDocumentStubService` u `apps/api/src/modules/m7-b2b-subagenti/commission/`) traži od M10 da pripremi `FiscalDocument` nacrt tipa `KNJIZNO_ODOBRENJE` (M10 spec §5.1a) — `amount`/`currency` iz `calculated_amount`/`currency`, `related_subagent_id`/`credited_rebate_id` iz ovog zapisa, `buyer_name_snapshot` popunjen stvarnim nazivom firme subagenta (M6 `ClientAccount.company_name`, preko `Subagent.client_account_id`). Rabat **ostaje `APPROVED`** dok taj nacrt čeka slanje — `APPLIED` se postavlja tek kad Računovođa/Direktor/Vlasnik stvarno pošalje taj `FiscalDocument` (M10 `POST /fiscal-documents/:id/submit`, isključivo ljudski nalog), ne pri odobrenju na M7 strani. M10 obaveštava M7 o tom trenutku preko Event Bus-a (`M10` `credit_note.submitted`, `M7EventSubscribersService` sluša i zove `CommissionRebatesService.markApplied`) — namerno **ne** direktan DI poziv u tom smeru, da se izbegne kružna zavisnost modula (M7 već uvozi M10 za korak "priprema nacrta"; obrnut DI smer bi napravio ciklus).

---

## 4. Kreditni limit — sprovodi se pri potvrdi rezervacije (rešava otvoreno pitanje iz M5)

M5 specifikacija (poglavlje 13, "Otvoreno za dalje") je ovo ostavila otvorenim — ovim dokumentom se zatvara: **da**, kreditni limit blokira potvrdu rezervacije. Kad `Quote.client_account_id` pripada Subagentu, M5 pre pokretanja toka potvrde (poglavlje 4 M5 specifikacije, pre bilo kakvog poziva ka M3/M4) proverava:

`current_outstanding_balance + Quote.total_price <= Subagent.credit_limit`

Ako je limit prekoračen, potvrda se odbija sa jasnom porukom **pre** nego što se bilo kakav kapacitet rezerviše kod M3/M4 — sprečava da agencija rezerviše kapacitet za prodaju koja se odmah pokaže nemogućom.

---

## 5. Cena za subagenta (dopuna toka cene iz M5/M6)

Isti obrazac kao popust lojalnosti u M6 (primenjuje se kao poslednji korak posle marže), ali **B2B nalogodavci ne učestvuju u M6 programu lojalnosti** — ovim se zatvara otvoreno pitanje iz M6 specifikacije (poglavlje 11). Umesto toga:

`cena_za_subagenta = cena_posle_marže_iz_M5 * (1 - effective_commission_percentage / 100)`

**Kako M5 prepoznaje Subagenta (dopuna, avgust 2026 — rešava nalaz iz `VALIDACIJA-WORKFLOW-B2B.md`):** M5 proverava **postojanje `Subagent` zapisa** (poglavlje 2.1) za dati `Quote.client_account_id`, ne `ClientAccount.account_type = LEGAL_ENTITY` — obično pravno lice (npr. korporativni B2C klijent koji nije registrovan kao poslovni partner) ima `LEGAL_ENTITY` tip, ali nema `Subagent` zapis, i mora dobiti standardnu M5/M6 cenu (marža + lojalnost, ako postoji), ne proviziju. Tek ako `Subagent` zapis postoji za taj `client_account_id`, M5 primenjuje ovu formulu umesto poziva ka M6 `/loyalty-status`, koristeći `SubagentVolumeStatus.effective_commission_percentage` (poglavlje 3.1) — ovo automatski uključuje i osnovnu proviziju i eventualni obimski bonus, bez posebne grane logike u M5. Provizija se uvek računa na osnovu **subagenta koji trenutno naručuje**, bez obzira na kom je nivou u lancu — nema potrebe za izračunavanjem kroz ceo lanac u trenutku prodaje, jer je svaki nivo već ograničen pravilom iz poglavlja 3 u trenutku kad mu je provizija postavljena.

---

## 6. Vidljivost kroz hijerarhiju (potvrđeno: strogo razdvojena)

- Subagent portal nalog vidi: sopstveni profil, sopstvene rezervacije, i **listu svojih direktnih sub-subagenata** (naziv, status, njihova provizija, kreditni limit) — isključivo radi upravljanja tom proviziom (poglavlje 3).
- Subagent **ne vidi** rezervacije ni krajnje goste svojih sub-subagenata — to je posao njihovog uže poslovnog odnosa, van vidokruga agencije i van vidokruga bilo kog nivoa iznad njih.
- Agencija (Vlasnik/Direktor/Sales Manager) vidi ceo lanac, na svim nivoima, jer agencija snosi krajnji kreditni rizik.

---

## 7. Poručivanje u ime krajnjeg gosta

Ne zahteva novu strukturu — već pokriveno postojećim modelom: `Booking.client_account_id` = subagent koji plaća, `BookingItemGuest.guest_profile_id` = stvarni putnik (M6 `GuestProfile`), koga subagent unosi u ime svog klijenta. Isti mehanizam kao kad prodajni agent agencije rezerviše za gosta preko telefona.

---

## 8. Nova uloga — `SUBAGENT_ADMIN` (dodaje se u M1 katalog uloga)

M1 specifikacija (poglavlje 8) je namerno ostavila B2B uloge za kasnije. Dodaje se:

| Uloga | Opseg |
| :---- | :---- |
| `SUBAGENT_ADMIN` | Portal nalog subagenta (bilo kog nivoa). Pristup: sopstveni `Subagent`/`ClientAccount` profil, sopstvene rezervacije preko M5 (sa automatski primenjenim popustom iz poglavlja 5), upravljanje sopstvenim direktnim sub-subagentima (poglavlje 3 i 6). Nema pristup internom panelu (M17) niti podacima drugih subagenata. |

---

## 9. Odobravanje novog subagenta

Novi subagent se registruje sa statusom `PENDING_APPROVAL` — ne može da naručuje dok Vlasnik ili Direktor ručno ne odobri prelazak u `ACTIVE` (postavlja kreditni limit i, ako je Tier 1, proviziju u tom trenutku). Ovo je namerna kontrola rizika — sistem ne dozvoljava automatsko samoodobravanje kreditne linije.

---

## 10. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M7/subagent/VIEW` (ceo lanac) | Vlasnik, Direktor, Sales Manager |
| `M7/subagent/CREATE`, `APPROVE`, `EDIT` (kreditni limit, Tier 1 provizija) | Vlasnik, Direktor |
| `M7/subagent/MANAGE_OWN_NETWORK` (sopstveni sub-subagenti) | `SUBAGENT_ADMIN` — samo za sopstvenu decu u hijerarhiji |
| `M7/commission-rebate/VIEW` | Vlasnik, Direktor, Računovođa |
| `M7/commission-rebate/APPROVE` | Vlasnik, Direktor, Računovođa — **nikad AI agent** |
| `M7/subagent-chat/VIEW` | Vlasnik, Direktor, Sales Manager (svi); `SUBAGENT_ADMIN` — samo sopstveni `subagent_id` |
| `M7/subagent-chat/CONFIRM` | `SUBAGENT_ADMIN` — isključivo sopstveni `subagent_id` (poglavlje 2.0.4b/c) |
| `M7/subagent-chat/STAFF_REVIEW` | Vlasnik, Direktor, Sales Manager — odobrenje/odbijanje zahteva iznad praga (poglavlje 2.0.4c, korak 4) — **nikad AI agent** |

---

## 11. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/b2b`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/subagents` | GET / POST | lista (agencija vidi sve) / registracija novog (status `PENDING_APPROVAL`) |
| `/subagents/:id/approve` | POST | Vlasnik/Direktor — postavlja kreditni limit i (ako Tier 1) proviziju |
| `/subagents/:id` | GET / PATCH | |
| `/subagents/:id/children` | GET / POST | sopstveni sub-subagenti — dostupno agenciji i roditeljskom `SUBAGENT_ADMIN`-u |
| `/subagents/:id/children/:childId/commission` | PATCH | roditeljski subagent menja proviziju deteta, uz ogradu iz poglavlja 3 |
| `/subagents/:id/outstanding-balance` | GET | uživo izračunato stanje duga naspram kreditnog limita |
| `/subagents/:id/volume-tiers` | GET / POST / PATCH | pragovi obimskog bonusa (poglavlje 3.1) — postavlja ih isti autoritet kao osnovnu proviziju |
| `/subagents/:id/volume-status` | GET | tekući obim, dostignut prag, i `effective_commission_percentage` — koristi ga M5 pri kreiranju ponude |
| `/subagents/:id/commission-rebates` | GET | lista rabata, svih statusa |
| `/subagents/:id/commission-rebates/:rebateId/approve` | POST | ljudska potvrda, zahteva `M7/commission-rebate/APPROVE` |
| `/subagents/:id/commission-rebates/:rebateId/reject` | POST | odbijanje, sa razlogom |
| `/subagents/:id/chat-messages` | GET / POST | transkript razgovora (poglavlje 2.0.4b), zahteva `M7/subagent-chat/VIEW` |
| `/subagents/:id/booking-requests` | GET / POST | pregled / kreiranje `SubagentBookingRequest` (agent priprema, poglavlje 2.0.4c koraci 1–2) |
| `/subagents/:id/booking-requests/:requestId/confirm` | POST | potvrda subagenta (Gejt A), zahteva `M7/subagent-chat/CONFIRM`, samo sopstveni nalog |
| `/subagents/:id/booking-requests/:requestId/staff-review` | POST | odobrenje/odbijanje osoblja (Gejt B), zahteva `M7/subagent-chat/STAFF_REVIEW`, samo kad `requires_staff_review = true` |

---

## 12. Izlazni kriterijum (M7 deo Faze 4)

Implementacija avgust 2026 (prvi prolaz) pokriva poglavlja 2.1, 3, 3.1, 3.2, 4, 5, 6, 7, 8, 9, 10
i deo 11 (API ugovor osim `/chat-messages`, `/booking-requests*`) — svi testovi u
`apps/api/test/m7-exit-criteria.e2e-spec.ts` (17/17 zeleno). Poglavlja 2.0.3 (omnisearch) i 2.0.4
(AI chat, `SubagentBookingRequest`/`SubagentChatMessage`) su **namerno izostavljeni** ovog prolaza
— zavise od M15 (AI agentska orkestracija), koji još ne postoji kao NestJS modul u
`apps/api/src/modules/`; ne izmišljati taj API pre toga (CLAUDE.md — "šta ne raditi"). Portal
frontend (poglavlje 2.0.1/2.0.2 rute) takođe nije građen ovog prolaza — samo backend API koji bi
ga servisirao, isti obrazac kao M6.

**Dopuna (avgust 2026) — staff-facing ekrani u M17.** Deo ovog izlaznog kriterijuma koji se tiče
internog tima agencije (ne subagenta samog) sad ima svoj ekran: `apps/panel/src/app/(app)/b2b/`
(`docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`, Faza 4) — lista/detalj
subagenata, odobravanje novog partnera, kreditni limit/status, pragovi obima, uvid u mrežu
sub-subagenata (bez upravljanja njome — to ostaje portal, poglavlje 2.0.1), i odobravanje/
odbijanje rabata provizije (poglavlje 3.2). Portal iz poglavlja 2.0.1/2.0.2 (subagent radi
sopstvenim identitetom) i dalje nije građen — ovo je isključivo strana koju agencija koristi.

- [x] Novi subagent se registruje, ostaje `PENDING_APPROVAL`, i ne može da naruči dok se ne odobri.
- [x] Tier 1 provizija postavlja isključivo agencija; sub-subagent proviziju postavlja isključivo roditeljski subagent, sa ogradom da ne pređe roditeljsku.
- [x] Rezervacija koja bi prekoračila kreditni limit se odbija pre bilo kakve rezervacije kapaciteta kod M3/M4.
- [x] Cena prikazana subagentu ispravno odražava njegovu proviziju, bez obzira na koji je nivo u lancu.
- [x] Subagent ne može da vidi rezervacije ili goste svog sub-subagenta, samo osnovne podatke (status, provizija, kredit) potrebne za upravljanje mrežom.
- [x] Kad subagent u posmatranom periodu pređe postavljeni prag obima, `effective_commission_percentage` se automatski podigne i sledeća ponuda odražava novu cenu — bez ljudske intervencije.
- [x] Ako roditeljev obimski bonus istekne i njegova efektivna provizija padne ispod već postavljene provizije deteta, sistem to prijavljuje kao upozorenje (audit log `M7/subagent.commission_ceiling_warning`), ne menja tiho postojeći odnos.
- [x] Prelazak `retroactive` praga usred perioda automatski kreira `CommissionRebate` u statusu `DRAFT` sa ispravno izračunatim iznosom; rabat se ne primeni (`APPLIED`) bez ljudskog odobrenja; nijedan već poslat fiskalni dokument (M10) se ne dira.
- [ ] **Čeka M8/portal (frontend)** — Portal se instalira kao PWA i ostaje potpuno upotrebljiv na telefonu i tabletu — subagent poručuje i prati proviziju/kreditni limit bez potrebe za desktop računarom (Master dokument poglavlje 5.1).
- [ ] **Čeka M8/portal (frontend)** — Ceo tok iz poglavlja 2.0.2 (pretraga → ponuda → putnici → uslovi → potvrda) radi kraj-do-kraja kroz rute iz poglavlja 2.0.1, bez ijednog koraka koji zaobilazi interne API-je M2/M5/M6 — backend API koji bi ga servisirao je implementiran i testiran (§4/§5 gore), sama portal ruta/PWA nije.
- [x] Rezervacija sa `LEGAL_ENTITY` `ClientAccount` koji **nema** `Subagent` zapis dobija standardnu M5/M6 cenu (marža + eventualna lojalnost), ne proviziju — potvrđuje da se prepoznavanje radi po postojanju zapisa, ne po tipu naloga.
- [ ] **Čeka M15** — Omnisearch (poglavlje 2.0.3) ne vraća identitet dobavljača niti podatke tuđeg sub-subagenta u rezultatima.
- [ ] **Čeka M15** — `/b2b/chat` (poglavlje 2.0.4) nije dostupan subagentu čiji `ai_chat_enabled = false`.
- [ ] **Čeka M15** — `SubagentBookingRequest` ne može preći u `EXECUTING`/`CONFIRMED` bez `subagent_confirmed_at`/`subagent_confirmed_by` popunjenog — i to isključivo nalogom istog `subagent_id`, potvrđeno testom da tuđi `SUBAGENT_ADMIN` (uključujući sopstvenog roditelja/dete u hijerarhiji) ne može potvrditi.
- [ ] **Čeka M15** — Zahtev sa `requires_staff_review = true` ne izvršava M5 potvrdu dok `staff_reviewed_by` nije popunjeno ljudskim nalogom sa `M7/subagent-chat/STAFF_REVIEW` — provereno da AI agent nema pristup ovom prelazu.
- [ ] **Čeka M15** — Izvršenje (korak 5, poglavlje 2.0.4c) ponovo proverava garanciju i kreditni limit u trenutku izvršenja, ne samo u trenutku pripreme ponude — test: kreditni limit se popuni drugom rezervacijom između potvrde subagenta i izvršenja, zahtev prelazi u `FAILED`, ne u `CONFIRMED`.
- [ ] **Čeka M15** — Chat ni u jednom trenutku ne prikuplja/čuva podatke kartice — plaćanje karticom ide isključivo kroz isti hostovani checkout kao portal (M10 poglavlje 7.1).
- [ ] **Čeka M15** — Otkazivanje pokrenuto kroz chat prolazi kroz istu proveru duplikata kao svaki drugi kanal (M5 poglavlje 6.4) — sama duplikat-provera (M5 §6.4) je implementirana i važi za SVAKI kanal koji koristi `POST /bookings/:id/cancel`, uklj. B2B portal; specifično chat-inicirano otkazivanje čeka M15.

---

## 13. Otvoreno za dalje

- Da li agencija treba mogućnost da direktno vidi/interveniše u proviziji sub-subagenta u izuzetnim slučajevima (spor između subagenata) — trenutno agencija ima samo uvid (`VIEW`), ne i izmenu tuđe kaskadne provizije; dodaje se kao pojedinačni izuzetak (M1 `UserPermissionOverride`) ako se pokaže potreba.
- Prilagođavanja M10 za automatsko fakturisanje provizije nazad ka subagentima (ako agencija treba da im isplaćuje/knjiži proviziju kao trošak, ne samo da im daje popust) — otvoreno, zavisi od toga da li se provizija realizuje kao popust na cenu (kako je ovde modelovano) ili kao zasebna isplata; trenutni model (popust na cenu) ne zahteva dodatno fakturisanje unazad.
- **Konkretan LLM/tehnički mehanizam razgovora** (poglavlje 2.0.4) — ovaj dokument definiše granice ovlašćenja i tok potvrde, ne tačan UI/prompt dizajn razgovora; definiše se pri implementaciji, isti princip kao ostatak M15 (konkretan model bira se bliže trenutku implementacije).
- **Tačan format/podrazumevana vrednost `ai_chat_review_threshold_amount`** (poglavlje 2.0.4a) — svaki subagent dobija sopstvenu vrednost pri uključivanju, nema globalnog podrazumevanog praga u ovoj verziji; da li treba i globalni podrazumevani prag (koji se onda može override-ovati po subagentu) ostaje otvoreno dok se ne pokaže potreba.
