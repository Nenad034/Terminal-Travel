# Tehnička beleška: integracija provajdera za pretragu smeštaja

**Status:** Analiza/referenca — empirijski nalazi, NE Nivo 2 specifikacija. Nijedan od testiranih provajdera/konektora nije usvojen kao M4 adapter ovim dokumentom — to čeka posebnu odluku vlasnika i dopunu `04-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` pre koda (isti hard rule kao svaki drugi modul, CLAUDE.md).
**Poreklo:** Dostavio vlasnik, 28.8.2026 — testiranje tri MCP konektora protiv istog scenarija; ažurirano istog dana dopunom o TravelgateX/HotelX (poglavlje 5, iz dokumentacije, ne live poziva — vidi napomenu o izvoru na početku tog poglavlja).

Ovaj dokument je nastao testiranjem tri MCP konektora za pretragu smeštaja
(Expedia, Novasol, Booking.com) na istom scenariju: porodica (2 odrasla + 2
deteta), 4★ hotel, blizina ski staze, polupansion, konkretan termin.

Namena dokumenta: preneti AI agentu koji implementira ovakvu pretragu u našoj
aplikaciji **činjenice o ponašanju svakog konektora, konkretne greške na koje
je naišao i na šta treba obratiti pažnju** — ne preporuku "koji da koristi".
Izbor provajdera(a) i arhitektura zavise od odluka tima koji implementira;
ovde su samo empirijski nalazi.

## 1. Zajednički tok pretrage (nezavisno od provajdera)

Korisnik obično unosi zahtev prirodnim jezikom tipa: "smeštaj za porodicu (2
odrasla, 2 deteta X–Y godina) u [destinacija] za [datumi], hotel [kategorija]
blizu [POI], usluga [tip pansiona]".

Koraci koje agent treba da izvede, nezavisno od toga koji se provajder(i)
pozivaju:
1. Izvući strukturirane parametre iz upita.
2. Postaviti razjašnjavajuće pitanje ako nešto ključno nedostaje ili je
   dvosmisleno (vidi 1.1).
3. Pozvati pretragu (jedan ili više provajdera).
4. Po potrebi dopuniti rezultate podacima koje odabrani provajder ne vraća
   (vidi tabelu u sekciji 6).
5. Prikazati korisniku uži izbor sa objašnjenjem zašto svaka opcija odgovara
   zahtevu, i navesti izvore.

### 1.1 Obavezno razjašnjavajuće pitanje: uzrast dece
Ako korisnik navede uzrast dece kao opseg (npr. "2-12 godina"), agent MORA da
pita tačan uzrast svakog deteta pre poziva bilo kog provajdera — cena i
dostupnost soba zavise od tačnih godina, ne od opsega. Ovo je opšte pravilo,
ne specifično za jedan provajder.

## 2. Expedia (`search_hotels`)

### 2.1 Obavezna polja i format
- Jedino obavezno polje je `destination` (string, slobodan tekst).
- Datumi u formatu `YYYY-MM-DD`.
- Preporučeno uvek popuniti `user_location`, `user_locale`,
  `client_device_info` (lokacija KORISNIKA, ne destinacija putovanja).

### 2.2 GREŠKA: kombinacija previše filtera u jednom pozivu ruši poziv
Poziv sa punim setom parametara odjednom (`check_in_date` + `check_out_date`
+ `adult_count` + `children_age_list` + `star_ratings` + `property_types` +
`property_themes` + `query_text` + `sort_type` u istom pozivu) je dosledno
vraćao grešku `"Unknown error"` bez ikakvog detalja o uzroku.

**Kako smo to otkrili i rešili:** binarna pretraga uzroka — pozivati prvo
samo sa `destination`, pa dodavati po jednu grupu parametara dok se greška ne
pojavi ponovo. U našem testu: `destination` sam — radi; + datumi — radi; +
`adult_count`/`children_age_list` — radi; dodavanje ostalih filtera je
sporadično dovodilo do greške. **Praktičan zaključak: ne slati sve parametre
odjednom bez retry-mehanizma.** Implementirati: pokušaj pun upit — ako API
vrati grešku bez detalja, automatski retry sa redukovanim setom (prvo ukloni
"meke" filtere: `property_themes`, `query_text`, `sort_type`, `amenities`;
zadrži `destination`, datume, broj gostiju).

### 2.3 GREŠKA (tiha): većina "filtera" ne filtrira ništa
Sistematski testirano (isti upit, dodavanje po jednog filtera): sledeći
parametri **ne vraćaju grešku, ali i ne menjaju skup rezultata** — API vraća
identičnu listu kao da filter uopšte nije poslat, uključujući objekte koji
očigledno ne zadovoljavaju uslov:

- `star_ratings` — poziv sa `[4]` je i dalje vraćao hotele sa 2.5, 3.0 i 3.5
  zvezdica.
- `property_types`
- `property_themes`
- `amenities`
- `max_nightly_price` — poziv sa `50-120` je vraćao hotele do 599/noć.
- `guest_rating`

