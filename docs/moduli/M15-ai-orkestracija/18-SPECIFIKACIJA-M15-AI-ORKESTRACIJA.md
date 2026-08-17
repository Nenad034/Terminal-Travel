# Specifikacija modula M15 — AI agentska orkestracija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M15), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (Faza 7)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.12 — omnisearch prošireno na `B2C_SITE` kanal (avgust 2026, M8 §3a implementacija): `OmnisearchQueryDto.channel` prihvata i `B2C_SITE`, kontroler radi anonimno za taj kanal (`INTERNAL_PANEL` ostaje obavezno prijavljen, nepromenjeno), proizvodi idu preko `ProductsService.findAllPublic` (M2 §5.1 dobavljača-slep serializer), rezervacije preko istog user-scoped `BookingsService.findAll` ali samo za prijavljenog gosta, pitanja o platformi (M8 §3a tačka b) prosleđuju se M21 `HelpAssistantService` in-process (novo: `M21CentarZaPomocModule` izvozi `HelpAssistantService`, uvezen u `M15AiOrkestracijaModule`) — **otvoreno pitanje upisano u poglavlje 11**: M21 v1 eksplicitno isključuje anonimnog/INDIVIDUAL gosta iz `resolveHelpAudience` (M21 spec §1/§7), pa help-pitanja sa B2C_SITE trenutno rade samo za retki BUSINESS_CLIENT-povezan nalog; agent to tretira kao "isto kao 403" i pada na opšti LLM odgovor, ne baca grešku — proširenje M21 modela na anonimne/pojedinačne goste zahteva vlasnikovu poslovnu odluku, nije nagađano ovde. Poglavlje 6.5 registar (`omnisearch.query`, poglavlje 4) ostaje bez izmene — već je bio `(globalno)`, bez ograničenja na kanal, isto važi i za `docs/analize/32-AI-AGENTI-AUTONOMIJA-PREGLED.md`. v1.11 — ispravka pri M23 backend implementaciji (avgust 2026): poglavlje 6.6 eksplicitno označeno kao NEIMPLEMENTIRAN dizajn (STT/TTS omotač ne postoji ni za omnisearch ni za M23 `/knowledge/ask` — M23 v1.1 je pogrešno pretpostavila suprotno, ispravljeno tamo i ovde); v1.10 — Faza 7 prvi (opšti) prolaz implementacije (avgust 2026): pun `AgentActionType` registar (poglavlje 4) seedovan (osim 4 akcije bez postojećeg endpoint-a, vidi poglavlje 10 napomenu), sprovedba na nivou koda (poglavlje 5) preko novog `AgentActionGuard`/`@AgentAction` (`apps/api/src/common/guards/agent-action.guard.ts`, `apps/api/src/common/decorators/agent-action.decorator.ts`) primenjena na 9 stvarnih endpoint-a kroz M3/M5/M7/M10/M11/M12/M14/M20, `GET /ai-orchestration/inbox` (Agent Inbox, poglavlje 6) i `GET/POST/PATCH /ai-orchestration/action-types` (poglavlje 9). **Ispravka stale reference**: `M11 tourist_tax_remittance.draft`/`.submit` uklonjeni iz registra — M11 spec (`08-SPECIFIKACIJA-M11-COMPLIANCE.md`, v2.0) je eTurista/boravišnu taksu eksplicitno uklonio iz obima M11 još ranije, ova tabela nije bila usklađena. v1.9 — prvi prolaz implementacije (avgust 2026): omnisearch (poglavlje 6.5) za M17 kanal, Prisma modeli `AIAgent`/`ModuleAgentActivation`/`AgentActionType` (pun oblik tabele, seedovan samo omnisearch deo registra iz poglavlja 4), `POST /ai-orchestration/omnisearch` i `GET/PATCH /modules/:code/activation` (`apps/api/src/modules/m15-ai-orkestracija/`), `CommandPalette.tsx` u M17 panelu povezan na pravi endpoint. `AIAgent.agent_role` dopunjen trećom vrednošću `OMNISEARCH_AGENT` u kodu/šemi (poglavlje 2.1 tabela ispod je usklađena da to odražava — ranije je ta vrednost postojala samo tekstualno u poglavlju 6.5.1). Van obima ovog prolaza (vidi poglavlje 11): 6.5.6 (spoljne recenzije — čeka whitelist odluku vlasnika), 6.6 (glasovni modalitet), M7/M8 kanali (samo M17 ovaj prolaz), 6.5.7 praćenje zloupotrebe (blokirano na M18, koji još ne postoji u kodu), i puna `AgentActionType`/`AIAgent` mašinerija za module van omnisearch-a (M3/M5/M6/... domenski agenti). **Rešeno poglavlje 11 — izbor LLM provajdera za omnisearch:** Anthropic Claude, model `claude-haiku-4-5-20251001` (`model_tier = LIGHT`), odluka vlasnika avgust 2026 — vidi poglavlje 6.5.4 dopunu ispod; izbor provajdera po DRUGIM domenskim agentima (M3, M10, itd.) ostaje otvoren, ta stavka u poglavlju 11 se ne menja. v1.8 — dodato poglavlje 6.5.6 (spoljna pretraga recenzija hotela/destinacija preko imenovanog, ograničenog spiska sajtova — `ExternalReviewSource`), i pojašnjenje da rezultati pretrage proizvoda uključuju direktno M2 `media[]` (fotografije) bez dodatnog jezičkog opisa, radi manje potrošnje tokena — oboje na zahtev vlasnika (avgust 2026), poreklo: razgovor o mogućnosti da korisnici pričaju sa aplikacijom (tekstom/glasom) i traže slike hotela, dodatne informacije o destinaciji ili recenzije sa spoljnih sajtova; v1.7 — dodate tri stavke registra za M23 `knowledge_*` (poglavlje 4) i prošireno poglavlje 6.6 da pokriva i `POST /knowledge/ask` (nov modul M23, avgust 2026, na zahtev vlasnika); v1.6 dodato poglavlje 6.6 (glasovni modalitet za omnisearch — Speech-to-Text/Text-to-Speech kao omotač oko postojećeg `POST /omnisearch` toka, bez novog agenta ili akcije), na zahtev vlasnika (avgust 2026): prvi kanal je M17 (interni tim) preko mikrofona u pregledaču, glasom se nikad ne izvršava radnja, audio se ne čuva posle transkripcije; v1.5 dodate tri stavke registra za M7 `subagent_chat.*` (poglavlje 4), AI agent chat za subagente sa izvršnim ovlašćenjem, na zahtev vlasnika (avgust 2026), zatvara problem #8 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`; v1.4 dodato poglavlje 6.5 (univerzalna pretraga i AI razgovor kroz M17/M7/M8 — omnisearch), na zahtev vlasnika (avgust 2026), posle vizuelnog nacrta za sva tri kanala; v1.3 dodate četiri stavke registra za M21 (Centar za pomoć); v1.2 dodata stavka M3 `contract_period.low_capacity_alert` (poglavlje 4.3); v1.1 ispravila zastarelu referencu na M14 poglavlje 3 (pomereno na 4 pri dodavanju Reklamacija) i dodala nedostajuće stavke za M20/M11/M14 uvedene naknadno
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
| agent_role | enum: `GLAVNI_AGENT`, `DOMENSKI_AGENT`, `OMNISEARCH_AGENT` *(treća vrednost dodata pri implementaciji omnisearch-a, poglavlje 6.5.1 — v1.9)* | |
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
| M23 | `knowledge_question.answer` | `AUTONOMOUS` | M23 poglavlje 3.2 — isključivo pretraga objavljenog sadržaja, isti obrazac kao M21 `help_question.answer` |
| M23 | `knowledge_article.research_draft` | `AUTONOMOUS` | M23 poglavlje 4c — AI priprema `ArticleRevision` nacrt iz odobrenih izvora, ništa se ne piše u objavljen članak |
| M23 | `knowledge_article.publish` | `NEVER_AUTONOMOUS` | M23 poglavlje 6 — isto tako `article-source.approve`/`article-revision.approve`, nikad AI (poglavlje 4b/4c) |
| (globalno) | `omnisearch.query` | `AUTONOMOUS` | poglavlje 6.5 — **isključivo pronalaženje/navigacija, nikad izvršenje radnje** (potvrđena odluka vlasnika, avgust 2026); svaki predlog radnje (npr. "otkaži rezervaciju X") vraća se kao link ka pravoj stranici/zapisu gde čovek ručno potvrđuje, nikad se ne izvršava iz same pretrage — **isti kod pokriva i glasovni unos** (poglavlje 6.6), nema posebnog `action_code` za glas |
| (globalno) | `omnisearch.external_review_lookup` | `AUTONOMOUS` | poglavlje 6.5.6 — čisto informativno; ograničeno na kod-nivo whitelistu (`ExternalReviewSource`, samo `ACTIVE` zapisi), agent ne konstruiše proizvoljan URL, samo bira izvor i pojam pretrage |

