# Specifikacija modula M15 — AI agentska orkestracija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M15), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (Faza 7)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.6 — dodato poglavlje 6.6 (glasovni modalitet za omnisearch — Speech-to-Text/Text-to-Speech kao omotač oko postojećeg `POST /omnisearch` toka, bez novog agenta ili akcije), na zahtev vlasnika (avgust 2026): prvi kanal je M17 (interni tim) preko mikrofona u pregledaču, glasom se nikad ne izvršava radnja, audio se ne čuva posle transkripcije; v1.5 dodate tri stavke registra za M7 `subagent_chat.*` (poglavlje 4), AI agent chat za subagente sa izvršnim ovlašćenjem, na zahtev vlasnika (avgust 2026), zatvara problem #8 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`; v1.4 dodato poglavlje 6.5 (univerzalna pretraga i AI razgovor kroz M17/M7/M8 — omnisearch), na zahtev vlasnika (avgust 2026), posle vizuelnog nacrta za sva tri kanala; v1.3 dodate četiri stavke registra za M21 (Centar za pomoć); v1.2 dodata stavka M3 `contract_period.low_capacity_alert` (poglavlje 4.3); v1.1 ispravila zastarelu referencu na M14 poglavlje 3 (pomereno na 4 pri dodavanju Reklamacija) i dodala nedostajuće stavke za M20/M11/M14 uvedene naknadno
**Zavisi od:** svi moduli

---

## 1. Svrha i obim modula

Poglavlje 7 Master dokumenta je već definisalo *pravila* (tri nivoa autonomije, "Nikad autonomno" lista, postepeno uvođenje). M15 je **tehnički mehanizam** koji ta pravila čini stvarnim i proverljivim u kodu, ne samo na papiru — i **prikuplja na jedno mesto** sve pojedinačne "Autonomno / Predloži pa čovek odobri / Nikad autonomno" odluke koje su već rasute kroz M3, M6, M7, M9, M10, M11, M12, M13, M14, M16.

M15 nije modul sa sopstvenom poslovnom bazom kao M2 ili M5 — to je upravljački sloj — ali ima sopstvene entitete potrebne da to upravljanje bude proverljivo (poglavlje 3, 4, 5 ovog dokumenta).

---

## 2. AI agent kao formalni M1 identitet

Dodaje se `account_type = AI_AGENT` u M1 `User.account_type` enum (`02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`, poglavlje 3.1) — svaki AI agent (glavni ili domenski) je **formalni M1 nalog**, ne poseban mehanizam mimo sistema prava. Ovo znači da agenti dobijaju prava kroz **isti model uloga + pojedinačnih izuzetaka** kao ljudi (M1 poglavlje 3), i svaka njihova akcija se beleži u isti `AuditLogEntry` sa `actor_type = AI_AGENT` (već predviđeno u M1 od početka, poglavlje 3.8).

### 2.1 `AIAgent`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| user_id | UUID (FK → M1 User, `account_type = AI_AGENT`) | |
| agent_role | enum: `GLAVNI_AGENT`, `DOMENSKI_AGENT` | |
| module_code | string, nullable | modul kom pripada (npr. `M10`) — `null` za `GLAVNI_AGENT`, koji koordinira preko svih |
| status | enum: `ACTIVE`, `DISABLED` | ne može biti `ACTIVE` dok modul nije `ACTIVATED` (poglavlje 3) |
| model_tier | enum: `LIGHT`, `STANDARD`, `HEAVY` *(dodato pri specifikaciji M18)* | stabilna kategorija složenosti — vidi M18 specifikaciju, poglavlje 6, za mapiranje i najvažniji nalaz da dobar deo "Autonomno" akcija uopšte ne treba jezički model |
| model_identifier | string, nullable *(dodato pri specifikaciji M18)* | konkretno ime modela, menja se nezavisno od `model_tier` |
| created_at | timestamp | |

---