Ovo je potvrđeno na tri potpuno različita tipa destinacije (Bad
Kleinkirchheim/planina, Punta Cana/plaža, Maldivi/ostrvo, Budva/mešovito) —
**problem je sistemski, na nivou alata, ne vezan za destinaciju.**

**Na šta obratiti pažnju:** ovo je opasna vrsta greške jer se NE manifestuje
kao exception — kod će "raditi" i vraćati rezultate, ali će tiho ignorisati
zahtevani kriterijum. Ako se ovakav parametar samo prosledi API-ju i rezultat
prikaže korisniku bez provere, korisnik će dobiti pogrešne/neispunjene
rezultate bez ikakvog upozorenja. **Obavezno filtrirati ove kriterijume ručno
na strani aplikacije, nad poljima iz `data` niza u odgovoru
(`star_rating`, `avg_nightly_price`, `guest_rating`), ne osloniti se da API
to radi.**

### 2.4 Parametri koji STVARNO rade
- `check_in_date` / `check_out_date` — utiču na cenu/dostupnost kako se
  očekuje.
- `adult_count` / `children_age_list` — menjaju sastav gostiju, cenu i
  `total_travelers` u odgovoru. Testirano i sa "detetom" starosti 15 godina —
  API to prihvata bez greške/upozorenja i tretira kao regularnog putnika;
  nema validacije da li "dete" treba tretirati kao odraslog.
- `sort_type` (testirano `CHEAPEST`) — stvarno menja redosled i sadržaj
  liste.

### 2.5 `query_text` — radi, ali menja i geografski obuhvat pretrage
Kad je poslat `query_text` (npr. "near ski slopes half board"), rezultat se
promenio u odnosu na baznu listu, ALI su se pojavili i objekti udaljeni
desetinama kilometara od tražene destinacije (u jednom testu čak i objekat
van same zemlje/regiona po intuiciji). Zaključak: ovo polje ne radi kao čist
filter nad već lociranom destinacijom, nego menja/proširuje samu
interpretaciju pretrage. **Ne koristiti `query_text` kao pouzdan filter za
striktne kriterijume (blizina POI, tip pansiona). Ako se koristi, obavezno
naknadno filtrirati rezultate po geografskoj blizini (`geo_location`
lat/lng) prema traženoj destinaciji.**

### 2.6 Validacija koja radi ispravno (dobri, iskoristivi error-i)
- `check_in_date` posle `check_out_date` — jasna greška: *"Validation Error:
  The check_in (...) must be before the check_out (...)."*
- Nepostojeća/besmislena destinacija — jasna greška: *"The location could
  not be resolved... Simplify the location query and retry."* — dobar signal
  da agent pojednostavi upit i pokuša ponovo, ili pita korisnika.

Ove poruke su čitljive i mogu se koristiti direktno u UX toku ili za
automatski retry, bez dodatnog "prevođenja".

### 2.7 Šta API uopšte nema u šemi (nije pitanje filtriranja, nego nepostojanja polja)
Poređenjem sa punim Expedia web filterima (koje korisnik vidi na
expedia.com — cenovni raspon sa histogramom, "Meal plans available"
[Breakfast included/All-inclusive/Dinner/Lunch], Property class,
Neighbourhood, Property amenities, Property type, Property brand,
cancellation/payment opcije, guest rating pragovi), utvrđeno je da:
- Zvezdice, cena, guest rating, property type, amenities **postoje** kao
  parametri u MCP alatu, ali se ignorišu (2.3).
- **Tip pansiona/obroka ("Meal plans available") uopšte ne postoji kao
  parametar** u šemi MCP alata — nije da se ignoriše, fizički ga nema.
  Isto važi za Neighbourhood, Property brand, cancellation/payment opcije.

**Na šta obratiti pažnju:** za tip pansiona kod ovog provajdera ne postoji
programski način da se traži kroz `search_hotels` — jedina opcija je naknadna
provera (web pretraga po nazivu hotela, vidi sekciju 6) ili preusmeravanje
korisnika na Expedia link (`url` polje u odgovoru) gde on ručno postavlja
filtere na sajtu. Nije testirano da li Expedia URL prihvata query parametre
za filtere direktno u linku — proveriti pre oslanjanja na taj pristup.

### 2.8 Format odgovora (relevantna polja)
```json
{
  "occupants": [{"adults": 2, "child_ages": [5, 8], "total_travelers": 4}],
  "data": [
    {
      "hotel_id": "6300113",
      "hotel_name": "Hotel Eschenhof",
      "star_rating": "4.0",
      "guest_rating": "9.4",
      "guest_review_count": 33,
      "avg_nightly_price": 285,
      "total_price": 2254,
      "total_strikeout_price": 2598,
      "currency": "USD",
      "checkin_date": "2027-01-10",
      "checkout_date": "2027-01-17",
      "url": "https://www.expedia.com/.h6300113.Hotel-Information?..."
    }
  ]
}
```

## 3. Novasol (`search-properties`) — kuće/apartmani za odmor

