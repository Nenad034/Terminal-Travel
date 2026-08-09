# Specifikacija modula M2 — Katalog proizvoda

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M2) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.7 — dodato poglavlje 3.3a: M23 (Znanje) istraživanje direktno predlaže dopune kataloga kroz postojeći `ProductContentImport` mehanizam (`origin = M23_RESEARCH`, `source_article_revision_id`), bez novog toka odobrenja — na zahtev vlasnika (avgust 2026); v1.6 ispravka na zahtev vlasnika (avgust 2026): `age_policy[].age_to` menja tip iz `integer` u `decimal` i uvodi `X,99` konvenciju zapisa (poglavlje 2.3b) — ceo broj kao gornja granica je dvosmislen (već označava sledeću godinu života); v1.5 na zahtev vlasnika (avgust 2026), na osnovu analize stvarnih cenovnika više dobavljača: `age_policy[].category` dobija `TEEN` kao četvrtu vrednost (poglavlje 2.3b); cena po kategoriji rešena u M3 v1.6, ne ovde; v1.4 na zahtev vlasnika (avgust 2026): `room_types[]` dobija raspodelu kreveta (osnovni/dodatni) i podesivu uzrasnu politiku po sobi (`age_policy[]`) — deca, bebe, krevetac (poglavlje 2.3b); v1.3 na zahtev vlasnika (avgust 2026): `room_types[]` postaje strukturiran niz objekata umesto golih naziva, `media[]` dobija kategorizaciju/galeriju po sobi (poglavlje 2.3a); nov AI agent za uvoz sadržaja hotela sa sajta dobavljača (`ProductContentImport`, poglavlje 3.3), isti obrazac kao M3 `PricelistImport`/M10 `SupplierInvoiceImport`; v1.2 na zahtev vlasnika (avgust 2026): dodata tri nova `Product.type` (`TRANSPORT`, `TICKET`, `EVENT`, poglavlje 2.1) i strukturirana konvencija atributa za svaki (poglavlje 2.3), radi preciznije pretrage po tipu turističkog proizvoda; v1.1 dodato pravilo skrivanja identiteta dobavljača od B2C/B2B kanala (poglavlje 5.1), na zahtev vlasnika (avgust 2026)
**Zavisi od:** M1 (Core / Identitet i pristup); formalno i od M23 (poglavlje 3.3a, predlozi dopuna kataloga iz istraživanja) kad taj modul postoji

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
| media | JSONB | niz strukturiranih stavki galerije (poglavlje 2.3a) — jezički nezavisno (iste slike za sve jezike) |
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
| `ACCOMMODATION` | `accommodation_type` (enum: `HOTEL`, `VILA`, `APARTMAN`, `HOSTEL`, `KAMP`, `KABINA_NA_BRODU`, `DRUGO` — proširivo bez izmene strukture), `stars`, `board_type` (npr. all-inclusive, polupansion), `room_types[]` (strukturirano, poglavlje 2.3a), `amenities[]` |
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

### 2.3a `room_types[]` i galerija slika — struktura (dopuna, avgust 2026, na zahtev vlasnika)

**`room_types[]`** (deo `ACCOMMODATION.attributes`, poglavlje 2.3) više nije spisak golih naziva — svaka stavka je objekat:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| code | string | interni identifikator (npr. `DELUXE_SEA_VIEW`) — ovo je vrednost na koju se referencira `M3 ContractPeriod.room_type` (konvencija, ne strogi FK — M3 poglavlje 2.3) |
| name | string | prikazan naziv (npr. "Deluxe soba sa pogledom na more") — jezički nezavisno, isti obrazac kao `board_type` (nazivi tipova soba se u praksi retko prevode) |
| capacity_adults / capacity_children | integer | maksimalan broj gostiju te vrste sobe — koristi ga M5 pri proveri da li `room_config` (M5 poglavlje 4.2) odgovara ponuđenim sobama |
| size_sqm | decimal, nullable | |
| features[] | niz stringova, nullable | npr. "balkon", "pogled na more", "kada" — slobodna lista, ne zatvoren enum |

