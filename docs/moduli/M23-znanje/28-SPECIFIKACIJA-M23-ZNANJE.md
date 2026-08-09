# Specifikacija modula M23 — Znanje (baza sadržaja o destinacijama i proizvodima)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M23), poglavlje 7 (model upravljanja AI agentima) i poglavlje 8 (poprečan modul, ne vezan za jednu fazu — isti slučaj kao M17/M18/M19/M21/M22)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0 — prvobitna specifikacija, na direktan zahtev vlasnika (avgust 2026)
**Zavisi od:** M1 (identitet, RBAC, audit log), M2 (proizvod kao predmet članka, `product.published` okidač), M7 (kanal za subagente), M8 (javna stranica deljenog članka), M15 (AI agent okvir, glasovni modalitet), M17 (kanal za interni tim)

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
| trigger | enum: `INITIAL_CREATION`, `SCHEDULED_REFRESH`, `QUESTION_GAP` | `QUESTION_GAP` — pokrenuto iz neodgovorenog pitanja (poglavlje 3c), isti princip kao M21 `HelpArticleSuggestion` |
| proposed_translations | JSONB | nacrt sadržaja po jeziku, isti oblik kao `ArticleTranslation`, ali još ne upisan kao stvaran red dok se ne odobri |
| source_ids | niz UUID (FK → `ArticleSource`) | koji izvori (svi `APPROVED`) su korišćeni za ovaj nacrt |
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

### 3.2 AI agent — tekst i glas, samo interni tim u v1

Isti dvostepeni obrazac kao M21 poglavlje 5:
- Agent (registrovan u M15, `model_tier = LIGHT` za odgovaranje na pitanje — čisto pretraživanje već objavljenog teksta) odgovara isključivo iz `ArticleTranslation` gde `Article.status = PUBLISHED`.
- **Glasovni modalitet** (dopuna M15 poglavlje 6.6, u istom prolazu) — isti STT/TTS omotač koji već postoji za `POST /omnisearch`, proširen da pokriva i `POST /api/v1/knowledge/ask` (poglavlje 8 ovog dokumenta). Isto ograničenje: samo M17 kanal u v1, audio se ne čuva posle transkripcije, glasom se nikad ne izvršava radnja (ovde: nikad se ne pokreće istraživanje/objava bez eksplicitne potvrde na ekranu).

### 3.3 Kad agent ne zna — predlog istraživanja, ne tiketing

Za razliku od M21 (eskalira ka M14 tiketu), ovde nedostatak odgovora znači da **sam sadržaj** nedostaje, ne da je nešto pokvareno. Ako `confidence = NONE`, agent nudi: *"Nemam pouzdan odgovor iz objavljenih članaka — da pokrenem istraživanje iz odobrenih izvora?"* Potvrda korisnika kreira `ArticleRevision` (`trigger = QUESTION_GAP`, `status = PENDING_REVIEW` posle koraka 4a–4b) — isti nivo autonomije kao M21 eskalacija (`AUTONOMOUS`, jer korisnik potvrđuje sopstveni zahtev, ne tuđu akciju), ali cilj je novi/dopunjen `Article`, ne `Ticket`.

---

## 4. Izvori sadržaja — AI istraživanje, striktna ograda porekla (potvrđeno sa vlasnikom, avgust 2026)

### 4a. Dozvoljeni izvori — bez izuzetka

- **`subject_type = PRODUCT`** (hotel i sl.): **isključivo** zvaničan sajt objekta i njegove zvanične društvene mreže (`source_type = HOTEL_OFFICIAL_WEBSITE`/`HOTEL_SOCIAL_MEDIA`, poglavlje 2.3). Agregatori (OTA), sajtovi sa recenzijama, i treći nezvanični izvori **nikad** se ne koriste kao izvor teksta — sprovedeno na nivou `ArticleSource.source_type` enuma (nema `OTHER`/`OTA`/`REVIEW_SITE` vrednosti da se izabere).
- **`subject_type = COUNTRY`/`DESTINATION`**: isključivo zvanični izvori (turistička organizacija zemlje/destinacije, državni portal — `source_type = GOVERNMENT_OR_TOURISM_BOARD`).

