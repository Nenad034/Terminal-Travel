# 35 — Istraživanje: GetYourGuide/Viator (OTA aktivnosti), MCP kao dokaz koncepta, i lokacijski audio-vodič vezan za rezervaciju

**Status:** Beleška iz spoljnog istraživanja (25.8.2026, na zahtev vlasnika), čeka `tt-architecture-core` proveru i vlasnikovu odluku o obimu pre bilo kakve dopune specifikacije ili koda. Ništa ovde nije potvrđeno niti spec.

**Napomena o izvoru:** sadržaj dolazi iz spoljnog istraživanja (citati sa indeksima poput `24-1`, `26-1`...) koje je vlasnik doneo u razgovor. Tehnički detalji o GYG/Viator API-jima i trećestranim audio-guide aplikacijama su iz tog izvora, ne verifikovani direktno od strane implementatora — pre bilo kakve integracije potvrditi kroz zvaničnu dokumentaciju provajdera (isto pravilo kao za Travelfusion/Duffel u M4 backlogu).

---

## 1. GetYourGuide (GYG) — konkurentski pravac, informativno

GYG-ov Spring 2026 release cilja **poverenje i konverziju**, ne AI iskustvo na licu mesta: AI-sažeci recenzija, personalizovana pretraga za putnike, i na operatorskoj strani inbox sa AI-predloženim odgovorima i dashboard-ima. Teza izvora: putnici koriste AI da *planiraju*, ne da *rezervišu* aktivnosti — GYG cilja baš tu rupu.

Tehnički slojevi: Connectivity API (dostupnost/rezervacije) i Partner API (OpenAPI spec na GitHub-u). Produkcijski pristup zahteva registraciju i **trofaznu sertifikaciju** — realno nedelje pregovora, ne razmena ključeva. Isti obrazac gejta kao Travelfusion/Duffel (M4 backlog) — nema implementacione napomene dok ne postoji potvrđen ugovor/pristup.

**Relevantno za TT:** samo kao informacija o pravcu tržišta, nema direktnu akciju dok se ne pokaže poslovna potreba za GYG kao M4 EXCURSION/ACTIVITY izvor.

## 2. Viator — zvaničan hostovani MCP server, dokaz koncepta za M16/M15

Viator ima **hostovan MCP server** (`https://exp-app-mcp.prod.ep.viator.com/mcp`) koji AI agenti (Claude, ChatGPT, Cursor...) direktno povezuju bez lokalne instalacije, pretražuju/rezervišu ture prirodnim jezikom. Autentifikacija: OAuth pri prvom povezivanju, kredencijali se ponovo koriste za buduće sesije.

Alati uključuju: pretragu/poređenje ("uporedi Rim Koloseum skip-the-line iskustva" je demonstrirani primer iz izvora), obogaćene detalje proizvoda (opis, isticanja, slike, cena, trajanje, click-out URL), i MCP App resurs koji prikazuje ponude u interaktivnom UI unutar konverzacije.

**Bitno ograničenje:** MCP sloj je danas *discovery/inspiracija*, ne pun transakcioni pristup — stvarna rezervacija (cene, dostupnost u realnom vremenu, booking) i dalje ide kroz klasičan Partner/Supplier API preko partner portala, ne kroz MCP. Konzistentno sa ranije pomenutom statistikom (17% završava rezervaciju kroz AI, 69% samo istražuje — izvor iz ranijeg istraživanja, nije ovde ponovo proveren).

**Relevantno za TT — dva odvojena pravca, ne mešati:**

a) **Kao dokaz koncepta za M16** (već izgrađen MCP sloj, poglavlje... vidi `tt-m16-mcp-distribucija`) — Viator potvrđuje da veliki OTA igrači idu istim arhitektonskim pravcem (MCP kao spoljni distribucioni kanal). Ne zahteva akciju, samo potvrđuje da je pravac razuman.

