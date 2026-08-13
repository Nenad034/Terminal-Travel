# M8 (Sajt agencije, B2C prikaz) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M8 dobije značajnu izmenu.

---

## Šta je M8 zapravo

M8 je javni sajt agencije — mesto gde gost, bez ičije pomoći, može sam da pretraži ponudu, izabere smeštaj ili aranžman, i rezerviše. Sajt sam ne čuva nikakve podatke — svaki klik u pozadini poziva iste module koje već koristi interni tim (M1 za prijavu, M2 za katalog, M5 za rezervaciju, M10 za plaćanje), samo kroz drugačiji, javan "prozor". To znači da nikad ne postoje dve verzije iste ponude ili rezervacije — sajt i interni panel gledaju u isti podatak.

## Kako sajt razgovara sa ostatkom sistema — bez da preglednik ikad "vidi" pristupne podatke

Kad gost na sajtu klikne "Prijavi se", njegov preglednik ne dobija direktan pristup unutrašnjem sistemu. Umesto toga, server samog sajta (koji radi odvojeno od preglednika gosta) razgovara sa unutrašnjim sistemom u ime gosta i sam čuva potvrdu prijave u jedan zaštićen, nevidljiv "kolačić" u pregledaču. Ovo je isto kao kad hotel ne da gostu ključ od svih soba — recepcija (server sajta) proverava ko je gost i sama otvara samo njegovu sobu. Praktična posledica: čak i da neko provali u pregledač gosta preko zlonamernog sajta/skripte, ne može da "ukrade" njegovu prijavu na Terminal Travel, jer je ta prijava nikad nije ni bila tamo.

## Otkriveno pri gradnji: nedostajali su "otvoreni ulazi" za gosta

Kad je počela gradnja M8, ispostavilo se da moduli koje sajt treba da poziva (M1, M5, M6, M20) nisu imali stvarne "javne ulaze" za nekoga ko nije zaposleni — iako je specifikacija oduvek pretpostavljala da će ih gost koristiti. Konkretno:

- **Gost do sada nije mogao sam sebi da napravi nalog.** M1 je znao samo da poziva zaposlene (Vlasnik/HR pošalje pozivnicu). Dodato je: gost sam popuni email/lozinku/ime na sajtu i nalog odmah postoji, aktivan.
- **Pretraga je tražila prijavu, iako sajt mora da radi i za anonimnog posetioca.** Ispravljeno — pretraga je sad potpuno javna, kao i pregled kataloga.
- **Uloga "Gost" u sistemu prava (M1) postojala je po imenu, ali skoro bez ijednog stvarnog prava** — registrovan gost ne bi mogao ni da vidi sopstvenu rezervaciju. Dopunjeno tačno onim pravima koje su M5/M6/M20 specifikacije oduvek predviđale za tu ulogu.
- **Najozbiljniji nalaz:** čak i sa pravim pravima, sistem do sada nije proveravao da li je rezervacija/nalog/ugovor koji gost traži *zaista njegov* — samo da li ima uopšteno pravo da gleda rezervacije. Bez ove provere, registrovan gost bi teoretski mogao da pogodi broj tuđe rezervacije u adresi sajta i vidi njene podatke. Ovo je odmah zatvoreno za rezervacije, profil, i ugovore — gost sad vidi isključivo sopstvene, sve ostalo vraća "nije pronađeno" (ne otkriva čak ni da tuđa rezervacija postoji).

Ovo nije bio propust u ideji — specifikacija je od početka govorila da gost treba da ima ova prava. Nedostajao je stvarni kod koji to sprovodi, jer do sada nije postojao modul (M8) koji bi to ikad iskoristio. Sad postoji, i provera je ugrađena pre nego što je ijedan ekran sajta bio spojen na te podatke.

## Šta gost danas može na sajtu

1. Pretraži smeštaj/aranžmane/izlete bez prijave.
2. Otvori stranicu proizvoda, izabere datume.
3. Registruje se ili se prijavi (ako već ima nalog).
4. Pročita i prihvati uslove putovanja (isti "klik da prihvatam" kao kad prihvatate uslove korišćenja bilo koje aplikacije).
5. Plati karticom ili odabere bankovni prenos.
6. Vidi potvrdu rezervacije i preuzme vaučer čim bude spreman.
7. Kasnije se vrati na "Moje rezervacije" i "Profil" da pregleda/izmeni svoje podatke.

## Dopuna avgust 2026 — "O nama"/"Kontakt"/blog sad rade

M12 (Marketing/Content Engine) je u međuvremenu napravljen (drugi modul, ne ovaj). Njegov zadatak je da tim kroz interni panel piše i odobrava tekst opštih stranica ("O nama", "Kontakt") i blog članaka, uz isti korak odobrenja kao svaki drugi sadržaj (neko iz tima mora da klikne "Odobri" pre nego što bilo šta postane javno vidljivo). Sajt sad ume da pročita taj odobreni tekst i prikaže ga na `/stranica/o-nama`, `/stranica/kontakt`, `/blog/naziv-clanka`, itd. — dok tim ne objavi ništa kroz interni panel, te stranice jednostavno ne postoje (gost dobija "nije pronađeno", ne prazan ili polomljen ekran).

Uz to, sajt sad prepoznaje kad neko dođe preko marketinškog linka (npr. objava na Facebook-u sa posebnim kodom u adresi) i taj kod tiho prati posetioca do trenutka rezervacije — kasnije, u izveštajima (M13), moći ćete da vidite koliko je rezervacija zaista došlo iz koje objave, ne samo koliko je ljudi kliknulo.

## Šta namerno JOŠ nije uključeno (nije propust, čeka drugi modul ili dodatnu odluku)

- **Rezervacija bez ikakvog naloga** ("nastavi kao gost") — spec je ovo predviđao, ali bi zahtevalo novi javni "ulaz" u M6 koji bi mogao da se zloupotrebi (spam bez ikakve prijave) ako se ne doda i zaštita od automatizovanih zahteva. Za sada gost mora da napravi nalog (traje par sekundi) pre nego što rezerviše.
- **Traka za "pametnu" pretragu prirodnim jezikom** (otkucaš "porodični odmor na moru u avgustu") — čeka M15 (AI orkestracija), koji još nema kod.
- **Deljeni linkovi ka bazi znanja o destinacijama** — čekaju M23.
- **Pravo plaćanje karticom** — pošto konkretan platni provajder (banka/procesor) još nije izabran (otvoreno pitanje, čeka vas), sajt trenutno koristi privremenu simulaciju umesto prave forme za unos kartice. Kad izaberete provajdera, ovaj deo se menja, ostatak toka ostaje isti.

## Za tehničke detalje

Vidi `10-SPECIFIKACIJA-M8-SAJT-B2C.md` (ovaj folder) za tačan spisak ruta/ekrana, i dopune u `02-SPECIFIKACIJA-M1-CORE-IDENTITET.md`, `06-SPECIFIKACIJA-M5-REZERVACIJE.md`, `09-SPECIFIKACIJA-M6-CRM.md`, `21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` za tačno šta je u njima dopunjeno da bi M8 mogao da postoji — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.