**`Product.media`** (poglavlje 2.1) dobija strukturu po stavci umesto pukog `{url, type, order}`:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| url | string | nepromenjeno |
| type | enum: `image`, `video` | nepromenjeno |
| order | integer | nepromenjeno |
| category | enum: `EXTERIOR`, `ROOM`, `AMENITY`, `RESTAURANT`, `POOL`, `BEACH`, `LOBBY`, `VIEW`, `DRUGO` | proširivo bez izmene strukture |
| room_type_code | string, nullable | popunjeno samo kad `category = ROOM` — referencira `room_types[].code` iznad, vezuje sliku uz tačnu sobu umesto generičke galerije |
| caption | string, nullable | kratak opis slike, jezički nezavisno (isti princip kao `board_type`) |
| source | enum: `MANUAL_UPLOAD`, `AI_IMPORTED` | odakle je slika stigla — isti princip praćenja porekla kao `ProductTranslation.translation_source` (poglavlje 2.2); `AI_IMPORTED` slike prolaze kroz odobrenje pre nego što uđu u `media[]` (poglavlje 3.3) |

### 2.3b Kreveti i uzrasna politika po tipu sobe — `beds` i `age_policy[]` (dopuna, avgust 2026, na zahtev vlasnika)

`capacity_adults`/`capacity_children` (poglavlje 2.3a) govore *koliko* gostiju staje u sobu, ali ne govore *iz kojih kreveta* taj kapacitet dolazi niti *koji uzrast* se računa kao dete/beba — to je u praksi različito od hotela do hotela (isti "2+1" kapacitet kod jednog dobavljača znači dete do 12 godina, kod drugog do 6). Potvrđeno sa vlasnikom (avgust 2026): ovo se **ne rešava jednom globalnom konstantom**, već se podešava po `room_types[]` stavci, sa razumnim podrazumevanim vrednostima da svaki hotel ne mora ručno da ih unosi.

**`beds`** (deo svake `room_types[]` stavke, dopunjuje poglavlje 2.3a):

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| base_beds | integer | broj osnovnih kreveta u sobi |
| extra_beds_max | integer, nullable | maksimalan broj dodatnih/pomoćnih kreveta koji se mogu unutra postaviti (razvodni krevet, sofa-krevet); `null` ili `0` = soba ih ne prima |

**`age_policy[]`** (deo svake `room_types[]` stavke) — niz uzrasnih kategorija koje važe za tu konkretnu sobu:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| category | enum: `ADULT`, `CHILD`, `TEEN`, `INFANT` | proširivo bez izmene strukture; jedna stavka po kategoriji; `TEEN` dodat avgust 2026 (analiza stvarnih cenovnika pokazala da ga više dobavljača koristi kao zaseban razred između `CHILD` i `ADULT`, sa sopstvenom cenom) — soba koja ga ne razlikuje od `ADULT`/`CHILD` jednostavno ne unosi tu kategoriju |
| age_from / age_to | decimal / decimal, nullable | uzrasni opseg — **`age_to` se uvek upisuje kao `X,99`, nikad kao ceo broj** (npr. `11.99`, ne `12` ili `12.00`); ceo broj već označava sledeću godinu života, pa bi `age_to: 12` značilo da dete koje baš napuni 12 ispada iz kategorije dan ranije nego što je nameravano — isti zapis kakav koriste i sami dobavljači u cenovnicima (potvrđeno analizom stvarnih ugovora, avgust 2026). `age_from` ostaje ceo broj (`2`, `0`, `12`) jer tu nema te dvosmislenosti — kategorija počinje tačno tog rođendana. **Konkretan uparen primer (potvrđeno sa vlasnikom, avgust 2026):** "do 12 godina" = `CHILD.age_to: 11.99`; "od 12 godina" = sledeća kategorija (`TEEN` ili `ADULT`, zavisno od sobe) `age_from: 12.00` — te dve vrednosti se **nikad ne preklapaju niti ostavljaju rupu**, `age_to` prethodne kategorije i `age_from` sledeće uvek čine tačan prelaz. `age_to = null` znači "i više" (koristi se za `ADULT`) |
| counts_toward_capacity | boolean | da li gost te kategorije ulazi u `capacity_adults`/`capacity_children` brojanje — **razlikuje se po hotelu**, potvrđeno sa vlasnikom da ne postoji jedinstveno pravilo |
| max_count | integer, nullable | maksimalan broj gostiju te kategorije po ovoj sobi (npr. najviše 1 beba); `null` = nema posebnog ograničenja van ukupnog kapaciteta |
| requires_crib | boolean, default false | da li gost te kategorije zahteva krevetac — u praksi relevantno samo za `INFANT` |
| crib_included | boolean, nullable | samo kad `requires_crib = true`: da li je krevetac uključen u cenu (`true`) ili se posebno naplaćuje (`false`) — naplata sama (iznos) ide kroz M3 `RateLine`, ovo polje samo označava da li postoji |

