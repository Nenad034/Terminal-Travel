# M6 (CRM: Gosti i Nalogodavci) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M6 dobije značajnu izmenu.

---

## Šta M6 zapravo radi

Do sada su M5 (rezervacije), M10 (fakture) i M11 (garancija) sami držali osnovne podatke o kupcu (ime, PIB) samo zato što nisu imali gde drugde da ih čuvaju. M6 je taj "gde drugde" — jedno mesto gde žive profili **Nalogodavaca** (ko plaća) i **Gostiju** (ko putuje), njihova istorija, program lojalnosti i komunikacija sa timom.

Istorija putovanja se **ne prepisuje** u M6 — kad neko otvori profil gosta i vidi njegova prethodna putovanja, ti podaci se u tom trenutku uživo čitaju iz M5. Ovo je namerno: da nikad ne postoje dve verzije iste rezervacije koje mogu da se razminu.

## Program lojalnosti — sam se preračunava

Definišete nivoe (npr. "Srebrni", "Zlatni", "Platinasti") sa pragom (npr. "10 rezervacija" ili "200.000 dinara potrošeno") i popustom koji taj nivo nosi. Čim se rezervacija potvrdi ili otkaže, sistem sam ponovo izračuna gde je gost — bez ičijeg klika. Popust se automatski primenjuje na cenu ponude, kao **poslednji korak**, posle marže — gost nikad ne vidi cenu bez popusta, a vi u pozadini i dalje znate tačnu maržu.

Ako želite da nekome ručno date viši nivo mimo pravila (npr. poslovni partner, VIP gost), to je moguće — ali sistem traži razlog i trajno ga upisuje u audit log, zajedno sa imenom osobe koja je to odobrila. Ručna odluka **uvek** pobeđuje nad automatski izračunatim nivoom.

## Komunikacija — AI sme da piše nacrt, ali ne i da pošalje ono što pominje novac

Kad AI agent sažme upit gosta ili pripremi nacrt odgovora, taj zapis se čuva. Ako taj nacrt **pominje cenu ili neku obavezu prema gostu**, sistem ga tehnički ne dozvoljava da izađe dok ga neko iz tima stvarno ne pregleda i ne pošalje — to nije samo pravilo napisano u dokumentu, sprovedeno je u samom kodu: dok god je poruku sastavio AI, polje "ko je poslao" ostaje prazno sve dok neko iz tima to ne uradi ručno.

## Četiri automatske poruke — rođendan, godišnjica, pred put, posle puta

Svaki dan sistem sam proverava:
- da li je danas nečiji rođendan (gost),
- da li je danas godišnjica prve rezervacije (nalogodavac),
- da li nekom putovanje počinje za 7, 3 ili 1 dan,
- da li se neko vratio sa putovanja pre tačno 2 dana.

Za prve tri, ako je gost dao saglasnost za marketinšku komunikaciju, poruka se šalje bez ičijeg pregleda (sadržaj je čisto informativan, ne pominje cenu). Ako saglasnosti nema, poruka se i dalje pripremi kao nacrt — samo čeka da je neko iz tima ručno pošalje.

## Anketa posle putovanja — i ponuda za Google recenziju

Dva dana posle povratka, gost automatski dobija (uz istu proveru saglasnosti kao iznad) kratku anketu — ocena 1-5, da li bi preporučio agenciju, slobodan komentar. Ako oceni sa 4 ili 5 (prag možete promeniti), forma mu dodatno ponudi link ka vašem Google Business profilu da ostavi javnu recenziju. Sistem beleži da li je gost kliknuo na taj link — sama recenzija ostaje na Google-u, van našeg sistema.

## Šta još čeka (namerno, ne propust)

- **Samostalna registracija gosta na sajtu** — mehanizam je spreman, ali se ne može testirati uživo dok M8 (sajt agencije) ne bude izgrađen.
- **Pravi rok čuvanja/brisanja ličnih podataka** ("pravo na zaborav") — čeka potvrdu tačnog zakonskog roka od pravnika/knjigovođe pre nego što se doda automatsko brisanje.
- Adresa vašeg Google Business profila trenutno se čita iz podešavanja servera — javite kad želite da se to menja kroz sam panel.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `09-SPECIFIKACIJA-M6-CRM.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje ga.*
