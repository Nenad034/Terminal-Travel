# Specifikacija modula M18 — Operativni nadzor i AI optimizacija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 7 (model upravljanja AI agentima), poglavlje 10 (mesečni pregled trendova) i `18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026) — vidi poglavlje 10 (izlazni kriterijum) i `docs/api/M18-operativni-nadzor.md`
**Verzija:** 1.10 — dopuna poglavlja 6.2 (18.8.2026, na zahtev vlasnika, povodom pitanja o optimizaciji troška tokena): "Bez modela" primeri prošireni sa 3 na 11 stavki — puna provera svake `AUTONOMOUS` akcije iz M15 registra protiv teksta njene izvorne specifikacije je pokazala da još sedam (plus već ranije eksplicitno označen M20 `client_contract.generate_draft`) opisuju čisto deterministički rad (prag/aritmetika/mapiranje podataka u šablon), ne jezičku generaciju — vidi tabelu u poglavlju 6.2 za puni spisak i izvor svake tvrdnje. v1.9 — M21 (Centar za pomoć) implementiran avgust 2026: `HELP_AGENT_ABUSE_PATTERN` (izvor M21) sada ima stvaran funkcionalan detektor (`HelpAbuseDetectorService`, M21 poglavlje 5.5) umesto praznog enum reda — vidi poglavlje 11. v1.8 — prvi prolaz implementacije (avgust 2026): kod pod `apps/api/src/modules/m18-operativni-nadzor/`. Otkrivena i ispravljena stale referenca iz ranijih verzija — poglavlje 2.1 pominje izvor "M11 `GuestRegistration.status = FAILED`", ali taj model nikad nije postojao; stvaran M11 model (isti koncept — evidencija prijave garancije putovanja po rezervaciji) je `TravelGuaranteeRegistration`, sa `status = FAILED` kao jednom od vrednosti `TravelGuaranteeRegistrationStatus` — ispravljeno u ovoj i narednim pominjanjima. `PROVIDER_ERROR_SPIKE` (agregatni, §2.1) i per-provajder `PROVIDER_DEGRADED` (§2.3) implementirani kao dva odvojena detektora, tačno kako spec §2.3 napomena predviđa. `LOW_CAPACITY_CRITICAL` (M3) i `PAYMENT_DEADLINE_MISSED` (M10) implementirani kao Event Bus pretplata na signale koje ta dva modula već emituju (otkriveno pri implementaciji da oba modula od ranije imaju tačno ovaj event spreman, sa komentarom da čeka M18) — M18 ih ne preračunava. `NotificationChannel.channel_type = IN_APP` ostaje u enumu bez sopstvene funkcionalne isporuke kroz taj kanal-red (M19 je od tada implementiran, ali isporuka ide odvojenim putem — vidi poglavlje 11). Poglavlje 5 (trend agent) implementiran kao CRUD/odobrenje scaffolding (`TrendSuggestion`) BEZ autonomnog research-agenta — web-search API nije u tehničkom steku (`00-MASTER-ARHITEKTURA.md` poglavlje 6), uvođenje nove zavisnosti zahteva potvrdu vlasnika pre implementacije (CLAUDE.md); `approve()` menja isključivo `status`/`approved_by` u bazi, ne piše u Master dokument (ostaje ljudski uređivački korak). Poglavlje 4 (nedeljni pregled) generiše **deterministički** sažetak (agregacija po tipu/ozbiljnosti), namerno bez poziva jezičkom modelu u ovom prolazu — ne samo zbog troška, već zato što `00-MASTER-ARHITEKTURA.md` poglavlje 7, princip #4 ("AI agenti se uvode postepeno, tek kad je modul stabilan u produkciji") isključuje da M18, tek implementiran, dobije sopstvenog AI agenta pre nego što taj prag prođe. Jedino stvarno mesto u kodu koje poziva jezički model (M15 `OmnisearchService`) sada beleži `AgentInvocationLog` preko `AgentInvocationLogService` — jedina integraciona tačka modela-tieringa u ovom prolazu (nema drugog HEAVY/STANDARD poziva u kodu da bi se dinamičko biranje modela stvarno demonstriralo; `ModelTierResolverService` logika je zato dokazana jediničnim testovima direktno, §6.2a/§6.5 pravila). `TELEGRAM` kanal je stvarno ožičen (native `fetch`, bez nove zavisnosti, `TelegramClientService`) — `EMAIL` ostaje mock (isti status kao M12 `EmailMockAdapter`), pravo SMTP slanje zahteva biblioteku van tehničkog steka, čeka odluku vlasnika (poglavlje 11). Ni `quota_limit` ni `budget_limit_eur`/`AIAgentBudget` redovi nisu unapred popunjeni — konfigurišu se preko `POST`/`PATCH /ops/ai-provider-quota`, `/ops/ai-agent-budgets` (poglavlje 11, "ne pretpostavlja se u specifikaciji"). v1.7 — novo poglavlje 6.5: tvrdo ograničenje potrošnje AI u EUR (`AIProviderQuota.budget_limit_eur`/`consumed_eur`/`enforcement_state`, nova `AIAgentBudget` po pojedinačnom agentu) — kad se budžet dostigne, pozivi se prisilno degradiraju na `model_tier = LIGHT` umesto da se samo pošalje alarm kao ranije (poglavlje 6.4 ostaje čist alarm, ovo je dopuna, ne zamena); bezbednosno kritične akcije (6.2a) izuzete od degradacije; avgust 2026, na zahtev vlasnika; v1.6 — audit cross-referenci (avgust 2026): `NotificationChannel.channel_type` zvanično dobija `IN_APP` (M19 poglavlje 3 već je na ovo računao otkad je M19 specificiran, ali ovaj dokument ga do sada nije zvanično dodao u sopstveni enum, samo je opisivao kao "buduću dopunu" sa pogrešnim imenom fajla) — poglavlje 3, izlazni kriterijum i "Otvoreno za dalje" usklađeni; v1.5 dodat `PAYMENT_DEADLINE_MISSED` signal (M10 poglavlje 5.4.3, probijen rok akontacije/balansa prema gostu/nalogodavcu, avgust 2026); v1.4 dodat `HELP_AGENT_ABUSE_PATTERN` signal (M21 poglavlje 5.5, neuobičajen obrazac pitanja ka AI asistentu centra za pomoć); v1.3 dodat `LOW_CAPACITY_CRITICAL` signal (M3 poglavlje 4.3, alarm za nizak preostali kapacitet); v1.2 dodala per-provajder infrastrukturne metrike (poglavlje 2.3), bezbednosnu kategorizaciju signala (poglavlje 2.4), potrošnju po AI provajderu (poglavlje 6.4) — sve poređenjem sa PrimeTravel analizom (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`)
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
| signal_type | enum: `PROVIDER_ERROR_SPIKE`, `PAYMENT_FAILURE_SPIKE`, `GUEST_REGISTRATION_FAILED`, `FIELD_INCIDENT_URGENT`, `AUTH_ANOMALY`, `TOKEN_USAGE_ANOMALY`, `RECONCILIATION_MISMATCH`, `PROVIDER_DEGRADED`, `LOW_CAPACITY_CRITICAL`, `HELP_AGENT_ABUSE_PATTERN`, `PAYMENT_DEADLINE_MISSED` | proširivo — novi tipovi se dodaju kad se pokaže potreba. `RECONCILIATION_MISMATCH` dodat u M10 poglavlje 5.3 (Booking/Payment/FiscalDocument neusklađenost); `PROVIDER_DEGRADED` dodat u poglavlje 2.3 (per-provajder infra metrike); `LOW_CAPACITY_CRITICAL` dodat u M3 poglavlje 4.3 (preostali kapacitet perioda na 1–2 jedinice); `HELP_AGENT_ABUSE_PATTERN` dodat u M21 poglavlje 5.5 (neuobičajen obrazac pitanja ka AI asistentu centra za pomoć — moguć pokušaj zaobilaženja ograde); `PAYMENT_DEADLINE_MISSED` dodat u M10 poglavlje 5.4.3 (probijen rok akontacije/balansa prema gostu/nalogodavcu — počinje kao `WARNING`, eskalira na `CRITICAL` ako ostane nerešen) |
| severity | enum: `INFO`, `WARNING`, `CRITICAL` | |
| security_category | enum: `AUTH`, `PII`, `GDPR`, `API_ABUSE`, `ENCRYPTION`, nullable | popunjava se samo za bezbednosno relevantne signale — vidi poglavlje 2.4 |
| details | JSONB | |
| detected_at | timestamp | |
| notified_at | timestamp, nullable | |

