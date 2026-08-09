# Gap analiza — Flights (Terminal Flights) naspram Terminal Travel arhitekture

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`; `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md`; `docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md` (pročitano poglavlje 1–6, do reda 302 od 577); `docs/moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md` (pročitano poglavlje 1–5.2); `docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md` (pročitano celo); spoljni dokument **Terminal Flights** (`https://claude.ai/code/artifact/a4575325-5726-492d-979b-bdafa5f1cf51`, poglavlja 00–22) i njegova mapa modula (`https://claude.ai/code/artifact/0357a5aa-070c-40e4-b9a6-a5d7cc94f4d4`)
**Nivo:** Analiza — priprema odluku o spajanju, ne zamenjuje niti menja postojeće specifikacije modula
**Status:** Nacrt za vlasnika
**Verzija:** 1.0
**Napomena o obimu čitanja:** M5 i M10 su delimično pročitani (M5 do poglavlja 6.3, M10 do poglavlja 5.2 — oba dokumenta imaju dodatne kasnije sekcije, npr. M5 poglavlja 7–13, M10 poglavlja 6–10, koje ova analiza ne pokriva). Zaključci ispod se oslanjaju na svrhu/obim i model podataka koji su u pročitanom delu jasno definisani; sve što zavisi od nepročitanog dela je označeno kao otvoreno pitanje, ne kao potvrđen nalaz.

---

## 0. Zašto ovaj dokument postoji

Terminal Flights je zaseban, opsežan arhitektonski dokument (23 poglavlja) rađen kao dubinsko istraživanje kako bi trebalo da izgleda avio/GDS deo distribucije — upravo ono što `00-MASTER-ARHITEKTURA.md` i `05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` eksplicitno pominju kao **budući** rad ("kasnije GDS/avio", M4 poglavlje 1 i poglavlje 9). Cilj ove analize nije da nabroji razlike između dva paralelna dokumenta — cilj je da odluči **kako se Terminal Flights sadržaj raspoređuje po postojećoj strukturi modula (M1–M22)**, tako da posle ovog dokumenta postoji samo jedan izvor istine, ne dva koja treba večno usklađivati.

**Zaključak unapred (razrađen u poglavlju 4):** Terminal Flights ne postaje novi modul (npr. "M23"). Raspoređuje se kroz **M4** (adapteri), **M5** (tok prodaje — uključujući koncept koji Terminal Flights zove "Trip Composition", a koji M5 već ima pod drugim imenom), **M10** (finansije, uz jedno stvarno otvoreno pitanje) i **M9** (mobilna, gost deo). Razlog: M4/M5/M10/M9 su već projektovani generički (provajder-nezavisno, kategorija-nezavisno) — GDS/avio nije nova arhitektura, nego novi `category: "FLIGHT"` unutar arhitekture koja već postoji.

---

## 1. Rezime nalaza

