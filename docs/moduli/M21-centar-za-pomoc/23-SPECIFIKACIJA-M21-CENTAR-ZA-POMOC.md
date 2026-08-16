# Specifikacija modula M21 — Centar za pomoć (baza znanja + AI asistent)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M21), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (poprečan modul, ne vezan za jednu fazu — isti slučaj kao M17/M18/M19)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (backend + M17 ekran) — vidi poglavlje 7 (izlazni kriterijum) i `docs/api/M21-centar-za-pomoc.md`. M17 ekran (`apps/panel/src/app/(app)/pomoc/`) implementiran avgust 2026 (M17 Faza 7) — kod napisan i pušovan, ručna live-provera ostaje otvorena stavka. M7/M8 UI (subagenti/korporativni klijenti) ostaje poseban naredni korak.
**Verzija:** 1.3 — prvi prolaz implementacije (avgust 2026): kod pod `apps/api/src/modules/m21-centar-za-pomoc/`. Potvrđene vlasnikove odluke iz poglavlja 8 (prethodno "otvoreno"): (a) `EDIT`/`PUBLISH` podela — HR dobija `EDIT` za sve tri publike (staff/subagent/business), `PUBLISH` isključivo Direktor/Vlasnik, isti dvoslojni obrazac kao M12 `ContentPiece`; (b) prag/algoritam grupisanja `HelpArticleSuggestion` — 3+ pitanja (`confidence IN {NONE,LOW}` ili `was_helpful=false`) u prozoru od 30 dana, grupisano po `audience_context` + (preklapanje `matched_article_ids` KAD postoji, ili preklapanje ≥2 značajne reči teksta pitanja inače, jer `NONE` pitanja po definiciji nemaju poklapanja) — dokumentovano kao "podešava se empirijski", isti princip kao M18 pragovi. Prompt-injection ograda (§5.2) sprovedena strukturno: kandidat-članci za AI asistenta se učitavaju isključivo iz `HelpArticle.status=PUBLISHED` filtrirano po `audience_context` pozivaoca PRE nego što jezički model (ili heuristički fallback bez njega) uopšte vidi bilo šta — sadržaj van tog skupa fizički ne stiže do modela, bez obzira na formulaciju pitanja. v1.2 — dodata treća publika: korporativni self-service klijenti (poglavlje 1, 2, 3), na zahtev vlasnika (avgust 2026) uz zahtev za API dokumentacijom za spoljne integratore (vidi Master dokument, napomena posle poglavlja 8)
**Zavisi od:** M1 (identitet, RBAC, audit log), M6 (provera `ClientAccount.account_type = LEGAL_ENTITY`), M14 (eskalacija ka tiketu), M15 (AI agent okvir), M17 (kanal za tim), M7 (kanal za subagente), M8 (kanal za korporativne klijente)

---

## 1. Svrha i obim modula

M21 je baza znanja za korišćenje same Terminal platforme — uputstvo za rad, ne uputstvo za putovanje. Tri odvojene publike, oštro razdvojene:

1. **Interni tim** — kako se koristi interni panel (M17) i svaki modul u njemu, kako se rade konkretni radni postupci (npr. "kako obraditi otkazivanje sa delimičnim povraćajem").
2. **B2B subagenti** — kako se koristi portal (M7), kako se poručuje u ime gosta, kako se prati provizija i kreditni limit.
3. **Korporativni self-service klijenti** *(dodato avgust 2026, na zahtev vlasnika)* — firme koje same rezervišu za sebe preko M8/M9 (nisu subagenti, ne preprodaju), prepoznaju se kao `ClientAccount.account_type = LEGAL_ENTITY` (M6) sa `linked_user_id` nalogom čiji je `User.account_type = GUEST` (M1). Uputstvo pokriva samostalno korišćenje sajta/aplikacije kao poslovni nalog: grupno rezervisanje, izdavanje fakture na pravno lice, upravljanje profilom firme.

