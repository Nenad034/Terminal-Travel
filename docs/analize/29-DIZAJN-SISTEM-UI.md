# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu) i M7 (B2B portal, isti obrazac — poglavlje 7), kasnije M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.46 — novo poglavlje 2.0e (23.8.2026): svetli mod dobija treću nijansu (`--bar`, trake tamnije od bočnih panela, centralni sadržaj tamniji od čiste bele ali svetliji od bočnih panela), `apps/panel/tailwind.config.ts` i `TopBar.tsx`/`StatusBar.tsx`/`TerminalPanel.tsx` ožičeni.
**Verzija:** 1.45 — poglavlje 5f dopunjeno (23.8.2026): podela terminal panela na dva nezavisna panela (VS Code "Split Terminal" obrazac), M17 spec v1.97.
**Verzija:** 1.44 — poglavlje 5a dopunjeno (23.8.2026): "+" pojednostavljen na prazan tab (ne direktno pretraga), više tabova iste putanje kao opšta sposobnost, M17 spec v1.94. Logo premešten sa dna Sidebar-a u gornju traku (isti M17 spec unos) — ovaj dokument nema poseban logo-odeljak, samo M17 changelog.
**Verzija:** 1.43 — poglavlje 5f dopunjeno (23.8.2026): kopiranje poruka + segmentacija po turi + kartica odobrenja za web fetch, M15 spec §6.9.6/§6.9.7, M17 spec v1.92. Ostatak poglavlja 5f nepromenjen.
**Verzija:** 1.42 — poglavlje 5f implementirano (23.8.2026): `CustomizeLayoutButton.tsx`, `TerminalPanel.tsx`, M17 spec v1.89. Stanje po korisniku čuva se u `localStorage` za sada (pravi `UserPreference` backend, M1 §3.9, i dalje ne postoji u kodu — ostaje otvorena stavka, isti privremeni obrazac kao širina bočne trake). Ostatak ponašanja nepromenjen u odnosu na v1.41 opis.

**Verzija:** 1.41 — novo poglavlje 5f (23.8.2026, na zahtev vlasnika: "dugme iz VS Code Customize Layout" + "terminal kao u VS Code"): "Customize Layout" dugme (uključi/isključi bočnu traku/desni panel/statusnu traku/AI chat/terminal, stanje po korisniku preko `UserPreference`) i terminal panel (VS Code pozicija na dnu, vizuelno stilizovan kao terminal — NIJE stvaran shell, poziva kontrolisan `BiTerminalAgent`, isključivo VLASNIK, obrazloženje bezbednosnog rizika i alternative u M15 spec poglavlju 6.9). Nije još implementirano — spec pre koda po CLAUDE.md.

**Verzija:** 1.40 — poglavlje 5e implementirano (21.8.2026, na zahtev vlasnika): `NotificationStack.tsx`, M17 spec v1.31 — pri gradnji otkriven i ispravljen pravi bag u M19 backend-u (CRITICAL isporuka nikad nije emitovala WS događaj, M19 spec v1.4). Ovaj dokument ostaje nepromenjen po ponašanju, samo referenca na implementaciju.

**Verzija:** 1.39 — novo poglavlje 6e (20.8.2026, na zahtev vlasnika, uz dva snimka ekrana VS Code MSSQL ekstenzije "What's new" panela): konkretizacija kartice-sa-akcijama u dve podforme (naslovni red akcija sa strelicom / vertikalna lista veza sa ikonicom), izričito samo vizuelni obrazac — sama funkcija "šta je novo" (panel koji se sam otvara posle ažuriranja) nije usvojena u ovom prolazu, vlasnik je potvrdio da želi samo izgled kartice za opštu upotrebu kroz module. v1.38 — dve dopune (19.8.2026, na zahtev vlasnika): poglavlje 5b dobija dugme "Pošalji ponudu" na ekranu Ponude (WhatsApp/Viber/Telegram web-intent linkovi, podaci/tok: M5 spec poglavlje 3.1a, novo); poglavlje 5d dobija klaster od pet ikonica-pokretača u donjoj traci — Mejl (M22)/Interni chat (M19) otvaraju sekciju unutar panela, WhatsApp/Viber/Telegram otvaraju spoljne aplikacije bez veze sa Terminal bazom (čist prečac, ne nov kanal). v1.37 — ispravka poglavlja 2.0b (19.8.2026, na zahtev vlasnika — "ne sviđa mi se bela boja slova, potamnite"): tekst na akcentnoj pozadini pojednostavljen na jednu, tamnu boju (`#14140D`, 5.88:1) za sve veličine i oba moda — uklonjeno ranije pravilo "beo za krupan tekst / taman za sitan", nema više razlike po veličini teksta. v1.36 — novo poglavlje 2.0b (19.8.2026, na zahtev vlasnika — "hoću da akcentna boja u oba moda bude ista, maslinasta luksuzna boja"): akcentna boja prestaje da bude literalna VS Code vrednost po modu (`#80CBC4`/`#0069CC`) i postaje jedinstvena maslinasta `#8A8A5E` u oba moda — struktura/ponašanje ostaje VS Code vernost (poglavlje 2.0a), boja postaje Terminal-ova. Pravilo teksta na akcentu po veličini, ne po modu: krupan/podebljan tekst → belo (3.57-3.68:1, WCAG "veliki tekst" 3:1 prag), sitni elementi → taman skoro-crn tekst (5-6:1). Jedini izuzetak koji i dalje traži po-modu nijansu: tekst izabranog reda u levoj traci (mehanizam gde selekcija menja boju teksta) — matematički ista boja ne može biti čitljiv sitan tekst na skoro-crnoj i skoro-beloj pozadini istovremeno. v1.35 — ispravka moje greške iz v1.34 (19.8.2026, na zahtev vlasnika — "ja sam baš hteo Material Theme, zašto ste je uklonili?"): v1.34 je pogrešno protumačila zahtev za VS Code vernost kao signal da zameni Material Theme sa zvaničnom "Dark 2026" temom — vraćeno, Material Theme High Contrast ostaje izvor za tamni mod (vlasnikova nameran, već ranija odluka 17.8.2026), "Light 2026" ostaje za svetli mod, dva različita izvora po modu je svesna odluka, ne nedoslednost. Sve vrednosti ponovo izvučene 19.8.2026 direktno iz instalirane `equinusocio.vsc-material-theme-34.7.16` ekstenzije (ne iz sećanja/starog teksta dokumenta) — potvrđeno identične ranije upisanim. Tabela strukturne vernosti (tab/selekcija/hover) prepravljena da odražava Material Theme-ov stvaran mehanizam (pune boje + promena boje teksta pri selekciji, ne providni slojevi kao Light 2026) umesto pogrešno primenjenog Dark 2026 obrasca. v1.34 — ispravka poglavlja 2/2.0a (19.8.2026, na zahtev vlasnika — "vizuelno identično najnovijoj verziji VS Code-a"): pogrešno uparen izvor za tamni mod (treća strana "Material Theme High Contrast") zamenjen zvaničnim, uparenim "Dark 2026" (`theme-defaults/themes/2026-dark.json`), isti par kao već korišćeni "Light 2026"; obe vrednosti izvučene 19.8.2026 direktno iz VS Code-a stvarno instaliranog na razvojnoj mašini, potvrđeno i vlasnikovim stvarnim `settings.json` (`workbench.colorTheme: "Light 2026"` već aktivno). Sekundarni tekst tamnog moda ponovo ispravljen istim principom kao v1.11 (`#8C8C8C` na 5.18:1 → `#ABABAB` na 7.83:1, AAA cilj). Uklonjen neusklađen narativni opis "amber/rđa akcent" iz poglavlja 2 (nikad nije odgovarao stvarnim upisanim brojevima) — tekst sad prati brojeve (teal tamni / plava svetli), ne obrnuto. Dodata nova tabela strukturne vernosti (izgled taba, pozadinsko bojenje selekcije/hover-a), doslovno iz istih fajlova — uključuje stvarnu VS Code odluku da je aktivna ivica taba u svetlom modu crna, ne akcentna boja. v1.33 — red "Individualni paketi" dopunjen (18.8.2026, na zahtev vlasnika): desni panel dobija upozorenja o hronologiji, gornja traka dobija "Podeli"/"Kloniraj"/"Izvezi PDF" — podaci/tok: M5 spec poglavlja 3.0.5/3.0.6/3.0.7/3.0.8 (nova). v1.32 — red "Individualni paketi" u tabeli 9 ikona (poglavlje 5b) dopunjen (18.8.2026, na zahtev vlasnika): preostalih 8 ikona postaju dugmad za dodavanje/uključivanje-isključivanje segmenta dok je itinerar aktivan, desni panel prikazuje cenu po segmentu i tekući zbir — podaci/tok: M5 spec poglavlje 3.0.4 (novo). v1.31 — dopuna poglavlja 5b (18.8.2026, na zahtev vlasnika): "Ručna stavka" — nova radnja uz svaku od 9 ikona pretrage, otvara direktan unos proizvoda van M2 kataloga umesto vođene pretrage (podaci/tok: M5 spec poglavlje 3.0f, novo). v1.30 — dopuna poglavlja 5d (18.8.2026, na zahtev vlasnika): lična podešavanja dobijaju izbor oblika forme "Ponuda → Rezervacija" (jedna duga forma naspram stepper-a) — tok specifikovan u novom M5 spec poglavlju 4.4, čuva se kroz novi M1 `UserPreference` mehanizam (M1 spec §3.9) koji formalizuje mesto čuvanja za sva ovakva lična UI podešavanja (širina panela, tema, itd.) koja je ovaj dokument do sad samo pretpostavljao. v1.29 — novo poglavlje 3a.1 (18.8.2026, na zahtev vlasnika): konkretna Codicon ikonica po svakoj od 9 grupa gornje trake i svih 19 sekcija leve trake, birana po logičnom obliku onoga što se njome otvara (npr. `shield` za garanciju putovanja, `compass` za bazu znanja o destinacijama, `plug` za B2B partnere) — namerno razdvaja `mail` (sekcija Email/Inbox) od `inbox` (već rezervisano za M15 Agent Inbox stavku, poglavlje 5c) da se dva pojma ne mešaju. v1.28 — dopuna poglavlja 6d (18.8.2026, na zahtev vlasnika): dva vrlo vidljiva, uvek otvorena "brza filtera" pinovana na vrhu sekcije "Filteri" (van sklopivih grupa) — Refundabilno/Nerefundabilno i Odmah potvrda/Upit; podaci/logika: M5 spec poglavlje 3.0c.3a. v1.27 — dopuna poglavlja 6d (18.8.2026, na zahtev vlasnika, uz snimak ekrana VS Code-a): filteri unutar sekcije "Filteri" (levi panel) grupisani po kategoriji umesto jedne ravne liste — cena/kategorija/usluga kao zasebne pod-sekcije, sadržaji-tagovi po već postojećoj grupi iz M2 spec §2.3c (Udaljenost od plaže, Bazen, Plaža, Sadržaji objekta, Soba, Pogodno za, Politika); sklopljeno podrazumevano, otvoreno samo gde ima aktivan filter. v1.26 — dva nova poglavlja, 18.8.2026, na zahtev vlasnika (referenca: VS Code status bar/nalog/split, sistemska obaveštenja): 5d (donja traka — nalog, status veze, AI status po modulu, sat/vremenska zona, oznaka okruženja; gornji desni deo trake — nalog, lična podešavanja, zvono za istoriju obaveštenja, dugme za podelu ekrana) i 5e (iskačuća obaveštenja u donjem desnom uglu — ne nestaju sama, gomilaju se, link ka pomenutom zapisu u novom tabu, "Zatvori sve", sažimanje posle praga, boja isključivo po ozbiljnosti). v1.25 — dopuna poglavlja 6 (18.8.2026, na zahtev vlasnika, potvrđeno na primeru kartica rezultata pretrage smeštaja): konkretan osnovan oblik kartice za ceo interfejs — neznatno zaobljene ivice, proporcija ~10% šira nego visoka, akcentna ivica isključivo u izabranom/aktivnom stanju. Kartica AI odgovora (poglavlje 6c.3) sad izričito prati isti oblik, akcentna ivica dok odgovor generiše (ekvivalent "izabranog" stanja). v1.24 — novo poglavlje 6c.3 (18.8.2026, na zahtev vlasnika, referenca Chrome/Google AI pretraga): postepeno ispisivanje odgovora (streaming), izvori kao pilule/kartice ispod odgovora (klik → nov tab), predložena sledeća pitanja kao chips ispod odgovora (i dalje prolaze kroz isti tok potvrde kao ručno otkucan upit). Izgled same kartice odgovora ostaje otvoren, čeka dalji opis vlasnika. v1.23 — novo poglavlje 6c.1/6c.2 (18.8.2026, na zahtev vlasnika, referenca VS Code/Copilot Chat): dugme `+` prilaže kontekst razgovoru (trenutno otvoren zapis, rezultati pretrage, prilog fajla/slike, pretraga interneta), `@` pominjanje konkretnog zapisa unutar polja, slash komande, dugme "Zaustavi", istorija razgovora vezanih za zapis, konkretizovana traka moda/dozvola. Nulto stanje centralnog panela (prazan tab/"Početna") sad definisano u M17 spec poglavlju 5a — istaknuto AI chat polje + postojeća agregirana upozorenja + nedavno otvoreno/sačuvani prikazi, isti sastav za M7. v1.22 — ispravka poglavlja 6d (18.8.2026, na zahtev vlasnika): filteri rezultata pretrage sele se iz trake iznad centralnog panela u **levi panel**, kao dodatna sklopiva sekcija pored stabla vođene pretrage — isti obrazac kao VS Code Explorer/Outline/Timeline (odvojene sklopive celine u bočnoj traci, ne traka unutar editora). Centar ostaje isključivo prikaz rezultata. v1.21 — šest dopuna od 18.8.2026 (na zahtev vlasnika, uz analizu Linear/Attio/Salesforce/HubSpot obrazaca): novo poglavlje 4a (tastaturna prečica na svaki čest postupak, `?` otvara cheat-sheet); novo poglavlje 4b (merljiv brzinski cilj ispod 100ms, boja isključivo za AI/status/semantiku, nikad dekorativno); poglavlje 4 dopunjeno (prazan upit komandne palete sad prikazuje i nedavno otvorene zapise); poglavlje 5b pojašnjeno (centar = uvek lista ili pun zapis, desni panel = uvek sažetak/izvedeni prikaz, nikad zamena za centar; prelazak na pun zapis iz sažetka uvek nov tab; "Povezano" traka formalizovana kao standardan tip desnog panela; sačuvani prikazi u levom navigatoru); poglavlje 5c dopunjeno (stalno vidljiva "Inbox" ikonica sa brojem, M15 poglavlje 6). v1.20 — dopuna poglavlja 6d (18.8.2026, na zahtev vlasnika): radnja "Info" na svakoj kartici/redu rezultata pretrage otvara desni panel sa M23 sadržajem o proizvodu/destinaciji (podaci: M5 poglavlje 3.0b.4, novo). v1.19 — dopuna poglavlja 5b (18.8.2026, na zahtev vlasnika): granice između panela (levi/centralni/desni) su ručno prevlačive (drag), isti obrazac kao VS Code — razumni minimum po zoni, širina se pamti po korisniku preko sesija, dvoklik vraća na podrazumevanu širinu. v1.18 — ispravka poglavlja 5a (18.8.2026, na zahtev vlasnika istog dana kao v1.17): izmena unutar već otvorenog tab-a pretrage (filteri, parametri, sledeća stranica) **ne** otvara nov tab — samo osvežava tekući. Nov tab za pretragu ide isključivo preko `+` pored aktivnog taba (ili klika na ikonicu pretrage u levom navigatoru), ne automatski pri svakoj izmeni kao što je v1.17 pogrešno formulisala. v1.17 — dopuna poglavlja 5a (18.8.2026, na zahtev vlasnika): svaka nova pretraga (bilo koja od 9 vrsta, poglavlje 5b) uvek otvara nov tab — izuzetak od opšteg pravila "navigacija unutar taba ne otvara novi", koje i dalje važi za drill-down u zapis. v1.16 — novo poglavlje 5c (17.8.2026, na zahtev vlasnika): back-office ~20 sekcija grupisano u ~9 ikona za gornju traku (tačan spisak grupa: M17 spec poglavlje 4a), leva traka prvo prikazuje spisak sekcija grupe pa se skuplja na izabranu sekciju sa poljima za pretragu/filtriranje ispod naziva. Poglavlje 5 izmenjeno da odražava da gornja traka sad nosi grupe modula (potvrđeno kao zvanična VS Code opcija, `workbench.activityBar.location: "top"`), ne više "minimalna jedna linija". v1.15 — pojašnjenje poglavlja 5b (17.8.2026, na zahtev vlasnika, isti dan): eksplicitno razdvojena dva nivoa levog navigatora — gornji nivo je spisak SVIH back-office modula (već postojeći `apps/panel/src/lib/nav.ts`), devet ikona po vrsti proizvoda je stablo-grana unutar JEDNOG od tih modula ("Pretraga i rezervacije"), ne zamena za ostatak spiska. Nema izmene podataka/toka, samo ispravljena formulacija koja je mogla delovati kao da levi panel gubi ostale module. v1.14 — novo poglavlje 6d (17.8.2026): prikaz rezultata pretrage (kartice vs. kompaktni redovi po tipu), traka filtera, AI pretraga unutar rezultata (isti obrazac kao 6c), mesto pojavljivanja predloga unakrsne prodaje (uz vrh desnog panela, odmah po dodavanju stavke), odbrojavanje isteka/upozorenje na valutu u desnom panelu. Podaci/logika iza ovoga: M5 poglavlje 3.0e. v1.13 — dopuna poglavlja 5b (17.8.2026): konačna lista od 9 ikona u levom navigatoru za pretragu (Smeštaj/Letovi/Transferi/Rent-a-car/Things to do/Individualni paketi/Grupni paketi/Krstarenja/Putno osiguranje) — konkretan tok polja za svaku definisan u M5 spec poglavljima 3.0c/3.0d, ovaj dokument ostaje raspored/interakcija. v1.12 — dopuna poglavlja 5b (17.8.2026): jedna ikonica po `Product.type` na vrhu levog navigatora za pretragu — konkretan tok polja (Smeštaj) sad definisan u M5 spec poglavlju 3.0c, ovaj dokument ostaje raspored/interakcija. v1.11 — poglavlje 2.0a (novo, 17.8.2026): vlasnik izabrao dve konkretne, stvarno instalirane/ugrađene VS Code teme kao izvor "Horizont v2" palete — "Material Theme High Contrast" (tamni) i "Light 2026" (svetli). HEX vrednosti izvučene direktno iz theme fajlova (ne iz sećanja), programski provereno protiv poglavlja 2a: pronađena i ispravljena jedna stvarna greška u izvoru — sekundarni tekst bočne trake tamnog moda (`#5f7a87` na `#192227`) je davao 3.56:1, pod čak i AA minimumom, posvetljen na `#9bb0bd` (7.19:1, AAA) pre upisa. v1.10 — dopuna 17.8.2026, isti dan kao v1.9: (a) paleta ostaje eksplicitno promenljiva, ne zaključana (poglavlje 2) — tehnički mehanizam to već obezbeđuje (centralni sloj CSS promenljivih), samo formalno zapisano na vlasnikov zahtev; (b) pravilo kontrasta (poglavlje 2a) pojačano — AAA (7:1) postaje stvarni cilj za sav telo-tekst/oznake, ne samo "gde je lako", na izričit zahtev vlasnika da čitljivost bude prioritet. v1.9 — vlasnikova odluka 17.8.2026 (referenca: snimci ekrana VS Code-a sa Claude Code panelom, priloženi uz odluku): **M7 (B2B portal) dobija identičan vizuelni/interakcioni obrazac kao M17** — razrešava dotad otvoreno pitanje iz poglavlja 8. Dodato: poglavlje 5b (tri-panelni raspored — levi navigator/stablo, centar prikaz, desni panel za izdvajanje detalja sa mogućnošću dva panela jedan pored drugog, isti obrazac kao VS Code split editor grupe), poglavlje 6c (AI razgovor — plutajući kontekst/dozvole iznad polja za unos, ne odvojen banner), dopuna poglavlja 2 (birač teme — VS Code MEHANIZAM biranja, ali sadržaj ostaje Terminal-ova sopstvena tamna/svetla paleta po kanalu, bez dodatnih imenovanih tema). Novo otvoreno pitanje (poglavlje 8): vlasnikov prošireni pregled uživo nad celim poslovanjem (Elastic/Kibana-stila) — namerno odloženo, vlasnik izričito rekao "još ćemo raditi na tome". v1.8 — tri vlasnikove odluke od 17.8.2026: (a) paleta sajta ispravljena po §2a (sedam parova je padalo AA u svetlom modu, dva u tamnom — vidi poglavlje 8), (b) **boja šljive je druga boja sajta**, zamenila zelenu umesto da se doda kao treća (poglavlje 2), (c) **sajt ide punom širinom ekrana**, sa izuzetkom za stranice koje se čitaju (novo poglavlje 6b). Dodato i poglavlje 2.0 — dokument je do sad beležio samo panelovu paletu, što je bio deo razloga zašto paleta sajta nikad nije prošla proveru. v1.7 — pravilo iz 1.6 sprovedeno kroz ceo panel (17 mesta, uključujući pet dugmadi kojima je padao tek hover), pa je stavka zatvorena i u backlogu; v1.6 — poglavlje 2a dopunjeno tvrdim pravilom "tekst na `accent-soft` je `accent-strong`, ne `accent`" (nalaz iz M17 live-provere 17.8.2026: `accent` na `accent-soft` daje 3.96:1 u svetlom modu i pada AA); v1.5 — dodato poglavlje 6a: obeležavanje autora radnje (čovek / AI agent / spoljni nalog) kao jedinstveno pravilo za sve kanale, na zahtev vlasnika (avgust 2026) — zatvara nalaz da je svaki ekran panela do sad izmišljao sopstveni način obeležavanja AI poteza; prati ga dopuna M17 poglavlje 3.1 i M19 poglavlja 2.3/9.5; v1.4 — dodato poglavlje 5a: tabovi za paralelan rad na više otvorenih zapisa/ekrana istovremeno (na zahtev vlasnika); v1.3 — dodato poglavlje 2a: kontrast teksta/ikonica je tvrd zahtev (WCAG AA minimum, AAA cilj gde je lako ostvarivo), proverava se lokalno protiv stvarne pozadine (ne jedne pretpostavljene), identično u oba moda — na izričit zahtev vlasnika; v1.2 — dodato poglavlje 3a (ikonografija — Codicons, rešava ranije otvoreno pitanje) i poglavlje 6 (sadržaj centralnog panela: isticanje pozadinom teksta, kartice, suptilne animacije), proširen opis bočne trake stablo-strukturom (poglavlje 5), sve na zahtev vlasnika (avgust 2026); v1.1 — dodat zahtev za obavezan tamni i svetli mod (poglavlje 2), ne samo tamni (avgust 2026, na zahtev vlasnika).