1. **M4 (Integracije API) je već projektovan za ovo.** `ProviderAdapter` interfejs (M4 poglavlje 2) već ima `category: "FLIGHT"` u enumu, uz identičan 5-metodni ugovor (`search`, `getStaticContent`, `checkAvailabilityAndPrice`, `confirmBooking`, `cancelBooking`) koji Terminal Flights poglavlje 03 opisuje za Amadeus/Sabre/Travelport/Travelfusion/Duffel/NDC adaptere. Ovo je najčistiji deo spajanja — gotovo bez konflikta.
2. **Terminal Flights poglavlje 06 (Trip Composition) rešava problem koji M5 već ima rešen, drugim mehanizmom.** M5 poglavlje 3.0 (`Itinerary`/`ItinerarySegment`, "sastavljanje putovanja") već dozvoljava mešanje `CONTRACTED` (M3) i `API` (M4) stavki različitih tipova proizvoda u jedno putovanje, sa konverzijom u `Quote` po istom mehanizmu za sve. **Preporuka: ne graditi poseban "Trip Composition ugovor" — koristiti postojeći `Itinerary` mehanizam.** Ovo je najveći nalaz ove analize (razrađeno u poglavlju 3.3).
3. **Finansije su jedino mesto sa stvarnim, neresenim konfliktom.** M10 je projektovan oko srpskog poreskog sistema za turističke agencije (Član 35 ZPDV — PDV na maržu za organizatora, na proviziju za posrednika; SEF za B2B, ESIR za B2C). Terminal Flights poglavlje 09 pretpostavlja BSP/ARC IATA obračun i IFRS 15 priznavanje prihoda — mehanizme koje M10 uopšte nema. M10 poglavlje 4.4 **već je predvideo ovaj slučaj** ("samostalna prodaja avio karte bez organizacije putovanja... `PUNA_OSNOVICA`") kao otvoreno pitanje za knjigovođu — ova analiza ga samo potvrđuje i konkretizuje (poglavlje 3.4).
4. **M9 offline-first postoji samo za vodiče na terenu, ne za goste.** Terminal Flights poglavlje 20 (mobilni offline mod za gosta — karta za ukrcavanje, itinerer bez signala) opisuje mogućnost koju M9 danas **uopšte nema** za gost-deo aplikacije (M9 poglavlje 2: "isti tok i isti API-ji kao M8... ne ponavlja se ovde"). Ovo je stvarno nov doprinos, ne preklapanje (poglavlje 3.5).
5. **Ancillary usluge (sedište, prtljag) i post-sale IRROPS nemaju današnji ekvivalent** ni u M5 ni bilo gde drugde — ovo su koncepti specifični za avio distribuciju bez postojeće analogije u hotelskom/paket-aranžman modelu koji M5 danas pokriva (poglavlje 3.2, 3.6).

---

## 2. Mapa: poglavlje Terminal Flights → modul Terminal Travel

| # | Poglavlje (Terminal Flights) | Modul | Uklapanje | Šta konkretno treba |
|---|---|---|---|---|
| 03 | Supplier Abstraction Layer | **M4** | Direktno — `ProviderAdapter` već ima `category: "FLIGHT"` | Proširiti `NormalizedContent`/`AvailabilityQuote`/`BookingConfirmation` za multi-segment itinerar i podatke po putniku (poglavlje 3.1) |
| 04 | Search & Shopping | **M5** (poglavlje 3.0b) + M4 `search()` | Direktno — `GET /search` već agregira M2+M3+M4 | Proveriti da li `SearchResultOffer` (M5 3.0b.2) nosi dovoljno polja za više segmenata/presedanja po ponudi |
| 05 | Booking & Order | **M5** (poglavlje 4) | Direktno — "sve ili ništa" potvrda (M5 4, korak 3) je već isti mehanizam kao naša booking saga | — |
| 06 | Trip Composition (let+smeštaj+transfer) | **M5** (poglavlje 3.0, `Itinerary`) | **Već postoji, bolje rešenje** | Ne graditi — koristiti `Itinerary`/`ItinerarySegment` (poglavlje 3.3 niže) |
| 07 | Payments & Ticketing | **M10** (poglavlje 5.2, `Payment`) + **nov deo** | Delimično — kartično plaćanje se uklapa, izdavanje tiketa/BSP ne postoji | Definisati gde tiketing živi — verovatno prošireni korak u M5 poglavlje 4 (potvrda), ne u M10 |
| 08 | Post-sale & IRROPS | **M5** (poglavlje 6) | Delimično — izmena/otkazivanje/refund model se uklapa; proaktivna IRROPS detekcija je nova | Nov periodični posao, po uzoru na M5 poglavlje 6.1 (alarmi), ne nov modul |
| 09 | Finance & Ledger (BSP/ARC, IFRS 15) | **M10** | **Konflikt modela** — najveće otvoreno pitanje | Vidi poglavlje 3.4 — obavezna potvrda knjigovođe pre bilo kakve specifikacije |
| 10 | Data Platform | Infrastruktura (van modula) | Nije modul u M1–M22 — deo opšte arhitekture | Proveriti Master dokument poglavlje 5/6 da li ovo već postoji kao princip, ne dupliraj kao "modul" |
| 11 | Security & Compliance | **M1** (RBAC/audit) + **M11** (compliance) | Delimično — princip isti, sadržaj (PCI DSS, IATA akreditacija) je nov | Dodati kao dopunu M1/M11 kad avio dođe na red, ne novi modul |
| 13 | Poslovni model & pricing | **M5** (poglavlje 2, `MarkupRule`) | Direktno — identičan mehanizam (procenat + fiksan iznos, `scope_type` hijerarhija) | Dodati `M4_PROVIDER` kao `scope_type` za FLIGHT provajdere — već predviđeno (M5 2.1) |
| 15 | Zaštita putnika & Bonding (EU PTD) | **M11** (compliance, YUTA garancija) | Analogan koncept, različit pravni okvir | Proveriti da li YUTA garancija (srpska) pokriva i avio pakete ili je EU PTD zaseban zahtev — pravno pitanje, ne tehničko |
| 17 | Analytics & eksperimentisanje | **M13** (BI) | Direktno — M13 je već `umb`/"SVI", read-only nad svim modulima | — |
| 18 | Lokalizacija & pravni entiteti | **M2** (8 jezika) + van obima | Delimično — jezik se uklapa, multi-legal-entity ne postoji nigde | Otvoreno pitanje za Master arhitekturu, ne za jedan modul |
| 20 | Mobilni offline mod (gost) | **M9** (poglavlje 3) | **Nov doprinos** — M9 offline danas pokriva samo vodiča | Vidi poglavlje 3.5 — pravi dopunu M9 obima, ne konflikt |

