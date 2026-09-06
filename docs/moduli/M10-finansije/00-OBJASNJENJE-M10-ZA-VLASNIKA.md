# M10 (Finansije i računovodstvo) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M10 dobije značajnu izmenu.

---

## Šta M10 zapravo radi

Kad se rezervacija potvrdi (M5), neko mora da: (1) izda pravno važeći dokument o prodaji (fakturu ili fiskalni račun), (2) prati da li je gost platio, i (3) prati koliko mi dugujemo hotelima/prevoznicima za tu istu rezervaciju. To je M10 — knjigovodstvo agencije, ne samo "još jedan ekran".

## Faktura ili fiskalni račun — sistem sam bira, ne pogađa čovek

Zakon pravi razliku: ako prodajemo firmi (pravno lice), ide **e-faktura kroz državni sistem SEF**. Ako prodajemo osobi (fizičko lice), ide **fiskalni račun**, kao u svakoj prodavnici. Sistem ovo **ne pita nikoga** — čim rezervacija ima podatak da li je kupac firma ili osoba, sam odredi koji dokument treba, testirano oba pravca uživo.

## Dva koraka za slanje fakture — nacrt pa čovek klikne "pošalji"

Priprema fakture (računanje iznosa, poreza, konverzija u dinare) radi sistem sam, čim se rezervacija potvrdi — ovo je bezopasno, ništa još nije poslato nikome spolja. Ali **stvarno slanje ka državnom sistemu (SEF) ili fiskalnom uređaju je uvek ljudski klik** — Računovođa, Direktor ili Vlasnik, nikad AI agent. Razlog: slanje pravi pravno obavezujući dokument koji se ne može tiho povući ako je nešto pogrešno. Testirano: pokušaj slanja preko API-ja bez odgovarajuće dozvole se odbija — nije samo "dugme sakriveno u ekranu", nego stvarno onemogućeno na nivou sistema.

## Novac se čuva u parama/centima, ne u decimalnim brojevima

Zvuči tehnički, ali je važno: kompjuteri koji čuvaju novac kao "decimalni broj" (1234,56) posle mnogo sabiranja/množenja/konverzija znaju da "izgube" par para zbog zaokruživanja — retko, ali se desi, i teško se pronalazi zašto. Zato ceo sistem (ne samo M10) čuva novac kao **celobrojan iznos u najmanjoj jedinici** (1234,56 RSD = 123456 para) i tek na ekranu ga formatira lepo. Ovo smo proverili na svakom novčanom polju u M10 — nijedno nije "decimalni broj", provereno automatskim testom.

## Kurs dinara — na dan kad je gost stvarno platio, ne na dan kad smo napravili nacrt

Ako ugovor sa hotelom glasi na evre, faktura gostu ipak mora biti u dinarima. Koji kurs se koristi? Sistem prvo napravi nacrt sa kursom "od danas" (jer se nacrt pravi odmah, često pre nego što je gost uopšte platio), ali **pre stvarnog slanja fakture, ponovo proveri** da li je u međuvremenu stigla uplata, i ako jeste, koristi kurs sa dana te uplate — testirano da se iznos stvarno ispravno preračuna kad se kurs u međuvremenu promeni.

## Zašto su izveštaji o naplati bili prazni — i šta je popravljeno (6.9.2026)

Sistem svako jutro sam preuzme kurs sa sajta Narodne banke. Ali preuzimao je **samo kurs za taj dan** — ništa više. To zvuči dovoljno, dok se ne pogleda šta se dešava kad taj jutarnji posao jednom ne prođe: server je bio ugašen, sajt Narodne banke nedostupan, ili je sistem tek postavljen. Tada taj dan **zauvek** ostane bez kursa, jer ništa nikad ne pokuša ponovo.

Zamislite svesku u koju svako jutro upisujete kurs. Ako preskočite jedno jutro, ta stranica ostaje prazna dok je neko ručno ne popuni — a niko ne zna da je prazna.

Posledica nije bila poruka o grešci, nego **tišina**. Uplata u evrima na dan bez kursa jednostavno se ne bi preračunala u dinare, pa ne bi ni ušla u izveštaje. Izveštaj o naplati bi bio prazan, a ništa na ekranu ne bi reklo zašto. Zatečeno stanje: 12 uplata u evrima, u celoj bazi dva zapisa kursa — nijedan na dan tih uplata ni pre njih.

Popravljeno na dva načina:

1. **Sistem sada ume da pita za stariji dan.** Isti javni sajt Narodne banke ima i pretragu po datumu; sistem je sada koristi. Proverio sam da čita tačno ono što treba, tako što sam tražio kurs za dan koji već imamo u bazi i uporedio — poklopilo se do poslednje decimale.
2. **Jutarnji posao sam krpi rupe.** Posle današnjeg kursa proveri poslednjih mesec dana i dovuče svaki dan koji nedostaje. Kratak prekid rada se tako zatvori sam, bez ijedne vaše radnje.

