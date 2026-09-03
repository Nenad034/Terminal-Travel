# M5 (Rezervacije i tok prodaje) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M5 dobije značajnu izmenu.

---

## Prodavnica sa tri koraka: razgledaj, dogovori, potvrdi

Zamislite prodavnicu putovanja sa tri jasno odvojene tezge.

Na prvoj tezgi gost samo **razgleda** — traži hotel, datume, koliko ljudi putuje. Sistem mu pokazuje cene, ali te cene ni za šta ga ne obavezuju, kao cenovnik u izlogu — ništa se još ne "drži na stranu".

Kad gost izabere šta mu se sviđa, dolazi do druge tezge, **Ponuda** — sad se prave konkretni brojevi (nabavna cena + naša marža = cena za gosta), ali i dalje ništa nije zaključano kod hotela. Ponuda ima rok trajanja (obično 30 minuta) — kao rezervacija stola u restoranu koja propadne ako se ne potvrdi na vreme.

Tek na trećoj tezgi, kad gost kaže "da, hoću ovo", sistem stvarno **zove hotel/prevoznika** i traži da mu se soba/mesto zaključa. Ovo je namerno odvojeno od razgledanja — da ne bismo držali sobe "rezervisane" za ljude koji samo gledaju, i da nikad ne obećamo nešto što u međuvremenu neko drugi kupi.

## "Sve ili ništa" — kao kad kupujete više stvari odjednom

Ako gost rezerviše hotel + transfer u jednom paketu, a hotel kaže "da" a transfer kaže "nema mesta" — sistem **ne ostavlja pola posla urađeno**. Automatski otkazuje i hotel koji je već rezervisao, kao da se ceo pokušaj nikad nije desio, i kaže gostu tačno šta nije uspelo. Ovo je testirano uživo: kad smo simulirali da druga stavka padne, sistem je zaista pozvao "oslobodi" na prvoj stavci pre nego što je bilo šta drugo uradio.

## Vaučer — dokument koji dokazuje da je gost platio i da putuje

Vaučer se **ne štampa automatski čim se rezerviše** — čeka da gost stvarno plati u celosti. Ovo je namerna zaštita: ne želimo da izdamo dokument koji tvrdi da je nešto plaćeno, a nije.

Postoje dva izuzetka, oba svesno ograničena:
- **Ručni izuzetak** — samo Vlasnik ili Direktor mogu ručno reći "izdaj vaučer i bez pune uplate", uz obavezno obrazloženje koje ostaje trajno zabeleženo (ko je odobrio, kada, zašto). Nikad AI agent, nikad prodajni tim.
- **Automatski izuzetak za stalne B2B partnere** — ako je partner registrovan i unutar odobrenog kreditnog limita, vaučer izlazi automatski čim se rezervacija potvrdi, bez čekanja na uplatu. Ovo nije rizičnija rupa nego prva tačka — kreditni limit je već proveren pre same rezervacije, pa je ovo samo mehanička posledica odluke koja je već doneta, ne nova.

**Jedan vaučer po dobavljaču, ne jedan po rezervaciji (tvoja odluka, 3.9.2026).** Ako rezervacija sadrži hotel od jednog partnera i transfer od drugog, izlaze **dva** vaučera — svaki sa svojim uslugama i oznakom „Vaučer 1 od 2". Kad isti partner daje više usluga (soba + parking + spa u istom hotelu), sve idu na **jedan** dokument: tri odvojena papira za istu porodicu na istoj recepciji su tri prilike za grešku. Štampa daje po jedan list po vaučeru.