**Napomena:** ne uključuju se ovde automatski deterministički procesi koji nisu AI odluka (npr. M11 CIS registracija garancije putovanja, M4/M10 pozivi ka spoljnim provajderima, M12 izvršenje već odobrene objave) — ti su eksplicitno razjašnjeni u svojim specifikacijama kao "isti princip kao poziv ka spoljnom provajderu, ne AI odluka" i ne spadaju u ovaj registar jer ih AI agent uopšte ne odlučuje.

Registar se **dopunjuje** kad svaki budući modul (ili izmena postojećeg) uvede novu akciju koju AI agent dodiruje — ne postoji podrazumevani nivo; svaka nova `action_code` mora eksplicitno dobiti `tier` pre nego što se agent pusti na nju.

**Održavanje:** `docs/analize/32-AI-AGENTI-AUTONOMIJA-PREGLED.md` je čitljiva, pregledna verzija ove tabele (grupisana po nivou umesto po modulu) — ažurirati je u istom prolazu kad god se ova tabela promeni.

---

## 5. Sprovedba na nivou koda (defense in depth)

Pre izvršenja bilo koje akcije čiji je `actor_type = AI_AGENT`, API sloj proverava `AgentActionType.tier` za tu akciju:
- `NEVER_AUTONOMOUS` → zahtev se **odbija na nivou koda**, bez obzira na to da li agent formalno ima M1 dozvolu za taj endpoint (dvostruka brava — ovo je namerno redundantno sa M1 RBAC-om, jer je cena greške ovde novac ili zakon).
- `PROPOSE_THEN_APPROVE` → agent može da kreira zapis u statusu koji zahteva odobrenje, ali endpoint koji ga prevodi u izvršeno stanje odbija poziv ako `actor_type = AI_AGENT`.
- `AUTONOMOUS` → dozvoljeno bez dodatne provere, van standardnog M1 RBAC-a.

