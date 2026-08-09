# Validacija toka — Scenario 1: B2C gost, direktna rezervacija sa sajta

**Status: REŠENO (avgust 2026).** Svih 8 nalaza iz tabele na kraju ovog dokumenta upisano je u odgovarajuće spec fajlove — M3 (§2.2a), M4 (§3.1), M5 (§3.1, §4.0a, §6.3, §11), M8 (§3), M10 (§5.1a, §6.0, §6.2, §8.0). Ovaj dokument ostaje kao istorijski zapis analize — za trenutno važeće pravilo uvek proveriti sam spec fajl modula, ne ovaj dokument.

**Svrha ovog dokumenta:** provući jedan konkretan, realan slučaj rezervacije kroz postojeću specifikaciju, korak po korak, i eksplicitno označiti gde specifikacija ima rupu, kontradikciju ili nedefinisanu stvar — na zahtev vlasnika (avgust 2026), posle uočenih propusta u `/search` parametrima i vidljivosti dobavljača. Ovo je radni/validacioni dokument, ne Nivo 2 specifikacija modula — ne menja nijedan postojeći spec fajl.

**Scenario:** gost dolazi na sajt Terminal Travel (M8), bez naloga, i kupuje paket aranžman u hotelu koji je agencija direktno ugovorila (M3, `CONTRACTED`), plaća karticom, agencija nastupa kao organizator putovanja (`tip_nastupanja = ORGANIZATOR`).

---

## Korak 0 — Preduslovi (postoje pre nego što gost i dođe)

1. **M3** — `Supplier` (hotel) kreiran, `Contract` potpisan, `ContractPeriod` za leto 2027 sa `allotment_mode = FIXED`, `RateLine` cene po tipu sobe/usluge, `CancellationRule`. Moguće da je cenovnik stigao kao PDF i prošao AI uvoz (M3 §4.2) — ali stvaran upis u `ContractPeriod`/`RateLine` je uvek posle ljudskog odobrenja (§4.2.4).
2. **M5** — `MarkupRule` mora postojati za tog dobavljača pre nego što `Contract` pređe u `ACTIVE` (M5 §2.2, ograda) — sprečava prodaju bez marže.
3. **M2** — `Product` kreiran sa `source_type = CONTRACTED`, `source_contract_id` ka ugovoru (M3 §3); prevodi sr/en obavezni pre `ACTIVE` (M2 §2.2); `visible_channels` uključuje `B2C_SITE` (M2 §5).
4. **M11** — `TravelGuarantee` aktivna, sa dovoljnim `coverage_amount` da primi ovu prodaju (proveriće se tek pri potvrdi, korak 5).

**Nalaz:** ovaj deo je čvrsto pokriven — nijedna rupa.

---

## Korak 1 — Pretraga (M8 §3, korak 1 → M5 §11 `/search`)

Gost dolazi na `/pretraga`, bira destinaciju/datume/broj gostiju. Poziva se `GET /search` (M5 §11), koji spaja M2+M3+M4 i vraća cenu sa već primenjenom maržom.

**🔴 Nalaz (već ranije identifikovan, ostaje otvoren):** `/search` u M5 §11 nema definisane query parametre — nema navedenog `type`, `destination`, `stay_from`/`stay_to`, `occupancy`. M8 pretpostavlja da ovi parametri postoje ("destinacija, datumi, gosti"), ali M5 ih formalno ne definiše. Ovo je rupa koja se mora zatvoriti pre implementacije — trenutno nijedan tim/AI agent ne bi znao tačan ugovor endpointa.

---

## Korak 2 — Izbor i Ponuda (M8 §3, korak 2 → M5 §3)

Kreira se `Quote` (M5 §3.1), `client_account_id = null` (gost još nije identifikovan — dozvoljeno). `QuoteItem` računa cenu: `base_cost` iz `RateLine` → `MarkupRule` (M5 §2.1) → ako je gost ulogovan, popust lojalnosti (M6 §3.3, poziv ka `/loyalty-status`). Pošto gost u ovom scenariju nije ulogovan, popust se ne primenjuje — korektno, nema rupe ovde.

---

## Korak 3 — Podaci gostiju (M8 §3, korak 3 → M6)

Gost bira "nastavi bez naloga" → kreira se minimalan `GuestProfile`/`ClientAccount` u M6.

**🟡 Manji nalaz:** M8 §3 kaže da se kreira "minimalan `ClientAccount`", ali ne kaže eksplicitno koja vrednost ide u `account_type` (`INDIVIDUAL`/`LEGAL_ENTITY`, M6 §2.1) — razumna pretpostavka je `INDIVIDUAL`, ali nigde nije pismeno potvrđeno. Sitno, ali vredi eksplicitno upisati, jer `account_type` direktno određuje SEF/ESIR izbor u M10 (§2).

---

## Korak 4 — Prihvatanje ugovora, clickwrap (M8 §3, korak 4 → M20 §3.2)

Gost potvrđuje "Prihvatam uslove ugovora" pre plaćanja. M8 §3 kaže: *"ovaj klik se privremeno beleži uz `Quote` i primenjuje na `ClientContract` čim on nastane"*.

