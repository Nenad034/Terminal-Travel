# Backlog — konsolidovan indeks otvorenih pitanja i ideja

**Status:** Živ dokument, ažurira se u istom prolazu kad god se u bilo kom modulu doda nova stavka pod "Otvoreno za dalje" (vidi CLAUDE.md).

---

## Šta je ovo i šta NIJE

Terminal ima 22 specificirana modula, svaki sa sopstvenom sekcijom **"Otvoreno za dalje"** — pitanja koja su svesno ostavljena nerešena dok se ne pokaže stvarna potreba ili ne dobije potvrda vlasnika/pravnika/knjigovođe. Kad je posao ograničen na jednu sesiju i jedan modul, lako je izgubiti pregled nad tim šta sve čeka na nekom drugom mestu — 22 odvojene liste se ne čitaju same od sebe.

Ovaj fajl je **indeks, ne izvor istine** — svaka stavka ovde je jedan red sa pokazivačem na tačan modul i poglavlje gde stvarno piše puno objašnjenje. Kad se stavka reši, briše se odavde i (ako je vredno traga) ostaje samo u changelog-u (`**Verzija:**` liniji) tog modula — ne duplira se detaljan tekst na dva mesta, isti princip "jedan izvor istine" kao svuda u projektu (Master dokument, poglavlje 3).

**Kako se koristi:** kad počinjemo novu sesiju/temu, prvi pogled ovde da vidimo šta je već identifikovano kao čekanje, umesto da se nešto ponovo "otkriva" ili — gore — tiho zaboravi.

---

## Ideje van formalne specifikacije (još nemaju mesto ni u jednom modulu)

Trenutno nema stavki ovde — sve što je do sada razmatrano u razgovoru je ili implementirano, ili već upisano u "Otvoreno za dalje" nekog modula ispod. Ova sekcija postoji za slučaj kad se u razgovoru pojavi ideja koja još ne pripada jasno nijednom postojećem modulu (npr. predlog za nov modul pre nego što prođe kroz `tt-architecture-core` potvrdu).

---

## M1 — Core / Identitet i pristup
*(§9, `docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`)*
- Konkretna dodela dozvola po ulozi definiše se kad svaki modul dođe na red, ne unapred u M1.

## M2 — Katalog proizvoda
*(§9, `docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md`)*
- Pravila za `PACKAGE` proizvode i odnos cene paketa prema zbiru komponenti — čeka M3.
- Da li treba odobrenje pre prelaska proizvoda iz `DRAFT` u `ACTIVE`.
- Ograničen kapacitet za `TICKET`/`EVENT` — potvrditi da model M3 pokriva bez izmene.
- Autorska prava nad AI-uvezenim sadržajem — potvrditi sa dobavljačem/pravnikom pre objave.
- Automatsko pronalaženje sajta hotela (bez URL-a) — odloženo iz v1.
- Da li `SERVICE` treba odvojeno polje od `amenities[]` u `attributes`.
- Kineski jezik u katalogu — odloženo (avgust 2026), dodati tek uz konkretan poslovni razlog (npr. direktan let BEG–PEK, B2B partner).
- **Zakon o zaštiti potrošača (istraživanje, avgust 2026):** transparentnost online cenovnika (mašinski čitljiv format) i zabrana lažnih recenzija — proveriti primenljivost na M2/M8 sa pravnikom pre implementacije.

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

## M5 — Rezervacije i tok prodaje
*(§13, `docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md`)*
- Format vaučera (sadržaj, izgled) — definiše se kasnije.
- Tačan izgled/template operativne liste po tipu dobavljača.
- Da li slanje operativne liste ide samo email prilogom ili i strukturisanim API kanalom.
- Da li API (M4) stavke ikad zahtevaju sličan operativni dokument.
- Tačan izgled kalendara i vizuelno razlikovanje kategorija — dizajnersko pitanje.
- Vizuelni prikaz/UI za sastavljanje putovanja (itinerar) — dizajnersko pitanje.
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

## M7 — B2B modul (Subagenti)
*(§13, `docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md`)*
- Da li agencija treba mogućnost direktne intervencije u proviziji sub-subagenta u sporovima.
- Prilagođavanja M10 za automatsko fakturisanje provizije nazad ka subagentima.
- Konkretan LLM/tehnički mehanizam AI razgovora sa subagentom (UI/prompt dizajn).
- Tačan format/podrazumevana vrednost `ai_chat_review_threshold_amount`.

