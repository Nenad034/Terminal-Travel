# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu) i M7 (B2B portal, isti obrazac — poglavlje 7), kasnije M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.17 — dopuna poglavlja 5a (18.8.2026, na zahtev vlasnika): svaka nova pretraga (bilo koja od 9 vrsta, poglavlje 5b) uvek otvara nov tab, čak i kad je pokrenuta iz već otvorenog tab-a pretrage (izmena parametara, unakrsna prodaja) — izuzetak od opšteg pravila "navigacija unutar taba ne otvara novi", koje i dalje važi za drill-down u zapis. Razlog: agent poredi više otvorenih pretraga jednu pored druge za istog gosta. v1.16 — novo poglavlje 5c (17.8.2026, na zahtev vlasnika): back-office ~20 sekcija grupisano u ~9 ikona za gornju traku (tačan spisak grupa: M17 spec poglavlje 4a), leva traka prvo prikazuje spisak sekcija grupe pa se skuplja na izabranu sekciju sa poljima za pretragu/filtriranje ispod naziva. Poglavlje 5 izmenjeno da odražava da gornja traka sad nosi grupe modula (potvrđeno kao zvanična VS Code opcija, `workbench.activityBar.location: "top"`), ne više "minimalna jedna linija". v1.15 — pojašnjenje poglavlja 5b (17.8.2026, na zahtev vlasnika, isti dan): eksplicitno razdvojena dva nivoa levog navigatora — gornji nivo je spisak SVIH back-office modula (već postojeći `apps/panel/src/lib/nav.ts`), devet ikona po vrsti proizvoda je stablo-grana unutar JEDNOG od tih modula ("Pretraga i rezervacije"), ne zamena za ostatak spiska. Nema izmene podataka/toka, samo ispravljena formulacija koja je mogla delovati kao da levi panel gubi ostale module. v1.14 — novo poglavlje 6d (17.8.2026): prikaz rezultata pretrage (kartice vs. kompaktni redovi po tipu), traka filtera, AI pretraga unutar rezultata (isti obrazac kao 6c), mesto pojavljivanja predloga unakrsne prodaje (uz vrh desnog panela, odmah po dodavanju stavke), odbrojavanje isteka/upozorenje na valutu u desnom panelu. Podaci/logika iza ovoga: M5 poglavlje 3.0e. v1.13 — dopuna poglavlja 5b (17.8.2026): konačna lista od 9 ikona u levom navigatoru za pretragu (Smeštaj/Letovi/Transferi/Rent-a-car/Things to do/Individualni paketi/Grupni paketi/Krstarenja/Putno osiguranje) — konkretan tok polja za svaku definisan u M5 spec poglavljima 3.0c/3.0d, ovaj dokument ostaje raspored/interakcija. v1.12 — dopuna poglavlja 5b (17.8.2026): jedna ikonica po `Product.type` na vrhu levog navigatora za pretragu — konkretan tok polja (Smeštaj) sad definisan u M5 spec poglavlju 3.0c, ovaj dokument ostaje raspored/interakcija. v1.11 — poglavlje 2.0a (novo, 17.8.2026): vlasnik izabrao dve konkretne, stvarno instalirane/ugrađene VS Code teme kao izvor "Horizont v2" palete — "Material Theme High Contrast" (tamni) i "Light 2026" (svetli). HEX vrednosti izvučene direktno iz theme fajlova (ne iz sećanja), programski provereno protiv poglavlja 2a: pronađena i ispravljena jedna stvarna greška u izvoru — sekundarni tekst bočne trake tamnog moda (`#5f7a87` na `#192227`) je davao 3.56:1, pod čak i AA minimumom, posvetljen na `#9bb0bd` (7.19:1, AAA) pre upisa. v1.10 — dopuna 17.8.2026, isti dan kao v1.9: (a) paleta ostaje eksplicitno promenljiva, ne zaključana (poglavlje 2) — tehnički mehanizam to već obezbeđuje (centralni sloj CSS promenljivih), samo formalno zapisano na vlasnikov zahtev; (b) pravilo kontrasta (poglavlje 2a) pojačano — AAA (7:1) postaje stvarni cilj za sav telo-tekst/oznake, ne samo "gde je lako", na izričit zahtev vlasnika da čitljivost bude prioritet. v1.9 — vlasnikova odluka 17.8.2026 (referenca: snimci ekrana VS Code-a sa Claude Code panelom, priloženi uz odluku): **M7 (B2B portal) dobija identičan vizuelni/interakcioni obrazac kao M17** — razrešava dotad otvoreno pitanje iz poglavlja 8. Dodato: poglavlje 5b (tri-panelni raspored — levi navigator/stablo, centar prikaz, desni panel za izdvajanje detalja sa mogućnošću dva panela jedan pored drugog, isti obrazac kao VS Code split editor grupe), poglavlje 6c (AI razgovor — plutajući kontekst/dozvole iznad polja za unos, ne odvojen banner), dopuna poglavlja 2 (birač teme — VS Code MEHANIZAM biranja, ali sadržaj ostaje Terminal-ova sopstvena tamna/svetla paleta po kanalu, bez dodatnih imenovanih tema). Novo otvoreno pitanje (poglavlje 8): vlasnikov prošireni pregled uživo nad celim poslovanjem (Elastic/Kibana-stila) — namerno odloženo, vlasnik izričito rekao "još ćemo raditi na tome". v1.8 — tri vlasnikove odluke od 17.8.2026: (a) paleta sajta ispravljena po §2a (sedam parova je padalo AA u svetlom modu, dva u tamnom — vidi poglavlje 8), (b) **boja šljive je druga boja sajta**, zamenila zelenu umesto da se doda kao treća (poglavlje 2), (c) **sajt ide punom širinom ekrana**, sa izuzetkom za stranice koje se čitaju (novo poglavlje 6b). Dodato i poglavlje 2.0 — dokument je do sad beležio samo panelovu paletu, što je bio deo razloga zašto paleta sajta nikad nije prošla proveru. v1.7 — pravilo iz 1.6 sprovedeno kroz ceo panel (17 mesta, uključujući pet dugmadi kojima je padao tek hover), pa je stavka zatvorena i u backlogu; v1.6 — poglavlje 2a dopunjeno tvrdim pravilom "tekst na `accent-soft` je `accent-strong`, ne `accent`" (nalaz iz M17 live-provere 17.8.2026: `accent` na `accent-soft` daje 3.96:1 u svetlom modu i pada AA); v1.5 — dodato poglavlje 6a: obeležavanje autora radnje (čovek / AI agent / spoljni nalog) kao jedinstveno pravilo za sve kanale, na zahtev vlasnika (avgust 2026) — zatvara nalaz da je svaki ekran panela do sad izmišljao sopstveni način obeležavanja AI poteza; prati ga dopuna M17 poglavlje 3.1 i M19 poglavlja 2.3/9.5; v1.4 — dodato poglavlje 5a: tabovi za paralelan rad na više otvorenih zapisa/ekrana istovremeno (na zahtev vlasnika); v1.3 — dodato poglavlje 2a: kontrast teksta/ikonica je tvrd zahtev (WCAG AA minimum, AAA cilj gde je lako ostvarivo), proverava se lokalno protiv stvarne pozadine (ne jedne pretpostavljene), identično u oba moda — na izričit zahtev vlasnika; v1.2 — dodato poglavlje 3a (ikonografija — Codicons, rešava ranije otvoreno pitanje) i poglavlje 6 (sadržaj centralnog panela: isticanje pozadinom teksta, kartice, suptilne animacije), proširen opis bočne trake stablo-strukturom (poglavlje 5), sve na zahtev vlasnika (avgust 2026); v1.1 — dodat zahtev za obavezan tamni i svetli mod (poglavlje 2), ne samo tamni (avgust 2026, na zahtev vlasnika).

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