**Podrazumevana politika (fallback):** ako `room_types[]` stavka nema eksplicitno postavljen `age_policy[]`, primenjuje se sistemski podrazumevan niz — `ADULT` (12+, računa se), `CHILD` (2–11,99, računa se), `INFANT` (0–1,99, **ne** računa se u kapacitet, `requires_crib = true`, `crib_included = null` dok se ne potvrdi po hotelu) — isti princip fallback-a kao jezik (poglavlje 2.2). Zaposleni koji unosi/uvozi hotel može prepisati ovaj podrazumevani niz po sobi kad ugovor sa dobavljačem kaže drugačije.

**Veza sa M5 (rezervacije):** `M5 occupancy.room_config[].children_ages[]` (M5 poglavlje 3.2a) nosi sirov uzrast svakog deteta — pri proveri da li izabrana soba prima traženi broj gostiju, M5 svaki uzrast svrstava u odgovarajuću `age_policy[].category` ove sobe (po `age_from`/`age_to`) i broji samo kategorije sa `counts_toward_capacity = true` protiv `capacity_adults`/`capacity_children`. Beba čija kategorija ima `counts_toward_capacity = false` se i dalje evidentira (radi krevetca i eventualne cene), ali ne odbija rezervaciju zbog formalnog kapaciteta sobe.

**Namerno van obima ovde:** tačna cena po uzrasnoj kategoriji (npr. "dete do 11 godina besplatno", "beba uvek besplatna") pripada M3 `RateLine` (poglavlje 2.4a te specifikacije), ne ovom modulu — M2 ovde definiše samo *ko se u koju kategoriju svrstava i da li ulazi u kapacitet*, ne *po kojoj ceni*. **Rešeno u M3 v1.6** (avgust 2026) — `RateLine.age_pricing[]`, na osnovu analize stvarnih cenovnika više dobavljača.

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

### 3.3 AI-potpomognut uvoz sadržaja sa sajta hotela (CONTRACTED proizvodi, dopuna avgust 2026 — na zahtev vlasnika)

Za `CONTRACTED` proizvode (poglavlje 3.1), ručno prekucavanje opisa/galerije/tipova soba sa sajta hotela je sporo i podložno grešci — isti problem koji je već rešen za cenovnike (M3 `PricelistImport`, poglavlje 4 te specifikacije) i za ulazne račune dobavljača (M10 `SupplierInvoiceImport`, poglavlje 8.6 te specifikacije). Ovo je treća primena istog obrasca: **AI izvlači, čovek odobri pre nego što bilo šta postane vidljiv podatak.**

