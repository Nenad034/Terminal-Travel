# M13 (Izveštavanje i BI) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M13 dobije značajnu izmenu.

---

## Šta M13 zapravo radi

Svaki drugi modul (rezervacije, ugovori, finansije, CRM...) čuva svoje podatke da bi obavio svoj posao — M5 pamti rezervacije da bi ih moglo potvrđivati i menjati, M10 pamti uplate da bi znao ko je platio. Nijedan od njih nije napravljen da odgovori na pitanje "koja destinacija nam donosi najviše zarade" brzo, na zahtev, preko cele istorije poslovanja — to bi značilo da svaki takav izveštaj kopa kroz gomilu tabela u više modula odjednom, sporo i komplikovano.

M13 postoji tačno za to. Radi kao "kopija za brzo čitanje" — svaki put kad se rezervacija potvrdi, izmeni ili otkaže, M13 automatski napravi (ili osveži) sopstveni, pojednostavljen zapis o toj rezervaciji, sa svim što je potrebno za izveštaje već spremno na jednom mestu (destinacija, dobavljač, kanal prodaje, zarada). Kad menadžment pita "profitabilnost po destinaciji za prošli kvartal", M13 ne mora da pretražuje ceo sistem — samo čita svoju već pripremljenu kopiju, brzo.

## Zašto to nije "još jedna baza koja može da zastari"

Najveći rizik kod ovakve "kopije za brzo čitanje" je da vremenom prestane da odgovara stvarnosti — npr. ako neko izmeni rezervaciju direktno u M5, a M13 to ne primeti, izveštaj počinje da laže. Terminal ovo rešava na dva nivoa:

1. **Odmah, automatski:** čim se nešto desi u M5 (rezervacija potvrđena, izmenjena, otkazana), M13 to odmah primeti i osveži svoju kopiju — u praksi u roku od sekundi.
2. **Noću, kao dvostruka provera:** ako je iz nekog razloga jedna takva poruka "izgubljena" (pad servera u pogrešnom trenutku, mrežni problem), M13 svake noći u 3 ujutru sam prođe kroz SVE rezervacije, uporedi svoju kopiju sa stvarnim stanjem, i ispravi sve što se ne poklapa — bez da neko iz tima mora ručno da primeti da nešto nije u redu. Tim može i ručno da pokrene istu proveru u bilo kom trenutku (dugme "Pokreni rekonsilijaciju").

Ovo je testirano baš u tom najgorem scenariju: namerno smo simulirali da jedna poruka "nestane" i proverili da je noćna provera sama, bez ičije pomoći, popravi. Takođe smo testirali da ako se cela M13 kopija obriše (npr. greškom), može se u potpunosti ponovo izgraditi iz izvornih podataka i dobiti identičan rezultat — M13 ne čuva ništa što ne postoji negde drugde u sistemu, pa gubitak M13 kopije nikad nije gubitak stvarnih podataka.

## Šta menadžment stvarno vidi

- **Profitabilnost** — koliko se zarađuje (prodajna cena minus nabavna cena), razvrstano po destinaciji, po dobavljaču, i po kanalu prodaje (sajt, B2B portal, telefon...).
- **Prodaja** — koliko je rezervacija, koliko vredi ukupno, kolika je prosečna vrednost rezervacije.
- **Zauzetost smeštaja** — koliko je ljudi putovalo, koliko noćenja, koliko je soba prodato, i razvrstano po tipu sobe, usluzi (polupansion/all-inclusive), kategoriji hotela (broj zvezdica) i tipu smeštaja (hotel, vila, apartman...). Kad neki podatak nedostaje (npr. rezervacije iz spoljnih sistema često ne nose tip sobe), izveštaj to jasno kaže brojem — ne pravi se da tog dela prodaje nema.
- **Dinamički izveštaj** — umesto fiksnih tabela, tim sam bira redosled po kojem želi da vidi podatke (npr. "prvo po državi, pa unutar toga po dobavljaču") i sistem sam sastavi rezultat tim redosledom, sa zaradom/naplatom/dugom na svakom nivou.
- **Marketing performanse** — koje rezervacije stvarno potiču od klika na promotivni sadržaj (blog objava, društvene mreže) koji je agencija objavila preko M12 (marketing modul, izgrađen avgust 2026). Kad gost rezerviše preko linka koji nosi trag konkretne objave, izveštaj ga poveže sa tim sadržajem; ako trag nedostaje ili ne odgovara nijednoj objavi, rezervacija se iskreno prikazuje kao "nepoznato poreklo", nikad se ništa ne izmišlja.

- **Vremenski obrasci** — svi izveštaji iznad odgovaraju na pitanje "šta se prodalo"; ovaj odgovara na "kada". Kada ljudi najviše pretražuju, kada rezervišu, kada otkazuju, i koliko unapred otkazuju (više od 48 sati, između 24 i 48 sati, ili manje od 24 sata pred polazak — namerno tri grupe, a ne prosek, jer prosek pomeša otkazivanje mesec dana unapred sa otkazivanjem uveče pred put). Isto se može pogledati i po destinaciji, i odvojeno za B2B, B2C i subagente.

  Ovaj izveštaj se od 8.9.2026. može gledati i **kao sliku, ne samo kao tabelu** (dugme "grafik" u gornjem desnom uglu). Za "kada" se crta mreža: sedam redova (dani u nedelji) i dvadeset četiri kolone (sati). Polje je tamnije što se u tom terminu više dešavalo — kao vremenska prognoza u boji. Iz tabele od 168 redova brojeva se ne vidi da se, na primer, najviše rezerviše subotom uveče; iz obojene mreže se vidi odmah. Tačan broj se dobija kad se mišem stane na polje, a i dalje postoji cela tabela na dugme "tabela" pored. Za destinacije i za "koliko unapred se otkazuje" crtaju se trake iste vrste kao na ostalim izveštajima.

Svaki izveštaj u gornjem uglu pokazuje kada je poslednji put osvežen — da tim zna da li gleda podatke od pre par sekundi ili od sinoćne provere.

## Šta još čeka (namerno, ne propust)

- Poseban izveštaj profita/gubitka za charter/fiksni zakup ugovore (kad agencija unapred plati ceo avion ili ceo hotel) — dodaje se kad se prvi takav ugovor stvarno pojavi.
- Sačuvani prečaci za dinamički izveštaj (npr. "uvek pokaži po državi pa dobavljaču" jednim klikom) — praktično poboljšanje za kasnije, ne menja ono što izveštaj već ume da uradi.

---

_Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `13-SPECIFIKACIJA-M13-BI.md` u istom folderu i `docs/api/M13-bi.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih._