### 2.0a Konkretan izvor za Horizont v2 — dve postojeće VS Code teme (vlasnikova odluka, 17.8.2026)

Vlasnik je izabrao dve konkretne, stvarno postojeće VS Code teme kao tačan polazni izvor boja (ne inspiraciju napamet) — **"Material Theme High Contrast"** (`equinusocio.vsc-material-theme`, tema `Material-Theme-Default-High-Contrast.json`) za tamni mod, **"Light 2026"** (VS Code ugrađena, `theme-defaults/themes/2026-light.json`) za svetli mod. Vrednosti ispod su izvučene direktno iz tih fajlova (instalirana ekstenzija/ugrađena tema na razvojnoj mašini), ne iz sećanja — i programski provereno protiv pravila iz poglavlja 2a pre upisa ovde.

| Uloga | Tamni (Material High Contrast) | Svetli (Light 2026) |
| :---- | :---- | :---- |
| Pozadina (editor/glavni panel) | `#263238` | `#FFFFFF` |
| Bočna traka / gornja traka | `#192227` | `#FAFAFD` |
| Tekst (glavni) | `#EEFFFF` (12.77:1 na pozadini) | `#202020` (16.29:1 na pozadini) |
| Tekst — sekundaran (bočna traka) | `#5f7a87` **(3.56:1 — pada AA, ispravljeno)** → `#9bb0bd` (7.19:1) | `#606060` (6.29:1 na beloj) |
| Akcentna boja | `#80CBC4` (teal, 7.05:1 na tamnoj pozadini) | `#0069CC` (plava, 5.39:1 na beloj) |
| Tekst na akcentnoj pozadini | `#ffffff` | `#FFFFFF` (5.39:1 na `#0069CC`) |
| Ivica/border | `#3B4A51` | `#F0F1F2` |