**Izvori (već postojeći podaci, ne novi ulazi):** M4 `ProviderCallLog` (učestalost grešaka/timeout-a), M10 `Payment` (`FAILED`/`VOIDED` učestalost), M11 `TravelGuaranteeRegistration.status = FAILED` *(spec je ovo ranije zvala "GuestRegistration" — taj model nikad nije postojao, ispravljeno pri implementaciji avgust 2026, vidi promenu verzije)*, M9 `FieldIncidentNote.severity = URGENT`, M1 `AuditLogEntry` (neuobičajen obrazac neuspelih prijava ili dodela dozvola), M3 `ContractPeriod` (preostali kapacitet na 1–2 jedinice, poglavlje 4.3 te specifikacije), M21 `HelpQuestion` (neuobičajen obrazac pitanja ka AI asistentu centra za pomoć, poglavlje 5.5 te specifikacije), i novi `AgentInvocationLog` iz poglavlja 5 ovog dokumenta (neuobičajen skok potrošnje tokena — sam nadzorni sloj nadgleda i sopstvenu potrošnju).

**Razlika u odnosu na M17 kontrolnu tablu:** M17 (poglavlje 5 te specifikacije) je **pull** — vlasnik mora da otvori panel da vidi upozorenja. M18 je **push** — obaveštava aktivno, bez obzira da li je neko otvorio bilo šta. Isti izvori podataka, različit način isporuke.

