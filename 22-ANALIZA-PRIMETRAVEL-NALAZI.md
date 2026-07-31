# Analiza PrimeTravel-a — šta je korisno za Terminal

**Izvor:** `D:\PrimeTravel 17.04.2026` (interno "Olympic Hub" / "PrimeClickToTravel", React 19 + TypeScript + Vite + Supabase), pregledano 31.7.2026.
**Svrha ovog dokumenta:** PrimeTravel je stariji, mnogo dalje razvijen projekat iste namene (React/Supabase umesto NestJS/Prisma koje smo mi izabrali) sa stvarnim integracijama, radnom AI agentskom arhitekturom, i posebnim Sandbox područjem za eksperimente. Ovo je lista konkretnih ideja/obrazaca vrednih razmatranja za Terminal — **ne predlog da se menja naš stek ili arhitektura**, već lista *koncepata* koje vredi ugraditi u naše module kad dođu na red.

---

## 1. Najvažniji pojedinačni nalaz — novac kao float je greška koju treba izbeći

`supplier_integration_guide.md` (formalni okvir za integraciju dobavljača) eksplicitno propisuje: **novac se čuva kao ceo broj u najmanjoj jedinici valute (cents/para), nikad kao float** — `{ amountCents: number, currency: "EUR" }`, ne `{ amount: 100.50 }`. Naše dosadašnje specifikacije (M2, M3, M5, M10) koriste generički `decimal` tip bez ove eksplicitne napomene. **Preporuka:** dodati eksplicitnu napomenu u M3/M5/M10 da se sve novčane vrednosti čuvaju kao najmanja jedinica valute (para/cent), ne float, radi izbegavanja grešaka zaokruživanja — ovo je jeftino da se uradi sad, skupo da se popravlja posle.

---

## 2. M4 (Integracije spoljnih API konekcija)

- **`supplier_integration_guide.md`** je gotovo direktan pandan našem `ProviderAdapter` interfejsu iz M4 — potvrđuje da je naš pristup ("Unified Model", adapter po dobavljaču, mapper koji nikad ne menja unificirani tip) ispravan i industrijski uobičajen obrazac. Konkretne dodatne ideje iz njihove strukture:
  - Odvojeni **`error.types.ts`** — unificiran model grešaka preko svih dobavljača (mi trenutno u M4 imamo samo `response_status` string u `ProviderCallLog`; vredi razmotriti tipizirani, unificiran enum grešaka umesto slobodnog stringa).
  - Odvojen **`auth.strategies.ts`** — eksplicitno predviđa da različiti dobavljači koriste različite metode autentikacije (API key, Basic, OAuth, potpisivanje zahteva) kao uključive strategije, ne kao if/else granu u svakom adapteru.
  - Formalno imenovan **`circuit.breaker.ts`** — mi u M4 imamo timeout/retry logiku, ali nismo imenovali pravi circuit-breaker obrazac (privremeno "isključivanje" provajdera posle niza uzastopnih grešaka, sa periodičnim probnim pozivom da se vidi da li je oporavljen). Vredi eksplicitno dodati u M4.
  - Svaki adapter dobavljača ima sopstveni **`.profile.json`** — deklarativni opis mogućnosti/ograničenja tog dobavljača (rate limits, podržane operacije). Korisna ideja za `ProviderConfig` u M4.
- **Cornerstone/BORS i Intesa** (`cornerstoneService.ts`, `intesaPaymentService.ts` u PrimeTravel-u) — konkretni, stvarni kandidati za M10 otvoreno pitanje "izbor PCI-DSS platnog provajdera" — Intesa je banka koja stvarno posluje u Srbiji i ima payment gateway servis već pisan u PrimeTravel-u. Vredi pogledati taj kod kad dođe vreme za M10 implementaciju.

---

## 3. M3 (Ugovaranje i alotmani)

- **Overlap prevention** — `PRICING_BLUEPRINT.md` eksplicitno navodi "sprečavanje preklapanja perioda" kao planiranu validaciju koju mi nismo eksplicitno naveli u M3: dva `ContractPeriod` za isti `room_type` ne smeju imati preklapajuće `stay_from`/`stay_to` opsege (dvosmislno koja cena važi). **Preporuka: dodati ovu validaciju u M3 kad se implementira.**
- **Allotment/stop-sale/open-sale upravljanje** i **channel manager integracija** navedeni su kao neurađeno u PrimeTravel-u (46% gotovo) — ovo govori da je to genuinski težak deo posla, ne da smo nešto propustili; naš M3 već pokriva `allotment_mode`/`total_capacity`/`units_sold`, što je solidna osnova.
- Njihov **AI uvoz cenovnika** (`AiMapperPreview.tsx`, `PricelistImportPreview.tsx`) je manje razrađen od onoga što smo mi upravo dodali u M3 (poglavlje 4.2 — fuzzy matching sa pragom pouzdanosti) — naš dizajn je, izgleda, napredniji u ovoj tački.

