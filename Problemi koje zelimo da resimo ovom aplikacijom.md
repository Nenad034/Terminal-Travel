Rad u agenciji na svakodnevnim poslovima

* [x] Automatsko pracenje svih statusa svake rezervacije i obavestavanje za nove rezervacije u toki dana, za storno rezervacije, za rezervacije sa bilo kakvom promenom... *(Pokriveno — M5 poglavlje 9 i 6.1; manji gap: dnevni zbirni pregled — vidi GAP-analiza #1)*



* [ ] Automatsko pracenje da li je rezercacija najavkjena dobavljaču, da li je dobavljač potvrdio rezervaciju *(Delimično — M5 `item_status`/`PENDING_SUPPLIER_CONFIRMATION` postoji, ali formalni koncept "najave" ne — vidi GAP-analiza #2)*



* [ ] Automstako slanje najava rezervacija dobavljaču uz mogucnost podesavanja da najava ide samo u odredjenom statusu rezertvacije ( na primer kada je naplacena akontacija, ili cemo za nekog dobavljača omoguciti slanje najave i bez uplate... i druge kombinacije. *(Nepokriveno — potreban nov koncept, konfigurabilno pravilo po dobavljaču — vidi GAP-analiza #3)*



* [ ] Automatsko pracenje da li je u roku uplacena akontacija kao i da li je u roku isplacena rezetvacija u celosti *(Delimično — M10 prati rok prema dobavljaču, nedostaje rok prema gostu/nalogodavcu — vidi GAP-analiza #4)*



* [x] Automastko obavestavanje da li je rezervacija ubacena u CIS odnosno da li je kreiran evidencioni broj u Cisu *(Pokriveno — M11 poglavlje 2 i 4.3 — vidi GAP-analiza #5)*



* [ ] Skeniraje konacnih racuna i povezivanje sa rezervacijom, kako bi na ovaj nacin ubrzali uz pomoc ai agenta unos konacnih racuna. Uz pomoc Ai agenta nauciti aplikaciju da prepozna za svakog dobavljača kako izgleda konacni racun i da nauci da cita taj konacni racun i da potrebne informacije ubaci u odgovarajucu rezervaciju. Ovde osmisliti nacine provere da li sve radi kako treba. *(Nepokriveno — vidi GAP-analiza #6, preporuka: dopuna M10 poglavlje 8, isti obrazac kao M3 `PricelistImport`)*



* [ ] Pracenje svih mejlova svoh zaposlenih i dodeljivanje pristupa ko na koje mejlove odgovara. Potreban nam je poseban e mail klijent u aplikaciji kako bi imali potunu kontrolu i pregled svih mejlova na jednom mestu. Ovde je potreban ai agent koji ce am pomoci da odgivori na mejlove, da ih analizira, sumira...Zamislite tokom noci stigme 20 upita putem mejla - tada nam treba ai agent koji ce odgovara na te mejlove, ali ako ne zna odgovor da ostavi da odgovor napise zaposleni i slično. *(Nepokriveno — vidi GAP-analiza #7, predlog: novi modul M22 ili prošireni M19)*



* [ ] Subagentima u b2B portali omoguciti ( uz nadgledanje i nivoe sta mogu da rade) da bez poziva nasoj agenciji mogu da pretrazuju ponide, rezervisu, plaćaju, kreiraju voucher....potreban je poseban chat sa subagentima. *(Nepokriveno — vidi GAP-analiza #8, spaja M7 i M15)*



* [ ] Osmisliti Chat za komunikaciju sa dobavljacima kako bi ubrzali i imali kvalitetniju komunikaciju. Desctop i mobilnu aplikaciju. *(Nepokriveno — vidi GAP-analiza #9)*

* [ ] Opisacu vam danasnju situaciju koju obavezno u buducnosti aplikacija ne treba da dozvoli. Naime stranka je uradila rezervaciju za isti hotel isti termin istu uslugu... sve isto kao i putem subagenta koji je isti hotel rezervisao preko nase agencije. Nsam primetio da su imena ista pa sam stornirao rezervaciju koja nama nije uplacena. Posto hotel ne prati rezervacije putem ID brojeva naseg sistema vec po imenu i prezimenu, hotel je stornirao i onu ispravnu reztervaciju. Predvidite sve ovakve scenarije i napravite obavestenja i upozoroenja koja ce korisnika sistema spreciti da napravi ovakvu gresku *(Nepokriveno — analiza i preporuka upisane u GAP-analiza #10 (M5/M7/M6), specifikacije još nisu dopunjene)*


