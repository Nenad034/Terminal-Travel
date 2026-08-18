# AI rizik — pravna odgovornost, halucinacije, osiguranje, regulatorna usklađenost

**Status:** Analiza — mapira spoljne rizike na već postojeću Terminal arhitekturu, ne uvodi novu arhitekturu.
**Nastalo:** avgust 2026, povodom transkripta video priloga "Zašto čelnici tehnoloških tvrtki potiho odustaju od svojih AI planova" (kanal Infografska Emisija, https://youtu.be/TMMlAgSv274), na zahtev vlasnika.
**Svrha:** Video opisuje četiri povezana rizika koja su 2024–2026. promenila kako velike kompanije tretiraju AI agente: pravna odgovornost za ono što AI izjavi klijentu, strukturna stopa halucinacija jezičkih modela, isključenje AI grešaka iz polisa osiguranja, i regulatorni pritisak (EU AI Act). Ovaj dokument proverava, po svakom riziku, **da li Terminal Travel već ima mitigaciju u postojećoj specifikaciji** (najčešće da — M15 registar je građen pre ovog videa, ne kao reakcija na njega), i gde stvarno postoji otvorena stavka.
**Odnosi se na:** M15 (poglavlje 4, registar akcija), M6, M7, M10, M11, M12, M14, M20, M21, M23.

---

## 1. Rizik A — Pravna odgovornost za ono što AI agent izjavi (Air Canada / Moffatt presedan)

**Rizik, ukratko:** Kanadski sud (2024) je odbacio odbranu Air Canada da je njihov chatbot "zaseban pravni subjekt odgovoran za vlastite postupke" — chatbot je izmislio politiku popusta i kompanija je morala da plati štetu. Poruka: **šta god AI agent kaže klijentu, to je kompanija rekla.** Posle presude, procenat Fortune 500 kompanija koje AI navode kao značajan pravni rizik u godišnjim izveštajima skočio je sa 4% (2020) na 56% (2024).

**Terminal Travel mitigacija (već postoji, ne nova ideja):** `AgentActionType.tier` (M15 spec poglavlje 4/5) sprovodi se **na nivou koda**, ne samo procedure — svaka akcija koja bi mogla da izloži agenciju obavezi ima eksplicitan nivo, i to je stvarno primenjeno kroz `AgentActionGuard`/`@AgentAction` na 9 endpoint-a (M15 spec v1.10):

| Modul | Akcija | Nivo | Zašto ovo sprečava "Moffatt scenario" |
| :---- | :---- | :---- | :---- |
| M6 | `communication.send_with_price_or_obligation` | `PROPOSE_THEN_APPROVE` | AI ne može sam poslati gostu poruku koja sadrži cenu/obavezu — tačno tip poruke koji je Air Canada chatbot poslao |
| M14 | `ticket_response.send_with_price_or_obligation` | `PROPOSE_THEN_APPROVE` | Isto, za odgovor na tiket podrške |
| M7 | `subagent_chat.booking_confirm` | `PROPOSE_THEN_APPROVE` | AI chat sa subagentom ne može sam potvrditi rezervaciju — potvrđuje isključivo subagent svojim nalogom |
| M10 | `fiscal_document.submit` | `NEVER_AUTONOMOUS` | Slanje fiskalnog dokumenta (novčana/zakonska obaveza) odbija se na nivou koda za `actor_type = AI_AGENT`, bez obzira na dozvole |
| M11 | `travel_guarantee.edit` | `NEVER_AUTONOMOUS` | Izmena garancije putovanja nikad nije AI odluka |
| M20 | `client_contract.generate_draft` | `AUTONOMOUS`, ali samo **nacrt** | Sam ugovor je uvek generisan iz determinističkih pravila (§4 tog modula), ne slobodne AI generacije teksta |
| (globalno) | `contract.sign`, `money.transfer`, `license_data.edit` | `NEVER_AUTONOMOUS` | Tri kategorije koje Master dokument poglavlje 7 unapred proglašava "nikad AI" |
| (globalno) | `omnisearch.query` | `AUTONOMOUS`, ali isključivo pronalaženje | Ako korisnik pita "otkaži rezervaciju X", odgovor je link ka ekranu gde čovek potvrđuje — nikad izvršena radnja iz same pretrage |

**Otvoreno:** M8 (B2C sajt za goste) još nema nijedan AI agent u specifikaciji — kad dobije bilo kakav chat/asistent koji gostu direktno odgovara, mora proći kroz isti M15 registar **pre** aktivacije (`ModuleAgentActivation`, uvek ljudska odluka), ne posle. Ovo nije propust — M8 još nije ni dizajniran — ali vredi zapamtiti kao tvrd zahtev kad taj trenutak dođe, ne kao naknadnu popravku.

---

## 2. Rizik B — Halucinacije su strukturne, ne slučajne (15–50% u zavisnosti od domena)

**Rizik, ukratko:** Istraživanja (OpenAI, Stanford, citirana u videu) pokazuju da su halucinacije posledica samog predikcionog mehanizma jezičkih modela, ne bag koji se "popravi" boljim prompt-om. Deloitte istraživanje: 47% korisnika AI-ja u kompanijama priznalo je da je doneo važnu poslovnu odluku na osnovu halucinacije.

**Terminal Travel mitigacija:** Svaki agent koji odgovara direktno korisniku na pitanje o sadržaju (ne obavlja radnju) je **eksplicitno ograničen na pretragu već objavljenog/odobrenog sadržaja**, ne slobodnu generaciju:

- M21 `help_question.answer` (`AUTONOMOUS`) — "isključivo pretraga objavljenog sadržaja, bez pristupa živim podacima" (M21 spec §5.2).
- M23 `knowledge_question.answer` (`AUTONOMOUS`) — isti obrazac (M23 spec §3.2).
- M23 `knowledge_article.publish` (`NEVER_AUTONOMOUS`) — AI sme da pripremi nacrt revizije iz odobrenih izvora, ali objavljivanje je uvek ljudska odluka (M23 spec §6) — halucinacija u nacrtu se hvata pre nego što ikad postane "objavljena istina".
- M15 omnisearch (poglavlje 6.5.4) — kad rezultat uključuje M2 proizvod, fotografije/podaci dolaze direktno iz `Product.media[]`, model ih ne "opisuje" — manje prostora za izmišljanje detalja.

**Otvoreno, novo zapaženo ovom analizom (nije ranije bilo u specifikaciji):** M1 audit log već beleži svaku akciju sa `actor_type = AI_AGENT` (princip #5 Master dokumenta, "sve se može revidovati"). Kad prvi domenski agenti (M3/M5/M6...) budu stvarno aktivirani u produkciji, vredi periodično (ručno ili preko M18 operativnog nadzora) uzorkovati taj log i proveriti stopu netačnih AI nacrta — ne čekati da se problem prvi put pojavi kod gosta. Ovo bi bila mala dopuna M18 spec-a (npr. periodičan izveštaj kvaliteta AI nacrta), ne hitna stavka, ali vredna zapisivanja da se ne izgubi.

---

## 3. Rizik C — Osiguravatelji isključuju AI-generisane greške iz polisa (januar 2026)

**Rizik, ukratko:** Prema videu, od januara 2026. veliki osiguravatelji (W. R. Berkley, Chubb, Travelers, Berkshire Hathaway) uveli su isključenja za štetu nastalu iz AI-generisanog teksta/slike/zvuka/videa/koda, jer procenjuju da taj rizik ne mogu pouzdano da izmere. Ovo pogađa navodno 82% američkih preduzeća sa poslovnim polisama.

**Ovo NIJE nešto što arhitektura može da reši.** Terminal Travel je licencirani tur-operator sa zakonski obaveznom garancijom putovanja (M11, YUTA) — to je zaštita gosta od propasti agencije, ne zaštita agencije od sopstvene AI greške. To su dva različita pokrića.

**Preporučena akcija (za Vas/knjigovođu, ne za kod):** Pri sledećem razgovoru sa osiguravajućim brokerom, proveriti:
1. Da li postojeća (ili buduća) poslovna polisa Terminal Travel-a uopšte pominje AI-generisan sadržaj.
2. Da li treba poseban rider/klauzula pre nego što bilo koji M15 domenski agent (M3/M5/M6/M7/M10/M11/M12/M14/M18/M20/M21/M23) pređe iz `NOT_READY` u `ACTIVATED` status u produkciji.

Ovo je upisano kao otvorena stavka u `docs/analize/26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` (sekcija B, za advokata/brokera) i u backlog indeks (`27-BACKLOG-IDEJA-I-PREDLOZI.md`).

---

## 4. Rizik D — Regulatorna usklađenost (EU AI Act, transparentnost prema korisniku)

**Rizik, ukratko:** Video pominje da se fokus korporativnog AI menadžmenta (CAIO uloga) pomerio sa "promocije tehnologije" na usklađenost sa propisima — konkretno EU AI Act, koji je (prema ranijoj proveri, član 50) uveo obavezu transparentnosti: osoba koja razgovara sa AI sistemom mora to i znati, osim ako nije očigledno iz konteksta.

**Trenutno stanje kod Terminal Travel-a — provereno, ne pretpostavljeno:** Nijedan AI agent trenutno **ne razgovara direktno sa gostom u produkciji**:

- M21 (Centar za pomoć) pokriva interni tim, subagente (M7) i korporativne self-service klijente — ne pojedinačne goste (M21 spec, backlog stavka "Proširenje na pojedinačne (INDIVIDUAL) krajnje goste — namerno van obima").
- M23 (Znanje) ima API za deljeni javni link (`share_token`) kroz koji bi gost mogao da vidi AI-pripremljen sadržaj, ali **sama stranica koja bi to prikazala (M8) još nije napravljena** — API gotov, UI eksplicitno van obima ove verzije (backlog stavka).
- M15 omnisearch trenutno pokriva samo M17 (interni panel), ne M7/M8.

**Zaključak:** ovo trenutno nije aktivan propust — ali je tačno mesto gde treba ugraditi rešenje **pre** prvog puštanja, ne posle:
1. Kad M23 `/znanje/:share_token` stranica dobije stvaran UI (M8), ili
2. Kad M7 `subagent_chat.*` dobije stvaran korisnički interfejs, ili
3. Kad M15 omnisearch/glas prošire obim na M7/M8 kanale (M15 spec poglavlje 6.6.3 — ovo je već eksplicitno označeno kao "namerno van obima", čeka potvrdu vlasnika),

— svaki od ta tri ekrana treba jasnu oznaku "razgovarate sa AI asistentom" pre nego što se aktivira. Predlažem da se ovo upiše kao eksplicitna stavka u "Otvoreno za dalje" za M7, M8 (kad dobije spec) i M23, tako da se ne zaboravi kad ti ekrani stvarno dođu na red — dodato u backlog indeks.

---

## 5. Rizik E — obrada podataka gosta/klijenta kod spoljnog LLM provajdera (bez obzira koji se izabere)

*(dodato 18.8.2026, na zahtev vlasnika, povodom pitanja "da li Anthropic koristi podatke kad se agent poziva preko API-ja")*

**Rizik, ukratko:** Svaki poziv spoljnom jezičkom modelu (Anthropic danas za omnisearch, M15 §6.5.4; bilo koji budući provajder po drugim domenskim agentima — M15 §11 to eksplicitno ostavlja otvorenim po agentu) znači da podaci u tom pozivu **fizički napuštaju infrastrukturu koju Terminal kontroliše** i idu ka serverima trećeg lica. Ovo je nezavisno od toga kog konkretno provajdera biramo — pitanje se mora postaviti za svakog, ne samo za Anthropic:

1. **Da li provajder koristi poslate podatke za treniranje svojih modela?** Kod ozbiljnih komercijalnih API ugovora (uključujući Anthropic-ov) odgovor je po difoltu ne — ali to mora biti **potvrđeno konkretnim ugovorom**, ne pretpostavljeno iz opšte reputacije provajdera.
2. **Koliko dugo provajder čuva sirove ulaze/izlaze**, i u koju svrhu (npr. otkrivanje zloupotrebe) — tipično kratak period (npr. 30 dana), sa mogućom opcijom "nulto zadržavanje" (zero data retention) kod pojedinih provajdera za kvalifikovane komercijalne klijente.
3. **Gde se podaci fizički obrađuju** (rezidencija podataka — EU ili van EU) — relevantno jer Terminal namerno još nije izabrao EU hosting provajdera za sopstvenu produkciju (CLAUDE.md, "Struktura repozitorijuma"), a poziv spoljnom LLM-u je nezavisan kanal transfera podataka koji taj izbor ne pokriva.
4. **Da li treba potpisan DPA (Data Processing Addendum/Agreement)** sa provajderom pre nego što ijedan modul koji dodiruje lične podatke gosta/nalogodavca (M6 komunikacija, M14 tiketi, M7 subagent chat, M23/M21 pitanja) počne da poziva taj API u produkciji — i, ako provajder obrađuje van EU, da li je potreban dodatni pravni mehanizam za prenos (npr. Standardne ugovorne klauzule) u skladu sa Zakonom o zaštiti podataka o ličnosti Srbije/GDPR-om.

**Terminal Travel mitigacija (već postoji, ali rešava drugi deo problema):** M15 registar i princip "grounded-only" (Rizik B iznad) ograničavaju **šta se agent uopšte odluči da pošalje ili uradi** — ali ne rešavaju **pravni osnov za sam prenos** podataka koji legitimno jesu deo poziva (npr. ime gosta u nacrtu poruke, M6 `communication.draft`). To je odvojeno pitanje od halucinacija/autonomije, i ne rešava se kodom.

**Otvoreno — dodato u `26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md` (stavka B7):** pre nego što bilo koji domenski agent koji dodiruje lične podatke gosta/nalogodavca pređe iz `NOT_READY` u `ACTIVATED` u produkciji, proveriti sa pravnikom tačke 1–4 iznad za **tog konkretnog provajdera** — i ponoviti proveru svaki put kad se za novi domenski agent izabere drugačiji provajder (M15 §11), jer se ugovorni uslovi razlikuju po provajderu.

---

## 6. Zbirna tabela

| Rizik | Da li Terminal Travel već ima mitigaciju | Gde | Šta ostaje otvoreno |
| :---- | :---- | :---- | :---- |
| A. Pravna odgovornost za AI izjave | **Da** — sprovedeno na nivou koda | M15 registar, `AgentActionGuard` | Primeniti isti registar na M8 kad dobije AI agenta |
| B. Halucinacije | **Da**, za korisniku-vidljive odgovore (grounded-only) | M21 §5.2, M23 §3.2/§6 | Periodično uzorkovanje audit loga radi merenja stope grešaka (nova, mala ideja) |
| C. Osiguranje isključuje AI greške | **Ne** — ovo nije pitanje za kod | — | Razgovor sa brokerom pre aktivacije prvog domenskog agenta u produkciji |
| D. EU AI Act transparentnost | **Delimično** — trenutno nema aktivnog gost-facing AI, pa nema aktivnog kršenja | — | Ugraditi "razgovarate sa AI" oznaku u M7/M8/M23 UI pre nego što se aktivira, ne posle |
| E. Obrada podataka kod spoljnog LLM provajdera | **Ne** — ovo nije pitanje za kod | — | DPA/retention/rezidencija podataka provera sa pravnikom, po provajderu, pre svake `ACTIVATED` aktivacije agenta koji dodiruje lične podatke |

**Šta NE preporučujem menjati:** M15 registar, gate mehanizam (`ModuleAgentActivation`), i princip "grounded-only" odgovor za M21/M23 — sve to je već tačno u skladu sa pravcem koji video opisuje kao ono što je "preživelo hype fazu" kod velikih kompanija. Ovo nije poziv na novu arhitekturu, samo potvrda da postojeća drži.

---

## 7. Napomena o tehno-ekonomskom delu videa (GPU cene, kapitalna ulaganja, DeepSeek)

Ekonomski deo videa (pad cena GPU najma sa 7–10$/h na ~2$/h, prezasićenost infrastrukture, poređenje sa dot-com balonom optičkih vlakana) **nema direktnu poveznicu sa Terminal Travel arhitekturom** — nemamo usvojenu strategiju lokalnog hostovanja modela (M15 spec poglavlje 11 eksplicitno ostavlja izbor LLM provajdera otvoren po agentu; za omnisearch je već izabran Anthropic Claude preko API-ja, plati-po-upotrebi, ne sopstveni hardver). Pad cena cloud AI usluga nam samo čini taj već izabrani pravac jeftinijim, ne menja odluku.