**Implementacija (v1.10):** `@AgentAction(moduleCode, actionCode)` dekorator + `AgentActionGuard` (`apps/api/src/common/decorators/agent-action.decorator.ts`, `.../guards/agent-action.guard.ts`) — isti Reflector-metadata obrazac kao `@RequirePermission`/`PermissionsGuard`, ali nezavisna, dodatna ograda koja se aktivira **samo** kad je pozivalac `User.account_type = AI_AGENT` (ljudski pozivaoci prolaze nepromenjeno). Odsustvo registracije u `AgentActionType` je bezbedan podrazumevani ishod — blokira, ne propušta. Primenjeno na 9 stvarnih endpoint-a (poglavlje 4 tabela → mesto u kodu):

| action_code | Endpoint |
| :---- | :---- |
| `pricelist_import.approve_row` | `POST /contracting/pricelist-imports/:id/rows/:rowId/approve` |
| `supplier_manifest.send` | `POST /sales/supplier-manifests/:id/send` |
| `booking_item.cancel_duplicate_check` | `POST /sales/bookings/:id/cancel` (samo kad `confirmDuplicateOverride: true` — inline provera u `BookingsService.cancel`, ne generički guard, jer zavisi od tela zahteva) |
| `commission_rebate.apply` | `POST /b2b/subagents/:id/commission-rebates/:rebateId/approve` |
| `fiscal_document.submit` | `POST /finance/fiscal-documents/:id/submit` |
| `travel_guarantee.edit` | `PATCH /compliance/travel-guarantee` |
| `content.approve_publish` | `POST /marketing/content/:id/approve` |
| `ticket_response.send_with_price_or_obligation` | `POST /helpdesk/tickets/:id/messages/:messageId/send` |
| `contract.sign` (globalno) | `POST /client-contracts/:id/accept` |
| `money.transfer` (globalno) | `POST /finance/supplier-payment-instructions/:id/execute`, `POST /finance/refund-instructions/:id/execute` |

