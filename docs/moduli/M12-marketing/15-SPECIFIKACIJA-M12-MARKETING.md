# Specifikacija modula M12 — Marketing i sadržajni engine

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M12) i poglavlje 8 (Faza 6)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (avgust 2026) — vidi poglavlje 8 za tačan obim; API dokumentacija u `docs/api/M12-marketing.md`, objašnjenje za vlasnika u `00-OBJASNJENJE-M12-ZA-VLASNIKA.md` (isti folder)
**Verzija:** 1.5 — `ContentMedia` — prvi stvaran mehanizam za prilaganje slike/videa uz marketing sadržaj (23.8.2026, na zahtev vlasnika — pitao je direktno "kako dodajemo slike i reels u [ekran]?" na `/marketing/:id`). Nalaz pri proveri: `contains_ai_generated_media` (poglavlje 2.1, postoji od avgusta 2026) je OTKAD POSTOJI samo oznaka/checkbox za YUTA transparentnost — nikad nije čuvao stvaran fajl, `ContentTranslation.body` je čist tekst bez ijednog polja za medij. Za poređenje, M2 katalog proizvoda ima pravu galeriju (`Product.media`, JSON niz) — M12 nikad nije dobio ekvivalent, propust u specifikaciji, ne previd u UI-ju. Rešeno novim §2.5 modelom `ContentMedia` — isti obrazac kao M19 §2.5 `MessageAttachment` (chat prilozi, uveden dan ranije u istoj sesiji): lokalni disk API servera (`apps/api/uploads/marketing/`) dok se hosting provajder za produkciju ne izabere (vlasnikova odluka preko `AskUserQuestion`, ponovljena identično M19 odluci), max 100MB po fajlu (veći limit od M19-ovih 20MB — video/reels su tipično veći od chat priloga), bela lista MIME tipova (`image/*`/`video/*`, za razliku od M19 crne liste izvršnih ekstenzija — ovde svrha nije "sve osim opasnog", već tačno dve stvari). Dodavanje/uklanjanje medije zabranjeno čim `ContentPiece` pređe u `APPROVED`/`PUBLISHED` (ista granica kao `update()` teksta, poglavlje 3) — sprečava tihu zamenu slike posle odobrenja bez ponovnog pregleda. Panel: `MediaGallery.tsx` (nova komponenta uz `TranslationsPanel.tsx` na `/marketing/:id`) — dugme za otpremanje, grid prikaz (slike inline `<img>`, video `<video controls>`), dugme za uklanjanje po stavci; preuzimanje/prikaz kroz novu panel BFF rutu `apps/panel/src/app/api/marketing/media/[mediaId]/route.ts` (isti obrazac kao M19 chat-attachment proxy, ali NAMERNO bez prosleđivanja `Content-Disposition` zaglavlja — ovde se medija prikazuje UGRAĐENO u galeriji, `attachment` disposition bi naveo neke pregledače da odbiju inline prikaz slike/videa).

**Provera:** `tsc --noEmit` čist za `apps/api` i `apps/panel`. Uživo, protiv prave baze i pravog API/panel servera (privremeni VLASNIK nalog + DRAFT `ContentPiece`, obrisani posle provere): (1) otpremanje prave PNG slike i mock MP4 fajla — oba HTTP 201, `mediaType` tačno razrešen (`IMAGE`/`VIDEO`) iz MIME tipa; (2) `GET /content/:id` prikazuje oba u `media[]`; (3) preuzimanje slike vraća BAJT-ZA-BAJT identičan sadržaj originalu; (4) prilog sa `text/plain` MIME tipom odbijen (HTTP 400, "samo slika/video"); (5) brisanje slike uklanja i DB zapis i fajl sa diska (potvrđeno da samo video ostaje i u bazi i u `uploads/marketing/`); (6) posle `approve()` (koji je i objavio sadržaj bez zakazanog termina) pokušaj otpremanja nove slike vraća HTTP 400 ("Objavljen sadržaj se više ne može menjati") — potvrđuje nepovratnu granicu; (7) kroz panel: `/marketing/:id` HTML prikazuje galeriju sa video fajlom i tačnim `/api/marketing/media/:id` linkom; panel BFF proxy vraća bajt-za-bajt identičan video sa `content-type: video/mp4` i BEZ `content-disposition` zaglavlja (potvrđeno `curl -D`). Sav test sadržaj (nalog, `ContentPiece`, fajlovi na disku) obrisan posle provere.