Za dublju istoriju (period pre nego što je sistem uopšte postojao) postoji zasebna komanda koja se pokrene jednom. Pokrenuo sam je za period od maja: uvezena su 84 dana, nijedan pokušaj nije propao.

Dve stvari koje je vredno znati:

- **Vikendom i praznikom kurs se ne objavljuje.** Kad se pita za nedelju, Narodna banka vrati petkovu listu. Sistem to prepozna i upiše je pod **petkom**, ne pod nedeljom — inače bi vikend dobio izmišljen sopstveni kurs koji nikad nije postojao.
- **Ništa se ne prepisuje.** Dan koji već ima kurs se preskače, uključujući i kurseve unete ručno.

Rezultat, proveren na živim podacima: svih 12 uplata je sada u izveštajima, i svaka je preračunata po kursu **svog** dana (117,4175 za 29. maj, 117,3823 za 8. jun, i tako dalje), ne po jednom istom kursu za sve.

**Kursna lista sada ima i svoj ekran** (Finansije → Kursna lista). Do 6.9.2026. kurs se nije mogao ni pogledati ni ručno uneti kroz aplikaciju — postojao je samo automatski uvoz. Sada na tom ekranu vidite sve kurseve, sa jasnom oznakom da li je zapis došao iz Narodne banke ili ga je uneo čovek, i možete uneti kurs ručno ako automatika zakaže. Ako je poslednji kurs stariji od tri dana, ekran vas na to sam upozori (tri dana, a ne jedan, jer se vikendom kurs ne objavljuje — inače bi vas alarmirao svake subote bez razloga).

Jedna sitnica koja je usput popravljena: ako pokušate da unesete kurs za dan koji ga već ima, dobijate jasnu poruku umesto opšte greške. Postojeći kurs se **ne prepisuje** — kurs po kom je nešto već obračunato ne sme se naknadno promeniti pod nogama računima koji se na njega pozivaju.

## Kad gost plati karticom — plaćanje ide PRE potvrde rezervacije

Za bankovni prenos, logika je "prvo rezervacija, pa čekamo uplatu" (partneri i firme rade tako). Ali za karticu na sajtu, gost očekuje da mu se sve desi u jednom kliku "Plati i rezerviši". Zato je tu redosled **obrnut**: prvo se kartica naplati, tek onda sistem pokuša da potvrdi rezervaciju. Ako se ispostavi da je u međuvremenu neko drugi kupio poslednje mesto — **novac se automatski vraća gostu**, i nijedna polovična rezervacija ne ostaje da "visi". Testirano uživo: simulirali smo da rezervacija u poslednjem trenutku ne uspe, i sistem je zaista vratio novac i ništa nije kreirao.

Mi **nikad ne vidimo niti čuvamo broj kartice** — gost ga unosi direktno kod sertifikovanog platnog provajdera (kao kad plaćate na sajtu velike aviokompanije), mi dobijamo samo potvrdu "uspelo/nije uspelo".

## Šta dugujemo dobavljačima — knjiži se samo, sam sistem ne plaća

Čim se rezervacija potvrdi, sistem sam zabeleži "dugujemo hotelu X toliko i toliko, do tog datuma" — čisto informativno, isti princip kao kad dobijete račun u poštansko sanduče, niko automatski ne plaća umesto vas. Da bismo stvarno platili, mora prvo neko (Računovođa) da **odobri** taj dug (i po potrebi ispravi iznos ako se razlikuje od stvarne fakture), a tek onda neko (Vlasnik/Direktor) da **izvrši** stvaran prenos novca. Dva odvojena koraka, dva različita nivoa ovlašćenja — isti obrazac kao slanje fakture gostu.

## Kad gostu treba vratiti novac (van kartice)

Ako je gost platio bankovnim prenosom ili gotovinom, a treba mu vratiti deo ili sav novac (otkazivanje, popust), to ide kroz isti dvostepeni obrazac: prvo neko **odobri** povraćaj, tek onda neko **izvrši** stvaran prenos — nikad u jednom koraku, nikad AI agent ni na jednom od ta dva koraka.

## Automatski uvoz ulaznih faktura dobavljača — priprema da, upis ne

Kad stigne prava faktura od hotela (mejlom, PDF-om), sistem ume da je "pročita" i predloži na koju našu evidentiranu obavezu se odnosi — poredi ime gosta i datume, ne nagađa napamet. Ako je siguran (85%+ podudaranje), predloži spajanje; ako nije siguran, ostavlja Računovođi da ručno poveže. Ali čak i kad je siguran, **ništa se stvarno ne upisuje dok Računovođa ne potvrdi** — isti princip "AI predlaže, čovek odobrava" kao svuda u sistemu. Napomena: sama veština "pročitaj PDF fakture" (OCR/AI ekstrakcija) još čeka odluku o tome koji AI provajder se koristi — mehanizam koji poredi i predlaže je već izgrađen i testiran, samo čeka da mu neko prosledi pravi tekst iz dokumenta.