**🔴 Ozbiljan nalaz:** `Quote` entitet (M5 §3.1) **nema nijedno polje** za čuvanje ovog pristanka (nema `contract_terms_accepted`, `accepted_at` ili slično). M8 specifikacija pretpostavlja mehanizam koji M5 model podataka trenutno ne podržava. Ovo mora da se dopuni — ili dodavanjem polja na `Quote` (M5 §3.1), ili definisanjem posebnog privremenog zapisa koji M20 kasnije čita. Trenutno je ovo neizvodljivo tačno onako kako je opisano.

---

## Korak 5 — `tip_nastupanja` i potvrda rezervacije (M5 §4, M10 §4.1)

Pre nego što M5 pokrene tok potvrde, mora se znati `Booking.tip_nastupanja` (`ORGANIZATOR`/`POSREDNIK`) — ono direktno određuje PDV tretman (M10 §4), proveru garancije putovanja (M11 §4.2), i tip ugovora sa klijentom (M20 §2.2).

**🔴 Kritičan nalaz:** M10 §4.1 kaže eksplicitno: *"Ovo polje bira prodajni tim/agent pri potvrdi rezervacije"*. Ali u ovom scenariju **nema prodajnog tima** — gost sam, na sajtu, potvrđuje sopstvenu rezervaciju, potpuno samostalno (M8 §3 je dizajniran kao samoposlužni tok od početka do kraja). Nigde u dokumentaciji nije definisano ko ili šta postavlja `tip_nastupanja` za samostalnu B2C rezervaciju sa sajta. Ovo nije kozmetički propust — bez ove vrednosti, M5 §4 korak 1 ne može da odluči da li uopšte da pozove M11 proveru garancije, M10 ne zna po kojoj formuli da obračuna PDV, M20 ne zna koji `contract_type` da generiše. Ovo je verovatno **najvažniji nalaz u celom ovom vežbanju** — mora se rešiti pre nego što M5/M8 dođu na red za implementaciju. Realno rešenje je verovatno: pošto agencija kroz M8 uvek prodaje sopstveni katalog kao organizator (osim kad izričito posreduje za tuđi aranžman), vrednost bi trebalo da bude izvedena iz `Product`/`Contract` konfiguracije (npr. novo polje na `Contract` ili `Product` koje kaže "ovaj proizvod se uvek prodaje kao ORGANIZATOR/POSREDNIK"), ne da je bira čovek koji ne postoji u ovom toku — ali ovo je odluka koju treba doneti eksplicitno, ne pretpostaviti.

Dalje, M5 §4:
1. Provera isteka Ponude, provera garancije (M11, ako se `tip_nastupanja` uopšte zna).
2. Poziv M3 `/contracts/:id/periods/:periodId/reserve` — uspeh, `FIXED` alotman.
3. "Sve ili ništa" — nema drugih stavki koje bi propale u ovom scenariju.
4. `Booking` kreiran, `status = CONFIRMED`.
5. Emituju se događaji (M5 §9).

**Redosled sa plaćanjem (M10 §7.2):** za karticu na sajtu, M10 prvo inicira naplatu (`initiatePayment`), pa **tek posle uspeha** M10 poziva M5 da pokrene tok potvrde iz §4 iznad. Ovo je ispravno dokumentovano na oba mesta (M8 §3 korak 5, M10 §7.2) — nema kontradikcije, samo je vredelo eksplicitno proveriti jer je redosled neintuitivan (plaćanje pre potvrde, ne posle).

---

## Korak 6 — Šta se dešava po `booking.confirmed` (M5 §9)

M5 §9 navodi da se pretplaćuju: M6 (istorija), M10 (fakturisanje), M11 (eTurista + CIS garancija), M12 (marketing), M20 (ugovor sa klijentom).

Provera po modulu:
- **M6** — §3.2 eksplicitno opisuje pretplatu na `booking.confirmed`, automatski preračun lojalnosti. ✅ Konzistentno.
- **M11 eTurista** — §2.2 kaže da se šalje "odmah po potvrdi rezervacije, ako je poznato unapred" ili na `check_in_date`. ✅ Konzistentno, deterministički.
- **M11 CIS garancija** — §4.3 eksplicitno: "kad `Booking.status` pređe u `CONFIRMED`... kreira se zapis". ✅ Konzistentno.
- **M20** — §3.1 eksplicitno: "Čim `Booking.status` pređe u `CONFIRMED`... M20 automatski generiše `ClientContract`". ✅ Konzistentno.
- **M10 fakturisanje** — 🔴 **Nalaz:** M10 specifikacija **nigde ne opisuje** da se `FiscalDocument` nacrt automatski kreira po `booking.confirmed` događaju. M10 §10 izlaže `POST /fiscal-documents/draft` kao endpoint koji prima `booking_id` — ali ne kaže ko/šta ga poziva niti kada. M5 §9 sugeriše da M10 "sluša" ovaj događaj isto kao M6/M11/M20, ali sam M10 dokument to ne potvrđuje niti definiše automatski okidač. Ovo je nekonzistentnost između dva dokumenta koja mora da se reši — verovatno rešenje: dodati u M10 eksplicitno pravilo da se nacrt automatski priprema (nivo "Autonomno", isto kao M20 §3.1), analogno ostalim modulima.