---

## 1. Vodeća ideja

Aplikacija treba da izgleda **prepoznatljivo drugačije** od bilo koje druge poslovne platforme, ali da **radi** po obrascima koje ljudi već znaju napamet — jer tim radi pod pritiskom (gost čeka na telefonu dok se pravi rezervacija), i to nije trenutak da neko mora da uči novi način rada.

**Razlikovanje ide kroz vizuelni identitet** (boje, tipografija, sitni detalji) — **ne kroz izum novih interakcionih pravila**. Interakcija se namerno oslanja na već pobedničke obrasce (VS Code, Chrome, Linear, Raycast) jer su ti obrasci brzi i imaju nisko kognitivno opterećenje — što je tačno ono što je bitno kad neko radi ovo svaki dan.

---

## 2. Paleta boja

**Ispravka, 19.8.2026, na zahtev vlasnika** ("vizuelno identično najnovijoj verziji VS Code-a") — raniji opis ispod je pričao o toploj narandžastoj/amber akcentnoj boji, ali konkretne HEX vrednosti nikad nisu tako upisane (poglavlje 2.0a uvek je nosio teal/plavu, direktno iz stvarnih VS Code tema — Material Theme za tamni mod, ugrađena "Light 2026" za svetli). Vlasnik je potvrdio (19.8.2026) da važe **brojevi**, ne raniji narativ — tekst ispod je usklađen sa poglavljem 2.0a, ne obrnuto.

Polazna tačka: hladna teal/plava porodica, direktno iz dve stvarne VS Code teme (Material Theme High Contrast za tamni mod, ugrađena "Light 2026" za svetli mod — poglavlje 2.0a, vlasnikov nameran izbor, ne dve teme iz iste zvanične porodice) — ne izmišljena kombinacija.

| Uloga | Ton | Napomena |
| :---- | :---- | :---- |
| Osnovna pozadina (tamni mod) | Dubok teget/teal (topliji od crne) | Direktno iz Material Theme High Contrast (`#263238`) — zamenjuje čisto crnu, miran za oči tokom celog radnog dana |
| Osnovna pozadina (svetli mod) | Čisto bela / vrlo blago hladno-bela bočna traka | Direktno iz VS Code "Light 2026" |
| Akcentna boja (glavna, **ista u oba moda** — ispravka 19.8.2026, poglavlje 2.0b) | Maslinasta, `#8A8A5E` | Dugmad, aktivna stavka u bočnoj traci, otvorena `Ctrl+K` paleta, ivica aktivnog taba, statusi koji traže pažnju — **više nije literalna VS Code vrednost teme** (bila `#80CBC4` tamni / `#0069CC` svetli), sad jedinstvena boja brenda, ista u oba moda, poglavlje 2.0b |
| Druga boja — **samo na sajtu (M8)**, boja šljive | Modro-plava (šljiva) | Vlasnikova odluka 17.8.2026. Uloga: **sve što nije glavna radnja** — sekundarna dugmad, oznake, akcenti na deljenim stranicama. Glavna radnja ("Rezerviši", "Plati") ostaje amber, jer ona mora da vuče oko; kad bi obe boje vukle jednako, ni jedna ne bi. Zamenila je zelenu (`--accent2`), **nije se dodala kao treća** — zelena je do tada bila upotrebljena na jednom jedinom mestu, pa nije bila stvarna druga boja identiteta nego ostatak. Topla amber + hladna šljiva se međusobno pojačavaju; amber + zelena su bila dva srednje topla tona koja se blago tuku. |

**Koliko akcentnih boja:** panel (M17) ostaje na **jednoj** — tamo je gustina informacija visoka i druga boja bi proizvela šaren, haotičan utisak. Sajt (M8) ima **dve** sa jasno razdvojenim ulogama (gore). Više od dve nema ni jedan kanal — treća boja obesmišljava pravilo o hijerarhiji pažnje, jer čitalac više ne zna šta je važno.

### 2.0 Dve palete, ne jedna — i zašto se to skoro izgubilo

Panel i sajt **imaju odvojene palete** i to je namerno (različita publika, različit utisak): panel je "Horizont" (hladan teget/teal, poglavlje 8), sajt je "Zalazak" (topla peščana, `apps/web/src/app/globals.css`). Ovaj dokument je do 17.8.2026. beležio **samo panelovu** — i to je bio deo razloga zašto paleta sajta nikad nije prošla proveru iz poglavlja 2a i zašto je sedam parova padalo AA prag (vidi poglavlje 8). **Svaka nova paleta se upisuje ovde u istom prolazu kad nastane**, ne posle.
| Tekst / sekundarni elementi / ivice | Neutralni sivi tonovi izvedeni iz teget osnove — svetli u tamnom modu, tamni u svetlom | Cela paleta deluje kao jedna porodica boja, ne nabacane komponente, u oba moda |

Tačne HEX vrednosti nisu fiksirane ovim dokumentom — biraju se/fino podešavaju pri izradi UI kod-baze na osnovu ove polazne tačke i **obavezno prema pravilu kontrasta iz poglavlja 2a**, ne izmišljaju se unapred bez stvarnog ekrana na kom se proveravaju.

### 2.0a Konkretan izvor za Horizont v2 — dve postojeće VS Code teme (vlasnikova odluka, 17.8.2026; potvrđeno 19.8.2026)

**Ispravka (19.8.2026):** prethodna verzija ovog poglavlja je pogrešno protumačila zahtev za VS Code vernost kao znak da izvor treba menjati, i privremeno zamenila Material Theme sa zvaničnom "Dark 2026" temom. Vlasnik je potvrdio da je originalni izbor nameran — **Material Theme ostaje izvor za tamni mod**, vraćeno u istom prolazu. "Light 2026" (zvanična, ugrađena) ostaje za svetli mod, nepromenjeno — dva različita izvora po modu je svesna odluka (vlasnik koristi/preferira Material Theme za tamni rad), ne greška koju treba uskladiti u jednu porodicu.

Vrednosti ispod ponovo izvučene **19.8.2026 direktno iz instaliranih fajlova** na ovoj razvojnoj mašini — **"Material Theme High Contrast"** (`equinusocio.vsc-material-theme-34.7.16`, `Material-Theme-Default-High-Contrast.json`) za tamni mod, **"Light 2026"** (VS Code ugrađena, `theme-defaults/themes/2026-light.json`) za svetli mod — ne iz sećanja, programski provereno protiv pravila iz poglavlja 2a.

| Uloga | Tamni (Material High Contrast) | Svetli (Light 2026) |
| :---- | :---- | :---- |
| Pozadina (editor/glavni panel) | `#263238` | `#FFFFFF` |
| Bočna traka / gornja traka | `#192227` | `#FAFAFD` |
| Tekst (glavni) | `#EEFFFF` (12.77:1 na pozadini) | `#202020` (16.29:1 na pozadini) |
| Tekst — sekundaran (bočna traka) | `#5f7a87` **(3.56:1 — pada AA, ispravljeno)** → `#9bb0bd` (7.19:1) | `#606060` (6.29:1 na beloj) |
| Akcentna boja | `#80CBC4` (teal, 7.05:1 na tamnoj pozadini) | `#0069CC` (plava, 5.39:1 na beloj) |
| Tekst na akcentnoj pozadini | `#ffffff` | `#FFFFFF` (5.39:1 na `#0069CC`) |
| Ivica/border | `#3B4A51` | `#F0F1F2` |

