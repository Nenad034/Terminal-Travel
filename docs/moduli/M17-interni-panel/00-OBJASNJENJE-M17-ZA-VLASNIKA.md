# M17 (Interni radni panel) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

Do sada smo napravili motor (M1-M14, M16, M20) — sve funkcioniše, ali samo kroz programske pozive koje testovi rade automatski, ne kroz nešto što bi neko iz tima mogao da klikne. M17 je **prvi ekran** — aplikacija kroz koju Vaš tim (Vi, Direktor, prodajni agenti, računovođa) stvarno radi svakodnevni posao: unosi proizvode, ugovara sa dobavljačima, pretražuje i rezerviše za goste.

Zamislite da smo do sada napravili kompletnu unutrašnjost restorana — kuhinju, magacin, kasu koja radi — ali nema ulaznih vrata ni stolova. M17 je ulaz i sala. Ono što se kuva (M2 katalog, M5 rezervacije, M10 finansije...) već postoji i radi ispravno; M17 je mesto gde to postaje nešto što čovek stvarno koristi.

## Zašto je urađen baš sada

M17 raste postepeno — svaki modul dobija svoj ekran u panelu tek kad taj modul bude gotov iza kulisa. Do sada smo završili M1-M14, M16 i M20 na backend strani, pa je konačno bilo dovoljno gotovih delova da prvi pravi ekran ima smisla. Ovaj prvi prolaz pokriva ono što spec zove "Faza 0 i Faza 1" — prijava i osnovni alati za prodaju (katalog, ugovori, pretraga i rezervacije).

## Šta tačno možete da radite kroz panel sada

- **Prijava** — sa lozinkom i obaveznim dvofaktorskim kodom (isti nivo bezbednosti kao internet bankarstvo), pošto interni tim ima pristup osetljivim podacima.
- **Početna strana (dashboard)** — vidite ko ste prijavljeni, Vašu ulogu, i (ako ste Vlasnik/Direktor) trag svega što se u sistemu desilo (audit log).
- **Katalog proizvoda** — spisak svih proizvoda, sa mogućnošću da ručno dodate nov (npr. hotel, izlet).
- **Dobavljači i ugovori** — spisak dobavljača i ugovora, sa mogućnošću unosa novih.
- **Pretraga i rezervacije** — pretražite šta imate na raspolaganju (po destinaciji, datumu, broju gostiju), izaberete ponudu, unesete podatke gosta, i potvrdite rezervaciju — potpuno isti tok kao kad gost rezerviše preko sajta, samo sad Vaš tim to radi ručno (npr. gost zove telefonom).
- **Kalendar rezervacija** — mesečni pregled ko dolazi, ko odlazi, ko je u toku boravka, po danu.

## Šta izgleda kao Chrome/VS Code, i zašto

Dogovorili smo se ranije da panel radi po obrascima koje ljudi već znaju iz svakodnevnog korišćenja kompjutera — ne izmišljamo novi način rada, samo ga oblačimo u naš sopstveni vizuelni identitet. Konkretno:

- **Tanka traka ikonica sa leve strane** (kao VS Code) — moduli koji još nisu gotovi se vide, ali zaključani, sa oznakom faze kad dolaze na red — da znate šta dolazi, ne samo šta postoji.
- **Traka "tabova" na vrhu** (kao pretraživač) — možete da imate otvoreno više rezervacija/zapisa istovremeno i da se prebacujete među njima, bez da izgubite mesto na kom ste stali.
- **Skrivena "komandna paleta"** (`Ctrl+K`) — umesto klikanja kroz menije, pritisnete taster i otkucate šta tražite. Prazan upit vam pokaže sve što možete da otvorite; kad dodamo pravu AI pretragu (čeka poseban modul, M15), moći ćete i da postavite pitanje prirodnim jezikom ("koje rezervacije čekaju fakturu").
- **Tamni i svetli mod** — panel prati podešavanje Vašeg računara, uz mogućnost ručnog prekidača.

## Jedna stvar koju smo usput otkrili i popravili

Dok smo gradili ekran za pretragu, otkrili smo da pretraga s internog panela nikad zapravo nije mogla da radi — mehanizam koji određuje "gde se proizvod prikazuje" (sajt, B2B portal, mobilna app) nikad nije uključivao "interni panel" kao opciju, jer do sada niko nije stvarno pozvao pretragu na taj način (postojali su samo automatski testovi, ne stvaran ekran). Ispravili smo to — sad Vaš tim vidi svaki aktivan proizvod, bez obzira da li je već objavljen na sajtu ili ne (logično, jer prodajni agent mora da može da proda nešto i pre nego što je to javno vidljivo, npr. dogovor telefonom pre zvanične objave).