## M8 — Sajt agencije (B2C prikaz)
*(§10, `docs/moduli/M08-sajt-b2c/10-SPECIFIKACIJA-M8-SAJT-B2C.md`)*
- Detalji cookie/consent banera — potvrditi sa pravnikom pri implementaciji.

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
- Izbor konkretnog PCI-DSS platnog provajdera koji podržava RSD/lokalne kartice.
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

## M12 — Marketing i sadržajni engine
*(§9, `docs/moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md`)*
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
- Mehanizam formalnog beleženja odluke o povraćaju novca na tiketu.
- **Zakon o zaštiti potrošača — rok gosta za prijavu reklamacije (istraživanje, avgust 2026):** poglavlje 3 ispravno prati 8-dnevni rok agencije za odgovor (`zzp_response_deadline`), ali ne ograničava kada gost sme da otvori `REKLAMACIJA` tiket u odnosu na datum povratka — zakon (potrebna potvrda pravnika) daje gostu 15 dana posle povratka da prijavi.

## M15 — AI agentska orkestracija
*(§11, `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`)*
- Tačan raspored uvođenja agenata po modulu — zavisi od redosleda stabilizacije u produkciji.
- Konkretan izbor LLM provajdera/modela po domenskom agentu.
- Konkretan izbor Speech-to-Text/Text-to-Speech provajdera za glasovni modalitet (poglavlje 6.6) — PrimeTravel analiza je polazna tačka, ne konačna odluka.
- Glasovni kanal za M7/M8/M9 (subagenti, gosti) i prava telefonija/IVR — namerno van obima prve verzije (samo M17/interni tim preko mikrofona), zahteva zasebnu potvrdu vlasnika.

## M16 — Agentski distribucioni interfejs (MCP)
*(§10, `docs/moduli/M16-mcp-distribucija/17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md`)*
- Tačan MCP wire-protokol (transport, autentikacija) — potvrditi pre implementacije.
- Mehanizam agentskog plaćanja — proveriti stanje standarda pre implementacije.
- Da li je potreban poseban ugovor/uslovi korišćenja sa svakom eksternom platformom.
- Oblik odgovora MCP alata — razmotriti pljosnatiji serializer i jasnije poruke o greškama.

## M17 — Interni radni panel
*(§8, `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`)*
- Razmotriti zaseban modul za notifikacije/podsetnike ako agregacija upozorenja postane nedovoljna.

## M18 — Operativni nadzor i AI optimizacija
*(§11, `docs/moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md`)*
- Dodavanje `VIBER`/`WHATSAPP` kanala obaveštenja.
- Tačan prag za "neuobičajen skok" po tipu signala — podešava se empirijski u produkciji.
- Konkretan iznos `budget_limit_eur` (globalno i po agentu) i period — poslovna odluka pri implementaciji (§6.5).
- Da li bezbednosno kritične akcije treba da imaju sopstveni, odvojeni budžet umesto deljenog (§6.5).

## M19 — Komunikaciona platforma
*(§11, `docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md`)*
- Da li interni chat treba grupne kanale po timovima od starta.
- Pretraga istorije poruka — dodaje se ako obim komunikacije to zahteva.
- Obaveštavanje dobavljača o novoj poruci van portala (email/SMS ping).
- Da li portal dobavljača dobija PWA instalaciju.
- Zaštita od zloupotrebe/spama na javno dostupnom portalu za spoljne naloge.

## M20 — Ugovori sa klijentima
*(§8, `docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md`)*
- Tačan izgled/template ugovora po `contract_type` — dizajnersko/pravno pitanje, implementirano kao `MockContractDocumentGeneratorAdapter` dok se ne potvrdi.
- Tačan trenutak kad prihvatanje/potpis mora biti završen u odnosu na izdavanje vaučera.
- `contract_type = PRODAJA_AVIO_KARTE`/`TRANSFER` — uskladiti sa PDV pitanjem iz M10.
- `KORPORATIVNI_OKVIRNI` tip čeka punu razradu B2B okvirnih ugovora.
- Samostalna prodaja `INSURANCE` proizvoda ne odgovara nijednom postojećem `contract_type` — trenutno se automatsko generisanje ugovora svesno preskače za samo-INSURANCE rezervacije.
- Ownership-scoping za `GET /client-contracts` (Prodajni agent/Gost "sopstveno") nije implementiran na nivou servisa, samo kao dozvola po ulozi.

