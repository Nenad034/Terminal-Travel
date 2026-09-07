# Terminal Mobile

M9 — mobilna aplikacija (Expo/React Native). Bez sopstvene baze — poziva `apps/api` DIREKTNO (nema Next.js BFF sloj kao `apps/panel`/`apps/web`): token se čuva u `expo-secure-store`, ne u httpOnly kolačiću (`docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`).

Nema koda ovde bez oslonca u odgovarajućoj specifikaciji — vidi `CLAUDE.md` u korenu repozitorijuma.

## Lokalno pokretanje

Preduslov: `apps/api` već pokrenut (vidi `apps/api/README.md`).

```bash
# iz korena repozitorijuma
npm install

npm run start:mobile   # expo start — otvara Expo Dev Tools, skenirati QR kodom (Expo Go) ili birati platformu
```

`API_BASE_URL` se ne čita iz `.env` nego iz `app.json` → `expo.extra.apiBaseUrl` (Expo `Constants`, `src/lib/api-client.ts`). Podrazumevano `http://localhost:3000/api/v1` radi za web pregled (`npm run start -- --web`) i iOS simulator na istoj mašini. Za Android emulator zameniti `localhost` sa `10.0.2.2` (Android-ov alias za host mašinu); za pravi telefon na istoj Wi-Fi mreži zameniti IP adresom mašine na mreži (`ipconfig`/`ifconfig`) — u sva tri slučaja menja se samo `app.json`, ne kod.

## Testovi

```bash
npm run test:mobile   # jest-expo preset, iz korena repozitorijuma
```

## Struktura

- `app/` — Expo Router rute (fajl = ruta); `(guest)`/`(guide)` su grupe bez uticaja na URL
- `src/auth/`, `src/guest/`, `src/guide/` — logika i komponente po publici (gost vs. vodič/tim)
- `src/lib/api-client.ts` — HTTP klijent ka `apps/api`, `session.ts` — token u `expo-secure-store`
- `src/shared/` — deljene komponente/tipovi između `guest`/`guide`