**Verzija:** 1.4 — M8 integracija (avgust 2026, M8 nastavljen posle M12): nov javan endpoint `GET /marketing/public/content` (`PublicContentController`, bez guard-a, servira samo `status=PUBLISHED` sadržaj sa `M8_SITE` u `target_channels` preko `ContentService.findPublishedBySlug`) — zatvara poslednju otvorenu stavku poglavlja 8 (`/stranica/:slug`, `/blog/:slug` na M8 strani sada mogu da čitaju). Hvatanje `?ref=` ostaje na M8 strani (M8 spec poglavlje 3, korak 0), M12 se ovim ne menja. v1.3 — implementacija (avgust 2026): kod pod `apps/api/src/modules/m12-marketing/`, `ContentPiece`/`ContentTranslation`/`ChannelConfig` u Prisma šemi, M13 `resolveContentAttribution` povezan na pravi `ContentService.findByTrackingCode` (in-process DI, poglavlje 6c). M8-zavisne stavke (poglavlje 3b/6b — `/stranica/:slug`, `/blog/:slug`, hvatanje `?ref=`) namerno nisu implementirane (M8 pauziran, CLAUDE.md). v1.2 dopuna avgust 2026: `STATIC_PAGE` tip + `slug` za opšte stranice sajta (poglavlje 3b), `tracking_code` i atribucija rezervacije ka sadržaju preko M5/M13 (poglavlje 3a), `target_tags` filter za `EMAIL` kanal po M6 `tags` (poglavlje 4), obavezno označavanje AI generisanog vizuelnog sadržaja po YUTA preporuci (poglavlje 3c)
**Zavisi od:** M1, M2, M6

---

## 1. Svrha i obim modula

M12 pokriva tok: **proizvod (M2) → generisanje sadržaja → kalendar/odobrenje → distribucija na kanale** (sajt, društvene mreže, email). AI priprema sadržaj, čovek ga uvek odobrava pre javne objave (poglavlje 7 Master dokumenta eksplicitno navodi "objava marketinškog sadržaja na javnim kanalima" kao "Predloži pa čovek odobri").

---

## 2. Model podataka

### 2.1 `ContentPiece`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| product_id | UUID, nullable (FK → M2) | ako je sadržaj vezan za konkretan proizvod; `null` za `STATIC_PAGE` i opšte `BLOG_POST` sadržaje (poglavlje 3b) |
| type | enum: `BLOG_POST`, `SOCIAL_POST`, `EMAIL_NEWSLETTER`, `BANNER`, `STATIC_PAGE` *(dodato avgust 2026, poglavlje 3b)* | `STATIC_PAGE` — opšte stranice sajta (npr. "O nama", "Kontakt") van kataloga proizvoda |
| slug | string, nullable, unique kad popunjeno | **obavezno za `STATIC_PAGE`/`BLOG_POST`** (poglavlje 3b) — sopstvena URL putanja, isti princip kao `ProductTranslation.slug` (M2); nepotrebno za `SOCIAL_POST`/`EMAIL_NEWSLETTER`/`BANNER`, koji nemaju sopstvenu M8 stranicu |
| tracking_code | string, unique | generiše se automatski pri kreiranju (kratak, npr. 8 karaktera, bez specijalnih znakova) — koristi se za atribuciju rezervacije ka sadržaju (poglavlje 3a), ne za identifikaciju same objave |
| target_channels | niz enum: `M8_SITE`, `FACEBOOK`, `INSTAGRAM`, `EMAIL`, `MOBILE_PUSH` *(dodato pri specifikaciji M19)* | `MOBILE_PUSH` koristi već postojeći mehanizam push notifikacija iz M9 (M9 specifikacija, poglavlje 5), ne novu infrastrukturu |
| target_tags | string[] (JSONB niz), nullable *(dodato avgust 2026, poglavlje 4)* | **samo za `EMAIL`** — filtrira primaoce po M6 `ClientAccount.tags`; prazno/`null` = svi sa `marketing_consent = true` (nepromenjeno ponašanje) |
| contains_ai_generated_media | boolean, default `false` *(dodato avgust 2026, poglavlje 3c — YUTA preporuka)* | `true` kad `body`/`media` sadrži sintetički AI-generisan vizual (ne AI-*izvučenu* stvarnu fotografiju, poglavlje 3c); uslovljava obavezu vidljive oznake transparentnosti pri odobrenju |
| scheduled_publish_at | timestamp, nullable | kalendar — sortiranje po ovom polju daje prikaz kalendara, bez posebnog entiteta |
| generated_by | enum: `AI`, `HUMAN` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno pre `PUBLISHED`, nikad AI** |
| published_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

