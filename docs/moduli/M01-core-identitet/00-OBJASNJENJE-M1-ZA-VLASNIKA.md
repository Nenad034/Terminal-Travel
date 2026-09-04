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

## Kako zaposleni uopšte dobija nalog (dopuna, 4.9.2026)

Do sada je ovaj deo ličio na vrata bez kvake: sve je bilo napravljeno, ali se kroz njih nije moglo proći.

Tri stvari su nedostajale, i svaka je sama za sebe delovala kao da radi:

1. **Prvi nalog nije postojao.** Skripta koja puni praznu bazu pravila je uloge, prava i naloge za AI pomoćnike — ali nijednog čoveka. A novog zaposlenog može da pozove samo neko ko je već unutra. Zatvoren krug: da biste ušli, morate već biti unutra.
2. **Pozivnica se gubila.** Kad neko iz panela pozove kolegu, sistem napravi nalog i izda jednokratan link kojim taj kolega postavlja svoju lozinku. Taj link se nigde nije prikazivao — nastajao je i odmah nestajao. Nalog bi se pojavio u listi kao da je sve u redu, a pozvani čovek nikad ništa ne bi dobio.
3. **Stranice za postavljanje lozinke nije bilo.** Čak i da je link stigao, nije postojao ekran na koji bi vodio.

Sada lanac radi od početka do kraja:

- Skripta pravi **jedan** nalog vlasnika i ispiše njegovu lozinku — jednom, u trenutku pravljenja. Lozinka nije upisana u kod (to bi značilo da je zna svako ko ima pristup kodu); generiše se nasumično na licu mesta. Na pravom serveru se taj nalog ne pravi automatski uopšte — tamo se lozinka mora zadati svesno, spolja.
- Kad pozovete kolegu, ekran vam **pokaže link** koji mu prosleđujete sami (porukom, telefonom, kako vam odgovara). Slanje email-a još nije povezano, pa je ovo privremeni put — ali put koji stvarno postoji, umesto da ga nema.
- Link vodi na stranicu gde kolega postavlja svoju lozinku. Traje **48 sati**, ne sat vremena — jer ga vi prosleđujete ručno, pa mora da preživi put do njega.
- Postavljanje lozinke **ne pušta ga unutra samo po sebi.** Posle toga se prijavljuje kao i svi ostali, i pri prvoj prijavi podešava dvostruku proveru. Nema naloga koji ulazi bez nje, ni prvog dana.

## Dvostruka provera sada ima sliku, ne samo šifru (dopuna, 4.9.2026)

Kad neko prvi put podešava dvostruku proveru, aplikacija na telefonu treba da „upozna" njegov nalog. To se radi skeniranjem kvadratića sa tačkicama (QR koda). Do sada smo umesto slike prikazivali samo dugačku šifru za ručno prepisivanje — radilo je, ali je bilo nezgodno.

Sada se crta prava slika. Sitnica koju vredi znati: kod se uvek crta na **beloj podlozi**, čak i kad je ostatak ekrana taman — čitači QR koda traže tamne tačkice na svetloj pozadini, pa bi na tamnoj podlozi kod postao nečitljiv. Šifra za ručno prepisivanje ostaje ispod slike, za slučaj da kamera zakaže.

## Pošta sada stvarno odlazi (dopuna, 4.9.2026)

Do sada nijedna poruka nije izlazila iz sistema. Na četiri mesta u kodu stajala je ista beleška — „ovde bi trebalo poslati email, čeka odluku" — pa je sistem uredno pravio poruku, zapisao da ju je „poslao", i nigde je ne bi poslao. To je zaobilazilo pažnju baš zato što ništa nije pucalo.

Sada su povezana dva mesta gde je to najvažnije: **pozivnica novom kolegi** i **zaboravljena lozinka**. Uz to i **operativne uzbune** (poruka kad nešto u sistemu zakaže) idu istim putem.

**Šta je izabrano i zašto.** Sistem govori običan „SMTP" — jezik kojim govore svi mail serveri. To znači da ne moramo unapred da biramo firmu: isti kod radi sa poštom koju agencija već ima, sa Google-om, sa Microsoft-om, ili sa servisom specijalizovanim za ovakve poruke. Podaci se upisuju u jedan fajl sa podešavanjima, ne u kod. Da smo umesto toga izabrali API jedne konkretne firme, bili bismo vezani za nju, i ništa se ne bi moglo isprobati dok se ne otvori nalog i ne dokaže vlasništvo nad domenom.

**Za probu se koristi „hvatač pošte".** Uz razvojno okruženje sada ide programčić koji prima sve poruke koje aplikacija pošalje i **zadržava ih kod sebe** — vidi se šta bi stiglo, na koju adresu i kako izgleda, a nijedna poruka ne može stvarno otići nekome. Tako se pozivnica isproba bez rizika da testna poruka završi kod stvarne osobe.

**Ako pošta zakaže, ništa se ne ruši.** Ovo je namerna odluka: kad pozovete kolegu a mail server tog trenutka ne radi, nalog je već napravljen — bilo bi pogrešno da vam ceo postupak prijavi grešku i ostavi vas bez ičega. Umesto toga, ekran vam kaže da poruka nije otišla i pokaže link koji prosleđujete sami. Taj rezervni put ostaje **i kad pošta radi**, jer poruka može završiti u nepoželjnoj pošti ili adresa može biti pogrešno otkucana.

**Šta i dalje ne šalje poštu, i zašto namerno.** Marketinški newsletter (M12) — jer masovna poruka traži i dugme „odjavi me" (zakonska obaveza), poštovanje pristanka svakog primaoca i usporavanje slanja da nas mail serveri ne označe kao izvor neželjene pošte. Poslati hiljadu poruka bez odjave gore je nego ne poslati ih. I sandučad iz modula M22 — tamo se poruke šalju *u ime konkretnog sandučeta* i, što je teži deo, **dovlače** iz njega; to je zaseban izbor koji tek treba napraviti.

---

*Za tehničke detalje (tačna imena tabela, API pozivi, pravila evaluacije prava) vidi `02-SPECIFIKACIJA-M1-CORE-IDENTITET.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje tu specifikaciju.*