**Jedna stvarna korekcija, ne kozmetička:** izvorna vrednost sekundarnog teksta bočne trake u tamnom modu (`#5f7a87`) daje samo **3.56:1** na `#192227` pozadini — pada čak i tvrdi AA minimum (poglavlje 2a), ne samo novi AAA cilj. Posvetljena je unutar iste hladne sivo-plave porodice na `#9bb0bd` (7.19:1) pre nego što je upisana ovde — pravilo iz poglavlja 2a se ne zaobilazi ni kad izvor konteksta dolazi od stvarne, poznate teme. Akcentna boja na svetloj pozadini (`#0069CC`, 5.39:1) prolazi AA sa marginom ali ne dostiže AAA (7:1) — prihvatljivo dok se koristi kao pozadina dugmeta/velika kontrolna površina (poglavlje 2a, 3:1 prag za takve elemente), ali **zahteva tamniju varijantu za inline tekstualni link** ako se pokaže potreba (isti `accent`/`accent-strong` par kao već uveden za M8 poglavlje 2a) — dorađuje se pri stvarnoj izradi ekrana.

Ova tabela je konkretna polazna vrednost ("Horizont v2") — ne menja pravilo ispod da paleta ostaje promenljiva, ne novo zaključavanje.

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

- **Gornja traka nosi grupe modula, kao ikonice** (izmenjeno 17.8.2026, na zahtev vlasnika — VS Code zvanično podržava ovu poziciju, `workbench.activityBar.location: "top"`, provereno u instaliranom VS Code-u pre odluke) — grupisano po funkciji (poglavlje 5c), ne pun spisak svih ~20 back-office sekcija odjednom. Administracija (korisnici/uloge, audit log) namerno na suprotnom kraju trake, isti princip kao VS Code zupčanik za podešavanja, odvojen od radnih grupa.
- **Leva traka nosi sadržaj izabrane grupe** — spisak sekcija te grupe, zatim stablo-struktura kad se jedna sekcija izabere (poglavlje 5c). Sekcije koje još nisu implementirane prikazuju se zaključane sa oznakom faze (M17 spec, poglavlje 7).
- **Stablo-struktura unutar leve trake** — hijerarhijski odnosi (npr. sekcija → njeni zapisi/filteri) prikazani istim vizuelnim jezikom kao VS Code Explorer/Source Control prikaz: tanke vertikalne linije koje povezuju ugnježđene stavke, strelice/ševroni (`chevron-right`/`chevron-down` iz Codicons) za sklapanje/rasklapanje grana, ne pune ilustracije ili boje po nivou.
- **Sadržaj u fokusu** — veći deo ekrana ostaje prazan/posvećen sadržaju, ne navigaciji. "Teško" i dalje ide kroz komandnu paletu (poglavlje 4), gornja/leva traka ostaju ikonice/kratki nazivi, ne gomila vidljivih dugmića.

---

## 5a. Tabovi — više otvorenih ekrana istovremeno

*(dodato avgust 2026, na zahtev vlasnika)*