Poglavlja koja nisu u tabeli (00–02, 12, 14, 16, 19, 21–22 Terminal Flights dokumenta) su uvod, istraživanje tržišta, diferencijacija, projekcija prihoda, konkurentska analiza, tehnološki stek i roadmap — narativna/analitička poglavlja bez direktnog M-modula, relevantna kao kontekst ali se ne "prepisuju" nigde.

---

## 3. Detaljna razrada ključnih tačaka

### 3.1 M4 — proširenje normalizovanog oblika za FLIGHT kategoriju

M4 poglavlje 2.1 definiše `NormalizedContent`/`AvailabilityQuote`/`BookingConfirmation` u obliku koji odgovara **jednoj jedinici inventara** (soba, noćenje) — prirodno za `HOTEL`, nedovoljno za `FLIGHT`:

- `AvailabilityQuote` nema mesto za više segmenata (let sa presedanjem), više putnika sa različitim cenama (odrasli/deca), niti fare rules po segmentu (refundable/changeable, prtljag).
- `BookingConfirmation` nema mesto za tiket broj (izdaje se tek posle plaćanja, u M5/M10 toku, ne u M4 `confirmBooking` koraku).

**Predlog:** ne menjati osnovni `ProviderAdapter` ugovor (ostaje isti za sve kategorije, princip iz M4 poglavlje 1), nego dodati **kategorija-specifično telo** unutar postojećih oblika — npr. `AvailabilityQuote.categoryDetails` (JSONB ili tipizirano po `category`), isti obrazac kao `ProviderConfig.capabilities_profile` (M4 poglavlje 2.3, već JSONB polje bez šeme unapred fiksirane). Ovo čuva M4 princip (M2/M5 ne znaju detalje provajdera) dok dozvoljava da FLIGHT adapteri nose ono što HOTEL adapteri ne trebaju.

### 3.2 Ancillary usluge — nov koncept, nema današnji analog

M2 `Product` model (koliko je vidljivo iz M4/M5 referenci) je proizvod sa cenom, ne proizvod sa naknadno dodatim stavkama (sedište, prtljag) vezanim za već izabranu ponudu. Terminal Flights poglavlje 07 pretpostavlja ancillary katalog kao zaseban sloj iznad osnovne ponude leta.

**Otvoreno pitanje:** da li se ancillary usluga modelira kao dodatna `QuoteItem` (M5 poglavlje 3.2) vezana za istu `Quote`, ili kao novo polje/podstruktura na postojećoj stavci. Prva opcija se uklapa u postojeći model bez izmene; druga zahteva izmenu M5 `QuoteItem` šeme. Preporuka: prva opcija (dodatna `QuoteItem` sa `product_id` koji referencira ancillary "proizvod"), jer ne dira postojeći model — ali ovo treba potvrditi kad M5 poglavlje 7+ (nepročitano u ovoj analizi) bude provereno da ne postoji već rešenje.

### 3.3 Trip Composition (Terminal Flights §06) = `Itinerary` (M5 §3.0) — ne graditi duplikat

