# Specifikacija modula M18 — Operativni nadzor i AI optimizacija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 7 (model upravljanja AI agentima), poglavlje 10 (mesečni pregled trendova) i `18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodat kriterijum kritičnosti/bezbednosne osetljivosti za izbor modela (poglavlje 6.2a) — poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
**Zavisi od:** M1, M15 (koristi njegov `AIAgent`/`AgentActionType` okvir). Čita signale iz svih ostalih modula (read-only, isti princip kao M13).

---

## 1. Svrha i obim modula

M18 dodaje tri sposobnosti koje ne pripadaju nijednom postojećem modulu:

1. **Kvalitetni/nadzorni agent** — kontinuirano prati signale kvarova/nepravilnosti kroz sve module i **odmah** obaveštava vlasnika spoljnim kanalima (Telegram, email — potvrđeno), ne čekajući da neko otvori interni panel.
2. **Periodičan sveobuhvatan pregled** (potvrđeno: nedeljno, ne 10 dana — predvidljiviji ritam) koji šalje sažetak stanja sistema čak i kad nema problema (potvrda da nadzor radi).
3. **Agent za praćenje trendova** — proširuje već postojeći mesečni proces iz poglavlja 10 Master dokumenta (koji je do sad ručni) AI asistencijom, i širi mu obim sa "AI-agentski trendovi u turizmu" na opštije "šta unaprediti u radu/izgledu aplikacije".

Dodatno, M18 uvodi **okvir za izbor jezičkog modela po složenosti zadatka** — direktan odgovor na zahtev za optimizaciju potrošnje tokena.

---

## 2. Kvalitetni/nadzorni agent

### 2.1 `HealthSignal` — signal koji se prati
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| source_module | string | npr. `M4`, `M10`, `M11`, `M9`, `M1` |
| signal_type | enum: `PROVIDER_ERROR_SPIKE`, `PAYMENT_FAILURE_SPIKE`, `GUEST_REGISTRATION_FAILED`, `FIELD_INCIDENT_URGENT`, `AUTH_ANOMALY`, `TOKEN_USAGE_ANOMALY` | proširivo — novi tipovi se dodaju kad se pokaže potreba |
| severity | enum: `INFO`, `WARNING`, `CRITICAL` | |
| details | JSONB | |
| detected_at | timestamp | |
| notified_at | timestamp, nullable | |

**Izvori (već postojeći podaci, ne novi ulazi):** M4 `ProviderCallLog` (učestalost grešaka/timeout-a), M10 `Payment` (`FAILED`/`VOIDED` učestalost), M11 `GuestRegistration.status = FAILED`, M9 `FieldIncidentNote.severity = URGENT`, M1 `AuditLogEntry` (neuobičajen obrazac neuspelih prijava ili dodela dozvola), i novi `AgentInvocationLog` iz poglavlja 5 ovog dokumenta (neuobičajen skok potrošnje tokena — sam nadzorni sloj nadgleda i sopstvenu potrošnju).

**Razlika u odnosu na M17 kontrolnu tablu:** M17 (poglavlje 5 te specifikacije) je **pull** — vlasnik mora da otvori panel da vidi upozorenja. M18 je **push** — obaveštava aktivno, bez obzira da li je neko otvorio bilo šta. Isti izvori podataka, različit način isporuke.

### 2.2 Trenutna obaveštenja (bez čekanja na ciklus)
`CRITICAL` i `WARNING` signali se **odmah** šalju preko `NotificationChannel` (poglavlje 3) — ne čekaju nedeljni pregled iz poglavlja 4.

---

## 3. `NotificationChannel` — spoljni kanali dostave

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| channel_type | enum: `TELEGRAM`, `EMAIL` | potvrđeno za sada — proširivo (`VIBER`, `WHATSAPP`) kad se pokaže stvarna potreba; vidi napomenu niže |
| config_encrypted | string | za `TELEGRAM`: bot token + chat ID; za `EMAIL`: adresa primaoca — isti obrazac enkripcije kao `ProviderConfig` (M4) |
| recipient_role | string | npr. `VLASNIK`, `DIREKTOR` — kome ide |
| status | enum: `ACTIVE`, `INACTIVE` | |

**Napomena o Viber/WhatsApp:** oba zahtevaju odobrenje poslovnog naloga kod Meta/Viber (sporiji proces, ponekad trošak po poruci), za razliku od Telegram Bot API-ja (besplatan, par minuta za podizanje) — zato su namerno izostavljeni iz prve verzije. Dodaju se kao dodatne vrednosti `channel_type` bez izmene strukture kad se odluka donese.

**Buduća dopuna (M19):** kad `19-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` bude izgrađen, dodaje se `channel_type = IN_APP` — isporuka direktno u internu chat aplikaciju, pored Telegram/email.

---

