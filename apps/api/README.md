# Terminal API

NestJS backend. Implementirani moduli:
- **M1 (Core / Identitet i pristup)** — `docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`
- **M2 (Katalog proizvoda)** — `docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md`
- **M3 (Ugovaranje i alotmani)** — `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md`
- **M4 (Integracije spoljnih API konekcija)** — `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md`

Nema koda ovde bez oslonca u odgovarajućoj specifikaciji — vidi `CLAUDE.md` u korenu repozitorijuma.

## Lokalno pokretanje

```bash
# iz korena repozitorijuma
npm install
docker compose up -d postgres mailpit   # mailpit = lokalni hvatač pošte, ništa ne šalje napolje

cp apps/api/.env.example apps/api/.env   # popuniti JWT_SECRET/ENCRYPTION_KEY nasumičnim stringovima

cd apps/api
npx prisma migrate dev
docker exec -i terminaltravel-postgres-1 psql -U terminal -d terminal < prisma/sql/audit_log_append_only.sql
npx prisma db seed   # ispisuje email i lozinku PRVOG naloga za prijavu u panel — zapisati odmah

npm run start:dev
```

API: `http://localhost:3000/api/v1`
Primljena pošta (pozivnice, reset lozinke): `http://localhost:8025` — vidi `SMTP_*` u `.env.example`.
Upozorenje: `SMTP_HOST` u lokalnom `.env` sme da pokazuje ISKLJUČIVO na mailpit — e2e testovi stvarno šalju poruke (zamka 5.13).
OpenAPI dokumentacija (Swagger UI): `http://localhost:3000/api/docs`

## Testovi

```bash
# unit testovi (mokovan Prisma, ne treba baza) — src/**/*.spec.ts
npm test

# e2e testovi (prava Postgres baza) — test/**/*.e2e-spec.ts
# preduslov: koraci iz "Lokalno pokretanje" iznad već urađeni (baza migrirana, trigger primenjen, seed pušten)
npm run test:e2e
```

E2e testovi direktno dokazuju stavke izlaznog kriterijuma svake specifikacije (poglavlje 8 svake):
- `test/m1-exit-criteria.e2e-spec.ts` — login+obavezna 2FA za interne uloge, zaključavanje naloga, 7 seedovanih sistemskih uloga, trenutni efekat `UserPermissionOverride` bez ponovne prijave, append-only zaštita audit loga.
- `test/m2-exit-criteria.e2e-spec.ts` — CRUD/objava proizvoda sa sr+en gejtom, jezički fallback, javni odgovor bez `source_*` polja (vs. pun interni), `TRANSPORT`/`TICKET`/`EVENT` tipovi, `room_types[]`/`age_policy[]` podrazumevana politika, `ProductContentImport` ljudski tok odobrenja (uklj. `M23_RESEARCH` poreklo).
- `test/m3-exit-criteria.e2e-spec.ts` — dobavljači/ugovori/periodi (sva 4 `allotment_mode`), sprečavanje preklapanja, **prava konkurentnost rezervacije** (10 paralelnih HTTP zahteva za 1 mesto, 8 za 5 mesta — tačno onoliko uspe koliko ima kapaciteta), `expiring-releases`, M2↔M3 `source_contract_id` FK, uvoz cenovnika sa ljudskim odobrenjem i `SupplierExtractionProfile` učenjem.
- `test/m4-exit-criteria.e2e-spec.ts` — koristi `ProviderConfig.use_mock` (bez gađanja pravog Travelgate/Solvex servera): kredencijali nikad u odgovoru/logu, `default_tip_nastupanja` gejt, sečenje na `maxResultsPerSearch`, circuit breaker CLOSED→OPEN→HALF_OPEN→CLOSED, normalizovan `error_code`, idempotentnost `confirmBooking` (drugi poziv sa istim `idempotency_key` ne dotiče adapter), redakcija ličnih podataka, M1 audit log za rezervaciju.

Kreiraju sopstvene test korisnike (email sufiks `@tt-test.rs`) i čiste ih u `afterAll` — audit log zapisi ostaju (namerno, append-only).

## CI

`.github/workflows/ci.yml` pokreće build + unit + e2e testove na svaki push/PR ka `main`, nad efemernom Postgres bazom (GitHub Actions service container) — isti koraci kao lokalno pokretanje iznad, samo automatizovani. Zatvara "CI/CD" stavku Faze 0 (`docs/00-MASTER-ARHITEKTURA.md` poglavlje 8).

## Napomene

- **Hosting provajder za produkciju namerno nije izabran** (avgust 2026, odluka vlasnika) — `docker-compose.yml` je isključivo za lokalni razvoj. Pitati vlasnika pre bilo kakvog produkcijskog hostinga.
- Port 5435 (ne 5432/5433/5434) — mašina na kojoj je ovo pisano već ima druge, nepovezane Postgres instance na tim portovima.
- Append-only trigger za `audit_log_entries` (M1 spec §3.8) nije u Prisma šemi (Prisma ne upravlja trigerima) — pokrenuti `prisma/sql/audit_log_append_only.sql` ručno posle svake `prisma migrate dev`.
- M4: Travelgate adapter je implementiran ali live neproveren (nema pravih kredencijala); Solvex SOAP format je uživo potvrđen ispravnim, ali test kredencijali su trenutno odbijeni na serveru (verovatno IP whitelist) — oba testirana preko `ProviderConfig.use_mock`. Vidi M4 spec poglavlje 9.