## 3. Postepeno uvođenje — `ModuleAgentActivation`

Princip #4 iz poglavlja 3 Master dokumenta ("determinizam pre autonomije", razrađeno u poglavlju 7) postaje sprovodiv gate, ne samo preporuka:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| module_code | string (PK) | |
| tests_passing | boolean | automatski testovi modula prolaze |
| production_cycle_completed | boolean | modul je radio u produkciji bez agenta bar jedan poslovni ciklus |
| status | enum: `NOT_READY`, `READY_FOR_ACTIVATION`, `ACTIVATED` | |
| activated_by | UUID, nullable (FK → M1 User) | **uvek ljudska odluka** — Vlasnik ili Direktor |
| activated_at | timestamp, nullable | |

**Ograda na nivou koda:** `AIAgent.status` za `DOMENSKI_AGENT` ne može preći u `ACTIVE` dok odgovarajući `ModuleAgentActivation.status != ACTIVATED`. Ovo je tehnička, ne samo proceduralna prepreka.

---

## 4. Centralni registar akcija — `AgentActionType`

Umesto da svaki modul samostalno "pamti" svoju podelu na tri nivoa, M15 drži jedan pregledan registar — popunjen iz odluka već donetih u postojećim specifikacijama:

| module_code | action_code | tier | Izvor odluke |
| :---- | :---- | :---- | :---- |
| M3 | `contract_period.release_warning` | `PROPOSE_THEN_APPROVE` | M3 poglavlje 4.1 |
| M3 | `pricelist_import.extract` | `AUTONOMOUS` | M3 poglavlje 4.2.4 |
| M3 | `pricelist_import.approve_row` | `PROPOSE_THEN_APPROVE` | M3 poglavlje 4.2.4 |
| M3 | `contract_period.low_capacity_alert` | `AUTONOMOUS` | M3 poglavlje 4.3 — čisto informativan signal na 1–2 preostale jedinice, ne blokira prodaju |
| M5 | `supplier_manifest.draft` | `AUTONOMOUS` | M5 poglavlje 8.4, 8.7 — priprema nacrta i njeno prioritetno isticanje po konfigurabilnom pravilu (8.7) ostaju čisto informativni |
| M5 | `supplier_manifest.send` | `PROPOSE_THEN_APPROVE` | M5 poglavlje 8.4 |
| M5 | `booking_item.cancel_duplicate_check` | `PROPOSE_THEN_APPROVE` | M5 poglavlje 6.4 — deterministički fuzzy-match (ne AI/LLM poziv), upozorenje pre storna zahteva svesnu potvrdu operatera |
| M6 | `communication.draft` | `AUTONOMOUS` | M6 poglavlje 4 |
| M6 | `communication.send_with_price_or_obligation` | `PROPOSE_THEN_APPROVE` | M6 poglavlje 4 |
| M7 | `commission_rebate.calculate_draft` | `AUTONOMOUS` | M7 poglavlje 3.2 |
| M7 | `commission_rebate.apply` | `PROPOSE_THEN_APPROVE` | M7 poglavlje 3.2 |
| M7 | `subagent_chat.search` | `AUTONOMOUS` | M7 poglavlje 2.0.4c — čitanje kataloga, isti obim kao portal |
| M7 | `subagent_chat.quote_draft` | `AUTONOMOUS` | M7 poglavlje 2.0.4c — deterministička cena (poglavlje 5 te specifikacije), ništa obavezujuće |
| M7 | `subagent_chat.booking_confirm` | `PROPOSE_THEN_APPROVE` | M7 poglavlje 2.0.4c — odobrava isključivo subagent sopstvenim nalogom (Gejt A), ne osoblje agencije; zahtevi iznad praga dodatno čekaju ljudski pregled osoblja (Gejt B, van registra jer je to čisto ljudska odluka bez učešća agenta) |
| M10 | `fiscal_document.draft` | `AUTONOMOUS` | M10 poglavlje 6 |
| M10 | `fiscal_document.submit` | `NEVER_AUTONOMOUS` | M10 poglavlje 6 |
| M11 | `travel_guarantee.expiry_reminder` | `AUTONOMOUS` | M11 poglavlje 4 |
| M11 | `travel_guarantee.edit` | `NEVER_AUTONOMOUS` | M11 poglavlje 4 |
| M11 | `travel_guarantee.utilization_warning` | `AUTONOMOUS` | M11 poglavlje 4.2 — upozorenje na 80% praga, ne tvrda blokada (ta je deterministička, ne AI odluka) |
| M11 | `tourist_tax_remittance.draft` | `AUTONOMOUS` | M11 poglavlje 3.3 |
| M11 | `tourist_tax_remittance.submit` | `PROPOSE_THEN_APPROVE` | M11 poglavlje 3.3 |
| M12 | `content.draft` | `AUTONOMOUS` | M12 poglavlje 3 |
| M12 | `content.approve_publish` | `PROPOSE_THEN_APPROVE` | M12 poglavlje 3 |
| M13 | `insight.surface_trend` | `AUTONOMOUS` | M13 poglavlje 5 |
| M14 | `ticket_response.draft` | `AUTONOMOUS` | M14 poglavlje 4 |
| M14 | `ticket_response.send_with_price_or_obligation` | `PROPOSE_THEN_APPROVE` | M14 poglavlje 4 |
| M14 | `complaint.escalate_notify` | `AUTONOMOUS` | M14 poglavlje 3.1 — čisto informativna eskalacija (ZZP rok), ne izvršenje |
| M20 | `client_contract.generate_draft` | `AUTONOMOUS` | M20 poglavlje 4 |
| (globalno) | `contract.sign` | `NEVER_AUTONOMOUS` | poglavlje 7 Master dokumenta |
| (globalno) | `money.transfer` | `NEVER_AUTONOMOUS` | poglavlje 7 Master dokumenta |
| (globalno) | `license_data.edit` | `NEVER_AUTONOMOUS` | poglavlje 7 Master dokumenta |
| M18 | `trend_research.draft` | `AUTONOMOUS` | M18 poglavlje 5 |
| M18 | `trend_research.apply_to_docs` | `PROPOSE_THEN_APPROVE` | M18 poglavlje 5 |
| M18 | `health_signal.detect_and_notify` | `AUTONOMOUS` | M18 poglavlje 2 — čisto informativno, isporuka upozorenja nije poslovna odluka |
| M21 | `help_question.answer` | `AUTONOMOUS` | M21 poglavlje 5.2 — isključivo pretraga objavljenog sadržaja, bez pristupa živim podacima |
| M21 | `help_escalation.create_ticket` | `AUTONOMOUS` | M21 poglavlje 5.3 — korisnik koji pita sam potvrđuje eskalaciju sopstvenog pitanja, ne treći čovek koji odobrava tuđu akciju |
| M21 | `help_article_suggestion.draft` | `AUTONOMOUS` | M21 poglavlje 5.4 — čisto pripremni nacrt iz obrasca ponovljenih pitanja |
| M21 | `help_article_suggestion.approve` | `PROPOSE_THEN_APPROVE` | M21 poglavlje 5.4 |
| (globalno) | `omnisearch.query` | `AUTONOMOUS` | poglavlje 6.5 — **isključivo pronalaženje/navigacija, nikad izvršenje radnje** (potvrđena odluka vlasnika, avgust 2026); svaki predlog radnje (npr. "otkaži rezervaciju X") vraća se kao link ka pravoj stranici/zapisu gde čovek ručno potvrđuje, nikad se ne izvršava iz same pretrage — **isti kod pokriva i glasovni unos** (poglavlje 6.6), nema posebnog `action_code` za glas |

