# Gap-analiza: Problemi iz `Problemi koje zelimo da resimo ovom aplikacijom.md` naspram trenutne arhitekture

**Svrha:** Uporediti listu problema koje vlasnik želi da reši aplikacijom (fajl `Problemi koje zelimo da resimo ovom aplikacijom.md`) sa trenutnim stanjem arhitekture (`00-MASTER-ARHITEKTURA.md` i specifikacije M1–M21), i identifikovati šta je već predviđeno, šta je delimično pokriveno, i šta nedostaje.

**Datum:** 2026-08-05

---

## 1. Automatsko praćenje statusa rezervacije i obaveštavanje (nove rezervacije, storno, promene)

**Status: pokriveno, uz manji gap oko "obaveštavanja tima o novim rezervacijama u toku dana".**

`06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 9 definiše event bus događaje (`booking.confirmed`, `booking.pending_supplier_confirmation`, `booking.modified`, `booking.cancelled`) na koje se drugi moduli pretplaćuju. Poglavlje 6.1 dodaje tri konkretna alarma: neplaćena rezervacija sa izdatim vaučerom, otvorena potvrda dobavljača po stavci (>48h), vaučer koji nedostaje uprkos punoj uplati — svi vidljivi u M17 Agent Inbox + email kopija za treću stavku.

**Gap:** ne postoji eksplicitan zbirni "dnevni pregled novih rezervacija/storna" kao gotov izveštaj/notifikacija (npr. "danas stiglo 5 novih rezervacija, 1 storno") — trenutno se sve svodi na pojedinačne alarme i audit log, ne na sumarno obaveštenje tima na kraju/tokom dana.

---

## 2. Praćenje da li je rezervacija najavljena dobavljaču i da li je dobavljač potvrdio

**Status: dopunjeno u specifikaciji (avgust 2026).** Vidi `06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 8.6 — `BookingItem.announced_at`/`supplier_confirmed_at` formalizuju oba koraka, sa alarmima u poglavlju 6.1 (nenajavljena stavka pred boravak, najava bez potvrde). Izvorna analiza ispod je i dalje tačna kao opis stanja pre ove dopune.

**Prethodni status: delimično pokriveno, terminologija i tok nisu formalizovani kao poseban koncept.**

`BookingItem.item_status = PENDING_SUPPLIER_CONFIRMATION` (M5 poglavlje 4, 6.1) prati da li je stavka potvrđena od dobavljača, sa alarmom posle praga (podrazumevano 48h, konfigurabilno po tipu proizvoda). `SupplierManifest` (M5 poglavlje 8) je odvojen koncept — operativna rooming-lista/spisak putnika pred boravak, ne pojedinačna "najava" rezervacije.

**Gap:** termin "najava"/"najavljena" se nigde ne pojavljuje kao formalni status ili polje (npr. `announced_at`, `announcement_confirmed_by`). Nema jasnog razdvajanja "poslata najava dobavljaču" vs. "dobavljač potvrdio najavu" kao svog toka — trenutno `item_status` služi kao surogat, ali nije isto što i eksplicitna najava.

---

## 3. Automatsko slanje najave dobavljaču, konfigurabilno po statusu (npr. tek posle naplaćene akontacije)