Traka tabova iznad centralnog panela (ispod gornje trake, poglavlje 5) — isti obrazac kao VS Code/browser tabovi, **unutar same Terminal aplikacije** (ovo nisu tabovi browsera, nego tabovi unutar jedne stranice). Svaki tab je jedan otvoren zapis/ekran — npr. "Rezervacija #482", "Petrović — profil", "Finansijski izveštaj — avgust" — otvoren nezavisno, bez da se izgubi mesto na kom se stalo u prethodnom.

- **Otvaranje:** klik na rezultat komandne palete (poglavlje 4) otvara novi tab; navigacija unutar već otvorenog tab-a (npr. klik na gosta iz prikaza rezervacije) menja sadržaj **tog istog** taba, ne otvara novi automatski — novi tab je namerna radnja, ne posledica svakog klika.
- **Izuzetak — svaka nova pretraga je uvek nov tab** (dopuna, 18.8.2026, na zahtev vlasnika). Pravilo iznad ("navigacija unutar taba ne otvara novi") važi za **kretanje kroz već postojeći rezultat** (drill-down u zapis). Pokretanje **nove, nezavisne pretrage** je druga radnja i uvek otvara nov tab, bez obzira odakle je pokrenuta — klik na jednu od 9 ikonica pretrage u levom navigatoru (poglavlje 5b), ponovljena pretraga sa izmenjenim parametrima iz već otvorenog tab-a pretrage (npr. promena destinacije ili datuma unutar rezultata koji su već prikazani), ili predlog unakrsne prodaje (poglavlje 6d, M5 poglavlje 3.0e.1) koji otvara predpopunjenu pretragu. Razlog: rezultati pretrage su upoređujuća jedinica (agent često drži otvorene dve-tri pretrage jednu pored druge da uporedi ponude za istog gosta, isto poređenje-tabova ponašanje kao poglavlje 5b za desne panele) — gubljenje prethodnih rezultata pri svakoj novoj pretrazi bi to onemogućilo. Naziv taba prati sadržaj pretrage (npr. "Smeštaj — Budva, 12-19.8", ne generičko "Pretraga"), da agent razlikuje otvorene tabove na prvi pogled.
- **Zatvaranje/preuređenje:** dugme za zatvaranje na svakom tabu, prevlačenje (drag) za promenu redosleda, tastaturna prečica za ciklično prebacivanje (isti duh kao `Ctrl+Tab` u VS Code-u).
- **Indikator nesačuvane izmene** — tab sa formom koja ima neposlate izmene dobija malu tačku/oznaku, da se ne izgubi rad slučajnim zatvaranjem.
- **Otvoreni tabovi se pamte preko osvežavanja stranice** (lokalno, po sesiji) — slučajan refresh ili pad konekcije ne sme obrisati sve što je tim imao otvoreno, pogotovo pod pritiskom kad se radi sa gostom na telefonu.
- Svaki tab i dalje nosi sopstvene "mrvice" (breadcrumbs) ako je sadržaj ugnježđen — tabovi i breadcrumbs rešavaju različit problem (paralelan rad naspram dubine unutar jednog konteksta), ne zamenjuju jedno drugo.

---

## 5b. Tri-panelni raspored — navigator / prikaz / izdvajanje

*(dodato avgust 2026, na zahtev vlasnika — referenca: VS Code Explorer + editor + peek/split)*

Ceo radni prostor (ispod gornje trake, poglavlje 5; iznad/pored tabova, poglavlje 5a) deli se na tri funkcionalno odvojene zone, isti princip za M17 i M7 (poglavlje 7):

- **Levi panel — navigator, dva nivoa.** Gornji nivo je spisak **svih back-office modula** (isti spisak koji već postoji u `apps/panel/src/lib/nav.ts` — Katalog, Dobavljači i ugovori, Pretraga i rezervacije, Finansije, CRM, B2B, Izveštaji, Podrška, Marketing, Nadzor, Razgovori, Centar za pomoć, Email, Znanje, itd.). Klik na modul ga proširuje u stablo-strukturu (poglavlje 5) — isti vizuelni jezik kao VS Code Explorer/Source Control: tanke vertikalne linije, ševroni za sklapanje/rasklapanje. Sadržaj tog stabla je specifičan za modul (npr. "Pretraga i rezervacije" proširen pokazuje 9 ikona po vrsti proizvoda, ispod). Ovo je jedino mesto za pregledanje/pretragu; klik na stavku puni centralni panel, ne otvara novi prozor.
- **Centralni panel — prikaz.** Glavni sadržaj trenutno izabrane stavke (poglavlje 6). Ostaje najveći deo ekrana (poglavlje 5, "sadržaj u fokusu").
- **Desni panel — izdvajanje.** Detalj/kontekst *izveden* iz onoga što je otvoreno u centru (npr. istorija izmena zapisa, AI razgovor vezan za trenutni ekran, povezani zapisi drugog modula) — nikad nezavisna navigacija, uvek zavisi od centralnog panela. **Može se otvoriti drugi desni panel pored prvog** (isti obrazac kao VS Code split editor grupe — prevlačenje ili prečica otvara novu kolonu) — dva desna panela jedan pored drugog, ne jedan preko drugog.