4 akcije iz registra nemaju odgovarajući endpoint u kodu (M3 `contract_period.release_warning`, M6 `communication.send_with_price_or_obligation`, M7 `subagent_chat.*`, globalno `license_data.edit`) — registrovane su kao podatak, sprovedba na nivou koda čeka da taj endpoint uopšte postoji.

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
2. Ako upit liči na pitanje na prirodnom jeziku ("koje rezervacije čekaju fiskalni dokument", "koliko mi je ostalo do sledećeg praga provizije", "porodični hotel u Grčkoj u avgustu"), prosleđuje se jezičkom modelu (`model_tier`, isto podešavanje kao ostali agenti, M18 poglavlje 6; **rešeno v1.9** — Anthropic Claude, model `claude-haiku-4-5-20251001`, `model_tier = LIGHT`, odluka vlasnika avgust 2026, resurs čita `ANTHROPIC_API_KEY` iz okruženja — ako nije podešen, omnisearch i dalje vraća korak 1 rezultate, samo bez `ai_answer`) koji prevodi pitanje u pozive ka relevantnim internim API-jima (M5 pretraga/rezervacije, M7 provizija/kredit, M10 fakture — u granicama prava korisnika) i vraća sažet odgovor sa linkovima ka konkretnim zapisima/stranicama. Kad rezultat uključuje M2 proizvod (npr. hotel), `entity_results[]` nosi direktno M2 `Product.media[]` (fotografije, poglavlje 2.3a te specifikacije) — model ih ne opisuje niti prepričava, kanal ih prikaže onako kako stoje, radi manje potrošnje tokena (isti princip kao poglavlje 6.5.3 — deo odgovora koji ne zahteva jezički model se i ne šalje kroz njega).
3. Odgovor **nikad ne izvršava radnju sam** (poglavlje 4, `omnisearch.query = AUTONOMOUS`, ali ograničeno na pronalaženje) — ako korisnik pita "otkaži mi rezervaciju TT-2027-000482", agent vraća link do te rezervacije sa dugmetom za otkazivanje na toj stranici, gde korisnik ručno potvrđuje kroz postojeći M5 tok — isto obrazloženje kao "Nikad autonomno"/"Predloži pa čovek odobri" primeri kroz ceo ovaj dokument, primenjeno ovde kao jednostavno pravilo bez izuzetka: omnisearch nikad ne piše, samo čita i navigira.

### 6.5.5 Razlika po kanalu (kontekst upisan u sam kanal, ne ovde)

- **M17** — najširi obim: rezervacije, katalog, ugovori, finansije, dobavljači (M17 poglavlje 5.5).
- **M8** — najuži obim: destinacije/proizvodi, sopstvene rezervacije, pomoć (M21) — AI razgovor ovde se preklapa sa M21 §5.2 (help pitanja); `OmnisearchAgent` na M8 poziva i M21 kad pitanje liči na "kako se koristi sajt/uslovi", ne samo na pretragu proizvoda (M8 poglavlje 3a).
- **M7** — obim subagenta: katalog (bez dobavljača), sopstvene rezervacije, sopstvena mreža sub-subagenata, provizija/kredit (M7 poglavlje 2.0.3).

### 6.5.6 Spoljne recenzije — ograničen, imenovan spisak sajtova (dopuna, avgust 2026, na zahtev vlasnika)

Kad korisnik pita za recenzije hotela/destinacije ("kakve su recenzije za ovaj hotel"), `OmnisearchAgent` **ne pretražuje slobodno internet** — sme da poseti isključivo sajtove sa unapred odobrenog spiska koji unosi Vlasnik/Direktor. Razlog: sprečava da agent ode na nerelevantan ili nepouzdan sajt, i drži trošak/vreme upita predvidivim (jedan do nekoliko ciljanih poziva, ne opšta pretraga).