**Obim (v1):** samo `Product.type = ACCOMMODATION` — najveća i najhitnija potreba (sobe, galerija, sadržaji). Isti obrazac se proširuje na druge tipove (izleti, događaji...) kad se pokaže potreba, bez izmene strukture.

**Pokretanje:** zaposleni unosi **URL sajta hotela** uz postojeći ili novi `Product` — sistem ne pretražuje internet sam da pronađe sajt (rizik od pogrešnog poklapanja, npr. isti naziv hotela u drugom gradu) — potvrđeno na zahtev vlasnika.

#### `ProductContentImport`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| product_id | UUID, nullable (FK → Product) | prazno ako se uvoz koristi da **kreira** novi proizvod, ne samo da dopuni postojeći |
| source_url | string | URL sajta hotela koji zaposleni unosi |
| origin | enum: `MANUAL_URL`, `M23_RESEARCH` *(dodato avgust 2026, poglavlje 3.3a)* | `MANUAL_URL` — zaposleni pokrenuo uvoz direktno (tok ispod, nepromenjeno); `M23_RESEARCH` — nastalo iz istraživanja M23 (Znanje), ekstrakcija je već urađena tamo |
| status | enum: `PENDING`, `EXTRACTED`, `REVIEW_IN_PROGRESS`, `COMPLETED`, `FAILED` | `M23_RESEARCH` uvoz ulazi direktno u `EXTRACTED` (ekstrakcija već urađena), preskače `PENDING` |
| extracted_at | timestamp, nullable | |
| failure_reason | text, nullable | |
| created_by / created_at | UUID / timestamp | `created_by` je M23 agent (`account_type = AI_AGENT`) za `origin = M23_RESEARCH` |

#### `ProductContentImportField` — jedna stavka po izvučenom podatku
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| import_id | UUID (FK → ProductContentImport) | |
| field_type | enum: `NAME`, `DESCRIPTION`, `AMENITY`, `ROOM_TYPE`, `PHOTO`, `LOCATION`, `SERVICE` | pokriva tačno ono što je vlasnik naveo: opis, sadržaji, tipovi smeštaja, slike, lokacija, usluge |
| extracted_value | JSONB | sirov izvučen sadržaj — tekst, URL slike, ili strukturiran objekat (npr. kandidat za `room_types[]` stavku, poglavlje 2.3a) u zavisnosti od `field_type` |
| match_confidence | decimal (0–100), nullable | isti princip kao `PricelistImportRow.match_confidence` (M3 poglavlje 4.2) |
| review_status | enum: `PENDING`, `APPROVED`, `EDITED_AND_APPROVED`, `REJECTED` | |
| reviewed_by / reviewed_at | UUID (FK → M1 User), nullable / timestamp, nullable | **nikad AI agent** |
| applied_at | timestamp, nullable | kad je odobrena vrednost stvarno upisana u `Product`/`ProductTranslation`/`media` |
| source_article_revision_id | UUID, nullable (FK → M23 `ArticleRevision`) *(dodato avgust 2026, poglavlje 3.3a)* | popunjeno samo kad `ProductContentImport.origin = M23_RESEARCH` — sledljivost do istraživanja koje je predložilo ovu vrednost |