Terminal Flights poglavlje 06 je pisano sa pretpostavkom da Flights modul mora ostati arhitektonski nezavisan i da se sa budućim hotel/transfer modulima spaja preko tankog "Trip Composition ugovora" (deljeni `trip_id`, event orkestracija, odvojen ledger po modulu) — ta pretpostavka je bila ispravna **u odsustvu informacije da M5 već postoji**. Sad kad se zna da M5 postoji:

- M5 `Itinerary`/`ItinerarySegment` (poglavlje 3.0) već radi tačno ovo: više proizvoda (bilo kog tipa, `CONTRACTED` ili `API`, bilo kog `M2 Product.type`) se sastavlja u jedno putovanje, pa konvertuje u jedinstvenu `Quote` → `Booking` po istom mehanizmu za sve.
- Nema potrebe za odvojenim `trip_id` konceptom — `Itinerary.id` / `Booking.id` već igraju tu ulogu.
- Nema potrebe za "odvojenim ledgerom po modulu" — M10 već vodi finansije na nivou cele `Booking`, nezavisno od toga koliko različitih `product_id`/`source_type` kombinacija ta rezervacija sadrži.

**Zaključak:** Terminal Flights poglavlje 06 se **ne prepisuje** u novu specifikaciju — briše se kao zaseban koncept, a njegova svrha (spoj leta sa smeštajem/transferom) je već zadovoljena postojećim M5 modelom, pod uslovom da FLIGHT postane još jedan `M2 Product.type`/M4 `category`, kao i svaki drugi.

### 3.4 Finansije — stvarni konflikt, zahteva odluku knjigovođe pre specifikacije

M10 je izgrađen oko **posebnog sistema oporezivanja turističkih agencija** (Član 35 ZPDV, poglavlje 4) — PDV na maržu (organizator) ili proviziju (posrednik), primenjivo na **organizovano putovanje**. M10 poglavlje 4.4 eksplicitno ostavlja `PUNA_OSNOVICA` kao kategoriju za "promet koji nije obuhvaćen posebnim sistemom... npr. samostalna prodaja avio karte bez organizacije putovanja" — i eksplicitno traži potvrdu knjigovođe za granične slučajeve.

Terminal Flights poglavlje 09 pretpostavlja mehanizme koje M10 danas nema:
- **BSP/ARC obračun** — nedeljni/dvonedeljni settlement ciklus sa IATA, nezavisan od SEF/ESIR toka.
- **Multi-currency FX lock** po rezervaciji, odvojeno od `ExchangeRateSnapshot` (M10 poglavlje 3.1) koji je projektovan oko konverzije u RSD za fiskalni dokument, ne oko GDS/dobavljačkog poravnanja u izvornoj valuti.
- **Odloženo priznavanje prihoda (IFRS 15)** — M10 danas nema koncept "prihod priznat tek na dan putovanja"; fiskalni dokument (poglavlje 6, nepročitano u ovoj analizi) se izdaje po potvrdi/uplati, ne po datumu izvršenja usluge.

**Ovo nije nešto što ova analiza treba da reši** — isto pravilo kao M10 poglavlje 4.4/6.3 ("Ograda — potrebna potvrda knjigovođe pre implementacije"). Preporuka: kad avio dođe na red, prva stavka posla u M10 dopuni je sastanak sa knjigovođom oko toga da li avio karta prodata samostalno ide kroz `PUNA_OSNOVICA` granu koja već postoji, ili zahteva potpuno nov `vat_calculation_basis` i nov tok paralelan sa SEF/ESIR (BSP/ARC), pre nego što se piše ijedan red specifikacije.

### 3.5 M9 gost-offline — stvaran novi obim, ne konflikt

M9 poglavlje 2 kaže eksplicitno: gost deo aplikacije koristi "isti tok i isti API-ji kao M8... ne ponavlja se ovde detaljno" — što znači da gost deo **nema offline mod uopšte**, dok vodič deo (poglavlje 3) ima pun offline-first mehanizam (lokalna SQLite, sync red sa `idempotency_key`, "poslednji upis pobeđuje"). Terminal Flights poglavlje 20 opisuje offline pristup karti za ukrcavanje i itinereru za **gosta** — ovo M9 danas nema, i imalo bi smisla kao opšte proširenje M9 (ne samo za avio, koristan je i za hotel vaučer bez signala u inostranstvu), a ne kao nešto vezano isključivo za let.

