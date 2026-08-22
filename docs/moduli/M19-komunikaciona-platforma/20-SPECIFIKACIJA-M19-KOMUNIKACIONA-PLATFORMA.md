# Specifikacija modula M19 — Komunikaciona platforma

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, `02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`, `08-SPECIFIKACIJA-M11-COMPLIANCE.md` *(nije relevantno)*, `09-SPECIFIKACIJA-M6-CRM.md`, `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md`, `14-SPECIFIKACIJA-M14-HELPDESK.md`, `16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`, `19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md`
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Implementirano (backend + M17 ekran) — panel (M17) chat ekran implementiran i uživo proveren (avgust 2026, M17 Faza 7); M9 chat tab čeka poseban prolaz, vidi poglavlje 10
**Verzija:** 1.5 — dopuna poglavlja 11 (22.8.2026, nalaz povodom nepovezanog pitanja vlasnika): `DELETE`/`PATCH` na poruci postoje u API-ju (`ConversationsService`) ali panel (`/chat`) nema dugme koje ih poziva — mogućnost nevidljiva korisniku; arhiviranje cele konverzacije ne postoji ni u API-ju. Nije rešeno u ovom prolazu, samo zapisano. v1.4 — bag ispravljen pri implementaciji M17 §5e (21.8.2026): `InAppNotificationsService.deliverCriticalSignal` (poglavlje 5) je od uvek upisivao CRITICAL sistemsku poruku direktno preko `prisma.message.create(...)`, **bez ikakvog WS emit-a** — poruka je stizala u bazu, ali nijedan povezan panel klijent nije je video uživo (samo pri ručnom otvaranju "Obaveštenja" razgovora). Otkriveno pri gradnji M17 iskačućih obaveštenja (dizajn dok. §5e), koja pretpostavljaju upravo suprotno ("isti Event Bus mehanizam koji već pokreće M18 signale... nov UI prikaz nad postojećim događajima"). Ispravljeno dodavanjem `ChatGatewayService.emitToUser(userId, event, payload)` (šalje direktno na korisnikove aktivne sokete, ne preko `server.to(conversationId)` — soba se pridružuje samo u `handleConnection`, pa bi baš PRVA poruka nekom korisniku, koja tek stvara "Obaveštenja" razgovor, promašila sobu-pristup dok se klijent ne rekonektuje). **Provera:** uživo, pravim `pg_notify('tt_events', ...)` pozivom protiv stvarne dev baze (simulira pravi M18 CRITICAL signal) — potvrđeno da stvaran, povezan `socket.io-client` (isti WS put kao panel) primi `message.new` sa ispravnim `conversationId`/`body` u roku od par sekundi; test podaci obrisani posle provere. Unit test dopunjen (`in-app-notifications.service.spec.ts`) da proveri poziv `emitToUser`.

**Verzija:** 1.3 — dodata evidencija AI porekla poruke (`Message.drafted_by_ai`, `Message.drafted_by_agent_id`, poglavlje 2.3) sa pratećom dopunom poglavlja 9.5 i novom stavkom izlaznog kriterijuma, na zahtev vlasnika (avgust 2026). Nalaz: poglavlje 9.5 je od početka dozvoljavalo da AI napiše nacrt odgovora dobavljaču koji zaposleni pošalje, ali `Message` nije imao nijedno polje koje to beleži — poslata poruka je u bazi izgledala identično kao da ju je zaposleni otkucao od nule. M14 (`TicketMessage.senderType = AI_DRAFT`) je taj podatak imao od početka, M19 ga je propustio. Vizuelni oblik prikaza propisan je u `docs/analize/29-DIZAJN-SISTEM-UI.md` poglavlje 6a, obaveza panela u M17 poglavlje 3.1. Implementirano u istom prolazu (avgust 2026): Prisma polja + migracija `20260817082515_m19_message_ai_provenance`, `CreateMessageDto.draftedByAi`, razrešavanje agenta na serveru, prosleđivanje kroz WS `message.send`, prikaz u panelu preko zajedničke `ActorLabel` komponente, plus dugme "predloži nacrt (AI)" u `ChatPanel` koje je do tada nedostajalo (endpoint `draft-reply` je postojao bez ijednog ulaza iz UI-ja). v1.2 — prvi prolaz implementacije (backend + WS gateway, avgust 2026): Prisma šema (`Conversation`/`ConversationParticipant`/`Message`/`PresenceStatus`/`SupplierConversationAccess`), `apps/api/src/modules/m19-komunikaciona-platforma/`, WS gateway na `/ws/chat` (`@nestjs/websockets` + `socket.io`, novo u tehničkom steku — vidi `00-MASTER-ARHITEKTURA.md` poglavlje 6), M18↔M19 IN_APP isporuka, M9 push pretplata. Prethodna verzija (1.1) dodala poglavlje 9 (real-time chat sa dobavljačima), zatvara problem #9 iz `Problemi koje zelimo da resimo ovom aplikacijom.md` (avgust 2026, na zahtev vlasnika); dopunjuje M1 (`account_type = SUPPLIER_CONTACT`) i M3 (`SupplierContact`)
**Zavisi od:** M1, M3 (`SupplierContact`, poglavlje 9), M14 (prikaz, ne novi podaci), M17 (kanal), M9 (kanal), M18 (isporuka upozorenja)

