# Specifikacija modula M23 — Znanje (baza sadržaja o destinacijama i proizvodima)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M23), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (poprečan modul, ne vezan za jednu fazu — isti slučaj kao M17/M18/M19/M21/M22)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (backend + M17 ekran + M8 javna stranica) — backend prvi prolaz avgust 2026, isti obim kao M18/M19/M21/M22; M17 ekran (`apps/panel/src/app/(app)/znanje/`) implementiran avgust 2026 (M17 Faza 7) — kod napisan, pušovan i ručno provereno uživo protiv prave baze (objava članka, potvrda deljenog linka). M8 javna stranica (`/znanje/:shareToken`) takođe implementirana (avgust 2026), više nije placeholder. M7 portal prikaz za subagente ostaje poseban naredni korak.
**Verzija:** 1.8 — bag ispravljen (21.8.2026, otkriven pri prvom uživo pokušaju sa pravim `GEMINI_API_KEY`): `selectCandidatesByEmbedding` je UVEK primenjivao `MAX_EMBEDDING_DISTANCE` prag, i kad je Anthropic podešen — suprotno dokumentovanom nameravanom ponašanju ("bez dodatnog praga... jezički model sam prepoznaje irelevantnost"). Ispravljeno dodavanjem `applyDistanceThreshold` parametra (`resolveAnswer` ga postavlja na `!this.anthropic.isConfigured()`). **Uživo pokušaj otkrio i drugu, spoljnu činjenicu, ne bag koda:** stvaran poziv ka Gemini API-ju vratio je `429 RESOURCE_EXHAUSTED` — "Your prepayment credits are depleted" — nalog vlasnika nema aktivan preplaćen kredit na Google AI Studio. Fallback mehanizam je radio tačno kako treba (upozorenje u logu, pad na ključne reči, `HTTP 201` bez greške korisniku) — ovo POTVRĐUJE da graceful-degradation stvarno radi pod pravom greškom provajdera, ne samo pod odsutnim ključem. Prava semantička putanja i dalje čeka da vlasnik doda kredit na Google AI Studio nalogu (`https://ai.studio/projects`).

**Verzija:** 1.7 — novo poglavlje 3.2a (21.8.2026, na zahtev vlasnika): semantička pretraga kandidata preko pgvector + Google Gemini `gemini-embedding-2`, zamenjuje isključivo-ključne-reči selekciju kad je `GEMINI_API_KEY` podešen (fallback na staru logiku ostaje nepromenjen; provajder prvobitno biran OpenAI, promenjen istog dana na Gemini na zahtev vlasnika). Vidi `00-MASTER-ARHITEKTURA.md` poglavlje 6 za izbor tehnologije.

**Verzija:** 1.6 — novo poglavlje 4e (18.8.2026, na zahtev vlasnika): `POST /articles/:id/translate` predlaže prevod na ostale jezike preko deljenog M15 `TranslationService` (M15 spec poglavlje 6.7) — nov `ArticleRevision.trigger=TRANSLATION`, isti obrazac odobravanja kao svaka druga revizija, nikad AI objavljuje. v1.5 — `GET /articles` (poglavlje 8) dobija opcione filtere `productId`/`destinationCountry`/`destinationCity` (18.8.2026, na zahtev vlasnika) — bez izmene ponašanja kad nisu prosleđeni (i dalje puna lista). Omogućava M5 poglavlju 3.0b.4 (nova dopuna istim prolazom) da nađe `Article` vezan za konkretan proizvod/destinaciju iz rezultata pretrage, na zahtev korisnika ("Info" radnja na kartici/redu, `29-DIZAJN-SISTEM-UI.md` poglavlje 6d). Ne menja pristupni model (poglavlje 3.1) — filtriranje je dodatno suženje već dozvoljenog skupa (PUBLISHED za ne-uređivače), ne novo pravo. v1.4 — zatvoren nedostatak otkriven u M17 Faza 7 (16.8.2026): nov `POST /knowledge/articles/:id/research` (poglavlje 8) omogućava istraživanje nad POSTOJEĆIM člankom, sa opcionim `revision_id` da popuni postojeći `PENDING_REVIEW` placeholder (npr. `SCHEDULED_REFRESH` koji `KnowledgeRefreshService` kreira) umesto da uvek pravi novu reviziju. Panel `/znanje/[id]/revizije` dobio pravu formu (`ResearchForm.tsx`) umesto ranije napomene o nedostajućem endpoint-u. v1.3 — M17 ekran implementiran (avgust 2026, M17 Faza 7): `apps/panel/src/app/(app)/znanje/` — lista, novi članak (ručni unos ili AI istraživanje nad dostavljenim tekstom), detalj+prevodi+objava+deljeni link, odobravanje izvora, odobravanje/odbijanje revizija. v1.2 — implementacija backend-a (avgust 2026): istraživanje u v1 radi ISKLJUČIVO nad tekstom koji zaposleni ručno dostavi (nema žive web pretrage/scraping-a), potvrđeno sa vlasnikom (poglavlje 10); ispravljena greška iz v1.1 — glasovni STT/TTS omotač za `/omnisearch` NE postoji u repou (bio pogrešno pretpostavljen kao već gotov u poglavlju 3.2/7), ostaje otvorena stavka i za M23 i za M15 §6.6 dok se ne izabere STT/TTS tehnologija; v1.1 dodato poglavlje 4d: istraživanje za proizvode direktno predlaže dopunu M2 kataloga kroz postojeći `ProductContentImport` mehanizam, na zahtev vlasnika (avgust 2026); v1.0 prvobitna specifikacija, na direktan zahtev vlasnika (avgust 2026)
**Zavisi od:** M1 (identitet, RBAC, audit log), M2 (proizvod kao predmet članka; poglavlje 4d, predlog dopune kataloga), M5 (poglavlje 3.0b.4, radnja "Info" na rezultatu pretrage čita ovaj modul preko `productId`/`destinationCountry`/`destinationCity` filtera), M7 (kanal za subagente, van obima ovog prolaza), M8 (javna stranica deljenog članka — API gotov, stranica van obima ovog prolaza), M15 (AI agent okvir; glasovni modalitet ostaje otvorena stavka), M17 (kanal za interni tim, van obima ovog prolaza)