## Faza 2 — Finansije, Compliance, Ugovori sa klijentima (avgust 2026)

Sledeći sloj ekrana: ono što je bilo "gotovo iza kulisa" u M10 (Finansije), M11 (Compliance) i M20 (Ugovori sa klijentima) sad ima svoj ekran, isto kao što je Faza 1 dala ekran M2/M3/M5.

- **Finansije (M10)** — svaka potvrđena rezervacija automatski dobija nacrt fiskalnog dokumenta (fakture ili računa), ali njega mora **čovek** — Računovođa, Direktor ili Vi — da pregleda i svesno pošalje. To nije slučajno: slanje fiskalnog dokumenta je zakonski nepovratan korak (kao da ste odštampali i predali račun), pa sistem to nikad ne radi sam. Na stranici svake rezervacije sad postoji dugme "Pripremi/prikaži fiskalni dokument" koje vodi na ekran sa jednim jasnim dugmetom "Potvrdi i pošalji fakturu". Tu se vide i sve uplate za tu rezervaciju, sa mogućnošću da Računovođa ručno unese uplatu primljenu na račun ili u gotovini. Poseban ekran "Finansije" u meniju pokazuje šta zahteva pažnju: rezervacije bez fakture, obaveze prema dobavljačima koje čekaju odobrenje, i probijene rokove naplate od gosta.
- **Compliance (M11)** — "garancija putovanja" je zakonski uslov da agencija uopšte sme da prodaje organizovana putovanja (osiguranje da gost dobije novac nazad ako agencija propadne usred sezone). Novi ekran "Compliance" pokazuje trenutnu garanciju, koliko je od nje "potrošeno" prodatim aranžmanima, i da li je svaka pojedinačna rezervacija uspešno prijavljena u državni registar (CIS) — sa dugmetom da se pokuša ponovo ako prijava nije prošla.
- **Ugovori sa klijentima (M20)** — zakonski obavezan ugovor koji gost/nalogodavac dobija uz svaku rezervaciju (šta je kupio, po kojoj ceni, koji su uslovi otkazivanja) se već pravi sam, automatski, čim se rezervacija potvrdi — ovo nije novo, samo do sada niko iz tima nije mogao da ga *vidi*. Novi ekran "Ugovori sa klijentima" pokazuje listu svih generisanih ugovora, njihov sadržaj, i omogućava da prodajni agent ručno zabeleži kad gost pošalje potpisan primerak (za goste koji nisu rezervisali preko sajta, gde se to beleži samo klikom).

**Jedna stvar koju smo usput otkrili i popravili (M11):** ekran koji prikazuje "koliko je garancije potrošeno" je do sada vraćao grešku umesto podataka, u svakom trenutku kad je u bazi postojala makar jedna rezervacija u stranoj valuti za koju nije bio unet kurs dinara. Jedna takva rezervacija je rušila *ceo* prikaz za sve, ne samo za tu jednu stavku — kao da bi jedan pogrešno upisan red u tabeli obarao ceo izveštaj. Ispravili smo da sistem tu jednu rezervaciju sad samo preskoči (uz zabeležen trag u dnevniku), a ostatak prikaže normalno. Usput smo primetili da isti tip greške postoji i na mestu koje **blokira** potvrdu rezervacije (ne samo prikaz) — to namerno nismo sami ispravili, jer bi pogrešan izbor tu mogao da propusti rezervaciju kroz zakonsku proveru bez stvarne provere; to čeka Vašu odluku (zapisano u specifikaciji M11, poglavlje "Otvoreno za dalje").

## Faza 3 — Gosti i nalogodavci, CRM (avgust 2026)

Do sada je svaki gost/nalogodavac postojao samo kao ime uz rezervaciju — nije bilo mesta gde tim vidi *ko je ta osoba* kroz vreme: da li je već putovala sa nama, kakva je istorija komunikacije, da li ima poseban status lojalnosti. Novi ekran "CRM" (skraćenica za upravljanje odnosima sa klijentima) to menja.

