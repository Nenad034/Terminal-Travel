# 42 — Stanje ekrana: mock ili pravo

**Datum:** 7.9.2026
**Povod:** dok. 39, nalaz 5.1 — nalaz 1.1 (dok. 39) je nastao jer se prelazak jednog ekrana sa mock-a na prave podatke desio na pola, i ništa to nije primetilo dok vlasnik nije prijavio pokvarenu funkciju. Ovo je jedan popis, jedan red po ekranu, da se „delimično prešli" više ne izgubi.

**Kako se održava:** kad se ekran menja (dodaje se, prelazi sa mock-a na pravo, ili obrnuto), red u ovoj tabeli se ažurira u ISTOM prolazu — isto pravilo kao svaki drugi cross-referenc u `CLAUDE.md`. Status se ne piše po nazivu fajla ni po komentaru u kodu (komentar može zastariti — tačno to je i izazvalo nalaz 1.1); piše se po tome šta stranica stvarno uvozi i poziva.

**Klase statusa:**

- **PRAVO** — podaci dolaze sa `apps/api` (`apiFetch`/`fetch` ka pravom endpointu), bez mock puta u normalnom toku.
- **MOCK** — ekran u normalnom toku prikazuje izmišljene/hardkodovane podatke.
- **DELIMIČNO** — glavni sadržaj je pravi, ali deo onoga što se vidi na ekranu (ne samo fallback za grešku) i dalje je mock/izmišljen.
- Status **DEMO (samoobjavljen)** je poseban slučaj DELIMIČNO: ekran je pravi, ali sadrži polje/dugme koje je u kodu I na samom ekranu (naslov/tooltip) obeleženo kao "demo"/"nije stvaran signal" — razlika prema nalazu 1.1 je namerno objavljivanje, ne prikrivanje.

---

## apps/panel

