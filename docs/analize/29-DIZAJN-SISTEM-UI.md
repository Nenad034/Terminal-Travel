# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu), kasnije M7 (B2B portal), M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.8 — tri vlasnikove odluke od 17.8.2026: (a) paleta sajta ispravljena po §2a (sedam parova je padalo AA u svetlom modu, dva u tamnom — vidi poglavlje 8), (b) **boja šljive je druga boja sajta**, zamenila zelenu umesto da se doda kao treća (poglavlje 2), (c) **sajt ide punom širinom ekrana**, sa izuzetkom za stranice koje se čitaju (novo poglavlje 6b). Dodato i poglavlje 2.0 — dokument je do sad beležio samo panelovu paletu, što je bio deo razloga zašto paleta sajta nikad nije prošla proveru. v1.7 — pravilo iz 1.6 sprovedeno kroz ceo panel (17 mesta, uključujući pet dugmadi kojima je padao tek hover), pa je stavka zatvorena i u backlogu; v1.6 — poglavlje 2a dopunjeno tvrdim pravilom "tekst na `accent-soft` je `accent-strong`, ne `accent`" (nalaz iz M17 live-provere 17.8.2026: `accent` na `accent-soft` daje 3.96:1 u svetlom modu i pada AA); v1.5 — dodato poglavlje 6a: obeležavanje autora radnje (čovek / AI agent / spoljni nalog) kao jedinstveno pravilo za sve kanale, na zahtev vlasnika (avgust 2026) — zatvara nalaz da je svaki ekran panela do sad izmišljao sopstveni način obeležavanja AI poteza; prati ga dopuna M17 poglavlje 3.1 i M19 poglavlja 2.3/9.5; v1.4 — dodato poglavlje 5a: tabovi za paralelan rad na više otvorenih zapisa/ekrana istovremeno (na zahtev vlasnika); v1.3 — dodato poglavlje 2a: kontrast teksta/ikonica je tvrd zahtev (WCAG AA minimum, AAA cilj gde je lako ostvarivo), proverava se lokalno protiv stvarne pozadine (ne jedne pretpostavljene), identično u oba moda — na izričit zahtev vlasnika; v1.2 — dodato poglavlje 3a (ikonografija — Codicons, rešava ranije otvoreno pitanje) i poglavlje 6 (sadržaj centralnog panela: isticanje pozadinom teksta, kartice, suptilne animacije), proširen opis bočne trake stablo-strukturom (poglavlje 5), sve na zahtev vlasnika (avgust 2026); v1.1 — dodat zahtev za obavezan tamni i svetli mod (poglavlje 2), ne samo tamni (avgust 2026, na zahtev vlasnika).

---

## 1. Vodeća ideja

Aplikacija treba da izgleda **prepoznatljivo drugačije** od bilo koje druge poslovne platforme, ali da **radi** po obrascima koje ljudi već znaju napamet — jer tim radi pod pritiskom (gost čeka na telefonu dok se pravi rezervacija), i to nije trenutak da neko mora da uči novi način rada.

**Razlikovanje ide kroz vizuelni identitet** (boje, tipografija, sitni detalji) — **ne kroz izum novih interakcionih pravila**. Interakcija se namerno oslanja na već pobedničke obrasce (VS Code, Chrome, Linear, Raycast) jer su ti obrasci brzi i imaju nisko kognitivno opterećenje — što je tačno ono što je bitno kad neko radi ovo svaki dan.

---

## 2. Paleta boja

Polazna tačka: teget/teal naspram toplo-narandžaste (rđa/amber) — komplementaran, prigušen par, ne jarke primarne boje. Asocira na putovanje bez klišea "plavo nebo + avion" logotipa.

