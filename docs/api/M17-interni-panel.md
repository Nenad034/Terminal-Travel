# API dokumentacija — M17 (Interni radni panel)

**Namena:** M17 nema sopstveni API — ovaj dokument postoji da objasni odstupanje od obrasca korišćenog za ostale module (`docs/api/M<broj>-<slug>.md`), ne da opiše nov ugovor.

M17 je Next.js aplikacija (`apps/panel/`) koja **isključivo poziva postojeće API-je** drugih modula (M17 spec §2 — "nema sopstvenu bazu ni poslovnu logiku"). Nema `apps/panel/src/app/api/*` rute osim sesijskog sloja (`api/session/login`, `api/session/mfa`, `api/session/logout` — httpOnly cookie omotač oko M1 `/iam/auth/*`, ne novi poslovni endpoint).

Za integraciju sa Terminal Travel-om iz spoljnog sistema, koristi API dokumentaciju modula koji je stvarno pozvan:

- `docs/api/M1-core-identitet.md` — prijava, MFA, `GET /iam/auth/me`.
- `docs/api/M2-katalog-proizvoda.md` — katalog proizvoda.
- M3 dobavljači/ugovori — `POST/GET /contracting/suppliers`, `/contracting/contracts` (pogledaj `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` poglavlje 6, dokument za spoljne integratore u ovom modulu nije prioritet dok M17 ne bude glavni potrošač).
- `docs/api/M5-rezervacije.md` — pretraga (`GET /sales/search?channel=INTERNAL_PANEL`, zahteva prijavu i `M5/booking/VIEW` — vidi napomenu ispod), ponude, potvrda rezervacije, kalendar.

## Jedina stvarna promena API ugovora u ovom prolazu

`GET /sales/search` (M5) — parametar `channel` sad prihvata i `INTERNAL_PANEL`, pored postojećih `B2C_SITE`/`B2B_PORTAL`/`MOBILE`. Za razliku od ta tri (javno dostupna, bez autentikacije), `channel=INTERNAL_PANEL` **zahteva** `Authorization: Bearer <JWT>` i dozvolu `M5/booking/VIEW` — bez toga vraća `401`/`403`. Vraća sve `ACTIVE` proizvode bez obzira na `visible_channels` (M2 spec §5.1 — to polje kontroliše samo javnu vidljivost, ne interni pristup).

`GET /iam/auth/me` (M1) — nov endpoint, dodat pri implementaciji M17: vraća profil i efektivnu listu dozvola trenutno prijavljenog korisnika (`{ userId, email, fullName, accountType, status, roles: string[], permissions: {module,resource,action}[] }`). Nema poseban ključ dozvole — svaki prijavljeni korisnik sme da vidi sopstvena prava.
