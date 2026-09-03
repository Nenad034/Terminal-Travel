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

Nisu popravljene u istom prolazu, jer su izmene koda a ne dokumentacije, i čekaju tvoju odluku. Obe su upisane kao neispunjene stavke u izlaznom kriterijumu M4.

### Prva, i ozbiljnija: operativni pozivi nisu zaključani

Specifikacija kaže da endpointe za pretragu, rezervaciju i otkazivanje „poziva isključivo M2 i M5" i da „nisu izloženi kanalima poput sajta ili B2B portala". **To piše, ali nije sprovedeno u kodu.**

Provera koja postoji je samo „da li imaš važeću prijavu". Ne proverava se **ko** si. A pošto je registracija gosta javna i nalog odmah postaje aktivan, sledi da se bilo ko može registrovati kao gost na sajtu i time dobiti pravo da:

- vidi **nabavne cene** provajdera, bez marže — dakle tačno koliko vi plaćate;
- napravi **stvarnu rezervaciju** kod spoljnog dobavljača u vaše ime;
- **otkaže** postojeću rezervaciju, ako zna njen broj.

Praktično, opasnost je danas mala jer nijedan provajder nije podešen — nema šta da se pozove. Ali postaje stvarna onog dana kad se uključi prvi pravi provajder, a to je upravo dan kad se na to najmanje misli.

Ispravka nije velika — dodaje se provera prava na tih pet putanja, isto kao što već postoji svuda drugde. Predlažem da se uradi **pre** nego što se poveže prvi provajder.

### Druga: kad provajder zakaže, ne vidi se zašto

M4 interno razlikuje sedam različitih razloga neuspeha — istekло vreme, pogrešni pristupni podaci, hotel je pun, provajder ne radi, i tako dalje. Trud je uložen da se to uredno razlikuje.

Ali nijedan od tih razloga **ne stiže do onoga ko je pozvao**. Sve izlazi kao jedna ista opšta poruka „interna greška servera". Prevod iz internog oblika u odgovor nikad nije napisan.

Posledica: sistem ne može da razlikuje „hotel je pun" — što je uredan ishod na koji treba ponuditi drugi termin — od „naši pristupni podaci su pogrešni", što je kvar koji traži hitnu reakciju. Oba izgledaju identično.

Ovo se danas ne primećuje iz istog razloga kao prvo: nema podešenih provajdera, pa se greške ne dešavaju. Videće se prvog dana rada. Razlog se za sada može pročitati jedino u zapisniku poziva, gde se svaki poziv beleži sa svojim ishodom.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` u istom folderu i `docs/api/M4-integracije-api.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
