# Terminal API

NestJS backend. Prvi implementirani modul: **M1 (Core / Identitet i pristup)** —
`docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`.

Nema koda ovde bez oslonca u toj specifikaciji — vidi `CLAUDE.md` u korenu repozitorijuma.

## Lokalno pokretanje

```bash
# iz korena repozitorijuma
npm install
docker compose up -d postgres

cp apps/api/.env.example apps/api/.env   # popuniti JWT_SECRET/ENCRYPTION_KEY nasumičnim stringovima

cd apps/api
npx prisma migrate dev
docker exec -i terminaltravel-postgres-1 psql -U terminal -d terminal < prisma/sql/audit_log_append_only.sql
npx prisma db seed

npm run start:dev
```

API: `http://localhost:3000/api/v1`
OpenAPI dokumentacija (Swagger UI): `http://localhost:3000/api/docs`

## Testovi

```bash
# unit testovi (mokovan Prisma, ne treba baza) — src/**/*.spec.ts
npm test

# e2e testovi (prava Postgres baza) — test/**/*.e2e-spec.ts
# preduslov: koraci iz "Lokalno pokretanje" iznad već urađeni (baza migrirana, trigger primenjen, seed pušten)
npm run test:e2e
```

E2e testovi (`test/m1-exit-criteria.e2e-spec.ts`) direktno dokazuju stavke izlaznog kriterijuma M1 specifikacije (poglavlje 8): login+obavezna 2FA za interne uloge, zaključavanje naloga, 7 seedovanih sistemskih uloga, trenutni efekat `UserPermissionOverride` bez ponovne prijave, i append-only zaštitu audit loga. Kreiraju sopstvene test korisnike (email sufiks `@tt-test.rs`) i čiste ih u `afterAll` — audit log zapisi ostaju (namerno, append-only).

## Napomene

- **Hosting provajder za produkciju namerno nije izabran** (avgust 2026, odluka vlasnika) — `docker-compose.yml` je isključivo za lokalni razvoj. Pitati vlasnika pre bilo kakvog produkcijskog hostinga.
- Port 5435 (ne 5432/5433/5434) — mašina na kojoj je ovo pisano već ima druge, nepovezane Postgres instance na tim portovima.
- Append-only trigger za `audit_log_entries` (M1 spec §3.8) nije u Prisma šemi (Prisma ne upravlja trigerima) — pokrenuti `prisma/sql/audit_log_append_only.sql` ručno posle svake `prisma migrate dev`.
- `SESSION_TOKEN`/rate-limit/mock-mode pitanja iz M4 specifikacije se ne tiču M1 — M1 nema spoljne API adaptere.
