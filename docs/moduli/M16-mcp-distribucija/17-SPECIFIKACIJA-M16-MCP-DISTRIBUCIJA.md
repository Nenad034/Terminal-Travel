# Specifikacija modula M16 — Agentski distribucioni interfejs (MCP)

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 1.1 (strateški kontekst), poglavlje 4 (M16), poglavlje 8 (Faza 6) i Dodatak A (nalaz od 28.7.2026. o MCP reviziji; nalaz od 1.8.2026. o Sabre Agentic APIs)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde tačan protokol treba potvrditi pred implementaciju
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodata stavka u poglavlje 10 (Otvoreno za dalje) o payload optimizaciji i akcionim porukama o greškama za MCP alate, po uzoru na Sabre Agentic APIs (Dodatak A, 1.8.2026)
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
| `M16/mcp-client/APPROVE_READ_WRITE` | Vlasnik, Direktor — **nikad automatski**, isti princip kao odobravanje subagenta (M7) |

---

## 8. API/MCP ugovor

Prefiks internog administrativnog dela: `/api/v1/mcp-admin` (upravljanje `MCPClientRegistration`, van samog MCP protokola).

Sam MCP server (alati iz poglavlja 2) implementira se prema zvaničnoj MCP specifikaciji verzije 2026-07-28 ili novijoj (poglavlje 1.1) — tačan endpoint/transport definiše ta specifikacija, ne ovaj dokument.

---

## 9. Izlazni kriterijum (M16 deo Faze 6)

- [ ] Registrovan MCP klijent u `READ_ONLY` režimu može uspešno da izvrši `search_products` i dobije iste rezultate kao M8.
- [ ] `confirm_booking` sa nepotpunim podacima gosta se odbija sa jasnom porukom, isto kao na bilo kom drugom kanalu.
- [ ] Prelazak klijenta iz `READ_ONLY` u `READ_WRITE` zahteva eksplicitno ljudsko odobrenje, upisano u audit log.
- [ ] Kreditni limit i provera kapaciteta rade identično bez obzira da li rezervacija dolazi sa M8, M9, M7 ili M16.

---

## 10. Otvoreno za dalje

- Tačan MCP wire-protokol (transport, autentikacija na nivou protokola) — potvrditi naspram zvanične specifikacije neposredno pre implementacije (poglavlje 1.1).
- Mehanizam agentskog plaćanja — proveriti tekuće stanje standarda kroz mesečni pregled trendova pre implementacije (poglavlje 5).
- Da li je potreban poseban ugovor/uslovi korišćenja sa svakom eksternom platformom (ChatGPT, Google, Sabre/MindTrip) pre `READ_WRITE` odobrenja — pravno pitanje, van obima ove tehničke specifikacije.
- **Oblik odgovora MCP alata (poglavlje 2)** — pri implementaciji razmotriti da odgovor bude pljosnatiji/manji od internog M8 odgovora (poseban serializer za MCP sloj, ne isti DTO), i da poruke o greškama (npr. odbijen `confirm_booking` iz poglavlja 4) budu pisane tako da spoljni agent može sam da ispravi poziv, ne samo šifra greške. Uzor: Sabre-ova javno opisana praksa za sopstvene "agentic-ready" API-je (Dodatak A, nalaz od 1.8.2026) — nije obavezujući standard, samo potvrđen primer dobre prakse iz istog domena.