## 4. Periodičan sveobuhvatan pregled — nedeljno (potvrđeno)

### 4.1 `WeeklyHealthReview`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| period_start / period_end | date | uvek ponedeljak–nedelja |
| summary | text | sažetak (generisan modelom "STANDARD" nivoa — poglavlje 6) |
| signals_included | JSONB | spisak `HealthSignal` zapisa iz perioda |
| status | enum: `GENERATED`, `SENT` | |
| generated_at / sent_at | timestamp | |

Posao se pokreće svakog ponedeljka, agregira `HealthSignal` iz prethodnih 7 dana, i **šalje se uvek** (čak i "sve je u redu ove nedelje") preko `NotificationChannel` — potvrda da nadzor aktivno radi, ne samo tiho čeka kvar.

---

## 5. Agent za praćenje trendova — proširenje poglavlja 10 Master dokumenta

Poglavlje 10 Master dokumenta već definiše mesečni pregled trendova (ručan proces). M18 ga **automatizuje uz AI asistenciju** i **širi obim**:

### 5.1 `TrendSuggestion`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| category | enum: `AGENTSKI_TURIZAM` (postojeći obim iz poglavlja 10), `PROIZVOD_UX`, `TEHNOLOGIJA` (novo — opštiji softverski/UX trendovi) | |
| summary | text | |
| suggested_action | text | šta konkretno predlaže da se uradi |
| status | enum: `DRAFT`, `APPROVED`, `REJECTED` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno pre bilo kakve stvarne izmene** — isti princip kao poglavlje 10 Master dokumenta ("ništa se ne menja automatski bez odobrenja") |
| created_at | timestamp | |

**Tok:** agent istražuje (isti tip rada koji je urađen ručno za Sabre analizu u ovoj konverzaciji — web pretraga, čitanje konkurentskih/tehnoloških izvora), priprema `TrendSuggestion` u `DRAFT` (nivo "Autonomno"). Vlasnik/Direktor odobrava ili odbija; tek odobreni nalazi ulaze u Dodatak A Master dokumenta (nivo "Predloži pa čovek odobri", u skladu sa već postojećim pravilom poglavlja 10).

**Dopuna poglavlja 10 Master dokumenta:** obim mesečnog pregleda se proširuje sa isključivo "agentska AI u turizmu" na i opštije proizvodne/UX/tehnološke trendove relevantne za izgled i funkcionalnost same aplikacije — ovo se unosi direktno u Master dokument (poglavlje 8 ovog dokumenta).

---

## 6. Model-tiering — izbor jezičkog modela po složenosti zadatka

### 6.1 Dopuna M15 `AIAgent`
Dodaju se polja: `model_tier` (enum: `LIGHT`, `STANDARD`, `HEAVY`), `model_identifier` (string, npr. konkretno ime modela — menja se nezavisno od `model_tier`, koji ostaje stabilna kategorija).

### 6.2 Preporučeno mapiranje (smernica, ne kruto pravilo)
| Nivo | Kad se koristi | Primeri iz postojećih specifikacija |
| :---- | :---- | :---- |
| **Bez modela (čist kod)** | Prag/datum/broj provera bez potrebe za jezičkim razumevanjem | M3 upozorenje o roku, M11 podsetnik o garanciji, M7 provera kreditnog limita, M11 rok boravišne takse |
| **LIGHT** | Kratka klasifikacija/sažimanje jednostavnog teksta | M13 uočavanje trenda (jednostavna agregacija + kratak opis) |
| **STANDARD** | Priprema nacrta teksta srednje složenosti | M6/M14 nacrt odgovora gostu, M10 popunjavanje nacrta fiskalnog dokumenta, M18 nedeljni sažetak |
| **HEAVY** | Kreativan/nijansiran sadržaj, sinteza velike količine spoljnih podataka | M12 generisanje marketinškog sadržaja, M18 istraživanje trendova, Glavni agent (orkestracija) |

**Najvažniji nalaz ovog poglavlja:** dobar deo onoga što je u ranijim specifikacijama opisano kao "AI agent, nivo Autonomno" (npr. M3 upozorenje, M11 podsetnik) **uopšte ne zahteva poziv jezičkom modelu** — to je obična provera datuma/broja u kodu. Pozivanje LLM-a za takve provere bilo bi čist trošak tokena bez ikakve koristi. Ovo se eksplicitno navodi u tabeli iznad da bi implementacija to poštovala od starta, ne tek kad račun za tokene postane primetan.

### 6.2a Dopunski kriterijum — kritičnost/bezbednosna osetljivost akcije, ne samo tekstualna složenost