### 4b. Više kandidata — uvek ljudska potvrda pre upotrebe

Kad AI istraživanje (početna izrada ili osvežavanje) pronađe **više od jednog** validnog kandidata izvora za isti predmet (npr. i zvaničan sajt hotela i njegov Instagram nalog, ili dva različita državna portala), svaki kandidat se upisuje kao `ArticleSource` sa `status = CANDIDATE` — **nijedan se ne koristi za sadržaj dok čovek eksplicitno ne odobri** koji/koje (`status → APPROVED`, poglavlje 2.3). Ovo je nivo **"Predloži pa čovek odobri"** — sprovedeno na nivou koda: `ArticleRevision` ne može preći u `PENDING_REVIEW` sa referencom na `ArticleSource` koji nije `APPROVED`.

### 4c. Automatsko osvežavanje na 30 dana — nacrt, nikad tiha zamena (potvrđeno sa vlasnikom, avgust 2026)

Periodičan posao proverava `Article.next_refresh_due_at ≤ now()` za svaki `PUBLISHED` članak. Kad dospe:
1. AI ponovo poseti već `APPROVED` izvore (poglavlje 2.3) za taj članak; ako se pojavi nov kandidat izvor (npr. hotel pokrenuo nov zvaničan nalog), ide kroz isto odobrenje kao poglavlje 4b pre upotrebe.
2. Priprema `ArticleRevision` (`trigger = SCHEDULED_REFRESH`, `status = PENDING_REVIEW`) — nivo **"Autonomno"** za samu pripremu (ništa još nije promenjeno na živom članku), isti princip kao M3 `pricelist_import.extract`/M12 nacrt sadržaja.
3. **Postojeći objavljen sadržaj ostaje nepromenjen** dok čovek ne pregleda i odobri predlog (`ArticleRevision.status → APPROVED`, poglavlje 2.4) — nivo **"Predloži pa čovek odobri"**. Ako revizija ostane neodobrena, `next_refresh_due_at` se **ne** pomera unapred — sistem nastavlja da prikazuje da je članak "za pregled" dok se odluka ne donese, ne dozvoljava da tiho probije rok bez traga.
4. Odbijena revizija (`REJECTED`) ne menja `next_refresh_due_at` — sledeći ciklus posla je ponovo pokreće prema istom pravilu, ne čeka novih 30 dana.

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

- **M8** (`10-SPECIFIKACIJA-M8-SAJT-B2C.md`, poglavlje 2): nova javna ruta `/znanje/:share_token` — prikazuje jedan `Article` preko M23 API-ja, van standardne M8 navigacije (nema linka ka njoj sa sajta, dostupna samo direktnim linkom, poglavlje 5 ovog dokumenta).
- **M15** (`18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`, poglavlje 4 i 6.6): dva nova registra: `knowledge_question.answer` (`AUTONOMOUS`) i `knowledge_article.research_draft` (`AUTONOMOUS`, `model_tier` predlog `STANDARD` — sinteza više izvora je složeniji zadatak od čistog pretraživanja); glasovni omotač iz poglavlja 6.6 proširen da pokriva i `POST /api/v1/knowledge/ask`, ne samo `POST /omnisearch`.

---

## 8. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/knowledge`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/articles` | GET | lista/pretraga, dostupno internom timu i subagentima (poglavlje 3.1) |
| `/articles` | POST | pokreće AI istraživanje (`ArticleRevision`, `trigger = INITIAL_CREATION`) za novi predmet, ili ručan unos |
| `/articles/:id` | GET / PATCH | |
| `/articles/:id/publish` | POST | zahteva `M23/article/PUBLISH` |
| `/articles/:id/sources` | GET / POST | pregled kandidata / ručno predlaganje izvora |
| `/articles/:id/sources/:sourceId/approve` | POST | zahteva `M23/article-source/APPROVE` (poglavlje 4b) |
| `/articles/:id/revisions/:revisionId/approve` | POST | zahteva `M23/article-revision/APPROVE` (poglavlje 2.4) |
| `/articles/:id/revisions/:revisionId/reject` | POST | |
| `/ask` | POST | `{question}` → `{answer, matched_article_ids, confidence}` (poglavlje 3.2) |
| `/questions/:id/feedback` | POST | 👍/👎 |
| `/questions/:id/request-research` | POST | korisnikova potvrda istraživanja posle `confidence = NONE` (poglavlje 3.3) |
| `/public/:share_token` | GET | javno, neautentifikovano — jedan objavljen članak (poglavlje 5); poziva ga M8 ruta iz poglavlja 7 |

