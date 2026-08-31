# Specifikacija modula M20 — Ugovori sa klijentima

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M20) i poglavlje 8 (Faza 2)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda pravnika pre implementacije
**Status:** Implementiran (Faza 2), avgust 2026 — vidi poglavlje 7 (izlazni kriterijum).
**Verzija:** 1.5 — uskladjeno sa novom M1 §3.9a `VIEW_ALL` konvencijom (31.8.2026): dozvola red (poglavlje 6) i "Otvoreno za dalje" ownership-scoping stavka zamenjeni — "svi podrazumevano vide sve", opšti obrazac sad postoji (M5 spec §6.6), više nije otvoreno arhitektonsko pitanje. v1.4 — ownership provera za Gost kontekst na `GET /client-contracts`[`/:id`] (poglavlje 6), priprema za M8, avgust 2026; v1.3 — implementacija (avgust 2026): (1) ispravljena interna neusklađenost u §2.1 — `booking_id` NIJE hard DB unique (revizija iz §3.4 zahteva više zapisa po rezervaciji), "jedan ugovor po rezervaciji" znači jedan AKTIVAN (ne-VOIDED) zapis, sprovedeno u servisu; (2) dodato `Booking.contract_terms_accepted_at` (M5 dopuna) — kopija istog polja sa `Quote` u trenutku potvrde, jer `Booking` nema `quote_id` referencu nazad; (3) dodato `ClientContract.content_snapshot` (Json) — snimak svih popunjenih elemenata iz §2.3, potreban da `document_url` (mock dok PDF biblioteka/EU cloud skladište ne budu potvrđeni, isti obrazac kao M10/M11) ostane proverljiv sadržaj; (4) precizirano pravilo za mešovitu korpu proizvoda pri određivanju `contract_type` (§2.2) — organizacija putovanja (`PACKAGE`/`ACCOMMODATION`/`EXCURSION`) uvek pobeđuje samostalnu prodaju karte/transfera kad su kombinovani u istoj rezervaciji. v1.2 — dinamika plaćanja (poglavlje 2.3) sad se popunjava iz M10 `ClientPaymentSchedule` (poglavlje 5.4) umesto slobodnog teksta, zatvara problem #4 iz `Problemi koje zelimo da resimo ovom aplikacijom.md` (avgust 2026, na zahtev vlasnika); v1.1 ažurirana referenca na konkretna `Quote.contract_terms_accepted`/`contract_terms_accepted_at` polja (poglavlje 3.2), rešava nalaz iz `VALIDACIJA-WORKFLOW-B2C.md` (avgust 2026, na zahtev vlasnika); v1.0 dodat poređenjem sa ranijim paralelnim dokumentom projekta (`Terminal_Travel_Agency_workflow.html`, modul M-04)
**Zavisi od:** M1, M2, M3, M5, M11. Formalno i od M6 (poglavlje 4 Master dokumenta) kad taj modul postoji — do tada koristi minimalan zapis nalogodavca iz `Booking.client_account_id`, isti obrazac kao M10/M11.

---

## 1. Svrha i obim modula

M20 generiše i čuva **Ugovor o organizovanju putovanja** (ili odgovarajući tip ugovora, poglavlje 2.2) sa gostom/nalogodavcem — zakonski obavezan dokument po Zakonu o turizmu, koji dosad nije postojao nigde u sistemu. Ovo je **treći, zaseban pravni dokument** u lancu rezervacije, različit od:
- M3 (ugovori sa dobavljačima — obrnut smer, agencija kao kupac usluge),
- M10 (fiskalni dokument — poreski/računovodstveni dokaz naplate).

M20 ne duplira podatke — sastavlja ugovor **isključivo iz podataka koji već postoje** u M2 (sadržaj proizvoda), M3 (uslovi otkazivanja), M5 (rezervacija, cena, tip nastupanja), M11 (garancija putovanja). Van obima: sam sadržaj/izgled dokumenta (poglavlje 8), pravno savetovanje o graničnim slučajevima (poglavlje 8).

---

## 2. Model podataka

