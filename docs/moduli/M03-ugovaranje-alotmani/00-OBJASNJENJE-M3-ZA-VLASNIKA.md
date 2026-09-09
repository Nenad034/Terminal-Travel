# M3 (Ugovaranje i alotmani) — objašnjenje za vlasnika

Ovaj dokument objašnjava šta je napravljeno u M3 i **zašto**, običnim jezikom. Nije tehnički — za to postoje `04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` u istom folderu i `docs/api/M3-ugovaranje-alotmani.md`.

---

## Ukratko: M3 je strana na kojoj se kupuje, ne prodaje

Zamislite prodavnicu. Ono što kupac vidi na polici — cena, opis, slika — to je M2 (Katalog) i M5 (Prodaja). Ali pre nego što bilo šta stigne na policu, neko je morao da se dogovori sa dobavljačem: koliko komada, po kojoj nabavnoj ceni, do kad, šta ako ostane neprodato.

**M3 je taj zadnji deo prodavnice — magacin i papiri sa dobavljačem.** Ovde stoje nabavne cene, koje gost i subagent **nikad ne vide**. Gost vidi prodajnu cenu, koju M5 izračuna tako što na ovu nabavnu doda vašu maržu.

Zato je M3 zaključan strože od ostalih delova sistema: do njega imaju pristup samo Vlasnik, Direktor i Sales Manager. Prodajni agent vidi jednu jedinu stvar — koliko je soba još slobodno — jer bez toga ne može da prodaje.

---

## Četiri sprata: dobavljač → ugovor → sezona → cena

Sistem to čuva kao četiri nivoa, jedan u drugom, kao fascikle:

1. **Dobavljač** — hotel, prevoznik, osiguravač. Firma sa PIB-om i matičnim brojem.
2. **Ugovor** — konkretan papir sa tim hotelom, sa brojem, valutom i rokom važenja. Jedan hotel može imati više ugovora kroz godine.
3. **Sezona (period)** — unutar ugovora, vremenski komad sa svojim uslovima. „Leto 2027, dvokrevetne sobe" je jedna sezona, „zima 2027/28, iste sobe" je druga.
4. **Cena** — unutar sezone, cena za tačnu kombinaciju usluge i popunjenosti. „Polupansion, dvoje u sobi, 86 evra po sobi po noći."

Zašto ovoliko nivoa? Jer se u praksi svaki od njih menja nezavisno. Hotel ostaje isti, ugovor se obnavlja svake godine, sezone se unutar godine menjaju tri-četiri puta, a cene unutar sezone zavise od toga da li je doručak ili polupansion i koliko je ljudi u sobi. Da je sve na jednom mestu, promena jedne cene tražila bi prekucavanje svega ostalog.

---

## Četiri načina da se dogovori kapacitet — i zašto je razlika važna

Ovo je verovatno najvažnija stvar u celom modulu, jer se od nje razlikuje koliko novca rizikujete.

**„Alotman" (u sistemu `FIXED`)** — hotel vam drži, recimo, 40 soba do određenog roka. Ne plaćate ih unapred. Ako ne prodate, vraćate ih hotelu i ne dugujete ništa. Ovo je najbezbednije i najčešće.

**„Na upit" (`ON_REQUEST`)** — nemate ništa rezervisano. Svaki put kad gost hoće sobu, pitate hotel da li ima. Nema rizika, ali nema ni sigurnosti — gost mora da čeka odgovor.

**„Čarter" (`CHARTER`)** — uzeli ste određen broj mesta i **platićete ih bez obzira da li ih prodate**. Tipično za avionska mesta. Ovde postoji ukupna obaveza u evrima koja je vaša čim potpišete.

**„Zakup" (`FIXED_LEASE`)** — zakupili ste ceo objekat ili sprat za sezonu, sa dogovorenim ratama plaćanja. Najveći rizik i najveća moguća zarada.

Sistem za svaki od ova četiri traži **različita polja** i odbija da vas pusti dalje ako nešto nedostaje. Za alotman traži rok povrata; za čarter i zakup traži ukupnu obavezu u novcu, a rok povrata ni ne prihvata — jer kod njih ne postoji „vraćanje", već ste platili.