### 3.1 Bitna razlika u tipu proizvoda (proveriti PRE poziva)
Novasol nudi samostalne kuće/apartmane za odmor, ne hotele sa uslugom. U
šemi alata **nema koncepta zvezdica ni tipa pansiona** — samo `reviewScore`
(0–5), broj spavaćih soba/kupatila (`minBedrooms`/`minBathrooms`) i kapacitet
(`sleeps`). **Ako korisnik traži "hotel sa polupansionom", taj kriterijum
kod Novasola ne postoji — nema smisla slati ga kao parametar.** Agent koji
kombinuje provajdere treba prvo da odredi da li korisnik traži hotel-sa-
uslugom ili samostalni smeštaj, pre nego što bira kome da pošalje upit.

### 3.2 Format datuma se razlikuje od Expedije — čest izvor grešaka
Novasol očekuje `startDate` u formatu `dd-MM-yyyy` (npr. `10-01-2027`), za
razliku od Expedia alata koji koristi `yyyy-MM-dd`. **Ako se više provajdera
poziva iz istog toka sa istim internim modelom datuma, obavezna je
konverzija formata po provajderu** — ovo je konkretan, lako propustljiv bug
pri integraciji.

### 3.3 Filteri koje smo testirali i koji rade ispravno
Testirano na destinaciji sa velikim brojem objekata (Istra, ~1900+
oglasa), poređenjem baznog poziva sa filtriranim:
- `minBedrooms: 3` — ukupan broj rezultata pao sa 1930 na 1229, i svi
  vraćeni objekti su zaista imali 3+ spavaće sobe.
- `maxPrice: 800` (EUR, ukupno za ceo boravak, ne po noći) — broj pao sa 1930
  na 106, svi vraćeni objekti ispod te cene.
- `sort: priceAsc` — rezultati stvarno monotono rastu po ceni.
- `features: ["pool"]` — broj rezultata pao sa 1930 na 1464 (stvarna
  promena). Napomena: prvih ~48 "preporučenih" rezultata se poklopilo sa
  baznom listom — najverovatnije zato što ti objekti već imaju bazen, ali
  ovo nije 100% potvrđeno bez ručne provere pojedinačnih oglasa. **Ne uzimati
  zdravo za gotovo da svaki `features` filter menja i redosled/vrh liste —
  proveriti na konkretnom slučaju ako je to bitno.**

### 3.4 `maxPrice`/`minPrice` su za CEO boravak, ne po noći
Polja `minPrice`/`maxPrice` predstavljaju cenu za CELU grupu za ceo boravak,
ne po osobi ni po noći. Ako korisnik da budžet po noći ili po osobi, mora se
konvertovati pre poziva (alat ima `priceType: "per_night"` opciju koja
konvertuje umesto ručnog množenja — koristiti to polje, ne računati ručno u
agentu, da se izbegne duplo množenje sa brojem noćenja).

### 3.5 Transparentno prijavljivanje kad filter ne može da se zadovolji
Kod male destinacije (Bad Kleinkirchheim, gde Novasol ima svega 1 objekat u
ponudi), poziv sa `features: ["sauna","hottubspabath"]` je vratio taj jedini
objekat, ali je odgovor eksplicitno sadržao:
```json
"filtersRelaxed": true,
"relaxedFilters": ["features"]
```
Odgovor time sam kaže "nisam mogao da zadovoljim ovaj filter pa sam ga
privremeno isključio". Isto se desilo kod `minBedrooms: 3` +
`maxPrice: 1000` na istoj maloj destinaciji — vraćeno je 0 rezultata, uz
navod da je pokušano relaksiranje `maxPrice`, ali ni tada nije bilo objekata
sa 3+ sobe (dakle `minBedrooms` je genuinski primenjen čak i kad rezultat
ostane prazan).

**Na šta obratiti pažnju:** ako se implementira UI koji prikazuje rezultate
iz Novasola, `filtersRelaxed`/`relaxedFilters` treba pročitati i prikazati
korisniku (npr. "nismo našli tačno taj uslov, evo najbližih opcija") — ne
ignorisati to polje, jer nosi informaciju koju drugi provajderi (Expedia) uopšte
ne daju.

## 4. Booking.com (`accommodations_search`)

### 4.1 Ima eksplicitan parametar za tip pansiona — jedini od tri testirana
`meal_plan` prima `breakfast_included`, `half_board`, `full_board`,
`all_inclusive`. Ovo je jedino mesto gde je tip pansiona uopšte mogao da se
pošalje kao pravi parametar pretrage (kod Expedije ne postoji u šemi, kod
Novasola nema smisla jer nije hotelski proizvod).

Napomena: `children_ages` je **obavezno** popuniti čim korisnik ima decu —
prema opisu alata, ako uzrast nije dat, alat očekuje da se prvo to pita
korisniku pre poziva (isto pravilo kao u sekciji 1.1, ovde je i eksplicitno
zahtevano od strane samog alata).

### 4.2 Filteri koje smo testirali i koji rade ispravno
- `star_rating: [4]` — bazni poziv (bez filtera) vraćao je mešavinu 3★ i
  4★ objekata. Poziv sa `star_rating: [4]` vratio je **isključivo** 4★
  hotele (10 od 10 proverenih rezultata, svi tačno 4.0).