**Status: dopunjeno u specifikaciji (avgust 2026), uz jedno svesno ograničenje.** Vidi `06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 8.7 — novi entitet `SupplierAnnouncementRule` (isti obrazac kao `MarkupRule`) čini *pripremu* nacrta konfigurabilnom po dobavljaču i po statusu uplate. Vlasnik je pri specifikaciji ove dopune eksplicitno odabrao da **slanje** dobavljaču i dalje ostaje isključivo ljudska radnja (nivo "Predloži pa čovek odobri", ne potpuno automatsko) — kad uslov bude ispunjen, nacrt se odmah priprema i ističe kao prioritetan u M17 Agent Inbox, ali čovek i dalje klikne "pošalji". Ovo je namerno zadržavanje postojećeg bezbednosnog principa iz M5 poglavlja 8.4 ("slanje nikad nije autonomno"), ne previd. Izvorna analiza ispod opisuje stanje pre ove dopune.

**Prethodni status: nepokriveno.**

`SupplierManifest` slanje (M5 poglavlje 8.4) je uvek ljudska radnja ("Predloži pa čovek odobri"), okidano isključivo agregacijom potvrđenih (`CONFIRMED`) stavki po periodu — nema uslova vezanog za `payment_status`/akontaciju, niti konfigurabilnog pravila po dobavljaču (npr. "za dobavljača X šalji najavu i bez uplate, za dobavljača Y tek posle akontacije").

**Gap: potpuno odsutno.** Ovo zahteva novi koncept — konfigurabilno pravilo po dobavljaču (slično `MarkupRule` šablonu) koje određuje uslov za automatsko slanje najave, plus sam koncept "najave" kao entiteta (vidi problem 2).

---

## 4. Praćenje roka za akontaciju i punu uplatu

**Status: pokriveno (dopunjeno avgust 2026).**

`07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 5.4 dodaje `PaymentTermsConfig` (globalna agencijska politika — procenat akontacije, rok akontacije od potvrde, rok balansa pre polaska, na eksplicitan zahtev vlasnika — nije po ugovoru/dobavljaču niti ručno po rezervaciji) i `ClientPaymentSchedule` (po rezervaciji, snimljene vrednosti u trenutku kreiranja). Probijen rok generiše `HealthSignal` tipa `PAYMENT_DEADLINE_MISSED` (`WARNING`, pa eskalira na `CRITICAL` posle konfigurabilnog broja dana, M18 poglavlje 2.1/2.2) — sistem nikad sam ne menja/otkazuje rezervaciju, isključivo traži ljudsku odluku. M20 (ugovor sa klijentom, poglavlje 2.3) sad iz ovoga popunjava dinamiku plaćanja umesto slobodnog teksta. Ovo je odvojeno od M5 poglavlja 6.1 (koji prati samo da li je vaučer izdat bez pune uplate) — obe provere ostaju, hvataju različite situacije.

---

## 5. Automatsko obaveštavanje o CIS/eTurista registraciji

**Status: pokriveno za CIS/YUTA garanciju putovanja; eTurista prijava gostiju svesno izbačena iz obima (avgust 2026, M11 v2.0).**

`08-SPECIFIKACIJA-M11-COMPLIANCE.md` poglavlje 2.3 (`TravelGuaranteeRegistration.cis_registration_number`, tok `PENDING → REGISTERED`, alarmi ako `CONFIRMED` rezervacija ostane bez broja garancije >48h ili storno bez oslobađanja >48h) pokriva praćenje CIS/YUTA registracije garancije putovanja po rezervaciji — ovo je nepromenjeno u odnosu na raniju verziju, samo je poglavlje prenumerisano (bivše 4.3 → 2.3).

**Izmena u obimu (M11 v2.0, na zahtev vlasnika):** eTurista prijava *gostiju* (bivši `GuestRegistration` entitet, bivše poglavlje 2) je u potpunosti uklonjena iz M11 (i iz M10) — to je zakonska obaveza smeštajnog objekta/hotela koji gosta direktno prima, ne agencije-touroperatora koja aranžman prodaje. Terminal to više ne prati niti prijavljuje. Ako je izvorni problem #5 mislio na *ovo* (individualnu registraciju gosta), to sada nije pokriveno — svesno, poslovnom odlukom, ne previdom. Ako je mislio na CIS registracioni broj *garancije putovanja* po rezervaciji, to ostaje pokriveno (poglavlje 2.3 iznad).

Napomena: tačan tehnički ugovor sa CIS/YUTA API-jem je i dalje eksplicitno ostavljen otvorenim za potvrdu pre implementacije — koncept i model podataka za garanciju su, ipak, kompletni.

---

## 6. AI skeniranje konačnih računa dobavljača i automatsko povezivanje sa rezervacijom

**Status: pokriveno (dopunjeno avgust 2026).**

