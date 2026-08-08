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

**Status: delimično pokriveno, nedostaje deo koji se odnosi na gosta.**

`07-SPECIFIKACIJA-M10-FINANSIJE.md` prati `SupplierObligation.due_date` (poglavlje 8.1–8.2) — rok plaćanja **dobavljaču**, sa alarmom Računovođi 5 dana pre roka. M5 poglavlje 6.1 prati da li je vaučer izdat bez pune uplate (dnevni podsetnik), ali to je opšti nadzor nad `payment_status`, ne praćenje konkretnog *ugovorenog roka* za akontaciju.

**Gap:** ne postoji `Payment.due_date` ili ekvivalentno polje koje čuva rok za akontaciju/punu uplatu *gosta/nalogodavca*, niti podsetnik koji eksplicitno upozorava "akontacija je trebalo da stigne do datuma X, a nije". Ovo je različito od M5 alarma (koji prati samo da li je vaučer izdat bez uplate, ne da li je *rok* probijen).

---

## 5. Automatsko obaveštavanje o CIS/eTurista registraciji

**Status: dobro pokriveno.**

`08-SPECIFIKACIJA-M11-COMPLIANCE.md` poglavlje 2 (`GuestRegistration`, `eturista_reference`, automatski poziv pri `check_in_date`, alarm na `FAILED`) i poglavlje 4.3 (`TravelGuaranteeRegistration.cis_registration_number`, tok `PENDING → REGISTERED`, alarmi ako `CONFIRMED` rezervacija ostane bez broja garancije >48h ili storno bez oslobađanja >48h) pokrivaju tačno ovaj problem. Alarmi idu Vlasniku/Direktoru (panel + email).

Napomena: tačan tehnički ugovor sa CIS/YUTA API-jem je eksplicitno ostavljen otvorenim za potvrdu pre implementacije — koncept i model podataka su, ipak, kompletni. Nema materijalnog gap-a.

---

## 6. AI skeniranje konačnih računa dobavljača i automatsko povezivanje sa rezervacijom

**Status: nepokriveno — ovo je eksplicitno naveden problem koji nije razrađen ni u jednoj specifikaciji.**

`07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 8.1/8.3 definiše `SupplierObligation.invoice_reference` kao polje koje se "popunjava naknadno, ručno" — bez OCR/AI uvoza ili automatskog uparivanja sa `booking_item_id`. AI-potpomognuti OCR uvoz postoji samo u `04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` poglavlje 4.2 (`PricelistImport`), ali to je za **cenovnike/ugovore pri nabavci**, ne za **ulazne/konačne fakture** koje stižu posle realizacije usluge. M15 (AI orkestracija) ne pominje ni skeniranje ni fakture.

**Gap: potpuno neadresirano.** Nedostaje: (a) entitet analogan `PricelistImport` ali za konačne fakture (npr. `SupplierInvoiceImport`), (b) mehanizam učenja formata po dobavljaču (koji AI "pamti" kako izgleda račun svakog dobavljača), (c) fuzzy-matching ka konkretnoj rezervaciji/stavci (slično `PricelistImportRow.matched_product_id`, ali ka `Booking`/`BookingItem`), (d) tok verifikacije/odobravanja pre nego što se podatak upiše kao stvarna finansijska obaveza (isti princip "determinizam pre autonomije" koji već važi za M3 uvoz cenovnika).

**Preporuka:** ovo se prirodno nadovezuje na M3 poglavlje 4.2 (isti OCR/fuzzy-matching obrazac) i M10 poglavlje 8 (`SupplierObligation`) — trebalo bi dodati kao dopunu M10 specifikacije, po istom modelu nivoa autonomije (ekstrakcija automatski, upis u finansijsku obavezu tek posle ljudske potvrde).

---

## 7. Praćenje svih mejlova zaposlenih, dodela pristupa, poseban email klijent sa AI agentom

**Status: nepokriveno.**

`20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 1–2 eksplicitno definiše samo **interni tim-chat** (zaposleni ↔ zaposleni, `ConversationParticipant` ograničen na `account_type = STAFF`); email se pominje isključivo kao dodatni kanal isporuke sistemskih upozorenja (poglavlje 5, uz Telegram), ne kao klijent za čitanje/odgovaranje na poštu. `14-SPECIFIKACIJA-M14-HELPDESK.md` ima `Ticket.channel = EMAIL` samo kao poreklo tiketa, sa AI agentom koji sažima i predlaže nacrt odgovora (poglavlje 4) — ali to je tiketing sistem, ne email inbox sa pravima pristupa po sandučetu.

**Gap: potpuno odsutno.** Nedostaje: (a) koncept objedinjenog email klijenta unutar aplikacije (IMAP/SMTP ili API integracija sa poslovnim mejl provajderom), (b) model dodele pristupa — ko od zaposlenih vidi/odgovara na koje sanduče, (c) AI agent koji radi direktno nad mejlovima (ne samo nad tiketima) — sumira, predlaže odgovor, a kad ne zna, ostavlja da zaposleni napiše odgovor. M14 ima sličnu logiku (predlog odgovora + eskalacija), ali samo za tikete koji dolaze kroz definisan tiketing tok, ne za sirovi mejl.