---

## 4. M5 (Rezervacije)

- Njihov **SmartSearch** ima **8 zasebnih formi po tipu proizvoda** (hotel, let, transfer, aktivnost, krstarenje, čarter, auto, tura) — potvrđuje da je vredno da naš M5/M2 model tipova proizvoda (`ACCOMMODATION/PACKAGE/TRANSFER/EXCURSION/FLIGHT/INSURANCE`) ostane lako proširiv (već jeste, JSONB `attributes`).
- **Comparison tool** (uporedi 2-3 hotela) i **Grupna pretraga sa grupnim popustima** — dve ideje koje mi trenutno nemamo, vredne razmatranja za M5/M8 UI kad dođe na red.
- **MagicBOX cross-sell** (upsell na već potvrđene rezervacije — npr. ponuditi transfer/osiguranje posle potvrde hotela) — nemamo ovo u M5; moglo bi biti prirodna AI-agentska "Autonomno" predlog-funkcija (predloži, čovek/gost odluči) vredna razmatranja za M15/M5.

---

## 5. M6 (CRM)

- **Tagging/segmentacija** (VIP, porodica, senior...) i **preferencije klijenta** — mi imamo `GuestProfile.preferences` kao slobodan JSONB, ali nemamo eksplicitnu segmentacionu/tag logiku — laka dopuna.
- **Birthday/anniversary automatski emailovi** i **pre-departure email sekvenca (T-7/T-3/T-1 dan pre puta)** — konkretne, korisne automatizacije koje nismo predvideli u M6/M12. Uklapaju se prirodno u M12 (Marketing) kao dodatni `ContentPiece` okidač.
- **Churn prediction** (AI predviđa koji klijenti odlaze) — pomenuto kao "nije početo" i kod njih; napredna ideja za mnogo kasniju fazu, ne prioritet sada.
- **CRMNotetaker — AI notetaker za pozive/sastanke** — zanimljiva ideja: AI agent koji sažima telefonski poziv/sastanak direktno u `CommunicationLog` (M6). Uklapa se u postojeći "Autonomno" nivo (sažimanje) bez izmene arhitekture.

---

## 6. M7 (B2B/Subagenti)

- **Agent performance reporting** i **Markup/commission logika po subagentu** — potvrđuju smer u kom smo već otišli (naš M7 sa `CommissionVolumeTier` je, izgleda, razrađeniji od njihovog "delimičnog" stanja).
- **Multi-microsite / whitelabel po subagentu** (svaki subagent dobija sopstveni brendirani URL) — nemamo ovo uopšte; zanimljiva ideja za mnogo kasniju fazu ako se pokaže poslovna potreba, ne za sada.
- **Agent approval workflow** i **credit limit enforcement** — mi smo ovo već rešili čvršće u našem M7 (obavezno odobrenje pre `ACTIVE`, tvrda provera limita pre potvrde rezervacije) — ovde smo ispred njih.

---

## 7. M10 (Finansije)

- Potvrđeno kod njih takođe: **eFaktura/SEF integracija je "zakonska obaveza, nije početo"** — mi smo u ovoj tački ispred (imamo pun dizajn toka u M10), ali potvrđuje da je ovo realno težak, još neisprobani deo za oboje.
- **Automatska rekonsilijacija (rezervacija → uplata → faktura)** — eksplicitno navedeno kao nedostajuće i kod njih; naš M10 `SupplierObligation` (upravo dodat) pokriva stranu ka dobavljaču, ali *ka gostu* rekonsilijacija (da li se svaka `Booking` na kraju poklapa sa stvarno primljenom uplatom i izdatom fakturom, bez ručne provere) nije eksplicitno pokrivena — vredi razmotriti kao dopunu M10 ili M13 izveštaj.
- **VccAuditDashboard** (Virtual Credit Card audit — praćenje virtuelnih kartica koje agencija koristi za plaćanje dobavljačima, čest slučaj kod avio/hotel konsolidatora) — koncept koji mi uopšte nemamo; relevantno tek kad/ako Terminal počne da koristi VCC za plaćanje dobavljača, beležim za kasnije.

---

## 8. M8 (Sajt/B2C) — konkretna SEO dopuna

Njihov B2C sajt ima gotove **schema.org structured data komponente**: `SEOMeta`, `BreadcrumbLD`, `HotelSchemaLD`, `TouristTripSchemaLD`, `FAQSchemaLD`, `LocalBusinessSchemaLD`. Naš M8 pominje SEO/SSR uopšteno (poglavlje 5) ali ne nabraja konkretne schema.org tipove. **Preporuka: dodati ovu listu u M8 kao konkretnu SEO checklist-stavku** — jeftino za dodati, direktno poboljšava vidljivost na Google-u.

