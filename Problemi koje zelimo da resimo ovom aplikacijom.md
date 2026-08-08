Rad u agenciji na svakodnevnim poslovima

* [x] Automatsko pracenje svih statusa svake rezervacije i obavestavanje za nove rezervacije u toki dana, za storno rezervacije, za rezervacije sa bilo kakvom promenom... *(Pokriveno — M5 poglavlje 9 i 6.1; manji gap: dnevni zbirni pregled — vidi GAP-analiza #1)*



* [x] Automatsko pracenje da li je rezercacija najavkjena dobavljaču, da li je dobavljač potvrdio rezervaciju *(Dopunjeno u specifikaciji — M5 poglavlje 8.6 (`announced_at`/`supplier_confirmed_at`) i alarmi u poglavlju 6.1 — vidi GAP-analiza #2)*



* [x] Automstako slanje najava rezervacija dobavljaču uz mogucnost podesavanja da najava ide samo u odredjenom statusu rezertvacije ( na primer kada je naplacena akontacija, ili cemo za nekog dobavljača omoguciti slanje najave i bez uplate... i druge kombinacije. *(Dopunjeno u specifikaciji — M5 poglavlje 8.7 (`SupplierAnnouncementRule`, konfigurabilno po dobavljaču); napomena: priprema nacrta je konfigurabilna/automatska, ali samo slanje dobavljaču ostaje ljudska radnja (dogovoreno s vama) — vidi GAP-analiza #3)*



* [ ] Automatsko pracenje da li je u roku uplacena akontacija kao i da li je u roku isplacena rezetvacija u celosti *(Delimično — M10 prati rok prema dobavljaču, nedostaje rok prema gostu/nalogodavcu — vidi GAP-analiza #4)*



* [x] Automastko obavestavanje da li je rezervacija ubacena u CIS odnosno da li je kreiran evidencioni broj u Cisu *(Pokriveno za CIS/YUTA garanciju putovanja — M11 poglavlje 2.3; napomena: eTurista prijava pojedinačnog gosta je avgusta 2026. svesno izbačena iz obima kao obaveza hotela, ne agencije — proverite da li se ovaj problem odnosio baš na to, vidi GAP-analiza #5)*



* [ ] Skeniraje konacnih racuna i povezivanje sa rezervacijom, kako bi na ovaj nacin ubrzali uz pomoc ai agenta unos konacnih racuna. Uz pomoc Ai agenta nauciti aplikaciju da prepozna za svakog dobavljača kako izgleda konacni racun i da nauci da cita taj konacni racun i da potrebne informacije ubaci u odgovarajucu rezervaciju. Ovde osmisliti nacine provere da li sve radi kako treba. *(Nepokriveno — vidi GAP-analiza #6, preporuka: dopuna M10 poglavlje 8, isti obrazac kao M3 `PricelistImport`)*



* [ ] Pracenje svih mejlova svoh zaposlenih i dodeljivanje pristupa ko na koje mejlove odgovara. Potreban nam je poseban e mail klijent u aplikaciji kako bi imali potunu kontrolu i pregled svih mejlova na jednom mestu. Ovde je potreban ai agent koji ce am pomoci da odgivori na mejlove, da ih analizira, sumira...Zamislite tokom noci stigme 20 upita putem mejla - tada nam treba ai agent koji ce odgovara na te mejlove, ali ako ne zna odgovor da ostavi da odgovor napise zaposleni i slično. *(Nepokriveno — vidi GAP-analiza #7, predlog: novi modul M22 ili prošireni M19)*



* [ ] Subagentima u b2B portali omoguciti ( uz nadgledanje i nivoe sta mogu da rade) da bez poziva nasoj agenciji mogu da pretrazuju ponide, rezervisu, plaćaju, kreiraju voucher....potreban je poseban chat sa subagentima. *(Nepokriveno — vidi GAP-analiza #8, spaja M7 i M15)*



* [ ] Osmisliti Chat za komunikaciju sa dobavljacima kako bi ubrzali i imali kvalitetniju komunikaciju. Desctop i mobilnu aplikaciju. *(Nepokriveno — vidi GAP-analiza #9)*

* [x] Opisacu vam danasnju situaciju koju obavezno u buducnosti aplikacija ne treba da dozvoli. Naime stranka je uradila rezervaciju za isti hotel isti termin istu uslugu... sve isto kao i putem subagenta koji je isti hotel rezervisao preko nase agencije. Nsam primetio da su imena ista pa sam stornirao rezervaciju koja nama nije uplacena. Posto hotel ne prati rezervacije putem ID brojeva naseg sistema vec po imenu i prezimenu, hotel je stornirao i onu ispravnu reztervaciju. Predvidite sve ovakve scenarije i napravite obavestenja i upozoroenja koja ce korisnika sistema spreciti da napravi ovakvu gresku *(Dopunjeno u specifikaciji — M5 poglavlje 6.4 (provera duplikata pre otkazivanja) i M7 poglavlje 2.0.2; sekundarno pitanje (M6, spajanje profila gosta) i dalje otvoreno — vidi GAP-analiza #10)*