Sve tri zone su sklopive/proširive nezavisno (VS Code obrazac) — zatvaranje levog panela kad tim samo čita jedan zapis, otvaranje drugog desnog panela kad treba paralelno pratiti dva izvedena prikaza.

**Pretraga proizvoda — stablo-grana unutar modula "Pretraga i rezervacije"** (dopuna 17.8.2026, na zahtev vlasnika; pojašnjeno istog dana da izbegne zabunu — devet ikona ispod NIJE zamena za spisak back-office modula, nego njegov podskup, tačno onako kako VS Code Explorer proširuje jedan otvoren folder, ne zamenjuje spisak projekata): kad se taj modul otvori/proširi u levom navigatoru, njegovo stablo nosi jednu ikonicu (Codicons, poglavlje 3a) po vrsti turističkog proizvoda — izbor otvara odgovarajuću vođenu pretragu u centralnom panelu. Konkretan tok polja/koraka/filtera za svaku definisan je u M5 spec poglavljima 3.0c/3.0d, ne ovde (ovaj dokument ostaje raspored/interakcija, M5 ostaje podaci/tok). Konačna lista ikona (potvrđeno 17.8.2026), sa napomenom gde ikonica ne odgovara 1:1 jednom `Product.type`:

| Ikonica | `Product.type` iza nje |
| :---- | :---- |
| Smeštaj | `ACCOMMODATION` |
| Letovi | `FLIGHT` |
| Transferi | `TRANSFER` |
| Rent-a-car | `TRANSPORT` (`transport_mode=RENT_A_CAR`) — sopstvena ikonica iako deli `Product.type` sa ostatkom prevoza (bus/voz/brod), jer su polja pretrage potpuno drugačija |
| Things to do | `EXCURSION` + `EVENT` + `TICKET` spojeno u jedan ekran (M5 poglavlje 3.0d.4) — tri tipa u pozadini, jedna ikonica |
| Individualni paketi | nije `Product.type` — otvara `Itinerary` tok (M5 poglavlje 3.0d.5), sastavljanje više pretraga u jedno putovanje |
| Grupni paketi | `PACKAGE` |
| Krstarenja | `CRUISE` (nov tip, M2 poglavlje 2.1/2.3, dodat 17.8.2026) |
| Putno osiguranje | `INSURANCE` |

---

## 5c. Gornja traka — grupe modula; leva traka — spisak pa skupljanje na izabranu stavku

*(dodato 17.8.2026, na zahtev vlasnika)*

Back-office ima ~20 sekcija (M17 spec poglavlje 4) — previše za jednu vertikalnu ili horizontalnu traku ikonica bez grupisanja. Rešenje u dva koraka:

1. **Gornja traka** nosi ~9 ikona, grupisanih po poslovnoj funkciji (tačan spisak grupa: M17 spec poglavlje 4a) — npr. "Prodaja" (Pretraga i rezervacije + Kalendar), "Finansije i pravno" (Finansije + Compliance + Ugovori sa klijentima), itd. Klik na grupu otvara njen spisak sekcija u levoj traci.
2. **Leva traka** prvo prikazuje spisak sekcija te grupe (obično 2-4 stavke). Klik na jednu sekciju **skuplja prikaz na samo tu sekciju** — ostale sekcije iz grupe se sklanjaju, ispod naziva izabrane sekcije pojavljuju se njena polja za pretragu/filtriranje (M17 spec poglavlje 4a, tačan spisak polja po sekciji) kao stablo-struktura. Mala strelica/breadcrumb na vrhu vraća na spisak sekcija te grupe (isti princip kao VS Code kad se izađe iz rezultata pretrage nazad na prazno stanje) — ne gubi se mesto grupe, samo se poništava izbor sekcije.