---

## 1. Svrha i obim modula

M23 je baza sadržaja o **stvarnim putničkim temama** (zemlje, destinacije, hoteli, izleti — svaki proizvod koji agencija uvede u M2, plus destinacije/zemlje koje nisu same po sebi prodajni proizvod) — različito od M21, koji je uputstvo za korišćenje same Terminal platforme. AI agent aktivno **gradi** sadržaj (ne čeka da ga neko ručno napiše) iz odobrenih izvora, i pomaže timu/subagentima da brzo nađu odgovor na pitanje gosta, tekstom ili glasom.

### 1.1 Razlika u odnosu na M21 (Centar za pomoć)

| | M21 | M23 |
| :---- | :---- | :---- |
| Tema | Kako se koristi Terminal platforma | Stvarne putničke činjenice (destinacija, hotel, izlet) |
| Izvor sadržaja | Ručno piše tim (uz AI pomoć u formulaciji) | AI aktivno prikuplja sa spoljnih izvora (poglavlje 4) |
| Ko čita direktno | Interni tim + subagenti | Isto — interni tim + subagenti (poglavlje 3) |
| Ko prima sadržaj indirektno | — | Gost/klijent, isključivo preko deljenog linka (poglavlje 5) — **nikad sam ne pretražuje bazu** |

Model podataka (`Article`/`ArticleTranslation`/`Question`) namerno prati isti obrazac kao M21 radi doslednosti — razlike su u izvoru sadržaja (poglavlje 4), osvežavanju (poglavlje 4c) i deljenju (poglavlje 5), ne u osnovnoj strukturi.

### 1.2 Razlika u odnosu na M2 (Katalog proizvoda) i M12 (Marketing)

M2 drži podatke **neophodne za prodaju** (cena, dostupnost, osnovni opis za rezervaciju) — kratko, prodajno orijentisano. M23 drži **znatno bogatiji, pozadinski sadržaj** (istorija, okolina, društvene mreže hotela, praktični saveti) koji pomaže timu da odgovori na pitanje koje prevazilazi ono što stoji na stranici proizvoda. M12 proizvodi sadržaj **za javnu promociju** (blog, društvene mreže) — M23 sadržaj je interni radni alat čiji pojedinačni članci mogu biti podeljeni gostu, ali se ne objavljuju kao katalog na sajtu (poglavlje 1.3). Ako se pokaže da isti tekst treba i kao M12 `ContentPiece` i kao M23 `Article`, to je ručno prekopiran/prilagođen sadržaj u oba mesta — M23 nije izvor istine za M12, obrnuto ni M12 za M23.

### 1.3 Namerno van obima v1

- Gost/subagent ne pretražuje bazu direktno — samo prima deljen link (poglavlje 5). Ako se kasnije pokaže potreba da gost sam pretražuje (npr. javni "vodič kroz destinaciju" na M8), to je prošireno izdanje ovog modula, ne novi modul — ne pretpostavlja se ovde.
- AI agent (tekst/glas) dostupan je u v1 samo internom timu (M17) — subagenti (M7) dobijaju čitanje članaka od starta (poglavlje 3), ali AI Q&A/glas dobijaju u sledećem koraku, kad se v1 pokaže pouzdanim (isti postepeni princip kao M15 poglavlje 6.6).
- Prava integracija sa Viber/WhatsApp/Telegram/email API-jima — deljenje ide preko generisanog javnog linka koji osoblje ručno lepi u kanal po izboru (poglavlje 5), ne preko API poziva ka tim servisima.

---

## 2. Model podataka