### 2.1 `ClientContract`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| booking_id | UUID (FK → M5 Booking), unique | jedan ugovor po rezervaciji |
| contract_type | enum: `ORGANIZOVANO_PUTOVANJE`, `POSREDOVANJE`, `PRODAJA_AVIO_KARTE`, `TRANSFER`, `KORPORATIVNI_OKVIRNI` | vidi poglavlje 2.2 |
| status | enum: `DRAFT`, `GENERATED`, `ACCEPTED`, `VOIDED` | `DRAFT` — u pripremi; `GENERATED` — PDF sastavljen, čeka prihvatanje; `ACCEPTED` — gost prihvatio/potpisao; `VOIDED` — poništen (npr. duplikat, greška u rezervaciji) |
| document_url | string, nullable | PDF, EU cloud skladište, generiše se pri prelasku u `GENERATED` |
| generated_at | timestamp, nullable | |
| accepted_at | timestamp, nullable | |
| accepted_method | enum: `ELECTRONIC_CLICKWRAP`, `WET_SIGNATURE_SCAN`, nullable | vidi poglavlje 3.2 |
| voided_by | UUID (FK → M1 User), nullable | |
| supersedes_contract_id | UUID, nullable (FK → self) | popunjeno ako je ovo revidovana verzija ranijeg ugovora — vidi poglavlje 3.4 |
| content_snapshot | JSON | dopuna (implementacija, avgust 2026) — snimak svih popunjenih elemenata iz poglavlja 2.3 u trenutku generisanja, potreban da mock `document_url` (poglavlje 8) ostane proverljiv sadržaj, ne crna kutija |
| created_at / updated_at | timestamp | |

**Napomena (implementacija, avgust 2026):** `booking_id` NIJE hard DB unique constraint, iako "jedan ugovor po rezervaciji" ostaje poslovno pravilo — poglavlje 3.4 zahteva da revizija kreira NOVI zapis dok stari ostaje (VOIDED) u istoriji, što bi bilo nemoguće sa striktnim unique-om. Pravilo se sprovodi u servisu: najviše jedan zapis sa `status != VOIDED` po `booking_id` u bilo kom trenutku.

### 2.2 `contract_type` — određuje se automatski iz `Booking.tip_nastupanja` (M5 poglavlje 4.1) i tipa proizvoda

| `contract_type` | Kad se primenjuje |
| :---- | :---- |
| `ORGANIZOVANO_PUTOVANJE` | `tip_nastupanja = ORGANIZATOR`, proizvod tipa `PACKAGE`/`ACCOMMODATION` sa organizacijom putovanja |
| `POSREDOVANJE` | `tip_nastupanja = POSREDNIK` |
| `PRODAJA_AVIO_KARTE` | Samostalna prodaja `FLIGHT` proizvoda bez organizacije putovanja (granični slučaj — vidi ogradu u poglavlju 8, isti kao otvoreno pitanje u M10 poglavlje 4.4) |
| `TRANSFER` | Samostalna prodaja `TRANSFER` proizvoda van paketa |
| `KORPORATIVNI_OKVIRNI` | Rezervacija B2B nalogodavca sa unapred sklopljenim okvirnim ugovorom (van obima automatskog generisanja — vidi poglavlje 8) |

Agent nikad ručno ne bira `contract_type` — sistem ga izvodi iz postojećih podataka, isti princip kao izbor `document_type` u M10 poglavlje 2.

**Mešovita korpa proizvoda (implementacija, avgust 2026):** tabela iznad ne adresira eksplicitno rezervaciju sa više različitih tipova proizvoda odjednom. Pravilo: ako `tip_nastupanja = ORGANIZATOR` i bar jedna stavka je `PACKAGE`/`ACCOMMODATION`/`EXCURSION` (stvarna organizacija putovanja), `contract_type = ORGANIZOVANO_PUTOVANJE` bez obzira na dodatne `FLIGHT`/`TRANSFER` stavke u istoj rezervaciji — samo isključivo-`FLIGHT` ili isključivo-`TRANSFER` korpa dobija uži `PRODAJA_AVIO_KARTE`/`TRANSFER` tip.

### 2.3 Obavezni elementi ugovora — mapiranje na postojeće podatke (bez dupliranja unosa)

Zakon o turizmu propisuje obavezne elemente organizovanog putovanja. Svaki se popunjava iz već postojećeg izvora, nikad ručno ponovo unosi:

| Obavezan element | Izvor |
| :---- | :---- |
| Naziv/adresa/broj licence agencije | Statička konfiguracija agencije (van modela podataka) |
| Dnevni program (itinerar) | M2 `Product.attributes.itinerary` — **samo za `PACKAGE`/`EXCURSION` proizvode, koji jedini imaju ovo polje** (M2 poglavlje 2.3); za čist `ACCOMMODATION` bez paketa, element se izostavlja kao neprimenjiv, ne prikazuje se kao prazno polje |
| Naziv/kategorija hotela | M2 `Product.attributes.stars`, naziv iz `ProductTranslation` |
| Tip prevoza i klasa | M2 `Product.attributes` (za `TRANSFER`/`FLIGHT`) |
| Tip usluge (pansion) | M3 `RateLine.board_type`, preko `BookingItem.rate_line_id` (M5 poglavlje 4.2) |
| Cena i valuta | `Booking.total_price`/`currency` (M5) |
| Uslovi i penali otkazivanja | M3 `CancellationRule` / M4 `cancellationPolicy`, agregirano po `BookingItem` |
| Naziv osiguravača i broj polise garancije | M11 `TravelGuarantee.provider`/`policy_number` |
| Rok za reklamacije na promenu cene | Statička pravna konfiguracija (konfigurabilno, ne hardkodovano) |
| Kontakt za hitne slučajeve | Statička konfiguracija agencije |

Dinamika plaćanja (iznos akontacije, rok akontacije, rok balansa) popunjava se iz M10 `ClientPaymentSchedule.deposit_amount`/`deposit_due_date`/`balance_due_date` (M10 poglavlje 5.4.2, dopuna avgust 2026) — više nije slobodan tekst, isti princip "bez dupliranja unosa" kao ostali elementi ove tabele.

---

## 3. Generisanje i prihvatanje

### 3.1 Automatsko generisanje — nivo "Autonomno"

Čim `Booking.status` pređe u `CONFIRMED` (M5 poglavlje 4, događaj `booking.confirmed`), M20 automatski generiše `ClientContract` (`DRAFT → GENERATED`) — mehaničko sastavljanje PDF-a iz već proverenih podataka (poglavlje 2.3), bez novog rizika, isti nivo autonomije kao automatska CIS registracija garancije putovanja (M11 poglavlje 2.3). Sistem ne šalje ništa spolja niti stvara novu obavezu — samo formalizuje uslove koji već postoje.

### 3.2 Prihvatanje

- **B2C/sajt (M8) i mobilna aplikacija (M9):** gost elektronski prihvata (clickwrap — potvrdno polje "Prihvatam uslove ugovora") u toku checkout toka, pre finalne potvrde kartičnog plaćanja (M10 poglavlje 7.2) — konkretno, ovaj klik postavlja `Quote.contract_terms_accepted = true`/`contract_terms_accepted_at` (M5 poglavlje 3.1, dopuna avgust 2026 — precizira mehanizam koji je ranije bio opisan samo kao "privremeno se beleži uz Quote"). Ova dva polja se prenose na `ClientContract.accepted_at`/`accepted_method = ELECTRONIC_CLICKWRAP` čim `ClientContract` nastane (poglavlje 3.1). M9 koristi isti API kao M8 (M9 specifikacija, poglavlje 2), pa je tok identičan.
- **Interni panel (M17) / telefon:** ugovor se šalje gostu (email/lično), prihvatanje se evidentira ručno od strane prodajnog agenta kad stigne potpisan/skeniran primerak — `accepted_method = WET_SIGNATURE_SCAN`.
- **B2B portal (M7):** ugovor je i dalje između agencije i **nalogodavca koji plaća** (`Booking.client_account_id` = subagent, M7 poglavlje 5), ne krajnjeg putnika kog subagent prijavljuje — subagent (`SUBAGENT_ADMIN`) prihvata u ime svog naloga kroz isti `Quote.contract_terms_accepted` mehanizam kao M8 (M7 poglavlje 2.0.2, korak 4), u trenutku potvrde rezervacije na portalu, `accepted_method = ELECTRONIC_CLICKWRAP`. Odnos subagenta sa svojim krajnjim klijentom (ako subagent dalje preprodaje) ostaje van obima ovog ugovora — to je posao subagentovog sopstvenog poslovanja, ne agencije Terminal Travel.

### 3.3 Ograda — veza sa vaučerom (dopuna M5 poglavlje 6)

Za `tip_nastupanja = ORGANIZATOR` rezervacije, automatsko generisanje vaučera (M5 poglavlje 6) dodatno zahteva da `ClientContract.status` bude bar `GENERATED` — ugovor mora postojati pre nego što gost dobije vaučer. Tačan trenutak kad `ACCEPTED` (potpis/prihvatanje) mora biti završen u odnosu na izdavanje vaučera potvrđuje se sa pravnikom (poglavlje 8).

### 3.4 Izmena rezervacije posle prihvatanja — obavezna revizija ugovora