Tabela iz 6.2 bira nivo modela isključivo po tome koliko je *tekstualni* zadatak zahtevan (kratka klasifikacija naspram kreativne sinteze). Ovo nije jedini relevantan kriterijum: neka akcija može biti tekstualno jednostavna, a ipak nositi **asimetričnu cenu greške** (npr. propuštena bezbednosna anomalija, pogrešno prepoznata prevara) koja opravdava jači/skuplji model bez obzira na složenost samog teksta. Potvrđeno poređenjem sa PrimeTravel `orchestratorV2Config.ts` ("Model Matrix") — njihov bezbednosni agent ("sentinel") koristi jači model (Claude 3.5 Sonnet) dok većina agenata koristi lakši model, nezavisno od dužine/složenosti pojedinačnog zadatka (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 10).

**Pravilo:** za akciju koja dotiče bezbednost (npr. buduća AI klasifikacija `HealthSignal.signal_type = AUTH_ANOMALY`, poglavlje 2.1 — ako se ikad automatizuje AI analizom umesto pravila zasnovanih na obrascu), PII, ili sprečavanje prevare, koristi se **najmanje `STANDARD`, po difoltu `HEAVY`** — bez obzira gde bi po tekstualnoj složenosti sama akcija spadala u tabeli 6.2. Ovo je nezavisan, dodatni kriterijum uz onaj iz 6.2 — kad se rezultati dva kriterijuma razlikuju, primenjuje se **jači (skuplji) od ta dva**, nikad slabiji.

### 6.3 `AgentInvocationLog` — vidljivost potrošnje
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| agent_id | UUID (FK → M15 AIAgent) | |
| action_code | string (FK → M15 AgentActionType) | |
| model_tier / model_identifier | enum / string | |
| input_tokens / output_tokens | integer | |
| estimated_cost | decimal | |
| latency_ms | integer | |
| timestamp | timestamp | |

Ovaj log je i sam izvor za `HealthSignal` tipa `TOKEN_USAGE_ANOMALY` (poglavlje 2.1) — neuobičajen skok potrošnje (npr. agent zapeo u petlji) se prijavljuje kao i svaki drugi kvar.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M18/health-signal/VIEW` | Vlasnik, Direktor |
| `M18/notification-channel/VIEW`, `EDIT` | Vlasnik, Direktor |
| `M18/weekly-review/VIEW` | Vlasnik, Direktor |
| `M18/trend-suggestion/VIEW`, `APPROVE` | Vlasnik, Direktor |
| `M18/agent-invocation-log/VIEW` | Vlasnik, Direktor |

---

## 8. Dopuna Master dokumenta (poglavlje 10)

U `00-MASTER-ARHITEKTURA.md`, poglavlje 10 ("Praćenje industrijskih trendova"), tačka "Obim provere" proširuje se sa isključivo agentskom AI u turizmu na i opštije proizvodne/UX/tehnološke trendove relevantne za samu aplikaciju — primenjeno direktno u tom dokumentu.

---

## 9. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/ops`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/health-signals` | GET | filtrirano po modulu/tipu/ozbiljnosti |
| `/notification-channels` | GET / POST / PATCH | |
| `/weekly-reviews` | GET | |
| `/weekly-reviews/run` | POST | ručno pokretanje van rasporeda |
| `/trend-suggestions` | GET / POST | |
| `/trend-suggestions/:id/approve`, `/reject` | POST | |
| `/agent-invocations` | GET | log potrošnje, filtriran po agentu/periodu |

---

## 10. Izlazni kriterijum

- [ ] `CRITICAL`/`WARNING` `HealthSignal` odmah generiše Telegram i email obaveštenje, bez čekanja na nedeljni ciklus.
- [ ] `WeeklyHealthReview` se generiše i šalje svakog ponedeljka, čak i bez ijednog signala u periodu.
- [ ] `TrendSuggestion` se ne unosi u Dodatak A Master dokumenta bez `approved_by` popunjenog.
- [ ] Nijedna čisto deterministička provera (rok, limit, datum) ne troši pozive jezičkom modelu — proverljivo kroz `AgentInvocationLog` (nema zapisa za te akcije).
- [ ] Neuobičajen skok potrošnje tokena generiše sopstveni `HealthSignal`.
- [ ] Akcija koja dotiče bezbednost/PII/prevaru koristi bar `STANDARD`, podrazumevano `HEAVY` nivo modela, bez obzira na tekstualnu složenost zadatka (poglavlje 6.2a) — proverljivo kroz `AgentInvocationLog.model_tier` za takve `action_code` zapise.

---

## 11. Otvoreno za dalje

- Dodavanje `VIBER`/`WHATSAPP` kanala — kad se odluka donese, isti obrazac kao `TELEGRAM`/`EMAIL`.
- Tačan prag za "neuobičajen skok" po tipu signala (koliko grešaka u kom periodu je "previše") — podešava se empirijski kad sistem počne da radi u produkciji, ne unapred nagađa.
- Veza sa M19 (`IN_APP` kanal) — dodaje se kad taj modul bude izgrađen.
