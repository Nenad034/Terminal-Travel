# Dizajn sistem — vizuelni i interakcioni jezik Terminal-a

**Status:** Nacrt za usvajanje — polazna tačka, dorađuje se kad UI kod stvarno počne (prvo M17)
**Odnosi se na:** svaki kanal koji ima korisnički interfejs — M17 (interni panel, prvi na redu) i M7 (B2B portal, isti obrazac — poglavlje 7), kasnije M8 (B2C sajt), M9 (mobilna aplikacija). Rešava "dizajnersko pitanje van obima" ostavljeno otvoreno u M17 specifikaciji (poglavlje 5.5, "Otvoreno za dalje").
**Nastalo:** avgust 2026, na zahtev vlasnika — polazna paleta boja potvrđena na osnovu slike koju je vlasnik podelio (par sa kišobranom, retro putni plakat stil).
**Verzija:** 1.56 — novo poglavlje 6f (28.8.2026, na zahtev vlasnika: "gde god je moguće izbegao bih padajuće menije, koristio bih formu tastera na koji se klikne za ono što želim ili dva klika za ono što ne želim"). Pravilo za nove ekrane: mali/poznat skup opcija → dugmad (jednostruk izbor: jedno aktivno, klik menja; višestruk izbor: klik uključuje/isključuje), ne `<select>`. Prvi primer: `RoomTypesEditor.tsx` (M2/M17). Retrofit postojećih padajućih menija namerno van obima ove dopune.
**Verzija:** 1.55 — tri dopune, isti dan kao v1.54, na zahtev vlasnika/uživo nalazi: (1) auto-kontekst taba i "#" na stavci menija sad postaju FILTERED_LIST (ne RECORD) kad ruta ima pravi `filter_list` pogled — ispravlja pogrešan odgovor "ne vidim sadržaj ekrana" na pitanje o broju rezervacija; (2) Fokus tab (§6c.0) sadržaj ograničen na 70% širine, centriran; (3) dugme za zatvaranje taba (poglavlje 5a) uvek na desnoj ivici, ne odmah uz kratak naziv. M17 spec v2.18.
**Verzija:** 1.54 — dve dopune, isti dan kao v1.53, na zahtev vlasnika: "#" oznaka sad postoji i na pojedinačnim stavkama unutar grupe u popup-u "Otvori modul" (ranije samo na nazivu modula), i `AiContextProvider.onFirstAdd` više ne otvara desni panel kad je korisnik već u Fokus tabu (`/ai-asistent`) — bio je suvišan/zbunjujuć dupli prikaz AI chat-a. M17 spec v2.17.
**Verzija:** 1.53 — dve dopune, isti dan kao v1.52, na zahtev vlasnika uz snimke ekrana: (1) red za unos dobija JEDNU tanku donju liniju — na samom `<input>` elementu (Material-stil podvučen unos), ne okvir oko cele trake ikonica; (2) svaki red naziva modula (grupe) u popup-u "Otvori modul" (§6c.0a) dobija na desnom kraju ikonicu "#" (`symbol-number`) — klik dodaje CEO modul kao RECORD stavku u AI kontekst, ne zatvara popup, isti mehanizam kao ikonica po redu tabele (§6c.1a). M17 spec v2.16.
**Verzija:** 1.52 — četiri dopune poglavlja 6c.0b i 6c.0, isti dan kao v1.51 (na zahtev vlasnika): ručno prevlačiva granica AI/sadržaj sekcija u desnom panelu (procenat visine, pamti se po korisniku); dugme "Fokus" premešteno iz reda za unos u gornji desni ugao zaglavlja AI sekcije; ista, ručno podesiva širina desnog panela u "push" i "overlay" režimu (podignuto na 420px); mikrofon premešten neposredno ispred strelice "Pošalji". M17 spec v2.15.
**Verzija:** 1.51 — dopuna poglavlja 6c.0a, isti dan kao v1.50 (uživo nalaz uz snimak ekrana): popup "Otvori modul" je bio ravna lista svih modula — sad grupisan po `NAV_GROUPS` (isto kao Sidebar), naziv grupe podebljan i bez linka, klikaju se samo stavke unutar grupe. M17 spec v2.14.
**Verzija:** 1.51 — dopuna poglavlja 6h (2.9.2026, isti dan, na zahtev vlasnika: "kod svakog sektora postaviti ikonu linka da se taj sektor u celosti otvori u odgovarajućem tabu"): ikona `link-external` u traci naslova SVAKE sekcije koja ima svoju karticu, ne samo skraćenih — izlaz na pun prikaz stoji uvek na istom mestu. Ikona je postojeća konvencija panela za "sažetak → pun zapis", ne nova; nosi `title`/`aria-label` sa nazivom kartice jer je bez teksta. Sekcija bez sopstvene kartice ("Povezano", "Vlasništvo i zaduženje") namerno ostaje bez ikone — veza koja vodi na približno tačno mesto gora je od nepostojeće. Broj uz ikonu (`svi (12)`) i dalje se prikazuje samo kad je spisak skraćen na skrol.

**Verzija:** 1.50 — ispravka i dve dopune poglavlja 6c.0, isti dan kao v1.49, na osnovu uživo probe uz snimak ekrana: red za unos je pogrešno ostao pri vrhu (ispravljeno), istorija razgovora sad raste odozdo nagore, 4 brze prečice uklonjene i zamenjene novim poglavljem 6c.0a ("Otvori modul" — popup sa svim modulima, nagore), novo poglavlje 6c.0b (sklapanje jedne od dve naslagane sekcije u desnom panelu), strelica "Pošalji" u bojama loga (fiksan preliv, isti kao TopBar logo). M17 spec v2.13.
**Verzija:** 1.50 — dve dopune poglavlja 6h (2.9.2026, isti dan, na zahtev vlasnika). (a) Naslov sekcije postaje **traka u nijansi `--panel-2`** preko cele širine, umesto teksta sa linijom ispod — ista nijansa koju već koriste zaglavlja tabela i bočni paneli, dakle postojeći signal "ovo je zaglavlje", ne nova boja. (b) Sekcija sa **više od pet redova** se skraćuje na skrol sa **nevidljivom trakom** (`tt-scroll-hidden`), uz **obavezan** link `svi (N) →` u zaglavlju ka kartici tog sektora. Link nije ukras: pošto je traka nevidljiva, broj u njemu je jedini signal da ispod ima još sadržaja — skraćivanje bez linka je zabranjeno. Visina skrola prati visinu reda te sekcije, ne jedna vrednost za sve, da peti red ne bude presečen na pola.

**Verzija:** 1.49 — novo poglavlje 6c.0 (25.8.2026, na zahtev vlasnika, posle razgovora o nekoliko alternativa — centrirani modal odbačen, ovo je konačna odluka): AI chat napušta plutajući prozor u uglu i postaje STALAN, dokovan deo desnog panela (poglavlje 5b), naslagan ISPOD postojećeg sažetka/podsetnika (ne tabovi, oba vidljiva odjednom). Dva nova mehanizma: (a) izbor po korisniku "sužava sadržaj" naspram "prelazi preko sadržaja" (`UserPreference` ključ `right_panel_display_mode`); (b) "Fokus" režim — ikonica otvara AI chat u punom, novom tabu (ceo centralni prostor), isti obrazac kao Claude Code panel u VS Code kad zauzima ceo ekran. `CommandPalette` ostaje nepromenjen i odvojen (vlasnikova eksplicitna odluka) — AI chat ne dobija duplikat spiska menija. M17 spec v2.12.
**Verzija:** 1.49 — novo poglavlje 6h (2.9.2026, na zahtev vlasnika: "da li smatrate da je ovo malo teško za oko šta gde da gleda jer je vizuelno sve isto"): ekran pojedinačnog zapisa dobija tvrdo pravilo o **tri nivoa težine** (sažetak → sekcija → red) umesto desetak jednakih kartica, sa odnosom veličina brojeva i oznaka najmanje 2:1, dve kolone na širokom ekranu i retkim radnjama van vrha ekrana. Prvo primenjeno SAMO na karticu Pregled ekrana rezervacije, uz privremen prekidač koji vraća zatečeni izgled dok vlasnik ne odluči — izgled koji izgubi se briše iz koda zajedno sa prekidačem. Uz to i jedan nalaz koji nije estetski: "PREOSTALO −256,00 EUR" bilo je prikazano zelenom bojom, iako negativan ostatak znači da je gost preplatio i da neko mora da reaguje — boja je saopštavala suprotno od stvarnog stanja, sada je zasebna oznaka `PREPLAĆENO` u boji upozorenja.

**Verzija:** 1.48 — novo poglavlje 6c.1a (25.8.2026, na zahtev vlasnika: "da li mozete na desni klik da ubacite u ai agenta bilo koju rezervaciju iz liste rezervacija kao kontekst... prosirite ovo i na sve module... umesto desnog klika moze i neka oznaka"): mala, generička ikonica "Dodaj u AI kontekst" na SVAKOM redu/kartici u SVAKOM modulu (ne desni klik — nema dodirni ekvivalent, nije vidljiv bez znanja da postoji), podržava dodavanje VIŠE zapisa pre postavljanja pitanja (poređenje) i prilaganje sačuvanog/trenutno filtriranog prikaza cele liste kao posebne kontekstne stavke. Podatkovni deo (šta se šalje agentu, ograničenja): M15 spec §6.5.4.3 (v1.40). M17 spec v2.11.
**Verzija:** 1.48 — novo poglavlje 5c.1 (2.9.2026, na zahtev vlasnika: "kada je levi panel zatvoren i u bočnoj levoj traci se pojave samo ikone, kada prelazimo mišem preko ikona, pojaviti i plutajuće podmenije"): skupljena leva traka dobija plutajući meni sa sekcijama grupe na prelazak mišem ili fokus tastaturom. Do sada se, dok je traka skupljena, spisak sekcija nije mogao videti bez ponovnog širenja — pa je skupljanje trake značilo dobijen prostor uz izgubljenu navigaciju. Meni poštuje prava pristupa (M17 spec §3) i redosled iz proširene trake; grupa sa jednom sekcijom dobija meni od jednog reda koji zamenjuje sistemski tooltip (koji se tada namerno ne postavlja, da se ne pojave dva prikaza iste stvari).

**Verzija:** 1.47 — poglavlje 5b "sažetak reda" implementiran za rezervacije (23.8.2026), M5 spec v1.46. Nova otvorena stavka: dizajn "pun zapis" forme za rezervacije, čeka predlog.
**Verzija:** 1.47 — dopuna poglavlja 6b.1 (2.9.2026, isti dan, na zahtev vlasnika: "pozicija tabova treba da prati veličinu prikaza, logika kao i u prikazu 100%"): traka tabova dobija isti pomeraj kao suženi centralni sadržaj, pa prvi tab i dalje stoji tačno na njegovoj levoj ivici. Bez ovoga je izbor uže širine razbijao poravnanje koje je §5c gradio kroz tri pokušaja 23.8.2026. Poravnava se samo leva ivica — traka i na punoj širini ide do polja za pretragu, preko prostora desnog panela, i to se ne menja. Pomeraj se MERI (`ResizeObserver` nad `<main>`-om), ne računa iz širine bočne trake i stanja desnog panela — isti zaključak i isti razlog kao kod merenja širine leve kolone.

**Verzija:** 1.46 — novo poglavlje 2.0e (23.8.2026): svetli mod dobija treću nijansu (`--bar`, trake tamnije od bočnih panela, centralni sadržaj tamniji od čiste bele ali svetliji od bočnih panela), `apps/panel/tailwind.config.ts` i `TopBar.tsx`/`StatusBar.tsx`/`TerminalPanel.tsx` ožičeni.
**Verzija:** 1.46 — novo poglavlje 6b.1 (2.9.2026, na zahtev vlasnika: "omogućiti ko to želi da se u centralnom panelu širina prikaza podesi na manju širinu"): centralni sadržaj panela dobija lični izbor gornje granice širine — Puna širina (podrazumevano, nepromenjeno ponašanje) / 1680 / 1440 / 1280px. Namerno **granica**, ne procenat: procenat oduzima prostor i na uskom ekranu, što je bio razlog zašto je raniji `w-[90%]` ukinut 29.8.2026 — granica deluje samo kad prostora ima više od nje. Donja vrednost (1280px) nije birana po osećaju nego po najširem stvarnom sadržaju u panelu: lista rezervacija ima 11 kolona i ispod ~1250px počinje da ih stiska. Izbor stoji u postojećem "Customize Layout" meniju (§5f) kao zasebna grupa i pamti se u `UserPreference` (M1 §3.9, ključ `main_content_max_width`), dakle po nalogu a ne po browseru. Usput ispravljena netačnost u §5f: taj odlomak je tvrdio da se vidljivost panela pamti kroz `UserPreference`, a u kodu je `localStorage` — tačno stanje sada upisano, prelazak na backend zaveden kao otvorena stavka (§8).

**Verzija:** 1.45 — poglavlje 5f dopunjeno (23.8.2026): podela terminal panela na dva nezavisna panela (VS Code "Split Terminal" obrazac), M17 spec v1.97.
**Verzija:** 1.45 — `--border` vraćen iznad 3:1 praga u sva tri moda (2.9.2026, vlasnik izabrao "Prag" varijantu posle uporednog prikaza četiri jačine po modu). Zatvara regresiju otkrivenu u v1.44: prelaz na shadcn 29.8.2026. vratio je granice na doslovne Tailwind vrednosti i time poništio ispravku od 21.8.2026, koja je nastala na vlasnikovu prijavu "jedva se vide okvirne linije sadržaja u centralnom delu". Svetli (`#858c92`) i tamni (`#748088`) vraćaju istu vrednost koja je stajala od 21. do 29.8.2026 — stanje koje je vlasnik već prihvatio, ne novo pooštravanje; dim mod nije postojao u avgustu, pa je za njega birana prva stepenica slate skale koja prolazi na sve tri podloge (`#94a3b8`, slate-400 — slate-500 pada na `--panel-2`). **Usput ispravljena greška u sopstvenom merenju iz v1.44:** kontrast granice je bio meren samo protiv `--panel` i `--bg`, a granica se pojavljuje i na `--panel-2` (bočni panel) gde je najslabija — u svetlom modu 1.15:1, ne 1.27:1 kako je v1.44 prijavila. Isti propust protiv kog upozorava §2a; `tools/check-contrast.js` je od tada meri protiv sve tri podloge. Vrednosti upisane u svih pet blokova tokena, uz komentar u `globals.css` da je to namerno odstupanje od doslovne Tailwind vrednosti (bez njega sledeća zamena palete ponavlja isti krug — zamka 1.9). Posle ove izmene **sve provere prolaze**. Preostala otvorena stavka iz iste porodice: `--bar` u svetlom modu (§2.0e).