`07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 8.6 dodaje `SupplierInvoiceImport`/`SupplierInvoiceImportRow` — isti obrazac kao M3 `PricelistImport` (poglavlje 4.2), primenjen na ulazne/konačne fakture umesto cenovnika. Matching ka `SupplierObligation` koristi isti deterministički fuzzy-match na ime gosta kao M5 poglavlje 6.4 (preko `BookingItemGuest`), filtrirano po preklapanju datuma i dodatno potvrđeno iznosom; prag `match_confidence ≥ 85%` isti kao M3. Nivo autonomije isti kao M3 4.2.4: ekstrakcija/predlog sama ("Autonomno"), upis `invoice_reference`/korekcije iznosa u stvarni `SupplierObligation` tek posle ljudske potvrde Računovođe ("Predloži pa čovek odobri").

Mehanizam učenja formata po dobavljaču (stavka (b) iz ranije verzije ove analize) nije poseban entitet — isti generički OCR/parsing pipeline kao M3 `PricelistImport` radi po formatu dokumenta (`source_format`), ne po pamćenju specifičnog dobavljača; ako se pokaže potreba za dodatnim per-dobavljač podešavanjem, to je dopuna za kasnije, ne blokira osnovni tok.

---

## 7. Praćenje svih mejlova zaposlenih, dodela pristupa, poseban email klijent sa AI agentom

**Status: pokriveno (dopunjeno avgust 2026) — nov modul M22.**

Dodat `25-SPECIFIKACIJA-M22-EMAIL-INBOX.md` i upisan u `00-MASTER-ARHITEKTURA.md` poglavlje 4 (potvrđeno na zahtev vlasnika: nov, odvojen modul, ne proširenje M19 niti M14 — obim je širi od oba, jer pokriva sva sandučad, ne samo gost/subagent prepisku niti isključivo interni tim-chat). Model: `Mailbox`/`MailboxAccess` (pojedinačna dodela pristupa po sandučetu, potvrđeno na zahtev vlasnika — ne po opštoj ulozi), `EmailThread`/`EmailMessage`. Korespondent (gost/subagent/dobavljač) se prepoznaje tačnim poklapanjem mejl adrese (ne fuzzy-match). AI agent sažima i priprema nacrt za svaku poruku (nivo "Autonomno"); nacrt koji pominje cenu/obavezu/promenu rezervacije čeka ljudsku potvrdu (nivo "Predloži pa čovek odobri") — isti obrazac kao M14 poglavlje 4. Mejl nit se opciono konvertuje u M14 `Ticket` (novo polje `Ticket.source_email_thread_id`, dopunjeno u M14 u istom prolazu) kad zahteva formalno praćenje statusa.

**Dobavljači su uključeni u obim od starta** (potvrđeno na zahtev vlasnika) — deo operativne potrebe iz problema #9 (asinhrona prepiska) je time već pokriven; #9 ostaje otvoren isključivo za real-time chat deo (vidi poglavlje 9 dole).

---

## 8. B2B subagenti autonomno pretražuju/rezervišu/plaćaju/kreiraju vaučer preko chata

**Status: pokriveno (dopunjeno avgust 2026).**

`12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` poglavlje 2.0.4 dodaje AI agent chat (`/b2b/chat`) — isti M7 domenski agent (M15 poglavlje 2), ne nov tip agenta. Uključuje se **eksplicitno po subagentu** (`Subagent.ai_chat_enabled`, potvrđeno na zahtev vlasnika — nije podrazumevano za sve `ACTIVE`). Tok ima **dva nezavisna gejta** pre nego što se rezervacija stvarno izvrši: Gejt A — subagent uvek mora eksplicitno da potvrdi sopstvenu porudžbinu u chat-u (nivo "Predloži pa čovek odobri", `subagent_chat.booking_confirm` u M15 registru, poglavlje 4); Gejt B — rezervacija iznad konfigurabilnog praga (`ai_chat_review_threshold_amount`, po subagentu) dodatno čeka pregled osoblja agencije (Vlasnik/Direktor/Sales Manager) u M15 Agent Inbox, nezavisno od potvrde subagenta. Pretraga i priprema ponude ostaju "Autonomno" (deterministički, ništa obavezujuće). Plaćanje karticom nikad ne ide kroz sam chat — uvek redirect na isti hostovani checkout kao portal (M10 poglavlje 7.1). Vaučer se izdaje kroz isti postojeći mehanizam kao svaki drugi B2B kanal (M5 poglavlje 6.3, nepromenjeno). Otkazivanje kroz chat prolazi kroz istu proveru duplikata kao svaki drugi kanal (M5 poglavlje 6.4).

---

## 9. Chat za komunikaciju sa dobavljačima (desktop i mobilna aplikacija)

**Status: pokriveno (dopunjeno u specifikaciji, avgust 2026).** Vidi `20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 9 — novi `Conversation.type = EXTERNAL_SUPPLIER`, kontakt-osoba kod dobavljača dobija lagan portal nalog (`SupplierContact` u M3 poglavlje 2.1a, `User.account_type = SUPPLIER_CONTACT` u M1 poglavlje 4), pristup po zaposlenom dodeljuje se eksplicitno (`SupplierConversationAccess`, isti obrazac kao `MailboxAccess` u M22). AI agent sme samo da sažima/predlaže nacrt (nikad izvršava radnju u drugom modulu) — svesno uže ovlašćenje od M7 chata za subagente, jer problem #9 traži brzinu/kvalitet komunikacije, ne davanje dobavljaču mogućnosti da sam nešto rezerviše. Izvorna analiza ispod je i dalje tačna kao opis stanja pre ove dopune.