#### `ExternalReviewSource`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| site_name | string | npr. "TripAdvisor", "Booking.com recenzije" — prikazuje se korisniku uz izvor odgovora |
| search_url_template | string | template sa jednim placeholder-om za pojam pretrage (npr. naziv hotela + destinacija), npr. `https://primer.com/search?q={query}` — agent SME samo da popuni `{query}`, nikad da sastavi ili poseti bilo koji drugi URL na tom ili drugom domenu |
| status | enum: `ACTIVE`, `DISABLED` | isključen izvor se preskače bez greške korisniku |
| added_by | UUID (FK → M1 User) | uvek ljudski unos — dodavanje/uklanjanje sajta sa spiska nikad nije AI odluka |
| created_at | timestamp | |

**Tok:** agent prepozna da pitanje traži recenziju (isti korak kao 6.5.4, tačka 2, deo prevoda pitanja u nameru), pozove **samo** `ACTIVE` izvore preko njihovog `search_url_template`-a (deterministička zamena placeholder-a, ne slobodna navigacija), izvuče kratak sažetak/ocenu ako je dostupna (ne kopira ceo sadržaj strane), i vrati odgovor sa jasno označenim izvorom ("prema TripAdvisor-u...") i linkom na samu stranicu za dalje čitanje. Ako nijedan izvor ne vrati rezultat, agent to kaže umesto da izmišlja recenziju.

**Sprovedba na nivou koda (isti princip kao poglavlje 5):** poziv spoljnom sajtu ide kroz jedan zajednički klijent koji prima samo `(sourceId, query)`, sastavlja URL isključivo iz `search_url_template` te baze zapisa, i odbija svaki pokušaj da mu se prosledi proizvoljan URL — jezički model ne konstruiše URL sam, samo bira koji `ExternalReviewSource` (po `site_name`) je relevantan i koji pojam pretrage da pošalje.

### 6.5.7 Praćenje zloupotrebe

Isti obrazac kao M21 poglavlje 5.5 (`HELP_AGENT_ABUSE_PATTERN`) — neuobičajen obrazac upita (pokušaj sistematskog "izvlačenja" podataka van uobičajene upotrebe) generiše `HealthSignal` ka M18, čisto informativno.

---

## 6.6 Glasovni modalitet za omnisearch/AI razgovor (dopuna, avgust 2026, na zahtev vlasnika)

**Status implementacije (potvrđeno pri M23 backend prolazu, avgust 2026): NIJE implementirano.** Ovo poglavlje ostaje čist dizajn/spec za budući prolaz — nijedan STT/TTS kod ne postoji u repozitorijumu za `POST /omnisearch` ni za `POST /knowledge/ask` (nula pogodaka pri pretrazi koda). M23 specifikacija (v1.1) je ranije pogrešno pretpostavila da ovaj omotač već postoji i da samo treba "proširiti" — ispravljeno u M23 v1.2 (`docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md` poglavlje 3.2/9/10). Tekst ispod (6.6.1-6.6.4) je i dalje validan DIZAJN za kad se implementacija uradi (čeka izbor STT/TTS tehnologije, poglavlje 6.6.4), nije opis postojećeg ponašanja.

**Nije nov agent, nije nova akcija — samo nov ulaz/izlaz oko postojećeg toka iz poglavlja 6.5.** Odluka vlasnika (avgust 2026): glasovni kanal prvo dobija interni tim (M17), preko mikrofona u pregledaču (ne prava telefonija/IVR u ovoj fazi), i glasom se **nikad** ne izvršava radnja — isti "nikad izvršenje" princip kao 6.5.4, bez izuzetka za glas.

**Proširenje (dopuna avgust 2026, M23 specifikacija):** isti omotač pokriva i `POST /api/v1/knowledge/ask` (M23 poglavlje 3.2/8) — mikrofon pored polja za pitanje u M23 delu M17 panela koristi identičan STT/TTS tok kao omnisearch (poglavlje 6.6.1–6.6.4 važe bez izmene, samo se u koraku 2 poziva `/knowledge/ask` umesto `/omnisearch` kad je korisnik u tom kontekstu).

### 6.6.1 Tok — glas je omotač oko `POST /omnisearch` (ili `POST /knowledge/ask`), ne paralelan sistem

