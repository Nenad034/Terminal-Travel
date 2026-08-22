# Specifikacija modula M16 — Agentski distribucioni interfejs (MCP)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 1.1 (strateški kontekst), poglavlje 4 (M16), poglavlje 8 (Faza 6) i Dodatak A (nalaz od 28.7.2026. o MCP reviziji; nalaz od 1.8.2026. o Sabre Agentic APIs)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde tačan protokol treba potvrditi pred implementaciju
**Status:** Implementirano (avgust 2026) — vidi poglavlje 9 za tačan obim; API dokumentacija u `docs/api/M16-mcp-distribucija.md`, objašnjenje za vlasnika u `00-OBJASNJENJE-M16-ZA-VLASNIKA.md` (isti folder)
**Verzija:** 1.3 — dopuna poglavlja 10 (Otvoreno za dalje) o granularnim novčanim limitima po MCP klijentu, povodom analize Phocuswright izveštaja 2026 (22.8.2026, nije spec, čeka mehanizam agentskog plaćanja); v1.2 — implementacija (avgust 2026): protokol potvrđen naspram zvanične specifikacije 2026-07-28 (poglavlje 1.1) neposredno pre pisanja koda — stateless, JSON-RPC 2.0, `@modelcontextprotocol/server`/`@modelcontextprotocol/node` v2 (nova zavisnost, potvrđeno vlasnikom preko AskUserQuestion). Ključne implementacione odluke:
- **Identitet MCP klijenta u postojećem sistemu.** `MCPClientRegistration` pri prelasku `PENDING→ACTIVE` (`POST /mcp-admin/clients/:id/activate`, implementaciona dopuna — spec tabela poglavlja 7 nije imala dozvolu za ovaj korak, dodato `M16/mcp-client/MANAGE`) atomski kreira prateći `ClientAccount` (`LEGAL_ENTITY`) i `User` (`account_type = AI_AGENT`, M1 šema — polje je postojalo od ranije, nikad ožičeno) — isti "sopstveni pool rezervacija" obrazac kao `SUBAGENT_CONTACT` (M7), ne izolacija po pojedinačnom putniku. M5 `resolveApiContext`/`QuotesService.create` dobili malu dopunu da prepoznaju `AI_AGENT` (isto B2C maskiranje, `bookings.service.ts`/`quotes.service.ts`) — vidi M5 spec dopunu.
- **Kredencijal (poglavlje 3.1 `credentials_encrypted`).** Implementiran kao SHA-256 heš (isti obrazac kao `RefreshToken`/`PasswordResetToken`, `hashToken()`), ne reverzibilna enkripcija — server samo poredi predati Bearer token, nikad ga ne mora ponovo poslati spoljnoj strani. Plaintext kredencijal se vraća tačno jednom, u `POST /mcp-admin/clients` odgovoru.
- **Autorizacija (poglavlje 5/10, "otvoreno pitanje").** Prvi prolaz: jednostavan unapred-deljen ključ (Bearer = kredencijal iznad), potvrđeno vlasnikom kao svesna odluka. MCP spec 2026-07-28 tretira autorizaciju kao OPCIONU — pun OAuth 2.1 authorization server (dinamička registracija klijenta, PKCE, RFC9728/8414 discovery) je sam po sebi višenedeljni projekat odvojen od poslovne vrednosti (M2/M5 pristup) i ostaje otvorena stavka (dole).
- **Plaćanje (poglavlje 5).** `confirm_booking` potvrđuje rezervaciju bez naplate (`payment_status = UNPAID`), isti obrazac kao M8 bankovni prenos — spec's "minimalna pretpostavka" fallback. Agentsko/kartično plaćanje ostaje otvoreno.
- **Novi M5 kanal.** `M5Channel` dobio vrednost `MCP_AGENT` (Prisma šema) — rezervacije preko MCP-a su vidljivo razdvojene u izveštajima (M13) od M7/M8/M9, u skladu sa izlaznim kriterijumom (poglavlje 9, stavka 4).
- **Otkriven i zatvoren pratећi bezbednosni nalaz (van M16, u M5):** `BookingsService.confirmQuote()` je uvek vraćao NEMASKIRAN prikaz rezervacije (hardkodovano na `INTERNAL_PANEL` kontekst), bez obzira na pozivaoca — pogađalo je i M8 (gost koji potvrdi bankovni prenos je dobijao supplier polja u odgovoru), ne samo M16. Ispravljeno da koristi stvarni `actor.userId` (M5 spec §6.2 dopuna).

