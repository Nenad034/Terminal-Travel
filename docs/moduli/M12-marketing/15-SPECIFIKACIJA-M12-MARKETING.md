# Specifikacija modula M12 — Marketing i sadržajni engine

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M12) i poglavlje 8 (Faza 6)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje (pisano od nule — "Content Engine opisan u prethodnom razgovoru", pomenut u Master dokumentu, nije pronađen u ovom folderu, isti slučaj kao M4)
**Verzija:** 1.0
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
| product_id | UUID, nullable (FK → M2) | ako je sadržaj vezan za konkretan proizvod |
| type | enum: `BLOG_POST`, `SOCIAL_POST`, `EMAIL_NEWSLETTER`, `BANNER` | |
| status | enum: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PUBLISHED`, `REJECTED` | `APPROVED → PUBLISHED` je automatsko u zakazano vreme, tek nakon ljudskog odobrenja |
| target_channels | niz enum: `M8_SITE`, `FACEBOOK`, `INSTAGRAM`, `EMAIL`, `MOBILE_PUSH` *(dodato pri specifikaciji M19)* | `MOBILE_PUSH` koristi već postojeći mehanizam push notifikacija iz M9 (M9 specifikacija, poglavlje 5), ne novu infrastrukturu |
| scheduled_publish_at | timestamp, nullable | kalendar — sortiranje po ovom polju daje prikaz kalendara, bez posebnog entiteta |
| generated_by | enum: `AI`, `HUMAN` | |
| approved_by | UUID, nullable (FK → M1 User) | **obavezno pre `PUBLISHED`, nikad AI** |
| published_at | timestamp, nullable | |
| created_at / updated_at | timestamp | |

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

`M8_SITE` kanal ne treba pravi adapter — sadržaj se jednostavno čita direktno iz `ContentPiece`/`ContentTranslation` preko M2-stil API-ja, isto kao proizvodi. `MOBILE_PUSH` takođe ne treba sopstveni adapter — poziva direktno M9 push mehanizam.

`EMAIL` kanal šalje samo `ClientAccount` zapisima (M6) sa `marketing_consent = true` — obavezna provera pre svakog slanja, u skladu sa poglavljem 9 Master dokumenta (Zakon o zaštiti podataka o ličnosti).

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

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/marketing`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/content` | GET / POST | lista (kalendar = sortirano po `scheduled_publish_at`) / ručno kreiranje |
| `/content/:id` | GET / PATCH | |
| `/content/:id/approve` | POST | ljudsko odobrenje, zahteva `M12/content/APPROVE_PUBLISH` |
| `/content/:id/translations` | GET / PUT | |
| `/channels` | GET / POST / PATCH | konfiguracija distribucionih kanala |

---

## 8. Izlazni kriterijum (M12 deo Faze 6)

- [ ] Objava proizvoda u M2 automatski generiše nacrt sadržaja u M12, bez ljudske intervencije do koraka odobrenja.
- [ ] Sadržaj se ne može objaviti (`PUBLISHED`) bez `approved_by` popunjenog ljudskim nalogom.
- [ ] Email kanal nikad ne šalje `ClientAccount`-ima bez `marketing_consent = true`.
- [ ] Zakazana objava odobrenog sadržaja radi automatski u planirano vreme.

---

## 9. Otvoreno za dalje

- Tačan izbor društvenih mreža/kanala za lansiranje (Facebook/Instagram/drugo) — potvrditi pre implementacije konkretnih adaptera.
- Ako se pronađe raniji "Content Engine" predlog pomenut u Master dokumentu, uporediti i uskladiti sa ovim dokumentom, isto upozorenje kao u M4 specifikaciji.
