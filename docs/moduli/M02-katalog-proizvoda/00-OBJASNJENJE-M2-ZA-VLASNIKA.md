# M2 (Katalog proizvoda) — objašnjenje za vlasnika

Ovaj dokument objašnjava šta je napravljeno u M2 i **zašto**, običnim jezikom. Nije tehnički — za to postoje `03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` u istom folderu i `docs/api/M2-katalog-proizvoda.md`.

---

## Ukratko: M2 je polica u prodavnici, ne kasa

Ako je M3 magacin i papiri sa dobavljačem, **M2 je polica** — spisak svega što se prodaje, sa nazivom, opisom, slikama, lokacijom i prevodima.

Jedna stvar koju je važno razumeti odmah, jer izgleda kao propust a nije: **u M2 nema cena.** Nigde. Namerno.

Razlog je jednostavan. Cena hotela nije osobina hotela — ona zavisi od toga kada se putuje, koliko ljudi je u sobi, da li je doručak ili polupansion, i iz kog ugovora se prodaje. Isti hotel u istoj nedelji ima desetak različitih cena. Da smo cenu stavili u katalog, morali bismo da izmislimo „glavnu" cenu koja ne postoji, i onda bi svaki drugi deo sistema imao razlog da je zaobiđe.

Zato: katalog kaže **šta se prodaje**, M3 i M4 kažu **pošto**, a M5 ih spaja u trenutku kad neko stvarno traži ponudu.

---

## Isti spisak za sve — bez obzira odakle proizvod dolazi

U agenciji proizvodi stižu iz dva različita sveta. Neki su iz vaših ugovora sa hotelima (M3). Drugi dolaze uživo sa spoljnih sistema tipa Travelgate (M4), gde vi ne držite ni sobu ni cenu, nego pitate u trenutku prodaje.

Za prodavca i za gosta to je ista stvar — hotel je hotel. Zato oba završe u **istom** katalogu, sa oznakom odakle su došli:

- **„ugovoren"** — iz vašeg ugovora,
- **„sa API-ja"** — sa spoljnog sistema,
- **„ručno unet"** — jednokratna usluga koju je neko upisao za konkretnu rezervaciju.

Ta oznaka je interna. Gost je nikad ne vidi, i to nije slučajno — vidi sledeći odeljak.

---

## Šta gost sme da vidi, a šta nikad

Ovo je verovatno najvažnija odluka u celom modulu.

Katalog ima **dva ulaza**. Jedan je unutrašnji, za vaš tim, i traži prijavu. Drugi je javan, bez prijave — njega koristi vaš sajt, mobilna aplikacija i svaki spoljni partner koji prikazuje vašu ponudu.

Kroz javni ulaz **četiri podatka se nikad ne propuštaju**: od kog dobavljača je proizvod, po kom ugovoru, sa kog spoljnog sistema i pod kojim brojem tamo. To je poslovna tajna — konkurent koji vidi kod koga kupujete zna gde da vas potkopa.

Ovo nije rešeno tako što neko pazi da ne pošalje ta polja. Rešeno je tako što **svaki javni odgovor mora da prođe kroz jedno mesto** koje ih uklanja. Da neko sutra doda novo polje o dobavljaču, ono ne bi procurilo slučajno — moralo bi svesno da se propusti kroz to mesto.

---

## Kanali: isti proizvod, različita publika

Svaki proizvod nosi spisak mesta gde sme da se pojavi: javni sajt, portal za subagente, mobilna aplikacija. Proizvod objavljen samo za subagente **ne postoji** za posetioca sajta — ne prikazuje se ni kao nedostupan, jednostavno ga nema u odgovoru.

To vam daje da istu ponudu držite različito: neke aranžmane samo za partnere, neke samo javno, neke svuda.

---

## Objava traži srpski i engleski prevod

Proizvod se ne može objaviti dok nema opis na oba jezika. Sistem to odbija sa jasnom porukom.

Zašto baš tako: pola objavljenog proizvoda je gore nego neobjavljen. Gost koji naiđe na hotel sa praznim opisom na engleskom ne misli „nedostaje prevod", misli „ova agencija je neozbiljna". Bolje da ga uopšte ne vidi dok nije spreman.

Provera se radi **samo prvi put**, pri objavi. Kasnija promena kanala ne traži ponovnu proveru — proizvod je već jednom prošao.