## M21 — Centar za pomoć (baza znanja + AI asistent)
*(§8, `docs/moduli/M21-centar-za-pomoc/23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md`)*
- Tačna podela `EDIT`/`PUBLISH` dozvola za help sadržaj.
- Tačan prag/algoritam grupisanja pitanja za `HelpArticleSuggestion`.
- Proširenje na pojedinačne (INDIVIDUAL) krajnje goste (M8/M9) — namerno van obima.
- Da li M8/M9 UI za korporativne klijente treba poseban vizuelni prikaz Centra za pomoć ili generički help widget.
- Da li agent dobija ograničen pristup živim podacima (npr. kreditni limit subagenta) u budućoj verziji.

## M22 — Email/Inbox platforma
*(§10, `docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md`)*
- Izbor konkretnog email provajdera/API-ja (Gmail, Microsoft Graph, IMAP/SMTP).
- Pristup ličnim (van-agencijskim) mejl nalozima zaposlenih — zahteva IT/pravnu potvrdu.
- Real-time chat sa dobavljačima ostaje potpuno odvojen otvoren gap.
- Tačan mehanizam podešavanja "auto-send" praga za informativne kategorije.
- Pretraga/arhiva starih niti i period čuvanja mejlova (retencija) — van obima ove verzije.

## M23 — Znanje
*(§10, `docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md`)*
- Prošireno na javnu pretragu za goste (M8/M9), umesto samo deljenog linka.
- AI Q&A/glas za subagente (M7) — v1 daje im samo čitanje već objavljenih članaka.
- Prava integracija sa Viber/WhatsApp/Telegram/email API-jima za deljenje, umesto ručnog kopiranja linka.
- Tačan prag/algoritam za grupisanje ponovljenih `QUESTION_GAP` pitanja na istu temu.
- Da li `Article` za destinaciju/zemlju treba hijerarhiju (država sadrži destinacije) ili ravna lista sa filterom je dovoljna.
- Tačan mehanizam kojim AI "poseti" zvaničan sajt/društvenu mrežu (scraping vs. zvaničan API) — može zahtevati proveru uslova korišćenja platforme.

## Dizajn sistem UI (cross-modularno)
*(§8, `docs/analize/29-DIZAJN-SISTEM-UI.md`)*
- Tačne HEX vrednosti palete (za oba moda) — biraju se pri izradi prvog stvarnog ekrana, obavezno u skladu sa pravilom kontrasta (§2a — WCAG AA minimum).
- Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17 ili prilagođenu verziju.
- Da li izbor tamnog/svetlog moda treba sinhronizaciju preko uređaja (backend polje) ili ostaje lokalno.
- Tačna paleta semantičkih boja za isticanje teksta (upozorenje/greška/uspeh) — bira se sa HEX vrednostima.
- Gornja granica broja istovremeno otvorenih tabova (§5a) i ponašanje kad se dostigne.

## Infrastruktura / zavisnosti (cross-modularno)
- Nadogradnja NestJS 10→11 (major) pre produkcije — `npm audit` (11.8.2026) pokazuje 25 ranjivosti u tranzitivnim zavisnostima (express/body-parser/qs/multer/lodash/js-yaml/picomatch/tmp/webpack), sve zakrpljene tek u NestJS 11 liniji, ne u 10.x (10.4.22 je već poslednja 10.x verzija). Trenutno nizak stvarni rizik — nema produkcionog hostinga, nema upload rute (multer neiskorišćen). Uraditi kao izolovan zadatak, ne usred rada na poslovnim modulima, prirodno uz izbor hosting provajdera pred lansiranje.

---

## Napomena o prioritetu

Ovaj fajl namerno **ne rangira** stavke po prioritetu — to je odluka vlasnika u trenutku kad se na njih vraćamo, ne nešto što treba unapred pretpostaviti u dokumentu. Grupe koje se prirodno nameću kao "prvo pitati pravnika/knjigovođu" (većina M10/M11 stavki, cookie baner u M8, retencija podataka u M6/M22) su označene u originalnom tekstu tog modula rečju "pravnik"/"knjigovođa" — pretraga po toj reči kroz `docs/moduli/` daje brz filter kad dođe vreme za tu rundu pitanja.