| Ruta                                 | Status                   | Dokaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :----------------------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/rezervacije/lista`                 | **DELIMIČNO**            | `page.tsx` zove pravo `GET /sales/bookings`, koji od 8.9.2026 (M5 spec v2.44) vraća prave `buyerEmail`/`buyerPhone`/`branchName`/`assignedUserName` za INTERNAL_PANEL — `RealBookingsTable.tsx` ih prikazuje direktno, bez izmišljanja. I dalje IZMIŠLJA `hotelName`, `supplierName/Email/Phone` (API ta polja još ne vraća) — vidljivo obeleženo na ekranu (`hotelName` dobija sufiks „(demo naziv)", `supplierName` „(demo)").
| `/rezervacije/lista` — „hitno" zvono | **DEMO (samoobjavljen)** | Isti fajl, `demoUrgent` (linija 94-99): tekst reda je „DEMO — ovo je izmišljen primer, ne stvaran signal", dugme nosi `title="DEMO zvono — nije stvaran signal"` (linija 439). Otvara `UrgentModal` sa gore navedenim izmišljenim kontaktima — objavljeno, ne skriveno.                                                                                                                                                                                                                                                                                         |
| `/rezervacije/lista/[bookingNumber]` | **MOCK — orphaned**      | `page.tsx:4,22` čita direktno iz `MOCK_BOOKINGS` (`mock-data.ts`), nema `apiFetch`. Ekran SAM prijavljuje „mock" (banner/napomena u kodu). Ruta nema nijedan živi ulaz u trenutnom UI-ju — jedini poziv `openTab('/rezervacije/lista/' + broj)` je u `BookingsTable.tsx`, koji ništa ne renderuje (v. „Mrtav kod" ispod); dostupna je samo direktnim upisom adrese. Vlasnikova odluka (5.9.2026, dok. 39 nalaz 1.1): mock ostaje namerno dok se ne pređe na stvaran rad.                                                                                        |
| `/rezervacije/pretraga`              | **DELIMIČNO**            | `page.tsx:118-119` (`usesMock`): za `ACCOMMODATION`, `FLIGHT`, `TRANSFER` i "Things to do" (EXCURSION+EVENT+TICKET spojeno) renderuje `AccommodationResultsMock`/`FlightResultsMock`/`TransferResultsMock`/`ExcursionResultsMock` — `GET /sales/search` se za te tipove uopšte ne poziva. Preostalih 5 vrsta (RENT-A-CAR, PACKAGE, CRUISE, INSURANCE, individualni paketi) renderuje `RealResults` nad pravim `results`. Ovo je već poznato i objavljeno kao nalaz 3.6 (dok. 39) — vlasnikova odluka 7.9.2026: „NE, treba izmena izgleda", pauzirano do daljeg. |
| `/podesavanja/podaci-agencije`       | **PRAVO**                | Nov ekran 7.9.2026 (M1 spec §3.9c). `page.tsx` zove pravo `GET /iam/agency-settings`, forma šalje `PUT` na isti endpoint. Bez ijednog mock uvoza. Provereno u browseru (`tools/qa-screenshot.mjs`, HTTP 200) i kroz stvaran API: preimenovanje se odmah vidi na javnom sajtu.                                                                                                                                                                                                                                                                                   |
| Svi ostali ekrani panela (~75 ruta)  | **PRAVO**                | Svaki proveren pojedinačno — `apiFetch` ka `apps/api` ili server akcija koja na kraju zove `apiFetch`, bez mock uvoza. Uključuje: početnu, sve liste/detalje/forme za rezervacije (osim dva reda iznad), CRM, B2B, katalog, ugovore, ugovore-klijente, finansije, marketing, podršku, pomoć/znanje, korisnike/uloge, nadzor, chat, email, audit-log, MCP, integracije, izveštaje, AI asistenta, prijavu/aktivaciju/reset lozinke.                                                                                                                               |

### Mrtav kod (potvrđeno — nula uvoznika)

- `apps/panel/src/app/(app)/rezervacije/lista/BookingsTable.tsx` — stara mock tabela iz faze pre migracije (nalaz 1.1). Grep kroz `apps/panel/src` potvrđuje: jedini preostali uvoz je `FiltersModal.tsx` koji uzima SAMO tip `ColumnKey`, ne komponentu. Ništa ne renderuje `<BookingsTable>`.
- `apps/panel/src/app/(app)/rezervacije/lista/FiltersModal.tsx` — uvozi ga isključivo `BookingsTable.tsx` (koji je sam mrtav). Ništa drugo ga ne uvozi.

Oba stoje namerno neobrisana — ista vlasnikova odluka kao `mock-data.ts` (5.9.2026, dok. 39 nalaz 1.1: mock ostaje dok ne zatreba).

---

## apps/web

| Ruta                                               | Status    | Dokaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sve rute (`[locale]` + statične stranice, 17 ruta) | **PRAVO** | Svaka proverena pojedinačno — `apiFetch`/server akcija sa `apiFetch`. Nijedan `Mock`/`mock-data` uvoz nigde u `apps/web/src` (potvrđeno pretragom kroz ceo folder). Jedine pojave reči „mock" u komentarima odnose se na mock PLATNI PROVAJDER na strani M10 (spec §12, čeka izbor pravog PSP-a — simulacija na nivou backend integracije, ne prikaz na ekranu) i istorijske komentare o uvođenju mock podataka avgusta 2026, ne na trenutno stanje. `uslovi/page.tsx` je statična pravna stranica po dizajnu (nema izvor podataka da bi bio mock/pravo). |

---

## Rezime — gde je rizik danas

Redosled po tome koliko liči na nalaz 1.1 (skriven, ne objavljen mock unutar inače pravog ekrana):

1. ~~**`/rezervacije/lista` — `buyerEmail`/`buyerPhone`/`branch`/`assignedUser`.**~~ **Zatvoreno 8.9.2026** (M5 spec v2.44) — `BookingsService.findAll` sad razrešava sva četiri preko pravog izvora (`Branch`/`User`/`ClientAccount`), panel ih prikazuje bez izmišljanja. `hotelName`/`supplierName`/`supplierEmail`/`supplierPhone`/"Hitno" zvona ostaju demo, i dalje self-disclosed.
2. **`/rezervacije/pretraga`** — poznato, objavljeno, pauzirano vlasnikovom odlukom (nalaz 3.6). Rizik nizak jer je već na radaru.
3. **`/rezervacije/lista/[bookingNumber]`** — mock, ali orphaned (nema živog ulaza) i sam sebe prijavljuje. Rizik nizak.

Ništa od ovoga nije novi kritičan nalaz — najozbiljnija stavka (1) je nova opservacija, dodata u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md` (M5 sekcija) kao stavka koja čeka da API vrati prava kontakt polja.