**Jedna stvarna korekcija, ne kozmetička:** izvorna vrednost sekundarnog teksta bočne trake u tamnom modu (`#5f7a87`) daje samo **3.56:1** na `#192227` pozadini — pada čak i tvrdi AA minimum (poglavlje 2a), ne samo novi AAA cilj. Posvetljena je unutar iste hladne sivo-plave porodice na `#9bb0bd` (7.19:1) pre nego što je upisana ovde — pravilo iz poglavlja 2a se ne zaobilazi ni kad izvor konteksta dolazi od stvarne, poznate teme. Akcentna boja na svetloj pozadini (`#0069CC`, 5.39:1) prolazi AA sa marginom ali ne dostiže AAA (7:1) — prihvatljivo dok se koristi kao pozadina dugmeta/velika kontrolna površina (poglavlje 2a, 3:1 prag za takve elemente).

**Strukturna/interakciona vernost VS Code-u** (dopuna, 19.8.2026, na zahtev vlasnika — "izgled taba", "pozadinsko bojenje teksta") — pored boja, sledeće je preuzeto **doslovno** iz istih fajlova, ne aproksimirano. Napomena: Material Theme i Light 2026 rešavaju selekciju/hover na **strukturno različit način** (Material Theme koristi pune boje + promenu boje teksta, Light 2026 koristi providne slojeve preko postojeće pozadine) — obe vernosti su preuzete tačno kako izvor to radi, ne izjednačene veštački:

| Element | Tamni (Material High Contrast) | Svetli (Light 2026) |
| :---- | :---- | :---- |
| Aktivan tab — pozadina | `#263238` (ista kao glavna pozadina) | `#FFFFFF` |
| Neaktivan tab — pozadina | `#263238` (**ista kao aktivan** — razlika nije u pozadini nego u ivici/boji teksta ispod) | `#FAFAFD` |
| Aktivan tab — ivica/tekst | Ivica `#80CBC4` **(izvorna VS Code vrednost — u implementaciji zamenjena maslinastom `#8A8A5E`, poglavlje 2.0b)**, tekst `#FFFFFF`; neaktivan tab tekst `#5f7a87` | Gornja ivica `#000000` (**crna, ne akcentna** — VS Code svetli mod signalizira aktivan tab crnom linijom, ovo ostaje nepromenjeno) |
| Selekcija teksta (pozadinsko bojenje) | `#80CBC420` **(izvorno — u implementaciji `#8A8A5E20`, ista logika, nova boja)** | `#0069CC40` **(izvorno — u implementaciji `#8A8A5E40`)** |
| Red pod hoverom (lista/stablo) | `#192227` (**puna boja**, ista kao bočna traka — ne providan sloj; hover ne koristi akcent, nepromenjeno) | `#00000014` (crna, providna, 8%; nepromenjeno) |
| Izabran red (lista/stablo) | Pozadina `#192227` (puna), **tekst postaje akcentna boja** — izvorno `#80CBC4`, u implementaciji zahteva po-modu nijansu maslinaste (poglavlje 2.0b, jedini izuzetak) | Pozadina `#00000025` (crna, providna, 15%), tekst ostaje `#202020` (nepromenjeno) |

Razlika u aktivnoj ivici taba (akcent u tamnom, crna u svetlom) i providno-crno/belo pravilo za hover/selekciju su namerno preuzeti tačno ovako — to je stvarna VS Code odluka, ne nešto što bi ovaj dokument sam izmislio da izgleda slično. Redovi označeni "izvorno" ostaju tačan opis kako VS Code to radi (reference), ali stvarna implementacija koristi maslinastu boju brenda umesto literalne VS Code akcentne boje — poglavlje 2.0b niže.

### 2.0b Akcentna boja postaje jedinstvena, maslinasta — ne više po VS Code temi (dopuna, 19.8.2026, na zahtev vlasnika)

**Odluka:** akcentna boja (uloga iz poglavlja 2 — dugmad, aktivna stavka, ivica aktivnog taba, `Ctrl+K` paleta, značke) prestaje da bude literalna VS Code vrednost po modu (`#80CBC4` tamni / `#0069CC` svetli) i postaje **jedna, ista maslinasta boja u oba moda: `#8A8A5E`**. Ovo je svesno odstupanje od "doslovno VS Code" pravila iz poglavlja 2.0a — **struktura/ponašanje** (raspored, tabovi, hover/selekcija mehanika) ostaje VS Code vernost, ali **boja** postaje Terminal-ova sopstvena, tačno onako kako vodeća ideja dokumenta oduvek kaže (poglavlje 1: "razlikovanje ide kroz vizuelni identitet, ne kroz interakciona pravila").

**Zašto ista boja u oba moda nije trivijalno** — WCAG kontrast formula fizički ne dozvoljava da jedna boja bude čitljiv **tekst** i na skoro-crnoj i na skoro-beloj pozadini istovremeno (matematička nemogućnost, ne izbor). Rešeno razdvajanjem po nameni:

- **Pozadina/ispuna (dugme, ivica taba, značka, tačka)** — sam `#8A8A5E` radi identično u oba moda, jer ovde važi blaži prag 3:1 (poglavlje 2a, "velika kontrolna površina"), ne 4.5:1 za tekst. Provereno: 3.68:1 na tamnoj pozadini (`#263238`), 3.57:1 na svetloj (`#FFFFFF`) — oba iznad praga.
- **Tekst na akcentnoj pozadini — jedna, ista tamna boja, bez izuzetka po veličini** (ispravka 19.8.2026, na zahtev vlasnika — "ne sviđa mi se bela, potamnite slova"): `#14140D` (skoro crn), **5.88:1 na `#8A8A5E`, isto u oba moda i na svakoj veličini teksta** — dugme, značka, oznaka svi koriste identičnu kombinaciju, bez posebnog pravila za krupan/podebljan tekst.
- **Jedini preostali izuzetak: tekst izabranog reda u levoj traci** (mehanizam iz Material Theme-a gde se selekcija signalizira bojom teksta, ne samo pozadinom, poglavlje 2.0a) — sitan tekst na sirovoj pozadini panela, ne može da koristi identičan `#8A8A5E` u oba moda (isti matematički razlog kao iznad). Ovde se zadržava po-modu nijansa iste maslinaste porodice (tamnija za svetli mod, svetlija za tamni) — **tačne vrednosti se biraju/proveravaju pri izradi ekrana**, isti princip kao svaka druga boja u ovom dokumentu (poglavlje 2a), ne pogađaju se unapred.
- **Selekcija teksta (pozadinsko bojenje, `mark`/highlight)** — nasleđuje istu logiku kao izvorna VS Code vrednost (providan sloj preko postojeće pozadine), samo sa maslinastim tonom umesto teal/plave: `#8A8A5E20` (tamni), `#8A8A5E40` (svetli) — isti mehanizam, nova boja.

**Van obima ove odluke** — pozadine, granice i tekst boje (poglavlje 2.0a glavna tabela) ostaju nepromenjene, literalno iz Material Theme/Light 2026 — menja se isključivo uloga "akcentna boja".

Ova tabela je konkretna polazna vrednost ("Horizont v2") — ne menja pravilo ispod da paleta ostaje promenljiva, ne novo zaključavanje.

### 2.0c Semantička "upozorenje" (warn) boja ispravljena (21.8.2026, na zahtev vlasnika)

`--warn`/`--warn-bg` (`globals.css`) nisu izvučeni iz VS Code tema (poglavlje 2.0a) kao ostatak palete — birani su nezavisno kao standardan amber semantički par, uz `--ok`/`--danger`. Vlasnik je, uz snimak ekrana (dashboard kartice sa upozorenjima o rokovima), prijavio da svetla verzija (`#a86a12` na `#f9edd3`) "ne uklapaju se ni u jedan mod" — previše zasićena/"kandi žuta" naspram ostatka hladne palete. Pri proveri je usput otkriven i **stvaran WCAG propust**: tekst na sopstvenoj pill pozadini (`#a86a12` na `#f9edd3`) davao je samo `3.82:1`, ispod 4.5:1 praga iz poglavlja 2a — nije bilo uočeno pri ranijem prolazu jer je tada mereno samo protiv `bg`/`panel` pozadine, ne i protiv `warn-bg` pill pozadine na kojoj se tekst stvarno prikazuje.

Nova vrednost, prigušeniji zlatno-braon ton (bliži ostatku palete), PROVERENA WCAG 2.1 formulom (relativna luminansa) protiv obe stvarne pozadine na kojima se koristi:

| Mod | Bilo (tekst na `warn-bg`) | Sad (tekst na `warn-bg`) | Tekst na `bg`/`panel` |
| :---- | :---- | :---- | :---- |
| Svetli | `#a86a12` na `#f9edd3` — **3.82:1 ❌** | `#7a5a12` na `#f3ecd9` — **5.40:1** | `#7a5a12` na `#ffffff` — 6.37:1 |
| Tamni | `#e0a542` na `#332508` — 6.84:1 (prolazio) | `#e0ac52` na `#33240c` — **7.29:1** | `#e0ac52` na `#263238` — 6.39:1 |

Tamni mod je ranije prolazio kontrast, ali je ipak blago prilagođen (isti pravac, malo svetlije/manje narandžasto) da ostane u istoj porodici tona kao ispravljen svetli mod — jedinstven ton umesto "svetli menjan, tamni slučajno ostao drugačiji". Ovo je deljen token — primenjeno svuda gde se `--warn`/`--warn-bg` koriste u panelu (51 mesto kroz 34 ekrana, ne samo dashboard kartice sa snimka), jedan izvor istine (`globals.css`), nema lokalnih izuzetaka po ekranu.

**Drugi pokušaj (21.8.2026, isti dan)** — posle osvežavanja, vlasnik je snimkom potvrdio da prigušeniji zlatno-braon amber (tabela iznad) i dalje vizuelno čita kao "žuto", ista pritužba kao pre. Umesto dalje suptilne kalibracije unutar iste amber porodice, promenjena je **porodica boje** — ponuđene tri opcije kroz `AskUserQuestion` (narandžasto-riđa/bakarna dalje od crvenog kraja, maslinasto-zlatna bliža `--accent` porodici, ili potpuno neutralna bez obojene pozadine), vlasnik izabrao **maslinasto-zlatnu**: ista porodica kao jedinstvena akcentna boja (`#8A8A5E`, poglavlje 2.0b), samo tamnija/zasićenija nijansa — deluje kao deo iste palete umesto stranog tela. Finalne vrednosti, PROVERENE WCAG 2.1 formulom:

| Mod | Tekst na `warn-bg` | Tekst na `bg`/`panel` |
| :---- | :---- | :---- |
| Svetli | `#6b6b1f` na `#eeeedc` — 4.78:1 | `#6b6b1f` na `#ffffff` — 5.60:1 |
| Tamni | `#c2c26a` na `#2a2a12` — 7.80:1 | `#c2c26a` na `#263238` — 7.03:1 |

Ovo su finalne vrednosti u `globals.css` (zamenjuju tabelu iznad, koja ostaje kao zapis prvog, odbačenog pokušaja).

### 2.0d `--border` potamnjen — bio praktično nevidljiv (21.8.2026, na zahtev vlasnika)

Vlasnik je, uz snimak ekrana (linije oko kartica u centralnom delu, M6 CRM zapis), prijavio: "Jedva se vide okvirne linije sadrzaja u centralno delu. Potamnite ih za 15%." Provera je pokazala da `--border` (`#f0f1f2` svetli mod) daje samo **1.13:1** na belu pozadinu — daleko ispod 3:1 praga za granice iz poglavlja 2a, stvaran propust koji je postojao od uvođenja Horizont v2 palete, ne samo suptilna pritužba. Doslovnih "-15%" na vrednost ovoliko blizu bele (`240→204` po RGB kanalu) bi dalo tek **1.57:1** — praktično nepromenjeno, jer procenat od skoro-bele vrednosti ne pomera kontrast dovoljno da bude vidljiv. Umesto doslovnog izračuna, izabrana je vrednost koja stvarno prolazi 3:1 prag (isti standard primenjen na svaku drugu granicu u ovom dokumentu):

| Mod | Bilo | Sad | Kontrast na `bg` |
| :---- | :---- | :---- | :---- |
| Svetli | `#f0f1f2` (1.13:1 ❌) | `#858c92` | 3.41:1 |
| Tamni | `#3b4a51` (1.43:1 ❌) | `#748088` | 3.25:1 |

Tamni mod nije bio deo pritužbe (snimak je svetli mod), ali je imao isti stvaran propust pri proveri — ispravljen u istom prolazu, ista logika kao svaka druga token-ispravka ovog dana (jedan izvor istine, nema mod koji ostaje slučajno drugačiji). Ovo je deljen token — primenjeno svuda gde se `--border` koristi (kartice, forme, padajući meniji, `kbd` oznake), ne samo dashboard kartice sa snimka.

### 2.0e Svetli mod dobija TREĆU nijansu — trake tamnije od bočnih panela (23.8.2026, na zahtev vlasnika)

Vlasnik je, posle uživo pregleda: "previse je svetla bela pozadina centralnog panela u ligjht modu, zatamnite ga malo a da bide svetlije od levog i desnog panela. sve trake neka budu za nijansu tamnije od svega." Do sada je svetli mod imao samo DVE nijanse — `--panel` čisto bela (`#FFFFFF`, centralni sadržaj) i `--panel-2` (`#FAFAFD`, praktično nerazlučivo od bele) za SVE ostalo, trake I bočne panele zajedno. Sad tri, namerno odstupanje od poglavlja 2.0a glavne tabele (koja i dalje beleži izvorne VS Code "Light 2026" vrednosti kao referentnu tačku, ne kao trenutno stanje ovog tokena):

| Nivo | Token | Vrednost | Koristi ga |
| :---- | :---- | :---- | :---- |
| Najsvetliji | `--panel` (= `--bg`, ostaju namerno jednaki, poglavlje 6b/v1.45 razlog) | `#FAFAFD` (preuzeto sa mesta gde je ranije bio `--panel-2`) | Centralni sadržaj (`<main>`, aktivan tab) |
| Srednji | `--panel-2` | `#F5F5F7` (nova vrednost) | Levi/desni bočni panel (`Sidebar.tsx`, `RightPanel.tsx`, `ActivityBar.tsx`) |
| Najtamniji | `--bar` (nov token) | `#F0F1F2` (VS Code "Light 2026" vrednost koju je poglavlje 2.0a od početka navodilo kao deo palete, nikad ranije stvarno ožičena ni u jedan token — bila je kratko `--border`, uklonjena odatle u poglavlju 2.0d zbog neproleznog kontrasta kao GRANICA; kao POZADINA ovaj isti problem ne postoji, tamni tekst na njoj i dalje daleko iznad AAA) | Gornja/donja traka (`TopBar.tsx`, `StatusBar.tsx`), unutrašnje zaglavlje terminal panela (`TerminalPanel.tsx`) |

Tamni mod nije tražio treću nijansu — `--bar` tamo dobija istu vrednost kao `--panel-2` (`#192227`), token postoji svuda (nijedna `bg-bar` klasa ne ostaje bez definisane promenljive), ali se ništa vizuelno ne menja. `--bg` menja vrednost zajedno sa `--panel` (isti par, namerno jednaki, v1.45 razlog — margina oko `w-[90%]` glavnog sadržaja ne sme da izgleda kao vidljiva "kutija" drugog tona).

**Paleta ostaje promenljiva, ne zaključana jednom zauvek** (potvrđeno 17.8.2026, na izričit zahtev vlasnika). Tehnički mehanizam ovo već obezbeđuje bez dodatnog rada — boje žive isključivo kao centralni sloj CSS promenljivih (isti sloj koji poglavlje 2 birač teme i M7 poglavlje 2.0.5 `SubagentBranding` već koriste), nikad utkane direktno u komponente. Promena tona/nijanse "Horizont"/"Zalazak" palete je u svakom trenutku izmena vrednosti tog sloja, ne prepravka UI koda — uz jedini uslov da svaka nova vrednost ponovo prođe proveru iz poglavlja 2a pre nego što se smatra gotovom.