**Verzija:** 1.44 — poglavlje 5a dopunjeno (23.8.2026): "+" pojednostavljen na prazan tab (ne direktno pretraga), više tabova iste putanje kao opšta sposobnost, M17 spec v1.94. Logo premešten sa dna Sidebar-a u gornju traku (isti M17 spec unos) — ovaj dokument nema poseban logo-odeljak, samo M17 changelog.
**Verzija:** 1.44 — usklađivanje poglavlja 2 sa stvarnim kodom (2.9.2026, na zahtev vlasnika: "Uskladi"). Dokument je od 29.8.2026. opisivao paletu koju aplikacija više ne koristi — prelaz na **shadcn/ui (Tailwind zinc + indigo)** nije bio upisan u prolazu u kom je napravljen, pa su §2, §2.0a–§2.0e i §8 pokazivali maslinasti/GitHub Light/amber vrednosti iz tri prethodne generacije palete. Dodato **novo poglavlje 2.0f** kao jedini izvor istine za boje panela: puna tabela tokena za sva **tri** moda (svetli/dim/tamni — dim je dodat 29.8.2026, dokument je do sad znao samo za dva) sa izmerenim kontrastom po paru. Poglavlja 2.0a–2.0e zadržana kao istorija, ali svako sa uvodnom oznakom šta je u njemu potisnuto a šta i dalje važi (obrazloženja i pravila važe, HEX vrednosti ne). Iz §8 uklonjena tabela palete "Horizont" sa amber akcentom — vrednosti potisnute još 17.8.2026, nikad ažurirane. Ispravljene i tri manje netačnosti zatečene usput: "panel ostaje na jednoj akcentnoj boji" (u kodu postoji i `--accent2` teal sa sopstvenom ulogom), "svaki kanal ima jednu tamnu i jednu svetlu varijantu" (panel ih ima tri), i odlomljen red tabele u §2.0 bez zaglavlja. Dodata skripta **`tools/check-contrast.js`** — dokument je od 17.8.2026. pominjao "kontrast-skriptu" koja nikad nije bila u repozitorijumu (pisana iznova u svakoj sesiji i bacana, pa nijedan raniji rezultat nije bio ponovljiv); sada čita tokene direktno iz `globals.css`, meri svaki par u sva tri moda, kompozituje poluprovidne vrednosti preko podloge i poredi dva svetla bloka međusobno (zamka 1.7). **Nalaz iz prvog pokretanja te skripte:** `--border` pada 3:1 prag u sva tri moda (1.27:1 / 1.70:1 / 1.93:1) — prelaz na shadcn je poništio ispravku od 21.8.2026. koja je nastala na vlasnikovu prijavu da se okvirne linije jedva vide; isto je delimično poništeno i sa `--bar` (§2.0e). Nije ispravljeno u ovom prolazu jer menja izgled svakog ekrana i traži vlasnikovu odluku — upisano kao otvorena stavka u §8 i kao zamka 1.9.

**Verzija:** 1.43 — poglavlje 5f dopunjeno (23.8.2026): kopiranje poruka + segmentacija po turi + kartica odobrenja za web fetch, M15 spec §6.9.6/§6.9.7, M17 spec v1.92. Ostatak poglavlja 5f nepromenjen.
**Verzija:** 1.43 — dopuna poglavlja 2.0 (2.9.2026, na zahtev vlasnika: "u Light modu sve ikone i sva slova treba da budu za 30% tamnija"): zahtev primenjen CILJANO umesto ravnomerno — `--text-dim` i `--text-faint` potamnjeni ×0,7, `--text` i `--icon-line` namerno nepromenjeni, sa izmerenom tabelom kontrasta po tokenu i obrazloženjem (ravnomerno tamnjenje skuplja razmake među nivoima teksta i ruši hijerarhiju; najtamniji token je već na 16.97:1 pa ne dobija ništa vidljivo). Vlasnik izabrao ovu varijantu posle uporednog prikaza sve četiri. Dve nove zamke upisane u `33-ZAMKE-I-OBAVEZNE-PROVERE.md` (1.7 — svetli mod se definiše u DVA bloka `globals.css`, izmena jednog radi samo pola vremena; 1.8 — "sve za X% tamnije" ruši hijerarhiju teksta). Zabeležen i poznat nedostatak zatečen u ovom prolazu: §2.0a/§2.0 i dalje opisuju maslinasti akcent i GitHub Light neutralne boje, dok je implementacija 29.8.2026 prešla na shadcn/ui paletu — taj prelaz nikad nije upisan u ovaj dokument i traži zaseban prolaz.

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

> **Gde je izvor istine.** Tekuća paleta panela (M17/M7) je **shadcn/ui — Tailwind "zinc" neutralne + "indigo" akcent**, u tri moda (svetli / dim / tamni). Sve stvarne vrednosti, sa izmerenim kontrastom, su u **§2.0f**. Poglavlja 2.0a–2.0e ispod ostaju kao **zapis istorije** (kako se do tekuće palete došlo i koje greške su usput ispravljene) — njihove HEX vrednosti više NISU tekuće; njihova **pravila i obrazloženja jesu** i dalje na snazi. Paleta sajta (M8, "Zalazak") je odvojena i nije dirana ovim prelazom — §2.0.

Panel je do 29.8.2026. prošao kroz tri izvora inspiracije (VS Code teme → GitHub Light → shadcn/ui). To nije lutanje nego posledica pravila iz ovog istog poglavlja ("paleta ostaje promenljiva, ne zaključana") — svaki prelaz je vlasnikova odluka, svaki je prošao proveru iz §2a. Ono što se **nije** menjalo ni jednom: boje žive isključivo kao centralni sloj CSS promenljivih, pa je svaki od tih prelaza bio izmena vrednosti tokena, ne prepravka UI koda.

| Uloga | Tekuća vrednost (svetli / tamni) | Napomena |
| :---- | :---- | :---- |
| Osnovna pozadina | `#fafafa` / `#09090b` | Tailwind zinc-50 / zinc-950. Treći mod "dim" koristi slate skalu, §2.0f |
| Akcentna boja (glavna, **različita po modu**) | `#4f46e5` / `#818cf8` | Tailwind indigo-600 / indigo-400. Dugmad, aktivna stavka u bočnoj traci, otvorena `Ctrl+K` paleta, ivica aktivnog taba. **Zamenila maslinastu `#8A8A5E`** 29.8.2026 (§2.0f) — time je i pravilo "ista u oba moda" iz §2.0b prestalo da važi za panel |
| Sekundarni akcent (panel) | `#0f766e` / `#5eead4` | Tailwind teal. Kalendar, katalog, audit log — namerno drugi ton od indigo brenda da ostane razdvojiv kao drugi signal |
| Boja linija ikonica (samo svetli mod) | `#1f3a5f` "navy teget" | Vlasnikov zahtev 21.8.2026; **preživelo sve promene palete** kao zasebna odluka, §3a |
| Druga boja — **samo na sajtu (M8)**, boja šljive | Modro-plava (šljiva) | Vlasnikova odluka 17.8.2026, **nepromenjeno** — sajt ima sopstvenu paletu. Uloga: sve što nije glavna radnja — sekundarna dugmad, oznake, akcenti na deljenim stranicama. Glavna radnja ("Rezerviši", "Plati") ostaje topla, jer ona mora da vuče oko; kad bi obe boje vukle jednako, ni jedna ne bi. Zamenila je zelenu (`--accent2`), **nije se dodala kao treća** — zelena je do tada bila upotrebljena na jednom jedinom mestu, pa nije bila stvarna druga boja identiteta nego ostatak. |

**Koliko akcentnih boja:** panel (M17) ima **jednu brend boju** (indigo) i **jedan sekundarni signal** (teal, `--accent2`) sa usko određenom ulogom — kalendar/katalog/audit log. Ranija formulacija ovog poglavlja ("panel ostaje na jednoj") opisivala je stanje pre nego što je `--accent2` dobio stvarne potrošače; ispravljeno 2.9.2026 prema kodu. Pravilo iza toga se nije promenilo: druga boja sme da postoji samo dok ima **sopstvenu, imenovanu ulogu** — čim bi počela da se koristi "za lepše", vratili bismo se na šaren ekran na kom čitalac ne zna šta je važno. Sajt (M8) ima dve sa jasno razdvojenim ulogama (gore). Treće nema ni jedan kanal.

**Komponentna biblioteka.** Od 29.8.2026. panel koristi **shadcn/ui + Radix UI** nad Tailwind-om (master dokument, poglavlje 6) — generator koji kopira izvorni kod komponente u repo (`apps/panel/src/components/ui/`), ne zatvorena biblioteka sa tuđim CSS-om. Zato paleta i komponente sad dolaze iz istog vizuelnog jezika, umesto da se tuđe komponente premazuju sopstvenim bojama.

### 2.0 Dve palete, ne jedna — i zašto se to skoro izgubilo

Panel i sajt **imaju odvojene palete** i to je namerno (različita publika, različit utisak): panel je shadcn/ui paleta (neutralan zinc + indigo akcent, §2.0f — ranije nazivana "Horizont", ime je prestalo da odgovara sadržaju posle prelaza 29.8.2026. i više se ne koristi), sajt je "Zalazak" (topla peščana, `apps/web/src/app/globals.css`, nepromenjena). Ovaj dokument je do 17.8.2026. beležio **samo panelovu** — i to je bio deo razloga zašto paleta sajta nikad nije prošla proveru iz poglavlja 2a i zašto je sedam parova padalo AA prag (vidi poglavlje 8). **Svaka nova paleta se upisuje ovde u istom prolazu kad nastane**, ne posle.
Tekst, sekundarni elementi i ivice u obe palete su neutralni sivi tonovi izvedeni iz osnove tog kanala — svetli u tamnom modu, tamni u svetlom — da paleta deluje kao jedna porodica boja, ne kao nabacane komponente. *(Ovaj red je do 2.9.2026. stajao kao odlomljen red tabele iz poglavlja 2, bez zaglavlja i van konteksta — posledica ranije izmene koja je tabelu skratila a red ostavila; pretvoren u rečenicu, sadržaj nepromenjen.)*

Tačne HEX vrednosti panela **jesu** fiksirane, u §2.0f — ranija formulacija ("nisu fiksirane ovim dokumentom, biraju se pri izradi UI kod-baze") bila je tačna dok koda nije bilo, i upravo je ona omogućila da se paleta u kodu tri puta promeni bez ijednog traga u ovom dokumentu. Od 2.9.2026. važi obrnuto: **svaka promena vrednosti tokena u `globals.css` upisuje se u §2.0f u istom prolazu**, sa izmerenim kontrastom, isto pravilo kao za svaku drugu cross-referencu u repozitorijumu.

### 2.0a Konkretan izvor za Horizont v2 — dve postojeće VS Code teme (vlasnikova odluka, 17.8.2026; potvrđeno 19.8.2026)

> **ISTORIJA (nadživelo prelaz na shadcn/ui, 29.8.2026 — vidi §2.0f).** HEX vrednosti u ovom poglavlju **nisu tekuće**. Ostaje kao zapis odakle je paleta krenula i, važnije, kao izvor za **strukturne** odluke koje shadcn prelaz NIJE dirao — kako izgleda aktivan tab, kako se boji selekcija/hover u listama, zašto je aktivna ivica taba u svetlom modu crna a ne akcentna. Ti obrasci i dalje važe; samo boje kojima su ispunjeni dolaze sad iz §2.0f.

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
| Aktivan tab — ivica/tekst | Ivica `#80CBC4` **(izvorna VS Code vrednost — u implementaciji zamenjena bojom brenda: maslinastom do 29.8.2026, indigo od tada, §2.0f)**, tekst `#FFFFFF`; neaktivan tab tekst `#5f7a87` | Gornja ivica `#000000` (**crna, ne akcentna** — VS Code svetli mod signalizira aktivan tab crnom linijom, ovo ostaje nepromenjeno) |
| Selekcija teksta (pozadinsko bojenje) | `#80CBC420` **(izvorno — u implementaciji ista logika sa bojom brenda, §2.0f)** | `#0069CC40` **(izvorno — u implementaciji ista logika sa bojom brenda, §2.0f)** |
| Red pod hoverom (lista/stablo) | `#192227` (**puna boja**, ista kao bočna traka — ne providan sloj; hover ne koristi akcent, nepromenjeno) | `#00000014` (crna, providna, 8%; nepromenjeno) |
| Izabran red (lista/stablo) | Pozadina `#192227` (puna), **tekst postaje akcentna boja** — izvorno `#80CBC4`, u implementaciji zahteva po-modu nijansu maslinaste (poglavlje 2.0b, jedini izuzetak) | Pozadina `#00000025` (crna, providna, 15%), tekst ostaje `#202020` (nepromenjeno) |

Razlika u aktivnoj ivici taba (akcent u tamnom, crna u svetlom) i providno-crno/belo pravilo za hover/selekciju su namerno preuzeti tačno ovako — to je stvarna VS Code odluka, ne nešto što bi ovaj dokument sam izmislio da izgleda slično. Redovi označeni "izvorno" ostaju tačan opis kako VS Code to radi (reference); stvarna implementacija koristi boju brenda umesto literalne VS Code akcentne boje — do 29.8.2026. maslinastu (§2.0b), od tada indigo (§2.0f).

### 2.0b Akcentna boja postaje jedinstvena, maslinasta — ne više po VS Code temi (dopuna, 19.8.2026, na zahtev vlasnika)

> **ISTORIJA (potisnuto 29.8.2026 — vidi §2.0f).** Maslinasta `#8A8A5E` **više nije brend boja panela**; zamenio ju je indigo `#4f46e5` / `#818cf8`. Time je palo i pravilo "ista akcentna boja u oba moda" — shadcn paleta namerno koristi tamniju indigo nijansu u svetlom i svetliju u tamnom modu, jer jedna te ista zasićena boja ne može istovremeno da nosi beo tekst na sebi u jednom modu i taman u drugom (isti problem koji je ovo poglavlje ispod opisuje kao "jedini izuzetak"). Deo koji **i dalje važi**: princip da je akcent boja brenda, a ne literalna vrednost preuzeta iz izvorne teme — zato indigo nije "shadcn-ova vrednost" nego Terminal-ov izbor koji se ne menja sa svakom promenom izvorne inspiracije.

**Odluka:** akcentna boja (uloga iz poglavlja 2 — dugmad, aktivna stavka, ivica aktivnog taba, `Ctrl+K` paleta, značke) prestaje da bude literalna VS Code vrednost po modu (`#80CBC4` tamni / `#0069CC` svetli) i postaje **jedna, ista maslinasta boja u oba moda: `#8A8A5E`**. Ovo je svesno odstupanje od "doslovno VS Code" pravila iz poglavlja 2.0a — **struktura/ponašanje** (raspored, tabovi, hover/selekcija mehanika) ostaje VS Code vernost, ali **boja** postaje Terminal-ova sopstvena, tačno onako kako vodeća ideja dokumenta oduvek kaže (poglavlje 1: "razlikovanje ide kroz vizuelni identitet, ne kroz interakciona pravila").