Ovaj obrazac važi identično za M17 i M7 (poglavlje 7) — grupisanje/spisak M7 portala ima sopstveni, uži skup sekcija (subagent ne vidi sve back-office module), ali mehanizam (grupa → spisak → skupljanje na izabranu stavku) je isti.

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

## 6c. AI razgovor — plutajući kontekst iznad unosa

*(dodato avgust 2026, na zahtev vlasnika — referenca: Claude Code panel unutar VS Code)*

Svaki ekran koji vodi razgovor sa AI agentom (M19 chat sa AI nacrtom, M21/M23 AI asistent, M15 omnisearch/komandna paleta) prati isti obrazac unosa kao Claude Code panel:

- **Polje za unos je fiksirano pri dnu desnog panela** (poglavlje 5b) ili centralnog panela kad je razgovor glavni sadržaj ekrana (npr. M21/M23 "pitaj asistenta") — ne pluta slobodno u sredini sadržaja.
- **Kontekst/dozvole/nagoveštaji se pojavljuju kao plutajući blok neposredno IZNAD polja**, ne kao poseban banner na vrhu ekrana ili modal — npr. koji zapis/modul je trenutni kontekst razgovora, kad AI predlaže radnju koja čeka ljudsku potvrdu (poglavlje 6a — bedž "AI" i pravilo da čovek mora da potvrdi pre slanja/objave), kratak predlog sledećeg pitanja. Blok nestaje kad nije relevantan (isti princip "skriveno dok nije potrebno" kao komandna paleta, poglavlje 4).
- **Traka mogućih režima/dozvola tik uz polje za unos** kad je primenjivo (npr. da li AI predlog čeka odobrenje iznad određenog iznosa, M7 poglavlje 2.0.4) — vidljiva, ne skrivena u meniju.

Ovaj obrazac ne menja pravila iz poglavlja 6a (obeležavanje autora) niti M15 poglavlje 6.5.4 (AI nikad sam ne izvršava radnju) — samo određuje **gde na ekranu** ta pravila postaju vidljiva.

---

## 6d. Rezultati pretrage — kartice/redovi, traka filtera, unakrsna prodaja

*(dodato 17.8.2026, na zahtev vlasnika — podaci/logika iza ovoga: M5 poglavlje 3.0c/3.0d/3.0e)*

- **Kartice** (poglavlje 6, isti vizuelni jezik) za tipove sa bogatim vizuelnim sadržajem — Smeštaj, Krstarenja, Grupni paketi, Things to do: slika, naziv, ključne činjenice, cena, dugme "Dodaj".
- **Kompaktni redovi** (tabela-stil) za tipove gde je brzo poređenje bitnije od slike — Letovi, Transferi, Rent-a-car: jedan red po ponudi (kompanija/vozilo, vreme, trajanje, cena), isti utisak kao Google Flights lista.
- **Traka filtera** iznad rezultata — cena, kategorija/zvezdice, usluga, sadržaji-tagovi (M5 poglavlje 3.0c.3), sortiranje. Skloniva/proširiva nezavisno od levog/desnog panela (isto pravilo kao poglavlje 5b).
- **AI pretraga unutar rezultata** (M5 poglavlje 3.0e.2) — polje na dnu centralnog panela, isti obrazac kao poglavlje 6c (plutajući kontekst iznad unosa); rezultat je osvežena/filtrirana lista nad istim rezultatima, ne nova pretraga.
- **Predlog unakrsne prodaje** ("da li želite da dodamo...", M5 poglavlje 3.0e.1) pojavljuje se **odmah po dodavanju stavke** u desni panel (vlasnikova odluka, 17.8.2026) — kao mali blok uz vrh desnog panela (isti "plutajući kontekst" duh kao poglavlje 6c), ne modal koji blokira ostatak ekrana. Prihvatanje otvara predpopunjenu vođenu pretragu za predloženi tip; odbijanje ga trajno uklanja za tu selekciju (ne ponavlja se).
- **Desni panel — cena i istek** (M5 poglavlje 3.0e.3): svaka stavka nosi pojedinačnu cenu; stavke iz `API` izvora nose vidljivo odbrojavanje isteka (`quote_expires_at`); zbir na dnu upozorava ako selekcija sadrži više valuta.

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