**Tamni i svetli mod — oba se prave, na zahtev vlasnika (avgust 2026).** Tamni ostaje podrazumevani (prvi koji se implementira, prvi koji se testira), ali svetli mod nije opcioni "ako ikad zatreba" — obavezan je od starta.

- **Podrazumevano:** aplikacija prati podešavanje operativnog sistema korisnika (`prefers-color-scheme`) pri prvom otvaranju.
- **Ručni prekidač:** korisnik može eksplicitno da izabere tamni/svetli mod, nezavisno od sistemskog podešavanja — izbor se pamti (lokalno po uređaju/browseru je dovoljno za v1; sinhronizacija izbora preko više uređaja po nalogu nije pretpostavljena bez stvarne potrebe, vidi poglavlje 8).
- Prekidač živi u istom minimalnom duhu kao ostatak UI-ja (poglavlje 5) — ne traži poseban ekran podešavanja, dovoljna je jedna ikonica/stavka u komandnoj paleti (poglavlje 4) ili uglu gornje trake.

**Birač teme — VS Code mehanizam, Terminal sadržaj** (vlasnikova odluka 17.8.2026). Isti UX obrazac kao VS Code "Color Theme" birač — otvara se iz komandne palete ili gornje trake, lista opcija sa živim pregledom pri prelasku mišem/tastaturom, potvrda menja temu odmah bez ponovnog učitavanja. **Sadržaj liste NIJE proizvoljan skup tema** (za razliku od VS Code Dark+/Light+/Monokai/itd.) — svaki kanal i dalje ima tačno svoju jednu tamnu i jednu svetlu varijantu (Horizont za M17/M7, Zalazak za M8), obe već provereno WCAG AA (poglavlje 2a). Birač daje poznat, brz način da se između te dve pređe — ne otvara vrata dodatnim, neproverenim paletama. Ako se u budućnosti pokaže stvarna potreba za više od dve varijante po kanalu, to je nova odluka (i nova AA provera za svaku), ne automatska posledica ovog mehanizma.

---

## 2a. Kontrast — obavezno pravilo, ne preporuka

*(dodato avgust 2026, na izričit zahtev vlasnika — "vrlo važno da se ne nerviram kasnije")*

Ovo nije estetska preporuka nego **tvrd, merljiv zahtev**, isti duh kao "Izlazni kriterijum" u Nivo 2 specifikacijama — ne prolazi dok se ne proveri, ne "izgleda dobro na oko".

- **Standard: WCAG 2.1 nivo AA, kao apsolutni minimum** — najmanje **4.5:1** kontrast za običan tekst, **3:1** za veliki tekst/ikonice/granice UI elemenata. AA je granica ispod koje ništa ne sme proći, ne cilj sam po sebi.
- **Ponovo potvrđeno 17.8.2026, na izričit zahtev vlasnika: čitljivost teksta u oba moda je prioritet, ne granični uslov.** Za sav telo-tekst i oznake (ne samo "gde je lako") cilja se **AAA (7:1)** kao stvarni cilj pri biranju/podešavanju HEX vrednosti (poglavlje 2) — 4.5:1 se tretira kao pod koji se ne sme pasti, ne kao vrednost ka kojoj se teži. Ako neka kombinacija teksta/pozadine mora da bira između "malo tamnija akcentna boja" i "manji kontrast", bira se čitljivost.
- **Proverava se lokalno, protiv stvarne pozadine iza teksta u tom trenutku — ne protiv jedne pretpostavljene "opšte" pozadine aplikacije.** Aplikacija ima više nijansi pozadine i unutar istog moda (glavni panel, bočna traka, kartice iz poglavlja 6, hover stanje, otvorena komandna paleta) — svaka od njih je **posebna provera**, jer isti tekst koji je čitljiv na tamnijoj pozadini može biti nečitljiv na svetlijoj kartici iznad nje, i obrnuto.
- **Važi identično za tamni i svetli mod** — nijedan mod se ne tretira kao "manje bitan"; oba prolaze isti test pre nego što se smatraju gotovim.
- **Isto pravilo važi za linije/ikonice** (Codicons, poglavlje 3a) koliko i za tekst — ikonica koja se jedva vidi na svojoj pozadini je isti problem kao nečitljiv tekst.
- **Tekst na `accent-soft` pozadini mora biti `accent-strong`, nikad `accent`** — nalaz iz live-provere (17.8.2026, M17 §3.1): `accent` na `accent-soft` daje samo **3.96:1** u svetlom modu i pada AA prag, dok `accent-strong` daje 5.98:1 (svetli) / 8.86:1 (tamni). Pravilo važi i za **hover stanje**: dugme sa `text-accent hover:bg-accent-soft` prolazi u mirovanju, a pada čim se pređe mišem — zato je `accent-strong` podrazumevana boja za svaki element koji `accent-soft` može dobiti kao pozadinu, u bilo kom stanju. Sprovedeno kroz ceo panel (17 mesta, 17.8.2026).
- **Postaje stavka izlaznog kriterijuma kad UI kod počne** (ne samo namera u ovom dokumentu) — svaka nova kombinacija teksta/ikonice i pozadine koja se doda mora proći ovu proveru pre nego što se smatra završenom, isto pravilo kao "Izlazni kriterijum = definicija gotovo" iz CLAUDE.md.

---

## 3. Tipografija

Čist, geometrijski sans-serif font (npr. Inter ili sistemski font stek — `-apple-system, Segoe UI, ...`) za sav UI tekst — čitljivost i brzina skeniranja ekrana su prioritet nad ukrasom. Monospace font rezervisan isključivo za tehnički/strukturiran sadržaj (ID-jevi, kod, JSON prikazi u audit logu) — ne za opšti UI tekst, za razliku od utiska koji VS Code inspiracija može da sugeriše.

---

## 3a. Ikonografija

*(dodato avgust 2026, na zahtev vlasnika — rešava ranije otvoreno pitanje "ikonski set", poglavlje 8)*

**Codicons** — zvanična, open-source ikonska biblioteka VS Code-a (MIT licenca, `@vscode/codicons`). Izbor nije slučajan imitator VS Code stila — to je doslovno isti izvor, pa je vizuelni jezik dosledan sa referencom koju vlasnik navodi, ne približna kopija. Tanke linije, jednobojne (prate trenutnu boju teksta, ne nose sopstvenu paletu), minimalističke — bez punih, "flat design" ilustrativnih ikonica.

### 3a.1 Konkretna ikonica po grupi i po sekciji (dopuna, 18.8.2026, na zahtev vlasnika)

Pravilo iznad kaže *koji set* — ovo poglavlje kaže *koja ikonica za svaku stavku*, birana po **logičnom obliku onoga što se njome otvara** (ne proizvoljno/redom iz seta). Sve ikonice su iz `@vscode/codicons`, referencirane po njihovom zvaničnom imenu — direktno upotrebljivo u kodu (`<i class="codicon codicon-<ime>">` ili React ekvivalent) bez dodatnog prevođenja naziva.

**Gornja traka — 9 grupa** (spisak i sekcije unutar svake: M17 spec poglavlje 4a):

| Grupa | Ikonica (Codicon) | Zašto |
| :---- | :---- | :---- |
| Početna | `home` | Doslovno početna tačka |
| Prodaja | `search` | Jezgro grupe je pretraga (Pretraga i rezervacije + Kalendar) |
| Katalog i nabavka | `package` | Proizvod kao fizička/prodajna jedinica |
| Klijenti i partneri | `organization` | Spoljni subjekti (osobe i firme), za razliku od `account` koje nosi interni nalog |
| Finansije i pravno | `law` | Grupa spaja fakture, garanciju i ugovore — svi po formalnom/pravnom osnovu |
| Komunikacija i podrška | `comment-discussion` | Razgovor je zajednički imenilac (podrška, tim, gost, email) |
| Sadržaj i znanje | `book` | Objavljen/uređen materijal (marketing i baza znanja) |
| Analitika i nadzor | `graph-line` | Brojevi/trendovi kroz vreme |
| Administracija | `settings-gear` | Isti obrazac kao VS Code zupčanik za podešavanja — namerno na suprotnom kraju trake |

**Leva traka — 19 sekcija** (spisak: M17 spec poglavlje 4, plus Audit log koji je deo Administracije §4a):

| Sekcija | Ikonica (Codicon) | Zašto |
| :---- | :---- | :---- |
| Korisnici i uloge | `account` | Interni nalog/identitet (M1) |
| Audit log | `history` | Trag radnji kroz vreme |
| Katalog proizvoda | `package` | Isto obrazloženje kao grupa |
| Dobavljači i ugovori | `briefcase` | Poslovni odnos sa spoljnim subjektom |
| Pretraga i rezervacije | `search` | Vođena pretraga je glavna radnja sekcije |
| Kalendar rezervacija | `calendar` | Doslovan prikaz po datumu |
| Finansije (fakture, plaćanja) | `credit-card` | Novčana transakcija |
| Compliance (garancija putovanja) | `shield` | Zaštita/pokriće — bukvalno značenje garancije |
| Ugovori sa klijentima | `file-text` | Konkretan potpisan dokument, za razliku od `law` (grupa, apstraktnije) |
| Gosti i nalogodavci (CRM) | `organization` | Isto obrazloženje kao grupa — spoljni subjekt |
| B2B partneri | `plug` | Spoljni sistem/subagent koji se "priključuje" na Terminal (M7) |
| Izveštaji | `graph-line` | Isto obrazloženje kao grupa |
| Podrška | `question` | Otvoreno pitanje koje čeka odgovor |
| Marketing sadržaj | `megaphone` | Objava namenjena spoljnoj publici |
| Operativni nadzor | `pulse` | Živ, kontinuiran signal sistema (M18) |
| Razgovori (tim/dobavljači) | `comment-discussion` | Isto obrazloženje kao grupa |
| Centar za pomoć | `mortar-board` | Učenje/uputstvo, razlikuje se od `question` (Podrška = otvoren slučaj, ovo = već napisan odgovor) |
| Email/Inbox | `mail` | Namerno **ne** `inbox` — ta ikonica je već rezervisana za stalno vidljivu M15 Agent Inbox stavku (poglavlje 5c), da se dva različita pojma ne mešaju vizuelno |
| Znanje (destinacije/proizvodi) | `compass` | Orijentacija po destinaciji — jedina ikonica u setu sa direktnom "putničkom" asocijacijom, namerno suzdržano korišćena (poglavlje 4b, boja/ukras se ne preteruje ni kroz izbor oblika) |

**Devet ikona pretrage proizvoda** (Smeštaj/Letovi/Transferi/...) već imaju svoju tabelu u poglavlju 5b i ne dupliraju se ovde.

**Pravilo za svaku buduću sekciju** (M17 poglavlje 4 raste sa fazama): nova sekcija dobija ikonicu po istom principu — konkretan Codicon čiji oblik asocira na *ono što sekcija otvara*, ne sledeći slobodnu/generičku ikonicu samo zato što je "preostala" u setu. Ako Codicons set nema dovoljno specifičnu ikonicu za nešto novo (npr. vrlo specifičan tip dokumenta), bira se najbliža po značenju uz kratko obrazloženje u ovoj tabeli — ne izmišlja se nova ikonica van seta (poglavlje 3a).

---

## 4. Glavni obrazac interakcije — komandna paleta (`Ctrl+K` / `Cmd+K`)

Ovo **nije nova ideja** — ovo je vizuelna/interakciona realizacija onoga što M17 spec već zove *omnisearch* (poglavlje 5.5) i M15 poglavlje 6.5 već definiše kao deljen mehanizam. Ovaj dokument ne menja to ponašanje, samo mu daje konkretan oblik:

- **Skriveno dok se ne pozove** — ne stalno vidljivo polje u zaglavlju, nego overlay koji iskače na `Ctrl+K`/`Cmd+K` i nestaje čim nije potreban (Escape, klik van, ili izvršena akcija).
- **Prazan upit** → navigacija filtrirana na ulogu trenutnog korisnika (već propisano M17 §5.5), **i lista nedavno otvorenih zapisa/tabova** iznad nje (dopuna, 18.8.2026, na zahtev vlasnika — isti obrazac kao Linear/Spotlight) — brz povratak na ono na čemu se upravo radilo, bez ponovnog kucanja.
- **Upit sa tekstom** → poziva `POST /ai-orchestration/omnisearch` (M15 poglavlje 9), vraća rezultate/AI odgovor koji nikad ne prekoračuju prava trenutnog korisnika.
- **Nikad ne izvršava radnju sam** (M15 poglavlje 6.5.4) — rezultat je uvek link/navigacija ka postojećem ekranu ili zapisu, ne akcija koja se izvrši u pozadini.

Ovo je i doslovno ono što vlasnik opisuje kao "skrivene naredbe za pokretanje modula" — komandna paleta postaje glavni, brzi put kroz aplikaciju, ne samo pretraga.

---

## 4a. Tastaturne prečice — svaki čest postupak, ne samo komandna paleta

*(dodato 18.8.2026, na zahtev vlasnika — referenca: Linear)*

Komandna paleta je glavni ulaz (poglavlje 4), ali nije jedina prečica — svaki čest postupak unutar ekrana koji je trenutno u fokusu (potvrdi, otkaži, sledeća/prethodna stavka, otvori u novom tabu, zatvori tab) dobija i sopstvenu jednoslovnu/kombinovanu prečicu, isti princip kao Linear (`C` = novi zapis, `E` = dodeli, itd. — tačan raspored slova po ekranu dorađuje se pri izradi, ne ovde).

- **Prečica `?`** (van bilo kog polja za unos) otvara overlay sa punim spiskom prečica dostupnih na trenutnom ekranu — grupisano (Globalno / Ovaj ekran), isti obrazac kao Linear-ov cheat-sheet. Nestaje na `Escape` ili klik van, isti duh kao komandna paleta.
- Prečice se **uče kroz upotrebu, ne memorisanjem unapred** — svaka stavka u komandnoj paleti već pokazuje svoju prečicu pored naziva (ako postoji), tako da se prečica primeti prirodno pre nego što se potraži u `?` spisku.
- Nikad ne krši ulogu/dozvole korisnika — prečica je samo brži put do akcije koju bi korisnik i inače video kao dugme/opciju, ne novo ovlašćenje.

## 4b. Brzina i suzdržanost boje kao dosledna pravila (dopuna, 18.8.2026, na zahtev vlasnika)

*(referenca: Linear — "100ms interaction target", "near-monochrome, color only for status")*

- **Merljiv brzinski cilj, ne samo osećaj** — svaka interakcija u fokusu (otvaranje kartice, promena taba, pojavljivanje komandne palete, poglavlje 6 "suptilne i brze" animacije) cilja **ispod 100ms** percipiranog odziva. Ovo je dopuna, ne izmena postojećeg poglavlja 6 — isti princip ("brzina i nisko kognitivno opterećenje imaju prioritet nad vizuelnim efektom"), sad sa konkretnim brojem umesto samo "brzo".
- **Boja se koristi isključivo namerno, nikad dekorativno** — van akcentne boje rezervisane za AI (poglavlje 6a) i standardnih semantičkih boja (uspeh/upozorenje/greška/status), interfejs ostaje gotovo monohromatski (neutralna paleta, poglavlje 2). Ovo formalizuje već postojeći duh dokumenta (akcent rezervisan za AI, poglavlje 6a) kao opšte pravilo za ceo interfejs, ne samo za tu jednu oznaku — sprečava da buduće ekrane svaki dodaju sopstvenu, proizvoljnu paletu za isticanje.