---

## 9. M12 (Marketing) i M14 (Helpdesk) — Omnichannel inbox

**`OmniChannelInbox.tsx`** — objedinjuje poruke sa Instagram, Facebook, WhatsApp, YouTube, SMS u jedan inbox, sa statusima (`new`, `ai_draft`, `escalated`, `replied`, `ignored`) — AI priprema nacrt, čovek odobrava (isti obrazac koji mi već koristimo u M6/M14!). Naš M14 trenutno pokriva samo `SITE_FORM`/`B2B_PORTAL`/`EMAIL`/`PHONE` kanale, ne društvene mreže. **Preporuka: razmotriti proširenje M14 `Ticket.channel` enum-om sa `INSTAGRAM`/`FACEBOOK`/`WHATSAPP` kad se M12 distribucioni kanali prošire** — prirodna nadogradnja, ne nova arhitektura, isti AI-draft-pa-čovek-odobri obrazac koji već imamo svuda.

---

## 10. M18 (Operativni nadzor) — jako se poklapa, sa konkretnim dopunama

Ovo je oblast najjačeg poklapanja — PrimeTravel ima **tri odvojena, radna monitoring modula** koja potvrđuju naš M18 dizajn i dodaju konkretne detalje:

- **`SystemPulse.tsx`** — prati **infrastrukturu** (CPU/memorija/disk) **i svaku spoljnu integraciju pojedinačno** (latencija u ms, uptime %, status ONLINE/UNSTABLE/OFFLINE, broj grešaka u poslednjem satu) — npr. "Amadeus GDS: 850ms, 98.5% uptime, UNSTABLE, 12 grešaka". Naš M18 `HealthSignal` prati poslovne signale (neuspela plaćanja, eTurista greške), ali **ne prati infrastrukturne/API metrike po pojedinačnom provajderu na ovaj način**. **Preporuka: proširiti M18 (ili M4) sa per-provajder metrikama (latencija, uptime %, greške/sat), ne samo poslovnim signalima.**
- **`AIQuotaDashboard.tsx`** — prati potrošnju **po AI provajderu** (Gemini/OpenAI/Claude), dnevno/nedeljno/mesečno naspram limita, **i ima iste kanale obaveštenja koje smo mi nezavisno izabrali — Telegram (token + chat ID) i email.** Ovo je jaka potvrda da je naš izbor kanala (poglavlje 3 M18) ispravan. Naš M18 `AgentInvocationLog` prati potrošnju po agentu — vredi dodati i agregaciju **po provajderu** (ukupna potrošnja kod Gemini-ja/OpenAI-ja/Anthropic-a naspram njihovog globalnog kvota-limita), jer je to drugačiji način otkaza od pojedinačnog agenta koji troši previše.
- **`Fortress.tsx`** — poseban bezbednosni monitoring modul (anomalije, IP status, log po kategorijama: `#api #PII #GDPR #security #audit #stability #encryption`), sa AI čet interfejsom za pitanja o bezbednosnim preporukama. Mi nemamo poseban bezbednosni monitoring modul u Terminal-u (samo opšti `HealthSignal`). **Preporuka: razmotriti da M18 dobije poseban `signal_type` za bezbednosne anomalije (npr. `AUTH_ANOMALY` već postoji — proširiti kategorizaciju po uzoru na njihove hashtag-ove: PII/GDPR posebno, ne samo generičko).**
- **`orchestratorV2Config.ts` — "Model Matrix"** — konkretna, radna implementacija baš onoga što smo mi teoretski predvideli u M18 poglavlju 6 (model-tiering): svaki AI agent ima dodeljen model po ulozi — jeftin/brz model (`gemma-4-e2b-it`) za većinu agenata (pretraga, marketing, booking, orkestrator), ali **bezbednosno kritičan agent ("sentinel") koristi jači/skuplji model (Claude 3.5 Sonnet)**. Ovo potvrđuje naš pristup i daje konkretan obrazac: **model se ne bira samo po složenosti zadatka, nego i po tome koliko je akcija osetljiva/kritična** — vredi eksplicitno dodati ovaj kriterijum u M18 poglavlje 6 (trenutno imamo samo "složenost", ne i "kritičnost/bezbednosna osetljivost" kao zaseban kriterijum za izbor težeg modela).

---

## 11. M15 (AI orkestracija) — "kancelarijska" metafora vredna razmatranja