---

## 9. Izlazni kriterijum (M23)

- [ ] Interni tim i subagenti vide istu, punu listu `PUBLISHED` članaka — bez razdvajanja publike (za razliku od M21).
- [ ] Gost/subagent van internog naloga ne može da pretraži/izlista članke — jedini pristup je direktan `share_token` link.
- [ ] `ArticleSource.source_type` ne dozvoljava vrednost van `HOTEL_OFFICIAL_WEBSITE`/`HOTEL_SOCIAL_MEDIA`/`GOVERNMENT_OR_TOURISM_BOARD` — pokušaj upisa drugog tipa se odbija na nivou modela.
- [ ] Kad istraživanje pronađe više od jednog kandidata izvora, `ArticleRevision` se ne može odobriti dok bar jedan referencirani `ArticleSource` nije `APPROVED` ljudskim nalogom.
- [ ] `Article.next_refresh_due_at` se ispravno postavlja na `last_refreshed_at + 30 dana`, i ne pomera unapred dok odgovarajuća `ArticleRevision` ne bude `APPROVED`.
- [ ] Test: dospeo rok osvežavanja generiše `ArticleRevision` (`PENDING_REVIEW`) bez ijedne izmene na živom, objavljenom sadržaju dok revizija čeka.
- [ ] AI agent (`POST /ask`) odgovara isključivo iz `PUBLISHED` sadržaja; `confidence = NONE` nudi pokretanje istraživanja, ne tiho ćutanje.
- [ ] `POST /articles/:id/publish` i odobrenje revizije/izvora se ne mogu izvršiti nalogom `actor_type = AI_AGENT` — provereno na nivou koda (M15 poglavlje 5).
- [ ] Javna stranica `/znanje/:share_token` (M8) prikazuje tačno jedan članak, bez navigacije ka ostatku baze znanja ili sajta van tog članka.
- [ ] Glasovni upit kroz M17 (dopuna M15 poglavlje 6.6) ispravno poziva `POST /ask` i pročita odgovor naglas, bez čuvanja audio zapisa.
- [ ] Svako pitanje/odgovor i svaka `ArticleRevision`/`ArticleSource` odluka upisani su u M1 `AuditLogEntry`.

---

## 10. Otvoreno za dalje

- Prošireno na javnu pretragu za goste (M8/M9), umesto samo deljenog linka — namerno van obima v1 (poglavlje 1.3), dodaje se ako se pokaže potreba.
- AI Q&A/glas za subagente (M7) — v1 daje subagentima samo čitanje već objavljenih članaka (poglavlje 3.1), AI agent dobija taj kanal u sledećem koraku kad se pokaže pouzdanim kod internog tima.
- Prava integracija sa Viber/WhatsApp/Telegram/email API-jima za slanje umesto ručnog kopiranja linka (poglavlje 5) — isto obrazloženje kao M18 poglavlje 3 (odobrenje poslovnog naloga, mogući trošak po poruci); dodaje se ako se pokaže stvarna potreba.
- Tačan prag/algoritam za prepoznavanje kad ponovljena `QUESTION_GAP` pitanja na istu temu treba grupisati u jedno istraživanje (isto pitanje kao M21 poglavlje 8, `HelpArticleSuggestion` grupisanje) — dorađuje se pri implementaciji.
- Da li `Article` za `subject_type = DESTINATION`/`COUNTRY` treba hijerarhiju (država sadrži destinacije) radi lakše navigacije, ili ravna lista sa filterom je dovoljna — dizajnersko pitanje, van obima ove verzije.
- Tačan mehanizam kojim AI "poseti" zvaničan sajt/društvenu mrežu (scraping vs. zvaničan API gde postoji, npr. Instagram Graph API) — tehnička odluka pri implementaciji, van obima ove specifikacije; scraping društvenih mreža može zahtevati proveru uslova korišćenja platforme pre implementacije.