Ugovor opisuje konkretne uslove (datumi, cena, sadržaj) rezervacije u trenutku prihvatanja — ako se rezervacija posle toga **izmeni** (M5 poglavlje 6: datum, broj gostiju, sastav stavki), već prihvaćen ugovor više ne opisuje stvarno stanje, što je pravno neprihvatljivo, ne samo kozmetički nedostatak. **Otkazivanje** (delimično ili potpuno) ne pokreće ovo — originalni ugovor ostaje merodavan istorijski zapis uslova pod kojima je otkazivanje/penal i nastao (uključujući `CancellationRule` iz poglavlja 2.3), ne treba mu revizija.

Kad M5 emituje `booking.modified` (M5 poglavlje 9), M20 se pretplaćuje i:
1. Postojeći `ClientContract` (bio `GENERATED` ili `ACCEPTED`) prelazi u `VOIDED` (`voided_by = null` — sistemski, ne ljudska radnja, jer je uzrok već odobrena izmena rezervacije, ne greška).
2. Automatski se generiše nova verzija (`DRAFT → GENERATED`, isti nivo autonomije kao poglavlje 3.1) sa `supersedes_contract_id` ka prethodnoj verziji, sa ažuriranim podacima iz izmenjene rezervacije.
3. Nova verzija **zahteva ponovno prihvatanje** (`status` ne prelazi u `ACCEPTED` automatski, čak i ako je prethodna verzija bila prihvaćena) — isti tok kao poglavlje 3.2, na kanalu kojim je izmena izvršena.
4. Ako je `tip_nastupanja = ORGANIZATOR` i vaučer je već izdat pre izmene, prethodno izdati vaučer ostaje važeći dokument dok se ne izda revidovan (van obima ove specifikacije da definiše tačan mehanizam revizije vaučera — isto pravno pitanje kao poglavlje 3.3).

---

## 4. Uloga AI agenta

Priprema nacrta (`DRAFT → GENERATED`, poglavlje 3.1) je nivo **"Autonomno"** — deterministično sastavljanje iz postojećih podataka, princip #4 (determinizam pre autonomije) iz poglavlja 3 Master dokumenta. AI agent **nikad** ne menja sadržaj ugovora niti odlučuje o `contract_type` mimo automatskog izvođenja iz poglavlja 2.2, i nikad sam ne beleži `accepted_at`/`ACCEPTED` u ime gosta.

---

## 5. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M20/client-contract/VIEW` | Vlasnik, Direktor, Sales Manager, Prodajni agent (svi podrazumevano, isti `VIEW_ALL` obrazac kao M5 poglavlje 6.6/M1 §3.9a); Gost (sopstvena rezervacija) |
| `M20/client-contract/ACCEPT` (ručno evidentiranje) | Vlasnik, Direktor, Sales Manager, Prodajni agent — Gost prihvata sam kroz M8 tok (poglavlje 3.2), ne kroz ovu dozvolu |
| `M20/client-contract/VOID` | Vlasnik, Direktor |

---

## 6. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/client-contracts`

| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/client-contracts` | GET | lista, filtrirano po `booking_id`/statusu (prava pristupa iz poglavlja 5) — Gost (`M20/client-contract/VIEW`, M5 spec §10) dobija samo ugovore SOPSTVENIH rezervacija; `ClientContract` nema sopstveni `client_account_id`, ownership ide preko `booking.client_account_id` (dopuna avgust 2026, priprema za M8 — dozvola sama po sebi ne razlikuje sopstveno od tuđeg, isti obrazac kao M5 §6.2/M6 §7) |
| `/client-contracts/:id` | GET | detalji, uključujući `document_url` — ista ownership provera kao gore |
| `/client-contracts/:id/accept` | POST | beleži prihvatanje — gost sam (M8 tok) ili ručno (`M20/client-contract/ACCEPT`) |
| `/client-contracts/:id/void` | POST | zahteva `M20/client-contract/VOID` |

---

## 7. Izlazni kriterijum (M20 deo Faze 2)

- [x] Ugovor se automatski generiše čim rezervacija pređe u `CONFIRMED`, sa svim obaveznim elementima iz poglavlja 2.3 popunjenim isključivo iz postojećih podataka (M2/M3/M5/M11), bez ručnog dupliranja unosa — testirano e2e (hotel naziv/kategorija/pansion iz M2/M3, cena iz M5).
- [x] `contract_type` se ispravno bira iz `Booking.tip_nastupanja` i tipa proizvoda, bez ručnog izbora — testirano jedinično za sve grane (ORGANIZATOR/POSREDNIK, FLIGHT/TRANSFER samostalno, mešovita korpa, samo-INSURANCE).
- [x] Elektronsko prihvatanje na sajtu (M8) ispravno beleži `accepted_at`/`accepted_method` pre finalne potvrde kartičnog plaćanja — mehanizam testiran (M5 `Booking.contract_terms_accepted_at` kopiran iz `Quote` pri potvrdi, M20 automatski prevodi u `ACCEPTED`/`ELECTRONIC_CLICKWRAP` pri generisanju); sam M8 sajt (Faza 3) još ne postoji da bi se testirao end-to-end kroz pravi checkout UI.
- [x] Vaučer za `ORGANIZATOR` rezervaciju se ne generiše dok `ClientContract` ne postoji bar u statusu `GENERATED` — `ClientContractStubService` (M5) povezan sa stvarnim `ClientContractsService.hasGeneratedContract`, testirano jedinično.
- [x] Svaki `VOID` upisan je u M1 audit log sa identitetom osobe (ili sistema, za automatsko poništavanje pri izmeni rezervacije — poglavlje 3.4) — testirano jedinično i e2e (`actorType: HUMAN` sa identitetom, `actorType: SYSTEM` sa `voided_by = null` za automatsko poništavanje).
- [x] Izmena rezervacije (`booking.modified`) automatski poništava stari ugovor i generiše novu verziju sa `supersedes_contract_id`, koja zahteva ponovno prihvatanje bez obzira na status prethodne verzije — testirano e2e (stari ugovor bio `ACCEPTED`, revizija ipak ostaje `GENERATED`).
- [x] Otkazivanje rezervacije ne pokreće reviziju ugovora — originalni ugovor ostaje nepromenjen kao istorijski zapis; sprovedeno arhitekturno (M20 se pretplaćuje samo na `booking.confirmed`/`booking.modified`, namerno ne na `booking.cancelled` — testirano jedinično da handler za `booking.cancelled` uopšte nije registrovan).
- [ ] Subagent na B2B portalu (M7) ispravno prihvata ugovor u ime sopstvenog naloga u trenutku potvrde rezervacije — mehanizam je isti kao M8 (Quote.contract_terms_accepted → auto-ACCEPTED), ali M7 (B2B modul) još nije implementiran (Faza 4), pa se ne može testirati end-to-end dok taj modul ne postoji.

---

## 8. Otvoreno za dalje

- Tačan izgled/template ugovora po `contract_type` — dizajnersko/pravno pitanje, van obima ove specifikacije, isto obrazloženje kao za format vaučera (M5). Implementirano kao `MockContractDocumentGeneratorAdapter` (sintetički `document_url`) dok se PDF biblioteka/EU cloud skladište ne potvrde sa vlasnikom (CLAUDE.md — nema nove tehnologije bez potvrde) — stvaran sadržaj ugovora se ipak sastavlja i čuva u `content_snapshot`.
- ~~Ownership-scoping za `GET /client-contracts`~~ — opšti obrazac je sad definisan (M1 §3.9a, `VIEW_ALL` konvencija, 31.8.2026); Gost i dalje ima čvrsto ograničenje na sopstvenu rezervaciju (nepromenjeno), a Prodajni agent podrazumevano vidi sve, sa mogućnošću pojedinačnog suženja preko `DENY` na `M20/client-contract/VIEW_ALL` kad se doda (isti obrazac kao M5, poglavlje iznad) — čeka implementaciju, nije više otvoreno arhitektonsko pitanje.
- **Tačan trenutak kad prihvatanje/potpis (`ACCEPTED`) mora biti završen u odnosu na izdavanje vaučera** (poglavlje 3.3) — potvrditi sa pravnikom pre implementacije.
- `contract_type = PRODAJA_AVIO_KARTE`/`TRANSFER` (samostalna prodaja van paketa) — uskladiti sa istim otvorenim pitanjem graničnih slučajeva u M10 poglavlje 4.4/12 (PDV tretman van sistema posebnog oporezivanja).
- `KORPORATIVNI_OKVIRNI` tip — puna specifikacija čeka razradu B2B okvirnih ugovora, van obima ove verzije.
- Samostalna prodaja `INSURANCE` proizvoda (M2) bez ikakvog drugog proizvoda u rezervaciji ne odgovara nijednom postojećem `contract_type` — posredovanje u osiguranju je zasebno regulisano van Zakona o turizmu; potvrditi sa pravnikom da li takva rezervacija uopšte treba `ClientContract` ili se rešava potpuno drugim dokumentom, pre implementacije ovog graničnog slučaja.
