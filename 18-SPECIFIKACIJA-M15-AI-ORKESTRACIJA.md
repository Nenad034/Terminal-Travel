# Specifikacija modula M15 — AI agentska orkestracija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M15), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (Faza 7)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.3 — dodate četiri stavke registra za M21 (Centar za pomoć); v1.2 dodata stavka M3 `contract_period.low_capacity_alert` (poglavlje 4.3); v1.1 ispravila zastarelu referencu na M14 poglavlje 3 (pomereno na 4 pri dodavanju Reklamacija) i dodala nedostajuće stavke za M20/M11/M14 uvedene naknadno
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
| M5 | `supplier_manifest.draft` | `AUTONOMOUS` | M5 poglavlje 8.4 |
| M5 | `supplier_manifest.send` | `PROPOSE_THEN_APPROVE` | M5 poglavlje 8.4 |
| M6 | `communication.draft` | `AUTONOMOUS` | M6 poglavlje 4 |
| M6 | `communication.send_with_price_or_obligation` | `PROPOSE_THEN_APPROVE` | M6 poglavlje 4 |
| M7 | `commission_rebate.calculate_draft` | `AUTONOMOUS` | M7 poglavlje 3.2 |
| M7 | `commission_rebate.apply` | `PROPOSE_THEN_APPROVE` | M7 poglavlje 3.2 |
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

**Napomena:** ne uključuju se ovde automatski deterministički procesi koji nisu AI odluka (npr. M11 eTurista prijava, M4/M10 pozivi ka spoljnim provajderima, M12 izvršenje već odobrene objave) — ti su eksplicitno razjašnjeni u svojim specifikacijama kao "isti princip kao poziv ka spoljnom provajderu, ne AI odluka" i ne spadaju u ovaj registar jer ih AI agent uopšte ne odlučuje.

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

---

## 10. Izlazni kriterijum (Faza 7 — poglavlje 8 Master dokumenta)

- [ ] Nijedan modul ne dobija aktivnog domenskog agenta dok `ModuleAgentActivation.status != ACTIVATED`, i ta odluka je uvek ljudska.
- [ ] Pokušaj AI agenta da izvrši akciju klasifikovanu kao `NEVER_AUTONOMOUS` se odbija na nivou koda, čak i ako bi M1 dozvola to teorijski dozvolila.
- [ ] Agent Inbox ispravno prikazuje sve stavke na čekanju iz svih modula koji ih trenutno proizvode.
- [ ] Svaka akcija bilo kog agenta (glavnog ili domenskog) vidljiva je u M1 audit logu sa `actor_type = AI_AGENT`.
- [ ] Registar akcija (`AgentActionType`) sadrži sve akcije nabrojane u poglavlju 4 ovog dokumenta, sa tačnim nivoom.

---

## 11. Otvoreno za dalje

- Tačan raspored uvođenja agenata po modulu (koji modul prvi, kojim tempom) — zavisi od stvarnog redosleda stabilizacije u produkciji, ne može se unapred fiksirati u ovom dokumentu.
- Konkretan izbor LLM provajdera/modela po domenskom agentu — tehnička odluka koja se donosi bliže trenutku implementacije svakog agenta, van obima ove specifikacije.
