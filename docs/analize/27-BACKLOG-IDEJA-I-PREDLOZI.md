# Backlog — konsolidovan indeks otvorenih pitanja i ideja

**Status:** Živ dokument, ažurira se u istom prolazu kad god se u bilo kom modulu doda nova stavka pod "Otvoreno za dalje" (vidi CLAUDE.md).

---

## Šta je ovo i šta NIJE

Terminal ima 22 specificirana modula, svaki sa sopstvenom sekcijom **"Otvoreno za dalje"** — pitanja koja su svesno ostavljena nerešena dok se ne pokaže stvarna potreba ili ne dobije potvrda vlasnika/pravnika/knjigovođe. Kad je posao ograničen na jednu sesiju i jedan modul, lako je izgubiti pregled nad tim šta sve čeka na nekom drugom mestu — 22 odvojene liste se ne čitaju same od sebe.

Ovaj fajl je **indeks, ne izvor istine** — svaka stavka ovde je jedan red sa pokazivačem na tačan modul i poglavlje gde stvarno piše puno objašnjenje. Kad se stavka reši, briše se odavde i (ako je vredno traga) ostaje samo u changelog-u (`**Verzija:**` liniji) tog modula — ne duplira se detaljan tekst na dva mesta, isti princip "jedan izvor istine" kao svuda u projektu (Master dokument, poglavlje 3).

**Kako se koristi:** kad počinjemo novu sesiju/temu, prvi pogled ovde da vidimo šta je već identifikovano kao čekanje, umesto da se nešto ponovo "otkriva" ili — gore — tiho zaboravi.

---

## Ideje van formalne specifikacije (još nemaju mesto ni u jednom modulu)

- **AI Semantički sloj nad podacima** (predlog vlasnika, 13.8.2026) — semantički sloj (npr. Cube.dev stila) između AI agenata i baze, da LLM ne generiše sirov SQL nego bira iz kataloga testiranih metrika; row/column-level security po ulozi ugrađena u sam sloj. Odloženo na zahtev vlasnika ("uradićemo kasnije") pre nego što je prošlo kroz `tt-architecture-core` proveru. Otvoreno: poreklo pomenutog "M-24 Inventory Aggregation Layer" (ne postoji u trenutnoj mapi modula), fizička lokacija pomenutog lokalnog LLM hardvera (EU rezidencija, poglavlje 9), usklađivanje predložene podele agenata sa već specificiranim M15 modelom, i uvođenje tehnologija van poglavlja 6 (Cube.dev/pgvector/LiteLLM). Pun originalni predlog i analiza sudara: `docs/analize/30-PREDLOG-AI-SEMANTICKI-SLOJ.md`.

- **Brz put "rezultat pretrage → ponuda → slanje" (email/Viber/Telegram/link), za zaposlene, subagente i firme** (zahtev vlasnika, 17.8.2026, zabeleženo pre razrade) — cilj je najmanji broj klikova od rezultata pretrage proizvoda (M2/M5) do gosta/subagenta koji dobija konkretnu ponudu na kanalu po svom izboru. Trenutno stanje: `CommunicationLog` (M6 §4.1) ima samo `EMAIL`/`PHONE`/`SMS`/`IN_PERSON`, nema pojam samostalne "ponude" niti javnog linka ka njoj; M7 §2.0.4 ima AI nacrt ponude, ali samo unutar chata sa subagentom, ne kao nešto što se šalje napolje na više kanala. Moj predlog koraka (nije još potvrđeno, čeka odluku vlasnika i tek onda dopunu spec-a pre koda):
  1. Iz rezultata pretrage (M2 katalog / M5 rezervacije, ili M15 omnisearch) zaposleni/subagent bira jednu ili više stavki i pravi novi entitet `Offer` (verovatno proširenje M6, po uzoru na postojeći `PostTripSurvey.access_token` obrazac za bezbedan javni pristup bez login-a).
  2. Ekran "Pošalji ponudu" nudi: (a) email — postojeći M6 mehanizam; (b) "kopiraj link" — univerzalno radi u bilo kojoj aplikaciji; (c) predpopunjeni web-intent linkovi za Viber/Telegram/WhatsApp (`viber://forward?...`, `t.me/share/url?...`) — ovo namerno **ne** zahteva registraciju poslovnog Viber/Telegram Bot naloga (spor, odobrenje treće strane), samo otvara aplikaciju sa gotovim tekstom.
  3. `Offer` ima status (`DRAFT → SENT → VIEWED → EXPIRED`) i log ko/kada poslao — isto pravilo kao M6 `CommunicationLog`: AI sme da pripremi nacrt, čovek mora da klikne "pošalji" čim ponuda pominje cenu (već postojeći 🟡 nivo u M15 registru — "Slanje poruke gostu koja sadrži cenu").
  4. Gost/subagent otvara link bez login-a, vidi ponudu (mobilno-prilagođeno), sa CTA "Rezerviši"/"Kontaktiraj nas".
  - Otvoreno pre pisanja spec-a: da li `Offer` živi kao dopuna M6 (najprirodnije, već ima access-token obrazac) ili kao mali novi modul; da li se ekran gradi prvo u M17 (zaposleni) ili čeka i M7 portal (subagent) zajedno.

- **Operativni zadaci vezani za entitet (`Task`)** (nastalo iz poređenja sa cake.com paketom — Clockify/Pumble/Plaky, 17.8.2026; upisano na zahtev vlasnika, čeka odluku pre dopune spec-a) — od tri alata tog paketa, chat (Pumble) je već pokriven modulom M19, evidencija radnog vremena (Clockify) je **svesno odbačena** kao HR alat sa malom koristi i trenjem prema timu (uvid u "koliko košta obrada rezervacije" jeftinije se dobija brojanjem događaja u M5/M14 kroz M13 izveštaj nego merenjem sati), a upravljanje zadacima (Plaky) je jedina stvarna rupa — nijedan od 23 modula nema pojam zadatka sa rokom i vlasnikom.
  - **Namerno NIJE predlog za generičan "project management" modul sa tablama i Gantt-om.** To je tačno obrazac koji je razgradio PrimeTravel (paralelni sistemi koji rade sličan posao, `docs/analize/22-ANALIZA-PRIMETRAVEL-NALAZI.md`).
  - Predlog je uži: `Task { assignee, due_date, status, related_entity }` koji uvek visi o već postojećem entitetu drugog modula — npr. rooming lista pred polazak grupe (`Booking`/`SupplierManifest`, M5), obnova ugovora sa hotelom pred istek (M3), poziv nalogodavcu o dospeloj fakturi (M10). Prikaz kao "Moj dan" u M17; podsetnik na rok kroz već postojeće M18 kanale (Telegram/email), bez novog mehanizma obaveštavanja.
  - Otvoreno pre pisanja spec-a: da li `Task` živi kao dopuna M17 (ali M17 po definiciji nema sopstvenu bazu ni poslovnu logiku — što govori protiv) ili kao mali nov modul M24; odnos prema M14 tiketima (tiket je zahtev spolja, zadatak je interna obaveza — granicu treba eksplicitno zapisati da se ne bi duplirali); da li AI agent sme sam da otvori zadatak ili samo da predloži (M15 registar ovlašćenja, poglavlje 7 master dokumenta).