**Napomena:** ne uključuju se ovde automatski deterministički procesi koji nisu AI odluka (npr. M11 CIS registracija garancije putovanja, M4/M10 pozivi ka spoljnim provajderima, M12 izvršenje već odobrene objave) — ti su eksplicitno razjašnjeni u svojim specifikacijama kao "isti princip kao poziv ka spoljnom provajderu, ne AI odluka" i ne spadaju u ovaj registar jer ih AI agent uopšte ne odlučuje.

Registar se **dopunjuje** kad svaki budući modul (ili izmena postojećeg) uvede novu akciju koju AI agent dodiruje — ne postoji podrazumevani nivo; svaka nova `action_code` mora eksplicitno dobiti `tier` pre nego što se agent pusti na nju.

---

## 5. Sprovedba na nivou koda (defense in depth)

Pre izvršenja bilo koje akcije čiji je `actor_type = AI_AGENT`, API sloj proverava `AgentActionType.tier` za tu akciju:
- `NEVER_AUTONOMOUS` → zahtev se **odbija na nivou koda**, bez obzira na to da li agent formalno ima M1 dozvolu za taj endpoint (dvostruka brava — ovo je namerno redundantno sa M1 RBAC-om, jer je cena greške ovde novac ili zakon).
- `PROPOSE_THEN_APPROVE` → agent može da kreira zapis u statusu koji zahteva odobrenje, ali endpoint koji ga prevodi u izvršeno stanje odbija poziv ako `actor_type = AI_AGENT`.
- `AUTONOMOUS` → dozvoljeno bez dodatne provere, van standardnog M1 RBAC-a.

