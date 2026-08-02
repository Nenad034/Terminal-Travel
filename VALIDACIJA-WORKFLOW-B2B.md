# Validacija toka — Scenario 2: B2B subagent kupuje za svog krajnjeg klijenta

**Status: REŠENO (avgust 2026).** Svi nalazi iz tabela ovog dokumenta upisani su u spec fajlove — M5 (§4.0a, §6.3, §11), M7 (§2.0, §5), M10 (§5.1a). Nalaz o kreditnom limitu naspram vaučera (najozbiljniji u ovom scenariju) rešen je poslovnim pravilom u M5 §6.3 — vidi napomenu tamo. Ovaj dokument ostaje kao istorijski zapis analize — za trenutno važeće pravilo uvek proveriti sam spec fajl modula.

**Svrha:** isti postupak kao `VALIDACIJA-WORKFLOW-B2C.md`, primenjen na B2B/subagent granu. Radni/validacioni dokument, ne menja postojeće spec fajlove.

**Scenario:** "Sunny Travel d.o.o." je odobren Tier 1 subagent (M7), sa kreditnim limitom i proviziom koje je postavio Vlasnik. Njihov `SUBAGENT_ADMIN` nalog kupuje isti hotelski paket kao u B2C scenariju, za svog krajnjeg klijenta, plaćanje na kredit (avans/faktura, ne kartica).

---

## Korak 0 — Preduslovi

Isti kao B2C scenario (M3 ugovor, M2 proizvod, M5 MarkupRule) — plus:
- **M7** — `Subagent` zapis postoji, `status = ACTIVE`, `commission_percentage` i `credit_limit` postavljeni od Vlasnika/Direktora (M7 §9). `client_account_id` referencira M6 `ClientAccount` sa `account_type = LEGAL_ENTITY`.

**Nalaz:** ✅ nema rupe u preduslovima.

---

## Korak 1 — Pristup portalu i pretraga

**🔴 Strukturni nalaz:** M8 (sajt) ima poglavlje 2 ("Struktura sajta i rute") i poglavlje 3 ("Tok pretrage i rezervacije — korak po korak") koji precizno opisuju svaku stranicu i svaki korak toka. **M7 nema ekvivalent.** M7 specifikacija opisuje model podataka, proviziju, kreditni limit, hijerarhiju — ali nigde ne opisuje **stvaran tok kroz portal** (koje stranice postoje, kako izgleda pretraga za subagenta, kako izgleda ekran ponude, gde se prikazuje njegova provizija/kreditni limit u toku kupovine). Ovo je veći nedostatak od pojedinačnih propusta u poljima — M7 trenutno nije na istom nivou detalja kao M8, iako su oba kanala istog ranga u arhitekturi (M8 §Faza 3, M7 §Faza 4). Pre implementacije M7, potreban je ekvivalent M8 §2/§3.

Pretraga i dalje ide kroz `GET /search` (M5 §11, `channel = B2B_PORTAL`) — isti nalaz kao B2C: nema definisanih parametara.

---

## Korak 2 — Ponuda i cena (M5 §3, M7 §5)

`Quote` se kreira sa `client_account_id` = subagentov `ClientAccount`, `channel = B2B_PORTAL`. Cena: `base_cost` → `MarkupRule` (M5 §2) → **M5 prepoznaje da je `client_account_id` Subagent** i primenjuje proviziju (M7 §5) umesto M6 popusta lojalnosti.

**🟡 Nalaz:** M5 §5 (dopunjeno M7 specifikacijom) kaže samo "M5 prepoznaje da je `Quote.client_account_id` Subagent" — ne kaže **kako**. Da li je to provera `ClientAccount.account_type = LEGAL_ENTITY` (nedovoljno — postoji i obično pravno lice koje nije registrovan subagent), ili eksplicitna provera postojanja `Subagent` zapisa sa tim `client_account_id`-jem (M7 §2.1)? Verovatno drugo, ali nije eksplicitno napisano u M5 poglavlju 5 — vredi dopisati jednu rečenicu da spreči dvosmislenost pri implementaciji.

Zatim se primenjuje `effective_commission_percentage` iz `SubagentVolumeStatus` (M7 §3.1), koji već uključuje osnovnu proviziju i eventualni obimski bonus. ✅ Sama formula i redosled su jasni.

---

## Korak 3 — Kreditni limit i `tip_nastupanja` (M7 §4, M5 §4)

Pre pokretanja toka potvrde, M5 proverava `current_outstanding_balance + Quote.total_price <= credit_limit` (M7 §4) — **pre** bilo kog poziva ka M3/M4. Ako je `tip_nastupanja = ORGANIZATOR`, M5 §4 korak 1 takođe zahteva proveru M11 garancije putovanja pre poziva ka M3/M4.

