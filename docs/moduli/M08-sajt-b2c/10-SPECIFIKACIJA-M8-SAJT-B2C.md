# Specifikacija modula M8 — Sajt agencije (B2C prikaz)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M8), poglavlje 5 (referentna arhitektura) i poglavlje 8 (Faza 3)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.13 — tri vlasnikove odluke od 17.8.2026, upisane u novo poglavlje 1a.1/1a.2: ispravljen kontrast palete (sedam parova je padalo WCAG AA u svetlom modu, dva u tamnom — najgore granica na 1.19:1 i tekst punog dugmeta "Rezervisi" na 3.30:1), boja sljive je druga boja sajta (zamenila teal `--accent2`, koji je ukinut), i sajt ide punom sirinom ekrana uz izuzetak za stranice koje se citaju (pojedinacan hotel/putovanje, blog, opste stranice, tok rezervacije). v1.12 — **rešeno** (avgust 2026, potvrda vlasnika): M21 je proširen novom publikom `PUBLIC_GUEST` (anonimni i INDIVIDUAL B2C gosti, M21 spec v1.4), omnisearch tačka (b) sad stvarno dobija M21 odgovor za tipičnog B2C posetioca kad postoji objavljen članak za tu publiku — 4 početna FAQ članka su seedovana kao nacrt (DRAFT), čekaju pregled/objavljivanje tima kroz `apps/panel` `/pomoc` ekran; poglavlje 10 ispod ažurirano da to odražava. v1.11 — omnisearch traka (poglavlje 3a) i `/znanje/[share_token]` (poglavlje 2) implementirani (avgust 2026, nastavak posle M15/M23 implementacije): omnisearch poziva `POST /ai-orchestration/omnisearch` preko `apps/web/src/app/api/omnisearch/route.ts` (§1 BFF pravilo), radi anonimno (M15 spec §6.5 dopuna, `channel=B2C_SITE`), prikazano u `Header.tsx`/`OmnisearchBar.tsx`; `/znanje/[share_token]` čita `GET /knowledge/public/:shareToken` (M23 spec §5), namerno premešteno IZVAN `app/[locale]/(site)/` route grupe (nova, ostatak sajta je preseljen tamo bez promene URL-ova) da ne nasledi Header/Footer navigaciju — zatvara poslednje dve stavke poglavlja 9a i izlaznog kriterijuma (poglavlje 9). v1.10 — `/stranica/[slug]` i `/blog/[slug]` povezani sa M12 (avgust 2026, nastavak posle M12 implementacije): čitaju `GET /marketing/public/content?type=STATIC_PAGE|BLOG_POST&slug=...&lang=...` (M12 spec v1.4, `PublicContentController`), uklonjeni iz liste odloženih ruta u poglavlju 9a (omnisearch i `/znanje/[share_token]` ostaju odloženi, čekaju M15/M23); dodato hvatanje `?ref=` (poglavlje 3, korak 0) preko kolačića u `apps/web/src/middleware.ts`, prosleđeno kao `Quote.referral_tracking_code` pri kreiranju ponude; v1.9 — dodata ruta `/[tip]` (kategorija, poglavlje 2) i poglavlje 1a (vizuelni identitet — paleta "Zalazak", potvrđeno vlasnikom, avgust 2026); v1.8 — poglavlje 9a dopunjeno: anonimni checkout bez naloga (korak 3) odložen, nedostaje javan M6 endpoint; v1.7 — dodata arhitektonska odluka o BFF pozivima ka backend-u (poglavlje 1) i obim prvog prolaza implementacije (poglavlje 9a), avgust 2026, pri početku implementacije; v1.6 — dodate rute `/stranica/[slug]`/`/blog/[slug]` (M12 poglavlje 6, dopuna avgust 2026) i `/znanje/[share_token]` (M23 poglavlje 5, avgust 2026, nov modul); v1.5 dodato poglavlje 3a (univerzalna pretraga i AI razgovor — omnisearch), dopunjuje M15 poglavlje 6.5 (avgust 2026, na zahtev vlasnika); v1.4 eksplicitan `account_type = INDIVIDUAL` za anonimnog gosta bez naloga (poglavlje 3, korak 3), ažurirana referenca na `Quote.contract_terms_accepted` (poglavlje 3, korak 4) — rešava nalaze iz `VALIDACIJA-WORKFLOW-B2C.md` (avgust 2026, na zahtev vlasnika); v1.3 dodata stavka izlaznog kriterijuma za responsive prikaz (Master dokument poglavlje 5.1); v1.2 dodato prihvatanje ugovora sa klijentom (clickwrap) u tok rezervacije, M20 kao zavisnost (poglavlje 3) — zatvara raniju forward-referencu iz M20 specifikacije; v1.1 dodala konkretnu listu schema.org komponenti (poglavlje 5.1) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1, M2, M5, M6, M10 (kartično plaćanje), M20 (prihvatanje ugovora pre plaćanja), M15 (poglavlje 3a, omnisearch), M12 (poglavlje 6, opšte stranice), M23 (poglavlje 5, deljen članak baze znanja)

