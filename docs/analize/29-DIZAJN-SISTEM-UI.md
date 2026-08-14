# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu), kasnije M7 (B2B portal), M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.4 — dodato poglavlje 5a: tabovi za paralelan rad na više otvorenih zapisa/ekrana istovremeno (na zahtev vlasnika); v1.3 — dodato poglavlje 2a: kontrast teksta/ikonica je tvrd zahtev (WCAG AA minimum, AAA cilj gde je lako ostvarivo), proverava se lokalno protiv stvarne pozadine (ne jedne pretpostavljene), identično u oba moda — na izričit zahtev vlasnika; v1.2 — dodato poglavlje 3a (ikonografija — Codicons, rešava ranije otvoreno pitanje) i poglavlje 6 (sadržaj centralnog panela: isticanje pozadinom teksta, kartice, suptilne animacije), proširen opis bočne trake stablo-strukturom (poglavlje 5), sve na zahtev vlasnika (avgust 2026); v1.1 — dodat zahtev za obavezan tamni i svetli mod (poglavlje 2), ne samo tamni (avgust 2026, na zahtev vlasnika).

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
| Akcentna boja (jedina, ista u oba moda) | Topla narandžasta/rđa (amber) | Dugmad, aktivna stavka u bočnoj traci, otvorena `Ctrl+K` paleta, statusi koji traže pažnju — **namerno samo jedna** akcentna boja, da se izbegne šaren/haotičan utisak; ista boja radi na oba moda uz eventualno sitno podešavanje zasićenosti radi kontrasta |
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
- Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17 (subagenti su takođe redovni, profesionalni korisnici) ili prilagođenu, jednostavniju verziju — otvoreno dok M7 UI ne dođe na red.
- Da li izbor tamnog/svetlog moda treba da se sinhronizuje preko više uređaja po nalogu (zahteva backend polje, npr. na M1 `User`) ili ostaje lokalno po uređaju — v1 pretpostavlja lokalno, revidira se ako se pokaže potreba.
- Tačna paleta semantičkih boja za isticanje teksta (poglavlje 6) — upozorenje/greška/uspeh — bira se zajedno sa HEX vrednostima palete.
- Da li postoji gornja granica broja istovremeno otvorenih tabova (poglavlje 5a), i šta se dešava kad se dostigne — dorađuje se pri implementaciji ako se pokaže potreba.
