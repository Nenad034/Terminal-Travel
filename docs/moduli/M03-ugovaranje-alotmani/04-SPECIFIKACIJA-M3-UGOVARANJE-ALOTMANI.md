# Specifikacija modula M3 — Ugovaranje i alotmani

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M3) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.42 — **napomena (poglavlje 2.10h): M2 uvodi `ProductSupplierLink`, usklađivanje sa ovim poglavljem otvoreno** (11.9.2026, posledica vlasnikovog zahteva nad M2 ekranom proizvoda — tab "Cenovnik"). M2 od v1.29 dozvoljava da jedan `Product` nosi više `Contract` zapisa; ovo poglavlje (2.10) rešava "isti hotel od više dobavljača" na nivou M5 poređenja ponuda (`SupplierPriority`/`HotelSourcePreference`), pisano bez te pretpostavke. **Čisto specifikaciona napomena, bez izmene modela ovog poglavlja u ovom prolazu** — vidi §2.10h za tačno pitanje koje čeka odluku.

**Verzija:** 1.41 — **tip sobe se bira iz šifarnika, ne kuca** (10.9.2026, implementacija §2.11m, koje je od v1.32 stajalo kao specifikacija bez koda). Merenje koje je pokrenulo prolaz: uvoz je upisivao doslovan tekst iz dobavljačevog dokumenta u `ContractPeriod.room_type`, a šifra sobe u katalogu je automatski generisan broj — poklapanja nije bilo nikad, pa je M5 pri prodaji uzimao kapacitet 99 i provera kapaciteta se tiše isključivala (zamka 7.14). Nov endpoint `GET /contracting/contracts/:id/room-types`, birač u formi za period, automatsko poklapanje pri uvozu (`room-type-match.ts` — šifra → naziv → deo naziva, i to samo kad pogađa tačno jednu sobu), ručno poklapanje na ekranu pregleda (`POST .../tipovi-soba`, migracija `20260910190000`), i ograda koja odbija primenu dok tip nije poklopljen ili izričito potvrđen. Izmereno: 16 + 9 novih jediničnih testova i 3 e2e nad sveže napravljenom bazom; uvoz „STANDARD" sada upisuje `3584729001`.

**Verzija:** 1.40 — **šta znači „1. dete“** (10.9.2026, vlasnikovo pitanje: _„u jednom će biti info da dete u pratnji dve odrasle osobe ima popust 100%, u drugom da isključivo 1. dete ima, u trećem samo 2. ili 3.“_). Dopuna poglavlja **2.4a**: `ContractPeriod.child_counting_basis` (`ALL_CHILDREN` — podrazumevano — ili `PER_CATEGORY`) i `child_order` (`OLDEST_FIRST` — podrazumevano — ili `YOUNGEST_FIRST`), oba potvrđena od vlasnika istog dana. Sam OBLIK pravila („samo 1. dete“, „samo 2. i 3.“, „uz dve odrasle osobe“) je već bio pokriven poljima `occupant_index` i `min_adults_present` — nedostajalo je jedino **po čemu se redna oznaka dodeljuje**. Ispravlja i stvaran kvar: do sada je redni broj dolazio iz redosleda kojim su godine dece UKUCANE, pa je ista porodica dobijala različitu cenu za „9, 5“ i „5, 9“. Uz to i provera koja se prijavljuje: kad bi obrnut redosled dao drugu ukupnu cenu, panel to kaže uz cenovnik. Kategorije osoba ostaju svojstvo cenovnika, a raspored po krevetima svojstvo sobe (M2 poglavlje 2.3g) — dve odluke iz istog ulaza, uzrasta gosta. Nije implementirano; četiri nove stavke u izlaznom kriterijumu (poglavlje 7).