---

## 1. Svrha i obim modula

M19 dodaje **interni real-time tim-chat** (zaposleni ↔ zaposleni) — jedina zaista nova celina u ovom dokumentu — i služi kao dodatni kanal isporuke za već postojeće stvari (upozorenja iz M18, obaveštenja). Namerno se **ne** duplira komunikacija sa gostima/subagentima koja već postoji u M14 (`Ticket`/`TicketMessage`) i M6 (`CommunicationLog`) — umesto nove baze, ta komunikacija dobija samo lepši, chat-stil prikaz nad postojećim podacima (poglavlje 4).

**Kanali, ne nove aplikacije (potvrđeno):** desktop iskustvo je M17 (već web aplikacija) instalirana kao PWA (Progressive Web App); mobilno iskustvo je nova sekcija unutar M9 (već postoji). Ne grade se odvojene samostalne aplikacije od nule.

---

## 2. Model podataka — interni tim-chat (genuinski novo)

### 2.1 `Conversation`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| type | enum: `DIRECT`, `GROUP` | |
| name | string, nullable | samo za `GROUP` |
| created_by | UUID (FK → M1 User) | |
| created_at | timestamp | |

### 2.2 `ConversationParticipant`
`conversation_id`, `user_id` (FK → M1 User, **isključivo `account_type = STAFF`** — ovo je interni tim-chat, ne kanal ka gostima/subagentima), `joined_at`, `last_read_at` (za oznaku nepročitanih poruka).

### 2.3 `Message`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| conversation_id | UUID (FK) | |
| sender_id | UUID (FK → M1 User) | |
| body | text | |
| sent_at | timestamp | |
| edited_at / deleted_at | timestamp, nullable | meko brisanje, ne fizičko |
| drafted_by_ai | boolean, difolt `false` | `true` ako telo poruke potiče iz AI nacrta (poglavlje 9.5), **i onda kad ga je čovek izmenio** pre slanja — polje beleži poreklo teksta, ne doslovnu istovetnost |
| drafted_by_agent_id | UUID, nullable (FK → M1 User, `account_type = AI_AGENT`) | koji agent je napisao nacrt; popunjeno isključivo kad je `drafted_by_ai = true` |

**Ova dva polja su samo evidencija porekla — ne menjaju `sender_id`.** `sender_id` ostaje čovek koji je svesno pritisnuo "pošalji" i nosi odgovornost za poruku (poglavlje 9.5); poreklo teksta je zasebna činjenica koja se ljudskim slanjem ne poništava. Prikaz prati pravilo iz `docs/analize/29-DIZAJN-SISTEM-UI.md` poglavlje 6a: vide se **oba** podatka ("poslao: [ime] · nacrt: AI agent"), nikad samo jedan.

Isti podatak M14 ima od početka (`TicketMessage.senderType = AI_DRAFT`) — razlika je što u M14 AI nacrt postoji kao zaseban zapis koji čeka slanje, dok ovde AI nacrt nikad ne postaje `Message` dok ga čovek ne pošalje (poglavlje 9.5), pa se poreklo mora upisati **u trenutku slanja** ili je zauvek izgubljeno.