**Preporuka:** kad se piše dopuna, formulisati je kao "gost-offline mod, opšti obim M9", ne "avio offline mod" — čak i ako je avio slučaj (karta za ukrcavanje na aerodromu) najhitniji razlog da se sad uradi.

### 3.6 Post-sale IRROPS — nov periodični posao po uzoru na M5 §6.1

M5 poglavlje 6.1 već ima obrazac za "periodičnim poslom prati... i upozorava tim" (neplaćena rezervacija, otvorena potvrda dobavljača, nedostajući vaučer). IRROPS (promena/otkazivanje leta od strane avio-kompanije posle potvrde) je **peti alarm istog oblika**, ne nov mehanizam — razlika je što izvor promene nije unutrašnje stanje `Booking`-a nego spoljni signal od M4 FLIGHT adaptera (promena statusa leta). Ovo zahteva da M4 FLIGHT adapteri podrže povratni poziv/polling za promene posle `confirmBooking`, što današnji M4 `ProviderAdapter` interfejs (samo `search`/`getStaticContent`/`checkAvailabilityAndPrice`/`confirmBooking`/`cancelBooking`) nema — **šesta metoda** (npr. `checkBookingStatus`/webhook prijem) je stvarna nova stavka u M4 ugovoru, ne samo u M5.

---

## 4. Preporuka

**Ne otvarati nov modul (M23).** Sav sadržaj Terminal Flights dokumenta raspoređuje se kao dopuna postojećih M4/M5/M9/M10/M11/M13 specifikacija, tačno onako kako je Master dokument i planirao ("kasnije GDS/avio" kao proširenje M4, ne kao nov modul). Terminal Flights repo/dokument posle ovoga postaje **istorijska referenca i istraživački materijal** (posebno poglavlja 01 pejzaž provajdera, 12 diferencijacija, 14 projekcija, 16 konkurencija, 19 tehnološki stek — narativni deo koji nema M-modul ekvivalent i ne treba da ga ima), ne živi paralelni izvor istine za ono što ima M-modul ekvivalent.

**Redosled kad avio dođe na red (predlog, ne konačna faza-plan):**
1. Finansijski sastanak (poglavlje 3.4) — pre bilo čega drugog, jer određuje da li je ovo uopšte "M10 dopuna" ili zahteva paralelan tok.
2. Dopuna M4: `category: "FLIGHT"` konkretan adapter (npr. Duffel prvi, po istoj logici kao Terminal Flights poglavlje 22 Faza 1 — najbrži start bez GDS akreditacije) + `categoryDetails` proširenje (poglavlje 3.1) + šesta metoda za status posle potvrde (poglavlje 3.6).
3. Dopuna M5: ancillary kao `QuoteItem` (poglavlje 3.2), IRROPS alarm (poglavlje 3.6) — **ne** nov Trip Composition mehanizam (poglavlje 3.3 već postoji).
4. Dopuna M9: gost-offline opšti obim (poglavlje 3.5).
5. Dopuna M10: tek posle koraka 1, po njegovom ishodu.

## 5. Otvorena pitanja za vlasnika

- Da li se avio karta u Terminal Travel-u ikad prodaje **samostalno** (bez paketa) ili uvek kao deo organizovanog aranžmana? Ovo direktno određuje da li poglavlje 3.4 uopšte postaje relevantno u kratkom roku.
- Da li YUTA garancija putovanja (M11) pravno pokriva avio-inkluzivne pakete, ili je EU Package Travel Directive (Terminal Flights poglavlje 15) zaseban zahtev koji se primenjuje samo ako/kad agencija posluje i u EU jurisdikciji? Pravno pitanje, ne arhitektonsko.
- Da li se pristupa GDS/avio kroz akreditovanog agregatora (Duffel — bez sopstvene IATA/BSP akreditacije, kako Terminal Flights poglavlje 01/22 preporučuje za početak) ili direktno kroz GDS (zahteva IATA/BSP akreditaciju agencije) — ova odluka menja odgovor na pitanje 3.4 (BSP obračun postaje relevantan tek ako/kad se ide direktno kroz GDS, ne kroz Duffel kao merchant of record).