| Uloga | Ton | Napomena |
| :---- | :---- | :---- |
| Osnovna pozadina (tamni mod) | Dubok teget/teal (topliji od crne) | Zamenjuje čisto crnu (VS Code obrazac) — miran za oči tokom celog radnog dana, ali sa karakterom |
| Osnovna pozadina (svetli mod) | Toplo, blago krem-bela (ne čisto bela) | Isti "porodični" ton kao teget — nijansa tegeta razblažena ka svetlom, ne nezavisna, hladno-bela paleta |
| Akcentna boja (glavna, ista u oba moda) | Topla narandžasta/rđa (amber) | Dugmad, aktivna stavka u bočnoj traci, otvorena `Ctrl+K` paleta, statusi koji traže pažnju; ista boja radi na oba moda uz eventualno sitno podešavanje zasićenosti radi kontrasta |
| Druga boja — **samo na sajtu (M8)**, boja šljive | Modro-plava (šljiva) | Vlasnikova odluka 17.8.2026. Uloga: **sve što nije glavna radnja** — sekundarna dugmad, oznake, akcenti na deljenim stranicama. Glavna radnja ("Rezerviši", "Plati") ostaje amber, jer ona mora da vuče oko; kad bi obe boje vukle jednako, ni jedna ne bi. Zamenila je zelenu (`--accent2`), **nije se dodala kao treća** — zelena je do tada bila upotrebljena na jednom jedinom mestu, pa nije bila stvarna druga boja identiteta nego ostatak. Topla amber + hladna šljiva se međusobno pojačavaju; amber + zelena su bila dva srednje topla tona koja se blago tuku. |

**Koliko akcentnih boja:** panel (M17) ostaje na **jednoj** — tamo je gustina informacija visoka i druga boja bi proizvela šaren, haotičan utisak. Sajt (M8) ima **dve** sa jasno razdvojenim ulogama (gore). Više od dve nema ni jedan kanal — treća boja obesmišljava pravilo o hijerarhiji pažnje, jer čitalac više ne zna šta je važno.

### 2.0 Dve palete, ne jedna — i zašto se to skoro izgubilo

Panel i sajt **imaju odvojene palete** i to je namerno (različita publika, različit utisak): panel je "Horizont" (hladan teget/teal, poglavlje 8), sajt je "Zalazak" (topla peščana, `apps/web/src/app/globals.css`). Ovaj dokument je do 17.8.2026. beležio **samo panelovu** — i to je bio deo razloga zašto paleta sajta nikad nije prošla proveru iz poglavlja 2a i zašto je sedam parova padalo AA prag (vidi poglavlje 8). **Svaka nova paleta se upisuje ovde u istom prolazu kad nastane**, ne posle.
| Tekst / sekundarni elementi / ivice | Neutralni sivi tonovi izvedeni iz teget osnove — svetli u tamnom modu, tamni u svetlom | Cela paleta deluje kao jedna porodica boja, ne nabacane komponente, u oba moda |

Tačne HEX vrednosti nisu fiksirane ovim dokumentom — biraju se/fino podešavaju pri izradi UI kod-baze na osnovu ove polazne tačke i **obavezno prema pravilu kontrasta iz poglavlja 2a**, ne izmišljaju se unapred bez stvarnog ekrana na kom se proveravaju.

**Tamni i svetli mod — oba se prave, na zahtev vlasnika (avgust 2026).** Tamni ostaje podrazumevani (prvi koji se implementira, prvi koji se testira), ali svetli mod nije opcioni "ako ikad zatreba" — obavezan je od starta.

- **Podrazumevano:** aplikacija prati podešavanje operativnog sistema korisnika (`prefers-color-scheme`) pri prvom otvaranju.
- **Ručni prekidač:** korisnik može eksplicitno da izabere tamni/svetli mod, nezavisno od sistemskog podešavanja — izbor se pamti (lokalno po uređaju/browseru je dovoljno za v1; sinhronizacija izbora preko više uređaja po nalogu nije pretpostavljena bez stvarne potrebe, vidi poglavlje 8).
- Prekidač živi u istom minimalnom duhu kao ostatak UI-ja (poglavlje 5) — ne traži poseban ekran podešavanja, dovoljna je jedna ikonica/stavka u komandnoj paleti (poglavlje 4) ili uglu gornje trake.

---

## 2a. Kontrast — obavezno pravilo, ne preporuka