**Prethodni status: delimično pokriveno (asinhroni email deo), real-time chat deo i dalje nepokriven.**

M22 (poglavlje 6 te specifikacije, avgust 2026) uključuje dobavljače u obim email prepiske — `correspondent_type = SUPPLIER` koristi isti `Mailbox`/`EmailThread` model, pristup i AI sažimanje kao gost/subagent nit. Ovo pokriva asinhroni deo operativne potrebe (npr. slanje/odgovor na `SupplierManifest`, M5 poglavlje 8.4). **Real-time chat** (traženo eksplicitno u originalnoj formulaciji problema, desktop + mobilni) ostaje potpuno odsutno — ispod ostaje prvobitna analiza za taj preostali deo.

`20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 1 i 2.2 eksplicitno ograničava `Conversation`/`ConversationParticipant` na `account_type = STAFF` — dokument doslovno kaže da je ovo "interni tim-chat, ne kanal ka gostima/subagentima" (dobavljači se ne pominju uopšte, što je još uža granica). Pretraga termina "dobavljač" u M19 i M9 (`16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`) ne daje nijedan pogodak.

**Gap: real-time deo i dalje odsutan.** Dobavljači sad komuniciraju kroz M22 email inbox (poglavlje 6 te specifikacije), ali nema chat kanala ni na desktopu (M17) ni na mobilnom (M9).

**Napomena:** M9 je namerno uzak po obimu (samo gost i vodič na terenu, Master dokument poglavlje 5.1) — dobavljač kao korisnik chata na "mobilnoj aplikaciji" bi verovatno tražio ili proširenje M9 obima, ili (verovatnije, u duhu principa "ne graditi nove samostalne aplikacije") poseban B2B-Supplier portal/pristup analogan M7, sa PWA pristupom kao M17/M7, ne novi mobilni kod.

---

## 10. Sprečavanje pogrešnog storna kod dupliranih rezervacija istog gosta preko različitih kanala

**Status: dopunjeno u specifikaciji (avgust 2026).** Vidi `06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 6.4 (provera duplikata pre otkazivanja) i `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` poglavlje 2.0.2 korak 7 (referenca za subagentski kanal). Ispod je izvorna analiza koja je dovela do te dopune; sekundarna preporuka (M6 — prepoznavanje istog fizičkog gosta preko različitih `ClientAccount`-a) ostaje otvorena, vidi "Otvoreno za dalje" u M5 poglavlju 6.4.

Konkretan slučaj iz prakse (vlasnik): gost je rezervisao isti hotel, isti termin, istu uslugu na dva načina — jednom direktno, jednom preko subagenta (M7) koji je istu rezervaciju napravio kroz našu agenciju. U sistemu su postojale dve odvojene `Booking` stavke za istu osobu. Zaposleni nije primetio da se imena poklapaju i stornirao je rezervaciju koja kod nas nije bila uplaćena, misleći da je duplikat/greška. Pošto hotel svoje rezervacije ne prati po internom ID-ju našeg sistema nego po imenu i prezimenu gosta, hotel je (matchujući po imenu) stornirao i onu drugu, ispravnu i uplaćenu rezervaciju.