---

## 6. Agent Inbox — jedno mesto za sve što čeka ljudsko odobrenje

Glavni agent (poglavlje 2) agregira sve `PROPOSE_THEN_APPROVE` stavke čeka (M6/M14 poruke na čekanju slanja, M7 rabati na čekanju, M11 mesečni izveštaj na čekanju, M12 sadržaj na čekanju odobrenja, M3 upozorenja o roku) u jedan prikaz unutar M17 (internog panela) — isti obrazac agregacije kao kontrolna tabla iz M17 specifikacije (poglavlje 5 te specifikacije), samo filtrirano na "čeka me odluka" umesto na rokove.

---

## 6.5 Univerzalna pretraga i AI razgovor kroz kanale — omnisearch (dopuna, avgust 2026, na zahtev vlasnika)

**Napomena o fazi (razrešava naizgled sukob sa poglavljem 8 Master dokumenta):** M15 kao celina je Faza 7 — puna AI orkestracija po svim modulima, uvedena tek kad je svaki modul "stabilan u produkciji". Omnisearch **ne mora da čeka Fazu 7** u celini — to je zaseban `module_code` u `ModuleAgentActivation` gate-u (poglavlje 3), npr. `M15_OMNISEARCH`, sa sopstvenim uslovom aktivacije (M17/M7/M8 kanali su stabilni i imaju dovoljno stabilne interne API-je modula koje pretražuju). Vlasnik/Direktor mogu aktivirati omnisearch čim ti uslovi budu ispunjeni, nezavisno od toga kada se aktiviraju domenski agenti pojedinačnih modula (M3, M10, itd.) — isti princip kao što M18 deo funkcija ne čeka pun M15 okvir (Master dokument poglavlje 4, napomena uz M18). Ovo znači da omnisearch realno može krenuti čim M5/M17 (Faza 1) i M7/M8 (Faze 3/4) budu stabilni, ne tek u Fazi 7.

Sva tri operativna kanala (M17 interni panel, M7 B2B portal, M8 sajt — M9 gostinski deo naknadno kad dođe na red) dobijaju **istu komponentu**: jedno pretraživačko polje koje (a) na fokus/prazan upit + Enter prikazuje sve rute/stavke menija dostupne trenutnom korisniku u tom kanalu, i (b) na uneti tekst ili pitanje aktivira AI agenta koji pretražuje/objašnjava bilo šta u aplikaciji na prirodnom jeziku. Ovo nije zamena za M5 `/search` (pretraga proizvoda ostaje ta) — ovo je širi, aplikacioni sloj: rezervacije, fakture, dobavljači, sopstveni profil, pomoć, sve što korisnik ima pravo da vidi u tom kanalu.