**Tok:**
1. Zaposleni kreira `ProductContentImport` sa `source_url` (i `product_id` ako dopunjuje postojeći proizvod) — `status = PENDING`.
2. AI agent učitava stranicu i izvlači kandidate po `field_type` u `ProductContentImportField` redove, sa `match_confidence` — nivo **"Autonomno"** iz poglavlja 7 Master dokumenta (čista priprema, ništa još nije objavljeno). `status → EXTRACTED`.
3. Zaposleni pregleda svaki red — odobri, odbije, ili izmeni pa odobri (`EDITED_AND_APPROVED`) — nivo **"Predloži pa čovek odobri"**, isti gejt kao M3 `PricelistImportRow.approve` (poglavlje 4.2.4) i M10 `SupplierInvoiceImport` (poglavlje 8.6). Nijedan red se ne upisuje u `Product` automatski, bez obzira na `match_confidence` — isto pravilo kao M3.
4. Pri odobrenju, sistem upisuje vrednost na odgovarajuće mesto: `NAME`/`DESCRIPTION` → `ProductTranslation` (sa `translation_source = AI_GENERATED`, `is_reviewed = true` pošto je upravo pregledano — poglavlje 2.2), `AMENITY`/`SERVICE` → `attributes.amenities[]`, `ROOM_TYPE` → nova stavka u `attributes.room_types[]` (poglavlje 2.3a), `PHOTO` → nova stavka u `media[]` sa `source = AI_IMPORTED` (poglavlje 2.3a), `LOCATION` → `destination_country`/`destination_city`/`geo_lat`/`geo_lng`.
5. Kad su svi redovi obrađeni (odobreni ili odbijeni), `ProductContentImport.status → COMPLETED`.

**Ograda — jezik:** izvučen tekst (opis, nazivi) se tretira kao **jedan jezik** (obično engleski, jer većina hotelskih sajtova ima bar englesku verziju) — prevod na ostalih 7 jezika i dalje ide kroz postojeći M2 tok (poglavlje 2.2, ručno ili AI prevod), ovaj uvoz ga ne zaobilazi.

**Napomena o autorskim pravima:** slike i tekst preuzeti sa sajta hotela mogu biti zaštićeni autorskim pravom vlasnika sajta — pre javne objave na B2C/B2B kanalima, potvrditi sa dobavljačem (u okviru ugovora, M3) da agencija sme da koristi taj materijal u marketinške svrhe; ovo nije automatski pretpostavljeno pravo. Isto obrazloženje kao ostale stavke koje čekaju pravnu potvrdu (poglavlje 9).

### 3.3a AI iz M23 (Znanje) direktno predlaže dopune kataloga (dopuna, avgust 2026, na zahtev vlasnika)

M23 istražuje predmete tipa `PRODUCT` iz istih vrsta odobrenih izvora kao ovo poglavlje (zvaničan sajt/društvene mreže objekta, M23 poglavlje 4a) — umesto da to bude odvojen, paralelan tok, isti nalaz se **direktno prosleđuje** u ovaj već postojeći uvoz/odobrenje mehanizam, bez dupliranja ekstrakcije niti novog koraka odobrenja:

1. Kad M23 završi istraživanje (`ArticleRevision`, M23 poglavlje 2.4) za članak sa `subject_type = PRODUCT`, agent iz nađenog sadržaja izdvaja kandidate koji odgovaraju **već postojećoj** `field_type` taksonomiji ovog poglavlja (`DESCRIPTION`, `AMENITY`, `ROOM_TYPE`, `PHOTO`, `LOCATION`, `SERVICE`) — ne prenosi se ceo M23 članak (koji je širi, narativni sadržaj), samo strukturirani deo koji ovaj model već prepoznaje.
2. Poziva `POST /product-content-imports` (poglavlje 7) sa `product_id`, `origin = M23_RESEARCH`, i unapred popunjenim `fields[]` — M2 kreira `ProductContentImport` direktno u `status = EXTRACTED` (ekstrakcija je već urađena u M23, M2 je ne ponavlja) i odgovarajuće `ProductContentImportField` redove sa `source_article_revision_id`.
3. Odatle nadalje **identičan tok kao poglavlje 3.3, korak 3–5** — zaposleni pregleda svaki red (odobri/odbije/izmeni), ništa se ne upisuje u `Product`/`ProductTranslation`/`media` bez ljudskog `reviewed_by`. M23 istraživanje ne dobija nikakvo brže/lakše odobrenje samo zato što dolazi iz drugog modula.

