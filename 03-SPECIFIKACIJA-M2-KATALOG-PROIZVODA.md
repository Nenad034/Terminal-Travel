# Specifikacija modula M2 — Katalog proizvoda

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M2) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.2 — na zahtev vlasnika (avgust 2026): dodata tri nova `Product.type` (`TRANSPORT`, `TICKET`, `EVENT`, poglavlje 2.1) i strukturirana konvencija atributa za svaki (poglavlje 2.3), radi preciznije pretrage po tipu turističkog proizvoda; v1.1 dodato pravilo skrivanja identiteta dobavljača od B2C/B2B kanala (poglavlje 5.1), na zahtev vlasnika (avgust 2026)
**Zavisi od:** M1 (Core / Identitet i pristup)

---

## 1. Svrha i obim modula

M2 je centralni registar svih prodajnih proizvoda agencije, bez obzira na to da li poreklo proizvoda dolazi iz direktnog ugovora (M3) ili spoljne API konekcije (M4). M2 definiše **jedan, provajder-nezavisan oblik** proizvoda koji koriste svi ostali moduli (M5 rezervacije, M8 sajt, M9 aplikacija, M12 marketing, M13 BI) — u skladu sa principom #3 iz poglavlja 3 Master dokumenta (spoljni provajderi su adapteri, ne temelj).

Van obima ove specifikacije: uslovi ugovora, alotmani i cenovnici (to je M3), logika poziva ka spoljnim API-jima (to je M4), i sama pretraga/rezervacija (to je M5). M2 odgovara na pitanje **"šta postoji i šta se o tome zna"**, ne "po kojoj ceni" ili "koliko ima slobodno" — to su uvek pitanja za M3/M4/M5 u trenutku pretrage ili rezervacije.

---

## 2. Model podataka

