# MASTER ARHITEKTONSKI DOKUMENT

## Terminal — jedinstvena poslovna platforma agencije Terminal Travel (TT), turoperatora sa licencom

**Verzija:** 1.18 — CI/CD pipeline dodat (avgust 2026, `.github/workflows/ci.yml`): na svaki push/PR ka main pokreće TypeScript build, unit i e2e testove apps/api nad efemernom Postgres bazom (GitHub Actions service container) — zatvara "CI/CD" stavku Faze 0 (poglavlje 8); v1.17 — M1 dobio automatizovane testove (avgust 2026): 77 unit + 9 e2e, dokazuju 5 od 6 stavki M1 izlaznog kriterijuma (poglavlje 8) — detalji u M1 specifikaciji (verzija 1.4); v1.16 — počela implementacija (avgust 2026, svesna odluka vlasnika): M1 (Core/Identitet) prvi modul, Faza 0, `apps/api/`; vidi CLAUDE.md i M1 specifikaciju (poglavlje verzija 1.3) za detalje; v1.15 — M4 specifikacija dopunjena: `AvailabilityQuote.cancellationPolicy` sad ima definisan, M3-usklađen oblik, da M5 ne grana obračun otkazivanja po poreklu proizvoda (avgust 2026, na zahtev vlasnika); v1.14 — M18 specifikacija dopunjena tvrdim EUR budžetom za AI potrošnju (poglavlje 6.5 te specifikacije — globalno po provajderu i po agentu, sa automatskom degradacijom na jeftiniji model umesto samo alarma), na zahtev vlasnika (avgust 2026); v1.13 — M4 specifikacija dopunjena eksplicitnim pravilima efikasnosti (keširanje šifarnika, gornja granica veličine rezultata pretrage — poglavlje 2.4 te specifikacije), na zahtev vlasnika radi troška poziva/tokena AI agenata (avgust 2026); v1.12 — M4 red dopunjen: Solvex (Master-Interlook) kao drugi HOTEL adapter uz Travelgate (poglavlje 5a M4 specifikacije, dopunjeno stvarnim WSDL nalazima iz izolovanog spike testa, avgust 2026), na zahtev vlasnika; v1.11 — standing pravilo (avgust 2026, na zahtev vlasnika): svaki modul koji izlaže API dobija prateći `docs/api/M<broj>-<slug>.md` sa stvarnim primerima zahteva/odgovora (detalji u CLAUDE.md, napomena posle poglavlja 8 ovog dokumenta); M21 (Centar za pomoć) proširen na treću publiku — korporativni self-service klijenti (poglavlje 4, M21 red); v1.10 — dodat M23 (Znanje) u tabelu modula (poglavlje 4), poprečan modul kao M17/M18/M19/M21/M22, na direktan zahtev vlasnika (avgust 2026); v1.9 — M5 red u tabeli modula (poglavlje 4) dopunjen sa poprečnom zavisnošću unazad od M22 (jedinstveno sanduče za potvrde dobavljača, rešava problem #11, poglavlje 8.8 M5 specifikacije, avgust 2026); v1.8 — M19 red u tabeli modula (poglavlje 4) dopunjen sa zavisnošću od M3 i real-time chatom sa dobavljačima (poglavlje 9 M19 specifikacije, zatvara problem #9 — poslednju stavku sa originalne liste problema); v1.7 revizija celog dokumenta (avgust 2026): (a) na direktan zahtev vlasnika, M11 sveden na garanciju putovanja (YUTA) i evidencije za inspekciju — eTurista/CIS prijava gostiju i boravišna taksa uklonjene iz obima jer su nadležnost smeštajnog objekta koji gosta direktno prima, ne agencije-touroperatora (poglavlje 4, poglavlje 5 dijagram, poglavlje 8 Faza 2, poglavlje 9, poglavlje 10); M10 kurs konverzije sad na dan uplate umesto dana izdavanja dokumenta, uklonjen sistemski limit gotovinske uplate (detalji u `07-SPECIFIKACIJA-M10-FINANSIJE.md`); (b) zatvorena rupa iz v1.6 — M22 je dodat u tabelu modula (poglavlje 4) ali objašnjenje "poprečnih" modula bez fiksne faze (poglavlje 4, napomena posle tabele) i fazna napomena (poglavlje 8) nikad nisu ažurirane da ga pomenu; sad su; (c) M17 specifikacija ažurirana da prikazuje i M21/M22 (bila je zaostala); M22 specifikacija dobila eksplicitan kanal prikaza (M17) koji je ranije nedostajao. v1.6 — dodat M22 (Email/Inbox platforma) u tabelu modula (poglavlje 4), poprečan modul kao M17/M18/M19/M21, na zahtev vlasnika (avgust 2026), zatvara problem #7 iz `Problemi koje zelimo da resimo ovom aplikacijom.md`; v1.5 dodato poglavlje 5.1 (Responsive dizajn — PWA za M17/M7/M8, M9 namerno uzak po obimu na gosta i vodiča); v1.4 dodat M21 (Centar za pomoć — baza znanja + AI asistent) u tabelu modula (poglavlje 4), poprečan modul kao M17/M18/M19 **Status:** Usvojen — osnova za sve buduće modularne specifikacije **Vlasnik projekta:** Nenad Tomić **Naziv aplikacije/platforme:** Terminal **Naziv agencije / brend:** Terminal Travel (skraćeno TT) **Namena dokumenta:** Ovo je referentni dokument ("ustav" projekta) na koji se pozivaju sve buduće detaljne specifikacije modula. Svaki AI agent ili saradnik koji radi na bilo kom delu sistema mora prvo pročitati ovaj dokument. Kada detaljna specifikacija modula bude u suprotnosti sa ovim dokumentom, ovaj dokument je merodavan dok se svesno i pismeno ne izmeni. Svuda gde se u ovom i budućim dokumentima pominje "platforma", "sistem" ili "aplikacija" bez dodatnog objašnjenja, misli se na **Terminal**; svuda gde se pominje "agencija", misli se na **Terminal Travel (TT)**.

---

## 1\. Vizija i obim

Cilj projekta je **Terminal** — jedinstvena softverska platforma koja pokriva ceo životni ciklus poslovanja agencije **Terminal Travel (TT)**, turističke agencije sa licencom touroperatora u Republici Srbiji: kreiranje i nabavku turističkog proizvoda (putem direktnih ugovora i putem API konekcija sa dobavljačima), distribuciju i prodaju (B2C, B2B/subagenti, sopstveni sajt, mobilna aplikacija), finansijsko i računovodstveno poslovanje usklađeno sa zakonima Srbije, marketing i promociju, i AI agente koji asistiraju timu u svakom od ovih segmenata pod nadzorom glavnog (orkestracionog) agenta kojim upravlja vlasnik.

Sistem se gradi od nule, bez obaveze migracije iz postojećeg softvera. Gradi ga prvenstveno vlasnik uz pomoć AI agenata, uz povremeno uključivanje ljudskih stručnjaka za specifične domene (pravo, računovodstvo, bezbednost). Ova činjenica direktno određuje arhitektonske odluke u ovom dokumentu: sistem mora biti razumljiv, testiran i bezbedan i kada ga najvećim delom piše AI, a ne veliki ljudski tim.

### 1.1 Strateški kontekst: zašto arhitektura mora da pretpostavi AI-agentsku budućnost industrije

Istraživanje industrijskih izvora (IDC, Phocuswright, Skift, L.E.K. Consulting — jul 2026\) pokazuje dva paralelna trenda koja direktno oblikuju ovaj dokument:

- **AI agenti postaju kupac, ne samo alat.** IDC procenjuje da će do 2030\. oko 30% svih rezervacija u turizmu izvršavati AI agenti koji samostalno pretražuju, upoređuju i rezervišu bez čoveka (npr. Sabre/PayPal/MindTrip agentski booking lansiran 2026, Google-ova agentska rezervacija unutar pretrage). Phocuswright-ovo istraživanje iz 2026\. pokazuje da tek 11% turističkih kompanija ima API koji je stvarno spreman da mu AI agent samostalno rezerviše i naplati u realnom vremenu — 89% je i dalje građeno isključivo za ljudske kanale. To je prozor prilike: rana "agent-readiness" (poglavlje 4, modul M16) može biti konkurentska prednost, ne samo tehnički trošak.  
- **Ljudska ekspertiza ostaje odbrana od komoditizacije, ali samo ako se neguje.** 85% putnika (L.E.K. Consulting) kaže da bi nastavilo da koristi svog agenta i uz AI alate, pod uslovom da agencija nudi ono što generički AI teško radi: kompleksna višedestinacijska putovanja, nišnu ekspertizu, poverenje, B2B odnose. Zbog toga CRM (M6), B2B (M7) i personalizacija u marketingu (M12) u ovom dokumentu nisu sporedni moduli — oni su suštinski deo poslovne odbrane, jednako važni kao tehnička infrastruktura.

Praktična posledica: sistem se gradi tako da (a) interni API sloj od početka bude dovoljno čist da se kasnije, jeftino, izloži i eksternim AI agentima kao dobavljač (M16), i (b) da moduli koji nose ličan/kuriran odnos sa gostom i partnerom ne budu odloženi na kraj mape puta kao "nice to have". Ovaj kontekst se ažurira mesečno (poglavlje 10\) jer se ova oblast industrije menja iz meseca u mesec, ne iz godine u godinu.

### 1.2 Šta ovaj dokument NIJE

Ovo nije implementaciona specifikacija. Ne sadrži šeme baze podataka na nivou kolona, API ugovore ili UI wireframe-ove. To se radi u Nivou 2 — detaljnoj specifikaciji svakog modula, po redosledu iz mape puta (poglavlje 8), tek kada modul dođe na red. Ovaj dokument definiše okvir unutar kojeg se te odluke donose, tako da ostanu međusobno usklađene.

---

## 2\. Poslovni pojmovnik (domain glossary)

Da bi svi moduli i svi AI agenti koristili iste termine (izbegava se situacija da jedan modul zove istu stvar drugim imenom), definiše se zajednički rečnik. Svaka buduća specifikacija modula mora koristiti ove nazive entiteta.

| Pojam | Značenje |
| :---- | :---- |
| **Gost (Traveler)** | Fizičko lice koje putuje — krajnji korisnik usluge, sa ili bez direktnog naloga u sistemu. |
| **Nalogodavac (Client Account)** | Fizičko ili pravno lice koje kupuje i plaća uslugu — može biti isto lice kao Gost (B2C) ili subagent koji kupuje za svoje klijente (B2B). |
| **Subagent (B2B partner)** | Poslovni kupac — druga agencija ili pravno lice koje kupuje proizvode agencije radi dalje preprodaje ili organizacije putovanja za svoje klijente. |
| **Proizvod (Product)** | Bilo koja prodajna jedinica: hotelski smeštaj, paket aranžman, transfer, izlet, avio karta, osiguranje. Ima poreklo (izvor — ugovor ili API konekcija). |
| **Izvor proizvoda (Source)** | Način na koji je proizvod nabavljen: Direktan ugovor (Contracted) ili API konekcija (npr. Travelgate, GDS, drugi agregator). |
| **Ugovor (Contract)** | Formalni sporazum sa dobavljačem (hotel, prevoznik, osiguravač) sa uslovima, cenama, alotmanima, rokovima za otkazivanje. |
| **Alotman (Allotment)** | Kontingent rezervisanih kapaciteta kod dobavljača (broj soba/mesta) koji agencija kontroliše i prodaje pre nego što dobavljač to sazna od nekog drugog. |
| **Rezervacija (Booking)** | Konkretna prodaja jednog ili više Proizvoda jednom Nalogodavcu za jednog ili više Gostiju, sa svojim statusom, cenom i uslovima. |
| **Ponuda (Quote/Offer)** | Nepotvrđena kalkulacija cene i uslova, pre nego što postane Rezervacija. |
| **Kanal prodaje (Sales Channel)** | Sajt agencije, mobilna aplikacija, B2B portal, prodajno mesto/agent uživo, telefon. |
| **Fiskalni dokument** | Faktura (SEF), fiskalni račun (ESIR), koji nastaju iz Rezervacije prema pravilima poglavlja 6\. |
| **Modul** | Funkcionalno zaokružena celina sistema (poglavlje 4\) sa sopstvenim podacima i API-jem, ali deo iste platforme. |
| **Agent (AI)** | Softverski AI agent zadužen za jedan domen/modul, sa jasno definisanim ovlašćenjima (poglavlje 7). Ne meša se sa Subagentom (B2B partner) niti sa ljudskim prodajnim agentom. |
| **Glavni agent (Orchestrator)** | AI agent koji koordinira rad svih domenskih AI agenata i kroz kojeg vlasnik nadzire ceo sistem. |

---

## 3\. Arhitektonska filozofija — pet vodećih principa

1. **Jedan izvor istine.** Svaki entitet (proizvod, rezervacija, gost, faktura) postoji na tačno jednom mestu u sistemu. Sajt, mobilna aplikacija i B2B portal su *prikazi* nad istim podacima iz centralne platforme — nijedan od njih ne sme imati sopstvenu, odvojenu bazu rezervacija ili proizvoda. Ovo je direktan odgovor na zahtev da sajt "vuče podatke" iz aplikacije, a ne obrnuto.  
2. **Moduli su granice, ne slojevi.** Sistem se deli po poslovnim domenima (Rezervacije, Finansije, CRM, Marketing...), ne po tehničkim slojevima. Svaki modul ima svoju bazu tabela i svoj API; drugi moduli mu pristupaju isključivo preko tog API-ja, nikad direktno u bazu. Ovo omogućava da se moduli grade, testiraju i menjaju nezavisno — što je preduslov da AI agent može bezbedno da radi na jednom modulu bez rizika da pokvari drugi.  
3. **Spoljni provajderi su adapteri, ne temelj.** Travelgate, SEF, ESIR, budući avio/GDS API — svaki od njih je adapter iza internog, provajder-nezavisnog modela podataka. Menjanje ili dodavanje provajdera nikad ne sme zahtevati izmenu poslovne logike ili korisničkog interfejsa (razrađeno u poglavlju 5 i u ranije pripremljenom Travelgate predlogu).  
4. **Determinizam pre autonomije.** Svaki proces koji uključuje novac, fiskalne obaveze ili pravno obavezujuću komunikaciju mora prvo raditi kao pouzdan, testiran, deterministički kod. AI agent sme da asistira, predlaže i ubrzava taj proces, ali ne sme da bude jedina karika koja izvršava fiskalno/finansijsko dejstvo bez mogućnosti provere. Autonomija se uvodi postepeno i samo tamo gde greška ne ugrožava zakonsku usklađenost ili novac (razrađeno u poglavlju 7).  
5. **Sve se može revidovati, ništa se ne pamti samo u nečijoj glavi.** Svaka odluka, svaka izmena podataka, svaka akcija AI agenta ostavlja trag (audit log). Ovo nije opcija za kasnije — ugrađuje se od Faze 0, jer se naknadno domodelovanje audit sistema u postojeće module gotovo nikad ne radi kako treba.

---

## 4\. Mapa modula sistema

| \# | Modul | Kratak opis | Zavisi od |
| :---- | :---- | :---- | :---- |
| M1 | **Core / Identitet i pristup** | Korisnici, uloge, prava pristupa (RBAC), autentikacija, audit log. Temelj svih ostalih modula. | — |
| M2 | **Katalog proizvoda** | Centralni registar svih prodajnih proizvoda, bez obzira na izvor (ugovor ili API). | M1 |
| M3 | **Ugovaranje i alotmani** | Upravljanje direktnim ugovorima sa dobavljačima, kapacitetima, cenovnicima, rokovima. | M1, M2 |
| M4 | **Integracije spoljnih API konekcija** | Sloj adaptera ka spoljnim provajderima (Travelgate i, od avgusta 2026, Solvex/Master-Interlook za hotele — drugi adapter iste kategorije, ne zamena; budući avio/GDS, transferi, aktivnosti). Detaljno razrađeno u ranijem Travelgate predlogu, koji se ovde tretira kao specifikacija ovog modula. | M1, M2 |
| M5 | **Rezervacije i tok prodaje** | Search → Ponuda → Potvrda → Upravljanje rezervacijom, bez obzira da li proizvod dolazi iz M3 ili M4. | M1, M2, M3, M4; od avgusta 2026 i M22 *(jedinstveno sanduče za potvrde dobavljača, poglavlje 8.8 M5 specifikacije — meka zavisnost: `SupplierManifest`/`SupplierChangeNotice` rade i bez M22, samo bez automatskog poklapanja potvrde, vidi napomenu ispod tabele)* |
| M6 | **CRM (Gosti i Nalogodavci)** | Profili gostiju, istorija putovanja, preference, lojalnost, komunikacija. | M1, M5 |
| M7 | **B2B modul (Subagenti)** | Portal i pravila za poslovne kupce: cenovnici, provizije, kreditni limiti, poručivanje u ime krajnjeg gosta. Podržava **mrežu partnera sa više nivoa** (subagent može imati svoje sub-subagente), sa hijerarhijskim modelom podataka: kaskadna podela provizije po nivou, kreditni limiti po nivou, i strogo razdvojena vidljivost — svaki nivo vidi samo svoje, ne podatke agencija iznad/ispod sebe u lancu. | M1, M2, M5, M6, M15 *(M15 dodat avgust 2026 — omnisearch, ista napomena kao red M8)* |
| M8 | **Sajt agencije (B2C prikaz)** | Javni web prikaz kataloga i tok rezervacije za krajnje goste; back office isključivo u M2/M5. | M1, M2, M5, M6, M10, M20, M15 *(M6/M10 dodati pri specifikaciji M8 — nalog gosta i kartično plaćanje; M20 dodat naknadno — prihvatanje ugovora pre plaćanja; M15 dodat avgust 2026 — omnisearch, poglavlje 6.5 te specifikacije, sa sopstvenom, ranijom aktivacionom kapijom nezavisnom od pune Faze 7)* |
| M9 | **Mobilna aplikacija** | Aplikacija za goste (pregled/rezervacija/vaučeri) **i** za interni tim/vodiče na terenu. Deo za vodiče se projektuje kao **offline-first** (lokalni podaci — itinerar, lista gostiju, vaučeri — sa sinhronizacijom kad se veza vrati), jer tim često radi bez signala. Detaljno u specifikaciji M9 (Faza 6). | M1, M2, M5, M6, M10, M20 *(M10/M20 dodati naknadno — deo za goste koristi isti tok kao M8)* |
| M10 | **Finansije i računovodstvo** | Fakturisanje, fiskalizacija (SEF/ESIR), praćenje naplate, izveštaji, usklađenost sa zakonima RS. | M1, M3, M5, M6, M7 *(M3 dodat naknadno — obaveze prema dobavljačima, `SupplierObligation`)* |
| M11 | **Regulatorni modul (Compliance)** | Garancija putovanja (YUTA), evidencije za inspekciju. Namerno odvojen od M10 jer ima svoje rokove i API-je. *(eTurista/CIS prijava gostiju i boravišna taksa uklonjene iz obima, avgust 2026, na zahtev vlasnika — nadležnost smeštajnog objekta/hotela koji gosta direktno prima, ne agencije-touroperatora.)* | M1, M5 |
| M12 | **Marketing i sadržajni engine** | Content Engine opisan u prethodnom razgovoru: proizvod → generisanje sadržaja → kalendar/odobrenje → distribucija na kanale. | M1, M2, M6 |
| M13 | **Izveštavanje i BI** | Upravljački izveštaji nad podacima svih modula (profitabilnost, prodaja, marketing performanse). | Svi moduli (read-only) |
| M14 | **Podrška / Helpdesk** | Tiketing za goste i subagente. | M1, M5, M6, M7. Formalno i od M22 (opciono — mejl nit se ponekad konvertuje u tiket) kad taj modul postoji. |
| M15 | **AI agentska orkestracija** | Glavni agent i domenski agenti po modulima, sa ovlašćenjima definisanim u poglavlju 7\. Ovo nije "modul" u istom smislu kao ostali — to je upravljački sloj koji se postepeno uvodi u svaki modul kada taj modul postane stabilan. | Svi moduli |
| M16 | **Agentski distribucioni interfejs (MCP)** | Izlaže deo API-ja modula M2 (Katalog) i M5 (Rezervacije) eksternim AI agentima (npr. Google, ChatGPT, Sabre/MindTrip i slični) preko standarda Model Context Protocol, tako da agencija bude "vidljiva" i rezervabilna za AI agente koji rezervišu u ime gostiju izvan naših sopstvenih kanala. Vidi poglavlje 1.1. | M1, M2, M5 |
| M17 | **Interni radni panel** | Interni Next.js prikaz nad svim ostalim modulima za tim agencije — rezervacije, katalog, ugovori, finansije, itd. Nema sopstvenu poslovnu logiku ni bazu, isti princip kao M7/M8/M9: čisti kanal koji poziva interne API-je drugih modula. Formalizovan naknadno (jul 2026) — ranije pominjan u poglavlju 5 kao "interni radni panel" bez broja modula, iako ga Faza 1 izlazni kriterijum već pretpostavlja gotovim. | M1, M15 (i implicitno API svakog modula koji prikazuje) *(M15 dodat avgust 2026 — omnisearch, ista napomena kao red M8)* |
| M18 | **Operativni nadzor i AI optimizacija** | Kvalitetni/nadzorni agent koji kontinuirano prati signale kvarova kroz sve module i obaveštava spoljnim kanalima (Telegram, email); nedeljni sveobuhvatan pregled; agent za praćenje proizvodnih/tehnoloških trendova (proširenje poglavlja 10); okvir za izbor jezičkog modela po složenosti zadatka radi optimizacije tokena. Dodat naknadno (jul 2026). | M1, M15 (deo funkcija — praćenje signala/obaveštenja — ne zahteva pun M15 okvir i može krenuti ranije; trend-agent i model-tiering zahtevaju M15) |
| M19 | **Komunikaciona platforma** | Interni real-time tim-chat (zaposleni ↔ zaposleni); komunikacija sa gostima/subagentima ostaje u M14/M6, samo dobija chat-stil prikaz. Desktop iskustvo kroz M17 (PWA), mobilno kroz novi tab u M9 — ne grade se nove samostalne aplikacije. Dodato naknadno (avgust 2026): real-time chat sa dobavljačima preko laganog portal naloga (`SUPPLIER_CONTACT`), poglavlje 9 te specifikacije — zatvara problem #9. Dodat naknadno (jul 2026). | M1, M3 *(M3 dodat avgust 2026 — `SupplierContact`, problem #9)*, M14, M17, M9, M18 |
| M20 | **Ugovori sa klijentima** | Generiše zakonski obavezan Ugovor o organizovanju putovanja (ili posredovanju) sa gostom/nalogodavcem, po Zakonu o turizmu — treći pravni dokument u lancu rezervacije, uz ugovor sa dobavljačem (M3) i fiskalni dokument (M10). Sastavlja se isključivo iz podataka koji već postoje u M2/M3/M5/M11, bez dupliranja unosa. Dodat naknadno (jul 2026), poređenjem sa ranijim paralelnim dokumentom projekta. | M1, M2, M3, M5, M11 |
| M21 | **Centar za pomoć (baza znanja + AI asistent)** | Uputstvo za korišćenje same platforme (ne za putovanje) — za interni tim (kanal M17), B2B subagente (kanal M7) i, od avgusta 2026, korporativne self-service klijente (kanal M8/M9, `ClientAccount.account_type = LEGAL_ENTITY` iz M6), sa AI asistentom koji odgovara isključivo iz objavljenog sadržaja, eskalira ka M14 kad ne zna, i predlaže nove članke na osnovu stvarnih pitanja koja ostanu bez odgovora. Dodat naknadno (avgust 2026), na zahtev vlasnika; treća publika dodata istim mesecom. | M1, M6, M14, M15, M7, M8, M17 |
| M22 | **Email/Inbox platforma** | Centralizovan email klijent — sva poslovna sandučad (deljena i lična zaposlenih), prepiska sa gostima/subagentima/dobavljačima, sa eksplicitnom, pojedinačnom dodelom pristupa po sandučetu (ne po opštoj ulozi) i AI agentom koji sažima/predlaže nacrt odgovora. Odvojen od M19 (interni real-time chat, zaposleni↔zaposleni) i od M14 (formalno praćenje tiketa — mejl nit se opciono konvertuje u tiket). Prikazuje se kao sekcija unutar M17, nema sopstveni UI. Dodat naknadno (avgust 2026), na zahtev vlasnika. | M1, M14, M6, M7, M3, M15, M17 *(M17 dodat avgust 2026 — kanal prikaza, propust iz prvobitnog unosa, vidi napomenu ispod tabele)* |
| M23 | **Znanje** | Baza sadržaja o destinacijama/proizvodima (zemlje, hoteli, izleti) koju AI agent aktivno gradi iz odobrenih izvora (isključivo zvaničan sajt/društvene mreže dobavljača za proizvode, zvanični izvori za zemlje/destinacije) i osvežava na 30 dana, uvek uz ljudsko odobrenje pre objave/zamene sadržaja. Interni tim i subagenti pretražuju direktno; gost prima sadržaj isključivo preko deljenog javnog linka (M8), nikad sam ne pretražuje. Različito od M21 (uputstvo za platformu, ne za putovanje) i od M12 (javna promocija, ne interni radni alat). Dodat naknadno (avgust 2026), na zahtev vlasnika. | M1, M2, M7, M8, M15, M17 |

Napomena: M15, M16, M17, M18, M19, M20, M21 i M22 nisu greška u numeraciji — namerno su izdvojeni jer njihovo uvođenje prati sazrevanje ostalih modula, ne ide paralelno sa njihovom izgradnjom. M16 dodatno zavisi od toga da M2/M5 imaju čist, dokumentovan API (princip \#2 i \#3 iz poglavlja 3\) — ako taj API nije čist, M16 postaje mnogo skuplji projekat nego što bi trebalo da bude. M17, za razliku od M15/M16, mora postojati već od Faze 0/1 (poglavlje 8) — kasni broj je posledica toga kad je formalno imenovan, ne toga kad se gradi. M18 i M19 su naknadno dodati (jul 2026) na zahtev vlasnika — deo M18 funkcija (praćenje signala, obaveštenja) je nezavisan od M15 i može se graditi čim postoji dovoljno modula da se prati (praktično od Faze 2/3), dok trend-agent i model-tiering deo M18-a, kao i M19 u celosti, zahtevaju da M15 i M14/M9 već postoje. M20 je, kao i M17, primer kasnog broja sa ranom fazom (Faza 2) — naknadno formalizovan (jul 2026, poređenjem sa ranijim paralelnim dokumentom projekta) modul koji je zakonski neophodan od početka produkcijskog rada, ne od početka razvoja. M21 je poprečan kao M17/M18/M19 — sadržaj za tim može početi od Faze 0 (raste sa svakim modulom, isti obrazac kao M17), dok sadržaj za subagente prirodno čeka M7 (Faza 4); AI asistent deo zahteva da M15 okvir postoji. M22 je takođe poprečan (isti obrazac kao M17/M18/M19/M21, tako je i sam opisan u sopstvenom zaglavlju) — deljena sandučad (npr. `rezervacije@`) mogu postojati čim M1 (identitet/RBAC) postoji, dok prepoznavanje pošiljaoca kao gosta/subagenta/dobavljača prirodno sazreva kad M6/M7/M3 budu specificirani (do tada radi i bez tog prepoznavanja, samo plići), konverzija u tiket zahteva M14, a AI sažimanje/nacrt odgovora zahteva M15 okvir; prikazuje se kroz M17 (dodato avgust 2026 — ova rečenica je nedostajala od uvođenja M22, vidi napomenu uz tabelu iznad). M5 (Faza 1, dakle izgrađen pre M22) od avgusta 2026 ima meku zavisnost unazad od M22 — jedinstveno sanduče za potvrde dobavljača (rešava problem #11, M5 poglavlje 8.8): dok M22 ne postoji, `SupplierManifest`/`SupplierChangeNotice` i dalje rade (nacrt, ručno slanje, ručna potvrda), samo bez automatskog poklapanja pristigle potvrde po referentnom kodu — ista logika odloženog sazrevanja kao kod ostalih poprečnih modula gore.

---

## 5\. Referentna arhitektura sistema

                    ┌─────────────────────────────────────────┐

                    │   KANALI (Prikazi nad istim podacima)     │

                    │  M8 Sajt  |  M9 Mobilna app  |  M7 B2B     │

                    │        portal  |  M17 Interni radni panel  │

                    └───────────────────┬───────────────────────┘

                                        │  interni API (REST, dokumentovan OpenAPI-jem)

                    ┌───────────────────▼───────────────────────┐

                    │           POSLOVNI MODULI (M1–M14)          │

                    │  Svaki modul: svoja baza tabela \+ svoj API   │

                    │  Međusobna komunikacija ISKLJUČIVO kroz API  │

                    │  \+ Event Bus za asinhrone događaje           │

                    └───────────────────┬───────────────────────┘

                                        │

                    ┌───────────────────▼───────────────────────┐

                    │        M4 — SLOJ INTEGRACIJA (Adapteri)      │

                    │  Travelgate | SEF | ESIR | YUTA   │

                    │  budući: GDS/avio, rent-a-car, aktivnosti     │

                    └───────────────────┬───────────────────────┘

                                        │

                    ┌───────────────────▼───────────────────────┐

                    │            SPOLJNI SVET                     │

                    │  Dobavljači, državni sistemi, banke, kartice │

                    └─────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐

                    │  M16 — MCP izlaz ka eksternim AI agentima │

                    │  (Google, ChatGPT, Sabre/MindTrip, itd.)   │

                    │  čita isti interni API kao M8/M9/M7/M17 —  │

                    │  ne zaobilazi poslovna pravila iz modula   │

                    └─────────────────────────────────────────────┘

        Paralelno, kroz sve slojeve:

        M15 AI orkestracija  |  M1 Identitet/Audit  |  M13 BI (read-only nad svim)

Ključna posledica ove šeme: **sajt (M8) i mobilna aplikacija (M9) nikada ne pozivaju Travelgate ili SEF direktno.** Uvek idu kroz interni API modula M5/M2. Ovo je isti princip koji je predložen u Travelgate dokumentu (Integration Gateway), sada proširen na ceo sistem. **Isto pravilo važi i za M16**: eksterni AI agenti se ne puštaju direktno u M4 ili u bazu — prolaze kroz isti interni API kao svaki drugi kanal, čime poslovna pravila (cene, dostupnost, blokade) ostaju na jednom mestu bez obzira ko ih poziva — čovek na sajtu ili AI agent u ime gosta.

### 5.1 Responsive dizajn — jedan kod, svaki ekran (potvrđeno, avgust 2026.)

Svaki kanal iz šeme iznad (M8, M17, M7, i naknadno M21) mora dobro raditi na telefonu, preklopnom telefonu, tabletu i desktopu — **bez građenja posebne aplikacije za svaku grupu korisnika.**

- **M9 ostaje namerno uzak po obimu** — isključivo gost i vodič na terenu, jer jedino oni imaju stvaran razlog za zaseban mobilni sloj (offline-first rad bez signala, poglavlje 4). Direktor, Vlasnik, tim i subagenti **ne dobijaju posebnu aplikaciju** — oni već imaju svoj alat (M17, M7) koji mora lepo raditi na telefonu/tabletu. Ovo direktno sprovodi princip #1 (jedan izvor istine) i već zapisano pravilo iz M19 specifikacije da se ne grade nove samostalne aplikacije za isti podatak.
- **PWA (Progressive Web App)** — M17 i M7 se instaliraju sa ekrana telefona kao aplikacija (ikonica, pun ekran, rad offline za već učitane podatke), bez odvojenog koda od desktop verzije. M8 dobija isti tretman gde ima smisla (javni sajt, manje kritično da bude "instaliran").
- **Fluidan raspored, ne fiksne prelomne tačke.** Layout se gradi na procentima/grid/flex jedinicama koje se prilagođavaju svakoj širini ekrana, ne na fiksnom skupu "desktop/tablet/mobilni" piksela. Ovo automatski dobro pokriva i preklopne telefone (Galaxy Fold i slični) tretirajući svaku širinu kao regularan slučaj, ne poseban. Poseban režim za fizički pregib ekrana (tzv. viewport-segments API, prikaz "dve strane" preklopnog ekrana odvojeno) namerno je van obima v1 — dodaje se tek ako se pokaže stvarna potreba.
- **Deo Izlaznog kriterijuma svakog kanala**, ne naknadna provera — svaka Nivo 2 specifikacija kanala (M8, M9, M17, M7, M21 kad se doradi) navodi sopstvenu stavku provere prikaza na telefonu/tabletu pre nego što se taj kanal smatra gotovim.

---

## 6\. Tehnički stek — predlog i obrazloženje

Kriterijum za izbor nije "najmoderniji" ili "najbrži", već **najpouzdaniji za razvoj i dugoročno održavanje uz pomoć AI agenata**, uz solidnu podršku za spoljne saradnike kad zatreba.

| Sloj | Izbor | Zašto |
| :---- | :---- | :---- |
| Jezik (svuda) | **TypeScript** | Jedan jezik za backend, frontend i skripte integracija. Statička tipizacija hvata greške koje AI agent pravi pre nego što stignu do produkcije — ovo je verovatno najvažnija pojedinačna odluka u celom steku. Ogromna zastupljenost u trening podacima AI modela znači pouzdaniji generisan kod. |
| Backend framework | **NestJS** (Node.js) | Modularna arhitektura ugrađena u sam framework (moduli, servisi, dependency injection) prirodno prati podelu na M1–M14 iz poglavlja 4\. Vrlo dobro dokumentovan, predvidljiva struktura — lako za AI agenta da prati konvencije bez nagađanja. |
| Baza podataka | **PostgreSQL** | Relaciona integrity je neophodna za finansijske i rezervacione podatke (transakcije, strani ključevi, ograničenja). Podržava i JSONB za fleksibilne delove (npr. sadržaj marketinških objava, log AI agenata) bez potrebe za drugom bazom. |
| ORM / pristup bazi | **Prisma** | Šema baze je čitljiva i sama sebi dokumentacija ("schema-first"), što se odlično uklapa u princip da AI agent radi po pisanoj specifikaciji. Generiše tipizirani klijent — greške u imenu kolone postaju greška pri kompajliranju, ne runtime pad u produkciji. **Potvrđeno (jul 2026) nasuprot Drizzle-u**: iako je Drizzle tehnički bliži sirovom SQL-u, Prisma ostaje izbor jer je duže na tržištu i bolje zastupljena u podacima na kojima su AI modeli trenirani — manji rizik od suptilnih grešaka u AI-generisanom kodu, što je presudno jer vlasnik projekta sam ne piše kod. |
| API stil između modula i ka kanalima | **REST \+ OpenAPI specifikacija** | GraphQL (koji koristi Travelgate) je moćan ali unosi dodatnu kompleksnost pri validaciji da li je AI agent tačno ispoštovao ugovor. REST \+ OpenAPI daje mašinski proverljiv ugovor (schema) koji i AI agent i test alati mogu direktno da validiraju. GraphQL ostaje unutar M4 adaptera prema Travelgate-u, ali se na izlazu iz M4 prevodi u interni REST/JSON model. |
| Asinhrona komunikacija | **Event Bus** (početno: PostgreSQL LISTEN/NOTIFY ili lagani Redis Pub/Sub; kasnije po potrebi RabbitMQ/Kafka) | Moduli poput M12 (marketing) ili M15 (AI agenti) treba da reaguju na događaje ("nova rezervacija", "gost otkazao") bez direktnog pozivanja jedni drugih — ovo čuva nezavisnost modula iz principa \#2. |
| Frontend (svi kanali) | **Next.js (React)** | Isti okvir za sajt (SEO bitan → server-side rendering), interni radni panel i osnovu B2B portala — deljive komponente, jedan tim/agent uči jedan sistem. Mobilna aplikacija (M9) se razmatra posebno: React Native je prirodan nastavak istog stila razmišljanja i dozvoljava deljenje logike sa Next.js kodom. **Potvrđeno (jul 2026)**: hostuje se u standardnom self-hosted Node.js režimu na EU cloud infrastrukturi (vidi red "Hosting"), bez oslanjanja na Vercel-ekskluzivne funkcije (Edge ISR, Partial Prerendering). Razlog nije samo izbegavanje vendor lock-in-a — Vercel je američka kompanija podložna US CLOUD Act-u i (od početka 2026\.) nije na listi EU-U.S. Data Privacy Framework, što je u napetosti sa zahtevom iz poglavlja 9 za fizičku lokaciju ličnih/zdravstvenih podataka u EU. Prelazak na Vercel ostaje tehnički moguć kasnije (Vercel je napravljen da bez muke hostuje standardan Next.js kod), ali bi zahtevao prethodnu pravnu proveru usklađenosti, ne samo tehničku odluku. |
| Autentikacija / RBAC | **Self-hosted IAM (npr. Keycloak) ili Auth.js sa sopstvenim RBAC slojem** | Potrebna je fina kontrola prava (agent ne vidi finansije, subagent vidi samo svoje rezervacije) preko više kanala (interni panel, B2B portal, mobilna app) — jedan centralni IAM sprečava da svaki modul izmišlja sopstvenu proveru prava. |
| Hosting / infrastruktura | **EU cloud regija** (npr. Hetzner ili AWS/Azure EU-Central), infrastruktura definisana kao kod (IaC) | Zakon o zaštiti podataka o ličnosti i priroda podataka (pasoši, zdravstveni podaci za osiguranje) traže jasnoću oko fizičke lokacije podataka; IaC omogućava da AI agent pouzdano ponovi/izmeni infrastrukturu bez ručnih koraka koji se zaboravljaju. |
| Monorepo alat | **Turborepo ili Nx** | Svi moduli žive u jednom repozitorijumu sa deljenim tipovima (npr. definicija "Rezervacije" se ne piše dvaput), ali se mogu graditi/testirati/deployovati nezavisno — direktna podrška principu \#2. |
| Testiranje i CI | **Automatski testovi (unit \+ integration) \+ strogi CI koji ne pušta kod bez prolaska testova** | Ovo je nezaobilazna ograda kada veliki deo koda piše AI: test je jedini objektivni dokaz da generisan kod radi ono što specifikacija traži. Definiše se već u Fazi 0, ne dodaje naknadno. |

Ovaj stek je predlog za usvajanje u Master dokumentu — ako imate iskustva ili averziju prema nekoj od ovih tehnologija, ovo je mesto da to kažete pre nego što krenemo dalje, jer promena steka kasnije nosi realnu cenu.

---

## 7\. Model upravljanja AI agentima (M15) — pravila koja važe za ceo sistem

Ovo poglavlje formalizuje ono što je dogovoreno u prethodnom razgovoru:

1. **Struktura:** Jedan **Glavni agent (Orchestrator)**, pod direktnom kontrolom vlasnika, i po jedan **domenski agent** za svaki modul koji je zreo za AI asistenciju. Domenski agent ima pristup isključivo API-ju svog modula (princip najmanjih ovlašćenja) — CRM agent ne može da inicira fiskalnu fakturu, marketing agent ne može da menja cene u katalogu.  
2. **Tri nivoa autonomije**, definisana po akciji, ne po agentu:  
   - **Autonomno** — praćenje cena/dostupnosti kod dobavljača, priprema nacrta sadržaja, sažimanje upita, interni izveštaji, predlozi (ne izvršenja).  
   - **Predloži pa čovek odobri** — slanje ponuda B2B partnerima, izmene rezervacija, odgovori gostima koji pominju cenu ili obavezu, objava marketinškog sadržaja na javnim kanalima.  
   - **Nikad autonomno** — fiskalizacija (SEF/ESIR), transfer novca, potpisivanje ugovora, izmena garancije putovanja ili licenčnih podataka.  
3. **Audit log je obavezan za svaku akciju agenta** — ko/šta/kada/na osnovu kog konteksta/koji je rezultat. Ovo se gradi u M1 od Faze 0 i svaki modul ga koristi.  
4. **AI agenti se uvode postepeno, po modulu**, tek kada je taj modul deterministički stabilan (ima testove, radi u produkciji bez agenta bar jedan poslovni ciklus). Ne uvodi se agent u modul koji sam po sebi još nije proveren.  
5. **Podaci koji idu ka spoljnim AI provajderima** (ako se koriste eksterni modeli) moraju biti filtrirani od ličnih podataka gostiju gde god je to moguće, uz ugovor o obradi podataka sa provajderom tamo gde nije moguće — ovo je direktna posledica Zakona o zaštiti podataka o ličnosti.  
6. **Tempo uvođenja M15 nije proizvoljan — usklađuje se sa tempom industrije.** Prema Phocuswright istraživanju (2026), 61% turističkih kompanija već eksperimentiše sa ili skalira agentsku AI u svakodnevnom radu. Ovo ne menja redosled iz principa \#4 (determinizam pre autonomije) — i dalje se agent uvodi tek kad je modul stabilan — ali znači da se rok "kad-tad" mora zameniti konkretnim datumom po fazi (poglavlje 8), jer kašnjenje ovde direktno smanjuje operativnu konkurentnost, ne samo tehnički zaostatak.

---

## 8\. Mapa puta (fazni plan) — redosled izgradnje

Redosled je namerno konzervativan: prvo se gradi ono bez čega se zakonski i operativno ne može poslovati, tek onda ono što uvećava efikasnost i doseg.

| Faza | Sadržaj | Izlazni kriterijum (kad je faza gotova) |
| :---- | :---- | :---- |
| **Faza 0 — Temelj** | M1 (Identitet/RBAC/Audit), infrastruktura, CI/CD, monorepo skelet, IaC, osnovni model podataka za M2. | Prazna ali funkcionalna platforma: prijava, uloge, audit log rade; infrastruktura se diže iz koda. |
| **Faza 1 — Jezgro prodaje** | M2 (Katalog), M3 (Ugovaranje/alotmani), M4 (Travelgate integracija — po ranije pripremljenom predlogu), M5 (Rezervacije: Search → Ponuda → Potvrda → Upravljanje). | Tim može ručno, kroz interni panel, da pretraži, rezerviše i upravlja rezervacijom hotela — i iz sopstvenih ugovora i preko Travelgate-a. |
| **Faza 2 — Zakonska usklađenost** | M10 (Finansije: SEF/ESIR integracija, PDV po sistemu marže, obaveze prema dobavljačima), M11 (Compliance: garancija putovanja), M20 (Ugovori sa klijentima). | Svaka rezervacija iz Faze 1 može zakonito da se fakturiše, fiskalizuje, prati kroz garanciju putovanja i zakonski obavezan ugovor sa gostom — bez ovoga agencija ne sme da posluje produkcijski, bez obzira koliko su drugi moduli razvijeni. |
| **Faza 3 — Gost i kanal** | M6 (CRM), M8 (Sajt agencije, B2C). | Gost može samostalno da pretraži i rezerviše na sajtu; podaci se pune iz istog kataloga/rezervacionog sistema, ne ručno. |
| **Faza 4 — B2B** | M7 (Subagenti/portal), prilagođavanja M10 za provizije i kreditne limite. | Poslovni partneri imaju sopstveni pristup sa svojim cenovnicima i mogu da prodaju bez ručne intervencije agencije. |
| **Faza 5 — Merenje i podrška** | M13 (BI/izveštaji), M14 (Helpdesk). | Menadžment vidi profitabilnost po destinaciji/dobavljaču/kanalu; gosti i subagenti imaju gde da prijave problem. |
| **Faza 6 — Rast dosega** | M12 (Marketing/Content Engine), M9 (Mobilna aplikacija), M16 (Agentski distribucioni interfejs — MCP). | Proizvod objavljen jednom u katalogu automatski generiše predloge sadržaja za sve kanale; gosti imaju mobilnu aplikaciju; agencija je vidljiva i rezervabilna za eksterne AI agente (Google, ChatGPT i sl.), a ne samo za ljudske posetioce sajta. |
| **Faza 7 — AI orkestracija u punom obimu** | M15 uveden u sve module koji su prošli Fazu "stabilno u produkciji", po pravilima iz poglavlja 7\. | Glavni agent koordinira domenske agente u svakodnevnom radu, uz zadržana pravila autonomije i audit trag. |
| **Faza 8 — Očvršćavanje** | Bezbednosni audit, penetraciono testiranje, DR/backup vežba, revizija usklađenosti sa svim zakonskim rokovima. | Sistem prošao nezavisnu proveru pre nego što se smatra dugoročno stabilnim za skaliranje. |

Napomena: faze se ne moraju raditi strogo sekvencijalno bez preklapanja (npr. rad na M9 mobilnoj aplikaciji može početi dok se M13 finalizuje), ali **redosled zavisnosti iz poglavlja 4 i zakonski prioritet Faze 2 se ne preskaču.**

**Poprečni moduli namerno nisu u ovoj tabeli:** M17, M18, M19, M21 i M22 ne pripadaju jednoj fazi — svaki raste postepeno kako sazrevaju moduli o kojima izveštava/koje prikazuje, umesto da čeka jedan trenutak "gotovosti". Razlog i tačan tempo za svaki su objašnjeni u poglavlju 4, napomena ispod tabele modula, ne ovde.

**Napomena o dokumentaciji uz implementaciju (avgust 2026, na zahtev vlasnika):** Nivo 2 specifikacija ostaje jedini izvor istine za *šta* se gradi, ali kad modul dobije implementaciju, "Izlazni kriterijum" te faze/modula dobija i dva dodatna, standardna deliverable-a: (a) `docs/api/M<broj>-<slug>.md` — API dokumentacija za spoljne integratore sa stvarnim primerima zahteva/odgovora, za svaki modul koji izlaže API; (b) korisničko uputstvo za taj modul upisano kao `HelpArticle` u M21 (Centar za pomoć), za publiku(e) na koju se modul odnosi. Detaljno pravilo u CLAUDE.md, sekcija "API dokumentacija i korisnička uputstva".

---

## 9\. Bezbednosni i regulatorni baseline (važi od Faze 0\)

- Enkripcija podataka u mirovanju i u transportu, za sve module bez izuzetka.  
- RBAC po modulu i po ulozi (definisano u M1), sa audit logom svake izmene osetljivih podataka.  
- Fizička lokacija podataka u EU/skladu sa Zakonom o zaštiti podataka o ličnosti; ugovori o obradi podataka sa svakim spoljnim provajderom koji dolazi u dodir sa ličnim podacima.  
- Redovan, testiran backup (ne samo konfigurisan — periodično se proverava da li se iz njega zaista može oporaviti sistem).  
- Usklađenost sa rokovima: SEF/e-fakture, ESIR fiskalizacija, godišnje obnavljanje garancije putovanja kod YUTA.  
- Ako se u budućnosti uvede online plaćanje karticama — obrada kartice ide isključivo kroz sertifikovanog platnog provajdera (PCI-DSS), platforma nikad ne čuva puni broj kartice.

---

## 10\. Praćenje industrijskih trendova (mesečni pregled)

Oblast agentske AI u turizmu se, sudeći po datumima izvora korišćenih u ovom dokumentu (decembar 2025, februar 2026, jul 2026), menja iz meseca u mesec, ne iz godine u godinu. Zato je uveden stalan proces, ne jednokratno istraživanje:

- **Učestalost:** jednom mesečno.  
- **Obim provere:** vesti i istraživanja o (1) agentskoj AI u rezervacijama i distribuciji turizma (Phocuswright, Skift, PhocusWire, IDC i slično), (2) razvoju MCP i sličnih standarda za "agent-ready" API-je u turizmu, (3) potezima velikih igrača relevantnih za nas (Google, OTA platforme, GDS-ovi poput Sabre/Amadeus, Travelgate/Travelsoft), (4) izmenama srpskih propisa relevantnih za module M10/M11 (SEF, ESIR, YUTA/garancija putovanja), (5) *(prošireno pri specifikaciji M18)* opštijih proizvodnih/UX/tehnoloških trendova relevantnih za izgled i funkcionalnost same aplikacije, ne samo agentski turizam. Od M18 nadalje, ovaj proces asistira AI agent (M18 `TrendSuggestion`), uz isto pravilo da se ništa ne menja bez odobrenja vlasnika.  
- **Izlaz provere:** kratak rezime (do jedne strane) sa jasnom preporukom — da li nešto od pronađenog zahteva izmenu ovog Master dokumenta (novi modul, promena redosleda faza, promena tehničkog izbora) ili je samo informativno i ne zahteva akciju. Ako zahteva izmenu, predlog se iznosi na potvrdu pre nego što se unese u dokument — ništa se ne menja automatski bez odobrenja.  
- **Vlasništvo:** vlasnik projekta prima rezime i odlučuje da li se predložene izmene usvajaju.  
- **Dnevnik nalaza:** čak i kada nalaz ne menja arhitekturu, beleži se u Dodatku A (na kraju dokumenta) sa datumom i naznakom kog modula se tiče. Razlog: svaki mesečni pregled kreće "iz čista" bez sećanja na prethodne, pa se detalji relevantni za buduće specifikacije modula (npr. tačna verzija standarda na koju se oslanjamo) moraju negde trajno zapisati, ne samo usmeno preneti.

---

## 11\. Šta ostaje otvoreno za sledeći razgovor

Pre nego što pređemo na Fazu 0 i prvu detaljnu specifikaciju modula, potrebno je zajednički potvrditi ili korigovati:

1. ~~Da li se slažete sa predloženim tehničkim stekom (poglavlje 6), ili menjamo neki deo.~~ **Rešeno (jul 2026.)**: stek iz poglavlja 6 usvojen bez izmena tehnologija, uz dve dopune direktno unete u tabelu: (a) Next.js se hostuje u self-hosted Node režimu na EU cloud infrastrukturi, bez Vercel-ekskluzivnih funkcija, zbog usklađenosti sa poglavljem 9 (EU lokacija podataka, US CLOUD Act rizik); (b) Prisma potvrđena nasuprot Drizzle-u zbog zrelosti i zastupljenosti u AI trening podacima.  
2. ~~Obim mobilne aplikacije (M9) — samo za goste, ili i interni radni alat za tim/vodiče na terenu.~~ **Rešeno (jul 2026.)**: M9 obuhvata oboje. Deo za vodiče na terenu se projektuje kao offline-first (rade bez signala), sa sinhronizacijom podataka kad se veza vrati — vidi izmenu u poglavlju 4.  
3. ~~Da li B2B portal (M7) treba od starta da podržava i sub-subagente (mreža agencija), ili samo direktne partnere.~~ **Rešeno (jul 2026.)**: da, podržava mrežu sa više nivoa (subagent → sub-subagent), sa hijerarhijskim modelom provizija, kreditnih limita i vidljivosti podataka — vidi izmenu u poglavlju 4.  
4. Konkretna imena i redosled prvih dobavljača/destinacija za pilot u Fazi 1, radi realnog testiranja Travelgate integracije.  
5. ~~Da li postoji budžetski/vremenski okvir koji ograničava dužinu pojedinih faza, ili se ide isključivo po izlaznim kriterijumima iz poglavlja 8.~~ **Rešeno (jul 2026.)**: nema fiksnog roka — svaka faza traje dok ne ispuni svoj izlazni kriterijum iz poglavlja 8, bez veštačkog skraćivanja.

Kada ovo potvrdimo, prelazimo na detaljnu specifikaciju **Faze 0 / Modula M1**, po istom principu — jedan modul, do nivoa da AI agent može direktno da programira po njemu.

---

## Dodatak A — Dnevnik mesečnih pregleda trendova

Nalazi koji ne menjaju arhitekturu sada, ali su relevantni za buduće specifikacije modula. Svaki unos: datum, modul(i) na koji se odnosi, nalaz, izvor.

### 28\. jul 2026\. (ručno pokrenut prvi pregled)

- **Tiče se M16.** MCP (Model Context Protocol) je 28\. jula 2026\. objavio najveću reviziju specifikacije od nastanka standarda: prelazak na bez-stanja (stateless) arhitekturu, ukinut inicijalni handshake, pooštrena autorizacija, uveden formalni proces zastarevanja funkcija. Beta SDK-jevi (Python, TypeScript, Go, C\#) za novu verziju su dostupni. **Posledica za kasnije:** kada budemo pisali specifikaciju M16, referencirati MCP spec verzije 2026-07-28 ili noviju, ne stariju dokumentaciju. Izvor: [MCP Blog — Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/), [WorkOS](https://workos.com/blog/mcp-2026-spec-agent-authentication).  
- **Tiče se M16 / konteksta.** Expedia, Booking.com i TripAdvisor su još u oktobru 2025\. pokrenuli MCP integracije unutar ChatGPT-a — potvrda da su najveći OTA igrači već prisutni u agentskom kanalu. Izvor: PC Tech Magazine (jul 2026).  
- **Tiče se M10.** Potvrđeno da od 1\. aprila 2026\. interno fakturisanje mora u potpunosti da se kreira unutar same SEF platforme (Poreska uprava ima uvid u interne tokove u realnom vremenu) — ovo je već na snazi. SEF je 2\. jula 2026\. objavio i verziju 4.0.0 sa ažuriranim internim tehničkim uputstvom (za sada u demo okruženju). **Posledica za kasnije:** specifikacija M10 mora predvideti da se fakture kreiraju kroz SEF tok, ne kao naknadna prijava već postojećeg dokumenta. Izvor: [Paragraf — eFakture](https://www.paragraf.rs/kancelarko/efakture-elektronske-fakture.html), [Neobilten](https://www.neobilten.com/tag/uputstvo/).  
- **Tiče se M4.** Travelgate (deo Travelsoft grupe) nastavlja da se profiliše striktno kao hotelska B2B konektivnost ("biti najbolji na svetu u hotelskoj konektivnosti", izjava iz jula 2026), uz proširenje pristupa Travelport-u na 400+ agencija (6. jul 2026). Ne pokazuje nameru šireg pokrivanja avio/aktivnosti — potvrđuje raniju procenu da M4 mora imati zasebne adaptere za te segmente, ne osloniti se na Travelgate za sve. Izvor: Breaking Travel News, Travelsoft Press.

### 30. jul 2026. (analiza sabre.com u kontekstu M4/M16)

- **Tiče se M4.** Sabre (GDS) sajt eksplicitno cilja avio kompanije i velike TMC-ove (Travel Management Companies) — testimonijali su Virgin Australia, Priceline, Navan; nema pozicioniranja za male nezavisne turoperatore. **Posledica za kasnije:** direktan ugovor sa Sabre-om verovatno nije realan put za agenciju veličine Terminal Travel-a kad M4 dobije avio/GDS adapter — realniji put je preko agregatora koji već ima GDS konekciju (isti obrazac kao Travelgate → Travelport, već zabeleženo u nalazu od 28.7.2026). `ProviderAdapter` interfejs (M4 specifikacija, poglavlje 2) treba da ostane provajder-agnostičan bez obzira da li GDS sadržaj stigne direktno ili preko posrednika.
- **Tiče se M16 / poglavlja 1.1.** Sabre sajt eksplicitno pominje "MCPs" u testimonijalu klijenta (BizTrip AI): "The Sabre Mosaic platform and MCPs provide the scalable foundation... while our agentic AI delivers the personalization." Konkretna potvrda da veliki GDS igrač već gradi oko MCP standarda, uz sopstvenu agentsku AI ponudu (Sabre IQ, "Airline assistant — AI that books trips", "Agency Concierge" chatbot). Potkrepljuje premisu iz poglavlja 1.1 (AI agenti kao kupac) i tezu M16 modula — ne menja arhitekturu, samo dodatna potvrda smera. Izvor: sabre.com (pristupljeno 30.7.2026).
- **Tiče se M4.** Sabre Store (central.sabre.com/marketplace) pokazuje da treća strana (Zentrumhub Solutions) prodaje "Zentrum Connect" — "One hotel API connecting 90+ suppliers and 900,000+ hotels through a single normalized integration". **Posledica za kasnije:** ovo je dodatni kandidat pored Travelgate-a kad se u M4 stvarno bira hotelski agregator — vredi uporediti pokrivenost/cenu pre konačnog izbora, ne pretpostaviti da je Travelgate jedina opcija. Izvor: central.sabre.com/marketplace (pristupljeno 30.7.2026).
- **Tiče se M4 (avio/GDS, budući adapter).** Isti marketplace prodaje NDC sadržaj **po pojedinačnoj avio-kompaniji** ("NDC Offers from Emirates (EK)", "NDC Offers from Qatar Airways (QR)"), ne kao jedan univerzalni avio-API. **Posledica za kasnije:** kad M4 dobije avio/GDS adapter, NDC integracija verovatno zahteva zasebno uključivanje po avio-kompaniji — ovo je operativna komplikacija (ne samo tehnička) koju treba predvideti u planiranju te faze, ne otkriti je tek pri implementaciji. Izvor: central.sabre.com/marketplace (pristupljeno 30.7.2026).

### 1. avgust 2026. (analiza developer.sabre.com/product-collection/agentic-api u kontekstu M4/M16)

- **Tiče se M4.** Sabre je preoblikovao podskup postojećih API-ja (Hotel Search, Hotels Rates, Hotels Price Check, Booking Management, i nekoliko avio Flight Shop/Search/Refresh/Reshop/Check API-ja) u "Agentic-ready" seriju za LLM/agentske klijente. Stranica se završava sa "Ask your account director for more" — nema self-serve cenovnika ni onboardinga za malu agenciju. **Posledica za kasnije:** ovo potvrđuje, ne menja, nalaz od 30.7.2026 — direktan ugovor sa Sabre-om i dalje nije realan put za M4 kad dobije avio/GDS adapter; ostaje agregatorski put. Izvor: developer.sabre.com/product-collection/agentic-api (pristupljeno 1.8.2026).
- **Tiče se M16.** Sabre sam gradi svoj MCP server kao tanak prevodilački sloj *na vrhu* tih istih REST API-ja, ne kao poseban sistem — potvrđuje pristup već usvojen u M16 poglavlju 2 (MCP alat → interni API iza njega). Tri javno opisana principa vredna ugleda pri implementaciji M16: (1) payload za agentski/LLM sloj namerno manji i pljosnatiji od standardnog API odgovora, radi nižeg troška tokena; (2) OpenAPI specifikacije sa bogatim primerima da LLM tačnije generiše pozive; (3) poruke o greškama pisane tako da agent može sam da se ispravi, ne samo šifra greške. Upisano kao stavka u M16 poglavlje 10 (Otvoreno za dalje). Izvor: developer.sabre.com/product-collection/agentic-api/1.0/about.html (pristupljeno 1.8.2026).

### 2. avgust 2026. (analiza travelsoft.com portfolija — celokupna grupa, u kontekstu M2/M5/M10)

- **Tiče se M10.** Travelsoft Pay (deo grupe, osnovan 2025, partnerstvo sa Mastercard za virtuelne kartice, potvrđeno jul 2026) pokazuje da vodeći igrač u istoj industriji drži isplate dobavljačima, virtuelne kartice i refundacije kao poseban, namenski tok — ne kao sporedan dodatak fakturisanju. **Posledica:** M10 specifikacija dopunjena poglavljem 8.5 (isplate dobavljačima u stranoj valuti preko `BANK_TRANSFER`/`VIRTUAL_CARD`, i eksplicitan `RefundInstruction` tok za refundaciju gosta van kartičnog `VOID`-a) — verzija M10 podignuta na 1.5. Odluka: ostaje deo M10, ne postaje zaseban modul, dok stvaran obim/drugi provajder to ne opravda. Izvor: travelsoft.com (portfolio), pymnts.com, travelandtourworld.com (pristupljeno 2.8.2026).
- **Tiče se M5/M2.** Travel Compositor (deo grupe od 2014, Palma de Mallorca) profiliše se oko dinamičkog multi-destinacijskog sastavljanja putovanja (Tripplanner engine — kombinuje multidestinaciju, pakete, routing i krstarenja u jedan tok). Master dokument poglavlje 1.1 već navodi "kompleksna višedestinacijska putovanja" kao ključnu odbranu TT-a od generičkog AI, ali M5 tok pre ove dopune nije imao eksplicitan korak sastavljanja pre Ponude. **Posledica:** M5 specifikacija dopunjena poglavljem 3.0 (`Itinerary`/`ItinerarySegment`, opcioni korak pre `Quote`, sa konverzijom `POST /itineraries/:id/to-quote`) — verzija M5 podignuta na 1.4. Izvor: travelsoft.com (portfolio), travelcompositor.com (pristupljeno 2.8.2026).
### 2. avgust 2026. (nastavak — omnisearch, na zahtev vlasnika posle nacrta izgleda inspirisanog Opera Air browserom)

- **Tiče se M15/M17/M7/M8.** Istraženi funkcije/izgled Opera Air browsera (mindfulness browser, Opera, lansiran 2025) na zahtev vlasnika, kao inspiracija za izgled Terminal aplikacije. Direktno prenosivo: minimalistička, smirena vizuelna tema (posebno vredna za M17 gde tim radi ceo dan); sidebar sa prečicama umesto punog prekida toka rada; "workspaces" koncept preveden kao sačuvani operativni kontekst (npr. "fiskalni dokumenti na čekanju"); split-screen za poređenje ponuda. Neprenosivo/nerelevantno: VPN, ad-blocker (browser-specifično); pune meditacione vežbe (rizik da deluje neozbiljno za B2B/finansijski alat, sugerisan blaži oblik ako uopšte). **Konkretna odluka doneta:** univerzalno pretraživačko polje sa AI razgovorom (prazan upit + Enter prikazuje sve rute/menije dostupne ulozi; upit sa tekstom pokreće AI agenta koji pronalazi/navigira, nikad ne izvršava radnju) — upisano kao dopuna M15 (poglavlje 6.5, novi `agent_role = OMNISEARCH_AGENT`, striktno read-only) i kao kontekstualizovana dopuna M17 (§5.5), M7 (§2.0.3), M8 (§3a). Izvor: web istraživanje Opera Air (blogs.opera.com, webdesignerdepot.com, opera.com/features), pristupljeno 2.8.2026.
- **Napomena o fazi.** Omnisearch formalno zavisi od M15, koji je Faza 7 — ali dobija sopstvenu, raniju aktivacionu kapiju (`ModuleAgentActivation`, M15 poglavlje 3) nezavisnu od pune AI orkestracije, isti obrazac kao već postojeći M18 raniji deo. Ne menja redosled ostalih faza.

- **Tiče se šire mape modula.** Ostatak Travelsoft portfolija (Orchestra, Atcore, Tigerbay, traffics, .BOSYS, Travelgate, airQuest, Travel Connection Technology) suštinski pokriva isti prostor koji već imaju M2–M5/M17; Eventiz (medijska kuća) i Travelsoft Services (konsultantske usluge) nisu relevantni za obim TT-a. Afidium (preuzet od Orchestra, jul 2026 — optimizacija avio tarifa i PNR kvalitet) beležen je već kao potencijalno relevantan referentni primer za M4 kad taj modul dobije avio/GDS adapter, ne pre toga. Bez dalje akcije sada.