1. Korisnik pritisne/drži ikonicu mikrofona pored omnisearch polja (poglavlje 6.5, M17 poglavlje 5.5) ili pored M23 pitanja i govori.
2. Audio se transkribuje u tekst (Speech-to-Text) — čim je tekst spreman, on **ulazi u potpuno isti** `POST /ai-orchestration/omnisearch` poziv (poglavlje 6.5.4, poglavlje 9), ili `POST /api/v1/knowledge/ask` kad je kontekst M23, kao da je otkucan. `OmnisearchAgent`/M23 agent ne zna niti mu je bitno da li je upit stigao glasom ili tastaturom — isti `agent_role`, ista ograničenja vidljivosti (6.5.2), isti `omnisearch.query`/`knowledge_question.answer = AUTONOMOUS` iz registra (poglavlje 4), ista tvrda ograda "nikad ne izvršava radnju sam" (6.5.4).
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
| `M15/external-review-source/VIEW` | Vlasnik, Direktor, Sales Manager |
| `M15/external-review-source/EDIT` | Vlasnik, Direktor — dodavanje/uklanjanje sajta sa whitelist-e, nikad AI agent |

---

## 9. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/ai-orchestration`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/modules/:code/activation` | GET / PATCH | status aktivacije, ljudska potvrda prelaska u `ACTIVATED` |
| `/agents` | GET | lista svih `AIAgent` zapisa, sa statusom — **van obima v1.10**, nije zatraženo, ostaje otvorena stavka (poglavlje 11) |
| `/action-types` | GET / POST / PATCH | registar iz poglavlja 4. **Implementirano v1.10** (`apps/api/src/modules/m15-ai-orkestracija/action-types/`), `M15/agent-action-type/VIEW`/`EDIT` |
| `/inbox` | GET | agregovane stavke na čekanju odobrenja (poglavlje 6). **Implementirano v1.10** (`apps/api/src/modules/m15-ai-orkestracija/agent-inbox/`), `M15/agent-inbox/VIEW` — 5 izvora sa stvarnim endpoint-om (M3/M5/M7/M12/M14), svaki upitan samo ako pozivalac ima odgovarajuću VIEW dozvolu tog modula |
| `/omnisearch` | POST | `{query, channel, context, lang?}` → `{matched_routes[], entity_results[], ai_answer?}` (poglavlje 6.5); poziva se sa identitetom/pravima korisnika koji pretražuje, nikad sa širim pristupom agenta. `channel` prima `INTERNAL_PANEL` (obavezna prijava) i `B2C_SITE` (dopuna avgust 2026, M8 §3a — radi i anonimno, `actorUserId = null`) |
| `/external-review-sources` | GET / POST / PATCH | whitelist sajtova za spoljnu pretragu recenzija (poglavlje 6.5.6), uvek ljudski unos |

---

## 10. Izlazni kriterijum (Faza 7 — poglavlje 8 Master dokumenta)

**Napomena (v1.10):** stavke vezane za omnisearch se odnose na prvi prolaz (M17 kanal), ne na pun M15 Faza 7 okvir — vidi napomenu u poglavlju 6.5 o zasebnom `ModuleAgentActivation` gate-u. Stavke 2/3/5 su zatvorene u v1.10 (registar, sprovedba na nivou koda, Agent Inbox) — i dalje NIJE u obimu: sami domenski AI agenti po modulu (M3/M5/M6/M7/M10/...) koji bi stvarno, autonomno pozivali ove endpoint-e — v1.10 gradi ogradu za kad taj dan dođe, ne uvodi izvršioce.

