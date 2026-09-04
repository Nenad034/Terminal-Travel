# M4 (Integracije spoljnih API konekcija) — objašnjenje za vlasnika

Ovaj dokument objašnjava šta je napravljeno u M4 i **zašto**, običnim jezikom. Nije tehnički — za to postoje `05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` u istom folderu i `docs/api/M4-integracije-api.md`.

---

## Ukratko: M4 je prevodilac

Vaša ponuda dolazi iz dva izvora. Jedan su hoteli sa kojima imate potpisan ugovor — to je M3. Drugi su veliki spoljni sistemi (Travelgate, Solvex, WebHotelier) koji vam otvaraju hiljade hotela širom sveta, ali gde vi ne držite ni sobu ni cenu — pitate ih uživo, u trenutku kad gost traži.

Problem je što svaki od tih sistema govori svojim jezikom. Ne mislim na srpski i engleski — mislim na tehnički oblik u kom šalju podatke. Jedan šalje na jedan način, drugi na potpuno drugi, treći na treći. Isti podatak — „dvokrevetna soba, polupansion, 86 evra" — kod svakog izgleda drugačije.

**M4 je sloj koji sve te jezike prevodi na jedan.** Ostatak sistema onda ne mora da zna ni ko je provajder ni kako on govori — dobija uvek isti oblik.

Zamislite da imate tri dobavljača od kojih jedan šalje fakture poštom, drugi mejlom, treći faksom. M4 je službenik koji sve tri prima i prekucava u isti obrazac, tako da knjigovođa dalje radi sa jednim oblikom.

---

## Zašto je to napravljeno baš tako

Alternativa bi bila da svaki deo sistema koji treba hotel iz Travelgate-a zna kako Travelgate govori. To izgleda brže dok imate jednog provajdera. Sa tri je već neuredno. Sa pet, svaka promena kod bilo kog provajdera znači prepravku na desetak mesta u sistemu, i sigurno se negde zaboravi.

Ovako je pravilo jednostavno: **niko osim M4 ne razgovara sa spoljnim provajderom.** Kad se sutra doda četvrti, dodaje se jedan novi „prevodilac" i ništa drugo se ne dira.

---

## Osigurač — da jedan pokvaren provajder ne zaustavi prodaju

Spoljni sistemi ponekad ne rade. To nije izuzetak nego normalno stanje — svaki od njih ima svoje kvarove, održavanja i preopterećenja.

Ako gost traži hotel u Grčkoj, a jedan provajder ne odgovara, ne sme se desiti da cela pretraga stoji i čeka. Zato su ugrađene dve zaštite:

**Vremensko ograničenje**, i to **dva različita**. Pretraga sme brzo da odustane — gost čeka pred ekranom, a rezultat tog provajdera je samo jedan od više izvora, drugi će stići. Potvrda rezervacije mora da čeka duže, jer prekinuti je na pola znači ne znati da li je soba rezervisana ili nije. To je najgore moguće stanje.

**Osigurač.** Ako provajder više puta zaredom ne odgovori, M4 prestaje da ga zove na neko vreme, umesto da svaki naredni gost čeka istih 8 sekundi za isti neuspeh. Posle tog vremena proba ponovo. Isto kao osigurač u kući — ne pokušava beskonačno, iskoči pa se vrati.

---

## Zaštita od duple rezervacije

Ovo je mesto gde greška direktno košta novca, pa je rešeno posebno pažljivo.

Zamislite: šaljete rezervaciju provajderu, i veza pukne pre nego što stigne odgovor. Šta se desilo? Ne znate. Možda je rezervacija napravljena, možda nije. Ako pokušate ponovo, rizikujete dve rezervacije i dva plaćanja. Ako ne pokušate, rizikujete da gost nema sobu.

Rešenje: **svaki pokušaj rezervacije nosi svoj jedinstveni broj.** Ako se poziv ponovi sa istim brojem, M4 **ne zove provajdera ponovo** — vrati sačuvan ishod prvog pokušaja. Tako ponavljanje postaje bezopasno.

Ovo je stvarno testirano, sa namerno prekinutom vezom, i potvrđeno je da drugi pokušaj ne pravi drugu rezervaciju.

---

## Kredencijali se upisuju, ali se ne mogu pročitati nazad

Pristupni podaci za svakog provajdera (lozinke, ključevi) čuvaju se šifrovano i **ne postoji način da se kroz sistem pročitaju**. Mogu se samo prepisati novim.

To je namerno. Ako neko dođe do pristupa panelu, ne sme time da dobije i vaše pristupne podatke za sve spoljne sisteme. Praktična posledica za vas: ako se ključ izgubi, ne traži se „u sistemu" nego se pribavlja ponovo od provajdera.

---

## Šta radi, a šta još ne (pošteno stanje)

**Sva tri prevodioca su napisana i testirana** — Travelgate, Solvex i WebHotelier. Ali testirani su sa **lažiranim** odgovorima, ne sa pravim servisima, jer pristupni podaci nisu pribavljeni ni za jedan.