### 2.5 `ContentMedia` (v1.5, 23.8.2026)

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| content_piece_id | UUID (FK → ContentPiece) | |
| media_type | enum: `IMAGE`, `VIDEO` | izvedeno iz MIME tipa pri otpremanju, sačuvano eksplicitno (jednostavnije za panel prikaz) |
| file_name | string | originalno ime koje je pošiljalac poslao |
| mime_type | string | |
| size_bytes | int | max 100 MB po prilogu (video/reels su veći od slika) |
| storage_path | string | relativna putanja unutar `apps/api/uploads/marketing/<content_piece_id>/` — lokalni disk API servera, van git-a, dok se hosting provajder za produkciju ne izabere (ista vlasnikova odluka kao M19 §2.5 prilozi u chat-u) |
| uploaded_by | UUID (FK → M1 User) | |
| uploaded_at | timestamp | |

Jedan `ContentPiece` može imati više medija (galerija). Dodavanje/uklanjanje je zabranjeno čim sadržaj pređe u `APPROVED`/`PUBLISHED` — ista nepovratna granica kao izmena teksta (poglavlje 3, `update()`). Preuzimanje/prikaz isključivo preko autentifikovanog `GET /marketing/content/media/:mediaId/download` (poglavlje 7) — fajl se ne servira kao javan statički resurs; dozvola je ista kao pregled sadržaja (`M12/content/VIEW`), bez dodatne provere vlasništva (za razliku od M19 priloga, ovde nema koncepta "učesnika razgovora" — ceo interni tim koji vidi sadržaj sme da vidi i njegovu galeriju).

**Razlika od `contains_ai_generated_media` (poglavlje 2.1):** to polje je OTKAD POSTOJI samo oznaka/checkbox (YUTA transparentnost) — nikad nije čuvalo stvaran fajl. `ContentMedia` je prvi stvaran mehanizam za prilaganje slike/videa, uveden ovim prolazom nakon što je vlasnik direktno pitao "kako dodajemo slike i reels?" i otkrio da odgovor dotad nije postojao.

### 2.2 `ContentTranslation`
Isti obrazac kao M2 `ProductTranslation` (poglavlje 2.2 te specifikacije) — redovi po jeziku, ne fiksne kolone, isti fallback (traženi jezik → engleski → srpski), isti skup 8 jezika.

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| content_piece_id | UUID (FK) | |
| language_code | enum (isti skup kao M2) | |
| title / body | string / text | |
| translation_source | enum: `MANUAL`, `AI_GENERATED` | |
| is_reviewed | boolean | |

---

## 3. Tok — od proizvoda do objave

