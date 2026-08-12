# M20 (Ugovori sa klijentima) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M20 dobije značajnu izmenu.

---

## Šta M20 zapravo radi

Zakon o turizmu traži da svaka organizovana rezervacija ima svoj **Ugovor o organizovanju putovanja** — treći pravni dokument u lancu, pored fakture (M10) i garancije putovanja (M11). Do sada taj ugovor nigde nije postojao u sistemu. M20 ga sastavlja **automatski**, čim se rezervacija potvrdi, isključivo iz podataka koji već postoje — nikad se ništa ne unosi dvaput.

## Ugovor se sam sastavlja, ne piše ga niko ručno

Čim rezervacija pređe u "potvrđeno", sistem sam pokupi sve što zakon traži da piše u ugovoru — naziv i kategoriju hotela iz kataloga (M2), uslove otkazivanja iz ugovora sa dobavljačem (M3), cenu i datume iz same rezervacije (M5), broj polise garancije putovanja (M11), rokove uplate (M10) — i sklopi jedan dokument. Ovo je bezopasna, mehanička radnja (isti nivo kao kad M10 sam pripremi nacrt fakture) — ništa se ne šalje spolja, samo se formalizuje ono što već važi.

## Ko kakav ugovor dobija — sistem sam prepoznaje

Postoji pet vrsta ugovora (organizovano putovanje, posredovanje, samostalna prodaja avio karte, samostalan transfer, korporativni okvirni). Sistem sam prepoznaje koju vrstu treba da koristi, na osnovu toga da li ste vi organizator ili samo posrednik te rezervacije, i šta je gost tačno kupio — agent to nikad ne bira ručno, isti princip kao izbor fakture/računa u M10.

## Prihvatanje — gost na sajtu klikne unapred, tim ostalo evidentira ručno

Kad gost rezerviše preko sajta, on već pre same potvrde plaćanja čekira "Prihvatam uslove ugovora" — taj klik se pamti, i čim se ugovor sastavi, sistem ga automatski označi kao prihvaćen, bez dodatnog koraka. Kad se rezervacija pravi preko telefona ili interno u kancelariji, ugovor se šalje gostu, a neko iz tima ručno unese "prihvaćeno" kad stigne potpisan primerak.

## Izmena rezervacije posle prihvatanja — ugovor se sam obnavlja

Ako se rezervacija posle prihvatanja izmeni (drugi datum, drugi broj gostiju), stari ugovor više ne opisuje stvarno stanje — pravno neprihvatljivo da ostane važeći. Sistem to sam prepozna: stari ugovor se poništi (ne obriše, ostaje u istoriji), i odmah se pravi nova verzija sa ažuriranim podacima. Nova verzija **uvek** ponovo čeka prihvatanje, čak i ako je stara verzija već bila prihvaćena — jer se uslovi promenili, staro prihvatanje više ne važi za novi tekst. Otkazivanje rezervacije, za razliku od izmene, ne dira ugovor — on ostaje kao istorijski zapis pod kojim je otkazivanje/penal i nastao.

## Vaučer čeka ugovor, ne obrnuto

Postoji pravilo da gost ne sme dobiti vaučer za putovanje pre nego što ugovor uopšte postoji — sada je to stvarno sprovedeno, ne samo napisano. Ako sistem pokuša da izda vaučer za organizovano putovanje, prvo proveri da li ugovor postoji; ako ne postoji, vaučer se ne izdaje, testirano uživo.

## Šta još čeka (namerno, ne propust)

- **Lep izgled dokumenta** (pravi PDF, sa dizajnom) — trenutno je "dokument" simulacija (radi, ali nije stvarno formatiran PDF ni sačuvan na pravom cloud skladištu); pravi format čeka vaš izbor konkretne biblioteke, isti razlog kao SEF u M10 i CIS u M11.
- **B2B (subagenti preko M7)** — mehanizam je spreman (ista logika kao sajt), ali se ne može testirati uživo dok M7 modul ne bude izgrađen (kasnija faza).
- Podaci agencije koji idu u svaki ugovor (naziv, adresa, broj licence, kontakt za hitne slučajeve) trenutno se čitaju iz podešavanja servera — javite kad želite da se to prikaže i menja kroz sam panel.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje ga.*