### 2.2 Trenutna obaveštenja (bez čekanja na ciklus)
`CRITICAL` i `WARNING` signali se **odmah** šalju preko `NotificationChannel` (poglavlje 3) — ne čekaju nedeljni pregled iz poglavlja 4.

### 2.3 Per-provajder infrastrukturne metrike

Pored agregatnog praćenja grešaka (poglavlje 2.1, izvor M4 `ProviderCallLog`), M18 periodičnim poslom računa i čuva metriku **po pojedinačnom provajderu** — latencija, dostupnost, broj grešaka u poslednjem satu:

`ProviderHealthSnapshot`:
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_code | string (isti kao M4 `ProviderConfig.provider_code`) | |
| latency_ms_avg | integer | prosečna latencija u poslednjem prozoru (npr. 15 min) |
| uptime_percentage | decimal | procenat uspešnih poziva u prozoru |
| error_count_last_hour | integer | |
| status | enum: `ONLINE`, `UNSTABLE`, `OFFLINE` | izvedeno iz `uptime_percentage`/`error_count_last_hour` naspram konfigurabilnog praga |
| computed_at | timestamp | |

Prelazak u `UNSTABLE`/`OFFLINE` generiše `HealthSignal` tipa `PROVIDER_DEGRADED` (poglavlje 2.1) — ovo je precizniji, per-provajder pandan postojećem `PROVIDER_ERROR_SPIKE`, koji ostaje agregatni okidač. Potvrđeno poređenjem sa PrimeTravel `SystemPulse.tsx` obrascem (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 10).

### 2.4 Bezbednosna kategorizacija signala