**Razlika u odnosu na M14 (Helpdesk):** M14 rešava problem koji je već nastao ("nešto ne radi", "imam pritužbu"). M21 sprečava da problem uopšte nastane — odgovara na "kako da..." pre nego što korisnik zapne. Kad M21 ne zna odgovor, prosleđuje ka M14 (poglavlje 5) — jedan tok, dva različita trenutka.

**Razlika u odnosu na M12 (Marketing/Content Engine):** M12 proizvodi sadržaj za goste na javnim kanalima radi prodaje. M21 proizvodi sadržaj za tim/subagente/korporativne klijente radi rada sa alatom — nikad prodajni/promotivni sadržaj, potpuno odvojen sadržajni tok.

**Namerno van obima v1:** sadržaj za pojedinačne (fizička lica) krajnje goste (M8/M9, `ClientAccount.account_type = INDIVIDUAL`). Pojedinačni gost tipično ne treba uputstvo za korišćenje alata za samostalno rezervisanje — ako se pokaže potreba za AI-asistiranim FAQ za tu publiku, to je prirodno proširenje M21, ne novi modul, ali se ne pretpostavlja unapred. Korporativni klijenti (v1.2) su izuzetak jer koriste alat na složeniji, poslovni način (grupne rezervacije, fakturisanje na firmu) koji opravdava posebno uputstvo od starta.

---

## 2. Model podataka