- **MARS ERP (NeoLab) konekcija kroz M4** (predlog vlasnika, dostavljen kao gotov draft "M-26 MARS Connector", 21.8.2026; vlasnik istog dana odlučio da ovo NIJE poseban modul — ide kroz M4 kao još jedna konekcija, isti obrazac kao Travelgate/Solvex/WebHotelier, `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` poglavlje 9 v1.11) — sinhronizacija cena/dostupnosti, rezervacija i faktura iz TTA back-office ERP-a (Metabase izveštaji read-only, kasnije kontrolisan write-back sa human-in-the-loop). Otvoreno pre implementacije: MARS ne prodaje inventar gostu kao ostali M4 provajderi, pa `ProviderAdapter` ugovor (poglavlje 2 M4 spec) verovatno zahteva proširenje/novu kategoriju, ne direktnu primenu; MARS write-flow (concurrency check, `pending_approval`) je koncept koji M4 danas nema ni za jedan adapter; sekcije 6/7 originalnog dokumenta (TTA API contract, MARS API detalji) su sam autor označio kao placeholder — čeka se prava Stoplight dokumentacija. Pun originalni predlog i analiza: `docs/analize/34-PREDLOG-MARS-CONNECTOR.md`.

- **Zajednički skup izvora i trag do izvora po tvrdnji, kao dopuna M23** (nastalo iz poređenja sa Google NotebookLM, 17.8.2026; vlasnik potvrdio da predlog ima smisla, čeka odluku o obimu pre dopune spec-a) — M23 već jeste "sveska po temi" (registar odobrenih izvora, nacrti sa ljudskim odobrenjem, osvežavanje na 30 dana), i namerno je **stroži** od NotebookLM-a po pitanju porekla (samo zvaničan sajt objekta / zvanične mreže / državni portal, bez OTA i sajtova sa recenzijama, §4a). Tri konkretne razlike koje NotebookLM ima, a M23 nema:
  1. **Izvor je vezan za tačno jedan članak** (`ArticleSource.article_id` je obavezan FK, §2.3) — isti dostavljen tekst mora da se ponovo unosi za svaki naredni članak. Predlog: izvor postaje samostalan zapis, veza ka članku postaje spona (jedan izvor → više članaka).
  2. **Nema traga od pojedinačne tvrdnje do izvora** — `ArticleRevision.source_ids` (§2.4) pamti *koji* izvori su korišćeni za ceo nacrt, ne *koja rečenica odakle*. Predlog: trag po pasusu nacrta, vidljiv uređivaču pri odobravanju (§2.4 tok). **Ovo je preporučen prvi korak** — ne dira granice modula, ne otvara poverljivost, a direktno menja koliko uređivač može da veruje nacrtu koji odobrava.
  3. **Interni dokumenti nisu dozvoljeni kao izvor** — tri dozvoljena tipa (§4a) su svi spoljni web. Najvredniji materijal agencije (M3 ugovori/cenovnici, M22 prepiska, M14 reklamacije, M5 istorija rezervacija) je nevidljiv za generisanje sadržaja. Predlog: novi tipovi izvora kao **pokazivač na zapis u tom modulu, nikad kopija podatka** (princip #2 Master dokumenta ostaje netaknut).
  - Posledica koju (1)+(3) otključavaju: **otkrivanje neslaganja među izvorima** — npr. ugovor kaže prijava u 15:00, sajt hotela 14:00. Sa jednim izvorom po činjenici to je strukturno nevidljivo.
  - **Poverljivost je uslov, ne detalj.** `Article` može dobiti `share_token` i biti javno otvoren bez prijave (§5). Ako izvor postane M3 ugovor, u istom skupu su neto cene i provizije — postoji put kojim bi tekst izveden iz ugovora završio kod gosta ili subagenta sa neto cenom. Pre bilo kakve implementacije (3) mora se postaviti tvrdo pravilo: članak koji je ikad koristio interni izvor ne dobija javni link bez posebne, eksplicitne ljudske potvrde (ili se interni izvori ograniče isključivo na članke označene kao interni).
  - Ostalo otvoreno pre spec-a: da li se menja §1.2 (danas izričito zabranjuje da M23 bude izvor istine za M12 — sadržaj se ručno prekopira; most "napravi `ContentPiece` iz ovog skupa izvora" bi to pravilo svesno menjao); autorska prava nad sintezom više izvora (već otvoreno u M2 sekciji ovog fajla, skup izvora tu izloženost umnožava); i merenje troška — sinteza više dugih dokumenata je skupa operacija i mora ući u M18 budžet kao akcija sa sopstvenim tierom.
  - ~~Namerno van predloga: Audio Overview~~ — **vlasnik 22.8.2026 eksplicitno tražio da se ipak uradi**, kao video/audio uputstvo za CELU aplikaciju (ne samo M23 izvore), po uzoru na NotebookLM, kao poslednji korak kad aplikacija bude funkcionalno gotova — "da bi se maksimalno smanjila potreba za pokazivanjem". Detalji: M21 spec §8 (novi bullet, v1.7). I dalje čeka STT/TTS izbor (M15 §6.6) i izbor generatora govora/videa (nova tehnologija, `tt-tech-stack`), i dalje nije za sad — samo više nije odbačeno.

- **Mobilna/tablet aplikacija za direktorske izveštaje (vlasnik agencije)** (23.8.2026, na zahtev vlasnika: "kako mozemo da na mobilnom telefonu ili tabletu kreiramo jednu aplikaciju koja ce moci da pruza ovakve direktorske izvestaje... nekoliko podrazumevanih pitanja koji ce klikom na njih da daju odgovore ali i da se dodatno pita kao u terminalu" — eksplicitno odloženo, "ne moramo sada da radimo vec da zapamtimo za kasnije"). Moja preporuka (nije potvrđeno, čeka odluku vlasnika pre bilo kakve implementacije):
  - **NE praviti pravu nativnu aplikaciju (App Store/Play Store) u prvom prolazu.** To je nova, velika tehnička obaveza (Swift/Kotlin ili React Native, review proces prodavnica, sertifikati) za nešto što u suštini samo treba da pokaže isti `BiTerminalAgent` odgovor na manjem ekranu — nesrazmeran trošak/rizik u odnosu na korist prvog prolaza, i nova stavka tehničkog steka (poglavlje 6 Master dokumenta) koja zahteva posebnu potvrdu.
  - **Predlog: PWA (Progressive Web App) unutar POSTOJEĆEG `apps/panel`**, ne novi `apps/` projekat niti novi modul. Nova, mobilno-optimizovana ruta (npr. `/m/izvestaji`, gated isto kao terminal — isključivo `M15/bi-terminal/VIEW`/VLASNIK), koja poziva ISTI `POST /ai-orchestration/bi-terminal/query` endpoint (§6.9) — nula novog backend koda, samo novi, mobilno-prilagođen prikaz nad već postojećim API-jem. "Dodaj na početni ekran" (manifest.json + service worker) daje ikonicu na telefonu bez ijedne prodavnice aplikacija — najbrži put od odluke do upotrebe.
  - **Podrazumevana pitanja kao dugmad** (vlasnikov zahtev) — mali, kurirani skup (npr. "Prodaja danas", "Ko je danas najviše prodao", "Nenaplaćeni aranžmani", "Najbolji subagent ovog meseca") koji direktno mapira na već postojeće alate/`query_view` poglede (§6.9.6) — tap šalje tačno taj tekst kao pitanje, isti tok kao ručno kucanje. Ispod dugmadi, isto polje za slobodno pitanje kao u `TerminalPanel.tsx` — dodatna pitanja idu kroz isti kontekst-svestan tok (§6.9 v1.34, `history[]`).
  - Zašto ne mešati sa M9 (mobilna aplikacija) — M9 cilja goste i vodiče na terenu (offline-first, drugačija publika i tehnički zahtevi); ovo je uska, VLASNIK-only nadgradnja nad već postojećim M15/M17 sloju, prirodnije kao mali dodatak M17 spec-a kad dođe na red, ne prošireni obim M9.
  - Otvoreno pre spec-a: tačan skup podrazumevanih pitanja (vlasnikova odluka), da li push notifikacije ulaze u prvi prolaz (Web Push, i dalje bez nativne app-store zavisnosti, ali novi mehanizam) ili čekaju drugi prolaz, i tačan URL/nav put do `/m/...` rute.

- **Naplata po ishodu (outcome-based) umesto po pretplati/proviziji, za M7/M16** (24.8.2026, nastalo iz razgovora o spoljnom izvoru — prezentacija "Software 3.0" o promeni SaaS poslovnog modela ka naplati po završenom rezultatu umesto po korisničkom nalogu) — teza: kad AI agenti sami obavljaju posao (traže, porede, rezervišu), vrednost se sve manje meri pristupom alatu, a sve više završenim ishodom. Relevantno za dva postojeća kanala koji već imaju agentski pristup:
  1. **M16 (MCP distribucija)** — spoljni AI agent danas dobija `READ_ONLY`/`READ_WRITE` pristup po ključu (poglavlje 3.1), bez pojma naplate po transakciji; ideja bi bila naplata po uspešno završenom `confirm_booking` umesto (ili pored) fiksnog pristupa.
  2. **M7 (B2B subagenti)** — provizija je već po rezervaciji (prirodno bliska "ishodu"), ali struktura kreditnog limita/cenovnika je i dalje pretplatnički/ugovorni model odozgo, ne "plati kad se rezervacija zatvori".
  - **Otvoreno pre bilo kakve dalje razrade (poslovna odluka vlasnika, ne tehnička):** kako se meri i osporava "ishod" (delimično izvršena rezervacija? otkazana posle naplate?); ko snosi odgovornost kad AI agent sa druge strane pogrešno protumači ponudu; da li ovo uopšte menja nešto suštinski u odnosu na već postojeći M7 provizioni model. Nije prošlo kroz `tt-architecture-core` proveru niti dobilo obim od vlasnika — čista beleška da se ideja ne izgubi.

- **Post-booking reshopping/rebooking (inspiracija: Mize.tech "Hotelfare Optimization")** (22.8.2026, poređenje sa konkurentskom platformom) — Mize.tech kontinuirano ponovo proverava cenu posle potvrde rezervacije i predlaže "hotel rebooking" kad cena padne, da se zadrži/poveća marža. Kod TTA bi se prirodno naslonilo na **M4** (adapter sloj koji već zna da pita dobavljača za dostupnost/cenu) i **M5** (tok potvrđene rezervacije) — periodičan job koji ponovo upita M4 za istu jedinicu i, ako je cena niža, otvori predlog. Nije čisto tehnička optimizacija: nosi realan rizik oko dobavljačeve politike otkazivanja/rebooking-a, YUTA garancije putovanja vezane za konkretnu rezervaciju (M11) i ugovora sa gostom (M20) — pre bilo kakve implementacije zahteva prolazak kroz M11/M20 pravila, verovatno početno samo kao alarm komercijali, ne automatski rebooking. Nije prošlo kroz `tt-architecture-core` proveru niti dobilo obim od vlasnika.

---

## M1 — Core / Identitet i pristup
*(§9, `docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`)*
- Konkretna dodela dozvola po ulozi definiše se kad svaki modul dođe na red, ne unapred u M1.

## M2 — Katalog proizvoda
*(§9, `docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md`)*
- Ožičiti `ProductTranslation` na deljeni M15 `TranslationService` (M15 spec poglavlje 6.7, dodato 18.8.2026) — verovatno kroz postojeći `ProductContentImport` tok (`origin` dobija novu vrednost, npr. `AI_TRANSLATION`), isti obrazac kao M23 poglavlje 4e. Čeka da se prvo uživo proveri kroz M23.
- Pravila za `PACKAGE` proizvode i odnos cene paketa prema zbiru komponenti — čeka M3.
- Da li treba odobrenje pre prelaska proizvoda iz `DRAFT` u `ACTIVE`.
- Ograničen kapacitet za `TICKET`/`EVENT` — potvrditi da model M3 pokriva bez izmene.
- Autorska prava nad AI-uvezenim sadržajem — potvrditi sa dobavljačem/pravnikom pre objave.
- Automatsko pronalaženje sajta hotela (bez URL-a) — odloženo iz v1.
- Da li `SERVICE` treba odvojeno polje od `amenities[]` u `attributes`.
- Kineski jezik u katalogu — odloženo (avgust 2026), dodati tek uz konkretan poslovni razlog (npr. direktan let BEG–PEK, B2B partner).
- **Zakon o zaštiti potrošača (istraživanje, avgust 2026):** transparentnost online cenovnika (mašinski čitljiv format) i zabrana lažnih recenzija — proveriti primenljivost na M2/M8 sa pravnikom pre implementacije.
- **Migracija postojećeg slobodnog teksta u `AmenityTag`** (poglavlje 2.3c, 17.8.2026) — ručno mapiranje, obim/redosled nije razrađen (koliko proizvoda, ko radi).
- **`INSURANCE.attributes.coverage_regions[]`** (M5 poglavlje 3.0d.8, 17.8.2026) — struktura (lista zemalja vs. region-enum) nije razrađena, čeka implementaciju putnog osiguranja.
- **`attributes.category` vrednosti za `EXCURSION`/`EVENT`/`TICKET`** ("Things to do", M5 poglavlje 3.0d.4, 17.8.2026) — dorađuje se pri stvarnoj izradi ekrana, isti princip kao `AmenityTag`.
- **Tip kreveta u `beds` (poglavlje 2.3b), ne samo broj** (25.8.2026, na zahtev vlasnika) — `base_beds`/`extra_beds_max` danas nose samo broj kreveta, ne i tip (francuski ležaj, dva odvojena kreveta, sofa za dve osobe, pomoćni ležaj za jednu osobu...); "2+1"/"2+2"/"3+1" oznake bez tipa kreveta klijenti različito tumače. Verovatno `bed_type` enum, isti obrazac kao `AmenityTag`.

## M3 — Ugovaranje i alotmani
*(§8, `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md`)*
- Tačan format `cancellation_terms_summary` (slobodan tekst vs. strukturirano).
- Obračun konverzije valute za fakturisanje u RSD — definiše se u M10.
- Da li `PACKAGE` proizvodi mogu imati sopstveni ugovor nezavisan od komponenti.
- Break-even/P&L pregled za `CHARTER`/`FIXED_LEASE` — definiše se u M13.
- Izbor OCR provajdera za `SCANNED_PDF`.
- Da li prag od 85% (fuzzy-match pouzdanost) treba biti podesiv po dobavljaču/formatu.
- **Ograničenje tržišta porekla gosta** nema mesta u modelu ugovora (nalaz iz analize stvarnih cenovnika, avgust 2026).
- **Ograničenje po segmentu gosta** (FIT vs. grupa vs. MICE) nije pokriveno (ista analiza).
- **Obavezan minimalni markup koji nameće dobavljač** nije proveravan protiv `MarkupRule` (ista analiza).
- **Kazna za otkazivanje sa različitom osnovicom po sezoni** — proveriti granularnost `CancellationRule` (ista analiza).
- **Ponavljajući pomoćni troškovi** (kućni ljubimac, parking, rani check-in/kasni check-out, room service, povratni depozit) bez mesta u modelu (ista analiza).
- **Boravišna taksa sa sopstvenim uzrasnim pragom**, nezavisnim od `age_policy[]` — van obima (M10/M11 je isključuju), ali vredi ponovo razmotriti (ista analiza).

## M4 — Integracije spoljnih API konekcija
*(§9, `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md`)*
- Konkretni adapteri za buduće kategorije (GDS/avio, transferi, aktivnosti) — implementiraju se kasnije.
- Tačni rate-limit po provajderu — definišu se kad se zna stvarni Travelgate ugovor.
- Solvex produkcijski pristup (URL/kredencijali) — nije dobijen, test kredencijali potvrđeno aktivni (avgust 2026).
- Dedup istog fizičkog hotela preko više provajdera (Travelgate + Solvex) — nema definisan mehanizam mapiranja.
- Tačan TTL keša šifarnika po provajderu (§2.4) — 24h polazna pretpostavka, dorađuje se pri implementaciji.
- Ostali PrimeTravel provajderi (ORS, MTS Globe, Amadeus, Travelport, Duffel...) namerno nisu dodati bez potvrđene poslovne potrebe.
- `SESSION_TOKEN` ponašanje pod konkurentnim pozivima (§2.2) — svesno odloženo do implementacije.
- Rate limit se trenutno samo čita (`capabilities_profile`), nema stvaran mehanizam sprovođenja (red čekanja/throttling).
- Nema definisanog mock/test režima za simulaciju timeout-a/pada provajdera (izlazni kriterijum §8 to pretpostavlja).
- Test/produkcija nije eksplicitno modelovano u `ProviderConfig` (jedan red sa promenjenim poljima vs. dva odvojena).
- **Travelfusion kao mogući budući FLIGHT adapter (LCC/regionalni avio prevoznici)** (predlog primljen 19.8.2026, dokument sa stranom numeracijom modula — M-24/M-20/Meta Muse Glimmer ne postoje u Terminal arhitekturi, ideja svedena na M4 FLIGHT kategoriju) — istraženo: nema self-serve sandbox, cena nije javna, pristup ide preko partner ugovora sa Travelfusion-om. Isti gejt kao Duffel/Travelport iznad — namerno bez implementacione napomene dok ne postoji potvrđen ugovor/pristup. Čeka poslovnu odluku vlasnika (kontakt `sales@travelfusion.com`) pre bilo kakvog dalje rada.
- **Atlas Flight Booking Skill kao moguća referenca za budući avio adapter** (nalaz iz vesti, 19.8.2026, dopunjeno istog dana istraživanjem atlaslovestravel.com) — Atlas (Singapur) je open-source-ovao (Apache 2.0, GitHub/PyPI) alat koji AI agentu daje search/cene/dostupnost/booking preko 140+ niskobudžetnih avio-kompanija, sa 4 obavezne tačke ljudske potvrde (autorizacija, promena cene, izbor sedišta, plaćanje) — isti obrazac koji M15 registar ovlašćenja (poglavlje 7 master dokumenta) već zahteva za akcije koje pominju cenu. Tehnički Atlas ne pravi posebnu konekciju po aviokompaniji — jedan **NDC (New Distribution Capability, IATA standard)**-certifikovan API prema 140+ LCC (AirAsia, Ryanair, IndiGo...), rezervacija se kreira direktno u sistemu te aviokompanije kroz zajednički NDC sloj, bez pojedinačnih ugovora. Relevantno za M5 poglavlje 3.0d.1 ("oblik odgovora za multi-segment let... čeka M4 avio/GDS adapter") i M10 BSP poravnanje (isto "čeka M4 avio/GDS adapter") — NDC je prirodan kandidat standarda kad taj adapter dođe na red, umesto adaptera po aviokompaniji. Nije neutralan GDS standard sam po sebi nego Atlas-ov komercijalni sloj iznad NDC-a (zahteva ATRIP nalog, pretplata/transakciona naknada) — vezuje na jednog provajdera, ne zamenjuje odluku o GDS-u. Razmotriti tek kad avio/GDS adapter stvarno dođe na red u faznom planu, ne pre.

## M5 — Rezervacije i tok prodaje
*(§13, `docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md`)*
- **Vođena pretraga za 9 vrsta proizvoda** (poglavlja 3.0c/3.0d, 17.8.2026) — **u velikoj meri rešeno 22.8.2026** (M17 spec v1.79/v1.80, M5 spec v1.41): popup po tipu + "chip sa izmeni" (zamenjuje raniju stalno otvorenu formu), i 4 od 6 tip-specifičnih API parametara sad stvarno rade (`cabinClass`/`minDriverAge`/`durationNights`/`cabinType`, filtriraju nad `Product.attributes` po M2 spec §2.3 konvenciji) — prikazana SAMO za odgovarajući tip u popup-u. **Preostalo otvoreno, namerno neizmišljeno:** `origin_city` (M2 spec §2.3 nikad nije precizirala tačne ključeve unutar `attributes.route` za FLIGHT/TRANSFER/TRANSPORT) i `trip_cost` (M2 spec §2.3 eksplicitno kaže da NIJE svojstvo proizvoda — filtriranje po njemu strukturno nema smisla, verovatno pogrešno mesto u v1.28 spisku parametara, ne stvarna potreba). Čeka: (a) potvrdu konvencije za `route` podključeve pre nego što se `origin_city` doda, (b) razjašnjenje da li `trip_cost` uopšte treba da bude search-parametar ili je v1.28 to pogrešno svrstala.
- **`SearchResultOffer.is_refundable` za `API` izvor ostaje `null`** (poglavlje 3.0b.2/3.0c.3a, 18.8.2026) — potvrditi po M4 provajderu (Travelgate/Solvex) da li postoji strukturisano polje za ovo pre nego što se ikad postavi na `true`/`false`; do tada filter "Refundabilno/Nerefundabilno" prikazuje API stavke u oba filtera.
- Tačan UI izbor datuma polaska sa liste termina za `PACKAGE` (poglavlje 3.0d.6) — dizajnersko pitanje.
- **AI prepoznavanje više namera u jednoj rečenici** (poglavlje 3.0e.4, 17.8.2026) — namerno odloženo dok osnovni tok 9 pretraga ne bude uživo proveren.
- **Kalendar cena/fleksibilni datumi za letove** (Google Flights stila, poglavlje 3.0e.4) — razmatra se kao V2, zahteva infrastrukturu cena unapred za više datuma.
- **Oblik odgovora za multi-segment let** (poglavlje 3.0d.1) — čeka M4 avio/GDS adapter, namerno neizmišljeno unapred.
- **Poređenje sa STVARNOM cenom sa tuđeg sajta (scraping)** (poglavlje 13, 17.8.2026) — bezbedan deo (tumačenje nalepljenog URL-a) specificiran u M15 poglavlju 6.5.6a; puno poređenje cena namerno neimplementirano, čeka potvrdu pravnika (uslovi korišćenja OTA sajtova + tehnička nepouzdanost dinamičkih cena).
- Format vaučera (sadržaj, izgled) — definiše se kasnije.
- Tačan izgled/template operativne liste po tipu dobavljača.
- Da li slanje operativne liste ide samo email prilogom ili i strukturisanim API kanalom.
- Da li API (M4) stavke ikad zahtevaju sličan operativni dokument.
- Tačan izgled kalendara i vizuelno razlikovanje kategorija — dizajnersko pitanje.
- Vizuelni prikaz/UI za sastavljanje putovanja (itinerar) — dizajnersko pitanje.
- **Rešeno (23.8.2026, M5 spec v1.48):** "Pun zapis" forma za rezervaciju — predlog potvrđen ("Da gradi po predlogu, s tim sto cemo sigurno imati izmene i dorade"), prvi prolaz implementiran (`rezervacije/lista/[bookingNumber]/page.tsx`, mock, otvara se u novom app-tabu klikom na broj rezervacije ili dugmetom "Otvori pun zapis" iz sažetka). Dalje izmene/dorade najavljene, nisu još tražene — ne treba ponovo otvarati ovu stavku dok vlasnik ne zatraži konkretnu izmenu.
- AI predlozi za popunu praznina u itineraru — čekaju M15.
- Da li `Itinerary` treba sopstveni rok isteka (ABANDONED).
- Tačna semantika `stay_from`/`stay_to`/`occupancy` za `TRANSPORT`/`TICKET`/`EVENT` po pod-tipu.
- Automatski podsetnik gostu o roku za potvrdu/uplatu opcije kod dobavljača — zahteva dalju razradu roka, kanala i praga slanja.
- Prag za ponovnu proveru `API` cene pri `POST /quotes` (trenutno: uvek proveri ponovo) — uvodi se samo ako se pokaže preskupo u praksi, zahteva potvrdu vlasnika.
- **Zakon o zaštiti potrošača — povećanje cene posle potvrde rezervacije (istraživanje, avgust 2026):** trenutno ne postoji nikakav koncept izmene cene posle `booking.confirmed` — zakon (prema istraženim izvorima, potrebna potvrda pravnika za tačne brojeve) dozvoljava povećanje samo za gorivo/takse/kurs, ograničeno na 8% ukupne cene, uz pisano obaveštenje gostu najmanje 20 dana pre polaska. Realna pravna izloženost dok se ne implementira ili svesno ne odluči da agencija cene nikad ne menja posle potvrde.
- **Zakon o zaštiti potrošača — "opravdan razlog" izuzetak pri otkazivanju od strane gosta (isto istraživanje):** trenutni `cancellation_refund_percentage` (poglavlje 6) preuzima dobavljačevu politiku otkazivanja bez razdvajanja od onoga što firma zakonski duguje gostu, i ne postoji izuzetak za iznenadnu bolest/smrt u porodici/višu silu (gost bi tad trebalo da dobije nazad sve osim stvarnih troškova, ne standardnu naknadu po danima). Zahteva potvrdu pravnika pre spec dopune.
- **Zakon o zaštiti potrošača — minimalan broj učesnika (isto istraživanje):** `min_participants` postoji samo kao opisno polje za `EXCURSION` proizvode u M2, nema procesa automatskog otkazivanja/punog povraćaja kad se minimum ne skupi, niti rokova obaveštenja (20/7/2 dana zavisno od dužine putovanja) iz zakona. Trenutno van obima za `PACKAGE`/`ACCOMMODATION` proizvode.

## M6 — CRM (Gosti i Nalogodavci)
*(§11, `docs/moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md`)*
- Tačan period čuvanja/anonimizacije ličnih podataka gosta (pravo na zaborav) — utvrditi sa pravnikom.
- **EU Digital Identity Wallet (EUDI) kao izvor podataka gosta** (22.8.2026, Phocuswright izveštaj 2026) — eIDAS 2.0 obavezuje EU platforme na prihvatanje do kraja 2027; TT nije u obavezanom krugu, ali gost sa novčanikom bi mogao njime popuniti `GuestProfile` umesto ručnog unosa. Čeka stvarnu potražnju iz EU tržišta, ne pre.

## M7 — B2B modul (Subagenti)
*(§13, `docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md`)*
- Da li agencija treba mogućnost direktne intervencije u proviziji sub-subagenta u sporovima.
- Prilagođavanja M10 za automatsko fakturisanje provizije nazad ka subagentima.
- Konkretan LLM/tehnički mehanizam AI razgovora sa subagentom (UI/prompt dizajn).
- Tačan format/podrazumevana vrednost `ai_chat_review_threshold_amount`.
- **Vizuelni identitet po subagentu (poglavlje 2.0.5, avgust 2026)** — sopstveni domen/poddomen, uklanjanje pomena "Terminal Travel" iz pravnog teksta (čeka pravnika), pun set tokena van dve boje + logo. Ceo mehanizam čeka izgradnju portal frontend-a, koji još ne postoji u kodu.
- ~~Da li M7 portal dobija isti interakcioni obrazac kao M17~~ — **rešeno 17.8.2026** (poglavlje 2.0.6): identičan obrazac; obim podataka izričito potvrđen (sve iz prodajnog toka sem marže/nabavne cene/naziva dobavljača, moduli van prodajnog toka potpuno nevidljivi). Portal frontend sam još nije izgrađen.

## M8 — Sajt agencije (B2C prikaz)
*(§9a/§10, `docs/moduli/M08-sajt-b2c/10-SPECIFIKACIJA-M8-SAJT-B2C.md`)*
- Detalji cookie/consent banera — potvrditi sa pravnikom pri implementaciji.
- ~~"Nastavi bez naloga" (anonimni checkout, poglavlje 3 korak 3) odloženo~~ — **rešeno avgust 2026** (§9a): `POST /crm/client-accounts/guest-checkout`, javan, rate-limitovan 5/sat po IP.
- Vizuelna/screenshot provera responsive prikaza (poglavlje 9) — CSS audit urađen (bez fiksnih desktop širina), stvarna vizuelna provera čeka headless browser alat (nova zavisnost, čeka `tt-tech-stack` potvrdu) ili ručnu proveru.
- `FAQSchemaLD` (poglavlje 5.1) nije emitovan nigde — nema još FAQ sadržaja na stranici proizvoda da bi bio uslovno prikazan.
- **"Jasnoća pre estetike" smernica za buduću vizuelnu doradu** (20.8.2026, zapaženo iz spoljnog izvora, vlasnik potvrdio) — 4 merljiva kriterijuma (5s test jasnoće, mobilni budžet ~1.5s, izbegavati scrolljacking, F-obrazac raspored), različit standard od M17 (M8 cilja konverziju, M17 funkcionalnost). Nije spec, čeka narednu UX doradu M8.
- **SEO/GEO — Google AI Overviews/AI Mode i "Preferred Sources" (21.8.2026, zapaženo iz spoljnog izvora)** — Google sve više sažima odgovore direktno u pretrazi (AI Overviews/AI Mode), pa organski klik na sajt opada; relevantno za M8 sadržaj (destinacije/proizvodi) tek kad sajt dobije svoju SEO dorаdu — sadržaj treba strukturirati mašinski čitljivo (schema.org markup, jasni FAQ blokovi/odgovori na pitanja) da bi AI Overviews mogao da ga citira (GEO — Generative Engine Optimization), ne samo klasičan SEO. Dugme "Preferred Sources" je namenjeno izdavačima/medijima, nije primenjivo na komercijalni prodajni sajt kao M8. Čeka narednu SEO/UX rundu M8, nije spec.

## M9 — Mobilna aplikacija
*(§9, `docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`)*
- Tačna dubina unapred preuzetih podataka (14 dana je predlog) — podesivo.
- Konkretan provajder push notifikacija — bira se pri implementaciji.

## M10 — Finansije i računovodstvo
*(§12, `docs/moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md`)*
- Tačan tehnički ugovor sa SEF v4.0.0 i izabranim ESIR/fiskalnim rešenjem — potvrditi sa knjigovođom.
- Automatski dnevni uvoz NBS kursa — za sada moguć i ručni unos.
- Ograničenje gotovine (AML) — potvrditi sa pravnikom da li je ručna procedura dovoljna.
- Kurs pri više uplata u različitim danima (avans + balans) — zahteva potvrdu knjigovođe.
- Izbor konkretnog PCI-DSS platnog provajdera koji podržava RSD/lokalne kartice. **Do tada:** `card/initiate` odgovor izlaže `gatewayTransactionId` i M8 sam poziva `card/webhook` odmah posle initiate (simulira korak provajdera, poglavlje 7.1/7.2 dopuna avgust 2026) — ukloniti čim stvaran hostovani checkout postoji.
- Granični slučajevi PDV po sistemu marže (mešoviti aranžmani) — zahtevaju potvrdu knjigovođe.
- Pravna posledica `buyer_acceptance_status = EXPIRED`/`REJECTED` kod SEF fakture.
- BSP poravnanje — mehanizam definiše se kad M4 dobije avio/GDS adapter.
- Da li obaveze prema van-M3 dobavljačima ulaze u `SupplierObligation`.
- Izbor platnog provajdera za `VIRTUAL_CARD` isplate dobavljačima.
- Tačan tehnički format kojim SEF prihvata `KNJIZNO_ODOBRENJE` — potvrditi sa knjigovođom.
- FX rizik kod `BANK_TRANSFER` isplata u stranoj valuti — potvrditi sa knjigovođom.
- `buyer_acceptance_status → EXPIRED` prelazak nije implementiran (nema periodičnog posla koji proverava istekle 15-dnevne rokove) — dodato pri implementaciji, avgust 2026.
- `virtual_card_reference` nema programsku zaštitu od unosa punog broja kartice — dodato pri implementaciji, avgust 2026.
- **Zakon o zaštiti potrošača — rok povraćaja novca (istraživanje, avgust 2026):** `RefundInstruction` (poglavlje 8.5.3) prati status (`PENDING → APPROVED → EXECUTED`) ali nema rok/deadline polje niti alarm — zakon (prema istraženim izvorima, potrebna potvrda pravnika) traži povraćaj u roku od 14 dana od otkazivanja. Isti obrazac kao `buyer_acceptance_deadline` (§6) samo primenjen na refundaciju — mehanička dopuna kad se rok potvrdi.

## M11 — Regulatorni modul (Compliance)
*(§7, `docs/moduli/M11-compliance/08-SPECIFIKACIJA-M11-COMPLIANCE.md`)*
- Tačan tehnički ugovor za CIS registraciju garancije i skidanje opterećenja pri stornu — implementirano kao `MockCisGatewayAdapter` dok se ne potvrdi.
- Lep PDF/nativni XLSX format izvoza za inspekciju — trenutno JSON + CSV (bez nove biblioteke), čeka izbor konkretne biblioteke sa vlasnikom.
- Da li M11 treba da prati i druge licence/dozvole agencije van YUTA garancije.
- Alarm za rok važenja putne isprave gosta — gde ga vratiti (verovatno M6 `GuestProfile`).
- `assessForBooking` (§2.2, blokada potvrde ORGANIZATOR rezervacije preko limita garancije) baca grešku umesto sigurnog ponašanja kad booking-ova valuta nema uneti kurs — otkriveno avgust 2026 (M17 Faza 2), zahteva odluku vlasnika (§7 tog dokumenta za detalje).
- **Osiguranje od AI-generisanih grešaka** (avgust 2026, analiza rizika povodom spoljnog izvora) — proveriti sa brokerom pre nego što bilo koji M15 domenski agent pređe u `ACTIVATED` u produkciji. Detalji: `docs/analize/31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 3, i `26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` stavka B6.

## M12 — Marketing i sadržajni engine
*(§9, `docs/moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md`)*
- Ožičiti `ContentTranslation` na deljeni M15 `TranslationService` (M15 spec poglavlje 6.7, dodato 18.8.2026) — polje `translation_source=AI_GENERATED` već postoji, mehanizam koji ga stvarno puni za nove jezike još ne. M23 je prvi stvaran potrošač (poglavlje 4e tog dokumenta); M12 čeka da se taj obrazac uživo proveri.
- Tačan izbor društvenih mreža/kanala za lansiranje — potvrditi pre implementacije adaptera.
- Ako se pronađe raniji "Content Engine" predlog pomenut u Master dokumentu, uporediti i uskladiti.
- Puna analitika angažovanosti sa platformi (impressions/klikovi, otvaranje mejla) — namerno van obima, samo atribucija ka rezervaciji je pokrivena (poglavlje 3a).

## M13 — Izveštavanje i BI
*(§9, `docs/moduli/M13-bi/13-SPECIFIKACIJA-M13-BI.md`)*
- Tačan skup KPI-jeva koje AI agent proaktivno ističe — širi se po potrebi.
- Break-even/P&L izveštaj za `CHARTER`/`FIXED_LEASE` periode — dodaje se kad se pokaže potreba.
- Sačuvani/preporučeni preseti redosleda dimenzija za dinamički izveštaj — UX pogodnost za M17.

## M14 — Podrška / Helpdesk
*(§8, `docs/moduli/M14-helpdesk/14-SPECIFIKACIJA-M14-HELPDESK.md`)*
- SLA pravila za ostale kategorije tiketa (npr. automatsko eskaliranje tehničkog problema).
- Integracija sa M9 mobilnom aplikacijom za goste (Faza 6).
- **Zakon o zaštiti potrošača — rok gosta za prijavu reklamacije (istraživanje, avgust 2026):** poglavlje 3 ispravno prati 8-dnevni rok agencije za odgovor (`zzp_response_deadline`), ali ne ograničava kada gost sme da otvori `REKLAMACIJA` tiket u odnosu na datum povratka — zakon (potrebna potvrda pravnika) daje gostu 15 dana posle povratka da prijavi.

## M15 — AI agentska orkestracija
*(§11, `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`)*
- **`query_view` ne pokriva "hitne" notifikacije po rezervaciji** (24.8.2026, na zahtev vlasnika — "Ostavi za kasnije") — "hitno" postoji samo kao mock podatak na M5 panel listi, nema pravu tabelu; čeka i M5 pravu bazu i deterministička pravila za "hitno" nad stvarnim podacima pre nego što se doda `query_view` pogled.
- Tačan raspored uvođenja agenata po modulu — zavisi od redosleda stabilizacije u produkciji.
- Konkretan izbor LLM provajdera/modela po domenskom agentu.
- ~~Konkretan izbor Speech-to-Text provajdera za glasovni modalitet (poglavlje 6.6)~~ — **delimično rešeno 22.8.2026**: M17/interni tim kanal implementiran preko browser Web Speech API-ja (bez spoljnog provajdera, audio ne napušta uređaj). TTS (glas iz aplikacije ka korisniku) i spoljni STT provajder za slučaj da browser-native ne bude dovoljan ostaju otvoreni.
- Glasovni kanal za M7/M8/M9 (subagenti, gosti) i prava telefonija/IVR — namerno van obima prve verzije (samo M17/interni tim preko mikrofona), zahteva zasebnu potvrdu vlasnika.
- **Periodično uzorkovanje `actor_type = AI_AGENT` audit log zapisa radi merenja stope halucinacija/grešaka** jednom kad prvi domenski agenti budu aktivni u produkciji (avgust 2026, analiza rizika povodom spoljnog izvora) — mala dopuna M18 operativnog nadzora, ne hitna. Detalji: `docs/analize/31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 2.
- ~~**"Razgovarate sa AI asistentom" oznaka (transparentnost, EU AI Act)**~~ — **rešeno avgust 2026 za M8 B2C_SITE**: trajno vidljiva oznaka dodata u `apps/web/src/components/OmnisearchBar.tsx` (ne dismissible toast), live potvrđena u renderovanom HTML-u svake stranice sajta. M7 `subagent_chat` i M23 `/znanje/:share_token` (kad M8 dobije stranicu koja poziva AI, van omnisearch trake) i dalje čekaju svoj UI trenutak — ostaje otvoreno za te dve stavke. Detalji: `docs/analize/31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 4.
- ~~M21 v1 ne pokriva anonimne/INDIVIDUAL B2C goste~~ — rešeno avgust 2026, vidi M21 red ispod.
- **Obrada ličnih podataka gosta/nalogodavca kod spoljnog LLM provajdera (DPA/retention/rezidencija podataka)** (18.8.2026, na zahtev vlasnika) — proveriti sa pravnikom pre nego što bilo koji domenski agent koji dodiruje lične podatke pređe u `ACTIVATED` u produkciji; ponoviti proveru za svaki naredni provajder (poglavlje 11 ovog dokumenta ostavlja izbor po agentu otvoren, uslovi se razlikuju po provajderu). Detalji: `docs/analize/31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 5, i `26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` stavka B7.
- **Pravi web search provider za `BiTerminalAgent`/`propose_web_fetch`** (23.8.2026, na zahtev vlasnika — §6.9.7 v1.31 podržava samo fetch KONKRETNOG URL-a, ne opštu pretragu) — čeka izbor provajdera (Brave/Google/Bing Search API), nova tech-stack stavka, Master dokument poglavlje 6.
- **`OmnisearchAgent` UI ožičenje za opštu pretragu interneta uz odobrenje** (poglavlje 6.5.6b M15 spec) — mehanizam (`safeFetchText`, `WebContentSafetyAgent`, `M15_WEB_RESEARCH` gate) je zajednički i već izgrađen za `BiTerminalAgent` (v1.31), `OmnisearchAgent` još nema sopstven alat/UI element za ovaj tok.

## M16 — Agentski distribucioni interfejs (MCP)
*(§10, `docs/moduli/M16-mcp-distribucija/17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md`)*
- **Rešeno (avgust 2026):** MCP wire-protokol implementiran (2026-07-28 spec). Oblik odgovora ostao pljosnat (isti DTO kao M5), poruke o greškama za write-alate su akcione.
- Pun OAuth 2.1 authorization server (dinamička registracija, PKCE, discovery) — prvi prolaz koristi jednostavan unapred-deljen ključ, potvrđeno vlasnikom kao svesna odluka.
- Mehanizam agentskog plaćanja — proveriti stanje standarda pre uvođenja (trenutno `confirm_booking` potvrđuje bez naplate, `UNPAID`). Dopuna 22.8.2026 (Phocuswright izveštaj 2026): razmotriti granularne novčane limite po MCP klijentu (`max_transaction_amount_eur`), ne samo binarni READ_ONLY/READ_WRITE, po uzoru na M18 `budget_limit_eur`.
- Da li je potreban poseban ugovor/uslovi korišćenja sa svakom eksternom platformom.
- Automatsko obaveštavanje tima o neuobičajenom obrascu poziva (rate limiter trenutno samo blokira, ne alarmira).
- **`MCPClientRegistration` vezan za konkretnog subagenta (M7 cenovnik/kreditni limit umesto B2C cene)** (22.8.2026, na zahtev vlasnika — strateško: subagenti mogu graditi sopstvene AI aplikacije koje "razgovaraju" sa TT preko MCP-a umesto ručnog korišćenja M7 portala) — nedostaje `sub_agent_id` polje i grananje ka M7 pravilima u `McpToolsService`. Ne zamenjuje M7 portal, dodatni kanal za tehnički napredne subagente. Detalji: M16 spec poglavlje 10.
- **Buduće labavljenje/ukidanje ručnog `READ_WRITE` odobrenja (Vlasnik/Direktor), po MCP alatu i po klijentu** (22.8.2026, vlasnikova odluka: tvrdo pravilo važi za početak dok se ne stekne poverenje, kasnije olabaviti) — `create_quote`/čitanje pre `confirm_booking`/`cancel_booking` (potonja dva nikad bez ljudske potvrde, isto pravilo kao M15 registar ovlašćenja). Detalji: M16 spec poglavlje 3.1/10.

## M17 — Interni radni panel
*(§8, `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`)*
- Razmotriti zaseban modul za notifikacije/podsetnike ako agregacija upozorenja postane nedovoljna.
- ~~Obeležavanje autora radnje (§3.1)~~ **Rešeno (17.8.2026)** — `ActorLabel` na osam ekrana, live-provera dovršena u oba moda; usput ispravljen pad kontrasta AI bedža i "Invalid Date" u audit logu.

## M18 — Operativni nadzor i AI optimizacija
*(§11, `docs/moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md`)*
- Dodavanje `VIBER`/`WHATSAPP` kanala obaveštenja.
- Tačan prag za "neuobičajen skok" po tipu signala — podešava se empirijski u produkciji.
- Konkretan iznos `budget_limit_eur` (globalno i po agentu) i period — poslovna odluka pri implementaciji (§6.5).
- Da li bezbednosno kritične akcije treba da imaju sopstveni, odvojeni budžet umesto deljenog (§6.5).
- **Provera "bez modela" liste (§6.2, 11 akcija) pri aktivaciji svakog domenskog agenta** (18.8.2026, na zahtev vlasnika) — pre nego što M5/M7/M10/M14/M20 domenski agent pređe u `ACTIVATED`, proveriti da kod za tu deterministički-opisanu akciju zaista ne poziva jezički model.

## M19 — Komunikaciona platforma
*(§11, `docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md`)*
- Da li interni chat treba grupne kanale po timovima od starta.
- Pretraga istorije poruka — dodaje se ako obim komunikacije to zahteva.
- Obaveštavanje dobavljača o novoj poruci van portala (email/SMS ping).
- Da li portal dobavljača dobija PWA instalaciju.
- Zaštita od zloupotrebe/spama na javno dostupnom portalu za spoljne naloge.
- **Brisanje/izmena poruke ima API, nema UI dugme** (22.8.2026) — `DELETE`/`PATCH messages/:id` postoje, panel `/chat` ih ne poziva; arhiviranje konverzacije ne postoji ni u API-ju.
- ~~Panel (M17) chat ekran~~ — **rešeno avgust 2026 (M17 Faza 7)**, `apps/panel/src/app/(app)/chat/`, uživo provereno. Mobilni (M9) chat tab ostaje poseban naredni korak (M9 još nema kod).
- Puna WS e2e integracija u test suite-u (pravi socket.io klijent) — jedinični test sa mock socket-ima za sada.
- ~~Evidencija AI porekla poruke (§2.3/§9.5)~~ **Rešeno (avgust 2026)** — polja, migracija, tok slanja i prikaz u panelu; potvrđeno e2e testom protiv prave baze.

## M20 — Ugovori sa klijentima
*(§8, `docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md`)*
- Tačan izgled/template ugovora po `contract_type` — dizajnersko/pravno pitanje, implementirano kao `MockContractDocumentGeneratorAdapter` dok se ne potvrdi.
- Tačan trenutak kad prihvatanje/potpis mora biti završen u odnosu na izdavanje vaučera.
- `contract_type = PRODAJA_AVIO_KARTE`/`TRANSFER` — uskladiti sa PDV pitanjem iz M10.
- `KORPORATIVNI_OKVIRNI` tip čeka punu razradu B2B okvirnih ugovora.
- Samostalna prodaja `INSURANCE` proizvoda ne odgovara nijednom postojećem `contract_type` — trenutno se automatsko generisanje ugovora svesno preskače za samo-INSURANCE rezervacije.
- Ownership-scoping za `GET /client-contracts` (Prodajni agent/Gost "sopstveno") nije implementiran na nivou servisa, samo kao dozvola po ulozi.

## M21 — Centar za pomoć (baza znanja + AI asistent)
*(backend implementiran avgust 2026 — `apps/api/src/modules/m21-centar-za-pomoc/`; §8, `docs/moduli/M21-centar-za-pomoc/23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md`)*
- ~~Tačna podela `EDIT`/`PUBLISH` dozvola za help sadržaj~~ — rešeno: HR ima EDIT za sve četiri publike, PUBLISH isključivo Direktor/Vlasnik (seed.ts).
- Ožičiti `HelpArticleTranslation` na deljeni M15 `TranslationService` (M15 spec poglavlje 6.7, dodato 18.8.2026) — isti obrazac kao M23 poglavlje 4e, ne novi mehanizam. Čeka da se prvo uživo proveri kroz M23.
- Tačan prag/algoritam grupisanja pitanja za `HelpArticleSuggestion` — polazna vrednost postavljena (3+ u 30 dana, `HelpSuggestionsService`), fino podešavanje čeka stvarnu količinu pitanja u produkciji.
- ~~M17 UI ekran za Centar za pomoć~~ — **rešeno avgust 2026 (M17 Faza 7)**, `apps/panel/src/app/(app)/pomoc/`, uživo provereno. M7/M8 UI (subagenti/korporativni klijenti) ostaje poseban naredni korak.
- ~~Proširenje na pojedinačne (INDIVIDUAL) krajnje goste (M8/M9)~~ — **rešeno avgust 2026 (vlasnikova odluka).** Nova publika `PUBLIC_GUEST` pokriva i anonimne i INDIVIDUAL B2C goste (`resolveHelpAudience` prihvata `userId=null`); omnisearch (`tryHelpCenter`) ne preskače više anonimnog pozivaoca. 4 startna DRAFT FAQ članka seedovana, čekaju objavu kroz `apps/panel/src/app/(app)/pomoc/`.
- Da li M8/M9 UI za korporativne klijente/PUBLIC_GUEST treba poseban vizuelni prikaz Centra za pomoć ili generički help widget — ostaje otvoreno, ova dopuna pokriva samo backend (M21) i M15 omnisearch poziv.
- Da li `HelpAudience`/`HelpAudienceContext` (dva odvojena enuma sa istim vrednostima) treba spojiti u jedan — nije potvrđeno da je razdvajanje bilo namerno, dopuna avgust 2026 svesno nije spojila enume.
- Da li agent dobija ograničen pristup živim podacima (npr. kreditni limit subagenta) u budućoj verziji.
- **Sadržaj po modulu nedostaje za STAFF/SUBAGENT/BUSINESS_CLIENT** (22.8.2026) — mehanizam radi, samo `PUBLIC_GUEST` ima seedovan sadržaj. Pisati po modulu kad se M17 ekran stabilizuje, iz istog materijala kao `00-OBJASNJENJE-M<broj>-ZA-VLASNIKA.md`.
- **Video/audio uputstvo za celu aplikaciju (NotebookLM stila)** (22.8.2026, vlasnik eksplicitno tražio) — poslednji korak kad je aplikacija gotova, čeka STT/TTS i generator izbor.

## M22 — Email/Inbox platforma
*(§10, `docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md`)* — backend implementiran avgust 2026 (`apps/api/src/modules/m22-email-inbox/`).
- ~~Izbor konkretnog email provajdera/API-ja~~ — rešeno za ovaj prolaz: generički `EmailProviderAdapter` sa mock implementacijom (isti obrazac kao M4), bez žive konekcije. Kad vlasnik izabere pravog provajdera (Gmail API/Microsoft Graph/IMAP-SMTP), samo nova adapter klasa.
- Pristup ličnim (van-agencijskim) mejl nalozima zaposlenih — zahteva IT/pravnu potvrdu, i dalje otvoreno.
- Real-time chat sa dobavljačima ostaje potpuno odvojen otvoren gap.
- Tačan mehanizam podešavanja "auto-send" praga za informativne kategorije.
- Pretraga/arhiva starih niti i period čuvanja mejlova (retencija) — van obima ove verzije.
- ~~M17 ekran (interni panel prikaz inbox-a)~~ — **rešeno avgust 2026 (M17 Faza 7)**, `apps/panel/src/app/(app)/email/`, uživo provereno.
- **"Compose" — napisati i poslati nov mejl proizvoljnom primaocu** (23.8.2026, otkriveno pri M15 §6.9.3 dopuni — `BiTerminalAgent` je trebalo da može da pošalje izveštaj mejlom, ali M22 danas ume samo da odgovori unutar postojećeg niza poruka) — zaseban zadatak, M22 spec `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md` poglavlje 11.

## M23 — Znanje
*(§10, `docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md` — backend implementiran avgust 2026)*
- ~~M17 ekran (interni tim)~~ — **rešeno avgust 2026 (M17 Faza 7)**, `apps/panel/src/app/(app)/znanje/`, uživo provereno. M7 portal prikaz (subagenti) ostaje poseban naredni korak.
- ~~Frontend `/znanje/:share_token` stranica (M8)~~ — **rešeno avgust 2026**, `apps/web/src/app/[locale]/znanje/[shareToken]/page.tsx`, uživo provereno.
- Živa web pretraga/scraping izvora, umesto ručno dostavljenog teksta — v1 potvrđeno bez toga (može zahtevati proveru uslova korišćenja platforme).
- Prošireno na javnu pretragu za goste (M8/M9), umesto samo deljenog linka.
- AI Q&A/glas za subagente (M7) — v1 daje im samo čitanje već objavljenih članaka.
- Prava integracija sa Viber/WhatsApp/Telegram/email API-jima za deljenje, umesto ručnog kopiranja linka.
- Tačan prag/algoritam za grupisanje ponovljenih `QUESTION_GAP` pitanja na istu temu — v1 namerno ne kreira `ArticleRevision` automatski iz zahteva, samo audit trag.
- Da li `Article` za destinaciju/zemlju treba hijerarhiju (država sadrži destinacije) ili ravna lista sa filterom je dovoljna.

## Dizajn sistem UI (cross-modularno)
*(§8, `docs/analize/29-DIZAJN-SISTEM-UI.md`)*
- Tačne HEX vrednosti palete (za oba moda) — biraju se pri izradi prvog stvarnog ekrana, obavezno u skladu sa pravilom kontrasta (§2a — WCAG AA minimum).
- Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17 ili prilagođenu verziju.
- Da li izbor tamnog/svetlog moda treba sinhronizaciju preko uređaja (backend polje) ili ostaje lokalno.
- Tačna paleta semantičkih boja za isticanje teksta (upozorenje/greška/uspeh) — bira se sa HEX vrednostima.
- Gornja granica broja istovremeno otvorenih tabova (§5a) i ponašanje kad se dostigne.
- ~~`text-accent` na `bg-accent-soft` pada WCAG AA u svetlom modu (3.96:1)~~ **Rešeno (17.8.2026)** — nalaz iz M17 live-provere, ispravljeno na svih 17 mesta u panelu (`text-accent-strong`, 5.98:1 svetli / 8.86:1 tamni). Pored očekivanih statusnih oznaka i bedževa, obuhvaćeno je i **pet dugmadi sa `hover:bg-accent-soft`** — tekst im je na običnoj pozadini prolazio, ali je na hover-u padao na istih 3.96:1 (§2a izričito traži proveru protiv pozadine *u tom trenutku*, ne jedne pretpostavljene). Pravilo upisano u `29-DIZAJN-SISTEM-UI.md` §2a.

## Infrastruktura / zavisnosti (cross-modularno)
- Nadogradnja NestJS 10→11, Next.js 14→16 i next-intl 3→4 (sve major) pre produkcije — `npm audit` (13.8.2026, posle dodavanja M8/`apps/web`) pokazuje 30 ranjivosti (12 high/15 moderate/3 low). U pravoj putanji zahteva (ne samo dev-alati poput `@nestjs/cli`/`@angular-devkit`/`eslint-config-next`): `express`/`body-parser`/`multer`/`qs`/`@nestjs/core`/`@nestjs/swagger`/`js-yaml`/`lodash` (API), i `next`/`next-intl`/`postcss` (web — HTTP request smuggling, DoS, open redirect). Sve zakrpe zahtevaju major skok, nema patch/minor rešenja. Trenutno nizak stvaran rizik — nema produkcionog hostinga (EU provajder namerno još nije izabran). Uraditi kao izolovan zadatak (ne usred rada na poslovnim modulima), sa punom e2e regresijom posle — prirodno uz izbor hosting provajdera pred lansiranje.

---

## Napomena o prioritetu

Ovaj fajl namerno **ne rangira** stavke po prioritetu — to je odluka vlasnika u trenutku kad se na njih vraćamo, ne nešto što treba unapred pretpostaviti u dokumentu. Grupe koje se prirodno nameću kao "prvo pitati pravnika/knjigovođu" (većina M10/M11 stavki, cookie baner u M8, retencija podataka u M6/M22) su označene u originalnom tekstu tog modula rečju "pravnik"/"knjigovođa" — pretraga po toj reči kroz `docs/moduli/` daje brz filter kad dođe vreme za tu rundu pitanja.