`HealthSignal.security_category` (poglavlje 2.1) popunjava se samo za bezbednosno relevantne signale — trenutno `AUTH_ANOMALY`, sa prostorom za buduće, finije tipove (npr. neuobičajen masovni izvoz ličnih podataka) — radi preciznijeg filtriranja i izveštavanja, po uzoru na PrimeTravel `Fortress.tsx` obrazac kategorizacije (#PII #GDPR #security #audit #encryption — vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 10). Signal sa popunjenim `security_category` po difoltu koristi bar `STANDARD`, podrazumevano `HEAVY` nivo modela za bilo kakvu AI klasifikaciju/analizu — kriterijum kritičnosti iz poglavlja 6.2a ovde direktno važi.

---

## 3. `NotificationChannel` — spoljni kanali dostave

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| channel_type | enum: `TELEGRAM`, `EMAIL`, `IN_APP` | `IN_APP` dodato pri specifikaciji M19 (poglavlje 3 te specifikacije) — isporuka direktno u internu chat aplikaciju, `CRITICAL`/`WARNING` signali (poglavlje 2.2) stižu i ovim putem, pored Telegram/email; proširivo i dalje (`VIBER`, `WHATSAPP`) kad se pokaže stvarna potreba, vidi napomenu niže |
| config_encrypted | string | za `TELEGRAM`: bot token + chat ID; za `EMAIL`: adresa primaoca; za `IN_APP`: nema potrebe za kredencijalom, isporuka ide preko internog M19 API-ja — isti obrazac enkripcije kao `ProviderConfig` (M4) za spoljne kanale |
| recipient_role | string | npr. `VLASNIK`, `DIREKTOR` — kome ide |
| status | enum: `ACTIVE`, `INACTIVE` | |

**Napomena o Viber/WhatsApp:** oba zahtevaju odobrenje poslovnog naloga kod Meta/Viber (sporiji proces, ponekad trošak po poruci), za razliku od Telegram Bot API-ja (besplatan, par minuta za podizanje) — zato su namerno izostavljeni iz prve verzije. Dodaju se kao dodatne vrednosti `channel_type` bez izmene strukture kad se odluka donese.

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
| **Bez modela (čist kod)** | Prag/datum/broj provera bez potrebe za jezičkim razumevanjem | M3 upozorenje o roku, M11 podsetnik o garanciji, M7 provera kreditnog limita |
| **LIGHT** | Kratka klasifikacija/sažimanje jednostavnog teksta | M13 uočavanje trenda (jednostavna agregacija + kratak opis) |
| **STANDARD** | Priprema nacrta teksta srednje složenosti | M6/M14 nacrt odgovora gostu, M10 popunjavanje nacrta fiskalnog dokumenta, M18 nedeljni sažetak |
| **HEAVY** | Kreativan/nijansiran sadržaj, sinteza velike količine spoljnih podataka | M12 generisanje marketinškog sadržaja, M18 istraživanje trendova, Glavni agent (orkestracija) |

**Najvažniji nalaz ovog poglavlja:** dobar deo onoga što je u ranijim specifikacijama opisano kao "AI agent, nivo Autonomno" (npr. M3 upozorenje, M11 podsetnik) **uopšte ne zahteva poziv jezičkom modelu** — to je obična provera datuma/broja u kodu. Pozivanje LLM-a za takve provere bilo bi čist trošak tokena bez ikakve koristi. Ovo se eksplicitno navodi u tabeli iznad da bi implementacija to poštovala od starta, ne tek kad račun za tokene postane primetan.

**Prošireno "Bez modela" — puna provera celog M15 registra (dopuna 18.8.2026, na zahtev vlasnika; dopunjeno 19.8.2026 sa M7 `subagent_chat.quote_draft`, drugi prolaz istog audita).** Iznad navedena tri primera nisu bila iscrpna lista — pri ponovnom pregledu **svake** `AUTONOMOUS` stavke iz M15 registra (poglavlje 4 tog dokumenta) protiv teksta njene izvorne specifikacije, još osam akcija je već opisano kao deterministička obrada, ne slobodna jezička generacija — samo to do sada nije bilo eksplicitno skupljeno na jedno mesto radi implementacije:

| Modul | Akcija | Zašto ne treba model | Izvor (već tako opisano) |
| :---- | :---- | :---- | :---- |
| M3 | `contract_period.low_capacity_alert` | Prag preostalih jedinica (1–2) — čista brojčana provera | M3 poglavlje 4.3 |
| M5 | `supplier_manifest.draft` | Operativna lista je popunjavanje fiksnog šablona (SR/EN) podacima iz `BookingItem`-a, ne slobodan tekst — dokument sadrži samo strukturirane redove, ne prozu | M5 poglavlje 8.1/8.3/8.4 |
| M7 | `commission_rebate.calculate_draft` | Naziv sam kaže — "sistem **obračunava** jednokratan rabat" iz procenta/praga, aritmetika, ne jezik | M7 poglavlje 3.2 |
| M10 | `fiscal_document.draft` | Nacrt "popunjava iznose, PDV, konverziju valute, tip dokumenta" iz već poznatih polja rezervacije — mapiranje podataka u fiksan pravni format, ne kreativan tekst | M10 poglavlje 6 |
| M11 | `travel_guarantee.utilization_warning` | Prag 80% iskorišćenosti — ista vrsta provere kao već navedeni M11 podsetnik | M11 poglavlje 4.2 |
| M14 | `complaint.escalate_notify` | Eskalacija po isteku zakonskog roka (ZZP) — provera datuma, isti obrazac kao M3 upozorenje o roku | M14 poglavlje 3.1 |
| M18 | `health_signal.detect_and_notify` | Detekcija je prag/anomalija nad brojevima (uptime, broj grešaka, potrošnja) — sopstveni detektori ovog modula (`HealthDetectorsService` i sl.) rade bez ijednog poziva modelu, po konstrukciji | poglavlje 2 ovog dokumenta |
| M7 | `subagent_chat.quote_draft` | Formula `cena_za_subagenta = cena_posle_marže_iz_M5 * (1 - effective_commission_percentage / 100)` — ista aritmetika kao `commission_rebate.calculate_draft` iz istog modula, pozvana kroz isti M5 tok kao portal forma; jezički deo tog istog razgovora (razumevanje šta subagent traži) je odvojena akcija `subagent_chat.search`, koja model stvarno zahteva — `quote_draft` sam po sebi ne dodiruje LLM klijent, iako živi unutar razgovornog toka | M7 poglavlje 2.0.4c, korak 1, i poglavlje 5 |

**Napomena o `M20 client_contract.generate_draft`:** M15 registar (poglavlje 4) ovu akciju već izričito označava "iz determinističkih pravila" — svrstana je u `AUTONOMOUS`, ali iz istog razloga kao gornjih sedam, ne zato što bi tolerisala grešku jezičkog modela.

**Praktična posledica za implementaciju:** za svih 9 akcija iznad (plus tri ranije navedena primera), kod agenta ne sme ni da instancira poziv ka jezičkom modelu — ne "pozovi pa preskoči ako je jednostavno", nego grana koja LLM klijent uopšte ne dodiruje, isti princip kao već dokazano za `HealthDetectorsService`/`ProviderHealthService`/`M18EventSubscribersService` (poglavlje 10, izlazni kriterijum, red "Nijedna čisto deterministička provera..."). Preostale `AUTONOMOUS` akcije u registru (M6 nacrt poruke, M12 marketing sadržaj, M14 nacrt tiketa, M13 trend, M18 istraživanje trenda, M21/M23 odgovori i nacrti) **stvarno zahtevaju** jezičko razumevanje/generisanje teksta — tu ušteda dolazi isključivo iz izbora najslabijeg dovoljnog nivoa (poglavlje 6.2), ne iz uklanjanja modela.

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

### 6.4 Potrošnja po AI provajderu (ne samo po agentu)

Pored `AgentInvocationLog` (poglavlje 6.3, praćenje po agentu), M18 agregira potrošnju i **po AI provajderu** (Anthropic/OpenAI/Google, izvedeno iz `model_identifier`) naspram globalnog kvota-limita tog provajdera — drugačiji način otkaza od pojedinačnog agenta koji troši previše (npr. ceo nalog kod provajdera dostiže mesečni limit, bez obzira koji pojedinačni agent je najviše trošio). Potvrđeno poređenjem sa PrimeTravel `AIQuotaDashboard.tsx` obrascem, uključujući isti izbor kanala obaveštenja — Telegram i email (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` poglavlje 10).

`AIProviderQuota`:
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_name | string | npr. `ANTHROPIC`, `OPENAI`, `GOOGLE` |
| period | enum: `DAILY`, `WEEKLY`, `MONTHLY` | |
| quota_limit | integer | limit provajdera za taj period (tokeni ili trošak, po ugovoru sa provajderom) |
| consumed | integer | agregirano iz `AgentInvocationLog` za sve agente čiji `model_identifier` pripada ovom provajderu |
| period_start / period_end | date | |
| alert_threshold_percentage | integer | podrazumevano 80 |

Kad `consumed` dostigne `alert_threshold_percentage` od `quota_limit`, generiše se `HealthSignal` tipa `TOKEN_USAGE_ANOMALY` (poglavlje 2.1) — isti mehanizam kao postojeća anomalija potrošnje, samo na nivou provajdera umesto pojedinačnog agenta.

**Napomena:** ovo poglavlje (do v1.6) je bilo isključivo alarm — `consumed` može preći `quota_limit` bez ikakve stvarne posledice na pozive, samo se šalje obaveštenje. Poglavlje 6.5 dodaje tvrdu granicu koja ovo ne zamenjuje, nego dopunjuje.

### 6.5 Tvrdo ograničenje potrošnje u EUR (budžet, ne samo alarm)

*(dodato v1.7, avgust 2026, na eksplicitan zahtev vlasnika)*

Za razliku od `quota_limit` (poglavlje 6.4, koji može biti u tokenima ili trošku, zavisno od ugovora sa provajderom, i samo upozorava), ovo poglavlje uvodi **stvaran, u EUR izražen budžet sa automatskom posledicom** kad se dostigne, na dva nivoa istovremeno — globalno po AI provajderu i pojedinačno po agentu, jer se pokazalo da samo globalni nivo ne štiti od jednog agenta zaglavljenog u petlji (poglavlje 6.3).

**Dopuna `AIProviderQuota` (poglavlje 6.4):**
| Novo polje | Tip | Napomena |
| :---- | :---- | :---- |
| budget_limit_eur | decimal, nullable | tvrd budžet za taj period, u EUR — odvojen od `quota_limit` (koji ostaje čisto informativan/ugovorni prag) |
| consumed_eur | decimal | agregirano iz `AgentInvocationLog.estimated_cost` (poglavlje 6.3 — pojašnjeno ovom dopunom da je taj iznos uvek u EUR, ne u tokenima ni valuti provajdera) |
| enforcement_state | enum: `NORMAL`, `DEGRADED` | `DEGRADED` kad `consumed_eur >= budget_limit_eur`; automatski se vraća na `NORMAL` na `period_start` narednog perioda |
| degraded_at | timestamp, nullable | |

**Nova `AIAgentBudget`** — isti mehanizam, na nivou pojedinačnog agenta (M15 `AIAgent`), ne samo provajdera:
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| agent_id | UUID (FK → M15 AIAgent) | |
| period | enum: `DAILY`, `WEEKLY`, `MONTHLY` | |
| budget_limit_eur | decimal | |
| consumed_eur | decimal | agregirano iz `AgentInvocationLog` filtriranog po `agent_id` |
| enforcement_state | enum: `NORMAL`, `DEGRADED` | |
| period_start / period_end | date | |

**Šta znači `DEGRADED`:** dok je provajder ili konkretan agent u tom stanju, svaki naredni poziv tog provajdera/agenta se **prisilno izvršava na `model_tier = LIGHT`** (poglavlje 6.1), bez obzira na nivo koji bi tabela 6.2 inače izabrala — AI asistencija ostaje dostupna, ne gasi se, samo je jeftinija/prostija dok se budžet ne resetuje ili Vlasnik/Direktor ručno ne vrati `enforcement_state` na `NORMAL` (nova dozvola `M18/ai-provider-quota/OVERRIDE`, poglavlje 7).

**Izuzetak — bezbednosno kritične akcije se ne degradiraju.** Akcije koje po pravilu 6.2a zahtevaju bar `STANDARD`, podrazumevano `HEAVY` (bezbednost, PII, prevara) **zadržavaju taj zahtevani nivo i u `DEGRADED` stanju** — isti princip kao poglavlje 6.2a ("kad se rezultati dva kriterijuma razlikuju, primenjuje se jači od ta dva"), sad proširen i na budžetsko ograničenje: cena propuštene bezbednosne anomalije je veća od cene prekoračenja budžeta. Svaki poziv koji na ovaj način probije `DEGRADED` stanje generiše `HealthSignal` tipa `TOKEN_USAGE_ANOMALY` sa povišenim prioritetom (odvojivim od običnog 80%-upozorenja iz poglavlja 6.4) — Vlasnik mora znati da bezbednosni tok i dalje troši iznad budžeta, ne sme to ostati neprimećeno.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M18/health-signal/VIEW` | Vlasnik, Direktor |
| `M18/notification-channel/VIEW`, `EDIT` | Vlasnik, Direktor |
| `M18/weekly-review/VIEW` | Vlasnik, Direktor |
| `M18/trend-suggestion/VIEW`, `APPROVE` | Vlasnik, Direktor |
| `M18/agent-invocation-log/VIEW` | Vlasnik, Direktor |
| `M18/provider-health/VIEW` | Vlasnik, Direktor |
| `M18/ai-provider-quota/VIEW` | Vlasnik, Direktor |
| `M18/ai-provider-quota/OVERRIDE` *(dodato v1.7)* | Vlasnik, Direktor — ručni povratak iz `DEGRADED` u `NORMAL` pre isteka perioda (poglavlje 6.5) |
| `M18/ai-agent-budget/VIEW`, `EDIT` *(dodato v1.7)* | Vlasnik, Direktor |

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
| `/provider-health` | GET | trenutni `ProviderHealthSnapshot` po provajderu (poglavlje 2.3) |
| `/ai-provider-quota` | GET | trenutna potrošnja naspram limita po AI provajderu (poglavlje 6.4) |
| `/ai-provider-quota/:id/override` | POST | ručan povratak iz `DEGRADED` u `NORMAL` pre isteka perioda (poglavlje 6.5), zahteva `OVERRIDE` dozvolu |
| `/ai-agent-budgets` | GET / POST / PATCH | budžet po pojedinačnom agentu (poglavlje 6.5) |

---

## 10. Izlazni kriterijum

Sve stavke dokazane e2e testom (`apps/api/test/m18-exit-criteria.e2e-spec.ts`) i jediničnim testovima (`model-tier-resolver.service.spec.ts`, `notification-dispatch.service.spec.ts`), protiv prave Postgres baze — implementacija avgust 2026.

- [x] `CRITICAL`/`WARNING` `HealthSignal` odmah generiše obaveštenje na svaki `ACTIVE` `NotificationChannel`, bez čekanja na nedeljni ciklus. **`TELEGRAM` stvarno ožičen** (native `fetch`, bez nove zavisnosti); **`EMAIL` ostaje mock** (isti status kao M12 `EmailMockAdapter` — SMTP biblioteka je nova zavisnost, čeka odluku vlasnika, poglavlje 11); **`IN_APP` sada stvarno ožičen preko M19** — `HealthSignalsService.create()` emituje `M18/health-signal.critical` na Event Bus za `CRITICAL` signale (odvojeno od `NotificationChannel` dispečera, koji ostaje isključivo `TELEGRAM`/`EMAIL`), `InAppNotificationsService` (M19) ubacuje sistemsku poruku u "Obaveštenja" razgovor svakog Vlasnik/Direktor korisnika — dokazano `m19-exit-criteria.e2e-spec.ts` (implementirano avgust 2026, vidi `docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 5).
- [x] `WeeklyHealthReview` se generiše i šalje svakog ponedeljka (`@Cron('0 8 * * 1')`), čak i bez ijednog signala u periodu.
- [x] `TrendSuggestion` se ne unosi u Dodatak A Master dokumenta bez `approved_by` popunjenog — `approve()` je jedini put koji ga postavlja, `TrendSuggestionsService.approve()` odbija sve osim `DRAFT` statusa.
- [x] Nijedna čisto deterministička provera (rok, limit, datum) ne troši pozive jezičkom modelu — proverljivo kroz `AgentInvocationLog` (nema zapisa za te akcije). `HealthDetectorsService`/`ProviderHealthService`/`M18EventSubscribersService` ne uvoze `AgentInvocationLogService`, po konstrukciji.
- [x] Neuobičajen skok potrošnje tokena generiše sopstveni `HealthSignal` (`TOKEN_USAGE_ANOMALY`, prag `alert_threshold_percentage` po `AIProviderQuota`).
- [x] Akcija koja dotiče bezbednost/PII/prevaru koristi bar `STANDARD`, podrazumevano `HEAVY` nivo modela, bez obzira na tekstualnu složenost zadatka (poglavlje 6.2a) — `ModelTierResolverService.applySecurityFloor`, dokazano jediničnim testom direktno (jedini stvaran LLM poziv u kodu, M15 omnisearch, nije bezbednosno-kritičan, pa ovo pravilo u produkciji čeka prvi takav `action_code`).
- [x] Provajder čiji `uptime_percentage`/`error_count_last_hour` pređe konfigurabilni prag prelazi u `UNSTABLE`/`OFFLINE` i generiše `PROVIDER_DEGRADED` signal (poglavlje 2.3).
- [x] `HealthSignal` tipa `AUTH_ANOMALY` ima popunjen `security_category = AUTH` (poglavlje 2.4).
- [x] Potrošnja tokena agregirana po AI provajderu generiše upozorenje na `alert_threshold_percentage` (podrazumevano 80%) od `quota_limit` (poglavlje 6.4) — samo za redove gde je `quota_limit` stvarno unet (nije pretpostavljen, poglavlje 11).
- [x] Kad `AIProviderQuota.consumed_eur` dostigne `budget_limit_eur`, `enforcement_state` prelazi u `DEGRADED` i svaki naredni poziv tog provajdera se izvršava na `model_tier = LIGHT`, osim akcija koje po poglavlju 6.2a zahtevaju bar `STANDARD`/`HEAVY` — te zadržavaju svoj nivo i generišu povišeni `TOKEN_USAGE_ANOMALY` signal (poglavlje 6.5).
- [x] Isto pravilo važi nezavisno na nivou `AIAgentBudget` — jedan agent u petlji prelazi u sopstveni `DEGRADED` bez čekanja da cela potrošnja provajdera dostigne globalni budžet.
- [x] `enforcement_state` se automatski vraća na `NORMAL` na `period_start` narednog perioda (nov red, prethodni ostaje istorijski) — sprovedeno kroz `@Cron(EVERY_DAY_AT_MIDNIGHT)` rollover u `AiProviderQuotaService`/`AiAgentBudgetsService`; ručni povratak pre isteka radi isključivo preko `M18/ai-provider-quota/OVERRIDE` dozvole i ostavlja trag u `AuditLogEntry` (M1).

---

## 11. Otvoreno za dalje

- Dodavanje `VIBER`/`WHATSAPP` kanala — kad se odluka donese, isti obrazac kao `TELEGRAM`/`EMAIL`.
- **Stvarna SMTP integracija za `EMAIL` kanal** — trenutno mock (isti status kao M12 `EmailMockAdapter`); zahteva izbor biblioteke (npr. nodemailer) ili spoljnog provajdera, nova zavisnost van tehničkog steka (`00-MASTER-ARHITEKTURA.md` poglavlje 6) — čeka potvrdu vlasnika.
- ~~**`IN_APP` isporuka** — čeka M19~~ — **rešeno avgust 2026.** M19 je implementiran; `IN_APP` isporuka ide odvojenim putem od `NotificationChannel`/`NotificationDispatchService` (koji ostaje `TELEGRAM`/`EMAIL` — `NotificationChannel.channel_type = IN_APP` redovi i dalje postoje u šemi ali `NotificationDispatchService` ih i dalje samo loguje kao stub, isporuka se dešava kroz `M18/health-signal.critical` Event Bus pretplatu u M19, ne kroz taj kanal-red). Vidi M19 spec poglavlje 5 i §11 "implementaciona odluka".
- ~~**`HELP_AGENT_ABUSE_PATTERN` detekcija** — izvor je M21 (Centar za pomoć), koji još ne postoji u kodu~~ — **rešeno avgust 2026.** M21 je implementiran (backend); `HelpAbuseDetectorService` (`apps/api/src/modules/m21-centar-za-pomoc/abuse-detection/`) generiše ovaj signal real-time po pitanju (učestalost po nalogu u kratkom prozoru, ili sumnjiva fraza koja liči na pokušaj zaobilaženja ograde) — vidi M21 spec poglavlje 5.5.
- **Autonomni trend-research agent** (poglavlje 5, "agent istražuje") — implementiran je samo CRUD/odobrenje scaffolding (`TrendSuggestion`); pravo autonomno istraživanje (web-search) zahteva API van tehničkog steka, čeka odluku vlasnika. Do tada, nalazi se unose ručno (isti tip rada kao ranija Sabre analiza u ovom repozitorijumu).
- **M17 panel ekran za M18** — implementiran (avgust 2026, M17 Faza 7): `apps/panel/src/app/(app)/nadzor/` (signali/kanali/trendovi/ai-troškovi), `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md` poglavlje 4/7. Kod napisan, pušovan i ručno provereno uživo protiv prave baze, uključujući odobrenje `TrendSuggestion` (vidi M17 spec poglavlje 7, Faza 7 red).
- Tačan prag za "neuobičajen skok" po tipu signala (koliko grešaka u kom periodu je "previše") — konstante u `HealthDetectorsService`/`ProviderHealthService` su svesni, konzervativni polazni pragovi; podešava se empirijski kad sistem počne da radi u produkciji, ne unapred nagađa.
- Konkretan iznos `budget_limit_eur`/`quota_limit` (globalno i po agentu) i period (`DAILY`/`WEEKLY`/`MONTHLY`) — poslovna odluka vlasnika, ne pretpostavlja se u kodu; oba polja ostaju `nullable`/nekonfigurisana dok se ne unesu preko `POST`/`PATCH /ops/ai-provider-quota` i `/ops/ai-agent-budgets` (poglavlje 6.5).
- Da li bezbednosno kritične akcije (izuzete od degradacije, poglavlje 6.5) treba da imaju sopstveni, odvojeni budžet umesto deljenja istog sa običnim agentima — razmotriti ako se pokaže da izuzetak redovno probija ukupni budžet.
- Cenovna tabela za `estimated_cost_eur` (`apps/api/src/modules/m18-operativni-nadzor/agent-invocations/pricing.ts`) je aproksimacija — ažurirati kad se dobije zvaničan, aktuelan cenovnik provajdera.
- **Provera "bez modela" liste pri aktivaciji svakog domenskog agenta** (dopuna 18.8.2026, na zahtev vlasnika) — poglavlje 6.2 sada nabraja 11 `AUTONOMOUS` akcija (M3, M5, M7, M10, M11, M14, M18, M20) za koje izvorna specifikacija već tvrdi da je posao čisto deterministički (prag/aritmetika/mapiranje u šablon), pa implementacija ne sme ni da instancira poziv jezičkom modelu. Kad se domenski agent za M5/M7/M10/M14/M20 stvarno aktivira u produkciji (`ModuleAgentActivation.status → ACTIVATED`), pre te aktivacije proveriti da stvaran kod za tu akciju **zaista** ne zove LLM klijent — isti dokaz koji već postoji za M3/M11/M18 detektore (poglavlje 10, izlazni kriterijum: "Nijedna čisto deterministička provera... ne troši pozive jezičkom modelu", proverljivo kroz odsustvo zapisa u `AgentInvocationLog`). Ovo nije nova funkcionalnost — samo provera da implementacija zaista prati ono što je poglavlje 6.2 već propisalo, pre nego što agent počne da radi bez nadzora.