**Nivo autonomije:** korak 1–2 (ekstrakcija i slanje predloga) je **"Autonomno"**, isto obrazloženje kao poglavlje 3.3 — ništa još nije vidljivo niti upisano u katalog. Korak 3 ostaje **"Predloži pa čovek odobri"**, nepromenjeno.

**Dozvola:** M23 agent (`account_type = AI_AGENT`) dobija `M2/product-content-import/CREATE` (poglavlje 6) — isti princip kao M7 poglavlje 2.0.4 (domenski agent jednog modula sme da pozove API drugog modula kad zadatak legitimno prelazi granicu), ne novo, šire ovlašćenje.

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
| `M2/product-content-import/CREATE`, `VIEW` | Vlasnik, Direktor; i AI agent zadužen za M2 (poglavlje 3.3 — samo priprema/ekstrakcija); i M23 agent (poglavlje 3.3a — samo `origin = M23_RESEARCH`, isti nivo autonomije) |
| `M2/product-content-import/REVIEW_FIELD` (odobri/odbij/izmeni izvučenu stavku) | Vlasnik, Direktor — **nikad AI agent**, isti nosilac kao `M2/product/EDIT` |

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
| `/product-content-imports` | GET / POST | lista / kreiranje uvoza (poglavlje 3.3), `POST` prima `source_url` i opciono `product_id`; ili, za `origin = M23_RESEARCH` (poglavlje 3.3a), `product_id` i unapred popunjen `fields[]` umesto `source_url` ekstrakcije |
| `/product-content-imports/:id` | GET | detalji, uključujući sve `ProductContentImportField` redove |
| `/product-content-imports/:id/fields/:fieldId/review` | POST | zahteva `M2/product-content-import/REVIEW_FIELD`; prima odluku (`APPROVED`/`EDITED_AND_APPROVED`/`REJECTED`) i po potrebi izmenjenu vrednost |

---

## 8. Izlazni kriterijum (M2 deo Faze 1)

- [ ] Moguće je ručno kreirati CONTRACTED proizvod sa prevodima na srpski i engleski (minimum), objaviti ga (status `ACTIVE`) i videti ga kroz `/products` filtriran po kanalu.
- [ ] Pretraga destinacije kroz M4 (kad taj modul bude spreman) automatski kreira `CACHED` zapis u M2 sa statičnim sadržajem, bez cene.
- [ ] Mesečni AI ciklus provere sadržaja radi na test skupu proizvoda i ostavlja trag u audit logu (M1) za svaku promenu koju nađe.
- [ ] Fallback jezika radi ispravno (traženi jezik → engleski → srpski).
- [ ] Nijedan proizvod nema cenu upisanu kao trajno polje — cena se uvek dobija iz M3/M4 u trenutku upita.
- [ ] Test: poziv ka `/products` (i svakom drugom M2 endpoint-u) preko M7/M8/M9-gost konteksta ne vraća `source_type`, `source_contract_id`, `source_provider`, `source_external_id` niti bilo šta iz M3 `Supplier`/`Contract` — provereno na nivou payload-a, ne samo prikaza; isti poziv preko M17 (interni kontekst) ta polja ispravno vraća.
- [ ] Moguće je kreirati proizvod tipa `TRANSPORT` (za svaki `transport_mode`), `TICKET` i `EVENT`, sa atributima iz poglavlja 2.3, i naći ga kroz `/products` filtriran po tipu.
- [ ] `room_types[]` se čuva i vraća kao niz strukturiranih objekata (poglavlje 2.3a), ne golih naziva; `media[]` stavka sa `category = ROOM` i `room_type_code` ispravno referencira postojeći `room_types[].code`.
- [ ] `room_types[]` stavka bez eksplicitno postavljenog `age_policy[]` vraća sistemski podrazumevani niz (poglavlje 2.3b); stavka sa eksplicitno postavljenim nizom vraća taj niz, ne podrazumevani.
- [ ] Test: uzrast deteta koji pada u kategoriju sa `counts_toward_capacity = false` (npr. beba 0-1) se ne računa protiv `capacity_children` pri M5 proveri kapaciteta sobe (poglavlje 2.3b, veza sa M5 §3.2a).
- [ ] `ProductContentImport` uspešno izvlači kandidate sa test sajta hotela u sve kategorije (`NAME`/`DESCRIPTION`/`AMENITY`/`ROOM_TYPE`/`PHOTO`/`LOCATION`/`SERVICE`), sa `match_confidence` po redu.
- [ ] Nijedna izvučena stavka se ne upisuje u `Product`/`ProductTranslation`/`media` bez `reviewed_by` popunjenog ljudskim nalogom — provereno da AI agent nema pristup `REVIEW_FIELD` prelazu.
- [ ] Odobrena `PHOTO` stavka se upisuje u `media[]` sa `source = AI_IMPORTED`; odobrena `ROOM_TYPE` stavka se upisuje u `attributes.room_types[]` sa ispravnim `code`.
- [ ] `ProductContentImport` sa `origin = M23_RESEARCH` ulazi direktno u `EXTRACTED` (bez `PENDING`), sa `source_article_revision_id` popunjenim na svakom polju; prolazi kroz **potpuno isti** ljudski pregled kao `origin = MANUAL_URL` — nijedno polje se ne upisuje bez `reviewed_by`, bez obzira na poreklo.