---

## 5. Raspored ekrana (layout)

- **Gornja traka nosi grupe modula, kao ikonice** (izmenjeno 17.8.2026, na zahtev vlasnika — VS Code zvanično podržava ovu poziciju, `workbench.activityBar.location: "top"`, provereno u instaliranom VS Code-u pre odluke) — grupisano po funkciji (poglavlje 5c), ne pun spisak svih ~20 back-office sekcija odjednom. Administracija (korisnici/uloge, audit log) namerno na suprotnom kraju trake, isti princip kao VS Code zupčanik za podešavanja, odvojen od radnih grupa.
- **Leva traka nosi sadržaj izabrane grupe** — spisak sekcija te grupe, zatim stablo-struktura kad se jedna sekcija izabere (poglavlje 5c). Sekcije koje još nisu implementirane prikazuju se zaključane sa oznakom faze (M17 spec, poglavlje 7).
- **Stablo-struktura unutar leve trake** — hijerarhijski odnosi (npr. sekcija → njeni zapisi/filteri) prikazani istim vizuelnim jezikom kao VS Code Explorer/Source Control prikaz: tanke vertikalne linije koje povezuju ugnježđene stavke, strelice/ševroni (`chevron-right`/`chevron-down` iz Codicons) za sklapanje/rasklapanje grana, ne pune ilustracije ili boje po nivou.
- **Sadržaj u fokusu** — veći deo ekrana ostaje prazan/posvećen sadržaju, ne navigaciji. "Teško" i dalje ide kroz komandnu paletu (poglavlje 4), gornja/leva traka ostaju ikonice/kratki nazivi, ne gomila vidljivih dugmića.

---

## 5a. Tabovi — više otvorenih ekrana istovremeno

*(dodato avgust 2026, na zahtev vlasnika)*

Traka tabova iznad centralnog panela (ispod gornje trake, poglavlje 5) — isti obrazac kao VS Code/browser tabovi, **unutar same Terminal aplikacije** (ovo nisu tabovi browsera, nego tabovi unutar jedne stranice). Svaki tab je jedan otvoren zapis/ekran — npr. "Rezervacija #482", "Petrović — profil", "Finansijski izveštaj — avgust" — otvoren nezavisno, bez da se izgubi mesto na kom se stalo u prethodnom.

- **Otvaranje:** klik na rezultat komandne palete (poglavlje 4) otvara novi tab; navigacija unutar već otvorenog tab-a (npr. klik na gosta iz prikaza rezervacije) menja sadržaj **tog istog** taba, ne otvara novi automatski — novi tab je namerna radnja, ne posledica svakog klika.
- **Tab pretrage — izmena unutar tekućih rezultata ostaje u istom tabu; nova pretraga ide na `+`** (dopuna, 18.8.2026, ispravka na zahtev vlasnika istog dana). Dok je tab pretrage otvoren sa dobijenim rezultatima, svaka izmena **u okviru tog toka** (filteri, sortiranje, izmena parametara koraka vođene pretrage, sledeća stranica rezultata) osvežava sadržaj **tog istog** taba — ne otvara novi, isti princip kao opšte pravilo iznad za drill-down. **Novi tab za pretragu se otvara isključivo eksplicitnom radnjom** — dugme `+` pored već aktivnog taba (isti obrazac kao nov tab u browseru/VS Code-u), ili klik na jednu od 9 ikonica pretrage u levom navigatoru (poglavlje 5b) kad korisnik namerno želi paralelnu, nezavisnu pretragu. Predlog unakrsne prodaje (poglavlje 6d, M5 poglavlje 3.0e.1) takođe otvara nov tab preko `+`, pošto je to po definiciji druga, dopunska pretraga, ne izmena tekuće. Razlog: agent često drži otvorene dve-tri pretrage jednu pored druge da uporedi ponude za istog gosta (isto poređenje-tabova ponašanje kao poglavlje 5b za desne panele) — ali obično menja i precizira JEDNU pretragu više puta pre nego što je zadovoljan rezultatima, i to ne sme svaki put da otvori nov tab. Naziv taba prati sadržaj pretrage (npr. "Smeštaj — Budva, 12-19.8", ne generičko "Pretraga").
- **Zatvaranje/preuređenje:** dugme za zatvaranje na svakom tabu, prevlačenje (drag) za promenu redosleda, tastaturna prečica za ciklično prebacivanje (isti duh kao `Ctrl+Tab` u VS Code-u).
- **"+" dugme — pojednostavljeno na PRAZAN tab, ne direktno na pretragu** (dopuna, 23.8.2026, na zahtev vlasnika: "Treba da se otvori prazan tab a mi cemo tu dalje da odlucimo sta cemo da radimo"). Poglavlje iznad (v1.18, 18.8.2026) je predviđalo da `+` otvara direktno novu pretragu — u implementaciji (M17 spec v1.94) `+` sad otvara generičan, prazan ekran (bez sopstvenog sadržaja/logike) — svaki klik pravi zaseban zapis u traci, čak i kad više njih "vodi" na istu putanju (nova, opštija sposobnost tabova — videti tačku ispod). Šta konkretno "prazan tab" prikazuje ili nudi (npr. izbor tipa pretrage, brzi meni) ostaje otvoreno, vlasnikova svesna odluka da se ne rešava sada.
- **Više tabova iste putanje — opšta sposobnost** (dopuna, 23.8.2026, na zahtev vlasnika: "omogucite otvaranje vise tabova za isti modul na primer pretrage"). Traka tabova sad razlikuje zapise po internom identitetu, ne isključivo po putanji ekrana — dva ili više tabova mogu istovremeno pokazivati isti ekran (npr. dve odvojene pretrage), svaki sa sopstvenim mestom u traci i mogućnošću nezavisnog zatvaranja. Ovo je sad opšta, dostupna sposobnost (koristi je `+` dugme) — pojedinačni ekrani (npr. sopstveno "Nova pretraga" dugme unutar ekrana pretrage, umesto isključivo `+` u traci) mogu je zatražiti kad im zatreba, ostaje otvoreno po ekranu (poglavlje 8, otvorena pitanja).
- **Indikator nesačuvane izmene** — tab sa formom koja ima neposlate izmene dobija malu tačku/oznaku, da se ne izgubi rad slučajnim zatvaranjem.
- **Otvoreni tabovi se pamte preko osvežavanja stranice** (lokalno, po sesiji) — slučajan refresh ili pad konekcije ne sme obrisati sve što je tim imao otvoreno, pogotovo pod pritiskom kad se radi sa gostom na telefonu.
- Svaki tab i dalje nosi sopstvene "mrvice" (breadcrumbs) ako je sadržaj ugnježđen — tabovi i breadcrumbs rešavaju različit problem (paralelan rad naspram dubine unutar jednog konteksta), ne zamenjuju jedno drugo.

---

## 5b. Tri-panelni raspored — navigator / prikaz / izdvajanje

*(dodato avgust 2026, na zahtev vlasnika — referenca: VS Code Explorer + editor + peek/split)*

Ceo radni prostor (ispod gornje trake, poglavlje 5; iznad/pored tabova, poglavlje 5a) deli se na tri funkcionalno odvojene zone, isti princip za M17 i M7 (poglavlje 7):

- **Levi panel — navigator, dva nivoa.** Gornji nivo je spisak **svih back-office modula** (isti spisak koji već postoji u `apps/panel/src/lib/nav.ts` — Katalog, Dobavljači i ugovori, Pretraga i rezervacije, Finansije, CRM, B2B, Izveštaji, Podrška, Marketing, Nadzor, Razgovori, Centar za pomoć, Email, Znanje, itd.). Klik na modul ga proširuje u stablo-strukturu (poglavlje 5) — isti vizuelni jezik kao VS Code Explorer/Source Control: tanke vertikalne linije, ševroni za sklapanje/rasklapanje. Sadržaj tog stabla je specifičan za modul (npr. "Pretraga i rezervacije" proširen pokazuje 9 ikona po vrsti proizvoda, ispod). Ovo je jedino mesto za pregledanje/pretragu; klik na stavku puni centralni panel, ne otvara novi prozor. **Sačuvani prikazi** (dopuna, 18.8.2026, na zahtev vlasnika — isti obrazac kao Salesforce/HubSpot/Attio) — na bilo kojoj listi (poglavlje 6d, ili lista bilo kog drugog modula) korisnik može da sačuva trenutnu kombinaciju filtera pod imenom (npr. "Rezervacije koje čekaju fiskalni dokument") — sačuvan prikaz se pojavljuje kao dodatna stavka u stablu te sekcije, lično po korisniku, ne deljeno (deljenje sa timom je moguće prošireno izdanje, ne ovde).
- **Centralni panel — prikaz, uvek "radna površina" trenutno izabrane stavke.** Ako je iz levog navigatora izabrana lista (npr. "Rezervacije", "Profakture"), centar prikazuje **tu listu** — kartice/redovi/tabela, isti obrazac kao poglavlje 6d. Ako se iz liste (ili taba, poglavlje 5a) uđe u pojedinačan zapis, centar prikazuje **pun** taj zapis. Centar ostaje najveći deo ekrana (poglavlje 5, "sadržaj u fokusu").
- **Desni panel — izdvajanje, uvek skraćena/izvedena verzija, nikad zamena za centar.** Kad je centar lista i korisnik klikne na jedan red **bez** da uđe u pun zapis, desni panel prikazuje **sažetak ključnih polja** tog reda (dopuna, 18.8.2026, na zahtev vlasnika — npr. broj rezervacije/profakture, gost, datum, status, iznos) — lista u centru ostaje otvorena, nepromenjena. Kad centar prikazuje pun zapis, desni panel nosi kontekst *izveden* iz njega — AI razgovor vezan za taj zapis, istorija izmena, ili **"Povezano" traka**: dosledan blok koji pokazuje trenutno povezane zapise drugih modula (npr. gost → njegove rezervacije, fakture, otvoreni tiketi) — isti obrazac kao Attio/HubSpot, formalizovan ovde da ne ostane ad-hoc po ekranu. Prelazak sa sažetka u desnom panelu na **pun** prikaz zapisa (dupli klik/dugme "Otvori") uvek otvara **nov tab** (poglavlje 5a — "namerna radnja"), ne zamenjuje listu koja je već otvorena. Desni panel nikad ne pokreće nezavisnu navigaciju sam — uvek zavisi od onoga što je otvoreno u centru. **Može se otvoriti drugi desni panel pored prvog** (isti obrazac kao VS Code split editor grupe — prevlačenje ili prečica otvara novu kolonu) — dva desna panela jedan pored drugog, ne jedan preko drugog.

Sve tri zone su sklopive/proširive nezavisno (VS Code obrazac) — zatvaranje levog panela kad tim samo čita jedan zapis, otvaranje drugog desnog panela kad treba paralelno pratiti dva izvedena prikaza.

**Ručno menjanje širine panela** (dopuna, 18.8.2026, na zahtev vlasnika) — isti obrazac kao VS Code: tanka granica između svake dve susedne zone (levi/centralni, centralni/desni, desni/desni kad su dva otvorena) je prevlačiva (drag) da promeni širinu jedne zone na račun susedne, sa razumnim minimumom (zona ne može da se skupi ispod čitljive širine — npr. levi navigator ostaje bar dovoljno širok za ikonice i skraćen naziv) i bez gornje granice osim same širine ekrana. Izabrana širina se **pamti po korisniku, preko osvežavanja i narednih sesija** (isti princip trajnosti kao otvoreni tabovi, poglavlje 5a) — tim koji stalno radi sa širokim desnim panelom (npr. dug AI razgovor) ne podešava širinu iznova svaki put. Dvoklik na granicu vraća zonu na podrazumevanu širinu (isti prečac kao VS Code). Važi identično za M17 i M7 (poglavlje 7).

**Pretraga proizvoda — stablo-grana unutar modula "Pretraga i rezervacije"** (dopuna 17.8.2026, na zahtev vlasnika; pojašnjeno istog dana da izbegne zabunu — devet ikona ispod NIJE zamena za spisak back-office modula, nego njegov podskup, tačno onako kako VS Code Explorer proširuje jedan otvoren folder, ne zamenjuje spisak projekata): kad se taj modul otvori/proširi u levom navigatoru, njegovo stablo nosi jednu ikonicu (Codicons, poglavlje 3a) po vrsti turističkog proizvoda — izbor otvara odgovarajuću vođenu pretragu u centralnom panelu. Konkretan tok polja/koraka/filtera za svaku definisan je u M5 spec poglavljima 3.0c/3.0d, ne ovde (ovaj dokument ostaje raspored/interakcija, M5 ostaje podaci/tok). Konačna lista ikona (potvrđeno 17.8.2026), sa napomenom gde ikonica ne odgovara 1:1 jednom `Product.type`:

| Ikonica | `Product.type` iza nje |
| :---- | :---- |
| Smeštaj | `ACCOMMODATION` |
| Letovi | `FLIGHT` |
| Transferi | `TRANSFER` |
| Rent-a-car | `TRANSPORT` (`transport_mode=RENT_A_CAR`) — sopstvena ikonica iako deli `Product.type` sa ostatkom prevoza (bus/voz/brod), jer su polja pretrage potpuno drugačija |
| Things to do | `EXCURSION` + `EVENT` + `TICKET` spojeno u jedan ekran (M5 poglavlje 3.0d.4) — tri tipa u pozadini, jedna ikonica |
| Individualni paketi | nije `Product.type` — otvara `Itinerary` tok (M5 poglavlje 3.0d.5), sastavljanje više pretraga u jedno putovanje. Dok je aktivan, preostalih 8 ikona postaju dugmad za dodavanje/uključivanje-isključivanje segmenta tog tipa (dopuna, 18.8.2026, na zahtev vlasnika); desni panel prikazuje cenu po segmentu, tekući (okvirni) zbir i eventualna upozorenja o hronologiji (M5 poglavlje 3.0.7), isti obrazac kao poređenje selekcije van itinerara (M5 poglavlje 3.0e.3). Traka iznad centralnog panela nosi i "Podeli"/"Kloniraj"/"Izvezi PDF" (dopuna, 18.8.2026 — M5 poglavlja 3.0.5/3.0.6/3.0.8) — podaci/tok: M5 poglavlje 3.0.4 |
| Grupni paketi | `PACKAGE` |
| Krstarenja | `CRUISE` (nov tip, M2 poglavlje 2.1/2.3, dodat 17.8.2026) |
| Putno osiguranje | `INSURANCE` |

**"Ručna stavka" — proizvod van kataloga** (dopuna, 18.8.2026, na zahtev vlasnika; podaci/tok: M5 spec poglavlje 3.0f) — svaka od devet ikona iznad dobija dodatnu, sitniju radnju uz sebe (ikonica `edit`, isti obrazac kao "izmeni" bilo gde drugde u interfejsu) koja umesto vođene pretrage otvara direktan unos: zemlja/destinacija i dalje se biraju iz iste M2 baze, ali sam proizvod (naziv/opis/cena) se unosi ručno — za hotel, lepljenje linka sajta hotela nudi AI predlog teksta i slika (M15 poglavlje 6.5.6c) koji agent pregleda pre čuvanja. Rezultat je `QuoteItem`/`BookingItem` sa `source_type = MANUAL`, ne `SearchResultOffer` — ne prolazi kroz `GET /search`.