b) **Kao mogući dopunski M4 izvor** (ne zamena za sopstveni inventar) — kad gost traži nešto što TT nema u sopstvenom katalogu (M2/M3 direktni ugovori), agent bi mogao da pretraži Viator/GYG i predloži opciju treće strane, sa jasnom oznakom da nije sopstveni proizvod. Ovo je **suštinski nova kategorija ponude** (treća strana, bez sopstvene marže/ugovora, samo posredovanje/afilijacija) — ne uklapa se direktno u postojeći `ProviderAdapter` M4 obrazac (koji pretpostavlja da TT prodaje inventar kao svoj, poglavlje 2 M4 spec). Zahteva:
   - Odluku da li TT uopšte želi da prodaje/preporučuje tuđi inventar sa click-out (pravno/poslovno pitanje — provizija? odgovornost? YUTA garancija putovanja se odnosi na ono što TT organizuje, ne na click-out kod treće strane — M11 razgraničenje).
   - Ako da, nov tip u M2 katalogu ili potpuno odvojen prikaz van `Product` modela (jasno obeležen kao "spoljna ponuda", ne sopstveni proizvod).
   - MCP klijentska strana (TT kao MCP *klijent* ka Viatoru) je nov obrazac — do sada je M16 specificiran kao TT MCP *server* (izlaže se ka spolja), ne kao potrošač tuđeg MCP servera. Ovo zahteva `tt-architecture-core` proveru pre bilo kakve dalje razrade.

**Nije prošlo kroz `tt-architecture-core` proveru niti dobilo obim od vlasnika.**

### 2.1 Vlasnikova odluka — "individualna putovanja let+hotel+transfer+izlet" preko Viator-a (25.8.2026)

Vlasnik želi da TT gostu sastavlja individualna putovanja iz četiri komponente (let + hotel + transfer + izlet), sa Viator-om kao izvorom za komponentu izleta. Razjašnjeno u razgovoru:

- **Viator pokriva samo izlete/aktivnosti/ulaznice** — ne prodaje letove ni hotele. Od četiri tražene komponente, danas postoji samo hotelska (M4: Travelgate/Solvex/WebHotelier). Let (avio/GDS) i transfer nemaju još nijedan konkretan adapter — obe su samo najavljene buduće M4 kategorije (vidi M4 backlog iznad, i Travelfusion/Atlas stavke).
- **Za pravu rezervaciju u realnom vremenu (ne samo pretragu)** treba Viator Partner/Supplier API, što zahteva formalnu partnersku registraciju (ugovor, verovatno provizioni model) — MCP sloj (odeljak 2 iznad) tu ne pomaže, samo je discovery.
- **Pravna posledica** — kad TT sastavi let+hotel+transfer+izlet kao jednu prodajnu celinu, to vrlo verovatno postaje "paket aranžman" po zakonu → YUTA garancija putovanja (M11) prati isto pravilo kao svaki drugi `PACKAGE` proizvod (M2), bez obzira što komponenta izleta dolazi od spoljnog izvora (Viator). Mehanizam za ovo već postoji u arhitekturi (M2 `PACKAGE`, M11) — treba samo potvrditi da spoljna komponenta ne menja obavezu, ne graditi novi mehanizam.

**Vlasnikova odluka (25.8.2026), oba pitanja postavljena direktno:**
1. **Obim prvog koraka:** Vlasnik bira da **sačeka kompletnu viziju** — ne pokreće se Viator integracija izolovano dok se ne reše i avio/GDS i transfer adapter, da bi se cela "let+hotel+transfer+izlet" funkcija radila odjednom, ne parče po parče. **Praktična posledica:** ova stavka je sada eksplicitno blokirana na dve postojeće otvorene M4 stavke — avio/GDS adapter (izbor standarda, verovatno NDC, vidi M4 backlog Atlas/Travelfusion beleške) i transfer adapter (još nema ni predloga provajdera). Ne raditi Viator deo pre nego što ta dva budu bar specovana.
2. **Partnerski pristup:** Vlasnik želi **prvo spec na papiru**, ne pokretanje partnerske registracije sa Viator-om. Znači: sledeći korak (kad avio/transfer budu spremni) je dopuna M4 specifikacije (isti obrazac kao MARS/Travelfusion predlozi — predlog → potvrda vlasnika → upis u dokument), NE kontakt sa Viator-om.

**Status:** blokirano na avio/GDS i transfer M4 adaptere. Ne otvarati ponovo dok ta dva ne dobiju bar predlog specifikacije.

## 3. Lokacijski (GPS-trigerovan) audio-vodič vezan za konkretnu rezervaciju

Vlasnikova ideja (itinerer → poslat na telefon → GPS/lokacijski trigerovan audio na licu mesta) poklapa se sa zrelim, dokazanim tržišnim segmentom — VoiceMap, GuideAlong, TravelStorys, TalkieWalkie, Gamana rade ovo godinama. Mehanizam: audio se automatski pušta na osnovu GPS lokacije dok korisnik hoda/istražuje. Neke app (TalkieWalkie, Gamana) idu dalje — AI naratori sa različitim ličnostima (istoričar, lokalac, arhitekta) i chat unutar ture za pitanja u hodu.