*(dodato avgust 2026, na izričit zahtev vlasnika — "vrlo važno da se ne nerviram kasnije")*

Ovo nije estetska preporuka nego **tvrd, merljiv zahtev**, isti duh kao "Izlazni kriterijum" u Nivo 2 specifikacijama — ne prolazi dok se ne proveri, ne "izgleda dobro na oko".

- **Standard: WCAG 2.1 nivo AA, kao apsolutni minimum** — najmanje **4.5:1** kontrast za običan tekst, **3:1** za veliki tekst/ikonice/granice UI elemenata. Gde je lako postići (glavni telo teksta), cilja se **AAA (7:1)** radi rezerve, ali AA je granica ispod koje ništa ne sme proći.
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

---

## 4. Glavni obrazac interakcije — komandna paleta (`Ctrl+K` / `Cmd+K`)

Ovo **nije nova ideja** — ovo je vizuelna/interakciona realizacija onoga što M17 spec već zove *omnisearch* (poglavlje 5.5) i M15 poglavlje 6.5 već definiše kao deljen mehanizam. Ovaj dokument ne menja to ponašanje, samo mu daje konkretan oblik:

- **Skriveno dok se ne pozove** — ne stalno vidljivo polje u zaglavlju, nego overlay koji iskače na `Ctrl+K`/`Cmd+K` i nestaje čim nije potreban (Escape, klik van, ili izvršena akcija).
- **Prazan upit + Enter** → navigacija filtrirana na ulogu trenutnog korisnika (već propisano M17 §5.5).
- **Upit sa tekstom** → poziva `POST /ai-orchestration/omnisearch` (M15 poglavlje 9), vraća rezultate/AI odgovor koji nikad ne prekoračuju prava trenutnog korisnika.
- **Nikad ne izvršava radnju sam** (M15 poglavlje 6.5.4) — rezultat je uvek link/navigacija ka postojećem ekranu ili zapisu, ne akcija koja se izvrši u pozadini.

Ovo je i doslovno ono što vlasnik opisuje kao "skrivene naredbe za pokretanje modula" — komandna paleta postaje glavni, brzi put kroz aplikaciju, ne samo pretraga.

---

## 5. Raspored ekrana (layout)

- **Tanka bočna traka, samo ikonice** — moduli prikazani kao ikonice (Codicons, poglavlje 3a), ne puni nazivi; širi se na hover/klik. Moduli koji još nisu implementirani prikazuju se zaključani sa oznakom faze (M17 spec, poglavlje 7 — ovo već postoji kao ideja, samo se sad formalizuje vizuelno).
- **Stablo-struktura unutar bočne trake, kad se proširi** — hijerarhijski odnosi (npr. modul → njegove pod-sekcije) prikazani istim vizuelnim jezikom kao VS Code Explorer/Source Control prikaz: tanke vertikalne linije koje povezuju ugnježđene stavke, strelice/ševroni (`chevron-right`/`chevron-down` iz Codicons) za sklapanje/rasklapanje grana, ne pune ilustracije ili boje po nivou.
- **Gornja traka minimalna, jedna tanka linija** — bez gomile vidljivih dugmića; sve "teško" ide kroz komandnu paletu (poglavlje 4), ne kroz vidljive menije.
- **Sadržaj u fokusu** — veći deo ekrana ostaje prazan/posvećen sadržaju, ne navigaciji.

---

## 5a. Tabovi — više otvorenih ekrana istovremeno

*(dodato avgust 2026, na zahtev vlasnika)*

Traka tabova iznad centralnog panela (ispod gornje trake, poglavlje 5) — isti obrazac kao VS Code/browser tabovi, **unutar same Terminal aplikacije** (ovo nisu tabovi browsera, nego tabovi unutar jedne stranice). Svaki tab je jedan otvoren zapis/ekran — npr. "Rezervacija #482", "Petrović — profil", "Finansijski izveštaj — avgust" — otvoren nezavisno, bez da se izgubi mesto na kom se stalo u prethodnom.

