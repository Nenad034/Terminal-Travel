# Terminal Web

M8 — sajt agencije, javni (B2C) prikaz. Next.js, bez sopstvene baze — server-side poziva `apps/api` (`docs/moduli/M08-sajt-b2c/10-SPECIFIKACIJA-M8-SAJT-B2C.md`).

Nema koda ovde bez oslonca u odgovarajućoj specifikaciji — vidi `CLAUDE.md` u korenu repozitorijuma.

## Lokalno pokretanje

Preduslov: `apps/api` već pokrenut (vidi `apps/api/README.md`) — sajt nema sopstvenu bazu, samo se preko HTTP-a povezuje na API.

```bash
# iz korena repozitorijuma
npm install

cp apps/web/.env.local.example apps/web/.env.local
# API_BASE_URL već pokazuje na lokalni apps/api (http://localhost:3000/api/v1)
# WEB_SESSION_SECRET — nasumičan string (npr. openssl rand -hex 32)
# PAYMENT_WEBHOOK_SECRET — MORA biti ista vrednost kao u apps/api/.env (M10 spec §7.2)

npm run dev --workspace=apps/web
```

Sajt: `http://localhost:3000` (⚠ isti podrazumevani port kao `apps/api` — pokrenuti API prvo pa web sa `-p`, ili menjati port jedne od dve aplikacije lokalno).

## Struktura

- `src/app/[locale]/` — sve rute pod `next-intl` prefiksom jezika (M8 spec — sajt je jedini frontend sa i18n slojem, za razliku od `apps/panel`)
- `src/app/[locale]/(site)/` — javne stranice (katalog, pretraga, dosije rezervacije gosta)
- `src/app/[locale]/znanje/` — javni sadržaj iz M23 (deljeni link, bez prijave)
- `src/i18n/` — `next-intl` konfiguracija i prevodi
- `src/proxy.ts` — middleware za jezički prefiks rute

## Testovi

Još nema test paketa (`jest`/`ts-jest` su u `devDependencies`, ali nijedan `.spec.ts` fajl ne postoji) — vidi `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md` ako stavka čeka na indeksu. Dok ne postoji, oslanjati se na `tsc --noEmit` i `next build` pre commit-a:

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run build --workspace=apps/web
npm run lint --workspace=apps/web
```

## Provere pre commit-a (pokreće ih i CI, `.github/workflows/ci.yml`)

```bash
npm run format:check              # iz korena — Prettier
node tools/provera-use-server.mjs # 'use server' fajlovi izvoze samo async funkcije (zamka 7.1a)
node tools/check-contrast.js      # kontrast boja, WCAG 2.1
```