- **Nalogodavci** (ko plaća — može biti osoba ili firma) — lista sa pretragom po email-u ili PIB-u, detalj sa kontakt podacima, statusom lojalnosti (i mogućnošću da se ručno koriguje, npr. za dugogodišnjeg klijenta), svim njihovim putovanjima na jednom mestu, i istorijom poruka razmenjenih sa agencijom.
- **Gosti** (ko stvarno putuje — nekad ista osoba kao nalogodavac, nekad ne, npr. roditelj plaća za celu porodicu) — lista i detalj sa podacima o dokumentu, državljanstvu, datumu rođenja.
- **Ankete posle putovanja** — pregled onoga što gosti odgovore nakon povratka.
- Na stranici svake rezervacije sad postoji i direktan link ka nalogodavcu — isti princip kao veze ka fakturi/garanciji/ugovoru iz Faze 2, sve na jednom mestu umesto skakanja između ekrana.

## Faza 4 — B2B partneri (avgust 2026)

Terminal Travel ne prodaje samo direktno gostima — deo prodaje ide preko poslovnih partnera, "subagenata" (druge turističke agencije koje dalje prodaju naše aranžmane svojim klijentima, uz sopstvenu proviziju). Do sada je taj deo sistema postojao samo iza kulisa (testiran automatski, nikad viđen ljudskim okom). Novi ekran "B2B partneri" to menja.

- **Lista i detalj subagenata** — ko su naši poslovni partneri, koliki im je kreditni limit (koliko duguju agenciji pre nego što moraju da plate), kolika im je provizija, i da li su trenutno dostigli neki "prag obima" koji im automatski podiže proviziju (npr. "posle 50.000 EUR prodaje ovog kvartala, provizija raste sa 10% na 15%") — isti princip kao popust za stalne kupce, samo za poslovne partnere.
- **Odobravanje novog partnera** — kad se neko novi prijavi da postane subagent, ne može odmah da prodaje — čeka da Vi ili Direktor svesno odobrite, i tom prilikom postavite koliki mu je kreditni limit i koja mu je provizija. Ovo je namerna kočnica: sistem nikad sam ne otvara kreditnu liniju nikom.
- **Mreža partnera** — neki subagenti imaju sopstvene "pod-partnere" (manje agencije koje rade preko njih). Tim iz agencije vidi celu tu mrežu, ali upravljanje proviziom unutar mreže (ko koliko dobija od koga) ostaje posao samih partnera međusobno — mi imamo uvid, ne mešamo se, isto kao što ne diktiramo kako neka firma deli platu unutar sebe.
- **Rabati provizije** — kad partner usred perioda pređe prag obima koji smo unapred dogovorili da "važi unazad", sistem sam izračuna koliko mu duguje dodatno za ono što je već prodao pre nego što je prag dostignut, i pripremi to kao nacrt. Ali taj nacrt **ne postaje stvaran** dok Vi, Direktor ili Računovođa svesno ne kliknete "odobri" — isti princip kao slanje fakture u Fazi 2 (M10): sistem predlaže, čovek odlučuje. Novi ekran "Rabati provizije" pokazuje sve te predloge na jednom mestu, filtrirane po statusu, sa jasnim dugmetom za odobrenje ili odbijanje (uz obavezan razlog ako se odbija).
- Kad se rabat odobri, to automatski priprema (ne šalje) odgovarajući knjigovodstveni dokument u Finansijama (M10, Faza 2) — isto pravilo kao svugde: automatika sme da pripremi, čovek mora da pošalje.

**Šta namerno nije na ovom ekranu:** upravljanje sopstvenom mrežom sub-partnera (to rade sami partneri kroz svoj budući poseban portal, ne kroz naš interni panel) i AI ćaskanje kroz koje bi partner sam mogao da rezerviše razgovorom — oboje čeka poseban modul (M15) koji tek treba da bude izgrađen.

**Jedna stvar koju smo usput otkrili i popravili:** specifikacija je od početka predviđala da Računovođa sme da odobrava/odbija rabate provizije (ima direktan uticaj na novac, isto kao slanje fakture), ali ta dozvola nikad nije stvarno upisana u sistem — u praksi bi samo Vi i Direktor mogli to da uradite. Ispravili smo to da odgovara onome što je oduvek bilo planirano.

## Šta još nije gotovo (namerno)

- **Ostatak modula** (izveštaji, podrška, marketing) — dolaze u narednim koracima, jedan po jedan, istim tempom kao što su i sami ti moduli rađeni.
- **Prava AI pretraga i glasovna komanda** — čekaju poseban modul (M15) koji upravlja AI agentima kroz ceo sistem; trenutno komandna paleta radi samo kao brz način navigacije, ne "razgovor" sa sistemom.
- **Instaliranje na telefon kao aplikacija (PWA)** — dodaje se kad bude više ekrana da to ima smisla testirati na pravom uređaju.

Ništa od ovoga nije propust — to su svesne odluke da se gradi po delovima koji stvarno mogu da se provere, ne "sve odjednom".