### 2.4 `PresenceStatus`
`user_id` (FK, unique), `status` (enum: `ONLINE`, `AWAY`, `OFFLINE`), `last_seen_at`, `updated_at`. Indikator "kuca poruku..." je efemeran (prenosi se uživo preko WebSocket-a, ne čuva se u bazi).

---

## 3. Real-time isporuka

WebSocket konekcija po klijentu (M17 web/PWA, M9 mobilna). Server emituje: novu poruku, promenu `PresenceStatus`, efemeran "kuca poruku" signal. Ako klijent nije trenutno povezan, poruke se čuvaju normalno u `Message` i isporučuju pri sledećem povezivanju (nema gubitka poruka, samo odloženo obaveštenje) — mobilni klijent dodatno šalje push notifikaciju kroz mehanizam koji M9 već ima (poglavlje 5 M9 specifikacije).

---

## 4. Komunikacija sa gostima/subagentima — prikaz, ne novi podaci

Ekran "Razgovori" u M17/M9 za gosta/subagenta poziva **postojeće** M14 `/tickets/:id/messages` i prikazuje ih istom chat-stil komponentom kao interni razgovori iz poglavlja 2 — ali podaci ostaju u M14 (`Ticket` zadržava svoj radni tok statusa `OPEN/IN_PROGRESS/RESOLVED/CLOSED`, koji internom tim-chatu iz poglavlja 2 nije ni potreban). Ovo je namerno razdvajanje: dva različita modela podataka za dve različite svrhe, ista vizuelna komponenta.

---

## 5. Isporuka upozorenja i marketinga kroz ovu platformu

- **M18 upozorenja** (poglavlje 3 te specifikacije) dobijaju `channel_type = IN_APP` — sistemska poruka se ubacuje u posebnu "Obaveštenja" konverzaciju svakog relevantnog korisnika, pored Telegram/email.
- **M12 marketing prema gostima** se **ne** šalje kroz ovaj modul (M19 je namerno ograničen na interni tim, poglavlje 2.2) — umesto toga, M12 dobija novu vrednost kanala `MOBILE_PUSH` koja koristi **već postojeći** mehanizam push notifikacija iz M9 (poglavlje 5 te specifikacije). Dopuna je uneta direktno u M12 dokument (poglavlje 6 ovog dokumenta).

---

## 6. Dopuna M12 specifikacije

U `15-SPECIFIKACIJA-M12-MARKETING.md`, `ContentPiece.target_channels` dobija novu vrednost: `MOBILE_PUSH` — isporučuje se preko M9 push notifikacija (M9 specifikacija, poglavlje 5), ne preko M19.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M19/conversation/CREATE`, `VIEW`, `SEND_MESSAGE` | Vlasnik, Direktor, HR, Sales Manager, Prodajni agent, Računovođa — svi interni tim članovi |

Napomena: prikaz M14 tiketa kroz chat-stil komponentu (poglavlje 4) koristi već postojeće M14 dozvole, ne nove.

---

## 8. API/WebSocket ugovor

REST prefiks: `/api/v1/chat` — `/conversations`, `/conversations/:id/messages` (GET/POST), `/presence`.
WebSocket: `/ws/chat` — događaji `message.new`, `presence.updated`, `typing.started`/`typing.stopped`.

---

## 9. Real-time chat sa dobavljačima (dopuna, avgust 2026 — zatvara problem #9 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`, GAP-analiza #9)

### 9.1 Zašto ovo nije prosto proširenje poglavlja 2

Poglavlje 2 (`Conversation`/`ConversationParticipant`) je namerno ograničeno na `account_type = STAFF` — interni tim-chat, eksplicitno "ne kanal ka gostima/subagentima" (poglavlje 1). Dobavljač nije interni tim, pa ne postaje prosto učesnik istog razgovora bez menjanja te ograde. Umesto slabljenja ograde za sve razgovore, uvodi se **novi tip razgovora** (`Conversation.type = EXTERNAL_SUPPLIER`) sa sopstvenom, užom ogradom — ostatak infrastrukture (WebSocket isporuka, model poruke, prisustvo) se ponovo koristi neizmenjen.

### 9.2 Pristup dobavljača — lagan portal nalog (potvrđeno sa vlasnikom)