**🔴 Nalaz A (nadovezuje se na isti nalaz iz B2C scenarija):** kreditna provera (M7 §4) i provera garancije (M11 §4.2) su obe opisane kao da se dešavaju "pre bilo kog poziva ka M3/M4", ali **redosled ta dva međusobno** nije definisan — koja se radi prva? Sitno, ali za ispravan i predvidljiv error-response (koja poruka se prikazuje subagentu ako oba uslova padnu) redosled treba biti eksplicitan.

**🔴 Nalaz B (isti korenski problem kao B2C, ovde još izraženiji):** ko postavlja `tip_nastupanja` za rezervaciju koju subagent sam kreira na portalu? Isti problem kao B2C — nema "prodajnog tima" u ovom toku. Dodatno pitanje specifično za B2B: kad Sunny Travel kupuje TT-ov paket da bi ga dalje prodao svom klijentu, da li je TT i dalje `ORGANIZATOR` (jer je paket i dalje TT-ov proizvod, subagent je samo distribucioni kanal) — ovo se čini kao jasan odgovor "da", ali dokumentacija to nigde eksplicitno ne kaže za B2B slučaj, samo pretpostavlja generičko pravilo iz M10 §4.1 koje uopšte ne predviđa samoposlužni kanal.

---

## Korak 4 — Potvrda rezervacije (M5 §4)

Isti mehanički tok kao B2C (rezerviši kod M3, sve ili ništa, `Booking` kreiran). `payment_status` može ostati `UNPAID` ili `INVOICE_PENDING` — eksplicitno dozvoljeno (M5 §4.1: "B2B kredit i avansno plaćanje su podržani od starta"). ✅ Nema rupe u samom mehanizmu potvrde.

`BookingItemGuest` — subagent unosi podatke stvarnog putnika (M7 §7), koji nema sopstveni portal nalog kod TT. ✅ Jasno pokriveno, koristi postojeći `GuestProfile` model bez novih polja.

---

## Korak 5 — Vaučer i kredit — 🔴 najozbiljniji nalaz u ovom scenariju

M5 §6: vaučer se **podrazumevano ne generiše** dok `payment_status != PAID`. Izuzetak postoji, ali zahteva **ručno odobrenje Vlasnika ili Direktora**, svaki put, sa obrazloženjem (`voucher_override_*` polja).

**Problem:** B2B prodaja na kredit (avans + faktura sa rokom) je **redovan, očekivan način poslovanja** sa subagentima, ne izuzetak — cela poenta kreditnog limita (M7 §4) jeste da subagent može da posluje bez trenutne pune uplate. Ali subagentu **treba vaučer odmah** da bi mogao da servisira svog sopstvenog klijenta (potvrdi hotel, izda putniku dokument) — ne može da čeka da agencija naplati ceo iznos, što po ugovorenim rokovima može biti i 30-60 dana posle putovanja.

Trenutna specifikacija bi značila da **svaka** kreditna B2B rezervacija zahteva ručnu intervenciju Vlasnika/Direktora da izda vaučer — što ne skalira ako TT ima više aktivnih subagenata koji redovno prodaju na kredit. Ovo nije sitna nedoslednost — ovo je stvarna napetost između M5 §6 (pravilo pisano sa B2C rizikom na umu — spreči izdavanje dokumenta bez novca) i M7 poslovnog modela (kredit je normalan, ne izuzetak). Predlažem da se ovo eksplicitno reši — na primer, subagent sa `ACTIVE` statusom i rezervacijom unutar odobrenog `credit_limit` bi trebalo da ima **drugačije, sistemsko pravilo** za izdavanje vaučera (ne pojedinačni ručni override), dok bi override ostao rezervisan za slučajeve **van** kreditnog limita ili van standardnog odnosa. Ovo je poslovna odluka za tebe, ne nešto što ja treba sam da rešim.

---

## Korak 6 — Fiskalni dokument (M10 §2, §4)

