# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu), kasnije M7 (B2B portal), M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.1 — dodat zahtev za obavezan tamni i svetli mod (poglavlje 2), ne samo tamni (avgust 2026, na zahtev vlasnika).

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

Tačne HEX vrednosti nisu fiksirane ovim dokumentom — biraju se/fino podešavaju pri izradi UI kod-baze (kontrast, pristupačnost) na osnovu ove polazne tačke, ne izmišljaju se unapred bez stvarnog ekrana na kom se proveravaju. Kontrast se posebno proverava za svetli mod — topla krem pozadina ne sme oslabiti čitljivost teksta.

**Tamni i svetli mod — oba se prave, na zahtev vlasnika (avgust 2026).** Tamni ostaje podrazumevani (prvi koji se implementira, prvi koji se testira), ali svetli mod nije opcioni "ako ikad zatreba" — obavezan je od starta.

- **Podrazumevano:** aplikacija prati podešavanje operativnog sistema korisnika (`prefers-color-scheme`) pri prvom otvaranju.
- **Ručni prekidač:** korisnik može eksplicitno da izabere tamni/svetli mod, nezavisno od sistemskog podešavanja — izbor se pamti (lokalno po uređaju/browseru je dovoljno za v1; sinhronizacija izbora preko više uređaja po nalogu nije pretpostavljena bez stvarne potrebe, vidi poglavlje 8).
- Prekidač živi u istom minimalnom duhu kao ostatak UI-ja (poglavlje 5) — ne traži poseban ekran podešavanja, dovoljna je jedna ikonica/stavka u komandnoj paleti (poglavlje 4) ili uglu gornje trake.

---

## 3. Tipografija

Čist, geometrijski sans-serif font (npr. Inter ili sistemski font stek — `-apple-system, Segoe UI, ...`) za sav UI tekst — čitljivost i brzina skeniranja ekrana su prioritet nad ukrasom. Monospace font rezervisan isključivo za tehnički/strukturiran sadržaj (ID-jevi, kod, JSON prikazi u audit logu) — ne za opšti UI tekst, za razliku od utiska koji VS Code inspiracija može da sugeriše.

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

- **Tanka bočna traka, samo ikonice** — moduli prikazani kao ikonice, ne puni nazivi; širi se na hover/klik. Moduli koji još nisu implementirani prikazuju se zaključani sa oznakom faze (M17 spec, poglavlje 7 — ovo već postoji kao ideja, samo se sad formalizuje vizuelno).
- **Gornja traka minimalna, jedna tanka linija** — bez gomile vidljivih dugmića; sve "teško" ide kroz komandnu paletu (poglavlje 4), ne kroz vidljive menije.
- **Sadržaj u fokusu** — veći deo ekrana ostaje prazan/posvećen sadržaju, ne navigaciji.

---

## 6. Pokret / mikro-interakcije

Suptilno i brzo — bez upadljivih animacija. Brzina i nisko kognitivno opterećenje imaju prioritet nad vizuelnim efektom (isti princip kao poglavlje 1).

---

## 7. Obim primene — samo M17 za sada

Ovaj dizajn sistem je pisan prvenstveno za **M17 (interni panel)** — okruženje za tim koji radi svaki dan, gde command-palette obrazac ima najviše smisla. **Namerno se ne pretpostavlja** da isti obrazac (skrivena komandna paleta, "power-user" interakcija) direktno odgovara i M8 (B2C sajt, gost koji retko koristi aplikaciju) ili M9 (mobilna aplikacija, dodirni ekran bez tastature) — ti kanali dobijaju sopstvenu primenu vizuelnog identiteta (boje, tipografija) kad dođu na red, ali ne nužno isti interakcioni obrazac. Ovo se rešava kad ti moduli dođu na red, ne pretpostavlja se ovde.

---

## 8. Otvoreno za dalje

- Tačne HEX vrednosti palete (za oba moda) — biraju se pri izradi prvog stvarnog ekrana, uz proveru kontrasta/pristupačnosti.
- Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17 (subagenti su takođe redovni, profesionalni korisnici) ili prilagođenu, jednostavniju verziju — otvoreno dok M7 UI ne dođe na red.
- Ikonski set (koja biblioteka ikonica) — bira se pri implementaciji.
- Da li izbor tamnog/svetlog moda treba da se sinhronizuje preko više uređaja po nalogu (zahteva backend polje, npr. na M1 `User`) ili ostaje lokalno po uređaju — v1 pretpostavlja lokalno, revidira se ako se pokaže potreba.