### 2.1 `HelpArticle` — jedan članak baze znanja
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| slug | string, unique | |
| audience | niz enum-a (JSONB), podskup `{STAFF, SUBAGENT, BUSINESS_CLIENT}` | određuje ko sme da vidi — vidi poglavlje 3 (RBAC); zamenjuje raniju `BOTH` vrednost (v1.1), koja nije skalirala na treću publiku — članak vidljiv i timu i subagentima sad ima `audience = [STAFF, SUBAGENT]` |
| related_module | string, nullable | kod modula na koji se odnosi (npr. `M5`, `M10`), radi filtriranja i pretrage |
| is_critical_example | boolean | `true` za korak-po-korak radne scenarije (poglavlje 4) — izdvaja se vizuelno od opisnih članaka |
| status | enum: `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `ARCHIVED` | isti obrazac kao M12 `ContentPiece.status` |
| generated_by | enum: `AI`, `HUMAN` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno pre `PUBLISHED`, nikad AI** — isto pravilo kao M12 |
| created_at / updated_at / published_at | timestamp | |

### 2.2 `HelpArticleTranslation`
Isti obrazac kao M2 `ProductTranslation` / M12 `ContentTranslation` — redovi po jeziku, isti fallback (traženi jezik → engleski → srpski). U praksi se za internu/subagentsku publiku očekuje da će većina članaka postojati samo na srpskom i engleskom (za sada), ali se ne ograničava strukturno — isti skup jezika kao M2.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| help_article_id | UUID (FK) | |
| language_code | enum (isti skup kao M2) | |
| title | string | |
| body | text (markdown) | za `is_critical_example = true`, telo je strukturirano kao numerisani niz koraka (obična markdown lista — nema potrebe za posebnim poljem) |

### 2.3 `HelpQuestion` — svako pitanje postavljeno AI asistentu (log)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| asked_by | UUID (FK → M1 User) | tim, subagenti i korporativni klijenti su M1 nalozi (`account_type = STAFF`, `SUBAGENT_CONTACT` ili `GUEST`) |
| audience_context | enum: `STAFF`, `SUBAGENT`, `BUSINESS_CLIENT` | određuje iz kog seta članaka agent sme da povuče odgovor — izvedeno, ne unosi ga korisnik: `STAFF`/`SUBAGENT` direktno iz `asked_by.account_type`; `BUSINESS_CLIENT` kad je `asked_by.account_type = GUEST` **i** povezani M6 `ClientAccount.account_type = LEGAL_ENTITY` — obična (`INDIVIDUAL`) GUEST pitanja ne dobijaju kontekst (van obima v1, poglavlje 1) i agent ih odbija sa uputstvom da koriste M14 |
| question_text | text | |
| answer_text | text, nullable | `null` ako agent nije našao pouzdan odgovor |
| matched_article_ids | niz UUID | koji članci su korišćeni za odgovor — radi sledljivosti (isto načelo kao M13 "svaki izveštaj pokazuje izvor") |
| confidence | enum: `HIGH`, `LOW`, `NONE` | `NONE` automatski pokreće ponudu za eskalaciju (poglavlje 5) |
| was_helpful | boolean, nullable | povratna informacija korisnika (👍/👎), nullable dok se ne oceni |
| escalated_ticket_id | UUID, nullable (FK → M14 `Ticket`) | popunjeno ako je korisnik potvrdio eskalaciju |
| created_at | timestamp | |

### 2.4 `HelpArticleSuggestion` — predlog novog članka iz stvarne upotrebe
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| based_on_question_ids | niz UUID (FK → `HelpQuestion`) | grupa pitanja koja su dovela do predloga (ponovljena `NONE`/`LOW` pitanja na istu temu, ili `was_helpful = false` obrazac) |
| draft_title / draft_body | string / text | AI nacrt, na osnovu stvarnih pitanja koja su ostala bez dobrog odgovora |
| status | enum: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` | `APPROVED` kreira stvarni `HelpArticle` (status `PENDING_APPROVAL`, čeka i sopstveno objavljivanje — dva odvojena koraka odobrenja, isto kao što `pricelist_import` (M3) razdvaja ekstrakciju od upisa |
| reviewed_by | UUID, nullable (FK → M1 User) | |
| created_at / reviewed_at | timestamp | |

---

## 3. Vidljivost po publici (RBAC — ponovo koristi M1, ne nov sistem prava)

Nema paralelnog sistema dozvola. Filtriranje ide kroz iste M1 `Permission` zapise:

| Permission (module/resource/action) | Podrazumevana dodela |
| :---- | :---- |
| `M21/article:staff/VIEW` | Sve interne uloge (Vlasnik, Direktor, HR, Sales Manager, Prodajni agent, Računovođa) |
| `M21/article:subagent/VIEW` | `SUBAGENT_ADMIN` |
| `M21/article:business/VIEW` *(dodato v1.2)* | Svaki `GUEST` nalog čiji je povezani `ClientAccount.account_type = LEGAL_ENTITY` (M6) — provera uživo, ne poseban flag na nalogu |
| `M21/article:staff/EDIT`, `M21/article:staff/PUBLISH` | HR, Direktor, Vlasnik (tačna podela dorađuje se pri implementaciji — vidi poglavlje 8) |
| `M21/article:subagent/EDIT`, `M21/article:subagent/PUBLISH` | Isti krug kao gore — subagenti nikad ne uređuju sopstveni help sadržaj, samo ga čitaju |
| `M21/article:business/EDIT`, `M21/article:business/PUBLISH` *(dodato v1.2)* | Isti krug kao gore — korporativni klijenti nikad ne uređuju sopstveni help sadržaj, samo ga čitaju |
| `M21/suggestion/APPROVE` | HR, Direktor, Vlasnik |
| `M21/question-log/VIEW` | HR, Direktor, Vlasnik — uvid u istoriju pitanja radi kvaliteta sadržaja i bezbednosnog pregleda |

Članak vidljiv za više publika ima više vrednosti u `audience` nizu (npr. `[STAFF, SUBAGENT]`) — vidljiv je svakoj navedenoj publici bez dodatne dozvole. Provera se radi identično kao svuda u sistemu — uživo nad bazom, ne iz tokena (M1 poglavlje 3.6).

---

## 4. Kritični primeri — korak-po-korak radni scenariji

`HelpArticle.is_critical_example = true` označava članke koji ne opisuju ekran, nego **rešavaju konkretnu situaciju od početka do kraja**, npr.:

- "Gost traži otkazivanje sa delimičnim povraćajem — koraci kroz M5/M10"
- "Novi subagent se prijavio — kako odobriti i podesiti proviziju (M7)"
- "Rezervacija zahteva fiskalni dokument ka pravnom licu — SEF tok (M10)"
- "Subagent pita gde je njegova provizija za prošli mesec (portal, M7)"

Ovi članci se prikazuju izdvojeno (poseban prikaz u UI, ne pomešano sa opisnim člancima) i imaju prioritet u pretrazi i u odgovorima AI agenta — kad postoji `is_critical_example` članak koji odgovara pitanju, agent ga navodi pre opisnih članaka o istoj temi.

---

## 5. AI asistent — ponašanje, ograda, eskalacija

### 5.1 Registracija u M15
Agent se registruje kao još jedan `AIAgent` u M15 okviru (M15 poglavlje 2), ne poseban mehanizam. `model_tier`: podrazumevano `LIGHT` (čisto pretraživanje/sažimanje objavljenog teksta — niska složenost, niska osetljivost po kriterijumu iz M18 poglavlja 6.2a).

### 5.2 Ograda — samo objavljen sadržaj, nikad živi podaci
Agent u v1 **isključivo pretražuje `HelpArticleTranslation` gde je `HelpArticle.status = PUBLISHED`**, filtrirano po `audience_context` pitaoca. **Nema pristup API-jima drugih modula (M5, M7, M10...) i ne izvršava nikakvu radnju nad stvarnim podacima** — ovo je namerna, tvrda ograda: agent ne sme biti nagovoren (upitom ili pokušajem manipulacije) da otkrije podatke van sopstvenog dokumentovanog opsega (npr. proviziju drugog subagenta, interni sadržaj namenjen samo timu ako pita subagent). Proširenje na pristup živim podacima je moguće u budućoj verziji, ali zahteva sopstvenu bezbednosnu analizu pre uvođenja — ne pretpostavlja se ovde.

### 5.3 Kad agent ne zna — eskalacija ka M14
Ako `confidence = NONE` (ili `LOW` uz eksplicitan zahtev korisnika), agent nudi: *"Nisam siguran — da otvorim tiket podršci sa ovim pitanjem?"* Ako korisnik potvrdi, kreira se M14 `Ticket` (`category` po najboljoj proceni konteksta, `channel = HELP_CENTER` — nova vrednost dodata u M14 `Ticket.channel` enum ovom specifikacijom) sa prvom `TicketMessage` već popunjenom tekstom pitanja. **Ovo nije "Predloži pa čovek odobri" u uobičajenom smislu** — potvrdu daje sam korisnik koji pita (o sopstvenom zahtevu), ne treći čovek koji odobrava tuđu akciju, pa je nivo autonomije `AUTONOMOUS` (agent priprema, korisnikov klik izvršava sopstveni zahtev — isti princip kao popunjavanje formulara koji korisnik sam šalje).

### 5.4 Petlja povratne informacije — praznine u sadržaju postaju predlozi
Kad se nagomilaju `HelpQuestion` zapisi sa `confidence = NONE`/`LOW` ili `was_helpful = false` na istu temu (prag i tačan algoritam grupisanja dorađuju se pri implementaciji — poglavlje 8), agent kreira `HelpArticleSuggestion` (`AUTONOMOUS` — čisto pripremni nacrt, ništa se ne objavljuje). Odobravanje (`PROPOSE_THEN_APPROVE`) prevodi predlog u stvarni `HelpArticle` u statusu `PENDING_APPROVAL`, koji i dalje čeka sopstveno objavljivanje kao svaki drugi članak.

### 5.5 Bezbednosno praćenje (M18)
Svako pitanje i odgovor upisuje se u `HelpQuestion` (ovaj modul) **i** u M1 `AuditLogEntry` (`actor_type = AI_AGENT`, isto kao svaki drugi agent). M18 dobija novi tip signala:

`HELP_AGENT_ABUSE_PATTERN` — dodato u M18 `HealthSignal.signal_type` enum ovom specifikacijom, `security_category = API_ABUSE`. Okidači (bilo koji): neuobičajen broj pitanja od jednog naloga u kratkom periodu; ponovljeni pokušaji formulacije koji liče na pokušaj zaobilaženja ograde iz poglavlja 5.2 (npr. traženje podataka van dokumentovanog opsega uz razne parafraze); pitanje koje eksplicitno traži da agent "zanemari prethodna uputstva" ili slično. Detekcija obrazaca je heuristička u v1 (jednostavna pravila — učestalost, ključne fraze), ne poseban ML model — dorađuje se ako se pokaže potreba.

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/help`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/articles` | GET | lista članaka, filtrirano po `audience` (prema pozivaocu), `related_module`, jeziku, `is_critical_example` |
| `/articles` | POST | novi nacrt članka (samo uloge sa `EDIT` dozvolom za odgovarajuću publiku) |
| `/articles/:id` | GET / PATCH | izmena; prelazak u `PUBLISHED` zahteva `PUBLISH` dozvolu i popunjen `approved_by` |
| `/ask` | POST | glavno pitanje ka AI agentu — `{question, }` (publika se izvodi iz naloga koji pita — za `GUEST` nalog uključuje proveru M6 `ClientAccount.account_type`, poglavlje 2.3); vraća `{answer, matched_article_ids, confidence}` |
| `/questions/:id/feedback` | POST | 👍/👎 — upisuje `was_helpful` |
| `/questions/:id/escalate` | POST | korisnikova potvrda eskalacije → kreira M14 `Ticket`, upisuje `escalated_ticket_id` |
| `/suggestions` | GET | predlozi na čekanju (vidljivo kroz M15 Agent Inbox, poglavlje 6 te specifikacije) |
| `/suggestions/:id` | PATCH | odobri (→ kreira `HelpArticle`) ili odbij |

Uz ovaj ugovor, u `docs/api/M21-centar-za-pomoc.md` vodi se dokument sa stvarnim primerima zahteva/odgovora za svaki endpoint — standing pravilo za sve module, vidi CLAUDE.md, "Održavanje dokumentacije" i Master dokument, napomena posle poglavlja 8.

---

## 7. Izlazni kriterijum

- [x] Interni tim vidi članke gde `audience` sadrži `STAFF`; subagent isključivo gde sadrži `SUBAGENT`; korporativni klijent (GUEST + LEGAL_ENTITY) isključivo gde sadrži `BUSINESS_CLIENT` — provereno da nijedna publika ne vidi članke namenjene isključivo drugoj, uključujući pojedinačnog (INDIVIDUAL) GUEST korisnika koji ne dobija pristup nijednom članku (van obima v1, poglavlje 1). Testirano `apps/api/test/m21-exit-criteria.e2e-spec.ts`.
- [x] AI agent odgovara isključivo na osnovu `PUBLISHED` članaka dostupnih toj publici; test-pokušaj da se agent nagovori da otkrije sadržaj van tog opsega (parafraziran zahtev za "tuđe" članke ili podatke) se odbija — ograda je strukturna (kandidat-skup se učitava filtriran PRE poziva modela), ne samo tekst u promptu.
- [x] Pitanje bez pouzdanog odgovora (`confidence = NONE`) nudi eskalaciju; potvrda korisnika kreira M14 tiket sa `channel = HELP_CENTER` i pitanjem već upisanim u prvu poruku.
- [x] Ponovljena `NONE`/`LOW` pitanja na istu temu generišu `HelpArticleSuggestion`; predlog se ne pretvara u vidljiv članak bez ljudskog odobrenja, a odobren predlog i dalje čeka zaseban korak objavljivanja.
- [x] Svako pitanje/odgovor upisano je u `AuditLogEntry` sa `actor_type = AI_AGENT`.
- [x] Neuobičajen obrazac pitanja (učestalost ili sadržaj koji liči na pokušaj zaobilaženja ograde) generiše `HELP_AGENT_ABUSE_PATTERN` signal u M18.
- [x] Fallback jezika radi ispravno (traženi jezik → engleski → srpski), isto pravilo kao M2.
- [x] `is_critical_example` članci prikazuju se izdvojeno (sortirani ispred opisnih u `GET /articles`) i imaju prioritet u odgovorima agenta kad postoje za temu pitanja.
- [ ] Centar za pomoć (unutar M17, M7 i M8/M9) ostaje potpuno upotrebljiv na telefonu i tabletu — nasleđuje responsive zahtev kanala u kom se prikazuje (Master dokument poglavlje 5.1), bez sopstvenog dodatnog UI sloja. **M17 ekran implementiran** (`apps/panel/src/app/(app)/pomoc/`, avgust 2026) — M7/M8 ekrani i responsive provera na telefonu/tabletu ostaju otvorena stavka, ova stavka namerno ostaje nečekirana do tada.
- [x] Korporativni klijent (GUEST + LEGAL_ENTITY) dobija pristup isključivo kroz M8/M9 kanal, prijavljen na sopstveni nalog; provera `ClientAccount.account_type` radi se uživo nad M6, ne iz keširanog/token podatka.
- [x] `docs/api/M21-centar-za-pomoc.md` postoji i sadrži stvaran primer zahteva/odgovora za svaki endpoint iz poglavlja 6 — standing pravilo za sve module (CLAUDE.md).

---

## 8. Otvoreno za dalje

- ~~Tačna podela `EDIT`/`PUBLISH` dozvola za help sadržaj~~ — **rešeno avgust 2026 (potvrda vlasnika).** HR dobija `EDIT` za sve tri publike (staff/subagent/business), `PUBLISH` isključivo Direktor/Vlasnik — isti dvoslojni obrazac kao M12 `ContentPiece` (`CREATE_DRAFT` vs `APPROVE_PUBLISH`). Sprovedeno u `seed.ts` (`DEFAULT_ROLE_PERMISSIONS`) i proveravano u `HelpArticlesService` po audience segmentu.
- ~~Tačan prag/algoritam grupisanja pitanja za `HelpArticleSuggestion`~~ — **polazna vrednost postavljena avgust 2026**, i dalje otvorena za fino podešavanje: 3+ pitanja (`confidence IN {NONE,LOW}` ili `was_helpful=false`) u prozoru od 30 dana, grupisano po `audience_context` + (preklapanje `matched_article_ids` kad postoji, inače preklapanje ≥2 značajne reči teksta pitanja — `NONE` pitanja po definiciji nemaju `matched_article_ids`). Vidi `HelpSuggestionsService` — konstante `SUGGESTION_THRESHOLD`/`MIN_WORD_OVERLAP`/`GROUPING_WINDOW_DAYS`, isti "podešava se empirijski" princip kao M18 pragovi (§5.4).
- Prošireno na pojedinačne (INDIVIDUAL) krajnje goste (M8/M9) — namerno van obima, vidi poglavlje 1.
- Da li M8/M9 UI za korporativne klijente treba poseban vizuelni prikaz Centra za pomoć (npr. "Pomoć za poslovne naloge" sekcija) ili se prikazuje kao generički help widget — dorađuje se pri implementaciji M8/M9 poglavlja za korporativne naloge.
- Da li agent u budućoj verziji dobija ograničen, pažljivo ograđen pristup nekim živim podacima (npr. sopstveni kreditni limit subagenta) — zahteva sopstvenu bezbednosnu analizu pre uvođenja, ne pretpostavlja se ovde (poglavlje 5.2).
- `POST /help/questions/:id/escalate` određuje `TicketCategory` uvek kao `DRUGO` (nema strukturiranog `related_module`→`category` mapiranja u v1) — dorađuje se ako se pokaže vrednost u praksi (implementaciona napomena, `HelpAssistantService.escalate`).
- `GET /help/questions` (uvid u istoriju pitanja, `M21/question-log/VIEW`) dodat pri implementaciji — permission je postojao u poglavlju 3 bez pripadajuće rute u poglavlju 6 (koje je eksplicitno "ključni endpoint-i", ne iscrpna lista); ruta je dodata da dozvola ne ostane mrtvo slovo.