1. **Okidač:** kad `Product.status` u M2 pređe u `ACTIVE` (objavljen u katalogu), M2 emituje događaj `product.published` (dopuna M2 specifikacije, poglavlje 7 ovog dokumenta — M2 do sad nije imao sopstvene Event Bus emisije).
2. M12 se pretplaćuje na taj događaj i **AI agent automatski priprema nacrt** — nivo "Autonomno" iz poglavlja 7 Master dokumenta ("priprema nacrta sadržaja" je eksplicitno naveden primer). Agent kreira `ContentPiece` odmah sa `status = PENDING_APPROVAL` (ne postoji zaseban ljudski korak koji bi ga prebacio iz `DRAFT`, pa je `DRAFT` rezervisan isključivo za sadržaj koji ručno unosi čovek i još ga ne smatra spremnim za pregled).
3. Nacrt se pojavljuje u kalendaru internog panela (M17), spreman za pregled.
4. **Čovek pregleda, po potrebi menja, i odobrava** (`APPROVED`, `approved_by` popunjeno) — ovo je nepovratna granica ka javnoj objavi, isti obrazac kao fiskalizacija u M10 i komunikacija u M6/M14.
5. U zakazano vreme (`scheduled_publish_at`), sistem **automatski** objavljuje odobreni sadržaj na `target_channels` — ovo nije nova AI odluka (odluka je već doneta u koraku 4), već mehaničko izvršenje već odobrene radnje, isti princip kao automatski pozivi ka M4/M11.

### 3a. Atribucija rezervacije ka sadržaju (dopuna, avgust 2026 — zatvara M13 deo otvorenog pitanja "marketing performanse")