**Zašto ista boja u oba moda nije trivijalno** — WCAG kontrast formula fizički ne dozvoljava da jedna boja bude čitljiv **tekst** i na skoro-crnoj i na skoro-beloj pozadini istovremeno (matematička nemogućnost, ne izbor). Rešeno razdvajanjem po nameni:

- **Pozadina/ispuna (dugme, ivica taba, značka, tačka)** — sam `#8A8A5E` radi identično u oba moda, jer ovde važi blaži prag 3:1 (poglavlje 2a, "velika kontrolna površina"), ne 4.5:1 za tekst. Provereno: 3.68:1 na tamnoj pozadini (`#263238`), 3.57:1 na svetloj (`#FFFFFF`) — oba iznad praga.
- **Tekst na akcentnoj pozadini — jedna, ista tamna boja, bez izuzetka po veličini** (ispravka 19.8.2026, na zahtev vlasnika — "ne sviđa mi se bela, potamnite slova"): `#14140D` (skoro crn), **5.88:1 na `#8A8A5E`, isto u oba moda i na svakoj veličini teksta** — dugme, značka, oznaka svi koriste identičnu kombinaciju, bez posebnog pravila za krupan/podebljan tekst.
- **Jedini preostali izuzetak: tekst izabranog reda u levoj traci** (mehanizam iz Material Theme-a gde se selekcija signalizira bojom teksta, ne samo pozadinom, poglavlje 2.0a) — sitan tekst na sirovoj pozadini panela, ne može da koristi identičan `#8A8A5E` u oba moda (isti matematički razlog kao iznad). Ovde se zadržava po-modu nijansa iste maslinaste porodice (tamnija za svetli mod, svetlija za tamni) — **tačne vrednosti se biraju/proveravaju pri izradi ekrana**, isti princip kao svaka druga boja u ovom dokumentu (poglavlje 2a), ne pogađaju se unapred.
- **Selekcija teksta (pozadinsko bojenje, `mark`/highlight)** — nasleđuje istu logiku kao izvorna VS Code vrednost (providan sloj preko postojeće pozadine), samo sa maslinastim tonom umesto teal/plave: `#8A8A5E20` (tamni), `#8A8A5E40` (svetli) — isti mehanizam, nova boja.

**Van obima ove odluke** — pozadine, granice i tekst boje (poglavlje 2.0a glavna tabela) ostaju nepromenjene, literalno iz Material Theme/Light 2026 — menja se isključivo uloga "akcentna boja".

Ova tabela je bila konkretna polazna vrednost ("Horizont v2") — nije menjala pravilo ispod da paleta ostaje promenljiva, ne novo zaključavanje. Da je to pravilo stvarno važilo pokazuju tri kasnija prelaza; tekuće vrednosti su u §2.0f.

### 2.0c Semantička "upozorenje" (warn) boja ispravljena (21.8.2026, na zahtev vlasnika)

> **ISTORIJA (vrednosti potisnute 29.8.2026 — vidi §2.0f).** Maslinasto-zlatni `#6b6b1f` zamenjen je Tailwind amber-700 (`#b45309` svetli / `#fbbf24` tamni) uz prelaz na shadcn paletu. **Nalaz zbog kog ovo poglavlje postoji i dalje je aktuelan i najvredniji deo:** tekst semantičke oznake mora se meriti protiv **sopstvene pill pozadine** (`--warn-bg`), ne protiv `--bg`/`--panel` — propust koji je tada dao 3.82:1. Tekuća vrednost je ponovo merena upravo tako (4.84:1, §2.0f) i `tools/check-contrast.js` sada tu proveru radi automatski, da se isti propust ne može ponoviti tiho.

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

> **Ova ispravka je bila poništena prelaskom na shadcn (29.8.2026), pa ponovo sprovedena 2.9.2026 — vidi dopunu na kraju poglavlja.** Sam nalaz i obrazloženje ispod ostaju tačni i tekući; menjaju se samo brojevi, jer su podloge druge nego u avgustu.

Vlasnik je, uz snimak ekrana (linije oko kartica u centralnom delu, M6 CRM zapis), prijavio: "Jedva se vide okvirne linije sadrzaja u centralno delu. Potamnite ih za 15%." Provera je pokazala da `--border` (`#f0f1f2` svetli mod) daje samo **1.13:1** na belu pozadinu — daleko ispod 3:1 praga za granice iz poglavlja 2a, stvaran propust koji je postojao od uvođenja Horizont v2 palete, ne samo suptilna pritužba. Doslovnih "-15%" na vrednost ovoliko blizu bele (`240→204` po RGB kanalu) bi dalo tek **1.57:1** — praktično nepromenjeno, jer procenat od skoro-bele vrednosti ne pomera kontrast dovoljno da bude vidljiv. Umesto doslovnog izračuna, izabrana je vrednost koja stvarno prolazi 3:1 prag (isti standard primenjen na svaku drugu granicu u ovom dokumentu):

| Mod | Bilo | Sad | Kontrast na `bg` |
| :---- | :---- | :---- | :---- |
| Svetli | `#f0f1f2` (1.13:1 ❌) | `#858c92` | 3.41:1 |
| Tamni | `#3b4a51` (1.43:1 ❌) | `#748088` | 3.25:1 |

Tamni mod nije bio deo pritužbe (snimak je svetli mod), ali je imao isti stvaran propust pri proveri — ispravljen u istom prolazu, ista logika kao svaka druga token-ispravka ovog dana (jedan izvor istine, nema mod koji ostaje slučajno drugačiji). Ovo je deljen token — primenjeno svuda gde se `--border` koristi (kartice, forme, padajući meniji, `kbd` oznake), ne samo dashboard kartice sa snimka.

**Dopuna 2.9.2026 — ispravka poništena pa vraćena, i jedna greška u prvom merenju.** Prelaz na shadcn 29.8.2026. vratio je `--border` na doslovne Tailwind vrednosti i time ponovo uveo tačno problem iz ovog poglavlja. Otkriveno pri usklađivanju dokumenta sa kodom, prvim pokretanjem `tools/check-contrast.js`.

Pri pripremi uporednog prikaza otkrivena je i greška u **prvom** merenju ove regresije (i u originalnoj tabeli iznad): meren je kontrast samo protiv `--panel` i `--bg`, a granica se pojavljuje i na **`--panel-2`** (bočni panel, `Sidebar.tsx`/`RightPanel.tsx`) — i tamo je najslabija. To je isti propust protiv kog upozorava §2a ("meri se protiv svake podloge uz koju se pojavljuje") i isti oblik greške kao onaj iz §2.0c. Merodavan je najgori od tri broja:

| Mod | Bilo (posle prelaza) | na `panel` / `bg` / `panel-2` | Sad | na `panel` / `bg` / `panel-2` |
| :---- | :---- | :---- | :---- | :---- |
| Svetli | `#e4e4e7` (zinc-200) | 1.27 / 1.22 / **1.15 ❌** | `#858c92` | 3.41 / 3.26 / **3.10 ✅** |
| Tamni | `#3f3f46` (zinc-700) | 1.70 / 1.91 / **1.43 ❌** | `#748088` | 4.38 / 4.91 / **3.68 ✅** |
| Dim | `#475569` (slate-600) | 1.93 / 2.36 / **1.37 ❌** | `#94a3b8` (slate-400) | 5.71 / 6.96 / **4.04 ✅** |

Svetli i tamni vraćaju **istu vrednost** koja je stajala od 21. do 29.8.2026 — dakle stanje koje je vlasnik već video i prihvatio, ne novo pooštravanje. Dim mod nije postojao u avgustu, pa je za njega birana prva stepenica slate skale koja prolazi na sve tri podloge (slate-500 pada na `--panel-2`, 2.18:1). Vlasniku su ponuđene četiri jačine po modu sa uporednim prikazom; izabrana je najmanja koja prolazi prag ("Prag" varijanta), ne najizraženija.

Vrednosti su upisane u **svih pet** blokova tokena (`:root`, `prefers-color-scheme: dark`, `[data-theme='dark']`, `[data-theme='light']`, `[data-theme='dim']`) i uz svaku stoji komentar u `globals.css` da je to **namerno odstupanje od doslovne Tailwind vrednosti** — bez tog komentara sledeća zamena palete ponavlja isti krug (zamka 1.9).

### 2.0e Svetli mod dobija TREĆU nijansu — trake tamnije od bočnih panela (23.8.2026, na zahtev vlasnika)

> **ISTORIJA (vrednosti potisnute 29.8.2026 — vidi §2.0f).** Sam **zahtev i dalje važi i sprovoden je**: `--bar` postoji kao poseban token i u shadcn paleti. Ali se tri nijanse svetlog moda više ne razlikuju kao tada — tekuće vrednosti su `--panel` `#ffffff`, a `--panel-2` i `--bar` **oba** `#f4f4f5`, dakle traka i bočni panel su ponovo iste boje. Vlasnikov zahtev iz 23.8.2026 ("sve trake neka budu za nijansu tamnije od svega") time je delimično poništen prelazom, isto kao granica u §2.0d. Manje vidljivo od granica, pa je i to otvorena stavka (§8), ne tiho prećutano.

Vlasnik je, posle uživo pregleda: "previse je svetla bela pozadina centralnog panela u ligjht modu, zatamnite ga malo a da bide svetlije od levog i desnog panela. sve trake neka budu za nijansu tamnije od svega." Do sada je svetli mod imao samo DVE nijanse — `--panel` čisto bela (`#FFFFFF`, centralni sadržaj) i `--panel-2` (`#FAFAFD`, praktično nerazlučivo od bele) za SVE ostalo, trake I bočne panele zajedno. Sad tri, namerno odstupanje od poglavlja 2.0a glavne tabele (koja i dalje beleži izvorne VS Code "Light 2026" vrednosti kao referentnu tačku, ne kao trenutno stanje ovog tokena):

| Nivo | Token | Vrednost | Koristi ga |
| :---- | :---- | :---- | :---- |
| Najsvetliji | `--panel` (= `--bg`, ostaju namerno jednaki, poglavlje 6b/v1.45 razlog) | `#FFFFFF` (GitHub Light `bgColor.default`, dopuna 26.8.2026 ispod) | Centralni sadržaj (`<main>`, aktivan tab) |
| Srednji | `--panel-2` | `#F6F8FA` (GitHub Light `bgColor.muted`) | Levi/desni bočni panel (`Sidebar.tsx`, `RightPanel.tsx`, `ActivityBar.tsx`) |
| Najtamniji | `--bar` (nov token) | `#EFF2F5` (sledeći korak GitHub-ove sopstvene neutralne skale, `base.color.neutral.2` — GitHub sâm nema treći nivo, ovaj projekat ga zahteva od 23.8.2026) | Gornja/donja traka (`TopBar.tsx`, `StatusBar.tsx`), unutrašnje zaglavlje terminal panela (`TerminalPanel.tsx`) |

Tamni mod nije tražio treću nijansu — `--bar` tamo dobija istu vrednost kao `--panel-2` (`#192227`), token postoji svuda (nijedna `bg-bar` klasa ne ostaje bez definisane promenljive), ali se ništa vizuelno ne menja. `--bg` menja vrednost zajedno sa `--panel` (isti par, namerno jednaki, v1.45 razlog — margina oko `w-[90%]` glavnog sadržaja ne sme da izgleda kao vidljiva "kutija" drugog tona).