v1.1 — dodata stavka u poglavlje 10 (Otvoreno za dalje) o payload optimizaciji i akcionim porukama o greškama za MCP alate, po uzoru na Sabre Agentic APIs (Dodatak A, 1.8.2026)
**Zavisi od:** M1, M2, M5

---

## 1. Svrha i obim modula

M16 izlaže deo API-ja M2 (Katalog) i M5 (Rezervacije) eksternim AI agentima (npr. ChatGPT, Google, Sabre/MindTrip) preko Model Context Protocol (MCP) standarda, tako da agencija bude vidljiva i rezervabilna za AI agente koji rezervišu u ime gostiju izvan naših sopstvenih kanala (poglavlje 1.1 Master dokumenta). M16 je **još jedan kanal**, isti princip kao M7/M8/M9/M17 — čita isti interni API, ne zaobilazi poslovna pravila (poglavlje 5 Master dokumenta).

### 1.1 Napomena o verziji protokola

MCP je 28.7.2026. objavio najveću reviziju specifikacije do sad (Dodatak A Master dokumenta): prelazak na bez-stanja arhitekturu, ukinut inicijalni handshake, pooštrena autorizacija. **Tačan tehnički ugovor (wire-protokol, format poruka) mora se potvrditi naspram zvanične MCP specifikacije verzije 2026-07-28 ili novije neposredno pre implementacije** — ovaj dokument definiše šta se izlaže i pod kojim pravilima, ne tačan bajt-format protokola, isti pristup kao SEF/ESIR u M10.

---

## 2. Šta se izlaže

| MCP alat (tool) | Interni API iza njega | Napomena |
| :---- | :---- | :---- |
| `search_products` | M5 `/search` | isti rezultati, ista već primenjena marža, kao i na M8 |
| `create_quote` | M5 `/quotes` | |
| `confirm_booking` | M5 `/quotes/:id/confirm` | zahteva potpune podatke gosta — vidi poglavlje 4 |
| `get_booking_status` | M5 `/bookings/:id` | |
| `cancel_booking` | M5 `/bookings/:id/cancel` | |

Nema direktnog izlaganja M3/M4 — spoljni AI agent nikad ne vidi ugovore, alotmane, niti direktno zove Travelgate (isto pravilo kao poglavlje 5 Master dokumenta za M8/M9).

---

## 3. Registracija i autorizacija eksternih MCP klijenata

### 3.1 `MCPClientRegistration`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| client_name | string | npr. "ChatGPT (OpenAI)", "Google", "Sabre MindTrip" |
| credentials_encrypted | string | isti obrazac kao `ProviderConfig.auth_config_encrypted` u M4 |
| access_level | enum: `READ_ONLY`, `READ_WRITE` | `READ_WRITE` (potvrda rezervacije) zahteva poslovni dogovor sa tim platformom — nije automatska dodela |
| status | enum: `PENDING`, `ACTIVE`, `SUSPENDED` | |
| rate_limit_per_minute | integer | zaštita od zloupotrebe (poglavlje 5) |
| created_at | timestamp | |

Novi MCP klijent počinje kao `PENDING`/`READ_ONLY` — prelazak na `READ_WRITE` (mogućnost stvarne rezervacije, dakle stvarnog novca) zahteva ručno odobrenje Vlasnika/Direktora, isti princip opreza kao odobravanje novog subagenta u M7.