**🟡 Dodatni nalaz (boravišna taksa):** M11 §3.2 kaže da se iznos boravišne takse "unosi kao stavka na `FiscalDocument` u M10", ali M10 §10 (API ugovor) nigde ne pokazuje da `POST /fiscal-documents/draft` poziva M11 da dobije stopu (`TouristTaxRate`). Logička veza postoji u tekstu, ali nije eksplicitno ožičena kroz API ugovor — vredi dopuniti M10 §10 da jasno kaže da priprema nacrta poziva M11.

---

## Korak 7 — Vaučer (M5 §6, M20 §3.3)

Vaučer se generiše kad je `payment_status = PAID` **i** `ClientContract.status >= GENERATED`. Pošto je kartica već naplaćena pre potvrde (korak 5) i `payment_status` odmah postaje `PAID`, a `ClientContract` se generiše automatski istog trenutka (korak 6), ovo praktično radi bez čekanja. ✅ Konzistentno, dobro povezano između M5/M10/M20.

---

## Korak 8 — Fiskalni dokument, slanje (M10 §6)

Kad nacrt postoji (uz nalaz iz koraka 6), **slanje** (`DRAFT → SUBMITTED`) zahteva isključivo ljudski nalog (Vlasnik, Direktor, Računovođa) — "Nikad autonomno".

**🟡 Nalaz (operativna, ne arhitektonska rupa):** u potpuno samoposlužnom B2C toku (gost sam rezerviše i plaća, bez ljudskog kontakta), svaka takva rezervacija generiše fiskalni dokument koji **mora** čekati da neko od troje ljudi ručno klikne "Pošalji". Ovo je namerno i ispravno sa zakonske strane (§6, "Nikad autonomno"), ali dokumentacija nigde ne postavlja operativni mehanizam/SLA koji bi obezbedio da ovo ne kasni (osim reaktivnog `RECONCILIATION_MISMATCH` alarma iz M10 §5.3, koji se javlja tek kad nešto već kasni). Vredi razmotriti frontend "red čekanja" prikaz u M17 (Agent Inbox, isti obrazac kao M5 §6.1), ne samo alarm posle činjenice.

---

## Korak 9 — Obaveza prema dobavljaču (M10 §8)

**🔴 Nalaz:** M10 §8 (`SupplierObligation`) definiše polja i tok odobravanja, ali **nigde ne kaže šta konkretno pokreće kreiranje** ovog zapisa. Mogућа su dva različita modela — (a) sistem automatski kreira `SupplierObligation` čim `BookingItem.item_status = CONFIRMED` za `CONTRACTED` stavku, na osnovu `RateLine` cene; ili (b) zapis nastaje tek kad stigne stvarna ulazna faktura dobavljača (`invoice_reference` polje to sugeriše). Ovo su suštinski različiti operativni tokovi i dokumentacija ne bira između njih — mora se eksplicitno odlučiti, jer utiče i na M13 (BI/profitabilnost) i na to da li je moguće imati "obavezu" pre nego što dobavljač uopšte pošalje račun.

---

## Korak 10 — Operativna lista ka dobavljaču (M5 §8)

AI agent periodično priprema nacrt (`SupplierManifest`, DRAFT) agregacijom potvrđenih stavki po `ContractPeriod`; čovek šalje. ✅ Dobro specificirano, nema rupe.

---

## Rezime nalaza — Scenario 1 (B2C)

| # | Ozbiljnost | Nalaz | Gde se rešava |
| :---- | :---- | :---- | :---- |
| 1 | 🔴 Kritično | `tip_nastupanja` nema definisanog nosioca odluke u potpuno samoposlužnom B2C toku | M5 §4 / M10 §4.1 / M2 ili M3 (poreklo pravila) |
| 2 | 🔴 Ozbiljno | `Quote` nema polje za privremeno čuvanje clickwrap pristanka pre nego što `ClientContract` postoji | M5 §3.1 |
| 3 | 🔴 Ozbiljno | M10 ne definiše automatski okidač za `FiscalDocument` nacrt po `booking.confirmed`, iako M5 §9 to sugeriše | M10, novo poglavlje |
| 4 | 🔴 Ozbiljno | Nije definisano šta pokreće kreiranje `SupplierObligation` (automatski pri potvrdi, ili tek po ulaznoj fakturi dobavljača) | M10 §8 |
| 5 | 🟡 Manje | `/search` (M5 §11) nema definisane query parametre (ranije identifikovano) | M5 §11 |
| 6 | 🟡 Manje | Nije eksplicitno rečeno da anonimni gost bez naloga dobija `account_type = INDIVIDUAL` | M8 §3 / M6 §2.1 |
| 7 | 🟡 Manje | M10 API ugovor ne pokazuje eksplicitan poziv ka M11 za stopu boravišne takse | M10 §10 |
| 8 | 🟡 Operativno | Nema proaktivnog prikaza reda čekanja za ručno slanje fiskalnih dokumenata iz samoposlužnih B2C rezervacija | M17 / M10 |