- [x] Nijedan modul ne dobija aktivnog domenskog agenta dok `ModuleAgentActivation.status != ACTIVATED`, i ta odluka je uvek ljudska. *(potvrđeno za `M15_OMNISEARCH`: seed startuje na `NOT_READY`, `ModuleActivationService.update` odbija `actor_type = AI_AGENT` čak i sa validnom dozvolom — jedinični test `module-activation.service.spec.ts`)*
- [x] Pokušaj AI agenta da izvrši akciju klasifikovanu kao `NEVER_AUTONOMOUS` se odbija na nivou koda, čak i ako bi M1 dozvola to teorijski dozvolila. *(v1.10 — `AgentActionGuard` (poglavlje 5), primenjen na `fiscal_document.submit`, `travel_guarantee.edit`, `money.transfer`×2, `contract.sign`; jedinični test `agent-action.guard.spec.ts` dokazuje odbijanje AI_AGENT aktera za NEVER_AUTONOMOUS i propuštanje HUMAN aktera nepromenjeno)*
- [x] Agent Inbox ispravno prikazuje sve stavke na čekanju iz svih modula koji ih trenutno proizvode. *(v1.10 — `GET /ai-orchestration/inbox`, 5 izvora sa stvarnim endpoint-om (M3/M5/M7/M12/M14), svaki upitan samo uz odgovarajuću VIEW dozvolu; jedinični test `agent-inbox.service.spec.ts`. Napomena: 3 PROPOSE_THEN_APPROVE akcije bez postojećeg endpoint-a — M6 communication.send, M7 subagent_chat.booking_confirm, M3 contract_period.release_warning — nemaju šta da se prikaže dok taj endpoint ne postoji.)*
- [x] Svaka akcija bilo kog agenta (glavnog ili domenskog) vidljiva je u M1 audit logu sa `actor_type = AI_AGENT`. *(potvrđeno za omnisearch: svaki `POST /omnisearch` upisuje `AuditLogEntry` sa `actor_type = AI_AGENT`, actor id = seedovani `OmnisearchAgent` M1 nalog — jedinični test)*
- [x] Registar akcija (`AgentActionType`) sadrži sve akcije nabrojane u poglavlju 4 ovog dokumenta, sa tačnim nivoom. *(v1.10 — `seedM15ActionRegistry` u `apps/api/prisma/seed/seed.ts` seeduje sve redove poglavlja 4, uključujući M18/M21/M23 iako ti moduli još nemaju kod — registar je namerno unapred popunjen podacima, sprovedba na nivou koda ide tek kad endpoint postoji.)*
- [x] `POST /omnisearch` iz M17 konteksta ne vraća rezultate van prava trenutnog korisnika. *(sprovedeno pozivom `BookingsService.findAll`/`ProductsService.findAll` sa identitetom pozivaoca — nikad širim pristupom agenta; jedinični test dokazuje da se `actor.userId` prosleđuje nepromenjeno i da različiti akteri dobijaju tačno ono što M5/M2 servis vrati za njihov identitet. Napomena: M5 sam po sebi trenutno nema per-agent scoping "Prodajni agent vidi samo svoje klijente" za `channel=INTERNAL_PANEL` — omnisearch nasleđuje tačno to ograničenje, ne uvodi novo niti ga zaobilazi; puna per-agent scoping u M5 je odvojen, već postojeći gap dokumentovan u toj specifikaciji.)*
- [x] `POST /omnisearch` iz M8 konteksta nikad ne vraća identitet dobavljača. *(dopuna avgust 2026 — `B2C_SITE` implementiran: proizvodi idu isključivo preko `ProductsService.findAllPublic` (M2 §5.1 dobavljača-slep serializer, isti kao `PublicProductsController`), rezervacije su ograničene na sopstvene i samo za prijavljenog gosta; jedinični testovi u `omnisearch.service.spec.ts` pokrivaju anoniman i prijavljen B2C_SITE slučaj.)* M7 kanal **i dalje čeka poseban prolaz** (poglavlje 6.5.5).
- [x] Upit koji liči na zahtev za radnju ("otkaži...", "pošalji...") vraća link/navigaciju, nikad ne izvršava radnju. *(jedinični test dokazuje da `OmnisearchService` u sopstvenom izvornom kodu nema nijedan poziv mutirajuće (`cancel`/`modify`/`create`/...) metode M5/M2 servisa — samo `findAll`)*
- [x] Prazan upit + Enter prikazuje listu ruta filtriranu na ulogu korisnika, bez poziva ka `OmnisearchAgent`-u. *(`CommandPalette.tsx` — prazan upit ostaje čisto lokalna navigacija iz `nav.ts`, `POST /api/omnisearch` se poziva samo kad `query.trim().length > 0`)*
- [ ] Glasovni upit u M17 transkribovan u tekst daje identičan rezultat kao isti tekst otkucan ručno. **Čeka poseban prolaz** — poglavlje 6.6 (glasovni modalitet) nije u obimu ovog prolaza.
- [ ] Zahtev za radnju izgovoren glasom ne izvršava radnju. **Čeka poseban prolaz** — isti razlog kao stavka iznad.
- [ ] Sirov audio zapis glasovnog upita se ne čuva posle transkripcije. **Čeka poseban prolaz** — isti razlog.
- [x] Pitanje o proizvodu (npr. hotelu) u odgovoru direktno nosi M2 `Product.media[]`, bez jezičkog opisa fotografija. *(`OmnisearchService.searchProducts` prosleđuje `product.media` nepromenjeno u `EntityResult.media`, jezički model ga ne opisuje ni kad se poziva)*
- [ ] Spoljna pretraga recenzija poziva isključivo `ACTIVE` zapise iz `ExternalReviewSource`. **Čeka poseban prolaz** — poglavlje 6.5.6 nije u obimu ovog prolaza (čeka whitelist odluku vlasnika).

