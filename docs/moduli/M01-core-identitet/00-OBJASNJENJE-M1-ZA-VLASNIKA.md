# M1 (Core/Identitet) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, čim taj modul dobije kod — jednostavnim jezikom, bez žargona, da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Nastaje/dopunjuje se kad god M1 dobije značajnu izmenu.

---

## Zgrada sa sobama

Zamislite veliku zgradu agencije sa mnogo soba — soba za rezervacije, soba za novac, soba za ugovore. Pre nego što bilo ko uđe u zgradu, mora da pokaže ličnu kartu na ulazu i unese lozinku. To je **prijava (login)**. Ali sama prijava ne kaže portiru u koje sobe ta osoba sme da uđe — samo potvrđuje "da, ovo je stvarno ta osoba".

## Ko sme u koju sobu — traka koja se ponovo proverava svaki put

Svaka osoba nosi neku "traku" — kao na koncertu ili u zabavnom parku — koja pokazuje koju vrstu pristupa ima: računovođa ima traku za sobu sa novcem, prodajni agent traku za sobu sa rezervacijama.

Ključna stvar koju smo napravili drugačije od uobičajenog: **ne verujemo samoj traci**. Svaki put kad neko pokuša da uđe u sobu, portir na vratima **ponovo proverava spisak** — ide i pita "da li ova osoba stvarno sme ovde, baš sada?" — umesto da samo pogleda traku. Zašto? Zato što je nekome traka mogla biti oduzeta pre pet minuta (npr. direktor je nekome ukinuo pristup finansijama), a stara traka to ne bi znala.

Ovo je uživo testirano: probni "gost" nalog je pokušao da uđe u sobu za korisnike i portir ga je ispravno odbio.

## Dnevnik koji se ne može brisati

Postoji poseban dnevnik u kom se **automatski** upisuje svaki put kad neko uđe u neku sobu ili nešto promeni — ko, kada, šta. Ovaj dnevnik ima poseban katanac: **niko, čak ni vlasnik agencije, ne može da istrgne ili prepravi staru stranicu** — može se samo dodati nova. Ovo je uživo testirano — pokušaj brisanja jednog reda direktno iz baze je odbijen sistemskom porukom. Ako ikad nešto pođe po zlu (npr. neko tvrdi da nikad nije odobrio neko plaćanje), ovaj dnevnik je nepobitan dokaz.

## Kartica za dvostruku proveru (2FA)

Za interne uloge (direktor, računovođa, prodajni agent...) prijava samo lozinkom nije dovoljna — mora se i otkuca šestocifreni kod koji se menja na 30 sekundi (kao kod bankovnih aplikacija). Ovo se ne može isključiti za te uloge — namerno, jer je pristup novcu i podacima gostiju previše osetljiv da bi zavisio samo od lozinke. Za gosta (npr. nekoga ko samo prati sopstvenu rezervaciju) ovo je opciono.

## Zaključavanje posle previše pogrešnih pokušaja

Ako neko pet puta zaredom pogreši lozinku, nalog se zaključava na 15 minuta — sprečava nekoga da "pogađa" tuđu lozinku hiljadama pokušaja.

## Greška koju smo usput uhvatili (i zašto je dobro što jesmo)

Portir koji proverava "traku" je alat koji smo napravili jednom, u posebnoj kutiji, da ga više soba deli umesto da svaka pravi svoj sopstveni. Kad je zgrada prvi put pokrenuta, neke sobe nisu znale gde se ta kutija čuva — kao recept koji traži jaje, a jaje nije na spisku namirnica u kući. Sistem je to odmah i jasno prijavio (nije tiho pokvario nešto ispod površine), pa je dodato uputstvo gde se kutija nalazi i sve sobe su je onda pronašle.

Ovo je i razlog zašto se sve stvarno **pokreće i isprobava uživo**, ne samo piše i ostavlja — da se ovakve stvari uhvate odmah, ne mesecima kasnije kad neko stvarno pokuša da uđe u pogrešnu sobu.

---

*Za tehničke detalje (tačna imena tabela, API pozivi, pravila evaluacije prava) vidi `02-SPECIFIKACIJA-M1-CORE-IDENTITET.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje tu specifikaciju.*
