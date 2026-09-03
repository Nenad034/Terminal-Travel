# API dokumentacija — M8 (Sajt agencije / B2C prikaz)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski. Interni oslonac za implementaciju ostaje `docs/moduli/M08-sajt-b2c/10-SPECIFIKACIJA-M8-SAJT-B2C.md` — ovaj dokument ga ne zamenjuje.

---

## Pročitajte prvo: M8 nije modul kao ostali

Svi drugi moduli su delovi backend servera (`apps/api`) i izlažu REST API pod `/api/v1/...`. **M8 nije.** M8 je sam javni sajt (`apps/web`, Next.js) — on API-je **troši**, ne izlaže.

To ima tri praktične posledice ako gradite integraciju:

1. **M8 nema sopstveni katalog dozvola.** Nema nijedne `M8/...` dozvole u M1 i neće je ni biti. Prava sprovode moduli koje M8 zove (uloga `GOST` iz M1 već ograničava rezervacije na sopstvene).
2. **Ako vam treba katalog ili pretraga — ne zovite M8.** Zovite direktno M2 (`/api/v1/catalog/public/products`) ili M5 (`/api/v1/sales/search`). M8 vam ne daje ništa što ti API-ji već ne daju.
3. **M8 ipak izlaže pet sopstvenih putanja**, ali ne pod `/api/v1` nego pod `/api/` na samom sajtu. One postoje isključivo da bi upravljale sesijom u browseru, i opisane su ispod.

**Osnovna adresa sopstvenih putanja:** koren sajta (u razvoju `http://localhost:3200`), ne API server.

**Verzija podataka u primerima:** odgovori su stvarno uhvaćeni pozivima 3.9.2026, osim `omnisearch`, koji nije pozvan namerno — poziv troši AI kredit.

---

## Zašto sajt ima sopstvene putanje umesto da zove API direktno

Ovo je jedina stvar u M8 koju vredi razumeti pre svega ostalog, jer određuje kako se sa sajtom uopšte može raditi.

**Token nikad ne stiže do browsera.** Kad se gost prijavi, pristupni token se ne šalje njegovom pregledaču. Umesto toga upisuje se u kolačić označen kao `httpOnly` i šifrovan — kolačić koji JavaScript na stranici **ne može pročitati**. Svaki poziv ka pravom API-ju zatim ide **sa servera sajta**, ne iz browsera.

Posledica za vas: **u alatu za razvijaoce, u kartici Network, nećete naći `Authorization` zaglavlje.** Nije sakriveno — nije tamo. Pozivi koje vidite su browser → server sajta; pravi poziv ka API-ju dešava se dalje, gde browser ne vidi.

Razlog je jednostavan: token u browseru može ukrasti bilo koja skripta koja se učita na stranicu — uključujući ubačenu ili kompromitovanu skriptu treće strane. Ovako nema šta da se ukrade.

**Zbog toga ovih pet putanja postoje.** One su jedini most: primaju zahtev iz browsera, obave pravi poziv ka API-ju sa servera, i vrate rezultat bez tokena.

---

## POST /api/session/login

Prijava gosta. Prosleđuje na M1 `POST /iam/auth/login`.

**Zahtev:**
```json
{ "email": "petar.petrovic@primer.rs", "password": "NekaDugackaSifra1" }
```

**Odgovor `200` — uspešna prijava:**
```json
{ "ok": true }
```
**Tokena nema u odgovoru, i to je namerno.** Sesija je upisana u kolačić; sve dalje ide sam.

**Odgovor `200` — nalog ima uključenu dvofaktorsku potvrdu:**
```json
{ "requiresMfa": true, "mfaToken": "eyJhbGciOiJIUzI1NiIs..." }
```
> U ovom slučaju sesija **nije** napravljena i ekran za unos koda **nije implementiran** u prvom prolazu M8 — 2FA je za gosta dobrovoljna i redak slučaj. Gost sa uključenim 2FA praktično ne može da dovrši prijavu kroz sajt. Zabeleženo kao poznat nedostatak.

**Odgovor `401` (stvarno uhvaćeno) — greška se prosleđuje doslovno sa API-ja:**
```json
{"message":"Pogrešan email ili lozinka","error":"Unauthorized","statusCode":401}
```
Sve poruke grešaka iz M1 prolaze nepromenjene, uključujući zaključavanje naloga posle 5 neuspelih pokušaja.

---

## POST /api/session/register

Registracija gosta. Prosleđuje na M1 `POST /iam/auth/register`.

```json
{ "email": "petar.petrovic@primer.rs", "password": "NekaDugackaSifra1", "fullName": "Petar Petrović", "phone": "+381 60 111 2233" }
```
**Odgovor `200`:** `{ "ok": true }` — nalog je napravljen **i gost je odmah prijavljen**, bez posebnog koraka.

Lozinka mora imati najmanje 12 znakova; zauzeta adresa vraća `409`. Obe greške stižu doslovno iz M1.

---

## POST /api/session/guest-checkout

„Nastavi bez naloga". Prosleđuje na M6 `POST /crm/client-accounts/guest-checkout`.