**TT-ova potencijalna diferencijacija u odnosu na te samostalne app-ove:** ne generička audio-guide aplikacija za sve destinacije, nego **produžetak konkretne TT rezervacije** — turista koji je kupio paket dobija personalizovan itinerer koji već zna raspored, interesovanja, jezik, uklopljen sa transferima/hotelom/kartama koje je TT već obezbedio (M5 rezervacija kao izvor konteksta).

**Tehnička prepreka — GPS pouzdanost na terenu:** lokacije poput Koloseuma su delom podzemni/kameni kompleksi gde GPS signal zna da bude nepouzdan. Ozbiljne implementacije (npr. Situate) kombinuju GPS sa Bluetooth beacon-ima ili NFC tagovima za tačnu detekciju unutar objekta. Čist GPS ne bi bio dovoljan za pouzdano trigerovanje unutar samog Koloseuma — potreban je ili beacon/NFC sloj (zahteva fizičku infrastrukturu koju TT ne kontroliše — zavisi od toga da li lokacija već ima takvu infrastrukturu) ili fallback na ručni mehanizam ("tapni na tačku na mapi"), što je standardna opcija kod postojećih app-ova.

**Video generisan iz teksta — NE za on-site iskustvo.** Tehnologija (Sora 2, Veo 3.1, Runway) postoji i koristi se u turizmu, ali skoro isključivo za **pre-trip marketing i preview** (destination preview video, personalizovan "welcome" video posle rezervacije, promo klipovi) — jedan hotelski sistem sa HeyGen API-jem za video pre dolaska zabeležio je 22% rast upsell stope (navod iz izvora). Za on-site trenutak (turista ispred spomenika) video nije prirodan format — audio-first dominira kod svih ozbiljnih igrača u ovom segmentu (bezbednost, hands-free, ne kida fokus sa stvarnog mesta). Video je pozicioniran kao alat za **pre i posle** (personalizovan "evo šta te čeka" video uz poslati itinerer, ili "evo šta si video danas" večernji rekap), ne kao zamena za audio naraciju na licu mesta.

### Otvoreno pre bilo kakve dalje razrade (poslovna odluka vlasnika, ne tehnička)

- **Gde ovo živi u modularnoj mapi** — nije M9 (mobilna aplikacija) u strogom smislu jer M9 već pokriva "aplikacija za goste", ali audio-guide je specifičnija funkcija nad postojećim `Itinerary` (M5) — verovatno dopuna M9 spec-a (nov ekran/mod unutar postojeće aplikacije za goste), ne nov modul. Zahteva `tt-architecture-core` proveru pre nego što se bilo šta upiše u M9 spec.
- **Da li se sadržaj (audio naracija) generiše AI-jem po itinereru (TTS + generisan tekst) ili je kurirano/ljudski pisano po destinaciji** — prvo zahteva TTS izbor (već otvoreno u M15 poglavlje 6.6 kao delimično rešeno pitanje) i vezuje se na M23 (Znanje) kao izvor sadržaja o destinaciji/atrakciji; drugo je operativni trošak (ko piše/snima) van AI opsega.
- **GPS/beacon/NFC infrastruktura** — TT ne kontroliše fizičku infrastrukturu lokacija (npr. Koloseum); potrebno je istražiti da li ciljane destinacije/atrakcije već imaju takvu infrastrukturu pre nego što se obećava pouzdano lokacijsko trigerovanje. Fallback ("tapni na mapi") je realniji prvi korak.
- **Odnos prema M23 (Znanje)** — sadržaj o destinaciji/atrakciji koji bi audio-guide koristio već je predviđen da živi u M23 (baza znanja); audio-guide bi bio nov *kanal potrošnje* tog sadržaja (audio umesto teksta), ne nov izvor sadržaja.
- **Trošak generisanja/serviranja audija** ulazi u M18 budžet kao akcija sa sopstvenim tierom (isto pravilo kao svaka druga AI akcija).

**Nije prošlo kroz `tt-architecture-core` proveru niti dobilo obim od vlasnika — čista beleška da se ideja ne izgubi, po istom obrascu kao ostale stavke u `27-BACKLOG-IDEJA-I-PREDLOZI.md`.**