Subagent je pravno lice → `SEF_EFAKTURA`. Isti nalaz kao B2C (nalaz #3 iz tog dokumenta) — nedefinisan automatski okidač za pripremu nacrta. Ovde dodatno: `buyer_name_snapshot`/`buyer_tax_id_snapshot` (M6 §8 dopuna M10) uzima se iz subagentovog `ClientAccount`, ne krajnjeg putnika — ✅ ispravno, konzistentno sa M20 §3.2 koje takođe kaže da je ugovor sa subagentom, ne krajnjim putnikom.

---

## Korak 7 — Ugovor sa klijentom (M20 §3.2)

M20 eksplicitno pokriva ovaj slučaj: subagent (SUBAGENT_ADMIN) prihvata clickwrap **u ime svog naloga** u trenutku potvrde na portalu; odnos subagenta sa **svojim** krajnjim klijentom je van obima TT ugovora. ✅ Ovo je jedno od najbolje pokrivenih mesta u celoj specifikaciji — nema rupe.

Napomena: isti nalaz kao B2C nalaz #2 (nema polja na `Quote` za privremeno čuvanje pristanka) važi i ovde, isti mehanizam.

---

## Korak 8 — Obimski bonus i retroaktivni rabat (M7 §3.1–3.2)

Ako Sunny Travel u toku kvartala pređe prag obima sa `retroactive = true`, sistem automatski kreira `CommissionRebate` (`DRAFT`), Računovođa/Vlasnik/Direktor odobrava, pa se `APPLIED` rabat "knjiži kao umanjenje sledeće fakture/dugovanja subagenta u M10 (kredit, ne izmena postojećeg fiskalnog dokumenta)" (M7 §3.2).

**🔴 Nalaz (mogući komplijans problem, ne samo tehnički propust):** M10 `FiscalDocument.document_type` (§5.1) ima samo dve vrednosti: `SEF_EFAKTURA` i `ESIR_RACUN`. Ne postoji tip za **knjižno odobrenje** (credit note) — standardan dokument u SEF sistemu kad se naknadno umanjuje dugovanje kupca. M7 §3.2 kaže da se rabat "knjiži kao kredit" u M10, ali M10 nema definisan mehanizam ili tip dokumenta za to koji bi zaista poštovao SEF format. Storno (M10 §6.1) ne odgovara ovome — storno poništava **konkretnu** fakturu zbog otkazivanja rezervacije, dok je rabat opšti kredit nevezan za jednu rezervaciju. **Ovo zahteva potvrdu knjigovođe** (isti obrazac kao ostale finansijske ograde u M10 §9/§12) pre implementacije — trenutno je to jedina praktična rupa koja može dovesti do stvarno pogrešnog fiskalnog postupanja, ne samo nezgodne UX.

---

## Korak 9 — Vidljivost dobavljača (M2 §5.1, M5 §6.2)

Subagent ne vidi identitet dobavljača — pravilo koje smo upisali ranije u ovom razgovoru. ✅ Proveravam da li se uklapa u ovaj scenario: da. Subagent vidi proizvod (hotel, datumi, cena za njega), ne vidi `source_contract_id`/`Supplier`. Konzistentno.

---

## Korak 10 — Obaveza prema dobavljaču, isplata

Isti nalaz kao B2C (nedefinisan okidač za `SupplierObligation`) — nema dodatnog B2B-specifičnog problema ovde, dobavljač se plaća isto bez obzira ko je krajnji kupac.

---

## Rezime nalaza — Scenario 2 (B2B)

| # | Ozbiljnost | Nalaz | Gde se rešava |
| :---- | :---- | :---- | :---- |
| 1 | 🔴 Kritično | Vaučer se ne izdaje bez pune uplate ili ručnog override-a — ali B2B kredit je redovan način poslovanja, ne izuzetak; trenutno pravilo ne skalira | M5 §6 / M7, poslovna odluka vlasnika |
| 2 | 🔴 Ozbiljno | M10 `FiscalDocument.document_type` nema tip za knjižno odobrenje (credit note); nejasno kako se `CommissionRebate` stvarno provodi kroz SEF | M10 §5.1, uz potvrdu knjigovođe |
| 3 | 🔴 Strukturno | M7 nema ekvivalent M8 §2/§3 — nedostaje opis stvarnog toka kroz B2B portal (stranice, koraci) | M7, novo poglavlje |
| 4 | 🔴 Isto kao B2C #1 | `tip_nastupanja` nema nosioca odluke u samoposlužnom toku — dodatno nejasno za B2B distribuciju TT-ovog proizvoda | M5 §4 / M10 §4.1 |
| 5 | 🟡 Manje | Nije eksplicitno kako M5 prepoznaje da je `client_account_id` Subagent (provera tipa vs. provera postojanja zapisa) | M5 §5 |
| 6 | 🟡 Manje | Redosled provere kreditnog limita (M7 §4) naspram provere garancije putovanja (M11 §4.2) nije definisan | M5 §4 |
| 7 | ✅ Isto kao B2C #3, #5 | Isti nalazi o automatskom okidaču fiskalnog nacrta i `/search` parametrima važe i ovde | — |

---

## Zajednički presek oba scenarija

Četiri nalaza se ponavljaju u oba toka i zato su najviši prioritet za rešavanje pre nego što se bilo šta počne graditi:

1. **`tip_nastupanja` nema definisanog nosioca odluke** kad nema ljudskog prodavca u toku (i B2C sajt i B2B portal su samoposlužni kanali) — ovo utiče na PDV, garanciju putovanja i tip ugovora u oba scenarija.
2. **`Quote` nema polje za privremeni clickwrap pristanak** pre nego što `Booking`/`ClientContract` postoje.
3. **M10 nema eksplicitan automatski okidač** za pripremu nacrta fiskalnog dokumenta po `booking.confirmed`, iako M5 §9 to podrazumeva.
4. **Nije definisano šta pokreće kreiranje `SupplierObligation`** — automatski pri potvrdi rezervacije, ili tek po prijemu ulazne fakture dobavljača.

Ovo je ono što bih predložio da se prvo reši, pre nego što se pređe na bilo koji drugi rad — ostali nalazi (parametri pretrage, redosled provera, M7 struktura toka) su realni, ali manje hitni.