## Podsetnici koji nikad sami ne diraju rezervaciju

Sistem prati nekoliko rokova sam: da li je gost platio akontaciju na vreme, da li je platio ostatak pre polaska, da li smo mi platili dobavljača na vreme, da li je faktura poslata a nije stigao odgovor. Kad rok prođe, prvo se pojavljuje blago upozorenje, a ako se ništa ne desi još neko vreme, upozorenje postaje hitno (drugačije obaveštenje tima). Ali u svakom slučaju — **sistem sam nikad ne otkazuje niti menja rezervaciju** zbog probijenog roka. On samo viče "pogledajte ovo", odluku uvek donosi čovek.

## Više načina da se zabeleži uplata

Do sada je ručni unos uplate imao samo dve opcije: bankovni prenos ili gotovina. Sad ih ima pet — dodate su **kreditna kartica** (kad neko plati karticom van našeg online sistema, npr. na POS terminalu u kancelariji), **ček** i **administrativna zabrana**.

Za bankovni prenos i za karticu se sad bira **iz koje je banke** — postoji spisak od 18 poznatih banaka koje rade u Srbiji, unet ručno (nije povučen iz zvaničnog registra Narodne banke, pa ako nešto fali ili je zastarelo, javite da se doda/ispravi).

**Ček je poseban slučaj.** Jedna uplata čekom retko je jedan fizički papir — često je nekoliko čekova odjednom, svaki sa svojom bankom, iznosom, brojem i datumom kad dospeva na naplatu. Zato forma za ček ne traži samo jedan podatak, nego dozvoljava da se doda onoliko čekova koliko ih stvarno ima ("dodaj ček" dugme) — a sistem sam proveri da zbir svih čekova mora tačno da se poklopi sa ukupnim iznosom uplate, inače ne dozvoljava da se sačuva.

## Ispravka pogrešno unete uplate — samo dok račun nije poslat

Ručni unos, pogotovo specifikacije čekova (nekoliko čekova, svaki sa svojom bankom/brojem/datumom), lako se pogrešno otkuca. Sad postoji dugme "izmeni" pored svake uplate koja sme da se koriguje — otvara istu formu kao unos, samo popunjenu postojećim podacima, i posle klika na "sačuvaj izmenu" red se sam vrati na prikaz sa novim vrednostima.

Dugme se pojavljuje samo kad je izmena stvarno dozvoljena — sistem, ne čovek, odlučuje kad nije: **kartične uplate** (koje idu automatski preko banke online) se nikad ne mogu ručno menjati, a nijedna uplata se ne može menjati **pošto je za tu rezervaciju već poslat račun ili fiskalni dokument** — jednom kad je taj dokument stvarno otišao (ne dok je samo pripremljen kao nacrt), ispravka bi značila da se menja nešto što je već zvanično prijavljeno, pa je tu tačku sistem postavio kao granicu bez izuzetka.

Svaka izmena se **beleži u log** — ko je promenio, kad, i tačno šta je bilo pre a šta posle (isti mehanizam koji već čuva sve druge promene u sistemu, i koji niko, čak ni programer, ne može naknadno da obriše ili prepravi).

## Šta još čeka (namerno, ne propust)

- **Tačan tehnički način razgovora sa državnim sistemom SEF i fiskalnim uređajima** još nije definisan — to zahteva zvaničnu tehničku dokumentaciju i potvrdu knjigovođe, ne pretpostavku unapred. Ceo unutrašnji tok (nacrt → slanje → praćenje) je izgrađen i testiran, samo je "poslednja milja" ka spoljnom sistemu privremeno simulirana.
- **Izbor konkretnog platnog provajdera za kartice** (ko konkretno prima kartice gostiju) još nije odabran — sistem je napravljen tako da promena provajdera kasnije ne zahteva prepravku ostatka koda.
- **Ograničenje gotovine** (koliko se sme primiti u kešu) je na izričit zahtev vlasnika uklonjeno iz sistema — sistem to više ne blokira automatski, odgovornost je na proceduri tima; ovo nosi pravni rizik koji treba proveriti sa pravnikom pre pune upotrebe.
- **Kad kupac ne odgovori na fakturu u zakonskom roku (15 dana)** — sistem tačno računa taj rok, ali još nema automatsku promenu statusa kad rok istekne; dodaje se u sledećem prolazu.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `07-SPECIFIKACIJA-M10-FINANSIJE.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje ga.*
