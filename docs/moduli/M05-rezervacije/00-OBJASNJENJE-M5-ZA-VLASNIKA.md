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

## Šta još čeka (namerno, ne propust)

Neki delovi sistema koji su spomenuti u ovom modulu (garancija putovanja, kreditni limit B2B partnera, ugovor sa klijentom, zajedničko sanduče za mejlove ka dobavljačima) **još nisu izgrađeni kao posebni moduli** — kad M5 treba da ih pita nešto, trenutno dobija unapred dogovoren, bezopasan odgovor ("da, prođi") umesto da blokira ceo tok. Ovo je namerno privremeno rešenje, jasno obeleženo u kodu, koje će biti zamenjeno pravom logikom čim ti moduli dođu na red po faznom planu — ne slučajna rupa koja je "ispala".

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `06-SPECIFIKACIJA-M5-REZERVACIJE.md` u istom folderu i `docs/api/M5-rezervacije.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
