# Specifikacija modula M14 — Podrška / Helpdesk

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M14) i poglavlje 8 (Faza 5)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.0
**Zavisi od:** M1, M5, M6, M7

---

## 1. Svrha i obim modula

M14 je tiketing sistem za goste (preko M8 sajta ili M9 aplikacije) i subagente (preko M7 portala) — Faza 5 izlazni kriterijum: "gosti i subagenti imaju gde da prijave problem."

### 1.1 Razlika u odnosu na M6 `CommunicationLog`

`CommunicationLog` (M6) je lagan zapis pojedinačne komunikacije (npr. beleška o telefonskom pozivu) bez radnog toka. **`Ticket`** (M14) je za stvarne zahteve za podršku koji zahtevaju praćenje statusa do rešenja — poseban entitet, ne prošireni `CommunicationLog`. Kad se tiket zatvori, može se opciono ostaviti sažetak u `CommunicationLog` radi jedinstvenog pregleda istorije komunikacije s gostom/nalogodavcem, ali sadržaj tiketa se ne duplira tamo u potpunosti.

---

## 2. Model podataka

### 2.1 `Ticket`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| ticket_number | string, unique | čitljiva oznaka |
| requester_client_account_id | UUID, nullable (FK → M6) | popunjeno za goste/subagente |
| requester_type | enum: `GUEST`, `SUBAGENT`, `STAFF_ON_BEHALF` | poslednje — kad tim unese tiket u ime gosta koji je zvao telefonom |
| related_booking_id | UUID, nullable (FK → M5) | kontekst, ako se tiče konkretne rezervacije |
| subject | string | |
| category | enum: `REZERVACIJA`, `PLACANJE`, `TEHNICKI_PROBLEM`, `REKLAMACIJA`, `DRUGO` | `REKLAMACIJA` je pravno posebna kategorija — vidi poglavlje 3.1 |
| priority | enum: `LOW`, `NORMAL`, `HIGH`, `URGENT` | |
| status | enum: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` | |
| channel | enum: `SITE_FORM`, `B2B_PORTAL`, `EMAIL`, `PHONE` | |
| assigned_to | UUID, nullable (FK → M1 User) | |
| zzp_response_deadline | date, nullable | **samo za `category = REKLAMACIJA`** — `created_at + 8 dana` (poglavlje 3.1), popunjava se automatski pri kreiranju |
| zzp_escalated_at | timestamp, nullable | **samo za `category = REKLAMACIJA`** — popunjava se automatski ako tiket ostane bez odgovora tima 5 dana od `created_at` |
| created_at / updated_at / resolved_at | timestamp | |

### 2.2 `TicketMessage`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| ticket_id | UUID (FK) | |
| sender_type | enum: `REQUESTER`, `STAFF`, `AI_DRAFT` | |
| sender_id | UUID, nullable | M1 User ili M6 ClientAccount/GuestProfile |
| body | text | |
| is_internal_note | boolean | interna beleška tima, nikad vidljiva gostu/subagentu |
| sent_by | UUID, nullable (FK → M1 User) | popunjeno kad je poruka stvarno poslata (vidi poglavlje 3) |
| created_at | timestamp | |

---

## 3. Reklamacije — zakonski rok (Zakon o zaštiti potrošača)

### 3.1 Rok od 8 dana i eskalacija posle 5

Za tiket sa `category = REKLAMACIJA`, agencija je zakonski obavezna da odgovori na pisanu reklamaciju u roku od **8 dana** od prijema (`zzp_response_deadline = created_at + 8 dana`). Ako reklamacija ostane bez odgovora tima (nijedna `TicketMessage` sa `sender_type = STAFF` i popunjenim `sent_by`) **5 dana** od `created_at`, sistem automatski:
1. Popunjava `zzp_escalated_at`.
2. Obaveštava Vlasnika/Direktora (interni panel + email) — nivo **"Autonomno"** iz poglavlja 7 Master dokumenta, čisto informativna eskalacija, ne izvršenje.

Neodgovaranje u roku od 8 dana pravno ovlašćuje gosta na sniženje cene ili raskid ugovora — sistem ovo ne sprovodi automatski (to je pravna posledica van dometa tiketing sistema), samo obezbeđuje da rok nikad tiho ne prođe neprimećen.

### 3.2 Automatski nacrt storno dokumenta pri povraćaju

Ako se rešenje reklamacije (`status → RESOLVED`) veže za odluku o povraćaju novca, M14 emituje događaj `ticket.resolved_with_refund` (Event Bus, referencira `related_booking_id`) — M10 se pretplaćuje i **automatski priprema nacrt** storno fiskalnog dokumenta (`FiscalDocument.status = DRAFT`, M10 poglavlje 6.1), isto kao svaki drugi nacrt u M10. Ovo ne menja pravilo iz M10: **slanje** storno dokumenta i dalje zahteva ljudsku potvrdu (`M10/fiscal-document/SUBMIT`) — M14 samo ubrzava pripremu, nikad sam ne izvršava fiskalnu radnju.

---

## 4. Uloga AI agenta (isti obrazac kao M6 `CommunicationLog`)

AI agent sme samostalno (nivo "Autonomno") da sažme upit gosta i pripremi nacrt odgovora (`sender_type = AI_DRAFT`). Ako nacrt pominje cenu, obavezu, ili odluku o povraćaju novca — poruka se **ne šalje** dok je čovek ne pregleda i pošalje (`sent_by` popunjeno), u skladu sa nivoom "Predloži pa čovek odobri" iz poglavlja 7 Master dokumenta. Čisto informativni odgovori (npr. "kako da preuzmete vaučer") mogu biti poslati direktno ako je tako podešeno — ali podrazumevano, svaki odgovor ide na ljudski pregled dok se sistem ne pokaže pouzdan.

---

## 5. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M14/ticket/VIEW`, `CREATE`, `RESPOND` | Vlasnik, Direktor, Sales Manager, Prodajni agent (svi tiketi; Prodajni agent podrazumevano samo sopstveni klijenti, širi se izuzetkom — isti obrazac kao M5/M6); Gost i `SUBAGENT_ADMIN` (isto `CREATE`/`VIEW`, ali obim ograničen na sopstvene tikete na nivou API-ja, ne poseban ključ dozvole) |
| Interne beleške (`is_internal_note = true`) | Vidljivo samo ulogama sa `M14/ticket/VIEW` iz internog tima — **nikad** Gostu/Subagentu, bez obzira na to što oni imaju `VIEW` nad samim tiketom |

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/helpdesk`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/tickets` | GET / POST | lista (prava po ulozi) / kreiranje |
| `/tickets/:id` | GET / PATCH | detalji, izmena statusa/prioriteta |
| `/tickets/:id/messages` | GET / POST | pregled niti / dodavanje poruke (nacrt ili poslato) |
| `/tickets/:id/messages/:messageId/send` | POST | ljudska potvrda slanja AI nacrta |