- `star_rating: [5]` — vratio tačno 2 hotela, oba tačno 5.0 zvezdica.
- `meal_plan: "half_board"` (uz `star_rating:[4]` i `facilities:["SKIING"]`)
  — vratio potpuno drugačiji, uži skup hotela u odnosu na bazni poziv, sa
  primetno višim cenama (logično — polupansion poskupljuje boravak, npr.
  jedan hotel ~406.887 RSD naspram jeftinijih apartmana bez usluge u baznom
  pozivu, ~103.000–207.000 RSD za isti period). Nismo mogli 100% direktno
  potvrditi da svaki pojedinačni vraćeni hotel zaista nudi baš polupansion
  (odgovor ne vraća eksplicitno polje "meal_plan_included" po hotelu) — samo
  da se skup i cena menjaju u očekivanom pravcu. **Preporuka za proveru:
  ako je tačnost tipa pansiona kritična, otvoriti `url` konkretnog hotela ili
  pozvati detaljniji booking endpoint (ako postoji) da se potvrdi pre nego
  što se to prikaže korisniku kao garantovana činjenica.**

### 4.3 Greška je informativna, ne prazna/tiha
Poziv sa `meal_plan: "all_inclusive"` (bez ostalih filtera, za Bad
Kleinkirchheim) je vratio grešku:
```json
{"type":"not_found","message":"No accommodations found for the given search parameters in Booking.com inventory","suggestedAction":"Ask the user to change the search parameters","retryGuidance":"..."}
```
umesto praznog niza ili izmišljenih rezultata. Alat čak eksplicitno upućuje
da se NE ponavlja isti poziv sa istim parametrima, nego se ili pita korisnik
za izmenu, ili se korisniku referira na prethodni rezultat. **Na šta obratiti
pažnju:** ovakav odgovor je signal da treba automatski predložiti olabavljenje
kriterijuma (npr. probati `half_board` umesto `all_inclusive`) pre nego što
se korisniku kaže da ništa nije nađeno.

### 4.4 Facilities enum je eksplicitan i strukturiran, uključujući "SKIING"
Za razliku od Expedia `query_text` pristupa (nepredvidiv, sekcija 2.5),
Booking.com ima `facilities` kao zatvoren enum sa vrednošću `SKIING`
direktno dostupnom, pored `HOT_TUB_JACUZZI`, `SPA_AND_WELLNESS_CENTRE`,
`FAMILY_ROOMS` itd. Alat takođe ima poseban `image_themes` parametar (za
"šta korisnik želi da VIDI na slikama" — vizuelni, ne pretraživački filter) —
**ne mešati `facilities` (tvrdi filter) sa `image_themes` (samo prikaz)**,
šema alata eksplicitno upozorava na ovu razliku.

### 4.5 Cena i valuta
Rezultati su vraćeni u RSD (na osnovu `user_country_code: "rs"`) — valuta
prati parametar korisničke lokacije, ne destinacije. Ako se agregiraju
rezultati sa drugim provajderima (Expedia vraća USD po defaultu), obavezna
je konverzija u zajedničku valutu pre poređenja cena između provajdera.

### 4.6 VAŽNO: `meal_plan` filter sužava kandidate, ali ne garantuje da je usluga uključena u prikazanu cenu
Dodatno testirano pozivom `answer_property_qa_by_ids_v2` (Booking.com alat
koji odgovara na konkretna pitanja o već pronađenim hotelima) sa pitanjem
"da li ovaj hotel nudi polupansion i da li je uključen u prikazanu cenu za
ovaj termin". Odgovor za Kärntnerhof: hotel **nudi** polupansion (doručak +
petostepena večera) kao opciju, ali **da li je uključen u konkretnu prikazanu
cenu zavisi od tipa sobe/promocije i mora se potvrditi u toku rezervacije**.