---

## 1. Svrha i obim modula

M8 je javni Next.js sajt za krajnje goste. **Nema sopstvenu bazu ni sopstveni API** — u skladu sa principom "jedan izvor istine" i pravilom iz poglavlja 5 Master dokumenta ("sajt nikad ne poziva Travelgate ili SEF direktno"), M8 isključivo čita i piše kroz interne API-je M1 (autentikacija), M2 (katalog), M5 (pretraga/ponuda/rezervacija), M6 (nalog gosta) i M10 (kartično plaćanje). Back office (unos proizvoda, upravljanje rezervacijama) je isključivo u internom panelu, ne na ovom sajtu — M8 je samo prikaz.

**Arhitektura poziva ka backend-u (dopuna avgust 2026, potvrđeno vlasnikom pri početku implementacije).** Next.js **server** (ne browser gosta direktno) poziva NestJS API server-to-server. Gost dobija httpOnly, potpisan sesijski kolačić od samog Next.js servera; M1 access/refresh token nikad ne izlazi u kod koji se izvršava u browseru. Razlog: manji bezbednosni rizik (JWT nije dostupan XSS napadu) i nema potrebe da M1 uvodi CORS podešavanje za javni domen sajta. Route handler-i unutar `apps/web` (`/api/session/*`) su jedino mesto gde Next.js server direktno rukuje M1 tokenima.

---

## 2. Struktura sajta i rute

Sve rute su prefiksovane jezikom (`/sr/...`, `/en/...`, `/hr/...`, `/sl/...`, `/es/...`, `/de/...`, `/ru/...`, `/fr/...`), u skladu sa 8 jezika potvrđenih u M2 specifikaciji.

| Ruta | Sadržaj | Izvor podataka |
| :---- | :---- | :---- |
| `/` | Početna, istaknute destinacije/ponude | M2 `/products?featured=true` |
| `/pretraga` | Rezultati pretrage (destinacija, datumi, gosti) | M5 `/search` |
| `/[tip]` | Kategorija — lista svih proizvoda tog tipa (npr. `/smestaj` = sav `ACCOMMODATION`), dopuna avgust 2026 | M2 `/products?channel=...&lang=...`, filtrirano po `type` na strani sajta |
| `/[tip]/[slug]` | Stranica proizvoda (npr. `/smestaj/hotel-x`) | M2 `/products/:id` preko `slug` iz `ProductTranslation` |
| `/rezervacija/ponuda` | Pregled ponude pre potvrde | M5 `/quotes/:id` |
| `/rezervacija/podaci-gosta` | Unos podataka gostiju (ili prijava postojećeg naloga) | M6 `/guest-profiles`, M1 auth |
| `/rezervacija/uslovi` | Prikaz uslova ugovora i polje "Prihvatam uslove ugovora" (clickwrap), pre prelaska na plaćanje | M20 poglavlje 3.2 |
| `/rezervacija/placanje` | Kartično plaćanje (hostovana forma provajdera) ili prikaz instrukcija za bankovni prenos | M10 `/payments/card/initiate` |
| `/rezervacija/potvrda` | Potvrda, broj rezervacije, link ka vaučeru | M5 `/bookings/:id` |
| `/nalog/prijava`, `/nalog/registracija` | Prijava/registracija gosta | M1 `/auth/*` |
| `/nalog/moje-rezervacije` | Lista sopstvenih rezervacija, status, vaučeri | M5 `/bookings?client_account_id=...`, prava iz M1 (Gost vidi samo svoje) |
| `/nalog/profil` | Izmena profila, preference, saglasnost za marketing | M6 `/client-accounts/:id` |
| `/stranica/[slug]` | Opšte stranice (npr. "O nama", "Kontakt") | M12 `/marketing/public/content?type=STATIC_PAGE&slug=...&lang=...` (poglavlje 6, implementirano avgust 2026) |
| `/blog/[slug]` | Blog članak | M12 `/marketing/public/content?type=BLOG_POST&slug=...&lang=...` (poglavlje 6, implementirano avgust 2026) |
| `/uslovi` | Statični sadržaj (pravni tekst, ne uređuje se kroz M12) | Van obima ove specifikacije |
| `/znanje/[share_token]` | Jedan javno dostupan članak baze znanja, bez naloga i bez navigacije ka ostatku sajta/baze — dostupan isključivo direktnim linkom koji je neko podelio (M23 poglavlje 5, dopuna avgust 2026) | M23 `/public/:share_token` |