- **Otvaranje:** klik na rezultat komandne palete (poglavlje 4) otvara novi tab; navigacija unutar već otvorenog tab-a (npr. klik na gosta iz prikaza rezervacije) menja sadržaj **tog istog** taba, ne otvara novi automatski — novi tab je namerna radnja, ne posledica svakog klika.
- **Zatvaranje/preuređenje:** dugme za zatvaranje na svakom tabu, prevlačenje (drag) za promenu redosleda, tastaturna prečica za ciklično prebacivanje (isti duh kao `Ctrl+Tab` u VS Code-u).
- **Indikator nesačuvane izmene** — tab sa formom koja ima neposlate izmene dobija malu tačku/oznaku, da se ne izgubi rad slučajnim zatvaranjem.
- **Otvoreni tabovi se pamte preko osvežavanja stranice** (lokalno, po sesiji) — slučajan refresh ili pad konekcije ne sme obrisati sve što je tim imao otvoreno, pogotovo pod pritiskom kad se radi sa gostom na telefonu.
- Svaki tab i dalje nosi sopstvene "mrvice" (breadcrumbs) ako je sadržaj ugnježđen — tabovi i breadcrumbs rešavaju različit problem (paralelan rad naspram dubine unutar jednog konteksta), ne zamenjuju jedno drugo.

---

## 6. Sadržaj centralnog panela — isticanje, kartice, pokret

*(dodato avgust 2026, na zahtev vlasnika)*

Centralni panel (glavni radni prostor, ne bočna traka) prati vizuelne konvencije VS Code editora, primenjene na poslovni sadržaj umesto na kod:

- **Bojenje pozadine teksta za isticanje** — isti princip kao highlight rezultata pretrage ili inline dijagnostika u VS Code editoru: deo teksta koji zahteva pažnju (npr. razlog odbijanja, promenjeno polje u pre/posle prikazu audit loga, upozorenje o roku) dobija blagu pozadinsku boju iza samog teksta, ne posebnu ikonicu/banner pored njega. Boja isticanja izvedena iz akcentne (poglavlje 2) ili iz standardnih semantičkih boja (upozorenje/greška/uspeh) — nikad proizvoljna paleta po ekranu.
- **Kartice za grupisan sadržaj** — blokovi informacija (npr. jedan `UserPermissionOverride` zapis, jedan red audit loga kad se proširi) prikazani kao odvojene kartice sa blago drugačijom pozadinom od okolnog prostora — isti utisak kao VS Code hover/peek prikaz, ne pune tabele sa linijama svuda.
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

## 7. Obim primene — samo M17 za sada

Ovaj dizajn sistem je pisan prvenstveno za **M17 (interni panel)** — okruženje za tim koji radi svaki dan, gde command-palette obrazac ima najviše smisla. **Namerno se ne pretpostavlja** da isti obrazac (skrivena komandna paleta, "power-user" interakcija) direktno odgovara i M8 (B2C sajt, gost koji retko koristi aplikaciju) ili M9 (mobilna aplikacija, dodirni ekran bez tastature) — ti kanali dobijaju sopstvenu primenu vizuelnog identiteta (boje, tipografija) kad dođu na red, ali ne nužno isti interakcioni obrazac. Ovo se rešava kad ti moduli dođu na red, ne pretpostavlja se ovde.

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
- Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17 (subagenti su takođe redovni, profesionalni korisnici) ili prilagođenu, jednostavniju verziju — otvoreno dok M7 UI ne dođe na red.
- Da li izbor tamnog/svetlog moda treba da se sinhronizuje preko više uređaja po nalogu (zahteva backend polje, npr. na M1 `User`) ili ostaje lokalno po uređaju — v1 pretpostavlja lokalno, revidira se ako se pokaže potreba.
- Tačna paleta semantičkih boja za isticanje teksta (poglavlje 6) — upozorenje/greška/uspeh — bira se zajedno sa HEX vrednostima palete.
- Da li postoji gornja granica broja istovremeno otvorenih tabova (poglavlje 5a), i šta se dešava kad se dostigne — dorađuje se pri implementaciji ako se pokaže potreba.