**Jedna stvar koja izgleda kao propust, a nije: na vaučeru ne piše ime dobavljača.** Postoji tvoje ranije pravilo da gost nikad ne vidi ko je dobavljač — jer dobavljač često nije hotel nego veletrgovac preko kog kupujemo, i to je poslovna informacija koja ne treba da izađe iz agencije. Zato se vaučeri **grupišu** po dobavljaču, ali se **zovu** po uslugama koje nose („Hotel Alexander The Great 4*"). Praktično je to isto ono što si hteo — gost predaje vaučer tog hotela sa svim uslugama tog partnera — samo bez podatka koji ne treba da vidi.

**Ono što se plaća na licu mesta piše i na vaučeru.** Iznos koji gost daje direktno hotelu (boravišna taksa, parking, depozit) stoji izričito označen, sa napomenom da **nije** uključen u cenu aranžmana. Prećutan trošak koji gost otkrije na recepciji je najbrži put do reklamacije, pa je bolje da ga vidi kod kuće.

## Slučaj koji je izazvao poseban "detektor duplikata"

Vlasnik je opisao stvaran problem iz prakse: isti gost je slučajno imao dve rezervacije za isti hotel/termin — jednu direktnu, jednu preko partnera. Operater je pomislio da je to duplikat, otkazao onu koja izgleda kao "višak" — ali hotel prati rezervacije po **imenu gosta**, ne po našem internom broju, pa je otkazivanjem jedne rezervacije hotel automatski otkazao i onu **drugu, ispravnu i već plaćenu** rezervaciju.

Sad, pre svakog otkazivanja, sistem sam proverava: "da li postoji neka druga aktivna rezervacija za isti hotel, isti period, sa sličnim imenom gosta?" Ako pronađe podudaranje, **ne otkazuje tiho** — zaustavi se i pokaže operateru na šta je naišao (koja druga rezervacija, da li je plaćena), i traži svesnu potvrdu "da, znam, ipak otkaži". Ovo je testirano uživo — sistem je prepoznao "Petar Petrović" i "Petar Petrovic" (bez kvačica) kao istu osobu i zaustavio se pre otkazivanja.

## Dobavljač nikad ne vidi šta gost vidi, i obrnuto

Gost nikad ne vidi interno ime/šifru hotela u našem sistemu niti bilo šta iz našeg ugovora s njim — vidi samo proizvod, datume, cenu i status. To je isto pravilo kao za katalog (M2), sad primenjeno i na rezervacije: testirano je da se poziv "iz ugla gosta" (B2C sajt, B2B partner) razlikuje od poziva "iz ugla našeg tima" (interni panel) — isti podatak, dva različita prikaza, sprovedeno u kodu, ne ostavljeno da se "front-end pobrine".

## Listе za dobavljača — ko dolazi, kad, koliko ljudi

Odvojeno od vaučera (koji ide gostu), postoji i dokument koji ide **od nas ka dobavljaču** — spisak ko stiže, kad, koliko ljudi (rooming lista za hotel, spisak putnika za prevoznika). Ovaj dokument **nikad ne sadrži cenu** — dobavljač već zna svoju ugovorenu cenu, to nije njegov posao da vidi našu maržu.

Priprema tog spiska je automatska (sistem sam predloži nacrt kad se približi datum boravka), ali **slanje je uvek ljudski klik** — sistem nikad sam ne šalje mejl dobavljaču, isti princip kao svuda gde novac/obaveze prelaze granicu ka nekom van firme.

Ako se rezervacija na već poslatoj listi izmeni ili otkaže posle slanja, sistem **ne menja tiho poslat dokument** — stara lista se obeleži kao zastarela, priprema se nova verzija, i opet čeka ljudski klik za slanje revizije.

## Ko sme šta — ista logika kao ostatak sistema

Vaučer bez pune uplate (ručni izuzetak) i slanje liste dobavljaču mogu samo Vlasnik/Direktor/Sales Manager (i to poslednje ne prodajni agent) — osetljive, novčane ili spoljne komunikacije imaju uži krug. Prodajni agent vidi i radi sa sopstvenim klijentima; Vlasnik/Direktor/Sales Manager vide sve. AI agent nikad ne sme sam da klikne "pošalji" ili "odobri vaučer" — može samo da pripremi nacrt, čovek uvek povlači poslednji potez.

## Pregled rezervacije sad pokazuje sve na jednom mestu, izmena usluge proverava cenu unapred

Ekran jedne rezervacije ima deset kartica (ko putuje, šta je kupljeno, uplate, prepiska, beleške...). Do sada je kartica "Pregled" pokazivala samo osnovno, a za sve ostalo je trebalo prelaziti na drugu karticu. Sad "Pregled" radi kao **sažetak celog dosijea** — sve što postoji na ostalim karticama vidi se odmah, na jednom mestu, bez klikanja. Ova kartica i dalje ništa ne menja — samo prikazuje; za izmenu bilo čega se i dalje ide na tu konkretnu karticu.

Na kartici "Aranžman" (šta je gost stvarno kupio) sad se, pored prikaza, može i **promeniti usluga** — na primer zameniti jedan hotel drugim, ili pomeriti datume — direktno na toj kartici, ne samo kroz posebnu karticu "Izmene". Pre nego što se izmena stvarno primeni, sistem prvo **pokaže novu cenu** ("trenutno 1.176 € → novo 1.240 €") i čeka da čovek to vidi i svesno potvrdi — cena se nikad ne menja "iza leđa". Zamena je dozvoljena samo unutar iste vrste usluge (hotel za drugi hotel, ne hotel za avionsku kartu) — to je smisleno "menjam istu stvar", ne pravljenje potpuno nove rezervacije.

## Putnici, uplate, prepiska i predstavnici — četiri manje dopune istog dana

**Putnici se sad mogu ispraviti direktno na kartici.** Ako je gost dao pogrešno ime pri rezervaciji, ili se naknadno pridruži još neko, na kartici "Putnici" se sad može dodati novi putnik, ispraviti postojeće ime, ili ukloniti pogrešan unos — bez odlaska na profil gosta (to je i dalje odvojeno, u M6, i ostaje netaknuto).

**Uplata se unosi tamo gde se rezervacija gleda.** Ranije se svaka uplata morala uneti na posebnom mestu (ekran "Fiskalni dokumenti"), pa se za rezervaciju koju baš gledate moralo prelaziti tamo. Sad postoji ista forma i direktno na kartici "Finansije" te rezervacije — unosi se na istom mestu, ide u istu evidenciju (M10), samo je unos bliži poslu koji se u tom trenutku radi.

**Komunikacija dobija filter, uz jasno upozorenje.** Kartica "Komunikacija" pokazuje CELU prepisku sa nalogodavcem, ne samo o ovoj rezervaciji (sistem to danas ne zna da razdvoji — objašnjeno već ranije u ovom dokumentu). Novi prekidač "Prikaži samo poruke o ovoj rezervaciji" pokušava da pogodi koje poruke pominju baš ovu rezervaciju, tako što traži broj rezervacije u tekstu poruke — nije prava veza, samo pretraga teksta. Ikonica pored prekidača to i kaže, da ne izgleda preciznije nego što jeste.

**Predstavnik na destinaciji sad ima punu vizit-kartu.** Kad se nekome dodeli da bude predstavnik na destinaciji za jednu stavku, sad se odmah vidi: ime, telefon, email, koju destinaciju pokriva i od kada do kada je tamo — sve na jednom mestu, i na kartici "Predstavnici" i u pregledu cele rezervacije. Ništa od ovoga nije novi podatak koji neko mora ručno da unosi na dva mesta — telefon/email dolaze sa naloga te osobe, destinacija i period sa same stavke rezervacije.

**I ovo se pojavljuje na vaučeru — vaučer je istog dana prvi put postao stvaran dokument.** Do sada je "vaučer" bio samo prazan link, bez sadržaja iza njega. Sad je to stvarna stranica koju gost otvara (bez prijavljivanja, isti link kao pre) — pokazuje šta je kupio, kad, ko putuje, i baš ono što je vlasnik tražio: ime, telefon i email predstavnika na destinaciji. Štampa se direktno iz browsera (Ctrl+P → sačuvaj kao PDF) — nije uveden nijedan novi spoljni servis za to. Ako se kasnije pokaže da treba lepše/profesionalnije oblikovan PDF, to je poseban, kasniji korak.

## Naknadno dodavanje usluge na rezervaciju (3.9.2026, tvoj nalaz)

Primetio si da rezervaciji nije moguće dodati dodatnu uslugu, i bio si u pravu: posle potvrde su postojale samo dve radnje — **zameni** stavku i **otkaži** je. Dodati nešto novo nije moglo. Sada može, i to na četiri načina koji pokrivaju ono što se u praksi javlja.

**1. Cela nova usluga.** Na kartici Aranžman stoji red ikonica — isti kao u pretrazi, jer je isti posao. Klik na ikonicu otvara prozor **u samoj rezervaciji** (ne vodi te u pretragu i ne gubiš kontekst): biraš uslugu, datume i putnike, klikneš **„Proveri cenu"**, vidiš koliko će rezervacija ukupno biti — i tek onda **„Dodaj uslugu"**.

Zašto dva koraka: cena kod dobavljača danas nije nužno ista kao juče, pa je bolje da je vidiš pre nego što se rezervacija promeni, nego posle. Isti obrazac već koristi izmena usluge.

Ovo radi bez obzira odakle rezervacija dolazi — i za usluge iz našeg ugovora i za one preko API veze — i dodata usluga **ne mora** biti istog porekla kao ostatak rezervacije.

**Dve stvari se dese same, da se ne bi zaboravile:** ukupno zaduženje se preračuna, i dobavljač ugovorene usluge odmah dobija **novu najavu** (nacrt liste koji čovek posle šalje). Najave koje su već poslate se ne diraju — nova stavka dobija svoju.

**2. Doplate i popusti** (parking, ljubimac, rani check-in, popust za treću osobu). Njih ne biraš iz kataloga nego iz **ugovora** — sistem ti pokaže šta je za taj period ugovoreno, sa cenom **već izračunatom za tu rezervaciju** (njene noći, sobe i putnike), ne golu cenu iz cenovnika.

Doplata se vezuje za uslugu kojoj pripada, ne stoji sama. Iz toga tri stvari ispadaju same od sebe: ako otkažeš sobu, otkazuje se i parking uz nju; doplata ide na vaučer i najavu **tog** hotela; a doplata koja se računa kao procenat noćne cene uopšte može da se izračuna — bez veze sa sobom ne bi imala od čega da uzme procenat.

**Obavezne doplate se dodaju automatski.** Ako je u ugovoru upisano da je nešto obavezno, sistem to povuče sam, a agent ručno bira samo opcione. Obavezna doplata koju treba ručno dodati pre ili kasnije nekome ispadne iz cene — a to se otkriva na recepciji, kad je već reklamacija.

**Ono što se plaća na licu mesta se vidi, ali se ne sabira.** Takav iznos ima svoju cenu, stoji odvojeno na ekranu sa jasnom oznakom, i **ne ulazi** u ukupno zaduženje rezervacije — jer ga agencija nikad ne naplati ni ne isplati. Da ulazi, svaki finansijski izveštaj bi pokazivao dug koji ne postoji.

**3. Usluga koje nema nigde** (dogovorena telefonom). Dugme „Ručni unos" — uneseš naziv, dobavljača, nabavnu i izlaznu cenu, i usluga ulazi u rezervaciju.

Tražio si četiri podatka: dobavljača, nabavnu cenu, maržu i izlaznu cenu. Marža je jedini koji **ne uneseš** — ona se računa kao razlika dve cene i vidi se uživo dok kucaš. Sa tri unosna polja, prvo pogrešno otkucano čini da se ne slažu, i onda niko ne zna koje je tačno.

**Kvačica „sačuvaj u katalog"** rešava staro pitanje: gde takva usluga živi. Bez kvačice ostaje samo na toj rezervaciji — postoji, ima cenu i dobavljača, ali se **ne vidi** ni u pretrazi, ni na sajtu, ni u B2B portalu. Sa kvačicom ulazi u katalog i sledeći put se bira kao svaka druga usluga. Tako katalog ne postane spisak jednokratnih unosa kroz koji niko ne može da pretražuje — što je tačno ono što se desilo u prethodnoj aplikaciji.

**Zašto je dobavljač obavezan.** Ne zbog administracije: bez njega ne mogu ni vaučer po dobavljaču ni najava po dobavljaču. Ugovorena usluga ima dobavljača kroz ugovor, API usluga kroz provajdera — ručna ga nije imala nigde, pa je to bilo polje koje je trebalo dodati.

**4. Ko sme.** Uslugu dodaje **isključivo interni tim**, i na rezervacijama subagenata — tvoja odluka. Subagent svoju rezervaciju vidi i sme da je otkaže, ali uslugu mu dodaje agencija. To nije stvar dozvole koja se može dodeliti: poziv iz subagentskog kanala se odbija bez obzira na prava.

## Šta još čeka (namerno, ne propust)

**Dva poznata nedostatka iz dopune od 3.9.2026, oba upisana da se ne izgube:**

- **Rezervacija ne razlikuje odrasle od dece.** Ponuda tu razliku ima, rezervacija je nikad nije imala — čuva se samo spisak imena putnika. Posledica: ako je u ugovoru doplata ograničena na „najviše dvoje dece do 7 godina", ta granica se pri dodavanju na rezervaciju **ne može proveriti** (svi putnici se broje kao odrasli). Sam obračun i granica ukupnog broja osoba rade ispravno. Rešenje traži tvoju odluku, jer dotiče i mobilnu aplikaciju (prijava gostiju na terenu).
- **Ručna usluga na PONUDI** još ide starom, nikad napravljenom zamisli sa posebnim zapisom. Na rezervaciji je rešena bez toga (usluga je „nacrt" proizvoda), pa kad ponuda dođe na red treba odlučiti prelazi li i ona na isti obrazac. Dok se ne počne, odluka ništa ne košta.

Neki delovi sistema koji su spomenuti u ovom modulu (garancija putovanja, kreditni limit B2B partnera, ugovor sa klijentom, zajedničko sanduče za mejlove ka dobavljačima) **još nisu izgrađeni kao posebni moduli** — kad M5 treba da ih pita nešto, trenutno dobija unapred dogovoren, bezopasan odgovor ("da, prođi") umesto da blokira ceo tok. Ovo je namerno privremeno rešenje, jasno obeleženo u kodu, koje će biti zamenjeno pravom logikom čim ti moduli dođu na red po faznom planu — ne slučajna rupa koja je "ispala".

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `06-SPECIFIKACIJA-M5-REZERVACIJE.md` u istom folderu i `docs/api/M5-rezervacije.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