### 2.1 `Article` — jedan članak baze znanja
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| subject_type | enum: `PRODUCT`, `DESTINATION`, `COUNTRY` | šta je predmet članka |
| product_id | UUID, nullable (FK → M2 `Product`) | popunjeno samo za `subject_type = PRODUCT` |
| destination_country / destination_city | string, nullable | isti oblik kao M2 `Product.destination_country`/`destination_city` — `destination_city` prazno za `subject_type = COUNTRY` |
| status | enum: `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `ARCHIVED` | isti obrazac kao M21 `HelpArticle.status`/M12 `ContentPiece.status` |
| generated_by | enum: `AI`, `HUMAN` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno pre `PUBLISHED`, nikad AI** — isto pravilo kao M21/M12 |
| share_token | string, unique | generiše se automatski pri prvom prelasku u `PUBLISHED` — nosi javni deljeni link (poglavlje 5) |
| last_refreshed_at | timestamp, nullable | |
| next_refresh_due_at | timestamp, nullable | `last_refreshed_at + 30 dana` — izračunato automatski (poglavlje 4c) |
| created_at / updated_at / published_at | timestamp | |

### 2.2 `ArticleTranslation`
Isti obrazac kao M21 `HelpArticleTranslation` (8 jezika, isti fallback traženi jezik → engleski → srpski).

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| article_id | UUID (FK) | |
| language_code | enum (isti skup kao M2) | |
| title / body | string / text (markdown) | |
| translation_source | enum: `MANUAL`, `AI_GENERATED` | |

### 2.3 `ArticleSource` — odobren izvor korišćen za sadržaj
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| article_id | UUID (FK) | |
| url | string | |
| source_type | enum: `HOTEL_OFFICIAL_WEBSITE`, `HOTEL_SOCIAL_MEDIA`, `GOVERNMENT_OR_TOURISM_BOARD` | **jedini dozvoljeni tipovi izvora** (poglavlje 4) — nema `OTHER`/`OTA`/`REVIEW_SITE` opcije |
| status | enum: `CANDIDATE`, `APPROVED`, `REJECTED` | `CANDIDATE` — AI pronašao, čeka ljudsku potvrdu (poglavlje 4b); `APPROVED` — potvrđen i stvarno korišćen |
| approved_by | UUID, nullable (FK → M1 User) | **nikad AI** |
| approved_at | timestamp, nullable | |
| created_at | timestamp | |

### 2.4 `ArticleRevision` — predložena izmena (početna izrada ili 30-dnevno osvežavanje)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| article_id | UUID (FK) | |
| trigger | enum: `INITIAL_CREATION`, `SCHEDULED_REFRESH`, `QUESTION_GAP`, `TRANSLATION` | `QUESTION_GAP` — pokrenuto iz neodgovorenog pitanja (poglavlje 3c), isti princip kao M21 `HelpArticleSuggestion`. `TRANSLATION` (dopuna 18.8.2026, poglavlje 4e) — pokrenuto zahtevom da se postojeći odobren prevod prevede na ostale jezike, ne novim istraživanjem |
| proposed_translations | JSONB | nacrt sadržaja po jeziku, isti oblik kao `ArticleTranslation`, ali još ne upisan kao stvaran red dok se ne odobri; za `trigger=TRANSLATION` svaki predloženi red nosi `translation_source=AI_GENERATED` (poglavlje 2.2) |
| source_ids | niz UUID (FK → `ArticleSource`), prazno za `trigger=TRANSLATION` | koji izvori (svi `APPROVED`) su korišćeni za ovaj nacrt — prevod nema sopstveni izvor, oslanja se na već odobren prevod drugog jezika (poglavlje 4e), ne na `ArticleSource` |
| status | enum: `PENDING_REVIEW`, `APPROVED`, `REJECTED` | |
| reviewed_by / reviewed_at | UUID, nullable / timestamp, nullable | **nikad AI** |
| created_at | timestamp | |

Odobrenje (`APPROVED`) upisuje `proposed_translations` kao stvarne `ArticleTranslation` redove (zamenjuje postojeće po jeziku), postavlja `Article.last_refreshed_at = now()` i ponovo izračunava `next_refresh_due_at`. Odbijanje ne menja ništa na `Article` — nacrt ostaje samo istorijski trag.

### 2.5 `Question` — svako pitanje postavljeno AI agentu (log)
Isti obrazac kao M21 `HelpQuestion`.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| asked_by | UUID (FK → M1 User) | u v1 uvek `account_type = STAFF` (poglavlje 1.3) |
| question_text | text | |
| answer_text | text, nullable | `null` ako agent nije našao pouzdan odgovor |
| matched_article_ids | niz UUID | radi sledljivosti, isti princip kao M21/M13 |
| confidence | enum: `HIGH`, `LOW`, `NONE` | `NONE` nudi pokretanje istraživanja (poglavlje 3c) |
| was_helpful | boolean, nullable | povratna informacija (👍/👎) |
| triggered_revision_id | UUID, nullable (FK → `ArticleRevision`, `trigger = QUESTION_GAP`) | popunjeno ako je korisnik potvrdio istraživanje |
| created_at | timestamp | |

---

## 3. Ko pristupa i kako (potvrđeno sa vlasnikom, avgust 2026)

### 3.1 Direktna pretraga — interni tim i subagenti, isti model kao M21

Interni tim (M17) i subagenti (`SUBAGENT_ADMIN`, M7 portal) pretražuju/čitaju `Article` direktno — nema treće, javno pretražive publike u v1 (poglavlje 1.3). Za razliku od M21 (koji ima `audience` po članku jer STAFF i SUBAGENT sadržaj treba da ostane odvojen), M23 sadržaj je **isti za obe publike** — putnička činjenica o hotelu ne zavisi od toga ko pita — pa `Article` nema polje ekvivalentno `audience`.

### 3.2 AI agent — tekst (implementirano), glas (otvorena stavka)

Agent (registrovan u M15 kao `KNOWLEDGE_AGENT`, `model_tier = LIGHT` za odgovaranje na pitanje — čisto pretraživanje već objavljenog teksta preko `POST /api/v1/knowledge/ask`) odgovara isključivo iz `ArticleTranslation` gde `Article.status = PUBLISHED`.

**Glasovni modalitet — ISPRAVKA (avgust 2026, implementacija).** Istraživanjem pri implementaciji utvrđeno je da STT/TTS omotač za `POST /omnisearch` (na koji je v1.0/v1.1 ovog poglavlja i M15 poglavlje 6.6 upućivalo kao na "već postojeći") **ne postoji nigde u repozitorijumu** — nula pogodaka. Ovaj prolaz gradi isključivo tekstualni `POST /ask`; glasovni deo (za omnisearch i za M23 podjednako) ostaje otvorena stavka koja čeka izbor STT/TTS tehnologije (potvrđeno sa vlasnikom, poglavlje 10) — vidi i ispravljeno M15 poglavlje 6.6.

### 3.2a Semantička pretraga kandidata (pgvector, 21.8.2026, na zahtev vlasnika)

Do ove dopune, `loadCandidates` je učitavao SVE `PUBLISHED` članke u memoriju, a `scoreCandidates` je birao kandidate isključivo preko preklapanja ključnih reči (presek reči pitanja i teksta članka, prag `MIN_HEURISTIC_OVERLAP = 2`) — ne prepoznaje sinonime/parafraze ("reset lozinke" naspram "promena akreditiva"), i ne skalira (svaki poziv čita ceo katalog). Vlasnikova odluka: `pgvector` ekstenzija na postojećem PostgreSQL-u (`docker-compose.yml`, `pgvector/pgvector:pg16`) + Google Gemini `gemini-embedding-2` (`outputDimensionality: 1536`, poklapa već napravljenu kolonu) — vidi `00-MASTER-ARHITEKTURA.md` poglavlje 6 za puno obrazloženje izbora (naspram Voyage AI/OpenAI/lokalnog modela, naspram posebne vektorske baze). Provajder prvobitno biran OpenAI `text-embedding-3-small`, promenjen ISTOG dana (21.8.2026) na Google Gemini na vlasnikov zahtev (već ima Gemini API pristup) — bez izmene šeme, samo zamena servisa (`GeminiEmbeddingService` umesto `OpenAiEmbeddingService`, `apps/api/src/modules/m15-ai-orkestracija/gemini/`).

- **`ArticleTranslation.embedding`** (`vector(1536)`, Prisma `Unsupported` tip — čita/piše se isključivo preko `$queryRaw`/`$executeRaw`, ne kroz tipizirani klijent) — **lenjo izračunat**, ne pri objavi. Prvi `ask()` poziv koji naiđe na prevod bez embedding-a ga izračuna i upiše (`ensureEmbeddings`), svaki sledeći poziv ga samo čita — nema eager backfill hook-a u tok objave u ovom prolazu.
- **Selekcija kandidata**: ako je `GEMINI_API_KEY` podešen, `selectCandidatesByEmbedding` rangira kandidate preko `embedding <=> $upit::vector` (kosinusna distanca), vraća top `CANDIDATE_LIMIT` bez dodatnog praga (jezički model, kad je podešen, sam prepoznaje irelevantnost preko `NEMA_ODGOVORA_U_ČLANCIMA` markera). Ako `GEMINI_API_KEY` NIJE podešen — ili embedding poziv/upit ne uspe iz bilo kog razloga — pada nazad na `selectCandidatesByKeywords` (nepromenjena, postojeća logika), isti graceful-degradation princip kao `AnthropicClientService`.
- **Bez jezičkog modela** (ni `ANTHROPIC_API_KEY` ni ranije), embedding kandidati prolaze kroz `MAX_EMBEDDING_DISTANCE = 0.6` prag (empirijski izabrana vrednost) pre nego što se prihvate za LOW-poverenje odgovor — sprečava da se uvek vrati "najbliži" članak čak i kad je genuinski nepovezan.
- **Provera:** `tsc --noEmit` čist; jedinični testovi (uklj. novi test za embedding putanju, mock `$queryRaw`/`$executeRaw`) prolaze; `pgvector` ekstenzija potvrđena aktivna na dev bazi (`SELECT extname FROM pg_extension`, verzija 0.8.6), `embedding` kolona potvrđena u šemi (`\d article_translations`); NestJS DI wiring potvrđen restartom servera (nema "can't resolve dependencies" grešaka); uživo pozvan `POST /knowledge/ask` kroz pravi login — HTTP 201, bez pada, koristi fallback putanju (jer `GEMINI_API_KEY` još nije podešen u ovom okruženju). **Sama semantička putanja sa pravim Gemini pozivom i pravim pgvector rangiranjem nad stvarnim podacima NIJE uživo potvrđena** — čeka da vlasnik obezbedi `GEMINI_API_KEY`, isti obrazac kao ranija `ANTHROPIC_API_KEY` dopuna.

### 3.3 Kad agent ne zna — predlog istraživanja, ne tiketing

Za razliku od M21 (eskalira ka M14 tiketu), ovde nedostatak odgovora znači da **sam sadržaj** nedostaje, ne da je nešto pokvareno. Ako `confidence = NONE`, agent nudi: *"Nemam pouzdan odgovor iz objavljenih članaka — da pokrenem istraživanje iz odobrenih izvora?"* Potvrda korisnika (`POST /questions/:id/request-research`) je nivo autonomije `AUTONOMOUS` (korisnik potvrđuje sopstveni zahtev, ne tuđu akciju).

**Implementacija v1 (avgust 2026).** `ArticleRevision.article_id` je obavezan FK (poglavlje 2.4) — pitanje bez ijednog pogotka po definiciji nema ciljni `Article` da se revizija na njega veže. V1 zato NE kreira `ArticleRevision` automatski ovde (što bi zahtevalo izmišljanje nepostojeće veze) — samo upisuje audit trag zahteva; uređivač ručno kreira novi `Article` (`POST /articles` sa istraživačkim poljem) na osnovu tog traga. Isto "dorađuje se" ograničenje kao M21 §5.4 grupisanje (poglavlje 10).

---

## 4. Izvori sadržaja — AI istraživanje, striktna ograda porekla (potvrđeno sa vlasnikom, avgust 2026)

**Mehanizam istraživanja u v1 (implementacija, avgust 2026, potvrđeno sa vlasnikom).** Ovaj prolaz gradi ceo tok (članci/izvori/revizije/osvežavanje/M2-most/deljeni link) **bez žive web pretrage/scraping-a sadržaja**. AI istraživanje radi nad tekstom koji zaposleni ručno dostavi (npr. nalepi sadržaj kopiran sa sajta hotela) — `KnowledgeResearchService.researchFromProvidedText(article_id, source_url, source_type, raw_text)` strukturira taj tekst i predlaže ga kao `ArticleSource` (poglavlje 2.3) + nacrt `ArticleRevision` (poglavlje 2.4). Isti oprez kao M18 trend-agent — nema nove zavisnosti/ToS rizika bez potvrde. Tačan mehanizam kojim AI eventualno u budućnosti sam "poseti" izvor (scraping vs. zvaničan API) ostaje otvoreno pitanje (poglavlje 10), van obima ove verzije.

### 4a. Dozvoljeni izvori — bez izuzetka

- **`subject_type = PRODUCT`** (hotel i sl.): **isključivo** zvaničan sajt objekta i njegove zvanične društvene mreže (`source_type = HOTEL_OFFICIAL_WEBSITE`/`HOTEL_SOCIAL_MEDIA`, poglavlje 2.3). Agregatori (OTA), sajtovi sa recenzijama, i treći nezvanični izvori **nikad** se ne koriste kao izvor teksta — sprovedeno na nivou `ArticleSource.source_type` enuma (nema `OTHER`/`OTA`/`REVIEW_SITE` vrednosti da se izabere).
- **`subject_type = COUNTRY`/`DESTINATION`**: isključivo zvanični izvori (turistička organizacija zemlje/destinacije, državni portal — `source_type = GOVERNMENT_OR_TOURISM_BOARD`).

### 4b. Više kandidata — uvek ljudska potvrda pre upotrebe

Kad AI istraživanje (početna izrada ili osvežavanje) pronađe **više od jednog** validnog kandidata izvora za isti predmet (npr. i zvaničan sajt hotela i njegov Instagram nalog, ili dva različita državna portala), svaki kandidat se upisuje kao `ArticleSource` sa `status = CANDIDATE` — **nijedan se ne koristi za sadržaj dok čovek eksplicitno ne odobri** koji/koje (`status → APPROVED`, poglavlje 2.3). Ovo je nivo **"Predloži pa čovek odobri"** — sprovedeno na nivou koda: `ArticleRevision` ne može preći u `PENDING_REVIEW` sa referencom na `ArticleSource` koji nije `APPROVED`.

### 4c. Automatsko osvežavanje na 30 dana — nacrt, nikad tiha zamena (potvrđeno sa vlasnikom, avgust 2026)

**Implementacija v1 (avgust 2026).** Pošto v1 nema živu web pretragu (poglavlje 4, iznad), koraci 1-2 ispod ostvaruju se kao **prazan "za pregled" placeholder** `ArticleRevision(trigger=SCHEDULED_REFRESH, status=PENDING_REVIEW, proposed_translations=[])` koji čeka da zaposleni ručno dostavi ažuriran tekst (preko istog `researchFromProvidedText` ulaza, pokrenut naknadno) — `KnowledgeRefreshService.runDueRefreshes()`, dnevni posao (`EVERY_DAY_AT_6AM`). Ne dupliraju se placeholderi dok postojeći čeka odluku.

Periodičan posao proverava `Article.next_refresh_due_at ≤ now()` za svaki `PUBLISHED` članak. Kad dospe:
1. AI ponovo poseti već `APPROVED` izvore (poglavlje 2.3) za taj članak; ako se pojavi nov kandidat izvor (npr. hotel pokrenuo nov zvaničan nalog), ide kroz isto odobrenje kao poglavlje 4b pre upotrebe.
2. Priprema `ArticleRevision` (`trigger = SCHEDULED_REFRESH`, `status = PENDING_REVIEW`) — nivo **"Autonomno"** za samu pripremu (ništa još nije promenjeno na živom članku), isti princip kao M3 `pricelist_import.extract`/M12 nacrt sadržaja.
3. **Postojeći objavljen sadržaj ostaje nepromenjen** dok čovek ne pregleda i odobri predlog (`ArticleRevision.status → APPROVED`, poglavlje 2.4) — nivo **"Predloži pa čovek odobri"**. Ako revizija ostane neodobrena, `next_refresh_due_at` se **ne** pomera unapred — sistem nastavlja da prikazuje da je članak "za pregled" dok se odluka ne donese, ne dozvoljava da tiho probije rok bez traga.
4. Odbijena revizija (`REJECTED`) ne menja `next_refresh_due_at` — sledeći ciklus posla je ponovo pokreće prema istom pravilu, ne čeka novih 30 dana.

### 4d. Predlaganje dopuna M2 kataloga (dopuna, avgust 2026, na zahtev vlasnika)

Za članke sa `subject_type = PRODUCT`, isto istraživanje koje puni ovaj članak (poglavlje 4a–4c) **direktno predlaže** dopunu M2 kataloga za taj proizvod — ne odvojen, novi tok, nego prosleđivanje u **već postojeći** M2 mehanizam (`ProductContentImport`/`ProductContentImportField`, M2 poglavlje 3.3/3.3a). Iz nađenog sadržaja, agent izdvaja samo ono što odgovara M2 `field_type` taksonomiji (`DESCRIPTION`, `AMENITY`, `ROOM_TYPE`, `PHOTO`, `LOCATION`, `SERVICE`) — širi, narativni deo ostaje isključivo u M23 `ArticleTranslation`, ne prelazi u katalog.

Poziva `POST /product-content-imports` (M2 poglavlje 7) sa `product_id`, `origin = M23_RESEARCH`, `fields[]` (već ekstrahovano, M2 ga ne ekstrahuje ponovo), i `source_article_revision_id` po polju za sledljivost. Odatle je **potpuno M2 nadležnost** — pregled/odobrenje ide isključivo kroz M2 `M2/product-content-import/REVIEW_FIELD` (M2 poglavlje 6), nikad kroz M23, i nikad AI. Nivo autonomije za ovaj korak (ekstrakcija + slanje predloga) je **"Autonomno"** — isto obrazloženje kao poglavlje 4c, ništa još nije upisano u katalog.

Okida se pri svakom istraživanju (`INITIAL_CREATION`, `SCHEDULED_REFRESH`, `QUESTION_GAP`) koje ima `subject_type = PRODUCT` i pronađe bar jedno polje koje odgovara taksonomiji — ne zahteva poseban korak od zaposlenog da ga zatraži.

---

### 4e. Prevod na ostale jezike — deljeni AI prevodilac (dopuna, 18.8.2026, na zahtev vlasnika)

`POST /articles/:id/translate` (poglavlje 8), zahteva `M23/article/EDIT`. Telo: `{sourceLanguageCode, targetLanguageCodes[]?}` — `sourceLanguageCode` mora imati postojeći, odobren `ArticleTranslation` red (ne može se prevoditi iz praznog); ako `targetLanguageCodes` izostane, podrazumeva se **svih preostalih 7** jezika. Poziva M15 `TranslationService` (M15 spec poglavlje 6.7) sa naslovom/telom izvornog jezika, dobija prevod po ciljnom jeziku, upisuje kao nov `ArticleRevision(trigger=TRANSLATION, status=PENDING_REVIEW, proposed_translations=[...])` — svaki predloženi red `translation_source=AI_GENERATED`.

**Ništa se ne menja na živom članku dok čovek ne odobri** — isti mehanizam kao svaka druga `ArticleRevision` (poglavlje 2.4/4c): odobrenje upisuje `proposed_translations` kao stvarne `ArticleTranslation` redove (`is_reviewed=true` pošto je upravo pregledano, isti obrazac kao M2 poglavlje 3.3 korak 4), odbijanje ne menja ništa. Ako izvorni jezik dobije izmenu **posle** što je prevod već predložen ali pre nego što je odobren, sistem ne pokušava automatski uskladiti — uređivač vidi oba (izmenjen izvor i stari predlog prevoda) i sam odlučuje da li prevod treba ponovo pokrenuti (isto "dorađuje se ako se pokaže potreba" ograničenje kao poglavlje 3.3/§5.4 M21).

**Van obima ove dopune:** automatsko pokretanje prevoda pri svakoj objavi/izmeni članka (ostaje ručna radnja urednika u v1, isti postepen princip kao ostatak M23); M2/M12/M21 ožičenje istog `TranslationService`-a (M15 poglavlje 6.7) — upisano u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`, svaki od ta tri modula dobija sopstvenu dopunu kad dođe na red.