**Dugme "Pošalji ponudu"** (dopuna, 19.8.2026, na zahtev vlasnika; podaci/tok: M5 spec poglavlje 3.1a) — na ekranu Ponude, pored postojećih radnji, otvara meni sa tri stavke (WhatsApp/Viber/Telegram — isti `+`-meni vizuelni obrazac kao AI chat prilaganje konteksta, poglavlje 6c.1). Svaka stavka sastavlja gotov tekst (sažetak ponude + deljiv link) i otvara odgovarajuću spoljnu aplikaciju — agent samo bira platformu i (za WhatsApp, ako je poznat) kontakt, ne kuca ništa ručno. Jednosmerno, bez ikakvog novog naloga/bota — isti princip kao dugmad "Podeli" već upisana za nacrt putovanja (poglavlje 5b, M5 §3.0.5).

---

## 5c. Gornja traka — grupe modula; leva traka — spisak pa skupljanje na izabranu stavku

*(dodato 17.8.2026, na zahtev vlasnika)*

Back-office ima ~20 sekcija (M17 spec poglavlje 4) — previše za jednu vertikalnu ili horizontalnu traku ikonica bez grupisanja. Rešenje u dva koraka:

1. **Gornja traka** nosi ~9 ikona, grupisanih po poslovnoj funkciji (tačan spisak grupa: M17 spec poglavlje 4a) — npr. "Prodaja" (Pretraga i rezervacije + Kalendar), "Finansije i pravno" (Finansije + Compliance + Ugovori sa klijentima), itd. Klik na grupu otvara njen spisak sekcija u levoj traci.
2. **Leva traka** prvo prikazuje spisak sekcija te grupe (obično 2-4 stavke). Klik na jednu sekciju **skuplja prikaz na samo tu sekciju** — ostale sekcije iz grupe se sklanjaju, ispod naziva izabrane sekcije pojavljuju se njena polja za pretragu/filtriranje (M17 spec poglavlje 4a, tačan spisak polja po sekciji) kao stablo-struktura. Mala strelica/breadcrumb na vrhu vraća na spisak sekcija te grupe (isti princip kao VS Code kad se izađe iz rezultata pretrage nazad na prazno stanje) — ne gubi se mesto grupe, samo se poništava izbor sekcije.

Ovaj obrazac važi identično za M17 i M7 (poglavlje 7) — grupisanje/spisak M7 portala ima sopstveni, uži skup sekcija (subagent ne vidi sve back-office module), ali mehanizam (grupa → spisak → skupljanje na izabranu stavku) je isti.

**Ikonica "Inbox" sa brojem, stalno vidljiva na kraju gornje trake** (dopuna, 18.8.2026, na zahtev vlasnika — isti obrazac kao Linear) — M15 već agregira sve što čeka ljudsko odobrenje u jedan prikaz ("Agent Inbox", M15 spec poglavlje 6); ova dopuna je čisto UI odluka da taj prikaz bude **dostupan jednim klikom sa svakog ekrana**, sa brojem stavki koje čekaju, umesto da se do njega stiže kroz meni. Klik otvara Agent Inbox u novom tabu (isto pravilo kao svaka druga namerna radnja, poglavlje 5a). Ista ikonica u M7 portalu (poglavlje 7) — filtrirana na ono što čeka odluku tog subagenta (npr. Gejt B iz M7 spec poglavlja 2.0.4c).

---

## 5d. Donja traka i lična podešavanja (dopuna, 18.8.2026, na zahtev vlasnika — referenca: VS Code status bar/nalog/split)

**Donja traka** (nova zona, ispod centralnog panela, preko cele širine):
- **Nalog koji je prijavljen** — ime + uloga (npr. "Marko Petrović · Prodajni agent"), klik otvara profil.
- **Status veze** — API dostupan/nedostupan, WebSocket (M19 chat) povezan/prekinut — stvaran, koristan signal, ne dekorativan, jer panel zavisi od žive veze ka backend-u.
- **AI status po trenutnom modulu** — da li je domenski agent za taj ekran `ACTIVATED` (M15 `ModuleAgentActivation`, poglavlje 3 tog spec-a) — kratka oznaka "AI: uključen"/"AI: isključen za ovaj modul", relevantno jer se agenti pale po modulu, ne globalno.
- **Sat sa vremenskom zonom** — korisno za tim koji radi sa gostima/dobavljačima u različitim zonama i za rokove (M3 alotman, M11 garancija).
- **Oznaka okruženja** (test/produkcija) — sprečava zabunu ako se ikad pusti staging okruženje uz produkciju.
- **Klaster ikonica-pokretača** (dopuna, 19.8.2026, na zahtev vlasnika) — pet ikonica, krajnje levo ili desno u traci (ekranska odluka pri izradi): **Mejl** (M22, otvara tu sekciju unutar panela — nov tab, isto pravilo kao svaki drugi namerni klik, poglavlje 5a), **Interni chat** (M19, isto — otvara sekciju unutar panela), **WhatsApp**, **Viber**, **Telegram** (spoljne aplikacije — klik otvara desktop aplikaciju ili web verziju u novom tabu browsera, **bez ikakve veze sa Terminal bazom podataka** — čist prečac, isti princip kao pokretač na operativnom sistemu, ne nov kanal). Poslednje tri postoje isključivo zbog toga što ih tim već svakodnevno koristi za goste/partnere/kolege (vlasnikova odluka, 19.8.2026) — razlikuju se od "Pošalji ponudu" (poglavlje 6d) po tome što ne nose nikakav unapred pripremljen tekst, samo otvaraju aplikaciju.

**Gornji desni deo gornje trake** (odvojeno od administratorske zupčanik-ikonice iz poglavlja 5c, koja ostaje za sistemska podešavanja vidljiva samo ovlašćenima):
- **Ikonica naloga** (inicijali/avatar) → meni: profil, lična podešavanja, odjava.
- **Lična podešavanja** (zupčanik, korisnički nivo) — ručan izbor teme preko automatske (poglavlje 2), veličina fonta, uključi/isključi zvuk AI odgovora (M17 spec poglavlje 5.5), uključi/isključi obaveštenja (poglavlje 5e ispod), oblik forme "Ponuda → Rezervacija" — jedna duga forma naspram stepper-a (dopuna, 18.8.2026, na zahtev vlasnika; podaci: M1 spec §3.9 `UserPreference`, tok: M5 spec §4.4). Svako ovakvo podešavanje se čuva kroz isti generički `UserPreference` mehanizam (M1 §3.9), ne kroz poseban model po podešavanju.
- **Zvono za obaveštenja** — **informativna istorija** (nova poruka u M19 chat-u, M18 upozorenje) — razlika od Inbox ikonice: Inbox čeka **moju odluku** (akcionabilno), zvono znači **obavešten sam**, ne moram ništa da uradim. Zvono čuva i ono što je zatvoreno iz iskačućih obaveštenja (poglavlje 5e).
- **Dugme za podelu ekrana** — eksplicitna kontrola za otvaranje drugog desnog panela pored prvog (mehanizam već postoji, poglavlje 5b, samo dobija sopstvenu vidljivu ikonicu ovde — isti duh kao VS Code split editor dugme).

Isto važi identično za M7 portal (poglavlje 7), filtrirano na obim tog subagenta.

## 5e. Iskačuća obaveštenja — kartice u donjem desnom uglu (dopuna, 18.8.2026, na zahtev vlasnika)

- **Pojavljuju se u donjem desnom uglu, nezavisno od trenutno otvorenog taba** — sistem obaveštava bez obzira šta se trenutno gleda (isto ponašanje kao obaveštenja operativnog sistema).
- **Ne nestaju same** — ostaju dok se ručno ne zatvore (`×` na kartici), namerna razlika od uobičajenih "toast" obaveštenja koja nestaju posle par sekundi — važno obaveštenje (npr. neuspelo plaćanje, kritično upozorenje) ne sme proći nezapaženo dok je korisnik odsutan od ekrana.
- **Gomila raste naviše** kako pristižu nova (najnovije na dnu, najbliže mestu pojavljivanja) — isti osnovni oblik kartice kao ostatak interfejsa (poglavlje 6: neznatno zaobljene ivice, ~10% šira nego visoka).
- **Boja isključivo po ozbiljnosti** (isti princip kao poglavlje 4b) — tanka traka u semantičkoj boji (info/upozorenje/greška) uz levu ivicu kartice, telo kartice ostaje neutralno.
- **Link ka konkretnom zapisu** — obaveštenje koje pominje broj rezervacije/računa/vaučera i sl. nosi klikabilan link koji otvara taj zapis u **novom tabu** (isto pravilo kao svaka druga namerna radnja, poglavlje 5a); klik na link **ne** zatvara karticu — korisnik možda prati više stvari odjednom, zatvaranje ostaje isključivo eksplicitan `×`.
- **"Zatvori sve"** — dugme na vrhu gomile čim ima više od par kartica, da se ne moraju zatvarati jedna po jedna.
- **Sažimanje posle praga** (npr. 5+ kartica) — starije se sažimaju u jednu zbirnu karticu "+N još obaveštenja" (proširiva klikom) — sprečava da gomila prekrije radni prostor.
- **Odnos prema zvonu** (poglavlje 5d) — zvono čuva istoriju svih obaveštenja, uključujući ona već zatvorena ovde; zatvaranje toast kartice uklanja samo iskačući prikaz, ne briše zapis iz istorije.
- Isto pravilo animacije kao ostatak interfejsa (poglavlje 6) — pojavljivanje kratko i brzo, bez "lepršanja"; poštuje `prefers-reduced-motion`.
- **Izvor podataka** — isti Event Bus mehanizam koji već pokreće M18 signale/M19 poruke (Master dokument poglavlje 6), filtrirano na relevantnost trenutnog korisnika (ista logika kao Agent Inbox/dashboard agregacija, poglavlje 5) — nov UI prikaz nad postojećim događajima, ne nov backend mehanizam.

---

## 5f. Terminal panel (BI, isključivo Vlasnik) i "Customize Layout" dugme (dopuna, 23.8.2026, na zahtev vlasnika)

**"Customize Layout" dugme** — nova ikonica u gornjoj traci (pored postojećeg admin zupčanika, poglavlje 5c), isti duh kao VS Code istoimeno dugme: klik otvara mali padajući meni sa čekiranim/nečekiranim stavkama za **sve postojeće panele koji se mogu sakriti** — bočna traka (poglavlje 5c), desni panel (poglavlje 5b), donja statusna traka (poglavlje 5d), AI chat (poglavlje 6c), i **novi terminal panel** (ispod). Stanje svake stavke pamti se po korisniku kroz `UserPreference` (M1 §3.9, isti mehanizam kao poglavlje 5d "lična podešavanja") — panel se ne vraća u podrazumevano stanje pri svakoj prijavi.

**Terminal panel — pozicija i izgled.** VS Code pozicija (dno ekrana, ispod centralnog panela, preko cele širine kao statusna traka poglavlje 5d, ali iznad nje) — vizuelno stilizovan kao terminal: monospace font, `$` prompt ispred svakog pitanja (isti `$` znak koji već otvara naslove ekrana, poglavlje 6), tamna/svetla pozadina prateći temu (poglavlje 2), istorija pitanja/odgovora koja raste naviše (najnovije na dnu, isti obrazac kao poglavlje 5e), polje za unos na dnu samog panela. **Nije stvaran shell** (M15 spec poglavlje 6.9 — obrazloženje zašto) — svaki unos je pitanje na prirodnom jeziku ka `BiTerminalAgent`, ne komanda operativnog sistema; UI to ne krije (nema lažnog utiska da se izvršava proizvoljna komanda), samo pozajmljuje vizuelni jezik terminala jer je to vlasnikov mentalni model za ovu vrstu rada.

**Vidljivost** — panel i njegovo dugme u "Customize Layout" meniju postoje u DOM-u samo kad `GET /ai-orchestration/modules/M15_BI_TERMINAL/activation` vrati `ACTIVATED` **i** korisnik ima `M15/bi-terminal/VIEW` (isključivo VLASNIK, M15 spec §6.9.2) — isto tiho izostavljanje kao svaki drugi gate u ovom dokumentu (npr. Agent Inbox ikonica, poglavlje 5d), ne prikaz pa onemogućeno dugme. Za svaku drugu ulogu, terminal panel i njegova stavka u "Customize Layout" meniju jednostavno ne postoje.

**Podela na dva panela** (dopuna, 23.8.2026, na zahtev vlasnika: "omogucite podelu terminala u dva dela i da oba budu isto operativna da mogu dve razlicite stavri da radim u isto vreme") — isti obrazac kao VS Code "Split Terminal". Dugme u zaglavlju panela (pored dugmeta za zatvaranje) deli panel horizontalno na dva, tankom linijom razdvojena — svaki je POTPUNO nezavisan razgovor (sopstveno pitanje/odgovor/istorija), ne dva prikaza istog stanja. Visina panela ostaje zajednička za oba (deljenje je horizontalno, ne vertikalno — jedna ručka za prevlačenje visine i dalje na vrhu celog panela).

**"Obriši" red u terminalu** — vizuelno sakriva taj red SAMO za trenutnog korisnika (klijentsko stanje/`UserPreference`), stvaran zapis ostaje trajno u M1 audit logu (M15 spec §6.9.4) — dostupan preko `/audit-log` ekrana (poglavlje 6/7 M17 spec) filtriran na `module=M15, action=bi-terminal.query`. Ovo je namerno drugačije od poglavlja 5e ("×" na iskačućem obaveštenju takođe ne briše istoriju) — isti princip primenjen ovde, eksplicitno zbog vlasnikovog zahteva "nikad se ništa trajno ne briše".

**Kopiranje poruka i segmentacija po turi** (dopuna, 23.8.2026, na zahtev vlasnika — referenca poslata kao snimak ekrana Claude Code CLI-ja: tamna pozadina, monospace, jasno razdvojeni blokovi po turi, oznake tipa akcije). Svako pitanje i svaki odgovor dobija dugme za kopiranje (isti `CopyButton` obrazac kao poglavlje 6c AI chat — hover-reveal, kratka vizuelna potvrda). Svaka tura (pitanje+odgovor) vizuelno odvojena tankom linijom od prethodne (ne samo razmak) — čitljivija granica pri skrolovanju duže istorije. Kad je pozvan alat, iznad odgovora stoji diskretna oznaka (`⟶ naziv_alata`, prigušena boja) — ista "transparentnost, agent ne izmišlja podatke" filozofija kao svuda drugde u ovom dokumentu, sad vidljiva i ovde.

**Predlog za odlazak na internet — kartica odobrenja** (dopuna, 23.8.2026, na zahtev vlasnika, M15 spec §6.9.7). Kad agent predloži preuzimanje konkretnog URL-a, umesto običnog odgovora prikazuje se vizuelno IZDVOJENA kartica (`warn` okvir — ista boja/težina kao upozorenje, poglavlje 2 paleta) sa: predloženim URL-om, razlogom, i dva dugmeta — "Odobri"/"Odbij". Ovo NIJE dodatna sekcija ispod odgovora (kao linkovi/kartica izveštaja) — ZAMENJUJE prostor gde bi odgovor bio, jer odgovor još ne postoji dok se ne odluči. Posle klika, kartica se smanjuje na kratku potvrdu stanja ("Odobreno — sadržaj preuzet i proveren." / "Odbijeno — ništa nije preuzeto sa interneta."); ako je odobreno, stvaran odgovor (sa izvorom) se prikazuje ispod, isti oblik kao svaki drugi odgovor u terminalu.