---

## 7. Izlazni kriterijum (M14 deo Faze 5)

- [ ] Gost sa sajta (M8) i subagent sa B2B portala (M7) mogu da otvore tiket i vide status/odgovore.
- [ ] Interne beleške (`is_internal_note`) nikad nisu vidljive van internog panela (M17).
- [ ] AI-generisan nacrt koji pominje cenu/obavezu ne može biti poslat bez `sent_by` popunjenog ljudskim nalogom.
- [ ] Tiket vezan za rezervaciju (`related_booking_id`) prikazuje kontekst iz M5 bez dupliranja podataka.
- [ ] `zzp_response_deadline` se automatski postavlja na 8 dana za `REKLAMACIJA` tikete; `zzp_escalated_at` se popunjava i menadžment obaveštava tačno posle 5 dana bez odgovora tima.
- [ ] Rešavanje reklamacije uz povraćaj novca automatski priprema nacrt storno dokumenta u M10, ali slanje i dalje zahteva ljudsku potvrdu.

---

## 8. Otvoreno za dalje

- SLA pravila za ostale kategorije tiketa (npr. automatsko eskaliranje tehničkog problema otvorenog duže od X sati) — dodaju se ako se pokaže potreba; `REKLAMACIJA` kategorija već ima zakonski rok (poglavlje 3.1), ne čeka ovu opštu odluku.
- Integracija sa M9 mobilnom aplikacijom (Faza 6) za goste — dodaje se kad taj kanal bude gotov.
- Tačan mehanizam kojim se odluka o povraćaju novca formalno beleži na tiketu (npr. novo polje `refund_decision`) pre nego što se emituje `ticket.resolved_with_refund` — definiše se kad se dođe do stvarne izrade, van obima ove specifikacije.
