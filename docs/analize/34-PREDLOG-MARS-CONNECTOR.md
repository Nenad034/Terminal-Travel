# Predlog — M-26 MARS Connector (dostavio vlasnik, 21.8.2026)

**Status:** Sirov predlog, dostavljen kao gotov draft dokument — **nije prošao `tt-architecture-core` proveru niti potvrdu vlasnika o otvorenim pitanjima ispod**. Čuva se ovde u celini da se ne izgubi, do trenutka kad se vlasnik vrati na temu. Isti obrazac čuvanja kao [[30-PREDLOG-AI-SEMANTICKI-SLOJ]].

---

## Otvorena pitanja pre nego što ovo dobije spec/kod (identifikovano pri prvom čitanju)

1. **Najvažnije — da li MARS ostaje sistem zapisa za rezervacije/cene/finansije, ili to postaju M3/M5/M10?** Dokument tvrdi (§1, §3): "MARS ostaje trajni sistem zapisa (system of record)... TTA platforma je klijent koji čita i piše preko API sloja — nikad paralelni autoritativni izvor." Ali Terminal već gradi sopstveni M3 (ugovaranje i alotmani — cenovnici, kapaciteti), M5 (rezervacije i tok prodaje — search→ponuda→potvrda→upravljanje) i M10 (finansije — fakturisanje, fiskalizacija SEF/ESIR) kao module sa sopstvenom bazom i poslovnom logikom, ne kao prikaze nad tuđim sistemom. Ako MARS ostaje trajni autoritet nad tim istim entitetima (cene/dostupnost, rezervacije, fakture), to je direktna kolizija sa premisom pod kojom su M3/M5/M10 već specificirani i (M3/M5 delimično) implementirani. Mora se razjasniti sa vlasnikom pre bilo kakvog spec rada:
   - Da li je MARS Connector zamišljen kao **privremeni most** dok se podaci/tok postepeno prebacuju u M3/M5/M10 (pa Connector prirodno gasi svoju write-stranu kako TTA sopstveni moduli preuzmu ulogu)?
   - Ili MARS ostaje **trajno** sistem zapisa za rezervacije/cene/fakture, a M3/M5/M10 se svesno svode na drugačiju ulogu (npr. M5 ostaje tok prodaje/search ka gostu, ali finalni zapis rezervacije/fakture živi u MARS-u, ne u sopstvenoj bazi)? Ovo bi zahtevalo reviziju već napisanih M3/M5/M10 specifikacija, ne samo dodavanje novog modula.