`MasterOrchestrator.tsx` prikazuje AI agente kroz metaforu **virtuelne kancelarije**: `CeoCard`, `CooCard`, `OfficeAgentCard`, `MeetingPanel` — imenovani agenti (Ljubica, Elena, Viktor, Marko, Luka, Sara, Relja, Nikola) sa specifičnim ulogama, umesto apstraktnih "domenski agent M6" itd. Ovo je **čisto UI/UX pitanje** (M17 interni panel), ne menja arhitekturu M15, ali je vredno razmatranja: prikaz AI agenata kao imenovanih "kolega" sa "sastancima" može biti prijatniji/razumljiviji način da vlasnik (ne-tehnička osoba) prati šta agenti rade, umesto sirove liste `AgentActionType` zapisa. **Preporuka: napomenuti ovo kao UX ideju u M17 kad se bude dizajniralo "Agent Inbox" (M15 poglavlje 6).**

Takođe zapaženo: `MilicaAgent` je **ReAct agent sa 5 alata** (rezervacije, pretraga, mail, CRM, izvoz) — konkretan primer kako jedan agent kombinuje više alata u jednom zadatku, relevantno za M15 poglavlje 2 (domenski agent ima pristup samo svom modulu — njihov Milica agent izgleda ima širi pristup, što je suprotno našem principu najmanjih ovlašćenja; vredi ostati pri našem, strožem pristupu).

---

## 12. Sandbox — Voice AI (najzanimljiviji nalaz za daleku budućnost)

`voice-ai-sandbox/` je ozbiljan prototip **glasovnog AI agenta na srpskom jeziku** za dvosmernu komunikaciju sa gostima (citiranje cena hotela, odgovaranje na pitanja glasom):
- **Hibridni pristup provajderima**: Gemini 1.5 Flash (LLM, sa context caching za velike PDF/Excel cenovnike), Faster-Whisper lokalno (besplatna transkripcija) + Azure Speech kao cloud fallback, Azure Neural glas (standardni) + ElevenLabs (premium, prodajni glas).
- **Silero-VAD** za prirodnu detekciju kraja rečenice (bez dugmeta "govori sad").
- Status: "75% Sandbox Ready" — arhitektura postoji, nedostaje povezivanje sa stvarnim podacima i frontend/telefonija integracija.

**Ovo je genuinski nova ideja koju Terminal trenutno uopšte nema** — ni M9, ni M19, ni M15 ne predviđaju glasovni kanal. Nije prioritet sada (Terminal je tek u fazi specifikacije), ali vredi zabeležiti kao **kandidat za budući modul** (npr. dopuna M19 "Komunikaciona platforma" ili nov modul) kad Terminal dođe do faze gde ima dovoljno gostiju da telefonski/glasovni kanal ima smisla. Konkretna vrednost: gotov, promišljen izbor tehnologija (koji provajder za šta) koji se može direktno preneti kad dođe vreme.

---

## 13. AI-agent operativni model (SOUL.md/AGENTS.md/SHIELD.md) — proces, ne arhitektura

PrimeTravel ima izuzetno razrađen sistem fajlova koji definišu **kako AI agent (Claude/drugi) treba da se ponaša dok radi na njihovom kodu**: `SOUL.md` (ličnost/vrednosti), `USER.md` (ko je vlasnik), `SHIELD.md` (bezbednosne "crvene linije" — tajne nikad u git-u, PII nikad u LLM prompt/logove, validacija unosa), `AGENTS.md` (operativni protokol — "pre-flight checklist" pre pisanja koda, dnevne beleške `memory/YYYY-MM-DD.md` + kurirani `MEMORY.md`), `HEARTBEAT.md` (proaktivno ponašanje).

Ovo **nije deo Terminal arhitekture** (to je uputstvo za AI asistenta koji piše kod, ne za sam Terminal proizvod), ali je direktno relevantno za **kako mi radimo zajedno na Terminal-u** — slično CLAUDE.md konceptu. Konkretne ideje vredne razmatranja za naš radni proces:
- **`SHIELD.md`-stil "crvene linije"** dokument za Terminal razvoj — kratak, uvek-u-glavi spisak (tajne nikad u git, PII nikad u LLM log, itd.) koji bi mogao biti koristan kad počnemo stvarnu implementaciju (Faza 0).
- **Dnevne beleške + kurirana dugoročna memorija** — sličan obrazac onome što ja već radim (memory sistem), potvrđuje da je ovaj pristup vredan.

Ovo ne zahteva akciju sada — beležim ga jer je koncept koji ćemo verovatno želeti kad implementacija stvarno počne.

---

## Prioritetni rezime — šta bih ja prvo ugradio

Ako bih morao da biram samo tri stvari za odmah:

1. **Novac kao integer (cents/para), ne float** — jeftino sad, skupo posle (poglavlje 1).
2. **Overlap prevention za `ContractPeriod`** — sitna, jasna dopuna M3.
3. **Model-tiering po kritičnosti akcije, ne samo po složenosti** — dopuna M18 poglavlje 6, direktno potvrđena njihovim radnim "Model Matrix" obrascem.

Ostalo (omnichannel inbox, voice AI, VCC audit, whitelabel B2B) su dobre ideje za kasnije faze, ne za sad.