**Verzija:** 1.39 — **uvoz i verzije spojeni: jedan put do cenovnika** (10.9.2026, vlasnikova odluka „zameniti stari ekran"). Novo poglavlje **4.2.10**. Uvoz više ne upisuje red po red nego gradi **predlog** koji ide kroz isti `predlog`/`primeni` put kao ručna izmena i izmena rečima; `source_import_id` se konačno popunjava.

**Predaja rada je ovo procenila kao „čisto povezivanje, bez novih odluka". Procena je bila netačna** — provera koda pre pisanja našla je tri prepreke: (1) uvezene cene su bile **nevidljive** za tok verzija, jer snimak čita samo periode sa sezonom a uvoz je pravio period bez nje; (2) u mreži su se videle samo kao „izuzetak", ne kao ćelija; (3) put verzija bi **tiho pojeo dečje cene i krevetac**, jer ih `writeCell` nije primao. Sve tri su rešene: predlog i `writeCell` od sada nose `crib_fee_per_night` i `age_pricing`, uzrasna cena ulazi u poređenje, a sezona se **izvodi iz datuma** (tačno poklapanje; nova sezona nastaje tek pri primeni potvrđene razlike).

**Izmereno kroz produkcione endpoint-e nad pravom bazom:** cenovnik sa 3 reda → 1 ugovor, **2 nove sezone izvedene iz datuma**, 3 razlike; posle potvrde period **nosi sezonu**, cene 8950/10900/12500, krevetac 500 i dečja cena 50% **sačuvani**, verzija 1 sa popunjenim `source_import_id`.

**Nedovršeno i zapisano:** ponovni uvoz istog dokumenta još uvek duplira redove, jer je `occupancy` slobodan tekst modela koji varira između prolaza (izmereno četiri različite formulacije za isti red). Detalji i predlog rešenja u §4.2.10.

**Verzija:** 1.38 — **Excel put izmeren nad devet stvarnih cenovnika** (10.9.2026, pošto je vlasnik dopunio `Primeri cenovnika/`). Novo poglavlje **4.2.9**. Očekivana ušteda (prazni redovi) **ne postoji** — 0%. Umesto nje nađena dva kvara koja se drugačije ne bi videla.

**(1) Više od polovine ćelija je stizalo modelu kao `[object Object]`** — `String(v)` nad ExcelJS ćelijom koja je objekat. Pokvareno u 7 od 9 fajlova, od 3,2% do **52%**, i to baš `richText` (naziv hotela sa kategorijom, crvena upozorenja o tržištima) i `formula` sa `result` (**izračunate cene**). Ispravljeno u M15 v1.51 — isti kvar je imao i AI chat u panelu. Vraćeno 50.174 od 50.177 ćelija.

**(2) Granica veličine merila je fajl na disku, a Excel se pakuje.** `014_Solvex_Offer_Summer_2025.xlsx`: 1 MB na disku, **1,8 miliona znakova**, 946.445 tokena, ~4,35 € samo za ulaz — prolazio bi kroz granicu od 25 MB bez reči. Nije cenovnik nego katalog: 17 listova, 966 hotela. Nova granica **`MAX_ZNAKOVA_TEKSTA` = 100.000** nad izvučenim tekstom, izvedena iz merenja (najveći cenovnik jednog hotela: 19.721 znak), odbija se **pre** poziva modelu.

**Verzija:** 1.37 — **model opisuje kombinaciju jednom, kod je umnožava po periodima** (10.9.2026, na pitanje vlasnika o potrošnji tokena). Novo poglavlje **4.2.8**. Izmereno nad stvarnim cenovnicima iz `Primeri cenovnika/`: **72% manje izlaznih tokena, 66% niža cena, tri puta brže, isti rezultat do poslednjeg polja.**

**Usput nađen i ispravljen kvar koji se drugačije ne bi video:** stara šema je na cenovniku sa 117 redova trošila ceo `max_tokens` na prepisivanje istih naziva, bila prekinuta na pola i vraćala **nula redova uz punu naplatu** — uz poruku „AI nije prepoznao nijedan red", koja je tačan simptom i pogrešan uzrok. Uvoz je radio na malim cenovnicima a tiho padao na većim. Prekid zbog dužine se od sada prijavljuje kao prekid, a `max_tokens` je podignut na 16.000.

**Dve pretpostavke o štednji su merenjem pale, i to je zapisano da se ne ponove:** keširanje ulaza ne vredi (91% cene je izlaz), a snižavanje `effort` štedi 4%. Jeftiniji model je odbačen jer je na stvarnom cenovniku vratio 20 od 36 redova — `HEAVY` iz §4.2.7 ostaje.

**Verzija:** 1.36 — **uvoz cenovnika prima fajl, ne samo nalepljen tekst** (10.9.2026, vlasnikova odluka: _„čuvamo na lokalnom računaru za sada"_). Novo poglavlje **4.2.7**. Odluka o skladištu je bila jedina preostala prepreka iz §4.2.6, i njenim padom padaju obe nepokrivene stavke odjednom.

**Nijedna nova biblioteka.** `exceljs`, `mammoth`, `pdf-parse` i `multer` su već u projektu, a M15 već ima `ExtractFileService` koji pretvara PDF/Word/Excel/HTML/CSV u tekst — M3 ga **koristi**, ne pravi svoj. Ograda je izričita zato što je „dva modula rade isti posao" tačno greška zbog koje ovaj repozitorijum postoji (`docs/analize/22-ANALIZA-PRIMETRAVEL-NALAZI.md`).

**OCR se ne uvodi — tvrdnja iz §4.2.1 je bila tačna kad je pisana, a više nije.** Skenirani PDF i sliku model čita direktno (`document`/`image` blok). Kod prvo pokuša izvlačenje teksta; prazan ili presudno kratak rezultat prebacuje fajl modelu. Jedna odluka pokriva i sken i nečitljiv PDF, bez pitanja „da li je ovo skenirano" na koje bi se odgovaralo pogađanjem.

**Jači model samo za ovaj posao:** `claude-opus-5`, tier `HEAVY`, dok svi ostali pozivi ostaju na `LIGHT`. Obrazloženje i cena su u §4.2.7; potrošnja se knjiži kroz M18 kao i svaki drugi poziv i troši isti EUR budžet.

**Verzija:** 1.35 — **izmena cenovnika rečima napravljena** (9.9.2026, korak 7 od sedam iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md` — **poslednji**). `POST /contracting/contracts/:id/pricelist-versions/recima` i kartica „Izmena rečima“ na `/ugovori/[id]/cenovnik`. Bez novog zapisa u bazi: rečenica postaje **isti predlog** koji pravi i uvoz dokumenta, pa ide kroz već napravljen tok verzija (§2.11l). Primena ide **istim** endpoint-om (`/primeni`) — jedan put do upisa, jedno mesto na kom nastaje verzija.

**Podela posla je ograda, ne stil** (§4.8.1 korak 3). Model prevodi rečenicu u **nameru** — na šta se odnosi i kakva je (procenat, iznos, nova vrednost, gašenje). **Nove iznose računa kod** (`pricelist/instruction-intents.ts`). Šema alata namerno **nema polje za izračunatu cenu**, pa model ne može ni da je pošalje: ograda koja postoji samo kao rečenica u uputstvu se pre ili kasnije prekrši, ograda koja ne postoji u strukturi se ne može prekršiti.

**Četiri ograde iz §4.8.2, i gde su sprovedene.** (1) _AI ne upisuje ništa_ — servis nema nijedan `create`/`update`; endpoint predloga traži `VIEW`, a upis `EDIT`, pa ograda iz §4.4 (agent radi pravima korisnika) važi sama od sebe. (2) _Svaka izmena se odobrava posebno_ — kvačica po razlici, podrazumevano nijedna označena; „prihvati sve“ postoji, ali odobravanje je svesna radnja, ne propuštanje. (3) _Rečenica se čuva uz rezultat_ — `instruction_text` na `PricelistVersion`, i potez se u auditu vodi kao **AI potez** (`actorType: AI_AGENT`). (4) _Gašenje, ne brisanje_ — preko istog puta kao §2.4c.

**Redosled namera je redosled odluke.** „Sve gore 5 %, a studio na 90 €“ daje studio 90,00, ne 94,50 — kasnija namera pobeđuje raniju nad istom stavkom. Cena koja bi ispala nula ili negativna se **ne primenjuje nego prijavljuje**: popust od 120 % je skoro sigurno pogrešno pročitana rečenica.

**Namerna granica, zapisana a ne prećutana.** Ovaj tok primenjuje **cene** (procenat, iznos, nova vrednost, gašenje). Doplatu koju rečenica uvodi ili ukida **prepoznaje i prikazuje**, ali je ne upisuje — menja se na svom ekranu (§2.11k), iz istog razloga kao u v1.33. Izmene van cenovnika (rokovi otkazivanja, akcije/rani buking, kapacitet) izlaze kao **prijavljene stavke sa uputstvom na kom se ekranu rade** — nikad prećutane i nikad pretvorene u izmenu cene. Vlasnikova rečenica iz §4.8.1 ima četiri dela: dva se primenjuju, dva se prijavljuju, i to je vidljivo na ekranu.

**Nejasna rečenica se pita, ne pogađa** (§4.4): kad model vrati pitanje a nijednu nameru, predlog se ne pravi. **Provera:** 1444 unit testa (40 novih — 22 nad čistim obračunom, 18 nad ogradama oko modela) + dva nova testa u `test/m3-pricelist-versions.e2e-spec.ts`. Sam poziv modelu se u testu namerno **ne pokreće**: odgovor jezičkog modela nije determinisan, pa bi test koji na njemu počiva bio ili spor i skup ili lažno zelen — mere se ograde koje stoje **ispred** modela i koje su jednake na svakoj instalaciji.

**Verzija:** 1.34 — **kalendar cena i raspoloživosti napravljen** (9.9.2026, korak 6 od sedam iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`). **Bez novog zapisa u bazi**, kako §2.11o i traži: `GET /contracting/contracts/:id/pricelist-calendar` spaja cenovnik i postojeću mrežu kapaciteta (§2.8). Ekran: kartica „Kalendar“ na `/ugovori/[id]/cenovnik`.

**Cena se ne računa nanovo.** Obračun za sastav gostiju (osnovna popunjenost, doplata po uzrastu, krevetac) već postoji kao čista funkcija koju koristi prodaja (`computeRoomBaseCost`), pa je kalendar koristi doslovno. Druga formula za isti posao bi se pre ili kasnije razišla sa prvom, a razlika bi se videla tek na računu.

**Rupa u cenovniku se imenuje, ne ćuti.** Dan bez cene nosi razlog: `VAN_PERIODA`, `NEMA_CENE`, `DAN_BEZ_CENE` (kombinacija postoji, ali nijedan red ne pokriva taj dan u nedelji — §2.11d), `PROZOR_PRODAJE_ZATVOREN` (§2.11e) i `NEMA_CENE_ZA_UZRAST` (§2.4a: cena se ne pretpostavlja ni ovde, isto kao u prodaji). Uz to ide zbirno upozorenje po kombinaciji („4 od 6 dana nema cenu“), da se rupa vidi bez prebrojavanja po ekranu. Prazan mesec bi inače izgledao isto bez obzira da li je cenovnik nepotpun ili je ekran pokvaren.

**Tri odluke koje se lako previde.** (1) Cena je za **jednu noć koja počinje tog dana** — dan odjave nije noć. (2) Kad je osnova `*_PER_STAY`, noćna cena ne postoji: prikazuje se iznos za boravak uz oznaku `CENA_ZA_BORAVAK`, da se ne čita kao noćna. (3) Dan koji nije dan prijave (turnus, §2.11d) i dalje **nosi cenu**, ali je označen sa `dolazakMoguc: false` — bez toga kalendar obećava nešto što prodaja odbija. Dan sa stop-sale takođe zadržava cenu: cena i odluka o prodaji su dve različite stvari (§2.8c).

Raspon je ograničen na **92 dana**, isto kao mreža kapaciteta — kalendar se gleda po mesecima. Više perioda istog tipa sobe na isti dan se **sabira** (gost ne bira iz kog perioda mu soba dolazi), a stop-sale u bilo kom od njih pobeđuje otvorenu prodaju u drugom.

**Izmereno kroz endpoint koji panel zove, nad sveže napravljenom bazom:** cenovnik sa radnim redom 100,00 i vikend redom 140,00 daje u istom mesecu ponedeljak **100,00**, petak i subotu **140,00**, nedelju **100,00**; dan van perioda vraća `VAN_PERIODA` uz upozorenje „4 od 6 dana“; dan sa stop-sale nosi `cena: 14000`, `saleStatus: STOP`, `slobodno: 0` i razlog zatvaranja. **Provera:** 1404 unit testa (19 novih) + `test/m3-pricelist-calendar.e2e-spec.ts` (4 testa).

**Verzija:** 1.33 — **verzije cenovnika napravljene** (9.9.2026, korak 5 od sedam iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`). Nov zapis `PricelistVersion` (migracija `20260909201500`) i čista logika poređenja `pricelist/pricelist-diff.ts`. Verzija nosi **snimak celog cenovnika**, ne samo razlike — bez snimka se razlika prema prošloj verziji ne može izračunati kasnije, jer se žive stavke u međuvremenu gase i zamenjuju (§2.4c), pa „kako je cenovnik izgledao tada" prestaje da bude upit nad tabelama.

**Dva ulaza u isti tok, i razlika je namerna.** _Ručna izmena:_ čovek menja ćeliju u mreži, izmena se primenjuje odmah (kao i do sada), a verzija se snima posle — ekran „Verzije" pokazuje **samo razlike** prema poslednjoj potvrđenoj verziji i jedno dugme koje ih zapisuje. _Predlog spolja_ (§4.2 uvoz dokumenta, §4.8 izmena rečima): predlagač je mašina, pa se **ništa ne upisuje pre potvrde** — `POST .../pricelist-versions/predlog` vraća samo razlike, `POST .../pricelist-versions/primeni` upisuje **isključivo potvrđene** ključeve. Nepotvrđena razlika ostaje na staroj vrednosti i vraća se u odgovoru kao `odbijeno`, da se ne izgubi bez traga.

**Ključ stavke** je ono što čini poređenje čitljivim: tip sobe + sezona + pansion + popunjenost + osnova cene + dani u nedelji, **bez cene**. Zato promena cene izlazi kao jedan red „100,00 → 110,00", a ne kao „jedna nestala + jedna nova". Doplate se porede po **imenu i dometu**, ne po `id`-u zapisa (nov dokument donosi nove zapise iste doplate).

**Dve namerne granice ovog prolaza.** (1) Verzija bez ijedne razlike se **odbija** — istorija ne sme postati spisak istovetnih snimaka. (2) Doplate i popusti se **prikazuju** u razlikama i ulaze u snimak, ali se kroz predlog cena **ne menjaju** — predlog nema polja kojima bi se doplata opisala (osnova, uzrast, obaveznošć, način plaćanja); menjaju se na svom ekranu (§2.11k), pa se verzija snima posle. Potvrda doplate kroz `primeni` vraća 400 sa tim objašnjenjem, ne ćuti.

**Izmereno kroz iste endpoint-e koje panel zove, nad pravom bazom:** verzija 1 snima cenovnik od 100,00; posle izmene ćelije `GET .../pricelist-versions/razlike` vraća **tačno jednu** razliku sa porukom „100,00 → 110,00"; ponovljena potvrda bez ijedne izmene pada na 400; predlog sa dve izmene od kojih je potvrđena jedna ostavlja drugu sobu na staroj ceni (12000 i 20000 u mreži posle primene); potvrđeno gašenje uklanja cenu iz mreže, a verzija 1 je i dalje čita. **Provera:** 30 novih jediničnih testova + `test/m3-pricelist-versions.e2e-spec.ts` (4 testa) nad sveže napravljenom bazom. Ekran: kartica „Verzije" na `/ugovori/[id]/cenovnik`.

**Verzija:** 1.32 — **dani u nedelji i turnusi napravljeni** (9.9.2026, korak 4 od sedam iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`). Model: `RateLine.valid_weekdays`, `ContractPeriod.arrival_weekdays`/`departure_weekdays`/`allowed_stay_nights` (migracija `20260909185617`), svuda prazan niz = bez ograničenja. Ekran cenovnika bira dane **kao tagove** (vlasnikova odluka), red nosi oznaku dana, a period dobija kvačice za dane prijave/odjave i polje za dozvoljene dužine boravka.

**Jedno odstupanje od teksta §2.11d, sa razlogom.** Spec je tražio da se odbije i red koji ostavlja **nepokriven dan**. Tako napisano, unos je nemoguć: prvi red „ned–čet" bi bio odbijen jer petak i subota još ne postoje, pa se drugi red nikad ne bi ni stigao dodati. Zato se **preklapanje odbija** (dva reda ne smeju dati dve cene za isti datum), a **nepokriven dan se prijavljuje kao upozorenje** uz odgovor i vidi se na ekranu; posledica ostaje stvarna — za taj datum nema cene i boravak se ne može ponuditi.

**Cena boravka se sastavlja PO NOĆIMA.** Vikend cena je poseban red iste kombinacije, pa boravak subota→subota prelazi preko dva reda: svaka noć se naplaćuje po redu koji pokriva njen dan. Cena „za ceo boravak" (`*_PER_STAY`) se naplaćuje **jednom**, po redu koji pokriva prvu noć — inače bi boravak preko vikenda bio plaćen dvaput. Pretraga zbog toga vraća **jednu ponudu po kombinaciji** (pansion × popunjenost), ne po cenovnom redu. Stavka ponude i dalje nosi **jedan** `rate_line_id` (onaj koji pokriva prvu noć) — razlaganje cene po noćima na ekranu je zabeleženo kao otvoreno. **Izmereno kroz `POST /sales/quotes` nad pravom bazom:** radna cena 100,00 i vikend 140,00 daju za subota→subota **780,00** (5 × 100 + 2 × 140). Turnus: isti boravak sredom pada sa porukom „Prijava je moguća samo: subota". **Provera:** 1355 unit testova (21 nov) + četvrti test u `test/m5-pricelist-scope.e2e-spec.ts`.

**Verzija:** 1.31 — **subagentska provizija se obračunava po stavci** (9.9.2026, implementacija, bez izmene modela; rupa 4.3 iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`, poslednja od četiri). `SubagentCommissionOverride` i čista logika `subagent-commission.ts` postojali su od v1.27 sa 18 jediničnih testova i **nijednim pozivaocem**. Provizija se u M5 do sada primenjivala kao **jedan procenat nad celom ponudom** (`QuotesService.create`, M7 §5), pa se „na boravišnoj taksi nema provizije" nije moglo izraziti. Sada se za svaku stavku ponude traži izuzetak po dometu (stavka → doplata → period → sezona → ugovor), uz pravilo da izuzetak vezan za **konkretnog** subagenta pobeđuje isti domet koji važi za sve. **„Bez provizije" ostaje različito od 0 %** i u ishodu i u prikazu. API stavka nema ugovorni cenovnik, pa ide podrazumevana stopa; kupac koji nije subagent i dalje dobija M6 loyalty popust. **Izmereno kroz `POST /sales/quotes` nad pravom bazom:** u istoj ponudi soba 100,00 → **90,00** (provizija 10 %), stavka označena „bez provizije" ostaje **100,00**. **Provera:** 1334 unit testa (4 nova) + treći test u `test/m5-pricelist-scope.e2e-spec.ts`.

**Verzija:** 1.30 — **prozor rezervisanja na ceni se poštuje u prodaji** (9.9.2026, implementacija, bez izmene modela; rupa 4.4 iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`, poslednja od tri istog obrasca). `RateLine.booking_from`/`booking_to` (§2.11e) je postojao od v1.27 i upisivao se, ali ga **ni pretraga ni sastavljanje ponude nisu čitali** — cena čiji je prozor prošao i dalje bi se prodala. Sada: pretraga preskače istekle cene (i za pojedinačan proizvod i za sastojak paketa), a ponuda razlikuje dva slučaja — **izričito izabrana** istekla cena se **odbija** sa `BOOKING_WINDOW_CLOSED` (agent je izabrao baš tu cenu iz pretrage, pa mu se mora reći da više ne važi), dok kod cene koju bira sistem istekle **ispadaju iz izbora** i uzima se prva koja važi; kad su sve istekle, odbija se sa istim razlogom, ne sa „nema cenovnika". Koristi se ista funkcija `bookingWindowOpen` kao za prozor prijave perioda (§2.3e) — dve različite provere na dva nivoa, jedan kod. **Provera:** 3 nova jedinična testa + treći slučaj u `test/m5-pricelist-scope.e2e-spec.ts` (istekla cena kroz `POST /sales/quotes` vraća 400 sa `BOOKING_WINDOW_CLOSED`).

**Verzija:** 1.29 — **marža po pojedinačnoj stavci se konačno primenjuje na cenu** (9.9.2026, implementacija, bez izmene modela; rupa 4.2 iz `docs/analize/46-PREDAJA-RADA-CENOVNIK.md`). v1.27 je dodao `M3_RATE_LINE` i `M3_ANCILLARY_SERVICE` u `MarkupScopeType` i stavio ih na vrh kaskade, ali **nijedan pozivalac nije prosleđivao** stavku — izuzetak se kroz ekran cenovnika upisivao i nikad nije stigao do cene. Ispravljena sva tri mesta koja razrešavaju maržu (sastavljanje ponude i dva mesta u pretrazi); u pretrazi paketa je razrešenje pomereno **unutar** petlje po cenovnim stavkama, jer je do sada tražilo jedno pravilo po periodu i time brisalo razliku između stavki istog perioda. `M3_ANCILLARY_SERVICE` dobija svog razrešivača (`resolveForAncillary`): doplata sa sopstvenim izuzetkom koristi njega, doplata bez njega i dalje **nasleđuje** maržu matične stavke (M5 §6.7a) — namerno **bez** kaskade, jer bi kaskada tiho zamenila nasleđenu maržu pravilom ugovora. **Izmereno kroz `POST /sales/quotes` nad pravom bazom:** ista nabavna cena 100,00 daje **120,00** po ugovornoj marži 20 % i **117,00** za stavku sa izuzetkom 12 % + 5,00 (procenat i iznos se sabiraju). **Provera:** 1327 unit testova (6 novih) + drugi test u `test/m5-pricelist-scope.e2e-spec.ts`.

**Verzija:** 1.28 — **domet doplate se primenjuje i u prodaji** (9.9.2026, implementacija, bez izmene modela). v1.27 je doplati dao domet (§2.11k), ali ga je do sada čitao samo ekran cenovnika: M5 je pri prodaji uzimao isključivo doplate vezane za jedan `ContractPeriod`, pa doplata sa dometom „ceo ugovor" ili „sezona" (`contract_period_id = null`) **nikad nije stigla do prodavca**. Provera dometa je izdvojena u `pricelist/surcharge-scope.ts` (`vaziPoDometu`, `vaziPoUzrastu`, `vaziZaBoravak`) i sada je **isti kod** koristi i cenovnik i prodaja (M5 §6.7a) — pravila se ne mogu razići. Uz to zatvorena tiha greška §2.4c: ugašena (ispravljena) doplata je ulazila u prodajni spisak zajedno sa svojom zamenom. **Uzrasna doplata se ne povlači automatski** ni kad je obavezna, jer `BookingItem` ne zna godine putnika — vidi §2.11j. **Provera:** 10 novih jediničnih testova (ukupno 1321) + nov e2e nad svežom bazom.

**Verzija:** 1.27 — **cenovnik postaje mreža: sezona, dani u nedelji i redosled obračuna** (9.9.2026, vlasnikov nalaz nad ekranom za unos cena: _„Previše zbrkano, nedostaju polja… na osnovu toka treba osmisliti logičan i brz ručni unos"_). Uzrok nije bio model nego **jedinica unosa**: `ContractPeriod` je jedan datumski opseg za jedan tip sobe, pa hotel sa 5 soba i 6 sezona traži 30 zapisa i 30 poseta ekranu. Provera nad **58 stvarnih cenovnika** iz `Primeri cenovnika/` (Aycon PDF mreža, Plava Laguna PDF spisak, Solvex Excel) pokazuje da nijedan dobavljač tako ne piše cenovnik — svuda su **tipovi soba redovi, sezone kolone**. Novo poglavlje **2.11**: nov zapis `Season` (imenovana sezona sa **više** datumskih opsega — Aycon sezona 1 je 01.04–31.05 _i_ 01.10–31.10); `price_basis` dobija `PER_PERSON_PER_STAY`/`PER_ROOM_PER_STAY` (Plava Laguna doslovno nosi `Rate Base = STAY`, a doplate te četiri osnove imaju od v1.13 — razlika je bila nenamerna); **dani u nedelji kao tagovi** na cenovnom redu i dani dolaska/odlaska na periodu (turnusi), uz proveru da je svaki dan pokriven tačno jednom; **`booking_from`/`booking_to` na svakoj cenovnoj stavci** (vlasnikov zahtev — do sada samo na `PricelistOffer`); **provizija hotela po periodu** kroz scope obrazac kao `MarkupRule`, jer je `Contract.commission_percentage` jedan po ugovoru a vlasnik potvrđuje 10 % u jednom periodu i 7 % u drugom; **redosled obračuna u pet koraka** — popust → provizija hotela → marža → provizija subagenta (vlasnikova odluka, zatvara talas-2 stavku o interakciji `commission_model` sa `MarkupRule`); popust po osobi se računa **od ulazne hotelske cene**; marža i subagentska provizija dobijaju domet do **pojedinačne stavke** (marža već ume procenat _i_ iznos istovremeno, nedostajao je samo domet); **boravišna taksa prelazi iz opisnog `TouristTaxInfo` u `AncillaryService`** — jedina prepravka u celoj dopuni, jer opisni zapis ne može da opiše ni jedan pročitan cenovnik (Aycon ima tri uzrasna stepena), a ono što se plaća u hotelu se prikazuje ali **ne ulazi u fakturisanje**; doplata dobija domet i `applies_from`/`applies_to`; **`PricelistVersion`** — nova verzija ne briše staru, AI poredi sa prethodnom i čovek potvrđuje **samo razlike**; tip sobe se bira iz M2 liste umesto da se kuca. Novo poglavlje **4.8** — **izmena cenovnika rečima**: drugi ulaz u isti tok (ceo nov cenovnik ide kroz 4.2, sitna izmena kroz 4.8), `PROPOSE_THEN_APPROVE`, četiri ograde od kojih je najvažnija da se **rečenica koja je izmenu tražila čuva uz rezultat**. Kapacitet se namerno **ne prikazuje u cenovniku** (vlasnikova odluka — ide po sopstvenim datumima); cena i kapacitet se sreću samo u kalendaru iz **2.11o**. Mockup: `04-MOCKUP-UNOS-CENOVNIKA-MREZA.html`. Ekrani: M17 §6d. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.26 — **AI uvoz cenovnika dobija kod i ekran** (9.9.2026, na zahtev vlasnika: _„ne vidim gde se cene unose ručno odnosno uz pomoć AI agenta"_). Poglavlje 4.2 je od v1.7 stajalo kao specifikacija bez implementacije — uvoz je nastajao u statusu `PROCESSING` i tu ostajao. Novo poglavlje **4.2.6**: prepreka „nema odluke o AI provajderu" više ne postoji (M15 ima radni Anthropic klijent), ali skladište fajlova i dalje ne postoji, pa prvi prolaz uvozi **nalepljen tekst** umesto fajla — dobavljači cenovnike najčešće šalju mejlom. `PricelistImport` dobija `source_text` (tačno jedno od njega i `source_file_url`), nov format `PASTED_TEXT`, i nov status **`FAILED`** sa `failure_reason` — postojeći `REJECTED` znači „čovek je odbio", a neuspela ekstrakcija je nešto treće. Model radi **samo čitanje tabele iz teksta**, i to kroz alat sa zadatom šemom; poklapanje hotela (4.2.3), upis u `ContractPeriod`/`RateLine` (4.2.4) i profil dobavljača (4.2.5) ostaju **deterministički kod**. Namerno nepokriveno i zabeleženo: PDF/Excel učitavanje i OCR (čekaju odluku o skladištu) i `structure_signature`. Nov agent `PRICELIST_IMPORT_AGENT` (M15 §4). Ekran: M17 §6c.

**Verzija:** 1.25 — **cenovna stavka se konačno može ispraviti i ugasiti** (9.9.2026, posle vlasnikovog pitanja gde se cene unose ručno). Sve četiri cenovne stavke (`RateLine`, `CancellationRule`, `PricelistOffer`, `AncillaryService`) pisale su se endpoint-om koji **uvek kreira nov red** — bez `PATCH` i bez `DELETE`. Pogrešno ukucana cena se nije mogla povući, a pretraga od **svake** cenovne linije pravi zasebnu ponudu, pa je pogrešna cena ostajala prodajna uporedo sa ispravnom. Novo poglavlje **2.4c**: ispravka je **gašenje stare i upis nove**, nikad prepisivanje vrednosti (vlasnikova odluka — cena je finansijski podatak i posle izmene mora ostati odgovor na pitanje po kojoj je ceni nešto prodato). Isti obrazac koji `ContractPeriod` koristi od v1.18: `status` + `deactivated_by`/`deactivated_at`, plus `replaces_id` koji novu stavku veže za staru. **Pretraga i prodaja od sada gledaju isključivo `ACTIVE`** — to je jedina izmena koja stvarno zaustavlja pogrešnu cenu. Gašenje ne traži proveru „da li je nešto prodato": stavka rezervacije nosi svoju cenovnu liniju kao snimak (M5 §6), pa se prošlost ne dira. Ispravka je jedan poziv u jednoj transakciji, da prekid između dva ne ostavi period bez ijedne važeće cene.

**Verzija:** 1.24 — **liste dobavljača i ugovora dobijaju filtere, i to „kroz proizvode"** (9.9.2026, vlasnikov zahtev nad ekranima M17 §6a). `GET /suppliers` do sada nije primao **nijedan** filter — ni pretragu po imenu; dodati su `q`, `type`, `country` (sedište firme) i, zajedno sa `GET /contracts`, četiri filtera koja gađaju **vezane proizvode**: `destinationCountry`, `destinationCity`, `productName`, `productType` (sme da se ponovi). **Zašto kroz proizvode:** dobavljač u bazi ima samo svoju državu, a nema ni mesto ni hotel — filter „Grčka" nad spiskom dobavljača mora da znači „ko nam nešto prodaje u Grčkoj", jer je to jedino pitanje koje se u prodaji postavlja (vlasnikova odluka na izričito pitanje). Do dobavljačevih proizvoda vode **dva puta i oba se broje**: kroz ugovor (`Contract.products`) i direktno (`Supplier.manualProducts`, ručno uneta usluga bez ugovora — M2 §2.1); da se gledao samo prvi, dobavljač sa isključivo ručnim uslugama bi tiho nestao sa spiska čim se postavi bilo koji filter. Zajednički gradilac uslova: `apps/api/src/modules/m3-ugovaranje-alotmani/product-scope.ts`. Nepoznata vrednost `productType` se **ćuti** umesto da obori poziv na 400 — ovo su filteri liste, pa pogrešan parametar u adresi ne sme da ostavi korisnika pred porukom o grešci umesto pred spiskom.

**Verzija:** 1.23 — **multiselect tipova soba nad kapacitetom + istorija izmena** (9.9.2026, dva vlasnikova zahteva nad ekranom M17 §4b). **(1)** Dimenzija „Šta" iz 2.8a dobija treću vrednost — **izabrani tipovi soba** (`contractPeriodIds`), između dosadašnjeg „jedan tip sobe" i „ceo objekat"; slučaj „zatvori dvokrevetne i trokrevetne, jednokrevetne ostavi" se do sada radio u dva poteza ili grubo, preko celog objekta. Sve tri radnje (stop-sale, `capacity_override`, blokada) primaju skup, a jedan poziv i dalje ostavlja **jedan** audit zapis sa spiskom pogođenih perioda u `context`. **(2)** Novo poglavlje **2.8g** — istorija izmena kapaciteta. Nova tabela se ne uvodi: svaka radnja već upisuje `AuditLogEntry` sa akterom i vremenom, dodaje se samo čitanje, kroz nov `GET /capacity/history` pod **`M3/capacity/VIEW`** (postojeći `GET /iam/audit-log` traži `M1/audit-log/VIEW`, koju Sales Manager i prodajni agent nemaju — bili bi bez uvida u sopstven posao; vlasnikova odluka 9.9.2026). Ekran: M17 v2.70.

**Verzija:** 1.22 — **mreža kapaciteta dobija filtere po destinaciji, hotelu i vrsti proizvoda** (9.9.2026, vlasnikov zahtev nad ekranom M17 §4b). Destinacija i hotel/proizvod su od v1.15 stajali u opisu `/capacity/grid` kao filteri, ali u kodu nisu postojali — `CapacityGridQueryDto` je primao samo `contractId`/`supplierId`/`roomType`/`allotmentMode`; ovaj prolaz zatvara tu razliku između dokumenta i koda. **Vrsta proizvoda (`productType`) je nov filter** — čita se sa `Product.type` objekta vezanog za ugovor (`Product.sourceContractId`), prima više vrednosti odjednom, i vraća se na svakom redu mreže (`productType`) da panel može da prikaže po čemu je red filtriran. Filteri nad proizvodom se rešavaju **pre** upita nad periodima (jedan upit nad `Product` daje skup `contractId` vrednosti), pa period bez vezanog proizvoda ispada iz rezultata čim se bilo koji od tri filtera postavi — što je tačno, jer o njemu ne znamo ni destinaciju ni naziv. **Provera:** vidi M17 v2.69.

**Verzija:** 1.21 — **implementacija poglavlja 2.8c (provera kapaciteta po danu) i 2.3e (prozor prijave)** (8.9.2026). Zatvorena stavka izlaznog kriterijuma „Konkurentnost po danu", koja je od v1.18 stajala kao izričito zabeležen poznat nedostatak: mreža je PRIKAZIVALA stop-sale i blokade, ali ih `reserve()` pri potvrdi rezervacije nije poštovao. Migracija `m3_booking_window_and_day_counter_v120` (`contract_periods.booking_from`/`booking_to`, `capacity_days.units_reserved`). Nov `day-capacity.ts`: provera i brava u jednoj SQL naredbi po noći, sve noći ili nijedna, sa tri razdvojena razloga odbijanja (`SALE_STOPPED` / `CAPACITY_BLOCKED` / `NO_CAPACITY`) i četvrtim pre njih (`BOOKING_WINDOW_CLOSED`). **Odstupanje od specifikacije, zabeleženo a ne prećutano:** 2.8c je predviđao rešenje bez dnevnog brojača, što u stvarnom M5 toku ne radi (između rezervacije i upisa stavke stoji HTTP poziv provajderu, koji se ne sme držati u DB transakciji) — puno obrazloženje i šta od prvobitnog pravila ostaje na snazi: **novo poglavlje 2.8f**. Prikaz i dalje RAČUNA prodato iz rezervacija; brojač je brava, ne izvor istine, a razilaženje hvata provera 2.8e. **Provera:** 7 novih e2e testova nad pravom bazom i 9 novih unit testova; 1182 unit testa, M3 i M5 e2e suite prolaze; `tsc` čist za `apps/api`.

**Verzija:** 1.20 — **kapacitet važi za rezervacije napravljene od…do** (8.9.2026, vlasnikov nalaz: _„zaboravili smo jednu važnu stvar da kapacitet može da vredi za rezervacije od...do"_). Novo poglavlje **2.3e**: `ContractPeriod` dobija `booking_from`/`booking_to` — do sad je znao kada gost **boravi**, ali ne i kada rezervacija sme da **nastane**, pa bi nudio kontingent koji je istekao. Tri posledice koje nisu očigledne: pravilo preklapanja iz 2.3b se **proširuje** (isti boravak sme dvaput ako se prozori prijave ne seku — inače bi sistem odbijao potpuno ispravan unos „10 soba za prijave do 31.3., 5 posle"); tranše se **ne sabiraju** (to je isti fizički kontingent iskazan dvaput, ne 15 soba), pa se koristi tačno jedan period — onaj čiji prozor obuhvata datum prijave; a prodato se ne deli po tranšama, zbog čega pad kontingenta posle isteka prozora normalno proizvodi **minus** (2.8c). Raspoloživost time dobija nov ulaz — datum prijave: pri prodaji uvek današnji, na mreži pomerljiv filterom, uz obavezan ispis na koji datum prijave se prikaz odnosi. Peti razlog odbijanja rezervacije: `BOOKING_WINDOW_CLOSED` (M5 v2.30). Potvrđeno na uzoru: u PrimeTravel čarobnjaku „Kreiraj Kapacitet" polje „Rezervacije od…do" stoji **prvo**, iznad perioda boravka. Prateće izmene: M17 §4b (redosled polja i filter), dok. 44 §12. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.19 — **isti hotel iz više izvora, redosled prodaje, i tri dopune AI podrške** (8.9.2026, na osnovu razgovora sa vlasnikom). Potvrđeno je da se **isti objekat nabavlja od više dobavljača istovremeno**, i da pored ugovora postoje API konekcije koje same povlače raspoloživost, dok se kod nas beleže prodati kapaciteti. Novo poglavlje **2.9** uvodi tri vrste izvora (naš ugovor / API / na upit) i zabranu njihovog mešanja: raspoloživost sa API-ja se **nikad** ne upisuje kao naš kapacitet, formula `kapacitet − prodato` za takav red **ne važi** (njihov broj je već umanjen za naše prodaje — oduzimanje bi bilo dvostruko), zbir po hotelu se računa isključivo preko naših ugovora, a naša odluka da ne prodajemo tuđi inventar vodi se kao zaseban zapis `SourceSaleRestriction` („naša zabrana", nikad „zatvoreno"). Uparivanje objekta i tipa sobe je preduslov celog prikaza i nikad se ne radi automatski po sličnosti naziva (model u M4 §3.3). Novo poglavlje **2.10** upisuje vlasnikovu odluku o redosledu prodaje — **osnovni filter je najniža prodajna (ne nabavna) cena**, unutar istog mapiranog tipa sobe, uz `SupplierPriority` koji odlučuje samo kod izjednačenih cena i `HotelSourcePreference` kao izuzetak po hotelu sa obaveznim, agentu vidljivim razlogom; time je **odbačen** raniji predlog ovog dokumenta da fiksni zakup ide prvi, a njegova neprodaja se rešava cenom i upozorenjem, ne skrivenim redosledom. Slabije sobe po nižoj ceni su **poseban tip sobe**, ne isti tip jeftinije (2.9g) — inače bi pravilo najniže cene sistematski prodavalo samo njih. Dopune AI podrške: **4.5** predlog obima povrata pred rok, uvek sa brojevima i sa izričitom napomenom kad uporednog podatka nema; **4.6** predlog izmene iz mejla dobavljača (razrađuje raniju belešku 4.4.3; sadržaj mejla je podatak a nikad instrukcija; blokirano dok M22 ne dovuče poštu); **4.7** dnevni pregled „šta se promenilo od juče". Poglavlje **2.8e** uvodi dnevni kontrolni presek `units_sold` protiv zbira po danima (razilaženje je već viđeno 8.9.2026 na mock podacima) koji javlja i **ne** ispravlja sam. Dve nove dozvole, devet novih endpoint-a, devet stavki izlaznog kriterijuma. Prateće izmene u istom prolazu: M4 §3.3 (mapiranje), M17 §4b (hotel-first ekran), M15 §4 (dve akcije), M18 §2.1 (signal `CAPACITY_COUNTER_DRIFT`), M2 §2.3e (razlika u kvalitetu je nov tip sobe), dok. 44 §11, dok. 27. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.18 — **implementacija poglavlja 2.3d i 2.8** (8.9.2026, isti dan kad su i specificirana). Migracije `m3_contract_period_status_v116` (`ContractPeriod.status`/`deactivated_by`/`deactivated_at`) i `m3_capacity_day_stop_sale_blocks_v115` (`capacity_days`, `capacity_blocks`, tri nova enuma). `PATCH`/`DELETE` na periodu (do sad nisu postojali) sa ponovnom proverom preklapanja, gašenjem umesto brisanja kad period ima rezervacije, i dozvoljenim smanjenjem ispod prodatog uz `confirmOversold` + `capacity_oversold` događaj. Nov `CapacityService`/`CapacityController` (`/contracting/capacity/*`): mreža po danima (prodato se RAČUNA iz `BookingItem` preko `RateLine`, nigde se ne upisuje), stop-sale sa dve dimenzije obima, dnevni `capacity_override`, blokade sa obaveznim rokom i samo-oslobađanjem. Tri nove dozvole u seed-u (`capacity/VIEW` — Vlasnik/Direktor/Sales Manager/Prodajni agent, `capacity/BLOCK` — + Sales Manager, `capacity/CLOSE_SALE` — Vlasnik/Direktor, dalje pojedinačno po korisniku). Ekran: M17 §4b. **Provera:** 24 nova unit testa (10 period + 14 kapacitet), 1165 backend testova prolazi, `tsc` čist za `apps/api` i `apps/panel`, ESLint bez grešaka; ekran viđen u pravom browseru nad mock podacima (`seedM3CapacityGridMock`), blokada uneta kroz formu potvrđena u bazi. **Poznat nedostatak, namerno neprikriven:** `reserve()` još proverava kapacitet po periodu, ne po danu — mreža prikazuje stop-sale i blokade, ali ih M5 pri potvrdi rezervacije još ne poštuje (izlazni kriterijum, stavka „Konkurentnost po danu").

**Verzija:** 1.17 — **AI agent koji uređuje kapacitete na ljudski zahtev** (8.9.2026, na zahtev vlasnika, novo poglavlje 4.4). Ne agent koji sam odlučuje šta da zatvori, nego onaj kome se kaže ("zatvori Splendid, sve sobe, 12–15.7.") i koji jednu rečenicu prevede u tačne dnevne zapise — posao u kom čovek greši jer unos ima dve dimenzije obima. Čitanje je `AUTONOMOUS`, sve tri izmene (`capacity.stop_sale`/`block`/`override`) su `PROPOSE_THEN_APPROVE`, a potvrdu daje isti čovek koji je tražio. Šest obaveznih ograda, od kojih tri najvažnije: agent **nema sopstvene dozvole** nego radi pravima korisnika (ko nema `CLOSE_SALE` ne može ni preko agenta), pregled pre izvršenja je **prebrojan** a ne opisan, i prekoračenje traži **drugu, izričitu potvrdu** uz broj gostiju koji ostaju bez pokrića. Nejasan zahtev se pita, nikad ne pogađa; jedan zahtev je jedna transakcija; trag nosi i agenta i čoveka. Predlog iz mejla dobavljača (§4.4.3) zabeležen ali van prvog prolaza — M22 još ne dovlači poštu. Registar akcija u M15 §4 i pregled u dok. 32 dopunjeni u istom prolazu. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.16 — **izmena i gašenje ugovornog perioda** (novo poglavlje 2.3d) i **prekoračenje kao negativan broj** (8.9.2026, isti dan kao v1.15). Otkriveno na vlasnikovo pitanje gde se kapacitet definiše: kapacitet JESTE imao formu za unos, ali period se nije mogao ni izmeniti ni obrisati — `PATCH`/`DELETE` nikad nisu postojali, iako dozvola `M3/contract-period/EDIT` stoji u poglavlju 5 od prve verzije. Dodati oba, uz ponovnu proveru preklapanja pri izmeni datuma/tipa sobe i gašenje (`INACTIVE`) umesto brisanja kad period ima rezervacije. **Smanjenje kapaciteta ispod već prodatog se ne odbija** (vlasnikova odluka — u praksi se dešava) nego prolazi uz upozorenje, audit zapis i `capacity_oversold` događaj, a stanje se od tada prikazuje kao **negativan broj** (vlasnikov zahtev: "prikazati sa minusom ispred") — poglavlje 2.8c razdvaja `razlika` (prikaz, sme biti negativna) od `za_prodaju` (odluka o prodaji, nikad negativna). Postojeće rezervacije se nikad ne otkazuju automatski. Tri nove stavke izlaznog kriterijuma. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.15 — **kapacitet po danu, zatvaranje prodaje i blokade** (8.9.2026, na zahtev vlasnika, novo poglavlje 2.8). Do ove verzije M3 nije znao stanje kapaciteta na konkretan datum — samo jedan zbir po sezoni. Uvedena tri autorska zapisa: `CapacityDay` (odstupanje kapaciteta + `sale_status` po danu, lenjo materijalizovan), `CapacityBlock` (držanje za nepotvrđenu grupu, sa **obaveznim** rokom koji se sam gasi) i masovni unos stop-sale po dve dimenzije obima (jedan tip sobe ili ceo objekat × jedan datum, raspon ili ceo period). **Prodato se i dalje nigde ne upisuje po danu** — računa se iz M5. Stop-sale je namerno zaseban status, ne kapacitet spušten na nulu (kod `FIXED_LEASE` kapacitet je plaćen i obaveza ostaje). Provera kapaciteta pri rezervaciji se pomera sa perioda na dan (2.8c), `ContractPeriod.units_sold` ostaje samo za poglavlja 4.1/4.3. Tri nove dozvole (`capacity/VIEW`, `capacity/CLOSE_SALE` — namerno i pojedinačna dodela po korisniku, `capacity/BLOCK`), šest novih endpoint-a, pet novih stavki izlaznog kriterijuma. Time je zatvorena i otvorena stavka "dobavljač jednostrano suspenduje kapacitet" iz poglavlja 8. Analiza i obrazloženje: `docs/analize/44-PREDLOG-MREZA-KAPACITETA.md`; ekran koji ovo prikazuje: M17 spec, M7 dobija dodelu kapaciteta subagentu. **Čisto specifikaciona dopuna, bez koda u ovom prolazu.**

**Verzija:** 1.14 — Straničenje na `GET /contracting/contracts` i `GET /contracting/suppliers` (8.9.2026, dok. 27 nastavak nalaza 2.2 iz dok. 39) — oba rastu sa svakim novim ugovorom/dobavljačem. Oba sad vraćaju `{ data, total, page, limit, pageCount, hasMore }`. Dobavljači su, za razliku od ostalih ovim prolazom ispravljenih lista, korišćeni na dva načina: `/dobavljaci` je pravi browse ekran (dobija `Pagination`), dok šest drugih mesta (forma za nov ugovor, filter liste rezervacija M5, chat "novi razgovor" M19, API posrednik za autocomplete, mapa imena na `/ugovori`) koristi listu kao IZVOR ZA PADAJUĆU LISTU — ta mesta eksplicitno traže `?limit=200` (tvrd plafon, ne "sve bez granice"), jer bi dobavljač nevidljiv u padajućoj listi bio gori kvar (ne može se izabrati) od browse ekrana bez kraja liste. **Provera:** novi testovi u `contracts.service.spec.ts`/`suppliers.service.spec.ts`, `tsc --noEmit` čist za oba app-a, puna jest suita prolazi, `m3-exit-criteria.e2e-spec.ts` (9/9) i `m19-exit-criteria.e2e-spec.ts` i dalje prolaze (obe samo proveravaju HTTP status na ovim rutama, ne oblik odgovora).

**Verzija:** 1.13 — **`AncillaryService` proširen na doplate I popuste, sa punom osnovom obračuna** (3.9.2026, vlasnikova dopuna uz M5 §6.7: _„Doplate i popusti mogu da budu po osobi i danu, sobi i danu, osobi i periodu, sobi i periodu (kada je po sobi treba izdefinisati za koliki ukupan broj osoba, koliki je max odraslih i max dece i do koliko godina deca). Takođe se mogu platiti u agenciji ili na licu mesta (ako je na licu mesta to jasno treba da piše u ugovoru i na vaučeru i taj iznos ne ulazi u ukupnu cenu aranžmana u TT-u). Takođe može biti obavezna ili opciona."_). Četiri izmene poglavlja 2.6: (1) nov `kind` — ista struktura nosi i **doplatu i popust**, jer se u cenovnicima javljaju u istom obliku (popust za treću osobu je doplata sa suprotnim znakom); (2) `unit` zamenjen sa `price_basis` koji izražava **par** (osoba/soba × dan/period) — stari enum je mogao da kaže „po osobi" ili „po danu", ali ne „po osobi i danu"; (3) kad je osnova **po sobi**, nova polja `covers_persons`/`max_adults`/`max_children`/`child_max_age` (bez njih se cena po sobi ne može proveriti prema stvarnom sastavu gostiju); (4) nov `payable` — `AGENCY` ili `ON_SITE`, gde `ON_SITE` iznos **ne ulazi u ukupnu cenu aranžmana**, ali mora biti odštampan u ugovoru sa klijentom (M20) i na vaučeru (M5 §6). Prodaja ovih stavki kroz rezervaciju je M5 §6.7a — time se zatvara ranija napomena „namerno van obima ovde" iz poglavlja 2.6.

**Verzija:** 1.12 — "Talas 1" dopuna na osnovu analize 55 novih primera cenovnika/ugovora više dobavljača (31.8.2026, vlasnik dostavio u `Primeri cenovnika/`; hoteli i tour-operatori iz CG/HR/AT/CY, uključujući Olympic Travel, Aycon portfolio, Plava Laguna, Solvex, Ananti, Heritage Grand Perast, Dionysos). Rešava 6 tačaka iz poglavlja 8 (v1.11) plus nove nalaze koje ta analiza otkriva, po prioritetu koji je vlasnik potvrdio (talas 1 = najveći uticaj na tačnost cene, talas 2 ostaje otvoren u poglavlju 8): nov `ContractPeriod.min_stay_nights`/`max_stay_nights` (poglavlje 2.3), `Contract.commission_model`/`commission_percentage` (poglavlje 2.2b), nov `PricelistOffer` (rani rezervacija/free-nights akcije, poglavlje 2.4b), `CancellationRule.rule_type` razdvaja kaznu pre dolaska od kazne za prevremeni odlazak (poglavlje 2.5), nov generički `AncillaryService` (poglavlje 2.6, umesto fiksnih polja po tipu troška — analiza pokazala previše raznolikosti: ljubimac/parking/rani check-in/room service/depozit), i nov `TouristTaxInfo` (poglavlje 2.7) — **isključivo informativni** podatak o ceni, vlasnik potvrdio da se raniju odluku (M10/M11, boravišna taksa nije pravna obaveza agencije) ne menja, samo se dodaje mogućnost da se taj trošak vidi u strukturi cene radi tačnog obračuna troška agencije/gosta.
**Verzija:** 1.11 — `ContractPeriod.age_policy_override` (novo poglavlje 2.3c, 28.8.2026, na zahtev vlasnika: "uzrasna politika koja važi generalno za neki hotel ne mora da bude ista kada taj hotel kreira cene za neku akciju"). Opcion niz, isti oblik kao M2 `age_policy[]`, trostepen fallback (period → soba → sistemski podrazumevan) primenjen SAMO pri obračunu cene (M5 `computeRoomBaseCost`), nikad na fizički kapacitet sobe. Implementirano: Prisma polje + M5 rezolucija; panel unos čeka ekran za pojedinačan ugovor/period (ne postoji još, backlog M3 sekcija).

**Verzija:** 1.10 — cross-referenca ažurirana (avgust 2026): M18 (Operativni nadzor) sad postoji u kodu — alarm za nizak kapacitet (`low_capacity_critical`, poglavlje 4.3) ima stvarnog pretplatnika (`M18EventSubscribersService`), umesto ranije napomene "M18 još ne postoji kao model"; v1.9 — dodato `Contract.payment_terms_days` (poglavlje 2.2, avgust 2026, otkriveno pri implementaciji M10): M10 spec §8.0/§8.1 pretpostavlja da `SupplierObligation.due_date` dolazi "iz uslova plaćanja u M3 Contract", ali takvo polje nikad nije postojalo — postojao je samo `payment_schedule` (specifičan za FIXED_LEASE); dodato opšte, nullable polje (rok u danima od prijema fakture), M10 koristi podrazumevanih 30 dana kad nije uneto; v1.8 — implementacija (avgust 2026, Faza 1): `apps/api/src/modules/m3-ugovaranje-alotmani/` — Supplier/SupplierContact/Contract/ContractPeriod (sva 4 `allotment_mode`)/RateLine+`RateLineAgePricing`/CancellationRule CRUD, sprečavanje preklapanja perioda (aplikativna provera, deljena između ručnog kreiranja i uvoza cenovnika), atomska `reserve()` (jedan `UPDATE ... WHERE units_sold + n <= total_capacity`, dokazano pravim paralelnim HTTP zahtevima), alarm za nizak kapacitet preko Event Bus-a (M18 još ne postoji kao model), `PricelistImport` ljudski tok odobrenja i `SupplierExtractionProfile` učenje. Dodato `extracted_occupancy` u `PricelistImportRow` (§4.2.2) — nedostajalo u v1.7 iako je `RateLine.occupancy` obavezno polje. Stvarna AI ekstrakcija cenovnika (§4.2, korak 2) namerno nije povezana — čeka odluku o AI provajderu, isti obrazac kao TODO za email u M1 i AI uvoz sadržaja u M2. 47 unit + 15 e2e testova dokazuje 13 od 18 stavki izlaznog kriterijuma (poglavlje 7) — preostalih 5 čeka M4/M5/M10/M18/AI-provajder odluku, eksplicitno obeleženo u checklisti; v1.7 — na zahtev vlasnika (avgust 2026): `PricelistImportRow` dobija polja za kandidate uzrasne cene (`extracted_price_basis`/`extracted_age_pricing`/`extracted_crib_fee_per_night`, poglavlje 4.2.2); nov `SupplierExtractionProfile` (poglavlje 4.2.5) — AI uvoz uči potvrđen obrazac po dobavljaču i ponovo ga koristi za sledeći uvoz istog dobavljača, sa ogradom da se ne primenjuje tiho ako se struktura dokumenta promeni; v1.6 na osnovu analize stvarnih cenovnika više dobavljača: `RateLine` dobija `price_basis` (po sobi vs. po osobi) i strukturiranu cenu po uzrasnoj kategoriji gosta `age_pricing[]` (poglavlje 2.4a), rešava otvoreno pitanje iz v1.5 o ceni po detetu/bebi; v1.5 ažurirana referenca `ContractPeriod.room_type` na strukturirano `attributes.room_types[].code` iz M2 poglavlja 2.3a (avgust 2026); v1.4 dodat `SupplierContact` (poglavlje 2.1a), portal login kontakt-osobe kod dobavljača za real-time chat, dopuna M19 specifikacije za problem #9 (avgust 2026); v1.3 dodato `Contract.default_tip_nastupanja` (poglavlje 2.2), rešava nalaz #1 iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOV-B2B.md` (avgust 2026, na zahtev vlasnika); v1.2 dodat alarm za nizak preostali kapacitet (poglavlje 4.3); v1.1 dodala konvenciju celobrojnih novčanih iznosa (poglavlje 2), sprečavanje preklapanja perioda (poglavlje 2.3b) — sve poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1 (Core / Identitet i pristup), M2 (Katalog proizvoda)

---

## 1. Svrha i obim modula

M3 upravlja direktnim ugovorima agencije sa dobavljačima (hoteli, prevoznici, osiguravači): ko je dobavljač, koji su uslovi, koliko kapaciteta agencija kontroliše, po kojoj ceni, i do kog roka mora da odluči šta vraća dobavljaču. M2 (Katalog) referencira M3 preko `source_contract_id`, ali M3 je taj koji čuva stvarne cene, kapacitet i rokove — u skladu sa principom "jedan izvor istine".

Van obima: sama rezervacija i naplata (M5, M10), i proizvodi koji dolaze preko API konekcija (M4) — ti nemaju ugovor u ovom smislu.

---

## 2. Model podataka

**Konvencija za novčane vrednosti:** svaki novčani iznos u ovom dokumentu (`price`, `ukupna_fiksna_obaveza`, itd.) čuva se kao `integer` u najmanjoj jedinici valute (RSD → para, EUR → cent), **nikad kao `decimal`/float** — sprečava greške zaokruživanja pri sabiranju/množenju cena kroz lanac M3 → M5 → M10. Prikaz gostu/korisniku (npr. "1.234,56 RSD") je isključivo formatiranje na UI sloju, ne menja tip skladištenja. Izuzetak: procenti (`refund_percentage`) nisu novčani iznosi i ne podležu ovom pravilu. Ista konvencija važi kroz M5 i M10 — M10 poglavlje 3.2 je kanonski izvor ovog pravila (potvrđeno poređenjem sa PrimeTravel `supplier_integration_guide.md`, vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 1).

### 2.1 `Supplier` — dobavljač

| Polje                                        | Tip                                               | Napomena                                    |
| :------------------------------------------- | :------------------------------------------------ | :------------------------------------------ |
| id                                           | UUID (PK)                                         |                                             |
| name                                         | string                                            |                                             |
| type                                         | enum: `HOTEL`, `PREVOZNIK`, `OSIGURAVAC`, `DRUGO` |                                             |
| tax_id                                       | string                                            | PIB                                         |
| registration_number                          | string                                            | matični broj                                |
| country                                      | string                                            |                                             |
| contact_name / contact_email / contact_phone | string                                            |                                             |
| bank_account                                 | string, nullable                                  | za potrebe M10 kad dođe plaćanje dobavljaču |
| status                                       | enum: `ACTIVE`, `INACTIVE`                        |                                             |
| created_at / updated_at                      | timestamp                                         |                                             |

### 2.1a `SupplierContact` — kontakt-osoba kod dobavljača (dopuna, avgust 2026 — rešava problem #9 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, dopunjuje `20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 9)

Odvojeno od `Supplier.contact_name/contact_email/contact_phone` (poglavlje 2.1, koji ostaje opšti operativni kontakt bez logina — koristi se za `SupplierManifest`, poglavlje 8 M5 specifikacije), `SupplierContact` predstavlja **konkretnu osobu** kojoj se po želji može dodeliti lagan portal nalog za real-time chat sa timom agencije.

| Polje                   | Tip                                                              | Napomena                                                                                                                                |
| :---------------------- | :--------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | UUID (PK)                                                        |                                                                                                                                         |
| supplier_id             | UUID (FK → Supplier)                                             |                                                                                                                                         |
| full_name               | string                                                           |                                                                                                                                         |
| email / phone           | string                                                           |                                                                                                                                         |
| linked_user_id          | UUID, nullable (FK → M1 User, `account_type = SUPPLIER_CONTACT`) | popunjeno tek kad agencija svesno dodeli portal pristup (M19 poglavlje 9.2) — nullable dok kontakt postoji samo kao podatak, bez logina |
| status                  | enum: `ACTIVE`, `INACTIVE`                                       | `INACTIVE` odmah oduzima pristup razgovoru (M19 poglavlje 11), bez brisanja istorije                                                    |
| created_at / updated_at | timestamp                                                        |                                                                                                                                         |

Jedan `Supplier` može imati više `SupplierContact` zapisa (npr. recepcija i menadžer prodaje istog hotela), ali svaki dobija sopstveni, odvojen portal nalog i razgovor — isti princip kao višenivovska vidljivost u M7 (svaki nalog vidi samo svoje).

### 2.2 `Contract` — ugovor

| Polje                                | Tip                                              | Napomena                                                                                                                                                                                                                                                                                                                                                        |
| :----------------------------------- | :----------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                                   | UUID (PK)                                        |                                                                                                                                                                                                                                                                                                                                                                 |
| supplier_id                          | UUID (FK → Supplier)                             |                                                                                                                                                                                                                                                                                                                                                                 |
| contract_number                      | string                                           | interna oznaka                                                                                                                                                                                                                                                                                                                                                  |
| currency                             | enum: `EUR`, `RSD`, `USD`, ...                   | **po ugovoru**, ne globalno — potvrđeno da se meša po dobavljaču                                                                                                                                                                                                                                                                                                |
| valid_from / valid_to                | date                                             | period važenja samog ugovora (kad je potpisan i do kad važi kao dokument)                                                                                                                                                                                                                                                                                       |
| cancellation_terms_summary           | text                                             | kratak opis opštih uslova otkazivanja iz ugovora (detaljna pravila po sezoni idu u `ContractPeriod`, tačka 2.3)                                                                                                                                                                                                                                                 |
| document_url                         | string                                           | referenca ka skeniranom/potpisanom PDF-u u EU cloud skladištu — ugovor se ne čuva kao binarni podatak u bazi                                                                                                                                                                                                                                                    |
| payment_terms_days                   | integer, nullable                                | dopuna v1.9 (avgust 2026) — rok plaćanja dobavljaču u danima od prijema fakture; M10 `SupplierObligation.due_date` se izvodi odavde (M10 spec §8.1), podrazumevanih 30 dana kad nije uneto                                                                                                                                                                      |
| status                               | enum: `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` |                                                                                                                                                                                                                                                                                                                                                                 |
| default_tip_nastupanja               | enum: `ORGANIZATOR`, `POSREDNIK`                 | **obavezno pre nego što `Contract` može preći u `ACTIVE`** (dopuna ograde uz `MarkupRule`, M5 poglavlje 2.2) — vidi poglavlje 2.2a niže. Rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md`/`VALIDACIJA-WORKFLOW-B2B.md` (avgust 2026): ko/šta određuje `Booking.tip_nastupanja` kad rezervaciju sam potvrđuje gost (M8) ili subagent (M7), bez prodajnog tima u toku |
| commission_model                     | enum: `NET`, `COMMISSIONABLE`                    | dopuna v1.12 — vidi poglavlje 2.2b                                                                                                                                                                                                                                                                                                                              |
| commission_percentage                | decimal, nullable                                | dopuna v1.12 — samo za `commission_model = COMMISSIONABLE`, vidi poglavlje 2.2b                                                                                                                                                                                                                                                                                 |
| created_at / updated_at / created_by | timestamp / UUID                                 |                                                                                                                                                                                                                                                                                                                                                                 |

### 2.2a `default_tip_nastupanja` — izvor istine za samouslužne kanale (dopuna, avgust 2026)

Ugovoreni proizvod iz ovog `Contract`-a se u praksi gotovo uvek prodaje pod istim poreskim/pravnim odnosom (agencija kao organizator, ili agencija kao posrednik za tuđi aranžman) — ta odluka se donosi **kad se ugovor zaključuje**, ne pri svakoj pojedinačnoj prodaji. `default_tip_nastupanja` čuva tu odluku na jednom mestu, tako da samouslužni kanali (M8 sajt, M7 B2B portal), koji nemaju prodajni tim u toku, imaju odakle da je automatski preuzmu — vidi M5 poglavlje 4.0a, koji definiše tačan mehanizam preuzimanja pri potvrdi rezervacije.

Interni panel (M17), gde prodajni tim ručno bira `tip_nastupanja` po specifičnom dogovoru sa klijentom, i dalje sme da ga eksplicitno postavi drugačije od podrazumevane vrednosti ugovora — `default_tip_nastupanja` je _podrazumevana_ vrednost, ne prisila; ljudski nalog na internom panelu je uvek u mogućnosti da svesno odstupi (npr. poseban jednokratni dogovor da agencija ovog puta posreduje umesto organizuje). Samo za samouslužne kanale (bez ljudskog naloga u toku) ova vrednost postaje obavezujuća, jer nema ko drugi da je izabere.

### 2.2b `commission_model` — neto cena ili cena sa proviziju (dopuna v1.12, na osnovu analize stvarnih ugovora)

**Problem:** `RateLine.price` (poglavlje 2.4) je do sada uvek tumačen kao "koliko agencija plaća dobavljaču" — trošak agencije. Analiza stvarnih ugovora (avgust 2026, 55 primera) pokazuje da to nije uvek tačno: neki dobavljači (npr. Aycon portfolio) daju cenovnik sa **bruto cenom + eksplicitnu proviziju** ("Agency commission 5%") koju agencija zadržava pri prosleđivanju uplate, dok drugi (npr. Ananti, Heritage Grand Perast) eksplicitno navode "**non-commissionable, net rates**" — `RateLine.price` je tada već pravi trošak agencije, bez odbitka.

| Vrednost `commission_model` | Značenje                                                                             | Kako se tumači `RateLine.price`                                                                                                                  |
| :-------------------------- | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NET`                       | Cenovnik je već neto — nema provizije koja se odbija                                 | `RateLine.price` = trošak agencije, bez izmene (dosadašnje ponašanje, podrazumevano)                                                             |
| `COMMISSIONABLE`            | Cenovnik je bruto, agencija zadržava `commission_percentage` pri plaćanju dobavljaču | `RateLine.price` je bruto cena; stvarni trošak agencije (za M10 obavezu prema dobavljaču) = `RateLine.price × (1 − commission_percentage / 100)` |

**Obim:** ovo utiče isključivo na **obavezu agencije prema dobavljaču** (M10 `SupplierObligation`) — ne menja `RateLine.price` kao osnovicu za prodajnu cenu gostu/subagentu (M5 `MarkupRule` se i dalje primenjuje na `RateLine.price` kao do sada; da li markup treba da se računa na bruto ili na neto iznos kad je `COMMISSIONABLE`, ostaje otvoreno pitanje dok M5 ne dobije ovu dopunu — vidi poglavlje 8). Tačan mehanizam kako M10 koristi `commission_percentage` pri generisanju `SupplierObligation` definiše M10 specifikacija, ne ovde (isti obrazac kao `payment_terms_days`, poglavlje 2.2).

`Contract` ne sme preći u `ACTIVE` bez popunjenog `commission_model` (isto sprovođenje kao `default_tip_nastupanja`, poglavlje 2.2a) — dvosmislenost da li je cenovnik neto ili bruto direktno utiče na tačnost obaveze prema dobavljaču.

### 2.3 `ContractPeriod` — sezona/period unutar ugovora

Jedan ugovor može pokrivati više sezona sa različitim cenama i alotmanom (npr. "leto 2027" i "zima 2027/28" u istom ugovoru sa istim hotelom). Ovo razdvaja **period važenja ugovora** (tačka 2.2, kad je dokument na snazi) od **perioda boravka na koji se cena/alotman odnose** — potvrđeno da su ovo dva različita opsega datuma.

| Polje                                             | Tip                                                   | Napomena                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------------------------ | :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                                                | UUID (PK)                                             |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| contract_id                                       | UUID (FK → Contract)                                  |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| stay_from / stay_to                               | date                                                  | period boravka gosta na koji ova sezona/cena važi                                                                                                                                                                                                                                                                                                                                                                           |
| room_type                                         | string                                                | odgovara `code` polju unutar `attributes.room_types[]` odgovarajućeg M2 Product-a (M2 poglavlje 2.3a, dopuna avgust 2026 — konvencija, ne strogi FK, vidi princip granica modula)                                                                                                                                                                                                                                           |
| allotment_mode                                    | enum: `FIXED`, `ON_REQUEST`, `CHARTER`, `FIXED_LEASE` | vidi poglavlje 2.3a za `CHARTER`/`FIXED_LEASE`                                                                                                                                                                                                                                                                                                                                                                              |
| total_capacity                                    | integer, nullable                                     | za `FIXED`, `CHARTER`, `FIXED_LEASE` — ukupan broj jedinica (soba/mesta) u ovom periodu                                                                                                                                                                                                                                                                                                                                     |
| units_sold                                        | integer, default 0                                    | za `FIXED`, `CHARTER`, `FIXED_LEASE` — atomski se uvećava pri svakoj potvrđenoj rezervaciji (M5); vidi napomenu o konkurentnosti niže                                                                                                                                                                                                                                                                                       |
| release_days_before                               | integer, nullable                                     | **samo za `FIXED`** — koliko dana pre `stay_from` agencija mora da najavi hotelu šta vraća od neprodatog alotmana; **ne primenjuje se na `CHARTER`/`FIXED_LEASE`** (poglavlje 2.3a)                                                                                                                                                                                                                                         |
| ukupna_fiksna_obaveza / fixed_obligation_currency | integer / string, nullable                            | **samo za `CHARTER`/`FIXED_LEASE`** — u najmanjoj jedinici valute (poglavlje 2); vidi poglavlje 2.3a                                                                                                                                                                                                                                                                                                                        |
| payment_schedule                                  | JSONB, nullable                                       | **samo za `FIXED_LEASE`** — vidi poglavlje 2.3a                                                                                                                                                                                                                                                                                                                                                                             |
| age_policy_override                               | JSONB, nullable                                       | izuzetak od opšte uzrasne politike sobe SAMO za ovaj period/cenovnik — vidi poglavlje 2.3c                                                                                                                                                                                                                                                                                                                                  |
| min_stay_nights                                   | integer, nullable                                     | dopuna v1.12 — minimalan broj noćenja da bi se ova cena/period uopšte mogli rezervisati; `null` = nema minimuma. Potvrđeno analizom da se često razlikuje po tipu sobe unutar istog perioda (npr. vile 3 noćenja u vrhuncu sezone naspram 1 noćenja za standardne sobe) — kad taj slučaj nastupi, unose se dva odvojena `ContractPeriod` zapisa (različit `room_type`, isti `stay_from/stay_to`), ne jedno zajedničko polje |
| booking_from / booking_to                         | date, nullable                                        | dopuna v1.20 — rezervacija sme da nastane samo u ovom opsegu („rane prijave do 31.3."); `null` = bez ograničenja. Menja pravilo preklapanja iz 2.3b i ulazi u izračun raspoloživosti — vidi poglavlje 2.3e                                                                                                                                                                                                                  |
| max_stay_nights                                   | integer, nullable                                     | dopuna v1.12 — maksimalan broj noćenja; `null` = nema maksimuma                                                                                                                                                                                                                                                                                                                                                             |
| created_at / updated_at                           | timestamp                                             |                                                                                                                                                                                                                                                                                                                                                                                                                             |

**`ON_REQUEST` period nema `total_capacity` ni `units_sold`** — sistem ne garantuje kapacitet; svaki pokušaj rezervacije u ovom periodu mora proći kroz ručnu ili API potvrdu dobavljača pre nego što se gostu potvrdi (M5 ovo tretira kao status "Na čekanju potvrde dobavljača", ne kao trenutnu potvrdu).

**Napomena o konkurentnosti (za implementaciju M5):** uvećanje `units_sold` mora biti atomska operacija sa proverom (`UPDATE ... SET units_sold = units_sold + 1 WHERE units_sold + n <= total_capacity`, unutar transakcije sa row-level lock-om) — sprečava da dva agenta istovremeno rezervišu poslednju sobu i pređu kapacitet. Isto važi za `CHARTER`/`FIXED_LEASE`.

### 2.3d Izmena i gašenje perioda (dopuna v1.16, 8.9.2026)

Do ove verzije period se mogao **napraviti, ali ne i izmeniti ni obrisati** — u kodu postoji samo `POST /contracts/:id/periods` i `PUT` za pod-resurse (cene, otkazivanja, ponude, dodatne usluge, taksa). Dozvola `M3/contract-period/EDIT` postojala je u poglavlju 5 od prve verzije, bez ijednog endpoint-a koji bi je koristio. Posledica: pogrešno unet kapacitet, datum ili tip sobe nije se mogao ispraviti kroz aplikaciju. Otkriveno 8.9.2026 na vlasnikovo pitanje gde se kapacitet uopšte definiše.

**Izmena (`PATCH`)** menja `total_capacity`, `stay_from`/`stay_to`, `room_type`, `release_days_before`, `min_stay_nights`/`max_stay_nights` i polja iz 2.3a. Dva pravila:

1. **Promena datuma ili tipa sobe ponovo prolazi kroz proveru preklapanja** (poglavlje 2.3b) — ista provera kao pri kreiranju, jer izmenom se lako napravi preklapanje koje pri unosu nije postojalo.
2. **Smanjenje kapaciteta ispod već prodatog je dozvoljeno** (vlasnikova odluka 8.9.2026). Sistem ga ne odbija, jer se to u praksi dešava — dobavljač smanji kontingent, a gosti su već u knjigama. Umesto odbijanja: upozorenje pre potvrde ("prodato je 15, unosite 12 — tri jedinice ostaju bez pokrića"), upis u audit log sa starom i novom vrednošću, i događaj `capacity_oversold` na Event Bus (M18 signal `CAPACITY_OVERSOLD`). Stanje se od tada prikazuje kao **negativan broj** (poglavlje 2.8c) — nikad kao nula.

**Gašenje (`DELETE`)** — period koji **ima ijednu rezervaciju** (postojeći `BookingItem` preko svojih `RateLine`-ova) se **ne briše**, nego prelazi u `status = INACTIVE`: prestaje da se pojavljuje u pretrazi i ne prima nove rezervacije, ali ostaje kao osnov postojećih. Brisanje bi prekinulo vezu prodatog sa cenom i kapacitetom po kojima je prodato. Period bez ijedne rezervacije se briše stvarno, jer nema šta da ostane.

| Polje                           | Tip                             | Napomena                               |
| :------------------------------ | :------------------------------ | :------------------------------------- |
| status                          | enum: `ACTIVE`, `INACTIVE`      | dopuna v1.16 — gašenje umesto brisanja |
| deactivated_by / deactivated_at | UUID (FK → M1 User) / timestamp | ko je i kada ugasio period             |

---

### 2.3e Kapacitet važi za rezervacije napravljene od…do (dopuna v1.20, 8.9.2026, na zahtev vlasnika)

**Šta je propušteno.** Do ove verzije `ContractPeriod` je znao **kada gost boravi** (`stay_from`/`stay_to`), ali ne i **kada rezervacija sme da nastane**. Vlasnik je to prijavio kao propust: _„kapacitet može da važi za rezervacije od…do."_

To je svakodnevna pojava u ugovorima: „10 soba za prijave do 31.3., posle toga 5" (rana rezervacija), „ovaj kontingent važi samo za prijave u martu", „posle 1.6. ide samo na upit". Bez ovog podatka sistem bi nudio kontingent koji je istekao, ili ne bi nudio onaj koji je otvoren.

Potvrđeno i na uzoru: u PrimeTravel čarobnjaku „Kreiraj Kapacitet" polje **„Rezervacije od…do" stoji PRVO**, iznad perioda boravka, sa komentarom u kodu da je tako postavljeno na izričit zahtev korisnika (`OperationalReports.tsx`, „Booking Period FIRST per user request"). To nije njihova stilska odluka nego redosled kojim se o kapacitetu razmišlja u praksi.

#### 2.3e.1 Dva nova polja na `ContractPeriod`

| Polje                     | Tip            | Napomena                                                                                                                      |
| :------------------------ | :------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| booking_from / booking_to | date, nullable | rezervacija sme da nastane samo u ovom opsegu; `null`/`null` = bez ograničenja (postojeće ponašanje, i podrazumevano za nove) |

**Zašto na `ContractPeriod`, a ne kao nov zapis.** Kapacitet, cena, rok povrata i pravila otkazivanja se u ugovoru menjaju **zajedno** sa prozorom prijave („do 31.3. deset soba po ovoj ceni, posle toga pet po drugoj"). Zaseban zapis samo za prozor bi razdvojio stvari koje u ugovoru stoje u istom pasusu, i tražio bi da se svako čitanje kapaciteta spaja iz dva izvora.

**Nije isto što i `PricelistOffer.booking_from`/`booking_to`** (poglavlje 2.4b). Taj prozor menja **cenu** (rana rezervacija kao popust) nad istim kapacitetom. Ovaj menja **sam kapacitet** — koliko jedinica uopšte postoji za onoga ko se prijavljuje danas. Ista dva datuma, dve različite posledice; u praksi se često poklapaju, ali se ne smeju spojiti u jedno polje.

#### 2.3e.2 Pravilo preklapanja se proširuje (menja poglavlje 2.3b)

Poglavlje 2.3b zabranjuje dva perioda sa istim `contract_id` + `room_type` i presecajućim `stay_from`/`stay_to`. Sa prozorom prijave ta zabrana bi odbila potpuno legitiman unos — „isti boravak, 10 soba za prijave do 31.3. i 5 za prijave posle".

**Novo pravilo:** dva perioda smeju da se preklope po datumima boravka **samo ako im se prozori prijave ne preklapaju**. Sukob postoji kada se seku **oba** opsega istovremeno:

```
sukob  ⇔  stay opsezi se seku  I  booking opsezi se seku
```

`null` prozor se tretira kao „uvek" i seče se sa svim ostalim — period bez prozora i period sa prozorom, nad istim boravkom, jesu sukob (jer za datum unutar prozora važe oba). Bazno ograničenje iz 2.3b (`EXCLUDE USING gist`) proširuje se na oba opsega.

#### 2.3e.3 Tranše se ne sabiraju — nova vrednost menja staru

„10 soba za prijave do 31.3., 5 za prijave posle" **nije 15 soba.** To je isti fizički kontingent, iskazan dvaput sa različitim prozorom prijave — i posle 1.4. u njemu ostaje pet.

**Pravilo:** raspoloživost za neku noć uvek koristi **tačno jedan** period — onaj čiji prozor prijave obuhvata datum kad se rezervacija pravi. Zbir kapaciteta više tranši za isti boravak se nigde ne računa i nigde ne prikazuje.

Isto pravilo je i na uzoru izričito napisano u čarobnjaku („Nove vrednosti menjaju stare, bez sabiranja"), pa se prenosi i u našu formu kao vidljiv tekst, ne kao prećutna konvencija.

**Prodato se ne deli po tranšama.** `prodato` za neku noć je zbir **svih** potvrđenih rezervacija te noći, bez obzira kad su napravljene. Otud i posledica koja mora da bude vidljiva: ako je do 31.3. prodato 8 od 10, a od 1.4. kontingent pada na 5, stanje od 1.4. je **−3** i prikazuje se sa minusom (poglavlje 2.8c), isto kao svako drugo prekoračenje. Već napravljene rezervacije se **ne diraju** — prozor prijave je istekao za nove prijave, ne za goste koji su već u knjigama.

#### 2.3e.4 Raspoloživost sad zavisi i od toga KAD se rezerviše

Izračun iz poglavlja 2.8c dobija još jedan ulaz — **datum prijave** (`booking_date`):

```
period       = onaj čiji booking prozor obuhvata booking_date  (i čiji stay obuhvata noć)
kapacitet    = CapacityDay.capacity_override ?? ContractPeriod.total_capacity
...ostalo nepromenjeno
```

- **Pri prodaji** (M5) `booking_date` je uvek **danas**. Period čiji je prozor prijave prošao ne ulazi u ponudu; odbijanje nosi razlog `BOOKING_WINDOW_CLOSED` (peti razlog uz četiri iz M5 §4 korak 2) — jer to nije „nema mesta" nego „zakasnili ste", a nastavak je drugačiji (pitati dobavljača za produžetak).
- **Na mreži kapaciteta** `booking_date` je podrazumevano danas, ali se **može pomeriti** — filter „Rezervacije od…do" (M17 §4b.3). Bez toga se ne može odgovoriti na pitanje „šta ćemo imati na raspolaganju za prijave u aprilu", a to je pitanje od kog zavisi da li se traži produžetak roka.

Mreža uvek ispisuje na koji datum prijave se prikaz odnosi. Broj koji zavisi od skrivene pretpostavke je gori od broja koji fali.

---

### 2.3a `CHARTER` i `FIXED_LEASE` — kapacitet sa fiksnom obavezom nezavisno od prodaje

Za razliku od `FIXED` (gde agencija drži kontingent kod dobavljača, ali dobavljač i dalje snosi rizik neprodatog dela — zato postoji `release_days_before`), kod `CHARTER` i `FIXED_LEASE` agencija **unapred preuzima punu finansijsku obavezu** za ceo kapacitet, bez obzira na to koliko se stvarno proda:

- **`CHARTER`** — agencija otkupljuje ceo kapacitet leta/broda/autobusa za period, jednokratno.
- **`FIXED_LEASE`** (fiksni zakup) — agencija zakupljuje ceo objekat (hotel, brod) za sezonu, uz fiksnu mesečnu/periodičnu obavezu, nezavisno od popunjenosti.

| Polje (dopuna 2.3)      | Napomena                                                                                                                                                                                                            |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ukupna_fiksna_obaveza` | Ukupan iznos koji agencija duguje dobavljaču za ceo period, nezavisno od `units_sold` — jednokratan iznos za `CHARTER`, zbir svih rata za `FIXED_LEASE`                                                             |
| `payment_schedule`      | Samo za `FIXED_LEASE` — niz `{due_date, amount}` rata. Svaka rata, kad dospe, generiše zapis u M10 `SupplierObligation` (M10 poglavlje 8) — isti mehanizam kao svaka druga obaveza prema dobavljaču, ne poseban tok |

**Break-even i P&L pregled** (koliko treba prodati da se pokrije `ukupna_fiksna_obaveza`, i koliki je trenutni jaz) računa se iz `ukupna_fiksna_obaveza` (M3) naspram stvarno naplaćene vrednosti prodatih stavki (M5/M10) — ovo je **read-only agregacija preko modula**, pripada M13 (BI), ne čuva se kao duplirano polje ovde (princip "jedan izvor istine") — vidi M13 poglavlje 9, otvoreno pitanje.

**`release_days_before` se ne primenjuje** — nema koncepta "vraćanja" dobavljaču, kapacitet je već otkupljen/zakupljen, neprodato je sunk cost agencije, ne dobavljača.

### 2.3b Sprečavanje preklapanja perioda (overlap prevention)

Dva `ContractPeriod` zapisa sa istim `contract_id` i `room_type` **ne smeju imati preklapajuće opsege `stay_from`/`stay_to`** — preklapanje bi značilo da dve različite cene/alotmana važe za isti datum boravka iste sobe, što je dvosmisleno (koja cena/kapacitet se primenjuje?). Dodato poređenjem sa PrimeTravel `PRICING_BLUEPRINT.md`, koji ovo eksplicitno navodi kao planiranu validaciju (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 3).

**Sprovođenje:** provera se radi pri kreiranju/izmeni perioda (`M3/contract-period/EDIT`, poglavlje 5) i pri odobravanju reda iz AI uvoza cenovnika (poglavlje 4.2.4, `review_status → CONFIRMED`/`MANUALLY_MATCHED`) — pokušaj upisa perioda čiji se opseg seče sa postojećim (isti `contract_id` + `room_type`) se odbija sa jasnom porukom koji postojeći period je u sukobu. Na nivou baze, preporučuje se PostgreSQL `EXCLUDE USING gist` ograničenje nad `(contract_id, room_type, daterange(stay_from, stay_to))` — tehnička, ne samo aplikativna prepreka, isti nivo opreza kao ograda u M5 poglavlje 2.2 za `MarkupRule`.

Granični slučaj: susedni periodi (npr. jedan se završava 2027-08-31, drugi počinje 2027-09-01) **nisu** preklapanje — u sukobu je samo strogo presecanje opsega (`stay_from < other.stay_to AND stay_to > other.stay_from`). **Dopuna v1.20 (8.9.2026):** ovo pravilo je prošireno prozorom prijave — dva perioda smeju da se preklope po datumima boravka ako im se `booking_from`/`booking_to` ne preklapaju („isti boravak, 10 soba za prijave do 31.3. i 5 za prijave posle"). Tačan oblik uslova i bazno ograničenje: poglavlje 2.3e.2.

Ova provera se primenjuje jednako na sve vrednosti `allotment_mode` — dva perioda za isti datum/sobu su dvosmislena bez obzira da li je jedan `FIXED` a drugi `ON_REQUEST`.

### 2.3c `age_policy_override` — uzrasna politika po cenovniku, ne fiksno po hotelu (dopuna, 28.8.2026, na zahtev vlasnika)

**Problem (vlasnikova formulacija):** "uzrasna politika koja važi generalno za neki hotel ne mora da bude ista kada taj hotel kreira cene za neku akciju ili bilo šta drugo — ako je generalno da dete 2-12 godina ima popust 30%, a sada u nekom novom cenovniku radi bolje prodaje odobri se da dete do 15 godina ima isti taj popust." Do sada je `M2 room_types[].age_policy[]` (M2 poglavlje 2.3b) bila JEDINA uzrasna politika te sobe — nije postojao način da konkretan `ContractPeriod` (jedan cenovnik/sezona) privremeno pomeri uzrasnu granicu bez trajne izmene opšteg pravila hotela.

**Rešenje:** `ContractPeriod.age_policy_override` — opcion niz, **isti oblik** kao `M2 room_types[].age_policy[]` (poglavlje 2.3b tog spec-a: `category`/`age_from`/`age_to`/`counts_toward_capacity`/`max_count`/`requires_crib`/`crib_included`). Trostepen fallback pri obračunu cene (M5 poglavlje 3.2b, `computeRoomBaseCost`):

1. `ContractPeriod.age_policy_override` (ovaj period/cenovnik), ako je postavljen i neprazan;
2. inače `Product.attributes.room_types[].age_policy` (opšta politika sobe, M2 poglavlje 2.3b);
3. inače sistemski `DEFAULT_AGE_POLICY` (M2 poglavlje 2.3b).

**Ograničeno isključivo na klasifikaciju gosta radi CENE** (koja `age_pricing[]` cena se primenjuje, poglavlje 2.4a) — **nikad na fizički kapacitet sobe**. `assertRoomCapacity` (M5 spec §3.2a) uvek koristi opštu M2 politiku sobe, bez obzira na `age_policy_override` — kapacitet je fizičko svojstvo sobe (koliko gostiju fizički stane), ne menja se po tome koji je cenovnik trenutno na snazi. Kategorije (`ADULT`/`CHILD`/`TEEN`/`INFANT`) ostaju isti skup imena bez obzira na override — samo se `age_from`/`age_to` granice pomeraju za taj period, pa postojeći `age_pricing[]` redovi (koji referenciraju kategoriju po imenu, poglavlje 2.4a) ostaju validni i primenjuju se na gosta klasifikovanog po (eventualno pomerenoj) granici.

**Status (dopunjeno 29.8.2026):** implementirano je polje modela + rezolucija u M5 obračunu cene (`apps/api/src/modules/m5-rezervacije/common/occupancy.ts`, `computeRoomBaseCost`), **i panel ekran za unos** — `POST /contracting/contracts/:id/periods` prima `agePolicyOverride[]` (dodato uz `CreateContractPeriodDto`/`AgePolicyOverrideEntryDto`), a M17 panel (`apps/panel/src/app/(app)/ugovori/[id]/PeriodsPanel.tsx`, forma za nov period) nudi unos ovog izuzetka pri kreiranju perioda/cenovnika. Izmena ovog polja na već postojećem periodu i dalje nije moguća (nema `PATCH` na `ContractPeriod`) — samo unos pri kreiranju, u skladu sa formulacijom "pri kreiranju cenovnika" iznad.

### 2.4 `RateLine` — cena po kombinaciji unutar perioda

| Polje                   | Tip                                                | Napomena                                                                                                                                                                                                                                     |
| :---------------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | UUID (PK)                                          |                                                                                                                                                                                                                                              |
| contract_period_id      | UUID (FK → ContractPeriod)                         |                                                                                                                                                                                                                                              |
| board_type              | string                                             | npr. "polupansion", "all-inclusive"                                                                                                                                                                                                          |
| occupancy               | string                                             | npr. "odrasla osoba u dvokrevetnoj", "doplata za jednokrevetnu" — i dalje opisuje **osnovnu** popunjenost na koju se `price` odnosi (vidi `price_basis` niže)                                                                                |
| price_basis             | enum: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | dopuna avgust 2026 — određuje kako se `price` tumači i sabira kad u sobi ima više gostiju (poglavlje 2.4a); potvrđeno analizom stvarnih cenovnika da dobavljači stvarno koriste oba modela, nema jedinstvenog standarda                      |
| price                   | integer                                            | u najmanjoj jedinici valute ugovora (`Contract.currency`) — vidi konvenciju u poglavlju 2; za `PER_ROOM_PER_NIGHT` je to cena cele sobe pri osnovnoj popunjenosti iz `occupancy`, za `PER_PERSON_PER_NIGHT` je to cena po jednom ADULT gostu |
| crib_fee_per_night      | integer, nullable                                  | doplata za krevetac po noći (dopuna avgust 2026) — popunjeno samo kad `M2 room_types[].age_policy[].requires_crib = true` i `crib_included = false` za tu sobu (M2 poglavlje 2.3b); `null` znači krevetac je besplatan ili se ne primenjuje  |
| created_at / updated_at | timestamp                                          |                                                                                                                                                                                                                                              |

### 2.4a `age_pricing[]` — cena po uzrasnoj kategoriji gosta (dopuna, avgust 2026, na zahtev vlasnika)

Rešava otvoreno pitanje iz M2 poglavlja 2.3b: `age_policy[]` (M2) definiše _ko se u koju uzrasnu kategoriju svrstava i da li ulazi u kapacitet sobe_ — ovde se definiše _po kojoj ceni_. Zasnovano na analizi stvarnih cenovnika više dobavljača (avgust 2026) — dobavljači u praksi koriste **dva različita načina** da izraze cenu po detetu/bebi/tinejdžeru, ne jedan, pa `age_pricing[]` mora podržati oba:

| Polje              | Tip                                                      | Napomena                                                                                                                                                                                                                       |
| :----------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| age_category       | string                                                   | mora odgovarati vrednosti iz `M2 room_types[].age_policy[].category` (ADULT/CHILD/TEEN/INFANT, proširivo — M2 poglavlje 2.3b) za sobu na koju se ovaj `RateLine` odnosi, preko `contract_period_id → ContractPeriod.room_type` |
| occupant_index     | integer, nullable                                        | koje po redu gost te kategorije u sobi (1 = prvi, 2 = drugi...) — pokriva pravila tipa "prvo dete -50%, drugo dete besplatno"; `null` = važi podjednako za svakog gosta te kategorije                                          |
| min_adults_present | integer, nullable                                        | pravilo važi samo ako je u sobi bar ovoliko `ADULT` gostiju — pokriva pravila tipa "dete sa dva roditelja besplatno, dete sa jednim roditeljem uz doplatu"; `null` = bez uslova                                                |
| pricing_mode       | enum: `PERCENTAGE_OF_BASE_PRICE`, `FLAT_PRICE_PER_NIGHT` |                                                                                                                                                                                                                                |
| percentage         | decimal, nullable                                        | samo za `PERCENTAGE_OF_BASE_PRICE` — procenat od `RateLine.price` (npr. `50.00` = pola cene); `0` = besplatno                                                                                                                  |
| flat_price         | integer, nullable                                        | samo za `FLAT_PRICE_PER_NIGHT` — pun iznos po noći za tog gosta, u najmanjoj jedinici valute; `0` = besplatno                                                                                                                  |

**Napomena o "besplatno":** uvek se upisuje eksplicitan red sa `percentage = 0` ili `flat_price = 0`, nikad se besplatan gost ne predstavlja izostankom reda — izostanak reda za neku kategoriju gosta je greška u unosu (vidi ogradu niže), ne prećutna pretpostavka o ceni.

**Razrešavanje kad više redova odgovara istom gostu (najspecifičniji pobeđuje):** 1) red sa tačnim `occupant_index` (ne `null`), 2) red bez `occupant_index` ali sa najvišim `min_adults_present` koji je zadovoljen, 3) red bez ikakvog uslova (`occupant_index = null`, `min_adults_present = null`) kao podrazumevani. Isti obrazac razrešavanja kao `MarkupRule` (poglavlje 2.2 M5 specifikacije).

**Ograda:** ako gost (iz M5 `room_config`, klasifikovan po M2 `age_policy[]`) pripada kategoriji za koju **nijedan** `age_pricing[]` red ne postoji (ni uslovljen ni podrazumevani) na primenjivom `RateLine`, kreiranje `Quote` (M5) se odbija sa jasnom porukom — sistem nikad ne pretpostavlja punu cenu niti besplatan boravak za nedostajuću kategoriju, u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta.

**Šta znači "1. dete" — brojanje i redosled (dopuna 10.9.2026, na zahtev vlasnika)**

`occupant_index` iznad ("prvo dete", "drugo dete") do sada nije imao definisano **po čemu** se ta redna oznaka dodeljuje. Vlasnikova formulacija (10.9.2026): _"u jednom [cenovniku] će biti info da dete u pratnji dve odrasle osobe ima popust 100%, u drugom da isključivo 1. dete ima, u trećem samo 2. ili 3."_ — ista oznaka nosi različit novac od cenovnika do cenovnika, a kad su u sobi deca iz različitih kategorija (npr. `CHD1` 5 godina i `CHD2` 9 godina) nije jednoznačno ko je "prvi".

Dva polja na `ContractPeriod`, uz `age_policy_override` (poglavlje 2.3c) i iz istog razloga — konvencija je svojstvo **cenovnika**, ne hotela:

| Polje                | Tip                                                            | Napomena                                                                                                                                                                         |
| :------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| child_counting_basis | enum: `ALL_CHILDREN`, `PER_CATEGORY`; default `ALL_CHILDREN`   | `ALL_CHILDREN` — jedan niz kroz svu decu u sobi bez obzira na kategoriju; `PER_CATEGORY` — svaka kategorija broji od jedan (pa su i `CHD1` i `CHD2` "prvo dete", svako u svojoj) |
| child_order          | enum: `OLDEST_FIRST`, `YOUNGEST_FIRST`; default `OLDEST_FIRST` | koje dete dobija `occupant_index = 1`                                                                                                                                            |

**Zašto podrazumevana vrednost, a ne obavezan unos:** obe vrednosti daju identičan rezultat kod velike većine cenovnika — svaki koji nema pravilo vezano za redni broj, i svaki koji ima samo jednu dečju kategoriju. Obavezan unos bi tražio odluku tamo gde odluke nema. Podrazumevane vrednosti potvrdio vlasnik 10.9.2026.

**Ovim se ispravlja stvaran kvar, ne samo praznina:** do ove dopune redni broj se dodeljivao **redosledom kojim su godine dece ukucane** (`M5 occupancy.room_config[].children_ages[]`, `classifyRoomGuests` u `apps/api/src/modules/m5-rezervacije/common/occupancy.ts`), pa je ista porodica dobijala različitu cenu zavisno od toga da li je prodavac upisao "9, 5" ili "5, 9". Posle ove dopune redosled unosa **ne utiče na cenu** ni u jednoj od četiri kombinacije ova dva polja — redosled se izvodi iz uzrasta, ne iz redosleda kucanja.

**Provera koja se prijavljuje, ne pretpostavlja:** kad bi druga vrednost `child_order` dala **drugačiju ukupnu cenu** za istu sobu i iste goste, panel to izričito kaže uz cenovnik ("izbor redosleda dece menja iznos — proverite dobavljačev dokument"). Kad razlike nema — a najčešće je nema — ne prikazuje se ništa. Isti princip kao ograda iznad: sporan slučaj se prijavljuje, ne rešava se tiho.

**Uvoz cenovnika (poglavlje 4.2)** popunjava oba polja iz same rečenice dokumenta, kao i kategorije i popuste; zaposleni ih potvrđuje ili menja pri pregledu razlika (poglavlje 2.11l).

**Veza sa M2 poglavljem 2.3g:** ova dva polja odlučuju **kako se deca broje radi cene**. Koliko dece i na kojim krevetima sme da bude — odlučuje matrica kombinacija sobe (M2 2.3g), koja ne zna ni za jednu kategoriju ovog cenovnika. Dve odluke, jedan ulaz: uzrast gosta.

**Kako se ovo sabira u ukupnu cenu sobe** — definiše M5 (poglavlje 3.2b te specifikacije, ne ovde), pošto je to deo formule za `base_cost`; ovde se čuvaju samo ulazni podaci.

### 2.4b `PricelistOffer` — rana rezervacija i free-nights akcije (dopuna v1.12)

Skoro svaki analizirani cenovnik (avgust 2026) sadrži bar jednu vremenski ograničenu akciju iznad osnovne cene iz `RateLine` — najčešće rani popust za rezervaciju unapred ("Early Booking Discount/EBB"), ređe "kupi X noćenja, plati Y" (npr. "6=5", "7=6"). Do sada nije postojalo mesto u modelu za ovo — cena se tretirala kao fiksna po `RateLine`. `PricelistOffer` je odvojen od `RateLine` jer akcija ima **sopstveni datumski prozor prijave** (kad gost mora da rezerviše), različit od `stay_from/stay_to` perioda boravka koji već čuva `ContractPeriod`.

| Polje                        | Tip                                          | Napomena                                                                                                                                                                                                                                                               |
| :--------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                           | UUID (PK)                                    |                                                                                                                                                                                                                                                                        |
| contract_period_id           | UUID (FK → ContractPeriod)                   |                                                                                                                                                                                                                                                                        |
| offer_type                   | enum: `EARLY_BOOKING`, `FREE_NIGHTS`         |                                                                                                                                                                                                                                                                        |
| booking_from / booking_to    | date                                         | prozor u kom gost mora da izvrši rezervaciju/uplatu da bi akcija važila — **različito** od `stay_from/stay_to` perioda (kad gost boravi)                                                                                                                               |
| discount_type                | enum: `PERCENTAGE`, `FIXED_AMOUNT`, nullable | samo za `EARLY_BOOKING`; `null` za `FREE_NIGHTS` (tamo popust proizlazi iz `stay_nights`/`pay_nights`, ne iz procenta)                                                                                                                                                 |
| discount_percentage          | decimal, nullable                            | samo za `discount_type = PERCENTAGE`                                                                                                                                                                                                                                   |
| discount_amount              | integer, nullable                            | samo za `discount_type = FIXED_AMOUNT`, u najmanjoj jedinici valute ugovora (poglavlje 2)                                                                                                                                                                              |
| stay_nights / pay_nights     | integer, nullable                            | samo za `offer_type = FREE_NIGHTS` — npr. `stay_nights = 6, pay_nights = 5` ("6=5"); `pay_nights` mora biti manje od `stay_nights`                                                                                                                                     |
| deposit_percentage           | decimal, nullable                            | procenat uplate depozita koji akcija zahteva pri rezervaciji, ako postoji (potvrđeno u više primera)                                                                                                                                                                   |
| deposit_deadline             | date, nullable                               | rok do kog depozit mora biti uplaćen                                                                                                                                                                                                                                   |
| min_age / max_age            | decimal, nullable                            | akcija ograničena na gosta određenog uzrasta (retko, viđeno u praksi) — isti `X,99` zapis kao M2 `age_policy[].age_to` (M2 poglavlje 2.3b); `null` = bez uzrasnog ograničenja                                                                                          |
| valid_arrival_weekdays       | integer[], nullable                          | dani u nedelji (1=ponedeljak...7=nedelja) kad je dolazak dozvoljen pod ovom akcijom; `null` = bez ograničenja                                                                                                                                                          |
| excluded_room_types          | string[], nullable                           | `room_type` kodovi (poglavlje 2.3) izuzeti iz akcije (potvrđeno: dobavljači često isključuju luksuzne/predsedničke apartmane iz EBB-a)                                                                                                                                 |
| combinable_with_other_offers | boolean                                      | da li se ova akcija sme sabrati sa drugom `PricelistOffer` stavkom istog perioda (potvrđeno da neki dobavljači eksplicitno navode redosled/kombinovanje, npr. "EBD se primenjuje prvo, pa grupni popust") — `false` = akcija se primenjuje samostalno, ne kombinuje se |
| created_at / updated_at      | timestamp                                    |                                                                                                                                                                                                                                                                        |

**Namerno van obima ovde:** tačan redosled/algoritam kad se dve ili više `PricelistOffer` stavki primenjuju na istu rezervaciju (koja se računa prva, da li se baziraju jedna na drugu ili obe na `RateLine.price`) definiše M5 (obračun cene), ne ovde — M3 samo čuva ulazne podatke i `combinable_with_other_offers` zastavicu, isti obrazac kao `age_pricing[]` (poglavlje 2.4a).

### 2.4c Ispravka cenovne stavke — gašenje pa nova, nikad prepisivanje (dopuna 9.9.2026, vlasnikova odluka)

Vlasnikovo pitanje 9.9.2026 („gde se cene unose ručno") otkrilo je da se cena u panelu može samo **dodati**. Sve četiri cenovne stavke — `RateLine` (2.4), `CancellationRule` (2.5), `PricelistOffer` (2.4b) i `AncillaryService` (2.6) — pisale su se endpoint-om koji **uvek kreira nov red**, bez `PATCH` i bez `DELETE`.

**Posledica nije bila kozmetička.** Pogrešno ukucana cena se nije mogla povući, a `SearchService` od **svake** cenovne linije perioda pravi zasebnu ponudu — pa je pogrešna cena ostajala **prodajna**, uporedo sa ispravnom, i po pravilu najniže cene (2.10) često i pobeđivala.

**Odluka (vlasnik, 9.9.2026): ispravka je gašenje stare stavke i upis nove, nikad prepisivanje vrednosti.** Cena je finansijski podatak; posle izmene mora ostati odgovor na pitanje po kojoj je ceni nešto prodato pre nje. Isti obrazac koji `ContractPeriod` već koristi od v1.18 (`status` + `deactivated_by`/`deactivated_at`), pa se ne uvodi nov pojam.

Sve četiri stavke dobijaju:

| Polje                           | Tip                                         | Napomena                                                      |
| :------------------------------ | :------------------------------------------ | :------------------------------------------------------------ |
| status                          | enum: `ACTIVE`, `INACTIVE` (podr. `ACTIVE`) | `INACTIVE` = više se ne prodaje, ali se ne briše              |
| deactivated_by / deactivated_at | UUID (FK → M1 User) / timestamp             | ko je i kada ugasio                                           |
| replaces_id                     | UUID, nullable                              | kad je stavka nastala kao ispravka druge — veže novu za staru |

**Tri pravila koja se ne pregovaraju:**

1. **Pretraga i prodaja gledaju isključivo `ACTIVE`.** Ovo je jedina izmena koja stvarno zaustavlja pogrešnu cenu; sve ostalo je evidencija. Bez nje bi gašenje bilo samo oznaka koju niko ne poštuje.
2. **Ugašena stavka se ne briše iz baze i ne nestaje sa ekrana** — prikazuje se prigušeno, sa datumom gašenja i imenom osobe. Nestanak reda čita se kao „nikad nije ni postojao", što je za cenu netačno i sporno.
3. **Već potvrđene rezervacije se ne diraju.** Stavka rezervacije nosi svoju cenovnu liniju kao snimak (M5 §6), pa gašenje menja buduće ponude, ne prošle. Zato gašenje nikad ne traži proveru „da li je nešto prodato" — ta provera bi zabranila ispravku baš tamo gde je najpotrebnija.

**Ispravka je jedan potez, ne dva.** `PUT /rates/:id/replace` u istoj transakciji gasi staru i upisuje novu sa `replaces_id`; da su to dva odvojena poziva, prekid između njih ostavio bi period bez ijedne važeće cene.

### 2.5 `CancellationRule` — pravila otkazivanja po periodu

| Polje                       | Tip                                                                 | Napomena                                                                                                                                                                                                                                                                                         |
| :-------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                          | UUID (PK)                                                           |                                                                                                                                                                                                                                                                                                  |
| contract_period_id          | UUID (FK → ContractPeriod)                                          |                                                                                                                                                                                                                                                                                                  |
| rule_type                   | enum: `PRE_ARRIVAL`, `EARLY_DEPARTURE`, podrazumevano `PRE_ARRIVAL` | dopuna v1.12 — razdvaja otkazivanje **pre** dolaska (postojeće ponašanje, polja ispod) od prevremenog napuštanja/skraćenja boravka **posle** check-in-a (novo, vidi ogradu niže); analiza stvarnih ugovora potvrdila da dobavljači ove dve situacije tretiraju različitim pravilima i osnovicama |
| days_before_stay            | integer, nullable                                                   | **samo za `PRE_ARRIVAL`** — prag, npr. 30, 15, 7                                                                                                                                                                                                                                                 |
| refund_percentage           | integer (0–100), nullable                                           | **samo za `PRE_ARRIVAL`** — koliko se vraća gostu ako otkaže u tom prozoru                                                                                                                                                                                                                       |
| early_departure_basis       | enum, nullable: `PERCENTAGE_OF_REMAINING_STAY`, `FLAT_AMOUNT`       | **samo za `EARLY_DEPARTURE`** — kako se računa kazna kad gost skrati boravak posle dolaska; potvrđeno u praksi oba oblika (npr. "100% preostalih noćenja" naspram fiksnog iznosa "po vaučeru")                                                                                                   |
| early_departure_percentage  | integer (0–100), nullable                                           | **samo za `early_departure_basis = PERCENTAGE_OF_REMAINING_STAY`** — procenat cene preostalih, nerealizovanih noćenja koji se naplaćuje kao kazna                                                                                                                                                |
| early_departure_flat_amount | integer, nullable                                                   | **samo za `early_departure_basis = FLAT_AMOUNT`**, u najmanjoj jedinici valute ugovora (poglavlje 2)                                                                                                                                                                                             |

Primer za `PRE_ARRIVAL`: 30 dana → 100%, 15–29 dana → 50%, 0–14 dana → 0%. Ovo koristi M5 (obračun otkazivanja) i M10 (obračun povraćaja) — M3 samo čuva pravilo.

**Ograda za `EARLY_DEPARTURE`:** ovo je kazna za skraćenje **već potvrđenog i započetog** boravka (gost je stigao pa prevremeno odlazi) — potpuno odvojena situacija od `PRE_ARRIVAL` (gost otkazuje pre nego što je uopšte stigao), zato različita polja, ne isti `days_before_stay`/`refund_percentage` par. Tačan obračun (koji M5/M10 tok pokreće kad tim/gost prijavi prevremeni odlazak) definiše M5, ne ovde — M3 samo čuva pravilo, isti obrazac kao za `PRE_ARRIVAL`.

### 2.6 `AncillaryService` — pomoćni troškovi/usluge po periodu (dopuna v1.12)

Analiza stvarnih cenovnika (avgust 2026) otkriva veliku raznolikost pomoćnih troškova koje dobavljači navode uz osnovnu cenu smeštaja — kućni ljubimac, parking, rani check-in/kasni check-out (viđeno **kao procenat noćne cene, ne fiksan iznos** kod pojedinih dobavljača), room service flat fee, povratni sigurnosni depozit, iznajmljivanje bicikla/skija, pranje veša, korišćenje bilijara, itd. Umesto fiksnog polja po svakom tipu troška (što bi zahtevalo novu izmenu specifikacije za svaki novi tip koji se pojavi kod sledećeg dobavljača), `AncillaryService` je generički red — isti obrazac kao `age_pricing[]` (poglavlje 2.4a), gde se raznolikost rešava strukturom podataka, ne brojem polja.

| Polje                      | Tip                                                                                                                                     | Napomena                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                         | UUID (PK)                                                                                                                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| contract_period_id         | UUID (FK → ContractPeriod)                                                                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| name                       | string                                                                                                                                  | naziv usluge/troška tačno kako ga zove dobavljač (npr. "Kućni ljubimac", "Parking", "Rani check-in") — slobodan tekst, bez fiksnog enum-a tipa troška                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| kind                       | enum: `SURCHARGE`, `DISCOUNT`                                                                                                           | **dopuna v1.13** — ista struktura nosi doplatu i popust. Nije spojeno iz štednje nego zato što se u stvarnim cenovnicima javljaju u istom obliku: „doplata za treću osobu" i „popust za treću osobu" imaju istu osnovu obračuna, isti uslov po sastavu gostiju i isti način plaćanja — razlikuje ih samo znak. `DISCOUNT` umanjuje cenu, `SURCHARGE` je uvećava; iznos se u oba slučaja upisuje kao **pozitivan broj**, znak nosi `kind` (negativan iznos uz `DISCOUNT` bi bio dvostruka negacija i prva greška u obračunu). **Razlika u odnosu na `PricelistOffer` (poglavlje 2.4b):** tamo je akcija sa sopstvenim prozorom prijave (rani buking, „6=5") koja se odnosi na celu rezervaciju; ovde je stavka cenovnika vezana za sastav gostiju/sobu. Dva različita mehanizma, namerno se ne spajaju. |
| pricing_mode               | enum: `FLAT_PER_UNIT`, `PERCENTAGE_OF_NIGHTLY_RATE`                                                                                     | dopuna v1.12 — potvrđeno da dobavljači koriste oba (npr. depozit je uvek fiksan iznos, dok je rani check-in kod pojedinih dobavljača procenat noćne cene sobe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| flat_amount                | integer, nullable                                                                                                                       | **samo za `FLAT_PER_UNIT`**, u najmanjoj jedinici valute ugovora (poglavlje 2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| percentage_of_nightly_rate | decimal, nullable                                                                                                                       | **samo za `PERCENTAGE_OF_NIGHTLY_RATE`** — procenat od `RateLine.price` te sobe/perioda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| price_basis                | enum: `PER_PERSON_PER_NIGHT`, `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_STAY`, `PER_ROOM_PER_STAY`, `PER_PET_PER_NIGHT`, `PER_PET_PER_STAY` | **dopuna v1.13, zamenjuje `unit`** (v1.12). Stari enum je mogao da kaže „po osobi" ILI „po danu", ali ne **„po osobi i danu"** — a vlasnik je potvrdio da su sve četiri kombinacije stvarne. Osnova je zato jedan **par**, ne dva odvojena pojma; ista imena kao `SearchResultOffer.price_basis` u M5 §3.0b.2, da isti pojam ne nosi dva naziva u dva modula. `PER_PET_*` je zadržan iz v1.12 jer ljubimac nije ni osoba ni soba. **Migracija:** `PER_NIGHT`/`PER_DAY` bez naznake na šta se odnose ne postoji više — postojeći redovi se prevode ručno, uz ugovor u ruci, jer podatak koji nedostaje (osoba ili soba) nije izvodljiv iz zapisa.                                                                                                                                                       |
| covers_persons             | integer, nullable                                                                                                                       | **dopuna v1.13, samo za `PER_ROOM_*` osnovu** — za koliko UKUPNO osoba važi iznos po sobi. Bez ovoga se cena po sobi ne može proveriti prema stvarnom sastavu gostiju: „doplata za sobu 20 EUR" ne znači ništa dok se ne zna da li pokriva dvoje ili četvoro. `null` za osnovu po osobi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| max_adults                 | integer, nullable                                                                                                                       | **dopuna v1.13, samo za `PER_ROOM_*`** — najviše odraslih unutar `covers_persons`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| max_children               | integer, nullable                                                                                                                       | **dopuna v1.13, samo za `PER_ROOM_*`** — najviše dece unutar `covers_persons`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| child_max_age              | decimal, nullable                                                                                                                       | **dopuna v1.13** — do kog uzrasta se gost broji kao dete za ovu stavku. Isti `X,99` zapis kao M2 `age_policy[].age_to` (M2 poglavlje 2.3b) i iz istog razloga: ceo broj kao gornja granica je dvosmislen. Namerno **sopstveno** polje, a ne oslanjanje na `age_policy` sobe — dobavljači u praksi daju različitu granicu za doplatu nego za kapacitet (soba računa dete do 12, doplata za ležaj važi do 7).                                                                                                                                                                                                                                                                                                                                                                                            |
| payable                    | enum: `AGENCY`, `ON_SITE`                                                                                                               | **dopuna v1.13 (vlasnikova odluka)** — gde se stavka plaća. `ON_SITE` iznos **ne ulazi u ukupnu cenu aranžmana u TT-u** (M5 §6.7a) jer ga agencija nikad ne naplati ni ne isplati — ali mora biti **jasno odštampan u ugovoru sa klijentom (M20) i na vaučeru (M5 §6)**, da gost na licu mesta ne bude iznenađen. Prećutan `ON_SITE` trošak je najbrži put do reklamacije.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| is_mandatory               | boolean                                                                                                                                 | `true` = trošak se automatski dodaje svakoj rezervaciji ovog perioda (npr. obavezna taksa za uslugu vodiča); `false` = opcion, gost/agent ga bira                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| is_refundable              | boolean                                                                                                                                 | `true` = trošak se vraća pod određenim uslovom (tipičan slučaj: sigurnosni depozit) — sam uslov vraćanja ostaje slobodan tekst u `notes`, nema strukturiran model za to u ovoj verziji                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| max_quantity               | integer, nullable                                                                                                                       | ograničenje (npr. "1 ljubimac po sobi") — `null` = bez ograničenja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| notes                      | text, nullable                                                                                                                          | slobodan tekst za uslove koje ne pokriva struktura gore (npr. ograničenje rase/težine ljubimca, koji sati važe za rani check-in)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| created_at / updated_at    | timestamp                                                                                                                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

~~**Namerno van obima ovde:** da li se `AncillaryService` prikazuje/prodaje gostu kroz M5 tok rezervacije kao opciona stavka, ili služi samo kao interna referenca troška — definiše M5, ne ovde.~~ **Rešeno 3.9.2026 (vlasnikova odluka):** prodaje se gostu — `AncillaryService` postaje **vezana stavka rezervacije** (M5 §6.7a), sa svime što stavka nosi (cena, vaučer, najava dobavljaču, otkazivanje). `is_mandatory = true` stavke se dodaju **automatski** uz matičnu stavku, opcione bira agent. M3 i dalje samo čuva ulazne podatke; obračun i prodaja su M5.

**Stanje implementacije (3.9.2026):** sva polja iz v1.13 su u bazi (migracija `m3_ancillary_v113_m5_linked_items`), u `PUT /contracts/:id/periods/:periodId/ancillary-services` i u panelu (kartica „Dodatne usluge" na periodu ugovora) — uključujući pravilo da je `covers_persons` **obavezan** uz osnovu po sobi. Prodaja kroz rezervaciju je M5 §6.7a, takođe napravljena istog dana.

**Šta ostaje van obima i posle v1.13:** tačan redosled primene kad se na istu stavku odnosi i `AncillaryService` popust i `PricelistOffer` akcija (poglavlje 2.4b) — isti obrazac kao već zabeleženo za dve `PricelistOffer` stavke: M3 čuva ulaz, M5 definiše obračun.

### 2.7 `TouristTaxInfo` — informativni podatak o boravišnoj/gradskoj taksi (dopuna v1.12, na zahtev vlasnika)

**Pravni status ostaje nepromenjen:** boravišna taksa/eTurista prijava je zakonska obaveza smeštajnog objekta (dobavljača) koji direktno prima gosta, ne agencije-touroperatora — ova odluka je doneta avgusta 2026 (`07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 1, `08-SPECIFIKACIJA-M11-COMPLIANCE.md`) i **ostaje na snazi**: Terminal ne prati, ne obračunava niti prijavljuje boravišnu taksu u ime bilo koga.

**Zašto se ipak dodaje ovde:** analiza stvarnih cenovnika (avgust 2026) pokazuje da je boravišna taksa gotovo uvek prisutna kao stavka u dokumentu dobavljača, sa **sopstvenom uzrasnom granicom različitom od granice za popust na cenu sobe** (npr. taksa važi do 12 godina, dok popust na cenu sobe važi do 11,99 ili do 18 godina za istog dobavljača) — i sa različitim tretmanom: nekad je uključena u `RateLine.price` ("Tourist tax is incl."), nekad se plaća na licu mesta mimo agencije, nekad se prevaljuje agenciji kao trošak. Bez mesta da se ovaj podatak zapamti, tim mora da se vraća na originalni dokument dobavljača svaki put kad treba da odgovori gostu/subagentu koliko će stvarno platiti na licu mesta — `TouristTaxInfo` čuva taj podatak **isključivo informativno**, radi tačnog prikaza ukupnog troška, ne kao osnovu za obračun/naplatu/prijavu od strane Terminal-a.

| Polje                   | Tip                                                           | Napomena                                                                                                                                                                                                                                                    |
| :---------------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | UUID (PK)                                                     |                                                                                                                                                                                                                                                             |
| contract_period_id      | UUID (FK → ContractPeriod)                                    |                                                                                                                                                                                                                                                             |
| included_in_price       | boolean                                                       | `true` = taksa je već uračunata u `RateLine.price`, nema dodatnog troška; `false` = plaća se posebno                                                                                                                                                        |
| collected_by            | enum: `PAID_ON_SITE_BY_GUEST`, `INVOICED_TO_AGENCY`, nullable | **samo kad `included_in_price = false`** — ko naplaćuje taksu; `PAID_ON_SITE_BY_GUEST` znači gost plaća direktno objektu, van bilo kog toka kroz Terminal                                                                                                   |
| amount_per_night        | integer, nullable                                             | iznos po noći po gostu koji podleže taksi, u najmanjoj jedinici valute ugovora (poglavlje 2) — informativno, ne generiše obavezu u M10                                                                                                                      |
| currency                | string, nullable                                              | valuta iznosa, ako se razlikuje od `Contract.currency` (potvrđeno da se boravišna taksa ponekad navodi u lokalnoj valuti nezavisno od valute cenovnika)                                                                                                     |
| tax_exempt_max_age      | decimal, nullable                                             | uzrasna granica ispod koje gost ne podleže taksi — **namerno odvojeno** od `M2 room_types[].age_policy[]` i od `RateLine.age_pricing[]`, jer analiza potvrđuje da se ove granice po dobavljaču ne poklapaju; isti `X,99` zapis kao M2 `age_policy[].age_to` |
| notes                   | text, nullable                                                | slobodan tekst za dodatne uslove (npr. "prvih 5 noćenja", "samo za punoletne goste")                                                                                                                                                                        |
| created_at / updated_at | timestamp                                                     |                                                                                                                                                                                                                                                             |

**Ograda:** nijedan endpoint ili tok u M3/M10/M11 ne sme koristiti `TouristTaxInfo` kao osnovu za generisanje fakture, obaveze ili zakonske prijave — polje postoji isključivo da bi tim/gost/subagent imao tačnu informaciju unapred. Ako se u budućnosti pokaže poslovna potreba da agencija ipak posreduje u naplati (npr. dobavljač insistira da agencija naplati taksu unapred u ime gosta), to je nova poslovna odluka koja zahteva reviziju M10/M11 pravnog nalaza, ne tiho proširenje ovog polja.

---

### 2.8 Kapacitet po danu, zatvaranje prodaje i blokade (dopuna v1.15, 8.9.2026, na zahtev vlasnika)

**Zašto ovo postoji.** Do ove verzije `ContractPeriod` (poglavlje 2.3) nosi **jedan** `total_capacity` i **jedan** `units_sold` za ceo period — obično celu sezonu. Sistem je time znao "od 1.6. do 30.9. imamo 20 soba i prodato je 47", ali **ne i koliko je zauzeto baš 14. jula**. Vlasnik je 8.9.2026. potvrdio da dobavljači kapacitet menjaju **često**, i da stop-sale stiže **i kod `FIXED_LEASE`** ("mogu da pošalju stop sale informaciju za sve sobe, ili pojedinačne, za sve termine ili pojedinačne"). Puna analiza, poređenje sa PrimeTravel-om i sa industrijskom praksom (tape chart / inventory grid): `docs/analize/44-PREDLOG-MREZA-KAPACITETA.md`.

**Osnovno pravilo ovog poglavlja: prodato se nigde ne upisuje po danu.** Broj prodatih jedinica za neku noć se **računa** iz M5 rezervacija (`BookingItem.stay_from`/`stay_to`/`unit_count` → `RateLine` → `ContractPeriod`), jer je rezervacija izvor istine; svako duplo vođenje istog broja se pre ili kasnije razidje. Ovo poglavlje uvodi isključivo **autorske** podatke — ono što je neko svesno uneo: koliko kapaciteta imamo tog dana, da li je prodaja otvorena, i šta je izuzeto iz prodaje.

#### 2.8a `CapacityDay` — odstupanje za jedan datum

`ContractPeriod` je već vezan za **jedan** `room_type` (poglavlje 2.3), pa je par (period, datum) dovoljan ključ — nije potrebna posebna dimenzija tipa sobe.

| Polje                     | Tip                                                                                     | Napomena                                                                                                       |
| :------------------------ | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| id                        | UUID (PK)                                                                               |                                                                                                                |
| contract_period_id        | UUID (FK → ContractPeriod)                                                              |                                                                                                                |
| date                      | date                                                                                    | jedan kalendarski dan (noćenje koje počinje tog dana)                                                          |
| capacity_override         | integer, nullable                                                                       | koliko jedinica imamo **tog dana**; `null` = važi `ContractPeriod.total_capacity`                              |
| sale_status               | enum: `OPEN`, `STOP`                                                                    | `STOP` = prodaja je zatvorena za taj dan                                                                       |
| stop_reason               | text, nullable                                                                          | slobodan tekst ("hotel prima grupu", "renoviranje")                                                            |
| stop_source               | enum: `SUPPLIER_EMAIL`, `SUPPLIER_PHONE`, `SUPPLIER_PORTAL`, `PROVIDER_API`, `INTERNAL` | **po čijoj informaciji** je prodaja zatvorena — podatak koji se traži kad nastane spor, pa nije slobodan tekst |
| stop_set_by / stop_set_at | UUID (FK → M1 User) / timestamp                                                         | ko je i kada uneo                                                                                              |
| created_at / updated_at   | timestamp                                                                               |                                                                                                                |

**Zapis nastaje samo kad postoji odstupanje** (lenja materijalizacija) — za period od 120 dana bez ijedne izmene ne postoji nijedan red, i važi ono što piše na periodu. Time se izbegava da unos jednog ugovora generiše desetine hiljada praznih redova koje niko nikad ne pročita. Isti zapis se dodatno materijalizuje pri prvoj rezervaciji koja dotiče taj datum — vidi 2.8c (služi kao red nad kojim se zaključava konkurentna rezervacija).

**Stop-sale je zaseban status, nikad "kapacitet spušten na nulu".** Kod `FIXED_LEASE` (poglavlje 2.3a) agencija je kapacitet već **platila** — hotel može zatvoriti prodaju, ali finansijska obaveza ostaje. Da se stop-sale upisivao kao `capacity_override = 0`, taj podatak bi nestao i obaveza iz `ukupna_fiksna_obaveza` ne bi imala pokriće u podacima. Zato su to dva odvojena polja.

**Stop-sale se primenjuje i na `ON_REQUEST` periode** (koji nemaju kapacitet) — tada znači "ne šalji više upite dobavljaču za ove datume".

**Obim unosa — dve nezavisne dimenzije** (tačno kako je vlasnik opisao):

| Dimenzija | Vrednosti                                                                                                           |
| :-------- | :------------------------------------------------------------------------------------------------------------------ |
| **Šta**   | jedan `ContractPeriod` (jedan tip sobe) **ili** svi periodi istog `Contract` koji pokrivaju te datume (ceo objekat) |
| **Kada**  | jedan datum, raspon datuma, ili ceo period                                                                          |

Sve kombinacije se svode na **isti** zapis po danu — "zatvori sve sobe do kraja sezone" je masovni unos, ne poseban tip zapisa. Time postoji tačno jedno mesto koje treba pročitati da bi se znalo stanje za neki datum.

**Dimenzija „Šta" ima TRI vrednosti, ne dve** (dopuna 9.9.2026, vlasnikov zahtev: _„kada se menja bilo šta u vezi kapaciteta jednog hotela omogućiti multiselect za tipove smeštaja"_). Između „jedan tip sobe" i „ceo objekat" nedostajao je slučaj koji je u praksi najčešći: dobavljač javi da zatvara **dvorevne i trokrevetne**, a jednokrevetne ostavlja. Do ove dopune se to radilo u dva poteza (dva odvojena unosa, dva audit zapisa, dve prilike za grešku) ili grubo — zatvaranjem celog objekta. Zato sve tri radnje nad kapacitetom (stop-sale, `capacity_override`, blokada) primaju **skup** `contract_period_id` vrednosti:

| Vrednost                 | Kako se zadaje                                                          |
| :----------------------- | :---------------------------------------------------------------------- |
| jedan tip sobe           | `contractPeriodIds` sa jednim elementom                                 |
| **izabrani tipovi soba** | `contractPeriodIds` sa više elemenata (novo)                            |
| ceo objekat              | `contractId` — svi aktivni periodi tog ugovora koji pokrivaju te datume |

Jedan poziv i dalje ostavlja **jedan** audit zapis, sa spiskom pogođenih perioda u `context` — inače bi istorija iz 2.8g pokazivala tri odvojena poteza tamo gde je čovek napravio jedan, i ne bi se videlo da su išli zajedno.

#### 2.8g Istorija izmena kapaciteta — ko je, kada i šta promenio (dopuna 9.9.2026)

Vlasnikov zahtev: _„kreirati work flow u /kapaciteti kako bi se videlo koje su promene na kapacitetima rađene, kada i ko ih je radio."_ Potvrđeno istog dana da se traži **hronološka istorija izmena**, ne tok odobravanja — izmena i dalje stupa na snagu odmah, ne čeka ničiju potvrdu.

**Nova tabela se NE uvodi.** Svaka radnja iz 2.8a i 2.8b već upisuje `AuditLogEntry` (M1 §3.8) sa akterom i vremenom — `capacity.sale_stopped`, `capacity.sale_reopened`, `capacity.day_override_set`, `capacity_block.created`, `capacity_block.released`, `capacity_block.converted`, `capacity_block.auto_released`. Isti obrazac je već jednom primenjen za „ceo workflow rezervacije" (M5 §11, `AuditLogService.findByResource`) i ovde se ponavlja umesto da se izmišlja nov mehanizam.

**Šta se dodaje: čitanje, i to pod pravom dozvolom.** Postojeći `GET /iam/audit-log` traži `M1/audit-log/VIEW`, koju imaju samo Vlasnik i Direktor — a kapacitete menjaju Sales Manager i prodajni agent, koji bi tako ostali bez uvida u sopstven posao. Zato nov endpoint `GET /contracting/capacity/history` (§6) stoji pod **`M3/capacity/VIEW`** i vraća isključivo zapise o kapacitetu, sužene na objekat/period i raspon datuma koji su trenutno na ekranu (vlasnikova odluka 9.9.2026).

**Tri pravila prikaza:**

1. **Ime, ne UUID.** Audit zapis čuva `actor_id`; istorija ga razrešava u puno ime iz M1, a sistemske poteze (`auto_released`) ispisuje kao „sistem". Spisak identifikatora ne odgovara na pitanje „ko".
2. **Rečenica, ne naziv akcije.** `capacity.day_override_set` se ispisuje kao „Promenio kapacitet na 8, za 12–19. jul (8 dana)" — podaci za to već stoje u `after_state`, ne treba nov upis.
3. **Istorija se ne prazni i ne menja.** `AuditLogEntry` je append-only na nivou baze (M1 §3.8), pa je ovo pogled bez ijedne radnje nad podacima — nema „obriši zapis", nema izmene.

**Ograničenje koje ostaje, zapisano a ne prećutano:** za radnje nad celim objektom (`contractId`) audit zapis nosi `resource_id = contractId`, a za pojedinačan tip sobe `resource_id = contractPeriodId`. Istorija zato pretražuje oba, plus identifikatore blokada tih perioda. Zapisi stariji od ove dopune, napravljeni pre nego što je `context` počeo da nosi spisak perioda, prikazuju se sa manje detalja — to je posledica toga što se stara istorija ne prepisuje, i tako i treba.

#### 2.8b `CapacityBlock` — izuzimanje iz prodaje bez rezervacije

Držanje kapaciteta za grupu koja **još nije potvrđena** (npr. škola traži 10 soba, treba joj nedelju dana da se izjasni) vodi se kao **blokada**, ne kao rezervacija — vlasnikova odluka 8.9.2026. Razlog: rezervacija bez gosta ušla bi u prihod i u popunjenost, pa bi svaki izveštaj prodaje bio netačan dok grupa ne potvrdi.

| Polje                    | Tip                                     | Napomena                                                               |
| :----------------------- | :-------------------------------------- | :--------------------------------------------------------------------- |
| id                       | UUID (PK)                               |                                                                        |
| contract_period_id       | UUID (FK → ContractPeriod)              |                                                                        |
| date_from / date_to      | date                                    | raspon na koji se blokada odnosi                                       |
| units                    | integer                                 | koliko jedinica se izuzima iz prodaje                                  |
| reason                   | text                                    | **obavezno** — zašto se drži ("grupa OŠ Vuk Karadžić, čeka odluku")    |
| hold_until               | timestamp                               | **obavezno** — do kada blokada važi; vidi pravilo ispod                |
| status                   | enum: `ACTIVE`, `RELEASED`, `CONVERTED` | `CONVERTED` = grupa je potvrdila i blokada je pretvorena u rezervaciju |
| converted_booking_id     | UUID, nullable                          | weak ref → M5 `Booking`, popunjeno kad `status = CONVERTED`            |
| created_by / released_by | UUID (FK → M1 User)                     |                                                                        |
| created_at / updated_at  | timestamp                               |                                                                        |

**`hold_until` je obavezno polje i sistem sam vraća kapacitet u prodaju kad istekne** (`ACTIVE → RELEASED`, automatski, uz upis u audit log). Blokada bez roka je najsigurniji način da kapacitet tiho propadne — neko blokira 10 soba u martu, grupa se nikad ne javi, i sobe stoje do septembra jer ih se niko ne seti. Dva dana pre isteka M3 šalje događaj na Event Bus (`capacity_block.expiring`), koji M18 prikazuje kao signal — isti mehanizam kao alarm za nizak kapacitet (poglavlje 4.3).

**Blokada nikad ne ulazi u M13.** Ne postaje `FactBooking`, ne broji se ni kao prihod ni kao popunjenost — u mreži se prikazuje kao treće stanje pored "slobodno" i "prodato". Zato M13 specifikacija ovom dopunom **nije** menjana: nema novog podatka koji bi u nju ušao.

#### 2.8c Kako se računa raspoloživost, i šta se dešava pri istovremenoj rezervaciji

Za jednu noć i jedan `ContractPeriod`:

```
period      = onaj čiji booking prozor obuhvata datum prijave   (dopuna v1.20, poglavlje 2.3e.4)
kapacitet   = CapacityDay.capacity_override ?? ContractPeriod.total_capacity
prodato     = Σ BookingItem.unit_count   (potvrđene stavke koje pokrivaju tu noć)
blokirano   = Σ CapacityBlock.units      (status = ACTIVE, datum u opsegu)

razlika     = kapacitet − prodato − blokirano          ← SME biti negativna
za_prodaju  = max(0, razlika)                          ← 0 ako je sale_status = STOP
```

**Dve vrednosti, namerno (vlasnikova odluka 8.9.2026: "prikazati sa minusom ispred").** `za_prodaju` odgovara na pitanje "smem li ovo da prodam" i nikad nije negativna — nula je nula. `razlika` je ono što se **prikazuje** i ona sme da bude negativna: kad dobavljač smanji kapacitet ispod već prodatog (imali 20, prodali 15, hotel nam smanji na 12), stanje je **−3** i to mora da se vidi kao minus, ne kao nula. Nula bi značila "puno, u redu je"; minus znači "tri gosta nemaju gde, neko mora da reaguje danas". Prikaz je opisan u M17 §4b.2, ne ovde.

**Negativno stanje ne blokira ostatak sistema:** prodaja za taj datum prosto staje (`za_prodaju = 0`), postojeće rezervacije se **ne diraju** i ne otkazuju automatski — koja rezervacija se premešta ili menja je ljudska i poslovna odluka, nikad sistemska. M3 samo prikazuje stanje i javlja (`capacity_oversold` na Event Bus → M18 signal `CAPACITY_OVERSOLD`, `CRITICAL`).

**Konkurentnost.** Provera "ima li mesta" pomera se sa perioda na **dan**: rezervacija koja pokriva N noćenja mora, unutar iste transakcije, zaključati `CapacityDay` red za svaku od tih noći (materijalizovati ga sa podrazumevanim vrednostima ako ne postoji), pa tek onda upisati stavku. Zaključani red je time i mesto odstupanja i brava — bez novog "brojača prodatog" koji bi duplirao rezervacije. **[ISPRAVLJENO u v1.21 pri implementaciji — ovaj plan ne može da radi u stvarnom M5 toku, jer između rezervacije i upisa stavke stoji poziv spoljnom provajderu; vidi 2.8f]** Postojeći e2e test paralelnih zahteva (poglavlje 7) mora nastaviti da prolazi, sada na dnevnom nivou.

`ContractPeriod.units_sold` **ostaje** i dalje se uvećava, ali više **nije** merodavna provera kapaciteta — služi upozorenju pred rok povrata (poglavlje 4.1) i alarmu za nizak kapacitet (poglavlje 4.3), gde je zbir po periodu tačno ono što treba. Ovo je svesno zadržana redundansa na nivou perioda; po danu izvor istine ostaje izračun iznad.

#### 2.8d Šta ovo znači za M5 i M2

- **M5 se ne menja u pozivu.** `POST /contracts/:id/periods/:periodId/reserve` (poglavlje 6) ostaje isti endpoint sa istim ulazom; unutra sada radi dnevnu proveru umesto periodne. Granica modula ostaje netaknuta — M5 i dalje ne zna ništa o `CapacityDay`.
- **Odbijanje dobija razlog.** Odgovor na neuspelu rezervaciju razlikuje "nema slobodnih jedinica", "prodaja je zatvorena za taj datum" i "kapacitet je blokiran" — M5 tu poruku prosleđuje agentu, jer su to tri različite situacije sa tri različita nastavka.
- **M2 ostaje nepromenjen** — katalog i dalje ne drži ni cenu ni kapacitet (poglavlje 3), samo ih čita kroz M3 API.

---

#### 2.8e Kontrolni presek — dva brojača istog podatka moraju da se slažu (dopuna v1.19, 8.9.2026)

Poglavlje 2.8c svesno zadržava redundansu: `ContractPeriod.units_sold` postoji uz izračun po danu. Redundansa je opravdana (zbir po periodu je tačno ono što treba upozorenju pred rok povrata i alarmu za nizak kapacitet), ali nosi poznatu cenu — dva broja koja opisuju istu stvar pre ili kasnije se raziđu.

**Ovo nije teorijska bojazan, već se desilo.** 8.9.2026, pri prvom prikazu mreže nad mock podacima, ekran ugovora je prikazivao „0 od 12 prodato" dok je mreža istog perioda prikazivala prodate dane — mock je upisivao rezervacije, ali nije uvećavao `units_sold`. Uzrok je ispravljen, ali mogućnost razilaženja nije uklonjena, jer je redundansa namerna.

**Dnevna tiha provera** (planiran posao, jednom dnevno, van radnog vremena): za svaki aktivan `ContractPeriod` uporediti `units_sold` sa zbirom potvrđenih `BookingItem.unit_count` koji pripadaju tom periodu. Kad se raziđu, emitovati `capacity_counter_drift` na Event Bus → M18 signal `CAPACITY_COUNTER_DRIFT`, `severity = WARNING`, sa oba broja u telu signala.

**Provera ne ispravlja podatak sama.** Razilaženje može značiti i grešku u brojaču i grešku u rezervacijama, i tiho „ispravljanje" na jednu stranu bi uništilo trag koji je jedini način da se nađe uzrok. Sistem javlja; čovek gleda.

### 2.9 Isti hotel iz više izvora — vrste izvora i zabrana njihovog mešanja (dopuna v1.19, 8.9.2026, na zahtev vlasnika)

**Šta je potvrđeno.** Vlasnik je 8.9.2026. potvrdio da se **isti hotel nabavlja od više dobavljača istovremeno**, i da pored direktnih ugovora postoje i API konekcije koje same povlače kapacitet i raspoloživost, dok se **kod nas beleže prodati kapaciteti**. Poglavlja 2.8a–2.8d opisuju svet u kom je kapacitet uvek naš i uvek autorski; ovo poglavlje uvodi drugu vrstu izvora, kod koje to ne važi.

#### 2.8f Zašto ipak postoji dnevni brojač — ispravka pretpostavke iz 2.8c (dopuna v1.21, 8.9.2026, pri implementaciji)

Poglavlje 2.8c je predvidelo da se konkurentnost reši **bez ijednog novog brojača**: rezervacija zaključa `CapacityDay` red za svaku noć „unutar iste transakcije", pa upiše stavku. Pri implementaciji se pokazalo da taj plan **ne može da radi u stvarnom M5 toku**, i to iz razloga koji nema veze sa M3.

**Šta ne valja u planu.** U `confirm()` (M5 §4) između rezervacije kapaciteta i upisa `BookingItem`-a stoji poziv **spoljnom provajderu** (M4 `confirmBooking`) za API stavke iste ponude. HTTP poziv se ne sme držati unutar otvorene DB transakcije — spoljni sistem koji odgovara deset sekundi držao bi zaključan red i blokirao svaku drugu prodaju tog hotela. A brava koja se pusti **pre** upisa stavke ne štiti ni od čega: drugi agent u međuvremenu pročita stanje u kom prva rezervacija još ne postoji, i oba prođu za istu poslednju sobu.

**Šta je urađeno umesto toga.** `CapacityDay` dobija `units_reserved` — brojač zauzetih jedinica za tu noć, koji se uvećava **istom naredbom koja proverava raspoloživost** (uslov je u `WHERE`, pa je provera i brava u jednom potezu), i simetrično umanjuje pri oslobađanju i otkazivanju.

**Pravilo iz 2.8c i dalje važi tamo gde je bitno:** prikaz — mreža, izveštaji, sve što čovek čita — i dalje **računa prodato iz `BookingItem`-a**, nikad iz ovog brojača. `units_reserved` je **brava, ne izvor istine**. Time ostaje ispunjen razlog zbog kog je pravilo i napisano (da se prodato ne vodi na dva mesta i ne razidje), a rešava se problem koji pravilo nije predvidelo.

**Zatečeni podaci nisu izgubljeni.** Red za neki datum nastaje lenjo, a pri prvom nastanku uzima **početnu vrednost iz postojećih rezervacija** za tu noć. Rezervacije napravljene pre ovog koda su time uračunate, bez posebne migracije podataka.

**Razilaženje brojača i stvarnih rezervacija hvata provera iz 2.8e** — ista ona koja poredi `units_sold` sa zbirom po danima. Ovo je drugi par brojeva koji opisuje istu stvar, pa ista provera pokriva i njega.

#### 2.9a Tri vrste izvora, sa različitim vlasništvom nad brojem

| Vrsta izvora                                       | Ko je vlasnik broja                      | Sme li se menjati kod nas                 | Gde živi                                      |
| :------------------------------------------------- | :--------------------------------------- | :---------------------------------------- | :-------------------------------------------- |
| **Naš ugovor** (`FIXED`, `CHARTER`, `FIXED_LEASE`) | mi — ugovorili smo ga i upisali          | da (poglavlje 2.8a)                       | `ContractPeriod` + `CapacityDay`              |
| **API izvor** (bed bank, channel manager, portal)  | dobavljač — mi samo pitamo i prikazujemo | **ne** — samo naša zabrana prodaje (2.9d) | M4, `AvailabilityQuote`, nikad trajno kod nas |
| **Na upit** (`ON_REQUEST`)                         | niko — broja nema                        | samo stop-sale ("ne šalji više upite")    | `ContractPeriod` bez kapaciteta               |

**Ova tri se na ekranu nikad ne prikazuju kao ista vrsta broja.** Svaki red mreže obavezno nosi vidljivu oznaku izvora; kod API izvora uz broj stoji i **vreme poslednjeg odgovora**. Razlog je operativni, ne estetski: broj iz našeg ugovora važi dok ga neko ne promeni, a broj sa API-ja važi možda još nekoliko minuta. Kad izgledaju isto, čovek ih čita isto — i prodaje po podatku koji više ne postoji.

#### 2.9b Šta se kod nas beleži, a šta nikad

**Beleži se prodato, za sve izvore jednako.** Svaka naša rezervacija je naš dokument, naša marža i naša obaveza prema putniku bez obzira ko je hotel isporučio — M5 `Booking`/`BookingItem` nastaje isto i kod ugovora i kod API izvora (to je već tako, vidi M4 poglavlje 2.1 `BookingConfirmation`).

**Ne beleži se raspoloživost sa API izvora.** Ona se ne prepisuje u `ContractPeriod.total_capacity`, ne materijalizuje u `CapacityDay`, i ne postaje naš kapacitet ni pod kojim uslovom. Ovo je već pravilo M2 (katalog ne drži cenu ni kapacitet, M2 poglavlje 4) i M4 (`AvailabilityQuote` se koristi odmah ili odbacuje, M4 poglavlje 2.1) — ovde se samo izričito proteže na mrežu kapaciteta, jer je mreža prvo mesto na kom bi keširanje delovalo primamljivo.

Za prikaz (ne za prodaju) mreža sme da prikaže **poslednji poznat odgovor** uz obavezno vreme i dugme za osvežavanje. Potvrda rezervacije nikad ne sme da se osloni na taj prikazani broj — pred potvrdu se uvek ide u svež poziv (`checkAvailabilityAndPrice`, M4 poglavlje 2). Odgovor koji je doveo do rezervacije se čuva uz nju kao dokaz (M4 `ProviderCallLog`, poglavlje 3.2) — to je jedini trag kad kasnije nastane spor "vi ste to prodali, a mi nismo imali".

#### 2.9c Formula iz 2.8c ne važi za API izvore — dvostruko oduzimanje

Kod našeg ugovora `razlika = kapacitet − prodato − blokirano` ima smisla jer smo mi jedini koji od tog kapaciteta oduzimaju.

Kod API izvora **nema**. Kad prodamo sobu preko bed banke, njihov sistem je već umanjio svoju raspoloživost — naša rezervacija je u tom broju sadržana. Ako od njihovih „5" oduzmemo naše „3 prodate", dobijemo 2, a stvarno stanje je 5: isti kapacitet je oduzet dvaput i agencija odbija goste bez razloga.

**Pravilo:** za red čiji je izvor API, sistem prikazuje **dva nezavisna broja bez ijedne računske veze**:

```
dobavljač javlja:  5   (odgovor u 09:12)
mi prodali:        3   (naše rezervacije preko ovog izvora)
```

Nikakva `razlika`, nikakav `za_prodaju` izračun. `za_prodaju` za API red je uvek ono što provajder kaže u tom trenutku, umanjeno eventualnom **našom** zabranom (2.9d).

#### 2.9d `SourceSaleRestriction` — naša zabrana prodaje nad tuđim kapacitetom

Stop-sale iz poglavlja 2.8a je prenos **dobavljačeve** informacije nad **našim** kapacitetom. Nad API izvorom to nije moguće — nemamo pravo da menjamo tuđ inventar. Ali potreba da se prodaja zaustavi postoji i tu, i ima realne poslovne razloge (loše iskustvo sa objektom, nerešena reklamacija, dug, privremena odluka uprave).

| Polje                  | Tip                            | Napomena                                                       |
| :--------------------- | :----------------------------- | :------------------------------------------------------------- |
| id                     | UUID (PK)                      |                                                                |
| product_id             | UUID (weak ref → M2 `Product`) | hotel na koji se zabrana odnosi                                |
| provider_code          | string, nullable               | `null` = zabrana važi za **sve** API izvore tog hotela         |
| room_type_code         | string, nullable               | `null` = svi tipovi soba                                       |
| date_from / date_to    | date, nullable                 | `null`/`null` = bez vremenskog ograničenja, do ručnog skidanja |
| reason                 | text                           | **obavezno** — piše se agentu na ekran, ne samo u dnevnik      |
| status                 | enum: `ACTIVE`, `LIFTED`       |                                                                |
| created_by / lifted_by | UUID (FK → M1 User)            |                                                                |
| created_at / lifted_at | timestamp                      |                                                                |

**Na ekranu se zove „naša zabrana", nikad „zatvoreno".** To su dve različite činjenice sa dva različita nastavka: „zatvoreno" znači da hotel nema mesta i nema se šta uraditi; „naša zabrana" znači da mi ne prodajemo iako mesta ima, i neko je sme skinuti. Prikaz koji ih izjednačava tera agenta da zove dobavljača bez potrebe.

Zabrana se **ne šalje dobavljaču** — nema tok koji bi naše ograničenje gurnuo u tuđ sistem, i ne pretvara se u to. To je isključivo naša odluka o sopstvenoj prodaji.

M5 mora da je poštuje pri sastavljanju ponude i pri potvrdi rezervacije, istim mehanizmom kojim poštuje stop-sale iz 2.8a (razlog odbijanja: „naša zabrana prodaje", treći slučaj pored dva iz poglavlja 2.8d).

#### 2.9e Zbir po hotelu se računa samo preko naših ugovora

Mreža prikazuje red „ukupno u hotelu". Taj zbir obuhvata **isključivo naše ugovorene kapacitete**, a API izvori se ispod njega navode pojedinačno, bez sabiranja.

Razlog: alotman od 10 soba kod dobavljača A i „ima 5" kod dobavljača B mogu biti **iste fizičke sobe**, ponuđene na tržištu dva puta. Zbir „15" bi bio izmišljen broj koji izgleda kao merenje. Isti razlog važi i za dva naša ugovora sa preklapajućim datumima (star ugovor do 30.6., nov od 1.7. — ali sa preklapanjem od nedelju dana): zbir se računa, ali se uz njega prikazuje upozorenje kad ugovoreni zbir za jedan datum pređe **fizički broj jedinica objekta**, ako je taj podatak poznat iz M2.

**Upozorenje, ne zabrana.** Preklapanje je ponekad namerno (prelazak sa dobavljača na dobavljača, rezerva za grupu), pa sistem na njega skreće pažnju i ne sprečava ga.

#### 2.9f Uparivanje je preduslov za sve iznad

Ceo hotel-first prikaz (M17 poglavlje 4b) stoji na pretpostavci da sistem **zna** da su „Hotel Splendid", „SPLENDID CONFERENCE & SPA" i provajderova interna šifra jedan te isti objekat. Ako to ne zna, ekran prikazuje tri hotela umesto jednog i lošiji je od stanja bez njega.

**Naš katalog (M2 `Product`) je gazda.** Svaki izvor nosi svoju spoljnu šifru koja pokazuje na naš proizvod: kod ugovora to je već `Product.source_contract_id` (poglavlje 3), kod API izvora to je `ProviderProductMapping` (M4 poglavlje 3.3, dodato istom dopunom). Isto važi i za tipove soba, gde je posao teži (`ProviderRoomTypeMapping`).

**Nikad automatsko uparivanje po sličnosti naziva.** „Splendid Palace, Rim" i „Splendid, Bečići" su po tekstu vrlo slični i po suštini nepovezani. Nemapiran ulaz ide u red za ljudski pregled (M4 poglavlje 3.3), ne u nagađanje.

#### 2.9g Isti hotel, lošija soba, niža cena — to je drugi tip sobe, ne ista soba jeftinije

Vlasnik je 8.9.2026. potvrdio da je moguće da jedan dobavljač ima u zakupu **slabije sobe po nižoj ceni** (druga zgrada, bez pogleda, stariji nameštaj), i da toga u dosadašnjoj praksi nije bilo, ali da je izvodljivo.

Ovo direktno ugrožava pravilo iz poglavlja 2.10 (prodaja po najnižoj ceni): ako se slabije sobe vode kao **isti** tip sobe kao dobre, one po ceni sistematski izbijaju na prvo mesto, prodaje se uvek slabija soba, i posledica je niz reklamacija koje niko ne ume da poveže sa uzrokom.

**Pravilo: cene se upoređuju isključivo unutar istog mapiranog tipa sobe.** Ako se soba stvarno razlikuje po onome što gost dobija, ona je **poseban tip sobe** u M2 katalogu, sa sopstvenim nazivom i opisom, i stoji pored bolje kao zasebna ponuda. Gost tada bira jeftinije svesno.

Ovo je operativno pravilo uparivanja iz 2.9f, ne posebna funkcija: čovek koji upari „Standard Annex" na „Standard" umesto na nov tip sobe pravi upravo ovu grešku, pa ekran za uparivanje mora da ponudi „ovo je nov tip sobe" kao ravnopravnu opciju, ne kao izuzetak sakriven u dnu.

---

### 2.10 Redosled izvora pri prodaji — najniža cena, uz ručni prioritet (dopuna v1.19, 8.9.2026, vlasnikova odluka)

**Vlasnikova odluka, doslovno:** _"Treba omogućiti ručno podešavanje prioriteta od kog dobavljača ćemo prodavati, ali osnovni filter je najniža cena, jer to tržište traži."_

Ovim se **odbacuje** prethodni predlog ovog dokumenta (prvo `FIXED_LEASE`, pa alotman, pa API) — vlasnik je obrazložio da gost bira po ceni i da bi skuplja ponuda na prvom mestu značila izgubljenu prodaju.

#### 2.10a Kaskada, tim redom

1. **Najniža konačna prodajna cena za gosta** — osnovno pravilo, važi uvek.
2. **Kad su cene u okviru praga jednakosti** (podesivo, podrazumevano 2%) — odlučuje `SupplierPriority` (2.10c).
3. **Zakucavanje po hotelu** — `HotelSourcePreference` (2.10d) nadjačava cenu, uz obavezan razlog vidljiv agentu.

Poređenje se izvodi **samo unutar istog mapiranog tipa sobe** (poglavlje 2.9g).

#### 2.10b Koja cena — prodajna, ne nabavna

Sortira se po **konačnoj ceni koju gost plaća**, posle primene marže, a ne po nabavnoj ceni.

Razlog nije formalan: sa jednim dobavljačem se radi na neto ceni (`commission_model = NET`, poglavlje 2.2b), sa drugim na proviziji (`COMMISSIONABLE`). Nabavna cena tada nije uporediva između izvora, a prodajna jeste — i ona je jedini broj koji gost poredi sa konkurencijom. Sortiranje po nabavnoj ceni povremeno bi proizvelo **skuplju** ponudu za gosta, što je tačno ono što ovo pravilo treba da spreči.

Interno, u istom redu, agent vidi i nabavnu cenu i zaradu — da bi mogao svesno da odstupi. Podatak se ne skriva, samo ne određuje redosled.

#### 2.10c `SupplierPriority` — slab prioritet, radi samo kod izjednačenih cena

| Polje                   | Tip                             | Napomena                                                       |
| :---------------------- | :------------------------------ | :------------------------------------------------------------- |
| id                      | UUID (PK)                       |                                                                |
| supplier_id             | UUID (FK → `Supplier`)          | `null` nije dozvoljen                                          |
| provider_code           | string, nullable                | popunjeno kad je izvor API provajder, a ne ugovoreni dobavljač |
| priority                | integer                         | manji broj = ranije; jedinstven u okviru skupa                 |
| note                    | text, nullable                  | zašto (bolji uslovi plaćanja, manje sporova oko otkaza)        |
| updated_by / updated_at | UUID (FK → M1 User) / timestamp |                                                                |

Ovaj prioritet **nikad ne nadjačava cenu van praga jednakosti.** Ako je razlika veća od praga, jeftiniji izvor pobeđuje bez obzira na prioritet — inače bi pravilo iz 2.10a bilo mrtvo slovo, a niko to ne bi primetio.

#### 2.10d `HotelSourcePreference` — izuzetak po hotelu, sa obaveznim razlogom

| Polje                   | Tip                             | Napomena                                              |
| :---------------------- | :------------------------------ | :---------------------------------------------------- |
| id                      | UUID (PK)                       |                                                       |
| product_id              | UUID (weak ref → M2 `Product`)  | hotel                                                 |
| supplier_id             | UUID, nullable                  | ugovoreni dobavljač koji ima prednost                 |
| provider_code           | string, nullable                | ili API provajder; tačno jedno od ta dva je popunjeno |
| reason                  | text                            | **obavezno**                                          |
| valid_until             | date, nullable                  | `null` = do ručnog skidanja                           |
| created_by / created_at | UUID (FK → M1 User) / timestamp |                                                       |

**Razlog mora biti vidljiv agentu koji prodaje**, na samom redu ponude („prvo Adriatic DMC — sporne reklamacije sa X"), ne samo u dnevniku izmena. Bez toga, za pola godine niko ne zna zašto se jeftinija ponuda ne prikazuje prva, a pravilo nastavlja da radi godinama — to je tačno onaj obrazac "podešavanje koje niko ne razume, a niko se ne usuđuje da ga skine" iz `22-ANALIZA-PRIMETRAVEL-NALAZI.md`.

#### 2.10e Neprodat `FIXED_LEASE` se rešava cenom, ne redosledom

Zakupljene sobe su plaćene, pa je svaka neprodata čist gubitak — dok je neprodata alotmanska soba samo propuštena zarada. To je stvaran problem, ali se **ne rešava skrivenim preuređivanjem redosleda**.

Rešenje je cena: ako fiksni zakup mora da se proda, spušta mu se prodajna cena i on **prirodno** izbija na prvo mesto po istom pravilu koje važi za sve. Vidljivo u brojkama, pošteno prema gostu, bez posebne logike.

Sistem uz to daje **upozorenje, ne preuređivanje**: kad se približava polazak a zakupljeni kapacitet stoji neprodat, javlja se signal da bi čovek svesno odlučio o snižavanju cene (poglavlje 4.5).

#### 2.10f Uslovi otkaza stoje uz cenu

Najjeftinija ponuda ume da nosi uslove koji je čine skupljom (nepovratna, plaćanje odmah, bez povraćaja). Takva ponuda **zadržava svoje mesto u redosledu** — pravilo je cena — ali red obavezno prikazuje uslov otkaza pored cene, a nepovratne ponude nose izričitu oznaku. Podatak već postoji u oba sveta u istom obliku (`CancellationRule`, poglavlje 2.5; `AvailabilityQuote.cancellationPolicy`, M4 poglavlje 2.1), pa nije potrebno ništa novo.

#### 2.10g Gde se ovo izvršava

M3 **čuva pravilo**; sam redosled se primenjuje pri sastavljanju ponude u M5, jer M5 zna maržu i konačnu prodajnu cenu (M5 `MarkupRule`, poglavlje 2.1 te specifikacije). M3 nikad ne računa prodajnu cenu — to bi bilo dupliranje logike marže na dva mesta.

#### 2.10h Napomena — M2 uvodi `ProductSupplierLink`, usklađivanje otvoreno (11.9.2026)

M2 spec (poglavlje 2.1d, v1.29, 11.9.2026, vlasnikov zahtev nad ekranom proizvoda — tab "Cenovnik") uvodi mogućnost da **jedan** M2 `Product` nosi **više** M3 `Contract` zapisa (`ProductSupplierLink`, many-to-many, sa `is_enabled` prekidačem po ugovoru), umesto dosadašnjeg 1:1 `source_contract_id`. Ovo poglavlje (2.10) već rešava "isti hotel od više dobavljača" preko `SupplierPriority`/`HotelSourcePreference`, upoređujući ponude "unutar istog mapiranog tipa sobe" (§2.9g) — pisano bez pretpostavke da jedan `Product` red iznutra nosi više ugovora.

**Otvoreno, ne rešeno u ovom prolazu:** da li `HotelSourcePreference`/`SupplierPriority` treba da čitaju `ProductSupplierLink.is_enabled` pre poređenja (isključen ugovor se ne nudi, bez obzira na cenu), ili ostaju nepromenjeni jer već rade nad ugovorom/dobavljačem direktno, ne nad `Product` redom. Dok se ovo ne odluči, M2 tabovi Cenovnik/Kapacitet i `ProductSupplierLink` endpoint-i ostaju samo specifikacija, bez koda (M2 poglavlje 4.2/9).

---

### 2.11 Cenovnik kao mreža — sezona, dani u nedelji i redosled obračuna (dopuna v1.27, 9.9.2026, na zahtev vlasnika)

Vlasnikov nalaz nad postojećim ekranom za unos cena: _„Previše zbrkano, nedostaju polja… na osnovu toka treba osmisliti logičan i brz ručni unos."_

Uzrok nije bio u modelu nego u **jedinici unosa**. `ContractPeriod` je jedan datumski opseg za jedan tip sobe, pa hotel sa 5 tipova soba i 6 sezona traži 30 zapisa i 30 poseta ekranu. Provera nad **58 stvarnih cenovnika** iz `Primeri cenovnika/` pokazuje da nijedan dobavljač tako ne piše cenovnik — sva tri pročitana oblika (Aycon PDF mreža, Plava Laguna PDF spisak, Solvex Excel) imaju **tipove soba kao redove i sezone kao kolone**.

Mockup ekrana: `04-MOCKUP-UNOS-CENOVNIKA-MREZA.html` (isti folder). Ekrani u panelu: M17 §6d.

#### 2.11a Šta su stvarni cenovnici pokazali (dokaz, ne pretpostavka)

| Nalaz                                                          | Gde je viđen                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sezona ima **više datumskih opsega**, ne jedan                 | Aycon: sezona 1 = 01.04–31.05 **i** 01.10–31.10; Olympic/PRI: sezona A = 12.12–19.12 **i** 14.03–21.03 |
| Osnova cene se **razlikuje od reda do reda** u istom cenovniku | Aycon: sve sobe „per person per day", Deluxe suite „per room per day"                                  |
| Red je **kombinacija popunjenosti**, ne samo tip sobe          | Solvex: „1 Adult + 1 Chd (07-11,99)", „2 Adult + 1 Chd (02-6,99)"                                      |
| Cena **po boravku**, ne po noći                                | Plava Laguna: kolona `Rate Base` = `STAY`                                                              |
| **Dani u nedelji** za dolazak/odlazak                          | Plava Laguna: kolone `S M T W T F S`                                                                   |
| Rok za rezervisanje **≠** period boravka                       | Aycon: „bookings made till 31.12.2025 for period of stay 01.04–30.10.2026"                             |

#### 2.11b `Season` — imenovana sezona sa više opsega

Nov zapis između `Contract` i `ContractPeriod`. Ne zamenjuje `ContractPeriod` — grupiše ga.

| Polje         | Tip             | Napomena                                          |
| ------------- | --------------- | ------------------------------------------------- |
| `id`          | uuid            |                                                   |
| `contract_id` | uuid            |                                                   |
| `code`        | string          | kratka oznaka iz cenovnika: `1`, `A`, `Špic`      |
| `label`       | string?         | opisno ime, opciono                               |
| `rank`        | int             | redosled kolona na ekranu                         |
| `ranges`      | `SeasonRange[]` | **najmanje jedan** opseg (`date_from`, `date_to`) |

Pravila:

- Opsezi **jedne** sezone se međusobno ne smeju preklapati; opsezi **različitih** sezona istog ugovora takođe ne smeju — inače jedan datum pripada dvema kolonama i cena postaje dvosmislena.
- `ContractPeriod` dobija `season_id` (nullable). Period bez sezone i dalje radi — postojeći podaci ostaju ispravni, ovo je dodavanje.
- **Izuzetak po tipu sobe:** ako jedan tip sobe ima drugačiji raspored datuma, njegovi periodi ostaju bez `season_id` i prikazuju se u zasebnom redu sezona iznad svoje grupe. Vlasnikova odluka 9.9.2026: sezone su kolone, ali izuzetak mora biti moguć.
- Na ekranu se u zaglavlju kolone **prikazuju datumi**, ne samo oznaka (vlasnikova odluka).

#### 2.11c `price_basis` dobija četiri vrednosti umesto dve

`PriceBasis` danas ima `PER_ROOM_PER_NIGHT` i `PER_PERSON_PER_NIGHT`. Dodaju se:

- `PER_PERSON_PER_STAY`
- `PER_ROOM_PER_STAY`

Time se izjednačava sa `AncillaryPriceBasis`, koji ta četiri para ima od v1.13. Razlika je bila nenamerna: doplata je od v1.13 mogla biti „po sobi i periodu", a sama cena nije — iako Plava Laguna cenovnik doslovno nosi `Rate Base = STAY`.

Osnova ostaje **osobina reda**, ne ugovora ni perioda — jer Aycon cenovnik u istom dokumentu ima obe.

#### 2.11d Dani u nedelji na cenovnom redu

`RateLine` dobija `valid_weekdays: int[]` (1–7, prazan niz = svi dani).

Vlasnikova odluka 9.9.2026: **dani se biraju kao tagovi, ne kao fiksna podela „radni dani / vikend"** — jer „vikend" nije isti u svakom hotelu (kod njih je to petak i subota; nedelja se ne računa, gost te noći više ne spava).

Posledice:

- Vikend cena je **drugi cenovni red sa drugim danima**, ne nova sezona. Sezona ostaje 5, ne postaje 10.
- Provera pri čuvanju: unutar iste kombinacije (period × tip sobe × usluga × popunjenost) **svi dani moraju biti pokriveni tačno jednom**. Nepokriven dan bi tiho nestao iz pretrage; dvaput pokriven dan daje dve cene za isti datum.

  **Kako je stvarno napravljeno (9.9.2026, v1.32).** Dva dela ove rečenice nemaju istu težinu, pa se ni ne sprovode isto:

  - **Dvaput pokriven dan → odbijanje pri upisu.** Sistem nema način da izabere između dve cene za isti datum; svaki izbor bi bio pogađanje nad novcem. Poruka imenuje dan (`petak`), ne šifru.
  - **Nepokriven dan → upozorenje uz odgovor, ne odbijanje.** Cenovnik se unosi red po red: red „ned–čet" bi po strogom pravilu bio odbijen jer petak i subota još ne postoje, pa se drugi red nikad ne bi ni stigao dodati. Odgovor upisa nosi `daniBezCene` i rečenicu koja se prikazuje na ekranu; posledica ostaje stvarna — boravak koji obuhvata nepokriven dan nema cenu i ne može se ponuditi.

- **Cena boravka se sastavlja po noćima.** Kad kombinacija ima više redova, svaka noć se naplaćuje po redu koji pokriva njen dan u nedelji (subota→subota, 5 × 100,00 + 2 × 140,00 = 780,00). Dan odjave nije noć. Cena `*_PER_STAY` se naplaćuje **jednom**, po redu koji pokriva prvu noć. Pretraga zato vraća **jednu ponudu po kombinaciji**, ne po redu — inače bi isti smeštaj imao dve ponude, jednu po radnoj i jednu po vikend ceni, obe za ceo boravak.
- Time se zatvara i deo talas-2 stavke „rok povrata ograničen na određene dane u nedelji" — isti mehanizam, drugo polje (2.11e).

`ContractPeriod` dobija `arrival_weekdays: int[]` i `departure_weekdays: int[]` (turnusi — subota–subota), plus `allowed_stay_nights: int[]` (7 / 10 / 14). Prazno = bez ograničenja. Provera je M5 posao pri sastavljanju ponude, M3 samo čuva pravilo.

#### 2.11e „Za rezervacije od…do" na svakoj cenovnoj stavci

Vlasnikov zahtev: _„sve stavke cenovnika treba da imaju i ograničenje za rezervacije od…do"_.

Danas to postoji samo na `PricelistOffer` (`booking_from`/`booking_to`) i na `ContractPeriod` (2.3e, ali tamo znači kada kapacitet sme da se troši). Dodaje se `booking_from`/`booking_to` (oba nullable) na:

- `RateLine`
- `AncillaryService`
- `CancellationRule`

Prazno = bez ograničenja. Kad je popunjeno, stavka učestvuje u obračunu **samo ako datum nastanka rezervacije pada u prozor** — isto pravilo koje 2.3e već primenjuje na kapacitet.

#### 2.11f Provizija koju hotel odobrava agenciji — po periodu, ne po ugovoru

`Contract.commission_percentage` (v1.12) je **jedna vrednost za ceo ugovor**. Vlasnik 9.9.2026: _„hotel nam odobrava proviziju 10% u nekom periodu ili 7 u nekom drugom periodu"_.

Rešava se **istim obrascem kao `MarkupRule`** — zaseban zapis sa dometom, ne polje u tabeli:

| Polje                       | Tip                           | Napomena                                             |
| --------------------------- | ----------------------------- | ---------------------------------------------------- |
| `scope_type`                | `SupplierCommissionScopeType` | `M3_CONTRACT` \| `M3_SEASON` \| `M3_CONTRACT_PERIOD` |
| `scope_id`                  | uuid                          |                                                      |
| `percentage`                | decimal?                      |                                                      |
| `fixed_amount`              | int?                          | najmanja jedinica valute                             |
| `active_from` / `active_to` | date?                         |                                                      |

Uže pravilo nadjačava šire. **Zašto obrazac a ne polje:** vlasnik je na pitanje da li se provizija razlikuje i po tipu sobe odgovorio _„za sada samo po periodu, ali ko zna da li će nekada neki hotel i po tipu sobe to da primeni"_. Sa obrascem, taj dan je dodavanje jedne vrednosti u enum; sa poljem, bila bi prepravka svega što ga čita. Cena obrasca danas je nula.

`Contract.commission_percentage` ostaje kao podrazumevana vrednost kad nema nijednog užeg pravila — postojeći podaci se ne diraju.

#### 2.11g Redosled obračuna — pet koraka, ovim redom

**Vlasnikova odluka 9.9.2026.** Ovim se zatvara talas-2 stavka „Interakcija `commission_model` sa M5 `MarkupRule` — da li se markup računa na bruto ili neto cenu".

| #   | Korak                                         | Primer                                    |
| --- | --------------------------------------------- | ----------------------------------------- |
| 1   | Ulazna hotelska cena                          | 55,00                                     |
| 2   | **Popust / akcija** (rani buking, SPO…) −15 % | 46,75                                     |
| 3   | **Provizija koju hotel odobrava nama** −10 %  | 42,08                                     |
| 4   | **Naša marža** +18 %                          | 49,65 ← prodajna cena                     |
| 5   | **Provizija subagenta** 8 % od prodajne       | 3,97 (njegova zarada, ne dodatak na cenu) |

Redosled nije proizvoljan: hotelska provizija se skida sa **već umanjene** cene. Da se skida sa pune, agencija bi obračunala veći odbitak nego što joj hotel stvarno daje, i to bi se pojavilo kao razlika tek pri plaćanju dobavljaču.

Izvršenje ostaje u M5 (2.10g) — M3 čuva pravilo, M5 ga primenjuje. M5 spec §2.1 se dopunjuje u istom prolazu.

**Osnovica provizije subagenta — potvrđeno 9.9.2026.** Na pitanje da li sistem treba da preračuna iznose tako da agencija i subagent dobiju jednako (vlasnikov nalaz: _„kada odobrimo 10% na bruto cenu a mi smo maržirali 20%, nama ne ostane 10%"_ — izmereno: nama 8,00, subagentu 12,00), vlasnik je odlučio: _„Za sada neka ostane da provizija ide na bruto cenu, pa ćemo videti za kasnije."_ Korak 5 iznad time ostaje nepromenjen. Tri razmatrane varijante (podela marže na pola / oba po istom procentu / provizija dodata na maržu) i njihovi izračunati ishodi ostaju u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, jer je nalaz stvaran i vratiće se čim se pojavi subagent sa visokom provizijom.

#### 2.11h Osnovica popusta po osobi

**Vlasnikova odluka 9.9.2026:** popust za 3. i 4. osobu — i svaki drugi popust po osobi — računa se **od ulazne hotelske osnovne cene**.

Ne od cene sobe u kojoj gost leži i ne od cene posle drugih popusta. U cenovnicima stoji samo procenat (Aycon: 0–11,99 → −100 %, 12+ → −50 %), pa bi bez ovog pravila isti cenovnik davao različite iznose zavisno od implementacije.

#### 2.11i Marža i subagentska provizija po pojedinačnoj stavci

Vlasnikov zahtev: _„treba i mogućnost da se svaka stavka maržira u % ili iznosu ili oba u isto vreme"_ i _„ovu doplatu/popust — odobri subagentsku proviziju u % ili iznosu"_.

**Marža:** `MarkupRule` već nosi i `percentage` i `fixed_amount` i oni se **sabiraju** (12 % + 5,00 na 295,00 = 335,40); popunjeno samo jedno znači da je drugo nula. Nedostaje **domet** — `MarkupScopeType` ide do `M3_CONTRACT_PERIOD`, ne do stavke. Dodaju se `M3_RATE_LINE` i `M3_ANCILLARY_SERVICE`.

**Subagentska provizija:** danas postoji samo `Subagent.commission_percentage` i stepenice po prometu (M7). Dodaje se `SubagentCommissionOverride` sa istim scope obrascem, i posebnom vrednošću **„bez provizije"** — potrebna za stavke poput boravišne takse ili doplate koja se plaća u hotelu.

Pravilo prikaza: stavka bez unosa nasleđuje podrazumevano za ugovor; kad se unese, red se **označava kao izuzetak** — inače se kasnije ne zna zašto jedna stavka odstupa.

#### 2.11j Boravišna taksa prelazi iz opisnog podatka u doplatu

**Ovo je jedina prepravka u celoj dopuni.** Sve ostalo je dodavanje.

`TouristTaxInfo` (v1.12, poglavlje 2.7) je **jedan zapis po periodu, jedan iznos, isključivo informativan**. Ne može da opiše ni jedan jedini pročitan cenovnik: Aycon ima **tri uzrasna stepena** (odrasli 1,50 / 12–17,99 → 1,00 / 0–11,99 → 0,50).

Vlasnik 9.9.2026: _„Boravišna taksa je takođe vrsta doplate i ne treba je samo opisno prikazati već treba da uđe u obračun ako je naplaćujemo u agenciji ili na licu mesta (tada se navede i iznos ali ne ulazi u obračun)."_

Taksa se od ove verzije vodi kao `AncillaryService` — struktura koja sve traženo već ima (`is_mandatory`, `payable`, četiri osnove, uzrasni opseg). Ponašanje:

- `payable = AGENCY` → **ulazi u obračun**, u ukupnu cenu i na fakturu.
- `payable = ON_SITE` → **ne ulazi u obračun i ne utiče na fakturisanje**, ali se iznos unosi i **obavezno prikazuje** gostu na ponudi, u ugovoru (M20) i na vaučeru (M5 §6) — vlasnikova formulacija: _„samo obaveštavamo kupca šta treba da plati na licu mesta"_.

Isto pravilo važi za **svaku** doplatu, ne samo za taksu: kolona „plaća se" nije napomena nego prekidač koji odlučuje ulazi li stavka u zbir.

`TouristTaxInfo` se **ne briše** — ostaje za postojeće zapise i za slučaj kad je poznata samo napomena bez iznosa. Nov unos ide kroz `AncillaryService`. Migracija postojećih zapisa je jednokratna i opisana u izlaznom kriterijumu.

#### 2.11k Doplata koja važi za više tipova soba

`AncillaryService` je vezan za **jedan** `contract_period_id`, pa se doplata koja važi za ceo hotel danas unosi onoliko puta koliko ima perioda. Vlasnik traži **obe mogućnosti**: _„popusti i doplate mogu da budu različiti po tipovima smeštaja, a opet mogu da budu i jednaki"_.

Dodaje se isti scope obrazac: `scope_type` = `M3_CONTRACT` \| `M3_SEASON` \| `M3_CONTRACT_PERIOD`, uz opcionu listu `applies_to_room_types: string[]` (prazno = svi). Postojeće veze na period ostaju važeće kao najuži domet.

**Domet mora da važi i u prodaji, ne samo pri unosu (dopuna 9.9.2026, implementacija).** Domet je koristan tek kad ga čita i strana koja prodaje. Zato je provera izdvojena u `pricelist/surcharge-scope.ts` i M5 je zove pri sastavljanju spiska doplata na stavci rezervacije (M5 §6.7a): čita se ceo ugovor, pa se filtrira. Dve stvari koje se lako promaše i obe su tu namerno:

- **Datumski opseg se poredi sa celim boravkom, ne sa jednom noći.** Spisak se pravi jednom za stavku; Novogodišnja večera (31.12) mora da se ponudi za boravak 28.12–03.01. Dan odjave nije noć.
- **Uzrast se pri prikazu NE proverava.** `BookingItem` nosi ime i prezime putnika, ne datum rođenja, a provera po nepoznatom uzrastu bi sakrila boravišnu taksu koju prodavac mora da vidi. Zato je funkcija razdvojena: `vaziPoDometu` (domet, soba, datumi, prozor) i `vaziPoUzrastu` (samo uzrast). Prodaja koristi prvu i prikazuje uzrasni opseg uz stavku; obračun cene za poznatog gosta koristi obe.

U istom prolazu se zatvara talas-2 stavka **„obavezni datumski vezani doplati"** (npr. Novogodišnja večera): `AncillaryService` dobija `applies_from`/`applies_to` — datumski opseg te doplate, različit od `stay_from`/`stay_to` celog perioda.

#### 2.11l Verzije cenovnika

Vlasnik na pitanje šta se radi kad dobavljač pošalje izmenu: _„Moramo sve iz početka, menjamo ono što su oni promenili. AI agent može da vidi šta je promenjeno pa samo to da koriguje."_

Danas postoji gašenje i zamena **pojedinačne** stavke (2.4c: `status` + `replaces_id`), ali ne i pojam verzije cenovnika ni poređenje dve verzije.

Nov zapis `PricelistVersion` (`contract_id`, `version_no`, `effective_from`, `created_by`, `source_import_id?`, `note?`). Pravila:

- Nova verzija **ne briše staru** — stara ostaje, jer rezervacije napravljene po njoj moraju i dalje da se objasne.
- Pri uvozu novog cenovnika sistem **poredi sa prethodnom verzijom** i prikazuje **samo razlike**: izmenjena vrednost (stara → nova), nova stavka, ugašena stavka.
- **Čovek potvrđuje razlike, ne ceo cenovnik.** Deset izmena u cenovniku od dvesta redova znači deset odluka, ne dvesta.
- Postojeće rezervacije ostaju na staroj ceni; nova verzija važi od `effective_from` nadalje. Stavka rezervacije ionako nosi svoju cenovnu liniju kao snimak (M5 §6).

**Napravljeno u v1.33.** Zapis nosi i `snapshot` (ceo cenovnik u trenutku potvrde) i `change_count` (koliko je razlika ta verzija donela), a `note` je dopunjen sa `instruction_text` (§4.8) i `source_import_id` (§4.2). Snimak je obavezan, ne ukras: žive stavke se gase i zamenjuju (§2.4c), pa se posle nekoliko izmena razlika prema prošloj verziji ne može rekonstruisati iz tabela.

**Ključ stavke.** Dve stavke su „ista stavka u dve verzije" ako im se poklapa sve **osim vrednosti**: tip sobe, sezona (po oznaci, ne po `id`-u), pansion, popunjenost, osnova cene i dani u nedelji. Doplata se prepoznaje po imenu, vrsti, dometu, tipovima soba i uzrasnom opsegu — namerno **ne po `id`-u**, jer nov dokument od dobavljača donosi nove zapise iste doplate, pa bi poređenje po `id`-u sve prikazalo kao „ugašeno + novo".

**Četiri pravila primene:**

1. Verzija **bez ijedne razlike se odbija** (400) — istorija bez toga postaje spisak istovetnih snimaka kroz koji se ne može tražiti kada se nešto promenilo.
2. Predlog spolja (§4.2/§4.8) **ništa ne upisuje**. Upisuje tek `primeni`, i to samo ključeve koje je čovek potvrdio; nepotvrđena razlika ostaje na staroj vrednosti i vraća se kao `odbijeno`.
3. Potvrđen ključ kog više nema među razlikama vraća 400 („cenovnik se u međuvremenu promenio"), umesto da se primeni nešto drugo od onoga što je čovek video.
4. Potvrđeno **gašenje** gasi cenovne redove (`status = INACTIVE`), nikad ih ne briše — isto pravilo kao §2.4c.

**Namerna granica.** Doplate i popusti ulaze u snimak i prikazuju se među razlikama, ali se kroz predlog cena **ne menjaju**: predlog nosi samo cenovne redove, a doplata traži osnovu, uzrast, obaveznost i način plaćanja. Menjaju se na svom ekranu (§2.11k), pa se verzija snima posle. Pokušaj da se doplata potvrdi kroz `primeni` vraća 400 sa tim objašnjenjem.

**Ekran.** Kartica „Verzije" na `/ugovori/[id]/cenovnik`: gore spisak razlika prema poslednjoj verziji sa poljem „važi od" i jednim dugmetom, dole istorija verzija. Kad razlika nema, ekran to kaže rečenicom — prazan spisak ovde je dobra vest, ne prazna baza.

**Endpoint-i (§8):** `GET|POST /contracting/contracts/:id/pricelist-versions`, `GET .../razlike`, `GET .../:versionNo`, `GET .../:versionNo/diff`, `POST .../predlog`, `POST .../primeni`. Dozvole su iste kao za ostatak cenovnika (`M3/contract-period` VIEW/EDIT) — ko sme da menja cenu sme i da potvrdi verziju o toj istoj izmeni.

#### 2.11m Tip sobe kao šifarnik

`ContractPeriod.room_type` je slobodan tekst; u šemi stoji „konvencija ka M2 `attributes.room_types[].code`, **ne strogi FK**". Posledica: „DBL" se kuca ručno pri svakom unosu, multiselect nije moguć bez šifarnika, a AI poklapanje je teže nego što mora biti.

Ekran za unos od ove verzije **bira tip sobe iz M2 liste** za taj objekat, uz mogućnost unosa nove vrednosti (dobavljač sme imati tip koji katalog još nema). Polje ostaje string radi kompatibilnosti — menja se način unosa, ne tip podatka. Strogi FK ostaje otvoren dok se ne vidi koliko dobavljača stvarno uvodi tipove van kataloga.

**Napravljeno u v1.41** (10.9.2026), posle merenja koje je pokazalo da posledica nije bila samo nezgodan unos:
`ContractPeriod.room_type` je iz uvoza dobijao **doslovan tekst iz dobavljačevog dokumenta** („Studio A2"), a
`room_types[].code` je automatski generisan broj — dve vrednosti koje se ne poklapaju nikad. M5 zato pri prodaji
sobu nije prepoznavao i uzimao je kapacitet 99, čime se provera kapaciteta tiše isključivala (zamka 7.14).

Tri dela, svaki na svom mestu u toku:

1. **`GET /contracting/contracts/:id/room-types`** — šifarnik za taj ugovor, iz proizvoda vezanih na njega
   (`Product.source_contract_id`). Vraća `code`, `name` i kratak opis kreveta, da se dve slično nazvane sobe
   razlikuju bez otvaranja kataloga. Prazan spisak **nije greška** — znači da objekat još nema unete tipove soba,
   i forma to kaže rečenicom.
2. **Ručan unos perioda** (`PeriodsPanel`) bira iz tog spiska. Ručan upis ostaje moguć jednim klikom, ali sa
   upozorenjem šta gubi — svestan izbor, ne podrazumevani put.
3. **Uvoz cenovnika** poklapa tekst iz dokumenta sa šifarnikom (`room-type-match.ts`, čista funkcija): tačna
   šifra → pun naziv → deo naziva **ali samo kad pogađa tačno jednu sobu**. „Studio" koji odgovara i „Studio A2"
   i „Studio A3" ostaje **nepoklopljen** — dvosmislen slučaj ide čoveku, isti princip kao ograda u §2.4a.

**Odluka čoveka se čuva na REDU UVOZA** (`PricelistImportRow.matched_room_type_code`, migracija
`20260910190000`), ne šalje se uz `primeni`. Razlog je merljiv: ključ razlike (§2.11l) sadrži tip sobe, pa bi
mapiranje poslato tek pri primeni promenilo ključeve u odnosu na one koje je čovek video — potvrdio bi jedno,
primenilo bi se drugo. Endpoint: `POST /contracting/pricelist-imports/:id/tipovi-soba`.

**Ograda pri primeni:** ako je među potvrđenim razlikama tip sobe koji katalog ne poznaje, primena se **odbija**
i poruka nabraja koji su. Proširi je izričito `dozvoliNepoklopljeneTipoveSoba: true` — jer dobavljač SME imati
tip van kataloga, ali takav red u prodaji neće proći proveru kapaciteta, pa to mora biti izbor, ne propuštanje.

#### 2.11n Šta ova dopuna NE menja

- `ContractPeriod` ostaje nosilac kapaciteta. Vlasnikova odluka: **kapacitet se ne prikazuje u cenovniku** jer nije vezan za sezone — može biti definisan na potpuno druge datume. Cena i kapacitet se sreću samo u pregledu iz 2.11o.
- Pravilo iz 2.4c ostaje: ispravka cene je **gašenje pa nova stavka**, nikad prepisivanje.
- Pravilo iz 4.2.4 ostaje: nijedan red se ne upisuje automatski, bez obzira na pouzdanost.

#### 2.11o Kalendar cena i raspoloživosti (pregled, ne unos)

Vlasnikova ideja 9.9.2026: _„jedan kalendar sa mesecima za neki hotel za neki tip smeštaja za neki period pa mi vidimo cenu u kalendaru"_.

Biraju se hotel, tip sobe i **sastav gostiju** (npr. 2 odrasle + 1 dete od 8 godina). Kalendar za svaki dan prikazuje cenu za taj sastav i **koliko je jedinica slobodno** (vlasnikova odluka: samo slobodno, ne „4 od 6").

Vrednost nije u prikazu nego u tome što se **greška vidi golim okom**: pogrešno unet datumski opseg proizvodi skok ili rupu u nizu, što se u mreži ne primeti. Ujedno je to jedino mesto gde se cena i kapacitet sreću, a da se kapacitet ne meša u sam cenovnik.

Ekran: M17 §6d.4. Čita postojeće endpoint-e (`/capacity/grid` + cenovnik), ne uvodi nov zapis.

**Napravljeno u v1.34.** `GET /contracting/contracts/:id/pricelist-calendar` sa parametrima `roomType`, `from`, `to`, `adults` i `childrenAges[]` (godine svakog deteta pojedinačno — „dvoje dece“ nije podatak od kog se može izračunati cena, §2.4a). Odgovor nosi **jedan niz dana po kombinaciji** (pansion × popunjenost), jer jedan tip sobe u istom mesecu ume da ima više cenovnih kombinacija, a ekran ne sme da bira jednu umesto čoveka.

Svaki dan nosi: `cena` (za **jednu noć koja počinje tog dana**), `osnova`, `seasonCode`, `slobodno`, `saleStatus`, `stopReason`, `dolazakMoguc` i `razlog`. `razlog` je ono što ovaj ekran čini korisnim: `VAN_PERIODA`, `NEMA_CENE`, `DAN_BEZ_CENE`, `PROZOR_PRODAJE_ZATVOREN`, `NEMA_CENE_ZA_UZRAST`, `CENA_ZA_BORAVAK`. Dozvola je `M3/contract-period/VIEW` — kalendar ne otkriva nijedan podatak koji se već ne vidi na mreži cena i na ekranu kapaciteta, samo ih spaja u jedan pogled.

---

## 3. Veza sa M2 (Katalog)

Kad se ugovori nova sezona/tip sobe, kreira se (ili se ažurira) odgovarajući `Product` u M2 sa `source_type = CONTRACTED` i `source_contract_id` koji pokazuje na ovaj `Contract`. M2 ne duplira cenu ni kapacitet — to uvek čita iz M3 preko API-ja M3, u trenutku kad je to potrebno (pretraga, rezervacija).

---

## 4. Uloga AI agenta

### 4.1 Upozorenje pred rok za povrat (release)

Kad `release_days_before` period priđe (npr. ostalo je onoliko dana koliko piše u polju), a `units_sold < total_capacity`, agent zadužen za M3 **predlaže** akciju (npr. "vratiti dobavljaču 4 neprodate sobe za period X" ili "tražiti produžetak roka") — ovo spada u nivo **"Predloži pa čovek odobri"** iz poglavlja 7 Master dokumenta, jer povrat kapaciteta dobavljaču je poslovna odluka sa finansijskim uticajem, ne čisto informativna radnja. Agent nikad sam ne šalje potvrdu dobavljaču o vraćanju kapaciteta.

### 4.2 AI uvoz cenovnika (PDF/Excel/scan → strukturirani podaci)

Dobavljači šalju cenovnike u proizvoljnom formatu (PDF, Excel, Word, HTML, email, uključujući skenirane PDF-ove). Umesto ručnog prekucavanja u `ContractPeriod`/`RateLine`, sistem podržava AI-potpomognut uvoz.

#### 4.2.1 `PricelistImport`

| Polje                   | Tip                                                                                         | Napomena                                                                                                                                      |
| :---------------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| id                      | UUID (PK)                                                                                   |                                                                                                                                               |
| supplier_id             | UUID (FK → Supplier)                                                                        |                                                                                                                                               |
| source_file_url         | string                                                                                      | originalni fajl, EU cloud skladište                                                                                                           |
| source_format           | enum: `PDF`, `EXCEL`, `WORD`, `HTML`, `EMAIL`, `SCANNED_PDF`, `PASTED_TEXT`, `IMAGE`, `CSV` | `SCANNED_PDF` i `IMAGE` ne prolaze kroz OCR biblioteku nego idu modelu kao dokument/slika (§4.2.7); `PASTED_TEXT` je tekst bez fajla (§4.2.6) |
| status                  | enum: `PROCESSING`, `READY_FOR_REVIEW`, `COMPLETED`, `REJECTED`                             |                                                                                                                                               |
| created_by / created_at | UUID / timestamp                                                                            |                                                                                                                                               |

#### 4.2.2 `PricelistImportRow` — jedan red = jedna kombinacija hotel/soba/usluga/period/cena

| Polje                                      | Tip                                                          | Napomena                                                                                                                                                                                                                                                                             |
| :----------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                                         | UUID (PK)                                                    |                                                                                                                                                                                                                                                                                      |
| pricelist_import_id                        | UUID (FK)                                                    |                                                                                                                                                                                                                                                                                      |
| extracted_hotel_name                       | string                                                       | tekst tačno kako piše u izvornom dokumentu, pre mapiranja                                                                                                                                                                                                                            |
| matched_product_id                         | UUID, nullable (FK → M2 Product)                             | kandidat pronađen fuzzy-matching-om (poglavlje 4.2.3)                                                                                                                                                                                                                                |
| match_confidence                           | decimal (0–100), nullable                                    |                                                                                                                                                                                                                                                                                      |
| extracted_room_type / extracted_board_type | string                                                       |                                                                                                                                                                                                                                                                                      |
| extracted_occupancy                        | string, dopuna avgust 2026                                   | kandidat za `RateLine.occupancy` (poglavlje 2.4) — nedostajalo u prethodnoj verziji ovog dokumenta iako je `RateLine.occupancy` obavezno polje; ista logika kao `extracted_room_type`/`extracted_board_type`, prolazi kroz isti ljudski pregled pre upisa                            |
| extracted_stay_from / extracted_stay_to    | date                                                         |                                                                                                                                                                                                                                                                                      |
| extracted_price / extracted_currency       | integer / string                                             | u najmanjoj jedinici valute (poglavlje 2) — konvertuje se pri ekstrakciji, čak i ako je izvorni dokument prikazivao cenu sa decimalama                                                                                                                                               |
| extracted_price_basis                      | enum, nullable: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | kandidat za `RateLine.price_basis` (poglavlje 2.4) — `null` dok AI ne prepozna dovoljno pouzdano, ide na ručnu potvrdu kao i svako drugo nepopunjeno polje                                                                                                                           |
| extracted_age_pricing                      | JSONB, nullable                                              | niz kandidata za `RateLine.age_pricing[]` (poglavlje 2.4a) — isti oblik polja (`age_category`, `occupant_index`, `min_adults_present`, `pricing_mode`, `percentage`/`flat_price`), samo označeno kao izvučeno, ne potvrđeno; `null` ako dokument ne sadrži uzrasnu cenu za tu stavku |
| extracted_crib_fee_per_night               | integer, nullable                                            | kandidat za `RateLine.crib_fee_per_night` (poglavlje 2.4)                                                                                                                                                                                                                            |
| review_status                              | enum: `PENDING`, `CONFIRMED`, `MANUALLY_MATCHED`, `REJECTED` |                                                                                                                                                                                                                                                                                      |
| reviewed_by                                | UUID (FK → M1 User), nullable                                |                                                                                                                                                                                                                                                                                      |

#### 4.2.3 Fuzzy-matching i prag pouzdanosti

Ime hotela iz dokumenta se upoređuje sa postojećim M2 katalogom preko Levenštajnove distance, filtrirano po destinaciji i kategoriji (`stars`) radi smanjenja lažnih poklapanja. Redovi sa `match_confidence ≥ 85%` se predlažu kao automatsko mapiranje; ispod praga, red ide na ručno mapiranje (`review_status = PENDING`, bez predloženog `matched_product_id`).

#### 4.2.4 Nivo autonomije — ekstrakcija sme sama, upis cene nikad sam

Ekstrakcija podataka iz dokumenta i predlog mapiranja (`PROCESSING → READY_FOR_REVIEW`) je nivo **"Autonomno"** — čisto informativna priprema, ništa se još ne piše u stvarni `ContractPeriod`/`RateLine`, pa ni pogrešno mapiranje ne utiče na prodajnu cenu. **Kreiranje ili izmena stvarnog `ContractPeriod`/`RateLine` zapisa iz potvrđenog reda** (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) je nivo **"Predloži pa čovek odobri"** — zahteva ljudsku potvrdu (isti nosilac dozvole kao `M3/contract-period/EDIT`, poglavlje 5) pre nego što red postane aktivna cena, u skladu sa principom #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta — greška ovde je direktno pogrešna prodajna cena, ne kozmetika. Ovo pravilo važi identično za osnovna polja (`extracted_room_type`/`extracted_price`) i za nova uzrasna polja (`extracted_price_basis`/`extracted_age_pricing`/`extracted_crib_fee_per_night`, poglavlje 4.2.2) — nijedno se ne upisuje u `RateLine` bez `reviewed_by`.

#### 4.2.5 `SupplierExtractionProfile` — nauči jednom po dobavljaču, koristi ponovo (dopuna, avgust 2026, na zahtev vlasnika)

Isti dobavljač obično šalje cenovnik u istom formatu iz godine u godinu (isti raspored kolona, isti `price_basis`, isti tipičan prag za dete/tinejdžera) — nema razloga da svaki novi `PricelistImport` od istog dobavljača kreće od nule. `SupplierExtractionProfile` čuva **poslednji uspešno potvrđen obrazac** po dobavljaču i AI ga koristi kao polaznu tačku za sledeći uvoz istog dobavljača, isto kao što bi i čovek koji je prošle godine već obradio taj cenovnik znao gde da gleda.

| Polje                    | Tip                                                          | Napomena                                                                                                                                                                                                                                      |
| :----------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                       | UUID (PK)                                                    |                                                                                                                                                                                                                                               |
| supplier_id              | UUID (FK → Supplier), jedinstveno                            | jedan profil po dobavljaču                                                                                                                                                                                                                    |
| typical_price_basis      | enum, nullable: `PER_ROOM_PER_NIGHT`, `PER_PERSON_PER_NIGHT` | iz poslednjeg potvrđenog uvoza                                                                                                                                                                                                                |
| typical_age_thresholds   | JSONB, nullable                                              | poslednje potvrđene uzrasne granice po kategoriji (ne obavezujuće — svaki novi red i dalje prolazi kroz isti `review_status` gejt, ovo je samo predlog koji podiže `match_confidence` kad se poklapa)                                         |
| structure_signature      | JSONB, nullable                                              | otisak strukture izvornog dokumenta (npr. raspored kolona/zaglavlja) korišćen da se proveri da li novi dokument "izgleda isto" pre nego što se profil primeni — tačan mehanizam (hash, lista zaglavlja, embedding) bira se pri implementaciji |
| last_confirmed_import_id | UUID, nullable (FK → PricelistImport)                        |                                                                                                                                                                                                                                               |
| updated_at               | timestamp                                                    |                                                                                                                                                                                                                                               |

**Kako se uči:** profil se **ne** ažurira posebnim koračkom "treniranja" — svaki put kad zaposleni odobri (`review_status → CONFIRMED`/`MANUALLY_MATCHED`) red iz `PricelistImport` za tog dobavljača, sistem tiho ažurira `SupplierExtractionProfile` tog dobavljača potvrđenim vrednostima. Ista akcija koja već postoji (poglavlje 4.2.4), bez novog procesa za zaposlenog.

**Kako se koristi — i ograda protiv tihog pogrešnog mapiranja:** pri novom `PricelistImport` za dobavljača koji već ima profil, AI prvo poredi `structure_signature` novog dokumenta sa sačuvanim. Ako se poklapa — profil se koristi kao polazna vrednost, `match_confidence` izvučenih redova je viši. **Ako se ne poklapa** (dobavljač promenio format), profil se **ne primenjuje** — ekstrakcija ide bez pomoći profila, sa uobičajenom (nižom) pouzdanošću, i `PricelistImport` nosi vidljivu napomenu da sačuvan profil nije iskorišćen jer se struktura promenila. Ovo je namerno konzervativno: stari profil tiho primenjen na promenjen dokument bi pogrešno mapirao kolone, što je gore nego da profila nema.

**Nivo autonomije:** čitanje/upoređivanje profila i predlaganje viših `match_confidence` vrednosti je **"Autonomno"** (ista priprema kao poglavlje 4.2.4) — profil nikad ne menja gejt za upis u `RateLine`, samo poboljšava predlog koji čovek i dalje mora da odobri.

#### 4.2.6 Prvi prolaz implementacije — nalepljen tekst, ne fajl (dopuna 9.9.2026)

Poglavlje 4.2 je od v1.7 stajalo kao specifikacija bez koda: `PricelistImport` je nastajao u statusu `PROCESSING` i tu ostajao, jer je „AI agent učitava dokument" čekao odluku o AI provajderu. **Ta prepreka više ne postoji** — M15 ima radni Anthropic klijent koji već koriste BI terminal, asistent i omnisearch. Ostala je druga, stvarna: **ne postoji skladište fajlova.** `source_file_url` pretpostavlja „EU cloud skladište" koje nije izabrano (ista odluka koju `docker-compose.yml` namerno ostavlja otvorenom).

**Odluka za prvi prolaz: uvozi se NALEPLJEN TEKST, ne fajl.** Dobavljači cenovnike najčešće šalju mejlom, pa je nalepljen sadržaj mejla realan ulaz koji ne traži nijednu novu infrastrukturu. `PricelistImport` zato dobija `source_text` (tekst koji je čovek nalepio) uz postojeći `source_file_url`, i tačno jedno od to dvoje mora biti popunjeno.

**Nov format `PASTED_TEXT`.** Nije ni `EMAIL` ni `HTML` — te vrednosti opisuju _fajl_ tog tipa; ovo je tekst bez fajla, i razlika se vidi u tome što `source_file_url` ostaje prazan.

**Nov status `FAILED` uz `failure_reason`.** Postojeći `REJECTED` znači „čovek je odbio uvoz"; ekstrakcija koja nije uspela je nešto treće i ne sme da se meša s tim — inače se u spisku ne razlikuje „AI nije umeo da pročita" od „mi nismo hteli". Razlog se ispisuje čoveku doslovno, jer je jedini trag zašto uvoz nije dao nijedan red.

**Podela posla između koda i modela** (M15 princip „kod radi najviše posla"):

| Korak                                  | Ko radi | Zašto                                                                                                           |
| :------------------------------------- | :------ | :-------------------------------------------------------------------------------------------------------------- |
| čitanje tabele iz slobodnog teksta     | model   | to je jezik i raspored, ne pravilo — jedini deo koji kod ne može                                                |
| poklapanje hotela sa katalogom (4.2.3) | **kod** | Levenštajnova distanca je deterministična i ponovljiva; model bi isti unos poklapao različito iz poziva u poziv |
| upis `ContractPeriod`/`RateLine`       | **kod** | 4.2.4 — nivo „predloži pa čovek odobri", i to je već sprovedeno                                                 |
| profil dobavljača kao polazna tačka    | **kod** | 4.2.5 — vrednost se čita iz baze i **daje modelu kao nagoveštaj**, ne traži se od modela da je pamti            |

**Model vraća podatke isključivo kroz alat sa zadatom šemom** (tool use), ne kao slobodan tekst koji bi se posle parsirao. Slobodan tekst od modela koji treba pretvoriti u cenu je mesto gde greška ulazi tiho — šema odbija sve što nije broj tamo gde broj mora biti.

**Cena se traži u najmanjoj jedinici valute** (poglavlje 2), i to je izričito u uputstvu modelu: „89,50 EUR" mora postati `8950`. Ovo je najčešća tiha greška pri ovakvom uvozu i zato ide i u uputstvo i u proveru posle njega — red čija cena nije ceo pozitivan broj se odbacuje pre nego što se ikom prikaže.

**Šta prvi prolaz namerno NE pokriva, i to se ne prećutkuje:** učitavanje PDF/Excel fajla i OCR skeniranog dokumenta (čekaju odluku o skladištu), i `structure_signature` iz 4.2.5 (traži bar jedan stvaran ciklus upotrebe da bi se znalo šta je vredno pamtiti — isti razlog kao odlaganje M24 AI agenta).

> **Nadograđeno u §4.2.7 (10.9.2026).** Skladište je odlučeno (lokalni disk), pa učitavanje fajla više nije nepokriveno. `structure_signature` ostaje odloženo iz istog razloga.

#### 4.2.7 Uvoz fajla — lokalni disk, postojeći parser, model za ono što parser ne ume (dopuna v1.36, 10.9.2026, vlasnikova odluka)

§4.2.6 je ostavio dve nepokrivene stvari i naveo razlog za obe: nije bilo odluke gde se fajl čuva, pa nije bilo ni učitavanja fajla ni čitanja skeniranog dokumenta. **Vlasnik je 10.9.2026 odlučio: čuva se na lokalnom disku, za sada.** Time obe padaju odjednom, i to bez ijedne nove biblioteke.

**Skladište: folder na disku, van gita.** Putanja se podešava u `.env` (`PRICELIST_STORAGE_DIR`), podrazumevano `storage/pricelists/`. **Relativna putanja se razrešava prema radnom folderu API procesa (`apps/api/`), ne prema korenu repozitorijuma** — izmereno pri prvom stvarnom uvozu 10.9.2026, jer je prva verzija ovog teksta tvrdila suprotno. Obrazac `storage/` u `.gitignore` hvata folder na bilo kojoj dubini, pa je pokriven i tako (`git check-ignore` potvrđen). `source_file_url` iz §4.2.1 od sada nosi **putanju na disku**, ne URL — ime polja ostaje isto da se ne lomi postojeći zapis, ali sadržaj mu je drugačiji i to se ovde izričito kaže da se ne pročita pogrešno.

**Tri posledice koje se ne prećutkuju**, jer su svojstvo odluke a ne propust:

1. Fajlovi **ne prelaze između mašina** — ne idu na GitHub. Uvoz napravljen na jednoj mašini na drugoj nema svoj original. Sam uvoz i izvučene cene su u bazi i prelaze normalno; nedostaje samo dokaz kako je original izgledao.
2. **Nema rezervne kopije.** Kvar diska znači gubitak originala. Cene se ne gube — one su u bazi.
3. Prelazak na server menja **samo vrednost u `.env`**. Nijedan drugi red koda ne zavisi od toga gde je folder, i tako mora ostati.

**Podržani formati i ko ih čita.** Izvlačenje teksta radi **postojeći `ExtractFileService` iz M15** (`omnisearch/extract-file.service.ts`, M15 §6.5.4.3) — ne pravi se drugi. To je izričita ograda protiv greške iz `docs/analize/22-ANALIZA-PRIMETRAVEL-NALAZI.md` (više modula radi isti posao); ako neka buduća sesija poželi svoj parser cenovnika, odgovor je ovde i glasi ne.

| Format                           | Ko čita                        | Napomena                                                                 |
| :------------------------------- | :----------------------------- | :----------------------------------------------------------------------- |
| `.csv`, `.txt`, `.md`            | M15 `ExtractFileService`       | čist tekst                                                               |
| `.html`, `.htm`                  | M15 `ExtractFileService`       | tagovi se skidaju pre slanja modelu                                      |
| `.xlsx`                          | M15 `ExtractFileService`       | `exceljs`, već u projektu                                                |
| `.docx`                          | M15 `ExtractFileService`       | `mammoth`, već u projektu                                                |
| `.pdf` sa tekstom                | M15 `ExtractFileService`       | `pdf-parse`, već u projektu                                              |
| `.pdf` skeniran                  | **model**, kao `document` blok | `pdf-parse` iz njega vrati prazan tekst — u njemu nema teksta nego slike |
| `.jpg`, `.jpeg`, `.png`, `.webp` | **model**, kao `image` blok    | fotografija ili snimak ekrana cenovnika                                  |

**OCR biblioteka se NE uvodi, i to je izmena tvrdnje iz §4.2.1.** Tamo piše da `SCANNED_PDF` „ide kroz OCR pre parsiranja" — to je bilo tačno kad je pisano, a više nije: model čita PDF i sliku direktno. Nova biblioteka za OCR bi bila zavisnost koja ne radi ništa što već nemamo.

**Kako se bira put, i zašto je to ujedno provera.** Kod **prvo** pokuša izvlačenje teksta postojećim servisom. Ako je rezultat prazan ili kraći od praga koji ne može biti cenovnik (`MIN_KORISNOG_TEKSTA`), fajl se **prebacuje modelu** kao dokument/slika. Jedna odluka pokriva i skenirani PDF i PDF koji je iz bilo kog razloga nečitljiv — bez posebnog pitanja „da li je ovo skenirano", na koje bi se ionako odgovaralo pogađanjem. Prelazak na model se **zapisuje na uvoz** (`extraction_path`), jer je to podatak koji objašnjava i cenu poziva i kvalitet rezultata.

**Jači model samo za ovaj posao (vlasnikova odluka).** Ostali AI pozivi u sistemu ostaju na `LIGHT` tieru. Uvoz cenovnika ide na **Claude Opus 5** (`claude-opus-5`, tier `HEAVY`), jer je čitanje tabele iz skena bitno teže od čitanja nalepljenog teksta, a greška ovde je pogrešna prodajna cena, ne kozmetika. Obrazloženje cene, da se odluka može ponovo proceniti kad se vidi stvarna potrošnja: skeniran dokument troši višestruko više tokena od istog sadržaja u tekstu, a Opus 5 je oko pet puta skuplji po tokenu od Haiku-a. Uvoz cenovnika je redak posao (par puta godišnje po dobavljaču), pa je apsolutni trošak mali; da je ovo poziv koji se dešava na svaku pretragu, odluka bi bila druga. **Cena se knjiži kao i svaki drugi poziv** — red za `claude-opus-5` ulazi u M18 tabelu cena (`agent-invocations/pricing.ts`), poziv u `AgentInvocationLog`, i troši isti EUR budžet iz M18 §6.5. Tvrda dev brava (`ANTHROPIC_DEV_HARD_CAP_EUR`) važi i ovde, jer presreće klijent na jednom mestu.

**Tier se izvodi iz modela koji je stvarno pozvan, ne iz registra agenta.** Zapis `AIAgent` za `PRICELIST_IMPORT_AGENT` nosi svoj `model_tier`, ali on je konfiguracija koja može zaostati za kodom — izmereno 10.9.2026 pri prvom stvarnom uvozu: registar je nosio `LIGHT`, poziv je otišao na `claude-opus-5`, i `AgentInvocationLog` je upisao tier koji se ne slaže sa naplaćenom cenom. M18 §6.5 na tom tieru gradi degradaciju pri prekoračenju budžeta, pa neslaganje nije kozmetika. Zato se u dnevnik upisuje `HEAVY` bezuslovno, a seed istovremeno **ispravlja postojeći** zapis agenta (ne samo novi — idempotentan `upsert` sa praznim `update` bi ga zauvek ostavio na staroj vrednosti).

**Ograničenja koja model nameće, i šta se dešava kad se pređu.** Zahtev ka modelu ne sme preći 32 MB, a PDF ne sme preći broj strana koji model prima. Fajl veći od `MAX_VELICINA_FAJLA` se **odbija pri učitavanju**, sa porukom čoveku šta da uradi (podeli dokument), ne pri pozivu modela — poruka o grešci koja stigne posle poziva je i skuplja i nerazumljivija.

**Šta se NE menja.** Nivo autonomije iz §4.2.4 stoji nepromenjen: ekstrakcija sme sama, upis u `ContractPeriod`/`RateLine` traži ljudsku potvrdu. Provere posle modela iz §4.2.6 (cena ceo pozitivan broj, datumi stvarni) važe identično za fajl kao za nalepljen tekst — ulaz je drugačiji, gejt je isti. `structure_signature` iz §4.2.5 ostaje odložen, iz istog razloga kao ranije.

**Ekran u istom prolazu.** Na postojećem ekranu uvoza (`/cenovnici/novi`) polje za nalepljen tekst dobija ravnopravnu alternativu — učitavanje fajla — sa vidljivim spiskom podržanih formata i ograničenjem veličine. Ovo nije poseban zadatak za kasnije: standing pravilo iz `CLAUDE.md` („logika postoji, UI ne" je nezavršeno) važi i ovde.

#### 4.2.8 Model opisuje kombinaciju jednom, kod je umnožava po periodima (dopuna v1.37, 10.9.2026, na pitanje vlasnika o potrošnji tokena)

Vlasnik je pitao može li se veći deo posla prebaciti sa modela na kod. Merenje nad **stvarnim** cenovnicima iz `Primeri cenovnika/` pokazalo je da može — i da je usput postojao kvar koji se drugačije ne bi video.

**Šta je merenje pokazalo, i koje su dve pretpostavke pale.** Fiksni trošak po pozivu (uputstvo + šema alata) je 1.682 tokena, ali na stvarnom cenovniku **91% cene je izlaz**, ne ulaz — keširanje ulaza, prva stvar na koju se pomisli, ovde skoro ništa ne vredi. Druga pala pretpostavka: snižavanje `effort` sa podrazumevanog `high` na `low` štedi 44 tokena (~4%), dakle model ne troši na suvišno razmišljanje. Treća provera je potvrdila raniju odluku umesto da je obori: `claude-sonnet-5` je na malom primeru dao identičan rezultat 60% jeftinije, ali je na stvarnom cenovniku (Bono 2026) **vratio 20 od 36 redova** — bez ijednog pogrešnog, samo je prestao ranije. Jeftiniji model ovde ne štedi nego gubi cenovnik, pa `HEAVY` iz §4.2.7 ostaje.

**Uzrok troška: model prepisuje isto onoliko puta koliko cenovnik ima sezona.** Cenovnik ima 4 kombinacije (tip sobe × usluga) i 9 sezona; stara šema traži 36 redova, a svaki iznova nosi naziv hotela, tip sobe, uslugu, popunjenost, valutu, cenu krevetca i uzrasnu cenu — menjaju se samo dva datuma i jedan broj.

**Nova podela.** Model vraća **kombinacije** (`hotel` + `room_type` + `board_type` + `occupancy` + valuta + osnova + krevetac + `age_pricing`), a svaka nosi niz `periodi` sa `od`/`do`/`cena`. **Kod ih raspakuje u `PricelistImportRow` zapise** — jedan red po periodu, tačno kao pre. Ovo je najčistiji oblik principa „kod radi najviše posla": čitanje rasporeda iz proizvoljno složenog dokumenta model radi jer kod ne može, a umnožavanje po periodima kod radi jer model ne treba.

**Izmereno nad dva različita dobavljača, isti model (`claude-opus-5`), bez popuštanja u kvalitetu:**

| Cenovnik              | Stara šema               | Grupisana šema | Ušteda izlaznih tokena |
| :-------------------- | :----------------------- | :------------- | :--------------------- |
| Bono 2026 (36 redova) | 0,160 € / 50 s           | 0,054 € / 17 s | 72 %                   |
| Bellevue 2025 (117)   | **0,40 € i nula redova** | 0,139 € / 40 s | 71 %                   |

Kod Bono cenovnika rezultat je **identičan do poslednjeg polja** — 36 redova, nijedne razlike ni u jednom smeru (poređeno po ključu tip sobe + usluga + oba datuma + cena).

**Ozbiljniji nalaz od uštede: veliki cenovnik danas ne radi uopšte.** Drugi red tabele nije greška u merenju. Nad Bellevue cenovnikom stara šema potroši ceo `max_tokens` na prepisivanje istih naziva i bude prekinuta na pola nedovršenog poziva alata — `rows` ostane prazan, uvoz padne, a naplaćeno je punih 0,40 €. Uvoz je zato radio na malim cenovnicima a tiho padao na većim, dok upravo veliki najviše štede ručnog rada.

**Prekid zbog dužine se prijavljuje kao prekid.** Do sad je taj slučaj završavao porukom „AI nije prepoznao nijedan red cenovnika u ovom tekstu" — tačan simptom, pogrešan uzrok, i uputstvo koje čoveka šalje da traži grešku u dokumentu koji je ispravan. Od v1.37 se `stop_reason = max_tokens` prepoznaje i prijavljuje zasebno, sa uputstvom da se dokument podeli. Dva različita uzroka ne smeju da izgledaju isto (isti princip kao razdvajanje `FAILED` od `REJECTED` u §4.2.6).

**`max_tokens` je podignut sa 8.192 na 16.000.** Najveći izmereni cenovnik (117 redova) grupisanom šemom troši 4.648 izlaznih tokena, pa 16.000 nosi zalihu za oko četiri puta veći dokument. Granica ostaje jer beskonačan odgovor nije zaštita ni od čega — ali sada, kad se dostigne, čovek to i sazna.

**Šta se NE menja.** Sve ograde iz §4.2.6 i §4.2.7 stoje netaknute: cena i dalje mora biti ceo pozitivan broj u najmanjoj jedinici valute i proverava se **posle** modela; poklapanje hotela i dalje radi kod (§4.2.3); nijedan `ContractPeriod`/`RateLine` ne nastaje bez ljudske potvrde (§4.2.4). Promenjen je oblik u kom model isporučuje podatke, ne ko o njima odlučuje. Pravilo 6 iz uputstva modelu (`jedan red = jedna kombinacija perioda`) zamenjeno je pravilom da se kombinacija opisuje jednom sa svim svojim periodima — isti cilj (nikad dva zapisa za istu kombinaciju), izražen tako da ga šema sama sprovodi umesto da se na njega podseća rečenicom.

#### 4.2.9 Excel: pokvarene ćelije i katalog koji nije cenovnik (dopuna v1.38, 10.9.2026)

Vlasnik je dopunio `Primeri cenovnika/` sa osam novih Excel cenovnika (ukupno devet `.xlsx`), pa je Excel put prvi put mogao da se **izmeri** umesto da se pretpostavi. Prethodna verzija ovog dokumenta je izričito rekla da to nije mereno jer postoji jedan uzorak — merenje je našlo dve stvari, i nijedna nije bila ono što se očekivalo.

**Očekivana ušteda ne postoji.** Pretpostavka je bila da prazni redovi i kolone u Excel tabelama troše tokene. Izmereno nad svih devet fajlova: čišćenje praznih linija skida **0%**. Pretpostavka je bila pogrešna i tako je zabeležena, umesto da se optimizacija napravi „za svaki slučaj".

**Nađeno umesto toga (1): više od polovine ćelija je stizalo modelu kao `[object Object]`.** `ExtractFileService` je vrednost ćelije prevodio sa `String(v)`, a ExcelJS veći deo ćelija vraća kao **objekat**, ne primitivnu vrednost. Izmereno po fajlu: Solvex **52%**, Iberostar (dva fajla) **49%**, Neptunia 20,5%, Delphin 13,1%, Hilton 8,1%, Liberty 3,2% — u sedam od devet fajlova. Gubilo se tačno ono što nosi značenje:

- `richText` — naziv hotela sa kategorijom („Argisht Palace Aparthotel **3+\***") i crveno istaknuta upozorenja („CHANGE: The Rates are NOT Valid on Czech Market!", „Extras are for arrivals till 17.06 incl.");
- `formula`/`sharedFormula` sa `result` — **izračunate cene**, dakle sam podatak zbog kog se cenovnik uvozi.

Kvar se nije video kao kvar: ni `tsc`, ni build, ni ijedan test ga nisu hvatali, a model bi na mestu cene dobio `[object Object]` i red preskočio ili popunio pretpostavkom. Ispravka je u M15 (`extract-file.service.ts`, v1.51) jer je servis tamo i dele ga oba pozivaoca — **AI chat u panelu je imao isti kvar nad istim fajlovima.** Izmereno posle ispravke: od 50.177 pokvarenih ćelija vraćeno **50.174**; preostale tri su formule bez izračunatog rezultata, gde je prazno tačan odgovor.

**Nađeno umesto toga (2): granica veličine merila je pogrešnu stvar.** `MAX_VELICINA_FAJLA` (25 MB) meri fajl **na disku**, a Excel se pakuje. `014_Solvex_Offer_Summer_2025.xlsx` ima **1 MB na disku** i daje **1,8 miliona znakova** teksta — 946.445 tokena, oko **4,35 € samo za ulaz**, i skoro ceo kontekst modela. Prošao bi kroz postojeću granicu bez reči.

Taj fajl i **nije cenovnik** nego ceo katalog dobavljača: 17 listova po destinaciji (Golden Sands, Sunny Beach, Nessebar…), 966 hotela u listu „Hotel_list". Uvoz takvog dokumenta u jednom prolazu nema smisla ni po ceni ni po ishodu — odgovor bi ionako bio presečen (§4.2.8), jer 16.000 izlaznih tokena nosi oko 390 redova.

Zato postoji **`MAX_ZNAKOVA_TEKSTA` = 100.000**, nad **izvučenim tekstom**, ne nad fajlom. Broj je izveden iz merenja, ne odokativan: najveći izmereni cenovnik **jednog** hotela ima 19.721 znak, pa granica nosi petostruku zalihu, a Solvex katalog hvata dvadeset puta. Prekoračenje se odbija **pre poziva modelu** — inače bi upozorenje stiglo posle naplate — sa porukom koja imenuje stvarnu veličinu i kaže šta da se uradi (podeliti po listu, hotelu ili destinaciji). Ista granica važi i za nalepljen tekst: čovek ume da nalepi ceo katalog jednako kao što ume da ga otpremi.

**Izmereno kroz produkcione endpoint-e, isti dan:** `0F Hotel Liberty S26-vente.xlsx` → **24 reda** za 13 s; provereno prema izvornoj tabeli (`½ DBL + AI | 27.5 | 33 | 38.5` za prva tri perioda) da su upisane cene `2750`, `3300`, `3850` i da se periodi poklapaju. `014_Solvex_Offer_Summer_2025.xlsx` → odbijen za **1 sekundu**, bez ijednog poziva modelu, sa porukom koja navodi 1.802.012 znakova i uputstvom da se podeli.

**Stari binarni formati ostaju nepodržani, i to je odgovor a ne propust.** Među primerima su i `OLYMPIC CENE 2026.xls` i jedan `.doc` — formate koje ni `exceljs` ni `mammoth` ne čitaju pouzdano. Pretvaranje bi tražilo novu biblioteku za format koji je proizvođač napustio pre dvadeset godina; umesto toga se traži da se fajl sačuva kao `.xlsx`/`.docx`.

#### 4.2.10 Uvoz i verzije — jedan put do cenovnika (dopuna v1.39, 10.9.2026, vlasnikova odluka)

Do sada su postojala **dvoja vrata** u isti cenovnik: uvoz dokumenta je upisivao red po red (§4.2.4), a ručna izmena i izmena rečima su išle kroz verzije (§2.11l). `PricelistVersion.source_import_id` je postojao kao polje koje niko ne popunjava. Vlasnik je 10.9.2026 odlučio: **uvoz se zamenjuje, ne dopunjuje** — jedan put, jedno mesto na kom nastaje istorija.

**Predaja rada je ovo procenila kao „čisto povezivanje, bez novih odluka" (`docs/analize/47-...`, §4.3). Procena je bila netačna, i to se ovde zapisuje da se ne ponovi.** Provera koda pre pisanja našla je tri prepreke:

1. **Uvezene cene su za tok verzija bile nevidljive.** Snimak stanja čita samo periode sa sezonom (`seasonId: { not: null }`), a uvoz je pravio period **bez** sezone. Nije se radilo o tome da verzija ne nastaje — uvezena cena nije ulazila ni u jedan snimak.
2. **U mreži cenovnika su se videle samo kao izuzetak.** Period bez sezone ide u listu „bez sezone" i prikazuje broj cenovnih redova, ali nema kolonu (§2.11b, izuzetak po tipu sobe). To pravilo je napravljeno za stvaran izuzetak; kod uvoza je tamo završavao **svaki** red.
3. **Put verzija bi tiho pojeo dečje cene i krevetac.** `writeCell`, kojim `primeni` upisuje, ne prima ni `age_pricing` ni `crib_fee_per_night` — a red-po-red potvrda ih je upisivala. Prosto „povezivanje" bi obrisalo svaku uvezenu uzrasnu cenu bez traga, isti oblik greške kao `[object Object]` iz §4.2.9.

Prodaja pri tom **nije bila pogođena**: M5 čita `season_id` kao opcion, pa su se uvezene cene prodavale ispravno. Problem je bio u pregledu i istoriji, ne u naplati.

**Nov tok.** Uvoz i dalje daje `PricelistImportRow` (§4.2.2, nepromenjeno — ekstrakcija, provere i poklapanje hotela ostaju isti). Umesto potvrde reda po red:

1. `GET /pricelist-imports/:id/razlike` — redovi se grupišu **po ugovoru** (preko `matched_product_id → Product.source_contract_id`), i za svaki ugovor se gradi predlog i uporedi sa zatečenim cenovnikom (§2.11l). Ništa se ne upisuje.
2. Čovek potvrđuje **razlike**, ne redove. To je ono što §2.11l i obećava: „deset izmena u cenovniku od dvesta redova znači deset odluka, ne dvesta".
3. `POST /pricelist-imports/:id/primeni` — primenjuje potvrđene ključeve kroz **isti** `primeni` put koji koristi i izmena rečima, sa `source_import_id` popunjenim. Redovi koji su ušli u primenjenu razliku dobijaju `review_status = CONFIRMED`; ostali ostaju `PENDING` dok se ne potvrde ili odbiju.

**Sezona se izvodi iz datuma, i to je jedina nova odluka u ovom prolazu.** Dokument daje opseg boravka, a predlog traži oznaku sezone. Pravilo:

- ako u ugovoru postoji sezona čiji se **opseg tačno poklapa** sa opsegom iz dokumenta — koristi se ona;
- ako ne postoji — predlaže se **nova sezona**, sa oznakom koja je sledeći slobodan broj u tom ugovoru i opisom koji nosi sam datumski opseg („01.06–30.06");
- nova sezona se **pravi tek pri primeni**, i to samo ako je bar jedna razlika iz nje potvrđena. Predlog i dalje ne upisuje ništa (§2.11l, pravilo 2).

Poklapanje je namerno **tačno**, ne „preklapa se": opseg 01.06–15.06 nije ista sezona kao 01.06–30.06, i tiho svrstavanje u postojeću kolonu bi promenilo cenu za petnaest dana koje niko nije potvrdio.

**Šta predlog od sada nosi.** `PredlozenRedDto` dobija `crib_fee_per_night` i `age_pricing[]`, a `writeCell` ih upisuje. Uz to `age_pricing` ulazi u `detalji` snimka, pa se **izmena samo dečje cene vidi kao razlika** — do sada se ne bi videla, jer se poredila samo cena i krevetac.

**Namerna granica, zapisana:** oznaka sezone iz samog dokumenta („Sezona A", „Špic") se **ne prenosi** — model danas vraća datumske opsege, ne oznake. Nova sezona zato dobija redni broj, a datumi stoje u opisu i u zaglavlju kolone (§2.11b). Kad se pokaže da dobavljači dosledno imenuju sezone, ekstrakcija može da vrati i oznaku; do tada se ne izmišlja.

**Nedovršeno i izmereno — ponovni uvoz istog cenovnika još uvek duplira redove.** Ovo se ne prećutkuje, jer je jedina stvar koja stoji između ovog prolaza i pune vrednosti spajanja.

Popunjenost (`occupancy`) je **slobodan tekst koji vraća model**, a ulazi u ključ stavke (§2.11l). Izmereno nad **istim** dokumentom u četiri prolaza, model je za isti red vratio: `„po sobi"`, `„soba (DBL standard)"`, `„soba"`, `„cena po sobi po noci"`. Pošto se ključ razlikuje, ponovni uvoz prikazuje svaki red kao **„nov + ugašen"** umesto „bez izmena" — a to je tačno ono što spajanje treba da ukine.

Uvedeno je svođenje u kodu (`normalizujPopunjenost`) koje hvata poznate oblike i **rešava sezone u potpunosti** (ponovni uvoz istog dokumenta više ne pravi nove sezone — izmereno: 0 novih), ali formulacija tipa `„cena po sobi po noci"` prolazi kroz svaki razuman spisak sinonima. Zaključak iz merenja: **slobodan tekst ne može biti deo identiteta stavke**, koliko god se svodio.

**Predlog za sledeći prolaz (traži vlasnikovu potvrdu, jer dotiče i M5):** `occupancy` u šemi alata prestaje da bude slobodan tekst i postaje ograničena vrednost — `PO_SOBI` / `PO_OSOBI` — uz odvojeno, opciono polje za stvarnu razliku kad je dokument pravi (`„1 Adult + 1 Chd 07-11,99"`). Ograda tada stoji u **strukturi**, ne u svođenju posle činjenice, po istom principu kao §4.2.8 (šema koja ne dozvoljava pogrešan oblik je jača od uputstva koje na njega podseća).

**Šta ovo znači u praksi do tada:** prvi uvoz cenovnika radi ispravno i potpuno — cene, sezone, dečja cena, krevetac, verzija. Ponovni uvoz **istog** dokumenta za **isti** ugovor prikazaće duple razlike, pa ga do te ispravke treba izbegavati ili pažljivo pregledati.

**Red-po-red potvrda se uklanja** (`POST /pricelist-imports/:id/rows/:rowId/approve`), po vlasnikovoj odluci. Odbijanje pojedinačnog reda (`/reject`) **ostaje** — to nije drugi put do cenovnika nego način da se iz predloga izbaci red koji je AI pogrešno pročitao, pre nego što se razlike uopšte pogledaju.

### 4.3 Alarm za nizak preostali kapacitet

Nezavisno od `release_days_before` roka (poglavlje 4.1, koji je vezan za vraćanje dobavljaču), sistem prati **preostali kapacitet** (`total_capacity − units_sold`) svakog `ContractPeriod` sa kapacitetom (`FIXED`, `CHARTER`, `FIXED_LEASE`) i generiše upozorenje pri svakoj potvrđenoj rezervaciji koja taj broj svede na kritičan nivo:

- **Preostalo = 1 jedinica** → `HealthSignal` tipa `LOW_CAPACITY_CRITICAL`, `severity = CRITICAL` (M18 poglavlje 2.1).
- **Preostalo = 2 jedinice** → `HealthSignal` tipa `LOW_CAPACITY_CRITICAL`, `severity = WARNING`.
- Preostalo > 2 jedinice → bez signala (izbegava se šum na svaku prodaju).

Nivo **"Autonomno"** iz poglavlja 7 Master dokumenta — čisto informativno obaveštenje tima da je period skoro rasprodat, ne menja nijedan podatak niti blokira prodaju (za razliku od M11 tvrde blokade garancije, poglavlje 4.2 te specifikacije, ovo je samo signal, ne ograda). Potvrđeno poređenjem sa PrimeTravel `OperationalReports` obrascem (upozorenje na preostala 1–2 jedinice), vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`.

---

### 4.4 AI agent koji uređuje kapacitete na ljudski zahtev (dopuna v1.17, 8.9.2026, na zahtev vlasnika)

**Šta je traženo:** _"Ovde nam treba i AI agent kom možemo dati mogućnost da na naš zahtev uređuje kapacitete."_ Dakle ne agent koji sam odlučuje šta da zatvori, nego agent kome se kaže — "zatvori prodaju za Splendid, sve sobe, 12–15. jula" ili "smanji Hunguest dvokrevetne na 8 za ceo jul" — i koji to prevede u tačne izmene umesto da čovek klikće po mreži.

**Zašto je to vredno:** unos iz poglavlja 2.8a ima dve dimenzije obima (šta × kada), pa jedna rečenica iz mejla dobavljača ume da znači desetine dnevnih zapisa kroz više perioda. To je posao u kom čovek greši, a mašina ne — ali odluka ostaje ljudska.

#### 4.4.1 Nivo autonomije — čitanje samostalno, izmena uz potvrdu

| Akcija               | Nivo                   | Obrazloženje                                                                  |
| :------------------- | :--------------------- | :---------------------------------------------------------------------------- |
| `capacity.read`      | `AUTONOMOUS`           | čisto čitanje stanja ("koliko je slobodno u Budvi 14.7.") — ništa se ne menja |
| `capacity.stop_sale` | `PROPOSE_THEN_APPROVE` | menja šta se sme prodati; posledica je propuštena prodaja ili preprodaja      |
| `capacity.block`     | `PROPOSE_THEN_APPROVE` | izuzima kapacitet iz prodaje; ista težina kao gore                            |
| `capacity.override`  | `PROPOSE_THEN_APPROVE` | menja ugovoreni kapacitet; može ostaviti goste bez pokrića (poglavlje 2.3d)   |

Potvrdu daje **isti čovek koji je i tražio izmenu**, ne treće lice — isti obrazac kao M21 `help_escalation.create_ticket` (korisnik potvrđuje sopstvenu radnju). Agent Inbox (M15 poglavlje 6) se ovde ne koristi kao red čekanja za tuđe odobrenje; potvrda je korak u samom razgovoru.

#### 4.4.2 Šest ograda, sve obavezne

1. **Agent nema sopstvene dozvole nad kapacitetom.** Izvršava isključivo u ime korisnika koji traži, sa njegovim pravima: ko nema `M3/capacity/CLOSE_SALE` ne može ni preko agenta da zatvori prodaju. Odbijanje je jasno ("nemate pravo za ovo"), ne tiho preskakanje. Isti princip kao M15 poglavlje 5 (sprovedba na nivou koda, ne u promptu).
2. **Pregled pre izvršenja je prebrojan, ne opisan.** Agent prikazuje tačan obim — "3 perioda × 4 datuma = 12 dnevnih zapisa, hoteli: Splendid (Superior, Premium), Budva (Standard)" — i tek posle potvrde piše. Rečenica "zatvoriću ti to za jul" nije pregled.
3. **Nejasan zahtev se pita, ne pogađa.** Dva hotela sa sličnim imenom, datum bez godine, "sve sobe" u ugovoru koji ima i periode van traženog raspona — agent pita, i ne izvršava ništa dok ne dobije odgovor. Nikad delimično izvršenje "onoga što je razumeo".
4. **Sve ili ništa.** Jedan zahtev = jedna transakcija. Ako bilo koji od 12 zapisa ne prođe (npr. period je u međuvremenu ugašen), ne upisuje se nijedan.
5. **Prekoračenje traži drugu, izričitu potvrdu.** Ako izmena ostavlja već potvrđene rezervacije bez pokrića (poglavlje 2.3d), pregled to mora reći **brojem** ("ovo ostavlja 3 gosta bez sobe 14–16.7.") i tražiti zasebnu potvrdu, ne istu kojom se potvrđuje ostatak. Agent nikad ne otkazuje rezervacije, ni na zahtev — to je M5 tok koji radi čovek.
6. **Trag nosi oba imena.** Audit zapis i prikaz na ekranu vode i agenta i čoveka u čije ime je radio (`29-DIZAJN-SISTEM-UI.md` poglavlje 6a, M17 poglavlje 3.1) — "AI agent, po nalogu Marije Petrović". Nikad samo jedno od to dvoje.

#### 4.4.3 Predlog iz mejla dobavljača

Razrađeno u zasebnom poglavlju **4.6** (dopuna v1.19) — isti `PROPOSE_THEN_APPROVE` nivo i istih šest ograda iz 4.4.2, uz tri dodatne koje postoje samo zato što izvor teksta nije naš čovek. Preduslov (M22 još ne dovlači poštu) opisan je tamo.

---

### 4.5 Predlog šta vratiti dobavljaču pred rok povrata (dopuna v1.19, 8.9.2026, na zahtev vlasnika)

Poglavlje 4.1 opisuje **upozorenje** da se rok bliži. Ova dopuna ide korak dalje, na vlasnikovu potvrdu predloga da sistem ne treba samo da izvršava naredbe nego i da skreće pažnju: agent uz upozorenje daje **predlog obima povrata**, sa brojevima na osnovu kojih je do njega došao.

Oblik poruke (sadržaj, ne tačan tekst):

> Sun Resort, DBL, 25–31.07: rok za vraćanje ističe za 3 dana. Prodato 12 od 25.
> U istom periodu prošle godine, na isti broj dana pre polaska, bilo je prodato 19.
> Predlog: vratiti 8 soba.

**Tri obaveze ovog predloga:**

1. **Nikad samo zaključak.** Uz predlog stoje brojevi iz kojih je izveden (prodato, ukupno, tempo, poređenje sa prošlom sezonom ako postoji). Predlog bez osnove se ili slepo prihvata ili slepo ignoriše, a oba su loša.
2. **Kad poređenja nema, to se kaže.** Prva sezona za neki hotel nema prošlogodišnji podatak; agent tada daje predlog na osnovu samog tempa i **eksplicitno navodi** da uporednog podatka nema. Nikad izmišljen broj radi kompletnosti poruke.
3. **Nivo autonomije ostaje `PROPOSE_THEN_APPROVE`**, isti kao 4.1 — povrat kapaciteta dobavljaču je poslovna odluka sa finansijskom posledicom. Agent nikad sam ne javlja dobavljaču.

**Isti mehanizam pokriva i neprodat `FIXED_LEASE`** (poglavlje 2.10e): tu se ne predlaže povrat (nema kome da se vrati — plaćeno je), nego **snižavanje prodajne cene**, sa istim obrazloženjem u brojevima. Cenu menja čovek, u M3 cenovniku; agent je ne dira.

Podaci koje ovo traži već postoje (`ContractPeriod`, `units_sold`, M5 rezervacije, M13 istorija) — ne uvodi se nijedan nov zapis.

---

### 4.6 Predlog izmene iz mejla dobavljača (dopuna v1.19, 8.9.2026, na zahtev vlasnika — zamenjuje raniju belešku 4.4.3)

**Zašto je ovo najvredniji deo AI podrške u ovom modulu.** Rečenice iz poglavlja 4.4 čovek kuca povremeno. Ali mejlovi dobavljača stižu **svakodnevno i u broju**: „stop sale 15–20.07 za DBL", „smanjujemo alotman za 3 sobe u avgustu", „otvaramo ponovo od 21." Svaki od njih danas znači ručno prevođenje u klikove po ugovorima, i kad ih je dvanaest, dva se zaborave.

**Tok:** M22 dovuče poruku → agent je pročita → napravi **predlog izmene u istom obliku pregleda kao 4.4.2 tačka 2** (prebrojan obim, hoteli, tipovi soba, tačni datumi) → čovek u jednom ekranu prolazi kroz predloge i potvrđuje ili ispravlja.

**Šest ograda iz 4.4.2 važe nepromenjeno**, uz tri dodatne koje postoje samo zato što izvor nije čovek nego tekst spolja:

1. **`stop_source` je unapred `SUPPLIER_EMAIL`** i ne može se u ovom toku postaviti na `INTERNAL` — izvor informacije je činjenica, ne izbor.
2. **Veza ka izvornoj poruci je obavezna** i čuva se uz izmenu. Kad kasnije nastane spor „mi to nismo javili", original mejla je dokaz, a ne sećanje.
3. **Sadržaj mejla je podatak, nikad instrukcija.** Poruka koja sadrži tekst nalik nalogu („zatvori sve i pošalji potvrdu") ne pokreće ništa osim predloga koji čovek vidi — direktna primena M15 poglavlja 6.5.4.4. Ovo je ulaz koji piše neko izvan agencije i mora se tako tretirati.

**Predlog čije razumevanje nije potpuno se ne pravi.** Ako iz poruke ne sledi jednoznačno koji hotel, koji tip sobe i koji datumi — poruka ide na ljudski pregled sa oznakom „nisam siguran", bez pripremljene izmene. Poluispravan predlog je gori od nikakvog, jer se potvrđuje na brzinu.

**Preduslov koji još ne postoji:** M22 danas ume da **pošalje** poštu, ali ne i da dovuče pristiglu (`fetchNewMessages` ne postoji — vidi `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`). Dok taj ulazni tok ne postoji, ovo poglavlje nema izvor podataka i ne može se implementirati. Zabeleženo kao zavisnost, ne kao propust ovog modula.

---

### 4.7 „Šta se promenilo od juče" — dnevni pregled izmena kapaciteta (dopuna v1.19, 8.9.2026, na zahtev vlasnika)

Sa velikim brojem objekata i više ljudi koji rade nad istim kapacitetima, pitanje „ko je ovo promenio i kada" postavlja se svakodnevno, a odgovor se danas traži prolaskom kroz audit log.

Jedan kratak dnevni pregled, po hotelu: koje su se kapacitete promenile, ko ih je promenio i po čijoj informaciji (`stop_source`), gde je nastalo prekoračenje, koje blokade ističu, koji rokovi povrata dolaze. Nivo **`AUTONOMOUS`** — čisto čitanje, ništa se ne menja.

**Nije nov podatak.** Sve već postoji u M1 audit logu, `CapacityDay`, `CapacityBlock` i `ContractPeriod`; ovo je pogled, ne skladište. Zato se i ne dodaje nijedna tabela — samo endpoint (poglavlje 6) i mesto u panelu (M17 poglavlje 4b).

---

### 4.8 Izmena cenovnika rečima (dopuna v1.27, 9.9.2026, na zahtev vlasnika)

Vlasnik: _„omogućio bih da AI agent ima sposobnost da mu kažemo šta treba da izmeni kada su manje izmene (ne govorim samo o cenama već i o drugim stavkama cenovnika), da to izmeni, prikaže, sačeka naše odobrenje i primeni izmene."_

Ovo je **drugi ulaz u isti tok**, ne zamena za 4.2. Podela:

| Situacija                                  | Put                                                           |
| ------------------------------------------ | ------------------------------------------------------------- |
| Dobavljač pošalje **ceo nov cenovnik**     | 4.2 — AI čita dokument, poredi sa prethodnom verzijom (2.11l) |
| **Sitna izmena** javljena mejlom/telefonom | 4.8 — AI sluša rečenicu                                       |

Oba završavaju na istom mestu: **spisak razlika koji čovek odobrava red po red**.

Nivo: **`PROPOSE_THEN_APPROVE`** (M15 §4), nikad `AUTONOMOUS`. Nova akcija `pricelist.edit_from_instruction`.

#### 4.8.1 Tok

1. Čovek ukuca rečenicu: _„cene za sezonu 4 i 5 idu gore 5%, rok za otkazivanje alotmana u sezoni 5 je sada 14 dana umesto 10, uvode doplatu za parking 5 € po sobi po noći koja se plaća na licu mesta, rani buking 2. krug se ukida."_
2. Model prevodi rečenicu u **spisak predloženih izmena** kroz alat sa zadatom šemom — isti obrazac kao 4.2.6 i 4.4. Model ne piše u bazu; vraća strukturu.
3. Deterministički kod razrešava na koje tačno zapise se izmena odnosi i **računa nove vrednosti** (procenat se primenjuje kodom, ne modelom — M15 princip: kod radi najviše posla).
4. Ekran prikazuje razlike: _sada 62,00 → postaje 65,10_, nova stavka, ugašena stavka.
5. Čovek odobrava **red po red** (uz „prihvati sve" radi brzine).
6. Primena pravi **novu verziju cenovnika** (2.11l) u jednoj transakciji.

#### 4.8.2 Četiri obavezne ograde

1. **AI ne upisuje ništa.** Upis se dešava isključivo klikom čoveka — isto pravilo koje 4.2.4 već propisuje za uvoz.
2. **Svaka izmena se odobrava posebno.** „Prihvati sve" postoji zbog brzine, ali pojedinačno odbijanje mora biti moguće — inače jedna pogrešno shvaćena rečenica prolazi zajedno sa četrnaest ispravnih.
3. **Rečenica koja je izmenu tražila se čuva uz rezultat** (`instruction_text` na `PricelistVersion`). Bez nje se ne može utvrditi da li je model pogrešno razumeo ili je tako i rečeno — isti razlog zbog kog 4.2.6 čuva `source_text`.
4. **Gašenje, ne brisanje.** Ukinuta stavka se gasi sa datumom (2.4c); rezervacije napravljene dok je važila ostaju objašnjive.

Uz to važe ograde iz 4.4 koje nisu specifične za kapacitet: agent **nema sopstvene dozvole** nego radi pravima korisnika (ko ne sme da menja cene ne može ni preko agenta), pregled pre izvršenja je **prebrojan** a ne opisan, nejasan zahtev se **pita**, nikad ne pogađa, i trag nosi i agenta i čoveka.

#### 4.8.3 Šta je van obima prvog prolaza

Automatsko čitanje mejla dobavljača — blokirano dok M22 ne dovuče poštu, isto kao 4.6. Do tada se sadržaj mejla **nalepi** u polje, kao i kod 4.2.6. Sadržaj mejla je i tada **podatak, nikad instrukcija**.

---

## 5. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola                                                                                         | Podrazumevana dodela po ulozi                                                                                                                                                                             |
| :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M3/supplier/VIEW`                                                                              | Vlasnik, Direktor, Sales Manager, Prodajni agent                                                                                                                                                          |
| `M3/supplier/CREATE`, `EDIT`                                                                    | Vlasnik, Direktor                                                                                                                                                                                         |
| `M3/contract/VIEW`                                                                              | Vlasnik, Direktor, Sales Manager                                                                                                                                                                          |
| `M3/contract/CREATE`, `EDIT`, `DELETE`                                                          | Vlasnik, Direktor                                                                                                                                                                                         |
| `M3/contract-period/VIEW` (uključuje preostali alotman)                                         | Vlasnik, Direktor, Sales Manager, Prodajni agent — prodajni agent mora da vidi preostali kapacitet da bi prodavao                                                                                         |
| `M3/contract-period/EDIT` (cene, alotman, rokovi)                                               | Vlasnik, Direktor                                                                                                                                                                                         |
| `M3/pricelist-import/CREATE`, `VIEW`                                                            | Vlasnik, Direktor; i AI agent zadužen za M3 (poglavlje 4.2.4 — samo ekstrakcija/predlog)                                                                                                                  |
| `M3/pricelist-import/APPROVE_ROW`                                                               | Vlasnik, Direktor — **nikad AI agent**, isti nosilac kao `M3/contract-period/EDIT` (poglavlje 4.2.4)                                                                                                      |
| `M3/capacity/VIEW` (mreža kapaciteta po danima, poglavlje 2.8)                                  | Vlasnik, Direktor, Sales Manager, Prodajni agent — prodaja ovo gleda svakodnevno                                                                                                                          |
| `M3/capacity/CLOSE_SALE` (zatvaranje/otvaranje prodaje po danu)                                 | Vlasnik, Direktor — **ali se namerno dodeljuje i pojedinačno** (M1 `user_permission_overrides`), vlasnikova odluka 8.9.2026: "svako kome to dozvolimo". Uvek uz obavezan `stop_source` i upis u audit log |
| `M3/capacity/BLOCK` (blokada za nepotvrđenu grupu, poglavlje 2.8b)                              | Vlasnik, Direktor, Sales Manager — odvojena od `CLOSE_SALE` jer je to prodajna radnja (držanje za klijenta), ne prenos informacije od dobavljača                                                          |
| `M3/capacity/RESTRICT_SOURCE` (naša zabrana prodaje nad tuđim kapacitetom, poglavlje 2.9d)      | Vlasnik, Direktor, Sales Manager — odvojena od `CLOSE_SALE` jer to nije prenos dobavljačeve informacije nego naša poslovna odluka; uvek uz obavezan `reason` vidljiv agentu koji prodaje                  |
| `M3/source-priority/EDIT` (prioritet dobavljača i zakucavanje po hotelu, poglavlja 2.10c/2.10d) | Vlasnik, Direktor — menja koji se izvor prodaje prvi, što direktno utiče na maržu i na odnos sa dobavljačem                                                                                               |
| `M3/supplier-contact/VIEW`, `CREATE`, `EDIT`                                                    | Vlasnik, Direktor, Sales Manager — dodela `linked_user_id` (portal pristup za chat) dodatno zahteva `M19/supplier-conversation/GRANT_ACCESS` (poglavlje 9.2 te specifikacije)                             |

**Izmena samog kapaciteta po danu** (`capacity_override`, poglavlje 2.8a) namerno **ne dobija novu dozvolu** — to je izmena ugovorenog kapaciteta, pa koristi postojeću `M3/contract-period/EDIT`. Nova dozvola bi razdvojila istu odgovornost na dva mesta.

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/contracting`

| Endpoint                                                     | Metod              | Opis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :----------------------------------------------------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/suppliers`                                                 | GET / POST         | lista / kreiranje dobavljača                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/suppliers/:id`                                             | GET / PATCH        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/suppliers/:id/contacts`                                    | GET / POST         | `SupplierContact` (poglavlje 2.1a) — lista / dodavanje kontakt-osobe                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/suppliers/:id/contacts/:contactId`                         | GET / PATCH        | uključuje `status`; `linked_user_id` se popunjava isključivo preko M19 toka (poglavlje 9.2 te specifikacije), ne direktno ovde                                                                                                                                                                                                                                                                                                                                                       |
| `/contracts`                                                 | GET / POST         | lista / kreiranje ugovora — `GET` prima `q` (broj ugovora ILI naziv dobavljača), `status` i `supplierId` uz `page`/`limit` (dopuna 8.9.2026; filtriranje je na SERVERU jer je lista straničena — klijentski filter bi pretraživao samo trenutnu stranu)                                                                                                                                                                                                                              |
| `/contracts/:id`                                             | GET / PATCH        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/contracts/:id/periods/:periodId`                           | PATCH / DELETE     | dopuna v1.16 — izmena perioda (ponovna provera preklapanja; smanjenje ispod prodatog **dozvoljeno** uz upozorenje i `capacity_oversold` događaj) i gašenje (`INACTIVE` ako period ima rezervacije, stvarno brisanje ako nema) — zahteva `M3/contract-period/EDIT`; vidi poglavlje 2.3d                                                                                                                                                                                               |
| `/contracts/:id/periods`                                     | GET / POST         | sezone unutar ugovora — `POST`/`PATCH` odbija period koji se datumski preklapa sa postojećim za isti `room_type` (poglavlje 2.3b)                                                                                                                                                                                                                                                                                                                                                    |
| `/contracts/:id/periods/:periodId/rates/:rateLineId`         | DELETE             | **gašenje** cenovne stavke (poglavlje 2.4c, v1.25) — `status = INACTIVE`, zapis ostaje; zahteva `M3/contract-period/EDIT`                                                                                                                                                                                                                                                                                                                                                            |
| `/contracts/:id/periods/:periodId/rates/:rateLineId/replace` | PUT                | **ispravka** — u jednoj transakciji gasi staru stavku i upisuje novu sa `replaces_id` (poglavlje 2.4c, v1.25)                                                                                                                                                                                                                                                                                                                                                                        |
| `/contracts/:id/periods/:periodId/rates`                     | GET / PUT          | cenovne stavke                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/contracts/:id/periods/:periodId/cancellation-rules`        | GET / PUT          | pravila otkazivanja — `rule_type` (`PRE_ARRIVAL`/`EARLY_DEPARTURE`, poglavlje 2.5, dopuna v1.12)                                                                                                                                                                                                                                                                                                                                                                                     |
| `/contracts/:id/periods/:periodId/offers`                    | GET / PUT          | dopuna v1.12 — `PricelistOffer` (poglavlje 2.4b), rana rezervacija/free-nights akcije                                                                                                                                                                                                                                                                                                                                                                                                |
| `/contracts/:id/periods/:periodId/ancillary-services`        | GET / PUT          | dopuna v1.12 — `AncillaryService` (poglavlje 2.6)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/contracts/:id/periods/:periodId/tourist-tax`               | GET / PUT          | dopuna v1.12 — `TouristTaxInfo` (poglavlje 2.7), isključivo informativno, vidi ogradu tog poglavlja                                                                                                                                                                                                                                                                                                                                                                                  |
| `/contracts/:id/periods/:periodId/availability`              | GET                | preostali kapacitet — koristi M5 pri pretrazi                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/contracts/:id/periods/:periodId/reserve`                   | POST               | interni poziv (samo M5) — atomski umanjuje `units_sold`, vraća grešku ako nema kapaciteta                                                                                                                                                                                                                                                                                                                                                                                            |
| `/capacity/grid`                                             | GET                | mreža kapaciteta po danima (poglavlje 2.8) — filteri: raspon datuma **boravka**, **datum/raspon prijave** (`bookingDate`, podrazumevano danas — poglavlje 2.3e.4), destinacija (`destinationCountry`/`destinationCity`), hotel/proizvod (`productName`, sadrži-bez-obzira-na-velika-slova), **vrsta proizvoda** (`productType`, više vrednosti — dopuna v1.22), dobavljač, tip sobe, `allotment_mode`, stanje; vraća po danu: kapacitet, prodato, blokirano, slobodno, `sale_status` |
| `/capacity/history`                                          | GET                | istorija izmena kapaciteta (poglavlje 2.8g) — ko, kada i šta je promenio; filteri: `contractId`, `contractPeriodId`, `from`, `to`, `limit`. Čita postojeće `AuditLogEntry` zapise, ne novu tabelu; zahteva `M3/capacity/VIEW`, NE `M1/audit-log/VIEW` (dopuna v1.23)                                                                                                                                                                                                                 |
| `/capacity/days`                                             | PUT                | masovna izmena `capacity_override` za opseg (poglavlje 2.8a) — zahteva `M3/contract-period/EDIT`                                                                                                                                                                                                                                                                                                                                                                                     |
| `/capacity/stop-sale`                                        | POST               | zatvaranje prodaje; telo nosi obim (jedan period ili ceo ugovor) + raspon datuma + `stop_source`/`stop_reason` — zahteva `M3/capacity/CLOSE_SALE`                                                                                                                                                                                                                                                                                                                                    |
| `/capacity/stop-sale`                                        | DELETE             | ponovno otvaranje prodaje za isti obim — ista dozvola, isti upis u audit log                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/capacity/blocks`                                           | GET / POST         | blokade (poglavlje 2.8b) — `POST` odbija zahtev bez `reason` i `hold_until`; zahteva `M3/capacity/BLOCK`                                                                                                                                                                                                                                                                                                                                                                             |
| `/capacity/blocks/:blockId`                                  | PATCH              | ranije oslobađanje (`RELEASED`) ili pretvaranje u rezervaciju (`CONVERTED`, uz `converted_booking_id`)                                                                                                                                                                                                                                                                                                                                                                               |
| `/capacity/hotel/:productId`                                 | GET                | hotel-first prikaz (poglavlje 2.9, ekran M17 poglavlje 4b) — svi izvori jednog objekta na jednom mestu: naši ugovori (sa punom računicom) i API izvori (dva nezavisna broja, uz vreme odgovora); zbir isključivo preko naših ugovora (2.9e)                                                                                                                                                                                                                                          |
| `/capacity/search-hotels`                                    | GET                | prediktivna pretraga objekta za taj ekran — vraća naziv, kategoriju, **mesto i državu** (bez toga se hoteli istog imena ne razlikuju) i broj izvora; čita M2 katalog, ne duplira ga                                                                                                                                                                                                                                                                                                  |
| `/capacity/work-queue`                                       | GET                | početno stanje ekrana pre pretrage — samo ono što traži pažnju danas: prekoračeni kapaciteti, blokade kojima ističe rok, stop-sale koji se otvara, rokovi povrata, tipovi soba sa 0–2 preostale jedinice                                                                                                                                                                                                                                                                             |
| `/capacity/restrictions`                                     | GET / POST         | `SourceSaleRestriction` (poglavlje 2.9d) — `POST` odbija zahtev bez `reason`; zahteva `M3/capacity/RESTRICT_SOURCE`                                                                                                                                                                                                                                                                                                                                                                  |
| `/capacity/restrictions/:id`                                 | DELETE             | skidanje zabrane (prelazak u `LIFTED`, ne brisanje) — ista dozvola, isti upis u audit log                                                                                                                                                                                                                                                                                                                                                                                            |
| `/capacity/changes`                                          | GET                | „šta se promenilo od juče" (poglavlje 4.7) — pogled nad audit logom i dnevnim zapisima, bez novog skladišta                                                                                                                                                                                                                                                                                                                                                                          |
| `/capacity/release-suggestions`                              | GET                | predlog obima povrata pred rok (poglavlje 4.5) — uvek sa brojevima iz kojih je izveden; kad uporednog podatka iz prošle sezone nema, odgovor to izričito navodi                                                                                                                                                                                                                                                                                                                      |
| `/source-priority`                                           | GET / PUT          | `SupplierPriority` (poglavlje 2.10c) — slab prioritet, primenjuje se samo unutar praga jednakosti cena                                                                                                                                                                                                                                                                                                                                                                               |
| `/hotels/:productId/source-preference`                       | GET / PUT / DELETE | `HotelSourcePreference` (poglavlje 2.10d) — izuzetak po hotelu koji nadjačava cenu; `PUT` odbija zahtev bez `reason`                                                                                                                                                                                                                                                                                                                                                                 |
| `/contracts/expiring-releases`                               | GET                | lista perioda kojima se bliži `release_days_before` rok, za AI agenta i za interni panel                                                                                                                                                                                                                                                                                                                                                                                             |
| `/pricelist-imports/:id/extract`                             | POST               | pokreće AI ekstrakciju nad nalepljenim tekstom (poglavlje 4.2.6, v1.26) — `PROCESSING → READY_FOR_REVIEW` ili `FAILED` sa razlogom; zahteva `M3/pricelist-import/CREATE`                                                                                                                                                                                                                                                                                                             |
| `/pricelist-imports`                                         | GET / POST         | lista / upload novog cenovnika (pokreće AI ekstrakciju, poglavlje 4.2)                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/pricelist-imports/upload`                                  | POST               | učitavanje fajla (`multipart/form-data`, polje `file`) — snima na lokalni disk i kreira `PricelistImport` sa `source_file_url` (§4.2.7); zahteva `M3/pricelist-import/CREATE`                                                                                                                                                                                                                                                                                                        |
| `/pricelist-imports/:id/rows`                                | GET                | pregled ekstraktovanih redova sa `match_confidence`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/pricelist-imports/:id/rows/:rowId/approve`                 | POST               | zahteva `M3/pricelist-import/APPROVE_ROW`; kreira/ažurira stvarni `ContractPeriod`/`RateLine`                                                                                                                                                                                                                                                                                                                                                                                        |
| `/pricelist-imports/:id/rows/:rowId/reject`                  | POST               | odbacuje red bez upisa                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

## 7. Izlazni kriterijum (M3 deo Faze 1)

- [x] Moguće je kreirati dobavljača, ugovor u proizvoljnoj valuti (EUR/RSD), i period sa `FIXED` alotmanom, cenama i pravilima otkazivanja. _(dokazano e2e testom, avgust 2026)_
- [x] Moguće je kreirati period sa `ON_REQUEST` modom, bez kapaciteta. _(dokazano e2e testom, avgust 2026)_
- [x] Moguće je kreirati period sa `CHARTER` ili `FIXED_LEASE` modom, sa `ukupna_fiksna_obaveza` (i `payment_schedule` za `FIXED_LEASE`), bez `release_days_before`. _(dokazano e2e testom, avgust 2026)_
- [x] **Izmena perioda (poglavlje 2.3d):** `PATCH` menja kapacitet/datume/tip sobe, ponovo proverava preklapanje, i **dozvoljava** smanjenje ispod prodatog uz upozorenje, audit zapis sa starom i novom vrednošću i `capacity_oversold` događaj. _(implementirano 8.9.2026: `PATCH /contracting/contracts/:id/periods/:periodId`, `ContractPeriodsService.update`; 7 unit testova; forma "Izmeni" u `ugovori/[id]/PeriodsPanel.tsx`)_
- [x] **Gašenje perioda:** `DELETE` nad periodom sa rezervacijama ga prevodi u `INACTIVE` (ne briše, postojeće rezervacije ostaju vezane i vidljive), nad periodom bez rezervacija ga briše. _(implementirano 8.9.2026: `DELETE` na istom endpoint-u, `remove()` broji `BookingItem` preko `RateLine`; 3 unit testa; dugme "Ugasi" sa potvrdom u panelu)_
- [x] **Prekoračenje se vidi kao minus:** posle smanjenja kapaciteta ispod prodatog, raspoloživost za taj dan se prikazuje kao negativan broj, prodaja za taj datum staje, a nijedna postojeća rezervacija se ne otkazuje automatski. _(implementirano 8.9.2026: `DELETE` na istom endpoint-u, `remove()` broji `BookingItem` preko `RateLine`; 3 unit testa; dugme "Ugasi" sa potvrdom u panelu)_
- [x] **Kapacitet po danu (poglavlje 2.8):** `capacity_override` za jedan datum menja raspoloživost samo tog datuma, ostali dani perioda ostaju na `ContractPeriod.total_capacity`. _(implementirano 8.9.2026: `CapacityService` + `CapacityController`, 14 unit testova; ekran "Kapaciteti" viđen u browseru nad mock podacima)_
- [x] **Stop-sale:** zatvaranje prodaje za raspon datuma odbija rezervaciju za te datume sa razlogom "prodaja zatvorena", a `capacity_override` i `ukupna_fiksna_obaveza` ostaju nepromenjeni (test se izvodi nad `FIXED_LEASE` periodom, jer je tu razlika vidljiva). _(implementirano 8.9.2026: `CapacityService` + `CapacityController`, 14 unit testova; ekran "Kapaciteti" viđen u browseru nad mock podacima)_
- [x] **Obim stop-sale:** unos "svi tipovi soba jednog ugovora, raspon datuma" proizvodi isti rezultat kao pojedinačni unos po svakom periodu. _(implementirano 8.9.2026: `CapacityService` + `CapacityController`, 14 unit testova; ekran "Kapaciteti" viđen u browseru nad mock podacima)_
- [x] **Blokada:** `POST /capacity/blocks` bez `reason` ili bez `hold_until` je odbijen; aktivna blokada smanjuje slobodno, ne ulazi u M13, i istekom `hold_until` sama prelazi u `RELEASED`. _(implementirano 8.9.2026: `CapacityService` + `CapacityController`, 14 unit testova; ekran "Kapaciteti" viđen u browseru nad mock podacima)_
- [x] **Konkurentnost po danu:** dva simultana zahteva za poslednju jedinicu **jedne noći** — tačno jedan uspeva; rezervacija koja preklapa taj datum na drugom kraju boravka je takođe odbijena, a noć koja se ne preklapa i dalje prolazi. _(implementirano 8.9.2026: `day-capacity.ts` — provera i brava u istoj naredbi nad `capacity_days.units_reserved` (obrazloženje odstupanja od prvobitnog plana: poglavlje 2.8f); `reserve()` i `release()` primaju noći boravka, M5 ih prosleđuje na sva tri mesta (potvrda, oslobođenje pri neuspehu, otkazivanje). **Dokaz:** 7 novih e2e testova nad pravom bazom — stop-sale obara rezervaciju koja taj dan preklapa (`SALE_STOPPED`), blokada je odbija (`CAPACITY_BLOCKED`), dnevni override obara samo taj dan, noć odjave se ne broji, 10 simultanih zahteva za poslednju jedinicu → tačno jedan; 1182 unit testa i M3/M5 e2e prolaze)_
- [ ] Dospela rata iz `FIXED_LEASE.payment_schedule` ispravno generiše zapis u M10 `SupplierObligation`. _(čeka M10 — nije implementiran)_
- [x] Konkurentni pokušaji rezervacije (test: dva simultana zahteva za poslednju preostalu jedinicu) — tačno jedan uspeva, kapacitet se nikad ne pređe, za sve tipove `allotment_mode` sa kapacitetom (`FIXED`, `CHARTER`, `FIXED_LEASE`). _(dokazano e2e testom sa pravim paralelnim HTTP zahtevima nad pravom bazom, avgust 2026 — 10 simultanih za kapacitet 1, 8 za kapacitet 5; ista atomska `$queryRaw` putanja za sve tipove sa kapacitetom)_
- [x] `/contracts/expiring-releases` tačno prijavljuje periode kojima se bliži rok povrata sa neprodatim kapacitetom. _(dokazano e2e testom, avgust 2026)_
- [x] M2 proizvod ispravno referencira `Contract` preko `source_contract_id`, bez duplirane cene. _(dokazano e2e testom, avgust 2026 — prava Prisma FK relacija, ne samo plain UUID)_
- [x] Upload testnog cenovnika rezultuje ekstraktovanim redovima sa `match_confidence` za svaki red. _(izmereno 10.9.2026 kroz stvarne endpoint-e nad pravom bazom: `POST /pricelist-imports/upload` sa CSV cenovnikom → 201, fajl na disku pod nasumičnim imenom, `source_file_name` čuva original; `extract` → `READY_FOR_REVIEW`, **3 reda, 0 odbačenih**, `extraction_path = PARSER`.)_
- [x] **Cena stiže u najmanjoj jedinici valute, doplata ne postaje zaseban red.** _(isto merenje: „89,50 EUR" → `8950`, „109,00" → `10900`, „125,00" → `12500`; krevetac „5,00 EUR" → `crib_fee_per_night = 500` na svakom redu, ne kao četvrti red; dečja cena 50% uz dve odrasle osobe → `age_pricing` sa `min_adults_present: 2`; naziv objekta bez mesta — „Hotel Splendid", ne „Hotel Splendid, Bečići". Pravila 6–8 iz §4.2.6 drže i nad fajlom.)_
- [x] **Slika/sken (§4.2.7):** fotografija cenovnika daje redove kroz model, a `extraction_path` pokazuje `MODEL`, ne `PARSER`. _(izmereno 10.9.2026 nad stvarnom PNG slikom tabele: 201 upload sa `source_format = IMAGE`, `extract` → `READY_FOR_REVIEW`, **3 reda, 0 odbačenih**, cene `14200`/`16850`/`21500` tačne, krevetac `700`, dečja cena 50% uz 2 odrasle. Skenirani PDF ide istom granom — pokriveno jediničnim testom, jer traži sken koji se ne može verodostojno napraviti u testu.)_
- [x] **Trošak se knjiži na pravi model.** _(izmereno: dva zapisa u `agent_invocation_logs` sa `model_identifier = claude-opus-5`, 0,025 € i 0,027 € — oko dva i po centa po dokumentu. Pri istom merenju nađeno i ispravljeno: tier je bio upisan kao `LIGHT` iz registra agenta iako je poziv išao na Opus 5.)_
- [x] **Veliki cenovnik (§4.2.8):** cenovnik sa preko sto redova daje sve redove, a prekid zbog dužine se prijavljuje kao prekid sa uputstvom da se dokument podeli — nikad kao „nijedan red nije prepoznat“. _(izmereno 10.9.2026 kroz `POST /pricelist-imports/upload` + `/extract` nad `Primeri cenovnika/Bellevue Rates 2025_hr.pdf`: **117 redova**, 0,144 € — istim putem je stara šema vraćala **nula redova uz 0,40 €**. Isti dan, isti fajl. `Allotment pricelist 2026 - Bono.pdf`: 45 redova, 0,066 €, prethodno 36 redova za 0,160 €. Prekid je pokriven jediničnim testom, jer se stvaran prekid posle ove izmene više ne može izazvati na dostupnim cenovnicima.)_
- [ ] **Prevelik fajl se odbija pri učitavanju**, sa porukom šta čovek da uradi — ne posle poziva modelu. _(granica je postavljena u `multer` konfiguraciji i tip fajla se odbija u `fileFilter`; odbijanje fajla preko 25 MB nije izmereno stvarnim uploadom.)_
- [x] Odobravanje reda cenovnika kreira ispravan `ContractPeriod`/`RateLine` zapis tek posle ljudske potvrde — nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `match_confidence`. _(dokazano e2e testom, avgust 2026 — testirano sa redom unetim direktno u bazu kao stand-in za ekstrakciju)_
- [x] Nijedno novčano polje (`price`, `ukupna_fiksna_obaveza`) nije tipa `decimal`/float — provereno da su sva `integer` u najmanjoj jedinici valute (poglavlje 2). _(dokazano e2e testom, avgust 2026)_
- [x] Pokušaj kreiranja ili odobravanja (iz uvoza cenovnika) `ContractPeriod` koji se datumski preklapa sa postojećim periodom za isti `contract_id`/`room_type` se odbija sa jasnom porukom (poglavlje 2.3b); susedni (ne-presecajući) periodi se prihvataju. _(dokazano unit + e2e testom, avgust 2026 — deljena provera između ručnog kreiranja i odobravanja uvoza)_
- [x] Rezervacija koja preostali kapacitet perioda svede na 1 ili 2 jedinice generiše `HealthSignal` tačne ozbiljnosti (`CRITICAL` za 1, `WARNING` za 2, poglavlje 4.3); preostalo > 2 ne generiše signal. _(implementirano preko Event Bus-a — `M3`/`low_capacity_critical` — M18 sad postoji u kodu i stvarno se pretplaćuje (`M18EventSubscribersService`), kreira pravi `HealthSignal` zapis; dokazano e2e testom u `apps/api/test/m18-exit-criteria.e2e-spec.ts`, avgust 2026)_
- [x] `Contract` ne može preći u `ACTIVE` bez popunjenog `default_tip_nastupanja` (poglavlje 2.2a), isto sprovođenje kao postojeća ograda za `MarkupRule`. _(dokazano unit + e2e testom, avgust 2026)_
- [x] Moguće je kreirati `RateLine` sa `price_basis = PER_ROOM_PER_NIGHT` i sa `price_basis = PER_PERSON_PER_NIGHT`, svaki sa `age_pricing[]` nizom (poglavlje 2.4a). _(dokazano e2e testom, avgust 2026)_
- [x] Test: `age_pricing[]` red sa `occupant_index = 1` i red bez `occupant_index` za istu kategoriju — gost čiji je redni broj u sobi tačno 1 dobija cenu iz prvog reda, ne iz podrazumevanog (poglavlje 2.4a, razrešavanje). _(dokazano unit testom, `resolveAgePricing` — poglavlje 2.4a implementirano kao samostalna funkcija, spremna za M5 da je pozove)_
- [ ] Test: redni broj deteta se izvodi iz UZRASTA, ne iz redosleda unosa — ista soba sa `children_ages: [9, 5]` i `[5, 9]` daje istu ukupnu cenu pri svakoj od četiri kombinacije `child_counting_basis`/`child_order` (poglavlje 2.4a, dopuna 10.9.2026). _(nije implementirano — danas redosled unosa menja cenu)_
- [ ] Test: `child_counting_basis = ALL_CHILDREN` daje detetu od 9 godina (`CHD2`) `occupant_index = 1` uz `OLDEST_FIRST`, dok `PER_CATEGORY` daje `occupant_index = 1` i njemu i detetu od 5 godina (`CHD1`), svakom u svojoj kategoriji (poglavlje 2.4a). _(nije implementirano — dopuna 10.9.2026)_
- [ ] Cenovnik u kom bi obrnut `child_order` dao DRUGAČIJU ukupnu cenu prikazuje upozorenje uz cenovnik; cenovnik kod kog razlike nema ne prikazuje ništa (poglavlje 2.4a). _(nije implementirano — dopuna 10.9.2026)_
- [ ] Test: gost čija kategorija nema odgovarajući `age_pricing[]` red (ni uslovljen ni podrazumevani) odbija kreiranje `Quote` sa jasnom porukom — ne pretpostavlja cenu. _(deo dokazan unit testom — `resolveAgePricing` vraća `null` kad nijedan red ne odgovara, tačka na kojoj bi M5 odbio `Quote`; sâmo odbijanje čeka M5, koji još ne postoji)_
- [ ] `ContractPeriod.age_policy_override` (poglavlje 2.3c) menja klasifikaciju gosta pri obračunu cene za taj period, bez uticaja na fizičku proveru kapaciteta sobe. _(polje + `computeRoomBaseCost` rezolucija implementirani 28.8.2026; nedostaje jedinični test i panel ekran za ručan unos pri kreiranju cenovnika — čeka ekran za pojedinačan ugovor/period)_
- [ ] Upload testnog cenovnika sa uzrasnim tabelama rezultuje `PricelistImportRow` sa popunjenim `extracted_price_basis`/`extracted_age_pricing` kandidatima, ne samo osnovnim poljima (poglavlje 4.2.2). _(čeka AI provajdera, isto obrazloženje kao stavka o PDF/Excel uploadu iznad; model podataka i primena u `RateLineAgePricing` pri odobrenju su dokazani e2e testom)_
- [ ] Prvi `PricelistImport` za novog dobavljača kreira `SupplierExtractionProfile` tek posle prvog `CONFIRMED` reda; drugi uvoz od istog dobavljača, sa istom strukturom dokumenta, ima viši prosečan `match_confidence` od prvog (poglavlje 4.2.5). _(prva polovina dokazana e2e testom — profil se kreira/ažurira pri odobrenju; druga polovina, da profil podiže `match_confidence` sledećeg uvoza, deo je same ekstrakcije i čeka AI provajdera)_
- [ ] Test: uvoz od dobavljača sa postojećim profilom, ali sa dokumentom čija se `structure_signature` ne poklapa — profil se ne primenjuje, uvoz ide sa uobičajenom pouzdanošću i vidljivom napomenom da profil nije iskorišćen.
- [x] Dopuna v1.12 (talas 1): `Contract` ne može preći u `ACTIVE` bez popunjenog `commission_model` (poglavlje 2.2b), isto sprovođenje kao `default_tip_nastupanja`. _(dokazano unit + e2e testom, 31.8.2026)_
- [x] Dopuna v1.12: moguće je kreirati `ContractPeriod` sa `min_stay_nights`/`max_stay_nights` (poglavlje 2.3) i pročitati ih preko API-ja. _(dokazano e2e testom, 31.8.2026)_
- [x] Dopuna v1.12: moguće je kreirati `PricelistOffer` tipa `EARLY_BOOKING` i `FREE_NIGHTS` za period (poglavlje 2.4b), sa ispravnim čuvanjem `booking_from/booking_to` odvojeno od `stay_from/stay_to`. _(dokazano unit + e2e testom, 31.8.2026)_
- [x] Dopuna v1.12: moguće je kreirati `CancellationRule` sa `rule_type = EARLY_DEPARTURE` nezavisno od postojećih `PRE_ARRIVAL` pravila istog perioda (poglavlje 2.5). _(dokazano e2e testom, 31.8.2026)_
- [x] Dopuna v1.12: moguće je kreirati `AncillaryService` sa oba `pricing_mode` (`FLAT_PER_UNIT`, `PERCENTAGE_OF_NIGHTLY_RATE`, poglavlje 2.6). _(dokazano unit + e2e testom, 31.8.2026)_
- [x] Dopuna v1.12: moguće je kreirati `TouristTaxInfo` za period (poglavlje 2.7); potvrđeno testom da nijedan M10/M11 endpoint ne čita ovo polje kao osnovu za fakturisanje/prijavu. _(dokazano unit + e2e testom, 31.8.2026 — potvrđeno grep-om da nijedan M10/M11 endpoint ne referencira touristTaxInfo/TouristTaxInfo)_
- [ ] **Isti hotel iz dva izvora (poglavlje 2.9):** hotel koji se nabavlja i preko našeg ugovora i preko API provajdera prikazuje se kao **jedan** objekat sa dva označena reda; red našeg ugovora nosi punu računicu, red API izvora nosi dva nezavisna broja (raspoloživo po provajderu + naše prodato) i vreme odgovora, **bez ijednog oduzimanja između njih**.
- [ ] **Zbir ne meša izvore (2.9e):** red „ukupno u hotelu" sabira isključivo naše ugovorene kapacitete; dodavanje API izvora ne menja taj zbir. Kad ugovoreni zbir za jedan datum pređe poznat fizički broj jedinica objekta, prikazuje se upozorenje, a unos se **ne** odbija.
- [ ] **Naša zabrana prodaje (2.9d):** `POST /capacity/restrictions` bez `reason` je odbijen; aktivna zabrana nad API izvorom sprečava prodaju tog hotela za zadate datume, prikazuje se kao „naša zabrana" (nikad kao „zatvoreno"), i M5 odbija rezervaciju sa tim razlogom kao trećim, odvojenim od „nema mesta" i „prodaja zatvorena".
- [ ] **Uparivanje se ne pogađa (2.9f):** hotel sa provajdera koji nema mapiranje ne ulazi u prodaju i ne uparuje se automatski po sličnosti naziva — ide u red za ljudski pregled (M4 poglavlje 3.3). Dokazuje se testom nad dva objekta sličnog imena u različitim mestima.
- [ ] **Redosled izvora (poglavlje 2.10):** za isti mapiran tip sobe, izvor sa nižom **prodajnom** cenom je prvi; kad je razlika unutar praga jednakosti, odlučuje `SupplierPriority`; `HotelSourcePreference` nadjačava cenu i njegov `reason` je vidljiv na redu ponude, ne samo u dnevniku.
- [ ] **Kontrolni presek (2.8e):** namerno razilaženje `units_sold` od zbira po danima proizvodi `CAPACITY_COUNTER_DRIFT` signal sa oba broja, i **ne** ispravlja podatak automatski.
- [ ] **Predlog povrata (poglavlje 4.5):** predlog uz rok povrata sadrži brojeve iz kojih je izveden; za period bez prošlogodišnjeg podatka odgovor izričito navodi da uporednog podatka nema, umesto da ga izostavi ili izmisli.
- [ ] **Dnevni pregled izmena (poglavlje 4.7):** `GET /capacity/changes` za zadati dan vraća izmene kapaciteta sa autorom i `stop_source`, bez ijedne nove tabele.
- [ ] **Predlog iz mejla dobavljača (poglavlje 4.6):** _blokirano zavisnošću — M22 još ne dovlači pristiglu poštu (`fetchNewMessages` ne postoji). Stavka ostaje na listi da se ne izgubi; ne broji se kao propust M3 dok taj ulazni tok ne postoji._
- [x] **Prozor prijave (poglavlje 2.3e):** dva perioda sa istim tipom sobe i **istim** datumima boravka su prihvaćena kad im se `booking_from`/`booking_to` ne preklapaju, a odbijena kad se preklapaju (uključujući slučaj gde jedan nema prozor — `null` znači „uvek" i seče se sa svakim). _(implementirano 8.9.2026: migracija `m3_booking_window_and_day_counter_v120`, proširen `assertNoContractPeriodOverlap`; 4 unit testa + e2e nad pravom bazom)_
- [ ] **Tranše se ne sabiraju:** za boravak pokriven sa „10 soba za prijave do 31.3." i „5 za prijave posle", raspoloživost na dan 30.3. koristi 10, a na 1.4. koristi 5 — nigde se ne prikazuje 15.
- [ ] **Prekoračenje kroz prozor prijave:** kad je pod ranijom tranšom prodato 8 od 10, a od 1.4. kontingent pada na 5, stanje od 1.4. je **−3**, prodaja za te datume staje, a nijedna postojeća rezervacija se ne otkazuje.
- [x] **Zatvoren prozor je zaseban razlog odbijanja:** rezervacija za period čiji je prozor prijave prošao je odbijena sa `BOOKING_WINDOW_CLOSED`, ne sa „nema kapaciteta" (M5 §4 korak 2). _(implementirano 8.9.2026: provera ide PRE kapaciteta, jer su „zakasnili ste" i „nema mesta" dve različite činjenice; 5 unit testova + e2e)_
- [ ] **Mreža uvek kaže na koji datum prijave se odnosi**, i pomeranjem filtera „Rezervacije od…do" prikazuje kapacitet druge tranše za iste datume boravka.
- [x] API dokumentacija (`docs/api/M3-ugovaranje-alotmani.md`) postoji sa stvarnim primerima zahteva/odgovora za svaki endpoint iz poglavlja 6 — obavezna stavka po CLAUDE.md. _(napisana 3.9.2026; odgovori uhvaćeni stvarnim pozivima nad lokalnom bazom, osim `offers` i `ancillary-services` gde u bazi nema redova pa su primeri sastavljeni iz modela i tako i označeni u dokumentu)_
- [x] Objašnjenje za vlasnika (`00-OBJASNJENJE-M3-ZA-VLASNIKA.md`) postoji — obavezna stavka po CLAUDE.md. _(napisano 3.9.2026)_

**Dopuna v1.27 (poglavlja 2.11 i 4.8):**

- [x] **Sezona sa više opsega (2.11b):** sezona sa dva odvojena opsega (01.04–31.05 i 01.10–31.10) je sačuvana kao **jedna** kolona, a pokušaj da se opsezi dve sezone istog ugovora preklope je odbijen. _(izmereno 9.9.2026 nad pravom bazom: sezona „1" sa 01.04–31.05 i 01.10–31.10 sačuvana kao jedna kolona; opseg 15.05–30.06 odbijen sa 400 i porukom koja imenuje sezonu sa kojom se sudara)_
- [x] **Cena po boravku (2.11c):** cenovni red sa `PER_ROOM_PER_STAY` je sačuvan i M5 ga u ponudi računa jednom za ceo boravak, ne po noći. _(9.9.2026: `PER_ROOM_PER_STAY` 950,00 upisan i pročitan iz baze; 8 jediničnih testova nad `computeRoomBaseCost` dokazuje da se 7 noći i 14 noći cene isto, dok krevetac ostaje po noći)_
- [x] **Dani u nedelji (2.11d):** dva reda iste kombinacije, jedan sa ned–čet i jedan sa pet–sub, prolaze; red koji pokriva isti dan dvaput je odbijen sa jasnim razlogom (poruka imenuje dan). _(izmereno 9.9.2026 kroz `PUT /pricelist-grid/cell` nad pravom bazom)_ **Nepokriven dan je upozorenje, ne odbijanje** — odstupanje od izvornog teksta, obrazloženo u zaglavlju v1.32: strogo pravilo bi onemogućilo unos drugog reda.
- [x] **Cena preko dve grupe dana (2.11d):** boravak subota→subota sa cenama 100,00 (ned–čet) i 140,00 (pet–sub) daje **780,00**, ne 700,00 ni 980,00. _(izmereno kroz `POST /sales/quotes` nad pravom bazom; cena „za ceo boravak" se u istom slučaju naplaćuje jednom)_
- [x] **Turnus (2.11d):** period sa dolaskom/odlaskom subotom i dužinom 7 noći odbija boravak sredom sa porukom koja kaže KADA se sme doći, i prima subota→subota. _(izmereno kroz `POST /sales/quotes`)_
- [x] **Prozor rezervisanja na stavci (2.11e):** cenovna stavka sa `booking_to = 31.12.2025` ne učestvuje u ponudi napravljenoj 5.1.2026, a učestvuje u onoj od 20.12.2025. _(polje i upis potvrđeni u bazi 9.9.2026; **primena dodata istog dana**: pretraga preskače istekle cene, izričito izabrana istekla se odbija sa `BOOKING_WINDOW_CLOSED`, a kad cenu bira sistem uzima se prva koja važi. Dokazano kroz `POST /sales/quotes` nad pravom bazom — 400 sa tim razlogom — i sa 3 jedinična testa.)_
- [ ] **Provizija hotela po periodu (2.11f):** ugovor sa 10 % u sezoni 1 i 7 % u sezoni 3 daje različit obračun za iste datume boravka u te dve sezone; kad užeg pravila nema, koristi se `Contract.commission_percentage`.
- [ ] **Redosled obračuna (2.11g):** ulazna 55,00 sa popustom 15 %, hotelskom provizijom 10 % i maržom 18 % daje prodajnu **49,65** — izmereno, ne procenjeno; drugi redosled daje drugi broj i test to hvata.
- [ ] **Osnovica popusta (2.11h):** popust za treću osobu se računa od ulazne hotelske osnovne cene, ne od cene sobe u kojoj gost leži.
- [x] **Marža po stavci se PRIMENJUJE na cenu (2.11i):** ponuda za stavku sa izuzetkom 12 % + 5,00 daje drugu cenu od ponude za stavku istog perioda bez izuzetka — 117,00 naspram 120,00 na istoj nabavnoj ceni 100,00. _(izmereno 9.9.2026 kroz `POST /sales/quotes` nad pravom bazom; do tada je `M3_RATE_LINE` stajao u kaskadi ali ga nijedan pozivalac nije prosleđivao, pa se izuzetak upisivao i nikad primenjivao — zamka 7.12)_
- [x] **Izuzetak marže na doplati (2.11i):** doplata sa sopstvenim `M3_ANCILLARY_SERVICE` pravilom koristi njega; doplata bez njega nasleđuje maržu matične stavke, ne pravilo ugovora. _(unit testovi; `resolveForAncillary` namerno nema kaskadu)_
- [x] **Marža po stavci (2.11i):** pravilo sa `percentage = 12` **i** `fixed_amount = 500` na 295,00 daje 335,40 (sabiraju se); stavka bez sopstvenog pravila nasleđuje ugovorno. _(izmereno 9.9.2026 nad pravom bazom: Deluxe suite dobio 12% + 5,00 kao izuzetak, ostalih 12 stavki nasleđuje ugovor; `MarkupScopeType` prošireno sa `M3_RATE_LINE`/`M3_ANCILLARY_SERVICE` i ta dva nivoa stoje ISPRED `M2_PRODUCT` u kaskadi M5 §2.2)_
- [x] **Provizija subagenta se OBRAČUNAVA po stavci (2.11i):** u istoj ponudi soba nosi proviziju, a stavka označena „bez provizije" se subagentu naplaćuje u punom iznosu; izuzetak vezan za konkretnog subagenta pobeđuje opšte pravilo istog dometa. _(izmereno 9.9.2026 kroz `POST /sales/quotes` nad pravom bazom: 90,00 naspram 100,00 na istoj nabavnoj ceni i istoj marži; do tada je M5 primenjivao jedan procenat nad celom ponudom, a `subagent-commission.ts` nije imao nijednog pozivaoca — zamka 7.12)_
- [x] **Bez provizije subagentu (2.11i):** stavka označena „bez provizije" ne ulazi u obračun subagentove zarade, a i dalje ulazi u cenu za gosta. _(9.9.2026: boravišna taksa označena „bez provizije" — nov zapis `SubagentCommissionOverride` sa `noCommission`, koji je namerno različit od 0% jer je izričita odluka a ne prazno polje; 18 jediničnih testova nad `subagent-commission`)_
- [x] **Taksa u obračunu (2.11j):** taksa sa `payable = AGENCY` ulazi u ukupnu cenu i na fakturu; ista sa `ON_SITE` **ne ulazi u zbir** ali je odštampana na ponudi i vaučeru sa iznosom. _(izmereno 9.9.2026 nad pravom bazom: tri uzrasna stepena 1,50 / 1,00 / 0,50 upisana kao doplate sa ON_SITE; API vraca ulaziUZbir=false za sve tri, a true za veceru i popuste — 3 od 6 ulazi u zbir)_
- [x] **Domet doplate važi i u prodaji (2.11k):** doplata sa dometom „ceo ugovor" se prikazuje na stavci rezervacije preko `GET /sales/bookings/:id/items/:itemId/ancillaries`, dok doplata druge sobe, drugog perioda i ugašena stavka (§2.4c) ne ulaze u spisak. _(9.9.2026: pre ove izmene M5 je čitao samo `contractPeriod.ancillaryServices` i nijedna doplata sa dometom ugovora nije stizala do prodavca; dokazano novim e2e testom nad pravom bazom — pet doplata, dve moraju da se vide, tri ne smeju)_
- [x] **Doplata za više soba (2.11k):** jedna doplata sa `scope_type = M3_CONTRACT` važi za sve tipove soba bez ijednog dupliranog zapisa. _(9.9.2026: doplata bez dometa vazi za sve sobe; popust za 3. osobu ogranicen na dva tipa apartmana jednim zapisom, bez dupliranja; 18 jedinicnih testova nad `surcharge-scope`)_
- [x] **Verzija cenovnika (2.11l):** posle uvoza izmenjenog cenovnika ekran prikazuje **samo razlike**; prethodna verzija ostaje čitljiva, a rezervacija napravljena pre izmene i dalje prikazuje staru cenu. _(v1.33 — tok razlike/potvrde je napravljen i izmeren; ekran AI uvoza iz §4.2 još ne zove `predlog`/`primeni` nego upisuje red po red, što se spaja u koraku 7.)_
- [x] **Izmena rečima (4.8):** rečenica koja traži tri različite izmene proizvodi tri odvojene stavke za odobrenje; odbijanje jedne ne sprečava primenu ostale dve; `instruction_text` je sačuvan uz nastalu verziju. _(v1.35 — tri izmene iz jedne rečenice daju tri odvojene stavke; odbijanje jedne ne sprečava ostale; `instruction_text` je sačuvan. Doplate i izmene van cenovnika se **prijavljuju sa uputstvom**, ne primenjuju — vidi granicu u zaglavlju v1.35.)_
- [ ] **Mreža na ekranu (M17 §6d):** ceo cenovnik jednog hotela sa 5 tipova soba i 5 sezona se unosi **sa jednog ekrana**, a cena se kuca kao `89,50` — ne kao `8950`.
- [x] **Kalendar (2.11o):** za izabran hotel, tip sobe i sastav gostiju kalendar prikazuje cenu po danu i broj slobodnih jedinica; prelaz sezone se vidi kao promena cene. _(v1.34 — dan nosi i oznaku sezone, pa se prelaz vidi i kad su cene slučajno iste; dan bez cene nosi imenovan razlog umesto praznog polja.)_

---

## 8. Otvoreno za dalje

- **Provizija hotela po tipu sobe** (poglavlje 2.11f) — vlasnik 9.9.2026: _„za sada samo po periodu, ali ko zna da li će nekada neki hotel i po tipu sobe to da primeni"_. Zapis je zato napravljen po scope obrascu, pa je dodavanje tog nivoa jedna vrednost u enumu. Ne gradi se dok se stvarno ne pojavi.
- **Ugovor za subagenta u dve varijante** (sa prikazanom provizijom, za subagenta; bez nje, za njegovog kupca) — vlasnik 9.9.2026 potvrdio da je **razlika samo u izostavljenoj proviziji**, dakle jedan šablon sa dva ispisa. Posao pripada **M7**, ne M3 — upisati tamo pri sledećoj dopuni M7.
- **Strogi FK za `room_type`** (poglavlje 2.11m) — ostaje string dok se ne vidi koliko dobavljača stvarno uvodi tipove soba kojih u katalogu nema.
- **Migracija postojećih `TouristTaxInfo` zapisa** u `AncillaryService` (poglavlje 2.11j) — jednokratna, radi se pri implementaciji tog poglavlja; do tada oba oblika koegzistiraju.
- **Prag jednakosti cena** (poglavlje 2.10a, podrazumevano 2%) — da li ostaje globalna konstanta ili se podešava po hotelu/tržištu, otvoreno dok se ne vidi iz prakse. Prevelik prag bi tiho pretvorio „najniža cena" u „prioritet dobavljača", što je suprotno vlasnikovoj odluci — vredi meriti koliko puta prioritet stvarno odluči.
- **Fizički broj jedinica objekta** (poglavlje 2.9e, potreban za upozorenje kad ugovoreni zbir pređe ono što hotel ima) — M2 katalog to danas ne vodi kao pouzdan podatak. Dok ne postoji, upozorenje se prosto ne prikazuje; ne pretpostavlja se broj iz drugih izvora.
- **Rok najave stop-sale-a iz ugovora** (npr. 48h za već predate rezervacije) i dalje nije modelovan — stop-sale se unosi kao činjenica, bez provere da li je dobavljač ispoštovao ugovoreni rok. Sa poglavljem 2.9 ovo postaje vidljivije: kad isti hotel imamo iz dva izvora, poštovanje roka je argument u odluci kome dati prioritet (2.10c).
- **Slanje naše odluke dobavljaču** — `SourceSaleRestriction` (2.9d) se namerno ne šalje nikome. Ako se ikad pokaže potreba da dobavljač zna da smo ga isključili (npr. da bi popravio uslugu), to je M19 razgovor sa dobavljačem, ne automatski tok iz M3.
- Tačan format `cancellation_terms_summary` (slobodan tekst vs. strukturirano) — dovoljno je slobodan tekst za sada; ako se pokaže potreba za automatskim tumačenjem uslova van `CancellationRule` tabele, revidira se.
- Obračun konverzije valute za potrebe fakturisanja u RSD (kad ugovor nije u RSD) definiše se detaljno u specifikaciji M10, ne ovde — M3 samo čuva izvornu valutu i cenu.
- **[REŠENO 31.8.2026, vlasnikova odluka]** Da li `PACKAGE` proizvodi (iz M2) mogu imati sopstveni ugovor u M3 nezavisno od komponenti koje ga čine, ili se uvek sastavljaju od već ugovorenih komponenti — **ne, `PACKAGE` nikad ne dobija sopstveni M3 ugovor**, cena se uvek izvodi iz komponenti u M5 (isti princip kao `Itinerary → Quote`). Puna odluka, obrazloženje i implementaciona posledica upisani u M5 spec (`docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md`, poglavlje 3.0d.6a) — tamo je pravo mesto jer M5 sastavlja paket, ne M3.
- Break-even/P&L pregled za `CHARTER`/`FIXED_LEASE` periode (poglavlje 2.3a) — definiše se kao izveštaj u M13 (BI) kad ta specifikacija dobije ovu dopunu, ne ovde.
- Tačan OCR provajder/servis za `SCANNED_PDF` (poglavlje 4.2.1) — bira se pri implementaciji, ovaj dokument samo predviđa mesto za tu integraciju.
- Da li prag od 85% (poglavlje 4.2.3) treba biti podesiv po dobavljaču/formatu dokumenta, ili ostaje globalna konstanta — otvoreno dok se ne pokaže potreba iz prakse.
- **Nalazi iz analize stvarnih cenovnika više dobavljača** (avgust 2026, prvi krug — vlasnik dostavio 18 primera iz prakse, CG/HR/CY hoteli i tour-operator ugovori) — cena po uzrasnoj kategoriji (poglavlje 2.4a) je rešena tom verzijom.
- **Drugi krug analize** (31.8.2026, 55 novih primera, `Primeri cenovnika/` — Olympic Travel, Aycon portfolio, Plava Laguna, Solvex, Ananti, Heritage Grand Perast, Dionysos i drugi) — svih 6 tačaka iz prethodne verzije ovog poglavlja potvrđeno je konkretnim primerima i rešeno u v1.12 kao "talas 1" (poglavlja 2.2b, 2.3, 2.4b, 2.5, 2.6, 2.7). Ista analiza otvara dodatne nalaze, namerno odloženi kao "talas 2" dok talas 1 ne uđe u implementaciju:
  - ~~**Dobavljač jednostrano suspenduje kapacitet ("STOP SALE")**~~ **REŠENO 8.9.2026 (v1.15, poglavlje 2.8a).** Vlasnik je potvrdio da je ovo svakodnevica, ne izuzetak, i da stiže i kod `FIXED_LEASE`. Rešeno kao `CapacityDay.sale_status` — zaseban status po danu, ne status na `ContractPeriod` (kako je ova stavka pretpostavljala) i nikad kao kapacitet spušten na nulu. **Ostaje otvoreno iz iste stavke:** rok najave koji ugovori navode (npr. 48h za već predate rezervacije) nije modelovan — danas se stop-sale unosi kao činjenica, bez provere da li je dobavljač ispoštovao ugovoreni rok.
  - ~~**Obavezni datumski vezani doplati**~~ **REŠENO 9.9.2026 (v1.27, poglavlje 2.11k).** `AncillaryService` dobija `applies_from`/`applies_to` — datumski opseg te doplate, različit od `stay_from`/`stay_to` celog perioda. Potvrđeno tačno kako je stavka pretpostavljala.
  - ~~**Rok povrata ograničen na određene dane u nedelji**~~ **DELIMIČNO REŠENO 9.9.2026 (v1.27, poglavlje 2.11d).** Mehanizam dana u nedelji uveden je kao `int[]` na cenovnom redu i na periodu (dolazak/odlazak). **Ostaje otvoreno:** rok povrata kao **fiksan kalendarski datum** (npr. „vraća se do 15.5.") — `release_days_before` je i dalje isključivo relativan broj dana.
  - **Ograničenje distributivnog kanala** (zabrana objave na B2C/meta-search sajtovima ili zahtev da neto cena ostane skrivena) — odvojeno od ograničenja tržišta porekla gosta (već otvoreno ispod); dotiče i M8 (šta sme da se objavi na sajtu).
  - **Obavezan minimalni markup koji nameće dobavljač** (npr. "min. 20-30% iznad ove cene") — potvrđeno više puta u drugom krugu (Ananti, Heritage Grand Perast); danas je `MarkupRule` (M5 poglavlje 2.1) isključivo interna odluka agencije, trebalo bi proveravati protiv donje granice koju ugovor nameće. Nije rešeno u talasu 1 jer zahteva izmenu M5, ne samo M3.
  - **Ograničenje tržišta porekla gosta** (npr. "važi samo za Kosovo, Češku, Poljsku...") i **ograničenje po segmentu gosta** (FIT vs. grupa 8+ soba vs. MICE) — oba potvrđena u oba kruga analize, i dalje bez mesta u `Contract`/`ContractPeriod`; nisu uključena u talas 1 jer zahtevaju odluku kako se ograničenje proverava u M5 toku prodaje (gost/subagent iz kog tržišta, kako se to zna u trenutku ponude), ne samo gde se podatak čuva.
  - **Solvex format** (`014_Solvex_Offer_Summer_2025.xlsx`) je strukturno veliki wholesaler feed (stotine hotela u jednom fajlu, ne pojedinačan ugovor) — vredi razmotriti da li ovakav izvor pripada M4 (API/feed integracija) umesto ručnog/AI unosa kroz M3 `PricelistImport`, kad (ako) taj dobavljač uđe u razmatranje kao stvaran partner.
  - ~~**Interakcija `commission_model` sa M5 `MarkupRule`**~~ **REŠENO 9.9.2026 (v1.27, poglavlje 2.11g), vlasnikova odluka.** Redosled je: popust → provizija koju hotel odobrava agenciji → naša marža → provizija subagenta. Marža se dakle računa na cenu **već umanjenu** i za popust i za hotelsku proviziju. Uz to je otkriveno da provizija ne sme biti jedna po ugovoru nego po periodu (2.11f).
  - **Provera `min_stay_nights`/`max_stay_nights` (poglavlje 2.3) i uzrasnog/dan-u-nedelji ograničenja `PricelistOffer` (poglavlje 2.4b) pri sastavljanju ponude** — M3 samo čuva podatke, sama provera/odbijanje ponude koja krši ova pravila je M5 posao, van obima ove specifikacije.

- **Poređenje sa industrijskom praksom (31.8.2026, istraživanje na zahtev vlasnika)** — pre poređenja, bitna razlika: postoje dva različita problema koji se oba zovu "unos cene hotela". _Sell-side distribucija_ (hotel/PMS → OTA) ima usvojen standard (OTA ARI, `OTA_HotelRateAmountNotifRQ`) jer hotel ima razlog da se standardizuje — isti feed ide na desetine OTA kanala. _Buy-side ugovaranje_ (agencija ← dobavljač, ono što M3 rešava) **nema** široko usvojen standard — svaki dobavljač-agencija ugovor je pojedinačan pregovor, bez mrežnog efekta koji bi gurnuo format. To objašnjava zašto je AI-ekstrakcija iz neurednih PDF/Excel dokumenata norma u ovoj niši, ne izuzetak — M3 nije odstupio od prakse, ušao je u prostor gde standarda nema.
  - **Model cene** (`RateLine.price_basis` + `age_pricing[]`, poglavlje 2.4/2.4a) upoređen sa OTA ARI (`BaseByGuestAmts` + `AdditionalGuestAmounts`, nabraja svaku kombinaciju okupacije po tip sobe × rate plan) — M3-ov pristup (jedna zastavica + generička lista po uzrasnoj kategoriji) je čistiji za ovaj slučaj upotrebe, razuman izbor jer M3 ne mora da servisira desetine OTA kanala sa različitim formatima.
  - **Neto/bruto cena** (`Contract.commission_model`, poglavlje 2.2b) — potvrđeno da je ovo standardan koncept kod tour-operator softvera (Tourplan, Moonstride: "dual pricing net vs. sell", "commission structures by product type"). M3 je ovde u skladu sa praksom.
  - **AI ekstrakcija + ljudska potvrda** (poglavlje 4.2.4) — industrijski prosek za AI-document-extraction je "confidence-gated branching" (visoka pouzdanost → auto-obrada, niža → red za pregled). M3 je namerno stroži: nijedan red se ne upisuje kao aktivna cena automatski, bez obzira na `match_confidence`. Ovo je opravdana razlika, ne propust vredan ispravke — pogrešna cena ovde direktno menja maržu na svakoj budućoj rezervaciji, dok kod tipičnog AP/fakture slučaja greška samo otvara spor koji se reklamira. **Preporuka: zadržati ovo pravilo i posle izbora AI provajdera** — ne uvoditi prag za automatski upis bez obzira na pouzdanost.
  - **`SupplierExtractionProfile`** (poglavlje 4.2.5) nema direktan imenovan pandan kod poznatih konkurenata (Tourplan/Moonstride ne oglašavaju ovu funkciju javno) — deluje kao M3-specifično rešenje, konceptualno srodno opštoj praksi "potpis strukture dokumenta" u document-processing alatima.
  - **`AncillaryService` kao generički red** (poglavlje 2.6) prati opštu preporuku u document-extraction praksi za jako promenljive stavke (izbegavati rigidnu šemu kad se tip troška ne može unapred nabrojati) — usklađeno sa dobrom praksom.
  - Jedina konkretna posledica ovog istraživanja: potvrđuje (ne otvara novo) već postojeći nalaz iznad o **Solvex formatu** — podela "pojedinačan ugovor kroz M3, veliki wholesaler feed kroz M4" je usklađena sa tim kako industrija razlikuje "channel manager feed" od "contract loading". Nije prošlo kroz `tt-architecture-core` proveru niti traži dalju akciju — čista beleška radi buduće reference.
