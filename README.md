# Terminal — poslovna platforma agencije Terminal Travel

> **Nastavljate rad na drugom računaru?** Idite pravo na [Podizanje na novoj mašini](#podizanje-na-novoj-mašini).
> **Vi ste AI agent?** Prvo pročitajte `CLAUDE.md` u ovom folderu — obavezan je i ima prednost nad ovim fajlom.

---

## Gde je projekat, u dve rečenice

Izgrađen je 21 modul (backend), interni panel sa oko 75 ekrana i javni sajt sa 17 ekrana — skoro sve nad pravim podacima, ne mock-om. Kod je gotov u meri u kojoj se može bez servera; ono što nedostaje je **mesto na kom sve to radi** i tri odluke koje su poslovne, ne tehničke.

|                          | Stanje                                                                                   |
| :----------------------- | :--------------------------------------------------------------------------------------- |
| Testovi                  | 1079 (backend) + 13 (panel), svi prolaze                                                 |
| CI (GitHub Actions)      | zelen                                                                                    |
| Fazni plan               | Faza 0 zatvorena 7.9.2026 (infrastruktura opisana kodom); moduli izgrađeni kroz sve faze |
| Fiskalizacija (SEF/ESIR) | **simulacija** — čeka firmu i ugovor                                                     |
| Kartično plaćanje        | **simulacija** — čeka izbor provajdera                                                   |
| Hosting                  | odlučen (Hetzner, Nemačka), **još nije zakupljen**                                       |

---

## Podizanje na novoj mašini

Potrebno unapred: **Node 20+**, **Docker Desktop**, **git**.

```bash
git clone https://github.com/Nenad034/Terminal-Travel
cd Terminal-Travel
npm install

# baza + lokalni "hvatač" pošte (ništa ne odlazi napolje)
docker compose up -d postgres mailpit

# tri fajla sa podešavanjima — NISU u gitu (sadrže tajne), zato se prave iz primera
cp apps/api/.env.example apps/api/.env
cp apps/panel/.env.local.example apps/panel/.env.local
cp apps/web/.env.local.example apps/web/.env.local
```

U `apps/api/.env` popuniti `JWT_SECRET` i `ENCRYPTION_KEY` nasumičnim stringovima
(`openssl rand -hex 32`). `PAYMENT_WEBHOOK_SECRET` mora biti **ista vrednost** u
`apps/api/.env` i `apps/web/.env.local`.

```bash
cd apps/api
npx prisma migrate deploy
docker exec -i terminaltravel-postgres-1 psql -U terminal -d terminal < prisma/sql/audit_log_append_only.sql
npx prisma db seed      # ispisuje email i lozinku PRVOG naloga — zapisati odmah
```

Zatim, svaki u svom terminalu:

```bash
npm run start:dev --workspace=apps/api        # API   → localhost:3000/api/v1
npm run dev --workspace=@terminal/panel       # panel → localhost:3100
npm run dev --workspace=apps/web              # sajt  → localhost:3001
```

**Ako nešto ne radi, prvo ovo:**

```bash
npm run doctor     # kaže šta tačno nedostaje i koju komandu pokrenuti
```

Detalji po aplikaciji: `apps/api/README.md`, `apps/panel/README.md`, `apps/web/README.md`.

`doctor` proverava pet stvari: da `apps/api/.env` ima sve ključeve iz `.env.example`, da je baza
dostupna, da su migracije primenjene, da postoji append-only trigger nad audit logom i da je seed
pušten. Ništa ne ispravlja sam — kaže šta nedostaje i koju komandu pokrenuti.

> Provereno 8.9.2026 na zatečenoj mašini: `doctor` prijavljuje da `apps/api/.env` nema 9 ključeva
> koji postoje u `.env.example` (SMTP\_\*, MAIL_FROM, PANEL_BASE_URL, PAYMENT_WEBHOOK_SECRET,
> TELEGRAM_BOT_TOKEN). Ne ruši rad — te funkcije se tiho preskaču dok ključ ne postoji — ali na
> novoj mašini `.env` napravljen iz `.env.example` ih već sadrži, pa ih samo popunite ili ostavite
> prazne.

### Zamke pri prvom pokretanju (svaka je stvarno napravljena)

- **Prazan ekran obično znači praznu bazu, ne pokvaren kod** — pustite seed skripte za probne podatke (spisak u `apps/api/README.md`).
- **`git pull` dok `next dev` radi obara Turbopack.** Redosled je: ugasi dev → `npm install` (ako su se menjale zavisnosti) → obriši `apps/panel/.next` → pokreni ponovo. Zamka 5.20.
- **Nikad dva `nest start --watch` istovremeno** — brišu jedan drugom prevedeni kod. Zamka 12.10.
- **Nikad `next build` dok `next dev` radi nad istom aplikacijom.** Zamka 9.3/5.18.

Pun spisak: `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md` (tabela „Kratka lista pre posla" na vrhu je ulaz u dokument).

---

## Gde je šta

```
CLAUDE.md                     pravila rada — obavezno za svakog saradnika/AI agenta
docs/00-PREGLED-DOKUMENTACIJE.html   klikabilan pregled cele dokumentacije (počnite odavde)
docs/00-MASTER-ARHITEKTURA.md        "ustav" projekta: moduli, faze, tehnički stek
docs/01-OBJASNJENJE-TEHNICKOG-STEKA.md   isto, bez žargona, za vlasnika
docs/moduli/M<broj>-<slug>/          specifikacija svakog modula + objašnjenje za vlasnika
docs/api/M<broj>-<slug>.md           API dokumentacija sa stvarnim primerima
docs/analize/                        analize koje preseku više modula
apps/api                             NestJS backend (21 modul)
apps/panel                           interni panel (M17)
apps/web                             javni sajt (M8)
apps/mobile                          mobilna aplikacija (M9)
infra/                               server opisan kodom (Hetzner) — vidi infra/README.md
```

Za razumevanje bez tehničkog žargona: `docs/01-OBJASNJENJE-TEHNICKOG-STEKA.md`,
`docs/OBJASNJENJE-SERVER-I-HOSTING-ZA-VLASNIKA.md` i `00-OBJASNJENJE-M<broj>-ZA-VLASNIKA.md`
u folderu svakog modula.

---

## Šta čeka odluku vlasnika (stanje 8.9.2026)

Ovo su tri stvari koje blokiraju dalje, i **nijedna nije tehnička**:

1. **Domen.** `terminaltravel.rs` je provereno slobodan (7.9.2026), oko 2.100 din/god. Registruje se
   na ime vlasnika (fizičko lice sme). **Kopija lične karte mora stići registraru u roku od 30 dana,
   inače se domen briše bez povraćaja novca.**
2. **Server.** Odlučeno: Hetzner, Nemačka. Testno okruženje ~7 €/mesec (CX23), produkcija ~27 €.
   Ništa nije zakupljeno — trošak počinje tek na `tofu apply`. Sve je pripremljeno u `infra/`.
3. **Firma.** Bez registrovane firme aplikacija ne može uživo: garancija putovanja (M11), PIB za
   fiskalizaciju i nalog kod platnog provajdera traže pravno lice. Redosled je
   firma → registar turizma → garancija putovanja → fiskalizacija i naplata.

Fiskalizacija i platni provajder se, po odluci vlasnika, rade **na kraju**, pred sam prelazak uživo.

---

## Šta je sledeće u kodu

Otvoreno i zabeleženo (pun indeks: `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`):

- **31 ranjivost u bibliotekama (9 ozbiljnih)** + CORS, M6 bulk-view dozvola, M19 upload allowlist,
  Row-Level Security — svesno odloženo do servera (dok. 36 §3, dok. 39 poglavlje 6). Throttle na
  login/MFA/pretragu i tvrd plafon rezultata pretrage su zatvoreni (8.9.2026, dok. 36 §1.4).
- **Izgled pretrage** (`/rezervacije/pretraga`) — vlasnik tražio izmenu izgleda, pauzirano.

---

## Pravila koja važe za svakoga ko radi na ovome

- **Nema koda bez oslonca u specifikaciji.** Nije pokriveno → prvo dopuni spec, pa potvrda
  vlasnika, pa kod. Detaljno u `CLAUDE.md`.
- **Ništa nije „gotovo" dok nije provereno izvršavanjem i commit-ovano** — ne pretragom po
  ključnoj reči, ne sažetkom agenta.
- **Pozadinska logika i ekran idu u istom prolazu.** „Logika postoji, UI ne" je nezavršeno, isto
  kao i obrnuto.
- **Posle `git push` otvoriti stanje CI-ja** (`gh run list --limit 1`). Zamka 11.3 — prekršena
  tri puta u jednom danu jer se na to pravilo nije upućivalo sa pravog mesta.