### 2.1 `Product` — jezički nezavisno jezgro
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| type | enum: `ACCOMMODATION`, `PACKAGE`, `TRANSFER`, `EXCURSION`, `FLIGHT`, `INSURANCE`, `TRANSPORT`, `TICKET`, `EVENT` *(poslednja tri dodata avgust 2026, na zahtev vlasnika — poglavlje 2.3)* | proširivo kasnije bez izmene strukture |
| source_type | enum: `CONTRACTED`, `API` | odgovara pojmu "Izvor proizvoda" iz poglavlja 2 Master dokumenta |
| source_contract_id | UUID, nullable | FK ka M3 (Ugovor) — popunjeno samo kad `source_type = CONTRACTED` |
| source_provider | string, nullable | npr. `travelgate` — popunjeno samo kad `source_type = API` |
| source_external_id | string, nullable | id proizvoda kod spoljnog provajdera |
| destination_country / destination_city | string | strukturirana lokacija radi pretrage i filtriranja |
| geo_lat / geo_lng | decimal, nullable | za prikaz na mapi |
| media | JSONB | niz `{url, type: image\|video, order}` — jezički nezavisno (iste slike za sve jezike) |
| attributes | JSONB | polja specifična za `type` (vidi 2.3) — jezički nezavisna (npr. broj zvezdica, trajanje) |
| status | enum: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` | samo `ACTIVE` proizvodi su vidljivi kanalima prodaje |
| visible_channels | niz enum: `B2C_SITE`, `B2B_PORTAL`, `MOBILE` | kontroliše gde se proizvod prikazuje (M7/M8/M9) |
| cache_status | enum: `N/A`, `NOT_CACHED`, `CACHED`, `STALE` | `N/A` za `CONTRACTED` (nema smisla); vidi poglavlje 3 |
| last_synced_at | timestamp, nullable | poslednja provera sadržaja naspram spoljnog izvora |
| created_at / updated_at / created_by | timestamp / UUID | `created_by` referencira M1 User (ili AI agenta — vidi poglavlje 7 Master dokumenta) |

### 2.2 `ProductTranslation` — jezički zavisan sadržaj
Prevodi se **ne** čuvaju kao fiksne kolone (sr_name, en_name...) jer je broj jezika velik (8) i može rasti — čuvaju se kao redovi, po jeziku:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| product_id | UUID (FK → Product) | |
| language_code | enum: `sr`, `en`, `hr`, `sl`, `es`, `de`, `ru`, `fr` | |
| name | string | |
| description | text | |
| slug | string | za SEO-prijateljske URL-ove na sajtu (M8), jedinstven po jeziku |
| translation_source | enum: `MANUAL`, `AI_GENERATED` | da se zna da li je prevod ljudski unet ili automatski |
| is_reviewed | boolean, default false | da li je AI-generisan prevod pregledan od strane čoveka pre objave |
| created_at / updated_at | timestamp | |

**Pravilo padanja unazad (fallback):** ako prevod za traženi jezik ne postoji, prikazuje se prvo engleski, pa srpski, tim redosledom. Proizvod se može objaviti (status `ACTIVE`) i ako nema svih 8 prevoda — nedostajući jezici koriste fallback dok se ne dopune, ali **srpski i engleski prevod su obavezni pre nego što proizvod pređe iz `DRAFT` u `ACTIVE`.**

### 2.3 `attributes` (JSONB) — konvencija po tipu proizvoda
Nije prinudno na nivou baze (JSONB je fleksibilan), ali svaki modul koji čita/piše proizvod određenog tipa mora poštovati ovu konvenciju. Primeri:

| Tip | Očekivana polja u `attributes` |
| :---- | :---- |
| `ACCOMMODATION` | `accommodation_type` (enum: `HOTEL`, `VILA`, `APARTMAN`, `HOSTEL`, `KAMP`, `KABINA_NA_BRODU`, `DRUGO` — proširivo bez izmene strukture), `stars`, `board_type` (npr. all-inclusive, polupansion), `room_types[]`, `amenities[]` |
| `PACKAGE` | `duration_days`, `included_products[]` (reference na druge Product id-jeve), `itinerary` |
| `TRANSFER` | `vehicle_type`, `max_passengers`, `route` — tačka-do-tačke prevoz vezan za dolazak/odlazak gosta (npr. aerodrom→hotel), **ne** meša se sa `TRANSPORT` niže |
| `EXCURSION` | `duration_hours`, `itinerary`, `includes[]`, `difficulty_level`, `departure_point`, `min_participants`/`max_participants` |
| `FLIGHT` | `airline`, `route`, `cabin_class` — ostaje poseban tip (ne pod `TRANSPORT`) jer ima drugačiju logiku i vremenom dobija GDS/NDC integraciju preko M4 (Master dokument, Dodatak A, nalaz 2.8.2026) |
| `INSURANCE` | `coverage_type`, `provider`, `terms_document_url` |
| `TRANSPORT` *(dodato avgust 2026)* | `transport_mode` (enum: `BUS`, `MINIBUS`, `TRAIN`, `BOAT`, `RENT_A_CAR`, `PRIVATE_CAR_WITH_DRIVER` — proširivo bez izmene strukture), `route` (strukturirano polazište/odredište, ne slobodan tekst — radi filtriranja u pretrazi), `departure_datetime`/`arrival_datetime`, `class` (nivo udobnosti/kategorija vozila). Za `RENT_A_CAR` dodatno: `vehicle_category`, `min_driver_age`, `pickup_location`/`dropoff_location`. Za `PRIVATE_CAR_WITH_DRIVER` dodatno: `max_passengers` (isti oblik kao `TRANSFER`, ali vozilo/vozač su proizvod sam po sebi, ne vezano za konkretan dolazak/odlazak gosta) |
| `TICKET` *(dodato avgust 2026)* | `venue` (objekat/lokacija), `category` (npr. muzej, park, atrakcija), `valid_from`/`valid_to` (period važenja, ne konkretan termin), `skip_the_line` (boolean) — bez vodiča/itinerara, razlika u odnosu na `EXCURSION` |
| `EVENT` *(dodato avgust 2026)* | `event_datetime` (fiksan termin, ne opseg kao smeštaj), `venue`, `performer`/`organizer`, `category` (npr. koncert, sport, festival), `seating_type` (numerisano sedište vs. slobodan ulaz) — razlika u odnosu na `TICKET`: ovde je termin fiksan i određen spolja (izvođač/organizator), ne bira ga gost |

**Napomena o "Prevoz" kao jedinstvenom tipu, ne šest odvojenih:** `TRANSPORT` sa strukturiranim `transport_mode` pod-atributom je isti obrazac koji već koristi `ACCOMMODATION.accommodation_type` (HOTEL/VILA/APARTMAN...) — jedan `Product.type` za pretragu/filtriranje na najvišem nivou, sa pod-tipom koji nosi finiju granulaciju. `RENT_A_CAR` i `PRIVATE_CAR_WITH_DRIVER` su namerno odvojene vrednosti unutar `transport_mode` (ne spojene u jedan "automobil" mod) jer imaju različit poslovni model — potvrđeno sa vlasnikom (avgust 2026).

Ova tabela se dopunjuje kad se svaki tip stvarno počne koristiti u Fazi 1 — nije potrebno unapred predvideti sva polja.

---

## 3. Poreklo proizvoda i keširanje sadržaja

### 3.1 CONTRACTED proizvodi
Puni zapis uvek postoji u M2, direktno unet (ručno ili preko AI asistencije) kad se ugovor u M3 zaključi. `source_type = CONTRACTED`. Nema pojma keširanja — ovo je jedini izvor istine.

### 3.2 API-sourced proizvodi — lenjo keširanje statičnog sadržaja
S obzirom na to da spoljni katalozi (npr. Travelgate) mogu imati desetine hiljada stavki, M2 **ne uvozi sve unapred**. Umesto toga:

1. Kad gost/agent prvi put pretraži destinaciju i M4 vrati rezultate sa spoljnog provajdera, **statični sadržaj** (naziv, opis, slike, lokacija, zvezdice, sadržaji) tog proizvoda se jednom sačuva u `Product` + `ProductTranslation` sa `cache_status = CACHED` i `source_type = API`.
2. Proizvodi koji nikad nisu pretraženi nikad se ne čuvaju — katalog raste organski, ne unapred.
3. **Mesečna provera** (AI agent, nivo autonomije "Autonomno" iz poglavlja 7 Master dokumenta — ovo je čisto informativno, ne dira novac ni pravne obaveze): agent ponovo povuče statični sadržaj za svaki `CACHED` proizvod čiji je `last_synced_at` stariji od 30 dana, uporedi sa sačuvanom verzijom, i ako ima razlike — ažurira zapis i upisuje promenu u audit log (M1). Ako provera ne uspe (proizvod više ne postoji kod provajdera), status prelazi u `STALE` i proizvod se automatski uklanja iz `visible_channels` dok se ručno ne potvrdi.
4. **Cena i dostupnost se NIKAD ne čuvaju u ovom kešu** — vidi poglavlje 4.

---

## 4. Cena i dostupnost — namerno van modela ovog modula

`Product` nema polje za cenu. Ovo je namerna odluka, ne propust:

- Za **CONTRACTED** proizvode, cena/alotman žive u M3 (Ugovaranje) i menjaju se po sopstvenim pravilima (sezone, popusti) — M2 samo referencira ugovor, ne duplira cenu.
- Za **API-sourced** proizvode, cena i dostupnost zavise od konkretnih parametara pretrage (datumi, broj gostiju) i moraju se **uvek** dobiti uživo kroz M4 u trenutku pretrage — ne postoji smislena "cena proizvoda" nezavisna od tih parametara.
- U oba slučaja, **cena se ponovo proverava neposredno pre potvrde rezervacije** (M5), nikad se ne uzima kao gotova iz ranijeg prikaza — u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta, jer je ovo mesto gde greška direktno utiče na novac.

---

## 4.1 Događaj (Event Bus)

Kad `Product.status` pređe u `ACTIVE` preko `/products/:id/publish`, M2 emituje `product.published` na Event Bus — koristi ga M12 (poglavlje 3 te specifikacije) za automatsko generisanje nacrta marketinškog sadržaja, bez direktnog poziva između modula (princip #2, poglavlje 3 Master dokumenta).

---

## 5. Vidljivost po kanalima

`visible_channels` na proizvodu kontroliše da li se proizvod pojavljuje na sajtu (M8), u B2B portalu (M7) ili u mobilnoj aplikaciji (M9). Proizvod može biti `ACTIVE` a vidljiv samo B2B partnerima (npr. poseban ugovoreni kapacitet), ili samo na sajtu. Podrazumevano prazno (nigde vidljiv) dok se eksplicitno ne uključi — sprečava slučajnu objavu nedovršenog proizvoda.

### 5.1 Identitet dobavljača se nikad ne izlaže B2C/B2B kanalima (dopuna, avgust 2026, na zahtev vlasnika)

`visible_channels` kontroliše vidljivost **proizvoda**, ne vidljivost **porekla** tog proizvoda. Bez obzira na `visible_channels`, sledeća polja su isključivo interna i nikad se ne vraćaju kroz odgovor API-ja koji čitaju M7 (B2B portal) ili M8 (sajt), niti kroz M9 gostinski deo:

- `Product.source_type`, `Product.source_contract_id`, `Product.source_provider`, `Product.source_external_id` (poglavlje 2.1)
- bilo koje polje iz M3 `Contract`/`Supplier` do kog bi se moglo doći preko `source_contract_id`

**Razlog:** sprečava da B2B subagent ili gost sazna preko kog dobavljača/provajdera je proizvod nabavljen i ode direktno kod njega, zaobilazeći agenciju — poslovno pravilo, ne tehničko ograničenje. Vidljiv ostaje samo sam proizvod (naziv, opis, lokacija, atributi iz `ProductTranslation`/`attributes`) — npr. naziv hotela je deo proizvoda i gost ga mora znati; koga smo mi kao agencija ugovorili da bismo taj hotel prodali, ne sme.

**Izuzetak — interni kanal:** M17 (interni radni panel) poziva iste interne API-je M2/M3 sa punim pravima uloge korisnika (Vlasnik, Direktor, Sales Manager, Prodajni agent) i **vidi pun lanac** proizvod → ugovor → dobavljač — ovo ograničenje važi isključivo za odgovore ka B2C/B2B-facing kanalima (M7, M8, gostinski deo M9), ne za M17.

**Sprovođenje:** ovo se rešava na nivou API sloja/serializera po kanalu (isti obrazac kao razlika između internog i javnog odgovora u drugim modulima), ne oslanjanjem na to da front-end kanal jednostavno ne prikaže polje — polje se **ne sme naći u payload-u** ka M7/M8/M9-gost, čak i ako bi front-end ignorisao. Dopunjuje M5 poglavlje 6/10 (vaučer i pregled rezervacije za B2B/gosta) istim principom.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M2/product/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent |
| `M2/product/CREATE` | Vlasnik, Direktor |
| `M2/product/EDIT` | Vlasnik, Direktor |
| `M2/product/PUBLISH` (promena statusa/vidljivosti) | Vlasnik, Direktor |
| `M2/product/DELETE` (arhiviranje, ne fizičko brisanje) | Vlasnik, Direktor |
| `M2/product-translation/EDIT` | Vlasnik, Direktor |

**Napomena:** među sedam osnovnih uloga iz M1 ne postoji posebna "Katalog menadžer" uloga. Za sada se uređivanje kataloga drži na Vlasniku/Direktoru; ako se pokaže da neko drugi (npr. Sales Manager) treba da uređuje katalog, to se rešava pojedinačnim izuzetkom (`UserPermissionOverride` iz M1), ne čekajući novu ulogu.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/catalog`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/products` | GET | pretraga/lista, filtri: tip, destinacija, status, kanal, jezik (vraća prevod za traženi jezik sa fallback-om) |
| `/products` | POST | ručno kreiranje CONTRACTED proizvoda |
| `/products/:id` | GET / PATCH / DELETE | DELETE = arhiviranje (status `ARCHIVED`), ne fizičko brisanje |
| `/products/:id/translations` | GET / PUT | pregled/izmena prevoda po jeziku |
| `/products/:id/publish` | POST | menja status u `ACTIVE` i/ili `visible_channels` — zahteva `M2/product/PUBLISH` |
| `/products/cache/sync` | POST | ručno pokretanje sinhronizacije za jedan proizvod (van mesečnog ciklusa) — korisno kad agent na terenu primeti da je opis pogrešan |

---

## 8. Izlazni kriterijum (M2 deo Faze 1)

- [ ] Moguće je ručno kreirati CONTRACTED proizvod sa prevodima na srpski i engleski (minimum), objaviti ga (status `ACTIVE`) i videti ga kroz `/products` filtriran po kanalu.
- [ ] Pretraga destinacije kroz M4 (kad taj modul bude spreman) automatski kreira `CACHED` zapis u M2 sa statičnim sadržajem, bez cene.
- [ ] Mesečni AI ciklus provere sadržaja radi na test skupu proizvoda i ostavlja trag u audit logu (M1) za svaku promenu koju nađe.
- [ ] Fallback jezika radi ispravno (traženi jezik → engleski → srpski).
- [ ] Nijedan proizvod nema cenu upisanu kao trajno polje — cena se uvek dobija iz M3/M4 u trenutku upita.
- [ ] Test: poziv ka `/products` (i svakom drugom M2 endpoint-u) preko M7/M8/M9-gost konteksta ne vraća `source_type`, `source_contract_id`, `source_provider`, `source_external_id` niti bilo šta iz M3 `Supplier`/`Contract` — provereno na nivou payload-a, ne samo prikaza; isti poziv preko M17 (interni kontekst) ta polja ispravno vraća.
- [ ] Moguće je kreirati proizvod tipa `TRANSPORT` (za svaki `transport_mode`), `TICKET` i `EVENT`, sa atributima iz poglavlja 2.3, i naći ga kroz `/products` filtriran po tipu.

---

## 9. Otvoreno za dalje

- Tačna pravila za `PACKAGE` proizvode (paket aranžmani koji uključuju više drugih proizvoda) — odnos prema cenovniku kad se cena paketa razlikuje od zbira pojedinačnih komponenti — definiše se detaljnije kad M3 (Ugovaranje) bude specificiran, pošto to pitanje suštinski pripada cenovnoj logici, ne katalogu.
- Da li treba poseban proces odobrenja (workflow) pre nego što proizvod pređe iz `DRAFT` u `ACTIVE` (npr. da neko drugi pregleda pre objave) — trenutno ide direktno preko dozvole `M2/product/PUBLISH`, bez dodatnog koraka odobrenja.
- **Ograničen kapacitet za `TICKET`/`EVENT`** (npr. koncert sa ograničenim brojem mesta) — isti princip alotmana kao `ACCOMMODATION` već postoji generički u M3 (`ContractPeriod`/`RateLine`), M2 ne treba da menja svoj model zbog toga; potvrditi pri implementaciji M3 dela za ova dva tipa da postojeći model zaista pokriva slučaj bez izmene.