---

## 3. Tok pretrage i rezervacije (korak po korak)

0. **Hvatanje porekla (dopuna avgust 2026, M12 poglavlje 3a)** — ako posetilac stigne sa `?ref=<kod>` u URL-u (link iz marketinškog sadržaja, M12), sajt taj kod čuva na strani klijenta (sesija) do trenutka kreiranja `Quote` — čist prolazan podatak, sajt ga ne validira niti tumači.
1. **Pretraga** — anonimna, bez potrebe za nalogom. Poziva M5 `/search`, koje već vraća cenu sa primenjenom maržom (M5) i, ako je gost prijavljen, popustom lojalnosti (M6). Rezultati objedinjuju M2/M3 (ugovoreno) i M4 (uživo preko M5).
2. **Izbor i ponuda** — kreira se `Quote` (M5 `/quotes`), `client_account_id` je `null` dok se gost ne identifikuje (dozvoljeno po M5 specifikaciji); ako je korak 0 zabeležio kod porekla, prosleđuje se kao `Quote.referral_tracking_code` (M5 poglavlje 3.1) u istom pozivu.
3. **Podaci gostiju** — ako gost nije prijavljen, sajt nudi izbor: prijaviti se, registrovati se, ili nastaviti kao gost bez naloga (u tom slučaju se ipak kreira minimalan `GuestProfile`/`ClientAccount` u M6 radi fiskalnog dokumenta, bez `linked_user_id`). **`ClientAccount.account_type = INDIVIDUAL`** u ovom slučaju — eksplicitno, ne pretpostavljeno (dopuna avgust 2026, rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`); B2C sajt nikad sam ne kreira `LEGAL_ENTITY` nalog — takav nalog uvek dolazi ili preko M7 (B2B) ili ručnim unosom tima kroz M17.
4. **Prihvatanje uslova ugovora (clickwrap)** — pre prelaska na plaćanje, gost potvrđuje polje "Prihvatam uslove ugovora o putovanju" (M20 poglavlje 3.2), postavlja `Quote.contract_terms_accepted = true` i `contract_terms_accepted_at` (M5 poglavlje 3.1, dopuna avgust 2026 — konkretna polja koja zatvaraju raniju rupu u ovom toku). Pošto se stvaran `ClientContract` (M20) generiše tek posle potvrde rezervacije (M20 poglavlje 3.1, okidač je `booking.confirmed`), ova dva polja se prenose na `ClientContract.accepted_at`/`accepted_method = ELECTRONIC_CLICKWRAP` čim on nastane — sajt ne dozvoljava nastavak na korak 5 (Plaćanje) dok `contract_terms_accepted != true`. Tačan trenutak u odnosu na izdavanje vaučera i dalje potvrđuje pravnik (M20 poglavlje 3.3/8 — otvoreno pitanje, ne rešava se nagađanjem ovde) — ovom dopunom je zatvoren samo tehnički model podataka, ne pravno pitanje redosleda.
5. **Plaćanje:**
   - **Kartica:** hostovana forma platnog provajdera (M10 poglavlje 7.2) — plaćanje se obrađuje **pre** potvrde rezervacije; ako potvrda posle uspešnog plaćanja ne uspe (kapacitet nestao), sajt prikazuje jasnu poruku i automatski vraćen iznos (M10 već pokriva ovo).
   - **Bankovni prenos:** rezervacija se potvrđuje odmah (`payment_status = UNPAID`), sajt prikazuje instrukcije za uplatu i šalje ih i mejlom uz vaučer.
6. **Potvrda** — prikazuje broj rezervacije i link ka vaučeru. Za `tip_nastupanja = ORGANIZATOR`, link ka vaučeru se pojavljuje tek kad `ClientContract` (M20) dostigne bar status `GENERATED` (M5 poglavlje 6) — u praksi gotovo trenutno posle potvrde, pošto se ugovor generiše automatski čim `Booking` pređe u `CONFIRMED` (M20 poglavlje 3.1).

---

## 3a. Univerzalna pretraga i AI razgovor — omnisearch (dopuna, avgust 2026, na zahtev vlasnika)

Isto polje kao M17/M7 (M15 poglavlje 6.5), vidljivo u zaglavlju sajta na svakoj stranici — **drugačiji kontekst od M17/M7**, jer je publika anonimni ili prijavljeni gost, ne interni tim/partner:

- **Prazan upit + Enter** — prikazuje osnovnu navigaciju sajta (Destinacije, Moje rezervacije — samo ako je gost prijavljen, Pomoć), ne administrativne rute.
- **Uneti tekst** — poziva `POST /ai-orchestration/omnisearch` sa `channel = B2C_SITE`. Dva moguća pravca upita: (a) pretraga proizvoda na prirodnom jeziku ("porodični hotel u Grčkoj, avgust, all inclusive") — prevodi se u poziv ka M5 `/search` (poglavlje 3, korak 1) sa izvedenim parametrima; (b) pitanje o platformi/uslovima ("kako otkazujem rezervaciju", "šta znači boravišna taksa") — prosleđuje se M21 (Centar za pomoć, kad taj kanal dođe na red) umesto M5, isti princip razdvajanja kao M15 poglavlje 6.5.5.
- Rezultati nikad ne otkrivaju identitet dobavljača (M2 poglavlje 5.1) niti tuđe rezervacije — gost vidi samo javni katalog i sopstveni nalog, isto ograničenje kao ostatak ovog dokumenta.
- Radi anonimno (gost bez naloga i dalje može da pretražuje/pita), isti princip kao poglavlje 3, korak 1 (anonimna pretraga).

---

## 4. Nalog gosta

Registracija/prijava ide kroz M1 (`account_type = GUEST`, 2FA opciona po M1 specifikaciji). Pri prvoj registraciji kreira se M6 `ClientAccount` + `GuestProfile` povezani na taj `User`. "Moje rezervacije" čita direktno iz M5 (bez dupliranja), u skladu sa principom iz M6 specifikacije (istorija se ne čuva posebno).

Gost može sa ove stranice da pokrene otkazivanje (M5 `/bookings/:id/cancel`), u granicama pravila otkazivanja — sajt unapred prikazuje procenat povraćaja pre nego što gost potvrdi otkazivanje.

---

## 5. SEO i renderovanje

- Next.js server-side rendering za stranice proizvoda i pretrage (bitno za SEO, poglavlje 6 Master dokumenta).
- Pošto je hosting self-hosted Node (ne Vercel — potvrđena odluka u poglavlju 6 Master dokumenta), periodična regeneracija statičnog sadržaja (ISR-like ponašanje) i dalje radi na jednom Node serveru kroz Next.js "revalidate" mehanizam — nije potrebna Vercel infrastruktura za ovo, samo se gubi globalna edge distribucija, što nije kritično za sajt jednog turoperatora fokusiranog na jedno tržište/region.
- `slug` polje iz M2 `ProductTranslation` (po jeziku) koristi se direktno u URL-u — svaki jezik ima svoj SEO-prijateljski URL za isti proizvod.
- Sitemap se generiše iz M2 `/products?status=ACTIVE&channel=B2C_SITE`, po jeziku.

### 5.1 Schema.org strukturirani podaci (konkretna lista)

Pored opšteg SSR/SEO pristupa iznad, sledeće JSON-LD komponente se generišu direktno iz već postojećih M2/M6 podataka (bez novog modela), po uzoru na PrimeTravel (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 8):

| Komponenta | Gde se koristi |
| :---- | :---- |
| `SEOMeta` (title/description/OG tagovi) | Sve stranice |
| `BreadcrumbLD` | Sve stranice osim `/` |
| `HotelSchemaLD` | `/[tip]/[slug]` za proizvode tipa `ACCOMMODATION` |
| `TouristTripSchemaLD` | `/[tip]/[slug]` za proizvode tipa `PACKAGE` |
| `FAQSchemaLD` | Stranice proizvoda sa FAQ sadržajem, ako postoji |
| `LocalBusinessSchemaLD` | `/o-nama`, `/kontakt` |

Jeftino za implementaciju (samo generisanje JSON-LD bloka iz postojećih polja), direktno poboljšava vidljivost na Google-u.

---

## 6. Sadržaj van kataloga — M12 Content Engine

Stranice poput "O nama", blog, marketinški sadržaj su posao M12 (Content Engine). Dopunjeno avgust 2026 (M12 poglavlje 3b): `/stranica/[slug]` i `/blog/[slug]` (poglavlje 2 iznad) čitaju direktno iz M12 `ContentPiece`/`ContentTranslation` (`type = STATIC_PAGE`/`BLOG_POST`, `status = PUBLISHED`), isti obrazac kao stranica proizvoda čita iz M2 — M8 nema sopstveni model podataka ni za ovaj sadržaj, samo prikaz. `/uslovi` ostaje van ovog mehanizma (pravni tekst, ne uređuje se kroz redovan sadržajni tok sa odobrenjem — vidi poglavlje 2).

---

## 7. Privatnost i saglasnost (poglavlje 9 Master dokumenta)

Sajt prikazuje baner za saglasnost na kolačiće/marketing pri prvoj poseti; saglasnost za marketinšku komunikaciju se čuva u M6 (`ClientAccount.marketing_consent`), ne lokalno u browseru, jer mora preživeti promenu uređaja i biti dokaziva.

---

## 8. Dozvole

M8 nema sopstveni katalog dozvola u M1 — on samo poziva API-je drugih modula, koji sami sprovode prava pristupa (npr. Gost uloga iz M1 već ograničava `/bookings` na sopstvene zapise). Nema potrebe za novim `M8/...` dozvolama.

---

## 9. Izlazni kriterijum (M8 deo Faze 3 — poglavlje 8 Master dokumenta)

- [ ] Gost može samostalno da pretraži i rezerviše na sajtu, uključujući kartično plaćanje, bez ručne intervencije tima.
- [ ] Podaci se pune isključivo iz M2/M5/M6/M10 — nema lokalne baze proizvoda ili rezervacija u M8.
- [ ] Sve 8 jezika rade sa ispravnim fallback-om (M2 pravilo) i zasebnim SEO URL-ovima.
- [ ] "Moje rezervacije" prikazuje tačnu, uživo dobijenu istoriju, bez duplog čuvanja podataka.
- [ ] Neuspelo kartično plaćanje ili neuspela potvrda posle plaćanja ne ostavlja gosta bez jasne poruke i bez naplate bez rezervacije.
- [ ] Stranice proizvoda i sajta emituju odgovarajući schema.org JSON-LD blok iz liste u poglavlju 5.1, proverljivo Google Rich Results test alatom.
- [ ] Gost ne može preći na korak Plaćanje bez `Quote.contract_terms_accepted = true` (poglavlje 3, korak 4); ovaj pristanak je vidljivo povezan na `ClientContract.accepted_method = ELECTRONIC_CLICKWRAP` čim se ugovor generiše.
- [ ] Gost koji nastavi bez naloga dobija `ClientAccount.account_type = INDIVIDUAL` (poglavlje 3, korak 3).
- [x] Omnisearch (poglavlje 3a) ispravno razdvaja upite o proizvodima (ka M2 javnom katalogu preko `ProductsService.findAllPublic`, isti dobavljača-slep put kao M5 `/search`) od pitanja o platformi (ka M21, sad i za `PUBLIC_GUEST` publiku — anonimni i INDIVIDUAL gosti, M21 spec v1.4), i nikad ne otkriva identitet dobavljača ni tuđe rezervacije. *(avgust 2026 — `apps/api/src/modules/m15-ai-orkestracija/omnisearch/`, jedinični testovi za anoniman i prijavljen B2C_SITE slučaj. M21 odgovor za B2C posetioca zavisi od toga da li tim već objavio bar jedan `PUBLIC_GUEST` članak za tu temu — 4 nacrta postoje, čekaju objavljivanje.)*
- [ ] Ceo tok pretrage/rezervacije radi ispravno na telefonu, preklopnom telefonu i tabletu, fluidnim rasporedom bez fiksnih desktop širina (Master dokument poglavlje 5.1).
- [x] `/znanje/[share_token]` prikazuje tačno jedan M23 članak, radi bez prijave, i ne izlaže nikakvu navigaciju ka ostatku baze znanja ili sajta. *(avgust 2026 — `apps/web/src/app/[locale]/znanje/[shareToken]/page.tsx`, izvan `(site)` route grupe koja nosi Header/Footer; potvrđeno da vraćen HTML ne sadrži nijedan nav element.)*

---

## 1a. Vizuelni identitet (dopuna avgust 2026, potvrđeno vlasnikom)

Paleta boja — **"Zalazak"** (jedna od tri palete iz `docs/moduli/M01-core-identitet/00-MOCKUP-M1-TERMINAL-STYLE.html`, koja je nastala kao terminal-stil prototip za M17): `--accent:#e8a63c` / `--accent-strong:#f4c473` (dark) i `--accent:#c1791f` / `--accent-strong:#9c5f14` (light), `--accent2:#2ba894`/`#12907d` kao sekundarna teal boja, uz istu `--bg`/`--panel`/`--text` skalu iz tog fajla. **Samo paleta se prenosi, ne i terminal/monospace izgled** — taj mockup je pravljen za M17 (interni tim, komandna-linija estetika, monospace font); M8 (gost, javan sajt) koristi iste boje, ali uobičajen izgled turističkog sajta (kartice sa fotografijama, obični sans-serif font, ne monospace/tabovi/komandna paleta). Podržava i svetlu i tamnu temu (`prefers-color-scheme`), isto ponašanje kao paleta u izvornom fajlu.

### 1a.1 Ispravka kontrasta i boja šljive (17.8.2026, odluka vlasnika)

Paleta iz gornjeg pasusa **nije bila proverena po pravilu kontrasta** (`docs/analize/29-DIZAJN-SISTEM-UI.md` §2a, WCAG AA je tvrd zahtev) — sedam parova je padalo u svetlom modu, dva u tamnom; najgori je bila granica na `1.19:1` (ivice kartica i polja praktično nevidljive) i tekst na punom dugmetu "Rezerviši" na `3.30:1`. Tačne stare i nove vrednosti, sa merenjima, su u tabeli u poglavlju 8 tog dokumenta — ovde se namerno ne prepisuju, da se dva mesta ne raziđu. Tonovi su zadržani; vrednosti su samo zatamnjene koliko je bilo nužno.

**Boja šljive (modro-plava) je druga boja sajta**, uloga: sve što nije glavna radnja (sekundarna dugmad, oznake, akcenti). Glavna radnja ostaje amber. Šljiva je **zamenila** teal `--accent2` iz gornjeg pasusa, koji je ukinut — bio je upotrebljen na jednom jedinom mestu, pa nije bio stvarna druga boja identiteta.

### 1a.2 Širina prikaza — puna širina ekrana, sa izuzetkom (17.8.2026, odluka vlasnika)

Sajt zauzima **celu širinu ekrana**; ranije ograničenje na 1152px je uklonjeno. Zaglavlje, sadržaj i podnožje dele isti bočni prostor koji raste sa ekranom. Liste proizvoda dobijaju više kolona na širokim ekranima (do 5) — puna širina treba da pokaže više ponude, ne istu ponudu krupnije.

**Izuzetak (izričito na vlasnikov zahtev):** stranica **pojedinačnog hotela/putovanja** (`/[tip]/[slug]`) ostaje ograničene širine i centrirana, jer se čita, ne pregleda. Isto važi za blog i opšte stranice (`/blog/[slug]`, `/stranica/[slug]`, `/uslovi`), ceo tok rezervacije, prijavu/registraciju, i deljenu stranicu članka znanja. Puno obrazloženje i pravilo: `29-DIZAJN-SISTEM-UI.md` poglavlje 6b.

## 9a. Obim prvog prolaza implementacije (avgust 2026)

M12 (Content Engine), M15 (AI orkestracija/omnisearch) i M23 (Znanje) nisu imali kod u trenutku kad je M8 počeo da se gradi. Prvi prolaz implementacije je pokrio sve rute iz poglavlja 2 koje ne zavise od ta tri modula — pretraga, stranica proizvoda, ceo tok rezervacije/plaćanja, nalog gosta; `/stranica/[slug]`, `/blog/[slug]`, omnisearch traka (poglavlje 3a) i `/znanje/[share_token]` su dobili privremenu "uskoro" stranicu.

**Dopuna avgust 2026 (M12 u međuvremenu implementiran):** `/stranica/[slug]` i `/blog/[slug]` su povezani sa M12 (`GET /marketing/public/content`, poglavlje 2) i **sada su deo izlaznog kriterijuma**. Omnisearch traka (poglavlje 3a) i `/znanje/[share_token]` i dalje čekaju M15/M23 (koji još nemaju kod) i ostaju van izlaznog kriterijuma dok ti moduli ne budu implementirani, isti obrazac kao ranije forward-reference u drugim modulima (npr. M6 poglavlje 10 čeka M8).

**Dopuna avgust 2026 (M15/M23 u međuvremenu implementirani):** oba preostala odložena stavka su zatvorena. Omnisearch: `OmnisearchQueryDto.channel` prošireno na `B2C_SITE` (ranije samo `INTERNAL_PANEL`), kontroler radi anonimno za taj kanal (ručna, po-kanalu JWT provera, isti obrazac kao M5 `SearchController`), `OmnisearchService` grana proizvode kroz `ProductsService.findAllPublic` (M2 §5.1 dobavljača-slep serializer) i rezervacije kroz isti user-scoped `BookingsService.findAll` samo za prijavljenog gosta, pitanja o platformi idu ka M21 `HelpAssistantService` (in-process DI poziv, ne HTTP). Frontend: `Header.tsx` sad ugrađuje `OmnisearchBar.tsx` (klijentska komponenta) koja poziva `POST /api/omnisearch` (Next.js route handler, §1 BFF pravilo). `/znanje/[share_token]`: čita `GET /knowledge/public/:shareToken` (M23 spec §5); da bi stranica ostala bez ikakve navigacije ka ostatku sajta (izlazni kriterijum, poslednja stavka), ostatak sajta je premešten u novu `app/[locale]/(site)/` route grupu (Next.js route grupe ne menjaju URL) koja nosi Header/Footer — `/znanje/[share_token]` ostaje van te grupe, pa ne nasleđuje ih. **Rešeno** (avgust 2026, potvrda vlasnika): M21 je proširen novom publikom `PUBLIC_GUEST` (M21 spec v1.4, `resolveHelpAudience` sad vraća `PUBLIC_GUEST` za anonimne i INDIVIDUAL goste umesto `null`) — omnisearch tačka (b) sad dobija M21 odgovor za tipičnog B2C posetioca, čim tim objavi bar jedan `PUBLIC_GUEST` članak (4 nacrta seedovana, čekaju pregled/objavljivanje kroz `apps/panel` `/pomoc`).

**Dodatno odloženo, otkriveno pri implementaciji:** poglavlje 3, korak 3, opcija "nastaviti kao gost bez naloga" zahteva javan (bez prijave) M6 endpoint za kreiranje minimalnog `ClientAccount`/`GuestProfile` — takav endpoint danas ne postoji (M6 `POST /client-accounts` zahteva internu dozvolu, namerno, da spreči zloupotrebu/spam bez ikakve autentikacije). U ovom prolazu M8 tok korak 3 nudi samo "prijavi se"/"registruj se" (M1 `POST /auth/register`, poglavlje 4) — opcija bez naloga se vraća kad se javan, rate-limitovan M6 put za to definiše kao posebna dopuna (upisati u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`).

## 10. Otvoreno za dalje

**Rešeno (jul 2026.):** interni radni panel je formalizovan kao **M17** u Master dokumentu (poglavlje 4) — dobiće sopstvenu Nivo 2 specifikaciju kad dođe na red.

- ~~Tačan izbor CMS-lite rešenja za statične stranice.~~ **Rešeno** (avgust 2026, poglavlje 6): opšte stranice/blog idu kroz M12, bez posebnog CMS-a; `/uslovi` ostaje jedini čist statičan tekst van tog toka.
- Detalji cookie/consent banera (tačan tekst, pravni zahtevi) — potvrditi sa pravnikom pri implementaciji, u skladu sa Zakonom o zaštiti podataka o ličnosti.
