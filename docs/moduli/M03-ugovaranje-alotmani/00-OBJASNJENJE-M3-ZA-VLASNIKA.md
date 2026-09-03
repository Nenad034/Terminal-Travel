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

---

## Akcije: „rana rezervacija" i „plati 6, ostani 7"

Dve vrste akcija koje se pojavljuju u skoro svakom cenovniku. Kod njih postoji jedna zamka koju je lako napraviti:

**Prozor kada se rezerviše nije isto što i prozor kada se boravi.** „Rana rezervacija" znači: ako platiš do 31. januara, dobijaš 15% popusta na letovanje u julu. Datum rezervacije je januar, datum boravka je jul. Sistem ih čuva odvojeno upravo zato što se stalno mešaju, a posledica mešanja je akcija koja važi u pogrešnom mesecu.

---

## Kapacitet: dve prodaje u istoj sekundi ne mogu obe proći

Ako dva prodajna agenta u istom trenutku prodaju **poslednju** slobodnu sobu, šta se dešava?

Sistem umanjuje broj slobodnih soba jednim jedinim potezom u bazi, koji istovremeno proverava ima li još mesta i umanjuje. Baza garantuje da se dva takva poteza ne mogu preplesti. Rezultat: tačno jedan agent dobija sobu, drugi dobija jasnu poruku da nema mesta.

Ovo je **stvarno testirano**, ne pretpostavljeno — puštano je 10 istovremenih zahteva za jednu jedinu sobu i uvek je prošao tačno jedan.

Kad preostane samo jedna ili dve sobe, sistem sam javlja upozorenje modulu za nadzor (M18), da neko obrati pažnju.

---

## Uvoz cenovnika: AI čita, čovek potpisuje

Hoteli šalju cenovnike kao PDF ili Excel, svaki drugačije složen. Ideja je da AI pročita dokument i predloži redove, a zatim **čovek svaki red odobri**.

Ovde je napravljena odluka koja odstupa od uobičajene prakse i vredi da je znate. U većini sličnih alata postoji prag: ako je AI dovoljno siguran (recimo preko 85%), red prolazi sam, bez pregleda. **Kod nas takvog praga nema i neće ga biti.** Nijedan red ne postaje aktivna cena bez ljudske potvrde, bez obzira koliko je AI siguran.

Razlog: pogrešna nabavna cena ne pravi buku. Ona tiho menja maržu na svakoj rezervaciji iz tog ugovora i otkriva se tek kad se sabira zarada — možda mesecima kasnije. Kod većine drugih primena AI-a greška se odmah vidi i reklamira; ovde se ne vidi.

Isto pravilo postoji i za jednu sitniju stvar: ako se iz dokumenta ne vidi da li je cena **po sobi** ili **po osobi**, sistem odbija red umesto da pretpostavi. Razlika je dvostruka ili polovična cena.

---

## Šta još ne radi (namerno, i zna se zašto)

**AI čitanje cenovnika još nije uključeno.** Sve okolo radi — uvoz se registruje, redovi se mogu pregledati i odobriti, i to je testirano — ali sam deo koji čita PDF čeka odluku o tome koji AI servis koristimo. Do tada uvoz stoji u stanju „u obradi".

**Rate iz zakupa još ne stižu u finansije.** Kad se dogovori zakup sa planom plaćanja u tri rate, sistem te rate čuva, ali ih još ne prosleđuje modulu za finansije (M10) kao obavezu koja dospeva. Čeka da taj deo M10 bude napravljen.

**Sedam nalaza iz analize stvarnih ugovora čeka drugi krug.** Iz onih 55 cenovnika izašle su stvari za koje danas nema mesta u sistemu: hotel koji jednostrano zabrani prodaju („stop sale"), rok povrata kao fiksan datum umesto „N dana ranije", zabrana objave cene na javnom sajtu, obavezan minimalni markup koji hotel nameće, ograničenje na goste iz određenih zemalja. Nisu zaboravljene — zapisane su i čekaju, jer većina traži izmenu i u M5, ne samo ovde.

**Oslobađanje kapaciteta nema svoje dugme spolja.** Kad se rezervacija otkaže, M5 sam vrati sobu u slobodne. Ali ako neko preko API-ja ručno umanji kapacitet, ne postoji način da ga vrati istim putem. Nije problem u praksi, ali je pošteno da stoji zapisano.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md` u istom folderu i `docs/api/M3-ugovaranje-alotmani.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