---

## 5. Deljenje — generisan javni link (potvrđeno sa vlasnikom, avgust 2026)

Svaki `PUBLISHED` članak dobija `share_token` (poglavlje 2.1) koji otvara **javnu, neautentifikovanu** stranicu kroz M8 (`/znanje/:share_token`, dopuna M8 specifikacije, poglavlje 2) — prikazuje samo taj jedan članak, ne pretraživu listu/katalog (poglavlje 1.3, gost nikad sam ne pretražuje). Osoblje/subagent kopira link i ručno ga šalje kanalom po izboru (email, Viber, WhatsApp, Telegram, SMS) — **nema API integracije** sa tim servisima u v1 (poglavlje 1.3). Isti princip kao M10 poglavlje 7.1 (nikad ne prikupljati/obrađivati podatke koji zahtevaju spoljni ugovor bez potrebe) — deljenje linka ne zahteva odobrenje poslovnog naloga ni kod jedne platforme za razliku od prave API integracije (isto obrazloženje kao M18 poglavlje 3 napomena o Viber/WhatsApp).

`share_token` ostaje važeći i posle sledećeg `ArticleRevision` odobrenja (ista URL, osvežen sadržaj) — gost koji je sačuvao link uvek vidi tekuću, ne zastarelu verziju.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M23/article/VIEW` | Interne uloge (Vlasnik, Direktor, Sales Manager, Prodajni agent) i `SUBAGENT_ADMIN` (poglavlje 3.1) |
| `M23/article/EDIT`, `PUBLISH` | Vlasnik, Direktor, Sales Manager — **nikad AI agent** |
| `M23/article-source/APPROVE` | Vlasnik, Direktor, Sales Manager — **nikad AI agent** (poglavlje 4b) |
| `M23/article-revision/APPROVE` | Isti krug kao `PUBLISH` — **nikad AI agent** (poglavlje 2.4/4c) |
| `M23/question-log/VIEW` | Vlasnik, Direktor — uvid radi kvaliteta sadržaja |

Napomena: kao i M21, nema posebne uloge — koristi postojećih sedam osnovnih (M1 poglavlje 8), izuzeci po potrebi kroz `UserPermissionOverride`.

---

## 7. Dopuna drugih specifikacija (u istom prolazu)

- **M8** (`10-SPECIFIKACIJA-M8-SAJT-B2C.md`, poglavlje 2): javna ruta `/znanje/:share_token` — prikazuje jedan `Article` preko M23 API-ja (`GET /public/:share_token`), van standardne M8 navigacije (nema linka ka njoj sa sajta, dostupna samo direktnim linkom, poglavlje 5 ovog dokumenta). Frontend stranica implementirana (`apps/web/src/app/[locale]/znanje/[shareToken]/page.tsx`, avgust 2026).
- **M15** (`18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`, poglavlje 4 i 6.6): dva nova registra: `knowledge_question.answer` (`AUTONOMOUS`) i `knowledge_article.research_draft` (`AUTONOMOUS`, `model_tier` predlog `STANDARD` — sinteza više izvora je složeniji zadatak od čistog pretraživanja); dodat i `knowledge_article.publish` (`NEVER_AUTONOMOUS`, isto važi za `article-source.approve`/`article-revision.approve`). Poglavlje 6.6 **ispravljeno** (ne prošireno) — vidi ispravka niže: STT/TTS omotač za `/omnisearch` ne postoji, pa ni proširenje na `POST /api/v1/knowledge/ask` nije urađeno u ovom prolazu.

---

## 8. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/knowledge`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/articles` | GET | puna lista (uređivač) ili samo `PUBLISHED` (ostali), dostupno internom timu i subagentima (poglavlje 3.1). Opcioni filteri (dopuna 18.8.2026, M5 poglavlje 3.0b.4): `productId` (→ `subject_type=PRODUCT` sa tim `product_id`), `destinationCountry`/`destinationCity` (→ `subject_type IN (DESTINATION, COUNTRY)` za tu destinaciju, grad → zemlja fallback) |
| `/articles` | POST | telo sa `research{source_url, source_type, raw_text}` pokreće AI istraživanje (`ArticleRevision`, `trigger=INITIAL_CREATION`); telo sa `translations[]` je ručan unos; oba su opciona (prazan `DRAFT` je takođe validan) |
| `/articles/:id` | GET / PATCH | |
| `/articles/:id/research` | POST | (M17 Faza 7, rešeno 16.8.2026) istraživanje nad POSTOJEĆIM člankom, zahteva `M23/article/EDIT`; telo `{source_url, source_type, raw_text, revision_id?}` — bez `revision_id` pravi novu `ArticleRevision(status=PENDING_REVIEW)`, sa `revision_id` popunjava POSTOJEĆI `PENDING_REVIEW` red (npr. prazan `SCHEDULED_REFRESH` placeholder koji `KnowledgeRefreshService` kreira, poglavlje 4c) — status nikad izlazi iz `PENDING_REVIEW` na ovom putu |
| `/articles/:id/publish` | POST | zahteva `M23/article/PUBLISH`, nikad `actor_type=AI_AGENT` |
| `/articles/:id/sources` | GET / POST | pregled kandidata / ručno predlaganje izvora |
| `/articles/:id/sources/:sourceId/approve` | POST | zahteva `M23/article-source/APPROVE` (poglavlje 4b), nikad AI |
| `/articles/:id/sources/:sourceId/reject` | POST | zahteva `M23/article-source/APPROVE`, nikad AI |
| `/articles/:id/translate` | POST | (dopuna 18.8.2026, poglavlje 4e) zahteva `M23/article/EDIT`; telo `{sourceLanguageCode, targetLanguageCodes[]?}` — pravi novu `ArticleRevision(trigger=TRANSLATION, status=PENDING_REVIEW)` preko M15 `TranslationService` (M15 spec poglavlje 6.7), ne menja živ članak |
| `/articles/:id/revisions` | GET | pregled revizija (nacrta) za članak |
| `/articles/:id/revisions/:revisionId/approve` | POST | zahteva `M23/article-revision/APPROVE` (poglavlje 2.4), nikad AI |
| `/articles/:id/revisions/:revisionId/reject` | POST | zahteva `M23/article-revision/APPROVE`, nikad AI, ne menja `Article` |
| `/ask` | POST | `{question}` → `{answer, matchedArticleIds, confidence, offerResearch}` (poglavlje 3.2) |
| `/questions/:id/feedback` | POST | 👍/👎 |
| `/questions/:id/request-research` | POST | korisnikova potvrda istraživanja posle `confidence = NONE` (poglavlje 3.3, v1: samo audit trag, vidi implementaciona napomena) |
| `/questions` | GET | zahteva `M23/question-log/VIEW` (poglavlje 6) |
| `/public/:share_token` | GET | javno, neautentifikovano — jedan objavljen članak (poglavlje 5); poziva ga M8 ruta iz poglavlja 7 (van obima ovog prolaza) |

---

## 9. Izlazni kriterijum (M23)

Backend-testabilne stavke potvrđene avgust 2026 (jedinični testovi `apps/api/src/modules/m23-znanje/**/*.spec.ts` + e2e `apps/api/test/m23-exit-criteria.e2e-spec.ts`):

- [x] Interni tim i subagenti vide istu, punu listu `PUBLISHED` članaka — bez razdvajanja publike (za razliku od M21).
- [x] Gost/subagent van internog naloga ne može da pretraži/izlista članke — jedini pristup je direktan `share_token` link (`GET /public/:share_token`, bez guard-a, samo `PUBLISHED`).
- [x] `ArticleSource.source_type` ne dozvoljava vrednost van `HOTEL_OFFICIAL_WEBSITE`/`HOTEL_SOCIAL_MEDIA`/`GOVERNMENT_OR_TOURISM_BOARD` — pokušaj upisa drugog tipa se odbija na nivou modela (Prisma enum + DTO validacija).
- [x] Kad istraživanje pronađe više od jednog kandidata izvora, `ArticleRevision` se ne može odobriti dok bar jedan referencirani `ArticleSource` nije `APPROVED` ljudskim nalogom.
- [x] `Article.next_refresh_due_at` se ispravno postavlja na `last_refreshed_at + 30 dana`, i ne pomera unapred dok odgovarajuća `ArticleRevision` ne bude `APPROVED`.
- [x] Test: dospeo rok osvežavanja generiše `ArticleRevision` (`PENDING_REVIEW`) bez ijedne izmene na živom, objavljenom sadržaju dok revizija čeka.
- [x] Istraživanje za `subject_type = PRODUCT` sa poklapajućim poljima ispravno kreira M2 `ProductContentImport` (`origin = M23_RESEARCH`, `status = EXTRACTED`) sa `source_article_revision_id` popunjenim na svakom polju; nijedno polje se ne upisuje u M2 `Product` bez ljudskog pregleda kroz M2 tok (M23 nema sopstvenu prečicu za odobrenje kataloga).
- [x] AI agent (`POST /ask`) odgovara isključivo iz `PUBLISHED` sadržaja; `confidence = NONE` nudi pokretanje istraživanja, ne tiho ćutanje.
- [x] `POST /articles/:id/publish` i odobrenje revizije/izvora se ne mogu izvršiti nalogom `actor_type = AI_AGENT` — provereno na nivou koda (`assertHumanActor`, `apps/api/src/modules/m23-znanje/ai-agent-guard.ts`).
- [x] Javna stranica preko API-ja (`GET /public/:share_token`) prikazuje tačno jedan članak, bez navigacije ka ostatku baze znanja ili sajta van tog članka. M8 stranica (`/znanje/:share_token`) implementirana i deljeni link ručno proveren uživo (avgust 2026).
- [ ] Glasovni upit kroz M17 (dopuna M15 poglavlje 6.6) ispravno poziva `POST /ask` i pročita odgovor naglas, bez čuvanja audio zapisa. **Nečekirano namerno** — STT/TTS omotač ne postoji nigde u repozitorijumu (ispravka poglavlja 3.2, avgust 2026); čeka izbor tehnologije, potvrđeno sa vlasnikom da ostaje van obima ovog prolaza.
- [ ] `POST /articles/:id/translate` (poglavlje 4e, 18.8.2026) predlaže tačan prevod za tražene ciljne jezike, `ArticleRevision(trigger=TRANSLATION)` se ne može odobriti AI nalogom, i odobrenje ispravno upisuje `translation_source=AI_GENERATED`/`is_reviewed=true`. **Nečekirano — nova stavka, još neimplementirano.**
- [x] Svako pitanje/odgovor i svaka `ArticleRevision`/`ArticleSource` odluka upisani su u M1 `AuditLogEntry`.

---

## 10. Otvoreno za dalje

- **M17 ekran (interni tim)** — implementiran (`apps/panel/src/app/(app)/znanje/`, avgust 2026, M17 Faza 7). **M7 portal prikaz (subagenti)** ostaje poseban naredni korak.
- ~~**Endpoint za istraživanje nad postojećim člankom**~~ — **rešeno 16.8.2026.** `POST /knowledge/articles/:id/research` (poglavlje 8) sad postoji, sa opcionim `revision_id` da popuni postojeći `PENDING_REVIEW` placeholder umesto da uvek pravi novu reviziju.
- ~~Frontend `/znanje/:share_token` stranica (M8)~~ — **rešeno avgust 2026**: `apps/web/src/app/[locale]/znanje/[shareToken]/page.tsx` implementirana, poziva `GET /public/:share_token`, ručno provereno uživo.
- **Živa web pretraga/scraping izvora** — v1 radi isključivo nad ručno dostavljenim tekstom (poglavlje 4), potvrđeno sa vlasnikom avgust 2026. Tačan mehanizam kojim AI eventualno sam "poseti" zvaničan sajt/društvenu mrežu (scraping vs. zvaničan API gde postoji, npr. Instagram Graph API) ostaje otvorena tehnička odluka; scraping društvenih mreža može zahtevati proveru uslova korišćenja platforme pre implementacije.
- **Glasovni STT/TTS modalitet** (i za M23 `/ask` i za M15 §6.6 omnisearch) — ne postoji nigde u repozitorijumu (ispravka avgust 2026, vidi poglavlje 3.2/9); čeka izbor tehnologije, potvrđeno sa vlasnikom.
- AI Q&A za subagente (M7) — v1 daje subagentima samo čitanje već objavljenih članaka preko M1 dozvole (poglavlje 3.1/6), AI Q&A kanal dobijaju u sledećem koraku kad se pokaže pouzdanim kod internog tima.
- Prava integracija sa Viber/WhatsApp/Telegram/email API-jima za slanje umesto ručnog kopiranja linka (poglavlje 5) — isto obrazloženje kao M18 poglavlje 3 (odobrenje poslovnog naloga, mogući trošak po poruci); dodaje se ako se pokaže stvarna potreba.
- Tačan prag/algoritam za prepoznavanje kad ponovljena `QUESTION_GAP` pitanja na istu temu treba grupisati u jedno istraživanje (isto pitanje kao M21 poglavlje 8, `HelpArticleSuggestion` grupisanje) — v1 namerno NE kreira `ArticleRevision` automatski iz `request-research` (poglavlje 3.3, implementacija), samo upisuje audit trag; grupisanje/auto-kreiranje ostaje za dorađivanje.
- Da li `Article` za `subject_type = DESTINATION`/`COUNTRY` treba hijerarhiju (država sadrži destinacije) radi lakše navigacije, ili ravna lista sa filterom je dovoljna — dizajnersko pitanje, van obima ove verzije.
- Prošireno na javnu pretragu za goste (M8/M9), umesto samo deljenog linka — namerno van obima v1 (poglavlje 1.3), dodaje se ako se pokaže potreba.
