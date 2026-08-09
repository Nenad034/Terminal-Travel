# Specifikacija modula M21 — Centar za pomoć (baza znanja + AI asistent)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M21), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (poprečan modul, ne vezan za jednu fazu — isti slučaj kao M17/M18/M19)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodata stavka izlaznog kriterijuma za responsive prikaz (Master dokument poglavlje 5.1)
**Zavisi od:** M1 (identitet, RBAC, audit log), M14 (eskalacija ka tiketu), M15 (AI agent okvir), M17 (kanal za tim), M7 (kanal za subagente)

---

## 1. Svrha i obim modula

M21 je baza znanja za korišćenje same Terminal platforme — uputstvo za rad, ne uputstvo za putovanje. Dve odvojene publike, oštro razdvojene:

1. **Interni tim** — kako se koristi interni panel (M17) i svaki modul u njemu, kako se rade konkretni radni postupci (npr. "kako obraditi otkazivanje sa delimičnim povraćajem").
2. **B2B subagenti** — kako se koristi portal (M7), kako se poručuje u ime gosta, kako se prati provizija i kreditni limit.

**Razlika u odnosu na M14 (Helpdesk):** M14 rešava problem koji je već nastao ("nešto ne radi", "imam pritužbu"). M21 sprečava da problem uopšte nastane — odgovara na "kako da..." pre nego što korisnik zapne. Kad M21 ne zna odgovor, prosleđuje ka M14 (poglavlje 5) — jedan tok, dva različita trenutka.

**Razlika u odnosu na M12 (Marketing/Content Engine):** M12 proizvodi sadržaj za goste na javnim kanalima radi prodaje. M21 proizvodi sadržaj za tim/subagente radi rada sa alatom — interna publika, interna svrha, potpuno odvojen sadržajni tok.

**Namerno van obima v1:** sadržaj za krajnje goste (M8/M9). Gost tipično ne treba uputstvo za korišćenje internog alata — ako se pokaže potreba za AI-asistiranim FAQ na sajtu, to je prirodno proširenje M21 na treću publiku, ne novi modul, ali se ne pretpostavlja unapred.

---

## 2. Model podataka

### 2.1 `HelpArticle` — jedan članak baze znanja
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| slug | string, unique | |
| audience | enum: `STAFF`, `SUBAGENT`, `BOTH` | određuje ko sme da vidi — vidi poglavlje 3 (RBAC) |
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
| asked_by | UUID (FK → M1 User) | i tim i subagenti su M1 nalozi (`account_type = STAFF` ili `SUBAGENT_CONTACT`) |
| audience_context | enum: `STAFF`, `SUBAGENT` | određuje iz kog seta članaka agent sme da povuče odgovor — izvedeno iz `asked_by.account_type`, ne unosi ga korisnik |
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
| `M21/article:staff/EDIT`, `M21/article:staff/PUBLISH` | HR, Direktor, Vlasnik (tačna podela dorađuje se pri implementaciji — vidi poglavlje 8) |
| `M21/article:subagent/EDIT`, `M21/article:subagent/PUBLISH` | Isti krug kao gore — subagenti nikad ne uređuju sopstveni help sadržaj, samo ga čitaju |
| `M21/suggestion/APPROVE` | HR, Direktor, Vlasnik |
| `M21/question-log/VIEW` | HR, Direktor, Vlasnik — uvid u istoriju pitanja radi kvaliteta sadržaja i bezbednosnog pregleda |

Član sa `audience = BOTH` vidljiv je oboma bez dodatne dozvole. Provera se radi identično kao svuda u sistemu — uživo nad bazom, ne iz tokena (M1 poglavlje 3.6).

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
| `/ask` | POST | glavno pitanje ka AI agentu — `{question, }` (publika se izvodi iz naloga koji pita); vraća `{answer, matched_article_ids, confidence}` |
| `/questions/:id/feedback` | POST | 👍/👎 — upisuje `was_helpful` |
| `/questions/:id/escalate` | POST | korisnikova potvrda eskalacije → kreira M14 `Ticket`, upisuje `escalated_ticket_id` |
| `/suggestions` | GET | predlozi na čekanju (vidljivo kroz M15 Agent Inbox, poglavlje 6 te specifikacije) |
| `/suggestions/:id` | PATCH | odobri (→ kreira `HelpArticle`) ili odbij |

---

## 7. Izlazni kriterijum

- [ ] Interni tim vidi članke sa `audience ∈ {STAFF, BOTH}`; subagent vidi isključivo `audience ∈ {SUBAGENT, BOTH}` — provereno da nijedna strana ne vidi članke namenjene isključivo drugoj.
- [ ] AI agent odgovara isključivo na osnovu `PUBLISHED` članaka dostupnih toj publici; test-pokušaj da se agent nagovori da otkrije sadržaj van tog opsega (parafraziran zahtev za "tuđe" članke ili podatke) se odbija.
- [ ] Pitanje bez pouzdanog odgovora (`confidence = NONE`) nudi eskalaciju; potvrda korisnika kreira M14 tiket sa `channel = HELP_CENTER` i pitanjem već upisanim u prvu poruku.
- [ ] Ponovljena `NONE`/`LOW` pitanja na istu temu generišu `HelpArticleSuggestion`; predlog se ne pretvara u vidljiv članak bez ljudskog odobrenja, a odobren predlog i dalje čeka zaseban korak objavljivanja.
- [ ] Svako pitanje/odgovor upisano je u `AuditLogEntry` sa `actor_type = AI_AGENT`.
- [ ] Neuobičajen obrazac pitanja (učestalost ili sadržaj koji liči na pokušaj zaobilaženja ograde) generiše `HELP_AGENT_ABUSE_PATTERN` signal u M18.
- [ ] Fallback jezika radi ispravno (traženi jezik → engleski → srpski), isto pravilo kao M2.
- [ ] `is_critical_example` članci prikazuju se izdvojeno i imaju prioritet u odgovorima agenta kad postoje za temu pitanja.
- [ ] Centar za pomoć (unutar M17 i M7) ostaje potpuno upotrebljiv na telefonu i tabletu — nasleđuje responsive zahtev kanala u kom se prikazuje (Master dokument poglavlje 5.1), bez sopstvenog dodatnog UI sloja.

---

## 8. Otvoreno za dalje

- Tačna podela `EDIT`/`PUBLISH` dozvola za help sadržaj (da li HR ima puno pravo objave ili samo predlaže, sa Direktorom kao konačnim odobravačem) — dorađuje se sa vlasnikom pri implementaciji, van obima ove specifikacije.
- Tačan prag/algoritam grupisanja pitanja za `HelpArticleSuggestion` (poglavlje 5.4) — konkretna vrednost (npr. "3+ slična pitanja u 30 dana") određuje se kad postoji stvarna količina pitanja da se proceni razumno.
- Prošireno na treću publiku (krajnji gosti, M8/M9) — namerno van obima v1, vidi poglavlje 1.
- Da li agent u budućoj verziji dobija ograničen, pažljivo ograđen pristup nekim živim podacima (npr. sopstveni kreditni limit subagenta) — zahteva sopstvenu bezbednosnu analizu pre uvođenja, ne pretpostavlja se ovde (poglavlje 5.2).