`06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 6 ("Upravljanje rezervacijom nakon potvrde") definiše mehaniku otkazivanja (`cancellation_refund_percentage`, oslobađanje kapaciteta), ali nema nikakav korak provere *pre* nego što se storno potvrdi. `BookingItemGuest` (poglavlje 4.3) povezuje stavku sa `M6.GuestProfile`, ali ništa u M5 ili M6 ne upoređuje goste/termine/proizvode **preko različitih `Booking` zapisa** da bi otkrilo da dve naizgled nezavisne rezervacije (različit `channel`, različit `client_account_id` — npr. B2C gost i B2B subagent) u stvari pripadaju istom fizičkom gostu, istom objektu i istom terminu.

**Gap: potpuno odsutno.** Nedostaje: (a) provera pri otkazivanju — kad se otkazuje `BookingItem`, sistem treba da proveri da li postoji druga aktivna (`CONFIRMED`/`PENDING_SUPPLIER_CONFIRMATION`) stavka za isti `product_id` (isti dobavljač/objekat) sa preklapajućim `stay_from`/`stay_to` i isto ili slično ime gosta (fuzzy match nad `BookingItemGuest` → `GuestProfile.first_name`/`last_name`, tolerantno na razlike u zapisu imena), nezavisno od kanala ili `client_account_id`; (b) ako se pronađe podudaranje, operateru se pre potvrde storna prikazuje eksplicitno upozorenje (npr. "Postoji druga aktivna rezervacija za [Ime Prezime] u [Hotel] za [datumi] — booking #X, kanal: [B2C/B2B subagent/…]. Da li ste sigurni da otkazujete ispravnu rezervaciju?"); (c) u M6 ne postoji mehanizam za prepoznavanje da isti fizički gost stoji iza dva različita `ClientAccount`-a (direktan gost i klijent subagenta) — nema predloga za spajanje/povezivanje profila kad se otkrije podudaranje po imenu (i po datumu rođenja/dokumentu, gde je dostupno).

**Preporuka:** dopuna `06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlja 6 sa korakom provere duplikata pre storna, na nivou **"Predloži pa čovek odobri"** (poglavlje 7 Master dokumenta) — sistem ne blokira storno automatski (mogu postojati legitimni razlozi za dve odvojene rezervacije iste osobe), samo traži eksplicitnu potvrdu uz prikaz konflikta. Pošto je jedan od dva izvora duplikata upravo subagentski kanal, `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` treba dopuniti referencom na ovu proveru. Sekundarno, razmotriti u M6 (CRM) mehanizam predloga za spajanje/povezivanje gostiju kroz različite `ClientAccount`-e kad se otkrije podudaranje identiteta — ovo bi rešilo problem i na duže staze, ne samo u trenutku storna.

---

## Rezime

| # | Problem | Status |
| :---- | :---- | :---- |
| 1 | Praćenje statusa + obaveštavanje (novo/storno/promena) | Pokriveno, manji gap (dnevni zbirni pregled) |
| 2 | Da li je najavljeno dobavljaču + potvrda dobavljača | Dopunjeno u specifikaciji (M5 poglavlje 8.6) |
| 3 | Konfigurabilno automatsko slanje najave po statusu uplate | Dopunjeno u specifikaciji (M5 poglavlje 8.7) — priprema konfigurabilna, slanje ostaje ljudska radnja |
| 4 | Rok akontacije/pune uplate (gost) | Pokriveno (M10 poglavlje 5.4) |
| 5 | CIS/eTurista notifikacija | Pokriveno |
| 6 | AI skeniranje konačnih računa i povezivanje sa rezervacijom | Pokriveno (M10 poglavlje 8.6) |
| 7 | Objedinjeni email klijent + AI agent + dodela pristupa | Pokriveno (nov modul M22) |
| 8 | B2B subagenti autonomno rezervišu/plaćaju preko chata | Pokriveno (M7 poglavlje 2.0.4) |
| 9 | Chat sa dobavljačima (desktop + mobilni) | Dopunjeno u specifikaciji (M19 poglavlje 9, uz dopune M1/M3) |
| 10 | Sprečavanje pogrešnog storna kod dupliranih rezervacija (isti gost, različiti kanali) | Dopunjeno u specifikaciji (M5 poglavlje 6.4, M7 poglavlje 2.0.2) |

Svih deset problema sa originalne liste je sada dopunjeno u specifikaciji — poslednji, problem #9, zatvoren je u istom prolazu kao ova revizija (avgust 2026, M19 poglavlje 9). Ovo nije bio previd u smislu greške u postojećem radu, već prirodna posledica toga što M15 (AI orkestracija), M19 (komunikacija) i M7 (B2B) dugo nisu bili vođeni ovim konkretnim zahtevima. Preostaje sporedno, sekundarno pitanje otvoreno unutar problema #10 (spajanje profila gosta u M6 kad ista osoba stoji iza dva `ClientAccount`-a) — svesno odloženo dok M6 CRM ne dođe na dalju razradu, nije prioritet.