**Sa tačke gledišta gosta ovo nije registracija** — on ne vidi i ne bira lozinku. Nalog se ipak pravi u pozadini (M6 sam generiše lozinku), jer rezervacija mora imati vlasnika kome pripada. Gost dobija sesiju isto kao da se prijavio.

**Odgovor `200`:** `{ "ok": true }`

---

## POST /api/session/logout

Bez tela zahteva.

**Odgovor `200` (stvarno uhvaćeno):**
```json
{ "ok": true }
```

> **Uvek vraća `200`, čak i ako poništavanje sesije na serveru ne uspe.** Kolačić se briše lokalno u svakom slučaju — bolje je da gost bude odjavljen na svom uređaju nego da ostane prijavljen zato što je backend bio nedostupan. Ne tumačite `200` kao potvrdu da je sesija poništena i na serveru.

---

## POST /api/omnisearch

Univerzalna pretraga i AI razgovor. Prosleđuje na M15 `POST /ai-orchestration/omnisearch`.

```json
{ "query": "nesto na moru u julu za dvoje sa detetom", "lang": "sr" }
```

**Radi i za neprijavljenog posetioca.** Ako sesija postoji, token se prilaže; ako ne postoji, zahtev ide bez njega, a backend to prihvata jer je kanal `B2C_SITE`.

`channel` se **ne prima od klijenta** — sajt ga uvek postavlja na `B2C_SITE` sam. To je zaštita: kad bi kanal dolazio iz browsera, posetilac bi mogao da se predstavi kao interni panel i time zaobiđe filter vidljivosti proizvoda.

> Ovaj endpoint nije pozvan pri pisanju dokumentacije, namerno — svaki poziv troši AI kredit. Oblik odgovora vidi u `docs/api/M15-ai-orkestracija.md`.

---

## Koje API-je sajt zove (mapa za integratore)

Ako gradite sopstveni prikaz umesto ovog sajta, ovo je tačan spisak endpointa koje treba da pozovete — provereno u kodu 3.9.2026:

| Šta | Endpoint | Modul |
| :---- | :---- | :---- |
| Katalog, javni prikaz | `GET /catalog/public/products?channel=B2C_SITE&lang=..` | M2 |
| Pretraga sa cenom | `GET /sales/search` | M5 |
| Ponuda | `POST /sales/quotes`, `POST /sales/quotes/:id/confirm` | M5 |
| Rezervacije gosta | `GET /sales/bookings`, `GET /sales/bookings/:id` | M5 |
| Profil gosta | `GET/PATCH /crm/client-accounts/:id` | M6 |
| Nastavak bez naloga | `POST /crm/client-accounts/guest-checkout` | M6 |
| Prijava / registracija / odjava | `POST /iam/auth/{login,register,logout}` | M1 |
| Kartično plaćanje | `POST /finance/payments/card/initiate` | M10 |
| Univerzalna pretraga | `POST /ai-orchestration/omnisearch` | M15 |

**Za cenu uvek M5, nikad M2.** M2 vraća šta se prodaje, bez cene; M5 vraća cenu sa već primenjenom maržom. Ovo je najčešća greška pri prvom povezivanju.

---

## Rute samog sajta (stranice, ne API)

Sve su prefiksovane jezikom: `/sr/...`, `/en/...`, `/hr/...`, `/sl/...`, `/es/...`, `/de/...`, `/ru/...`, `/fr/...`.

| Ruta | Sadržaj |
| :---- | :---- |
| `/` | početna |
| `/pretraga` | rezultati pretrage |
| `/[tip]`, `/[tip]/[slug]` | kategorija i stranica proizvoda (npr. `/smestaj/hotel-avala-resort`) |
| `/rezervacija/{ponuda,podaci-gosta,uslovi,placanje,potvrda}` | tok rezervacije, pet koraka |
| `/nalog/{prijava,registracija,moje-rezervacije,profil}` | nalog gosta |
| `/stranica/[slug]`, `/blog/[slug]` | sadržaj iz M12 |
| `/znanje/[share_token]` | jedan javno podeljen članak iz M23, dostupan samo direktnim linkom |

**`slug` u adresi proizvoda dolazi iz prevoda** (`ProductTranslation.slug`), pa je različit po jeziku — isti hotel ima drugu adresu na `/sr/` i na `/en/`.

**`/znanje/[share_token]` je namerno odsečen od ostatka sajta** — nema navigacije ka drugim člancima ni ka katalogu. Ko ima link, vidi tačno taj jedan članak i ništa više.

---

## Greške

M8 **ne izmišlja sopstvene poruke grešaka** — prosleđuje telo i statusni kod onako kako ih vrati modul koji je pozvan. Ako vidite `{"message":"Nalog je privremeno zaključan — pokušajte kasnije",...}`, to je M1 poruka koja je prošla kroz sajt nepromenjena.

Jedini izuzeci su zamenske poruke kad odgovor modula uopšte nema telo:

| Putanja | Zamenska poruka |
| :---- | :---- |
| `/api/session/login` | `"Prijava nije uspela"` |
| `/api/session/register` | `"Registracija nije uspela"` |
| `/api/session/guest-checkout` | `"Nastavak bez naloga nije uspeo"` |
| `/api/omnisearch` | `"Pretraga trenutno nije dostupna"` |