To znači da je ovo pošten opis stanja: **kod je spreman, ali nijedan provajder nikad nije stvarno pozvan.** Prvi pravi poziv može otkriti razlike koje se sa lažiranim odgovorom ne vide — drugačije nazvana polja, drugačije greške, ograničenje koliko poziva sme u minutu. To nije propust nego neizbežno: dok nema naloga kod provajdera, nema se šta pozvati.

Postoji i ugrađen „lažni provajder" koji vraća izmišljene rezultate. Koristan za razvoj i demonstraciju, ali **odgovori izgledaju potpuno normalno** — vredi paziti da ne ostane uključen kad se krene sa pravim radom.

---

## Dve stvari koje sam našao dok sam pisao dokumentaciju 3.9.2026

### Prva, i ozbiljnija: operativni pozivi nisu bili zaključani — **ispravljeno istog dana**

Specifikacija kaže da endpointe za pretragu, rezervaciju i otkazivanje „poziva isključivo M2 i M5" i da „nisu izloženi kanalima poput sajta ili B2B portala". **To je pisalo, ali nije bilo sprovedeno u kodu.**

Provera koja je postojala bila je samo „da li imaš važeću prijavu". Nije se proveravalo **ko** si. A pošto je registracija gosta javna i nalog odmah postaje aktivan, sledilo je da se bilo ko može registrovati kao gost na sajtu i time dobiti pravo da:

- vidi **nabavne cene** provajdera, bez marže — dakle tačno koliko vi plaćate;
- napravi **stvarnu rezervaciju** kod spoljnog dobavljača u vaše ime;
- **otkaže** postojeću rezervaciju, ako zna njen broj.

**Šta je urađeno (uz tvoju odluku, 3.9.2026):** svih pet putanja sada traži isto pravo koje se traži za podešavanje provajdera — dakle Vlasnik i Direktor. Izabrano je postojeće pravo umesto uvođenja novog, jer se pokazalo da **nijedan deo sistema te putanje ne koristi**: prodaja ne prolazi kroz njih nego zove M4 direktno unutar servera. Zatvaranje zato nije moglo ništa da pokvari, a rupa je zatvorena danas umesto da čeka.

Ostaju upotrebljive za ono čemu i služe — da neko od vas dvoje ručno proveri „da li Travelgate uopšte odgovara" kad nešto ne radi.

Dve stvari koje vredi da znaš uz ovu ispravku, jer pokazuju kako se ovakve greške prave:

**Prvo, jedan test je čuvao rupu.** Postojao je test koji je izričito tvrdio da je taj endpoint „dostupan svakom prijavljenom korisniku, bez posebne dozvole" — i uredno je prolazio. Rupa nije bila previd u kodu koji niko nije gledao; bila je zapisana kao očekivano ponašanje i redovno proveravana. Test je sada okrenut: proverava da nalog bez prava dobija odbijenicu, i to za svih pet putanja posebno.

**Drugo, prva verzija moje ispravke ne bi radila.** Postavio sam pravo na celu grupu odjednom, što izgleda urednije. Pri proveri se ispostavilo da mehanizam koji sprovodi prava gleda **samo pojedinačnu putanju**, a ne grupu — pa bi ograda izgledala postavljeno, a propuštala bi sve. Da nisam proverio, prijavio bih ti da je popravljeno, a ne bi bilo. Zapisano je kao zamka da se ne ponovi.

### Druga: kad provajder zakaže, nije se videlo zašto — **takođe ispravljeno**

M4 interno razlikuje sedam različitih razloga neuspeha — isteklo vreme, pogrešni pristupni podaci, hotel je pun, provajder ne radi, i tako dalje. Trud je uložen da se to uredno razlikuje.

Ali nijedan od tih razloga **nije stizao do onoga ko je pozvao**. Sve je izlazilo kao jedna ista opšta poruka „interna greška servera" — prevod iz internog oblika u odgovor nikad nije bio napisan.

Posledica je bila da sistem ne može da razlikuje „hotel je pun" — što je uredan ishod na koji treba ponuditi drugi termin — od „naši pristupni podaci su pogrešni", što je kvar koji traži hitnu reakciju. Oba su izgledala identično.

Nije se primećivalo jer nema podešenih provajdera, pa se greške ne dešavaju. Pojavilo bi se tek prvog dana rada — dakle tačno kad je najskuplje.

**Šta je urađeno:** dodat je sloj koji te razloge prevodi u odgovor, tako da se sada iz svake greške vidi i šta je pošlo naopako i koliko je ozbiljno. Najvažnija razlika u praksi: „hotel je pun" sada dolazi kao **uredan ishod** na koji se ponudi drugi termin, dok „naši pristupni podaci su pogrešni" dolazi kao **kvar** koji traži da neko odmah reaguje. Ranije su bili nerazlučivi.

Uz to je svaka od sedam vrsta pokrivena testom, da se ne izgubi ponovo pri nekoj kasnijoj izmeni.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` u istom folderu i `docs/api/M4-integracije-api.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