---

## Dodatak B — Sistematski popis problema po toku rada (živ dokument, dopunjuje se)

**Svrha:** Problemi u prvoj listi (`Problemi koje zelimo da resimo ovom aplikacijom.md`) su nastali kao spontano sećanje, ne sistematski prolazak kroz sve tokove rada agencije. Da bi se smanjio rizik da nešto važno ostane nezapisano dok se ne dođe do te faze izgradnje (kad je izmena skuplja), ovde se vodi popis po kategoriji odnosa — vlasnik dopunjava kad god se novi problem javi, bez obzira da li se odmah rešava.

**Pravilo:** dodavanje reda ovde **ne znači automatski da se menja arhitektura** — isti princip kao Dodatak A Master dokumenta (mesečni pregled trendova). Svaki red čeka odluku vlasnika: (a) već pokriveno postojećim modulom — samo referenca gde, (b) dopuna postojeće specifikacije, (c) novi modul, (d) svesno odloženo za kasnije, uz razlog.

### B.1 Kategorije za sistematski prolazak

Predlog redosleda prolaska (svaka kategorija — 10-15 min razmišljanja "šta me nervira / šta se često greši / šta bih voleo da sistem sam uradi"):

| Kategorija | Vodeće pitanje | Primer već identifikovanih (iz problema 1-9) |
| :---- | :---- | :---- |
| **Gost/klijent (B2C)** | Šta gost očekuje da zna, a mi mu to ne kažemo na vreme? Gde gost čeka na nas umesto da sistem sam reaguje? | (nije eksplicitno pokriveno u prvoj listi — vredi dopuniti) |
| **Dobavljač** | Gde dobavljač čeka na nas, ili mi čekamo na njega, bez automatskog praćenja? | Problemi 2, 3, 6, 9 |
| **Subagent (B2B)** | Šta subagent mora da zove/piše nama umesto da sam odradi? Gde kredit/provizija/vidljivost nisu dovoljno jasni? | Problem 8 |
| **Firme / pravna lica (direktni korporativni klijenti, ako se razlikuju od subagenata)** | Da li korporativni klijent (firma koja plaća za svoje zaposlene) ima drugačije potrebe od subagenta ili gosta pojedinca — poseban račun, drugačija faktura, drugačiji nivo odobrenja? | Nije razjašnjeno — proverite da li "firme" znači ovo ili nešto drugo (napomena ispod) |
| **Unutar agencije (interni tim)** | Gde zaposleni gubi vreme na ručno prekucavanje/proveru koju bi sistem mogao sam da uradi? Gde se greška dešava jer dvoje ljudi rade isto a ne znaju jedno za drugo? | Problemi 1, 5, 7 |
| **Zakon/država** | Da li postoji rok, prijava ili obaveza prema državi/inspekciji koju pamtimo samo "u glavi", ne u sistemu? | Problem 4, 5 |

**Napomena o "firmama":** Master dokument (poglavlje 2, pojmovnik) razlikuje samo Nalogodavca (može biti fizičko ili pravno lice) i Subagenta (B2B partner koji dalje preprodaje). Nije jasno da li vaš pojam "firme" znači (a) pravno lice koje kupuje putovanje za svoje zaposlene i ne preprodaje dalje — što bi bio poseban slučaj Nalogodavca, ne Subagenta, ili (b) nešto treće. Vredi razjasniti pri sledećem prolasku kroz ovu tabelu, jer ako je (a), trenutna arhitektura ga verovatno već pokriva kroz M6 (CRM) bez posebne dopune; ako je (b), treba definisati.

### B.2 Kad ovo raditi

- **Sada, jednom, u celosti** — pre nego što specifikacija M1/Faza 0 bude "zaključana" za implementaciju, jer je jeftinije uhvatiti nedostatak u ovom trenutku.
- **Ponovo, kratko, na kraju svake faze** (poglavlje 8 Master dokumenta) — pre nego što se izlazni kriterijum te faze proglasi ispunjenim, proveriti da li je ta faza otkrila novi problem u svojoj kategoriji koji do tad nije bio vidljiv (npr. tek kad M7 stvarno proradi, subagenti će reći šta ih dodatno nervira — to se ne može unapred pogoditi u potpunosti).
- **Ad-hoc, odmah kad se setite** — dodajte red, bez čekanja na "pravi trenutak"; to je tačno svrha ovog dodatka.