---

## 4. Identitet gosta i zakonske obaveze — bez olakšica

Rezervacija napravljena preko MCP kanala prolazi **kroz isti M5 tok** kao i svaka druga (poglavlje 4 M5 specifikacije) — isti zahtevi za podacima gosta (ime, dokument, državljanstvo — M6 `GuestProfile`), ista fiskalizacija (M10), isto pravilo "sve ili ništa" za više stavki. Eksterni AI agent mora dostaviti potpune podatke gosta u `confirm_booking` pozivu — ako ih nema, poziv se odbija sa jasnom greškom, isto kao nepotpun zahtev sa bilo kog drugog kanala. M16 ne uvodi olakšane zakonske zahteve samo zato što zahtev dolazi od AI agenta.

---

## 5. Plaćanje — otvoreno pitanje koje zahteva proveru bliže trenutku implementacije

Standardi za "agentski" (agentic commerce) plaćanje — kako spoljni AI agent prosleđuje ili inicira plaćanje u ime gosta — su, prema Dodatku A Master dokumenta, oblast koja se menja iz meseca u mesec, ne iz godine u godinu. Ovaj dokument **namerno ne pretpostavlja** tačan mehanizam (npr. tokenizovani agentski platni protokoli) — pri implementaciji M16 (Faza 6, dosta daleko unapred), potrebno je proveriti tekuće stanje standarda kroz mesečni pregled trendova (poglavlje 10 Master dokumenta) pre biranja pristupa. Do tada, minimalna pretpostavka je da se koristi isti `PaymentGatewayAdapter` iz M10 kao i za M8, ako spoljna platforma podržava standardan hostovani checkout.

---

## 6. Zaštita od zloupotrebe

- `rate_limit_per_minute` po `MCPClientRegistration` (poglavlje 3.1).
- Kreditni limit (M7) i provera kapaciteta (M3/M4) štite od prekomerne prodaje bez obzira na kanal — M16 ne zaobilazi te provere, samo ih nasleđuje kroz M5.
- Neuobičajen obrazac poziva (npr. hiljade pretraga u minuti od jednog klijenta) generiše upozorenje timu — detalji praćenja definišu se pri implementaciji.

---

## 7. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M16/mcp-client/VIEW` | Vlasnik, Direktor |
| `M16/mcp-client/MANAGE` | Vlasnik, Direktor — registracija/aktivacija/suspendovanje klijenta (implementaciona dopuna avgust 2026 — bez ove dozvole niko ne bi mogao ni da registruje prvog MCP klijenta) |
| `M16/mcp-client/APPROVE_READ_WRITE` | Vlasnik, Direktor — **nikad automatski**, isti princip kao odobravanje subagenta (M7) |

---

## 8. API/MCP ugovor

Prefiks internog administrativnog dela: `/api/v1/mcp-admin` (upravljanje `MCPClientRegistration`, van samog MCP protokola) — `GET /clients`, `GET /clients/:id`, `POST /clients` (vraća plaintext kredencijal tačno jednom), `POST /clients/:id/activate`, `POST /clients/:id/approve-read-write`, `POST /clients/:id/suspend`.

Sam MCP server je implementiran na `POST /api/v1/mcp` (stateless, JSON-RPC 2.0, protokol 2026-07-28 preko `@modelcontextprotocol/server`/`@modelcontextprotocol/node` v2) — pet alata iz poglavlja 2, sve iza Bearer autentikacije (poglavlje 3.1/5, implementaciono poglavlje verzije 1.2). Detalji zahteva/odgovora u `docs/api/M16-mcp-distribucija.md`.

---

## 9. Izlazni kriterijum (M16 deo Faze 6)