**Rok povrata** (`release`) je datum do kog morate hotelu javiti koje sobe ne prodajete. Propustite ga — plaćate i prazne sobe. Zato sistem ima poseban spisak „periodi kojima ističe rok, a još imaju neprodatih soba", koji se gleda u panelu i koji će AI agent kasnije pratiti umesto vas.

---

## Zašto sistem odbija da ugovor pusti u rad bez dva polja

Ugovor koji tek unosite stoji kao nacrt. Kad ga prebacujete u „aktivan", sistem staje ako niste popunili dve stvari:

**„Tip nastupanja"** — da li u tom poslu nastupate kao **organizator** putovanja ili kao **posrednik**. To nije formalnost: menja ko zakonski odgovara gostu ako nešto pođe naopako, i menja način na koji se izdaje račun.

**„Model provizije"** — da li je cena u ugovoru **neto** (vaša nabavna, na nju dodajete maržu) ili **bruto sa provizijom** (hotelova prodajna cena, vi dobijate procenat). Ako se ovo pogreši, marža na **svakoj** rezervaciji iz tog ugovora biće pogrešna, i to se otkriva tek pri obračunu — kad je kasno.

Namerno je napravljeno da vas zaustavi na ulazu, a ne da tiho prođe.

---

## Cena po uzrastu — mesto gde se najviše greši

Hoteli retko naplaćuju decu isto kao odrasle, i pravila su svakojaka: „prvo dete besplatno, drugo 50%", „deca do 12 godina 70% cene", „beba u krevecu ne plaća".

Sistem to čuva kao spisak pravila uz cenu, gde svako pravilo može da važi za određenu uzrasnu kategoriju i, ako treba, samo za dete koje je **po redu prvo** u sobi.

Dve odluke koje su ovde svesno napravljene:

**Granica uzrasta se piše kao 11.99, ne 12.** Jer „do 12 godina" je dvosmisleno — ulazi li dete koje je juče napunilo 12? Sa 11.99 nema šta da se tumači.

**Ako nijedno pravilo ne odgovara gostu, sistem odbija da napravi ponudu.** Ne pogađa, ne uzima „najbližu" cenu. Radije će vam reći „ne mogu" nego da pogodi — jer pogrešna dečja cena se otkrije tek na recepciji, pred gostom.

---

## Doplate i popusti — jedna struktura za oboje

Krajem avgusta smo prošli kroz 55 stvarnih cenovnika iz prakse i pokazalo se da hoteli doplate i popuste pišu na desetine načina: po osobi po noći, po sobi za ceo boravak, po kućnom ljubimcu, procenat od cene noćenja.

Umesto da za svaki napravimo posebnu tabelu, napravljena je **jedna** koja nosi i doplatu i popust. Razlikuje ih samo oznaka „doplata ili popust", dok je **iznos uvek pozitivan broj**. Da smo dozvolili minus za popust, dobili bismo dvostruku negaciju — popust od minus 30% koji se oduzima, pa doda.

Dve stvari koje su tu bitne za posao:

**Kad je doplata „po sobi", sistem obavezno traži koliko osoba ta soba pokriva.** Bez toga „doplata za sobu 20 evra" ne znači ništa — ne zna se kako da se rasporedi. Radije odbija unos nego da kasnije tiho pogrešno naplati.

**Doplata koja se plaća „na licu mesta" ne ulazi u ono što gost duguje vama** — ali se **ispisuje na ugovoru i na vaučeru**, da gost zna šta ga čeka na recepciji. Ovo je česta zamka: ko to previdi, sabere isti iznos dvaput.

**Ista doplata se unosi jednom, ne pedeset puta (dodato 9.9.2026).** Boravišna taksa važi za ceo hotel, a ne za jedan tip sobe u jednom mesecu. Zato doplata sada ima „domet": može da važi za **ceo ugovor**, za **jednu sezonu**, ili samo za **jedan period**. Unesete je jednom na nivou ugovora i pojavljuje se svuda gde treba.

Uz to je istog dana ispravljena greška koju je lako prevideti: prodavac je gledao samo doplate vezane za **jedan** period, pa taksu unetu na nivou ugovora **uopšte nije video** — postojala je u cenovniku, a u ponudi je nije bilo. Sada obe strane, i unos i prodaja, koriste **isto pravilo**, pa se više ne mogu razići.