**Preporuka:** razmotriti da li ovo postane novi modul (npr. M22 — Email/Inbox platforma) ili prošireni M19, s obzirom da M19 već ima infrastrukturu za real-time komunikaciju i M15 već ima AI agent obrazac (nivoi autonomije) koji bi se direktno primenio ovde.

---

## 8. B2B subagenti autonomno pretražuju/rezervišu/plaćaju/kreiraju vaučer preko chata

**Status: nepokriveno.**

`12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` definiše isključivo **portal** (`SUBAGENT_ADMIN` nalog, forma-bazirana pretraga/rezervacija/vaučer), bez chat interfejsa i bez AI agenta koji sam izvršava radnje. `23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md` ima AI Q&A asistenta za subagente (poglavlje 5), ali strogo informativnog — dokument eksplicitno navodi da pristup živim podacima (npr. sopstveni kreditni limit) "zahteva sopstvenu bezbednosnu analizu, ne pretpostavlja se ovde". Nema nivoa autonomije/ovlašćenja za samostalno izvršavanje rezervacije/plaćanja preko chata.

**Gap: potpuno odsutno.** Subagenti danas rade isključivo kroz formu portala, ne kroz agentski chat. Ovo je suštinski novi zahtev koji spaja M7 (B2B) i M15 (AI orkestracija) — treba definisati: (a) chat kanal specifično za subagente (odvojen od internog tim-chata M19 i od gost/helpdesk chata M14), (b) nivoe ovlašćenja za taj chat (koji je već okvir M15 poglavlje 7 predviđa generalno — Autonomno / Predloži pa čovek odobri / Nikad autonomno — ali nije primenjen konkretno na B2B kontekst), (c) da li AI agent subagenta sme sam da potvrdi rezervaciju/plaćanje (verovatno "Predloži pa čovek odobri" za plaćanje, po analogiji sa ostatkom sistema) ili čak "Autonomno" u granicama već odobrenog kreditnog limita.

**Napomena:** Master dokument princip #4 (determinizam pre autonomije) i M15 pravila (poglavlje 7) daju okvir za ovo, ali specifikacija M7 mora biti eksplicitno dopunjena da ga primeni na B2B kontekst.

---

## 9. Chat za komunikaciju sa dobavljačima (desktop i mobilna aplikacija)

**Status: nepokriveno.**

`20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md` poglavlje 1 i 2.2 eksplicitno ograničava `Conversation`/`ConversationParticipant` na `account_type = STAFF` — dokument doslovno kaže da je ovo "interni tim-chat, ne kanal ka gostima/subagentima" (dobavljači se ne pominju uopšte, što je još uža granica). Pretraga termina "dobavljač" u M19 i M9 (`16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md`) ne daje nijedan pogodak.

**Gap: potpuno odsutno.** Dobavljači danas komuniciraju samo posredno preko email-a (slanje `SupplierManifest`-a, M5 poglavlje 8.4). Nema chat kanala ni na desktopu (M17) ni na mobilnom (M9).

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
| 4 | Rok akontacije/pune uplate (gost) | Delimično — postoji samo za obaveze prema dobavljaču |
| 5 | CIS/eTurista notifikacija | Pokriveno |
| 6 | AI skeniranje konačnih računa i povezivanje sa rezervacijom | Nepokriveno |
| 7 | Objedinjeni email klijent + AI agent + dodela pristupa | Nepokriveno |
| 8 | B2B subagenti autonomno rezervišu/plaćaju preko chata | Nepokriveno |
| 9 | Chat sa dobavljačima (desktop + mobilni) | Nepokriveno |
| 10 | Sprečavanje pogrešnog storna kod dupliranih rezervacija (isti gost, različiti kanali) | Dopunjeno u specifikaciji (M5 poglavlje 6.4, M7 poglavlje 2.0.2) |

Pet problema (4, 6, 7, 8, 9) i dalje zahtevaju nove koncepte/dopune koji trenutno ne postoje ni u jednoj specifikaciji — ovo nije previd u smislu greške u postojećem radu, već prirodna posledica toga što M15 (AI orkestracija), M19 (komunikacija) i M7 (B2B) dosad nisu bili vođeni ovim konkretnim zahtevima. Problemi 2, 3 i 10 su već dopunjeni (M5 poglavlja 6.4, 8.6, 8.7) kao prvi rešeni ovim redosledom. Preporuka je da se preostali gap-ovi (4, 6, 7, 8, 9) svesno unesu kao dopune postojećih modula (M6, M7, M10, M19) ili kao novi modul (email platforma) pre nego što se ti moduli smatraju "gotovim" za svoju fazu.

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

*(dodavati redove ovde ubuduće — ne brisati stare, čak i kad se reše, radi istorije odlučivanja, isti princip kao audit log iz M1)*
