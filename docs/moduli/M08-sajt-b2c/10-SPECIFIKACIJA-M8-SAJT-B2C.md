# Specifikacija modula M8 — Sajt agencije (B2C prikaz)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M8), poglavlje 5 (referentna arhitektura) i poglavlje 8 (Faza 3)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.8 — poglavlje 9a dopunjeno: anonimni checkout bez naloga (korak 3) odložen, nedostaje javan M6 endpoint; v1.7 — dodata arhitektonska odluka o BFF pozivima ka backend-u (poglavlje 1) i obim prvog prolaza implementacije (poglavlje 9a), avgust 2026, pri početku implementacije; v1.6 — dodate rute `/stranica/[slug]`/`/blog/[slug]` (M12 poglavlje 6, dopuna avgust 2026) i `/znanje/[share_token]` (M23 poglavlje 5, avgust 2026, nov modul); v1.5 dodato poglavlje 3a (univerzalna pretraga i AI razgovor — omnisearch), dopunjuje M15 poglavlje 6.5 (avgust 2026, na zahtev vlasnika); v1.4 eksplicitan `account_type = INDIVIDUAL` za anonimnog gosta bez naloga (poglavlje 3, korak 3), ažurirana referenca na `Quote.contract_terms_accepted` (poglavlje 3, korak 4) — rešava nalaze iz `VALIDACIJA-WORKFLOW-B2C.md` (avgust 2026, na zahtev vlasnika); v1.3 dodata stavka izlaznog kriterijuma za responsive prikaz (Master dokument poglavlje 5.1); v1.2 dodato prihvatanje ugovora sa klijentom (clickwrap) u tok rezervacije, M20 kao zavisnost (poglavlje 3) — zatvara raniju forward-referencu iz M20 specifikacije; v1.1 dodala konkretnu listu schema.org komponenti (poglavlje 5.1) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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
| `/[tip]/[slug]` | Stranica proizvoda (npr. `/smestaj/hotel-x`) | M2 `/products/:id` preko `slug` iz `ProductTranslation` |
| `/rezervacija/ponuda` | Pregled ponude pre potvrde | M5 `/quotes/:id` |
| `/rezervacija/podaci-gosta` | Unos podataka gostiju (ili prijava postojećeg naloga) | M6 `/guest-profiles`, M1 auth |
| `/rezervacija/uslovi` | Prikaz uslova ugovora i polje "Prihvatam uslove ugovora" (clickwrap), pre prelaska na plaćanje | M20 poglavlje 3.2 |
| `/rezervacija/placanje` | Kartično plaćanje (hostovana forma provajdera) ili prikaz instrukcija za bankovni prenos | M10 `/payments/card/initiate` |
| `/rezervacija/potvrda` | Potvrda, broj rezervacije, link ka vaučeru | M5 `/bookings/:id` |
| `/nalog/prijava`, `/nalog/registracija` | Prijava/registracija gosta | M1 `/auth/*` |
| `/nalog/moje-rezervacije` | Lista sopstvenih rezervacija, status, vaučeri | M5 `/bookings?client_account_id=...`, prava iz M1 (Gost vidi samo svoje) |
| `/nalog/profil` | Izmena profila, preference, saglasnost za marketing | M6 `/client-accounts/:id` |
| `/stranica/[slug]` | Opšte stranice (npr. "O nama", "Kontakt") | M12 `/content?type=STATIC_PAGE&slug=...` (poglavlje 6, dopuna avgust 2026) |
| `/blog/[slug]` | Blog članak | M12 `/content?type=BLOG_POST&slug=...` (poglavlje 6, dopuna avgust 2026) |
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
- [ ] Omnisearch (poglavlje 3a) ispravno razdvaja upite o proizvodima (ka M5 `/search`) od pitanja o platformi (ka M21), i nikad ne otkriva identitet dobavljača ni tuđe rezervacije.
- [ ] Ceo tok pretrage/rezervacije radi ispravno na telefonu, preklopnom telefonu i tabletu, fluidnim rasporedom bez fiksnih desktop širina (Master dokument poglavlje 5.1).
- [ ] `/znanje/[share_token]` prikazuje tačno jedan M23 članak, radi bez prijave, i ne izlaže nikakvu navigaciju ka ostatku baze znanja ili sajta.

---

## 9a. Obim prvog prolaza implementacije (avgust 2026)

M12 (Content Engine), M15 (AI orkestracija/omnisearch) i M23 (Znanje) nemaju kod u trenutku kad M8 počinje da se gradi. Prvi prolaz implementacije pokriva sve rute iz poglavlja 2 koje ne zavise od ta tri modula — pretraga, stranica proizvoda, ceo tok rezervacije/plaćanja, nalog gosta. `/stranica/[slug]`, `/blog/[slug]`, omnisearch traka (poglavlje 3a) i `/znanje/[share_token]` dobijaju privremenu "uskoro" stranicu i **ne ulaze u izlazni kriterijum ovog prolaza** — vraćaju se čim odgovarajući modul dobije kod, isti obrazac kao ranije forward-reference u drugim modulima (npr. M6 poglavlje 10 čeka M8).

**Dodatno odloženo, otkriveno pri implementaciji:** poglavlje 3, korak 3, opcija "nastaviti kao gost bez naloga" zahteva javan (bez prijave) M6 endpoint za kreiranje minimalnog `ClientAccount`/`GuestProfile` — takav endpoint danas ne postoji (M6 `POST /client-accounts` zahteva internu dozvolu, namerno, da spreči zloupotrebu/spam bez ikakve autentikacije). U ovom prolazu M8 tok korak 3 nudi samo "prijavi se"/"registruj se" (M1 `POST /auth/register`, poglavlje 4) — opcija bez naloga se vraća kad se javan, rate-limitovan M6 put za to definiše kao posebna dopuna (upisati u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`).

## 10. Otvoreno za dalje

**Rešeno (jul 2026.):** interni radni panel je formalizovan kao **M17** u Master dokumentu (poglavlje 4) — dobiće sopstvenu Nivo 2 specifikaciju kad dođe na red.

- ~~Tačan izbor CMS-lite rešenja za statične stranice.~~ **Rešeno** (avgust 2026, poglavlje 6): opšte stranice/blog idu kroz M12, bez posebnog CMS-a; `/uslovi` ostaje jedini čist statičan tekst van tog toka.
- Detalji cookie/consent banera (tačan tekst, pravni zahtevi) — potvrditi sa pravnikom pri implementaciji, u skladu sa Zakonom o zaštiti podataka o ličnosti.