---

## Prevodi: ko sme šta

Prevodi imaju **svoje odvojeno ovlašćenje**, različito od izmene samog proizvoda. Prevodilac sme da menja tekst, ali ne i lokaciju, sadržaj hotela ili kanale.

Uz svaki prevod se pamti da li ga je pisao čovek ili AI, i da li ga je čovek pregledao. Tako se u svakom trenutku zna koji tekstovi na sajtu nisu prošli ljudsko oko — što je bitno, jer AI ume da napiše tečnu rečenicu koja tvrdi nešto netačno o hotelu.

---

## Termini polaska — samo za grupne pakete

Hotel nema „polaske" — gost dolazi kad hoće. Grupni paket ima: autobus kreće 10. juna i to je to.

Zato termini postoje samo za pakete, i sistem odbija pokušaj da se dodaju bilo čemu drugom. Uz to, **datum povratka se ne unosi nego računa** — uzme se trajanje paketa u danima i doda na datum polaska. Jedan podatak manje za pogrešiti, i nemoguće je uneti paket od 7 dana koji se vraća posle 5.

---

## Uvoz sadržaja: AI piše, čovek potpisuje — stavku po stavku

Opisi hotela, spisak sadržaja, slike — to se može izvući sa sajta hotela umesto da se prekucava.

Ovde važi isto pravilo kao kod cenovnika u M3: **ništa se ne upisuje bez ljudskog odobrenja.** Ali sa jednom razlikom koju vredi razumeti.

Odobrava se **svaka stavka posebno**, ne ceo uvoz odjednom. AI može savršeno da prepiše opis hotela, a da pritom izmisli bazen koji ne postoji. Da je odobravanje „sve ili ništa", tačan opis i izmišljeni bazen ušli bi zajedno. Ovako se izmišljeni bazen odbije, a opis prođe.

Postoje tri odgovora na svaku stavku: prihvati, **ispravi pa prihvati**, ili odbaci. Srednja opcija je tu jer je najčešća u praksi — AI pogodi 90% rečenice, čovek popravi ostatak.

---

## Jedna greška koja je ispravljena 3.9.2026

Nazivi država su se u katalogu upisivali na dva načina — negde `RS`, negde `Srbija`. Posledica: filter po jednom obliku nije nalazio proizvode upisane pod drugim. Zatečeno stanje bilo je 24 proizvoda pod jednim oblikom i 2 pod drugim, u istom katalogu.

Ispravljeno tako što se naziv države sada svodi na jedan oblik **pri upisu**, a ne pri pretrazi. Razlika je bitna: da smo to rešavali pri pretrazi, svaki novi ekran bi morao da se seti da primeni isto pravilo, i pre ili kasnije neko bi zaboravio. Ovako je nemoguće upisati pogrešan oblik. Stari podaci su prevedeni.

---

## Šta još ne radi (namerno, i zna se zašto)

**AI čitanje sa sajta hotela još nije uključeno.** Ceo tok oko njega radi i testiran je — uvoz, pregled, odobravanje stavke po stavku — ali sam deo koji čita stranicu čeka odluku o tome koji AI servis koristimo. Do tada uvoz se jasno završi kao neuspeo, sa razlogom, umesto da se pravi da je uspeo.

**Osvežavanje sadržaja sa spoljnih sistema nije povezano.** Za proizvode koji dolaze sa API-ja postoji dugme „osveži", ali ono danas vraća poruku da to još nije napravljeno.

**Jedna greška koju sam našao dok sam pisao dokumentaciju 3.9.2026, i nije popravljena:** javni ulaz u katalog — jedini deo sistema koji radi bez prijave — ruši se sa opštom greškom „interna greška servera" ako se ne navede kanal, ili se navede pogrešan. Trebalo bi da vrati jasnu poruku šta nedostaje. Nije opasno (ništa ne curi, ništa se ne kvari) i sajt to nikad ne pogađa jer uvek šalje kanal, ali spoljni partner koji se prvi put povezuje naleteće na to i neće znati šta je pogrešio. Zapisano je kao neispunjena stavka u izlaznom kriterijumu M2 i kao zamka — čeka tvoju odluku da li da se popravi odmah.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md` u istom folderu i `docs/api/M2-katalog-proizvoda.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
