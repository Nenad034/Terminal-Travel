# Terminal Panel

M17 — interni radni panel (srpski tim). Next.js, bez sopstvene baze — server-side poziva `apps/api` (`docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`).

Nema koda ovde bez oslonca u odgovarajućoj specifikaciji — vidi `CLAUDE.md` u korenu repozitorijuma.

## Lokalno pokretanje

Preduslov: `apps/api` već pokrenut (vidi `apps/api/README.md`) — panel nema sopstvenu bazu, samo se preko HTTP-a povezuje na API.

```bash
# iz korena repozitorijuma
npm install

cp apps/panel/.env.local.example apps/panel/.env.local
# API_BASE_URL već pokazuje na lokalni apps/api (http://localhost:3000/api/v1)
# PANEL_SESSION_SECRET — nasumičan string (npr. openssl rand -hex 32)

npm run dev --workspace=apps/panel
```

Panel: `http://localhost:3100` — prijava sa nalogom koji je `apps/api` ispisao pri `prisma db seed`.

## Testovi

```bash
npm test --workspace=apps/panel      # jest + @testing-library/react, next/jest transform
npx tsc --noEmit -p apps/panel/tsconfig.json
npm run lint --workspace=apps/panel  # ESLint (upozorenja ne obaraju CI, v. eslint.config.mjs)
```

`@testing-library/react` ne radi nad Server Component stranicama (traže pravi Next runtime) — testovi zato gađaju izdvojene klijentske komponente, ne cele ekrane (dok. 39, nalaz 2.4b).

## Struktura

- `src/app/(app)/` — ekrani iza prijave, App Router grupa (isti layout, provera sesije)
- `src/app/prijava/` — stranica za prijavu, van `(app)` grupe
- `src/app/not-found.tsx` — 404, u korenu `app/` (ne u `(app)` grupi) da hvata SVAKU neupoznatu adresu (dok. 39, nalaz 2.5)
- `src/components/` — deljene UI komponente
- `src/lib/` — `apiFetch` (BFF poziv ka `apps/api`), pomoćne funkcije

## Provere pre commit-a (pokreće ih i CI, `.github/workflows/ci.yml`)

```bash
npm run format:check              # iz korena — Prettier
node tools/provera-use-server.mjs # 'use server' fajlovi izvoze samo async funkcije (zamka 7.1a)
node tools/check-contrast.js      # kontrast boja, WCAG 2.1
```
