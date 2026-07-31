# Specifikacija modula M8 — Sajt agencije (B2C prikaz)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M8), poglavlje 5 (referentna arhitektura) i poglavlje 8 (Faza 3)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodata konkretna lista schema.org komponenti (poglavlje 5.1) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1, M2, M5, M6, M10 (kartično plaćanje)

---

## 1. Svrha i obim modula

M8 je javni Next.js sajt za krajnje goste. **Nema sopstvenu bazu ni sopstveni API** — u skladu sa principom "jedan izvor istine" i pravilom iz poglavlja 5 Master dokumenta ("sajt nikad ne poziva Travelgate ili SEF direktno"), M8 isključivo čita i piše kroz interne API-je M1 (autentikacija), M2 (katalog), M5 (pretraga/ponuda/rezervacija), M6 (nalog gosta) i M10 (kartično plaćanje). Back office (unos proizvoda, upravljanje rezervacijama) je isključivo u internom panelu, ne na ovom sajtu — M8 je samo prikaz.

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
| `/rezervacija/placanje` | Kartično plaćanje (hostovana forma provajdera) ili prikaz instrukcija za bankovni prenos | M10 `/payments/card/initiate` |
| `/rezervacija/potvrda` | Potvrda, broj rezervacije, link ka vaučeru | M5 `/bookings/:id` |
| `/nalog/prijava`, `/nalog/registracija` | Prijava/registracija gosta | M1 `/auth/*` |
| `/nalog/moje-rezervacije` | Lista sopstvenih rezervacija, status, vaučeri | M5 `/bookings?client_account_id=...`, prava iz M1 (Gost vidi samo svoje) |
| `/nalog/profil` | Izmena profila, preference, saglasnost za marketing | M6 `/client-accounts/:id` |
| `/o-nama`, `/kontakt`, `/uslovi` | Statični/uređivani sadržaj | Van obima ove specifikacije — vidi poglavlje 6 |

---

## 3. Tok pretrage i rezervacije (korak po korak)

1. **Pretraga** — anonimna, bez potrebe za nalogom. Poziva M5 `/search`, koje već vraća cenu sa primenjenom maržom (M5) i, ako je gost prijavljen, popustom lojalnosti (M6). Rezultati objedinjuju M2/M3 (ugovoreno) i M4 (uživo preko M5).
2. **Izbor i ponuda** — kreira se `Quote` (M5 `/quotes`), `client_account_id` je `null` dok se gost ne identifikuje (dozvoljeno po M5 specifikaciji).
3. **Podaci gostiju** — ako gost nije prijavljen, sajt nudi izbor: prijaviti se, registrovati se, ili nastaviti kao gost bez naloga (u tom slučaju se ipak kreira minimalan `GuestProfile`/`ClientAccount` u M6 radi fiskalnog dokumenta i eTurista prijave, bez `linked_user_id`).
4. **Plaćanje:**
   - **Kartica:** hostovana forma platnog provajdera (M10 poglavlje 7.2) — plaćanje se obrađuje **pre** potvrde rezervacije; ako potvrda posle uspešnog plaćanja ne uspe (kapacitet nestao), sajt prikazuje jasnu poruku i automatski vraćen iznos (M10 već pokriva ovo).
   - **Bankovni prenos:** rezervacija se potvrđuje odmah (`payment_status = UNPAID`), sajt prikazuje instrukcije za uplatu i šalje ih i mejlom uz vaučer.
5. **Potvrda** — prikazuje broj rezervacije i link ka vaučeru (generisanom u M5 nakon `CONFIRMED`).

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

## 6. Sadržaj van kataloga — namerno van obima

Stranice poput "O nama", blog, marketinški sadržaj — to je posao M12 (Content Engine, Faza 6). Za sada M8 prikazuje jednostavne statične stranice (uređivane direktno u kodu/CMS-lite rešenju), bez posebnog modela podataka — kad M12 bude specificiran, te stranice se povezuju na njegov sadržajni tok umesto da ostanu statične.

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

---

## 10. Otvoreno za dalje

**Rešeno (jul 2026.):** interni radni panel je formalizovan kao **M17** u Master dokumentu (poglavlje 4) — dobiće sopstvenu Nivo 2 specifikaciju kad dođe na red.

- Tačan izbor CMS-lite rešenja za statične stranice (poglavlje 6) — odlaže se do M12.
- Detalji cookie/consent banera (tačan tekst, pravni zahtevi) — potvrditi sa pravnikom pri implementaciji, u skladu sa Zakonom o zaštiti podataka o ličnosti.