---

## 11. Otvoreno za dalje

- **Novo (avgust 2026, B2C_SITE omnisearch dopuna).** M21 v1 (`resolveHelpAudience`) namerno vraća `null` za anonimnog posetioca i za pojedinačnog (INDIVIDUAL) gosta — M21 spec §1/§7 eksplicitno kaže da je to van obima v1. Posledica: M8 omnisearch tačka (b) ("pitanje o platformi ide ka M21") strukturno ne može da odgovori na help pitanja za ogromnu većinu B2C saobraćaja (anonimni posetioci i INDIVIDUAL gosti — jedini tip naloga koji B2C sajt uopšte kreira, M8 spec poglavlje 3 korak 3), radi samo za redak slučaj gosta povezanog sa `LEGAL_ENTITY` nalogom. Da li M21 treba da dobije novu publiku (npr. `ANONYMOUS`/`INDIVIDUAL_GUEST`) sa sopstvenim, uže definisanim skupom članaka (koji sadržaj bi bio bezbedan da vidi neprijavljen gost?) je poslovna odluka koja zahteva vlasnikovu potvrdu, ne nagađa se ovde — dok se ne reši, B2C help pitanja padaju na opšti LLM odgovor (§6.5.4.2) bez pristupa M21 sadržaju.
- Tačan raspored uvođenja agenata po modulu (koji modul prvi, kojim tempom) — zavisi od stvarnog redosleda stabilizacije u produkciji, ne može se unapred fiksirati u ovom dokumentu.
- Konkretan izbor LLM provajdera/modela po domenskom agentu — tehnička odluka koja se donosi bliže trenutku implementacije svakog agenta, van obima ove specifikacije.
- **Konkretan izbor Speech-to-Text/Text-to-Speech provajdera** (poglavlje 6.6.4) — isto obrazloženje kao LLM provajder iznad; PrimeTravel analiza (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`, poglavlje 12) je polazna tačka, ne konačna odluka.
- **Glas za M7/M8/M9 (subagenti, gosti) i prava telefonija/IVR** — namerno van obima poglavlja 6.6 (koje pokriva samo M17/interni tim preko mikrofona u pregledaču); ista arhitektura (STT → tekst → postojeći omnisearch tok → TTS) bi se trebalo da generalizuje na te kanale bez redizajna, ali zahteva zasebnu potvrdu vlasnika pre gradnje — pravi telefonski poziv (IVR/PSTN integracija) dodatno nosi i sopstvenu tehničku/troškovnu odluku (izbor telefonskog provajdera) koja nije razmatrana u ovoj verziji.
- **`GET /ai-orchestration/agents`** (poglavlje 9) — admin prikaz svih `AIAgent` zapisa, nije zatraženo u v1.10 prolazu, dodaje se kasnije po potrebi.
- **4 akcije iz registra bez postojećeg endpoint-a** (M3 `contract_period.release_warning`, M6 `communication.send_with_price_or_obligation`, M7 `subagent_chat.*`, globalno `license_data.edit`) — registar ih sadrži kao podatak (poglavlje 4), sprovedba na nivou koda i prikaz u Agent Inbox-u čekaju da taj endpoint uopšte bude izgrađen.
