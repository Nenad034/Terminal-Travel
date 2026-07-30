# Specifikacija modula M19 — Komunikaciona platforma

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, `02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`, `08-SPECIFIKACIJA-M11-COMPLIANCE.md` *(nije relevantno)*, `09-SPECIFIKACIJA-M6-CRM.md`, `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md`, `14-SPECIFIKACIJA-M14-HELPDESK.md`, `16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`, `19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md`
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M14 (prikaz, ne novi podaci), M17 (kanal), M9 (kanal), M18 (isporuka upozorenja)

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

## 9. Izlazni kriterijum

- [ ] Dva zaposlena mogu razmeniti poruke u realnom vremenu, sa vidljivim online statusom i indikatorom kucanja.
- [ ] Poruka poslata dok primalac nije povezan stiže odmah pri sledećem povezivanju, uz mobilnu push notifikaciju.
- [ ] Ekran razgovora sa gostom/subagentom prikazuje M14 podatke kroz istu komponentu, bez ijednog dupliranog zapisa poruke u M19 bazi.
- [ ] M18 `CRITICAL` upozorenje stiže i kao `IN_APP` poruka, pored Telegram/email.
- [ ] M17 se može instalirati kao PWA; M9 dobija chat tab — nijedna nova samostalna desktop/mobilna aplikacija nije napravljena od nule.

---

## 10. Otvoreno za dalje

- Da li interni chat treba grupne kanale po timovima/odeljenjima (npr. "Prodaja", "Finansije") od starta, ili počinje samo sa direktnim i ad-hok grupnim razgovorima — počinje se jednostavnije, širi se po potrebi.
- Pretraga istorije poruka — dodaje se ako obim komunikacije to zahteva, van obima ove verzije.