---

## 9. Otvoreno za dalje

- Tačna pravila za `PACKAGE` proizvode (paket aranžmani koji uključuju više drugih proizvoda) — odnos prema cenovniku kad se cena paketa razlikuje od zbira pojedinačnih komponenti — definiše se detaljnije kad M3 (Ugovaranje) bude specificiran, pošto to pitanje suštinski pripada cenovnoj logici, ne katalogu.
- Da li treba poseban proces odobrenja (workflow) pre nego što proizvod pređe iz `DRAFT` u `ACTIVE` (npr. da neko drugi pregleda pre objave) — trenutno ide direktno preko dozvole `M2/product/PUBLISH`, bez dodatnog koraka odobrenja.
- **Ograničen kapacitet za `TICKET`/`EVENT`** (npr. koncert sa ograničenim brojem mesta) — isti princip alotmana kao `ACCOMMODATION` već postoji generički u M3 (`ContractPeriod`/`RateLine`), M2 ne treba da menja svoj model zbog toga; potvrditi pri implementaciji M3 dela za ova dva tipa da postojeći model zaista pokriva slučaj bez izmene.
- **Autorska prava nad AI-uvezenim sadržajem** (poglavlje 3.3) — potvrditi sa dobavljačem/pravnikom pre javne objave slika/teksta preuzetih sa sajta hotela; van obima ove specifikacije da definiše tačan pravni mehanizam (napomena u ugovoru, pismena saglasnost...).
- **Automatsko pronalaženje sajta hotela** (bez unosa URL-a) — namerno odloženo iz v1 (poglavlje 3.3) zbog rizika pogrešnog poklapanja; razmotriti kad se pokaže da ručni unos URL-a stvarno usporava tim.
- **Da li "usluge" (`SERVICE`) treba da budu odvojeno polje od `amenities[]`** u `attributes` — trenutno se oba upisuju na isto mesto (poglavlje 3.3, korak 4); razdvojiti ako se pokaže da im treba različit prikaz na sajtu (M8).
- **Cena po uzrasnoj kategoriji** (poglavlje 2.3b) — `age_policy[]` ovde definiše samo kategorizaciju i kapacitet, ne cenu; strukturirana cena po kategoriji (npr. "dete 2-11: 50% cene odrasle osobe", "beba: besplatno") čeka dopunu M3 `RateLine` (M3 poglavlje 8) kad se pokaže tačan oblik koji dobavljači u praksi koriste.
