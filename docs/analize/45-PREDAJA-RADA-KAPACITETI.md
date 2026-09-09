# Predaja rada — kapaciteti (stanje 9.9.2026)

**Kome:** sledećem agentu/sesiji koja preuzme repozitorijum sa GitHub-a i nastavlja rad na kapacitetima.
**Zašto postoji:** posao je stao na tačno određenom mestu, usred posla koji je do pola u kodu a do pola samo u specifikaciji. Bez ovog dokumenta bi se to moralo rekonstruisati iz commit poruka, a to se u praksi ne radi.

**Ovo nije zamena za specifikaciju.** Sve odluke i njihova obrazloženja su u Nivo 2 specifikacijama; ovde stoji samo **gde se stalo, šta je sledeće i šta je već pokušano**.

---

## 1. Pročitaj ovo pre nego što išta pipneš

Redosled je bitan, ne preskači:

1. `CLAUDE.md` u korenu — tvrdo pravilo „nema koda bez oslonca u specifikaciji", i kako se komunicira sa vlasnikom (nije programer; tehničke odluke se donose i obrazlažu, ne prebacuju njemu).
2. Skill `tt-m3-ugovaranje-alotmani` → `docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md`, poglavlja **2.3e, 2.8, 2.9, 2.10, 4.4–4.7**. To je ceo model kapaciteta.
3. `docs/moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md`, poglavlje **4b** (ceo, uključujući 4b.0, 4b.0c, 4b.6, 4b.7) — to je ekran koji se sledeći pravi.
4. `docs/analize/44-PREDLOG-MREZA-KAPACITETA.md`, poglavlja **9, 11 i 12** — vlasnikovi odgovori i razlozi. Poglavlje 11 posebno: tamo stoje i **dve odluke koje je vlasnik odbacio**, sa obrazloženjem. Nemoj ih vraćati.
5. `docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md` — tabela na vrhu, red koji odgovara onome što radiš.

---

## 2. Šta je stvarno GOTOVO (kod postoji i proveren je)

| Šta                                                                      | Gde                                                                           |
| :----------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Model kapaciteta po danu: `CapacityDay`, `CapacityBlock`, stop-sale      | `apps/api/prisma/schema.prisma`, migracije `..._v115`, `..._v116`, `..._v120` |
| `CapacityService` — mreža po danima, stop-sale, blokade, dnevni override | `apps/api/src/modules/m3-ugovaranje-alotmani/capacity/`                       |
| Izmena i gašenje perioda (`PATCH`/`DELETE`), prekoračenje kao minus      | `contract-periods.service.ts` (`update`, `remove`)                            |
| **Provera kapaciteta PO DANU pri rezervaciji**                           | `contract-periods/day-capacity.ts` + `reserve()`/`release()`                  |
| **Prozor prijave** (`booking_from`/`booking_to`) u modelu i u proveri    | isto + `overlap.ts`                                                           |
| Ekran „Kapaciteti" — prva verzija (mreža, dnevni panel, tri forme)       | `apps/panel/src/app/(app)/kapaciteti/`                                        |
| Ekran „Ugovori i kapaciteti" sa filterima na serveru                     | `apps/panel/src/app/(app)/ugovori/`                                           |

Dokaz da radi: 7 e2e testova nad pravom bazom u `apps/api/test/m3-exit-criteria.e2e-spec.ts`, blok „Provera kapaciteta po danu (§2.8c) i prozor prijave (§2.3e)". Pokreni ih pre nego što bilo šta menjaš — ako padnu, nešto u okruženju ne valja, ne kod.

---

## 3. Šta je SAMO specifikacija (nema ni reda koda)

Ovo je najvažniji deo ovog dokumenta. Sve navedeno je **napisano, dogovoreno sa vlasnikom i nenapravljeno**:

- **M3 §2.9** — tri vrste izvora (naš ugovor / API / na upit), `SourceSaleRestriction` („naša zabrana"), zbir samo preko naših ugovora.
- **M3 §2.10** — redosled prodaje po najnižoj **prodajnoj** ceni, `SupplierPriority`, `HotelSourcePreference`.
- **M3 §4.5/§4.6/§4.7** — predlog povrata, predlog iz mejla dobavljača, dnevni pregled izmena.
- **M3 §2.8e** — dnevni kontrolni presek `units_sold` protiv zbira po danima (+ M18 signal `CAPACITY_COUNTER_DRIFT`).
- **M4 §3.3** — uparivanje objekta i tipa sobe sa provajderom.
- **M17 §4b.0 / 4b.0c / 4b.6 / 4b.7** — hotel-first ekran, forma za unos, oznake izvora, izmena po opsegu.
- **M2 §2.3e** — razlika u kvalitetu sobe je nov tip sobe.
- **M7 §5a** — dodela kapaciteta subagentima.

---

## 4. Sledeći zadatak, konkretno

**Ekran „Kapaciteti" se preokreće oko hotela (M17 §4b.0).** Vlasnik je to tražio rečima _„Zamislite ovde 2000 hotela"_ i _„ne dopada mi se da nije sve na jednom mestu od kreiranja kapaciteta, do prikaza i izmene"_. Sadašnji ekran je spisak svega — upotrebljivo dok ih je dvadeset.

Redosled kojim bih to radio (svaki korak je zaokružen i može se pokazati vlasniku):

### Korak 1 — backend: pretraga i radni spisak

Dva nova endpoint-a (M3 §6, već upisani u spec):

- `GET /contracting/capacity/search-hotels` — prediktivna pretraga; vraća naziv, **kategoriju, mesto i državu** i broj izvora. Mesto i država nisu ukras: hoteli istog imena postoje u više zemalja.
- `GET /contracting/capacity/work-queue` — početno stanje ekrana: prekoračenja, blokade pred istek, stop-sale koji se otvara, rokovi povrata, tipovi soba sa 0–2 preostale jedinice u narednih 30 dana.

Podaci za oba već postoje (`CapacityService.grid`, `expiringReleases`, `listBlocks`) — ovo je uglavnom sastavljanje, ne nov izvor.

### Korak 2 — ekran: dva stanja

Radni spisak kao početno stanje, pun kalendar tek za pretražen hotel. **Mreža bez izabranog hotela ili bez sužavajućeg filtera se ne prikazuje.** Prazan radni spisak se ispisuje rečenicom („Ništa ne traži pažnju danas"), ne praznim ekranom — inače se čita kao kvar (zamka 7.2).

### Korak 3 — forma za unos po opsegu (M17 §4b.0c)

Redosled polja je **utvrđen i nije stvar ukusa**: hotel → **Rezervacije od…do** → period boravka → tipovi soba → ugovor → broj jedinica i status. Prozor prijave stoji **iznad** boravka; tako je i na uzoru (PrimeTravel), i tako se o kontingentu govori u ugovoru.

Tri stvari koje forma mora da uradi:

1. Da na ekranu piše da je unos **prepisivanje, ne sabiranje** (M3 §2.3e.3).
2. Da potvrda ispiše **broj noći i dan odjave** („20.07.–29.07., 10 noći, 30.07. je dan odjave"). „20–30.07." može značiti 10 ili 11 noći i to je najčešća greška u ovom poslu.
3. Da svaka potvrđena izmena po opsegu ima **„poništi"**.

Polja `bookingFrom`/`bookingTo` backend **već prima** (`POST`/`PATCH` na periodu) — panel ih još ne šalje.

### Korak 4 — traka sa četiri broja (M17 §4b.2a)

Putnici, noćenja, prosečna cena po putniku, prihod — za filter koji je već postavljen na mreži. Čita M13, ne računa ponovo. Vlasnik je ovo izričito tražio.

**Tek posle toga** ide M3 §2.9 (više izvora) i §2.10 (redosled prodaje) — jer oni traže M4 uparivanje, a to je zaseban posao sa sopstvenim ekranom.

---

## 5. Šta je već pokušano ili odlučeno — nemoj ponovo

- **Deljeni bazen kapaciteta između ugovora istog hotela — odbijeno.** Laže čim se dva ugovora preklope po datumima. Rešenje je zbirni red + upozorenje (M3 §2.9e, dok. 44 §11.2).
- **„Klik na hotel otvara ugovore pa se tamo menja" — odbijeno.** To je isti odlazak sa ekrana koji je vlasnik i prijavio kao smetnju (dok. 44 §11.1).
- **„Fiksni zakup se prodaje prvi" — odbijeno od strane vlasnika.** Osnovni filter je najniža cena; neprodat zakup se rešava cenom i upozorenjem (M3 §2.10e).
- **Sabiranje kapaciteta različitih izvora u jedan broj — nikad.** Mogu biti iste fizičke sobe.
- **Oduzimanje naših prodaja od broja koji javi API provajder — nikad.** Njihov broj je već neto (zamka **3.8**).
- **Agent koji menja kapacitete bez potvrde čoveka — ne pravi se**, ni kad se pokaže tačnim (M3 §4.4).

---

## 6. Jedno odstupanje od specifikacije koje treba da znaš

M3 §2.8c je predviđao da se konkurentnost po danu reši **bez ijednog novog brojača** — zaključaj `CapacityDay` red i upiši stavku u istoj transakciji. **To ne radi u stvarnom M5 toku**, jer između rezervacije kapaciteta i upisa stavke stoji HTTP poziv spoljnom provajderu, a takav poziv se ne sme držati unutar otvorene DB transakcije.

Zato `capacity_days` ima `units_reserved` — **brava, ne izvor istine**. Prikaz i dalje **računa** prodato iz `BookingItem`-a. Puno obrazloženje: **M3 §2.8f**. Ako budeš dodavao nešto što čita kapacitet, čitaj iz izračuna, ne iz tog brojača.

---

## 7. Jedno pitanje koje čeka vlasnika

**Da li se tranše kapaciteta sabiraju?** Odlučeno je da **ne** — „10 soba za prijave do 31.3., 5 za prijave posle" je isti fizički kontingent iskazan dvaput, ne 15 soba (M3 §2.3e.3). Tako radi i uzor. Vlasnik je obavešten i zamoljen da javi ako je kod njega ikad drugačije, ali **nije to izričito potvrdio**. Ako se javi da jeste drugačije, menja se izračun raspoloživosti, ne samo prikaz.

---

## 8. Okruženje — tri stvari koje će te sigurno ugristi

1. **Pre `prisma migrate` ugasi API dev server.** Drži `query_engine-windows.dll.node` i migracija tiho visi bez poruke o grešci. Ugasi i `nest start --watch` i osamostaljen `node dist/src/main` proces. (Zamka 12, 5.18.)
2. **`prettier --check` lokalno na Windows-u ne dokazuje ništa** — radna kopija je CRLF, a u gitu je LF. CI je jedini pravi test. Ako CI padne na „Prettier — format", proveri **commit-ovan** sadržaj: iskopiraj ga kroz `git show HEAD:<fajl>` u prazan folder sa `.prettierrc.json` pa tamo pokreni `--check`. (Zamka 11.)
3. **Posle `git push` obavezno pogledaj CI** (`gh run list --limit 1`). Ako padne e2e koji lokalno prolazi — **prvo ponovi** (`gh run rerun --failed`) pre nego što „popravljaš" test. (Zamka 11.4.)

---

## 9. Kako da znaš da si gotov

Ne po tome što se ekran otvara. Po ovome:

- Stavke izlaznog kriterijuma u M3 §7 i M17 koje si dirao su štriklirane **sa dokazom** (šta je pokrenuto, šta je vraćeno), ne „uglavnom radi".
- Ekran je viđen u **pravom browseru**, prijavljen kao pravi korisnik, nad podacima iz baze — ne samo `tsc` i testovi. (`tools/qa-screenshot.mjs`.)
- Kontrast boja je **izmeren** (`node tools/check-contrast.js`), ne procenjen okom.
- Backend i ekran su u **istom prolazu**. „Logika postoji, UI ne" je nezavršeno, isto kao i obrnuto.
- Sve je commit-ovano i push-ovano, i CI je zelen.

Ako neka od ovih tačaka ne stoji, reci vlasniku šta tačno nedostaje — to je uvek bolje od tihe rupe. Poslednja takva rupa (rezervacija koja ne poštuje stop-sale) je stajala zapisana i zatvorena je čim je došla na red, upravo zato što je bila napisana.