**Dopuna 26.8.2026, na zahtev vlasnika ("GitHub Light kontrast, ovo podesi za light mode").** Izvor svetlog moda menja se sa "VS Code Light 2026" (§2.0a) na **GitHub Light** — konkretan primer ove sekcije ("Paleta ostaje promenljiva, ne zaključana jednom zauvek", iznad) primenjen u praksi. Obim: SAMO neutralne pozadine/granice/tekst i status boje (uspeh/upozorenje/greška); akcentna boja OSTAJE maslinasta `#8A8A5E` (potvrđeno preko `AskUserQuestion` — brend boja, poglavlje 2.0b princip se ponavlja, ne menja se sa svakom promenom izvorne inspiracije). Tamni mod NIJE dotaknut. Vrednosti povučene direktno iz zvaničnog GitHub Primer izvora koda (`primer/primitives` na GitHub-u, `src/tokens/base|functional/color/*`), ne iz sećanja — `globals.css` komentar uz `:root`/`:root[data-theme='light']` navodi tačan token po tačnu vrednost. Jedno namerno odstupanje od doslovne GitHub vrednosti: `--border` NIJE GitHub-ovo `borderColor.default` (#D1D9E0, samo 1.43:1 na belu) — birana je sledeća, tamnija stepenica IZ ISTE GitHub sive skale (`base.color.neutral.8`, #818B98, 3.45:1), isti razlog i isti obrazac kao originalna 21.8.2026 potamnjena granica ispod — GitHub Light kao referenca ne sme oboriti tvrd 3:1 prag ovog dokumenta (§2a).

**Dopuna 2.9.2026, na zahtev vlasnika ("u Light modu sve ikone i sva slova treba da budu za 30% tamnija").** Zahtev je primenjen **ciljano, ne ravnomerno** — odluka vlasnika posle uporednog prikaza sve četiri varijante (postojeće stanje / ciljano / sve −15% / sve −30%) sa izmerenim kontrastom po tokenu:

| Token | Bilo | Sada | Kontrast na `--bg` (#fafafa) | na `--panel-2` (#f4f4f5) |
|---|---|---|---|---|
| `--text` | `#18181b` | **nepromenjeno** | 16.97:1 | 16.12:1 |
| `--text-dim` | `#3f3f46` | `#2c2c31` | 10.01:1 → **13.31:1** | 9.50:1 → **12.64:1** |
| `--text-faint` | `#63636a` | `#45454a` | 5.71:1 → **9.13:1** | 5.42:1 → **8.67:1** |
| `--icon-line` | `#1f3a5f` | **nepromenjeno** | 11.00:1 | 10.45:1 |

Dva tokena su namerno ostavljena netaknuta, i to je suština odluke, ne izuzetak od nje. `--text` je već na 16.97:1 — ×0,7 bi dao 18.07:1, razliku koju oko ne registruje, a sva tri nivoa teksta bi se stisnula ka crnom i **hijerarhija (glavni / prigušen / slab) bi se izgubila**; to je jedini realan rizik ovakve izmene i jedini razlog da se ne primeni ravnomerno. `--icon-line` bi tamnjenjem izgubio prepoznatljiv "navy teget" ton koji je sam po sebi bio vlasnikov zahtev (21.8.2026, §3a) — to je estetska, ne kontrastna odluka i traži poseban zahtev. Smer izmene je isključivo naviše, pa nijedan AA prag (§2a) ne može da padne. Izmena je upisana u **oba** svetla bloka u `globals.css` — `:root` (prati OS) i `:root[data-theme='light']` (ručni prekidač); prepisivanje samo prvog je zamka koja daje promenu koja nestane čim korisnik izabere svetli mod dugmetom (zabeleženo u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`).

### 2.0f Tekuća paleta — shadcn/ui (zinc + indigo), tri moda (29.8.2026; upisano u dokument 2.9.2026)

**Ovo je jedini izvor istine za boje panela.** Sve iznad (§2.0a–§2.0e) je istorija kako se do ovoga došlo.

**Kako je nastalo.** Vlasnik je 29.8.2026. izabrao shadcn/ui posle vizuelnog poređenja tri kandidata na istom ekranu (M17 "Rezervacije" mockup): Fluent UI React, PatternFly i shadcn/ui + Radix UI — obrazloženje izbora je u master dokumentu, poglavlje 6. Odluka nije bila samo "uzmi njihove komponente" nego **usvoji ceo vizuelni jezik**, pa je maslinasta `#8A8A5E` prestala da bude brend boja. Prvi prolaz migracije namerno nije dirao boje (da se ništa ne pokvari pre potvrde); vlasnik je javio da ne vidi razliku — očekivano — pa je drugi prolaz zamenio stvarne vrednosti tokena.

**Zašto je promena bila jeftina.** Nijedna komponenta nije menjana zbog boje. Tokeni su CSS promenljive u jednom fajlu, pa je izmena ~100 linija promenila izgled svih ~60 ekrana panela odjednom — isti mehanizam koji poglavlje 2 opisuje kao "paleta ostaje promenljiva".

**Tri moda, ne dva** (dopuna istog dana, na zahtev vlasnika). Pored svetlog i tamnog dodat je **"dim"** — isti koncept kao Twitter/X Dim: tamna atmosfera ali plavkasto-siva, ne crna. Namerno koristi **slate** skalu umesto zinc, da bude sopstveno stanje a ne "tamni, malo svetliji". Nema `prefers-color-scheme` granu (operativni sistem ne signalizira tri stanja) — dostupan je isključivo preko ručnog prekidača, `ThemeToggle.tsx`, ciklusom svetli → dim → tamni.

| Token | Svetli | Dim | Tamni | Uloga |
| :---- | :---- | :---- | :---- | :---- |
| `--bg` | `#fafafa` | `#0f172a` | `#09090b` | Osnovna pozadina |
| `--panel` | `#ffffff` | `#1e293b` | `#18181b` | Centralni sadržaj, kartice |
| `--panel-2` | `#f4f4f5` | `#334155` | `#27272a` | Bočni paneli |
| `--bar` | `#f4f4f5` | `#334155` | `#27272a` | Gornja/donja traka *(u svetlom modu trenutno jednako `--panel-2` — §2.0e)* |
| `--border` | `#858c92` | `#94a3b8` | `#748088` | Granice — **namerno odstupanje od doslovne Tailwind vrednosti** da prođe 3:1 na sve tri podloge, §2.0d |
| `--text` | `#18181b` | `#f8fafc` | `#fafafa` | Glavni tekst |
| `--text-dim` | `#2c2c31` | `#cbd5e1` | `#d4d4d8` | Prigušen tekst |
| `--text-faint` | `#45454a` | `#a3b0c2` | `#a1a1aa` | Slab tekst, zaglavlja kolona, datumi |
| `--accent` | `#4f46e5` | `#818cf8` | `#818cf8` | Brend boja, glavna radnja |
| `--accent-strong` | `#4338ca` | `#a5b4fc` | `#a5b4fc` | Tekst na `--accent-soft` (tvrdo pravilo §2a) |
| `--accent-soft` | `#4f46e533` | `#818cf833` | `#818cf833` | Meka podloga akcenta (20% alfa) |
| `--accent-ink` | `#ffffff` | `#0b1120` | `#0b0b0f` | Tekst na punom akcentu |
| `--accent2` / `-soft` | `#0f766e` / `#0f766e1a` | `#5eead4` / `#5eead41a` | `#5eead4` / `#5eead41a` | Sekundarni signal — kalendar, katalog, audit log |
| `--ok` / `--ok-bg` | `#15803d` / `#f0fdf4` | `#4ade80` / `#0d1f13` | `#4ade80` / `#0d1f13` | Uspeh |
| `--warn` / `--warn-bg` | `#b45309` / `#fffbeb` | `#fbbf24` / `#241a06` | `#fbbf24` / `#241a06` | Upozorenje |
| `--danger` / `--danger-bg` | `#b91c1c` / `#fef2f2` | `#f87171` / `#240b0b` | `#f87171` / `#240b0b` | Greška |
| `--icon-line` | `#1f3a5f` | `currentColor` | `currentColor` | Navy linije ikonica, samo svetli mod (§3a) |

**Izmereni kontrasti** (`node tools/check-contrast.js --all`, 2.9.2026 — najgori slučaj po tokenu, tj. protiv najnepovoljnije pozadine uz koju se pojavljuje):

| Par | Svetli | Dim | Tamni | Prag |
| :---- | :---- | :---- | :---- | :---- |
| `--text` na površinama | 16.12:1 | 9.90:1 | 14.27:1 | 4.5:1 |
| `--text-dim` na površinama | 12.64:1 | 6.97:1 | 10.08:1 | 4.5:1 |
| `--text-faint` na površinama | 8.67:1 | 4.71:1 | 5.81:1 | 4.5:1 |
| `--icon-line` na površinama | 10.45:1 | — | — | 3:1 |
| `--accent-ink` na `--accent` (dugme) | 6.29:1 | 6.31:1 | 6.59:1 | 4.5:1 |
| `--accent-strong` na `--accent-soft` | 5.82:1 | 5.33:1 | 6.55:1 | 4.5:1 |
| `--ok` / `--warn` / `--danger` na svojim pill pozadinama | 4.79 / 4.84 / 5.91 | 9.86 / 10.27 / 6.73 | 9.86 / 10.27 / 6.73 | 4.5:1 |
| `--border` (najgore od tri podloge) | 3.10:1 | 4.04:1 | 3.68:1 | 3:1 |

**Sve prolazi** (stanje od 2.9.2026, kad je i poslednji par — `--border` — vraćen iznad praga, §2.0d). Tri mesta su najbliža padu i zaslužuju pažnju pri svakoj sledećoj izmeni: `--border` u svetlom modu na bočnom panelu (3.10:1, prag 3), `--text-faint` u dim modu (4.71:1, prag 4.5) i `--ok` u svetlom (4.79:1). Sve tri vrednosti su ručno pomerene sa doslovne Tailwind vrednosti upravo zato što je doslovna padala — zato uz svaku stoji komentar u `globals.css`; bez njega ih sledeća zamena palete tiho vraća (zamka 1.9).

**Pravilo §2a i dalje ima razlog da postoji.** `--accent` na `--accent-soft` (zabranjena kombinacija) daje 4.63:1 u svetlom, ali **4.38:1 u tamnom i 3.56:1 u dim modu** — i dalje pada. Zato ostaje tvrdo pravilo: na mekom akcentu ide `--accent-strong`, nikad `--accent`, u svakom modu i u svakom stanju (uključujući hover).

**Paleta ostaje promenljiva, ne zaključana jednom zauvek** (potvrđeno 17.8.2026, na izričit zahtev vlasnika). Tehnički mehanizam ovo već obezbeđuje bez dodatnog rada — boje žive isključivo kao centralni sloj CSS promenljivih (isti sloj koji poglavlje 2 birač teme i M7 poglavlje 2.0.5 `SubagentBranding` već koriste), nikad utkane direktno u komponente. Promena tona/nijanse palete panela ili sajta je u svakom trenutku izmena vrednosti tog sloja, ne prepravka UI koda — uz jedini uslov da svaka nova vrednost ponovo prođe proveru iz poglavlja 2a pre nego što se smatra gotovom. Prelaz na shadcn paletu 29.8.2026. to je i potvrdio u praksi: ~100 izmenjenih linija u jednom fajlu promenilo je izgled svih ~60 ekrana, bez ijedne izmenjene komponente. **Ali** je isti taj prelaz pokazao i cenu te lakoće — tiho je poništio dve ranije ručne ispravke (§2.0d, §2.0e), jer nova paleta ne zna da one postoje. Zato od 2.9.2026. uz svaku zamenu cele palete ide obavezno ponovno pokretanje `tools/check-contrast.js` i prolaz kroz §2.0a–§2.0e, ne samo provera novih vrednosti.

**Tamni i svetli mod — oba se prave, na zahtev vlasnika (avgust 2026).** Tamni ostaje podrazumevani (prvi koji se implementira, prvi koji se testira), ali svetli mod nije opcioni "ako ikad zatreba" — obavezan je od starta.

- **Podrazumevano:** aplikacija prati podešavanje operativnog sistema korisnika (`prefers-color-scheme`) pri prvom otvaranju.
- **Ručni prekidač:** korisnik može eksplicitno da izabere tamni/svetli mod, nezavisno od sistemskog podešavanja — izbor se pamti (lokalno po uređaju/browseru je dovoljno za v1; sinhronizacija izbora preko više uređaja po nalogu nije pretpostavljena bez stvarne potrebe, vidi poglavlje 8).
- Prekidač živi u istom minimalnom duhu kao ostatak UI-ja (poglavlje 5) — ne traži poseban ekran podešavanja, dovoljna je jedna ikonica/stavka u komandnoj paleti (poglavlje 4) ili uglu gornje trake.

**Birač teme — VS Code mehanizam, Terminal sadržaj** (vlasnikova odluka 17.8.2026). Isti UX obrazac kao VS Code "Color Theme" birač — otvara se iz komandne palete ili gornje trake, potvrda menja temu odmah bez ponovnog učitavanja. **Sadržaj liste NIJE proizvoljan skup tema** (za razliku od VS Code Dark+/Light+/Monokai/itd.) — kanal ima tačno određen, mali skup varijanti, svaka provereno WCAG AA (poglavlje 2a). Birač daje poznat, brz način da se između njih pređe — ne otvara vrata dodatnim, neproverenim paletama.

**Panel od 29.8.2026. ima TRI varijante, ne dve** — svetli / dim / tamni (§2.0f). To je upravo slučaj koji je ranija formulacija ovog odlomka predviđala ("ako se pokaže stvarna potreba za više od dve varijante, to je nova odluka i nova AA provera za svaku") — vlasnik je tražio dim, sve tri su merene, pravilo je poštovano. Sajt (M8, "Zalazak") i dalje ima dve. Sam prekidač je u praksi ispao jednostavniji od VS Code liste: **jedno dugme koje cikluše svetli → dim → tamni** (`ThemeToggle.tsx`), sa sopstvenom ikonicom i naslovom po stanju — na tri opcije lista sa pregledom ne nosi svoju cenu. Izbor se pamti u `localStorage` i primenjuje pre prvog iscrtavanja (`THEME_INIT_SCRIPT` u `layout.tsx`) da nema treptaja pogrešne teme pri učitavanju.

---

## 2a. Kontrast — obavezno pravilo, ne preporuka

*(dodato avgust 2026, na izričit zahtev vlasnika — "vrlo važno da se ne nerviram kasnije")*

Ovo nije estetska preporuka nego **tvrd, merljiv zahtev**, isti duh kao "Izlazni kriterijum" u Nivo 2 specifikacijama — ne prolazi dok se ne proveri, ne "izgleda dobro na oko".

- **Standard: WCAG 2.1 nivo AA, kao apsolutni minimum** — najmanje **4.5:1** kontrast za običan tekst, **3:1** za veliki tekst/ikonice/granice UI elemenata. AA je granica ispod koje ništa ne sme proći, ne cilj sam po sebi.
- **Ponovo potvrđeno 17.8.2026, na izričit zahtev vlasnika: čitljivost teksta u oba moda je prioritet, ne granični uslov.** Za sav telo-tekst i oznake (ne samo "gde je lako") cilja se **AAA (7:1)** kao stvarni cilj pri biranju/podešavanju HEX vrednosti (poglavlje 2) — 4.5:1 se tretira kao pod koji se ne sme pasti, ne kao vrednost ka kojoj se teži. Ako neka kombinacija teksta/pozadine mora da bira između "malo tamnija akcentna boja" i "manji kontrast", bira se čitljivost.
- **Proverava se lokalno, protiv stvarne pozadine iza teksta u tom trenutku — ne protiv jedne pretpostavljene "opšte" pozadine aplikacije.** Aplikacija ima više nijansi pozadine i unutar istog moda (glavni panel, bočna traka, kartice iz poglavlja 6, hover stanje, otvorena komandna paleta) — svaka od njih je **posebna provera**, jer isti tekst koji je čitljiv na tamnijoj pozadini može biti nečitljiv na svetlijoj kartici iznad nje, i obrnuto.
- **Važi identično za tamni i svetli mod** — nijedan mod se ne tretira kao "manje bitan"; oba prolaze isti test pre nego što se smatraju gotovim.
- **Isto pravilo važi za linije/ikonice** (Codicons, poglavlje 3a) koliko i za tekst — ikonica koja se jedva vidi na svojoj pozadini je isti problem kao nečitljiv tekst.
- **Tekst na `accent-soft` pozadini mora biti `accent-strong`, nikad `accent`** — nalaz iz live-provere (17.8.2026, M17 §3.1). Sprovedeno kroz ceo panel (17 mesta). Brojevi iz tog nalaza (`3.96:1` na maslinastoj paleti) više nisu tekući, ali **pravilo je ponovo mereno na indigo paleti 2.9.2026 i i dalje je potrebno**: `accent` na `accent-soft` daje 4.63:1 u svetlom (prolazi za dlaku), ali **4.38:1 u tamnom i 3.56:1 u dim modu** — pada. `accent-strong` daje 5.82 / 6.55 / 5.33:1. Pravilo važi i za **hover stanje**: dugme sa `text-accent hover:bg-accent-soft` prolazi u mirovanju, a pada čim se pređe mišem — zato je `accent-strong` podrazumevana boja za svaki element koji `accent-soft` može dobiti kao pozadinu, u bilo kom stanju i u bilo kom modu.
- **Provera se pokreće skriptom, ne prepisuje se iz sećanja: `node tools/check-contrast.js`** (dodato 2.9.2026). Čita tokene direktno iz `apps/panel/src/app/globals.css`, meri svaki tekstualni token protiv **svake** površine uz koju se pojavljuje, u sva tri moda; poluprovidne vrednosti (`--accent-soft`) prvo spušta na podlogu ispod njih, jer merenje protiv same alfa vrednosti daje besmislen broj. Takođe upoređuje `:root` sa `:root[data-theme='light']` (zamka 1.7 — svetli mod je definisan na dva mesta). Izlazi kôdom 1 ako bilo koji par padne prag, pa može stajati u CI-ju. Do 2.9.2026. ovaj dokument je više puta pominjao "kontrast-skriptu" koja **nikad nije bila u repozitorijumu** — pisana je iznova u svakoj sesiji i bacana, pa nijedan raniji rezultat nije bio ponovljiv.
- **Postaje stavka izlaznog kriterijuma kad UI kod počne** (ne samo namera u ovom dokumentu) — svaka nova kombinacija teksta/ikonice i pozadine koja se doda mora proći ovu proveru pre nego što se smatra završenom, isto pravilo kao "Izlazni kriterijum = definicija gotovo" iz CLAUDE.md.

---

## 3. Tipografija

Čist, geometrijski sans-serif font (npr. Inter ili sistemski font stek — `-apple-system, Segoe UI, ...`) za sav UI tekst — čitljivost i brzina skeniranja ekrana su prioritet nad ukrasom. Monospace font rezervisan isključivo za tehnički/strukturiran sadržaj (ID-jevi, kod, JSON prikazi u audit logu) — ne za opšti UI tekst, za razliku od utiska koji VS Code inspiracija može da sugeriše.

### 3b. Skala veličine slova — obavezno pravilo, ne preporuka (dopuna, 26.8.2026, na zahtev vlasnika)

*Vlasnik je uživo prijavio da su slova u banerima pretrage smeštaja premala i tražio: "hajde da standardizujemo velicinu slova u celoj aplikaciji u zavisnosti sta se opisuje... Heder, Footer, paneli". Pregled koda je potvrdio uzrok — nijedan korak veličine nije postojao u `globals.css`; svaka komponenta je birala `text-xs`/`text-sm` ili sirove Tailwind proizvoljne vrednosti (`text-[9px]`, `text-[10px]`, `text-[11px]`) nezavisno, bez zajedničkog pravila — otud vidljiva nedoslednost kroz ekrane. Vlasnik je preko `AskUserQuestion` potvrdio predloženu skalu i odlučio da se primeni u jednom sistematičnom prolazu kroz ceo panel (ne postepeno, modul po modul).*

**Četiri nivoa, po NAMENI sadržaja — ne po tome koji je ekran/traka u pitanju:**

| Nivo | Veličina | Tailwind klasa | Za šta |
| :---- | :---- | :---- | :---- |
| Naslov | 16px | `text-base` | Naslov stranice (npr. `$ rezervacije/lista`), naslov modala |
| Sekcija | 14px | `text-sm` | Naslovi panela (npr. "AI asistent", "Sažetak reda"), naslovi grupa u bočnoj traci, isticanje unutar sadržaja |
| Sadržaj | 12px | `text-xs` | **Podrazumevano za sve ostalo** — tabele, kartice, forme, baneri, dugmad, Header/Footer trake, bočni paneli. Header/Footer NISU poseban, manji nivo — razlika prema "Naslovu"/"Sekciji" se pravi težinom fonta i bojom (`font-medium`/`text-ink` naspram `text-ink-faint`), ne dodatnim korakom veličine. |
| Sitno | 11px | `text-[11px]` | ISKLJUČIVO značke/pilule (status boje, npr. PAID/CONFIRMED) i sporedni podaci gde prostor stvarno nedostaje (vremenske oznake, brojači u zagradi). **Donja granica cele aplikacije — ništa ne sme biti manje od ovoga.** |

**Tvrdo pravilo: `text-[9px]` i `text-[10px]` se više NIGDE ne koriste** — ispod su praga normalne čitljivosti za rad ceo radni dan (osoblje agencije, ne povremen posetilac). Svako postojeće mesto koje ih koristi prelazi na `text-[11px]` (ako je stvarno bedž/sporedan podatak) ili `text-xs` (ako je stvarno sadržaj — najčešći slučaj u praksi, pregled koda pri uvođenju ovog pravila pokazao je da je većina "sitnih" oznaka u banerima/karticama zapravo sadržaj, ne bedž).

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
- **Ispravka (25.8.2026, na zahtev vlasnika: "x za zatvaranje tabova stavite u desni kraj a ne iza teksta odmah")** — dugme za zatvaranje je sad UVEK na desnoj ivici taba, bez obzira na dužinu naziva (naziv puni preostali prostor, `flex-1`, i dalje se seče na `truncate` kad ne stane) — ranije je kod kratkih naziva "x" sedeo odmah uz tekst, sa praznim prostorom do ivice, nedosledno u odnosu na tabove sa dužim, isečenim nazivima.

---

## 5b. Tri-panelni raspored — navigator / prikaz / izdvajanje

*(dodato avgust 2026, na zahtev vlasnika — referenca: VS Code Explorer + editor + peek/split)*

Ceo radni prostor (ispod gornje trake, poglavlje 5; iznad/pored tabova, poglavlje 5a) deli se na tri funkcionalno odvojene zone, isti princip za M17 i M7 (poglavlje 7):

- **Levi panel — navigator, dva nivoa.** Gornji nivo je spisak **svih back-office modula** (isti spisak koji već postoji u `apps/panel/src/lib/nav.ts` — Katalog, Dobavljači i ugovori, Pretraga i rezervacije, Finansije, CRM, B2B, Izveštaji, Podrška, Marketing, Nadzor, Razgovori, Centar za pomoć, Email, Znanje, itd.). Klik na modul ga proširuje u stablo-strukturu (poglavlje 5) — isti vizuelni jezik kao VS Code Explorer/Source Control: tanke vertikalne linije, ševroni za sklapanje/rasklapanje. Sadržaj tog stabla je specifičan za modul (npr. "Pretraga i rezervacije" proširen pokazuje 9 ikona po vrsti proizvoda, ispod). Ovo je jedino mesto za pregledanje/pretragu; klik na stavku puni centralni panel, ne otvara novi prozor. **Sačuvani prikazi** (dopuna, 18.8.2026, na zahtev vlasnika — isti obrazac kao Salesforce/HubSpot/Attio) — na bilo kojoj listi (poglavlje 6d, ili lista bilo kog drugog modula) korisnik može da sačuva trenutnu kombinaciju filtera pod imenom (npr. "Rezervacije koje čekaju fiskalni dokument") — sačuvan prikaz se pojavljuje kao dodatna stavka u stablu te sekcije, lično po korisniku, ne deljeno (deljenje sa timom je moguće prošireno izdanje, ne ovde). **Implementirano 24.8.2026** za "Lista rezervacija" (M5 spec v1.56) — `SavedViewsSidebarPanel.tsx`, oslonjen na novi M1 `UserPreference` (M1 spec v1.8); ostale liste (npr. M14 tiketi, M6 CRM) čekaju svoj prolaz istim obrascem kad se ukaže potreba.
- **Centralni panel — prikaz, uvek "radna površina" trenutno izabrane stavke.** Ako je iz levog navigatora izabrana lista (npr. "Rezervacije", "Profakture"), centar prikazuje **tu listu** — kartice/redovi/tabela, isti obrazac kao poglavlje 6d. Ako se iz liste (ili taba, poglavlje 5a) uđe u pojedinačan zapis, centar prikazuje **pun** taj zapis. Centar ostaje najveći deo ekrana (poglavlje 5, "sadržaj u fokusu").
- **Desni panel — izdvajanje, uvek skraćena/izvedena verzija, nikad zamena za centar.** Kad je centar lista i korisnik klikne na jedan red **bez** da uđe u pun zapis, desni panel prikazuje **sažetak ključnih polja** tog reda (dopuna, 18.8.2026, na zahtev vlasnika — npr. broj rezervacije/profakture, gost, datum, status, iznos) — lista u centru ostaje otvorena, nepromenjena. **Implementirano 23.8.2026** za rezervacije (M5 spec v1.46) — `RowSummaryContext.tsx`, `RightPanel.tsx` `BookingSummary`; polja proširena na destinaciju/hotel/tip smeštaja/putnike/uplaćeno/dug, ne samo minimalna petorka iz originalnog primera. **"Pun zapis" (dupli klik/"Otvori") još NIJE dizajniran ni implementiran za rezervacije** — čeka poseban predlog (vlasnik, 23.8.2026: "Jos treba da osmislimo celu formu koja ce se otvarati klikom na broj rezervacije... dajte neki predlog"), otvorena stavka u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md`. Kad centar prikazuje pun zapis, desni panel nosi kontekst *izveden* iz njega — AI razgovor vezan za taj zapis, istorija izmena, ili **"Povezano" traka**: dosledan blok koji pokazuje trenutno povezane zapise drugih modula (npr. gost → njegove rezervacije, fakture, otvoreni tiketi) — isti obrazac kao Attio/HubSpot, formalizovan ovde da ne ostane ad-hoc po ekranu. Prelazak sa sažetka u desnom panelu na **pun** prikaz zapisa (dupli klik/dugme "Otvori") uvek otvara **nov tab** (poglavlje 5a — "namerna radnja"), ne zamenjuje listu koja je već otvorena. Desni panel nikad ne pokreće nezavisnu navigaciju sam — uvek zavisi od onoga što je otvoreno u centru. **Može se otvoriti drugi desni panel pored prvog** (isti obrazac kao VS Code split editor grupe — prevlačenje ili prečica otvara novu kolonu) — dva desna panela jedan pored drugog, ne jedan preko drugog.

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

### 5c.1 Skupljena leva traka — plutajući podmeni na prelazak mišem (dopuna, 2.9.2026, na zahtev vlasnika)

*(vlasnik: "kada je levi panel zatvoren i u bočnoj levoj traci se pojave samo ikone, kada prelazimo mišem preko ikona, pojaviti i plutajuće podmenije")*

Dok je leva traka skupljena, od cele navigacije na ekranu ostaje samo kolona ikonica. Do sada se spisak sekcija te grupe nije mogao videti bez ponovnog širenja trake — što skupljenu traku delimično obesmišljava: dobije se prostor, izgubi se mogućnost da se stigne bilo gde bez dva koraka. Zato **prelazak mišem preko ikonice otvara plutajući meni** sa sekcijama te grupe, iz kog se ide pravo na željenu sekciju.

**Pravila:**

- **Samo dok je traka skupljena.** Kad je proširena, isti spisak već stoji u levoj traci (§5c, korak 2) — meni preko njega bio bi suvišan i smetao bi.
- **Meni prikazuje samo sekcije koje taj korisnik sme da vidi** (M17 spec §3). Isto pravilo kao svuda drugde: stavka bez prava ne postoji, ne prikazuje se onemogućena. Redosled je isti kao u proširenoj traci — ista grupa ne sme da izgleda drugačije skupljena nego proširena.
- **Grupa sa jednom sekcijom dobija meni sa jednim redom**, bez zaglavlja (naziv grupe i naziv jedine sekcije su tu ista stvar). Tada meni služi kao stilizovana zamena za sistemski tooltip — koji se dok je traka skupljena namerno **ne** postavlja, da se preko menija ne pojavi i drugi, sivi oblačić sa istim tekstom.
- **Otvara se i tastaturom.** Fokus na ikonicu (Tab) otvara isti meni — korisnik koji ne koristi miša ne sme da ostane bez pristupa sekcijama dok je traka skupljena.
- **Bez praznine u putanji miša.** Meni naleže na ivicu trake, a vizuelni odmak se pravi njegovim unutrašnjim razmakom — inače nestaje dok miš prelazi prazan prostor do njega.

Ovaj obrazac važi identično za M17 i M7 (poglavlje 7), isto kao ostatak §5c.

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

**"Customize Layout" dugme** — nova ikonica u gornjoj traci (pored postojećeg admin zupčanika, poglavlje 5c), isti duh kao VS Code istoimeno dugme: klik otvara mali padajući meni sa čekiranim/nečekiranim stavkama za **sve postojeće panele koji se mogu sakriti** — bočna traka (poglavlje 5c), desni panel (poglavlje 5b, od 25.8.2026 isti prekidač pokriva i AI chat, §6c.0), donja statusna traka (poglavlje 5d), i **terminal panel** (ispod). Stanje svake stavke pamti se po korisniku — panel se ne vraća u podrazumevano stanje pri svakoj prijavi.

**Meni nosi i izbor širine centralnog sadržaja** (dopuna, 2.9.2026) — zasebna grupa ispod prekidača, razdvojena linijom i naslovom "Širina sadržaja", jer se tu bira **jedna** od četiri vrednosti umesto da se nešto pali i gasi. Vrednosti, obrazloženje i razlog zašto je to granica a ne procenat: **§6b.1**.

> **Gde se šta stvarno pamti (stanje koda, 2.9.2026).** Ovaj odlomak je do 2.9.2026. tvrdio da se vidljivost panela pamti kroz `UserPreference` — u kodu to nije tako. Tačno stanje:
> - **vidljivost panela** — `localStorage` (`tt-panel-layout-visibility`, `Shell.tsx`), privremeno rešenje iz 23.8.2026 kad `UserPreference` backend nije postojao u kodu. Pamti se **po browseru**, ne po nalogu; korisnik na drugom računaru zatiče podrazumevano stanje.
> - **širina sadržaja** i **način prikaza desnog panela** — pravi `UserPreference` (M1 §3.9, ključevi `main_content_max_width` i `right_panel_display_mode`), dakle **po nalogu**.
>
> Backend sada postoji i koristi se, pa je prelazak vidljivosti panela na njega samo neurađen posao, ne prepreka — otvorena stavka, §8.

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

Ovo pravilo se odnosi **samo na M8**; panel (M17) ima sopstveno pravilo — §6b.1 ispod.

### 6b.1 Panel (M17) — puna širina podrazumevano, ali korisnik sme da je suzi (dopuna, 2.9.2026, na zahtev vlasnika)

*(vlasnik: "omogućiti ko to želi da se u centralnom panelu širina prikaza podesi na manju širinu")*

Panel je radna površina, ne štampana strana, i **podrazumevano ostaje na punoj širini** — to se ovom dopunom ne menja ni za jednog korisnika koji ništa ne dira. Ali isti argument o čitljivosti koji važi za tekstualne stranice sajta (gore) važi i ovde na velikom monitoru: red koji ide preko celog ekrana zamara, a oko mora da putuje od kraja do kraja da poveže početak i kraj istog reda. Zato širina postaje **lični izbor**, ne jedinstvena odluka za sve.

**Granica širine, ne procenat.** Ovo je suština rešenja i razlog zašto se ne ponavlja greška iz avgusta:

| Pristup | Ponašanje |
| :---- | :---- |
| Procenat (npr. 80%) | Oduzima prostor **uvek**, i na uskom ekranu gde ga ionako nema. Tako je radio raniji `w-[90%]`, koji je zato ukinut 29.8.2026 na vlasnikovu prijavu da margina postaje sve primetnija kad bočni paneli oduzmu prostor. |
| Gornja granica (`max-width`) | Deluje **samo kad raspoloživog prostora ima više od nje**. Na užem ekranu se ponaša identično kao puna širina, bez ijednog izgubljenog piksela. Ista postavka radi ispravno na svakom uređaju. |

**Četiri ponuđene vrednosti** (vlasnik potvrdio posle predloga sa obrazloženjem):

| Izbor | Granica | Zašto baš tu |
| :---- | :---- | :---- |
| Puna širina | — | Podrazumevano. Nepromenjeno ponašanje za sve koji ništa ne biraju. |
| Široko | 1680px | Deluje tek na velikim/ultraširokim monitorima; na 1920px sa otvorenim bočnim panelima praktično neprimetno. |
| Srednje | 1440px | Osetno mirniji ekran, a najšira tabela u panelu (lista rezervacija, 11 kolona) i dalje staje bez stiskanja kolona. |
| Usko | 1280px | **Donja granica koja se preporučuje.** Ispod ~1250px ta tabela počinje da stiska kolone ili traži horizontalno skrolovanje — gora šteta po preglednost nego predugačak red teksta. |

Donja granica nije proizvoljna: **određena je najširim stvarnim sadržajem u panelu**, ne osećajem. Ako se ikad pokaže potreba za užim prikazom, rešenje je manje kolona u toj tabeli (zaseban zahtev), ne uža granica koja bi tabelu pokvarila.

**Traka tabova prati sadržaj** (dopuna istog dana, na zahtev vlasnika: "pozicija tabova treba da prati veličinu prikaza, logika kao i u prikazu 100%"). Na punoj širini prvi tab stoji tačno na levoj ivici sadržaja — to poravnanje je bilo cilj cele `leftColumnWidth` računice iz §5c (tri pokušaja, 23.8.2026). Čim sadržaj dobije granicu i centrira se, njegova leva ivica se pomeri udesno; ako traka tabova ostane gde je bila, poravnanje se gubi tačno kod korisnika koji je izabrao užu širinu. Zato traka dobija isti pomeraj.

Poravnava se **samo leva ivica**, namerno: i na punoj širini traka tabova ide do polja za pretragu, dakle preko prostora desnog panela — to je "logika kao u prikazu 100%" i ne menja se. Pomeraj se **meri, ne računa** (`ResizeObserver` nad samim `<main>`-om), iz istog razloga iz kog se tako meri i širina leve kolone: leva ivica sadržaja zavisi od previše promenljivih stanja (širina bočne trake, otvoren/zatvoren desni panel, `push` naspram `overlay` režima, izabrana granica) da bi se pouzdano izračunala unapred.

**Gde stoji i gde se pamti.** Izbor živi u već postojećem meniju "Customize Layout" (§5f), kao zasebna grupa ispod prekidača za panele — razdvojena linijom i naslovom, jer se tu bira **jedna** vrednost, a gore se pale i gase delovi ekrana. Pamti se u `UserPreference` (M1 §3.9, ključ `main_content_max_width`), dakle **po nalogu, ne po browseru** — korisnik zatiče svoju širinu i na drugom računaru. To je razlika u odnosu na vidljivost panela iz §5f, koja je i dalje u `localStorage` iz vremena kad taj backend nije postojao u kodu (otvorena stavka, §8).

---

## 6c. AI razgovor — plutajući kontekst iznad unosa

*(dodato avgust 2026, na zahtev vlasnika — referenca: Claude Code panel unutar VS Code)*

Svaki ekran koji vodi razgovor sa AI agentom (M19 chat sa AI nacrtom, M21/M23 AI asistent, M15 omnisearch/komandna paleta) prati isti obrazac unosa kao Claude Code panel:

- **Polje za unos je fiksirano pri dnu desnog panela** (poglavlje 5b) ili centralnog panela kad je razgovor glavni sadržaj ekrana (npr. M21/M23 "pitaj asistenta") — ne pluta slobodno u sredini sadržaja.
- **Kontekst/dozvole/nagoveštaji se pojavljuju kao plutajući blok neposredno IZNAD polja**, ne kao poseban banner na vrhu ekrana ili modal — npr. koji zapis/modul je trenutni kontekst razgovora, kad AI predlaže radnju koja čeka ljudsku potvrdu (poglavlje 6a — bedž "AI" i pravilo da čovek mora da potvrdi pre slanja/objave), kratak predlog sledećeg pitanja. Blok nestaje kad nije relevantan (isti princip "skriveno dok nije potrebno" kao komandna paleta, poglavlje 4).
- **Traka mogućih režima/dozvola tik uz polje za unos** kad je primenjivo (npr. da li AI predlog čeka odobrenje iznad određenog iznosa, M7 poglavlje 2.0.4) — vidljiva, ne skrivena u meniju.

Ovaj obrazac ne menja pravila iz poglavlja 6a (obeležavanje autora) niti M15 poglavlje 6.5.4 (AI nikad sam ne izvršava radnju) — samo određuje **gde na ekranu** ta pravila postaju vidljiva.

### 6c.0 Smeštaj — dokovano u desnom panelu, sa punim-tab režimom za fokus (dopuna, 25.8.2026, na zahtev vlasnika)

**Zamenjuje** prethodan (nespecifikovan, samo u kodu opisan) plutajući prozor u donjem desnom uglu sa ručnim prevlačenjem i dugmetom za uvećanje na visinu ekrana — taj obrazac je ukinut, ne postoji paralelno sa ovim.

- **AI chat je STALNI deo desnog panela** (poglavlje 5b) — ista celina koja već prikazuje sažetak reda/policu podsetnika po modulu, **naslagana ispod tog sadržaja** (jedan iznad drugog, ne tabovi — oba mogu biti vidljiva istovremeno kad oboje ima sadržaj). Otvaranje/zatvaranje desnog panela (dugme u gornjoj traci, "Customize Layout") sad **istovremeno** otvara/zatvara i pristup AI chat-u — jedna kontrola umesto dve (raniji zaseban prekidač "AI chat" u "Customize Layout" meniju je uklonjen, "Desni panel" stavka sad pokriva oboje).
  - Sadržaj sažetka/podsetnika zauzima preostali prostor (`flex-1`, skrolabilan nezavisno); AI chat zauzima donjih ~40% visine panela (nasleđuje vlasnikov prvobitni predlog "40% visine ekrana" — ovde primenjeno na visinu SAMOG PANELA, ne celog ekrana, pošto je panel sad dokovan, ne slobodan).
  - Automatsko punjenje kontekstom (`pageContent`/`autoContext`, M15 spec §6.5.1) ostaje nepromenjeno — i dalje čita sadržaj CENTRALNOG panela (`#tt-main-content`), sad prikazano dokovano pored njega umesto u plutajućem prozoru preko njega.
  - AI chat komponenta ostaje **uvek montirana** dok je desni panel u DOM-u (kolabovan na širinu 0 kad je zatvoren, isti mehanizam kao bočna traka, poglavlje 5c) — istorija razgovora se ne gubi otvaranjem/zatvaranjem panela, isti princip kao ranije "istorija se čuva" pravilo.
- **Izbor: sužava sadržaj naspram prelazi preko njega** (dopuna, na zahtev vlasnika) — po korisniku, preko `UserPreference` (M1 §3.9, ključ `right_panel_display_mode`), dva režima:
  - **Sužava** (podrazumevano) — panel je deo normalnog rasporeda (postojeći `ResizablePane`, poglavlje 5b), centralni sadržaj se realno suzi da ostane potpuno vidljiv. Isto ponašanje koje desni panel već ima danas.
  - **Prelazi preko** — panel postaje plutajući sloj (`position: fixed`, desna ivica ekrana) koji NE menja širinu centralnog sadržaja, samo ga delimično prekriva — za korisnike koji radije zadrže punu širinu liste/zapisa ispod. Prekidač je mala ikonica u zaglavlju samog panela, uvek vidljiva.
- **"Fokus" režim — pun tab, isključivo za AI chat** (dopuna, na zahtev vlasnika: "ko zeli da se fokusira samo na rad u ai agentu... kao ovde sada u VS Code") — ikonica u zaglavlju dokovanog AI chat-a otvara **nov tab** (postojeći sistem tabova, poglavlje 5a) na kom AI chat zauzima CEO centralni prostor (širina i visina), isti obrazac kao ovaj Claude Code panel kad zauzima ceo ekran. Zatvaranje tog taba (standardno "x" na tabu) vraća korisnika na dokovan prikaz — ne gubi istoriju razgovora (ista komponenta/stanje). Fokus tab NEMA sopstveni `pageContent` da čita (nema odvojenog "drugog" ekrana dok je on sam ceo ekran) — ponaša se isto kao prazna Početna (M15 spec §6.5.1 — auto-kontekst se ne prilaže). **Dopuna (25.8.2026, na zahtev vlasnika: "polje za chat i odgovore prikazite na 70% sirine ekrana na kom se prikazuje")** — sadržaj (istorija + red za unos) je u Fokus tabu ograničen na 70% širine, centriran — na širokim ekranima razvučen razgovor preko cele širine je teže čitljiv; dokovan prikaz u desnom panelu (svoja, uža, ručno podesiva širina) ovim nije pogođen.
- **`CommandPalette` (poglavlje 4) ostaje nepromenjen, poseban ulaz** (vlasnikova odluka, 25.8.2026) — AI chat NE dobija sopstvenu, punu listu stavki menija ispod polja (razmatrano, odbačeno da se ne duplira ista funkcija na dva mesta); postojeće 4 brze prečice (poglavlje 6c.2 "šta još") ostaju kao i do sada, bez proširenja.

**Ispravka (25.8.2026, uživo nalaz uz snimak ekrana, isti dan)** — prvi prolaz implementacije je pogrešno ostavio red za unos PRI VRHU sekcije umesto pri dnu (uzrok: poruke se renderuju u uslovnom `{turns.length > 0 && ...}` bloku bez `turns` — kad je razgovor prazan, nema `flex-1` elementa koji popunjava prostor, pa red za unos "isplivava" na vrh). Ispravljeno: blok poruka je sad UVEK montiran (prazan kad nema poruka), `flex-1` ga i dalje širi da popuni ceo preostali prostor, red za unos ostaje pri dnu bez obzira na broj poruka — ovo NIJE nova specifikacija, samo ispravka pogrešne implementacije prvobitnog teksta iznad ("Polje za unos je fiksirano pri dnu"). Uz istu ispravku:
- **Istorija razgovora raste ODOZDO NAGORE** (na zahtev vlasnika) — najnovija poruka je uvek najbliža polju za unos (dno), starije poruke se otkrivaju skrolovanjem nagore — isti obrazac kao svaka poznata chat aplikacija.
- **4 brze prečice ispod polja (poglavlje 6c.2) su UKLONJENE** (na zahtev vlasnika, isti razgovor) — zamenjene ikonicom "Otvori modul" (§6c.0a ispod) koja pokriva SVE module na zahtev, ne samo 4 unapred izabrana.
- **Meniji koji se otvaraju iz reda za unos (dugme `+`, §6c.1, i novo §6c.0a ispod) sad rastu NAGORE** (`position: fixed` + `bottom`, ne `top`) — posledica premeštanja reda za unos na dno, meni koji bi se otvorio nadole bi izašao van ekrana.
- **Strelica "Pošalji" je u bojama loga** (na zahtev vlasnika: "samo strelica neka bude u boji Loga, mislim na linije strelice") — isti fiksni preliv kao logo u gornjoj traci (`#e8a63c → #e2685a → #a99bd8`, TopBar.tsx), ne prati temu panela, isti razlog kao logo (brend ostaje isti bez obzira na temu).

### 6c.0a Ikonica "Otvori modul" — popup sa svim modulima (dopuna, 25.8.2026, na zahtev vlasnika: "dodajte oznaku za kontekst i kada kliknemo na nju treba da se otvore svi moduli u popup meniju na gore i odabrati jedan od modula")

Nova ikonica (`list-tree`, pored dugmeta `+`) otvara popup NAGORE (isti razlog kao gore) sa **svim modulima dostupnim trenutnom korisniku** (ista, ulogom filtrirana lista kao Sidebar/CommandPalette — `visibleNavItems`, samo `implemented` stavke, isti princip kao CommandPalette prazan upit). Klik na modul ga otvara (`openTab`, isti mehanizam kao svaki drugi klik na stavku menija) i zatvara popup. Ovo NE duplira `CommandPalette` (koji ostaje glavni, tekstualno-pretraživ ulaz za navigaciju) — ovo je brz, vizuelan prečac iz samog chat-a, bez kucanja.

**Ispravka (25.8.2026, uživo nalaz uz snimak ekrana, isti dan) — grupisano, ne ravna lista.** Popup je grupisan po `NAV_GROUPS` (ista podela kao Sidebar/ActivityBar, poglavlje 5c) — naziv grupe je **podebljan i BEZ linka** (nema sopstvenu rutu, čisto vizuelan naslov celine), samo stavke UNUTAR grupe se otvaraju klikom. Prazna grupa (korisnik nema nijedno pravo unutra) se ne prikazuje.

**Dopuna (25.8.2026, isti dan, na zahtev vlasnika, uz snimak ekrana) — "#" na kraju reda naziva modula.** Svaki red naziva grupe (poglavlje iznad) dobija na desnom kraju malu ikonicu `symbol-number` ("#") — isti mehanizam/izgled kao `AddToAiContextButton.tsx` (poglavlje 6c.1a, ikonica po redu tabele), ovde primenjen na CEO MODUL (grupu), ne pojedinačan zapis: klik dodaje "Modul: <naziv>" kao RECORD stavku u AI kontekst (M15 spec §6.5.4.3) — NE zatvara popup, korisnik može dodati više modula pre postavljanja pitanja. Razlikuje se od klika na SAM naziv grupe (i dalje bez linka/akcije) i od klika na stavku unutar grupe (navigira, poglavlje iznad).

**Dopuna (25.8.2026, isti dan, na zahtev vlasnika: "oznaku za kontekst stavite i u podmeni stavke") — "#" i na pojedinačnim stavkama.** Ista ikonica (hover-otkrivena, isti obrazac kao `AddToAiContextButton.tsx`) sad postoji i na SVAKOJ pojedinačnoj stavci unutar grupe (npr. "Kalendar rezervacija"), ne samo na nazivu modula — dodaje TAČNO tu sekciju kao RECORD stavku, ne ceo modul. Klik na ostatak reda i dalje navigira/zatvara popup kao pre; klik na "#" ne radi ni jedno od to dvoje.

**Ispravka (25.8.2026, isti dan, na zahtev vlasnika: "kada se klikne na # otvara se odmah desni panel iako je vec ai agent u celom tabu. To ukinite") — bez otvaranja desnog panela u Fokus tabu.** `AiContextProvider.onFirstAdd` (Shell.tsx) više ne otvara desni panel kad je korisnik na `/ai-asistent` (§6c.0, Fokus tab) — AI chat je tamo već preko celog centralnog prostora, otvaranje desnog panela pored njega je bilo nepotrebno/zbunjujuće. Van Fokus taba ponašanje ostaje nepromenjeno (panel se i dalje automatski otvara pri prvom dodatom kontekstu).

**Ispravka (25.8.2026, isti dan, uživo nalaz uz snimak ekrana pogrešnog odgovora) — RECORD kontekst iz nav-stavke postaje FILTERED_LIST kad ruta ima pravi pogled.** Pitanje "koliko rezervacija ima u listi rezervacija" uz priložen kontekst "Lista rezervacija" (dodat preko "#" na stavci menija, §6c.0a) je dobilo "ne vidim sadržaj ekrana" — netačno rezonovanje, jer taj kontekst NIJE trebalo da zavisi od sadržaja ekrana. Uzrok: običan RECORD kontekst nosi samo čitljivu referencu bez signala da "Lista rezervacija" odgovara TAČNO M15 `filter_list` pogledu `bookings` (`filterable-views.ts`). Ispravljeno — i auto-kontekst taba i "#" na stavci menija sad PROVERAVAJU da li ruta ima pravi pogled u tom registru (`/rezervacije/lista`→`bookings`, `/crm`→`crm`, `/marketing`→`marketing`, `/nadzor`→`health_signals`) i, ako ima, šalju FILTERED_LIST sa praznim filterima ("ceo spisak") umesto RECORD-a — isti deterministički mehanizam kao dugme "Dodaj u AI kontekst" na traci filtera. Najviše jedna FILTERED_LIST stavka po zahtevu i dalje važi (§6.5.4.3) — auto-kontekst ostaje RECORD ako je korisnik već ručno priložio jednu. **Preostalo ograničenje (nije bag, arhitektonska granica §6.5.4, "filter_list nikad ne izvršava akciju već samo vraća link")**: `filter_list` i dalje ne vraća stvaran broj redova, samo navigacioni link — agent sad ISPRAVNO objašnjava da ne može da prebroji iz samog linka, umesto da netačno tvrdi da mu nedostaje sadržaj ekrana; stvarno brojanje bi zahtevalo poseban alat/proširenje, van obima ove ispravke.

### 6c.0b Sklapanje jednog od dva naslagana dela u desnom panelu (dopuna, 25.8.2026, na zahtev vlasnika: "kada se nalaze u desnom panelu i ai agent i neki sadržaj omogućiti uklanjanje jednog od dva dela ako nije potreban")

Svaka od dve naslagane sekcije (postojeći sažetak/podsetnik, i AI chat ispod) dobija sopstvenu, malu ikonicu (ševron) u svom zaglavlju za sklapanje na visinu 0 (samo naslov ostaje vidljiv za AI sekciju, gornja sekcija nestaje potpuno kad je sklopljena) — čisto vizuelno, isti "AiChatBox ostaje montiran" princip kao svaki drugi obrazac sklapanja u ovom dokumentu (bočna traka, poglavlje 5c). Sklapanje gornje sekcije pušta AI chat da zauzme CEO preostali prostor panela (ne samo ~40%) — obrnuto, sklapanje AI chat-a vraća sav prostor gornjoj sekciji.

**Dopuna (25.8.2026, isti dan, na zahtev vlasnika) — ručno podesiva granica.** Kad su OBE sekcije otvorene, linija koja ih deli je ručno prevlačiva (isti `cursor-row-resize` obrazac kao `ResizablePane` horizontalne granice, poglavlje 5b) — visina AI sekcije se pamti kao procenat visine panela (ne piksela, da ostane ispravna i kad se sam panel ručno suzi/proširi), podrazumevano 40%, opseg 15–80%. Prevlačiva linija se ne prikazuje kad je bilo koja sekcija sklopljena (nema šta da se deli).

**Dugme "Fokus" premešteno** (25.8.2026, na zahtev vlasnika: "dugme za prosirivanje ai agenta stavite u gornji desno cosak ai modula") — iz reda za unos (gde je bilo od v1.49) u GORNJI DESNI ugao zaglavlja same AI sekcije, pored ikonice za sklapanje — dosledna pozicija: sve radnje NAD celom AI sekcijom (fokus, sklapanje) žive u njenom zaglavlju, ne u redu za unos.

**Ista širina panela u oba režima prikaza** (25.8.2026, na zahtev vlasnika: "sirina desnog panela neka bude iste sirine, sira varijanta, i kada prelaze i kada ne prelaze preko sadrzaja") — "push" i "overlay" (poglavlje 6c.0) sad dele ISTU, ručno podesivu širinu (isti `ResizablePane`, ista memorija širine), podrazumevano podignuto sa 320px na 420px ("šira varijanta" — ranija vrednost overlay režima). Ranije je push imao užu podrazumevanu širinu (320px) od overlay-a (420px, fiksno) — nedosledno, ispravljeno.

**Mikrofon premešten neposredno ispred strelice "Pošalji"** (25.8.2026, na zahtev vlasnika: "mikrofon stavite ispred strelice") — ranije je bio pre polja za unos, sad je POSLE polja, poslednja ikonica pre same strelice.

### 6c.1 Dugme `+` — prilaganje konteksta (dopuna, 18.8.2026, na zahtev vlasnika — referenca: VS Code/Copilot Chat)

Pored polja za unos, dugme `+` otvara meni sa čime se razgovor može dopuniti — svaka stavka je **prilaganje konteksta**, nikad nova AI moć, samo preciznije određenje o čemu se razgovor vodi:

- **Trenutno otvoren zapis** — ako je u centru/desnom panelu otvorena rezervacija/gost/faktura, prva stavka menija je taj zapis (jedan klik umesto prepričavanja agentu na šta se misli). Agent ovo **predlaže**, ne nameće sam.
- **Rezultati trenutne pretrage** — ako je otvoren tab pretrage, dodaje ceo trenutni skup rezultata kao kontekst (isti mehanizam kao M5 poglavlje 3.0e.2, ovde dobija vidljivo, dosledno mesto u meniju umesto skrivenog ponašanja).
- **Prilog fajla/slike** — cenovnik dobavljača, skeniran ugovor, dokument gosta — jedan ulaz za analizu umesto što svaki modul (M3 uvoz cenovnika, M22 prilog) ima sopstveni, razdvojen mehanizam za "priloži pa analiziraj".
- **Pretraga interneta** (M15 poglavlje 6.5.6b) — ista opcija menija kao ostalo, umesto zasebnog ulaza za "agentu treba nešto van aplikacije".
- **Konkretan zapis preko `@` pominjanja** — kucanje `@` unutar samog polja (ne kroz `+` meni) otvara brzu pretragu (isti mehanizam kao komandna paleta) da se eksplicitno referencira zapis po broju/imenu (npr. `@rezervacija TT-2026-482`, `@gost Petrović`) bez otvaranja tog taba.

Priložen kontekst prikazuje se kao uklonjiv "čip" u plutajućem bloku iznad polja (poglavlje 6c iznad) — vidljivo šta je agent trenutno "video", jedan klik da se ukloni. **Dopuna v1.48 ispod (§6c.1a) proširuje ovo na VIŠE čipova istovremeno** — ranije je prilog bio jedna vrednost koja se zamenjuje sledećom, sad je lista.

### 6c.1a Ikonica po redu — "Dodaj u AI kontekst", generalizovano kroz sve module (dopuna, 25.8.2026, na zahtev vlasnika)

**Zašto ne desni klik.** Vlasnikovo prvobitno pitanje je bilo o desnom kliku na red liste rezervacija; predlog ispod je zamena, ne dodatak — desni klik nema dodirni ekvivalent (panel se koristi i sa tableta na terenu) i nije vidljiv dok se ne proba, za razliku od stalno prisutne ikonice.

- **Mala, hover-otkrivena ikonica** (isti obrazac kao `CopyButton`, poglavlje 5f — vidljiva pri prelasku mišem/fokusu, ne guši red) u prvoj koloni svakog reda tabele i na svakoj kartici rezultata (poglavlje 6d) — **kroz sve module**, ne samo M5 rezervacije: bilo koji zapis koji ima sopstvenu stranicu (rezervacija, gost/nalogodavac, faktura, ugovor, tiket...) dobija istu ikonicu istim mehanizmom, bez posebnog rada po modulu (deljena komponenta, ne kopiran kod). Codicon `symbol-number` (vizuelno najbliže vlasnikovom predlogu "#" — već slobodna, nije zauzeta nijednom drugom radnjom u poglavlju 3a.1 tabeli).
- **Klik dodaje taj zapis kao nov čip** u plutajućem kontekst-bloku (poglavlje 6c) — **ne zamenjuje** postojeće čipove (ispravka u odnosu na dosadašnje ponašanje dugmeta `+`/"Trenutno otvoren zapis", koje je i dalje dostupno, samo više nije jedini put) — omogućava dodavanje nekoliko zapisa pre postavljanja pitanja, radi zajedničke analize/poređenja ("uporedi ove tri rezervacije"). Gornja granica 8 zapisa (razlog i sprovedba: M15 spec §6.5.4.3) — ikonica se posle 8. dodatog zapisa vizuelno onemogući uz kratko objašnjenje, ne tiho odbija klik.
- **Sačuvan/trenutno filtriran prikaz kao poseban čip** — na ekranu liste (poglavlje 6d), pored ikonice po redu, traka filtera (levi panel) dobija sopstvenu radnju "Dodaj filtrirani prikaz u AI kontekst" (dugme, ne ikonica — ređa radnja, sme biti eksplicitnija) koja dodaje JEDAN čip koji predstavlja ceo trenutni skup rezultata (aktivni filteri + broj rezultata), ne pojedinačne redove — isti mehanizam kao već postojeće "Rezultati trenutne pretrage" (§6c.1 iznad), samo dostupno i za sačuvane prikaze (M1 §3.9 `UserPreference`, M17 §5.5), ne samo za tab pretrage proizvoda. Najviše jedan ovakav čip odjednom (razlog: M15 spec §6.5.4.3).
- Čip filtriranog prikaza je vizuelno razlikovan od čipa pojedinačnog zapisa (mala oznaka broja rezultata na čipu, npr. "Filtrirano: Nerefundabilne (14)") — isti princip transparentnosti kao svuda drugde u ovom dokumentu (šta je agent tačno "video").

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

## 6f. Izbor iz malog, poznatog skupa opcija — dugmad, ne padajući meni (dopuna, 28.8.2026, na zahtev vlasnika)

**Pravilo:** za polje sa malim, unapred poznatim skupom opcija (tip kreveta, uzrasna kategorija, status i slično), podrazumevani izbor je **grupa dugmadi/pločica** (klik = izabrano), ne `<select>` padajući meni — vlasnikova formulacija: "gde god je moguće izbegao bih padajuće menije, koristio bih formu tastera na koji se klikne za ono što želim ili dva klika za ono što ne želim." Razlog: definisanje strukturiranih pravila (npr. tip sobe, poglavlje "Tipovi soba" M2/M17) je već zahtevno po koncentraciji/vremenu — dodatni klik da se meni otvori, pa još jedan da se opcija nađe u listi, troši oboje bez razloga kad je skup opcija dovoljno mali da stane u red dugmadi.

**Konkretan obrazac:**
- **Jednostruk izbor** (npr. tip osnovnog kreveta) — red/grupa dugmadi, tačno jedno aktivno u svakom trenutku (`aria-pressed`/vizuelno `bg-accent-soft text-accent-strong` na aktivnom, isto stanje kao aktivan filter poglavlje 6d); klik na već aktivno dugme ga NE deselektuje (jednostruk izbor uvek mora imati tačno jednu vrednost, za razliku od višestrukog izbora ispod) — klik na drugo dugme prebacuje izbor.
- **Višestruk izbor** (npr. pogodnosti/`amenities[]`) — svako dugme je nezavisan prekidač: prvi klik uključuje (aktivno stanje), drugi klik na ISTO dugme isključuje — ovo je vlasnikovo "dva klika za ono što ne želim" kad je dugme već bilo uključeno (podrazumevano stanje ili ranije uključeno).
- Kad je skup opcija velik (desetine/stotine vrednosti, npr. spisak zemalja) — dugmad prestaje da bude praktična; padajući meni ili tekstualna pretraga sa predlozima ostaju opravdani, ovo pravilo važi za "mali, poznat skup", ne za svaki izbor uopšte.
- Prvi ugrađen primer: `RoomTypesEditor.tsx` (M2/M17, 28.8.2026) — tip osnovnog/dodatnog kreveta i uzrasna kategorija su dugmad, ne `<select>`.

**Namerno van obima ove dopune:** retrofit postojećih `<select>`/`MultiSelectDropdown` mesta u aplikaciji (npr. status/tip proizvoda filteri u "Lista rezervacija") — ovo pravilo važi za NOVE ekrane od ovog datuma; zamena postojećih ostaje poseban, veći zadatak ako se pokaže vredno truda (dosledna izmena kroz više ekrana odjednom, ne parče po parče).

---

## 6g. Svako polje za unos datuma — kalendar ILI kucanje brojeva, nikad goli `<input type="date">` (dopuna, 29.8.2026, na zahtev vlasnika)

**Pravilo:** vlasnikova formulacija — "omogucite u svim poljim gde se bira datum da se bira u kalendaru ili da se ukucava na nacin 12082026 (12 avgust 2026)". Svako polje za datum u panelu koristi deljenu komponentu `apps/panel/src/components/DateField.tsx`, ne goli `<input type="date">`.

**Razlog za sopstvenu komponentu, ne oslanjanje na native `<input type="date">`:** native kalendar postoji, ALI redosled segmenata (dan/mesec/godina) pri direktnom kucanju zavisi od OS/browser lokala, ne od jezika stranice — u en-US redosledu bi kucanje "12082026" ispalo mesec=12/dan=08 (8. decembar), ne dan=12/mesec=08 (12. avgust) kako korisnik namerava. `DateField.tsx` fiksira DD-MM-GGGG redosled bez obzira na lokal korisnikovog uređaja, i sam crta kalendar (bez nove biblioteke, poglavlje 6 Master dokumenta) da kalendar-klik radi identično u svakom browseru.

**Ponašanje:**
- Kucanje cifara automatski dodaje tačke dok se kuca ("1" → "12" → "12.08" → "12.08.2026.") — nevažeći datum (npr. "31.02.") dobija crvenu ivicu i `title` objašnjenje, ne tiho pogrešnu vrednost.
- Ikonica kalendara otvara sopstveni popover (mesec/godina zaglavlje sa strelicama, mreža dana, prečica "Danas") — zatvara se klikom van njega ili izborom dana.
- Spoljni ugovor ostaje ISO `"yyyy-mm-dd"` u oba pravca (isto što je i native `<input type="date">` nosio) — ništa niz tok (server actions, API filteri) se ne menja, samo unos.
- Radi i u nativnoj formi (`name`+`defaultValue`, GET/POST kao ranije) i u kontrolisanom React state-u (`value`+`onChange`, npr. `SearchCriteriaPopup.tsx`).

**Sprovedeno kroz ceo panel u istom prolazu** (19 mesta, 10 fajlova, 29.8.2026) — ovo NIJE "važi za nove ekrane od sad" izuzetak kao poglavlje 6f; vlasnik je eksplicitno tražio "u svim poljima", pa je retrofit urađen odmah, ne odložen.

---

## 6h. Ekran zapisa — tri nivoa težine, ne deset jednakih kartica (dopuna, 2.9.2026, na zahtev vlasnika)

*(vlasnik, uz snimak ekrana rezervacije: "da li smatrate da je ovo malo teško za oko šta gde da gleda jer je vizuelno sve isto? da li imate predlog kako ovo da popravimo")*

Ekran rezervacije (kartica **Pregled**) nije bio pretrpan — imao je tačno onoliko podataka koliko treba. Problem je bio što su svi bili na **istom nivou**: `rounded-lg border border-border bg-panel p-4` ponavljao se desetak puta na istom ekranu, a naslovi sekcija su bili `text-xs uppercase text-ink-faint` — dakle **najsitniji i najbleđi tekst na ekranu bilo je ono što treba da orijentiše**. Kad je sve jednako istaknuto, ništa nije istaknuto.

**Pravilo: svaki ekran pojedinačnog zapisa ima tačno tri nivoa težine.**

| Nivo | Šta je | Kako izgleda |
| :---- | :---- | :---- |
| 1 — sažetak | Ono što se traži u prve dve sekunde: koja je stvar, za koga, kada, koliko | Jedina kartica sa okvirom na vrhu; brojevi ~18px, oznake ~9px. **Tačno jedan po ekranu** — ako ga dobije i druga sekcija, nivoa opet nema |
| 2 — sekcija | Skup srodnih podataka (usluge, putnici, uplate) | Naslov u punoj boji teksta sa linijom ispod, **bez okvira oko sadržaja** |
| 3 — red | Pojedinačan podatak u sekciji | Red liste razdvojen tankom linijom, bez sopstvene pozadine |

**Okvir dobija samo ono što je zaseban entitet ili nešto na šta se klikne.** Isti podatak sme da ima okvir na jednom ekranu a da ga nema na drugom: stavka aranžmana je kartica na kartici *Aranžman* (tamo se menja) i običan red na *Pregledu* (tamo se samo čita).

**Odnos veličina brojeva i oznaka je najmanje 2:1.** Zatečeno stanje je bilo 13px naspram 9px, pa su se iznosi čitali kao još jedan red teksta.

**Dve kolone na širokom ekranu** — levo ono što jeste sam zapis, desno ono što je oko njega (novac, veze ka drugim modulima, retke radnje). Bez toga oko putuje preko cele širine za svaki red. Prelom na jednu kolonu ide na `xl`, ne na `lg` — na 1024px dve kolone stisnu tabelu iznosa do prelamanja.

**Retko korišćene radnje ne stoje na vrhu.** Forme za prenos vlasništva i predaju zaduženja zauzimale su prvi ekran iznad svega, a koriste se retko; sam podatak (ko je vlasnik, ko je zadužen) ostaje vidljiv u sažetku, forme silaze na dno.

**Ponavljanje se objedinjuje, ne skraćuje.** Isti putnik pod svakom uslugom je bio četiri reda za dve osobe; sada je dva reda, uz napomenu "isti putnici na svim uslugama". Podatak "ko putuje na čemu" se prikazuje tek kad se stvarno razlikuje.

**Boja ostaje isključivo semantička — i mora govoriti istinu.** Nalaz iz istog prolaza: "PREOSTALO **−256,00 EUR**" bilo je prikazano **zelenom** bojom. Zelena znači "u redu, plaćeno", a negativan ostatak znači da je gost **preplatio** i da neko mora da reaguje (povraćaj, prebijanje, ispravka knjiženja). Boja je saopštavala suprotno od stvarnog stanja. Sada je zasebna oznaka `PREPLAĆENO` u boji upozorenja, sa napomenom šta dalje.

**Naslov sekcije je TRAKA, ne natpis** (dopuna istog dana, na zahtev vlasnika: "red u kom je naslov sekcije da se nekako drugom nijansom boje izdvoji"). Red naslova ima pozadinu `--panel-2` preko cele širine sekcije. Namerno **nije nova boja** — to je ista nijansa koju već koriste zaglavlja tabela i bočni paneli, dakle postojeći signal "ovo je zaglavlje, ne sadržaj", samo primenjen i ovde. Traka preko cele širine čini da se red čita kao granica između sekcija, a ne kao natpis koji lebdi iznad sadržaja.

**Sekcija sa više od pet redova se skraćuje na skrol, uz OBAVEZAN link na punu karticu** (dopuna istog dana, na zahtev vlasnika: "u sektorima gde ima više od 5 redova uvesti nevidljivi skroler i link prema tabu gde se nalaze sve informacije za taj sektor"). Bez toga jedna duga sekcija (npr. dvadeset uplata) razvuče ekran i ponovo pojede hijerarhiju koju sažetak gradi — Pregled prestaje da bude pregled.

- **Skrol traka je nevidljiva** (`tt-scroll-hidden`, `globals.css`). Sadržaj se i dalje pomera mišem, tastaturom i dodirom; nestaje samo siva traka, koja bi uz svaku drugu sekciju vratila upravo onu vizuelnu buku zbog koje je redizajn i nastao.
- **Svaka sekcija koja ima svoju karticu nosi ikonu za pun prikaz** (dopuna istog dana, na zahtev vlasnika: "kod svakog sektora postaviti ikonu linka da se taj sektor u celosti otvori u odgovarajućem tabu") — ikona stoji desno u traci naslova, na **svakoj** sekciji, ne samo na skraćenima. Izlaz na pun prikaz treba da bude na istom mestu kod svake sekcije, a ne da se pojavljuje i nestaje u zavisnosti od broja redova. Koristi se `link-external`, ista ikona kojom panel već označava "sažetak → pun zapis" (`RightPanel` "Otvori pun zapis", M18 procesna mapa, brzi pregled proizvoda) — nije nova konvencija nego postojeća, primenjena i ovde. Ikona je bez teksta, pa nosi `title` i `aria-label` sa nazivom kartice ("Otvori u celosti — kartica Putnici"); bez toga bi korisnik tastature otvarao vezu ne znajući kuda vodi.
- **Sekcija bez sopstvene kartice ne dobija ikonu** — "Povezano" i "Vlasništvo i zaduženje" nemaju kuda da vode, pa ostaju bez nje. Ikona koja vodi na približno tačno mesto gora je od nepostojeće.
- **Zato je BROJ uz ikonu obavezan kad je spisak skraćen, ne ukras.** Cena nevidljive trake je što se ne vidi da sadržaja ima još — broj u linku (`svi (12) →`) je jedini signal da ispod vidljivih redova ima još. **Skraćivanje bez tog linka je zabranjeno.**
- **Link vodi na karticu tog sektora** (`?tab=putnici`, `?tab=finansije`, …), ne na neki novi ekran — pun prikaz već postoji, Pregled samo upućuje na njega.
- **Visina skrola prati visinu reda te sekcije**, ne jedna vrednost za sve: red usluge je viši (naziv + red detalja) od reda uplate, pa bi zajednička visina negde presekla peti red na pola, što izgleda kao greška u prikazu, a ne kao namerno skraćivanje.
**Sprovođenje.** Pravilo je prvo primenjeno SAMO na karticu Pregled ekrana rezervacije (2.9.2026, na vlasnikov zahtev — "hajde uradite samo za rezervacije da vidim kako uživo izgleda"), uz prekidač koji vraća zatečeni izgled dok vlasnik ne odluči. Kad odluči, izgled koji je izgubio se **briše iz koda** zajedno sa prekidačem — dva paralelna izgleda istog ekrana su tačno ono što je u prethodnom projektu dalo četiri dashboard-a koji rade isti posao (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`). Tek posle toga se pravilo primenjuje na ostale ekrane zapisa (gost, ugovor, faktura, proizvod), da se ne prepravlja tri puta.

---
## 7. Obim primene — M17 i M7 istim obrascem, M8/M9 zasebno

*(izmenjeno 17.8.2026 — ranije "samo M17 za sada")*

Ovaj dizajn sistem je pisan prvenstveno za **M17 (interni panel)** — okruženje za tim koji radi svaki dan, gde command-palette obrazac ima najviše smisla. **Vlasnikova odluka (17.8.2026): M7 (B2B portal, subagenti) dobija identičan vizuelni i interakcioni obrazac kao M17** — ista paleta-mehanizam (poglavlje 2), ista komandna paleta (poglavlje 4), isti tri-panelni raspored (poglavlje 5b), isti AI-razgovor obrazac (poglavlje 6c). Razlog: subagenti su redovni, profesionalni korisnici pod istim vremenskim pritiskom kao interni tim, ne povremeni gost — razlikovanje ide kroz **podatke koje vide** (M7 spec poglavlje 2.0, dobavljača-slep + bez marže/nabavne cene), ne kroz pojednostavljen interfejs. M7 zadržava sopstvenu "beli-label" paletu po subagentu (M7 spec poglavlje 2.0.5) umesto fiksne palete panela — mehanizam biranja/token-sloj ostaje isti kao M17, samo se boje pune iz `SubagentBranding` umesto iz fiksne palete.

I dalje se **ne pretpostavlja** da isti obrazac direktno odgovara i M8 (B2C sajt, gost koji retko koristi aplikaciju) ili M9 (mobilna aplikacija, dodirni ekran bez tastature) — ti kanali dobijaju sopstvenu primenu vizuelnog identiteta (boje, tipografija) kad dođu na red, ali ne nužno isti interakcioni obrazac. Ovo se rešava kad ti moduli dođu na red, ne pretpostavlja se ovde.

---

## 8. Otvoreno za dalje

- ~~Tačne HEX vrednosti palete panela — biraju se pri izradi prvog stvarnog ekrana, obavezno u skladu sa pravilom kontrasta (poglavlje 2a).~~ **Rešeno; tekuće vrednosti su u §2.0f.** *(Ovde je do 2.9.2026. stajala tabela palete "Horizont" sa amber akcentom `#9c6216` — vrednosti iz prvog prolaza M17 implementacije, potisnute već 17.8.2026, pa opet 19.8, 26.8. i 29.8. Nisu nikad ažurirane, pa je ovo poglavlje mesecima pokazivalo boje koje aplikacija nije koristila. Uklonjene, ne prepisane — istorija prelaza je u §2.0a–§2.0f, gde joj je mesto; tabela vrednosti stoji na jednom mestu, ne na dva.)*

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
- ~~`--border` pada 3:1 prag u sva tri moda panela (§2.0d).~~ **Rešeno 2.9.2026** — vlasnik izabrao "Prag" varijantu (najmanja vrednost koja prolazi na sve tri podloge) posle uporednog prikaza četiri jačine po modu; §2.0d dopuna.
- **Vidljivost panela ("Customize Layout", §5f) i dalje je u `localStorage`, ne u `UserPreference`.** Privremeno rešenje iz 23.8.2026 kad taj backend nije postojao u kodu; sada postoji i koristi se za druga dva podešavanja rasporeda (`main_content_max_width`, `right_panel_display_mode`). Posledica dok se ne prebaci: korisnik koji sakrije bočnu traku na jednom računaru zatiče je otvorenu na drugom. Nije rešeno uz izmenu od 2.9.2026 da se ta izmena ne pomeša sa migracijom postojećeg podešavanja.
- **`--bar` u svetlom modu je izgubio treću nijansu (§2.0e) — čeka vlasnikovu odluku.** Traka i bočni panel su posle prelaza na shadcn ponovo iste boje (`#f4f4f5`), iako je vlasnik 23.8.2026. tražio da trake budu za nijansu tamnije od svega. Manje vidljivo od granica, pa nije rešeno u istom prolazu; vraća se čim vlasnik potvrdi da mu i dalje smeta.
- **Paleta sajta (M8) nije proveravana od prelaska panela na shadcn** — `tools/check-contrast.js` trenutno čita samo `apps/panel`. Sajt ima sopstvenu paletu (tabela ispod, poslednja provera 17.8.2026) i vlasnik je 2.9.2026. rekao da se njime bavimo kasnije; kad dođe na red, skriptu proširiti na oba fajla umesto pisanja druge.
- ~~Da li M7 (B2B portal) dobija isti "power-user" obrazac kao M17~~ — **rešeno 17.8.2026** (poglavlje 7): identičan obrazac, razlikovanje ide kroz podatke (M7 spec poglavlje 2.0), ne kroz interfejs.
- **Vlasnikov prošireni pregled uživo nad celim poslovanjem** (npr. Elastic/Kibana-stila dashboard za praćenje svih procesa u realnom vremenu) — vlasnik izričito rekao "još ćemo raditi na tome" (17.8.2026), namerno odloženo. Verovatno dodatan sloj iznad M17 (možda i M13 BI), ne zamena — ne pretpostavlja se ovde ni obim ni tehnologija (uvođenje Elastic-a bilo bi nova zavisnost, zahteva `tt-tech-stack` potvrdu kad dođe na red).
- Da li izbor tamnog/svetlog moda treba da se sinhronizuje preko više uređaja po nalogu (zahteva backend polje, npr. na M1 `User`) ili ostaje lokalno po uređaju — v1 pretpostavlja lokalno, revidira se ako se pokaže potreba.
- ~~Tačna paleta semantičkih boja za isticanje teksta (poglavlje 6) — upozorenje/greška/uspeh — bira se zajedno sa HEX vrednostima palete.~~ **Rešeno** — `--ok`/`--warn`/`--danger` sa pripadajućim pill pozadinama, sva tri moda, izmerene vrednosti u §2.0f. Put do njih (dva odbačena pokušaja sa "warn" bojom) je u §2.0c.
- Da li postoji gornja granica broja istovremeno otvorenih tabova (poglavlje 5a), i šta se dešava kad se dostigne — dorađuje se pri implementaciji ako se pokaže potreba.