2. **Numeracija modula.** Dokument koristi "M-26"; stvarna Terminal mapa modula (`docs/00-MASTER-ARHITEKTURA.md` poglavlje 4) ide trenutno M1–M23, bez formalno dodeljenog M24/M25/M26 — M24/M25 postoje samo kao neformalni pomeni u ranijim, takođe nepotvrđenim predlozima ([[30-PREDLOG-AI-SEMANTICKI-SLOJ]], zadatak upravljanja iz backloga koji pominje mogući M24 za "zadatke"). Ako se ovaj predlog ikad formalizuje, tačan broj (24, 25 ili 26) treba dodeliti tek kad se zna redosled/da li se prethodna dva predloga uopšte materijalizuju kao moduli — ne rezervisati "26" unapred bez razloga.
3. **Odnos prema M4 (Integracije spoljnih API konekcija).** M4 je već specificiran kao "sloj adaptera ka spoljnim provajderima" (Travelgate, Solvex/Master-Interlook, WebHotelier, budući avio/GDS). MARS Connector je arhitektonski isti obrazac (adapter servis, read cache, write flow sa odobrenjem) ali ka internom TTA back-office ERP-u (NeoLab), ne ka dobavljaču hotela/leta. Treba odlučiti: da li MARS Connector živi kao **deo M4** (isti modul, novi adapter tip) ili kao **zaseban modul** — dokument pretpostavlja zaseban modul bez obrazloženja te odluke. M4 opis eksplicitno kaže "sloj adaptera ka spoljnim provajderima" za proizvode koji se prodaju gostima; MARS je back-office/ERP, drugačija kategorija (finansije/rezervacije zapis, ne izvor ponude) — verovatno opravdava zaseban modul, ali to treba da bude eksplicitna odluka, ne prećutna pretpostavka.
4. **Nova tehnologija van poglavlja 6.** `node-cron` (ili queue infrastruktura "za M-24") — M-24 kao pomenuta zavisnost ne postoji kao stvarni modul (vidi tačku 2). Ako se ide na prostu cron šemu (bez queue), to je verovatno u skladu sa postojećim stekom (Node.js/NestJS već je stek); ako se uvodi prava queue infrastruktura (npr. BullMQ), to je novi element steka i zahteva potvrdu vlasnika po CLAUDE.md tvrdom pravilu.
5. **`mars_cache` i `audit_log` kao odvojene šeme/tabele van Prisma modela.** Ostatak Terminal koda ide kroz Prisma (`apps/api/prisma/schema.prisma`, deljen paket). Predlog piše sirov SQL DDL za `mars_cache.*` i `mars_connector.audit_log` — treba uskladiti sa postojećim obrascem (Prisma modeli + migracije), ne paralelna ručna šema, osim ako postoji poseban razlog (npr. odvojena baza/schema zbog izolacije rizika) koji vlasnik svesno potvrdi.
6. **Postoji li već sličan audit-log/human-in-the-loop obrazac u kodu koji treba ponovo iskoristiti, ne izmisliti?** M18 (operativni nadzor) i M19 (real-time chat sa dobavljačima) već imaju uspostavljene obrasce za "sistem javlja, čovek odobrava" tokove (npr. CRITICAL health signal → in-app notifikacija). Pre pisanja M-26 write-flow logike, proveriti da li se taj obrazac može ponovo iskoristiti umesto građenja paralelnog.
7. **Sekcije 6 i 7 dokumenta su sam autor označio kao placeholder** ("Čeka listu MARS API endpoint-a") — nema TTA-internih endpoint detalja niti stvarnog MARS API contract-a. Nijedan kod se ne može pisati pre nego što ove dve sekcije budu popunjene iz stvarne Stoplight dokumentacije (`marsapi.stoplight.io`).
8. **Pet pitanja iz sekcije 11 dokumenta** (da li MARS vraća `updated_at`, obavezna polja za novu rezervaciju, rate limit, da li Metabase/Open Notebook dele Docker host, ko su odobravaoci) ostaju otvorena i njih je sam vlasnik označio kao pitanja za sebe — nisu ponovljena ovde, ali blokiraju Fazu 1+ iz sekcije 10 dokumenta.

---

## Originalni tekst predloga (dostavljen bez izmena)

# M-26 — MARS Connector Modul

## Tehnička specifikacija (v0.1 — draft za implementaciju)

**Status:** Draft — čeka listu MARS API endpoint-a za finalizaciju sekcije 6 i 7
**Autor:** Nenad (TTA) — priprema za Claude Code agenta
**Datum:** 2026-08-21

---

### 1. Svrha i kontekst

TTA trenutno koristi **MARS ERP (NeoLab)** kao back-office sistem za rezervacije, cenovnike/dostupnost i finansije/fakture. MARS API V1 (`marsapi.stoplight.io`) koristi HTTP Basic Authentication.

Cilj M-26 modula je da omogući:

1. **Prikaz i analizu** MARS podataka kroz interne TTA izveštaje (Metabase), bez opterećivanja MARS API-ja direktnim upitima korisnika.
2. **Kontrolisan upis/izmenu** podataka u MARS (cene/dostupnost, rezervacije, finansije) kroz TTA interfejs, sa validacijom, audit tragom i human-in-the-loop odobrenjem tamo gde je rizik visok.

**Ovo NIJE modul za migraciju sa MARS-a.** MARS ostaje trajni sistem zapisa (system of record). TTA platforma je klijent koji čita i piše preko API sloja — nikad paralelni autoritativni izvor.

### 2. Van dometa (non-goals)

- Ne gradimo lokalnu kopiju MARS-a kao zamenu.
- Ne pišemo direktno u MARS bazu podataka (samo preko zvaničnog API-ja).
- Frontend/Metabase nikad ne pozivaju MARS API direktno — uvek preko TTA backend sloja.

### 3. Arhitekturni princip

MARS ERP (NeoLab, HTTP Basic Auth, jedini source of truth) → REST/JSON → MARS Connector Service (backend, M-26, Node.js) → razdvojeno na `mars_cache` (PostgreSQL) i `audit_log` (PostgreSQL) → dalje ka Metabase (read-only) i TTA Write Forms (React, RBAC).

Ključna pravila:

- **Read putanja** i **write putanja** su fizički odvojene u kodu (različiti servisi/moduli), iako dele isti autentikacioni sloj ka MARS-u.
- Kredencijali (Basic Auth user/pass) žive isključivo u backend `.env` / secrets store-u. Nikad u frontend kodu, nikad u browseru, nikad u logovima u plain textu.