### 6.5.1 `OmnisearchAgent` — novi `agent_role`

Dopuna `AIAgent.agent_role` (poglavlje 2.1): treći mogući enum, `OMNISEARCH_AGENT` — poput `GLAVNI_AGENT`, ima pristup preko granica modula (jer pretraga po definiciji mora da dohvati podatke iz više modula odjednom), ali **strogo samo za čitanje** — nema nijednu dozvolu tipa `CREATE`/`EDIT`/`SUBMIT`/`APPROVE` ni u jednom modulu, sprovedeno na nivou M1 RBAC-a isto kao svaki drugi nalog. Ovo je namerno uže ovlašćenje od glavnog agenta.

### 6.5.2 Sprovođenje vidljivosti — ništa mimo postojećih pravila

`OmnisearchAgent` **nikad** ne čita direktno iz baze — poziva iste interne API-je kao i sam kanal koji ga je pozvao (princip #1/#3, poglavlje 3 Master dokumenta), sa identitetom i pravima **korisnika koji pretražuje**, ne sopstvenim širim pristupom. Posledica: rezultati pretrage automatski poštuju već postojeća ograničenja bez ijedne nove provere —

- identitet dobavljača se ne pojavljuje u rezultatima za M7/M8 kontekst (M2 poglavlje 5.1, M5 poglavlje 6.2);
- prodajni agent u M17 vidi u rezultatima samo svoje klijente, ne tuđe (M1 RBAC, M5 poglavlje 10);
- subagent u M7 ne vidi rezervacije/goste svog sub-subagenta (M7 poglavlje 6);
- gost na M8 vidi samo sopstvene rezervacije.

Ako upit zahteva podatak do kog korisnik nema pravo pristupa, agent to tretira isto kao da je API vratio 403 — ne otkriva postojanje podatka, samo kaže da nema rezultata ili da nema ovlašćenje da odgovori na to.

### 6.5.3 Prikaz svih ruta/menija na prazan upit ("Enter")

Za svaki kanal (M17, M7, M8) postoji **statička, ulogom filtrirana lista** dostupnih ruta/stavki menija (definisana u samom kanalu — M17/M7/M8 specifikaciji, ne dupliran podatak u M15). Kad korisnik pritisne Enter bez teksta (ili fokusira polje), kanal lokalno prikazuje tu listu filtriranu na sopstvenu ulogu — ovo **ne** ide kroz `OmnisearchAgent` niti poziva AI, jer je čisto statična navigacija bez potrebe za pretragom ili jezičkim modelom (ista logika kao M18 poglavlje 6 — dobar deo funkcionalnosti uopšte ne treba model).

### 6.5.4 AI razgovor — kad korisnik nešto upiše ili pita

Tek kad korisnik unese tekst, poziva se `POST /ai-orchestration/omnisearch` (poglavlje 9). Agent:
1. Pokušava prvo **direktno poklapanje** sa poznatim entitetima (broj rezervacije, ime gosta/subagenta, naziv proizvoda) preko internih API-ja modula relevantnih za taj kanal — brzo, bez jezičkog modela, ako je upit dovoljno konkretan.
2. Ako upit liči na pitanje na prirodnom jeziku ("koje rezervacije čekaju fiskalni dokument", "koliko mi je ostalo do sledećeg praga provizije", "porodični hotel u Grčkoj u avgustu"), prosleđuje se jezičkom modelu (`model_tier`, isto podešavanje kao ostali agenti, M18 poglavlje 6) koji prevodi pitanje u pozive ka relevantnim internim API-jima (M5 pretraga/rezervacije, M7 provizija/kredit, M10 fakture — u granicama prava korisnika) i vraća sažet odgovor sa linkovima ka konkretnim zapisima/stranicama.
3. Odgovor **nikad ne izvršava radnju sam** (poglavlje 4, `omnisearch.query = AUTONOMOUS`, ali ograničeno na pronalaženje) — ako korisnik pita "otkaži mi rezervaciju TT-2027-000482", agent vraća link do te rezervacije sa dugmetom za otkazivanje na toj stranici, gde korisnik ručno potvrđuje kroz postojeći M5 tok — isto obrazloženje kao "Nikad autonomno"/"Predloži pa čovek odobri" primeri kroz ceo ovaj dokument, primenjeno ovde kao jednostavno pravilo bez izuzetka: omnisearch nikad ne piše, samo čita i navigira.

### 6.5.5 Razlika po kanalu (kontekst upisan u sam kanal, ne ovde)

- **M17** — najširi obim: rezervacije, katalog, ugovori, finansije, dobavljači (M17 poglavlje 5.5).
- **M8** — najuži obim: destinacije/proizvodi, sopstvene rezervacije, pomoć (M21) — AI razgovor ovde se preklapa sa M21 §5.2 (help pitanja); `OmnisearchAgent` na M8 poziva i M21 kad pitanje liči na "kako se koristi sajt/uslovi", ne samo na pretragu proizvoda (M8 poglavlje 3a).
- **M7** — obim subagenta: katalog (bez dobavljača), sopstvene rezervacije, sopstvena mreža sub-subagenata, provizija/kredit (M7 poglavlje 2.0.3).

### 6.5.6 Praćenje zloupotrebe

Isti obrazac kao M21 poglavlje 5.5 (`HELP_AGENT_ABUSE_PATTERN`) — neuobičajen obrazac upita (pokušaj sistematskog "izvlačenja" podataka van uobičajene upotrebe) generiše `HealthSignal` ka M18, čisto informativno.

---

## 6.6 Glasovni modalitet za omnisearch/AI razgovor (dopuna, avgust 2026, na zahtev vlasnika)

**Nije nov agent, nije nova akcija — samo nov ulaz/izlaz oko postojećeg toka iz poglavlja 6.5.** Odluka vlasnika (avgust 2026): glasovni kanal prvo dobija interni tim (M17), preko mikrofona u pregledaču (ne prava telefonija/IVR u ovoj fazi), i glasom se **nikad** ne izvršava radnja — isti "nikad izvršenje" princip kao 6.5.4, bez izuzetka za glas.

### 6.6.1 Tok — glas je omotač oko `POST /omnisearch`, ne paralelan sistem

1. Korisnik pritisne/drži ikonicu mikrofona pored omnisearch polja (poglavlje 6.5, M17 poglavlje 5.5) i govori.
2. Audio se transkribuje u tekst (Speech-to-Text) — čim je tekst spreman, on **ulazi u potpuno isti** `POST /ai-orchestration/omnisearch` poziv (poglavlje 6.5.4, poglavlje 9) kao da je otkucan. `OmnisearchAgent` ne zna niti mu je bitno da li je upit stigao glasom ili tastaturom — isti `agent_role`, ista ograničenja vidljivosti (6.5.2), isti `omnisearch.query = AUTONOMOUS` iz registra (poglavlje 4), ista tvrda ograda "nikad ne izvršava radnju sam" (6.5.4).
3. Tekstualni odgovor (`ai_answer`, `matched_routes[]`, `entity_results[]`) se prikazuje vizuelno kao i inače, i **dodatno** se pročita naglas (Text-to-Speech) — glas dopunjuje ekran, ne zamenjuje ga (linkovi/dugmad i dalje zahtevaju klik, isto kao 6.5.4).
4. Ako upit liči na zahtev za radnju ("otkaži...", "pošalji...", "rezerviši..."), agent glasom pročita isti odgovor kao i tekstualno — navigaciju/link ka pravom ekranu, nikad izvršenje — i eksplicitno kaže da radnju treba potvrditi na ekranu, ne samo glasom.

### 6.6.2 Privatnost — audio je prolazan, ne trajan zapis

Sirov audio zapis se **ne čuva** posle transkripcije — samo transkribovan tekst upita ulazi u tok iz 6.5.4 i dobija isti trag u audit logu kao svaki drugi omnisearch upit (princip #5 Master dokumenta, "sve se može revidovati"). Ako se kasnije pokaže potreba za čuvanjem audio zapisa (npr. kvalitet transkripcije, obuka), to zahteva zasebnu odluku vlasnika i dopunu ove specifikacije — nije podrazumevano ponašanje.

### 6.6.3 Aktivacija — po kanalu, iznad postojećeg omnisearch gate-a

Glasovni unos se uključuje **po kanalu**, i to tek kad je omnisearch za taj kanal već aktiviran (`M15_OMNISEARCH`, poglavlje 6.5, napomena o fazi) — glas ne dobija sopstveni `ModuleAgentActivation` red, jer ne uvodi novu akciju, samo nov ulaz u postojeću. Prvi kanal je **M17** (interni tim, potvrđeno sa vlasnikom); M7/M8/M9 (subagenti, gosti na sajtu/u aplikaciji) i prava telefonija/IVR su namerno van obima ove dopune — vidi poglavlje 11.

### 6.6.4 Tehnologija — provajder namerno neodređen (isti obrazac kao poglavlje 11, LLM)

Konkretan izbor Speech-to-Text/Text-to-Speech provajdera nije deo ove specifikacije — tehnička odluka bliže trenutku implementacije, isti princip kao izbor LLM provajdera (poglavlje 11). Postoji već istražen kandidat-stek iz analize prethodnog projekta (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`, poglavlje 12) — hibridni pristup (lokalna transkripcija uz cloud fallback, standardni glas uz premium opciju za prodajni ton) i `Silero-VAD` za prirodnu detekciju kraja rečenice bez dugmeta "govori sad" — vredi ga uzeti kao polaznu tačku umesto istraživanja od nule, ali finalni izbor i dalje čeka potvrdu vlasnika kad se dođe do implementacije.

---

## 7. Podaci ka spoljnim AI provajderima

Ako se koriste eksterni AI modeli (van internog sistema), lični podaci gostiju se filtriraju pre slanja gde god je moguće (poglavlje 7, tačka 5 Master dokumenta) — konkretno, pozivi domenskih agenata ka spoljnim LLM provajderima ne smeju sadržati podatke poput broja pasoša, punog imena deteta, ili zdravstvenih podataka za osiguranje, osim kad je to apsolutno neophodno za zadatak i uz ugovor o obradi podataka sa tim provajderom.

---

## 8. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M15/module-activation/VIEW` | Vlasnik, Direktor |
| `M15/module-activation/ACTIVATE` | Vlasnik, Direktor — **nikad AI agent** |
| `M15/agent-action-type/VIEW`, `EDIT` | Vlasnik, Direktor |
| `M15/agent-inbox/VIEW` | Vlasnik, Direktor (i uloge sa relevantnim dozvolama za pojedinačne stavke, npr. Računovođa vidi M11 stavke) |

---

## 9. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/ai-orchestration`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/modules/:code/activation` | GET / PATCH | status aktivacije, ljudska potvrda prelaska u `ACTIVATED` |
| `/agents` | GET | lista svih `AIAgent` zapisa, sa statusom |
| `/action-types` | GET / POST / PATCH | registar iz poglavlja 4 |
| `/inbox` | GET | agregovane stavke na čekanju odobrenja (poglavlje 6) |
| `/omnisearch` | POST | `{query, channel, context}` → `{matched_routes[], entity_results[], ai_answer?}` (poglavlje 6.5); poziva se sa identitetom/pravima korisnika koji pretražuje, nikad sa širim pristupom agenta |

---

## 10. Izlazni kriterijum (Faza 7 — poglavlje 8 Master dokumenta)

- [ ] Nijedan modul ne dobija aktivnog domenskog agenta dok `ModuleAgentActivation.status != ACTIVATED`, i ta odluka je uvek ljudska.
- [ ] Pokušaj AI agenta da izvrši akciju klasifikovanu kao `NEVER_AUTONOMOUS` se odbija na nivou koda, čak i ako bi M1 dozvola to teorijski dozvolila.
- [ ] Agent Inbox ispravno prikazuje sve stavke na čekanju iz svih modula koji ih trenutno proizvode.
- [ ] Svaka akcija bilo kog agenta (glavnog ili domenskog) vidljiva je u M1 audit logu sa `actor_type = AI_AGENT`.
- [ ] Registar akcija (`AgentActionType`) sadrži sve akcije nabrojane u poglavlju 4 ovog dokumenta, sa tačnim nivoom.
- [ ] `POST /omnisearch` iz M17 konteksta ne vraća rezultate van prava trenutnog korisnika (test: Prodajni agent ograničen na sopstvene klijente ne dobija tuđe rezervacije u rezultatima).
- [ ] `POST /omnisearch` iz M7/M8 konteksta nikad ne vraća identitet dobavljača (isti test kao M2 poglavlje 8, M5 poglavlje 12, primenjen ovde).
- [ ] Upit koji liči na zahtev za radnju ("otkaži...", "pošalji...") vraća link/navigaciju, nikad ne izvršava radnju — provereno da `OmnisearchAgent` nema nijednu `CREATE`/`EDIT`/`SUBMIT`/`APPROVE` dozvolu ni u jednom modulu.
- [ ] Prazan upit + Enter prikazuje listu ruta filtriranu na ulogu korisnika, bez poziva ka `OmnisearchAgent`-u (poglavlje 6.5.3).
- [ ] Glasovni upit u M17 (poglavlje 6.6) transkribovan u tekst daje **identičan** rezultat kao isti tekst otkucan ručno — provereno da `POST /omnisearch` ne razlikuje izvor.
- [ ] Zahtev za radnju izgovoren glasom ("otkaži...") ne izvršava radnju — vraća se isti link/navigacija kao za tekstualni upit, i pročita se naglas da radnja zahteva potvrdu na ekranu (poglavlje 6.6.1, korak 4).
- [ ] Sirov audio zapis glasovnog upita se ne čuva posle transkripcije — u bazi/logu postoji samo transkribovan tekst, isti trag u audit logu kao tekstualni omnisearch upit (poglavlje 6.6.2).

---

## 11. Otvoreno za dalje

- Tačan raspored uvođenja agenata po modulu (koji modul prvi, kojim tempom) — zavisi od stvarnog redosleda stabilizacije u produkciji, ne može se unapred fiksirati u ovom dokumentu.
- Konkretan izbor LLM provajdera/modela po domenskom agentu — tehnička odluka koja se donosi bliže trenutku implementacije svakog agenta, van obima ove specifikacije.
- **Konkretan izbor Speech-to-Text/Text-to-Speech provajdera** (poglavlje 6.6.4) — isto obrazloženje kao LLM provajder iznad; PrimeTravel analiza (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`, poglavlje 12) je polazna tačka, ne konačna odluka.
- **Glas za M7/M8/M9 (subagenti, gosti) i prava telefonija/IVR** — namerno van obima poglavlja 6.6 (koje pokriva samo M17/interni tim preko mikrofona u pregledaču); ista arhitektura (STT → tekst → postojeći omnisearch tok → TTS) bi se trebalo da generalizuje na te kanale bez redizajna, ali zahteva zasebnu potvrdu vlasnika pre gradnje — pravi telefonski poziv (IVR/PSTN integracija) dodatno nosi i sopstvenu tehničku/troškovnu odluku (izbor telefonskog provajdera) koja nije razmatrana u ovoj verziji.