**Jedna stvar namerno nije automatska.** Boravišna taksa često ima stepene po godinama (odrasli 1,50 / tinejdžeri 1,00 / deca 0,50). Rezervacija za sada čuva ime i prezime putnika, ali ne i datum rođenja — zato sistem **ne bira stepen sam**, jer bi u suprotnom dodao sva tri stepena istom gostu i naplatio trostruko. Umesto toga prodavcu prikaže sva tri sa naznačenim godinama („uzrast 0–11,99") i on izabere. Kad rezervacija jednog dana bude nosila i godine putnika, ovo može da postane automatsko — zapisano je gde treba, nije zaboravljeno.

**Marža na jednu jedinu sobu (dodato 9.9.2026).** Vi ste tražili da svaka stavka cenovnika može da se maržira posebno — u procentu, u iznosu, ili oba zajedno. To je napravljeno ranije istog dana, ali samo do pola: iznos se **upisivao** i lepo se video na ekranu, a **na cenu nije uticao**. Sad utiče. Izmereno na pravom primeru: soba nabavljena za 100,00 sa ugovornom maržom od 20% daje 120,00; ista takva soba kojoj ste upisali izuzetak „12% i još 5,00" daje 117,00. Isto važi i za doplatu — ako joj date sopstvenu maržu, ona pobeđuje; ako joj ne date ništa, ide sa maržom sobe uz koju stoji.

**Provizija subagentu, isto po stavci (dodato 9.9.2026).** Do sada je subagent dobijao jedan isti procenat na **sve** iz jedne ponude. To je značilo da mu je provizija išla i na boravišnu taksu — na kojoj mi ne zarađujemo ništa, pa nemamo ni šta da delimo. Sada svaka stavka može da nosi svoje: procenat, iznos, ili oznaku **„bez provizije"**. Ta oznaka namerno nije isto što i „0%": nula izgleda kao polje koje je neko zaboravio da popuni, a „bez provizije" je odluka koja se tako i vidi. Izmereno na pravoj ponudi: soba od 100,00 subagentu se zaračunava 90,00 (njegovih 10%), a taksa od 100,00 ostaje 100,00.

---

## Akcije: „rana rezervacija" i „plati 6, ostani 7"

Dve vrste akcija koje se pojavljuju u skoro svakom cenovniku. Kod njih postoji jedna zamka koju je lako napraviti:

**Prozor kada se rezerviše nije isto što i prozor kada se boravi.** „Rana rezervacija" znači: ako platiš do 31. januara, dobijaš 15% popusta na letovanje u julu. Datum rezervacije je januar, datum boravka je jul. Sistem ih čuva odvojeno upravo zato što se stalno mešaju, a posledica mešanja je akcija koja važi u pogrešnom mesecu.

**Istekla cena se više ne prodaje (dodato 9.9.2026).** Hotel često napiše „ova cena važi za rezervacije do 31.12." — to ste mogli da upišete i ranije, ali sistem taj datum **nije gledao pri prodaji**, pa bi se u januaru i dalje prodavalo po ceni koja je istekla. Sad se gleda: takva cena ne izlazi u pretrazi, a ako je neko izabere direktno, sistem je odbije i **kaže zašto** — „prozor za rezervisanje po ovoj ceni je zatvoren". Namerno ne bira tiho drugu cenu umesto nje: prodavac mora da zna da se cena promenila, a ne da mu se iznos promeni bez objašnjenja.

---

## Vikend cena i turnusi — dodato 9.9.2026

Tražili ste da se dani biraju **kao oznake**, ne kao gotova podela „radni dani / vikend". Razlog je vaš i tačan: vikend nije isti u svakom hotelu — kod vas su to petak i subota, jer se nedelja ne računa (gost te noći više ne spava kod nas).

Zato vikend cena **nije nova sezona** nego **drugi red u istom cenovniku**, sa svojim danima. Sezona ostaje pet, ne postaje deset.

**Šta sistem sam pazi:**

- Dva reda ne smeju pokrivati isti dan. Ako pokušate, upis se odbije i poruka kaže koji je dan sporan („petak") — inače bi za taj datum postojale dve cene, a sistem ne bi imao način da izabere.
- Ako neki dan ostane bez cene, **ne odbija** unos (inače prvi red nikad ne biste mogli da sačuvate, jer drugi još ne postoji), nego vam to piše kao upozorenje. Posledica je stvarna: za te datume nema ponude dok se cena ne doda.

**Kako se računa boravak koji prelazi preko oba reda.** Gost dolazi u subotu i ostaje sedam noći. Pet noći padaju u radne dane, dve u vikend. Sistem sabira po noćima: 5 × 100,00 + 2 × 140,00 = **780,00**. Ne uzima jednu cenu i množi sa sedam — to bi dalo ili 700,00 ili 980,00, i oba su pogrešna.

**Turnusi.** Na periodu možete reći: dolazak samo subotom, odlazak samo subotom, boravak 7 ili 14 noći. Ko traži nešto drugo, dobija jasnu poruku šta jeste dozvoljeno („Prijava je moguća samo: subota"), a ne prazan ekran.

---

## Kad dobavljač pošalje izmenu: potvrđujete razlike, ne ceo cenovnik — dodato 9.9.2026

Rekli ste: _„Moramo sve iz početka, menjamo ono što su oni promenili. AI agent može da vidi šta je promenjeno pa samo to da koriguje."_ Ovo je to, napravljeno.

**Šta se promenilo u praksi.** Cenovnik od dvesta redova u kom je dobavljač promenio deset cena više ne traži da neko pregleda dvesta redova. Ekran pokazuje **deset redova**: „Studio · sezona 1 · polupansion · dvokrevetna: 100,00 → 110,00". Vi potvrđujete tih deset.

**Verzija je fotografija cenovnika.** Kad potvrdite, sistem sačuva **ceo cenovnik onako kako izgleda u tom trenutku** i da mu redni broj — verzija 1, verzija 2, i tako dalje. Stara verzija se **ne briše nikad**. Razlog je praktičan: rezervacija napravljena u martu po ceni iz marta mora i za godinu dana da se objasni. Bez sačuvane fotografije, posle nekoliko izmena više niko ne bi mogao da kaže kako je cenovnik tada izgledao.

**Dva puta do iste stvari.**

- _Vi menjate ručno._ Ispravite ćeliju u tabeli cena kao i do sada. Kartica „Verzije" onda pokazuje šta se promenilo od poslednji put, i jedno dugme to zapiše kao novu verziju.
- _AI čita nov dokument (ili mu kažete rečenicom šta da promeni)._ Tu se **ništa ne upisuje dok ne potvrdite**. Mašina predlaže, vi birate. Ono što ne potvrdite ostaje na staroj ceni — i sistem vam u odgovoru izlišta šta ste odbili, da se ne izgubi ćutke.

**Šta sistem sam pazi:**

- Ne dozvoljava da snimite verziju u kojoj se ništa nije promenilo. Inače bi istorija postala spisak istih fotografija kroz koji se ne može tražiti kada se nešto promenilo.
- Ako se cenovnik promenio dok ste gledali razlike, potvrda se odbija sa porukom da razlike treba otvoriti ponovo — ne primenjuje nešto drugo od onoga što ste videli.
- Kad potvrdite da neka cena više ne postoji, ona se **gasi**, ne briše. Prodaja je više ne nudi, ali stara verzija je i dalje pokazuje.
- Kad je izmena tražena rečenicom, **ta rečenica se čuva uz verziju**. Bez nje se kasnije ne može utvrditi da li je AI pogrešno razumeo ili je baš tako i rečeno.

**Šta još nije spojeno.** Doplate i popusti se **vide** među razlikama, ali se kroz predlog cena ne menjaju — menjaju se na svom ekranu, pa se verzija snimi posle. Razlog: predlog nosi samo cene, a doplata traži još četiri podatka (po čemu se računa, za koji uzrast, da li je obavezna, gde se plaća). Ako pokušate da doplatu potvrdite tim putem, sistem to jasno kaže umesto da prećuti.

---

## Kapacitet: dve prodaje u istoj sekundi ne mogu obe proći

Ako dva prodajna agenta u istom trenutku prodaju **poslednju** slobodnu sobu, šta se dešava?

Sistem umanjuje broj slobodnih soba jednim jedinim potezom u bazi, koji istovremeno proverava ima li još mesta i umanjuje. Baza garantuje da se dva takva poteza ne mogu preplesti. Rezultat: tačno jedan agent dobija sobu, drugi dobija jasnu poruku da nema mesta.

Ovo je **stvarno testirano**, ne pretpostavljeno — puštano je 10 istovremenih zahteva za jednu jedinu sobu i uvek je prošao tačno jedan.

Kad preostane samo jedna ili dve sobe, sistem sam javlja upozorenje modulu za nadzor (M18), da neko obrati pažnju.

---

## Kalendar: mesto gde se greška u cenovniku vidi golim okom — dodato 9.9.2026

Vaša ideja: _„jedan kalendar sa mesecima za neki hotel za neki tip smeštaja za neki period pa mi vidimo cenu u kalendaru“_. Napravljeno.

Izaberete tip sobe, mesec i **sastav gostiju** (dvoje odraslih i dete od osam godina), i kalendar za svaki dan pokazuje cenu baš za taj sastav i koliko je jedinica slobodno.

**Čemu zapravo služi.** Ne toliko da se vidi cena — nju vidite i u tabeli. Služi da se vidi **greška**. Pogrešno unet datum u tabeli izgleda kao svaki drugi datum. U kalendaru se isti taj previd vidi kao rupa u nizu ili kao skok cene tamo gde ga ne očekujete. To je jedina razlika, i zbog nje ekran postoji.

**Prazan dan nikad ne ćuti.** Ako za neki dan nema cene, kalendar kaže **zašto**: dan je van ugovorenog perioda, ili za taj dan u nedelji nije uneta cena (vikend red koji ste zaboravili), ili je prozor prodaje te cene istekao, ili cenovnik nema cenu za dete tih godina. Prazan kvadratić bi izgledao isto bez obzira da li je cenovnik nepotpun ili je ekran pokvaren — ovako se to razlikuje.

**Tri sitnice koje vredi znati:**

- Cena u kvadratiću je za **jednu noć koja počinje tog dana**. Dan odlaska nije noć, pa ga i nema.
- Kad je cena ugovorena **za ceo boravak**, a ne po noći, kalendar to izričito kaže — da se iznos ne pročita kao noćna cena.
- Dan kad hotel ne prima goste (turnus — prijava samo subotom) i dalje pokazuje cenu, ali nosi oznaku „bez prijave“. Bez toga bi kalendar obećavao nešto što prodaja odbija.

Isto važi i za dan kad je hotel zatvorio prodaju: cena ostaje vidljiva, uz crvenu oznaku. Cena i odluka o prodaji su dve različite stvari — cena i dalje važi, samo se tog dana ne prodaje.

**Ovaj ekran ništa ne menja.** Cene se i dalje menjaju u tabeli cena, kapacitet na svom ekranu. Kalendar samo gleda.

---

## Uvoz cenovnika: AI čita, čovek potpisuje

Hoteli šalju cenovnike kao PDF ili Excel, svaki drugačije složen. Ideja je da AI pročita dokument i predloži redove, a zatim **čovek svaki red odobri**.

Ovde je napravljena odluka koja odstupa od uobičajene prakse i vredi da je znate. U većini sličnih alata postoji prag: ako je AI dovoljno siguran (recimo preko 85%), red prolazi sam, bez pregleda. **Kod nas takvog praga nema i neće ga biti.** Nijedan red ne postaje aktivna cena bez ljudske potvrde, bez obzira koliko je AI siguran.

Razlog: pogrešna nabavna cena ne pravi buku. Ona tiho menja maržu na svakoj rezervaciji iz tog ugovora i otkriva se tek kad se sabira zarada — možda mesecima kasnije. Kod većine drugih primena AI-a greška se odmah vidi i reklamira; ovde se ne vidi.

Isto pravilo postoji i za jednu sitniju stvar: ako se iz dokumenta ne vidi da li je cena **po sobi** ili **po osobi**, sistem odbija red umesto da pretpostavi. Razlika je dvostruka ili polovična cena.

---

## Izmena cenovnika rečima — dodato 9.9.2026

Tražili ste: _„omogućio bih da AI agent ima sposobnost da mu kažemo šta treba da izmeni kada su manje izmene… da to izmeni, prikaže, sačeka naše odobrenje i primeni izmene.“_ Napravljeno.

U kartici „Izmena rečima“ napišete izmenu onako kako biste je rekli kolegi:

> _cene za sezonu 4 i 5 idu gore 5%, rok za otkazivanje alotmana u sezoni 5 je sada 14 dana umesto 10, uvode doplatu za parking 5 € po sobi po noći koja se plaća na licu mesta, rani buking 2. krug se ukida._

Sistem tu rečenicu razloži i pokazaže vam **šta je razumeo**, deo po deo, pa tek onda šta bi se promenilo: _sada 62,00 → postaje 65,10_. Ništa nije upisano dok ne označite šta prihvatate.

**Najvažnije: AI ne računa.** On samo razume šta ste tražili — „gore 5 posto“ — a same iznose računa sistem. To nije sitnica: jezički model ume da pogreši u računu i da tu grešku napiše samouvereno, a pogrešna nabavna cena ne pravi buku nego tiho menja zaradu na svakoj rezervaciji iz tog ugovora. Zato mu polje za cenu nije ni dato — ne može da pošalje broj koji je sam izračunao.

**Svaku izmenu odobravate posebno.** Postoji „prihvati sve“ zbog brzine, ali nijedna kvačica nije unapred označena. Razlog: ako je od četrnaest izmena jedna pogrešno shvaćena, ne sme da prođe zato što je ostalih trinaest tačno.

**Vaša rečenica se čuva uz nastalu verziju.** Bez nje se kasnije ne može utvrditi da li je AI pogrešno razumeo ili je baš tako i rečeno.

**Ono što ovaj put ne ume, kaže vam otvoreno.** Od one četiri izmene iz primera, dve se primenjuju same (cene i — uz prikaz — nova doplata), a dve ne: rok otkazivanja i ukidanje rane rezervacije. Te dve se ne prećutkuju nego se izlištaju sa uputstvom na kom se ekranu rade. Doplata se takođe prikaže sa svim podacima, ali je dodajete na ekranu doplata — razlog je isti kao ranije: doplata traži još četiri podatka koje predlog cena ne nosi.

**Ako rečenica nije jasna, sistem pita umesto da pogađa.** To je ista ograda kao kod uvoza cenovnika, i postoji iz istog razloga.

---

## Šta još ne radi (namerno, i zna se zašto)

**AI čitanje cenovnika još nije uključeno.** Sve okolo radi — uvoz se registruje, redovi se mogu pregledati i odobriti, i to je testirano — ali sam deo koji čita PDF čeka odluku o tome koji AI servis koristimo. Do tada uvoz stoji u stanju „u obradi".

**Rate iz zakupa još ne stižu u finansije.** Kad se dogovori zakup sa planom plaćanja u tri rate, sistem te rate čuva, ali ih još ne prosleđuje modulu za finansije (M10) kao obavezu koja dospeva. Čeka da taj deo M10 bude napravljen.

**Sedam nalaza iz analize stvarnih ugovora čeka drugi krug.** Iz onih 55 cenovnika izašle su stvari za koje danas nema mesta u sistemu: hotel koji jednostrano zabrani prodaju („stop sale"), rok povrata kao fiksan datum umesto „N dana ranije", zabrana objave cene na javnom sajtu, obavezan minimalni markup koji hotel nameće, ograničenje na goste iz određenih zemalja. Nisu zaboravljene — zapisane su i čekaju, jer većina traži izmenu i u M5, ne samo ovde.

**Oslobađanje kapaciteta nema svoje dugme spolja.** Kad se rezervacija otkaže, M5 sam vrati sobu u slobodne. Ali ako neko preko API-ja ručno umanji kapacitet, ne postoji način da ga vrati istim putem. Nije problem u praksi, ali je pošteno da stoji zapisano.

---

_Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` u istom folderu i `docs/api/M3-ugovaranje-alotmani.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih._