**Na šta obratiti pažnju:** `meal_plan: half_board` u pretrazi treba tumačiti
kao "prikaži mi hotele koji NUDE tu opciju", ne kao "cena koju vidim već
uključuje tu uslugu". Ako aplikacija korisniku prikazuje cenu iz pretrage kao
konačnu cenu "sa polupansionom", to može biti netačno. Za garantovanu
potvrdu je potrebno ili pozvati QA alat (ili ekvivalentan detaljni
endpoint) po konkretnom hotelu, ili tu nesigurnost eksplicitno naznačiti
korisniku u UI-ju (npr. "usluga dostupna, cena i tačan paket se potvrđuju
prilikom rezervacije").

### 4.7 Gomilanje previše filtera odjednom ne ruši poziv, ali može dati lažno prazan rezultat
Testiran je poziv sa 8 filtera odjednom (`star_rating` + `meal_plan` +
`facilities` sa 3 vrednosti + `minimum_review_score` + `price` opseg +
`accommodation_types` + `cancellation_type` + `number_of_rooms`). Za razliku
od Expedije (gde gomilanje filtera dovodi do generičke greške bez detalja,
vidi 2.2), Booking.com nije pukao — vratio je isti čist `not_found` odgovor
kao i kod pojedinačnog nemogućeg filtera (4.3). **Na šta obratiti pažnju:**
ne može se pouzdano razlikovati "ova kombinacija kriterijuma zaista ne
postoji na tržištu" od "prosto smo postavili previše uslova odjednom i
slučajno presekli sve rezultate" — alat ne pravi tu razliku eksplicitno.
Preporučljivo je da agent, kad dobije `not_found` sa mnogo aktivnih filtera,
programski proba da postepeno ukloni po jedan "meki" filter (npr. prvo
`minimum_review_score`, pa `price`, pa `cancellation_type`) i ponovi poziv,
umesto da odmah zaključi da ništa ne postoji.

### 4.8 `number_of_rooms` > 1 stvarno menja skup i sastav rezultata
Testirano sa `number_of_rooms: 2`, `number_of_adults: 4` (porodica koja bi
tražila 2 sobe za 4 odrasla + 2 dece). Vraćen je **potpuno drugačiji skup
objekata** u odnosu na `number_of_rooms: 1` (uglavnom apartmani/kuće sa
više soba, ne klasične hotelske sobe), a `price.book` u odgovoru odražava
ukupnu cenu za obe sobe zajedno. Filter radi ispravno i treba ga koristiti
kad porodica/grupa realno zahteva više od jedne sobe — ne pokušavati to
simulirati udvostručavanjem `number_of_adults` uz `number_of_rooms: 1`.

## 5. TravelgateX / HotelX API — pravi B2B konektor (za ugovorene dobavljače)

**Važna napomena o izvoru ovih nalaza.** Konektor koji se u listi konektora
pojavljuje kao "TravelgateX Custom" (`travelgate.mcp.kapa.ai`) **NIJE live
API konekcija** — to je kapa.ai-hostovan MCP server koji radi isključivo
pretragu/Q&A nad TravelgateX-ovom dokumentacijom (`docs.travelgate.com`).
Nema pristup pravom API-ju, ne može ništa da pretraži niti rezerviše u
stvarnom inventaru, i rate-limitovan je (40 poziva/sat, 200/dan po
korisniku). Nalazi u ovoj sekciji su **činjenice iz dokumentacije**, ne
rezultati testiranja live poziva (za razliku od sekcija 2-4, gde je svaki
nalaz potvrđen stvarnim pozivom). Kad se implementira prava integracija sa
TravelgateX-om (ili bilo kojim sličnim B2B agregatorom), ovi nalazi treba da
budu polazna tačka, ali svaki mora biti **ponovo potvrđen live pozivom** po
metodologiji iz sekcije 8, isto kao što je urađeno za Expediju/Novasol/
Booking.com.

### 5.1 Osnovna arhitektura i terminologija
HotelX je GraphQL API na jedinstvenom endpoint-u `https://api.travelgate.com`.
Ključni pojmovi koje agent mora da razlikuje:
- **Seller** — konekcija/nalog preko kog se pristupa jednom ili više
  **Supplier**-a (dobavljača, svaki sa svojim supplier code-om).
- **Buyer** / **Client** — strana koja poziva API; poziv nosi "traffic tag"
  (npr. `client_b2b` vs `client_b2c`) koji utiče na to koje cene/uslove
  dobavljač vraća — isti upit sa različitim traffic tag-om može vratiti
  drugačije cene.
- **Access** — kredencijali i konfiguracija za konkretnu Seller konekciju
  (API key, dozvoljeni supplier-i, limiti).
- **Context** — parametri okruženja poziva (jezik, valuta, market) koji se
  prosleđuju uz svaki upit i mogu uticati na dostupnost i cenu.
- **FastX** — Travelgate-ov standardizovani sistem šifri za hotele, odeljke
  (boards/pansioni) i tipove soba, koji omogućava da se rezultati više
  različitih dobavljača uporede/agregiraju pod istim kodom. Alternativa je
  rad direktno sa nativnim šiframa pojedinačnog dobavljača (native codes).
  **Za implementaciju sa više dobavljača ovo znači da mapiranje polja mora
  biti trosmerno**: polja iz sopstvene aplikacije → FastX standardizovani
  kod → nativni kod svakog dobavljača — ne dvosmerno kao kod pojedinačnog
  OTA konektora.

### 5.2 Obavezan redosled: Search → Quote → Book (ne sme se preskočiti)
Za razliku od Expedia/Booking.com/Novasol konektora testiranih u ovoj
sesiji (koji vraćaju cenu direktno u rezultatu pretrage, spremnu za
prikaz), HotelX zahteva **tročlani tok**:
1. **Search** — vraća opcije sa okvirnom cenom/dostupnošću.
2. **Quote** — obavezan korak pre rezervacije; ponovo validira cenu,
   uslove otkazivanja i dostupnost za tačno izabranu opciju. Cena iz Search
   koraka **nije garantovana** i može se razlikovati od Quote cene.
3. **Book** — zahteva da struktura soba/putnika (rooms/paxes) tačno
   odgovara onome što je poslato u originalnom Search pozivu; neusklađena
   struktura (npr. drugačiji raspored dece po sobama) izaziva grešku ili
   pogrešnu rezervaciju.

**Na šta obratiti pažnju:** agent koji implementira ovakav tok ne sme
prikazati Search cenu korisniku kao konačnu, niti preskočiti Quote radi
brzine — to je arhitekturno drugačije od jednostavnijih OTA konektora i
mora se predvideti u UI-ju (npr. "cena se potvrđuje u sledećem koraku").

Postoji i alternativni **one-shot tok** (`oneStepQuote`/`oneStepBook`) za
buyer-e koji unapred imaju kеširanu dostupnost (dobijenu preko ChannelX
Push API-ja) — tada se Quote i Book mogu spojiti, ali to zahteva posebnu
infrastrukturu (primanje i keširanje push podataka od dobavljača), nije
podrazumevani slučaj.

### 5.3 Boards i Categories nisu pravi filteri u Search pozivu
Isti obrazac koji je potvrđen kod Booking.com (4.6 — `meal_plan` znači
"nudi opciju", ne "garantovano u ceni") ovde je dokumentovan eksplicitno u
samoj arhitekturi: **Boards** (pansioni/meal plan) i **Categories**
(zvezdice) su odvojeni "content" upiti (metapodaci o hotelu), **ne
parametri kojima se live Search direktno filtrira**. Prisustvo pansiona u
Boards content upitu **ne garantuje** da će ta opcija biti dostupna u
konkretnom live Search pozivu za dati datum/hotel.

### 5.4 Kritičan nalaz: nemapirani board se TIHO gubi iz rezultata
Ovo je ozbiljniji slučaj od bilo čega pronađenog kod OTA konektora u
sekcijama 2-4. Ako tekst pansiona koji dobavljač vrati **ne može da se
mapira** na standardizovani FastX kod, ta opcija se **potpuno briše iz
dostupnosti** — bez greške, bez upozorenja, opcija prosto ne postoji u
odgovoru. Ovo je gori slučaj od Expedijinog "tihog ignorisanja filtera"
(2.3), jer se tamo bar cela lista rezultata i dalje vraća (samo
nefiltrirana) — ovde stvarno dostupna soba/cena **nestaje iz odgovora bez
traga**. **Na šta obratiti pažnju:** ako se implementira sistem sa
mapiranjem nativnih kodova na standardizovani sloj (bilo FastX bilo
sopstveni), agent/tim mora imati monitoring nemapiranih vrednosti (npr.
log kad dobavljač vrati tekst pansiona koji ne postoji u mapnoj tabeli),
inače se gubi prodaja bez ikakvog vidljivog simptoma.

### 5.5 Kontrola veličine rezultata: `optionsQuota` i `businessRulesType`
- `optionsQuota` — maksimalan broj opcija po board-u (opseg 1-300,
  podrazumevano 300). Bitno za kontrolu veličine odgovora i latencije kod
  hotela sa mnogo tipova soba/cena.
- `businessRulesType` — `CHEAPER_AMOUNT` (vraća samo najjeftiniju opciju po
  grupi) vs `ROOM_TYPE` (grupiše po tipu sobe). Menja **koji** se podskup
  opcija vraća, ne samo broj — bira se prema tome da li agent treba da
  prikaže "najjeftiniju opciju po kategoriji" ili "sve tipove soba".

### 5.6 DeltaPrice — tolerancija odstupanja cene između Quote i Book
API podržava mehanizam tolerancije (`amount`/`percent`/`applyBoth`) koji
definiše koliko cena sme da odstupi između Quote i Book koraka a da se
rezervacija ipak izvrši (umesto da automatski propadne na svako sitno
odstupanje cene, uobičajeno kod dinamičkog određivanja cena). **Na šta
obratiti pažnju:** ovo je obrazac vredan kopiranja i u sopstvenoj
implementaciji Book toka — bez eksplicitne tolerancije, ili se rezervacije
nepotrebno odbijaju zbog sitnih fluktuacija cene, ili se (gore) prihvataju
rezervacije sa neproverenim velikim odstupanjem cene.

### 5.7 Look-to-Book (L2B) odnos — komercijalno ograničenje, ne tehnički bag
Za razliku od svih dosad testiranih konektora, B2B ugovoreni pristup nosi
i **poslovno/ugovorno** ograničenje koje nema tehnički simptom u samom
odgovoru: dobavljači prate odnos broja pretraga (Search) prema broju
stvarnih rezervacija (Book) po buyer-u. Prekomerno pretraživanje bez
konverzije u rezervacije može dovesti do throttle-ovanja ili blokiranja
naloga od strane dobavljača (Travelgate nudi alat "Traffic Optimizer" za
upravljanje ovim). **Na šta obratiti pažnju:** ovo direktno utiče na
arhitekturu keširanja — agent/aplikacija ne sme naivno pozivati Search pri
svakoj izmeni filtera na strani korisnika (kao što je uobičajeno kod
običnog web pretraživanja); potrebno je keširati/debounce-ovati pretrage na
strani aplikacije, što nije bila briga ni kod jednog OTA konektora
testiranog u sekcijama 2-4 (tamo je ograničenje samo rate-limit, ne
poslovni odnos search:book).

### 5.8 HTTP zaglavlja i timeout semantika
- `Authorization: Apikey xxx` za standardne pozive; `Bearer <JWT>` za
  administrativne/monitoring pozive (JWT se dobija preko
  `query { admin { jwt } }`).
- `Accept-Encoding: gzip`, `Connection: keep-alive` — preporučeno za
  performanse pri velikom broju poziva.
- Opciono `TGX-Content-Type: graphqlx/json` — prebacuje odgovor iz
  GraphQL u REST-sličan format, preporučeno kod odgovora sa >5000 opcija
  (GraphQL serializacija postaje neefikasna na tim količinama).
- Opciono `TGX-Operation-Timeout` (ms) — **mora biti postavljen veći** od
  unutrašnjeg `timeout` polja specifičnog za dobavljača u samom upitu;
  ako je spoljni timeout manji ili jednak unutrašnjem, poziv se prekida
  pre nego što unutrašnji mehanizam dobavljača uopšte stigne da odgovori
  (uključujući i sa greškom), što daje pogrešnu dijagnostiku ("dobavljač
  ne radi" umesto "naš timeout je prekratak").

## 6. Zbirna tabela: šta nedostaje kod kog provajdera

| Kriterijum | Expedia | Novasol | Booking.com |
|---|---|---|---|
| Zvezdice — filter stvarno radi | ✗ (ignoriše se) | N/A (nema koncept) | ✓ potvrđeno |
| Cena (min/max) — filter stvarno radi | ✗ (ignoriše se) | ✓ potvrđeno | nije posebno testirano u ovoj sesiji |
| Tip pansiona kao parametar pretrage | ✗ ne postoji u šemi | N/A (nema koncept) | ✓ postoji (`meal_plan`) |
| Blizina POI (npr. ski staza) kao pravi filter | ✗ (`query_text` nepredvidiv) | delimično (`features` lista specifičnih sadržaja, ne geo-blizina) | ✓ (`facilities: SKIING` kao enum) |
| Transparentno javljanje kad filter nije zadovoljen | ✗ (tiho ignoriše) | ✓ (`filtersRelaxed`) | ✓ (jasna `not_found` greška sa uputstvom) |
| Format datuma | `YYYY-MM-DD` | `dd-MM-yyyy` | `YYYY-MM-DD` |

Za svaki kriterijum obeležen ✗ kod izabranog provajdera, agent mora ili (a)
filtrirati naknadno na strani aplikacije nad podacima iz odgovora, ili (b)
dopuniti spoljnom web pretragom (naziv hotela + traženi kriterijum, npr.
"Halbpension" / "half board" / "ski-in ski-out"), uz fetch zvaničnog sajta
hotela pošto direktno scrape-ovanje booking.com stranica često ne uspeva
(robots.txt blokira taj pristup). TravelgateX/HotelX (poglavlje 5) nije
uključen u ovu tabelu — nalazi su iz dokumentacije, ne iz uporedivog live
testa kao ostala tri reda.

## 7. Opšta pravila za implementaciju (nezavisno od provajdera)

1. **Nikad ne pretpostaviti da filter radi samo zato što poziv nije vratio
   grešku.** Kod Expedije smo to direktno demonstrirali — tiho ignorisanje
   filtera je najopasniji tip greške jer prolazi neprimećeno.
2. **Testirati svaki filter poređenjem baznog poziva (bez filtera) sa
   filtriranim pozivom**, na destinaciji sa dovoljno velikim brojem
   rezultata da se promena uopšte primeti (mala destinacija sa 1-2 objekta
   ne otkriva ništa o ponašanju filtera).
3. **Ne slati sve moguće parametre u jednom pozivu bez retry logike** — bar
   kod Expedije je to dokazano dovodilo do gubitka celog poziva (2.2).
4. **Čuvati i iskoristiti strukturirane poruke o grešci** (validacija
   datuma, nerešiva destinacija, `not_found` sa `suggestedAction`) — one su
   generalno pouzdanije od bilo kakvog nagađanja o tome zašto pretraga nije
   uspela.
5. **Konvertovati format datuma i valutu po provajderu** pre poziva/pre
   agregacije rezultata — potvrđena razlika između Expedije (`YYYY-MM-DD`,
   USD) i Novasola (`dd-MM-yyyy`, EUR); Booking.com prati `user_country_code`
   za valutu.
6. **Uzrast dece uvek tražiti kao tačan broj, nikad opseg**, pre bilo kog
   poziva — ovo pravilo utiče na sve testirane provajdere podjednako.
7. **Razlikovati "provajder nema taj koncept" od "provajder ima parametar ali
   ga ignoriše"** — prvo je razlog da se uopšte ne šalje taj kriterijum tom
   provajderu (npr. tip pansiona Novasolu), drugo je razlog da se filtrira
   naknadno na strani aplikacije (npr. zvezdice Expediji).

## 8. Metodologija za testiranje BUDUĆIH konektora (letovi, izleti, ...)

Sekcije 2–4 su nalazi specifični za tri konektora za smeštaj (potvrđeni live
pozivom); poglavlje 5 (TravelgateX/HotelX) je iz dokumentacije i sam sebe
označava kao nešto što treba ponovo potvrditi po ovoj istoj metodologiji pre
oslanjanja. Ono što sledi je **postupak** koji se pokazao efikasnim u ovoj
sesiji i koji treba ponoviti za svaki novi turistički konektor (npr.
konektor za letove, Viator za izlete/aktivnosti, i svaki budući). Cilj je da
se ova provera radi sistematski i unapred, a ne da se greške otkrivaju tek
kad korisnik prijavi pogrešan rezultat u produkciji.

**Korak 1 — Bazni poziv.** Pozvati alat sa minimalnim obaveznim poljima, bez
ijednog "mekog" filtera, na destinaciji/upitu sa dovoljno velikim brojem
rezultata (ne testirati filtere na upitu koji ionako vraća 1-2 rezultata —
tada se ne vidi da li filter uopšte nešto radi).

**Korak 2 — Filter-po-filter poređenje.** Za svaki filter iz šeme alata
(ne samo one za koje se pretpostavlja da su bitni), pozvati alat sa istim
ostalim parametrima + taj jedan filter, i uporediti skup/broj rezultata sa
baznim pozivom:
- Isti skup/isti broj — filter se **sumnjivo ignoriše**, potvrditi dodatnim
  testom pre zaključka (npr. probati ekstremnu vrednost filtera, kao što smo
  radili sa `max_nightly_price: 150` na destinaciji gde su sve cene više).
- Drugačiji skup, ali vraćeni rezultati i dalje krše uslov — filter je
  **delimično primenjen** (bar nešto se menja, ali ne pouzdano) — ne
  oslanjati se na njega bez dodatne provere na strani aplikacije.
- Drugačiji skup, svi rezultati zadovoljavaju uslov — filter **radi
  ispravno**, bezbedno se oslanjati na njega.

**Korak 3 — Kombinacija više filtera odjednom.** Nezavisno od toga da li
pojedinačni filteri rade, testirati poziv sa 5+ filtera istovremeno. Ovo je
otkrilo grešku kod Expedije (potpuni pad poziva) koja se NE vidi kad se
filteri testiraju samo pojedinačno.

**Korak 4 — Rubni/nemogući slučajevi.** Namerno poslati kombinaciju koja
realno nema rezultata (npr. `all_inclusive` u destinaciji gde to ne postoji)
i pogledati oblik greške: da li je to prazan niz, generička greška, ili
strukturirana poruka sa predlogom? Ovo direktno diktira kako agent treba da
reaguje u kodu (auto-retry sa olabavljenim uslovima vs. samo prikaz poruke
korisniku).

**Korak 5 — Formati i jedinice.** Eksplicitno proveriti: format datuma,
da li su cene po noći ili ukupno za boravak, u kojoj valuti, i da li se
valuta/jezik menjaju na osnovu parametra korisnika ili destinacije. Ovo je
kod Novasola i Booking.com bilo drugačije nego kod Expedije (vidi 3.2, 4.5)
i lako je izvor tihih bagova kad se rezultati više provajdera prikazuju
zajedno.

**Korak 6 — Provera "meke" tačnosti podataka koje filter navodno garantuje.**
Ako alat ima pomoćni/detaljni endpoint za pojedinačan proizvod (kao
`answer_property_qa_by_ids_v2` kod Booking.com), iskoristiti ga da se
potvrdi da filter iz pretrage stvarno znači ono što agent pretpostavlja da
znači (vidi 4.6 — filter je tačan za "nudi opciju", ne nužno za "uključeno u
prikazanu cenu"). Ova razlika je suptilna i lako se previdi bez ovog koraka.

**Korak 7 — Dokumentovati, ne pretpostavljati.** Svaki nalaz iz koraka 1-6
zapisati konkretno (naziv parametra, tačan poziv, tačan rezultat), po uzoru
na sekcije 2-4 ovog dokumenta — ne kao uopštenu ocenu "filteri uglavnom
rade" ili "ovaj konektor je pouzdaniji", nego kao proverljivu činjenicu na
koju se agent kasnije može osloniti bez ponovnog testiranja.

## 9. Test-slučaj za regresiono testiranje

- Destinacija: Bad Kleinkirchheim, Austrija
- Datumi: 2027-01-10 – 2027-01-17 (7 noćenja)
- Gosti: 2 odrasla + 2 deteta (5 i 8 godina)
- Kategorija: 4 zvezdice
- Dodatni kriterijumi: blizina ski staze, usluga polupansion

Ovaj upit i njegovi rezultati (dokumentovani u sekcijama 2–4 iznad) mogu
poslužiti kao regresioni test pri implementaciji ili promeni verzije bilo
kog od tri konektora testirana live pozivom (Expedia/Novasol/Booking.com).
TravelgateX/HotelX (poglavlje 5) nema regresioni test dok se prvi live
poziv stvarno ne izvrši.