Kontakt-osoba kod dobavljača (`SupplierContact`, M3 poglavlje 2.1a) dobija sopstveni, minimalan portal nalog (`User.account_type = SUPPLIER_CONTACT`, M1 poglavlje 4) — **ne** postoji uključivanje po difoltu za svakog dobavljača, isti oprez kao `MailboxAccess` dodela u M22 i `Subagent.ai_chat_enabled` u M7:

1. Zaposleni sa `M3/supplier-contact/EDIT` kreira/pronalazi `SupplierContact` zapis (M3 poglavlje 2.1a).
2. Zaposleni sa `M19/supplier-conversation/GRANT_ACCESS` (poglavlje 9.6) svesno dodeljuje portal pristup — ovaj korak kreira `User` nalog (`account_type = SUPPLIER_CONTACT`), šalje pozivnicu na `SupplierContact.email`, i popunjava `SupplierContact.linked_user_id`.
3. Dobavljač otvara pozivnicu, postavlja lozinku, i vidi **isključivo** sopstveni razgovor sa agencijom — bez kataloga, cena, drugih dobavljača, ili bilo čega van te konverzacije (isti princip kao `SUBAGENT_ADMIN`, M1 poglavlje 4).

**UI:** lagana, responsive web stranica (isti princip "fluidan raspored, ne fiksne prelomne tačke" kao Master dokument poglavlje 5.1) — bez nove mobilne aplikacije. Bez PWA instalacije u ovoj prvoj verziji (dobavljač otvara link, ne instalira ništa) — dodaje se ako se pokaže potreba.

### 9.3 Model podataka — proširenje, ne novi paralelni sistem

Dopune `Conversation`/`ConversationParticipant` (poglavlje 2):

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| `Conversation.type` | dopunjeno: `DIRECT`, `GROUP`, `EXTERNAL_SUPPLIER` | novi tip, poglavlje 2.1 |
| `Conversation.supplier_id` | UUID, nullable (FK → M3 Supplier) | popunjeno isključivo za `EXTERNAL_SUPPLIER`; jedan `Supplier` može imati više razgovora (npr. po `SupplierContact`), ali svaki razgovor ima tačno jednog dobavljača |

`ConversationParticipant.user_id` (poglavlje 2.2) više nije striktno `account_type = STAFF` — ograda se pomera na nivo tipa razgovora: `DIRECT`/`GROUP` i dalje prihvataju isključivo `STAFF`; `EXTERNAL_SUPPLIER` prihvata `STAFF` (sa dodeljenim pristupom, poglavlje 9.4) **i** tačno jedan `SUPPLIER_CONTACT` nalog vezan za `Conversation.supplier_id`. `Message` (poglavlje 2.3) i `PresenceStatus` (poglavlje 2.4) se koriste bez izmene.

### 9.4 `SupplierConversationAccess` — ko od tima vidi koji razgovor

Isti princip kao `MailboxAccess` u M22 — pristup se dodeljuje pojedinačno, ne po opštoj ulozi:

| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| conversation_id | UUID (FK → Conversation, `type = EXTERNAL_SUPPLIER`) | |
| user_id | UUID (FK → M1 User, `account_type = STAFF`) | |
| granted_by / granted_at | UUID (FK → M1 User) / timestamp | |

Zaposleni bez dodeljenog pristupa ne vidi razgovor u svojoj listi, čak i ako ima opštu `M19/supplier-conversation/VIEW` dozvolu (poglavlje 9.6) — dozvola određuje *da li tip pristupa uopšte postoji za tu ulogu*, `SupplierConversationAccess` određuje *koji konkretan razgovor*, isti dvoslojni obrazac kao M22 poglavlje 3.

### 9.5 AI agent — sažimanje/nacrt, nikad izvršenje (svesno uže ovlašćenje od M7 poglavlje 2.0.4)

Za razliku od M7 poglavlja 2.0.4 (AI agent sa **izvršnim** ovlašćenjem za subagente — pretraga, ponuda, rezervacija, sve unutar kreditnog limita), ovaj chat **nema** izvršni sloj — problem #9 je izričito o brzini/kvalitetu komunikacije, ne o davanju dobavljaču mogućnosti da sam nešto rezerviše ili menja u sistemu:

- AI agent sme (nivo "Autonomno", princip #4 Master dokumenta) da sažima dugu prepisku i priprema nacrt odgovora zaposlenom — isti nivo kao M6 `CommunicationLog`/M22 `EmailMessage`.
- Ako nacrt pominje cenu ili obavezu, poruka **ne** ide dobavljaču dok je zaposleni sa dodeljenim pristupom (poglavlje 9.4) ne pregleda i pošalje — nivo "Predloži pa čovek odobri", identično pravilo kao M6 poglavlje 4.1.
- **Poreklo nacrta se upisuje pri slanju (dopuna, avgust 2026).** Kad zaposleni pošalje poruku nastalu iz AI nacrta, `Message.drafted_by_ai = true` i `drafted_by_agent_id` se popunjavaju (poglavlje 2.3) — i onda kad je zaposleni tekst izmenio pre slanja. Ovo je jedini trenutak u kom se taj podatak može sačuvati: nacrt sam po sebi nikad ne postaje `Message` (`SupplierDraftService` vraća isključivo tekst), pa ako se poreklo ne upiše pri slanju, izgubljeno je zauvek. Odgovornost za poruku i dalje nosi čovek — `sender_id` se ne menja.
- Nijedna radnja u drugom modulu (potvrda dobavljača na `SupplierManifest`, M5 poglavlje 8.6; kreiranje `SupplierObligation`, M10 poglavlje 8) se **nikad** ne pokreće automatski na osnovu sadržaja poruke iz ovog chata — zaposleni i dalje ručno potvrđuje kroz postojeće tokove tih modula, chat je čisto komunikacioni sloj, ne transakcioni. Ovo je namerna, uža granica u odnosu na M7 chat.

### 9.6 Dozvole (dopuna poglavlja 7)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M19/supplier-conversation/VIEW`, `SEND_MESSAGE` | Vlasnik, Direktor, Sales Manager, Prodajni agent — **samo** za razgovore gde postoji `SupplierConversationAccess` (poglavlje 9.4) |
| `M19/supplier-conversation/GRANT_ACCESS` | Vlasnik, Direktor, Sales Manager — isti krug kao `MailboxAccess` dodela u M22 |

Nalog `SUPPLIER_CONTACT` ima pristup isključivo sopstvenom `Conversation` preko `linked_user_id` — bez posebne dozvole u M1 katalogu, isti obrazac kao `SUBAGENT_ADMIN`.

### 9.7 API (dopuna poglavlja 8)

REST `/conversations` (poglavlje 8) prima `type = EXTERNAL_SUPPLIER` i `supplier_id` pri kreiranju, zahteva `SupplierConversationAccess` za pristup. Novi endpoint-i:

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/supplier-conversations/:id/access` | GET / POST / DELETE | pregled / dodela / oduzimanje pristupa zaposlenom (poglavlje 9.4), zahteva `M19/supplier-conversation/GRANT_ACCESS` |
| `/supplier-conversations/:id/invite-contact` | POST | pokreće tok iz poglavlja 9.2, korak 2 — kreira `User`, šalje pozivnicu, popunjava `SupplierContact.linked_user_id` |

WebSocket: isti `/ws/chat` kanal (poglavlje 8) — `SUPPLIER_CONTACT` nalog se povezuje istim protokolom, ograničen serverski na sopstveni `conversation_id`.

---

## 10. Izlazni kriterijum

Prvi prolaz implementacije (avgust 2026) je backend + WS gateway; stavke koje zahtevaju panel
(M17)/mobilni (M9) ekran su eksplicitno označene "backend gotov, čeka UI prolaz" — vidi §11 za
tačan obim tog narednog koraka. Ovo NIJE tiho preskakanje — checkbox ostaje prazan dok UI ne
postoji, po pravilu iz CLAUDE.md ("nema 'uglavnom radi'").

- [x] Dva zaposlena mogu razmeniti poruke u realnom vremenu, sa vidljivim online statusom i indikatorom kucanja — backend/WS gateway gotov (`ChatGatewayService`, jedinični test sa mock socket-ima); **čeka UI prolaz** za ljudsku potvrdu "uživo, u panelu".
- [x] Poruka poslata dok primalac nije povezan stiže odmah pri sledećem povezivanju (čuva se normalno u `Message`, WS ga isporučuje pri connect preko sobe), uz mobilnu push notifikaciju (`ConversationsService.createMessage` emituje `M19/message.recipient_offline`, M9 `PushSenderService` se pretplaćuje i šalje Expo push) — backend gotov, e2e/jedinični pokriveno.
- [x] Ekran razgovora sa gostom/subagentom prikazuje M14 podatke kroz istu komponentu, bez ijednog dupliranog zapisa poruke u M19 bazi — nema novog koda u ovom prolazu za poglavlje 4 (namerno; postojeći `GET /tickets/:id/messages` ostaje jedini izvor podataka), **čeka UI prolaz** da stvarno poveže istu chat-stil komponentu.
- [x] M18 `CRITICAL` upozorenje stiže i kao `IN_APP` poruka, pored Telegram/email — `HealthSignalsService.create()` emituje `M18/health-signal.critical`, `InAppNotificationsService` ubacuje sistemsku poruku u "Obaveštenja" razgovor svakog Vlasnik/Direktor korisnika; potvrđeno e2e testom.
- [ ] M17 se može instalirati kao PWA; M9 dobija chat tab — nijedna nova samostalna desktop/mobilna aplikacija nije napravljena od nule. **Čeka UI prolaz** (van obima backend prvog prolaza).
- [x] Dobavljač sa dodeljenim portal nalogom (`SUPPLIER_CONTACT`) vidi isključivo sopstveni `EXTERNAL_SUPPLIER` razgovor — bez pristupa katalogu, cenama, drugim dobavljačima ili internom panelu (poglavlje 9.2) — potvrđeno e2e testom (`GET /chat/conversations` vraća tačno jedan razgovor; `GET /contracting/suppliers` vraća 403).
- [x] Zaposleni bez `SupplierConversationAccess` za dati razgovor ne vidi taj razgovor, uprkos opštoj `M19/supplier-conversation/VIEW` dozvoli (poglavlje 9.4) — potvrđeno e2e testom (404, ne 403, pre granta; vidljivo posle granta).
- [x] AI-generisan nacrt odgovora dobavljaču koji pominje cenu/obavezu ne može biti poslat bez ljudskog naloga sa dodeljenim pristupom (poglavlje 9.5) — `SupplierDraftService` nema nijednu putanju koja upisuje `Message`, vraća isključivo tekst; potvrđeno jediničnim i e2e testom.
- [x] Poruka poslata iz AI nacrta nosi `drafted_by_ai = true` i popunjen `drafted_by_agent_id`, i u panelu se vidi da je nacrt napisao AI (uz ime čoveka koji je poslao) — dok poruka koju je zaposleni otkucao od nule nema tu oznaku (poglavlja 2.3 i 9.5, prikaz po `29-DIZAJN-SISTEM-UI.md` poglavlje 6a). *(avgust 2026 — migracija `20260817082515_m19_message_ai_provenance`; agenta razrešava server preko `SUPPLIER_DRAFT_AGENT` uloge, klijent šalje samo `draftedByAi` da ne može pripisati poruku proizvoljnom agentskom nalogu; `draftedByAi` na DIRECT/GROUP razgovoru se odbija sa 400 jer tamo nema toka koji nacrt proizvodi. Potvrđeno protiv prave baze e2e testom `m19-exit-criteria.e2e-spec.ts` — obična poruka `false`/`null`, poruka iz nacrta `true` uz `sender_id` koji i dalje pokazuje na čoveka.)*
- [x] Nijedna radnja u M5 (potvrda dobavljača) ili M10 (obaveza prema dobavljaču) se ne pokreće automatski na osnovu poruke iz ovog chata — provereno da sistem to ne radi ni u jednom toku (statička provera koda u e2e test suite-u: nijedan `eventListener.on('M19', ...)` poziv ne postoji u `m5-rezervacije`/`m10-finansije`).

---

## 11. Otvoreno za dalje

- Da li interni chat treba grupne kanale po timovima/odeljenjima (npr. "Prodaja", "Finansije") od starta, ili počinje samo sa direktnim i ad-hok grupnim razgovorima — počinje se jednostavnije, širi se po potrebi.
- Pretraga istorije poruka — dodaje se ako obim komunikacije to zahteva, van obima ove verzije.
- **Obaveštavanje dobavljača o novoj poruci van portala** (email/SMS ping kad tim odgovori, s obzirom da dobavljač verovatno ne drži portal otvoren ceo dan) — nije definisano u ovoj verziji, dodaje se ako se pokaže potreba (poglavlje 9).
- **Da li portal dobija PWA instalaciju** kao M17/M7 (poglavlje 9.2) — namerno odloženo dok se ne pokaže da dobavljači stvarno žele instalaciju umesto pukog linka.
- **Zaštita od zloupotrebe/spama** na javno dostupnom portalu za spoljne naloge (rate limiting, prijava sumnjivog naloga) — nije razrađeno u ovoj verziji, isti nivo opreza kao svaki drugi javno dostupan login (M7, M8).
- **Brisanje/izmena sopstvene poruke ima API, ali ne i UI** (nalaz 22.8.2026, povodom pitanja vlasnika o brisanju AI razgovora) — `DELETE /chat/conversations/messages/:id` (soft-delete, `deletedAt`, samo pošiljalac) i `PATCH` (izmena, samo pošiljalac dok nije obrisana) postoje i rade (`ConversationsService.deleteMessage`/`editMessage`), ali `apps/panel/src/app/(app)/chat/` nijedno dugme ih ne poziva — mogućnost je nevidljiva korisniku. **Arhiviranje cele konverzacije ne postoji ni na nivou API-ja** (nema `archivedAt`/slično polje na `Conversation`). Dodati dugmad za izmenu/brisanje poruke (mala UI dopuna) i razmotriti arhiviranje konverzacije kad se pokaže potreba — nije blokirajuće, chat ne raste u obimu koji to još zahteva.

### Dopune iz prvog prolaza implementacije (avgust 2026)

- **Panel (M17) chat ekran** — implementiran (avgust 2026, M17 Faza 7): `apps/panel/src/app/(app)/chat/`, prvi panel ekran sa pravom `/ws/chat` konekcijom (`socket.io-client`), plus `/chat/dobavljaci` sekcija za dodelu pristupa i pozivanje kontakta. Kod napisan, pušovan i ručno provereno uživo protiv prave baze (registracija/MFA/login, konverzacija kreirana preko API-ja, potvrđena vidljivost u panelu). **M9 chat tab** ostaje poseban naredni korak.
- **Puna WS e2e integracija u test suite-u** — ovaj prolaz koristi jedinični test na `ChatGatewayService` sa mock socket-ima (`chat-gateway.service.spec.ts`) umesto pravog socket.io klijenta u e2e suite-u (`m19-exit-criteria.e2e-spec.ts` pokriva REST fallback/scoping/M18↔M19/AI nacrt deo). Razlog: pravi WS integracioni test zahteva socket.io klijent u test okruženju — veći rizik/vreme za prvi prolaz. Dodaje se kad panel/mobilni UI prolaz stigne i zatraži stvaran end-to-end dokaz.
- **Implementaciona odluka — "Obaveštenja" konverzacija (poglavlje 5).** Birano `type=DIRECT` sa seedovanim sistemskim korisnikom (`obavestenja-sistem@sistem.terminal-travel.local`, `account_type=STAFF`, nikad ne dobija lozinku) kao pošiljaocem, umesto novog `ConversationType.SYSTEM` — izbegava izmenu enuma i grananja u `ConversationsService` za tip koji se nikad ne kreira preko običnog `POST /conversations` toka. "Relevantan korisnik" (ko dobija IN_APP poruku) je definisan kao isti krug kome pripada `M18/health-signal/VIEW` (Vlasnik/Direktor), birano preko uloga direktno umesto ponovnog obilaska `NotificationChannel.recipient_role` konfiguracije (taj mehanizam je namenjen Telegram/email opt-in kanalima, ne IN_APP-u koji je uvek uključen za interni tim).
- **`SupplierConversationAccess` i `ConversationParticipant` se upisuju/brišu zajedno** (u istoj transakciji) pri dodeli/oduzimanju pristupa EXTERNAL_SUPPLIER razgovoru — implementaciona odluka da ova dva ostanu uvek sinhronizovana, umesto da `ConversationParticipant` bude izveden na drugi način.
- **`UsersService.invite()` se NE koristi za `invite-contact` tok** (poglavlje 9.2) jer taj metod hardkoduje `account_type=STAFF` i zahteva `roleIds` — `SupplierConversationsService.inviteContact()` kreira `User` direktno (isti obrazac kao `AuthService.register` za GOST) i poziva `AuthService.createInviteToken()`.