`tracking_code` (poglavlje 2.1) se dodaje kao `?ref=<tracking_code>` na svaki odlazni link ka M8 sajtu unutar objavljenog sadržaja (social post, email newsletter, banner). Sam M12 **ne prati** šta se posle klika dešava — to bi zahtevalo da M12 čita podatke rezervacije, kršeći granicu modula (princip #2). Umesto toga:

1. M8 hvata `?ref=` parametar pri dolasku posetioca i prosleđuje ga kroz sopstveni tok do trenutka kreiranja `Quote` (M8 poglavlje 3, dopuna; M5 `Quote.referral_tracking_code`, poglavlje 3.1 M5 specifikacije) — **sirov kod, bez validacije protiv M12** u tom trenutku; M5 ne zna niti mu je bitno da li kod uopšte postoji.
2. Kod se prenosi na `Booking.referral_tracking_code` pri potvrdi, isti obrazac prenošenja kao `channel`/`client_account_id` (M5 poglavlje 4).
3. **M13**, ne M5, razrešava kod ka stvarnom `ContentPiece` pri izgradnji sopstvene projekcije (M13 poglavlje 3.1, `FactBooking.referral_content_id`/`referral_content_name`) — poklapanje protiv `ContentPiece.tracking_code` u trenutku sinhronizacije, ne pri kreiranju rezervacije. Nepostojeći/pogrešno prekucan kod ostaje `null` u projekciji — sistem nikad ne izmišlja atribuciju.

Ovo drži M5 potpuno neosetljivim na M12 (samo prenosi string) i poštuje M13 poglavlje 1.1 (M13 gradi izvedenu projekciju, ne menja izvorne module) — isti princip "lenjo razrešavanje" kao ostatak M13 arhitekture.

### 3b. Opšte stranice sajta van kataloga (dopuna, avgust 2026 — zatvara M8 deo otvorenog pitanja)

`ContentPiece.type = STATIC_PAGE`/`BLOG_POST` sa popunjenim `slug` i `product_id = null` pokriva sadržaj koji ne pripada nijednom proizvodu (M8 poglavlje 6, dopuna) — "O nama", "Kontakt", blog članci. Isti tok odobrenja kao svaki drugi `ContentPiece` (poglavlje 3 iznad); jedina razlika je da `M8_SITE` kanal za ovaj tip servira stranicu na `/stranica/:slug` (`STATIC_PAGE`) ili `/blog/:slug` (`BLOG_POST`) umesto na ruti proizvoda.

### 3c. Označavanje AI generisanog vizuelnog sadržaja (YUTA preporuka, avgust 2026)

**Izvor:** YUTA okružnica članicama, avgust 2026, povodom početka primene (2. avgust 2026.) dela odredbi EU AI Act-a o obeležavanju AI generisanog sadržaja. Srbija nije članica EU pa odredba nije direktno pravno obavezujuća za TT, ali YUTA preporučuje članicama transparentno označavanje jer agencija posluje na digitalnom tržištu bez državnih granica (partneri iz EU, gosti iz EU, međunarodne platforme). Ovo je preporuka koju vlasnik prihvata kao internu politiku, ne otvoreno pravno pitanje koje čeka potvrdu — zato ide direktno u ovu specifikaciju, ne u `docs/analize/26-PRAVNA-I-KNJIGOVODSTVENA-OTVORENA-PITANJA.md`.

**Pravilo:** `ContentPiece` dobija novo polje `contains_ai_generated_media` (boolean, default `false`) — postavlja ga onaj ko kreira sadržaj (AI agent pri nacrtu ili čovek pri ručnom unosu) kad `body`/`media` sadrži fotografiju, ilustraciju ili video generisan veštačkom inteligencijom (npr. DALL-E/Midjourney-stil kreativni vizual za `BANNER`/`SOCIAL_POST`), **za razliku od** stvarne fotografije hotela/destinacije koja je samo AI-*izvučena* sa sajta dobavljača (M2 poglavlje 2.3a, `media.source = AI_IMPORTED`) — to nije sintetički sadržaj i ne podleže ovom pravilu.

Kad je `contains_ai_generated_media = true`:
- Objava na `APPROVE_PUBLISH` (poglavlje 3, korak 4) zahteva da `ContentTranslation.body` sadrži vidljivu oznaku transparentnosti na jeziku objave, npr. "Fotografija je generisana uz pomoć veštačke inteligencije (AI)." — čovek koji odobrava proverava prisustvo oznake, sistem ne generiše tekst automatski (izbor formulacije ostaje uređivački, ne mehanički).
- Sintetički AI vizuali se **ne koriste** kao zamena za stvarni prikaz smeštaja/destinacije/atrakcije u sadržaju vezanom za konkretan `product_id` (rizik dovođenja gosta u zabludu o stvarnom izgledu/kvalitetu usluge) — dozvoljeni su samo za ilustrativne/kreativne/promotivne vizuale bez `product_id` ili gde ne predstavljaju konkretnu uslugu (npr. generička destinacijska atmosfera, ne konkretna soba).

Ovo pravilo je interna politika TT po YUTA preporuci, ne zakonska obaveza u Srbiji — ako AI Act ili domaća regulativa kasnije to promene, ažurirati ovo poglavlje.

---

## 4. Distribucioni adapteri

Isti obrazac kao `ProviderAdapter` u M4 (poglavlje 2 te specifikacije), ali za marketinške kanale umesto dobavljača proizvoda — namerno poseban interfejs jer M4 je eksplicitno ograničen na "dobavljače turističkog proizvoda/inventara" (M4 specifikacija, poglavlje 1):

```
interface DistributionChannelAdapter {
  channelCode: string;              // npr. "facebook", "instagram", "email"
  publish(content: NormalizedContentPiece): Promise<{ externalPostId, publishedAt }>;
  unpublish(externalPostId: string): Promise<void>;
}
```

`M8_SITE` kanal ne treba pravi adapter — sadržaj se jednostavno čita direktno iz `ContentPiece`/`ContentTranslation` preko M2-stil API-ja, isto kao proizvodi (za `STATIC_PAGE`/`BLOG_POST`, preko `slug`, poglavlje 3b). `MOBILE_PUSH` takođe ne treba sopstveni adapter — poziva direktno M9 push mehanizam.

`EMAIL` kanal šalje samo `ClientAccount` zapisima (M6) sa `marketing_consent = true` — obavezna provera pre svakog slanja, u skladu sa poglavljem 9 Master dokumenta (Zakon o zaštiti podataka o ličnosti). Ako je `target_tags` popunjeno (dopuna avgust 2026, poglavlje 2.1), skup primalaca se dodatno filtrira na `ClientAccount`-e čiji `tags` (M6 poglavlje 2.1) preseca `target_tags` — čisto sužavanje, nikad proširenje van `marketing_consent = true` skupa.

Kredencijali svakog kanala (Facebook/Instagram API tokeni i sl.) čuvaju se enkriptovano, isti obrazac kao `ProviderConfig.auth_config_encrypted` u M4.

---

## 5. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M12/content/VIEW`, `CREATE_DRAFT` | Vlasnik, Direktor (i AI agent, nivo "Autonomno" — samo nacrt) |
| `M12/content/APPROVE_PUBLISH` | Vlasnik, Direktor — **nikad AI agent** |
| `M12/channel-config/VIEW`, `EDIT` | Vlasnik, Direktor |

Napomena: kao i kod M2/M3, među sedam osnovnih uloga ne postoji posebna "Marketing menadžer" uloga — ako se pokaže potreba, rešava se pojedinačnim izuzetkom (M1 `UserPermissionOverride`), ne čekajući novu ulogu.

---

## 6. Dopuna M2 specifikacije

U `03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` dodaje se: kad `Product.status` pređe u `ACTIVE` preko `/products/:id/publish`, M2 emituje Event Bus događaj `product.published` — ovo se dodaje direktno u taj dokument.

## 6a. Dopuna M5 specifikacije (avgust 2026, poglavlje 3a)

U `06-SPECIFIKACIJA-M5-REZERVACIJE.md` dodaje se: `Quote.referral_tracking_code` (string, nullable) — sirov kod prosleđen iz M8, bez validacije protiv M12; prenosi se na `Booking.referral_tracking_code` pri potvrdi, isti obrazac kao `channel`.

## 6b. Dopuna M8 specifikacije (avgust 2026, poglavlje 3b/3a)

U `10-SPECIFIKACIJA-M8-SAJT-B2C.md` dodaje se: rute `/stranica/:slug` i `/blog/:slug` (izvor: M12 `/content?type=STATIC_PAGE|BLOG_POST&slug=...`), i hvatanje `?ref=` parametra pri dolasku, proslediv do koraka kreiranja `Quote`.

## 6c. Dopuna M13 specifikacije (avgust 2026, poglavlje 3a)

U `13-SPECIFIKACIJA-M13-BI.md` dodaje se: `FactBooking.referral_content_id`/`referral_content_name`, razrešeno pri sinhronizaciji projekcije poklapanjem `Booking.referral_tracking_code` protiv `ContentPiece.tracking_code`; novi izveštaj "Marketing performanse" (M13 poglavlje 4.3).

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/marketing`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/content` | GET / POST | lista (kalendar = sortirano po `scheduled_publish_at`) / ručno kreiranje |
| `/content/:id` | GET / PATCH | |
| `/content/:id/approve` | POST | ljudsko odobrenje, zahteva `M12/content/APPROVE_PUBLISH` |
| `/content/:id/translations` | GET / PUT | |
| `/content/:id/media` | POST | `multipart/form-data`, polje `file` — slika/video (v1.5, poglavlje 2.5); zahteva `M12/content/CREATE_DRAFT`, odbija ako sadržaj nije `DRAFT`/`PENDING_APPROVAL` |
| `/content/media/:mediaId/download` | GET | zahteva `M12/content/VIEW` |
| `/content/media/:mediaId` | DELETE | zahteva `M12/content/CREATE_DRAFT`, ista granica statusa kao upload |
| `/channels` | GET / POST / PATCH | konfiguracija distribucionih kanala |
| `/public/content` | GET | **bez autentikacije** (dopuna avgust 2026) — `?type=STATIC_PAGE\|BLOG_POST&slug=...&lang=...`, vraća samo `status=PUBLISHED` sadržaj koji ima `M8_SITE` u `target_channels`; inače `404`. Namena: M8 `/stranica/:slug`, `/blog/:slug` (poglavlje 3b) |

---

## 8. Izlazni kriterijum (M12 deo Faze 6)

- [x] Objava proizvoda u M2 automatski generiše nacrt sadržaja u M12, bez ljudske intervencije do koraka odobrenja. (`M12EventSubscribersService` na `product.published`, `ContentService.createAiDraft` — `PENDING_APPROVAL`/`generated_by=AI`; testirano `test/m12-exit-criteria.e2e-spec.ts`)
- [x] Sadržaj se ne može objaviti (`PUBLISHED`) bez `approved_by` popunjenog ljudskim nalogom. (`ContentService.publish` zahteva prethodni `APPROVED` status, koji jedino `approve()` postavlja uz `approved_by`)
- [x] Email kanal nikad ne šalje `ClientAccount`-ima bez `marketing_consent = true`; kad je `target_tags` popunjeno, skup se dodatno suzi na poklapajuće `tags`, nikad ne proširi. (`DistributionService.publishEmail` preko M6 `findMarketingRecipients`)
- [x] Zakazana objava odobrenog sadržaja radi automatski u planirano vreme. (`ContentPublishSchedulerService`, `@Cron(EVERY_MINUTE)` → `ContentService.publishDueContent`)
- [x] `STATIC_PAGE`/`BLOG_POST` sa istim `slug` se ne može kreirati dvaput (unique). (DB `@unique` + eksplicitna provera u servisu, `409 Conflict`)
- [x] `tracking_code` se automatski generiše pri kreiranju i jedinstven je kroz sve `ContentPiece` zapise. (`generateTrackingCode`, kolizija proverena pre upisa)
- [x] Rezervacija sa `Booking.referral_tracking_code` koji poklapa postojeći `ContentPiece.tracking_code` ispravno popunjava `FactBooking.referral_content_id` u M13 projekciji; nepostojeći kod ostaje `null`, ne pogrešnu vrednost. (`FactSyncService.resolveContentAttribution` → `ContentService.findByTrackingCode`)
- [x] `ContentPiece` sa `contains_ai_generated_media = true` ne može preći u `APPROVED`/`PUBLISHED` bez vidljive oznake transparentnosti u `body` jezika objave (poglavlje 3c). (`hasAiTransparencyMarker` regex provera u `approve()`; dodatno, `BANNER` vezan za `product_id` je uvek odbijen kao proksi-provera drugog pravila §3c — dokumentovano u kodu)
- [x] M8 zavisne stavke (poglavlje 3b/3a) — javan endpoint gotov: `GET /marketing/public/content` servira samo `PUBLISHED` sadržaj sa `M8_SITE` kanalom (`PublicContentController`/`ContentService.findPublishedBySlug`, testirano `test/m12-exit-criteria.e2e-spec.ts`, §8 stavka 9). M8 `/stranica/:slug`, `/blog/:slug` stranice i hvatanje `?ref=` implementirani na M8 strani (M8 spec verzija koja sledi ovu).

---

## 9. Otvoreno za dalje

- Tačan izbor društvenih mreža/kanala za lansiranje (Facebook/Instagram/drugo) — potvrditi pre implementacije konkretnih adaptera.
- Ako se pronađe raniji "Content Engine" predlog pomenut u Master dokumentu, uporediti i uskladiti sa ovim dokumentom, isto upozorenje kao u M4 specifikaciji.
- **Puna analitika angažovanosti sa platformi** (impressions/klikovi/lajkovi sa Facebook/Instagram, stopa otvaranja mejla) — namerno van obima ove dopune (poglavlje 3a pokriva samo atribuciju ka rezervaciji, ne engagement metrike); zahtevalo bi da svaki `DistributionChannelAdapter` povlači metrike nazad sa platforme, poseban posao, dodaje se ako se pokaže stvarna potreba.