---

## 6. Sadržaj centralnog panela — isticanje, kartice, pokret

*(dodato avgust 2026, na zahtev vlasnika)*

Centralni panel (glavni radni prostor, ne bočna traka) prati vizuelne konvencije VS Code editora, primenjene na poslovni sadržaj umesto na kod:

- **Bojenje pozadine teksta za isticanje** — isti princip kao highlight rezultata pretrage ili inline dijagnostika u VS Code editoru: deo teksta koji zahteva pažnju (npr. razlog odbijanja, promenjeno polje u pre/posle prikazu audit loga, upozorenje o roku) dobija blagu pozadinsku boju iza samog teksta, ne posebnu ikonicu/banner pored njega. Boja isticanja izvedena iz akcentne (poglavlje 2) ili iz standardnih semantičkih boja (upozorenje/greška/uspeh) — nikad proizvoljna paleta po ekranu.
- **Kartice za grupisan sadržaj** — blokovi informacija (npr. jedan `UserPermissionOverride` zapis, jedan red audit loga kad se proširi) prikazani kao odvojene kartice sa blago drugačijom pozadinom od okolnog prostora — isti utisak kao VS Code hover/peek prikaz, ne pune tabele sa linijama svuda. **Konkretan oblik (dopuna, 18.8.2026, na zahtev vlasnika, potvrđen na primeru kartica rezultata pretrage smeštaja, poglavlje 6d)** — ovo je osnovni, deljen oblik kartice za ceo interfejs, ne samo za rezultate pretrage: neznatno zaobljene ivice (mala vrednost, ne pill-oblik); proporcija **~10% šira nego što je visoka** (blago pejzažna, ne kvadratna ni izdužena); kartica u **izabranom/kliknutom** stanju dobija ivicu u akcentnoj boji (poglavlje 2) koja je odsutna u mirnom stanju — jedini vizuelni signal da je nešto od više kartica trenutno izabrano, bez menjanja pozadine cele kartice.
- **Animacije — suptilne i brze, nikad ukrasne same sebi.** Otvaranje/zatvaranje kartice, prelazak fokusa, pojavljivanje komandne palete (poglavlje 4) — kratki, brzi prelazi (isti utisak kao VS Code editor: momentalno, ne "leprša"). Brzina i nisko kognitivno opterećenje imaju prioritet nad vizuelnim efektom (isti princip kao poglavlje 1) — animacija potvrđuje da se nešto desilo, ne zabavlja korisnika.

---

## 6a. Obeležavanje autora radnje — čovek, AI agent, spoljni nalog

*(dodato avgust 2026, na zahtev vlasnika)*

Terminal je platforma u kojoj AI agent nije pomoćni alat nego **formalan nalog sa sopstvenim pravima** — M15 poglavlje 1 uvodi `User.account_type = AI_AGENT`, a svaka njegova akcija ulazi u isti `AuditLogEntry` sa `actor_type = AI_AGENT` (M1 poglavlje 3.8). Ta razlika mora biti vidljiva **i u interfejsu**, ne samo u bazi — inače tim ne može da proceni koliko da veruje onome što čita, a to je jedino na osnovu čega odlučuje da li da pregleda tekst pre slanja ili da ga prihvati kakav jeste.

Ovo poglavlje je **jedini izvor istine** za taj vizuelni jezik. Modulske specifikacije na njega pokazuju, ne prepisuju ga (M17 poglavlje 3.1, M19 poglavlje 2.3).

### 6a.1 Tri porekla, tri prikaza

| Poreklo | Oznaka | Vizuelno |
| :---- | :---- | :---- |
| Zaposleni (`STAFF`) | ime i prezime | bez dodatne oznake — podrazumevano stanje |
| AI agent (`AI_AGENT`) | ime agenta + bedž **"AI"** | `accent-soft` pozadina bedža, `accent` boja teksta — isti obrazac kao već postojeći "AI nacrt" bedž u M14 prikazu tiketa |
| Spoljni nalog (`SUPPLIER_CONTACT`, `SUBAGENT_ADMIN`/`SUBAGENT_*`, `GOST`) | ime + naziv firme ili uloge | neutralna oznaka, **bez** `accent` boje — akcentna boja je rezervisana za AI, da se ta jedna razlika ne izgubi u šarenilu |

### 6a.2 Pravila koja se ne krše