### 4. Podaci koji se sinhronizuju (read)

| Entitet | Frekvencija sync-a | Prioritet |
|---|---|---|
| Cene i dostupnost (price liste, inventar) | 15–30 min | Visok |
| Rezervacije i statusi | 15–30 min | Visok |
| Fakture / finansije | Dnevno (npr. noćni batch) | Srednji |

> **TODO:** Tačna lista MARS entiteta i njihovih GET endpoint-a treba da se popuni iz Stoplight dokumentacije. Ova tabela je placeholder na osnovu poznatih MARS ERP modula (booking, price lists, invoicing).

#### 4.1 `mars_cache` šema (predlog, generički)

```sql
-- Generička struktura, prilagoditi po stvarnim MARS entitetima
CREATE TABLE mars_cache.price_availability (
    id              BIGSERIAL PRIMARY KEY,
    mars_id         VARCHAR(64) NOT NULL,        -- ID u MARS sistemu
    entity_type     VARCHAR(32) NOT NULL,        -- npr. 'accommodation', 'package'
    data            JSONB NOT NULL,              -- puni payload iz MARS-a
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    mars_updated_at TIMESTAMPTZ,                 -- ako MARS vraća svoj updated_at
    UNIQUE(mars_id, entity_type)
);

CREATE TABLE mars_cache.reservations (
    id              BIGSERIAL PRIMARY KEY,
    mars_id         VARCHAR(64) NOT NULL UNIQUE,
    status          VARCHAR(32) NOT NULL,
    data            JSONB NOT NULL,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    mars_updated_at TIMESTAMPTZ
);

CREATE TABLE mars_cache.invoices (
    id              BIGSERIAL PRIMARY KEY,
    mars_id         VARCHAR(64) NOT NULL UNIQUE,
    data            JSONB NOT NULL,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    mars_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_price_avail_entity ON mars_cache.price_availability(entity_type);
CREATE INDEX idx_reservations_status ON mars_cache.reservations(status);
```

**Napomena:** `data JSONB` čuva pun MARS payload bez pretpostavki o tačnoj šemi — kasnije se po potrebi mogu dodati generated columns za polja koja se često filtriraju (npr. `price`, `check_in_date`).

### 5. Write flow (upis/izmena)

#### 5.1 Opšti tok

1. Korisnik popuni formu u TTA frontend-u
2. TTA backend validira ulaz (format, obavezna polja, poslovna pravila)
3. Backend proverava da li je entitet promenjen u MARS-u od poslednjeg sync-a (concurrency check — poređenje `mars_updated_at`) → ako DA: zaustavi, prikaži korisniku trenutno stanje iz MARS-a, traži potvrdu
4. Ako je entitet označen kao "visok rizik" (vidi 5.2): kreiraj `pending_approval` zapis, obavesti odgovornog, čekaj odobrenje
5. Backend poziva MARS write API (POST/PUT/PATCH)
6. Loguje rezultat u `audit_log` (uspeh/neuspeh, request/response)
7. Odmah povlači ažuriranu vrednost iz MARS-a i osvežava `mars_cache` (izbegava drift između cache-a i stvarnog stanja)
8. Vraća potvrdu korisniku

#### 5.2 Klasifikacija rizika po entitetu

| Entitet | Nivo rizika | Human-in-the-loop? |
|---|---|---|
| Cene / dostupnost | Srednji | Ne (uz automatske granice — npr. upozorenje ako je promena >X%) |
| Rezervacije (nova/izmena statusa) | Visok | Da, ako menja status koji utiče na klijenta (potvrda, otkazivanje) |
| Finansije / fakture | Visok | Da, uvek — isti princip kao Miroco fiskalni flow |

> Ovo su predložene default vrednosti — treba potvrditi sa poslovne strane pre implementacije.

#### 5.3 `audit_log` šema