### B.3 Log problema (dopunjuje se)

| Datum | Kategorija | Problem (opis vlasnika) | Odluka | Modul/napomena |
| :---- | :---- | :---- | :---- | :---- |
| 2026-08-05 | (razno, prvobitna lista) | 9 problema iz `Problemi koje zelimo da resimo ovom aplikacijom.md` | Analizirano u ovom dokumentu (poglavlja 1-9) | Vidi Rezime iznad |
| 2026-08-07 | Gost/klijent (B2C) | Gost ne dobija automatski podsetnik kad dobavljač drži rezervaciju "na opciju" sa rokom posle kog sam otkazuje ako agencija ne potvrdi/plati — vlasnik dao konkretan primer iz prakse (email dobavljača "Reservations pending confirmation": hotel, datumi, referenca, ime, rok, web-referenca) kao format za analognu poruku ka gostu. | Dopuna postojeće specifikacije — upisano kao otvoreno pitanje | M5 poglavlje 13 (novo polje za rok opcije na `BookingItem`; kanal za transakciona obaveštenja gostu verovatno zahteva i dopunu M6 poglavlje 4.1) |
| 2026-08-08 | Dobavljač / Subagent (unakrsno) | Gost je rezervisao isti hotel/termin/uslugu i direktno i preko subagenta (M7) — dve odvojene rezervacije u sistemu za istu osobu. Zaposleni nije primetio poklapanje imena i stornirao neuplaćenu rezervaciju misleći da je duplikat; hotel prati rezervacije po imenu gosta (ne po našem internom ID-ju), pa je posledično stornirao i ispravnu, uplaćenu rezervaciju. Vlasnik traži da sistem predvidi ovakve scenarije i upozori korisnika pre nego što napravi istu grešku. | Dopunjena specifikacija — upisano u M5 poglavlje 6.4 i M7 poglavlje 2.0.2 (avgust 2026) | Vidi poglavlje 10 iznad — M5 poglavlje 6.4 (provera duplikata pre potvrde storna, "Predloži pa čovek odobri"), M7 poglavlje 2.0.2 korak 7 (referenca za subagentski kanal); sekundarno i dalje otvoreno: M6 (spajanje/povezivanje gostiju preko različitih `ClientAccount`-a) |

| 2026-08-08 | Dobavljač | Problemi 2 i 3 (najava dobavljaču kao formalni koncept + konfigurabilno automatsko slanje po statusu uplate) dopunjeni u istom prolazu jer su usko povezani. Vlasnik je eksplicitno potvrdio (pri specifikaciji) da slanje dobavljaču ostaje ljudska radnja i posle ove dopune — konfigurabilan je samo trenutak *pripreme* nacrta, ne i njegovo slanje. | Dopunjena specifikacija — upisano u M5 poglavlje 8.6 (najava/potvrda) i 8.7 (`SupplierAnnouncementRule`) | M5 poglavlje 8.6, 8.7; M15 poglavlje 5 (registar nivoa autonomije) ažuriran u istom prolazu |

| 2026-08-08 | Dobavljač | Problem #9 (real-time chat sa dobavljačima, poslednja stavka sa originalne liste) rešen. Vlasnik je eksplicitno odabrao lagan portal nalog za dobavljača (ne WhatsApp/SMS most, ne proširenje M22 email toka) kad je predočeno da M19 interni chat po dizajnu isključuje spoljne učesnike. | Dopunjena specifikacija — upisano u M19 poglavlje 9, uz dopune M1 (poglavlje 4, `SUPPLIER_CONTACT`) i M3 (poglavlje 2.1a, `SupplierContact`) | M19 poglavlje 9 (novi `Conversation.type = EXTERNAL_SUPPLIER`, `SupplierConversationAccess`); AI agent svesno ograničen na sažimanje/nacrt, bez izvršnog ovlašćenja kao M7 poglavlje 2.0.4 |

*(dodavati redove ovde ubuduće — ne brisati stare, čak i kad se reše, radi istorije odlučivanja, isti princip kao audit log iz M1)*