1. **Oznaka je uvek vidljiva bez prelaska mišem** — ne tooltip, ne detalj koji se otkriva klikom. Ko god gleda ekran, vidi poreklo istovremeno sa sadržajem.
2. **Kad je AI napisao tekst, a čovek ga poslao, prikazuju se oba** — "poslao: Marko Petrović · nacrt: AI agent". Nikad samo jedno. Odgovornost nosi čovek koji je pritisnuo "pošalji"; poreklo teksta je zasebna informacija i ne poništava se ljudskim slanjem.
3. **Nikad se ne prikazuje sirova tehnička vrednost** (`AI_AGENT`, `SUPPLIER_CONTACT`, `AI_DRAFT`) — uvek prevod na srpski. Ovo posebno važi za audit log, koji je do sad ispisivao enum vrednost direktno.
4. **Bedž "AI" se ne koristi za sadržaj koji je čovek napisao od nule**, čak ni kad je AI predložio temu, otvorio zapis ili pokrenuo tok. Bedž označava **autorstvo teksta/radnje**, ne učešće AI-ja negde u lancu — inače gubi značenje.
5. **Jedna komponenta, ne obrazac koji se prepisuje.** Kad UI kod dođe na red, ovo je jedna deljena komponenta koju svaki ekran uvozi — ne stil koji se ponavlja po ekranima. Razlog je isti kao za ceo repozitorijum: obrazac koji se prepisuje razilazi se, i posle deset ekrana više nije isti (vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md`).

### 6a.3 Gde važi

Na **svakom** ekranu bilo kog kanala koji prikazuje autora radnje ili poruke — postojećim i budućim. Trenutno pogođeni ekrani panela: M6 (log komunikacije), M12 (marketinški sadržaj), M14 (nit tiketa — jedini koji ovo već radi ispravno), M17 (audit log), M19 (chat), M21 (predlozi članaka), M22 (email nit), M23 (revizije članaka).

---

## 6b. Širina prikaza — sajt (M8) ide punom širinom, sa izuzetkom

*(vlasnikova odluka 17.8.2026)*

**Sajt zauzima celu širinu ekrana na kom se prikazuje.** Ranije je sadržaj bio ograničen na 1152px, pa je na širokom monitoru skoro pola ekrana ostajalo prazno. Zaglavlje, sadržaj i podnožje dele **isti bočni prostor** koji raste sa ekranom (`px-4` → `px-10`) — puna širina nije isto što i bez margine; tekst nikad ne dodiruje ivicu prozora.

Da puna širina ne bi samo naduvala kartice, liste proizvoda dobijaju **više kolona na širokim ekranima** (do 5) — poenta je pokazati više ponude, ne isto malo ponude krupnije.

**Izuzetak — stranice koje se čitaju, ne pregledaju:** pojedinačan hotel/putovanje (izričito izuzeto na vlasnikov zahtev), blog i opšte stranice, tok rezervacije, prijava/registracija, deljena stranica članka znanja. Razlog je čitljivost: red teksta preko celog širokog ekrana ima 200+ znakova i oko izgubi početak sledećeg reda. **Ograničenje stoji na samoj stranici, ne u zajedničkom rasporedu** — da izuzetak bude vidljiv tamo gde se traži, a ne skriven na mestu koje važi za sve.

Ovo pravilo se odnosi **samo na M8**; panel (M17) je uvek koristio punu širinu jer je radna površina, ne štampana strana.

---

## 6c. AI razgovor — plutajući kontekst iznad unosa

*(dodato avgust 2026, na zahtev vlasnika — referenca: Claude Code panel unutar VS Code)*

Svaki ekran koji vodi razgovor sa AI agentom (M19 chat sa AI nacrtom, M21/M23 AI asistent, M15 omnisearch/komandna paleta) prati isti obrazac unosa kao Claude Code panel:

- **Polje za unos je fiksirano pri dnu desnog panela** (poglavlje 5b) ili centralnog panela kad je razgovor glavni sadržaj ekrana (npr. M21/M23 "pitaj asistenta") — ne pluta slobodno u sredini sadržaja.
- **Kontekst/dozvole/nagoveštaji se pojavljuju kao plutajući blok neposredno IZNAD polja**, ne kao poseban banner na vrhu ekrana ili modal — npr. koji zapis/modul je trenutni kontekst razgovora, kad AI predlaže radnju koja čeka ljudsku potvrdu (poglavlje 6a — bedž "AI" i pravilo da čovek mora da potvrdi pre slanja/objave), kratak predlog sledećeg pitanja. Blok nestaje kad nije relevantan (isti princip "skriveno dok nije potrebno" kao komandna paleta, poglavlje 4).
- **Traka mogućih režima/dozvola tik uz polje za unos** kad je primenjivo (npr. da li AI predlog čeka odobrenje iznad određenog iznosa, M7 poglavlje 2.0.4) — vidljiva, ne skrivena u meniju.

Ovaj obrazac ne menja pravila iz poglavlja 6a (obeležavanje autora) niti M15 poglavlje 6.5.4 (AI nikad sam ne izvršava radnju) — samo određuje **gde na ekranu** ta pravila postaju vidljiva.

### 6c.1 Dugme `+` — prilaganje konteksta (dopuna, 18.8.2026, na zahtev vlasnika — referenca: VS Code/Copilot Chat)

Pored polja za unos, dugme `+` otvara meni sa čime se razgovor može dopuniti — svaka stavka je **prilaganje konteksta**, nikad nova AI moć, samo preciznije određenje o čemu se razgovor vodi:

- **Trenutno otvoren zapis** — ako je u centru/desnom panelu otvorena rezervacija/gost/faktura, prva stavka menija je taj zapis (jedan klik umesto prepričavanja agentu na šta se misli). Agent ovo **predlaže**, ne nameće sam.
- **Rezultati trenutne pretrage** — ako je otvoren tab pretrage, dodaje ceo trenutni skup rezultata kao kontekst (isti mehanizam kao M5 poglavlje 3.0e.2, ovde dobija vidljivo, dosledno mesto u meniju umesto skrivenog ponašanja).
- **Prilog fajla/slike** — cenovnik dobavljača, skeniran ugovor, dokument gosta — jedan ulaz za analizu umesto što svaki modul (M3 uvoz cenovnika, M22 prilog) ima sopstveni, razdvojen mehanizam za "priloži pa analiziraj".
- **Pretraga interneta** (M15 poglavlje 6.5.6b) — ista opcija menija kao ostalo, umesto zasebnog ulaza za "agentu treba nešto van aplikacije".
- **Konkretan zapis preko `@` pominjanja** — kucanje `@` unutar samog polja (ne kroz `+` meni) otvara brzu pretragu (isti mehanizam kao komandna paleta) da se eksplicitno referencira zapis po broju/imenu (npr. `@rezervacija TT-2026-482`, `@gost Petrović`) bez otvaranja tog taba.

Priložen kontekst prikazuje se kao uklonjiv "čip" u plutajućem bloku iznad polja (poglavlje 6c iznad) — vidljivo šta je agent trenutno "video", jedan klik da se ukloni.

### 6c.2 Ostatak reda za unos (dopuna, 18.8.2026, na zahtev vlasnika)

- **Slash komande (`/`)** — kratke, determinističke prečice koje ne čekaju jezički model (npr. `/otkazi`, `/posalji-vaucer`, `/rezime`), mapirane direktno na već postojeću radnju — isti princip kao poglavlje 4a (prečica za čest postupak), samo dostupno unutar razgovora.
- **Dugme "Zaustavi"** dok agent generiše odgovor — zamenjuje dugme za slanje dok je odgovor u toku, standardan obrazac, eksplicitno upisan da ne bude propušten pri izradi.
- **Istorija razgovora vezanih za trenutni zapis** — mala ikonica koja otvara ranije razgovore o istom zapisu (transkripti se već čuvaju gde god postoje, npr. M7 `SubagentChatMessage`) — bez ponovnog postavljanja istog pitanja.
- **Traka moda/dozvola** (već skicirana gore, poglavlje 6c) — konkretizovano: vidljiv prekidač npr. "Samo pretraga" naspram "Izvršni mod" (M7 poglavlje 2.0.4) — korisnik uvek vidi šta agent trenutno *sme*, ne samo šta upravo radi.

### 6c.3 Prikaz odgovora — obrazac Chrome/Google AI pretrage (dopuna, 18.8.2026, na zahtev vlasnika)

- **Postepeno ispisivanje (streaming)** — tekst odgovora se pojavljuje kako pristiže, ne tek kad je ceo odgovor gotov. Isti razlog kao poglavlje 4b (brzinski cilj) — percipirana brzina, korisnik vidi da se nešto dešava umesto da gleda u prazno dok agent "razmišlja".
- **Izvori kao pilule/kartice ispod odgovora** — svaki izvor korišćen za odgovor (M23 članak, M2 proizvod, spoljni sajt preko poglavlja 6.5.6/6.5.6b) prikazuje se kao mala, klikabilna oznaka ispod teksta odgovora (naziv izvora + ikonica tipa), ne kao ulančan tekst-link u samoj rečenici — klik vodi na taj zapis/stranicu (nov tab, isto pravilo kao poglavlje 5a). Ovo je i direktna sledljivost porekla (princip #5 Master dokumenta, "sve se može revidovati") u vizuelnom obliku, ne samo u audit logu.
- **Predložena sledeća pitanja ispod odgovora** — 2-3 chip/dugmić sa logičnim nastavkom razgovora (npr. posle odgovora o rezervaciji: "Pošalji podsetnik gostu?", "Prikaži istoriju plaćanja") — klik popunjava/šalje upit umesto ponovnog kucanja. Predlozi dolaze iz istog jezičkog poziva koji je dao odgovor (ne dodatni poziv), i nikad ne uključuju radnju koju agent ne sme sam da izvrši (poglavlje 6.5.4 M15 — predlog ostaje predlog, klik i dalje prolazi kroz isti tok potvrde kao da je ručno otkucan).
- **Izgled kartice odgovora** — **rešeno (18.8.2026)**: isti osnovni oblik kartice kao svuda u interfejsu (poglavlje 6, dopunjeno istog dana po uzoru na kartice rezultata pretrage smeštaja) — neznatno zaobljene ivice, akcentna ivica dok je odgovor u toku generisanja (poglavlje 6c.3 iznad, "streaming") kao vizuelni ekvivalent "izabranog" stanja, bez akcentne ivice kad je odgovor završen i miran.

---

## 6d. Rezultati pretrage — kartice/redovi, filteri u levom panelu, unakrsna prodaja

*(dodato 17.8.2026, na zahtev vlasnika — podaci/logika iza ovoga: M5 poglavlje 3.0c/3.0d/3.0e)*

- **Kartice** (poglavlje 6, isti vizuelni jezik) za tipove sa bogatim vizuelnim sadržajem — Smeštaj, Krstarenja, Grupni paketi, Things to do: slika, naziv, ključne činjenice, cena, dugme "Dodaj".
- **Kompaktni redovi** (tabela-stil) za tipove gde je brzo poređenje bitnije od slike — Letovi, Transferi, Rent-a-car: jedan red po ponudi (kompanija/vozilo, vreme, trajanje, cena), isti utisak kao Google Flights lista.
- **Filteri — u levom panelu, kao dodatna sklopiva sekcija, ne traka iznad rezultata** (ispravka, 18.8.2026, na zahtev vlasnika — isti obrazac kao VS Code Explorer bočna traka, gde se "Outline"/"Timeline" pojavljuju kao dodatne sklopive celine ispod/pored glavnog stabla, ne kao traka unutar centralnog editora). Dok je tab pretrage otvoren, levi panel dobija drugu sklopivu sekciju **"Filteri"** pored/ispod postojećeg stabla vođene pretrage (poglavlje 5b) — cena, kategorija/zvezdice, usluga, sadržaji-tagovi (M5 poglavlje 3.0c.3), sortiranje. Sklopiva/proširiva nezavisno od ostatka levog panela, isti ševron-obrazac (poglavlje 5). Izmena filtera osvežava rezultate u centru **u istom tabu** (poglavlje 5a — filteri su "izmena unutar tekućih rezultata", ne nova pretraga). Razlog premeštaja: centralni panel ostaje isključivo prikaz rezultata (isti princip kao poglavlje 5b, "centar = uvek lista ili pun zapis"), kontrole nad tim šta se prikazuje pripadaju navigatoru, ne mešaju se sa sadržajem.
  - **Filteri grupisani po kategoriji, ne jedna ravna lista** (dopuna, 18.8.2026, na zahtev vlasnika) — unutar sekcije "Filteri", svaka prirodna celina je sopstvena, nezavisno sklopiva pod-sekcija (isti ševron-obrazac, ugnježđen jedan nivo dublje): "Cena", "Kategorija/zvezdice", "Usluga" kao zasebne pod-sekcije, i sadržaji-tagovi (`amenity_tags[]`) razbijeni po **već postojećoj** grupi iz M2 spec §2.3c — "Udaljenost od plaže", "Bazen", "Plaža", "Sadržaji objekta", "Soba", "Pogodno za", "Politika" — svaka svoja pod-sekcija, ne jedna duga lista od ~30 stavki. Podrazumevano **sklopljene** su sve osim onih koje korisnik trenutno koristi (aktivan filter u toj grupi je razlog da ostane otvorena) — sprečava zatrpavanje kad je filtera puno, tačno problem koji je ovo rešilo. Isti princip primenjuje se na svaki tip proizvoda čiji filteri (M5 poglavlje 3.0d) narastu preko par polja, ne samo na smeštaj.
  - **Brzi filteri — vrlo vidljivi, pinovani na vrhu sekcije "Filteri", nikad sklopljeni** (dopuna, 18.8.2026, na zahtev vlasnika; podaci/logika: M5 poglavlje 3.0c.3a) — dva para prekidača/dugmića uvek na vrhu, iznad svih sklopivih grupa: **Refundabilno / Nerefundabilno** i **Odmah potvrda / Upit**. Razlog izuzetka od pravila "sklopljeno dok se ne koristi" (iznad) — ovo su najčešće odlučujući filteri pri prodaji (agent na telefonu sa gostom prvo pita "da li se otkazuje bez penala" i "da li je odmah potvrđeno"), pa ne smeju čekati klik da se otkriju.
- **AI pretraga unutar rezultata** (M5 poglavlje 3.0e.2) — polje na dnu centralnog panela, isti obrazac kao poglavlje 6c (plutajući kontekst iznad unosa); rezultat je osvežena/filtrirana lista nad istim rezultatima, ne nova pretraga.
- **Predlog unakrsne prodaje** ("da li želite da dodamo...", M5 poglavlje 3.0e.1) pojavljuje se **odmah po dodavanju stavke** u desni panel (vlasnikova odluka, 17.8.2026) — kao mali blok uz vrh desnog panela (isti "plutajući kontekst" duh kao poglavlje 6c), ne modal koji blokira ostatak ekrana. Prihvatanje otvara predpopunjenu vođenu pretragu za predloženi tip; odbijanje ga trajno uklanja za tu selekciju (ne ponavlja se).
- **Desni panel — cena i istek** (M5 poglavlje 3.0e.3): svaka stavka nosi pojedinačnu cenu; stavke iz `API` izvora nose vidljivo odbrojavanje isteka (`quote_expires_at`); zbir na dnu upozorava ako selekcija sadrži više valuta.
- **Radnja "Info" — veza sa bazom znanja** (dopuna, 18.8.2026, na zahtev vlasnika; podaci/logika: M5 poglavlje 3.0b.4) — svaka kartica i svaki kompaktan red rezultata nosi malu radnju "Info" (ikonica, ne puno dugme — ne guši glavnu radnju "Dodaj"). Klik otvara desni panel (poglavlje 5b, "izdvajanje" — isti obrazac kao AI razgovor ili istorija izmena, samo drugi izvor sadržaja) sa M23 sadržajem o tom proizvodu/destinaciji. Prazno stanje kad članak ne postoji je isto tiho/pošteno kao svako drugo prazno stanje u ovom dokumentu (poglavlje 6) — ne izmišljen tekst. Dostupno samo u M17/M7 (gde je M23 uopšte dostupan, M23 spec poglavlje 1.3) — ne prikazuje se na M8 rezultatima.

---

## 6e. Kartica sadržaja — naslov, bedž, opis, akcije (dopuna, 20.8.2026, na zahtev vlasnika)

Konkretizacija opšteg oblika kartice iz poglavlja 6 za sadržaj tipa "najava/opis mogućnosti sa vezama", po uzoru na dva ekrana koje je vlasnik doneo kao referencu (VS Code MSSQL ekstenzija, "What's new" panel). Ne uvodi novu funkcionalnost (ta odluka je namerno odbijena — vidi poglavlje 8) — samo precizira izgled deljene kartice-komponente da svaki modul može da je koristi za sopstveni sadržaj (npr. M21 članak, M23 destinacija, M13 istaknut nalaz).

Dve vizuelne podforme, ista osnova (`bg-panel`/`bg-panel-2`, tanka `border-border` ivica, blago zaobljene ivice — poglavlje 6):

- **Kartica sa naslovnim redom akcija** — naslov (podebljan), opcion mali bedž pored naslova (pill oblik, npr. "PREGLED"/status — semantička ili neutralna boja po poglavlju 4b, nikad proizvoljna), telo opisa (`ink-dim`), red akcija na dnu: kratke tekstualne veze u akcentnoj boji, svaka sa strelicom udesno (`chevron-right` ili `arrow-right` Codicon) posle teksta, razdvojene malim razmakom, bez podvlačenja u mirnom stanju. Koristi se za "jedna mogućnost/jedan nalaz po kartici" sadržaj u glavnom toku (npr. lista predloga, lista istaknutih članaka).
- **Kartica sa listom veza** — naslov, kratak opis ispod, pa vertikalna lista veza — svaka veza sopstveni red sa malom ikonicom ispred (tip veze: video/spoljna stranica/dokument) i tankom razdelnom linijom (`border-border`) između redova, bez strelice na kraju (razlika od prve podforme — ovde je ikonica ispred nosilac značenja, ne strelica posle). Koristi se za sažete "grupe veza" u bočnim/pratećim pozicijama (npr. "Resursi", "Povratne informacije" u referentnom ekranu) — analogno postojećem klaster-obrascu iz poglavlja 5d, samo unutar kartice umesto trake.

Zajednička pravila za obe podforme: hover stanje veze/reda dobija diskretnu promenu boje teksta (svetlije/tamnije od akcentne, ne nova boja), ne pozadinsku promenu cele kartice; kartica nikad ne nosi sopstvenu senku van standardnog `shadow-sm` (poglavlje 6, isti utisak kao ostatak interfejsa); sadržaj je uvek stvaran (naslov/opis/veza vezani za pravi zapis ili modul), nikad placeholder tekst na produkciji.

Implementirano kao deljena komponenta (`apps/panel/src/components/ContentCard.tsx`) koju svaki ekran uvozi — isto pravilo kao poglavlje 6a.2 tačka 5 (jedna komponenta, ne obrazac koji se prepisuje po ekranima).

---

## 7. Obim primene — M17 i M7 istim obrascem, M8/M9 zasebno

*(izmenjeno 17.8.2026 — ranije "samo M17 za sada")*

Ovaj dizajn sistem je pisan prvenstveno za **M17 (interni panel)** — okruženje za tim koji radi svaki dan, gde command-palette obrazac ima najviše smisla. **Vlasnikova odluka (17.8.2026): M7 (B2B portal, subagenti) dobija identičan vizuelni i interakcioni obrazac kao M17** — ista paleta-mehanizam (poglavlje 2), ista komandna paleta (poglavlje 4), isti tri-panelni raspored (poglavlje 5b), isti AI-razgovor obrazac (poglavlje 6c). Razlog: subagenti su redovni, profesionalni korisnici pod istim vremenskim pritiskom kao interni tim, ne povremeni gost — razlikovanje ide kroz **podatke koje vide** (M7 spec poglavlje 2.0, dobavljača-slep + bez marže/nabavne cene), ne kroz pojednostavljen interfejs. M7 zadržava sopstvenu "beli-label" paletu po subagentu (M7 spec poglavlje 2.0.5) umesto fiksnog Horizonta — mehanizam biranja/token-sloj ostaje isti kao M17, samo se boje pune iz `SubagentBranding` umesto iz fiksne palete.

I dalje se **ne pretpostavlja** da isti obrazac direktno odgovara i M8 (B2C sajt, gost koji retko koristi aplikaciju) ili M9 (mobilna aplikacija, dodirni ekran bez tastature) — ti kanali dobijaju sopstvenu primenu vizuelnog identiteta (boje, tipografija) kad dođu na red, ali ne nužno isti interakcioni obrazac. Ovo se rešava kad ti moduli dođu na red, ne pretpostavlja se ovde.

---

## 8. Otvoreno za dalje

- ~~Tačne HEX vrednosti palete (za oba moda) — biraju se pri izradi prvog stvarnog ekrana, obavezno u skladu sa pravilom kontrasta (poglavlje 2a).~~ **Rešeno (avgust 2026, prvi prolaz M17 implementacije)** — paleta "Horizont" (`apps/panel/tailwind.config.ts`, `apps/panel/src/app/globals.css`):

  | Uloga | Svetli mod | Tamni mod |
  | :---- | :---- | :---- |
  | pozadina (bg) | `#f6f8fb` | `#0c1420` |
  | panel | `#ffffff` | `#121b29` |
  | panel-2 (bočna traka/gornja traka) | `#e9eef4` | `#1a2536` |
  | granica (border) | `#6f8298` | `#5a7594` |
  | tekst | `#0e1826` | `#eef2f7` |
  | tekst — sekundaran | `#3c4f66` | `#b7c4d4` |
  | tekst — najslabiji | `#54677d` | `#8998ac` |
  | akcent (jedina) | `#9c6216` | `#eab35c` |
  | akcent — tekst na akcentu | `#fffaf0` | `#1c1206` |

  Svaka kombinacija tekst/granica-protiv-pozadine iz gornje tabele proverena programski (formula WCAG 2.1 relativne luminanse) — najniži rezultat je `3.71:1` (granica na svetlom modu, ispod praga za tekst ali iznad 3:1 zahteva za granice/ikonice), sav tekst prolazi sa marginom (`4.84:1` do `17.84:1`). `--danger`/`--danger-bg` i slični semantički parovi (uspeh/upozorenje) takođe provereni, najniži `4.85:1`.

- **Paleta sajta (M8) — "Zalazak"** (`apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`). Nastala iz `docs/moduli/M01-core-identitet/00-MOCKUP-M1-TERMINAL-STYLE.html` (paleta 1) i **nikad nije prošla proveru iz poglavlja 2a** — ispravljeno 17.8.2026:

  | Uloga | Svetli — bilo | Svetli — sad | Tamni — bilo | Tamni — sad |
  | :---- | :---- | :---- | :---- | :---- |
  | granica (border) | `#e6d3b0` (1.19:1 ❌) | `#8f836d` (3.02:1) | `#3d2a1a` (1.20:1 ❌) | `#8c603c` (3.00:1) |
  | tekst — najslabiji | `#9c8663` (2.84:1 ❌) | `#77664b` (4.50:1) | `#8f7a62` (4.00:1 ❌) | `#9a846a` (4.58:1) |
  | akcent (amber) | `#c1791f` (3.17:1 ❌) | `#935c18` (5.04:1) | `#e8a63c` ✅ | nepromenjen |
  | akcent — jači | `#9c5f14` (4.06:1 ❌) | `#7a4a12` (5.86:1) | `#f4c473` ✅ | nepromenjen |
  | uspeh (ok) | `#1f9d67` (3.07:1 ❌) | `#187c51` (4.62:1) | `#3ecf8e` ✅ | nepromenjen |
  | upozorenje (warn) | `#a86a12` (3.82:1 ❌) | `#975f10` (4.57:1) | `#e0a542` ✅ | nepromenjen |
  | **šljiva (druga boja)** | — | `#5b4b8a` (6.05:1) | — | `#a99bd8` (6.52:1) |
  | šljiva — podloga bedža | — | `#e8e3f4` (7.85:1) | — | `#221c33` (7.35:1) |
  | ~~zelena (`accent2`)~~ | `#12907d` (3.39:1 ❌) | **ukinuta** | `#2ba894` | **ukinuta** |

  Nepromenjeni ostaju `--bg`, `--panel`, `--panel-2`, `--text`, `--text-dim`, `--accent-soft`, `--accent-ink`, `--danger` — svi su prolazili. Posledično provereno i ispravljeno: `--accent-ink` na `--accent` (tekst na punom dugmetu "Rezerviši", najvažnija kontrola na sajtu) bio je `3.30:1`, sad je `5.26:1`.

  Merenja su rađena protiv **stvarnih** podloga uz koje se svaka boja koristi (`bg`, `panel`, `panel-2`, `accent-soft`, `ok-bg`, `warn-bg`), ne jedne pretpostavljene — po pravilu iz poglavlja 2a.
- ~~Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17~~ — **rešeno 17.8.2026** (poglavlje 7): identičan obrazac, razlikovanje ide kroz podatke (M7 spec poglavlje 2.0), ne kroz interfejs.
- **Vlasnikov prošireni pregled uživo nad celim poslovanjem** (npr. Elastic/Kibana-stila dashboard za praćenje svih procesa u realnom vremenu) — vlasnik izričito rekao "još ćemo raditi na tome" (17.8.2026), namerno odloženo. Verovatno dodatan sloj iznad M17 (možda i M13 BI), ne zamena — ne pretpostavlja se ovde ni obim ni tehnologija (uvođenje Elastic-a bilo bi nova zavisnost, zahteva `tt-tech-stack` potvrdu kad dođe na red).
- Da li izbor tamnog/svetlog moda treba da se sinhronizuje preko više uređaja po nalogu (zahteva backend polje, npr. na M1 `User`) ili ostaje lokalno po uređaju — v1 pretpostavlja lokalno, revidira se ako se pokaže potreba.
- Tačna paleta semantičkih boja za isticanje teksta (poglavlje 6) — upozorenje/greška/uspeh — bira se zajedno sa HEX vrednostima palete.
- Da li postoji gornja granica broja istovremeno otvorenih tabova (poglavlje 5a), i šta se dešava kad se dostigne — dorađuje se pri implementaciji ako se pokaže potreba.