```sql
CREATE TABLE mars_connector.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    entity_type     VARCHAR(32) NOT NULL,
    mars_id         VARCHAR(64),
    action          VARCHAR(16) NOT NULL,   -- 'create' | 'update' | 'delete'
    old_value       JSONB,
    new_value       JSONB,
    mars_request    JSONB,                  -- šta je poslato ka MARS API-ju
    mars_response   JSONB,                  -- šta je MARS vratio
    status          VARCHAR(16) NOT NULL,   -- 'success' | 'failed' | 'pending_approval'
    approved_by     BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6. TTA interni API contract (backend endpoint-i)

> Ovo su TTA-interni endpoint-i (frontend → TTA backend), NE MARS endpoint-i.

| Endpoint | Metod | Svrha |
|---|---|---|
| `/api/mars/price-availability` | GET | Čita iz `mars_cache`, filtriran po entitetu |
| `/api/mars/reservations` | GET | Čita iz `mars_cache` |
| `/api/mars/invoices` | GET | Čita iz `mars_cache` |
| `/api/mars/price-availability/:id` | PATCH | Pokreće write flow (5.1) za cene |
| `/api/mars/reservations/:id` | PATCH | Pokreće write flow za rezervacije |
| `/api/mars/reservations` | POST | Nova rezervacija — write flow sa approval korakom |
| `/api/mars/sync/trigger` | POST | Ručno pokretanje sync-a (admin only) |
| `/api/mars/audit-log` | GET | Pregled audit traga (RBAC: samo ovlašćeni) |

### 7. MARS API integracija (PLACEHOLDER — čeka dokumentaciju)

> Ovde treba popuniti kada se dobije pun pristup Stoplight dokumentaciji:
> - Tačan base URL MARS API-ja
> - Lista GET endpoint-a po entitetu (path, query parametri, paginacija)
> - Lista POST/PUT/PATCH endpoint-a (koji entiteti podržavaju write, koja polja su obavezna)
> - Rate limit pravila (ako postoje)
> - Format grešaka (error response shape)
> - Da li MARS vraća `updated_at`/`modified_at` polje po zapisu (bitno za concurrency check iz 5.1)

Autentikacija: **HTTP Basic Auth** (potvrđeno iz dokumentacije) — kredencijali se čuvaju u backend secrets store-u (npr. `.env` van git repo-a, ili dedicated secrets manager ako TTA infra to već koristi).

### 8. Sync servis — tehnički detalji

- **Tehnologija:** Node.js, isti stack kao ostatak TTA backend-a.
- **Scheduling:** cron job (npr. `node-cron`) ili queue-driven (ako TTA već koristi queue infrastrukturu za M-24).
- **Idempotentnost:** svaki sync run mora biti bezbedan za ponovno pokretanje (upsert po `mars_id`, ne insert).
- **Error handling:** ako MARS API ne odgovori — sync se ne prekida u potpunosti, loguje se greška po entitetu, retry sa exponential backoff (npr. 3 pokušaja).
- **Monitoring:** minimalno — log poslednjeg uspešnog sync-a po entitetu, alert ako sync nije uspeo N puta zaredom.

### 9. Bezbednost

- Basic Auth kredencijali: samo backend, enkriptovani at-rest ako secrets store to podržava.
- Svi write pozivi ka MARS-u idu isključivo kroz M-26 servis — nijedan drugi deo TTA platforme ne sme direktno da zove MARS API.
- RBAC na TTA strani: definisati koje uloge mogu da menjaju cene, koje rezervacije, koje finansije (verovatno različiti nivoi).
- Audit log je append-only — nema UPDATE/DELETE nad `audit_log` tabelom (trigger ili permission na DB nivou).

### 10. Fazni plan implementacije

| Faza | Sadržaj | Preduslov |
|---|---|---|
| **Faza 1** | Read-only sync za sva tri entiteta + `mars_cache` šema | Pristup MARS API dokumentaciji (GET endpoint-i) |
| **Faza 2** | Metabase konekcija na `mars_cache`, prvi dashboard-i za kolege | Faza 1 završena |
| **Faza 3** | Write flow za cene/dostupnost (najniži rizik) | MARS write endpoint dokumentacija za taj entitet |
| **Faza 4** | Write flow za rezervacije + human-in-the-loop approval UI | Faza 3 stabilna, definisana pravila odobrenja |
| **Faza 5** | Write flow za finansije/fakture (najviši rizik) | Faza 4 stabilna, potvrđena poslovna pravila |

### 11. Otvorena pitanja (za Nenada, pre finalizacije)

1. Da li MARS API vraća `updated_at` po zapisu (potrebno za concurrency check u 5.1)?
2. Koja tačna polja su obavezna za kreiranje nove rezervacije preko API-ja?
3. Da li postoji rate limit na MARS API-ju koji utiče na frekvenciju sync-a?
4. Da li Metabase i Open Notebook dele isti Docker host, ili treba novi servis?
5. Ko su "odobravaoci" (approvers) za rezervacije/finansije — pojedinac, uloga, ili grupa?

---

*Dokument pripremljen kao input za Claude Code agenta. Sekcije 6 i 7 zahtevaju dopunu nakon uvida u punu MARS API dokumentaciju (Stoplight).*