- [x] Registrovan MCP klijent u `READ_ONLY` režimu može uspešno da izvrši `search_products` i dobije iste rezultate kao M8. (`McpToolsService.searchProducts` poziva `SearchService.search` in-process sa `channel=B2C_SITE`, testirano `test/m16-exit-criteria.e2e-spec.ts`)
- [x] `confirm_booking` sa nepotpunim podacima gosta se odbija sa jasnom porukom, isto kao na bilo kom drugom kanalu. (zod `inputSchema` odbija zahtev pre dispatch-a alata sa jasnom porukom po polju)
- [x] Prelazak klijenta iz `READ_ONLY` u `READ_WRITE` zahteva eksplicitno ljudsko odobrenje, upisano u audit log. (`McpAdminService.approveReadWrite`, `module: 'M16', action: 'mcp_client.approved_read_write'`)
- [x] Kreditni limit i provera kapaciteta rade identično bez obzira da li rezervacija dolazi sa M8, M9, M7 ili M16. (`McpToolsService` poziva iste `QuotesService`/`BookingsService` metode kao svaki drugi kanal, bez zaobilaznog puta; kapacitet dokazan e2e testom preko potrošenog `totalCapacity=1`)

---

## 10. Otvoreno za dalje

**Rešeno (avgust 2026, implementacija):** tačan MCP wire-protokol potvrđen (2026-07-28, `@modelcontextprotocol/server`/`node` v2) i implementiran.

- **Pun OAuth 2.1 authorization server** (dinamička registracija klijenta, PKCE, RFC9728/8414 discovery metadata) — prvi prolaz koristi jednostavan unapred-deljen ključ (poglavlje 3.1, implementaciono poglavlje verzije 1.2), potvrđeno vlasnikom kao svesna odluka jer MCP spec autorizaciju tretira kao opcionu. Vratiti se na ovo ako neka spoljna platforma (ChatGPT/Google/Sabre) zahteva pun OAuth tok kao uslov integracije.
- Mehanizam agentskog plaćanja — `confirm_booking` trenutno potvrđuje bez naplate (`UNPAID`, isti obrazac kao M8 bankovni prenos); proveriti tekuće stanje standarda kroz mesečni pregled trendova pre uvođenja kartičnog/agentskog plaćanja (poglavlje 5). **Dopuna 22.8.2026** (Phocuswright "Travel Innovation and Technology Trends 2026" — agent-ready platni okviri Visa/Mastercard/Google, zapaženo iz spoljnog izvora): kad taj mehanizam dođe na red, razmotriti granularne novčane limite po klijentu (npr. `max_transaction_amount_eur` na `MCPClientRegistration`, poglavlje 3.1), ne samo binarni `READ_ONLY`/`READ_WRITE` prekidač — isti princip opreza kao M18 `budget_limit_eur` po agentu (poglavlje 6.5 tog dokumenta), primenjen na spoljnog MCP klijenta umesto internog domenskog agenta.
- Da li je potreban poseban ugovor/uslovi korišćenja sa svakom eksternom platformom (ChatGPT, Google, Sabre/MindTrip) pre `READ_WRITE` odobrenja — pravno pitanje, van obima ove tehničke specifikacije.
- Automatsko obaveštavanje tima o neuobičajenom obrascu poziva (poglavlje 6) — trenutno `McpRateLimiterService` samo blokira preko limita, ne šalje alarm; upisano u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`.
- **Oblik odgovora MCP alata (poglavlje 2)** — implementirano kao pljosnat JSON (isti DTO oblik kao M5 servisi, ne poseban MCP serializer); poruke o greškama za `create_quote`/`confirm_booking`/`cancel_booking` (`assertWriteAllowed`) su akcione ("zahteva READ_WRITE... kontaktirajte..."), zod validacione poruke po polju su čitljive ali generičke. Sabre-stil dodatna optimizacija payload-a ostaje otvorena za kasnije, nije blokirajuća za prvi prolaz.
